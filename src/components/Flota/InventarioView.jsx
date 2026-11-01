import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Boxes, Plus, Search, ScanLine } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { inputCls, btnPrimary, fmtMoney } from '../../services/avisosApi';
import { TIPOS_ACTIVO, ESTADOS_ACTIVO, labelDe, ubicacionTexto, peorEstado } from '../../utils/flota';
import { useFlota, Cabecera, Cargando, SinMigracion, EstadoActivo, EstadoAlerta, Vacio, inputSm } from './flotaShared';
import { ActivoForm } from './ActivoForms';
import FichaActivo from './FichaActivo';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Inventario: materiales, herramientas y maquinaria (los vehículos están en Flota). */
export default function InventarioView() {
  const { obras = [] } = useApp() || {};
  const { data, error, loading, reload } = useFlota();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('activos');
  const [obra, setObra] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [abierto, setAbierto] = useState(null);

  const activos = useMemo(() => (data?.activos || []).filter((a) => a.tipo !== 'vehiculo'), [data]);
  const alertasPorActivo = useMemo(() => {
    const m = new Map();
    for (const al of data?.alertas || []) if (al.estado !== 'vigente') m.set(al.asset_id, [...(m.get(al.asset_id) || []), al]);
    return m;
  }, [data]);

  const filtrados = useMemo(() => {
    const t = norm(q);
    return activos.filter((a) =>
      (estado === 'activos' ? !['baja', 'devuelto_proveedor'].includes(a.estado) : !estado || a.estado === estado)
      && (!tipo || a.tipo === tipo)
      && (!obra || a.obra_id === obra)
      && (!t || norm([a.codigo_interno, a.codigo_barras, a.numero_serie, a.nombre, a.marca, a.modelo, a.operario_nombre].join(' ')).includes(t)));
  }, [activos, q, tipo, estado, obra]);

  // Búsqueda por lector de código de barras: Enter con un código exacto abre la ficha.
  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const t = q.trim().toUpperCase();
    const exacto = activos.find((a) => a.codigo_barras?.toUpperCase() === t || a.codigo_interno === t || a.numero_serie?.toUpperCase() === t);
    if (exacto) { setAbierto(exacto.id); setQ(''); }
  };

  const resumen = useMemo(() => ({
    total: activos.filter((a) => a.estado !== 'baja').length,
    enObra: activos.filter((a) => a.estado === 'en_obra').length,
    reparacion: activos.filter((a) => a.estado === 'en_reparacion').length,
    valor: activos.filter((a) => a.estado !== 'baja' && a.tipo_adquisicion === 'propiedad').reduce((s, a) => s + Number(a.precio_compra || 0), 0)
  }), [activos]);

  if (loading && !data) return <Cargando />;
  if (error || data?.listo === false) return <><Cabecera icon={Boxes} titulo="Inventario y maquinaria" /><SinMigracion error={error} /></>;

  return (
    <div>
      <Cabecera icon={Boxes} titulo="Inventario y maquinaria" subtitulo="Qué tenemos, dónde está, quién lo tiene y cuánto costó.">
        <button type="button" onClick={() => setNuevo(true)} className={btnPrimary}><Plus className="w-4 h-4" /> Nuevo elemento</button>
      </Cabecera>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[['Elementos', resumen.total], ['En obra', resumen.enObra], ['En reparación', resumen.reparacion], ['Valor de compra', fmtMoney(resumen.valor)]].map(([t, v]) => (
          <div key={t} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <span className="block text-[11px] font-semibold text-slate-400">{t}</span>
            <span className="block text-xl font-black text-white tabular-nums">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Buscar por nombre, código, código de barras o nº de serie"
            className={`${inputCls} !pl-9 !pr-9`} />
          <ScanLine className="w-4 h-4 text-slate-600 absolute right-3 top-1/2 -translate-y-1/2" title="Compatible con lector de códigos" />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${inputSm} !w-auto`}>
          <option value="">Todos los tipos</option>
          {TIPOS_ACTIVO.filter((t) => t.id !== 'vehiculo').map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${inputSm} !w-auto`}>
          <option value="activos">En uso (sin bajas)</option>
          <option value="">Todos</option>
          {Object.entries(ESTADOS_ACTIVO).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <select value={obra} onChange={(e) => setObra(e.target.value)} className={`${inputSm} !w-auto max-w-[200px]`}>
          <option value="">Todas las obras</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.titulo}</option>)}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <Vacio>{activos.length ? 'Nada coincide con la búsqueda.' : 'Aún no hay nada en el inventario. Empieza con "Nuevo elemento".'}</Vacio>
      ) : (
        <div className="rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-[11px] uppercase tracking-wide text-slate-500 hidden md:table-header-group">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Código</th>
                <th className="text-left px-3 py-2 font-bold">Elemento</th>
                <th className="text-left px-3 py-2 font-bold">Estado</th>
                <th className="text-left px-3 py-2 font-bold">Dónde / quién</th>
                <th className="text-right px-3 py-2 font-bold">Alertas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtrados.map((a) => {
                const al = alertasPorActivo.get(a.id) || [];
                return (
                  <tr key={a.id} onClick={() => setAbierto(a.id)} className="cursor-pointer hover:bg-slate-800/40 flex flex-col md:table-row px-3 py-2 md:p-0">
                    <td className="md:px-3 md:py-2.5 font-mono text-xs text-amber-300 whitespace-nowrap">{a.codigo_interno}</td>
                    <td className="md:px-3 md:py-2.5 min-w-0">
                      <span className="text-white font-semibold">{a.nombre}</span>
                      <span className="block text-[11px] text-slate-500">
                        {labelDe(TIPOS_ACTIVO, a.tipo)}{a.tipo_adquisicion !== 'propiedad' ? ` · ${a.tipo_adquisicion}` : ''}
                        {a.tipo === 'consumible' ? ` · ${Number(a.cantidad).toLocaleString('es-ES')} ${a.unidad}` : ''}
                        {a.numero_serie ? ` · S/N ${a.numero_serie}` : ''}
                      </span>
                    </td>
                    <td className="md:px-3 md:py-2.5"><EstadoActivo estado={a.estado} tipo={a.tipo} /></td>
                    <td className="md:px-3 md:py-2.5 text-xs text-slate-300">{ubicacionTexto(a, { obras, vehiculos: data.vehiculos })}</td>
                    <td className="md:px-3 md:py-2.5 md:text-right">{al.length > 0 && <EstadoAlerta estado={peorEstado(al)}>{al[0].grupo}{al.length > 1 ? ` +${al.length - 1}` : ''}</EstadoAlerta>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {nuevo && <ActivoForm key="nuevo" datos={data} onClose={() => setNuevo(false)} onSaved={(a) => { setNuevo(false); reload(); setAbierto(a.id); }} />}
        {abierto && <FichaActivo key={abierto} activoId={abierto} datos={data} onClose={() => setAbierto(null)} onChanged={reload} />}
      </AnimatePresence>
    </div>
  );
}
