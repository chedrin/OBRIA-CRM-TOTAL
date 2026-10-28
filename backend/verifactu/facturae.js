/**
 * ObraMaster - Factura electrónica en formato Facturae 3.2.2 (sin firmar)
 *
 * Sirve para enviar facturas a administraciones públicas (FACe) y, mientras no
 * se publique el formato definitivo de la factura electrónica entre empresas,
 * a clientes que la pidan. Para FACe hay que firmarla (XAdES): se puede hacer
 * gratis con AutoFirma (formato "FacturaE") y el mismo certificado.
 */

import { escapeXml } from "./xml.js";

const NS_FE = "http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml";
const NS_DS = "http://www.w3.org/2000/09/xmldsig#";

const MOTIVOS_RECTIFICACION = {
  R1: ["80", "Cálculo de cuotas repercutidas"],
  R2: ["85", "Base imponible modificada cuotas repercutidas no satisfechas. Auto de declaración de concurso"],
  R3: ["85", "Base imponible modificada cuotas repercutidas no satisfechas. Auto de declaración de concurso"],
  R4: ["80", "Cálculo de cuotas repercutidas"]
};

const m2 = (v) => (Math.round(Number(v || 0) * 100) / 100).toFixed(2);
const m6 = (v) => Number(Number(v || 0).toFixed(6)).toString();

function tag(name, value) {
  return `<${name}>${escapeXml(value)}</${name}>`;
}

function wrap(name, inner) {
  return `<${name}>${inner}</${name}>`;
}

function personaTipo(nif) {
  return /^[0-9XYZKLM]/.test(nif) ? "F" : "J";
}

function direccion({ direccion, codigoPostal, municipio, provincia }, quien) {
  const cp = String(codigoPostal || "").trim();
  if (!/^\d{5}$/.test(cp)) throw Object.assign(new Error(`Falta el código postal (5 cifras) de ${quien} para la factura electrónica.`), { status: 400 });
  if (!String(municipio || "").trim() || !String(provincia || "").trim()) {
    throw Object.assign(new Error(`Faltan el municipio o la provincia de ${quien} para la factura electrónica.`), { status: 400 });
  }
  return wrap("AddressInSpain",
    tag("Address", String(direccion || "").slice(0, 80)) +
    tag("PostCode", cp) +
    tag("Town", String(municipio).slice(0, 50)) +
    tag("Province", String(provincia).slice(0, 20)) +
    tag("CountryCode", "ESP")
  );
}

/** Persona física: nombre y apellidos a partir del nombre completo ("Nombre Apellido1 Apellido2"). */
function individual(nombreCompleto, dir) {
  const partes = String(nombreCompleto || "").trim().split(/\s+/);
  const nombre = partes.shift() || "-";
  const apellido1 = partes.shift() || "-";
  return wrap("Individual",
    tag("Name", nombre.slice(0, 40)) +
    tag("FirstSurname", apellido1.slice(0, 40)) +
    (partes.length ? tag("SecondSurname", partes.join(" ").slice(0, 40)) : "") +
    dir
  );
}

function parte(nif, nombre, dir) {
  const tipo = personaTipo(nif);
  return wrap("TaxIdentification",
    tag("PersonTypeCode", tipo) + tag("ResidenceTypeCode", "R") + tag("TaxIdentificationNumber", nif)
  ) + (tipo === "F" ? individual(nombre, dir) : wrap("LegalEntity", tag("CorporateName", String(nombre).slice(0, 80)) + dir));
}

function impuesto(tipoCodigo, pct, base, cuota) {
  return wrap("Tax",
    tag("TaxTypeCode", tipoCodigo) +
    tag("TaxRate", m2(pct)) +
    wrap("TaxableBase", tag("TotalAmount", m2(base))) +
    wrap("TaxAmount", tag("TotalAmount", m2(cuota)))
  );
}

function lineas(factura, ivaPct) {
  const base = Number(factura.base_imponible);
  const propias = Array.isArray(factura.lineas) ? factura.lineas.filter((l) => l && l.concepto) : [];
  const suma = propias.reduce((s, l) => s + Number(l.importe || 0), 0);
  // Si las líneas no suman la base (p. ej. certificación de un porcentaje), una sola línea con la base.
  const usar = propias.length && Math.abs(suma - base) < 0.01
    ? propias
    : [{ concepto: factura.descripcion || "Ejecución de obra", cantidad: 1, precio: base, importe: base }];
  return usar.map((l) => {
    const importe = Number(l.importe || 0);
    const cantidad = Number(l.cantidad) || 1;
    return wrap("InvoiceLine",
      tag("ItemDescription", String(l.concepto).slice(0, 2500)) +
      tag("Quantity", m6(cantidad)) +
      tag("UnitOfMeasure", "01") +
      tag("UnitPriceWithoutTax", m6(importe / cantidad)) +
      tag("TotalCost", m6(importe)) +
      tag("GrossAmount", m6(importe)) +
      wrap("TaxesOutputs", impuesto("01", ivaPct, importe, factura.isp ? 0 : importe * ivaPct / 100))
    );
  }).join("");
}

/**
 * @param factura   fila de invoices (emitida)
 * @param empresa   fila de companies
 * @param original  fila de invoices rectificada (solo rectificativas)
 * @param textoIsp  mención legal de la inversión del sujeto pasivo
 */
export function generarFacturae({ factura, empresa, original, textoIsp }) {
  if (factura.status !== "ISSUED") throw Object.assign(new Error("Solo se exportan facturas emitidas."), { status: 400 });
  const rectificativa = factura.tipo_factura !== "F1";
  const ivaPct = factura.isp ? 0 : Number(factura.iva_pct);
  const base = Number(factura.base_imponible);
  const cuota = Number(factura.cuota_iva);
  const irpf = Number(factura.cuota_irpf);
  const total = Number(factura.liquido);
  const partes = String(factura.num_serie).split("-");
  const numero = partes.pop();
  const serie = partes.join("-");

  const vendedor = parte(empresa.nif, empresa.razon_social, direccion({
    direccion: empresa.domicilio, codigoPostal: empresa.codigo_postal, municipio: empresa.municipio, provincia: empresa.provincia
  }, "tu empresa (Ajustes > Facturación)"));
  const comprador = parte(factura.cliente_nif, factura.cliente_nombre, direccion({
    direccion: factura.cliente_direccion, codigoPostal: factura.cliente_codigo_postal,
    municipio: factura.cliente_municipio, provincia: factura.cliente_provincia
  }, "el cliente"));

  let correctiva = "";
  if (rectificativa) {
    if (!original) throw new Error("Falta la factura rectificada.");
    const [codigo, descripcion] = MOTIVOS_RECTIFICACION[factura.tipo_factura] || MOTIVOS_RECTIFICACION.R1;
    const op = String(original.num_serie).split("-");
    const opNumero = op.pop();
    correctiva = wrap("Corrective",
      tag("InvoiceNumber", opNumero) +
      tag("InvoiceSeriesCode", op.join("-")) +
      tag("ReasonCode", codigo) +
      tag("ReasonDescription", descripcion) +
      wrap("TaxPeriod", tag("StartDate", original.fecha_expedicion) + tag("EndDate", original.fecha_expedicion)) +
      tag("CorrectionMethod", factura.tipo_rectificativa === "S" ? "01" : "02") +
      tag("CorrectionMethodDescription", factura.tipo_rectificativa === "S" ? "Rectificación íntegra" : "Rectificación por diferencias") +
      tag("AdditionalReasonDescription", String(factura.rectificacion_causa || "").slice(0, 2500))
    );
  }

  const literales = [factura.isp ? textoIsp : "", factura.iva_motivo || ""].filter(Boolean);

  const invoice = wrap("Invoice",
    wrap("InvoiceHeader",
      tag("InvoiceNumber", numero) +
      tag("InvoiceSeriesCode", serie) +
      tag("InvoiceDocumentType", "FC") +
      tag("InvoiceClass", rectificativa ? "OR" : "OO") +
      correctiva
    ) +
    wrap("InvoiceIssueData",
      tag("IssueDate", factura.fecha_expedicion) +
      (factura.fecha_operacion && factura.fecha_operacion !== factura.fecha_expedicion ? tag("OperationDate", factura.fecha_operacion) : "") +
      tag("InvoiceCurrencyCode", "EUR") +
      tag("TaxCurrencyCode", "EUR") +
      tag("LanguageName", "es")
    ) +
    wrap("TaxesOutputs", impuesto("01", ivaPct, base, cuota)) +
    (irpf ? wrap("TaxesWithheld", impuesto("04", factura.irpf_pct, base, irpf)) : "") +
    wrap("InvoiceTotals",
      tag("TotalGrossAmount", m2(base)) +
      tag("TotalGrossAmountBeforeTaxes", m2(base)) +
      tag("TotalTaxOutputs", m2(cuota)) +
      tag("TotalTaxesWithheld", m2(irpf)) +
      tag("InvoiceTotal", m2(total)) +
      tag("TotalOutstandingAmount", m2(total)) +
      tag("TotalExecutableAmount", m2(total))
    ) +
    wrap("Items", lineas(factura, ivaPct)) +
    (factura.fecha_vencimiento
      ? wrap("PaymentDetails", wrap("Installment",
          tag("InstallmentDueDate", factura.fecha_vencimiento) +
          tag("InstallmentAmount", m2(total)) +
          tag("PaymentMeans", "04") // transferencia
        ))
      : "") +
    (literales.length ? wrap("LegalLiterals", literales.map((t) => tag("LegalReference", String(t).slice(0, 250))).join("")) : "")
  );

  return '<?xml version="1.0" encoding="UTF-8"?>' +
    `<fe:Facturae xmlns:fe="${NS_FE}" xmlns:ds="${NS_DS}">` +
    wrap("FileHeader",
      tag("SchemaVersion", "3.2.2") +
      tag("Modality", "I") +
      tag("InvoiceIssuerType", "EM") +
      wrap("Batch",
        tag("BatchIdentifier", `${empresa.nif}${factura.num_serie}`.slice(0, 70)) +
        tag("InvoicesCount", "1") +
        wrap("TotalInvoicesAmount", tag("TotalAmount", m2(total))) +
        wrap("TotalOutstandingAmount", tag("TotalAmount", m2(total))) +
        wrap("TotalExecutableAmount", tag("TotalAmount", m2(total))) +
        tag("InvoiceCurrencyCode", "EUR")
      )
    ) +
    wrap("Parties", wrap("SellerParty", vendedor) + wrap("BuyerParty", comprador)) +
    wrap("Invoices", invoice) +
    "</fe:Facturae>";
}
