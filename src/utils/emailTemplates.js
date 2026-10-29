/**
 * ObraMaster - Plantillas de correo editables (Ajustes > Correos)
 *
 * Módulo puro: lo usan la web (editor y vista previa) y el servidor (envío).
 * Cada tipo de correo tiene un asunto y un cuerpo en texto con variables {{nombre}}.
 * Las plantillas propias se guardan en empresaConfig.plantillasCorreo = { tipo: { asunto, cuerpo } };
 * lo que falte se toma de DEFAULT_EMAIL_TEMPLATES.
 *
 * Reglas del cuerpo:
 *  - Una línea en blanco separa párrafos.
 *  - Si una línea tiene variables y todas están vacías, la línea no se envía
 *    (así "Tajo: {{tajo}}" desaparece cuando no hay tajo).
 *  - {{enlace}} solo en su línea se pinta como botón; dentro de una frase, como enlace.
 *  - {{lineas_material}} se pinta como tabla (HTML) o lista (texto).
 *  - Una variable que no existe se deja tal cual, para que se vea el error al revisar.
 */

const COMMON_VARIABLES = [
  { key: 'empresa', label: 'Nombre comercial de la empresa' },
  { key: 'empresa_telefono', label: 'Teléfono de la empresa' },
  { key: 'empresa_email', label: 'Correo de la empresa' },
  { key: 'firma', label: 'Persona que firma (director de obra)' }
];

const DOCUMENT_VARIABLES = [
  { key: 'cliente', label: 'Nombre del cliente' },
  { key: 'numero', label: 'Número del documento' },
  { key: 'obra', label: 'Obra o título' },
  { key: 'base', label: 'Base imponible (€)' },
  { key: 'iva', label: 'Cuota de IVA (€)' },
  { key: 'total', label: 'Total con IVA (€)' },
  { key: 'fecha', label: 'Fecha del documento' },
  { key: 'enlace', label: 'Enlace para verlo o firmarlo (opcional)' }
];

const SUPPLIER_VARIABLES = [
  { key: 'saludo', label: '"Hola <contacto>," o "Buenos días,"' },
  { key: 'proveedor', label: 'Nombre del proveedor' },
  { key: 'obra', label: 'Obra u obras (código y título)' },
  { key: 'direccion_entrega', label: 'Dirección de entrega' },
  { key: 'tajo', label: 'Tajo o zona' },
  { key: 'fecha_entrega', label: 'Fecha límite de entrega' },
  { key: 'contacto_obra', label: 'Contacto en obra para la descarga' },
  { key: 'observaciones', label: 'Observaciones del pedido' },
  { key: 'urgente', label: '"URGENTE" si lo es' },
  { key: 'lineas_material', label: 'Tabla con el material' }
];

export const EMAIL_TEMPLATE_TYPES = [
  {
    id: 'presupuesto',
    label: 'Presupuesto al cliente',
    description: 'Se envía desde Presupuestos con el PDF adjunto.',
    variables: [...DOCUMENT_VARIABLES, ...COMMON_VARIABLES]
  },
  {
    id: 'factura',
    label: 'Factura al cliente',
    description: 'Se envía desde Facturas con el PDF adjunto.',
    variables: [...DOCUMENT_VARIABLES, { key: 'vencimiento', label: 'Fecha de vencimiento' }, { key: 'iban', label: 'IBAN para el pago' }, ...COMMON_VARIABLES]
  },
  {
    id: 'pedido_material',
    label: 'Pedido de material a proveedor',
    description: 'Borradores de Avisos y Pedidos. Se revisan antes de enviar.',
    variables: [...SUPPLIER_VARIABLES, ...COMMON_VARIABLES]
  },
  {
    id: 'solicitud_presupuesto',
    label: 'Petición de precio a proveedor',
    description: 'Igual que el pedido, pero pidiendo oferta.',
    variables: [...SUPPLIER_VARIABLES, ...COMMON_VARIABLES]
  },
  {
    id: 'subcontrata_enlace',
    label: 'Encargo a subcontrata',
    description: 'Enlace directo para que la subcontrata reporte avance, fin de trabajo o necesidades.',
    variables: [
      { key: 'contacto', label: 'Persona de contacto de la subcontrata' },
      { key: 'subcontrata', label: 'Nombre de la subcontrata' },
      { key: 'tarea', label: 'Fase o partida encargada' },
      { key: 'obra', label: 'Obra' },
      { key: 'caduca', label: 'Fecha de caducidad del enlace' },
      { key: 'enlace', label: 'Enlace directo' },
      ...COMMON_VARIABLES
    ]
  }
];

export const DEFAULT_EMAIL_TEMPLATES = {
  presupuesto: {
    asunto: 'Presupuesto {{numero}} · {{obra}} · {{empresa}}',
    cuerpo: [
      'Hola {{cliente}},',
      '',
      'Te enviamos el presupuesto {{numero}} para {{obra}}. Lo tienes adjunto en PDF.',
      '',
      'Base imponible: {{base}} €',
      'IVA: {{iva}} €',
      'Total: {{total}} €',
      '',
      '{{enlace}}',
      '',
      'Si quieres cambiar algo o tienes cualquier duda, responde a este correo o llámanos al {{empresa_telefono}}.',
      '',
      'Un saludo,',
      '{{firma}}',
      '{{empresa}}'
    ].join('\n')
  },
  factura: {
    asunto: 'Factura {{numero}} · {{obra}} · {{empresa}}',
    cuerpo: [
      'Hola {{cliente}},',
      '',
      'Te adjuntamos la factura {{numero}} correspondiente a {{obra}}, por un total de {{total}} €.',
      '',
      'Vencimiento: {{vencimiento}}',
      'Pago por transferencia a: {{iban}}',
      '',
      '{{enlace}}',
      '',
      'Gracias por confiar en nosotros.',
      '',
      'Un saludo,',
      '{{firma}}',
      '{{empresa}}'
    ].join('\n')
  },
  pedido_material: {
    asunto: 'Pedido de material · {{obra}} {{urgente}}',
    cuerpo: [
      '{{saludo}}',
      '',
      'Les hacemos el siguiente pedido de material para entregar en obra:',
      '',
      '{{lineas_material}}',
      '',
      'Obra: {{obra}}',
      'Dirección de entrega: {{direccion_entrega}}',
      'Tajo / zona: {{tajo}}',
      'Fecha límite de entrega en obra: {{fecha_entrega}}',
      'Contacto en obra para la descarga: {{contacto_obra}}',
      'Observaciones: {{observaciones}}',
      '',
      'Por favor, confirmen disponibilidad y fecha de entrega respondiendo a este correo.',
      '',
      'Un saludo,',
      '{{empresa}}',
      '{{empresa_telefono}} · {{empresa_email}}'
    ].join('\n')
  },
  solicitud_presupuesto: {
    asunto: 'Solicitud de presupuesto · {{obra}} {{urgente}}',
    cuerpo: [
      '{{saludo}}',
      '',
      'Les pedimos precio y plazo de entrega para el siguiente material:',
      '',
      '{{lineas_material}}',
      '',
      'Obra: {{obra}}',
      'Dirección de entrega: {{direccion_entrega}}',
      'Fecha en la que lo necesitamos: {{fecha_entrega}}',
      'Observaciones: {{observaciones}}',
      '',
      'Por favor, respondan a este correo con su oferta.',
      '',
      'Un saludo,',
      '{{empresa}}',
      '{{empresa_telefono}} · {{empresa_email}}'
    ].join('\n')
  },
  subcontrata_enlace: {
    asunto: 'Encargo en la obra {{obra}} · {{empresa}}',
    cuerpo: [
      'Hola {{contacto}},',
      '',
      'Se os ha asignado {{tarea}} en la obra {{obra}}.',
      '',
      'Desde este enlace podéis reportar el avance, avisar cuando esté terminado (con fotos) o pedir material, sin usuario ni contraseña:',
      '',
      '{{enlace}}',
      '',
      'El enlace caduca el {{caduca}}.',
      '',
      'Un saludo,',
      '{{firma}}',
      '{{empresa}} · {{empresa_telefono}}'
    ].join('\n')
  }
};

const VARIABLE = /\{\{\s*([a-z_]+)\s*\}\}/g;
const BLOCK_VARIABLES = new Set(['lineas_material']);

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isEmpty = (value) => value === undefined || value === null || String(value).trim() === '' ||
  (Array.isArray(value) && value.length === 0);

/** Plantilla efectiva de un tipo: la guardada en Ajustes o, si falta, la de serie. */
export function getEmailTemplate(tipo, custom = {}) {
  const base = DEFAULT_EMAIL_TEMPLATES[tipo];
  if (!base) throw new Error(`Tipo de correo desconocido: ${tipo}`);
  const own = (custom && custom[tipo]) || {};
  return {
    asunto: String(own.asunto || '').trim() ? String(own.asunto) : base.asunto,
    cuerpo: String(own.cuerpo || '').trim() ? String(own.cuerpo) : base.cuerpo
  };
}

/** Nombres de variables que admite un tipo (las que falten se tratan como vacías). */
export function templateVariableKeys(tipo) {
  const type = EMAIL_TEMPLATE_TYPES.find((t) => t.id === tipo);
  return new Set([...(type?.variables || []).map((v) => v.key), 'enlace_texto']);
}

/** Variables comunes sacadas de la configuración de la empresa. */
export function companyVariables(empresa = {}) {
  return {
    empresa: empresa.nombreComercial || empresa.nombreEmpresa || empresa.razonSocial || 'ObraMaster',
    empresa_telefono: empresa.telefono || '',
    empresa_email: empresa.email || '',
    firma: empresa.directorNombre || ''
  };
}

/** Sustituye variables en una línea. `keep` deja algunas sin tocar (p. ej. para el editor del envío). */
export function fillVariables(textValue, variables = {}, { keep = [], known = null } = {}) {
  const isKnown = (key) => key in variables || Boolean(known?.has(key));
  return String(textValue ?? '').replace(VARIABLE, (match, key) => {
    if (keep.includes(key) || !isKnown(key)) return match;
    const value = variables[key];
    if (Array.isArray(value)) return value.map(materialLineText).join('\n');
    return isEmpty(value) ? '' : String(value);
  });
}

/** true si la línea tiene variables conocidas y todas están vacías. */
function lineHasOnlyEmptyVariables(line, variables, known) {
  const keys = [...line.matchAll(VARIABLE)].map((m) => m[1]).filter((k) => k in variables || known.has(k));
  return keys.length > 0 && keys.every((k) => isEmpty(variables[k]));
}

function materialLineText(item) {
  const qty = item.cantidad ? ` · ${item.cantidad}${item.unidad ? ` ${item.unidad}` : ''}` : '';
  return `- ${item.material}${qty}${item.notas ? ` (${item.notas})` : ''}`;
}

function materialTableHtml(items) {
  const td = 'style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"';
  const rows = items.map((it) =>
    `<tr><td ${td}>${escapeHtml(it.material)}${it.notas ? `<br><span style="color:#64748b;font-size:12px;">${escapeHtml(it.notas)}</span>` : ''}</td>` +
    `<td ${td} align="right">${escapeHtml(it.cantidad)}</td><td ${td}>${escapeHtml(it.unidad)}</td></tr>`
  ).join('');
  return '<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;font-size:14px;margin:4px 0 16px;">' +
    '<thead><tr style="background:#f1f5f9;text-align:left;"><th style="padding:8px 10px;">Material</th>' +
    '<th style="padding:8px 10px;" align="right">Cantidad</th><th style="padding:8px 10px;">Unidad</th></tr></thead>' +
    `<tbody>${rows}</tbody></table>`;
}

// Quita los separadores " · " que quedan colgando cuando una variable está vacía.
const trimSeparators = (line) => line.replace(/\s*·\s*$/, '').replace(/^(\s*)·\s*/, '$1');

const safeUrl = (url) => (/^https?:\/\//i.test(String(url || '')) ? String(url) : '');

function buttonHtml(url, label) {
  return `<p style="margin:20px 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#f59e0b;color:#0f172a;` +
    `padding:12px 22px;border-radius:10px;font-weight:bold;text-decoration:none;">${escapeHtml(label)}</a></p>`;
}

/** Línea de texto a HTML, con {{enlace}} como enlace y el resto de variables ya escapadas. */
function lineToHtml(line, variables, known) {
  let html = '';
  let last = 0;
  for (const match of line.matchAll(VARIABLE)) {
    html += escapeHtml(line.slice(last, match.index));
    const key = match[1];
    if (!(key in variables) && !known.has(key)) html += escapeHtml(match[0]);
    else if (key === 'enlace' && safeUrl(variables.enlace)) {
      html += `<a href="${escapeHtml(variables.enlace)}" style="color:#b45309;">${escapeHtml(variables.enlace)}</a>`;
    } else html += escapeHtml(isEmpty(variables[key]) ? '' : variables[key]);
    last = match.index + match[0].length;
  }
  return html + escapeHtml(line.slice(last));
}

/**
 * Prepara el correo final.
 * @param {string} tipo       Uno de EMAIL_TEMPLATE_TYPES.
 * @param {object} variables  Valores de las variables (lineas_material: array de { material, cantidad, unidad, notas }).
 * @param {object} [options]
 * @param {object} [options.templates]  empresaConfig.plantillasCorreo.
 * @param {object} [options.empresa]    empresaConfig (variables comunes y pie).
 * @param {{asunto?: string, cuerpo?: string}} [options.override]  Texto editado solo para este envío.
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderEmail(tipo, variables = {}, { templates = {}, empresa = {}, override = {} } = {}) {
  const template = getEmailTemplate(tipo, templates);
  const asunto = String(override.asunto || '').trim() ? override.asunto : template.asunto;
  const cuerpo = String(override.cuerpo || '').trim() ? override.cuerpo : template.cuerpo;
  const vars = { ...companyVariables(empresa), ...variables };
  if (vars.enlace && !safeUrl(vars.enlace)) vars.enlace = '';
  const known = templateVariableKeys(tipo);
  const buttonLabel = vars.enlace_texto || (tipo === 'subcontrata_enlace' ? 'Abrir mi enlace de obra' : 'Ver documento');

  const subject = trimSeparators(fillVariables(asunto, vars, { known }).replace(/[\r\n]+/g, ' ').replace(/(·\s*){2,}/g, '· '))
    .replace(/\s{2,}/g, ' ').trim().slice(0, 250);

  const lines = String(cuerpo).replace(/\r\n?/g, '\n').split('\n')
    .filter((line) => !lineHasOnlyEmptyVariables(line, vars, known));

  const textLines = [];
  const paragraphs = [];
  let current = [];
  const flush = () => {
    if (current.length) paragraphs.push(`<p style="margin:0 0 14px;">${current.join('<br>')}</p>`);
    current = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const only = trimmed.match(/^\{\{\s*([a-z_]+)\s*\}\}$/)?.[1];
    if (only && BLOCK_VARIABLES.has(only) && Array.isArray(vars[only])) {
      flush();
      paragraphs.push(materialTableHtml(vars[only]));
      textLines.push(...vars[only].map(materialLineText));
      continue;
    }
    if (only === 'enlace' && safeUrl(vars.enlace)) {
      flush();
      paragraphs.push(buttonHtml(vars.enlace, buttonLabel));
      textLines.push(vars.enlace);
      continue;
    }
    textLines.push(trimSeparators(fillVariables(line, vars, { known })));
    if (!trimmed) flush();
    else current.push(trimSeparators(lineToHtml(line, vars, known)));
  }
  flush();

  const text = textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const footer = [vars.empresa, empresa.cifNif || empresa.cif, vars.empresa_telefono, vars.empresa_email]
    .filter(Boolean).map(escapeHtml).join(' · ');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:15px;line-height:1.5;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
  <div style="padding:16px 24px;border-bottom:3px solid #f59e0b;font-weight:bold;font-size:16px;">${escapeHtml(vars.empresa)}</div>
  <div style="padding:24px;">${paragraphs.join('\n')}</div>
  <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">${footer}</div>
</div>
</body></html>`;

  return { subject, html, text };
}

/** Datos de ejemplo para la vista previa en Ajustes. */
export const SAMPLE_EMAIL_VARIABLES = {
  presupuesto: { cliente: 'María López', numero: 'PRE-2026-014', obra: 'Reforma de baño en C/ Mayor 5', base: '8.200,00', iva: '820,00', total: '9.020,00', fecha: '29/10/2026', enlace: '' },
  factura: { cliente: 'María López', numero: 'FAC-2026-031', obra: 'Reforma de baño en C/ Mayor 5', base: '8.200,00', iva: '820,00', total: '9.020,00', fecha: '29/10/2026', vencimiento: '28/11/2026', iban: 'ES00 0000 0000 0000 0000 0000', enlace: '' },
  pedido_material: {
    saludo: 'Hola Antonio,', proveedor: 'Almacenes García', obra: 'OB-012 - Reforma de baño', direccion_entrega: 'C/ Mayor 5, bajo',
    tajo: 'Baño principal', fecha_entrega: 'lunes, 3 de noviembre de 2026', contacto_obra: 'Juan (600 000 000)', observaciones: 'Descarga por la mañana', urgente: '',
    lineas_material: [{ material: 'Cemento cola C2TE', cantidad: '10', unidad: 'sacos', notas: '' }, { material: 'Plato de ducha 80x120 blanco', cantidad: '1', unidad: 'ud', notas: 'Antideslizante' }]
  },
  solicitud_presupuesto: {
    saludo: 'Buenos días,', proveedor: 'Almacenes García', obra: 'OB-012 - Reforma de baño', direccion_entrega: 'C/ Mayor 5, bajo',
    fecha_entrega: 'lunes, 3 de noviembre de 2026', observaciones: '', urgente: '',
    lineas_material: [{ material: 'Azulejo 30x60 gris mate', cantidad: '25', unidad: 'm²', notas: '' }]
  },
  subcontrata_enlace: { contacto: 'Luis', subcontrata: 'Fontanería Ruiz SL', tarea: 'la partida "Instalación de fontanería"', obra: 'OB-012 - Reforma de baño', caduca: '28/12/2026', enlace: 'https://tu-app.onrender.com/sub/tk_ejemplo' }
};
