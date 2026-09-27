-- 008_fix_trigger_search_path.sql
-- Arreglo del registro (y de otros triggers): las funciones SECURITY DEFINER de trigger
-- no tenian search_path fijo, asi que al invocarlas desde una sesion cuyo search_path no
-- incluye public (GoTrue en el alta de usuario, por ejemplo) no encontraban las tablas.
-- Sintoma original: POST /auth/v1/signup -> 500 "Database error saving new user",
-- con `ERROR: relation "profiles" does not exist (SQLSTATE 42P01)` en los logs de auth.
-- Aplicado en produccion el 2026-09-27; esta migracion lo deja reproducible en una base nueva.

do $$
declare f record;
begin
  for f in
    select distinct p.oid::regprocedure as sig
    from pg_proc p
    join pg_trigger t on t.tgfoid = p.oid and not t.tgisinternal
    where p.pronamespace = 'public'::regnamespace
      and (p.proconfig is null or not array_to_string(p.proconfig, ',') ilike '%search_path%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
    raise notice 'search_path fijado en %', f.sig;
  end loop;
end $$;

-- Verificacion: ninguna funcion de trigger de public debe quedar sin search_path.
do $$
declare faltan integer;
begin
  select count(*) into faltan
  from pg_proc p
  join pg_trigger t on t.tgfoid = p.oid and not t.tgisinternal
  where p.pronamespace = 'public'::regnamespace
    and (p.proconfig is null or not array_to_string(p.proconfig, ',') ilike '%search_path%');
  if faltan > 0 then
    raise exception 'quedan % funciones de trigger sin search_path', faltan;
  end if;
end $$;
