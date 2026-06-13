import { prisma } from '../config/db.js';
export class TelecallerController {
    postStatus = async (req, res) => {
        try {
            if (!req.user)
                return res.status(401).json({ error: 'Unauthorized' });
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
        }
        catch (error) {
            console.error('Status update error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
    getStatuses = async (_req, res) => {
        try {
            const [users, statusRows] = await Promise.all([
                prisma.user.findMany({
                    where: { role: 'TELECALLER' },
                    select: { id: true, name: true, device_alias: true, last_seen: true }
                }),
                prisma.telecallerStatus.findMany()
            ]);
            const now = Date.now();
            const fiveMinMs = 5 * 60 * 1000;
            const statusMap = new Map(statusRows.map(r => [r.telecaller_name, r]));
            const telecallers = users.map(user => {
                const userLastSeen = user.last_seen ? user.last_seen.getTime() : 0;
                const diffMs = now - userLastSeen;
                const isOnline = diffMs < fiveMinMs;
                const statusRow = statusMap.get(user.name);
                const statusFromRow = statusRow?.status;
                let derivedStatus;
                if (!isOnline) {
                    derivedStatus = 'offline';
                }
                else if (statusFromRow === 'on_call') {
                    derivedStatus = 'on_call';
                }
                else {
                    derivedStatus = 'idle';
                }
                const lastSeenAt = userLastSeen;
                const seconds = Math.floor(diffMs / 1000);
                let lastSeenHuman;
                if (seconds < 60) {
                    lastSeenHuman = 'just now';
                }
                else if (seconds < 3600) {
                    lastSeenHuman = `${Math.floor(seconds / 60)} min ago`;
                }
                else {
                    lastSeenHuman = `${Math.floor(seconds / 3600)}h ago`;
                }
                return {
                    id: user.id,
                    name: user.device_alias || user.name,
                    status: derivedStatus,
                    last_seen_at: lastSeenAt,
                    last_seen_human: lastSeenHuman,
                };
            });
            res.json({ telecallers });
        }
        catch (error) {
            console.error('Status fetch error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}
