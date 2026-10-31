import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarRange, Clock, Flag, Rocket, TrendingUp, ChartGantt } from 'lucide-react';
import EmptyState from '../Common/EmptyState';
import { toIsoDate, parseObraDate } from '../../services/obraBudgetSyncService';
import {
  calcularFilaCronograma,
  colorObra,
  escalaCronograma,
  rangoPreset,
  filaVisible,
  posicion,
  resumenCronograma,
  textoDesviacion,
  fechaCorta,
  inicioDia,
  ESTADOS_PLAZO
} from '../../utils/cronogramaObras';

const PRESETS = [
  { id: '4m', label: '4 meses' },
  { id: '6m', label: '6 meses' },
  { id: '12m', label: '12 meses' },
  { id: 'todo', label: 'Todas' }
];

const TONOS = {
  red: 'bg-red-500/10 text-red-400 border-red-500/30',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
  slate: 'bg-slate-800 text-slate-300 border-slate-700'
};

const RAYADO_RETRASO = 'repeating-linear-gradient(135deg, rgba(239,68,68,0.55) 0 5px, rgba(239,68,68,0.18) 5px 10px)';
const PX_DIA_MIN = 3;

function Kpi({ icon: Icon, label, valor, detalle, tono }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-start gap-3 min-w-0">
      <div className={`w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center ${TONOS[tono]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
        <p className="text-lg font-bold text-white leading-tight">{valor}</p>
        {detalle && <p className="text-[11px] text-slate-400 truncate">{detalle}</p>}
      </div>
    </div>
  );
}

function EstadoChip({ estado }) {
  const e = ESTADOS_PLAZO[estado];
  return (
    <span className={`inline-flex shrink-0 items-center px-1.5 py-px rounded-md border text-[10px] font-bold whitespace-nowrap ${TONOS[e.tono]}`}>
      {e.label}
    </span>
  );
}

// Detalle al pasar el ratón (o el foco) por una barra. Va en posición fija para que el
// desplazamiento horizontal del diagrama no lo recorte.
function Detalle({ fila, color, rect }) {
  const filas = [
    ['Inicio', fechaCorta(fila.inicio)],
    ['Fin planificado', fechaCorta(fila.finPlan)],
    ['Entrega al cliente', fechaCorta(fila.entrega)],
    [fila.finalizada ? 'Terminada' : 'Fin previsto (ritmo real)', fechaCorta(fila.finPrevisto)],
    ['Avance real', `${fila.progreso}%`],
    ['Avance según plan', `${fila.esperado}%`]
  ];
  const ANCHO = 240;
  const abajo = window.innerHeight - rect.bottom > 230;
  const pos = {
    left: Math.min(Math.max(8, rect.left), window.innerWidth - ANCHO - 8),
    ...(abajo ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 })
  };
  return (
    <div
      role="tooltip"
      className="fixed z-50 w-60 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl p-3 text-[11px] pointer-events-none"
      style={pos}
    >
      <p className="font-bold text-white text-xs flex items-center gap-1.5 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="truncate">{fila.obra.titulo}</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {filas.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-slate-200 font-medium text-right">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className={`mt-2 pt-1.5 border-t border-slate-800 font-semibold ${fila.desviacionDias > 0 ? 'text-red-400' : fila.desviacionDias < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
        {fila.desviacionDias > 0
          ? `${fila.desviacionDias} días de retraso sobre la entrega`
          : fila.desviacionDias < 0
          ? `${Math.abs(fila.desviacionDias)} días de adelanto sobre la entrega`
          : 'Justo en la fecha de entrega'}
      </p>
    </div>
  );
}

// onSeleccionar(id, color): al pulsar una obra (nombre o barra) se elige para ver su avance debajo.
// Sin onSeleccionar, el clic abre la ficha (onOpen).
export default function CronogramaObras({ obras, onOpen, onSeleccionar, seleccionadaId, hoy: hoyProp }) {
  const hoy = useMemo(() => inicioDia(hoyProp || new Date()), [hoyProp]);
  const [preset, setPreset] = useState('4m');
  const [rangoManual, setRangoManual] = useState(null); // { desde, hasta } si se eligen fechas a mano
  const [orden, setOrden] = useState('inicio');
  const [hover, setHover] = useState(null); // { id, rect } de la barra señalada
  const scrollRef = useRef(null);

  const todas = useMemo(() => {
    const filas = obras.map(o => calcularFilaCronograma(o, hoy));
    // El color va por el orden de inicio para que cada obra conserve el suyo al filtrar el periodo.
    [...filas].sort((a, b) => a.inicio - b.inicio || String(a.id).localeCompare(String(b.id)))
      .forEach((f, i) => { f.color = colorObra(f.obra, i); });
    return filas;
  }, [obras, hoy]);

  const { desde, hasta } = rangoManual || rangoPreset(preset, todas, hoy);
  const { totalDias, meses, marcas } = useMemo(() => escalaCronograma(desde, hasta), [desde.getTime(), hasta.getTime()]);

  const visibles = useMemo(() => {
    const v = todas.filter(f => filaVisible(f, desde, hasta));
    const orden2 = {
      inicio: (a, b) => a.inicio - b.inicio,
      entrega: (a, b) => a.entrega - b.entrega,
      retraso: (a, b) => b.desviacionDias - a.desviacionDias
    }[orden];
    return v.sort(orden2);
  }, [todas, desde.getTime(), hasta.getTime(), orden]);

  const resumen = useMemo(() => resumenCronograma(todas), [todas]);
  const ocultas = todas.length - visibles.length;
  const hoyVisible = hoy >= desde && hoy <= hasta;
  const hoyPct = posicion(hoy, desde, totalDias) + (100 / totalDias) / 2;

  // En pantallas estrechas el diagrama se desplaza: se centra en hoy al cambiar de periodo.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !hoyVisible || el.scrollWidth <= el.clientWidth) return;
    const etiqueta = el.querySelector('[data-columna-obra]')?.offsetWidth || 0;
    const hoyX = ((el.scrollWidth - etiqueta) * hoyPct) / 100; // dentro de la zona de fechas
    el.scrollLeft = Math.max(0, hoyX - (el.clientWidth - etiqueta) * 0.6);
  }, [desde.getTime(), hasta.getTime(), hoyVisible, hoyPct, visibles.length]);

  const cambiarFecha = (campo, valor) => {
    const d = parseObraDate(valor);
    if (!d) return;
    const actual = { desde, hasta, [campo]: inicioDia(d) };
    if (actual.hasta < actual.desde) {
      if (campo === 'desde') actual.hasta = actual.desde; else actual.desde = actual.hasta;
    }
    setRangoManual(actual);
  };

  if (obras.length === 0) {
    return (
      <EmptyState icon={ChartGantt} title="No hay obras que mostrar">
        Cambia la búsqueda o el filtro de estado para ver obras en el cronograma.
      </EmptyState>
    );
  }

  const clip = (v) => Math.min(100, Math.max(0, v));

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} tono="sky" label="En marcha" valor={resumen.activas}
          detalle={`${resumen.enPlazo} en plazo${resumen.adelanto ? ` · ${resumen.adelanto} adelantada${resumen.adelanto > 1 ? 's' : ''}` : ''}`} />
        <Kpi icon={AlertTriangle} tono="red" label="Con retraso" valor={resumen.retraso}
          detalle={resumen.retrasoMedio ? `Retraso medio ${resumen.retrasoMedio} días` : 'Ninguna pasada de fecha'} />
        <Kpi icon={Clock} tono="amber" label="En riesgo" valor={resumen.riesgo} detalle="Previsión justa o avance bajo" />
        <Kpi icon={Flag} tono="emerald" label="Próxima entrega"
          valor={resumen.proxima ? fechaCorta(resumen.proxima.entrega) : '—'}
          detalle={resumen.proxima ? `${resumen.proxima.obra.titulo} · ${resumen.proxima.diasParaEntrega === 0 ? 'hoy' : `en ${resumen.proxima.diasParaEntrega} días`}` : 'Sin entregas pendientes'} />
      </div>

      {/* Selector de periodo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarRange className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-300 mr-1">Periodo</span>
          {PRESETS.map(p => {
            const activo = !rangoManual && preset === p.id;
            return (
              <button key={p.id} type="button" onClick={() => { setPreset(p.id); setRangoManual(null); }}
                aria-pressed={activo}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${activo ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Desde
            <input type="date" value={toIsoDate(desde)} onChange={e => cambiarFecha('desde', e.target.value)}
              className={`bg-slate-800 border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 ${rangoManual ? 'border-amber-500/60' : 'border-slate-700'}`} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Hasta
            <input type="date" value={toIsoDate(hasta)} onChange={e => cambiarFecha('hasta', e.target.value)}
              className={`bg-slate-800 border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 ${rangoManual ? 'border-amber-500/60' : 'border-slate-700'}`} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            Ordenar
            <select value={orden} onChange={e => setOrden(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400">
              <option value="inicio">Por inicio</option>
              <option value="entrega">Por entrega</option>
              <option value="retraso">Más retrasadas</option>
            </select>
          </label>
        </div>
      </div>

      {/* Diagrama */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {visibles.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Ninguna obra cae dentro de este periodo.</div>
        ) : (
          <div className="overflow-x-auto" ref={scrollRef}>
            <div style={{ minWidth: `calc(8rem + ${totalDias * PX_DIA_MIN}px)` }}>
              {/* Cabecera: meses y días 1 / 15 / fin */}
              <div className="flex border-b border-slate-800 bg-slate-950/60">
                <div data-columna-obra className="w-32 sm:w-56 shrink-0 sticky left-0 z-20 bg-slate-950 border-r border-slate-800 px-3 flex items-end pb-1.5">
                  <span className="text-[11px] uppercase tracking-wide font-bold text-slate-500">Obra</span>
                </div>
                <div className="relative flex-1 h-14">
                  {meses.map(m => (
                    <div key={m.key} className="absolute top-0 h-6 flex items-center px-1.5 border-l border-slate-700 overflow-hidden"
                      style={{ left: `${m.izquierda}%`, width: `${m.ancho}%` }}>
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300 truncate">
                        {m.label}{m.anio !== hoy.getFullYear() ? ` ${String(m.anio).slice(2)}` : ''}
                      </span>
                    </div>
                  ))}
                  {marcas.map(t => (
                    <span key={t.key} className={`absolute top-7 text-[10px] tabular-nums -translate-x-1/2 ${t.inicioMes ? 'text-slate-300 font-semibold' : 'text-slate-500'}`}
                      style={{ left: `${t.izquierda + (100 / totalDias) / 2}%` }}>
                      {t.dia}
                    </span>
                  ))}
                  {hoyVisible && (
                    <span className="absolute bottom-0 -translate-x-1/2 px-1.5 rounded-t bg-red-500 text-[9px] font-bold uppercase tracking-wide z-10"
                      style={{ left: `${hoyPct}%`, color: '#fff' }}>Hoy</span>
                  )}
                </div>
              </div>

              {/* Filas */}
              {visibles.map(f => {
                const izq = clip(posicion(f.inicio, desde, totalDias));
                const der = clip(posicion(f.finPlan, desde, totalDias, true));
                const cortadoIzq = f.inicio < desde;
                const cortadoDer = f.finPlan > hasta;
                const ancho = Math.max(0, der - izq);
                // Fin del avance real dentro del plan, para que el relleno sea correcto aunque la barra esté cortada.
                const durPlan = (f.finPlan - f.inicio) / 86400000 + 1;
                const finAvancePct = clip(posicion(f.inicio, desde, totalDias) + (durPlan * f.progreso / 100 / totalDias) * 100);
                const anchoProgreso = ancho > 0 ? Math.max(0, Math.min(100, ((finAvancePct - izq) / ancho) * 100)) : 0;
                const tarde = f.finPrevisto > f.finPlan;
                const extIzq = der;
                const extDer = tarde ? clip(posicion(f.finPrevisto, desde, totalDias, true)) : der;
                const temprano = f.finPrevisto < f.finPlan && f.finPrevisto >= desde && f.finPrevisto <= hasta;
                const entregaPct = posicion(f.entrega, desde, totalDias, true);
                const mostrarEntrega = f.entrega.getTime() !== f.finPlan.getTime() && entregaPct >= 0 && entregaPct <= 100;
                const señalada = hover?.id === f.id;
                const señalar = (e) => setHover({ id: f.id, rect: e.currentTarget.getBoundingClientRect() });
                const elegida = seleccionadaId === f.id;
                const elegir = () => (onSeleccionar ? onSeleccionar(f.id, f.color) : onOpen?.(f.id));
                const r = (izqCort, derCort) => `${izqCort ? '0' : '9999px'} ${derCort ? '0' : '9999px'} ${derCort ? '0' : '9999px'} ${izqCort ? '0' : '9999px'}`;

                return (
                  <div key={f.id} className={`flex border-b border-slate-800/70 last:border-b-0 group ${señalada || elegida ? 'bg-slate-800/30' : ''}`}>
                    <button type="button" onClick={elegir} aria-pressed={onSeleccionar ? elegida : undefined}
                      title={onSeleccionar ? 'Ver el avance de esta obra' : 'Abrir la obra'}
                      className={`w-32 sm:w-56 shrink-0 sticky left-0 z-20 border-r border-slate-800 px-3 py-2 text-left hover:bg-slate-800 transition-colors ${elegida ? 'bg-slate-800' : 'bg-slate-900'}`}
                      style={elegida ? { boxShadow: `inset 3px 0 0 ${f.color}` } : undefined}>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color }} />
                        <span className={`text-xs font-bold truncate group-hover:text-amber-400 ${elegida ? 'text-amber-400' : 'text-white'}`}>{f.obra.titulo}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
                        <EstadoChip estado={f.estado} />
                        {f.estado !== 'por_empezar' && (
                          <span className={`shrink-0 whitespace-nowrap text-[10px] font-bold tabular-nums ${f.desviacionDias > 0 ? 'text-red-400' : f.desviacionDias < 0 ? 'text-emerald-400' : 'text-slate-400'}`}
                            title="Previsión de fin frente a la fecha de entrega al cliente">
                            {textoDesviacion(f.desviacionDias)}
                          </span>
                        )}
                        <span className="hidden sm:inline min-w-0 text-[10px] text-slate-500 truncate">{f.obra.cliente}</span>
                      </span>
                    </button>

                    <div className="relative flex-1 h-14">
                      {/* Rejilla */}
                      {marcas.map(t => (
                        <span key={t.key} className={`absolute inset-y-0 border-l ${t.inicioMes ? 'border-slate-700/70' : 'border-dashed border-slate-800'}`}
                          style={{ left: `${t.izquierda}%` }} aria-hidden="true" />
                      ))}

                      {/* Tramo planificado con el avance real dentro */}
                      {ancho > 0 && (
                        <button type="button" onClick={elegir}
                          onMouseEnter={señalar} onMouseLeave={() => setHover(null)}
                          onFocus={señalar} onBlur={() => setHover(null)}
                          aria-label={`${f.obra.titulo}: del ${fechaCorta(f.inicio)} al ${fechaCorta(f.finPlan)}, avance ${f.progreso}%`}
                          className="absolute top-1/2 -translate-y-1/2 h-7 overflow-hidden cursor-pointer transition-shadow hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          style={{
                            left: `${izq}%`,
                            width: `${ancho}%`,
                            background: `${f.color}2e`,
                            border: `1.5px solid ${f.color}`,
                            borderRadius: r(cortadoIzq, cortadoDer || tarde)
                          }}>
                          <span className="absolute inset-y-0 left-0" style={{ width: `${anchoProgreso}%`, background: f.color, opacity: f.finalizada ? 0.75 : 1 }} />
                          <span className="relative z-10 h-full flex items-center px-2 text-[11px] font-bold whitespace-nowrap"
                            style={anchoProgreso >= 18 ? { color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.65)' } : { color: f.color }}>
                            {f.progreso}%
                          </span>
                        </button>
                      )}

                      {/* Retraso previsto: más allá del fin planificado */}
                      {tarde && extDer > extIzq && (
                        <span className="absolute top-1/2 -translate-y-1/2 h-7 pointer-events-none"
                          title={`Previsión de fin: ${fechaCorta(f.finPrevisto)}`}
                          style={{
                            left: `${extIzq}%`,
                            width: `${extDer - extIzq}%`,
                            background: RAYADO_RETRASO,
                            border: '1.5px dashed #ef4444',
                            borderLeft: 'none',
                            borderRadius: f.finPrevisto > hasta ? '0' : '0 9999px 9999px 0'
                          }} />
                      )}

                      {/* Adelanto: la previsión termina antes que lo planificado */}
                      {temprano && !f.finalizada && (
                        <span className="absolute top-1.5 bottom-1.5 w-0 border-l-2 border-emerald-400 pointer-events-none"
                          style={{ left: `${posicion(f.finPrevisto, desde, totalDias, true)}%` }}>
                          <Rocket className="w-3 h-3 text-emerald-400 absolute -top-1 left-0.5" />
                        </span>
                      )}

                      {/* Fecha de entrega al cliente */}
                      {mostrarEntrega && (
                        <span className="absolute bottom-0.5 -translate-x-1/2 pointer-events-none" style={{ left: `${entregaPct}%` }}
                          title={`Entrega al cliente: ${fechaCorta(f.entrega)}`}>
                          <span className="block w-2.5 h-2.5 rotate-45 bg-slate-200 border border-slate-500" />
                        </span>
                      )}

                      {/* Hoy */}
                      {hoyVisible && (
                        <span className="absolute inset-y-0 w-0.5 bg-red-500/80 pointer-events-none z-10" style={{ left: `${hoyPct}%` }} aria-hidden="true" />
                      )}

                      {señalada && <Detalle fila={f} color={f.color} rect={hover.rect} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-400 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-8 h-3 rounded-full overflow-hidden flex border border-sky-500" style={{ background: '#3b82f62e' }}>
            <span className="w-1/2 h-full bg-sky-500" style={{ background: '#3b82f6' }} />
          </span>
          Plan de obra (relleno = avance real)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-3 rounded-r-full border border-dashed border-red-500" style={{ background: RAYADO_RETRASO }} />
          Retraso previsto
        </span>
        <span className="flex items-center gap-1.5"><Rocket className="w-3.5 h-3.5 text-emerald-400" /> Terminará antes de lo planificado</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 bg-slate-200 border border-slate-500" /> Entrega al cliente</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3.5 bg-red-500" /> Hoy</span>
        {ocultas > 0 && (
          <span className="ml-auto text-slate-500">{ocultas} obra{ocultas > 1 ? 's' : ''} fuera de este periodo</span>
        )}
      </div>
    </div>
  );
}
