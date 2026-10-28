# Seguridad de ObraMaster

## Qué protege la app

- **Login y API**: todo `/api` exige la sesión de Supabase salvo `/api/health`, `/api/auth/login` y los enlaces de subcontrata (`/api/sub/<token>`, protegidos por un token aleatorio guardado como hash). Los obreros solo pueden usar las rutas de `WORKER_ALLOWED_PATHS` (`backend/authRoutes.js`).
- **Intentos de login**: 8 fallos por cuenta o 40 por IP en 10 minutos bloquean temporalmente.
- **Contraseñas** (`backend/security.js`): mínimo 10 caracteres, letras y números o símbolos, sin contraseñas típicas (`admin123`...) ni el nombre de usuario. Si alguien entra con una contraseña que no cumple, la web le avisa para que la cambie.
- **Cabeceras**: CSP (solo scripts del propio dominio), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS en Render.
- **CORS**: cerrado por defecto (la web y la API van en el mismo dominio). `CORS_ORIGIN` admite una lista separada por comas.
- **Tamaño de peticiones**: 40 MB máximo en la API general; 64 KB en login y 256 KB en el resto de JSON.
- **Claves**: las de IA, Resend y WhatsApp solo viven en el servidor. `GET /api/settings/ai` ya no devuelve claves, solo si hay una y sus 4 últimas cifras. Presupuestos y facturas se envían por `POST /api/documents/send-email` y `/send-whatsapp`.
- **Base de datos**: RLS en todas las tablas; el rol `anon` no tiene acceso a nada de `public`; solo el servidor (service_role) se salta RLS.

## Lo que tiene que hacer Pedro

1. Supabase > SQL Editor: pegar y ejecutar `supabase_migration_seguridad_2.sql`. El informe final debe salir vacío.
2. En `.env` y en Render: borrar `VITE_RESEND_API_KEY`, `VITE_RESEND_FROM_EMAIL`, `VITE_WHATSAPP_ACCESS_TOKEN` y `VITE_WHATSAPP_PHONE_NUMBER_ID`; usar `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`. Si la web se llegó a publicar con las `VITE_`, rotar esas claves.
3. Rotar la clave `service_role` de Supabase (se pegó en un chat) y actualizarla en `.env` y Render.
4. Cambiar la contraseña del admin por una que cumpla la regla nueva.
5. Si `CORS_ORIGIN` está en Render con `*`, borrarla.
