-- Tanda 1193 — Eventos: Trade night, días con horario y varias entradas
-- (PINGU: «este son el día 7 y 8 de noviembre, de 10 a 8, ambos días»;
-- «normalmente tienen la entrada normal, la VIP…»).
--
-- 1. `tipo` admite 'trade_night'.
-- 2. `horario` (jsonb): los días que dura y su hora, uno por día:
--    [{"dia": "2026-11-07", "desde": "10:00", "hasta": "20:00"}, …]. Los días
--    no tienen por qué ir seguidos. `empieza` y `termina` se siguen guardando
--    (los escribe /admin con el primer día y su hora, y el último y la suya):
--    la agenda ordena, separa lo pasado y elige el de la portada con ellos.
-- 3. `entradas` (jsonb): [{"nombre": "General", "precio": 5, "nota": "…"}, …]
--    (precio en euros; 0 es gratis; sin precio, «consultar»). `entrada` (el
--    texto de antes) se queda: /admin lo rellena con el resumen.
-- Las funciones de la 1192 no cambian: `evento_json` devuelve la fila entera
-- (`to_jsonb(e)`), así que las columnas nuevas ya llegan a la web.
-- No toca los eventos que ya hay. Se puede ejecutar dos veces; cada sentencia
-- vale por sí sola (el SQL Editor las puede mandar por separado, la 631).

alter table public.eventos drop constraint if exists eventos_tipo_check;

alter table public.eventos add constraint eventos_tipo_check
  check (tipo in ('card_show', 'trade_day', 'trade_night', 'quedada', 'torneo'));

alter table public.eventos add column if not exists horario jsonb not null default '[]'::jsonb;

alter table public.eventos add column if not exists entradas jsonb not null default '[]'::jsonb;

alter table public.eventos drop constraint if exists eventos_horario_lista;

alter table public.eventos add constraint eventos_horario_lista
  check (jsonb_typeof(horario) = 'array' and jsonb_array_length(horario) <= 31);

alter table public.eventos drop constraint if exists eventos_entradas_lista;

alter table public.eventos add constraint eventos_entradas_lista
  check (jsonb_typeof(entradas) = 'array' and jsonb_array_length(entradas) <= 12);

notify pgrst, 'reload schema';
