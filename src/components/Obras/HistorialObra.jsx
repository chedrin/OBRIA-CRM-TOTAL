import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  UserPlus,
  TrendingUp,
  Truck,
  Package,
  Tractor,
  PhoneCall,
  FileText,
  CalendarClock,
  AlertTriangle,
  ClipboardList,
  FolderOpen,
  StickyNote,
  History,
  Pencil,
  Trash2,
  Search,
  Plus,
  X,
  RefreshCw
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import ModalOverlay from '../Common/ModalOverlay';
import AiImprovementControl from '../Common/AiImprovementControl';
import {
  TIPOS_HISTORIAL,
  TIPOS_MANUALES,
  tipoInfo,
  agruparPorDia,
  filtrarEventos,
  contarPorTipo,
  diaLocal,
  unificarEventos
} from '../../utils/historialObra';
import {
  EVENTO_HISTORIAL,
  cargarHistorial,
  apuntarSuceso,
  corregirSuceso,
  quitarSuceso
} from '../../services/historialService';

const ICONOS = {
  asignacion: UserPlus,
  avance: TrendingUp,
  pedido: Truck,
  material: Package,
  maquinaria: Tractor,
  llamada: PhoneCall,
  presupuesto: FileText,
  plazo: CalendarClock,
  incidencia: AlertTriangle,
  parte: ClipboardList,
  documento: FolderOpen,
  nota: StickyNote
};

// Clases fijas (Tailwind no ve clases montadas con variables).
const COLOR = {
  sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  violet: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  pink: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  teal: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  slate: 'bg-slate-500/15 text-slate-300 border-slate-500/30'
};

const RANGOS = [
  { id: '7', label: 'Últimos 7 días' },
  { id: '30', label: 'Últimos 30 días' },
  { id: 'todo', label: 'Todo' },
  { id: 'fechas', label: 'Entre fechas' }
];

const MEDIOS = ['Llamada recibida', 'Llamada hecha', 'Visita a obra', 'WhatsApp', 'Correo'];

const PLACEHOLDER = {
  llamada: 'Ej.: pide cambiar el azulejo del baño por uno más claro',
  material: 'Ej.: alicatado del baño principal',
  maquinaria: 'Ej.: retirada de escombro',
  incidencia: 'Ej.: rotura de bajante al picar la cocina',
  parte: 'Ej.: se terminan las rozas de electricidad',
  pedido: 'Ej.: pedido de yeso por teléfono a Obramat',
  avance: 'Ej.: solado del salón terminado',
  nota: 'Ej.: el portero pide no usar el ascensor por la mañana'
};

const hoyIso = () => diaLocal(new Date().toISOString());
const horaAhora = () => new Date().toTimeString().slice(0, 5);
const restarDias = (n) => diaLocal(new Date(Date.now() - n * 86400000).toISOString());
const conItems = (tipo) => ['material', 'maquinaria', 'pedido'].includes(tipo);
const unidadPorDefecto = (tipo) => (tipo === 'maquinaria' ? 'h' : 'ud');

function tituloDia(dia) {
  if (!dia) return 'Sin fecha';
  const [y, m, d] = dia.split('-').map(Number);
  const texto = new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const prefijo = dia === hoyIso() ? 'Hoy · ' : dia === restarDias(1) ? 'Ayer · ' : '';
  return prefijo + texto.charAt(0).toUpperCase() + texto.slice(1);
}

function horaDe(fecha) {
  if (!fecha || /^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return '';
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? '' : d.toTimeString().slice(0, 5);
}

function formularioVacio(obra, tipo = 'llamada') {
  return {
    id: null,
    tipo,
    dia: hoyIso(),
    hora: horaAhora(),
    titulo: '',
    detalle: '',
    contacto: obra?.cliente || '',
    medio: MEDIOS[0],
    clima: '',
    operarios: '',
    items: [{ concepto: '', cantidad: '', unidad: unidadPorDefecto(tipo) }]
  };
}

function formularioDesde(evento, obra) {
  const d = new Date(evento.fecha);
  const base = formularioVacio(obra, evento.tipo);
  return {
    ...base,
    id: evento.id,
    dia: diaLocal(evento.fecha),
    hora: Number.isNaN(d.getTime()) ? base.hora : d.toTimeString().slice(0, 5),
    titulo: evento.titulo || '',
    detalle: evento.detalle || '',
    contacto: evento.datos?.contacto ?? base.contacto,
    medio: evento.datos?.medio || base.medio,
    clima: evento.datos?.clima || '',
    operarios: (evento.datos?.operarios || []).join(', '),
    items: evento.datos?.items?.length ? evento.datos.items.map(i => ({ ...i, cantidad: i.cantidad ?? '' })) : base.items
  };
}

// Resumen por defecto si no se escribe uno.
function tituloPorDefecto(f, items) {
  const lista = items.map(i => i.concepto).join(', ');
  switch (f.tipo) {
    case 'llamada': return `${f.medio}${f.contacto ? ` · ${f.contacto}` : ''}`;
    case 'material': return lista ? `Material utilizado: ${lista}` : '';
    case 'maquinaria': return lista ? `Maquinaria: ${lista}` : '';
    case 'pedido': return lista ? `Material pedido: ${lista}` : '';
    case 'parte': return 'Parte diario';
    default: return '';
  }
}

export default function HistorialObra({ obra }) {
  const [eventos, setEventos] = useState([]);
  const [faltan, setFaltan] = useState([]);
  const [listo, setListo] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tipos, setTipos] = useState(() => new Set());
  const [texto, setTexto] = useState('');
  const [rango, setRango] = useState('30');
  const [desde, setDesde] = useState(restarDias(30));
  const [hasta, setHasta] = useState(hoyIso());
  const [diasVisibles, setDiasVisibles] = useState(15);
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState('');

  const cargar = useCallback(async () => {
    if (!obra?.id) return;
    setError('');
    try {
      const data = await cargarHistorial(obra.id);
      setEventos(unificarEventos(data.eventos));
      setFaltan(data.faltan || []);
      setListo(data.listo !== false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [obra?.id]);

  useEffect(() => {
    setCargando(true);
    cargar();
  }, [cargar]);

  // Lo que la app registra sola (asignar, pedir, cambiar plazos...) refresca la lista.
  useEffect(() => {
    const alCambiar = (e) => { if (e.detail?.obraId === obra?.id) cargar(); };
    window.addEventListener(EVENTO_HISTORIAL, alCambiar);
    return () => window.removeEventListener(EVENTO_HISTORIAL, alCambiar);
  }, [obra?.id, cargar]);

  const limites = useMemo(() => {
    if (rango === 'todo') return { desde: '', hasta: '' };
    // Si se ponen al revés, se entiende el periodo igual.
    if (rango === 'fechas') return desde && hasta && desde > hasta ? { desde: hasta, hasta: desde } : { desde, hasta };
    return { desde: restarDias(Number(rango) - 1), hasta: '' };
  }, [rango, desde, hasta]);

  const enRango = useMemo(() => filtrarEventos(eventos, { texto, ...limites }), [eventos, texto, limites]);
  const conteo = useMemo(() => contarPorTipo(enRango), [enRango]);
  const visibles = useMemo(() => filtrarEventos(enRango, { tipos }), [enRango, tipos]);
  const grupos = useMemo(() => agruparPorDia(visibles), [visibles]);

  const alternarTipo = (id) => setTipos(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const abrirNuevo = (tipo = 'llamada') => { setErrorForm(''); setForm(formularioVacio(obra, tipo)); };
  const abrirEdicion = (ev) => { setErrorForm(''); setForm(formularioDesde(ev, obra)); };
  const campo = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const cambiarTipo = (tipo) => setForm(f => ({
    ...f,
    tipo,
    items: f.items.map(i => (i.concepto ? i : { ...i, unidad: unidadPorDefecto(tipo) }))
  }));
  const cambiarItem = (idx, k, v) => setForm(f => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)) }));
  const anadirItem = () => setForm(f => ({ ...f, items: [...f.items, { concepto: '', cantidad: '', unidad: unidadPorDefecto(f.tipo) }] }));
  const quitarItem = (idx) => setForm(f => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, i) => i !== idx) : f.items }));

  const guardar = async (e) => {
    e.preventDefault();
    const items = conItems(form.tipo)
      ? form.items.filter(i => i.concepto.trim()).map(i => ({ concepto: i.concepto.trim(), cantidad: i.cantidad === '' ? null : Number(i.cantidad), unidad: i.unidad }))
      : [];
    const titulo = form.titulo.trim() || tituloPorDefecto(form, items);
    if (!titulo) {
      setErrorForm('Escribe un resumen de lo que ha pasado.');
      return;
    }
    const datos = {};
    if (items.length) datos.items = items;
    if (form.tipo === 'llamada') Object.assign(datos, { contacto: form.contacto.trim(), medio: form.medio });
    if (form.tipo === 'parte') Object.assign(datos, { clima: form.clima.trim(), operarios: form.operarios.split(',').map(s => s.trim()).filter(Boolean) });
    const suceso = {
      tipo: form.tipo,
      titulo,
      detalle: form.detalle.trim(),
      fecha: new Date(`${form.dia}T${form.hora || '12:00'}:00`).toISOString(),
      datos
    };
    setGuardando(true);
    setErrorForm('');
    try {
      if (form.id) await corregirSuceso(form.id, suceso);
      else await apuntarSuceso(obra.id, suceso);
      setForm(null);
      await cargar();
    } catch (err) {
      setErrorForm(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (ev) => {
    if (!window.confirm('¿Quitar este apunte del histórico?')) return;
    try {
      await quitarSuceso(ev.id);
      setEventos(prev => prev.filter(x => x.id !== ev.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const campoCls = 'bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400';
  const inputCls = `w-full ${campoCls}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <span>Histórico diario de la obra</span>
          </h3>
          <p className="text-xs text-slate-400">
            Todo lo que afecta a la obra, día a día: asignaciones, pedidos, avance, llamadas, presupuesto, plazos, material y maquinaria.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { setCargando(true); cargar(); }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Actualizar"
            aria-label="Actualizar histórico"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => abrirNuevo()}
            disabled={!listo}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Apuntar suceso</span>
          </button>
        </div>
      </div>

      {!listo && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300">
          Para apuntar llamadas, material, maquinaria y que la app guarde sola los cambios de plazos y presupuesto,
          ejecuta <strong>supabase_schema_historial_obra.sql</strong> en Supabase (SQL Editor). Mientras tanto se ve lo que ya
          guardan las asignaciones, el avance y los pedidos.
        </div>
      )}
      {faltan.filter(f => f !== 'supabase_schema_historial_obra.sql').length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-400">
          Faltan otras migraciones para ver todo: {faltan.filter(f => f !== 'supabase_schema_historial_obra.sql').join(', ')}.
        </div>
      )}
      {error && <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300">{error}</div>}

      {/* Accesos rápidos */}
      <div className="flex flex-wrap gap-2">
        {['llamada', 'material', 'maquinaria', 'incidencia', 'parte'].map(id => {
          const Icono = ICONOS[id];
          return (
            <button
              key={id}
              onClick={() => abrirNuevo(id)}
              disabled={!listo}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-amber-500/40 disabled:opacity-50 rounded-xl text-xs text-slate-300 flex items-center gap-1.5 transition"
            >
              <Icono className="w-3.5 h-3.5" />
              <span>{id === 'llamada' ? 'Llamada del cliente' : tipoInfo(id).label}</span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar en el histórico"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
          <select value={rango} onChange={(e) => setRango(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white">
            {RANGOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {rango === 'fechas' && (
            <div className="flex gap-2">
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" aria-label="Desde" />
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white" aria-label="Hasta" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTipos(new Set())}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition ${tipos.size === 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
            Todo ({enRango.length})
          </button>
          {TIPOS_HISTORIAL.filter(t => conteo[t.id] || tipos.has(t.id)).map(t => {
            const activo = tipos.has(t.id);
            return (
              <button
                key={t.id}
                onClick={() => alternarTipo(t.id)}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition ${activo ? COLOR[t.color] : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
              >
                {t.label} ({conteo[t.id] || 0})
              </button>
            );
          })}
        </div>
      </div>

      {/* Días */}
      {cargando && !eventos.length ? (
        <p className="text-xs text-slate-500 py-6 text-center">Cargando el histórico…</p>
      ) : grupos.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
          <History className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-300">No hay sucesos {eventos.length ? 'con estos filtros' : 'todavía en esta obra'}.</p>
          <p className="text-xs text-slate-500">Las asignaciones, pedidos, avances y cambios de plazos o presupuesto aparecerán aquí solos.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.slice(0, diasVisibles).map(({ dia, eventos: delDia }) => (
            <section key={dia} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2 border-b border-slate-800 pb-1.5">
                <h4 className="text-sm font-bold text-white">{tituloDia(dia)}</h4>
                <span className="text-[11px] text-slate-500 shrink-0">{delDia.length} {delDia.length === 1 ? 'suceso' : 'sucesos'}</span>
              </div>
              <ol className="space-y-2">
                {delDia.map(ev => {
                  const info = tipoInfo(ev.tipo);
                  const Icono = ICONOS[ev.tipo] || StickyNote;
                  const hora = horaDe(ev.fecha);
                  const items = ev.datos?.items || [];
                  return (
                    <li key={ev.clave || ev.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex gap-3">
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${COLOR[info.color]}`}>
                        <Icono className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                          {hora && <span className="font-mono text-slate-400">{hora}</span>}
                          <span className={`px-1.5 py-0.5 rounded border font-semibold ${COLOR[info.color]}`}>{info.corto}</span>
                          <span>{ev.origen === 'manual' ? 'Apunte' : 'Automático'}</span>
                          {ev.autor && <span>· {ev.autor}</span>}
                        </div>
                        <p className="text-sm text-slate-100 font-medium break-words">{ev.titulo}</p>
                        {ev.datos?.contacto && ev.tipo === 'llamada' && !ev.titulo.includes(ev.datos.contacto) && (
                          <p className="text-xs text-slate-400">{ev.datos.contacto}</p>
                        )}
                        {ev.detalle && <p className="text-xs text-slate-300 whitespace-pre-line break-words">{ev.detalle}</p>}
                        {items.length > 0 && ev.origen === 'manual' && (
                          <ul className="flex flex-wrap gap-1.5 pt-0.5">
                            {items.map((it, i) => (
                              <li key={i} className="text-[11px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-slate-300">
                                {it.concepto}{it.cantidad !== null && it.cantidad !== undefined && it.cantidad !== '' ? ` · ${it.cantidad} ${it.unidad || ''}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                        {(ev.datos?.clima || ev.datos?.operarios?.length > 0) && (
                          <p className="text-[11px] text-slate-500">
                            {[ev.datos.clima && `Clima: ${ev.datos.clima}`, ev.datos.operarios?.length && `Operarios: ${ev.datos.operarios.join(', ')}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {Array.isArray(ev.datos?.fotos) && ev.datos.fotos.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            {ev.datos.fotos.slice(0, 4).map((src, i) => (
                              <img key={i} src={src} alt="Foto de obra" className="w-16 h-16 object-cover rounded-lg border border-slate-700" />
                            ))}
                          </div>
                        )}
                      </div>
                      {ev.editable && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={() => abrirEdicion(ev)} className="p-1.5 text-slate-500 hover:text-amber-400 rounded-lg" title="Corregir" aria-label="Corregir apunte">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => borrar(ev)} className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg" title="Quitar" aria-label="Quitar apunte">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {grupos.length > diasVisibles && (
            <button onClick={() => setDiasVisibles(n => n + 15)} className="w-full py-2 text-xs text-amber-400 hover:text-amber-300 bg-slate-900 border border-slate-800 rounded-xl">
              Ver días anteriores ({grupos.length - diasVisibles} más)
            </button>
          )}
        </div>
      )}

      {/* Apuntar o corregir un suceso */}
      <AnimatePresence>
        {form && (
          <ModalOverlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{form.id ? 'Corregir apunte' : 'Apuntar suceso'}</h3>
                <button onClick={() => setForm(null)} className="p-1.5 text-slate-400 hover:text-white rounded-lg" aria-label="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={guardar} className="space-y-3 text-xs sm:text-sm">
                <div>
                  <label className="text-slate-400 block mb-1">Qué ha pasado</label>
                  <div className="flex flex-wrap gap-1.5">
                    {TIPOS_MANUALES.map(id => {
                      const t = tipoInfo(id);
                      const Icono = ICONOS[id];
                      const activo = form.tipo === id;
                      return (
                        <button
                          type="button"
                          key={id}
                          onClick={() => cambiarTipo(id)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition ${activo ? COLOR[t.color] : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
                        >
                          <Icono className="w-3.5 h-3.5" />
                          <span>{id === 'llamada' ? 'Cliente' : t.corto}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Día</label>
                    <input type="date" required value={form.dia} onChange={(e) => campo('dia', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Hora</label>
                    <input type="time" value={form.hora} onChange={(e) => campo('hora', e.target.value)} className={inputCls} />
                  </div>
                </div>

                {form.tipo === 'llamada' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Con quién</label>
                      <input value={form.contacto} onChange={(e) => campo('contacto', e.target.value)} className={inputCls} placeholder="Cliente" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Cómo</label>
                      <select value={form.medio} onChange={(e) => campo('medio', e.target.value)} className={inputCls}>
                        {MEDIOS.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {conItems(form.tipo) && (
                  <div className="space-y-2">
                    <label className="text-slate-400 block">
                      {form.tipo === 'maquinaria' ? 'Máquinas y tiempo de uso' : form.tipo === 'pedido' ? 'Material pedido' : 'Material utilizado'}
                    </label>
                    {form.items.map((it, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          value={it.concepto}
                          onChange={(e) => cambiarItem(idx, 'concepto', e.target.value)}
                          placeholder={form.tipo === 'maquinaria' ? 'Miniexcavadora, martillo, contenedor…' : 'Sacos de yeso, azulejo 30×60…'}
                          className={`${campoCls} flex-1 min-w-0`}
                        />
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.cantidad}
                          onChange={(e) => cambiarItem(idx, 'cantidad', e.target.value)}
                          placeholder="Cant."
                          className={`${campoCls} w-20 shrink-0`}
                          aria-label="Cantidad"
                        />
                        <input
                          value={it.unidad}
                          onChange={(e) => cambiarItem(idx, 'unidad', e.target.value)}
                          className={`${campoCls} w-16 shrink-0`}
                          aria-label="Unidad"
                        />
                        <button type="button" onClick={() => quitarItem(idx)} className="px-2 text-slate-500 hover:text-rose-400" aria-label="Quitar línea">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={anadirItem} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Añadir línea
                    </button>
                  </div>
                )}

                {form.tipo === 'parte' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Clima</label>
                      <input value={form.clima} onChange={(e) => campo('clima', e.target.value)} className={inputCls} placeholder="Soleado, 18 °C" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Operarios presentes</label>
                      <input value={form.operarios} onChange={(e) => campo('operarios', e.target.value)} className={inputCls} placeholder="Separados por comas" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-slate-400 block mb-1">Resumen</label>
                  <input
                    value={form.titulo}
                    onChange={(e) => campo('titulo', e.target.value)}
                    placeholder={PLACEHOLDER[form.tipo]}
                    className={inputCls}
                    maxLength={300}
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Detalle (opcional)</label>
                  <textarea rows="3" value={form.detalle} onChange={(e) => campo('detalle', e.target.value)} className={inputCls} maxLength={4000} />
                  <div className="mt-2">
                    <AiImprovementControl
                      value={form.detalle}
                      onAccept={(mejorado) => campo('detalle', mejorado)}
                      context={`Histórico diario de obra: ${tipoInfo(form.tipo).label}`}
                      buttonLabel="Mejorar redacción con IA"
                      buttonSize="small"
                    />
                  </div>
                </div>

                {errorForm && <p className="text-xs text-rose-400">{errorForm}</p>}

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button type="button" onClick={() => setForm(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700">
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardando} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold rounded-xl">
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}
