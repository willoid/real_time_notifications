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

// Redis connections
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379'); // storage
const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');   // subscriber
const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');   // publisher

// Channels
const NOTIFICATIONS_CHANNEL = 'notifications';
const FLAGS_CHANNEL = 'flags:updates';

// Prefixes
const FLAG_KEY_PREFIX = 'flag:';

// ==================== NOTIFICATIONS ====================
// In-memory backlog for notifications
const BACKLOG_LIMIT = 20;
let notificationBacklog = [];

function addToBacklog(evt) {
    notificationBacklog.push(evt);
    if (notificationBacklog.length > BACKLOG_LIMIT) {
        notificationBacklog.shift();
    }
}

// ==================== FEATURE FLAGS ====================
const flagKey = (k) => `${FLAG_KEY_PREFIX}${k}`;

async function listFlags() {
    const flags = {};
    let cursor = '0';
    do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', `${FLAG_KEY_PREFIX}*`, 'COUNT', 100);
        cursor = next;
        if (keys.length) {
            const values = await redis.mget(keys);
            keys.forEach((k, i) => {
                const short = k.replace(FLAG_KEY_PREFIX, '');
                flags[short] = values[i] === 'true';
            });
        }
    } while (cursor !== '0');
    return flags;
}

async function setFlag(key, value) {
    const oldValue = await redis.get(flagKey(key));
    await redis.set(flagKey(key), value ? 'true' : 'false');

    const event = {
        key,
        value: !!value,
        oldValue: oldValue === 'true',
        ts: Date.now()
    };

    // Publish flag update
    await pub.publish(FLAGS_CHANNEL, JSON.stringify(event));

    // Also send a notification about the flag change
    const notification = {
        id: Date.now().toString(),
        type: value ? 'success' : 'warning',
        message: `Feature flag "${key}" has been ${value ? 'enabled' : 'disabled'}`,
        timestamp: new Date().toISOString(),
        source: 'flags'
    };
    await pub.publish(NOTIFICATIONS_CHANNEL, JSON.stringify(notification));

    return event;
}

// ==================== REST API ====================
app.get('/health', (req, res) => res.json({ ok: true }));

// Notifications API
app.post('/notify', async (req, res) => {
    const { type, message } = req.body;

    if (!type || !message) {
        return res.status(400).json({ error: 'Missing type or message' });
    }

    const validTypes = ['info', 'success', 'warning', 'error'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({
            error: 'Invalid type. Must be: info, success, warning, or error'
        });
    }

    const evt = {
        id: Date.now().toString(),
        type,
        message,
        timestamp: new Date().toISOString(),
        source: 'api'
    };

    try {
        await pub.publish(NOTIFICATIONS_CHANNEL, JSON.stringify(evt));
        res.status(202).json({ accepted: true, event: evt });
    } catch (error) {
        console.error('Failed to publish notification:', error);
        res.status(500).json({ error: 'Failed to publish notification' });
    }
});

// Feature Flags API
app.get('/flags', async (req, res) => {
    const data = await listFlags();
    res.json(data);
});

app.post('/flags', async (req, res) => {
    const { key, value } = req.body || {};

    // Validate key
    if (!key || typeof key !== 'string' || !/^[a-z0-9_.-]+$/i.test(key)) {
        return res.status(400).json({ error: 'Invalid key. Must match [a-z0-9_.-]+' });
    }

    // Coerce value to boolean
    const bool = value === true || value === 'true' || value === 1 || value === '1';

    try {
        const event = await setFlag(key, bool);
        res.status(202).json({ updated: true, event });
    } catch (error) {
        console.error('Failed to update flag:', error);
        res.status(500).json({ error: 'Failed to update flag' });
    }
});

// Combined status endpoint
app.get('/status', async (req, res) => {
    const flags = await listFlags();
    res.json({
        notifications: {
            backlogSize: notificationBacklog.length,
            connectedClients: io.sockets.sockets.size
        },
        flags: {
            count: Object.keys(flags).length,
            values: flags
        }
    });
});

// ==================== SOCKET.IO ====================
io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    // Send notification backlog
    if (notificationBacklog.length > 0) {
        socket.emit('notifications:backlog', notificationBacklog);
    }

    // Send current flags
    const flags = await listFlags();
    socket.emit('flags:init', flags);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// ==================== REDIS SUBSCRIPTIONS ====================
// Subscribe to both channels
await sub.subscribe(NOTIFICATIONS_CHANNEL, FLAGS_CHANNEL);

sub.on('message', (channel, message) => {
    try {
        const evt = JSON.parse(message);

        switch(channel) {
            case NOTIFICATIONS_CHANNEL:
                addToBacklog(evt);
                io.emit('notification', evt);
                break;

            case FLAGS_CHANNEL:
                io.emit('flags:update', evt);
                break;
        }
    } catch (e) {
        console.error(`Bad message on ${channel}:`, e);
    }
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
    console.log(`📢 Notifications: http://localhost:${PORT}/notify`);
    console.log(`🚩 Feature Flags: http://localhost:${PORT}/flags`);
});