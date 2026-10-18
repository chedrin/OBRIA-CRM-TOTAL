/**
 * ObraMaster - Google Gemini AI Service
 * 
 * Centralized Gemini API integration featuring:
 * 1. Default model configuration: gemini-2.5-flash
 * 2. Automatic fallback cascade chain: gemini-2.5-flash -> gemini-2.0-flash -> gemini-1.5-flash
 * 3. Live model discovery via Google Gemini REST API (`GET /v1beta/models`)
 * 4. Automatic auto-selection and validation of the best compatible model
 * 5. User-friendly error messaging (suppressing raw Google API technical errors in UI)
 * 6. Automatic markdown / codeblock sanitization for pure JSON parsing
 */

import { buildGeminiSystemPromptWithReferences } from './referenceBudgetService';

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

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
 * Fetches available models from Google Gemini API
 * @param {string} apiKey - Google Gemini API key
 * @returns {Promise<Array<{id: string, displayName: string, supportedGenerationMethods: string[]}>>}
 */
export async function fetchAvailableGeminiModels(apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }

  const url = `${GEMINI_API_BASE}/models?key=${encodeURIComponent(cleanKey)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[Gemini List Models Error] HTTP ${response.status}`);
      throw new Error(USER_FRIENDLY_AI_ERROR);
    }
    const data = await response.json();
    const rawList = data.models || [];
    return rawList
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => ({
        id: (m.name || '').replace(/^models\//, ''),
        displayName: m.displayName || m.name,
        description: m.description || ''
      }));
  } catch (err) {
    console.error('[Fetch Gemini Models Exception]', err);
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }
}

/**
 * Checks Gemini API key, discovers available models, and automatically selects best compatible model
 * @param {string} apiKey - Google Gemini API key
 */
export async function checkAndAutoSelectBestGeminiModel(apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }

  try {
    const available = await fetchAvailableGeminiModels(cleanKey);
    const availableIds = available.map(m => m.id);

    // Pick best model in order of priority preference
    let selectedModel = GEMINI_FALLBACK_CASCADE.find(m => availableIds.includes(m));

    if (!selectedModel) {
      selectedModel = availableIds.find(id => id.includes('flash')) || availableIds[0] || DEFAULT_GEMINI_MODEL;
    }

    // Verify selected model with a test connection ping
    const testRes = await testGeminiConnection(cleanKey, selectedModel);

    return {
      success: true,
      provider: 'Google Gemini',
      activeModel: testRes.model || selectedModel,
      availableModelsCount: available.length,
      availableModels: availableIds,
      latencyMs: testRes.latencyMs,
      message: testRes.message,
      statusMessage: `✅ API correcta\n\nProveedor: Google Gemini\nModelo activo: ${testRes.model || selectedModel}\nEstado: Operativo`
    };
  } catch (err) {
    console.error('[Check Gemini API Failed]', err);
    throw new Error(USER_FRIENDLY_AI_ERROR);
  }
}

/**
 * Validates and normalizes Google Gemini model identifiers.
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

  for (const fallbackModel of GEMINI_FALLBACK_CASCADE) {
    if (!modelsToTry.includes(fallbackModel)) {
      modelsToTry.push(fallbackModel);
    }
  }

  let lastError = null;

  for (const currentModel of modelsToTry) {
    const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(currentModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
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
        // ignore
      }

      console.error(`[Gemini API Error] Modelo "${currentModel}" HTTP ${response.status}:`, errMessage);

      if (response.status === 404 || errMessage.includes('not found') || errMessage.includes('is not supported')) {
        console.warn(`[Gemini Fallback] El modelo "${currentModel}" no está disponible (404). Reintentando con el siguiente modelo del cascade...`);
        lastError = new Error(errMessage);
        continue;
      }

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
