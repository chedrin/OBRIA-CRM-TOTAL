# Instrucciones para Claude

- Ve al grano, evita saludos, no repitas código completo y suprime explicaciones redundantes.
- Responde en español. Nunca pidas ni escribas claves reales en archivos del repo (repo público).

# Contexto del proyecto (OBRAMASTER / OBRIA-CRM-TOTAL)

App para constructor: React + Vite (`src/`), servidor Node sin framework (`backend/server.js`), Supabase (Auth + tablas), despliegue en Render (`render.yaml`).

## Objetivos del usuario (Pedro, comunica en español)
1. **Acceso (prioridad máxima):** no puede entrar con el usuario/contraseña creados en Supabase. Quiere admin `admin`, correo `chedrin13@gmail.com`, contraseña `admin123` (débil: recomendar cambiarla).
2. **Base de datos Supabase** funcionando bien.
3. **IA integrada** con Gemini, Claude y OpenAI: mejora textos de campos y prepara presupuestos según ejemplos guardados en Ajustes, aprendiendo de cambios y órdenes, sin perder contexto.

## Cómo funciona el login (causa más probable del fallo)
- `POST /api/auth/login` (`backend/authRoutes.js`) busca primero en la tabla `public.profiles` (por `username`, `auth_email`, `email`, DNI o teléfono) y solo después valida la contraseña con Supabase Auth (`signInWithPassword` usando `profiles.auth_email`).
- Un usuario creado solo en Authentication > Users NO tiene fila en `profiles` → siempre "Usuario o contraseña incorrectos".
- Requisitos: ejecutar `supabase_migration_seguridad.sql`; variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (servidor) y `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (build) en `.env` local o Render.
- Reparación: `node scripts/crearAdmin.js --usuario admin --email chedrin13@gmail.com --password admin123` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno. Crea/actualiza el usuario en Auth (confirmado) y su fila en `profiles` con rol admin.

## Estado (rama `feat/admin-ia-memoria`, sin fusionar en `main`)
Hecho: script `crearAdmin.js` (admin creado y login FUNCIONANDO en local, `npm run build` y `npm start` OK); memoria de IA (`backend/aiMemory.js`, `supabase_schema_ai_memory.sql`, pestaña Ajustes > Memoria de la IA `AiMemoryConfig.jsx`); correcciones capturadas desde `AiImprovementControl.jsx` y `ConsolaRevisionPresupuesto.jsx`; claves de IA sin prefijo `VITE_`; modelos por defecto `gemini-3.8-flash`, `claude-sonnet-5-5`, `chat-latest`.
Causa real del fallo de acceso: `VITE_SUPABASE_ANON_KEY` del `.env` local era un texto de 7 caracteres (no la clave real) y las líneas del `.env` tenían espacios delante. La web falló al abrir sesión (401 de Supabase). Solución: `.env` limpio, mismas claves en `VITE_SUPABASE_ANON_KEY` y `SUPABASE_ANON_KEY`, y recompilar.
Pendiente:
- Pedro debe rotar la clave `service_role` de Supabase (la pegó en un chat) y actualizarla en `.env` y Render.
- Cambiar la contraseña `admin123` por una fuerte.
- Ejecutar `supabase_schema_ai_memory.sql` en Supabase; verificar que `supabase_migration_seguridad.sql` está ejecutado.
- Poner `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` en `.env` y en Render; probar IA de extremo a extremo (mejorar texto, generar presupuesto, Memoria de la IA).
- Revisar la rama y fusionarla en `main` (PR); desplegar en Render con las variables `VITE_*` y de servidor.
- Seguridad: `VITE_RESEND_API_KEY` y `VITE_WHATSAPP_ACCESS_TOKEN` siguen expuestos al navegador (moverlos al servidor).
Entorno del usuario: Windows, PowerShell; carpeta `C:\Users\chedrin\OBRIA-CRM-TOTAL`.

## Diagnóstico sugerido del login, en orden
1. Supabase > Table Editor > `profiles`: ¿existe la fila con `username='admin'`, `role='admin'`, `is_active=true` y `auth_email` igual al email de Auth?
2. Supabase > Authentication > Users: usuario confirmado; probar contraseña con `signInWithPassword` directo.
3. `GET /api/health` y variables de entorno del servidor (¿responde 503 "autenticación no configurada"?).
4. Navegador: pestaña Red, respuesta de `/api/auth/login` (401 credenciales, 429 límite de intentos, 503 sin configurar).
5. Si se sirve `dist/` antiguo: el `.render-build.sh`/build debe regenerarlo con las variables `VITE_*`.
