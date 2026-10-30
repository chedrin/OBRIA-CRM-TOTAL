import test from "node:test";
import assert from "node:assert/strict";
import { interpretarEscaneo, textoMedicionesEscaneo } from "../src/utils/escaneoLidar.js";
import { leerMediciones } from "../src/utils/croquisPlano.js";

const cerca = (a, b, tol = 0.03) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);
const area = (r) => Math.abs(r.points.reduce((t, p, i) => { const q = r.points[(i + 1) % r.points.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);

// Superficie de RoomPlan: eje x local en planta con ángulo `ang`, eje y local vertical o en planta (suelos).
function superficie({ cx, cz, ang, ancho, alto, cy = 0, suelo = false, extra = {} }) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const c0 = [c, 0, s, 0];
  const c1 = suelo ? [-s, 0, c, 0] : [0, 1, 0, 0];
  const c2 = suelo ? [0, 1, 0, 0] : [-s, 0, c, 0];
  return { identifier: Math.random().toString(36), category: extra.category || { wall: {} }, dimensions: [ancho, alto, 0], transform: [...c0, ...c1, ...c2, cx, cy, cz, 1], polygonCorners: [], ...extra };
}

test("RoomPlan: estancia girada de 4 x 3 m con puerta y ventana, recta y con medidas fijas", () => {
  const ang = Math.PI / 6;
  const u = [Math.cos(ang), Math.sin(ang)], n = [-Math.sin(ang), Math.cos(ang)];
  const p = (a, b) => [a * u[0] + b * n[0], a * u[1] + b * n[1]];
  const muros = [
    { c: p(0, -1.5), ang, ancho: 4 }, { c: p(2, 0), ang: ang + Math.PI / 2, ancho: 3 },
    { c: p(0, 1.5), ang, ancho: 4 }, { c: p(-2, 0), ang: ang + Math.PI / 2, ancho: 3 }
  ].map(m => superficie({ cx: m.c[0], cz: m.c[1], ang: m.ang, ancho: m.ancho, alto: 2.5, cy: 1.25 }));
  const datos = {
    walls: muros,
    floors: [superficie({ cx: 0, cz: 0, ang, ancho: 4, alto: 3, suelo: true, extra: { category: { floor: {} }, polygonCorners: [[-2, -1.5, 0], [2, -1.5, 0], [2, 1.5, 0], [-2, 1.5, 0]] } })],
    doors: [superficie({ cx: p(1, -1.5)[0], cz: p(1, -1.5)[1], ang, ancho: 0.82, alto: 2.05, extra: { category: { door: { isOpen: true } } } })],
    windows: [superficie({ cx: p(2, 0.5)[0], cz: p(2, 0.5)[1], ang: ang + Math.PI / 2, ancho: 1.2, alto: 1.2, extra: { category: { window: {} } } })],
    openings: [],
    objects: [],
    sections: [{ label: { bedroom: {} }, center: [0, 0, 0], story: 0 }]
  };
  const r = interpretarEscaneo("habitacion.json", JSON.stringify(datos));
  assert.equal(r.formato, "roomplan");
  assert.equal(r.plan.rooms.length, 1);
  const room = r.plan.rooms[0];
  assert.equal(room.name, "Dormitorio");
  cerca(area(room), 12, 0.05);
  // Girada para que los muros queden rectos: caja 4 x 3 (o 3 x 4).
  cerca(Math.max(room.width, room.height), 4);
  cerca(Math.min(room.width, room.height), 3);
  assert.equal(room.alto, 2.5);
  assert.deepEqual(room.fijas, [0, 1, 2, 3]);
  assert.equal(r.plan.openings.length, 2);
  assert.deepEqual(r.plan.openings.map(o => o.type).sort(), ["door", "window"]);
  assert.equal(r.resumen.estancias, 1);
  cerca(r.resumen.superficie, 12, 0.05);
});

test("RoomPlan sin suelos: el contorno sale de encadenar los muros", () => {
  const muros = [
    superficie({ cx: 2.5, cz: 0, ang: 0, ancho: 5, alto: 2.6 }),
    superficie({ cx: 5, cz: 2, ang: Math.PI / 2, ancho: 4, alto: 2.6 }),
    superficie({ cx: 2.5, cz: 4, ang: Math.PI, ancho: 5, alto: 2.6 }),
    superficie({ cx: 0, cz: 2, ang: -Math.PI / 2, ancho: 4, alto: 2.6 })
  ];
  const r = interpretarEscaneo("salon.json", JSON.stringify({ walls: muros, doors: [], windows: [], openings: [], floors: [] }));
  cerca(area(r.plan.rooms[0]), 20, 0.05);
  assert.equal(r.mediciones.length, 1);
});

test("OBJ: dos estancias separadas por un tabique con puerta (el dintel las separa)", () => {
  const v = [], f = [];
  const quad = (a, b, c, d) => { const k = v.length; v.push(a, b, c, d); f.push([k + 1, k + 2, k + 3, k + 4]); };
  const H = 2.5;
  // Suelo y techo de 7 x 4 (dos estancias de 4 x 4 y 3 x 4).
  for (const y of [0, H]) quad([0, y, 0], [7, y, 0], [7, y, 4], [0, y, 4]);
  // Muros exteriores.
  quad([0, 0, 0], [7, 0, 0], [7, H, 0], [0, H, 0]);
  quad([7, 0, 0], [7, 0, 4], [7, H, 4], [7, H, 0]);
  quad([0, 0, 4], [7, 0, 4], [7, H, 4], [0, H, 4]);
  quad([0, 0, 0], [0, 0, 4], [0, H, 4], [0, H, 0]);
  // Tabique en x = 4 con puerta de 0,8 m (de z = 1,6 a 2,4) y dintel desde 2,1 m.
  quad([4, 0, 0], [4, 0, 1.6], [4, H, 1.6], [4, H, 0]);
  quad([4, 0, 2.4], [4, 0, 4], [4, H, 4], [4, H, 2.4]);
  quad([4, 2.1, 1.6], [4, 2.1, 2.4], [4, H, 2.4], [4, H, 1.6]);
  const texto = [...v.map(p => `v ${p.join(" ")}`), ...f.map(c => `f ${c.join(" ")}`)].join("\n");
  const r = interpretarEscaneo("piso.obj", texto);
  assert.equal(r.formato, "obj");
  assert.equal(r.plan.rooms.length, 2);
  const areas = r.plan.rooms.map(area).sort((a, b) => b - a);
  cerca(areas[0], 16, 0.6);
  cerca(areas[1], 12, 0.6);
  r.plan.rooms.forEach(room => cerca(room.alto, 2.5, 0.05));
});

const dxf = (entidades, unidades = 6) => ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", String(unidades), "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES", ...entidades, "0", "ENDSEC", "0", "EOF"].join("\n");
const lw = (pts, capa = "0") => ["0", "LWPOLYLINE", "8", capa, "90", String(pts.length), "70", "1", ...pts.flatMap(([x, y]) => ["10", String(x), "20", String(y)])];
const txt = (x, y, t) => ["0", "TEXT", "8", "TEXTOS", "10", String(x), "20", String(y), "40", "0.2", "1", t];
const linea = (a, b) => ["0", "LINE", "8", "MUROS", "10", String(a[0]), "20", String(a[1]), "11", String(b[0]), "21", String(b[1])];

test("DXF en mm: polilíneas cerradas con su nombre, sin el contorno general", () => {
  const r = interpretarEscaneo("plano.dxf", dxf([
    ...lw([[0, 0], [8000, 0], [8000, 5000], [0, 5000]]),
    ...lw([[0, 0], [5000, 0], [5000, 5000], [0, 5000]], "ROOMS"),
    ...lw([[5000, 0], [8000, 0], [8000, 5000], [5000, 2500], [5000, 0]], "ROOMS"),
    ...txt(2000, 2500, "Salón 25 m²"),
    ...txt(6500, 1000, "Cocina")
  ], 4));
  assert.equal(r.formato, "dxf");
  assert.deepEqual(r.plan.rooms.map(x => x.name).sort(), ["Cocina", "Salón"]);
  const salon = r.plan.rooms.find(x => x.name === "Salón");
  cerca(area(salon), 25, 0.01);
  cerca(salon.width, 5, 0.01);
});

test("DXF solo con líneas: recintos cerrados", () => {
  const r = interpretarEscaneo("lineas.dxf", dxf([
    ...linea([0, 0], [6, 0]), ...linea([6, 0], [6, 4]), ...linea([6, 4], [0, 4]), ...linea([0, 4], [0, 0]),
    ...linea([3, 0], [3, 4])
  ]));
  assert.equal(r.plan.rooms.length, 2);
  r.plan.rooms.forEach(room => cerca(area(room), 12, 0.5));
});

test("CSV y texto: lista de medidas, también en cm", () => {
  const r = interpretarEscaneo("medidas.csv", "Estancia;Largo;Ancho;Alto\nSalón;5,2;4;2,5\nBaño;250;180;250\n");
  assert.equal(r.mediciones.length, 2);
  assert.equal(r.mediciones[1].largo, 2.5);
  assert.equal(r.plan.rooms.length, 2);
});

test("Las mediciones del escaneo se pueden volver a leer desde las notas del presupuesto", () => {
  const r = interpretarEscaneo("medidas.csv", "Salón;5;4;2,5\n");
  const textoNotas = textoMedicionesEscaneo(r.plan, "medidas.csv");
  assert.match(textoNotas, /superficie 20 m²/);
  const filas = leerMediciones(textoNotas);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].estancia, "Salón");
  assert.equal(filas[0].largo, 5);
});

test("Formatos no válidos dan un error claro", () => {
  assert.throws(() => interpretarEscaneo("x.json", "{\"hola\":1}"), /RoomPlan/);
  assert.throws(() => interpretarEscaneo("x.obj", "# vacío"), /malla/);
  assert.throws(() => interpretarEscaneo("x.ply", ""), /no admitido/);
});
