import React, { useLayoutEffect, useRef, useState } from 'react';
import BarraFacturacion from '../Facturas/BarraFacturacion';
import BotonVolver from '../Common/BotonVolver';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Share2,
  Download,
  History,
  MapPin,
  Plus,
  Trash2,
  Pencil,
  BadgeCheck,
  AlertTriangle,
  Receipt,
  PencilRuler,
  Lock,
  FilePlus2,
  HardHat
} from 'lucide-react';
import EnvioClienteModal from './EnvioClienteModal';
import CroquisEditorModal from '../Croquis/CroquisEditorModal';
import CroquisLienzo from '../Croquis/CroquisLienzo';
import { normalizarCroquis } from '../../utils/croquisPlano';
import VersionesPresupuesto from './VersionesPresupuesto';
import { recordBudgetEditDebounced } from '../../services/backendAiService';
import { capitulosDe, estaAprobado, estaBloqueado, recalcularPartida, recalcularTotales } from '../../utils/presupuestoRevision';

const BOTON_SECUNDARIO = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition whitespace-nowrap';

const ESTADO_PRESUPUESTO = {
  borrador: { texto: 'Borrador', clase: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  enviado_cliente: { texto: 'Enviado al cliente', clase: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  aceptado: { texto: 'Aceptado', clase: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
};

const inputCls = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400';

// Datos de cabecera editables del presupuesto.
const CAMPOS_CABECERA = [
  { id: 'obraTitulo', label: 'Nombre de la obra', span: 2 },
  { id: 'cliente', label: 'Cliente' },
  { id: 'nif', label: 'NIF / CIF' },
  { id: 'telefono', label: 'Teléfono' },
  { id: 'email', label: 'Email', type: 'email' },
  { id: 'direccion', label: 'Dirección de la obra', span: 2 },
  { id: 'fecha', label: 'Fecha', type: 'date' },
  { id: 'validezDias', label: 'Validez (días)', type: 'number' },
  { id: 'tipoIvaPct', label: 'IVA (%)', type: 'number' },
  { id: 'notasLegales', label: 'Condiciones y notas', span: 4, multiline: true }
];

export default function ConsolaRevisionPresupuesto({ quoteId, onBack, onFacturar, onAceptarObra, estadoFacturacion = null }) {
  const {
    presupuestos,
    obras,
    editarPresupuesto,
    registrarNuevaAceptacion,
    nuevaVersionPresupuesto,
    guardarCroquisPresupuesto,
    setPdfModalData,
    showNotification,
    empresaConfig
  } = useApp();

  const quote = presupuestos.find(p => p.id === quoteId) || presupuestos[0];
  // Croquis del presupuesto o, si no tiene, el de su obra.
  const croquisObra = (obras || []).find(o => o.id === quote?.obraId || o.presupuestoId === quote?.id)?.croquis;
  const croquisVisible = quote?.croquis?.plan?.rooms?.length ? quote.croquis : croquisObra?.plan?.rooms?.length ? croquisObra : null;
  const planCroquis = croquisVisible ? normalizarCroquis(croquisVisible.plan) : null;

  // Al abrir un presupuesto, la página empieza arriba con la cabecera a la vista
  // (la lista anterior podía dejar el scroll a media página).
  const raizRef = useRef(null);
  useLayoutEffect(() => {
    const subir = () => {
      try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      for (let el = raizRef.current?.parentElement; el; el = el.parentElement) {
        if (el.scrollTop) el.scrollTop = 0;
      }
    };
    subir();
    // Otra vez tras pintar, por si el contenido largo (capítulos, croquis) movió la posición.
    const id = requestAnimationFrame(subir);
    return () => cancelAnimationFrame(id);
  }, [quoteId]);

  const [showHistory, setShowHistory] = useState(false);
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [collapsedChapters, setCollapsedChapters] = useState({});
  const [showDatos, setShowDatos] = useState(false);
  const [showCroquis, setShowCroquis] = useState(false);

  if (!quote) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-400">Presupuesto no encontrado.</p>
        <BotonVolver onClick={onBack} className="mx-auto">Volver a Presupuestos</BotonVolver>
      </div>
    );
  }

  // Toggle chapter collapse
  const toggleChapter = (capId) => {
    setCollapsedChapters(prev => ({ ...prev, [capId]: !prev[capId] }));
  };

  const capitulos = capitulosDe(quote);
  const aprobado = estaAprobado(quote);
  // Aceptado o facturado: solo lectura; los cambios van en una revisión nueva.
  const bloqueado = estaBloqueado(quote);
  const anadirRevision = () => {
    if (window.confirm(`¿Añadir una revisión a ${quote.numero}? La versión ${quote.version || 1} quedará guardada como modificada, con la fecha y los cambios${aprobado ? '. Hasta que el cliente firme la revisión, la obra y la facturación siguen con la versión firmada' : ''}.`)) nuevaVersionPresupuesto(quote.id);
  };

  // Guarda capítulos y totales. Si ya estaba aprobado, queda "Revisado" (lo marca el contexto).
  const guardarCapitulos = (nuevos, extra = {}) => {
    const tipoIva = extra.tipoIvaPct ?? quote.tipoIvaPct;
    editarPresupuesto(quote.id, { ...extra, ...recalcularTotales(nuevos, tipoIva, quote.margenGlobalPct) });
  };

  const cambiarPartida = (capId, itemId, cambio) => {
    guardarCapitulos(capitulos.map(c => (c.id !== capId ? c : {
      ...c,
      partidas: c.partidas.map(p => (p.id === itemId ? cambio(p) : p))
    })));
  };

  const recordarCambio = (cap, item, field, antes, despues) => {
    if (antes === despues) return;
    recordBudgetEditDebounced(`${quote.id}:${item.id}:${field}`, {
      context: `${cap.nombre || 'Capítulo'} · ${item.concepto || item.codigo || 'Partida'}`,
      original: `${field}: ${antes}`,
      finalText: `${field}: ${despues}`,
      note: `El usuario cambió ${field} de la partida "${item.concepto || item.codigo}" (${item.unidad || 'ud'})`
    });
  };

  // Campos numéricos: recalculan PVP y total de la partida. La IA aprende de los cambios manuales.
  const handleItemChange = (capId, itemId, field, value) => {
    const numVal = Math.max(0, Number(value) || 0);
    const cap = capitulos.find(c => c.id === capId);
    const item = cap?.partidas.find(p => p.id === itemId);
    if (item) recordarCambio(cap, item, field, item[field], numVal);
    cambiarPartida(capId, itemId, p => recalcularPartida({ ...p, [field]: numVal }));
  };

  // Campos de texto de la partida: código, concepto y unidad.
  const handleItemText = (capId, itemId, field, value) => {
    const cap = capitulos.find(c => c.id === capId);
    const item = cap?.partidas.find(p => p.id === itemId);
    if (item && field === 'concepto') recordarCambio(cap, item, field, item[field], value);
    cambiarPartida(capId, itemId, p => ({ ...p, [field]: value }));
  };

  const handleAddPartida = (capId) => {
    const cap = capitulos.find(c => c.id === capId);
    const nueva = recalcularPartida({
      id: `p-${Date.now()}`,
      codigo: `${cap?.codigo || '00'}.${String((cap?.partidas.length || 0) + 1).padStart(2, '0')}`,
      concepto: '',
      unidad: 'ud',
      cantidad: 1,
      costeUnitario: 0,
      margenPct: Number(quote.margenGlobalPct) || 30
    });
    guardarCapitulos(capitulos.map(c => (c.id === capId ? { ...c, partidas: [...c.partidas, nueva] } : c)));
    setCollapsedChapters(prev => ({ ...prev, [capId]: false }));
  };

  const handleDeletePartida = (capId, item) => {
    if (!window.confirm(`¿Eliminar la partida "${item.concepto || item.codigo}"?`)) return;
    guardarCapitulos(capitulos.map(c => (c.id === capId ? { ...c, partidas: c.partidas.filter(p => p.id !== item.id) } : c)));
  };

  const handleChapterField = (capId, field, value) => {
    guardarCapitulos(capitulos.map(c => (c.id === capId ? { ...c, [field]: value } : c)));
  };

  const handleAddChapter = () => {
    const codigo = String(capitulos.length + 1).padStart(2, '0');
    guardarCapitulos([...capitulos, { id: `cap-${Date.now()}`, codigo, nombre: 'Nuevo capítulo', partidas: [] }]);
  };

  const handleDeleteChapter = (cap) => {
    if (!window.confirm(`¿Eliminar el capítulo "${cap.nombre}" y sus ${cap.partidas.length} partidas?`)) return;
    guardarCapitulos(capitulos.filter(c => c.id !== cap.id));
  };

  const handleCabecera = (field, value) => {
    if (field === 'tipoIvaPct') {
      guardarCapitulos(capitulos, { tipoIvaPct: Math.max(0, Number(value) || 0) });
      return;
    }
    editarPresupuesto(quote.id, { [field]: field === 'validezDias' ? Math.max(0, Number(value) || 0) : value });
  };

  // Open PDF modal
  const handleOpenPdfModal = () => {
    setPdfModalData({
      type: 'presupuesto',
      data: {
        ...quote,
        empresa: empresaConfig
      }
    });
  };

  const estadoClave = ESTADO_PRESUPUESTO[quote.estado] ? quote.estado : 'borrador';

  return (
    <div ref={raizRef} className="space-y-6 pb-8">
      
      {/* Cabecera: volver, identificación del presupuesto y acciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <BotonVolver onClick={onBack} className="!px-3 !py-1.5 text-xs">Volver</BotonVolver>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-mono font-semibold text-slate-300 whitespace-nowrap">
                {quote.numero}
                <span className="text-slate-500 font-sans font-medium"> · v{quote.version || 1}</span>
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap border ${ESTADO_PRESUPUESTO[estadoClave].clase}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {ESTADO_PRESUPUESTO[estadoClave].texto}
              </span>
              {quote.revisado && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap border bg-violet-500/10 text-violet-400 border-violet-500/30">
                  Revisión {quote.revisionNumero || 1}
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">{quote.obraTitulo}</h1>
            <p className="text-sm text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <span>{quote.cliente}</span>
              {quote.direccion && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  {quote.direccion}
                </span>
              )}
            </p>
            {estadoFacturacion?.facturado > 0 && (
              <BarraFacturacion estado={estadoFacturacion} className="mt-2 max-w-md" />
            )}
          </div>
          </div>

          {/* Croquis de la obra: miniatura que abre el editor */}
          <button
            type="button"
            onClick={() => setShowCroquis(true)}
            title={planCroquis ? 'Abrir el croquis en el editor' : 'Dibujar el croquis de la obra'}
            aria-label={planCroquis ? `Abrir el croquis de ${quote.obraTitulo}` : 'Dibujar el croquis de la obra'}
            className={`group relative w-full sm:w-72 lg:w-96 h-32 sm:h-36 shrink-0 rounded-xl overflow-hidden border transition-colors ${
              planCroquis ? 'border-slate-700 hover:border-amber-500/60' : 'border-dashed border-slate-700 hover:border-amber-500/60 bg-slate-950/40'
            }`}
            style={planCroquis ? { background: '#ffffff' } : undefined}
          >
            {planCroquis ? (
              <>
                <CroquisLienzo plan={planCroquis} soloLectura mostrarCotas={false} alto="100%" ajustado />
                <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900/80 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <PencilRuler className="w-3 h-3" /> Editar croquis
                </span>
              </>
            ) : (
              <span className="flex flex-col items-center justify-center h-full gap-1.5 text-slate-400 group-hover:text-amber-400 transition-colors">
                <PencilRuler className="w-6 h-6" />
                <span className="text-sm font-semibold">Dibujar croquis</span>
                <span className="text-xs text-slate-500">Plano 2D a partir de las mediciones</span>
              </span>
            )}
          </button>
        </div>

        {/* Acciones: herramientas a la izquierda, pasos del flujo a la derecha */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 border-t border-slate-800 bg-slate-950/40 rounded-b-2xl">
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5">
            <button
              type="button"
              onClick={handleOpenPdfModal}
              className={BOTON_SECUNDARIO}
              title="Descargar el PDF del presupuesto con espacio para la firma"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`${BOTON_SECUNDARIO} ${showHistory ? '!bg-slate-800 !text-white' : ''}`}
              title="Ver los cambios que ha hecho la IA en este presupuesto"
              aria-pressed={showHistory}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>Historial</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            {onAceptarObra && !['aceptado', 'firmado', 'facturado'].includes(quote.estado) && (
              <button
                type="button"
                onClick={() => onAceptarObra(quote)}
                title="El cliente acepta: convertir el presupuesto en obra"
                className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition active:scale-95 whitespace-nowrap"
              >
                <HardHat className="w-4 h-4 shrink-0" />
                <span>Aceptar → Obra</span>
              </button>
            )}
            {onFacturar && (
              <button
                type="button"
                onClick={() => onFacturar(quote)}
                title={estadoFacturacion?.completo ? 'Ya está facturado al 100 %: para facturar más hace falta una versión nueva firmada o una rectificativa' : 'Emitir una factura o certificación de este presupuesto'}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition whitespace-nowrap"
              >
                <Receipt className="w-4 h-4 shrink-0" />
                <span>{estadoFacturacion?.completo ? 'Facturado' : 'Pasar a factura'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowEnvioModal(true)}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95 whitespace-nowrap ${onFacturar ? '' : 'col-span-2'}`}
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Aprobar y enviar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Revisión tras la aprobación: fecha y nueva aceptación del cliente */}
      {quote.pendienteNuevaAceptacion ? (
        <div className="bg-violet-500/10 border border-violet-500/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-white">Revisado el {quote.fechaRevision} · pendiente de nueva aceptación</p>
              <p className="text-slate-300 mt-0.5">
                Este presupuesto ya estaba aprobado. Los cambios forman la revisión {quote.revisionNumero || 1}
                {quote.versionAceptada?.totalConIva !== undefined && <> (antes {quote.versionAceptada.totalConIva.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })})</>}.
                {' '}La obra sigue con la versión aceptada hasta que el cliente la acepte de nuevo.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (window.confirm(`¿El cliente ha aceptado la revisión ${quote.revisionNumero || 1} de ${quote.numero}?`)) registrarNuevaAceptacion(quote.id);
            }}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <BadgeCheck className="w-4 h-4" />
            <span>Nueva aceptación</span>
          </button>
        </div>
      ) : quote.revisado ? (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs text-slate-300 flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Revisado el {quote.fechaRevision} (Rev. {quote.revisionNumero || 1}) · nueva aceptación del cliente el {quote.fechaNuevaAceptacion}.</span>
        </div>
      ) : bloqueado ? null : aprobado && (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs text-slate-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Presupuesto aprobado. Si lo modificas quedará marcado como <strong className="text-violet-400">Revisado</strong> y necesitará una nueva aceptación del cliente.</span>
        </div>
      )}

      {/* Aceptado o facturado: bloqueado, solo se puede añadir una revisión */}
      {bloqueado && (
        <div role="status" className="bg-amber-500/10 border border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 text-xs">
            <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white">Presupuesto {quote.estado === 'facturado' ? 'facturado' : 'aceptado'}: no se puede modificar</p>
              <p className="text-slate-300 mt-0.5">Para cambiarlo, añade una revisión. Sustituye a esta versión, que queda guardada como modificada con la fecha y los cambios.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={anadirRevision}
            className="px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shrink-0 active:scale-95"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Añadir revisión</span>
          </button>
        </div>
      )}

      {/* Versiones: la actual y las anteriores guardadas, con su PDF */}
      <VersionesPresupuesto
        pres={quote}
        onPdf={(data) => setPdfModalData({ type: 'presupuesto', data: { ...data, empresa: empresaConfig } })}
        onNuevaVersion={anadirRevision}
      />

      {/* Datos del presupuesto: obra, cliente y condiciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDatos(v => !v)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-950/50 transition"
        >
          <span className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider">
            <Pencil className="w-3.5 h-3.5 text-amber-400" />
            Datos de la obra y del cliente
          </span>
          {showDatos ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showDatos && (
          <fieldset disabled={bloqueado} className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-0 m-0 min-w-0 disabled:opacity-70">
            {CAMPOS_CABECERA.map(campo => (
              <label key={campo.id} className={`text-[11px] text-slate-400 font-semibold space-y-1 ${campo.span === 4 ? 'sm:col-span-2 lg:col-span-4' : campo.span === 2 ? 'sm:col-span-2' : ''}`}>
                <span className="block">{campo.label}</span>
                {campo.multiline ? (
                  <textarea
                    rows={3}
                    value={quote[campo.id] ?? ''}
                    onChange={(e) => handleCabecera(campo.id, e.target.value)}
                    className={inputCls}
                  />
                ) : (
                  <input
                    type={campo.type || 'text'}
                    value={quote[campo.id] ?? ''}
                    onChange={(e) => handleCabecera(campo.id, e.target.value)}
                    className={inputCls}
                  />
                )}
              </label>
            ))}
          </fieldset>
        )}
      </div>

      {/* Alert Banner: Presupuesto Listo para Revisión */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">
              Borrador técnico compilado por el Motor de IA a partir de la visita in situ
            </h4>
            <p className="text-[11px] text-slate-300">
              Cruces realizados con la Base Oficial de Precios. Puedes ajustar las celdas manualmente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-sans">Margen Comercial</span>
            <span className="text-amber-400 font-bold text-sm">{quote.margenGlobalPct}%</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-sans">Total Presupuesto</span>
            <span className="text-white font-black text-base">{quote.totalConIva?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>
      </div>

      {/* History Drawer (if open) */}
      {showHistory && (
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 animate-in fade-in">
          <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
            <History className="w-3.5 h-3.5" />
            <span>Registro de Comandos y Refinados por IA</span>
          </h4>
          <div className="space-y-2">
            {(quote.historialRefinados || []).map((h, idx) => (
              <div key={idx} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-white block">"{h.comando}"</span>
                  <span className="text-[11px] text-slate-400">{h.resultado}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">{h.fecha}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hierarchical Chapters & Items Breakdown (solo lectura si está aceptado o facturado) */}
      <fieldset disabled={bloqueado} className="space-y-6 border-0 p-0 m-0 min-w-0">
      <div className="space-y-4">
        {capitulos.map((cap) => {
          const isCollapsed = collapsedChapters[cap.id];

          return (
            <div key={cap.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Chapter Header */}
              <div
                onClick={() => toggleChapter(cap.id)}
                className="p-4 bg-slate-950/70 hover:bg-slate-950 border-b border-slate-800 flex items-center justify-between cursor-pointer transition select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs font-mono font-bold text-amber-400 shrink-0">Cap.</span>
                  <input
                    value={cap.codigo ?? ''}
                    onChange={(e) => handleChapterField(cap.id, 'codigo', e.target.value)}
                    aria-label="Código del capítulo"
                    className="w-12 bg-slate-800 border border-transparent hover:border-slate-700 focus:border-amber-400 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-amber-400 focus:outline-none"
                  />
                  <input
                    value={cap.nombre ?? ''}
                    onChange={(e) => handleChapterField(cap.id, 'nombre', e.target.value)}
                    aria-label="Nombre del capítulo"
                    className="min-w-0 flex-1 max-w-md bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-400 rounded px-1.5 py-0.5 font-extrabold text-white text-sm focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                    ({cap.partidas.length} partidas)
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block leading-none">Subtotal Capítulo</span>
                    <span className="text-sm font-bold text-white">
                      {cap.subtotal?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteChapter(cap); }}
                    title="Eliminar capítulo"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Items Table */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/40 text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800/80">
                      <tr>
                        <th className="py-2.5 px-4 w-20">Código</th>
                        <th className="py-2.5 px-4">Descripción Técnica de la Partida</th>
                        <th className="py-2.5 px-3 w-16 text-center">Unidad</th>
                        <th className="py-2.5 px-3 w-20 text-center">Medición</th>
                        <th className="py-2.5 px-3 w-24 text-right">Coste Subc.</th>
                        <th className="py-2.5 px-3 w-20 text-center">Margen</th>
                        <th className="py-2.5 px-3 w-24 text-right">PVP Unit.</th>
                        <th className="py-2.5 px-4 w-28 text-right">Total</th>
                        <th className="py-2.5 px-2 w-10"><span className="sr-only">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {cap.partidas.map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-800/40 transition ${
                            item._modificadoIa ? 'bg-amber-500/5' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-[11px] text-amber-400">
                            <input
                              value={item.codigo ?? ''}
                              onChange={(e) => handleItemText(cap.id, item.id, 'codigo', e.target.value)}
                              aria-label="Código de la partida"
                              className="w-16 bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-400 rounded px-1 py-0.5 font-mono font-bold text-[11px] text-amber-400 focus:outline-none"
                            />
                            {item._modificadoIa && (
                              <span className="block text-[8px] text-emerald-400 font-sans">✨ Mod. IA</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200 text-xs min-w-[16rem]">
                            <textarea
                              rows={2}
                              value={item.concepto ?? ''}
                              onChange={(e) => handleItemText(cap.id, item.id, 'concepto', e.target.value)}
                              placeholder="Descripción de la partida"
                              aria-label="Concepto de la partida"
                              className="w-full bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-400 focus:bg-slate-950 rounded-lg px-2 py-1 text-xs text-slate-200 leading-snug resize-y focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                            <input
                              value={item.unidad ?? ''}
                              onChange={(e) => handleItemText(cap.id, item.id, 'unidad', e.target.value)}
                              aria-label="Unidad"
                              className="w-12 bg-transparent border border-transparent hover:border-slate-700 focus:border-amber-400 rounded px-1 py-0.5 text-center font-mono text-[11px] text-slate-300 focus:outline-none"
                            />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <input
                              type="number"
                              step="0.5"
                              value={item.cantidad}
                              onChange={(e) => handleItemChange(cap.id, item.id, 'cantidad', e.target.value)}
                              className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                            />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <input
                              type="number"
                              step="0.5"
                              value={item.costeUnitario}
                              onChange={(e) => handleItemChange(cap.id, item.id, 'costeUnitario', e.target.value)}
                              className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-400"
                            />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                value={item.margenPct}
                                onChange={(e) => handleItemChange(cap.id, item.id, 'margenPct', e.target.value)}
                                className="w-12 bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-center text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-400"
                              />
                              <span className="text-[10px] text-slate-500">%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                            {item.precioVenta?.toFixed(2)} €
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white text-xs">
                            {item.total?.toFixed(2)} €
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePartida(cap.id, item)}
                              title="Eliminar partida"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-3 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => handleAddPartida(cap.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:bg-amber-500/10 border border-dashed border-amber-500/30 transition flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Añadir partida
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleAddChapter}
        className="w-full p-3 rounded-2xl text-xs font-bold text-slate-300 hover:text-white border border-dashed border-slate-700 hover:border-amber-500/40 hover:bg-slate-900 transition flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4 text-amber-400" />
        Añadir capítulo
      </button>
      </fieldset>

      {/* Summary Recap Card */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-xs">
          <div className="text-slate-400">
            Coste Directo Estimado: <strong className="text-slate-200 font-mono">{quote.costeTotal?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>
          </div>
          <div className="text-slate-400">
            Margen Bruto de la Empresa: <strong className="text-emerald-400 font-mono">{(quote.baseImponible - quote.costeTotal)?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} ({quote.margenGlobalPct}%)</strong>
          </div>
        </div>

        <div className="flex items-center gap-6 text-right">
          <div>
            <span className="text-xs text-slate-400 block">Base Imponible</span>
            <span className="text-sm font-bold text-slate-200 font-mono">{quote.baseImponible?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">IVA ({quote.tipoIvaPct}%)</span>
            <span className="text-sm font-bold text-slate-200 font-mono">{quote.cuotaIva?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
          </div>
          <div className="bg-slate-950 border border-amber-500/30 px-4 py-2 rounded-xl">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Total Proyecto</span>
            <span className="text-xl font-black text-white font-mono">{quote.totalConIva?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>
      </div>

      {/* Croquis 2D: se guarda en el presupuesto y pasa a la obra al aceptarlo */}
      {showCroquis && (
        <CroquisEditorModal
          titulo={`Croquis 2D · ${quote.numero}`}
          croquis={quote.croquis || croquisVisible}
          contexto={{
            medidasNotas: quote.medidasNotas || '',
            obraTitulo: quote.obraTitulo,
            partidas: capitulos.flatMap(c => c.partidas.map(p => p.titulo || p.concepto)).filter(Boolean)
          }}
          cabecera={{ numero: quote.numero, fecha: quote.fecha, cliente: quote.cliente, nif: quote.nif, obraTitulo: quote.obraTitulo, direccion: quote.direccion }}
          onGuardar={(croquis) => guardarCroquisPresupuesto(quote.id, croquis)}
          onClose={() => setShowCroquis(false)}
        />
      )}

      {/* Envio Cliente Modal */}
      {showEnvioModal && (
        <EnvioClienteModal
          isOpen={true}
          quote={quote}
          onClose={() => setShowEnvioModal(false)}
          onSent={() => showNotification('Presupuesto aprobado y enviado.')}
        />
      )}

    </div>
  );
}
