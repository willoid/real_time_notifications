import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: { origin: 'http://localhost:5173' }
});

// Redis setup
const redisSub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// In-memory backlog (keep last 20). In real systems, use durable storage.
const BACKLOG_LIMIT = 20;
let backlog = [];

function addToBacklog(evt) {
    backlog.push(evt);
    if (backlog.length > BACKLOG_LIMIT) backlog.shift();
}

// Subscribe to a notification channel
const CHANNEL = 'notifications';
await redisSub.subscribe(CHANNEL);
redisSub.on('message', (channel, message) => {
    try {
        const evt = JSON.parse(message);
        addToBacklog(evt);
        io.emit('notification', evt);
    } catch (e) {
        console.error('Bad message', e);
    }
});

io.on('connection', (socket) => {
    console.log('client connected', socket.id);

    // Send backlog to new client
    if (backlog.length > 0) {
        socket.emit('backlog', backlog);
    }

    socket.on('disconnect', () => {
        console.log('client disconnected', socket.id);
    });
});

// Minimal HTTP endpoints for testing and health
app.get('/health', (req, res) => res.json({ ok: true }));

// Broadcast helper: POST /notify { type, message }
app.post('/notify', async (req, res) => {
    const { type, message } = req.body;

    // Validate input
    if (!type || !message) {
        return res.status(400).json({ error: 'Missing type or message' });
    }

    const validTypes = ['info', 'success', 'warning', 'error'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be: info, success, warning, or error' });
    }

    const evt = {
        id: Date.now().toString(),
        type,
        message,
        timestamp: new Date().toISOString()
    };

    try {
        await redisPub.publish(CHANNEL, JSON.stringify(evt));
        res.status(202).json({ accepted: true, event: evt });
    } catch (error) {
        console.error('Failed to publish notification:', error);
        res.status(500).json({ error: 'Failed to publish notification' });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log('Server on', PORT);
});