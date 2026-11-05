-- ENFLORA · Diagnóstico de solo lectura del feedback.
-- No crea, no borra y no actualiza. No devuelve mensajes, correos ni notas.
-- Ejecutarlo en el SQL Editor del proyecto de ENFLORA.

select
  to_regclass('public.feedback_usuarios') as feedback_usuarios,
  to_regclass('public.admin_auditoria_feedback') as auditoria;

select
  p.proname as funcion,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  p.prosecdef as security_definer,
  (p.prosrc like '%' || 'chr' || '(0)' || '%') as contiene_nul_roto,
  has_function_privilege('anon', p.oid, 'execute') as ejecuta_anon,
  has_function_privilege('authenticated', p.oid, 'execute') as ejecuta_authenticated,
  has_function_privilege('service_role', p.oid, 'execute') as ejecuta_service_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'enviar_feedback_usuario',
    'listar_feedback_admin',
    'detalle_feedback_admin',
    'gestionar_feedback_admin',
    'feedback_admin_enmascarar'
  )
order by 1;

select
  c.relname as tabla,
  c.relrowsecurity as rls,
  has_table_privilege('anon', c.oid, 'select') as select_anon,
  has_table_privilege('authenticated', c.oid, 'select') as select_authenticated,
  has_table_privilege('authenticated', c.oid, 'insert') as insert_authenticated,
  has_table_privilege('service_role', c.oid, 'select') as select_service_role
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('feedback_usuarios', 'admin_auditoria_feedback');

select count(*)::bigint as politicas
from pg_policy pol
join pg_class c on c.oid = pol.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('feedback_usuarios', 'admin_auditoria_feedback');
