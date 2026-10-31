import React, { useMemo, useState } from 'react';
import { Save, Wand2 } from 'lucide-react';
import { calcularNomina, salarioBaseParaNeto, TIPOS_CONTRATO, SITUACIONES_FAMILIARES, PARAMETROS_NOMINA, calcularTrienios } from '../../utils/nomina';
import { eur } from './NominaDesglose';

// type: text | number | date | select | check. auto: vacío = se calcula solo (se guarda null)
const SECCIONES = [
  {
    titulo: '1. Datos personales y banco',
    campos: [
      { key: 'nombre', label: 'Nombre' },
      { key: 'apellidos', label: 'Apellidos' },
      { key: 'dni', label: 'DNI / NIE' },
      { key: 'naf', label: 'Nº afiliación Seguridad Social' },
      { key: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date' },
      { key: 'telefono', label: 'Teléfono' },
      { key: 'email', label: 'Correo electrónico' },
      { key: 'direccion', label: 'Domicilio', wide: true },
      { key: 'iban', label: 'IBAN para la nómina', wide: true },
      { key: 'foto', label: 'Foto (dirección web)', wide: true }
    ]
  },
  {
    titulo: '2. Puesto y contrato',
    campos: [
      { key: 'categoria', label: 'Categoría' },
      { key: 'especialidad', label: 'Especialidad' },
      { key: 'convenio', label: 'Convenio', wide: true },
      { key: 'tipoContrato', label: 'Tipo de contrato', type: 'select', options: TIPOS_CONTRATO },
      { key: 'jornadaHorasSemana', label: 'Jornada (horas/semana)', type: 'number', step: 0.5 },
      { key: 'fechaAlta', label: 'Fecha de alta', type: 'date' },
      { key: 'horasOrdinarias', label: 'Horas ordinarias al mes', type: 'number', step: 1 }
    ]
  },
  {
    titulo: '3. Sueldo',
    campos: [
      { key: 'salarioBaseMensual', label: 'Salario base mensual (€)', type: 'number', step: 10 },
      { key: 'plusConvenio', label: 'Plus convenio (€/mes)', type: 'number', step: 5 },
      { key: 'otrosPlusesSalariales', label: 'Otros pluses (€/mes)', type: 'number', step: 5 },
      { key: 'dietasExentas', label: 'Dietas y desplazamientos exentos (€/mes)', type: 'number', step: 5 },
      { key: 'precioHoraExtra', label: 'Precio hora extra (€/h)', type: 'number', step: 0.5 },
      { key: 'importeTrienio', label: 'Importe de cada trienio (€/mes)', type: 'number', step: 1 },
      { key: 'trieniosManual', label: 'Nº de trienios', type: 'number', step: 1, auto: true, hint: 'Vacío: se calculan con la fecha de alta' },
      {
        key: 'numPagasExtra', label: 'Pagas extra al año', type: 'select', numeric: true,
        options: [{ value: 0, label: 'Ninguna (12 pagas)' }, { value: 2, label: '2 (junio y diciembre)' }, { value: 3, label: '3 (marzo, junio y diciembre)' }]
      },
      { key: 'pagasProrrateadas', label: 'Pagas extra prorrateadas en cada mes', type: 'check' },
      { key: 'importePagaExtra', label: 'Importe de cada paga extra (€)', type: 'number', step: 10, auto: true, hint: 'Vacío: salario base + antigüedad' }
    ]
  },
  {
    titulo: '4. IRPF (datos del Modelo 145)',
    campos: [
      { key: 'situacionFamiliar', label: 'Situación familiar', type: 'select', options: SITUACIONES_FAMILIARES, wide: true },
      { key: 'conyugeSinRentas', label: 'Cónyuge a cargo (gana menos de 1.500 €/año)', type: 'check', wide: true },
      { key: 'hijosACargo', label: 'Hijos a cargo (menores de 25)', type: 'number', step: 1 },
      { key: 'hijosMenores3', label: 'De ellos, menores de 3 años', type: 'number', step: 1 },
      { key: 'hijosComputoMitad', label: 'Los hijos se reparten con el otro progenitor', type: 'check' },
      { key: 'dependientesACargo', label: 'Ascendientes mayores de 65 a cargo', type: 'number', step: 1 },
      { key: 'ascendientesMayores75', label: 'De ellos, mayores de 75', type: 'number', step: 1 },
      { key: 'discapacidadPct', label: 'Discapacidad del trabajador (%)', type: 'number', step: 1 },
      {
        key: 'irpfModo', label: 'Retención IRPF', type: 'select',
        options: [{ value: 'auto', label: 'Calcularla automáticamente' }, { value: 'manual', label: 'Ponerla a mano' }]
      },
      { key: 'irpfPct', label: 'IRPF a mano (%)', type: 'number', step: 0.5, soloSi: (d) => d.irpfModo === 'manual' }
    ]
  },
  {
    titulo: '5. Seguridad Social y bajas',
    campos: [
      { key: 'atEpPct', label: 'Tipo accidentes AT/EP (%)', type: 'number', step: 0.05, auto: true, hint: `Vacío: ${PARAMETROS_NOMINA.empresa.atEpConstruccion} % (construcción)` },
      { key: 'baseMinimaCotizacion', label: 'Base mínima de su grupo (€/mes)', type: 'number', step: 10, auto: true, hint: `Vacío: ${PARAMETROS_NOMINA.baseMinimaMensual} € (grupos 4 a 11)` },
      { key: 'itComplementoPct', label: 'En baja, la empresa completa hasta (% del sueldo)', type: 'number', step: 5, hint: '0 si el convenio no lo obliga' }
    ]
  },
  {
    titulo: '6. Vacaciones',
    campos: [
      { key: 'vacacionesAnualesTotal', label: 'Días de vacaciones al año', type: 'number', step: 1 },
      { key: 'vacacionesConsumidas', label: 'Días ya disfrutados', type: 'number', step: 1 }
    ]
  }
];

const CAMPOS = SECCIONES.flatMap((s) => s.campos);

const valorInicial = (emp, c) => {
  const v = emp[c.key];
  if (c.type === 'check') return !!v;
  if (c.key === 'irpfModo') return v || 'auto';
  if (c.key === 'numPagasExtra') return v ?? 2;
  if (c.key === 'vacacionesAnualesTotal') return v ?? 30;
  if (v === null || v === undefined) return '';
  return v;
};

/** Convierte el borrador del formulario en los cambios a guardar en la ficha. */
const aFicha = (draft) => {
  const out = {};
  for (const c of CAMPOS) {
    const v = draft[c.key];
    if (c.type === 'check') out[c.key] = !!v;
    else if (c.type === 'number' || c.numeric) {
      if (v === '' || v === null || v === undefined) out[c.key] = c.auto ? null : 0;
      else out[c.key] = Number(String(v).replace(',', '.')) || 0;
    } else out[c.key] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
};

const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white';

export default function FichaEmpleadoEditor({ emp, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(CAMPOS.map((c) => [c.key, valorInicial(emp, c)])));
  const [neto, setNeto] = useState('');
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const fichaPrevia = useMemo(() => ({ ...emp, ...aFicha(draft) }), [emp, draft]);
  const p = useMemo(() => calcularNomina(fichaPrevia, { mes: 1 }), [fichaPrevia]);
  const trieniosAuto = calcularTrienios({ ...fichaPrevia, trieniosManual: null });

  const ajustarANeto = () => {
    const sb = salarioBaseParaNeto(fichaPrevia, neto);
    if (sb > 0) set('salarioBaseMensual', sb);
  };

  const submit = (e) => {
    e.preventDefault();
    const cambios = aFicha(draft);
    if (!cambios.nombre) return;
    onSave(cambios);
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-xs">
      {SECCIONES.map((s) => (
        <fieldset key={s.titulo} className="space-y-2">
          <legend className="text-[11px] font-black uppercase text-amber-400 tracking-wider mb-1">{s.titulo}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {s.campos.filter((c) => !c.soloSi || c.soloSi(draft)).map((c) => {
              const id = `ficha-${c.key}`;
              if (c.type === 'check') {
                return (
                  <label key={c.key} htmlFor={id} className={`flex items-center gap-2 text-slate-300 ${c.wide ? 'sm:col-span-2' : ''}`}>
                    <input id={id} type="checkbox" checked={!!draft[c.key]} onChange={(e) => set(c.key, e.target.checked)} className="accent-amber-500 w-4 h-4" />
                    {c.label}
                  </label>
                );
              }
              const hint = c.key === 'trieniosManual' ? `Vacío: ${trieniosAuto} según la fecha de alta` : c.hint;
              return (
                <div key={c.key} className={c.wide ? 'sm:col-span-2' : ''}>
                  <label htmlFor={id} className="text-slate-400 block mb-1">{c.label}</label>
                  {c.type === 'select' ? (
                    <select
                      id={id}
                      value={draft[c.key]}
                      onChange={(e) => set(c.key, c.numeric ? Number(e.target.value) : e.target.value)}
                      className={inputCls}
                    >
                      {!c.options.some((o) => String(o.value) === String(draft[c.key])) && draft[c.key] !== '' && (
                        <option value={draft[c.key]}>{draft[c.key]}</option>
                      )}
                      {c.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      id={id}
                      type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                      step={c.step}
                      min={c.type === 'number' ? 0 : undefined}
                      value={draft[c.key]}
                      placeholder={c.auto ? 'Automático' : undefined}
                      onChange={(e) => set(c.key, e.target.value)}
                      className={`${inputCls} ${c.type === 'number' ? 'font-mono' : ''}`}
                    />
                  )}
                  {hint && <span className="text-[10px] text-slate-500 block mt-0.5">{hint}</span>}
                </div>
              );
            })}
          </div>
          {s.titulo.startsWith('3.') && (
            <div className="flex flex-wrap items-end gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2.5">
              <label className="flex-1 min-w-[160px]">
                <span className="text-slate-400 block mb-1">¿Cuánto neto quieres que cobre al mes?</span>
                <input type="number" min="0" step="10" value={neto} onChange={(e) => setNeto(e.target.value)} className={`${inputCls} font-mono`} placeholder="Ej.: 1.600" />
              </label>
              <button type="button" onClick={ajustarANeto} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold flex items-center gap-1.5">
                <Wand2 className="w-4 h-4" /> Calcular salario base
              </button>
            </div>
          )}
        </fieldset>
      ))}

      <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400">
          Mes normal: bruto <strong className="text-white font-mono">{eur(p.totalDevengado)}</strong> · neto{' '}
          <strong className="text-amber-400 font-mono">{eur(p.liquido)}</strong> · IRPF {p.irpf.aplicado} % · coste empresa{' '}
          <strong className="text-white font-mono">{eur(p.costeEmpresa)}</strong>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold">Cancelar</button>
          <button type="submit" className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black flex items-center gap-1.5">
            <Save className="w-4 h-4" /> Guardar ficha
          </button>
        </div>
      </div>
    </form>
  );
}
