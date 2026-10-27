import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Flag } from 'lucide-react';
import { STATUS } from '../../utils/avanceObra';
import { PhotoPicker, DictadoButton } from './mobileKit';

const STATUS_BUTTONS = [
  { value: 'no_iniciada', cls: 'bg-slate-700 text-white border-slate-500' },
  { value: 'en_curso', cls: 'bg-sky-500 text-slate-950 border-sky-400' },
  { value: 'bloqueada', cls: 'bg-rose-500 text-white border-rose-400' },
  { value: 'completada', cls: 'bg-emerald-500 text-slate-950 border-emerald-400' }
];

/**
 * Hoja móvil para reportar el avance de UNA partida: estado, % (deslizador y
 * número), medición ejecutada opcional, nota escrita o dictada y hasta 2 fotos.
 * `onSubmit(FormData)` la envía; el que la usa decide la URL (token o sesión).
 */
export default function ReporteAvanceSheet({ partida, onSubmit, onClose }) {
  const [status, setStatus] = useState(partida.status || 'no_iniciada');
  const [pct, setPct] = useState(partida.reported ?? 0);
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const changePct = (value) => {
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    setPct(v);
    if (v >= 100 && status !== 'bloqueada') setStatus('completada');
    else if (v > 0 && (status === 'no_iniciada' || status === 'completada')) setStatus('en_curso');
    else if (v === 0 && status === 'completada') setStatus('no_iniciada');
  };

  const changeStatus = (value) => {
    setStatus(value);
    if (value === 'completada') setPct(100);
    if (value === 'no_iniciada') setPct(0);
    if (value === 'en_curso' && pct >= 100) setPct(90);
  };

  const changeQty = (value) => {
    setQty(value);
    if (partida.cantidad > 0 && value !== '') changePct((Number(value) / partida.cantidad) * 100);
  };

  const send = async (ready = false) => {
    if (status === 'bloqueada' && !notes.trim()) {
      setError('Explica brevemente por qué está bloqueada.');
      return;
    }
    setSending(true);
    setError('');
    const form = new FormData();
    form.append('fase_id', partida.faseId);
    form.append('partida_id', partida.id || '');
    form.append('status', ready ? 'completada' : status);
    form.append('pct', String(ready ? 100 : pct));
    if (qty !== '') form.append('cantidad_ejecutada', qty);
    if (ready) form.append('listo', 'true');
    form.append('notas', notes);
    photos.forEach((p, i) => form.append('fotos', p.blob, `foto-${i + 1}.jpg`));
    try {
      await onSubmit(form);
    } catch (e) {
      setError(e.message || 'No se pudo enviar. Inténtalo otra vez.');
      setSending(false);
    }
  };

  return (
    <div className="space-y-5">
      <button type="button" onClick={onClose} className="flex items-center gap-1 text-slate-400 text-sm">
        <ArrowLeft className="w-4 h-4" /> Volver a mis partidas
      </button>

      <div>
        <span className="text-xs font-mono font-bold text-amber-400">{partida.codigo}</span>
        <h2 className="text-lg font-black leading-snug">{partida.titulo}</h2>
        {partida.cantidad > 0 && <p className="text-sm text-slate-400">{partida.cantidad} {partida.unidad}</p>}
        {partida.alert && <p className="mt-2 text-sm font-semibold text-rose-300">⚠ {partida.alertText || 'Partida en alerta'}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STATUS_BUTTONS.map((s) => (
          <button type="button" key={s.value} onClick={() => changeStatus(s.value)}
            className={`rounded-xl px-3 py-3 text-sm font-bold border ${status === s.value ? s.cls : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
            {STATUS[s.value].label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-300">% ejecutado</span>
          <div className="flex items-center gap-1">
            <input type="number" inputMode="numeric" min="0" max="100" value={pct}
              onChange={(e) => changePct(e.target.value)}
              className="w-20 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-lg font-black text-right text-white" />
            <span className="text-lg font-black text-slate-400">%</span>
          </div>
        </div>
        <input type="range" min="0" max="100" step="5" value={pct} onChange={(e) => changePct(e.target.value)}
          className="w-full h-3 accent-amber-500" aria-label="Porcentaje ejecutado" />
        {partida.cantidad > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-400">
            O mide lo hecho:
            <input type="number" inputMode="decimal" min="0" value={qty} onChange={(e) => changeQty(e.target.value)}
              placeholder={partida.executedQty != null ? String(partida.executedQty) : '0'}
              className="w-24 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-white" />
            <span>de {partida.cantidad} {partida.unidad}</span>
          </label>
        )}
      </div>

      <div className="space-y-2">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
          placeholder={status === 'bloqueada' ? '¿Por qué está bloqueada? Ej.: falta azulejo, espera a fontanero…' : 'Nota (opcional): qué se ha hecho, remates pendientes…'}
          className="w-full rounded-xl bg-slate-900 border border-slate-700 p-3 text-base focus:outline-none focus:border-amber-500" />
        <DictadoButton onText={(t) => setNotes((prev) => (prev ? `${prev} ${t}` : t))} />
      </div>

      <PhotoPicker photos={photos} setPhotos={setPhotos} />

      {error && <p className="text-rose-400 font-semibold">{error}</p>}

      <div className="space-y-3">
        <button type="button" disabled={sending} onClick={() => send(false)}
          className="w-full rounded-2xl py-4 text-lg font-black flex items-center justify-center gap-2 bg-amber-500 text-slate-950 disabled:opacity-60">
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          Guardar avance
        </button>
        <button type="button" disabled={sending} onClick={() => send(true)}
          className="w-full rounded-2xl py-3 text-base font-black flex items-center justify-center gap-2 bg-emerald-500 text-slate-950 disabled:opacity-60">
          <Flag className="w-5 h-5" /> Terminada · lista para certificación
        </button>
      </div>
    </div>
  );
}

/** Tarjeta de una partida en la lista móvil (obrero o subcontrata). */
export function PartidaCard({ partida, onOpen }) {
  const st = STATUS[partida.status] || STATUS.no_iniciada;
  const alerted = partida.status === 'bloqueada' || partida.alert;
  return (
    <button type="button" onClick={() => onOpen(partida)}
      className={`w-full text-left rounded-2xl border p-4 space-y-2 active:bg-slate-800 ${alerted ? 'bg-rose-950/30 border-rose-500/40' : 'bg-slate-900 border-slate-700'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-mono font-bold text-amber-400">{partida.codigo}</span>
          <span className="block font-bold leading-snug">{partida.faseCompleta ? `${partida.titulo} (fase completa)` : partida.titulo}</span>
        </div>
        <span className="text-xl font-black tabular-nums">{partida.reported}%</span>
      </div>
      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${partida.reported >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${partida.reported}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`px-2 py-0.5 rounded-lg border font-semibold ${st.cls}`}>{st.label}</span>
        {partida.readyForCertification && <span className="px-2 py-0.5 rounded-lg border font-semibold bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Lista para certificar</span>}
        {partida.alert === 'material' && <span className="px-2 py-0.5 rounded-lg border font-semibold bg-yellow-500/15 text-yellow-300 border-yellow-500/30">Falta material</span>}
        {partida.endDate && <span className="text-slate-400">Fin previsto: {new Date(`${partida.endDate}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>}
      </div>
      {partida.notes && <p className="text-xs text-slate-400">Encargado: {partida.notes}</p>}
    </button>
  );
}
