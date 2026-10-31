import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularNomina, calcularTrienios, salarioBaseParaNeto, situacionIrpf } from "../src/utils/nomina.js";

const base = {
  salarioBaseMensual: 1850, plusConvenio: 220, precioHoraExtra: 18.5, tipoContrato: "indefinido",
  situacionFamiliar: "casado", hijosACargo: 2, fechaAlta: "2020-02-01", importeTrienio: 30, fechaNacimiento: "1984-06-12"
};

test("trienios automáticos por antigüedad y manuales", () => {
  assert.equal(calcularTrienios(base, new Date(2026, 9, 31)), 2);
  assert.equal(calcularTrienios({ ...base, trieniosManual: 4 }, new Date(2026, 9, 31)), 4);
});

test("nómina mensual cuadra: devengos - deducciones = líquido", () => {
  const r = calcularNomina({ ...base, horasExtras: 8 }, { mes: 10, anio: 2026 });
  assert.equal(r.totalDevengado, 1850 + 60 + 220 + 148);
  assert.ok(Math.abs(r.totalDevengado - r.totalDeducciones - r.liquido) < 0.01);
  assert.ok(r.irpf.tipo > 10 && r.irpf.tipo < 16, `tipo ${r.irpf.tipo}`);
  // horas extra fuera de la base de contingencias comunes y dentro de la de profesionales
  assert.equal(Math.round(r.bases.contingenciasProfesionales - r.bases.contingenciasComunes), 148);
});

test("más hijos o monoparental retiene menos IRPF", () => {
  const sin = calcularNomina({ ...base, hijosACargo: 0, situacionFamiliar: "soltero" }, { mes: 10 }).irpf.tipo;
  const con = calcularNomina({ ...base, hijosACargo: 3 }, { mes: 10 }).irpf.tipo;
  assert.ok(con < sin);
  assert.equal(situacionIrpf({ situacionFamiliar: "monoparental", hijosACargo: 1 }), 1);
  assert.equal(situacionIrpf({ situacionFamiliar: "casado", conyugeSinRentas: true }), 2);
});

test("sueldos bajos no retienen; temporales retienen al menos un 2 %", () => {
  assert.equal(calcularNomina({ salarioBaseMensual: 1100, tipoContrato: "indefinido" }, { mes: 3 }).irpf.tipo, 0);
  assert.equal(calcularNomina({ salarioBaseMensual: 1100, tipoContrato: "temporal" }, { mes: 3 }).irpf.tipo, 2);
});

test("IRPF manual manda sobre el calculado", () => {
  const r = calcularNomina({ ...base, irpfModo: "manual", irpfPct: 20 }, { mes: 10 });
  assert.equal(r.irpf.aplicado, 20);
});

test("paga extra en junio y diciembre si no se prorratea", () => {
  assert.equal(calcularNomina(base, { mes: 6, anio: 2026 }).pagaExtraMes, 1910);
  assert.equal(calcularNomina(base, { mes: 7, anio: 2026 }).pagaExtraMes, 0);
  const pr = calcularNomina({ ...base, pagasProrrateadas: true }, { mes: 7, anio: 2026 });
  assert.ok(pr.conceptos.some((c) => c.concepto.startsWith("Prorrata")));
});

test("días sin sueldo y baja IT por enfermedad común", () => {
  const r = calcularNomina({ ...base, diasNoRetribuidos: 2, itDiasMes: 10, itDiasPrevios: 0 }, { mes: 10 });
  assert.equal(r.dias.salario, 18);
  // días 1-3 sin prestación, 4-10 al 60 %
  assert.deepEqual(r.it.tramos, [{ pct: 0, dias: 3 }, { pct: 60, dias: 7 }]);
  assert.ok(r.it.prestacion > 0);
});

test("salario base para un neto deseado", () => {
  const sb = salarioBaseParaNeto(base, 1800);
  const r = calcularNomina({ ...base, salarioBaseMensual: sb }, { mes: 1 });
  assert.ok(Math.abs(r.liquido - 1800) < 0.05, `${r.liquido}`);
});
