import { Request, Response } from 'express';
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
        answered: await prisma.lead.count({ where: { business_owner_id: ownerId, status: 'ANSWERED' } })
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

     let assignMsg = null;
     let assignError = null;
     if (req.query.assign === 'success') {
        const count = req.query.count || '0';
        assignMsg = `Successfully assigned ${count} lead(s) to the selected telecaller!`;
     }
     if (req.query.assign === 'error') {
        assignError = req.query.msg === 'no_telecaller'
           ? 'Please select a telecaller before assigning.'
           : 'Failed to assign leads. Please try again.';
     }

     // Fetch telecallers assigned to this business owner
     const assignments = await prisma.telecallerAssignment.findMany({
        where: { business_owner_id: ownerId },
        include: { telecaller: { select: { id: true, name: true, device_alias: true } } }
     });
     const telecallers = assignments.map(a => ({
        id: a.telecaller.id,
        name: a.telecaller.device_alias || a.telecaller.name
     }));

     const leads = await prisma.lead.findMany({
        where: { business_owner_id: ownerId },
        orderBy: { created_at: 'desc' },
        take: 100,
        include: { telecaller: { select: { name: true, device_alias: true } } }
     });

     const callLogs = await prisma.callLog.findMany({
        where: {
           lead: {
              business_owner_id: ownerId
           }
        },
        include: {
           lead: { select: { name: true, phone: true } },
           telecaller: { select: { name: true, device_alias: true } }
        },
        orderBy: { created_at: 'desc' },
        take: 50
      });

      res.render('owner_dashboard', {
         user,
         stats,
         uploadMsg,
         errorMsg,
         assignMsg,
         assignError,
         leads,
         telecallers,
         callLogs
      });
  };

  postUploadLeads = async (req: Request, res: Response) => {
    if (!req.file) {
      return res.redirect('/owner?upload=error');
    }

    const ownerId = req.session.user!.id;
    const filePath = req.file.path;
    const fileExt = path.extname(req.file.originalname).toLowerCase();

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

      await prisma.lead.createMany({
        data: leadsToInsert,
        skipDuplicates: true
      });

      safeUnlink(filePath);
      res.redirect('/owner?upload=success');
    } catch (err) {
      console.error('Upload Error:', err);
      safeUnlink(filePath);
      res.redirect('/owner?upload=error');
    }
  };

  private normalizeLead = (row: any, ownerId: string, telecallerId?: string) => {
    // Normalize keys to lowercase for easier lookup
    const normalizedRow: any = {};
    Object.keys(row).forEach(key => {
       normalizedRow[key.toLowerCase().trim()] = row[key];
    });

    const name = normalizedRow.name || normalizedRow['full name'] || normalizedRow['customer name'] || normalizedRow['client name'] || normalizedRow['lead name'] || 'Unknown';
    const phone = normalizedRow.phone || normalizedRow.mobile || normalizedRow.number || normalizedRow['phone number'] || normalizedRow['contact number'] || normalizedRow['mobile number'] || '0000000000';

    return {
       business_owner_id: ownerId,
       telecaller_id: telecallerId || null,
       name: String(name).trim(),
       phone: String(phone).trim().replace(/[^\d+]/g, '') // Keep digits and + only
    };
  };

  postAssignLeads = async (req: Request, res: Response) => {
    try {
      const ownerId = req.session.user!.id;
      const { telecaller_id } = req.body;

      if (!telecaller_id || telecaller_id.trim() === '') {
        return res.redirect('/owner?tab=upload&assign=error&msg=no_telecaller');
      }

      // Assign all unassigned (telecaller_id = null) leads belonging to this owner
      const result = await prisma.lead.updateMany({
        where: {
          business_owner_id: ownerId,
          telecaller_id: null
        },
        data: {
          telecaller_id: telecaller_id
        }
      });

      return res.redirect(`/owner?tab=upload&assign=success&count=${result.count}`);
    } catch (err) {
      console.error('Assign Error:', err);
      return res.redirect('/owner?tab=upload&assign=error');
    }
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
      const assignments = await prisma.telecallerAssignment.findMany({
        where: { telecaller_id: id },
        select: { business_owner_id: true }
      });

      res.json({ ids: assignments.map(a => a.business_owner_id) });
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

  updateTelecallerAssignments = async (req: Request, res: Response) => {
    try {
      const telecallerId = req.body.telecallerId as string;
      const businessOwnerIds = req.body.businessOwnerIds as string[];

      if (!telecallerId || !Array.isArray(businessOwnerIds)) {
        return res.status(400).json({ error: 'Telecaller ID and Business Owner IDs array are required.' });
      }

      // Sync assignments: Delete old and create new in a transaction
      await prisma.$transaction([
        prisma.telecallerAssignment.deleteMany({
          where: { telecaller_id: telecallerId }
        }),
        prisma.telecallerAssignment.createMany({
          data: businessOwnerIds.map(boId => ({
            telecaller_id: telecallerId,
            business_owner_id: boId
          }))
        })
      ]);

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating assignments:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };

}
