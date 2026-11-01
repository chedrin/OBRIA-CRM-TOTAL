import React, { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, BellRing, CheckCheck, Package, Users, Link2, ClipboardCheck, Inbox, Truck, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import useNotify from './useNotify';
import { useNotifications, CATEGORY_STYLE } from '../../context/NotificationsContext';
import { getPushStatus, enablePush, disablePush } from '../../services/pushService';
import { fmtDateTime, inputCls, btnGhost, btnPrimary } from '../../services/avisosApi';
import NecesidadesPanel from './NecesidadesPanel';
import ProveedoresPanel from './ProveedoresPanel';
import EnlacesPanel from './EnlacesPanel';
import PartesPanel from './PartesPanel';
import PedidosPanel from './PedidosPanel';
import NuevoPedidoModal from './NuevoPedidoModal';

const TABS = [
  { id: 'avisos', label: 'Avisos', icon: Inbox },
  { id: 'necesidades', label: 'Necesidades y pedidos', icon: Package },
  { id: 'pedidos', label: 'Pedidos a proveedores', icon: Truck },
  { id: 'partes', label: 'Partes de subcontratas', icon: ClipboardCheck },
  { id: 'enlaces', label: 'Enlaces a subcontratas', icon: Link2 },
  { id: 'proveedores', label: 'Proveedores', icon: Users }
];

function PushToggle() {
  const showNotification = useNotify();
  const [status, setStatus] = useState('inactivo');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('no_disponible'));
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (status === 'activo') {
        await disablePush();
        showNotification('Notificaciones desactivadas en este dispositivo');
      } else {
        await enablePush();
        showNotification('Notificaciones activadas en este dispositivo');
      }
      setStatus(await getPushStatus());
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'no_disponible') {
    return <span className="text-xs text-slate-500">Este navegador no admite notificaciones push (en iPhone, instala la app).</span>;
  }
  if (status === 'bloqueado') {
    return <span className="text-xs text-rose-400">Notificaciones bloqueadas: actívalas en los ajustes del navegador.</span>;
  }
  return (
    <button onClick={toggle} disabled={busy} className={btnGhost}>
      {status === 'activo' ? <BellOff className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
      {status === 'activo' ? 'Desactivar avisos en este dispositivo' : 'Activar avisos en este dispositivo'}
    </button>
  );
}

function AvisosList({ onOpen }) {
  const { obras = [] } = useApp() || {};
  const { items, markRead, unreadCount, available } = useNotifications();
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [obra, setObra] = useState('');
  const [category, setCategory] = useState('');

  const filtered = useMemo(() => items.filter((n) =>
    (!onlyUnread || !n.read_at) && (!obra || n.obra_id === obra) && (!category || n.category === category)
  ), [items, onlyUnread, obra, category]);

  if (!available) {
    return (
      <p className="text-sm text-slate-400">
        No se pueden cargar los avisos. Comprueba que se ha ejecutado <code>supabase_schema_notificaciones.sql</code> en Supabase y que el servidor tiene las variables de Supabase.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={() => setOnlyUnread(true)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${onlyUnread ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>
          No leídas ({unreadCount})
        </button>
        <button onClick={() => setOnlyUnread(false)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${!onlyUnread ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>
          Todas
        </button>
        <span className="w-px h-6 bg-slate-700 mx-1" />
        {Object.entries(CATEGORY_STYLE).map(([key, s]) => (
          <button key={key} onClick={() => setCategory(category === key ? '' : key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${category === key ? s.chip : 'border-slate-700 text-slate-400'}`}>
            {s.label}
          </button>
        ))}
        <select value={obra} onChange={(e) => setObra(e.target.value)} className={`${inputCls} !w-auto !py-1.5 text-xs`}>
          <option value="">Todas las obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{[o.codigo, o.titulo].filter(Boolean).join(' - ')}</option>)}
        </select>
        {unreadCount > 0 && (
          <button onClick={() => markRead('all')} className={`${btnGhost} ml-auto !py-1.5 text-xs`}>
            <CheckCheck className="w-4 h-4" /> Marcar todas como leídas
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{onlyUnread ? 'No tienes avisos sin leer.' : 'Todavía no hay avisos.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const s = CATEGORY_STYLE[n.category] || CATEGORY_STYLE.aviso;
            const Icon = s.icon;
            return (
              <li key={n.id}>
                <button onClick={() => onOpen(n)}
                  className={`w-full text-left bg-slate-900 border border-slate-800 border-l-4 ${s.bar} rounded-2xl p-3 flex gap-3 items-start hover:bg-slate-800/60 transition ${n.read_at ? 'opacity-70' : ''}`}>
                  <span className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${s.chip}`}><Icon className="w-4 h-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      {!n.read_at && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                      <span className="text-sm font-bold text-white truncate">{n.title}</span>
                    </span>
                    {n.body && <span className="block text-xs text-slate-400 line-clamp-2 mt-0.5">{n.body}</span>}
                    <span className="block text-[11px] text-slate-500 mt-1">
                      {fmtDateTime(n.created_at)} · {s.label}{n.obra_label ? ` · ${n.obra_label}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AvisosCenter() {
  const { target, setTarget, openNotification } = useNotifications();
  const [tab, setTab] = useState('avisos');
  const [focusId, setFocusId] = useState(null);
  const [showNuevoPedido, setShowNuevoPedido] = useState(false);
  const [needsKey, setNeedsKey] = useState(0);

  const openNeed = (id) => {
    setTab('necesidades');
    setFocusId(id);
    setNeedsKey((k) => k + 1);
  };

  // Llegada desde un aviso, un toast o una notificación push.
  useEffect(() => {
    if (!target || target.section === 'avance') return;
    setTab(target.section === 'avisos' ? 'avisos' : target.section);
    setFocusId(target.id);
    setTarget(null);
  }, [target, setTarget]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setFocusId(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${tab === t.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>
                <Icon className="w-4 h-4" /> <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PushToggle />
          <button onClick={() => setShowNuevoPedido(true)} className={btnPrimary}>
            <Plus className="w-4 h-4" /> Nuevo pedido
          </button>
        </div>
      </div>

      {tab === 'avisos' && <AvisosList onOpen={openNotification} />}
      {tab === 'necesidades' && <NecesidadesPanel key={needsKey} focusId={focusId} />}
      {tab === 'pedidos' && <PedidosPanel onOpenNeed={openNeed} focusId={focusId} />}
      {tab === 'partes' && <PartesPanel focusId={focusId} />}
      {tab === 'enlaces' && <EnlacesPanel />}
      {tab === 'proveedores' && <ProveedoresPanel />}

      {showNuevoPedido && (
        <NuevoPedidoModal
          onClose={() => setShowNuevoPedido(false)}
          onDone={({ need }) => { setShowNuevoPedido(false); openNeed(need.id); }}
        />
      )}
    </div>
  );
}
