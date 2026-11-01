import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import useNotify from './useNotify';
import PedidosEnviados from './PedidosEnviados';
import { pedidoPendienteDePrecio } from '../../utils/gastoPedido';
import { api, ORDER_STATUS, RESPONSE_STATUS, fmtDate, fmtDateTime, fmtMoney, inputCls } from '../../services/avisosApi';

// Todos los pedidos enviados a proveedores: cuándo los sirven, a qué precio y para qué obras.
export default function PedidosPanel({ onOpenNeed, focusId = null }) {
  const { obras = [], facturasProveedores = [] } = useApp() || {};
  const showNotification = useNotify();
  const [orders, setOrders] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [filter, setFilter] = useState('pendientes');
  const [obra, setObra] = useState('');
  const [abierto, setAbierto] = useState(focusId);
  useEffect(() => { if (focusId) setAbierto(focusId); }, [focusId]);

  useEffect(() => {
    Promise.all([api('/api/material-orders'), api('/api/suppliers')])
      .then(([o, s]) => { setOrders(o); setSuppliers(s); })
      .catch((e) => { setOrders([]); showNotification(e.message, 'error'); });
  }, [showNotification]);

  const obraName = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.codigo || o.titulo])), [obras]);
  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name || 'Sin proveedor';
  const obraIdsOf = (o) => (o.obra_ids?.length ? o.obra_ids : [o.obra_id].filter(Boolean));

  const shown = (orders || [])
    .filter((o) => o.status !== 'cancelado')
    .filter((o) => (filter === 'pendientes' ? ['borrador', 'error', 'enviado', 'confirmado'].includes(o.status) : true))
    .filter((o) => !obra || obraIdsOf(o).includes(obra))
    // Primero lo que se sirve antes; sin fecha, al final.
    .sort((a, b) => (a.delivery_date || '9999').localeCompare(b.delivery_date || '9999') || b.created_at.localeCompare(a.created_at));

  const sinPrecio = (orders || []).filter((o) => pedidoPendienteDePrecio(o, facturasProveedores)).length;

  if (!orders) return <div className="py-10 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {[['pendientes', 'Pendientes de recibir'], ['sin_precio', `Entregados sin precio${sinPrecio ? ` (${sinPrecio})` : ''}`], ['todos', 'Todos']].map(([id, label]) => (
          <button key={id} onClick={() => { setFilter(id); setAbierto(null); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${filter === id ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>{label}</button>
        ))}
        <select value={obra} onChange={(e) => setObra(e.target.value)} className={`${inputCls} !w-auto !py-1.5 text-xs`}>
          <option value="">Todas las obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{[o.codigo, o.titulo].filter(Boolean).join(' - ')}</option>)}
        </select>
      </div>

      {(filter === 'sin_precio' || abierto) ? (
        <PedidosEnviados key={abierto || 'sin'} suppliers={suppliers} onOpenNeed={onOpenNeed} focusId={abierto} soloSinPrecio={filter === 'sin_precio'} />
      ) : shown.length === 0 ? (
        <p className="text-center py-10 text-sm text-slate-500">No hay pedidos {filter === 'pendientes' ? 'pendientes' : ''}.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((o) => {
            const st = ORDER_STATUS[o.status] || ORDER_STATUS.borrador;
            const rs = RESPONSE_STATUS[o.response_status];
            const late = o.delivery_date && o.status !== 'entregado' && o.delivery_date < new Date().toISOString().slice(0, 10);
            return (
              <li key={o.id}>
                <button onClick={() => (['enviado', 'confirmado', 'entregado'].includes(o.status) ? setAbierto(o.id) : o.need_id && onOpenNeed(o.need_id))}
                  className="w-full text-left bg-slate-900 border border-slate-800 rounded-2xl p-3 hover:bg-slate-800/60 transition flex flex-wrap gap-3 items-start">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-white">
                      {supplierName(o.supplier_id)}
                      <span className="text-slate-400 font-normal"> · {obraIdsOf(o).map((id) => obraName[id] || id).join(', ') || 'Sin obra'}</span>
                    </span>
                    <span className="block text-xs text-slate-400 truncate">
                      {(o.items || []).map((it) => [it.cantidad, it.unidad, it.material].filter(Boolean).join(' ')).join(', ')}
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-1">
                      {o.sent_at ? `Enviado ${fmtDateTime(o.sent_at)}` : `Creado ${fmtDateTime(o.created_at)}`}
                      {o.response_notes ? ` · ${o.response_notes}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0 text-xs">
                    <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                    {rs && o.status !== 'borrador' && o.response_status !== 'pendiente' && (
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${rs.cls}`}>{rs.label}</span>
                    )}
                    {o.delivery_date && (
                      <span className={`flex items-center gap-1 font-semibold ${late ? 'text-rose-400' : 'text-slate-300'}`}>
                        <Truck className="w-3.5 h-3.5" /> {fmtDate(o.delivery_date)}{late ? ' (retrasado)' : ''}
                      </span>
                    )}
                    {o.quoted_amount != null && <span className="font-bold text-white">{fmtMoney(o.quoted_amount)}</span>}
                    {pedidoPendienteDePrecio(o, facturasProveedores) && <span className="text-[10px] font-bold border rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-300 border-amber-500/40">Falta precio</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
