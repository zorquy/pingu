-- Tanda 1034 — el Zekrom de N de las promos de Mega Evolución (MEP 031)
-- salía con tres versiones: Normal, Holo y Pokémon Center. Solo existen dos:
-- Holo y Holo con el sello de Pokémon Center (así lo da TCGdex en
-- data/Mega Evolution/MEP Black Star Promos/031.ts). La «Normal» salía porque
-- una promo solo se da por brillante por su NOMBRE (EX, GX, V, ex… — la 954)
-- y «Zekrom de N» no lo dice.
--
-- Se arregla como una corrección a mano (la 885): `variants` = solo holo,
-- apuntado en `tcg_correcciones`, así que ninguna pasada automática lo
-- vuelve a poner. Las copias que alguien tenga apuntadas como «Normal» pasan
-- a «Holo» (es la misma carta: la normal no existe). Todo en un `do`: en el
-- SQL Editor cada sentencia va por su lado (la 631).
do $$
declare
  v_carta record;
  v_hechas int := 0;
  v_copias int;
begin
  for v_carta in
    select id, market, variants from public.tcg_cards
    where market = 'WEST' and lower(set_id) = 'mep' and ltrim(local_id, '0') = '31'
  loop
    insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
    values ('tcg_cards', v_carta.id, v_carta.market, 'variants', '{"holo": true}'::jsonb, to_jsonb(v_carta.variants), null, now())
    on conflict (tabla, id, market, columna) do update set valor = excluded.valor, updated_at = now();

    update public.tcg_cards set variants = '{"holo": true}'::jsonb where id = v_carta.id and market = v_carta.market;

    update public.user_collection set variante = 'holo'
    where card_id = v_carta.id and market = v_carta.market and coalesce(variante, 'normal') = 'normal';
    get diagnostics v_copias = row_count;

    raise notice 'Corregida % (antes: %). Copias pasadas de Normal a Holo: %', v_carta.id, v_carta.variants, v_copias;
    v_hechas := v_hechas + 1;
  end loop;
  if v_hechas = 0 then
    raise notice 'No hay ninguna carta MEP 031 en el catálogo occidental: no se ha cambiado nada.';
  end if;
end
$$;

-- Lo que queda, para mirarlo: la carta y sus versiones. Si aquí sale una
-- versión con etiqueta de «Normal», es una fila de TCGGO y hay que
-- mandármela (no se borra a ciegas).
select c.id, c.local_id, c.name, c.variants,
       (select jsonb_agg(jsonb_build_object('tcggo_id', v.tcggo_id, 'etiqueta', v.etiqueta, 'clase', v.clase, 'origen', v.origen) order by v.tcggo_id)
          from public.tcg_card_versions v where v.card_id = c.id and v.market = c.market) as versiones
from public.tcg_cards c
where c.market = 'WEST' and lower(c.set_id) = 'mep' and ltrim(c.local_id, '0') = '31';
