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
