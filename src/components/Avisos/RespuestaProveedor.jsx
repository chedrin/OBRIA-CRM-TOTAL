import React, { useState } from 'react';
import { Save, Sparkles, Loader2, PackageCheck } from 'lucide-react';
import useNotify from './useNotify';
import { api, RESPONSE_STATUS, fmtDateTime, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';

/**
 * Respuesta del proveedor a un pedido ya enviado: estado, cuándo lo sirven, importe,
 * notas y el correo de respuesta pegado (la IA puede rellenar los campos a partir de él).
 */
export default function RespuestaProveedor({ order, onChange }) {
  const showNotification = useNotify();
  const [form, setForm] = useState({
    response_status: order.response_status || 'pendiente',
    delivery_date: order.delivery_date || '',
    quoted_amount: order.quoted_amount ?? '',
    response_notes: order.response_notes || '',
    supplier_reply: order.supplier_reply || ''
  });
  const [busy, setBusy] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const save = (extra = {}) => run(extra.delivered ? 'delivered' : 'save', async () => {
    const updated = await api(`/api/material-orders/${order.id}/response`, { method: 'PATCH', body: { ...form, ...extra } });
    onChange(updated);
    showNotification(extra.delivered ? 'Pedido marcado como entregado' : 'Respuesta guardada');
  });

  const readWithAi = () => run('ai', async () => {
    const data = await api('/api/ai/supplier-reply/extract', {
      method: 'POST',
      body: { texto: form.supplier_reply, pedido: `${order.subject}\n${order.body_text || ''}` }
    });
    setForm((prev) => ({
      ...prev,
      response_status: data.estado || prev.response_status,
      delivery_date: data.fecha_entrega || prev.delivery_date,
      quoted_amount: data.importe ?? prev.quoted_amount,
      response_notes: data.notas || prev.response_notes
    }));
    showNotification('Campos rellenados con la IA: revísalos y pulsa Guardar');
  });

  return (
    <div className="border border-slate-700 rounded-xl p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="text-sm font-bold text-white">Respuesta del proveedor</h5>
        {order.responded_at && <span className="text-[11px] text-slate-500">Actualizada {fmtDateTime(order.responded_at)}</span>}
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        <label className="text-xs text-slate-400 space-y-1"><span>Estado</span>
          <select value={form.response_status} onChange={set('response_status')} className={inputCls}>
            {Object.entries(RESPONSE_STATUS).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400 space-y-1"><span>Lo sirven el</span>
          <input type="date" value={form.delivery_date} onChange={set('delivery_date')} className={inputCls} />
        </label>
        <label className="text-xs text-slate-400 space-y-1"><span>Importe sin IVA (€)</span>
          <input inputMode="decimal" value={form.quoted_amount} onChange={set('quoted_amount')} placeholder="0,00" className={inputCls} />
        </label>
      </div>
      <label className="block text-xs text-slate-400 space-y-1"><span>Notas (portes, lo que falta, condiciones…)</span>
        <textarea value={form.response_notes} onChange={set('response_notes')} rows={2} className={inputCls} />
      </label>
      <label className="block text-xs text-slate-400 space-y-1"><span>Correo de respuesta (pégalo aquí si hace falta)</span>
        <textarea value={form.supplier_reply} onChange={set('supplier_reply')} rows={4} placeholder="Pega aquí el correo que te ha contestado el proveedor" className={`${inputCls} font-mono text-xs`} />
      </label>

      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={readWithAi} disabled={Boolean(busy) || form.supplier_reply.trim().length < 5} className={btnGhost}
          title="Lee el correo pegado y rellena estado, fecha, importe y notas">
          {busy === 'ai' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Leer correo con IA
        </button>
        <button onClick={() => save()} disabled={Boolean(busy)} className={btnGhost}>
          {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar respuesta
        </button>
        {order.status !== 'entregado' && (
          <button onClick={() => save({ delivered: true })} disabled={Boolean(busy)} className={btnPrimary}>
            {busy === 'delivered' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} Marcar como entregado
          </button>
        )}
      </div>
    </div>
  );
}
