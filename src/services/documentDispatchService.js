/**
 * ObraMaster - Document Dispatch Service (Email & WhatsApp)
 * 
 * Handles:
 * 1. Email dispatch via the server (/api/documents/send-email -> Resend)
 * 2. WhatsApp dispatch via the server (/api/documents/send-whatsapp -> Meta Cloud API)
 * 3. Instant zero-cost WhatsApp Web / App link generator (wa.me)
 * 4. Correos con plantilla de Ajustes > Correos (/api/email/send)
 * 5. Delivery audit tracking
 */

/**
 * Strips non-digit characters from a phone number and formats with international country code
 */
export function formatPhoneNumberForWhatsApp(phone, defaultCountryCode = '34') {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // If Spanish number starting with 6 or 7 without prefix 34
  if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7') || digits.startsWith('8') || digits.startsWith('9'))) {
    digits = `${defaultCountryCode}${digits}`;
  }
  return digits;
}

/**
 * Builds the direct WhatsApp Web / App link
 */
export function buildWhatsAppDirectUrl({ phone, messageText }) {
  const cleanPhone = formatPhoneNumberForWhatsApp(phone);
  const encodedText = encodeURIComponent(messageText || '');
  if (!cleanPhone) {
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}

async function postToServer(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

/**
 * Envía un correo a través del servidor (Resend). La clave RESEND_API_KEY solo vive
 * en el servidor: nunca en el navegador ni en variables VITE_.
 */
export async function sendEmailDocument({ to, subject, html }) {
  const recipient = (to || '').trim();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('La dirección de correo electrónico del destinatario no es válida.');
  }

  const { ok, status, data } = await postToServer('/api/documents/send-email', { to: recipient, subject, html });
  if (ok) {
    return {
      success: true,
      channel: 'email',
      provider: 'resend',
      deliveryId: data.id,
      recipient,
      message: `Email enviado a ${recipient} a través de Resend (ID: ${data.id}).`
    };
  }

  // Sin correo configurado en el servidor: se simula para no bloquear el flujo.
  if (status === 503 && data.notConfigured) {
    return {
      success: true,
      channel: 'email',
      provider: 'simulated_smtp',
      deliveryId: `mock-mail-${Date.now()}`,
      recipient,
      message: `Envío simulado a ${recipient}. Para enviar correos reales, añade RESEND_API_KEY en el servidor (Render).`
    };
  }
  throw new Error(data.error || `No se pudo enviar el correo (${status}).`);
}

/**
 * Envía un correo con la plantilla de Ajustes > Correos (el servidor la rellena y la envía con Resend).
 * @param {object} p
 * @param {string} p.tipo        presupuesto | factura | pedido_material | solicitud_presupuesto | subcontrata_enlace
 * @param {string} p.to          Uno o varios correos separados por comas.
 * @param {object} p.variables   Valores de las variables de la plantilla.
 * @param {string} [p.asunto]    Asunto editado solo para este envío.
 * @param {string} [p.cuerpo]    Texto editado solo para este envío.
 * @param {{filename: string, content: string}[]} [p.attachments]  Adjuntos en base64 (p. ej. el PDF).
 */
export async function sendTemplateEmail({ tipo, to, variables, asunto, cuerpo, attachments }) {
  const recipient = (to || '').trim();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('La dirección de correo electrónico del destinatario no es válida.');
  }
  const { ok, status, data } = await postToServer('/api/email/send', { tipo, to: recipient, variables, asunto, cuerpo, attachments });
  if (ok) {
    return { success: true, channel: 'email', provider: 'resend', deliveryId: data.id, recipient, message: `Email enviado a ${recipient}.` };
  }
  if (status === 503 && data.notConfigured) {
    return {
      success: true,
      channel: 'email',
      provider: 'simulated_smtp',
      deliveryId: `mock-mail-${Date.now()}`,
      recipient,
      message: `Envío simulado a ${recipient}. Para enviar correos reales, configura Resend (Ajustes > Correos).`
    };
  }
  throw new Error(data.error || `No se pudo enviar el correo (${status}).`);
}

/**
 * Envía un WhatsApp por la Cloud API de Meta a través del servidor
 * (WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID solo en el servidor).
 * Si no está configurada, prepara un enlace wa.me.
 */
export async function sendWhatsAppCloudMessage({ phone, messageText }) {
  const cleanPhone = formatPhoneNumberForWhatsApp(phone);
  if (!cleanPhone || cleanPhone.length < 8) {
    throw new Error('El número de teléfono móvil para WhatsApp no es válido.');
  }

  const { ok, status, data } = await postToServer('/api/documents/send-whatsapp', { phone: cleanPhone, message: messageText });
  if (ok) {
    return {
      success: true,
      channel: 'whatsapp_cloud',
      provider: 'meta_cloud_api',
      messageId: data.id,
      phone: cleanPhone,
      message: `Mensaje de WhatsApp entregado vía Meta Cloud API al +${cleanPhone}.`
    };
  }
  if (!(status === 503 && data.notConfigured)) {
    throw new Error(data.error || `No se pudo enviar el WhatsApp (${status}).`);
  }

  // Fallback to generating direct WhatsApp web link
  const directUrl = buildWhatsAppDirectUrl({ phone: cleanPhone, messageText });
  return {
    success: true,
    channel: 'whatsapp_direct',
    provider: 'wa_me',
    directUrl,
    phone: cleanPhone,
    message: `Enlace directo de WhatsApp preparado para +${cleanPhone}.`
  };
}
