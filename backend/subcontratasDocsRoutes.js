/**
 * ObraMaster - Documentación de las subcontratas (CAE / PRL) y control por obra
 *
 * Tablas: ver supabase_migration_documentacion_subcontratas.sql. Cálculo de estados en
 * src/utils/documentacionSubcontratas.js (lo hace la app con lo que devuelven estas rutas).
 *
 * Rutas (solo administradores):
 *   GET    /api/subcontratas/docs              Documentos activos (?sub=<id> para una ficha).
 *   POST   /api/subcontratas/docs              Alta (multipart): subcontractor_id, doc_type, obra_id,
 *                                              titulo, trabajador, fecha_emision, fecha_caducidad,
 *                                              notes y archivo (PDF o foto, opcional).
 *   PATCH  /api/subcontratas/docs/:id          Corrige datos; con archivo nuevo lo sustituye.
 *   DELETE /api/subcontratas/docs/:id          Quita el documento (queda inactivo).
 *   GET    /api/subcontratas/docs/:id/file     Enlace firmado (10 min) para abrir el archivo.
 *   GET    /api/subcontratas/cae               Requisitos de cada obra y subcontratas asignadas.
 *   PUT    /api/subcontratas/cae/:obraId       Guarda los documentos exigidos y las subcontratas
 *                                              añadidas o quitadas a mano en esa obra.
 */

import crypto from "node:crypto";
import { clip, sendJson, httpError, readJson, readMultipart, getAppRecord } from "./notificaciones.js";
import { getAdminClient, isSupabaseReady } from "./authRoutes.js";
import { DOC_BUCKET, MAX_DOC_BYTES, detectDocType } from "./avanceRoutes.js";
import { DOC_TYPE_IDS } from "../src/utils/documentacionSubcontratas.js";

const UUID = "[0-9a-fA-F-]{36}";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = (value) => clip(value, 120);
const TABLE = "subcontractor_documents";
const MIGRATION = "supabase_migration_documentacion_subcontratas.sql";

const isMissingTable = (error) =>
  ["42P01", "PGRST205"].includes(error?.code) || /does not exist|schema cache/i.test(String(error?.message || ""));

function requireAdmin(req) {
  if (req.user && req.user.role !== "admin") throw httpError(403, "No tienes permisos para esta acción.");
}

function docFields(body) {
  const row = {};
  if (body.doc_type !== undefined) {
    if (!DOC_TYPE_IDS.has(body.doc_type)) throw httpError(400, "Tipo de documento desconocido.");
    row.doc_type = body.doc_type;
  }
  if (body.obra_id !== undefined) row.obra_id = ID(body.obra_id) || "";
  if (body.titulo !== undefined) row.titulo = clip(body.titulo, 200) || null;
  if (body.trabajador !== undefined) row.trabajador = clip(body.trabajador, 200) || null;
  if (body.notes !== undefined) row.notes = clip(body.notes, 1000) || null;
  for (const key of ["fecha_emision", "fecha_caducidad"]) {
    if (body[key] !== undefined) row[key] = DATE.test(body[key] || "") ? body[key] : null;
  }
  return row;
}

async function uploadFile(admin, subId, file) {
  if (!file) return {};
  if (file.size > MAX_DOC_BYTES) throw httpError(413, "El archivo pasa de 15 MB.");
  const type = detectDocType(file.buffer);
  if (!type) throw httpError(400, "Solo se admiten PDF o fotos (JPG, PNG, WEBP).");
  const folder = String(subId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60);
  const objectPath = `fichas/${folder}/${crypto.randomUUID()}.${type.ext}`;
  const { error } = await admin.storage.from(DOC_BUCKET).upload(objectPath, file.buffer, { contentType: type.mime, upsert: false });
  if (error) throw new Error(`No se pudo guardar el archivo: ${error.message}`);
  return { file_path: objectPath, file_name: clip(file.originalname, 200), file_mime: type.mime };
}

async function handleList(res, query) {
  let q = getAdminClient().from(TABLE).select("*").eq("is_active", true).order("doc_type").order("fecha_caducidad", { ascending: false, nullsFirst: true });
  const sub = ID(query.get("sub"));
  if (sub) q = q.eq("subcontractor_id", sub);
  const { data, error } = await q;
  if (error && isMissingTable(error)) return sendJson(res, 200, { ready: false, migration: MIGRATION, docs: [] });
  if (error) throw new Error(error.message);
  sendJson(res, 200, { ready: true, docs: data || [] });
}

async function handleCreate(req, res, parseMultipart) {
  const { fields, files } = await readMultipart(req, parseMultipart);
  const subId = ID(fields.subcontractor_id);
  if (!subId || !(await getAppRecord("subcontractors", subId))) throw httpError(404, "Subcontrata no encontrada.");
  const row = docFields({ ...fields, doc_type: fields.doc_type || "" });
  const admin = getAdminClient();
  Object.assign(row, await uploadFile(admin, subId, (files.archivo || [])[0]));
  const { data, error } = await admin.from(TABLE).insert({ ...row, subcontractor_id: subId, created_by: req.user?.id || null }).select().single();
  if (error && isMissingTable(error)) throw httpError(503, `Ejecuta ${MIGRATION} en Supabase > SQL Editor.`);
  if (error) throw new Error(error.message);
  sendJson(res, 201, data);
}

async function handleUpdate(req, res, id, parseMultipart) {
  const admin = getAdminClient();
  const { data: current } = await admin.from(TABLE).select("subcontractor_id").eq("id", id).maybeSingle();
  if (!current) throw httpError(404, "Documento no encontrado.");
  const { fields, files } = await readMultipart(req, parseMultipart);
  const row = { ...docFields(fields), ...(await uploadFile(admin, current.subcontractor_id, (files.archivo || [])[0])), updated_at: new Date().toISOString() };
  const { data, error } = await admin.from(TABLE).update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  sendJson(res, 200, data);
}

async function handleFile(res, id) {
  const admin = getAdminClient();
  const { data } = await admin.from(TABLE).select("file_path").eq("id", id).maybeSingle();
  if (!data?.file_path) throw httpError(404, "Este documento no tiene archivo.");
  const { data: signed, error } = await admin.storage.from(DOC_BUCKET).createSignedUrl(data.file_path, 600);
  if (error) throw new Error(error.message);
  sendJson(res, 200, { url: signed.signedUrl });
}

async function handleCae(res) {
  const admin = getAdminClient();
  const [reqs, assigns] = await Promise.all([
    admin.from("subcontract_doc_requirements").select("*"),
    admin.from("work_assignments").select("obra_id, subcontractor_id").eq("assignee_type", "subcontrata").eq("is_active", true)
  ]);
  if (reqs.error && isMissingTable(reqs.error)) return sendJson(res, 200, { ready: false, migration: MIGRATION, requirements: [], assignments: [] });
  if (reqs.error) throw new Error(reqs.error.message);
  // Sin la tabla de avance de obra (supabase_schema_avance_obra.sql) no hay asignaciones.
  const assignments = assigns.error ? [] : (assigns.data || []).filter((a) => a.subcontractor_id);
  sendJson(res, 200, { ready: true, requirements: reqs.data || [], assignments });
}

const idList = (value) => (Array.isArray(value) ? [...new Set(value.map(ID).filter(Boolean))].slice(0, 200) : undefined);

async function handleSaveCae(req, res, obraId) {
  const body = await readJson(req);
  const row = { obra_id: ID(obraId), updated_at: new Date().toISOString() };
  if (!row.obra_id) throw httpError(400, "Falta la obra.");
  if (body.doc_types !== undefined) {
    if (!Array.isArray(body.doc_types)) throw httpError(400, "Lista de documentos incorrecta.");
    row.doc_types = [...new Set(body.doc_types.filter((t) => DOC_TYPE_IDS.has(t)))];
  }
  const subs = idList(body.subcontractor_ids);
  const excluded = idList(body.excluded_ids);
  if (subs) row.subcontractor_ids = subs;
  if (excluded) row.excluded_ids = excluded;
  const admin = getAdminClient();
  const { data: current } = await admin.from("subcontract_doc_requirements").select("obra_id").eq("obra_id", row.obra_id).maybeSingle();
  // Al crear la fila sin lista de documentos se guardan los de por defecto que envía la app.
  const { data, error } = current
    ? await admin.from("subcontract_doc_requirements").update(row).eq("obra_id", row.obra_id).select().single()
    : await admin.from("subcontract_doc_requirements").insert(row).select().single();
  if (error && isMissingTable(error)) throw httpError(503, `Ejecuta ${MIGRATION} en Supabase > SQL Editor.`);
  if (error) throw new Error(error.message);
  sendJson(res, 200, data);
}

export async function handleSubcontratasDocsRoutes(req, res, pathname, query, { parseMultipart }) {
  if (!pathname.startsWith("/api/subcontratas/")) return false;
  const routes = [
    [/^\/api\/subcontratas\/docs$/, { GET: () => handleList(res, query), POST: () => handleCreate(req, res, parseMultipart) }],
    [new RegExp(`^/api/subcontratas/docs/(${UUID})$`), {
      PATCH: (id) => handleUpdate(req, res, id, parseMultipart),
      DELETE: async (id) => {
        const { error } = await getAdminClient().from(TABLE).update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id);
        if (error) throw new Error(error.message);
        sendJson(res, 200, { ok: true });
      }
    }],
    [new RegExp(`^/api/subcontratas/docs/(${UUID})/file$`), { GET: (id) => handleFile(res, id) }],
    [/^\/api\/subcontratas\/cae$/, { GET: () => handleCae(res) }],
    [/^\/api\/subcontratas\/cae\/([^/]+)$/, { PUT: (id) => handleSaveCae(req, res, decodeURIComponent(id)) }]
  ];

  for (const [re, methods] of routes) {
    const match = pathname.match(re);
    if (!match) continue;
    try {
      requireAdmin(req);
      if (!isSupabaseReady()) throw httpError(503, "Esta función necesita Supabase configurado en el servidor.");
      const handler = methods[req.method];
      if (!handler) throw httpError(405, "Método no permitido.");
      await handler(match[1]);
    } catch (err) {
      if (!err?.status) console.error("[subcontratas] Error en", pathname, err?.message || err);
      if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
    }
    return true;
  }
  return false;
}
