import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Printer, Download, FileText } from 'lucide-react';
import { describeDocument, buildDocumentModel, buildDocumentPdf, loadDocumentAssets } from '../../utils/documentPdf';
import ModalOverlay from './ModalOverlay';
import DocumentSheet from './DocumentSheet';

export default function PdfModal() {
  const { pdfModalData, setPdfModalData, empresaConfig, facturacion, facturas = [], showNotification } = useApp();
  const [assets, setAssets] = useState({ logoDataUrl: '', firmaDataUrl: '', qrDataUrl: '' });

  const info = useMemo(
    () => (pdfModalData ? describeDocument({ type: pdfModalData.type, data: pdfModalData.data, empresaConfig, facturacion, facturas }) : null),
    [pdfModalData, empresaConfig, facturacion, facturas]
  );
  const model = useMemo(() => (info ? buildDocumentModel(info, empresaConfig) : null), [info, empresaConfig]);

  // Logotipo, firma y QR tributario (facturas con registro VeriFactu) preparados para el PDF.
  const qrUrl = pdfModalData?.data?.qrUrl || '';
  const logoUrl = model?.emisor.logoUrl || '';
  const firmaUrl = model?.emisor.firmaUrl || '';
  const conQr = Boolean(model?.qr);
  useEffect(() => {
    let cancelled = false;
    loadDocumentAssets({ emisor: { logoUrl, firmaUrl }, qr: conQr }, qrUrl).then((a) => { if (!cancelled) setAssets(a); });
    return () => { cancelled = true; };
  }, [logoUrl, firmaUrl, conQr, qrUrl]);

  if (!pdfModalData || !info || !model) return null;
  const { data, isFactura } = info;

  const crearPdf = () => buildDocumentPdf(info, { empresaConfig, ...assets });

  const handlePrint = () => {
    try {
      const doc = crearPdf();
      doc.autoPrint();
      const url = doc.output('bloburl');
      const win = window.open(url, '_blank');
      if (!win) window.print();
    } catch (err) {
      console.error(err);
      window.print();
    }
  };

  const handleDownloadPdf = () => {
    try {
      crearPdf().save(`${data.numero || 'documento'}.pdf`);
      showNotification(`Documento ${data.numero}.pdf descargado correctamente.`);
    } catch (err) {
      console.error(err);
      window.print();
    }
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]">

        <div className="bg-slate-950 px-4 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-amber-400 shrink-0" />
            <h3 className="font-bold text-white text-sm sm:text-base truncate">
              Vista previa: {isFactura ? 'Factura' : 'Presupuesto'} {data.numero}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-2 sm:p-6 bg-slate-950/40">
          <DocumentSheet model={model} assets={assets} huella={isFactura ? data.huella : ''} />
        </div>
      </div>
    </ModalOverlay>
  );
}
