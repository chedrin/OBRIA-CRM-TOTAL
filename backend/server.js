/**
 * ObraMaster - Backend Proxy Multimodal de Inteligencia Artificial & Persistencia SaaS
 * 
 * Arquitectura de Producción SaaS:
 * - Centralización 100% de proveedores de IA (Google Gemini, OpenAI, Anthropic Claude, OpenRouter, Azure OpenAI).
 * - Persistencia de datos en disco (db_presupuestos.json, db_obras.json, db_clientes.json, ai_settings.json, ai_audit_log.json).
 * - Centralized Gemini models with fallback cascade: gemini-1.5-flash -> gemini-3.8-flash -> gemini-1.5-pro
 * - Dynamic model discovery via `/api/ai/check-gemini-api`
 * - User-friendly error messages (sanitizing raw Google API error output)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleAuthRoutes, enforceApiAuth } from "./authRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_FRIENDLY_AI_ERROR = "No ha sido posible conectar con la IA. Revise la configuración de la API o seleccione un modelo válido.";
const GEMINI_DEFAULT_MODEL = "gemini-1.5-flash";
const GEMINI_FALLBACK_CASCADE = ["gemini-1.5-flash", "gemini-3.8-flash", "gemini-1.5-pro"];

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
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

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
    openRouterModel: process.env.OPENROUTER_MODEL || "google/gemini-1.5-flash",
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

  const updatedApiKeys = {
    google: newKeys.google !== undefined ? newKeys.google : (newConfig.googleApiKey !== undefined ? newConfig.googleApiKey : (currentKeys.google || "")),
    openai: newKeys.openai !== undefined ? newKeys.openai : (newConfig.openaiApiKey !== undefined ? newConfig.openaiApiKey : (currentKeys.openai || "")),
    anthropic: newKeys.anthropic !== undefined ? newKeys.anthropic : (newConfig.anthropicApiKey !== undefined ? newConfig.anthropicApiKey : (currentKeys.anthropic || "")),
    openrouter: newKeys.openrouter !== undefined ? newKeys.openrouter : (newConfig.openrouterApiKey !== undefined ? newConfig.openrouterApiKey : (currentKeys.openrouter || ""))
  };

  const provider = newConfig.provider || current.provider || "google";

  if (newConfig.apiKey !== undefined && newConfig.apiKey.trim() !== "") {
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
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Backend Settings] No se pudo escribir ai_settings.json:", err.message);
  }

  return updated;
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

function fileToPart(file) {
  let mimeType = file.mimetype || "application/octet-stream";
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
  }

  return {
    inlineData: {
      mimeType,
      data: file.buffer.toString("base64")
    }
  };
}

async function callGeminiProvider({ apiKey, model, contents, systemInstruction, temperature = 0.15, maxTokens = 4096, responseMimeType = "application/json" }) {
  const effectiveKey = (apiKey || process.env.GEMINI_API_KEY || "").trim();
  if (!effectiveKey) {
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }

  let preferredModel = model || GEMINI_DEFAULT_MODEL;

  const modelsToTry = [preferredModel];
  for (const m of GEMINI_FALLBACK_CASCADE) {
    if (!modelsToTry.includes(m)) modelsToTry.push(m);
  }

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

  let lastTechnicalError = "";

  for (const targetModel of modelsToTry) {
    const url = `${baseUrl}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(effectiveKey)}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) return rawText;
      }

      let errText = await response.text();
      try { errText = JSON.parse(errText).error?.message || errText; } catch {}
      console.error(`[Backend Gemini Error] Modelo "${targetModel}" HTTP ${response.status}: ${errText}`);
      lastTechnicalError = `[${targetModel}] HTTP ${response.status}: ${errText}`;

      if (response.status === 404 || errText.includes("not found") || errText.includes("is not supported")) {
        console.warn(`[Backend Gemini Cascade] Reintentando con siguiente modelo por error 404 en ${targetModel}...`);
        continue;
      }

      break;
    } catch (netErr) {
      console.error(`[Backend Gemini Exception] Modelo "${targetModel}":`, netErr.message);
      lastTechnicalError = netErr.message;
      continue;
    }
  }

  console.error("[Backend Gemini Fallback Failed] Detalle técnico interno:", lastTechnicalError);
  throw new Error(USER_FRIENDLY_AI_ERROR);
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
  if (!effectiveKey) throw new Error(USER_FRIENDLY_AI_ERROR);

  const url = "https://api.openai.com/v1/chat/completions";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${effectiveKey}`
      },
      body: JSON.stringify({
        model: model || "gpt-4o",
        messages,
        response_format: { type: "json_object" },
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      let errText = await response.text();
      try { errText = JSON.parse(errText).error?.message || errText; } catch {}
      console.error(`[OpenAI Error] HTTP ${response.status}: ${errText}`);
      throw new Error(USER_FRIENDLY_AI_ERROR);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(USER_FRIENDLY_AI_ERROR);
    return content;
  } catch (err) {
    console.error("[OpenAI Provider Exception]", err);
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }
}

async function callAnthropicProvider({ apiKey, model, systemPrompt, userPrompt, temperature = 0.15, maxTokens = 4096 }) {
  const effectiveKey = (apiKey || process.env.ANTHROPIC_API_KEY || "").trim();
  if (!effectiveKey) throw new Error(USER_FRIENDLY_AI_ERROR);

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
        model: model || "claude-3-5-sonnet-20241022",
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: maxTokens,
        temperature
      })
    });

    if (!response.ok) {
      let errText = await response.text();
      try { errText = JSON.parse(errText).error?.message || errText; } catch {}
      console.error(`[Anthropic Error] HTTP ${response.status}: ${errText}`);
      throw new Error(USER_FRIENDLY_AI_ERROR);
    }

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === "text")?.text || "";
    if (!textBlock) throw new Error(USER_FRIENDLY_AI_ERROR);
    return textBlock;
  } catch (err) {
    console.error("[Anthropic Provider Exception]", err);
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }
}

async function callOpenRouterProvider({ apiKey, model, messages, temperature = 0.15, maxTokens = 4096 }) {
  const effectiveKey = (apiKey || process.env.OPENROUTER_API_KEY || "").trim();
  if (!effectiveKey) throw new Error(USER_FRIENDLY_AI_ERROR);

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
        model: model || "google/gemini-1.5-flash",
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      let errText = await response.text();
      try { errText = JSON.parse(errText).error?.message || errText; } catch {}
      console.error(`[OpenRouter Error] HTTP ${response.status}: ${errText}`);
      throw new Error(USER_FRIENDLY_AI_ERROR);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(USER_FRIENDLY_AI_ERROR);
    return content;
  } catch (err) {
    console.error("[OpenRouter Provider Exception]", err);
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }
}

// Transcripción de Audio Robusta
async function transcribeAudioUnified({ audioFile, config }) {
  const provider = (config.provider || "google").toLowerCase();
  const apiKey = (config.apiKey || "").trim();

  if ((provider === "openai" || apiKey.startsWith("sk-")) && !apiKey.startsWith("sk-ant") && !apiKey.startsWith("sk-or")) {
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

    const payloadBuffer = Buffer.concat(bodyParts);
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Authorization": `Bearer ${apiKey}`
      },
      body: payloadBuffer
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

  const geminiKey = ((apiKey && !apiKey.startsWith("sk-ant") && !apiKey.startsWith("sk-or")) ? apiKey : process.env.GEMINI_API_KEY || "").trim();
  if (geminiKey || provider === "google") {
    const part = fileToPart(audioFile);
    const promptText = `
Eres un transcriptor experto en construcción y arquitectura técnica de "ObraMaster".
Escucha el audio adjunto y transcribe fielmente todo lo dicho en español, corrigiendo términos de obra (alicatados, rozas, falsos techos, etc.).

Devuelve strictly un JSON válido con esta estructura exacta:
{"transcripcion": "Texto fiel y literal en español"}
`;
    const rawText = await callGeminiProvider({
      apiKey: geminiKey || process.env.GEMINI_API_KEY,
      model: config.model || GEMINI_DEFAULT_MODEL,
      contents: [{ role: "user", parts: [{ text: promptText }, part] }],
      temperature: 0.1,
      responseMimeType: "application/json"
    });

    try {
      const cleaned = cleanJsonOutput(rawText);
      if (!cleaned || cleaned === "{}") {
        return rawText ? rawText.trim() : "";
      }
      const parsed = JSON.parse(cleaned);
      return parsed.transcripcion || parsed.texto || rawText.trim() || "";
    } catch (parseErr) {
      console.warn("[Backend Gemini Transcribe] Fallo al parsear JSON, usando texto raw:", parseErr.message);
      return rawText ? rawText.trim() : "";
    }
  }

  throw new Error(USER_FRIENDLY_AI_ERROR);
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

  let relativePath = pathname === "/" ? "/index.html" : pathname;
  let safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
  let filePath = path.join(DIST_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  const indexPath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexPath) && !path.extname(pathname)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
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
  const originHeader = req.headers.origin || (CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Origin", originHeader);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, x-api-key");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

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

  // Login y gestión de usuarios (Supabase Auth)
  if (await handleAuthRoutes(req, res, pathname)) return;

  // Resto de la API: exige sesión válida (administradores; obreros solo en rutas permitidas)
  if (!(await enforceApiAuth(req, res, pathname))) return;

  // Endpoints GET
  if (req.method === "GET") {
    if (pathname === "/api/health") {
      const config = getSavedAiConfig();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "online",
        service: "ObraMaster AI SaaS Production Backend",
        port: PORT,
        activeProvider: config.provider,
        activeModel: config.model,
        hasKeyConfigured: Boolean(config.apiKey && config.apiKey.length > 5),
        timestamp: new Date().toISOString()
      }));
      return;
    }

    if (pathname === "/api/settings/ai") {
      const config = getSavedAiConfig();
      const apiKeys = config.apiKeys || {};
      const mask = k => k ? (k.substring(0, 6) + "..." + k.slice(-4)) : "";
      const maskedKeys = {
        google: mask(apiKeys.google),
        openai: mask(apiKeys.openai),
        anthropic: mask(apiKeys.anthropic),
        openrouter: mask(apiKeys.openrouter)
      };
      const activeKey = apiKeys[config.provider] || config.apiKey || "";
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ...config,
        apiKey: activeKey,
        apiKeyMasked: mask(activeKey),
        apiKeysMasked: maskedKeys
      }));
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

  // Leer cuerpo para POST / PUT
  const chunks = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", async () => {
    const bodyBuffer = Buffer.concat(chunks);
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

    const currentConfig = getSavedAiConfig();

    try {
      if (req.method === "PUT" && pathname === "/api/settings/ai") {
        const updated = saveAiConfig(fields);
        const apiKeys = updated.apiKeys || {};
        const mask = k => k ? (k.substring(0, 6) + "..." + k.slice(-4)) : "";
        const maskedKeys = {
          google: mask(apiKeys.google),
          openai: mask(apiKeys.openai),
          anthropic: mask(apiKeys.anthropic),
          openrouter: mask(apiKeys.openrouter)
        };
        const activeKey = apiKeys[updated.provider] || updated.apiKey || "";

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          message: "Configuración del motor de IA actualizada correctamente",
          config: {
            ...updated,
            apiKey: activeKey,
            apiKeyMasked: mask(activeKey),
            apiKeysMasked: maskedKeys
          }
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

        const refBudgetsText = (refBudgets || [])
          .filter(r => r.is_active !== false)
          .slice(0, 5)
          .map((r, idx) => `=== EJEMPLO MODELO DE EMPRESA ${idx + 1}: ${r.name || "Presupuesto Modelo"} ===\n${(r.extracted_text || r.text_content || "").substring(0, 2000)}`)
          .join("\n\n");

        const targetProvider = fields.provider || currentConfig.provider || "google";
        const targetKeys = currentConfig.apiKeys || {};
        let targetApiKey = fields.apiKey || targetKeys[targetProvider] || currentConfig.apiKey;
        if (!targetApiKey) {
          if (targetProvider === "google") targetApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
          else if (targetProvider === "openai") targetApiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || "";
          else if (targetProvider === "anthropic") targetApiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || "";
          else if (targetProvider === "openrouter") targetApiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || "";
        }
        const targetModel = fields.model || currentConfig.model;

        const systemInstruction = `
Eres un Ingeniero Técnico de Edificación y Jefe de Obra experto de "ObraMaster".
Tu objetivo es reescribir y mejorar borradores o descripciones de trabajos/partidas de presupuesto escritas por el usuario, convirtiéndolas al lenguaje profesional de un constructor o reformista, con la terminología técnica precisa del sector de la edificación (pliegos de condiciones, normativa CTE, saneado de soportes, medios auxiliares, imprimaciones, unidades normalizadas m2/ml/ud/pa, etc.).

${refBudgetsText ? `PRESUPUESTOS Y EJEMPLOS DE REFERENCIA DE LA EMPRESA:\nUtiliza los siguientes ejemplos como referencia obligatoria de estilo, tono, formato y vocabulario técnico. Imita su forma de redactar:\n\n${refBudgetsText}\n` : ""}

Devuelve STRICTLY un JSON válido con esta estructura exacta:
{
  "textoMejorado": "Texto completo reescrito en lenguaje técnico profesional de construcción y reformas",
  "explicacionCambios": "Breve resumen ejecutivo de las mejoras técnicas y vocabulario introducido (1 frase)"
}
`;

        const userPrompt = `
TEXTO DRAFT ORIGINAL A MEJORAR Y REESCRIBIR (${context}):
"""
${textToImprove.trim()}
"""
`;

        let rawOutput = "";
        if (targetProvider === "google") {
          rawOutput = await callGeminiProvider({
            apiKey: targetApiKey,
            model: targetModel,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            systemInstruction,
            temperature: 0.2
          });
        } else if (targetProvider === "openai") {
          rawOutput = await callOpenAiProvider({
            apiKey: targetApiKey,
            model: targetModel || "gpt-4o",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.2
          });
        } else if (targetProvider === "anthropic") {
          rawOutput = await callAnthropicProvider({
            apiKey: targetApiKey,
            model: targetModel || "claude-3-5-sonnet-20241022",
            systemPrompt: systemInstruction,
            userPrompt,
            temperature: 0.2
          });
        } else if (targetProvider === "openrouter") {
          rawOutput = await callOpenRouterProvider({
            apiKey: targetApiKey,
            model: targetModel || "google/gemini-1.5-flash",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.2
          });
        } else {
          rawOutput = await callGeminiProvider({
            apiKey: targetApiKey,
            model: targetModel,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            systemInstruction,
            temperature: 0.2
          });
        }

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
          provider: targetProvider,
          model: targetModel,
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
          provider: targetProvider,
          model: targetModel,
          latencyMs: elapsedMs
        }));
        return;
      }

      if (req.method === "POST" && pathname === "/api/ai/check-gemini-api") {
        const apiKey = (fields.apiKey || currentConfig.apiKey || "").trim();
        const requestedModel = fields.model || currentConfig.model || GEMINI_DEFAULT_MODEL;
        if (!apiKey) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: USER_FRIENDLY_AI_ERROR }));
          return;
        }

        const availableModels = await fetchAvailableGeminiModelsFromGoogle(apiKey);
        let selectedModel = availableModels.includes(requestedModel) ? requestedModel : GEMINI_FALLBACK_CASCADE.find(m => availableModels.includes(m));
        if (!selectedModel) {
          selectedModel = availableModels.find(id => id.includes("flash")) || availableModels[0] || requestedModel;
        }

        const updated = saveAiConfig({ provider: "google", apiKey, model: selectedModel });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          provider: "Google Gemini",
          activeModel: selectedModel,
          status: "Operativo",
          statusMessage: `✅ API correcta\n\nProveedor: Google Gemini\nModelo activo: ${selectedModel}\nEstado: Operativo`,
          availableModels,
          config: {
            ...updated,
            apiKeyMasked: updated.apiKey ? (updated.apiKey.substring(0, 6) + "..." + updated.apiKey.slice(-4)) : ""
          }
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
        const apiKey = fields.apiKey || currentConfig.apiKey;
        const model = fields.model || currentConfig.model;
        const startTime = performance.now();

        let rawResponse = "";
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
            model: model || "claude-3-5-haiku-20241022",
            systemPrompt: "Responde sólo en JSON validado.",
            userPrompt: "Responde: {\"status\": \"PONG\", \"message\": \"Conexión exitosa\"}"
          });
        } else if (provider === "openrouter") {
          rawResponse = await callOpenRouterProvider({
            apiKey,
            model: model || "google/gemini-1.5-flash",
            messages: [{ role: "user", content: "Responde en JSON: {\"status\": \"PONG\", \"message\": \"Conexión exitosa\"}" }]
          });
        } else {
          rawResponse = await callGeminiProvider({ apiKey, model, contents: [{ role: "user", parts: [{ text: "{\"status\": \"PONG\"}" }] }] });
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
          provider: fields.provider || currentConfig.provider,
          apiKey: fields.apiKey || currentConfig.apiKey,
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

        let catalogList = [];
        try { if (fields.basePrecios) catalogList = typeof fields.basePrecios === "string" ? JSON.parse(fields.basePrecios) : fields.basePrecios; } catch {}

        let refBudgets = [];
        try { if (fields.referenceBudgets) refBudgets = typeof fields.referenceBudgets === "string" ? JSON.parse(fields.referenceBudgets) : fields.referenceBudgets; } catch {}

        const catalogText = (catalogList || [])
          .slice(0, 30)
          .map(p => `- [${p.codigo || "GEN"}]: ${p.concepto || p.titulo} | Coste: ${p.costeUnitario || 20}€ | PVP: ${p.precioVenta || 28}€ / ${p.unidad || "ud"}`)
          .join("\n");

        const refBudgetsText = (refBudgets || [])
          .filter(r => r.is_active !== false)
          .slice(0, 3)
          .map((r, idx) => `=== MODELO EMPRESA ${idx + 1}: ${r.name || "Presupuesto Modelo"} ===\n${(r.text_content || "").substring(0, 2000)}`)
          .join("\n\n");

        const systemInstruction = `
Eres el Ingeniero Técnico de Edificación y Jefe de Presupuestos de la constructora "ObraMaster".
Genera un presupuesto técnico detallado, profesional y riguroso en formato JSON estricto:
{
  "resumen_obra": "Resumen ejecutivo del alcance físico de los trabajos...",
  "capitulos": [
    {
      "codigo_capitulo": "01",
      "nombre_capitulo": "01. Demoliciones y Gestión de Residuos",
      "partidas": [
        {
          "codigo": "DEM-01",
          "concepto": "Demolición de tabique cerámico...",
          "cantidad": 14.5,
          "unidad": "m2",
          "costeUnitario": 12.50,
          "margenPct": ${margenGlobal},
          "precioVenta": 16.00,
          "total": 232.00
        }
      ]
    }
  ]
}
`;

        const userPrompt = `
DATOS DE OBRA:
- Cliente: ${cliente} | Ubicación: ${direccion} | Calidades: ${calidades} | Margen: ${margenGlobal}%

TRANSCRIPCIÓN O NOTAS TÉCNICAS RECIBIDAS:
"""
${dictadoTexto || "Procesar evidencias adjuntas."}
${medidasNotas ? `\nMediciones:\n${medidasNotas}` : ""}
"""

${catalogText ? `BASE DE PRECIOS OFICIAL DE EMPRESA:\n${catalogText}\n` : ""}
${refBudgetsText ? `MODELOS DE REFERENCIA:\n${refBudgetsText}\n` : ""}
`;

        const effectiveConfig = {
          provider: fields.provider || currentConfig.provider,
          apiKey: fields.apiKey || currentConfig.apiKey,
          model: fields.model || currentConfig.model,
          temperature: currentConfig.temperature || 0.15,
          maxTokens: currentConfig.maxTokens || 4096
        };

        let rawOutput = "";
        if (effectiveConfig.provider === "google") {
          const fotoParts = fotos.map(fileToPart);
          const audioParts = audios.map(fileToPart);
          rawOutput = await callGeminiProvider({
            apiKey: effectiveConfig.apiKey,
            model: effectiveConfig.model,
            contents: [{ role: "user", parts: [{ text: userPrompt }, ...audioParts, ...fotoParts] }],
            systemInstruction,
            temperature: effectiveConfig.temperature,
            maxTokens: effectiveConfig.maxTokens
          });
        } else if (effectiveConfig.provider === "openai") {
          rawOutput = await callOpenAiProvider({
            apiKey: effectiveConfig.apiKey,
            model: effectiveConfig.model || "gpt-4o",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt }
            ],
            temperature: effectiveConfig.temperature,
            maxTokens: effectiveConfig.maxTokens
          });
        } else if (effectiveConfig.provider === "anthropic") {
          rawOutput = await callAnthropicProvider({
            apiKey: effectiveConfig.apiKey,
            model: effectiveConfig.model || "claude-3-5-sonnet-20241022",
            systemPrompt: systemInstruction,
            userPrompt,
            temperature: effectiveConfig.temperature,
            maxTokens: effectiveConfig.maxTokens
          });
        } else if (effectiveConfig.provider === "openrouter") {
          rawOutput = await callOpenRouterProvider({
            apiKey: effectiveConfig.apiKey,
            model: effectiveConfig.model || "google/gemini-1.5-flash",
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt }
            ],
            temperature: effectiveConfig.temperature,
            maxTokens: effectiveConfig.maxTokens
          });
        } else {
          rawOutput = await callGeminiProvider({
            apiKey: effectiveConfig.apiKey,
            model: effectiveConfig.model,
            contents: [{ role: "user", parts: [{ text: userPrompt }] }]
          });
        }

        const elapsedMs = Math.round(performance.now() - startTime);
        const parsed = JSON.parse(cleanJsonOutput(rawOutput));

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
      res.end(JSON.stringify({ error: USER_FRIENDLY_AI_ERROR }));
    }
  });
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ObraMaster AI SaaS Server activo en puerto: ${PORT}`);
  console.log(`📡 CORS permitido para: ${CORS_ORIGIN}`);
  console.log(`🧠 Motor IA por defecto: ${getSavedAiConfig().provider} (${getSavedAiConfig().model})`);
  console.log(`====================================================`);
});
