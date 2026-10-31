# Documentación de subcontratas (CAE / PRL)

## Qué hace
- **Ficha editable**: en Subcontratas & PRL > Ficha completa > "Editar ficha" se cambian todos los datos (fiscales, contacto, REA, IBAN, forma de pago, observaciones, seguro RC) y se puede bloquear la entrada a obra o eliminar la subcontrata.
- **Documentos en la ficha**: pestaña "1. Ficha, PRL y documentos". Cada documento tiene tipo, obra (vacío = vale para todas), trabajador (formación, reconocimiento médico, EPIs…), fechas de emisión y caducidad y el archivo (PDF o foto, 15 MB). Se guardan en Supabase: tabla `subcontractor_documents` y bucket privado `subcontrata-docs` (carpeta `fichas/`).
- **Control por obra**: pestaña "Documentación por obra". Para cada obra se eligen los documentos exigidos (por defecto los 10 habituales) y se ve, por subcontrata, qué está en regla, por caducar (30 días o menos), caducado o falta. Las subcontratas aparecen solas si tienen una fase o partida asignada en Avance de obra o un presupuesto vinculado en su ficha; también se añaden o quitan a mano.

## Puesta en marcha
Ejecutar `supabase_migration_documentacion_subcontratas.sql` en Supabase > SQL Editor (se puede repetir). Sin ella la app avisa y no guarda documentos.

## Código
- Cálculo de estados: `src/utils/documentacionSubcontratas.js` (pruebas en `backend/documentacionSubcontratas.test.js`).
- Rutas: `backend/subcontratasDocsRoutes.js` (`/api/subcontratas/docs*`, `/api/subcontratas/cae*`, solo administradores).
- Pantallas: `src/components/Subcontratas/` (`FichaSubcontrataForm`, `DocumentosFicha`, `ControlDocumentalObras`).
- Los presupuestos y facturas de subcontrata por fase o partida siguen en Avance de obra (`subcontract_documents`, PR #117).
