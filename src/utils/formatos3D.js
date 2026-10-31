/**
 * ObraMaster - Formatos del visor 3D de escaneos (sin three.js, para no cargarlo hasta abrir el visor).
 */
export const MAX_MB_VISOR = 500;
export const EXT_VISOR = ['glb', 'gltf', 'obj', 'ply', 'stl', 'fbx', 'usdz', 'usd', 'usdc', 'usda', 'las', 'laz', 'pcd', 'xyz', 'pts', 'dxf', 'e57'];
/** Archivos que acompañan a una malla (materiales, texturas, buffers). */
export const EXT_ACOMPANANTES = ['mtl', 'bin', 'png', 'jpg', 'jpeg', 'webp', 'ktx2'];
export const ACCEPT_VISOR = [...EXT_VISOR, ...EXT_ACOMPANANTES, 'txt', 'csv'].map(e => `.${e}`).join(',');

export const NOMBRE_FORMATO_3D = {
  glb: 'Modelo GLB', gltf: 'Modelo glTF', obj: 'Malla OBJ', ply: 'PLY', stl: 'Malla STL', fbx: 'Modelo FBX',
  usdz: 'USDZ (Apple)', usd: 'USD', usdc: 'USD', usda: 'USD', las: 'Nube de puntos LAS', pcd: 'Nube de puntos PCD',
  xyz: 'Nube de puntos XYZ', pts: 'Nube de puntos PTS', txt: 'Nube de puntos (texto)', csv: 'Nube de puntos (CSV)', dxf: 'Plano DXF'
};

// Formatos que suelen venir con Z hacia arriba (topografía, CAD).
export const Z_ARRIBA = ['las', 'pcd', 'xyz', 'pts', 'txt', 'csv', 'dxf'];

export const extension = (nombre) => String(nombre).toLowerCase().split('.').pop();

/** ¿Se puede abrir este archivo en el visor? (TXT/CSV solo si son nubes de puntos: se mira al cargar). */
export function esVisible3D(nombre) {
  return EXT_VISOR.includes(extension(nombre));
}

/** Elige el archivo principal entre los seleccionados (el resto son materiales o texturas). */
export function archivoPrincipal(archivos) {
  const lista = Array.from(archivos || []);
  return lista.find(f => EXT_VISOR.includes(extension(f.name))) || lista.find(f => ['txt', 'csv'].includes(extension(f.name))) || null;
}

