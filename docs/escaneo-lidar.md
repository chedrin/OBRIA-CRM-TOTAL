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

USDZ y PDF no se leen: el mensaje pide exportar en otro formato. Los planos se giran para dejar los muros rectos y los lados casi rectos (<2°) se enderezan. El tipo MIME del DXF es `image/vnd.dxf`: las imágenes se reconocen por la extensión.

## Apps
Polycam (modo Room; DXF/OBJ), 3D Scanner App (OBJ gratis), Scaniverse (OBJ gratis), magicplan (DXF, de pago). Hace falta un iPhone/iPad «Pro» con LiDAR.
