import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Euro,
  FileText,
  Calendar,
  Building2,
  ArrowRight,
  Download,
  AlertCircle,
  ShieldCheck,
  QrCode,
  Lock,
  FileCode,
  Send
} from 'lucide-react';
import SendDocumentModal from '../Common/SendDocumentModal';

export default function FacturasList() {
  const {
    facturas,
    updateFacturaStatus,
    setPdfModalData,
    presupuestos,
    convertPresupuestoToFactura,
    rectificarFactura,
    showNotification,
    setActiveTab
  } = useApp();

  const [filterEstado, setFilterEstado] = useState('todas'); // todas, cobrada, pendiente
  const [filterTrimestre, setFilterTrimestre] = useState('todos'); // todos, 1T, 2T, 3T, 4T
  const [searchQuery, setSearchQuery] = useState('');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [facturaToSend, setFacturaToSend] = useState(null);
  const [selectedPresId, setSelectedPresId] = useState(presupuestos[0]?.id || '');
  const [certificacionTipo, setCertificacionTipo] = useState('Certificación 1 (Anticipo 40% Inicio Obra)');
  const [certificacionPct, setCertificacionPct] = useState(40);
  const [emitiendo, setEmitiendo] = useState(false);
  const [facturaARectificar, setFacturaARectificar] = useState(null);
  const [rectificacion, setRectificacion] = useState({ causa: '', diferenciaBase: '' });

  // Financial Stats
  const totalFacturado = facturas.reduce((s, f) => s + f.totalFactura, 0);
  const totalCobrado = facturas.filter(f => f.estadoCobro === 'cobrada').reduce((s, f) => s + f.totalFactura, 0);
  const totalPendiente = facturas.filter(f => f.estadoCobro === 'pendiente').reduce((s, f) => s + f.totalFactura, 0);
  const totalIvaRepercutido = facturas.reduce((s, f) => s + f.cuotaIva, 0);

  const filteredFacturas = facturas.filter(fac => {
    const matchesEstado = filterEstado === 'todas' || fac.estadoCobro === filterEstado;
    const matchesTrim = filterTrimestre === 'todos' || fac.trimestre === filterTrimestre;
    const matchesSearch =
      fac.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fac.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fac.obraTitulo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesEstado && matchesTrim && matchesSearch;
  });

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPresId || emitiendo) return;
    setEmitiendo(true);
    const factura = await convertPresupuestoToFactura(selectedPresId, certificacionTipo, Number(certificacionPct));
    setEmitiendo(false);
    if (factura) setShowConvertModal(false);
  };

  const handleRectificarSubmit = async (e) => {
    e.preventDefault();
    if (!facturaARectificar || emitiendo) return;
    const diferencia = Number(String(rectificacion.diferenciaBase).replace(',', '.'));
    if (!rectificacion.causa.trim() || !Number.isFinite(diferencia) || diferencia === 0) {
      showNotification('Indica la causa y la diferencia de base imponible (negativa para rebajar).', 'error');
      return;
    }
    setEmitiendo(true);
    const factura = await rectificarFactura(facturaARectificar.id, { causa: rectificacion.causa.trim(), baseImponible: diferencia });
    setEmitiendo(false);
    if (factura) {
      setFacturaARectificar(null);
      setRectificacion({ causa: '', diferenciaBase: '' });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-amber-400" />
            <span>Facturación y Certificaciones de Obra</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Gestión de facturas emitidas, anticipos, certificaciones periódicas por avance de fases y cobros
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConvertModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Emitir Factura desde Presupuesto</span>
          </button>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium block mb-1">Total Facturado</span>
          <span className="text-2xl font-black text-white">{totalFacturado.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
          <div className="mt-2 text-[11px] text-slate-500">{facturas.length} facturas emitidas</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium block mb-1">Total Cobrado</span>
          <span className="text-2xl font-black text-emerald-400">{totalCobrado.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
          <div className="mt-2 text-[11px] text-emerald-500 font-medium">En cuenta bancaria</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium block mb-1">Pendiente de Cobro</span>
          <span className="text-2xl font-black text-amber-400">{totalPendiente.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
          <div className="mt-2 text-[11px] text-amber-500 font-medium">Vencimiento a 15-30 días</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-sm">
          <span className="text-xs text-slate-400 font-medium block mb-1">IVA Repercutido (Gestoría)</span>
          <span className="text-2xl font-black text-blue-400">{totalIvaRepercutido.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
          <div className="mt-2 text-[11px] text-slate-400">Tipo medio: 10% reformas</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por factura, cliente u obra..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status filters */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'todas', label: 'Todas' },
              { id: 'pendiente', label: 'Pendientes' },
              { id: 'cobrada', label: 'Cobradas' }
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

          {/* Quarter selector */}
          <select
            value={filterTrimestre}
            onChange={(e) => setFilterTrimestre(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold"
          >
            <option value="todos">Todos los Trimestres</option>
            <option value="4T">4T 2026 (Oct-Dic)</option>
            <option value="3T">3T 2026 (Jul-Sep)</option>
            <option value="2T">2T 2026 (Abr-Jun)</option>
            <option value="1T">1T 2026 (Ene-Mar)</option>
          </select>
        </div>
      </div>

      {/* Facturas List */}
      <div className="space-y-3">
        {filteredFacturas.map((fac) => {
          const isCobrada = fac.estadoCobro === 'cobrada';

          return (
            <div
              key={fac.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                    {fac.numero}
                  </span>
                  <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                    {fac.trimestre}
                  </span>
                  {fac.tipoAeat && fac.tipoAeat !== 'F1' && (
                    <span className="text-[10px] font-bold text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                      Rectificativa {fac.tipoAeat}
                    </span>
                  )}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isCobrada ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {fac.estadoCobro}
                  </span>
                </div>

                <h3 className="font-bold text-white text-base">{fac.obraTitulo}</h3>
                <p className="text-xs text-slate-400">
                  Cliente: <strong className="text-slate-300">{fac.cliente}</strong> ({fac.cifNif}) · Concepto: <strong className="text-slate-300">{fac.tipoFactura}</strong>
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                  <span>Emisión: {fac.fechaEmision}</span>
                  <span>·</span>
                  <span>Vencimiento: {fac.fechaVencimiento}</span>
                  {fac.fechaCobro && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-400">Cobrado el: {fac.fechaCobro}</span>
                    </>
                  )}
                </div>
                {fac.huella && (
                  <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1" title={fac.huella}>
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    VeriFactu · huella {fac.huella.slice(0, 16)}…
                    {fac.rectificacionCausa && <span className="font-sans"> · Causa: {fac.rectificacionCausa}</span>}
                  </p>
                )}
              </div>

              {/* Amounts & Actions */}
              <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 shrink-0">
                <div className="text-left md:text-right">
                  <span className="text-xs text-slate-400 block">
                    {fac.cuotaRetencion ? `Total a cobrar (IVA ${fac.tipoIvaPct}%, IRPF ${fac.retencionIrpfPct}%)` : `Total con IVA (${fac.tipoIvaPct}%)`}
                  </span>
                  <span className="text-xl font-black text-white">{fac.totalFactura?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                  <span className="text-[11px] text-slate-500 block">Base: {fac.baseImponible?.toLocaleString('es-ES')} € · IVA: {fac.cuotaIva?.toLocaleString('es-ES')} €</span>
                </div>

                <div className="flex items-center gap-2">
                  {fac.legal && fac.tipoAeat === 'F1' && (
                    <button
                      onClick={() => setFacturaARectificar(fac)}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition"
                      title="Una factura emitida no se modifica: se corrige con una rectificativa"
                    >
                      Rectificar
                    </button>
                  )}

                  <button
                    onClick={() => setPdfModalData({ type: 'factura', data: fac })}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ver PDF</span>
                  </button>

                  <button
                    onClick={() => setFacturaToSend(fac)}
                    className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 transition active:scale-95"
                    title="Enviar factura oficial por Email y WhatsApp"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>

                  {!isCobrada ? (
                    <button
                      onClick={() => updateFacturaStatus(fac.id, 'cobrada', 'Transferencia bancaria')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow"
                    >
                      ✓ Marcar Cobrada
                    </button>
                  ) : (
                    <button
                      onClick={() => updateFacturaStatus(fac.id, 'pendiente')}
                      className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs"
                      title="Volver a pendiente"
                    >
                      Desmarcar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Emitir Factura desde Presupuesto */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <span>Emitir Factura de Obra</span>
              </h3>
              <button onClick={() => setShowConvertModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleConvertSubmit} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Seleccionar Presupuesto de Obra</label>
                <select
                  value={selectedPresId}
                  onChange={(e) => setSelectedPresId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-400"
                >
                  {presupuestos.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.numero} - {p.obraTitulo} ({p.totalConIva?.toLocaleString('es-ES')} €)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Tipo de Certificación</label>
                <select
                  value={certificacionTipo}
                  onChange={(e) => setCertificacionTipo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  <option value="Certificación 1 (Anticipo 40% Inicio Obra)">Certificación 1: Anticipo 40% (Inicio de obra)</option>
                  <option value="Certificación 2 (Avance 40% Tras Instalaciones)">Certificación 2: Avance 40% (Tras instalaciones y alicatado)</option>
                  <option value="Certificación Final 20% (Fin de Obra y Llaves)">Certificación 3: Final 20% (Entrega de llaves)</option>
                  <option value="Factura Ordinaria Completa 100%">Factura Ordinaria Completa (100%)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Porcentaje a Facturar</label>
                <div className="flex items-center gap-2">
                  {[20, 40, 50, 100].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setCertificacionPct(pct);
                        if (pct === 40) setCertificacionTipo('Certificación 1 (Anticipo 40% Inicio Obra)');
                        else if (pct === 20) setCertificacionTipo('Certificación Final 20% (Fin de Obra y Llaves)');
                        else if (pct === 100) setCertificacionTipo('Factura Ordinaria Completa 100%');
                      }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        certificacionPct === pct ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={emitiendo}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/20"
                >
                  {emitiendo ? 'Emitiendo…' : 'Emitir factura (VeriFactu)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Factura Rectificativa */}
      {facturaARectificar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleRectificarSubmit} className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 text-xs sm:text-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Rectificar {facturaARectificar.numero}</h3>
              <button type="button" onClick={() => setFacturaARectificar(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-slate-400">
              La factura original no cambia. Se emite una factura rectificativa por la diferencia, con su propia serie y registro VeriFactu.
              Base original: <strong className="text-slate-200">{facturaARectificar.baseImponible?.toLocaleString('es-ES')} €</strong>.
            </p>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Causa de la rectificación</label>
              <input
                value={rectificacion.causa}
                onChange={(e) => setRectificacion(r => ({ ...r, causa: e.target.value }))}
                placeholder="Ej.: error en la medición de la partida de alicatado"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Diferencia de base imponible (€, negativa para rebajar)</label>
              <input
                value={rectificacion.diferenciaBase}
                onChange={(e) => setRectificacion(r => ({ ...r, diferenciaBase: e.target.value }))}
                inputMode="decimal"
                placeholder="-150,00"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button type="button" onClick={() => setFacturaARectificar(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs">
                Cancelar
              </button>
              <button type="submit" disabled={emitiendo} className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs">
                {emitiendo ? 'Emitiendo…' : 'Emitir rectificativa'}
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
