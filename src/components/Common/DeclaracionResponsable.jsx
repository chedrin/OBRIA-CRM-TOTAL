import React, { useEffect, useState } from 'react';
import { FileSignature, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import { getDeclaracionResponsable } from '../../services/facturacionService';

/** PDF de la declaración responsable: título y datos a) a l), cada uno con su texto descriptivo. */
export function descargarDeclaracionPdf(d) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const ancho = 170;
  let y = 22;
  const escribir = (texto, { tam = 10, negrita = false, sep = 2 } = {}) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(tam);
    for (const linea of doc.splitTextToSize(String(texto || ''), ancho)) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(linea, 20, y);
      y += tam * 0.45;
    }
    y += sep;
  };
  escribir(d.titulo, { tam: 13, negrita: true, sep: 6 });
  for (const c of d.campos) {
    escribir(`${c.letra}) ${c.etiqueta}:`, { negrita: true, sep: 0.5 });
    escribir(c.valor || '(pendiente)', { sep: 3 });
  }
  if (d.contacto?.email) escribir(`Contacto: ${d.contacto.email}`, { tam: 9 });
  doc.save(`declaracion-responsable-${d.sistema.nombre}-${d.sistema.version}.pdf`.replace(/\s+/g, '-'));
}

/** Declaración responsable del sistema, legible dentro de la aplicación (art. 15.3 Orden HAC/1177/2024). */
export function DeclaracionResponsableContenido() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    getDeclaracionResponsable().then((r) => {
      if (!vivo) return;
      if (r.ok) setD(r.data.declaracion);
      else setError(r.error);
    });
    return () => { vivo = false; };
  }, []);

  if (error) return <p className="text-xs text-rose-300">{error}</p>;
  if (!d) return <p className="text-xs text-slate-400">Cargando…</p>;
  return (
    <div className="text-xs text-slate-300 space-y-3">
      {!d.completa && (
        <p className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200">
          Faltan datos en el servidor para completar la declaración: {d.faltan.join(', ')}.
        </p>
      )}
      <h4 className="font-bold text-white text-[13px]">{d.titulo}</h4>
      <dl className="space-y-2">
        {d.campos.map(c => (
          <div key={c.letra}>
            <dt className="text-slate-400">{c.letra}) {c.etiqueta}:</dt>
            <dd className="text-slate-200">{c.valor || <span className="text-amber-300">(pendiente)</span>}</dd>
          </div>
        ))}
      </dl>
      {d.contacto?.email && <p className="text-slate-400">Contacto: {d.contacto.email}</p>}
      <button
        type="button"
        onClick={() => descargarDeclaracionPdf(d)}
        className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl flex items-center gap-1.5"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Descargar en PDF</span>
      </button>
    </div>
  );
}

export default function DeclaracionResponsableModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start justify-center p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-violet-400" />
              <span>Cumplimiento legal · VERI*FACTU</span>
            </h3>
            <button aria-label="Cerrar" type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <DeclaracionResponsableContenido />
        </div>
      </div>
    </div>
  );
}
