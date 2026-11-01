/**
 * ObraMaster - Archivos de obra en Supabase Storage (reglas puras, sin red).
 *
 * En PostgreSQL solo se guardan los metadatos (tabla `obra_archivos`); el binario va a Storage:
 *   - bucket privado `obra-archivos` (100 MB): fotos, planos, documentación, presupuestos y facturas.
 *   - bucket privado `obra-lidar` (5 GB): escaneos LiDAR, nubes de puntos y modelos 3D.
 * Rutas: obras/{obraId}/{categoria}/{aaaa-mm}/{uuid}-{nombre}.{ext}
 *        obras/{obraId}/miniaturas/{uuid}.jpg   (vista previa de las fotos)
 * Los mismos límites y tipos están en supabase_schema_archivos_obra.sql (un test lo comprueba).
 */

export const BUCKET_ARCHIVOS = 'obra-archivos';
export const BUCKET_LIDAR = 'obra-lidar';

export const LIMITE_BUCKET = {
  [BUCKET_ARCHIVOS]: 100 * 1024 * 1024,
  [BUCKET_LIDAR]: 5 * 1024 * 1024 * 1024
};

/** Supabase recomienda la subida reanudable (TUS) por encima de 6 MB; los trozos deben medir 6 MB. */
export const TROZO_TUS = 6 * 1024 * 1024;

/** Tipo MIME por extensión. Se fija aquí porque el navegador no sabe el de DWG, LAS, E57, etc. */
export const MIME_POR_EXT = {
  // Imágenes
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', gif: 'image/gif',
  // Documentos
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', xml: 'application/xml', json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  bc3: 'application/octet-stream',
  zip: 'application/zip',
  // CAD / BIM
  dwg: 'image/vnd.dwg', dxf: 'image/vnd.dxf', dwf: 'model/vnd.dwf', ifc: 'application/x-step',
  rvt: 'application/octet-stream', skp: 'application/octet-stream',
  // 3D, LiDAR y nubes de puntos
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', obj: 'model/obj', mtl: 'model/mtl', stl: 'model/stl',
  fbx: 'application/octet-stream', ply: 'application/octet-stream', usdz: 'model/vnd.usdz+zip',
  usd: 'application/octet-stream', usdc: 'application/octet-stream', usda: 'text/plain',
  las: 'application/octet-stream', laz: 'application/octet-stream', e57: 'application/octet-stream',
  pcd: 'application/octet-stream', xyz: 'text/plain', pts: 'text/plain', bin: 'application/octet-stream'
};

const IMAGENES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'];
const OFIMATICA = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'odt', 'ods', 'txt', 'csv', 'zip'];

/**
 * Categorías de archivo. `obrero`: si los operarios asignados a la obra la ven y pueden subir
 * (presupuestos y facturas solo los ve la oficina). Debe coincidir con el SQL.
 */
export const CATEGORIAS_ARCHIVO = {
  fotos: { label: 'Fotos de obra', bucket: BUCKET_ARCHIVOS, ext: IMAGENES, obrero: true },
  planos: { label: 'Planos y CAD', bucket: BUCKET_ARCHIVOS, ext: ['pdf', 'dwg', 'dxf', 'dwf', 'ifc', 'rvt', 'skp', ...IMAGENES, 'zip'], obrero: true },
  lidar: {
    label: 'LiDAR y 3D', bucket: BUCKET_LIDAR,
    ext: ['las', 'laz', 'e57', 'ply', 'pcd', 'xyz', 'pts', 'txt', 'csv', 'glb', 'gltf', 'bin', 'obj', 'mtl', 'stl', 'fbx', 'usdz', 'usd', 'usdc', 'usda', 'dxf', 'zip', 'json', 'jpg', 'jpeg', 'png'],
    obrero: true
  },
  documentacion: { label: 'Documentación técnica', bucket: BUCKET_ARCHIVOS, ext: [...OFIMATICA, 'bc3', ...IMAGENES], obrero: true },
  presupuestos: { label: 'Presupuestos', bucket: BUCKET_ARCHIVOS, ext: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'bc3', 'odt', 'ods'], obrero: false },
  facturas: { label: 'Facturas', bucket: BUCKET_ARCHIVOS, ext: ['pdf', 'xml', 'jpg', 'jpeg', 'png', 'webp'], obrero: false },
  otros: { label: 'Otros', bucket: BUCKET_ARCHIVOS, ext: [...OFIMATICA, ...IMAGENES, 'xml', 'json'], obrero: false }
};

export const extensionDe = (nombre) => {
  const partes = String(nombre || '').toLowerCase().split('.');
  return partes.length > 1 ? partes.pop() : '';
};

export const esImagen = (archivo) => String(archivo?.mime_type || '').startsWith('image/') && !/dwg|dxf/.test(archivo.mime_type);

/** `accept` del input de archivo para una categoría. */
export const acceptCategoria = (categoria) => (CATEGORIAS_ARCHIVO[categoria]?.ext || []).map(e => `.${e}`).join(',');

/**
 * Comprueba un archivo antes de subirlo. Devuelve { ext, mime, bucket } o lanza un error en castellano.
 * @param {{ name: string, size: number }} file
 */
export function tipoArchivo(file, categoria) {
  const cat = CATEGORIAS_ARCHIVO[categoria];
  if (!cat) throw new Error('Elige una categoría válida.');
  const ext = extensionDe(file?.name);
  if (!cat.ext.includes(ext)) {
    throw new Error(`«${file?.name}» no se admite en ${cat.label}. Formatos: ${cat.ext.join(', ').toUpperCase()}.`);
  }
  const size = Number(file?.size) || 0;
  if (size <= 0) throw new Error(`«${file?.name}» está vacío.`);
  const limite = LIMITE_BUCKET[cat.bucket];
  if (size > limite) throw new Error(`«${file.name}» ocupa ${formatoTamano(size)}; el máximo en ${cat.label} es ${formatoTamano(limite)}.`);
  return { ext, mime: MIME_POR_EXT[ext] || 'application/octet-stream', bucket: cat.bucket };
}

/** Id de obra seguro para la ruta (el SQL exige el mismo patrón). */
export function carpetaObra(obraId) {
  const id = String(obraId || '');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error('La obra no tiene un identificador válido para guardar archivos.');
  return id;
}

/** Nombre legible y seguro para la ruta (sin tildes, espacios ni símbolos). */
export function nombreSeguro(nombre) {
  const base = String(nombre || '').replace(/\.[^.]*$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || 'archivo';
}

export function rutaArchivo({ obraId, categoria, id, nombre, ext, fecha = new Date() }) {
  if (!CATEGORIAS_ARCHIVO[categoria]) throw new Error('Categoría no válida.');
  const mes = fecha.toISOString().slice(0, 7);
  return `obras/${carpetaObra(obraId)}/${categoria}/${mes}/${id}-${nombreSeguro(nombre)}.${ext || extensionDe(nombre)}`;
}

export const rutaMiniatura = (obraId, id) => `obras/${carpetaObra(obraId)}/miniaturas/${id}.jpg`;

/** ¿Va por subida reanudable (TUS, por trozos y con reintentos) en lugar de una sola petición? */
export const usarSubidaReanudable = (size) => Number(size) > TROZO_TUS;

export function formatoTamano(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const unidades = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < unidades.length - 1) { v /= 1024; i += 1; }
  return `${v.toLocaleString('es-ES', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${unidades[i]}`;
}

/** Tipos MIME que puede producir cada bucket (para comprobar que el SQL los permite). */
export function mimesPorBucket() {
  const out = { [BUCKET_ARCHIVOS]: new Set(['image/jpeg']), [BUCKET_LIDAR]: new Set() };
  for (const cat of Object.values(CATEGORIAS_ARCHIVO)) {
    for (const ext of cat.ext) out[cat.bucket].add(MIME_POR_EXT[ext] || 'application/octet-stream');
  }
  return out;
}
