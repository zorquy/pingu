-- Trofeo "Primeros pasos"
-- ============================================================
--
-- Quien se registra desde un vídeo o desde un enlace aterriza en la portada
-- y ve una web con muchas cosas y ninguna primera. Se va sin hacer nada, y
-- quien no hace nada el primer día no vuelve.
--
-- La portada le pone delante TRES acciones concretas —leer una guía, hacer
-- un curso y escribir en el foro— y al completarlas se lleva este trofeo.
-- Son una de cada pata de PokeDoc a propósito: leer, jugar y hablar. Quien
-- ha hecho las tres ya sabe lo que es esto.
--
-- La cuenta la lleva el propio sitio (ver js/primeros-pasos.js y la
-- condición `primeros_pasos` de js/gamification.js): esta migración solo
-- da de alta la fila del trofeo.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

insert into public.achievements (id, title, description, emoji, rarity, xp_reward, is_active, condition)
values (
  'primeros_pasos',
  'Primeros pasos',
  'Leíste una guía, hiciste un curso y te presentaste en el foro.',
  'sprout',
  'bronze',
  25,
  true,
  '{"type": "primeros_pasos", "count": 3}'::jsonb
)
-- Si ya estaba, se le refresca el texto y la condición pero NO se toca a
-- quién se le ha concedido: los trofeos ganados se guardan en
-- user_profiles.achievements y esto no los mira.
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  emoji = excluded.emoji,
  rarity = excluded.rarity,
  xp_reward = excluded.xp_reward,
  is_active = excluded.is_active,
  condition = excluded.condition;

commit;

-- ── Comprobación ──
--
-- select id, title, condition from public.achievements where id = 'primeros_pasos';
--
-- Y para ver a cuánta gente le falta poco (los tres pasos de un vistazo):
--
-- select
--   p.username,
--   (select count(*) from public.user_progress up where up.user_id = p.id and up.read_at is not null) > 0 as ha_leido,
--   (select count(*) from public.user_progress up where up.user_id = p.id and up.status = 'completed') > 0 as ha_hecho_curso,
--   (select count(*) from public.forum_posts fp where fp.author_id = p.id) > 0 as ha_escrito
-- from public.user_profiles p
-- where not (p.achievements @> array['primeros_pasos'])
-- order by p.created_at desc
-- limit 30;
