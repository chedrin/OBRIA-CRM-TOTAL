/**
 * ObraMaster - Document Dispatch Service (Email & WhatsApp)
 * 
 * Handles:
 * 1. Email dispatch via the server (/api/documents/send-email -> Resend)
 * 2. WhatsApp dispatch via the server (/api/documents/send-whatsapp -> Meta Cloud API)
 * 3. Instant zero-cost WhatsApp Web / App link generator (wa.me)
 * 4. Professional HTML email templating for Budgets and Invoices
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

/**
 * Generates responsive professional HTML email for quotes or invoices
 */
export function generateDocumentEmailHtml({
  documentType = 'presupuesto', // 'presupuesto' | 'factura'
  documentNumber = '',
  documentTitle = '',
  clientName = '',
  clientNif = '',
  totalAmount = 0,
  baseImponible = 0,
  cuotaIva = 0,
  ivaPct = 10,
  companyName = 'ObraMaster Construcción & Reformas',
  companyCif = 'B-84920184',
  companyPhone = '+34 910 234 567',
  directorName = 'Director de Obra',
  actionUrl = '',
  customNotes = ''
}) {
  const isInvoice = documentType === 'factura';
  const typeLabel = isInvoice ? 'Factura Oficial de Obra' : 'Presupuesto Técnico de Obra';
  const actionButtonText = isInvoice ? 'Descargar Factura y Justificante' : 'Revisar y Firmar Digitalmente (LOE)';
  const formattedTotal = Number(totalAmount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedBase = Number(baseImponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formattedIva = Number(cuotaIva || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${typeLabel} - ${documentNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; line-height: 1.5; }
    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 18px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; border-bottom: 1px solid #334155; text-align: center; }
    .badge { display: inline-block; background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .content { padding: 28px 24px; }
    .doc-box { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .row.total { border-top: 1px solid #334155; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #fbbf24; }
    .btn { display: block; text-align: center; background: #f59e0b; color: #0f172a !important; padding: 14px 24px; border-radius: 12px; font-weight: 800; font-size: 15px; text-decoration: none; margin: 28px 0 16px 0; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
    .footer { background: #0f172a; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">${companyName}</div>
      <h1 style="margin: 0; font-size: 22px; color: #ffffff;">${typeLabel}</h1>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Referencia Oficial: <strong>${documentNumber}</strong></p>
    </div>

    <div class="content">
      <p style="font-size: 15px; margin-top: 0;">Estimado/a <strong>${clientName}</strong>,</p>
      <p style="font-size: 13px; color: #cbd5e1;">
        Te remitimos el documento contractual correspondiente a <strong>${documentTitle}</strong> emitido por el Director de Obra de <strong>${companyName}</strong>.
      </p>

      ${customNotes ? `<div style="background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6; padding: 10px 14px; margin: 16px 0; font-size: 12px; color: #93c5fd;">${customNotes}</div>` : ''}

      <div class="doc-box">
        <div class="row">
          <span style="color: #94a3b8;">Cliente:</span>
          <strong>${clientName} ${clientNif ? `(${clientNif})` : ''}</strong>
        </div>
        <div class="row">
          <span style="color: #94a3b8;">Fecha de Emisión:</span>
          <span>${new Date().toLocaleDateString('es-ES')}</span>
        </div>
        <div class="row">
          <span style="color: #94a3b8;">Base Imponible:</span>
          <span>${formattedBase} €</span>
        </div>
        <div class="row">
          <span style="color: #94a3b8;">IVA (${ivaPct}%):</span>
          <span>${formattedIva} €</span>
        </div>
        <div class="row total">
          <span>Total con IVA:</span>
          <span>${formattedTotal} €</span>
        </div>
      </div>

      <a href="${actionUrl || '#'}" class="btn" target="_blank">${actionButtonText}</a>

      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Conforme a la Ley de Ordenación de la Edificación (LOE 38/1999) y normativa técnica vigente.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>${companyName}</strong> · CIF: ${companyCif}</p>
      <p style="margin: 0;">Atención al Cliente y Dirección de Obra: ${companyPhone} · ${directorName}</p>
    </div>
  </div>
</body>
</html>
`;
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
