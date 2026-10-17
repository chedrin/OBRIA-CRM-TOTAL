/**
 * ObraMaster - Google Gemini AI Service
 * 
 * Provides:
 * 1. Connection testing with latency benchmarking
 * 2. Structured budget generation via Gemini REST API (v1beta)
 * 3. Robust error handling (400, 403, 429 RESOURCE_EXHAUSTED, JSON parsing)
 * 4. Automatic markdown / codeblock sanitization for pure JSON parsing
 * 5. Automatic model normalization & 404 fallback to gemini-1.5-flash
 */

import { buildGeminiSystemPromptWithReferences } from './referenceBudgetService';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const GEMINI_MODELS = [
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Recomendado · Ultrarrápido & Multimodal)', speed: 'Ultrarrápido', context: '1M tokens' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Razonamiento normativo y mediciones)', speed: 'Rápido', context: '2M tokens' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Última generación)', speed: 'Ultrarrápido', context: '1M tokens' }
];

/**
 * Validates and normalizes Google Gemini model identifiers.
 * Prevents 404 errors by mapping non-existent/legacy/typo model strings
 * (e.g. "gemini-2.5-flash", "gemini-flash", etc.) to active models in Google Gemini API v1beta.
 */
export function normalizeGeminiModel(rawModel) {
  if (!rawModel || typeof rawModel !== 'string') return 'gemini-1.5-flash';
  const cleaned = rawModel.trim().toLowerCase();

  const validModels = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp'
  ];

  if (validModels.includes(cleaned)) {
    return cleaned;
  }

  // Pro model mapping
  if (cleaned.includes('pro')) {
    return 'gemini-1.5-pro';
  }

  // 2.0 model mapping
  if (cleaned.includes('2.0')) {
    return 'gemini-2.0-flash';
  }

  // Default robust fallback for any other model (e.g. gemini-2.5-flash, gemini-flash, etc.)
  return 'gemini-1.5-flash';
}

/**
 * Strips markdown code blocks like ```json ... ``` and cleans JSON text
 */
export function cleanGeminiJsonResponse(rawText) {
  if (!rawText) return '{}';
  let cleaned = rawText.trim();

  // Remove markdown code fences ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
  }

  // Find first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Fix possible trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

/**
 * Pings Google Gemini API to test connection and measure latency
 * @param {string} apiKey - Google Gemini API Key
 * @param {string} model - Target model identifier (e.g. gemini-1.5-flash)
 * @returns {Promise<{success: boolean, latencyMs: number, message: string}>}
 */
export async function testGeminiConnection(apiKey, model = 'gemini-1.5-flash') {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Debes introducir una clave de API de Google Gemini (comienza habitualmente por AIzaSy...).');
  }

  let targetModel = normalizeGeminiModel(model);
  let url = `${GEMINI_API_BASE}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  const startTime = performance.now();

  try {
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
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
      })
    });

    // Auto-fallback if model returned 404
    if (!response.ok && response.status === 404 && targetModel !== 'gemini-1.5-flash') {
      console.warn(`[Gemini Test] Modelo "${targetModel}" devolvió 404. Reintentando con gemini-1.5-flash...`);
      targetModel = 'gemini-1.5-flash';
      url = `${GEMINI_API_BASE}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Responde exclusivamente con la palabra: PONG' }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 20 }
        })
      });
    }

    const elapsedMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: { message: response.statusText } };
      }

      const status = response.status;
      const apiMsg = errorData?.error?.message || 'Error desconocido';

      if (status === 400 || status === 403 || apiMsg.includes('API_KEY_INVALID') || apiMsg.includes('PERMISSION_DENIED')) {
        throw new Error(`Error ${status}: API Key de Google Gemini inválida o sin permisos para el modelo ${targetModel}.`);
      }
      if (status === 429 || apiMsg.includes('RESOURCE_EXHAUSTED')) {
        throw new Error('Error 429: Cuota de Google Gemini agotada (RESOURCE_EXHAUSTED). Espera unos instantes o revisa tu facturación en Google AI Studio.');
      }
      if (status === 404) {
        throw new Error(`Error 404: El modelo "${targetModel}" no está disponible con esta clave. Prueba con "gemini-1.5-flash".`);
      }

      throw new Error(`Error de Google Gemini (${status}): ${apiMsg}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      success: true,
      latencyMs: elapsedMs,
      model: targetModel,
      message: `Conexión con Google Gemini (${targetModel}) exitosa (${elapsedMs}ms). Respuesta: ${candidateText.trim()}`
    };
  } catch (err) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('No se pudo conectar con los servidores de Google Gemini. Comprueba tu conexión a Internet o extensiones de bloqueo.');
    }
    throw err;
  }
}

/**
 * Generates structured construction budget JSON using Google Gemini
 * @param {Object} params
 * @param {string} params.promptUser - Detailed scope and catalog instructions
 * @param {string} [params.systemPrompt] - Official technical construction engineer prompt
 * @param {string} params.apiKey - Google AI Studio API Key
 * @param {string} [params.model='gemini-1.5-flash'] - Gemini model
 * @param {number} [params.temperature=0.15] - Generation temperature (0.1 - 0.2 recommended for budgeting)
 * @param {Array} [params.referenceBudgets] - Active reference budgets for Few-Shot contextual training
 * @returns {Promise<Object>} Parsed JSON object
 */
export async function generateBudgetWithGemini({
  promptUser,
  systemPrompt,
  apiKey,
  model = 'gemini-1.5-flash',
  temperature = 0.15,
  referenceBudgets = []
}) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Falta la API Key de Google Gemini en la configuración del motor de IA.');
  }

  let targetModel = normalizeGeminiModel(model);
  let url = `${GEMINI_API_BASE}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;

  // Determine system instruction (use Few-Shot reference documents if present)
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

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr) {
    throw new Error(`Fallo de red al conectar con Google Gemini: ${netErr.message}`);
  }

  // Automatic recovery if Google returns 404 for the requested model
  if (!response.ok && response.status === 404 && targetModel !== 'gemini-1.5-flash') {
    console.warn(`[Gemini Budget] Modelo "${targetModel}" devolvió 404. Reintentando automáticamente con gemini-1.5-flash...`);
    targetModel = 'gemini-1.5-flash';
    url = `${GEMINI_API_BASE}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (retryErr) {
      throw new Error(`Fallo de red al reintentar con Gemini: ${retryErr.message}`);
    }
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || response.statusText;
    } catch (e) {
      errorDetail = await response.text();
    }

    if (response.status === 400 || response.status === 403) {
      throw new Error(`Google Gemini (Error ${response.status}): Clave de API no válida o proyecto no autorizado. Detalle: ${errorDetail}`);
    }
    if (response.status === 429) {
      throw new Error(`Google Gemini (Error 429 RESOURCE_EXHAUSTED): Se ha superado el límite de peticiones por minuto. Espera un momento.`);
    }
    if (response.status === 404) {
      throw new Error(`Google Gemini (Error 404): El modelo "${targetModel}" no existe en el endpoint v1beta. Se recomienda seleccionar "gemini-1.5-flash".`);
    }

    throw new Error(`Error en llamada a Gemini (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawContent) {
    throw new Error('Google Gemini devolvió una respuesta vacía o sin partes de contenido.');
  }

  const sanitized = cleanGeminiJsonResponse(rawContent);

  try {
    const parsed = JSON.parse(sanitized);
    return parsed;
  } catch (parseErr) {
    console.error('Error al parsear JSON devuelto por Gemini:', parseErr, 'Raw:', rawContent);
    throw new Error(`La IA devolvió una respuesta pero no pudo interpretarse como JSON válido: ${parseErr.message}`);
  }
}
