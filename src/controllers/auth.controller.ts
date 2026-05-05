import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export class AuthController {
  
  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user || !user.password_hash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
         return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (user.role !== 'TELECALLER') {
         return res.status(403).json({ error: 'Only telecallers can access the mobile app API.' });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        token,
        user: {
           id: user.id,
           name: user.name,
           email: user.email
        }
      });
    } catch (error) {
       console.error(error);
       res.status(500).json({ error: 'Internal server error' });
    }
  };

  deviceRegistration = async (req: Request, res: Response) => {
    try {
       const { device_id, name } = req.body;
       if (!device_id) {
          return res.status(400).json({ error: 'device_id is required' });
       }

       // Automatically upsert the telecaller device
       const user = await prisma.user.upsert({
          where: { device_id },
          update: {}, // No updates if it already exists
          create: {
             device_id,
             name: name || `Telecaller Device ${device_id.substring(0, 4)}`,
             role: 'TELECALLER'
          }
       });

       const token = jwt.sign(
         { id: user.id, role: user.role, name: user.name },
         JWT_SECRET,
         { expiresIn: '1y' } // Device tokens last a long time
       );

       res.json({
         token,
         user: {
            id: user.id,
            name: user.name,
            device_id: user.device_id
         }
       });

    } catch (error) {
       console.error("Device Registration Error:", error);
       res.status(500).json({ error: 'Internal server error during registration.' });
    }
  };

}
