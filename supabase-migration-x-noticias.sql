-- ════════════════════════════════════════════════════════════════════
-- Las noticias, a la cuenta de X de PokeDoc (tanda 902)
--
-- Igual que la de Telegram (280): una columna que dice cuándo salió cada
-- noticia por X, y lo ya publicado se da por mandado para que el estreno
-- de la cuenta no sea el archivo entero de golpe.
--
-- Ejecutar en el SQL Editor. No borra nada.
-- ════════════════════════════════════════════════════════════════════

-- 1. Qué se ha publicado ya, y con qué id ─────────────────────────────
--
-- La fecha y no un «sí/no», para ver si algo se queda atascado. Y el id
-- del post, para poder enlazarlo desde el panel y, si hace falta, borrarlo.
alter table public.guides
  add column if not exists x_sent_at timestamptz,
  add column if not exists x_post_id text;

comment on column public.guides.x_sent_at is
  'Cuándo se publicó esta noticia en la cuenta de X (@pokedoc_es). Null = todavía no.';
comment on column public.guides.x_post_id is
  'El id del post en X, para enlazarlo.';

-- 2. Lo ya publicado se da por mandado ───────────────────────────────
--
-- ESTO ES LO IMPORTANTE. Sin esta línea, en cuanto se pongan las claves
-- la función soltaría de golpe en la cuenta TODAS las noticias de las
-- últimas 48 horas (la red de las 48 h está, pero mejor que sean cero).
update public.guides
   set x_sent_at = now()
 where kind = 'news'
   and published_at is not null
   and x_sent_at is null;

-- 3. El índice de la consulta que corre cada cinco minutos ───────────
create index if not exists guides_x_pendientes_idx
  on public.guides (published_at)
  where kind = 'news' and published_at is not null and x_sent_at is null;

notify pgrst, 'reload schema';

-- ── Comprobación ───────────────────────────────────────────────────
-- «pendientes» tiene que salir 0: todo lo viejo, dado por mandado.
select count(*) filter (where x_sent_at is null) as pendientes,
       count(*) as noticias_publicadas
  from public.guides
 where kind = 'news' and published_at is not null;
