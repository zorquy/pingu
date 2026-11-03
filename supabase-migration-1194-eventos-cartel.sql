-- Tanda 1194 — Eventos: el cartel (PINGU eligió la A de «Eventos con cartel»:
-- cada evento es un cartel en la agenda). `cartel_url` es la imagen grande y
-- apaisada del evento; sin ella, la web pinta el color del evento con su logo.
-- La sube el equipo desde /admin → Eventos al cubo `guide-images`.
-- Las funciones de la 1192 la devuelven solas (`evento_json` es `to_jsonb(e)`).
-- El enlace de compra de cada entrada va DENTRO de `entradas` (1193), como
-- `url`: no necesita columna.
-- Se puede ejecutar dos veces; cada sentencia vale por sí sola (la 631).

alter table public.eventos add column if not exists cartel_url text;

notify pgrst, 'reload schema';
