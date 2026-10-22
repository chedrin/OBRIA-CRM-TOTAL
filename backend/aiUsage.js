/**
 * ObraMaster - Contador aproximado de tokens por proveedor de IA
 *
 * Suma los tokens que cada proveedor declara en su respuesta (entrada, parte servida
 * desde caché y salida) y los muestra en Ajustes > Motor IA junto a cada clave.
 *
 * Almacenamiento:
 *   - Con Supabase configurado: tabla `ai_usage` (ver supabase_schema_ai_usage.sql),
 *     una fila por proveedor. Sobrevive a los despliegues de Render.
 *   - Sin Supabase o sin la tabla: archivo backend/ai_usage.json (se pierde al desplegar).
 *
 * Rutas (exigen sesión; poner a cero, rol administrador):
 *   GET    /api/ai/usage
 *   DELETE /api/ai/usage/:provider
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminClient, isSupabaseReady } from "./authRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE_FILE = path.join(__dirname, "ai_usage.json");
const PROVIDERS = new Set(["google", "openai", "anthropic", "openrouter"]);
const SAVE_DELAY_MS = 3000;

let totals = null; // { provider: { calls, input_tokens, cached_tokens, output_tokens, since, updated_at } }
let loading = null;
let tableMissing = false;
const dirty = new Set();
let saveTimer = null;

const emptyRow = () => ({ calls: 0, input_tokens: 0, cached_tokens: 0, output_tokens: 0, since: new Date().toISOString(), updated_at: null });
const useSupabase = () => isSupabaseReady() && !tableMissing;

function readFile() {
  try {
    if (fs.existsSync(USAGE_FILE)) return JSON.parse(fs.readFileSync(USAGE_FILE, "utf-8")) || {};
  } catch (err) {
    console.warn("[ai-usage] No se pudo leer ai_usage.json:", err.message);
  }
  return {};
}

function markTableMissing(err) {
  if (!tableMissing) console.warn("[ai-usage] Tabla ai_usage no disponible, se usa ai_usage.json:", err.message);
  tableMissing = true;
}

async function loadTotals() {
  if (totals) return totals;
  if (!loading) {
    loading = (async () => {
      const result = readFile();
      if (useSupabase()) {
        const { data, error } = await getAdminClient().from("ai_usage").select("*");
        if (error) markTableMissing(error);
        else for (const row of data || []) result[row.provider] = { ...emptyRow(), ...row };
      }
      totals = result;
      return totals;
    })().finally(() => { loading = null; });
  }
  return loading;
}

async function flush() {
  saveTimer = null;
  const providers = [...dirty];
  dirty.clear();
  if (!providers.length) return;
  if (useSupabase()) {
    const rows = providers.map(provider => {
      const { calls, input_tokens, cached_tokens, output_tokens, since, updated_at } = totals[provider];
      return { provider, calls, input_tokens, cached_tokens, output_tokens, since, updated_at };
    });
    const { error } = await getAdminClient().from("ai_usage").upsert(rows, { onConflict: "provider" });
    if (!error) return;
    markTableMissing(error);
  }
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(totals, null, 2), "utf-8");
  } catch (err) {
    console.warn("[ai-usage] No se pudo escribir ai_usage.json:", err.message);
  }
}

function scheduleSave(provider) {
  dirty.add(provider);
  if (!saveTimer) saveTimer = setTimeout(() => flush().catch(err => console.warn("[ai-usage]", err.message)), SAVE_DELAY_MS);
}

/** Suma una llamada al contador del proveedor. Nunca lanza: el contador no debe romper la IA. */
export async function recordAiUsage(provider, { input = 0, cached = 0, output = 0 } = {}) {
  if (!PROVIDERS.has(provider)) return;
  try {
    await loadTotals();
    const row = totals[provider] || (totals[provider] = emptyRow());
    row.calls += 1;
    row.input_tokens += Number(input) || 0;
    row.cached_tokens += Number(cached) || 0;
    row.output_tokens += Number(output) || 0;
    row.updated_at = new Date().toISOString();
    scheduleSave(provider);
  } catch (err) {
    console.warn("[ai-usage] No se pudo sumar el uso:", err.message);
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Devuelve true si la petición era de este módulo (y ya está respondida). */
export async function handleUsageRoutes(req, res, pathname) {
  const match = pathname.match(/^\/api\/ai\/usage(?:\/([a-z]+))?$/);
  if (!match) return false;
  const [, provider] = match;

  try {
    if (!provider && req.method === "GET") {
      await loadTotals();
      sendJson(res, 200, { usage: totals, persistent: useSupabase() });
      return true;
    }

    if (provider && req.method === "DELETE") {
      if (req.user && req.user.role !== "admin") return sendJson(res, 403, { error: "Solo administradores." }), true;
      if (!PROVIDERS.has(provider)) return sendJson(res, 404, { error: "Proveedor desconocido." }), true;
      await loadTotals();
      totals[provider] = emptyRow();
      dirty.add(provider);
      await flush();
      sendJson(res, 200, { success: true, usage: totals[provider] });
      return true;
    }

    sendJson(res, 405, { error: "Método no permitido." });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
  return true;
}
