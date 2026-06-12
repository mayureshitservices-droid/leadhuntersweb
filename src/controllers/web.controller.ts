import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db.js';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import * as XLSX from 'xlsx';

const safeUnlink = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`SafeUnlink failed for ${filePath}:`, err);
  }
};

export class WebController {

  getLogin = (req: Request, res: Response) => {
    if (req.session.user) {
      return this.dashboardRedirect(req, res);
    }
    res.render('login', { error: null });
  };

  postLogin = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.password_hash) {
        return res.render('login', { error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.render('login', { error: 'Invalid credentials' });
      }

      // Telecallers primarily use Android App
      if (user.role === 'TELECALLER') {
        return res.render('login', { error: 'Telecallers please use the Android app to login.' });
      }

      req.session.user = {
        id: user.id,
        role: user.role,
        name: user.name
      };

      req.session.save((err) => {
        if (err) throw err;
        this.dashboardRedirect(req, res);
      });
    } catch (error) {
      console.error('Error during login:', error);
      res.render('login', { error: 'An internal error occurred.' });
    }
  };

  logout = (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  };

  dashboardRedirect = (req: Request, res: Response) => {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (req.session.user.role === 'SUPER_ADMIN') {
      return res.redirect('/admin');
    }
    if (req.session.user.role === 'BUSINESS_OWNER') {
      return res.redirect('/owner');
    }
    res.redirect('/login');
  };

  getSuperAdminDashboard = async (req: Request, res: Response) => {
    const user = req.session.user!;
    // Fetch needed data for Admin
    const businessOwners = await prisma.user.findMany({ where: { role: 'BUSINESS_OWNER' } });
    const telecallers = await prisma.user.findMany({ where: { role: 'TELECALLER' } });

    res.render('admin_dashboard', {
      user,
      businessOwners,
      telecallers
    });
  };

  getOwnerDashboard = async (req: Request, res: Response) => {
    const user = req.session.user!;
    const ownerId = user.id;

    const stats = {
      total: await prisma.lead.count({ where: { business_owner_id: ownerId } }),
      pending: await prisma.lead.count({ where: { business_owner_id: ownerId, status: 'PENDING' } }),
      answered: await prisma.lead.count({ where: { business_owner_id: ownerId, status: { not: 'PENDING' } } })
    };

    let uploadMsg = null;
    let errorMsg = null;

    if (req.query.upload === 'success') uploadMsg = 'Leads uploaded successfully!';
    if (req.query.upload === 'error') {
      const foundHeaders = req.query.headers ? String(req.query.headers) : null;
      if (req.query.msg === 'invalid_file_type') {
        errorMsg = 'Invalid file type. Please upload CSV or Excel.';
      } else if (req.query.msg === 'missing_columns') {
        errorMsg = `Failed to upload: Missing "Name" or "Phone" columns. Found headers: [${foundHeaders || 'None'}]`;
      } else if (req.query.msg === 'empty_file') {
        errorMsg = 'The uploaded file is empty.';
      } else {
        errorMsg = 'Failed to upload leads. Please check your data format.';
      }
    }



    // Fetch telecallers assigned to this business owner
    const telecallers = await prisma.user.findMany({
      where: { owner_id: ownerId, role: 'TELECALLER' },
      select: { id: true, name: true, device_alias: true, last_seen: true }
    });
    const telecallerList = telecallers.map(tc => ({
      id: tc.id,
      name: tc.device_alias || tc.name,
      last_seen: tc.last_seen
    }));

    const leads = await prisma.lead.findMany({
      where: { business_owner_id: ownerId },
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { telecaller: { select: { name: true, device_alias: true } } }
    });

    const callLogs = await prisma.callLog.findMany({
      where: {
        lead: {
          business_owner_id: ownerId
        }
      },
      include: {
        lead: { select: { name: true, phone: true, status: true } },
        telecaller: { select: { name: true, device_alias: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 5
    });

    // Performance Stats Logic
    const now = new Date();
    let perfStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let perfEnd = new Date();
    
    if (req.query.perfStart) {
      perfStart = new Date(req.query.perfStart as string);
    }
    if (req.query.perfEnd) {
      perfEnd = new Date(req.query.perfEnd as string);
      perfEnd.setHours(23, 59, 59, 999);
    }

    const callLogsPerformance = await prisma.callLog.findMany({
      where: { lead: { business_owner_id: ownerId }, created_at: { gte: perfStart, lte: perfEnd } },
      select: { telecaller_id: true, outcome: true, call_status: true, duration_seconds: true, created_at: true }
    });

    const perf: Record<string, any> = {};
    telecallerList.forEach(tc => {
      perf[tc.id] = {
        id: tc.id,
        name: tc.name,
        last_seen: tc.last_seen,
        total: 0, 
        answered: 0, 
        missed: 0, 
        rejected: 0, 
        talkTime: 0 
      };
    });

    callLogsPerformance.forEach(log => {
      if (!perf[log.telecaller_id]) return;
      const status = log.call_status?.toUpperCase() || 'UNKNOWN';
      perf[log.telecaller_id].total++;
      perf[log.telecaller_id].talkTime += log.duration_seconds;
      if (status.includes('ANSWERED')) perf[log.telecaller_id].answered++;
      else if (status.includes('MISSED')) perf[log.telecaller_id].missed++;
      else if (status.includes('REJECTED') || status.includes('CANCELLED')) perf[log.telecaller_id].rejected++;
    });

    const formatTime = (s: number) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const secs = s % 60;
      return h > 0 ? `${h}h ${m}m ${secs}s` : `${m}m ${secs}s`;
    };

    const telecallerPerformance = Object.values(perf).map(p => ({
      ...p,
      talkTimeFormatted: formatTime(p.talkTime)
    }));

    // Fetch Campaign Data
    const campaignLeads = await prisma.lead.findMany({
      where: { business_owner_id: ownerId },
      select: { 
        file_name: true, 
        status: true,
        telecaller_id: true
      }
    });
    const campaignMap: Record<string, any> = {};
    campaignLeads.forEach(lead => {
      const name = lead.file_name || 'Legacy Upload';
      if (!campaignMap[name]) {
        campaignMap[name] = { 
          name, 
          total: 0, 
          processed: 0, 
          available: 0,
          inProgress: 0
        };
      }
      campaignMap[name].total++;
      if (lead.status === 'PENDING') {
        if (!lead.telecaller_id) {
          campaignMap[name].available++;
        } else {
          campaignMap[name].inProgress++;
        }
      } else {
        campaignMap[name].processed++;
      }
    });
    const campaigns = Object.values(campaignMap);

    res.render('owner_dashboard', {
      user,
      stats,
      uploadMsg,
      errorMsg,
      leads,
      telecallers: telecallerList,
      callLogs,
      telecallerPerformance,
      campaigns,
      perfStart: perfStart.toISOString().split('T')[0],
      perfEnd: perfEnd.toISOString().split('T')[0]
    });
  };

  exportCallLogs = async (req: Request, res: Response) => {
    try {
      const ownerId = req.session.user!.id;
      const { start, end } = req.query;

      const dateFilter: any = {
        lead: { business_owner_id: ownerId }
      };

      if (start || end) {
        dateFilter.created_at = {};
        if (start) dateFilter.created_at.gte = new Date(start as string);
        if (end) {
          const endDate = new Date(end as string);
          endDate.setHours(23, 59, 59, 999);
          dateFilter.created_at.lte = endDate;
        }
      }

      const logs = await prisma.callLog.findMany({
        where: dateFilter,
        include: {
          lead: true,
          telecaller: { select: { name: true, device_alias: true } }
        },
        orderBy: { created_at: 'desc' }
      });

      if (logs.length === 0) {
        return res.status(404).send('No logs found for the selected range.');
      }

      // Collect all dynamic keys from additional_data
      const dynamicKeys = new Set<string>();
      logs.forEach(log => {
        if ((log.lead as any).additional_data && typeof (log.lead as any).additional_data === 'object') {
          Object.keys((log.lead as any).additional_data).forEach(key => dynamicKeys.add(key));
        }
      });

      const excelData = logs.map(log => {
        const row: any = {
          'Customer Name': log.lead.name,
          'Phone': log.lead.phone,
          'Date': new Date(log.created_at).toLocaleDateString('en-IN'),
          'Time': new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          'Duration (Sec)': log.duration_seconds,
          'Duration (MM:SS)': `${Math.floor(log.duration_seconds / 60).toString().padStart(2, '0')}:${(log.duration_seconds % 60).toString().padStart(2, '0')}`,
          'Status': log.call_status,
          'Outcome': (log.outcome && log.outcome !== 'PENDING' ? log.outcome : '—').replace(/_/g, ' '),
          'Notes': log.notes || '—',
          'Telecaller': log.telecaller.device_alias || log.telecaller.name,
          'Recording URL': log.recording_url || 'N/A'
        };

        // Add dynamic fields
        const additionalData = (log.lead as any).additional_data as Record<string, any>;
        dynamicKeys.forEach(key => {
          row[key] = additionalData ? (additionalData[key] || '—') : '—';
        });

        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Call Logs');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Call_Logs_${start || 'all'}_to_${end || 'today'}.xlsx`);
      res.send(buffer);

    } catch (error) {
      console.error('Export Error:', error);
      res.status(500).send('Internal Server Error during export.');
    }
  };

  postUploadLeads = async (req: Request, res: Response) => {
    if (!req.file) {
      return res.redirect('/owner?upload=error');
    }

    const ownerId = req.session.user!.id;
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const campaignName = req.body.campaign_name?.trim() || fileName;
    const fileExt = path.extname(fileName).toLowerCase();

    try {
      let results: any[] = [];

      if (fileExt === '.csv') {
        // Handle CSV
        results = await new Promise((resolve, reject) => {
          const rows: any[] = [];
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => rows.push(data))
            .on('error', (err) => reject(err))
            .on('end', () => resolve(rows));
        });
      } else if (fileExt === '.xlsx' || fileExt === '.xls') {
        // Handle Excel
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        results = XLSX.utils.sheet_to_json(worksheet);
      } else {
        safeUnlink(filePath);
        return res.redirect('/owner?upload=error&msg=invalid_file_type');
      }

      if (results.length === 0) {
        safeUnlink(filePath);
        return res.redirect('/owner?upload=error&msg=empty_file');
      }

      // Collect all headers for debugging
      const allHeaders = results.length > 0 ? Object.keys(results[0]).join(', ') : '';

      const leadsToInsert = results
        .map(row => this.normalizeLead(row, ownerId))
        .filter(lead => lead.name && lead.phone && lead.phone !== '0000000000');

      if (leadsToInsert.length === 0) {
        safeUnlink(filePath);
        return res.redirect(`/owner?upload=error&msg=missing_columns&headers=${encodeURIComponent(allHeaders)}`);
      }

      // Upsert logic: Create new leads, and for existing phone numbers (recurring customers),
      // reset status to PENDING so telecallers can call them again in the new cycle.
      const BATCH_SIZE = 100;
      for (let i = 0; i < leadsToInsert.length; i += BATCH_SIZE) {
        const batch = leadsToInsert.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(lead =>
            prisma.lead.upsert({
              where: {
                business_owner_id_phone: {
                  business_owner_id: ownerId,
                  phone: lead.phone
                }
              },
              create: {
                business_owner_id: ownerId,
                name: lead.name,
                phone: lead.phone,
                status: 'PENDING',
                file_name: campaignName,
                additional_data: lead.additional_data
              },
              update: {
                status: 'PENDING',
                file_name: campaignName,
                name: lead.name,
                additional_data: lead.additional_data
              }
            })
          )
        );
      }

      safeUnlink(filePath);
      res.redirect('/owner?upload=success');
    } catch (err) {
      console.error('Upload Error Details:', err instanceof Error ? err.message : err);
      safeUnlink(filePath);
      res.redirect('/owner?upload=error');
    }
  };

  private normalizeLead = (row: any, ownerId: string, telecallerId?: string) => {
    // Normalize keys to lowercase for easier lookup
    const normalizedRow: any = {};

    Object.keys(row).forEach(key => {
      const normalizedKey = key.toLowerCase().trim();
      normalizedRow[normalizedKey] = row[key];
    });

    const nameKeys = ['name', 'full name', 'customer name', 'client name', 'lead name'];
    const phoneKeys = ['phone', 'mobile', 'number', 'phone number', 'contact number', 'mobile number'];

    let name = 'Unknown';
    let phone = '0000000000';
    let foundNameKey = '';
    let foundPhoneKey = '';

    // Find Name
    for (const key of nameKeys) {
      if (normalizedRow[key]) {
        name = String(normalizedRow[key]).trim();
        // Find the original key to exclude it from additional_data
        foundNameKey = Object.keys(row).find(k => k.toLowerCase().trim() === key) || '';
        break;
      }
    }

    // Find Phone
    for (const key of phoneKeys) {
      if (normalizedRow[key]) {
        phone = String(normalizedRow[key]).trim().replace(/[^\d+]/g, '');
        foundPhoneKey = Object.keys(row).find(k => k.toLowerCase().trim() === key) || '';
        break;
      }
    }

    // Capture everything else as additional_data
    const additional_data: any = {};
    Object.keys(row).forEach(key => {
      if (key !== foundNameKey && key !== foundPhoneKey) {
        additional_data[key] = row[key];
      }
    });

    let safeAdditionalData = null;
    if (Object.keys(additional_data).length > 0) {
      // Strip out incompatible data types (like Date objects or undefined) to prevent Prisma Json crashes
      safeAdditionalData = JSON.parse(JSON.stringify(additional_data));
    }

    return {
      business_owner_id: ownerId,
      telecaller_id: telecallerId || null,
      name,
      phone,
      additional_data: safeAdditionalData
    } as any;
  };



  updateDeviceAlias = async (req: Request, res: Response) => {
    try {
      const { telecallerId, deviceAlias } = req.body;

      if (!telecallerId) {
        return res.status(400).json({ error: 'Telecaller ID is required' });
      }

      await prisma.user.update({
        where: { id: telecallerId },
        data: { device_alias: deviceAlias }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating device alias:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  createCustomer = async (req: Request, res: Response) => {
    try {
      const { name, email, password, phone, payment_terms, status } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, Email, and Password are required.' });
      }

      const password_hash = await bcrypt.hash(password, 10);

      const customer = await prisma.user.create({
        data: {
          name,
          email,
          password_hash,
          phone,
          payment_terms: parseInt(payment_terms, 10) || null,
          status: status || 'Active',
          role: 'BUSINESS_OWNER'
        }
      });

      res.status(201).json({ success: true, customer: { id: customer.id, name: customer.name } });
    } catch (error: any) {
      console.error('Error creating customer:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Email already exists.' });
      }
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

  updateCustomer = async (req: Request, res: Response) => {
    try {
      const { id, name, email, phone, payment_terms } = req.body;

      if (!id || !name || !email) {
        return res.status(400).json({ error: 'ID, Name, and Email are required.' });
      }

      await prisma.user.update({
        where: { id },
        data: {
          name,
          email,
          phone,
          payment_terms: parseInt(payment_terms, 10) || null
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating customer:', error);
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Email already exists.' });
      }
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

  updateCustomerStatus = async (req: Request, res: Response) => {
    try {
      const { id, status } = req.body;

      if (!id || !status) {
        return res.status(400).json({ error: 'ID and Status are required.' });
      }

      await prisma.user.update({
        where: { id },
        data: { status }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating customer status:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

  deleteCustomer = async (req: Request, res: Response) => {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Customer ID is required.' });
      }

      await prisma.user.delete({
        where: { id }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting customer:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

  getTelecallerAssignments = async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const user = await prisma.user.findUnique({
        where: { id },
        select: { owner_id: true }
      });

      res.json({ owner_id: user?.owner_id || null });
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

  setTelecallerOwner = async (req: Request, res: Response) => {
    try {
      const telecallerId = req.body.telecallerId as string;
      const businessOwnerId = req.body.businessOwnerId as string;

      if (!telecallerId || !businessOwnerId) {
        return res.status(400).json({ error: 'Telecaller ID and Business Owner ID are required.' });
      }

      await prisma.user.update({
        where: { id: telecallerId },
        data: { owner_id: businessOwnerId }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error setting telecaller owner:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

  deleteCampaignLeads = async (req: Request, res: Response) => {
    try {
      const ownerId = req.session.user!.id;
      const { fileName } = req.body;

      if (!fileName) {
        return res.status(400).json({ error: 'File name is required' });
      }

      // Find leads to be deleted (only PENDING)
      const leadsToDelete = await prisma.lead.findMany({
        where: {
          business_owner_id: ownerId,
          file_name: fileName,
          status: 'PENDING'
        },
        select: { id: true }
      });

      if (leadsToDelete.length === 0) {
        return res.json({ success: true, count: 0 });
      }

      const leadIds = leadsToDelete.map(l => l.id);

      // Record deletions for the Android Heartbeat
      await prisma.deletedLead.createMany({
        data: leadIds.map(id => ({
          lead_id: id,
          business_owner_id: ownerId
        }))
      });

      // Perform deletion
      await prisma.lead.deleteMany({
        where: { id: { in: leadIds } }
      });

      res.json({ success: true, count: leadIds.length });
    } catch (error) {
      console.error('Delete Campaign Error:', error);
      res.status(500).json({ error: 'Failed to delete leads' });
    }
  };

  getPaginatedCallLogs = async (req: Request, res: Response) => {
    try {
      const ownerId = req.session.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const search = (req.query.search as string || '').trim();
      const take = 5;
      const skip = (page - 1) * take;

      const searchWhere: any = {
        AND: [
          { lead: { business_owner_id: ownerId } },
          ...(search ? [{
            OR: [
              { lead: { name: { contains: search, mode: 'insensitive' } } },
              { lead: { phone: { contains: search, mode: 'insensitive' } } },
              { telecaller: { name: { contains: search, mode: 'insensitive' } } },
              { telecaller: { device_alias: { contains: search, mode: 'insensitive' } } },
              { notes: { contains: search, mode: 'insensitive' } },
              { call_status: { contains: search, mode: 'insensitive' } },
              { outcome: { contains: search, mode: 'insensitive' } },
            ]
          }] : [])
        ]
      };

      const callLogs = await prisma.callLog.findMany({
        where: searchWhere,
        include: {
          lead: { select: { name: true, phone: true, status: true } },
          telecaller: { select: { name: true, device_alias: true } }
        },
        orderBy: { created_at: 'desc' },
        take,
        skip
      });

      const totalCount = await prisma.callLog.count({ where: searchWhere });

      res.json({ success: true, data: callLogs, totalCount });
    } catch (error) {
      console.error('Error fetching paginated call logs:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

  getPaginatedLeads = async (req: Request, res: Response) => {
    try {
      const ownerId = req.session.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const search = (req.query.search as string || '').trim();
      const take = 5;
      const skip = (page - 1) * take;

      const searchWhere: any = {
        AND: [
          { business_owner_id: ownerId },
          ...(search ? [{
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { telecaller: { name: { contains: search, mode: 'insensitive' } } },
              { telecaller: { device_alias: { contains: search, mode: 'insensitive' } } },
              { file_name: { contains: search, mode: 'insensitive' } },
            ]
          }] : [])
        ]
      };

      const leads = await prisma.lead.findMany({
        where: searchWhere,
        orderBy: { created_at: 'desc' },
        take,
        skip,
        include: { telecaller: { select: { name: true, device_alias: true } } }
      });

      const totalCount = await prisma.lead.count({ where: searchWhere });

      res.json({ success: true, data: leads, totalCount });
    } catch (error) {
      console.error('Error fetching paginated leads:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

}
