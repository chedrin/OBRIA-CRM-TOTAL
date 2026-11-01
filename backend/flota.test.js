import { test } from "node:test";
import assert from "node:assert/strict";
import { itvSugerida, consumoMedio, costeAlquiler, sumarMeses, plazoAlerta, ordenarAlertas, peorEstado } from "../src/utils/flota.js";
import { gastosObra } from "../src/utils/gastosIngresosObra.js";

test("sumar meses sin desbordar el mes", () => {
  assert.equal(sumarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(sumarMeses("2024-02-29", 12), "2025-02-28");
  assert.equal(sumarMeses("2026-11-15", 6), "2027-05-15");
});

test("ITV orientativa por tipo y antigüedad", () => {
  // Furgoneta: primera a los 2 años; bienal hasta 6; anual hasta 10; semestral después.
  assert.equal(itvSugerida({ tipo_vehiculo: "furgoneta", fecha_matriculacion: "2024-03-10" }), "2026-03-10");
  assert.equal(itvSugerida({ tipo_vehiculo: "furgoneta", fecha_matriculacion: "2022-03-10" }, "2026-03-01"), "2028-03-01");
  assert.equal(itvSugerida({ tipo_vehiculo: "furgoneta", fecha_matriculacion: "2018-03-10" }, "2026-03-01"), "2027-03-01");
  assert.equal(itvSugerida({ tipo_vehiculo: "furgoneta", fecha_matriculacion: "2014-03-10" }, "2026-03-01"), "2026-09-01");
  // Turismo: primera a los 4 años; bienal hasta 10; anual después.
  assert.equal(itvSugerida({ tipo_vehiculo: "turismo", fecha_matriculacion: "2023-05-01" }), "2027-05-01");
  assert.equal(itvSugerida({ tipo_vehiculo: "turismo", fecha_matriculacion: "2012-05-01" }, "2026-05-01"), "2027-05-01");
  assert.equal(itvSugerida({ tipo_vehiculo: "camion", fecha_matriculacion: "2020-01-01" }, "2026-01-10"), "2027-01-10");
  assert.equal(itvSugerida({ tipo_vehiculo: "remolque", fecha_matriculacion: "2020-01-01" }, "2026-01-10"), null);
  assert.equal(itvSugerida({ tipo_vehiculo: "turismo" }), null);
});

test("consumo medio por depósito lleno (los parciales se suman al siguiente lleno)", () => {
  const r = consumoMedio([
    { km: 10000, litros: 40, importe: 60, deposito_lleno: true },
    { km: 10300, litros: 10, importe: 15, deposito_lleno: false },
    { km: 10800, litros: 46, importe: 69, deposito_lleno: true },
    { km: 11800, litros: 70, importe: 105, deposito_lleno: true }
  ]);
  assert.equal(r.tramos.length, 2);
  assert.equal(r.tramos[0].l100, 7);      // 56 l en 800 km
  assert.equal(r.tramos[1].l100, 7);      // 70 l en 1000 km
  assert.equal(r.media, 7);
  assert.equal(r.eurosKm, 0.105);         // (249 - 60) € / 1800 km
  assert.equal(consumoMedio([{ km: 1, litros: 5, deposito_lleno: false }]).media, null);
});

test("coste de alquiler: semanas empezadas, transporte e importe de factura", () => {
  const r = { fecha_inicio: "2026-10-23", fecha_prevista_devolucion: "2026-11-02", tarifa: 100, tarifa_periodo: "semana", transporte: 60 };
  assert.deepEqual(costeAlquiler(r, "2026-11-01"), { base: 260, dias: 10, periodos: 2, estimado: true });
  // Activo y pasado de fecha: se cuenta hasta la fecha prevista.
  assert.equal(costeAlquiler({ ...r, tarifa_periodo: "dia", tarifa: 50, transporte: 0 }, "2026-12-01").base, 550);
  assert.equal(costeAlquiler({ ...r, fecha_devolucion: "2026-10-23", tarifa_periodo: "dia" }, "2026-12-01").base, 160);
  assert.equal(costeAlquiler({ ...r, importe_final: 199.5 }).base, 199.5);
});

test("alertas: orden, peor estado y plazo", () => {
  const al = [
    { estado: "proximo", dias_restantes: 20 },
    { estado: "vencido", dias_restantes: -3 },
    { estado: "urgente", km_restantes: 200 }
  ];
  assert.deepEqual(ordenarAlertas(al).map((a) => a.estado), ["vencido", "urgente", "proximo"]);
  assert.equal(peorEstado(al), "vencido");
  assert.equal(peorEstado([]), "vigente");
  assert.equal(plazoAlerta({ dias_restantes: -3 }), "Venció hace 3 días");
  assert.equal(plazoAlerta({ dias_restantes: 1, km_restantes: 800 }), "Vence mañana · Faltan 800 km");
});

test("costes de flota en los gastos de la obra, sin contar dos veces una factura ya apuntada", () => {
  const costes = [
    { origen: "combustible", id: "f1", obra_id: "o1", fecha: "2026-10-30", concepto: "Combustible", proveedor: "Repsol", base: 61.98, total: 75 },
    { origen: "mantenimiento", id: "m1", obra_id: "o1", fecha: "2026-10-29", concepto: "Taller", proveedor: "Talleres Paco", numero: "T-15", base: 130, total: 157.3 },
    { origen: "alquiler", id: "r1", obra_id: "o2", fecha: "2026-10-29", base: 260, total: 314.6 }
  ];
  const manual = [{ id: "g1", obraId: "o1", proveedor: "Talleres Paco", numeroProveedor: "T 15", baseImponible: 130, total: 157.3, fecha: "2026-10-29" }];
  const gastos = gastosObra("o1", manual, [], costes);
  assert.deepEqual(gastos.map((g) => g.id).sort(), ["flota-combustible-f1", "g1"]);
  const fuel = gastos.find((g) => g.origen === "flota");
  assert.equal(fuel.categoria, "Combustible");
  assert.equal(fuel.pagado, true);
});
