import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function App() {
    const [events, setEvents] = useState([]);
    const [status, setStatus] = useState('disconnected');
    const socketRef = useRef(null);

    useEffect(() => {
        // Connect with auto-reconnect
        const s = io('http://localhost:3001', {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        socketRef.current = s;

        // Handle backlog (sent once on connect)
        s.on('backlog', (items) => {
            console.log('Received backlog:', items.length, 'items');
            setEvents(items);
        });

        // Handle live notifications
        s.on('notification', (evt) => {
            console.log('New notification:', evt);
            setEvents(prev => {
                const updated = [...prev, evt];
                // Keep only last 50 events in UI
                return updated.slice(-50);
            });
        });

        // Connection status handlers
        s.on('connect', () => {
            console.log('Connected to server');
            setStatus('connected');
        });

        s.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
            setStatus('disconnected');
        });

        s.on('reconnect', (attemptNumber) => {
            console.log('Reconnected after', attemptNumber, 'attempts');
            setStatus('connected');
        });

        s.on('reconnect_attempt', (attemptNumber) => {
            console.log('Reconnecting... attempt', attemptNumber);
            setStatus('reconnecting');
        });

        return () => {
            s?.close();
        };
    }, []);

    return (
        <div style={{
            maxWidth: 700,
            margin: '40px auto',
            fontFamily: 'system-ui',
            paddingLeft: 20,
            paddingRight: 20
        }}>
            <h1 style={{ paddingLeft: 12 }}>🔔 Live Notifications</h1>
            <div style={{ marginBottom: 20, paddingLeft: 12 }}>
                Status: <span style={{
                color: status === 'connected' ? 'green' :
                    status === 'reconnecting' ? 'orange' : 'red',
                fontWeight: 'bold'
            }}>{status}</span>
            </div>

            {events.length === 0 ? (
                <div style={{
                    padding: 40,
                    textAlign: 'center',
                    color: '#666',
                    border: '1px dashed #ddd',
                    borderRadius: 8,
                    marginLeft: 12,
                    marginRight: 12
                }}>
                    No notifications yet. Waiting for events...
                </div>
            ) : (
                <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    paddingLeft: 12,
                    paddingRight: 12,
                    maxHeight: 600,
                    overflowY: 'auto'
                }}>
                    {events.map((e) => (
                        <li key={e.id} style={{
                            border: '1px solid #eee',
                            padding: 12,
                            paddingLeft: 16,
                            borderLeft: `6px solid ${pickColor(e.type)}`,
                            marginBottom: 8,
                            borderRadius: 4,
                            animation: 'slideIn 0.3s ease-out'
                        }}>
                            <div style={{ fontWeight: 600, color: pickColor(e.type) }}>
                                {e.type.toUpperCase()}
                            </div>
                            <div style={{ marginTop: 4 }}>{e.message}</div>
                            <div style={{
                                color: '#666',
                                fontSize: 12,
                                marginTop: 4
                            }}>
                                {new Date(e.timestamp).toLocaleTimeString()}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <style jsx>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `}</style>
        </div>
    );
}

function pickColor(type) {
    switch (type) {
        case 'success': return '#10b981';
        case 'warning': return '#f59e0b';
        case 'error': return '#ef4444';
        case 'info':
        default: return '#3b82f6';
    }
}