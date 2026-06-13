// Strip wrapping quotes from all env vars (Docker env_file passes them literally)
for (const key of Object.keys(process.env)) {
  const val = process.env[key];
  if (val) {
    process.env[key] = val.replace(/^"(.*)"$/, '$1').trim();
  }
}

import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import 'dotenv/config';
import { prisma } from './config/db.js';
import './cron.js';
import { setIo } from './lib/io.js';
import { env } from './lib/env.js';

const PORT = env('PORT') || '3000';

const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: env('CORS_ORIGIN') || '*',
  }
});
setIo(io);

async function notifyOwner(telecallerId: string, isOnline: boolean) {
  try {
    const telecaller = await prisma.user.findUnique({
      where: { id: telecallerId },
      select: { owner_id: true }
    });

    if (telecaller?.owner_id) {
      io.to(`dashboard_${telecaller.owner_id}`).emit('presence_update', {
        telecallerId,
        isOnline,
        lastSeen: new Date()
      });
    }
  } catch (error) {
    console.error('Error notifying owner of presence update:', error);
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
      await notifyOwner(telecallerId, true);
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
        await notifyOwner(telecallerId, false);
      } catch (err) {
        console.error('Error on presence disconnect:', err);
      }
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. The server may already be running.`);
    process.exit(1);
  }
  console.error('Server error:', err);
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
