alter table public.plantas add column if not exists numero integer;
alter table public.plantas add column if not exists metodo text;
alter table public.plantas add column if not exists sustrato text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plantas_numero_positivo'
      and conrelid = 'public.plantas'::regclass
  ) then
    alter table public.plantas
      add constraint plantas_numero_positivo check (numero is null or numero > 0);
  end if;
end $$;

create unique index if not exists plantas_espacio_numero_idx
on public.plantas (espacio_id, numero)
where numero is not null;
