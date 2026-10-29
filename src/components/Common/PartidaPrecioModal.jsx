import React, { useMemo, useState } from 'react';
import AiImprovementControl from './AiImprovementControl';

// Formulario único para dar de alta o editar una partida de un catálogo de precios unitarios
// (base de precios de la empresa o catálogo propio de una obra). Todos los campos son editables.

const UNIDADES_COMUNES = ['ud', 'm²', 'm³', 'ml', 'm', 'kg', 'h', 'pa', 'l', 't', 'mes', 'día'];
const GREMIOS_COMUNES = ['Albañilería', 'Fontanería', 'Electricidad', 'Pintura', 'Carpintería', 'Climatización', 'Cerrajería', 'Demoliciones'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pvpDesde = (coste, margen) => round2((Number(coste) || 0) * (1 + (Number(margen) || 0) / 100));

export const PARTIDA_VACIA = {
  codigo: '',
  capitulo: 'Albañilería',
  gremio: 'Albañilería',
  concepto: '',
  unidad: 'm²',
  costeSubcontrata: 15,
  margenPct: 30,
  precioVenta: 19.5
};

// Normaliza los números y recalcula lo que falte antes de guardar.
export function normalizarPartida(form) {
  const coste = round2(form.costeSubcontrata);
  const margen = round2(form.margenPct);
  const pvp = form.precioVenta === '' || form.precioVenta === null || form.precioVenta === undefined
    ? pvpDesde(coste, margen)
    : round2(form.precioVenta);
  return {
    ...form,
    codigo: String(form.codigo || '').trim(),
    capitulo: String(form.capitulo || '').trim() || String(form.gremio || '').trim() || 'General',
    gremio: String(form.gremio || '').trim() || 'General',
    concepto: String(form.concepto || '').trim(),
    unidad: String(form.unidad || '').trim() || 'ud',
    costeSubcontrata: coste,
    margenPct: margen,
    precioVenta: pvp
  };
}

export default function PartidaPrecioModal({
  initial,
  isEditing = false,
  title,
  catalogo = [],
  onSave,
  onClose
}) {
  const [form, setForm] = useState(() => ({ ...PARTIDA_VACIA, ...(initial || {}) }));
  const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

  const gremios = useMemo(
    () => [...new Set([...GREMIOS_COMUNES, ...catalogo.map(bp => bp.gremio).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es')),
    [catalogo]
  );
  const capitulos = useMemo(
    () => [...new Set([...gremios, ...catalogo.map(bp => bp.capitulo).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'es')),
    [catalogo, gremios]
  );
  const unidades = useMemo(
    () => [...new Set([...UNIDADES_COMUNES, ...catalogo.map(bp => bp.unidad).filter(Boolean)])],
    [catalogo]
  );

  const codigoNormalizado = String(form.codigo || '').trim().toLowerCase();
  const codigoRepetido = codigoNormalizado !== '' && catalogo.some(
    bp => bp.id !== initial?.id && String(bp.codigo || '').trim().toLowerCase() === codigoNormalizado
  );

  const handleCoste = (value) => set({ costeSubcontrata: value, precioVenta: pvpDesde(value, form.margenPct) });
  const handleMargen = (value) => set({ margenPct: value, precioVenta: pvpDesde(form.costeSubcontrata, value) });
  // Al fijar el PVP a mano, el margen se ajusta para que cuadre con el coste.
  const handlePvp = (value) => {
    const coste = Number(form.costeSubcontrata) || 0;
    const patch = { precioVenta: value };
    if (coste > 0 && value !== '') patch.margenPct = round2(((Number(value) || 0) / coste - 1) * 100);
    set(patch);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(form.codigo || '').trim() || !String(form.concepto || '').trim()) return;
    onSave(normalizarPartida(form));
  };

  const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-400';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {title || (isEditing ? 'Editar partida de precios' : 'Nueva partida de precios')}
          </h3>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Código *</label>
              <input
                type="text"
                required
                placeholder="ALB-05"
                value={form.codigo}
                onChange={(e) => set({ codigo: e.target.value.toUpperCase() })}
                className={`${inputClass} font-mono`}
              />
              {codigoRepetido && (
                <span className="text-[11px] text-amber-400 block mt-1">Ya hay otra partida con este código en el catálogo.</span>
              )}
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Unidad *</label>
              <input
                type="text"
                required
                list="partida-unidades"
                placeholder="m², ud, ml..."
                value={form.unidad}
                onChange={(e) => set({ unidad: e.target.value })}
                className={inputClass}
              />
              <datalist id="partida-unidades">
                {unidades.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Capítulo</label>
              <input
                type="text"
                list="partida-capitulos"
                placeholder="Ej: Demoliciones"
                value={form.capitulo}
                onChange={(e) => set({ capitulo: e.target.value })}
                className={inputClass}
              />
              <datalist id="partida-capitulos">
                {capitulos.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Gremio</label>
              <input
                type="text"
                list="partida-gremios"
                placeholder="Ej: Fontanería"
                value={form.gremio}
                onChange={(e) => set({ gremio: e.target.value })}
                className={inputClass}
              />
              <datalist id="partida-gremios">
                {gremios.map(g => <option key={g} value={g} />)}
              </datalist>
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Concepto / descripción de la partida *</label>
            <textarea
              rows="4"
              required
              placeholder="Descripción detallada de la ejecución..."
              value={form.concepto}
              onChange={(e) => set({ concepto: e.target.value })}
              className={inputClass}
            ></textarea>
            <div className="mt-2">
              <AiImprovementControl
                value={form.concepto}
                onAccept={(improved) => set({ concepto: improved })}
                context="Descripción de partida de presupuesto"
                buttonLabel="Mejorar Partida con IA"
                buttonSize="small"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="text-slate-400 block mb-1 text-[11px]">Coste subcontrata (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.costeSubcontrata}
                onChange={(e) => handleCoste(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-amber-400 block mb-1 text-[11px] font-bold">Margen (%) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={form.margenPct}
                onChange={(e) => handleMargen(e.target.value)}
                className="w-full bg-slate-800 border border-amber-500/50 rounded-xl p-2 text-amber-300 font-bold font-mono"
              />
            </div>
            <div>
              <label className="text-emerald-400 block mb-1 text-[11px] font-bold">PVP cliente (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.precioVenta}
                onChange={(e) => handlePvp(e.target.value)}
                className="w-full bg-slate-800 border border-emerald-500/50 rounded-xl p-2 text-emerald-300 font-mono font-bold"
              />
            </div>
            <p className="sm:col-span-3 text-[11px] text-slate-500">
              El PVP se recalcula al cambiar coste o margen. Si escribes el PVP a mano, se ajusta el margen.
            </p>
          </div>

          {form.fuente?.subcontrata && (
            <p className="text-[11px] text-slate-500">
              Precio actualizado desde el presupuesto de {form.fuente.subcontrata}
              {form.fuente.fecha ? ` (${form.fuente.fecha})` : ''}.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl">
              {isEditing ? 'Guardar cambios' : 'Añadir al catálogo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
