-- ============================================================
-- Tanda 958: las versiones de cada idioma, también CARTA A CARTA.
--
-- PINGU, con el Duskull SH2 de Stormfront delante: «en español solo está en
-- la versión holográfica… en inglés, francés, alemán, italiano es reverse».
-- La 956 solo sabía decir «esta versión no salió en este idioma» para el SET
-- entero, y solo QUITAR: el Duskull SH2 trae de TCGdex una sola versión
-- (Holo), así que en inglés no había Reverse que dejar.
--
--  1. `tcg_version_idioma.card_id`: vacío ('') es lo del set entero, como
--     hasta ahora; con una carta, lo de esa carta, que manda sobre lo del set.
--     En una carta `hay = true` sí se guarda: es «en este idioma existe esta
--     versión», aunque la carta no la traiga (la Reverse del Duskull).
--  2. `catalogo_version_de_idioma` con `p_carta` (por defecto, el set). En una
--     carta, `p_hay` a null deja de mandar y vuelve lo del set.
--  3. Las tres SH de Stormfront: Holo en español (y en lo que no se diga),
--     Reverse y no Holo en inglés, francés, alemán e italiano.
--
-- Va después de la 956. Se puede ejecutar dos veces.
-- ============================================================

begin;

-- ── 1. La columna, dentro de la clave ──
alter table public.tcg_version_idioma add column if not exists card_id text not null default '';
alter table public.tcg_version_idioma drop constraint if exists tcg_version_idioma_pkey;
alter table public.tcg_version_idioma add constraint tcg_version_idioma_pkey primary key (set_id, market, card_id, variante, idioma);

-- ── 2. Lo que escribe el admin ──
-- La de cinco argumentos se va: con una sexta con valor por defecto, las dos
-- casarían con la misma llamada y PostgREST no sabría cuál.
drop function if exists public.catalogo_version_de_idioma(text, text, text, text, boolean);
create or replace function public.catalogo_version_de_idioma(p_set text, p_market text, p_variante text, p_idioma text, p_hay boolean, p_carta text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carta text := coalesce(trim(p_carta), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tcg_sets where id = p_set and market = p_market) then
    raise exception 'No existe el set % (%).', p_set, p_market using errcode = 'P0002';
  end if;
  if coalesce(trim(p_variante), '') = '' then
    raise exception 'Falta la versión.' using errcode = '22023';
  end if;
  if v_carta <> '' and not exists (select 1 from public.tcg_cards where id = v_carta and set_id = p_set and market = p_market) then
    raise exception 'La carta % no es del set % (%).', v_carta, p_set, p_market using errcode = 'P0002';
  end if;
  -- En el set, «sí salió» es lo de por defecto y no se guarda; en una carta,
  -- solo null deja de mandar.
  if p_hay is null or (v_carta = '' and p_hay) then
    delete from public.tcg_version_idioma
    where set_id = p_set and market = p_market and card_id = v_carta and variante = p_variante and idioma = p_idioma;
  else
    insert into public.tcg_version_idioma (set_id, market, card_id, variante, idioma, hay, autor, updated_at)
    values (p_set, p_market, v_carta, p_variante, p_idioma, p_hay, auth.uid(), now())
    on conflict (set_id, market, card_id, variante, idioma) do update set hay = excluded.hay, autor = excluded.autor, updated_at = now();
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.catalogo_version_de_idioma(text, text, text, text, boolean, text) from public, anon;
grant execute on function public.catalogo_version_de_idioma(text, text, text, text, boolean, text) to authenticated;

-- ── 3. Las SH de Stormfront ──
-- Solo las cartas que existen: un id que no esté no se inventa.
insert into public.tcg_version_idioma (set_id, market, card_id, variante, idioma, hay, updated_at)
select 'dp7', 'WEST', c.id, v.variante, l.idioma, v.hay, now()
from public.tcg_cards c
cross join (values ('reverse', true), ('holo', false)) as v(variante, hay)
cross join (values ('en'), ('fr'), ('de'), ('it')) as l(idioma)
where c.set_id = 'dp7' and c.market = 'WEST' and c.id in ('dp7-SH1', 'dp7-SH2', 'dp7-SH3')
on conflict (set_id, market, card_id, variante, idioma) do update set hay = excluded.hay, updated_at = now();

notify pgrst, 'reload schema';

commit;

-- ── Comprobación (el SQL Editor enseña la última) ──
select coalesce(nullif(card_id, ''), '(el set entero)') as carta,
       string_agg(variante || case when hay then ' ✓ ' else ' ✕ ' end || idioma, ', ' order by variante, idioma) as versiones
from public.tcg_version_idioma
where set_id = 'dp7' and market = 'WEST'
group by card_id
order by card_id;
