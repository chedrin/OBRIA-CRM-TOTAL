import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUCKET_ARCHIVOS, BUCKET_LIDAR, LIMITE_BUCKET, CATEGORIAS_ARCHIVO, tipoArchivo, rutaArchivo, rutaMiniatura,
  nombreSeguro, carpetaObra, usarSubidaReanudable, formatoTamano, mimesPorBucket
} from "../src/utils/archivosObra.js";
import { limpiarStorage } from "./storageLimpieza.js";

const SQL = fs.readFileSync(new URL("../supabase_schema_archivos_obra.sql", import.meta.url), "utf8");

function bucketSql(id) {
  const m = SQL.match(new RegExp(`values \\('${id}', '${id}', false, (\\d+), array\\[([\\s\\S]*?)\\]\\)`));
  assert.ok(m, `falta el bucket ${id} en el SQL`);
  return { limite: Number(m[1]), mimes: new Set([...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1])) };
}

test("el SQL permite todos los tipos y tamaños que sube la app", () => {
  const porBucket = mimesPorBucket();
  for (const id of [BUCKET_ARCHIVOS, BUCKET_LIDAR]) {
    const sql = bucketSql(id);
    assert.equal(sql.limite, LIMITE_BUCKET[id], `límite de ${id}`);
    for (const mime of porBucket[id]) assert.ok(sql.mimes.has(mime), `${id} no admite ${mime}`);
  }
  // Las categorías del SQL y las de la app coinciden.
  const cats = SQL.match(/categoria in \(([^)]*)\)\),/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(cats.sort(), Object.keys(CATEGORIAS_ARCHIVO).sort());
  const deObrero = SQL.match(/p_categoria in \(([^)]*)\)/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  assert.deepEqual(deObrero.sort(), Object.entries(CATEGORIAS_ARCHIVO).filter(([, c]) => c.obrero).map(([k]) => k).sort());
});

test("tipo de archivo: MIME por extensión, bucket por categoría y límites", () => {
  assert.deepEqual(tipoArchivo({ name: "Planta Baja.DWG", size: 2e6 }, "planos"), { ext: "dwg", mime: "image/vnd.dwg", bucket: BUCKET_ARCHIVOS });
  assert.deepEqual(tipoArchivo({ name: "salon.e57", size: 900e6 }, "lidar"), { ext: "e57", mime: "application/octet-stream", bucket: BUCKET_LIDAR });
  assert.throws(() => tipoArchivo({ name: "virus.exe", size: 10 }, "documentacion"), /no se admite/);
  assert.throws(() => tipoArchivo({ name: "plano.pdf", size: 200 * 1024 * 1024 }, "planos"), /máximo/);
  assert.throws(() => tipoArchivo({ name: "vacio.pdf", size: 0 }, "planos"), /vacío/);
  assert.throws(() => tipoArchivo({ name: "a.pdf", size: 5 }, "nada"), /categoría/);
});

test("rutas: obras/{obra}/{categoria}/{mes}/{id}-{nombre}.{ext}", () => {
  const fecha = new Date("2026-11-01T10:00:00Z");
  assert.equal(
    rutaArchivo({ obraId: "obra-1730000000", categoria: "planos", id: "abc", nombre: "Planta baja (rev 2).pdf", ext: "pdf", fecha }),
    "obras/obra-1730000000/planos/2026-11/abc-Planta-baja-rev-2.pdf"
  );
  assert.equal(rutaMiniatura("obra-1", "abc"), "obras/obra-1/miniaturas/abc.jpg");
  assert.equal(nombreSeguro("Baño ñandú.jpg"), "Bano-nandu");
  assert.equal(nombreSeguro("???.pdf"), "archivo");
  assert.throws(() => carpetaObra("../otra"), /identificador/);
  assert.throws(() => carpetaObra(""), /identificador/);
});

test("subida reanudable por encima de 6 MB y tamaños legibles", () => {
  assert.equal(usarSubidaReanudable(6 * 1024 * 1024), false);
  assert.equal(usarSubidaReanudable(6 * 1024 * 1024 + 1), true);
  assert.equal(formatoTamano(512), "512 B");
  assert.equal(formatoTamano(1536), "1,5 KB");
  assert.equal(formatoTamano(5 * 1024 * 1024 * 1024), "5 GB");
});

function clienteFalso({ cola = [], pendientes = [], fallaBucket = null } = {}) {
  const llamadas = { remove: [], borradosCola: [], actualizados: [], filtroPendiente: null };
  const tabla = (nombre) => {
    const q = {
      _op: "select", _filtros: {},
      delete() { q._op = "delete"; return q; },
      update(v) { q._op = "update"; q._valor = v; return q; },
      select() {
        if (nombre === "obra_archivos" && q._op === "delete") { llamadas.filtroPendiente = { ...q._filtros }; return Promise.resolve({ data: pendientes, error: null }); }
        return q;
      },
      eq(k, v) { q._filtros[k] = v; if (q._op === "update") { llamadas.actualizados.push({ id: v, ...q._valor }); return Promise.resolve({ error: null }); } return q; },
      lt(k, v) { q._filtros[k] = v; return q; },
      order() { return q; },
      limit() { return Promise.resolve({ data: cola, error: null }); },
      in(k, ids) { llamadas.borradosCola.push(...ids); return Promise.resolve({ error: null }); }
    };
    return q;
  };
  return {
    llamadas,
    from: tabla,
    storage: {
      from: (bucket) => ({
        remove: async (paths) => {
          llamadas.remove.push({ bucket, paths });
          return bucket === fallaBucket ? { error: { message: "caído" } } : { data: [], error: null };
        }
      })
    }
  };
}

test("limpieza: anula subidas a medias y vacía la cola por bucket", async () => {
  const cola = [
    { id: 1, bucket_id: "obra-archivos", path: "obras/o1/fotos/a.jpg", intentos: 0 },
    { id: 2, bucket_id: "obra-lidar", path: "obras/o1/lidar/b.las", intentos: 2 },
    { id: 3, bucket_id: "obra-archivos", path: "obras/o1/miniaturas/a.jpg", intentos: 0 }
  ];
  const c = clienteFalso({ cola, pendientes: [{ id: "x" }], fallaBucket: "obra-lidar" });
  const r = await limpiarStorage({ client: c, ahora: new Date("2026-11-02T12:00:00Z") });
  assert.deepEqual(r, { pendientes: 1, borrados: 2, fallidos: 1 });
  assert.deepEqual(c.llamadas.filtroPendiente, { estado: "pendiente", created_at: "2026-11-01T12:00:00.000Z" });
  assert.deepEqual(c.llamadas.remove.find((x) => x.bucket === "obra-archivos").paths, ["obras/o1/fotos/a.jpg", "obras/o1/miniaturas/a.jpg"]);
  assert.deepEqual(c.llamadas.borradosCola, [1, 3]);
  assert.equal(c.llamadas.actualizados[0].id, 2);
  assert.equal(c.llamadas.actualizados[0].intentos, 3);
});

test("limpieza: sin la tabla creada no hace nada", async () => {
  const c = {
    from: () => ({ delete() { return this; }, eq() { return this; }, lt() { return this; }, select: async () => ({ error: { code: "PGRST205", message: "Could not find the table" } }) })
  };
  assert.deepEqual(await limpiarStorage({ client: c }), { pendientes: 0, borrados: 0, fallidos: 0 });
});
