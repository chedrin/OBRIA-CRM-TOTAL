import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLlenadoAnimado, RELLENO_ANIMADO } from '../Common/BarraProgreso';
import {
  ChevronDown, Loader2, UserPlus, ShieldCheck, History, AlertTriangle, Package, Building2, X, Trash2, RefreshCw, Flag, Link2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNotifications } from '../../context/NotificationsContext';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import { api, fmtDateTime, fmtDate, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import { STATUS, applyCertifiedToObra } from '../../utils/avanceObra';
import useNotify from '../Avisos/useNotify';
import AsignacionRapida from './AsignacionRapida';
import { EnlaceAsignacionModal } from '../Avisos/EnlaceEnvio';
import ModalOverlay from '../Common/ModalOverlay';

// Panel del jefe de obra: árbol Fase > Partidas con el avance reportado por obreros y
// subcontratas, el planificado según las fechas asignadas y el certificado (validado).

const LOG_LABEL = {
  avance: 'Avance',
  listo_certificacion: 'Lista para certificar',
  certificacion: 'Certificado',
  bloqueo: 'Bloqueo / alerta',
  desbloqueo: 'Alerta resuelta',
  asignacion: 'Asignación'
};

function ProgressBars({ reported, certified, planned }) {
  const reportedAnimado = useLlenadoAnimado(reported);
  const certifiedAnimado = useLlenadoAnimado(certified);
  return (
    <div className="relative w-full h-5 bg-slate-800 rounded-full overflow-hidden" title={`Reportado ${reported}% · Certificado ${certified}%${planned != null ? ` · Planificado ${planned}%` : ''}`}>
      <div className={`absolute inset-y-0 left-0 bg-amber-500/50 ${RELLENO_ANIMADO}`} style={{ width: `${reportedAnimado}%` }} />
      <div className={`absolute inset-y-0 left-0 bg-emerald-500 ${RELLENO_ANIMADO}`} style={{ width: `${certifiedAnimado}%` }} />
      {planned != null && <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `calc(${planned}% - 1px)` }} />}
    </div>
  );
}

function AssigneeBadge({ a, obreros }) {
  if (a.assignee_type === 'subcontrata') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 px-1.5 py-0.5 text-[10px] font-bold" title={a.heredada ? 'Heredada de la fase' : ''}>
        <Building2 className="w-3 h-3" /> {a.assignee_name}{a.heredada ? ' ·F' : ''}
      </span>
    );
  }
  const obrero = obreros.find((o) => o.id === a.obrero_id);
  const initials = (a.assignee_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 pl-0.5 pr-1.5 py-0.5 text-[10px] font-bold" title={a.heredada ? 'Heredada de la fase' : ''}>
      {obrero?.foto
        ? <img src={obrero.foto} alt="" className="w-4 h-4 rounded-full object-cover" />
        : <span className="w-4 h-4 rounded-full bg-sky-500 text-slate-950 text-[8px] flex items-center justify-center">{initials}</span>}
      {a.assignee_name}{a.heredada ? ' ·F' : ''}
    </span>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
      <span className="block text-[11px] text-slate-400 font-semibold">{label}</span>
      <span className={`block text-2xl font-black tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

export default function SeguimientoObra() {
  const { obras = [], obreros = [], updateObra } = useApp() || {};
  const { target, setTarget } = useNotifications();
  const notify = useNotify();
  const activas = useMemo(() => [...obras].sort((a, b) => (a.estado === 'finalizada') - (b.estado === 'finalizada')), [obras]);
  const [obraId, setObraId] = useState(activas[0]?.id || '');
  const obra = obras.find((o) => o.id === obraId);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [assigning, setAssigning] = useState(null);
  const [detailKey, setDetailKey] = useState(null);
  const reloadTimer = useRef(null);

  const load = useCallback(async (id = obraId) => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await api(`/api/avance/obras/${encodeURIComponent(id)}`));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => {
    setData(null);
    load(obraId);
  }, [obraId, load]);

  // Tiempo real: cualquier reporte de esta obra recarga el panel (agrupado en 600 ms).
  useEffect(() => {
    if (!obraId || !isSupabaseConfigured) return undefined;
    const schedule = () => {
      clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => load(obraId), 600);
    };
    const filter = `obra_id=eq.${obraId}`;
    const channel = supabase
      .channel(`avance-${obraId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_item_progress', filter }, schedule)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'execution_logs', filter }, schedule)
      .subscribe();
    return () => {
      clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [obraId, load]);

  // Llegada desde un aviso o notificación push: abrir la obra y la partida afectada.
  useEffect(() => {
    if (target?.section !== 'avance') return;
    if (target.obraId) setObraId(target.obraId);
    if (target.faseId) {
      setExpanded((prev) => ({ ...prev, [target.faseId]: true }));
      setDetailKey(`${target.faseId}::${target.partidaId || ''}`);
    }
    setTarget(null);
  }, [target, setTarget]);

  const summary = data?.summary;
  const partidaByKey = useMemo(() => new Map((summary?.fases || []).flatMap((f) => f.partidas.map((p) => [p.key, { ...p, faseNombre: f.nombre }]))), [summary]);
  const detail = detailKey ? partidaByKey.get(detailKey) : null;

  const certify = async (items, force = false) => {
    try {
      const res = await api('/api/avance/certify', { method: 'POST', body: { obra_id: obraId, items, force } });
      // El avance certificado pasa a la obra: es el que ven facturación, el portal y el panel general.
      const map = new Map(res.certified.map((c) => [c.key, c.pct]));
      if (obra && updateObra) updateObra(obra.id, applyCertifiedToObra(obra, map));
      notify(`${res.certified.length} partida(s) validada(s)`);
      load();
      return true;
    } catch (e) {
      notify(e.message, 'error');
      return false;
    }
  };

  const pending = (summary?.fases || []).flatMap((f) => f.partidas.filter((p) => p.pendingValidation));
  const certifyAll = () => {
    if (!pending.length) return;
    if (!window.confirm(`¿Validar el avance reportado de ${pending.length} partida(s) como certificado?`)) return;
    certify(pending.map((p) => ({ fase_id: p.faseId, partida_id: p.id, certified_pct: p.reported })));
  };

  if (!obras.length) {
    return <p className="text-slate-400">No hay obras todavía.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <div className="flex flex-wrap gap-2">
          <select value={obraId} onChange={(e) => { setObraId(e.target.value); setDetailKey(null); }} className={`${inputCls} !w-auto`}>
            {activas.map((o) => <option key={o.id} value={o.id}>{[o.codigo, o.titulo].filter(Boolean).join(' - ')}</option>)}
          </select>
          <button onClick={() => load()} className={btnGhost} title="Recargar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => setAssigning({})} disabled={!obra?.fases?.length} className={btnPrimary}><UserPlus className="w-4 h-4" /> Asignar</button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {error}
          <span className="block text-xs text-amber-300/80 mt-1">Si es la primera vez: ejecuta <code>supabase_schema_avance_obra.sql</code> en Supabase &gt; SQL Editor.</span>
        </div>
      )}

      {!summary && !error && <div className="flex justify-center py-10 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      {summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Kpi label="Reportado" value={`${summary.reported}%`} tone="text-amber-400" />
            <Kpi label="Certificado" value={`${summary.certified}%`} tone="text-emerald-400" />
            <Kpi label="Planificado hoy" value={summary.planned != null ? `${summary.planned}%` : '—'} tone="text-white" />
            <Kpi label="Bloqueadas / alerta" value={summary.blocked} tone={summary.blocked ? 'text-rose-400' : 'text-slate-300'} />
            <Kpi label="Pendientes de validar" value={summary.pendingValidation} tone={summary.pendingValidation ? 'text-sky-400' : 'text-slate-300'} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-500" /> Certificado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-amber-500/50" /> Reportado</span>
              <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-white" /> Planificado</span>
              <span>Peso: {summary.mode === 'importe' ? 'importe de cada partida' : 'igual por partida'}</span>
            </span>
            {pending.length > 0 && (
              <button onClick={certifyAll} className={`${btnGhost} !py-1 !text-xs`}><ShieldCheck className="w-3.5 h-3.5" /> Validar todo lo pendiente ({pending.length})</button>
            )}
          </div>

          <div className="space-y-2">
            {summary.fases.map((fase) => {
              const open = expanded[fase.id] ?? (fase.blocked > 0 || fase.pendingValidation > 0);
              const single = fase.partidas.length === 1 && fase.partidas[0].faseCompleta;
              return (
                <div key={fase.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="p-3 flex items-center gap-3">
                    <button onClick={() => setExpanded((p) => ({ ...p, [fase.id]: !open }))} className="text-slate-400" aria-label="Desplegar fase" disabled={single}>
                      <ChevronDown className={`w-4 h-4 transition-transform ${open && !single ? 'rotate-180' : ''} ${single ? 'opacity-30' : ''}`} />
                    </button>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-sm truncate">{fase.nombre}</span>
                        {fase.blocked > 0 && <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded px-1.5">{fase.blocked} en alerta</span>}
                        {fase.pendingValidation > 0 && <span className="text-[10px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 rounded px-1.5">{fase.pendingValidation} por validar</span>}
                        {single && fase.partidas[0].assignees.map((a) => <AssigneeBadge key={a.id} a={a} obreros={obreros} />)}
                      </div>
                      <ProgressBars reported={fase.reported} certified={fase.certified} planned={fase.planned} />
                    </div>
                    <div className="text-right shrink-0 w-24">
                      <span className="block text-sm font-black text-emerald-400 tabular-nums">{fase.certified}%</span>
                      <span className="block text-[10px] text-slate-400 tabular-nums">rep. {fase.reported}%{fase.planned != null ? ` · plan ${fase.planned}%` : ''}</span>
                    </div>
                    {single
                      ? <button onClick={() => setDetailKey(fase.partidas[0].key)} className={`${btnGhost} !px-2 !py-1`} title="Detalle"><History className="w-4 h-4" /></button>
                      : <button onClick={() => setAssigning({ faseId: fase.id })} className={`${btnGhost} !px-2 !py-1`} title="Asignar fase"><UserPlus className="w-4 h-4" /></button>}
                  </div>

                  {open && !single && (
                    <div className="border-t border-slate-800 divide-y divide-slate-800/70">
                      {fase.partidas.map((p) => {
                        const st = STATUS[p.status] || STATUS.no_iniciada;
                        const alerted = p.status === 'bloqueada' || p.alert;
                        return (
                          <div key={p.key} className={`px-3 py-2.5 pl-10 flex flex-wrap sm:flex-nowrap items-center gap-3 ${alerted ? 'bg-rose-500/5' : ''}`}>
                            <button onClick={() => setDetailKey(p.key)} className="flex-1 min-w-0 text-left space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold text-amber-400">{p.codigo}</span>
                                <span className="text-xs font-semibold text-white truncate max-w-[22rem]">{p.titulo}</span>
                                <span className={`text-[10px] px-1.5 rounded border font-semibold ${st.cls}`}>{st.label}</span>
                                {p.alert === 'material' && <span className="text-[10px] px-1.5 rounded border font-semibold bg-yellow-500/15 text-yellow-300 border-yellow-500/30 inline-flex items-center gap-1"><Package className="w-3 h-3" /> Falta material</span>}
                                {p.readyForCertification && <span className="text-[10px] px-1.5 rounded border font-semibold bg-emerald-500/15 text-emerald-300 border-emerald-500/30 inline-flex items-center gap-1"><Flag className="w-3 h-3" /> Lista</span>}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {p.assignees.length
                                  ? p.assignees.map((a) => <AssigneeBadge key={`${a.id}-${p.key}`} a={a} obreros={obreros} />)
                                  : <span className="text-[10px] text-slate-500">Sin asignar</span>}
                              </div>
                              <ProgressBars reported={p.reported} certified={p.certified} planned={p.planned} />
                            </button>
                            <div className="text-right shrink-0 w-24">
                              <span className="block text-sm font-black text-emerald-400 tabular-nums">{p.certified}%</span>
                              <span className="block text-[10px] text-slate-400 tabular-nums">rep. {p.reported}%{p.planned != null ? ` · plan ${p.planned}%` : ''}</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {p.pendingValidation && (
                                <button onClick={() => certify([{ fase_id: p.faseId, partida_id: p.id, certified_pct: p.reported }])}
                                  className={`${btnPrimary} !px-2 !py-1 !text-xs`} title="Validar el avance reportado">
                                  <ShieldCheck className="w-3.5 h-3.5" /> {p.reported}%
                                </button>
                              )}
                              <button onClick={() => setAssigning({ faseId: p.faseId, partidaId: p.id })} className={`${btnGhost} !px-2 !py-1`} title="Asignar partida"><UserPlus className="w-4 h-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {data.logs?.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><History className="w-4 h-4 text-amber-400" /> Últimos cambios</h3>
              <ul className="space-y-1.5 text-xs">
                {data.logs.slice(0, 12).map((l) => {
                  const p = partidaByKey.get(`${l.fase_id}::${l.partida_id || ''}`);
                  return (
                    <li key={l.id} className="flex flex-wrap gap-x-2 text-slate-300">
                      <span className="text-slate-500 tabular-nums">{fmtDateTime(l.created_at)}</span>
                      <strong className="text-white">{l.author_name || 'Sistema'}</strong>
                      <span>{LOG_LABEL[l.kind] || l.kind}</span>
                      {l.pct_after != null && l.kind !== 'asignacion' && <span className="tabular-nums">{l.pct_before ?? 0}% → {l.pct_after}%</span>}
                      <button onClick={() => p && setDetailKey(p.key)} className="text-amber-400 truncate max-w-[18rem]">{p ? `${p.codigo} ${p.titulo}` : ''}</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {assigning && obra && (
        <AsignacionRapida obra={obra} preset={assigning} onClose={() => setAssigning(null)} onSaved={() => { notify('Asignación guardada'); load(); }} />
      )}

      {detail && (
        <PartidaDetalle
          obraId={obraId}
          partida={detail}
          needs={(data?.needs || []).filter((n) => n.fase_id === detail.faseId && (n.partida_id || '') === (detail.id || ''))}
          obreros={obreros}
          onClose={() => setDetailKey(null)}
          onCertify={certify}
          onChanged={() => load()}
          onAssign={() => setAssigning({ faseId: detail.faseId, partidaId: detail.id })}
        />
      )}
    </div>
  );
}

/** Detalle de una partida: asignados, avisos abiertos, validación e historial con fotos. */
function PartidaDetalle({ obraId, partida, needs, obreros, onClose, onCertify, onChanged, onAssign }) {
  const notify = useNotify();
  const [logs, setLogs] = useState(null);
  const [pct, setPct] = useState(partida.reported);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkFor, setLinkFor] = useState(null); // asignación de subcontrata cuyo enlace se reenvía
  const st = STATUS[partida.status] || STATUS.no_iniciada;

  useEffect(() => {
    setPct(partida.reported);
    const qs = new URLSearchParams({ obra: obraId, fase: partida.faseId, partida: partida.id || '' });
    api(`/api/avance/logs?${qs}`).then(setLogs).catch(() => setLogs([]));
  }, [obraId, partida.faseId, partida.id, partida.reported, partida.reportedAt]);

  const removeAssignment = async (a) => {
    if (a.heredada) {
      notify('Esta asignación viene de la fase: quítala desde la fase o asigna la partida a otro.', 'error');
      return;
    }
    if (!window.confirm(`¿Quitar a ${a.assignee_name} de esta partida?`)) return;
    try {
      await api(`/api/avance/assignments/${a.id}`, { method: 'DELETE' });
      onChanged();
    } catch (e) {
      notify(e.message, 'error');
    }
  };

  const validate = async () => {
    setBusy(true);
    await onCertify([{ fase_id: partida.faseId, partida_id: partida.id, certified_pct: pct }], force);
    setBusy(false);
  };

  const openNeed = (id) => {
    window.location.hash = `#admin/necesidades/${id}`;
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <aside className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700 overflow-y-auto p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] text-slate-400">{partida.faseNombre}</span>
            <h3 className="font-black text-white leading-snug"><span className="font-mono text-amber-400 mr-1">{partida.codigo}</span>{partida.titulo}</h3>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className={`text-[10px] px-1.5 rounded border font-semibold ${st.cls}`}>{st.label}</span>
              {partida.cantidad > 0 && <span className="text-[10px] text-slate-400">{partida.executedQty != null ? `${partida.executedQty} de ` : ''}{partida.cantidad} {partida.unidad}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><span className="block text-[10px] text-slate-400">Reportado</span><span className="font-black text-amber-400">{partida.reported}%</span></div>
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><span className="block text-[10px] text-slate-400">Certificado</span><span className="font-black text-emerald-400">{partida.certified}%</span></div>
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><span className="block text-[10px] text-slate-400">Planificado</span><span className="font-black text-white">{partida.planned != null ? `${partida.planned}%` : '—'}</span></div>
        </div>
        {partida.reportedAt && <p className="text-[11px] text-slate-400">Último reporte: {partida.reportedBy} · {fmtDateTime(partida.reportedAt)}</p>}

        {(partida.alert || needs.length > 0) && (
          <section className="space-y-2">
            <h4 className="text-xs font-bold text-rose-300 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Avisos abiertos</h4>
            {partida.alertText && !needs.length && <p className="text-xs text-slate-300">{partida.alertText}</p>}
            {needs.map((n) => (
              <div key={n.id} className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-2 text-xs space-y-1">
                <p className="text-slate-200">{n.description}</p>
                <p className="text-slate-500">{n.reported_by_name} · {fmtDateTime(n.created_at)} · {n.status.replace('_', ' ')}</p>
                <button onClick={() => openNeed(n.id)} className={`${btnPrimary} !py-1 !text-xs`}>
                  {n.category === 'material' ? <><Package className="w-3.5 h-3.5" /> Tramitar pedido</> : 'Resolver'}
                </button>
              </div>
            ))}
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white">Ejecutores</h4>
            <button onClick={onAssign} className={`${btnGhost} !py-1 !text-xs`}><UserPlus className="w-3.5 h-3.5" /> Asignar</button>
          </div>
          {partida.assignees.length === 0 && <p className="text-xs text-slate-500">Sin asignar.</p>}
          {partida.assignees.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <AssigneeBadge a={a} obreros={obreros} />
                <p className="text-slate-500">
                  {a.start_date ? fmtDate(a.start_date) : '¿inicio?'} → {a.end_date ? fmtDate(a.end_date) : '¿fin?'}
                  {a.planned_rate ? ` · ${a.planned_rate} ${partida.unidad || 'ud'}/día` : ''}
                  {a.heredada ? ' · heredada de la fase' : ''}
                </p>
                {a.notes && <p className="text-slate-400">{a.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.assignee_type === 'subcontrata' && partida.certified < 100 && (
                  <button onClick={() => setLinkFor(a)} className={`${btnGhost} !py-1 !text-xs`} title="Copiar o reenviar su enlace directo"><Link2 className="w-3.5 h-3.5" /> Enlace</button>
                )}
                {!a.heredada && <button onClick={() => removeAssignment(a)} className="text-slate-500 hover:text-rose-400" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </section>

        {linkFor && <EnlaceAsignacionModal assignment={linkFor} onClose={() => setLinkFor(null)} />}

        <section className="space-y-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
          <h4 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Validar como avance certificado</h4>
          <div className="flex items-center gap-2">
            <input type="number" min="0" max="100" value={pct} onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className={`${inputCls} !w-24`} />
            <span className="text-slate-400">%</span>
            <button onClick={validate} disabled={busy} className={btnPrimary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Validar</button>
          </div>
          {pct > partida.reported && (
            <label className="flex items-center gap-2 text-[11px] text-amber-300">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="accent-amber-500" />
              Certificar por encima de lo reportado ({partida.reported}%): lo he comprobado en obra
            </label>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5"><History className="w-4 h-4 text-amber-400" /> Historial</h4>
          {!logs && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
          {logs?.length === 0 && <p className="text-xs text-slate-500">Sin cambios todavía.</p>}
          <ol className="space-y-3">
            {(logs || []).map((l) => (
              <li key={l.id} className="text-xs border-l-2 border-slate-700 pl-3 space-y-1">
                <p className="text-slate-300">
                  <strong className="text-white">{l.author_name || 'Sistema'}</strong> · {LOG_LABEL[l.kind] || l.kind}
                  {l.pct_after != null && l.kind !== 'asignacion' && <span className="tabular-nums"> · {l.pct_before ?? 0}% → {l.pct_after}%</span>}
                  {l.status && STATUS[l.status] && l.kind === 'avance' && <span> · {STATUS[l.status].label}</span>}
                </p>
                <p className="text-slate-500">{fmtDateTime(l.created_at)}</p>
                {l.notes && <p className="text-slate-300">{l.notes}</p>}
                {l.photo_urls?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {l.photo_urls.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Foto del avance" className="w-20 h-20 rounded-lg object-cover border border-slate-700" /></a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </ModalOverlay>
  );
}
