import React, { useMemo, useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X, ChevronRight } from 'lucide-react';

const ESTADOS = {
  en_curso: { label: 'En curso', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  presupuestada: { label: 'Presupuestada', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/30', dot: 'bg-sky-500' },
  pausada: { label: 'Pausada', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30', dot: 'bg-slate-500' },
  finalizada: { label: 'Finalizada', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' }
};

const eur = (n) => `${Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })} €`;

const COLUMNAS = [
  { id: 'codigo', label: 'Código', get: o => o.codigo || '' },
  { id: 'titulo', label: 'Obra', get: o => (o.titulo || '').toLowerCase() },
  { id: 'cliente', label: 'Cliente', get: o => (o.cliente || '').toLowerCase() },
  { id: 'responsable', label: 'Responsable', get: o => (o.responsable || '').toLowerCase(), clasica: true },
  { id: 'estado', label: 'Estado', get: o => o.estado || '' },
  { id: 'fechaInicio', label: 'Inicio', get: o => o.fechaInicio || '', clasica: true },
  { id: 'fechaFinEstimada', label: 'Fin previsto', get: o => o.fechaFinEstimada || '' },
  { id: 'progreso', label: 'Avance', get: o => Number(o.progreso || 0), num: true },
  { id: 'presupuestoTotal', label: 'Presupuesto', get: o => Number(o.presupuestoTotal || 0), num: true },
  { id: 'margenRealPct', label: 'Margen', get: o => Number(o.margenRealPct || 0), num: true, clasica: true }
];

// Vista de tabla de obras: compacta (densa) o clásica (con filtros avanzados y más columnas).
export default function ObrasTabla({ obras, compact, onOpen }) {
  const [sort, setSort] = useState({ by: 'codigo', dir: 'desc' });
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [responsable, setResponsable] = useState('');

  const columnas = compact ? COLUMNAS.filter(c => !c.clasica) : COLUMNAS;
  const responsables = useMemo(
    () => Array.from(new Set(obras.map(o => o.responsable).filter(Boolean))).sort(),
    [obras]
  );

  const filas = useMemo(() => {
    let list = obras;
    if (!compact) {
      list = list.filter(o =>
        (!desde || (o.fechaInicio || '') >= desde) &&
        (!hasta || (o.fechaInicio || '') <= hasta) &&
        (!responsable || o.responsable === responsable)
      );
    }
    const col = COLUMNAS.find(c => c.id === sort.by) || COLUMNAS[0];
    return [...list].sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [obras, compact, desde, hasta, responsable, sort]);

  const toggleSort = (by) => setSort(prev => ({ by, dir: prev.by === by && prev.dir === 'desc' ? 'asc' : 'desc' }));
  const hayFiltros = desde || hasta || responsable;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-end gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs animate-in fade-in">
          <span className="flex items-center gap-1.5 text-slate-400 font-semibold self-center"><Filter className="w-3.5 h-3.5" />Filtros avanzados</span>
          <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 uppercase font-bold">
            Inicio desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white normal-case font-normal" />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 uppercase font-bold">
            Inicio hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white normal-case font-normal" />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 uppercase font-bold">
            Responsable
            <select value={responsable} onChange={(e) => setResponsable(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white normal-case font-normal">
              <option value="">Todos</option>
              {responsables.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          {hayFiltros && (
            <button onClick={() => { setDesde(''); setHasta(''); setResponsable(''); }} className="flex items-center gap-1 text-slate-400 hover:text-white self-center">
              <X className="w-3.5 h-3.5" />Limpiar
            </button>
          )}
          <span className="ml-auto self-center text-slate-500">
            {filas.length} obras · {eur(filas.reduce((s, o) => s + Number(o.presupuestoTotal || 0), 0))}
          </span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-left ${compact ? 'text-[11px] om-table-compact' : 'text-xs'}`}>
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                {columnas.map(col => {
                  const active = sort.by === col.id;
                  const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th key={col.id} className={`px-3 py-2.5 font-bold whitespace-nowrap ${col.num ? 'text-right' : ''}`}>
                      <button type="button" onClick={() => toggleSort(col.id)} className={`inline-flex items-center gap-1 hover:text-slate-200 transition ${active ? 'text-slate-200' : ''}`}>
                        {col.label}
                        <SortIcon className="w-3 h-3" />
                      </button>
                    </th>
                  );
                })}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filas.length === 0 && (
                <tr><td colSpan={columnas.length + 1} className="px-3 py-8 text-center text-slate-500">No hay obras con estos filtros.</td></tr>
              )}
              {filas.map(obra => {
                const est = ESTADOS[obra.estado] || ESTADOS.pausada;
                return (
                  <tr key={obra.id} onClick={() => onOpen(obra.id)} className="group hover:bg-slate-800/60 cursor-pointer transition-colors">
                    {columnas.map(col => {
                      switch (col.id) {
                        case 'codigo': return <td key={col.id} className="px-3 py-3 font-mono font-bold text-slate-400 whitespace-nowrap">{obra.codigo}</td>;
                        case 'titulo': return <td key={col.id} className="px-3 py-3 font-semibold text-white max-w-[16rem] truncate">{obra.titulo}</td>;
                        case 'cliente': return <td key={col.id} className="px-3 py-3 text-slate-300 max-w-[12rem] truncate">{obra.cliente}</td>;
                        case 'responsable': return <td key={col.id} className="px-3 py-3 text-slate-300 whitespace-nowrap">{obra.responsable || '—'}</td>;
                        case 'estado': return (
                          <td key={col.id} className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${est.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} />{est.label}
                            </span>
                          </td>
                        );
                        case 'fechaInicio': return <td key={col.id} className="px-3 py-3 text-slate-400 whitespace-nowrap">{obra.fechaInicio || '—'}</td>;
                        case 'fechaFinEstimada': return <td key={col.id} className="px-3 py-3 text-slate-400 whitespace-nowrap">{obra.fechaFinEstimada || '—'}</td>;
                        case 'progreso': return (
                          <td key={col.id} className="px-3 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${obra.estado === 'finalizada' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${obra.progreso || 0}%` }} />
                              </div>
                              <span className="tabular-nums font-semibold text-slate-300 w-8 text-right">{obra.progreso || 0}%</span>
                            </div>
                          </td>
                        );
                        case 'presupuestoTotal': return <td key={col.id} className="px-3 py-3 text-right font-bold text-white tabular-nums whitespace-nowrap">{eur(obra.presupuestoTotal)}</td>;
                        default: return <td key={col.id} className="px-3 py-3 text-right font-semibold text-emerald-400 tabular-nums">{obra.margenRealPct || 0}%</td>;
                      }
                    })}
                    <td className="px-2 text-slate-500 group-hover:text-slate-200 transition"><ChevronRight className="w-4 h-4" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
