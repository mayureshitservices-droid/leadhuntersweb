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

      const { lead_id, duration_seconds, status, notes } = req.body;

      const lead = await prisma.lead.findUnique({ where: { id: lead_id } });
      if (!lead) return res.status(404).json({ error: 'Lead not found' });

      // Update lead status
      await prisma.lead.update({
         where: { id: lead_id },
         data: { status: status.toUpperCase() as any }
      });

      // Insert Call Log
      const callLog = await prisma.callLog.create({
         data: {
            lead_id,
            telecaller_id: req.user.id,
            duration_seconds: parseInt(duration_seconds, 10),
            status,
            notes,
            recording_url: null,
         }
      });

      // Emit to dashboard via Socket.IO
      io.to(`dashboard_${lead.business_owner_id}`).emit('new_call_log', {
         log_id: callLog.id,
         lead_name: lead.name,
         lead_phone: lead.phone,
         telecaller_name: req.user.name,
         duration: duration_seconds,
         status,
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
