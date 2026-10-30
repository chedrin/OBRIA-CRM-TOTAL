import test from "node:test";
import assert from "node:assert/strict";
import { baseFacturadaPorPresupuesto, estadoFacturacion, facturacionObra } from "../../src/utils/facturadoPresupuesto.js";

const f = (id, base, extra = {}) => ({ id, presupuestoId: "p1", baseImponible: base, fechaEmision: "2026-10-30", ...extra });

test("anticipo del 40 % y después el 100 %: se pasa del presupuesto", () => {
  const facturas = [f("a", 4000)];
  assert.equal(baseFacturadaPorPresupuesto(facturas).get("p1"), 4000);
  const despues = baseFacturadaPorPresupuesto([...facturas, f("b", 10000)]).get("p1");
  assert.equal(despues, 14000);
  assert.deepEqual(estadoFacturacion(10000, 4000), { total: 10000, facturado: 4000, pendiente: 6000, pct: 40, completo: false });
});

test("las anuladas no cuentan y las rectificativas corrigen la base", () => {
  const facturas = [
    f("a", 4000),
    f("b", 6000, { anulada: true }),
    f("c", 5000),
    f("r1", -500, { rectificaId: "c", tipoRectificativa: "I", fechaEmision: "2026-10-31" }),
    f("r2", 3000, { rectificaId: "a", tipoRectificativa: "S", fechaEmision: "2026-11-01" })
  ];
  // a queda en 3000 (sustitución), c en 4500 (diferencias), b anulada.
  assert.equal(baseFacturadaPorPresupuesto(facturas).get("p1"), 7500);
  assert.equal(estadoFacturacion(10000, 7500).pendiente, 2500);
});

test("40 + 40 + 20 cierra el presupuesto", () => {
  const e = estadoFacturacion(10000, baseFacturadaPorPresupuesto([f("a", 4000), f("b", 4000), f("c", 2000)]).get("p1"));
  assert.equal(e.completo, true);
  assert.equal(e.pct, 100);
});

test("la obra suma sus presupuestos", () => {
  const presupuestos = [{ id: "p1", obraId: "o1", baseImponible: 10000 }, { id: "p2", baseImponible: 2000 }, { id: "p3", obraId: "o2", baseImponible: 999 }];
  const facturas = [f("a", 4000), f("b", 2000, { presupuestoId: "p2" })];
  const e = facturacionObra({ id: "o1", presupuestoId: "p2" }, presupuestos, facturas);
  assert.equal(e.total, 12000);
  assert.equal(e.facturado, 6000);
  assert.equal(e.presupuestos, 2);
});
