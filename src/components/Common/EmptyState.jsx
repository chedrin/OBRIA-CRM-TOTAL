import React from 'react';

// Estado vacío común de listados: icono, título, explicación y una acción opcional.
export default function EmptyState({ icon: Icon, title, children, actionLabel, actionIcon: ActionIcon, onAction }) {
  return (
    <div className="border border-dashed border-slate-700 rounded-2xl p-8 text-center space-y-3">
      {Icon && (
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="text-sm font-semibold text-white">{title}</p>
      {children && <p className="text-xs text-slate-400 max-w-sm mx-auto">{children}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition"
        >
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
