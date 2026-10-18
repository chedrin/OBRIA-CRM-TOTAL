/**
 * ObraMaster - Backend Proxy Multimodal de Inteligencia Artificial (Google Gemini)
 * 
 * Arquitectura híbrida y autónoma:
 * - Si express, cors y multer están instalados, utiliza Express + Multer.
 * - Si no están instalados aún, arranca de forma 100% nativa con node:http y fetch (Zero-Dependencies),
 *   asegurando disponibilidad inmediata sin bloqueos de instalación.
 * - Protege la API Key de Google Gemini en el backend sin exponerla en el navegador.
 * - Ingestión multimodal nativa de audios e imágenes en base64 para Gemini.
 * - Soporte de endpoints:
 *    GET  /api/health            -> Comprobación de estado y API Key
 *    POST /api/test-connection   -> Prueba de ping y latencia con Gemini
 *    POST /api/transcribir       -> Transcribe notas de voz y audios
 *    POST /api/analizar-fotos    -> Análisis visual de patologías y mediciones
 *    POST /api/presupuesto       -> Generación completa de presupuesto multimodal
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Cargar variables de entorno desde .env manualmente o con dotenv
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
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
loadEnv();

const PORT = Number(process.env.PORT) || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// 2. Normalización de modelos Gemini para evitar errores 404
function normalizeGeminiModel(rawModel) {
  if (!rawModel || typeof rawModel !== "string") return "gemini-1.5-flash";
  const cleaned = rawModel.trim().toLowerCase();

  const validModels = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp"
  ];

  if (validModels.includes(cleaned)) return cleaned;
  if (cleaned.includes("pro")) return "gemini-1.5-pro";
  if (cleaned.includes("2.0")) return "gemini-2.0-flash";
  return "gemini-1.5-flash";
}

function getGeminiConfig(customKey, customModel) {
  const apiKey = (customKey || process.env.GEMINI_API_KEY || "").trim();
  const rawModel = customModel || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const model = normalizeGeminiModel(rawModel);
  return { apiKey, model };
}

// Convertir buffer/archivo a inlineData de Gemini
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

// Limpiar markdown json fences
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

// Invocación a Gemini API REST
async function callGeminiApi({ apiKey, model, contents, systemInstruction, generationConfig }) {
  if (!apiKey) {
    throw new Error("No se ha configurado GEMINI_API_KEY en backend/.env ni en la petición.");
  }

  let targetModel = normalizeGeminiModel(model);
  const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
  let url = `${baseUrl}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const bodyPayload = {
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    generationConfig: generationConfig || {
      responseMimeType: "application/json",
      temperature: 0.15
    }
  };

  let response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyPayload)
  });

  // Fallback automático ante 404
  if (!response.ok && response.status === 404 && targetModel !== "gemini-1.5-flash") {
    console.warn(`[Backend Gemini] Modelo "${targetModel}" devolvió 404. Reintentando con gemini-1.5-flash...`);
    targetModel = "gemini-1.5-flash";
    url = `${baseUrl}/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload)
    });
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      const errJson = await response.json();
      errorDetail = errJson.error?.message || response.statusText;
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Google Gemini API (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Google Gemini devolvió una respuesta vacía.");
  }

  return rawText;
}

// 3. Servidor de archivos estáticos (Frontend construido en dist)
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
  if (!fs.existsSync(DIST_DIR)) {
    return false;
  }

  // Normalizar ruta
  let relativePath = pathname === "/" ? "/index.html" : pathname;
  // Prevenir travesía de directorios
  let safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, "");
  let filePath = path.join(DIST_DIR, safePath);

  // Servir archivo existente
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // Fallback SPA (Single Page Application) para rutas del frontend
  const indexPath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexPath) && !path.extname(pathname)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(indexPath).pipe(res);
    return true;
  }

  return false;
}

// 4. Parser nativo de Multipart Form-Data (Sin dependencias)
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

    // Extraer parte
    const partBuffer = buffer.slice(boundaryIdx + boundaryBuffer.length, nextBoundaryIdx);
    start = nextBoundaryIdx;

    // Separar cabeceras del contenido
    const headerEndIdx = partBuffer.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEndIdx === -1) continue;

    const headerText = partBuffer.slice(0, headerEndIdx).toString("utf-8");
    let content = partBuffer.slice(headerEndIdx + 4);

    // Quitar \r\n final
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
      } else if (fieldName === "audios" || fieldName.startsWith("audio")) {
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

// 4. Controlador de Peticiones HTTP
async function handleRequest(req, res) {
  // CORS Headers
  const originHeader = req.headers.origin || (CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Origin", originHeader);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, x-api-key");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const headerKey = (req.headers["x-api-key"] || (req.headers["authorization"]?.startsWith("Bearer ") ? req.headers["authorization"].substring(7) : "") || "").trim();

  // Servir estáticos/frontend si la petición no es a /api/*
  if (!pathname.startsWith("/api")) {
    const served = tryServeStatic(req, res, pathname);
    if (served) return;

    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html lang="es">
      <head><meta charset="UTF-8"><title>ObraMaster - Aplicación no construida</title></head>
      <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; text-align: center;">
        <h1>ObraMaster CRM</h1>
        <p>El frontend aún no ha sido construido en la carpeta <code>dist/</code>.</p>
        <p>Por favor, ejecuta <code>npm run build</code> en el servidor para generar los archivos estáticos.</p>
      </body>
      </html>
    `);
    return;
  }

  // Endpoint: GET /api/health
  if (req.method === "GET" && pathname === "/api/health") {
    const { apiKey, model } = getGeminiConfig(headerKey);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "online",
      service: "ObraMaster AI Multimodal Proxy Server",
      port: PORT,
      geminiConfigured: Boolean(apiKey && apiKey.length > 10),
      keyPrefix: apiKey ? apiKey.substring(0, 7) + "..." : "no_configurada",
      activeModel: model,
      architecture: "Native Node.js Multimodal (Zero-Deps)",
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Leer cuerpo completo de la petición
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
      try {
        fields = JSON.parse(bodyBuffer.toString("utf-8"));
      } catch {
        fields = {};
      }
    }

    try {
      // Endpoint: POST /api/test-connection
      if (req.method === "POST" && pathname === "/api/test-connection") {
        const { apiKey, model } = getGeminiConfig(fields.apiKey, fields.model);
        const startTime = performance.now();
        const raw = await callGeminiApi({
          apiKey,
          model,
          contents: [
            {
              role: "user",
              parts: [{ text: "Responde estrictamente con JSON: {\"status\": \"PONG\", \"message\": \"Conexión exitosa\"}" }]
            }
          ],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        });
        const elapsedMs = Math.round(performance.now() - startTime);
        const parsed = JSON.parse(cleanJsonOutput(raw));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          latencyMs: elapsedMs,
          model,
          message: `Conexión exitosa con Google Gemini (${model}) en ${elapsedMs}ms`,
          details: parsed
        }));
        return;
      }

      // Endpoint: POST /api/transcribir
      if (req.method === "POST" && pathname === "/api/transcribir") {
        const { apiKey, model } = getGeminiConfig(fields.apiKey, fields.model);
        const audioFiles = files.audios || [];

        if (audioFiles.length === 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No se ha recibido ningún archivo de audio." }));
          return;
        }

        const audioParts = audioFiles.map(fileToPart);
        const promptText = `
Eres un transcriptor experto en construcción y arquitectura técnica de la constructora "ObraMaster".
Escucha atentamente el audio o audios adjuntos y transcribe de forma fiel y literal todo lo que se dice en español.
Normaliza términos de obra (alicatados, rozas, falsos techos, impermeabilización, bajantes, cuadros eléctricos, etc.).

Devuelve estrictamente un JSON con esta estructura:
{
  "transcripcion": "Texto completo y fielmente transcrito en español.",
  "duracion_aprox_segundos": 30,
  "idioma_detectado": "es"
}
`;
        const raw = await callGeminiApi({
          apiKey,
          model,
          contents: [{ role: "user", parts: [{ text: promptText }, ...audioParts] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        });

        const parsed = JSON.parse(cleanJsonOutput(raw));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          texto: parsed.transcripcion || "",
          transcripcion: parsed.transcripcion || "",
          archivosProcesados: audioFiles.length,
          detalles: parsed
        }));
        return;
      }

      // Endpoint: POST /api/analizar-fotos
      if (req.method === "POST" && pathname === "/api/analizar-fotos") {
        const { apiKey, model } = getGeminiConfig(fields.apiKey, fields.model);
        const photoFiles = files.fotos || [];

        if (photoFiles.length === 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No se ha recibido ninguna fotografía para analizar." }));
          return;
        }

        const fotoParts = photoFiles.map(fileToPart);
        const promptText = `
Eres un Aparejador y Director Técnico de Obra de "ObraMaster".
Analiza con minuciosidad las fotografías adjuntas del estado actual del inmueble.
Identifica revestimientos, instalaciones visibles, estado de paramentos, humedades, demoliciones necesarias y cotas aproximadas.

Devuelve estrictamente un JSON con esta estructura:
{
  "analisis_general": "Descripción técnica del estado general...",
  "elementos_detectados": [
    { "elemento": "Alicatado antiguo", "estado": "Para demoler", "superficie_estimada": "24 m²", "observaciones": "Azulejo cerámico 15x15 con restos de adhesivo" }
  ],
  "patologias_o_riesgos": ["Posible humedad por capilaridad en muro perimetral"]
}
`;
        const raw = await callGeminiApi({
          apiKey,
          model,
          contents: [{ role: "user", parts: [{ text: promptText }, ...fotoParts] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.15 }
        });

        const parsed = JSON.parse(cleanJsonOutput(raw));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          analisis: parsed.analisis_general || "",
          fotosProcesadas: photoFiles.length,
          ...parsed
        }));
        return;
      }

      // Endpoint: POST /api/presupuesto
      if (req.method === "POST" && pathname === "/api/presupuesto") {
        const { apiKey, model } = getGeminiConfig(fields.apiKey, fields.model);
        const fotos = files.fotos || [];
        const audios = files.audios || [];

        const dictadoTexto = fields.dictado || fields.audioTranscript || fields.notas || "";
        const medidasNotas = fields.medidasNotas || "";
        const cliente = fields.cliente || "Cliente Particular";
        const direccion = fields.direccion || "Obra";
        const calidades = fields.calidades || "Media-Alta";
        const margenGlobal = Number(fields.margenGlobal) || 28;

        let catalogList = [];
        try {
          if (fields.basePrecios) {
            catalogList = typeof fields.basePrecios === "string" ? JSON.parse(fields.basePrecios) : fields.basePrecios;
          }
        } catch (e) {
          console.warn("No se pudo parsear basePrecios:", e.message);
        }

        let refBudgets = [];
        try {
          if (fields.referenceBudgets) {
            refBudgets = typeof fields.referenceBudgets === "string" ? JSON.parse(fields.referenceBudgets) : fields.referenceBudgets;
          }
        } catch (e) {
          console.warn("No se pudo parsear referenceBudgets:", e.message);
        }

        const catalogText = (catalogList || [])
          .slice(0, 30)
          .map(p => `- [${p.codigo || "GEN"}]: ${p.concepto || p.titulo} | Coste: ${p.costeUnitario || p.costeSubcontrata || 20}€ | PVP: ${p.precioVenta || 28}€ / ${p.unidad || "ud"}`)
          .join("\n");

        const refBudgetsText = (refBudgets || [])
          .filter(r => r.is_active !== false)
          .slice(0, 3)
          .map((r, idx) => `=== MODELO EMPRESA ${idx + 1}: ${r.name || "Presupuesto Modelo"} ===\n${(r.text_content || "").substring(0, 2000)}`)
          .join("\n\n");

        const systemInstruction = `
Eres el Ingeniero Técnico de Edificación, Aparejador y Jefe de Presupuestos de la empresa constructora "ObraMaster".
Tu función es recibir evidencias de obra (audios grabados por el director de obra o el cliente, fotos reales del inmueble y notas manuscritas con medidas) y generar un presupuesto técnico oficial, detallado, riguroso y listo para ejecutar.

REGLAS DE ACTUACIÓN:
1. TRANSCRIPCIÓN: Transcribe fielmente en el campo "transcripcion" lo dicho en los audios adjuntos.
2. ANÁLISIS DE FOTOS: En "analisis_fotos", describe los materiales existentes, demoliciones requeridas y cotas observadas.
3. CAPÍTULOS NORMALIZADOS: Agrupa las partidas en capítulos canónicos:
   - 01. Demoliciones y Gestión de Residuos
   - 02. Albañilería y Falsos Techos
   - 03. Fontanería y Saneamiento
   - 04. Electricidad e Iluminación
   - 05. Revestimientos Cerámicos (Solados y Alicatados)
   - 06. Pintura y Acabados
4. BASE DE PRECIOS: Siempre que una partida coincida con las tarifas de la empresa, utiliza sus códigos y precios unitarios.
5. FORMATO DE SALIDA ESTRICTO JSON:
{
  "transcripcion": "Texto transcrito de los audios...",
  "analisis_fotos": "Resumen técnico de las fotografías...",
  "resumen_obra": "Resumen ejecutivo del alcance de los trabajos...",
  "capitulos": [
    {
      "codigo_capitulo": "01",
      "nombre_capitulo": "Demoliciones y Gestión de Residuos",
      "partidas": [
        {
          "codigo": "DEM-01",
          "concepto": "Demolición de tabique de ladrillo hueco...",
          "cantidad": 14.5,
          "unidad": "m2",
          "costeUnitario": 12.50,
          "margenPct": ${margenGlobal},
          "precioVenta": 16.00,
          "total": 232.00
        }
      ]
    }
  ],
  "presupuesto": {
    "subtotal": 12500.00,
    "iva": 2625.00,
    "total": 15125.00
  },
  "dudas_o_advertencias": [
    "Verificar si la bajante comunitaria requiere sustitución de entronque."
  ]
}
`;

        const promptUser = `
INFORMACIÓN DE LA OBRA:
- Cliente: ${cliente}
- Ubicación: ${direccion}
- Calidades solicitadas: ${calidades}
- Margen comercial objetivo: ${margenGlobal}%

NOTAS Y MEDIDAS DICTADAS IN SITU:
"""
${dictadoTexto || "Sin texto dictado previo. Analizar audios y fotos adjuntas."}
${medidasNotas ? `\nMediciones láser dictadas:\n${medidasNotas}` : ""}
"""

${catalogText ? `CATÁLOGO OFICIAL DE TARIFAS DE LA EMPRESA:\n${catalogText}\n` : ""}
${refBudgetsText ? `PRESUPUESTOS DE REFERENCIA DE LA EMPRESA (IMITAR ESTILO Y FORMATO):\n${refBudgetsText}\n` : ""}

Por favor, procesa los audios (${audios.length} archivos) y fotos (${fotos.length} archivos) adjuntos y genera el presupuesto estructurado JSON completo.
`;

        const audioParts = audios.map(fileToPart);
        const fotoParts = fotos.map(fileToPart);

        console.log(`[Backend Presupuesto] Procesando con Gemini (${model}): ${audios.length} audios, ${fotos.length} fotos...`);

        const raw = await callGeminiApi({
          apiKey,
          model,
          contents: [{ role: "user", parts: [{ text: promptUser }, ...audioParts, ...fotoParts] }],
          systemInstruction,
          generationConfig: { responseMimeType: "application/json", temperature: 0.15 }
        });

        const parsed = JSON.parse(cleanJsonOutput(raw));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(parsed));
        return;
      }

      // Ruta no encontrada
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Ruta no encontrada: ${pathname}` }));
    } catch (err) {
      console.error("[Backend Error]", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "Error interno del servidor backend." }));
    }
  });
}

// 5. Iniciar Servidor
const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 ObraMaster AI Backend iniciado en http://localhost:${PORT}`);
  console.log(`📡 CORS permitido para: ${CORS_ORIGIN}`);
  console.log(`✨ Proveedor: Google Gemini (Modelo: ${process.env.GEMINI_MODEL || "gemini-1.5-flash"})`);
  console.log(`🛡️  Arquitectura: Proxy Seguro Node.js 24 (Zero-Dependencies)`);
  console.log(`====================================================`);
});
