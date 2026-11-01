import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Download,
  Mail,
  CheckCircle2,
  Plus,
  Send,
  PackageCheck
} from 'lucide-react';
import ModalOverlay from '../Common/ModalOverlay';
import CampoProveedor from '../Common/CampoProveedor';
import { OpcionesCrear, conCrear, useQuickCreate } from '../Common/QuickCreate';
import { AnimatePresence } from 'motion/react';
import { CATEGORIAS_GASTO } from '../../utils/gastosIngresosObra';

export default function GestoriaTrimestres() {
  const {
    facturas,
    facturasProveedores,
    addFacturaProveedor,
    obras = [],
    showNotification
  } = useApp();
  const { crear } = useQuickCreate();

  const [trimestreSeleccionado, setTrimestreSeleccionado] = useState('4T');
  const [activeTab, setActiveTab] = useState('resumen_fiscal'); // resumen_fiscal, facturas_emitidas, facturas_recibidas, enviar_email
  const [showAddGastoModal, setShowAddGastoModal] = useState(false);

  // New Gasto Form
  const [gastoForm, setGastoForm] = useState({
    proveedor: '',
    cif: '',
    numeroProveedor: '',
    concepto: '',
    categoria: 'Materiales', // ver CATEGORIAS_GASTO
    obraId: '',
    baseImponible: '',
    tipoIvaPct: 21,
    retencionIrpfPct: 0,
    fecha: new Date().toISOString().split('T')[0]
  });

  // Filter invoices for chosen quarter
  const facturasEmitidasTrim = facturas.filter(f => f.trimestre === trimestreSeleccionado);
  const facturasRecibidasTrim = facturasProveedores.filter(f => f.trimestre === trimestreSeleccionado);

  // Fiscal Calculations for chosen quarter
  // IVA Repercutido (Ventas)
  const baseVentas10 = facturasEmitidasTrim.filter(f => f.tipoIvaPct === 10).reduce((s, f) => s + f.baseImponible, 0);
  const cuotaIva10 = facturasEmitidasTrim.filter(f => f.tipoIvaPct === 10).reduce((s, f) => s + f.cuotaIva, 0);
  const baseVentas21 = facturasEmitidasTrim.filter(f => f.tipoIvaPct === 21).reduce((s, f) => s + f.baseImponible, 0);
  const cuotaIva21Ventas = facturasEmitidasTrim.filter(f => f.tipoIvaPct === 21).reduce((s, f) => s + f.cuotaIva, 0);
  const totalIvaRepercutido = cuotaIva10 + cuotaIva21Ventas;
  const totalBaseVentas = baseVentas10 + baseVentas21;

  // IVA Soportado (Compras y Gastos de Obra)
  const totalBaseCompras = facturasRecibidasTrim.reduce((s, f) => s + f.baseImponible, 0);
  const totalIvaSoportado = facturasRecibidasTrim.reduce((s, f) => s + f.cuotaIva, 0);

  // Modelo 303 Resultado
  const resultadoModelo303 = Number((totalIvaRepercutido - totalIvaSoportado).toFixed(2));

  // Modelo 130 (IRPF Estimación Directa)
  const rendimientoNetoTrim = Math.max(0, totalBaseVentas - totalBaseCompras);
  const pagoFraccionado130 = Number((rendimientoNetoTrim * 0.20).toFixed(2));

  // Modelo 111 (Retenciones)
  const totalRetencionesIrpf = facturasRecibidasTrim.reduce((s, f) => s + (f.cuotaRetencion || 0), 0);

  // Email Template
  const [emailTo, setEmailTo] = useState('asesoria.fiscal@gestoriamadrid.com');
  const [emailSubject, setEmailSubject] = useState(`Documentación Fiscal y Contable ${trimestreSeleccionado} 2026 - Construcciones ObraMaster SL`);
  const [emailSent, setEmailSent] = useState(false);

  const handleSaveGasto = (e) => {
    e.preventDefault();
    if (!gastoForm.proveedor || !gastoForm.baseImponible) return;

    const base = Number(gastoForm.baseImponible);
    const tipoIva = Number(gastoForm.tipoIvaPct);
    const cuotaIva = Number((base * (tipoIva / 100)).toFixed(2));
    const tipoRet = Number(gastoForm.retencionIrpfPct);
    const cuotaRet = Number((base * (tipoRet / 100)).toFixed(2));
    const total = Number((base + cuotaIva - cuotaRet).toFixed(2));

    addFacturaProveedor({
      proveedor: gastoForm.proveedor,
      cif: gastoForm.cif || 'B-99887766',
      numeroProveedor: gastoForm.numeroProveedor || `FAC-${Date.now().toString().slice(-4)}`,
      concepto: gastoForm.concepto,
      categoria: gastoForm.categoria,
      obraId: gastoForm.obraId || undefined,
      trimestre: trimestreSeleccionado,
      ano: 2026,
      fecha: gastoForm.fecha,
      baseImponible: base,
      tipoIvaPct: tipoIva,
      cuotaIva: cuotaIva,
      retencionIrpfPct: tipoRet,
      cuotaRetencion: cuotaRet,
      total: total
    });

    setShowAddGastoModal(false);
    setGastoForm({
      proveedor: '',
      cif: '',
      numeroProveedor: '',
      concepto: '',
      categoria: 'Materiales',
      obraId: '',
      baseImponible: '',
      tipoIvaPct: 21,
      retencionIrpfPct: 0,
      fecha: new Date().toISOString().split('T')[0]
    });
  };

  const handleDownloadCsv = () => {
    let csv = `LIBRO DE FACTURAS EMITIDAS - TRIMESTRE ${trimestreSeleccionado} 2026\n`;
    csv += 'Numero;Fecha;Cliente;CIF/NIF;Concepto;Base Imponible;IVA %;Cuota IVA;Total Factura\n';
    facturasEmitidasTrim.forEach(f => {
      csv += `${f.numero};${f.fechaEmision};"${f.cliente}";${f.cifNif};"${f.tipoFactura}";${f.baseImponible};${f.tipoIvaPct}%;${f.cuotaIva};${f.totalFactura}\n`;
    });

    csv += `\nLIBRO DE FACTURAS RECIBIDAS (GASTOS Y SUBCONTRATAS) - TRIMESTRE ${trimestreSeleccionado} 2026\n`;
    csv += 'Numero Proveedor;Fecha;Proveedor;CIF;Categoria;Concepto;Base Imponible;IVA %;Cuota IVA;Retencion IRPF;Total\n';
    facturasRecibidasTrim.forEach(f => {
      csv += `${f.numeroProveedor};${f.fecha};"${f.proveedor}";${f.cif};${f.categoria};"${f.concepto}";${f.baseImponible};${f.tipoIvaPct}%;${f.cuotaIva};${f.cuotaRetencion || 0};${f.total}\n`;
    });

    csv += `\nLIQUIDACION ESTIMADA MODELOS TRIBUTARIOS\n`;
    csv += `Modelo 303 (IVA Repercutido - Soportado);${resultadoModelo303} EUR\n`;
    csv += `Modelo 130 (Pago Fracc. IRPF 20%);${pagoFraccionado130} EUR\n`;
    csv += `Modelo 111 (Retenciones IRPF);${totalRetencionesIrpf} EUR\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Paquete_Gestoria_${trimestreSeleccionado}_2026_ObraMaster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification(`Paquete contable para la gestoría descargado (CSV compatible con Excel/A3).`);
  };

  const handleSendEmailGestor = (e) => {
    e.preventDefault();
    setEmailSent(true);
    setTimeout(() => {
      showNotification(`Documentación del ${trimestreSeleccionado} enviada correctamente a ${emailTo}.`);
    }, 600);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold text-slate-400">Trimestre</span>
        {/* Quarter Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          {['1T', '2T', '3T', '4T'].map(t => (
            <button
              key={t}
              onClick={() => { setTrimestreSeleccionado(t); setEmailSent(false); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                trimestreSeleccionado === t ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t} 2026
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Período Activo:</span>
          <span className="text-xs font-black text-white bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
            Trimestre {trimestreSeleccionado} (Ejercicio 2026)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddGastoModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Factura de Gasto / Proveedor</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Libros (Excel / CSV)</span>
          </button>

          <button
            onClick={() => setActiveTab('enviar_email')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-600/20"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Enviar Paquete a la Gestoría</span>
          </button>
        </div>
      </div>

      {/* Tabs Menu inside Gestoría */}
      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto pb-1">
        {[
          { id: 'resumen_fiscal', label: 'Modelos Tributarios (303, 130, 111)' },
          { id: 'facturas_emitidas', label: `Libro Facturas Emitidas (${facturasEmitidasTrim.length})` },
          { id: 'facturas_recibidas', label: `Libro Facturas Recibidas / Gastos (${facturasRecibidasTrim.length})` },
          { id: 'enviar_email', label: 'Enviar Email a la Gestoría' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-semibold transition border-b-2 whitespace-nowrap ${
              activeTab === t.id
                ? 'border-emerald-400 text-emerald-400 bg-slate-900/60 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: MODELOS TRIBUTARIOS */}
      {activeTab === 'resumen_fiscal' && (
        <div className="space-y-6">
          
          {/* Models Grid (303, 130, 111) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* MODELO 303: IVA */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">AEAT · TRIMESTRAL</span>
                  <h3 className="text-base font-extrabold text-white">Modelo 303 (IVA)</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-black text-xs">
                  IVA
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>IVA Repercutido (Ventas):</span>
                  <strong className="text-white font-mono">{totalIvaRepercutido.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong>
                </div>
                <div className="text-[11px] text-slate-500 pl-2">
                  • Base 10%: {baseVentas10.toLocaleString('es-ES')} € (Cuota: {cuotaIva10.toLocaleString('es-ES')} €)
                </div>

                <div className="flex justify-between items-center text-slate-300 pt-1">
                  <span>IVA Soportado (Compras):</span>
                  <strong className="text-white font-mono">{totalIvaSoportado.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong>
                </div>
                <div className="text-[11px] text-slate-500 pl-2">
                  • Base Gastos: {totalBaseCompras.toLocaleString('es-ES')} € (Materiales y Subcontratas)
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Resultado Modelo 303</span>
                    <span className="text-xs text-slate-300">{resultadoModelo303 >= 0 ? 'A ingresar en Hacienda' : 'A compensar'}</span>
                  </div>
                  <span className={`text-xl font-black font-mono ${resultadoModelo303 >= 0 ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {resultadoModelo303.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
            </div>

            {/* MODELO 130: IRPF AUTÓNOMOS */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">AEAT · PAGO A CUENTA</span>
                  <h3 className="text-base font-extrabold text-white">Modelo 130 (IRPF)</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black text-xs">
                  IRPF
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Casilla [01] Ingresos Computables:</span>
                  <strong className="text-white font-mono">{totalBaseVentas.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>Casilla [02] Gastos Deducibles:</span>
                  <strong className="text-white font-mono">{totalBaseCompras.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong>
                </div>

                <div className="flex justify-between items-center text-slate-300 pt-1">
                  <span>Casilla [03] Rendimiento Neto:</span>
                  <strong className="text-emerald-400 font-mono">{rendimientoNetoTrim.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Pago Fraccionado 20%</span>
                    <span className="text-xs text-slate-300">Casilla [04] Modelo 130</span>
                  </div>
                  <span className="text-xl font-black font-mono text-amber-400">
                    {pagoFraccionado130.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
            </div>

            {/* MODELO 111 / 115: RETENCIONES */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider block">AEAT · RETENCIONES</span>
                  <h3 className="text-base font-extrabold text-white">Modelo 111 / 115</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-black text-xs">
                  RET
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <p className="text-slate-400 leading-relaxed">
                  Retenciones practicadas sobre facturas recibidas de alquiler de naves/oficinas (19%) y profesionales independientes subcontratados.
                </p>

                <div className="flex justify-between items-center text-slate-300 pt-2">
                  <span>Facturas con retención:</span>
                  <strong className="text-white font-mono">{facturasRecibidasTrim.filter(f => f.retencionIrpfPct > 0).length} facturas</strong>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-blue-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total a Ingresar</span>
                    <span className="text-xs text-slate-300">Retenciones retenidas</span>
                  </div>
                  <span className="text-xl font-black font-mono text-blue-400">
                    {totalRetencionesIrpf.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Gestoria Checklist */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-sm">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-400" />
              <span>Checklist de Cierre Fiscal para el Asesor Contable</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Numeración Correlativa</strong>
                  <span className="text-slate-400">Todas las facturas emitidas tienen serie y fecha correlativa sin huecos.</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Diferenciación de Tipos de IVA</strong>
                  <span className="text-slate-400">Separado el 10% de reformas de viviendas del 21% de locales y gastos.</span>
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block">Gastos de Obra Imputados</strong>
                  <span className="text-slate-400">Cada albarán y factura de material está vinculado a su obra para cálculo de margen real.</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: LIBRO FACTURAS EMITIDAS */}
      {activeTab === 'facturas_emitidas' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Libro Registro de Facturas Expedidas (Ventas {trimestreSeleccionado} 2026)</h3>
            <span className="text-xs font-mono font-bold text-emerald-400">Total Base: {totalBaseVentas.toLocaleString('es-ES')} €</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Nº Factura</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">NIF/CIF</th>
                  <th className="py-2.5 px-3">Concepto</th>
                  <th className="py-2.5 px-3 text-right">Base</th>
                  <th className="py-2.5 px-3 text-right">IVA %</th>
                  <th className="py-2.5 px-3 text-right">Cuota IVA</th>
                  <th className="py-2.5 px-3 text-right">Total Factura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {facturasEmitidasTrim.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-bold text-amber-400">{f.numero}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{f.fechaEmision}</td>
                    <td className="py-2 px-3 font-medium text-white">{f.cliente}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{f.cifNif}</td>
                    <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{f.tipoFactura}</td>
                    <td className="py-2 px-3 text-right font-mono">{f.baseImponible?.toLocaleString('es-ES')} €</td>
                    <td className="py-2 px-3 text-right font-mono">{f.tipoIvaPct}%</td>
                    <td className="py-2 px-3 text-right font-mono text-blue-400">{f.cuotaIva?.toLocaleString('es-ES')} €</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-white">{f.totalFactura?.toLocaleString('es-ES')} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LIBRO FACTURAS RECIBIDAS / GASTOS */}
      {activeTab === 'facturas_recibidas' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm">Libro Registro de Facturas Recibidas (Gastos y Subcontratas {trimestreSeleccionado} 2026)</h3>
            <button
              onClick={() => setShowAddGastoModal(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 transition shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Factura Gasto</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Nº Factura Prov.</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Proveedor / Subcontrata</th>
                  <th className="py-2.5 px-3">CIF</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Concepto</th>
                  <th className="py-2.5 px-3 text-right">Base</th>
                  <th className="py-2.5 px-3 text-right">IVA %</th>
                  <th className="py-2.5 px-3 text-right">Cuota IVA</th>
                  <th className="py-2.5 px-3 text-right">Retención IRPF</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {facturasRecibidasTrim.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono font-medium text-slate-300">{g.numeroProveedor}</td>
                    <td className="py-2 px-3 whitespace-nowrap">{g.fecha}</td>
                    <td className="py-2 px-3 font-medium text-white">{g.proveedor}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{g.cif}</td>
                    <td className="py-2 px-3">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {g.categoria}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{g.concepto}</td>
                    <td className="py-2 px-3 text-right font-mono">{g.baseImponible?.toLocaleString('es-ES')} €</td>
                    <td className="py-2 px-3 text-right font-mono">{g.tipoIvaPct}%</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-400">{g.cuotaIva?.toLocaleString('es-ES')} €</td>
                    <td className="py-2 px-3 text-right font-mono text-rose-400">{g.cuotaRetencion ? `-${g.cuotaRetencion} €` : '-'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-white">{g.total?.toLocaleString('es-ES')} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ENVIAR EMAIL A LA GESTORÍA */}
      {activeTab === 'enviar_email' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5 max-w-3xl mx-auto">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-400" />
              <span>Enviar Cierre del Trimestre {trimestreSeleccionado} a la Asesoría</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Envía el resumen contable, libros de facturas emitidas y recibidas en formato digital para la presentación de los modelos 303 y 130.
            </p>
          </div>

          {emailSent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white">¡Documentación Enviada con Éxito!</h4>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Se ha remitido a <strong>{emailTo}</strong> el informe fiscal del {trimestreSeleccionado} 2026 junto con los libros de facturas y justificantes adjuntos.
              </p>
              <button
                onClick={() => setEmailSent(false)}
                className="mt-2 px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs hover:bg-slate-700 font-semibold"
              >
                Enviar Otro Mensaje
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendEmailGestor} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Email del Asesor / Gestoría</label>
                  <input
                    type="email"
                    required
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Asunto</label>
                  <input
                    type="text"
                    required
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Mensaje para el Gestor</label>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-sans text-xs text-slate-300 space-y-2">
                  <p>Estimado/a asesor/a,</p>
                  <p>
                    Adjunto la documentación contable y fiscal correspondiente al <strong>{trimestreSeleccionado} de 2026</strong> de Construcciones y Reformas ObraMaster SL (NIF: B-88776655).
                  </p>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                    <div>• Facturas Emitidas: {facturasEmitidasTrim.length} facturas (Base: {totalBaseVentas.toLocaleString('es-ES')} € · IVA: {totalIvaRepercutido.toLocaleString('es-ES')} €)</div>
                    <div>• Facturas Recibidas / Gastos: {facturasRecibidasTrim.length} facturas (Base: {totalBaseCompras.toLocaleString('es-ES')} € · IVA: {totalIvaSoportado.toLocaleString('es-ES')} €)</div>
                    <div>• Resultado Estimado Mod. 303: <strong>{resultadoModelo303.toLocaleString('es-ES')} €</strong></div>
                    <div>• Pago a Cuenta Estimado Mod. 130: <strong>{pagoFraccionado130.toLocaleString('es-ES')} €</strong></div>
                  </div>
                  <p>Quedo a la espera de la confirmación de los borradores para su domiciliación bancaria antes del día 20.</p>
                  <p>Un cordial saludo,<br />Manuel · Dpto. de Administración</p>
                </div>
              </div>

              {/* Attachments preview */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Archivos adjuntos generados:</span>
                <span className="text-amber-400 font-mono font-medium">
                  📎 Libro_Ventas_{trimestreSeleccionado}.csv · 📎 Libro_Gastos_{trimestreSeleccionado}.csv
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar Paquete por Email</span>
                </button>
              </div>
            </form>
          )}

        </div>
      )}

      {/* Modal Añadir Factura Gasto */}
      <AnimatePresence>
      {showAddGastoModal && (
        <ModalOverlay className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Registrar Factura de Proveedor o Subcontrata</span>
              </h3>
              <button aria-label="Cerrar" onClick={() => setShowAddGastoModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveGasto} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="text-slate-400 block mb-1">Nombre Proveedor / Subcontrata *</label>
                <CampoProveedor
                  required
                  placeholder="Ej: Obramat, Saltoki, ElectroSur..."
                  value={gastoForm.proveedor}
                  onChange={(v) => setGastoForm((f) => ({ ...f, proveedor: v }))}
                  onElegir={({ proveedor, cif }) => setGastoForm((f) => ({ ...f, proveedor, cif: cif || f.cif }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">NIF / CIF</label>
                  <input
                    type="text"
                    placeholder="B82334455"
                    value={gastoForm.cif}
                    onChange={(e) => setGastoForm({ ...gastoForm, cif: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nº Factura Proveedor</label>
                  <input
                    type="text"
                    placeholder="OBM-2026-99"
                    value={gastoForm.numeroProveedor}
                    onChange={(e) => setGastoForm({ ...gastoForm, numeroProveedor: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Categoría</label>
                <select
                  value={gastoForm.categoria}
                  onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                >
                  {CATEGORIAS_GASTO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Obra (para el control de gastos de la obra)</label>
                <select
                  value={gastoForm.obraId}
                  onChange={conCrear(crear, (v) => setGastoForm((f) => ({ ...f, obraId: v })))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                >
                  <option value="">Gasto general (sin obra)</option>
                  {obras.map((o) => <option key={o.id} value={o.id}>{o.codigo ? `${o.codigo} · ` : ''}{o.titulo}</option>)}
                  <OpcionesCrear tipos={['obra']} />
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Concepto Detallado</label>
                <input
                  type="text"
                  placeholder="Ej: Cemento, placas de pladur, perfiles..."
                  value={gastoForm.concepto}
                  onChange={(e) => setGastoForm({ ...gastoForm, concepto: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Base Imponible (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={gastoForm.baseImponible}
                    onChange={(e) => setGastoForm({ ...gastoForm, baseImponible: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tipo de IVA (%)</label>
                  <select
                    value={gastoForm.tipoIvaPct}
                    onChange={(e) => setGastoForm({ ...gastoForm, tipoIvaPct: Number(e.target.value) })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white"
                  >
                    <option value={21}>21% (General)</option>
                    <option value={10}>10% (Reducido)</option>
                    <option value={0}>0% (Exento)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddGastoModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs"
                >
                  Guardar Factura Gasto
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
      </AnimatePresence>

    </div>
  );
}
