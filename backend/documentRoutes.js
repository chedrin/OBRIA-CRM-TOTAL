/**
 * ObraMaster - Envío de presupuestos y facturas al cliente (solo administradores)
 *
 *   POST /api/documents/send-email     { to, subject, html }     -> Resend (RESEND_API_KEY)
 *   POST /api/documents/send-whatsapp  { phone, message }        -> WhatsApp Cloud API
 *
 * Antes la web llamaba a Resend y a Meta con VITE_RESEND_API_KEY y
 * VITE_WHATSAPP_ACCESS_TOKEN, que quedaban visibles para cualquiera que abriera la web.
 * Ahora las claves solo existen en el servidor.
 */

import { sendJson, readJson, httpError, clip, getAppRecord } from "./notificaciones.js";
import { sendWhatsAppCloud, isWhatsAppCloudConfigured } from "./whatsapp.js";

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const MAX_HTML_CHARS = 200 * 1024;

// Límite por usuario para que una sesión robada no se use para mandar spam.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 60;
const sends = new Map();
function overLimit(userId) {
  const key = String(userId || "local");
  const now = Date.now();
  const entry = sends.get(key);
  if (!entry || entry.reset < now) {
    sends.set(key, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SENDS_PER_WINDOW;
}

async function handleSendEmail(req, res) {
  const body = await readJson(req);
  const to = clip(body.to, 254).toLowerCase();
  if (!EMAIL.test(to)) throw httpError(400, "La dirección de correo del destinatario no es válida.");
  const subject = clip(body.subject, 250).replace(/[\r\n]+/g, " ") || "Documento de obra";
  const html = String(body.html || "");
  if (!html.trim()) throw httpError(400, "El correo está vacío.");
  if (html.length > MAX_HTML_CHARS) throw httpError(413, "El correo es demasiado grande.");

  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    // La web lo muestra como "envío simulado" para no romper el flujo sin correo configurado.
    return sendJson(res, 503, { error: "Falta RESEND_API_KEY en el servidor.", notConfigured: true });
  }
  if (overLimit(req.user?.id)) throw httpError(429, "Has enviado demasiados correos en la última hora.");

  const empresa = (await getAppRecord("empresa_config", "main").catch(() => null)) || {};
  const payload = {
    from: process.env.RESEND_FROM_EMAIL || "ObraMaster <presupuestos@obramaster.app>",
    to: [to],
    subject,
    html
  };
  if (empresa.email && EMAIL.test(String(empresa.email))) payload.reply_to = String(empresa.email);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = clip(result?.message || result?.error || `HTTP ${response.status}`, 300);
    throw httpError(502, `El proveedor de correo rechazó el envío: ${detail}`);
  }
  sendJson(res, 200, { success: true, id: result.id || null, recipient: to });
}

async function handleSendWhatsApp(req, res) {
  const body = await readJson(req);
  const message = clip(body.message, 4000);
  if (!message) throw httpError(400, "El mensaje está vacío.");
  if (!isWhatsAppCloudConfigured()) {
    return sendJson(res, 503, { error: "WhatsApp Cloud API no está configurada en el servidor.", notConfigured: true });
  }
  if (overLimit(req.user?.id)) throw httpError(429, "Has enviado demasiados mensajes en la última hora.");
  const sent = await sendWhatsAppCloud({ phone: body.phone, message });
  sendJson(res, 200, { success: true, ...sent });
}

/** Llamar DESPUÉS de enforceApiAuth: estas rutas no están en la lista de obreros, así que son de administrador. */
export async function handleDocumentRoutes(req, res, pathname) {
  if (pathname !== "/api/documents/send-email" && pathname !== "/api/documents/send-whatsapp") return false;
  try {
    if (req.method !== "POST") throw httpError(405, "Método no permitido.");
    if (req.user && req.user.role !== "admin") throw httpError(403, "Solo administradores.");
    if (pathname.endsWith("send-email")) await handleSendEmail(req, res);
    else await handleSendWhatsApp(req, res);
  } catch (err) {
    if (!err.status) console.error("[documentos]", err?.message || err);
    if (!res.headersSent) sendJson(res, err.status || 500, { error: err.status ? err.message : "No se pudo enviar el documento." });
  }
  return true;
}
