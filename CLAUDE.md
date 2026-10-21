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
Hecho: script `crearAdmin.js`; memoria de IA (`backend/aiMemory.js`, `supabase_schema_ai_memory.sql`, pestaña Ajustes > Memoria de la IA `AiMemoryConfig.jsx`); correcciones capturadas desde `AiImprovementControl.jsx` y `ConsolaRevisionPresupuesto.jsx`; claves de IA sin prefijo `VITE_`; modelos por defecto `gemini-3.8-flash`, `claude-sonnet-5-5`, `chat-latest`.
Nunca verificado: `npm install && npm run build` (el entorno cloud no tenía acceso a npm). Probar primero y corregir errores.
Pendiente: seguir depurando el acceso (Pedro SIGUE sin poder entrar tras todo lo anterior: pedirle el error exacto de pantalla y revisar `/api/auth/login` en consola de red y logs de Render); ejecutar `supabase_schema_ai_memory.sql`; poner `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` en Render; probar IA de extremo a extremo.
Seguridad pendiente: `VITE_RESEND_API_KEY` y `VITE_WHATSAPP_ACCESS_TOKEN` siguen expuestos al navegador (moverlos al servidor).

## Diagnóstico sugerido del login, en orden
1. Supabase > Table Editor > `profiles`: ¿existe la fila con `username='admin'`, `role='admin'`, `is_active=true` y `auth_email` igual al email de Auth?
2. Supabase > Authentication > Users: usuario confirmado; probar contraseña con `signInWithPassword` directo.
3. `GET /api/health` y variables de entorno del servidor (¿responde 503 "autenticación no configurada"?).
4. Navegador: pestaña Red, respuesta de `/api/auth/login` (401 credenciales, 429 límite de intentos, 503 sin configurar).
5. Si se sirve `dist/` antiguo: el `.render-build.sh`/build debe regenerarlo con las variables `VITE_*`.
