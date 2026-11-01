import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Truck, Fuel, Phone, Wrench, Loader2, X, Camera, CheckCircle2 } from 'lucide-react';
import ModalOverlay from '../Common/ModalOverlay';

const fmtFecha = (f) => (f ? new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const diasHasta = (f) => Math.round((Date.parse(`${String(f).slice(0, 10)}T12:00:00Z`) - Date.now()) / 86400000);
const input = 'w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-3 text-base text-white focus:outline-none focus:border-amber-500';

/**
 * Portal del Obrero: el vehículo que conduce (ITV, seguro y teléfono de asistencia), lo que
 * lleva a bordo, las herramientas que tiene asignadas y el botón para apuntar un repostaje.
 * No se muestra si no tiene nada asignado o si el módulo no está instalado.
 */
export default function MiVehiculo({ obreroId, isAdmin = false, obras = [] }) {
  const [data, setData] = useState(null);
  const [repostar, setRepostar] = useState(null);
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = isAdmin && obreroId ? `?obrero=${encodeURIComponent(obreroId)}` : '';
      const res = await fetch(`/api/flota/mio${qs}`);
      if (!res.ok) { setData(null); return; }
      setData(await res.json());
    } catch {
      setData(null);
    }
  }, [isAdmin, obreroId]);

  useEffect(() => { load(); }, [load]);

  if (!data?.listo || (!data.vehiculos.length && !data.activos.length)) return null;

  return (
    <div className="space-y-2.5">
      <span className="text-sm font-bold text-white flex items-center gap-1.5"><Truck className="w-4 h-4 text-sky-400" /> Mi vehículo y herramientas</span>
      {ok && <p className="text-xs text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {ok}</p>}

      {data.vehiculos.map((v) => {
        const itvDias = v.itv ? diasHasta(v.itv.proxima_itv) : null;
        const segDias = v.seguro ? diasHasta(v.seguro.fecha_vencimiento) : null;
        const color = (d) => (d === null ? 'text-slate-400' : d < 0 ? 'text-rose-400' : d <= 30 ? 'text-amber-300' : 'text-emerald-300');
        return (
          <div key={v.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-mono font-black text-lg text-white tracking-wider">{v.matricula}</span>
                <p className="text-xs text-slate-400">{[v.marca, v.modelo].filter(Boolean).join(' ')} · {Number(v.km_actual).toLocaleString('es-ES')} km</p>
              </div>
              <button type="button" onClick={() => setRepostar(v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-3 text-sm">
                <Fuel className="w-5 h-5" /> Repostar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5">
                <span className="block text-slate-500">ITV</span>
                <span className={`font-bold ${color(itvDias)}`}>{v.itv ? fmtFecha(v.itv.proxima_itv) : 'Sin datos'}</span>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5">
                <span className="block text-slate-500">Seguro</span>
                <span className={`font-bold ${color(segDias)}`}>{v.seguro ? `${v.seguro.aseguradora} · ${fmtFecha(v.seguro.fecha_vencimiento)}` : 'Sin datos'}</span>
              </div>
            </div>
            {v.seguro?.telefono_asistencia && (
              <a href={`tel:${v.seguro.telefono_asistencia}`} className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-bold py-2.5 text-sm">
                <Phone className="w-4 h-4" /> Asistencia en carretera · {v.seguro.telefono_asistencia}
              </a>
            )}
            {v.dotacion.length > 0 && (
              <details className="text-xs text-slate-300">
                <summary className="cursor-pointer text-slate-400">Lleva a bordo ({v.dotacion.length})</summary>
                <ul className="mt-1.5 space-y-1">{v.dotacion.map((a) => <li key={a.id}>· {a.nombre} <span className="text-slate-500">{a.codigo_interno}</span></li>)}</ul>
              </details>
            )}
          </div>
        );
      })}

      {data.activos.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5" /> Herramientas a mi cargo</p>
          <ul className="space-y-1 text-sm text-slate-200">
            {data.activos.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.nombre}</span><span className="text-xs font-mono text-slate-500 shrink-0">{a.codigo_interno}</span></li>)}
          </ul>
        </div>
      )}

      <AnimatePresence>
        {repostar && (
          <RepostajeSheet key="rep" vehiculo={repostar} obras={obras}
            onClose={() => setRepostar(null)}
            onSaved={() => { setRepostar(null); setOk('Repostaje apuntado. ¡Gracias!'); load(); setTimeout(() => setOk(''), 5000); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function RepostajeSheet({ vehiculo, obras, onClose, onSaved }) {
  const [form, setForm] = useState({ km: String(vehiculo.km_actual || ''), litros: '', importe: '', deposito_lleno: true, estacion: '', obra_id: '' });
  const [ticket, setTicket] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('vehicle_id', vehiculo.id);
      for (const [k, v] of Object.entries(form)) fd.append(k, String(v).replace(',', '.'));
      if (ticket) fd.append('ticket', ticket, ticket.name);
      const res = await fetch('/api/flota/repostaje', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2">
      <form onSubmit={enviar} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 max-h-[94dvh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2"><Fuel className="w-5 h-5 text-amber-400" /> Repostaje · {vehiculo.matricula}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <label className="block text-xs text-slate-400">Km del cuentakilómetros
          <input inputMode="numeric" value={form.km} onChange={set('km')} className={input} required />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-slate-400">Litros
            <input inputMode="decimal" value={form.litros} onChange={set('litros')} className={input} required autoFocus />
          </label>
          <label className="block text-xs text-slate-400">Importe (€)
            <input inputMode="decimal" value={form.importe} onChange={set('importe')} className={input} required />
          </label>
        </div>
        <label className="block text-xs text-slate-400">Gasolinera
          <input value={form.estacion} onChange={set('estacion')} className={input} />
        </label>
        {obras.length > 0 && (
          <label className="block text-xs text-slate-400">Para la obra (si es para una obra concreta)
            <select value={form.obra_id} onChange={set('obra_id')} className={input}>
              <option value="">Ninguna</option>
              {obras.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={form.deposito_lleno} onChange={set('deposito_lleno')} className="w-5 h-5" /> He llenado el depósito</label>
        <label className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 py-3 text-sm text-slate-200 cursor-pointer">
          <Camera className="w-5 h-5" /> {ticket ? ticket.name.slice(0, 30) : 'Foto del ticket'}
          <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setTicket(e.target.files?.[0] || null)} />
        </label>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 text-slate-950 font-bold py-3.5 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar repostaje
        </button>
      </form>
    </ModalOverlay>
  );
}
