import { prisma } from '../config/db.js';
import { io } from '../index.js';
import multer from 'multer';
import fs from 'fs';
import { ociClient } from '../config/oci.js';
import path from 'path';
import crypto from 'crypto';
// Setup disk storage to prevent memory buffering (OOM issues)
const tempDir = path.join(process.cwd(), 'temp_uploads');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}
const upload = multer({ dest: tempDir }).single('recording');
export class SyncController {
    syncCallLog = async (req, res) => {
        try {
            if (!req.user || req.user.role !== 'TELECALLER') {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const { local_log_id, lead_id, duration_seconds, call_status, outcome, notes } = req.body;
            const telecaller_id = req.user.id;
            console.log(`[SyncCallLog] Received: local_log_id=${local_log_id}, lead_id=${lead_id}, call_status=${call_status}, outcome=${outcome}`);
            const lead = await prisma.lead.findUnique({ where: { id: lead_id } });
            if (!lead) {
                console.error(`[SyncCallLog] Lead NOT FOUND: ${lead_id}`);
                return res.status(404).json({ error: 'Lead not found' });
            }
            // Update lead status only if outcome is provided
            if (outcome && outcome !== 'PENDING') {
                const formattedOutcome = outcome.toUpperCase().replace(/ /g, '_');
                await prisma.lead.update({
                    where: { id: lead_id },
                    data: { status: formattedOutcome }
                });
            }
            // ONLY match on local_log_id — never fall back to time-window search
            // (the 15-min fallback was causing recordings to attach to the wrong row)
            let existingLog = null;
            if (local_log_id) {
                existingLog = await prisma.callLog.findFirst({
                    where: {
                        telecaller_id,
                        local_log_id: local_log_id.toString()
                    }
                });
                console.log(`[SyncCallLog] local_log_id lookup result: ${existingLog ? `FOUND id=${existingLog.id}` : 'NOT FOUND → will create new'}`);
            }
            else {
                console.warn(`[SyncCallLog] No local_log_id provided — always creating new log`);
            }
            let callLog;
            if (existingLog) {
                // Update the existing log
                callLog = await prisma.callLog.update({
                    where: { id: existingLog.id },
                    data: {
                        duration_seconds: duration_seconds ? parseInt(duration_seconds, 10) : existingLog.duration_seconds,
                        call_status: call_status || existingLog.call_status,
                        outcome: outcome && outcome !== 'PENDING' ? outcome.toUpperCase().replace(/ /g, '_') : existingLog.outcome,
                        notes: notes || existingLog.notes,
                        local_log_id: local_log_id ? local_log_id.toString() : existingLog.local_log_id
                    }
                });
                console.log(`[SyncCallLog] Updated existing log id=${callLog.id}`);
            }
            else {
                // Create a new log
                callLog = await prisma.callLog.create({
                    data: {
                        lead_id,
                        telecaller_id,
                        local_log_id: local_log_id ? local_log_id.toString() : null,
                        duration_seconds: duration_seconds ? parseInt(duration_seconds, 10) : 0,
                        call_status: call_status || 'UNKNOWN',
                        outcome: outcome && outcome !== 'PENDING' ? outcome.toUpperCase().replace(/ /g, '_') : null,
                        notes: notes || null
                    }
                });
                console.log(`[SyncCallLog] Created NEW log id=${callLog.id}`);
            }
            // Emit to dashboard via Socket.IO
            io.to(`dashboard_${lead.business_owner_id}`).emit('new_call_log', {
                log_id: callLog.id,
                lead_name: lead.name,
                lead_phone: lead.phone,
                telecaller_name: req.user.name,
                duration: duration_seconds,
                call_status: call_status || 'UNKNOWN',
                outcome: outcome || '—',
                notes
            });
            res.status(201).json({ success: true, log_id: callLog.id });
        }
        catch (error) {
            console.error('[SyncCallLog] ERROR:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
    syncRecording = (req, res) => {
        upload(req, res, async (err) => {
            if (err)
                return res.status(500).json({ error: err.message });
            if (!req.file)
                return res.status(400).json({ error: 'No file provided' });
            const file = req.file;
            if (!req.body.log_id) {
                fs.unlinkSync(file.path);
                return res.status(400).json({ error: 'log_id is required' });
            }
            try {
                const logId = req.body.log_id;
                console.log(`[SyncRecording] Received recording for log_id=${logId}, file=${req.file?.originalname}, size=${req.file?.size} bytes`);
                const bucketName = (process.env.OCI_BUCKET_NAME || 'spenca-telecrm-recordings').replace(/^"|"$/g, '');
                const namespace = (process.env.OCI_NAMESPACE || 'bmdqyv5rml4m').replace(/^"|"$/g, '');
                const region = (process.env.OCI_REGION || 'ap-mumbai-1').replace(/^"|"$/g, '');
                const ext = path.extname(file.originalname) || '.m4a';
                const objectName = `records/${logId}_${crypto.randomBytes(4).toString('hex')}${ext}`;
                // Setup direct stream
                const fileStream = fs.createReadStream(file.path);
                if (!ociClient) {
                    fs.unlinkSync(file.path);
                    return res.status(500).json({ error: 'OCI Client not configured' });
                }
                const putObjectRequest = {
                    namespaceName: namespace,
                    bucketName: bucketName,
                    objectName: objectName,
                    putObjectBody: fileStream,
                    contentLength: file.size,
                    contentType: file.mimetype
                };
                const response = await ociClient.putObject(putObjectRequest);
                fs.unlinkSync(file.path); // cleanup
                const recordingUrl = `https://objectstorage.${region}.oraclecloud.com/n/${namespace}/b/${bucketName}/o/${encodeURIComponent(objectName)}`;
                const updatedLog = await prisma.callLog.update({
                    where: { id: logId },
                    data: { recording_url: recordingUrl },
                    include: { lead: true }
                });
                // Notify owner dashboard about the new recording
                io.to(`dashboard_${updatedLog.lead.business_owner_id}`).emit('recording_ready', {
                    log_id: logId,
                    recording_url: recordingUrl
                });
                res.json({ success: true, recording_url: recordingUrl });
            }
            catch (error) {
                console.error('OCI Upload Error:', error);
                if (req.file)
                    fs.unlinkSync(req.file.path);
                res.status(500).json({ error: `Storage Error: ${error.message || 'Unknown'}` });
            }
        });
    };
}
