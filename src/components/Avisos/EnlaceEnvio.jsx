import React, { useEffect, useState } from 'react';
import { X, Loader2, MessageCircle, Copy, Send, Link2 } from 'lucide-react';
import useNotify from './useNotify';
import EnviarEnlaceCorreo from './EnviarEnlaceCorreo';
import { api, fmtDate, btnPrimary, btnGhost } from '../../services/avisosApi';

/**
 * Acciones para mandar un enlace de subcontrata: WhatsApp, copiar, WhatsApp API y correo.
 * `link` = respuesta de crear o reenviar el enlace (url, mensaje, whatsappUrl, phone, email…).
 */
export default function EnlaceEnvio({ link, showMessage = true }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [sentByApi, setSentByApi] = useState(false);

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${what} copiado`);
    } catch {
      notify('No se pudo copiar: selecciónalo a mano', 'error');
    }
  };

  const sendApi = async () => {
    setBusy(true);
    try {
      await api('/api/whatsapp/send', { method: 'POST', body: { phone: link.phone, message: link.mensaje } });
      setSentByApi(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {showMessage && <p className="text-sm text-slate-200 bg-slate-950 border border-slate-800 rounded-xl p-3 whitespace-pre-wrap break-words">{link.mensaje}</p>}
      <code className="block text-xs text-slate-300 break-all">{link.url}</code>
      <div className="grid sm:grid-cols-2 gap-2">
        <a href={link.whatsappUrl} target="_blank" rel="noreferrer" className={`${btnPrimary} !bg-emerald-500 hover:!bg-emerald-400`}>
          <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
        </a>
        <button type="button" onClick={() => copy(link.mensaje, 'Mensaje')} className={btnGhost}><Copy className="w-4 h-4" /> Copiar mensaje</button>
        <button type="button" onClick={() => copy(link.url, 'Enlace')} className={btnGhost}><Copy className="w-4 h-4" /> Copiar enlace</button>
        {link.whatsappCloud && link.phone && (
          <button type="button" onClick={sendApi} disabled={busy || sentByApi} className={btnGhost}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {sentByApi ? 'Enviado por la API' : 'Enviar por WhatsApp API'}
          </button>
        )}
        <EnviarEnlaceCorreo key={link.url} link={link} />
      </div>
      {!link.phone && <p className="text-[11px] text-amber-300">La subcontrata no tiene un móvil válido: WhatsApp te dejará elegir el contacto.</p>}
    </div>
  );
}

/** Aviso tras reenviar: si el enlace es nuevo o se ha alargado la caducidad. */
export function avisoReenvio(link) {
  if (link.regenerated) return { text: 'Se ha generado un enlace nuevo: el anterior deja de funcionar. Mándale este.', type: 'warning' };
  if (link.extended) return { text: `Enlace reactivado hasta el ${fmtDate(link.expires_at)}.`, type: 'success' };
  return null;
}

/**
 * Ventana para reenviar el enlace de una asignación (Avance de Obra).
 * Reutiliza el último enlace vigente o crea uno si la asignación no tenía.
 */
export function EnlaceAsignacionModal({ assignment, onClose }) {
  const notify = useNotify();
  const [link, setLink] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api(`/api/sub-tokens/assignment/${assignment.id}`, { method: 'POST', body: {} })
      .then((data) => {
        if (!alive) return;
        setLink(data);
        const aviso = avisoReenvio(data);
        if (aviso) notify(aviso.text, aviso.type);
      })
      .catch((err) => alive && setError(err.message));
    return () => { alive = false; };
  }, [assignment.id, notify]);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-black text-white flex items-center gap-2"><Link2 className="w-4 h-4 text-amber-400" /> Enlace de {assignment.assignee_name}</h3>
          <button type="button" onClick={onClose} className="text-slate-400" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        {error ? <p className="text-sm text-rose-400 font-semibold">{error}</p>
          : !link ? <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Preparando el enlace…</p>
          : (
            <>
              <p className="text-xs text-slate-400">Caduca el {fmtDate(link.expires_at)}. Puedes reenviarlo hasta que el trabajo esté certificado al 100 %.</p>
              <EnlaceEnvio link={link} />
            </>
          )}
      </div>
    </div>
  );
}
