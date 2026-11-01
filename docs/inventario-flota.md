# Inventario, maquinaria, flota y alertas

Nueva sección **Recursos** en el menú: Inventario y maquinaria, Flota de vehículos, Alquileres y Centro de alertas.

## Puesta en marcha

1. En Supabase > SQL Editor ejecuta `supabase_schema_inventario_flota.sql` (después de `supabase_migration_seguridad.sql`
   y de las tablas de notificaciones y proveedores). Se puede ejecutar más de una vez.
2. Opcional: si el servidor de Render se duerme (plan gratuito), activa **pg_cron** en Database > Extensions y vuelve a
   ejecutar el SQL; programa la revisión de avisos cada día a las 7:00 dentro de la base de datos.
3. En Centro de alertas > **Cuándo avisar**: días de aviso (30, 15 y 7 por defecto), km de aviso (1.000), correo y
   teléfono de WhatsApp. El correo usa `RESEND_API_KEY`; WhatsApp, `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.

## Qué hay

- **Inventario**: activos con código automático (HER-0001, MAQ-0001, VEH-0001…), número de serie, código de barras/QR,
  proveedor, factura, coste, garantía, manuales y fotos. Consumibles con cantidad y stock mínimo.
  Ubicación: almacén, obra, vehículo, operario, reparación, devuelto al proveedor o baja. Botones Mover, Stock y
  Sustituir.
- **Historial inmutable** (`inventory_movements`): cada alta, traslado, carga en vehículo, asignación, reparación,
  sustitución, baja y ajuste de stock queda con fecha, quién y motivo. No se puede editar ni borrar, ni siquiera desde
  el SQL Editor sin quitar antes los triggers. Si entra o sale de una obra, también se apunta en su Histórico diario.
- **Flota**: ficha del vehículo con matrícula, VIN, tarjeta de transporte, distintivo ambiental, conductor, ITV (con
  fecha sugerida según el RD 920/2017), seguros, repostajes (consumo l/100 km por depósito lleno), mantenimiento y
  planes por km o meses, neumáticos, stock a bordo, documentos y costes.
- **Alquileres**: arrendador, tarifa por día/semana/mes, fin previsto con aviso, devolución con importe final y
  sustitución de una máquina por otra. El coste se carga a la obra.
- **Alertas**: ITV, seguros, mantenimiento por km o fecha, garantías, calibraciones, documentos (tarjeta de
  transporte, permisos…), neumáticos por debajo de 3 mm, fin de alquiler y stock mínimo.
  Semáforo: verde vigente, amarillo próximo (30 días o 1.000 km), naranja urgente (7 días o 300 km), rojo vencido.
  Salen en el Panel general, en la campana (con push) y, si se activa, por correo y WhatsApp. Cada aviso se manda
  una sola vez por tramo (30, 15, 7 días y vencido).

## Costes en la obra

Repostajes, taller e ITV/seguro imputados a una obra y los alquileres aparecen en la obra > **Gastos vs Ingresos**
con la etiqueta "desde Flota" o "desde Alquileres". No se duplican en `facturas_proveedores`: si ya existe un gasto
manual con el mismo número de factura e importe, se muestra solo una vez.

Al devolver un alquiler se pide el importe de la factura del arrendador (sin IVA), su número y el PDF o foto
(`asset_rentals.factura_path`). Un alquiler cerrado sin importe facturado, o en curso sin tarifa, **no cuenta** en los
gastos de la obra: sale como "Falta precio" en Alquileres y como pendiente en Gastos vs Ingresos hasta que se pulse
"Poner precio". El precio se puede cambiar después con el botón "Precio". Mientras el alquiler sigue en curso con
tarifa, cuenta el coste calculado hasta hoy.

## Portal del Obrero

El operario ve el vehículo que conduce (ITV, seguro y teléfono de asistencia), lo que lleva a bordo y las
herramientas a su cargo. Con **Repostar** apunta km, litros, importe, obra y foto del ticket. Solo puede apuntar
repostajes de su propio vehículo.

## Permisos

Admin: todo. Operario: solo lectura de sus herramientas, del vehículo que conduce (con su ITV y seguro) y de sus
movimientos, y alta de sus repostajes. El servidor trabaja con la clave de servicio y comprueba el rol.

Archivos: bucket privado `flota-docs` (facturas, manuales, pólizas, tickets).
