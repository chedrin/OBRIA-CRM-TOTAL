import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BotonVolver from '../Common/BotonVolver';
import { Plus, Trash2, FileText, Loader2, Phone, CalendarClock, Send, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import useNotify from './useNotify';
import { api, NEED_CATEGORIES, NEED_STATUS, fmtDate, fmtDateTime, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';
import PedidoBorrador from './PedidoBorrador';

const categoryLabel = (value) => NEED_CATEGORIES.find((c) => c.value === value)?.label || value;
export const emptyItem = () => ({ material: '', cantidad: '', unidad: '' });

export function ItemsEditor({ items, setItems }) {
  const update = (i, key, value) => setItems(items.map((it, j) => (j === i ? { ...it, [key]: value } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_90px_auto] gap-2">
          <input value={it.material} onChange={(e) => update(i, 'material', e.target.value)} placeholder="Material" className={inputCls} />
          <input value={it.cantidad} onChange={(e) => update(i, 'cantidad', e.target.value)} placeholder="Cant." className={inputCls} />
          <input value={it.unidad} onChange={(e) => update(i, 'unidad', e.target.value)} placeholder="Unidad" className={inputCls} />
          <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-slate-500 hover:text-rose-400 px-1" aria-label="Quitar línea">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setItems([...items, emptyItem()])} className="text-xs font-bold text-amber-400 flex items-center gap-1">
        <Plus className="w-3.5 h-3.5" /> Añadir material
      </button>
    </div>
  );
}

const ORDERABLE = ['material', 'herramienta', 'maquinaria'];

// Proveedores habituales de esa partida primero (coinciden con la categoría o el texto).
function sortSuppliers(suppliers, { category, text }) {
  const t = String(text || '').toLowerCase();
  const score = (s) => (s.categories || []).filter((c) => c === category || t.includes(c)).length;
  return suppliers.filter((s) => s.is_active).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

function SupplierPicker({ suppliers, selected, setSelected, kind, setKind }) {
  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputCls} !w-auto`}>
        <option value="pedido">Pedido</option>
        <option value="solicitud_presupuesto">Pedir precio (comparar)</option>
      </select>
      <span className="text-xs text-slate-400">Proveedores:</span>
      {suppliers.length === 0 && <span className="text-xs text-slate-500">No hay proveedores: añádelos en la pestaña Proveedores.</span>}
      {suppliers.map((s) => (
        <button type="button" key={s.id} onClick={() => toggle(s.id)} title={s.email || 'Sin correo'}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${selected.includes(s.id) ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>
          {s.name}{!s.email && ' (sin correo)'}
        </button>
      ))}
    </div>
  );
}

// Comprueba antes de enviar: proveedores elegidos, con correo, y confirmación.
function confirmSend(suppliers, selected, showNotification) {
  const chosen = suppliers.filter((s) => selected.includes(s.id));
  if (chosen.length === 0) { showNotification('Elige al menos un proveedor.', 'error'); return false; }
  const withoutEmail = chosen.filter((s) => !s.email);
  if (withoutEmail.length) {
    showNotification(`Falta el correo de: ${withoutEmail.map((s) => s.name).join(', ')}. Añádelo en Proveedores o genera solo el borrador.`, 'error');
    return false;
  }
  return window.confirm(`¿Enviar el pedido por correo a ${chosen.map((s) => s.name).join(', ')}?`);
}

function reportSend(errors, send, showNotification) {
  if (errors?.length) showNotification(`Algún correo no se pudo enviar: ${errors[0]}`, 'error');
  else if (send) showNotification('Pedido enviado a los proveedores');
}

function NuevaNecesidad({ suppliers, onCreated, onCancel }) {
  const { obras = [] } = useApp() || {};
  const showNotification = useNotify();
  const [form, setForm] = useState({ obra_id: '', tajo: '', category: 'material', urgency: 'normal', description: '', needed_by: '', site_contact_name: '', site_contact_phone: '' });
  const [items, setItems] = useState([emptyItem()]);
  const [selected, setSelected] = useState([]);
  const [kind, setKind] = useState('pedido');
  const [busy, setBusy] = useState('');
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const orderable = ORDERABLE.includes(form.category);
  const sorted = useMemo(
    () => sortSuppliers(suppliers, { category: form.category, text: `${form.description} ${form.tajo} ${items.map((i) => i.material).join(' ')}` }),
    [suppliers, form.category, form.description, form.tajo, items]
  );

  // mode: 'save' solo guarda; 'draft' guarda y prepara los correos; 'send' guarda y los envía.
  const submit = async (e, mode = 'save') => {
    e?.preventDefault();
    if (!form.description.trim()) { showNotification('Describe qué hace falta.', 'error'); return; }
    if (mode === 'send' && !confirmSend(suppliers, selected, showNotification)) return;
    if (mode === 'draft' && selected.length === 0) { showNotification('Elige al menos un proveedor.', 'error'); return; }
    setBusy(mode);
    let need;
    try {
      need = await api('/api/needs', { method: 'POST', body: { ...form, items: form.category === 'material' ? items : [] } });
    } catch (err) {
      showNotification(err.message, 'error');
      setBusy('');
      return;
    }
    if (mode !== 'save' && orderable) {
      try {
        const { drafts, errors } = await api(`/api/needs/${need.id}/order-draft`, { method: 'POST', body: { supplier_ids: selected, kind, send: mode === 'send' } });
        reportSend(errors, mode === 'send', showNotification);
        const sent = drafts.some((d) => d.status === 'enviado');
        need = { ...need, status: sent ? 'pedido_tramitado' : 'en_revision' };
      } catch (err) {
        showNotification(`Necesidad guardada, pero el pedido falló: ${err.message}`, 'error');
      }
    }
    setBusy('');
    onCreated(need);
  };

  return (
    <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <h3 className="font-bold text-white">Nueva necesidad de obra</h3>
      <div className="grid sm:grid-cols-2 gap-2">
        <select value={form.obra_id} onChange={set('obra_id')} className={inputCls}>
          <option value="">Obra…</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{[o.codigo, o.titulo].filter(Boolean).join(' - ')}</option>)}
        </select>
        <input value={form.tajo} onChange={set('tajo')} placeholder="Tajo / zona (ej. Baño 1)" className={inputCls} />
        <select value={form.category} onChange={set('category')} className={inputCls}>
          {NEED_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={form.urgency} onChange={set('urgency')} className={inputCls}>
          <option value="normal">Normal</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
      <textarea value={form.description} onChange={set('description')} required rows={2} placeholder="Qué hace falta y para qué" className={inputCls} />
      {form.category === 'material' && <ItemsEditor items={items} setItems={setItems} />}
      <div className="grid sm:grid-cols-3 gap-2">
        <label className="text-xs text-slate-400 space-y-1"><span>Entregar antes de</span>
          <input type="date" value={form.needed_by} onChange={set('needed_by')} className={inputCls} /></label>
        <label className="text-xs text-slate-400 space-y-1"><span>Contacto en obra</span>
          <input value={form.site_contact_name} onChange={set('site_contact_name')} className={inputCls} /></label>
        <label className="text-xs text-slate-400 space-y-1"><span>Teléfono</span>
          <input value={form.site_contact_phone} onChange={set('site_contact_phone')} className={inputCls} /></label>
      </div>
      {orderable && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <p className="text-xs text-slate-400">Pedido al proveedor (opcional: también puedes hacerlo más tarde desde la ficha).</p>
          <SupplierPicker suppliers={sorted} selected={selected} setSelected={setSelected} kind={kind} setKind={setKind} />
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnGhost}>Cancelar</button>
        <button type="submit" disabled={Boolean(busy)} className={selected.length && orderable ? btnGhost : btnPrimary}>
          {busy === 'save' && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
        </button>
        {orderable && selected.length > 0 && (
          <>
            <button type="button" onClick={(e) => submit(e, 'draft')} disabled={Boolean(busy)} className={btnGhost}>
              {busy === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Guardar y revisar correo
            </button>
            <button type="button" onClick={(e) => submit(e, 'send')} disabled={Boolean(busy)} className={btnPrimary}>
              {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Guardar y enviar pedido
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function DetalleNecesidad({ need, suppliers, onBack, onNeedChange }) {
  const showNotification = useNotify();
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState([]);
  const [kind, setKind] = useState('pedido');
  const [items, setItems] = useState(need.items?.length ? need.items : [emptyItem()]);
  const [busy, setBusy] = useState('');
  const status = NEED_STATUS[need.status] || NEED_STATUS.nueva;

  useEffect(() => {
    api(`/api/material-orders?need=${need.id}`).then(setOrders).catch((e) => showNotification(e.message, 'error'));
  }, [need.id, showNotification]);

  const sortedSuppliers = useMemo(
    () => sortSuppliers(suppliers, { category: need.category, text: `${need.description} ${need.tajo || ''} ${(need.items || []).map((i) => i.material).join(' ')}` }),
    [suppliers, need]
  );

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

  const generate = (send = false) => {
    if (send && !confirmSend(suppliers, selected, showNotification)) return;
    run(send ? 'send' : 'draft', async () => {
      if (JSON.stringify(items) !== JSON.stringify(need.items || [])) {
        onNeedChange(await api(`/api/needs/${need.id}`, { method: 'PATCH', body: { items } }));
      }
      const { drafts, errors } = await api(`/api/needs/${need.id}/order-draft`, { method: 'POST', body: { supplier_ids: selected, kind, send } });
      reportSend(errors, send, showNotification);
      setOrders((prev) => [...drafts, ...prev]);
      if (drafts.some((d) => d.status === 'enviado')) onNeedChange({ ...need, items, status: 'pedido_tramitado' });
      else if (need.status === 'nueva') onNeedChange({ ...need, items, status: 'en_revision' });
      setSelected([]);
    });
  };

  const setStatus = (value) => run(value, async () => onNeedChange(await api(`/api/needs/${need.id}`, { method: 'PATCH', body: { status: value } })));

  const updateOrder = (updated) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    if (updated.status === 'enviado') onNeedChange({ ...need, status: 'pedido_tramitado' });
  };

  const supplierName = (id) => suppliers.find((s) => s.id === id)?.name;

  return (
    <div className="space-y-4">
      <BotonVolver onClick={onBack}>Volver a la lista</BotonVolver>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">{fmtDateTime(need.created_at)} · {categoryLabel(need.category)}{need.urgency === 'urgente' ? ' · URGENTE' : ''}</p>
            <h3 className="text-lg font-bold text-white">{need.obra_label || 'Sin obra'}{need.tajo ? ` · ${need.tajo}` : ''}</h3>
            <p className="text-sm text-slate-300 mt-1 whitespace-pre-line">{need.description}</p>
            <p className="text-xs text-slate-500 mt-1">
              {need.reported_by_name ? `Lo pide: ${need.reported_by_name} (${need.reported_by_type})` : ''}
            </p>
          </div>
          <span className={`text-[11px] font-bold border rounded-full px-2 py-0.5 ${status.cls}`}>{status.label}</span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-slate-400">
          {need.needed_by && <span className="flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Antes del {fmtDate(need.needed_by)}</span>}
          {need.site_contact_name && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {need.site_contact_name} {need.site_contact_phone}</span>}
        </div>
        {need.photo_urls?.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {need.photo_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto de obra" className="w-24 h-24 object-cover rounded-xl border border-slate-700" /></a>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {need.status === 'pedido_tramitado' && <button onClick={() => setStatus('entregado')} disabled={Boolean(busy)} className={btnGhost}>Marcar como entregado</button>}
          {need.category !== 'material' && !['resuelto', 'descartada'].includes(need.status) && <button onClick={() => setStatus('resuelto')} disabled={Boolean(busy)} className={btnGhost}>Marcar como resuelta</button>}
          {!['descartada', 'entregado', 'resuelto'].includes(need.status) && <button onClick={() => setStatus('descartada')} disabled={Boolean(busy)} className={btnGhost}>Descartar</button>}
        </div>
      </div>

      {ORDERABLE.includes(need.category) && !['descartada', 'entregado'].includes(need.status) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h4 className="font-bold text-white">Preparar pedido</h4>
          <ItemsEditor items={items} setItems={setItems} />
          <SupplierPicker suppliers={sortedSuppliers} selected={selected} setSelected={setSelected} kind={kind} setKind={setKind} />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => generate(false)} disabled={Boolean(busy) || selected.length === 0} className={btnGhost}>
              {busy === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Generar borrador{selected.length > 1 ? `es (${selected.length})` : ''}
            </button>
            <button onClick={() => generate(true)} disabled={Boolean(busy) || selected.length === 0} className={btnPrimary}>
              {busy === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar pedido ya
            </button>
          </div>
        </div>
      )}

      {orders.map((o) => (
        <PedidoBorrador key={o.id} order={o} supplierName={supplierName(o.supplier_id)} onChange={updateOrder} />
      ))}
    </div>
  );
}

export default function NecesidadesPanel({ focusId }) {
  const showNotification = useNotify();
  const [needs, setNeeds] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filter, setFilter] = useState('abiertas');
  const [openId, setOpenId] = useState(focusId || null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [n, s] = await Promise.all([api('/api/needs'), api('/api/suppliers')]);
      setNeeds(n);
      setSuppliers(s);
    } catch (e) {
      showNotification(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (focusId) setOpenId(focusId); }, [focusId]);

  const open = needs.find((n) => n.id === openId);
  if (open) {
    return (
      <DetalleNecesidad need={open} suppliers={suppliers} onBack={() => setOpenId(null)}
        onNeedChange={(u) => setNeeds((prev) => prev.map((n) => (n.id === u.id ? { ...n, ...u, photo_urls: n.photo_urls } : n)))} />
    );
  }

  const shown = needs.filter((n) => (filter === 'abiertas' ? ['nueva', 'en_revision', 'pedido_tramitado'].includes(n.status) : true));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {['abiertas', 'todas'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border capitalize ${filter === f ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-300'}`}>{f}</button>
        ))}
        <button onClick={() => setCreating(true)} className={`${btnPrimary} ml-auto`}><Plus className="w-4 h-4" /> Nueva necesidad</button>
      </div>

      {creating && (
        <NuevaNecesidad suppliers={suppliers} onCancel={() => setCreating(false)} onCreated={(need) => { setCreating(false); setNeeds((p) => [{ ...need, photo_urls: [] }, ...p]); setOpenId(need.id); }} />
      )}

      {loading ? (
        <div className="py-10 flex justify-center text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : shown.length === 0 ? (
        <p className="text-center py-10 text-sm text-slate-500">No hay necesidades {filter === 'abiertas' ? 'abiertas' : ''}.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((n) => {
            const st = NEED_STATUS[n.status] || NEED_STATUS.nueva;
            return (
              <li key={n.id}>
                <button onClick={() => setOpenId(n.id)} className="w-full text-left bg-slate-900 border border-slate-800 rounded-2xl p-3 hover:bg-slate-800/60 transition flex gap-3 items-start">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      {n.urgency === 'urgente' && <span className="text-[10px] font-black text-rose-400">URGENTE</span>}
                      <span className="text-sm font-bold text-white">{categoryLabel(n.category)} · {n.obra_label || 'Sin obra'}</span>
                    </span>
                    <span className="block text-xs text-slate-400 line-clamp-2">{n.description}</span>
                    <span className="block text-[11px] text-slate-500 mt-1">
                      {fmtDateTime(n.created_at)}{n.reported_by_name ? ` · ${n.reported_by_name}` : ''}{n.needed_by ? ` · antes del ${fmtDate(n.needed_by)}` : ''}
                    </span>
                  </span>
                  {n.photo_urls?.length > 0 && <ImageIcon className="w-4 h-4 text-slate-500 shrink-0" />}
                  <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 shrink-0 ${st.cls}`}>{st.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
