/**
 * ObraMaster - Croquis 2D/3D de distribución (planta) a partir de mediciones y fotos.
 *
 * Lo usan el servidor (normaliza la respuesta de la IA) y el navegador (editor SVG, vista 3D y PDF).
 * Unidades: metros. Origen arriba a la izquierda, x hacia el este, y hacia el sur (el norte queda arriba).
 *
 * Contrato IA -> app (la IA puede dar rectángulos o polígonos):
 * {
 *   canvas: { widthMeters, heightMeters, scale },            // scale = px por metro en el editor
 *   rooms: [{ id, name, x, y, width, height, points?: [[x,y]...], alto?, color }],
 *   openings: [{ id, type: door|window|sliding_door, roomId,
 *                wall: north|south|east|west  (o edge: índice del lado del polígono),
 *                positionRatio (centro del hueco, 0-1), widthMeters, swing: in|out, hinge: start|end }],
 *   labels: [{ id, text, x, y, rotation, size }],
 *   dimensions: [{ id, x1, y1, x2, y2, offset }],             // cotas libres
 *   notes: ["supuestos de la IA"]
 * }
 *
 * Internamente toda estancia es un polígono `points` (lado i = del punto i al i+1); x, y, width y height
 * son su caja, y `fijas` lista los lados con la medida bloqueada. Los huecos van en un lado (`edge`).
 */

export const PX_POR_METRO = 50;
// Grosor de muro dibujado (m): 12 cm. Las estancias contiguas comparten el muro.
export const GROSOR_MURO = 0.12;
export const ALTO_DEFECTO = 2.6;
export const TIPOS_HUECO = ['door', 'window', 'sliding_door'];
export const NOMBRE_HUECO = { door: 'Puerta', window: 'Ventana', sliding_door: 'Corredera' };
export const ANCHO_HUECO = { door: 0.82, window: 1.2, sliding_door: 1.8 };
export const COLORES_ESTANCIA = ['#f8fafc', '#fefce8', '#f0f9ff', '#f0fdf4', '#fdf2f8', '#f5f3ff', '#fff7ed', '#ecfeff'];
const MUROS_CARDINALES = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

const num = (v, def = 0) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : def;
};
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const redondear = (v, dec = 2) => Math.round(v * 10 ** dec) / 10 ** dec;
const texto = (v, max = 80) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const color = (v, i) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : COLORES_ESTANCIA[i % COLORES_ESTANCIA.length]);

export const formatoMetros = (m) => `${num(m).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
export const formatoM2 = (m2) => `${num(m2).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

export const nuevoId = (prefijo) => `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function planVacio() {
  return { canvas: { widthMeters: 12, heightMeters: 9, scale: PX_POR_METRO }, rooms: [], openings: [], labels: [], dimensions: [], notes: [] };
}

// --- Polígonos ---

/** Área con signo (positiva si los puntos van en sentido horario en pantalla, con y hacia abajo). */
export function areaConSigno(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export const perimetro = (pts) => pts.reduce((t, p, i) => t + Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]), 0);

/** Centro de gravedad del polígono (donde van el nombre y la superficie). */
export function centroide(pts) {
  const A = areaConSigno(pts);
  if (Math.abs(A) < 1e-9) return [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const f = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return [cx / (6 * A), cy / (6 * A)];
}

const rectanguloPuntos = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

/** Recalcula caja (x, y, width, height) y superficie a partir de los puntos. */
export function rehacerEstancia(room) {
  const pts = room.points.map(([x, y]) => [redondear(x, 3), redondear(y, 3)]);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return {
    ...room,
    points: pts,
    x: redondear(x, 3),
    y: redondear(y, 3),
    width: redondear(Math.max(...xs) - x, 3),
    height: redondear(Math.max(...ys) - y, 3),
    area: redondear(Math.abs(areaConSigno(pts)))
  };
}

/** Rectángulo con los lados alineados a los ejes (4 puntos). */
export function esRectangulo(room) {
  const p = room.points || [];
  if (p.length !== 4) return false;
  return p.every((a, i) => {
    const b = p[(i + 1) % 4];
    return Math.abs(a[0] - b[0]) < 1e-3 || Math.abs(a[1] - b[1]) < 1e-3;
  });
}

/** Lados de la estancia: { i, a, b, largo }. */
export function lados(room) {
  const p = room.points;
  return p.map((a, i) => {
    const b = p[(i + 1) % p.length];
    return { i, a, b, largo: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
}

export const largoMuro = (room, edge) => {
  const p = room.points;
  if (!p?.length) return 0;
  const a = p[edge % p.length], b = p[(edge + 1) % p.length];
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
};

/** Ángulo interior (grados) en el vértice k. */
export function anguloInterior(room, k) {
  const p = room.points, n = p.length;
  const a = p[(k - 1 + n) % n], v = p[k], b = p[(k + 1) % n];
  const u1 = [a[0] - v[0], a[1] - v[1]], u2 = [b[0] - v[0], b[1] - v[1]];
  let ang = (Math.atan2(u1[0] * u2[1] - u1[1] * u2[0], u1[0] * u2[0] + u1[1] * u2[1]) * 180) / Math.PI;
  if (areaConSigno(p) > 0) ang = -ang;
  return redondear(ang < 0 ? ang + 360 : ang, 1);
}

/** Ratio del centro del hueco limitado para que quepa entero en el lado. */
export function ratioQueCabe(room, edge, ratio, ancho) {
  const L = largoMuro(room, edge);
  if (!(L > 0)) return 0.5;
  const margen = Math.min(0.5, (ancho / 2 + 0.05) / L);
  return redondear(clamp(ratio, margen, 1 - margen), 4);
}

/** Lado del polígono cuya cara exterior mira más hacia una orientación (north, south…). */
function ladoCardinal(room, wall) {
  const dir = MUROS_CARDINALES[wall] || MUROS_CARDINALES.south;
  let mejor = 0, puntos = -Infinity;
  lados(room).forEach(({ i }) => {
    const g = geometriaMuro(room, i);
    const fuera = -(g.inward[0] * dir[0] + g.inward[1] * dir[1]);
    const valor = fuera * 10 + g.length / 100;
    if (valor > puntos) { puntos = valor; mejor = i; }
  });
  return mejor;
}

/** Convierte un hueco antiguo (wall + ratio desde el oeste o el norte) a su lado y ratio del polígono. */
function huecoDesdeMuro(room, wall, ratio, hinge) {
  const edge = ladoCardinal(room, wall);
  const g = geometriaMuro(room, edge);
  const horizontal = wall === 'north' || wall === 'south';
  // El ratio antiguo cuenta desde el oeste (muros N/S) o desde el norte (muros E/O).
  const invertido = horizontal ? g.dir[0] < 0 : g.dir[1] < 0;
  return { edge, ratio: invertido ? 1 - ratio : ratio, hinge: invertido ? (hinge === 'end' ? 'start' : 'end') : hinge };
}

/**
 * Limpia y corrige el plano (de la IA o guardado): números válidos, tamaños razonables,
 * superficies recalculadas, huecos dentro de su lado y todo desplazado a coordenadas positivas.
 */
export function normalizarCroquis(raw) {
  const src = raw && typeof raw === 'object' ? (raw.plan && typeof raw.plan === 'object' ? raw.plan : raw) : {};
  const ids = new Set();
  const idUnico = (v, prefijo) => {
    let id = texto(v, 40).replace(/[^\w-]/g, '') || nuevoId(prefijo);
    while (ids.has(id)) id = `${id}-${ids.size}`;
    ids.add(id);
    return id;
  };

  const rooms = (Array.isArray(src.rooms) ? src.rooms : []).slice(0, 60).map((r, i) => {
    let pts = (Array.isArray(r?.points) ? r.points : [])
      .map(p => (Array.isArray(p) ? [num(p[0], NaN), num(p[1], NaN)] : [num(p?.x, NaN), num(p?.y, NaN)]))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
      .slice(0, 40)
      // Sin puntos repetidos seguidos.
      .filter((p, k, arr) => k === 0 || Math.hypot(p[0] - arr[k - 1][0], p[1] - arr[k - 1][1]) > 0.01);
    if (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) <= 0.01) pts.pop();
    const poligono = pts.length >= 3 && Math.abs(areaConSigno(pts)) >= 0.1;
    if (!poligono) {
      const width = clamp(Math.abs(num(r?.width ?? r?.ancho, 3)), 0.4, 60);
      const height = clamp(Math.abs(num(r?.height ?? r?.largo, 3)), 0.4, 60);
      pts = rectanguloPuntos(num(r?.x), num(r?.y), width, height);
    }
    const name = texto(r?.name ?? r?.nombre, 60) || `Estancia ${i + 1}`;
    // Medidas fijas: si no vienen indicadas, las estancias medidas (no "estimadas") nacen bloqueadas.
    const fijas = Array.isArray(r?.fijas)
      ? [...new Set(r.fijas.map(Number).filter(k => Number.isInteger(k) && k >= 0 && k < pts.length))]
      : (/estimad/i.test(name) ? [] : pts.map((_, k) => k));
    const alto = num(r?.alto, 0);
    return rehacerEstancia({
      id: idUnico(r?.id, 'room'),
      name,
      points: pts,
      fijas,
      ...(alto >= 1.8 && alto <= 8 ? { alto: redondear(alto) } : {}),
      color: color(r?.color, i)
    });
  });

  // Todo a coordenadas positivas (con el plano pegado al origen).
  const minX = rooms.length ? Math.min(...rooms.map(r => r.x)) : 0;
  const minY = rooms.length ? Math.min(...rooms.map(r => r.y)) : 0;
  rooms.forEach((r, k) => { rooms[k] = rehacerEstancia({ ...r, points: r.points.map(([x, y]) => [x - minX, y - minY]) }); });
  const byId = new Map(rooms.map(r => [r.id, r]));

  const openings = (Array.isArray(src.openings) ? src.openings : []).slice(0, 200).map((o) => {
    const type = TIPOS_HUECO.includes(o?.type) ? o.type : 'door';
    const room = byId.get(String(o?.roomId ?? '')) || null;
    if (!room) return null;
    let edge = Number.isInteger(o?.edge) && o.edge >= 0 && o.edge < room.points.length ? o.edge : null;
    let ratio = num(o?.positionRatio, 0.5);
    let hinge = o?.hinge === 'end' ? 'end' : 'start';
    if (edge === null) ({ edge, ratio, hinge } = huecoDesdeMuro(room, o?.wall, ratio, hinge));
    const widthMeters = redondear(clamp(Math.abs(num(o?.widthMeters ?? o?.width, ANCHO_HUECO[type])), 0.4, Math.max(0.4, largoMuro(room, edge) - 0.1)));
    return {
      id: idUnico(o?.id, 'op'),
      type,
      roomId: room.id,
      edge,
      positionRatio: ratioQueCabe(room, edge, ratio, widthMeters),
      widthMeters,
      swing: o?.swing === 'out' ? 'out' : 'in',
      hinge
    };
  }).filter(Boolean);

  const labels = (Array.isArray(src.labels) ? src.labels : []).slice(0, 100).map(l => ({
    id: idUnico(l?.id, 'lbl'),
    text: texto(l?.text, 80),
    x: redondear(num(l?.x) - minX),
    y: redondear(num(l?.y) - minY),
    rotation: [0, 90, 180, 270].includes(num(l?.rotation)) ? num(l?.rotation) : 0,
    size: redondear(clamp(num(l?.size, 0.25), 0.1, 1))
  }))
    // Las superficies de cada estancia las dibuja la app: se descartan las etiquetas que solo repiten "xx m²".
    .filter(l => l.text && !/^\s*\d+([.,]\d+)?\s*m(²|2)\s*$/i.test(l.text));

  const dimensions = (Array.isArray(src.dimensions) ? src.dimensions : []).slice(0, 100).map(d => ({
    id: idUnico(d?.id, 'dim'),
    x1: redondear(num(d?.x1) - minX),
    y1: redondear(num(d?.y1) - minY),
    x2: redondear(num(d?.x2) - minX),
    y2: redondear(num(d?.y2) - minY),
    offset: redondear(clamp(num(d?.offset, 0.4), -3, 3))
  })).filter(d => Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= 0.1);

  const notes = (Array.isArray(src.notes) ? src.notes : []).map(n => texto(n, 300)).filter(Boolean).slice(0, 12);

  const plan = { canvas: { widthMeters: 12, heightMeters: 9, scale: PX_POR_METRO }, rooms, openings, labels, dimensions, notes };
  plan.canvas = lienzoParaPlano(plan, src.canvas);
  return plan;
}

/** Caja que ocupa el dibujo (estancias, textos y cotas libres). */
export function limitesPlano(plan) {
  const xs = [], ys = [];
  (plan.rooms || []).forEach(r => r.points.forEach(([x, y]) => { xs.push(x); ys.push(y); }));
  (plan.labels || []).forEach(l => { xs.push(l.x); ys.push(l.y); });
  (plan.dimensions || []).forEach(d => { xs.push(d.x1, d.x2); ys.push(d.y1, d.y2); });
  if (!xs.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, vacio: true };
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys), vacio: false };
}

/** Lienzo de trabajo: lo indicado o el dibujo con 2 m de margen, lo que sea mayor. */
export function lienzoParaPlano(plan, canvas = {}) {
  const b = limitesPlano(plan);
  return {
    widthMeters: redondear(clamp(Math.max(num(canvas?.widthMeters, 0), b.maxX + 2, 8), 4, 120)),
    heightMeters: redondear(clamp(Math.max(num(canvas?.heightMeters, 0), b.maxY + 2, 6), 4, 120)),
    scale: PX_POR_METRO
  };
}

/** Superficie útil por estancia, total útil y construida aproximada (muros de 15 cm repartidos). */
export function resumenSuperficies(plan) {
  const estancias = (plan.rooms || []).map(r => ({ id: r.id, nombre: r.name, area: redondear(Math.abs(areaConSigno(r.points))) }));
  const util = redondear(estancias.reduce((t, e) => t + e.area, 0));
  const construida = redondear((plan.rooms || []).reduce((t, r) => t + Math.abs(areaConSigno(r.points)) + perimetro(r.points) * 0.075, 0));
  return { estancias, util, construida };
}

// --- Edición de polígonos (vértices, lados y medidas fijas) ---

/** Lados cuya medida ha cambiado (más de 1 mm) entre dos versiones de la estancia. */
function ladosCambiados(antes, despues) {
  if (antes.points.length !== despues.points.length) return [];
  return lados(antes).filter(({ i, largo }) => Math.abs(largoMuro(despues, i) - largo) > 0.001).map(l => l.i);
}

/** ¿Respeta la nueva forma las medidas fijas de la estancia? */
export const respetaFijas = (antes, despues) => ladosCambiados(antes, despues).every(i => !(antes.fijas || []).includes(i));

/**
 * Mueve el vértice k a (x, y) respetando las medidas fijas:
 * con un lado contiguo fijo, el punto gira alrededor del vecino (mantiene el largo);
 * con los dos fijos, no se mueve. Devuelve la estancia nueva o null si no puede moverse.
 */
export function moverVertice(room, k, x, y) {
  const p = room.points, n = p.length;
  const fijas = room.fijas || [];
  const ePrev = (k - 1 + n) % n, eSig = k;
  const prevFijo = fijas.includes(ePrev), sigFijo = fijas.includes(eSig);
  if (prevFijo && sigFijo) return null;
  let destino = [x, y];
  if (prevFijo || sigFijo) {
    const centro = prevFijo ? p[(k - 1 + n) % n] : p[(k + 1) % n];
    const radio = Math.hypot(p[k][0] - centro[0], p[k][1] - centro[1]);
    const d = Math.hypot(x - centro[0], y - centro[1]) || 1;
    destino = [centro[0] + ((x - centro[0]) / d) * radio, centro[1] + ((y - centro[1]) / d) * radio];
  }
  return rehacerEstancia({ ...room, points: p.map((q, i) => (i === k ? destino : q)) });
}

/**
 * Cambia la medida del lado `edge` (lo que escribe el usuario en la cota).
 * Se mueve el final del lado en su dirección; si el lado siguiente es paralelo al opuesto
 * (rectángulos, romboides), también se desplaza el punto siguiente para conservar la forma.
 */
export function cambiarLargoLado(room, edge, largo) {
  const p = room.points.map(q => [...q]), n = p.length;
  const a = p[edge], bIdx = (edge + 1) % n, b = p[bIdx];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (!(L > 0) || !(largo > 0.1)) return room;
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const delta = [u[0] * (largo - L), u[1] * (largo - L)];
  const cIdx = (bIdx + 1) % n, dIdx = (cIdx + 1) % n;
  const cd = [p[dIdx][0] - p[cIdx][0], p[dIdx][1] - p[cIdx][1]];
  const paralelo = n >= 4 && Math.abs(u[0] * cd[1] - u[1] * cd[0]) < 1e-3 * (Math.hypot(...cd) || 1);
  p[bIdx] = [b[0] + delta[0], b[1] + delta[1]];
  if (paralelo && cIdx !== edge) p[cIdx] = [p[cIdx][0] + delta[0], p[cIdx][1] + delta[1]];
  return rehacerEstancia({ ...room, points: p });
}

/** Añade un vértice en el lado `edge` (en el punto dado); los huecos y medidas fijas se reordenan. */
export function insertarVertice(plan, roomId, edge, punto) {
  const room = plan.rooms.find(r => r.id === roomId);
  if (!room || room.points.length >= 40) return plan;
  const L = largoMuro(room, edge);
  const a = room.points[edge];
  const t = L ? Math.hypot(punto[0] - a[0], punto[1] - a[1]) / L : 0.5;
  const points = [...room.points.slice(0, edge + 1), punto, ...room.points.slice(edge + 1)];
  // El lado partido deja de ser fijo; los posteriores suben un puesto.
  const fijas = (room.fijas || []).filter(i => i !== edge).map(i => (i > edge ? i + 1 : i));
  const nueva = rehacerEstancia({ ...room, points, fijas });
  return {
    ...plan,
    rooms: plan.rooms.map(r => (r.id === roomId ? nueva : r)),
    openings: plan.openings.map(o => {
      if (o.roomId !== roomId) return o;
      if (o.edge > edge) return { ...o, edge: o.edge + 1 };
      if (o.edge < edge) return o;
      // El hueco se queda en la mitad del lado donde estaba su centro.
      const enPrimera = o.positionRatio <= t;
      const ratio = enPrimera ? o.positionRatio / (t || 1) : (o.positionRatio - t) / ((1 - t) || 1);
      const e = enPrimera ? edge : edge + 1;
      const widthMeters = Math.min(o.widthMeters, Math.max(0.4, largoMuro(nueva, e) - 0.1));
      return { ...o, edge: e, widthMeters, positionRatio: ratioQueCabe(nueva, e, ratio, widthMeters) };
    })
  };
}

/** Quita el vértice k (mínimo 3); los huecos de sus dos lados pasan al lado que los une. */
export function quitarVertice(plan, roomId, k) {
  const room = plan.rooms.find(r => r.id === roomId);
  if (!room || room.points.length <= 3) return plan;
  const n = room.points.length;
  const ePrev = (k - 1 + n) % n;
  const points = room.points.filter((_, i) => i !== k);
  const nuevoIndice = (i) => {
    if (i === k) return k === 0 ? n - 2 : k - 1;
    return i > k ? i - 1 : i;
  };
  const fijas = (room.fijas || []).filter(i => i !== k && i !== ePrev).map(nuevoIndice);
  const nueva = rehacerEstancia({ ...room, points, fijas });
  return {
    ...plan,
    rooms: plan.rooms.map(r => (r.id === roomId ? nueva : r)),
    openings: plan.openings.map(o => {
      if (o.roomId !== roomId) return o;
      const e = nuevoIndice(o.edge);
      const widthMeters = Math.min(o.widthMeters, Math.max(0.4, largoMuro(nueva, e) - 0.1));
      return { ...o, edge: e, widthMeters, positionRatio: ratioQueCabe(nueva, e, o.positionRatio, widthMeters) };
    })
  };
}

// --- Geometría de dibujo (la comparten el lienzo SVG, la vista 3D y el PDF) ---

/** Inicio, dirección, normal hacia dentro de la estancia y largo del lado `edge`. */
export function geometriaMuro(room, edge) {
  const p = room.points, n = p.length;
  const a = p[edge % n], b = p[(edge + 1) % n];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6;
  const dir = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  const inward = areaConSigno(p) >= 0 ? [-dir[1], dir[0]] : [dir[1], -dir[0]];
  return { start: a, end: b, dir, inward, length };
}

/**
 * Formas del hueco en metros: `hueco` (polígono blanco que corta el muro), `lineas` (trazo fino),
 * `discontinuas` (arco de apertura de la puerta) y `extremos` (para seleccionarlo).
 */
export function formasHueco(room, op) {
  const g = geometriaMuro(room, op.edge);
  const w = op.widthMeters;
  const t = GROSOR_MURO;
  const c = [g.start[0] + g.dir[0] * g.length * op.positionRatio, g.start[1] + g.dir[1] * g.length * op.positionRatio];
  // (u a lo largo del muro, v hacia dentro de la estancia) -> coordenadas del plano.
  const p = (u, v) => [redondear(c[0] + g.dir[0] * u + g.inward[0] * v, 4), redondear(c[1] + g.dir[1] * u + g.inward[1] * v, 4)];
  const hueco = [p(-w / 2, -t / 2 - 0.01), p(w / 2, -t / 2 - 0.01), p(w / 2, t / 2 + 0.01), p(-w / 2, t / 2 + 0.01)];
  const lineas = [[p(-w / 2, -t / 2), p(-w / 2, t / 2)], [p(w / 2, -t / 2), p(w / 2, t / 2)]];
  const discontinuas = [];

  if (op.type === 'window') {
    // Doble línea técnica: carpintería a las caras del muro y vidrio en el centro.
    lineas.push([p(-w / 2, -t / 2), p(w / 2, -t / 2)], [p(-w / 2, t / 2), p(w / 2, t / 2)]);
    lineas.push([p(-w / 2, -t / 8), p(w / 2, -t / 8)], [p(-w / 2, t / 8), p(w / 2, t / 8)]);
  } else if (op.type === 'sliding_door') {
    const solape = Math.min(0.08, w / 10);
    lineas.push([p(-w / 2, -t / 6), p(solape, -t / 6)], [p(-solape, t / 6), p(w / 2, t / 6)]);
    lineas.push([p(-w / 2, -t / 6 - 0.02), p(solape, -t / 6 - 0.02)], [p(-solape, t / 6 + 0.02), p(w / 2, t / 6 + 0.02)]);
  } else {
    const uBisagra = op.hinge === 'end' ? w / 2 : -w / 2;
    const signoU = op.hinge === 'end' ? -1 : 1;
    const sv = op.swing === 'out' ? -1 : 1;
    const vBase = sv * t / 2;
    // Hoja abierta 90° y arco de barrido de 90°.
    lineas.push([p(uBisagra, vBase), p(uBisagra, vBase + sv * w)]);
    const arco = [];
    for (let i = 0; i <= 16; i++) {
      const a = (Math.PI / 2) * (i / 16);
      arco.push(p(uBisagra + signoU * w * Math.sin(a), vBase + sv * w * Math.cos(a)));
    }
    discontinuas.push(arco);
  }
  return { hueco, lineas, discontinuas, centro: c, extremos: [p(-w / 2, 0), p(w / 2, 0)] };
}

/**
 * Cota entre dos puntos desplazada `offset` m a la izquierda del sentido p1->p2:
 * línea de cota, líneas de referencia, marcas oblicuas a 45° y texto centrado.
 */
export function formasCota(x1, y1, x2, y2, offset = 0, textoCota = null, { referencias: conReferencias = true } = {}) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 1e-6) return null;
  const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  const nx = uy, ny = -ux;
  const a = [x1 + nx * offset, y1 + ny * offset];
  const b = [x2 + nx * offset, y2 + ny * offset];
  const tick = 0.09;
  const ox = (ux + nx) * tick, oy = (uy + ny) * tick;
  let angulo = (Math.atan2(uy, ux) * 180) / Math.PI;
  // Siempre legible: de izquierda a derecha o, en vertical, de abajo arriba.
  if (angulo >= 90) angulo -= 180;
  if (angulo < -90) angulo += 180;
  // El texto va un poco "por encima" de la línea según el sentido de lectura.
  const rx = Math.cos((angulo * Math.PI) / 180), ry = Math.sin((angulo * Math.PI) / 180);
  const sobre = 0.08;
  const s = conReferencias ? Math.sign(offset) : 0;
  const ref = (px, py, q) => [[px + nx * s * 0.05, py + ny * s * 0.05], [q[0] + nx * s * 0.1, q[1] + ny * s * 0.1]];
  return {
    linea: [a, b],
    referencias: s ? [ref(x1, y1, a), ref(x2, y2, b)] : [],
    marcas: [[[a[0] - ox, a[1] - oy], [a[0] + ox, a[1] + oy]], [[b[0] - ox, b[1] - oy], [b[0] + ox, b[1] + oy]]],
    texto: { x: (a[0] + b[0]) / 2 + ry * sobre, y: (a[1] + b[1]) / 2 - rx * sobre, angulo, valor: textoCota ?? formatoMetros(L) },
    longitud: L
  };
}

/**
 * Cotas interiores de la estancia, paralelas a cada lado (en un rectángulo, solo ancho y fondo).
 * Cada una lleva `edge` (para editarla en el plano) y `fija`.
 */
export function cotasEstancia(room) {
  const rect = esRectangulo(room);
  const corto = Math.min(room.width, room.height);
  const d = Math.min(0.35, corto / 4);
  const signo = areaConSigno(room.points) >= 0 ? -1 : 1; // offset hacia dentro
  return lados(room)
    .filter(({ i, largo }) => largo >= 0.3 && (!rect || i === 0 || i === 3))
    .map(({ i, a, b }) => {
      const forma = formasCota(a[0], a[1], b[0], b[1], signo * d, null, { referencias: false });
      return forma && { ...forma, edge: i, fija: (room.fijas || []).includes(i) };
    })
    .filter(Boolean);
}

/** Cotas generales del conjunto (por fuera, arriba y a la izquierda). */
export function cotasGenerales(plan) {
  if (!(plan.rooms || []).length) return [];
  const xs = plan.rooms.flatMap(r => r.points.map(p => p[0]));
  const ys = plan.rooms.flatMap(r => r.points.map(p => p[1]));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return [
    formasCota(minX, minY, maxX, minY, 0.6),
    formasCota(minX, maxY, minX, minY, 0.6)
  ].filter(Boolean);
}

/** Proyecta un punto sobre el lado más cercano: { roomId, edge, ratio, distancia }. */
export function muroMasCercano(plan, x, y) {
  let mejor = null;
  for (const room of plan.rooms || []) {
    for (const { i } of lados(room)) {
      const g = geometriaMuro(room, i);
      const t = clamp(((x - g.start[0]) * g.dir[0] + (y - g.start[1]) * g.dir[1]) / g.length, 0, 1);
      const px = g.start[0] + g.dir[0] * g.length * t, py = g.start[1] + g.dir[1] * g.length * t;
      const distancia = Math.hypot(x - px, y - py);
      if (!mejor || distancia < mejor.distancia) mejor = { roomId: room.id, edge: i, ratio: t, distancia };
    }
  }
  return mejor;
}

/**
 * Muros para la vista 3D: cada tramo compartido por dos estancias sale una sola vez,
 * con los huecos de ambas. { a, b, alto, huecos: [{ desde, hasta, type }] } en metros a lo largo del muro.
 */
export function murosParaVolumen(plan) {
  const clave = (p) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
  const muros = new Map();
  (plan.rooms || []).forEach(room => {
    const alto = room.alto || ALTO_DEFECTO;
    lados(room).forEach(({ i, a, b, largo }) => {
      if (largo < 0.01) return;
      const directo = `${clave(a)}|${clave(b)}`, inverso = `${clave(b)}|${clave(a)}`;
      const k = muros.has(inverso) ? inverso : directo;
      if (!muros.has(k)) muros.set(k, { a, b, alto, huecos: [] });
      const muro = muros.get(k);
      muro.alto = Math.max(muro.alto, alto);
      const invertido = k === inverso;
      plan.openings.filter(o => o.roomId === room.id && o.edge === i).forEach(o => {
        const centro = (invertido ? 1 - o.positionRatio : o.positionRatio) * largo;
        muro.huecos.push({ desde: centro - o.widthMeters / 2, hasta: centro + o.widthMeters / 2, type: o.type });
      });
    });
  });
  return [...muros.values()];
}

// --- Mediciones del presupuesto ---

/**
 * Lee las mediciones por estancia de las notas de la visita.
 * Formato del asistente: "- Salón: 5 x 4 x 2,30 m (superficie 20 m², ...)" y variantes ("Baño 2,5x1,8").
 */
export function leerMediciones(textoNotas) {
  const filas = [];
  String(textoNotas || '').split(/\r?\n/).forEach(linea => {
    const limpia = linea.replace(/^[\s\-•*·]+/, '').trim();
    const m = limpia.match(/^([^:\d][^:]*?)\s*:?\s*(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×*]\s*(\d+(?:[.,]\d+)?))?\s*(m|cm)?\b/i);
    if (!m) return;
    const factor = (m[5] || '').toLowerCase() === 'cm' ? 0.01 : 1;
    const largo = num(m[2]) * factor, ancho = num(m[3]) * factor;
    if (!(largo > 0 && ancho > 0) || largo > 80 || ancho > 80) return;
    filas.push({
      id: nuevoId('med'),
      estancia: m[1].trim().replace(/\s+/g, ' ').slice(0, 60),
      largo: redondear(largo),
      ancho: redondear(ancho),
      alto: m[4] ? redondear(num(m[4]) * factor) : ''
    });
  });
  return filas;
}

/** Texto de mediciones que se envía a la IA. */
export function textoMediciones(filas) {
  return (filas || [])
    .filter(f => f.estancia || (num(f.largo) > 0 && num(f.ancho) > 0))
    .map(f => {
      const l = num(f.largo), a = num(f.ancho);
      const area = l > 0 && a > 0 ? ` = ${redondear(l * a)} m²` : '';
      return `- ${f.estancia || 'Estancia sin nombre'}: ${l || '?'} m (este-oeste) x ${a || '?'} m (norte-sur)${area}${num(f.alto) > 0 ? `, altura ${num(f.alto)} m` : ''}`;
    }).join('\n');
}

/**
 * Croquis sin IA: estancias en filas (como un catálogo), compartiendo muro, con una puerta cada una.
 * Sirve de punto de partida para colocarlas a mano en el editor.
 */
export function croquisDesdeMediciones(filas) {
  const validas = (filas || []).filter(f => num(f.largo) > 0 && num(f.ancho) > 0);
  const total = validas.reduce((t, f) => t + num(f.largo), 0);
  const anchoFila = Math.max(8, Math.sqrt(validas.reduce((t, f) => t + num(f.largo) * num(f.ancho), 0)) * 1.6, ...validas.map(f => num(f.largo)));
  let x = 0, y = 0, altoFila = 0;
  const rooms = [], openings = [];
  validas.forEach((f, i) => {
    const width = num(f.largo), height = num(f.ancho);
    if (x > 0 && x + width > anchoFila && total > anchoFila) { x = 0; y += altoFila; altoFila = 0; }
    const id = `room-${i + 1}`;
    rooms.push({ id, name: f.estancia || `Estancia ${i + 1}`, x, y, width, height, alto: num(f.alto) || undefined, color: COLORES_ESTANCIA[i % COLORES_ESTANCIA.length] });
    openings.push({ id: `op-${i + 1}`, type: 'door', roomId: id, wall: 'south', positionRatio: 0.2, widthMeters: 0.82 });
    x += width;
    altoFila = Math.max(altoFila, height);
  });
  return normalizarCroquis({ rooms, openings, notes: ['Distribución provisional sin IA: coloca cada estancia en su sitio.'] });
}
