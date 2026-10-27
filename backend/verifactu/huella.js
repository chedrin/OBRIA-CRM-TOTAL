/**
 * ObraMaster - Huella (hash) VeriFactu y código QR de la AEAT
 *
 * La huella de cada registro de facturación es el SHA-256 (hexadecimal en
 * mayúsculas) de una cadena "Campo=valor" unida por "&", que incluye la huella
 * del registro anterior. Así cualquier cambio, borrado o hueco rompe la cadena.
 *
 * Al emitir, la huella la calcula la base de datos (emitir_factura() en
 * supabase_schema_facturacion.sql) dentro de la misma transacción que el número.
 * Este módulo hace exactamente el mismo cálculo para verificar la cadena,
 * para los registros de anulación y para el QR. Las pruebas comprueban que los
 * dos dan el mismo resultado y que coinciden con el ejemplo oficial de la AEAT.
 */

import crypto from "node:crypto";

export const QR_BASE_URL = {
  pruebas: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  produccion: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR"
};

const clean = (value) => String(value ?? "").trim();

/** Importe con dos decimales y punto: 12.3 -> "12.30", -3 -> "-3.00". */
export function formatImporte(value) {
  const cents = Math.round(Number(value) * 100);
  if (!Number.isFinite(cents)) throw new Error(`Importe no válido: ${value}`);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "2027-06-01" (o Date) -> "01-06-2027", el formato de fecha de la AEAT. */
export function formatFechaAeat(value) {
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : clean(value);
  if (/^\d{2}-\d{2}-\d{4}$/.test(iso)) return iso;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) throw new Error(`Fecha no válida: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/** Fecha, hora y huso horario en ISO 8601 con desfase explícito: "2027-06-01T10:15:00+02:00". */
export function fechaHoraHuso(date = new Date(), timeZone = "Europe/Madrid") {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date).map((p) => [p.type, p.value])
  );
  const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  const offsetMin = Math.round((Date.parse(`${local}Z`) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  return `${local}${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** Cadena de un registro de ALTA (orden de campos de la especificación de la AEAT). */
export function cadenaRegistroAlta({ nifEmisor, numSerie, fechaExpedicion, tipoFactura, cuotaTotal, importeTotal, huellaAnterior, fechaHoraHuso }) {
  return [
    `IDEmisorFactura=${clean(nifEmisor)}`,
    `NumSerieFactura=${clean(numSerie)}`,
    `FechaExpedicionFactura=${formatFechaAeat(fechaExpedicion)}`,
    `TipoFactura=${clean(tipoFactura)}`,
    `CuotaTotal=${formatImporte(cuotaTotal)}`,
    `ImporteTotal=${formatImporte(importeTotal)}`,
    `Huella=${clean(huellaAnterior)}`,
    `FechaHoraHusoGenRegistro=${clean(fechaHoraHuso)}`
  ].join("&");
}

/** Cadena de un registro de ANULACIÓN. */
export function cadenaRegistroAnulacion({ nifEmisor, numSerie, fechaExpedicion, huellaAnterior, fechaHoraHuso }) {
  return [
    `IDEmisorFacturaAnulada=${clean(nifEmisor)}`,
    `NumSerieFacturaAnulada=${clean(numSerie)}`,
    `FechaExpedicionFacturaAnulada=${formatFechaAeat(fechaExpedicion)}`,
    `Huella=${clean(huellaAnterior)}`,
    `FechaHoraHusoGenRegistro=${clean(fechaHoraHuso)}`
  ].join("&");
}

/** SHA-256 en hexadecimal y mayúsculas de la cadena en UTF-8. */
export function calcularHuella(cadena) {
  return crypto.createHash("sha256").update(cadena, "utf8").digest("hex").toUpperCase();
}

/** URL que va dentro del QR de la factura (cotejo en la sede de la AEAT). */
export function urlQr({ nif, numSerie, fechaExpedicion, importeTotal, entorno = "pruebas" }) {
  const base = QR_BASE_URL[entorno];
  if (!base) throw new Error(`Entorno VeriFactu no válido: ${entorno}`);
  const params = [
    ["nif", clean(nif)],
    ["numserie", clean(numSerie)],
    ["fecha", formatFechaAeat(fechaExpedicion)],
    ["importe", formatImporte(importeTotal)]
  ];
  return `${base}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/**
 * Comprueba una cadena de registros (tal como están en verifactu_records, en orden de id):
 * que cada huella sale de sus datos y que cada registro apunta al anterior.
 * Devuelve { ok, errores: [{ id, motivo }] }.
 */
export function verificarCadena(registros) {
  const errores = [];
  let anterior = null;
  for (const r of registros) {
    const esperadaAnterior = anterior ? anterior.huella : "";
    if (clean(r.huella_anterior) !== esperadaAnterior || (r.anterior_id ?? null) !== (anterior ? anterior.id : null)) {
      errores.push({ id: r.id, motivo: "No enlaza con el registro anterior." });
    }
    const datos = {
      nifEmisor: r.nif_emisor,
      numSerie: r.num_serie,
      fechaExpedicion: r.fecha_expedicion,
      huellaAnterior: r.huella_anterior,
      fechaHoraHuso: r.fecha_hora_huso
    };
    const cadena = r.tipo_registro === "anulacion"
      ? cadenaRegistroAnulacion(datos)
      : cadenaRegistroAlta({ ...datos, tipoFactura: r.tipo_factura, cuotaTotal: r.cuota_total, importeTotal: r.importe_total });
    if (calcularHuella(cadena) !== r.huella) {
      errores.push({ id: r.id, motivo: "La huella no corresponde a los datos del registro." });
    }
    anterior = r;
  }
  return { ok: errores.length === 0, errores };
}
