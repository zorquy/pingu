-- Tanda 1326 — /sobre con cifras vivas y quién lo hace (D1 del plan 2027).
--
-- Una sola función, `sobre_cifras()`, que puede llamar cualquiera (también sin
-- cuenta: /sobre es la página que se le enseña a prensa y tiendas). Devuelve
-- CUATRO cuentas y el EQUIPO:
--   · personas: cuentas que no son de tienda ni están baneadas;
--   · cartas: copias apuntadas en colecciones (la suma de `cantidad`);
--   · temas: temas del foro;
--   · torneos: torneos terminados.
-- Y el equipo, solo lo que ya enseña un perfil público (nombre, usuario,
-- avatar y rango): admin, moderación y redacción. Nada de correo ni de nada
-- de `user_privado` (1306).
--
-- Es `security definer` porque contar `user_collection` entera no lo deja la
-- RLS (cada uno lee lo suyo), y una cuenta de toda la tabla no dice nada de
-- nadie. Sin la migración, /sobre esconde las cifras y el equipo (la web lo
-- prueba con `sinMigracion`) y el resto de la página se ve igual.

create or replace function public.sobre_cifras()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'personas', (select count(*) from public.user_profiles p
                  where coalesce(p.tipo, 'persona') <> 'tienda'
                    and not coalesce(p.is_banned, false)),
    'cartas',   (select coalesce(sum(c.cantidad), 0) from public.user_collection c),
    'temas',    (select count(*) from public.forum_threads),
    'torneos',  (select count(*) from public.tournaments t where t.status = 'finished'),
    'equipo',   coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'username', p.username,
               'display_name', p.display_name,
               'avatar_url', p.avatar_url,
               'is_admin', coalesce(p.is_admin, false),
               'is_moderator', coalesce(p.is_moderator, false),
               'is_writer', coalesce(p.is_writer, false)
             ) order by coalesce(p.is_admin, false) desc,
                        coalesce(p.is_moderator, false) desc,
                        p.created_at)
        from public.user_profiles p
       where (coalesce(p.is_admin, false) or coalesce(p.is_moderator, false) or coalesce(p.is_writer, false))
         and coalesce(p.tipo, 'persona') <> 'tienda'
         and not coalesce(p.is_banned, false)
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.sobre_cifras() from public;
grant execute on function public.sobre_cifras() to anon, authenticated;
