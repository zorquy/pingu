-- ============================================================
-- Tanda 952: «L-P Promos» y «LEGEND Promos» son el MISMO set japonés.
--
-- En el foro: «L-P Promos y LEGEND Promos me aparecen duplicados, es el mismo
-- set». En la estantería japonesa salen los dos, de 2009: «L-P Promos» con 82
-- cartas y sin logo, y «LEGEND Promos» (LP_JA) con 92 y su logo.
--
-- Se queda el que tiene MÁS cartas y el otro se esconde. Carta a carta:
--  · si está en los dos —mismo número (solo las cifras, sin ceros delante:
--    «001», «1» y «L-P 001» son la misma) Y mismo nombre, japonés o
--    inglés—, se FUNDE en la del que se queda: sus copias, deseos, avisos,
--    vitrina y álbumes pasan a ella, sus versiones también, y la repetida se
--    borra con LÁPIDA (la 934: ninguna pasada la vuelve a crear);
--  · si solo está en el que se esconde, se MUDA al que se queda, y la mudanza
--    se apunta como corrección (la 885), para que ninguna pasada la devuelva;
--  · un número que casa con otro NOMBRE no se funde: se muda y se cuenta en
--    el informe («dudosas»), para mirarlo a mano.
-- El escondido también va como corrección (`oculto`). Si no hay exactamente
-- un set japonés con cada nombre, no se toca nada y el informe lo dice.
--
-- Va después de la 885 y la 934. Idempotente: una segunda vez el escondido
-- ya no tiene cartas. Lo hecho queda en `scrydex_estado` (clave
-- legend_promos_952) y se enseña al final.
-- ============================================================

begin;

do $do$
declare
  a record;
  b record;
  queda record;
  va record;
  c record;
  v_k text;
  v_k_name text;
  v_k_name_en text;
  v_num text;
  v_fundidas int := 0;
  v_mudadas int := 0;
  v_dudosas int := 0;
  v_copias int := 0;
  v_n int;
  v_motivo text;
  v_hay_a boolean;
  v_hay_b boolean;
begin
  select count(*) into v_n from public.tcg_sets where market = 'JP' and lower(coalesce(name_en, name)) = 'l-p promos';
  v_hay_a := v_n = 1;
  if v_hay_a then select s.*, (select count(*) from public.tcg_cards k where k.market = 'JP' and k.set_id = s.id) as n into a from public.tcg_sets s where s.market = 'JP' and lower(coalesce(s.name_en, s.name)) = 'l-p promos'; end if;
  select count(*) into v_n from public.tcg_sets where market = 'JP' and lower(coalesce(name_en, name)) = 'legend promos';
  v_hay_b := v_n = 1;
  if v_hay_b then select s.*, (select count(*) from public.tcg_cards k where k.market = 'JP' and k.set_id = s.id) as n into b from public.tcg_sets s where s.market = 'JP' and lower(coalesce(s.name_en, s.name)) = 'legend promos'; end if;

  if not v_hay_a or not v_hay_b then
    v_motivo := 'no hay exactamente un set japonés «L-P Promos» y uno «LEGEND Promos»: no se toca nada';
    insert into public.scrydex_estado (clave, valor, updated_at)
    values ('legend_promos_952', jsonb_build_object('hecho', false, 'motivo', v_motivo, 'at', now()), now())
    on conflict (clave) do update set valor = excluded.valor, updated_at = now();
    raise notice '%', v_motivo;
    return;
  end if;

  -- Se queda el de más cartas; con las mismas, el que tiene logo.
  if a.n > b.n or (a.n = b.n and a.logo_tcggo is not null and b.logo_tcggo is null) then queda := a; va := b; else queda := b; va := a; end if;

  for c in select * from public.tcg_cards where market = 'JP' and set_id = va.id order by id loop
    v_num := nullif(ltrim(regexp_replace(split_part(c.local_id, '/', 1), '\D', '', 'g'), '0'), '');
    v_k := null;
    select x.id, x.name, x.name_en into v_k, v_k_name, v_k_name_en from public.tcg_cards x
     where x.market = 'JP' and x.set_id = queda.id and v_num is not null
       and nullif(ltrim(regexp_replace(split_part(x.local_id, '/', 1), '\D', '', 'g'), '0'), '') = v_num
     order by x.id limit 1;

    if v_k is not null and (lower(coalesce(v_k_name, '')) = lower(coalesce(c.name, '')) or (v_k_name_en is not null and lower(v_k_name_en) = lower(coalesce(c.name_en, '')))) then
      -- Fundir en la que se queda (como la 935).
      update public.user_collection set card_id = v_k, market = 'JP' where card_id = c.id and market = 'JP';
      get diagnostics v_n = row_count;
      v_copias := v_copias + v_n;
      delete from public.user_wants w
       where w.card_id = c.id
         and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = v_k and coalesce(o.idioma, '*') = coalesce(w.idioma, '*'));
      update public.user_wants set card_id = v_k where card_id = c.id;
      update public.user_price_alerts set card_id = v_k where card_id = c.id;
      update public.user_showcase set card_id = v_k where card_id = c.id;
      update public.user_albums al set cartas = (
        select coalesce(jsonb_agg(case when x->>'id' = c.id then jsonb_set(x, '{id}', to_jsonb(v_k)) else x end order by o), '[]'::jsonb)
          from jsonb_array_elements(al.cartas) with ordinality as z(x, o))
       where al.cartas @> jsonb_build_array(jsonb_build_object('id', c.id));
      -- Sus versiones que la buena no tiene ya, a la buena; las demás se van.
      update public.tcg_card_versions v set card_id = v_k, set_id = queda.id
       where v.card_id = c.id and v.market = 'JP'
         and not exists (select 1 from public.tcg_card_versions w where w.card_id = v_k and w.market = 'JP' and lower(w.etiqueta) = lower(v.etiqueta));
      delete from public.tcg_card_versions where card_id = c.id and market = 'JP';
      delete from public.tcg_card_prices where card_id = c.id;
      delete from public.tcg_card_history where card_id = c.id;
      delete from public.tcg_correcciones where tabla = 'tcg_cards' and id = c.id and market = 'JP';
      insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
      values ('tcg_cards', c.id, 'JP', '__borrada', 'true'::jsonb, null, null, now())
      on conflict (tabla, id, market, columna) do update set updated_at = now();
      delete from public.tcg_cards where id = c.id and market = 'JP';
      v_fundidas := v_fundidas + 1;
    else
      if v_k is not null then v_dudosas := v_dudosas + 1; end if;
      -- Mudarla (y apuntarlo, para que ninguna pasada la devuelva).
      update public.tcg_cards set set_id = queda.id where id = c.id and market = 'JP';
      update public.tcg_card_versions set set_id = queda.id where card_id = c.id and market = 'JP';
      insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
      values ('tcg_cards', c.id, 'JP', 'set_id', to_jsonb(queda.id), to_jsonb(va.id), null, now())
      on conflict (tabla, id, market, columna) do update set valor = excluded.valor, updated_at = now();
      v_mudadas := v_mudadas + 1;
    end if;
  end loop;

  -- El que se va, escondido (y apuntado: el calco no lo vuelve a enseñar).
  update public.tcg_sets set oculto = true where id = va.id and market = 'JP';
  insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
  values ('tcg_sets', va.id, 'JP', 'oculto', 'true'::jsonb, 'false'::jsonb, null, now())
  on conflict (tabla, id, market, columna) do update set valor = excluded.valor, updated_at = now();

  insert into public.scrydex_estado (clave, valor, updated_at)
  values ('legend_promos_952', jsonb_build_object('hecho', true, 'se_queda', queda.id, 'se_queda_nombre', coalesce(queda.name_en, queda.name), 'se_esconde', va.id,
    'se_esconde_nombre', coalesce(va.name_en, va.name), 'fundidas', v_fundidas, 'mudadas', v_mudadas, 'dudosas', v_dudosas, 'copias_movidas', v_copias, 'at', now()), now())
  on conflict (clave) do update set valor = case when (excluded.valor->>'fundidas')::int + (excluded.valor->>'mudadas')::int > 0 or not coalesce((public.scrydex_estado.valor->>'hecho')::boolean, false) then excluded.valor else public.scrydex_estado.valor end, updated_at = now();
end
$do$;

notify pgrst, 'reload schema';

commit;

-- Lo que ha hecho (el SQL Editor enseña esta tabla).
select valor->>'hecho' as hecho, valor->>'se_queda' as se_queda, valor->>'se_queda_nombre' as nombre,
       valor->>'se_esconde' as se_esconde, valor->>'se_esconde_nombre' as nombre_escondido,
       (valor->>'fundidas')::int as fundidas, (valor->>'mudadas')::int as mudadas, (valor->>'dudosas')::int as dudosas,
       (valor->>'copias_movidas')::int as copias_movidas, valor->>'motivo' as motivo,
       (select count(*) from public.tcg_cards k where k.market = 'JP' and k.set_id = valor->>'se_queda') as cartas_en_el_que_queda
  from public.scrydex_estado where clave = 'legend_promos_952';
