/**
 * ObraMaster Multimodal Audio/Text/Email AI Service
 * 
 * Provides:
 * 1. Speech-to-Text Audio Transcription via OpenAI Whisper API or browser MediaStream
 * 2. Scope extraction and Technical Normalization to official Pliego de Condiciones
 * 3. Structured JSON Budget Generator by chapters and line items
 * 4. Audit logging of raw inputs and refined AI outputs (ai_inputs_log)
 */

import {
  generateBudgetWithGemini,
  transcribeAudioWithGemini,
  normalizeGeminiModel,
  DEFAULT_GEMINI_MODEL,
  USER_FRIENDLY_AI_ERROR,
  getGeminiApiKey
} from './geminiService';
import { buildFewShotReferenceContext, buildGeminiSystemPromptWithReferences } from './referenceBudgetService';
import { checkBackendStatus, transcribeAudioViaBackend, generateBudgetViaBackend } from './backendAiService';

/**
 * Direct client-side OpenAI Whisper transcription API
 */
export async function transcribeAudioWithOpenAI(audioBlob, apiKey) {
  const form = new FormData();
  const filename = audioBlob.name || 'audio-grabacion.webm';
  form.append('file', audioBlob, filename);
  form.append('model', 'whisper-1');
  form.append('language', 'es');
  form.append('prompt', 'Construcción y reformas: alicatados, rozas, solado porcelánico, pladur, bajantes, REBT, CTE.');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`
    },
    body: form
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Error en OpenAI Whisper: ${errText}`);
  }

  const data = await res.json();
  return data.text || '';
}

export const SYSTEM_PROMPT_TECHNICAL_SPECS = `Eres el Ingeniero Técnico de Edificación y Presupuestador Jefe de la empresa constructora "ObraMaster".
Tu objetivo es recibir audios transcritos, notas de voz, textos coloquiales o correos electrónicos de clientes/directores de obra y transformarlos en partidas formales de presupuesto de construcción o reforma.

REGLAS DE TRANSFORMACIÓN Y REDACCIÓN:
1. Traduce cualquier lenguaje informal o coloquial a redacción técnica de pliego de condiciones de obra (ejemplo: si el texto dice "rascar la pared podrida y pintar de blanco", redactar como "Saneado de soporte mediante rascado de pintura deteriorada, aplicación de fijador acrílico y dos manos de pintura plástica lavable mate color blanco").
2. Incluye siempre en la descripción los medios auxiliares, limpieza y retirada de restos a vertedero homologado si la naturaleza de la partida lo requiere.
3. Desglosa los trabajos en capítulos canónicos: 01. Demoliciones, 02. Albañilería, 03. Revestimientos, 04. Fontanería, 05. Electricidad, 06. Carpintería, 07. Pintura.
4. Identifica unidades de medida universales (m2 para superficies, ml para rodapiés/tuberías, ud para mecanismos/sanitarios, pa para partidas globales).
5. Si el texto proviene de un correo de cliente con varias peticiones o quejas, extrae exclusivamente los alcances físicos de trabajo requeridos y redacta un resumen ejecutivo del alcance.

FORMATO DE SALIDA (ESTRICTO JSON):
{
  "resumen_alcance": "Resumen claro de lo solicitado en 2-3 frases",
  "transcripcion_revisada": "Texto limpio, normalizado y sin muletillas",
  "redaccion_tecnica_estilo": "Redacción técnica contractual en tono formal para pliego de condiciones de la empresa",
  "capitulos": [
    {
      "nombre_capitulo": "01. DEMOLICIONES",
      "partidas": [
        {
          "codigo": "DEM-01",
          "titulo": "Demolición de tabique cerámico",
          "descripcion": "Demolición de tabicón de ladrillo hueco doble...",
          "unidad": "m2",
          "medicion": 18.5,
          "precio_unitario_estimado": 22.50,
          "total_estimado": 416.25
        }
      ]
    }
  ]
}`;

/**
 * Transcribes audio via OpenAI Whisper API, Gemini Multimodal API, or client fallback
 */
export async function transcribeAudio(audioBlob, aiConfig = {}, liveSpeechFallback = '') {
  // Las claves viven en el servidor; aiConfig.apiKey solo existe en configuraciones antiguas del navegador.
  const apiKey = (aiConfig.apiKey || '').trim();
  const hasAudio = audioBlob && audioBlob.size > 0;
  let lastError = null;

  // 1. Transcripción en el servidor (Whisper si hay clave de OpenAI, si no Gemini)
  if (hasAudio) {
    try {
      const transResult = await transcribeAudioViaBackend(audioBlob, apiKey);
      const text = (transResult?.texto || transResult?.transcripcion || '').trim();
      if (text) return { success: true, text, source: 'backend-ai' };
    } catch (bErr) {
      lastError = bErr;
      console.warn('Backend transcripción no disponible o devolvió error:', bErr.message);
    }
  }

  // 2. Transcripción directa con OpenAI Whisper si el navegador tiene clave sk-
  if (hasAudio && apiKey.startsWith('sk-') && !apiKey.startsWith('sk-ant') && !apiKey.startsWith('sk-or')) {
    try {
      const openAiText = await transcribeAudioWithOpenAI(audioBlob, apiKey);
      if (openAiText) return { success: true, text: openAiText, source: 'whisper-api' };
    } catch (oErr) {
      lastError = oErr;
      console.warn('Transcripción directa con OpenAI Whisper falló:', oErr.message);
    }
  }

  // 3. Transcripción directa con Gemini si el navegador tiene clave
  if (hasAudio && apiKey) {
    try {
      const geminiApiKey = await getGeminiApiKey(apiKey);
      if (geminiApiKey) {
        const geminiText = await transcribeAudioWithGemini(audioBlob, geminiApiKey, aiConfig.model || DEFAULT_GEMINI_MODEL);
        if (geminiText) return { success: true, text: geminiText, source: 'gemini-multimodal' };
      }
    } catch (gErr) {
      lastError = gErr;
      console.warn('Transcripción directa con Google Gemini falló:', gErr.message);
    }
  }

  // 4. Lo que haya captado el reconocimiento de voz del navegador mientras se grababa
  if (liveSpeechFallback && liveSpeechFallback.trim().length > 3) {
    return { success: true, text: liveSpeechFallback.trim(), source: 'browser-speech-recognition' };
  }

  throw new Error(lastError?.message || USER_FRIENDLY_AI_ERROR);
}

/**
 * Transforms raw transcribed or pasted text into structured technical line items
 */
export async function processScopeWithAI(
  inputText,
  contextType = 'presupuesto_obra',
  projectId = null,
  aiConfig = {},
  basePrecios = [],
  referenceBudgets = [],
  customPhotos = [],
  audioBlob = null
) {
  if (!inputText || !inputText.trim()) {
    throw new Error('El texto de entrada está vacío');
  }

  const activeRefs = (referenceBudgets || []).filter(b => b.is_active);

  // 0. Probar primero con el Backend de Producción
  try {
    const validPhotos = (customPhotos || []).map(p => p.file || p.blob).filter(Boolean);
    const audioFiles = audioBlob ? [audioBlob] : [];

    const backendResult = await generateBudgetViaBackend({
      fotos: validPhotos,
      audios: audioFiles,
      dictado: inputText,
      basePrecios,
      referenceBudgets: activeRefs,
      customApiKey: aiConfig.apiKey
    });

    if (backendResult && (backendResult.capitulos?.length > 0 || backendResult.conceptos?.length > 0)) {
      return sanitizeStructuredOutput(backendResult, inputText);
    }
  } catch (backendErr) {
    console.warn('Backend de IA devolvió error o no está disponible, pasando a cliente:', backendErr.message);
  }

  const effectiveSystemPrompt = activeRefs.length > 0
    ? buildGeminiSystemPromptWithReferences(activeRefs)
    : SYSTEM_PROMPT_TECHNICAL_SPECS;

  const promptUser = `
TIPO DE ENTRADA: ${contextType}
PROYECTO: ${projectId || 'Reforma General'}
TEXTO RECIBIDO (TRANSCRIPCIÓN O EMAIL):
"""
${inputText.trim()}
"""

CATÁLOGO OFICIAL DE PRECIOS DISPONIBLE EN LA EMPRESA (UTILIZAR PRIORITARIAMENTE ESTOS CÓDIGOS Y PRECIOS DE REFERENCIA):
${(basePrecios || []).slice(0, 20).map(bp => `- ${bp.codigo}: ${bp.concepto} | Coste Sub: ${bp.costeSubcontrata}€ | PVP: ${bp.precioVenta}€ / ${bp.unidad}`).join('\n')}

${activeRefs.length > 0 ? `PRESUPUESTOS DE REFERENCIA DE LA EMPRESA ACTIVOS (${activeRefs.length}):\nUtiliza los pliegos y estilo técnico canónico aprendido de los documentos de referencia proporcionados.` : ''}

Por favor, procesa esta solicitud conforme a las pautas de redacción técnica contractual de ObraMaster y genera el JSON estructurado exacto.`;

  // 1. If OpenAI API Key is available
  if (aiConfig.apiKey && (aiConfig.provider === 'openai' || !aiConfig.provider)) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey.trim()}`
        },
        body: JSON.stringify({
          model: aiConfig.model || 'chat-latest',
          messages: [
            { role: 'system', content: effectiveSystemPrompt },
            { role: 'user', content: promptUser }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.15
        })
      });

      if (response.ok) {
        const data = await response.json();
        const contentStr = data.choices[0]?.message?.content;
        const parsed = JSON.parse(contentStr);
        return sanitizeStructuredOutput(parsed, inputText);
      }
    } catch (err) {
      console.warn('Error connecting to OpenAI LLM:', err);
    }
  }

  // 2. If Anthropic Claude API Key is available
  if (aiConfig.apiKey && aiConfig.provider === 'anthropic') {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.apiKey.trim(),
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: aiConfig.model || 'claude-sonnet-5-5',
          system: effectiveSystemPrompt,
          messages: [
            { role: 'user', content: promptUser }
          ],
          max_tokens: 3000,
          temperature: 0.15
        })
      });

      if (response.ok) {
        const data = await response.json();
        const textBlock = data.content?.find(b => b.type === 'text')?.text || '';
        const jsonMatch = textBlock.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return sanitizeStructuredOutput(parsed, inputText);
        }
      }
    } catch (err) {
      console.warn('Error connecting to Claude API:', err);
    }
  }

  // 3. If Google Gemini API Key is available
  if (aiConfig.apiKey && aiConfig.provider === 'google') {
    try {
      const geminiModel = normalizeGeminiModel(aiConfig.model || aiConfig.modelName || DEFAULT_GEMINI_MODEL);
      const parsed = await generateBudgetWithGemini({
        promptUser,
        systemPrompt: effectiveSystemPrompt,
        apiKey: aiConfig.apiKey,
        model: geminiModel,
        temperature: 0.15,
        referenceBudgets: activeRefs
      });
      if (parsed) {
        return sanitizeStructuredOutput(parsed, inputText);
      }
    } catch (err) {
      console.error('Error connecting to Google Gemini API:', err);
      throw new Error(USER_FRIENDLY_AI_ERROR);
    }
  }

  // 4. Technical Rule-Based Construction Engine (Deterministic Fallback)
  await new Promise(r => setTimeout(r, 900));
  return parseTextToConstructionSpecs(inputText, basePrecios);
}

/**
 * Sanitizes and verifies the AI JSON response structure
 */
function sanitizeStructuredOutput(parsed, rawInput) {
  const resumen = parsed.resumen_alcance || parsed.resumen_obra || 'Alcance de obra procesado mediante Inteligencia Artificial.';
  const revisada = parsed.transcripcion_revisada || rawInput;
  const redaccion = parsed.redaccion_tecnica_estilo || 
    parsed.resumen_obra ||
    'Ejecución de trabajos según pliego de condiciones técnicas de la empresa, incluyendo medios auxiliares, acopio de materiales y retirada de residuos a vertedero homologado con canon oficial.';

  const capitulos = (parsed.capitulos || []).map((cap, capIdx) => {
    const rawNombre = cap.nombre_capitulo || cap.nombre || (cap.codigo_capitulo ? `${cap.codigo_capitulo}. ${cap.nombre || 'CAPÍTULO'}` : `0${capIdx + 1}. TRABAJOS GENERALES`);
    const nombreCap = rawNombre.trim();
    const codigoCap = cap.codigo_capitulo || cap.codigo || String(capIdx + 1).padStart(2, '0');

    const partidas = (cap.partidas || []).map((p, pIdx) => {
      const med = Number(p.medicion || p.cantidad || 1);
      const precio = Number(p.precio_unitario_estimado || p.precio_unitario || p.precioVenta || 25);
      const tot = Number((p.total_estimado || p.total || (med * precio)).toFixed(2));
      const tituloPartida = p.titulo || p.concepto || 'Partida técnica';
      const descPartida = p.descripcion || p.concepto || 'Suministro e instalación según normativa vigente y pliego de prescripciones técnicas.';

      return {
        id: `part-${Date.now()}-${capIdx}-${pIdx}`,
        codigo: p.codigo || `IA-${String(pIdx + 1).padStart(2, '0')}`,
        titulo: tituloPartida,
        concepto: tituloPartida,
        descripcion: descPartida,
        unidad: p.unidad || 'ud',
        medicion: med,
        cantidad: med,
        precio_unitario_estimado: precio,
        precioUnitario: precio,
        precioVenta: precio,
        costeUnitario: Number((precio * 0.7).toFixed(2)),
        total_estimado: tot,
        total: tot,
        margen_pct: p.margen_pct || p.margenPct || 30
      };
    });

    const subtotalCap = Number(partidas.reduce((s, p) => s + p.total, 0).toFixed(2));

    return {
      id: `cap-${Date.now()}-${capIdx}`,
      codigo: codigoCap,
      nombre_capitulo: nombreCap,
      nombre: nombreCap,
      subtotal: subtotalCap,
      partidas
    };
  });

  return {
    resumen_alcance: resumen,
    resumen_obra: resumen,
    transcripcion_revisada: revisada,
    redaccion_tecnica_estilo: redaccion,
    capitulos
  };
}

/**
 * High-grade rule-based technical specification engine
 */
export function parseTextToConstructionSpecs(rawText, basePrecios = []) {
  const text = (rawText || '').toLowerCase();
  const capitulos = [];

  // 1. Demoliciones
  const hasDemolicion = text.includes('demol') || text.includes('tirar') || text.includes('picar') || text.includes('bañera') || text.includes('azulejo') || text.includes('tabique');
  if (hasDemolicion) {
    const partidasDem = [];
    if (text.includes('tabique') || text.includes('pared')) {
      const matchM2 = text.match(/(\d+(?:[.,]\d+)?)\s*(?:metros|m2|m²)/);
      const cantidad = matchM2 ? parseFloat(matchM2[1].replace(',', '.')) : 12.0;
      partidasDem.push({
        id: `part-${Date.now()}-1`,
        codigo: 'DEM-01',
        titulo: 'Demolición de tabiquería interior y desescombro',
        descripcion: 'Demolición de tabicón de ladrillo cerámico con medios manuales y mecánicos ligeros, rascado de yesos adheridos, corte de instalaciones residuales, acopio en sacas homologadas y transporte a vertedero autorizado con abono de tasas ambientales.',
        unidad: 'm2',
        medicion: cantidad,
        precio_unitario_estimado: 16.88,
        total_estimado: Number((cantidad * 16.88).toFixed(2))
      });
    }

    if (text.includes('azulejo') || text.includes('bañera') || text.includes('baño') || text.includes('picar')) {
      partidasDem.push({
        id: `part-${Date.now()}-2`,
        codigo: 'DEM-02',
        titulo: 'Picado de revestimientos y retirada de aparatos sanitarios',
        descripcion: 'Picado integral de alicatados y solados cerámicos existentes mediante martillo picador, saneado de soporte de mortero, desmontaje de bañera/aparatos sanitarios y carga a contenedor homologado.',
        unidad: 'm2',
        medicion: 24.0,
        precio_unitario_estimado: 13.23,
        total_estimado: 317.52
      });
    }

    if (partidasDem.length > 0) {
      capitulos.push({
        id: `cap-dem-${Date.now()}`,
        nombre_capitulo: '01. DEMOLICIONES Y GESTIÓN DE RESIDUOS',
        subtotal: Number(partidasDem.reduce((s, p) => s + p.total_estimado, 0).toFixed(2)),
        partidas: partidasDem
      });
    }
  }

  // 2. Albañilería & Pladur
  const hasAlba = text.includes('pladur') || text.includes('falso techo') || text.includes('foseado') || text.includes('tabique') || text.includes('solera');
  if (hasAlba) {
    const partidasAlba = [];
    if (text.includes('pladur') || text.includes('falso techo') || text.includes('techo')) {
      partidasAlba.push({
        id: `part-${Date.now()}-3`,
        codigo: 'ALB-02',
        titulo: 'Falso techo continuo de placas de yeso laminado (Pladur)',
        descripcion: 'Suministro e instalación de falso techo continuo suspendido mediante estructura metálica oculta de perfiles TC-47 y placas hidrófugas o estándar de 13mm, incluso pasta de agarre, cinta de juntas y fijaciones antivibratorias.',
        unidad: 'm2',
        medicion: 16.0,
        precio_unitario_estimado: 31.20,
        total_estimado: 499.20
      });
    }

    if (text.includes('foseado') || text.includes('led') || text.includes('candileja')) {
      partidasAlba.push({
        id: `part-${Date.now()}-4`,
        codigo: 'ALB-03',
        titulo: 'Foseado perimetral para alojamiento de iluminación LED indirecta',
        descripcion: 'Formación de foseado o candileja perimetral en falso techo de pladur con cajón de remate escuadrado para alojamiento oculto de tira LED de 24V.',
        unidad: 'ml',
        medicion: 8.5,
        precio_unitario_estimado: 24.30,
        total_estimado: 206.55
      });
    }

    if (partidasAlba.length > 0) {
      capitulos.push({
        id: `cap-alb-${Date.now()}`,
        nombre_capitulo: '02. ALBAÑILERÍA Y TABIQUERÍA SECA',
        subtotal: Number(partidasAlba.reduce((s, p) => s + p.total_estimado, 0).toFixed(2)),
        partidas: partidasAlba
      });
    }
  }

  // 3. Fontanería & Sanitarios
  const hasFonta = text.includes('plato') || text.includes('ducha') || text.includes('multicapa') || text.includes('grifo') || text.includes('inodoro') || text.includes('desagüe') || text.includes('fontanería');
  if (hasFonta) {
    const partidasFonta = [
      {
        id: `part-${Date.now()}-5`,
        codigo: 'FON-01',
        titulo: 'Instalación de red de fontanería multicapa y desagües insonorizados',
        descripcion: 'Instalación interior de tomas de agua fría y caliente sanitaria con tubería multicapa aislada térmicamente, colectores de corte individual y red de desagües en PVC serie insonorizada.',
        unidad: 'ud',
        medicion: 4.0,
        precio_unitario_estimado: 81.25,
        total_estimado: 325.00
      },
      {
        id: `part-${Date.now()}-6`,
        codigo: 'FON-03',
        titulo: 'Suministro e instalación de plato de ducha resina pizarra y mampara',
        descripcion: 'Montaje de plato de ducha de resina mineral con textura pizarra antideslizante clase 3, válvula sifónica de gran caudal de 90mm y mampara fija de cristal templado de seguridad de 8mm con tratamiento antical.',
        unidad: 'ud',
        medicion: 1.0,
        precio_unitario_estimado: 385.00,
        total_estimado: 385.00
      }
    ];

    capitulos.push({
      id: `cap-fon-${Date.now()}`,
      nombre_capitulo: '03. FONTANERÍA, SANEAMIENTO Y SANITARIOS',
      subtotal: Number(partidasFonta.reduce((s, p) => s + p.total_estimado, 0).toFixed(2)),
      partidas: partidasFonta
    });
  }

  // 4. Electricidad
  const hasElec = text.includes('luz') || text.includes('enchufe') || text.includes('cuadro') || text.includes('led') || text.includes('cable') || text.includes('electricidad');
  if (hasElec) {
    const partidasElec = [
      {
        id: `part-${Date.now()}-7`,
        codigo: 'ELE-02',
        titulo: 'Toma de corriente con toma de tierra Schuko 16A',
        descripcion: 'Punto de fuerza con mecanismo serie media conmutado o schuko empotrado, tubo corrugado M-20 y conductores libres de halógenos de 2.5mm² según Reglamento Electrotécnico de Baja Tensión (REBT).',
        unidad: 'ud',
        medicion: 6.0,
        precio_unitario_estimado: 42.50,
        total_estimado: 255.00
      },
      {
        id: `part-${Date.now()}-8`,
        codigo: 'ELE-04',
        titulo: 'Instalación de luminarias empotradas LED extraplanas',
        descripcion: 'Perforación de falso techo y conexionado de downlights LED de 18W regulables con selector de temperatura de color (3000K-4000K) y driver de encendido rápido.',
        unidad: 'ud',
        medicion: 4.0,
        precio_unitario_estimado: 28.60,
        total_estimado: 114.40
      }
    ];

    capitulos.push({
      id: `cap-ele-${Date.now()}`,
      nombre_capitulo: '04. ELECTRICIDAD E ILUMINACIÓN',
      subtotal: Number(partidasElec.reduce((s, p) => s + p.total_estimado, 0).toFixed(2)),
      partidas: partidasElec
    });
  }

  // 5. Revestimientos & Pintura
  const hasPint = text.includes('pint') || text.includes('gotel') || text.includes('alisar') || text.includes('azulejo') || text.includes('porcelánico');
  if (hasPint || capitulos.length === 0) {
    const partidasRev = [];
    if (text.includes('gotel') || text.includes('alisar') || text.includes('rascar')) {
      partidasRev.push({
        id: `part-${Date.now()}-9`,
        codigo: 'PIN-01',
        titulo: 'Alisado de gotelé y tendido de masilla plástica en paramentos',
        descripcion: 'Saneado previo de soporte mediante rascado de gota suelta, aplicación de fondo fijador acrílico penetrante, tendido de dos manos cruzadas de masilla plástica especial alisados, lijado mecánico con aspiración y revisión con foco de luz rasante.',
        unidad: 'm2',
        medicion: 45.0,
        precio_unitario_estimado: 15.60,
        total_estimado: 702.00
      });
    }

    partidasRev.push({
      id: `part-${Date.now()}-10`,
      codigo: 'PIN-02',
      titulo: 'Pintura plástica lisa mate lavable de alta cobertura',
      descripcion: 'Aplicación de dos manos de pintura plástica lavable de base acrílica color a elegir por la dirección facultativa, protección integral de carpinterías, rodapiés y mecanismos con cinta de carrocero y papel protector.',
      unidad: 'm2',
      medicion: 60.0,
      precio_unitario_estimado: 9.75,
      total_estimado: 585.00
    });

    capitulos.push({
      id: `cap-rev-${Date.now()}`,
      nombre_capitulo: '05. REVESTIMIENTOS Y PINTURA DECORATIVA',
      subtotal: Number(partidasRev.reduce((s, p) => s + p.total_estimado, 0).toFixed(2)),
      partidas: partidasRev
    });
  }

  return {
    resumen_alcance: 'Extracción de requerimientos de obra: Demoliciones selectivas, adecuación de instalaciones y acabados según normativa técnica vigente.',
    transcripcion_revisada: rawText.trim(),
    redaccion_tecnica_estilo: 'Ejecución integral de las unidades de obra detalladas conforme a las prescripciones técnicas del Código Técnico de la Edificación (CTE) y pliego de condiciones de ObraMaster, incluyendo suministro de materiales, mano de obra cualificada, medios auxiliares de seguridad y transporte a vertedero homologado.',
    capitulos
  };
}
