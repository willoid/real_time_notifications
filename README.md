# Real-Time Notification System

A minimal, production-ready real-time notification system built with Node.js, Redis, Socket.IO, and React.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Redis (local or Docker)
- npm or yarn

### Setup

1. **Clone the Repository**
```bash
git clone https://github.com/willoid/real_time_notifications.git
cd real_time_notifications
```

2. **Start Redis**
```bash
# Using Docker (recommended)
docker run -d -p 6379:6379 redis:alpine

# Or install locally
brew install redis  # macOS
sudo apt-get install redis-server  # Ubuntu
```

3. **Install Dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

4. **Start the Services**
```bash
# Terminal 1: Backend server
cd backend
npm run dev  # Runs on http://localhost:3001

# Terminal 2: Frontend app
cd frontend
npm run dev  # Runs on http://localhost:5173
```

5. **Test Notifications**
```bash
# Send test notifications via REST API
curl -X POST http://localhost:3001/notify \
  -H "Content-Type: application/json" \
  -d '{"type":"info","message":"System is operational"}'

# Available types: info, success, warning, error
```

## 📐 Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │◄────────│   Node.js    │◄────────│    Redis    │
│   (React)   │ Socket  │   Server     │ Pub/Sub │   Broker    │
└─────────────┘         └──────────────┘         └─────────────┘
       ▲                        │
       │                        │
       └────────────────────────┘
         WebSocket Connection
```

### Component Responsibilities

- **React Client**: Real-time UI updates, connection management, backlog display
- **Node.js Server**: WebSocket connections, Redis pub/sub, backlog management, REST API
- **Redis**: Message broker for horizontal scaling, pub/sub fanout

## 🎯 Design Decisions

### 1. **WebSocket Transport (Socket.IO)**
- **Why**: Built-in reconnection logic, fallback transports, room support for future features
- **Trade-off**: Slightly heavier than raw WebSockets, but production-ready features out of the box
- **Config**: Exponential backoff for reconnection (1s → 5s max)

### 2. **Redis Pub/Sub for Message Distribution**
- **Why**: Enables horizontal scaling - multiple server instances can publish/subscribe to same channel
- **Pattern**: Fan-out messaging - one publisher, many subscribers
- **Channel**: Single `notifications` channel for simplicity

### 3. **In-Memory Backlog**
- **Why**: Simple implementation for MVP, fast retrieval
- **Limit**: 20 messages server-side, 50 messages client-side
- **Trade-off**: Lost on server restart (production would use Redis/DB persistence)
- **Behavior**: New clients immediately receive backlog on connection

### 4. **Event Structure**
```javascript
{
  id: "1234567890123",        // Timestamp-based unique ID
  type: "info|success|warning|error",
  message: "Event description",
  timestamp: "2024-01-01T12:00:00.000Z"
}
```

### 5. **Connection States**
- **Connected**: Active WebSocket connection
- **Disconnected**: No connection (network issue, server down)
- **Reconnecting**: Attempting to reconnect with backoff

### 6. **UI/UX Decisions**
- **Newest First**: Latest notifications appear at top for immediate visibility
- **Visual Feedback**: Color-coded notification types, connection status indicator
- **Animations**: Subtle slide-in effect for new notifications
- **Scroll Management**: Fixed height with scroll for long lists
- **Memory Limit**: Max 50 events in DOM to prevent performance issues

## 🔧 API Reference

### REST Endpoints

#### `POST /notify`
Publish a notification to all connected clients.

**Request:**
```json
{
  "type": "info|success|warning|error",
  "message": "Your notification message"
}
```

**Response (202 Accepted):**
```json
{
  "accepted": true,
  "event": {
    "id": "1234567890123",
    "type": "info",
    "message": "Your notification message",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{ "ok": true }
```

### WebSocket Events

#### Client → Server
- `connection`: Automatic on connect

#### Server → Client
- `backlog`: Array of recent events (sent once on connection)
- `notification`: Single new event (broadcast to all clients)
- `connect`: Connection established
- `disconnect`: Connection lost
- `reconnect`: Successfully reconnected
- `reconnect_attempt`: Reconnection in progress

## 🔐 Security Considerations

### Current Implementation (MVP)
- CORS configured for localhost development
- Basic input validation on notification type/message
- No authentication/authorization

## 🚦 Monitoring & Observability

### Key Metrics to Track
- Active WebSocket connections count
- Message throughput (messages/sec)
- Backlog size
- Redis pub/sub latency
- Client reconnection frequency
- Message delivery success rate

### Logging
Current implementation logs:
- Client connections/disconnections
- Reconnection attempts
- Message parsing errors
- Redis publish failures


## 📝 Development Notes

### Why This Architecture?

1. **Simplicity First**: Minimal dependencies, clear separation of concerns
2. **Production Patterns**: Implements real patterns used in production systems
3. **Resilience Built-in**: Automatic reconnection, graceful degradation
4. **Observable**: Clear logging and status indicators
5. **Scalable Foundation**: Redis pub/sub ready for multi-instance deployment

### Trade-offs Made

| Decision | Pro | Con |
|----------|-----|-----|
| In-memory backlog | Fast, simple | Lost on restart |
| Socket.IO | Feature-rich | Larger bundle size |
| Single Redis channel | Simple | No topic filtering |
| No authentication | Quick setup | Not production-ready |
| Client-side limit (50) | Performance | May lose old messages |



## 📚 References

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Redis Pub/Sub](https://redis.io/docs/manual/pubsub/)
- [WebSocket Protocol RFC](https://datatracker.ietf.org/doc/html/rfc6455)
- [The Log: What every software engineer should know about real-time data's unifying abstraction](https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying)

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

Built with 💜 by Willy Calvo - focusing on correctness, resilience, and clean architecture.