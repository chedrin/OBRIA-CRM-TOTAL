/**
 * ObraMaster - PDF de presupuestos y facturas (jsPDF)
 *
 * Lo usan la vista previa (PdfModal: descargar) y el envío por correo
 * (SendDocumentModal: adjunto). Mismo documento en los dos sitios.
 */
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const eur = (n) => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Datos derivados del documento: emisor, textos legales y líneas a mostrar. */
export function describeDocument({ type, data, empresaConfig, facturacion, facturas = [] }) {
  const isFactura = type === 'factura';
  const esRectificativa = isFactura && data.tipoAeat && data.tipoAeat !== 'F1';
  const tituloFactura = esRectificativa ? 'FACTURA RECTIFICATIVA' : 'FACTURA';
  // En una factura legal el emisor es siempre la empresa registrada en Ajustes > Facturación.
  const empresaLegal = isFactura && data.legal ? facturacion?.empresa : null;
  const emisorNombre = empresaLegal?.razonSocial || empresaConfig?.razonSocial || '';
  const emisorNif = empresaLegal?.nif || empresaConfig?.cifNif || '';
  const emisorDireccion = empresaLegal
    ? [empresaLegal.domicilio, [empresaLegal.codigoPostal, empresaLegal.municipio].filter(Boolean).join(' '), empresaLegal.provincia].filter(Boolean).join(', ')
    : [empresaConfig?.direccion, empresaConfig?.codigoPostal, empresaConfig?.localidad].filter(Boolean).join(' ');
  const textoIsp = data?.isp ? (facturacion?.empresa?.textoIsp || 'Operación con inversión del sujeto pasivo (art. 84.Uno.2º.f Ley 37/1992 del IVA).') : '';

  // Datos legales de una factura emitida: rectificada, anulación, entorno de pruebas y motivo del IVA.
  const esLegal = isFactura && data.legal;
  const original = esRectificativa ? facturas.find(f => f.id === data.rectificaId) : null;
  const textoRectificativa = esRectificativa
    ? `Factura rectificativa ${data.tipoAeat} ${data.tipoRectificativa === 'S' ? 'por sustitución' : 'por diferencias'}` +
      (original ? ` de la factura ${original.numero} de fecha ${original.fechaEmision}` : '') +
      `. Causa: ${data.rectificacionCausa || ''}` +
      (data.tipoRectificativa === 'S' && data.baseRectificada !== null && data.baseRectificada !== undefined
        ? `. Importes de la factura rectificada: base ${eur(data.baseRectificada)} €, IVA ${eur(data.cuotaRectificada)} €.`
        : '.')
    : '';
  const dePrueba = esLegal && data.entorno && data.entorno !== 'produccion';
  const textoIva = esLegal && !data.isp && data.ivaMotivo && Number(data.tipoIvaPct) !== 21 ? data.ivaMotivo : '';
  const fechaOperacion = esLegal && data.fechaOperacion && data.fechaOperacion !== data.fechaEmision ? data.fechaOperacion : '';
  // Líneas propias de la factura solo si suman la base (en una certificación parcial va una sola línea).
  const lineasFactura = esLegal && Array.isArray(data.lineas) && data.lineas.length
    && Math.abs(data.lineas.reduce((t, l) => t + Number(l.importe || 0), 0) - Number(data.baseImponible)) < 0.01
    ? data.lineas.map(l => ({ concepto: l.concepto, cantidad: l.cantidad, unidad: l.unidad, precioVenta: l.precio, total: l.importe }))
    : null;
  const partidas = isFactura ? (lineasFactura || (esLegal ? null : data.partidas)) : data.partidas;

  return { type, data, isFactura, esRectificativa, tituloFactura, empresaLegal, emisorNombre, emisorNif, emisorDireccion, textoIsp, esLegal, original, textoRectificativa, dePrueba, textoIva, fechaOperacion, lineasFactura, partidas };
}

/** QR tributario (solo facturas emitidas con registro VeriFactu): nivel de corrección M. */
export async function documentQrDataUrl(qrUrl) {
  if (!qrUrl) return '';
  try {
    return await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
  } catch {
    return '';
  }
}

/** Crea el PDF (jsPDF). `info` = describeDocument(...). */
export function buildDocumentPdf(info, { empresaConfig, qrDataUrl = '' } = {}) {
  const { data, isFactura, tituloFactura, emisorNombre, emisorNif, emisorDireccion, textoIsp, textoRectificativa, dePrueba, textoIva, fechaOperacion, partidas } = info;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Simple, robust text PDF generation using jsPDF
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.text(isFactura ? tituloFactura : 'PRESUPUESTO DE OBRA', 20, 25);
  if (dePrueba || data.anulada) {
    doc.setFontSize(9);
    doc.setTextColor(190, 18, 60);
    doc.text([dePrueba ? 'FACTURA DE PRUEBA - SIN VALIDEZ FISCAL' : '', data.anulada ? `ANULADA: ${data.anulacionMotivo || ''}` : ''].filter(Boolean).join(' · '), 20, 19);
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`${emisorNombre} - NIF: ${emisorNif}`, 20, 32);
  doc.text(emisorDireccion, 20, 37);

  // QR tributario arriba a la derecha (unos 35 mm), con sus leyendas.
  if (isFactura && qrDataUrl) {
    doc.setFontSize(7);
    doc.text('QR tributario:', 160, 9);
    doc.addImage(qrDataUrl, 'PNG', 158, 10, 32, 32);
    doc.text('VERI*FACTU', 174, 45, { align: 'center' });
  }

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
  if (!isFactura && data.revisado) doc.text(`Revisión ${data.revisionNumero || 1}: ${data.fechaRevision}${data.pendienteNuevaAceptacion ? ' · Nueva aceptación' : ''}`, 20, 62);
  if (isFactura && data.fechaVencimiento) {
    doc.text(`Vencimiento: ${data.fechaVencimiento}`, 20, 62);
  }
  if (fechaOperacion) doc.text(`Fecha de la operación: ${fechaOperacion}`, 20, 68);

  // Client details box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(110, 45, 80, 25, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE:', 115, 52);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.cliente}`, 115, 58);
  doc.text(`NIF/CIF: ${data.nif || data.cifNif || 'N/A'}`, 115, 64);
  if (data.direccion) doc.text(doc.splitTextToSize(data.direccion, 72), 115, 69);

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

  if (partidas && partidas.length > 0) {
    partidas.forEach((p) => {
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

  doc.text(data.isp ? 'IVA (inversión sujeto pasivo):' : `IVA (${data.tipoIvaPct ?? 10}%):`, 122, y);
  doc.text(`${Number(data.cuotaIva || 0).toFixed(2)} €`, 172, y);
  y += 6;

  if (data.cuotaRetencion) {
    doc.text(`Retención IRPF (${data.retencionIrpfPct}%):`, 122, y);
    doc.text(`-${Number(data.cuotaRetencion).toFixed(2)} €`, 172, y);
    y += 6;
  }
  y += 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', 122, y);
  doc.text(`${Number(data.totalConIva || data.totalFactura || 0).toFixed(2)} €`, 170, y);

  // Footer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const notas = [textoIsp, textoIva, textoRectificativa].filter(Boolean);
  let yNotas = 262;
  notas.forEach((nota) => {
    const lineas = doc.splitTextToSize(nota, 130);
    doc.text(lineas, 20, yNotas);
    yNotas += lineas.length * 3.5 + 1;
  });
  if (empresaConfig?.iban) doc.text(`IBAN: ${empresaConfig.iban}`, 20, 281);
  doc.text('Garantía de obra según Ley de Ordenación de la Edificación (LOE).', 20, 285);

  return doc;
}

/** PDF listo para adjuntar a un correo: { filename, content } con content en base64. */
export async function documentPdfAttachment({ type, data, empresaConfig, facturacion, facturas }) {
  const info = describeDocument({ type, data, empresaConfig, facturacion, facturas });
  const qrDataUrl = type === 'factura' ? await documentQrDataUrl(data?.qrUrl) : '';
  const doc = buildDocumentPdf(info, { empresaConfig, qrDataUrl });
  const content = doc.output('datauristring').split('base64,')[1] || '';
  return { filename: `${String(data?.numero || 'documento').replace(/[^\w.-]+/g, '_')}.pdf`, content };
}
