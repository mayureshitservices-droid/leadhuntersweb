import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { prisma } from '../config/db.js';

export class LeadController {

  getLeads = async (req: AuthRequest, res: Response) => {
    try {
      if (!req.user || req.user.role !== 'TELECALLER') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Only serve leads explicitly assigned to this telecaller by the business owner
      const leads = await prisma.lead.findMany({
        where: {
          telecaller_id: req.user.id,
          status: 'PENDING'
        },
        orderBy: {
          sort_order: 'asc' 
        },
        take: limit,
        skip: offset,
        include: {
          business_owner: { select: { name: true } }
        }
      });

      // Map to Android app contract
      const mappedLeads = leads.map(lead => ({
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        additional_data: (lead as any).additional_data,
        business_owner_id: lead.business_owner_id,
        business_owner_name: lead.business_owner.name
      }));

      res.json({ leads: mappedLeads });
    } catch (error) {
       console.error(error);
       res.status(500).json({ error: 'Internal Server Error' });
    }
  };

}
