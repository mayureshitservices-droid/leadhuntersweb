import { prisma } from '../config/db.js';
export class LeadController {
    getCampaigns = async (req, res) => {
        try {
            if (!req.user || req.user.role !== 'TELECALLER') {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const telecaller = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { owner_id: true }
            });
            if (!telecaller?.owner_id) {
                return res.status(400).json({ error: 'No business owner assigned to this telecaller' });
            }
            const campaignLeads = await prisma.lead.findMany({
                where: { business_owner_id: telecaller.owner_id },
                select: { file_name: true, status: true, telecaller_id: true }
            });
            const campaignMap = {};
            campaignLeads.forEach(lead => {
                const name = lead.file_name || 'Legacy Upload';
                if (!campaignMap[name]) {
                    campaignMap[name] = { name, total: 0, processed: 0, pending: 0, available: 0 };
                }
                campaignMap[name].total++;
                if (lead.status === 'PENDING') {
                    campaignMap[name].pending++;
                    if (!lead.telecaller_id) {
                        campaignMap[name].available++;
                    }
                }
                else {
                    campaignMap[name].processed++;
                }
            });
            const campaigns = Object.values(campaignMap);
            res.json({ campaigns });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
    claimCampaignLeads = async (req, res) => {
        try {
            if (!req.user || req.user.role !== 'TELECALLER') {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const { campaign_name } = req.body;
            if (!campaign_name) {
                return res.status(400).json({ error: 'campaign_name is required' });
            }
            const telecallerId = req.user.id;
            const telecaller = await prisma.user.findUnique({
                where: { id: telecallerId },
                select: { owner_id: true, owner: { select: { name: true } } }
            });
            if (!telecaller?.owner_id) {
                return res.status(400).json({ error: 'No business owner assigned' });
            }
            // Atomically release and claim leads in a transaction
            const updatedLeads = await prisma.$transaction(async (tx) => {
                await tx.lead.updateMany({
                    where: {
                        telecaller_id: telecallerId,
                        status: 'PENDING'
                    },
                    data: {
                        telecaller_id: null
                    }
                });
                return await tx.$queryRaw `
        UPDATE "Lead"
        SET telecaller_id = ${telecallerId}
        WHERE id IN (
          SELECT id FROM "Lead"
          WHERE business_owner_id = ${telecaller.owner_id}
            AND file_name = ${campaign_name}
            AND status = 'PENDING'
            AND telecaller_id IS NULL
          ORDER BY created_at ASC
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        )
          RETURNING id, name, phone, status, business_owner_id, file_name, additional_data;
      `;
            });
            const leads = updatedLeads.map(lead => ({
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                status: lead.status,
                business_owner_id: lead.business_owner_id,
                business_owner_name: telecaller.owner?.name || '',
                campaign_name: lead.file_name || '',
                additional_data: lead.additional_data
            }));
            res.json({ success: true, claimed_count: updatedLeads.length, leads });
        }
        catch (error) {
            console.error('Claim Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}
