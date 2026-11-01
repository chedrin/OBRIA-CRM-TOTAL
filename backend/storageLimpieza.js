/**
 * ObraMaster - Limpieza de Storage (archivos de obra)
 *
 * Supabase no deja borrar objetos de Storage con SQL, así que los triggers de
 * supabase_schema_archivos_obra.sql apuntan en `storage_borrados` las rutas de los
 * registros borrados (o de las obras borradas). Aquí, con la clave de servicio:
 *   1. Se borran los registros que llevan más de 24 h "pendiente" (subidas a medias),
 *      lo que mete sus rutas en la cola.
 *   2. Se vacía la cola con la API de Storage (lotes de 100 rutas por bucket).
 * Se ejecuta al arrancar el servidor (a los 90 s) y cada hora.
 */

import { getAdminClient, isSupabaseReady } from "./authRoutes.js";

const LOTE = 100;
const HORAS_PENDIENTE = 24;
let timer = null;
let avisadoError = false;

const tablaNoExiste = (error) => /does not exist|could not find|schema cache|PGRST205|42P01/i.test(`${error?.code || ""} ${error?.message || ""}`);

/**
 * @param {{ client?: any, ahora?: Date, horasPendiente?: number }} [opts]
 * @returns {Promise<{ pendientes: number, borrados: number, fallidos: number }>}
 */
export async function limpiarStorage({ client = getAdminClient(), ahora = new Date(), horasPendiente = HORAS_PENDIENTE } = {}) {
  const res = { pendientes: 0, borrados: 0, fallidos: 0 };

  const limite = new Date(ahora.getTime() - horasPendiente * 3600 * 1000).toISOString();
  const viejos = await client.from("obra_archivos").delete().eq("estado", "pendiente").lt("created_at", limite).select("id");
  if (viejos.error) {
    if (tablaNoExiste(viejos.error)) return res;
    throw new Error(viejos.error.message);
  }
  res.pendientes = viejos.data?.length || 0;

  const cola = await client.from("storage_borrados").select("id, bucket_id, path, intentos").order("id").limit(500);
  if (cola.error) {
    if (tablaNoExiste(cola.error)) return res;
    throw new Error(cola.error.message);
  }

  const porBucket = new Map();
  for (const fila of cola.data || []) {
    if (!porBucket.has(fila.bucket_id)) porBucket.set(fila.bucket_id, []);
    porBucket.get(fila.bucket_id).push(fila);
  }

  for (const [bucket, filas] of porBucket) {
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      // Quitar una ruta que ya no existe no da error: la cola admite repetidos.
      const { error } = await client.storage.from(bucket).remove(lote.map((f) => f.path));
      if (error) {
        res.fallidos += lote.length;
        for (const f of lote) {
          await client.from("storage_borrados")
            .update({ intentos: (f.intentos || 0) + 1, ultimo_error: String(error.message || error).slice(0, 500) })
            .eq("id", f.id);
        }
        continue;
      }
      const ids = lote.map((f) => f.id);
      const del = await client.from("storage_borrados").delete().in("id", ids);
      if (del.error) throw new Error(del.error.message);
      res.borrados += lote.length;
    }
  }
  return res;
}

export function startLimpiezaStorage() {
  if (timer || process.env.NODE_ENV === "test") return;
  const tick = () => {
    if (!isSupabaseReady()) return;
    limpiarStorage()
      .then((r) => {
        if (r.borrados || r.pendientes || r.fallidos) {
          console.log(`[storage] ${r.borrados} archivos borrados de Storage, ${r.pendientes} subidas a medias anuladas, ${r.fallidos} pendientes de reintento.`);
        }
      })
      .catch((err) => {
        if (!avisadoError) console.warn("[storage] Limpieza de archivos:", err?.message || err);
        avisadoError = true;
      });
  };
  setTimeout(tick, 90 * 1000).unref?.();
  timer = setInterval(tick, 3600 * 1000);
  timer.unref?.();
}
