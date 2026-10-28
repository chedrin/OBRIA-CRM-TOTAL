# Facturación VERI*FACTU en ObraMaster

ObraMaster es un Sistema Informático de Facturación (SIF) propio en modalidad **VERI*FACTU**: cada factura genera un registro encadenado con huella SHA-256 que se envía a la AEAT al momento. No usa proveedores externos.

## Normativa aplicada

| Norma | Qué aporta |
|---|---|
| Art. 29.2.j LGT y Ley 11/2021 (antifraude) | Obligación de que el software de facturación garantice integridad, trazabilidad e inalterabilidad. |
| RD 1007/2023 (Reglamento SIF) | Registros de alta y anulación, encadenamiento, envío voluntario (VERI*FACTU), declaración responsable del productor (art. 13). |
| Orden HAC/1177/2024 | Especificaciones técnicas: campos, huella, QR, formato XML y servicio web. |
| RDL 15/2025 | Fechas: 1-1-2027 para contribuyentes del Impuesto sobre Sociedades y 1-7-2027 para el resto (autónomos). |
| RD 1619/2012 (Reglamento de facturación) | Contenido obligatorio de factura y rectificativas (art. 6, 15). |
| Ley 37/1992 del IVA | Inversión del sujeto pasivo en obra (art. 84.Uno.2º.f), IVA reducido 10 % (art. 91.Uno.2.10º y 91.Uno.3.1º). |
| Art. 95.6.2º RIRPF | Retención del 1 % a empresarios en módulos. |

## Qué hace la aplicación

- **Emisión** (`emitir_factura` en SQL): numeración correlativa por serie y ejercicio, datos obligatorios del emisor y del cliente, huella y QR. Las facturas no se pueden modificar ni borrar.
- **Rectificativas** R1 a R4, **por diferencias** o **por sustitución** (con base y cuota rectificadas).
- **Anulación** (`anular_factura`): registro de anulación encadenado. Solo para facturas emitidas por error; si la operación existió hay que rectificar.
- **Subsanación** (`subsanar_registro`): vuelve a enviar un registro rechazado con `Subsanacion=S` y `RechazoPrevio` según corresponda.
- **Envío a la AEAT** (`backend/verifactu/envio.js`): cola cada 15 s, lotes de hasta 1000 registros, respeta el `TiempoEsperaEnvio` que marca la AEAT y reintenta con espera creciente si hay fallo de red.
- **Certificado digital**: se sube en Ajustes > Facturación (PFX/P12), se guarda cifrado con AES-256-GCM y solo lo lee el servidor.
- **Entornos**: *pruebas* (prefijo `PRUEBA-`, sin validez fiscal, endpoint de preproducción de la AEAT) y *producción*. El paso a producción no tiene vuelta atrás.
- **Asistente de IVA por tipo de obra** (`fiscalidadObra.js`): decide ISP, 10 % o 21 % e IRPF, con el texto legal y los documentos que hay que guardar.
- **Facturae 3.2.2** (sin firmar; se firma con AutoFirma para FACe).
- **Libro registro de facturas expedidas** (CSV) y **resumen trimestral** de IVA repercutido para el modelo 303.
- **Declaración responsable** del sistema informático en Ajustes > Facturación.

## Puesta en marcha

1. En Supabase > SQL Editor, ejecutar `supabase_schema_facturacion.sql` (se puede repetir; también actualiza una instalación de la fase 1).
2. En `.env` y en Render, rellenar `CERT_ENCRYPTION_KEY` y las variables `VERIFACTU_PRODUCTOR_*` y `VERIFACTU_DECLARACION_*` (ver `.env.example`).
3. En Ajustes > Facturación: datos fiscales completos, subir el certificado y activar el envío a la AEAT en **pruebas**.
4. Emitir varias facturas de prueba (normal, rectificativa, anulación) y comprobar en el panel de envíos que la AEAT las acepta.
5. Cuando todo esté probado, **Pasar a producción**.

El servidor debe estar siempre encendido para que la cola de envíos funcione. El plan gratuito de Render se duerme tras 15 minutos sin visitas; los registros pendientes se envían al despertar, pero para cumplir el envío inmediato conviene un plan de pago.

## Limitaciones conocidas

- No se comprueba el NIF del cliente contra el censo de la AEAT antes de emitir; si es erróneo, la AEAT lo acepta con errores o lo rechaza y se ve en la lista.
- Clientes extranjeros sin NIF español (bloque `IDOtro`) no están soportados todavía.
- Facturae sale sin firma electrónica.
- La exportación contable es el libro registro en CSV; no hay asientos para programas de contabilidad.
