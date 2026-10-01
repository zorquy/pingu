-- Tanda 391 — la Pokédex no ha rellenado NI UNA carta
--
-- PINGU: «la Pokédex dice que está vacío el catálogo; entro en Bulbasaur
-- y no hay nada».
--
-- Y era verdad desde el primer minuto. `cartas-pokedex.mjs` guardaba el
-- `dex_ids` de cada carta con un UPSERT de PostgREST:
--
--     POST tcg_cards?on_conflict=id,market   {id, market, dex_ids}
--
-- PostgREST traduce eso a `INSERT … ON CONFLICT DO UPDATE`, **y el
-- INSERT se evalúa primero**. Como `tcg_cards` tiene `set_id`,
-- `local_id` y `name` NOT NULL, revienta antes de llegar al UPDATE:
--
--     null value in column "set_id" of relation "tcg_cards"
--     violates not-null constraint
--
-- O sea que la función llevaba desde la tanda 381 fallando cada diez
-- minutos, y la columna `dex_ids` seguía a null en las 23.000 cartas. La
-- pantalla no mentía: no había nada que enseñar.
--
-- La lección: **un UPSERT no es un UPDATE con otro nombre.** Para tocar
-- una columna de una fila que YA existe, lo que hace falta es un UPDATE
-- — `cartas-detalle.mjs`, que sí funciona, usa PATCH desde el principio.
--
-- Aquí no vale un PATCH a secas porque cada carta lleva su propio valor:
-- serían 500 peticiones por pasada. Esta función se come el lote entero
-- de una, con un solo UPDATE … FROM.
create or replace function public.pokedex_marcar(p_filas jsonb)
returns int
language sql
security definer
set search_path = public
as $$
  with datos as (
    select
      x ->> 'id' as id,
      x ->> 'market' as market,
      -- El centinela de la 381 se respeta: `{}` significa «mirada y no
      -- lleva ningún Pokémon», y es lo que hace que la cola se vacíe. Si
      -- esto devolviera null, esas cartas volverían en cada pasada para
      -- siempre (lecciones de las tandas 333, 380 y 381).
      coalesce(
        (select array_agg(v::int) from jsonb_array_elements_text(x -> 'dex_ids') v),
        '{}'::int[]
      ) as dex_ids
    from jsonb_array_elements(p_filas) x
  ),
  hecho as (
    update public.tcg_cards c
       set dex_ids = d.dex_ids
      from datos d
     where c.id = d.id
       and c.market = d.market
    returning 1
  )
  select count(*)::int from hecho;
$$;

-- Solo la llama la función programada, con la clave de servicio. Y el
-- `grant` de abajo NO es de adorno: una función nace con EXECUTE para
-- PUBLIC, así que `service_role` lo tiene POR SER public y el `revoke`
-- se lo quitaría también a él, dejando la función sin poder ejecutarse
-- (lección de la tanda 388, que costó justo esto).
revoke all on function public.pokedex_marcar(jsonb) from public, anon, authenticated;
grant execute on function public.pokedex_marcar(jsonb) to service_role;
