-- ============================================================
-- Arregla "Failed to delete user" al borrar una cuenta desde
-- Authentication en Supabase Studio. Varias tablas apuntan a
-- auth.users(id) sin ON DELETE CASCADE ni SET NULL, así que
-- Postgres bloquea el borrado del usuario con una violación de
-- clave foránea en cuanto tiene una sola fila en cualquiera de
-- ellas — y el Studio no muestra el motivo real, solo un [] vacío.
--
-- Reglas elegidas:
-- - user_profiles, account_deletion_requests, app_feedback,
--   content_reports: se borran junto con el usuario (son datos que
--   no tienen sentido sin él).
-- - client_errors, page_views, guides.author_id: se conservan y
--   solo se pone a NULL la referencia (el registro de error o la
--   vista de página sigue siendo útil, y una guía no debería
--   desaparecer porque su autor borre la cuenta — pasa a mostrarse
--   como "Guía oficial de PokeDoc", que ya es como se comporta el
--   código cuando author_id es null).
--
-- Se salta automáticamente cualquier tabla que todavía no exista en
-- tu base (por si alguna de sus migraciones no se ha ejecutado
-- todavía) y busca el nombre real de cada restricción en vez de
-- asumirlo, así que da igual cómo se llame.
-- ============================================================

do $$
declare
  targets text[][] := array[
    array['public.user_profiles', 'id', 'CASCADE'],
    array['public.account_deletion_requests', 'user_id', 'CASCADE'],
    array['public.app_feedback', 'user_id', 'CASCADE'],
    array['public.content_reports', 'reporter_id', 'CASCADE'],
    array['public.client_errors', 'user_id', 'SET NULL'],
    array['public.page_views', 'user_id', 'SET NULL'],
    array['public.guides', 'author_id', 'SET NULL']
  ];
  t text[];
  fk record;
  col_attnum smallint;
  new_conname text;
begin
  foreach t slice 1 in array targets
  loop
    if to_regclass(t[1]) is null then
      raise notice 'Tabla % no existe todavía, se salta.', t[1];
      continue;
    end if;

    select attnum into col_attnum
    from pg_attribute
    where attrelid = t[1]::regclass and attname = t[2] and not attisdropped;

    if col_attnum is null then
      raise notice 'Columna %.% no existe todavía, se salta.', t[1], t[2];
      continue;
    end if;

    for fk in
      select conname from pg_constraint
      where conrelid = t[1]::regclass
        and confrelid = 'auth.users'::regclass
        and contype = 'f'
        and conkey = array[col_attnum]
    loop
      execute format('alter table %s drop constraint %I', t[1], fk.conname);
    end loop;

    new_conname := replace(t[1], 'public.', '') || '_' || t[2] || '_fkey';
    execute format(
      'alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete %s',
      t[1], new_conname, t[2], t[3]
    );
  end loop;
end $$;
