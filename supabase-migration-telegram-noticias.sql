-- ════════════════════════════════════════════════════════════════════
-- Las noticias, al canal de Telegram (tanda 280)
--
-- PINGU tiene una comunidad de Telegram con varios canales y quiere uno
-- de noticias que se escriba solo: cada noticia nueva con su titular, su
-- resumen, su imagen y el enlace.
--
-- Ejecutar en el SQL Editor. No borra nada.
-- ════════════════════════════════════════════════════════════════════

-- 1. Qué se ha mandado ya ────────────────────────────────────────────
--
-- Sin esto, la función mandaría la misma noticia cada vez que corre. Se
-- apunta la fecha y no el «sí/no» porque saber CUÁNDO se mandó vale para
-- mirar si algo se quedó atascado.
alter table public.guides
  add column if not exists telegram_sent_at timestamptz;

comment on column public.guides.telegram_sent_at is
  'Cuándo se anunció esta noticia en el canal de Telegram. Null = todavía no.';

-- 2. Lo ya publicado se da por mandado ───────────────────────────────
--
-- ESTO ES LO IMPORTANTE DE LA MIGRACIÓN. Sin esta línea, en cuanto se
-- enciendan las variables de entorno la función soltaría de golpe en el
-- canal TODAS las noticias del archivo. El día que se estrene un canal,
-- eso es la forma más rápida de que la gente lo silencie.
--
-- Se marcan como mandadas las que ya están publicadas: a partir de aquí
-- solo salen las nuevas.
update public.guides
   set telegram_sent_at = now()
 where kind = 'news'
   and published_at is not null
   and telegram_sent_at is null;

-- 3. El índice de la consulta que corre cada pocos minutos ───────────
create index if not exists guides_telegram_pendientes_idx
  on public.guides (published_at)
  where kind = 'news' and published_at is not null and telegram_sent_at is null;

notify pgrst, 'reload schema';

-- ── Comprobación ───────────────────────────────────────────────────
-- «pendientes» tiene que salir 0: todo lo viejo, dado por mandado.
select count(*) filter (where telegram_sent_at is null) as pendientes,
       count(*) as noticias_publicadas
  from public.guides
 where kind = 'news' and published_at is not null;
