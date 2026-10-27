# Asignación operativa y avance de obra por fase y partida

Stack real de ObraMaster: React + Vite, servidor Node sin framework (`backend/server.js`), Supabase y Render. No hay Next.js ni Prisma: el esquema va en `supabase_schema_avance_obra.sql` (SQL Editor) y el código en JavaScript.

## 1. Modelo de datos

Las **fases** y **partidas** ya existían dentro de cada obra (`app_records`, colección `obras`: `obra.fases[]` y `fase.tareas[]`, generadas desde el presupuesto firmado por `obraBudgetSyncService.js`). No se duplican: las tablas nuevas guardan sus ids como texto. `partida_id = ''` significa "fase completa".

| Entidad pedida | Dónde vive |
|---|---|
| `Phase` | `obra.fases[]` (id, nombre, importe) |
| `WorkItem` (partida) | `fase.tareas[]` (id, código, título, unidad, cantidad, importe) |
| `Assignment` (polimórfica) | tabla `work_assignments`: `assignee_type` = `obrero_interno` (con `obrero_id`) o `subcontrata` (con `subcontractor_id`); fechas de inicio y fin, `planned_rate` (rendimiento), notas, responsable visible |
| Estado actual de la partida | tabla `work_item_progress`: estado, `reported_pct`, `certified_pct`, medición ejecutada, lista para certificar, alerta |
| `ExecutionLog` | tabla `execution_logs`: avance, lista para certificar, certificación, bloqueo/desbloqueo y asignación, con autor, fotos y notas |
| `SubcontractorAlert` | `worksite_needs` (+ `fase_id`, `partida_id` y etiquetas) y `notifications` (+ `fase_id`, `partida_id`) |
| `SubcontractorAssignmentToken` | `subcontractor_tokens` (+ `fase_id`, `partida_id`, `assignment_id`): solo se guarda la huella SHA-256, con caducidad, anulación y último uso |

**Herencia:** una asignación de fase se aplica a todas sus partidas salvo a las que tengan asignación propia (`effectiveAssignments` en `src/utils/avanceObra.js`).

## 2. Avance reportado frente a certificado

1. Obrero (Portal del Obrero, "Mis tajos") o subcontrata (enlace `/sub/<token>`) reporta estado y %. Opcionalmente mide lo hecho y el % se calcula de la medición.
2. Queda como **avance reportado** en `work_item_progress` y en el histórico. El panel se actualiza al momento (Supabase Realtime). Solo los hitos avisan al jefe de obra: completada, lista para certificar y bloqueada.
3. El jefe de obra, en **Avance de Obra**, valida el % como **certificado**. El servidor no deja certificar por encima de lo reportado salvo que marque "forzar".
4. Al validar, el % certificado se escribe en la obra (`tarea.progreso`) y se recalculan la fase y la obra. Es el avance que ven el resto de pantallas y la facturación.

**Recálculo:** `computeAvance()` pondera cada partida por su **importe** (Σ importe × % / Σ importe). Si la obra no tiene importes, todas pesan igual. El **% planificado** sale de las fechas de inicio y fin de las asignaciones (lineal hasta hoy).

## 3. Avisos ligados a la partida

- Los avisos de subcontratas (enlace) y obreros (botón "Pedir material") llevan ahora la obra, la fase y la partida. El servidor comprueba que existen y que la subcontrata tiene asignada esa partida.
- **Bloqueo** → la partida pasa a `bloqueada` (rojo). **Falta de material** → alerta amarilla. Terminada → verde.
- La notificación push y el toast abren directamente el detalle de la partida (`#admin/avance/<obra>/<fase>/<partida>`), desde donde se pasa a "Tramitar pedido".
- Al marcar la necesidad como entregada, resuelta o descartada, la partida sale de la alerta (y del bloqueo) y queda registrado.

## 4. Enlace mágico y WhatsApp al asignar a una subcontrata

Al guardar una asignación de tipo subcontrata (`POST /api/avance/assignments`) el servidor:

1. Crea un token de 192 bits (`crypto.randomBytes(24)`), guarda su huella con la fase o partida y la asignación, y lo hace caducar a los días elegidos (60 por defecto).
2. Monta la URL `https://<PUBLIC_APP_URL>/sub/<token>`.
3. Prepara el mensaje con `generateWhatsAppAssignmentUrl()` (`backend/whatsapp.js`): *"Hola [contacto], se os ha asignado la [partida/fase]: '[nombre]' en la obra '[obra]'. Puedes reportar el avance, avisar si está terminada o solicitar materiales desde este enlace directo: [URL]"*.

La ventana de asignación muestra **Abrir WhatsApp**, **Copiar mensaje**, **Copiar enlace** y, si el servidor tiene `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`, **Enviar por WhatsApp API** (Cloud API de Meta). Meta solo admite texto libre si el contacto escribió en las últimas 24 h; para el primer contacto hace falta una plantilla aprobada (`WHATSAPP_TEMPLATE_NAME`, con un parámetro de cuerpo).

## 5. Página de la subcontrata `/sub/<token>`

Cabecera con la obra, la dirección (abre el mapa), la fase o partida asignada, medición, indicaciones del encargado, fin previsto y estado (Pendiente, En curso, Bloqueada, Terminada o Pendiente de revisión). Tres botones:

1. **Solicitar material**: qué necesita, cantidad y unidad, Normal o Urgente/tajo parado, y fecha. Crea la necesidad ligada a la partida y el **borrador de pedido** (sin proveedor) en Avisos y Pedidos para que compras elija proveedor y lo envíe.
2. **Tengo un problema**: motivo rápido (falta de luz o agua, retraso de otro gremio, zona no accesible, falta de material, otro), notas y hasta 3 fotos. La partida pasa a bloqueada y salta el aviso push.
3. **Marcar como terminada**: confirmación, observaciones y hasta 3 fotos. Pasa a "pendiente de revisión" (lista para certificar), guarda fecha y hora y avisa al encargado.

Además, **Reportar avance (%)** lista todas las partidas de su empresa en esa obra. En un enlace de fase completa, terminar o bloquear se aplica a todas las partidas de la fase que tiene asignadas, con un solo aviso. Nunca se muestran importes ni precios.

## 6. API

| Ruta | Quién |
|---|---|
| `GET /api/sub/:token/partidas` · `POST /api/sub/:token/avance` | Enlace (token) |
| `POST /api/sub/:token/necesidad` (acepta `fase_id`, `partida_id`, `motivo`, `cantidad`, `unidad`) | Enlace (token) |
| `GET /api/avance/mis-tajos` · `POST /api/avance/report` | Obrero con sesión (`profiles.obrero_id`) |
| `GET /api/avance/obras/:obraId` · `GET /api/avance/logs` | Admin |
| `POST /api/avance/assignments` (devuelve `link` para subcontratas) · `PATCH`/`DELETE /api/avance/assignments/:id` | Admin |
| `POST /api/avance/certify` | Admin |
| `POST /api/whatsapp/send` | Admin (opcional, Cloud API) |

## 7. Puesta en marcha

1. Supabase > SQL Editor: ejecutar `supabase_schema_avance_obra.sql` (después de `supabase_schema_notificaciones.sql`).
2. Cada obrero debe tener su usuario vinculado a su ficha (`profiles.obrero_id`); los creados desde Ajustes > Usuarios ya lo están.
3. Opcional: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (y `WHATSAPP_TEMPLATE_NAME`) en Render y `.env`, sin prefijo `VITE_`.
4. Probar: Avance de Obra > Asignar una partida a una subcontrata > Abrir WhatsApp; abrir el enlace en el móvil, pedir material y marcar terminada; volver al panel y validar el avance.

Con el módulo activo, en el Portal del Obrero el selector antiguo de las fases queda de solo lectura (muestra el avance certificado) y el obrero reporta en "Mis tajos".
