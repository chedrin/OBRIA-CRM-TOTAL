import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Truck, Plus, User, Gauge, Search } from 'lucide-react';
import { btnPrimary, inputCls, fmtMoney } from '../../services/avisosApi';
import { ESTADO_ALERTA, peorEstado, ordenarAlertas, plazoAlerta } from '../../utils/flota';
import { useFlota, Cabecera, Cargando, SinMigracion, EstadoActivo, EstadoAlerta, Vacio, fmtKm } from './flotaShared';
import { VehiculoForm } from './ActivoForms';
import FichaActivo from './FichaActivo';

const CHIPS = [
  { grupo: 'ITV', label: 'ITV' },
  { grupo: 'Seguros', label: 'Seguro' },
  { grupo: 'Mantenimiento', label: 'Mantenimiento' },
  { grupo: 'Documentos', label: 'Documentos' }
];

/** Panel de flota: una tarjeta por vehículo con el semáforo de ITV, seguro y mantenimiento. */
export default function FlotaView() {
  const { data, error, loading, reload } = useFlota();
  const [nuevo, setNuevo] = useState(false);
  const [abierto, setAbierto] = useState(null);
  const [q, setQ] = useState('');
  const [verBajas, setVerBajas] = useState(false);

  const vehiculos = useMemo(() => {
    const activos = new Map((data?.activos || []).map((a) => [a.id, a]));
    const t = q.trim().toLowerCase();
    return (data?.vehiculos || [])
      .map((v) => ({ ...v, activo: activos.get(v.asset_id), alertas: ordenarAlertas((data?.alertas || []).filter((al) => al.vehicle_id === v.id)) }))
      .filter((v) => v.activo && (verBajas || v.activo.estado !== 'baja'))
      .filter((v) => !t || [v.matricula, v.marca, v.modelo, v.conductor_nombre, v.activo.codigo_interno].join(' ').toLowerCase().includes(t))
      .sort((a, b) => (ESTADO_ALERTA[peorEstado(a.alertas)]?.orden ?? 9) - (ESTADO_ALERTA[peorEstado(b.alertas)]?.orden ?? 9) || a.matricula.localeCompare(b.matricula));
  }, [data, q, verBajas]);

  const cuenta = useMemo(() => {
    const c = { vencido: 0, urgente: 0, proximo: 0, fuera: 0 };
    for (const v of vehiculos) {
      const p = peorEstado(v.alertas);
      if (c[p] !== undefined) c[p] += 1;
      if (v.alertas.some((a) => a.fuera_servicio)) c.fuera += 1;
    }
    return c;
  }, [vehiculos]);

  if (loading && !data) return <Cargando />;
  if (error || data?.listo === false) return <><Cabecera icon={Truck} titulo="Flota de vehículos" tono="text-sky-400" /><SinMigracion error={error} /></>;

  return (
    <div>
      <Cabecera icon={Truck} titulo="Flota de vehículos" tono="text-sky-400" subtitulo="ITV, seguros, combustible, mantenimiento y costes de cada vehículo.">
        <button type="button" onClick={() => setNuevo(true)} className={btnPrimary}><Plus className="w-4 h-4" /> Nuevo vehículo</button>
      </Cabecera>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Kpi titulo="Vehículos" valor={vehiculos.length} />
        <Kpi titulo="Fuera de servicio" valor={cuenta.fuera} tono={cuenta.fuera ? 'text-rose-300' : ''} detalle="ITV o seguro caducado" />
        <Kpi titulo="Con algo vencido" valor={cuenta.vencido} tono={cuenta.vencido ? 'text-rose-300' : ''} />
        <Kpi titulo="Próximos a vencer" valor={cuenta.urgente + cuenta.proximo} tono={cuenta.urgente + cuenta.proximo ? 'text-amber-300' : ''} />
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Matrícula, marca, conductor…" className={`${inputCls} !pl-9`} />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={verBajas} onChange={(e) => setVerBajas(e.target.checked)} /> Ver dados de baja</label>
      </div>

      {vehiculos.length === 0 ? (
        <Vacio>{(data?.vehiculos || []).length ? 'Nada coincide con la búsqueda.' : 'Da de alta tu primer vehículo con "Nuevo vehículo".'}</Vacio>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {vehiculos.map((v) => {
            const peor = peorEstado(v.alertas);
            const coste = data.costes12m?.[v.asset_id]?.total || 0;
            return (
              <button key={v.id} type="button" onClick={() => setAbierto(v.asset_id)}
                className={`text-left rounded-2xl border border-slate-800 border-l-4 ${ESTADO_ALERTA[peor].bar} bg-slate-900 hover:bg-slate-800/60 p-4 space-y-3 transition`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="inline-block font-mono font-black text-lg text-white tracking-wider bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5">{v.matricula}</span>
                    <p className="text-sm text-slate-300 mt-1 truncate">{[v.marca, v.modelo].filter(Boolean).join(' ') || v.activo.nombre}</p>
                  </div>
                  <EstadoActivo estado={v.activo.estado} tipo="vehiculo" />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CHIPS.map((c) => {
                    const al = v.alertas.filter((a) => a.grupo === c.grupo);
                    if (!al.length && c.grupo === 'Documentos') return null;
                    return <EstadoAlerta key={c.grupo} estado={al.length ? peorEstado(al) : 'vigente'}>{c.label}</EstadoAlerta>;
                  })}
                  {v.alertas.some((a) => a.fuera_servicio) && <span className="text-[10px] font-black rounded-md bg-rose-600 text-white px-1.5 py-0.5">FUERA DE SERVICIO</span>}
                </div>
                {v.alertas[0] && v.alertas[0].estado !== 'vigente' && (
                  <p className="text-xs text-slate-400 truncate">{v.alertas[0].grupo}: {plazoAlerta(v.alertas[0]) || v.alertas[0].detalle}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> {fmtKm(v.km_actual)}</span>
                  <span className="flex items-center gap-1 truncate"><User className="w-3.5 h-3.5" /> {v.conductor_nombre || 'Sin conductor'}</span>
                  <span className="ml-auto tabular-nums" title="Coste de los últimos 12 meses">{fmtMoney(coste)}/año</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {nuevo && <VehiculoForm key="nuevo" onClose={() => setNuevo(false)} onSaved={(a) => { setNuevo(false); reload(); setAbierto(a.id); }} />}
        {abierto && <FichaActivo key={abierto} activoId={abierto} datos={data} onClose={() => setAbierto(null)} onChanged={reload} />}
      </AnimatePresence>
    </div>
  );
}

function Kpi({ titulo, valor, detalle, tono = '' }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
      <span className="block text-[11px] font-semibold text-slate-400">{titulo}</span>
      <span className={`block text-xl font-black tabular-nums ${tono || 'text-white'}`}>{valor}</span>
      {detalle && <span className="block text-[11px] text-slate-500">{detalle}</span>}
    </div>
  );
}
