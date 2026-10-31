/**
 * ObraMaster - Carga de escaneos LiDAR para el visor 3D (todo en el navegador, sin subir nada al servidor).
 *
 * Mallas: GLB/GLTF, OBJ (+MTL y texturas si se eligen juntos o en un ZIP), PLY, STL, FBX, USDZ/USD.
 * Las mallas con textura o color se ven sin sombreado, con su color real.
 * Nubes de puntos: PLY sin caras, LAS (sin comprimir), PCD, XYZ/PTS/TXT/CSV.
 * Planos: DXF (2D o 3D).
 * E57 y LAZ no se leen en el navegador: el mensaje explica cómo convertirlos.
 */
import * as THREE from 'three';
import { leerDxf3D, leerLas, leerTextoPuntos, pareceNubeTexto } from './nubesPuntos.js';
import { MAX_MB_VISOR, Z_ARRIBA, archivoPrincipal, extension } from './formatos3D.js';

export { ACCEPT_VISOR, EXT_ACOMPANANTES, EXT_VISOR, MAX_MB_VISOR, NOMBRE_FORMATO_3D, archivoPrincipal, esVisible3D } from './formatos3D.js';

function errorVisor(mensaje) {
  const e = new Error(mensaje);
  e.escaneo = true;
  return e;
}

const matMalla = () => new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });

/** Color por altura (azul abajo, rojo arriba) para nubes sin color. */
function coloresPorAltura(pos, eje = 2) {
  const n = pos.length / 3;
  let a = Infinity, b = -Infinity;
  for (let i = 0; i < n; i++) { const v = pos[i * 3 + eje]; if (v < a) a = v; if (v > b) b = v; }
  const col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const t = b > a ? (pos[i * 3 + eje] - a) / (b - a) : 0.5;
    c.setHSL(0.66 - 0.66 * t, 0.8, 0.55);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  return col;
}

function nubeDesde({ posiciones, colores }, eje = 2) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posiciones, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colores || coloresPorAltura(posiciones, eje), 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.01, vertexColors: true, sizeAttenuation: true }));
}

/** URLs temporales para que MTL, texturas y .bin se encuentren por su nombre. */
function gestorConAcompanantes(archivos) {
  const urls = new Map();
  Array.from(archivos).forEach(f => urls.set(f.name.toLowerCase(), URL.createObjectURL(f)));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    if (/^(blob:|data:)/.test(url)) return url;
    const nombre = decodeURIComponent(url.split(/[\\/]/).pop().split('?')[0]).toLowerCase();
    return urls.get(nombre) || url;
  });
  return { manager, urls, liberar: () => urls.forEach(u => URL.revokeObjectURL(u)) };
}

/** Sustituye materiales sin textura ni color por un gris mate a dos caras (los escaneos suelen venir sin MTL). */
function prepararMallas(objeto, { forzarGris = false } = {}) {
  objeto.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nuevos = mats.map(m => {
      if (!m) return matMalla();
      const sinNada = !m.map && !o.geometry.attributes.color;
      if (forzarGris && sinNada) return matMalla();
      m.side = THREE.DoubleSide;
      return m;
    });
    o.material = Array.isArray(o.material) ? nuevos : nuevos[0];
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
  });
  return objeto;
}

/**
 * Color real del escaneo: la textura (fotos) o el color por vértice ya llevan la luz de la estancia,
 * así que se muestran sin sombreado (como en la app del iPad). El material con luces queda en
 * userData.matLuz y el de color real en userData.matFoto para poder alternarlos.
 */
export function prepararColorReal(objeto) {
  let conColor = false;
  objeto.traverse(o => {
    if (!o.isMesh) return;
    const lista = Array.isArray(o.material) ? o.material : [o.material];
    const conVertices = Boolean(o.geometry.attributes.color);
    if (!lista.some(m => m?.map) && !conVertices) return;
    conColor = true;
    const fotos = lista.map(m => {
      if (m?.map && m.map.colorSpace === THREE.NoColorSpace) { m.map.colorSpace = THREE.SRGBColorSpace; if (m.map.image) m.map.needsUpdate = true; }
      return new THREE.MeshBasicMaterial({
        map: m?.map || null,
        color: m?.map || conVertices ? 0xffffff : (m?.color || 0xcbd5e1),
        vertexColors: conVertices && !m?.map,
        side: THREE.DoubleSide,
        transparent: Boolean(m?.transparent),
        opacity: m?.opacity ?? 1,
        alphaTest: m?.alphaTest || 0
      });
    });
    o.userData.matLuz = o.material;
    o.userData.matFoto = Array.isArray(o.material) ? fotos : fotos[0];
    o.material = o.userData.matFoto;
  });
  return conColor;
}

/** Abre los ZIP elegidos (3D Scanner App y Polycam exportan OBJ + MTL + fotos en un ZIP). */
async function expandirZips(archivos) {
  const lista = Array.from(archivos || []);
  if (!lista.some(f => extension(f.name) === 'zip')) return lista;
  const { unzipSync } = await import('three/examples/jsm/libs/fflate.module.js');
  const salida = [];
  for (const f of lista) {
    if (extension(f.name) !== 'zip') { salida.push(f); continue; }
    let entradas;
    try { entradas = unzipSync(new Uint8Array(await f.arrayBuffer())); } catch { throw errorVisor(`No se pudo abrir el ZIP ${f.name} (¿está dañado o protegido?).`); }
    Object.entries(entradas).forEach(([ruta, datos]) => {
      if (ruta.endsWith('/') || ruta.startsWith('__MACOSX') || ruta.split('/').pop().startsWith('.')) return;
      salida.push(new File([datos], ruta.split('/').pop()));
    });
  }
  return salida;
}

/**
 * Carga los archivos elegidos y devuelve { objeto, formato, zArriba, avisos, nombre, conColor }.
 * `objeto` es un THREE.Object3D listo para añadir a la escena (sin girar ni escalar).
 */
export async function cargarEscaneo3D(archivosElegidos) {
  const zip = Array.from(archivosElegidos || []).find(f => extension(f.name) === 'zip');
  const r = await cargarModelo(await expandirZips(archivosElegidos));
  return { ...r, nombre: zip ? zip.name : r.nombre, conColor: prepararColorReal(r.objeto) };
}

async function cargarModelo(archivos) {
  const principal = archivoPrincipal(archivos);
  if (!principal || extension(principal.name) === 'zip') throw errorVisor('Elige un archivo 3D (o un ZIP que lo contenga): GLB, OBJ, PLY, STL, USDZ, LAS, XYZ, PTS, PCD o DXF.');
  if (principal.size > MAX_MB_VISOR * 1024 * 1024) throw errorVisor(`El archivo pesa más de ${MAX_MB_VISOR} MB. Expórtalo con menos detalle o como nube reducida.`);
  const ext = extension(principal.name);
  const avisos = [];
  const base = { formato: ext, nombre: principal.name, zArriba: Z_ARRIBA.includes(ext), avisos };

  if (ext === 'e57') {
    throw errorVisor('E57 es un formato de escáner profesional que el navegador no puede abrir. Conviértelo a PLY o LAS con CloudCompare (gratis) y súbelo de nuevo.');
  }
  if (ext === 'las' || ext === 'laz') {
    const r = leerLas(await principal.arrayBuffer());
    avisos.push(...r.avisos);
    return { ...base, objeto: nubeDesde(r.puntos), puntos: r.puntos.mostrados };
  }
  if (['xyz', 'pts', 'txt', 'csv'].includes(ext)) {
    const texto = await principal.text();
    if ((ext === 'txt' || ext === 'csv') && !pareceNubeTexto(texto)) throw errorVisor('Este TXT/CSV no es una nube de puntos (se esperan líneas «x y z»).');
    const r = leerTextoPuntos(texto);
    avisos.push(...r.avisos);
    return { ...base, objeto: nubeDesde(r.puntos), puntos: r.puntos.mostrados };
  }
  if (ext === 'dxf') {
    const r = leerDxf3D(await principal.text());
    avisos.push(...r.avisos);
    const grupo = new THREE.Group();
    if (r.lineas) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(r.lineas, 3));
      grupo.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x67e8f9 })));
    }
    if (r.triangulos) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(r.triangulos, 3));
      g.computeVertexNormals();
      grupo.add(new THREE.Mesh(g, matMalla()));
    }
    if (!r.triangulos) avisos.push('Plano 2D: se ve desde arriba; usa «Medir» para comprobar cotas.');
    return { ...base, objeto: grupo, plano2D: !r.triangulos };
  }
  if (ext === 'pcd') {
    const { PCDLoader } = await import('three/examples/jsm/loaders/PCDLoader.js');
    const pts = new PCDLoader().parse(await principal.arrayBuffer());
    const pos = pts.geometry.attributes.position.array;
    if (!pts.geometry.attributes.color) pts.geometry.setAttribute('color', new THREE.BufferAttribute(coloresPorAltura(pos), 3));
    pts.geometry.center();
    pts.material = new THREE.PointsMaterial({ size: 0.01, vertexColors: true });
    return { ...base, objeto: pts, puntos: pos.length / 3 };
  }
  if (ext === 'ply') {
    const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
    const g = new PLYLoader().parse(await principal.arrayBuffer());
    const nubeSola = !g.index || g.index.count === 0;
    if (nubeSola) {
      if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(coloresPorAltura(g.attributes.position.array, 1), 3));
      return { ...base, objeto: new THREE.Points(g, new THREE.PointsMaterial({ size: 0.01, vertexColors: true })), puntos: g.attributes.position.count };
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    const mat = g.attributes.color ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }) : matMalla();
    return { ...base, objeto: new THREE.Mesh(g, mat) };
  }
  if (ext === 'stl') {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    const g = new STLLoader().parse(await principal.arrayBuffer());
    if (!g.attributes.normal) g.computeVertexNormals();
    const mat = g.hasColors ? new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide }) : matMalla();
    return { ...base, objeto: new THREE.Mesh(g, mat) };
  }

  // Formatos que pueden traer materiales y texturas aparte.
  const { manager, liberar } = gestorConAcompanantes(archivos);
  try {
    if (ext === 'obj') {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const texto = await principal.text();
      const loader = new OBJLoader(manager);
      const mtlNombre = (texto.match(/^mtllib\s+(.+)$/m) || [])[1]?.trim();
      const mtl = mtlNombre && Array.from(archivos).find(f => f.name.toLowerCase() === mtlNombre.split(/[\\/]/).pop().toLowerCase());
      if (mtl) {
        const { MTLLoader } = await import('three/examples/jsm/loaders/MTLLoader.js');
        const materiales = new MTLLoader(manager).parse(await mtl.text(), '');
        materiales.preload();
        loader.setMaterials(materiales);
      } else if (mtlNombre) {
        avisos.push(`La malla usa «${mtlNombre}» y sus fotos (JPG/PNG): elígelos junto al OBJ, o sube el ZIP que exporta la app, para verla con colores.`);
      }
      const obj = loader.parse(texto);
      return { ...base, objeto: prepararMallas(obj, { forzarGris: !mtl }), conservar: liberar };
    }
    if (ext === 'glb' || ext === 'gltf') {
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      const { MeshoptDecoder } = await import('three/examples/jsm/libs/meshopt_decoder.module.js');
      const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
      const draco = new DRACOLoader(manager).setDecoderPath('/draco/');
      const loader = new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
      const datos = ext === 'glb' ? await principal.arrayBuffer() : await principal.text();
      const gltf = await new Promise((ok, mal) => loader.parse(datos, '', ok, mal));
      draco.dispose();
      return { ...base, objeto: prepararMallas(gltf.scene), conservar: liberar };
    }
    if (['usdz', 'usd', 'usdc', 'usda'].includes(ext)) {
      const { USDLoader } = await import('three/examples/jsm/loaders/USDLoader.js');
      const loader = new USDLoader(manager);
      const datos = ext === 'usda' ? await principal.text() : await principal.arrayBuffer();
      const grupo = await new Promise((ok, mal) => {
        try {
          const g = loader.parse(datos, '', ok, mal);
          if (g) ok(g);
        } catch (e) { mal(e); }
      });
      return { ...base, objeto: prepararMallas(grupo), conservar: liberar };
    }
    if (ext === 'fbx') {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const obj = new FBXLoader(manager).parse(await principal.arrayBuffer(), '');
      return { ...base, objeto: prepararMallas(obj), conservar: liberar };
    }
  } catch (e) {
    liberar();
    if (e?.escaneo) throw e;
    throw errorVisor(`No se pudo abrir ${principal.name}: ${e?.message || e}`);
  }
  liberar();
  throw errorVisor('Formato no admitido en el visor 3D.');
}

/** Cuenta vértices y triángulos (o puntos) de lo cargado. */
export function contarGeometria(objeto) {
  let vertices = 0, triangulos = 0, puntos = 0;
  objeto.traverse(o => {
    const g = o.geometry;
    if (!g?.attributes?.position) return;
    const n = g.attributes.position.count;
    if (o.isPoints) puntos += n;
    else if (o.isMesh) { vertices += n; triangulos += g.index ? g.index.count / 3 : n / 3; }
  });
  return { vertices, triangulos: Math.round(triangulos), puntos };
}

/** Libera la memoria de la GPU del objeto. */
export function liberarObjeto(objeto) {
  objeto?.traverse?.(o => {
    o.geometry?.dispose?.();
    const mats = [o.material, o.userData?.matLuz, o.userData?.matFoto].flat();
    new Set(mats.filter(Boolean)).forEach(m => { Object.values(m).forEach(v => v?.isTexture && v.dispose()); m.dispose?.(); });
  });
}
