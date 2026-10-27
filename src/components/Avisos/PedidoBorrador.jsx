import React, { useEffect, useRef, useState } from 'react';
import { Send, Save, XCircle, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import useNotify from './useNotify';
import { api, ORDER_STATUS, fmtDateTime, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';

/**
 * Un pedido / solicitud de presupuesto a un proveedor.
 * En borrador: destinatario, asunto y cuerpo editables (el cuerpo se edita directamente sobre la vista previa).
 */
export default function PedidoBorrador({ order, supplierName, onChange }) {
  const showNotification = useNotify();
  const [to, setTo] = useState(order.to_email || '');
  const [cc, setCc] = useState(order.cc_email || '');
  const [subject, setSubject] = useState(order.subject);
  const [busy, setBusy] = useState('');
  const frameRef = useRef(null);
  const editable = order.status === 'borrador' || order.status === 'error';
  const status = ORDER_STATUS[order.status] || ORDER_STATUS.borrador;

  // La vista previa es editable en borrador (designMode del iframe, sin scripts).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const onLoad = () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      if (editable) doc.designMode = 'on';
      frame.style.height = `${Math.min(Math.max(doc.documentElement.scrollHeight, 300), 900)}px`;
    };
    frame.addEventListener('load', onLoad);
    return () => frame.removeEventListener('load', onLoad);
  }, [editable, order.id]);

  const readBody = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return { body_html: order.body_html, body_text: order.body_text };
    return { body_html: `<!doctype html>\n${doc.documentElement.outerHTML}`, body_text: doc.body.innerText.trim() };
  };

  const save = async () => {
    const updated = await api(`/api/material-orders/${order.id}`, {
      method: 'PATCH',
      body: { to_email: to, cc_email: cc, subject, ...readBody() }
    });
    onChange(updated);
    return updated;
  };

  const run = async (kind, fn) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const send = () => run('send', async () => {
    if (!to.trim()) throw new Error('Falta el correo del proveedor.');
    if (!window.confirm(`¿Enviar el pedido a ${to}?`)) return;
    await save();
    const sent = await api(`/api/material-orders/${order.id}/send`, { method: 'POST' });
    onChange(sent);
    showNotification('Pedido enviado al proveedor');
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-white">
          {supplierName || 'Proveedor sin elegir'}
          <span className="text-slate-500 font-normal"> · {order.kind === 'solicitud_presupuesto' ? 'Solicitud de presupuesto' : 'Pedido'}</span>
        </div>
        <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${status.cls}`}>
          {status.label}{order.sent_at ? ` · ${fmtDateTime(order.sent_at)}` : ''}
        </span>
      </div>
      {order.status === 'error' && order.error && <p className="text-xs text-rose-400">{order.error}</p>}

      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-xs text-slate-400 space-y-1">
          <span>Para</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} disabled={!editable} className={inputCls} placeholder="pedidos@proveedor.es" />
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          <span>CC (opcional)</span>
          <input value={cc} onChange={(e) => setCc(e.target.value)} disabled={!editable} className={inputCls} />
        </label>
      </div>
      <label className="block text-xs text-slate-400 space-y-1">
        <span>Asunto</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} className={inputCls} />
      </label>

      <div>
        <p className="text-xs text-slate-400 mb-1">{editable ? 'Vista previa (puedes escribir directamente en ella)' : 'Correo enviado'}</p>
        <iframe ref={frameRef} title={`Pedido ${order.id}`} srcDoc={order.body_html} sandbox="allow-same-origin"
          className="w-full rounded-xl border border-slate-700" style={{ height: 420, background: "#ffffff" }} />
      </div>

      {editable && (
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => run('cancel', async () => onChange(await api(`/api/material-orders/${order.id}`, { method: 'PATCH', body: { status: 'cancelado' } })))}
            disabled={Boolean(busy)} className={btnGhost}>
            <XCircle className="w-4 h-4" /> Descartar
          </button>
          <button onClick={() => run('save', async () => { await save(); showNotification('Borrador guardado'); })} disabled={Boolean(busy)} className={btnGhost}>
            {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </button>
          <button onClick={send} disabled={Boolean(busy)} className={btnPrimary}>
            {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Aprobar y enviar pedido
          </button>
        </div>
      )}
    </div>
  );
}
