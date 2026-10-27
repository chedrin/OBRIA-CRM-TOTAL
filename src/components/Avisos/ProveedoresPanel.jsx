import React, { useEffect, useState } from 'react';
import { Plus, Loader2, Mail, Phone } from 'lucide-react';
import useNotify from './useNotify';
import { api, inputCls, btnPrimary, btnGhost } from '../../services/avisosApi';

const EMPTY = { name: '', email: '', phone: '', contact_name: '', categories: '', notes: '' };

export default function ProveedoresPanel() {
  const showNotification = useNotify();
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(null); // null | { ...campos, id? }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/suppliers').then(setSuppliers).catch((e) => showNotification(e.message, 'error'));
  }, [showNotification]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, categories: String(form.categories || '').split(',').map((c) => c.trim()).filter(Boolean) };
      const saved = form.id
        ? await api(`/api/suppliers/${form.id}`, { method: 'PATCH', body })
        : await api('/api/suppliers', { method: 'POST', body });
      setSuppliers((prev) => (form.id ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved]).sort((a, b) => a.name.localeCompare(b.name)));
      setForm(null);
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (s) => {
    try {
      const saved = await api(`/api/suppliers/${s.id}`, { method: 'PATCH', body: { is_active: !s.is_active } });
      setSuppliers((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
    } catch (err) {
      showNotification(err.message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <p className="text-sm text-slate-400">Las categorías (fontanería, electricidad, áridos…) sirven para proponer el proveedor habitual de cada pedido.</p>
        {!form && <button onClick={() => setForm(EMPTY)} className={btnPrimary}><Plus className="w-4 h-4" /> Nuevo proveedor</button>}
      </div>

      {form && (
        <form onSubmit={save} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid sm:grid-cols-2 gap-2">
          <input value={form.name} onChange={set('name')} required placeholder="Nombre" className={inputCls} />
          <input value={form.contact_name || ''} onChange={set('contact_name')} placeholder="Persona de contacto" className={inputCls} />
          <input type="email" value={form.email || ''} onChange={set('email')} placeholder="Correo para pedidos" className={inputCls} />
          <input value={form.phone || ''} onChange={set('phone')} placeholder="Teléfono" className={inputCls} />
          <input value={form.categories} onChange={set('categories')} placeholder="Categorías separadas por comas" className={`${inputCls} sm:col-span-2`} />
          <textarea value={form.notes || ''} onChange={set('notes')} rows={2} placeholder="Notas (condiciones, horario de reparto…)" className={`${inputCls} sm:col-span-2`} />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className={btnGhost}>Cancelar</button>
            <button type="submit" disabled={busy} className={btnPrimary}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
          </div>
        </form>
      )}

      {suppliers.length === 0 && !form ? (
        <p className="text-center py-10 text-sm text-slate-500">Aún no hay proveedores.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {suppliers.map((s) => (
            <li key={s.id} className={`bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1 ${s.is_active ? '' : 'opacity-60'}`}>
              <div className="flex justify-between gap-2">
                <span className="font-bold text-white">{s.name}</span>
                <span className="flex gap-2 text-xs">
                  <button onClick={() => setForm({ ...s, categories: (s.categories || []).join(', ') })} className="text-amber-400 font-bold">Editar</button>
                  <button onClick={() => toggleActive(s)} className="text-slate-400">{s.is_active ? 'Desactivar' : 'Activar'}</button>
                </span>
              </div>
              {s.contact_name && <p className="text-xs text-slate-400">{s.contact_name}</p>}
              <p className="text-xs text-slate-400 flex flex-wrap gap-3">
                {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
              </p>
              {s.categories?.length > 0 && (
                <div className="flex flex-wrap gap-1">{s.categories.map((c) => <span key={c} className="text-[10px] bg-slate-800 text-slate-300 rounded px-1.5 py-0.5">{c}</span>)}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
