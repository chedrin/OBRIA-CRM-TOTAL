import React, { useState } from 'react';
import { Building2, Trash2 } from 'lucide-react';
import ModalOverlay from '../Common/ModalOverlay';

const field = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white';

const EMPTY = {
  razonSocial: '',
  nombreComercial: '',
  cif: '',
  gremio: '',
  personaContacto: '',
  telefono: '',
  telefonoUrgencias: '',
  email: '',
  direccion: '',
  numeroREA: '',
  iban: '',
  formaPago: '',
  observaciones: '',
  seguroRCCompania: '',
  seguroRCPoliza: '',
  seguroRCSuma: 300000,
  seguroRCFechaCaducidad: '',
  bloqueado: false
};

const fromSub = (sub) => ({
  ...EMPTY,
  ...Object.fromEntries(Object.keys(EMPTY).filter((k) => sub[k] !== undefined && sub[k] !== null).map((k) => [k, sub[k]])),
  seguroRCCompania: sub.prl?.seguroRCCompania || '',
  seguroRCPoliza: sub.prl?.seguroRCPoliza || '',
  seguroRCSuma: sub.prl?.seguroRCSuma ?? 300000,
  seguroRCFechaCaducidad: sub.prl?.seguroRCFechaCaducidad || '',
  bloqueado: sub.prl?.bloqueoManual === true
});

/**
 * Alta o edición completa de la ficha de una subcontrata.
 * onSave(datos) recibe la ficha lista para addSubcontractor / updateSubcontractor.
 */
export default function FichaSubcontrataForm({ subcontractor = null, onSave, onDelete, onClose }) {
  const editing = Boolean(subcontractor);
  const [form, setForm] = useState(() => (editing ? fromSub(subcontractor) : EMPTY));
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.razonSocial.trim() || !form.cif.trim()) { setError('Razón social y CIF son obligatorios.'); return; }
    const expiry = form.seguroRCFechaCaducidad ? new Date(form.seguroRCFechaCaducidad) : null;
    const seguroVigente = !expiry || expiry > new Date();
    const { seguroRCCompania, seguroRCPoliza, seguroRCSuma, seguroRCFechaCaducidad, bloqueado, ...datos } = form;
    onSave({
      ...datos,
      razonSocial: datos.razonSocial.trim(),
      nombreComercial: datos.nombreComercial.trim() || datos.razonSocial.trim(),
      cif: datos.cif.trim().toUpperCase(),
      gremio: datos.gremio.trim() || 'Instalaciones',
      telefonoUrgencias: datos.telefonoUrgencias || datos.telefono,
      iban: datos.iban.replace(/\s+/g, ' ').trim().toUpperCase(),
      prl: {
        ...(subcontractor?.prl || {}),
        seguroRCCompania,
        seguroRCPoliza,
        seguroRCSuma: Number(seguroRCSuma) || 0,
        seguroRCFechaCaducidad,
        bloqueoManual: bloqueado,
        aptoEntrarObra: !bloqueado && seguroVigente
      }
    });
  };

  return (
    <ModalOverlay className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <span>{editing ? `Editar ficha de ${subcontractor.razonSocial}` : 'Alta de empresa subcontratista'}</span>
          </h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={submit} className="space-y-4 text-xs">
          <div>
            <span className="text-[11px] font-black uppercase text-indigo-400 block mb-2">1. Datos fiscales y contacto</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-slate-400">Razón social *<input required value={form.razonSocial} onChange={set('razonSocial')} placeholder="Ej: ElectroSur Instalaciones SL" className={`${field} mt-1`} /></label>
              <label className="text-slate-400">Nombre comercial<input value={form.nombreComercial} onChange={set('nombreComercial')} placeholder="Si es distinto de la razón social" className={`${field} mt-1`} /></label>
              <label className="text-slate-400">CIF / NIF *<input required value={form.cif} onChange={set('cif')} placeholder="B84561234" className={`${field} mt-1 font-mono`} /></label>
              <label className="text-slate-400">Gremio / especialidad<input value={form.gremio} onChange={set('gremio')} placeholder="Ej: Electricidad y Climatización" className={`${field} mt-1`} /></label>
              <label className="text-slate-400">Persona de contacto<input value={form.personaContacto} onChange={set('personaContacto')} className={`${field} mt-1`} /></label>
              <label className="text-slate-400">Correo electrónico<input type="email" value={form.email} onChange={set('email')} className={`${field} mt-1`} /></label>
              <label className="text-slate-400">Teléfono<input value={form.telefono} onChange={set('telefono')} className={`${field} mt-1`} /></label>
              <label className="text-slate-400">Teléfono de urgencias en obra<input value={form.telefonoUrgencias} onChange={set('telefonoUrgencias')} className={`${field} mt-1 font-bold`} /></label>
              <label className="text-slate-400 sm:col-span-2">Dirección<input value={form.direccion} onChange={set('direccion')} className={`${field} mt-1`} /></label>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] font-black uppercase text-sky-400 block mb-2">2. Administración</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-slate-400">Nº de inscripción en el REA<input value={form.numeroREA} onChange={set('numeroREA')} className={`${field} mt-1 font-mono`} /></label>
              <label className="text-slate-400">Forma de pago<input value={form.formaPago} onChange={set('formaPago')} placeholder="Ej: transferencia a 30 días" className={`${field} mt-1`} /></label>
              <label className="text-slate-400 sm:col-span-2">IBAN para pagos<input value={form.iban} onChange={set('iban')} placeholder="ES00 0000 0000 0000 0000 0000" className={`${field} mt-1 font-mono`} /></label>
              <label className="text-slate-400 sm:col-span-2">Observaciones<textarea rows={2} value={form.observaciones} onChange={set('observaciones')} className={`${field} mt-1`} /></label>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] font-black uppercase text-amber-400 block mb-2">3. Seguro de responsabilidad civil (Ley 32/2006)</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-slate-400">Aseguradora<input value={form.seguroRCCompania} onChange={set('seguroRCCompania')} className={`${field} mt-1`} /></label>
              <label className="text-slate-400">Nº de póliza<input value={form.seguroRCPoliza} onChange={set('seguroRCPoliza')} className={`${field} mt-1 font-mono`} /></label>
              <label className="text-slate-400">Suma asegurada (€)<input type="number" min="0" value={form.seguroRCSuma} onChange={set('seguroRCSuma')} className={`${field} mt-1 font-mono`} /></label>
              <label className="text-slate-400">Caducidad de la póliza<input type="date" value={form.seguroRCFechaCaducidad} onChange={set('seguroRCFechaCaducidad')} className={`${field} mt-1 font-mono`} /></label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={form.bloqueado} onChange={set('bloqueado')} className="accent-rose-500" />
              Bloquear la entrada a obra aunque tenga la documentación (por incidencias, impagos…)
            </label>
          </div>

          {error && <p className="text-rose-400 font-semibold">{error}</p>}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
            {editing && onDelete ? (
              <button type="button" onClick={onDelete} className="px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl font-bold flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Eliminar subcontrata
              </button>
            ) : <span />}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition">Cancelar</button>
              <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition shadow-lg shadow-indigo-600/30">
                {editing ? 'Guardar cambios' : 'Guardar subcontrata'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
