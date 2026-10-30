import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import AudioVoiceRecorder from '../Common/AudioVoiceRecorder';
import EmptyState from '../Common/EmptyState';
import { processScopeWithAI } from '../../services/aiAudioTextService';
import {
  Mic,
  Mail,
  Sparkles,
  Plus,
  ArrowRight,
  Copy,
  Check,
  Building,
  Loader2,
  Inbox,
  Package,
  DollarSign,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ModalOverlay from '../Common/ModalOverlay';
import { AnimatePresence } from 'motion/react';

// Pantalla única: nueva entrada (audio o texto) + contexto → resultado de la IA, y debajo la bandeja.

const TIPOS_CONTENIDO = {
  email_cliente: 'Correo electrónico',
  whatsapp: 'Mensaje de WhatsApp',
  nota_voz: 'Nota de voz en obra',
  peticion_libre: 'Petición libre'
};

const TEXTO_EJEMPLO = {
  remitente: 'Dña. Elena Santamaría (Cliente)',
  contacto: '+34 655 890 123',
  texto: 'Hola Manuel, buenas tardes. Acabo de pasar con mi marido a ver cómo va la cocina en Avenida de Bruselas y nos encanta. Queríamos pedirte si podéis añadir dos enchufes adicionales en la encimera para la cafetera y la tostadora, y también si es posible poner una tira LED indirecta bajo los muebles altos de la cocina. Por favor dinos cuánto subiría el presupuesto para darte el ok.'
};

const FILTROS = [
  { id: 'todos', label: 'Todos', match: () => true },
  { id: 'audios', label: 'Audios', match: (m) => m.tipo === 'audio' },
  { id: 'textos', label: 'Email / WhatsApp', match: (m) => m.tipo !== 'audio' },
  { id: 'pendientes', label: 'Pendientes', match: (m) => !m.estadoProcesado },
  { id: 'aplicados', label: 'Aplicados', match: (m) => m.estadoProcesado }
];

const eur = (n) => Number(n || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400';

export default function AudioEmailInbox() {
  const {
    obras = [],
    presupuestos = [],
    basePrecios = [],
    empresaConfig = {},
    referenceBudgets = [],
    mensajesInbox = [],
    addMensajeInbox,
    processMensajeInbox,
    addPresupuesto,
    updatePresupuesto,
    addMaterialToObra,
    showNotification,
    setActiveTab,
    setSelectedPresupuestoId
  } = useApp();

  const captureRef = useRef(null);

  // Entrada
  const [captureMode, setCaptureMode] = useState('audio'); // 'audio' | 'texto'
  const [contentType, setContentType] = useState('nota_voz');
  const [targetProjectId, setTargetProjectId] = useState(obras[0]?.id || '');
  const [senderName, setSenderName] = useState('');
  const [senderContact, setSenderContact] = useState('');
  const [subject, setSubject] = useState('');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [recorderKey, setRecorderKey] = useState(0);
  const [pastedText, setPastedText] = useState('');

  // Resultado de la IA
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [copiedSection, setCopiedSection] = useState(null);
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [selectedQuoteForInsert, setSelectedQuoteForInsert] = useState(presupuestos[0]?.id || '');

  // Bandeja
  const [filtro, setFiltro] = useState('todos');

  const activeRefBudgets = (referenceBudgets || []).filter(b => b.is_active);
  const currentInputText = captureMode === 'audio' ? audioTranscript : pastedText;
  const showSubject = captureMode === 'texto' && contentType === 'email_cliente';

  const switchMode = (mode) => {
    setCaptureMode(mode);
    setContentType(mode === 'audio' ? 'nota_voz' : 'email_cliente');
  };

  const handleCopy = (text, sec) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sec);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  const loadExample = () => {
    switchMode('texto');
    setSenderName(TEXTO_EJEMPLO.remitente);
    setSenderContact(TEXTO_EJEMPLO.contacto);
    setPastedText(TEXTO_EJEMPLO.texto);
  };

  const resetInput = () => {
    setAudioTranscript('');
    setRecorderKey(k => k + 1);
    setPastedText('');
    setSubject('');
  };

  const handleProcessWithAI = async () => {
    if (!currentInputText.trim()) {
      showNotification('Graba un audio o pega el texto antes de procesar.', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessingStage('Analizando el mensaje...');
    const timer1 = setTimeout(() => setProcessingStage('Consultando presupuestos de ejemplo...'), 1200);
    const timer2 = setTimeout(() => setProcessingStage('Generando partidas...'), 2500);

    try {
      const result = await processScopeWithAI(
        currentInputText,
        contentType,
        targetProjectId,
        empresaConfig.aiConfig || {},
        basePrecios,
        activeRefBudgets
      );
      setAiResult(result);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      showNotification('✨ Mensaje convertido en partidas con el estilo de la empresa.');
    } catch (err) {
      console.error('Error processing scope with AI:', err);
      showNotification('Error al procesar con IA.', 'error');
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Guarda la entrada tal cual en la bandeja, sin análisis inventado.
  const handleSaveToInbox = () => {
    const text = currentInputText.trim();
    if (!text) return;
    const obra = obras.find(o => o.id === targetProjectId);
    const isAudio = captureMode === 'audio';
    const contacto = senderContact.trim();
    addMensajeInbox({
      tipo: isAudio ? 'audio' : 'email',
      origen: TIPOS_CONTENIDO[contentType],
      remitente: senderName.trim() || (isAudio ? 'Nota de voz en obra' : 'Cliente'),
      ...(contacto ? (contacto.includes('@') ? { email: contacto } : { telefono: contacto }) : {}),
      ...(isAudio
        ? { audioTranscripcion: text }
        : { cuerpo: text, asunto: subject.trim() || undefined }),
      obraId: obra?.id,
      obraTitulo: obra?.titulo,
      analisisIA: null
    });
    resetInput();
  };

  // Lleva un mensaje de la bandeja al formulario para prepararlo con la IA.
  const handleLoadMessage = (msg) => {
    switchMode('texto');
    setContentType(msg.tipo === 'audio' ? 'nota_voz' : 'email_cliente');
    setPastedText(msg.audioTranscripcion || msg.cuerpo || '');
    setSenderName(msg.remitente || '');
    setSenderContact(msg.telefono || msg.email || '');
    setSubject(msg.asunto || '');
    if (msg.obraId) setTargetProjectId(msg.obraId);
    captureRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toPartidas = (prefix, margenPct) =>
    (aiResult?.capitulos || []).flatMap(c =>
      c.partidas.map(p => ({
        id: `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        codigo: p.codigo,
        capitulo: c.nombre_capitulo,
        concepto: `${p.titulo} - ${p.descripcion}`,
        cantidad: p.medicion,
        unidad: p.unidad,
        costeUnitario: Number((p.precio_unitario_estimado * 0.75).toFixed(2)),
        margenPct,
        precioVenta: p.precio_unitario_estimado,
        total: p.total_estimado
      }))
    );

  const handleInsertIntoExistingQuote = () => {
    const targetQuote = presupuestos.find(p => p.id === selectedQuoteForInsert);
    if (!aiResult || !targetQuote) return;

    const newItems = toPartidas('p-extra', 25);
    const updatedPartidas = [...(targetQuote.partidas || []), ...newItems];
    const newBase = Number(updatedPartidas.reduce((s, p) => s + p.total, 0).toFixed(2));
    const newIva = Number((newBase * (targetQuote.tipoIvaPct / 100)).toFixed(2));

    updatePresupuesto(targetQuote.id, {
      partidas: updatedPartidas,
      baseImponible: newBase,
      cuotaIva: newIva,
      totalConIva: Number((newBase + newIva).toFixed(2))
    });

    setShowInsertModal(false);
    showNotification(`${newItems.length} partidas añadidas al presupuesto "${targetQuote.numero}".`);
  };

  const handleCreateNewQuote = () => {
    if (!aiResult) return;

    const flatPartidas = toPartidas('p-new', 30);
    const baseImponible = Number(flatPartidas.reduce((s, p) => s + p.total, 0).toFixed(2));
    const cuotaIva = Number((baseImponible * 0.10).toFixed(2));
    const targetObra = obras.find(o => o.id === targetProjectId);
    const contacto = senderContact.trim();

    const newQuote = addPresupuesto({
      obraId: targetProjectId || null,
      obraTitulo: targetObra ? targetObra.titulo : `Petición ${senderName}`,
      cliente: senderName,
      telefono: contacto.includes('@') ? '' : contacto,
      email: contacto.includes('@') ? contacto : '',
      tipoIvaPct: 10,
      margenGlobalPct: 30,
      baseImponible,
      cuotaIva,
      totalConIva: Number((baseImponible + cuotaIva).toFixed(2)),
      partidas: flatPartidas,
      notasLegales: `Presupuesto confeccionado por IA según especificación técnica: ${aiResult.resumen_alcance}`
    });

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    showNotification(`Presupuesto ${newQuote.numero} creado.`);
    if (setSelectedPresupuestoId) setSelectedPresupuestoId(newQuote.id);
    if (setActiveTab) setActiveTab('presupuestos');
  };

  const handleGenerateAnnex = () => {
    if (!aiResult || !targetProjectId) {
      showNotification('Selecciona una obra para vincular el anexo', 'error');
      return;
    }
    const items = (aiResult.capitulos || []).flatMap(c => c.partidas);
    items.forEach(item => {
      addMaterialToObra(targetProjectId, {
        concepto: `${item.titulo} (${item.descripcion})`,
        cantidad: item.medicion,
        unidad: item.unidad,
        costeEstimado: item.total_estimado,
        proveedor: 'Subcontrata Asignada'
      });
    });
    showNotification(`Anexo de ${items.length} partidas registrado en la obra.`);
  };

  const filtroActivo = FILTROS.find(f => f.id === filtro) || FILTROS[0];
  const filteredMessages = mensajesInbox.filter(filtroActivo.match);
  const totalResultado = (aiResult?.capitulos || []).reduce((s, c) => s + (c.subtotal || 0), 0);

  const CopyButton = ({ text, id, label }) => (
    <button
      type="button"
      onClick={() => handleCopy(text, id)}
      className="p-1 text-slate-400 hover:text-white rounded-lg"
      title={label}
      aria-label={label}
    >
      {copiedSection === id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ===================== 1. NUEVA ENTRADA ===================== */}
        <section ref={captureRef} className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 scroll-mt-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white">Nueva entrada</h2>
            <button
              type="button"
              onClick={loadExample}
              className="text-[11px] font-semibold text-amber-400 hover:text-amber-300"
            >
              Cargar ejemplo
            </button>
          </div>

          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex gap-1" role="tablist">
            {[
              { id: 'audio', label: 'Audio', icon: Mic },
              { id: 'texto', label: 'Email / WhatsApp', icon: Mail }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={captureMode === id}
                onClick={() => switchMode(id)}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                  captureMode === id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Contexto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="block">
              <span className="text-slate-400 block mb-1">Tipo</span>
              <select value={contentType} onChange={(e) => setContentType(e.target.value)} className={inputCls}>
                {Object.entries(TIPOS_CONTENIDO).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Obra</span>
              <select value={targetProjectId} onChange={(e) => setTargetProjectId(e.target.value)} className={inputCls}>
                <option value="">Sin obra</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.titulo}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Cliente o remitente</span>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Ej: Carmen Ruiz"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-slate-400 block mb-1">Teléfono o email</span>
              <input
                type="text"
                value={senderContact}
                onChange={(e) => setSenderContact(e.target.value)}
                placeholder="Ej: 600 000 000"
                className={`${inputCls} font-mono`}
              />
            </label>
            {showSubject && (
              <label className="block sm:col-span-2">
                <span className="text-slate-400 block mb-1">Asunto (opcional)</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ej: Cambio de enchufes en la cocina"
                  className={inputCls}
                />
              </label>
            )}
          </div>

          {/* Contenido */}
          {captureMode === 'audio' ? (
            <AudioVoiceRecorder
              key={recorderKey}
              hideHeader
              placeholder="Graba o sube el audio: aquí aparece lo que se dice y puedes corregirlo."
              onTranscriptChange={(text) => setAudioTranscript(text || '')}
            />
          ) : (
            <label className="block text-xs">
              <span className="text-slate-400 block mb-1">Mensaje del cliente</span>
              <textarea
                rows="7"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Pega aquí el correo o el WhatsApp tal como llegó, aunque sea informal."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl p-3 text-xs text-white placeholder-slate-500 leading-relaxed focus:outline-none"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleProcessWithAI}
              disabled={isProcessing || !currentInputText.trim()}
              className="flex-1 basis-56 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isProcessing ? processingStage || 'Procesando...' : 'Preparar presupuesto con IA'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveToInbox}
              disabled={isProcessing || !currentInputText.trim()}
              className="flex-1 sm:flex-none py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Inbox className="w-4 h-4" />
              <span>Guardar en bandeja</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            La IA imita el estilo de {activeRefBudgets.length} {activeRefBudgets.length === 1 ? 'presupuesto' : 'presupuestos'} de ejemplo de Ajustes.
          </p>
        </section>

        {/* ===================== 2. RESULTADO DE LA IA ===================== */}
        <section className="lg:col-span-7">
          {aiResult ? (
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-white">Resultado de la IA</h2>
                  <p className="text-xs text-slate-400">
                    Total estimado <strong className="text-amber-400 font-mono">{eur(totalResultado)}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAiResult(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                  title="Descartar resultado"
                  aria-label="Descartar resultado"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Resumen</span>
                  <CopyButton text={aiResult.resumen_alcance} id="resumen" label="Copiar resumen" />
                </div>
                <p className="text-sm text-white leading-relaxed">{aiResult.resumen_alcance}</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Redacción técnica</span>
                  <CopyButton text={aiResult.redaccion_tecnica_estilo} id="estilo" label="Copiar redacción técnica" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {aiResult.redaccion_tecnica_estilo}
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">Partidas</span>
                {(aiResult.capitulos || []).map((cap) => (
                  <div key={cap.id} className="border border-slate-800 rounded-xl overflow-hidden">
                    <div className="bg-slate-950 px-3 py-2 flex items-center justify-between gap-2 border-b border-slate-800">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">{cap.nombre_capitulo}</span>
                      <span className="text-xs font-mono font-bold text-white shrink-0">{eur(cap.subtotal)}</span>
                    </div>
                    <div className="divide-y divide-slate-800/60 text-xs">
                      {cap.partidas.map((p) => (
                        <div key={p.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-bold text-white">
                              <span className="font-mono text-amber-400 text-[11px] mr-2">{p.codigo}</span>
                              {p.titulo}
                            </p>
                            <p className="text-[11px] text-slate-400 leading-normal">{p.descripcion}</p>
                          </div>
                          <div className="sm:text-right shrink-0 font-mono">
                            <span className="text-[11px] text-slate-400">
                              {p.medicion} {p.unidad} × {eur(p.precio_unitario_estimado)}
                            </span>
                            <span className="text-sm font-bold text-white block">{eur(p.total_estimado)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInsertModal(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir a presupuesto existente</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAnnex}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Anexo de obra</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewQuote}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Crear presupuesto nuevo</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="hidden lg:block">
              <EmptyState icon={Sparkles} title="Aquí aparecerán las partidas">
                Graba un audio o pega un correo o WhatsApp. La IA lo pasa a redacción técnica y prepara las partidas con medición y precio.
              </EmptyState>
            </div>
          )}
        </section>
      </div>

      {/* ===================== 3. BANDEJA ===================== */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Inbox className="w-4 h-4 text-amber-400" />
            <span>Bandeja de mensajes</span>
          </h2>
          <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 sm:pb-0">
            {FILTROS.map(f => {
              const count = mensajesInbox.filter(f.match).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltro(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    filtro === f.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label} <span className="opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredMessages.length === 0 ? (
          <EmptyState icon={Inbox} title="No hay mensajes">
            Guarda aquí audios y correos para tenerlos a mano y prepararlos con la IA cuando quieras.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((msg) => (
              <InboxMessage
                key={msg.id}
                msg={msg}
                obras={obras}
                onLoad={() => handleLoadMessage(msg)}
                onApply={(obraId, accion) => processMensajeInbox(msg.id, obraId, accion)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal: añadir a presupuesto existente */}
      <AnimatePresence>
      {showInsertModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Añadir partidas a un presupuesto</h3>
            <label className="block text-xs">
              <span className="text-slate-400 block mb-1">Presupuesto de destino</span>
              <select
                value={selectedQuoteForInsert}
                onChange={(e) => setSelectedQuoteForInsert(e.target.value)}
                className={inputCls}
              >
                {presupuestos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.numero} - {p.obraTitulo || p.cliente} ({eur(p.baseImponible)})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setShowInsertModal(false)}
                aria-label="Cerrar"
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleInsertIntoExistingQuote}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
              >
                Añadir partidas
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>
    </div>
  );
}

function InboxMessage({ msg, obras, onLoad, onApply }) {
  const isAudio = msg.tipo === 'audio';
  const isProcessed = msg.estadoProcesado;
  const obraId = msg.obraId || obras[0]?.id;
  const obraTitulo = msg.obraTitulo || obras.find(o => o.id === obraId)?.titulo;
  const texto = msg.audioTranscripcion || msg.cuerpo;
  const necesidades = msg.analisisIA?.necesidadesCalculadas || [];

  return (
    <article className={`bg-slate-900 border rounded-2xl p-4 space-y-3 ${isProcessed ? 'border-slate-800' : 'border-amber-500/40'}`}>
      <header className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
          isAudio ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
        }`}>
          {isAudio ? <Mic className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-bold text-white text-sm">{msg.remitente}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              isProcessed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
            }`}>
              {isProcessed ? 'Aplicado' : 'Pendiente'}
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {[msg.origen, obraTitulo, msg.fecha].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      {msg.asunto && <p className="text-xs font-semibold text-slate-200">{msg.asunto}</p>}
      {texto && (
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
          {texto}
          {msg.audioDuracion && <span className="text-slate-500 font-mono"> ({msg.audioDuracion})</span>}
        </p>
      )}

      {necesidades.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="uppercase font-bold text-slate-400 tracking-wider">Necesidades detectadas</span>
            {msg.analisisIA.urgencia && (
              <span className="text-slate-400">Urgencia: <strong className="text-amber-400">{msg.analisisIA.urgencia}</strong></span>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs min-w-[420px]">
              <thead className="bg-slate-950 text-slate-400 text-[11px]">
                <tr>
                  <th className="py-2 px-3 font-semibold">Concepto</th>
                  <th className="py-2 px-3 font-semibold">Cantidad</th>
                  <th className="py-2 px-3 font-semibold text-right">Coste</th>
                  <th className="py-2 px-3 font-semibold text-right">PVP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {necesidades.map((nc, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 text-white">{nc.concepto}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{nc.cantidad} {nc.unidad}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-400">{eur(nc.costeAprox)}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">{nc.pvpCliente ? eur(nc.pvpCliente) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {msg.analisisIA.accionSugerida && (
            <p className="text-xs text-slate-300"><strong className="text-white">Sugerencia:</strong> {msg.analisisIA.accionSugerida}</p>
          )}
        </div>
      )}

      {!isProcessed && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-1">
          {necesidades.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onApply(obraId, 'aplicar_necesidades_obra')}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Añadir a necesidades de la obra</span>
              </button>
              <button
                type="button"
                onClick={() => onApply(obraId, 'crear_partida_presupuesto')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Partida adicional al presupuesto</span>
              </button>
            </>
          )}
          {texto && (
            <button
              type="button"
              onClick={onLoad}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Preparar con IA</span>
            </button>
          )}
        </div>
      )}
    </article>
  );
}
