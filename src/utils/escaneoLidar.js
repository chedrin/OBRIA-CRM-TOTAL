/**
 * ObraMaster - Lectura de escaneos LiDAR (iPhone / iPad Pro) para el croquis y las mediciones.
 *
 * Formatos (todo se lee en el navegador, sin IA):
 * - JSON de RoomPlan (CapturedRoom o CapturedStructure de Apple): muros, suelos, puertas, ventanas y estancias.
 * - OBJ (malla 3D de Polycam, 3D Scanner App, Scaniverse…): el contorno sale del suelo y el techo de la malla,
 *   separado por los muros que llegan al techo (también los dinteles de las puertas).
 * - DXF (plano 2D): polilíneas cerradas = estancias; si solo hay líneas, se buscan los recintos cerrados.
 * - CSV / TXT: lista de estancias con sus medidas.
 * - Imagen del plano (PNG/JPG): no se mide aquí; se pasa a la IA del croquis como foto.
 *
 * Resultado: { formato, nombreArchivo, plan (contrato de croquisPlano.js), mediciones (filas del croquis), avisos, resumen }.
 * Unidades: metros. En planta, x hacia el este e y hacia el sur (norte arriba).
 */
import { areaConSigno, croquisDesdeMediciones, leerMediciones, normalizarCroquis, nuevoId, perimetro, redondear } from './croquisPlano.js';

export const MAX_MB_ESCANEO = 80;
export const ACCEPT_ESCANEO = '.json,.obj,.dxf,.csv,.txt,.png,.jpg,.jpeg,.webp,.usdz,.pdf';
export const FORMATO_ESCANEO = {
  roomplan: 'RoomPlan (JSON)',
  croquis: 'Croquis de ObraMaster (JSON)',
  obj: 'Malla 3D (OBJ)',
  dxf: 'Plano DXF',
  lista: 'Lista de medidas',
  imagen: 'Imagen del plano'
};

const NOMBRES_ROOMPLAN = {
  livingRoom: 'Salón', bedroom: 'Dormitorio', bathroom: 'Baño', kitchen: 'Cocina', diningRoom: 'Comedor',
  unidentified: 'Estancia'
};
const ESTANCIA_LAYER = /room|estanc|habit|space|espacio|recinto|zona|area|área|local/i;

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fmt = (n) => Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 });

function errorEscaneo(mensaje) {
  const err = new Error(mensaje);
  err.escaneo = true;
  return err;
}

// --- Geometría común ---

/** Ángulo dominante (radianes, módulo 90°) de unos segmentos, ponderado por su largo. */
function anguloDominante(segmentos) {
  let c = 0, s = 0;
  segmentos.forEach(([a, b]) => {
    const L = dist(a, b);
    if (L < 0.05) return;
    const t = Math.atan2(b[1] - a[1], b[0] - a[0]) * 4;
    c += L * Math.cos(t);
    s += L * Math.sin(t);
  });
  return c || s ? Math.atan2(s, c) / 4 : 0;
}

const girar = (p, ang) => {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

/** Punto donde se cortan las rectas a1-a2 y b1-b2 (null si son casi paralelas). */
function cruce(a1, a2, b1, b2) {
  const d1 = [a2[0] - a1[0], a2[1] - a1[1]], d2 = [b2[0] - b1[0], b2[1] - b1[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  if (Math.abs(den) < 1e-6 * (Math.hypot(...d1) * Math.hypot(...d2) || 1) * 50) return null;
  const t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / den;
  return [a1[0] + d1[0] * t, a1[1] + d1[1] * t];
}

/** Quita puntos repetidos y los que están en línea recta con sus vecinos. */
function limpiarPoligono(pts, tolGrados = 2) {
  let p = pts.slice();
  let cambiado = true;
  while (cambiado && p.length > 3) {
    cambiado = false;
    for (let i = 0; i < p.length && p.length > 3; i++) {
      const a = p[(i - 1 + p.length) % p.length], v = p[i], b = p[(i + 1) % p.length];
      if (dist(a, v) < 0.03) { p.splice(i, 1); cambiado = true; break; }
      const ang = Math.abs(Math.atan2((v[0] - a[0]) * (b[1] - v[1]) - (v[1] - a[1]) * (b[0] - v[0]), (v[0] - a[0]) * (b[0] - v[0]) + (v[1] - a[1]) * (b[1] - v[1])));
      if (ang < (tolGrados * Math.PI) / 180) { p.splice(i, 1); cambiado = true; break; }
    }
  }
  return p;
}

/** Endereza los lados que van casi en horizontal o vertical (menos de 2°), sin tocar los demás. */
function ortogonalizar(pts) {
  const p = pts.map(q => q.slice());
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    if (L < 0.05) continue;
    if (Math.abs(dy) / L < 0.035) { const y = (a[1] + b[1]) / 2; a[1] = y; b[1] = y; } else if (Math.abs(dx) / L < 0.035) { const x = (a[0] + b[0]) / 2; a[0] = x; b[0] = x; }
  }
  return p;
}

/** Douglas-Peucker sobre un polígono cerrado. */
function simplificar(pts, tol) {
  if (pts.length <= 4) return pts;
  const dp = (lista) => {
    if (lista.length < 3) return lista;
    const [a, b] = [lista[0], lista[lista.length - 1]];
    const L = dist(a, b) || 1e-9;
    let maxD = -1, k = 0;
    for (let i = 1; i < lista.length - 1; i++) {
      const d = Math.abs((b[0] - a[0]) * (a[1] - lista[i][1]) - (a[0] - lista[i][0]) * (b[1] - a[1])) / L;
      if (d > maxD) { maxD = d; k = i; }
    }
    if (maxD <= tol) return [a, b];
    return [...dp(lista.slice(0, k + 1)).slice(0, -1), ...dp(lista.slice(k))];
  };
  // Se parte por el punto más lejano del primero.
  let lejos = 0;
  pts.forEach((p, i) => { if (dist(p, pts[0]) > dist(pts[lejos], pts[0])) lejos = i; });
  const ida = dp(pts.slice(0, lejos + 1));
  const vuelta = dp([...pts.slice(lejos), pts[0]]);
  return [...ida.slice(0, -1), ...vuelta.slice(0, -1)];
}

function dentroPoligono(p, pts) {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function envolventeConvexa(puntos) {
  const p = puntos.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const abajo = [], arriba = [];
  p.forEach(q => { while (abajo.length >= 2 && cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], q) <= 0) abajo.pop(); abajo.push(q); });
  p.slice().reverse().forEach(q => { while (arriba.length >= 2 && cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], q) <= 0) arriba.pop(); arriba.push(q); });
  return [...abajo.slice(0, -1), ...arriba.slice(0, -1)];
}

/** Lado más cercano a un punto entre todas las salas: { sala, edge, ratio, d }. */
function ladoMasCercano(salas, p) {
  let mejor = null;
  salas.forEach((sala, si) => {
    const pts = sala.points;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const L = dist(a, b);
      if (L < 0.2) return;
      const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (L * L)));
      const d = dist(p, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      if (!mejor || d < mejor.d) mejor = { sala: si, edge: i, ratio: t, d };
    });
  });
  return mejor;
}

/**
 * Plan del croquis a partir de las salas medidas: todas las medidas nacen fijas (🔒)
 * y cada hueco se coloca en el lado más cercano.
 */
function construirPlan({ salas, huecos = [], notas = [] }) {
  const usadas = new Map();
  const rooms = salas.map((s, i) => {
    let pts = ortogonalizar(limpiarPoligono(s.points));
    if (areaConSigno(pts) < 0) pts = pts.reverse();
    const base = s.name || 'Estancia';
    const n = (usadas.get(base) || 0) + 1;
    usadas.set(base, n);
    return { id: `room-${i + 1}`, name: base, _n: n, points: pts.map(([x, y]) => [redondear(x, 3), redondear(y, 3)]), fijas: pts.map((_, k) => k), ...(s.alto ? { alto: redondear(s.alto) } : {}) };
  });
  // Nombres repetidos: "Dormitorio 1", "Dormitorio 2"…
  rooms.forEach(r => { if (usadas.get(r.name) > 1) r.name = `${r.name} ${r._n}`; delete r._n; });

  const openings = [];
  huecos.forEach((h, i) => {
    const lado = ladoMasCercano(rooms, h.centro);
    if (!lado || lado.d > 0.6) return;
    openings.push({ id: `op-${i + 1}`, type: h.type, roomId: rooms[lado.sala].id, edge: lado.edge, positionRatio: lado.ratio, widthMeters: h.ancho, swing: 'in', hinge: 'start' });
  });
  return normalizarCroquis({ rooms, openings, notes: notas });
}

// --- RoomPlan (Apple) ---

const categoria = (c) => (typeof c === 'string' ? c : c && typeof c === 'object' ? Object.keys(c)[0] || '' : '');

function matriz(t) {
  const m = Array.isArray(t) && Array.isArray(t[0]) ? t.flat() : t;
  return Array.isArray(m) && m.length === 16 && m.every(v => Number.isFinite(Number(v))) ? m.map(Number) : null;
}

/** Punto local -> planta [x, z] (simd_float4x4 en columnas; y es la vertical). */
const aPlanta = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[2] * x + m[6] * y + m[10] * z + m[14]];

const esquina = (c) => (Array.isArray(c) ? [num(c[0]), num(c[1]), num(c[2] ?? 0)] : [num(c?.x), num(c?.y), num(c?.z ?? 0)]);

function superficie(s) {
  const m = matriz(s?.transform);
  const dims = (Array.isArray(s?.dimensions) ? s.dimensions : [s?.dimensions?.x, s?.dimensions?.y, s?.dimensions?.z]).map(num);
  if (!m || !(dims[0] > 0)) return null;
  const dir = [m[0], m[2]];
  const L = Math.hypot(...dir) || 1;
  return { m, dims, centro: [m[12], m[14]], dir: [dir[0] / L, dir[1] / L], ancho: dims[0], alto: dims[1] || 0, esquinas: Array.isArray(s.polygonCorners) ? s.polygonCorners.map(esquina) : [], cat: s.category };
}

function poligonoSuelo(sup) {
  let pts = sup.esquinas.length >= 3 ? sup.esquinas.map(c => aPlanta(sup.m, c)) : [];
  const [w, h] = [sup.dims[0], sup.dims[1] || sup.dims[2]];
  if (pts.length < 3 || Math.abs(areaConSigno(pts)) < 0.3) pts = [[-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0]].map(c => aPlanta(sup.m, c));
  if (Math.abs(areaConSigno(pts)) < 0.3) pts = [[-w / 2, 0, -h / 2], [w / 2, 0, -h / 2], [w / 2, 0, h / 2], [-w / 2, 0, h / 2]].map(c => aPlanta(sup.m, c));
  return Math.abs(areaConSigno(pts)) >= 0.3 ? pts : null;
}

/** Contorno de una habitación encadenando sus muros (esquina = cruce de dos muros seguidos). */
function poligonoDesdeMuros(segs) {
  if (segs.length < 3) return null;
  const tol = 0.4;
  const usados = new Set([0]);
  const orden = [segs[0]];
  let fin = segs[0][1];
  for (let n = 1; n < segs.length; n++) {
    let mejor = null;
    segs.forEach((s, i) => {
      if (usados.has(i)) return;
      [[s[0], s[1]], [s[1], s[0]]].forEach(([p, q]) => {
        const d = dist(fin, p);
        if (d < tol && (!mejor || d < mejor.d)) mejor = { i, seg: [p, q], d };
      });
    });
    if (!mejor) break;
    usados.add(mejor.i);
    orden.push(mejor.seg);
    fin = mejor.seg[1];
    if (orden.length >= 3 && dist(fin, segs[0][0]) < tol) break;
  }
  if (orden.length < 3 || dist(fin, orden[0][0]) >= tol) return null;
  return orden.map((s, k) => {
    const prev = orden[(k - 1 + orden.length) % orden.length];
    return cruce(prev[0], prev[1], s[0], s[1]) || [(prev[1][0] + s[0][0]) / 2, (prev[1][1] + s[0][1]) / 2];
  });
}

function salasRoomPlan(room, avisos) {
  const muros = (room.walls || []).map(superficie).filter(Boolean);
  const segMuros = muros.map(w => [
    [w.centro[0] - (w.dir[0] * w.ancho) / 2, w.centro[1] - (w.dir[1] * w.ancho) / 2],
    [w.centro[0] + (w.dir[0] * w.ancho) / 2, w.centro[1] + (w.dir[1] * w.ancho) / 2]
  ]);
  const altos = muros.map(w => w.alto).filter(a => a >= 1.8 && a <= 8).sort((a, b) => a - b);
  const alto = altos.length ? altos[Math.floor(altos.length / 2)] : 0;

  let poligonos = (room.floors || []).map(superficie).filter(Boolean).map(poligonoSuelo).filter(Boolean);
  if (!poligonos.length && segMuros.length >= 3) {
    const p = poligonoDesdeMuros(segMuros);
    if (p) poligonos = [p];
    else {
      poligonos = [envolventeConvexa(segMuros.flat())];
      avisos.push('Los muros del escaneo no cierran: el contorno es aproximado. Revísalo en el editor.');
    }
  }
  const secciones = (room.sections || []).map(s => ({ nombre: NOMBRES_ROOMPLAN[categoria(s.label)] || 'Estancia', centro: Array.isArray(s.center) ? [num(s.center[0]), num(s.center[2])] : null }));
  const salas = poligonos.map(points => {
    const sec = secciones.find(s => s.centro && dentroPoligono(s.centro, points)) || (poligonos.length === 1 && secciones.length === 1 ? secciones[0] : null);
    return { name: sec?.nombre || 'Estancia', points, alto };
  });
  const huecos = [];
  [['doors', 'door'], ['windows', 'window'], ['openings', 'door']].forEach(([lista, type]) => {
    (room[lista] || []).map(superficie).filter(Boolean).forEach(h => {
      huecos.push({ type: type === 'door' && h.ancho > 1.4 ? 'sliding_door' : type, centro: h.centro, ancho: h.ancho });
    });
  });
  return { salas, huecos, segMuros };
}

function leerRoomPlan(datos) {
  const avisos = [];
  // CapturedStructure (iOS 17): varias habitaciones en "rooms"; si no, una sola CapturedRoom.
  const habitaciones = Array.isArray(datos.rooms) && datos.rooms.some(r => Array.isArray(r?.walls)) ? datos.rooms : [datos];
  let salas = [], huecos = [], segs = [];
  habitaciones.forEach(h => {
    const r = salasRoomPlan(h, avisos);
    salas = salas.concat(r.salas);
    huecos = huecos.concat(r.huecos);
    segs = segs.concat(r.segMuros);
  });
  if (!salas.length) throw errorEscaneo('El JSON de RoomPlan no trae suelos ni muros suficientes para dibujar la planta.');
  if (habitaciones.length === 1 && salas.length === 1 && !(datos.sections || []).length) avisos.push('El escaneo no indica el tipo de estancia: cambia el nombre en el editor.');

  // Se gira el plano para que los muros queden rectos en pantalla.
  const ang = anguloDominante(segs.length ? segs : salas.flatMap(s => s.points.map((p, i) => [p, s.points[(i + 1) % s.points.length]])));
  return {
    plan: construirPlan({
      salas: salas.map(s => ({ ...s, points: s.points.map(p => girar(p, ang)) })),
      huecos: huecos.map(h => ({ ...h, centro: girar(h.centro, ang) })),
      notas: ['Planta tomada de un escaneo LiDAR (RoomPlan): las medidas son reales y están fijas. La orientación (norte) no viene en el escaneo.']
    }),
    avisos
  };
}

// --- Rejilla (OBJ y DXF solo con líneas) ---

const LIBRE = 1, BARRERA = 2;

function crearRejilla(minX, minY, maxX, maxY, celdaDeseada = 0.05) {
  const margen = 0.3;
  const x0 = minX - margen, y0 = minY - margen;
  const celda = Math.max(celdaDeseada, (Math.max(maxX - minX, maxY - minY) + 2 * margen) / 1400);
  const w = Math.ceil((maxX - x0 + margen) / celda) + 1, h = Math.ceil((maxY - y0 + margen) / celda) + 1;
  return { x0, y0, celda, w, h, d: new Uint8Array(w * h) };
}

function marcarLinea(g, a, b, valor) {
  const pasos = Math.max(1, Math.ceil(dist(a, b) / (g.celda / 2)));
  for (let k = 0; k <= pasos; k++) {
    const i = Math.floor((a[0] + ((b[0] - a[0]) * k) / pasos - g.x0) / g.celda);
    const j = Math.floor((a[1] + ((b[1] - a[1]) * k) / pasos - g.y0) / g.celda);
    if (i >= 0 && j >= 0 && i < g.w && j < g.h) g.d[j * g.w + i] = valor;
  }
}

function marcarTriangulo(g, a, b, c, valor) {
  const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0], c[0]) - g.x0) / g.celda));
  const i1 = Math.min(g.w - 1, Math.floor((Math.max(a[0], b[0], c[0]) - g.x0) / g.celda));
  const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1], c[1]) - g.y0) / g.celda));
  const j1 = Math.min(g.h - 1, Math.floor((Math.max(a[1], b[1], c[1]) - g.y0) / g.celda));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-12) return;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const px = g.x0 + (i + 0.5) * g.celda, py = g.y0 + (j + 0.5) * g.celda;
      const w1 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
      const w2 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
      if (w1 >= -0.02 && w2 >= -0.02 && w1 + w2 <= 1.02 && g.d[j * g.w + i] !== BARRERA) g.d[j * g.w + i] = valor;
    }
  }
}

/** Contorno exterior (en metros) de un grupo de celdas. */
function contornoCeldas(g, enGrupo) {
  const sig = new Map();
  const add = (i1, j1, i2, j2) => {
    const k = `${i1},${j1}`;
    if (!sig.has(k)) sig.set(k, []);
    sig.get(k).push([i2, j2]);
  };
  for (let j = 0; j < g.h; j++) {
    for (let i = 0; i < g.w; i++) {
      if (!enGrupo(i, j)) continue;
      if (!enGrupo(i, j - 1)) add(i, j, i + 1, j);
      if (!enGrupo(i + 1, j)) add(i + 1, j, i + 1, j + 1);
      if (!enGrupo(i, j + 1)) add(i + 1, j + 1, i, j + 1);
      if (!enGrupo(i - 1, j)) add(i, j + 1, i, j);
    }
  }
  let mejor = null;
  for (const [inicio] of sig) {
    while (sig.get(inicio)?.length) {
      const lazo = [];
      let k = inicio;
      while (sig.get(k)?.length) {
        const [i, j] = k.split(',').map(Number);
        lazo.push([g.x0 + i * g.celda, g.y0 + j * g.celda]);
        const [ni, nj] = sig.get(k).pop();
        k = `${ni},${nj}`;
      }
      if (lazo.length >= 4 && (!mejor || Math.abs(areaConSigno(lazo)) > Math.abs(areaConSigno(mejor)))) mejor = lazo;
    }
  }
  return mejor;
}

/**
 * Recintos cerrados de la rejilla. `pasa(v)` dice por qué celdas avanza el exterior desde el borde;
 * lo que no se alcanza (y no es barrera) es interior. Devuelve polígonos simplificados.
 */
function recintos(g, pasa, { minArea = 1, minFino = 0.25 } = {}) {
  const { w, h, d } = g;
  const fuera = new Uint8Array(w * h);
  const cola = [];
  for (let i = 0; i < w; i++) { cola.push(i, (h - 1) * w + i); }
  for (let j = 0; j < h; j++) { cola.push(j * w, j * w + w - 1); }
  cola.forEach(c => { if (pasa(d[c])) fuera[c] = 1; });
  for (let q = 0; q < cola.length; q++) {
    const c = cola[q];
    if (!fuera[c]) continue;
    const i = c % w, j = (c - i) / w;
    [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].forEach(([a, b]) => {
      if (a < 0 || b < 0 || a >= w || b >= h) return;
      const n = b * w + a;
      if (!fuera[n] && pasa(d[n])) { fuera[n] = 1; cola.push(n); }
    });
  }
  const etiqueta = new Int32Array(w * h).fill(-1);
  const salas = [];
  for (let c = 0; c < w * h; c++) {
    if (fuera[c] || d[c] === BARRERA || etiqueta[c] >= 0) continue;
    const id = salas.length;
    const pila = [c];
    etiqueta[c] = id;
    let n = 0;
    while (pila.length) {
      const k = pila.pop();
      n++;
      const i = k % w, j = (k - i) / w;
      [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].forEach(([a, b]) => {
        if (a < 0 || b < 0 || a >= w || b >= h) return;
        const m = b * w + a;
        if (etiqueta[m] < 0 && !fuera[m] && d[m] !== BARRERA) { etiqueta[m] = id; pila.push(m); }
      });
    }
    salas.push({ id, n });
  }
  return salas
    .filter(s => s.n * g.celda * g.celda >= minArea)
    .map(s => {
      const lazo = contornoCeldas(g, (i, j) => i >= 0 && j >= 0 && i < w && j < h && etiqueta[j * w + i] === s.id);
      if (!lazo) return null;
      const pts = limpiarPoligono(simplificar(limpiarPoligono(lazo, 1), g.celda * 1.6), 4);
      const A = Math.abs(areaConSigno(pts));
      return pts.length >= 3 && A >= minArea && A / perimetro(pts) >= minFino ? pts : null;
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(areaConSigno(b)) - Math.abs(areaConSigno(a)));
}

// --- OBJ (malla 3D) ---

function leerObj(texto) {
  const v = [];
  const caras = [];
  const lineas = texto.split('\n');
  for (let n = 0; n < lineas.length; n++) {
    const l = lineas[n];
    if (l.charCodeAt(0) === 118 && l.charCodeAt(1) === 32) { // "v "
      const p = l.trim().split(/\s+/);
      v.push(+p[1], +p[2], +p[3]);
    } else if (l.charCodeAt(0) === 102 && l.charCodeAt(1) === 32) { // "f "
      const idx = l.trim().split(/\s+/).slice(1).map(t => {
        const k = parseInt(t, 10);
        return k < 0 ? v.length / 3 + k : k - 1;
      });
      for (let k = 1; k + 1 < idx.length; k++) caras.push(idx[0], idx[k], idx[k + 1]);
    }
  }
  const nv = v.length / 3;
  if (nv < 4 || caras.length < 3) throw errorEscaneo('El OBJ no tiene una malla con caras (f). Exporta la malla completa, no solo la nube de puntos.');

  // Eje vertical: Y (lo habitual en RoomPlan, Polycam o 3D Scanner App); Z si la Y no parece una altura de techo.
  const rango = [0, 1, 2].map(e => { let a = Infinity, b = -Infinity; for (let k = e; k < v.length; k += 3) { if (v[k] < a) a = v[k]; if (v[k] > b) b = v[k]; } return b - a; });
  const up = rango[1] <= 5 || rango[2] > 5 ? 1 : 2;
  // Planta: (x, z) con Y vertical; con Z vertical, (x, -y) para no dibujarla en espejo.
  const ey = up === 1 ? 2 : 1, signoY = up === 1 ? 1 : -1;
  // Unidades: en cm o mm si la altura no cabe en metros.
  const escala = rango[up] > 300 ? 0.001 : rango[up] > 12 ? 0.01 : 1;

  const alturas = [];
  const salto = Math.max(1, Math.floor(nv / 200000));
  for (let k = 0; k < nv; k += salto) alturas.push(v[k * 3 + up] * escala);
  alturas.sort((a, b) => a - b);
  const suelo = alturas[Math.floor(alturas.length * 0.02)], techo = alturas[Math.floor(alturas.length * 0.98)];
  const alto = techo - suelo;
  const avisos = [];
  if (!(alto >= 1.8 && alto <= 6)) avisos.push(`La altura detectada (${fmt(alto)} m) es rara: revisa que el OBJ sea de una vivienda y esté en metros.`);

  const P = (k) => [v[k * 3] * escala, signoY * v[k * 3 + ey] * escala];
  const H = (k) => v[k * 3 + up] * escala;
  const tipos = new Uint8Array(caras.length / 3); // 1 suelo/techo, 2 muro hasta el techo
  const segsMuro = [];
  for (let t = 0; t < caras.length; t += 3) {
    const [a, b, c] = [caras[t], caras[t + 1], caras[t + 2]];
    if (a >= nv || b >= nv || c >= nv || a < 0 || b < 0 || c < 0) continue;
    const pa = [v[a * 3] * escala, v[a * 3 + 1] * escala, v[a * 3 + 2] * escala];
    const pb = [v[b * 3] * escala, v[b * 3 + 1] * escala, v[b * 3 + 2] * escala];
    const pc = [v[c * 3] * escala, v[c * 3 + 1] * escala, v[c * 3 + 2] * escala];
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]], w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const nrm = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const L = Math.hypot(...nrm);
    if (L < 1e-12) continue;
    const vertical = Math.abs(nrm[up]) / L;
    const hs = [H(a), H(b), H(c)];
    if (vertical > 0.85 && (hs.every(z => z <= suelo + 0.2 && z >= suelo - 0.15) || hs.every(z => z >= techo - 0.3 && z <= techo + 0.15))) {
      tipos[t / 3] = 1;
    } else if (vertical < 0.3 && Math.max(...hs) > techo - 0.35) {
      tipos[t / 3] = 2;
      const q = [P(a), P(b), P(c)];
      const largos = [[q[0], q[1]], [q[1], q[2]], [q[2], q[0]]].sort((s1, s2) => dist(s2[0], s2[1]) - dist(s1[0], s1[1]));
      segsMuro.push(largos[0]);
    }
  }

  // Giro para dejar los muros rectos y rejilla de 5 cm.
  const ang = anguloDominante(segsMuro);
  const G = (k) => girar(P(k), ang);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let k = 0; k < nv; k++) {
    const [x, y] = G(k);
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const g = crearRejilla(minX, minY, maxX, maxY, 0.05);
  for (let t = 0; t < tipos.length; t++) {
    if (tipos[t] !== 2) continue;
    const [a, b, c] = [G(caras[t * 3]), G(caras[t * 3 + 1]), G(caras[t * 3 + 2])];
    marcarLinea(g, a, b, BARRERA); marcarLinea(g, b, c, BARRERA); marcarLinea(g, c, a, BARRERA);
  }
  for (let t = 0; t < tipos.length; t++) {
    if (tipos[t] === 1) marcarTriangulo(g, G(caras[t * 3]), G(caras[t * 3 + 1]), G(caras[t * 3 + 2]), LIBRE);
  }
  // El exterior avanza por todo lo que no sea suelo/techo (también por los muros); los huecos de muebles quedan dentro.
  const poligonos = recintos(g, val => val !== LIBRE, { minArea: 1.2, minFino: 0.25 });
  if (!poligonos.length) throw errorEscaneo('No se encontró el suelo ni el techo en la malla. Prueba a exportar en JSON (RoomPlan) o DXF.');
  avisos.push('Desde una malla OBJ no se conocen los nombres de las estancias ni las puertas: ponlos en el editor.');
  return {
    plan: construirPlan({
      salas: poligonos.map(points => ({ name: 'Estancia', points, alto })),
      notas: ['Planta tomada de un escaneo LiDAR (malla OBJ): contornos medidos al centímetro; puertas y ventanas por colocar.']
    }),
    avisos
  };
}

// --- DXF (plano 2D) ---

function leerDxf(texto) {
  const l = texto.split(/\r?\n/);
  const pares = [];
  for (let i = 0; i + 1 < l.length; i += 2) pares.push([parseInt(l[i], 10), l[i + 1].trim()]);
  let unidades = 0;
  let seccion = '';
  const entidades = [];
  let actual = null, polilinea = null;
  for (let k = 0; k < pares.length; k++) {
    const [c, val] = pares[k];
    if (c === 9 && val === '$INSUNITS') { unidades = parseInt(pares[k + 1]?.[1], 10) || 0; continue; }
    if (c === 0) {
      if (val === 'SECTION') { seccion = pares[k + 1]?.[1] || ''; continue; }
      if (val === 'ENDSEC') { seccion = ''; continue; }
      if (seccion !== 'ENTITIES') continue;
      if (val === 'VERTEX' && polilinea) { actual = { tipo: 'VERTEX', pts: [] }; continue; }
      if (val === 'SEQEND' && polilinea) { entidades.push(polilinea); polilinea = null; actual = null; continue; }
      actual = { tipo: val, pts: [], capa: '', texto: '', flags: 0 };
      if (val === 'POLYLINE') polilinea = actual;
      else if (['LINE', 'LWPOLYLINE', 'TEXT', 'MTEXT'].includes(val)) entidades.push(actual);
      continue;
    }
    if (!actual || seccion !== 'ENTITIES') continue;
    const n = num(val);
    if (c === 8) actual.capa = val;
    else if (c === 70) actual.flags = parseInt(val, 10) || 0;
    else if (c === 1 || c === 3) actual.texto += val;
    else if (actual.tipo === 'POLYLINE' && (c === 10 || c === 20)) continue; // punto ficticio de la cabecera
    else if (c === 10) { (actual.tipo === 'VERTEX' ? polilinea.pts : actual.pts).push([n, 0]); }
    else if (c === 20) { const lista = actual.tipo === 'VERTEX' ? polilinea.pts : actual.pts; if (lista.length) lista[lista.length - 1][1] = n; }
    else if (c === 11) actual.pts.push([n, 0]);
    else if (c === 21 && actual.pts.length) actual.pts[actual.pts.length - 1][1] = n;
  }
  if (polilinea) entidades.push(polilinea);

  // Unidades ($INSUNITS: 1 pulgada, 2 pies, 4 mm, 5 cm, 6 m); si no vienen, por el tamaño del dibujo.
  const todos = entidades.flatMap(e => e.pts).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!todos.length) throw errorEscaneo('El DXF no tiene líneas ni polilíneas en ENTITIES (¿está todo dentro de bloques?). Exporta el plano "descompuesto".');
  const extension = Math.max(Math.max(...todos.map(p => p[0])) - Math.min(...todos.map(p => p[0])), Math.max(...todos.map(p => p[1])) - Math.min(...todos.map(p => p[1])));
  const avisos = [];
  let escala = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 }[unidades];
  if (!escala) {
    escala = extension > 2000 ? 0.001 : extension > 200 ? 0.01 : 1;
    avisos.push(`El DXF no indica unidades: se ha leído en ${escala === 1 ? 'metros' : escala === 0.01 ? 'centímetros' : 'milímetros'}. Comprueba una medida conocida.`);
  }
  // En DXF la Y va hacia arriba; en el croquis, hacia abajo.
  const aM = ([x, y]) => [x * escala, -y * escala];
  const textos = entidades.filter(e => (e.tipo === 'TEXT' || e.tipo === 'MTEXT') && e.pts.length).map(e => ({
    p: aM(e.pts[0]),
    texto: e.texto.replace(/\\P/g, ' ').replace(/\\[A-Za-z][^;\\]*;/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
  })).filter(t => t.texto);

  const cerradas = entidades.filter(e => (e.tipo === 'LWPOLYLINE' || e.tipo === 'POLYLINE') && e.pts.length >= 3).map(e => {
    let pts = e.pts.map(aM);
    if (dist(pts[0], pts[pts.length - 1]) < 0.02) pts = pts.slice(0, -1);
    return { capa: e.capa, pts, cerrada: (e.flags & 1) === 1 || dist(e.pts[0], e.pts[e.pts.length - 1]) * escala < 0.02 };
  });
  let candidatas = cerradas.filter(c => c.cerrada && c.pts.length >= 3).map(c => ({ ...c, area: Math.abs(areaConSigno(c.pts)) }))
    .filter(c => c.area >= 0.8 && c.area <= 400 && c.area / perimetro(c.pts) >= 0.2);
  const deEstancias = candidatas.filter(c => ESTANCIA_LAYER.test(c.capa));
  if (deEstancias.length) candidatas = deEstancias;
  // Fuera el contorno general (contiene a otras) y las repetidas.
  const centro = (pts) => [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
  candidatas = candidatas.filter((c, i) => candidatas.filter((o, k) => k !== i && o.area < c.area && dentroPoligono(centro(o.pts), c.pts)).length < 2);
  candidatas = candidatas.filter((c, i) => !candidatas.some((o, k) => k < i && Math.abs(o.area - c.area) < 0.05 && dist(centro(o.pts), centro(c.pts)) < 0.1));

  let poligonos = candidatas.map(c => c.pts);
  if (!poligonos.length) {
    // Solo líneas: recintos cerrados por los muros dibujados.
    const segs = entidades.flatMap(e => {
      if (e.tipo === 'LINE' && e.pts.length >= 2) return [[aM(e.pts[0]), aM(e.pts[1])]];
      if (e.tipo === 'LWPOLYLINE' || e.tipo === 'POLYLINE') {
        const p = e.pts.map(aM);
        return p.slice(0, (e.flags & 1) ? p.length : p.length - 1).map((a, i) => [a, p[(i + 1) % p.length]]);
      }
      return [];
    });
    const xs = segs.flat().map(p => p[0]), ys = segs.flat().map(p => p[1]);
    const g = crearRejilla(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 0.04);
    segs.forEach(([a, b]) => marcarLinea(g, a, b, BARRERA));
    poligonos = recintos(g, val => val !== BARRERA, { minArea: 1, minFino: 0.3 });
    if (poligonos.length) avisos.push('El DXF no tiene polilíneas cerradas: las estancias salen de los recintos que forman las líneas (medidas a ±4 cm).');
  }
  if (!poligonos.length) throw errorEscaneo('No se encontró ninguna estancia cerrada en el DXF. Exporta el plano con las estancias como polilíneas cerradas.');

  const salas = poligonos.map(points => {
    const t = textos.find(x => dentroPoligono(x.p, points) && /[a-záéíóúñ]{3}/i.test(x.texto) && !/^\s*[\d.,]+\s*m/i.test(x.texto));
    const name = t ? t.texto.replace(/\s*[\d.,]+\s*m(²|2)(?![a-z]).*$/i, '').slice(0, 60) : 'Estancia';
    return { name, points };
  });
  const ang = anguloDominante(salas.flatMap(s => s.points.map((p, i) => [p, s.points[(i + 1) % s.points.length]])));
  return {
    plan: construirPlan({
      salas: salas.map(s => ({ ...s, points: s.points.map(p => girar(p, ang)) })),
      notas: ['Planta tomada de un plano DXF del escaneo: las medidas son reales y están fijas.']
    }),
    avisos
  };
}

// --- Lista de medidas (CSV / TXT) ---

function leerLista(texto) {
  const filas = [];
  texto.split(/\r?\n/).forEach(linea => {
    const sep = linea.includes(';') ? ';' : linea.includes('\t') ? '\t' : ',';
    const celdas = linea.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    const nombre = celdas.find(c => c && !Number.isFinite(num(c)));
    const nums = celdas.map(c => (/^-?\d+([.,]\d+)?(\s*(m|cm))?$/i.test(c) ? num(c) : NaN)).filter(Number.isFinite);
    if (nums.length < 2) return;
    const factor = Math.max(...nums) > 50 ? 0.01 : 1;
    filas.push({ id: nuevoId('med'), estancia: (nombre || `Estancia ${filas.length + 1}`).slice(0, 60), largo: redondear(nums[0] * factor), ancho: redondear(nums[1] * factor), alto: nums[2] ? redondear(nums[2] * factor) : '' });
  });
  const lista = filas.length ? filas : leerMediciones(texto);
  if (!lista.length) throw errorEscaneo('No se encontraron medidas. Formato: "Estancia;largo;ancho;alto" por línea, o "Salón: 5 x 4 x 2,5 m".');
  const plan = croquisDesdeMediciones(lista);
  return { plan, mediciones: lista, avisos: ['La lista solo trae medidas: las estancias se colocan en fila para que las ordenes en el editor.'] };
}

// --- Entrada ---

/** Filas de medición del croquis a partir del plan (largo = este-oeste, ancho = norte-sur). */
export function medicionesDesdePlan(plan) {
  return (plan?.rooms || []).map(r => ({
    id: nuevoId('med'),
    estancia: r.name,
    largo: redondear(r.width),
    ancho: redondear(r.height),
    alto: r.alto ? redondear(r.alto) : '',
    superficie: redondear(Math.abs(areaConSigno(r.points))),
    perimetro: redondear(perimetro(r.points))
  }));
}

/** Líneas de medición para las anotaciones del presupuesto (mismo formato que "Añadir medición"). */
export function textoMedicionesEscaneo(plan, nombreArchivo = '') {
  const lineas = (plan?.rooms || []).map(r => {
    const area = Math.abs(areaConSigno(r.points)), per = perimetro(r.points);
    const dims = [r.width, r.height, r.alto].filter(v => v > 0).map(v => fmt(redondear(v)));
    const extras = [`superficie ${fmt(redondear(area))} m²`, `perímetro ${fmt(redondear(per))} m`];
    if (r.alto) extras.push(`paredes ${fmt(redondear(per * r.alto))} m²`);
    if (r.points.length !== 4 || Math.abs(area - r.width * r.height) > 0.05) extras.push('planta irregular: largo x ancho son las medidas máximas');
    return `- ${r.name}: ${dims.join(' x ')} m (${extras.join(', ')})`;
  });
  return lineas.length ? [`Mediciones del escaneo LiDAR${nombreArchivo ? ` (${nombreArchivo})` : ''}:`, ...lineas].join('\n') : '';
}

function resumir(resultado) {
  const rooms = resultado.plan?.rooms || [];
  const altos = rooms.map(r => r.alto).filter(Boolean);
  return {
    ...resultado,
    resumen: {
      estancias: rooms.length,
      superficie: redondear(rooms.reduce((t, r) => t + Math.abs(areaConSigno(r.points)), 0)),
      huecos: resultado.plan?.openings?.length || 0,
      alto: altos.length ? redondear(Math.max(...altos)) : null
    }
  };
}

/** Interpreta el texto de un escaneo según su extensión (lo usan el navegador y las pruebas). */
export function interpretarEscaneo(nombreArchivo, texto) {
  const ext = String(nombreArchivo).toLowerCase().split('.').pop();
  let r;
  if (ext === 'json') {
    let datos;
    try { datos = JSON.parse(texto); } catch { throw errorEscaneo('El JSON no se puede leer (¿está incompleto?).'); }
    if (datos && (Array.isArray(datos.walls) || Array.isArray(datos.floors) || (Array.isArray(datos.rooms) && datos.rooms.some(x => Array.isArray(x?.walls))))) {
      r = { formato: 'roomplan', ...leerRoomPlan(datos) };
    } else if (Array.isArray(datos?.rooms) || Array.isArray(datos?.plan?.rooms)) {
      r = { formato: 'croquis', plan: normalizarCroquis(datos), avisos: [] };
    } else {
      throw errorEscaneo('Este JSON no es de RoomPlan (faltan "walls" o "floors"). Exporta el escaneo en formato RoomPlan JSON.');
    }
  } else if (ext === 'obj') {
    r = { formato: 'obj', ...leerObj(texto) };
  } else if (ext === 'dxf') {
    r = { formato: 'dxf', ...leerDxf(texto) };
  } else if (ext === 'csv' || ext === 'txt') {
    r = { formato: 'lista', ...leerLista(texto) };
  } else {
    throw errorEscaneo('Formato no admitido. Usa JSON (RoomPlan), OBJ, DXF, CSV o una imagen del plano.');
  }
  if (!r.plan?.rooms?.length) throw errorEscaneo('El escaneo no tiene ninguna estancia.');
  return resumir({ nombreArchivo, mediciones: r.mediciones || medicionesDesdePlan(r.plan), ...r, avisos: r.avisos || [] });
}

/** Lee el archivo subido. Las imágenes del plano no se miden: se devuelven para la IA del croquis. */
export async function leerEscaneoLidar(file) {
  if (!file) throw errorEscaneo('No se ha elegido ningún archivo.');
  if (file.size > MAX_MB_ESCANEO * 1024 * 1024) throw errorEscaneo(`El archivo pesa más de ${MAX_MB_ESCANEO} MB. Exporta el escaneo con menos detalle o en JSON/DXF.`);
  const ext = file.name.toLowerCase().split('.').pop();
  // Por extensión: el tipo MIME del DXF es "image/vnd.dxf".
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return { formato: 'imagen', nombreArchivo: file.name, imagen: file, plan: null, mediciones: [], avisos: ['La imagen no trae medidas legibles por la app: la IA dibuja el croquis copiando las cotas del plano.'], resumen: null };
  }
  if (ext === 'usdz' || ext === 'usd' || ext === 'usdc') {
    throw errorEscaneo('USDZ es el modelo 3D de Apple y no trae el plano en un formato legible. Exporta el escaneo en JSON (RoomPlan), DXF u OBJ desde la app.');
  }
  if (ext === 'pdf') {
    throw errorEscaneo('Del PDF no se pueden leer las medidas. Exporta el plano como DXF, o como imagen (PNG/JPG) para que la IA lo copie.');
  }
  return interpretarEscaneo(file.name, await file.text());
}
