import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  FileText,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Share2,
  Download,
  Edit2,
  Trash2,
  Plus,
  History,
  ShieldCheck,
  Building2,
  User,
  MapPin,
  Phone
} from 'lucide-react';
import EnvioClienteModal from './EnvioClienteModal';
import confetti from 'canvas-confetti';

export default function ConsolaRevisionPresupuesto({ quoteId, onBack }) {
  const {
    presupuestos,
    refineQuoteWithVoiceCommand,
    updatePresupuesto,
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

  if (!quote) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-slate-400">Presupuesto no encontrado.</p>
        <button onClick={onBack} className="px-4 py-2 bg-slate-800 text-white rounded-xl">Volver</button>
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

  // Inline manual edits
  const handleItemChange = (capId, itemId, field, value) => {
    const numVal = Math.max(0, Number(value) || 0);

    const updatedCapitulos = (quote.capitulos || []).map(c => {
      if (c.id === capId) {
        const updatedPartidas = c.partidas.map(p => {
          if (p.id === itemId) {
            const updated = { ...p, [field]: numVal };
            const coste = field === 'costeUnitario' ? numVal : p.costeUnitario;
            const margen = field === 'margenPct' ? numVal : p.margenPct;
            const cant = field === 'cantidad' ? numVal : p.cantidad;

            const pvp = Number((coste * (1 + margen / 100)).toFixed(2));
            const tot = Number((pvp * cant).toFixed(2));

            return {
              ...updated,
              costeUnitario: coste,
              margenPct: margen,
              cantidad: cant,
              precioVenta: pvp,
              total: tot
            };
          }
          return p;
        });

        const subtotal = Number(updatedPartidas.reduce((s, p) => s + p.total, 0).toFixed(2));
        const costeTotal = Number(updatedPartidas.reduce((s, p) => s + (p.costeUnitario * p.cantidad), 0).toFixed(2));
        return { ...c, partidas: updatedPartidas, subtotal, costeTotal };
      }
      return c;
    });

    const flat = updatedCapitulos.flatMap(c => c.partidas.map(p => ({ ...p, capitulo: c.nombre })));
    const base = Number(flat.reduce((s, p) => s + p.total, 0).toFixed(2));
    const iva = Number((base * (quote.tipoIvaPct / 100)).toFixed(2));
    const total = Number((base + iva).toFixed(2));
    const coste = Number(flat.reduce((s, p) => s + (p.costeUnitario * p.cantidad), 0).toFixed(2));
    const margen = base > 0 ? Number((((base - coste) / base) * 100).toFixed(1)) : quote.margenGlobalPct;

    updatePresupuesto(quote.id, {
      capitulos: updatedCapitulos,
      partidas: flat,
      baseImponible: base,
      cuotaIva: iva,
      totalConIva: total,
      costeTotal: coste,
      margenGlobalPct: margen
    });
  };

  // Run Voice / Conversational Command
  const handleExecuteVoiceCommand = async (cmdToRun) => {
    const text = (cmdToRun || voiceCommand).trim();
    if (!text) return;

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
          <button
            onClick={onBack}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            title="Volver"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            title="Ver historial de refinamientos IA"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Historial IA</span>
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
        {(quote.capitulos || []).map((cap) => {
          const isCollapsed = collapsedChapters[cap.id];

          return (
            <div key={cap.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Chapter Header */}
              <div
                onClick={() => toggleChapter(cap.id)}
                className="p-4 bg-slate-950/70 hover:bg-slate-950 border-b border-slate-800 flex items-center justify-between cursor-pointer transition select-none"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-bold bg-slate-800 text-amber-400 px-2 py-0.5 rounded">
                    Cap. {cap.codigo}
                  </span>
                  <h3 className="font-extrabold text-white text-sm">{cap.nombre}</h3>
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
                            {item.codigo}
                            {item._modificadoIa && (
                              <span className="block text-[8px] text-emerald-400 font-sans">✨ Mod. IA</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-200 text-xs">
                            {item.concepto}
                          </td>
                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {item.unidad}
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

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

      </div>

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
