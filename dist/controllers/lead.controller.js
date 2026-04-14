import { prisma } from '../config/db.js';
export class LeadController {
    getLeads = async (req, res) => {
        try {
            if (!req.user || req.user.role !== 'TELECALLER') {
                return res.status(403).json({ error: 'Forbidden' });
            }
            const limit = parseInt(req.query.limit) || 20;
            const offset = parseInt(req.query.offset) || 0;
            // Dispatcher Logic: Find all B.O. assigned to this telecaller
            const assignments = await prisma.telecallerAssignment.findMany({
                where: { telecaller_id: req.user.id },
                include: { business_owner: true }
            });
            if (assignments.length === 0) {
                return res.json({ leads: [] });
            }
            const assignedBoIds = assignments.map(a => a.business_owner_id);
            // We map ids to names for Android App consumption
            const boMap = {};
            assignments.forEach(a => {
                boMap[a.business_owner_id] = a.business_owner.name;
            });
            // Get leads belonging to assigned BOs, prioritizing PENDING
            const leads = await prisma.lead.findMany({
                where: {
                    business_owner_id: { in: assignedBoIds },
                    status: 'PENDING'
                },
                orderBy: {
                    created_at: 'asc' // Oldest pending first
                },
                take: limit,
                skip: offset
            });
            // Map to contract
            const mappedLeads = leads.map(lead => ({
                id: lead.id,
                name: lead.name,
                phone: lead.phone,
                status: lead.status,
                business_owner_id: lead.business_owner_id,
                business_owner_name: boMap[lead.business_owner_id]
            }));
            res.json({ leads: mappedLeads });
        }
        catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}
