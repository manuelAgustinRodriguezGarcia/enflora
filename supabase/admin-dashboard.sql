-- ENFLORA · Admin Sprint 2 · Resumen agregado del dashboard.
--
-- ARCHIVO INCREMENTAL. NO se ejecuta automáticamente.
-- Aplicarlo a mano en el SQL Editor de Supabase, después de esquema.sql, registros.sql y registro-fotos.sql.
-- Antes, correr las consultas de verificación de columnas (auth.users y tablas de cultivo).
--
-- Es idempotente y no escribe datos:
--   CREATE OR REPLACE conserva el dueño y los GRANT anteriores.
--   El REVOKE de abajo vuelve a cerrar anon, authenticated y PUBLIC después de cada reemplazo.
--   No hay CREATE/ALTER de tablas, índices ni INSERT/UPDATE/DELETE.
--
-- Devuelve solo conteos. No devuelve nombres, correos, observaciones, rutas, fotos ni mensajes.
-- No hay funciones auxiliares.
--
-- Fuentes que SÍ están en el repositorio. Cada total es un conteo de una sola tabla,
-- sin unir espacios, unidades, plantas, registros ni fotos (un join multiplicaría filas):
--   public.espacios
--   public.unidades_cultivo
--   public.plantas            (activas y finalizadas; estado no se filtra)
--   public.registros          (fecha_creacion timestamptz, usuario_id; una fila = un registro)
--   public.registro_fotos     (tamano_bytes = tamaño declarado del archivo original)
--
-- Fuente que NO está definida en el repositorio:
--   auth.users. Se usan columnas estándar de GoTrue: created_at, deleted_at, is_anonymous.
--   public.perfiles no tiene fecha de alta, así que los usuarios nuevos no se pueden contar desde ahí.
--   Si deleted_at o is_anonymous no existen, esta función no se puede crear.
--
-- Usuarios: cuentas de auth.users con deleted_at nulo y no anónimas.
--   Un is_anonymous nulo se trata como cuenta normal.
--   Un created_at nulo entra en el total y queda fuera de las ventanas.
--   No distingue correo confirmado ni fila en perfiles.
--
-- Períodos, calculados una sola vez con el reloj de la transacción:
--   7 y 30 días: ventanas corridas, created_at o fecha_creacion >= now() - interval.
--   Gráfico: 30 fechas calendario en America/Argentina/Buenos_Aires, hoy incluido.
--   Las dos medidas no tienen por qué coincidir.
--   usuarios_con_registros_* cuenta usuario_id distintos con un registro en la ventana.
--   No mide sesiones ni última actividad.
--
-- Lo que este resumen NO mide:
--   almacenamiento total del bucket (miniaturas, portadas de unidades y objetos del storage).
--
-- Permiso: execute solo para service_role. El panel exige además la credencial del módulo dashboard.
-- SECURITY DEFINER se ejecuta como el dueño de la función (quien corre este archivo; en Supabase, postgres).
-- search_path vacío: toda tabla y función va calificada. pg_catalog no queda tapado por objetos de public.

create or replace function public.resumen_dashboard_admin()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cortes as (
    select
      reloj.ahora,
      reloj.ahora - interval '7 days' as corte_7,
      reloj.ahora - interval '30 days' as corte_30,
      ((reloj.ahora at time zone 'America/Argentina/Buenos_Aires')::pg_catalog.date - 29) as inicio_serie,
      (reloj.ahora at time zone 'America/Argentina/Buenos_Aires')::pg_catalog.date as fin_serie
    from (select pg_catalog.now() as ahora) as reloj
  ),
  usuarios as (
    select u.created_at
    from auth.users as u
    where u.deleted_at is null
      and pg_catalog.coalesce(u.is_anonymous, false) = false
  ),
  usuarios_agg as (
    select
      pg_catalog.count(*)::pg_catalog.bigint as total,
      pg_catalog.count(*) filter (where u.created_at >= c.corte_7)::pg_catalog.bigint as nuevos_7,
      pg_catalog.count(*) filter (where u.created_at >= c.corte_30)::pg_catalog.bigint as nuevos_30
    from usuarios as u
    cross join cortes as c
  ),
  registros_agg as (
    select
      pg_catalog.count(*)::pg_catalog.bigint as total,
      pg_catalog.count(*) filter (where r.fecha_creacion >= c.corte_7)::pg_catalog.bigint as registros_7,
      pg_catalog.count(*) filter (where r.fecha_creacion >= c.corte_30)::pg_catalog.bigint as registros_30,
      pg_catalog.count(distinct r.usuario_id) filter (where r.fecha_creacion >= c.corte_7)::pg_catalog.bigint as usuarios_7,
      pg_catalog.count(distinct r.usuario_id) filter (where r.fecha_creacion >= c.corte_30)::pg_catalog.bigint as usuarios_30
    from public.registros as r
    cross join cortes as c
  ),
  fotos_agg as (
    select
      pg_catalog.count(*)::pg_catalog.bigint as fotos,
      pg_catalog.coalesce(pg_catalog.sum(f.tamano_bytes), 0)::pg_catalog.bigint as bytes_originales
    from public.registro_fotos as f
  ),
  dias as (
    select gs.dia::pg_catalog.date as dia
    from cortes as c
    cross join lateral pg_catalog.generate_series(
      c.inicio_serie::pg_catalog.timestamp,
      c.fin_serie::pg_catalog.timestamp,
      interval '1 day'
    ) as gs(dia)
  ),
  altas_dia as (
    select
      (u.created_at at time zone 'America/Argentina/Buenos_Aires')::pg_catalog.date as dia,
      pg_catalog.count(*)::pg_catalog.bigint as cantidad
    from usuarios as u
    cross join cortes as c
    where u.created_at >= (c.inicio_serie::pg_catalog.timestamp at time zone 'America/Argentina/Buenos_Aires')
      and u.created_at < ((c.fin_serie + 1)::pg_catalog.timestamp at time zone 'America/Argentina/Buenos_Aires')
    group by 1
  ),
  registros_dia as (
    select
      (r.fecha_creacion at time zone 'America/Argentina/Buenos_Aires')::pg_catalog.date as dia,
      pg_catalog.count(*)::pg_catalog.bigint as cantidad
    from public.registros as r
    cross join cortes as c
    where r.fecha_creacion >= (c.inicio_serie::pg_catalog.timestamp at time zone 'America/Argentina/Buenos_Aires')
      and r.fecha_creacion < ((c.fin_serie + 1)::pg_catalog.timestamp at time zone 'America/Argentina/Buenos_Aires')
    group by 1
  ),
  serie as (
    select
      d.dia,
      pg_catalog.coalesce(a.cantidad, 0)::pg_catalog.bigint as usuarios_nuevos,
      pg_catalog.coalesce(rd.cantidad, 0)::pg_catalog.bigint as registros
    from dias as d
    left join altas_dia as a on a.dia = d.dia
    left join registros_dia as rd on rd.dia = d.dia
  )
  select pg_catalog.jsonb_build_object(
    'generado_en', c.ahora,
    'periodo_corto', 7,
    'periodo_largo', 30,
    'usuarios_total', u.total,
    'usuarios_nuevos_7', u.nuevos_7,
    'usuarios_nuevos_30', u.nuevos_30,
    'espacios', (select pg_catalog.count(*)::pg_catalog.bigint from public.espacios),
    'unidades', (select pg_catalog.count(*)::pg_catalog.bigint from public.unidades_cultivo),
    'plantas', (select pg_catalog.count(*)::pg_catalog.bigint from public.plantas),
    'registros_total', g.total,
    'registros_7', g.registros_7,
    'registros_30', g.registros_30,
    'usuarios_con_registros_7', g.usuarios_7,
    'usuarios_con_registros_30', g.usuarios_30,
    'fotos_registros', f.fotos,
    'bytes_fotos_originales', f.bytes_originales,
    'serie', pg_catalog.coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'dia', pg_catalog.to_char(s.dia, 'YYYY-MM-DD'),
          'usuarios_nuevos', s.usuarios_nuevos,
          'registros', s.registros
        )
        order by s.dia
      )
      from serie as s
    ), '[]'::pg_catalog.jsonb)
  )
  from cortes as c
  cross join usuarios_agg as u
  cross join registros_agg as g
  cross join fotos_agg as f;
$$;

revoke all on function public.resumen_dashboard_admin() from public, anon, authenticated;
grant execute on function public.resumen_dashboard_admin() to service_role;
