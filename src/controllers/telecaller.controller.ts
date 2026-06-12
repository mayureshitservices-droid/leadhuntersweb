import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { prisma } from '../config/db.js';

export class TelecallerController {

  postStatus = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

      const { status, timestamp } = req.body;
      if (!status || !timestamp) {
        return res.status(400).json({ error: 'status and timestamp are required' });
      }
      if (!['on_call', 'idle'].includes(status)) {
        return res.status(400).json({ error: 'status must be "on_call" or "idle"' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { name: true, device_id: true }
      });

      if (!user || !user.device_id) {
        return res.status(400).json({ error: 'Telecaller not found or not registered' });
      }

      await prisma.telecallerStatus.upsert({
        where: { telecaller_name: user.name },
        update: {
          status,
          last_seen_at: BigInt(timestamp),
          device_id: user.device_id,
        },
        create: {
          telecaller_name: user.name,
          device_id: user.device_id,
          status,
          last_seen_at: BigInt(timestamp),
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Status update error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  getStatuses = async (_req: AuthRequest, res: Response) => {
    try {
      const rows = await prisma.telecallerStatus.findMany({
        orderBy: { telecaller_name: 'asc' }
      });

      const now = Date.now();
      const fiveMinMs = 5 * 60 * 1000;

      const telecallers = rows.map(row => {
        const lastSeenAt = Number(row.last_seen_at);
        const diffMs = now - lastSeenAt;
        const isOnline = diffMs < fiveMinMs;

        let derivedStatus: string;
        if (!isOnline) {
          derivedStatus = 'offline';
        } else {
          derivedStatus = row.status;
        }

        const seconds = Math.floor(diffMs / 1000);
        let lastSeenHuman: string;
        if (seconds < 60) {
          lastSeenHuman = 'just now';
        } else if (seconds < 3600) {
          lastSeenHuman = `${Math.floor(seconds / 60)} min ago`;
        } else {
          lastSeenHuman = `${Math.floor(seconds / 3600)}h ago`;
        }

        return {
          name: row.telecaller_name,
          status: derivedStatus,
          last_seen_at: lastSeenAt,
          last_seen_human: lastSeenHuman,
        };
      });

      res.json({ telecallers });
    } catch (error) {
      console.error('Status fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
