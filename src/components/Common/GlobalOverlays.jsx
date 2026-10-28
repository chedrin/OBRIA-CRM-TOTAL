import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

// Botón de cerrar de un modal: aria-label/título "Cerrar…" (no "Cerrar sesión") o texto exacto "Cerrar", "Cancelar" o ✕.
const isCloseLabel = (b) => /^cerrar(?! sesi)/i.test((b.getAttribute('aria-label') || b.title || '').trim());
const isCloseText = (b) => /^(cerrar|cancelar|✕|×|✖)$/i.test(b.textContent.trim());

// Escape cierra el modal que está encima pulsando su botón de cerrar. Así todos los modales
// cumplen la regla de AGENTS.md sin repetir el mismo código en cada uno.
function useEscapeClosesTopModal() {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const layers = [...document.querySelectorAll('.fixed.inset-0')].filter(el => el.getClientRects().length).reverse();
      for (const layer of layers) {
        const buttons = [...layer.querySelectorAll('button')];
        const close = buttons.find(isCloseLabel) || buttons.find(isCloseText);
        if (close) {
          if (!close.disabled) close.click();
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

// Aviso en tiempo real (arriba) y notificación breve (abajo), comunes a todas las vistas.
export default function GlobalOverlays({ alert, notification }) {
  useEscapeClosesTopModal();

  return (
    <>
      {alert && (
        <div
          role="status"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md border border-amber-500 text-white px-5 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ring-4 ring-amber-500/20 w-[calc(100%-2rem)] max-w-md"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
          <span className="text-xs sm:text-sm font-black text-amber-300 truncate">{alert.msg}</span>
        </div>
      )}

      {notification && (
        <div
          role={notification.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className="fixed bottom-4 right-4 left-4 sm:left-auto z-[60] flex items-center gap-2.5 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-300 sm:max-w-sm"
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-semibold">{notification.msg}</span>
        </div>
      )}
    </>
  );
}
