/**
 * ObraMaster - Sincronización de datos con Supabase
 *
 * Cada "colección" de la app (obras, presupuestos, facturas, empleados...) se
 * guarda como registros JSON en la tabla `app_records` de Supabase:
 *   collection = nombre de la colección · id = id del registro · data = el registro
 *
 * Qué hace el hook `useCollectionSync` por cada colección:
 *   1. Al iniciar sesión, descarga los datos de Supabase y los pone en la app.
 *   2. Si Supabase está vacío y el administrador tiene datos guardados en este
 *      navegador (versión antigua de la app), los sube una sola vez.
 *   3. Cada vez que cambia algo, sube solo lo modificado (con una pequeña espera).
 *   4. Escucha los cambios de otros dispositivos en tiempo real.
 *
 * Los permisos reales los aplica Supabase (RLS): un obrero no puede leer ni
 * escribir facturas, presupuestos, empleados, etc. aunque lo intente.
 */

import { useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const TABLE = 'app_records';
const SINGLE_ID = 'main';
const PAGE_SIZE = 1000;
const WRITE_CHUNK = 50;
const PUSH_DELAY_MS = 700;
const MAX_RECORD_BYTES = 4 * 1024 * 1024;

/**
 * Qué puede hacer un obrero con cada colección (debe coincidir con las
 * políticas de `supabase_migration_seguridad.sql`).
 *   'rw'     leer y modificar
 *   'r'      solo leer
 *   'insert' solo crear registros nuevos (no leer)
 *   (ausente) sin acceso
 */
export const WORKER_ACCESS = {
  obras: 'rw',
  obreros: 'r',
  avisos_tecnicos: 'rw',
  mensajes_inbox: 'insert',
  audit_logs: 'insert'
};

/** JSON con las claves ordenadas, para comparar datos sin que importe el orden de las claves. */
export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function toRecordMap(collection, value, single) {
  const map = new Map();
  if (single) {
    if (value && typeof value === 'object') map.set(SINGLE_ID, { id: SINGLE_ID, json: stableStringify(value), data: value });
    return map;
  }
  (Array.isArray(value) ? value : []).forEach((item) => {
    if (!item || item.id === undefined || item.id === null) return;
    map.set(String(item.id), { id: String(item.id), json: stableStringify(item), data: item });
  });
  return map;
}

/**
 * Postgres (jsonb) rechaza el carácter nulo \u0000 y los "surrogates" sueltos, que pueden colarse
 * al extraer texto de un PDF. Una sola fila así hace fallar todo el guardado, así que se limpian antes.
 */
function toDbSafe(data) {
  const json = JSON.stringify(data)
    .replace(/(?<!\\)\\u0000/g, '')
    .replace(/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f][0-9a-f]{2})/gi, '')
    .replace(/(?<!\\ud[89ab][0-9a-f]{2})\\ud[c-f][0-9a-f]{2}/gi, '');
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// Copia local de cambios pendientes: lo que aún no se ha confirmado en Supabase se guarda en el
// navegador, para que una recarga (p. ej. tras un despliegue) o un fallo de red no lo pierda.
// ---------------------------------------------------------------------------
const pendingKey = (userId, collection) => `obramaster_pending_${userId}_${collection}`;

function readPending(userId, collection) {
  try {
    const raw = localStorage.getItem(pendingKey(userId, collection));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePending(userId, collection, pending) {
  try {
    if (Object.keys(pending).length === 0) localStorage.removeItem(pendingKey(userId, collection));
    else localStorage.setItem(pendingKey(userId, collection), JSON.stringify(pending));
  } catch (err) {
    console.warn(`[Sync] No se pudo guardar la copia local de "${collection}":`, err?.message || err);
  }
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function fetchAllRows(collection) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, data')
      .eq('collection', collection)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Canal de tiempo real compartido (uno solo para todas las colecciones)
// ---------------------------------------------------------------------------
const realtimeHandlers = new Set();
let realtimeChannel = null;

function subscribeRealtime(handler) {
  realtimeHandlers.add(handler);

  if (!realtimeChannel) {
    realtimeChannel = supabase
      .channel('obramaster-app-records')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
        realtimeHandlers.forEach((fn) => {
          try {
            fn(payload);
          } catch (err) {
            console.error('[Sync] Error aplicando cambio en tiempo real', err);
          }
        });
      })
      .subscribe();
  }

  return () => {
    realtimeHandlers.delete(handler);
    if (realtimeHandlers.size === 0 && realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------
/**
 * @param {object}   opts
 * @param {string}   opts.collection    Nombre de la colección en Supabase.
 * @param {*}        opts.value         Estado actual (array de registros con `id`, o un objeto si `single`).
 * @param {Function} opts.setValue      Setter del estado.
 * @param {string|null} opts.userId     Id del usuario con sesión (null = sin sesión).
 * @param {string|null} opts.role       'admin' | 'obrero' | null.
 * @param {boolean}  [opts.single]      true si la colección es un único objeto (ej.: datos de empresa).
 * @param {boolean}  opts.hadLocalData  true si este navegador tenía datos guardados de la versión antigua.
 * @param {*}        opts.emptyValue    Valor al cerrar sesión / si no hay datos.
 * @param {Function} [opts.notify]      (mensaje, tipo) => void
 */
export function useCollectionSync({
  collection,
  value,
  setValue,
  userId,
  role,
  single = false,
  hadLocalData = false,
  emptyValue,
  notify
}) {
  const valueRef = useRef(value);
  const baselineRef = useRef(new Map()); // id -> json que se sabe que está en Supabase
  const loadedRef = useRef(false);
  const timerRef = useRef(null);
  const retryRef = useRef({ attempts: 0, timer: null });
  const lastErrorNoticeRef = useRef(0);
  const oversizedNoticeRef = useRef(new Set()); // ids ya avisados por superar el tamaño máximo
  const sentRef = useRef(new Map()); // id -> [{ json, at }] lo que acabamos de enviar (para ignorar su eco)
  const pushRef = useRef(() => {});
  const keepPending = !single; // solo colecciones de registros (obras, presupuestos...)

  // Guarda en el navegador los registros que todavía no coinciden con lo que hay en Supabase.
  const savePendingCopy = () => {
    if (!keepPending || !userId || !loadedRef.current || role !== 'admin') return;
    const pending = {};
    toRecordMap(collection, valueRef.current, single).forEach((record, id) => {
      if (baselineRef.current.get(id) !== record.json) pending[id] = record.data;
    });
    writePending(userId, collection, pending);
  };

  valueRef.current = value;

  const access = role === 'admin' ? 'rw' : role === 'obrero' ? WORKER_ACCESS[collection] || null : null;
  const canRead = access === 'rw' || access === 'r';
  const canUpdate = access === 'rw';
  const canInsert = access === 'rw' || access === 'insert';

  // ---- Subida de cambios --------------------------------------------------
  pushRef.current = async () => {
    if (!loadedRef.current || !userId || !canInsert) return;

    const baseline = baselineRef.current;
    const current = toRecordMap(collection, valueRef.current, single);

    const toWrite = [];
    const oversized = [];
    current.forEach((record, id) => {
      const known = baseline.get(id);
      if (known === record.json) return;
      if (known !== undefined && !canUpdate) return; // un obrero no modifica registros de solo-lectura
      if (record.json.length > MAX_RECORD_BYTES) {
        console.warn(`[Sync] "${collection}/${id}" es demasiado grande (${record.json.length} bytes) y no se sube.`);
        oversized.push(id);
        return;
      }
      toWrite.push(record);
    });

    const toDelete = [];
    if (canUpdate && role === 'admin') {
      baseline.forEach((_json, id) => {
        if (!current.has(id)) toDelete.push(id);
      });
    }

    if (toWrite.length === 0 && toDelete.length === 0) return;

    try {
      const now = Date.now();
      toWrite.forEach((record) => {
        const recent = (sentRef.current.get(record.id) || []).filter((entry) => now - entry.at < 20000);
        recent.push({ json: record.json, at: now });
        sentRef.current.set(record.id, recent);
      });

      const writeRows = (group) => {
        const rows = group.map((record) => ({ collection, id: record.id, data: toDbSafe(record.data) }));
        return canUpdate
          ? supabase.from(TABLE).upsert(rows, { onConflict: 'collection,id' })
          : supabase.from(TABLE).insert(rows);
      };

      let firstError = null;
      for (const group of chunk(toWrite, WRITE_CHUNK)) {
        const { error } = await writeRows(group);
        if (!error) {
          group.forEach((record) => baseline.set(record.id, record.json));
          continue;
        }
        // Un registro defectuoso no debe impedir guardar el resto: se reintenta uno a uno.
        for (const record of group) {
          const single = await writeRows([record]);
          if (single.error) firstError = firstError || new Error(`${record.id}: ${single.error.message}`);
          else baseline.set(record.id, record.json);
        }
      }

      const newOversized = oversized.filter((id) => !oversizedNoticeRef.current.has(id));
      newOversized.forEach((id) => oversizedNoticeRef.current.add(id));
      if (newOversized.length && notify) {
        notify(`"${collection}": ${oversized.length} registro(s) superan 4 MB (fotos o documentos incrustados) y no se guardan en la nube.`, 'error');
      }
      if (firstError) throw firstError;

      for (const ids of chunk(toDelete, WRITE_CHUNK)) {
        const { error } = await supabase.from(TABLE).delete().eq('collection', collection).in('id', ids);
        if (error) throw error;
        ids.forEach((id) => baseline.delete(id));
      }

      retryRef.current.attempts = 0;
      savePendingCopy();
    } catch (err) {
      savePendingCopy();
      console.error(`[Sync] No se pudo guardar "${collection}" en Supabase:`, err?.message || err);
      if (notify && Date.now() - lastErrorNoticeRef.current > 60000) {
        lastErrorNoticeRef.current = Date.now();
        notify(`No se pudieron guardar los últimos cambios de "${collection}" en la nube (${err?.message || 'error desconocido'}). Se reintentará automáticamente.`, 'error');
      }
      const attempts = Math.min(retryRef.current.attempts + 1, 6);
      retryRef.current.attempts = attempts;
      clearTimeout(retryRef.current.timer);
      retryRef.current.timer = setTimeout(() => pushRef.current(), Math.min(60000, 2000 * 2 ** attempts));
    }
  };

  // ---- Carga inicial al iniciar / cerrar sesión ---------------------------
  useEffect(() => {
    let cancelled = false;
    loadedRef.current = false;
    baselineRef.current = new Map();
    clearTimeout(timerRef.current);
    clearTimeout(retryRef.current.timer);

    if (!userId || !role) return undefined;

    (async () => {
      if (!canRead) {
        // Sin permiso de lectura: este usuario no debe ver datos de esta colección.
        if (!cancelled) {
          if (!single) setValue(emptyValue);
          loadedRef.current = true;
        }
        return;
      }

      try {
        const rows = await fetchAllRows(collection);
        if (cancelled) return;

        // Registros que este navegador no llegó a guardar en la nube (se vuelven a subir).
        const pending = keepPending && role === 'admin' ? readPending(userId, collection) : {};
        const remoteMap = toRecordMap(collection, rows.map((row) => row.data), single);
        const recovered = Object.entries(pending).filter(([id, data]) => {
          const remote = remoteMap.get(id);
          return data && (!remote || remote.json !== stableStringify(data));
        });

        if (rows.length > 0 || recovered.length > 0) {
          const records = rows.map((row) => row.data);
          baselineRef.current = toRecordMap(collection, single ? records[0] : records, single);
          if (single) {
            setValue(records[0]);
          } else {
            const recoveredIds = new Set(recovered.map(([id]) => id));
            const merged = [
              ...recovered.filter(([id]) => !remoteMap.has(id)).map(([, data]) => data),
              ...records.map((rec) => (recoveredIds.has(String(rec?.id)) ? pending[String(rec.id)] : rec))
            ];
            valueRef.current = merged;
            setValue(merged);
            if (recovered.length && notify) {
              notify(`Recuperados ${recovered.length} cambio(s) de "${collection}" que no se habían guardado en la nube. Guardando...`);
            }
          }
        } else if (role === 'admin' && hadLocalData) {
          // Supabase vacío + datos locales de la versión antigua: se suben una sola vez.
          const local = toRecordMap(collection, valueRef.current, single);
          const toSeed = [...local.values()].filter((record) => record.json.length <= MAX_RECORD_BYTES);
          for (const group of chunk(toSeed, WRITE_CHUNK)) {
            const { error } = await supabase
              .from(TABLE)
              .upsert(group.map((record) => ({ collection, id: record.id, data: toDbSafe(record.data) })), { onConflict: 'collection,id' });
            if (error) throw error;
            group.forEach((record) => baselineRef.current.set(record.id, record.json));
          }
          if (toSeed.length > 0 && notify) {
            notify(`Datos de "${collection}" de este navegador subidos a la nube (${toSeed.length}).`);
          }
        } else if (!single) {
          setValue(emptyValue);
        }

        loadedRef.current = true;
        pushRef.current();
      } catch (err) {
        console.error(`[Sync] No se pudo cargar "${collection}" desde Supabase:`, err?.message || err);
        if (!cancelled && notify) {
          notify(`No se pudieron cargar los datos de "${collection}" desde la nube.`, 'error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role]);

  // Al cerrar sesión se vacía lo que había en pantalla (equipo compartido).
  useEffect(() => {
    if (!userId && !single) setValue(emptyValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ---- Subida con espera cuando cambia el estado --------------------------
  useEffect(() => {
    if (!loadedRef.current || !userId) return undefined;
    clearTimeout(timerRef.current);
    savePendingCopy();
    timerRef.current = setTimeout(() => pushRef.current(), PUSH_DELAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [value, userId]);

  // Reintento al recuperar la conexión
  useEffect(() => {
    const onOnline = () => pushRef.current();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // ---- Cambios de otros dispositivos en tiempo real -----------------------
  useEffect(() => {
    if (!userId || !canRead) return undefined;

    const handler = (payload) => {
      if (!loadedRef.current) return;
      const record = payload.eventType === 'DELETE' ? payload.old : payload.new;
      if (!record || record.collection !== collection) return;

      const id = String(record.id);

      if (payload.eventType === 'DELETE') {
        if (single || !baselineRef.current.has(id)) return;
        baselineRef.current.delete(id);
        setValue((prev) => (Array.isArray(prev) ? prev.filter((item) => String(item?.id) !== id) : prev));
        return;
      }

      const data = record.data;
      if (data === undefined || data === null) return;
      const json = stableStringify(data);
      if (baselineRef.current.get(id) === json) return; // ya lo tenemos

      // Eco de un cambio que acabamos de enviar nosotros: se ignora para no pisar lo que se esté escribiendo.
      const recentlySent = (sentRef.current.get(id) || []).filter((entry) => Date.now() - entry.at < 20000);
      if (recentlySent.some((entry) => entry.json === json)) return;

      baselineRef.current.set(id, json);
      if (single) {
        setValue(data);
        return;
      }
      setValue((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const index = list.findIndex((item) => String(item?.id) === id);
        if (index === -1) return [data, ...list];
        const next = [...list];
        next[index] = data;
        return next;
      });
    };

    return subscribeRealtime(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role, collection]);
}
