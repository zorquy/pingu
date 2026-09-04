-- ════════════════════════════════════════════════════════════════════
-- Medallas de torneo por HITOS (tanda 262)
-- ════════════════════════════════════════════════════════════════════
--
-- Hasta hoy había tres logros de torneo y los tres eran de «lo has hecho
-- una vez»: jugar uno, entrar en un corte y ganar. Quien juega veinte
-- torneos tenía exactamente las mismas medallas que quien jugó uno.
--
-- PINGU los pidió por HITOS y no por torneo suelto (2026-09-04): una
-- medalla por cada torneo llena el perfil de iconos idénticos y con
-- veinte al año no distingue a nadie.
--
-- Los cuatro nuevos siguen el patrón de los tres que ya había:
-- condición `manual`, o sea que NO los concede el comprobador automático
-- de gamification.js —que no sabe nada de torneos— sino la ficha del
-- torneo al verlo terminado. Son idempotentes por partida doble: el
-- ON CONFLICT de aquí y la pertenencia al array `achievements` allí.
--
-- El `emoji` NO es un emoji: es el nombre de un icono de js/icons.js
-- (norma de la casa — iconos SVG, nunca emojis sueltos). Los cuatro que
-- se usan aquí existen ya: medal, star, trophy, crown.
--
-- Se ejecuta en el SQL Editor. No toca ninguna tabla de datos: solo
-- añade definiciones.

begin;

insert into public.achievement_definitions (id, title, description, emoji, rarity, xp_reward, is_active, condition)
values
  ('torneo_podio',      'Al podio',      'Terminaste entre los tres primeros de un torneo.',        'medal',  'silver', 70,  true, '{"type":"manual"}'::jsonb),
  ('torneo_veterano',   'Veterano',      'Jugaste cinco torneos de PokeDoc hasta el final.',        'star',   'silver', 80,  true, '{"type":"manual"}'::jsonb),
  ('torneo_habitual',   'De la casa',    'Diez torneos jugados. Ya eres parte del mobiliario.',     'trophy', 'gold',   150, true, '{"type":"manual"}'::jsonb),
  ('torneo_tricampeon', 'Tricampeón',    'Ganaste tres torneos de PokeDoc.',                        'crown',  'gold',   300, true, '{"type":"manual"}'::jsonb)
on conflict (id) do nothing;

commit;

-- PostgREST guarda en memoria el esquema que conoce: sin este aviso, lo
-- recién insertado puede tardar en verse desde la API.
notify pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────
-- Comprobación rápida (opcional)
-- ────────────────────────────────────────────────────────────────────
-- select id, title, rarity, xp_reward from public.achievement_definitions
--  where id like 'torneo\_%' order by id;
