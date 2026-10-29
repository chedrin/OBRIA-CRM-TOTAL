import React from 'react';
import { ArrowLeft } from 'lucide-react';

// Botón común para volver a la pantalla anterior: bien visible, con icono y texto.
export default function BotonVolver({ onClick, children = 'Volver', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 w-fit px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-amber-500/60 text-white text-sm font-semibold rounded-xl shadow-sm transition ${className}`}
    >
      <ArrowLeft className="w-4 h-4 shrink-0" />
      <span>{children}</span>
    </button>
  );
}
