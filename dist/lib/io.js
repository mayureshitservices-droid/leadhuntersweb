let io = null;
export function setIo(instance) {
    io = instance;
}
export function getIo() {
    if (!io) {
        throw new Error('Socket.io not initialized yet');
    }
    return io;
}
