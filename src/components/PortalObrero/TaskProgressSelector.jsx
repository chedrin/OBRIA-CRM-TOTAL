import React, { useState } from 'react';
import BarraProgreso from '../Common/BarraProgreso';
import { Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

const PROGRESS_STAGES = [
  { value: 0, label: '0%', text: 'Pendiente', color: 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700' },
  { value: 25, label: '25%', text: 'Iniciada', color: 'bg-amber-950/60 text-amber-400 border-amber-500/30 hover:bg-amber-900/60' },
  { value: 50, label: '50%', text: 'A mitad', color: 'bg-amber-900/60 text-amber-300 border-amber-500/40 hover:bg-amber-800/60' },
  { value: 75, label: '75%', text: 'Avanzada', color: 'bg-amber-800/80 text-amber-200 border-amber-400/50 hover:bg-amber-700' },
  { value: 100, label: '100%', text: 'Terminada ✓', color: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500' }
];

/**
 * Selector táctil e intuitivo de progreso porcentual para el obrero en obra móvil.
 * Soporta mutación optimista con feedback táctil inmediato.
 */
export default function TaskProgressSelector({
  currentProgress = 0,
  onProgressChange,
  taskTitle = '',
  disabled = false,
  compact = false,
  onRequestEvidencePhoto = null
}) {
  // Estado local para mutación optimista inmediata
  const [optimisticProgress, setOptimisticProgress] = useState(currentProgress);
  const [isUpdating, setIsUpdating] = useState(false);

  // Sincronizar si cambia desde fuera
  React.useEffect(() => {
    setOptimisticProgress(currentProgress);
  }, [currentProgress]);

  const handleSelectProgress = (value) => {
    if (disabled || isUpdating) return;

    // Mutación optimista en el cliente
    setOptimisticProgress(value);
    setIsUpdating(true);

    if (value === 100) {
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.7 }
      });
      // Si se proporcionó callback para solicitar foto de evidencia final
      if (onRequestEvidencePhoto) {
        onRequestEvidencePhoto();
      }
    }

    if (onProgressChange) {
      onProgressChange(value);
    }

    setTimeout(() => {
      setIsUpdating(false);
    }, 350);
  };

  return (
    <div className={`space-y-1.5 text-xs`}>
      {/* Barra de progreso visual con feedback de estado */}
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
        <span className="flex items-center gap-1">
          {optimisticProgress === 100 ? (
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Completada
            </span>
          ) : optimisticProgress > 0 ? (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400 inline" />
              En ejecución ({optimisticProgress}%)
            </span>
          ) : (
            <span className="text-slate-500">Sin iniciar</span>
          )}
        </span>
        <span className="font-mono font-bold text-white text-xs">
          {optimisticProgress}%
        </span>
      </div>

      {/* Mini Progress Bar Line */}
      <BarraProgreso
        valor={optimisticProgress}
        alto="h-3"
        fondo="bg-slate-900"
        className="border border-slate-800"
        color={
          optimisticProgress === 100
            ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
            : optimisticProgress > 0
            ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
            : 'bg-transparent'
        }
      />

      {/* Botonera Táctil Rápida */}
      <div className="grid grid-cols-5 gap-1 pt-1">
        {PROGRESS_STAGES.map((stage) => {
          const isSelected = optimisticProgress === stage.value;
          const isPast = optimisticProgress >= stage.value && stage.value > 0;

          return (
            <button
              key={stage.value}
              type="button"
              disabled={disabled || isUpdating}
              onClick={() => handleSelectProgress(stage.value)}
              className={`min-h-11 py-2 px-1 rounded-lg font-bold text-sm transition-all duration-200 flex flex-col items-center justify-center border active:scale-95 touch-manipulation ${
                isSelected
                  ? stage.value === 100
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/20'
                    : 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-500/30 ring-2 ring-amber-400/20 font-black'
                  : isPast
                  ? 'bg-slate-900 text-amber-400/80 border-slate-700/80'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <span>{stage.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
