/**
 * ObraMaster - Certificaciones de un presupuesto: cada una se factura una sola vez y en orden.
 *
 * Código puro: lo usan la pantalla de emitir factura y el servidor (backend/facturacionRoutes.js),
 * que es quien decide el número de certificación y lo escribe al principio del concepto
 * ("Certificación 2 de 3 · ..."). Así se sabe después qué certificación es cada factura.
 *
 * El plan sale de las condiciones de pago del presupuesto ("40% firma · 40% avance · 20% entrega").
 * Si no suman 100 % (p. ej. "Certificaciones mensuales según avance"), el importe de cada
 * certificación es libre, pero se numeran igual y en orden. Sin condiciones: 40/40/20.
 * Antes de la primera certificación se puede emitir una factura única del 100 %.
 */

const redondear = (n) => Math.round(Number(n || 0) * 100) / 100;

export const PLAN_POR_DEFECTO = [
  { pct: 40, texto: 'Anticipo al inicio de obra' },
  { pct: 40, texto: 'Avance tras instalaciones' },
  { pct: 20, texto: 'Fin de obra y entrega de llaves' }
];

const MARCA_CERT = /^Certificación (\d+)(?: de \d+)?\b/i;
const MARCA_UNICA = /^Factura única\b/i;

/** Plan de certificaciones del presupuesto: { fijo, items: [{ n, pct, texto }] }. */
export function planCertificaciones(presupuesto) {
  const texto = String(presupuesto?.condicionesPago || '').trim();
  if (!texto) return { fijo: true, items: PLAN_POR_DEFECTO.map((c, i) => ({ n: i + 1, ...c })) };
  const items = [];
  for (const m of texto.matchAll(/(\d+(?:[.,]\d+)?)\s*%\s*([^·;,+\n]*)/g)) {
    const pct = Number(m[1].replace(',', '.'));
    if (pct > 0) items.push({ n: items.length + 1, pct, texto: m[2].trim() || `Certificación ${items.length + 1}` });
  }
  const suma = items.reduce((s, c) => s + c.pct, 0);
  if (items.length && Math.abs(suma - 100) < 0.01) return { fijo: true, items };
  return { fijo: false, items: [] };
}

/** Qué certificación es cada factura vigente del presupuesto: { n -> factura } y si hay factura única. */
export function certificacionesEmitidas(facturas = [], presupuestoId) {
  const propias = facturas
    .filter(f => f.presupuestoId === presupuestoId && !f.rectificaId && !f.anulada)
    .sort((a, b) => String(a.fechaEmision || '').localeCompare(String(b.fechaEmision || '')) || String(a.numero || '').localeCompare(String(b.numero || '')));
  const porNumero = new Map();
  let unica = null;
  const sinMarca = [];
  for (const f of propias) {
    const texto = String(f.tipoFactura || f.obraTitulo || '');
    const m = texto.match(MARCA_CERT);
    if (MARCA_UNICA.test(texto)) unica = f;
    else if (m && !porNumero.has(Number(m[1]))) porNumero.set(Number(m[1]), f);
    else sinMarca.push(f);
  }
  // Facturas anteriores a esta regla (sin marca): ocupan los primeros huecos, por orden de emisión.
  for (const f of sinMarca) {
    let n = 1;
    while (porNumero.has(n)) n += 1;
    porNumero.set(n, f);
  }
  return { porNumero, unica };
}

/**
 * Siguiente certificación que se puede facturar: { n, item, total, base, ultima, unicaPermitida, cerrado }.
 * `base` es el importe obligatorio si el plan es fijo (la última, lo que quede pendiente);
 * null si el importe es libre.
 */
export function siguienteCertificacion(presupuesto, facturas = [], pendiente = null) {
  const plan = planCertificaciones(presupuesto);
  const { porNumero, unica } = certificacionesEmitidas(facturas, presupuesto?.id);
  let n = 1;
  while (porNumero.has(n)) n += 1;
  const total = plan.fijo ? plan.items.length : null;
  const cerrado = Boolean(unica) || (plan.fijo && n > total);
  const item = plan.fijo ? plan.items[n - 1] || null : null;
  const ultima = plan.fijo && n === total;
  let base = null;
  if (item) {
    base = ultima && pendiente !== null
      ? redondear(pendiente)
      : redondear((Number(presupuesto?.baseImponible || 0) * item.pct) / 100);
  }
  return { n, item, total, base, ultima, plan, emitidas: porNumero, unicaPermitida: !unica && porNumero.size === 0, cerrado };
}

/** Texto que encabeza el concepto de la factura (el servidor lo usa para saber qué certificación es). */
export function etiquetaCertificacion({ n, total, item, unica = false }) {
  if (unica) return 'Factura única (100 %)';
  const de = total ? ` de ${total}` : '';
  return item ? `Certificación ${n}${de} (${item.pct.toLocaleString('es-ES')} % ${item.texto})`.replace(/\s+\)/, ')') : `Certificación ${n}`;
}
