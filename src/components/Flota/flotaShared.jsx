import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, X, Paperclip, ExternalLink, Database } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { api, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import ModalOverlay from '../Common/ModalOverlay';
import { OpcionesCrear, conCrear, useQuickCreate, useAlCrear } from '../Common/QuickCreate';
import { ESTADO_ALERTA, ESTADOS_ACTIVO, labelEstado } from '../../utils/flota';
import PestanasComunes from '../Common/Pestanas';

// Piezas comunes de Inventario, Flota, Alquileres y Centro de alertas.

/** Carga /api/flota (todo el módulo). Las pantallas comparten la última respuesta. */
let cache = null;
const listeners = new Set();

export function useFlota() {
  const [data, setData] = useState(cache);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!cache);

  const reload = useCallback(async () => {
    try {
      const d = await api('/api/flota');
      cache = d;
      listeners.forEach((l) => l(d));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    listeners.add(setData);
    reload();
    return () => listeners.delete(setData);
  }, [reload]);

  return { data, error, loading, reload };
}

export const hoy = () => new Date().toISOString().slice(0, 10);

export const fmtKm = (n) => (n === null || n === undefined || n === '' ? '—' : `${Number(n).toLocaleString('es-ES')} km`);

export function EstadoActivo({ estado, tipo }) {
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${ESTADOS_ACTIVO[estado]?.cls || ''}`}>
      {labelEstado(estado, tipo)}
    </span>
  );
}

export function EstadoAlerta({ estado, children, className = '' }) {
  const s = ESTADO_ALERTA[estado] || ESTADO_ALERTA.vigente;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${s.cls} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {children || s.label}
    </span>
  );
}

/** Aviso para cuando falta ejecutar la migración o el servidor no tiene Supabase. */
export function SinMigracion({ error }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-slate-300 space-y-2">
      <p className="font-bold text-amber-300 flex items-center gap-2"><Database className="w-4 h-4" /> Falta preparar la base de datos</p>
      {error ? <p>{error}</p> : (
        <p>
          Ejecuta <code className="text-amber-200">supabase_schema_inventario_flota.sql</code> en Supabase &gt; SQL Editor
          (pegar todo el archivo y pulsar Run) y recarga esta página.
        </p>
      )}
    </div>
  );
}

export function Cargando() {
  return <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;
}

export function Cabecera({ icon: Icon, titulo, subtitulo, children, tono = 'text-amber-400' }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
          <Icon className={`w-7 h-7 shrink-0 ${tono}`} /> {titulo}
        </h1>
        {subtitulo && <p className="text-sm text-slate-400 mt-1">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Modal({ titulo, icon: Icon, onClose, onSubmit, busy, error, children, ancho = 'max-w-2xl', pie, zIndex = 60, submitLabel = 'Guardar' }) {
  const Tag = onSubmit ? 'form' : 'div';
  return (
    <ModalOverlay style={{ zIndex }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
      <Tag onSubmit={onSubmit} className={`w-full ${ancho} bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[94dvh]`}>
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-5 py-3.5 shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2 min-w-0">
            {Icon && <Icon className="w-5 h-5 text-amber-400 shrink-0" />}<span className="truncate">{titulo}</span>
          </h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-3">{children}</div>
        {(onSubmit || pie || error) && (
          <div className="border-t border-slate-800 px-5 py-3 shrink-0 space-y-2">
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {pie}
              {onSubmit && (
                <>
                  <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
                  <button type="submit" disabled={busy} className={btnPrimary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} {submitLabel}</button>
                </>
              )}
            </div>
          </div>
        )}
      </Tag>
    </ModalOverlay>
  );
}

export const Campo = ({ label, full, children, ayuda }) => (
  <label className={`block text-xs text-slate-400 ${full ? 'sm:col-span-2' : ''}`}>
    {label}
    <div className="mt-1">{children}</div>
    {ayuda && <span className="block text-[11px] text-slate-500 mt-0.5">{ayuda}</span>}
  </label>
);

export const Rejilla = ({ children }) => <div className="grid sm:grid-cols-2 gap-3">{children}</div>;

/** Estado de formulario + guardado con errores. */
export function useFormulario(inicial) {
  const [form, setForm] = useState(inicial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => {
    const v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [k]: v }));
  };
  const enviar = (fn) => async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return { form, setForm, set, busy, error, setError, enviar };
}

export async function subirArchivo(file, carpeta) {
  const fd = new FormData();
  fd.append('carpeta', carpeta);
  fd.append('archivo', file, file.name);
  const res = await fetch('/api/flota/archivo', { method: 'POST', body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status} al subir el archivo`);
  return data;
}

export async function abrirArchivo(path) {
  const { url } = await api(`/api/flota/archivo?path=${encodeURIComponent(path)}`);
  window.open(url, '_blank', 'noopener');
}

export function BotonArchivo({ path, label = 'Ver', className = '' }) {
  const { showNotification } = useApp() || {};
  if (!path) return null;
  return (
    <button type="button" onClick={() => abrirArchivo(path).catch((e) => showNotification?.(e.message, 'error'))}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200 ${className}`}>
      <ExternalLink className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

export function CampoArchivo({ file, onChange, actual, label = 'PDF o foto' }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className={`${btnGhost} !py-1.5 text-xs cursor-pointer`}>
        <Paperclip className="w-4 h-4" /> {file ? file.name.slice(0, 28) : label}
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0] || null)} />
      </label>
      {actual && !file && <BotonArchivo path={actual} label="Ver actual" />}
    </div>
  );
}

/** <select> de obra con "Crear nueva obra" al final. */
export function SelectObra({ value, onChange, vacio = 'Sin obra', required }) {
  const { obras = [] } = useApp() || {};
  const { crear } = useQuickCreate();
  const activas = useMemo(() => obras.filter((o) => o.estado !== 'finalizada' || o.id === value), [obras, value]);
  return (
    <select value={value || ''} onChange={conCrear(crear, onChange)} className={inputCls} required={required}>
      <option value="">{vacio}</option>
      {activas.map((o) => <option key={o.id} value={o.id}>{[o.codigo, o.titulo].filter(Boolean).join(' · ')}</option>)}
      <OpcionesCrear tipos={['obra']} />
    </select>
  );
}

/** <select> de operario (fichas "obreros") con "Crear nuevo operario". onChange(id, nombre). */
export function SelectOperario({ value, onChange, vacio = 'Sin operario', required }) {
  const { obreros = [] } = useApp() || {};
  const { crear } = useQuickCreate();
  const nombreDe = (id, r) => r ? `${r.nombre} ${r.apellidos || ''}`.trim() : obreros.find((o) => o.id === id)?.nombre || '';
  return (
    <select value={value || ''} required={required}
      onChange={conCrear(crear, (id, r) => onChange(id, nombreDe(id, r)))} className={inputCls}>
      <option value="">{vacio}</option>
      {obreros.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      <OpcionesCrear tipos={['obrero']} />
    </select>
  );
}

/**
 * <select> de proveedor (Avisos > Proveedores) con "Crear nuevo proveedor". Muestra primero
 * los de la categoría pedida (alquiler, taller...). onChange(id, nombre).
 */
export function SelectProveedor({ value, onChange, proveedores = [], categoria, vacio = 'Elige…', onCreado }) {
  const { crear } = useQuickCreate();
  const [extra, setExtra] = useState([]);
  useAlCrear('proveedor', (p) => setExtra((x) => [...x, p]));
  const lista = useMemo(() => {
    const todos = [...proveedores, ...extra.filter((e) => !proveedores.some((p) => p.id === e.id))].filter((p) => p.is_active !== false);
    const deCat = (p) => (p.categories || []).some((c) => String(c).toLowerCase().includes(categoria || '~'));
    return [...todos.filter(deCat), ...todos.filter((p) => !deCat(p))];
  }, [proveedores, extra, categoria]);
  return (
    <select value={value || ''}
      onChange={conCrear((tipo) => crear(tipo, { categories: categoria || '' }).then((r) => { if (r) onCreado?.(r); return r; }),
        (id, r) => onChange(id, r?.name || lista.find((p) => p.id === id)?.name || ''))}
      className={inputCls}>
      <option value="">{vacio}</option>
      {lista.map((p) => <option key={p.id} value={p.id}>{p.name}{(p.categories || []).length ? ` · ${p.categories.join(', ')}` : ''}</option>)}
      <OpcionesCrear tipos={['proveedor']} />
    </select>
  );
}

export const inputSm = `${inputCls} !py-1.5 text-xs`;

/** Pestañas de una ficha (usa la barra común de la app). */
export function Pestanas({ tabs, value, onChange }) {
  return (
    <PestanasComunes size="sm" ariaLabel="Secciones de la ficha" value={value} onChange={onChange}
      tabs={tabs.map(({ badge, ...t }) => ({ ...t, count: badge || undefined }))} />
  );
}

export function Vacio({ children }) {
  return <p className="text-sm text-slate-500 py-6 text-center">{children}</p>;
}

/** Número para enviar: '' → null, coma decimal → punto. */
export const num = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')));
