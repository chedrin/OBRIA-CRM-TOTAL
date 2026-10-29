-- ObraMaster - Reenviar enlaces de subcontrata
-- Ejecutar en Supabase > SQL Editor (después de supabase_schema_notificaciones.sql).
--
-- Guarda el token del enlace cifrado (AES-256-GCM con LINK_ENCRYPTION_KEY o, si falta,
-- CERT_ENCRYPTION_KEY del servidor) para poder copiar y reenviar el MISMO enlace a la
-- subcontrata hasta que el trabajo esté certificado al 100 %. La búsqueda sigue usando
-- solo la huella SHA-256 (token_hash). Sin esta columna, reenviar genera un enlace nuevo.

alter table public.subcontractor_tokens add column if not exists token_enc text;
