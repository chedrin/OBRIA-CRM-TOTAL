import React, { useEffect, useState } from 'react';

const limitar = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
};

// Devuelve 0 en el primer pintado y el valor real justo después, para que la
// transición CSS de anchura llene la barra desde cero al aparecer.
export function useLlenadoAnimado(valor) {
  const objetivo = limitar(valor);
  const [mostrado, setMostrado] = useState(0);
  useEffect(() => {
    let segundo;
    const primero = requestAnimationFrame(() => {
      segundo = requestAnimationFrame(() => setMostrado(objetivo));
    });
    return () => {
      cancelAnimationFrame(primero);
      if (segundo) cancelAnimationFrame(segundo);
    };
  }, [objetivo]);
  return mostrado;
}

// Clases del relleno animado; respeta "reducir movimiento" del sistema.
export const RELLENO_ANIMADO = 'h-full rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none';

// Barra de avance común: se llena de forma animada hasta `valor` (0-100).
export default function BarraProgreso({
  valor,
  alto = 'h-4',
  ancho = 'w-full',
  color = 'bg-gradient-to-r from-amber-500 to-yellow-400',
  fondo = 'bg-slate-800',
  className = '',
  title
}) {
  const mostrado = useLlenadoAnimado(valor);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(limitar(valor))}
      title={title}
      className={`${ancho} ${alto} ${fondo} rounded-full overflow-hidden ${className}`}
    >
      <div className={`${RELLENO_ANIMADO} ${color}`} style={{ width: `${mostrado}%` }} />
    </div>
  );
}
