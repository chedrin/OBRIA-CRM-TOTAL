import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { improveTextViaBackend, recordAiCorrection } from '../../services/backendAiService';
import { Sparkles, Check, X, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AiImprovementControl({
  value = '',
  onAccept,
  context = 'Descripción técnica de trabajo',
  buttonLabel = 'Mejorar con IA',
  buttonSize = 'normal', // 'small' | 'normal'
  className = '',
  autoRunToken = null // al cambiar, lanza la mejora sola (p. ej. al terminar una transcripción)
}) {
  const { referenceBudgets, empresaConfig, showNotification } = useApp();

  const [isImproving, setIsImproving] = useState(false);
  const [improvedResult, setImprovedResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  // El servidor solo usa el texto de hasta 3 referencias aún no analizadas (las analizadas ya están en la memoria de la IA):
  // se envían solo esas y recortadas, para no subir PDFs enteros en cada mejora.
  const activeRefsCount = (referenceBudgets || []).filter(b => b.is_active !== false).length;
  const activeRefs = (referenceBudgets || [])
    .filter(b => b.is_active !== false && !b.ai_reviewed_at)
    .slice(0, 3)
    .map(({ id, name, tipo_obra, is_active, extracted_text, text_content }) => ({
      id, name, tipo_obra, is_active,
      extracted_text: String(extracted_text || text_content || '').slice(0, 2500)
    }));

  const handleRunImprovement = async () => {
    if (!value || !value.trim()) {
      showNotification('Introduce un texto antes de solicitar la mejora con IA.', 'error');
      return;
    }

    setIsImproving(true);
    setErrorMsg(null);

    try {
      // El servidor añade la memoria de la IA (Ajustes) y los presupuestos de referencia activos.
      const result = await improveTextViaBackend({
        text: value,
        context,
        referenceBudgets: activeRefs,
        provider: empresaConfig?.aiConfig?.provider,
        apiKey: empresaConfig?.aiConfig?.apiKey,
        model: empresaConfig?.aiConfig?.modelName || empresaConfig?.aiConfig?.model
      });

      if (result && result.improvedText) {
        setImprovedResult(result);
        setShowComparison(true);
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
        showNotification('✨ Texto mejorado con la IA activa e imitando las referencias.');
      } else {
        throw new Error('No se pudo generar la versión mejorada del texto.');
      }
    } catch (err) {
      console.error('[AiImprovementControl] Error:', err);
      setErrorMsg(err.message || 'Error al conectar con la IA activa');
      showNotification('Error al mejorar el texto: ' + (err.message || 'Revise la API Key en Ajustes'), 'error');
    } finally {
      setIsImproving(false);
    }
  };

  const lastAutoRunRef = useRef(autoRunToken);
  useEffect(() => {
    if (autoRunToken === null || autoRunToken === lastAutoRunRef.current) return;
    lastAutoRunRef.current = autoRunToken;
    if (value?.trim() && !isImproving) handleRunImprovement();
  }, [autoRunToken]);

  const handleAccept = () => {
    if (improvedResult?.improvedText && onAccept) {
      onAccept(improvedResult.improvedText);
    }
    if (improvedResult?.improvedText) {
      recordAiCorrection({
        kind: 'texto',
        context,
        original: improvedResult.originalText || value,
        aiOutput: improvedResult.improvedText,
        finalText: improvedResult.improvedText,
        accepted: true
      });
    }
    setShowComparison(false);
    setImprovedResult(null);
    showNotification('Texto mejorado aplicado con éxito.');
  };

  const handleDiscard = () => {
    if (improvedResult?.improvedText) {
      recordAiCorrection({
        kind: 'texto',
        context,
        original: improvedResult.originalText || value,
        aiOutput: improvedResult.improvedText,
        accepted: false
      });
    }
    setShowComparison(false);
    setImprovedResult(null);
    showNotification('Mejora descartada. Se conserva el texto original.');
  };

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Button trigger */}
      {!showComparison && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={isImproving || !value?.trim()}
            onClick={handleRunImprovement}
            className={`px-3 py-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition shadow-sm shadow-amber-500/20 active:scale-95 disabled:opacity-50 shrink-0 ${
              buttonSize === 'small' ? 'px-2 py-1 text-[11px]' : ''
            }`}
            title="Mejorar y reescribir con terminología técnica usando la IA activa y presupuestos de referencia"
          >
            {isImproving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Mejorando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                <span>✨ {buttonLabel}</span>
              </>
            )}
          </button>

          {activeRefsCount > 0 && (
            <span className="text-[10px] text-amber-400/90 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>{activeRefsCount} modelo(s) de estilo activo(s)</span>
            </span>
          )}
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Comparison Modal / Panel (Original vs Improved Text) */}
      {showComparison && improvedResult && (
        <div className="bg-slate-950 border-2 border-amber-500/60 p-4 rounded-2xl space-y-3.5 shadow-2xl animate-in fade-in">

          <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Propuesta de Mejora Técnica con IA Activa
              </h4>
            </div>

            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold font-mono">
              IA: {empresaConfig?.aiConfig?.provider?.toUpperCase() || 'ACTIVA'}
            </span>
          </div>

          {/* Original vs Improved Comparison Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">

            {/* Original Draft Text */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl space-y-1.5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  📄 Texto Original (Borrador)
                </span>
                <p className="text-slate-300 font-sans leading-relaxed whitespace-pre-wrap select-text">
                  {improvedResult.originalText}
                </p>
              </div>
              <span className="text-[10px] text-slate-500 block pt-2 border-t border-slate-800/80 font-mono">
                {improvedResult.originalText.length} caracteres
              </span>
            </div>

            {/* AI Improved Professional Text */}
            <div className="bg-gradient-to-b from-amber-950/20 to-slate-900 border border-amber-500/50 p-3 rounded-xl space-y-1.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>✨ Texto Mejorado (Lenguaje Constructor / CTE)</span>
                  </span>
                </div>
                <p className="text-white font-medium font-sans leading-relaxed whitespace-pre-wrap select-text">
                  {improvedResult.improvedText}
                </p>
              </div>

              {improvedResult.explicacionCambios && (
                <div className="pt-2 border-t border-amber-500/30 text-[11px] text-amber-300/90 italic">
                  💡 {improvedResult.explicacionCambios}
                </div>
              )}
            </div>

          </div>

          {/* Action Buttons: Accept or Discard */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDiscard}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <X className="w-4 h-4 text-rose-400" />
              <span>Descartar Mejora</span>
            </button>

            <button
              type="button"
              onClick={handleAccept}
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Aceptar y Reemplazar Campo</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
