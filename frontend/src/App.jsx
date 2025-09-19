import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export default function App() {
    const [notifications, setNotifications] = useState([]);
    const [flags, setFlags] = useState({});
    const [status, setStatus] = useState('disconnected');
    const [activeTab, setActiveTab] = useState('notifications');
    const socketRef = useRef(null);

    useEffect(() => {
        const s = io('http://localhost:3001', {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });
        socketRef.current = s;

        // Notifications handlers
        s.on('notifications:backlog', (items) => {
            console.log('Received backlog:', items.length, 'items');
            setNotifications(items);
        });

        s.on('notification', (evt) => {
            console.log('New notification:', evt);
            setNotifications(prev => {
                const updated = [...prev, evt];
                return updated.slice(-50);
            });
        });

        // Feature flags handlers
        s.on('flags:init', (flagsData) => {
            console.log('Initial flags:', flagsData);
            setFlags(flagsData);
        });

        s.on('flags:update', (evt) => {
            console.log('Flag updated:', evt);
            setFlags(prev => ({
                ...prev,
                [evt.key]: evt.value
            }));
        });

        // Connection handlers
        s.on('connect', () => setStatus('connected'));
        s.on('disconnect', () => setStatus('disconnected'));
        s.on('reconnecting', () => setStatus('reconnecting'));

        return () => {
            s?.close();
        };
    }, []);

    const toggleFlag = async (key) => {
        try {
            const response = await fetch('http://localhost:3001/flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value: !flags[key] })
            });

            if (!response.ok) {
                throw new Error('Failed to update flag');
            }
        } catch (error) {
            console.error('Error toggling flag:', error);
        }
    };

    return (
        <div style={{
            maxWidth: 900,
            margin: '40px auto',
            fontFamily: 'system-ui',
            padding: '0 20px'
        }}>
            <h1>🎛️ Real-Time Control Panel</h1>

            <div style={{ marginBottom: 20 }}>
                Status: <span style={{
                color: status === 'connected' ? 'green' :
                    status === 'reconnecting' ? 'orange' : 'red',
                fontWeight: 'bold'
            }}>{status}</span>
            </div>

            {/* Tab Navigation */}
            <div style={{
                borderBottom: '2px solid #eee',
                marginBottom: 20,
                display: 'flex',
                gap: 20
            }}>
                <button
                    onClick={() => setActiveTab('notifications')}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '10px 0',
                        fontSize: 16,
                        fontWeight: activeTab === 'notifications' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'notifications' ? '2px solid #3b82f6' : 'none',
                        cursor: 'pointer'
                    }}
                >
                    🔔 Notifications ({notifications.length})
                </button>

                <button
                    onClick={() => setActiveTab('flags')}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: '10px 0',
                        fontSize: 16,
                        fontWeight: activeTab === 'flags' ? 'bold' : 'normal',
                        borderBottom: activeTab === 'flags' ? '2px solid #8b5cf6' : 'none',
                        cursor: 'pointer'
                    }}
                >
                    🚩 Feature Flags ({Object.keys(flags).length})
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'notifications' ? (
                <div>
                    {notifications.length === 0 ? (
                        <div style={{
                            padding: 40,
                            textAlign: 'center',
                            color: '#666',
                            border: '1px dashed #ddd',
                            borderRadius: 8
                        }}>
                            No notifications yet. Waiting for events...
                        </div>
                    ) : (
                        <ul style={{
                            listStyle: 'none',
                            padding: 0,
                            maxHeight: 600,
                            overflowY: 'auto'
                        }}>
                            {notifications.slice(-50).reverse().map((e) => (
                                <li key={e.id} style={{
                                    border: '1px solid #eee',
                                    padding: 12,
                                    paddingLeft: 16,
                                    borderLeft: `6px solid ${pickColor(e.type)}`,
                                    marginBottom: 8,
                                    borderRadius: 4
                                }}>
                                    <div style={{
                                        fontWeight: 600,
                                        color: pickColor(e.type),
                                        display: 'flex',
                                        justifyContent: 'space-between'
                                    }}>
                                        {e.type.toUpperCase()}
                                        {e.source && (
                                            <span style={{
                                                fontSize: 12,
                                                fontWeight: 'normal',
                                                color: '#666'
                                            }}>
                                                via {e.source}
                                            </span>
                                        )}
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
                </div>
            ) : (
                <div>
                    {Object.keys(flags).length === 0 ? (
                        <div style={{
                            padding: 40,
                            textAlign: 'center',
                            color: '#666',
                            border: '1px dashed #ddd',
                            borderRadius: 8
                        }}>
                            No feature flags configured yet.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {Object.entries(flags).map(([key, enabled]) => (
                                <div key={key} style={{
                                    border: enabled ? '1px solid #7c3aed' : '1px solid #4b5563',
                                    padding: 20,
                                    borderRadius: 10,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    background: enabled
                                        ? 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)'
                                        : 'linear-gradient(135deg, #374151 0%, #4b5563 100%)',
                                    boxShadow: enabled
                                        ? '0 4px 15px rgba(124, 58, 237, 0.3)'
                                        : '0 2px 10px rgba(0, 0, 0, 0.1)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div>
                                        <div style={{
                                            fontWeight: 600,
                                            fontSize: 18,
                                            marginBottom: 6,
                                            color: '#ffffff',
                                            letterSpacing: '0.5px'
                                        }}>
                                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </div>
                                        <div style={{
                                            fontSize: 14,
                                            color: enabled ? '#e9d5ff' : '#d1d5db',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6
                                        }}>
                                            <span style={{ fontSize: 18 }}>
                                                {enabled ? '✓' : '✗'}
                                            </span>
                                            {enabled ? 'Enabled' : 'Disabled'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleFlag(key)}
                                        style={{
                                            padding: '10px 20px',
                                            borderRadius: 8,
                                            border: '2px solid rgba(255, 255, 255, 0.3)',
                                            background: enabled
                                                ? 'rgba(255, 255, 255, 0.2)'
                                                : 'rgba(255, 255, 255, 0.1)',
                                            backdropFilter: 'blur(10px)',
                                            color: '#ffffff',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: 14,
                                            transition: 'all 0.2s ease',
                                            letterSpacing: '0.5px'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                                            e.target.style.transform = 'translateY(-1px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.target.style.background = enabled
                                                ? 'rgba(255, 255, 255, 0.2)'
                                                : 'rgba(255, 255, 255, 0.1)';
                                            e.target.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        {enabled ? 'DISABLE' : 'ENABLE'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
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