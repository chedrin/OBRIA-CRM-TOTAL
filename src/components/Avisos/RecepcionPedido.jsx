import React, { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, PackageCheck, Paperclip, Receipt, ExternalLink, Edit2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import useNotify from './useNotify';
import { api, fmtMoney, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import {
  obraIdsPedido, gastosDePedido, repartoIgual, validarPrecioPedido, planGastosPedido
} from '../../utils/gastoPedido';

const hoy = () => new Date().toISOString().slice(0, 10);
const AVISO_SIN_PRECIO = 'Sin precio ni factura del proveedor, este material no se asignará a los gastos de la obra hasta que lo incluyas.';

async function subirFactura(obraId, file) {
  const fd = new FormData();
  fd.append('obra_id', obraId);
  fd.append('archivo', file, file.name);
  const res = await fetch('/api/obras/gastos/adjunto', { method: 'POST', body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status} al subir la factura`);
  return data;
}

/**
 * Recepción de un pedido a proveedor: al marcarlo entregado pide el precio o la factura y
 * crea el gasto en la obra (Gastos vs Ingresos). Sin precio queda pendiente; el precio se
 * puede cambiar después y se actualiza el mismo gasto (utils/gastoPedido.js).
 */
export default function RecepcionPedido({ order, supplierName = '', onChange, disabled = false }) {
  const { obras = [], facturasProveedores = [], addFacturaProveedor, updateFacturaProveedor, deleteFacturaProveedor } = useApp() || {};
  const showNotification = useNotify();
  const obraIds = obraIdsPedido(order);
  const existentes = useMemo(() => gastosDePedido(facturasProveedores, order.id), [facturasProveedores, order.id]);
  const entregado = order.status === 'entregado';
  const [modo, setModo] = useState(null); // 'entrega' | 'editar'
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);

  const obraNombre = (id) => {
    const o = obras.find((x) => x.id === id);
    return o ? [o.codigo, o.titulo].filter(Boolean).join(' - ') : id;
  };

  const abrir = (m) => {
    const primero = existentes[0];
    const base = existentes.length ? existentes.reduce((s, g) => s + Number(g.baseImponible || 0), 0) : order.quoted_amount ?? '';
    setForm({
      base: base === '' ? '' : String(Math.round(Number(base) * 100) / 100),
      ivaPct: String(primero?.tipoIvaPct ?? 21),
      numero: primero?.numeroProveedor || '',
      fecha: primero?.fecha || order.delivery_date || hoy(),
      file: null,
      reparto: existentes.length
        ? Object.fromEntries(obraIds.map((id) => [id, String(existentes.find((g) => g.obraId === id)?.baseImponible ?? '')]))
        : null
    });
    setError('');
    setModo(m);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const reparto = form?.reparto || (form ? Object.fromEntries(Object.entries(repartoIgual(Number(String(form.base).replace(',', '.')) || 0, obraIds)).map(([k, v]) => [k, String(v)])) : {});
  const sinPrecio = !form || String(form.base).trim() === '';

  const marcarEntregado = async (extra = {}) => {
    const updated = await api(`/api/material-orders/${order.id}/response`, { method: 'PATCH', body: { delivered: true, ...extra } });
    onChange(updated);
  };

  const guardar = async ({ conPrecio }) => {
    setError('');
    if (!conPrecio) {
      setBusy('sin');
      try {
        await marcarEntregado();
        showNotification(`Pedido entregado. ${AVISO_SIN_PRECIO}`, 'warning');
        setModo(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy('');
      }
      return;
    }
    const v = validarPrecioPedido({ base: form.base, obraIds, reparto });
    if (v.error) { setError(v.error); return; }
    setBusy('precio');
    try {
      const adjunto = form.file ? await subirFactura(obraIds[0], form.file) : (existentes[0]?.adjunto || null);
      const plan = planGastosPedido({
        order, obras, bases: v.bases, existentes,
        ivaPct: Number(form.ivaPct) || 0, numero: form.numero, fecha: form.fecha || hoy(),
        proveedor: supplierName, adjunto
      });
      plan.crear.forEach((g) => addFacturaProveedor(g, { silent: true }));
      plan.actualizar.forEach(({ id, changes }) => updateFacturaProveedor(id, changes));
      plan.quitar.forEach((id) => deleteFacturaProveedor(id));
      const total = Object.values(v.bases).reduce((s, b) => s + b, 0);
      if (entregado) {
        const updated = await api(`/api/material-orders/${order.id}/response`, { method: 'PATCH', body: { quoted_amount: total } });
        onChange(updated);
        showNotification('Precio actualizado en los gastos de la obra');
      } else {
        await marcarEntregado({ quoted_amount: total });
        showNotification('Pedido entregado y gasto asignado a la obra');
      }
      setModo(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const abrirFactura = async () => {
    try {
      const { url } = await api(`/api/obras/gastos/adjunto?path=${encodeURIComponent(existentes[0].adjunto.path)}`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  // Botón de entrega (pedido aún no entregado).
  if (!entregado && !modo) {
    return (
      <button onClick={() => abrir('entrega')} disabled={disabled} className={btnPrimary}>
        <PackageCheck className="w-4 h-4" /> Marcar como entregado
      </button>
    );
  }

  return (
    <div className="w-full space-y-2">
      {entregado && !modo && (existentes.length ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-slate-300 flex flex-wrap items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          <span className="flex-1 min-w-0">
            Gasto asignado: {existentes.map((g) => `${fmtMoney(g.baseImponible)} sin IVA${obraIds.length > 1 ? ` (${obraNombre(g.obraId)})` : ''}`).join(' · ')}
            {existentes[0]?.numeroProveedor ? ` · factura ${existentes[0].numeroProveedor}` : ''}
          </span>
          {existentes[0]?.adjunto?.path && <button type="button" onClick={abrirFactura} className="text-sky-300 font-semibold inline-flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" /> Factura</button>}
          <button type="button" onClick={() => abrir('editar')} className={`${btnGhost} !py-1 text-xs`}><Edit2 className="w-3.5 h-3.5" /> Editar precio</button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 flex flex-wrap items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0">Entregado sin precio. {AVISO_SIN_PRECIO}</span>
          <button type="button" onClick={() => abrir('editar')} className={`${btnPrimary} !py-1 text-xs`}><Receipt className="w-3.5 h-3.5" /> Poner precio o factura</button>
        </div>
      ))}

      {modo && form && (
        <div className="rounded-xl border border-amber-500/30 bg-slate-950/40 p-3 space-y-3">
          <div>
            <h6 className="text-sm font-bold text-white">{modo === 'entrega' ? 'Material recibido: ¿cuánto ha cobrado el proveedor?' : 'Precio o factura del proveedor'}</h6>
            <p className="text-[11px] text-slate-400">Se apunta como gasto de material en {obraIds.length > 1 ? 'las obras del pedido' : 'la obra'} (Gastos vs Ingresos) y en el libro de facturas recibidas.</p>
          </div>
          <div className="grid sm:grid-cols-4 gap-2">
            <label className="text-xs text-slate-400 space-y-1"><span>Importe sin IVA (€)</span>
              <input inputMode="decimal" value={form.base} onChange={(e) => setForm({ ...form, base: e.target.value, reparto: null })} placeholder="0,00" className={inputCls} autoFocus />
            </label>
            <label className="text-xs text-slate-400 space-y-1"><span>IVA</span>
              <select value={form.ivaPct} onChange={set('ivaPct')} className={inputCls}>
                {['21', '10', '4', '0'].map((p) => <option key={p} value={p}>{p} %</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400 space-y-1"><span>Nº de factura o albarán</span>
              <input value={form.numero} onChange={set('numero')} className={inputCls} />
            </label>
            <label className="text-xs text-slate-400 space-y-1"><span>Fecha</span>
              <input type="date" value={form.fecha} onChange={set('fecha')} className={inputCls} />
            </label>
          </div>
          {obraIds.length > 1 && (
            <div className="space-y-1">
              <span className="block text-xs text-slate-400">Reparto entre obras (sin IVA)</span>
              <div className="grid sm:grid-cols-2 gap-2">
                {obraIds.map((id) => (
                  <label key={id} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="flex-1 truncate">{obraNombre(id)}</span>
                    <input inputMode="decimal" value={reparto[id] ?? ''} onChange={(e) => setForm({ ...form, reparto: { ...reparto, [id]: e.target.value } })} className={`${inputCls} !w-28`} />
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className={`${btnGhost} !py-1.5 text-xs cursor-pointer w-fit`}>
            <Paperclip className="w-4 h-4" /> {form.file ? form.file.name.slice(0, 32) : existentes[0]?.adjunto ? 'Cambiar factura' : 'Adjuntar factura (PDF o foto)'}
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} />
          </label>

          {sinPrecio && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {form.file ? 'Con la factura, escribe también su importe sin IVA para poder asignarlo a la obra.' : `${AVISO_SIN_PRECIO} Quedará marcado como pendiente y podrás ponerlo después.`}
            </p>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex flex-wrap gap-2 justify-end">
            <button type="button" onClick={() => setModo(null)} disabled={Boolean(busy)} className={btnGhost}>Cancelar</button>
            {modo === 'entrega' && (
              <button type="button" onClick={() => guardar({ conPrecio: false })} disabled={Boolean(busy)} className={btnGhost}
                title="Se marca entregado sin asignar gasto a la obra">
                {busy === 'sin' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} Entregado sin precio
              </button>
            )}
            <button type="button" onClick={() => guardar({ conPrecio: true })} disabled={Boolean(busy) || sinPrecio} className={btnPrimary}>
              {busy === 'precio' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />} {modo === 'entrega' ? 'Entregado y asignar gasto' : 'Guardar precio'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
