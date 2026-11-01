/**
 * ObraMaster - Histórico diario de cada obra
 *
 * Tabla: ver supabase_schema_historial_obra.sql (obra_eventos). El resto de sucesos
 * se leen de las tablas que ya los guardan; la conversión está en src/utils/historialObra.js.
 *
 * Rutas (solo administradores):
 *   GET    /api/historial/:obraId          Sucesos de la obra (todas las fuentes, del más reciente).
 *   POST   /api/historial/:obraId          Apunte manual { tipo, titulo, detalle, fecha, datos }
 *                                          o varios automáticos { eventos: [...] } (origen 'auto').
 *   PATCH  /api/historial/evento/:id       Corrige un apunte manual.
 *   DELETE /api/historial/evento/:id       Quita un apunte manual (borrado lógico).
 */

import { clip, sendJson, httpError, readJson, getObra } from "./notificaciones.js";
import { getAdminClient, isSupabaseReady } from "./authRoutes.js";
import { flattenPlan, findPartida } from "../src/utils/avanceObra.js";
import {
  TIPO_IDS,
  eventoDesdeFila,
  eventoDesdeLog,
  eventoDesdeNecesidad,
  eventosDesdePedido,
  eventoDesdeParteSubcontrata,
  eventoDesdeDiario,
  ordenarEventos,
  unificarEventos
} from "../src/utils/historialObra.js";

const UUID = "[0-9a-fA-F-]{36}";
const TABLE = "obra_eventos";
const MIGRATION = "supabase_schema_historial_obra.sql";
const LIMIT = 2000;
const ID = (value) => clip(value, 120);

const isMissing = (error) =>
  ["42P01", "42703", "PGRST205", "PGRST200"].includes(error?.code) || /does not exist|schema cache|relationship/i.test(String(error?.message || ""));

function requireAdmin(req) {
  if (req.user && req.user.role !== "admin") throw httpError(403, "No tienes permisos para esta acción.");
}

const autorDe = (req) => clip(req.user?.full_name || req.user?.username, 200) || "Administración";

function fecha(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw httpError(400, "La fecha no es válida.");
  return d.toISOString();
}

// Limpia `datos` para no guardar cualquier cosa (materiales, horas, contacto, antes/después).
function cleanDatos(datos) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return {};
  const json = JSON.stringify(datos);
  if (json.length > 8000) throw httpError(413, "Demasiados datos en el apunte.");
  const out = JSON.parse(json);
  if (Array.isArray(out.items)) {
    out.items = out.items.slice(0, 50).map((i) => ({
      concepto: clip(i?.concepto, 200) || "",
      cantidad: i?.cantidad === "" || i?.cantidad === undefined ? null : Number(i.cantidad) || 0,
      unidad: clip(i?.unidad, 40) || "",
      horas: i?.horas === "" || i?.horas === undefined ? undefined : Number(i.horas) || 0
    })).filter((i) => i.concepto);
  }
  return out;
}

function eventRow(body, { origen }) {
  const tipo = String(body.tipo || "");
  if (!TIPO_IDS.has(tipo)) throw httpError(400, "Tipo de suceso desconocido.");
  const titulo = clip(body.titulo, 300);
  if (!titulo) throw httpError(400, "Escribe qué ha pasado.");
  return {
    tipo,
    origen,
    titulo,
    detalle: clip(body.detalle, 4000) || null,
    ocurrido_at: fecha(body.fecha),
    datos: cleanDatos(body.datos),
    fase_id: ID(body.fase_id || body.datos?.faseId) || null,
    partida_id: ID(body.partida_id || body.datos?.partidaId) || null
  };
}

// Consulta que tolera tablas o columnas de migraciones aún sin ejecutar.
async function safe(query, faltan, archivo) {
  const { data, error } = await query;
  if (error) {
    if (isMissing(error)) {
      if (archivo) faltan.add(archivo);
      return [];
    }
    throw new Error(error.message);
  }
  return data || [];
}

const porId = (...listas) => [...new Map(listas.flat().map((r) => [r.id, r])).values()];

async function handleList(res, obraId) {
  const admin = getAdminClient();
  const obra = await getObra(obraId);
  if (!obra) throw httpError(404, "Obra no encontrada.");
  const faltan = new Set();
  const [propios, logs, needs, needsMulti, orders, ordersMulti, reports] = await Promise.all([
    safe(admin.from(TABLE).select("*").eq("obra_id", obraId).is("deleted_at", null).order("ocurrido_at", { ascending: false }).limit(LIMIT), faltan, MIGRATION),
    safe(admin.from("execution_logs").select("*").eq("obra_id", obraId).order("created_at", { ascending: false }).limit(LIMIT), faltan, "supabase_schema_avance_obra.sql"),
    safe(admin.from("worksite_needs").select("*").eq("obra_id", obraId).order("created_at", { ascending: false }).limit(500), faltan, "supabase_schema_notificaciones.sql"),
    safe(admin.from("worksite_needs").select("*").contains("obra_ids", [obraId]).limit(500), new Set()),
    safe(admin.from("material_orders").select("*, suppliers(name)").eq("obra_id", obraId).order("created_at", { ascending: false }).limit(500), faltan, "supabase_schema_notificaciones.sql"),
    safe(admin.from("material_orders").select("*, suppliers(name)").contains("obra_ids", [obraId]).limit(500), new Set()),
    safe(admin.from("site_reports").select("*").eq("obra_id", obraId).order("created_at", { ascending: false }).limit(500), faltan, "supabase_schema_notificaciones.sql")
  ]);

  const plan = flattenPlan(obra);
  const etiqueta = (faseId, partidaId) => {
    const found = findPartida(plan, faseId, partidaId) || findPartida(plan, faseId, "");
    if (found) return found.partida.faseCompleta || !partidaId ? found.fase.nombre : `${found.partida.codigo} ${found.partida.titulo}`;
    return plan.fases.find((f) => f.id === String(faseId))?.nombre || "";
  };

  const eventos = unificarEventos(ordenarEventos([
    ...propios.map(eventoDesdeFila),
    ...logs.map((l) => eventoDesdeLog(l, etiqueta)),
    ...porId(needs, needsMulti).map(eventoDesdeNecesidad),
    ...porId(orders, ordersMulti).flatMap(eventosDesdePedido),
    ...reports.map(eventoDesdeParteSubcontrata),
    ...(Array.isArray(obra.diario) ? obra.diario : []).map(eventoDesdeDiario)
  ].filter((e) => e.fecha)));

  sendJson(res, 200, { eventos, faltan: [...faltan], listo: !faltan.has(MIGRATION) });
}

async function handleCreate(req, res, obraId) {
  const body = await readJson(req);
  const admin = getAdminClient();
  const base = { obra_id: obraId, autor_name: autorDe(req), autor_user: req.user?.id || null };
  // Varios automáticos de golpe (cambios detectados en la app).
  const rows = Array.isArray(body.eventos)
    ? body.eventos.slice(0, 50).map((e) => ({ ...base, ...eventRow(e, { origen: "auto" }) }))
    : [{ ...base, ...eventRow(body, { origen: body.origen === "auto" ? "auto" : "manual" }) }];
  if (!rows.length) return sendJson(res, 200, { eventos: [] });
  const { data, error } = await admin.from(TABLE).insert(rows).select();
  if (error) {
    if (isMissing(error)) throw httpError(503, `Falta ejecutar ${MIGRATION} en Supabase.`);
    throw new Error(error.message);
  }
  sendJson(res, 201, { eventos: (data || []).map(eventoDesdeFila) });
}

async function manualRow(id) {
  const { data, error } = await getAdminClient().from(TABLE).select("id, origen").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw httpError(404, "Apunte no encontrado.");
  if (data.origen !== "manual") throw httpError(400, "Los sucesos automáticos no se pueden cambiar.");
}

async function handleUpdate(req, res, id) {
  await manualRow(id);
  const row = eventRow(await readJson(req), { origen: "manual" });
  delete row.origen;
  const { data, error } = await getAdminClient().from(TABLE).update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  sendJson(res, 200, eventoDesdeFila(data));
}

async function handleDelete(res, id) {
  await manualRow(id);
  const { error } = await getAdminClient().from(TABLE).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  sendJson(res, 200, { ok: true });
}

export async function handleHistorialRoutes(req, res, pathname) {
  if (!pathname.startsWith("/api/historial/")) return false;
  const routes = [
    [new RegExp(`^/api/historial/evento/(${UUID})$`), { PATCH: (id) => handleUpdate(req, res, id), DELETE: (id) => handleDelete(res, id) }],
    [/^\/api\/historial\/([^/]+)$/, {
      GET: (id) => handleList(res, ID(decodeURIComponent(id))),
      POST: (id) => handleCreate(req, res, ID(decodeURIComponent(id)))
    }]
  ];
  for (const [re, methods] of routes) {
    const match = pathname.match(re);
    if (!match) continue;
    try {
      requireAdmin(req);
      if (!isSupabaseReady()) throw httpError(503, "El histórico necesita Supabase configurado en el servidor.");
      const handler = methods[req.method];
      if (!handler) throw httpError(405, "Método no permitido.");
      await handler(match[1]);
    } catch (err) {
      if (!err?.status) console.error("[historial] Error en", pathname, err?.message || err);
      if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
    }
    return true;
  }
  return false;
}
