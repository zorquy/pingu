-- Tanda 1295 — «Eres el nº 14 de PokeDoc» (la sala del evento, la A de la
-- propuesta «Que se vea quién va», PINGU: «haz lo recomendado»).
--
-- `evento_json` devuelve además `mi_numero`: en qué puesto te apuntaste,
-- contando a TODOS los que van (también los que van «sin decirlo», que no
-- salen en `caras`). Sin esto la web solo puede saber tu número cuando nadie
-- va sin decirlo; con esto, siempre. Empates en la misma hora, por user_id.
-- Cambiar a «sin decirlo» no te mueve de puesto: `evento_voy` hace un upsert y
-- no toca `created_at`.
--
-- Es la función de la 1192 entera con una línea más (create or replace con
-- la misma firma). Se puede ejecutar dos veces; cada sentencia vale por sí
-- sola (la 631).

create or replace function public.evento_json(e public.eventos, p_caras int default 5)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(e) - 'creado_por'
    || jsonb_build_object(
      'van', (select count(*) from evento_asistentes a where a.evento_id = e.id),
      'caras', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) order by a.created_at)
        from (select * from evento_asistentes a where a.evento_id = e.id and not a.oculto order by a.created_at limit greatest(p_caras, 0)) a
        join user_profiles p on p.id = a.user_id
      ), '[]'::jsonb),
      'voy', exists (select 1 from evento_asistentes a where a.evento_id = e.id and a.user_id = auth.uid()),
      'oculto', coalesce((select a.oculto from evento_asistentes a where a.evento_id = e.id and a.user_id = auth.uid()), false),
      'mi_numero', (
        select count(*) from evento_asistentes o, evento_asistentes yo
        where yo.evento_id = e.id and yo.user_id = auth.uid()
          and o.evento_id = e.id
          and (o.created_at, o.user_id) <= (yo.created_at, yo.user_id)
      )
    )
$$;

revoke all on function public.evento_json(public.eventos, int) from public;

notify pgrst, 'reload schema';
