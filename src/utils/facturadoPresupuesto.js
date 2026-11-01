/**
 * ObraMaster - Cuánto se ha facturado de cada presupuesto.
 *
 * Código puro: lo usan las pantallas (barra de progreso) y el servidor
 * (backend/facturacionRoutes.js), que no deja emitir por encima del 100 %.
 *
 * Se cuenta la base imponible de las facturas vigentes del presupuesto:
 *   - una factura anulada no cuenta;
 *   - una rectificativa por diferencias suma su base (negativa si rebaja);
 *   - una rectificativa por sustitución deja la factura original con la base nueva.
 * Las facturas tienen el formato de la app (toAppInvoice): presupuestoId,
 * baseImponible, rectificaId, tipoRectificativa ('S' | 'I'), anulada.
 */

import { presupuestoVigente } from './presupuestoRevision.js';

const redondear = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Base vigente de cada factura original (las rectificativas se aplican sobre su original). */
export function basesVigentes(facturas) {
  const porId = new Map(facturas.map(f => [f.id, f]));
  // Factura original de una rectificativa (también si rectifica a otra rectificativa).
  const raiz = (f) => {
    let actual = f;
    for (let i = 0; actual?.rectificaId && i < 50; i += 1) actual = porId.get(actual.rectificaId);
    return actual;
  };
  const bases = new Map();
  for (const f of facturas) {
    if (!f.rectificaId && !f.anulada) bases.set(f.id, Number(f.baseImponible || 0));
  }
  // Las rectificativas en el orden en que se emitieron.
  const rectificativas = facturas
    .filter(f => f.rectificaId && !f.anulada)
    .sort((a, b) => String(a.fechaEmision || '').localeCompare(String(b.fechaEmision || '')) || String(a.numero || '').localeCompare(String(b.numero || '')));
  for (const r of rectificativas) {
    const original = raiz(r);
    if (!original || !bases.has(original.id)) continue;
    bases.set(original.id, r.tipoRectificativa === 'S' ? Number(r.baseImponible || 0) : bases.get(original.id) + Number(r.baseImponible || 0));
  }
  return { bases, porId };
}

/** { presupuestoId -> base facturada } con las facturas vigentes. */
export function baseFacturadaPorPresupuesto(facturas = []) {
  const { bases, porId } = basesVigentes(facturas);
  const total = new Map();
  for (const [id, base] of bases) {
    const presupuestoId = porId.get(id)?.presupuestoId;
    if (!presupuestoId) continue;
    total.set(presupuestoId, redondear((total.get(presupuestoId) || 0) + base));
  }
  return total;
}

/** Estado de facturación de un presupuesto: { total, facturado, pendiente, pct, completo }. */
export function estadoFacturacion(baseTotal, facturado) {
  const total = redondear(baseTotal);
  const hecho = redondear(facturado);
  const pendiente = redondear(Math.max(total - hecho, 0));
  const pct = total > 0 ? Math.min(Math.round((hecho / total) * 10000) / 100, 999) : 0;
  return { total, facturado: hecho, pendiente, pct, completo: total > 0 && pendiente <= 0.009 };
}

/**
 * Base que se puede facturar de un presupuesto: la de la versión que firmó el cliente.
 * Si hay una versión nueva pendiente de firma, todavía no cuenta.
 */
export function baseFacturable(presupuesto) {
  return redondear(presupuestoVigente(presupuesto)?.baseImponible);
}

/** Estado de facturación de cada presupuesto: { presupuestoId -> estadoFacturacion }. */
export function facturacionPresupuestos(presupuestos = [], facturas = []) {
  const facturado = baseFacturadaPorPresupuesto(facturas);
  return new Map(presupuestos.map(p => [p.id, estadoFacturacion(baseFacturable(p), facturado.get(p.id) || 0)]));
}

/** Suma de los presupuestos de una obra (los vinculados por obraId y el presupuesto de la obra). */
export function facturacionObra(obra, presupuestos = [], facturas = []) {
  const deLaObra = presupuestos.filter(p => (p.obraId && p.obraId === obra?.id) || (obra?.presupuestoId && p.id === obra.presupuestoId));
  const estados = facturacionPresupuestos(deLaObra, facturas);
  let total = 0;
  let facturado = 0;
  for (const e of estados.values()) {
    total += e.total;
    facturado += e.facturado;
  }
  return { ...estadoFacturacion(total, facturado), presupuestos: deLaObra.length };
}

/** Margen de redondeo admitido al comprobar el límite (dos céntimos, por los redondeos de cada certificación). */
export const MARGEN_LIMITE = 0.02;
