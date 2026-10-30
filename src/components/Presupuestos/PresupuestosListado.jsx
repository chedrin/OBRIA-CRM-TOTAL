import React, { useMemo, useState } from 'react';
import {
  Sparkles,
  FileText,
  Send,
  Receipt,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HardHat,
  Filter,
  X,
  BadgeCheck
} from 'lucide-react';
import { useUiPreferences } from '../../context/UiPreferencesContext';
import BarraFacturacion from '../Facturas/BarraFacturacion';

// Estados del ciclo de vida del presupuesto agrupados para el Kanban.
export const PRESUPUESTO_COLUMNAS = [
  { id: 'borrador', label: 'Borrador', estados: ['borrador', 'borrador_ia'], dot: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { id: 'enviado', label: 'Enviado al cliente', estados: ['enviado_cliente'], dot: 'bg-sky-500', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  { id: 'aceptado', label: 'Aceptado · en obra', estados: ['aceptado', 'firmado'], dot: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'facturado', label: 'Facturado', estados: ['facturado'], dot: 'bg-purple-500', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' }
];

const columnaDe = (estado) => PRESUPUESTO_COLUMNAS.find(c => c.estados.includes(estado)) || PRESUPUESTO_COLUMNAS[0];

const ESTADO_LABEL = {
  borrador: 'Borrador',
  borrador_ia: 'Borrador IA',
  enviado_cliente: 'Enviado',
  aceptado: 'Aceptado',
  firmado: 'Firmado',
  facturado: 'Facturado'
};

const eur = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function EstadoBadge({ estado }) {
  const col = columnaDe(estado);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${col.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
      {ESTADO_LABEL[estado] || estado}
    </span>
  );
}

// Presupuesto modificado después de aprobarlo.
export function RevisionBadge({ pres }) {
  if (!pres.revisado) return null;
  return (
    <span
      title={pres.pendienteNuevaAceptacion ? `Revisado el ${pres.fechaRevision}. Falta la nueva aceptación del cliente.` : `Revisado el ${pres.fechaRevision}. Aceptado de nuevo el ${pres.fechaNuevaAceptacion}.`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${pres.pendienteNuevaAceptacion ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}
    >
      Rev. {pres.revisionNumero || 1}{pres.pendienteNuevaAceptacion ? ' · falta aceptación' : ''}
    </span>
  );
}

// Acciones de un presupuesto. "icon" = solo iconos (tablas); "full" = con texto (tarjetas).
function Acciones({ pres, size = 'full', handlers, nowrap = false }) {
  const facturadoEntero = Boolean(handlers.facturacionDe?.(pres)?.completo);
  const aceptable = !['aceptado', 'firmado', 'facturado'].includes(pres.estado);
  const iconOnly = size === 'icon';
  const base = `inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition active:scale-95 ${iconOnly ? 'w-8 h-8' : 'px-2.5 py-1.5'}`;
  return (
    <div className={`flex items-center gap-1.5 ${nowrap ? 'flex-nowrap' : 'flex-wrap'}`} onClick={(e) => e.stopPropagation()}>
      {!aceptable && pres.pendienteNuevaAceptacion && handlers.onNuevaAceptacion && (
        <button
          onClick={() => handlers.onNuevaAceptacion(pres)}
          title={`Revisado el ${pres.fechaRevision}: registrar la nueva aceptación del cliente`}
          className={`${base} bg-violet-500 hover:bg-violet-400 text-white font-bold shadow-sm`}
        >
          <BadgeCheck className="w-3.5 h-3.5" />
          {!iconOnly && <span>Nueva aceptación</span>}
        </button>
      )}
      {aceptable && (
        <button
          onClick={() => handlers.onAceptar(pres)}
          title="El cliente acepta: convertir en obra"
          className={`${base} bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm`}
        >
          <HardHat className="w-3.5 h-3.5" />
          {!iconOnly && <span>Aceptar → Obra</span>}
        </button>
      )}
      <button onClick={() => handlers.onRevisar(pres)} title="Consola de revisión IA" className={`${base} bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20`}>
        <Sparkles className="w-3.5 h-3.5" />
        {!iconOnly && <span>Revisar</span>}
      </button>
      <button onClick={() => handlers.onPdf(pres)} title="Ver PDF" className={`${base} bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700`}>
        <FileText className="w-3.5 h-3.5" />
        {!iconOnly && <span>PDF</span>}
      </button>
      <button onClick={() => handlers.onEnviar(pres)} title="Enviar por email / WhatsApp" className={`${base} bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700`}>
        <Send className="w-3.5 h-3.5" />
        {!iconOnly && <span>Enviar</span>}
      </button>
      {handlers.onFacturar && (
        <button
          onClick={() => handlers.onFacturar(pres)}
          disabled={facturadoEntero}
          title={facturadoEntero ? 'Ya está facturado al 100 %' : 'Pasar a factura'}
          className={`${base} bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Receipt className="w-3.5 h-3.5" />
          {!iconOnly && <span>{facturadoEntero ? 'Facturado' : 'Facturar'}</span>}
        </button>
      )}
    </div>
  );
}

function VistaKanban({ items, handlers }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {PRESUPUESTO_COLUMNAS.map(col => {
        const colItems = items.filter(p => col.estados.includes(p.estado) || (col.id === 'borrador' && !PRESUPUESTO_COLUMNAS.some(c => c.estados.includes(p.estado))));
        const total = colItems.reduce((s, p) => s + Number(p.totalConIva || 0), 0);
        return (
          <section key={col.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col min-h-[8rem]">
            <header className="flex items-center justify-between px-1 pb-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                {col.label}
                <span className="text-slate-500 font-semibold">{colItems.length}</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">{eur(total)}</span>
            </header>
            <div className="space-y-2.5 flex-1">
              {colItems.length === 0 && (
                <p className="text-[11px] text-slate-500 text-center py-6 border border-dashed border-slate-800 rounded-xl">Sin presupuestos</p>
              )}
              {colItems.map(pres => (
                <article
                  key={pres.id}
                  onClick={() => handlers.onRevisar(pres)}
                  className="group bg-slate-900 border border-slate-800 rounded-xl p-3 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-700 animate-in fade-in"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold text-slate-400">{pres.numero}</span>
                    <span className="text-[10px] text-slate-500">{pres.fecha}</span>
                  </div>
                  <h4 className="mt-1 text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-indigo-400 transition-colors">{pres.obraTitulo}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{pres.cliente}</p>
                  {pres.revisado && <div className="mt-1.5"><RevisionBadge pres={pres} /></div>}
                  <div className="flex items-end justify-between mt-2.5">
                    <span className="text-[10px] text-slate-500">{pres.partidas?.length || 0} partidas</span>
                    <span className="text-sm font-black text-white tabular-nums">{eur(pres.totalConIva)}</span>
                  </div>
                  {handlers.facturacionDe?.(pres)?.facturado > 0 && (
                    <BarraFacturacion estado={handlers.facturacionDe(pres)} compacta className="mt-2" />
                  )}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800">
                    <Acciones pres={pres} size="icon" handlers={handlers} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const COLUMNAS_TABLA = [
  { id: 'numero', label: 'Nº', get: p => p.numero || '' },
  { id: 'fecha', label: 'Fecha', get: p => p.fecha || '' },
  { id: 'obraTitulo', label: 'Obra', get: p => (p.obraTitulo || '').toLowerCase() },
  { id: 'cliente', label: 'Cliente', get: p => (p.cliente || '').toLowerCase() },
  { id: 'estado', label: 'Estado', get: p => PRESUPUESTO_COLUMNAS.indexOf(columnaDe(p.estado)) },
  { id: 'baseImponible', label: 'Base', get: p => Number(p.baseImponible || 0), num: true },
  { id: 'totalConIva', label: 'Total', get: p => Number(p.totalConIva || 0), num: true },
  { id: 'facturado', label: 'Facturado', get: () => 0, noSort: true }
];

function VistaTabla({ items, handlers, compact, sort, onSort }) {
  const visibles = compact ? COLUMNAS_TABLA.filter(c => c.id !== 'baseImponible') : COLUMNAS_TABLA;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full text-left ${compact ? 'text-[11px] om-table-compact' : 'text-xs'}`}>
          <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
            <tr>
              {visibles.map(col => {
                const active = sort.by === col.id;
                const SortIcon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                if (col.noSort) return <th key={col.id} className="px-3 py-2.5 font-bold whitespace-nowrap">{col.label}</th>;
                return (
                  <th key={col.id} className={`px-3 py-2.5 font-bold whitespace-nowrap ${col.num ? 'text-right' : ''}`}>
                    <button type="button" onClick={() => onSort(col.id)} className={`inline-flex items-center gap-1 hover:text-slate-200 transition ${active ? 'text-slate-200' : ''}`}>
                      {col.label}
                      <SortIcon className="w-3 h-3" />
                    </button>
                  </th>
                );
              })}
              <th className="px-3 py-2.5 font-bold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {items.map(pres => (
              <tr key={pres.id} onClick={() => handlers.onRevisar(pres)} className="hover:bg-slate-800/60 cursor-pointer transition-colors">
                {visibles.map(col => {
                  if (col.id === 'numero') return <td key={col.id} className="px-3 py-3 font-mono font-bold text-slate-400 whitespace-nowrap">{pres.numero}</td>;
                  if (col.id === 'fecha') return <td key={col.id} className="px-3 py-3 text-slate-400 whitespace-nowrap">{pres.fecha}</td>;
                  if (col.id === 'obraTitulo') return <td key={col.id} className="px-3 py-3 font-semibold text-white max-w-[16rem] truncate">{pres.obraTitulo}</td>;
                  if (col.id === 'cliente') return <td key={col.id} className="px-3 py-3 text-slate-300 max-w-[12rem] truncate">{pres.cliente}</td>;
                  if (col.id === 'estado') return <td key={col.id} className="px-3 py-3"><div className="flex flex-wrap items-center gap-1"><EstadoBadge estado={pres.estado} /><RevisionBadge pres={pres} /></div></td>;
                  if (col.id === 'baseImponible') return <td key={col.id} className="px-3 py-3 text-right text-slate-300 tabular-nums whitespace-nowrap">{eur(pres.baseImponible)}</td>;
                  if (col.id === 'facturado') {
                    const estado = handlers.facturacionDe?.(pres);
                    return <td key={col.id} className="px-3 py-2 min-w-[11rem]">{estado?.facturado > 0 ? <BarraFacturacion estado={estado} compacta /> : <span className="text-slate-600">—</span>}</td>;
                  }
                  return <td key={col.id} className="px-3 py-3 text-right font-bold text-white tabular-nums whitespace-nowrap">{eur(pres.totalConIva)}</td>;
                })}
                <td className="px-3 py-2">
                  <div className="flex justify-end">
                    <Acciones pres={pres} size="icon" handlers={handlers} nowrap />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Listado de presupuestos guardados en la vista elegida por el usuario (tarjetas, compacta o clásica).
export default function PresupuestosListado({ presupuestos, handlers }) {
  const { viewMode } = useUiPreferences();
  const [query, setQuery] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [importeMin, setImporteMin] = useState('');
  const [sort, setSort] = useState({ by: 'fecha', dir: 'desc' });

  const isClasica = viewMode === 'clasica';

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = presupuestos.filter(p => {
      if (q && ![p.numero, p.obraTitulo, p.cliente, p.direccion, p.nif].some(v => String(v || '').toLowerCase().includes(q))) return false;
      if (estadoFiltro !== 'todos' && columnaDe(p.estado).id !== estadoFiltro) return false;
      if (isClasica) {
        if (desde && (p.fecha || '') < desde) return false;
        if (hasta && (p.fecha || '') > hasta) return false;
        if (importeMin && Number(p.totalConIva || 0) < Number(importeMin)) return false;
      }
      return true;
    });
    if (viewMode !== 'tarjetas') {
      const col = COLUMNAS_TABLA.find(c => c.id === sort.by) || COLUMNAS_TABLA[1];
      list = [...list].sort((a, b) => {
        const va = col.get(a);
        const vb = col.get(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [presupuestos, query, estadoFiltro, desde, hasta, importeMin, sort, viewMode, isClasica]);

  const toggleSort = (by) => setSort(prev => ({ by, dir: prev.by === by && prev.dir === 'desc' ? 'asc' : 'desc' }));
  const hayFiltrosAvanzados = desde || hasta || importeMin;

  return (
    <div className="space-y-3">
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, obra, cliente o NIF..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {[{ id: 'todos', label: 'Todos' }, ...PRESUPUESTO_COLUMNAS].map(f => (
            <button
              key={f.id}
              onClick={() => setEstadoFiltro(f.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                estadoFiltro === f.id ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isClasica && (
        <div className="flex flex-wrap items-end gap-3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs animate-in fade-in">
          <span className="flex items-center gap-1.5 text-slate-400 font-semibold self-center"><Filter className="w-3.5 h-3.5" />Filtros avanzados</span>
          <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 uppercase font-bold">
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white normal-case font-normal" />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 uppercase font-bold">
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white normal-case font-normal" />
          </label>
          <label className="flex flex-col gap-0.5 text-[10px] text-slate-500 uppercase font-bold">
            Importe mínimo (€)
            <input type="number" min="0" value={importeMin} onChange={(e) => setImporteMin(e.target.value)} className="w-28 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white normal-case font-normal" />
          </label>
          {hayFiltrosAvanzados && (
            <button onClick={() => { setDesde(''); setHasta(''); setImporteMin(''); }} className="flex items-center gap-1 text-slate-400 hover:text-white self-center">
              <X className="w-3.5 h-3.5" />Limpiar
            </button>
          )}
          <span className="ml-auto self-center text-slate-500">
            {filtrados.length} de {presupuestos.length} · Total {eur(filtrados.reduce((s, p) => s + Number(p.totalConIva || 0), 0))}
          </span>
        </div>
      )}

      {presupuestos.length > 0 && filtrados.length === 0 && (
        <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-2xl">
          Ningún presupuesto coincide con la búsqueda.
        </div>
      )}

      {filtrados.length > 0 && (viewMode === 'tarjetas'
        ? <VistaKanban items={filtrados} handlers={handlers} />
        : <VistaTabla items={filtrados} handlers={handlers} compact={viewMode === 'compacta'} sort={sort} onSort={toggleSort} />
      )}
    </div>
  );
}

