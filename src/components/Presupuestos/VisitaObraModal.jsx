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
  HardHat,
  Trash2,
  Plus,
  Image as ImageIcon,
  Volume2,
  Square,
  FileAudio,
  Check
} from 'lucide-react';
import { VISITA_TEMPLATES } from '../../services/siteVisitAIService';
import confetti from 'canvas-confetti';
import { processScopeWithAI, transcribeAudio } from '../../services/aiAudioTextService';
import AudioVoiceRecorder from '../Common/AudioVoiceRecorder';
import AiImprovementControl from '../Common/AiImprovementControl';

export default function VisitaObraModal({ isOpen, onClose, onQuoteCreated }) {
  const {
    basePrecios,
    generateQuoteFromSiteVisit,
    addPresupuesto,
    empresaConfig,
    showNotification,
    referenceBudgets
  } = useApp();

  const backdropRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  const activeRefBudgets = (referenceBudgets || []).filter(b => b.is_active);

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
  const [audioFile, setAudioFile] = useState(null);
  const [audioTranscript, setAudioTranscript] = useState(VISITA_TEMPLATES[0].audioMuestra);
  const [audioRefinedText, setAudioRefinedText] = useState('');
  const [isRefiningAudio, setIsRefiningAudio] = useState(false);

  // Anotaciones & WhatsApp / Email text
  const [complementaryText, setComplementaryText] = useState('');
  const [notesRefinedText, setNotesRefinedText] = useState('');
  const [isRefiningNotes, setIsRefiningNotes] = useState(false);

  // Documents State (PDF, Word, Excel)
  const [documentos, setDocumentos] = useState([]);
  const docFileInputRef = useRef(null);

  // Captures
  const [capturas, setCapturas] = useState([]);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [customPhotoTitle, setCustomPhotoTitle] = useState('');
  const photoFileInputRef = useRef(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepLabel, setStepLabel] = useState('');

  // Structured Review State
  const [generatedQuoteResult, setGeneratedQuoteResult] = useState(null);

  if (!isOpen) return null;

  // Refine text via AI using historical reference budgets
  const handleRefineAudioWithAI = async () => {
    if (!audioTranscript?.trim()) {
      showNotification('No hay audio transcrito para mejorar.', 'error');
      return;
    }
    setIsRefiningAudio(true);
    try {
      const result = await processScopeWithAI(
        audioTranscript,
        'nota_voz',
        obraTitulo,
        empresaConfig?.aiConfig || {},
        basePrecios,
        referenceBudgets
      );
      if (result?.redaccion_tecnica_estilo) {
        setAudioRefinedText(result.redaccion_tecnica_estilo);
        showNotification('✨ Transcripción convertida a redacción técnica profesional.');
      } else {
        setAudioRefinedText(result?.resumen_alcance || audioTranscript);
      }
    } catch (err) {
      console.error('Error al mejorar audio con IA:', err);
      showNotification('No se pudo redactar la versión técnica: ' + (err.message || 'Error de IA'), 'error');
    } finally {
      setIsRefiningAudio(false);
    }
  };

  const handleRefineNotesWithAI = async () => {
    if (!complementaryText?.trim()) {
      showNotification('No hay anotaciones ni medidas para mejorar.', 'error');
      return;
    }
    setIsRefiningNotes(true);
    try {
      const result = await processScopeWithAI(
        complementaryText,
        'email_cliente',
        obraTitulo,
        empresaConfig?.aiConfig || {},
        basePrecios,
        referenceBudgets
      );
      if (result?.redaccion_tecnica_estilo) {
        setNotesRefinedText(result.redaccion_tecnica_estilo);
        showNotification('✨ Anotaciones convertidas a lenguaje técnico presupuestario.');
      } else {
        setNotesRefinedText(result?.resumen_alcance || complementaryText);
      }
    } catch (err) {
      console.error('Error al mejorar notas con IA:', err);
      showNotification('No se pudo redactar la versión técnica: ' + (err.message || 'Error de IA'), 'error');
    } finally {
      setIsRefiningNotes(false);
    }
  };

  const handleDocumentUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file, index) => {
      const newDoc = {
        id: `doc-${Date.now()}-${index}`,
        nombre: file.name,
        tamano: `${(file.size / 1024).toFixed(0)} KB`,
        tipo: file.name.endsWith('.pdf') ? 'PDF' : file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ? 'Excel' : 'Word',
        file
      };
      setDocumentos(prev => [...prev, newDoc]);
    });

    e.target.value = '';
    showNotification(`📄 ${files.length} documento(s) adjuntado(s) para análisis de la IA.`);
  };

  const handleDeleteDocument = (id) => {
    setDocumentos(prev => prev.filter(d => d.id !== id));
    showNotification('Documento eliminado del expediente.');
  };

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
    setAudioRefinedText('');
    setNotesRefinedText('');
    setGeneratedQuoteResult(null);
  };

  const handleDevicePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach((file, index) => {
      const objectUrl = URL.createObjectURL(file);
      const newCap = {
        id: `cap-file-${Date.now()}-${index}`,
        tipo: 'foto_estado',
        titulo: file.name.replace(/\.[^/.]+$/, ''),
        url: objectUrl,
        isLocalBlob: true,
        notas: `Evidencia fotográfica tomada en obra (${(file.size / 1024).toFixed(0)} KB)`
      };
      setCapturas(prev => [newCap, ...prev]);
    });

    e.target.value = '';
    showNotification(`📸 ${files.length} foto(s) añadida(s) para análisis de la IA.`);
  };

  const handleDeleteCapture = (id) => {
    setCapturas(prev => {
      const target = prev.find(c => c.id === id);
      if (target?.isLocalBlob && target.url) {
        try {
          URL.revokeObjectURL(target.url);
        } catch (e) {}
      }
      return prev.filter(c => c.id !== id);
    });
    showNotification('Foto eliminada del expediente.');
  };

  const handleClearAllCaptures = () => {
    capturas.forEach(c => {
      if (c.isLocalBlob && c.url) {
        try {
          URL.revokeObjectURL(c.url);
        } catch (e) {}
      }
    });
    setCapturas([]);
    showNotification('Todas las fotos han sido descartadas.');
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
    const realUploadedCapturas = (capturas || []).filter(c => c.isLocalBlob || (c.url && !c.url.includes('images.unsplash.com')));

    if (!audioTranscript?.trim() && !complementaryText?.trim() && realUploadedCapturas.length === 0 && !audioFile) {
      showNotification('Por favor, graba un audio, añade notas de texto o sube fotos antes de generar el presupuesto.', 'error');
      return;
    }

    setIsProcessing(true);
    let effectiveTranscript = audioTranscript;

    if (audioFile && (!effectiveTranscript || !effectiveTranscript.trim())) {
      setStepLabel('Transcribiendo audio de la visita con IA...');
      try {
        const transRes = await transcribeAudio(audioFile, empresaConfig?.aiConfig || {});
        if (transRes?.text) {
          effectiveTranscript = transRes.text;
          setAudioTranscript(transRes.text);
        }
      } catch (err) {
        console.warn('Fallo al auto-transcribir audio antes del pipeline:', err);
      }
    }

    const finalAudioText = audioRefinedText?.trim() || effectiveTranscript;
    const finalNotesText = notesRefinedText?.trim() || complementaryText;
    const docsSummary = documentos.length > 0 ? `\n\n[DOCUMENTOS ADJUNTOS PARA ANÁLISIS]:\n` + documentos.map(d => `- Documento: ${d.nombre} (${d.tipo}, ${d.tamano})`).join('\n') : '';

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
      audioTranscripcion: finalAudioText,
      audioBlob: audioFile,
      capturas: realUploadedCapturas,
      medidasNotas: (finalNotesText ? `${finalNotesText}${docsSummary}\n\nCalidades solicitadas: ${calidades}.` : `Medidas tomadas in situ con distanciómetro láser.${docsSummary}\nCalidades: ${calidades}.`),
      documentos
    };

    try {
      const newQuote = await generateQuoteFromSiteVisit(expedienteData, (progress) => {
        setCurrentStep(progress.step);
        setStepLabel(progress.label);
      });

      setIsProcessing(false);
      setGeneratedQuoteResult(newQuote);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      showNotification('✨ Análisis de IA finalizado. Revisa los conceptos estructurados antes de aplicarlos.');
    } catch (err) {
      console.error('Error generating quote from site visit', err);
      setIsProcessing(false);
      showNotification(`Error al procesar el expediente: ${err.message || 'Revisa la configuración del motor de IA'}`, 'error');
    }
  };

  const handleApplyStructuredQuote = () => {
    if (!generatedQuoteResult) return;
    onClose();
    if (onQuoteCreated) {
      onQuoteCreated(generatedQuoteResult);
    }
    showNotification(`¡Presupuesto ${generatedQuoteResult.numero} aplicado a la tabla con éxito!`);
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto transition-all duration-200 ease-out"
    >
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col text-slate-100 transform transition-all duration-200 ease-out scale-100">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">🚀 Asistente de Presupuestación IA 360°</h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  Multimodal AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Captura unificada en campo: fotografías, grabación de voz, anotaciones, mediciones y JSON estructurado.
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

            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-2 flex-wrap">
              <span>Usando motor activo: <strong className="text-slate-300">{empresaConfig.aiConfig?.provider?.toUpperCase() || 'GOOGLE'} ({empresaConfig.aiConfig?.modelName || 'gemini-1.5-flash'})</strong></span>
            </p>
          </div>
        )}

        {/* Structured Review Screen */}
        {!isProcessing && generatedQuoteResult && (
          <div className="p-6 space-y-5 bg-slate-950/80 flex-1">
            <div className="bg-emerald-950/30 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white">Respuesta Estructurada de Gemini Lista</h3>
                  <p className="text-xs text-emerald-300/80">Revisa la propuesta técnica, observaciones e ítems antes de volcarlos al presupuesto.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setGeneratedQuoteResult(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition"
              >
                Volver a Editar Visita
              </button>
            </div>

            {/* Resumen General */}
            {generatedQuoteResult.resumen && (
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1.5">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">Resumen General de la Obra</span>
                <p className="text-xs text-slate-200 leading-relaxed">{generatedQuoteResult.resumen}</p>
              </div>
            )}

            {/* Observaciones Técnicas */}
            {generatedQuoteResult.observaciones_tecnicas && generatedQuoteResult.observaciones_tecnicas.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">Observaciones Técnicas y Advertencias</span>
                <ul className="space-y-1">
                  {generatedQuoteResult.observaciones_tecnicas.map((obs, idx) => (
                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tabla de Conceptos e Ítems */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Conceptos Sugeridos ({generatedQuoteResult.conceptos?.length || generatedQuoteResult.partidas?.length || 0} ítems)
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Total Estimado: {generatedQuoteResult.totalConIva?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2 px-2">Cód</th>
                      <th className="py-2 px-2">Descripción del Concepto</th>
                      <th className="py-2 px-2 text-center">Unidad</th>
                      <th className="py-2 px-2 text-right">Cantidad</th>
                      <th className="py-2 px-2 text-right">Precio Sugerido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(generatedQuoteResult.conceptos || generatedQuoteResult.partidas || []).map((c, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="py-2 px-2 font-mono text-[11px] text-amber-400 font-bold">{c.codigo || `PAR-${i+1}`}</td>
                        <td className="py-2 px-2 text-slate-200">{c.descripcion || c.concepto}</td>
                        <td className="py-2 px-2 text-center font-mono">{c.unidad}</td>
                        <td className="py-2 px-2 text-right font-mono">{c.cantidad}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-400">
                          {(c.precio_unitario_sugerido || c.precioVenta || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Apply Button Positioned Bottom Right as per AGENTS.md */}
            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleApplyStructuredQuote}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-2 active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Aplicar Conceptos al Presupuesto Final</span>
              </button>
            </div>
          </div>
        )}

        {!isProcessing && !generatedQuoteResult && (
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
                          <span className="text-slate-400 font-medium">Solo dictado de muestra</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* In Situ Multimodal Capture Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <AudioVoiceRecorder
                  title="🎤 Grabación o Subida de Audio"
                  initialTranscript={audioTranscript}
                  placeholder="Pulsa 'Grabar con Micrófono' o 'Añadir Audio' para transcribir la explicación de la obra..."
                  onTranscriptChange={(text, blob) => {
                    setAudioTranscript(text);
                    if (blob) setAudioFile(blob);
                    setIsManualMode(true);
                  }}
                />

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                  <AiImprovementControl
                    value={audioTranscript}
                    onAccept={(improved) => {
                      setAudioTranscript(improved);
                      setAudioRefinedText(improved);
                    }}
                    context="Transcripción y notas de voz de visita de obra"
                    buttonLabel="Mejorar Transcripción con IA"
                  />
                </div>
              </div>

              {/* Anotaciones Manuales / WhatsApp / Emails */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>📝 Anotaciones, Mensajes de WhatsApp o Correo</span>
                  </span>
                  {complementaryText && (
                    <button
                      type="button"
                      onClick={() => { setComplementaryText(''); setNotesRefinedText(''); }}
                      className="text-[10px] text-slate-500 hover:text-rose-400 transition"
                    >
                      Limpiar notas
                    </button>
                  )}
                </div>

                <textarea
                  rows="3"
                  value={complementaryText}
                  onChange={(e) => {
                    setComplementaryText(e.target.value);
                    setIsManualMode(true);
                  }}
                  placeholder="Pega mensajes de WhatsApp, correos del cliente o notas in situ..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition"
                ></textarea>

                <AiImprovementControl
                  value={complementaryText}
                  onAccept={(improved) => {
                    setComplementaryText(improved);
                    setNotesRefinedText(improved);
                  }}
                  context="Anotaciones, mediciones y alcance de la obra"
                  buttonLabel="Mejorar Notas con IA"
                  buttonSize="small"
                />
              </div>

              {/* Mediciones Manuales */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  <span>📏 Mediciones y Unidades de Obra In Situ</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block font-semibold">Largo (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="ej: 4.8"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) setComplementaryText(prev => `${prev}\n- Largo medido: ${val}m`);
                      }}
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block font-semibold">Ancho (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="ej: 3.2"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) setComplementaryText(prev => `${prev}\n- Ancho medido: ${val}m`);
                      }}
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block font-semibold">Alto (m)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="ej: 2.5"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) setComplementaryText(prev => `${prev}\n- Alto medido: ${val}m`);
                      }}
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block font-semibold">Estancia / Zona</label>
                    <input
                      type="text"
                      placeholder="ej: Salón / Baño 1"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) setComplementaryText(prev => `${prev}\n- Zona: ${val}`);
                      }}
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Adjuntar Documentos PDF, Word, Excel */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>📄 Documentos Adicionales (PDF, Word, Excel, Planos)</span>
                  </span>
                  <input
                    type="file"
                    ref={docFileInputRef}
                    onChange={handleDocumentUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => docFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Adjuntar Documentos</span>
                  </button>
                </div>

                {documentos.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No se han adjuntado archivos PDF, Word o Excel.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {documentos.map(doc => (
                      <div key={doc.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{doc.nombre}</p>
                            <span className="text-[10px] text-slate-400">{doc.tipo} · {doc.tamano}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Captures: Photos, Laser Sketches, OCR */}
            <div className="bg-slate-950 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                      <span>2. Evidencias Visuales de Obra (Archivos Subidos)</span>
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        {capturas.length === 0 ? '0 fotos subidas' : `${capturas.length} ${capturas.length === 1 ? 'foto subida' : 'fotos subidas'}`}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <input
                    type="file"
                    ref={photoFileInputRef}
                    onChange={handleDevicePhotoUpload}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => photoFileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Fotos</span>
                  </button>

                  {capturas.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllCaptures}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold rounded-xl text-xs flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Descartar todas</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Gallery of Captures */}
              {capturas.length === 0 ? (
                <div className="border-2 border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-2">
                  <Camera className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">No se han subido fotos de obra.</p>
                  <button
                    type="button"
                    onClick={() => photoFileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 mt-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir fotos del dispositivo o tomar con cámara</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {capturas.map((cap) => (
                    <div key={cap.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden group relative hover:border-slate-700 transition">
                      <div className="h-28 overflow-hidden relative bg-slate-950">
                        <img src={cap.url} alt={cap.titulo} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCapture(cap.id);
                          }}
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center transition shadow-md hover:scale-110 active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2.5 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-white truncate">{cap.titulo}</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{cap.notas}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

        {/* Footer Actions - Positioned Bottom Right as required by AGENTS.md */}
        {!isProcessing && !generatedQuoteResult && (
          <div className="p-5 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Base Oficial de Precios ({basePrecios.length} partidas)</span>
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
                <span>🚀 Generar Presupuesto con IA</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
