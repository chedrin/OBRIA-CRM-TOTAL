/**
 * ObraMaster - Justificantes (PDF o foto) de los gastos de una obra
 *
 * Los gastos se guardan en la app (app_records, colección "facturas_proveedores", con obraId);
 * aquí solo se sube y se abre el archivo de la factura o ticket. Usa el bucket privado
 * "subcontrata-docs" (supabase_migration_documentos_subcontrata.sql), carpeta gastos/<obra>/.
 *
 * Rutas (solo administradores):
 *   POST   /api/obras/gastos/adjunto            Sube el archivo (multipart: obra_id, archivo).
 *                                               Devuelve { path, name, mime }.
 *   GET    /api/obras/gastos/adjunto?path=...   Enlace firmado (10 min) para abrirlo.
 *   DELETE /api/obras/gastos/adjunto?path=...   Borra el archivo (al quitar el gasto).
 */

import crypto from "node:crypto";
import { clip, sendJson, httpError, readMultipart } from "./notificaciones.js";
import { getAdminClient, isSupabaseReady } from "./authRoutes.js";
import { DOC_BUCKET, MAX_DOC_BYTES, detectDocType } from "./avanceRoutes.js";

const MIGRATION = "supabase_migration_documentos_subcontrata.sql";
const SAFE_PATH = /^gastos\/[A-Za-z0-9_-]{1,60}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

/** Ruta del archivo dentro del bucket (exportada para los tests). */
export function gastoFilePath(obraId, ext) {
  const folder = String(obraId || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60) || "sin_obra";
  return `gastos/${folder}/${crypto.randomUUID()}.${ext}`;
}

export const isGastoFilePath = (path) => SAFE_PATH.test(String(path || ""));

const bucketMissing = (error) => /bucket not found|not found/i.test(String(error?.message || ""));

async function handleUpload(req, res, parseMultipart) {
  const { fields, files } = await readMultipart(req, parseMultipart);
  const obraId = clip(fields.obra_id, 120);
  if (!obraId) throw httpError(400, "Falta la obra.");
  const file = (files.archivo || [])[0];
  if (!file) throw httpError(400, "Adjunta el PDF o la foto de la factura.");
  if (file.size > MAX_DOC_BYTES) throw httpError(413, "El archivo pasa de 15 MB.");
  const type = detectDocType(file.buffer);
  if (!type) throw httpError(400, "Solo se admiten PDF o fotos (JPG, PNG, WEBP).");
  const path = gastoFilePath(obraId, type.ext);
  const { error } = await getAdminClient().storage.from(DOC_BUCKET).upload(path, file.buffer, { contentType: type.mime, upsert: false });
  if (error && bucketMissing(error)) throw httpError(503, `Ejecuta ${MIGRATION} en Supabase > SQL Editor para poder guardar archivos.`);
  if (error) throw new Error(`No se pudo guardar el archivo: ${error.message}`);
  sendJson(res, 201, { path, name: clip(file.originalname, 200) || `factura.${type.ext}`, mime: type.mime });
}

async function handleOpen(res, path) {
  if (!isGastoFilePath(path)) throw httpError(400, "Archivo no válido.");
  const { data, error } = await getAdminClient().storage.from(DOC_BUCKET).createSignedUrl(path, 600);
  if (error) throw httpError(404, "No se encuentra el archivo.");
  sendJson(res, 200, { url: data.signedUrl });
}

async function handleDelete(res, path) {
  if (!isGastoFilePath(path)) throw httpError(400, "Archivo no válido.");
  const { error } = await getAdminClient().storage.from(DOC_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
  sendJson(res, 200, { ok: true });
}

export async function handleGastosObraRoutes(req, res, pathname, query, { parseMultipart }) {
  if (pathname !== "/api/obras/gastos/adjunto") return false;
  try {
    if (req.user && req.user.role !== "admin") throw httpError(403, "No tienes permisos para esta acción.");
    if (!isSupabaseReady()) throw httpError(503, "Esta función necesita Supabase configurado en el servidor.");
    if (req.method === "POST") await handleUpload(req, res, parseMultipart);
    else if (req.method === "GET") await handleOpen(res, query.get("path"));
    else if (req.method === "DELETE") await handleDelete(res, query.get("path"));
    else throw httpError(405, "Método no permitido.");
  } catch (err) {
    if (!err?.status) console.error("[gastos] Error en", pathname, err?.message || err);
    if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
  }
  return true;
}
