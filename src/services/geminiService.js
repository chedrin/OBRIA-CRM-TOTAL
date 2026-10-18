/**
 * ObraMaster - Google Gemini AI Service
 * 
 * Centralized Gemini API integration featuring:
 * 1. Default model configuration: gemini-2.5-flash
 * 2. Automatic fallback cascade chain: gemini-2.5-flash -> gemini-2.0-flash -> gemini-1.5-flash
 * 3. User-friendly error messaging (suppressing raw Google API technical errors in UI)
 * 4. Automatic markdown / codeblock sanitization for pure JSON parsing
 */

import { buildGeminiSystemPromptWithReferences } from './referenceBudgetService';

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const GEMINI_FALLBACK_CASCADE = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

export const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Última Generación · Ultrarrápido & Multimodal)', speed: 'Ultrarrápido', context: '1M tokens' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Alta velocidad & Estabilidad)', speed: 'Ultrarrápido', context: '1M tokens' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Compatibilidad general)', speed: 'Ultrarrápido', context: '1M tokens' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Razonamiento de mediciones avanzadas)', speed: 'Rápido', context: '2M tokens' }
];

export const USER_FRIENDLY_AI_ERROR = 'No ha sido posible conectar con la IA. Revise la configuración de la API o seleccione un modelo válido.';

/**
 * Validates and normalizes Google Gemini model identifiers.
 * Maps legacy or non-existent models to the active default model or valid known models.
 */
export function normalizeGeminiModel(rawModel) {
  if (!rawModel || typeof rawModel !== 'string') return DEFAULT_GEMINI_MODEL;
  const cleaned = rawModel.trim().toLowerCase();

  const validModels = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp'
  ];

  if (validModels.includes(cleaned)) {
    return cleaned;
  }

  if (cleaned.includes('2.5')) return 'gemini-2.5-flash';
  if (cleaned.includes('2.0')) return 'gemini-2.0-flash';
  if (cleaned.includes('pro')) return 'gemini-1.5-pro';
  if (cleaned.includes('1.5') || cleaned.includes('flash')) return 'gemini-1.5-flash';

  return DEFAULT_GEMINI_MODEL;
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
 * Executes a Gemini generateContent request with automatic fallback cascade through models
 */
async function executeGeminiRequestWithFallback({ apiKey, model, payload }) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }

  let preferredModel = normalizeGeminiModel(model);
  let modelsToTry = [preferredModel];

  // Build cascade list without duplicates
  for (const fallbackModel of GEMINI_FALLBACK_CASCADE) {
    if (!modelsToTry.includes(fallbackModel)) {
      modelsToTry.push(fallbackModel);
    }
  }

  let lastError = null;

  for (const currentModel of modelsToTry) {
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawContent) {
          throw new Error('Respuesta vacía recibida del servidor de Gemini');
        }
        return { data, rawContent, modelUsed: currentModel };
      }

      let errMessage = response.statusText;
      try {
        const errJson = await response.json();
        errMessage = errJson.error?.message || errMessage;
      } catch (e) {
        // ignore json parse error
      }

      console.error(`[Gemini API Error] Modelo "${currentModel}" HTTP ${response.status}:`, errMessage);

      // If 404 (model not found / non-existent) or invalid model, try next model in fallback cascade
      if (response.status === 404 || errMessage.includes('not found') || errMessage.includes('is not supported')) {
        console.warn(`[Gemini Fallback] El modelo "${currentModel}" no está disponible (404). Reintentando con el siguiente modelo del cascade...`);
        lastError = new Error(errMessage);
        continue;
      }

      // For auth errors (400/403/429), break and throw user friendly error
      throw new Error(errMessage);
    } catch (netErr) {
      console.error(`[Gemini Request Exception] Modelo "${currentModel}":`, netErr.message || netErr);
      lastError = netErr;
      if (netErr.message && (netErr.message.includes('404') || netErr.message.includes('not found'))) {
        continue;
      }
      break;
    }
  }

  console.error('[Gemini Cascade Failed] Se agotaron todos los modelos del cascade. Último error técnico:', lastError);
  throw new Error(USER_FRIENDLY_AI_ERROR);
}

/**
 * Pings Google Gemini API to test connection and measure latency
 */
export async function testGeminiConnection(apiKey, model = DEFAULT_GEMINI_MODEL) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }

  const startTime = performance.now();
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: 'Responde exclusivamente con la palabra: PONG' }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 20
    }
  };

  try {
    const { rawContent, modelUsed } = await executeGeminiRequestWithFallback({
      apiKey: cleanKey,
      model,
      payload
    });

    const elapsedMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      latencyMs: elapsedMs,
      model: modelUsed,
      message: `Conexión con Google Gemini (${modelUsed}) exitosa (${elapsedMs}ms). Respuesta: ${rawContent.trim()}`
    };
  } catch (err) {
    console.error('[Gemini Connection Test Failed]', err);
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }
}

/**
 * Generates structured construction budget JSON using Google Gemini
 */
export async function generateBudgetWithGemini({
  promptUser,
  systemPrompt,
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  temperature = 0.15,
  referenceBudgets = []
}) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error(USER_FRIENDLY_AI_ERROR);
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
      apiKey: cleanKey,
      model,
      payload
    });

    const sanitized = cleanGeminiJsonResponse(rawContent);
    const parsed = JSON.parse(sanitized);
    return parsed;
  } catch (err) {
    console.error('[Gemini Budget Generation Failed]', err);
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }
}
