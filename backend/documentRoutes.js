/**
 * ObraMaster - Envío de presupuestos y facturas al cliente (solo administradores)
 *
 *   POST /api/documents/send-email     { to, subject, html, attachments? } -> emailService (Resend)
 *   (Para correos con plantilla de Ajustes > Correos, usar POST /api/email/send.)
 *   POST /api/documents/send-whatsapp  { phone, message }        -> WhatsApp Cloud API
 *
 * Antes la web llamaba a Resend y a Meta con VITE_RESEND_API_KEY y
 * VITE_WHATSAPP_ACCESS_TOKEN, que quedaban visibles para cualquiera que abriera la web.
 * Ahora las claves solo existen en el servidor.
 */

import { sendJson, readJson, httpError, clip } from "./notificaciones.js";
import { sendEmail } from "./emailService.js";
import { overSendLimit, loadEmpresa } from "./emailRoutes.js";
import { sendWhatsAppCloud, isWhatsAppCloudConfigured } from "./whatsapp.js";

const MAX_BODY_BYTES = 12 * 1024 * 1024; // PDF adjunto en base64
const MAX_HTML_CHARS = 200 * 1024;

async function handleSendEmail(req, res) {
  const body = await readJson(req, MAX_BODY_BYTES);
  const html = String(body.html || "");
  if (html.length > MAX_HTML_CHARS) throw httpError(413, "El correo es demasiado grande.");
  if (overSendLimit(req.user?.id)) throw httpError(429, "Has enviado demasiados correos en la última hora.");
  const sent = await sendEmail({
    to: clip(body.to, 1000),
    subject: clip(body.subject, 250) || "Documento de obra",
    html,
    text: body.text,
    attachments: body.attachments,
    empresa: await loadEmpresa()
  });
  sendJson(res, 200, { success: true, id: sent.id, recipient: sent.to.join(", ") });
}

async function handleSendWhatsApp(req, res) {
  const body = await readJson(req);
  const message = clip(body.message, 4000);
  if (!message) throw httpError(400, "El mensaje está vacío.");
  if (!isWhatsAppCloudConfigured()) {
    return sendJson(res, 503, { error: "WhatsApp Cloud API no está configurada en el servidor.", notConfigured: true });
  }
  if (overSendLimit(req.user?.id)) throw httpError(429, "Has enviado demasiados mensajes en la última hora.");
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
    if (!res.headersSent) {
      sendJson(res, err.status || 500, { error: err.status ? err.message : "No se pudo enviar el documento.", notConfigured: Boolean(err.notConfigured) });
    }
  }
  return true;
}
