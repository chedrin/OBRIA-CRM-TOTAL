/**
 * ObraMaster - Backend AI Integration Service
 * 
 * Communicates with the local Node/Express backend (http://localhost:3000 or /api proxy):
 * 1. Checks backend health and Gemini availability
 * 2. Uploads audio files to /api/transcribir
 * 3. Uploads photo files to /api/analizar-fotos
 * 4. Submits complete multimodal budget requests to /api/presupuesto
 */

const BACKEND_BASE_URL = '/api'; // Proxied by Vite to http://localhost:3000 in dev

/**
 * Checks if the local backend server is up and running
 * @returns {Promise<{isAvailable: boolean, details?: Object}>}
 */
export async function checkBackendStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

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
 * Sends an audio recording or file to the backend to transcribe with Gemini
 * @param {Blob|File} audioBlobOrFile
 * @param {string} [customApiKey]
 * @returns {Promise<{success: boolean, texto: string, transcripcion: string}>}
 */
export async function transcribeAudioViaBackend(audioBlobOrFile, customApiKey = '') {
  const form = new FormData();
  const filename = audioBlobOrFile.name || 'audio-grabacion.webm';
  form.append('audios', audioBlobOrFile, filename);
  if (customApiKey) form.append('apiKey', customApiKey);

  const res = await fetch(`${BACKEND_BASE_URL}/transcribir`, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    let errMsg = res.statusText;
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errMsg;
    } catch {
      // Keep statusText
    }
    throw new Error(`Error en el backend al transcribir: ${errMsg}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Sends photos to the backend for AI visual inspection
 * @param {Array<File|Blob>} photoFiles
 * @param {string} [customApiKey]
 * @returns {Promise<Object>}
 */
export async function analyzePhotosViaBackend(photoFiles, customApiKey = '') {
  const form = new FormData();
  photoFiles.forEach((file, idx) => {
    const filename = file.name || `foto-${idx + 1}.jpg`;
    form.append('fotos', file, filename);
  });
  if (customApiKey) form.append('apiKey', customApiKey);

  const res = await fetch(`${BACKEND_BASE_URL}/analizar-fotos`, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    let errMsg = res.statusText;
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errMsg;
    } catch {
      // Keep statusText
    }
    throw new Error(`Error en el backend al analizar fotos: ${errMsg}`);
  }

  return await res.json();
}

/**
 * Generates structured budget via backend proxy with native multimodal files
 * @param {Object} params
 * @param {Array<File|Blob>} [params.fotos]
 * @param {Array<File|Blob>} [params.audios]
 * @param {string} [params.dictado]
 * @param {string} [params.medidasNotas]
 * @param {string} [params.cliente]
 * @param {string} [params.direccion]
 * @param {string} [params.calidades]
 * @param {Array} [params.basePrecios]
 * @param {Array} [params.referenceBudgets]
 * @param {number} [params.margenGlobal]
 * @param {string} [params.customApiKey]
 * @returns {Promise<Object>}
 */
export async function generateBudgetViaBackend({
  fotos = [],
  audios = [],
  dictado = '',
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

  // Attach photos
  fotos.forEach((f, idx) => {
    if (f instanceof Blob || f instanceof File) {
      form.append('fotos', f, f.name || `foto-${idx + 1}.jpg`);
    }
  });

  // Attach audios
  audios.forEach((a, idx) => {
    if (a instanceof Blob || a instanceof File) {
      form.append('audios', a, a.name || `audio-${idx + 1}.webm`);
    }
  });

  // Attach text metadata
  if (dictado) form.append('dictado', dictado);
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

  const res = await fetch(`${BACKEND_BASE_URL}/presupuesto`, {
    method: 'POST',
    body: form
  });

  if (!res.ok) {
    let errMsg = res.statusText;
    try {
      const errJson = await res.json();
      errMsg = errJson.error || errMsg;
    } catch {
      // Keep statusText
    }
    throw new Error(`Error del Backend de IA (${res.status}): ${errMsg}`);
  }

  const data = await res.json();
  return data;
}
