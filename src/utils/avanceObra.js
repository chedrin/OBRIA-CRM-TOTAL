/**
 * ObraMaster - Cálculo del avance de obra por fase y partida.
 *
 * Código puro (sin React ni navegador): lo usan el panel del jefe de obra y el
 * servidor (backend/avanceRoutes.js), así los dos calculan lo mismo.
 *
 * Estructura: las fases y partidas viven en la obra (obra.fases[] y fase.tareas[]).
 * Una fase sin partidas cuenta como una sola partida con id '' ("fase completa").
 * El avance y las asignaciones vienen de las tablas work_item_progress y work_assignments.
 */

export const STATUS = {
  no_iniciada: { label: 'No iniciada', cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  en_curso: { label: 'En curso', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  bloqueada: { label: 'Bloqueada por incidencia', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  completada: { label: 'Completada', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' }
};

export const STATUS_VALUES = Object.keys(STATUS);
export const WHOLE_PHASE = '';

const DAY_MS = 86400000;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clampPct = (v) => Math.round(Math.min(100, Math.max(0, num(v))));
export const itemKey = (faseId, partidaId = WHOLE_PHASE) => `${faseId}::${partidaId || WHOLE_PHASE}`;

/** Fases y partidas de la obra con su importe, medición y peso. */
export function flattenPlan(obra) {
  const fases = (obra?.fases || []).map((fase, index) => {
    const tareas = Array.isArray(fase.tareas) ? fase.tareas : [];
    const partidas = tareas.length
      ? tareas.map((t, i) => ({
          id: String(t.id),
          faseId: String(fase.id),
          codigo: t.codigo || `${index + 1}.${String(i + 1).padStart(2, '0')}`,
          titulo: t.titulo || t.concepto || 'Partida',
          unidad: t.unidad || '',
          cantidad: num(t.cantidad),
          importe: num(t.importeTotal) || num(t.cantidad) * num(t.precioVenta),
          progresoObra: clampPct(t.progreso)
        }))
      : [{
          id: WHOLE_PHASE,
          faseId: String(fase.id),
          codigo: String(index + 1).padStart(2, '0'),
          titulo: fase.nombre || fase.capitulo || 'Fase',
          unidad: '',
          cantidad: 0,
          importe: num(fase.importeTotal),
          progresoObra: clampPct(fase.progreso),
          faseCompleta: true
        }];
    return {
      id: String(fase.id),
      nombre: fase.nombre || fase.capitulo || `Fase ${index + 1}`,
      orden: fase.orden || index + 1,
      importe: partidas.reduce((s, p) => s + p.importe, 0) || num(fase.importeTotal),
      partidas
    };
  });
  return { fases };
}

export function findPartida(plan, faseId, partidaId = WHOLE_PHASE) {
  const fase = plan.fases.find((f) => f.id === String(faseId));
  if (!fase) return null;
  const partida = fase.partidas.find((p) => p.id === String(partidaId || WHOLE_PHASE));
  return partida ? { fase, partida } : null;
}

/**
 * Asignaciones efectivas de cada partida. Una asignación de fase (partida_id '')
 * se hereda en todas sus partidas salvo en las que tengan asignación propia.
 * Devuelve Map<itemKey, [{ ...asignación, heredada }]>.
 */
export function effectiveAssignments(plan, assignments = []) {
  const active = assignments.filter((a) => a.is_active !== false);
  const map = new Map();
  for (const fase of plan.fases) {
    const faseLevel = active.filter((a) => String(a.fase_id) === fase.id && !a.partida_id);
    for (const partida of fase.partidas) {
      const own = partida.id ? active.filter((a) => String(a.fase_id) === fase.id && String(a.partida_id) === partida.id) : [];
      map.set(itemKey(fase.id, partida.id), own.length ? own : faseLevel.map((a) => ({ ...a, heredada: Boolean(partida.id) })));
    }
  }
  return map;
}

/** % planificado a fecha de hoy según las fechas de las asignaciones (lineal). null si no hay fechas. */
export function plannedPct(assignees, today = new Date()) {
  const starts = assignees.map((a) => a.start_date).filter(Boolean).map((d) => new Date(`${d}T00:00:00`).getTime());
  const ends = assignees.map((a) => a.end_date).filter(Boolean).map((d) => new Date(`${d}T23:59:59`).getTime());
  if (!starts.length || !ends.length) return null;
  const start = Math.min(...starts);
  const end = Math.max(...ends);
  const now = today.getTime();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return clampPct(((now - start) / Math.max(DAY_MS, end - start)) * 100);
}

/**
 * Peso de cada partida: económico (importe) si la obra tiene importes; si no,
 * todas pesan igual. Devuelve { mode, weight(partida) }.
 */
function weighting(plan) {
  const total = plan.fases.reduce((s, f) => s + f.partidas.reduce((a, p) => a + p.importe, 0), 0);
  return total > 0
    ? { mode: 'importe', weight: (p) => p.importe }
    : { mode: 'partidas', weight: () => 1 };
}

function weighted(rows, weight, field) {
  let sum = 0;
  let total = 0;
  for (const r of rows) {
    const value = r[field];
    if (value === null || value === undefined) continue;
    const w = weight(r);
    sum += w * value;
    total += w;
  }
  return total > 0 ? Math.round(sum / total) : null;
}

/**
 * Resumen completo de la obra: por partida, fase y obra, el % reportado,
 * el % certificado y el % planificado, más asignados, alertas y bloqueos.
 */
export function computeAvance(obra, { progress = [], assignments = [], today = new Date() } = {}) {
  const plan = flattenPlan(obra);
  const { mode, weight } = weighting(plan);
  const byKey = new Map(progress.map((r) => [itemKey(r.fase_id, r.partida_id), r]));
  const assigned = effectiveAssignments(plan, assignments);

  const fases = plan.fases.map((fase) => {
    // Aviso de la fase completa (p. ej. incidencia desde un enlace de fase): alerta a todas sus partidas.
    const faseRow = fase.partidas[0]?.faseCompleta ? null : byKey.get(itemKey(fase.id, WHOLE_PHASE));
    const faseAlert = faseRow?.alert ? faseRow : null;
    const partidas = fase.partidas.map((p) => {
      const key = itemKey(fase.id, p.id);
      const own = byKey.get(key);
      const row = own?.alert || !faseAlert
        ? own
        : { ...(own || { reported_pct: p.progresoObra, certified_pct: p.progresoObra }), alert: faseAlert.alert, alert_text: faseAlert.alert_text, alert_need_id: faseAlert.alert_need_id, status: faseAlert.status === 'bloqueada' ? 'bloqueada' : (own?.status || (p.progresoObra >= 100 ? 'completada' : p.progresoObra > 0 ? 'en_curso' : 'no_iniciada')) };
      const assignees = assigned.get(key) || [];
      return {
        ...p,
        key,
        status: row?.status || (p.progresoObra >= 100 ? 'completada' : p.progresoObra > 0 ? 'en_curso' : 'no_iniciada'),
        reported: row ? clampPct(row.reported_pct) : p.progresoObra,
        // Sin registro de certificación, el avance que ya figuraba en la obra se toma como certificado.
        certified: row ? clampPct(row.certified_pct) : p.progresoObra,
        planned: plannedPct(assignees, today),
        readyForCertification: Boolean(row?.ready_for_certification),
        alert: row?.alert || null,
        alertText: row?.alert_text || '',
        alertNeedId: row?.alert_need_id || null,
        executedQty: row?.executed_qty ?? null,
        reportedAt: row?.reported_at || null,
        reportedBy: row?.reported_by_name || '',
        certifiedAt: row?.certified_at || null,
        assignees,
        pendingValidation: own ? clampPct(own.reported_pct) > clampPct(own.certified_pct) : false
      };
    });
    return {
      ...fase,
      partidas,
      reported: weighted(partidas, weight, 'reported') ?? 0,
      certified: weighted(partidas, weight, 'certified') ?? 0,
      planned: weighted(partidas, weight, 'planned'),
      blocked: partidas.filter((p) => p.status === 'bloqueada' || p.alert).length,
      pendingValidation: partidas.filter((p) => p.pendingValidation).length
    };
  });

  const all = fases.flatMap((f) => f.partidas);
  return {
    mode,
    fases,
    reported: weighted(all, weight, 'reported') ?? 0,
    certified: weighted(all, weight, 'certified') ?? 0,
    planned: weighted(all, weight, 'planned'),
    blocked: all.filter((p) => p.status === 'bloqueada' || p.alert).length,
    pendingValidation: all.filter((p) => p.pendingValidation).length
  };
}

/**
 * Normaliza un reporte de avance: estado y % coherentes entre sí.
 * Si llega la medición ejecutada y la partida tiene medición, el % sale de ella.
 */
export function normalizeReport({ status, pct, executedQty, cantidad }) {
  let value = pct === undefined || pct === null || pct === '' ? null : clampPct(pct);
  const qty = executedQty === undefined || executedQty === null || executedQty === '' ? null : Math.max(0, num(executedQty));
  if (qty !== null && cantidad > 0) value = clampPct((qty / cantidad) * 100);
  let next = STATUS_VALUES.includes(status) ? status : null;
  if (next === 'completada') value = 100;
  if (value === null) value = next === 'no_iniciada' ? 0 : null;
  if (!next && value !== null) next = value >= 100 ? 'completada' : value > 0 ? 'en_curso' : 'no_iniciada';
  if (next === 'no_iniciada' && value > 0) next = 'en_curso';
  if (next === 'en_curso' && value >= 100) next = 'completada';
  return { status: next, pct: value, executedQty: qty };
}

/**
 * Aplica el avance certificado a la obra (obra.fases[].tareas[].progreso) y
 * recalcula el % de cada fase y de la obra por peso económico.
 * Devuelve { fases, progreso } para guardar con updateObra.
 */
export function applyCertifiedToObra(obra, certifiedByKey) {
  const fases = (obra?.fases || []).map((fase) => {
    const tareas = Array.isArray(fase.tareas) ? fase.tareas : [];
    if (!tareas.length) {
      const pct = certifiedByKey.get(itemKey(fase.id, WHOLE_PHASE));
      if (pct === undefined) return fase;
      return { ...fase, progreso: pct, estado: pct >= 100 ? 'completada' : pct > 0 ? 'en_curso' : 'pendiente' };
    }
    const nuevas = tareas.map((t) => {
      const pct = certifiedByKey.get(itemKey(fase.id, String(t.id)));
      if (pct === undefined) return t;
      return {
        ...t,
        progreso: pct,
        estado: pct >= 100 ? 'completada' : pct > 0 ? 'en_curso' : 'pendiente',
        completedAt: pct >= 100 ? (t.completedAt || new Date().toISOString()) : null
      };
    });
    const total = nuevas.reduce((s, t) => s + (num(t.importeTotal) || 1), 0) || 1;
    const progreso = Math.round(nuevas.reduce((s, t) => s + (num(t.importeTotal) || 1) * num(t.progreso), 0) / total);
    return { ...fase, tareas: nuevas, progreso, estado: progreso >= 100 ? 'completada' : progreso > 0 ? 'en_curso' : 'pendiente' };
  });
  const plan = flattenPlan({ fases });
  const { weight } = weighting(plan);
  const progreso = weighted(plan.fases.flatMap((f) => f.partidas.map((p) => ({ ...p, v: p.progresoObra }))), weight, 'v') ?? 0;
  return { fases, progreso };
}
