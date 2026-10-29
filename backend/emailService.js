/**
 * ObraMaster - Servicio único de correo (Resend)
 *
 * Todo correo que sale de la app pasa por sendEmail(): presupuestos, facturas,
 * pedidos a proveedor, encargos a subcontratas y el correo de prueba de Ajustes.
 *
 * Variables de entorno (solo servidor):
 *   RESEND_API_KEY     Clave de https://resend.com/api-keys
 *   RESEND_FROM_EMAIL  Remitente, p. ej. "Reformas Marchelo <avisos@tudominio.es>".
 *                      El dominio tiene que estar verificado en Resend. Con
 *                      onboarding@resend.dev solo llega a tu propio correo de Resend.
 *
 * Ajustes > Correos (empresaConfig.correoAjustes): nombre del remitente y copia oculta.
 * Las respuestas van al correo de la empresa (empresaConfig.email).
 */

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const MAX_ATTACHMENTS_BYTES = 8 * 1024 * 1024;

const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const clean = (value, max) => String(value ?? "").trim().slice(0, max);

export const isValidEmail = (value) => EMAIL.test(String(value || "").trim());

/** Lista de correos desde "a@b.es, c@d.es" o un array. Lanza 400 si alguno no es válido. */
export function parseEmailList(value, label = "destinatario") {
  const list = (Array.isArray(value) ? value : String(value || "").split(/[,;]/))
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean);
  const wrong = list.find((s) => !EMAIL.test(s));
  if (wrong) throw httpError(400, `La dirección de correo del ${label} no es válida: ${clean(wrong, 80)}`);
  return [...new Set(list)].slice(0, 20);
}

function fromAddress() {
  const raw = clean(process.env.RESEND_FROM_EMAIL, 300);
  const match = raw.match(/<([^>]+)>/);
  const address = (match ? match[1] : raw).trim();
  const name = match ? raw.slice(0, match.index).trim().replace(/^"|"$/g, "") : "";
  return { raw, address, name };
}

/** Estado para Ajustes > Correos (sin la clave). */
export function emailStatus() {
  const { address, name } = fromAddress();
  const domain = address.split("@")[1]?.toLowerCase() || "";
  return {
    configured: Boolean(process.env.RESEND_API_KEY),
    fromConfigured: Boolean(address),
    from: address,
    fromName: name,
    domain,
    // Dominio de pruebas de Resend: solo entrega al correo con el que te registraste.
    sandbox: !address || domain === "resend.dev"
  };
}

function buildFrom(empresa) {
  const { address, name } = fromAddress();
  if (!address) return "ObraMaster <onboarding@resend.dev>";
  const display = clean(empresa?.correoAjustes?.nombreRemitente, 80).replace(/[<>"\r\n]/g, "")
    || name
    || clean(empresa?.nombreComercial || empresa?.razonSocial, 80).replace(/[<>"\r\n]/g, "");
  return display ? `${display} <${address}>` : address;
}

/** Adjuntos { filename, content (base64) }. Se limita el tamaño total. */
function normalizeAttachments(list) {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  let total = 0;
  const out = list.slice(0, 5).map((a) => {
    const filename = clean(a?.filename, 120).replace(/[\\/\r\n"]/g, "_") || "documento.pdf";
    const content = String(a?.content || "").replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+/]+=*$/.test(content)) throw httpError(400, `El adjunto ${filename} no es válido.`);
    total += Math.floor((content.length * 3) / 4);
    return { filename, content };
  });
  if (total > MAX_ATTACHMENTS_BYTES) throw httpError(413, "Los adjuntos pesan demasiado (máximo 8 MB).");
  return out;
}

function explainResendError(status, message) {
  const text = String(message || "");
  if (/testing emails to your own email|verify a domain/i.test(text)) {
    return "Resend está en modo pruebas: hasta que verifiques tu dominio solo puede enviar a tu propio correo. " +
      "Sigue docs/correo-resend.md y cambia RESEND_FROM_EMAIL a una dirección de tu dominio.";
  }
  if (/domain is not verified/i.test(text)) {
    return "El dominio de RESEND_FROM_EMAIL no está verificado en Resend. Revisa los registros DNS en resend.com/domains.";
  }
  if (status === 401 || (status === 403 && /api key/i.test(text))) return "La clave RESEND_API_KEY no es válida.";
  return `El proveedor de correo rechazó el envío: ${clean(text || `HTTP ${status}`, 300)}`;
}

/**
 * Envía un correo con Resend.
 * @param {object} p
 * @param {string|string[]} p.to
 * @param {string|string[]} [p.cc]
 * @param {string} p.subject
 * @param {string} p.html
 * @param {string} [p.text]
 * @param {object} [p.empresa]         empresaConfig: remitente, respuesta y copia oculta.
 * @param {string} [p.replyTo]         Por defecto, el correo de la empresa.
 * @param {string} [p.idempotencyKey]  Evita duplicados si se pulsa dos veces.
 * @param {{filename: string, content: string}[]} [p.attachments]  content en base64.
 * @returns {Promise<{ id: string|null, to: string[] }>}
 * Errores: status 503 + notConfigured si falta la clave; 502 si Resend lo rechaza.
 */
export async function sendEmail({ to, cc, subject, html, text, empresa = {}, replyTo, idempotencyKey, attachments }) {
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) throw httpError(503, "Falta RESEND_API_KEY en el servidor: no se puede enviar el correo.", { notConfigured: true });

  const recipients = parseEmailList(to);
  if (recipients.length === 0) throw httpError(400, "Falta el correo del destinatario.");
  const payload = {
    from: buildFrom(empresa),
    to: recipients,
    subject: clean(subject, 250).replace(/[\r\n]+/g, " ") || "Mensaje de la obra",
    html: String(html || "")
  };
  if (!payload.html.trim()) throw httpError(400, "El correo está vacío.");
  if (text) payload.text = String(text).slice(0, 100000);
  const ccList = cc ? parseEmailList(cc, "destinatario en copia") : [];
  if (ccList.length) payload.cc = ccList;

  const reply = clean(replyTo || empresa.email, 254);
  if (isValidEmail(reply)) payload.reply_to = reply;
  if (empresa?.correoAjustes?.copiaOculta && isValidEmail(empresa.email) && !recipients.includes(String(empresa.email).toLowerCase())) {
    payload.bcc = [String(empresa.email).trim()];
  }
  const files = normalizeAttachments(attachments);
  if (files) payload.attachments = files;

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = clean(idempotencyKey, 256);

  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers, body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(502, explainResendError(response.status, result?.message || result?.error), { providerStatus: response.status });
  }
  return { id: result.id || null, to: recipients };
}
