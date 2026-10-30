import React, { useEffect, useMemo, useState } from 'react';
import { Receipt, AlertTriangle, FileCheck2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { calcularIvaObra, getObraFiscal, guardarObraFiscal } from '../../services/facturacionService';
import ModalOverlay from '../Common/ModalOverlay';
import BarraFacturacion from './BarraFacturacion';
import { facturacionPresupuestos, MARGEN_LIMITE } from '../../utils/facturadoPresupuesto';
import { siguienteCertificacion, etiquetaCertificacion } from '../../utils/certificaciones';

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400';

const DATOS_OBRA_INICIALES = {
  tipoObra: 'reforma_vivienda',
  relacion: 'promotor',
  destinoVivienda: true,
  usoParticular: true,
  antiguedadMas2Anos: true,
  materialesPct: 30
};

const eur = (v) => Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Emitir una factura (o certificación) desde un presupuesto: datos completos del
 * cliente, IVA según el tipo de obra (con su motivo legal) y vista previa de importes.
 */
export default function EmitirFacturaModal({ presupuestos, presupuestoInicial = null, onClose, onEmitida }) {
  const { convertPresupuestoToFactura, facturacion, facturas = [] } = useApp();
  const empresa = facturacion?.empresa;
  const [presId, setPresId] = useState(presupuestoInicial?.id || presupuestos[0]?.id || '');
  const pres = presupuestos.find(p => p.id === presId) || null;
  // Lo ya facturado de cada presupuesto (facturas vigentes, con rectificativas y sin anuladas).
  const estados = useMemo(() => facturacionPresupuestos(presupuestos, facturas), [presupuestos, facturas]);
  const estado = pres ? estados.get(pres.id) : null;
  const pendientePct = estado?.total ? Math.round((estado.pendiente / estado.total) * 10000) / 100 : 100;
  // Certificaciones: cada una una sola vez y en orden; antes de la primera, se puede hacer una factura única del 100 %.
  const sig = useMemo(() => (pres ? siguienteCertificacion(pres, facturas, estado?.pendiente ?? null) : null), [pres, facturas, estado]);
  const [unica, setUnica] = useState(false);
  const [pct, setPct] = useState(40);
  const importeFijo = Boolean(unica || sig?.base !== null);
  const concepto = !sig ? '' : unica ? etiquetaCertificacion({ unica: true }) : etiquetaCertificacion(sig);
  const [cliente, setCliente] = useState({});
  const [obra, setObra] = useState(DATOS_OBRA_INICIALES);
  const [fiscal, setFiscal] = useState(null);
  const [manual, setManual] = useState(null); // { ivaPct, isp } si el usuario ajusta a mano
  const [fechaOperacion, setFechaOperacion] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);

  // Datos del cliente a partir del presupuesto, y datos fiscales guardados de la obra.
  useEffect(() => {
    if (!pres) return;
    setCliente({
      clienteNombre: pres.cliente || '',
      clienteNif: pres.nif || pres.cifNif || '',
      clienteTipo: pres.clienteTipo || 'particular',
      clienteDireccion: pres.direccion || '',
      clienteCodigoPostal: pres.codigoPostal || '',
      clienteMunicipio: pres.localidad || pres.municipio || '',
      clienteProvincia: pres.provincia || ''
    });
    setManual(null);
    setUnica(false);
    // No proponer más de lo que queda por facturar.
    const queda = estados.get(pres.id);
    if (queda?.total) {
      const restoPct = Math.round((queda.pendiente / queda.total) * 10000) / 100;
      if (restoPct < pct) setPct(restoPct);
    }
    if (pres.obraId) {
      getObraFiscal(pres.obraId).then(r => {
        if (r.ok && r.data?.obra?.datosFiscales && Object.keys(r.data.obra.datosFiscales).length) {
          setObra(o => ({ ...o, ...r.data.obra.datosFiscales }));
        }
      });
    }
  }, [presId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Asistente de IVA: se recalcula al cambiar el tipo de obra o de cliente.
  useEffect(() => {
    let cancelado = false;
    calcularIvaObra({ ...obra, clienteTipo: cliente.clienteTipo }).then(r => {
      if (!cancelado && r.ok) setFiscal(r.data.resultado);
    });
    return () => { cancelado = true; };
  }, [obra, cliente.clienteTipo]);

  const ivaPct = manual ? Number(manual.ivaPct) : Number(fiscal?.ivaPct ?? empresa?.ivaPorDefectoPct ?? 21);
  const isp = manual ? manual.isp : Boolean(fiscal?.isp);
  const irpfPct = Number(fiscal?.irpfPct ?? empresa?.irpfPorDefectoPct ?? 0);
  const importes = useMemo(() => {
    // Factura única: el 100 %. Plan fijo: el importe de la certificación. Si no, el porcentaje
    // elegido (el resto pendiente se factura exacto, sin redondear el porcentaje).
    let base;
    if (unica) base = Number(estado?.total ?? pres?.baseImponible ?? 0);
    else if (sig?.base !== null && sig?.base !== undefined) base = sig.base;
    else base = estado && estado.pendiente > 0 && Math.abs(pct - pendientePct) < 0.005
      ? estado.pendiente
      : Math.round((Number(pres?.baseImponible || 0) * pct) / 100 * 100) / 100;
    const cuota = isp ? 0 : Math.round(base * ivaPct) / 100;
    const irpf = Math.round(base * irpfPct) / 100;
    return { base, cuota, irpf, total: base + cuota - irpf };
  }, [pres, pct, ivaPct, isp, irpfPct, estado, pendientePct, unica, sig]);
  const pctMostrado = importeFijo && estado?.total ? Math.round((importes.base / estado.total) * 10000) / 100 : pct;
  const excede = Boolean(estado) && importes.base > estado.pendiente + MARGEN_LIMITE;
  const yaFacturado = Boolean(estado?.completo) || Boolean(sig?.cerrado && !unica);

  const setC = (field) => (e) => setCliente(c => ({ ...c, [field]: e.target.value }));
  const setO = (field) => (e) => setObra(o => ({ ...o, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pres || emitiendo || excede || yaFacturado || importes.base <= 0) return;
    setEmitiendo(true);
    const motivo = manual ? `IVA fijado a mano: ${isp ? 'inversión del sujeto pasivo' : `${ivaPct} %`}.` : fiscal?.motivo || '';
    const factura = await convertPresupuestoToFactura(pres.id, concepto, Number(pctMostrado), {
      ...cliente,
      clienteTipo: cliente.clienteTipo === 'empresa' ? 'empresa' : 'particular',
      // El servidor pone delante "Certificación N de M (...)" o "Factura única (100 %)".
      descripcion: pres.obraTitulo || pres.numero,
      certificacion: unica ? undefined : sig?.n,
      facturaUnica: unica,
      ivaPct,
      isp,
      irpfPct,
      ivaMotivo: motivo,
      baseImponible: importes.base,
      fechaOperacion: fechaOperacion || undefined
    });
    if (factura && pres.obraId) {
      guardarObraFiscal(pres.obraId, { nombre: pres.obraTitulo, direccion: pres.direccion, datosFiscales: { ...obra, clienteTipo: cliente.clienteTipo } });
    }
    setEmitiendo(false);
    if (factura) onEmitida?.(factura);
  };

  const esEmpresa = cliente.clienteTipo === 'empresa';
  const construccion = obra.tipoObra === 'obra_nueva' || obra.tipoObra === 'rehabilitacion';

  return (
    // El contenedor hace scroll y el formulario arranca arriba: con items-center, si el modal
    // es más alto que la pantalla se cortaba por arriba sin poder llegar a la cabecera.
    <ModalOverlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-2xl p-4 sm:p-6 shadow-2xl text-xs sm:text-sm grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] gap-6">
        <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <span>Emitir factura de obra</span>
          </h3>
          <button aria-label="Cerrar" type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {empresa?.verifactuEntorno !== 'produccion' && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Entorno de pruebas: la factura llevará el prefijo PRUEBA- y no tiene validez fiscal.</span>
          </div>
        )}

        {!presupuestoInicial && (
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Presupuesto</label>
            <select value={presId} onChange={(e) => setPresId(e.target.value)} className={inputClass}>
              {presupuestos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.numero} - {p.obraTitulo} ({p.totalConIva?.toLocaleString('es-ES')} €){estados.get(p.id)?.completo ? ' · facturado al 100 %' : estados.get(p.id)?.facturado ? ` · facturado ${estados.get(p.id).pct.toLocaleString('es-ES')} %` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {estado && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
            <BarraFacturacion estado={estado} titulo={`Facturación del presupuesto ${pres.numero} (base ${eur(estado.total)} €)`} />
            {yaFacturado && (
              <p className="text-xs text-emerald-300">Este presupuesto ya está facturado entero. Para cambiar un importe, emite una rectificativa desde la factura.</p>
            )}
          </div>
        )}

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="text-slate-300 font-bold mb-2">Qué se factura</legend>
          {sig && (
            <div className="sm:col-span-2 space-y-2">
              <label className="text-slate-400 block">Certificación</label>
              {sig.plan.fijo ? (
                <ol className="space-y-1.5">
                  {sig.plan.items.map(c => {
                    const emitida = sig.emitidas.get(c.n);
                    const siguiente = !unica && !sig.cerrado && c.n === sig.n;
                    return (
                      <li key={c.n} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${siguiente ? 'border-amber-500/50 bg-amber-500/10 text-amber-200 font-semibold' : 'border-slate-800 bg-slate-950 text-slate-400'}`}>
                        <span>{c.n}. {c.pct.toLocaleString('es-ES')} % · {c.texto}</span>
                        <span className={`font-semibold ${emitida ? 'text-emerald-300' : siguiente ? 'text-amber-300' : 'text-slate-500'}`}>
                          {emitida ? `Facturada · ${emitida.numero}` : siguiente ? 'Es la que toca' : 'Después de la anterior'}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Las condiciones de pago de este presupuesto no fijan porcentajes: elige el importe de cada certificación. Se numeran en orden; toca la certificación {sig.n}
                  {sig.emitidas.size > 0 && ` (ya facturadas: ${[...sig.emitidas.entries()].map(([n, f]) => `${n} · ${f.numero}`).join(', ')})`}.
                </p>
              )}
              {sig.unicaPermitida && (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setUnica(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${!unica ? 'bg-emerald-600 text-white border-emerald-500' : 'border-slate-700 text-slate-300'}`}>
                    Certificación {sig.n}
                  </button>
                  <button type="button" onClick={() => setUnica(true)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${unica ? 'bg-emerald-600 text-white border-emerald-500' : 'border-slate-700 text-slate-300'}`}>
                    Factura única del 100 %
                  </button>
                </div>
              )}
              {sig.cerrado && !yaFacturado && <p className="text-xs text-emerald-300">Todas las certificaciones de este presupuesto están facturadas.</p>}
              <p className="text-xs text-slate-300">Concepto: <strong className="text-white">{concepto}</strong></p>
            </div>
          )}
          <div>
            <label className="text-slate-400 block mb-1">Porcentaje del presupuesto (%)</label>
            <input
              type="number" min="0.01" max={pendientePct} step="0.01"
              value={pctMostrado}
              readOnly={importeFijo}
              onChange={(e) => setPct(Math.min(Math.max(Number(e.target.value) || 0, 0), 100))}
              className={`${inputClass} ${importeFijo ? 'opacity-70 cursor-not-allowed' : ''}`}
            />
            {importeFijo && <p className="text-[11px] text-slate-500 mt-1">{unica ? 'La factura única es el 100 % del presupuesto.' : sig?.ultima ? 'Última certificación: lo que queda pendiente.' : 'Importe fijado por las condiciones de pago del presupuesto.'}</p>}
            {excede && (
              <p className="text-[11px] text-rose-300 mt-1">Supera lo pendiente de facturar: como máximo {pendientePct.toLocaleString('es-ES')} % ({eur(estado.pendiente)} € de base).</p>
            )}
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Fecha de realización de la obra (si no es hoy)</label>
            <input type="date" value={fechaOperacion} onChange={(e) => setFechaOperacion(e.target.value)} className={inputClass} />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="text-slate-300 font-bold mb-2">Cliente (obligatorio en la factura)</legend>
          <div>
            <label className="text-slate-400 block mb-1">Nombre o razón social</label>
            <input value={cliente.clienteNombre || ''} onChange={setC('clienteNombre')} className={inputClass} required maxLength={120} />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">NIF</label>
            <input value={cliente.clienteNif || ''} onChange={setC('clienteNif')} className={`${inputClass} font-mono uppercase`} required />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Tipo de cliente</label>
            <select value={cliente.clienteTipo || 'particular'} onChange={setC('clienteTipo')} className={inputClass}>
              <option value="particular">Particular (persona que no actúa como empresa)</option>
              <option value="comunidad">Comunidad de propietarios</option>
              <option value="empresa">Empresa, autónomo o promotor profesional</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Domicilio</label>
            <input value={cliente.clienteDireccion || ''} onChange={setC('clienteDireccion')} className={inputClass} required />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Código postal</label>
            <input value={cliente.clienteCodigoPostal || ''} onChange={setC('clienteCodigoPostal')} className={inputClass} inputMode="numeric" maxLength={5} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">Municipio</label>
              <input value={cliente.clienteMunicipio || ''} onChange={setC('clienteMunicipio')} className={inputClass} />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Provincia</label>
              <input value={cliente.clienteProvincia || ''} onChange={setC('clienteProvincia')} className={inputClass} />
            </div>
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="text-slate-300 font-bold mb-2">Tipo de obra (decide el IVA)</legend>
          <div>
            <label className="text-slate-400 block mb-1">Obra</label>
            <select value={obra.tipoObra} onChange={setO('tipoObra')} className={inputClass}>
              <option value="reforma_vivienda">Reforma o reparación de vivienda</option>
              <option value="obra_nueva">Obra nueva (construcción)</option>
              <option value="rehabilitacion">Rehabilitación de edificio</option>
              <option value="otra">Otra (local, nave, mantenimiento…)</option>
            </select>
          </div>
          {esEmpresa && construccion && (
            <div>
              <label className="text-slate-400 block mb-1">El cliente es…</label>
              <select value={obra.relacion} onChange={setO('relacion')} className={inputClass}>
                <option value="promotor">El promotor o dueño de la obra</option>
                <option value="contratista">El contratista principal (yo subcontrato)</option>
              </select>
            </div>
          )}
          {construccion && (
            <label className="flex items-center gap-2 text-slate-300">
              <input type="checkbox" checked={Boolean(obra.destinoVivienda)} onChange={setO('destinoVivienda')} className="accent-emerald-500" />
              El edificio es principalmente de viviendas
            </label>
          )}
          {!esEmpresa && (obra.tipoObra === 'reforma_vivienda' || obra.tipoObra === 'rehabilitacion') && (
            <>
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" checked={Boolean(obra.usoParticular)} onChange={setO('usoParticular')} className="accent-emerald-500" />
                Vivienda de uso particular del cliente
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" checked={Boolean(obra.antiguedadMas2Anos)} onChange={setO('antiguedadMas2Anos')} className="accent-emerald-500" />
                Terminada o rehabilitada hace 2 años o más
              </label>
              <div>
                <label className="text-slate-400 block mb-1">Materiales que aportas (% de la base)</label>
                <input type="number" min="0" max="100" value={obra.materialesPct} onChange={setO('materialesPct')} className={inputClass} />
              </div>
            </>
          )}
        </fieldset>

        {fiscal && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
            <p className="text-white font-bold flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              {isp ? 'Inversión del sujeto pasivo (sin IVA en la factura)' : `IVA ${ivaPct} %`}
              {irpfPct > 0 && ` · retención IRPF ${irpfPct} %`}
            </p>
            {!manual && <p className="text-slate-400">{fiscal.motivo}</p>}
            {fiscal.avisos.map(a => <p key={a} className="text-amber-300">⚠ {a}</p>)}
            {fiscal.documentos.map(d => <p key={d} className="text-sky-300">Guarda: {d}</p>)}
            <details>
              <summary className="text-slate-400 cursor-pointer">Ajustar el IVA a mano</summary>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <select
                  value={manual ? (manual.isp ? 'isp' : String(manual.ivaPct)) : ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setManual(v === '' ? null : v === 'isp' ? { ivaPct: fiscal.ivaPct, isp: true } : { ivaPct: Number(v), isp: false });
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-1.5 text-white"
                >
                  <option value="">Lo que indica el asistente</option>
                  <option value="21">21 %</option>
                  <option value="10">10 %</option>
                  <option value="4">4 %</option>
                  {esEmpresa && <option value="isp">Inversión del sujeto pasivo</option>}
                </select>
              </div>
            </details>
          </div>
        )}

        <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/30 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div><span className="text-slate-400 block">Base</span><strong className="text-white">{eur(importes.base)} €</strong></div>
          <div><span className="text-slate-400 block">IVA</span><strong className="text-white">{eur(importes.cuota)} €</strong></div>
          <div><span className="text-slate-400 block">Retención</span><strong className="text-white">{importes.irpf ? `-${eur(importes.irpf)}` : '0,00'} €</strong></div>
          <div><span className="text-slate-400 block">Total a cobrar</span><strong className="text-emerald-400 text-base">{eur(importes.total)} €</strong></div>
        </div>

        <p className="text-[11px] text-slate-500">
          Al emitirla recibe número correlativo, huella VeriFactu y QR. Después no se puede cambiar ni borrar: se corrige con una rectificativa.
        </p>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs">Cancelar</button>
          <button type="submit" disabled={emitiendo || !pres || importes.base <= 0 || excede || yaFacturado} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20">
            {emitiendo ? 'Emitiendo…' : 'Emitir factura (VeriFactu)'}
          </button>
        </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6 self-start">
          <span className="text-slate-400 block mb-2 font-medium">Vista previa de la factura</span>
          <VistaPreviaFactura
            empresa={empresa}
            pres={pres}
            cliente={cliente}
            concepto={concepto}
            pct={pctMostrado}
            importes={importes}
            ivaPct={ivaPct}
            irpfPct={irpfPct}
            isp={isp}
            motivo={manual ? '' : fiscal?.motivo}
            fechaOperacion={fechaOperacion}
          />
        </aside>
      </form>
      </div>
    </ModalOverlay>
  );
}

/** Miniatura de la factura con los datos que se van a emitir (el número y el QR se asignan al emitir). */
function VistaPreviaFactura({ empresa, pres, cliente, concepto, pct, importes, ivaPct, irpfPct, isp, motivo, fechaOperacion }) {
  const pruebas = empresa?.verifactuEntorno !== 'produccion';
  const serie = String(empresa?.serieOrdinaria || 'F').toUpperCase();
  const hoy = new Date().toLocaleDateString('es-ES');
  const lugar = [empresa?.codigoPostal, empresa?.municipio, empresa?.provincia].filter(Boolean).join(' ');
  const lugarCliente = [cliente.clienteCodigoPostal, cliente.clienteMunicipio, cliente.clienteProvincia].filter(Boolean).join(' ');
  const falta = (v) => v || <span className="text-rose-600 font-semibold">falta</span>;

  return (
    <div className="theme-native bg-white text-slate-900 rounded-xl shadow-lg p-5 space-y-4 text-[11px] leading-snug">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-sm">{falta(empresa?.razonSocial)}</p>
          <p>NIF: {falta(empresa?.nif)}</p>
          <p>{falta(empresa?.domicilio)}</p>
          {lugar && <p>{lugar}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-sm text-emerald-700">FACTURA</p>
          {pruebas && <p className="text-rose-600 font-bold">PRUEBA · sin validez fiscal</p>}
          <p className="font-mono">{pruebas ? 'PRUEBA-' : ''}{serie}-{new Date().getFullYear()}-·····</p>
          <p>Fecha: {hoy}</p>
          {fechaOperacion && <p>Operación: {new Date(fechaOperacion).toLocaleDateString('es-ES')}</p>}
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
        <p className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Cliente</p>
        <p className="font-bold">{falta(cliente.clienteNombre)}</p>
        <p>NIF: {falta(cliente.clienteNif)}</p>
        <p>{falta(cliente.clienteDireccion)}</p>
        {lugarCliente && <p>{lugarCliente}</p>}
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-300 text-[10px] uppercase text-slate-500">
            <th className="text-left py-1">Concepto</th>
            <th className="text-right py-1">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 align-top">
            <td className="py-1.5 pr-2">
              <p className="font-semibold">{concepto}</p>
              <p className="text-slate-500">{pres ? `${pres.obraTitulo || ''} · ${pct} % del presupuesto ${pres.numero}` : 'Elige un presupuesto'}</p>
            </td>
            <td className="py-1.5 text-right font-mono whitespace-nowrap">{eur(importes.base)} €</td>
          </tr>
        </tbody>
      </table>

      <div className="ml-auto w-full sm:w-64 space-y-1">
        <div className="flex justify-between"><span>Base imponible</span><span className="font-mono">{eur(importes.base)} €</span></div>
        <div className="flex justify-between"><span>{isp ? 'IVA (inversión del sujeto pasivo)' : `IVA ${ivaPct} %`}</span><span className="font-mono">{eur(importes.cuota)} €</span></div>
        {importes.irpf > 0 && <div className="flex justify-between"><span>Retención IRPF {irpfPct} %</span><span className="font-mono">-{eur(importes.irpf)} €</span></div>}
        <div className="flex justify-between border-t border-slate-300 pt-1 font-black text-sm"><span>Total</span><span className="font-mono">{eur(importes.total)} €</span></div>
      </div>

      {(isp || motivo) && (
        <p className="text-[10px] text-slate-600 border-t border-slate-200 pt-2">
          {isp ? (empresa?.textoIsp || 'Operación con inversión del sujeto pasivo (art. 84.Uno.2º.f Ley 37/1992).') : motivo}
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-slate-200 pt-3">
        <div className="w-14 h-14 border-2 border-dashed border-slate-300 rounded flex items-center justify-center text-[9px] text-slate-400 text-center shrink-0">QR al emitir</div>
        <p className="text-[10px] text-slate-500">Factura verificable en la sede electrónica de la AEAT (VERI*FACTU). El número, la huella y el QR se asignan al emitir.</p>
      </div>
    </div>
  );
}
