import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api, SessionRecord, Bot } from '../lib/api';

export type NotifType = 'session_completed' | 'bot_created';

export interface AppNotification {
    id: string;
    type: NotifType;
    title: string;
    body: string;
    timestamp: number; // ms
    read: boolean;
    refId: string;   // sessionId or botId
    refName: string; // botName or bot name
}

interface NotificationCtx {
    notifications: AppNotification[];
    unreadCount: number;
    markAllRead: () => void;
    dismiss: (id: string) => void;
    clearAll: () => void;
}

const NotificationContext = createContext<NotificationCtx>({
    notifications: [],
    unreadCount: 0,
    markAllRead: () => { },
    dismiss: () => { },
    clearAll: () => { },
});

const POLL_MS = 20_000; // 20 seconds

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<AppNotification[]>([]);

    // Track known sessions: id → ended_at
    const knownSessions = useRef<Map<string, number | null>>(new Map());
    // Track known bots: Set of ids
    const knownBots = useRef<Set<string>>(new Set());
    const initialised = useRef(false);

    const addNotif = useCallback((n: Omit<AppNotification, 'id' | 'read'>) => {
        const notif: AppNotification = { ...n, id: `${n.refId}-${n.type}`, read: false };
        setNotifications(prev => {
            if (prev.some(p => p.id === notif.id)) return prev;
            return [notif, ...prev].slice(0, 60);
        });
    }, []);

    const poll = useCallback(async () => {
        try {
            const [sessions, bots]: [SessionRecord[], Bot[]] = await Promise.all([
                api.getSessions(100),
                api.getBots(),
            ]);

            if (!initialised.current) {
                // First load: seed silently — no notifications for historical data
                sessions.forEach(s => knownSessions.current.set(s.id, s.ended_at));
                bots.forEach(b => knownBots.current.add(b.id));
                initialised.current = true;
                return;
            }

            // ── Session events ─────────────────────────────────────────────
            sessions.forEach(s => {
                const prev = knownSessions.current.get(s.id);

                // Only notify when a session transitions active → completed
                if (prev === null && s.ended_at !== null) {
                    addNotif({
                        type: 'session_completed',
                        title: 'Session Completed',
                        body: `${s.bot_name} finished a conversation (${s.turn_count} turns).`,
                        timestamp: Date.now(),
                        refId: s.id,
                        refName: s.bot_name,
                    });
                }

                knownSessions.current.set(s.id, s.ended_at);
            });

            // ── Bot creation events ────────────────────────────────────────
            bots.forEach(b => {
                if (!knownBots.current.has(b.id)) {
                    addNotif({
                        type: 'bot_created',
                        title: 'New Agent Deployed',
                        body: `${b.name} has been created and is ready to go live.`,
                        timestamp: Date.now(),
                        refId: b.id,
                        refName: b.name,
                    });
                    knownBots.current.add(b.id);
                }
            });

        } catch {
            // silently ignore poll errors
        }
    }, [addNotif]);

    useEffect(() => {
        poll();
        const interval = setInterval(poll, POLL_MS);
        return () => clearInterval(interval);
    }, [poll]);

    const markAllRead = useCallback(() =>
        setNotifications(prev => prev.map(n => ({ ...n, read: true }))), []);

    const dismiss = useCallback((id: string) =>
        setNotifications(prev => prev.filter(n => n.id !== id)), []);

    const clearAll = useCallback(() => setNotifications([]), []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, dismiss, clearAll }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    return useContext(NotificationContext);
}
