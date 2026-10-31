import { test } from "node:test";
import assert from "node:assert/strict";
import { flattenPlan, subcontractMargins, itemKey, effectiveAssignments } from "../src/utils/avanceObra.js";

const obra = {
  fases: [
    { id: "f1", nombre: "Albañilería", tareas: [
      { id: "t1", titulo: "Tabique", importeTotal: 1000 },
      { id: "t2", titulo: "Solado", importeTotal: 3000 }
    ] },
    { id: "f2", nombre: "Fontanería", importeTotal: 2000, tareas: [] },
    { id: "f3", nombre: "Pintura", tareas: [{ id: "t3", titulo: "Pintar", importeTotal: 500 }] }
  ]
};
const plan = flattenPlan(obra);
const doc = (fase_id, partida_id, kind, base_amount) => ({ fase_id, partida_id, kind, base_amount });

test("partida con presupuesto y factura: manda la factura", () => {
  const { byKey } = subcontractMargins(plan, [doc("f1", "t2", "presupuesto", 2500), doc("f1", "t2", "factura", 2700)]);
  const m = byKey.get(itemKey("f1", "t2"));
  assert.equal(m.ingreso, 3000);
  assert.equal(m.coste, 2700);
  assert.equal(m.beneficio, 300);
  assert.equal(m.pct, 10);
  assert.equal(m.fuente, "factura");
  assert.equal(m.desviacion, 200);
  // La fase solo cuenta lo cubierto por documentos (la partida t2).
  assert.equal(byKey.get(itemKey("f1", "")).ingreso, 3000);
});

test("documento de fase cubre toda la fase y suma a los de partida", () => {
  const { byKey, obra: total } = subcontractMargins(plan, [doc("f1", "", "presupuesto", 3500), doc("f1", "t1", "factura", 600)]);
  const f = byKey.get(itemKey("f1", ""));
  assert.equal(f.ingreso, 4000);
  assert.equal(f.coste, 4100);
  assert.equal(f.beneficio, -100);
  assert.equal(f.fuente, "mixto");
  assert.equal(total.beneficio, -100);
});

test("fase sin partidas y obra total; sin documentos no hay margen", () => {
  const { byKey, obra: total } = subcontractMargins(plan, [doc("f2", "", "presupuesto", 1500), doc("f1", "t1", "presupuesto", 800)]);
  assert.equal(byKey.get(itemKey("f2", "")).beneficio, 500);
  assert.equal(byKey.has(itemKey("f3", "")), false);
  assert.equal(total.ingreso, 3000);
  assert.equal(total.beneficio, 700);
  assert.equal(subcontractMargins(plan, []).obra, null);
});

test("asignación de fase se hereda y la de partida la sustituye", () => {
  const map = effectiveAssignments(plan, [
    { id: "a1", fase_id: "f1", partida_id: "", assignee_type: "subcontrata", assignee_name: "Sub A" },
    { id: "a2", fase_id: "f1", partida_id: "t2", assignee_type: "obrero_interno", obrero_id: "o1", assignee_name: "Juan" }
  ]);
  assert.deepEqual(map.get(itemKey("f1", "t1")).map((a) => [a.id, a.heredada]), [["a1", true]]);
  assert.deepEqual(map.get(itemKey("f1", "t2")).map((a) => a.id), ["a2"]);
});
