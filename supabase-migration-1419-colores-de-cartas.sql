-- Tanda 1419 — El color de cada ilustración, calculado en el servidor
-- (PINGU eligió lo recomendado de la propuesta «Tus colores, bien»).
--
-- Una fila por ilustración del catálogo (IR, SIR, full art… sin energías):
-- su HUELLA entera (los tres colores de «Sugerir», los bordes y el color de
-- Tus colores: `js/mi-coleccion/color-de-carta.js`), leída de la foto
-- GRANDE por la función `colores-cartas`. Así Tus colores y «Sugerir» salen
-- al momento, igual para todo el mundo, sin depender de qué webs dejan leer
-- sus fotos en el navegador.
--
-- `color_admin` es la corrección del equipo (/admin → Colecciones → una
-- expansión → Colores): manda sobre `color` y ninguna pasada la toca (la
-- función escribe solo sus columnas).
--
-- Se ejecuta entera en el SQL Editor; se puede repetir.

create table if not exists public.tcg_card_colores (
  card_id text not null,
  market text not null default 'WEST',
  -- La huella como la da `huellaDePixeles` (con `colores` dentro). Nula si
  -- ninguna foto se pudo leer: entonces `intentos` cuenta las veces.
  huella jsonb,
  color text,
  color_admin text,
  foto text,
  intentos int not null default 0,
  corregido_por uuid,
  corregido_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (card_id, market)
);

-- Los grupos de Tus colores (`ORDEN` de tus-colores.js).
alter table public.tcg_card_colores drop constraint if exists tcg_card_colores_color_check;
alter table public.tcg_card_colores add constraint tcg_card_colores_color_check
  check (color is null or color in ('rojo', 'naranja', 'amarillo', 'verde', 'turquesa', 'celeste', 'azul', 'morado', 'rosa', 'marrón', 'multicolor', 'claras', 'oscuras'));
alter table public.tcg_card_colores drop constraint if exists tcg_card_colores_color_admin_check;
alter table public.tcg_card_colores add constraint tcg_card_colores_color_admin_check
  check (color_admin is null or color_admin in ('rojo', 'naranja', 'amarillo', 'verde', 'turquesa', 'celeste', 'azul', 'morado', 'rosa', 'marrón', 'multicolor', 'claras', 'oscuras'));

-- La lee todo el mundo (los colores de una carta no son de nadie); la
-- escriben la función (clave de servicio, que se salta la RLS) y el equipo
-- por `admin_color_corregir`. La política de SELECT va aquí mismo: con RLS y
-- sin ella, el navegador leería una lista VACÍA sin error (la 510).
alter table public.tcg_card_colores enable row level security;
drop policy if exists "tcg_card_colores: leer" on public.tcg_card_colores;
create policy "tcg_card_colores: leer" on public.tcg_card_colores for select using (true);
grant select on public.tcg_card_colores to anon, authenticated;

-- Corregir el color de una carta (o quitar la corrección con null).
create or replace function public.admin_color_corregir(p_card text, p_market text, p_color text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Solo el equipo puede corregir colores';
  end if;
  if p_color is not null and p_color not in ('rojo', 'naranja', 'amarillo', 'verde', 'turquesa', 'celeste', 'azul', 'morado', 'rosa', 'marrón', 'multicolor', 'claras', 'oscuras') then
    raise exception 'Color desconocido: %', p_color;
  end if;
  insert into public.tcg_card_colores (card_id, market, color_admin, corregido_por, corregido_at)
  values (p_card, coalesce(p_market, 'WEST'), p_color, auth.uid(), now())
  on conflict (card_id, market) do update
    set color_admin = excluded.color_admin,
        corregido_por = excluded.corregido_por,
        corregido_at = excluded.corregido_at;
end;
$$;
revoke all on function public.admin_color_corregir(text, text, text) from public, anon;
grant execute on function public.admin_color_corregir(text, text, text) to authenticated;
