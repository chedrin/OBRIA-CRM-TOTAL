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
  FileAudio
} from 'lucide-react';
import { VISITA_TEMPLATES } from '../../services/siteVisitAIService';
import confetti from 'canvas-confetti';
import { processScopeWithAI, transcribeAudio } from '../../services/aiAudioTextService';

export default function VisitaObraModal({ isOpen, onClose, onQuoteCreated }) {
  const {
    basePrecios,
    generateQuoteFromSiteVisit,
    addPresupuesto,
    empresaConfig,
    showNotification,
    referenceBudgets
  } = useApp();

  if (!isOpen) return null;

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
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioTranscript, setAudioTranscript] = useState(VISITA_TEMPLATES[0].audioMuestra);
  const [complementaryText, setComplementaryText] = useState('');

  const recordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioFileInputRef = useRef(null);

  // Limpiar timers y streams al desmontar
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioPreviewUrl) {
        try { URL.revokeObjectURL(audioPreviewUrl); } catch {}
      }
    };
  }, [audioPreviewUrl]);

  // Subir archivo de audio desde el dispositivo (.mp3, .wav, .m4a, .ogg, .webm)
  const handleAudioFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (audioPreviewUrl) {
      try { URL.revokeObjectURL(audioPreviewUrl); } catch {}
    }

    const preview = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioPreviewUrl(preview);
    setIsManualMode(true);
    showNotification(`🎙️ Audio "${file.name}" cargado. Transcribiendo con IA...`);

    // Transcribir automáticamente con IA al cargar el archivo
    await handleTranscribeAudio(file);
  };

  // Transcribir audio a texto mediante IA (Gemini / Whisper / Backend)
  const handleTranscribeAudio = async (targetFile = null) => {
    const fileToProcess = targetFile || audioFile;
    if (!fileToProcess) {
      showNotification('Primero debes grabar con micrófono o subir un archivo de audio.', 'error');
      return;
    }

    setIsTranscribingAudio(true);
    try {
      const res = await transcribeAudio(fileToProcess, empresaConfig?.aiConfig || {});
      if (res && res.text) {
        setAudioTranscript(res.text);
        setIsManualMode(true);
        showNotification('✨ Audio transcribido con éxito por la Inteligencia Artificial.');
      } else {
        showNotification('No se detectó voz clara en el audio.', 'error');
      }
    } catch (err) {
      console.error('Error al transcribir audio:', err);
      showNotification(`Error al transcribir: ${err.message || 'Fallo de conexión'}`, 'error');
    } finally {
      setIsTranscribingAudio(false);
    }
  };

  // Descartar audio cargado
  const handleDiscardAudio = () => {
    if (audioPreviewUrl) {
      try { URL.revokeObjectURL(audioPreviewUrl); } catch {}
    }
    setAudioFile(null);
    setAudioPreviewUrl(null);
    showNotification('Audio descartado.');
  };

  // Grabar audio con micrófono del dispositivo
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const mimeType = mr.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
        const recordedFile = new File([blob], `grabacion-visita-${Date.now()}.${ext}`, { type: mimeType });

        if (audioPreviewUrl) {
          try { URL.revokeObjectURL(audioPreviewUrl); } catch {}
        }
        const preview = URL.createObjectURL(blob);
        setAudioFile(recordedFile);
        setAudioPreviewUrl(preview);
        setIsManualMode(true);

        stream.getTracks().forEach(t => t.stop());
        await handleTranscribeAudio(recordedFile);
      };

      mr.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
      showNotification('🎙️ Grabando audio de la visita...');
    } catch (err) {
      console.error('Error al acceder al micrófono:', err);
      showNotification('No se pudo acceder al micrófono. Comprueba los permisos en tu navegador o sube un archivo de audio.', 'error');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Quick Scope Transform with AI
  const handleTransformWithAI = async () => {
    const realUploadedCapturas = (capturas || []).filter(c => c.isLocalBlob || (c.url && !c.url.includes('images.unsplash.com')));
    const capturasNotes = realUploadedCapturas.length > 0
      ? `[FOTOGRAFÍAS REALES SUBIDAS (${realUploadedCapturas.length})]:\n` + realUploadedCapturas.map((c, i) => `${i + 1}. ${c.titulo} - ${c.notas || 'Evidencia fotográfica real'}`).join('\n')
      : '';

    const combinedInput = [
      audioTranscript ? `[AUDIO TRANSCRITO DE LA VISITA]:\n${audioTranscript}` : '',
      complementaryText ? `[ANOTACIONES Y MEDICIONES IN SITU]:\n${complementaryText}` : '',
      capturasNotes
    ].filter(Boolean).join('\n\n');

    if (!combinedInput.trim()) {
      showNotification('Por favor, graba un audio o escribe notas técnicas antes de procesar con IA.', 'error');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(2);
    setStepLabel(activeRefBudgets.length > 0 
      ? `Analizando pliegos (${activeRefBudgets.length} modelos de referencia RAG) y generando partidas...`
      : 'Analizando requerimientos técnicos y generando partidas normalizadas...');

    try {
      const aiResult = await processScopeWithAI(
        combinedInput,
        'visita_obra',
        null,
        empresaConfig?.aiConfig || {},
        basePrecios,
        referenceBudgets
      );

      // Convert chapters & items into full quote line items
      const allItems = [];
      (aiResult.capitulos || []).forEach(cap => {
        (cap.partidas || []).forEach(part => {
          const med = Number(part.cantidad || part.medicion) || 1;
          const pvp = Number(part.precioUnitario || part.precio_unitario_estimado || part.precioVenta) || 50;
          const cost = Number(part.costeUnitario) || Number((pvp * 0.7).toFixed(2));
          const tot = Number(part.total || part.total_estimado) || Number((med * pvp).toFixed(2));

          allItems.push({
            id: part.id || `par-vis-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            codigo: part.codigo || 'GEN-01',
            capitulo: cap.nombre_capitulo || cap.nombre || 'General',
            concepto: part.concepto || part.titulo || part.descripcion || 'Partida técnica',
            unidad: part.unidad || 'ud',
            cantidad: med,
            costeUnitario: cost,
            precioVenta: pvp,
            margenPct: Number(margenObjetivo) || 30,
            total: tot
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
      showNotification(`Error de IA: ${err.message || 'Fallo al procesar las partidas'}`, 'error');
    }
  };

  // Captures (Only real uploaded photos from device / camera)
  const [capturas, setCapturas] = useState([]);
  const [customPhotoUrl, setCustomPhotoUrl] = useState('');
  const [customPhotoTitle, setCustomPhotoTitle] = useState('');
  const photoFileInputRef = useRef(null);
  const audioDirectFileInputRef = useRef(null);

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
    // No se cargan fotos de muestra: solo se tendrán en cuenta las fotos subidas por el usuario
  };

  // Upload local photos from device / camera
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

  // Delete a specific photo
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

  // Clear / Discard all photos
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

    // Si hay archivo de audio y aún no se ha transcrito, transcribirlo primero
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
      audioTranscripcion: effectiveTranscript,
      audioBlob: audioFile,
      capturas: realUploadedCapturas,
      medidasNotas: complementaryText ? `${complementaryText}\n\nCalidades solicitadas: ${calidades}.` : `Medidas tomadas in situ con distanciómetro láser. Calidades: ${calidades}.`
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
      showNotification(`Error al procesar el expediente: ${err.message || 'Revisa la configuración del motor de IA'}`, 'error');
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
                  Gemini Multimodal
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

            <p className="text-[11px] text-slate-500 flex items-center justify-center gap-2 flex-wrap">
              <span>Usando motor activo: <strong className="text-slate-300">{empresaConfig.aiConfig?.provider?.toUpperCase() || 'OPENAI'} ({empresaConfig.aiConfig?.modelName || 'gpt-4o'})</strong></span>
              {activeRefBudgets.length > 0 && (
                <span className="text-indigo-400 font-semibold">· 🧠 {activeRefBudgets.length} Presupuestos Modelo RAG Activos</span>
              )}
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
                          <span className="text-slate-400 font-medium">Solo dictado de muestra</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* In Situ Multimodal Capture Section (Audio + Transcripción IA + Mediciones) */}
            <div className="bg-slate-950 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                      <span>1. Captura de Audio de Visita y Transcripción con IA</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                        Whisper & Gemini
                      </span>
                      {activeRefBudgets.length > 0 && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <span>🧠 {activeRefBudgets.length} PDFs Modelo</span>
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Graba la explicación de la obra o añade un archivo de audio para que la IA lo transcriba a texto automáticamente.
                    </p>
                  </div>
                </div>

                {/* Botones de Acción de Audio Perfectamente Alineados */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Botón 1: Grabar con Micrófono */}
                  {isRecording ? (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="px-3.5 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black rounded-xl text-xs flex items-center gap-2 transition shadow-lg shadow-rose-600/30 animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 fill-white" />
                      <span>Detener Grabación ({recordingSeconds}s)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/20"
                    >
                      <Mic className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Grabar Micrófono</span>
                    </button>
                  )}

                  {/* Input oculto para subir archivo de audio */}
                  <input
                    type="file"
                    ref={audioFileInputRef}
                    onChange={handleAudioFileUpload}
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                    className="hidden"
                  />

                  {/* Botón 2: Añadir Audio */}
                  <button
                    type="button"
                    onClick={() => audioFileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-amber-400/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                    title="Subir un archivo de audio grabado (.mp3, .m4a, .wav, .ogg)"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Añadir Audio</span>
                  </button>

                  {/* Botón 3: Transcribir a Texto por IA */}
                  <button
                    type="button"
                    onClick={() => handleTranscribeAudio()}
                    disabled={isTranscribingAudio || (!audioFile && !audioTranscript)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                      isTranscribingAudio
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-wait'
                        : audioFile
                        ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 active:scale-95'
                        : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                    }`}
                    title="Enviar el audio cargado a la IA para transcribirlo a texto"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isTranscribingAudio ? 'animate-spin' : ''}`} />
                    <span>{isTranscribingAudio ? 'Transcribiendo...' : 'Transcribir a Texto por IA'}</span>
                  </button>

                  {/* Botón 4: Descartar Audio si existe */}
                  {audioFile && (
                    <button
                      type="button"
                      onClick={handleDiscardAudio}
                      className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl text-xs transition"
                      title="Descartar este audio"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Reproductor de Audio si hay un archivo grabado o subido */}
              {audioPreviewUrl && (
                <div className="bg-slate-900 border border-amber-500/30 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      <FileAudio className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 text-left">
                      <p className="text-xs font-bold text-white truncate">{audioFile?.name || 'Grabación de Visita'}</p>
                      <p className="text-[10px] text-slate-400">
                        {audioFile?.size ? `${(audioFile.size / 1024).toFixed(1)} KB` : 'Grabado en navegador'} · Listo para procesar con IA
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <audio controls src={audioPreviewUrl} className="h-8 max-w-[260px] w-full" />
                    <button
                      type="button"
                      onClick={() => handleTranscribeAudio()}
                      disabled={isTranscribingAudio}
                      className="px-3 py-1.5 bg-amber-500 text-slate-950 hover:bg-amber-400 font-black rounded-lg text-[11px] flex items-center gap-1 shrink-0 transition shadow-sm active:scale-95"
                    >
                      <Sparkles className="w-3 h-3 fill-slate-950" />
                      <span>{isTranscribingAudio ? 'Transcribiendo...' : 'Transcribir'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Grid 2 Columnas: A. Audio Transcrito / Dictado y B. Mediciones y Anotaciones In Situ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Columna A: Audio Transcrito */}
                <div className="space-y-2 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>A. Audio Transcrito / Dictado Técnico</span>
                    </span>
                    {audioTranscript && (
                      <button
                        type="button"
                        onClick={() => setAudioTranscript('')}
                        className="text-[10px] text-slate-500 hover:text-rose-400 transition"
                      >
                        Limpiar transcripción
                      </button>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-3 min-h-[170px]">
                    <textarea
                      rows="6"
                      value={audioTranscript}
                      onChange={(e) => {
                        setAudioTranscript(e.target.value);
                        setIsManualMode(true);
                      }}
                      placeholder="Pulsa 'Grabar Micrófono' o 'Añadir Audio' y luego 'Transcribir a Texto por IA'. También puedes escribir o retocar el dictado aquí..."
                      className="w-full flex-1 bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none resize-none font-sans"
                    ></textarea>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{audioTranscript ? `${audioTranscript.length} caracteres` : 'Sin audio transcrito'}</span>
                      <span className="text-amber-400/80 text-[10px]">
                        {isTranscribingAudio ? 'Transcribiendo con IA...' : 'Editable por el usuario'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Columna B: Entrada por Texto / Mediciones In Situ */}
                <div className="space-y-2 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-blue-400" />
                      <span>B. Mediciones Láser & Notas In Situ</span>
                    </span>
                    {complementaryText && (
                      <button
                        type="button"
                        onClick={() => setComplementaryText('')}
                        className="text-[10px] text-slate-500 hover:text-rose-400 transition"
                      >
                        Limpiar notas
                      </button>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-3 min-h-[170px]">
                    <textarea
                      rows="6"
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
                      <span className="text-blue-400/80 text-[10px]">Complementa el audio para la IA</span>
                    </div>
                  </div>
                </div>
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
                    <p className="text-[11px] text-slate-400">
                      Sube las fotos reales de la obra. La IA procesará exclusivamente las imágenes que subas aquí junto al audio transcrito.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {/* Upload from device / camera */}
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

                  {/* Clear all photos */}
                  {capturas.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllCaptures}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold rounded-xl text-xs flex items-center gap-1 transition"
                      title="Descartar todas las fotos cargadas"
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
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    El presupuesto IA se generará únicamente a partir del audio transcrito y las notas in situ, a menos que adjuntes imágenes.
                  </p>
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
                        <span className="absolute top-1.5 left-1.5 bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold">
                          {cap.tipo === 'croquis' ? '📐 Croquis Láser' : '📷 Estado Actual'}
                        </span>

                        {/* Direct Delete / Discard Photo Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCapture(cap.id);
                          }}
                          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white flex items-center justify-center transition shadow-md hover:scale-110 active:scale-95"
                          title="Eliminar / descartar esta foto del presupuesto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2.5 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-white truncate">{cap.titulo}</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{cap.notas}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteCapture(cap.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition shrink-0"
                          title="Eliminar evidencia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Custom Photo / Sketch Link */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-800/60">
                <input
                  type="text"
                  placeholder="O pega URL de foto o croquis externo..."
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
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl text-xs transition shrink-0"
                >
                  + Añadir Enlace
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
                <span>🚀 Generar Presupuesto con IA</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
