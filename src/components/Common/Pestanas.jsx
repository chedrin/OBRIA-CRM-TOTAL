import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/*
 * Barra de pestañas común de la app.
 * - Escritorio/tableta: las pestañas que no caben pasan a una segunda (o tercera) fila, centradas.
 * - Móvil: con pocas pestañas (4 o menos) también en varias filas; con más, una sola fila con
 *   desplazamiento lateral y flechas.
 * - Pestaña activa en color sólido para que se distinga en tema claro y oscuro.
 *
 * tabs: [{ id, label, icon?, count?, badge?, badgeTone?: 'emerald' | 'slate' }]
 */
const ACENTOS = {
  amber: 'bg-amber-500 border-amber-400 text-slate-950 shadow-md shadow-amber-500/25',
  emerald: 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/25',
  indigo: 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/25'
};

const RING = {
  amber: 'focus-visible:ring-amber-400',
  emerald: 'focus-visible:ring-emerald-400',
  indigo: 'focus-visible:ring-indigo-400'
};

export default function Pestanas({
  tabs,
  value,
  onChange,
  accent = 'amber',
  size = 'md',
  ariaLabel = 'Secciones',
  className = ''
}) {
  const scrollRef = useRef(null);
  const [flechas, setFlechas] = useState({ izq: false, der: false });

  const medir = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setFlechas({ izq: el.scrollLeft > 2, der: el.scrollLeft < max - 2 });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    window.addEventListener('resize', medir);
    return () => {
      el.removeEventListener('scroll', medir);
      ro?.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, [medir, tabs.length]);

  // Lleva la pestaña activa a la vista en la fila desplazable (sin mover la página en vertical).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const activa = el.querySelector('[aria-selected="true"]');
    if (!activa) return;
    const izq = activa.offsetLeft - el.offsetLeft;
    const der = izq + activa.offsetWidth;
    if (izq < el.scrollLeft + 32) el.scrollTo({ left: Math.max(0, izq - 40), behavior: 'smooth' });
    else if (der > el.scrollLeft + el.clientWidth - 32) el.scrollTo({ left: der - el.clientWidth + 40, behavior: 'smooth' });
  }, [value]);

  const desplazar = (dir) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.id === value);
    const sig = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    if (!sig) return;
    e.preventDefault();
    onChange(sig.id);
    requestAnimationFrame(() => scrollRef.current?.querySelector(`[data-tab-id="${CSS.escape(String(sig.id))}"]`)?.focus());
  };

  const pequeno = size === 'sm';
  const enFilas = tabs.length <= 4;
  const flecha = 'absolute top-1/2 -translate-y-1/2 z-10 sm:hidden w-8 h-8 rounded-full bg-slate-900 border border-slate-600 text-slate-100 shadow-lg flex items-center justify-center transition hover:bg-slate-800 active:scale-95';

  return (
    <div className={`relative bg-slate-900 border border-slate-700 rounded-2xl p-1.5 ${className}`}>
      {flechas.izq && (
        <button type="button" aria-label="Ver pestañas anteriores" onClick={() => desplazar(-1)} className={`${flecha} left-1`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className={`flex gap-1.5 ${enFilas ? 'flex-wrap justify-center' : 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible'} ${
          flechas.izq ? 'pl-9 sm:pl-0' : ''
        } ${flechas.der ? 'pr-9 sm:pr-0' : ''}`}
      >
        {tabs.map((t) => {
          const activa = t.id === value;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-tab-id={t.id}
              aria-selected={activa}
              tabIndex={activa ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={`shrink-0 whitespace-nowrap flex items-center gap-2 rounded-xl border font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 ${RING[accent] || RING.amber} ${
                pequeno ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-xs sm:text-sm'
              } ${
                activa
                  ? `${ACENTOS[accent] || ACENTOS.amber} font-bold`
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600 hover:text-white hover:-translate-y-px'
              }`}
            >
              {Icon && <Icon className={pequeno ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
              <span>{t.label}</span>
              {t.badge && (
                <span className={`text-[10px] px-1.5 rounded font-mono font-bold border ${
                  activa
                    ? 'bg-slate-950/15 border-slate-950/20'
                    : t.badgeTone === 'slate'
                      ? 'bg-slate-700 border-slate-600 text-slate-300'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}>
                  {t.badge}
                </span>
              )}
              {t.count !== undefined && t.count !== null && (
                <span className={`text-[10px] min-w-[1.25rem] text-center px-1.5 rounded-full font-bold ${
                  activa ? 'bg-slate-950/20' : 'bg-slate-700 text-slate-200'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {flechas.der && (
        <button type="button" aria-label="Ver más pestañas" onClick={() => desplazar(1)} className={`${flecha} right-1`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
