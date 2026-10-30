import React, { useState } from 'react';
import BarraFacturacion from '../Facturas/BarraFacturacion';
import BotonVolver from '../Common/BotonVolver';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
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
  PencilRuler
} from 'lucide-react';
import EnvioClienteModal from './EnvioClienteModal';
import CroquisEditorModal from '../Croquis/CroquisEditorModal';
import confetti from 'canvas-confetti';
import AiImprovementControl from '../Common/AiImprovementControl';
import { recordAiCorrection, recordBudgetEditDebounced } from '../../services/backendAiService';
import { capitulosDe, estaAprobado, recalcularPartida, recalcularTotales } from '../../utils/presupuestoRevision';

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

export default function ConsolaRevisionPresupuesto({ quoteId, onBack, onFacturar, estadoFacturacion = null }) {
  const {
    presupuestos,
    refineQuoteWithVoiceCommand,
    editarPresupuesto,
    registrarNuevaAceptacion,
    guardarCroquisPresupuesto,
    setPdfModalData,
    showNotification,
    empresaConfig
  } = useApp();

  const quote = presupuestos.find(p => p.id === quoteId) || presupuestos[0];

  // Voice Command & Floating Bar State
  const [voiceCommand, setVoiceCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isApplyingVoice, setIsApplyingVoice] = useState(false);
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

  // Predefined quick voice prompts
  const QUICK_PROMPTS = [
    'En electricidad sube los mecanismos a Schneider D-Life y añade 5% extra a la demolición por piso sin ascensor',
    'Añade un 10% de margen a toda la albañilería',
    'Recargo del 5% en desescombro por acceso difícil',
    'Ajustar margen comercial al 35% global'
  ];

  // Toggle chapter collapse
  const toggleChapter = (capId) => {
    setCollapsedChapters(prev => ({ ...prev, [capId]: !prev[capId] }));
  };

  const capitulos = capitulosDe(quote);
  const aprobado = estaAprobado(quote);

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

  // Run Voice / Conversational Command
  const handleExecuteVoiceCommand = async (cmdToRun) => {
    const text = (cmdToRun || voiceCommand).trim();
    if (!text) return;

    // Las órdenes que das a la IA también se recuerdan.
    recordAiCorrection({ kind: 'presupuesto', context: 'Orden al refinar presupuesto', note: text });

    setIsApplyingVoice(true);
    try {
      await refineQuoteWithVoiceCommand(quote.id, text);
      setVoiceCommand('');
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
    } catch (err) {
      console.error('Error applying voice command', err);
      showNotification('Error al interpretar el comando de voz', 'error');
    } finally {
      setIsApplyingVoice(false);
    }
  };

  // Web Speech API / Mic simulation
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      // Fallback: cycle sample prompt
      const sample = QUICK_PROMPTS[Math.floor(Math.random() * QUICK_PROMPTS.length)];
      setVoiceCommand(sample);
      showNotification('Reconocimiento por voz activo: frase dictada colocada en la barra.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!isListening) {
      setIsListening(true);
      recognition.start();

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceCommand(transcript);
        setIsListening(false);
        showNotification(`Dictado recibido: "${transcript}"`);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };
    } else {
      setIsListening(false);
    }
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

  return (
    <div className="space-y-6 pb-28">
      
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <BotonVolver onClick={onBack}>Volver</BotonVolver>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30">
                {quote.numero}
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                Versión v{quote.version || 1}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                quote.estado === 'enviado_cliente'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : quote.estado === 'aceptado'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
              }`}>
                {quote.estado === 'enviado_cliente' ? 'Enviado al Cliente' : quote.estado === 'aceptado' ? 'Aceptado' : 'Borrador IA en Revisión'}
              </span>
              {quote.revisado && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-violet-500/20 text-violet-400 border border-violet-500/30">
                  Revisado · Rev. {quote.revisionNumero || 1}
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white mt-1">{quote.obraTitulo}</h1>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{quote.cliente}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" />
                {quote.direccion}
              </span>
            </p>
            {estadoFacturacion?.facturado > 0 && (
              <BarraFacturacion estado={estadoFacturacion} className="mt-2 max-w-md" />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onFacturar && (
            <button
              onClick={() => onFacturar(quote)}
              disabled={Boolean(estadoFacturacion?.completo)}
              title={estadoFacturacion?.completo ? 'Ya está facturado al 100 %' : 'Emitir una factura o certificación de este presupuesto'}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{estadoFacturacion?.completo ? 'Facturado al 100 %' : 'Pasar a factura'}</span>
            </button>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            title="Ver historial de refinamientos IA"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Historial IA</span>
          </button>

          <button
            onClick={() => setShowCroquis(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            title="Croquis 2D de la vivienda a partir de las mediciones y fotos"
          >
            <PencilRuler className="w-3.5 h-3.5 text-amber-400" />
            <span>{quote.croquis?.plan?.rooms?.length ? 'Croquis 2D' : '📐 Generar Croquis 2D con IA'}</span>
          </button>

          <button
            onClick={handleOpenPdfModal}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>PDF con Firma</span>
          </button>

          <button
            onClick={() => setShowEnvioModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5 fill-slate-950" />
            <span>Aprobar y Enviar</span>
          </button>
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
      ) : aprobado && (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs text-slate-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Presupuesto aprobado. Si lo modificas quedará marcado como <strong className="text-violet-400">Revisado</strong> y necesitará una nueva aceptación del cliente.</span>
        </div>
      )}

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
          <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          </div>
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
              Cruces realizados con la Base Oficial de Precios. Puedes ajustar celdas manualmente o <strong className="text-amber-400">hablarle a la IA</strong> en la barra inferior.
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

      {/* Hierarchical Chapters & Items Breakdown */}
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

      {/* FLOATING VOICE & TEXT COMMAND BAR */}
      <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto z-40 bg-slate-950/90 backdrop-blur-xl border border-amber-500/50 p-3 sm:p-4 rounded-2xl shadow-2xl space-y-2.5">
        
        {/* Quick prompt chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
          <span className="text-amber-400 font-bold flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3" />
            <span>Sugerencias de voz:</span>
          </span>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleExecuteVoiceCommand(prompt)}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg shrink-0 transition truncate max-w-xs font-medium"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar with Mic */}
        <div className="space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteVoiceCommand();
            }}
            className="flex items-center gap-2"
          >
            {/* Speech Mic Button */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              className={`p-2.5 rounded-xl transition flex items-center justify-center shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/30'
                  : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30'
              }`}
              title="Dictar ajuste por voz"
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={voiceCommand}
              onChange={(e) => setVoiceCommand(e.target.value)}
              placeholder="Habla o escribe un ajuste (ej: 'Sube los mecanismos a Schneider D-Life y añade 5% en demolición')..."
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isApplyingVoice || !voiceCommand.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shrink-0 transition active:scale-95 shadow-md shadow-amber-500/20"
            >
              {isApplyingVoice ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Calculando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 fill-slate-950" />
                  <span>Aplicar Ajuste</span>
                </>
              )}
            </button>
          </form>

          {voiceCommand && (
            <AiImprovementControl
              value={voiceCommand}
              onAccept={(improved) => setVoiceCommand(improved)}
              context="Ajuste o partida de presupuesto"
              buttonLabel="Mejorar Instrucción con IA"
              buttonSize="small"
            />
          )}
        </div>

      </div>

      {/* Croquis 2D: se guarda en el presupuesto y pasa a la obra al aceptarlo */}
      {showCroquis && (
        <CroquisEditorModal
          titulo={`Croquis 2D · ${quote.numero}`}
          croquis={quote.croquis}
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
