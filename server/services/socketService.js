// RESQ Realtime WebSocket Streaming and Room Management Service
import { Server } from "socket.io";

let io = null;

// Initializes Socket.IO on the HTTP server instance
export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  io.on("connection", (socket) => {
    console.log(`Socket client connected: ${socket.id}`);

    // Join a specific session tracking room
    socket.on("join:session", ({ sessionId }) => {
      if (sessionId) {
        const room = `resq:session:${sessionId}`;
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
      }
    });

    // Leave a specific session tracking room
    socket.on("leave:session", ({ sessionId }) => {
      if (sessionId) {
        const room = `resq:session:${sessionId}`;
        socket.leave(room);
        console.log(`Socket ${socket.id} left room ${room}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Broadcasts real-time telemetry updates to session viewers
export function broadcastSessionUpdate(sessionId, payload = {}) {
  if (!io || !sessionId) return;
  const room = `resq:session:${sessionId}`;
  io.to(room).emit("resq:session:update", {
    sessionId,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

// Broadcasts high-priority hazard and risk escalation alerts
export function broadcastRiskAlert(sessionId, alertPayload = {}) {
  if (!io || !sessionId) return;
  const room = `resq:session:${sessionId}`;
  io.to(room).emit("resq:risk:alert", {
    sessionId,
    timestamp: new Date().toISOString(),
    ...alertPayload,
  });
}

// Broadcasts critical SOS emergency status
export function broadcastSosAlert(sessionId, sosPayload = {}) {
  if (!io || !sessionId) return;
  const room = `resq:session:${sessionId}`;
  io.to(room).emit("resq:sos:alert", {
    sessionId,
    timestamp: new Date().toISOString(),
    ...sosPayload,
  });
}

export default {
  initSocketServer,
  broadcastSessionUpdate,
  broadcastRiskAlert,
  broadcastSosAlert,
};
