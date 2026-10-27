import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularHuella, cadenaRegistroAlta, cadenaRegistroAnulacion, fechaHoraHuso,
  formatFechaAeat, formatImporte, urlQr, verificarCadena
} from "./huella.js";
import { validarNif } from "./nif.js";

test("huella del ejemplo oficial de la AEAT (registro de alta, primero de la cadena)", () => {
  const cadena = cadenaRegistroAlta({
    nifEmisor: "89890001K",
    numSerie: "12345678/G33",
    fechaExpedicion: "01-01-2024",
    tipoFactura: "F1",
    cuotaTotal: 12.35,
    importeTotal: 123.45,
    huellaAnterior: "",
    fechaHoraHuso: "2024-01-01T19:20:30+01:00"
  });
  assert.equal(cadena,
    "IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024" +
    "&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00");
  assert.equal(calcularHuella(cadena), "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60");
});

// Cadena generada por emitir_factura() en PostgreSQL 16: el servidor y la base de datos deben coincidir.
const REGISTROS_SQL = [
  { id: 1, anterior_id: null, tipo_registro: "alta", nif_emisor: "12345678Z", num_serie: "F-2026-00001", fecha_expedicion: "27-10-2026", tipo_factura: "F1", cuota_total: "100.00", importe_total: "1100.00", huella_anterior: null, fecha_hora_huso: "2026-10-27T16:02:10+01:00", huella: "001401F9E335D3E9AC6B7F7B38CE31F57A21E06BEA8BC1131FC748E86897EAC0" },
  { id: 2, anterior_id: 1, tipo_registro: "alta", nif_emisor: "12345678Z", num_serie: "F-2026-00002", fecha_expedicion: "27-10-2026", tipo_factura: "F1", cuota_total: "0.00", importe_total: "500.00", huella_anterior: "001401F9E335D3E9AC6B7F7B38CE31F57A21E06BEA8BC1131FC748E86897EAC0", fecha_hora_huso: "2026-10-27T16:02:10+01:00", huella: "F298D003AF6DA6B834621D46B11D3F31A115D4925418845501DE163C891C3D02" },
  { id: 3, anterior_id: 2, tipo_registro: "alta", nif_emisor: "12345678Z", num_serie: "R-2026-00001", fecha_expedicion: "27-10-2026", tipo_factura: "R1", cuota_total: "-10.00", importe_total: "-110.00", huella_anterior: "F298D003AF6DA6B834621D46B11D3F31A115D4925418845501DE163C891C3D02", fecha_hora_huso: "2026-10-27T16:02:10+01:00", huella: "0E2FF95F1BE8657DED01E3F5003043376D3D11504A98CD605541C649582E98D0" }
];

test("verificarCadena acepta la cadena calculada por la base de datos", () => {
  assert.deepEqual(verificarCadena(REGISTROS_SQL), { ok: true, errores: [] });
});

test("verificarCadena detecta un importe cambiado y un registro borrado", () => {
  const cambiado = REGISTROS_SQL.map((r) => (r.id === 2 ? { ...r, importe_total: "5000.00" } : r));
  assert.deepEqual(verificarCadena(cambiado).errores, [{ id: 2, motivo: "La huella no corresponde a los datos del registro." }]);

  const sinElSegundo = REGISTROS_SQL.filter((r) => r.id !== 2);
  assert.deepEqual(verificarCadena(sinElSegundo).errores, [{ id: 3, motivo: "No enlaza con el registro anterior." }]);
});

test("cadena de anulación", () => {
  assert.equal(
    cadenaRegistroAnulacion({ nifEmisor: "89890001K", numSerie: "12345679/G34", fechaExpedicion: "2024-01-01", huellaAnterior: "ABC", fechaHoraHuso: "2024-01-01T19:20:40+01:00" }),
    "IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34&FechaExpedicionFacturaAnulada=01-01-2024&Huella=ABC&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00"
  );
});

test("formatos de importe, fecha y huso horario", () => {
  assert.equal(formatImporte(12.3), "12.30");
  assert.equal(formatImporte(-3), "-3.00");
  assert.equal(formatImporte(-0.001), "0.00");
  assert.equal(formatImporte("1100.00"), "1100.00");
  assert.equal(formatFechaAeat("2027-06-01"), "01-06-2027");
  assert.equal(fechaHoraHuso(new Date("2024-01-01T18:20:30Z")), "2024-01-01T19:20:30+01:00");
  assert.equal(fechaHoraHuso(new Date("2027-07-01T08:00:00.900Z")), "2027-07-01T10:00:00+02:00");
});

test("URL del QR (igual que la que guarda emitir_factura)", () => {
  assert.equal(
    urlQr({ nif: "12345678Z", numSerie: "F-2026-00001", fechaExpedicion: "2026-10-27", importeTotal: 1100, entorno: "pruebas" }),
    "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=12345678Z&numserie=F-2026-00001&fecha=27-10-2026&importe=1100.00"
  );
  assert.equal(
    urlQr({ nif: "89890001K", numSerie: "12345678&G33", fechaExpedicion: "01-01-2024", importeTotal: 241.4, entorno: "produccion" }),
    "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%26G33&fecha=01-01-2024&importe=241.40"
  );
});

test("validación de NIF", () => {
  assert.equal(validarNif("12345678Z").valido, true);
  assert.equal(validarNif("12345678-a").valido, false);
  assert.equal(validarNif("x1234567l").valido, true);
  assert.equal(validarNif("B-12345674").valido, true);
  assert.equal(validarNif("B12345675").valido, false);
  assert.equal(validarNif("P1234567D").valido, true);
  assert.equal(validarNif("").valido, false);
});
