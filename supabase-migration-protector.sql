-- El protector de racha: un comodín que salva la racha cuando se
-- pierde UN día (dos o más, no: eso ya es dejarlo, no un despiste).
--
-- Se gana jugando: cada 7 días seguidos de racha, un protector, con un
-- tope de 2 guardados. Se gasta solo — la primera visita tras el día
-- perdido lo consume y la racha sigue como si nada (js/gamification.js,
-- checkDailyStreak).
--
-- Va como columna de user_profiles, junto a current_streak y
-- last_active_date (supabase-migration-streak.sql): es estado del
-- perfil, no un histórico.

alter table user_profiles add column if not exists streak_shields integer not null default 0;

comment on column user_profiles.streak_shields is
  'Protectores de racha guardados (tope 2). Se gana uno cada 7 días de racha; uno salva un único día perdido.';

-- La columna la escribe el propio usuario (la lógica vive en el
-- cliente, como la racha entera): las políticas de update de
-- user_profiles ya limitan a cada cual a su fila, así que no hace
-- falta ninguna política nueva.

-- PostgREST guarda en memoria el esquema que conoce. Sin este aviso, una
-- columna recién creada NO existe para la API hasta que a Supabase le da
-- por recargar: el cliente recibe «Could not find the 'x' column of 'y'
-- in the schema cache» y parece que la migración no se ha ejecutado.
-- Pasó el 2026-09-02 con match_log.tipo, ya ejecutada (tanda 250).
notify pgrst, 'reload schema';
