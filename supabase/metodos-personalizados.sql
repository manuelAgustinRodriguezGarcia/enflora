create table if not exists public.metodos_personalizados (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  fecha_creacion timestamptz not null default now(),
  constraint metodos_personalizados_nombre_no_vacio check (char_length(trim(nombre)) > 0),
  constraint metodos_personalizados_usuario_nombre_unico unique (usuario_id, nombre)
);

create index if not exists metodos_personalizados_usuario_id_idx
on public.metodos_personalizados (usuario_id);

alter table public.metodos_personalizados enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'metodos_personalizados'
      and policyname = 'usuario_gestiona_sus_metodos'
  ) then
    create policy usuario_gestiona_sus_metodos
    on public.metodos_personalizados
    for all
    to authenticated
    using (auth.uid() = usuario_id)
    with check (auth.uid() = usuario_id);
  end if;
end $$;

grant select, insert, update, delete on public.metodos_personalizados to authenticated;
