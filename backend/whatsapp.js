/**
 * ObraMaster - Mensajes de WhatsApp para subcontratas
 *
 * - generateWhatsAppAssignmentUrl(): enlace universal wa.me con el mensaje ya escrito
 *   (no necesita ninguna cuenta: lo abre el jefe de obra y pulsa Enviar).
 * - sendWhatsAppCloud(): envío directo opcional con WhatsApp Business Cloud API (Meta),
 *   solo si el servidor tiene WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID.
 *   Ojo: Meta solo deja mandar texto libre si el contacto escribió en las últimas 24 h;
 *   fuera de esa ventana hace falta una plantilla aprobada (WHATSAPP_TEMPLATE_NAME).
 */

const clip = (value, max) => String(value ?? "").trim().slice(0, max);

/** Teléfono en formato internacional sin "+" ni espacios. 9 cifras españolas → prefijo 34. */
export function normalizeWhatsAppPhone(phone) {
  let digits = String(phone || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  digits = digits.replace(/\D/g, "");
  if (digits.length === 9 && /^[6789]/.test(digits)) digits = `34${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

/** Primer nombre útil de "Sergio Navas (Jefe Técnico)" → "Sergio Navas". */
export function contactName(raw, fallback) {
  const name = clip(String(raw || "").replace(/\(.*?\)/g, ""), 80);
  return name || clip(fallback, 80);
}

export function buildAssignmentMessage({ contact, taskKind, taskName, project, url }) {
  const task = taskName ? `${taskKind || "partida"}: '${clip(taskName, 160)}'` : "una tarea";
  return `Hola ${contact || ""}`.trim()
    + `, se os ha asignado la ${task} en la obra '${clip(project, 160)}'.`
    + ` Puedes reportar el avance, avisar si está terminada o solicitar materiales desde este enlace directo: ${url}`;
}

/**
 * URL de WhatsApp lista para abrir (app o web). Sin teléfono válido abre el
 * selector de contacto de WhatsApp con el mensaje escrito.
 * @returns {{ url: string, message: string, phone: string }}
 */
export function generateWhatsAppAssignmentUrl({ phone, project, task, taskKind = "partida", contact = "", url }) {
  const message = buildAssignmentMessage({ contact, taskKind, taskName: task, project, url });
  const number = normalizeWhatsAppPhone(phone);
  return {
    url: `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
    message,
    phone: number
  };
}

export const isWhatsAppCloudConfigured = () =>
  Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

/**
 * Envío directo por WhatsApp Business Cloud API. Con WHATSAPP_TEMPLATE_NAME usa esa
 * plantilla (un parámetro de cuerpo: el mensaje); si no, manda texto libre.
 */
export async function sendWhatsAppCloud({ phone, message }) {
  if (!isWhatsAppCloudConfigured()) {
    throw Object.assign(new Error("WhatsApp Cloud API no está configurada en el servidor."), { status: 503 });
  }
  const to = normalizeWhatsAppPhone(phone);
  if (!to) throw Object.assign(new Error("El teléfono de la subcontrata no es válido para WhatsApp."), { status: 400 });
  const template = clip(process.env.WHATSAPP_TEMPLATE_NAME, 100);
  const payload = template
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: clip(process.env.WHATSAPP_TEMPLATE_LANG, 10) || "es" },
          components: [{ type: "body", parameters: [{ type: "text", text: clip(message, 1000) }] }]
        }
      }
    : { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: true, body: clip(message, 4000) } };

  const response = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = clip(result?.error?.message || `HTTP ${response.status}`, 300);
    throw Object.assign(new Error(`WhatsApp rechazó el envío: ${detail}`), { status: 502 });
  }
  return { id: result?.messages?.[0]?.id || null, to };
}
