/**
 * ObraMaster - Plantilla del correo de pedido / solicitud de presupuesto a proveedor
 *
 * Función pura (sin red ni base de datos): recibe la necesidad de obra, la obra,
 * el proveedor y los datos de la empresa, y devuelve { subject, html, text, items }.
 * El texto sale de la plantilla "pedido_material" o "solicitud_presupuesto" de
 * Ajustes > Correos (src/utils/emailTemplates.js). El administrador puede editar
 * el resultado antes de enviarlo.
 */

import { renderEmail } from "../src/utils/emailTemplates.js";

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
 * @param {object[]} [p.obras]  Varias obras para un mismo pedido (se unen en {{obra}}).
 * @param {object} [p.supplier] Fila de suppliers.
 * @param {object} [p.empresa]  Configuración de la empresa (app_records, "empresa_config"),
 *                              con las plantillas de Ajustes > Correos en plantillasCorreo.
 * @param {string} [p.notes]    Observaciones del pedido.
 * @param {"pedido"|"solicitud_presupuesto"} [p.kind]
 */
export function buildSupplierOrderEmail({ need, obra = {}, obras = [], supplier = {}, empresa = {}, notes = "", kind = "pedido" }) {
  const items = normalizeItems(need.items, need.description);
  const obraList = (Array.isArray(obras) && obras.length ? obras : [obra]).filter(Boolean);
  const obraText = obraList
    .map((o) => [o.codigo, o.titulo].filter(Boolean).join(" - "))
    .filter(Boolean)
    .join(" · ") || [need.obra_id, need.obra_label].filter(Boolean).join(" - ");
  const address = need.delivery_address || obraList[0]?.direccion || "";
  const first = obraList[0] || {};
  const contactName = need.site_contact_name || first.encargado || first.responsable || empresa.personaContacto || "";
  const contactPhone = need.site_contact_phone || first.telefonoEncargado || empresa.telefono || "";

  const tipo = kind === "solicitud_presupuesto" ? "solicitud_presupuesto" : "pedido_material";
  const { subject, html, text } = renderEmail(tipo, {
    saludo: supplier.contact_name ? `Hola ${supplier.contact_name},` : "Buenos días,",
    proveedor: supplier.name || "",
    obra: obraText,
    direccion_entrega: address,
    tajo: need.tajo || "",
    fecha_entrega: formatDate(need.needed_by),
    contacto_obra: [contactName, contactPhone && `(${contactPhone})`].filter(Boolean).join(" "),
    observaciones: notes || need.notes || "",
    urgente: need.urgency === "urgente" ? "URGENTE" : "",
    lineas_material: items
  }, { templates: empresa.plantillasCorreo, empresa });

  return { subject, html, text, items, deliveryAddress: address, contactName, contactPhone };
}
