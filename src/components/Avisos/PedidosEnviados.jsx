import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, X, Truck, ExternalLink, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import useNotify from './useNotify';
import PedidoBorrador from './PedidoBorrador';
import { pedidoPendienteDePrecio } from '../../utils/gastoPedido';
import { api, ORDER_STATUS, RESPONSE_STATUS, fmtDate, fmtDateTime, fmtMoney, inputCls, btnGhost } from '../../services/avisosApi';

const SENT = ['enviado', 'confirmado', 'entregado'];
const obraIdsOf = (o) => (o.obra_ids?.length ? o.obra_ids : [o.obra_id].filter(Boolean));
const itemsText = (o) => (o.items || []).map((it) => [it.cantidad, it.unidad, it.material].filter(Boolean).join(' ')).join(', ');

/** Pedidos ya enviados a proveedores, en lista; cada uno se abre para consultarlo. */
export default function PedidosEnviados({ suppliers, onOpenNeed, focusId = null, soloSinPrecio = false }) {
  const { obras = [], facturasProveedores = [] } = useApp() || {};
  const showNotification = useNotify();
  const [orders, setOrders] = useState(null);
  const [obra, setObra] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(focusId);
  useEffect(() => { if (focusId) setOpenId(focusId); }, [focusId]);

  useEffect(() => {
    api('/api/material-orders')
      .then((list) => setOrders(list.filter((o) => SENT.includes(o.status))))
      .catch((e) => { setOrders([]); showNotification(e.message, 'error'); });
  }, [showNotification]);

  const obraName = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.codigo || o.titulo])), [obras]);
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name || 'Sin proveedor';

  const shown = useMemo(() => {
    const text = q.trim().toLowerCase();
    return (orders || [])
      .filter((o) => !obra || obraIdsOf(o).includes(obra))
      .filter((o) => !soloSinPrecio || pedidoPendienteDePrecio(o, facturasProveedores))
      .filter((o) => !text || [supplierName(o.supplier_id), o.subject, itemsText(o), o.to_email].join(' ').toLowerCase().includes(text))
      .sort((a, b) => (b.sent_at || b.created_at).localeCompare(a.sent_at || a.created_at));
  }, [orders, obra, q, suppliers, soloSinPrecio, facturasProveedores]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (orders || []).find((o) => o.id === openId);
  const sinPrecio = (orders || []).filter((o) => pedidoPendienteDePrecio(o, facturasProveedores));
  const today = new Date().toISOString().slice(0, 10);

  if (!orders) return <div className="py-10 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proveedor o material" className={`${inputCls} !py-1.5 pl-8 text-xs`} />
        </div>
        <select value={obra} onChange={(e) => setObra(e.target.value)} className={`${inputCls} !w-auto !py-1.5 text-xs`}>
          <option value="">Todas las obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{[o.codigo, o.titulo].filter(Boolean).join(' - ')}</option>)}
        </select>
        <span className="text-xs text-slate-500 ml-auto">{shown.length} pedido{shown.length === 1 ? '' : 's'}</span>
      </div>

      {sinPrecio.length > 0 && !soloSinPrecio && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {sinPrecio.length === 1 ? '1 pedido entregado no tiene' : `${sinPrecio.length} pedidos entregados no tienen`} precio ni factura del proveedor: no se asignan a los gastos de la obra hasta que lo pongas.
            {' '}{sinPrecio.slice(0, 3).map((o) => (
              <button key={o.id} type="button" onClick={() => setOpenId(o.id)} className="underline font-semibold mr-2">{supplierName(o.supplier_id)}</button>
            ))}
          </span>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-center py-10 text-sm text-slate-500">{soloSinPrecio ? 'Todos los pedidos entregados tienen precio.' : 'No hay pedidos enviados.'}</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Enviado</th>
                <th className="py-2.5 px-3">Proveedor</th>
                <th className="py-2.5 px-3">Obra</th>
                <th className="py-2.5 px-3">Materiales</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Entrega</th>
                <th className="py-2.5 px-3 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {shown.map((o) => {
                const st = ORDER_STATUS[o.status] || ORDER_STATUS.enviado;
                const rs = RESPONSE_STATUS[o.response_status];
                const late = o.delivery_date && o.status !== 'entregado' && o.delivery_date < today;
                return (
                  <tr key={o.id} onClick={() => setOpenId(o.id)} className="cursor-pointer hover:bg-slate-800/50 transition">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">{fmtDateTime(o.sent_at)}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{supplierName(o.supplier_id)}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">{obraIdsOf(o).map((id) => obraName[id] || id).join(', ') || '-'}</td>
                    <td className="py-2.5 px-3 max-w-[260px] truncate" title={itemsText(o)}>{itemsText(o) || '-'}</td>
                    <td className="py-2.5 px-3">
                      <span className="flex flex-wrap gap-1">
                        <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                        {rs && o.response_status !== 'pendiente' && <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${rs.cls}`}>{rs.label}</span>}
                        {pedidoPendienteDePrecio(o, facturasProveedores) && <span className="text-[10px] font-bold border rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-300 border-amber-500/40">Falta precio</span>}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 whitespace-nowrap ${late ? 'text-rose-400 font-semibold' : ''}`}>{o.delivery_date ? `${fmtDate(o.delivery_date)}${late ? ' (retrasado)' : ''}` : '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{o.quoted_amount != null ? fmtMoney(o.quoted_amount) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center p-3 overflow-y-auto" onClick={() => setOpenId(null)}>
          <div role="dialog" aria-modal="true" aria-label="Pedido enviado" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4 my-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-white">{supplierName(open.supplier_id)}</h3>
                <p className="text-xs text-slate-400">
                  Enviado {fmtDateTime(open.sent_at)} a {open.to_email} · {obraIdsOf(open).map((id) => obraName[id] || id).join(', ') || 'Sin obra'}
                </p>
              </div>
              <button onClick={() => setOpenId(null)} className="text-slate-400 hover:text-white" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>

            {(open.items || []).length > 0 && (
              <table className="w-full text-sm text-slate-300 border border-slate-800 rounded-xl overflow-hidden">
                <thead className="bg-slate-950/60 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr><th className="text-left py-2 px-3">Material</th><th className="text-right py-2 px-3">Cantidad</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {open.items.map((it, i) => (
                    <tr key={i}><td className="py-1.5 px-3 text-white">{it.material}</td><td className="py-1.5 px-3 text-right whitespace-nowrap">{[it.cantidad, it.unidad].filter(Boolean).join(' ')}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {open.delivery_address && (
              <p className="text-xs text-slate-400 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Entrega en {open.delivery_address}{open.needed_by ? `, antes del ${fmtDate(open.needed_by)}` : ''}</p>
            )}

            <PedidoBorrador key={open.id} order={open} supplierName={supplierName(open.supplier_id)} defaultShowMail
              onChange={(u) => setOrders((prev) => prev.map((o) => (o.id === u.id ? u : o)))} />

            <div className="flex justify-end gap-2">
              {open.need_id && (
                <button onClick={() => { setOpenId(null); onOpenNeed(open.need_id); }} className={btnGhost}>
                  <ExternalLink className="w-4 h-4" /> Ver la necesidad
                </button>
              )}
              <button onClick={() => setOpenId(null)} className={btnGhost}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
