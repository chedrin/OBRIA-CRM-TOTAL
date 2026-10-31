import { test } from "node:test";
import assert from "node:assert/strict";
import {
  docStatus,
  requirementStatus,
  obraCompliance,
  companyCompliance,
  subcontractorsInObra,
  requiredFor,
  DEFAULT_REQUIRED
} from "../src/utils/documentacionSubcontratas.js";

const HOY = "2026-10-31";

test("estado de un documento según su caducidad", () => {
  assert.equal(docStatus({ fecha_caducidad: "2026-10-30" }, HOY), "caducado");
  assert.equal(docStatus({ fecha_caducidad: "2026-10-31" }, HOY), "por_caducar");
  assert.equal(docStatus({ fecha_caducidad: "2026-11-30" }, HOY), "por_caducar");
  assert.equal(docStatus({ fecha_caducidad: "2026-12-01" }, HOY), "vigente");
  assert.equal(docStatus({ fecha_caducidad: null }, HOY), "sin_caducidad");
});

test("se queda con el mejor documento y respeta empresa frente a obra", () => {
  const docs = [
    { id: "a", subcontractor_id: "s1", doc_type: "aeat", obra_id: "", fecha_caducidad: "2026-09-01" },
    { id: "b", subcontractor_id: "s1", doc_type: "aeat", obra_id: "", fecha_caducidad: "2027-05-01" },
    { id: "c", subcontractor_id: "s1", doc_type: "adhesion_pss", obra_id: "obra-1" },
    { id: "d", subcontractor_id: "s1", doc_type: "tgss", obra_id: "", fecha_caducidad: "2027-05-01", is_active: false }
  ];
  assert.equal(requirementStatus(docs, "s1", "aeat", "obra-1", HOY).doc.id, "b");
  assert.equal(requirementStatus(docs, "s1", "adhesion_pss", "obra-1", HOY).status, "sin_caducidad");
  assert.equal(requirementStatus(docs, "s1", "adhesion_pss", "obra-2", HOY).status, "falta");
  assert.equal(requirementStatus(docs, "s1", "tgss", "obra-1", HOY).status, "falta");
  assert.equal(requirementStatus(docs, "s2", "aeat", "obra-1", HOY).status, "falta");
});

test("subcontratas de una obra: asignaciones, presupuestos y a mano, menos las quitadas", () => {
  const subs = [
    { id: "s1", presupuestosVinculados: [{ obraId: "obra-1", estado: "aprobado" }] },
    { id: "s2", presupuestosVinculados: [{ obraId: "obra-1", estado: "rechazado" }] },
    { id: "s3" }
  ];
  const assignments = [{ obra_id: "obra-1", subcontractor_id: "s3" }, { obra_id: "obra-2", subcontractor_id: "s2" }];
  const requirements = [{ obra_id: "obra-1", subcontractor_ids: ["s4"], excluded_ids: ["s3"] }];
  const ids = subcontractorsInObra({ obraId: "obra-1", subcontractors: subs, assignments, requirements }).map((r) => r.id);
  assert.deepEqual(ids.sort(), ["s1", "s4"]);
});

test("control de obra: apto, aviso o no apto", () => {
  const requirements = [{ obra_id: "obra-1", doc_types: ["aeat", "adhesion_pss"], subcontractor_ids: ["s1", "s2", "s3"] }];
  const docs = [
    { subcontractor_id: "s1", doc_type: "aeat", obra_id: "", fecha_caducidad: "2027-06-01" },
    { subcontractor_id: "s1", doc_type: "adhesion_pss", obra_id: "obra-1" },
    { subcontractor_id: "s2", doc_type: "aeat", obra_id: "", fecha_caducidad: "2026-11-10" },
    { subcontractor_id: "s2", doc_type: "adhesion_pss", obra_id: "obra-1" },
    { subcontractor_id: "s3", doc_type: "aeat", obra_id: "", fecha_caducidad: "2026-01-01" }
  ];
  const { required, rows } = obraCompliance({ obraId: "obra-1", requirements, docs, today: HOY });
  assert.deepEqual(required, ["aeat", "adhesion_pss"]);
  const byId = Object.fromEntries(rows.map((r) => [r.subcontractorId, r.estado]));
  assert.deepEqual(byId, { s1: "apto", s2: "aviso", s3: "no_apto" });
});

test("por defecto se piden los documentos estándar y la ficha solo mira los de empresa", () => {
  assert.deepEqual(requiredFor([], "obra-9"), DEFAULT_REQUIRED);
  const c = companyCompliance([], "s1", HOY);
  assert.ok(c.items.every((it) => it.type !== "adhesion_pss"));
  assert.equal(c.estado, "no_apto");
});
