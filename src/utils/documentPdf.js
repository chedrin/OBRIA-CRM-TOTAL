/**
 * ObraMaster - PDF de presupuestos y facturas (jsPDF)
 *
 * Lo usan la vista previa (PdfModal: descargar) y el envío por correo
 * (SendDocumentModal: adjunto). Mismo documento en los dos sitios.
 */
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

// Formato español con separador de miles siempre (toLocaleString no agrupa 4 cifras en es-ES).
const eur = (n) => {
  const v = Number(n || 0);
  const [ent, dec] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
};

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

// ---------------------------------------------------------------------------
// Plantilla (Ajustes > Plantilla PDF)
// ---------------------------------------------------------------------------

export const PLANTILLA_PDF_DEFECTO = {
  colorPrincipal: '#C8102E',
  colorOscuro: '#4A4A4D',
  telefonoMovil: '',
  telefonoOficina: '',
  web: '',
  formaPagoPresupuesto: '',
  formaPagoFactura: 'Transferencia bancaria',
  validezDias: 15,
  observacionesPresupuesto: 'ESTE PRESUPUESTO TIENE UNA VALIDEZ DE {validez} DÍAS. TRANSCURRIDO ESTE TIEMPO SERÁ RECALCULADO DEBIDO A LAS POSIBLES SUBIDAS DE MATERIALES E IMPUESTOS.',
  observacionesFactura: '',
  textoFirma: 'FIRMA Y DNI DE LA PROPIEDAD ACEPTANDO EL PRESUPUESTO',
  textoProteccionDatos: 'Sus datos de carácter personal han sido recogidos de acuerdo con el Reglamento (UE) 2016/679 (RGPD). Responsable del tratamiento: {razonSocial}. Puede ejercer sus derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad de forma gratuita mediante correo electrónico a {email} o en {direccion}.',
  mostrarImportesPartida: false,
  mostrarMediciones: true,
  mostrarFirmaEmpresa: true
};

/** Plantilla con los valores por defecto para lo que no esté configurado. */
export function plantillaPdfDe(empresaConfig) {
  const guardada = empresaConfig?.plantillaPdf || {};
  const p = { ...PLANTILLA_PDF_DEFECTO };
  Object.entries(guardada).forEach(([k, v]) => { if (v !== undefined && v !== null && !(k.startsWith('color') && !v)) p[k] = v; });
  if (!p.telefonoMovil && !p.telefonoOficina && empresaConfig?.telefono) p.telefonoOficina = empresaConfig.telefono;
  if (!p.web && empresaConfig?.web) p.web = empresaConfig.web;
  return p;
}

// Las imágenes de ejemplo de los datos iniciales (fotos de Unsplash) no son un logotipo real.
const esImagenDeMuestra = (url) => !url || /images\.unsplash\.com/i.test(String(url));

const num = (n) => eur(n).replace(/,00$/, '');
const euros = (n) => `${eur(n)} €`;
const rellenar = (texto, valores) => String(texto || '').replace(/\{(\w+)\}/g, (m, k) => (valores[k] !== undefined && valores[k] !== null ? String(valores[k]) : ''));
const fechaEs = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(f || '');
};
const esUnidadSuelta = (unidad, cantidad) => Number(cantidad) === 1 && /^(ud|u|uds|pa|p\.a\.|partida|global)$/i.test(String(unidad || '').trim());

// Capítulos de un presupuesto (los antiguos solo traen `partidas` con el nombre del capítulo).
function capitulosPresupuesto(p) {
  const caps = (Array.isArray(p?.capitulos) ? p.capitulos : []).map(c => ({ ...c, partidas: [...(c.partidas || [])] }));
  const usados = new Set(caps.flatMap(c => c.partidas.map(it => it.id)));
  (p?.partidas || []).filter(it => !usados.has(it.id) || it.id === undefined).forEach((it) => {
    const nombre = it.capitulo || 'General';
    let cap = caps.find(c => c.nombre === nombre);
    if (!cap) {
      cap = { codigo: String(caps.length + 1).padStart(2, '0'), nombre, partidas: [] };
      caps.push(cap);
    }
    cap.partidas.push(it);
  });
  return caps;
}

function textoPartida(p) {
  if (p.concepto) return String(p.concepto);
  return [p.titulo, p.descripcion].filter(Boolean).join('. ');
}

/**
 * Modelo del documento: todo lo que se pinta, igual para el PDF y la vista previa.
 * `info` = describeDocument(...).
 */
export function buildDocumentModel(info, empresaConfig = {}) {
  const { data, isFactura, tituloFactura, emisorNombre, emisorNif, empresaLegal, textoIsp, textoRectificativa, dePrueba, textoIva, fechaOperacion, partidas } = info;
  const plantilla = plantillaPdfDe(empresaConfig);

  const emisorLineas = empresaLegal
    ? [empresaLegal.domicilio, [empresaLegal.codigoPostal, empresaLegal.municipio].filter(Boolean).join(' ') + (empresaLegal.provincia ? ` (${empresaLegal.provincia})` : '')]
    : [empresaConfig?.direccion, [empresaConfig?.codigoPostal, empresaConfig?.localidad].filter(Boolean).join(' ') + (empresaConfig?.provincia && empresaConfig.provincia !== empresaConfig.localidad ? ` (${empresaConfig.provincia})` : '')];
  const direccionCorta = emisorLineas.filter(s => String(s || '').trim()).join(', ');

  // Detalle por partida (cantidad, precio y total) en facturas; en presupuestos, según la plantilla.
  const modoDetalle = isFactura || Boolean(plantilla.mostrarImportesPartida);

  const linea = (p) => {
    const cantidad = Number(p.cantidad || 0);
    const total = Number(p.total ?? p.importe ?? 0);
    let texto = textoPartida(p).trim();
    const nota = !total && !cantidad;
    if (!modoDetalle && plantilla.mostrarMediciones && cantidad > 0 && !esUnidadSuelta(p.unidad, cantidad)) {
      texto += ` (${num(cantidad)} ${p.unidad || 'ud'})`;
    }
    return {
      codigo: p.codigo || '',
      texto,
      cantidad: modoDetalle && !nota ? `${num(cantidad)} ${p.unidad || 'ud'}` : '',
      precio: modoDetalle && !nota ? Number(p.precioVenta ?? p.precio ?? 0) : null,
      total: modoDetalle && !nota ? total : null,
      importe: total
    };
  };

  let grupos;
  if (!isFactura) {
    grupos = capitulosPresupuesto(data).filter(c => c.partidas.length).map((c, i) => ({
      codigo: String(c.codigo || String(i + 1).padStart(2, '0')),
      nombre: String(c.nombre || 'General').toUpperCase(),
      lineas: c.partidas.map(linea),
      total: c.partidas.reduce((s, p) => s + Number(p.total || 0), 0),
      conTitulo: true
    }));
  } else if (partidas && partidas.length) {
    const conCapitulo = partidas.some(p => p.capitulo);
    if (conCapitulo) {
      const mapa = new Map();
      partidas.forEach((p) => {
        const k = p.capitulo || 'General';
        if (!mapa.has(k)) mapa.set(k, []);
        mapa.get(k).push(p);
      });
      grupos = [...mapa.entries()].map(([nombre, ps], i) => ({
        codigo: String(i + 1).padStart(2, '0'),
        nombre: nombre.toUpperCase(),
        lineas: ps.map(linea),
        total: ps.reduce((s, p) => s + Number(p.total ?? p.importe ?? 0), 0),
        conTitulo: true
      }));
    } else {
      grupos = [{ codigo: '', nombre: '', lineas: partidas.map(linea), total: partidas.reduce((s, p) => s + Number(p.total ?? p.importe ?? 0), 0), conTitulo: false }];
    }
  } else {
    const base = Number(data.baseImponible || 0);
    grupos = [{
      codigo: '',
      nombre: '',
      lineas: [{ codigo: '', texto: `${data.tipoFactura || 'Certificación de obra'}${data.obraTitulo ? `. Obra: ${data.obraTitulo}` : ''}`, cantidad: '1 ud', precio: base, total: base, importe: base }],
      total: base,
      conTitulo: false
    }];
  }

  const isp = Boolean(data.isp || data.inversionSujetoPasivo);
  const base = Number(data.baseImponible || 0);
  const tipoIva = Number(data.tipoIvaPct ?? (isFactura ? 21 : 10));
  const cuota = isp ? 0 : Number(data.cuotaIva ?? base * tipoIva / 100);
  const retencionPct = Number(data.retencionIrpfPct || 0);
  const retencion = Number(data.cuotaRetencion || 0);
  const total = Number(data.totalConIva || data.totalFactura || (base + cuota - retencion));

  const validez = data.validezDias || plantilla.validezDias;
  const valores = {
    validez,
    razonSocial: emisorNombre,
    email: empresaConfig?.email || '',
    direccion: direccionCorta,
    nif: emisorNif
  };

  // Observaciones (recuadro junto al total).
  const observaciones = [];
  if (!isFactura) {
    if (data.versionSustituida) {
      observaciones.push({ texto: `VERSIÓN ${data.versionSustituida.version} SUSTITUIDA POR UNA REVISIÓN EL ${String(data.versionSustituida.fecha || '').slice(0, 10)}. Copia conservada con los datos que tenía.`, negrita: true, aviso: true });
    }
    if (data.revisado) {
      observaciones.push({ texto: `Revisión ${data.revisionNumero || 1} del ${String(data.fechaRevision || '').slice(0, 10)}${data.pendienteNuevaAceptacion ? ' · pendiente de nueva aceptación' : data.fechaNuevaAceptacion ? ` · aceptada de nuevo el ${String(data.fechaNuevaAceptacion).slice(0, 10)}` : ''}.` });
    }
    if (data.observaciones && typeof data.observaciones === 'string') observaciones.push({ texto: data.observaciones });
    if (data.exclusiones && typeof data.exclusiones === 'string') observaciones.push({ texto: `EXCLUSIONES: ${data.exclusiones}` });
    if (!data.condicionesPago && data.notasLegales) observaciones.push({ texto: data.notasLegales });
    if (isp) observaciones.push({ texto: 'Operación con inversión del sujeto pasivo (art. 84.Uno.2º.f Ley 37/1992 del IVA).' });
    if (plantilla.observacionesPresupuesto) observaciones.push({ texto: rellenar(plantilla.observacionesPresupuesto, valores), negrita: true });
  } else {
    if (textoRectificativa) observaciones.push({ texto: textoRectificativa, negrita: true });
    if (textoIsp) observaciones.push({ texto: textoIsp, negrita: true });
    if (textoIva) observaciones.push({ texto: textoIva });
    if (fechaOperacion) observaciones.push({ texto: `Fecha de realización de la operación: ${fechaEs(fechaOperacion)}.` });
    if (data.fechaVencimiento) observaciones.push({ texto: `Vencimiento: ${fechaEs(data.fechaVencimiento)}.` });
    if (data.anulada) observaciones.push({ texto: `FACTURA ANULADA. ${data.anulacionMotivo || ''}`.trim(), negrita: true, aviso: true });
    if (plantilla.observacionesFactura) observaciones.push({ texto: rellenar(plantilla.observacionesFactura, valores) });
  }
  if (empresaConfig?.iban) observaciones.push({ texto: `Nº Cuenta: ${empresaConfig.iban}`, negrita: true, subrayado: true });

  const avisos = [dePrueba ? 'FACTURA DE PRUEBA · SIN VALIDEZ FISCAL' : '', data.anulada ? 'ANULADA' : ''].filter(Boolean);

  const pie = [
    rellenar(plantilla.textoProteccionDatos, valores),
    empresaConfig?.registroMercantil && /\b(s\.?l\.?|s\.?a\.?|sociedad)\b/i.test(emisorNombre) ? `Inscrita en el Registro ${empresaConfig.registroMercantil}.` : ''
  ].filter(Boolean).join(' ');

  return {
    esFactura: isFactura,
    tipoDoc: isFactura ? (tituloFactura === 'FACTURA' ? 'Factura' : 'Fact. rectificativa') : 'Presupuesto',
    numero: data.numero || '',
    fecha: fechaEs(isFactura ? data.fechaEmision : data.fecha),
    avisos,
    colores: { principal: plantilla.colorPrincipal, oscuro: plantilla.colorOscuro },
    emisor: {
      nombreComercial: empresaConfig?.nombreComercial || emisorNombre,
      razonSocial: emisorNombre,
      nif: emisorNif,
      lineas: emisorLineas.filter(s => String(s || '').trim()),
      movil: plantilla.telefonoMovil,
      oficina: plantilla.telefonoOficina,
      email: empresaConfig?.email || '',
      web: plantilla.web,
      logoUrl: esImagenDeMuestra(empresaConfig?.logoUrl) ? '' : empresaConfig.logoUrl,
      firmaUrl: plantilla.mostrarFirmaEmpresa && !esImagenDeMuestra(empresaConfig?.firmaUrl) ? empresaConfig.firmaUrl : ''
    },
    cliente: {
      nombre: data.cliente || '',
      nif: data.nif || data.cifNif || '',
      direccion: data.direccion || data.clienteDireccion || '',
      telefono: data.telefono || '',
      email: data.email || ''
    },
    obra: data.obraTitulo || '',
    formaPago: isFactura
      ? (data.metodoPago || plantilla.formaPagoFactura || '')
      : (data.condicionesPago || plantilla.formaPagoPresupuesto || ''),
    modoDetalle,
    grupos,
    impuestos: {
      tipo: isp ? 'ISP' : `${num(tipoIva)}%`,
      base,
      cuota,
      retencionPct,
      retencion,
      total
    },
    observaciones,
    firma: !isFactura,
    textoFirma: plantilla.textoFirma,
    pie,
    qr: isFactura && Boolean(data.qrUrl)
  };
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

/** Convierte una imagen (data URL o URL con CORS) en PNG para jsPDF. '' si no se puede. */
export function imageToPngDataUrl(url, timeoutMs = 6000) {
  if (!url || typeof document === 'undefined') return Promise.resolve('');
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(''), timeoutMs);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      clearTimeout(timer);
      try {
        const max = 900;
        const k = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve('');
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(''); };
    img.src = url;
  });
}

/** Logotipo, firma de la empresa y QR listos para el PDF. */
export async function loadDocumentAssets(model, qrUrl) {
  const [logoDataUrl, firmaDataUrl, qrDataUrl] = await Promise.all([
    imageToPngDataUrl(model.emisor.logoUrl),
    imageToPngDataUrl(model.emisor.firmaUrl),
    model.qr ? documentQrDataUrl(qrUrl) : Promise.resolve('')
  ]);
  return { logoDataUrl, firmaDataUrl, qrDataUrl };
}

// ---------------------------------------------------------------------------
// PDF (jsPDF, A4 en mm)
// ---------------------------------------------------------------------------

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 12;
const MR = 198;
const BODY_TOP = 97;

const rgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  const v = m ? parseInt(m[1], 16) : 0xc8102e;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

function columnas(modoDetalle) {
  return modoDetalle
    ? { art: [ML, 30], desc: [30, 136], cant: [136, 156], precio: [156, 177], total: [177, MR] }
    : { art: [ML, 30], desc: [30, 154], precio: [154, 176], total: [176, MR] };
}

/** Coloca el contenido en páginas. Devuelve las páginas con sus elementos y la suma acumulada. */
function maquetar(doc, model, cols, alturas) {
  const descW = cols.desc[1] - cols.desc[0] - 5;
  const paginas = [];
  let pagina = { items: [], sumaAnterior: null, sumaSigue: null };
  paginas.push(pagina);
  let y = BODY_TOP + 2;
  let acumulado = 0;
  const limite = () => alturas.cuerpoFin;
  const nuevaPagina = () => {
    pagina.sumaSigue = acumulado;
    pagina = { items: [], sumaAnterior: acumulado, sumaSigue: null };
    paginas.push(pagina);
    y = BODY_TOP + 2 + (acumulado ? 6 : 0);
  };
  const LH = 3.55;

  model.grupos.forEach((g) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    const parrafos = g.lineas.map(l => ({ l, lineas: doc.splitTextToSize(l.texto || '', descW) }));
    if (g.conTitulo) {
      const primero = parrafos[0] ? Math.min(parrafos[0].lineas.length, 3) * LH : 0;
      if (y + 6 + primero > limite()) nuevaPagina();
      pagina.items.push({ tipo: 'titulo', y, codigo: g.codigo, texto: g.nombre });
      y += 6;
    }
    parrafos.forEach(({ l, lineas }) => {
      let resto = lineas;
      let primera = true;
      while (resto.length) {
        const caben = Math.floor((limite() - y) / LH);
        if (caben < 2 && resto.length > 1) { nuevaPagina(); continue; }
        if (caben < 1) { nuevaPagina(); continue; }
        const trozo = resto.slice(0, caben);
        resto = resto.slice(trozo.length);
        pagina.items.push({ tipo: 'parrafo', y, lineas: trozo, ultimo: resto.length === 0, linea: primera ? l : null });
        y += trozo.length * LH;
        primera = false;
        if (resto.length) nuevaPagina();
      }
      if (model.modoDetalle) acumulado += Number(l.importe || 0);
      y += 2.2;
    });
    if (g.conTitulo) {
      if (y + 7 > limite()) nuevaPagina();
      pagina.items.push({ tipo: 'totalCapitulo', y: y + 1, texto: `TOTAL ${g.nombre}`, total: g.total });
      y += 9;
      if (!model.modoDetalle) acumulado += g.total;
    } else if (!model.modoDetalle) {
      acumulado += g.total;
    }
  });
  return { paginas, yFinal: y };
}

function alturaObservaciones(doc, model) {
  doc.setFontSize(7.6);
  return model.observaciones.reduce((h, o) => h + doc.splitTextToSize(o.texto, 124).length * 3.3 + 0.8, 0);
}

/** Crea el PDF. `info` = describeDocument(...). */
export function buildDocumentPdf(info, { empresaConfig, qrDataUrl = '', logoDataUrl = '', firmaDataUrl = '' } = {}) {
  const model = buildDocumentModel(info, empresaConfig);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const principal = rgb(model.colores.principal);
  const oscuro = rgb(model.colores.oscuro);
  const cols = columnas(model.modoDetalle);

  // Pie: protección de datos.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  const pieLineas = model.pie ? doc.splitTextToSize(model.pie, MR - ML) : [];
  const pieTop = PAGE_H - 5 - pieLineas.length * 2.5;
  const firmaTop = model.firma ? pieTop - 22 : null;
  const abajo = model.firma ? firmaTop : pieTop;

  // Bloque de totales de la última página.
  const obsH = Math.max(12, alturaObservaciones(doc, model) + 5);
  const totalesH = 6 + 8 + 3 + 7 + 1.5 + obsH;
  const totalesTop = abajo - 3 - totalesH;
  const sumaTop = abajo - 10;

  const alturas = { cuerpoFin: sumaTop - 3 };
  const { paginas, yFinal } = maquetar(doc, model, cols, alturas);
  // Si el total no cabe en la última página, va en una página más.
  if (yFinal > totalesTop - 3) {
    const ultima = paginas[paginas.length - 1];
    const acumulado = model.grupos.reduce((s, g) => s + g.total, 0);
    ultima.sumaSigue = acumulado;
    paginas.push({ items: [], sumaAnterior: acumulado, sumaSigue: null });
  }
  const totalPaginas = paginas.length;

  paginas.forEach((pag, idx) => {
    if (idx > 0) doc.addPage();
    const esUltima = idx === totalPaginas - 1;
    cabecera(doc, model, { pagina: idx + 1, totalPaginas, principal, oscuro, cols, qrDataUrl, logoDataUrl });

    // Marco del cuerpo con columnas.
    const cuerpoFin = esUltima ? totalesTop - 3 : sumaTop - 3;
    doc.setDrawColor(200, 200, 204);
    doc.setLineWidth(0.25);
    Object.values(cols).forEach(([x0, x1]) => doc.roundedRect(x0 + 0.4, BODY_TOP - 2, x1 - x0 - 0.8, cuerpoFin - BODY_TOP + 2, 1.6, 1.6, 'S'));

    if (pag.sumaAnterior) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 115);
      doc.text('Suma anterior', cols.desc[0] + 2.5, BODY_TOP + 2.2);
      doc.text(euros(pag.sumaAnterior), cols.total[1] - 2, BODY_TOP + 2.2, { align: 'right' });
    }

    pag.items.forEach(it => pintarItem(doc, model, it, cols, principal));

    if (!esUltima) {
      sumaYSigue(doc, pag.sumaSigue, sumaTop, oscuro, principal);
    } else {
      totales(doc, model, totalesTop, obsH, principal, oscuro);
    }
    if (model.firma) firma(doc, model, firmaTop, firmaDataUrl);
    if (pieLineas.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(120, 120, 125);
      doc.text(pieLineas, ML, pieTop + 2.2);
    }
  });

  doc.setProperties({ title: `${model.tipoDoc} ${model.numero}`, subject: model.obra, author: model.emisor.razonSocial, creator: 'ObraMaster' });
  return doc;
}

function cabecera(doc, model, { pagina, totalPaginas, principal, oscuro, qrDataUrl, logoDataUrl }) {
  const conQr = model.esFactura && qrDataUrl;
  const logoMaxW = conQr ? 66 : 82;

  // Avisos (factura de prueba, anulada).
  if (model.avisos.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(190, 18, 60);
    doc.text(model.avisos.join(' · '), PAGE_W / 2, 6.5, { align: 'center' });
  }

  // Logotipo o nombre comercial.
  let yEmisor = 30;
  if (logoDataUrl) {
    try {
      const props = doc.getImageProperties(logoDataUrl);
      const k = Math.min(logoMaxW / props.width, 19 / props.height);
      doc.addImage(logoDataUrl, 'PNG', ML, 9, props.width * k, props.height * k);
      yEmisor = 9 + props.height * k + 4.5;
    } catch {
      logoDataUrl = '';
    }
  }
  if (!logoDataUrl) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...principal);
    let fs = 22;
    doc.setFontSize(fs);
    while (fs > 12 && doc.getTextWidth(model.emisor.nombreComercial) > logoMaxW) { fs -= 1; doc.setFontSize(fs); }
    const lineas = doc.splitTextToSize(model.emisor.nombreComercial, logoMaxW).slice(0, 2);
    doc.text(lineas, ML, 18);
    yEmisor = 18 + (lineas.length - 1) * fs * 0.4 + 7;
  }
  yEmisor = Math.min(yEmisor, 33.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 32);
  doc.text(model.emisor.razonSocial, ML, yEmisor);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  [model.emisor.nif, ...model.emisor.lineas].slice(0, 3).forEach((t, i) => doc.text(String(t), ML, yEmisor + 3.7 * (i + 1)));

  // QR tributario (Orden HAC/1177/2024): al principio de la factura, 30-40 mm, con sus leyendas.
  if (conQr) {
    const qx = 84;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(40, 40, 42);
    doc.text('QR tributario:', qx + 16, 9.5, { align: 'center' });
    doc.addImage(qrDataUrl, 'PNG', qx, 10.5, 32, 32);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('VERI*FACTU', qx + 16, 45.5, { align: 'center' });
  }

  // Recuadro del cliente.
  const cx = conQr ? 122 : 108;
  const cw = MR - cx;
  doc.setFillColor(238, 238, 240);
  doc.setDrawColor(...principal);
  doc.setLineWidth(0.4);
  doc.roundedRect(cx, 8, cw, 38, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...principal);
  doc.text(model.esFactura ? 'FACTURAR A' : 'CLIENTE', cx + 5, 13);
  doc.setFontSize(9.5);
  doc.setTextColor(25, 25, 28);
  const nombre = doc.splitTextToSize(model.cliente.nombre || '—', cw - 10).slice(0, 2);
  doc.text(nombre, cx + 5, 18);
  let yc = 18 + nombre.length * 4.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const lineasCliente = [
    model.cliente.nif ? `NIF: ${model.cliente.nif}` : '',
    ...doc.splitTextToSize(model.cliente.direccion || '', cw - 10).slice(0, 2),
    [model.cliente.telefono, model.cliente.email].filter(Boolean).join(' · ')
  ].filter(Boolean);
  lineasCliente.forEach((t) => {
    if (yc > 44) return;
    doc.text(doc.splitTextToSize(t, cw - 10)[0], cx + 5, yc);
    yc += 3.8;
  });

  // Barra Documento / Número / Página / Fecha.
  const meta = [
    ['Documento', model.tipoDoc, 26],
    ['Número', model.numero, 30],
    ['Página', `${pagina} de ${totalPaginas}`, 17],
    ['Fecha', model.fecha, 21]
  ];
  let x = ML;
  const yBar = 51;
  const anchoMeta = meta.reduce((s, m) => s + m[2], 0) + (meta.length - 1) * 1.5;
  doc.setFillColor(...oscuro);
  doc.roundedRect(ML, yBar, anchoMeta, 5.5, 1.5, 1.5, 'F');
  meta.forEach(([label, valor, w]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(label, x + w / 2, yBar + 3.8, { align: 'center' });
    doc.setDrawColor(170, 170, 175);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, yBar + 7, w, 5.8, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(25, 25, 28);
    let v = String(valor || '');
    while (v.length > 3 && doc.getTextWidth(v) > w - 2) v = v.slice(0, -1);
    doc.text(v, x + w / 2, yBar + 11, { align: 'center' });
    x += w + 1.5;
  });

  // Contacto de la empresa.
  const kx = ML + anchoMeta + 4;
  doc.setFontSize(7.3);
  const contacto = [
    [model.emisor.movil ? ['Telf. Móvil', model.emisor.movil] : null, model.emisor.email ? ['Email', model.emisor.email] : null],
    [model.emisor.oficina ? ['Telf. Oficina', model.emisor.oficina] : null, model.emisor.web ? ['Web', model.emisor.web] : null]
  ];
  contacto.forEach((fila, i) => {
    const yy = yBar + 4 + i * 6.2;
    fila.forEach((par, j) => {
      if (!par) return;
      const xx = j === 0 ? kx : kx + 37;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...oscuro);
      doc.text(`${par[0]}:`, xx, yy);
      const lw = doc.getTextWidth(`${par[0]}: `);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(25, 25, 28);
      let v = par[1];
      const maxW = (j === 0 ? 36 : MR - xx) - lw;
      while (v.length > 3 && doc.getTextWidth(v) > maxW) v = v.slice(0, -1);
      doc.text(v, xx + lw, yy);
    });
  });

  // Barra N.I.F. / Obra / Forma de pago.
  const yBar2 = 70.5;
  const campos = [
    ['N.I.F. CLIENTE', model.cliente.nif, 34],
    ['OBRA', model.obra, 62],
    ['FORMA DE PAGO', model.formaPago, MR - ML - 34 - 62 - 3]
  ];
  doc.setFillColor(...oscuro);
  doc.roundedRect(ML, yBar2, MR - ML, 5.5, 1.5, 1.5, 'F');
  x = ML;
  campos.forEach(([label, valor, w]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(label, x + w / 2, yBar2 + 3.8, { align: 'center' });
    doc.setDrawColor(170, 170, 175);
    doc.roundedRect(x, yBar2 + 7, w, 7.2, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(25, 25, 28);
    const lineas = doc.splitTextToSize(String(valor || ''), w - 3).slice(0, 2);
    doc.text(lineas, x + 1.8, yBar2 + (lineas.length > 1 ? 9.9 : 11.6));
    x += w + 1.5;
  });

  // Cabecera de la tabla.
  const cols = columnas(model.modoDetalle);
  const yT = 88;
  doc.setFillColor(...principal);
  doc.roundedRect(ML, yT, MR - ML, 6, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('ARTÍCULO', cols.art[0] + 2, yT + 4);
  doc.text('DESCRIPCIÓN', (cols.desc[0] + cols.desc[1]) / 2, yT + 4, { align: 'center' });
  if (cols.cant) doc.text('CANT.', (cols.cant[0] + cols.cant[1]) / 2, yT + 4, { align: 'center' });
  doc.text('PRECIO UD.', cols.precio[1] - 2, yT + 4, { align: 'right' });
  doc.text('TOTAL', cols.total[1] - 2, yT + 4, { align: 'right' });
}

function pintarItem(doc, model, it, cols, principal) {
  const xDesc = cols.desc[0] + 2.5;
  const descW = cols.desc[1] - cols.desc[0] - 5;
  if (it.tipo === 'titulo') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(...principal);
    doc.text(it.codigo, cols.art[0] + 2.5, it.y + 3);
    doc.setTextColor(20, 20, 22);
    doc.text(it.texto, xDesc, it.y + 3);
    return;
  }
  if (it.tipo === 'parrafo') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.3);
    doc.setTextColor(35, 35, 38);
    const base = it.y + 3;
    it.lineas.forEach((ln, i) => {
      const justificar = i < it.lineas.length - 1 || !it.ultimo;
      textoJustificado(doc, ln, xDesc, base + i * 3.55, justificar ? descW : 0);
    });
    const l = it.linea;
    if (l && model.modoDetalle) {
      doc.setFontSize(7.8);
      if (l.codigo) {
        doc.setTextColor(110, 110, 115);
        let c = l.codigo;
        while (c.length > 2 && doc.getTextWidth(c) > cols.art[1] - cols.art[0] - 4) c = c.slice(0, -1);
        doc.text(c, cols.art[0] + 2.5, base);
      }
      doc.setTextColor(35, 35, 38);
      if (cols.cant && l.cantidad) doc.text(l.cantidad, (cols.cant[0] + cols.cant[1]) / 2, base, { align: 'center' });
      if (l.precio !== null) doc.text(euros(l.precio), cols.precio[1] - 2, base, { align: 'right' });
      if (l.total !== null) {
        doc.setFont('helvetica', 'bold');
        doc.text(euros(l.total), cols.total[1] - 2, base, { align: 'right' });
      }
    }
    return;
  }
  if (it.tipo === 'totalCapitulo') {
    doc.setDrawColor(215, 215, 220);
    doc.setLineWidth(0.2);
    doc.line(xDesc, it.y, cols.total[1] - 2, it.y);
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(8.4);
    doc.setTextColor(20, 20, 22);
    doc.text(it.texto, xDesc, it.y + 4);
    if (!model.modoDetalle) doc.text(euros(it.total), cols.precio[1] - 2, it.y + 4, { align: 'right' });
    doc.text(euros(it.total), cols.total[1] - 2, it.y + 4, { align: 'right' });
  }
}

// Una línea justificada a `ancho` (0 = sin justificar).
function textoJustificado(doc, linea, x, y, ancho) {
  const palabras = String(linea).trim().split(/\s+/);
  const ocupado = palabras.reduce((s, w) => s + doc.getTextWidth(w), 0);
  const hueco = palabras.length > 1 ? (ancho - ocupado) / (palabras.length - 1) : 0;
  if (!ancho || palabras.length < 4 || hueco > doc.getTextWidth(' ') * 3) {
    doc.text(String(linea).trim(), x, y);
    return;
  }
  let xx = x;
  palabras.forEach((w) => {
    doc.text(w, xx, y);
    xx += doc.getTextWidth(w) + hueco;
  });
}

function sumaYSigue(doc, suma, y, oscuro, principal) {
  doc.setFillColor(...oscuro);
  doc.roundedRect(ML, y, 140, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Continúa en la página siguiente', ML + 4, y + 4.6);
  doc.setFillColor(...principal);
  doc.roundedRect(ML + 143, y, MR - ML - 143, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SUMA Y SIGUE:', ML + 146, y + 4.6);
  doc.text(euros(suma || 0), MR - 2.5, y + 4.6, { align: 'right' });
}

function totales(doc, model, y, obsH, principal, oscuro) {
  const imp = model.impuestos;
  const conRet = Boolean(imp.retencion);
  const columnasImp = [
    ['TIPO I.V.A.', imp.tipo],
    ['IMPORTE', euros(imp.base)],
    ['BASE IMPONIBLE', euros(imp.base)],
    ['CUOTA I.V.A.', euros(imp.cuota)],
    ...(conRet ? [[`RET. I.R.P.F. (${num(imp.retencionPct)}%)`, `-${euros(imp.retencion)}`]] : [])
  ];
  const w = (MR - ML) / columnasImp.length;
  doc.setFillColor(...oscuro);
  doc.roundedRect(ML, y, MR - ML, 6, 1.5, 1.5, 'F');
  doc.setDrawColor(170, 170, 175);
  doc.setLineWidth(0.25);
  doc.roundedRect(ML, y + 7, MR - ML, 7, 1.5, 1.5, 'S');
  columnasImp.forEach(([label, valor], i) => {
    const cx = ML + w * i + w / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(label, cx, y + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(25, 25, 28);
    doc.text(valor, cx, y + 11.6, { align: 'center' });
    if (i > 0) { doc.setDrawColor(215, 215, 220); doc.line(ML + w * i, y + 8, ML + w * i, y + 13); }
  });

  const y2 = y + 17;
  doc.setFillColor(...oscuro);
  doc.roundedRect(ML, y2, 140, 7, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('OBSERVACIONES:', ML + 4, y2 + 4.6);
  doc.setFillColor(...principal);
  doc.roundedRect(ML + 143, y2, MR - ML - 143, 7, 1.5, 1.5, 'F');
  doc.setFontSize(9.5);
  doc.text('TOTAL:', ML + 146, y2 + 4.9);
  doc.text(euros(imp.total), MR - 2.5, y2 + 4.9, { align: 'right' });

  const y3 = y2 + 8.5;
  doc.setDrawColor(170, 170, 175);
  doc.roundedRect(ML, y3, MR - ML, obsH, 1.5, 1.5, 'S');
  let yy = y3 + 4;
  model.observaciones.forEach((o) => {
    doc.setFont('helvetica', o.negrita ? 'bold' : 'normal');
    doc.setFontSize(7.6);
    if (o.aviso) doc.setTextColor(190, 18, 60); else doc.setTextColor(25, 25, 28);
    const lineas = doc.splitTextToSize(o.texto, 124);
    doc.text(lineas, ML + 3, yy);
    if (o.subrayado) {
      doc.setDrawColor(25, 25, 28);
      doc.setLineWidth(0.2);
      doc.line(ML + 3, yy + 0.7, ML + 3 + doc.getTextWidth(lineas[0]), yy + 0.7);
    }
    yy += lineas.length * 3.3 + 0.8;
  });
  if (model.esFactura && model.qr) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(90, 90, 95);
    doc.text('Factura verificable en la sede electrónica de la AEAT', MR - 3, y3 + obsH - 2.5, { align: 'right' });
  }
}

function firma(doc, model, y, firmaDataUrl) {
  doc.setDrawColor(170, 170, 175);
  doc.setLineWidth(0.25);
  doc.roundedRect(ML, y, 124, 19, 1.5, 1.5, 'S');
  doc.roundedRect(ML + 126, y, MR - ML - 126, 19, 1.5, 1.5, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(40, 40, 42);
  doc.text(model.textoFirma, ML + 3, y + 4);
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 125);
  doc.text('Fecha:', ML + 3, y + 17);
  doc.setFontSize(7.2);
  doc.setTextColor(40, 40, 42);
  doc.text('POR LA EMPRESA', ML + 129, y + 4);
  if (firmaDataUrl) {
    try {
      const props = doc.getImageProperties(firmaDataUrl);
      const k = Math.min(52 / props.width, 12 / props.height);
      doc.addImage(firmaDataUrl, 'PNG', ML + 129, y + 5.5, props.width * k, props.height * k);
    } catch { /* sin firma */ }
  }
}

/** PDF listo para adjuntar a un correo: { filename, content } con content en base64. */
export async function documentPdfAttachment({ type, data, empresaConfig, facturacion, facturas }) {
  const info = describeDocument({ type, data, empresaConfig, facturacion, facturas });
  const model = buildDocumentModel(info, empresaConfig);
  const assets = await loadDocumentAssets(model, data?.qrUrl);
  const doc = buildDocumentPdf(info, { empresaConfig, ...assets });
  const content = doc.output('datauristring').split('base64,')[1] || '';
  return { filename: `${String(data?.numero || 'documento').replace(/[^\w.-]+/g, '_')}.pdf`, content };
}
