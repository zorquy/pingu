-- Tanda 1310 — el timbre: la base decide, Netlify trabaja (C2 del plan).
--
-- Netlify cobra cada vez que una función programada se despierta, haya algo
-- que hacer o no. Tres se despiertan sin parar para casi nada: el barredor de
-- torneos (cada minuto: 1.440 veces al día), los correos y los avisos push
-- (cada cinco). La base, en cambio, puede mirar cada minuto GRATIS si hay
-- trabajo (con `pg_cron`) y llamar a Netlify solo entonces (con `pg_net`), a la
-- función `timbre`, que comprueba una clave y ejecuta la que toca.
--
-- ANTES de ejecutar esta migración (una vez, a mano; la clave NO va en el
-- repo):
--   1. Supabase → Database → Extensions: activar `pg_cron` y `pg_net`.
--   2. Inventar una clave larga y guardarla en DOS sitios:
--        · Supabase (SQL Editor): select vault.create_secret('LA-CLAVE', 'timbre_secreto');
--        · Netlify → Site configuration → Environment variables: TIMBRE_SECRETO = LA-CLAVE
-- Sin la clave en el Vault, el timbre no llama a nadie (y las tres funciones
-- siguen con su horario de Netlify, que esta tanda NO quita: se espaciarán
-- cuando /admin → Hoy enseñe que el timbre suena).
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

-- 1. Las extensiones (si ya están, nada). Si no se pueden crear desde aquí,
-- un aviso y se sigue: se activan en Database → Extensions y se vuelve a
-- ejecutar esto entero.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net: %', sqlerrm;
end $$;

do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron: %', sqlerrm;
end $$;

-- 2. ¿Hay trabajo? Lo mismo que mira cada función al empezar, en SQL.
create or replace function public.timbre_hay_trabajo(p_que text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_que = 'torneos' then
    return exists (select 1 from public.rounds where status = 'active')
      or exists (select 1 from public.tournaments t where
           (t.status = 'registration_open' and t.registration_notified_at is null)
        or (t.status = 'cancelled' and t.cancel_notified_at is null)
        or (t.status in ('registration_open', 'registration_closed') and t.reminder_notified_at is null
            and t.start_at between now() and now() + interval '61 minutes')
        or (t.status = 'finished' and t.podium is not null and t.xp_awarded_at is null)
        or (t.status = 'finished' and t.finish_notified_at is null))
      or exists (select 1 from public.judge_calls j where j.status = 'open' and j.notified_at is null)
      or exists (select 1 from public.tournament_registrations r join public.tournaments t on t.id = r.tournament_id
                  where r.status = 'waitlisted' and t.status in ('registration_open', 'registration_closed'));
  elsif p_que = 'correos' then
    return exists (select 1 from public.email_outbox where status = 'pending')
      or exists (select 1 from public.email_outbox where status = 'sending' and claimed_at < now() - interval '10 minutes');
  elsif p_que = 'push' then
    return exists (select 1 from public.user_notifications where pushed_at is null and created_at > now() - interval '24 hours');
  end if;
  return false;
end $$;

-- 3. Tocar: para cada trabajo pendiente, una llamada a la función `timbre`.
-- Apunta lo que hace en `scrydex_estado` (clave `timbre`), que /admin lee.
create or replace function public.timbre_tocar()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_secreto text;
  v_que text;
  v_llamadas jsonb := '{}'::jsonb;
  v_hay boolean;
begin
  begin
    select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'timbre_secreto' limit 1;
  exception when others then
    v_secreto := null;
  end;
  if v_secreto is null or v_secreto = '' then
    return;
  end if;
  foreach v_que in array array['torneos', 'correos', 'push'] loop
    begin
      v_hay := public.timbre_hay_trabajo(v_que);
    exception when others then
      -- Una tabla que no existe o un fallo de la consulta: se llama igual (más
      -- vale una llamada de más que un torneo parado).
      v_hay := true;
    end;
    if v_hay then
      perform net.http_post(
        url := 'https://pokedoc.es/.netlify/functions/timbre?que=' || v_que,
        headers := jsonb_build_object('x-timbre', v_secreto, 'content-type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      );
      v_llamadas := v_llamadas || jsonb_build_object(v_que, true);
    end if;
  end loop;
  insert into public.scrydex_estado (clave, valor, updated_at)
  values ('timbre', jsonb_build_object('ultimo', now(), 'llamadas', v_llamadas), now())
  on conflict (clave) do update set
    valor = jsonb_build_object(
      'ultimo', now(),
      'llamadas', excluded.valor -> 'llamadas',
      'llamadasHoy', case when (public.scrydex_estado.valor ->> 'dia') = to_char(now(), 'YYYY-MM-DD')
                          then coalesce((public.scrydex_estado.valor ->> 'llamadasHoy')::int, 0) + (select count(*) from jsonb_object_keys(v_llamadas))
                          else (select count(*) from jsonb_object_keys(v_llamadas)) end,
      'dia', to_char(now(), 'YYYY-MM-DD')),
    updated_at = now();
end $$;

-- Solo la llama el cron (que es `postgres`): nadie desde la web.
revoke all on function public.timbre_tocar() from public, anon, authenticated;

revoke all on function public.timbre_hay_trabajo(text) from public, anon, authenticated;

-- 4. Cada minuto. `cron.schedule` con nombre sustituye al de antes.
do $$
begin
  perform cron.schedule('pokedoc-timbre', '* * * * *', 'select public.timbre_tocar()');
exception when undefined_function or invalid_schema_name then
  raise notice 'pg_cron no está activado: actívalo en Supabase → Database → Extensions y vuelve a ejecutar esto.';
end $$;
