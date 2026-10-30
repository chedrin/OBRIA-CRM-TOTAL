import test from "node:test";
import assert from "node:assert/strict";
import { planCertificaciones, siguienteCertificacion, etiquetaCertificacion } from "../../src/utils/certificaciones.js";

const pres = { id: "p1", baseImponible: 10000, condicionesPago: "40% firma · 40% avance de obra · 20% entrega" };
const fac = (id, desc, base, extra = {}) => ({ id, numero: id, presupuestoId: "p1", tipoFactura: desc, baseImponible: base, fechaEmision: "2026-10-30", ...extra });

test("el plan sale de las condiciones de pago", () => {
  const plan = planCertificaciones(pres);
  assert.equal(plan.fijo, true);
  assert.deepEqual(plan.items.map((c) => [c.n, c.pct, c.texto]), [[1, 40, "firma"], [2, 40, "avance de obra"], [3, 20, "entrega"]]);
  assert.equal(planCertificaciones({ condicionesPago: "Certificaciones mensuales según avance" }).fijo, false);
  assert.equal(planCertificaciones({}).items.length, 3);
});

test("en orden: primero la 1, luego la 2; la última es lo pendiente", () => {
  let s = siguienteCertificacion(pres, [], 10000);
  assert.equal(s.n, 1);
  assert.equal(s.base, 4000);
  assert.equal(s.unicaPermitida, true);
  assert.equal(etiquetaCertificacion(s), "Certificación 1 de 3 (40 % firma)");

  const facturas = [fac("F-1", "Certificación 1 de 3 (40 % firma) · Baño", 4000)];
  s = siguienteCertificacion(pres, facturas, 6000);
  assert.equal(s.n, 2);
  assert.equal(s.unicaPermitida, false);
  assert.equal(s.emitidas.get(1).numero, "F-1");

  facturas.push(fac("F-2", "Certificación 2 de 3 (40 % avance de obra) · Baño", 4000));
  s = siguienteCertificacion(pres, facturas, 1999.99);
  assert.equal(s.n, 3);
  assert.equal(s.ultima, true);
  assert.equal(s.base, 1999.99);

  facturas.push(fac("F-3", "Certificación 3 de 3 (20 % entrega) · Baño", 1999.99));
  assert.equal(siguienteCertificacion(pres, facturas, 0).cerrado, true);
});

test("una certificación anulada se puede volver a facturar; las rectificativas no cuentan", () => {
  const facturas = [
    fac("F-1", "Certificación 1 de 3 (40 % firma)", 4000, { anulada: true }),
    fac("R-1", "Rectifica a F-1", -100, { rectificaId: "F-1" })
  ];
  assert.equal(siguienteCertificacion(pres, facturas, 10000).n, 1);
});

test("facturas antiguas sin marca ocupan las primeras certificaciones; la factura única cierra", () => {
  assert.equal(siguienteCertificacion(pres, [fac("F-0", "Anticipo 40% · Baño", 4000)], 6000).n, 2);
  assert.equal(siguienteCertificacion(pres, [fac("F-9", "Factura única (100 %) · Baño", 10000)], 0).cerrado, true);
});
