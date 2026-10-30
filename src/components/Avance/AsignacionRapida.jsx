import React, { useMemo, useState } from 'react';
import { X, Loader2, HardHat, Building2, UserPlus, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import { flattenPlan } from '../../utils/avanceObra';
import EnlaceEnvio from '../Avisos/EnlaceEnvio';

/**
 * Asignación rápida de ejecutores: una fase completa (se hereda en todas sus
 * partidas) o varias partidas sueltas, a un obrero propio o a una subcontrata.
 * `preset` = { faseId, partidaId } para abrirla desde una fila concreta.
 */
export default function AsignacionRapida({ obra, preset = null, onClose, onSaved }) {
  const { obreros = [], subcontractors = [] } = useApp() || {};
  const plan = useMemo(() => flattenPlan(obra), [obra]);
  const [faseId, setFaseId] = useState(preset?.faseId || plan.fases[0]?.id || '');
  const fase = plan.fases.find((f) => f.id === faseId);
  const hasPartidas = fase && !fase.partidas[0]?.faseCompleta;
  const [selected, setSelected] = useState(() => new Set(preset?.partidaId ? [preset.partidaId] : []));
  const [type, setType] = useState('obrero_interno');
  const [who, setWho] = useState('');
  const [form, setForm] = useState({ start_date: '', end_date: '', planned_rate: '', notes: '', replace: false });
  const [phone, setPhone] = useState('');
  const [linkDays, setLinkDays] = useState(60);
  const [link, setLink] = useState(null); // enlace mágico creado al asignar a una subcontrata
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sub = type === 'subcontrata' ? subcontractors.find((s) => s.id === who) : null;

  const changeFase = (id) => {
    setFaseId(id);
    setSelected(new Set());
  };

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!who) {
      setError(type === 'obrero_interno' ? 'Elige el obrero.' : 'Elige la subcontrata.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api('/api/avance/assignments', {
        method: 'POST',
        body: {
          obra_id: obra.id,
          fase_id: faseId,
          partida_ids: [...selected],
          assignee_type: type,
          ...(type === 'obrero_interno' ? { obrero_id: who } : { subcontractor_id: who, phone: phone || sub?.telefono || '', link_days: linkDays }),
          ...form
        }
      });
      onSaved?.();
      if (res.link) {
        setLink(res.link);
        setBusy(false);
        return;
      }
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (link) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-white flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Asignada a {link.subcontractor_name}</h3>
            <button type="button" onClick={onClose} className="text-slate-400" aria-label="Cerrar"><X className="w-5 h-5" /></button>
          </div>
          <p className="text-xs text-slate-400">Enlace directo, sin usuario ni contraseña. Caduca el {new Date(link.expires_at).toLocaleDateString('es-ES')}. Podrás volver a copiarlo o reenviarlo desde la partida hasta que el trabajo esté finalizado.</p>
          <EnlaceEnvio link={link} />
          <div className="flex justify-end"><button type="button" onClick={onClose} className={btnGhost}>Hecho</button></div>
        </div>
      </div>
    );
  }

  const options = type === 'obrero_interno'
    ? obreros.map((o) => ({ id: o.id, label: `${o.nombre}${o.puesto ? ` · ${o.puesto}` : ''}` }))
    : subcontractors.map((s) => ({ id: s.id, label: s.nombreComercial || s.razonSocial || s.id }));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <form onSubmit={submit} className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-white flex items-center gap-2"><UserPlus className="w-4 h-4 text-amber-400" /> Asignar ejecutor</h3>
          <button type="button" onClick={onClose} className="text-slate-400" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <select value={faseId} onChange={(e) => changeFase(e.target.value)} className={inputCls}>
          {plan.fases.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>

        {hasPartidas && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-2 space-y-1 max-h-48 overflow-y-auto">
            <label className="flex items-center gap-2 text-sm font-bold text-white px-1 py-1">
              <input type="checkbox" checked={selected.size === 0} onChange={() => setSelected(new Set())} className="accent-amber-500" />
              Fase completa (se aplica a todas sus partidas)
            </label>
            {fase.partidas.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-xs text-slate-300 px-1 py-0.5">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="accent-amber-500" />
                <span className="font-mono text-amber-400">{p.codigo}</span>
                <span className="truncate">{p.titulo}</span>
              </label>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'obrero_interno', label: 'Obrero propio', icon: HardHat },
            { value: 'subcontrata', label: 'Subcontrata', icon: Building2 }
          ].map(({ value, label, icon: Icon }) => (
            <button type="button" key={value} onClick={() => { setType(value); setWho(''); }}
              className={`rounded-xl px-3 py-2 text-sm font-bold border flex items-center justify-center gap-2 ${type === value ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-200'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <select value={who} onChange={(e) => setWho(e.target.value)} className={inputCls}>
          <option value="">{type === 'obrero_interno' ? 'Obrero…' : 'Subcontrata…'}</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {type === 'subcontrata' && (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input value={phone || sub?.telefono || ''} onChange={(e) => setPhone(e.target.value)} placeholder="Móvil para WhatsApp" className={inputCls} />
            <select value={linkDays} onChange={(e) => setLinkDays(Number(e.target.value))} className={`${inputCls} !w-auto`} title="Caducidad del enlace">
              {[15, 30, 60, 90, 180].map((d) => <option key={d} value={d}>Enlace {d} días</option>)}
            </select>
            <p className="col-span-2 text-[11px] text-slate-500">Al asignar se crea su enlace directo y el mensaje de WhatsApp listo para enviar.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-400">Inicio previsto
            <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs text-slate-400">Fin previsto
            <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={`${inputCls} mt-1`} />
          </label>
        </div>
        <label className="text-xs text-slate-400 block">Rendimiento previsto (unidades de la partida por día)
          <input type="number" min="0" step="0.1" value={form.planned_rate} onChange={(e) => setForm({ ...form, planned_rate: e.target.value })} className={`${inputCls} mt-1`} />
        </label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
          placeholder="Notas del encargado (las ve el ejecutor)" className={inputCls} />
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={form.replace} onChange={(e) => setForm({ ...form, replace: e.target.checked })} className="accent-amber-500" />
          Sustituir a quien lo tuviera asignado
        </label>

        {error && <p className="text-sm text-rose-400 font-semibold">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
          <button type="submit" disabled={busy || !faseId} className={btnPrimary}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Asignar
          </button>
        </div>
      </form>
    </div>
  );
}
