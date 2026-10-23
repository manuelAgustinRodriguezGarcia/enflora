alter table public.push_envios
  add column if not exists recibido_en timestamptz;

alter table public.push_envios
  add column if not exists recibo_hash text;

revoke all on public.push_envios from anon, authenticated;
grant select, insert, update, delete on public.push_envios to service_role;
