-- Dos logros más de coleccionista (tanda 798, NU9): una región de la Pokédex
-- entera y 100 cambios hechos (los de supabase-migration-cambios-hechos.sql).
-- Los cuentan /mi-coleccion y js/gamification.js. Se puede ejecutar más de una vez.
begin;

insert into public.achievement_definitions (id, title, description, emoji, rarity, xp_reward, is_active, condition)
values
  ('coleccion_region', 'Región completa', 'Tienes al menos una carta de cada Pokémon de una región entera.', 'compass', 'gold', 100, true, '{"type": "collection_pokedex_regions", "count": 1}'::jsonb),
  ('cambios_100', 'Cien cambios', 'Has cerrado 100 cambios con otras personas de PokeDoc.', 'refreshCw', 'platinum', 150, true, '{"type": "trades_done_count", "count": 100}'::jsonb)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  emoji = excluded.emoji,
  rarity = excluded.rarity,
  xp_reward = excluded.xp_reward,
  is_active = excluded.is_active,
  condition = excluded.condition;

commit;
