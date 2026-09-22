import express from 'express';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const app = express();
const dist = join(dirname(fileURLToPath(import.meta.url)), 'dist');

app.disable('x-powered-by');
app.use((_, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.get('/health', (_, response) => response.json({ ok: true }));
app.use(express.static(dist, {
  setHeaders(response, filePath) {
    if (filePath.endsWith('index.html')) response.setHeader('Cache-Control', 'no-cache');
    if (filePath.includes('/assets/')) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));
app.use((_, response) => response.status(404).send('Not found'));

const server = createServer(app);
const presence = new WebSocketServer({ server, path: '/presence', maxPayload: 128, perMessageDeflate: false });
const viewers = new Map();

function broadcastCount() {
  const count = new Set(viewers.values()).size;
  const message = JSON.stringify({ type: 'viewers', count });
  for (const socket of presence.clients) {
    if (socket.readyState === WebSocket.OPEN && viewers.has(socket)) socket.send(message);
  }
}

presence.on('connection', (socket) => {
  socket.isAlive = true;
  const joinTimeout = setTimeout(() => socket.close(1008, 'Join required'), 10000);

  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    if (message.type === 'join' && typeof message.viewerId === 'string'
      && /^[a-f0-9-]{36}$/.test(message.viewerId)) {
      clearTimeout(joinTimeout);
      viewers.set(socket, message.viewerId);
      broadcastCount();
    }
  });
  socket.on('close', () => {
    clearTimeout(joinTimeout);
    viewers.delete(socket);
    broadcastCount();
  });
  socket.on('error', () => {});
});

const heartbeat = setInterval(() => {
  for (const socket of presence.clients) {
    if (!socket.isAlive) socket.terminate();
    else {
      socket.isAlive = false;
      socket.ping();
    }
  }
}, 30000);
heartbeat.unref();

const port = Number(process.env.PORT) || 10000;
server.listen(port, '0.0.0.0', () => console.log(`Sintra Surf Watch listening on ${port}`));
