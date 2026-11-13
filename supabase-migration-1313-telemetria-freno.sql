-- Tanda 1313 — la analítica y los errores, con freno (S8 del plan).
--
-- `page_views` y `client_errors` aceptan filas de cualquiera, sin cuenta: es
-- lo que las hace funcionar (una visita o un error pasan antes de entrar).
-- Pero sin límite, alguien con un bucle inventa diez mil visitas o llena la
-- base de errores falsos, y con un `user_id` que no es el suyo. Un disparador
-- por delante:
--   · el `user_id` es el de quien escribe (o ninguno), nunca otro;
--   · los textos se recortan a un largo razonable (no se rechazan: un error
--     de verdad con una traza larga sigue entrando);
--   · y como mucho N filas por minuto entre todos (visitas 300, errores 60):
--     lo de más se descarta SIN error, para que un bucle no aprenda nada.
-- Por minuto y no por navegador porque estas filas no llevan quién las manda
-- (la 1065, a propósito). Con el tráfico de hoy, el tope no se toca nunca.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

create table if not exists public.telemetria_ritmo (
  tabla text not null,
  minuto timestamptz not null,
  n integer not null default 0,
  primary key (tabla, minuto)
);

alter table public.telemetria_ritmo enable row level security;

create or replace function public.freno_de_telemetria()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tope integer := coalesce(nullif(tg_argv[0], '')::integer, 300);
  v_minuto timestamptz := date_trunc('minute', now());
  v_n integer;
begin
  -- Nadie apunta una visita o un error a nombre de otro.
  if new.user_id is not null and new.user_id is distinct from auth.uid() then
    new.user_id := auth.uid();
  end if;
  if tg_table_name = 'page_views' then
    new.path := left(new.path, 300);
    new.origen := left(new.origen, 120);
    new.campana := left(new.campana, 120);
    new.aparato := left(new.aparato, 60);
  elsif tg_table_name = 'client_errors' then
    new.message := left(new.message, 600);
    new.stack := left(new.stack, 4000);
    new.page_url := left(new.page_url, 500);
    new.user_agent := left(new.user_agent, 300);
    new.status := 'new';
  end if;
  insert into public.telemetria_ritmo as r (tabla, minuto, n) values (tg_table_name, v_minuto, 1)
  on conflict (tabla, minuto) do update set n = r.n + 1
  returning n into v_n;
  -- De vez en cuando, fuera los minutos viejos (la tabla se queda en nada).
  if random() < 0.01 then
    delete from public.telemetria_ritmo where minuto < now() - interval '2 hours';
  end if;
  if v_n > v_tope then
    return null;
  end if;
  return new;
end $$;

-- Si a page_views le falta alguna columna de la 1065 o de la analítica, el
-- disparador no puede tocarla: se ponen aquí (no hacen nada si ya están).
alter table public.page_views add column if not exists origen text;

alter table public.page_views add column if not exists campana text;

alter table public.page_views add column if not exists aparato text;

drop trigger if exists trg_freno_page_views on public.page_views;

create trigger trg_freno_page_views before insert on public.page_views
  for each row execute function public.freno_de_telemetria('300');

drop trigger if exists trg_freno_client_errors on public.client_errors;

create trigger trg_freno_client_errors before insert on public.client_errors
  for each row execute function public.freno_de_telemetria('60');
