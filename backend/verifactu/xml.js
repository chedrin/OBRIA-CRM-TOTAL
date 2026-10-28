/**
 * ObraMaster - XML VERI*FACTU (petición RegFactuSistemaFacturacion y su respuesta)
 *
 * Sigue SuministroLR.xsd y SuministroInformacion.xsd de la AEAT (versión 1.0).
 * Regla clave: los valores que entran en la huella (NIF, número, fecha, tipo,
 * cuota, importe, huella anterior, fecha-hora) se copian tal cual del registro
 * guardado en verifactu_records; no se vuelven a formatear. Si el XML no
 * coincide con lo que se "hasheó", la AEAT lo acepta con errores.
 */

import { formatFechaAeat, formatImporte } from "./huella.js";

const BASE = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws";
export const NS = {
  soapenv: "http://schemas.xmlsoap.org/soap/envelope/",
  sum: `${BASE}/SuministroLR.xsd`,
  sum1: `${BASE}/SuministroInformacion.xsd`
};

export const ENDPOINTS = {
  pruebas: "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  produccion: "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP"
};

/** Máximo de registros por envío (maxOccurs de RegistroFactura). */
export const MAX_REGISTROS_POR_ENVIO = 1000;

export function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Caracteres de control no admitidos en XML 1.0.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

const clip = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function el(name, value) {
  return `<sum1:${name}>${escapeXml(value)}</sum1:${name}>`;
}

function opt(name, value) {
  return value === undefined || value === null || value === "" ? "" : el(name, value);
}

function bloque(name, inner) {
  return `<sum1:${name}>${inner}</sum1:${name}>`;
}

function tipoImpositivo(pct) {
  return Number(pct).toFixed(2);
}

function encadenamiento(registro, anterior) {
  if (!anterior) return bloque("Encadenamiento", el("PrimerRegistro", "S"));
  return bloque("Encadenamiento", bloque("RegistroAnterior",
    el("IDEmisorFactura", anterior.nif_emisor) +
    el("NumSerieFactura", anterior.num_serie) +
    el("FechaExpedicionFactura", anterior.fecha_expedicion) +
    el("Huella", registro.huella_anterior)
  ));
}

function sistemaXml(s) {
  return bloque("SistemaInformatico",
    el("NombreRazon", s.NombreRazon) +
    el("NIF", s.NIF) +
    el("NombreSistemaInformatico", s.NombreSistemaInformatico) +
    el("IdSistemaInformatico", s.IdSistemaInformatico) +
    el("Version", s.Version) +
    el("NumeroInstalacion", s.NumeroInstalacion) +
    el("TipoUsoPosibleSoloVerifactu", s.TipoUsoPosibleSoloVerifactu) +
    el("TipoUsoPosibleMultiOT", s.TipoUsoPosibleMultiOT) +
    el("IndicadorMultiplesOT", s.IndicadorMultiplesOT)
  );
}

/** Línea de desglose: S1 normal o S2 (inversión del sujeto pasivo: tipo y cuota a cero). */
function desgloseXml(factura) {
  const isp = factura.isp === true;
  return bloque("Desglose", bloque("DetalleDesglose",
    el("Impuesto", "01") +
    el("ClaveRegimen", "01") +
    el("CalificacionOperacion", isp ? "S2" : "S1") +
    el("TipoImpositivo", isp ? "0.00" : tipoImpositivo(factura.iva_pct)) +
    el("BaseImponibleOimporteNoSujeto", formatImporte(factura.base_imponible)) +
    el("CuotaRepercutida", isp ? "0.00" : formatImporte(factura.cuota_iva))
  ));
}

/**
 * Registro de alta.
 * @param registro   fila de verifactu_records (tipo alta)
 * @param factura    fila de invoices
 * @param original   fila de invoices rectificada (solo rectificativas)
 * @param anterior   registro anterior de la cadena (null si es el primero)
 * @param emisor     { razonSocial }
 * @param sistema    bloque de sistemaInformatico()
 */
export function registroAltaXml({ registro, factura, original, anterior, emisor, sistema }) {
  if (registro.tipo_registro !== "alta") throw new Error("El registro no es de alta.");
  const rectificativa = registro.tipo_factura !== "F1";
  if (rectificativa && !original) throw new Error(`Falta la factura rectificada de ${registro.num_serie}.`);
  const sustitucion = rectificativa && factura.tipo_rectificativa === "S";
  const fechaOperacion = factura.fecha_operacion ? formatFechaAeat(factura.fecha_operacion) : "";

  const inner =
    el("IDVersion", "1.0") +
    bloque("IDFactura",
      el("IDEmisorFactura", registro.nif_emisor) +
      el("NumSerieFactura", registro.num_serie) +
      el("FechaExpedicionFactura", registro.fecha_expedicion)
    ) +
    el("RefExterna", `OM-${registro.id}`) +
    el("NombreRazonEmisor", clip(emisor.razonSocial, 120)) +
    opt("Subsanacion", registro.subsanacion) +
    opt("RechazoPrevio", registro.rechazo_previo) +
    el("TipoFactura", registro.tipo_factura) +
    (rectificativa ? el("TipoRectificativa", factura.tipo_rectificativa || "I") : "") +
    (rectificativa
      ? bloque("FacturasRectificadas", bloque("IDFacturaRectificada",
          el("IDEmisorFactura", registro.nif_emisor) +
          el("NumSerieFactura", original.num_serie) +
          el("FechaExpedicionFactura", formatFechaAeat(original.fecha_expedicion))
        ))
      : "") +
    (sustitucion
      ? bloque("ImporteRectificacion",
          el("BaseRectificada", formatImporte(factura.base_rectificada)) +
          el("CuotaRectificada", formatImporte(factura.cuota_rectificada))
        )
      : "") +
    (fechaOperacion && fechaOperacion !== registro.fecha_expedicion ? el("FechaOperacion", fechaOperacion) : "") +
    el("DescripcionOperacion", clip(factura.descripcion, 500) || "Ejecución de obra") +
    bloque("Destinatarios", bloque("IDDestinatario",
      el("NombreRazon", clip(factura.cliente_nombre, 120)) +
      el("NIF", factura.cliente_nif)
    )) +
    desgloseXml(factura) +
    el("CuotaTotal", registro.cuota_total) +
    el("ImporteTotal", registro.importe_total) +
    encadenamiento(registro, anterior) +
    sistemaXml(sistema) +
    el("FechaHoraHusoGenRegistro", registro.fecha_hora_huso) +
    el("TipoHuella", "01") +
    el("Huella", registro.huella);

  return `<sum:RegistroFactura>${bloque("RegistroAlta", inner)}</sum:RegistroFactura>`;
}

/** Registro de anulación. */
export function registroAnulacionXml({ registro, anterior, sistema }) {
  if (registro.tipo_registro !== "anulacion") throw new Error("El registro no es de anulación.");
  const inner =
    el("IDVersion", "1.0") +
    bloque("IDFactura",
      el("IDEmisorFacturaAnulada", registro.nif_emisor) +
      el("NumSerieFacturaAnulada", registro.num_serie) +
      el("FechaExpedicionFacturaAnulada", registro.fecha_expedicion)
    ) +
    el("RefExterna", `OM-${registro.id}`) +
    opt("SinRegistroPrevio", registro.sin_registro_previo) +
    opt("RechazoPrevio", registro.rechazo_previo) +
    encadenamiento(registro, anterior) +
    sistemaXml(sistema) +
    el("FechaHoraHusoGenRegistro", registro.fecha_hora_huso) +
    el("TipoHuella", "01") +
    el("Huella", registro.huella);

  return `<sum:RegistroFactura>${bloque("RegistroAnulacion", inner)}</sum:RegistroFactura>`;
}

/** Sobre SOAP con la cabecera del obligado y hasta 1000 registros ya serializados. */
export function sobreSoap({ obligado, registrosXml }) {
  if (!registrosXml.length || registrosXml.length > MAX_REGISTROS_POR_ENVIO) {
    throw new Error(`Un envío lleva entre 1 y ${MAX_REGISTROS_POR_ENVIO} registros.`);
  }
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soapenv:Envelope xmlns:soapenv="${NS.soapenv}" xmlns:sum="${NS.sum}" xmlns:sum1="${NS.sum1}">` +
    "<soapenv:Header/><soapenv:Body><sum:RegFactuSistemaFacturacion>" +
    "<sum:Cabecera>" + bloque("ObligadoEmision", el("NombreRazon", clip(obligado.nombre, 120)) + el("NIF", obligado.nif)) + "</sum:Cabecera>" +
    registrosXml.join("") +
    "</sum:RegFactuSistemaFacturacion></soapenv:Body></soapenv:Envelope>";
}

// ---------------------------------------------------------------------------
// Respuesta
// ---------------------------------------------------------------------------

function decodeXml(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .trim();
}

function bloques(xml, name) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, "g");
  return [...String(xml).matchAll(re)].map((m) => m[1]);
}

function texto(xml, name) {
  const found = bloques(xml, name)[0];
  return found === undefined ? undefined : decodeXml(found);
}

/**
 * Lee la respuesta de la AEAT. Devuelve
 * { fault, estadoEnvio, csv, tiempoEsperaEnvio, lineas: [{ refExterna, numSerie, tipoOperacion,
 *   estadoRegistro, codigoError, descripcionError, duplicado }] }
 */
export function parsearRespuesta(xml) {
  const body = String(xml || "");
  const fault = bloques(body, "Fault")[0];
  if (fault !== undefined) {
    const motivo = texto(fault, "faultstring") || "Error SOAP sin descripción";
    return { fault: motivo, codigoFault: motivo.match(/Codigo\[(\d{3,5})\]/)?.[1] || null, lineas: [] };
  }
  const respuesta = bloques(body, "RespuestaRegFactuSistemaFacturacion")[0];
  if (respuesta === undefined) {
    return { fault: "La AEAT no devolvió una respuesta reconocible.", lineas: [] };
  }
  const lineas = bloques(respuesta, "RespuestaLinea").map((linea) => {
    const duplicado = bloques(linea, "RegistroDuplicado")[0];
    return {
      refExterna: texto(linea, "RefExterna") || null,
      numSerie: texto(linea, "NumSerieFactura") || null,
      tipoOperacion: texto(linea, "TipoOperacion") || null,
      estadoRegistro: texto(linea, "EstadoRegistro") || null,
      codigoError: texto(linea, "CodigoErrorRegistro") || null,
      descripcionError: texto(linea, "DescripcionErrorRegistro") || null,
      duplicado: duplicado === undefined ? null : { estado: texto(duplicado, "EstadoRegistroDuplicado") || null }
    };
  });
  const espera = Number(texto(respuesta, "TiempoEsperaEnvio"));
  return {
    fault: null,
    estadoEnvio: texto(respuesta, "EstadoEnvio") || null,
    csv: texto(respuesta, "CSV") || null,
    tiempoEsperaEnvio: Number.isFinite(espera) && espera > 0 ? espera : null,
    lineas
  };
}

/** Traduce el EstadoRegistro de la AEAT al estado_envio de verifactu_records. */
export function estadoLocal(linea) {
  if (linea.estadoRegistro === "Correcto") return "aceptado";
  if (linea.estadoRegistro === "AceptadoConErrores") return "aceptado_con_errores";
  // Duplicado: si el que ya tiene la AEAT es correcto, el registro ya está allí.
  if (linea.duplicado?.estado === "Correcta") return "aceptado";
  if (linea.duplicado?.estado === "AceptadaConErrores") return "aceptado_con_errores";
  return "rechazado";
}
