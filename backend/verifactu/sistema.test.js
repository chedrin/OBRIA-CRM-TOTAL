import test from "node:test";
import assert from "node:assert/strict";
import { declaracionResponsable, fechaLarga, TITULO_DECLARACION } from "./sistema.js";

const VARS = ["VERIFACTU_PRODUCTOR_NOMBRE", "VERIFACTU_PRODUCTOR_NIF", "VERIFACTU_PRODUCTOR_DIRECCION", "VERIFACTU_DECLARACION_FECHA", "VERIFACTU_DECLARACION_LUGAR"];

function conEntorno(valores, fn) {
  const antes = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));
  for (const v of VARS) delete process.env[v];
  Object.assign(process.env, valores);
  try { fn(); } finally {
    for (const v of VARS) { if (antes[v] === undefined) delete process.env[v]; else process.env[v] = antes[v]; }
  }
}

test("declaración responsable: título y datos a) a l) en orden (art. 15 Orden HAC/1177/2024)", () => {
  conEntorno({
    VERIFACTU_PRODUCTOR_NOMBRE: "Productor Prueba", VERIFACTU_PRODUCTOR_NIF: "12345678Z",
    VERIFACTU_PRODUCTOR_DIRECCION: "C/ Mayor 1, 34001 Palencia, España",
    VERIFACTU_DECLARACION_FECHA: "2026-10-30", VERIFACTU_DECLARACION_LUGAR: "Palencia (España)"
  }, () => {
    const d = declaracionResponsable();
    assert.equal(d.titulo, TITULO_DECLARACION);
    assert.deepEqual(d.campos.map((c) => c.letra), ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]);
    assert.ok(d.campos.every((c) => c.etiqueta && c.valor));
    assert.match(d.campos[10].valor, /artículo 29\.2\.j\) de la Ley 58\/2003/);
    assert.equal(d.campos[11].valor, "En Palencia (España), a 30 de octubre de 2026.");
    assert.equal(d.completa, true);
  });
});

test("declaración responsable: sin fecha y lugar no está completa", () => {
  conEntorno({ VERIFACTU_PRODUCTOR_NOMBRE: "P", VERIFACTU_PRODUCTOR_NIF: "12345678Z", VERIFACTU_PRODUCTOR_DIRECCION: "D" }, () => {
    const d = declaracionResponsable();
    assert.equal(d.completa, false);
    assert.deepEqual(d.faltan, ["VERIFACTU_DECLARACION_FECHA", "VERIFACTU_DECLARACION_LUGAR"]);
  });
  assert.equal(fechaLarga("2026-13-01"), "");
});
