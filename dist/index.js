import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import 'dotenv/config';
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
export const io = new Server(server, {
    cors: {
        origin: '*', // For development
    }
});
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    // Business Owners can join their own room to listen to dispatch events
    socket.on('join_dashboard', (businessOwnerId) => {
        socket.join(`dashboard_${businessOwnerId}`);
        console.log(`Socket ${socket.id} joined dashboard_${businessOwnerId}`);
    });
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
