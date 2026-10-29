import test from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { crearXlsx } from "./xlsx.js";

// Lee las entradas del ZIP a partir del directorio central.
function leerZip(buf) {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const archivos = {};
  for (let i = 0; i < total; i += 1) {
    const largoNombre = buf.readUInt16LE(p + 28);
    const offset = buf.readUInt32LE(p + 42);
    const nombre = buf.toString("utf8", p + 46, p + 46 + largoNombre);
    const tam = buf.readUInt32LE(p + 20);
    const ini = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
    archivos[nombre] = zlib.inflateRawSync(buf.subarray(ini, ini + tam)).toString("utf8");
    p += 46 + largoNombre + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return archivos;
}

test("xlsx: hojas, números y texto sin fórmulas", () => {
  const buf = crearXlsx([
    { nombre: "Envíos", columnas: ["Fecha", "Registros"], filas: [["29/10/2026", 3], ["=CMD()", 1]] },
    { nombre: "Registros", columnas: ["Factura"], filas: [] }
  ]);
  const zip = leerZip(buf);
  assert.ok(zip["[Content_Types].xml"].includes("sheet2.xml"));
  assert.match(zip["xl/workbook.xml"], /name="Envíos"/);
  const hoja = zip["xl/worksheets/sheet1.xml"];
  assert.match(hoja, /<c r="B2"><v>3<\/v><\/c>/);
  assert.match(hoja, /t="inlineStr"><is><t xml:space="preserve">=CMD\(\)<\/t>/);
  assert.doesNotMatch(hoja, /<f>/);
});
