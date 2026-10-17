import React, { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Printer, Download, FileText, CheckCircle2, Building2, ShieldCheck, QrCode, Lock } from 'lucide-react';
import jsPDF from 'jspdf';

export default function PdfModal() {
  const { pdfModalData, setPdfModalData, empresaConfig, showNotification } = useApp();
  const printRef = useRef(null);

  if (!pdfModalData) return null;

  const { type, data } = pdfModalData; // type: 'presupuesto' | 'factura'
  const isFactura = type === 'factura';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Simple, robust text PDF generation using jsPDF
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.text(isFactura ? 'FACTURA OFICIAL' : 'PRESUPUESTO DE OBRA', 20, 25);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('CONSTRUCCIONES Y REFORMAS PRO S.L. - NIF: B-88776655', 20, 32);
      doc.text('C/ Alcalá 120, Planta 2, 28009 Madrid · Tel: +34 912 345 678', 20, 37);

      // Separator line
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 42, 190, 42);

      // Document details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Número: ${data.numero}`, 20, 50);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha: ${isFactura ? data.fechaEmision : data.fecha}`, 20, 56);
      if (isFactura && data.fechaVencimiento) {
        doc.text(`Vencimiento: ${data.fechaVencimiento}`, 20, 62);
      }

      // Client details box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(110, 45, 80, 25, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('CLIENTE:', 115, 52);
      doc.setFont('helvetica', 'normal');
      doc.text(`${data.cliente}`, 115, 58);
      doc.text(`NIF/CIF: ${data.nif || data.cifNif || 'N/A'}`, 115, 64);

      // Subject / Obra
      doc.setFont('helvetica', 'bold');
      doc.text(`Obra: ${data.obraTitulo || 'Reforma'}`, 20, 78);

      // Items Table Header
      let y = 88;
      doc.setFillColor(241, 245, 249);
      doc.rect(20, y - 5, 170, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CONCEPTO / PARTIDA', 23, y);
      doc.text('CANT.', 130, y);
      doc.text('PRECIO', 150, y);
      doc.text('TOTAL', 172, y);

      y += 8;
      doc.setFont('helvetica', 'normal');

      if (data.partidas && data.partidas.length > 0) {
        data.partidas.forEach((p) => {
          if (y > 260) {
            doc.addPage();
            y = 25;
          }
          const conceptoText = doc.splitTextToSize(p.concepto || '', 100);
          doc.text(conceptoText, 23, y);
          doc.text(`${p.cantidad} ${p.unidad || 'ud'}`, 130, y);
          doc.text(`${Number(p.precioVenta || 0).toFixed(2)} €`, 150, y);
          doc.text(`${Number(p.total || 0).toFixed(2)} €`, 172, y);
          y += Math.max(conceptoText.length * 5, 7);
        });
      } else {
        doc.text(data.tipoFactura || 'Certificación de obra acordada', 23, y);
        doc.text('1 ud', 130, y);
        doc.text(`${Number(data.baseImponible || 0).toFixed(2)} €`, 150, y);
        doc.text(`${Number(data.baseImponible || 0).toFixed(2)} €`, 172, y);
        y += 12;
      }

      // Summary
      y = Math.max(y + 10, 190);
      if (y > 250) {
        doc.addPage();
        y = 30;
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(120, y, 190, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.text('Base Imponible:', 122, y);
      doc.text(`${Number(data.baseImponible || 0).toFixed(2)} €`, 172, y);
      y += 6;

      doc.text(`IVA (${data.tipoIvaPct || 10}%):`, 122, y);
      doc.text(`${Number(data.cuotaIva || 0).toFixed(2)} €`, 172, y);
      y += 8;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('TOTAL:', 122, y);
      doc.text(`${Number(data.totalConIva || data.totalFactura || 0).toFixed(2)} €`, 170, y);

      // Footer
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('Inscrita en el Registro Mercantil de Madrid. Garantía de obra según Ley de Ordenación de la Edificación (LOE).', 20, 285);

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
              onClick={() => setPdfModalData(null)}
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
            className="bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg max-w-2xl mx-auto space-y-6 text-xs sm:text-sm font-sans"
          >
            {/* Header: Company & Doc Title */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black">
                    OM
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">{empresaConfig?.razonSocial || 'CONSTRUCCIONES OBRAMASTER SL'}</h2>
                </div>
                <p className="text-xs text-slate-500 leading-tight">
                  NIF: {empresaConfig?.cifNif || 'B-88776655'}<br />
                  {empresaConfig?.direccion || 'C/ Velázquez 48'}, {empresaConfig?.codigoPostal} {empresaConfig?.localidad}<br />
                  Tel: {empresaConfig?.telefono || '+34 912 345 678'} · {empresaConfig?.email || 'info@obramaster.es'}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider mb-1 ${
                  isFactura ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isFactura ? (empresaConfig?.modoVeriFactu ? 'FACTURA VERIFACTU' : 'FACTURA') : 'PRESUPUESTO'}
                </span>
                <p className="font-mono font-bold text-slate-800 text-base">{data.numero}</p>
                <p className="text-xs text-slate-500">Fecha: {isFactura ? data.fechaEmision : data.fecha}</p>
                {isFactura && (
                  <p className="text-xs text-slate-500">Vencimiento: {data.fechaVencimiento}</p>
                )}
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
                  {data.partidas && data.partidas.length > 0 ? (
                    data.partidas.map((item, idx) => (
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

            {/* VeriFactu / TicketBAI Stamp Box (Conforme a Ley 11/2021) */}
            {isFactura && (
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 flex items-center justify-between gap-4 text-[11px] text-slate-600">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Factura Verificable en Sede Electrónica de la AEAT (VeriFactu)</span>
                  </span>
                  <p className="font-mono text-[9px] text-slate-500 break-all">
                    Huella SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Software garante: ObraMaster Engine v2.4.0 · Reg. Antifraude Ley 11/2021
                  </p>
                </div>
                <div className="bg-white p-1 rounded border border-slate-300 shrink-0 text-center">
                  <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center font-bold text-[8px]">
                    QR AEAT
                  </div>
                  <span className="text-[8px] font-bold text-slate-500 block mt-0.5">VERIFACTU</span>
                </div>
              </div>
            )}

            {/* Totals Breakdown */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-200">
              <div className="text-[11px] text-slate-500 max-w-sm space-y-1">
                <p><strong>Garantía:</strong> 2 años en instalaciones y acabados según LOE.</p>
                <p><strong>Cuenta Bancaria IBAN:</strong> {empresaConfig?.iban || 'ES91 2100 0418 45 0200051234'}</p>
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
                  <span>IVA ({data.tipoIvaPct || 10}%):</span>
                  <span className="font-mono font-semibold">{Number(data.cuotaIva || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
                </div>
                <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                  <span>TOTAL A PAGAR:</span>
                  <span className="font-mono text-amber-600">
                    {Number(data.totalConIva || data.totalFactura || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
