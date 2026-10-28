import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import AudioVoiceRecorder from '../Common/AudioVoiceRecorder';
import { processScopeWithAI } from '../../services/aiAudioTextService';
import {
  Mic,
  Mail,
  Sparkles,
  FileText,
  Plus,
  ArrowRight,
  CheckCircle2,
  Copy,
  Check,
  Layers,
  Building,
  BookOpen,
  Loader2
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AudioEmailCaptureView() {
  const {
    obras = [],
    presupuestos = [],
    basePrecios = [],
    empresaConfig = {},
    referenceBudgets = [],
    addPresupuesto,
    updatePresupuesto,
    addMaterialToObra,
    showNotification,
    setActiveTab,
    setSelectedPresupuestoId
  } = useApp();

  // Mode: 'audio' vs 'email_paste'
  const [captureMode, setCaptureMode] = useState('audio'); // 'audio', 'email_paste'

  // Form states
  const [contentType, setContentType] = useState('email_cliente'); // 'email_cliente', 'whatsapp', 'nota_voz', 'peticion_libre'
  const [senderName, setSenderName] = useState('Dña. Elena Santamaría (Cliente)');
  const [senderContact, setSenderContact] = useState('+34 655 890 123');
  const [targetProjectId, setTargetProjectId] = useState(obras[0]?.id || '');
  
  // Audio state
  const [audioTranscript, setAudioTranscript] = useState('');

  // Pasted text state
  const [pastedText, setPastedText] = useState(
    'Hola Manuel, buenas tardes. Acabo de pasar con mi marido a ver cómo va la cocina en Avenida de Bruselas y nos encanta. Queríamos pedirte si podéis añadir dos enchufes adicionales en la encimera para la cafetera y la tostadora, y también si es posible poner una tira LED indirecta bajo los muebles altos de la cocina. Por favor dinos cuánto subiría el presupuesto para darte el ok.'
  );

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [aiResult, setAiResult] = useState(null);

  // Modal Insert into existing quote
  const [showInsertModal, setShowInsertModal] = useState(false);
  const [selectedQuoteForInsert, setSelectedQuoteForInsert] = useState(presupuestos[0]?.id || '');

  // Copied alert
  const [copiedSection, setCopiedSection] = useState(null);

  const activeRefBudgets = (referenceBudgets || []).filter(b => b.is_active);

  const handleCopy = (text, sec) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sec);
    setTimeout(() => setCopiedSection(null), 2500);
  };

  // Trigger AI Processing
  const handleProcessWithAI = async () => {
    const textToProcess = captureMode === 'audio' ? audioTranscript : pastedText;

    if (!textToProcess || !textToProcess.trim()) {
      showNotification('Por favor, graba un audio o escribe/pega el texto antes de procesar.', 'error');
      return;
    }

    setIsProcessing(true);
    setProcessingStage('Analizando transcripción...');

    const timer1 = setTimeout(() => {
      setProcessingStage('Consultando conocimiento técnico y presupuestos de ejemplo...');
    }, 1200);

    const timer2 = setTimeout(() => {
      setProcessingStage('Generando presupuesto profesional...');
    }, 2500);

    try {
      const result = await processScopeWithAI(
        textToProcess,
        contentType,
        targetProjectId,
        empresaConfig.aiConfig || {},
        basePrecios,
        activeRefBudgets
      );

      clearTimeout(timer1);
      clearTimeout(timer2);

      setAiResult(result);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      showNotification('✨ Requerimiento procesado y normalizado con estilo técnico de la empresa.');
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      console.error('Error processing scope with AI:', err);
      showNotification('Error al procesar con IA.', 'error');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Action 1: Insert into existing quote
  const handleInsertIntoExistingQuote = () => {
    if (!aiResult || !selectedQuoteForInsert) return;

    const targetQuote = presupuestos.find(p => p.id === selectedQuoteForInsert);
    if (!targetQuote) return;

    const newItems = (aiResult.capitulos || []).flatMap(c => 
      c.partidas.map(p => ({
        id: `p-extra-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        codigo: p.codigo,
        capitulo: c.nombre_capitulo,
        concepto: `${p.titulo} - ${p.descripcion}`,
        cantidad: p.medicion,
        unidad: p.unidad,
        costeUnitario: Number((p.precio_unitario_estimado * 0.75).toFixed(2)),
        margenPct: 25,
        precioVenta: p.precio_unitario_estimado,
        total: p.total_estimado
      }))
    );

    const updatedPartidas = [...(targetQuote.partidas || []), ...newItems];
    const newBase = Number(updatedPartidas.reduce((s, p) => s + p.total, 0).toFixed(2));
    const newIva = Number((newBase * (targetQuote.tipoIvaPct / 100)).toFixed(2));
    const newTotal = Number((newBase + newIva).toFixed(2));

    updatePresupuesto(targetQuote.id, {
      partidas: updatedPartidas,
      baseImponible: newBase,
      cuotaIva: newIva,
      totalConIva: newTotal
    });

    setShowInsertModal(false);
    showNotification(`¡${newItems.length} partidas añadidas con éxito al presupuesto "${targetQuote.numero}"!`);
  };

  // Action 2: Create brand new quote
  const handleCreateNewQuote = () => {
    if (!aiResult) return;

    const flatPartidas = (aiResult.capitulos || []).flatMap(c => 
      c.partidas.map(p => ({
        id: `p-new-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        codigo: p.codigo,
        capitulo: c.nombre_capitulo,
        concepto: `${p.titulo} - ${p.descripcion}`,
        cantidad: p.medicion,
        unidad: p.unidad,
        costeUnitario: Number((p.precio_unitario_estimado * 0.75).toFixed(2)),
        margenPct: 30,
        precioVenta: p.precio_unitario_estimado,
        total: p.total_estimado
      }))
    );

    const baseImponible = Number(flatPartidas.reduce((s, p) => s + p.total, 0).toFixed(2));
    const cuotaIva = Number((baseImponible * 0.10).toFixed(2));
    const totalConIva = Number((baseImponible + cuotaIva).toFixed(2));

    const targetObra = obras.find(o => o.id === targetProjectId);

    const newQuote = addPresupuesto({
      obraId: targetProjectId || null,
      obraTitulo: targetObra ? targetObra.titulo : `Petición ${senderName}`,
      cliente: senderName,
      telefono: senderContact,
      email: 'cliente@ejemplo.es',
      tipoIvaPct: 10,
      margenGlobalPct: 30,
      baseImponible,
      cuotaIva,
      totalConIva,
      partidas: flatPartidas,
      notasLegales: `Presupuesto confeccionado por IA según especificación técnica: ${aiResult.resumen_alcance}`
    });

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    showNotification(`¡Presupuesto ${newQuote.numero} creado con éxito!`);
    if (setSelectedPresupuestoId) setSelectedPresupuestoId(newQuote.id);
    if (setActiveTab) setActiveTab('presupuestos');
  };

  // Action 3: Generate additional obra annex
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

    showNotification(`Anexo de ${items.length} partidas adicionales registrado en la obra.`);
  };

  const currentInputText = captureMode === 'audio' ? audioTranscript : pastedText;

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Sparkles className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Captura Multimodal (Audio, Texto & Email IA)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                  Normalizador Técnico
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Transforma audios dictados, WhatsApps o correos coloquiales en partidas formales de pliego de condiciones listas para presupuestar
              </p>
            </div>
          </div>
        </div>

        {/* Reference Budgets Status Badge */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-xl text-xs">
          <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Modelos de Estilo</span>
            <span className="font-bold text-white">
              {activeRefBudgets.length} Presupuestos de Ejemplo Activos
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Input Column (Left) & Output Column (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: CAPTURE MODES (5 COLS)                                       */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Mode Switcher Tabs */}
          <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 flex gap-1">
            <button
              onClick={() => setCaptureMode('audio')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                captureMode === 'audio'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Grabar / Subir Audio</span>
            </button>

            <button
              onClick={() => setCaptureMode('email_paste')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                captureMode === 'email_paste'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Pegar Email / WhatsApp</span>
            </button>
          </div>

          {/* Context Options */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3 text-xs">
            <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block">
              Contexto de la Solicitud
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">Tipo de Contenido</label>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                >
                  <option value="email_cliente">Correo Electrónico</option>
                  <option value="whatsapp">Mensaje WhatsApp</option>
                  <option value="nota_voz">Nota de Voz In Situ</option>
                  <option value="peticion_libre">Petición Libre</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Obra Relacionada</label>
                <select
                  value={targetProjectId}
                  onChange={(e) => setTargetProjectId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                >
                  {obras.map(o => (
                    <option key={o.id} value={o.id}>{o.titulo}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">Remitente / Cliente</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Teléfono o Email</label>
                <input
                  type="text"
                  value={senderContact}
                  onChange={(e) => setSenderContact(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* INPUT FORM: AUDIO RECORDER */}
          {captureMode === 'audio' && (
            <AudioVoiceRecorder
              title="Grabación y Transcripción de Audio de Obra"
              placeholder="La transcripción de la nota de voz aparecerá aquí. Puedes revisarla y editarla..."
              onTranscriptChange={(text) => setAudioTranscript(text)}
            />
          )}

          {/* INPUT FORM: EMAIL / WHATSAPP TEXTAREA */}
          {captureMode === 'email_paste' && (
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 text-xs">
              <label className="text-slate-400 font-bold block flex items-center justify-between">
                <span>Pega el Correo del Cliente o Mensaje de WhatsApp:</span>
                <span className="text-[10px] text-amber-400 font-normal">Cualquier tono informal o queja</span>
              </label>
              <textarea
                rows="8"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Pega aquí el correo del cliente con peticiones de cambio o adición..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl p-3 text-xs text-white placeholder-slate-500 leading-relaxed focus:outline-none"
              ></textarea>
            </div>
          )}

          {/* Multi-stage Progress Feedback */}
          {isProcessing && (
            <div className="bg-slate-900 border border-amber-500/40 p-4 rounded-2xl space-y-2 animate-pulse">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{processingStage || 'Procesando con IA...'}</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Imitando el tono, estructura y vocabulario de los presupuestos de ejemplo almacenados en Ajustes.
              </p>
            </div>
          )}

          {/* Process Button */}
          <button
            onClick={handleProcessWithAI}
            disabled={isProcessing || !currentInputText.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-xl shadow-amber-500/20 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Sparkles className="w-5 h-5 animate-spin" />
                <span>{processingStage || 'Procesando...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 stroke-[2.5]" />
                <span>Transformar con IA a Presupuesto Técnico</span>
              </>
            )}
          </button>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: AI RESULTS & TECHNICAL PREVIEWS (7 COLS)                     */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          
          {aiResult ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* Executive Summary Card */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-amber-500/30 p-5 rounded-2xl space-y-2 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Resumen Ejecutivo del Alcance Detectado</span>
                  </span>
                  <button
                    onClick={() => handleCopy(aiResult.resumen_alcance, 'resumen')}
                    className="text-slate-400 hover:text-white text-xs"
                    title="Copiar resumen"
                  >
                    {copiedSection === 'resumen' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-sm font-semibold text-white leading-relaxed">
                  {aiResult.resumen_alcance}
                </p>
              </div>

              {/* Technical Rewriting (Estilo Empresa / Pliego de Condiciones) */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>Redacción Técnica Normalizada (Estilo Pliego de Condiciones)</span>
                  </span>
                  <button
                    onClick={() => handleCopy(aiResult.redaccion_tecnica_estilo, 'estilo')}
                    className="text-slate-400 hover:text-white text-xs"
                    title="Copiar redacción técnica"
                  >
                    {copiedSection === 'estilo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800/80">
                  {aiResult.redaccion_tecnica_estilo}
                </p>
              </div>

              {/* Generated Chapters and Line Items Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span>Desglose de Capítulos & Partidas Generadas</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    Total Estimado:{' '}
                    <strong className="text-amber-400 font-mono text-sm">
                      {(aiResult.capitulos || [])
                        .reduce((s, c) => s + (c.subtotal || 0), 0)
                        .toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                    </strong>
                  </span>
                </div>

                <div className="space-y-4">
                  {(aiResult.capitulos || []).map((cap) => (
                    <div key={cap.id} className="border border-slate-800 rounded-xl overflow-hidden">
                      <div className="bg-slate-950 px-3.5 py-2 flex items-center justify-between border-b border-slate-800">
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">{cap.nombre_capitulo}</span>
                        <span className="text-xs font-mono font-bold text-white">{cap.subtotal.toFixed(2)} €</span>
                      </div>

                      <div className="divide-y divide-slate-800/60 text-xs">
                        {cap.partidas.map((p) => (
                          <div key={p.id} className="p-3 bg-slate-900/60 hover:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-amber-400 font-bold text-[11px]">{p.codigo}</span>
                                <h4 className="font-bold text-white text-xs">{p.titulo}</h4>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-normal">{p.descripcion}</p>
                            </div>

                            <div className="text-right shrink-0 font-mono">
                              <span className="text-xs text-slate-300">
                                {p.medicion} {p.unidad} × {p.precio_unitario_estimado.toFixed(2)} €
                              </span>
                              <span className="text-sm font-bold text-white block mt-0.5">
                                {p.total_estimado.toFixed(2)} €
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Available Action Buttons */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => setShowInsertModal(true)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Insertar en Presupuesto Existente</span>
                  </button>

                  <button
                    onClick={handleGenerateAnnex}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Building className="w-3.5 h-3.5 text-amber-400" />
                    <span>Generar Anexo de Obra</span>
                  </button>

                  <button
                    onClick={handleCreateNewQuote}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                  >
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                    <span>Crear Nuevo Presupuesto</span>
                  </button>
                </div>

              </div>

            </div>
          ) : (
            /* Idle Placeholder */
            <div className="bg-slate-900 border border-slate-800 p-12 rounded-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center text-slate-500">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Bandeja de Entrada Multimodal IA</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                  Graba un mensaje de voz o pega un correo electrónico de un cliente a la izquierda. La IA lo transcribirá, adecuará la redacción a especificaciones técnicas y creará las partidas con sus mediciones y precios.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Modal: Insert into Existing Quote */}
      {showInsertModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              <span>Insertar Partidas en Presupuesto Existente</span>
            </h3>

            <p className="text-xs text-slate-400">
              Selecciona el presupuesto al que deseas agregar las partidas desglosadas por la IA:
            </p>

            <div>
              <label className="text-slate-400 text-xs block mb-1">Presupuesto de Destino</label>
              <select
                value={selectedQuoteForInsert}
                onChange={(e) => setSelectedQuoteForInsert(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
              >
                {presupuestos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.numero} - {p.obraTitulo || p.cliente} ({Number(p.baseImponible || 0).toLocaleString('es-ES')} €)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setShowInsertModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleInsertIntoExistingQuote}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
              >
                Insertar Partidas
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
