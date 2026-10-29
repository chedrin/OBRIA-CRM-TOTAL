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
  resumenSuperficies
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

test("puerta: hueco en el muro, hoja de 90° y arco hacia dentro", () => {
  const room = { id: "r", x: 0, y: 0, width: 4, height: 3 };
  const f = formasHueco(room, { type: "door", wall: "north", positionRatio: 0.5, widthMeters: 0.8, swing: "in", hinge: "start" });
  assert.deepEqual(f.centro, [2, 0]);
  const hoja = f.lineas[2];
  assert.equal(hoja[0][0], 1.6);
  assert.ok(hoja[1][1] > 0.8, "la hoja abre hacia dentro (sur)");
  const arco = f.discontinuas[0];
  assert.ok(Math.abs(arco[arco.length - 1][0] - 2.4) < 1e-3, "el arco termina en la otra jamba");
  const fuera = formasHueco(room, { type: "door", wall: "north", positionRatio: 0.5, widthMeters: 0.8, swing: "out" });
  assert.ok(fuera.lineas[2][1][1] < 0, "abre hacia fuera (norte)");
});

test("ventana: doble línea técnica en un muro vertical", () => {
  const f = formasHueco({ x: 0, y: 0, width: 4, height: 3 }, { type: "window", wall: "east", positionRatio: 0.5, widthMeters: 1.2 });
  assert.equal(f.lineas.length, 6);
  assert.equal(f.horizontal, false);
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
  assert.equal(m.wall, "east");
  assert.equal(m.ratio, 0.5);
});

test("prompt: mediciones como fuente de verdad y JSON estricto", () => {
  assert.match(CROQUIS_SYSTEM_PROMPT, /fuente de verdad absoluta/);
  assert.match(CROQUIS_SYSTEM_PROMPT, /SOLO un objeto JSON/);
  const p = buildCroquisUserPrompt({ mediciones: "- Salón: 5 x 4", partidas: ["Alicatado baño"], numFotos: 2 });
  assert.match(p, /Salón: 5 x 4/);
  assert.match(p, /Alicatado baño/);
  assert.match(p, /2 foto/);
});
