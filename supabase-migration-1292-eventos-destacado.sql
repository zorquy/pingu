-- Tanda 1292 — Eventos: el DESTACADO y el logo SIN FONDO (PINGU, «haz lo
-- recomendado» de la propuesta de eventos v2).
--
-- · `destacado`: el evento que Inicio enseña en vez del siguiente y que brilla
--   en la agenda. Hay UNO como mucho: al marcar uno, el disparador desmarca el
--   anterior (así /admin no tiene que acordarse, y dos pestañas abiertas no
--   dejan dos).
-- · `logo_sin_fondo`: el logo es un PNG recortado (transparente); la web lo
--   pinta tal cual, sin la caja de color ni el blanco de detrás. /admin lo
--   marca solo al subirlo si las esquinas son transparentes, y se cambia a mano.
--
-- Las funciones de la 1192 las devuelven solas (`evento_json` es `to_jsonb(e)`).
-- Se puede ejecutar dos veces; cada sentencia vale por sí sola (la 631).

alter table public.eventos add column if not exists destacado boolean not null default false;

alter table public.eventos add column if not exists logo_sin_fondo boolean not null default false;

create or replace function public.eventos_uno_destacado()
returns trigger language plpgsql as $$
begin
  if new.destacado then
    update public.eventos set destacado = false where destacado and id <> new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_eventos_uno_destacado on public.eventos;

create trigger trg_eventos_uno_destacado
  before insert or update of destacado on public.eventos
  for each row when (new.destacado) execute function public.eventos_uno_destacado();

notify pgrst, 'reload schema';
