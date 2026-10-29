/**
 * ObraMaster - Facturación legal (VeriFactu)
 *
 * El interruptor "Facturación activada" de cada empresa decide si la app factura:
 *   - Desactivado: no se emite nada; ObraMaster solo hace presupuestos y obras.
 *   - Activado: todas las facturas se emiten aquí, con número correlativo y
 *     registro VeriFactu encadenado (sin forma de facturar "por fuera").
 *
 * La numeración, la huella, la anulación y el bloqueo de facturas emitidas los
 * aplica la base de datos (supabase_schema_facturacion.sql). Este módulo valida,
 * llama a sus funciones y devuelve los datos a la app. Solo administradores.
 * El envío a la AEAT lo hace la cola de backend/verifactu/envio.js.
 *
 * Rutas:
 *   GET    /api/facturacion                    empresa, ajustes, certificado y estado del envío
 *   PUT    /api/facturacion/empresa            crear o cambiar la empresa y sus ajustes
 *   PUT    /api/facturacion/certificado        subir el certificado (.pfx/.p12 en base64 + contraseña)
 *   DELETE /api/facturacion/certificado        quitar el certificado
 *   GET    /api/facturacion/verificar          comprobar la cadena de huellas del entorno actual
 *   GET    /api/facturacion/envios             últimos envíos a la AEAT y registros con problemas
 *   POST   /api/facturacion/enviar             enviar ya los registros pendientes
 *   GET    /api/facturacion/declaracion        declaración responsable del productor
 *   POST   /api/facturacion/iva-obra           asistente de IVA según tipo de obra y cliente
 *   GET    /api/facturacion/obras/:id          datos fiscales guardados de una obra
 *   PUT    /api/facturacion/obras/:id          guardar los datos fiscales de una obra
 *   GET    /api/facturacion/libro              libro registro de facturas expedidas (CSV)
 *   GET    /api/facturacion/resumen            resumen trimestral del IVA repercutido
 *   GET    /api/facturas                       facturas de la empresa (entorno actual)
 *   POST   /api/facturas                       crear y emitir una factura
 *   POST   /api/facturas/:id/rectificar        rectificativa por diferencias o por sustitución
 *   POST   /api/facturas/:id/anular            anular una factura que no debió emitirse
 *   POST   /api/facturas/:id/subsanar          volver a registrar en la AEAT un registro rechazado
 *   PATCH  /api/facturas/:id/cobro             marcar cobrada o pendiente
 *   GET    /api/facturas/:id/facturae          factura electrónica Facturae 3.2.2 (XML)
 */

import { getAdminClient, isSupabaseReady } from "./authRoutes.js";
import { validarNif } from "./verifactu/nif.js";
import { verificarCadena } from "./verifactu/huella.js";
import { estadoCertificado, guardarCertificado, MAX_PFX_BYTES } from "./verifactu/certificados.js";
import { datosProductor, declaracionResponsable } from "./verifactu/sistema.js";
import { enviarPendientesEmpresa } from "./verifactu/envio.js";
import { calcularFiscalidadObra } from "./verifactu/fiscalidadObra.js";
import { generarFacturae } from "./verifactu/facturae.js";
import { libroExpedidasCsv, resumenTrimestral } from "./verifactu/libros.js";

const IVA_VALIDOS = new Set([0, 4, 5, 10, 21]);
const TIPOS_RECTIFICATIVA = new Set(["R1", "R2", "R3", "R4"]);
const MAX_LINEAS = 300;

const clip = (value, max) => String(value ?? "").trim().slice(0, max);
const money = (value) => Math.round(Number(value) * 100) / 100;
const isoDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function sendFile(res, { contentType, filename, body }) {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readJsonBody(req, maxBytes = 512 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(httpError(413, "Petición demasiado grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        resolve(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
      } catch {
        reject(httpError(400, "JSON no válido."));
      }
    });
    req.on("error", reject);
  });
}

/** Errores de Supabase: falta la tabla o columna -> 503; una regla de la base de datos -> 400 con su mensaje. */
function dbError(error) {
  const text = String(error?.message || error || "");
  if (["42P01", "42703", "PGRST205", "PGRST202", "PGRST204"].includes(error?.code) || /does not exist|schema cache/i.test(text)) {
    // Se añade el detalle (qué tabla o columna falta) para poder diagnosticarlo sin acceso a los logs.
    return httpError(503, `Falta actualizar la base de datos: ejecuta supabase_schema_facturacion.sql en Supabase > SQL Editor. Detalle: ${text.slice(0, 200)}`);
  }
  if (error?.code === "P0001" || error?.code === "23514" || error?.code === "23505") return httpError(400, text);
  return httpError(500, `Error de la base de datos: ${text}`);
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw dbError(error);
  return data;
}

async function audit(companyId, userId, evento, detalle = {}) {
  const { error } = await getAdminClient().from("audit_events").insert({ company_id: companyId, user_id: userId, evento, detalle });
  if (error) console.warn("[facturacion] No se pudo registrar el evento", evento, error.message);
}

/** Empresa del usuario. Mientras solo haya una empresa, se asigna sola a quien no tenga. */
async function findCompany(user) {
  const db = getAdminClient();
  if (user?.company_id) {
    return run(db.from("companies").select("*").eq("id", user.company_id).maybeSingle());
  }
  const companies = await run(db.from("companies").select("*").limit(2));
  if (companies.length !== 1) return null;
  if (user?.id) {
    await db.from("profiles").update({ company_id: companies[0].id }).eq("id", user.id);
    user.company_id = companies[0].id;
  }
  return companies[0];
}

async function requireCompany(user) {
  const company = await findCompany(user);
  if (!company) throw httpError(409, "Configura primero la empresa en Ajustes > Facturación.");
  return company;
}

async function requireActiveCompany(user) {
  const company = await requireCompany(user);
  if (!company.facturacion_activada) throw httpError(403, "La facturación está desactivada para esta empresa.");
  return company;
}

/** Estado del último registro de cada factura: { invoice_id -> registro }. */
async function ultimosRegistros(companyId, invoiceIds = null) {
  const db = getAdminClient();
  let query = db.from("verifactu_records")
    .select("id, invoice_id, tipo_registro, estado_envio, codigo_error, descripcion_error, csv_aeat, enviado_at")
    .eq("company_id", companyId)
    .order("id", { ascending: true });
  if (invoiceIds) query = query.in("invoice_id", invoiceIds);
  const rows = await run(query);
  const map = new Map();
  for (const r of rows) map.set(r.invoice_id, r);
  return map;
}

/** Factura en el formato que usa la app (mismos nombres que las facturas antiguas). */
export function toAppInvoice(row, registro = null) {
  const fecha = row.fecha_expedicion || String(row.created_at || "").slice(0, 10);
  const mes = Number(String(fecha).slice(5, 7)) || 1;
  return {
    id: row.id,
    legal: true,
    status: row.status,
    entorno: row.entorno || "pruebas",
    numero: row.num_serie || "BORRADOR",
    tipoFactura: row.descripcion || (row.tipo_factura === "F1" ? "Factura" : "Factura rectificativa"),
    tipoAeat: row.tipo_factura,
    tipoRectificativa: row.tipo_rectificativa || null,
    rectificaId: row.rectifica_invoice_id,
    rectificacionCausa: row.rectificacion_causa,
    baseRectificada: row.base_rectificada === null || row.base_rectificada === undefined ? null : Number(row.base_rectificada),
    cuotaRectificada: row.cuota_rectificada === null || row.cuota_rectificada === undefined ? null : Number(row.cuota_rectificada),
    presupuestoId: row.presupuesto_id,
    obraId: row.obra_id,
    obraTitulo: row.descripcion || row.cliente_nombre,
    cliente: row.cliente_nombre,
    cifNif: row.cliente_nif,
    clienteTipo: row.cliente_tipo || "empresa",
    direccion: [row.cliente_direccion, row.cliente_codigo_postal, row.cliente_municipio, row.cliente_provincia].filter(Boolean).join(", "),
    clienteDireccion: row.cliente_direccion,
    clienteCodigoPostal: row.cliente_codigo_postal || "",
    clienteMunicipio: row.cliente_municipio || "",
    clienteProvincia: row.cliente_provincia || "",
    fechaEmision: fecha,
    fechaOperacion: row.fecha_operacion || null,
    fechaVencimiento: row.fecha_vencimiento,
    trimestre: `${Math.ceil(mes / 3)}T`,
    ano: Number(String(fecha).slice(0, 4)) || null,
    lineas: row.lineas || [],
    baseImponible: Number(row.base_imponible),
    tipoIvaPct: Number(row.iva_pct),
    cuotaIva: Number(row.cuota_iva),
    isp: row.isp,
    ivaMotivo: row.iva_motivo || "",
    retencionIrpfPct: Number(row.irpf_pct),
    cuotaRetencion: Number(row.cuota_irpf),
    importeTotal: Number(row.importe_total),
    totalFactura: Number(row.liquido),
    estadoCobro: row.estado_cobro,
    fechaCobro: row.fecha_cobro,
    metodoPago: row.metodo_pago,
    huella: row.huella,
    qrUrl: row.qr_url,
    anulada: Boolean(row.anulada),
    anuladaEl: row.anulada_at || null,
    anulacionMotivo: row.anulacion_motivo || null,
    aeat: registro
      ? {
          operacion: registro.tipo_registro,
          estado: registro.estado_envio,
          codigoError: registro.codigo_error,
          error: registro.descripcion_error,
          csv: registro.csv_aeat,
          enviadoEl: registro.enviado_at
        }
      : null
  };
}

function toAppCompany(company, ajustes, extra = {}) {
  if (!company) return null;
  return {
    id: company.id,
    nif: company.nif,
    razonSocial: company.razon_social,
    domicilio: company.domicilio,
    codigoPostal: company.codigo_postal || "",
    municipio: company.municipio || "",
    provincia: company.provincia || "",
    regimen: company.regimen,
    regimenIrpf: company.regimen_irpf || "directa",
    facturacionActivada: company.facturacion_activada,
    verifactuEntorno: company.verifactu_entorno,
    envioAeatActivo: Boolean(company.envio_aeat_activo),
    ultimoEnvio: company.ultimo_envio_at
      ? { fecha: company.ultimo_envio_at, estado: company.ultimo_envio_estado, error: company.ultimo_envio_error }
      : null,
    proximoEnvio: company.proximo_envio_at || null,
    serieOrdinaria: ajustes?.serie_ordinaria || "F",
    serieRectificativa: ajustes?.serie_rectificativa || "R",
    ivaPorDefectoPct: Number(ajustes?.iva_por_defecto_pct ?? 21),
    irpfPorDefectoPct: Number(ajustes?.irpf_por_defecto_pct ?? 0),
    textoIsp: ajustes?.texto_isp || "",
    diasVencimiento: Number(ajustes?.dias_vencimiento ?? 30),
    ...extra
  };
}

/**
 * Registros con algo pendiente (sin enviar, rechazados o aceptados con errores). Solo cuenta el
 * último registro de cada factura: un alta rechazada que después se subsanó o se anuló ya está cerrada.
 */
async function registrosAbiertos(companyId, entorno) {
  const db = getAdminClient();
  const problemas = await run(db.from("verifactu_records")
    .select("id, invoice_id, tipo_registro, num_serie, estado_envio, codigo_error, descripcion_error, intentos, ultimo_intento_at")
    .eq("company_id", companyId).eq("entorno", entorno)
    .in("estado_envio", ["pendiente", "rechazado", "aceptado_con_errores"])
    .order("id", { ascending: false }).limit(500));
  if (!problemas.length) return [];
  const facturas = [...new Set(problemas.map((r) => r.invoice_id))];
  const todos = await run(db.from("verifactu_records").select("id, invoice_id").in("invoice_id", facturas));
  const ultimo = new Map();
  for (const r of todos) if (!ultimo.has(r.invoice_id) || r.id > ultimo.get(r.invoice_id)) ultimo.set(r.invoice_id, r.id);
  return problemas.filter((r) => ultimo.get(r.invoice_id) === r.id);
}

async function contarRegistros(companyId, entorno) {
  const abiertos = await registrosAbiertos(companyId, entorno);
  const contar = (estado) => abiertos.filter((r) => r.estado_envio === estado).length;
  const { count: aceptados, error } = await getAdminClient().from("verifactu_records").select("id", { count: "exact", head: true })
    .eq("company_id", companyId).eq("entorno", entorno).eq("estado_envio", "aceptado");
  if (error) throw dbError(error);
  return { aceptados: aceptados || 0, pendientes: contar("pendiente"), rechazados: contar("rechazado"), conErrores: contar("aceptado_con_errores") };
}

async function empresaCompleta(company) {
  const db = getAdminClient();
  const ajustes = await run(db.from("tax_settings").select("*").eq("company_id", company.id).maybeSingle());
  let certificado = null;
  try {
    certificado = await estadoCertificado(db, company.id);
  } catch (err) {
    certificado = { error: dbError(err).message };
  }
  const productor = datosProductor();
  return toAppCompany(company, ajustes, {
    certificado,
    productorCompleto: productor.completo,
    registros: await contarRegistros(company.id, company.verifactu_entorno)
  });
}

function parseLineas(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_LINEAS).map((l) => ({
    concepto: clip(l?.concepto, 2000),
    cantidad: Number(l?.cantidad) || 0,
    unidad: clip(l?.unidad, 20),
    precio: money(l?.precio || 0),
    importe: money(l?.importe || 0)
  }));
}

function parseImportes(body, defaults) {
  const base = money(body.baseImponible);
  if (!Number.isFinite(base)) throw httpError(400, "La base imponible no es un número.");
  const iva = body.ivaPct === undefined ? defaults.ivaPorDefectoPct : Number(body.ivaPct);
  if (!IVA_VALIDOS.has(iva)) throw httpError(400, "Tipo de IVA no válido (0, 4, 5, 10 o 21 %).");
  const irpf = body.irpfPct === undefined ? defaults.irpfPorDefectoPct : Number(body.irpfPct);
  if (!(irpf >= 0 && irpf <= 47)) throw httpError(400, "Retención de IRPF no válida.");
  return { base_imponible: base, iva_pct: iva, irpf_pct: irpf, isp: body.isp === true };
}

/** Datos del cliente comunes a factura y rectificativa. */
function parseCliente(body) {
  const clienteTipo = body.clienteTipo === "particular" ? "particular" : "empresa";
  return {
    cliente_tipo: clienteTipo,
    cliente_direccion: clip(body.clienteDireccion, 300),
    cliente_codigo_postal: clip(body.clienteCodigoPostal, 10),
    cliente_municipio: clip(body.clienteMunicipio, 100),
    cliente_provincia: clip(body.clienteProvincia, 100)
  };
}

async function emitir(draft, user) {
  const db = getAdminClient();
  const created = await run(db.from("invoices").insert(draft).select("id").single());
  const { data, error } = await db.rpc("emitir_factura", { p_invoice_id: created.id, p_user_id: user?.id || null });
  if (error) {
    await db.from("invoices").delete().eq("id", created.id).eq("status", "DRAFT");
    throw dbError(error);
  }
  return data;
}

function periodo(searchParams) {
  const ejercicio = Number(searchParams?.get("ejercicio")) || new Date().getFullYear();
  const trimestre = String(searchParams?.get("trimestre") || "").toUpperCase();
  let desde = `${ejercicio}-01-01`;
  let hasta = `${ejercicio}-12-31`;
  if (/^[1-4]T$/.test(trimestre)) {
    const q = Number(trimestre[0]);
    const mesIni = (q - 1) * 3 + 1;
    const mesFin = mesIni + 2;
    const ultimoDia = new Date(Date.UTC(ejercicio, mesFin, 0)).getUTCDate();
    desde = `${ejercicio}-${String(mesIni).padStart(2, "0")}-01`;
    hasta = `${ejercicio}-${String(mesFin).padStart(2, "0")}-${ultimoDia}`;
  }
  return { ejercicio, trimestre: /^[1-4]T$/.test(trimestre) ? trimestre : "", desde, hasta };
}

async function facturasDelPeriodo(company, searchParams) {
  const p = periodo(searchParams);
  const rows = await run(getAdminClient().from("invoices").select("*")
    .eq("company_id", company.id).eq("entorno", company.verifactu_entorno).eq("status", "ISSUED")
    .gte("fecha_expedicion", p.desde).lte("fecha_expedicion", p.hasta)
    .order("fecha_expedicion", { ascending: true }).order("num_serie", { ascending: true }));
  return { periodo: p, rows };
}

const ROUTES = [
  ["GET", /^\/api\/facturacion$/, "estado"],
  ["PUT", /^\/api\/facturacion\/empresa$/, "empresa"],
  ["PUT", /^\/api\/facturacion\/certificado$/, "subirCertificado"],
  ["DELETE", /^\/api\/facturacion\/certificado$/, "quitarCertificado"],
  ["GET", /^\/api\/facturacion\/verificar$/, "verificar"],
  ["GET", /^\/api\/facturacion\/envios$/, "envios"],
  ["POST", /^\/api\/facturacion\/enviar$/, "enviar"],
  ["GET", /^\/api\/facturacion\/declaracion$/, "declaracion"],
  ["POST", /^\/api\/facturacion\/iva-obra$/, "ivaObra"],
  ["GET", /^\/api\/facturacion\/obras\/([\w-]{1,64})$/, "leerObra"],
  ["PUT", /^\/api\/facturacion\/obras\/([\w-]{1,64})$/, "guardarObra"],
  ["GET", /^\/api\/facturacion\/libro$/, "libro"],
  ["GET", /^\/api\/facturacion\/resumen$/, "resumen"],
  ["GET", /^\/api\/facturas$/, "listar"],
  ["POST", /^\/api\/facturas$/, "crear"],
  ["POST", /^\/api\/facturas\/([0-9a-f-]{36})\/rectificar$/, "rectificar"],
  ["POST", /^\/api\/facturas\/([0-9a-f-]{36})\/anular$/, "anular"],
  ["POST", /^\/api\/facturas\/([0-9a-f-]{36})\/subsanar$/, "subsanar"],
  ["PATCH", /^\/api\/facturas\/([0-9a-f-]{36})\/cobro$/, "cobro"],
  ["GET", /^\/api\/facturas\/([0-9a-f-]{36})\/facturae$/, "facturae"]
];

const handlers = {
  async estado({ user }) {
    const company = await findCompany(user);
    return { empresa: company ? await empresaCompleta(company) : null };
  },

  async empresa({ req, user }) {
    const db = getAdminClient();
    const body = await readJsonBody(req);
    const nif = validarNif(body.nif);
    if (!nif.valido) throw httpError(400, "El NIF de la empresa no es válido.");
    const razonSocial = clip(body.razonSocial, 120);
    if (!razonSocial) throw httpError(400, "Falta la razón social o el nombre.");
    const codigoPostal = clip(body.codigoPostal, 5);
    if (codigoPostal && !/^\d{5}$/.test(codigoPostal)) throw httpError(400, "El código postal debe tener 5 cifras.");
    const current = await findCompany(user);

    // Envío a la AEAT y paso a producción: solo con certificado y declaración responsable completa.
    // Sin certificado o sin productor se guardan igualmente los datos fiscales (el certificado se sube
    // después de guardarlos) y el envío queda desactivado con un aviso; el paso a producción sí se bloquea.
    let quiereEnvio = body.envioAeatActivo === true;
    const quiereProduccion = body.verifactuEntorno === "produccion";
    let aviso = null;
    if ((quiereEnvio && !current?.envio_aeat_activo) || (quiereProduccion && current?.verifactu_entorno !== "produccion")) {
      const productor = datosProductor();
      const cert = current ? await estadoCertificado(db, current.id) : null;
      const falta = !productor.completo
        ? `faltan los datos del productor del software en el servidor (${productor.faltan.join(", ")})`
        : (!cert || cert.error) ? "falta subir el certificado electrónico de la empresa" : null;
      if (falta && quiereProduccion && current?.verifactu_entorno !== "produccion") throw httpError(409, `No se puede pasar a producción: ${falta}.`);
      if (falta) {
        quiereEnvio = false;
        aviso = `Datos guardados, pero el envío a la AEAT sigue desactivado: ${falta}.`;
      }
    }
    if (quiereProduccion && current?.verifactu_entorno !== "produccion") {
      if (body.confirmarProduccion !== true) throw httpError(400, "Confirma el paso a producción: desde ese momento las facturas son reales y se envían a la AEAT.");
      if (!quiereEnvio) throw httpError(400, "En producción el envío a la AEAT tiene que estar activado.");
    }
    if (current?.verifactu_entorno === "produccion" && !quiereEnvio) {
      throw httpError(400, "En producción el envío a la AEAT no se puede desactivar (modo VERI*FACTU).");
    }

    const fields = {
      nif: nif.nif,
      razon_social: razonSocial,
      domicilio: clip(body.domicilio, 300),
      codigo_postal: codigoPostal,
      municipio: clip(body.municipio, 100),
      provincia: clip(body.provincia, 100),
      regimen: body.regimen === "sociedad" ? "sociedad" : "autonomo",
      regimen_irpf: body.regimenIrpf === "objetiva" ? "objetiva" : "directa",
      facturacion_activada: body.facturacionActivada === true,
      envio_aeat_activo: quiereEnvio && Boolean(current),
      verifactu_entorno: quiereProduccion && current ? "produccion" : (current?.verifactu_entorno || "pruebas")
    };
    if (!fields.domicilio) throw httpError(400, "Falta el domicilio fiscal: es obligatorio en las facturas.");
    const company = current
      ? await run(db.from("companies").update(fields).eq("id", current.id).select("*").single())
      : await run(db.from("companies").insert(fields).select("*").single());
    if (!current && user?.id) {
      await run(db.from("profiles").update({ company_id: company.id }).eq("id", user.id));
      user.company_id = company.id;
    }

    const serie = (value, fallback) => (/^[A-Z0-9]{1,10}$/.test(clip(value, 10).toUpperCase()) ? clip(value, 10).toUpperCase() : fallback);
    const iva = Number(body.ivaPorDefectoPct);
    await run(db.from("tax_settings").upsert({
      company_id: company.id,
      serie_ordinaria: serie(body.serieOrdinaria, "F"),
      serie_rectificativa: serie(body.serieRectificativa, "R"),
      iva_por_defecto_pct: IVA_VALIDOS.has(iva) ? iva : 21,
      irpf_por_defecto_pct: Math.min(Math.max(Number(body.irpfPorDefectoPct) || 0, 0), 47),
      dias_vencimiento: Math.min(Math.max(Math.round(Number(body.diasVencimiento) || 30), 0), 365),
      ...(clip(body.textoIsp, 500) ? { texto_isp: clip(body.textoIsp, 500) } : {}),
      updated_at: new Date().toISOString()
    }, { onConflict: "company_id" }));

    if (!current || current.facturacion_activada !== company.facturacion_activada) {
      await audit(company.id, user?.id, company.facturacion_activada ? "FACTURACION_ACTIVADA" : "FACTURACION_DESACTIVADA", { nif: company.nif });
    }
    if (current && current.verifactu_entorno !== company.verifactu_entorno) {
      await audit(company.id, user?.id, "PASO_A_PRODUCCION", { nif: company.nif });
    }
    if (current && current.envio_aeat_activo !== company.envio_aeat_activo) {
      await audit(company.id, user?.id, company.envio_aeat_activo ? "ENVIO_AEAT_ACTIVADO" : "ENVIO_AEAT_DESACTIVADO", { entorno: company.verifactu_entorno });
    }
    if (current) await audit(company.id, user?.id, "EMPRESA_ACTUALIZADA", { nif: company.nif });
    return { empresa: await empresaCompleta(company), ...(aviso ? { aviso } : {}) };
  },

  async subirCertificado({ req, user }) {
    const company = await requireCompany(user);
    const body = await readJsonBody(req, Math.ceil(MAX_PFX_BYTES * 1.4) + 4096);
    const pfx = Buffer.from(String(body.pfxBase64 || "").replace(/^data:[^,]*,/, ""), "base64");
    const info = await guardarCertificado(getAdminClient(), {
      companyId: company.id, pfx, passphrase: String(body.password || ""), userId: user?.id
    }).catch((err) => { throw err.status ? err : dbError(err); });
    const avisos = [];
    if (info.nif && info.nif !== company.nif) {
      avisos.push(`El certificado es de ${info.nif} y la empresa es ${company.nif}: solo funcionará si ese titular tiene apoderamiento en la AEAT para presentar los registros de la empresa.`);
    }
    await audit(company.id, user?.id, "CERTIFICADO_SUBIDO", { titular: info.titular, nif: info.nif, caduca: info.validoHasta });
    return { certificado: { origen: "empresa", ...info }, avisos };
  },

  async quitarCertificado({ user }) {
    const company = await requireCompany(user);
    if (company.verifactu_entorno === "produccion") throw httpError(409, "En producción no se puede quedar sin certificado: sube el nuevo y se sustituirá.");
    await run(getAdminClient().from("company_certificates").delete().eq("company_id", company.id));
    await run(getAdminClient().from("companies").update({ envio_aeat_activo: false }).eq("id", company.id));
    await audit(company.id, user?.id, "CERTIFICADO_QUITADO", {});
    return { ok: true };
  },

  async verificar({ user }) {
    const company = await requireCompany(user);
    const registros = await run(getAdminClient().from("verifactu_records").select("*")
      .eq("company_id", company.id).eq("entorno", company.verifactu_entorno).order("id", { ascending: true }));
    return { entorno: company.verifactu_entorno, registros: registros.length, ...verificarCadena(registros) };
  },

  async envios({ user }) {
    const company = await requireCompany(user);
    const db = getAdminClient();
    const envios = await run(db.from("verifactu_envios").select("*").eq("company_id", company.id).order("id", { ascending: false }).limit(20));
    const problemas = await registrosAbiertos(company.id, company.verifactu_entorno);
    return { envios, registros: problemas.slice(0, 100) };
  },

  async enviar({ user }) {
    const company = await requireCompany(user);
    if (!company.envio_aeat_activo) throw httpError(409, "Activa primero el envío a la AEAT en Ajustes > Facturación.");
    if (company.proximo_envio_at && Date.parse(company.proximo_envio_at) > Date.now()) {
      const segundos = Math.ceil((Date.parse(company.proximo_envio_at) - Date.now()) / 1000);
      throw httpError(429, `La AEAT pide esperar entre envíos: el siguiente sale solo en ${segundos} s.`);
    }
    const resultado = await enviarPendientesEmpresa(company);
    return { resultado };
  },

  async declaracion() {
    return { declaracion: declaracionResponsable() };
  },

  async ivaObra({ req, user }) {
    const company = await findCompany(user);
    const body = await readJsonBody(req);
    return {
      resultado: calcularFiscalidadObra({
        ...body,
        emisorAutonomo: company ? company.regimen === "autonomo" : true,
        regimenIrpfEmisor: company?.regimen_irpf || "directa"
      })
    };
  },

  async leerObra({ user, params }) {
    const company = await requireCompany(user);
    const obra = await run(getAdminClient().from("construction_projects").select("*").eq("id", params[0]).eq("company_id", company.id).maybeSingle());
    return { obra: obra ? { id: obra.id, datosFiscales: obra.datos_fiscales || {}, ivaPct: obra.iva_pct, isp: obra.isp, ivaMotivo: obra.iva_motivo } : null };
  },

  async guardarObra({ req, user, params }) {
    const company = await requireCompany(user);
    const body = await readJsonBody(req);
    const datos = body.datosFiscales && typeof body.datosFiscales === "object" ? body.datosFiscales : {};
    const resultado = calcularFiscalidadObra({
      ...datos, emisorAutonomo: company.regimen === "autonomo", regimenIrpfEmisor: company.regimen_irpf
    });
    const tipos = new Set(["obra_nueva", "rehabilitacion", "reforma_vivienda", "otra"]);
    const db = getAdminClient();
    const existente = await run(db.from("construction_projects").select("company_id").eq("id", params[0]).maybeSingle());
    if (existente && existente.company_id !== company.id) throw httpError(404, "Obra no encontrada.");
    await run(db.from("construction_projects").upsert({
      id: params[0],
      company_id: company.id,
      nombre: clip(body.nombre, 200) || params[0],
      direccion: clip(body.direccion, 300),
      tipo_obra: tipos.has(datos.tipoObra) ? datos.tipoObra : "otra",
      promotor_es_constructor: resultado.isp,
      iva_pct: resultado.ivaPct,
      isp: resultado.isp,
      iva_motivo: resultado.motivo,
      datos_fiscales: datos,
      updated_at: new Date().toISOString()
    }, { onConflict: "id" }));
    return { resultado };
  },

  async libro({ res, user, searchParams }) {
    const company = await requireCompany(user);
    const { periodo: p, rows } = await facturasDelPeriodo(company, searchParams);
    const db = getAdminClient();
    const rectificadas = [...new Set(rows.map((r) => r.rectifica_invoice_id).filter(Boolean))];
    const numeros = new Map(rows.map((r) => [r.id, r.num_serie]));
    if (rectificadas.length) {
      for (const r of await run(db.from("invoices").select("id, num_serie").in("id", rectificadas))) numeros.set(r.id, r.num_serie);
    }
    const ultimos = rows.length ? await ultimosRegistros(company.id, rows.map((r) => r.id)) : new Map();
    const estados = new Map([...ultimos].map(([id, r]) => [id, r.estado_envio]));
    await audit(company.id, user?.id, "LIBRO_EXPORTADO", { ejercicio: p.ejercicio, trimestre: p.trimestre, facturas: rows.length });
    sendFile(res, {
      contentType: "text/csv; charset=utf-8",
      filename: `libro-facturas-expedidas-${company.nif}-${p.ejercicio}${p.trimestre ? `-${p.trimestre}` : ""}.csv`,
      body: libroExpedidasCsv(rows, { numeros, estados })
    });
    return undefined;
  },

  async resumen({ user, searchParams }) {
    const company = await requireCompany(user);
    const { periodo: p, rows } = await facturasDelPeriodo(company, searchParams);
    return { periodo: p, entorno: company.verifactu_entorno, resumen: resumenTrimestral(rows) };
  },

  async listar({ user }) {
    const company = await findCompany(user);
    if (!company) return { facturas: [] };
    const rows = await run(getAdminClient().from("invoices").select("*")
      .eq("company_id", company.id).eq("entorno", company.verifactu_entorno).eq("status", "ISSUED")
      .order("issued_at", { ascending: false }));
    const registros = rows.length ? await ultimosRegistros(company.id) : new Map();
    return { facturas: rows.map((r) => toAppInvoice(r, registros.get(r.id))) };
  },

  async crear({ req, user }) {
    const company = await requireActiveCompany(user);
    const ajustes = await run(getAdminClient().from("tax_settings").select("*").eq("company_id", company.id).maybeSingle());
    const body = await readJsonBody(req);
    const nif = validarNif(body.clienteNif);
    if (!nif.valido) throw httpError(400, "El NIF del cliente no es válido. Es obligatorio para emitir la factura.");
    const clienteNombre = clip(body.clienteNombre, 120);
    if (!clienteNombre) throw httpError(400, "Falta el nombre del cliente.");
    const cliente = parseCliente(body);
    if (!cliente.cliente_direccion) throw httpError(400, "Falta el domicilio del cliente: es obligatorio en la factura.");
    const importes = parseImportes(body, toAppCompany(company, ajustes));
    if (importes.base_imponible <= 0) throw httpError(400, "La base imponible debe ser mayor que cero.");
    if (importes.isp && cliente.cliente_tipo === "particular") {
      throw httpError(400, "La inversión del sujeto pasivo solo se aplica cuando el cliente es empresario o profesional.");
    }
    const fechaOperacion = isoDate(body.fechaOperacion);

    const emitida = await emitir({
      company_id: company.id,
      tipo_factura: "F1",
      descripcion: clip(body.descripcion, 500),
      cliente_nombre: clienteNombre,
      cliente_nif: nif.nif,
      ...cliente,
      obra_id: clip(body.obraId, 64) || null,
      presupuesto_id: clip(body.presupuestoId, 64) || null,
      lineas: parseLineas(body.lineas),
      metodo_pago: clip(body.metodoPago, 120),
      fecha_operacion: fechaOperacion,
      iva_motivo: clip(body.ivaMotivo, 500),
      created_by: user?.id || null,
      ...importes
    }, user);
    return { status: 201, body: { factura: toAppInvoice(emitida, { tipo_registro: "alta", estado_envio: "pendiente" }) } };
  },

  async rectificar({ req, user, params }) {
    const company = await requireActiveCompany(user);
    const db = getAdminClient();
    const ajustes = await run(db.from("tax_settings").select("*").eq("company_id", company.id).maybeSingle());
    const original = await run(db.from("invoices").select("*").eq("id", params[0]).eq("company_id", company.id).maybeSingle());
    if (!original || original.status !== "ISSUED") throw httpError(404, "Factura original no encontrada.");
    if (original.anulada) throw httpError(400, "La factura está anulada: no se puede rectificar.");
    const body = await readJsonBody(req);
    const causa = clip(body.causa, 500);
    if (!causa) throw httpError(400, "Indica la causa de la rectificación.");
    const sustitucion = body.modo === "sustitucion";
    const importes = parseImportes({ ivaPct: Number(original.iva_pct), irpfPct: Number(original.irpf_pct), isp: original.isp, ...body }, toAppCompany(company, ajustes));
    if (sustitucion && importes.base_imponible < 0) throw httpError(400, "En una rectificativa por sustitución indica la base correcta completa (no negativa).");
    if (!sustitucion && importes.base_imponible === 0) throw httpError(400, "Indica la diferencia de base imponible (negativa para rebajar).");

    const emitida = await emitir({
      company_id: company.id,
      tipo_factura: TIPOS_RECTIFICATIVA.has(body.tipo) ? body.tipo : "R1",
      tipo_rectificativa: sustitucion ? "S" : "I",
      rectifica_invoice_id: original.id,
      rectificacion_causa: causa,
      descripcion: clip(body.descripcion, 500) || `Rectifica a ${original.num_serie}: ${causa}`.slice(0, 500),
      cliente_nombre: original.cliente_nombre,
      cliente_nif: original.cliente_nif,
      cliente_tipo: original.cliente_tipo || "empresa",
      cliente_direccion: original.cliente_direccion,
      cliente_codigo_postal: original.cliente_codigo_postal || "",
      cliente_municipio: original.cliente_municipio || "",
      cliente_provincia: original.cliente_provincia || "",
      obra_id: original.obra_id,
      presupuesto_id: original.presupuesto_id,
      lineas: parseLineas(body.lineas),
      metodo_pago: original.metodo_pago,
      fecha_operacion: isoDate(body.fechaOperacion),
      iva_motivo: original.iva_motivo || "",
      created_by: user?.id || null,
      ...importes
    }, user);
    return { status: 201, body: { factura: toAppInvoice(emitida, { tipo_registro: "alta", estado_envio: "pendiente" }) } };
  },

  async anular({ req, user, params }) {
    const company = await requireActiveCompany(user);
    const body = await readJsonBody(req);
    const motivo = clip(body.motivo, 500);
    if (!motivo) throw httpError(400, "Indica por qué se anula (por ejemplo: emitida por error, duplicada).");
    const db = getAdminClient();
    const factura = await run(db.from("invoices").select("id").eq("id", params[0]).eq("company_id", company.id).maybeSingle());
    if (!factura) throw httpError(404, "Factura no encontrada.");
    const { data, error } = await db.rpc("anular_factura", { p_invoice_id: factura.id, p_user_id: user?.id || null, p_motivo: motivo });
    if (error) throw dbError(error);
    return { factura: toAppInvoice(data, { tipo_registro: "anulacion", estado_envio: "pendiente" }) };
  },

  async subsanar({ user, params }) {
    const company = await requireActiveCompany(user);
    const db = getAdminClient();
    const factura = await run(db.from("invoices").select("*").eq("id", params[0]).eq("company_id", company.id).maybeSingle());
    if (!factura) throw httpError(404, "Factura no encontrada.");
    const { data, error } = await db.rpc("subsanar_registro", { p_invoice_id: factura.id, p_user_id: user?.id || null });
    if (error) throw dbError(error);
    return { factura: toAppInvoice(factura, data) };
  },

  async cobro({ req, user, params }) {
    const company = await requireCompany(user);
    const body = await readJsonBody(req);
    const cobrada = body.estadoCobro === "cobrada";
    const row = await run(getAdminClient().from("invoices").update({
      estado_cobro: cobrada ? "cobrada" : "pendiente",
      fecha_cobro: cobrada ? (isoDate(body.fechaCobro) || new Date().toISOString().slice(0, 10)) : null,
      ...(body.metodoPago !== undefined ? { metodo_pago: clip(body.metodoPago, 120) } : {})
    }).eq("id", params[0]).eq("company_id", company.id).select("*").maybeSingle());
    if (!row) throw httpError(404, "Factura no encontrada.");
    const registros = await ultimosRegistros(company.id, [row.id]);
    return { factura: toAppInvoice(row, registros.get(row.id)) };
  },

  async facturae({ res, user, params }) {
    const company = await requireCompany(user);
    const db = getAdminClient();
    const factura = await run(db.from("invoices").select("*").eq("id", params[0]).eq("company_id", company.id).maybeSingle());
    if (!factura) throw httpError(404, "Factura no encontrada.");
    if (factura.anulada) throw httpError(400, "La factura está anulada.");
    const original = factura.rectifica_invoice_id
      ? await run(db.from("invoices").select("*").eq("id", factura.rectifica_invoice_id).maybeSingle())
      : null;
    const ajustes = await run(db.from("tax_settings").select("texto_isp").eq("company_id", company.id).maybeSingle());
    const xml = generarFacturae({ factura, empresa: company, original, textoIsp: ajustes?.texto_isp || "" });
    sendFile(res, { contentType: "application/xml; charset=utf-8", filename: `${factura.num_serie}.xml`, body: xml });
    return undefined;
  }
};

/** Devuelve true si la petición era de este módulo (y ya está respondida). */
export async function handleFacturacionRoutes(req, res, pathname, searchParams = null) {
  if (!/^\/api\/(facturacion|facturas)(\/|$)/.test(pathname)) return false;
  let ruta = null;
  let params = [];
  for (const [method, re, name] of ROUTES) {
    const m = pathname.match(re);
    if (m && method === req.method) {
      ruta = name;
      params = m.slice(1);
      break;
    }
    if (m) ruta = ruta || "";
  }

  try {
    if (ruta === null) throw httpError(404, "Ruta de facturación no encontrada.");
    if (ruta === "") throw httpError(405, "Método no permitido.");
    if (!isSupabaseReady()) throw httpError(503, "La facturación necesita Supabase configurado en el servidor.");
    if (!req.user || req.user.role !== "admin") throw httpError(403, "Solo administradores.");
    const result = await handlers[ruta]({ req, res, user: req.user, params, searchParams });
    if (result === undefined) return true; // ya respondido (descargas)
    if (result.status && result.body) sendJson(res, result.status, result.body);
    else sendJson(res, 200, result);
    return true;
  } catch (err) {
    if (!err?.status) console.error("[facturacion] Error en", pathname, err?.message || err);
    if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "No se pudo completar la operación de facturación." });
    return true;
  }
}
