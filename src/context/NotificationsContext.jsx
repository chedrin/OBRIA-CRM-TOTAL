import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Package, Siren, X } from 'lucide-react';
import { useApp } from './AppContext';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import realtimeSync from '../services/realtimeSyncService';

// Centro de avisos del panel: carga los no leídos, escucha los nuevos por Supabase Realtime
// y muestra un aviso emergente con sonido. Solo para administradores.

export const CATEGORY_STYLE = {
  urgente: { label: 'Urgente', icon: Siren, chip: 'bg-rose-500/15 text-rose-400 border-rose-500/30', bar: 'border-l-rose-500' },
  incidencia: { label: 'Incidencia', icon: AlertTriangle, chip: 'bg-orange-500/15 text-orange-400 border-orange-500/30', bar: 'border-l-orange-500' },
  material: { label: 'Material', icon: Package, chip: 'bg-sky-500/15 text-sky-400 border-sky-500/30', bar: 'border-l-sky-500' },
  aviso: { label: 'Aviso', icon: Bell, chip: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', bar: 'border-l-emerald-500' }
};

const NotificationsContext = createContext(null);
export const useNotifications = () => useContext(NotificationsContext) || { items: [], unreadCount: 0, available: false };

// Enlaces de los avisos y de las notificaciones push: #admin/avisos o #admin/necesidades/<id>
function readHashTarget() {
  const match = (window.location.hash || '').match(/^#admin\/(avisos|necesidades|partes)(?:\/([0-9a-f-]{36}))?/i);
  return match ? { section: match[1].toLowerCase(), id: match[2] || null } : null;
}

export function NotificationsProvider({ children }) {
  const { currentUser, setActiveTab = () => {} } = useApp() || {};
  const isAdmin = currentUser?.role === 'admin';
  const [items, setItems] = useState([]);
  const [available, setAvailable] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [target, setTarget] = useState(null);
  const timers = useRef(new Map());

  const refresh = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        setAvailable(false);
        return;
      }
      setItems(await res.json());
      setAvailable(true);
    } catch {
      setAvailable(false);
    }
  }, [isAdmin]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const pushToast = useCallback((n) => {
    setToasts((prev) => [n, ...prev.filter((t) => t.id !== n.id)].slice(0, 4));
    const ms = n.category === 'urgente' ? 20000 : 8000;
    timers.current.set(n.id, setTimeout(() => dismissToast(n.id), ms));
    realtimeSync.playNotificationSound(n.category === 'urgente' ? 'task_assigned' : 'sync_complete');
  }, [dismissToast]);

  useEffect(() => {
    if (!isAdmin) {
      setItems([]);
      return undefined;
    }
    refresh();
    if (!isSupabaseConfigured) return undefined;

    const channel = supabase
      .channel('avisos-panel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, ({ new: row }) => {
        setItems((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
        pushToast(row);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, ({ new: row }) => {
        setItems((prev) => prev.map((n) => (n.id === row.id ? row : n)));
      })
      .subscribe();
    // Si se pierde la conexión un rato, al volver a la pestaña se recargan los avisos.
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [isAdmin, refresh, pushToast]);

  // Abrir la sección correcta al llegar desde un enlace o una notificación push.
  useEffect(() => {
    if (!isAdmin) return undefined;
    const apply = () => {
      const t = readHashTarget();
      if (!t) return;
      setTarget(t);
      setActiveTab('avisos');
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [isAdmin, setActiveTab]);

  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const markRead = useCallback(async (ids) => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, read_at: n.read_at || now } : n)));
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids === 'all' ? { all: true } : { ids })
    }).catch(() => undefined);
  }, []);

  const openNotification = useCallback((n) => {
    if (!n.read_at) markRead([n.id]);
    const section = n.ref_table === 'worksite_needs' ? 'necesidades' : n.ref_table === 'site_reports' ? 'partes' : 'avisos';
    setTarget({ section, id: n.ref_id || null });
    setActiveTab('avisos');
  }, [markRead, setActiveTab]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <NotificationsContext.Provider value={{ items, unreadCount, available, refresh, markRead, openNotification, target, setTarget }}>
      {children}
      {isAdmin && toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-[min(92vw,380px)]">
          {toasts.map((n) => {
            const style = CATEGORY_STYLE[n.category] || CATEGORY_STYLE.aviso;
            const Icon = style.icon;
            return (
              <div key={n.id} role="alert"
                className={`bg-slate-900 border border-slate-700 border-l-4 ${style.bar} rounded-2xl shadow-2xl p-3 flex gap-3 items-start animate-in fade-in slide-in-from-top-3 duration-300`}>
                <span className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${style.chip}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <button className="text-left min-w-0 flex-1" onClick={() => { dismissToast(n.id); openNotification(n); }}>
                  <span className="block text-sm font-bold text-white">{n.title}</span>
                  {n.body && <span className="block text-xs text-slate-400 line-clamp-2">{n.body}</span>}
                </button>
                <button onClick={() => dismissToast(n.id)} className="text-slate-500 hover:text-white" aria-label="Cerrar aviso">
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </NotificationsContext.Provider>
  );
}
