import test from "node:test";
import assert from "node:assert/strict";
import { conRevision, datosNuevaAceptacion, datosNuevaVersion, presupuestoVigente } from "../src/utils/presupuestoRevision.js";
import { baseFacturable, facturacionPresupuestos } from "../src/utils/facturadoPresupuesto.js";

const firmado = { id: "p1", numero: "PRES-1", estado: "aceptado", version: 1, baseImponible: 10000, totalConIva: 11000, partidas: [] };

test("subir el presupuesto firmado no deja facturar más hasta que el cliente firme la versión nueva", () => {
  const revisado = { ...firmado, ...conRevision(firmado, { baseImponible: 15000, totalConIva: 16500 }) };
  assert.equal(revisado.pendienteNuevaAceptacion, true);
  assert.equal(revisado.version, 2);
  assert.equal(baseFacturable(revisado), 10000);
  const e = facturacionPresupuestos([revisado], [{ id: "a", presupuestoId: "p1", baseImponible: 10000 }]).get("p1");
  assert.equal(e.completo, true);

  const aceptado = { ...revisado, ...datosNuevaAceptacion(revisado) };
  assert.equal(baseFacturable(aceptado), 15000);
  assert.equal(facturacionPresupuestos([aceptado], [{ id: "a", presupuestoId: "p1", baseImponible: 10000 }]).get("p1").pendiente, 5000);
});

test("las versiones anteriores quedan guardadas con su contenido", () => {
  const v2 = { ...firmado, ...conRevision(firmado, { baseImponible: 12000 }) };
  const v2b = { ...v2, ...conRevision(v2, { baseImponible: 13000 }) };
  assert.equal(v2b.versiones.length, 1, "seguir editando la versión sin firmar no crea otra");
  const v2ok = { ...v2b, ...datosNuevaAceptacion(v2b) };
  const v3 = { ...v2ok, ...datosNuevaVersion(v2ok) };
  assert.deepEqual(v3.versiones.map(v => [v.version, v.baseImponible]), [[1, 10000], [2, 13000]]);
  assert.equal(v3.versiones[0].contenido.baseImponible, 10000);
  assert.equal(v3.version, 3);
  assert.equal(presupuestoVigente(v3).baseImponible, 13000);
});

test("no se abre otra versión mientras hay una sin firmar", () => {
  const v2 = { ...firmado, ...datosNuevaVersion(firmado) };
  assert.equal(v2.pendienteNuevaAceptacion, true);
  assert.equal(datosNuevaVersion(v2), null);
});

test("un borrador también guarda su versión anterior, sin pedir firma", () => {
  const borrador = { ...firmado, estado: "borrador" };
  const v2 = { ...borrador, ...datosNuevaVersion(borrador) };
  assert.equal(v2.version, 2);
  assert.equal(v2.versiones.length, 1);
  assert.equal(v2.pendienteNuevaAceptacion, undefined);
});

import { contemplaEnPresupuestos, cambiosAnadirNecesidad } from "../src/utils/necesidadPresupuesto.js";

const conPartidas = {
  ...firmado,
  tipoIvaPct: 10,
  margenGlobalPct: 25,
  capitulos: [{ id: "c1", nombre: "Alicatados", partidas: [
    { id: "x1", concepto: "Alicatado de baño con azulejo cerámico", cantidad: 20, unidad: "m2", costeUnitario: 30, margenPct: 25, precioVenta: 37.5, total: 750 }
  ] }]
};

test("una necesidad que ya está en una partida sale como contemplada", () => {
  const r = contemplaEnPresupuestos("Azulejos cerámicos para el baño", [conPartidas]);
  assert.equal(r.contemplado, true);
  assert.equal(r.partidas[0].id, "x1");
  assert.equal(contemplaEnPresupuestos("Plato de ducha resina", [conPartidas]).contemplado, false);
});

test("añadir la necesidad al presupuesto crea la partida en Ampliaciones y suma la base", () => {
  const { partida, cambios } = cambiosAnadirNecesidad(conPartidas, { concepto: "Plato de ducha", cantidad: 2, unidad: "ud", costeEstimado: 400 });
  assert.equal(partida.costeUnitario, 200);
  assert.equal(partida.total, 500);
  assert.equal(cambios.baseImponible, 1250);
  assert.ok(cambios.capitulos.some(c => c.nombre === "Ampliaciones de obra"));
  // Al ser un presupuesto firmado, el cambio crea versión nueva pendiente de firma.
  const v2 = { ...conPartidas, ...conRevision(conPartidas, cambios) };
  assert.equal(v2.pendienteNuevaAceptacion, true);
  assert.equal(presupuestoVigente(v2).baseImponible, 10000);
});
