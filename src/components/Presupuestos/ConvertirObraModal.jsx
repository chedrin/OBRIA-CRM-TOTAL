import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { HardHat, X, CheckCircle2, AlertCircle, Calendar, MapPin, User, Hash, Euro } from 'lucide-react';
import ModalOverlay from '../Common/ModalOverlay';

const todayIso = () => new Date().toISOString().split('T')[0];
const addDaysIso = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// Siguiente código libre OBR-AAAA-NNN (no repite códigos existentes).
function nextObraCodigo(obras) {
  const year = new Date().getFullYear();
  const prefix = `OBR-${year}-`;
  const used = new Set((obras || []).map(o => (o.codigo || '').toUpperCase()));
  const max = (obras || []).reduce((m, o) => {
    const match = String(o.codigo || '').match(new RegExp(`^OBR-${year}-(\\d+)$`, 'i'));
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  let n = max + 1;
  while (used.has(`${prefix}${String(n).padStart(3, '0')}`)) n += 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
}

// Paso de confirmación al pasar un presupuesto aceptado a obra activa:
// se revisan y editan los datos principales antes de crear la obra.
export default function ConvertirObraModal({ presupuesto, onClose, onConfirm }) {
  const { obras = [], obreros = [], employees = [], users = [], currentUser } = useApp();
  const firstFieldRef = useRef(null);

  const responsables = useMemo(() => {
    const seen = new Set();
    const list = [];
    const add = (nombre) => {
      const clean = (nombre || '').trim();
      if (!clean || seen.has(clean.toLowerCase())) return;
      seen.add(clean.toLowerCase());
      list.push(clean);
    };
    add(currentUser?.fullName);
    (users || []).filter(u => u.isActive !== false && u.role !== 'obrero').forEach(u => add(u.fullName || u.username));
    (employees || []).filter(e => e.estado !== 'baja').forEach(e => add(`${e.nombre || ''} ${e.apellidos || ''}`));
    (obreros || []).filter(o => o.estado !== 'baja').forEach(o => add(o.nombre));
    return list;
  }, [obras, obreros, employees, users, currentUser]);

  const [form, setForm] = useState(() => {
    const inicio = todayIso();
    return {
      titulo: presupuesto.obraTitulo || `Obra ${presupuesto.cliente || ''}`.trim(),
      codigo: nextObraCodigo(obras),
      fechaInicio: inicio,
      fechaFinEstimada: addDaysIso(inicio, 60),
      direccion: presupuesto.direccion || '',
      responsable: currentUser?.fullName || '',
      presupuestoTotal: Number(presupuesto.totalConIva || presupuesto.baseImponible || 0)
    };
  });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const errors = {};
  if (!form.titulo.trim()) errors.titulo = 'Pon un nombre a la obra.';
  const codigo = form.codigo.trim().toUpperCase();
  if (!codigo) errors.codigo = 'El código de proyecto es obligatorio.';
  else if (obras.some(o => (o.codigo || '').toUpperCase() === codigo)) errors.codigo = 'Ya existe una obra con este código.';
  if (!form.fechaInicio) errors.fechaInicio = 'Indica la fecha de inicio.';
  if (!form.fechaFinEstimada) errors.fechaFinEstimada = 'Indica la fecha de fin estimada.';
  else if (form.fechaInicio && form.fechaFinEstimada < form.fechaInicio) errors.fechaFinEstimada = 'El fin no puede ser anterior al inicio.';
  if (form.direccion.trim().length < 5) errors.direccion = 'Escribe la dirección exacta de la obra.';
  if (!form.responsable.trim()) errors.responsable = 'Asigna un responsable.';
  if (!(Number(form.presupuestoTotal) > 0)) errors.presupuestoTotal = 'El importe debe ser mayor que 0.';
  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    onConfirm({
      titulo: form.titulo.trim(),
      codigo,
      fechaInicio: form.fechaInicio,
      fechaFinEstimada: form.fechaFinEstimada,
      fechaEntregaCliente: form.fechaFinEstimada,
      direccion: form.direccion.trim(),
      responsable: form.responsable.trim(),
      presupuestoTotal: Number(Number(form.presupuestoTotal).toFixed(2))
    });
  };

  const fieldClass = (name) =>
    `w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 transition ${
      touched && errors[name] ? 'border-rose-500 focus:ring-rose-500/30' : 'border-slate-700 focus:border-indigo-400 focus:ring-indigo-500/20'
    }`;

  const FieldError = ({ name }) => (touched && errors[name]
    ? <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors[name]}</p>
    : null);

  return (
    <ModalOverlay
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl my-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="convertir-obra-title"
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <HardHat className="w-5 h-5" />
            </span>
            <div>
              <h3 id="convertir-obra-title" className="text-base font-bold text-white">Convertir en obra activa</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Presupuesto <span className="font-mono text-amber-400">{presupuesto.numero}</span> · {presupuesto.cliente}. Revisa los datos antes de crear la obra.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="sm:col-span-2">
            <label className="text-slate-400 font-semibold block mb-1">Nombre de la obra *</label>
            <input ref={firstFieldRef} value={form.titulo} onChange={(e) => set('titulo', e.target.value)} className={fieldClass('titulo')} />
            <FieldError name="titulo" />
          </div>

          <div>
            <label className="text-slate-400 font-semibold mb-1 flex items-center gap-1"><Hash className="w-3 h-3" />Código de proyecto *</label>
            <input value={form.codigo} onChange={(e) => set('codigo', e.target.value)} className={`${fieldClass('codigo')} font-mono uppercase`} />
            <FieldError name="codigo" />
          </div>

          <div>
            <label className="text-slate-400 font-semibold mb-1 flex items-center gap-1"><User className="w-3 h-3" />Responsable asignado *</label>
            <input
              list="convertir-obra-responsables"
              value={form.responsable}
              onChange={(e) => set('responsable', e.target.value)}
              placeholder="Jefe de obra o encargado"
              className={fieldClass('responsable')}
            />
            <datalist id="convertir-obra-responsables">
              {responsables.map(n => <option key={n} value={n} />)}
            </datalist>
            <FieldError name="responsable" />
          </div>

          <div>
            <label className="text-slate-400 font-semibold mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />Inicio estimado *</label>
            <input type="date" value={form.fechaInicio} onChange={(e) => set('fechaInicio', e.target.value)} className={fieldClass('fechaInicio')} />
            <FieldError name="fechaInicio" />
          </div>

          <div>
            <label className="text-slate-400 font-semibold mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />Fin estimado *</label>
            <input type="date" value={form.fechaFinEstimada} min={form.fechaInicio} onChange={(e) => set('fechaFinEstimada', e.target.value)} className={fieldClass('fechaFinEstimada')} />
            <FieldError name="fechaFinEstimada" />
          </div>

          <div className="sm:col-span-2">
            <label className="text-slate-400 font-semibold mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />Dirección exacta de la obra *</label>
            <input
              value={form.direccion}
              onChange={(e) => set('direccion', e.target.value)}
              placeholder="Calle, número, piso, código postal y localidad"
              className={fieldClass('direccion')}
            />
            <FieldError name="direccion" />
          </div>

          <div className="sm:col-span-2">
            <label className="text-slate-400 font-semibold mb-1 flex items-center gap-1"><Euro className="w-3 h-3" />Presupuesto base de adjudicación (IVA incluido) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.presupuestoTotal}
              onChange={(e) => set('presupuestoTotal', e.target.value)}
              className={`${fieldClass('presupuestoTotal')} font-mono`}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Del presupuesto: base {Number(presupuesto.baseImponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} € · total {Number(presupuesto.totalConIva || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
            </p>
            <FieldError name="presupuestoTotal" />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 p-5 border-t border-slate-800 bg-slate-950/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition">
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirmar y crear obra
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
