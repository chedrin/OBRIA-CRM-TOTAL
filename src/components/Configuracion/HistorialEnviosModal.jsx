import React, { useEffect, useState } from 'react';
import { History, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { listarEnvios, descargarEnviosExcel } from '../../services/facturacionService';

const inputClass = 'bg-slate-800 border border-slate-700 rounded-xl p-2 text-white text-xs focus:outline-none focus:border-sky-400';
const fecha = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '');
const hoy = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD en hora local
const haceDias = (n) => new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE');

const ESTADOS = [
  { id: '', texto: 'Todos los estados' },
  { id: 'correcto', texto: 'Correctos / aceptados' },
  { id: 'con_errores', texto: 'Aceptados con errores' },
  { id: 'rechazado', texto: 'Rechazados o con error' },
  { id: 'pendiente', texto: 'Pendientes de envío' }
];

const ESTADO_REGISTRO = {
  aceptado: { texto: 'Aceptado', clase: 'text-emerald-400' },
  aceptado_con_errores: { texto: 'Aceptado con errores', clase: 'text-amber-400' },
  rechazado: { texto: 'Rechazado', clase: 'text-rose-400' },
  pendiente: { texto: 'Pendiente', clase: 'text-sky-300' }
};

const claseEnvio = (estado) => (estado === 'Correcto' ? 'text-emerald-400' : estado === 'ParcialmenteCorrecto' ? 'text-amber-400' : 'text-rose-400');

/** Historial de envíos a la AEAT con filtros por día y estado, y descarga en Excel con los mismos filtros. */
export default function HistorialEnviosModal({ onClose }) {
  const { showNotification } = useApp();
  const [filtros, setFiltros] = useState({ desde: haceDias(30), hasta: hoy(), estado: '' });
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [vista, setVista] = useState('registros');

  const cargar = async (f = filtros) => {
    setCargando(true);
    const result = await listarEnvios(f);
    setCargando(false);
    if (!result.ok) {
      showNotification(result.error, 'error');
      return;
    }
    setDatos(result.data);
  };

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cambiar = (campo) => (e) => {
    const f = { ...filtros, [campo]: e.target.value };
    setFiltros(f);
    cargar(f);
  };

  const rapido = (desde, hasta = hoy()) => {
    const f = { ...filtros, desde, hasta };
    setFiltros(f);
    cargar(f);
  };

  const excel = async () => {
    setDescargando(true);
    const result = await descargarEnviosExcel(filtros);
    setDescargando(false);
    if (!result.ok) showNotification(result.error, 'error');
  };

  const envios = datos?.envios || [];
  const registros = datos?.historial || [];
  const cuenta = (estado) => registros.filter(r => r.estado_envio === estado).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-sky-400" />
              <span>Historial de envíos a la AEAT</span>
            </h3>
            <button aria-label="Cerrar" type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Desde</label>
              <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiar('desde')} className={inputClass} />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Hasta</label>
              <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiar('hasta')} className={inputClass} />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Estado</label>
              <select value={filtros.estado} onChange={cambiar('estado')} className={inputClass}>
                {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.texto}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => rapido(hoy())} className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl">Hoy</button>
              <button type="button" onClick={() => rapido(haceDias(7))} className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl">7 días</button>
              <button type="button" onClick={() => rapido(haceDias(30))} className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl">30 días</button>
              <button type="button" onClick={() => rapido('', '')} className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl">Todo</button>
            </div>
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={() => cargar()} disabled={cargando} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
              <button type="button" onClick={excel} disabled={descargando} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{descargando ? 'Preparando…' : 'Descargar Excel'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(ESTADO_REGISTRO).map(([id, e]) => (
              <div key={id} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                <span className="text-slate-400 block">{e.texto}</span>
                <strong className={`text-lg ${cuenta(id) ? e.clase : 'text-white'}`}>{cuenta(id)}</strong>
              </div>
            ))}
          </div>

          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 w-fit">
            {[['registros', `Facturas (${registros.length})`], ['envios', `Envíos (${envios.length})`]].map(([id, texto]) => (
              <button key={id} type="button" onClick={() => setVista(id)} className={`px-3 py-1.5 rounded-lg font-semibold ${vista === id ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}>{texto}</button>
            ))}
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            {vista === 'registros' ? (
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="p-2">Factura</th><th className="p-2">Operación</th><th className="p-2">Expedición</th>
                    <th className="p-2 text-right">Importe</th><th className="p-2">Estado</th><th className="p-2">CSV / error</th><th className="p-2">Último intento</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map(r => (
                    <tr key={r.id} className="border-t border-slate-800 align-top">
                      <td className="p-2 font-mono text-slate-200 whitespace-nowrap">{r.num_serie}</td>
                      <td className="p-2 text-slate-300">{r.tipo_registro === 'anulacion' ? 'Anulación' : r.subsanacion === 'S' ? 'Alta (reenvío)' : 'Alta'}</td>
                      <td className="p-2 text-slate-300 whitespace-nowrap">{r.fecha_expedicion}</td>
                      <td className="p-2 text-right text-slate-300 whitespace-nowrap">{r.importe_total ? `${Number(r.importe_total).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` : ''}</td>
                      <td className={`p-2 font-semibold whitespace-nowrap ${ESTADO_REGISTRO[r.estado_envio]?.clase || 'text-slate-300'}`}>{ESTADO_REGISTRO[r.estado_envio]?.texto || r.estado_envio}</td>
                      <td className="p-2 text-slate-400 min-w-[14rem]">
                        {r.csv_aeat && <span className="font-mono text-slate-300">{r.csv_aeat}</span>}
                        {r.codigo_error && <span className="text-rose-300"> ({r.codigo_error}) {r.descripcion_error}</span>}
                      </td>
                      <td className="p-2 text-slate-400 whitespace-nowrap">{fecha(r.ultimo_intento_at || r.enviado_at)}{r.intentos > 1 ? ` · ${r.intentos} intentos` : ''}</td>
                    </tr>
                  ))}
                  {!registros.length && <tr><td colSpan={7} className="p-4 text-center text-slate-500">{cargando ? 'Cargando…' : 'No hay facturas con esos filtros.'}</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="p-2">Fecha y hora</th><th className="p-2 text-right">Registros</th><th className="p-2">Resultado</th><th className="p-2">CSV</th><th className="p-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {envios.map(e => (
                    <tr key={e.id} className="border-t border-slate-800 align-top">
                      <td className="p-2 text-slate-300 whitespace-nowrap">{fecha(e.created_at)}</td>
                      <td className="p-2 text-right text-slate-300">{e.registros}</td>
                      <td className={`p-2 font-semibold ${claseEnvio(e.estado_envio)}`}>{e.estado_envio}</td>
                      <td className="p-2 font-mono text-slate-300">{e.csv_aeat}</td>
                      <td className="p-2 text-rose-300 min-w-[14rem]">{e.error}</td>
                    </tr>
                  ))}
                  {!envios.length && <tr><td colSpan={5} className="p-4 text-center text-slate-500">{cargando ? 'Cargando…' : 'No hay envíos con esos filtros.'}</td></tr>}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Se muestran hasta 500 filas; el Excel incluye hasta 5000 con los mismos filtros. Las fechas de las facturas son las de su registro en la aplicación.</p>
        </div>
      </div>
    </div>
  );
}
