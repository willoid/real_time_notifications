import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function App() {
    const [events, setEvents] = useState([]);
    const [status, setStatus] = useState('disconnected');
    const socketRef = useRef(null);

    useEffect(() => {
        // TODO: connect with auto-reconnect
        // const s = io('http://localhost:3001', { autoConnect: true, reconnection: true });
        // socketRef.current = s;

        // TODO: handle backlog and live notifications
        // s.on('backlog', (items) => setEvents(items));
        // s.on('notification', (evt) => setEvents(prev => [...prev, evt]));

        // s.on('connect', () => setStatus('connected'));
        // s.on('disconnect', () => setStatus('disconnected'));

        return () => {
            // s?.close();
        };
    }, []);

    return (
        <div style= maxWidth: 700, margin: '40px auto', fontFamily: 'system-ui' >
    <h1>🔔 Live Notifications</h1>
    <div style= marginBottom: 12 >
    Status: <span style= color: status === 'connected' ? 'green' : 'red' >{status}</span>
</div>

    {/* TODO: simple list UI with newest at bottom, clamp to last 50 */}
    <ul style= listStyle: 'none', padding: 0 >
    {events.slice(-50).map((e) => (
            <li key={e.id} style={{ border: '1px solid #eee', padding: 12, borderLeft: `6px solid ${pickColor(e.type)}`, marginBottom: 8 }}>
                <div style= fontWeight: 600 >{e.type}</div>
    <div>{e.message}</div>
    <div style= color: '#666', fontSize: 12 >{new Date(e.timestamp).toLocaleTimeString()}</div>
</li>
))}
</ul>
</div>
);
}

function pickColor(type) {
    switch (type) {
        case 'success': return '#10b981';
        case 'warning': return '#f59e0b';
        case 'error': return '#ef4444';
        default: return '#3b82f6';
    }
}