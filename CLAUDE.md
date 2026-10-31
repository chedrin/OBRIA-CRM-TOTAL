# Instrucciones para Claude

- Ve al grano, evita saludos, no repitas código completo y suprime explicaciones redundantes.
- Responde en español. Nunca pidas ni escribas claves reales en archivos del repo (repo público).

# Contexto del proyecto (OBRAMASTER / OBRIA-CRM-TOTAL)

App para constructor: React + Vite (`src/`), servidor Node sin framework (`backend/server.js`), Supabase (Auth + tablas), despliegue en Render (`render.yaml`).

## Objetivos del usuario (Pedro, comunica en español)
1. **Acceso (prioridad máxima):** no puede entrar con el usuario/contraseña creados en Supabase. Quiere un usuario admin `admin` con su correo.
2. **Base de datos Supabase** funcionando bien.
3. **IA integrada** con Gemini, Claude y OpenAI: mejora textos de campos y prepara presupuestos según ejemplos guardados en Ajustes, aprendiendo de cambios y órdenes, sin perder contexto.

## Cómo funciona el login (causa más probable del fallo)
- `POST /api/auth/login` (`backend/authRoutes.js`) busca primero en la tabla `public.profiles` (por `username`, `auth_email`, `email`, DNI o teléfono) y solo después valida la contraseña con Supabase Auth (`signInWithPassword` usando `profiles.auth_email`).
- Un usuario creado solo en Authentication > Users NO tiene fila en `profiles` → siempre "Usuario o contraseña incorrectos".
- Requisitos: ejecutar `supabase_migration_seguridad.sql`; variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (servidor) y `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (build) en `.env` local o Render.
- Reparación: `node scripts/crearAdmin.js --usuario admin --email <correo> --password <contraseña>` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno. Crea/actualiza el usuario en Auth (confirmado) y su fila en `profiles` con rol admin.

## Estado (código fusionado en `main` con el PR #41)
Hecho: script `crearAdmin.js` (admin creado y login FUNCIONANDO en local, `npm run build` y `npm start` OK); memoria de IA (`backend/aiMemory.js`, `supabase_schema_ai_memory.sql`, pestaña Ajustes > Memoria de la IA `AiMemoryConfig.jsx`); correcciones capturadas desde `AiImprovementControl.jsx` y `ConsolaRevisionPresupuesto.jsx`; claves de IA sin prefijo `VITE_`; modelos por defecto `gemini-3.8-flash`, `claude-sonnet-5-5`, `chat-latest`.
Causa real del fallo de acceso: `VITE_SUPABASE_ANON_KEY` del `.env` local era un texto de 7 caracteres (no la clave real) y las líneas del `.env` tenían espacios delante. La web falló al abrir sesión (401 de Supabase). Solución: `.env` limpio, mismas claves en `VITE_SUPABASE_ANON_KEY` y `SUPABASE_ANON_KEY`, y recompilar.
Pendiente:
- Pedro debe rotar la clave `service_role` de Supabase (la pegó en un chat) y actualizarla en `.env` y Render.
- Cambiar la contraseña del admin por una fuerte.
- Comprobar en Table Editor que `ai_instructions` y `ai_corrections` tienen RLS activado (ambas migraciones ya aplicadas, verificado el 2026-10-21; el PC de Pedro no tiene psql/CLI: migraciones por SQL Editor).
- Poner `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` en `.env` y en Render; probar IA de extremo a extremo (mejorar texto, generar presupuesto, Memoria de la IA).
- Desplegar en Render con las variables `VITE_*` y de servidor.
- Seguridad (refuerzo, doc `docs/seguridad.md`): Pedro debe ejecutar `supabase_migration_seguridad_2.sql`, borrar `VITE_RESEND_API_KEY`/`VITE_WHATSAPP_ACCESS_TOKEN` de `.env` y Render (ahora se usan `RESEND_API_KEY` y `WHATSAPP_ACCESS_TOKEN` en el servidor) y rotar esas claves si llegaron a publicarse. Contraseñas: mínimo 10 caracteres con letras y números (`backend/security.js`).
- Avance de obra por partida y enlace de subcontrata por asignación (doc `docs/avance-obra.md`): Pedro debe ejecutar `supabase_schema_avance_obra.sql` en Supabase. WhatsApp Cloud API opcional (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`).
- Facturación legal (plan por fases hasta julio de 2027): fases 1 y 2 hechas (doc `docs/verifactu.md`: anulación, rectificativas, subsanación, envío SOAP con certificado cifrado, IVA por tipo de obra, Facturae sin firmar, libro registro CSV). Pedro debe ejecutar `supabase_schema_facturacion.sql` en Supabase, poner `CERT_ENCRYPTION_KEY` y `VERIFACTU_*` en `.env`/Render, subir su certificado y probar contra la AEAT en pruebas. Faltan: clientes extranjeros (`IDOtro`), firma de Facturae y asientos contables. Hasta pasar a producción, Factusol sigue emitiendo las facturas reales.
- Plantilla PDF de presupuestos y facturas (formato de Marchelo Reformas, Ajustes > Plantilla PDF; código en `src/utils/documentPdf.js`): Pedro debe rellenar teléfonos, web y textos en Ajustes > Plantilla PDF y ejecutar en el SQL Editor `memoria-ia-presupuestos.sql` (está en los archivos del proyecto, no en el repo porque lleva sus precios) para cargar en la Memoria de la IA cómo redactar presupuestos.
Entorno del usuario: Windows, PowerShell; carpeta `C:\Users\chedrin\OBRIA-CRM-TOTAL`.

## Diagnóstico sugerido del login, en orden
1. Supabase > Table Editor > `profiles`: ¿existe la fila con `username='admin'`, `role='admin'`, `is_active=true` y `auth_email` igual al email de Auth?
2. Supabase > Authentication > Users: usuario confirmado; probar contraseña con `signInWithPassword` directo.
3. `GET /api/health` y variables de entorno del servidor (¿responde 503 "autenticación no configurada"?).
4. Navegador: pestaña Red, respuesta de `/api/auth/login` (401 credenciales, 429 límite de intentos, 503 sin configurar).
5. Si se sirve `dist/` antiguo: el `.render-build.sh`/build debe regenerarlo con las variables `VITE_*`.
