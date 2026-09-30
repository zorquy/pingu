-- ─────────────────────────────────────────────────────────────────────
-- EL VALOR DE TU COLECCIÓN EN EL TIEMPO (tanda 377).
--
-- Hoy sabemos lo que vale tu colección AHORA, y solo ahora: se suma al
-- pintar la página y no se guarda en ningún sitio. Así que «¿ha subido
-- este mes?» no se puede contestar — y es la pregunta que se hace
-- cualquiera que colecciona.
--
-- ── UNA FILA POR PERSONA Y DÍA, Y NADA MÁS ──
--
-- No se guarda el valor de cada CARTA cada día: serían millones de filas
-- para contestar una pregunta que es sobre el total. Si algún día hace
-- falta «cuánto ha subido este Charizard», eso sale del histórico de
-- precios de la carta, que es otra tabla y otro problema.
--
-- ── Y SE CALCULA ENTERO EN LA BASE ──
--
-- Una sola sentencia para TODO el mundo, no una por persona: la función
-- programada de Netlify se muere a los 30 segundos (lo aprendimos en la
-- 322), y hacer una consulta por coleccionista se comería el presupuesto
-- en cuanto haya unos cuantos. Aquí Postgres hace un `group by` y ya
-- está.
--
-- ── EL VALOR ES EL MISMO QUE ENSEÑA LA PÁGINA ──
--
-- Y eso NO es evidente: si la foto sumara distinto que la pantalla, un
-- día la gráfica diría 400 € y la cifra de arriba 380, y nadie sabría
-- cuál creerse. El orden es el mismo que `valorDeLinea` + `valorDe` en
-- js/cardmarket.js: manda el valor que le puso su dueño; si no, la
-- tendencia de Cardmarket; si no, la media de 30 días; si no, el
-- «desde». Y la variante `reverse` coge las cifras `-holo` cuando las
-- hay, con la misma caída a las normales que arregló la tanda 375.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

create table if not exists public.user_collection_value (
  user_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  valor numeric(12, 2) not null default 0,
  copias int not null default 0,
  distintas int not null default 0,
  -- Cuántas cartas no tenían precio ese día. Sin esto, un salto en la
  -- gráfica no se puede distinguir de «ese día se curaron 200 precios»,
  -- que es lo que va a pasar de verdad las primeras semanas.
  sin_precio int not null default 0,
  created_at timestamptz not null default now(),

  primary key (user_id, dia)
);

create index if not exists user_collection_value_dia_idx on public.user_collection_value (dia);

alter table public.user_collection_value enable row level security;

-- Tu histórico es tuyo, y de quien tenga tu colección pública: enseñar
-- la gráfica en una colección pública y esconder el total de arriba no
-- tendría ningún sentido, y ese total ya se ve.
drop policy if exists user_collection_value_ver on public.user_collection_value;
create policy user_collection_value_ver on public.user_collection_value
  for select using (auth.uid() = user_id or public.coleccion_es_publica(user_id));

grant select on public.user_collection_value to anon, authenticated;
-- Escribir, solo la función programada con la clave de servicio.

-- El valor de UNA línea, con el mismo orden que la página. Suelta y
-- `immutable` para que se pueda leer sola y para que la sentencia de
-- abajo no sea un muro de `coalesce`.
create or replace function public.valor_de_linea(
  p_valor_manual numeric,
  p_cantidad int,
  p_variante text,
  p_trend numeric, p_avg30 numeric, p_low numeric,
  p_trend_holo numeric, p_avg30_holo numeric, p_low_holo numeric
)
returns numeric
language sql
immutable
as $$
  select coalesce(
    nullif(p_valor_manual, 0),
    -- La variante `reverse` va por sus cifras... y si no las tiene, por
    -- las normales (tanda 375): un reverso sin precio propio no vale
    -- cero, vale por lo menos lo que vale la carta.
    case when p_variante = 'reverse'
         then coalesce(nullif(p_trend_holo, 0), nullif(p_avg30_holo, 0), nullif(p_low_holo, 0))
    end,
    nullif(p_trend, 0), nullif(p_avg30, 0), nullif(p_low, 0),
    0
  ) * greatest(coalesce(p_cantidad, 1), 0);
$$;

-- La foto de hoy, de todo el mundo, en una sentencia.
--
-- `on conflict do update` y no `insert` a secas: la función programada
-- puede correr dos veces el mismo día (un reintento, un despliegue), y
-- dos filas del mismo día partirían la gráfica en dos puntos con la
-- misma fecha.
create or replace function public.coleccion_foto_diaria(p_dia date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  insert into public.user_collection_value (user_id, dia, valor, copias, distintas, sin_precio)
  select c.user_id,
         p_dia,
         sum(public.valor_de_linea(
           c.valor_manual, c.cantidad, c.variante,
           pr.cm_trend, pr.cm_avg30, pr.cm_low,
           pr.cm_trend_holo, pr.cm_avg30_holo, pr.cm_low_holo)),
         sum(c.cantidad),
         count(distinct c.card_id),
         -- «Sin precio» se cuenta en COPIAS, igual que lo dice la página
         -- («3 cartas no tienen precio todavía»).
         coalesce(sum(c.cantidad) filter (
           where coalesce(c.valor_manual, 0) = 0
             and coalesce(pr.cm_trend, pr.cm_avg30, pr.cm_low, 0) = 0
         ), 0)
    from public.user_collection c
    left join public.tcg_card_prices pr on pr.card_id = c.card_id
   group by c.user_id
  on conflict (user_id, dia) do update
    set valor = excluded.valor,
        copias = excluded.copias,
        distintas = excluded.distintas,
        sin_precio = excluded.sin_precio;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

-- Solo la función programada: recorrer TODAS las colecciones no es cosa
-- de nadie más, aunque el resultado sea una suma.
revoke all on function public.coleccion_foto_diaria(date) from public, anon, authenticated;
grant execute on function public.coleccion_foto_diaria(date) to service_role;

commit;

-- Comprobación: la tabla, su política y la función.
select policyname, cmd from pg_policies where tablename = 'user_collection_value';
select proname from pg_proc where proname in ('coleccion_foto_diaria', 'valor_de_linea') order by proname;

notify pgrst, 'reload schema';
