/**
 * ObraMaster - Correo con plantillas (solo administradores)
 *
 *   GET  /api/email/status   Estado de Resend para Ajustes > Correos (sin la clave).
 *   POST /api/email/test     { to }  Correo de prueba.
 *   POST /api/email/send     { tipo, to, cc?, variables, asunto?, cuerpo?, attachments? }
 *        Rellena la plantilla del tipo (Ajustes > Correos) y la envía.
 *        asunto/cuerpo cambian el texto solo para este envío.
 *
 * El envío real lo hace emailService.sendEmail (Resend).
 */

import { sendJson, readJson, httpError, clip, getAppRecord } from "./notificaciones.js";
import { emailStatus, sendEmail } from "./emailService.js";
import { DEFAULT_EMAIL_TEMPLATES, renderEmail } from "../src/utils/emailTemplates.js";
import { normalizeItems } from "./supplierEmail.js";

const MAX_BODY_BYTES = 12 * 1024 * 1024; // PDF adjunto en base64

// Límite por usuario para que una sesión robada no se use para mandar spam.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 60;
const sends = new Map();
export function overSendLimit(userId) {
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

export const loadEmpresa = async () => (await getAppRecord("empresa_config", "main").catch(() => null)) || {};

function cleanVariables(raw) {
  const vars = {};
  for (const [key, value] of Object.entries(raw && typeof raw === "object" ? raw : {}).slice(0, 60)) {
    if (!/^[a-z_]{1,40}$/.test(key)) continue;
    vars[key] = key === "lineas_material" ? normalizeItems(value) : clip(value, 2000);
  }
  if (vars.enlace && !/^https?:\/\//i.test(vars.enlace)) vars.enlace = "";
  return vars;
}

async function handleSend(req, res) {
  const body = await readJson(req, MAX_BODY_BYTES);
  const tipo = String(body.tipo || "");
  if (!DEFAULT_EMAIL_TEMPLATES[tipo]) throw httpError(400, "Tipo de correo desconocido.");
  if (overSendLimit(req.user?.id)) throw httpError(429, "Has enviado demasiados correos en la última hora.");
  const empresa = await loadEmpresa();
  const email = renderEmail(tipo, cleanVariables(body.variables), {
    templates: empresa.plantillasCorreo,
    empresa,
    override: { asunto: clip(body.asunto, 250), cuerpo: String(body.cuerpo || "").slice(0, 20000) }
  });
  const sent = await sendEmail({
    to: body.to,
    cc: body.cc,
    ...email,
    empresa,
    attachments: body.attachments,
    idempotencyKey: body.idempotency_key ? `${tipo}-${clip(body.idempotency_key, 120)}` : undefined
  });
  sendJson(res, 200, { success: true, id: sent.id, recipients: sent.to, subject: email.subject });
}

async function handleTest(req, res) {
  const body = await readJson(req);
  if (overSendLimit(req.user?.id)) throw httpError(429, "Has enviado demasiados correos en la última hora.");
  const empresa = await loadEmpresa();
  const status = emailStatus();
  const nombre = empresa.nombreComercial || empresa.razonSocial || "ObraMaster";
  const html = `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
<h2 style="margin:0 0 12px;">Correo de prueba de ${nombre}</h2>
<p>Si lees esto, el envío de correos de la app funciona.</p>
<p style="color:#64748b;font-size:13px;">Remitente: ${status.from || "(sin RESEND_FROM_EMAIL)"}${status.sandbox ? " · dominio de pruebas de Resend" : ""}</p>
</body></html>`;
  const sent = await sendEmail({ to: body.to, subject: `Prueba de correo · ${nombre}`, html, text: "Si lees esto, el envío de correos de la app funciona.", empresa });
  sendJson(res, 200, { success: true, id: sent.id, recipients: sent.to });
}

/** Llamar DESPUÉS de enforceApiAuth: rutas de administrador. */
export async function handleEmailRoutes(req, res, pathname) {
  if (!pathname.startsWith("/api/email/")) return false;
  try {
    if (req.user && req.user.role !== "admin") throw httpError(403, "Solo administradores.");
    if (pathname === "/api/email/status" && req.method === "GET") sendJson(res, 200, emailStatus());
    else if (pathname === "/api/email/test" && req.method === "POST") await handleTest(req, res);
    else if (pathname === "/api/email/send" && req.method === "POST") await handleSend(req, res);
    else throw httpError(404, "Ruta no encontrada.");
  } catch (err) {
    if (!err.status) console.error("[correo]", err?.message || err);
    if (!res.headersSent) {
      sendJson(res, err.status || 500, { error: err.status ? err.message : "No se pudo enviar el correo.", notConfigured: Boolean(err.notConfigured) });
    }
  }
  return true;
}
