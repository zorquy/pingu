-- Tanda 763 — Z3: «alguien a quien sigues da una carta que buscas».
--
-- El aviso de los cambios (supabase-migration-intercambios.sql, tanda 376)
-- ya avisa a quien busca una carta cuando alguien la pone a cambio. Lo que
-- añade esto: si quien la da es alguien a quien SIGUES, el aviso lo dice
-- con su nombre («@ana da una carta que buscas») y va con su propio tipo,
-- `trade_match_seguido`, que se puede apagar aparte. Es UN aviso por
-- persona, no dos: el disparador decide cuál de los dos le toca.
--
-- Se REEMPLAZA la función entera con los tres cuidados de la 376 (solo de
-- 0 a algo, tope de 25, sin repetir lo no leído), que siguen igual.
-- Sin tablas temporales y sentencia a sentencia (la 631).

create or replace function public.intercambios_avisar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_quien text;
begin
  if coalesce(new.cambio, 0) <= 0 or coalesce(old.cambio, 0) > 0 then
    return new;
  end if;

  select coalesce(name_es, name) into v_nombre from public.tcg_cards where id = new.card_id;
  select username into v_quien from public.user_profiles where id = new.user_id;

  insert into public.user_notifications (recipient_id, type, title, body, link)
  select d.user_id,
         case when d.sigue then 'trade_match_seguido' else 'trade_match' end,
         case when d.sigue and v_quien is not null then '@' || v_quien || ', a quien sigues, da una carta que buscas'
              else 'Alguien da una carta que buscas' end,
         d.nombre,
         '/mi-coleccion?ver=cambios'
    from (
      select distinct on (w.user_id)
             w.user_id,
             w.prioridad,
             w.created_at,
             coalesce(v_nombre, new.card_id) as nombre,
             exists (select 1 from public.user_follows f where f.follower_id = w.user_id and f.following_id = new.user_id) as sigue,
             coalesce(u.notification_prefs_disabled, '{}') as apagados
        from public.user_wants w
        join public.user_profiles u on u.id = w.user_id
       where w.card_id = new.card_id
         and w.user_id <> new.user_id
         and (w.idioma is null or w.idioma = new.idioma)
         and coalesce(u.is_banned, false) = false
         and not exists (
           select 1 from public.user_notifications n
            where n.recipient_id = w.user_id
              and n.type in ('trade_match', 'trade_match_seguido')
              and n.read_at is null
              and n.body = coalesce(v_nombre, new.card_id)
         )
       order by w.user_id, w.prioridad desc, w.created_at
    ) d
   -- Cada uno con SU preferencia: quien apagó el de los que sigue sigue
   -- recibiendo el general de los demás, y al revés.
   where not (d.apagados @> array[case when d.sigue then 'trade_match_seguido' else 'trade_match' end])
   -- Los que siguen a quien la da, primero; luego los que más la buscan.
   order by d.sigue desc, d.prioridad desc, d.created_at
   limit 25;

  return new;
end;
$$;

notify pgrst, 'reload schema';
