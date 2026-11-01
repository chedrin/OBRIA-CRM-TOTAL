// ¿Está una necesidad de la obra (material, trabajo) contemplada en el presupuesto firmado?
// Se compara el concepto con las partidas por palabras (sin tildes, plurales ni palabras vacías).
// Y, si no lo está, la partida que se añade al presupuesto (nueva versión para que la firme el cliente).
import { capitulosDe, presupuestoVigente, recalcularPartida, recalcularTotales } from './presupuestoRevision.js';

const VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'en', 'con', 'para', 'por', 'y', 'o', 'a', 'un', 'una', 'al', 'sin', 'su', 'kg', 'ud', 'uds', 'm2', 'ml', 'mm', 'cm', 'saco', 'sacos', 'lote']);

const raiz = (w) => (w.length > 4 ? w.replace(/(es|s)$/, '') : w);

export function palabras(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9ñ]+/)
    .filter(w => w.length > 2 && !VACIAS.has(w) && !/^\d+$/.test(w))
    .map(raiz);
}

const textoPartida = (p) => [p.concepto, p.titulo, p.descripcion, p.capitulo].filter(Boolean).join(' ');

/**
 * Partidas del presupuesto (versión firmada) que cubren el concepto, de más a menos parecidas.
 * Una partida cuenta si comparte al menos la mitad de las palabras del concepto (mínimo una).
 */
export function partidasQueCubren(concepto, presupuesto) {
  const buscadas = [...new Set(palabras(concepto))];
  if (!buscadas.length || !presupuesto) return [];
  const vigente = presupuestoVigente(presupuesto);
  const partidas = capitulosDe(vigente).flatMap(c => c.partidas.map(p => ({ ...p, capitulo: p.capitulo || c.nombre })));
  return partidas
    .map(p => {
      const suyas = new Set(palabras(textoPartida(p)));
      const comunes = buscadas.filter(w => suyas.has(w)).length;
      return { partida: p, puntos: comunes / buscadas.length, comunes };
    })
    .filter(r => r.comunes > 0 && r.puntos >= 0.5)
    .sort((a, b) => b.puntos - a.puntos)
    .map(r => r.partida);
}

/** { contemplado, partidas } del concepto en cualquiera de los presupuestos de la obra. */
export function contemplaEnPresupuestos(concepto, presupuestos = []) {
  for (const pres of presupuestos) {
    const partidas = partidasQueCubren(concepto, pres);
    if (partidas.length) return { contemplado: true, presupuesto: pres, partidas };
  }
  return { contemplado: false, presupuesto: presupuestos[0] || null, partidas: [] };
}

export const CAPITULO_AMPLIACION = 'Ampliaciones de obra';

/**
 * Cambios para añadir la necesidad como partida nueva del presupuesto (en el capítulo
 * "Ampliaciones de obra"). Precio de venta = coste estimado + margen del presupuesto.
 */
export function cambiosAnadirNecesidad(presupuesto, necesidad) {
  const caps = capitulosDe(presupuesto);
  const margen = Number(presupuesto.margenGlobalPct ?? 30);
  const cantidad = Math.max(Number(necesidad.cantidad) || 1, 0);
  const costeTotal = Math.max(Number(necesidad.costeEstimado) || 0, 0);
  const partida = recalcularPartida({
    id: `par-nec-${Date.now()}`,
    concepto: necesidad.concepto,
    unidad: necesidad.unidad || 'ud',
    cantidad,
    costeUnitario: cantidad > 0 ? Math.round((costeTotal / cantidad) * 100) / 100 : costeTotal,
    margenPct: margen
  });
  let cap = caps.find(c => c.nombre === CAPITULO_AMPLIACION);
  if (!cap) {
    cap = { id: `cap-ampliaciones-${Date.now()}`, codigo: String(caps.length + 1).padStart(2, '0'), nombre: CAPITULO_AMPLIACION, partidas: [] };
    caps.push(cap);
  }
  cap.partidas.push(partida);
  return { partida, cambios: recalcularTotales(caps, presupuesto.tipoIvaPct, margen) };
}
