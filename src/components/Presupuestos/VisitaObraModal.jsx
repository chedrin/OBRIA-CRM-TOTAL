import React, { useState, useEffect, useRef } from 'react';
import BarraProgreso from '../Common/BarraProgreso';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Camera,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Sliders,
  ChevronRight,
  Trash2,
  Plus,
  Check,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { isValidNif } from '../../utils/nifValidator';
import confetti from 'canvas-confetti';
import { transcribeAudio } from '../../services/aiAudioTextService';
import AudioVoiceRecorder from '../Common/AudioVoiceRecorder';
import AiImprovementControl from '../Common/AiImprovementControl';
import EscaneoLidarSubida from '../Croquis/EscaneoLidarSubida';
import { textoMedicionesEscaneo } from '../../utils/escaneoLidar';

export const TIPOS_CLIENTE = [
  { id: 'particular', label: 'Particular' },
  { id: 'comunidad', label: 'Comunidad de propietarios' },
  { id: 'empresa', label: 'Empresa / Autónomo' },
  { id: 'constructor', label: 'Constructor o promotor (subcontrata)' },
  { id: 'administracion', label: 'Administración pública' }
];

export const FISCALIDADES = [
  { id: 'iva10', label: 'IVA 10% · reforma de vivienda para uso particular', short: 'IVA 10%', tipoIva: 10 },
  { id: 'iva21', label: 'IVA 21% · tipo general', short: 'IVA 21%', tipoIva: 21 },
  { id: 'isp', label: 'Inversión del sujeto pasivo (art. 84.Uno.2º.f LIVA)', short: 'ISP (sin IVA repercutido)', tipoIva: 0 },
  { id: 'exento', label: 'Exento de IVA', short: 'Exento de IVA', tipoIva: 0 }
];

export const CONDICIONES_PAGO = [
  { id: '40-40-20', label: '40% firma · 40% avance de obra · 20% entrega' },
  { id: '50-50', label: '50% inicio · 50% a la finalización' },
  { id: '30-40-30', label: '30% firma · 40% mitad de obra · 30% entrega' },
  { id: 'certificaciones', label: 'Certificaciones mensuales según avance' },
  { id: 'final', label: '100% a la finalización' },
  { id: 'otra', label: 'Otra (personalizada)' }
];

// inline = se muestra dentro de la página de Presupuestos en lugar de como ventana emergente.
export default function VisitaObraModal({ isOpen, onClose, onQuoteCreated, inline = false }) {
  const {
    basePrecios,
    generateQuoteFromSiteVisit,
    addPresupuesto,
    empresaConfig,
    showNotification,
    referenceBudgets
  } = useApp();

  const backdropRef = useRef(null);

  const handleBackdropClick = (e) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  const activeRefBudgets = (referenceBudgets || []).filter(b => b.is_active);

  // Form Fields (expediente vacío: sin datos de muestra)
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [obraTitulo, setObraTitulo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [calidades, setCalidades] = useState('Media-Alta (Confort Plus)');
  const [plazoDeseado, setPlazoDeseado] = useState('');
  const [margenObjetivo, setMargenObjetivo] = useState(30);
  // Paso 1 (obligatorio): parámetros del cliente y condiciones económicas
  const [wizardStep, setWizardStep] = useState(1);
  const [tipoCliente, setTipoCliente] = useState('');
  const [clienteNif, setClienteNif] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('40-40-20');
  const [condicionesPagoOtra, setCondicionesPagoOtra] = useState('');
  const [fiscalidad, setFiscalidad] = useState('iva10');
  const [retencionIrpf, setRetencionIrpf] = useState(0);
  const [validezDias, setValidezDias] = useState(30);
  const [paramsTouched, setParamsTouched] = useState(false);
  const [validatedSignature, setValidatedSignature] = useState(null);

  // Audio Recording & Text Input State
  const [audioFile, setAudioFile] = useState(null);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioRefinedText, setAudioRefinedText] = useState('');
  // Cambia cada vez que termina una transcripción: la IA mejora el texto sola.

  // Anotaciones & WhatsApp / Email text
  const [complementaryText, setComplementaryText] = useState('');
  const [notesRefinedText, setNotesRefinedText] = useState('');
  const [medicion, setMedicion] = useState({ largo: '', ancho: '', alto: '', zona: '' });
  // Croquis sacado del escaneo LiDAR: se guarda con el presupuesto generado.
  const [croquisEscaneo, setCroquisEscaneo] = useState(null);
  const lidarActivo = Boolean(empresaConfig?.escaneoLidar?.activo);

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
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pipelineError, setPipelineError] = useState('');

  // Structured Review State
  const [generatedQuoteResult, setGeneratedQuoteResult] = useState(null);

  // Cronómetro de la barra de progreso mientras la IA procesa el expediente.
  useEffect(() => {
    if (!isProcessing) return undefined;
    setElapsedSec(0);
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(timer);
  }, [isProcessing]);

  if (!isOpen) return null;

  const tipoIva = FISCALIDADES.find(f => f.id === fiscalidad)?.tipoIva ?? 21;
  const condicionesPagoTexto = condicionesPago === 'otra'
    ? condicionesPagoOtra.trim()
    : CONDICIONES_PAGO.find(c => c.id === condicionesPago)?.label || '';

  // Validación de los parámetros base. Sin ellos no se puede dictar ni generar.
  const paramErrors = {};
  if (clienteNombre.trim().length < 2) paramErrors.clienteNombre = 'Indica el nombre del cliente.';
  if (!tipoCliente) paramErrors.tipoCliente = 'Elige el tipo de cliente.';
  if (!obraTitulo.trim()) paramErrors.obraTitulo = 'Pon un título a la obra.';
  if (direccion.trim().length < 5) paramErrors.direccion = 'Escribe la dirección de la obra.';
  if (clienteNif.trim() && !isValidNif(clienteNif)) paramErrors.clienteNif = 'El NIF/CIF no es válido (revisa la letra de control).';
  else if (tipoCliente && tipoCliente !== 'particular' && !clienteNif.trim()) paramErrors.clienteNif = 'Para este tipo de cliente el NIF/CIF es obligatorio.';
  if (clienteEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clienteEmail.trim())) paramErrors.clienteEmail = 'El email no es válido.';
  if (!(margenObjetivo >= 5 && margenObjetivo <= 60)) paramErrors.margenObjetivo = 'El margen debe estar entre 5% y 60%.';
  if (condicionesPago === 'otra' && condicionesPagoOtra.trim().length < 5) paramErrors.condicionesPagoOtra = 'Describe las condiciones de pago.';
  if (fiscalidad === 'isp' && tipoCliente !== 'constructor') paramErrors.fiscalidad = 'La inversión del sujeto pasivo solo aplica si el cliente es un constructor o promotor (subcontrata).';
  if (retencionIrpf > 0 && tipoCliente === 'particular') paramErrors.retencionIrpf = 'Un particular no practica retenciones de IRPF.';

  const paramWarnings = [];
  if (fiscalidad === 'iva10' && ['empresa', 'administracion'].includes(tipoCliente)) {
    paramWarnings.push('El IVA del 10% solo aplica a reformas de vivienda para uso particular. Revisa si corresponde el 21%.');
  }
  if (fiscalidad === 'iva10') {
    paramWarnings.push('Recuerda: con IVA reducido los materiales aportados no pueden superar el 40% de la base imponible.');
  }
  if (fiscalidad === 'exento') paramWarnings.push('Indica en las notas el artículo de exención aplicable.');

  const paramsSignature = JSON.stringify([clienteNombre, tipoCliente, clienteNif, obraTitulo, direccion, clienteEmail, clienteTelefono, plazoDeseado, calidades, margenObjetivo, validezDias, condicionesPago, condicionesPagoOtra, fiscalidad, retencionIrpf]);
  const paramsValidated = validatedSignature === paramsSignature && Object.keys(paramErrors).length === 0;

  const paramField = (name) => `w-full bg-slate-900 border rounded-xl p-2.5 text-white font-medium focus:outline-none focus:ring-2 transition ${
    paramsTouched && paramErrors[name] ? 'border-rose-500 focus:ring-rose-500/30' : 'border-slate-700 focus:border-amber-400 focus:ring-amber-500/20'
  }`;
  const ParamError = ({ name }) => (paramsTouched && paramErrors[name]
    ? <p data-param-error className="text-[11px] text-rose-400 mt-1">{paramErrors[name]}</p>
    : null);

  const handleTipoClienteChange = (value) => {
    setTipoCliente(value);
    // Valores fiscales por defecto según el tipo de cliente (se pueden cambiar).
    if (value === 'particular' || value === 'comunidad') { setFiscalidad('iva10'); setRetencionIrpf(0); }
    else if (value === 'constructor') setFiscalidad('isp');
    else if (value) setFiscalidad('iva21');
  };

  const handleValidateParams = () => {
    setParamsTouched(true);
    if (Object.keys(paramErrors).length > 0) {
      showNotification('Revisa los parámetros del cliente marcados en rojo.', 'error');
      setTimeout(() => document.querySelector('[data-param-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    setValidatedSignature(paramsSignature);
    setWizardStep(2);
    showNotification('Parámetros validados. Ya puedes dictar o subir la visita.');
  };

  // Una medición = una línea en las anotaciones (ej: "- Salón: 5 x 4 x 2,30 m (superficie 20 m², perímetro 18 m)").
  const handleAddMedicion = () => {
    const toNum = (v) => {
      const n = parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const fmt = (n) => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
    const largo = toNum(medicion.largo);
    const ancho = toNum(medicion.ancho);
    const alto = toNum(medicion.alto);
    const zona = medicion.zona.trim();
    const dims = [largo, ancho, alto].filter(Boolean);
    if (!zona && dims.length === 0) {
      showNotification('Introduce alguna medida o la estancia antes de añadirla.', 'error');
      return;
    }

    const extras = [];
    if (largo && ancho) {
      extras.push(`superficie ${fmt(largo * ancho)} m²`);
      extras.push(`perímetro ${fmt(2 * (largo + ancho))} m`);
      if (alto) extras.push(`paredes ${fmt(2 * (largo + ancho) * alto)} m²`);
    }
    const line = `- ${zona || 'Medición'}${dims.length ? `: ${dims.map(fmt).join(' x ')} m` : ''}${extras.length ? ` (${extras.join(', ')})` : ''}`;

    setComplementaryText(prev => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n${line}` : line));
    setNotesRefinedText('');
    setMedicion({ largo: '', ancho: '', alto: '', zona: '' });
  };

  // Escaneo LiDAR: sus mediciones van a las anotaciones y su planta queda como croquis del presupuesto.
  const handleUsarEscaneo = (res) => {
    if (res.formato === 'imagen') {
      setCapturas(prev => [{
        id: `cap-lidar-${Date.now()}`,
        tipo: 'foto_estado',
        titulo: `Plano del escaneo LiDAR (${res.nombreArchivo})`,
        url: URL.createObjectURL(res.imagen),
        file: res.imagen,
        isLocalBlob: true,
        notas: 'Plano acotado exportado del escaneo LiDAR: sus cotas son medidas reales.'
      }, ...prev]);
      showNotification('Plano del escaneo añadido a las fotos para la IA.');
      return;
    }
    const lineas = textoMedicionesEscaneo(res.plan, res.nombreArchivo);
    setComplementaryText(prev => (prev.trim() ? `${prev.replace(/\s+$/, '')}\n\n${lineas}` : lineas));
    setNotesRefinedText('');
    setCroquisEscaneo({
      plan: res.plan,
      mediciones: res.mediciones,
      notas: `Croquis del escaneo LiDAR «${res.nombreArchivo}».`,
      origen: 'lidar',
      actualizado: new Date().toISOString()
    });
    showNotification(`Mediciones de ${res.plan.rooms.length} estancias añadidas. El croquis se guardará con el presupuesto.`);
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
        file,
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
    if (!paramsValidated) {
      setWizardStep(1);
      setParamsTouched(true);
      showNotification('Primero completa y valida los parámetros del cliente y las condiciones económicas.', 'error');
      return;
    }
    const realUploadedCapturas = (capturas || []).filter(c => c.isLocalBlob || (c.url && !c.url.includes('images.unsplash.com')));

    if (!audioTranscript?.trim() && !complementaryText?.trim() && realUploadedCapturas.length === 0 && !audioFile) {
      showNotification('Por favor, graba un audio, añade notas de texto o sube fotos antes de generar el presupuesto.', 'error');
      return;
    }

    setPipelineError('');
    setCurrentStep(0);
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
      parametrosCliente: {
        tipoCliente,
        tipoClienteLabel: TIPOS_CLIENTE.find(t => t.id === tipoCliente)?.label || tipoCliente,
        nif: clienteNif.trim(),
        margenComercialPct: margenObjetivo,
        condicionesPago: condicionesPagoTexto,
        fiscalidad,
        fiscalidadLabel: FISCALIDADES.find(f => f.id === fiscalidad)?.label || fiscalidad,
        tipoIvaPct: tipoIva,
        inversionSujetoPasivo: fiscalidad === 'isp',
        retencionIrpfPct: retencionIrpf,
        validezDias
      },
      audioTranscripcion: finalAudioText,
      audioBlob: audioFile,
      capturas: realUploadedCapturas,
      croquis: croquisEscaneo,
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
      // El aviso se queda fijo encima del formulario para que no se pierda el motivo.
      setPipelineError(err.message || 'Revisa la configuración del motor de IA.');
      showNotification('No se pudo generar el presupuesto. Mira el detalle encima del formulario.', 'error');
    }
  };

  const handleApplyStructuredQuote = () => {
    if (!generatedQuoteResult) return;
    if (onClose) onClose();
    if (onQuoteCreated) {
      onQuoteCreated(generatedQuoteResult);
    }
    showNotification(`¡Presupuesto ${generatedQuoteResult.numero} aplicado a la tabla con éxito!`);
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={inline ? '' : 'fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto transition-all duration-200 ease-out'}
    >
      <div className={inline
        ? 'bg-slate-900 border border-amber-500/40 rounded-3xl w-full shadow-xl flex flex-col text-slate-100'
        : 'bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col text-slate-100 transform transition-all duration-200 ease-out scale-100'}>
        
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 rounded-t-3xl ${inline ? '' : 'sticky top-0 z-10'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">Asistente de Presupuestación IA 360°</h2>
                <span className="hidden sm:inline text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  Multimodal AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Datos del cliente, dictado de la visita, notas, medidas y fotos en un solo paso.
              </p>
            </div>
          </div>

          {!inline && (
            <button
              onClick={onClose} aria-label="Cerrar"
              disabled={isProcessing}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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

            {(() => {
              const stepFloor = [0, 10, 25, 40, 92][currentStep] || 0;
              const pct = Math.min(97, Math.max(stepFloor, Math.round(95 * (1 - Math.exp(-elapsedSec / 50)))));
              return (
                <div className="w-full max-w-lg space-y-1.5">
                  <BarraProgreso valor={pct} alto="h-6" color="bg-gradient-to-r from-amber-500 to-orange-400" className="border border-slate-700" />
                  <div className="flex justify-between text-[11px] font-mono text-slate-400">
                    <span>{pct}%</span>
                    <span>{elapsedSec}s · puede tardar 1-2 minutos</span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-4 gap-2 w-full max-w-lg pt-4">
              {[
                { s: 1, label: 'Dictado y notas' },
                { s: 2, label: 'Memoria IA y referencias' },
                { s: 3, label: 'Redacción por capítulos' },
                { s: 4, label: 'Precios e IVA' }
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
              <span>Usando motor activo: <strong className="text-slate-300">{empresaConfig.aiConfig?.provider?.toUpperCase() || 'GOOGLE'}{empresaConfig.aiConfig?.modelName ? ` (${empresaConfig.aiConfig.modelName})` : ''}</strong></span>
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
                  <h3 className="text-sm font-bold text-white">Presupuesto por capítulos generado por la IA</h3>
                  <p className="text-xs text-emerald-300/80">Revisa capítulos, redacción y observaciones antes de aplicarlo. Lo que cambies después, la IA lo aprende.</p>
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

            {/* Presupuesto por capítulos */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {generatedQuoteResult.capitulos?.length || 0} capítulos · {generatedQuoteResult.partidas?.length || 0} partidas
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Total con IVA: {generatedQuoteResult.totalConIva?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>

              {(generatedQuoteResult.capitulos || []).map((cap) => (
                <div key={cap.id} className="border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-950 px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-300">{cap.codigo}. {cap.nombre}</span>
                    <span className="text-[11px] font-mono font-bold text-slate-300">{Number(cap.subtotal || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="divide-y divide-slate-800/60">
                    {(cap.partidas || []).map((p) => (
                      <div key={p.id} className="px-3 py-2.5 grid grid-cols-12 gap-2 text-xs">
                        <span className="col-span-2 sm:col-span-1 font-mono text-[11px] text-amber-400 font-bold">{p.codigo}</span>
                        <div className="col-span-10 sm:col-span-8 space-y-0.5">
                          {p.titulo && <p className="font-bold text-white">{p.titulo}</p>}
                          <p className="text-slate-300 leading-relaxed">{p.descripcion || p.concepto}</p>
                        </div>
                        <span className="col-span-6 sm:col-span-1 text-slate-400 font-mono sm:text-right">{p.cantidad} {p.unidad}</span>
                        <span className="col-span-6 sm:col-span-2 font-mono font-bold text-emerald-400 text-right">
                          {Number(p.total || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
          <div className="p-3 sm:p-6 space-y-6 flex-1">
            {pipelineError && (
              <div className="p-4 rounded-2xl border border-rose-500/50 bg-rose-500/10 text-rose-200 text-xs flex gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <div className="space-y-1 flex-1">
                  <p className="font-bold text-rose-300">No se pudo generar el presupuesto. Tus datos siguen en el formulario.</p>
                  <p className="break-words">{pipelineError}</p>
                </div>
                <button type="button" onClick={() => setPipelineError('')} className="text-rose-300 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Pasos del asistente: los parámetros del cliente van primero y son obligatorios */}
            <ol className="grid grid-cols-2 gap-2">
              {[
                { n: 1, label: 'Parámetros del cliente y condiciones económicas' },
                { n: 2, label: 'Dictado, notas y evidencias de la visita' }
              ].map(st => {
                const done = st.n === 1 && paramsValidated;
                const active = wizardStep === st.n;
                const locked = st.n === 2 && !paramsValidated;
                return (
                  <li key={st.n}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => setWizardStep(st.n)}
                      title={locked ? 'Valida primero los parámetros del cliente' : undefined}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all duration-200 ${
                        active ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                        done ? 'bg-emerald-500 text-white' : active ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {done ? <Check className="w-4 h-4 stroke-[3]" /> : locked ? <Lock className="w-3.5 h-3.5" /> : st.n}
                      </span>
                      <span className={`text-[11px] sm:text-xs font-bold leading-tight ${active ? 'text-white' : 'text-slate-400'}`}>{st.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {wizardStep === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-slate-950 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-sm flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-emerald-400" />
                        <span>1. Parámetros del Cliente y Condiciones Económicas</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Obligatorio antes de dictar: la IA usa el margen, el tipo de cliente, las condiciones de pago y la fiscalidad para calcular la propuesta.
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">* obligatorio</span>
                  </div>

                  {/* Cliente y obra */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Nombre del cliente *</label>
                      <input type="text" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} className={paramField('clienteNombre')} />
                      <ParamError name="clienteNombre" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Tipo de cliente *</label>
                      <select value={tipoCliente} onChange={(e) => handleTipoClienteChange(e.target.value)} className={paramField('tipoCliente')}>
                        <option value="">Selecciona…</option>
                        {TIPOS_CLIENTE.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <ParamError name="tipoCliente" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">NIF / CIF {tipoCliente && tipoCliente !== 'particular' ? '*' : '(opcional)'}</label>
                      <input type="text" value={clienteNif} onChange={(e) => setClienteNif(e.target.value.toUpperCase())} placeholder="12345678Z / B12345678" className={`${paramField('clienteNif')} font-mono uppercase`} />
                      <ParamError name="clienteNif" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Título de la obra *</label>
                      <input type="text" value={obraTitulo} placeholder="ej: Reforma integral de vivienda" onChange={(e) => setObraTitulo(e.target.value)} className={paramField('obraTitulo')} />
                      <ParamError name="obraTitulo" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-slate-400 block mb-1">Dirección de la vivienda / local *</label>
                      <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} className={paramField('direccion')} />
                      <ParamError name="direccion" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Teléfono móvil (WhatsApp)</label>
                      <input type="text" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} className={paramField('clienteTelefono')} />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Email del cliente</label>
                      <input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className={paramField('clienteEmail')} />
                      <ParamError name="clienteEmail" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Plazo deseado</label>
                      <input type="text" value={plazoDeseado} placeholder="ej: 6 semanas" onChange={(e) => setPlazoDeseado(e.target.value)} className={paramField('plazoDeseado')} />
                    </div>
                  </div>

                  {/* Condiciones económicas */}
                  <div className="pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Nivel de calidades *</label>
                      <select value={calidades} onChange={(e) => setCalidades(e.target.value)} className={paramField('calidades')}>
                        <option value="Económica / Funcional">Económica / Funcional</option>
                        <option value="Media-Alta (Confort Plus)">Media-Alta (Confort Plus)</option>
                        <option value="Alta / Premium">Alta / Premium (Marcas Oficiales)</option>
                        <option value="Lujo / Exclusiva">Lujo / Exclusiva (Diseño a medida)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Margen comercial objetivo *</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min="5" max="60" value={margenObjetivo} onChange={(e) => setMargenObjetivo(Number(e.target.value))} className="w-full accent-amber-500" />
                        <input
                          type="number"
                          min="5"
                          max="60"
                          value={margenObjetivo}
                          onChange={(e) => setMargenObjetivo(Number(e.target.value))}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-right font-mono font-bold text-amber-400"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                      <ParamError name="margenObjetivo" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Validez de la oferta</label>
                      <select value={validezDias} onChange={(e) => setValidezDias(Number(e.target.value))} className={paramField('validezDias')}>
                        {[15, 30, 60, 90].map(d => <option key={d} value={d}>{d} días</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Condiciones de pago *</label>
                      <select value={condicionesPago} onChange={(e) => setCondicionesPago(e.target.value)} className={paramField('condicionesPago')}>
                        {CONDICIONES_PAGO.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      {condicionesPago === 'otra' && (
                        <input
                          type="text"
                          value={condicionesPagoOtra}
                          onChange={(e) => setCondicionesPagoOtra(e.target.value)}
                          placeholder="Describe los hitos de pago"
                          className={`${paramField('condicionesPagoOtra')} mt-2`}
                        />
                      )}
                      <ParamError name="condicionesPagoOtra" />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Fiscalidad estimada (IVA) *</label>
                      <select value={fiscalidad} onChange={(e) => setFiscalidad(e.target.value)} className={paramField('fiscalidad')}>
                        {FISCALIDADES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                      </select>
                      <ParamError name="fiscalidad" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Retención IRPF estimada</label>
                      <select value={retencionIrpf} onChange={(e) => setRetencionIrpf(Number(e.target.value))} className={paramField('retencionIrpf')}>
                        <option value={0}>Sin retención</option>
                        <option value={1}>1% (actividad en módulos)</option>
                        <option value={7}>7% (profesional, inicio de actividad)</option>
                        <option value={15}>15% (profesional)</option>
                      </select>
                      <ParamError name="retencionIrpf" />
                    </div>
                    {paramWarnings.length > 0 && (
                      <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-300 space-y-1 self-end">
                        {paramWarnings.map((w, i) => <p key={i} className="flex gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />{w}</p>)}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleValidateParams}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition active:scale-95"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Validar parámetros y continuar</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && paramsValidated && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                {/* Resumen de los parámetros validados */}
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-[11px]">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-400"><ShieldCheck className="w-4 h-4" />Parámetros validados</span>
                  {[
                    clienteNombre,
                    TIPOS_CLIENTE.find(t => t.id === tipoCliente)?.label,
                    `Margen ${margenObjetivo}%`,
                    FISCALIDADES.find(f => f.id === fiscalidad)?.short,
                    retencionIrpf > 0 ? `IRPF ${retencionIrpf}%` : null,
                    condicionesPagoTexto
                  ].filter(Boolean).map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 max-w-[18rem] truncate">{t}</span>
                  ))}
                  <button type="button" onClick={() => setWizardStep(1)} className="ml-auto font-bold text-amber-400 hover:text-amber-300">Editar</button>
                </div>

            {/* In Situ Multimodal Capture Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <AudioVoiceRecorder
                  title="Grabación o subida de audio"
                  initialTranscript={audioTranscript}
                  placeholder="Pulsa 'Grabar con Micrófono' o 'Añadir Audio': la explicación de la obra se transcribe aquí tal cual se dice. Si quieres, pulsa después 'Mejorar Transcripción con IA'..."
                  onTranscriptChange={(text, blob) => {
                    setAudioTranscript(text);
                    setAudioRefinedText('');
                    // Solo se transcribe: la mejora con IA se lanza a mano con su botón.
                    if (blob) setAudioFile(blob);
                  }}
                />

                <div className="px-1">
                  <AiImprovementControl
                    value={audioTranscript}
                    onAccept={(improved) => {
                      setAudioTranscript(improved);
                      setAudioRefinedText(improved);
                    }}
                    context="Dictado de visita de obra para presupuesto: redáctalo como alcance técnico de los trabajos, ordenado por capítulos de obra, conservando todas las medidas, cantidades y calidades dictadas"
                    buttonLabel="Mejorar Transcripción con IA"
                  />
                </div>
              </div>

              {/* Anotaciones Manuales / WhatsApp / Emails */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Anotaciones, mensajes de WhatsApp o correo</span>
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

              {/* Mediciones Manuales: se añaden a las anotaciones como una sola línea al pulsar "Añadir" */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span>Mediciones en obra</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddMedicion}
                    className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 text-blue-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir a anotaciones</span>
                  </button>
                </div>
                {lidarActivo && (
                  <div className="space-y-1.5 pb-2 border-b border-slate-800">
                    <EscaneoLidarSubida onUsar={handleUsarEscaneo} textoUsar="Añadir mediciones y croquis" />
                    {croquisEscaneo && (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-3 py-1.5">
                        <span>📐 Croquis del escaneo listo ({croquisEscaneo.plan.rooms.length} estancias): se guardará con el presupuesto.</span>
                        <button type="button" onClick={() => setCroquisEscaneo(null)} className="text-slate-400 hover:text-white" aria-label="Quitar croquis del escaneo"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block font-semibold">Largo (m)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="ej: 4,80"
                      value={medicion.largo}
                      onChange={(e) => setMedicion(prev => ({ ...prev, largo: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMedicion(); } }}
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block font-semibold">Ancho (m)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="ej: 3,20"
                      value={medicion.ancho}
                      onChange={(e) => setMedicion(prev => ({ ...prev, ancho: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMedicion(); } }}
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block font-semibold">Alto (m)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="ej: 2,50"
                      value={medicion.alto}
                      onChange={(e) => setMedicion(prev => ({ ...prev, alto: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMedicion(); } }}
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    <label className="text-[10px] text-slate-400 block font-semibold">Estancia / Zona</label>
                    <input
                      type="text"
                      inputMode="text"
                      placeholder="ej: Salón / Baño 1"
                      value={medicion.zona}
                      onChange={(e) => setMedicion(prev => ({ ...prev, zona: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMedicion(); } }}
                      className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Adjuntar Documentos PDF, Word, Excel */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Documentos (PDF, Word, Excel, planos)</span>
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
                      <span>Fotos de la obra</span>
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

              </div>
            )}
          </div>
        )}

        {/* Footer Actions - Positioned Bottom Right as required by AGENTS.md */}
        {!isProcessing && !generatedQuoteResult && wizardStep === 2 && paramsValidated && (
          <div className="sticky bottom-0 z-10 px-4 sm:px-5 py-3 border-t border-slate-800 bg-slate-950 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.35)] flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-3xl">
            <div className="hidden sm:flex text-[11px] text-slate-400 items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Base Oficial de Precios ({basePrecios.length} partidas)</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition"
              >
                {inline ? 'Vaciar formulario' : 'Cancelar'}
              </button>

              <button
                type="button"
                onClick={handleLaunchAiPipeline}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span className="sm:hidden">Generar con IA</span>
                <span className="hidden sm:inline">Generar Presupuesto con IA</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
