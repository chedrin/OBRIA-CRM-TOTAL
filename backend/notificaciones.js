/**
 * ObraMaster - Avisos, necesidades de obra, pedidos a proveedor y enlace mágico de subcontratas
 *
 * Tablas: ver supabase_schema_notificaciones.sql. Todo se escribe con la clave de servicio,
 * solo en el servidor. Sin Supabase configurado estas rutas responden 503.
 *
 * Rutas públicas (sin sesión; las protege el token del enlace):
 *   GET  /api/sub/:token                Datos mínimos para la página de la subcontrata.
 *   POST /api/sub/:token/terminado      "Trabajo terminado / listo para revisión" (fotos + notas).
 *   POST /api/sub/:token/necesidad      "Reportar necesidad o incidencia" (categoría, texto, fotos).
 *
 * Rutas con sesión (administrador, salvo POST /api/needs que también puede usar un obrero):
 *   POST  /api/sub-tokens               Crea un enlace para una subcontrata (devuelve URL y enlace de WhatsApp).
 *   POST  /api/sub-tokens/:id/revoke    Anula un enlace.
 *   POST  /api/sub-tokens/:id/resend    Devuelve de nuevo la URL y el mensaje (hasta que el trabajo esté certificado al 100 %).
 *   POST  /api/sub-tokens/assignment/:id  Igual, a partir de una asignación de Avance de Obra (lo crea si no existe).
 *   GET   /api/notifications            ?unread=1&obra=<id>&category=<cat>
 *   POST  /api/notifications/read       { ids: [...] } o { all: true }
 *   GET   /api/needs                    ?status=<estado>&obra=<id>
 *   POST  /api/needs                    Alta de una necesidad (obrero / encargado / admin).
 *   PATCH /api/needs/:id                Cambiar estado o datos.
 *   POST  /api/needs/:id/order-draft    { supplier_ids: [...], kind } -> borradores de correo.
 *   PATCH /api/material-orders/:id      Editar el borrador (asunto, cuerpo, destinatario).
 *   POST  /api/material-orders/:id/send "Aprobar y enviar pedido" (Resend).
 *   GET   /api/suppliers  ·  POST /api/suppliers  ·  PATCH /api/suppliers/:id
 *   GET   /api/sub-tokens               Enlaces creados (sin el token), con el % certificado y si se pueden reenviar.
 *   GET   /api/material-orders          ?need=<id>
 *   GET   /api/site-reports             Partes recibidos por enlace, con fotos firmadas.
 *   PATCH /api/site-reports/:id         { review_result: "aprobado" | "rechazado" }
 *
 * Variables de entorno (servidor): RESEND_API_KEY, RESEND_FROM_EMAIL (ver emailService.js), PUBLIC_APP_URL,
 * LINK_ENCRYPTION_KEY (opcional; si falta se usa CERT_ENCRYPTION_KEY) para guardar cifrado el token y poder reenviarlo.
 */

import crypto from "node:crypto";
import { getAdminClient, isSupabaseReady } from "./authRoutes.js";
import { buildSupplierOrderEmail, normalizeItems } from "./supplierEmail.js";
import { sendPushForNotification } from "./webPush.js";
import { sendEmail } from "./emailService.js";
import { computeAvance, flattenPlan, findPartida, WHOLE_PHASE } from "../src/utils/avanceObra.js";
import { contactName, generateWhatsAppAssignmentUrl, isWhatsAppCloudConfigured, sendWhatsAppCloud } from "./whatsapp.js";

const MAX_JSON_BYTES = 256 * 1024;
const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const PHOTO_BUCKET = "obra-fotos";
const TOKEN_PATTERN = /^tk_[A-Za-z0-9_-]{24,64}$/;
const UUID = "[0-9a-fA-F-]{36}";

const NEED_CATEGORIES = new Set(["material", "herramienta", "maquinaria", "bloqueo", "coordinacion", "seguridad", "otro"]);
const NEED_STATUSES = new Set(["nueva", "en_revision", "pedido_tramitado", "entregado", "resuelto", "descartada"]);
const NOTIFICATION_CATEGORIES = new Set(["urgente", "aviso", "material", "incidencia"]);
const NEED_LABELS = {
  material: "Falta material",
  herramienta: "Falta herramienta",
  maquinaria: "Avería de maquinaria",
  bloqueo: "Tajo bloqueado",
  coordinacion: "Petición de coordinación",
  seguridad: "Aviso de seguridad",
  otro: "Otra incidencia"
};

export const clip = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
export function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readBuffer(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(httpError(413, "Los archivos son demasiado grandes."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function readJson(req, limit = MAX_JSON_BYTES) {
  const buffer = await readBuffer(req, limit);
  if (buffer.length === 0) return {};
  try {
    return JSON.parse(buffer.toString("utf-8"));
  } catch {
    throw httpError(400, "El cuerpo de la petición no es un JSON válido.");
  }
}

/** Acepta JSON o multipart/form-data (fotos en campos foto / fotos). */
export async function readForm(req, parseMultipart) {
  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.includes("multipart/form-data")) return { fields: await readJson(req), photos: [] };
  const boundary = contentType.match(/boundary=([^;]+)/i)?.[1]?.trim();
  if (!boundary) throw httpError(400, "Formulario incorrecto.");
  const buffer = await readBuffer(req, MAX_UPLOAD_BYTES);
  const { fields, files } = parseMultipart(buffer, boundary);
  return { fields, photos: files.fotos || [] };
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "desconocida";
}

// Límite sencillo por IP para las rutas públicas del enlace.
const hits = new Map();
export function rateLimited(req, max) {
  const key = `${clientIp(req)}|${max}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + 10 * 60 * 1000 });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

function publicBaseUrl(req) {
  const configured = clip(process.env.PUBLIC_APP_URL, 300).replace(/\/+$/, "");
  if (configured) return configured;
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim();
  return `${proto}://${req.headers.host || "localhost:3000"}`;
}

// ---------------------------------------------------------------------------
// Datos de la app guardados en app_records (obras, subcontratas, empresa)
// ---------------------------------------------------------------------------
export async function getAppRecord(collection, id) {
  if (!id) return null;
  const { data, error } = await getAdminClient()
    .from("app_records")
    .select("data")
    .eq("collection", collection)
    .eq("id", String(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.data || null;
}

export const getObra = (id) => getAppRecord("obras", id);
const getEmpresa = async () => (await getAppRecord("empresa_config", "main")) || {};

export function obraLabel(obra, fallback = "") {
  if (!obra) return fallback;
  return [obra.codigo, obra.titulo].filter(Boolean).join(" - ") || fallback;
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------
/**
 * Crea un aviso. El panel de administración abierto lo recibe al instante por
 * Supabase Realtime (tabla notifications) y los dispositivos suscritos, por Web Push.
 */
export async function createNotification({ category = "aviso", origin = "sistema", obraId = null, obraLabel: label = null, title, body = "", link = null, refTable = null, refId = null, recipientId = null, faseId = null, partidaId = null }) {
  const row = {
    category: NOTIFICATION_CATEGORIES.has(category) ? category : "aviso",
    origin,
    obra_id: obraId,
    obra_label: label,
    title: clip(title, 200),
    body: clip(body, 2000),
    link,
    ref_table: refTable,
    ref_id: refId,
    recipient_id: recipientId
  };
  // Columnas de supabase_schema_avance_obra.sql: solo se envían si el aviso va ligado a una fase.
  if (faseId !== null) {
    row.fase_id = faseId;
    row.partida_id = partidaId || "";
  }
  const { data, error } = await getAdminClient().from("notifications").insert(row).select().single();
  if (error) {
    console.error("[avisos] No se pudo crear el aviso:", error.message);
    return null;
  }
  sendPushForNotification(data); // sin esperar: el push no debe retrasar la respuesta
  return data;
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------
function detectImageType(buffer) {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buffer.length > 8 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buffer.length > 12 && buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
  return null;
}

export async function uploadPhotos(photos, obraId) {
  if (photos.length > MAX_PHOTOS) throw httpError(400, `Como máximo ${MAX_PHOTOS} fotos.`);
  const storage = getAdminClient().storage.from(PHOTO_BUCKET);
  const month = new Date().toISOString().slice(0, 7);
  const folder = String(obraId || "sin-obra").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60);
  const paths = [];
  for (const photo of photos) {
    if (photo.size > MAX_PHOTO_BYTES) throw httpError(413, "Una de las fotos es demasiado grande.");
    const type = detectImageType(photo.buffer);
    if (!type) throw httpError(400, "Solo se admiten fotos JPG, PNG o WEBP.");
    const objectPath = `${folder}/${month}/${crypto.randomUUID()}.${type.ext}`;
    const { error } = await storage.upload(objectPath, photo.buffer, { contentType: type.mime, upsert: false });
    if (error) throw new Error(`No se pudo guardar la foto: ${error.message}`);
    paths.push(objectPath);
  }
  return paths;
}

export async function signPhotos(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return [];
  const { data, error } = await getAdminClient().storage.from(PHOTO_BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) return [];
  return (data || []).map((item) => item.signedUrl).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Enlace mágico de subcontratas
// ---------------------------------------------------------------------------
export async function findToken(rawToken) {
  if (!TOKEN_PATTERN.test(rawToken)) return null;
  const { data, error } = await getAdminClient()
    .from("subcontractor_tokens")
    .select("*")
    .eq("token_hash", hashToken(rawToken))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.revoked_at || new Date(data.expires_at) < new Date()) return null;
  return data;
}

export async function touchToken(token) {
  await getAdminClient()
    .from("subcontractor_tokens")
    .update({ last_used_at: new Date().toISOString(), use_count: (token.use_count || 0) + 1 })
    .eq("id", token.id);
}

/** Función (faseId, partidaId) => bool: la partida está asignada a la subcontrata del enlace. */
export async function subAssignmentCheck(token) {
  if (!token.obra_id) return () => false;
  const { data, error } = await getAdminClient()
    .from("work_assignments")
    .select("fase_id, partida_id, subcontractor_id, assignee_name")
    .eq("obra_id", token.obra_id)
    .eq("assignee_type", "subcontrata")
    .eq("is_active", true);
  if (error) return () => false;
  const mine = (data || []).filter((a) => (token.subcontractor_id
    ? a.subcontractor_id === token.subcontractor_id
    : String(a.assignee_name || "").toLowerCase() === String(token.subcontractor_name || "").toLowerCase()));
  // Sin asignaciones todavía, puede avisar de cualquier partida de su obra.
  if (data && data.length === 0) return () => true;
  return (faseId, partidaId) => mine.some((a) => a.fase_id === faseId && (!a.partida_id || a.partida_id === partidaId));
}

async function handleSubGet(res, token) {
  const empresa = await getEmpresa();
  sendJson(res, 200, {
    subcontrata: token.subcontractor_name,
    obra: token.obra_label || "",
    direccion: token.obra_address || "",
    tarea: token.task_label || "",
    empresa: empresa.nombreComercial || empresa.razonSocial || "ObraMaster",
    telefonoEmpresa: empresa.telefono || "",
    categorias: Object.entries(NEED_LABELS).map(([value, label]) => ({ value, label })),
    caduca: token.expires_at,
    // Enlace de una asignación concreta: la página se centra en esa fase o partida.
    foco: token.fase_id ? { faseId: token.fase_id, partidaId: token.partida_id || "" } : null
  });
}

async function handleSubDone(req, res, token, parseMultipart) {
  const { fields, photos } = await readForm(req, parseMultipart);
  const notes = clip(fields.notas, 2000);
  const photoPaths = await uploadPhotos(photos, token.obra_id);

  const { data: report, error } = await getAdminClient()
    .from("site_reports")
    .insert({
      token_id: token.id,
      subcontractor_id: token.subcontractor_id,
      subcontractor_name: token.subcontractor_name,
      obra_id: token.obra_id,
      obra_label: token.obra_label,
      task_ref: token.task_ref,
      task_label: token.task_label,
      kind: "trabajo_terminado",
      notes,
      photos: photoPaths
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  await touchToken(token);
  await createNotification({
    category: "aviso",
    origin: "subcontrata",
    obraId: token.obra_id,
    obraLabel: token.obra_label,
    title: `${token.subcontractor_name}: trabajo terminado${token.task_label ? ` (${token.task_label})` : ""}`,
    body: [notes, photoPaths.length ? `${photoPaths.length} foto(s) adjunta(s).` : ""].filter(Boolean).join(" "),
    refTable: "site_reports",
    refId: report.id
  });
  sendJson(res, 201, { ok: true, mensaje: "Recibido. El jefe de obra ya tiene el aviso para revisarlo." });
}

async function handleSubNeed(req, res, token, parseMultipart) {
  const { fields, photos } = await readForm(req, parseMultipart);
  const category = NEED_CATEGORIES.has(fields.categoria) ? fields.categoria : "otro";
  const motivo = clip(fields.motivo, 120);
  const notes = clip(fields.descripcion, 2000);
  const description = clip([motivo, notes].filter(Boolean).join(". "), 2000);
  if (!description) throw httpError(400, "Escribe brevemente qué pasa o qué hace falta.");
  const urgency = fields.urgente === "true" || fields.urgente === true ? "urgente" : "normal";
  // Partida afectada: la que elija o, en un enlace de asignación, la suya. Debe ser de su obra
  // y estar asignada a su empresa.
  const hasTarget = fields.fase_id !== undefined && fields.fase_id !== "";
  const faseId = hasTarget ? fields.fase_id : token.fase_id;
  const partidaId = hasTarget ? fields.partida_id : token.partida_id;
  const linked = faseId
    ? needPartidaFields(await getObra(token.obra_id), faseId, partidaId, await subAssignmentCheck(token))
    : {};
  const photoPaths = await uploadPhotos(photos, token.obra_id);
  const items = category === "material"
    ? normalizeItems([{ material: notes || motivo, cantidad: clip(fields.cantidad, 20), unidad: clip(fields.unidad, 20) }], description)
    : [];

  const need = await insertNeed({
    ...linked,
    obra_id: token.obra_id,
    obra_label: token.obra_label,
    tajo: linked.partida_label || linked.fase_label || token.task_label,
    category,
    urgency,
    description,
    items,
    needed_by: /^\d{4}-\d{2}-\d{2}$/.test(fields.fecha_limite || "") ? fields.fecha_limite : null,
    reported_by_type: "subcontrata",
    reported_by_name: token.subcontractor_name,
    subcontractor_id: token.subcontractor_id,
    token_id: token.id,
    photos: photoPaths
  });
  // Petición de material: el borrador de pedido queda listo para que compras elija proveedor y lo envíe.
  if (category === "material") {
    await createOrderDrafts(need).catch((err) => console.error("[avisos] No se pudo crear el borrador de pedido:", err?.message || err));
  }
  await touchToken(token);
  sendJson(res, 201, {
    ok: true,
    id: need.id,
    mensaje: category === "material"
      ? "Pedido de material enviado a la oficina. Te avisarán cuando esté tramitado."
      : category === "bloqueo"
        ? "Incidencia enviada. La partida queda marcada como bloqueada y el jefe de obra ya tiene el aviso."
        : "Aviso enviado. Te contactarán en breve."
  });
}

// El token se guarda cifrado (AES-256-GCM) para poder reenviar el mismo enlace.
// Sin clave en el servidor solo queda la huella y reenviar genera un enlace nuevo.
function linkKey() {
  const raw = String(process.env.LINK_ENCRYPTION_KEY || process.env.CERT_ENCRYPTION_KEY || "");
  return raw.length >= 32 ? crypto.createHash("sha256").update(`obramaster-enlaces-sub:${raw}`).digest() : null;
}

export function sealToken(rawToken) {
  const key = linkKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(rawToken, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${data.toString("base64")}`;
}

export function openToken(sealed) {
  const key = linkKey();
  const [version, iv, tag, data] = String(sealed || "").split(".");
  if (!key || version !== "v1" || !data) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const raw = Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
    return TOKEN_PATTERN.test(raw) ? raw : null;
  } catch {
    return null; // clave cambiada: se regenera al reenviar
  }
}

const newRawToken = () => `tk_${crypto.randomBytes(24).toString("base64url")}`;
const missingTokenEnc = (error) => /token_enc/.test(error?.message || "");
const daysFromNow = (days) => new Date(Date.now() + Math.min(Math.max(Number(days) || 60, 1), 365) * 86400000).toISOString();
const publicToken = ({ token_hash, token_enc, ...rest }) => rest;
const tokenTaskKind = (t) => (String(t.task_ref || "").startsWith("fase:") || (t.fase_id && !t.partida_id) ? "fase" : "partida");

/** URL, mensaje de WhatsApp y datos para el correo de un enlace (al crearlo y al reenviarlo). */
async function linkPayload(req, row, rawToken, taskKind = tokenTaskKind(row)) {
  const sub = row.subcontractor_id ? await getAppRecord("subcontractors", row.subcontractor_id) : null;
  const url = `${publicBaseUrl(req)}/sub/${rawToken}`;
  const contacto = contactName(sub?.personaContacto, row.subcontractor_name);
  const wa = generateWhatsAppAssignmentUrl({
    phone: row.phone || sub?.telefono,
    project: row.obra_label || "",
    task: row.task_label,
    taskKind,
    contact: contacto,
    url
  });
  return {
    ...publicToken(row),
    url,
    phone: wa.phone,
    whatsappUrl: wa.url,
    mensaje: wa.message,
    whatsappCloud: isWhatsAppCloudConfigured(),
    // Para "Enviar por correo" (plantilla subcontrata_enlace)
    email: clip(sub?.email, 254) || "",
    contacto,
    task_kind: taskKind
  };
}

/**
 * Crea un enlace mágico. Devuelve la fila (sin el token), la URL y el enlace de
 * WhatsApp con el mensaje escrito. `faseId`/`partidaId`/`assignmentId` lo centran
 * en una asignación concreta (se crea solo al asignar una fase o partida).
 */
export async function createSubToken({ req, subcontractorId = null, name = "", phone = "", obraId = null, obraLabelText = "", taskRef = null, taskLabel = null, taskKind = "partida", faseId = null, partidaId = null, assignmentId = null, days = 60 }) {
  const sub = subcontractorId ? await getAppRecord("subcontractors", subcontractorId) : null;
  const subName = clip(name || sub?.nombreComercial || sub?.razonSocial, 200);
  if (!subName) throw httpError(400, "Indica la subcontrata.");
  const obra = obraId ? await getObra(obraId) : null;

  const rawToken = newRawToken();
  const row = {
    token_hash: hashToken(rawToken),
    subcontractor_id: subcontractorId,
    subcontractor_name: subName,
    phone: clip(phone || sub?.telefono, 40),
    obra_id: obraId,
    obra_label: obraLabel(obra, clip(obraLabelText, 200)),
    obra_address: clip(obra?.direccion, 300),
    task_ref: taskRef,
    task_label: clip(taskLabel, 200) || null,
    expires_at: daysFromNow(days),
    created_by: req?.user?.id || null
  };
  // Columnas de supabase_schema_avance_obra.sql: solo si el enlace va ligado a una asignación.
  if (faseId) Object.assign(row, { fase_id: faseId, partida_id: partidaId || "", assignment_id: assignmentId });
  const sealed = sealToken(rawToken);
  const insert = (values) => getAdminClient().from("subcontractor_tokens").insert(values).select("*").single();
  let { data, error } = await insert(sealed ? { ...row, token_enc: sealed } : row);
  // Sin supabase_migration_enlaces_reenvio.sql todavía: se guarda sin cifrar el token (no se podrá reenviar el mismo).
  if (error && sealed && missingTokenEnc(error)) ({ data, error } = await insert(row));
  if (error) throw new Error(error.message);
  return linkPayload(req, data, rawToken, taskKind);
}

/**
 * % certificado del trabajo de cada enlace (fase, partida u obra entera).
 * El trabajo está finalizado cuando el jefe de obra lo ha validado al 100 %.
 */
async function tokensWorkPct(tokens) {
  const admin = getAdminClient();
  const byObra = new Map();
  for (const t of tokens) if (t.obra_id && !t.revoked_at) byObra.set(t.obra_id, null);
  await Promise.all([...byObra.keys()].map(async (obraId) => {
    const [obra, progress] = await Promise.all([
      getObra(obraId).catch(() => null),
      admin.from("work_item_progress").select("*").eq("obra_id", obraId) // sin la tabla de avance: el % de la obra
    ]);
    byObra.set(obraId, obra ? computeAvance(obra, { progress: progress.error ? [] : progress.data || [] }) : null);
  }));
  return new Map(tokens.map((t) => {
    const summary = byObra.get(t.obra_id);
    if (!summary) return [t.id, null];
    let faseId = t.fase_id || null;
    let partidaId = t.partida_id || WHOLE_PHASE;
    const [kind, refId] = String(t.task_ref || "").split(":");
    if (!faseId && kind === "fase") faseId = refId;
    if (!faseId && kind === "tarea") {
      const fase = summary.fases.find((f) => f.partidas.some((p) => p.id === refId));
      if (!fase) return [t.id, null];
      faseId = fase.id;
      partidaId = refId;
    }
    if (!faseId) return [t.id, summary.certified];
    const fase = summary.fases.find((f) => f.id === String(faseId));
    if (!fase) return [t.id, null];
    if (!partidaId) return [t.id, fase.certified];
    const partida = fase.partidas.find((p) => p.id === String(partidaId));
    return [t.id, partida ? partida.certified : null];
  }));
}

async function listTokens() {
  const { data, error } = await getAdminClient()
    .from("subcontractor_tokens")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const rows = data || [];
  const pct = await tokensWorkPct(rows);
  return rows.map((t) => {
    const workPct = pct.get(t.id);
    const finished = workPct !== null && workPct !== undefined && workPct >= 100;
    return {
      ...publicToken(t),
      work_pct: workPct ?? null,
      finished,
      can_resend: !t.revoked_at && !finished,
      same_link: Boolean(openToken(t.token_enc))
    };
  });
}

/**
 * Reenviar un enlace: el mismo si está guardado cifrado o uno nuevo en la misma
 * fila (el anterior deja de funcionar). Si había caducado, se alarga.
 */
async function resendToken(req, token, days) {
  if (token.revoked_at) throw httpError(409, "El enlace está anulado: crea uno nuevo.");
  const [workPct] = (await tokensWorkPct([token])).values();
  if (workPct !== null && workPct >= 100) throw httpError(409, "El trabajo ya está finalizado (certificado al 100 %): no hace falta reenviar el enlace.");
  const admin = getAdminClient();
  const update = {};
  let rawToken = openToken(token.token_enc);
  if (!rawToken) {
    rawToken = newRawToken();
    update.token_hash = hashToken(rawToken);
    const sealed = sealToken(rawToken);
    if (sealed && "token_enc" in token) update.token_enc = sealed;
  }
  if (new Date(token.expires_at) < new Date()) update.expires_at = daysFromNow(days);
  let row = token;
  if (Object.keys(update).length) {
    const { data, error } = await admin.from("subcontractor_tokens").update(update).eq("id", token.id).select("*").single();
    if (error) throw new Error(error.message);
    row = data;
  }
  return {
    ...(await linkPayload(req, row, rawToken)),
    work_pct: workPct ?? null,
    regenerated: Boolean(update.token_hash),
    extended: Boolean(update.expires_at)
  };
}

async function handleResendToken(req, res, id) {
  const body = await readJson(req).catch(() => ({}));
  const { data, error } = await getAdminClient().from("subcontractor_tokens").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw httpError(404, "Enlace no encontrado.");
  sendJson(res, 200, await resendToken(req, data, body.days));
}

/** Enlace de una asignación de Avance de Obra: reenvía el último vigente o crea uno. */
async function handleAssignmentLink(req, res, assignmentId) {
  const body = await readJson(req).catch(() => ({}));
  const admin = getAdminClient();
  const { data: a, error } = await admin.from("work_assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!a || a.assignee_type !== "subcontrata") throw httpError(404, "Asignación de subcontrata no encontrada.");
  const { data: existing, error: tokenError } = await admin
    .from("subcontractor_tokens")
    .select("*")
    .eq("assignment_id", assignmentId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (tokenError) throw new Error(tokenError.message);
  if (existing?.length) {
    sendJson(res, 200, await resendToken(req, existing[0], body.days));
    return;
  }
  const obra = await getObra(a.obra_id);
  const found = obra ? findPartida(flattenPlan(obra), a.fase_id, a.partida_id) : null;
  if (!found) throw httpError(404, "La fase o partida de esta asignación ya no existe en la obra.");
  const isFase = !a.partida_id;
  const [workPct] = (await tokensWorkPct([{ id: a.id, obra_id: a.obra_id, fase_id: a.fase_id, partida_id: a.partida_id }])).values();
  if (workPct !== null && workPct >= 100) throw httpError(409, "El trabajo ya está finalizado (certificado al 100 %).");
  const link = await createSubToken({
    req,
    subcontractorId: a.subcontractor_id,
    name: a.assignee_name,
    obraId: String(a.obra_id),
    taskRef: isFase ? `fase:${a.fase_id}` : `tarea:${a.partida_id}`,
    taskLabel: isFase ? found.fase.nombre : `${found.partida.codigo} ${found.partida.titulo}`,
    taskKind: isFase ? "fase" : "partida",
    faseId: a.fase_id,
    partidaId: a.partida_id || WHOLE_PHASE,
    assignmentId: a.id,
    days: body.days
  });
  sendJson(res, 201, { ...link, work_pct: workPct ?? null });
}

async function handleCreateToken(req, res) {
  const body = await readJson(req);
  sendJson(res, 201, await createSubToken({
    req,
    subcontractorId: clip(body.subcontractor_id, 100) || null,
    name: body.subcontractor_name,
    phone: body.phone,
    obraId: clip(body.obra_id, 100) || null,
    obraLabelText: body.obra_label,
    taskRef: clip(body.task_ref, 100) || null,
    taskLabel: body.task_label,
    taskKind: String(body.task_ref || "").startsWith("fase:") ? "fase" : "partida",
    days: body.days
  }));
}

// ---------------------------------------------------------------------------
// Necesidades de obra y pedidos
// ---------------------------------------------------------------------------
/** Ruta del panel de avance para abrir una partida concreta (enlaces de avisos y push). */
export function avanceLink(obraId, faseId, partidaId = WHOLE_PHASE) {
  return `#admin/avance/${encodeURIComponent(obraId || "")}/${encodeURIComponent(faseId || "")}/${encodeURIComponent(partidaId || "")}`;
}

/**
 * Liga una necesidad a su fase y partida. Comprueba que existen en la obra y,
 * si `allowed` es una función, que el emisor tiene esa partida asignada.
 * Devuelve las columnas a añadir a worksite_needs ({} si no se indicó fase).
 */
export function needPartidaFields(obra, faseId, partidaId, allowed = null) {
  const fase = clip(faseId, 120);
  if (!fase || !obra) return {};
  const plan = flattenPlan(obra);
  let found = findPartida(plan, fase, clip(partidaId, 120));
  // Aviso de una fase entera (asignación de fase): se liga a la fase, partida ''.
  if (!found && !clip(partidaId, 120)) {
    const faseRow = plan.fases.find((f) => f.id === fase);
    if (faseRow) found = { fase: faseRow, partida: { id: WHOLE_PHASE } };
  }
  if (!found) throw httpError(400, "La fase o partida indicada no existe en esta obra.");
  if (allowed && !allowed(found.fase.id, found.partida.id)) throw httpError(403, "Esa partida no está asignada a tu empresa.");
  return {
    fase_id: found.fase.id,
    fase_label: clip(found.fase.nombre, 200),
    partida_id: found.partida.id,
    partida_label: found.partida.id ? clip(`${found.partida.codigo} ${found.partida.titulo}`, 200) : null
  };
}

// Avisos que paran o ponen en alerta la partida en el panel del jefe de obra.
const ALERT_BY_CATEGORY = { bloqueo: "bloqueo", material: "material" };

async function markPartidaAlert(need) {
  const alert = ALERT_BY_CATEGORY[need.category];
  if (!alert || !need.fase_id) return;
  const admin = getAdminClient();
  const key = { obra_id: need.obra_id, fase_id: need.fase_id, partida_id: need.partida_id || WHOLE_PHASE };
  try {
    const { data: current } = await admin.from("work_item_progress").select("*").match(key).maybeSingle();
    const row = {
      ...key,
      alert,
      alert_need_id: need.id,
      alert_text: clip(need.description, 300),
      status: alert === "bloqueo" ? "bloqueada" : current?.status || "no_iniciada"
    };
    const { error } = await admin.from("work_item_progress").upsert(row, { onConflict: "obra_id,fase_id,partida_id" });
    if (error) throw new Error(error.message);
    await admin.from("execution_logs").insert({
      ...key,
      kind: "bloqueo",
      status: row.status,
      pct_before: current?.reported_pct ?? null,
      pct_after: current?.reported_pct ?? null,
      notes: `${NEED_LABELS[need.category]}: ${clip(need.description, 500)}`,
      photos: need.photos || [],
      author_type: need.reported_by_type === "subcontrata" ? "subcontrata" : need.reported_by_type === "obrero" ? "obrero" : "admin",
      author_name: need.reported_by_name,
      token_id: need.token_id || null,
      need_id: need.id
    });
  } catch (err) {
    console.error("[avance] No se pudo marcar la partida en alerta:", err?.message || err);
  }
}

/** Al resolver, entregar o descartar la necesidad, la partida sale de la alerta. */
async function clearPartidaAlert(need, userId) {
  if (!need?.fase_id || !["entregado", "resuelto", "descartada"].includes(need.status)) return;
  const admin = getAdminClient();
  try {
    const { data: rows } = await admin.from("work_item_progress").select("*").eq("alert_need_id", need.id);
    for (const r of rows || []) {
      const status = r.status === "bloqueada" ? (r.reported_pct >= 100 ? "completada" : r.reported_pct > 0 ? "en_curso" : "no_iniciada") : r.status;
      await admin
        .from("work_item_progress")
        .update({ alert: null, alert_need_id: null, alert_text: null, status })
        .match({ obra_id: r.obra_id, fase_id: r.fase_id, partida_id: r.partida_id });
      await admin.from("execution_logs").insert({
        obra_id: r.obra_id,
        fase_id: r.fase_id,
        partida_id: r.partida_id,
        kind: "desbloqueo",
        status,
        pct_before: r.reported_pct,
        pct_after: r.reported_pct,
        notes: `Necesidad ${need.status === "descartada" ? "descartada" : "resuelta"}: ${clip(need.description, 300)}`,
        author_type: "admin",
        author_user: userId || null,
        need_id: need.id
      });
    }
  } catch (err) {
    console.error("[avance] No se pudo quitar la alerta de la partida:", err?.message || err);
  }
}

async function insertNeed(row) {
  const { data: need, error } = await getAdminClient().from("worksite_needs").insert(row).select().single();
  if (error) throw new Error(error.message);
  await markPartidaAlert(need);
  const isMaterial = need.category === "material";
  await createNotification({
    category: need.urgency === "urgente" ? "urgente" : isMaterial ? "material" : "incidencia",
    origin: need.reported_by_type === "subcontrata" ? "subcontrata" : need.reported_by_type === "admin" ? "admin" : "obrero",
    obraId: need.obra_id,
    obraLabel: need.obra_label,
    title: `${NEED_LABELS[need.category] || "Necesidad"}${need.partida_label ? ` en ${need.partida_label}` : need.fase_label ? ` en ${need.fase_label}` : ""}${need.obra_label ? ` · ${need.obra_label}` : ""}`,
    body: `${need.reported_by_name ? `${need.reported_by_name}: ` : ""}${need.description}`,
    link: need.fase_id ? avanceLink(need.obra_id, need.fase_id, need.partida_id) : `#admin/necesidades/${need.id}`,
    refTable: "worksite_needs",
    refId: need.id,
    faseId: need.fase_id || null,
    partidaId: need.partida_id || null
  });
  return need;
}

async function handleCreateNeed(req, res) {
  const body = await readJson(req);
  const description = clip(body.description, 2000);
  if (!description) throw httpError(400, "Describe la necesidad.");
  const category = NEED_CATEGORIES.has(body.category) ? body.category : "material";
  const obraId = clip(body.obra_id, 100) || null;
  const obra = obraId ? await getObra(obraId) : null;
  const isAdmin = req.user?.role === "admin";
  const linked = body.fase_id ? needPartidaFields(obra, body.fase_id, body.partida_id) : {};
  const need = await insertNeed({
    ...linked,
    obra_id: obraId,
    obra_label: obraLabel(obra, clip(body.obra_label, 200)),
    tajo: clip(body.tajo, 200) || linked.partida_label || linked.fase_label || null,
    category,
    urgency: body.urgency === "urgente" ? "urgente" : "normal",
    description,
    items: normalizeItems(body.items, category === "material" ? description : ""),
    needed_by: /^\d{4}-\d{2}-\d{2}$/.test(body.needed_by || "") ? body.needed_by : null,
    reported_by_type: isAdmin ? (body.reported_by_type === "encargado" ? "encargado" : "admin") : "obrero",
    reported_by_name: clip(req.user?.full_name, 200) || null,
    reported_by_user: req.user?.id || null,
    site_contact_name: clip(body.site_contact_name, 200) || null,
    site_contact_phone: clip(body.site_contact_phone, 40) || null
  });
  sendJson(res, 201, need);
}

async function handleUpdateNeed(req, res, id) {
  const body = await readJson(req);
  const patch = {};
  if (body.status !== undefined) {
    if (!NEED_STATUSES.has(body.status)) throw httpError(400, "Estado no válido.");
    patch.status = body.status;
  }
  if (body.items !== undefined) patch.items = normalizeItems(body.items);
  for (const key of ["tajo", "description", "site_contact_name", "site_contact_phone"]) {
    if (body[key] !== undefined) patch[key] = clip(body[key], key === "description" ? 2000 : 200);
  }
  if (body.needed_by !== undefined) patch.needed_by = /^\d{4}-\d{2}-\d{2}$/.test(body.needed_by || "") ? body.needed_by : null;
  if (body.urgency !== undefined) patch.urgency = body.urgency === "urgente" ? "urgente" : "normal";
  const { data, error } = await getAdminClient().from("worksite_needs").update(patch).eq("id", id).select().single();
  if (error) throw httpError(404, "Necesidad no encontrada.");
  if (patch.status) await clearPartidaAlert(data, req.user?.id);
  sendJson(res, 200, data);
}

/**
 * Genera el borrador de correo (uno por proveedor elegido) a partir de una necesidad.
 * No envía nada: deja los pedidos en estado "borrador" para revisarlos y editarlos.
 */
/**
 * Crea los borradores de pedido (uno por proveedor; sin proveedor, uno para elegirlo
 * después). No envía nada. Lo usan el botón "Generar borrador" y la petición de
 * material desde el enlace de la subcontrata.
 */
export async function createOrderDrafts(need, supplierIds = [], kind = "pedido") {
  const admin = getAdminClient();
  let suppliers = [];
  if (supplierIds.length) {
    const { data, error } = await admin.from("suppliers").select("*").in("id", supplierIds);
    if (error) throw new Error(error.message);
    suppliers = data || [];
  }
  if (suppliers.length === 0) suppliers = [{}]; // borrador sin proveedor: se elige después

  const [obra, empresa] = await Promise.all([getObra(need.obra_id), getEmpresa()]);
  const rows = suppliers.map((supplier) => {
    const email = buildSupplierOrderEmail({ need, obra: obra || {}, supplier, empresa, kind });
    return {
      need_id: need.id,
      supplier_id: supplier.id || null,
      obra_id: need.obra_id,
      kind,
      status: "borrador",
      to_email: supplier.email || null,
      subject: email.subject,
      body_html: email.html,
      body_text: email.text,
      items: email.items,
      delivery_address: email.deliveryAddress || null,
      needed_by: need.needed_by,
      site_contact_name: email.contactName || null,
      site_contact_phone: email.contactPhone || null
    };
  });
  const { data, error } = await admin.from("material_orders").insert(rows).select();
  if (error) throw new Error(error.message);
  if (need.status === "nueva") await admin.from("worksite_needs").update({ status: "en_revision" }).eq("id", need.id);
  return data;
}

async function handleOrderDraft(req, res, needId) {
  const body = await readJson(req);
  const { data: need } = await getAdminClient().from("worksite_needs").select("*").eq("id", needId).maybeSingle();
  if (!need) throw httpError(404, "Necesidad no encontrada.");
  const kind = body.kind === "solicitud_presupuesto" ? "solicitud_presupuesto" : "pedido";
  const supplierIds = (Array.isArray(body.supplier_ids) ? body.supplier_ids : [body.supplier_id])
    .map((s) => clip(s, 40))
    .filter((s) => new RegExp(`^${UUID}$`).test(s))
    .slice(0, 5);
  sendJson(res, 201, { drafts: await createOrderDrafts(need, supplierIds, kind) });
}

async function handleUpdateOrder(req, res, id) {
  const body = await readJson(req);
  const patch = {};
  if (body.subject !== undefined) patch.subject = clip(body.subject, 250);
  if (body.body_html !== undefined) patch.body_html = String(body.body_html).slice(0, 100000);
  if (body.body_text !== undefined) patch.body_text = String(body.body_text).slice(0, 50000);
  if (body.to_email !== undefined) patch.to_email = clip(body.to_email, 300) || null;
  if (body.cc_email !== undefined) patch.cc_email = clip(body.cc_email, 300) || null;
  if (body.supplier_id !== undefined) patch.supplier_id = new RegExp(`^${UUID}$`).test(body.supplier_id || "") ? body.supplier_id : null;
  if (body.status === "cancelado") patch.status = "cancelado";
  const { data, error } = await getAdminClient().from("material_orders").update(patch).eq("id", id).in("status", ["borrador", "error"]).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw httpError(409, "Solo se pueden editar pedidos en borrador.");
  sendJson(res, 200, data);
}

const EMAIL_LIST = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+(\s*[,;]\s*[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+)*$/;
const splitEmails = (value) => String(value || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);

async function handleSendOrder(req, res, id) {
  const admin = getAdminClient();
  const { data: order } = await admin.from("material_orders").select("*").eq("id", id).maybeSingle();
  if (!order) throw httpError(404, "Pedido no encontrado.");
  if (order.status !== "borrador" && order.status !== "error") throw httpError(409, "Este pedido ya se envió.");
  if (!EMAIL_LIST.test(order.to_email || "")) throw httpError(400, "Falta el correo del proveedor o no es válido.");

  let result;
  try {
    result = await sendEmail({
      to: splitEmails(order.to_email),
      cc: order.cc_email && EMAIL_LIST.test(order.cc_email) ? splitEmails(order.cc_email) : undefined,
      subject: order.subject,
      html: order.body_html,
      text: order.body_text,
      empresa: await getEmpresa(),
      idempotencyKey: `order-${order.id}`
    });
  } catch (err) {
    if (err.status === 502) await admin.from("material_orders").update({ status: "error", error: clip(err.message, 500) }).eq("id", order.id);
    throw err;
  }

  const { data: sent } = await admin
    .from("material_orders")
    .update({ status: "enviado", sent_at: new Date().toISOString(), sent_by: req.user?.id || null, provider_message_id: result.id || null, error: null })
    .eq("id", order.id)
    .select()
    .single();
  if (order.need_id) {
    await admin.from("worksite_needs").update({ status: "pedido_tramitado" }).eq("id", order.need_id);
  }
  sendJson(res, 200, sent);
}

// ---------------------------------------------------------------------------
// Proveedores, avisos y partes
// ---------------------------------------------------------------------------
function supplierFields(body) {
  const row = {};
  if (body.name !== undefined) row.name = clip(body.name, 200);
  if (body.email !== undefined) row.email = clip(body.email, 300) || null;
  if (body.phone !== undefined) row.phone = clip(body.phone, 40) || null;
  if (body.contact_name !== undefined) row.contact_name = clip(body.contact_name, 200) || null;
  if (body.notes !== undefined) row.notes = clip(body.notes, 2000) || null;
  if (body.is_active !== undefined) row.is_active = Boolean(body.is_active);
  if (body.categories !== undefined) {
    row.categories = (Array.isArray(body.categories) ? body.categories : String(body.categories).split(","))
      .map((c) => clip(c, 60).toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
  }
  return row;
}

async function handleListNotifications(res, query) {
  let q = getAdminClient().from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
  if (query.get("unread") === "1") q = q.is("read_at", null);
  if (query.get("obra")) q = q.eq("obra_id", query.get("obra"));
  if (NOTIFICATION_CATEGORIES.has(query.get("category"))) q = q.eq("category", query.get("category"));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  sendJson(res, 200, data || []);
}

async function handleMarkRead(req, res) {
  const body = await readJson(req);
  let q = getAdminClient().from("notifications").update({ read_at: new Date().toISOString(), read_by: req.user?.id || null }).is("read_at", null);
  if (!body.all) {
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter((id) => new RegExp(`^${UUID}$`).test(id)).slice(0, 500);
    if (ids.length === 0) throw httpError(400, "Indica qué avisos marcar como leídos.");
    q = q.in("id", ids);
  }
  const { error } = await q;
  if (error) throw new Error(error.message);
  sendJson(res, 200, { ok: true });
}

async function handleListSiteReports(res, query) {
  let q = getAdminClient().from("site_reports").select("*").order("created_at", { ascending: false }).limit(100);
  if (query.get("obra")) q = q.eq("obra_id", query.get("obra"));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const withPhotos = await Promise.all((data || []).map(async (r) => ({ ...r, photo_urls: await signPhotos(r.photos) })));
  sendJson(res, 200, withPhotos);
}

// ---------------------------------------------------------------------------
// Enrutadores
// ---------------------------------------------------------------------------
async function respondErrors(res, pathname, fn) {
  try {
    await fn();
  } catch (err) {
    if (!err?.status) console.error("[avisos] Error en", pathname, err?.message || err);
    if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
  }
  return true;
}

/** Rutas públicas del enlace mágico. Llamar ANTES de exigir sesión. */
export async function handleSubcontractorPublicRoutes(req, res, pathname, { parseMultipart }) {
  const match = pathname.match(/^\/api\/sub\/([^/]+)(?:\/(terminado|necesidad))?$/);
  if (!match) return false;
  const [, rawToken, action] = match;

  return respondErrors(res, pathname, async () => {
    if (!isSupabaseReady()) throw httpError(503, "Servicio no disponible.");
    if (rateLimited(req, action ? 30 : 120)) throw httpError(429, "Demasiados intentos. Espera unos minutos.");
    const token = await findToken(rawToken);
    if (!token) throw httpError(404, "Este enlace no es válido o ha caducado. Pide uno nuevo al jefe de obra.");

    if (!action && req.method === "GET") return handleSubGet(res, token);
    if (action === "terminado" && req.method === "POST") return handleSubDone(req, res, token, parseMultipart);
    if (action === "necesidad" && req.method === "POST") return handleSubNeed(req, res, token, parseMultipart);
    throw httpError(405, "Método no permitido.");
  });
}

/** Rutas con sesión. Llamar DESPUÉS de enforceApiAuth (req.user ya está puesto). */
export async function handleNotificationRoutes(req, res, pathname, query) {
  const m = (re) => pathname.match(re);
  const routes = [
    [/^\/api\/sub-tokens$/, {
      GET: async () => sendJson(res, 200, await listTokens()),
      POST: () => handleCreateToken(req, res)
    }],
    [new RegExp(`^/api/sub-tokens/(${UUID})/revoke$`), { POST: async (id) => {
      const { error } = await getAdminClient().from("subcontractor_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
      sendJson(res, 200, { ok: true });
    } }],
    [new RegExp(`^/api/sub-tokens/(${UUID})/resend$`), { POST: (id) => handleResendToken(req, res, id) }],
    [new RegExp(`^/api/sub-tokens/assignment/(${UUID})$`), { POST: (id) => handleAssignmentLink(req, res, id) }],
    [/^\/api\/whatsapp\/send$/, { POST: async () => {
      // Envío directo opcional (WhatsApp Business Cloud API). Sin configurar responde 503.
      const body = await readJson(req);
      if (!clip(body.message, 4000)) throw httpError(400, "Falta el mensaje.");
      sendJson(res, 200, await sendWhatsAppCloud({ phone: body.phone, message: body.message }));
    } }],
    [/^\/api\/notifications$/, { GET: () => handleListNotifications(res, query) }],
    [/^\/api\/notifications\/read$/, { POST: () => handleMarkRead(req, res) }],
    [/^\/api\/needs$/, {
      GET: async () => {
        if (req.user && req.user.role !== "admin") throw httpError(403, "No tienes permisos para esta acción.");
        let q = getAdminClient().from("worksite_needs").select("*").order("created_at", { ascending: false }).limit(200);
        if (NEED_STATUSES.has(query.get("status"))) q = q.eq("status", query.get("status"));
        if (query.get("obra")) q = q.eq("obra_id", query.get("obra"));
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        sendJson(res, 200, await Promise.all((data || []).map(async (n) => ({ ...n, photo_urls: await signPhotos(n.photos) }))));
      },
      POST: () => handleCreateNeed(req, res)
    }],
    [new RegExp(`^/api/needs/(${UUID})$`), { PATCH: (id) => handleUpdateNeed(req, res, id) }],
    [new RegExp(`^/api/needs/(${UUID})/order-draft$`), { POST: (id) => handleOrderDraft(req, res, id) }],
    [/^\/api\/material-orders$/, { GET: async () => {
      let q = getAdminClient().from("material_orders").select("*").order("created_at", { ascending: false }).limit(200);
      if (new RegExp(`^${UUID}$`).test(query.get("need") || "")) q = q.eq("need_id", query.get("need"));
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      sendJson(res, 200, data || []);
    } }],
    [new RegExp(`^/api/material-orders/(${UUID})$`), { PATCH: (id) => handleUpdateOrder(req, res, id) }],
    [new RegExp(`^/api/material-orders/(${UUID})/send$`), { POST: (id) => handleSendOrder(req, res, id) }],
    [/^\/api\/suppliers$/, {
      GET: async () => {
        const { data, error } = await getAdminClient().from("suppliers").select("*").order("name");
        if (error) throw new Error(error.message);
        sendJson(res, 200, data || []);
      },
      POST: async () => {
        const row = supplierFields(await readJson(req));
        if (!row.name) throw httpError(400, "Indica el nombre del proveedor.");
        const { data, error } = await getAdminClient().from("suppliers").insert(row).select().single();
        if (error) throw new Error(error.message);
        sendJson(res, 201, data);
      }
    }],
    [new RegExp(`^/api/suppliers/(${UUID})$`), { PATCH: async (id) => {
      const { data, error } = await getAdminClient().from("suppliers").update(supplierFields(await readJson(req))).eq("id", id).select().single();
      if (error) throw httpError(404, "Proveedor no encontrado.");
      sendJson(res, 200, data);
    } }],
    [/^\/api\/site-reports$/, { GET: () => handleListSiteReports(res, query) }],
    [new RegExp(`^/api/site-reports/(${UUID})$`), { PATCH: async (id) => {
      const body = await readJson(req);
      if (!["aprobado", "rechazado"].includes(body.review_result)) throw httpError(400, "Indica aprobado o rechazado.");
      const { data, error } = await getAdminClient()
        .from("site_reports")
        .update({ review_result: body.review_result, reviewed_at: new Date().toISOString(), reviewed_by: req.user?.id || null })
        .eq("id", id)
        .select()
        .single();
      if (error) throw httpError(404, "Parte no encontrado.");
      sendJson(res, 200, data);
    } }]
  ];

  for (const [re, methods] of routes) {
    const match = m(re);
    if (!match) continue;
    return respondErrors(res, pathname, async () => {
      if (!isSupabaseReady()) throw httpError(503, "Esta función necesita Supabase configurado en el servidor.");
      const handler = methods[req.method];
      if (!handler) throw httpError(405, "Método no permitido.");
      await handler(match[1]);
    });
  }
  return false;
}
