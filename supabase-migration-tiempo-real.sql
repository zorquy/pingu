-- ═══════════════════════════════════════════════════════════════════
-- TIEMPO REAL (tanda 227)
-- ═══════════════════════════════════════════════════════════════════
--
-- Hasta ahora la web se enteraba de los cambios PREGUNTANDO cada pocos
-- segundos (la ficha de torneo, 18 consultas cada 10 s). Con esto, la
-- base AVISA cuando algo cambia y la página se entera sola.
--
-- El sondeo NO se quita: se queda de red de seguridad, más lento,
-- para cuando el websocket no conecta (redes que bloquean websockets,
-- pestañas dormidas, cortes). Ver js/vivo.js.
--
-- QUÉ HACE ESTE FICHERO: meter unas tablas en la publicación que
-- Realtime escucha. Sin esto, suscribirse no da error — simplemente no
-- llega NUNCA nada, que es peor.
--
-- SOBRE LA SEGURIDAD (importante):
--
--   · INSERT y UPDATE respetan la RLS. Realtime evalúa cada evento
--     contra cada suscriptor y solo se lo manda a quien podría leer esa
--     fila con una consulta normal. Las decklists ajenas siguen sin
--     verse.
--
--   · DELETE **NO** respeta la RLS — no hay fila contra la que
--     comprobar el permiso. Un borrado se emite a todos los suscritos.
--     Por eso el cliente NUNCA se cree el contenido de un DELETE: lo
--     trata como «algo ha cambiado, vuelve a pedirlo». Y por eso aquí
--     NO se publica ninguna tabla cuyo simple borrado revele algo
--     (`tournament_decklists` se queda fuera a propósito).
--
-- Es re-ejecutable.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  -- Solo lo que de verdad cambia mientras alguien mira, y solo lo que
  -- no pasa nada por emitir. Todo lo demás se queda en consultas.
  tablas text[] := array[
    -- La campanita y los mensajes privados: es donde más se nota que
    -- una web «esté viva», y hoy hay que recargar para verlos.
    'user_notifications',
    'private_messages',
    -- El torneo en juego. El chat de partida es el caso de manual: una
    -- conversación con diez segundos de retraso no es una conversación.
    'match_messages',
    'match_reports',
    'match_results',
    'tournament_matches',
    'rounds',
    'judge_calls',
    'judge_messages',
    -- Un tema del foro que se está moviendo.
    'forum_posts'
  ];
begin
  foreach t in array tablas loop
    -- `add table` peta si ya está dentro, y este fichero se ejecuta más
    -- de una vez: se mira antes.
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Los UPDATE y DELETE viajan con la clave primaria y poco más si la
-- «replica identity» es la de por defecto. Para las tablas donde el
-- cliente necesita saber QUÉ fila cambió sin volver a preguntar, se
-- deja en full.
--
-- OJO: `full` hace que el WAL lleve la fila entera en cada cambio. Se
-- pone solo donde hace falta y en tablas pequeñas y de vida corta, no
-- en las que crecen sin parar.
alter table public.tournament_matches replica identity full;
alter table public.rounds replica identity full;
alter table public.judge_calls replica identity full;
