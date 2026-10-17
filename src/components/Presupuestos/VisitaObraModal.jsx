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

export default function VisitaObraModal({ isOpen, onClose, onQuoteCreated }) {
  const {
    basePrecios,
    generateQuoteFromSiteVisit,
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

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioTranscript, setAudioTranscript] = useState(VISITA_TEMPLATES[0].audioMuestra);
  const timerRef = useRef(null);

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

            {/* In Situ Voice Recording Section */}
            <div className="bg-slate-950 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm">
                      1. Notas de Voz Dictadas en la Visita (Speech-to-Text)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Dicta mientras recorres las estancias: medidas, demoliciones, enchufes y reformas deseadas.
                    </p>
                  </div>
                </div>

                {/* Mic Record Button */}
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    isRecording
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-blue-400" />}
                  <span>{isRecording ? `Grabando (${formatSeconds(recordingSeconds)})` : 'Grabar con Micro'}</span>
                </button>
              </div>

              {/* Waveform / recording banner */}
              {isRecording && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-300 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                    <span>Escuchando micrófono del teléfono... Habla claro sobre los trabajos a presupuestar.</span>
                  </div>
                  <span className="font-mono font-bold text-rose-400">{formatSeconds(recordingSeconds)}</span>
                </div>
              )}

              {/* Transcribed Text Area */}
              <textarea
                rows="3"
                value={audioTranscript}
                onChange={(e) => {
                  setAudioTranscript(e.target.value);
                  setIsManualMode(true);
                }}
                placeholder="Ej: Reforma de baño de 6 m2, tirar bañera y alicatar con porcelánico rectificado..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400 font-sans"
              ></textarea>
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
