/**
 * ObraMaster - Google Gemini AI Service
 * 
 * Centralized Gemini API integration featuring:
 * 1. Official @google/genai SDK support
 * 2. Credential provider: Fetches API Key from Supabase (`ai_integration_settings` / `company_settings`)
 *    (the key is no longer read from VITE_* variables: it lives on the server as GEMINI_API_KEY).
 * 3. 100% Dynamic Model Auto-Discovery via `GET /v1beta/models`:
 *    - Calls ListModels from Google Gemini API
 *    - Filters models supporting "generateContent"
 *    - Priority 1: Selects the best available model with "flash" in its name (e.g., gemini-1.5-flash, gemini-1.5-flash-latest, gemini-2.0-flash)
 *    - Priority 2: Fallback to first compatible generateContent model
 *    - Cleans model name with `.replace(/^models\//, '')`
 * 4. Connection Ping against detectedModel:
 *    `POST https://generativelanguage.googleapis.com/v1beta/models/${detectedModel}:generateContent?key=${apiKey}`
 *    Body: `{ "contents": [{ "parts": [{ "text": "ping" }] }] }`
 * 5. Detailed console logging and robust error handling for 401, 403, 429, and timeouts.
 */

import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabaseClient';
import { buildGeminiSystemPromptWithReferences } from './referenceBudgetService';

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const USER_FRIENDLY_AI_ERROR = 'No ha sido posible conectar con la IA. Revise la configuración de la API o seleccione un modelo válido.';

/**
 * Resolves Gemini API key with priority:
 * 1. Custom provided key
 * 2. Supabase DB (`ai_integration_settings` or `company_settings`)
 * 3. (removed) VITE_* variables are public in the browser bundle
 */
export async function getGeminiApiKey(customKey = '') {
  const cleanCustom = (customKey || '').trim();
  if (cleanCustom) return cleanCustom;

  try {
    const { data: aiSettings, error: aiErr } = await supabase
      .from('ai_integration_settings')
      .select('encrypted_api_key, is_active')
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle();

    if (!aiErr && aiSettings?.encrypted_api_key) {
      const dbKey = aiSettings.encrypted_api_key.trim();
      if (dbKey && !dbKey.startsWith('aes256_vault_sk_proj_demo')) {
        return dbKey;
      }
    }
  } catch (err) {
    console.warn('[Gemini Service] Exception fetching key from Supabase:', err.message);
  }

  // Las claves de IA ya no se leen de variables VITE_* (acabarían visibles en el navegador).
  // Viven en el servidor: GEMINI_API_KEY, OPENAI_API_KEY y ANTHROPIC_API_KEY.
  return '';
}

/**
 * Instantiates Official @google/genai Client
 */
export async function createGeminiClient(customKey = '') {
  const apiKey = await getGeminiApiKey(customKey);
  if (!apiKey) {
    throw new Error('API Key de Google Gemini no configurada. Configure la clave en Ajustes o defina GEMINI_API_KEY en el servidor.');
  }
  return new GoogleGenAI({ apiKey });
}

/**
 * Dynamic Auto-Discovery of available models via `GET /v1beta/models`
 * 1. Calls ListModels from Google API.
 * 2. Filters models supporting "generateContent".
 * 3. Normalizes name using `.replace(/^models\//, '')`.
 */
export async function fetchAvailableGeminiModels(apiKeyInput = '') {
  const apiKey = await getGeminiApiKey(apiKeyInput);
  if (!apiKey) throw new Error('Se requiere una API Key válida para consultar los modelos disponibles.');

  const url = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      handleGeminiHttpError(response.status, 'Error al consultar la lista de modelos de Google Gemini');
    }
    const data = await response.json();
    const rawList = data.models || [];
    const validModels = rawList
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => {
        const cleanName = (m.name || '').replace(/^models\//, '');
        return {
          id: cleanName,
          displayName: m.displayName || cleanName,
          description: m.description || ''
        };
      });

    return validModels;
  } catch (err) {
    console.error('[Fetch Gemini Models Exception]', err);
    throw err;
  }
}

/**
 * Converts a Blob or File into a Base64 encoded string
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result || '';
      const base64Str = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
      resolve(base64Str);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Transcribes pre-recorded audio files directly using Gemini multimodal generateContent API
 */
export async function transcribeAudioWithGemini(audioBlob, customApiKey = '', model = DEFAULT_GEMINI_MODEL) {
  const apiKey = await getGeminiApiKey(customApiKey);
  if (!apiKey) {
    throw new Error('Se requiere una clave API de Google Gemini para la transcripción.');
  }

  const base64Audio = await blobToBase64(audioBlob);

  let mimeType = audioBlob.type || 'audio/webm';
  if (audioBlob.name) {
    const ext = audioBlob.name.split('.').pop().toLowerCase();
    if (ext === 'mp3') mimeType = 'audio/mp3';
    else if (ext === 'wav') mimeType = 'audio/wav';
    else if (ext === 'm4a') mimeType = 'audio/mp4';
    else if (ext === 'ogg') mimeType = 'audio/ogg';
    else if (ext === 'webm') mimeType = 'audio/webm';
  }

  const preferredModel = normalizeGeminiModel(model) || DEFAULT_GEMINI_MODEL;
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(preferredModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const payload = {
    systemInstruction: { parts: [{ text: LITERAL_TRANSCRIPTION_INSTRUCTION }] },
    contents: [
      {
        parts: [
          {
            text: 'Transcribe literalmente este audio.'
          },
          {
            inlineData: {
              mimeType,
              data: base64Audio
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0
    }
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    let errMessage = response.statusText;
    try {
      const errJson = await response.json();
      errMessage = errJson.error?.message || errMessage;
    } catch (e) {}
    handleGeminiHttpError(response.status, errMessage);
  }

  const data = await response.json();
  const rawContent = (data.candidates?.[0]?.content?.parts || [])
    .filter(p => p.text && !p.thought)
    .map(p => p.text)
    .join('');
  if (!rawContent) {
    throw new Error('Respuesta vacía al transcribir el audio con Gemini.');
  }
  return cleanTranscript(rawContent);
}

// Misma regla que en el servidor: transcribir solo lo que se oye; la mejora va aparte, con su botón.
export const LITERAL_TRANSCRIPTION_INSTRUCTION = `Eres un transcriptor literal de audio. Tu única tarea es escribir, palabra por palabra y en el idioma hablado, exactamente lo que se dice en el audio.
Reglas estrictas:
- No resumas, no reformules, no corrijas, no completes frases y no añadas nada que no se oiga.
- No inventes medidas, cantidades, materiales, nombres ni datos que no se digan claramente.
- Si una palabra o fragmento no se entiende, escribe [inaudible] en su lugar.
- Si en el audio no hay voz (silencio, ruido o música), responde únicamente: SIN_VOZ
- Devuelve solo la transcripción en texto plano, sin comillas, títulos, comentarios ni formato JSON.`;

// Frases que los motores "oyen" en audios mudos o con solo ruido.
const SILENCE_HALLUCINATIONS = /amara\.org|subt[ií]tulos (realizados|por)|gracias por ver|suscr[ií]bete|^\s*(\[?(m[uú]sica|silencio|sin voz|inaudible)\]?\.?)\s*$/i;

export function cleanTranscript(text) {
  const t = String(text || '').trim();
  if (!t || SILENCE_HALLUCINATIONS.test(t) || /^\[?SIN_VOZ\]?$/i.test(t)) return '';
  return t;
}

/**
 * Dynamic Model Selection Algorithm:
 * - Priority 1: Model with "flash" in its name (e.g. gemini-1.5-flash-latest, gemini-1.5-flash, gemini-2.0-flash)
 * - Priority 2: First model supporting "generateContent"
 */
export function autoSelectOptimalModel(availableModels) {
  if (!Array.isArray(availableModels) || availableModels.length === 0) {
    return DEFAULT_GEMINI_MODEL;
  }

  const modelIds = availableModels.map(m => (typeof m === 'string' ? m : m.id));

  // Priority 1: Flash models
  const flashModel = modelIds.find(id => id.includes('1.5-flash') || id.includes('flash'));
  if (flashModel) return flashModel;

  // Priority 2: First compatible model
  return modelIds[0] || DEFAULT_GEMINI_MODEL;
}

/**
 * Auto-Discovers, selects optimal model, and runs a ping connection test
 */
export async function checkAndAutoSelectBestGeminiModel(apiKeyInput = '') {
  const apiKey = await getGeminiApiKey(apiKeyInput);
  if (!apiKey) {
    throw new Error('Se requiere una API Key para probar la conexión con Gemini.');
  }

  try {
    // 1. Discover models via GET /v1beta/models
    const available = await fetchAvailableGeminiModels(apiKey);

    // 2. Select optimal model dynamically
    const detectedModel = autoSelectOptimalModel(available);

    // 3. Ping connection test against detectedModel
    const testRes = await testGeminiConnection(apiKey, detectedModel);

    return {
      success: true,
      provider: 'Google Gemini',
      activeModel: detectedModel,
      availableModelsCount: available.length,
      availableModels: available.map(m => m.id),
      latencyMs: testRes.latencyMs,
      message: testRes.message,
      statusMessage: `✅ API correcta\n\nProveedor: Google Gemini\nModelo activo detectado: ${detectedModel}\nEstado: Operativo`
    };
  } catch (err) {
    console.error('[Check Gemini API Failed]', err);
    throw err;
  }
}

/**
 * Validates and normalizes Google Gemini model identifiers.
 */
export function normalizeGeminiModel(rawModel) {
  if (!rawModel || typeof rawModel !== 'string') return DEFAULT_GEMINI_MODEL;
  const cleaned = rawModel.trim().toLowerCase().replace(/^models\//, '');
  return cleaned || DEFAULT_GEMINI_MODEL;
}

/**
 * Strips markdown code blocks like ```json ... ``` and cleans JSON text
 */
export function cleanGeminiJsonResponse(rawText) {
  if (!rawText) return '{}';
  let cleaned = rawText.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  return cleaned;
}

/**
 * Error classifier for HTTP status codes
 */
export function handleGeminiHttpError(status, detail = '') {
  console.error(`[Google Gemini API HTTP Error ${status}] Detalle técnico:`, detail);
  if (status === 429) {
    throw new Error('Cuota excedida de la API de Gemini (Error 429). Por favor, espere un momento antes de volver a intentarlo.');
  }
  if (status === 401 || status === 403) {
    throw new Error(`Clave de API de Gemini inválida o no autorizada (HTTP ${status}). Detalle: ${detail || 'Revise la clave en Ajustes.'}`);
  }
  if (status === 408 || status === 504) {
    throw new Error('Tiempo de espera agotado al conectar con Gemini (Timeout). Inténtelo de nuevo.');
  }
  throw new Error(`Error en API Gemini (HTTP ${status}): ${detail || USER_FRIENDLY_AI_ERROR}`);
}

/**
 * Executes a Gemini generateContent request
 */
async function executeGeminiRequestWithFallback({ apiKeyInput, model, payload }) {
  const apiKey = await getGeminiApiKey(apiKeyInput);
  if (!apiKey) {
    throw new Error('Clave de API de Gemini no configurada.');
  }

  let preferredModel = normalizeGeminiModel(model) || DEFAULT_GEMINI_MODEL;
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(preferredModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawContent) {
        throw new Error('Respuesta vacía recibida del servidor de Gemini');
      }
      return { data, rawContent, modelUsed: preferredModel };
    }

    let errMessage = response.statusText;
    try {
      const errJson = await response.json();
      errMessage = errJson.error?.message || errMessage;
    } catch (e) {}

    console.error(`[Gemini API Error Response] Model: "${preferredModel}", Status: ${response.status}, Detail:`, errMessage);

    if (response.status === 429 || response.status === 401 || response.status === 403) {
      handleGeminiHttpError(response.status, errMessage);
    }

    throw new Error(errMessage);
  } catch (netErr) {
    if (netErr.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al comunicar con la IA de Gemini (Timeout 45s).');
    }
    console.error(`[Gemini Request Exception] Modelo "${preferredModel}":`, netErr.message || netErr);
    throw netErr;
  }
}

/**
 * Pings Google Gemini API to test connection against detectedModel
 * Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/${detectedModel}:generateContent?key=${apiKey}
 * Body: { "contents": [{ "parts": [{ "text": "ping" }] }] }
 */
export async function testGeminiConnection(apiKeyInput = '', model = DEFAULT_GEMINI_MODEL) {
  const apiKey = await getGeminiApiKey(apiKeyInput);
  if (!apiKey) {
    throw new Error('Configuración de API Key de Gemini requerida.');
  }

  const targetModel = normalizeGeminiModel(model) || DEFAULT_GEMINI_MODEL;
  const startTime = performance.now();
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    contents: [
      {
        parts: [{ text: 'ping' }]
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const elapsedMs = Math.round(performance.now() - startTime);

    if (response.ok) {
      const data = await response.json();
      const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || 'PONG';
      console.log(`[Gemini Ping Success] Model: ${targetModel}, Status ${response.status}, Latency: ${elapsedMs}ms, Response:`, rawContent);
      return {
        success: true,
        latencyMs: elapsedMs,
        model: targetModel,
        message: `Conexión con Google Gemini (${targetModel}) exitosa (${elapsedMs}ms). Respuesta: ${rawContent.trim()}`
      };
    }

    let detailMsg = response.statusText;
    try {
      const errJson = await response.json();
      detailMsg = errJson.error?.message || detailMsg;
    } catch (e) {}

    console.error(`[Gemini Ping Failure] Model: ${targetModel}, Status: ${response.status}, StatusText: ${response.statusText}, Details:`, detailMsg);
    handleGeminiHttpError(response.status, detailMsg);
  } catch (err) {
    console.error('[Gemini Connection Test Exception]', err.message || err);
    throw err;
  }
}

/**
 * Generates structured construction budget JSON using Google Gemini
 */
export async function generateBudgetWithGemini({
  promptUser,
  systemPrompt,
  apiKeyInput = '',
  model = DEFAULT_GEMINI_MODEL,
  temperature = 0.15,
  referenceBudgets = []
}) {
  const apiKey = await getGeminiApiKey(apiKeyInput);
  if (!apiKey) {
    throw new Error('Clave API de Gemini requerida para generar el presupuesto.');
  }

  let effectiveSystemPrompt = systemPrompt;
  if (!effectiveSystemPrompt || referenceBudgets?.length > 0) {
    effectiveSystemPrompt = buildGeminiSystemPromptWithReferences(referenceBudgets);
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: promptUser }]
      }
    ],
    systemInstruction: {
      parts: [{ text: effectiveSystemPrompt }]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: Number(temperature) || 0.15
    }
  };

  try {
    const { rawContent } = await executeGeminiRequestWithFallback({
      apiKeyInput: apiKey,
      model,
      payload
    });

    const sanitized = cleanGeminiJsonResponse(rawContent);
    const parsed = JSON.parse(sanitized);
    return parsed;
  } catch (err) {
    console.error('[Gemini Budget Generation Failed]', err);
    throw err;
  }
}
