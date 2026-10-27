/**
 * ObraMaster - Asignación operativa y seguimiento del avance por fase y partida
 *
 * Tablas: ver supabase_schema_avance_obra.sql. Las fases y partidas se leen de la
 * obra (app_records, colección "obras"); el cálculo está en src/utils/avanceObra.js.
 *
 * Rutas públicas (las protege el token del enlace de la subcontrata):
 *   GET  /api/sub/:token/partidas     Fases y partidas asignadas a su empresa en la obra del enlace.
 *   POST /api/sub/:token/avance       Avance o estado de una partida; listo=true la marca
 *                                     "Terminada / lista para certificación". Fotos opcionales.
 *
 * Rutas con sesión:
 *   GET    /api/avance/mis-tajos            Obrero: sus partidas en las obras activas (admin: ?obrero=<id>).
 *   POST   /api/avance/report               Obrero (o encargado): avance de una partida asignada.
 *   GET    /api/avance/obras/:obraId        Admin: resumen (reportado, certificado, planificado),
 *                                           asignaciones, avisos abiertos y últimos cambios.
 *   GET    /api/avance/logs                 Admin: ?obra=&fase=&partida= histórico con fotos firmadas.
 *   POST   /api/avance/assignments          Admin: asigna una fase completa o varias partidas.
 *   PATCH  /api/avance/assignments/:id      Admin: fechas, rendimiento, notas, responsable.
 *   DELETE /api/avance/assignments/:id      Admin: quita la asignación (queda inactiva).
 *   POST   /api/avance/certify              Admin: valida el avance reportado como certificado.
 */

import {
  clip,
  sendJson,
  httpError,
  readJson,
  readForm,
  rateLimited,
  getObra,
  getAppRecord,
  obraLabel,
  uploadPhotos,
  signPhotos,
  findToken,
  touchToken,
  createNotification,
  avanceLink,
  createSubToken
} from "./notificaciones.js";
import { getAdminClient, isSupabaseReady } from "./authRoutes.js";
import {
  computeAvance,
  effectiveAssignments,
  findPartida,
  flattenPlan,
  itemKey,
  normalizeReport,
  STATUS,
  WHOLE_PHASE
} from "../src/utils/avanceObra.js";

const UUID = "[0-9a-fA-F-]{36}";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = (value) => clip(value, 120);

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------
async function loadObraState(obraId) {
  const admin = getAdminClient();
  const [obra, assignments, progress] = await Promise.all([
    getObra(obraId),
    admin.from("work_assignments").select("*").eq("obra_id", obraId).eq("is_active", true).order("created_at"),
    admin.from("work_item_progress").select("*").eq("obra_id", obraId)
  ]);
  if (!obra) throw httpError(404, "Obra no encontrada.");
  if (assignments.error) throw new Error(assignments.error.message);
  if (progress.error) throw new Error(progress.error.message);
  return { obra, assignments: assignments.data || [], progress: progress.data || [] };
}

/**
 * Vista para quien ejecuta (obrero o subcontrata): solo sus partidas y sin
 * importes ni precios de venta.
 */
function executorView(obra, state, isMine) {
  const summary = computeAvance(obra, { progress: state.progress, assignments: state.assignments });
  const fases = summary.fases
    .map((fase) => ({
      id: fase.id,
      nombre: fase.nombre,
      partidas: fase.partidas
        .filter((p) => p.assignees.some(isMine))
        .map((p) => {
          const mine = p.assignees.filter(isMine);
          return {
            faseId: fase.id,
            id: p.id,
            codigo: p.codigo,
            titulo: p.titulo,
            unidad: p.unidad,
            cantidad: p.cantidad,
            faseCompleta: Boolean(p.faseCompleta),
            status: p.status,
            reported: p.reported,
            certified: p.certified,
            planned: p.planned,
            executedQty: p.executedQty,
            readyForCertification: p.readyForCertification,
            alert: p.alert,
            alertText: p.alertText,
            reportedAt: p.reportedAt,
            heredada: mine.every((a) => a.heredada),
            startDate: mine.map((a) => a.start_date).filter(Boolean).sort()[0] || null,
            endDate: mine.map((a) => a.end_date).filter(Boolean).sort().pop() || null,
            notes: mine.map((a) => a.notes).filter(Boolean).join(" · ")
          };
        })
    }))
    .filter((f) => f.partidas.length);
  return {
    obraId: String(obra.id),
    obra: obraLabel(obra),
    direccion: obra.direccion || "",
    fases
  };
}

const subMatcher = (token) => (a) => a.assignee_type === "subcontrata" && (token.subcontractor_id
  ? a.subcontractor_id === token.subcontractor_id
  : String(a.assignee_name || "").toLowerCase() === String(token.subcontractor_name || "").toLowerCase());

const obreroMatcher = (obreroId) => (a) => a.assignee_type === "obrero_interno" && a.obrero_id === obreroId;

// ---------------------------------------------------------------------------
// Reporte de avance (común a obrero, encargado y subcontrata)
// ---------------------------------------------------------------------------
/**
 * Valida y guarda un reporte. `canReport(assignees)` decide si el autor puede
 * reportar esa partida. Devuelve la fila de work_item_progress actualizada.
 */
async function saveReport({ obraId, fields, photos, author, canReport, notify = true, photoPaths: uploaded = null }) {
  const state = await loadObraState(obraId);
  const plan = flattenPlan(state.obra);
  const found = findPartida(plan, ID(fields.fase_id), ID(fields.partida_id));
  if (!found) throw httpError(404, "La partida no existe en esta obra.");
  const { fase, partida } = found;
  const assignees = effectiveAssignments(plan, state.assignments).get(itemKey(fase.id, partida.id)) || [];
  if (!canReport(assignees)) throw httpError(403, "Esta partida no está asignada a ti.");

  const ready = fields.listo === true || fields.listo === "true";
  const report = normalizeReport({
    status: ready ? "completada" : fields.status,
    pct: ready ? 100 : fields.pct,
    executedQty: fields.cantidad_ejecutada,
    cantidad: partida.cantidad
  });
  if (!report.status && report.pct === null) throw httpError(400, "Indica el estado o el porcentaje de avance.");

  const key = { obra_id: String(state.obra.id), fase_id: fase.id, partida_id: partida.id || WHOLE_PHASE };
  const current = state.progress.find((r) => r.fase_id === key.fase_id && r.partida_id === key.partida_id);
  const pct = report.pct ?? current?.reported_pct ?? 0;
  const status = report.status || (pct >= 100 ? "completada" : pct > 0 ? "en_curso" : "no_iniciada");
  const notes = clip(fields.notas, 2000);
  const photoPaths = uploaded || await uploadPhotos(photos, obraId);
  const now = new Date().toISOString();
  const myAssignment = assignees.find((a) => canReport([a]));

  const row = {
    ...key,
    status,
    reported_pct: pct,
    executed_qty: report.executedQty ?? current?.executed_qty ?? null,
    reported_at: now,
    reported_by_type: author.type,
    reported_by_name: author.name,
    // Si se baja del 100 %, deja de estar lista para certificar.
    ready_for_certification: ready || (Boolean(current?.ready_for_certification) && pct >= 100),
    // Si vuelven a trabajar en una partida bloqueada, la alerta sigue hasta resolver la necesidad.
    alert: current?.alert ?? null,
    alert_need_id: current?.alert_need_id ?? null,
    alert_text: current?.alert_text ?? null,
    certified_pct: current?.certified_pct ?? 0
  };
  const admin = getAdminClient();
  const { data: saved, error } = await admin.from("work_item_progress").upsert(row, { onConflict: "obra_id,fase_id,partida_id" }).select().single();
  if (error) throw new Error(error.message);

  await admin.from("execution_logs").insert({
    ...key,
    kind: ready ? "listo_certificacion" : status === "bloqueada" && current?.status !== "bloqueada" ? "bloqueo" : "avance",
    status,
    pct_before: current?.reported_pct ?? 0,
    pct_after: pct,
    executed_qty: row.executed_qty,
    notes: notes || null,
    photos: photoPaths,
    author_type: author.type,
    author_name: author.name,
    author_user: author.userId || null,
    token_id: author.tokenId || null,
    assignment_id: myAssignment?.id && /^[0-9a-f-]{36}$/i.test(myAssignment.id) ? myAssignment.id : null
  });

  // Solo los hitos generan aviso; el resto se ve en directo en el panel.
  const label = partida.id ? `${partida.codigo} ${partida.titulo}` : fase.nombre;
  const milestone = ready
    ? { category: "aviso", title: `${author.name}: lista para certificar · ${label}` }
    : status === "bloqueada" && current?.status !== "bloqueada"
      ? { category: "incidencia", title: `${author.name}: partida bloqueada · ${label}` }
      : status === "completada" && current?.status !== "completada"
        ? { category: "aviso", title: `${author.name}: partida completada · ${label}` }
        : null;
  if (milestone && notify) {
    await createNotification({
      ...milestone,
      origin: author.type === "subcontrata" ? "subcontrata" : author.type === "obrero" ? "obrero" : "admin",
      obraId: key.obra_id,
      obraLabel: obraLabel(state.obra),
      body: [notes, photoPaths.length ? `${photoPaths.length} foto(s).` : ""].filter(Boolean).join(" "),
      link: avanceLink(key.obra_id, key.fase_id, key.partida_id),
      faseId: key.fase_id,
      partidaId: key.partida_id
    });
  }
  return saved;
}

/**
 * Reporte de una fase completa (enlace de una asignación de fase): se aplica a cada
 * partida de la fase que tenga asignada el autor, con un solo aviso al jefe de obra.
 */
async function saveFaseReport({ obraId, fields, photos, author, canReport }) {
  const state = await loadObraState(obraId);
  const plan = flattenPlan(state.obra);
  const fase = plan.fases.find((f) => f.id === ID(fields.fase_id));
  if (!fase) throw httpError(404, "La fase no existe en esta obra.");
  const assigned = effectiveAssignments(plan, state.assignments);
  const mine = fase.partidas.filter((p) => canReport(assigned.get(itemKey(fase.id, p.id)) || []));
  if (!mine.length) throw httpError(403, "Esta fase no está asignada a tu empresa.");
  const photoPaths = await uploadPhotos(photos, obraId);
  const saved = [];
  for (const p of mine) {
    saved.push(await saveReport({ obraId, fields: { ...fields, partida_id: p.id }, photos: [], photoPaths, author, canReport, notify: false }));
  }
  const ready = fields.listo === true || fields.listo === "true";
  const status = saved[0]?.status;
  if (ready || status === "bloqueada" || status === "completada") {
    await createNotification({
      category: status === "bloqueada" ? "incidencia" : "aviso",
      origin: author.type === "subcontrata" ? "subcontrata" : "obrero",
      obraId: String(state.obra.id),
      obraLabel: obraLabel(state.obra),
      title: `${author.name}: ${ready ? "fase lista para certificar" : status === "bloqueada" ? "fase bloqueada" : "fase completada"} · ${fase.nombre}`,
      body: [clip(fields.notas, 500), photoPaths.length ? `${photoPaths.length} foto(s).` : ""].filter(Boolean).join(" "),
      link: avanceLink(String(state.obra.id), fase.id, ""),
      faseId: fase.id,
      partidaId: ""
    });
  }
  return saved;
}

/** Fase con partidas y sin partida concreta: el reporte es de la fase completa. */
function isFaseWideReport(obra, fields) {
  if (ID(fields.partida_id)) return false;
  const fase = flattenPlan(obra).fases.find((f) => f.id === ID(fields.fase_id));
  return Boolean(fase && !fase.partidas[0]?.faseCompleta);
}

// ---------------------------------------------------------------------------
// Rutas públicas del enlace de la subcontrata
// ---------------------------------------------------------------------------
export async function handleAvancePublicRoutes(req, res, pathname, { parseMultipart }) {
  const match = pathname.match(/^\/api\/sub\/([^/]+)\/(partidas|avance)$/);
  if (!match) return false;
  const [, rawToken, action] = match;
  try {
    if (!isSupabaseReady()) throw httpError(503, "Servicio no disponible.");
    if (rateLimited(req, action === "avance" ? 60 : 120)) throw httpError(429, "Demasiados intentos. Espera unos minutos.");
    const token = await findToken(rawToken);
    if (!token) throw httpError(404, "Este enlace no es válido o ha caducado. Pide uno nuevo al jefe de obra.");
    if (!token.obra_id) throw httpError(400, "Este enlace no está ligado a ninguna obra.");
    const isMine = subMatcher(token);

    if (action === "partidas" && req.method === "GET") {
      const state = await loadObraState(token.obra_id);
      return sendJson(res, 200, {
        ...executorView(state.obra, state, isMine),
        estados: STATUS,
        foco: token.fase_id ? { faseId: token.fase_id, partidaId: token.partida_id || "" } : null
      });
    }
    if (action === "avance" && req.method === "POST") {
      const { fields, photos } = await readForm(req, parseMultipart);
      const args = {
        obraId: token.obra_id,
        fields,
        photos,
        author: { type: "subcontrata", name: token.subcontractor_name, tokenId: token.id },
        canReport: (assignees) => assignees.some(isMine)
      };
      const faseWide = isFaseWideReport(await getObra(token.obra_id), fields);
      const saved = faseWide ? await saveFaseReport(args) : [await saveReport(args)];
      await touchToken(token);
      const ready = saved.some((r) => r.ready_for_certification);
      return sendJson(res, 201, {
        ok: true,
        progreso: saved,
        mensaje: ready
          ? "Hecho: queda pendiente de revisión. El encargado ya tiene el aviso para acudir a revisarlo."
          : "Avance guardado."
      });
    }
    throw httpError(405, "Método no permitido.");
  } catch (err) {
    if (!err?.status) console.error("[avance] Error en", pathname, err?.message || err);
    if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Rutas con sesión
// ---------------------------------------------------------------------------
function requireAdmin(req) {
  if (req.user && req.user.role !== "admin") throw httpError(403, "No tienes permisos para esta acción.");
}

/** Obrero de la sesión (profiles.obrero_id). El admin puede consultar otro con ?obrero=. */
function sessionObreroId(req, requested) {
  if (req.user?.role === "obrero") {
    if (!req.user.obrero_id) throw httpError(403, "Tu usuario no está vinculado a una ficha de obrero. Avisa a la oficina.");
    return String(req.user.obrero_id);
  }
  return ID(requested) || null;
}

async function handleMisTajos(res, req, query) {
  const obreroId = sessionObreroId(req, query.get("obrero"));
  if (!obreroId) return sendJson(res, 200, { obras: [] });
  const { data, error } = await getAdminClient()
    .from("work_assignments")
    .select("obra_id")
    .eq("assignee_type", "obrero_interno")
    .eq("obrero_id", obreroId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  let obraIds = [...new Set((data || []).map((a) => a.obra_id))];
  if (query.get("obra")) obraIds = obraIds.filter((id) => id === query.get("obra"));
  const isMine = obreroMatcher(obreroId);
  const obras = [];
  for (const obraId of obraIds.slice(0, 20)) {
    try {
      const state = await loadObraState(obraId);
      if (["finalizada", "cancelada"].includes(state.obra.estado)) continue;
      const view = executorView(state.obra, state, isMine);
      if (view.fases.length) obras.push(view);
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
  }
  sendJson(res, 200, { obras, estados: STATUS });
}

async function handleReport(req, res, parseMultipart) {
  const { fields, photos } = await readForm(req, parseMultipart);
  const obraId = ID(fields.obra_id);
  if (!obraId) throw httpError(400, "Indica la obra.");
  const isAdmin = req.user?.role === "admin";
  const obreroId = isAdmin ? null : sessionObreroId(req);
  const saved = await saveReport({
    obraId,
    fields,
    photos,
    author: {
      type: isAdmin ? "encargado" : "obrero",
      name: clip(req.user?.full_name || req.user?.username, 200) || (isAdmin ? "Encargado" : "Operario"),
      userId: req.user?.id
    },
    canReport: (assignees) => isAdmin || assignees.some(obreroMatcher(obreroId))
  });
  sendJson(res, 201, { ok: true, progreso: saved });
}

async function handleObraSummary(res, obraId) {
  const state = await loadObraState(obraId);
  const admin = getAdminClient();
  const [needs, logs] = await Promise.all([
    admin.from("worksite_needs").select("id, created_at, category, urgency, status, description, fase_id, partida_id, partida_label, reported_by_name, reported_by_type")
      .eq("obra_id", obraId).not("status", "in", "(resuelto,descartada,entregado)").order("created_at", { ascending: false }).limit(100),
    admin.from("execution_logs").select("*").eq("obra_id", obraId).order("created_at", { ascending: false }).limit(40)
  ]);
  sendJson(res, 200, {
    summary: computeAvance(state.obra, { progress: state.progress, assignments: state.assignments }),
    assignments: state.assignments,
    progress: state.progress,
    needs: needs.data || [],
    logs: logs.data || []
  });
}

async function handleLogs(res, query) {
  const obraId = ID(query.get("obra"));
  if (!obraId) throw httpError(400, "Indica la obra.");
  let q = getAdminClient().from("execution_logs").select("*").eq("obra_id", obraId).order("created_at", { ascending: false }).limit(200);
  if (query.get("fase")) q = q.eq("fase_id", ID(query.get("fase")));
  if (query.has("partida")) q = q.eq("partida_id", ID(query.get("partida")));
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  sendJson(res, 200, await Promise.all((data || []).map(async (l) => ({ ...l, photo_urls: await signPhotos(l.photos) }))));
}

function assignmentFields(body) {
  const row = {};
  if (body.start_date !== undefined) row.start_date = DATE.test(body.start_date || "") ? body.start_date : null;
  if (body.end_date !== undefined) row.end_date = DATE.test(body.end_date || "") ? body.end_date : null;
  if (body.planned_rate !== undefined) row.planned_rate = Number(body.planned_rate) > 0 ? Number(body.planned_rate) : null;
  if (body.notes !== undefined) row.notes = clip(body.notes, 1000) || null;
  if (body.is_lead !== undefined) row.is_lead = Boolean(body.is_lead);
  if (row.start_date && row.end_date && row.end_date < row.start_date) throw httpError(400, "La fecha de fin es anterior a la de inicio.");
  return row;
}

async function handleCreateAssignments(req, res) {
  const body = await readJson(req);
  const obraId = ID(body.obra_id);
  const obra = await getObra(obraId);
  if (!obra) throw httpError(404, "Obra no encontrada.");
  const plan = flattenPlan(obra);
  const fase = plan.fases.find((f) => f.id === ID(body.fase_id));
  if (!fase) throw httpError(400, "Elige la fase.");

  // Sin partidas elegidas = fase completa (se hereda en todas sus partidas).
  const partidaIds = (Array.isArray(body.partida_ids) ? body.partida_ids : []).map(ID).filter(Boolean);
  for (const id of partidaIds) {
    if (!fase.partidas.some((p) => p.id === id)) throw httpError(400, "Alguna partida no pertenece a la fase.");
  }
  const targets = partidaIds.length ? partidaIds : [WHOLE_PHASE];

  const type = body.assignee_type === "subcontrata" ? "subcontrata" : "obrero_interno";
  let assignee = { assignee_type: type };
  if (type === "obrero_interno") {
    const obreroId = ID(body.obrero_id);
    const obrero = obreroId ? await getAppRecord("obreros", obreroId) : null;
    if (!obreroId) throw httpError(400, "Elige el obrero.");
    assignee = { ...assignee, obrero_id: obreroId, assignee_name: clip(obrero?.nombre || body.assignee_name, 200) || "Obrero" };
  } else {
    const subId = ID(body.subcontractor_id) || null;
    const sub = subId ? await getAppRecord("subcontractors", subId) : null;
    const name = clip(sub?.nombreComercial || sub?.razonSocial || body.assignee_name, 200);
    if (!name) throw httpError(400, "Elige la subcontrata.");
    assignee = { ...assignee, subcontractor_id: subId, assignee_name: name };
  }

  const admin = getAdminClient();
  // "Sustituir": el nuevo ejecutor reemplaza a los que hubiera en esas partidas.
  if (body.replace) {
    const { error } = await admin.from("work_assignments").update({ is_active: false })
      .eq("obra_id", String(obra.id)).eq("fase_id", fase.id).in("partida_id", targets).eq("is_active", true);
    if (error) throw new Error(error.message);
  }
  const fields = assignmentFields(body);
  const rows = targets.map((partidaId) => ({
    obra_id: String(obra.id),
    fase_id: fase.id,
    partida_id: partidaId,
    ...assignee,
    ...fields,
    created_by: req.user?.id || null
  }));
  // El índice único es parcial y con expresión (PostgREST no lo admite en upsert):
  // se insertan de una en una y se ignoran las que ya existían.
  const created = [];
  for (const row of rows) {
    const { data: one, error } = await admin.from("work_assignments").insert(row).select().maybeSingle();
    if (error && error.code !== "23505") throw new Error(error.message);
    if (one) created.push(one);
  }
  await admin.from("execution_logs").insert(targets.map((partidaId) => ({
    obra_id: String(obra.id),
    fase_id: fase.id,
    partida_id: partidaId,
    kind: "asignacion",
    notes: `Asignada a ${assignee.assignee_name}${type === "subcontrata" ? " (subcontrata)" : ""}${fields.start_date ? ` del ${fields.start_date}` : ""}${fields.end_date ? ` al ${fields.end_date}` : ""}`,
    author_type: "admin",
    author_name: clip(req.user?.full_name, 200) || "Administración",
    author_user: req.user?.id || null
  })));
  // Subcontrata: enlace mágico de esta asignación y mensaje de WhatsApp listo para enviar.
  let link = null;
  if (type === "subcontrata" && body.generate_link !== false) {
    const single = targets.length === 1;
    const partida = single && targets[0] ? fase.partidas.find((p) => p.id === targets[0]) : null;
    const taskLabel = partida
      ? `${partida.codigo} ${partida.titulo}`
      : single ? fase.nombre : `${targets.length} partidas de ${fase.nombre}`;
    link = await createSubToken({
      req,
      subcontractorId: assignee.subcontractor_id,
      name: assignee.assignee_name,
      phone: body.phone,
      obraId: String(obra.id),
      taskRef: partida ? `tarea:${partida.id}` : `fase:${fase.id}`,
      taskLabel,
      taskKind: partida ? "partida" : "fase",
      faseId: fase.id,
      partidaId: partida ? partida.id : WHOLE_PHASE,
      assignmentId: created[0]?.id || null,
      days: body.link_days
    });
  }
  sendJson(res, 201, { assignments: created, link });
}

/**
 * Valida el avance reportado como certificado. Nunca por encima de lo reportado
 * salvo con `force` (evita sobrecertificar por error). Devuelve las filas y el
 * mapa clave → % certificado para que el panel actualice la obra.
 */
async function handleCertify(req, res) {
  const body = await readJson(req);
  const obraId = ID(body.obra_id);
  const state = await loadObraState(obraId);
  const plan = flattenPlan(state.obra);
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 500);
  if (!items.length) throw httpError(400, "No hay partidas que validar.");
  const admin = getAdminClient();
  const now = new Date().toISOString();
  const name = clip(req.user?.full_name, 200) || "Jefe de obra";
  const saved = [];

  for (const item of items) {
    const found = findPartida(plan, ID(item.fase_id), ID(item.partida_id));
    if (!found) throw httpError(400, "Alguna partida no existe en la obra.");
    const key = { obra_id: String(state.obra.id), fase_id: found.fase.id, partida_id: found.partida.id || WHOLE_PHASE };
    const current = state.progress.find((r) => r.fase_id === key.fase_id && r.partida_id === key.partida_id);
    const reported = current?.reported_pct ?? found.partida.progresoObra;
    const pct = Math.round(Math.min(100, Math.max(0, Number(item.certified_pct ?? reported))));
    if (pct > reported && !body.force) {
      throw httpError(409, `"${found.partida.titulo}": no se puede certificar ${pct} % con ${reported} % reportado. Marca "forzar" si lo has comprobado en obra.`);
    }
    const row = {
      ...key,
      status: current?.status || (reported >= 100 ? "completada" : reported > 0 ? "en_curso" : "no_iniciada"),
      reported_pct: Math.max(reported, pct),
      certified_pct: pct,
      certified_at: now,
      certified_by: req.user?.id || null,
      certified_by_name: name,
      ready_for_certification: pct >= 100 ? false : Boolean(current?.ready_for_certification)
    };
    const { data, error } = await admin.from("work_item_progress").upsert(row, { onConflict: "obra_id,fase_id,partida_id" }).select().single();
    if (error) throw new Error(error.message);
    saved.push(data);
    await admin.from("execution_logs").insert({
      ...key,
      kind: "certificacion",
      status: row.status,
      pct_before: current?.certified_pct ?? found.partida.progresoObra,
      pct_after: pct,
      notes: clip(item.notes || body.notes, 1000) || null,
      author_type: "admin",
      author_name: name,
      author_user: req.user?.id || null
    });
  }
  sendJson(res, 200, { progress: saved, certified: saved.map((r) => ({ key: itemKey(r.fase_id, r.partida_id), pct: r.certified_pct })) });
}

export async function handleAvanceRoutes(req, res, pathname, query, { parseMultipart }) {
  if (!pathname.startsWith("/api/avance/")) return false;
  const routes = [
    [/^\/api\/avance\/mis-tajos$/, { GET: () => handleMisTajos(res, req, query) }],
    [/^\/api\/avance\/report$/, { POST: () => handleReport(req, res, parseMultipart) }],
    [/^\/api\/avance\/obras\/([^/]+)$/, { GET: (id) => { requireAdmin(req); return handleObraSummary(res, decodeURIComponent(id)); } }],
    [/^\/api\/avance\/logs$/, { GET: () => { requireAdmin(req); return handleLogs(res, query); } }],
    [/^\/api\/avance\/assignments$/, { POST: () => { requireAdmin(req); return handleCreateAssignments(req, res); } }],
    [new RegExp(`^/api/avance/assignments/(${UUID})$`), {
      PATCH: async (id) => {
        requireAdmin(req);
        const { data, error } = await getAdminClient().from("work_assignments").update(assignmentFields(await readJson(req))).eq("id", id).select().single();
        if (error) throw httpError(404, "Asignación no encontrada.");
        sendJson(res, 200, data);
      },
      DELETE: async (id) => {
        requireAdmin(req);
        const { error } = await getAdminClient().from("work_assignments").update({ is_active: false }).eq("id", id);
        if (error) throw new Error(error.message);
        sendJson(res, 200, { ok: true });
      }
    }],
    [/^\/api\/avance\/certify$/, { POST: () => { requireAdmin(req); return handleCertify(req, res); } }]
  ];

  for (const [re, methods] of routes) {
    const match = pathname.match(re);
    if (!match) continue;
    try {
      if (!isSupabaseReady()) throw httpError(503, "Esta función necesita Supabase configurado en el servidor.");
      const handler = methods[req.method];
      if (!handler) throw httpError(405, "Método no permitido.");
      await handler(match[1]);
    } catch (err) {
      if (!err?.status) console.error("[avance] Error en", pathname, err?.message || err);
      if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
    }
    return true;
  }
  sendJson(res, 404, { error: "Ruta no encontrada." });
  return true;
}
