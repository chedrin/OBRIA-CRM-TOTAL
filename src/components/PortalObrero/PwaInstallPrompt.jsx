import React, { useState, useEffect } from 'react';
import {
  Download,
  Share,
  PlusSquare,
  Smartphone,
  X,
  CheckCircle2,
  Sparkles,
  ArrowDown
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function PwaInstallPrompt({ onInstalled }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone mode (installed PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    // 2. Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;
    setIsIOS(isIosDevice);

    // 3. Listen for Chrome/Edge/Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // 4. Listen for successful install
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      if (onInstalled) onInstalled();
      confetti({ particleCount: 60, spread: 70 });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [onInstalled]);

  // If already standalone or user dismissed for this session, hide
  if (isStandalone || dismissed) {
    return null;
  }

  // Handle click on Install Button
  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        confetti({ particleCount: 50, spread: 60 });
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } else {
      // Fallback modal for desktop or other browsers
      setShowIOSModal(true);
    }
  };

  return (
    <>
      {/* Banner de instalación en pantalla de inicio */}
      <div className="bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/10 border border-amber-500/40 rounded-2xl p-3 sm:p-3.5 shadow-lg relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-md shadow-amber-500/30">
              <Smartphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">Instalar App en tu Móvil</span>
                <span className="text-[10px] bg-amber-500/30 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-bold">
                  Acceso Rápido
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                Añade el acceso directo para entrar con 1 toque sin abrir el navegador.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black text-xs rounded-xl transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Añadir a Inicio</span>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Guía para iOS (Safari) o navegadores sin prompt automático */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm">Instalar en tu iPhone o iPad</h3>
                  <p className="text-[11px] text-slate-400">Pasos guiados de Safari</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs">
              
              {/* Paso 1 */}
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="text-slate-200 font-semibold">
                    Pulsa el botón <strong className="text-white">Compartir</strong> de Safari:
                  </p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    Es el icono <Share className="w-3.5 h-3.5 text-amber-400 inline" /> en la barra inferior del navegador.
                  </p>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="text-slate-200 font-semibold">
                    Desliza hacia abajo y selecciona:
                  </p>
                  <p className="text-[11px] text-amber-400 font-bold flex items-center gap-1.5 mt-0.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                    <PlusSquare className="w-4 h-4 text-amber-400" />
                    <span>Añadir a la pantalla de inicio</span>
                  </p>
                </div>
              </div>

              {/* Paso 3 */}
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div>
                  <p className="text-slate-200 font-semibold">
                    Pulsa en <strong className="text-white">"Añadir"</strong> (esquina superior derecha).
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    ¡Listo! Se creará el icono de <strong>Portal Obrero</strong> en la pantalla de tu móvil.
                  </p>
                </div>
              </div>

            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition shadow"
            >
              Entendido, voy a añadirla
            </button>
          </div>
        </div>
      )}
    </>
  );
}
