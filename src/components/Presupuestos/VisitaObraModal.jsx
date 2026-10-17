import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Camera,
  Mic,
  MicOff,
  Upload,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  Sliders,
  DollarSign,
  MapPin,
  User,
  Phone,
  Mail,
  ChevronRight,
  HardHat
} from 'lucide-react';
import { VISITA_TEMPLATES } from '../../services/siteVisitAIService';
import confetti from 'canvas-confetti';
import AudioVoiceRecorder from '../Common/AudioVoiceRecorder';
import { processScopeWithAI } from '../../services/aiAudioTextService';

export default function VisitaObraModal({ isOpen, onClose, onQuoteCreated }) {
  const {
    basePrecios,
    generateQuoteFromSiteVisit,
    addPresupuesto,
    empresaConfig,
    showNotification
  } = useApp();

  if (!isOpen) return null;

  // Selected sample template or manual mode
  const [selectedTemplate, setSelectedTemplate] = useState(VISITA_TEMPLATES[0]);
  const [isManualMode, setIsManualMode] = useState(false);

  // Form Fields
  const [clienteNombre, setClienteNombre] = useState(VISITA_TEMPLATES[0].cliente);
  const [clienteTelefono, setClienteTelefono] = useState(VISITA_TEMPLATES[0].telefono);
  const [clienteEmail, setClienteEmail] = useState(VISITA_TEMPLATES[0].email);
  const [obraTitulo, setObraTitulo] = useState(VISITA_TEMPLATES[0].titulo);
  const [direccion, setDireccion] = useState(VISITA_TEMPLATES[0].direccion);
  const [calidades, setCalidades] = useState(VISITA_TEMPLATES[0].calidades);
  const [plazoDeseado, setPlazoDeseado] = useState(VISITA_TEMPLATES[0].plazoMeses);
  const [margenObjetivo, setMargenObjetivo] = useState(30);
  const [tipoIva, setTipoIva] = useState(10);

  // Audio Recording & Text Input State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioTranscript, setAudioTranscript] = useState(VISITA_TEMPLATES[0].audioMuestra);
  const [complementaryText, setComplementaryText] = useState('');
  const timerRef = useRef(null);

  // Quick Scope Transform with AI
  const handleTransformWithAI = async () => {
    const combinedInput = [
      audioTranscript ? `[NOTAS DE VOZ]: ${audioTranscript}` : '',
      complementaryText ? `[ANOTACIONES Y MEDICIONES IN SITU]: ${complementaryText}` : ''
    ].filter(Boolean).join('\n\n');

    if (!combinedInput.trim()) {
      showNotification('Por favor, graba un audio o escribe notas técnicas antes de procesar con IA.', 'error');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(2);
    setStepLabel('Analizando requerimientos técnicos y generando partidas normalizadas...');

    try {
      const aiResult = await processScopeWithAI(
        combinedInput,
        'visita_obra',
        null,
        empresaConfig?.aiConfig || {},
        basePrecios
      );

      // Convert chapters & items into full quote line items
      const allItems = [];
      (aiResult.capitulos || []).forEach(cap => {
        (cap.partidas || []).forEach(part => {
          allItems.push({
            id: part.id || `par-vis-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            codigo: part.codigo || 'GEN-01',
            capitulo: cap.nombre_capitulo || 'General',
            concepto: part.concepto,
            unidad: part.unidad || 'ud',
            cantidad: Number(part.cantidad) || 1,
            costeUnitario: Number(part.costeUnitario) || Number(part.precioUnitario) * 0.7,
            precioVenta: Number(part.precioUnitario) || 50,
            margenPct: Number(margenObjetivo) || 30,
            total: Number(part.total) || ((Number(part.cantidad) || 1) * (Number(part.precioUnitario) || 50))
          });
        });
      });

      const subtotal = allItems.reduce((s, it) => s + (it.total || 0), 0);
      const ivaAmt = Number((subtotal * (tipoIva / 100)).toFixed(2));
      const totalConIva = Number((subtotal + ivaAmt).toFixed(2));

      const newQuote = addPresupuesto({
        numero: `PRES-IA-${Date.now().toString().slice(-4)}`,
        obraTitulo: obraTitulo || 'Presupuesto de Visita de Obra',
        cliente: clienteNombre || 'Cliente de Visita',
        telefono: clienteTelefono || '+34 600 000 000',
        email: clienteEmail || 'cliente@ejemplo.es',
        direccion: direccion || 'Dirección de obra',
        calidades: calidades || 'Estándar / Calidad Media',
        plazoMeses: plazoDeseado || 2,
        margenGlobalPct: margenObjetivo || 30,
        tipoIvaPct: tipoIva || 10,
        baseImponible: Number(subtotal.toFixed(2)),
        ivaImporte: ivaAmt,
        totalConIva: totalConIva,
        partidas: allItems,
        notas: `Generado mediante Captura Multimodal IA (Audio + Texto in situ).\n\nResumen: ${aiResult.resumen_alcance || ''}\n\nPliego Técnico: ${aiResult.redaccion_tecnica_estilo || ''}`,
        resumenEjecutivo: aiResult.resumen_alcance,
        redaccionPliego: aiResult.redaccion_tecnica_estilo
      });

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      showNotification('✨ ¡Presupuesto generado con partidas normalizadas por IA!');
      setIsProcessing(false);
      onClose();
      if (onQuoteCreated) {
        onQuoteCreated(newQuote);
      }
    } catch (err) {
      console.error('Error transforming scope to quote:', err);
      setIsProcessing(false);
      showNotification('Error al generar las partidas con IA', 'error');
    }
  };

  // Captures (Photos, Sketches, Laser measurements)
  const [capturas, setCapturas] = useState(VISITA_TEMPLATES[0].capturas);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [customPhotoTitle, setCustomPhotoTitle] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepLabel, setStepLabel] = useState('');

  // Switch template
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setIsManualMode(false);
    setClienteNombre(template.cliente);
    setClienteTelefono(template.telefono);
    setClienteEmail(template.email);
    setObraTitulo(template.titulo);
    setDireccion(template.direccion);
    setCalidades(template.calidades);
    setPlazoDeseado(template.plazoMeses);
    setAudioTranscript(template.audioMuestra);
    setCapturas(template.capturas);
  };

  // Live Microphone Simulation / MediaRecorder
  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
      showNotification('🎙️ Micrófono activado: Dictando notas técnicas de la visita...');
    } else {
      setIsRecording(false);
      clearInterval(timerRef.current);
      showNotification('Nota de voz capturada y transcrita para análisis multimodal.');
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAddCustomPhoto = () => {
    if (!customPhotoUrl) return;
    const newCap = {
      id: `cap-usr-${Date.now()}`,
      tipo: 'foto_estado',
      titulo: customPhotoTitle || 'Foto del estado actual',
      url: customPhotoUrl,
      notas: 'Evidencia gráfica agregada por el Director de Obra'
    };
    setCapturas(prev => [...prev, newCap]);
    setCustomPhotoUrl('');
    setCustomPhotoTitle('');
  };

  // Run Multimodal AI Pipeline
  const handleLaunchAiPipeline = async () => {
    setIsProcessing(true);

    const expedienteData = {
      titulo: obraTitulo,
      cliente: clienteNombre,
      telefono: clienteTelefono,
      email: clienteEmail,
      direccion,
      calidades,
      plazoMeses: plazoDeseado,
      margenGlobalPct: margenObjetivo,
      tipoIvaPct: tipoIva,
      audioTranscripcion: audioTranscript,
      capturas,
      medidasNotas: `Medidas tomadas in situ con distanciómetro láser. Calidades: ${calidades}.`
    };

    try {
      const newQuote = await generateQuoteFromSiteVisit(expedienteData, (progress) => {
        setCurrentStep(progress.step);
        setStepLabel(progress.label);
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });

      setIsProcessing(false);
      onClose();
      if (onQuoteCreated) {
        onQuoteCreated(newQuote);
      }
    } catch (err) {
      console.error('Error generating quote from site visit', err);
      setIsProcessing(false);
      showNotification('Error al procesar el expediente de visita', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col text-slate-100">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">Nueva Visita de Presupuesto (Multimodal AI)</h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  Motor v2.5
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Toma de datos en campo: dictado de voz, fotos de estado, croquis con cotas y parámetros del cliente.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Processing Loading Overlay */}
        {isProcessing && (
          <div className="p-8 sm:p-12 text-center space-y-6 bg-slate-950/95 flex-1 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-400 flex items-center justify-center relative">
              <Sparkles className="w-10 h-10 animate-spin" />
              <div className="absolute inset-0 rounded-3xl border-2 border-amber-400 animate-ping opacity-25"></div>
            </div>

            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-black text-white">Procesando Expediente de Visita...</h3>
              <p className="text-xs text-amber-400 font-mono font-semibold">{stepLabel}</p>
            </div>

            {/* Stepper progress */}
            <div className="grid grid-cols-4 gap-2 w-full max-w-lg pt-4">
              {[
                { s: 1, label: 'Transcripción Speech-to-Text' },
                { s: 2, label: 'Visión Artificial & OCR' },
                { s: 3, label: 'Cruce con Base Oficial' },
                { s: 4, label: 'Composición Capítulos' }
              ].map(st => (
                <div
                  key={st.s}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    currentStep >= st.s
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-600'
                  }`}
                >
                  <div className="text-xs font-black mb-1">Paso {st.s}</div>
                  <div className="text-[10px] leading-tight font-medium">{st.label}</div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500">
              Usando motor activo: <strong className="text-slate-300">{empresaConfig.aiConfig?.provider?.toUpperCase() || 'OPENAI'} ({empresaConfig.aiConfig?.modelName || 'gpt-4o'})</strong> con cifrado de conexión.
            </p>
          </div>
        )}

        {!isProcessing && (
          <div className="p-5 sm:p-6 space-y-6 flex-1">
            
            {/* Quick Preset Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Expedientes de Muestra para Demostración Rápida</span>
                </span>
                <span className="text-[11px] text-slate-400">Selecciona o introduce uno nuevo</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {VISITA_TEMPLATES.map(t => {
                  const isSel = selectedTemplate?.id === t.id && !isManualMode;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTemplate(t)}
                      className={`p-3 rounded-2xl border text-left transition flex items-start gap-3 ${
                        isSel
                          ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/30'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 font-black text-xs ${
                        isSel ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isSel ? '✓' : 'EXP'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{t.titulo}</h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{t.cliente} · {t.direccion}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                          <span className="text-amber-400 font-semibold">{t.calidades}</span>
                          <span className="text-slate-500">·</span>
                          <span className="text-emerald-400 font-semibold">{t.capturas.length} evidencias adjuntas</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* In Situ Dual Multimodal Capture Section (Audio + Texto + IA) */}
            <div className="bg-slate-950 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                      <span>1. Captura Rápida Multimodal en Visita (Audio + Texto Técnico)</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                        Whisper & IA
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Dicta o sube notas de voz y añade mediciones in situ tomadas con distanciómetro láser.
                    </p>
                  </div>
                </div>

                {/* Central Transform Action */}
                <button
                  type="button"
                  onClick={handleTransformWithAI}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition active:scale-95 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                  <span>Transformar con IA a Presupuesto</span>
                </button>
              </div>

              {/* Dual Methods: Audio + Text */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* 1. Entrada por Audio */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-amber-400" />
                      <span>A. Entrada por Audio (Micrófono o Archivo)</span>
                    </span>
                    <span className="text-[10px] text-slate-500">.m4a, .mp3, .wav</span>
                  </div>

                  <AudioVoiceRecorder
                    onTranscriptionComplete={(text) => {
                      setAudioTranscript(text);
                      setIsManualMode(true);
                    }}
                    initialTranscript={audioTranscript}
                  />
                </div>

                {/* 2. Entrada por Texto */}
                <div className="space-y-2 flex flex-col">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>B. Entrada por Texto (Mediciones & Comentarios In Situ)</span>
                  </span>

                  <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-3 min-h-[180px]">
                    <textarea
                      rows="7"
                      value={complementaryText}
                      onChange={(e) => {
                        setComplementaryText(e.target.value);
                        setIsManualMode(true);
                      }}
                      placeholder="Anotaciones complementarias in situ:&#10;• Dimensiones: 4.20m x 2.80m (altura 2.50m)&#10;• Alicatar hasta el techo con porcelánico rectificado&#10;• Falso techo de pladur verde con 4 puntos de luz LED&#10;• Reubicar bajante y colocar inodoro suspendido..."
                      className="w-full flex-1 bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none resize-none font-sans"
                    ></textarea>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{complementaryText.length} caracteres</span>
                      <span className="text-amber-400/80 text-[10px]">Complementa el audio para la IA</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Captures: Photos, Laser Sketches, OCR */}
            <div className="bg-slate-950 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm">
                      2. Evidencias Visuales y Croquis de Medición Láser ({capturas.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      La IA analizará grietas, bajantes, cuadros eléctricos y cotas numéricas escritas a mano.
                    </p>
                  </div>
                </div>
              </div>

              {/* Gallery of Captures */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {capturas.map((cap) => (
                  <div key={cap.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group">
                    <div className="h-28 overflow-hidden relative bg-slate-950">
                      <img src={cap.url} alt={cap.titulo} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <span className="absolute top-1.5 left-1.5 bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        {cap.tipo === 'croquis' ? '📐 Croquis Láser' : '📷 Estado Actual'}
                      </span>
                    </div>
                    <div className="p-2.5">
                      <h5 className="text-xs font-bold text-white truncate">{cap.titulo}</h5>
                      <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{cap.notas}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Custom Photo / Sketch Link */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="URL de foto o croquis adicional..."
                  value={customPhotoUrl}
                  onChange={(e) => setCustomPhotoUrl(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  placeholder="Título (ej: Cuadro de luces)..."
                  value={customPhotoTitle}
                  onChange={(e) => setCustomPhotoTitle(e.target.value)}
                  className="sm:w-48 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleAddCustomPhoto}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl text-xs transition"
                >
                  + Añadir Evidencia
                </button>
              </div>
            </div>

            {/* Client Parameters & Economic Targets */}
            <div className="bg-slate-950 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4">
              <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>3. Parámetros del Cliente y Condiciones Económicas</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Nombre del Cliente:</label>
                  <input
                    type="text"
                    value={clienteNombre}
                    onChange={(e) => { setClienteNombre(e.target.value); setIsManualMode(true); }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Teléfono Móvil (WhatsApp):</label>
                  <input
                    type="text"
                    value={clienteTelefono}
                    onChange={(e) => { setClienteTelefono(e.target.value); setIsManualMode(true); }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Dirección de la Vivienda / Local:</label>
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => { setDireccion(e.target.value); setIsManualMode(true); }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <label className="text-slate-400 block mb-1">Nivel de Calidades Deseado:</label>
                  <select
                    value={calidades}
                    onChange={(e) => { setCalidades(e.target.value); setIsManualMode(true); }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="Económica / Funcional">Económica / Funcional</option>
                    <option value="Media-Alta (Confort Plus)">Media-Alta (Confort Plus)</option>
                    <option value="Alta / Premium">Alta / Premium (Marcas Oficiales)</option>
                    <option value="Lujo / Exclusiva">Lujo / Exclusiva (Diseño a medida)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Margen Comercial Objetivo:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="15"
                      max="50"
                      value={margenObjetivo}
                      onChange={(e) => setMargenObjetivo(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <span className="font-mono font-bold text-amber-400 w-12 text-right">{margenObjetivo}%</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Tipo de IVA Aplicable:</label>
                  <select
                    value={tipoIva}
                    onChange={(e) => setTipoIva(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="10">10% Reducido (Reforma Vivienda Habitual)</option>
                    <option value="21">21% General (Locales o Materiales superior al 40%)</option>
                  </select>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Footer Actions */}
        {!isProcessing && (
          <div className="p-5 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Listo para ensamblar con la Base Oficial de Precios ({basePrecios.length} partidas)</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleLaunchAiPipeline}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>🚀 Procesar Expediente con IA</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
