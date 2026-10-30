/**
 * ObraMaster - Búsqueda de facturas por cualquier dato.
 *
 * Cada factura se convierte en un texto con todos sus datos (número, cliente, NIF, obra,
 * presupuesto, concepto, líneas, fechas en AAAA-MM-DD y DD/MM/AAAA, importes con coma y con
 * punto, IVA, estado de cobro y de la AEAT, CSV, motivos...). La búsqueda pide que estén
 * todas las palabras escritas, sin distinguir mayúsculas ni acentos.
 */

export const normalizar = (texto) => String(texto ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase();

const fechaEs = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[3]}-${m[2]}-${m[1]}` : '';
};

// 1234.5 -> "1234.50 1234,50 1.234,50" (los miles a mano: es-ES no los pone con 4 cifras)
const importe = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  const [entero, dec] = Math.abs(n).toFixed(2).split('.');
  const miles = `${n < 0 ? '-' : ''}${entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
  return `${n.toFixed(2)} ${n.toFixed(2).replace('.', ',')} ${miles}`;
};

const COBRO = { cobrada: 'cobrada', pendiente: 'pendiente de cobro' };
const AEAT = { aceptado: 'aceptada aeat', aceptado_con_errores: 'aceptada con errores', rechazado: 'rechazada', pendiente: 'pendiente de envio' };

/** Texto de búsqueda de una factura. `obraNombre` y `presupuestoNumero` vienen de la obra y el presupuesto enlazados. */
export function textoFactura(f, { obraNombre = '', presupuestoNumero = '' } = {}) {
  const partes = [
    f.numero, f.tipoFactura, f.obraTitulo, obraNombre, presupuestoNumero,
    f.cliente, f.cifNif, f.direccion, f.clienteMunicipio, f.clienteProvincia,
    f.tipoAeat, f.rectificaId ? 'rectificativa' : 'factura', f.isp ? 'inversion del sujeto pasivo isp' : f.tipoIvaPct !== undefined ? `iva ${f.tipoIvaPct} %` : '',
    f.ivaMotivo, f.rectificacionCausa, f.anulada ? 'anulada' : '', f.anulacionMotivo,
    fechaEs(f.fechaEmision), f.fechaEmision, fechaEs(f.fechaVencimiento), f.fechaVencimiento, fechaEs(f.fechaOperacion),
    `${f.trimestre || ''} ${f.ano || ''}`,
    importe(f.baseImponible), importe(f.cuotaIva), importe(f.cuotaRetencion), importe(f.importeTotal), importe(f.totalFactura),
    COBRO[f.estadoCobro] || f.estadoCobro, fechaEs(f.fechaCobro), f.metodoPago,
    f.aeat ? AEAT[f.aeat.estado] || f.aeat.estado : 'sin registro', f.aeat?.csv, f.aeat?.codigoError, f.aeat?.error,
    ...(Array.isArray(f.lineas) ? f.lineas.map(l => `${l.concepto || ''} ${importe(l.importe)}`) : [])
  ];
  return normalizar(partes.filter(Boolean).join(' '));
}

/** ¿La factura contiene todas las palabras de la búsqueda? */
export function coincideBusqueda(texto, busqueda) {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean);
  return palabras.every(p => texto.includes(p));
}

/** Tipo de factura para el filtro: certificacion | unica | ordinaria | rectificativa. */
export function tipoDeFactura(f) {
  if (f.rectificaId) return 'rectificativa';
  const concepto = String(f.tipoFactura || '');
  if (/^Factura única/i.test(concepto)) return 'unica';
  if (/certificaci[oó]n/i.test(concepto)) return 'certificacion';
  return 'ordinaria';
}
