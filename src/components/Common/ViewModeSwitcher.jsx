import React from 'react';
import { LayoutGrid, Rows3, Table2 } from 'lucide-react';
import { useUiPreferences } from '../../context/UiPreferencesContext';

export const VIEW_MODE_OPTIONS = [
  { id: 'tarjetas', label: 'Tarjetas', hint: 'Visual, por estados', icon: LayoutGrid },
  { id: 'compacta', label: 'Compacta', hint: 'Máxima densidad', icon: Rows3 },
  { id: 'clasica', label: 'Clásica', hint: 'Tabla con filtros', icon: Table2 }
];

// Selector rápido de vista para las cabeceras de los listados. Guarda la preferencia del usuario.
export default function ViewModeSwitcher({ className = '' }) {
  const { viewMode, setViewMode } = useUiPreferences();

  return (
    <div
      role="radiogroup"
      aria-label="Modo de vista"
      className={`inline-flex items-center p-1 gap-0.5 rounded-xl bg-slate-800 border border-slate-700 ${className}`}
    >
      {VIEW_MODE_OPTIONS.map(opt => {
        const Icon = opt.icon;
        const active = viewMode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setViewMode(opt.id)}
            title={`${opt.label}: ${opt.hint}`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
