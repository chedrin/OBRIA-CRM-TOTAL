/**
 * ObraMaster - Libro registro de facturas expedidas (CSV para la gestoría o el
 * programa de contabilidad) y resumen trimestral del IVA repercutido.
 *
 * Las facturas anuladas aparecen en el libro marcadas como anuladas, pero no suman.
 * Una rectificativa por sustitución suma la diferencia con la original.
 */

const COLUMNAS = [
  "Ejercicio", "Periodo", "Fecha expedición", "Fecha operación", "Número", "Tipo",
  "Tipo rectificativa", "Factura rectificada", "NIF destinatario", "Nombre destinatario",
  "Concepto", "Base imponible", "Tipo IVA %", "Cuota IVA", "Inversión sujeto pasivo",
  "Retención IRPF %", "Cuota IRPF", "Total factura", "Estado AEAT", "Anulada"
];

const num = (v) => (Math.round(Number(v || 0) * 100) / 100).toFixed(2).replace(".", ",");

function celda(value) {
  const text = String(value ?? "");
  // Evita que Excel interprete el texto como fórmula.
  const seguro = /^[=+\-@\t\r]/.test(text) && !/^-?\d/.test(text) ? `'${text}` : text;
  return /[;"\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

export function trimestreDe(fecha) {
  return `${Math.ceil(Number(String(fecha).slice(5, 7)) / 3)}T`;
}

/** Importes con efecto fiscal: en una sustitución, la diferencia con la factura original. */
export function efecto(f) {
  if (f.anulada) return { base: 0, cuota: 0, irpf: 0 };
  if (f.tipo_rectificativa === "S") {
    return {
      base: Number(f.base_imponible) - Number(f.base_rectificada || 0),
      cuota: Number(f.cuota_iva) - Number(f.cuota_rectificada || 0),
      irpf: Number(f.cuota_irpf)
    };
  }
  return { base: Number(f.base_imponible), cuota: Number(f.cuota_iva), irpf: Number(f.cuota_irpf) };
}

/**
 * @param facturas  filas de invoices emitidas, ordenadas por fecha
 * @param numeros   Map id -> num_serie (para las rectificadas)
 * @param estados   Map invoice_id -> estado_envio del último registro
 */
export function libroExpedidasCsv(facturas, { numeros = new Map(), estados = new Map() } = {}) {
  const filas = facturas.map((f) => [
    String(f.fecha_expedicion).slice(0, 4),
    trimestreDe(f.fecha_expedicion),
    f.fecha_expedicion,
    f.fecha_operacion || "",
    f.num_serie,
    f.tipo_factura,
    f.tipo_rectificativa || "",
    f.rectifica_invoice_id ? numeros.get(f.rectifica_invoice_id) || "" : "",
    f.cliente_nif,
    f.cliente_nombre,
    f.descripcion,
    num(f.base_imponible),
    num(f.isp ? 0 : f.iva_pct),
    num(f.cuota_iva),
    f.isp ? "S" : "N",
    num(f.irpf_pct),
    num(f.cuota_irpf),
    num(f.importe_total),
    estados.get(f.id) || "",
    f.anulada ? "S" : "N"
  ].map(celda).join(";"));
  // BOM para que Excel abra bien los acentos.
  return "﻿" + [COLUMNAS.join(";"), ...filas].join("\r\n") + "\r\n";
}

/** Resumen del trimestre: bases y cuotas por tipo, inversión del sujeto pasivo y retenciones. */
export function resumenTrimestral(facturas) {
  const porTipo = new Map();
  let baseIsp = 0;
  let retenciones = 0;
  let numFacturas = 0;
  let anuladas = 0;
  for (const f of facturas) {
    if (f.anulada) { anuladas++; continue; }
    numFacturas++;
    const e = efecto(f);
    retenciones += e.irpf;
    if (f.isp) {
      baseIsp += e.base;
      continue;
    }
    const pct = Number(f.iva_pct);
    const acc = porTipo.get(pct) || { tipoPct: pct, base: 0, cuota: 0 };
    acc.base += e.base;
    acc.cuota += e.cuota;
    porTipo.set(pct, acc);
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  const tipos = [...porTipo.values()].sort((a, b) => b.tipoPct - a.tipoPct).map((t) => ({ ...t, base: r2(t.base), cuota: r2(t.cuota) }));
  return {
    facturas: numFacturas,
    anuladas,
    tipos,
    totalBase: r2(tipos.reduce((s, t) => s + t.base, 0)),
    totalCuota: r2(tipos.reduce((s, t) => s + t.cuota, 0)),
    baseInversionSujetoPasivo: r2(baseIsp),
    retencionesIrpf: r2(retenciones)
  };
}
