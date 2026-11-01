# Histórico diario de cada obra

Pestaña **Histórico diario** dentro de cada obra (Obras y Reformas > abrir la obra). Muestra, agrupado por días
y del más reciente al más antiguo, todo lo que afecta a la obra. Se puede filtrar por tipo, buscar por texto y
elegir el periodo (7 días, 30 días, todo o entre fechas).

## Qué se registra solo

| Suceso | De dónde sale |
| --- | --- |
| Asignación de obreros y subcontratas a fases o partidas, cambio de sus fechas y retirada | `execution_logs` (kind `asignacion`) |
| Avance reportado, listo para certificar, certificado, tajo bloqueado/desbloqueado | `execution_logs` |
| Avisos y necesidades de obra (material, maquinaria, bloqueos, seguridad) | `worksite_needs` |
| Pedidos a proveedor: preparado, enviado, respuesta, entregado | `material_orders` |
| Trabajo terminado o incidencia desde el enlace de la subcontrata | `site_reports` |
| Cambios de fecha de inicio, fin planificado, entrega al cliente y fin real; duración de etapas | `obra_eventos` (la app compara antes/después) |
| Responsable de cada etapa, avance de partidas desde la ficha, tareas nuevas, avisos a operarios | `obra_eventos` |
| Partidas y secciones del presupuesto de la obra añadidas, quitadas o cambiadas (cantidad, precio, texto) | `obra_eventos` |
| Aceptación y nueva aceptación del presupuesto, cambios de estado | `obra_eventos` |
| Materiales añadidos a "Necesidades y materiales" y su cambio de estado | `obra_eventos` |
| Partes del antiguo diario de obra | `obra.diario` (JSON de la obra) |

Los cambios que se hacen escribiendo (presupuesto, fechas) se juntan: la app espera unos segundos sin cambios y guarda
un solo resumen con el antes y el después.

## Qué se apunta a mano

Botón **Apuntar suceso** o accesos rápidos: llamadas y contacto con el cliente (con quién y cómo), material utilizado
(líneas con cantidad y unidad), maquinaria (horas o unidades), incidencias, partes diarios (clima y operarios),
material pedido por teléfono, avance y notas. Se elige el día y la hora (puede ser de otro día). Los apuntes manuales
se pueden corregir o quitar; los automáticos no.

## Puesta en marcha

1. Supabase > SQL Editor > pegar `supabase_schema_historial_obra.sql` > Run (se puede repetir sin problema).
2. Sin esa tabla la pestaña ya muestra asignaciones, avance, avisos y pedidos, y avisa de que falta la migración.

Código: `src/utils/historialObra.js` (cálculo compartido y tests en `backend/historialObra.test.js`),
`backend/historialRoutes.js` (rutas `/api/historial/...`), `src/services/historialService.js`,
`src/components/Obras/HistorialObra.jsx`. Solo los administradores ven y escriben el histórico.
