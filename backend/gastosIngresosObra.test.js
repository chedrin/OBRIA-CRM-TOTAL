import { test } from "node:test";
import assert from "node:assert/strict";
import { gastosObra, ingresosObra, resumenObra, categoriaGasto, importesGasto, trimestreDe } from "../src/utils/gastosIngresosObra.js";
import { gastoFilePath, isGastoFilePath } from "./gastosObraRoutes.js";

const obra = { id: "obra-1", presupuestoId: "p1" };
const presupuestos = [{ id: "p1", baseImponible: 10000 }];

test("gastos de la obra: manuales y facturas de subcontrata sin duplicar", () => {
  const fp = [
    { id: "g1", obraId: "obra-1", categoria: "Materiales", numeroProveedor: "A-1", baseImponible: 1000, cuotaIva: 210, total: 1210, fecha: "2026-09-01" },
    { id: "g2", obraId: "obra-1", categoria: "Estructura / Alquiler", numero: "F-77", baseImponible: 500, totalFactura: 605, estadoPago: "pagada", fecha: "2026-10-01" },
    { id: "g3", obraId: "obra-2", categoria: "Materiales", baseImponible: 999 }
  ];
  const subDocs = [
    { id: "d1", obra_id: "obra-1", kind: "factura", numero: "f 77", base_amount: 500, total_amount: 605 },
    { id: "d2", obra_id: "obra-1", kind: "factura", numero: "S-9", base_amount: 2000, iva_pct: 21, subcontractor_name: "Elec SL" },
    { id: "d3", obra_id: "obra-1", kind: "presupuesto", base_amount: 9999 },
    { id: "d4", obra_id: "obra-1", kind: "factura", base_amount: 50, is_active: false }
  ];
  const g = gastosObra("obra-1", fp, subDocs);
  assert.deepEqual(g.map((x) => x.id).sort(), ["g1", "g2", "sub-d2"]);
  assert.equal(g.find((x) => x.id === "g2").categoria, "Maquinaria");
  assert.equal(g.find((x) => x.id === "g2").pagado, true);
  assert.equal(g.find((x) => x.id === "sub-d2").total, 2420);
});

test("ingresos: sin anuladas ni borradores, con rectificativas aplicadas", () => {
  const facturas = [
    { id: "f1", obraId: "obra-1", baseImponible: 4000, totalFactura: 4400, estadoCobro: "cobrada", fechaEmision: "2026-09-10" },
    { id: "f2", obraId: "obra-1", baseImponible: 3000, totalFactura: 3300, fechaEmision: "2026-10-10" },
    { id: "f3", obraId: "obra-1", baseImponible: 1000, totalFactura: 1100, anulada: true },
    { id: "f4", obraId: "obra-1", baseImponible: 800, totalFactura: 880, status: "borrador" },
    { id: "r1", obraId: "obra-1", rectificaId: "f2", tipoRectificativa: "I", baseImponible: -1000, totalFactura: -1100, fechaEmision: "2026-10-20" }
  ];
  const i = ingresosObra("obra-1", facturas);
  assert.deepEqual(i.map((x) => [x.id, x.base]), [["f2", 2000], ["f1", 4000]]);
  assert.equal(i[0].rectificada, true);
  assert.equal(i[0].total, 2200);

  const r = resumenObra({ obra, presupuestos, facturas, facturasProveedores: [{ id: "g", obraId: "obra-1", baseImponible: 4500, total: 5445 }] });
  assert.equal(r.ingresosBase, 6000);
  assert.equal(r.gastosBase, 4500);
  assert.equal(r.resultado, 1500);
  assert.equal(r.margenPct, 25);
  assert.equal(r.cobrado, 4400);
  assert.equal(r.pendienteCobro, 2200);
  assert.equal(r.pendientePago, 5445);
  assert.equal(r.contratadoBase, 10000);
  assert.equal(r.resultadoPrevisto, 5500);
});

test("utilidades de gastos", () => {
  assert.equal(categoriaGasto("gasolina"), "Combustible");
  assert.equal(categoriaGasto("raro"), "Otros");
  assert.deepEqual(importesGasto({ base: "100,50", ivaPct: 21, retencionPct: 15 }), { baseImponible: 100.5, cuotaIva: 21.11, cuotaRetencion: 15.08, total: 106.53 });
  assert.deepEqual(trimestreDe("2026-11-01"), { trimestre: "4T", ano: 2026 });
});

test("rutas de justificantes: solo dentro de gastos/", () => {
  const p = gastoFilePath("obra 1/../x", "pdf");
  assert.ok(isGastoFilePath(p), p);
  assert.ok(!isGastoFilePath("gastos/../fichas/a.pdf"));
  assert.ok(!isGastoFilePath("fichas/x/123.pdf"));
});
