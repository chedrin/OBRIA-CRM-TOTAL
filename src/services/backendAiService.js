/**
 * ObraMaster - Backend AI SaaS Service Integration
 * 
 * Centraliza la comunicación segura del frontend con los endpoints del servidor:
 * - GET  /api/settings/ai          -> Obtener configuración persistente
 * - PUT  /api/settings/ai          -> Guardar configuración del motor de IA
 * - POST /api/ai/test-connection   -> Prueba de latencia y estado de la API
 * - POST /api/ai/transcribe        -> Transcripción unificada de audios
 * - POST /api/ai/generate-budget   -> Generación estructurada de presupuesto
 * - POST /api/ai/price-sources/extract -> Precios de un presupuesto de gremio (PDF, imagen o texto)
 * - POST /api/ai/analyze-images    -> Inspección de fotos de obra
 * - POST /api/ai/croquis           -> Croquis 2D (planta) desde mediciones y fotos
 */

const BACKEND_BASE_URL = '/api';

/**
 * Comprueba si el backend de producción está activo
 */
// Claves de Ajustes > Motor IA (guardadas en Supabase). Se envían para que el servidor pueda
// cambiar de proveedor aunque haya perdido su copia tras un despliegue.
let clientAiKeys = {};
export function setClientAiKeys(keys) {
  clientAiKeys = Object.fromEntries(
    Object.entries(keys || {}).filter(([, v]) => typeof v === 'string' && v.trim())
  );
}
const clientAiKeysJson = () => (Object.keys(clientAiKeys).length ? JSON.stringify(clientAiKeys) : '');

export async function checkBackendStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${BACKEND_BASE_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return { isAvailable: true, details: data };
    }
    return { isAvailable: false };
  } catch {
    return { isAvailable: false };
  }
}

/**
 * Obtiene la configuración de IA activa guardada en backend
 */
export async function getBackendAiSettings() {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/settings/ai`);
    const rawText = await res.text();
    if (res.ok && rawText) {
      try {
        return JSON.parse(rawText);
      } catch (err) {
        console.warn('Respuesta no JSON al obtener configuración de IA:', rawText);
      }
    }
  } catch (err) {
    console.warn('Error al obtener configuración de IA del backend:', err);
  }
  return null;
}

/**
 * Actualiza de forma persistente la configuración de IA en el backend
 */
export async function updateBackendAiSettings(newSettings) {
  const res = await fetch(`${BACKEND_BASE_URL}/settings/ai`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newSettings)
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Error al guardar configuración de IA (${res.status}): ${rawText || res.statusText}`);
    }
    throw new Error(`Respuesta no válida del servidor al guardar configuración: ${rawText || 'Sin contenido'}`);
  }

  if (!res.ok) {
    throw new Error(`Error al guardar configuración de IA: ${data.error || res.statusText}`);
  }

  return data;
}

/**
 * Realiza una prueba de ping/latencia con el proveedor configurado
 */
export async function testBackendAiConnection(payload = {}) {
  const res = await fetch(`${BACKEND_BASE_URL}/ai/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Error en prueba de conexión (${res.status}): ${rawText || res.statusText}`);
    }
    throw new Error(`Respuesta no válida del servidor en prueba de conexión: ${rawText || 'Sin contenido'}`);
  }

  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }

  return data;
}

/**
 * Envía un archivo o varios archivos de audio para su transcripción automática por la IA
 */
export async function transcribeAudioViaBackend(audioBlobOrFiles, customApiKey = '') {
  const form = new FormData();

  if (Array.isArray(audioBlobOrFiles)) {
    audioBlobOrFiles.forEach((f, idx) => {
      form.append('audios', f, f.name || `grabacion-${idx + 1}.webm`);
    });
  } else if (audioBlobOrFiles) {
    form.append('audios', audioBlobOrFiles, audioBlobOrFiles.name || 'grabacion.webm');
  }

  if (customApiKey) form.append('apiKey', customApiKey);
  if (clientAiKeysJson()) form.append('apiKeys', clientAiKeysJson());

  const res = await fetch(`${BACKEND_BASE_URL}/ai/transcribe`, {
    method: 'POST',
    body: form
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Error en transcripción de audio (${res.status}): ${rawText || res.statusText}`);
    }
    throw new Error(`Respuesta no válida del servidor de transcripción: ${rawText || 'Sin contenido'}`);
  }

  if (!res.ok) {
    throw new Error(`Error en transcripción de audio (${res.status}): ${data.error || res.statusText}`);
  }

  return data;
}

/**
 * Genera el presupuesto técnico multimodal a través del backend de IA
 */
/**
 * Solicita la reescritura y mejora técnica de un texto a la IA activa, usando presupuestos de referencia como modelo
 */
export async function improveTextViaBackend({
  text = '',
  context = 'Descripción técnica de trabajo',
  referenceBudgets = [],
  provider = '',
  apiKey = '',
  model = ''
}) {
  const res = await fetch(`${BACKEND_BASE_URL}/ai/improve-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      context,
      referenceBudgets,
      provider,
      apiKey,
      apiKeys: clientAiKeys,
      model
    })
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Error al mejorar texto con IA (${res.status}): ${rawText || res.statusText}`);
    }
    throw new Error(`Respuesta no válida del servidor al mejorar texto: ${rawText || 'Sin contenido'}`);
  }

  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }

  return data;
}

export async function generateBudgetViaBackend({
  fotos = [],
  audios = [],
  dictado = '',
  transcription = '',
  medidasNotas = '',
  cliente = '',
  direccion = '',
  calidades = 'Media-Alta',
  basePrecios = [],
  referenceBudgets = [],
  margenGlobal = 28,
  tipoIva = 10,
  titulo = '',
  plazo = '',
  parametrosCliente = null,
  customApiKey = ''
}) {
  const form = new FormData();

  fotos.forEach((f, idx) => {
    if (f instanceof Blob || f instanceof File) {
      form.append('fotos', f, f.name || `foto-${idx + 1}.jpg`);
    }
  });

  audios.forEach((a, idx) => {
    if (a instanceof Blob || a instanceof File) {
      form.append('audios', a, a.name || `audio-${idx + 1}.webm`);
    }
  });

  const textPayload = dictado || transcription || '';
  if (textPayload) form.append('dictado', textPayload);
  if (medidasNotas) form.append('medidasNotas', medidasNotas);
  if (cliente) form.append('cliente', cliente);
  if (direccion) form.append('direccion', direccion);
  if (calidades) form.append('calidades', calidades);
  if (margenGlobal) form.append('margenGlobal', String(margenGlobal));
  if (tipoIva !== undefined && tipoIva !== null && tipoIva !== '') form.append('tipoIva', String(tipoIva));
  if (titulo) form.append('titulo', titulo);
  if (plazo) form.append('plazo', plazo);
  // Parámetros del cliente y condiciones económicas (paso 1 del asistente): el servidor los valida.
  if (parametrosCliente) form.append('parametrosCliente', JSON.stringify(parametrosCliente));
  if (customApiKey) form.append('apiKey', customApiKey);

  if (basePrecios && basePrecios.length > 0) {
    form.append('basePrecios', JSON.stringify(basePrecios));
  }
  if (referenceBudgets && referenceBudgets.length > 0) {
    form.append('referenceBudgets', JSON.stringify(referenceBudgets));
  }
  if (clientAiKeysJson()) form.append('apiKeys', clientAiKeysJson());

  const res = await fetch(`${BACKEND_BASE_URL}/ai/generate-budget`, {
    method: 'POST',
    body: form
  });

  const rawText = await res.text();
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Error al generar presupuesto IA (${res.status}): ${rawText || res.statusText}`);
    }
    throw new Error(`Respuesta no válida del servidor al generar presupuesto: ${rawText || 'Sin contenido'}`);
  }

  if (!res.ok) {
    throw new Error(`Error al generar presupuesto IA (${res.status}): ${data.error || res.statusText}`);
  }

  return data;
}

/**
 * Croquis 2D: mediciones por estancia + fotos -> plano normalizado ({ plan }).
 * La IA puede tardar: se corta a los 3 minutos con un mensaje claro.
 */
export async function generateCroquisViaBackend({ fotos = [], mediciones = '', notas = '', obra = '', partidas = [] }) {
  const form = new FormData();
  fotos.forEach((f, idx) => form.append('fotos', f, f.name || `foto-${idx + 1}.jpg`));
  if (mediciones) form.append('mediciones', mediciones);
  if (notas) form.append('notas', notas);
  if (obra) form.append('obra', obra);
  if (partidas.length) form.append('partidas', JSON.stringify(partidas));
  if (clientAiKeysJson()) form.append('apiKeys', clientAiKeysJson());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);
  let res;
  try {
    res = await fetch(`${BACKEND_BASE_URL}/ai/croquis`, { method: 'POST', body: form, signal: controller.signal });
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'La IA ha tardado más de 3 minutos. Prueba con menos fotos.' : `No se pudo contactar con el servidor: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
  const rawText = await res.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch {}
  if (!res.ok || !data.plan) {
    throw new Error(data.error || `Error al generar el croquis (${res.status}): ${rawText.slice(0, 200) || res.statusText}`);
  }
  return data;
}

/**
 * Lee el presupuesto de un gremio (PDF, imágenes o texto) y devuelve sus partidas con precio de coste.
 */
export async function extractPricesViaBackend({ files = [], texto = '', gremio = '', subcontrata = '' }) {
  const form = new FormData();
  files.forEach((f, idx) => form.append('documento', f, f.name || `documento-${idx + 1}`));
  if (texto) form.append('texto', texto);
  if (gremio) form.append('gremio', gremio);
  if (subcontrata) form.append('subcontrata', subcontrata);
  if (clientAiKeysJson()) form.append('apiKeys', clientAiKeysJson());

  const res = await fetch(`${BACKEND_BASE_URL}/ai/price-sources/extract`, { method: 'POST', body: form });
  const rawText = await res.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { error: rawText }; }
  if (!res.ok) throw new Error(data.error || `Error ${res.status} al leer los precios`);
  return data;
}

/**
 * Analiza una vez un presupuesto de referencia y guarda lo aprendido en la memoria de la IA.
 * Si hay PDF, el servidor lo lee entero con Gemini; si no, analiza el texto extraído.
 */
export async function analyzeReferenceBudgetViaBackend({ name = '', tipoObra = '', text = '', file = null, memoryId = '' }) {
  const form = new FormData();
  form.append('name', name);
  if (tipoObra) form.append('tipoObra', tipoObra);
  if (text) form.append('text', text);
  if (memoryId) form.append('memoryId', memoryId);
  if (file) form.append('pdf', file, file.name || 'presupuesto.pdf');
  if (clientAiKeysJson()) form.append('apiKeys', clientAiKeysJson());

  const res = await fetch(`${BACKEND_BASE_URL}/ai/reference-budgets/analyze`, { method: 'POST', body: form });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status} al analizar el presupuesto`);
  return data;
}

// ---------------------------------------------------------------------------
// Memoria de la IA: instrucciones permanentes y correcciones
// El servidor añade todo esto automáticamente a cada llamada de IA.
// ---------------------------------------------------------------------------
async function memoryRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BACKEND_BASE_URL}/ai/memory${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.error || `Error ${res.status} en la memoria de la IA`);
  return data;
}

export const getAiMemory = () => memoryRequest('');
export const addAiInstruction = (payload) => memoryRequest('/instructions', { method: 'POST', body: payload });
export const updateAiInstruction = (id, payload) => memoryRequest(`/instructions/${id}`, { method: 'PATCH', body: payload });
export const deleteAiInstruction = (id) => memoryRequest(`/instructions/${id}`, { method: 'DELETE' });
export const deleteAiCorrection = (id) => memoryRequest(`/corrections/${id}`, { method: 'DELETE' });

/**
 * Registra una corrección para que la IA aprenda. Nunca interrumpe al usuario:
 * si falla, se ignora en silencio.
 * kind: 'texto' | 'presupuesto'
 */
export async function recordAiCorrection({ kind = 'texto', context = '', original = '', aiOutput = '', finalText = '', accepted = null, note = '' }) {
  try {
    await memoryRequest('/corrections', {
      method: 'POST',
      body: { kind, context, original, aiOutput, finalText, accepted, note }
    });
  } catch (err) {
    console.warn('[AI memory] No se pudo guardar la corrección:', err.message);
  }
}

const pendingBudgetEdits = new Map();

/** Registra un cambio manual de presupuesto agrupando las pulsaciones seguidas (2,5 s). */
export function recordBudgetEditDebounced(key, payload) {
  const previous = pendingBudgetEdits.get(key);
  const first = previous ? previous.first : payload;
  if (previous) clearTimeout(previous.timer);
  const timer = setTimeout(() => {
    pendingBudgetEdits.delete(key);
    if (first.original === payload.finalText) return;
    recordAiCorrection({ kind: 'presupuesto', ...payload, original: first.original });
  }, 2500);
  pendingBudgetEdits.set(key, { first, timer });
}

/**
 * Tokens aproximados usados por cada proveedor (los que declara cada respuesta de la IA).
 * Devuelve { usage: { google: { calls, input_tokens, cached_tokens, output_tokens, since } }, persistent }.
 */
export async function getAiUsage() {
  const res = await fetch(`${BACKEND_BASE_URL}/ai/usage`);
  if (!res.ok) throw new Error(`No se pudo leer el uso de tokens (${res.status})`);
  return res.json();
}

/** Pone a cero el contador de un proveedor. */
export async function resetAiUsage(provider) {
  const res = await fetch(`${BACKEND_BASE_URL}/ai/usage/${encodeURIComponent(provider)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `No se pudo poner a cero (${res.status})`);
  return data;
}
