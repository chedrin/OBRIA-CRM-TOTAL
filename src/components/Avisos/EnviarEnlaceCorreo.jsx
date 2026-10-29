import React, { useState } from 'react';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import useNotify from './useNotify';
import { inputCls, btnGhost } from '../../services/avisosApi';
import { sendTemplateEmail } from '../../services/documentDispatchService';

/**
 * Envía por correo el enlace mágico de una subcontrata con la plantilla
 * "Encargo a subcontrata" de Ajustes > Correos.
 * `link` = respuesta de createSubToken (url, email, contacto, obra_label, task_label, task_kind, expires_at).
 */
export default function EnviarEnlaceCorreo({ link }) {
  const notify = useNotify();
  const [to, setTo] = useState(link.email || '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const enviar = async () => {
    setBusy(true);
    try {
      const tarea = link.task_label ? `la ${link.task_kind === 'fase' ? 'fase' : 'partida'} "${link.task_label}"` : 'un trabajo';
      const res = await sendTemplateEmail({
        tipo: 'subcontrata_enlace',
        to,
        variables: {
          contacto: link.contacto || link.subcontractor_name || '',
          subcontrata: link.subcontractor_name || '',
          tarea,
          obra: link.obra_label || '',
          caduca: link.expires_at ? new Date(link.expires_at).toLocaleDateString('es-ES') : '',
          enlace: link.url
        }
      });
      setSent(true);
      notify(res.message, res.provider === 'simulated_smtp' ? 'warning' : 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:col-span-2">
      <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Correo de la subcontrata" className={inputCls} />
      <button type="button" onClick={enviar} disabled={busy || sent || !to} className={`${btnGhost} shrink-0`}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Mail className="w-4 h-4" />}
        {sent ? 'Correo enviado' : 'Enviar por correo'}
      </button>
    </div>
  );
}
