# Escaneo LiDAR (presupuestos y croquis)

Se activa en **Ajustes › Escaneo LiDAR** (`empresaConfig.escaneoLidar.activo`, desactivado por defecto). Con él activo aparece **Subir escaneo LiDAR** en:

- **Presupuestos IA**, bloque de mediciones: añade una línea por estancia a las anotaciones (`- Salón: 5,2 x 4,1 x 2,5 m (superficie…, perímetro…, paredes…)`) y guarda la planta como `presupuesto.croquis`, que pasa a la obra al aceptarlo.
- **Croquis** (presupuesto u obra), pestaña «Medidas y fotos»: dibuja el plano sin IA, con todas las medidas fijas (🔒), y rellena la tabla de mediciones.

El archivo se lee en el navegador (`src/utils/escaneoLidar.js`); no pasa por el servidor ni por la IA. Pruebas en `backend/escaneoLidar.test.js`.

## Formatos
| Formato | Qué se saca |
|---|---|
| JSON de RoomPlan (`CapturedRoom` / `CapturedStructure`) | Suelos (o muros encadenados), nombre de estancia (`sections`), altura, puertas y ventanas. |
| DXF | Polilíneas cerradas = estancias (capas tipo «ROOMS» si las hay); el texto de dentro da el nombre. Solo líneas: recintos cerrados en rejilla de 4 cm. Unidades por `$INSUNITS` o por tamaño. |
| OBJ | Malla 3D: suelo y techo en rejilla de 5 cm, separados por los muros que llegan al techo (los dinteles cierran las puertas). Sin nombres ni huecos. |
| CSV / TXT | `Estancia;largo;ancho;alto` (m o cm) o el formato «Salón: 5 x 4 x 2,5 m». Las estancias se colocan en fila. |
| PNG / JPG | Imagen del plano: en el croquis se añade como foto para la IA; en presupuestos, como captura. |

USDZ y PDF no dan medidas: el mensaje pide exportar en otro formato (el USDZ sí se ve en el visor 3D). Los planos se giran para dejar los muros rectos y los lados casi rectos (<2°) se enderezan. El tipo MIME del DXF es `image/vnd.dxf`: las imágenes se reconocen por la extensión.

## Apps
Polycam (modo Room; DXF/OBJ), 3D Scanner App (OBJ gratis), Scaniverse (OBJ gratis), magicplan (DXF, de pago). Hace falta un iPhone/iPad «Pro» con LiDAR.

## Visor 3D
Al subir un escaneo se puede ver en 3D dentro de la app (`src/components/Escaneo/VisorEscaneo3D.jsx`, carga diferida con three.js). OBJ y DXF se miden **y** se ven («Ver en 3D»); el resto de formatos abre el visor directamente. También hay un botón «Abrir un escaneo en 3D» en **Ajustes › Escaneo LiDAR**. Todo se lee en el navegador: el archivo no se sube al servidor ni se guarda.

| Formato | Notas |
|---|---|
| GLB / glTF | Con texturas. Admite Draco (`public/draco/`) y Meshopt. El glTF con `.bin` aparte: elegir los archivos a la vez. |
| OBJ (+MTL + texturas) | Elegidos a la vez se ve con color; solo el OBJ, en gris. |
| USDZ / USD | El «Compartir» de Apple y Polycam. |
| PLY, STL, FBX | PLY sin caras = nube de puntos. |
| LAS (1.0-1.4) | Sin comprimir, con RGB o intensidad. Coordenadas UTM centradas. LAZ no: convertir a LAS. |
| PCD, XYZ, PTS, TXT/CSV | TXT/CSV solo si cada línea es «x y z [r g b]» (si no, es una lista de medidas). |
| DXF | Líneas, polilíneas, 3DFACE, polyface, círculos y arcos. Los planos 2D se abren en planta. |
| E57 | No se lee en el navegador: convertir a PLY o LAS con CloudCompare. |

Herramientas: encuadrar, planta, alzado, **Medir** (dos clics; se engancha al punto escaneado o a la esquina del plano), **Sin techo** / corte por altura, alambre, rejilla, eje vertical (Z arriba), unidades (m, cm, mm, pies; se adivinan por el tamaño) y captura PNG. Las nubes de más de 3 millones de puntos se reducen; límite 500 MB.

La política de seguridad permite `'wasm-unsafe-eval'` (solo compilar WebAssembly de los decodificadores) y `blob:`/`data:` en `connect-src` (texturas de los archivos elegidos). Lectores puros (LAS, nubes de texto, DXF 3D) en `src/utils/nubesPuntos.js`, con pruebas en `backend/visorEscaneo.test.js`.
