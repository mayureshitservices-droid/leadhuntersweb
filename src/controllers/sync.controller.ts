import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { prisma } from '../config/db.js';
import { io } from '../index.js';
import multer from 'multer';
import fs from 'fs';
import os_sdk from 'oci-objectstorage';
import { ociClient } from '../config/oci.js';
import path from 'path';
import crypto from 'crypto';

// Setup disk storage to prevent memory buffering (OOM issues)
const upload = multer({ dest: 'temp_uploads/' }).single('recording');

export class SyncController {

  syncCallLog = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'TELECALLER') {
         return res.status(403).json({ error: 'Forbidden' });
      }

      const { local_log_id, lead_id, duration_seconds, call_status, outcome, notes } = req.body;
      const telecaller_id = (req as any).user.id;

      const lead = await prisma.lead.findUnique({ where: { id: lead_id } });
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      // Update lead status only if outcome is provided
      if (outcome && outcome !== 'PENDING') {
        const formattedOutcome = outcome.toUpperCase().replace(' ', '_');
        await prisma.lead.update({
           where: { id: lead_id },
           data: { status: formattedOutcome as any }
        });
      }

      // Robust fallback to prevent duplicates even if Android app is old and doesn't send local_log_id
      let callLog;
      
      // Look for a recent call log for this exact lead and telecaller (within last 15 minutes)
      const recentLog = await prisma.callLog.findFirst({
        where: {
          telecaller_id,
          lead_id,
          created_at: {
            gte: new Date(Date.now() - 15 * 60 * 1000)
          }
        },
        orderBy: { created_at: 'desc' }
      });

      if (recentLog) {
        // Update the existing log instead of creating a duplicate
        callLog = await prisma.callLog.update({
          where: { id: recentLog.id },
          data: {
            duration_seconds: parseInt(duration_seconds, 10) || recentLog.duration_seconds,
            call_status: call_status || recentLog.call_status,
            outcome: outcome && outcome !== 'PENDING' ? outcome.toUpperCase().replace(' ', '_') : recentLog.outcome,
            notes: notes || recentLog.notes,
            local_log_id: local_log_id ? local_log_id.toString() : recentLog.local_log_id
          }
        });
      } else {
        // Create a new log
        callLog = await prisma.callLog.create({
          data: {
            lead_id,
            telecaller_id,
            local_log_id: local_log_id ? local_log_id.toString() : null,
            duration_seconds: parseInt(duration_seconds, 10) || 0,
            call_status: call_status || 'UNKNOWN',
            outcome: outcome && outcome !== 'PENDING' ? outcome.toUpperCase().replace(' ', '_') : null,
            notes: notes || null
          }
        });
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
    } catch (error) {
       console.error(error);
       res.status(500).json({ error: 'Internal server error' });
    }
  };

  syncRecording = (req: AuthRequest, res: Response) => {
    upload(req, res, async (err) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file provided' });
      if (!req.body.log_id) {
         fs.unlinkSync(req.file.path);
         return res.status(400).json({ error: 'log_id is required' });
      }

      try {
        const logId = req.body.log_id;
        const bucketName = process.env.OCI_BUCKET_NAME || 'leadHuntersRec';
        const namespace = process.env.OCI_NAMESPACE || 'bmdqyv5rml4m';
        
        const ext = path.extname(req.file.originalname) || '.m4a';
        const objectName = `records/${logId}_${crypto.randomBytes(4).toString('hex')}${ext}`;
        
        // Setup direct stream
        const fileStream = fs.createReadStream(req.file.path);
        
        if (!ociClient) {
           fs.unlinkSync(req.file.path);
           return res.status(500).json({ error: 'OCI Client not configured' });
        }

        const putObjectRequest: os_sdk.requests.PutObjectRequest = {
            namespaceName: namespace,
            bucketName: bucketName,
            objectName: objectName,
            putObjectBody: fileStream as any,
            contentLength: req.file.size,
            contentType: req.file.mimetype
        };

        const response = await ociClient.putObject(putObjectRequest);
        fs.unlinkSync(req.file.path); // cleanup

        const recordingUrl = `https://objectstorage.${process.env.OCI_REGION}.oraclecloud.com/n/${namespace}/b/${bucketName}/o/${encodeURIComponent(objectName)}`;

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

      } catch (error) {
         console.error('OCI Upload Error:', error);
         if(req.file) fs.unlinkSync(req.file.path);
         res.status(500).json({ error: 'Storage Error' });
      }
    });
  };

}
