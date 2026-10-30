/**
 * ObraMaster Multimodal Site Visit AI Service
 * 
 * Orchestrates:
 * 1. Multimodal ingestion of voice notes, photos, sketches, and laser measurements
 * 2. Crossing with company Official Price Database (Base de Precios Oficial)
 * 3. Detection of implicit tasks (demolitions, rubble disposal, chases, leveling)
 * 4. Structured JSON response containing `conceptos`, `resumen`, and `observaciones_tecnicas`
 * 5. Conversational voice/text refinement console (natural language modifications)
 */

import { generateBudgetWithGemini, normalizeGeminiModel, DEFAULT_GEMINI_MODEL, USER_FRIENDLY_AI_ERROR } from './geminiService';
import { generateBudgetViaBackend } from './backendAiService';

export const SYSTEM_PROMPT_PRESUPUESTADORA = `Eres el Motor Central de Presupuestación e Inteligencia Artificial de "ObraMaster", actuando como un Aparejador / Arquitecto Técnico Colegiado Senior y Estimador de Costes de Construcción en España (conforme a LOE Ley 38/1999, CTE y REBT).

OBJETIVO PRINCIPAL:
Transformar un expediente multimodal de visita de obra (notas de voz transcritas, fotos del estado del inmueble, croquis manuscritos con medidas de distanciómetro láser y requerimientos del cliente) en una propuesta estructurada en formato JSON estricto.

FORMATO DE SALIDA ESTRUCTURADO EN JSON OBLIGATORIO:
Devuelve un objeto JSON con la siguiente estructura exacta:
{
  "resumen": "Breve análisis general del trabajo a realizar...",
  "observaciones_tecnicas": [
    "Punto o advertencia clave identificada en la visita 1",
    "Punto o advertencia clave 2"
  ],
  "conceptos": [
    {
      "codigo": "DEM-01",
      "descripcion": "Demolición de tabique cerámico...",
      "unidad": "m2",
      "cantidad": 14.5,
      "precio_unitario_sugerido": 16.88
    }
  ],
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
          "precioVenta": 16.88
        }
      ]
    }
  ]
}

REGLAS TÉCNICAS OBLIGATORIAS:
1. TRABAJOS IMPLÍCITOS OBLIGATORIOS (DETECCIÓN TÉCNICA):
   - Toda demolición DEBE incluir el desescombro, ensacado y transporte a vertedero homologado o contenedor oficial.
   - Cambio de sanitarios o cocina exige adecuación de acometidas y desagües de fontanería.
   - En pisos altos sin ascensor, aplicar recargo por acopio manual y bajada de escombros.
2. CRUCE CON BASE DE PRECIOS:
   - Utiliza prioritariamente los códigos y precios unitarios del catálogo suministrado.
   - Si una partida demandada no figura en la base, usa código "PROP-IA-XXX".
3. FORMATO DE SALIDA ESTRICTO:
   - Devuelve exclusivamente el JSON sin introducciones ni bloques markdown.`;

/**
 * Predefined site visit templates for instant demonstrations
 */
export const VISITA_TEMPLATES = [
  {
    id: 'visita-reforma-integral-alcala',
    titulo: 'Reforma Integral Vivienda 90m² C/ Alcalá',
    cliente: 'Ignacio San Román & Beatriz Lara',
    telefono: '+34 620 445 112',
    email: 'ignacio.sanroman@gmail.com',
    direccion: 'Calle Alcalá 142, 3º Izq, Madrid',
    calidades: 'Media-Alta (Confort Plus)',
    plazoMeses: '3 meses',
    presupuestoEstimado: 48000,
    audioMuestra: 'Visita inicial en piso de 90 m2 en C/ Alcalá. Es un 3º piso antiguo sin ascensor pero con hueco en escalera para montacargas. Hay gotelé en paredes y techos, queremos alisarlo entero. El salón se une a la cocina tirando tabique de 4.8 metros. Dos baños completos: uno con plato de resina de 140x80 y otro con bañera a sustituir. Suelo de tarima laminada AC5 hidrófuga en toda la casa excepto baños y cocina con porcelánico 60x60. Instalación eléctrica nueva completa con cuadro de 8 circuitos y mecanismos Schneider. Falso techo de pladur con candileja para LED en salón.',
    capturas: []
  },
  {
    id: 'visita-reforma-bano-suite',
    titulo: 'Reforma de Baño Principal y Aseo de Cortesía',
    cliente: 'Doctora Elena Morales',
    telefono: '+34 689 332 109',
    email: 'elena.morales@salud.madrid.org',
    direccion: 'Avenida de América 28, 6ºB, Madrid',
    calidades: 'Alta / Premium',
    plazoMeses: '3 semanas',
    presupuestoEstimado: 14500,
    audioMuestra: 'Reforma de dos cuartos húmedos. En el baño principal de 6 m2 queremos quitar la bañera y poner plato de ducha pizarra antracita enrasado a suelo de 160x80 con grifería termostática empotrada negra mate y mampara fija. Inodoro suspendido con bastidor empotrado Geberit. Mueble de lavabo suspendido de 120cm con doble seno. Alicatado porcelánico rectificado gran formato 60x120 imitación mármol Calacatta. En el aseo de 2.5 m2 inodoro compacto, lavabo sobre encimera de madera y papel vinílico decorativo.',
    capturas: []
  }
];

/**
 * Builds the multimodal payload
 */
export function buildMultimodalAiPayload(expediente, catalog, aiConfig) {
  const realCapturas = (expediente.capturas || []).filter(c => c.isLocalBlob || (c.url && !c.url.includes('images.unsplash.com')));
  const promptUser = `
EXPEDIENTE DE VISITA DE OBRA:
- Cliente: ${expediente.cliente || 'Particular'}
- Dirección de Obra: ${expediente.direccion || 'Madrid'}
- Calidades deseadas: ${expediente.calidades || 'Media-Alta'}
- Margen comercial objetivo: ${expediente.margenGlobalPct || 30}%
- Audio Transcrito / Notas dictadas in situ:
"${expediente.audioTranscripcion || 'Sin notas de audio proporcionadas.'}"

- Medidas tomadas en campo / Croquis:
${expediente.medidasNotas || 'Medidas estándar indicadas en la visita.'}

- Fotografías e Imágenes de Obra Subidas por el Usuario (${realCapturas.length} imágenes reales):
${realCapturas.length > 0 
  ? realCapturas.map((c, i) => `${i + 1}. [${c.tipo || 'foto'}] ${c.titulo} - Notas: ${c.notas || 'Evidencia fotográfica real aportada'}`).join('\n')
  : 'Ninguna foto aportada.'}

CATÁLOGO OFICIAL DE PRECIOS DE LA EMPRESA:
${(catalog || []).slice(0, 30).map(p => `- [${p.codigo}] (${p.capitulo}): ${p.concepto} | Coste subcontrata: ${p.costeSubcontrata}€/${p.unidad} | Margen: ${p.margenPct}% | PVP: ${p.precioVenta}€`).join('\n')}

INSTRUCCIONES DE RESPUESTA:
Devuelve un JSON estructurado con los campos 'resumen', 'observaciones_tecnicas', 'conceptos' y 'capitulos'.
`;

  return {
    systemPrompt: SYSTEM_PROMPT_PRESUPUESTADORA,
    userPrompt: promptUser
  };
}

/**
 * Processes the site visit expediente and compiles structured JSON quote
 */
export async function processSiteVisitExpediente(expediente, catalog, aiConfig, onProgress, referenceBudgets = []) {
  const activeRefs = (referenceBudgets || []).filter(b => b.is_active);

  const margen = Number(expediente.margenGlobalPct || 30);
  const tipoIva = Number(expediente.tipoIvaPct ?? 10);
  const params = expediente.parametrosCliente || null;
  const realCapturas = (expediente.capturas || []).filter(c => c.isLocalBlob || (c.url && !c.url.includes('images.unsplash.com')));

  let rawChapters = [];
  let conceptosSugeridos = [];
  let resumenGeneral = '';
  let observacionesTecnicas = [];
  let generatedBy = '';
  let lastError = null;
  let backendError = null;

  if (onProgress) onProgress({ step: 1, label: 'Preparando dictado, notas y mediciones de la visita...' });

  // Partida de la IA -> partida de presupuesto. El concepto lleva la redacción técnica completa.
  const toPartida = (p, capIdx, pIdx) => {
    const titulo = (p.titulo || p.concepto || '').trim();
    const descripcion = (p.descripcion || '').trim();
    const cantidad = Number(p.cantidad ?? p.medicion ?? 1) || 1;
    const pvp = Number(p.precioVenta ?? p.precio_unitario_estimado ?? p.precio_unitario ?? 0);
    const mPct = Number(p.margenPct ?? p.margen_pct ?? margen);
    const coste = Number(p.costeUnitario ?? (pvp ? pvp / (1 + mPct / 100) : 20));
    return {
      codigo: p.codigo || `${String(capIdx + 1).padStart(2, '0')}.${String(pIdx + 1).padStart(2, '0')}`,
      titulo,
      descripcion,
      concepto: descripcion && titulo && !descripcion.startsWith(titulo) ? `${titulo}. ${descripcion}` : (descripcion || titulo || 'Partida técnica'),
      cantidad,
      unidad: p.unidad || 'ud',
      costeUnitario: Number(coste.toFixed(2)),
      margenPct: mPct
    };
  };

  const toChapters = (capitulos = []) => capitulos
    .filter(cap => Array.isArray(cap.partidas) && cap.partidas.length > 0)
    .map((cap, capIdx) => ({
      id: `cap-${Date.now()}-${capIdx}`,
      codigo: cap.codigo_capitulo || cap.codigo || String(capIdx + 1).padStart(2, '0'),
      nombre: (cap.nombre_capitulo || cap.nombre || `Capítulo ${capIdx + 1}`).replace(/^\d+\.\s*/, ''),
      partidas: cap.partidas.map((p, pIdx) => toPartida(p, capIdx, pIdx))
    }));

  // 1. Servidor: usa las claves del servidor, la memoria de la IA (Ajustes) y los presupuestos de referencia.
  if (onProgress) onProgress({ step: 2, label: activeRefs.length > 0 ? `Aplicando memoria de la IA y ${activeRefs.length} presupuesto(s) de referencia...` : 'Aplicando memoria de la IA...' });
  try {
    if (onProgress) onProgress({ step: 3, label: 'Redactando partidas y agrupando por capítulos...' });
    const result = await generateBudgetViaBackend({
      fotos: realCapturas.map(c => c.file).filter(Boolean),
      dictado: expediente.audioTranscripcion || '',
      medidasNotas: expediente.medidasNotas || '',
      cliente: expediente.cliente || '',
      direccion: expediente.direccion || '',
      calidades: expediente.calidades || 'Media-Alta',
      titulo: expediente.titulo || '',
      plazo: expediente.plazoMeses || '',
      basePrecios: catalog || [],
      referenceBudgets: activeRefs,
      margenGlobal: margen,
      tipoIva,
      parametrosCliente: params
    });
    rawChapters = toChapters(result?.capitulos);
    if (rawChapters.length > 0) {
      resumenGeneral = result.resumen_obra || result.resumen || '';
      observacionesTecnicas = Array.isArray(result.observaciones_tecnicas) ? result.observaciones_tecnicas : [];
      generatedBy = 'el motor de IA del servidor (memoria de la IA + presupuestos de referencia)';
    }
  } catch (backendErr) {
    lastError = backendErr;
    backendError = backendErr;
    console.warn('Servidor de IA no disponible para generar el presupuesto:', backendErr.message);
  }

  // 2. Compatibilidad: clave de Gemini guardada en el navegador (configuraciones antiguas).
  if (rawChapters.length === 0 && aiConfig.apiKey && (aiConfig.provider === 'google' || !aiConfig.provider)) {
    try {
      const combinedInput = [
        expediente.audioTranscripcion ? `[AUDIO TRANSCRITO DE LA VISITA]:\n"${expediente.audioTranscripcion}"` : '',
        expediente.medidasNotas ? `[MEDICIONES Y COTAS DICTADAS IN SITU]:\n${expediente.medidasNotas}` : '',
        `[CALIDADES SOLICITADAS]: ${expediente.calidades || 'Media-Alta'}`,
        params ? `[PARÁMETROS DEL CLIENTE Y CONDICIONES ECONÓMICAS]: tipo de cliente ${params.tipoClienteLabel}; margen ${params.margenComercialPct}%; pago: ${params.condicionesPago}; fiscalidad: ${params.fiscalidadLabel}${params.retencionIrpfPct ? `; retención IRPF ${params.retencionIrpfPct}%` : ''}` : ''
      ].filter(Boolean).join('\n\n');

      const geminiModel = normalizeGeminiModel(aiConfig.model || aiConfig.modelName || DEFAULT_GEMINI_MODEL);
      const promptUser = `
EXPEDIENTE DE VISITA DE OBRA:
- Cliente: ${expediente.cliente || 'Particular'}
- Dirección: ${expediente.direccion || ''}
- Alcance / Dictado de Visita:
"""
${combinedInput}
"""

CATÁLOGO BASE DE PRECIOS DISPONIBLE:
${(catalog || []).slice(0, 25).map(p => `- ${p.codigo}: ${p.concepto} | PVP: ${p.precioVenta}€ / ${p.unidad}`).join('\n')}

Procesa este expediente y devuelve el JSON estructurado con 'resumen', 'observaciones_tecnicas' y 'capitulos' (cada partida con titulo, descripcion técnica completa, unidad, medicion y precio_unitario_estimado).`;

      const aiResponse = await generateBudgetWithGemini({
        promptUser,
        apiKeyInput: aiConfig.apiKey,
        model: geminiModel,
        temperature: 0.15,
        referenceBudgets: activeRefs
      });

      rawChapters = toChapters(aiResponse?.capitulos);
      if (rawChapters.length > 0) {
        resumenGeneral = aiResponse.resumen || aiResponse.resumen_obra || '';
        if (Array.isArray(aiResponse.observaciones_tecnicas)) observacionesTecnicas = aiResponse.observaciones_tecnicas;
        generatedBy = 'Google Gemini (clave del navegador)';
      }
    } catch (geminiErr) {
      lastError = backendError
        ? new Error(`Servidor: ${backendError.message} | Navegador: ${geminiErr.message}`)
        : geminiErr;
      console.warn('Fallo llamada Gemini en visita:', geminiErr.message);
    }
  }

  // Sin IA no se inventan partidas: es mejor avisar que entregar un presupuesto falso.
  if (rawChapters.length === 0) {
    throw new Error(
      lastError?.message
        ? `La IA no ha podido generar el presupuesto. ${lastError.message}`
        : 'La IA no ha devuelto ningún capítulo. Revisa el dictado o la configuración del motor de IA.'
    );
  }

  if (onProgress) onProgress({ step: 4, label: 'Calculando precios, márgenes e IVA...' });

  // Calculate pricing
  const capitulosCalculados = rawChapters.map(cap => {
    const partidasCalc = cap.partidas.map(p => {
      const coste = Number(p.costeUnitario || 10);
      const mPct = Number(p.margenPct || margen);
      const pvp = Number((coste * (1 + mPct / 100)).toFixed(2));
      const tot = Number((pvp * (p.cantidad || 1)).toFixed(2));
      return {
        id: `partida-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        ...p,
        costeUnitario: coste,
        margenPct: mPct,
        precioVenta: pvp,
        total: tot
      };
    });

    const subtotalCap = Number(partidasCalc.reduce((s, p) => s + p.total, 0).toFixed(2));
    const costeCap = Number(partidasCalc.reduce((s, p) => s + (p.costeUnitario * p.cantidad), 0).toFixed(2));

    return {
      ...cap,
      partidas: partidasCalc,
      subtotal: subtotalCap,
      costeTotal: costeCap
    };
  });

  const allPartidas = capitulosCalculados.flatMap(c => c.partidas.map(p => ({ ...p, capitulo: c.nombre })));

  if (conceptosSugeridos.length === 0) {
    conceptosSugeridos = allPartidas.map(p => ({
      codigo: p.codigo,
      descripcion: p.concepto,
      unidad: p.unidad,
      cantidad: p.cantidad,
      precio_unitario_sugerido: p.precioVenta
    }));
  }

  const baseImponible = Number(allPartidas.reduce((s, p) => s + p.total, 0).toFixed(2));
  const cuotaIva = Number((baseImponible * (tipoIva / 100)).toFixed(2));
  const totalConIva = Number((baseImponible + cuotaIva).toFixed(2));
  const costeTotal = Number(allPartidas.reduce((s, p) => s + (p.costeUnitario * p.cantidad), 0).toFixed(2));
  const margenGlobalCalculado = baseImponible > 0 ? Number((((baseImponible - costeTotal) / baseImponible) * 100).toFixed(1)) : margen;

  return {
    id: `pres-ia-${Date.now()}`,
    numero: `PRES-2026-${String(Math.floor(100 + Math.random() * 899))}`,
    version: 1,
    fecha: new Date().toISOString().split('T')[0],
    estado: 'borrador_ia',
    obraTitulo: expediente.titulo || `Reforma ${expediente.cliente}`,
    cliente: expediente.cliente || 'Particular',
    telefono: expediente.telefono || '',
    email: expediente.email || '',
    direccion: expediente.direccion || '',
    calidades: expediente.calidades || 'Media-Alta',
    tipoIvaPct: tipoIva,
    ...(params ? {
      nif: params.nif || '',
      tipoCliente: params.tipoCliente,
      condicionesPago: params.condicionesPago,
      fiscalidad: params.fiscalidad,
      inversionSujetoPasivo: !!params.inversionSujetoPasivo,
      retencionIrpfPct: Number(params.retencionIrpfPct || 0),
      validezDias: Number(params.validezDias || 30),
      notasLegales: [
        `Forma de pago: ${params.condicionesPago}.`,
        `Validez de la oferta: ${params.validezDias || 30} días.`,
        params.inversionSujetoPasivo ? 'Operación con inversión del sujeto pasivo (art. 84.Uno.2º.f de la Ley 37/1992 del IVA).' : '',
        params.retencionIrpfPct ? `Retención de IRPF estimada: ${params.retencionIrpfPct}%.` : ''
      ].filter(Boolean).join(' ')
    } : {}),
    margenGlobalPct: margenGlobalCalculado,
    baseImponible,
    cuotaIva,
    totalConIva,
    costeTotal,
    resumen: resumenGeneral,
    // Notas y mediciones de la visita: las usa el croquis 2D.
    medidasNotas: expediente.medidasNotas || '',
    observaciones_tecnicas: observacionesTecnicas,
    conceptos: conceptosSugeridos,
    capitulos: capitulosCalculados,
    partidas: allPartidas,
    aiGenerationSummary: `Generado por ${generatedBy}.`,
    historialRefinados: [
      {
        fecha: new Date().toLocaleTimeString().substring(0, 5),
        comando: 'Ingesta inicial multimodal y generación de conceptos estructurados',
        resultado: `Generados ${conceptosSugeridos.length} conceptos y ${capitulosCalculados.length} capítulos.`
      }
    ]
  };
}

/**
 * Applies conversational voice/text commands
 */
export async function applyVoiceCommandToQuote(currentQuote, commandText, aiConfig = {}) {
  const cleanCmd = (commandText || '').toLowerCase();
  let changelog = '';
  let updatedCapitulos = JSON.parse(JSON.stringify(currentQuote.capitulos || []));

  // First, check if Gemini AI can process the voice command intelligently
  if (aiConfig?.apiKey && (aiConfig?.provider === 'google' || !aiConfig?.provider)) {
    try {
      const geminiModel = normalizeGeminiModel(aiConfig.model || aiConfig.modelName || DEFAULT_GEMINI_MODEL);
      const promptUser = `
PRESUPUESTO ACTUAL (ESTRUCTURA DE CAPÍTULOS Y PARTIDAS):
${JSON.stringify(updatedCapitulos, null, 2)}

INSTRUCCIÓN DE VOZ / TEXTO DEL USUARIO:
"${commandText}"

INSTRUCCIONES OBLIGATORIAS:
1. Aplica la instrucción ÚNICAMENTE a las partidas o capítulos específicamente mencionados por el usuario (por ejemplo, si menciona "fon-03", "demolición", "baño", o un código de partida específico, modifica SOLAMENTE esas partidas).
2. NO modifiques otras partidas salvo que el usuario pida explícitamente un cambio "global", "a todo el presupuesto" o "a todas las partidas".
3. Devuelve un objeto JSON con la clave "capitulos" que contenga la lista completa de capítulos y sus partidas actualizadas, y una clave "changelog" con la explicación en español de qué partidas específicas han sido modificadas.
`;

      const aiResponse = await generateBudgetWithGemini({
        promptUser,
        apiKeyInput: aiConfig.apiKey,
        model: geminiModel,
        temperature: 0.1,
        systemPrompt: "Eres el asistente de revisión de presupuestos de ObraMaster. Devuelve un JSON estructurado con 'capitulos' y 'changelog'."
      });

      if (aiResponse?.capitulos && Array.isArray(aiResponse.capitulos) && aiResponse.capitulos.length > 0) {
        updatedCapitulos = aiResponse.capitulos.map(cap => ({
          ...cap,
          partidas: (cap.partidas || []).map(p => {
            const coste = Number(p.costeUnitario || 0);
            const margen = Number(p.margenPct || 30);
            const cant = Number(p.cantidad || 1);
            const pvp = Number((coste * (1 + margen / 100)).toFixed(2));
            const tot = Number((pvp * cant).toFixed(2));
            return {
              ...p,
              costeUnitario: coste,
              margenPct: margen,
              cantidad: cant,
              precioVenta: pvp,
              total: tot
            };
          })
        }));
        changelog = aiResponse.changelog || `Ajuste aplicado por IA según instrucción: "${commandText}"`;
      }
    } catch (err) {
      console.warn('Fallback a procesamiento heurístico para comando de voz:', err.message);
    }
  }

  // Fallback heuristic if Gemini did not run or was not configured
  if (!changelog) {
    const allPartidas = updatedCapitulos.flatMap(c => c.partidas);
    const targetPartidaIds = new Set();
    const targetCapituloIds = new Set();

    // Match partida by item code (e.g., "fon-03", "dem-01")
    allPartidas.forEach(p => {
      const codeClean = (p.codigo || '').toLowerCase();
      if (codeClean && cleanCmd.includes(codeClean)) {
        targetPartidaIds.add(p.id);
      }
    });

    // Match chapter by code or name
    updatedCapitulos.forEach(c => {
      const capCodeClean = (c.codigo || '').toLowerCase();
      const capNameClean = (c.nombre || '').toLowerCase();
      if ((capCodeClean && cleanCmd.includes(capCodeClean)) ||
          (capNameClean && cleanCmd.split(' ').some(word => word.length > 3 && capNameClean.includes(word)))) {
        targetCapituloIds.add(c.id);
      }
    });

    const isGlobal = cleanCmd.includes('global') || cleanCmd.includes('todas') || cleanCmd.includes('todo el presupuesto') || cleanCmd.includes('todos los capitulos');
    const marginMatch = cleanCmd.match(/(\d+)\s*%/);

    if (marginMatch) {
      const newMargin = Number(marginMatch[1]);

      updatedCapitulos = updatedCapitulos.map(c => {
        const isTargetCap = targetCapituloIds.has(c.id);

        const newPartidas = c.partidas.map(p => {
          const isTargetItem = targetPartidaIds.has(p.id);
          const shouldUpdate = isGlobal || isTargetItem || (targetPartidaIds.size === 0 && isTargetCap);

          if (shouldUpdate) {
            const pvp = Number((p.costeUnitario * (1 + newMargin / 100)).toFixed(2));
            return {
              ...p,
              margenPct: newMargin,
              precioVenta: pvp,
              total: Number((pvp * p.cantidad).toFixed(2)),
              _modificadoIa: true
            };
          }
          return p;
        });

        return { ...c, partidas: newPartidas };
      });

      if (targetPartidaIds.size > 0) {
        const codesStr = Array.from(targetPartidaIds)
          .map(id => allPartidas.find(p => p.id === id)?.codigo)
          .filter(Boolean)
          .join(', ');
        changelog += `Margen ajustado al ${newMargin}% en la(s) partida(s) especificada(s): ${codesStr}. `;
      } else if (targetCapituloIds.size > 0 && !isGlobal) {
        changelog += `Margen ajustado al ${newMargin}% en el capítulo especificado. `;
      } else if (isGlobal || (targetPartidaIds.size === 0 && targetCapituloIds.size === 0)) {
        changelog += `Margen comercial ajustado al ${newMargin}% global. `;
      }
    }

    if (cleanCmd.includes('demolicion') || cleanCmd.includes('demolición') || cleanCmd.includes('ascensor')) {
      const demCap = updatedCapitulos.find(c => c.nombre.toLowerCase().includes('demolic') || c.codigo === '01');
      if (demCap) {
        demCap.partidas = demCap.partidas.map(p => {
          const extraFactor = 1.05;
          const newCoste = Number((p.costeUnitario * extraFactor).toFixed(2));
          const newPvp = Number((newCoste * (1 + p.margenPct / 100)).toFixed(2));
          return {
            ...p,
            costeUnitario: newCoste,
            precioVenta: newPvp,
            total: Number((newPvp * p.cantidad).toFixed(2)),
            _modificadoIa: true
          };
        });
        changelog += 'Recargo del +5% en demolición por condicionantes de acceso. ';
      }
    }

    if (!changelog) {
      changelog = `Instrucción interpretada: "${commandText}". Partidas recalculadas.`;
    }
  }

  updatedCapitulos = updatedCapitulos.map(c => {
    const subtotal = Number(c.partidas.reduce((s, p) => s + p.total, 0).toFixed(2));
    const coste = Number(c.partidas.reduce((s, p) => s + (p.costeUnitario * p.cantidad), 0).toFixed(2));
    return { ...c, subtotal, costeTotal: coste };
  });

  const flatPartidas = updatedCapitulos.flatMap(c => c.partidas.map(p => ({ ...p, capitulo: c.nombre })));
  const baseImponible = Number(flatPartidas.reduce((s, p) => s + p.total, 0).toFixed(2));
  const cuotaIva = Number((baseImponible * (currentQuote.tipoIvaPct / 100)).toFixed(2));
  const totalConIva = Number((baseImponible + cuotaIva).toFixed(2));
  const costeTotal = Number(flatPartidas.reduce((s, p) => s + (p.costeUnitario * p.cantidad), 0).toFixed(2));
  const margenGlobalCalculado = baseImponible > 0 ? Number((((baseImponible - costeTotal) / baseImponible) * 100).toFixed(1)) : currentQuote.margenGlobalPct;

  return {
    ...currentQuote,
    version: (currentQuote.version || 1) + 1,
    baseImponible,
    cuotaIva,
    totalConIva,
    costeTotal,
    margenGlobalPct: margenGlobalCalculado,
    capitulos: updatedCapitulos,
    partidas: flatPartidas,
    _lastChangelog: changelog
  };
}
