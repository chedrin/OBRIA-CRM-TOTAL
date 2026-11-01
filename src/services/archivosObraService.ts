/**
 * ObraMaster - Archivos de obra en Supabase Storage (subida, enlaces firmados y borrado).
 *
 * El binario va directo del navegador a Storage con la sesión del usuario (las políticas
 * RLS de supabase_schema_archivos_obra.sql deciden quién sube y quién ve); PostgreSQL
 * solo guarda los metadatos en `obra_archivos`. Nada pasa por el servidor de Render.
 *
 * Subida en dos fases (para que nunca quede un archivo sin registro ni al revés):
 *   1. Se reserva la ruta: fila `pendiente` en obra_archivos (Storage solo deja subir ahí).
 *   2. Se sube el archivo: una petición hasta 6 MB; por encima, subida reanudable (TUS)
 *      en trozos de 6 MB con reintentos, para LiDAR y planos pesados.
 *   3. Se marca `subido`: la base de datos comprueba que el archivo está en Storage y
 *      copia de allí el tamaño y el tipo reales.
 * Si algo falla se deshace; lo que quede a medias lo limpia el servidor a las 24 h.
 */
import * as tus from 'tus-js-client';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabaseClient';
import {
  CATEGORIAS_ARCHIVO, TROZO_TUS, rutaArchivo, rutaMiniatura, tipoArchivo, usarSubidaReanudable
} from '../utils/archivosObra.js';

export type CategoriaArchivo = 'fotos' | 'planos' | 'lidar' | 'documentacion' | 'presupuestos' | 'facturas' | 'otros';
export type BucketArchivos = 'obra-archivos' | 'obra-lidar';

export interface ArchivoObra {
  id: string;
  obra_id: string;
  categoria: CategoriaArchivo;
  bucket_id: BucketArchivos;
  storage_path: string;
  miniatura_path: string | null;
  nombre: string;
  descripcion: string | null;
  mime_type: string;
  size_bytes: number;
  estado: 'pendiente' | 'subido';
  subido_por: string | null;
  created_at: string;
  subido_at: string | null;
}

export interface OpcionesSubida {
  obraId: string;
  categoria: CategoriaArchivo;
  file: File;
  descripcion?: string;
  /** Progreso de 0 a 1. */
  onProgress?: (fraccion: number) => void;
  /** Para cancelar la subida (botón "Cancelar"). */
  signal?: AbortSignal;
}

const TABLA = 'obra_archivos';
const CACHE_ANIO = '31536000'; // las rutas no se reutilizan nunca: el navegador puede guardarlas un año
const MINIATURA_LADO = 320;
const SQL = 'supabase_schema_archivos_obra.sql';

/** Error con mensaje para el usuario (en castellano). */
export class ErrorArchivos extends Error {
  constructor(mensaje: string, readonly causa?: unknown) {
    super(mensaje);
    this.name = 'ErrorArchivos';
  }
}

function traducir(error: unknown, contexto: string): ErrorArchivos {
  const e = error as { message?: string; code?: string; statusCode?: string | number } | null;
  const msg = `${e?.code || ''} ${e?.statusCode || ''} ${e?.message || error || ''}`;
  if (/PGRST205|42P01|does not exist|schema cache|bucket not found/i.test(msg)) {
    return new ErrorArchivos(`Falta preparar Supabase: ejecuta ${SQL} en Supabase > SQL Editor.`, error);
  }
  if (/row-level security|violates|permission|403|unauthorized/i.test(msg)) {
    return new ErrorArchivos('No tienes permiso para los archivos de esta obra.', error);
  }
  if (/payload too large|413|maximum allowed size|exceeded/i.test(msg)) {
    return new ErrorArchivos('El archivo supera el tamaño máximo que admite Supabase (revisa Storage > Settings).', error);
  }
  if (/mime type|invalid_mime|415/i.test(msg)) {
    return new ErrorArchivos('Supabase no admite ese tipo de archivo en este bucket.', error);
  }
  if (/abort/i.test(msg)) return new ErrorArchivos('Subida cancelada.', error);
  return new ErrorArchivos(`${contexto}: ${e?.message || 'error desconocido'}`, error);
}

async function tokenSesion(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ErrorArchivos('Tu sesión ha caducado: vuelve a entrar para subir archivos.');
  return token;
}

/** Host directo de Storage (más rápido para archivos grandes, según Supabase). */
function endpointTus(): string {
  const directo = supabaseUrl.replace(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i, 'https://$1.storage.supabase.co');
  return `${directo.replace(/\/$/, '')}/storage/v1/upload/resumable`;
}

/** Miniatura JPEG para las fotos (la lista carga 30 KB por foto en lugar de 5 MB). */
async function crearMiniatura(file: File): Promise<Blob | null> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || typeof createImageBitmap !== 'function') return null;
  try {
    const bmp = await createImageBitmap(file);
    const escala = Math.min(1, MINIATURA_LADO / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * escala));
    canvas.height = Math.max(1, Math.round(bmp.height * escala));
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.75));
  } catch {
    return null;
  }
}

function subirReanudable(bucket: string, path: string, file: File, mime: string, onProgress?: (f: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const subida = new tus.Upload(file, {
      endpoint: endpointTus(),
      retryDelays: [0, 3000, 5000, 10000, 20000],
      chunkSize: TROZO_TUS, // Supabase exige trozos de 6 MB
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: { apikey: supabaseAnonKey, 'x-upsert': 'false' },
      metadata: { bucketName: bucket, objectName: path, contentType: mime, cacheControl: CACHE_ANIO },
      // Subidas largas: la sesión puede renovarse a mitad; cada trozo lleva el token vigente.
      onBeforeRequest: async (req) => { req.setHeader('authorization', `Bearer ${await tokenSesion()}`); },
      onProgress: (subidos, total) => onProgress?.(total ? subidos / total : 0),
      onError: (err) => reject(err),
      onSuccess: () => resolve()
    });
    if (signal) {
      if (signal.aborted) return reject(new Error('abort'));
      signal.addEventListener('abort', () => { subida.abort(true).finally(() => reject(new Error('abort'))); }, { once: true });
    }
    // Si se cortó la conexión con esta misma ruta, continúa donde se quedó.
    subida.findPreviousUploads().then((previas) => {
      if (previas.length) subida.resumeFromPreviousUpload(previas[0]);
      subida.start();
    }).catch(reject);
  });
}

/** Sube un archivo de obra y devuelve su registro ya `subido`. */
export async function subirArchivoObra({ obraId, categoria, file, descripcion, onProgress, signal }: OpcionesSubida): Promise<ArchivoObra> {
  const { ext, mime, bucket } = tipoArchivo(file, categoria) as { ext: string; mime: string; bucket: BucketArchivos };
  const id = crypto.randomUUID();
  const storagePath: string = rutaArchivo({ obraId, categoria, id, nombre: file.name, ext });
  const miniatura = await crearMiniatura(file);
  const miniaturaPath: string | null = miniatura ? rutaMiniatura(obraId, id) : null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new ErrorArchivos('Tu sesión ha caducado: vuelve a entrar para subir archivos.');

  // 1. Reservar la ruta.
  const reserva = await supabase.from(TABLA).insert({
    id, obra_id: obraId, categoria, bucket_id: bucket, storage_path: storagePath, miniatura_path: miniaturaPath,
    nombre: file.name.slice(0, 255), descripcion: descripcion?.trim() || null, mime_type: mime, size_bytes: file.size,
    subido_por: session.user.id
  });
  if (reserva.error) throw traducir(reserva.error, 'No se pudo reservar el archivo');

  const storage = supabase.storage.from(bucket);
  let miniaturaOk = false;
  try {
    // 2. Subir (miniatura primero: es pequeña y así la lista ya la tiene).
    if (miniatura && miniaturaPath) {
      const r = await storage.upload(miniaturaPath, miniatura, { contentType: 'image/jpeg', cacheControl: CACHE_ANIO, upsert: false });
      miniaturaOk = !r.error;
    }
    onProgress?.(0);
    if (usarSubidaReanudable(file.size)) {
      await subirReanudable(bucket, storagePath, file, mime, onProgress, signal);
    } else {
      if (signal?.aborted) throw new Error('abort');
      const r = await storage.upload(storagePath, file, { contentType: mime, cacheControl: CACHE_ANIO, upsert: false });
      if (r.error) throw r.error;
    }
    onProgress?.(1);

    // 3. Confirmar (la base de datos comprueba que está en Storage).
    const { data, error } = await supabase.from(TABLA)
      .update({ estado: 'subido', ...(miniaturaPath && !miniaturaOk ? { miniatura_path: null } : {}) })
      .eq('id', id).select().single();
    if (error) throw error;
    return data as ArchivoObra;
  } catch (error) {
    // Deshacer: primero Storage (la política exige ver el registro), luego el registro.
    await storage.remove([storagePath, ...(miniaturaPath ? [miniaturaPath] : [])]).catch(() => undefined);
    await supabase.from(TABLA).delete().eq('id', id);
    throw error instanceof ErrorArchivos ? error : traducir(error, `No se pudo subir «${file.name}»`);
  }
}

/** Archivos ya subidos de una obra (los pendientes no se muestran). */
export async function listarArchivosObra(obraId: string, categoria?: CategoriaArchivo): Promise<ArchivoObra[]> {
  let q = supabase.from(TABLA).select('*').eq('obra_id', obraId).eq('estado', 'subido').order('created_at', { ascending: false }).limit(500);
  if (categoria) q = q.eq('categoria', categoria);
  const { data, error } = await q;
  if (error) throw traducir(error, 'No se pudieron cargar los archivos');
  return (data || []) as ArchivoObra[];
}

// Caché de enlaces firmados: se reutilizan hasta 5 minutos antes de caducar.
const cacheUrls = new Map<string, { url: string; caduca: number }>();

/**
 * Enlaces firmados de varias rutas de un bucket en una sola petición (miniaturas de la lista).
 * Devuelve { ruta: url }.
 */
export async function urlsFirmadas(bucket: BucketArchivos, rutas: string[], segundos = 3600): Promise<Record<string, string>> {
  const ahora = Date.now();
  const salida: Record<string, string> = {};
  const faltan: string[] = [];
  for (const ruta of new Set(rutas)) {
    const c = cacheUrls.get(`${bucket}/${ruta}`);
    if (c && c.caduca - 300_000 > ahora) salida[ruta] = c.url;
    else faltan.push(ruta);
  }
  if (faltan.length) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(faltan, segundos);
    if (error) throw traducir(error, 'No se pudieron abrir los archivos');
    for (const item of data || []) {
      if (!item.signedUrl || !item.path) continue;
      salida[item.path] = item.signedUrl;
      cacheUrls.set(`${bucket}/${item.path}`, { url: item.signedUrl, caduca: ahora + segundos * 1000 });
    }
  }
  return salida;
}

/** Enlace firmado de 10 minutos para ver el archivo o, con `descargar`, bajarlo con su nombre original. */
export async function urlArchivo(archivo: ArchivoObra, { descargar = false, segundos = 600 } = {}): Promise<string> {
  const { data, error } = await supabase.storage.from(archivo.bucket_id)
    .createSignedUrl(archivo.storage_path, segundos, descargar ? { download: archivo.nombre } : undefined);
  if (error || !data?.signedUrl) throw traducir(error, 'No se pudo abrir el archivo');
  return data.signedUrl;
}

/** Descarga el archivo como File (para abrirlo en el visor 3D), con progreso. */
export async function descargarComoFile(archivo: ArchivoObra, onProgress?: (f: number) => void): Promise<File> {
  const res = await fetch(await urlArchivo(archivo));
  if (!res.ok || !res.body) throw new ErrorArchivos(`No se pudo descargar «${archivo.nombre}».`);
  const total = Number(res.headers.get('content-length')) || archivo.size_bytes;
  const lector = res.body.getReader();
  const trozos: BlobPart[] = [];
  let recibidos = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
    recibidos += value.byteLength;
    onProgress?.(total ? Math.min(1, recibidos / total) : 0);
  }
  return new File(trozos, archivo.nombre, { type: archivo.mime_type });
}

/**
 * Borra el archivo de Storage y su registro. Si Storage falla, el registro se borra
 * igualmente y el trigger deja la ruta en la cola que vacía el servidor.
 */
export async function borrarArchivoObra(archivo: ArchivoObra): Promise<void> {
  const rutas = [archivo.storage_path, ...(archivo.miniatura_path ? [archivo.miniatura_path] : [])];
  await supabase.storage.from(archivo.bucket_id).remove(rutas).catch(() => undefined);
  for (const r of rutas) cacheUrls.delete(`${archivo.bucket_id}/${r}`);
  const { error } = await supabase.from(TABLA).delete().eq('id', archivo.id);
  if (error) throw traducir(error, 'No se pudo borrar el archivo');
}

export async function cambiarDescripcion(id: string, descripcion: string): Promise<void> {
  const { error } = await supabase.from(TABLA).update({ descripcion: descripcion.trim() || null }).eq('id', id);
  if (error) throw traducir(error, 'No se pudo guardar la descripción');
}

export { CATEGORIAS_ARCHIVO };
