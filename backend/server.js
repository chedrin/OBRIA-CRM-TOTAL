/**
 * ObraMaster - Backend Proxy Multimodal de Inteligencia Artificial & Persistencia SaaS
 * 
 * Arquitectura de Producción SaaS:
 * - Centralización 100% de proveedores de IA (Google Gemini, OpenAI, Anthropic Claude, OpenRouter, Azure OpenAI).
 * - Persistencia de datos en disco (db_presupuestos.json, db_obras.json, db_clientes.json, ai_settings.json, ai_audit_log.json).
 * - Gemini models: preferred model, then the models the key actually lists (flash first), then a static fallback
 * - Dynamic model discovery via `/api/ai/check-gemini-api`
 * - User-friendly error messages (sanitizing raw Google API error output)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAuthRoutes, enforceApiAuth } from "./authRoutes.js";
import { handleMemoryRoutes, buildMemoryContext, saveReferenceLearning } from "./aiMemory.js";
import { handleUsageRoutes, recordAiUsage } from "./aiUsage.js";
import { handleSubcontractorPublicRoutes, handleNotificationRoutes } from "./notificaciones.js";
import { handleAvancePublicRoutes, handleAvanceRoutes } from "./avanceRoutes.js";
import { handlePushRoutes } from "./webPush.js";
import { handleFacturacionRoutes } from "./facturacionRoutes.js";
import { handleDocumentRoutes } from "./documentRoutes.js";
import { applySecurityHeaders, applyCors, readBodyLimited } from "./security.js";
import { iniciarColaVerifactu } from "./verifactu/envio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_FRIENDLY_AI_ERROR = "No ha sido posible conectar con la IA. Revise la configuración de la API o seleccione un modelo válido.";
const GEMINI_DEFAULT_MODEL = "gemini-3.8-flash";
const GEMINI_FALLBACK_CASCADE = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest", "gemini-3.1-pro-preview"];
const GEMINI_MODELS_CACHE_MS = 60 * 60 * 1000;
const geminiModelsCache = new Map();

// Error de IA con mensaje amable y el motivo técnico aparte (sin claves) para mostrarlo y diagnosticar.
function aiError(detail) {
  const err = new Error(USER_FRIENDLY_AI_ERROR);
  err.detail = String(detail || "").replace(/key=[^&\s"]+/gi, "key=***").slice(0, 900);
  return err;
}

function loadEnv() {
  const envPaths = [
    path.join(__dirname, ".env"),
    path.join(__dirname, "../.env")
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }

  // Map VITE_ variables if process.env equivalents are not directly set
  if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  }
  if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
  }
  if (!process.env.ANTHROPIC_API_KEY && process.env.VITE_ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
  }
  if (!process.env.OPENROUTER_API_KEY && process.env.VITE_OPENROUTER_API_KEY) {
    process.env.OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY;
  }
}
loadEnv();

const PORT = Number(process.env.PORT) || 3000;
// Audios, fotos y PDF de referencia caben de sobra; más que esto es un abuso.
const MAX_REQUEST_BYTES = 40 * 1024 * 1024;

// Archivos de Persistencia
const SETTINGS_FILE = path.join(__dirname, "ai_settings.json");
const AUDIT_LOG_FILE = path.join(__dirname, "ai_audit_log.json");
const DB_PRESUPUESTOS_FILE = path.join(__dirname, "db_presupuestos.json");
const DB_OBRAS_FILE = path.join(__dirname, "db_obras.json");
const DB_CLIENTES_FILE = path.join(__dirname, "db_clientes.json");

function readJsonDb(filepath, defaultValue = []) {
  try {
    if (fs.existsSync(filepath)) {
      const raw = fs.readFileSync(filepath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[Backend DB] Error leyendo ${filepath}:`, err.message);
  }
  return defaultValue;
}

function writeJsonDb(filepath, data) {
  try {
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.warn(`[Backend DB] Error escribiendo ${filepath}:`, err.message);
    return false;
  }
}

function getDefaultAiConfig() {
  const googleKey = process.env.GEMINI_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  const openrouterKey = process.env.OPENROUTER_API_KEY || "";

  const provider = process.env.AI_PROVIDER || "google";
  const apiKeys = {
    google: googleKey,
    openai: openaiKey,
    anthropic: anthropicKey,
    openrouter: openrouterKey
  };

  return {
    provider,
    apiKey: apiKeys[provider] || googleKey || openaiKey || anthropicKey || openrouterKey || "",
    apiKeys,
    model: process.env.GEMINI_MODEL || process.env.AI_MODEL || GEMINI_DEFAULT_MODEL,
    temperature: Number(process.env.AI_TEMPERATURE) || 0.15,
    maxTokens: Number(process.env.AI_MAX_TOKENS) || 4096,
    openRouterModel: process.env.OPENROUTER_MODEL || "google/gemini-3.8-flash",
    azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
    azureDeployment: process.env.AZURE_OPENAI_DEPLOYMENT || ""
  };
}

function getSavedAiConfig() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      const defaultConfig = getDefaultAiConfig();
      const mergedKeys = {
        ...defaultConfig.apiKeys,
        ...(parsed.apiKeys || {})
      };
      const provider = parsed.provider || defaultConfig.provider;
      const activeKey = parsed.apiKey !== undefined && parsed.apiKey !== ""
        ? parsed.apiKey
        : (mergedKeys[provider] || "");

      if (activeKey && !mergedKeys[provider]) {
        mergedKeys[provider] = activeKey;
      }

      return {
        ...defaultConfig,
        ...parsed,
        provider,
        apiKey: activeKey,
        apiKeys: mergedKeys
      };
    }
  } catch (err) {
    console.warn("[Backend Settings] Error leyendo ai_settings.json:", err.message);
  }
  return getDefaultAiConfig();
}

function saveAiConfig(newConfig) {
  const current = getSavedAiConfig();
  const currentKeys = current.apiKeys || {};
  const newKeys = newConfig.apiKeys || {};

  // Una clave vacía no borra la guardada: la web ya no recibe las claves del servidor
  // y podría mandar el campo en blanco.
  const pickKey = (...candidates) => {
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const updatedApiKeys = {
    google: pickKey(newKeys.google, newConfig.googleApiKey, currentKeys.google),
    openai: pickKey(newKeys.openai, newConfig.openaiApiKey, currentKeys.openai),
    anthropic: pickKey(newKeys.anthropic, newConfig.anthropicApiKey, currentKeys.anthropic),
    openrouter: pickKey(newKeys.openrouter, newConfig.openrouterApiKey, currentKeys.openrouter)
  };

  const provider = PROVIDER_IDS.includes(newConfig.provider) ? newConfig.provider : (current.provider || "google");

  if (typeof newConfig.apiKey === "string" && newConfig.apiKey.trim() !== "") {
    updatedApiKeys[provider] = newConfig.apiKey.trim();
  }

  const activeKey = updatedApiKeys[provider] || current.apiKey || "";

  const updated = {
    ...current,
    provider,
    apiKey: activeKey,
    apiKeys: updatedApiKeys,
    model: newConfig.model || current.model,
    temperature: Number(newConfig.temperature) || current.temperature || 0.15,
    maxTokens: Number(newConfig.maxTokens) || current.maxTokens || 4096,
    openRouterModel: newConfig.openRouterModel || current.openRouterModel,
    azureEndpoint: newConfig.azureEndpoint || current.azureEndpoint,
    azureDeployment: newConfig.azureDeployment || current.azureDeployment
  };

  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), { encoding: "utf-8", mode: 0o600 });
  } catch (err) {
    console.warn("[Backend Settings] No se pudo escribir ai_settings.json:", err.message);
  }

  return updated;
}

const PROVIDER_IDS = ["google", "openai", "anthropic", "openrouter"];
const maskKey = k => k ? `…${String(k).slice(-4)}` : "";

// Lo que ve el navegador: nunca las claves, solo si hay una y sus 4 últimas cifras.
function publicAiConfig(config) {
  const apiKeys = config.apiKeys || {};
  const { apiKey, apiKeys: _keys, fallbackKeys: _fallback, ...rest } = config;
  const activeKey = apiKeys[config.provider] || apiKey || "";
  return {
    ...rest,
    apiKey: "",
    apiKeys: {},
    apiKeyMasked: maskKey(activeKey),
    apiKeysMasked: Object.fromEntries(PROVIDER_IDS.map(p => [p, maskKey(apiKeys[p])])),
    apiKeysConfigured: Object.fromEntries(PROVIDER_IDS.map(p => [p, Boolean(apiKeys[p])]))
  };
}

function logAiCall({ provider, model, action, latencyMs, success, error, tokensUsed = 0 }) {
  const entry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    provider,
    model,
    action,
    latencyMs,
    success,
    error: error || null,
    tokensUsed,
    estimatedCostUsd: tokensUsed ? (tokensUsed * 0.000002).toFixed(6) : "0.000000"
  };

  try {
    let logs = [];
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      try { logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, "utf-8")); } catch { logs = []; }
    }
    logs.unshift(entry);
    if (logs.length > 500) logs = logs.slice(0, 500);
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Backend Audit] Error guardando log de auditoría:", err.message);
  }
}

function cleanJsonOutput(raw) {
  if (!raw) return "{}";
  let str = raw.trim();
  if (str.startsWith("```")) {
    str = str.replace(/^```(?:json)?\s*/i, "");
    str = str.replace(/\s*```$/i, "");
  }
  const start = str.indexOf("{");
  const end = str.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    str = str.substring(start, end + 1);
  }
  return str.replace(/,\s*([}\]])/g, "$1");
}

// Parsea el JSON de la IA. Si llega cortado (límite de tokens), lo cierra en el último objeto completo.
function parseAiJson(raw) {
  const cleaned = cleanJsonOutput(raw);
  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    const str = String(raw || "").slice(Math.max(0, String(raw || "").indexOf("{")));
    const stack = [];
    let inString = false, escaped = false, lastCut = -1, lastStack = null;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") {
        stack.pop();
        if (stack.length) { lastCut = i + 1; lastStack = [...stack]; }
      }
    }
    if (lastCut > 0) {
      const closers = lastStack.reverse().map(c => (c === "{" ? "}" : "]")).join("");
      try {
        return JSON.parse((str.slice(0, lastCut) + closers).replace(/,\s*([}\]])/g, "$1"));
      } catch {}
    }
    throw aiError(`La IA devolvió una respuesta incompleta o no válida (${firstErr.message}).`);
  }
}

function fileToPart(file) {
  let mimeType = (file.mimetype || "application/octet-stream").split(";")[0].trim();
  if (file.originalname) {
    const ext = file.originalname.split(".").pop().toLowerCase();
    if (ext === "mp3") mimeType = "audio/mp3";
    else if (ext === "wav") mimeType = "audio/wav";
    else if (ext === "m4a") mimeType = "audio/mp4";
    else if (ext === "ogg" || ext === "opus") mimeType = "audio/ogg";
    else if (ext === "webm") mimeType = "audio/webm";
    else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "pdf") mimeType = "application/pdf";
  }

  return {
    inlineData: {
      mimeType,
      data: file.buffer.toString("base64")
    }
  };
}

// Registra los tokens de cada llamada; "caché" es la parte del prompt que el proveedor cobra con descuento.
// También se suma al contador de Ajustes > Motor IA.
function logAiUsage(provider, model, { input = 0, cached = 0, output = 0 } = {}) {
  console.log(`[IA uso] ${provider} ${model || ""}: entrada ${input} (caché ${cached}), salida ${output}`);
  recordAiUsage(provider, { input, cached, output });
}

async function callGeminiProvider({ apiKey, model, contents, systemInstruction, temperature = 0.15, maxTokens = 4096, responseMimeType = "application/json" }) {
  const effectiveKey = (apiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!effectiveKey) {
    throw aiError("Falta la clave GEMINI_API_KEY.");
  }

  const modelsToTry = await geminiModelsToTry(effectiveKey, model || GEMINI_DEFAULT_MODEL);

  const baseUrl = `https://generativelanguage.googleapis.com/v1beta`;
  const bodyPayload = {
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    generationConfig: {
      ...(responseMimeType ? { responseMimeType } : {}),
      temperature,
      maxOutputTokens: maxTokens
    }
  };

  const failures = [];
  const preferredModel = modelsToTry[0];
  let preferredGone = false;
  let busyModels = [];

  // Segunda vuelta solo para los modelos saturados (429/500/503), tras una pausa breve.
  for (let round = 0; round < 2; round++) {
    const roundModels = round === 0 ? modelsToTry : busyModels;
    if (!roundModels.length) break;
    if (round > 0) await new Promise(r => setTimeout(r, 2500));
    busyModels = [];

    for (const targetModel of roundModels) {
      const url = `${baseUrl}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(effectiveKey)}`;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload)
        });

        if (response.ok) {
          const data = await response.json();
          const candidate = data.candidates?.[0];
          const rawText = (candidate?.content?.parts || [])
            .filter(p => p.text && !p.thought)
            .map(p => p.text)
            .join("");
          if (rawText) {
            const u = data.usageMetadata || {};
            logAiUsage("google", targetModel, { input: u.promptTokenCount, cached: u.cachedContentTokenCount || 0, output: u.candidatesTokenCount });
            if (preferredGone) replaceSavedGeminiModel(preferredModel, targetModel);
            return rawText;
          }
          failures.push(`[${targetModel}] respuesta vacía (${candidate?.finishReason || data.promptFeedback?.blockReason || "sin motivo"})`);
          console.error(`[Backend Gemini Error] ${failures[failures.length - 1]}`);
          continue;
        }

        let errText = await response.text();
        try { errText = JSON.parse(errText).error?.message || errText; } catch {}
        console.error(`[Backend Gemini Error] Modelo "${targetModel}" HTTP ${response.status}: ${errText}`);
        failures.push(`[${targetModel}] HTTP ${response.status}: ${/quota/i.test(errText) ? "cuota agotada" : errText.slice(0, 120)}`);

        const gone = response.status === 404 || /not found|is not supported|no longer available/i.test(errText);
        if (gone) {
          markGeminiModelUnavailable(effectiveKey, targetModel);
          if (targetModel === preferredModel) preferredGone = true;
          continue;
        }
        if ([429, 500, 503].includes(response.status)) {
          // Cuota agotada no se recupera en segundos: solo se reintenta la saturación puntual.
          if (!/quota/i.test(errText)) busyModels.push(targetModel);
          continue;
        }

        round = 2;
        break;
      } catch (netErr) {
        console.error(`[Backend Gemini Exception] Modelo "${targetModel}":`, netErr.message);
        failures.push(`[${targetModel}] ${netErr.message}`);
        continue;
      }
    }
  }

  const detail = failures.join(" | ") || "sin modelos Gemini disponibles";
  console.error("[Backend Gemini Fallback Failed] Detalle técnico interno:", detail);
  throw aiError(detail);
}

// Ranks the models a key can use: stable flash first, then pro, newest version first.
function rankGeminiModels(ids) {
  const usable = ids.filter(id => /^gemini-/.test(id) && !/lite|image|tts|live|embedding|audio|thinking-exp|robotics|computer-use/i.test(id));
  const version = id => parseFloat((id.match(/^gemini-(\d+(?:\.\d+)?)/) || [])[1] || "0");
  const score = id => (id.includes("flash") ? 0 : 2) + (/preview|exp/.test(id) ? 1 : 0);
  return usable.sort((a, b) => score(a) - score(b) || version(b) - version(a) || a.length - b.length);
}

async function listGeminiModelsCached(apiKey) {
  const cached = geminiModelsCache.get(apiKey);
  if (cached && Date.now() - cached.at < GEMINI_MODELS_CACHE_MS) return cached;
  try {
    const entry = { at: Date.now(), models: rankGeminiModels(await fetchAvailableGeminiModelsFromGoogle(apiKey)), unavailable: new Set() };
    geminiModelsCache.set(apiKey, entry);
    return entry;
  } catch (err) {
    console.warn("[Backend Gemini] No se pudo listar modelos:", err.message);
    return { at: 0, models: [], unavailable: cached?.unavailable || new Set() };
  }
}

function markGeminiModelUnavailable(apiKey, modelId) {
  geminiModelsCache.get(apiKey)?.unavailable.add(modelId);
}

// Si el modelo guardado en Ajustes ya no existe, se sustituye por el que acaba de responder.
function replaceSavedGeminiModel(oldModel, newModel) {
  try {
    const current = getSavedAiConfig();
    if ((current.provider || "google") === "google" && current.model === oldModel) {
      saveAiConfig({ model: newModel });
      console.warn(`[Backend Gemini] Modelo guardado "${oldModel}" retirado; se usa "${newModel}".`);
    }
  } catch (err) {
    console.warn("[Backend Gemini] No se pudo actualizar el modelo guardado:", err.message);
  }
}

async function geminiModelsToTry(apiKey, preferredModel) {
  const { models, unavailable } = await listGeminiModelsCached(apiKey);
  const candidates = models.length
    ? [...(models.includes(preferredModel) ? [preferredModel] : []), ...models.slice(0, 4)]
    : [preferredModel, ...GEMINI_FALLBACK_CASCADE];
  const unique = [...new Set(candidates)].filter(m => !unavailable.has(m));
  return unique.length ? unique : [...new Set(candidates)];
}

async function fetchAvailableGeminiModelsFromGoogle(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(USER_FRIENDLY_AI_ERROR);
  const data = await res.json();
  const list = data.models || [];
  return list
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => (m.name || '').replace(/^models\//, ''));
}

async function callOpenAiProvider({ apiKey, model, messages, temperature = 0.15, maxTokens = 4096 }) {
  const effectiveKey = (apiKey || process.env.OPENAI_API_KEY || "").trim();
  if (!effectiveKey) throw aiError("Falta la clave OPENAI_API_KEY.");

  const url = "https://api.openai.com/v1/chat/completions";
  // Los modelos actuales usan max_completion_tokens y algunos solo admiten la temperatura por defecto.
  const send = (withTemperature) => fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${effectiveKey}`
    },
    body: JSON.stringify({
      model: model || "chat-latest",
      messages,
      response_format: { type: "json_object" },
      ...(withTemperature ? { temperature } : {}),
      max_completion_tokens: maxTokens
    })
  });

  try {
    let response = await send(true);
    let errText = "";
    if (!response.ok) {
      errText = await response.text();
      try { errText = JSON.parse(errText).error?.message || errText; } catch {}
      if (response.status === 400 && /temperature/i.test(errText)) {
        response = await send(false);
        errText = "";
        if (!response.ok) {
          errText = await response.text();
          try { errText = JSON.parse(errText).error?.message || errText; } catch {}
        }
      }
    }

    if (!response.ok) {
      console.error(`[OpenAI Error] HTTP ${response.status}: ${errText}`);
      throw aiError(`OpenAI HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw aiError("OpenAI devolvió una respuesta vacía.");
    logAiUsage("openai", data.model, { input: data.usage?.prompt_tokens, cached: data.usage?.prompt_tokens_details?.cached_tokens || 0, output: data.usage?.completion_tokens });
    return content;
  } catch (err) {
    console.error("[OpenAI Provider Exception]", err);
    throw aiError(err.detail || err.message);
  }
}

async function callAnthropicProvider({ apiKey, model, systemPrompt, userPrompt, userContent = null, temperature = 0.15, maxTokens = 4096 }) {
  const effectiveKey = (apiKey || process.env.ANTHROPIC_API_KEY || "").trim();
  if (!effectiveKey) throw aiError("Falta la clave ANTHROPIC_API_KEY.");

  const url = "https://api.anthropic.com/v1/messages";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": effectiveKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-5-5",
        // La instrucción del sistema (pautas, referencias y memoria) se guarda en la caché de Anthropic
        // y en las llamadas siguientes se cobra a una fracción del precio.
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userContent || userPrompt }],
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      let errText = await response.text();
      try { errText = JSON.parse(errText).error?.message || errText; } catch {}
      console.error(`[Anthropic Error] HTTP ${response.status}: ${errText}`);
      throw aiError(`Anthropic HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === "text")?.text || "";
    if (!textBlock) throw aiError("Anthropic devolvió una respuesta vacía.");
    const u = data.usage || {};
    logAiUsage("anthropic", data.model, {
      input: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      cached: u.cache_read_input_tokens || 0,
      output: u.output_tokens
    });
    return textBlock;
  } catch (err) {
    console.error("[Anthropic Provider Exception]", err);
    throw aiError(err.detail || err.message);
  }
}

async function callOpenRouterProvider({ apiKey, model, messages, temperature = 0.15, maxTokens = 4096 }) {
  const effectiveKey = (apiKey || process.env.OPENROUTER_API_KEY || "").trim();
  if (!effectiveKey) throw aiError("Falta la clave OPENROUTER_API_KEY.");

  const url = "https://openrouter.ai/api/v1/chat/completions";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${effectiveKey}`,
        "HTTP-Referer": "https://obriamaster.app",
        "X-Title": "ObraMaster CRM"
      },
      body: JSON.stringify({
        model: model || "google/gemini-3.8-flash",
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      let errText = await response.text();
      try { errText = JSON.parse(errText).error?.message || errText; } catch {}
      console.error(`[OpenRouter Error] HTTP ${response.status}: ${errText}`);
      throw aiError(`OpenRouter HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw aiError("OpenRouter devolvió una respuesta vacía.");
    logAiUsage("openrouter", data.model, { input: data.usage?.prompt_tokens, cached: data.usage?.prompt_tokens_details?.cached_tokens || 0, output: data.usage?.completion_tokens });
    return content;
  } catch (err) {
    console.error("[OpenRouter Provider Exception]", err);
    throw aiError(err.detail || err.message);
  }
}

const ENV_KEY_BY_PROVIDER = {
  google: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY"
};

// Clave de un proveedor concreto: ajustes guardados y, si no hay, variable de entorno.
function resolveProviderKey(config, provider) {
  const saved = (config.apiKeys || {})[provider] || (config.provider === provider ? config.apiKey : "");
  return String(saved || process.env[ENV_KEY_BY_PROVIDER[provider]] || "").trim();
}

// El modelo guardado solo vale para su proveedor (un "claude-..." no sirve para Gemini).
function modelForProvider(config, provider) {
  const model = config.model || "";
  if (provider === "google") return model.startsWith("gemini") ? model : GEMINI_DEFAULT_MODEL;
  if (provider === "anthropic") return model.startsWith("claude") ? model : "claude-sonnet-5-5";
  if (provider === "openai") return model && !model.startsWith("gemini") && !model.startsWith("claude") ? model : "chat-latest";
  return model || config.openRouterModel || "google/gemini-3.8-flash";
}

const PROVIDER_ORDER = ["google", "anthropic", "openai", "openrouter"];

// Manda la configuración guardada en el servidor (Ajustes > Motor IA). Una clave enviada por el
// navegador (configuraciones antiguas) solo se usa si el servidor no tiene clave para ese proveedor.
function configWithRequestKey(config, fields = {}) {
  const provider = config.provider || "google";
  const requestKey = String(fields.apiKey || "").trim();
  if (!requestKey || resolveProviderKey(config, provider)) return config;
  return { ...config, apiKeys: { ...(config.apiKeys || {}), [provider]: requestKey } };
}

// Claves guardadas en Ajustes (empresa_config en Supabase) que envía el navegador. Rellenan solo los
// proveedores sin clave en el servidor: ai_settings.json se borra en cada despliegue de Render.
function withBrowserKeys(config, fields = {}) {
  let browserKeys = fields.apiKeys;
  if (typeof browserKeys === "string") {
    try { browserKeys = JSON.parse(browserKeys); } catch { browserKeys = null; }
  }
  if (!browserKeys || typeof browserKeys !== "object") return config;
  // La clave de Ajustes manda (es la última que puso el usuario); la del servidor queda de reserva.
  const apiKeys = { ...(config.apiKeys || {}) };
  const fallbackKeys = { ...(config.fallbackKeys || {}) };
  for (const provider of PROVIDER_ORDER) {
    const key = String(browserKeys[provider] || "").trim();
    if (!key) continue;
    const serverKey = resolveProviderKey(config, provider);
    if (serverKey && serverKey !== key) fallbackKeys[provider] = serverKey;
    apiKeys[provider] = key;
  }
  return { ...config, apiKeys, fallbackKeys };
}

const keyTail = key => `clave …${String(key).slice(-4)}`;

// Traduce los errores de saldo o cuota a algo accionable.
function explainAiFailure(provider, detail) {
  const text = String(detail || "");
  if (provider === "anthropic" && /credit balance/i.test(text)) return "sin saldo en la cuenta de Claude: añade crédito en platform.claude.com > Billing";
  if (provider === "openai" && /insufficient_quota|exceeded your current quota|credits/i.test(text)) return "sin crédito en la cuenta de OpenAI: añade saldo en platform.openai.com > Billing";
  if (provider === "google" && /cuota agotada|quota/i.test(text)) return `${text.slice(0, 250)} (la cuota es del proyecto de Google, no de la clave: otra clave del mismo proyecto no la renueva; activa la facturación en aistudio.google.com)`;
  if (/HTTP 401|invalid.*key|API key not valid|authentication/i.test(text)) return `clave no válida: ${text.slice(0, 200)}`;
  return text.slice(0, 350);
}

// Adjuntos (PDF e imágenes) en el formato de cada proveedor. `part` viene de fileToPart.
function openAiContent(text, parts) {
  return [
    { type: "text", text },
    ...parts.map(({ inlineData: { mimeType, data } }, idx) => mimeType === "application/pdf"
      ? { type: "file", file: { filename: `documento-${idx + 1}.pdf`, file_data: `data:application/pdf;base64,${data}` } }
      : { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } })
  ];
}

function anthropicContent(text, parts) {
  return [
    ...parts.map(({ inlineData: { mimeType, data } }) => ({
      type: mimeType === "application/pdf" ? "document" : "image",
      source: { type: "base64", media_type: mimeType, data }
    })),
    { type: "text", text }
  ];
}

/**
 * Llama a la IA con un prompt de texto y devuelve el texto bruto.
 * Empieza por el proveedor elegido en Ajustes > Motor IA; si falla o no tiene clave,
 * prueba el resto de proveedores con clave configurada en el servidor.
 * `geminiParts` (fotos, PDF, audio) solo se envían cuando responde Gemini.
 * `attachments` (PDF e imágenes, en formato de fileToPart) se envían a cualquier proveedor.
 */
async function callActiveProvider({ config, systemInstruction, userPrompt, temperature = 0.15, maxTokens = 4096, geminiParts = [], attachments = [] }) {
  const preferred = (config.provider || "google").toLowerCase();
  const candidates = [preferred, ...PROVIDER_ORDER].filter((p, i, arr) => arr.indexOf(p) === i && resolveProviderKey(config, p));
  if (!candidates.length) {
    throw aiError("No hay ninguna clave de IA en el servidor (GEMINI_API_KEY, ANTHROPIC_API_KEY u OPENAI_API_KEY).");
  }

  const attempts = candidates.flatMap(provider => {
    const keys = [resolveProviderKey(config, provider), String((config.fallbackKeys || {})[provider] || "").trim()];
    return keys.filter((k, i) => k && keys.indexOf(k) === i).map(apiKey => ({ provider, apiKey }));
  });

  const failures = [];
  for (const { provider, apiKey } of attempts) {
    const model = modelForProvider(config, provider);
    try {
      if (provider === "openai" || provider === "openrouter") {
        const call = provider === "openai" ? callOpenAiProvider : callOpenRouterProvider;
        return await call({
          apiKey, model, temperature, maxTokens,
          messages: [{ role: "system", content: systemInstruction }, { role: "user", content: attachments.length ? openAiContent(userPrompt, attachments) : userPrompt }]
        });
      }
      if (provider === "anthropic") {
        return await callAnthropicProvider({
          apiKey, model, systemPrompt: systemInstruction, userPrompt, temperature, maxTokens,
          userContent: attachments.length ? anthropicContent(userPrompt, attachments) : null
        });
      }
      return await callGeminiProvider({
        apiKey,
        model,
        contents: [{ role: "user", parts: [{ text: userPrompt }, ...attachments, ...geminiParts] }],
        systemInstruction,
        temperature,
        maxTokens
      });
    } catch (err) {
      failures.push(`${provider} (${keyTail(apiKey)}): ${explainAiFailure(provider, err.detail || err.message)}`);
      console.warn(`[IA] Falló ${provider}, probando el siguiente proveedor.`, err.detail || err.message);
    }
  }
  if (candidates.length === 1) {
    failures.push("sin otra IA de respaldo: añade la clave de OpenAI o Claude en Ajustes > Motor IA y pulsa Guardar");
  }
  throw aiError(failures.join(" | "));
}

// Texto de los presupuestos de referencia activos que se envía como modelo de estilo.
function buildReferenceBudgetsText(refBudgets, { max = 4, chars = 3500 } = {}) {
  return (refBudgets || [])
    .filter(r => r && r.is_active !== false)
    .slice(0, max)
    .map((r, idx) => `=== PRESUPUESTO DE REFERENCIA ${idx + 1}: ${r.name || "Presupuesto modelo"}${r.tipo_obra ? ` (${r.tipo_obra})` : ""} ===\n${String(r.extracted_text || r.text_content || "").substring(0, chars)}`)
    .join("\n\n");
}

// Base de precios: elige las partidas que más tienen que ver con la obra para no saturar el prompt.
const PRICE_STOPWORDS = new Set("de la el los las del con para por una uno sin que en y o a al su sus incluso hasta como cada todo toda".split(" "));
const priceWords = text => String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .split(/[^a-z0-9]+/).filter(w => w.length > 2 && !PRICE_STOPWORDS.has(w));

function selectRelevantPrices(catalog, contextText, limit = 150) {
  const items = (Array.isArray(catalog) ? catalog : []).filter(p => p && (p.concepto || p.titulo));
  if (items.length <= limit) return items;
  const context = new Set(priceWords(contextText));
  return items
    .map((p, idx) => {
      const words = priceWords(`${p.concepto || p.titulo} ${p.capitulo || ""} ${p.gremio || ""}`);
      const hits = words.filter(w => context.has(w)).length;
      return { p, idx, score: words.length ? hits / Math.sqrt(words.length) : 0 };
    })
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, limit)
    .map(x => x.p);
}

// Valida los parámetros del cliente que el asistente exige antes de generar un presupuesto.
function validateParametrosCliente(p) {
  const errors = [];
  if (!p || typeof p !== "object") return ["faltan los parámetros."];
  const tipos = ["particular", "comunidad", "empresa", "constructor", "administracion"];
  const fiscalidades = ["iva10", "iva21", "isp", "exento"];
  if (!tipos.includes(p.tipoCliente)) errors.push("Falta el tipo de cliente.");
  const margen = Number(p.margenComercialPct);
  if (!Number.isFinite(margen) || margen < 5 || margen > 60) errors.push("El margen comercial debe estar entre 5% y 60%.");
  if (!String(p.condicionesPago || "").trim()) errors.push("Faltan las condiciones de pago.");
  if (!fiscalidades.includes(p.fiscalidad)) errors.push("Falta la fiscalidad estimada.");
  if (p.fiscalidad === "isp" && p.tipoCliente !== "constructor") errors.push("La inversión del sujeto pasivo solo aplica a constructores o promotores.");
  const irpf = Number(p.retencionIrpfPct || 0);
  if (![0, 1, 7, 15].includes(irpf)) errors.push("Retención de IRPF no válida.");
  return errors;
}

function buildPriceBaseText(items) {
  return items.map(p => {
    const coste = p.costeUnitario ?? p.costeSubcontrata;
    const fuente = p.fuente?.subcontrata ? ` | Fuente: ${p.fuente.subcontrata}${p.fuente.fecha ? ` (${p.fuente.fecha})` : ""}` : "";
    return `- [${p.codigo || "GEN"}] ${p.gremio || p.capitulo ? `(${p.gremio || p.capitulo}) ` : ""}${p.concepto || p.titulo} | Unidad: ${p.unidad || "ud"} | Coste: ${coste ?? "?"}€ | Margen: ${p.margenPct ?? "?"}% | PVP: ${p.precioVenta ?? "?"}€${fuente}`;
  }).join("\n");
}

// Transcripción de Audio Robusta: Whisper (OpenAI) si hay clave; si no, o si falla, Gemini.
async function transcribeAudioUnified({ audioFile, config }) {
  const provider = (config.provider || "google").toLowerCase();
  const requestKey = (config.apiKey || "").trim();
  const isOpenAiKey = k => k.startsWith("sk-") && !k.startsWith("sk-ant") && !k.startsWith("sk-or");
  const openAiKey = isOpenAiKey(requestKey) ? requestKey : resolveProviderKey(config, "openai");
  const geminiKey = requestKey.startsWith("AIza") ? requestKey : resolveProviderKey(config, "google");

  const attempts = [];
  if (openAiKey && (provider === "openai" || !geminiKey)) attempts.push("openai");
  if (geminiKey) attempts.push("google");
  if (openAiKey && !attempts.includes("openai")) attempts.push("openai");

  let lastError = null;
  for (const engine of attempts) {
    try {
      const text = engine === "openai"
        ? await transcribeWithWhisper(audioFile, openAiKey)
        : await transcribeWithGemini(audioFile, geminiKey, modelForProvider(config, "google"));
      if (text && text.trim()) return text.trim();
    } catch (err) {
      lastError = err;
      console.warn(`[Transcripción] Falló con ${engine}:`, err.message);
    }
  }
  if (lastError) throw lastError;
  throw new Error("No hay ninguna clave de IA para transcribir audio (GEMINI_API_KEY u OPENAI_API_KEY).");
}

async function transcribeWithWhisper(audioFile, apiKey) {
  const boundary = "--------------------------" + Math.random().toString(36).substring(2);
  const filename = audioFile.originalname || "audio-grabacion.webm";
  const mime = audioFile.mimetype || "audio/webm";

  const bodyParts = [];
  bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`));
  bodyParts.push(audioFile.buffer);
  bodyParts.push(Buffer.from("\r\n"));
  bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`));
  bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nes\r\n`));
  bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\nConstrucción y reformas: alicatados, rozas, solado porcelánico, pladur, bajantes, REBT, CTE.\r\n`));
  bodyParts.push(Buffer.from(`--${boundary}--\r\n`));

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Authorization": `Bearer ${apiKey}`
    },
    body: Buffer.concat(bodyParts)
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }

  if (!res.ok) {
    console.error(`[Whisper Error] ${res.status}:`, data);
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }

  return data.text || "";
}

async function transcribeWithGemini(audioFile, apiKey, model) {
  const promptText = `
Eres un transcriptor experto en construcción y reformas de "ObraMaster".
Escucha el audio adjunto y transcribe fielmente todo lo dicho en español, corrigiendo términos de obra (alicatados, rozas, falsos techos, etc.).
No resumas ni inventes: si una parte no se entiende, escribe [inaudible].

Devuelve estrictamente un JSON válido con esta estructura exacta:
{"transcripcion": "Texto fiel y literal en español"}
`;
  const rawText = await callGeminiProvider({
    apiKey,
    model,
    contents: [{ role: "user", parts: [{ text: promptText }, fileToPart(audioFile)] }],
    temperature: 0.1,
    maxTokens: 8192,
    responseMimeType: "application/json"
  });

  try {
    const cleaned = cleanJsonOutput(rawText);
    if (!cleaned || cleaned === "{}") return rawText ? rawText.trim() : "";
    const parsed = JSON.parse(cleaned);
    return parsed.transcripcion || parsed.texto || rawText.trim() || "";
  } catch (parseErr) {
    console.warn("[Backend Gemini Transcribe] Fallo al parsear JSON, usando texto raw:", parseErr.message);
    return rawText ? rawText.trim() : "";
  }
}

// Servidor Estático
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".webm": "video/webm",
  ".mp3": "audio/mp3",
  ".wav": "audio/wav"
};

const DIST_DIR = path.resolve(__dirname, "../dist");

function tryServeStatic(req, res, pathname) {
  if (!fs.existsSync(DIST_DIR)) return false;

  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(DIST_DIR, "." + path.posix.normalize(relativePath));
  // Nada fuera de dist/ ni archivos ocultos (.env, .git...).
  const insideDist = filePath.startsWith(DIST_DIR + path.sep);
  const hidden = relativePath.split("/").some(part => part.startsWith("."));

  if (insideDist && !hidden && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    // Los archivos de assets/ llevan huella en el nombre: se pueden cachear un año.
    const cache = relativePath.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
    res.writeHead(200, { "Content-Type": contentType, "Cache-Control": cache });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  const indexPath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexPath) && !path.extname(pathname)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    fs.createReadStream(indexPath).pipe(res);
    return true;
  }

  return false;
}

function parseMultipartBuffer(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = { fotos: [], audios: [] };

  let start = 0;
  while (start < buffer.length) {
    const boundaryIdx = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIdx === -1) break;

    const nextBoundaryIdx = buffer.indexOf(boundaryBuffer, boundaryIdx + boundaryBuffer.length);
    if (nextBoundaryIdx === -1) break;

    const partBuffer = buffer.slice(boundaryIdx + boundaryBuffer.length, nextBoundaryIdx);
    start = nextBoundaryIdx;

    const headerEndIdx = partBuffer.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEndIdx === -1) continue;

    const headerText = partBuffer.slice(0, headerEndIdx).toString("utf-8");
    let content = partBuffer.slice(headerEndIdx + 4);

    if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
      content = content.slice(0, content.length - 2);
    }

    const dispMatch = headerText.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
    if (!dispMatch) continue;

    const fieldName = dispMatch[1];
    const filename = dispMatch[2];

    const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);
    const mimetype = typeMatch ? typeMatch[1].trim() : "application/octet-stream";

    if (filename) {
      const fileObj = {
        fieldname: fieldName,
        originalname: filename,
        mimetype,
        buffer: content,
        size: content.length
      };
      if (fieldName === "fotos" || fieldName.startsWith("foto")) {
        files.fotos.push(fileObj);
      } else if (fieldName === "audios" || fieldName.startsWith("audio") || fieldName === "file") {
        files.audios.push(fileObj);
      } else {
        if (!files[fieldName]) files[fieldName] = [];
        files[fieldName].push(fileObj);
      }
    } else {
      fields[fieldName] = content.toString("utf-8");
    }
  }

  return { fields, files };
}

// Handler de Peticiones HTTP
async function handleRequest(req, res) {
  applySecurityHeaders(res);
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, "http://localhost");
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Petición no válida");
    return;
  }
  const pathname = parsedUrl.pathname;
  if (pathname.startsWith("/api")) res.setHeader("Cache-Control", "no-store");

  // Servir estáticos
  if (!pathname.startsWith("/api")) {
    const served = tryServeStatic(req, res, pathname);
    if (served) return;

    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><title>ObraMaster - Aplicación No Construida</title></head>
      <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center;">
        <h1>ObraMaster CRM</h1>
        <p>El frontend aún no ha sido construido en la carpeta <code>dist/</code>.</p>
        <p>Ejecuta <code>npm run build</code> en el servidor para generar los archivos de producción.</p>
      </body>
      </html>
    `);
    return;
  }

  // Enlace mágico de subcontratas (público: lo protege el token de la URL)
  if (await handleSubcontractorPublicRoutes(req, res, pathname, { parseMultipart: parseMultipartBuffer })) return;
  if (await handleAvancePublicRoutes(req, res, pathname, { parseMultipart: parseMultipartBuffer })) return;

  // Login y gestión de usuarios (Supabase Auth)
  if (await handleAuthRoutes(req, res, pathname)) return;

  // Resto de la API: exige sesión válida (administradores; obreros solo en rutas permitidas)
  if (!(await enforceApiAuth(req, res, pathname))) return;

  // Avisos, necesidades de obra, pedidos a proveedor y enlaces de subcontratas
  if (await handleNotificationRoutes(req, res, pathname, parsedUrl.searchParams)) return;
  // Asignaciones y avance de obra por fase y partida
  if (await handleAvanceRoutes(req, res, pathname, parsedUrl.searchParams, { parseMultipart: parseMultipartBuffer })) return;
  if (await handlePushRoutes(req, res, pathname)) return;

  // Memoria de la IA (instrucciones permanentes y correcciones)
  if (await handleMemoryRoutes(req, res, pathname)) return;

  // Contador de tokens por proveedor (Ajustes > Motor IA)
  if (await handleUsageRoutes(req, res, pathname)) return;

  // Facturación legal: empresa, numeración y VeriFactu (Ajustes > Facturación)
  if (await handleFacturacionRoutes(req, res, pathname, parsedUrl.searchParams)) return;

  // Envío de presupuestos y facturas por correo o WhatsApp (claves solo en el servidor)
  if (await handleDocumentRoutes(req, res, pathname)) return;

  // Endpoints GET
  if (req.method === "GET") {
    // Pública: solo dice si el servidor está vivo (sin proveedor, modelo ni puerto).
    if (pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "online", timestamp: new Date().toISOString() }));
      return;
    }

    if (pathname === "/api/settings/ai") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(publicAiConfig(getSavedAiConfig())));
      return;
    }

    if (pathname === "/api/presupuestos") {
      const data = readJsonDb(DB_PRESUPUESTOS_FILE, []);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }

    if (pathname === "/api/obras") {
      const data = readJsonDb(DB_OBRAS_FILE, []);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }

    if (pathname === "/api/clientes") {
      const data = readJsonDb(DB_CLIENTES_FILE, []);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }
  }

  // Leer cuerpo para POST / PUT (con límite de tamaño)
  let bodyBuffer;
  try {
    bodyBuffer = await readBodyLimited(req, MAX_REQUEST_BYTES);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(err.status || 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.status ? err.message : "No se pudo leer la petición." }));
    }
    return;
  }
  {
    const contentType = req.headers["content-type"] || "";

    let fields = {};
    let files = { fotos: [], audios: [] };

    if (contentType.includes("multipart/form-data")) {
      const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
      if (boundaryMatch) {
        const parsed = parseMultipartBuffer(bodyBuffer, boundaryMatch[1].trim());
        fields = parsed.fields;
        files = parsed.files;
      }
    } else if (contentType.includes("application/json") && bodyBuffer.length > 0) {
      try { fields = JSON.parse(bodyBuffer.toString("utf-8")); } catch { fields = {}; }
    }

    const currentConfig = withBrowserKeys(getSavedAiConfig(), fields);

    try {
      if (req.method === "PUT" && pathname === "/api/settings/ai") {
        const updated = saveAiConfig(fields);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          message: "Configuración del motor de IA actualizada correctamente",
          config: publicAiConfig(updated)
        }));
        return;
      }

      if (req.method === "POST" && (pathname === "/api/ai/improve-text" || pathname === "/api/ai/refine-text")) {
        const startTime = performance.now();
        const textToImprove = fields.text || fields.texto || fields.content || fields.input || "";
        const context = fields.context || "Descripción técnica de trabajo";

        if (!textToImprove || !textToImprove.trim()) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Introduce un texto para mejorar." }));
          return;
        }

        let refBudgets = [];
        try {
          if (fields.referenceBudgets) {
            refBudgets = typeof fields.referenceBudgets === "string" ? JSON.parse(fields.referenceBudgets) : fields.referenceBudgets;
          }
        } catch {}

        // Los presupuestos ya analizados están resumidos en la memoria de la IA: solo se envía el texto de los pendientes.
        const refBudgetsText = buildReferenceBudgetsText((refBudgets || []).filter(r => r && !r.ai_reviewed_at), { max: 3, chars: 2500 });

        const memoryContext = await buildMemoryContext("texto");

        const systemInstruction = `
Eres un Ingeniero Técnico de Edificación y Jefe de Obra experto de "ObraMaster".
Tu objetivo es reescribir y mejorar borradores o descripciones de trabajos/partidas de presupuesto escritas por el usuario, convirtiéndolas al lenguaje profesional de un constructor o reformista, con la terminología técnica precisa del sector de la edificación (pliegos de condiciones, normativa CTE, saneado de soportes, medios auxiliares, imprimaciones, unidades normalizadas m2/ml/ud/pa, etc.).

Devuelve STRICTLY un JSON válido con esta estructura exacta:
{
  "textoMejorado": "Texto completo reescrito en lenguaje técnico profesional de construcción y reformas",
  "explicacionCambios": "Breve resumen ejecutivo de las mejoras técnicas y vocabulario introducido (1 frase)"
}

${refBudgetsText ? `PRESUPUESTOS Y EJEMPLOS DE REFERENCIA DE LA EMPRESA:\nUtiliza los siguientes ejemplos como referencia obligatoria de estilo, tono, formato y vocabulario técnico. Imita su forma de redactar:\n\n${refBudgetsText}\n` : ""}
${memoryContext}
`;

        const userPrompt = `
TEXTO DRAFT ORIGINAL A MEJORAR Y REESCRIBIR (${context}):
"""
${textToImprove.trim()}
"""
`;

        const aiConfig = configWithRequestKey(currentConfig, fields);
        const rawOutput = await callActiveProvider({
          config: aiConfig,
          systemInstruction,
          userPrompt,
          temperature: 0.2,
          maxTokens: 8192
        });

        const elapsedMs = Math.round(performance.now() - startTime);
        let parsed = {};
        try {
          parsed = JSON.parse(cleanJsonOutput(rawOutput));
        } catch {
          parsed = { textoMejorado: rawOutput.trim(), explicacionCambios: "Reescrito con lenguaje técnico." };
        }

        const improvedText = parsed.textoMejorado || parsed.texto_mejorado || rawOutput.trim();
        const explicacionCambios = parsed.explicacionCambios || parsed.explicacion || "Vocabulario técnico y precisión de obra aplicados.";

        logAiCall({
          provider: aiConfig.provider,
          model: aiConfig.model,
          action: "improve-text",
          latencyMs: elapsedMs,
          success: true,
          tokensUsed: Math.ceil((userPrompt.length + improvedText.length) / 4)
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          originalText: textToImprove.trim(),
          improvedText: improvedText,
          explicacionCambios: explicacionCambios,
          provider: aiConfig.provider,
          model: aiConfig.model,
          latencyMs: elapsedMs
        }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/ai/check-gemini-api") {
        const apiKey = String(fields.apiKey || resolveProviderKey(currentConfig, "google") || "").trim();
        const requestedModel = fields.model || currentConfig.model || GEMINI_DEFAULT_MODEL;
        if (!apiKey) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: USER_FRIENDLY_AI_ERROR }));
          return;
        }

        const availableModels = await fetchAvailableGeminiModelsFromGoogle(apiKey);
        const rankedModels = rankGeminiModels([...availableModels]);
        geminiModelsCache.set(apiKey, { at: Date.now(), models: rankedModels, unavailable: new Set() });
        const selectedModel = availableModels.includes(requestedModel) ? requestedModel : (rankedModels[0] || availableModels[0] || requestedModel);

        const updated = saveAiConfig({ provider: "google", apiKey, model: selectedModel });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          provider: "Google Gemini",
          activeModel: selectedModel,
          status: "Operativo",
          statusMessage: `✅ API correcta\n\nProveedor: Google Gemini\nModelo activo: ${selectedModel}\nEstado: Operativo`,
          availableModels,
          config: publicAiConfig(updated)
        }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/presupuestos") {
        let items = readJsonDb(DB_PRESUPUESTOS_FILE, []);
        if (Array.isArray(fields)) {
          items = fields;
        } else if (fields && fields.id) {
          const idx = items.findIndex(i => i.id === fields.id);
          if (idx !== -1) items[idx] = fields;
          else items.unshift(fields);
        }
        writeJsonDb(DB_PRESUPUESTOS_FILE, items);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, count: items.length }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/obras") {
        let items = readJsonDb(DB_OBRAS_FILE, []);
        if (Array.isArray(fields)) {
          items = fields;
        } else if (fields && fields.id) {
          const idx = items.findIndex(i => i.id === fields.id);
          if (idx !== -1) items[idx] = fields;
          else items.unshift(fields);
        }
        writeJsonDb(DB_OBRAS_FILE, items);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, count: items.length }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/clientes") {
        let items = readJsonDb(DB_CLIENTES_FILE, []);
        if (Array.isArray(fields)) {
          items = fields;
        } else if (fields && fields.id) {
          const idx = items.findIndex(i => i.id === fields.id);
          if (idx !== -1) items[idx] = fields;
          else items.unshift(fields);
        }
        writeJsonDb(DB_CLIENTES_FILE, items);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, count: items.length }));
        return;
      }

      if (req.method === "POST" && (pathname === "/api/ai/test-connection" || pathname === "/api/test-connection")) {
        const provider = fields.provider || currentConfig.provider;
        const apiKey = fields.apiKey || resolveProviderKey(currentConfig, provider);
        const model = fields.model || currentConfig.model;
        const startTime = performance.now();

        let rawResponse = "";
        try {
        if (provider === "google") {
          rawResponse = await callGeminiProvider({
            apiKey,
            model,
            contents: [{ role: "user", parts: [{ text: "Responde strictly con JSON: {\"status\": \"PONG\", \"message\": \"Conexión exitosa\"}" }] }]
          });
        } else if (provider === "openai") {
          rawResponse = await callOpenAiProvider({
            apiKey,
            model: model || "gpt-4o-mini",
            messages: [{ role: "user", content: "Responde en JSON: {\"status\": \"PONG\", \"message\": \"Conexión exitosa\"}" }]
          });
        } else if (provider === "anthropic") {
          rawResponse = await callAnthropicProvider({
            apiKey,
            model: model || "claude-haiku-5-5",
            systemPrompt: "Responde sólo en JSON validado.",
            userPrompt: "Responde: {\"status\": \"PONG\", \"message\": \"Conexión exitosa\"}"
          });
        } else if (provider === "openrouter") {
          rawResponse = await callOpenRouterProvider({
            apiKey,
            model: model || "google/gemini-3.8-flash",
            messages: [{ role: "user", content: "Responde en JSON: {\"status\": \"PONG\", \"message\": \"Conexión exitosa\"}" }]
          });
        } else {
          rawResponse = await callGeminiProvider({ apiKey, model, contents: [{ role: "user", parts: [{ text: "{\"status\": \"PONG\"}" }] }] });
        }
        } catch (err) {
          throw aiError(`${provider} (${keyTail(apiKey || "")}): ${explainAiFailure(provider, err.detail || err.message)}`);
        }

        const elapsedMs = Math.round(performance.now() - startTime);
        logAiCall({ provider, model, action: "test-connection", latencyMs: elapsedMs, success: true });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          latencyMs: elapsedMs,
          provider,
          model,
          message: `Conexión exitosa con ${provider} (${model}) en ${elapsedMs}ms`,
          details: JSON.parse(cleanJsonOutput(rawResponse))
        }));
        return;
      }

      if (req.method === "POST" && (pathname === "/api/ai/transcribe" || pathname === "/api/transcribir")) {
        const audioFiles = files.audios || [];
        if (audioFiles.length === 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No se ha adjuntado ningún archivo de audio para transcribir." }));
          return;
        }

        const startTime = performance.now();
        const effectiveConfig = {
          ...currentConfig,
          provider: fields.provider || currentConfig.provider,
          apiKey: fields.apiKey || "",
          model: fields.model || currentConfig.model
        };

        const transcripts = [];
        for (const audioFile of audioFiles) {
          const text = await transcribeAudioUnified({ audioFile, config: effectiveConfig });
          if (text) transcripts.push(text);
        }

        const fullText = transcripts.join("\n\n");
        const elapsedMs = Math.round(performance.now() - startTime);

        logAiCall({
          provider: effectiveConfig.provider,
          model: effectiveConfig.model,
          action: "transcribe",
          latencyMs: elapsedMs,
          success: true,
          tokensUsed: Math.ceil(fullText.length / 4)
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          texto: fullText,
          transcripcion: fullText,
          archivosProcesados: audioFiles.length,
          latencyMs: elapsedMs
        }));
        return;
      }

      if (req.method === "POST" && (pathname === "/api/ai/generate-budget" || pathname === "/api/presupuesto")) {
        const startTime = performance.now();
        const fotos = files.fotos || [];
        const audios = files.audios || [];

        const dictadoTexto = fields.dictado || fields.audioTranscript || fields.notas || fields.transcription || "";
        const medidasNotas = fields.medidasNotas || "";
        const cliente = fields.cliente || "Cliente Particular";
        const direccion = fields.direccion || "Obra";
        const calidades = fields.calidades || "Media-Alta";
        const margenGlobal = Number(fields.margenGlobal) || 28;

        // Paso 1 del asistente: parámetros del cliente y condiciones económicas. Si llegan, deben ser válidos.
        let parametrosCliente = null;
        if (fields.parametrosCliente) {
          try {
            parametrosCliente = typeof fields.parametrosCliente === "string" ? JSON.parse(fields.parametrosCliente) : fields.parametrosCliente;
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Los parámetros del cliente no tienen un formato válido." }));
            return;
          }
          const paramErrors = validateParametrosCliente(parametrosCliente);
          if (paramErrors.length) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: `Parámetros del cliente incompletos: ${paramErrors.join(" ")}` }));
            return;
          }
        }

        let catalogList = [];
        try { if (fields.basePrecios) catalogList = typeof fields.basePrecios === "string" ? JSON.parse(fields.basePrecios) : fields.basePrecios; } catch {}

        let refBudgets = [];
        try { if (fields.referenceBudgets) refBudgets = typeof fields.referenceBudgets === "string" ? JSON.parse(fields.referenceBudgets) : fields.referenceBudgets; } catch {}

        const catalogText = buildPriceBaseText(selectRelevantPrices(catalogList, `${dictadoTexto} ${medidasNotas} ${fields.titulo || ""}`));

        const refBudgetsText = buildReferenceBudgetsText(refBudgets);
        const memoryContext = await buildMemoryContext("presupuesto");
        const tipoIvaRaw = Number(fields.tipoIva);
        const tipoIva = fields.tipoIva !== undefined && fields.tipoIva !== "" && Number.isFinite(tipoIvaRaw) ? tipoIvaRaw : 10;

        const systemInstruction = `
Eres el Ingeniero Técnico de Edificación y Jefe de Presupuestos de la constructora "ObraMaster" (España: LOE, CTE, REBT).
Conviertes lo que el director de obra dicta en la visita (audio transcrito, notas, mensajes, fotos) en un presupuesto profesional ORGANIZADO POR CAPÍTULOS, con la redacción técnica más afinada posible.

CÓMO TRABAJAS:
1. Lee todo el dictado y detecta TODOS los trabajos, incluidos los implícitos (protecciones, demoliciones previas, desescombro y gestión de residuos, rozas y ayudas de albañilería, limpieza final).
2. Agrupa las partidas en capítulos numerados en orden de ejecución de obra (por ejemplo: 01 Actuaciones previas y demoliciones, 02 Albañilería, 03 Fontanería y saneamiento, 04 Electricidad e iluminación, 05 Revestimientos y solados, 06 Carpintería, 07 Pintura, 08 Varios y gestión de residuos). Usa solo los capítulos que correspondan.
3. Cada partida lleva un título corto y una descripción completa en estilo pliego de condiciones: qué se suministra y ejecuta, materiales y calidades, medios auxiliares, preparación del soporte, remates, limpieza y retirada de restos cuando proceda. Nada de lenguaje coloquial.
4. Unidades normalizadas (m2, ml, ud, pa, m3, kg). Usa las mediciones dictadas; si falta alguna, estima con criterio y dilo en "observaciones_tecnicas".
5. Precios: la BASE DE PRECIOS DE LA EMPRESA es la fuente principal y sale de presupuestos reales de sus gremios. Si una partida coincide (aunque se redacte distinto) con una de la base, usa su coste como "costeUnitario" y su margen como "margenPct", ajustando solo si cambia la unidad o el alcance, y pon su código en "codigoBase". Si una partida no está en la base, estima un coste realista de mercado en España, deja "codigoBase" vacío y cítala en "observaciones_tecnicas" como precio estimado. "precioVenta" = costeUnitario × (1 + margenPct/100).
6. IMITA el estilo, la estructura de capítulos, la forma de numerar y el vocabulario de los presupuestos de referencia de la empresa y obedece la memoria de la IA (instrucciones del director, aprendizajes y correcciones). Tienen prioridad sobre estas pautas generales.
7. "margenPct" por defecto es el margen objetivo indicado en los datos de obra.

Devuelve SOLO un JSON válido con esta estructura:
{
  "resumen_obra": "Resumen técnico del alcance (2-4 frases)",
  "observaciones_tecnicas": ["Supuestos, mediciones estimadas, riesgos o aspectos a confirmar"],
  "capitulos": [
    {
      "codigo_capitulo": "01",
      "nombre_capitulo": "ACTUACIONES PREVIAS Y DEMOLICIONES",
      "partidas": [
        {
          "codigo": "01.01",
          "titulo": "Demolición de tabique cerámico",
          "descripcion": "Demolición de tabique de ladrillo hueco doble de hasta 10 cm de espesor con medios manuales, incluso ...",
          "unidad": "m2",
          "cantidad": 14.5,
          "costeUnitario": 12.5,
          "margenPct": 28,
          "precioVenta": 16.0,
          "codigoBase": "DEM-01"
        }
      ]
    }
  ]
}

${refBudgetsText ? `PRESUPUESTOS DE REFERENCIA DE LA EMPRESA (modelo de estilo y estructura):\n${refBudgetsText}\n` : ""}
${memoryContext}
`;

        const userPrompt = `
DATOS DE OBRA:
- Obra: ${fields.titulo || "Reforma"} | Cliente: ${cliente} | Ubicación: ${direccion}
- Calidades: ${calidades} | Margen objetivo: ${margenGlobal}% | IVA: ${tipoIva}%${fields.plazo ? ` | Plazo deseado: ${fields.plazo}` : ""}
${parametrosCliente ? `
PARÁMETROS DEL CLIENTE Y CONDICIONES ECONÓMICAS (validados, obligatorios):
- Tipo de cliente: ${parametrosCliente.tipoClienteLabel || parametrosCliente.tipoCliente}${parametrosCliente.nif ? ` | NIF/CIF: ${parametrosCliente.nif}` : ""}
- Margen comercial: ${parametrosCliente.margenComercialPct}% (úsalo como "margenPct" salvo que la base de precios fije otro para esa partida)
- Condiciones de pago: ${parametrosCliente.condicionesPago}
- Fiscalidad: ${parametrosCliente.fiscalidadLabel || parametrosCliente.fiscalidad}${parametrosCliente.retencionIrpfPct ? ` | Retención IRPF estimada: ${parametrosCliente.retencionIrpfPct}%` : ""}
- Validez de la oferta: ${parametrosCliente.validezDias || 30} días
Ten en cuenta estos parámetros en la propuesta económica y añade en "observaciones_tecnicas" cualquier aspecto fiscal a confirmar (por ejemplo, el límite del 40% de materiales con IVA reducido o la mención de inversión del sujeto pasivo).
` : ""}
DICTADO DE LA VISITA (AUDIO TRANSCRITO Y NOTAS):
"""
${dictadoTexto || "Sin dictado: analiza las evidencias adjuntas."}
${medidasNotas ? `\nMediciones y anotaciones:\n${medidasNotas}` : ""}
"""
${fotos.length ? `\nSe adjuntan ${fotos.length} foto(s) del estado actual.\n` : ""}
${catalogText ? `BASE DE PRECIOS DE LA EMPRESA (coste de gremio, margen de la empresa y PVP):\n${catalogText}\n` : ""}
`;

        const effectiveConfig = {
          ...configWithRequestKey(currentConfig, fields),
          temperature: currentConfig.temperature || 0.15,
          maxTokens: Math.max(Number(currentConfig.maxTokens) || 0, 32768)
        };

        const rawOutput = await callActiveProvider({
          config: effectiveConfig,
          systemInstruction,
          userPrompt,
          temperature: effectiveConfig.temperature,
          maxTokens: effectiveConfig.maxTokens,
          geminiParts: [...audios.map(fileToPart), ...fotos.map(fileToPart)]
        });

        const elapsedMs = Math.round(performance.now() - startTime);
        const parsed = parseAiJson(rawOutput);

        logAiCall({
          provider: effectiveConfig.provider,
          model: effectiveConfig.model,
          action: "generate-budget",
          latencyMs: elapsedMs,
          success: true,
          tokensUsed: Math.ceil((userPrompt.length + rawOutput.length) / 4)
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(parsed));
        return;
      }

      // Presupuesto de un gremio (PDF, imagen o texto): extrae sus partidas con el precio de coste
      // para revisarlas y aplicarlas a la base de precios con el margen de la empresa.
      if (req.method === "POST" && pathname === "/api/ai/price-sources/extract") {
        const startTime = performance.now();
        const providedText = String(fields.texto || fields.text || "").slice(0, 30000);
        const documentos = [...(files.documento || []), ...(files.fotos || [])]
          .filter(f => /pdf|image\//i.test(fileToPart(f).inlineData.mimeType));
        if (!documentos.length && providedText.trim().length < 10) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Adjunta un PDF o una imagen del presupuesto, o pega su texto." }));
          return;
        }

        const systemInstruction = `
Eres el Jefe de Compras de una constructora española. Lees el presupuesto o la tarifa que envía un gremio o subcontrata y extraes TODAS sus partidas con el precio unitario que cobra el gremio (precio de coste para la constructora).
Reglas:
- Una partida por cada línea con precio. No inventes partidas ni precios: si una línea no tiene precio unitario, omítela.
- "precio" es el precio UNITARIO sin IVA. Si solo aparece el importe total y la cantidad, divide. Si los precios llevan IVA, quítalo y dilo en "avisos".
- Respeta la unidad del documento normalizada (m2, ml, ud, pa, m3, kg, h).
- "concepto": descripción técnica completa y clara de la partida, en español, sin datos del cliente.
- "codigo": el del documento si existe; si no, déjalo vacío.
Devuelve SOLO un JSON válido:
{
  "subcontrata": "Nombre del gremio o empresa emisora, si aparece",
  "gremio": "Oficio principal (Albañilería, Fontanería, Electricidad, Carpintería, Pintura, Climatización...)",
  "fecha": "AAAA-MM-DD si aparece",
  "resumen": "1-2 frases sobre lo que cubre el documento",
  "avisos": ["Dudas de lectura, IVA incluido, partidas ambiguas..."],
  "partidas": [
    { "codigo": "", "capitulo": "Fontanería", "concepto": "Punto de agua fría y caliente con tubería multicapa", "unidad": "ud", "precio": 65.0 }
  ]
}`;

        const userPrompt = `GREMIO INDICADO: ${fields.gremio || "sin indicar"} | SUBCONTRATA INDICADA: ${fields.subcontrata || "sin indicar"}
${documentos.length ? `Se adjuntan ${documentos.length} documento(s) (PDF o imagen) con los precios.` : ""}
${providedText.trim() ? `TEXTO CON PRECIOS:\n"""\n${providedText}\n"""` : ""}`;

        const rawOutput = await callActiveProvider({
          config: currentConfig,
          systemInstruction,
          userPrompt,
          temperature: 0.05,
          maxTokens: 16384,
          attachments: documentos.map(fileToPart)
        });

        const parsed = parseAiJson(rawOutput);
        const partidas = (Array.isArray(parsed.partidas) ? parsed.partidas : [])
          .map(p => ({
            codigo: String(p.codigo || "").trim(),
            capitulo: String(p.capitulo || parsed.gremio || fields.gremio || "").trim(),
            concepto: String(p.concepto || p.titulo || "").trim(),
            unidad: String(p.unidad || "ud").trim(),
            precio: Number(String(p.precio ?? p.precioUnitario ?? "").toString().replace(",", "."))
          }))
          .filter(p => p.concepto && Number.isFinite(p.precio) && p.precio > 0);
        if (!partidas.length) throw aiError("La IA no encontró partidas con precio en el documento.");

        logAiCall({
          provider: currentConfig.provider,
          model: currentConfig.model,
          action: "extract-prices",
          latencyMs: Math.round(performance.now() - startTime),
          success: true,
          tokensUsed: Math.ceil((userPrompt.length + rawOutput.length) / 4)
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          subcontrata: String(parsed.subcontrata || fields.subcontrata || "").trim(),
          gremio: String(parsed.gremio || fields.gremio || "").trim(),
          fecha: String(parsed.fecha || "").trim(),
          resumen: String(parsed.resumen || "").trim(),
          avisos: Array.isArray(parsed.avisos) ? parsed.avisos.map(String) : [],
          partidas
        }));
        return;
      }

      // Análisis único de un presupuesto de referencia (Ajustes > Presupuestos modelo).
      // Extrae lo que la IA debe aprender (estructura, estilo, vocabulario) y lo guarda en la memoria de la IA.
      if (req.method === "POST" && pathname === "/api/ai/reference-budgets/analyze") {
        const startTime = performance.now();
        const name = String(fields.name || "Presupuesto de referencia").slice(0, 90);
        const tipoObra = fields.tipoObra || fields.tipo_obra || "";
        const providedText = String(fields.text || fields.extracted_text || "");
        const pdfFile = (files.pdf || files.file || [])[0] || null;

        const isPlaceholderText = providedText.includes("[PRESUPUESTO MODELO DE REFERENCIA EXTRAÍDO") || providedText.startsWith("[DOCUMENTO PDF:");
        if (!pdfFile && (providedText.trim().length < 40 || isPlaceholderText)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No se pudo leer el texto de este PDF. Bórralo y vuelve a subirlo (la IA lo lee entero al subirlo), o pega su contenido con el botón del ojo." }));
          return;
        }

        const systemInstruction = `
Eres el Jefe de Presupuestos de la constructora "ObraMaster". Analizas un presupuesto real de la empresa para que la IA aprenda a redactar los próximos igual.
Devuelve SOLO un JSON válido:
{
  "texto_extraido": "Contenido del presupuesto en texto plano: capítulos, códigos, títulos y descripciones completas de partidas con sus unidades (sin precios si no aportan). Máximo 6000 caracteres.",
  "aprendizajes": "Lista de 10 a 30 pautas concretas y reutilizables, una por línea empezando por '- ', sobre: estructura y orden de capítulos, numeración de capítulos y partidas, cómo se redactan títulos y descripciones (frases tipo, nivel de detalle, materiales y marcas, medios auxiliares, residuos), unidades, condiciones generales y cualquier costumbre propia de la empresa. Nada de datos del cliente.",
  "capitulos_detectados": ["01 ...", "02 ..."]
}`;

        const userPrompt = `PRESUPUESTO DE REFERENCIA: ${name}${tipoObra ? ` (${tipoObra})` : ""}
${pdfFile ? "Se adjunta el PDF original." : ""}
${providedText.trim() ? `TEXTO DISPONIBLE:\n"""\n${providedText.slice(0, 20000)}\n"""` : ""}`;

        // El PDF solo lo lee Gemini; con otro proveedor se analiza el texto extraído.
        const geminiKey = resolveProviderKey(currentConfig, "google");
        const analysisConfig = pdfFile && geminiKey ? { ...currentConfig, provider: "google" } : currentConfig;
        const rawOutput = await callActiveProvider({
          config: analysisConfig,
          systemInstruction,
          userPrompt,
          temperature: 0.1,
          maxTokens: 16384,
          geminiParts: pdfFile ? [fileToPart(pdfFile)] : []
        });

        let parsed = {};
        try { parsed = JSON.parse(cleanJsonOutput(rawOutput)); } catch { parsed = { aprendizajes: rawOutput.trim() }; }
        const learnings = String(parsed.aprendizajes || "").trim();
        if (!learnings) throw new Error("La IA no devolvió aprendizajes del presupuesto.");

        const saved = await saveReferenceLearning({
          memoryId: fields.memoryId || "",
          title: `Presupuesto de referencia: ${name}`,
          content: `Aprendido del presupuesto "${name}"${tipoObra ? ` (${tipoObra})` : ""}:\n${learnings}`
        });

        logAiCall({
          provider: analysisConfig.provider,
          model: analysisConfig.model,
          action: "analyze-reference-budget",
          latencyMs: Math.round(performance.now() - startTime),
          success: true,
          tokensUsed: Math.ceil((userPrompt.length + rawOutput.length) / 4)
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          memoryId: saved?.id || null,
          learnings,
          extractedText: String(parsed.texto_extraido || "").trim(),
          chapters: Array.isArray(parsed.capitulos_detectados) ? parsed.capitulos_detectados : []
        }));
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Endpoint no encontrado: ${pathname}` }));
    } catch (err) {
      console.error("[Backend AI Exception]", err);
      const safeConfig = typeof currentConfig !== "undefined" ? currentConfig : getSavedAiConfig();
      logAiCall({
        provider: safeConfig?.provider || "google",
        model: safeConfig?.model || GEMINI_DEFAULT_MODEL,
        action: pathname,
        latencyMs: 0,
        success: false,
        error: err.message
      });

      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: err.detail ? `${USER_FRIENDLY_AI_ERROR} Detalle: ${err.detail}` : USER_FRIENDLY_AI_ERROR
      }));
    }
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error("[Backend] Error no controlado:", err?.message || err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Error interno del servidor." }));
    }
  });
});
// Corta peticiones lentas o colgadas (ataques tipo "slowloris").
server.headersTimeout = 30 * 1000;
server.requestTimeout = 5 * 60 * 1000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ObraMaster AI SaaS Server activo en puerto: ${PORT}`);
  console.log(`📡 CORS: ${process.env.CORS_ORIGIN || "solo el mismo dominio"}`);
  console.log(`🧠 Motor IA por defecto: ${getSavedAiConfig().provider} (${getSavedAiConfig().model})`);
  console.log(`====================================================`);
  // Cola de envío de registros VeriFactu a la AEAT (solo empresas con el envío activado).
  iniciarColaVerifactu();
});
