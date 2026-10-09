-- Los logros de coleccionista (tanda 793, NU9).
--
-- Hasta aquí los trofeos premiaban participar (guías, cursos, foro) y los
-- torneos; ninguno coleccionar. Los cuenta /mi-coleccion con la colección
-- que ya tiene en memoria (js/logros-coleccion.js) y los tipos nuevos de
-- condición los entiende js/gamification.js. Esto solo los da de alta; el
-- admin los puede retocar o apagar desde /admin → Trofeos, como los demás.
--
-- Se puede ejecutar más de una vez: si ya están, se ponen al día.
begin;

insert into public.achievement_definitions (id, title, description, emoji, rarity, xp_reward, is_active, condition)
values
  ('coleccion_100', 'Cien cartas', 'Tienes 100 cartas distintas en tu colección.', 'layers', 'bronze', 25, true, '{"type": "collection_cards_count", "count": 100}'::jsonb),
  ('coleccion_1000', 'Mil cartas', 'Tienes 1.000 cartas distintas en tu colección.', 'layers', 'gold', 100, true, '{"type": "collection_cards_count", "count": 1000}'::jsonb),
  ('coleccion_set_completo', 'Set completo', 'Completaste una expansión entera.', 'trophy', 'silver', 50, true, '{"type": "collection_sets_complete", "count": 1}'::jsonb),
  ('coleccion_cinco_sets', 'Cinco sets completos', 'Completaste cinco expansiones enteras.', 'crown', 'platinum', 150, true, '{"type": "collection_sets_complete", "count": 5}'::jsonb),
  ('coleccion_carta_100', 'Tu primera joya', 'Tienes una carta que vale más de 100 €.', 'gem', 'silver', 40, true, '{"type": "collection_top_card_eur", "count": 100}'::jsonb),
  ('coleccion_ilustrador_50', 'Fan de un ilustrador', 'Tienes 50 cartas de un mismo ilustrador.', 'palette', 'gold', 75, true, '{"type": "collection_illustrator_cards", "count": 50}'::jsonb)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  emoji = excluded.emoji,
  rarity = excluded.rarity,
  xp_reward = excluded.xp_reward,
  is_active = excluded.is_active,
  condition = excluded.condition;

-- «Lo tiene el 3 % de PokeDoc» (NU9): cuánta gente tiene cada logro, en UNA
-- llamada. Solo cuentas, sin nombres: lo puede leer cualquiera.
create or replace function public.logros_reparto()
returns table (id text, personas bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select d.id::text,
         (select count(*) from public.user_profiles p where p.achievements @> array[d.id::text]) as personas,
         (select count(*) from public.user_profiles) as total
  from public.achievement_definitions d
  where d.is_active
$$;

grant execute on function public.logros_reparto() to anon, authenticated;

commit;
