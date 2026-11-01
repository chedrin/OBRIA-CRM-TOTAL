# Versiones de presupuesto y límite de facturación

## No se factura por encima del presupuesto firmado
- El límite es la base imponible de la **versión firmada** por el cliente (`baseFacturable` en `src/utils/facturadoPresupuesto.js`). Una versión nueva sin firmar no cuenta hasta registrar su aceptación.
- Lo comprueba el servidor (`comprobarLimitePresupuesto` en `backend/facturacionRoutes.js`) en facturas y rectificativas al alza. Responde 409 con el exceso y qué hacer.
- En "Emitir factura" (`Facturas/EmitirFacturaModal.jsx`), si el importe supera lo pendiente o el presupuesto ya está facturado entero, aparece un aviso con dos salidas:
  1. **Nuevo presupuesto para que lo firme el cliente**: crea la versión siguiente del mismo presupuesto (misma obra) y abre la consola para editarla.
  2. **Hacer una rectificativa**: lleva a Facturación para corregir una factura anterior mal emitida.

## Versiones guardadas
- Cada presupuesto guarda sus versiones anteriores en `versiones` (JSON en `app_records`, sin SQL): número de versión, estado, fecha, totales y contenido completo.
- Se crea una versión nueva con el botón "Nueva versión" (consola del presupuesto) o al modificar un presupuesto ya aprobado. Mientras falta la firma, la obra y la facturación siguen con la versión firmada (`versionAceptada`).
- La lista con el PDF de cada versión está en la consola del presupuesto y en la ficha de la obra (pestaña económica). Código: `Presupuestos/VersionesPresupuesto.jsx`, `src/utils/presupuestoRevision.js`.

## Necesidades de la obra
- Al apuntar una necesidad (ficha de obra > Necesidades y Materiales) se compara el concepto con las partidas del presupuesto firmado (`src/utils/necesidadPresupuesto.js`) y se avisa si está contemplada.
- Si no lo está: "Solo a necesidades" (no se cobra) o "Añadir y generar versión nueva del presupuesto": se añade como partida en el capítulo "Ampliaciones de obra" (coste estimado + margen del presupuesto) y, si el presupuesto estaba aprobado, queda una versión nueva pendiente de firma.

## Presupuestos aceptados o facturados: solo revisiones
- Un presupuesto aceptado, firmado o facturado no se puede modificar (`estaBloqueado` en `src/utils/presupuestoRevision.js`): la consola lo muestra en solo lectura y el contexto rechaza cambios de contenido (edición, ajuste por voz, partidas desde la bandeja).
- **Añadir revisión** crea la versión siguiente, que sustituye a la anterior y se puede editar. La anterior queda como "Modificado el <fecha>" con la lista de cambios (cabecera, partidas añadidas, quitadas o modificadas y total) de `cambiosEntreVersiones`. Al firmar la revisión, los cambios y la fecha se fijan en la versión anterior (`cambios`, `sustituidaEl`) y el presupuesto vuelve a bloquearse.
- Hasta que el cliente firma la revisión, la obra y la facturación siguen con la versión firmada.
- Las necesidades de obra que se añaden a un presupuesto bloqueado abren una revisión (`editarPresupuesto(id, cambios, { nuevaRevision: true })`).
- Cada versión guardada es una copia íntegra del presupuesto antes de editar (`copiaCompleta`, marca `completa: true`). Su PDF se dibuja solo con esos datos (`datosVersionGuardada`), con el número `PRES-… vN` y el aviso "Versión N sustituida por una revisión el <fecha>". Las versiones guardadas antes de este cambio solo tenían el contenido principal: su PDF ya no toma capítulos, revisión ni estado de la versión nueva.
