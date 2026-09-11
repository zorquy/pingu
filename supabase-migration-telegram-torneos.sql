-- Los torneos, al canal de Telegram (tanda 287).
--
-- Misma pieza que la de las noticias: una columna que apunta CUÁNDO se
-- mandó, para que la función programada sepa cuál queda por mandar y no
-- repita ninguna.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede volver a ejecutar
-- entera sin romper nada.

alter table public.tournaments
  add column if not exists telegram_sent_at timestamptz;

comment on column public.tournaments.telegram_sent_at is
  'Cuándo se anunció este torneo en el canal de Telegram. NULL = pendiente.';

-- ── LA RED DEL ESTRENO ──
--
-- Sin esto, la primera pasada de la función soltaría de golpe en el canal
-- TODOS los torneos que ya tienen las inscripciones abiertas. Se dan por
-- mandados los que ya existen: el canal empieza a contar desde hoy.
update public.tournaments
   set telegram_sent_at = now()
 where telegram_sent_at is null;

-- El índice solo cubre lo pendiente, que es lo único que se consulta (y
-- que en régimen normal son cero filas o una).
create index if not exists tournaments_telegram_pendientes
  on public.tournaments (start_at)
  where telegram_sent_at is null;

notify pgrst, 'reload schema';
