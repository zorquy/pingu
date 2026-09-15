-- Los torneos, al canal de Telegram (tanda 287).
--
-- Misma pieza que la de las noticias: una columna que apunta CUÁNDO se
-- mandó, para que la función programada sepa cuál queda por mandar y no
-- repita ninguna.
--
-- ⚠️ CORREGIDA EN LA TANDA 302. La versión de la 287 traía esto:
--
--     update public.tournaments set telegram_sent_at = now()
--      where telegram_sent_at is null;
--
-- copiado tal cual de la migración de noticias. Y ahí valía: una noticia
-- publicada está en el PASADO, y soltar el archivo entero en el canal el
-- día del estreno es la forma más rápida de que la gente lo silencie.
--
-- Un torneo apunta al FUTURO. El que tiene las inscripciones abiertas y
-- fecha por delante es justo el que hay que anunciar — y esa línea lo
-- marcó como mandado sin haberlo mandado nunca. Le pasó a la Pachanga
-- inaugural: no era privada, se veía, tenía cinco inscritos, y no salió.
--
-- Ahora la red del estreno deja fuera lo que todavía se puede anunciar.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede volver a ejecutar
-- entera sin romper nada — y ahora es verdad: antes, volver a pasarla
-- silenciaba de golpe todos los torneos pendientes.

alter table public.tournaments
  add column if not exists telegram_sent_at timestamptz;

comment on column public.tournaments.telegram_sent_at is
  'Cuándo se anunció este torneo en el canal de Telegram. NULL = pendiente.';

-- ── LA RED DEL ESTRENO ──
--
-- Sin esto, la primera pasada de la función soltaría de golpe en el canal
-- todo el archivo. Se dan por mandados los torneos que YA NO SE PUEDEN
-- ANUNCIAR: los que no tienen las inscripciones abiertas y los que ya han
-- empezado.
--
-- Lo que NO se toca es lo que sigue vivo — inscripciones abiertas y fecha
-- por delante—, que es exactamente lo que el canal tiene que contar. Ese
-- es el fallo que se arregla aquí: la versión de la 287 los marcaba
-- también a ellos.
update public.tournaments
   set telegram_sent_at = now()
 where telegram_sent_at is null
   and (status is distinct from 'registration_open' or start_at < now());

-- El índice solo cubre lo pendiente, que es lo único que se consulta (y
-- que en régimen normal son cero filas o una).
create index if not exists tournaments_telegram_pendientes
  on public.tournaments (start_at)
  where telegram_sent_at is null;

notify pgrst, 'reload schema';


-- ── PARA MIRAR QUÉ HA QUEDADO PENDIENTE ──
--
-- Lo que sale aquí es lo que el canal anunciará en los próximos cinco
-- minutos. Si esperabas ver un torneo y no está, mira su `status`, su
-- `is_private` y su `telegram_sent_at`: son las tres cosas que lo dejan
-- fuera.
select name, slug, status, start_at, is_private, telegram_sent_at
  from public.tournaments
 where telegram_sent_at is null
 order by start_at;
