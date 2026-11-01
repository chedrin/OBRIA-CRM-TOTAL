import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cambiosObra,
  cambiosPresupuesto,
  agruparPorDia,
  filtrarEventos,
  eventosDesdePedido,
  eventoDesdeLog,
  eventoDesdeNecesidad
} from "../src/utils/historialObra.js";

test("cambio de fecha de entrega y de responsable de etapa", () => {
  const antes = { fechaEntregaCliente: "2026-12-01", fases: [{ id: "f1", nombre: "Fontanería", responsable: "Por asignar", dias: 5 }] };
  const despues = { ...antes, fechaEntregaCliente: "2026-12-15", fases: [{ id: "f1", nombre: "Fontanería", responsable: "Juan", dias: 8 }] };
  const ev = cambiosObra(antes, despues);
  assert.deepEqual(ev.map((e) => e.tipo).sort(), ["asignacion", "plazo", "plazo"]);
  assert.match(ev.find((e) => e.datos.campo === "fechaEntregaCliente").titulo, /01\/12\/2026 → 15\/12\/2026/);
  assert.equal(ev.find((e) => e.tipo === "asignacion").detalle, "");
});

test("sin cambios no hay sucesos", () => {
  const o = { fechaFinEstimada: "2026-12-01", fases: [{ id: "f1", nombre: "A", progreso: 10, tareas: [{ id: "t1", progreso: 10 }] }] };
  assert.equal(cambiosObra(o, { ...o }).length, 0);
});

test("avance de partidas", () => {
  const antes = { fases: [{ id: "f1", nombre: "A", tareas: [{ id: "t1", titulo: "Solado", progreso: 0 }] }] };
  const despues = { fases: [{ id: "f1", nombre: "A", tareas: [{ id: "t1", titulo: "Solado", progreso: 50 }] }] };
  const [ev] = cambiosObra(antes, despues);
  assert.equal(ev.tipo, "avance");
  assert.match(ev.titulo, /Solado: 0 % → 50 %/);
});

test("partidas y secciones del presupuesto", () => {
  const antes = [{ id: "c1", nombre: "Baño", partidas: [{ id: "p1", concepto: "Alicatado", cantidad: 10, unidad: "m2", precioVenta: 30, total: 300 }, { id: "p2", concepto: "Plato", cantidad: 1, precioVenta: 200 }] }];
  const despues = [
    { id: "c1", nombre: "Baño", partidas: [{ id: "p1", concepto: "Alicatado", cantidad: 12, unidad: "m2", precioVenta: 30, total: 360 }] },
    { id: "c2", nombre: "Cocina", partidas: [{ id: "p3", concepto: "Encimera", cantidad: 1, precioVenta: 500, total: 500 }] }
  ];
  const ev = cambiosPresupuesto(antes, despues, { numero: "PRES-1" });
  const titulos = ev.map((e) => e.titulo);
  assert.ok(titulos.some((t) => /partida cambiada: Alicatado/.test(t)));
  assert.ok(ev.find((e) => /cambiada/.test(e.titulo)).detalle.includes("cantidad 10 → 12 m2"));
  assert.ok(titulos.some((t) => /nueva sección "Cocina"/.test(t)));
  assert.ok(titulos.some((t) => /partida añadida: Encimera/.test(t)));
  assert.ok(titulos.some((t) => /partida quitada: Plato/.test(t)));
  assert.ok(titulos.every((t) => t.startsWith("PRES-1: ")));
});

test("agrupa por día del más reciente y filtra por tipo y texto", () => {
  const ev = [
    { id: "a", fecha: "2026-10-30T09:00:00", tipo: "llamada", titulo: "Llamada de Ana" },
    { id: "b", fecha: "2026-11-01T10:00:00", tipo: "pedido", titulo: "Pedido de yeso" },
    { id: "c", fecha: "2026-11-01T08:00:00", tipo: "avance", titulo: "Solado" },
    { id: "d", fecha: "2026-10-29", tipo: "parte", titulo: "Parte diario" }
  ];
  const g = agruparPorDia(ev);
  assert.deepEqual(g.map((x) => x.dia), ["2026-11-01", "2026-10-30", "2026-10-29"]);
  assert.deepEqual(g[0].eventos.map((e) => e.id), ["b", "c"]);
  assert.equal(filtrarEventos(ev, { tipos: new Set(["llamada"]) }).length, 1);
  assert.equal(filtrarEventos(ev, { texto: "YESO" }).length, 1);
  assert.equal(filtrarEventos(ev, { desde: "2026-10-30" }).length, 3);
});

test("pedido enviado con respuesta del proveedor", () => {
  const ev = eventosDesdePedido({
    id: "o1", created_at: "2026-10-01T08:00:00Z", sent_at: "2026-10-01T09:00:00Z", status: "enviado",
    items: [{ material: "Yeso", cantidad: 20, unidad: "sacos" }], suppliers: { name: "Obramat" },
    responded_at: "2026-10-02T09:00:00Z", response_status: "confirmado", delivery_date: "2026-10-05"
  });
  assert.equal(ev.length, 2);
  assert.match(ev[0].titulo, /Pedido enviado a Obramat/);
  assert.match(ev[0].detalle, /Yeso 20 sacos/);
  assert.match(ev[1].detalle, /05\/10\/2026/);
});

test("logs de avance y necesidades de maquinaria", () => {
  const log = eventoDesdeLog({ id: 1, created_at: "2026-10-01T08:00:00Z", kind: "certificacion", pct_before: 20, pct_after: 60, fase_id: "f1", partida_id: "t1", photos: [] }, () => "01.01 Solado");
  assert.equal(log.tipo, "avance");
  assert.equal(log.titulo, "Certificado: 01.01 Solado 20 % → 60 %");
  const need = eventoDesdeNecesidad({ id: 2, created_at: "2026-10-01T08:00:00Z", category: "maquinaria", description: "Hace falta mini", items: [] });
  assert.equal(need.tipo, "maquinaria");
});

test("sucesos repetidos: se quitan los idénticos y el resto lleva clave única", async () => {
  const { unificarEventos } = await import("../src/utils/historialObra.js");
  const parte = { id: "diario:d-1", fecha: "2026-11-01", tipo: "parte", titulo: "Parte diario", detalle: "ElectroSur" };
  const otro = { ...parte, detalle: "Otro parte con el mismo id" };
  const maq = { id: "m1", fecha: "2026-11-01T10:00:00Z", tipo: "maquinaria", titulo: "Maquinaria: mini" };
  const out = unificarEventos([parte, { ...parte }, otro, maq]);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((e) => e.clave), ["diario:d-1", "diario:d-1#1", "m1"]);
  assert.equal(new Set(out.map((e) => e.clave)).size, out.length);
});
