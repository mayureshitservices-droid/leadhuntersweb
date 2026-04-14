import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../config/db.js';
import fs from 'fs';
import csv from 'csv-parser';

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
     if (!req.session.user || req.session.user.role !== 'SUPER_ADMIN') {
        return res.redirect('/login');
     }
     
     // Fetch needed data for Admin
     const businessOwners = await prisma.user.findMany({ where: { role: 'BUSINESS_OWNER' } });
     const telecallers = await prisma.user.findMany({ where: { role: 'TELECALLER' } });

     res.render('admin_dashboard', {
        user: req.session.user,
        businessOwners,
        telecallers
     });
  };

  getOwnerDashboard = async (req: Request, res: Response) => {
     if (!req.session.user || req.session.user.role !== 'BUSINESS_OWNER') {
        return res.redirect('/login');
     }

     const ownerId = req.session.user.id;
     
     const stats = {
        total: await prisma.lead.count({ where: { business_owner_id: ownerId } }),
        pending: await prisma.lead.count({ where: { business_owner_id: ownerId, status: 'PENDING' } }),
        answered: await prisma.lead.count({ where: { business_owner_id: ownerId, status: 'ANSWERED' } })
     };

     // Note: In real world, we pass messages via session flashing. Using simplest pattern for now.
     const uploadMsg = req.query.upload === 'success' ? 'Leads uploaded successfully!' : null;

     res.render('owner_dashboard', {
        user: req.session.user,
        stats,
        uploadMsg
     });
  };

  postUploadLeads = async (req: Request, res: Response) => {
    if (!req.session.user || req.session.user.role !== 'BUSINESS_OWNER') {
      return res.status(403).send('Forbidden');
    }
    
    if (!req.file) {
      return res.redirect('/owner?upload=error');
    }

    const results: any[] = [];
    const ownerId = req.session.user.id;

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          const leadsToInsert = results.map(row => ({
            business_owner_id: ownerId,
            name: row.name || row.Name || 'Unknown',
            phone: row.phone || row.Phone || '0000000000'
          }));

          if (leadsToInsert.length > 0) {
            await prisma.lead.createMany({
              data: leadsToInsert,
              skipDuplicates: true
            });
          }
          
          fs.unlinkSync(req.file!.path);
          res.redirect('/owner?upload=success');
        } catch (err) {
          console.error(err);
          res.redirect('/owner?upload=error');
        }
      });
  };

  updateDeviceAlias = async (req: Request, res: Response) => {
    try {
      if (!req.session.user || req.session.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

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
      if (!req.session.user || req.session.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

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
      if (!req.session.user || req.session.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

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
      if (!req.session.user || req.session.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

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
      if (!req.session.user || req.session.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

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

}
