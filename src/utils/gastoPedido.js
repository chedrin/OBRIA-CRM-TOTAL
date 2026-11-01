/**
 * ObraMaster - Gasto de un pedido a proveedor entregado.
 *
 * Código puro (lo usan Avisos > Pedidos, la ficha de la obra y los tests del servidor).
 *
 * Al recibir el material se pide el precio o la factura del proveedor. Con el importe se crea
 * un gasto en "facturas_proveedores" (app_records) por cada obra del pedido, con
 * pedidoId = id del pedido. Así:
 *   - Gastos vs Ingresos de la obra lo cuenta una sola vez (es el mismo registro de siempre).
 *   - Al editar el precio después se actualizan esos mismos gastos (no se crean otros).
 * Sin importe no hay gasto: el pedido queda "pendiente de precio".
 */
import { importesGasto } from './gastosIngresosObra.js';

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const num = (v) => Number(String(v ?? '').replace(',', '.'));

export const obraIdsPedido = (o) => (o?.obra_ids?.length ? o.obra_ids : [o?.obra_id].filter(Boolean));

/** Gastos ya creados a partir del pedido. */
export const gastosDePedido = (facturasProveedores = [], pedidoId) =>
  facturasProveedores.filter((f) => f && pedidoId && f.pedidoId === pedidoId);

/** Pedido entregado que todavía no tiene precio ni factura: no cuenta en los gastos. */
export const pedidoPendienteDePrecio = (order, facturasProveedores = []) =>
  order?.status === 'entregado' && gastosDePedido(facturasProveedores, order.id).length === 0;

/** Reparte una base entre obras en partes iguales; el último se lleva los céntimos. */
export function repartoIgual(base, obraIds = []) {
  const n = obraIds.length;
  if (!n) return {};
  const total = r2(base);
  const parte = Math.floor((total / n) * 100) / 100;
  return Object.fromEntries(obraIds.map((id, i) => [id, i === n - 1 ? r2(total - parte * (n - 1)) : parte]));
}

/**
 * Valida los datos que se piden al recibir el material.
 * Devuelve { error } o { bases: { obraId: base } }.
 */
export function validarPrecioPedido({ base, obraIds = [], reparto = null }) {
  if (!obraIds.length) return { error: 'El pedido no tiene obra: no se puede asignar el gasto.' };
  const total = num(base);
  if (String(base ?? '').trim() === '' || !Number.isFinite(total) || total < 0) {
    return { error: 'Escribe el importe sin IVA que ha cobrado el proveedor (está en su factura o albarán).' };
  }
  if (obraIds.length === 1) return { bases: { [obraIds[0]]: r2(total) } };
  const bases = {};
  for (const id of obraIds) {
    const v = num(reparto?.[id]);
    if (!Number.isFinite(v) || v < 0) return { error: 'Revisa el reparto del importe entre las obras.' };
    bases[id] = r2(v);
  }
  const suma = r2(Object.values(bases).reduce((s, v) => s + v, 0));
  if (Math.abs(suma - r2(total)) > 0.01) return { error: `El reparto entre obras suma ${suma.toFixed(2)} € y el importe es ${r2(total).toFixed(2)} €.` };
  return { bases };
}

/** Datos del gasto de una obra (sin id: lo pone addFacturaProveedor). */
export function datosGastoPedido({ order, obra, base, ivaPct = 21, numero = '', fecha, proveedor = '', cif = '', adjunto = null, concepto = '' }) {
  const imp = importesGasto({ base, ivaPct, retencionPct: 0 });
  const materiales = (order?.items || []).map((it) => [it.cantidad, it.unidad, it.material].filter(Boolean).join(' ')).join(', ');
  return {
    pedidoId: order.id,
    obraId: obra?.id || order.obra_id,
    obraTitulo: obra?.titulo || '',
    categoria: 'Materiales',
    proveedor: proveedor || 'Proveedor',
    cif,
    numeroProveedor: String(numero || '').trim(),
    concepto: concepto || `Pedido entregado${materiales ? `: ${materiales}` : ''}`.slice(0, 300),
    fecha: fecha || new Date().toISOString().slice(0, 10),
    baseImponible: imp.baseImponible,
    tipoIvaPct: Number(ivaPct) || 0,
    cuotaIva: imp.cuotaIva,
    retencionIrpfPct: 0,
    cuotaRetencion: 0,
    total: imp.total,
    totalFactura: imp.total,
    adjunto
  };
}

/**
 * Qué hay que crear, actualizar y quitar en facturas_proveedores para dejar el pedido con
 * estas bases por obra. Los gastos existentes del pedido se reutilizan por obra.
 */
export function planGastosPedido({ order, obras = [], bases, existentes = [], ...datos }) {
  const crear = [];
  const actualizar = [];
  const porObra = new Map(existentes.map((g) => [g.obraId, g]));
  for (const [obraId, base] of Object.entries(bases)) {
    const obra = obras.find((o) => o.id === obraId) || { id: obraId };
    const g = datosGastoPedido({ order, obra, base, ...datos });
    const previo = porObra.get(obraId);
    if (previo) {
      // Se conserva lo que se haya cambiado a mano en la obra (estado de pago, concepto).
      const { concepto, ...resto } = g;
      actualizar.push({ id: previo.id, changes: { ...resto, adjunto: datos.adjunto ?? previo.adjunto ?? null } });
      porObra.delete(obraId);
    } else {
      crear.push({ ...g, estadoPago: 'pendiente' });
    }
  }
  return { crear, actualizar, quitar: [...porObra.values()].map((g) => g.id) };
}
