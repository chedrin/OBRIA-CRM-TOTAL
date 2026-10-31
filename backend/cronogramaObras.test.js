import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularFilaCronograma,
  escalaCronograma,
  rangoPreset,
  filaVisible,
  resumenCronograma,
  textoDesviacion,
  colorObra,
  COLORES_OBRA
} from "../src/utils/cronogramaObras.js";

const hoy = new Date(2026, 9, 31); // 31 oct 2026

test("obra terminada sin fecha de cierre se da por acabada en su fin previsto", () => {
  const f = calcularFilaCronograma({ id: "a", estado: "finalizada", progreso: 100, fechaInicio: "2026-07-01", fechaFinEstimada: "2026-08-28", fases: [] }, hoy);
  assert.equal(f.estado, "finalizada");
  assert.equal(f.desviacionDias, 0);
  assert.equal(f.finPrevisto.getDate(), 28);
});

test("obra terminada después de la entrega queda como terminada tarde", () => {
  const f = calcularFilaCronograma({ id: "a", estado: "finalizada", progreso: 100, fechaInicio: "2026-07-01", fechaFinEstimada: "2026-08-28", fechaFinReal: "2026-09-04" }, hoy);
  assert.equal(f.estado, "finalizada_tarde");
  assert.equal(f.desviacionDias, 7);
});

test("obra en curso pasada la entrega es retraso", () => {
  const f = calcularFilaCronograma({ id: "b", estado: "en_curso", progreso: 60, fechaInicio: "2026-09-01", fechaFinEstimada: "2026-10-20", fases: [{ dias: 30, progreso: 60 }] }, hoy);
  assert.equal(f.estado, "retraso");
  assert.ok(f.desviacionDias > 0);
});

test("obra que va por delante del plan sale adelantada", () => {
  const f = calcularFilaCronograma({ id: "c", estado: "en_curso", progreso: 80, fechaInicio: "2026-10-01", fechaFinEstimada: "2026-12-30", fases: [{ dias: 30, progreso: 80 }] }, hoy);
  assert.equal(f.estado, "adelanto");
  assert.ok(f.difAvance > 10);
  assert.ok(f.desviacionDias < 0);
});

test("obra presupuestada futura está por empezar y no cuenta en el resumen", () => {
  const f = calcularFilaCronograma({ id: "d", estado: "presupuestada", progreso: 0, fechaInicio: "2026-11-10", fechaFinEstimada: "2026-12-15" }, hoy);
  assert.equal(f.estado, "por_empezar");
  assert.equal(f.finPrevisto.getTime(), f.finPlan.getTime());
  assert.equal(resumenCronograma([f]).activas, 0);
});

test("escala con marcas 1 y 15 de cada mes y el último día al final", () => {
  const { meses, marcas, totalDias } = escalaCronograma(new Date(2026, 7, 1), new Date(2026, 10, 30));
  assert.deepEqual(meses.map(m => m.label), ["Agosto", "Septiembre", "Octubre", "Noviembre"]);
  assert.equal(totalDias, 122);
  assert.equal(marcas.length, 9);
  assert.deepEqual(marcas.slice(0, 3).map(m => m.dia), [1, 15, 1]);
  assert.equal(marcas.at(-1).dia, 30);
  assert.equal(marcas[0].izquierda, 0);
  const suma = meses.reduce((s, m) => s + m.ancho, 0);
  assert.ok(Math.abs(suma - 100) < 1e-9);
});

test("periodo 'todo' abarca todas las obras y se ajusta a meses completos", () => {
  const filas = [
    calcularFilaCronograma({ id: "a", estado: "finalizada", progreso: 100, fechaInicio: "2026-07-03", fechaFinEstimada: "2026-08-28" }, hoy),
    calcularFilaCronograma({ id: "d", estado: "presupuestada", progreso: 0, fechaInicio: "2026-11-10", fechaFinEstimada: "2026-12-15" }, hoy)
  ];
  const { desde, hasta } = rangoPreset("todo", filas, hoy);
  assert.equal(desde.getMonth(), 6);
  assert.equal(desde.getDate(), 1);
  assert.equal(hasta.getMonth(), 11);
  assert.equal(hasta.getDate(), 31);
  assert.equal(filaVisible(filas[0], new Date(2026, 9, 1), new Date(2026, 11, 31)), false);
  assert.equal(filaVisible(filas[1], new Date(2026, 9, 1), new Date(2026, 11, 31)), true);
});

test("textos y colores", () => {
  assert.equal(textoDesviacion(5), "+5 d");
  assert.equal(textoDesviacion(-3), "−3 d");
  assert.equal(textoDesviacion(0), "Al día");
  assert.equal(colorObra({}, 0), COLORES_OBRA[0]);
  assert.equal(colorObra({}, COLORES_OBRA.length), COLORES_OBRA[0]);
  assert.equal(colorObra({ color: "#123456" }, 3), "#123456");
});
