/**
 * ObraMaster - Inventario, maquinaria, flota de vehículos, alquileres y alertas
 *
 * Tablas y vistas: supabase_schema_inventario_flota.sql. Cálculos y textos: src/utils/flota.js.
 * El historial de movimientos lo escribe un trigger de la base de datos (inmutable); aquí solo
 * se rellena quién hace el cambio (assets.updated_by / updated_by_name) y el motivo.
 *
 * Rutas de administración:
 *   GET    /api/flota                          Todo lo necesario para las pantallas del módulo.
 *   POST   /api/flota/activos                  Alta de material, herramienta o máquina.
 *   GET    /api/flota/activos/:id              Ficha: historial, mantenimientos, documentos...
 *   PATCH  /api/flota/activos/:id              Corrige datos (no la ubicación).
 *   POST   /api/flota/activos/:id/mover        Traslado: almacén, obra, vehículo, operario, taller, baja.
 *   POST   /api/flota/activos/:id/stock        Entrada o consumo de un consumible { delta, motivo, obra_id }.
 *   POST   /api/flota/activos/:id/sustituir    Sustituye por otro activo { sustituto_id, estado_original, motivo }.
 *   POST   /api/flota/vehiculos                Alta de vehículo { activo, vehiculo }.
 *   PATCH  /api/flota/vehiculos/:id            Ficha del vehículo.
 *   POST   /api/flota/registros/:tipo          ITV, seguro, repostaje, mantenimiento, plan, neumático, documento.
 *   PATCH  /api/flota/registros/:tipo/:id
 *   DELETE /api/flota/registros/:tipo/:id
 *   POST   /api/flota/alquileres               Alquiler (con alta del elemento alquilado si es nuevo).
 *   PATCH  /api/flota/alquileres/:id
 *   POST   /api/flota/alquileres/:id/devolver  { fecha_devolucion, importe_final, numero_factura }
 *   POST   /api/flota/alquileres/:id/sustituir { nuevo: {...}, motivo } (avería del proveedor)
 *   GET    /api/flota/alertas                  Centro de alertas.
 *   POST   /api/flota/alertas/revisar          Crea ya los avisos pendientes (campana, push, correo).
 *   GET|PUT /api/flota/ajustes                 Cuándo y por dónde avisar.
 *   GET    /api/flota/costes?obra=ID           Costes de flota imputados a una obra.
 *   POST   /api/flota/archivo                  Sube PDF o foto (multipart: carpeta, archivo).
 *   GET    /api/flota/archivo?path=...         Enlace firmado (10 min).
 * Rutas del operario (también admin):
 *   GET    /api/flota/mio                      Lo que tiene asignado y el vehículo que conduce.
 *   POST   /api/flota/repostaje                Apunta un repostaje (multipart con foto del ticket opcional).
 */

import crypto from "node:crypto";
import { clip, sendJson, httpError, readJson, readMultipart, getObra, obraLabel } from "./notificaciones.js";
import { getAdminClient, isSupabaseReady } from "./authRoutes.js";
import { MAX_DOC_BYTES, detectDocType } from "./avanceRoutes.js";
import { sendPushForNotification } from "./webPush.js";
import { sendEmail, isValidEmail } from "./emailService.js";
import { isWhatsAppCloudConfigured, sendWhatsAppCloud } from "./whatsapp.js";
import { ACCIONES_MOVIMIENTO } from "../src/utils/flota.js";

export const FLOTA_BUCKET = "flota-docs";
const MIGRATION = "supabase_schema_inventario_flota.sql";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID = "[0-9a-fA-F-]{36}";
const SAFE_PATH = /^(activos|vehiculos|alquileres|repostajes|mantenimiento)\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/;

const isMissing = (error) =>
  ["42P01", "42703", "PGRST205", "PGRST200", "PGRST202"].includes(error?.code) || /does not exist|schema cache/i.test(String(error?.message || ""));

const db = () => getAdminClient();

function dbError(error, what = "el registro") {
  if (isMissing(error)) return httpError(503, `Falta ejecutar ${MIGRATION} en Supabase > SQL Editor.`);
  if (error?.code === "23505") {
    const m = String(error.message || "");
    if (/matricula/.test(m)) return httpError(409, "Ya hay un vehículo con esa matrícula.");
    if (/bastidor/.test(m)) return httpError(409, "Ya hay un vehículo con ese número de bastidor.");
    if (/barras/.test(m)) return httpError(409, "Ese código de barras o QR ya está en otro elemento.");
    if (/codigo/.test(m)) return httpError(409, "Ese código interno ya existe.");
    return httpError(409, `Ya existe ${what} con esos datos.`);
  }
  if (error?.code === "23514") return httpError(400, `Datos no válidos para ${what}: revisa fechas, importes y la ubicación.`);
  if (error?.code === "23503") return httpError(400, "Un elemento relacionado ya no existe.");
  if (error?.code === "P0001") return httpError(400, String(error.message || "Operación no permitida."));
  return new Error(error?.message || String(error));
}

async function run(query, what) {
  const { data, error } = await query;
  if (error) throw dbError(error, what);
  return data;
}

// ---------------------------------------------------------------------------
// Limpieza de campos
// ---------------------------------------------------------------------------
const T = (max = 300) => (v) => clip(v, max) || null;
const NUM = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw httpError(400, "Hay un número que no es válido.");
  return Math.round(n * 1000) / 1000;
};
const INT = (v) => {
  const n = NUM(v);
  return n === null ? null : Math.round(n);
};
const DATE = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw httpError(400, "Hay una fecha que no es válida.");
  return s;
};
const STAMP = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw httpError(400, "Hay una fecha que no es válida.");
  return d.toISOString();
};
const BOOL = (v) => v === true || v === "true" || v === "1" || v === "on";
const ID = (v) => (v && UUID_RE.test(String(v)) ? String(v) : null);
const PATH = (v) => (v && SAFE_PATH.test(String(v)) ? String(v) : null);
const ENUM = (lista) => (v) => (lista.includes(v) ? v : null);

/** Aplica el esquema de campos: solo pasan los campos conocidos y presentes en body. */
function pick(body, spec, { required = [], partial = false } = {}) {
  const out = {};
  for (const [k, fn] of Object.entries(spec)) {
    if (!(k in body)) continue;
    out[k] = fn(body[k]);
  }
  if (!partial) {
    for (const k of required) {
      if (out[k] === null || out[k] === undefined || out[k] === "") throw httpError(400, `Falta el campo obligatorio: ${k.replace(/_/g, " ")}.`);
    }
  } else {
    for (const k of required) {
      if (k in out && (out[k] === null || out[k] === "")) throw httpError(400, `El campo ${k.replace(/_/g, " ")} no puede quedar vacío.`);
    }
  }
  // Los enumerados no reconocidos no se envían (se queda el valor por defecto).
  for (const [k, v] of Object.entries(out)) if (v === null && spec[k].isEnum) delete out[k];
  return out;
}
const E = (lista) => Object.assign(ENUM(lista), { isEnum: true });

const TIPOS = ["consumible", "herramienta_manual", "herramienta_electrica", "maquinaria_ligera", "maquinaria_pesada", "vehiculo", "epi", "medicion", "medio_auxiliar", "otro"];
const ESTADOS = ["en_almacen", "en_obra", "en_vehiculo", "con_operario", "en_reparacion", "devuelto_proveedor", "baja"];

const ASSET_FIELDS = {
  codigo_interno: T(40), codigo_barras: T(120), nombre: T(200), descripcion: T(2000), category_id: ID,
  tipo: E(TIPOS), tipo_adquisicion: E(["propiedad", "alquiler", "renting", "leasing"]),
  numero_serie: T(120), marca: T(120), modelo: T(120), cantidad: NUM, unidad: T(30), stock_minimo: NUM,
  supplier_id: ID, proveedor_nombre: T(200), numero_factura: T(120), fecha_compra: DATE, precio_compra: NUM,
  fecha_fin_garantia: DATE, manual_path: PATH, foto_path: PATH, ubicacion_detalle: T(200), notas: T(4000)
};
const LOCATION_FIELDS = { estado: E(ESTADOS), obra_id: T(120), vehicle_id: ID, operario_id: T(120), operario_nombre: T(200), motivo: T(1000) };

const VEHICLE_FIELDS = {
  matricula: T(20), bastidor: T(40), marca: T(80), modelo: T(80),
  tipo_vehiculo: E(["turismo", "furgoneta", "camion", "moto", "remolque", "maquinaria_autopropulsada", "otro"]),
  fecha_matriculacion: DATE, combustible: E(["diesel", "gasolina", "hibrido", "electrico", "glp", "otro"]),
  capacidad_deposito: NUM, km_actual: INT, distintivo_ambiental: E(["0", "ECO", "C", "B", "sin"]), mma_kg: INT,
  conductor_operario_id: T(120), conductor_nombre: T(200), notas: T(4000)
};

// Registros que cuelgan de un vehículo o de un activo.
const REGISTROS = {
  itv: {
    table: "vehicle_inspections", parent: "vehicle_id", what: "la ITV", required: ["proxima_itv"],
    fields: { fecha_inspeccion: DATE, resultado: E(["favorable", "desfavorable", "negativa", "pendiente"]), proxima_itv: DATE, estacion: T(200), km: INT, coste: NUM, defectos: T(4000), informe_path: PATH },
    files: ["informe_path"]
  },
  seguro: {
    table: "vehicle_insurances", parent: "vehicle_id", what: "el seguro", required: ["aseguradora", "numero_poliza", "fecha_inicio", "fecha_vencimiento"],
    fields: { aseguradora: T(120), numero_poliza: T(120), cobertura: E(["terceros", "terceros_ampliado", "todo_riesgo_franquicia", "todo_riesgo"]), telefono_asistencia: T(40), fecha_inicio: DATE, fecha_vencimiento: DATE, prima: NUM, poliza_path: PATH, activa: BOOL },
    files: ["poliza_path"]
  },
  repostaje: {
    table: "vehicle_fuel_logs", parent: "vehicle_id", what: "el repostaje", required: ["km", "litros", "importe"],
    fields: { fecha: STAMP, km: INT, litros: NUM, importe: NUM, iva_pct: NUM, deposito_lleno: BOOL, estacion: T(120), operario_id: T(120), operario_nombre: T(200), obra_id: T(120), ticket_path: PATH },
    files: ["ticket_path"]
  },
  mantenimiento: {
    table: "asset_maintenance", parent: "asset_id", what: "el mantenimiento", required: ["descripcion"],
    fields: { plan_id: ID, tipo: E(["revision", "aceite_filtros", "frenos", "neumaticos", "reparacion_mecanica", "chapa_pintura", "electricidad", "calibracion", "certificacion", "otro"]), fecha: DATE, km: INT, supplier_id: ID, taller_nombre: T(200), mano_obra: NUM, piezas: NUM, iva_pct: NUM, numero_factura: T(120), factura_path: PATH, descripcion: T(4000), obra_id: T(120) },
    files: ["factura_path"]
  },
  plan: {
    table: "maintenance_plans", parent: "asset_id", what: "el plan de mantenimiento", required: ["nombre"],
    fields: { nombre: T(200), tipo: E(["revision", "calibracion", "certificacion"]), cada_km: INT, cada_meses: INT, ultima_fecha: DATE, ultimo_km: INT, activo: BOOL },
    files: []
  },
  neumatico: {
    table: "vehicle_tires", parent: "vehicle_id", what: "el neumático", required: ["posicion", "marca", "medida", "km_montaje"],
    fields: { posicion: E(["delantero_izquierdo", "delantero_derecho", "trasero_izquierdo", "trasero_derecho", "trasero_izquierdo_interior", "trasero_derecho_interior", "repuesto", "otra"]), marca: T(80), modelo: T(80), medida: T(40), fecha_montaje: DATE, km_montaje: INT, profundidad_mm: NUM, profundidad_fecha: DATE, activo: BOOL, fecha_desmontaje: DATE, km_desmontaje: INT, motivo_cambio: T(500), supplier_id: ID },
    files: []
  },
  documento: {
    table: "asset_documents", parent: "asset_id", what: "el documento", required: ["nombre"],
    fields: { tipo: E(["ficha_tecnica", "permiso_circulacion", "tarjeta_transporte", "autorizacion", "certificado", "garantia", "manual", "factura", "foto", "otro"]), nombre: T(200), numero: T(120), fecha_emision: DATE, fecha_caducidad: DATE, file_path: PATH, file_name: T(200), activo: BOOL },
    files: ["file_path"]
  }
};

const RENTAL_FIELDS = {
  supplier_id: ID, arrendador_nombre: T(200), obra_id: T(120), numero_contrato: T(120),
  fecha_inicio: DATE, fecha_prevista_devolucion: DATE, tarifa: NUM, tarifa_periodo: E(["dia", "semana", "mes"]),
  transporte: NUM, fianza: NUM, iva_pct: NUM, importe_final: NUM, numero_factura: T(120), contrato_path: PATH, notas: T(4000)
};

const quien = (req) => ({ updated_by: ID(req.user?.id), updated_by_name: clip(req.user?.full_name || req.user?.username, 200) || "Administración" });

// ---------------------------------------------------------------------------
// Histórico diario de la obra (obra_eventos): traslados y alquileres
// ---------------------------------------------------------------------------
async function eventoObra(req, obraId, { tipo = "maquinaria", titulo, detalle = "", datos = {} }) {
  if (!obraId) return;
  try {
    const { error } = await db().from("obra_eventos").insert({
      obra_id: obraId, tipo, origen: "auto", titulo: clip(titulo, 300), detalle: clip(detalle, 4000) || null,
      datos, autor_name: quien(req).updated_by_name, autor_user: ID(req.user?.id)
    });
    if (error && !isMissing(error)) console.warn("[flota] No se pudo anotar en el histórico:", error.message);
  } catch (err) {
    console.warn("[flota] Histórico:", err?.message || err);
  }
}

const etiquetaActivo = (a) => `${a.codigo_interno} · ${a.nombre}`;

async function anotarTraslado(req, antes, despues, motivo) {
  if (antes.obra_id === despues.obra_id) return;
  const tipo = despues.tipo === "consumible" || antes.tipo === "consumible" ? "material" : "maquinaria";
  const datos = { assetId: despues.id, codigo: despues.codigo_interno, flota: true };
  if (despues.obra_id) await eventoObra(req, despues.obra_id, { tipo, titulo: `Llega a la obra: ${etiquetaActivo(despues)}`, detalle: motivo || "", datos });
  if (antes.obra_id) {
    const destino = ACCIONES_MOVIMIENTO[{ en_almacen: "devolucion_almacen", en_reparacion: "envio_reparacion", devuelto_proveedor: "devolucion_proveedor", baja: "baja", en_vehiculo: "carga_vehiculo", en_obra: "traslado_obra" }[despues.estado]] || "Sale";
    await eventoObra(req, antes.obra_id, { tipo, titulo: `Sale de la obra: ${etiquetaActivo(despues)} (${destino.toLowerCase()})`, detalle: motivo || "", datos });
  }
}

// ---------------------------------------------------------------------------
// Lectura general
// ---------------------------------------------------------------------------
async function handleResumen(res) {
  const [categorias, activos, vehiculos, alquileres, alertas, ajustes, proveedores] = await Promise.all([
    db().from("asset_categories").select("*").order("nombre"),
    db().from("assets").select("*").order("codigo_interno"),
    db().from("vehicles").select("*").order("matricula"),
    db().from("asset_rentals").select("*, suppliers(name)").order("fecha_prevista_devolucion", { ascending: true }).limit(500),
    db().from("fleet_alertas").select("*"),
    db().from("fleet_settings").select("*").eq("id", true).maybeSingle(),
    db().from("suppliers").select("id, name, phone, email, categories, cif, is_active").order("name")
  ]);
  const first = [categorias, activos, vehiculos, alquileres, alertas, ajustes].find((r) => r.error);
  if (first && isMissing(first.error)) return sendJson(res, 200, { listo: false, migracion: MIGRATION });
  if (first) throw dbError(first.error);
  // Costes de cada vehículo en los últimos 12 meses (centro de coste).
  const desde = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const costes = await run(db().from("fleet_costes").select("asset_id, origen, base, total, fecha").gte("fecha", desde));
  const costePorActivo = {};
  for (const c of costes || []) {
    const k = c.asset_id;
    costePorActivo[k] = costePorActivo[k] || { total: 0, base: 0 };
    costePorActivo[k].total += Number(c.total || 0);
    costePorActivo[k].base += Number(c.base || 0);
  }
  sendJson(res, 200, {
    listo: true,
    categorias: categorias.data,
    activos: activos.data,
    vehiculos: vehiculos.data,
    alquileres: (alquileres.data || []).map(({ suppliers, ...r }) => ({ ...r, arrendador: suppliers?.name || r.arrendador_nombre || "" })),
    alertas: alertas.data,
    ajustes: ajustes.data,
    proveedores: proveedores.error ? [] : proveedores.data,
    costes12m: costePorActivo
  });
}

async function getAsset(id) {
  const a = await run(db().from("assets").select("*").eq("id", id).maybeSingle(), "el elemento");
  if (!a) throw httpError(404, "Elemento no encontrado.");
  return a;
}

async function handleFicha(res, id) {
  const activo = await getAsset(id);
  const vehiculo = await run(db().from("vehicles").select("*").eq("asset_id", id).maybeSingle());
  const vid = vehiculo?.id || "00000000-0000-0000-0000-000000000000";
  const [movimientos, mantenimientos, planes, documentos, alquileres, itv, seguros, repostajes, neumaticos, aBordo, costes, alertas, sustituto] = await Promise.all([
    run(db().from("inventory_movements").select("*").eq("asset_id", id).order("created_at", { ascending: false }).limit(500)),
    run(db().from("asset_maintenance").select("*, suppliers(name)").eq("asset_id", id).order("fecha", { ascending: false })),
    run(db().from("maintenance_plans").select("*").eq("asset_id", id).order("created_at")),
    run(db().from("asset_documents").select("*").eq("asset_id", id).order("created_at", { ascending: false })),
    run(db().from("asset_rentals").select("*, suppliers(name)").eq("asset_id", id).order("fecha_inicio", { ascending: false })),
    run(db().from("vehicle_inspections").select("*").eq("vehicle_id", vid).order("proxima_itv", { ascending: false })),
    run(db().from("vehicle_insurances").select("*").eq("vehicle_id", vid).order("fecha_vencimiento", { ascending: false })),
    run(db().from("vehicle_fuel_logs").select("*").eq("vehicle_id", vid).order("km", { ascending: false }).limit(1000)),
    run(db().from("vehicle_tires").select("*").eq("vehicle_id", vid).order("activo", { ascending: false }).order("fecha_montaje", { ascending: false })),
    run(db().from("assets").select("*").eq("vehicle_id", vid).neq("estado", "baja").order("nombre")),
    run(db().from("fleet_costes").select("*").eq("asset_id", id).order("fecha", { ascending: false })),
    run(db().from("fleet_alertas").select("*").eq("asset_id", id)),
    run(db().from("assets").select("id, codigo_interno, nombre").eq("sustituye_a", id))
  ]);
  const sname = (rows) => (rows || []).map(({ suppliers, ...r }) => ({ ...r, proveedor: suppliers?.name || r.taller_nombre || r.arrendador_nombre || "" }));
  sendJson(res, 200, {
    activo, vehiculo, movimientos, mantenimientos: sname(mantenimientos), planes, documentos, alquileres: sname(alquileres),
    itv, seguros, repostajes, neumaticos, aBordo, costes, alertas, sustitutos: sustituto
  });
}

// ---------------------------------------------------------------------------
// Activos
// ---------------------------------------------------------------------------
function locationFrom(body) {
  const loc = pick(body, LOCATION_FIELDS);
  if (!loc.estado) loc.estado = "en_almacen";
  if (loc.estado === "en_obra" && !loc.obra_id) throw httpError(400, "Elige la obra.");
  if (loc.estado === "en_vehiculo" && !loc.vehicle_id) throw httpError(400, "Elige el vehículo.");
  if (loc.estado === "con_operario" && !loc.operario_id) throw httpError(400, "Elige el operario.");
  return loc;
}

async function insertAsset(req, body, extra = {}) {
  const data = pick(body, ASSET_FIELDS, { required: ["nombre"] });
  const loc = locationFrom(body);
  const row = { ...data, ...loc, ...extra, ...quien(req) };
  return run(db().from("assets").insert(row).select().single(), "el elemento");
}

async function handleCreateAsset(req, res) {
  const body = await readJson(req);
  if (body.tipo === "vehiculo") throw httpError(400, "Los vehículos se dan de alta en Flota.");
  const a = await insertAsset(req, body);
  if (a.obra_id) await anotarTraslado(req, { obra_id: null }, a, a.motivo);
  sendJson(res, 201, a);
}

async function handleUpdateAsset(req, res, id) {
  await getAsset(id);
  const data = pick(await readJson(req), ASSET_FIELDS, { partial: true, required: ["nombre", "codigo_interno"] });
  delete data.tipo; // el tipo no cambia (afecta al código y a si es vehículo)
  const a = await run(db().from("assets").update({ ...data, ...quien(req) }).eq("id", id).select().single(), "el elemento");
  sendJson(res, 200, a);
}

async function handleMove(req, res, id) {
  const antes = await getAsset(id);
  const body = await readJson(req);
  const loc = locationFrom(body);
  if (loc.vehicle_id) {
    const v = await run(db().from("vehicles").select("id, asset_id").eq("id", loc.vehicle_id).maybeSingle());
    if (!v) throw httpError(400, "El vehículo no existe.");
    if (v.asset_id === id) throw httpError(400, "Un vehículo no puede ir dentro de sí mismo.");
  }
  const despues = await run(db().from("assets").update({ ...loc, motivo: loc.motivo || null, ...quien(req) }).eq("id", id).select().single(), "el traslado");
  await anotarTraslado(req, antes, despues, loc.motivo);
  sendJson(res, 200, despues);
}

async function handleStock(req, res, id) {
  const a = await getAsset(id);
  const body = await readJson(req);
  const delta = NUM(body.delta);
  if (!delta) throw httpError(400, "Indica la cantidad que entra (+) o que se gasta (-).");
  const cantidad = Math.max(0, Math.round((Number(a.cantidad) + delta) * 100) / 100);
  const motivo = clip(body.motivo, 1000) || (delta > 0 ? "Entrada de material" : "Consumo");
  const obraId = clip(body.obra_id, 120) || null;
  const despues = await run(db().from("assets").update({ cantidad, motivo, ...quien(req) }).eq("id", id).select().single(), "el stock");
  if (obraId && delta < 0) {
    await eventoObra(req, obraId, {
      tipo: "material",
      titulo: `Material del almacén: ${a.nombre}`,
      detalle: motivo,
      datos: { assetId: a.id, flota: true, items: [{ concepto: a.nombre, cantidad: -delta, unidad: a.unidad }] }
    });
  }
  sendJson(res, 200, despues);
}

async function handleSustituir(req, res, id) {
  const viejo = await getAsset(id);
  const body = await readJson(req);
  const motivo = clip(body.motivo, 1000);
  if (!motivo) throw httpError(400, "Escribe el motivo de la sustitución (avería, robo...).");
  const estadoOriginal = ["en_reparacion", "baja", "devuelto_proveedor", "en_almacen"].includes(body.estado_original) ? body.estado_original : "en_reparacion";
  let nuevo;
  if (ID(body.sustituto_id)) {
    nuevo = await getAsset(body.sustituto_id);
    if (nuevo.id === viejo.id) throw httpError(400, "Elige otro elemento.");
    if (nuevo.estado === "baja") throw httpError(400, "El sustituto está dado de baja.");
  } else if (body.nuevo && typeof body.nuevo === "object") {
    nuevo = await insertAsset(req, { ...body.nuevo, tipo: body.nuevo.tipo || viejo.tipo, estado: "en_almacen" });
  } else {
    throw httpError(400, "Elige el elemento que lo sustituye.");
  }
  const loc = { estado: viejo.estado, obra_id: viejo.obra_id, vehicle_id: viejo.vehicle_id, operario_id: viejo.operario_id, operario_nombre: viejo.operario_nombre, ubicacion_detalle: viejo.ubicacion_detalle };
  if (["en_reparacion", "baja", "devuelto_proveedor"].includes(loc.estado)) Object.assign(loc, { estado: "en_almacen", obra_id: null, vehicle_id: null, operario_id: null, operario_nombre: null });
  const viejoDespues = await run(db().from("assets").update({ estado: estadoOriginal, motivo: `Sustituido por ${nuevo.codigo_interno}: ${motivo}`, ...quien(req) }).eq("id", viejo.id).select().single(), "la sustitución");
  const nuevoDespues = await run(db().from("assets").update({ ...loc, sustituye_a: viejo.id, motivo: `Sustituye a ${viejo.codigo_interno}: ${motivo}`, ...quien(req) }).eq("id", nuevo.id).select().single(), "la sustitución");
  if (viejo.obra_id) {
    await eventoObra(req, viejo.obra_id, {
      tipo: "maquinaria",
      titulo: `Sustitución: ${etiquetaActivo(viejo)} → ${etiquetaActivo(nuevoDespues)}`,
      detalle: motivo,
      datos: { assetId: nuevo.id, reemplazaA: viejo.id, flota: true }
    });
  }
  sendJson(res, 200, { viejo: viejoDespues, nuevo: nuevoDespues });
}

// ---------------------------------------------------------------------------
// Vehículos
// ---------------------------------------------------------------------------
const normMatricula = (m) => String(m || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

async function handleCreateVehicle(req, res) {
  const body = await readJson(req);
  const veh = pick(body.vehiculo || {}, VEHICLE_FIELDS, { required: ["matricula"] });
  const matricula = normMatricula(veh.matricula);
  if (!matricula) throw httpError(400, "La matrícula es obligatoria.");
  const existe = await run(db().from("vehicles").select("id").eq("matricula", matricula).maybeSingle());
  if (existe) throw httpError(409, "Ya hay un vehículo con esa matrícula.");
  const activoBody = { ...(body.activo || {}), tipo: "vehiculo" };
  if (!activoBody.nombre) activoBody.nombre = [veh.marca, veh.modelo].filter(Boolean).join(" ") || `Vehículo ${matricula}`;
  if (!activoBody.marca) activoBody.marca = veh.marca;
  if (!activoBody.modelo) activoBody.modelo = veh.modelo;
  const activo = await insertAsset(req, activoBody, { tipo: "vehiculo" });
  const { data, error } = await db().from("vehicles").insert({ ...veh, matricula, asset_id: activo.id }).select().single();
  if (error) {
    // El historial no deja borrar el activo: queda de baja con el motivo.
    await db().from("assets").update({ estado: "baja", motivo: `Alta de vehículo fallida: ${error.message}`.slice(0, 900), ...quien(req) }).eq("id", activo.id);
    throw dbError(error, "el vehículo");
  }
  sendJson(res, 201, { activo, vehiculo: data });
}

async function handleUpdateVehicle(req, res, id) {
  const body = await readJson(req);
  const veh = pick(body, VEHICLE_FIELDS, { partial: true, required: ["matricula"] });
  if (veh.matricula) veh.matricula = normMatricula(veh.matricula);
  const v = await run(db().from("vehicles").update(veh).eq("id", id).select().single(), "el vehículo");
  // Nombre, marca y modelo también en su fila de activos.
  if (body.nombre || veh.marca || veh.modelo) {
    const upd = { ...quien(req) };
    if (body.nombre) upd.nombre = clip(body.nombre, 200);
    if (veh.marca) upd.marca = veh.marca;
    if (veh.modelo) upd.modelo = veh.modelo;
    await run(db().from("assets").update(upd).eq("id", v.asset_id));
  }
  sendJson(res, 200, v);
}

// ---------------------------------------------------------------------------
// Registros (ITV, seguros, repostajes, mantenimientos, planes, neumáticos, documentos)
// ---------------------------------------------------------------------------
async function handleCreateRegistro(req, res, tipo) {
  const spec = REGISTROS[tipo];
  if (!spec) throw httpError(404, "Tipo de registro desconocido.");
  const body = await readJson(req);
  const parent = ID(body[spec.parent]);
  if (!parent) throw httpError(400, spec.parent === "vehicle_id" ? "Falta el vehículo." : "Falta el elemento.");
  const row = { ...pick(body, spec.fields, { required: spec.required }), [spec.parent]: parent };
  if (["itv", "seguro", "repostaje", "mantenimiento", "documento"].includes(tipo)) row.created_by = ID(req.user?.id);
  if (tipo === "plan" && !row.cada_km && !row.cada_meses) throw httpError(400, "Indica cada cuántos km o cada cuántos meses.");
  if (tipo === "seguro" && row.activa === undefined) row.activa = true;
  const data = await run(db().from(spec.table).insert(row).select().single(), spec.what);
  // Renovación: la póliza o el documento anterior deja de contar para las alertas.
  const renueva = ID(body.renueva_id);
  if (renueva && (tipo === "seguro" || tipo === "documento")) {
    await run(db().from(spec.table).update(tipo === "seguro" ? { activa: false } : { activo: false }).eq("id", renueva).eq(spec.parent, parent));
  }
  if (tipo === "repostaje" && data.obra_id) {
    const v = await run(db().from("vehicles").select("matricula").eq("id", parent).maybeSingle());
    await eventoObra(req, data.obra_id, { tipo: "maquinaria", titulo: `Repostaje ${v?.matricula || ""}: ${data.litros} l (${Number(data.importe).toFixed(2)} €)`, datos: { flota: true, fuelId: data.id } });
  }
  sendJson(res, 201, data);
}

async function handleUpdateRegistro(req, res, tipo, id) {
  const spec = REGISTROS[tipo];
  if (!spec) throw httpError(404, "Tipo de registro desconocido.");
  const row = pick(await readJson(req), spec.fields, { partial: true, required: spec.required });
  if (!Object.keys(row).length) throw httpError(400, "No hay cambios.");
  const data = await run(db().from(spec.table).update(row).eq("id", id).select().maybeSingle(), spec.what);
  if (!data) throw httpError(404, "Registro no encontrado.");
  sendJson(res, 200, data);
}

async function handleDeleteRegistro(res, tipo, id) {
  const spec = REGISTROS[tipo];
  if (!spec) throw httpError(404, "Tipo de registro desconocido.");
  const fila = await run(db().from(spec.table).select("*").eq("id", id).maybeSingle());
  if (!fila) throw httpError(404, "Registro no encontrado.");
  await run(db().from(spec.table).delete().eq("id", id), spec.what);
  const paths = spec.files.map((f) => fila[f]).filter((p) => p && SAFE_PATH.test(p));
  if (paths.length) db().storage.from(FLOTA_BUCKET).remove(paths).catch(() => {});
  sendJson(res, 200, { ok: true });
}

// ---------------------------------------------------------------------------
// Alquileres
// ---------------------------------------------------------------------------
async function getRental(id) {
  const r = await run(db().from("asset_rentals").select("*").eq("id", id).maybeSingle(), "el alquiler");
  if (!r) throw httpError(404, "Alquiler no encontrado.");
  return r;
}

async function obraTitulo(obraId) {
  if (!obraId) return "";
  try { return obraLabel(await getObra(obraId), ""); } catch { return ""; }
}

async function handleCreateRental(req, res) {
  const body = await readJson(req);
  const row = pick(body, RENTAL_FIELDS, { required: ["fecha_prevista_devolucion"] });
  if (!row.fecha_inicio) row.fecha_inicio = new Date().toISOString().slice(0, 10);
  if (row.fecha_prevista_devolucion < row.fecha_inicio) throw httpError(400, "La devolución prevista no puede ser antes del inicio.");
  if (!row.supplier_id && !row.arrendador_nombre) throw httpError(400, "Indica la empresa de alquiler.");
  let activo;
  if (ID(body.asset_id)) {
    activo = await getAsset(body.asset_id);
    const activoYa = await run(db().from("asset_rentals").select("id").eq("asset_id", activo.id).eq("estado", "activo").limit(1));
    if (activoYa?.length) throw httpError(409, "Ese elemento ya tiene un alquiler en curso.");
    const loc = row.obra_id ? { estado: "en_obra", obra_id: row.obra_id } : { estado: "en_almacen" };
    activo = await run(db().from("assets").update({ ...loc, tipo_adquisicion: activo.tipo_adquisicion === "propiedad" ? activo.tipo_adquisicion : "alquiler", motivo: "Alquiler", ...quien(req) }).eq("id", activo.id).select().single());
  } else if (body.nuevo && typeof body.nuevo === "object") {
    activo = await insertAsset(req, {
      ...body.nuevo,
      tipo: TIPOS.includes(body.nuevo.tipo) && body.nuevo.tipo !== "vehiculo" ? body.nuevo.tipo : "maquinaria_ligera",
      tipo_adquisicion: "alquiler",
      supplier_id: row.supplier_id,
      proveedor_nombre: row.arrendador_nombre,
      estado: row.obra_id ? "en_obra" : "en_almacen",
      obra_id: row.obra_id,
      motivo: "Alquiler"
    });
  } else {
    throw httpError(400, "Indica qué se alquila.");
  }
  const data = await run(db().from("asset_rentals").insert({ ...row, asset_id: activo.id, created_by: ID(req.user?.id) }).select().single(), "el alquiler");
  if (data.obra_id) {
    await eventoObra(req, data.obra_id, {
      tipo: "maquinaria",
      titulo: `Alquiler: ${activo.nombre}`,
      detalle: `Hasta el ${data.fecha_prevista_devolucion.split("-").reverse().join("/")}${data.numero_contrato ? ` · contrato ${data.numero_contrato}` : ""}`,
      datos: { flota: true, rentalId: data.id, assetId: activo.id }
    });
  }
  sendJson(res, 201, { alquiler: data, activo });
}

async function handleUpdateRental(req, res, id) {
  const r = await getRental(id);
  const row = pick(await readJson(req), RENTAL_FIELDS, { partial: true });
  const data = await run(db().from("asset_rentals").update(row).eq("id", id).select().single(), "el alquiler");
  // Si cambia la obra, el elemento alquilado va con ella.
  if ("obra_id" in row && row.obra_id !== r.obra_id && r.estado === "activo") {
    const antes = await getAsset(r.asset_id);
    const loc = row.obra_id ? { estado: "en_obra", obra_id: row.obra_id } : { estado: "en_almacen" };
    const despues = await run(db().from("assets").update({ ...loc, motivo: "Cambio de obra del alquiler", ...quien(req) }).eq("id", r.asset_id).select().single());
    await anotarTraslado(req, antes, despues, "Cambio de obra del alquiler");
  }
  sendJson(res, 200, data);
}

async function handleReturnRental(req, res, id) {
  const r = await getRental(id);
  if (r.estado !== "activo") throw httpError(400, "Ese alquiler ya está cerrado.");
  const body = await readJson(req);
  const fecha = DATE(body.fecha_devolucion) || new Date().toISOString().slice(0, 10);
  if (fecha < r.fecha_inicio) throw httpError(400, "La devolución no puede ser antes del inicio.");
  const upd = { estado: "devuelto", fecha_devolucion: fecha };
  if (body.importe_final !== undefined && body.importe_final !== "") upd.importe_final = NUM(body.importe_final);
  if (body.numero_factura) upd.numero_factura = clip(body.numero_factura, 120);
  const data = await run(db().from("asset_rentals").update(upd).eq("id", id).select().single(), "el alquiler");
  const antes = await getAsset(r.asset_id);
  if (antes.tipo_adquisicion === "alquiler" && antes.estado !== "baja") {
    const despues = await run(db().from("assets").update({ estado: "devuelto_proveedor", motivo: clip(body.motivo, 500) || "Fin del alquiler", ...quien(req) }).eq("id", r.asset_id).select().single());
    await anotarTraslado(req, antes, despues, "Fin del alquiler");
  }
  sendJson(res, 200, data);
}

async function handleReplaceRental(req, res, id) {
  const r = await getRental(id);
  if (r.estado !== "activo") throw httpError(400, "Solo se puede sustituir un alquiler en curso.");
  const body = await readJson(req);
  const motivo = clip(body.motivo, 1000);
  if (!motivo) throw httpError(400, "Escribe el motivo (avería, no rinde...).");
  const viejo = await getAsset(r.asset_id);
  const hoy = DATE(body.fecha) || new Date().toISOString().slice(0, 10);
  const nuevoBody = body.nuevo && typeof body.nuevo === "object" ? body.nuevo : {};
  const nuevo = await insertAsset(req, {
    nombre: nuevoBody.nombre || viejo.nombre,
    marca: nuevoBody.marca ?? viejo.marca,
    modelo: nuevoBody.modelo ?? viejo.modelo,
    numero_serie: nuevoBody.numero_serie,
    codigo_barras: nuevoBody.codigo_barras,
    tipo: viejo.tipo === "vehiculo" ? "maquinaria_ligera" : viejo.tipo,
    tipo_adquisicion: "alquiler",
    supplier_id: viejo.supplier_id,
    proveedor_nombre: viejo.proveedor_nombre,
    estado: viejo.estado === "en_obra" ? "en_obra" : "en_almacen",
    obra_id: viejo.estado === "en_obra" ? viejo.obra_id : null,
    motivo: `Sustituye a ${viejo.codigo_interno}: ${motivo}`
  }, { sustituye_a: viejo.id });
  await run(db().from("assets").update({ estado: "devuelto_proveedor", motivo: `Sustituido por ${nuevo.codigo_interno}: ${motivo}`, ...quien(req) }).eq("id", viejo.id));
  await run(db().from("asset_rentals").update({ estado: "sustituido", fecha_devolucion: hoy < r.fecha_inicio ? r.fecha_inicio : hoy, motivo_sustitucion: motivo }).eq("id", id));
  const { id: _i, created_at: _c, updated_at: _u, estado: _e, fecha_devolucion: _f, importe_final: _imp, numero_factura: _n, motivo_sustitucion: _m, ...base } = r;
  const nuevoAlquiler = await run(db().from("asset_rentals").insert({
    ...base,
    asset_id: nuevo.id,
    fecha_inicio: hoy < r.fecha_inicio ? r.fecha_inicio : hoy,
    transporte: NUM(body.transporte) ?? 0,
    sustituye_a_rental_id: r.id,
    motivo_sustitucion: motivo,
    created_by: ID(req.user?.id)
  }).select().single(), "el alquiler");
  if (r.obra_id) {
    await eventoObra(req, r.obra_id, {
      tipo: "maquinaria",
      titulo: `Sustitución de máquina alquilada: ${viejo.nombre}`,
      detalle: `${motivo} · nueva: ${nuevo.codigo_interno}`,
      datos: { flota: true, rentalId: nuevoAlquiler.id, assetId: nuevo.id, reemplazaA: viejo.id }
    });
  }
  sendJson(res, 201, { alquiler: nuevoAlquiler, activo: nuevo });
}

// ---------------------------------------------------------------------------
// Alertas y avisos
// ---------------------------------------------------------------------------
async function getSettings() {
  const { data, error } = await db().from("fleet_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw dbError(error);
  return data || {};
}

/**
 * Crea los avisos pendientes (una vez por alerta y etapa) y los manda por push y,
 * si está activado en los ajustes, por correo y WhatsApp. Devuelve cuántos se crearon.
 */
export async function revisarAlertasFlota() {
  if (!isSupabaseReady()) return { creados: 0 };
  const { data, error } = await db().rpc("fleet_generar_avisos");
  if (error) {
    if (isMissing(error)) return { creados: 0, falta: MIGRATION };
    throw new Error(error.message);
  }
  const avisos = data || [];
  for (const n of avisos) sendPushForNotification(n);
  if (!avisos.length) return { creados: 0 };
  const ajustes = await getSettings().catch(() => ({}));
  const lineas = avisos.map((n) => `• ${n.title}: ${n.body}`);
  if (ajustes.enviar_email && isValidEmail(ajustes.email_avisos)) {
    const html = `<p>Avisos de inventario y flota:</p><ul>${avisos.map((n) => `<li><strong>${escapeHtml(n.title)}</strong><br>${escapeHtml(n.body)}</li>`).join("")}</ul>`;
    await sendEmail({ to: ajustes.email_avisos, subject: `ObraMaster: ${avisos.length} ${avisos.length === 1 ? "aviso" : "avisos"} de flota y maquinaria`, html, text: lineas.join("\n") })
      .catch((err) => console.warn("[flota] Correo de avisos:", err?.message || err));
  }
  if (ajustes.enviar_whatsapp && ajustes.whatsapp_telefono && isWhatsAppCloudConfigured()) {
    await sendWhatsAppCloud({ phone: ajustes.whatsapp_telefono, message: `ObraMaster · avisos de flota\n${lineas.join("\n")}`.slice(0, 3900) })
      .catch((err) => console.warn("[flota] WhatsApp de avisos:", err?.message || err));
  }
  return { creados: avisos.length };
}

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let timer = null;
/** Revisión automática: al minuto de arrancar y cada 6 horas. */
export function startFlotaAlertas() {
  if (timer || process.env.NODE_ENV === "test") return;
  const tick = () => revisarAlertasFlota()
    .then((r) => { if (r.creados) console.log(`[flota] ${r.creados} avisos nuevos de flota y maquinaria.`); })
    .catch((err) => console.warn("[flota] Revisión de alertas:", err?.message || err));
  setTimeout(tick, 60 * 1000).unref?.();
  timer = setInterval(tick, 6 * 3600 * 1000);
  timer.unref?.();
}

const SETTINGS_FIELDS = {
  avisos_km: INT, urgente_km: INT, alquiler_dias: INT, garantia_dias: INT,
  email_avisos: T(200), enviar_email: BOOL, whatsapp_telefono: T(30), enviar_whatsapp: BOOL
};

async function handleSaveSettings(req, res) {
  const body = await readJson(req);
  const row = pick(body, SETTINGS_FIELDS);
  if ("avisos_dias" in body) {
    const dias = [...new Set((Array.isArray(body.avisos_dias) ? body.avisos_dias : String(body.avisos_dias).split(","))
      .map((d) => Math.round(Number(d))).filter((d) => d > 0 && d <= 365))].sort((a, b) => b - a).slice(0, 6);
    if (!dias.length) throw httpError(400, "Indica al menos un aviso en días (por ejemplo 30, 15, 7).");
    row.avisos_dias = dias;
  }
  if (row.email_avisos && !isValidEmail(row.email_avisos)) throw httpError(400, "El correo de avisos no es válido.");
  for (const k of ["avisos_km", "urgente_km", "alquiler_dias", "garantia_dias"]) if (k in row && (row[k] === null || row[k] < 0)) delete row[k];
  const data = await run(db().from("fleet_settings").upsert({ id: true, ...row, updated_at: new Date().toISOString() }).select().single(), "los ajustes");
  sendJson(res, 200, data);
}

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------
async function subirArchivo(file, carpeta) {
  if (!file) return null;
  if (file.size > MAX_DOC_BYTES) throw httpError(413, "El archivo pasa de 15 MB.");
  const type = detectDocType(file.buffer);
  if (!type) throw httpError(400, "Solo se admiten PDF o fotos (JPG, PNG, WEBP).");
  const path = `${carpeta}/${crypto.randomUUID()}.${type.ext}`;
  const { error } = await db().storage.from(FLOTA_BUCKET).upload(path, file.buffer, { contentType: type.mime, upsert: false });
  if (error && /bucket not found|not found/i.test(String(error.message))) throw httpError(503, `Ejecuta ${MIGRATION} en Supabase > SQL Editor para poder guardar archivos.`);
  if (error) throw new Error(`No se pudo guardar el archivo: ${error.message}`);
  return { path, name: clip(file.originalname, 200) || `documento.${type.ext}`, mime: type.mime };
}

const CARPETAS = new Set(["activos", "vehiculos", "alquileres", "repostajes", "mantenimiento"]);

async function handleUpload(req, res, parseMultipart) {
  const { fields, files } = await readMultipart(req, parseMultipart);
  const carpeta = CARPETAS.has(fields.carpeta) ? fields.carpeta : "activos";
  const file = (files.archivo || [])[0];
  if (!file) throw httpError(400, "Adjunta el PDF o la foto.");
  sendJson(res, 201, await subirArchivo(file, carpeta));
}

async function handleOpenFile(res, path) {
  if (!SAFE_PATH.test(String(path || ""))) throw httpError(400, "Archivo no válido.");
  const { data, error } = await db().storage.from(FLOTA_BUCKET).createSignedUrl(path, 600);
  if (error) throw httpError(404, "No se encuentra el archivo.");
  sendJson(res, 200, { url: data.signedUrl });
}

// ---------------------------------------------------------------------------
// Operario: lo suyo y repostajes
// ---------------------------------------------------------------------------
async function handleMio(req, res, query) {
  // El administrador puede ver la vista previa de un operario (?obrero=ID).
  const esAdmin = !req.user || req.user.role === "admin";
  const obreroId = clip(esAdmin ? query.get("obrero") || req.user?.obrero_id : req.user?.obrero_id, 120);
  if (!obreroId) return sendJson(res, 200, { activos: [], vehiculos: [], listo: true });
  const { data: vehiculos, error } = await db().from("vehicles").select("*").eq("conductor_operario_id", obreroId);
  if (error) {
    if (isMissing(error)) return sendJson(res, 200, { activos: [], vehiculos: [], listo: false });
    throw dbError(error);
  }
  const vids = (vehiculos || []).map((v) => v.id);
  const [propios, enVehiculo, itv, seguros, repostajes] = await Promise.all([
    run(db().from("assets").select("id, codigo_interno, nombre, tipo, estado, obra_id, vehicle_id, marca, modelo, cantidad, unidad").eq("operario_id", obreroId).neq("estado", "baja")),
    vids.length ? run(db().from("assets").select("id, codigo_interno, nombre, tipo, estado, vehicle_id, cantidad, unidad").in("vehicle_id", vids).neq("estado", "baja")) : [],
    vids.length ? run(db().from("vehicle_inspections").select("vehicle_id, proxima_itv, resultado").in("vehicle_id", vids).order("proxima_itv", { ascending: false })) : [],
    vids.length ? run(db().from("vehicle_insurances").select("vehicle_id, aseguradora, numero_poliza, telefono_asistencia, fecha_vencimiento").in("vehicle_id", vids).eq("activa", true).order("fecha_vencimiento", { ascending: false })) : [],
    run(db().from("vehicle_fuel_logs").select("id, vehicle_id, fecha, km, litros, importe").eq("operario_id", obreroId).order("fecha", { ascending: false }).limit(10))
  ]);
  sendJson(res, 200, {
    listo: true,
    vehiculos: (vehiculos || []).map((v) => ({
      id: v.id, matricula: v.matricula, marca: v.marca, modelo: v.modelo, km_actual: v.km_actual, combustible: v.combustible,
      itv: itv.find((i) => i.vehicle_id === v.id) || null,
      seguro: seguros.find((s) => s.vehicle_id === v.id) || null,
      dotacion: enVehiculo.filter((a) => a.vehicle_id === v.id)
    })),
    activos: propios,
    repostajes
  });
}

async function handleRepostaje(req, res, parseMultipart) {
  const isMultipart = String(req.headers["content-type"] || "").includes("multipart/form-data");
  const { fields, files } = isMultipart ? await readMultipart(req, parseMultipart) : { fields: await readJson(req), files: {} };
  const vehicleId = ID(fields.vehicle_id);
  if (!vehicleId) throw httpError(400, "Elige el vehículo.");
  const veh = await run(db().from("vehicles").select("id, matricula, km_actual, conductor_operario_id").eq("id", vehicleId).maybeSingle());
  if (!veh) throw httpError(404, "Vehículo no encontrado.");
  const esAdmin = req.user?.role === "admin" || !req.user;
  const obreroId = clip(req.user?.obrero_id, 120) || null;
  if (!esAdmin && (!obreroId || veh.conductor_operario_id !== obreroId)) throw httpError(403, "Solo puedes apuntar repostajes de tu vehículo.");
  // El operario solo puede imputar a una obra que exista.
  if (fields.obra_id && !(await getObra(clip(fields.obra_id, 120)).catch(() => null))) fields.obra_id = "";
  const row = pick(fields, REGISTROS.repostaje.fields, { required: ["km", "litros", "importe"] });
  if (row.km < Number(veh.km_actual) - 50000) throw httpError(400, "Los km parecen equivocados: revisa el cuentakilómetros.");
  const ticket = await subirArchivo((files.ticket || [])[0], "repostajes");
  const data = await run(db().from("vehicle_fuel_logs").insert({
    ...row,
    vehicle_id: vehicleId,
    operario_id: esAdmin ? row.operario_id || null : obreroId,
    operario_nombre: esAdmin ? row.operario_nombre || null : clip(req.user?.full_name, 200),
    ticket_path: ticket?.path || row.ticket_path || null,
    created_by: ID(req.user?.id)
  }).select().single(), "el repostaje");
  if (data.obra_id) await eventoObra(req, data.obra_id, { tipo: "maquinaria", titulo: `Repostaje ${veh.matricula}: ${data.litros} l (${Number(data.importe).toFixed(2)} €)`, datos: { flota: true, fuelId: data.id } });
  sendJson(res, 201, data);
}

// ---------------------------------------------------------------------------
// Enrutado
// ---------------------------------------------------------------------------
export const FLOTA_WORKER_PATHS = ["/api/flota/mio", "/api/flota/repostaje"];

export async function handleFlotaRoutes(req, res, pathname, query, { parseMultipart }) {
  if (pathname !== "/api/flota" && !pathname.startsWith("/api/flota/")) return false;
  const M = req.method;
  const routes = [
    [/^\/api\/flota$/, { GET: () => handleResumen(res) }],
    [/^\/api\/flota\/mio$/, { GET: () => handleMio(req, res, query) }, true],
    [/^\/api\/flota\/repostaje$/, { POST: () => handleRepostaje(req, res, parseMultipart) }, true],
    [/^\/api\/flota\/activos$/, { POST: () => handleCreateAsset(req, res) }],
    [new RegExp(`^/api/flota/activos/(${UUID})$`), { GET: (id) => handleFicha(res, id), PATCH: (id) => handleUpdateAsset(req, res, id) }],
    [new RegExp(`^/api/flota/activos/(${UUID})/mover$`), { POST: (id) => handleMove(req, res, id) }],
    [new RegExp(`^/api/flota/activos/(${UUID})/stock$`), { POST: (id) => handleStock(req, res, id) }],
    [new RegExp(`^/api/flota/activos/(${UUID})/sustituir$`), { POST: (id) => handleSustituir(req, res, id) }],
    [/^\/api\/flota\/vehiculos$/, { POST: () => handleCreateVehicle(req, res) }],
    [new RegExp(`^/api/flota/vehiculos/(${UUID})$`), { PATCH: (id) => handleUpdateVehicle(req, res, id) }],
    [/^\/api\/flota\/registros\/([a-z]+)$/, { POST: (tipo) => handleCreateRegistro(req, res, tipo) }],
    [new RegExp(`^/api/flota/registros/([a-z]+)/(${UUID})$`), { PATCH: (tipo, id) => handleUpdateRegistro(req, res, tipo, id), DELETE: (tipo, id) => handleDeleteRegistro(res, tipo, id) }],
    [/^\/api\/flota\/alquileres$/, { POST: () => handleCreateRental(req, res) }],
    [new RegExp(`^/api/flota/alquileres/(${UUID})$`), { PATCH: (id) => handleUpdateRental(req, res, id) }],
    [new RegExp(`^/api/flota/alquileres/(${UUID})/devolver$`), { POST: (id) => handleReturnRental(req, res, id) }],
    [new RegExp(`^/api/flota/alquileres/(${UUID})/sustituir$`), { POST: (id) => handleReplaceRental(req, res, id) }],
    [/^\/api\/flota\/alertas$/, { GET: async () => sendJson(res, 200, await run(db().from("fleet_alertas").select("*"))) }],
    [/^\/api\/flota\/alertas\/revisar$/, { POST: async () => sendJson(res, 200, await revisarAlertasFlota()) }],
    [/^\/api\/flota\/ajustes$/, { GET: async () => sendJson(res, 200, await getSettings()), PUT: () => handleSaveSettings(req, res) }],
    [/^\/api\/flota\/costes$/, {
      GET: async () => {
        const obra = clip(query.get("obra"), 120);
        if (!obra) throw httpError(400, "Falta la obra.");
        const { data, error } = await db().from("fleet_costes").select("*").eq("obra_id", obra).order("fecha", { ascending: false });
        if (error && isMissing(error)) return sendJson(res, 200, []);
        if (error) throw dbError(error);
        sendJson(res, 200, data || []);
      }
    }],
    [/^\/api\/flota\/archivo$/, { POST: () => handleUpload(req, res, parseMultipart), GET: () => handleOpenFile(res, query.get("path")) }]
  ];
  for (const [re, methods, worker] of routes) {
    const match = pathname.match(re);
    if (!match) continue;
    try {
      if (req.user && req.user.role !== "admin" && !worker) throw httpError(403, "No tienes permisos para esta acción.");
      if (!isSupabaseReady()) throw httpError(503, "Inventario y flota necesitan Supabase configurado en el servidor.");
      const handler = methods[M];
      if (!handler) throw httpError(405, "Método no permitido.");
      await handler(...match.slice(1));
    } catch (err) {
      if (!err?.status) console.error("[flota] Error en", pathname, err?.message || err);
      if (!res.headersSent) sendJson(res, err?.status || 500, { error: err?.status ? err.message : "Error interno del servidor." });
    }
    return true;
  }
  sendJson(res, 404, { error: "Ruta no encontrada." });
  return true;
}
