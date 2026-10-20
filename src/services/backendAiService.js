/**
 * ObraMaster - Backend AI SaaS Service Integration
 * 
 * Centraliza la comunicación segura del frontend con los endpoints del servidor:
 * - GET  /api/settings/ai          -> Obtener configuración persistente
 * - PUT  /api/settings/ai          -> Guardar configuración del motor de IA
 * - POST /api/ai/test-connection   -> Prueba de latencia y estado de la API
 * - POST /api/ai/transcribe        -> Transcripción unificada de audios
 * - POST /api/ai/generate-budget   -> Generación estructurada de presupuesto
 * - POST /api/ai/analyze-images    -> Inspección de fotos de obra
 */

const BACKEND_BASE_URL = '/api';

/**
 * Comprueba si el backend de producción está activo
 */
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
  if (customApiKey) form.append('apiKey', customApiKey);

  if (basePrecios && basePrecios.length > 0) {
    form.append('basePrecios', JSON.stringify(basePrecios));
  }
  if (referenceBudgets && referenceBudgets.length > 0) {
    form.append('referenceBudgets', JSON.stringify(referenceBudgets));
  }

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
