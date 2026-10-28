/**
 * ObraMaster - Cola de envío de registros a la AEAT (modo VERI*FACTU)
 *
 * Cada pocos segundos busca empresas con el envío activado y registros pendientes,
 * y manda hasta 1000 por envío, en el orden de la cadena. Respeta el control de
 * flujo de la AEAT: tras cada envío espera el TiempoEsperaEnvio que devuelve
 * (60 s por defecto). Si no hay conexión, el registro sigue pendiente y se
 * reintenta con espera creciente; no se pierde nada.
 *
 * Resultado por registro (verifactu_records.estado_envio):
 *   aceptado | aceptado_con_errores | rechazado  (los rechazados se subsanan desde la app)
 */

import { getAdminClient, isSupabaseReady } from "../authRoutes.js";
import { cargarCertificado } from "./certificados.js";
import { sistemaInformatico } from "./sistema.js";
import { enviarSoap } from "./aeatClient.js";
import {
  MAX_REGISTROS_POR_ENVIO, estadoLocal, parsearRespuesta,
  registroAltaXml, registroAnulacionXml, sobreSoap
} from "./xml.js";

const INTERVALO_MS = 15_000;
const ESPERA_POR_DEFECTO_S = 60;
const ESPERA_MAX_REINTENTO_S = 3600;

let timer = null;
let ocupado = false;

async function q(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

function enSegundos(segundos) {
  return new Date(Date.now() + segundos * 1000).toISOString();
}

/** Registros pendientes en orden, sin repetir (factura, operación) en el mismo envío. */
export function elegirLote(pendientes, max = MAX_REGISTROS_POR_ENVIO) {
  const vistos = new Set();
  const lote = [];
  for (const r of pendientes) {
    const clave = `${r.num_serie}|${r.tipo_registro}`;
    if (vistos.has(clave)) break; // el siguiente va en otro envío, para respetar el orden
    vistos.add(clave);
    lote.push(r);
    if (lote.length >= max) break;
  }
  return lote;
}

/** Construye el XML de un lote. Necesita las facturas, las rectificadas y los registros anteriores. */
async function construirSobre(db, company, lote, multiplesOT) {
  const sistema = sistemaInformatico({ multiplesOT });
  const invoiceIds = [...new Set(lote.map((r) => r.invoice_id))];
  const facturas = await q(db.from("invoices").select("*").in("id", invoiceIds));
  const porId = new Map(facturas.map((f) => [f.id, f]));
  const originalesIds = [...new Set(facturas.map((f) => f.rectifica_invoice_id).filter(Boolean))];
  if (originalesIds.length) {
    for (const f of await q(db.from("invoices").select("*").in("id", originalesIds))) porId.set(f.id, f);
  }
  const anterioresIds = [...new Set(lote.map((r) => r.anterior_id).filter(Boolean))];
  const anteriores = new Map(
    anterioresIds.length
      ? (await q(db.from("verifactu_records").select("id, nif_emisor, num_serie, fecha_expedicion").in("id", anterioresIds))).map((r) => [r.id, r])
      : []
  );

  const registrosXml = lote.map((registro) => {
    const anterior = registro.anterior_id ? anteriores.get(registro.anterior_id) : null;
    if (registro.anterior_id && !anterior) throw new Error(`Falta el registro anterior de ${registro.num_serie}.`);
    if (registro.tipo_registro === "anulacion") return registroAnulacionXml({ registro, anterior, sistema });
    const factura = porId.get(registro.invoice_id);
    return registroAltaXml({
      registro,
      factura,
      original: factura?.rectifica_invoice_id ? porId.get(factura.rectifica_invoice_id) : null,
      anterior,
      emisor: { razonSocial: company.razon_social },
      sistema
    });
  });
  return sobreSoap({ obligado: { nombre: company.razon_social, nif: company.nif }, registrosXml });
}

async function registrarEnvio(db, company, datos) {
  const { error } = await db.from("verifactu_envios").insert({ company_id: company.id, entorno: company.verifactu_entorno, ...datos });
  if (error) console.warn("[verifactu] No se pudo guardar el envío:", error.message);
}

/** Fallo sin respuesta de la AEAT: los registros siguen pendientes y se reintenta más tarde. */
async function aplazar(db, company, lote, mensaje) {
  const intentos = Math.max(...lote.map((r) => r.intentos || 0)) + 1;
  const espera = Math.min(ESPERA_POR_DEFECTO_S * 2 ** Math.min(intentos - 1, 6), ESPERA_MAX_REINTENTO_S);
  const ahora = new Date().toISOString();
  for (const r of lote) {
    await db.from("verifactu_records")
      .update({ intentos: (r.intentos || 0) + 1, ultimo_intento_at: ahora, descripcion_error: mensaje.slice(0, 500) })
      .eq("id", r.id);
  }
  await db.from("companies").update({
    proximo_envio_at: enSegundos(espera),
    ultimo_envio_at: ahora,
    ultimo_envio_estado: "error",
    ultimo_envio_error: mensaje.slice(0, 500)
  }).eq("id", company.id);
  await registrarEnvio(db, company, { registros: lote.length, estado_envio: "error", error: mensaje.slice(0, 1000) });
}

/** Envía el siguiente lote de una empresa. Devuelve un resumen. */
export async function enviarPendientesEmpresa(company, { multiplesOT = false } = {}) {
  const db = getAdminClient();
  const pendientes = await q(db.from("verifactu_records")
    .select("*")
    .eq("company_id", company.id)
    .eq("entorno", company.verifactu_entorno)
    .eq("estado_envio", "pendiente")
    .order("id", { ascending: true })
    .limit(MAX_REGISTROS_POR_ENVIO));
  const lote = elegirLote(pendientes);
  if (!lote.length) return { enviados: 0 };

  const certificado = await cargarCertificado(db, company.id);
  if (!certificado) {
    await aplazar(db, company, lote, "No hay certificado electrónico: súbelo en Ajustes > Facturación.");
    return { enviados: 0, error: "sin certificado" };
  }

  let xml;
  try {
    xml = await construirSobre(db, company, lote, multiplesOT);
  } catch (err) {
    await aplazar(db, company, lote, `No se pudo preparar el envío: ${err.message}`);
    return { enviados: 0, error: err.message };
  }

  let respuesta;
  try {
    const { status, body } = await enviarSoap({
      entorno: company.verifactu_entorno, xml, pfx: certificado.pfx, passphrase: certificado.passphrase
    });
    respuesta = parsearRespuesta(body);
    if (respuesta.fault || !respuesta.estadoEnvio) {
      const motivo = respuesta.fault || `Respuesta HTTP ${status} sin resultado.`;
      await aplazar(db, company, lote, `La AEAT devolvió un error: ${motivo}`);
      return { enviados: 0, error: motivo };
    }
  } catch (err) {
    await aplazar(db, company, lote, `Sin conexión con la AEAT: ${err.message}`);
    return { enviados: 0, error: err.message };
  }

  // Cada línea de respuesta corresponde a un registro (por RefExterna "OM-<id>" o por número y operación).
  const ahora = new Date().toISOString();
  let aceptados = 0;
  let rechazados = 0;
  for (const registro of lote) {
    const operacion = registro.tipo_registro === "alta" ? "Alta" : "Anulacion";
    const linea = respuesta.lineas.find((l) => l.refExterna === `OM-${registro.id}`)
      || respuesta.lineas.find((l) => l.numSerie === registro.num_serie && (!l.tipoOperacion || l.tipoOperacion === operacion));
    const estado = linea ? estadoLocal(linea) : (respuesta.estadoEnvio === "Correcto" ? "aceptado" : null);
    if (!estado) continue; // sin línea en un envío con errores: sigue pendiente y se reenvía
    if (estado === "rechazado") rechazados++; else aceptados++;
    await db.from("verifactu_records").update({
      estado_envio: estado,
      csv_aeat: respuesta.csv,
      enviado_at: ahora,
      intentos: (registro.intentos || 0) + 1,
      ultimo_intento_at: ahora,
      codigo_error: linea?.codigoError || null,
      descripcion_error: linea?.descripcionError ? linea.descripcionError.slice(0, 500) : null,
      respuesta_aeat: linea ? { ...linea, estadoEnvio: respuesta.estadoEnvio } : { estadoEnvio: respuesta.estadoEnvio }
    }).eq("id", registro.id);
  }

  const espera = respuesta.tiempoEsperaEnvio || ESPERA_POR_DEFECTO_S;
  await db.from("companies").update({
    proximo_envio_at: enSegundos(espera),
    ultimo_envio_at: ahora,
    ultimo_envio_estado: respuesta.estadoEnvio,
    ultimo_envio_error: rechazados ? `${rechazados} registro(s) rechazados por la AEAT.` : null
  }).eq("id", company.id);
  await registrarEnvio(db, company, {
    registros: lote.length, estado_envio: respuesta.estadoEnvio, csv_aeat: respuesta.csv, tiempo_espera: espera
  });
  return { enviados: lote.length, aceptados, rechazados, estadoEnvio: respuesta.estadoEnvio, csv: respuesta.csv };
}

/** Una pasada de la cola por todas las empresas que tienen el envío activado. */
export async function procesarCola() {
  if (ocupado || !isSupabaseReady()) return;
  ocupado = true;
  try {
    const db = getAdminClient();
    const { data: companies, error } = await db.from("companies").select("*").eq("envio_aeat_activo", true);
    if (error) {
      // Sin la migración de la fase 2 no hay nada que enviar.
      if (!/column|does not exist|schema cache/i.test(error.message)) console.warn("[verifactu] Cola:", error.message);
      return;
    }
    const { count } = await db.from("companies").select("id", { count: "exact", head: true }).eq("facturacion_activada", true);
    const ahora = Date.now();
    for (const company of companies || []) {
      if (company.proximo_envio_at && Date.parse(company.proximo_envio_at) > ahora) continue;
      try {
        const r = await enviarPendientesEmpresa(company, { multiplesOT: (count || 0) > 1 });
        if (r.enviados) console.log(`[verifactu] ${company.nif}: ${r.enviados} registro(s) enviados (${r.estadoEnvio}).`);
      } catch (err) {
        console.warn(`[verifactu] ${company.nif}:`, err.message);
      }
    }
  } finally {
    ocupado = false;
  }
}

/** Arranca la cola (una vez por proceso). */
export function iniciarColaVerifactu() {
  if (timer || process.env.VERIFACTU_COLA_DESACTIVADA === "true") return;
  timer = setInterval(() => { procesarCola().catch((err) => console.warn("[verifactu]", err.message)); }, INTERVALO_MS);
  timer.unref?.();
}
