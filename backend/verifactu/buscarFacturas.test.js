import test from "node:test";
import assert from "node:assert/strict";
import { textoFactura, coincideBusqueda, tipoDeFactura } from "../../src/utils/buscarFacturas.js";

const f = {
  id: "a", numero: "F-2026-00012", tipoFactura: "Certificación 2 de 3 (40 % avance de obra) · Reforma baño",
  cliente: "José Martínez", cifNif: "12345678Z", fechaEmision: "2026-10-30", trimestre: "4T", ano: 2026,
  baseImponible: 1234.5, tipoIvaPct: 10, cuotaIva: 123.45, importeTotal: 1357.95, totalFactura: 1357.95,
  estadoCobro: "pendiente", aeat: { estado: "aceptado", csv: "A-WTG6Y75" }, lineas: [{ concepto: "Alicatado", importe: 300 }]
};

test("encuentra por cualquier dato, sin acentos y con varias palabras", () => {
  const t = textoFactura(f, { obraNombre: "OB-7 - Casa Rural", presupuestoNumero: "PRE-2026-004" });
  for (const q of ["F-2026-00012", "jose martinez", "12345678z", "certificacion 2", "30/10/2026", "1.357,95", "1357.95",
    "alicatado", "casa rural", "PRE-2026-004", "a-wtg6y75", "pendiente de cobro", "4T 2026", "baño jose"]) {
    assert.ok(coincideBusqueda(t, q), q);
  }
  assert.equal(coincideBusqueda(t, "jose garcia"), false);
});

test("tipo de factura", () => {
  assert.equal(tipoDeFactura(f), "certificacion");
  assert.equal(tipoDeFactura({ tipoFactura: "Factura única (100 %) · x" }), "unica");
  assert.equal(tipoDeFactura({ rectificaId: "a", tipoFactura: "Rectifica a F-1" }), "rectificativa");
  assert.equal(tipoDeFactura({ tipoFactura: "Reparación" }), "ordinaria");
});
