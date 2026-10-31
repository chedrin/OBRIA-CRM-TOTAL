import test from "node:test";
import assert from "node:assert/strict";
import { leerDxf3D, leerLas, leerTextoPuntos, pareceNubeTexto } from "../src/utils/nubesPuntos.js";
import { archivoPrincipal, esVisible3D } from "../src/utils/formatos3D.js";

const cerca = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

// LAS 1.2 mínimo (formato de punto 2: XYZ + RGB), con coordenadas UTM grandes.
function lasDePrueba(puntos, { formato = 2, comprimido = false } = {}) {
  const cab = 227, largo = formato === 2 ? 26 : 20;
  const buf = new ArrayBuffer(cab + puntos.length * largo);
  const dv = new DataView(buf);
  "LASF".split("").forEach((c, i) => dv.setUint8(i, c.charCodeAt(0)));
  dv.setUint8(24, 1); dv.setUint8(25, 2);
  dv.setUint16(94, cab, true);
  dv.setUint32(96, cab, true);
  dv.setUint8(104, formato | (comprimido ? 0x80 : 0));
  dv.setUint16(105, largo, true);
  dv.setUint32(107, puntos.length, true);
  [0.001, 0.001, 0.001].forEach((v, i) => dv.setFloat64(131 + i * 8, v, true));
  [500000, 4400000, 0].forEach((v, i) => dv.setFloat64(155 + i * 8, v, true));
  puntos.forEach(([x, y, z, r = 0, g = 0, b = 0], k) => {
    const o = cab + k * largo;
    dv.setInt32(o, Math.round((x - 500000) / 0.001), true);
    dv.setInt32(o + 4, Math.round((y - 4400000) / 0.001), true);
    dv.setInt32(o + 8, Math.round(z / 0.001), true);
    dv.setUint16(o + 12, 1000, true);
    if (formato === 2) { dv.setUint16(o + 20, r, true); dv.setUint16(o + 22, g, true); dv.setUint16(o + 24, b, true); }
  });
  return buf;
}

test("LAS: lee puntos UTM, los centra y normaliza el color de 16 bits", () => {
  const buf = lasDePrueba([[500010, 4400020, 0, 65535, 0, 0], [500014, 4400023, 2.5, 0, 65535, 0], [500012, 4400021.5, 1.25, 0, 0, 65535]]);
  const r = leerLas(buf);
  assert.equal(r.puntos.mostrados, 3);
  const p = r.puntos.posiciones;
  cerca(p[0], -2); cerca(p[1], -1.5); cerca(p[2], -1.25);
  cerca(p[3], 2); cerca(p[4], 1.5); cerca(p[5], 1.25);
  cerca(r.origen[0], 500012); cerca(r.origen[1], 4400021.5);
  assert.deepEqual(Array.from(r.puntos.colores.slice(0, 3)), [1, 0, 0]);
});

test("LAS: sin RGB usa la intensidad y reduce los puntos si hay demasiados", () => {
  const pts = Array.from({ length: 1000 }, (_, i) => [500000 + i * 0.01, 4400000, 0]);
  const r = leerLas(lasDePrueba(pts, { formato: 0 }), { maxPuntos: 100 });
  assert.equal(r.puntos.mostrados, 100);
  assert.equal(r.puntos.total, 1000);
  assert.ok(r.puntos.colores);
  assert.match(r.avisos[0], /100 de 1/);
});

test("LAS: LAZ comprimido y archivos que no son LAS dan un mensaje claro", () => {
  assert.throws(() => leerLas(lasDePrueba([[500000, 4400000, 0]], { comprimido: true })), /LAZ/);
  assert.throws(() => leerLas(new ArrayBuffer(300)), /LASF/);
});

test("XYZ y PTS: con color de 0-255 y cabeceras", () => {
  const xyz = "0 0 0 255 0 0\n4 3 2.5 0 255 0\n2 1.5 1 0 0 255\n";
  assert.ok(pareceNubeTexto(xyz));
  const r = leerTextoPuntos(xyz);
  assert.equal(r.puntos.mostrados, 3);
  cerca(r.puntos.posiciones[0], -2);
  assert.deepEqual(Array.from(r.puntos.colores.slice(0, 3)), [1, 0, 0]);
  // PTS: primera línea con el número de puntos; x y z intensidad r g b.
  const pts = "3\n1,0 2 3 -200 10 20 30\n1 2 3 -200 10 20 30\n5 6 7 -100 255 255 255\n";
  const p = leerTextoPuntos(pts.replace("1,0", "1"));
  assert.equal(p.puntos.mostrados, 3);
  cerca(p.puntos.colores[0], 10 / 255);
});

test("TXT de medidas no se confunde con una nube de puntos", () => {
  assert.equal(pareceNubeTexto("Salón;5;4;2,5\nCocina;3;2,5;2,5\n"), false);
  assert.equal(pareceNubeTexto("Salón: 5 x 4 x 2,5 m"), false);
});

test("DXF 3D: líneas en mm, caras 3D y malla polyface", () => {
  const ent = [
    "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LINE", "8", "0", "10", "0", "20", "0", "30", "0", "11", "4000", "21", "0", "31", "0",
    "0", "LWPOLYLINE", "8", "0", "90", "3", "70", "1", "38", "2500", "10", "0", "20", "0", "10", "4000", "20", "0", "10", "4000", "20", "3000",
    "0", "3DFACE", "8", "0", "10", "0", "20", "0", "30", "0", "11", "4000", "21", "0", "31", "0", "12", "4000", "22", "3000", "32", "0", "13", "0", "23", "3000", "33", "0",
    "0", "POLYLINE", "8", "0", "70", "64", "71", "3", "72", "1",
    "0", "VERTEX", "8", "0", "70", "192", "10", "0", "20", "0", "30", "2500",
    "0", "VERTEX", "8", "0", "70", "192", "10", "4000", "20", "0", "30", "2500",
    "0", "VERTEX", "8", "0", "70", "192", "10", "4000", "20", "3000", "30", "2500",
    "0", "VERTEX", "8", "0", "70", "128", "10", "0", "20", "0", "30", "0", "71", "1", "72", "2", "73", "3",
    "0", "SEQEND",
    "0", "ENDSEC", "0", "EOF"
  ].join("\n");
  const r = leerDxf3D(ent);
  assert.equal(r.escala, 0.001);
  assert.equal(r.lineas.length / 6, 1 + 3); // LINE + polilínea cerrada de 3 lados
  assert.equal(r.triangulos.length / 9, 2 + 1); // 3DFACE de 4 vértices + 1 cara de la malla
  // Centrado: el LINE va de x = -2 a 2 m.
  cerca(r.lineas[0], -2); cerca(r.lineas[3], 2);
  // La polilínea está a la cota 2,5 m (z centrada: -1,25 → 1,25).
  cerca(r.lineas[8], 1.25);
});

test("DXF sin entidades dibujables avisa de los bloques", () => {
  const dxf = ["0", "SECTION", "2", "ENTITIES", "0", "INSERT", "2", "PLANO", "10", "0", "20", "0", "0", "ENDSEC", "0", "EOF"].join("\n");
  assert.throws(() => leerDxf3D(dxf), /bloques/);
});

test("Formatos: elige el archivo principal entre malla, material y texturas", () => {
  const f = (name) => ({ name });
  assert.equal(archivoPrincipal([f("textura.jpg"), f("salon.MTL"), f("Salon.OBJ")]).name, "Salon.OBJ");
  assert.equal(archivoPrincipal([f("nube.txt")]).name, "nube.txt");
  assert.equal(archivoPrincipal([f("foto.jpg")]), null);
  assert.ok(esVisible3D("escaneo.usdz") && esVisible3D("x.LAS") && !esVisible3D("plano.pdf"));
});

test("Formatos: en un ZIP con varios modelos se abre primero el que trae textura", () => {
  const f = (name) => ({ name });
  assert.equal(archivoPrincipal([f("nube.ply"), f("malla.obj"), f("modelo.glb"), f("foto.jpg")]).name, "modelo.glb");
  assert.equal(archivoPrincipal([f("nube.ply"), f("textured_output.obj"), f("textured_output.mtl")]).name, "textured_output.obj");
  assert.ok(esVisible3D("Escaneo 3D Scanner App.zip"));
});

test("Color real: la malla con textura o color por vértice se ve sin sombreado y se puede volver a las luces", async () => {
  const THREE = await import("three");
  const { prepararColorReal } = await import("../src/utils/visorEscaneo.js");
  const tex = new THREE.Texture();
  const conFoto = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: tex }));
  const gris = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const grupo = new THREE.Group().add(conFoto, gris);
  assert.equal(prepararColorReal(grupo), true);
  assert.ok(conFoto.material.isMeshBasicMaterial);
  assert.equal(conFoto.material.map, tex);
  assert.ok(conFoto.userData.matLuz.isMeshStandardMaterial);
  assert.ok(gris.material.isMeshStandardMaterial, "sin textura se queda con luces");
  assert.equal(prepararColorReal(new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()))), false);
});
