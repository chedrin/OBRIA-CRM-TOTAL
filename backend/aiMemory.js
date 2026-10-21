/**
 * ObraMaster - Memoria de la IA (instrucciones permanentes y correcciones)
 *
 * Para que la IA no pierda contexto, cada llamada (mejorar texto, generar presupuesto)
 * recibe automáticamente dos bloques:
 *   1. INSTRUCCIONES PERMANENTES: las órdenes que escribes en Ajustes > Memoria de la IA.
 *   2. CORRECCIONES RECIENTES: lo que la IA propuso frente a lo que tú dejaste al final
 *      (textos aceptados o descartados, ediciones manuales y órdenes dadas por voz).
 *
 * Almacenamiento:
 *   - Con Supabase configurado: tablas `ai_instructions` y `ai_corrections`
 *     (ver supabase_schema_ai_memory.sql), siempre con la clave de servicio, solo en el servidor.
 *   - Sin Supabase (desarrollo local): archivo backend/ai_memory.json.
 *
 * Rutas (todas exigen sesión; la gestión de instrucciones, rol administrador):
 *   GET    /api/ai/memory
 *   POST   /api/ai/memory/instructions
 *   PATCH  /api/ai/memory/instructions/:id
 *   DELETE /api/ai/memory/instructions/:id
 *   POST   /api/ai/memory/corrections
 *   DELETE /api/ai/memory/corrections/:id
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { getAdminClient, isSupabaseReady } from "./authRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_FILE = path.join(__dirname, "ai_memory.json");

const MAX_INSTRUCTIONS_CHARS = 36000;
const MAX_INSTRUCTION_CHARS = 6000;
const MAX_CORRECTIONS = 8;
const MAX_CORRECTION_CHARS = 700;
const VALID_SCOPES = new Set(["all", "texto", "presupuesto"]);
const VALID_KINDS = new Set(["texto", "presupuesto"]);

const clip = (value, max) => String(value ?? "").trim().slice(0, max);

// ---------------------------------------------------------------------------
// Almacenamiento
// ---------------------------------------------------------------------------
function readFileStore() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf-8"));
      return { instructions: parsed.instructions || [], corrections: parsed.corrections || [] };
    }
  } catch (err) {
    console.warn("[ai-memory] No se pudo leer ai_memory.json:", err.message);
  }
  return { instructions: [], corrections: [] };
}

function writeFileStore(store) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("[ai-memory] No se pudo escribir ai_memory.json:", err.message);
  }
}

async function listInstructions() {
  if (isSupabaseReady()) {
    const { data, error } = await getAdminClient()
      .from("ai_instructions")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }
  return readFileStore().instructions;
}

async function listCorrections(limit = 50) {
  if (isSupabaseReady()) {
    const { data, error } = await getAdminClient()
      .from("ai_corrections")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }
  return readFileStore().corrections.slice(0, limit);
}

async function insertInstruction(row) {
  if (isSupabaseReady()) {
    const { data, error } = await getAdminClient().from("ai_instructions").insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const store = readFileStore();
  const full = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
  store.instructions.push(full);
  writeFileStore(store);
  return full;
}

async function updateInstruction(id, patch) {
  if (isSupabaseReady()) {
    const { data, error } = await getAdminClient().from("ai_instructions").update(patch).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const store = readFileStore();
  const index = store.instructions.findIndex((i) => i.id === id);
  if (index === -1) return null;
  store.instructions[index] = { ...store.instructions[index], ...patch };
  writeFileStore(store);
  return store.instructions[index];
}

async function removeRow(table, id) {
  if (isSupabaseReady()) {
    const { error } = await getAdminClient().from(table).delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const store = readFileStore();
  const key = table === "ai_instructions" ? "instructions" : "corrections";
  store[key] = store[key].filter((row) => row.id !== id);
  writeFileStore(store);
}

async function insertCorrection(row) {
  if (isSupabaseReady()) {
    const { data, error } = await getAdminClient().from("ai_corrections").insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const store = readFileStore();
  const full = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
  store.corrections.unshift(full);
  store.corrections = store.corrections.slice(0, 500);
  writeFileStore(store);
  return full;
}

/**
 * Guarda (o actualiza) lo aprendido de un presupuesto de referencia como instrucción
 * permanente, visible y editable en Ajustes > Memoria de la IA.
 * Busca primero por id y después por título, para no duplicar si se analiza dos veces.
 */
export async function saveReferenceLearning({ memoryId = "", title, content }) {
  const row = { title: clip(title, 120), content: clip(content, MAX_INSTRUCTION_CHARS), scope: "all" };
  const existing = (await listInstructions()).find(
    (i) => (memoryId && i.id === memoryId) || i.title === row.title
  );
  if (existing) return updateInstruction(existing.id, { content: row.content });
  return insertInstruction({ ...row, is_active: true });
}

// ---------------------------------------------------------------------------
// Contexto que se añade a cada llamada de IA
// ---------------------------------------------------------------------------
/**
 * Devuelve el texto a añadir a la instrucción del sistema.
 * @param {"texto"|"presupuesto"} kind
 */
export async function buildMemoryContext(kind) {
  try {
    const instructions = (await listInstructions()).filter(
      (i) => i.is_active !== false && (i.scope === "all" || i.scope === kind)
    );

    let used = 0;
    const instructionLines = [];
    for (const item of instructions) {
      const line = `- ${item.title ? `${item.title}: ` : ""}${clip(item.content, MAX_INSTRUCTION_CHARS)}`;
      if (used + line.length > MAX_INSTRUCTIONS_CHARS) break;
      used += line.length;
      instructionLines.push(line);
    }

    const corrections = (await listCorrections(60)).filter((c) => c.kind === kind);
    const changed = corrections
      .filter((c) => c.accepted === false || (c.final_text && c.final_text !== c.ai_output) || c.note)
      .slice(0, MAX_CORRECTIONS);
    const approved = corrections
      .filter((c) => c.accepted === true && c.final_text && c.final_text === c.ai_output)
      .slice(0, 3);

    const parts = [];

    if (instructionLines.length) {
      parts.push(
        `INSTRUCCIONES PERMANENTES DEL DIRECTOR (obligatorias, tienen prioridad sobre cualquier estilo por defecto):\n${instructionLines.join("\n")}`
      );
    }

    if (changed.length) {
      const lines = changed.map((c, idx) => {
        const bits = [`#${idx + 1}`];
        if (c.context) bits.push(`(${clip(c.context, 80)})`);
        if (c.original) bits.push(`\n  Original del usuario: ${clip(c.original, MAX_CORRECTION_CHARS)}`);
        if (c.ai_output) bits.push(`\n  Propuesta de la IA: ${clip(c.ai_output, MAX_CORRECTION_CHARS)}`);
        if (c.final_text && c.final_text !== c.ai_output) {
          bits.push(`\n  Versión FINAL que dejó el usuario: ${clip(c.final_text, MAX_CORRECTION_CHARS)}`);
        } else if (c.accepted === false) {
          bits.push("\n  El usuario DESCARTÓ esta propuesta.");
        }
        if (c.note) bits.push(`\n  Orden / comentario del usuario: ${clip(c.note, 400)}`);
        return bits.join(" ");
      });
      parts.push(
        `CORRECCIONES RECIENTES (aprende de ellas: repite lo que el usuario dejó y evita lo que descartó o cambió):\n${lines.join("\n")}`
      );
    }

    if (approved.length) {
      const lines = approved.map((c, idx) => `#${idx + 1} ${clip(c.ai_output, MAX_CORRECTION_CHARS)}`);
      parts.push(`EJEMPLOS RECIENTES APROBADOS SIN CAMBIOS (buen estilo):\n${lines.join("\n")}`);
    }

    return parts.length ? `\n${parts.join("\n\n")}\n` : "";
  } catch (err) {
    console.warn("[ai-memory] No se pudo construir el contexto de memoria:", err.message);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Rutas HTTP
// ---------------------------------------------------------------------------
function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 256 * 1024) {
        reject(Object.assign(new Error("Petición demasiado grande."), { status: 413 }));
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
        reject(Object.assign(new Error("JSON no válido."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/** Devuelve true si la petición era de este módulo (y ya está respondida). */
export async function handleMemoryRoutes(req, res, pathname) {
  const match = pathname.match(/^\/api\/ai\/memory(?:\/(instructions|corrections)(?:\/([\w-]{8,64}))?)?$/);
  if (!match) return false;

  const [, resource, id] = match;
  // Si la autenticación está activa, req.user lo pone enforceApiAuth. En desarrollo sin Supabase no existe.
  const isAdmin = !req.user || req.user.role === "admin";

  try {
    // Lectura completa (solo administración)
    if (!resource && req.method === "GET") {
      if (!isAdmin) return sendJson(res, 403, { error: "Solo administradores." }), true;
      const [instructions, corrections] = await Promise.all([listInstructions(), listCorrections(50)]);
      sendJson(res, 200, { instructions, corrections });
      return true;
    }

    // Registrar una corrección: puede hacerlo cualquier usuario con sesión
    if (resource === "corrections" && !id && req.method === "POST") {
      const body = await readJsonBody(req);
      const kind = VALID_KINDS.has(body.kind) ? body.kind : "texto";
      const row = {
        kind,
        context: clip(body.context, 200),
        original: clip(body.original, 3000),
        ai_output: clip(body.aiOutput, 3000),
        final_text: clip(body.finalText, 3000),
        accepted: typeof body.accepted === "boolean" ? body.accepted : null,
        note: clip(body.note, 600),
        created_by: req.user?.id || null
      };
      if (!row.original && !row.ai_output && !row.final_text && !row.note) {
        return sendJson(res, 400, { error: "Corrección vacía." }), true;
      }
      const saved = await insertCorrection(row);
      sendJson(res, 201, { success: true, correction: saved });
      return true;
    }

    // Todo lo demás es gestión: solo administradores
    if (!isAdmin) return sendJson(res, 403, { error: "Solo administradores." }), true;

    if (resource === "instructions" && !id && req.method === "POST") {
      const body = await readJsonBody(req);
      const content = clip(body.content, MAX_INSTRUCTION_CHARS);
      if (!content) return sendJson(res, 400, { error: "Escribe la instrucción." }), true;
      const saved = await insertInstruction({
        title: clip(body.title, 120),
        content,
        scope: VALID_SCOPES.has(body.scope) ? body.scope : "all",
        is_active: body.isActive !== false
      });
      sendJson(res, 201, { success: true, instruction: saved });
      return true;
    }

    if (resource === "instructions" && id && req.method === "PATCH") {
      const body = await readJsonBody(req);
      const patch = {};
      if (body.title !== undefined) patch.title = clip(body.title, 120);
      if (body.content !== undefined) {
        patch.content = clip(body.content, MAX_INSTRUCTION_CHARS);
        if (!patch.content) return sendJson(res, 400, { error: "La instrucción no puede quedar vacía." }), true;
      }
      if (VALID_SCOPES.has(body.scope)) patch.scope = body.scope;
      if (typeof body.isActive === "boolean") patch.is_active = body.isActive;
      const saved = await updateInstruction(id, patch);
      if (!saved) return sendJson(res, 404, { error: "Instrucción no encontrada." }), true;
      sendJson(res, 200, { success: true, instruction: saved });
      return true;
    }

    if (resource === "instructions" && id && req.method === "DELETE") {
      await removeRow("ai_instructions", id);
      sendJson(res, 200, { success: true });
      return true;
    }

    if (resource === "corrections" && id && req.method === "DELETE") {
      await removeRow("ai_corrections", id);
      sendJson(res, 200, { success: true });
      return true;
    }

    sendJson(res, 405, { error: "Método no permitido." });
    return true;
  } catch (err) {
    console.error("[ai-memory] Error en", pathname, err?.message || err);
    if (!res.headersSent) {
      sendJson(res, err?.status || 500, {
        error: err?.status
          ? err.message
          : "No se pudo acceder a la memoria de la IA. ¿Ejecutaste supabase_schema_ai_memory.sql?"
      });
    }
    return true;
  }
}
