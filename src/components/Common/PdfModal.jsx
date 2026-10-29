import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Printer, Download, FileText } from 'lucide-react';
import { describeDocument, buildDocumentPdf, documentQrDataUrl } from '../../utils/documentPdf';

const eur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PdfModal() {
  const { pdfModalData, setPdfModalData, empresaConfig, facturacion, facturas = [], showNotification } = useApp();
  const printRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // QR tributario de las facturas con registro VeriFactu.
  const qrUrl = pdfModalData?.data?.qrUrl || '';
  useEffect(() => {
    if (!qrUrl) {
      setQrDataUrl('');
      return undefined;
    }
    let cancelled = false;
    documentQrDataUrl(qrUrl).then((url) => { if (!cancelled) setQrDataUrl(url); });
    return () => { cancelled = true; };
  }, [qrUrl]);

  if (!pdfModalData) return null;

  const info = describeDocument({ type: pdfModalData.type, data: pdfModalData.data, empresaConfig, facturacion, facturas });
  const { type, data, isFactura, esRectificativa, tituloFactura, emisorNombre, emisorNif, emisorDireccion, textoIsp, textoRectificativa, dePrueba, textoIva, fechaOperacion, partidas } = info;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    try {
      const doc = buildDocumentPdf(info, { empresaConfig, qrDataUrl });
      doc.save(`${data.numero || 'documento'}.pdf`);
      showNotification(`Documento ${data.numero}.pdf descargado correctamente.`);
    } catch (err) {
      console.error(err);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        
        {/* Top Controls */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">
              Vista Previa: {isFactura ? 'Factura Oficial' : 'Presupuesto Detallado'} ({data.numero})
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="p-2 text-slate-950 bg-amber-500 hover:bg-amber-400 font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow"
              title="Descargar PDF"
            >
              <Download className="w-4 h-4" />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={() => setPdfModalData(null)} aria-label="Cerrar"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Body (Printable Paper Sheet) */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-950/40">
          <div
            ref={printRef}
            className="theme-native bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg max-w-2xl mx-auto space-y-6 text-xs sm:text-sm font-sans"
          >
            {/* Header: Company & Doc Title */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-6">
              <div>
                <div className="flex items-center gap-3 mb-1.5">
                  {empresaConfig?.logoUrl ? (
                    <img
                      src={empresaConfig.logoUrl}
                      alt="Logo Corporativo"
                      className="h-10 max-w-[140px] object-contain rounded"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black">
                      OM
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-black tracking-tight text-slate-900 leading-tight">
                      {empresaConfig?.nombreComercial || emisorNombre || 'CONSTRUCCIONES OBRAMASTER SL'}
                    </h2>
                    {empresaConfig?.nombreComercial && emisorNombre !== empresaConfig?.nombreComercial && (
                      <span className="text-[11px] text-slate-500 font-semibold block">{emisorNombre}</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-tight">
                  NIF: {emisorNif}<br />
                  {emisorDireccion}<br />
                  {[empresaConfig?.telefono && `Tel: ${empresaConfig.telefono}`, empresaConfig?.email].filter(Boolean).join(' · ')}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider mb-1 ${
                  isFactura ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isFactura ? tituloFactura : 'PRESUPUESTO'}
                </span>
                {(dePrueba || data.anulada) && (
                  <p className="text-[10px] font-black text-rose-600 uppercase">
                    {dePrueba ? 'Factura de prueba · sin validez fiscal' : ''}{dePrueba && data.anulada ? ' · ' : ''}{data.anulada ? 'Anulada' : ''}
                  </p>
                )}
                <p className="font-mono font-bold text-slate-800 text-base">{data.numero}</p>
                <p className="text-xs text-slate-500">Fecha: {isFactura ? data.fechaEmision : data.fecha}</p>
                {!isFactura && data.revisado && (
                  <p className="text-xs font-bold text-violet-700">
                    Revisado (Rev. {data.revisionNumero || 1}): {data.fechaRevision}
                    {data.pendienteNuevaAceptacion ? ' · Nueva aceptación' : data.fechaNuevaAceptacion ? ` · Aceptado de nuevo: ${data.fechaNuevaAceptacion}` : ''}
                  </p>
                )}
                {isFactura && (
                  <p className="text-xs text-slate-500">Vencimiento: {data.fechaVencimiento}</p>
                )}
                {fechaOperacion && <p className="text-xs text-slate-500">Fecha de la operación: {fechaOperacion}</p>}
              </div>
            </div>

            {/* Client and Obra Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Datos del Cliente</span>
                <h4 className="font-bold text-slate-900 text-sm">{data.cliente}</h4>
                <p className="text-xs text-slate-600">NIF/CIF: {data.nif || data.cifNif || 'N/A'}</p>
                <p className="text-xs text-slate-600">{data.direccion || 'Dirección de obra indicada'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Obra / Proyecto</span>
                <h4 className="font-bold text-slate-900 text-sm">{data.obraTitulo}</h4>
                <p className="text-xs text-slate-600">Forma de pago: {data.metodoPago || 'Transferencia bancaria'}</p>
                <p className="text-xs text-slate-600">{isFactura ? `Concepto: ${data.tipoFactura}` : `Validez: ${data.validezDias || 30} días`}</p>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Partida / Concepto</th>
                    <th className="py-2.5 px-3 text-center">Cant.</th>
                    <th className="py-2.5 px-3 text-right">Precio Ud.</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {partidas && partidas.length > 0 ? (
                    partidas.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-2 px-3">
                          <span className="font-mono font-semibold text-slate-500 text-[10px] mr-1.5">{item.codigo}</span>
                          <span className="font-medium text-slate-900">{item.concepto}</span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">
                          {item.cantidad} {item.unidad}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                          {Number(item.precioVenta || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {Number(item.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-900">{data.tipoFactura || 'Certificación de Obra'}</span>
                        <p className="text-slate-500 text-[11px] mt-0.5">Correspondiente a la obra: {data.obraTitulo}</p>
                      </td>
                      <td className="py-3 px-3 text-center">1 ud</td>
                      <td className="py-3 px-3 text-right font-mono">{Number(data.baseImponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{Number(data.baseImponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* QR tributario VeriFactu: solo si la factura se emitió con registro real */}
            {isFactura && qrUrl && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 flex items-center justify-between gap-4 text-[11px] text-slate-600">
                <div className="space-y-1 min-w-0">
                  <p className="font-bold text-slate-900">Factura verificable en la sede electrónica de la AEAT</p>
                  <p className="font-mono text-[9px] text-slate-500 break-all">Huella: {data.huella}</p>
                  {esRectificativa && <p className="text-[10px] text-slate-600">{textoRectificativa}</p>}
                  {data.anulada && <p className="text-[10px] font-bold text-rose-600">Anulada: {data.anulacionMotivo}</p>}
                </div>
                <div className="shrink-0 text-center">
                  <span className="text-[9px] text-slate-500 block">QR tributario:</span>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR tributario de la AEAT" className="w-[35mm] h-[35mm] max-w-[132px] max-h-[132px]" />
                  ) : (
                    <div className="w-24 h-24 bg-slate-100" />
                  )}
                  <span className="text-[10px] font-bold text-slate-700 block">VERI*FACTU</span>
                </div>
              </div>
            )}

            {/* Totals Breakdown */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-200">
              <div className="text-[11px] text-slate-500 max-w-sm space-y-1">
                {textoIsp && <p className="font-semibold text-slate-700">{textoIsp}</p>}
                {textoIva && <p className="text-slate-600">{textoIva}</p>}
                <p><strong>Garantía:</strong> 2 años en instalaciones y acabados según LOE.</p>
                {empresaConfig?.iban && <p><strong>Cuenta Bancaria IBAN:</strong> {empresaConfig.iban}</p>}
                {empresaConfig?.registroMercantil && (
                  <p className="text-[10px] text-slate-400">{empresaConfig.registroMercantil}</p>
                )}
              </div>

              <div className="w-full sm:w-64 space-y-1.5 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Base Imponible:</span>
                  <span className="font-mono font-semibold">{Number(data.baseImponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{data.isp ? 'IVA (inversión del sujeto pasivo):' : `IVA (${data.tipoIvaPct ?? 10}%):`}</span>
                  <span className="font-mono font-semibold">{eur(data.cuotaIva)} €</span>
                </div>
                {Boolean(data.cuotaRetencion) && (
                  <div className="flex justify-between text-slate-600">
                    <span>Retención IRPF ({data.retencionIrpfPct}%):</span>
                    <span className="font-mono font-semibold">-{eur(data.cuotaRetencion)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>TOTAL A PAGAR:</span>
                  <span className="font-mono text-amber-600">
                    {Number(data.totalConIva || data.totalFactura || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
            </div>

            {/* Director de Obra & Digital Signature Stamp */}
            <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-end justify-between gap-4 text-xs">
              <div className="text-[11px] text-slate-500 space-y-0.5">
                <p><strong>Emisión y Aprobación Técnica:</strong> {empresaConfig?.razonSocial}</p>
                <p>Conforme a la Ley 38/1999 de Ordenación de la Edificación (LOE) y Código Técnico CTE.</p>
              </div>

              <div className="text-center sm:text-right space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Firma y Sello del Director de Obra:</span>
                <div className="inline-block p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  {empresaConfig?.firmaUrl ? (
                    <img src={empresaConfig.firmaUrl} alt="Firma y Sello" className="h-14 max-w-[190px] object-contain mx-auto" />
                  ) : (
                    <div className="h-12 w-36 border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                      Sello Oficial
                    </div>
                  )}
                </div>
                <p className="font-bold text-slate-900 text-xs">{empresaConfig?.directorNombre || ''}</p>
                <p className="text-[10px] text-slate-500">{empresaConfig?.directorTitulacion || 'Arquitecto Técnico & Aparejador'} {empresaConfig?.directorColegiado && `· Col. ${empresaConfig.directorColegiado}`}</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
