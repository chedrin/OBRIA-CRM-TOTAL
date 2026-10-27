import React, { useState } from 'react';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';

// Botón "Pedir material / avisar" del Portal del Obrero: crea una necesidad de obra
// y el jefe de obra recibe el aviso al instante (panel y notificación push).

const CATEGORIES = [
  { value: 'material', label: 'Falta material' },
  { value: 'herramienta', label: 'Falta herramienta' },
  { value: 'maquinaria', label: 'Avería de maquinaria' },
  { value: 'bloqueo', label: 'Tajo bloqueado' },
  { value: 'seguridad', label: 'Aviso de seguridad' },
  { value: 'otro', label: 'Otra incidencia' }
];

const field = 'w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500';

export default function PedirMaterialModal({ isOpen, onClose, obra, onSent }) {
  const [category, setCategory] = useState('material');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState([{ material: '', cantidad: '', unidad: '' }]);
  const [neededBy, setNeededBy] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const updateItem = (i, key, value) => setItems(items.map((it, j) => (j === i ? { ...it, [key]: value } : it)));

  const submit = async (e) => {
    e.preventDefault();
    const lines = items.filter((it) => it.material.trim());
    const text = description.trim() || lines.map((it) => `${it.cantidad} ${it.unidad} ${it.material}`.trim()).join(', ');
    if (!text) {
      setError('Escribe qué hace falta.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/needs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          obra_id: obra?.id || null,
          obra_label: obra ? [obra.codigo, obra.titulo].filter(Boolean).join(' - ') : '',
          category,
          description: text,
          items: category === 'material' ? lines : [],
          needed_by: neededBy || null,
          urgency: urgent ? 'urgente' : 'normal'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar. Inténtalo otra vez.');
      setDescription('');
      setItems([{ material: '', cantidad: '', unidad: '' }]);
      setNeededBy('');
      setUrgent(false);
      onSent?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
      <form onSubmit={submit} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-black text-white">Pedir material o avisar</h3>
          <button type="button" onClick={onClose} className="text-slate-400" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        {obra && <p className="text-xs text-slate-400">{[obra.codigo, obra.titulo].filter(Boolean).join(' - ')}</p>}

        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button type="button" key={c.value} onClick={() => setCategory(c.value)}
              className={`rounded-xl px-2 py-2.5 text-xs font-bold border ${category === c.value ? 'bg-amber-500 text-slate-950 border-amber-500' : 'border-slate-700 text-slate-200'}`}>
              {c.label}
            </button>
          ))}
        </div>

        {category === 'material' && (
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_72px_auto] gap-1.5">
                <input value={it.material} onChange={(e) => updateItem(i, 'material', e.target.value)} placeholder="Material" className={field} />
                <input value={it.cantidad} onChange={(e) => updateItem(i, 'cantidad', e.target.value)} placeholder="Cant." inputMode="decimal" className={field} />
                <input value={it.unidad} onChange={(e) => updateItem(i, 'unidad', e.target.value)} placeholder="Ud." className={field} />
                <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-slate-500" aria-label="Quitar"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, { material: '', cantidad: '', unidad: '' }])} className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Otro material
            </button>
          </div>
        )}

        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          placeholder={category === 'material' ? 'Notas (opcional)' : '¿Qué pasa?'} className={field} />

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 flex-1">Lo necesito antes de
            <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={`${field} mt-1`} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-white mt-4">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="w-5 h-5 accent-rose-500" /> Urgente
          </label>
        </div>

        {error && <p className="text-sm text-rose-400 font-semibold">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-amber-500 text-slate-950 font-black py-3 flex items-center justify-center gap-2 disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enviar a la oficina
        </button>
      </form>
    </div>
  );
}
