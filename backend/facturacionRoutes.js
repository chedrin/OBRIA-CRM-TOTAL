/**
 * ObraMaster - Facturación legal (VeriFactu)
 *
 * El interruptor "Facturación activada" de cada empresa decide si la app factura:
 *   - Desactivado: no se emite nada; ObraMaster solo hace presupuestos y obras.
 *   - Activado: todas las facturas se emiten aquí, con número correlativo y
 *     registro VeriFactu encadenado (sin forma de facturar "por fuera").
 *
 * La numeración, la huella y el bloqueo de facturas emitidas los aplica la base
 * de datos (supabase_schema_facturacion.sql). Este módulo valida, llama a
 * emitir_factura() y devuelve los datos a la app. Solo administradores.
 *
 * Rutas:
 *   GET   /api/facturacion                  empresa, ajustes e interruptor
 *   PUT   /api/facturacion/empresa          crear o cambiar la empresa y sus ajustes
 *   GET   /api/facturacion/verificar        comprobar la cadena de huellas
 *   GET   /api/facturas                     facturas de la empresa
 *   POST  /api/facturas                     crear y emitir una factura
 *   POST  /api/facturas/:id/rectificar      emitir una rectificativa por diferencias
 *   PATCH /api/facturas/:id/cobro           marcar cobrada o pendiente
 */

import { getAdminClient, isSupabaseReady } from "./authRoutes.js";
import { validarNif } from "./verifactu/nif.js";
import { verificarCadena } from "./verifactu/huella.js";

const IVA_VALIDOS = new Set([0, 4, 5, 10, 21]);
const TIPOS_RECTIFICATIVA = new Set(["R1", "R2", "R3", "R4"]);
const MAX_LINEAS = 300;

const clip = (value, max) => String(value ?? "").trim().slice(0, max);
const money = (value) => Math.round(Number(value) * 100) / 100;

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 512 * 1024) {
        reject(httpError(413, "Petición demasiado grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(httpError(400, "JSON no válido."));
      }
    });
    req.on("error", reject);
  });
}

/** Errores de Supabase: falta la tabla -> 503; una regla de la base de datos -> 400 con su mensaje. */
function dbError(error) {
  const text = String(error?.message || error || "");
  if (error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202" || /does not exist|schema cache/i.test(text)) {
    return httpError(503, "Falta preparar la base de datos: ejecuta supabase_schema_facturacion.sql en Supabase > SQL Editor.");
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

async function requireActiveCompany(user) {
  const company = await findCompany(user);
  if (!company) throw httpError(409, "Configura primero la empresa en Ajustes > Facturación.");
  if (!company.facturacion_activada) throw httpError(403, "La facturación está desactivada para esta empresa.");
  return company;
}

/** Factura en el formato que usa la app (mismos nombres que las facturas antiguas). */
export function toAppInvoice(row) {
  const fecha = row.fecha_expedicion || String(row.created_at || "").slice(0, 10);
  const mes = Number(String(fecha).slice(5, 7)) || 1;
  return {
    id: row.id,
    legal: true,
    status: row.status,
    numero: row.num_serie || "BORRADOR",
    tipoFactura: row.descripcion || (row.tipo_factura === "F1" ? "Factura" : "Factura rectificativa"),
    tipoAeat: row.tipo_factura,
    rectificaId: row.rectifica_invoice_id,
    rectificacionCausa: row.rectificacion_causa,
    presupuestoId: row.presupuesto_id,
    obraId: row.obra_id,
    obraTitulo: row.descripcion || row.cliente_nombre,
    cliente: row.cliente_nombre,
    cifNif: row.cliente_nif,
    direccion: row.cliente_direccion,
    fechaEmision: fecha,
    fechaVencimiento: row.fecha_vencimiento,
    trimestre: `${Math.ceil(mes / 3)}T`,
    ano: Number(String(fecha).slice(0, 4)) || null,
    lineas: row.lineas || [],
    baseImponible: Number(row.base_imponible),
    tipoIvaPct: Number(row.iva_pct),
    cuotaIva: Number(row.cuota_iva),
    isp: row.isp,
    retencionIrpfPct: Number(row.irpf_pct),
    cuotaRetencion: Number(row.cuota_irpf),
    importeTotal: Number(row.importe_total),
    totalFactura: Number(row.liquido),
    estadoCobro: row.estado_cobro,
    fechaCobro: row.fecha_cobro,
    metodoPago: row.metodo_pago,
    huella: row.huella,
    qrUrl: row.qr_url
  };
}

function toAppCompany(company, ajustes) {
  if (!company) return null;
  return {
    id: company.id,
    nif: company.nif,
    razonSocial: company.razon_social,
    domicilio: company.domicilio,
    regimen: company.regimen,
    facturacionActivada: company.facturacion_activada,
    verifactuEntorno: company.verifactu_entorno,
    serieOrdinaria: ajustes?.serie_ordinaria || "F",
    serieRectificativa: ajustes?.serie_rectificativa || "R",
    ivaPorDefectoPct: Number(ajustes?.iva_por_defecto_pct ?? 21),
    irpfPorDefectoPct: Number(ajustes?.irpf_por_defecto_pct ?? 0),
    textoIsp: ajustes?.texto_isp || "",
    diasVencimiento: Number(ajustes?.dias_vencimiento ?? 30)
  };
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

/** Devuelve true si la petición era de este módulo (y ya está respondida). */
export async function handleFacturacionRoutes(req, res, pathname) {
  const match = pathname.match(/^\/api\/(facturacion|facturas)(?:\/([\w-]{1,64}))?(?:\/(rectificar|cobro))?$/);
  if (!match) return false;
  const [, area, segment, action] = match;

  try {
    if (!isSupabaseReady()) throw httpError(503, "La facturación necesita Supabase configurado en el servidor.");
    if (req.user && req.user.role !== "admin") throw httpError(403, "Solo administradores.");
    const db = getAdminClient();
    const user = req.user || null;

    if (area === "facturacion" && !segment && req.method === "GET") {
      const company = await findCompany(user);
      const ajustes = company ? await run(db.from("tax_settings").select("*").eq("company_id", company.id).maybeSingle()) : null;
      return sendJson(res, 200, { empresa: toAppCompany(company, ajustes) }), true;
    }

    if (area === "facturacion" && segment === "empresa" && req.method === "PUT") {
      const body = await readJsonBody(req);
      const nif = validarNif(body.nif);
      if (!nif.valido) throw httpError(400, "El NIF de la empresa no es válido.");
      const razonSocial = clip(body.razonSocial, 200);
      if (!razonSocial) throw httpError(400, "Falta la razón social o el nombre.");
      const fields = {
        nif: nif.nif,
        razon_social: razonSocial,
        domicilio: clip(body.domicilio, 300),
        regimen: body.regimen === "sociedad" ? "sociedad" : "autonomo",
        facturacion_activada: body.facturacionActivada === true,
        // Hasta que el envío a la AEAT esté hecho, solo entorno de pruebas (QR de preproducción).
        verifactu_entorno: "pruebas"
      };
      const current = await findCompany(user);
      const company = current
        ? await run(db.from("companies").update(fields).eq("id", current.id).select("*").single())
        : await run(db.from("companies").insert(fields).select("*").single());
      if (!current && user?.id) {
        await run(db.from("profiles").update({ company_id: company.id }).eq("id", user.id));
        user.company_id = company.id;
      }

      const serie = (value, fallback) => (/^[A-Z0-9]{1,10}$/.test(clip(value, 10).toUpperCase()) ? clip(value, 10).toUpperCase() : fallback);
      const iva = Number(body.ivaPorDefectoPct);
      const ajustes = await run(db.from("tax_settings").upsert({
        company_id: company.id,
        serie_ordinaria: serie(body.serieOrdinaria, "F"),
        serie_rectificativa: serie(body.serieRectificativa, "R"),
        iva_por_defecto_pct: IVA_VALIDOS.has(iva) ? iva : 21,
        irpf_por_defecto_pct: Math.min(Math.max(Number(body.irpfPorDefectoPct) || 0, 0), 47),
        dias_vencimiento: Math.min(Math.max(Math.round(Number(body.diasVencimiento) || 30), 0), 365),
        ...(clip(body.textoIsp, 500) ? { texto_isp: clip(body.textoIsp, 500) } : {}),
        updated_at: new Date().toISOString()
      }, { onConflict: "company_id" }).select("*").single());

      if (!current || current.facturacion_activada !== company.facturacion_activada) {
        await audit(company.id, user?.id, company.facturacion_activada ? "FACTURACION_ACTIVADA" : "FACTURACION_DESACTIVADA", { nif: company.nif });
      } else {
        await audit(company.id, user?.id, "EMPRESA_ACTUALIZADA", { nif: company.nif });
      }
      return sendJson(res, 200, { empresa: toAppCompany(company, ajustes) }), true;
    }

    if (area === "facturacion" && segment === "verificar" && req.method === "GET") {
      const company = await findCompany(user);
      if (!company) throw httpError(409, "Configura primero la empresa en Ajustes > Facturación.");
      const registros = await run(db.from("verifactu_records").select("*").eq("company_id", company.id).order("id", { ascending: true }));
      return sendJson(res, 200, { registros: registros.length, ...verificarCadena(registros) }), true;
    }

    if (area === "facturas" && !segment && req.method === "GET") {
      const company = await findCompany(user);
      if (!company) return sendJson(res, 200, { facturas: [] }), true;
      const rows = await run(db.from("invoices").select("*").eq("company_id", company.id).eq("status", "ISSUED").order("issued_at", { ascending: false }));
      return sendJson(res, 200, { facturas: rows.map(toAppInvoice) }), true;
    }

    if (area === "facturas" && !segment && req.method === "POST") {
      const company = await requireActiveCompany(user);
      const ajustes = await run(db.from("tax_settings").select("*").eq("company_id", company.id).maybeSingle());
      const body = await readJsonBody(req);
      const nif = validarNif(body.clienteNif);
      if (!nif.valido) throw httpError(400, "El NIF del cliente no es válido. Es obligatorio para emitir la factura.");
      const clienteNombre = clip(body.clienteNombre, 200);
      if (!clienteNombre) throw httpError(400, "Falta el nombre del cliente.");
      const importes = parseImportes(body, toAppCompany(company, ajustes));
      if (importes.base_imponible <= 0) throw httpError(400, "La base imponible debe ser mayor que cero.");

      const emitida = await emitir({
        company_id: company.id,
        tipo_factura: "F1",
        descripcion: clip(body.descripcion, 300),
        cliente_nombre: clienteNombre,
        cliente_nif: nif.nif,
        cliente_direccion: clip(body.clienteDireccion, 300),
        obra_id: clip(body.obraId, 64) || null,
        presupuesto_id: clip(body.presupuestoId, 64) || null,
        lineas: parseLineas(body.lineas),
        metodo_pago: clip(body.metodoPago, 120),
        created_by: user?.id || null,
        ...importes
      }, user);
      return sendJson(res, 201, { factura: toAppInvoice(emitida) }), true;
    }

    if (area === "facturas" && segment && action === "rectificar" && req.method === "POST") {
      const company = await requireActiveCompany(user);
      const ajustes = await run(db.from("tax_settings").select("*").eq("company_id", company.id).maybeSingle());
      const original = await run(db.from("invoices").select("*").eq("id", segment).eq("company_id", company.id).maybeSingle());
      if (!original || original.status !== "ISSUED") throw httpError(404, "Factura original no encontrada.");
      const body = await readJsonBody(req);
      const causa = clip(body.causa, 500);
      if (!causa) throw httpError(400, "Indica la causa de la rectificación.");
      const importes = parseImportes({ ivaPct: Number(original.iva_pct), irpfPct: Number(original.irpf_pct), isp: original.isp, ...body }, toAppCompany(company, ajustes));
      if (importes.base_imponible === 0) throw httpError(400, "Indica la diferencia de base imponible (negativa para rebajar).");

      const emitida = await emitir({
        company_id: company.id,
        tipo_factura: TIPOS_RECTIFICATIVA.has(body.tipo) ? body.tipo : "R1",
        rectifica_invoice_id: original.id,
        rectificacion_causa: causa,
        descripcion: clip(body.descripcion, 300) || `Rectifica a ${original.num_serie}`,
        cliente_nombre: original.cliente_nombre,
        cliente_nif: original.cliente_nif,
        cliente_direccion: original.cliente_direccion,
        obra_id: original.obra_id,
        presupuesto_id: original.presupuesto_id,
        lineas: parseLineas(body.lineas),
        metodo_pago: original.metodo_pago,
        created_by: user?.id || null,
        ...importes
      }, user);
      return sendJson(res, 201, { factura: toAppInvoice(emitida) }), true;
    }

    if (area === "facturas" && segment && action === "cobro" && req.method === "PATCH") {
      const company = await findCompany(user);
      if (!company) throw httpError(404, "Factura no encontrada.");
      const body = await readJsonBody(req);
      const cobrada = body.estadoCobro === "cobrada";
      const row = await run(db.from("invoices").update({
        estado_cobro: cobrada ? "cobrada" : "pendiente",
        fecha_cobro: cobrada ? (clip(body.fechaCobro, 10) || new Date().toISOString().slice(0, 10)) : null,
        ...(body.metodoPago !== undefined ? { metodo_pago: clip(body.metodoPago, 120) } : {})
      }).eq("id", segment).eq("company_id", company.id).select("*").maybeSingle());
      if (!row) throw httpError(404, "Factura no encontrada.");
      return sendJson(res, 200, { factura: toAppInvoice(row) }), true;
    }

    sendJson(res, 405, { error: "Método no permitido." });
    return true;
  } catch (err) {
    if (!err?.status) console.error("[facturacion] Error en", pathname, err?.message || err);
    if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "No se pudo completar la operación de facturación." });
    return true;
  }
}
