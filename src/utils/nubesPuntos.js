/**
 * ObraMaster - Lectores sin dependencias para el visor 3D de escaneos (navegador y pruebas de Node).
 *
 * - LAS 1.0-1.4 sin comprimir (formatos de punto 0-10): posiciones, color RGB o intensidad.
 * - Nubes de texto XYZ / PTS / CSV / TXT: "x y z [r g b]" o "x y z intensidad r g b".
 * - DXF en 3D: LINE, LWPOLYLINE, POLYLINE (también malla «polyface»), 3DFACE, CIRCLE y ARC.
 *
 * Todo se devuelve centrado en el origen (las coordenadas UTM no caben en float32) y con Z hacia arriba.
 * Resultado: { puntos?: { posiciones, colores, total, mostrados }, lineas?: Float32Array, triangulos?: Float32Array,
 *              origen: [x, y, z], escala, avisos }
 */

export const MAX_PUNTOS_VISOR = 3_000_000;

function errorVisor(mensaje) {
  const e = new Error(mensaje);
  e.escaneo = true;
  return e;
}

/** Centra un array plano [x,y,z,...] (Float64 o números) y lo pasa a Float32. */
function centrar(valores, n) {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    for (let e = 0; e < 3; e++) {
      const v = valores[i * 3 + e];
      if (v < min[e]) min[e] = v;
      if (v > max[e]) max[e] = v;
    }
  }
  const origen = min.map((m, e) => (m + max[e]) / 2);
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let e = 0; e < 3; e++) out[i * 3 + e] = valores[i * 3 + e] - origen[e];
  return { posiciones: out, origen };
}

// --- LAS ---

// Desplazamiento del RGB dentro de cada registro, por formato de punto.
const RGB_LAS = { 2: 20, 3: 28, 5: 28, 7: 30, 8: 30, 10: 30 };

export function leerLas(buffer, { maxPuntos = MAX_PUNTOS_VISOR } = {}) {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 227 || String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'LASF') {
    throw errorVisor('El archivo no es un LAS válido (falta la firma «LASF»).');
  }
  const menor = dv.getUint8(25);
  const offsetPuntos = dv.getUint32(96, true);
  const formatoBruto = dv.getUint8(104);
  if (formatoBruto & 0xc0) {
    throw errorVisor('Es un LAS comprimido (LAZ). Descomprímelo a LAS o expórtalo en PLY desde la app o con CloudCompare (gratis).');
  }
  const formato = formatoBruto & 0x3f;
  const largo = dv.getUint16(105, true);
  let total = dv.getUint32(107, true);
  if (menor >= 4 && buffer.byteLength >= 255) {
    const n64 = Number(dv.getBigUint64(247, true));
    if (n64 > 0) total = n64;
  }
  const escala = [dv.getFloat64(131, true), dv.getFloat64(139, true), dv.getFloat64(147, true)];
  const desplaz = [dv.getFloat64(155, true), dv.getFloat64(163, true), dv.getFloat64(171, true)];
  const caben = Math.floor((buffer.byteLength - offsetPuntos) / largo);
  if (!(largo >= 20) || caben <= 0) throw errorVisor('El LAS no trae puntos.');
  total = Math.min(total || caben, caben);

  const salto = Math.max(1, Math.ceil(total / maxPuntos));
  const n = Math.ceil(total / salto);
  const xyz = new Float64Array(n * 3);
  const rgbOff = RGB_LAS[formato];
  const rgb = rgbOff !== undefined && rgbOff + 6 <= largo ? new Uint16Array(n * 3) : null;
  const intensidad = new Uint16Array(n);
  let maxColor = 0;
  for (let i = 0, k = 0; i < total && k < n; i += salto, k++) {
    const o = offsetPuntos + i * largo;
    xyz[k * 3] = dv.getInt32(o, true) * escala[0] + desplaz[0];
    xyz[k * 3 + 1] = dv.getInt32(o + 4, true) * escala[1] + desplaz[1];
    xyz[k * 3 + 2] = dv.getInt32(o + 8, true) * escala[2] + desplaz[2];
    intensidad[k] = dv.getUint16(o + 12, true);
    if (rgb) {
      for (let c = 0; c < 3; c++) {
        const v = dv.getUint16(o + rgbOff + c * 2, true);
        rgb[k * 3 + c] = v;
        if (v > maxColor) maxColor = v;
      }
    }
  }
  const { posiciones, origen } = centrar(xyz, n);
  let colores = null;
  if (rgb && maxColor > 0) {
    const div = maxColor > 255 ? 65535 : 255;
    colores = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) colores[i] = rgb[i] / div;
  } else {
    let maxI = 0;
    for (let i = 0; i < n; i++) if (intensidad[i] > maxI) maxI = intensidad[i];
    if (maxI > 0) {
      colores = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const g = 0.15 + 0.85 * Math.sqrt(intensidad[i] / maxI); colores.fill(g, i * 3, i * 3 + 3); }
    }
  }
  const avisos = salto > 1 ? [`Se muestran ${n.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')} puntos para que el navegador vaya fluido.`] : [];
  return { puntos: { posiciones, colores, total, mostrados: n }, origen, escala: 1, avisos };
}

// --- XYZ / PTS / CSV / TXT ---

const SEP_TEXTO = /[\s,;]+/;

/** ¿Las primeras líneas parecen una nube de puntos (3 números o más por línea)? */
export function pareceNubeTexto(texto) {
  const lineas = texto.slice(0, 20000).split(/\r?\n/).filter(l => l.trim()).slice(0, 30);
  const buenas = lineas.filter(l => {
    const c = l.trim().split(SEP_TEXTO);
    return c.length >= 3 && c.slice(0, 3).every(v => v !== '' && Number.isFinite(Number(v)));
  });
  return lineas.length > 0 && buenas.length >= Math.max(3, lineas.length * 0.6);
}

export function leerTextoPuntos(texto, { maxPuntos = MAX_PUNTOS_VISOR } = {}) {
  const lineas = texto.split(/\r?\n/);
  const xyz = [];
  const rgb = [];
  let conColor = true;
  for (const l of lineas) {
    const t = l.trim();
    if (!t || t[0] === '#' || t[0] === '/') continue;
    const c = t.split(SEP_TEXTO).map(Number);
    if (c.length < 3 || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || !Number.isFinite(c[2])) continue;
    xyz.push(c[0], c[1], c[2]);
    // PTS: x y z intensidad r g b; XYZ: x y z r g b.
    const col = c.length >= 7 ? c.slice(4, 7) : c.length >= 6 ? c.slice(3, 6) : null;
    if (col && col.every(Number.isFinite)) rgb.push(...col); else conColor = false;
  }
  const total = xyz.length / 3;
  if (total < 3) throw errorVisor('No se encontraron puntos (se esperan líneas «x y z» con números).');
  const salto = Math.max(1, Math.ceil(total / maxPuntos));
  const n = Math.ceil(total / salto);
  const sel = new Float64Array(n * 3);
  const colSel = conColor && rgb.length === xyz.length ? new Float32Array(n * 3) : null;
  const maxC = colSel ? Math.max(...rgb.slice(0, 3000)) : 0;
  const div = maxC > 255 ? 65535 : maxC > 1 ? 255 : 1;
  for (let i = 0, k = 0; k < n; i += salto, k++) {
    for (let e = 0; e < 3; e++) {
      sel[k * 3 + e] = xyz[i * 3 + e];
      if (colSel) colSel[k * 3 + e] = rgb[i * 3 + e] / div;
    }
  }
  const { posiciones, origen } = centrar(sel, n);
  const avisos = salto > 1 ? [`Se muestran ${n.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')} puntos.`] : [];
  return { puntos: { posiciones, colores: colSel, total, mostrados: n }, origen, escala: 1, avisos };
}

// --- DXF en 3D ---

const ESCALA_DXF = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 };

export function leerDxf3D(texto) {
  const l = texto.split(/\r?\n/);
  const pares = [];
  for (let i = 0; i + 1 < l.length; i += 2) pares.push([parseInt(l[i], 10), l[i + 1].trim()]);
  let unidades = 0, seccion = '', bloques = 0;
  const ents = [];
  let actual = null, poli = null;
  for (let k = 0; k < pares.length; k++) {
    const [c, val] = pares[k];
    if (c === 9 && val === '$INSUNITS') { unidades = parseInt(pares[k + 1]?.[1], 10) || 0; continue; }
    if (c === 0) {
      if (val === 'SECTION') { seccion = pares[k + 1]?.[1] || ''; continue; }
      if (val === 'ENDSEC') { seccion = ''; continue; }
      if (seccion === 'ENTITIES' && val === 'INSERT') bloques++;
      if (seccion !== 'ENTITIES') continue;
      if (val === 'VERTEX' && poli) { actual = { tipo: 'VERTEX', v: {}, flags: 0 }; poli.vertices.push(actual); continue; }
      if (val === 'SEQEND' && poli) { poli = null; actual = null; continue; }
      actual = { tipo: val, v: {}, flags: 0, vertices: [], lw: [] };
      if (val === 'POLYLINE') poli = actual;
      ents.push(actual);
      continue;
    }
    if (!actual || seccion !== 'ENTITIES') continue;
    if (c === 70) actual.flags = parseInt(val, 10) || 0;
    if (actual.tipo === 'LWPOLYLINE') {
      if (c === 10) actual.lw.push([Number(val), 0]);
      else if (c === 20 && actual.lw.length) actual.lw[actual.lw.length - 1][1] = Number(val);
      else if (c === 38) actual.v[38] = Number(val);
    } else {
      actual.v[c] = Number(val);
    }
  }

  const lin = [], tri = [];
  const P = (v, a = 10) => [v[a] || 0, v[a + 10] || 0, v[a + 20] || 0];
  const seg = (a, b) => lin.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  for (const e of ents) {
    const v = e.v;
    if (e.tipo === 'LINE') seg(P(v, 10), P(v, 11));
    else if (e.tipo === 'LWPOLYLINE') {
      const z = v[38] || 0;
      const p = e.lw.map(([x, y]) => [x, y, z]);
      for (let i = 0; i + 1 < p.length; i++) seg(p[i], p[i + 1]);
      if ((e.flags & 1) && p.length > 2) seg(p[p.length - 1], p[0]);
    } else if (e.tipo === '3DFACE') {
      const q = [P(v, 10), P(v, 11), P(v, 12), P(v, 13)];
      tri.push(...q[0], ...q[1], ...q[2]);
      if (q[3].some((x, i) => x !== q[2][i])) tri.push(...q[0], ...q[2], ...q[3]);
    } else if (e.tipo === 'POLYLINE') {
      if (e.flags & 64) {
        // Malla «polyface»: vértices (bit 64 + 128) y caras (solo 128) con índices 71-74 desde 1.
        const pts = e.vertices.filter(x => x.v[71] === undefined).map(x => P(x.v));
        for (const f of e.vertices.filter(x => x.v[71] !== undefined)) {
          const idx = [71, 72, 73, 74].map(c => Math.abs(f.v[c] || 0)).filter(Boolean).map(i => pts[i - 1]).filter(Boolean);
          for (let i = 1; i + 1 < idx.length; i++) tri.push(...idx[0], ...idx[i], ...idx[i + 1]);
        }
      } else {
        const p = e.vertices.map(x => P(x.v));
        for (let i = 0; i + 1 < p.length; i++) seg(p[i], p[i + 1]);
        if ((e.flags & 1) && p.length > 2) seg(p[p.length - 1], p[0]);
      }
    } else if (e.tipo === 'CIRCLE' || e.tipo === 'ARC') {
      const [cx, cy, cz] = P(v, 10), r = v[40] || 0;
      if (!r) continue;
      let a0 = e.tipo === 'ARC' ? (v[50] || 0) : 0, a1 = e.tipo === 'ARC' ? (v[51] || 0) : 360;
      if (a1 <= a0) a1 += 360;
      const pasos = Math.max(8, Math.ceil((a1 - a0) / 10));
      for (let i = 0; i < pasos; i++) {
        const t0 = (a0 + (a1 - a0) * i / pasos) * Math.PI / 180, t1 = (a0 + (a1 - a0) * (i + 1) / pasos) * Math.PI / 180;
        seg([cx + r * Math.cos(t0), cy + r * Math.sin(t0), cz], [cx + r * Math.cos(t1), cy + r * Math.sin(t1), cz]);
      }
    }
  }
  if (!lin.length && !tri.length) {
    throw errorVisor(bloques
      ? 'El DXF tiene el dibujo dentro de bloques (INSERT). Expórtalo «descompuesto» para verlo.'
      : 'El DXF no tiene líneas, polilíneas ni caras 3D que dibujar.');
  }
  const todos = lin.concat(tri);
  const nTodos = todos.length / 3;
  let ext = 0;
  for (let e = 0; e < 3; e++) {
    let a = Infinity, b = -Infinity;
    for (let i = e; i < todos.length; i += 3) { if (todos[i] < a) a = todos[i]; if (todos[i] > b) b = todos[i]; }
    ext = Math.max(ext, b - a);
  }
  const avisos = [];
  let escala = ESCALA_DXF[unidades];
  if (!escala) {
    escala = ext > 2000 ? 0.001 : ext > 200 ? 0.01 : 1;
    avisos.push(`El DXF no indica unidades: se ha leído en ${escala === 1 ? 'metros' : escala === 0.01 ? 'centímetros' : 'milímetros'}.`);
  }
  for (let i = 0; i < todos.length; i++) todos[i] *= escala;
  const { posiciones, origen } = centrar(todos, nTodos);
  return {
    lineas: lin.length ? posiciones.slice(0, lin.length) : null,
    triangulos: tri.length ? posiciones.slice(lin.length) : null,
    origen,
    escala,
    avisos
  };
}
