import React, { useMemo, useState } from 'react';
import { CreditCard, Save, Info } from 'lucide-react';
import { calcularNomina, PARAMETROS_NOMINA } from '../../utils/nomina';

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const eur = (v) => `${Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const SITUACION_TXT = {
  1: 'Situación 1 (monoparental)',
  2: 'Situación 2 (cónyuge a cargo)',
  3: 'Situación 3 (resto de casos)'
};

const VARIABLES = [
  { key: 'diasNoRetribuidos', label: 'Días sin sueldo', step: 1 },
  { key: 'horasExtras', label: 'Horas extra', step: 0.5 },
  { key: 'itDiasMes', label: 'Días de baja (IT)', step: 1 },
  { key: 'itDiasPrevios', label: 'Días de baja de meses anteriores', step: 1 },
  { key: 'anticipos', label: 'Anticipos (€)', step: 10 },
  { key: 'otrasDeducciones', label: 'Otras deducciones (€)', step: 10 }
];

export function SelectorMes({ mes, anio, onChange }) {
  const anios = [anio - 1, anio, anio + 1];
  return (
    <div className="flex items-center gap-2 text-xs">
      <select
        aria-label="Mes de la nómina"
        value={mes}
        onChange={(e) => onChange({ mes: Number(e.target.value), anio })}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
      >
        {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select
        aria-label="Año de la nómina"
        value={anio}
        onChange={(e) => onChange({ mes, anio: Number(e.target.value) })}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
      >
        {anios.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  );
}

function Linea({ label, value, tone = 'text-slate-300', sub }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-slate-300">
        {label}
        {sub && <span className="text-[10px] text-slate-500 block">{sub}</span>}
      </span>
      <span className={`font-mono whitespace-nowrap ${tone}`}>{value}</span>
    </div>
  );
}

/**
 * Nómina detallada de un empleado. Las variables del mes (días, horas extra, baja...)
 * se pueden tocar aquí y guardarlas en la ficha.
 */
export default function NominaDesglose({ emp, onGuardarVariables }) {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState({ mes: hoy.getMonth() + 1, anio: hoy.getFullYear() });
  const [vars, setVars] = useState(() => Object.fromEntries(VARIABLES.map((v) => [v.key, emp[v.key] ?? 0]).concat([['itTipo', emp.itTipo || 'comun']])));
  const [dirty, setDirty] = useState(false);

  const ficha = useMemo(() => ({ ...emp, ...vars }), [emp, vars]);
  const p = useMemo(() => calcularNomina(ficha, periodo), [ficha, periodo]);

  const setVar = (k, v) => {
    setVars((prev) => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const guardar = () => {
    const patch = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, k === 'itTipo' ? v : Number(v) || 0]));
    onGuardarVariables?.(patch);
    setDirty(false);
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-white flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-amber-400" />
          Nómina de {MESES[periodo.mes - 1].toLowerCase()} de {periodo.anio}
        </span>
        <SelectorMes mes={periodo.mes} anio={periodo.anio} onChange={setPeriodo} />
      </div>

      {/* Variables del mes */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider">Datos de este mes</span>
          {onGuardarVariables && (
            <button
              type="button"
              onClick={guardar}
              disabled={!dirty}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" /> Guardar en la ficha
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VARIABLES.map((v) => (
            <label key={v.key} className="block">
              <span className="text-[11px] text-slate-400 block mb-0.5">{v.label}</span>
              <input
                type="number"
                min="0"
                step={v.step}
                value={vars[v.key]}
                onChange={(e) => setVar(v.key, e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white font-mono"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-[11px] text-slate-400 block mb-0.5">Tipo de baja</span>
            <select
              value={vars.itTipo}
              onChange={(e) => setVar('itTipo', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white"
            >
              <option value="comun">Enfermedad común</option>
              <option value="accidente">Accidente de trabajo</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase font-black text-emerald-400 tracking-wider block mb-1">I. Devengos</span>
          {p.conceptos.map((c) => (
            <Linea key={c.concepto} label={c.concepto} value={eur(c.importe)} sub={c.dias !== undefined && c.dias !== 30 ? `${c.dias} de 30 días` : undefined} />
          ))}
          <div className="border-t border-slate-800 mt-1 pt-1">
            <Linea label={<strong className="text-white">Total devengado</strong>} value={eur(p.totalDevengado)} tone="text-emerald-400 font-bold" />
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase font-black text-rose-400 tracking-wider block mb-1">II. Deducciones</span>
          {p.ssTrabajador.map((l) => (
            <Linea key={l.concepto} label={`${l.concepto} (${l.pct} %)`} value={`-${eur(l.importe)}`} tone="text-rose-400" />
          ))}
          <Linea
            label={`IRPF (${p.irpf.aplicado} %)`}
            sub={p.irpf.manual ? `Puesto a mano. Calculado: ${p.irpf.calculado} %` : 'Calculado con los datos del Modelo 145'}
            value={`-${eur(p.retencionIrpf)}`}
            tone="text-rose-400"
          />
          {p.otrasDeducciones > 0 && <Linea label="Anticipos y otras deducciones" value={`-${eur(p.otrasDeducciones)}`} tone="text-rose-400" />}
          <div className="border-t border-slate-800 mt-1 pt-1">
            <Linea label={<strong className="text-white">Total deducciones</strong>} value={`-${eur(p.totalDeducciones)}`} tone="text-rose-400 font-bold" />
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-950 to-slate-900 p-3.5 rounded-xl border border-amber-500/30 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Líquido a percibir</span>
          <span className="text-lg font-black text-amber-400 font-mono">{eur(p.liquido)}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Seguridad Social empresa</span>
          <span className="text-sm font-bold text-slate-300 font-mono">{eur(p.totalSSEmpresa)}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase block">Coste total empresa</span>
          <span className="text-sm font-bold text-white font-mono">{eur(p.costeEmpresa)}</span>
          <span className="text-[10px] text-slate-500 block">Anual aprox.: {eur(p.costeAnualEstimado)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block mb-1">Aportación de la empresa</span>
          {p.ssEmpresa.map((l) => (
            <Linea key={l.concepto} label={`${l.concepto} (${l.pct} %)`} value={eur(l.importe)} />
          ))}
          <div className="border-t border-slate-800 mt-1 pt-1 text-[11px] text-slate-400 space-y-0.5">
            <div>Base contingencias comunes: <span className="font-mono text-slate-300">{eur(p.bases.contingenciasComunes)}</span></div>
            <div>Base contingencias profesionales: <span className="font-mono text-slate-300">{eur(p.bases.contingenciasProfesionales)}</span></div>
            <div>Base IRPF: <span className="font-mono text-slate-300">{eur(p.bases.irpf)}</span></div>
          </div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Cómo sale el IRPF</span>
          <Linea label="Sueldo bruto anual previsto" value={eur(p.retribucionAnual)} />
          <Linea label={SITUACION_TXT[p.irpf.situacion]} value={`${emp.hijosACargo || 0} hijos`} />
          {p.irpf.exento ? (
            <p className="text-emerald-400">Por debajo de {eur(p.irpf.limite)} al año no se retiene IRPF{p.temporal ? ' (contrato temporal: mínimo 2 %)' : ''}.</p>
          ) : p.irpf.detalle && (
            <>
              <Linea label="Seguridad Social y gastos" value={`-${eur(p.irpf.detalle.gastos)}`} />
              {p.irpf.detalle.reduccion > 0 && <Linea label="Reducción por rendimientos del trabajo" value={`-${eur(p.irpf.detalle.reduccion)}`} />}
              <Linea label="Mínimo personal y familiar" value={eur(p.irpf.detalle.minimoPersonalFamiliar)} />
              <Linea label="Retención anual" value={eur(p.irpf.detalle.cuotaAnual)} tone="text-rose-400" />
            </>
          )}
          <Linea label="Trienios" value={`${p.trienios} (${eur(p.antiguedad)}/mes)`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase font-black text-blue-400 tracking-wider block mb-1">Vacaciones {periodo.anio}</span>
          <Linea label="Días al año" value={p.vacaciones.total} />
          <Linea label="Disfrutados" value={p.vacaciones.consumidas} />
          <Linea label="Pendientes" value={p.vacaciones.pendientes} tone="text-emerald-400" />
          <Linea label={`Generados hasta fin de ${MESES[periodo.mes - 1].toLowerCase()}`} value={p.vacaciones.devengadas} />
          <Linea label="Valor de lo generado y no disfrutado" sub="Lo que habría que pagar en un finiquito" value={eur(p.vacaciones.valorPendientesDevengadas)} />
        </div>
        {p.it.dias > 0 && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-black text-rose-300 tracking-wider block mb-1">Baja por IT</span>
            {p.it.tramos.map((t) => <Linea key={t.pct} label={`${t.dias} días al ${t.pct} %`} value="" />)}
            <Linea label="Prestación" value={eur(p.it.prestacion)} />
            <Linea label="Complemento de la empresa" value={eur(p.it.complemento)} />
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 flex gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Cálculo orientativo con los tipos de {PARAMETROS_NOMINA.anio} (régimen general, sin regularizaciones de IRPF ni cotización de solidaridad). Revísalo con la gestoría antes de pagar.
      </p>
    </div>
  );
}
