-- =========================================================================
-- OBRAMASTER - CONTADOR DE TOKENS DE LA IA
--
-- Guarda, por proveedor (google, openai, anthropic, openrouter), las llamadas y
-- los tokens aproximados que se ven en Ajustes > Motor IA junto a cada clave.
--
-- Cómo ejecutarlo: Supabase > SQL Editor > New query > pegar todo > Run.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- Solo el servidor (clave service_role) lee y escribe esta tabla.
-- =========================================================================

create table if not exists public.ai_usage (
  provider      text primary key,
  calls         bigint not null default 0,
  input_tokens  bigint not null default 0,
  cached_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  since         timestamptz not null default now(),
  updated_at    timestamptz
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
