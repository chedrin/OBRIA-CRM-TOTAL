/**
 * ObraMaster - Plantilla del correo de pedido / solicitud de presupuesto a proveedor
 *
 * Función pura (sin red ni base de datos): recibe la necesidad de obra, la obra,
 * el proveedor y los datos de la empresa, y devuelve { subject, html, text, items }.
 * El administrador puede editar el resultado antes de enviarlo.
 */

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/** Normaliza las líneas de material: [{ material, cantidad, unidad, notas }]. */
export function normalizeItems(items, fallbackDescription = "") {
  const list = Array.isArray(items) ? items : [];
  const clean = list
    .map((item) => ({
      material: String(item?.material ?? item?.descripcion ?? "").trim().slice(0, 300),
      cantidad: item?.cantidad === "" || item?.cantidad == null ? "" : String(item.cantidad).trim().slice(0, 30),
      unidad: String(item?.unidad ?? "").trim().slice(0, 30),
      notas: String(item?.notas ?? "").trim().slice(0, 300)
    }))
    .filter((item) => item.material);
  if (clean.length === 0 && fallbackDescription) {
    clean.push({ material: String(fallbackDescription).trim().slice(0, 300), cantidad: "", unidad: "", notas: "" });
  }
  return clean.slice(0, 100);
}

/**
 * @param {object} p
 * @param {object} p.need       Fila de worksite_needs.
 * @param {object} [p.obra]     Registro de la obra (app_records, colección "obras").
 * @param {object} [p.supplier] Fila de suppliers.
 * @param {object} [p.empresa]  Configuración de la empresa (app_records, "empresa_config").
 * @param {"pedido"|"solicitud_presupuesto"} [p.kind]
 */
export function buildSupplierOrderEmail({ need, obra = {}, supplier = {}, empresa = {}, kind = "pedido" }) {
  const items = normalizeItems(need.items, need.description);
  const obraCode = obra.codigo || need.obra_id || "";
  const obraTitle = obra.titulo || need.obra_label || "";
  const address = obra.direccion || need.delivery_address || "";
  const neededBy = formatDate(need.needed_by);
  const contactName = need.site_contact_name || obra.encargado || obra.responsable || empresa.personaContacto || "";
  const contactPhone = need.site_contact_phone || obra.telefonoEncargado || empresa.telefono || "";
  const companyName = empresa.nombreComercial || empresa.razonSocial || "ObraMaster";
  const isQuote = kind === "solicitud_presupuesto";

  const subjectParts = [
    isQuote ? "Solicitud de presupuesto" : "Pedido de material",
    obraCode && `Obra ${obraCode}`,
    address && `Entrega: ${address}`,
    need.urgency === "urgente" && "URGENTE"
  ].filter(Boolean);
  const subject = subjectParts.join(" · ").slice(0, 250);

  const greeting = supplier.contact_name ? `Hola ${supplier.contact_name},` : "Buenos días,";
  const intro = isQuote
    ? "Les pedimos precio y plazo de entrega para el siguiente material:"
    : "Les hacemos el siguiente pedido de material para entregar en obra:";

  const rowsText = items
    .map((it) => `- ${it.material}${it.cantidad ? ` · ${it.cantidad}${it.unidad ? ` ${it.unidad}` : ""}` : ""}${it.notas ? ` (${it.notas})` : ""}`)
    .join("\n");

  const text = [
    greeting,
    "",
    intro,
    "",
    rowsText,
    "",
    `Obra: ${[obraCode, obraTitle].filter(Boolean).join(" - ")}`,
    address && `Dirección de entrega: ${address}`,
    need.tajo && `Tajo / zona: ${need.tajo}`,
    neededBy && `Fecha límite de entrega en obra: ${neededBy}`,
    contactName && `Contacto en obra para la descarga: ${contactName}${contactPhone ? ` (${contactPhone})` : ""}`,
    "",
    isQuote
      ? "Por favor, respondan a este correo con su oferta."
      : "Por favor, confirmen disponibilidad y fecha de entrega respondiendo a este correo.",
    "",
    "Un saludo,",
    companyName,
    [empresa.telefono, empresa.email].filter(Boolean).join(" · ")
  ]
    .filter((line) => line !== false && line !== undefined && line !== null && line !== 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  const td = 'style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"';
  const rowsHtml = items
    .map(
      (it) =>
        `<tr><td ${td}>${escapeHtml(it.material)}${it.notas ? `<br><span style="color:#64748b;font-size:12px;">${escapeHtml(it.notas)}</span>` : ""}</td>` +
        `<td ${td} align="right">${escapeHtml(it.cantidad)}</td><td ${td}>${escapeHtml(it.unidad)}</td></tr>`
    )
    .join("");

  const infoRow = (label, value) =>
    value
      ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(value)}</td></tr>`
      : "";

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
  <h2 style="margin:0 0 4px;font-size:18px;">${escapeHtml(isQuote ? "Solicitud de presupuesto" : "Pedido de material")}${need.urgency === "urgente" ? ' <span style="color:#dc2626;">· URGENTE</span>' : ""}</h2>
  <p style="margin:0 0 16px;color:#64748b;font-size:13px;">${escapeHtml([obraCode, obraTitle].filter(Boolean).join(" - "))}</p>
  <p style="margin:0 0 8px;">${escapeHtml(greeting)}</p>
  <p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
  <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
    <thead><tr style="background:#f1f5f9;text-align:left;">
      <th style="padding:8px 10px;">Material</th><th style="padding:8px 10px;" align="right">Cantidad</th><th style="padding:8px 10px;">Unidad</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <table cellspacing="0" cellpadding="0" style="font-size:14px;margin-bottom:20px;">
    ${infoRow("Dirección de entrega", address)}
    ${infoRow("Tajo / zona", need.tajo)}
    ${infoRow("Entregar antes de", neededBy)}
    ${infoRow("Contacto para la descarga", [contactName, contactPhone].filter(Boolean).join(" · "))}
  </table>
  <p style="margin:0 0 16px;">${escapeHtml(isQuote ? "Por favor, respondan a este correo con su oferta." : "Por favor, confirmen disponibilidad y fecha de entrega respondiendo a este correo.")}</p>
  <p style="margin:0;">Un saludo,<br><strong>${escapeHtml(companyName)}</strong><br><span style="color:#64748b;font-size:13px;">${escapeHtml([empresa.telefono, empresa.email].filter(Boolean).join(" · "))}</span></p>
</div>
</body></html>`;

  return { subject, html, text, items, deliveryAddress: address, contactName, contactPhone };
}
