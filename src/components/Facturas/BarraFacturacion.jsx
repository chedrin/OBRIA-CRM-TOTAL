import React from 'react';

const eur = (v) => Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Barra de lo facturado de un presupuesto u obra, con "Facturado" y "Pendiente de facturar" (bases imponibles). */
export default function BarraFacturacion({ estado, titulo = '', compacta = false, className = '' }) {
  if (!estado || !(estado.total > 0)) return null;
  const pct = Math.min(estado.pct, 100);
  const exceso = estado.facturado > estado.total + 0.02;
  const color = exceso ? 'bg-rose-500' : estado.completo ? 'bg-emerald-500' : 'bg-amber-500';
  return (
    <div className={`space-y-1.5 ${className}`}>
      {titulo && <p className="text-[11px] font-bold text-slate-300">{titulo}</p>}
      <div
        className="h-2 w-full rounded-full bg-slate-800 overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Facturado del presupuesto"
      >
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`flex flex-wrap justify-between gap-x-3 gap-y-0.5 ${compacta ? 'text-[10px]' : 'text-[11px]'}`}>
        <span className="text-slate-400">Facturado: <strong className={exceso ? 'text-rose-300' : 'text-slate-200'}>{eur(estado.facturado)} €</strong> ({estado.pct.toLocaleString('es-ES')} %)</span>
        <span className="text-slate-400">Pendiente de facturar: <strong className={estado.completo ? 'text-emerald-300' : 'text-amber-300'}>{eur(estado.pendiente)} €</strong></span>
      </div>
      {exceso && <p className="text-[10px] text-rose-300">Facturado por encima del presupuesto: corrige con una rectificativa.</p>}
    </div>
  );
}
