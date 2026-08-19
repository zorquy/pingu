-- Usuarios en línea, invitados incluidos
-- ============================================================
--
-- El lateral del foro decía quién ha pasado hoy, pero solo con cuenta.
-- Los visitantes sin registrar —que en una web recién anunciada son la
-- mayoría— eran invisibles, y el foro parecía más vacío de lo que está.
-- Esto añade el clásico "Usuarios en línea" de los foros de siempre:
-- "Total: 12 (miembros: 3, invitados: 9)".
--
-- Cómo funciona (la otra mitad está en js/en-linea.js):
--
--   - Cada pestaña del navegador genera un token aleatorio que vive en
--     sessionStorage (muere al cerrar la pestaña — a propósito: un
--     identificador que sobrevive días sería un rastreador).
--   - En cada carga de página, el navegador llama a latido_en_linea()
--     con ese token. Con sesión abierta se apunta también quién es.
--   - "En línea" = tener un latido en los últimos minutos.
--   - Los robots no laten: js/en-linea.js los filtra con pareceRobot().
--
-- No se guarda IP, ni user agent, ni ruta: un token aleatorio, quién (si
-- tiene cuenta) y una hora. Y caduca solo.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

create table if not exists public.online_now (
  token text primary key,
  -- Nulo = invitado. Con cuenta se apunta para poder nombrarlo.
  user_id uuid references auth.users (id) on delete cascade,
  last_seen timestamptz not null default now()
);

create index if not exists online_now_last_seen_idx
  on public.online_now (last_seen);

alter table public.online_now enable row level security;

-- Leer puede cualquiera: el contador se enseña también a quien llega sin
-- cuenta. Lo único legible es (token aleatorio, user_id, hora) — y quién
-- está en línea es justo lo que este panel dice a la cara.
drop policy if exists "online_now_select" on public.online_now;
create policy "online_now_select" on public.online_now for select using (true);

-- ESCRIBIR, en cambio, nadie directamente: ni insert, ni update, ni
-- delete. La única puerta es la función de abajo, que impone la forma
-- del token y pone ella la hora — así nadie puede plantar filas con
-- fechas inventadas ni borrar a los demás del contador.

create or replace function public.latido_en_linea(p_token text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Solo tokens con pinta de UUID (los genera crypto.randomUUID()).
  -- Cualquier otra cosa se ignora sin error: no vale la pena romperle
  -- la página a nadie por un contador.
  if p_token is null or p_token !~ '^[0-9a-f-]{36}$' then
    return;
  end if;

  insert into public.online_now as o (token, user_id, last_seen)
  values (p_token, auth.uid(), now())
  on conflict (token) do update
    set last_seen = now(),
        -- Si alguien inicia sesión a mitad de visita, su pestaña pasa de
        -- invitado a miembro. Al revés no: un token no se "des-loguea"
        -- (al cerrar sesión la página recarga y el token sigue siendo la
        -- misma persona).
        user_id = coalesce(auth.uid(), o.user_id);

  -- Limpieza oportunista: los latidos de hace más de un día ya no le
  -- sirven a nadie. Va aquí y no en un cron porque Supabase no da cron
  -- gratis, y con el tráfico de esta web es un delete de nada.
  delete from public.online_now where last_seen < now() - interval '1 day';
end;
$$;

grant execute on function public.latido_en_linea(text) to anon, authenticated;

commit;

-- Que PostgREST se entere de la tabla y la función nuevas sin esperar a
-- que recargue el esquema por su cuenta.
notify pgrst, 'reload schema';

-- ── Comprobación ──
-- select latido_en_linea('00000000-0000-4000-8000-000000000000');
-- select count(*) filter (where user_id is null) as invitados,
--        count(distinct user_id) as miembros
--   from public.online_now
--  where last_seen > now() - interval '15 minutes';
