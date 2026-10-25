-- ============================================================
-- Tanda 1007: «Posibles repetidas» compara los nombres sin guiones ni signos.
--
-- Va DESPUÉS de la 996 (redefine `catalogo_posibles_repetidas`). Se puede
-- ejecutar más de una vez, y cada sentencia va sola (la 631).
--
-- PINGU, con las SM Black Star Promos: el Reshiram & Charizard GX dos veces
-- (la dorada y la normal, y sus dos «Oversized», las Jumbo) y ninguna en la
-- lista. La lista no se apunta en ninguna parte: se calcula al abrir el panel,
-- juntando las cartas de una colección por número y por NOMBRE. Y el nombre se
-- comparaba tal cual: TCGdex escribe «Reshiram & Charizard-GX» y TCGGO
-- «Reshiram & Charizard GX», así que nunca caían juntas.
--
-- 1. `catalogo_nombre_de_repetida`: el nombre sin tildes, sin lo que vaya
--    entre paréntesis o corchetes, sin «Jumbo» ni «Oversized» y sin nada que
--    no sea letra o número. «Reshiram & Charizard-GX» y «Reshiram & Charizard
--    GX (Oversized)» son los dos «reshiramcharizardgx».
-- 2. Lo marcado como «son distintas» se reconoce por SUS CARTAS (mismo set y
--    las mismas ids), no por el nombre guardado: el de antes era el nombre
--    tal cual y, con el nuevo, lo ya marcado volvería a salir.
-- ============================================================

create or replace function public.catalogo_nombre_de_repetida(p text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(public.immutable_unaccent(lower(coalesce(p, ''))), '\([^)]*\)|\[[^]]*\]|\m(jumbo|oversized)\M', '', 'g'),
    '[^a-z0-9]+', '', 'g')
$$;

create or replace function public.catalogo_posibles_repetidas(p_market text default null, p_limite int default 300)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  with c as (
    select c.*, public.catalogo_numero_de_repetida(c.local_id) as n, public.catalogo_nombre_de_repetida(c.name) as k
      from public.tcg_cards c
      join public.tcg_sets s on s.id = c.set_id and s.market = c.market
     where (p_market is null or c.market = p_market)
       and not coalesce(s.oculto, false)
       and trim(coalesce(c.local_id, '')) <> ''
  ), g as (
    select market, set_id, n, k, array_agg(id order by id) as ids
      from c group by market, set_id, n, k having count(*) > 1
  ), vivos as (
    select g.* from g
     where not exists (
       select 1 from public.tcg_repetidas_distintas d
        where d.market = g.market and d.set_id = g.set_id and g.ids <@ d.ids)
  ), elegidos as (
    select v.*, s.name as set_nombre, s.name_en as set_nombre_en, s.release_date, s.serie_id, s.tcg_online_code
      from vivos v join public.tcg_sets s on s.id = v.set_id and s.market = v.market
     order by s.release_date desc nulls last, v.set_id, v.n
     limit greatest(1, least(coalesce(p_limite, 300), 1000))
  )
  select jsonb_build_object(
    'total', (select count(*) from vivos),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market', e.market, 'set_id', e.set_id, 'numero', e.n, 'nombre', e.k,
        'set', jsonb_build_object('id', e.set_id, 'name', e.set_nombre, 'name_en', e.set_nombre_en, 'release_date', e.release_date),
        'cartas', (
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'market', c.market, 'set_id', c.set_id, 'local_id', c.local_id, 'name', c.name, 'name_es', c.name_es,
            'origen', c.origen, 'tcggo_id', c.tcggo_id, 'hp', c.hp, 'illustrator', c.illustrator, 'attacks', c.attacks,
            'category', c.category, 'stage', c.stage, 'types', c.types,
            'abilities', c.abilities, 'rarity', c.rarity, 'variants', c.variants, 'image_path', c.image_path,
            'image_tcggo', c.image_tcggo, 'cm_id_product_propio', c.cm_id_product_propio,
            'tcg_sets', jsonb_build_object('serie_id', e.serie_id, 'tcg_online_code', e.tcg_online_code, 'release_date', e.release_date),
            'precio', (select jsonb_build_object('cm_id_product', p.cm_id_product, 'cm_low', p.cm_low, 'cm_low_es', p.cm_low_es, 'cm_low_en', p.cm_low_en)
                         from public.tcg_card_prices p where p.card_id = c.id),
            'personas', (select count(distinct u.user_id) from public.user_collection u where u.card_id = c.id and u.market = c.market),
            'copias', (select coalesce(sum(u.cantidad), 0) from public.user_collection u where u.card_id = c.id and u.market = c.market)
          ) order by (c.origen = 'tcggo') nulls first, c.tcggo_id nulls first, c.id)
            from c where c.market = e.market and c.set_id = e.set_id and c.n = e.n and c.k = e.k)
      ) order by e.release_date desc nulls last, e.set_id, e.n)
        from elegidos e), '[]'::jsonb),
    'hechas', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'market', h.market, 'carta', h.carta, 'destino', h.destino, 'decision', h.decision,
        'etiqueta', h.etiqueta, 'nombre', h.fila->>'name', 'set_id', h.fila->>'set_id', 'local_id', h.fila->>'local_id', 'hecha_at', h.hecha_at)
        order by h.hecha_at desc)
        from (select * from public.tcg_repetidas_hechas where deshecha_at is null and (p_market is null or market = p_market) order by hecha_at desc limit 200) h), '[]'::jsonb),
    'distintas', coalesce((
      select jsonb_agg(jsonb_build_object('market', d.market, 'set_id', d.set_id, 'numero', d.numero, 'nombre', d.nombre, 'ids', d.ids, 'creado_at', d.creado_at)
        order by d.creado_at desc)
        from public.tcg_repetidas_distintas d where p_market is null or d.market = p_market), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.catalogo_posibles_repetidas(text, int) from public, anon;
grant execute on function public.catalogo_posibles_repetidas(text, int) to authenticated, service_role;

notify pgrst, 'reload schema';
