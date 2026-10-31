// Documentación de subcontratas (CAE / PRL) y control por obra.
// Lo usan la app (Subcontratas y PRL) y el servidor (backend/subcontratasDocsRoutes.js).
//
// Un documento es "de empresa" (vale para todas las obras: seguro RC, certificados de
// Hacienda y Seguridad Social, REA, formación de los trabajadores...) o "de obra"
// (adhesión al plan de seguridad, recurso preventivo...): estos solo cuentan en su obra.

export const AVISO_DIAS = 30; // "por caducar" si quedan 30 días o menos

export const DOC_TYPES = [
  { id: 'rc_seguro', label: 'Seguro de responsabilidad civil y recibo pagado', scope: 'empresa', caduca: true },
  { id: 'aeat', label: 'Certificado de estar al corriente con Hacienda (AEAT)', scope: 'empresa', caduca: true },
  { id: 'tgss', label: 'Certificado de estar al corriente con la Seguridad Social', scope: 'empresa', caduca: true },
  { id: 'rnt', label: 'RNT y RLC del último mes (antiguos TC2)', scope: 'empresa', caduca: true },
  { id: 'rea', label: 'Inscripción en el REA (Registro de Empresas Acreditadas)', scope: 'empresa', caduca: true },
  { id: 'modalidad_preventiva', label: 'Modalidad preventiva o concierto con servicio de prevención', scope: 'empresa', caduca: true },
  { id: 'evaluacion_riesgos', label: 'Evaluación de riesgos y planificación preventiva', scope: 'empresa', caduca: false },
  { id: 'formacion_prl', label: 'Formación PRL de los trabajadores (TPC / 20 h)', scope: 'empresa', caduca: false, porTrabajador: true },
  { id: 'aptitud_medica', label: 'Reconocimiento médico (apto) de los trabajadores', scope: 'empresa', caduca: true, porTrabajador: true },
  { id: 'epis', label: 'Entrega de EPIs a los trabajadores', scope: 'empresa', caduca: false, porTrabajador: true },
  { id: 'alta_ss', label: 'Alta en la Seguridad Social de los trabajadores', scope: 'empresa', caduca: false, porTrabajador: true },
  { id: 'cif_escrituras', label: 'CIF, escrituras o alta de autónomo', scope: 'empresa', caduca: false },
  { id: 'adhesion_pss', label: 'Adhesión al plan de seguridad y salud de la obra', scope: 'obra', caduca: false },
  { id: 'recurso_preventivo', label: 'Nombramiento del recurso preventivo', scope: 'obra', caduca: false },
  { id: 'libro_subcontratacion', label: 'Anotación en el libro de subcontratación', scope: 'obra', caduca: false },
  { id: 'autorizacion_maquinaria', label: 'Autorización de uso de maquinaria', scope: 'obra', caduca: false, porTrabajador: true },
  { id: 'otro', label: 'Otro documento', scope: 'empresa', caduca: false }
];

export const DOC_TYPE_IDS = new Set(DOC_TYPES.map((t) => t.id));
export const docType = (id) => DOC_TYPES.find((t) => t.id === id) || DOC_TYPES[DOC_TYPES.length - 1];

/** Documentos que se piden por defecto en una obra si no se ha configurado otra cosa. */
export const DEFAULT_REQUIRED = [
  'rc_seguro', 'aeat', 'tgss', 'rnt', 'rea', 'modalidad_preventiva',
  'evaluacion_riesgos', 'formacion_prl', 'aptitud_medica', 'adhesion_pss'
];

export const STATUS_INFO = {
  vigente: { label: 'Vigente', tone: 'ok' },
  sin_caducidad: { label: 'Entregado', tone: 'ok' },
  por_caducar: { label: 'Por caducar', tone: 'warn' },
  caducado: { label: 'Caducado', tone: 'bad' },
  falta: { label: 'Falta', tone: 'bad' }
};

const DAY = 24 * 60 * 60 * 1000;
const dayStart = (value) => {
  const s = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const todayKey = (today) => dayStart(today instanceof Date ? today.toISOString() : today || new Date().toISOString());

/** Días que quedan hasta la caducidad (negativo = caducado). null si no caduca. */
export function daysLeft(doc, today) {
  const exp = dayStart(doc?.fecha_caducidad);
  if (exp === null) return null;
  return Math.round((exp - todayKey(today)) / DAY);
}

/** Estado de un documento: vigente, por_caducar, caducado o sin_caducidad. */
export function docStatus(doc, today) {
  const left = daysLeft(doc, today);
  if (left === null) return 'sin_caducidad';
  if (left < 0) return 'caducado';
  if (left <= AVISO_DIAS) return 'por_caducar';
  return 'vigente';
}

const RANK = { vigente: 3, sin_caducidad: 3, por_caducar: 2, caducado: 1, falta: 0 };

/** ¿Este documento sirve para esta obra? Los de empresa sin obra valen para todas. */
export function docAppliesTo(doc, obraId) {
  const own = String(doc.obra_id || '');
  if (!own) return docType(doc.doc_type).scope === 'empresa';
  return own === String(obraId || '');
}

/**
 * Estado de un documento exigido para una subcontrata en una obra (obraId vacío = sin obra:
 * solo cuentan los documentos de empresa). Se queda con el mejor documento disponible.
 */
export function requirementStatus(docs, subcontractorId, typeId, obraId, today) {
  let best = null;
  let bestStatus = 'falta';
  for (const doc of docs || []) {
    if (doc.is_active === false || String(doc.subcontractor_id) !== String(subcontractorId) || doc.doc_type !== typeId) continue;
    if (obraId ? !docAppliesTo(doc, obraId) : doc.obra_id) continue;
    const st = docStatus(doc, today);
    const better = RANK[st] > RANK[bestStatus]
      || (RANK[st] === RANK[bestStatus] && (dayStart(doc.fecha_caducidad) ?? Infinity) > (dayStart(best?.fecha_caducidad) ?? Infinity));
    if (!best || better) { best = doc; bestStatus = st; }
  }
  return { type: typeId, status: bestStatus, doc: best, daysLeft: best ? daysLeft(best, today) : null };
}

/** Resume una lista de estados: apto, aviso (algo por caducar) o no_apto (falta o caducado). */
export function summarize(items) {
  const count = { ok: 0, warn: 0, bad: 0 };
  items.forEach((it) => { count[STATUS_INFO[it.status].tone] += 1; });
  const estado = count.bad > 0 ? 'no_apto' : count.warn > 0 ? 'aviso' : 'apto';
  return { estado, ...count, total: items.length };
}

/** Documentos que pide una obra (los configurados o los de por defecto). */
export function requiredFor(requirements, obraId) {
  const row = (requirements || []).find((r) => String(r.obra_id) === String(obraId));
  const list = row && Array.isArray(row.doc_types) ? row.doc_types : DEFAULT_REQUIRED;
  return list.filter((id) => DOC_TYPE_IDS.has(id));
}

/**
 * Subcontratas que trabajan en una obra: asignaciones de fase o partida, presupuestos
 * vinculados en su ficha y las añadidas a mano en el control documental de la obra.
 * Devuelve [{ id, origen: Set<'asignacion'|'presupuesto'|'manual'> }].
 */
export function subcontractorsInObra({ obraId, subcontractors = [], assignments = [], requirements = [] }) {
  const found = new Map();
  const add = (id, origen) => {
    if (!id) return;
    const key = String(id);
    if (!found.has(key)) found.set(key, new Set());
    found.get(key).add(origen);
  };
  assignments.forEach((a) => { if (String(a.obra_id) === String(obraId)) add(a.subcontractor_id, 'asignacion'); });
  subcontractors.forEach((s) => {
    if ((s.presupuestosVinculados || []).some((b) => String(b.obraId) === String(obraId) && b.estado !== 'rechazado')) add(s.id, 'presupuesto');
  });
  const row = requirements.find((r) => String(r.obra_id) === String(obraId));
  (row?.subcontractor_ids || []).forEach((id) => add(id, 'manual'));
  const excluded = new Set((row?.excluded_ids || []).map(String));
  return [...found.entries()].filter(([id]) => !excluded.has(id)).map(([id, origen]) => ({ id, origen }));
}

/** Control documental de una obra: por subcontrata, el estado de cada documento exigido. */
export function obraCompliance({ obraId, subcontractors = [], assignments = [], requirements = [], docs = [], today }) {
  const required = requiredFor(requirements, obraId);
  const rows = subcontractorsInObra({ obraId, subcontractors, assignments, requirements }).map(({ id, origen }) => {
    const items = required.map((typeId) => requirementStatus(docs, id, typeId, obraId, today));
    return { subcontractorId: id, origen: [...origen], items, ...summarize(items) };
  });
  return { required, rows };
}

/** Estado de la documentación de empresa de una subcontrata (sin obra). */
export function companyCompliance(docs, subcontractorId, today, required = DEFAULT_REQUIRED) {
  const items = required
    .filter((id) => docType(id).scope === 'empresa')
    .map((typeId) => requirementStatus(docs, subcontractorId, typeId, '', today));
  return { items, ...summarize(items) };
}
