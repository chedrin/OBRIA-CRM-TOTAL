# Archivos de obra en Supabase Storage

Fotos, planos (PDF, DWG, DXF, IFC…), escaneos LiDAR y nubes de puntos, documentación técnica, presupuestos y facturas de cada obra se guardan en **Supabase Storage**. En PostgreSQL solo queda una fila de metadatos por archivo (tabla `obra_archivos`). Se usan en la ficha de la obra › *Documentación de Obra* › *Archivos de la obra*.

## Qué hay que hacer en Supabase (una vez)

1. **SQL Editor** › pegar y ejecutar `supabase_schema_archivos_obra.sql`. Se puede repetir sin perder nada. Al final muestra una comprobación: si sale alguna fila aparte de `empresa_config`, avisa (hay archivos guardados como base64 dentro de la base de datos).
2. **Storage › Settings › Global file size limit**: en el plan gratuito el máximo es 50 MB por archivo, aunque los buckets admitan más. Para LiDAR de cientos de MB hace falta el plan Pro y subir ese límite (por ejemplo a 5 GB).
3. Nada más: no hace falta Edge Function ni webhook. El servidor de Render vacía la cola de borrados cada hora con la clave `SUPABASE_SERVICE_ROLE_KEY` que ya tiene.

## Buckets

| Bucket | Público | Máx. por archivo | Para |
|---|---|---|---|
| `obra-archivos` | No | 100 MB | Fotos, planos y CAD, documentación, presupuestos, facturas, otros |
| `obra-lidar` | No | 5 GB | LAS, LAZ, E57, PLY, PCD, XYZ, GLB/glTF, OBJ (mejor en ZIP con texturas), USDZ, FBX, STL |

Los dos son privados: las fotos de una obra son la casa de un cliente, así que tampoco las miniaturas van a un bucket público. Se abren con **URLs firmadas** (10 minutos para ver o descargar, 1 hora para las miniaturas de la lista, pedidas todas en una sola petición y reutilizadas mientras no caducan). Los tipos MIME permitidos están en cada bucket; la app los fija por extensión porque el navegador no conoce DWG, LAS o E57.

Los buckets que ya existían siguen igual: `subcontrata-docs` (documentos CAE/PRL, facturas de subcontrata, justificantes de gastos), `flota-docs` (inventario y flota) y `obra-fotos` (fotos de los partes de subcontratas). Funcionan a través del servidor con la clave de servicio y archivos de hasta 15 MB.

## Rutas

```
obra-archivos/obras/{obraId}/{categoria}/{aaaa-mm}/{uuid}-{nombre}.{ext}
obra-archivos/obras/{obraId}/miniaturas/{uuid}.jpg
obra-lidar/obras/{obraId}/lidar/{aaaa-mm}/{uuid}-{nombre}.{ext}
```

`obraId` es el id de la obra en la app (`app_records`, colección `obras`). Las rutas no se reutilizan nunca (uuid), así que se sirven con `cache-control` de un año y una versión nueva de un plano es un archivo nuevo.

## Permisos

- **Administrador**: todo.
- **Operario** (rol `obrero`): solo en las obras donde está asignado (`operariosIds` de la obra contiene su `profiles.obrero_id`) y solo fotos, planos, LiDAR y documentación técnica. Presupuestos, facturas y "otros" solo los ve la oficina. Puede borrar lo que él ha subido.
- **Storage** sigue a la tabla: se puede descargar (o pedir URL firmada) de un archivo si se puede ver su fila en `obra_archivos`; solo se puede subir a una ruta reservada antes por uno mismo y todavía pendiente. No hay sobrescritura.

## Cómo se sube

1. Se reserva la ruta: fila `pendiente` en `obra_archivos`.
2. Se sube directo del navegador a Storage con la sesión del usuario (no pasa por Render):
   - hasta 6 MB, en una petición;
   - más de 6 MB, **subida reanudable (TUS)** en trozos de 6 MB con reintentos y barra de progreso; si se corta la conexión, sigue donde se quedó. Usa el host directo `{proyecto}.storage.supabase.co`, más rápido para archivos grandes.
3. Se marca `subido`: la base de datos comprueba que el archivo está en Storage y copia de allí el tamaño y el tipo reales.

Si algo falla se deshace. Las reservas que llevan más de 24 h pendientes (pestaña cerrada a mitad) las borra el servidor.

## Cómo se borra

- Borrar un archivo en la app: se quita de Storage y se borra la fila.
- Cualquier fila borrada (también al borrar una obra, por trigger sobre `app_records`) deja sus rutas en la cola `storage_borrados`. El servidor (`backend/storageLimpieza.js`) la vacía con la API de Storage al arrancar y cada hora. Supabase no permite borrar objetos de Storage con SQL, por eso no lo hace un trigger directamente.

## Código

- SQL: `supabase_schema_archivos_obra.sql`
- Reglas (categorías, extensiones, rutas, límites): `src/utils/archivosObra.js`
- Subida, URLs firmadas y borrado (TypeScript): `src/services/archivosObraService.ts` (`npm run typecheck`)
- Pantalla: `src/components/Obras/ArchivosObra.jsx`
- Limpieza: `backend/storageLimpieza.js`; tests en `backend/archivosObra.test.js`

## Buenas prácticas para archivos grandes

- Miniaturas de 320 px generadas al subir: la lista no descarga las fotos originales. Con el plan Pro también se pueden usar las transformaciones de imagen de Supabase.
- El visor 3D descarga el LiDAR una vez y lo abre en el navegador, con progreso.
- Para OBJ con materiales y texturas, subir el ZIP que exporta la app de escaneo (un solo archivo).
- Para quien no tiene sesión (enlace de subcontrata), el patrón es que el servidor compruebe el enlace y dé una *signed upload URL* (`createSignedUploadUrl`); aún no hace falta.
