/**
 * Base de precios de la empresa: cruce de las partidas que envía un gremio con las ya guardadas.
 */

const STOPWORDS = new Set('de la el los las del con para por una uno sin que en y o a al su sus incluso hasta como cada'.split(' '));

export const normalizeText = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/²/g, '2')
  .replace(/³/g, '3');

const words = (text) => normalizeText(text).split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOPWORDS.has(w));

export const normalizeUnit = (unit) => normalizeText(unit).replace(/[^a-z0-9]/g, '') || 'ud';

// Parecido entre dos conceptos (0 a 1), por palabras en común.
export function conceptSimilarity(a, b) {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (!wa.size || !wb.size) return 0;
  let common = 0;
  wa.forEach(w => { if (wb.has(w)) common += 1; });
  return (2 * common) / (wa.size + wb.size);
}

/**
 * Índice de la partida de la base que corresponde a `item`: mismo código, o misma unidad
 * y un concepto muy parecido. Devuelve -1 si no hay ninguna.
 */
export function findPriceBaseMatch(base, item, minSimilarity = 0.6) {
  if (item.codigo) {
    const byCode = base.findIndex(bp => bp.codigo && normalizeText(bp.codigo) === normalizeText(item.codigo));
    if (byCode >= 0) return byCode;
  }
  const unit = normalizeUnit(item.unidad);
  let best = -1;
  let bestScore = minSimilarity;
  base.forEach((bp, idx) => {
    if (normalizeUnit(bp.unidad) !== unit) return;
    const score = conceptSimilarity(bp.concepto, item.concepto);
    if (score >= bestScore) { best = idx; bestScore = score; }
  });
  return best;
}

// Siguiente código libre para un gremio: "FON-07", "ELE-12"...
export function nextPriceCode(base, gremio) {
  const prefix = (normalizeText(gremio).replace(/[^a-z]/g, '').slice(0, 3) || 'gen').toUpperCase();
  const max = base.reduce((acc, bp) => {
    const m = String(bp.codigo || '').match(new RegExp(`^${prefix}-(\\d+)$`, 'i'));
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

/**
 * Convierte lo que la IA ha leído del documento del gremio en un presupuesto de gremio
 * listo para revisar: cada partida trae su precio anterior en la base (si existe) y el margen.
 */
export function buildGremioQuote({ extraction, base, margen, archivoNombre = '', gremio = '', subcontrata = '' }) {
  const gremioFinal = extraction.gremio || gremio || 'General';
  const partidas = (extraction.partidas || []).map((p, idx) => {
    const matchIdx = findPriceBaseMatch(base, p);
    const match = matchIdx >= 0 ? base[matchIdx] : null;
    const coste = Number(p.precio) || 0;
    const anterior = match ? Number(match.costeSubcontrata) || 0 : null;
    return {
      linea: idx + 1,
      codigo: match?.codigo || p.codigo || '',
      baseId: match?.id || null,
      capitulo: match?.capitulo || p.capitulo || gremioFinal,
      gremio: match?.gremio || gremioFinal,
      concepto: p.concepto,
      unidad: p.unidad || 'ud',
      precioAnterior: anterior,
      nuevoPrecioSubcontrata: coste,
      variacionPct: anterior ? Number((((coste - anterior) / anterior) * 100).toFixed(1)) : null,
      margenConfiguradoPct: Number(margen) || 0,
      incluir: true
    };
  });

  return {
    id: `subpres-${Date.now()}`,
    subcontrata: extraction.subcontrata || subcontrata || 'Gremio sin nombre',
    gremio: gremioFinal,
    archivoNombre: archivoNombre || 'Texto pegado',
    fecha: extraction.fecha || new Date().toISOString().split('T')[0],
    resumen: extraction.resumen || `${partidas.length} partidas detectadas por la IA.`,
    avisos: extraction.avisos || [],
    margenDefecto: Number(margen) || 0,
    estado: 'analizado',
    partidasDetectadas: partidas
  };
}
