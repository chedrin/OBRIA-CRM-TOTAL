import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarCroquis,
  formasHueco,
  formasCota,
  leerMediciones,
  textoMediciones,
  croquisDesdeMediciones,
  muroMasCercano,
  resumenSuperficies,
  moverVertice,
  cambiarLargoLado,
  insertarVertice,
  quitarVertice,
  respetaFijas,
  murosParaVolumen,
  cotasEstancia,
  anguloInterior
} from "../src/utils/croquisPlano.js";
import { buildCroquisUserPrompt, CROQUIS_SYSTEM_PROMPT } from "./croquisPrompt.js";

test("normaliza la respuesta de la IA: números, superficies, huecos y coordenadas positivas", () => {
  const plan = normalizarCroquis({
    rooms: [
      { id: "room-1", name: "Salón", x: -1, y: 2, width: "5,2", height: 4.1, area: 99 },
      { id: "room-1", name: "Cocina", x: 4.2, y: 2, width: 3, height: 3 }
    ],
    openings: [
      { id: "op-1", type: "door", roomId: "room-1", wall: "north", positionRatio: 0, widthMeters: 0.82 },
      { id: "op-2", type: "laser", roomId: "fantasma", wall: "south" }
    ],
    labels: [{ text: "21.32 m²", x: 0, y: 0 }, { text: "Fachada", x: 1, y: 1 }]
  });
  assert.equal(plan.rooms.length, 2);
  assert.notEqual(plan.rooms[0].id, plan.rooms[1].id, "ids repetidos se renombran");
  assert.deepEqual([plan.rooms[0].x, plan.rooms[0].y], [0, 0]);
  assert.equal(plan.rooms[1].x, 5.2);
  assert.deepEqual(plan.rooms[0].points, [[0, 0], [5.2, 0], [5.2, 4.1], [0, 4.1]]);
  assert.deepEqual(plan.rooms[0].fijas, [0, 1, 2, 3], "las estancias medidas nacen con las medidas fijas");
  assert.equal(plan.openings[0].edge, 0, "muro norte = lado 0");
  assert.equal(plan.rooms[0].area, 21.32);
  assert.equal(plan.openings.length, 1, "el hueco de una estancia que no existe se descarta");
  assert.ok(plan.openings[0].positionRatio > 0.05, "el hueco cabe entero en el muro");
  assert.deepEqual(plan.labels.map(l => l.text), ["Fachada"], "las superficies sueltas las dibuja la app");
  assert.ok(plan.canvas.widthMeters >= 10.2);
});

test("acepta el plano envuelto en { plan } y un JSON vacío", () => {
  assert.equal(normalizarCroquis({ plan: { rooms: [{ width: 2, height: 2 }] } }).rooms.length, 1);
  assert.equal(normalizarCroquis(null).rooms.length, 0);
});

const rect = (x, y, w, h, extra = {}) => normalizarCroquis({ rooms: [{ id: "r", x, y, width: w, height: h, ...extra }] }).rooms[0];

test("croquis antiguos: el muro sur con ratio desde el oeste pasa a su lado", () => {
  const plan = normalizarCroquis({
    rooms: [{ id: "a", x: 0, y: 0, width: 4, height: 3 }],
    openings: [{ roomId: "a", wall: "south", positionRatio: 0.2, widthMeters: 0.8, hinge: "start" }]
  });
  assert.equal(plan.openings[0].edge, 2);
  assert.equal(plan.openings[0].positionRatio, 0.8, "el lado sur va de este a oeste");
  assert.equal(plan.openings[0].hinge, "end", "la bisagra sigue en el mismo sitio");
});

test("puerta: hueco en el muro, hoja de 90° y arco hacia dentro", () => {
  const room = rect(0, 0, 4, 3);
  const f = formasHueco(room, { type: "door", edge: 0, positionRatio: 0.5, widthMeters: 0.8, swing: "in", hinge: "start" });
  assert.deepEqual(f.centro, [2, 0]);
  const hoja = f.lineas[2];
  assert.equal(hoja[0][0], 1.6);
  assert.ok(hoja[1][1] > 0.8, "la hoja abre hacia dentro (sur)");
  const arco = f.discontinuas[0];
  assert.ok(Math.abs(arco[arco.length - 1][0] - 2.4) < 1e-3, "el arco termina en la otra jamba");
  const fuera = formasHueco(room, { type: "door", edge: 0, positionRatio: 0.5, widthMeters: 0.8, swing: "out" });
  assert.ok(fuera.lineas[2][1][1] < 0, "abre hacia fuera (norte)");
});

test("ventana: doble línea técnica en un muro vertical", () => {
  const f = formasHueco(rect(0, 0, 4, 3), { type: "window", edge: 1, positionRatio: 0.5, widthMeters: 1.2 });
  assert.equal(f.lineas.length, 6);
  assert.deepEqual(f.extremos, [[4, 0.9], [4, 2.1]]);
  assert.deepEqual(f.centro, [4, 1.5]);
});

test("cota con texto legible y longitud", () => {
  const c = formasCota(0, 0, 3.45, 0, 0.5);
  assert.equal(c.texto.valor, "3,45 m");
  assert.equal(c.texto.angulo, 0);
  assert.ok(c.linea[0][1] < 0, "desplazada hacia fuera (arriba)");
  const v = formasCota(0, 3, 0, 0, 0);
  assert.equal(v.texto.angulo, -90, "las verticales se leen de abajo arriba");
});

test("lee las mediciones del asistente de visita", () => {
  const filas = leerMediciones("- Salón: 5 x 4 x 2,30 m (superficie 20 m², perímetro 18 m)\nBaño 250x180 cm\nPintar todo\n- Cocina: 3,2 × 2,8 m");
  assert.deepEqual(filas.map(f => [f.estancia, f.largo, f.ancho, f.alto]), [
    ["Salón", 5, 4, 2.3],
    ["Baño", 2.5, 1.8, ""],
    ["Cocina", 3.2, 2.8, ""]
  ]);
  assert.match(textoMediciones(filas), /Salón: 5 m \(este-oeste\) x 4 m \(norte-sur\) = 20 m²/);
});

test("croquis sin IA: estancias contiguas con una puerta cada una", () => {
  const plan = croquisDesdeMediciones([{ estancia: "A", largo: 4, ancho: 3 }, { estancia: "B", largo: "3", ancho: "3" }, { estancia: "vacía" }]);
  assert.equal(plan.rooms.length, 2);
  assert.equal(plan.rooms[1].x, 4);
  assert.equal(plan.openings.length, 2);
  assert.equal(resumenSuperficies(plan).util, 21);
});

test("muro más cercano para soltar una puerta", () => {
  const plan = normalizarCroquis({ rooms: [{ id: "a", x: 0, y: 0, width: 4, height: 3 }] });
  const m = muroMasCercano(plan, 3.9, 1.5);
  assert.equal(m.edge, 1);
  assert.equal(m.ratio, 0.5);
});

test("romboide: superficie, ángulos y puerta en un lado inclinado", () => {
  const plan = normalizarCroquis({
    rooms: [{ id: "rb", name: "Dormitorio", points: [[0, 0], [4, 0], [5, 3], [1, 3]] }],
    openings: [{ roomId: "rb", edge: 1, positionRatio: 0.5, widthMeters: 0.8, type: "door" }]
  });
  const r = plan.rooms[0];
  assert.equal(r.area, 12);
  assert.equal(r.width, 5);
  assert.equal(anguloInterior(r, 0) + anguloInterior(r, 1), 180);
  const f = formasHueco(r, plan.openings[0]);
  assert.deepEqual(f.centro, [4.5, 1.5]);
  const hoja = f.lineas[2][1];
  assert.ok(hoja[0] < 4.5, "la puerta abre hacia dentro del romboide");
  assert.equal(cotasEstancia(r).length, 4, "un polígono lleva cota en cada lado");
});

test("medidas fijas: un vértice gira alrededor del vecino o no se mueve", () => {
  const libre = rect(0, 0, 4, 3, { fijas: [] });
  assert.deepEqual(moverVertice(libre, 2, 5, 3).points[2], [5, 3]);
  const unLado = { ...libre, fijas: [1] }; // lado 1: del punto 1 (4,0) al 2 (4,3), 3 m
  const movido = moverVertice(unLado, 2, 6, 3);
  assert.ok(Math.abs(Math.hypot(movido.points[2][0] - 4, movido.points[2][1]) - 3) < 1e-3, "mantiene los 3 m");
  assert.equal(moverVertice({ ...libre, fijas: [1, 2] }, 2, 6, 3), null);
  assert.equal(respetaFijas(rect(0, 0, 4, 3), cambiarLargoLado(rect(0, 0, 4, 3), 0, 5)), false);
});

test("cambiar la medida de un lado conserva el rectángulo y el romboide", () => {
  const r = cambiarLargoLado(rect(0, 0, 4, 3), 0, 5);
  assert.deepEqual(r.points, [[0, 0], [5, 0], [5, 3], [0, 3]]);
  const rb = normalizarCroquis({ rooms: [{ id: "x", points: [[0, 0], [4, 0], [5, 3], [1, 3]] }] }).rooms[0];
  const rb2 = cambiarLargoLado(rb, 0, 5);
  assert.deepEqual(rb2.points, [[0, 0], [5, 0], [6, 3], [1, 3]]);
  assert.equal(rb2.area, 15);
});

test("añadir y quitar vértices reordena huecos y medidas fijas", () => {
  const base = normalizarCroquis({
    rooms: [{ id: "a", x: 0, y: 0, width: 4, height: 3 }],
    openings: [{ id: "p", roomId: "a", wall: "east", positionRatio: 0.5 }, { id: "v", roomId: "a", wall: "north", positionRatio: 0.75, type: "window", widthMeters: 1 }]
  });
  const con = insertarVertice(base, "a", 0, [2, 0]);
  const room = con.rooms[0];
  assert.equal(room.points.length, 5);
  assert.deepEqual(room.fijas, [2, 3, 4], "el lado partido queda libre; los demás suben un puesto");
  assert.equal(con.openings.find(o => o.id === "p").edge, 2);
  const v = con.openings.find(o => o.id === "v");
  assert.equal(v.edge, 1, "la ventana estaba en la segunda mitad del lado");
  assert.equal(v.positionRatio, 0.5);
  const sin = quitarVertice(con, "a", 1);
  assert.equal(sin.rooms[0].points.length, 4);
  assert.equal(sin.openings.find(o => o.id === "p").edge, 1);
});

test("3D: los muros compartidos salen una vez con los huecos de las dos estancias", () => {
  const plan = normalizarCroquis({
    rooms: [{ id: "a", x: 0, y: 0, width: 3, height: 3, alto: 2.7 }, { id: "b", x: 3, y: 0, width: 3, height: 3 }],
    openings: [{ roomId: "b", wall: "west", positionRatio: 0.5, widthMeters: 0.8 }]
  });
  const muros = murosParaVolumen(plan);
  assert.equal(muros.length, 7);
  const compartido = muros.find(m => m.huecos.length === 1);
  assert.equal(compartido.alto, 2.7);
  assert.ok(Math.abs(compartido.huecos[0].desde - 1.1) < 1e-6);
});

test("prompt: mediciones como fuente de verdad y JSON estricto", () => {
  assert.match(CROQUIS_SYSTEM_PROMPT, /fuente de verdad absoluta/);
  assert.match(CROQUIS_SYSTEM_PROMPT, /SOLO un objeto JSON/);
  const p = buildCroquisUserPrompt({ mediciones: "- Salón: 5 x 4", partidas: ["Alicatado baño"], numFotos: 2 });
  assert.match(p, /Salón: 5 x 4/);
  assert.match(p, /Alicatado baño/);
  assert.match(p, /2 foto/);
});
