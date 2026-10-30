/**
 * ObraMaster - Croquis 2D de distribución (planta) a partir de mediciones y fotos.
 *
 * Lo usan el servidor (normaliza la respuesta de la IA) y el navegador (editor SVG y PDF).
 * Unidades: metros. Origen arriba a la izquierda, x hacia el este, y hacia el sur (el norte queda arriba).
 *
 * Contrato IA -> app:
 * {
 *   canvas: { widthMeters, heightMeters, scale },            // scale = px por metro en el editor
 *   rooms: [{ id, name, x, y, width, height, area, color }],
 *   openings: [{ id, type: door|window|sliding_door, roomId, wall: north|south|east|west,
 *                positionRatio (centro del hueco, 0-1 a lo largo del muro), widthMeters,
 *                swing: in|out, hinge: start|end }],
 *   labels: [{ id, text, x, y, rotation, size }],
 *   dimensions: [{ id, x1, y1, x2, y2, offset }],             // cotas libres
 *   notes: ["supuestos de la IA"]
 * }
 */

export const PX_POR_METRO = 50;
// Grosor de muro dibujado (m): 12 cm. Las estancias contiguas comparten el muro.
export const GROSOR_MURO = 0.12;
export const TIPOS_HUECO = ['door', 'window', 'sliding_door'];
export const MUROS = ['north', 'south', 'east', 'west'];
export const NOMBRE_HUECO = { door: 'Puerta', window: 'Ventana', sliding_door: 'Corredera' };
export const NOMBRE_MURO = { north: 'Norte', south: 'Sur', east: 'Este', west: 'Oeste' };
export const ANCHO_HUECO = { door: 0.82, window: 1.2, sliding_door: 1.8 };
export const COLORES_ESTANCIA = ['#f8fafc', '#fefce8', '#f0f9ff', '#f0fdf4', '#fdf2f8', '#f5f3ff', '#fff7ed', '#ecfeff'];

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

/** Longitud del muro de una estancia. */
export const largoMuro = (room, wall) => (wall === 'north' || wall === 'south' ? room.width : room.height);

/** Ratio del centro del hueco limitado para que quepa entero en el muro. */
export function ratioQueCabe(room, wall, ratio, ancho) {
  const L = largoMuro(room, wall);
  if (!(L > 0)) return 0.5;
  const margen = Math.min(0.5, (ancho / 2 + 0.05) / L);
  return redondear(clamp(ratio, margen, 1 - margen), 4);
}

/**
 * Limpia y corrige el plano (de la IA o guardado): números válidos, tamaños razonables,
 * superficies recalculadas, huecos dentro de su muro y todo desplazado a coordenadas positivas.
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
    const width = redondear(clamp(Math.abs(num(r?.width ?? r?.ancho, 3)), 0.4, 60));
    const height = redondear(clamp(Math.abs(num(r?.height ?? r?.largo ?? r?.alto, 3)), 0.4, 60));
    return {
      id: idUnico(r?.id, 'room'),
      name: texto(r?.name ?? r?.nombre, 60) || `Estancia ${i + 1}`,
      x: redondear(num(r?.x)),
      y: redondear(num(r?.y)),
      width,
      height,
      area: redondear(width * height),
      color: color(r?.color, i)
    };
  });

  // Todo a coordenadas positivas (con el plano pegado al origen).
  const minX = rooms.length ? Math.min(...rooms.map(r => r.x)) : 0;
  const minY = rooms.length ? Math.min(...rooms.map(r => r.y)) : 0;
  rooms.forEach(r => { r.x = redondear(r.x - minX); r.y = redondear(r.y - minY); });
  const byId = new Map(rooms.map(r => [r.id, r]));

  const openings = (Array.isArray(src.openings) ? src.openings : []).slice(0, 200).map((o) => {
    const type = TIPOS_HUECO.includes(o?.type) ? o.type : 'door';
    const room = byId.get(String(o?.roomId ?? '')) || null;
    if (!room) return null;
    const wall = MUROS.includes(o?.wall) ? o.wall : 'south';
    const widthMeters = redondear(clamp(Math.abs(num(o?.widthMeters ?? o?.width, ANCHO_HUECO[type])), 0.4, Math.max(0.4, largoMuro(room, wall) - 0.1)));
    return {
      id: idUnico(o?.id, 'op'),
      type,
      roomId: room.id,
      wall,
      positionRatio: ratioQueCabe(room, wall, num(o?.positionRatio, 0.5), widthMeters),
      widthMeters,
      swing: o?.swing === 'out' ? 'out' : 'in',
      hinge: o?.hinge === 'end' ? 'end' : 'start'
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
  (plan.rooms || []).forEach(r => { xs.push(r.x, r.x + r.width); ys.push(r.y, r.y + r.height); });
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
  const estancias = (plan.rooms || []).map(r => ({ id: r.id, nombre: r.name, area: redondear(r.width * r.height) }));
  const util = redondear(estancias.reduce((t, e) => t + e.area, 0));
  const construida = redondear((plan.rooms || []).reduce((t, r) => t + (r.width + 0.15) * (r.height + 0.15), 0));
  return { estancias, util, construida };
}

// --- Geometría de dibujo (la comparten el lienzo SVG y el PDF) ---

/** Inicio, dirección y normal hacia dentro de la estancia de cada muro. */
export function geometriaMuro(room, wall) {
  switch (wall) {
    case 'north': return { start: [room.x, room.y], dir: [1, 0], inward: [0, 1], length: room.width };
    case 'south': return { start: [room.x, room.y + room.height], dir: [1, 0], inward: [0, -1], length: room.width };
    case 'west': return { start: [room.x, room.y], dir: [0, 1], inward: [1, 0], length: room.height };
    default: return { start: [room.x + room.width, room.y], dir: [0, 1], inward: [-1, 0], length: room.height };
  }
}

/**
 * Formas del hueco en metros: `hueco` (polígono blanco que corta el muro), `lineas` (trazo fino)
 * y `discontinuas` (arco de apertura de la puerta, polilínea).
 */
export function formasHueco(room, op) {
  const g = geometriaMuro(room, op.wall);
  const w = op.widthMeters;
  const t = GROSOR_MURO;
  const c = [g.start[0] + g.dir[0] * g.length * op.positionRatio, g.start[1] + g.dir[1] * g.length * op.positionRatio];
  // (u a lo largo del muro, v hacia dentro de la estancia) -> coordenadas del plano.
  const p = (u, v) => [redondear(c[0] + g.dir[0] * u + g.inward[0] * v, 4), redondear(c[1] + g.dir[1] * u + g.inward[1] * v, 4)];
  const hueco = [p(-w / 2, -t / 2 - 0.01), p(w / 2, -t / 2 - 0.01), p(w / 2, t / 2 + 0.01), p(-w / 2, t / 2 + 0.01)];
  const jambas = [[p(-w / 2, -t / 2), p(-w / 2, t / 2)], [p(w / 2, -t / 2), p(w / 2, t / 2)]];
  const lineas = [...jambas];
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
  return { hueco, lineas, discontinuas, centro: c, horizontal: g.dir[0] === 1 };
}

/**
 * Cota entre dos puntos desplazada `offset` m a la izquierda del sentido p1->p2:
 * línea de cota, líneas de referencia, marcas oblicuas a 45° y texto centrado.
 */
export function formasCota(x1, y1, x2, y2, offset = 0, textoCota = null) {
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
  const s = Math.sign(offset);
  const ref = (px, py, q) => [[px + nx * s * 0.05, py + ny * s * 0.05], [q[0] + nx * s * 0.1, q[1] + ny * s * 0.1]];
  return {
    linea: [a, b],
    referencias: s ? [ref(x1, y1, a), ref(x2, y2, b)] : [],
    marcas: [[[a[0] - ox, a[1] - oy], [a[0] + ox, a[1] + oy]], [[b[0] - ox, b[1] - oy], [b[0] + ox, b[1] + oy]]],
    texto: { x: (a[0] + b[0]) / 2 + ry * sobre, y: (a[1] + b[1]) / 2 - rx * sobre, angulo, valor: textoCota ?? formatoMetros(L) },
    longitud: L
  };
}

/** Cotas interiores de cada estancia (ancho junto al muro norte y fondo junto al oeste). */
export function cotasEstancia(room) {
  const d = Math.min(0.35, room.height / 4, room.width / 4);
  return [
    formasCota(room.x, room.y + d, room.x + room.width, room.y + d, 0),
    formasCota(room.x + d, room.y + room.height, room.x + d, room.y, 0)
  ].filter(Boolean);
}

/** Cotas generales del conjunto (por fuera, arriba y a la izquierda). */
export function cotasGenerales(plan) {
  if (!(plan.rooms || []).length) return [];
  const xs = plan.rooms.flatMap(r => [r.x, r.x + r.width]);
  const ys = plan.rooms.flatMap(r => [r.y, r.y + r.height]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return [
    formasCota(minX, minY, maxX, minY, 0.6),
    formasCota(minX, maxY, minX, minY, 0.6)
  ].filter(Boolean);
}

/** Proyecta un punto sobre el muro más cercano: { roomId, wall, ratio, distancia }. */
export function muroMasCercano(plan, x, y) {
  let mejor = null;
  for (const room of plan.rooms || []) {
    for (const wall of MUROS) {
      const g = geometriaMuro(room, wall);
      const t = clamp(((x - g.start[0]) * g.dir[0] + (y - g.start[1]) * g.dir[1]) / g.length, 0, 1);
      const px = g.start[0] + g.dir[0] * g.length * t, py = g.start[1] + g.dir[1] * g.length * t;
      const distancia = Math.hypot(x - px, y - py);
      if (!mejor || distancia < mejor.distancia) mejor = { roomId: room.id, wall, ratio: t, distancia };
    }
  }
  return mejor;
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
    rooms.push({ id, name: f.estancia || `Estancia ${i + 1}`, x, y, width, height, color: COLORES_ESTANCIA[i % COLORES_ESTANCIA.length] });
    openings.push({ id: `op-${i + 1}`, type: 'door', roomId: id, wall: 'south', positionRatio: 0.2, widthMeters: 0.82 });
    x += width;
    altoFila = Math.max(altoFila, height);
  });
  return normalizarCroquis({ rooms, openings, notes: ['Distribución provisional sin IA: coloca cada estancia en su sitio.'] });
}
