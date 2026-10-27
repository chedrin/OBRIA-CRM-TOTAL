import React from 'react';
import { Sun, Moon, Check, Palette, LayoutGrid } from 'lucide-react';
import { useUiPreferences } from '../../context/UiPreferencesContext';
import { VIEW_MODE_OPTIONS } from '../Common/ViewModeSwitcher';

const THEME_OPTIONS = [
  { id: 'claro', label: 'Claro', desc: 'Fondos luminosos, bordes suaves y máxima legibilidad.', icon: Sun },
  { id: 'oscuro', label: 'Oscuro', desc: 'El aspecto anterior de ObraMaster, para poca luz.', icon: Moon }
];

const VIEW_DESCRIPTIONS = {
  tarjetas: 'Columnas por estado (Kanban) y tarjetas grandes. Ideal para ver de un vistazo qué está en curso, aceptado o pendiente.',
  compacta: 'Filas densas con lo esencial. Para trabajar rápido en escritorio con muchas obras y presupuestos.',
  clasica: 'Tabla corporativa con búsqueda, filtros por estado, fechas e importes y orden por columnas.'
};

// Miniatura ilustrativa de cada vista.
function ViewPreview({ mode }) {
  if (mode === 'tarjetas') {
    return (
      <div className="grid grid-cols-3 gap-1.5 h-full">
        {['bg-amber-500/40', 'bg-sky-500/40', 'bg-emerald-500/40'].map((c, i) => (
          <div key={i} className="rounded-md bg-slate-800 p-1 space-y-1">
            <div className={`h-1 rounded ${c}`} />
            <div className="h-4 rounded bg-slate-900 border border-slate-700" />
            {i !== 2 && <div className="h-4 rounded bg-slate-900 border border-slate-700" />}
          </div>
        ))}
      </div>
    );
  }
  if (mode === 'compacta') {
    return (
      <div className="space-y-[3px] h-full">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-[5px] rounded-sm bg-slate-700" style={{ width: `${70 + ((i * 13) % 30)}%` }} />
        ))}
      </div>
    );
  }
  return (
    <div className="h-full rounded-md border border-slate-700 overflow-hidden">
      <div className="h-2.5 bg-slate-700" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-3 border-t border-slate-700 grid grid-cols-4">
          <span className="border-r border-slate-700" /><span className="border-r border-slate-700" /><span className="border-r border-slate-700" /><span />
        </div>
      ))}
    </div>
  );
}

export default function AparienciaConfig() {
  const { theme, setTheme, viewMode, setViewMode } = useUiPreferences();

  return (
    <div className="space-y-6">
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-400" />
            Tema de la interfaz
          </h2>
          <p className="text-xs text-slate-400 mt-1">Se guarda para tu usuario en este navegador.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THEME_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const active = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                aria-pressed={active}
                className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  active ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${opt.id === 'claro' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{opt.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                  </div>
                </div>
                {active && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center animate-in zoom-in fade-in">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-indigo-400" />
            Modelo de vista de Obras y Presupuestos
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            También puedes cambiarla desde el selector de cada listado. Se recuerda para tu usuario.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {VIEW_MODE_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const active = viewMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViewMode(opt.id)}
                aria-pressed={active}
                className={`relative text-left p-4 rounded-2xl border-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-3 ${
                  active ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="h-20 p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <ViewPreview mode={opt.id} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-slate-400" />
                    Vista {opt.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{VIEW_DESCRIPTIONS[opt.id]}</p>
                </div>
                {active && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center animate-in zoom-in fade-in">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
