-- Un torneo «privado» pasa a ser un torneo CON CÓDIGO (tanda 367).
--
-- Lo pidió PINGU: «los torneos privados sí deberían ser públicos y
-- visibles, pero que te puedas apuntar eso debería ir con el código».
--
-- ── QUÉ CAMBIA ──
--
-- Hasta hoy `is_private` significaba INVISIBLE: la política escondía la
-- fila entera y el torneo no existía para quien no estuviera dentro. Eso
-- resolvía la entrada de rebote —si no puedes leer el id, no puedes
-- inscribirte— pero se llevaba por delante el escaparate: un torneo de
-- una tienda o de un grupo no salía en ninguna parte, no lo indexaba
-- nadie y no traía a nadie nuevo.
--
-- A partir de aquí hay UNA regla y es la del enunciado: **se VE como
-- cualquier otro, se ENTRA con el código**.
--
-- ── Y ENTONCES EL CÓDIGO, ¿DÓNDE VIVE? ──
--
-- No en `tournaments`. En cuanto la fila es pública, cualquier columna
-- suya es pública: dejar `join_code` ahí sería repartir la llave con la
-- puerta. Y esconderla columna a columna tampoco vale — en Postgres un
-- `select *` de un rol sin permiso sobre UNA columna no la devuelve
-- vacía: falla la consulta entera, y el cliente pide `tournaments` con
-- `*` en varios sitios (es lo que ya vigila test-torneos-21).
--
-- Así que el código se muda a su propia tabla, que solo lee quien lleva
-- el torneo. `select *` sobre `tournaments` sigue funcionando igual
-- porque la columna ya no está.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera.

-- ------------------------------------------------------------
-- 1. La tabla del código
-- ------------------------------------------------------------
create table if not exists public.tournament_join_codes (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  code text not null,
  updated_at timestamptz not null default now()
);

comment on table public.tournament_join_codes is
  'El código para entrar a un torneo con código. Vive fuera de tournaments porque esa fila la lee todo el mundo: aquí solo llega quien lleva el torneo.';

-- Los que ya había, antes de quitar la columna. Sin esto, los torneos
-- con código que estén en marcha se quedarían sin llave.
--
-- Va dentro de un DO con la comprobación delante porque al final de esta
-- migración la columna ya no existe: sin el guarda, ejecutarla una
-- segunda vez —que es algo que aquí se hace— reventaría en este punto y
-- dejaría la mitad de abajo sin pasar.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'tournaments' and column_name = 'join_code'
  ) then
    insert into public.tournament_join_codes (tournament_id, code)
      select id, trim(join_code)
        from public.tournaments
       where coalesce(trim(join_code), '') <> ''
      on conflict (tournament_id) do nothing;
  end if;
end $$;

alter table public.tournament_join_codes enable row level security;

-- Una sola política para las cuatro operaciones: quien lleva el torneo
-- (admin del sitio, organizador o quien lo creó — ver CLAUDE.md). Nadie
-- más lo lee, y por eso el código sigue siendo un secreto aunque el
-- torneo se vea.
drop policy if exists codigos_mando on public.tournament_join_codes;
create policy codigos_mando on public.tournament_join_codes for all
  using (public.torneos_mando(tournament_id))
  with check (public.torneos_mando(tournament_id));

revoke all on table public.tournament_join_codes from anon;
grant select, insert, update, delete on table public.tournament_join_codes to authenticated;

-- ------------------------------------------------------------
-- 2. Inscribirse, ahora con código
-- ------------------------------------------------------------
-- ESTE es el candado de verdad. Antes no hacía falta: como la fila no se
-- podía leer, nadie sabía el id que pide esta función. Ahora el id lo
-- sabe cualquiera, así que sin esta comprobación un torneo con código se
-- entraría sin código — y **sin dar ningún error**, que es la forma en
-- que estos fallos se quedan meses puestos.
--
-- `p_codigo` va al final y con valor por defecto para que la llamada de
-- TRES parámetros que hay desplegada ahora mismo siga valiendo mientras
-- dura el despliegue: PostgREST casa por NOMBRE de parámetro y rellena
-- el que falta con su defecto. Y como ese defecto es null, un cliente
-- viejo tampoco se cuela en un torneo con código.
--
-- La de tres parámetros hay que BORRARLA, no dejarla al lado: dos
-- funciones que se pueden llamar con los mismos tres nombres son una
-- llamada ambigua, y Postgres la rechaza en vez de elegir.
drop function if exists public.torneos_inscribirse(uuid, text, boolean);

create or replace function public.torneos_inscribirse(
  p_torneo uuid, p_tcg_live text, p_cola boolean default false, p_codigo text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_torneo tournaments%rowtype;
  v_codigo text;
  v_ocupadas int;
  v_lleno boolean;
  v_estado text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para inscribirte.'; end if;
  if coalesce(trim(p_tcg_live), '') = '' then raise exception 'Di tu usuario de TCG Live.'; end if;

  -- El lock de fila serializa el recuento: dos inscripciones a la vez
  -- ya no pueden rebasar las plazas.
  select * into v_torneo from tournaments where id = p_torneo for update;
  if not found then raise exception 'Torneo no encontrado.'; end if;

  -- El código, antes que nada: si no encaja, no se cuentan plazas ni se
  -- toca nada. Y aquí SÍ se dice qué ha fallado —el torneo se ve, así
  -- que el mensaje no cuenta nada que no estuviera ya en pantalla.
  if coalesce(v_torneo.is_private, false) then
    select trim(code) into v_codigo from tournament_join_codes where tournament_id = p_torneo;
    if coalesce(v_codigo, '') = '' then
      raise exception 'Este torneo pide código para entrar y todavía no tiene ninguno: pídeselo a quien lo organiza.';
    end if;
    if coalesce(trim(p_codigo), '') = '' then
      raise exception 'Este torneo pide un código para entrar.';
    end if;
    -- Sin distinguir mayúsculas ni espacios de los lados: un código se
    -- copia y se pega, y se pega mal.
    if lower(trim(p_codigo)) <> lower(v_codigo) then
      raise exception 'El código no es correcto.';
    end if;
  end if;

  if v_torneo.status <> 'registration_open' then
    raise exception 'Las inscripciones no están abiertas.';
  end if;
  if exists (select 1 from tournament_registrations where tournament_id = p_torneo and user_id = auth.uid()) then
    raise exception 'Ya estás inscrito en este torneo.';
  end if;

  select count(*) into v_ocupadas
    from tournament_registrations
    where tournament_id = p_torneo and status = 'active';
  -- max_players NULL = aforo sin límite (tanda 229): no hay cupo que
  -- comprobar. El IS NOT NULL va explícito, no fiado de que NULL >= n
  -- «ya dé falso»: la intención tiene que leerse.
  v_lleno := v_torneo.max_players is not null and v_ocupadas >= v_torneo.max_players;

  -- A la cola se va por dos caminos: porque la persona lo elige, o
  -- porque el torneo se llenó mientras rellenaba el formulario. En el
  -- segundo no se la echa — para eso está la cola.
  if p_cola or v_lleno then
    v_estado := 'waitlisted';
  else
    v_estado := 'active';
  end if;

  insert into tournament_registrations (tournament_id, user_id, status, tcg_live_username)
    values (p_torneo, auth.uid(), v_estado, trim(p_tcg_live))
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.torneos_inscribirse(uuid, text, boolean, text) from public;
grant execute on function public.torneos_inscribirse(uuid, text, boolean, text) to authenticated;

-- ------------------------------------------------------------
-- 3. Entrar por el enlace, con el código en su sitio nuevo
-- ------------------------------------------------------------
-- Esta función ya no la llama nadie: existía para entrar a un torneo que
-- NO SE PODÍA VER, y eso se acabó. Se queda —delegando en la de arriba,
-- sin lógica propia— solo mientras dure el despliegue, porque un
-- navegador con el JavaScript viejo en caché todavía puede llamarla.
-- Quitarla cuando lleve un tiempo, igual que el puente de comun.js.
create or replace function public.torneos_entrar_con_codigo(
  p_slug text, p_codigo text, p_tcg_live text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from tournaments where slug = p_slug;
  if v_id is null then raise exception 'Torneo no encontrado.'; end if;
  -- Un solo sitio donde se comprueba el código y se cuentan las plazas.
  return public.torneos_inscribirse(v_id, p_tcg_live, false, p_codigo);
end $$;

revoke all on function public.torneos_entrar_con_codigo(text, text, text) from public;
grant execute on function public.torneos_entrar_con_codigo(text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 4. La política de lectura pierde el candado de lo privado
-- ------------------------------------------------------------
-- Lo de los borradores se queda tal cual: un torneo a medio montar no lo
-- ve nadie más que quien lo monta. Lo que se va es el escondite de
-- `is_private`, que es justo lo que se quería quitar.
drop policy if exists torneos_leer on public.tournaments;
create policy torneos_leer on public.tournaments for select
  using (status <> 'draft' or admin_id = auth.uid() or torneos_soy_admin());

comment on column public.tournaments.is_private is
  'Con código: se ve como cualquier otro torneo, pero para inscribirse hace falta el código de tournament_join_codes.';

-- `torneos_estoy_inscrito` se queda definida pero ya no la usa la
-- política: era el «o estoy dentro» del escondite. No se borra porque es
-- una función pública y barata, y decirlo aquí evita que alguien la mire
-- dentro de seis meses buscando quién la llama.

-- ------------------------------------------------------------
-- 5. Y ahora sí, fuera la columna
-- ------------------------------------------------------------
-- Va la ÚLTIMA a propósito: hasta aquí las funciones de arriba ya están
-- puestas y ninguna la lee. Si se quitara antes, la ventana entre una
-- cosa y otra dejaría torneos sin código.
alter table public.tournaments drop column if exists join_code;

notify pgrst, 'reload schema';
