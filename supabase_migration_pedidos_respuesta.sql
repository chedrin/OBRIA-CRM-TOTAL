-- =========================================================================
-- ObraMaster - Pedidos manuales a proveedores y respuesta del proveedor
-- =========================================================================
-- Qué añade (sobre supabase_schema_notificaciones.sql, que debe estar ejecutado):
--   - Un pedido puede ir asociado a VARIAS obras (obra_ids) y llevar su propia
--     dirección de entrega (delivery_address).
--   - Campos para apuntar la respuesta del proveedor: estado, fecha de entrega,
--     importe, notas y el correo de respuesta pegado tal cual.
--
-- Cómo ejecutarlo: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Se puede ejecutar más de una vez sin romper nada. No borra datos.
-- =========================================================================

alter table public.worksite_needs
  add column if not exists obra_ids         text[] not null default '{}',
  add column if not exists delivery_address text;

alter table public.material_orders
  add column if not exists obra_ids        text[] not null default '{}',
  add column if not exists response_status text not null default 'pendiente',
  add column if not exists delivery_date   date,
  add column if not exists quoted_amount   numeric(12, 2),
  add column if not exists response_notes  text,
  add column if not exists supplier_reply  text,
  add column if not exists responded_at    timestamptz;

alter table public.material_orders drop constraint if exists material_orders_response_status_check;
alter table public.material_orders
  add constraint material_orders_response_status_check
  check (response_status in ('pendiente', 'confirmado', 'parcial', 'rechazado'));

-- Rellena obra_ids en lo que ya existía (una sola obra).
update public.worksite_needs  set obra_ids = array[obra_id] where obra_id is not null and obra_ids = '{}';
update public.material_orders set obra_ids = array[obra_id] where obra_id is not null and obra_ids = '{}';

create index if not exists worksite_needs_obra_ids_idx  on public.worksite_needs  using gin (obra_ids);
create index if not exists material_orders_obra_ids_idx on public.material_orders using gin (obra_ids);
create index if not exists material_orders_delivery_idx on public.material_orders (delivery_date) where delivery_date is not null;
