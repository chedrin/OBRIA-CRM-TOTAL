import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gastosDePedido, pedidoPendienteDePrecio, repartoIgual, validarPrecioPedido, planGastosPedido, datosGastoPedido
} from "../src/utils/gastoPedido.js";
import { gastosObra } from "../src/utils/gastosIngresosObra.js";
import { alquilerPendienteDePrecio, marcarAlquileresSinPrecio, gastosFlota, alquileresPendientesDePrecio } from "../src/utils/flota.js";

const order = { id: "o1", status: "entregado", obra_id: "obra-1", obra_ids: ["obra-1"], items: [{ cantidad: 10, unidad: "sacos", material: "cemento" }] };

test("pedido entregado sin gasto queda pendiente de precio", () => {
  assert.equal(pedidoPendienteDePrecio(order, []), true);
  assert.equal(pedidoPendienteDePrecio({ ...order, status: "enviado" }, []), false);
  assert.equal(pedidoPendienteDePrecio(order, [{ id: "g", pedidoId: "o1", obraId: "obra-1" }]), false);
});

test("validar precio: obligatorio y reparto entre obras", () => {
  assert.ok(validarPrecioPedido({ base: "", obraIds: ["a"] }).error);
  assert.deepEqual(validarPrecioPedido({ base: "120,5", obraIds: ["a"] }).bases, { a: 120.5 });
  assert.deepEqual(repartoIgual(100, ["a", "b", "c"]), { a: 33.33, b: 33.33, c: 33.34 });
  assert.ok(validarPrecioPedido({ base: 100, obraIds: ["a", "b"], reparto: { a: 60, b: 30 } }).error);
  assert.deepEqual(validarPrecioPedido({ base: 100, obraIds: ["a", "b"], reparto: { a: "60", b: "40" } }).bases, { a: 60, b: 40 });
});

test("el gasto del pedido sale una vez en la obra y editar el precio no duplica", () => {
  const bases = { "obra-1": 200 };
  const p1 = planGastosPedido({ order, bases, existentes: [], ivaPct: 21, numero: "F-1", proveedor: "Almacenes" });
  assert.equal(p1.crear.length, 1);
  assert.equal(p1.crear[0].total, 242);
  const fp = [{ ...p1.crear[0], id: "g1", estadoPago: "pagada" }];
  assert.equal(gastosObra("obra-1", fp).length, 1);

  const p2 = planGastosPedido({ order, bases: { "obra-1": 250 }, existentes: gastosDePedido(fp, "o1"), ivaPct: 21, proveedor: "Almacenes" });
  assert.equal(p2.crear.length, 0);
  assert.equal(p2.actualizar.length, 1);
  assert.equal(p2.actualizar[0].changes.baseImponible, 250);
  assert.equal(p2.actualizar[0].changes.estadoPago, undefined); // se respeta el estado de pago
});

test("cambiar el reparto entre obras quita el gasto de la obra que sobra", () => {
  const multi = { ...order, obra_ids: ["a", "b"] };
  const existentes = [{ id: "ga", pedidoId: "o1", obraId: "a" }, { id: "gb", pedidoId: "o1", obraId: "b" }];
  const plan = planGastosPedido({ order: { ...multi, obra_ids: ["a"] }, bases: { a: 50 }, existentes });
  assert.deepEqual(plan.quitar, ["gb"]);
  assert.equal(datosGastoPedido({ order, base: 1 }).categoria, "Materiales");
});

test("alquileres: cerrados sin importe de factura no cuentan como gasto", () => {
  assert.equal(alquilerPendienteDePrecio({ estado: "devuelto", importe_final: null, tarifa: 50 }), true);
  assert.equal(alquilerPendienteDePrecio({ estado: "devuelto", importe_final: 300, tarifa: 50 }), false);
  assert.equal(alquilerPendienteDePrecio({ estado: "activo", importe_final: null, tarifa: 50 }), false);
  assert.equal(alquilerPendienteDePrecio({ estado: "activo", importe_final: null, tarifa: 0 }), true);

  const costes = [
    { origen: "alquiler", id: "r1", obra_id: "obra-1", base: 150, total: 181.5, concepto: "Alquiler mini" },
    { origen: "alquiler", id: "r2", obra_id: "obra-1", base: 300, total: 363, concepto: "Alquiler andamio" },
    { origen: "combustible", id: "c1", obra_id: "obra-1", base: 40, total: 48.4 }
  ];
  const rentals = [{ id: "r1", estado: "devuelto", importe_final: null, tarifa: 50 }, { id: "r2", estado: "devuelto", importe_final: 300, factura_path: "alquileres/x.pdf" }];
  const marcados = marcarAlquileresSinPrecio(costes, rentals);
  assert.deepEqual(gastosFlota("obra-1", marcados).map((g) => g.id).sort(), ["flota-alquiler-r2", "flota-combustible-c1"]);
  assert.deepEqual(alquileresPendientesDePrecio("obra-1", marcados).map((c) => c.id), ["r1"]);
  assert.equal(marcados[1].file_path, "alquileres/x.pdf");
});
