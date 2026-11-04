-- Índice para buscar las instalaciones activas de una cuenta.
-- No borra suscripciones ni cambia datos existentes.
-- Ejecutar en el SQL Editor de Supabase, una sola vez.

create index if not exists push_suscripciones_usuario_activas_idx
  on public.push_suscripciones (usuario_id)
  where activa = true and usuario_id is not null;
