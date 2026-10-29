import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Plus,
  Search,
  FileText,
  ShieldCheck,
  Send,
  FileDown,
  FileCode2,
  Ban,
  RefreshCw,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import SendDocumentModal from '../Common/SendDocumentModal';
import EmitirFacturaModal from './EmitirFacturaModal';
import { descargarFacturae, descargarLibroExpedidas, getResumenTrimestral } from '../../services/facturacionService';

const eur = (v) => Number(v || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TIPOS_RECTIFICATIVA = [
  { id: 'R1', texto: 'R1 · Error en la factura o cambio de precio (art. 80.Uno y Dos LIVA)' },
  { id: 'R4', texto: 'R4 · Otras causas' },
  { id: 'R2', texto: 'R2 · Cliente en concurso de acreedores (art. 80.Tres)' },
  { id: 'R3', texto: 'R3 · Crédito incobrable (art. 80.Cuatro)' }
];

const ESTADO_AEAT = {
  pendiente: { texto: 'Pendiente de envío a la AEAT', clase: 'text-slate-300 bg-slate-700/40 border-slate-600' },
  aceptado: { texto: 'Registrada en la AEAT', clase: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  aceptado_con_errores: { texto: 'Aceptada con errores', clase: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  rechazado: { texto: 'Rechazada por la AEAT', clase: 'text-rose-300 bg-rose-500/10 border-rose-500/30' }
};

/** Importe que cuenta en los totales: anuladas no suman; una sustitución suma la diferencia. */
function totalEfectivo(f) {
  if (f.anulada) return 0;
  if (f.tipoRectificativa === 'S') return f.totalFactura - (Number(f.baseRectificada || 0) + Number(f.cuotaRectificada || 0));
  return f.totalFactura;
}

export default function FacturasList() {
  const {
    facturas,
    updateFacturaStatus,
    setPdfModalData,
    presupuestos,
    rectificarFactura,
    anularFactura,
    subsanarFactura,
    facturacion,
    showNotification
  } = useApp();
  const empresa = facturacion?.empresa;
  const enPruebas = empresa?.verifactuEntorno !== 'produccion';

  const hoy = new Date();
  const [filterEstado, setFilterEstado] = useState('todas'); // todas, cobrada, pendiente, problemas
  const [filterPeriodo, setFilterPeriodo] = useState('todos'); // todos | 2027-1T ...
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmitir, setShowEmitir] = useState(false);
  const [facturaToSend, setFacturaToSend] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [facturaARectificar, setFacturaARectificar] = useState(null);
  const [rectificacion, setRectificacion] = useState({ tipo: 'R1', modo: 'diferencias', causa: '', importe: '' });
  const [facturaAAnular, setFacturaAAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [resumen, setResumen] = useState(null);

  const periodos = useMemo(() => {
    const set = new Set(facturas.map(f => `${f.ano}-${f.trimestre}`));
    set.add(`${hoy.getFullYear()}-${Math.ceil((hoy.getMonth() + 1) / 3)}T`);
    return [...set].sort().reverse();
  }, [facturas]); // eslint-disable-line react-hooks/exhaustive-deps

  const vivas = facturas.filter(f => !f.anulada);
  const totalFacturado = facturas.reduce((s, f) => s + totalEfectivo(f), 0);
  const totalCobrado = vivas.filter(f => f.estadoCobro === 'cobrada').reduce((s, f) => s + totalEfectivo(f), 0);
  const totalPendiente = vivas.filter(f => f.estadoCobro === 'pendiente').reduce((s, f) => s + totalEfectivo(f), 0);
  const conProblemas = facturas.filter(f => ['rechazado', 'aceptado_con_errores'].includes(f.aeat?.estado));
  const registradas = facturas.filter(f => f.aeat?.estado === 'aceptado').length;
  const sinEnviar = facturas.filter(f => f.aeat?.estado === 'pendiente').length;

  const q = searchQuery.toLowerCase();
  const filteredFacturas = facturas.filter(fac => {
    const matchesEstado = filterEstado === 'todas'
      || (filterEstado === 'problemas' ? conProblemas.includes(fac) : fac.estadoCobro === filterEstado && !fac.anulada);
    const matchesPeriodo = filterPeriodo === 'todos' || `${fac.ano}-${fac.trimestre}` === filterPeriodo;
    const matchesSearch = [fac.numero, fac.cliente, fac.obraTitulo, fac.cifNif].some(t => String(t || '').toLowerCase().includes(q));
    return matchesEstado && matchesPeriodo && matchesSearch;
  });

  const periodoSeleccionado = () => {
    const [ano, trimestre] = (filterPeriodo === 'todos' ? periodos[0] : filterPeriodo).split('-');
    return { ano, trimestre };
  };

  const handleLibro = async () => {
    const { ano, trimestre } = periodoSeleccionado();
    const r = await descargarLibroExpedidas(ano, filterPeriodo === 'todos' ? '' : trimestre);
    if (!r.ok) showNotification(r.error, 'error');
  };

  const handleResumen = async () => {
    const { ano, trimestre } = periodoSeleccionado();
    const r = await getResumenTrimestral(ano, trimestre);
    if (!r.ok) {
      showNotification(r.error, 'error');
      return;
    }
    setResumen(r.data);
  };

  const handleFacturae = async (fac) => {
    const r = await descargarFacturae(fac.id);
    if (!r.ok) showNotification(r.error, 'error');
  };

  const handleRectificarSubmit = async (e) => {
    e.preventDefault();
    if (!facturaARectificar || trabajando) return;
    const texto = String(rectificacion.importe).trim();
    const importe = Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);
    const sustitucion = rectificacion.modo === 'sustitucion';
    if (!rectificacion.causa.trim() || !Number.isFinite(importe) || (sustitucion ? importe < 0 : importe === 0)) {
      showNotification(sustitucion
        ? 'Indica la causa y la base imponible correcta completa.'
        : 'Indica la causa y la diferencia de base imponible (negativa para rebajar).', 'error');
      return;
    }
    setTrabajando(true);
    const factura = await rectificarFactura(facturaARectificar.id, {
      tipo: rectificacion.tipo,
      modo: rectificacion.modo,
      causa: rectificacion.causa.trim(),
      baseImponible: importe
    });
    setTrabajando(false);
    if (factura) {
      setFacturaARectificar(null);
      setRectificacion({ tipo: 'R1', modo: 'diferencias', causa: '', importe: '' });
    }
  };

  const handleAnularSubmit = async (e) => {
    e.preventDefault();
    if (!facturaAAnular || trabajando || !motivoAnulacion.trim()) return;
    setTrabajando(true);
    const factura = await anularFactura(facturaAAnular.id, motivoAnulacion.trim());
    setTrabajando(false);
    if (factura) {
      setFacturaAAnular(null);
      setMotivoAnulacion('');
    }
  };

  const handleSubsanar = async (fac) => {
    if (trabajando) return;
    setTrabajando(true);
    await subsanarFactura(fac.id);
    setTrabajando(false);
  };

  return (
    <div className="space-y-6">
      {enPruebas && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Entorno de pruebas: estas facturas llevan el prefijo PRUEBA- y no tienen validez fiscal.
            El paso a producción se hace en Ajustes &gt; Facturación cuando el envío a la AEAT esté probado.
          </span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={handleResumen}
          className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
          title="Bases y cuotas del trimestre para el modelo 303"
        >
          <BarChart3 className="w-4 h-4" />
          <span>Resumen del trimestre</span>
        </button>
        <button
          onClick={handleLibro}
          className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
          title="Libro registro de facturas expedidas en CSV, para la gestoría o el programa de contabilidad"
        >
          <FileDown className="w-4 h-4" />
          <span>Libro registro (CSV)</span>
        </button>
        <button
          onClick={() => setShowEmitir(true)}
          disabled={!presupuestos.length}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-emerald-600/20 active:scale-95"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Emitir factura desde presupuesto</span>
        </button>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium block mb-1">Total facturado</span>
          <span className="text-2xl font-black text-white">{eur(totalFacturado)} €</span>
          <div className="mt-2 text-[11px] text-slate-500">{vivas.length} facturas vigentes{facturas.length > vivas.length ? ` · ${facturas.length - vivas.length} anuladas` : ''}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium block mb-1">Total cobrado</span>
          <span className="text-2xl font-black text-emerald-400">{eur(totalCobrado)} €</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium block mb-1">Pendiente de cobro</span>
          <span className="text-2xl font-black text-amber-400">{eur(totalPendiente)} €</span>
        </div>
        <button
          type="button"
          onClick={() => setFilterEstado(conProblemas.length ? 'problemas' : 'todas')}
          className="text-left bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm"
        >
          <span className="text-xs text-slate-400 font-medium block mb-1">Registro en la AEAT</span>
          <span className={`text-2xl font-black ${conProblemas.length ? 'text-rose-400' : 'text-emerald-400'}`}>
            {conProblemas.length ? `${conProblemas.length} con problemas` : 'Todo correcto'}
          </span>
          <div className="mt-1 text-xs text-slate-300">
            {registradas} registradas{sinEnviar ? ` · ${sinEnviar} sin enviar` : ''}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {empresa?.envioAeatActivo ? 'Envío automático activado' : 'Envío a la AEAT desactivado (Ajustes > Facturación)'}
          </div>
        </button>
      </div>

      {resumen && (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-2xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">
              IVA repercutido {resumen.periodo.trimestre || ''} {resumen.periodo.ejercicio}
              {resumen.entorno !== 'produccion' && ' (pruebas)'}
            </h3>
            <button aria-label="Cerrar" onClick={() => setResumen(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <table className="w-full text-left">
            <thead className="text-slate-400"><tr><th className="py-1">Tipo</th><th className="text-right">Base</th><th className="text-right">Cuota</th></tr></thead>
            <tbody className="text-slate-200">
              {resumen.resumen.tipos.map(t => (
                <tr key={t.tipoPct}><td className="py-1">{t.tipoPct} %</td><td className="text-right">{eur(t.base)} €</td><td className="text-right">{eur(t.cuota)} €</td></tr>
              ))}
              <tr className="font-bold border-t border-slate-800"><td className="py-1">Total</td><td className="text-right">{eur(resumen.resumen.totalBase)} €</td><td className="text-right">{eur(resumen.resumen.totalCuota)} €</td></tr>
            </tbody>
          </table>
          <p className="text-slate-400">
            Con inversión del sujeto pasivo (sin cuota): {eur(resumen.resumen.baseInversionSujetoPasivo)} € ·
            Retenciones de IRPF que te han practicado: {eur(resumen.resumen.retencionesIrpf)} € ·
            {` ${resumen.resumen.facturas} facturas`}{resumen.resumen.anuladas ? `, ${resumen.resumen.anuladas} anuladas (no suman)` : ''}.
          </p>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por factura, cliente, NIF u obra..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'todas', label: 'Todas' },
              { id: 'pendiente', label: 'Pendientes' },
              { id: 'cobrada', label: 'Cobradas' },
              ...(conProblemas.length ? [{ id: 'problemas', label: 'Con problemas' }] : [])
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterEstado(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterEstado === f.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <select
            value={filterPeriodo}
            onChange={(e) => setFilterPeriodo(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold"
            aria-label="Trimestre"
          >
            <option value="todos">Todos los trimestres</option>
            {periodos.map(p => {
              const [ano, t] = p.split('-');
              return <option key={p} value={p}>{t} {ano}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Facturas List */}
      <div className="space-y-3">
        {filteredFacturas.length === 0 && (
          <p className="text-center text-xs text-slate-500 py-8">No hay facturas con estos filtros.</p>
        )}
        {filteredFacturas.map((fac) => {
          const isCobrada = fac.estadoCobro === 'cobrada';
          const estadoAeat = fac.aeat ? ESTADO_AEAT[fac.aeat.estado] : null;
          const puedeSubsanar = !fac.anulada && fac.aeat?.operacion === 'alta' && ['rechazado', 'aceptado_con_errores'].includes(fac.aeat?.estado);

          return (
            <div
              key={fac.id}
              className={`bg-slate-900 border p-5 rounded-2xl shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                fac.anulada ? 'border-slate-800 opacity-70' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                    {fac.numero}
                  </span>
                  <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">{fac.trimestre}</span>
                  {fac.tipoAeat && fac.tipoAeat !== 'F1' && (
                    <span className="text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                      Rectificativa {fac.tipoAeat} {fac.tipoRectificativa === 'S' ? '(sustitución)' : '(diferencias)'}
                    </span>
                  )}
                  {fac.anulada ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-700 text-slate-200 border border-slate-600">
                      Anulada
                    </span>
                  ) : (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isCobrada ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {fac.estadoCobro}
                    </span>
                  )}
                  {estadoAeat && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${estadoAeat.clase}`} title={fac.aeat.csv ? `CSV de la AEAT: ${fac.aeat.csv}` : undefined}>
                      {fac.aeat.operacion === 'anulacion' ? 'Anulación: ' : ''}{estadoAeat.texto}
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-white text-base">{fac.obraTitulo}</h3>
                <p className="text-xs text-slate-400">
                  Cliente: <strong className="text-slate-300">{fac.cliente}</strong> ({fac.cifNif})
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                  <span>Emisión: {fac.fechaEmision}</span>
                  {fac.fechaVencimiento && <><span>·</span><span>Vencimiento: {fac.fechaVencimiento}</span></>}
                  {fac.fechaCobro && <><span>·</span><span className="text-emerald-400">Cobrado el: {fac.fechaCobro}</span></>}
                </div>
                {fac.anulada && fac.anulacionMotivo && (
                  <p className="text-[11px] text-slate-400">Motivo de la anulación: {fac.anulacionMotivo}</p>
                )}
                {fac.aeat?.error && ['rechazado', 'aceptado_con_errores'].includes(fac.aeat.estado) && (
                  <p className="text-[11px] text-rose-300">
                    AEAT{fac.aeat.codigoError ? ` (${fac.aeat.codigoError})` : ''}: {fac.aeat.error}
                  </p>
                )}
                {fac.huella && (
                  <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1" title={fac.huella}>
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    VeriFactu · huella {fac.huella.slice(0, 16)}…
                    {fac.rectificacionCausa && <span className="font-sans"> · Causa: {fac.rectificacionCausa}</span>}
                  </p>
                )}
              </div>

              {/* Amounts & Actions */}
              <div className="flex flex-col items-start md:items-end justify-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 md:max-w-md">
                <div className="text-left md:text-right">
                  <span className="text-xs text-slate-400 block">
                    {fac.isp ? 'Inversión del sujeto pasivo' : `IVA ${fac.tipoIvaPct}%`}{fac.cuotaRetencion ? ` · IRPF ${fac.retencionIrpfPct}%` : ''}
                  </span>
                  <span className={`text-xl font-black ${fac.anulada ? 'text-slate-500 line-through' : 'text-white'}`}>{eur(fac.totalFactura)} €</span>
                  <span className="text-[11px] text-slate-500 block">Base: {eur(fac.baseImponible)} € · IVA: {eur(fac.cuotaIva)} €</span>
                </div>

                <div className="flex flex-wrap items-center md:justify-end gap-2">
                  {puedeSubsanar && (
                    <button
                      onClick={() => handleSubsanar(fac)}
                      disabled={trabajando}
                      className="px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-xl text-xs font-semibold flex items-center gap-1"
                      title="Genera un nuevo registro (subsanación) y lo envía en el próximo lote"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Volver a enviar</span>
                    </button>
                  )}
                  {!fac.anulada && (
                    <button
                      onClick={() => setFacturaARectificar(fac)}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition"
                      title="Una factura emitida no se modifica: se corrige con una rectificativa"
                    >
                      Rectificar
                    </button>
                  )}
                  {!fac.anulada && (
                    <button
                      onClick={() => setFacturaAAnular(fac)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1"
                      title="Solo si la factura no debió emitirse (duplicada, cliente equivocado…)"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Anular</span>
                    </button>
                  )}

                  <button
                    onClick={() => setPdfModalData({ type: 'factura', data: fac })}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                  {!fac.anulada && (
                    <button
                      onClick={() => handleFacturae(fac)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1"
                      title="Factura electrónica Facturae 3.2.2 (XML) para FACe o clientes que la pidan"
                    >
                      <FileCode2 className="w-3.5 h-3.5" />
                      <span>Facturae</span>
                    </button>
                  )}

                  <button
                    onClick={() => setFacturaToSend(fac)}
                    className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95"
                    title="Enviar factura por email o WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar al cliente</span>
                  </button>

                  {!fac.anulada && (!isCobrada ? (
                    <button
                      onClick={() => updateFacturaStatus(fac.id, 'cobrada', 'Transferencia bancaria')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow"
                    >
                      ✓ Marcar cobrada
                    </button>
                  ) : (
                    <button
                      onClick={() => updateFacturaStatus(fac.id, 'pendiente')}
                      className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs"
                      title="Volver a pendiente"
                    >
                      Desmarcar
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showEmitir && (
        <EmitirFacturaModal
          presupuestos={presupuestos}
          onClose={() => setShowEmitir(false)}
          onEmitida={() => setShowEmitir(false)}
        />
      )}

      {/* Modal Factura Rectificativa */}
      {facturaARectificar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleRectificarSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Rectificar {facturaARectificar.numero}</h3>
              <button aria-label="Cerrar" type="button" onClick={() => setFacturaARectificar(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-slate-400">
              La factura original no cambia. Se emite una factura rectificativa con su propia serie y registro VeriFactu.
              Base original: <strong className="text-slate-200">{eur(facturaARectificar.baseImponible)} €</strong>.
            </p>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Motivo legal</label>
              <select
                value={rectificacion.tipo}
                onChange={(e) => setRectificacion(r => ({ ...r, tipo: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
              >
                {TIPOS_RECTIFICATIVA.map(t => <option key={t.id} value={t.id}>{t.texto}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'diferencias', titulo: 'Por diferencias', texto: 'Solo la diferencia (p. ej. -150 €)' },
                { id: 'sustitucion', titulo: 'Por sustitución', texto: 'La factura correcta completa' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setRectificacion(r => ({ ...r, modo: m.id }))}
                  className={`text-left p-2.5 rounded-xl border ${rectificacion.modo === m.id ? 'border-rose-400 bg-rose-500/10 text-white' : 'border-slate-700 bg-slate-800 text-slate-300'}`}
                >
                  <span className="font-bold block">{m.titulo}</span>
                  <span className="text-[11px] text-slate-400">{m.texto}</span>
                </button>
              ))}
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Causa de la rectificación</label>
              <input
                value={rectificacion.causa}
                onChange={(e) => setRectificacion(r => ({ ...r, causa: e.target.value }))}
                placeholder="Ej.: error en la medición de la partida de alicatado"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                maxLength={500}
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">
                {rectificacion.modo === 'sustitucion' ? 'Base imponible correcta (€)' : 'Diferencia de base imponible (€, negativa para rebajar)'}
              </label>
              <input
                value={rectificacion.importe}
                onChange={(e) => setRectificacion(r => ({ ...r, importe: e.target.value }))}
                inputMode="decimal"
                placeholder={rectificacion.modo === 'sustitucion' ? '850,00' : '-150,00'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setFacturaARectificar(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs">
                Cancelar
              </button>
              <button type="submit" disabled={trabajando} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs">
                {trabajando ? 'Emitiendo…' : 'Emitir rectificativa'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Anular */}
      {facturaAAnular && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAnularSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Anular {facturaAAnular.numero}</h3>
              <button aria-label="Cerrar" type="button" onClick={() => setFacturaAAnular(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Anula solo una factura que <strong>no debió emitirse</strong> (duplicada, cliente equivocado, emitida por error).
                Si la operación existió y hay que cambiar importes o datos, usa <strong>Rectificar</strong>.
                La factura y su número se conservan marcados como anulados y se envía un registro de anulación a la AEAT. No se puede deshacer.
              </span>
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Motivo</label>
              <input
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Ej.: factura duplicada por error"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                maxLength={500}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setFacturaAAnular(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs">
                Cancelar
              </button>
              <button type="submit" disabled={trabajando || !motivoAnulacion.trim()} className="px-5 py-2 bg-slate-200 hover:bg-white disabled:opacity-60 text-slate-900 font-bold rounded-xl text-xs">
                {trabajando ? 'Anulando…' : 'Anular factura'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Enviar Factura por Email / WhatsApp */}
      <SendDocumentModal
        isOpen={!!facturaToSend}
        onClose={() => setFacturaToSend(null)}
        document={facturaToSend}
        documentType="factura"
      />
    </div>
  );
}
