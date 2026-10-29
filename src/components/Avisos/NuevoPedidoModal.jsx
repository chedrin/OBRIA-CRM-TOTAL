import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Send, FileText, Search } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import useNotify from './useNotify';
import { ItemsEditor, emptyItem } from './NecesidadesPanel';
import { api, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';

/**
 * "Nuevo pedido": pedir suministros a uno o varios proveedores para una o varias obras.
 * Crea la necesidad y un correo por proveedor; se envían en el acto o se dejan en borrador para revisarlos.
 */
export default function NuevoPedidoModal({ onClose, onDone }) {
  const { obras = [] } = useApp() || {};
  const showNotification = useNotify();
  const [suppliers, setSuppliers] = useState([]);
  const [obraIds, setObraIds] = useState([]);
  const [obraSearch, setObraSearch] = useState('');
  const [supplierIds, setSupplierIds] = useState([]);
  const [items, setItems] = useState([emptyItem()]);
  const [form, setForm] = useState({ kind: 'pedido', needed_by: '', delivery_address: '', site_contact_name: '', site_contact_phone: '', notes: '', urgency: 'normal' });
  const [addressTouched, setAddressTouched] = useState(false);
  const [busy, setBusy] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  useEffect(() => {
    api('/api/suppliers').then((list) => setSuppliers(list.filter((s) => s.is_active))).catch((e) => showNotification(e.message, 'error'));
  }, [showNotification]);

  // Obras en curso primero; el buscador filtra por código, título o dirección.
  const obraList = useMemo(() => {
    const q = obraSearch.trim().toLowerCase();
    return [...obras]
      .filter((o) => !q || [o.codigo, o.titulo, o.direccion, o.cliente].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a, b) => (a.estado === 'en_curso' ? 0 : 1) - (b.estado === 'en_curso' ? 0 : 1));
  }, [obras, obraSearch]);

  const toggleObra = (id) => {
    const next = obraIds.includes(id) ? obraIds.filter((x) => x !== id) : [...obraIds, id];
    setObraIds(next);
    // La dirección de entrega se propone con la de la primera obra elegida, salvo que ya se haya escrito otra.
    if (!addressTouched) {
      const first = obras.find((o) => o.id === next[0]);
      setForm((prev) => ({ ...prev, delivery_address: first?.direccion || '' }));
    }
  };
  const toggleSupplier = (id) => setSupplierIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const chosen = suppliers.filter((s) => supplierIds.includes(s.id));
  const withoutEmail = chosen.filter((s) => !s.email);
  const validItems = items.filter((it) => it.material.trim());

  const submit = async (send) => {
    if (validItems.length === 0) return showNotification('Añade al menos un material.', 'error');
    if (send) {
      if (chosen.length === 0) return showNotification('Elige al menos un proveedor.', 'error');
      if (withoutEmail.length) return showNotification(`Falta el correo de: ${withoutEmail.map((s) => s.name).join(', ')}. Añádelo en Proveedores o crea solo el borrador.`, 'error');
      if (!window.confirm(`¿Enviar el pedido por correo a ${chosen.map((s) => s.name).join(', ')}?`)) return undefined;
    }
    setBusy(send ? 'send' : 'draft');
    try {
      const result = await api('/api/material-orders/manual', {
        method: 'POST',
        body: { ...form, obra_ids: obraIds, supplier_ids: supplierIds, items: validItems, send }
      });
      if (result.errors?.length) showNotification(`Algún correo no se pudo enviar: ${result.errors[0]}`, 'error');
      else showNotification(send ? 'Pedido enviado a los proveedores' : 'Borradores creados: revísalos y envíalos');
      onDone(result);
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      setBusy('');
    }
    return undefined;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-label="Nuevo pedido"
        className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4 my-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Nuevo pedido a proveedores</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-white">Obras {obraIds.length > 0 && <span className="text-amber-400">({obraIds.length})</span>}</h4>
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={obraSearch} onChange={(e) => setObraSearch(e.target.value)} placeholder="Buscar obra" className={`${inputCls} !py-1.5 pl-8 text-xs`} />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800">
            {obraList.length === 0 && <p className="p-3 text-xs text-slate-500">No hay obras.</p>}
            {obraList.map((o) => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-800/60">
                <input type="checkbox" checked={obraIds.includes(o.id)} onChange={() => toggleObra(o.id)} className="w-4 h-4 accent-amber-500" />
                <span className="text-white font-semibold">{o.codigo}</span>
                <span className="text-slate-300 truncate">{o.titulo}</span>
                {o.estado !== 'en_curso' && <span className="ml-auto text-[10px] text-slate-500">{o.estado}</span>}
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-bold text-white">Proveedores</h4>
          {suppliers.length === 0 ? (
            <p className="text-xs text-slate-500">No hay proveedores: dalos de alta en la pestaña Proveedores.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {suppliers.map((s) => (
                <button type="button" key={s.id} onClick={() => toggleSupplier(s.id)} title={s.email || 'Sin correo'}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${supplierIds.includes(s.id) ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>
                  {s.name}{!s.email && ' (sin correo)'}
                </button>
              ))}
            </div>
          )}
          <select value={form.kind} onChange={set('kind')} className={`${inputCls} !w-auto`}>
            <option value="pedido">Pedido (que lo sirvan)</option>
            <option value="solicitud_presupuesto">Pedir precio y plazo (comparar)</option>
          </select>
        </section>

        <section className="space-y-2">
          <h4 className="text-sm font-bold text-white">Materiales</h4>
          <ItemsEditor items={items} setItems={setItems} />
        </section>

        <section className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs text-slate-400 space-y-1"><span>Entregar antes de</span>
            <input type="date" value={form.needed_by} onChange={set('needed_by')} className={inputCls} /></label>
          <label className="text-xs text-slate-400 space-y-1"><span>Dirección de entrega</span>
            <input value={form.delivery_address} onChange={(e) => { setAddressTouched(true); set('delivery_address')(e); }} placeholder="Obra, nave o almacén" className={inputCls} /></label>
          <label className="text-xs text-slate-400 space-y-1"><span>Contacto para la descarga</span>
            <input value={form.site_contact_name} onChange={set('site_contact_name')} className={inputCls} /></label>
          <label className="text-xs text-slate-400 space-y-1"><span>Teléfono</span>
            <input value={form.site_contact_phone} onChange={set('site_contact_phone')} className={inputCls} /></label>
          <label className="text-xs text-slate-400 space-y-1 sm:col-span-2"><span>Observaciones para el proveedor</span>
            <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Horario de descarga, acceso con camión, portes…" className={inputCls} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold text-white">
            <input type="checkbox" checked={form.urgency === 'urgente'} onChange={(e) => setForm({ ...form, urgency: e.target.checked ? 'urgente' : 'normal' })} className="w-4 h-4 accent-rose-500" />
            Urgente
          </label>
        </section>

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-800">
          <button onClick={onClose} className={btnGhost}>Cancelar</button>
          <button onClick={() => submit(false)} disabled={Boolean(busy)} className={btnGhost}>
            {busy === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Revisar antes de enviar
          </button>
          <button onClick={() => submit(true)} disabled={Boolean(busy)} className={btnPrimary}>
            {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
