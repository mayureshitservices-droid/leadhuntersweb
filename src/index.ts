import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import 'dotenv/config';
import { prisma } from './config/db.js';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: '*', // For development
  }
});

async function notifyOwners(telecallerId: string, isOnline: boolean) {
  try {
    const assignments = await prisma.telecallerAssignment.findMany({
      where: { telecaller_id: telecallerId },
      select: { business_owner_id: true }
    });

    assignments.forEach(a => {
      io.to(`dashboard_${a.business_owner_id}`).emit('presence_update', {
        telecallerId,
        isOnline,
        lastSeen: new Date()
      });
    });
  } catch (error) {
    console.error('Error notifying owners of presence update:', error);
  }
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Business Owners can join their own room to listen to dispatch events
  socket.on('join_dashboard', (businessOwnerId) => {
    socket.join(`dashboard_${businessOwnerId}`);
    console.log(`Socket ${socket.id} joined dashboard_${businessOwnerId}`);
  });

  // Telecaller Presence
  socket.on('register_presence', async (telecallerId) => {
    try {
      socket.data.telecallerId = telecallerId;
      await prisma.user.update({
        where: { id: telecallerId },
        data: { last_seen: new Date() }
      });
      await notifyOwners(telecallerId, true);
    } catch (err) {
      console.error('Error registering presence:', err);
    }
  });

  socket.on('disconnect', async () => {
    const telecallerId = socket.data.telecallerId;
    if (telecallerId) {
      try {
        await prisma.user.update({
          where: { id: telecallerId },
          data: { last_seen: new Date() }
        });
        await notifyOwners(telecallerId, false);
      } catch (err) {
        console.error('Error on presence disconnect:', err);
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
