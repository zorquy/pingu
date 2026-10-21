-- ============================================================
-- Tanda 949: poner (o quitar) versiones a muchas cartas de un set de una vez.
--
-- PINGU, con los avisos del foro («Reviving Legends: No holo 1.ª edición,
-- Reverse 1.ª edición, No holo Unlimited, Reverse Unlimited»; «este tenía
-- 1.ª edición y Unlimited»): «méteme en admin para poner las versiones de
-- todas las cartas. Pero las versiones de todas las cartas no son todas las
-- cartas: hay algunas que tienen primera edición y normal, las japonesas
-- muchas veces no tienen reverse… pero para esos momentos, se arregla en
-- un momento».
--
-- Por eso la lista de cartas la elige /admin (por rareza y por números) y
-- esta función solo hace lo que le dicen: a cada carta, cada versión que aún
-- no tenga, como fila `origen = 'edicion'` (las de la 935 y la 948), clase
-- `impresion`, colgada de NUESTRA carta. La «Unlimited» lleva el producto de
-- Cardmarket de la carta (su precio es el de la carta); las demás, sin él.
--
-- Con `p_mover`, las copias apuntadas como «Normal» u «Holo» de esas cartas
-- pasan a «Unlimited» (como en la 935 y la 948: una «Normal» que ya no se
-- ofrece se leería como la primera versión de la lista). Con `p_quitar`, se
-- borran esas versiones de esas cartas, y solo las de edición: las de TCGGO,
-- las de TCGdex y las de a mano no se tocan. Las copias de la gente no se
-- tocan al quitar: la web enseña siempre las versiones que alguien tiene.
--
-- Va DESPUÉS de la 935 (la columna `origen`, `catalogo_id_de_version` y la
-- secuencia de la 934).
-- ============================================================

begin;

create or replace function public.catalogo_versiones_lote(
  p_market text,
  p_cartas text[],
  p_etiquetas text[],
  p_quitar boolean default false,
  p_mover boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etiquetas text[];
  v_cartas text[];
  v_existen int;
  v_nuevas int := 0;
  v_ya int := 0;
  v_quitadas int := 0;
  v_copias int := 0;
  c record;
  e record;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_market not in ('WEST', 'JP', 'TW', 'CN') then
    raise exception 'Catálogo desconocido: %', p_market using errcode = '22023';
  end if;
  -- Las etiquetas, recortadas, sin vacías ni repetidas y en el orden dado.
  select coalesce(array_agg(t order by k), '{}') into v_etiquetas
    from (select distinct on (lower(t)) t, k
            from unnest(coalesce(p_etiquetas, '{}')) with ordinality as x(t0, k), lateral (select trim(t0) as t) y
           where t <> '' order by lower(t), k) z;
  if cardinality(v_etiquetas) = 0 then
    raise exception 'Elige al menos una versión.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_etiquetas) t where length(t) > 60) then
    raise exception 'Una versión no puede llamarse con más de 60 letras.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_cartas from unnest(coalesce(p_cartas, '{}')) x where x is not null and x <> '';
  if cardinality(v_cartas) = 0 then
    raise exception 'No hay ninguna carta elegida.' using errcode = '22023';
  end if;
  if cardinality(v_cartas) > 2000 then
    raise exception 'Como mucho 2.000 cartas de una vez.' using errcode = '22023';
  end if;
  select count(*) into v_existen from public.tcg_cards where market = p_market and id = any(v_cartas);
  if v_existen = 0 then
    raise exception 'Ninguna de esas cartas existe en ese catálogo.' using errcode = 'P0002';
  end if;

  if p_quitar then
    delete from public.tcg_card_versions
     where market = p_market and card_id = any(v_cartas) and origen = 'edicion'
       and lower(etiqueta) in (select lower(t) from unnest(v_etiquetas) t);
    get diagnostics v_quitadas = row_count;
    return jsonb_build_object('cartas', v_existen, 'quitadas', v_quitadas);
  end if;

  for c in select id, set_id, name, cm_id_product_propio from public.tcg_cards where market = p_market and id = any(v_cartas) order by id loop
    -- En el orden dado: la web ordena las de edición por su id (van hacia abajo).
    for e in select t, k from unnest(v_etiquetas) with ordinality as x(t, k) order by k loop
      if exists (select 1 from public.tcg_card_versions where card_id = c.id and market = p_market and origen = 'edicion' and lower(etiqueta) = lower(e.t)) then
        v_ya := v_ya + 1;
        continue;
      end if;
      insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, clase, cm_id_product, origen, actualizado_at)
      values (-nextval('public.tcg_card_versions_mano_seq')::int, p_market, c.id, c.set_id, c.name, e.t, 'impresion',
              case when public.catalogo_id_de_version(e.t) = 'unlimited' then c.cm_id_product_propio end, 'edicion', now());
      v_nuevas := v_nuevas + 1;
    end loop;
  end loop;

  if p_mover and exists (select 1 from unnest(v_etiquetas) t where public.catalogo_id_de_version(t) = 'unlimited') then
    update public.user_collection set variante = 'unlimited'
     where market = p_market and card_id = any(v_cartas) and coalesce(variante, 'normal') in ('normal', 'holo');
    get diagnostics v_copias = row_count;
  end if;

  return jsonb_build_object('cartas', v_existen, 'nuevas', v_nuevas, 'ya', v_ya, 'copias', v_copias);
end;
$$;

revoke all on function public.catalogo_versiones_lote(text, text[], text[], boolean, boolean) from public, anon;
grant execute on function public.catalogo_versiones_lote(text, text[], text[], boolean, boolean) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
