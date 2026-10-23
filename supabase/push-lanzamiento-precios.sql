alter table public.push_suscripciones
  add column if not exists ultimo_envio_ok_en timestamptz;

revoke all on public.push_suscripciones from anon, authenticated;
grant select, insert, update, delete on public.push_suscripciones to service_role;

update public.push_campanas
set mensaje = 'Flora te estaba esperando. Entrá y empezá a registrar tus cultivos.'
where clave = 'lanzamiento-2026-11'
  and estado in ('borrador', 'programada')
  and iniciada_en is null;
