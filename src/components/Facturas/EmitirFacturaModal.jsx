import React, { useEffect, useMemo, useState } from 'react';
import { Receipt, AlertTriangle, FileCheck2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { calcularIvaObra, getObraFiscal, guardarObraFiscal } from '../../services/facturacionService';

const inputClass = 'w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-400';

const CERTIFICACIONES = [
  { pct: 40, texto: 'Certificación 1 (Anticipo 40% Inicio Obra)' },
  { pct: 40, texto: 'Certificación 2 (Avance 40% Tras Instalaciones)' },
  { pct: 20, texto: 'Certificación Final 20% (Fin de Obra y Llaves)' },
  { pct: 100, texto: 'Factura Ordinaria Completa 100%' }
];

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
  const { convertPresupuestoToFactura, facturacion } = useApp();
  const empresa = facturacion?.empresa;
  const [presId, setPresId] = useState(presupuestoInicial?.id || presupuestos[0]?.id || '');
  const pres = presupuestos.find(p => p.id === presId) || null;
  const [concepto, setConcepto] = useState(CERTIFICACIONES[0].texto);
  const [pct, setPct] = useState(40);
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
    const base = Math.round((Number(pres?.baseImponible || 0) * pct) / 100 * 100) / 100;
    const cuota = isp ? 0 : Math.round(base * ivaPct) / 100;
    const irpf = Math.round(base * irpfPct) / 100;
    return { base, cuota, irpf, total: base + cuota - irpf };
  }, [pres, pct, ivaPct, isp, irpfPct]);

  const setC = (field) => (e) => setCliente(c => ({ ...c, [field]: e.target.value }));
  const setO = (field) => (e) => setObra(o => ({ ...o, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pres || emitiendo) return;
    setEmitiendo(true);
    const motivo = manual ? `IVA fijado a mano: ${isp ? 'inversión del sujeto pasivo' : `${ivaPct} %`}.` : fiscal?.motivo || '';
    const factura = await convertPresupuestoToFactura(pres.id, concepto, Number(pct), {
      ...cliente,
      clienteTipo: cliente.clienteTipo === 'empresa' ? 'empresa' : 'particular',
      descripcion: `${concepto} · ${pres.obraTitulo || pres.numero}`,
      ivaPct,
      isp,
      irpfPct,
      ivaMotivo: motivo,
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 my-6 text-xs sm:text-sm">
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
                <option key={p.id} value={p.id}>{p.numero} - {p.obraTitulo} ({p.totalConIva?.toLocaleString('es-ES')} €)</option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <legend className="text-slate-300 font-bold mb-2">Qué se factura</legend>
          <div>
            <label className="text-slate-400 block mb-1">Concepto</label>
            <select
              value={concepto}
              onChange={(e) => {
                setConcepto(e.target.value);
                const c = CERTIFICACIONES.find(x => x.texto === e.target.value);
                if (c) setPct(c.pct);
              }}
              className={inputClass}
            >
              {CERTIFICACIONES.map(c => <option key={c.texto} value={c.texto}>{c.texto}</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Porcentaje del presupuesto (%)</label>
            <input type="number" min="1" max="100" step="0.01" value={pct} onChange={(e) => setPct(Math.min(Math.max(Number(e.target.value) || 0, 0), 100))} className={inputClass} />
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
          <button type="submit" disabled={emitiendo || !pres || importes.base <= 0} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20">
            {emitiendo ? 'Emitiendo…' : 'Emitir factura (VeriFactu)'}
          </button>
        </div>
      </form>
    </div>
  );
}
