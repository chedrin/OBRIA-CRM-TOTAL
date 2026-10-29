import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getPushStatus, enablePush, disablePush } from '../../services/pushService';
import { BellRing, BellOff, RefreshCw, Lock } from 'lucide-react';

const ESTADOS = {
  activo: { text: 'Activadas en este dispositivo', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  inactivo: { text: 'Sin activar en este dispositivo', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  bloqueado: { text: 'Bloqueadas por el navegador', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  no_disponible: { text: 'Este navegador no las admite', cls: 'text-slate-400 bg-slate-800 border-slate-700' },
  comprobando: { text: 'Comprobando…', cls: 'text-slate-400 bg-slate-800 border-slate-700' }
};

// Pasos para desbloquear según el navegador: una web no puede quitar el bloqueo por sí sola.
function pasosDesbloqueo() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) {
    return [
      'Instala la app: en Safari, botón Compartir > "Añadir a pantalla de inicio", y ábrela desde el icono.',
      'Ajustes del iPhone > Notificaciones > ObraMaster > activa "Permitir notificaciones".',
      'Vuelve aquí y pulsa "Volver a comprobar".'
    ];
  }
  if (/Firefox\//.test(ua)) {
    return [
      'Pulsa el candado o el icono de ajustes a la izquierda de la dirección web.',
      'En "Enviar notificaciones", quita el bloqueo (la ✕ junto a "Bloqueado").',
      'Recarga la página y pulsa "Activar notificaciones".'
    ];
  }
  if (/Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) {
    return [
      'Menú Safari > Ajustes > Sitios web > Notificaciones.',
      'Busca esta web y cámbiala a "Permitir".',
      'Recarga la página y pulsa "Activar notificaciones".'
    ];
  }
  return [
    'Pulsa el icono a la izquierda de la dirección web (candado o ajustes).',
    'Abre "Configuración del sitio" (o "Permisos") y en "Notificaciones" elige "Permitir".',
    'Recarga la página y pulsa "Activar notificaciones".'
  ];
}

export default function NotificacionesConfig() {
  const { showNotification } = useApp();
  const [status, setStatus] = useState('comprobando');
  const [busy, setBusy] = useState(false);

  const comprobar = () => getPushStatus().then(setStatus).catch(() => setStatus('no_disponible'));
  useEffect(() => { comprobar(); }, []);

  const activar = async () => {
    setBusy(true);
    try {
      await enablePush();
      showNotification('Notificaciones activadas en este dispositivo');
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      await comprobar();
      setBusy(false);
    }
  };

  const desactivar = async () => {
    setBusy(true);
    try {
      await disablePush();
      showNotification('Notificaciones desactivadas en este dispositivo');
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      await comprobar();
      setBusy(false);
    }
  };

  const estado = ESTADOS[status] || ESTADOS.comprobando;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
          <BellRing className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-white">Notificaciones del navegador</h2>
          <p className="text-sm text-slate-400 mt-1">
            Recibe los avisos de obra, pedidos y subcontratas aunque la app esté cerrada. Se activan por dispositivo:
            repítelo en cada ordenador o móvil.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${estado.cls}`}>{estado.text}</span>
        <button onClick={comprobar} disabled={busy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition">
          <RefreshCw className="w-3.5 h-3.5" />
          Volver a comprobar
        </button>
      </div>

      {status === 'bloqueado' && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-300">
            <Lock className="w-4 h-4" />
            El navegador las tiene bloqueadas. Para desbloquearlas:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-300">
            {pasosDesbloqueo().map((paso) => <li key={paso}>{paso}</li>)}
          </ol>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        {status !== 'activo' && (
          <button
            onClick={activar}
            disabled={busy || status === 'no_disponible' || status === 'comprobando'}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
          >
            <BellRing className="w-4 h-4" />
            Activar notificaciones
          </button>
        )}
        {status === 'activo' && (
          <button
            onClick={desactivar}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition"
          >
            <BellOff className="w-4 h-4" />
            Desactivar en este dispositivo
          </button>
        )}
      </div>
    </section>
  );
}
