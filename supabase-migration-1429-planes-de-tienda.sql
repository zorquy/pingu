-- Tanda 1429 — Los planes de las tiendas (PINGU, 2026-11-24: «más caro de
-- entrada… el recomendado debería ser el tienda… el tienda plus debería ser
-- desorbitado»). Cuatro planes: Gratis, Puesto, Tienda y Tienda+. Cada tienda
-- entra con DOS MESES de Tienda+ gratis; las que entran antes del 1 de marzo de
-- 2027 son FUNDADORAS y se quedan su precio mientras sigan pagando.
--
-- De momento NO se cobra nada desde la web: el plan lo pone el equipo a mano en
-- /admin → Tiendas (`admin_tienda_plan`). Cuando haya cobro, lo que cambie es
-- quién escribe `pagado_hasta`, no estas tablas.
--
--   1. `tienda_planes`: una fila por tienda. PRIVADA: la lee la propia tienda y
--      el equipo; nadie la escribe a pelo (solo estas funciones).
--   2. `tienda_plan_de(tienda)`: el plan que vale HOY. En prueba, Tienda+; con
--      `pagado_hasta` en el futuro, el suyo; si no, Gratis. Sin fila, Tienda+
--      (una tienda que entró antes de esta migración y se nos escapó no se
--      queda cerrada por un fallo nuestro).
--   3. `tienda_mi_plan()`: lo que enseña el panel (Panel, Datos → Tu plan).
--   4. `tienda_me_quedo(plan)`: «Me quedo con…». No cobra: apunta qué plan
--      quiere para que el equipo lo sepa antes de que acabe la prueba.
--   5. `admin_tienda_plan(tienda, cambios)`: el equipo pone plan, fechas,
--      fundadora y nota.
--   6. Al dar de alta una tienda (`tiendas` nueva) nace su fila con la prueba.
--      Las que ya hay, fundadoras con sus 60 días desde hoy.
--   7. `tiendas_planes_al_dia()`: la campanita a 7 días del final de la prueba
--      y el día que acaba (una vez cada una; se marca ANTES de avisar, la 665).
--      La llama la función de cada hora (`avisos-recordatorio`).
--
-- La puerta de cada función (qué abre cada plan) está en la web
-- (`js/tienda-plan.js`, `PUEDE`), no en la base: una tienda que llame a la API
-- a mano podría saltársela. Es a propósito mientras no se cobre (SCHEMA 1429).
--
-- Sentencia a sentencia, sin tablas temporales (la 631).

create table if not exists public.tienda_planes (
  tienda_id uuid primary key references public.user_profiles(id) on delete cascade,
  plan text not null default 'gratis',
  prueba_hasta timestamptz,
  pagado_hasta timestamptz,
  fundadora boolean not null default false,
  se_queda text,
  se_queda_at timestamptz,
  nota text,
  aviso_7_at timestamptz,
  aviso_fin_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tienda_planes_plan check (plan in ('gratis', 'puesto', 'tienda', 'tienda_mas')),
  constraint tienda_planes_se_queda check (se_queda is null or se_queda in ('puesto', 'tienda', 'tienda_mas')),
  constraint tienda_planes_nota check (nota is null or char_length(nota) <= 300)
);

alter table public.tienda_planes enable row level security;

-- Leer, por la política de abajo; escribir, nunca a pelo: solo las funciones.
-- (Supabase da todo a `anon` y `authenticated` en cada tabla nueva.)
revoke all on public.tienda_planes from anon, authenticated;
grant select on public.tienda_planes to authenticated;

drop policy if exists tienda_planes_leer on public.tienda_planes;
create policy tienda_planes_leer on public.tienda_planes
  for select to authenticated
  using (tienda_id = auth.uid() or coalesce(public.is_admin(), false));

-- El plan que vale hoy.
create or replace function public.tienda_plan_de(p_tienda uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when p.prueba_hasta is not null and p.prueba_hasta > now() then 'tienda_mas'
      when p.pagado_hasta is not null and p.pagado_hasta > now() then p.plan
      else 'gratis'
    end
    from tienda_planes p where p.tienda_id = p_tienda
  ), 'tienda_mas')
$$;
revoke all on function public.tienda_plan_de(uuid) from public;
grant execute on function public.tienda_plan_de(uuid) to authenticated;

-- Lo que enseña el panel de la propia tienda.
create or replace function public.tienda_mi_plan()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'plan', public.tienda_plan_de(auth.uid()),
    'pagado', p.plan,
    'prueba_hasta', p.prueba_hasta,
    'pagado_hasta', p.pagado_hasta,
    'fundadora', coalesce(p.fundadora, false),
    'se_queda', p.se_queda,
    'existe', p.tienda_id is not null
  )
  from (select auth.uid() as uid) yo
  left join tienda_planes p on p.tienda_id = yo.uid
  where exists (select 1 from user_profiles u where u.id = auth.uid() and u.tipo = 'tienda')
$$;
revoke all on function public.tienda_mi_plan() from public;
grant execute on function public.tienda_mi_plan() to authenticated;

-- «Me quedo con…»: no cobra nada; apunta el plan que quiere.
create or replace function public.tienda_me_quedo(p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from user_profiles where id = auth.uid() and tipo = 'tienda') then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  if p_plan is not null and p_plan not in ('puesto', 'tienda', 'tienda_mas') then
    raise exception 'Ese plan no existe.' using errcode = '22023';
  end if;
  insert into tienda_planes (tienda_id, prueba_hasta, fundadora, se_queda, se_queda_at)
  values (auth.uid(), now() + interval '60 days', now() < '2027-03-01', p_plan, case when p_plan is null then null else now() end)
  on conflict (tienda_id) do update
    set se_queda = excluded.se_queda, se_queda_at = excluded.se_queda_at, updated_at = now();
end;
$$;
revoke all on function public.tienda_me_quedo(text) from public;
grant execute on function public.tienda_me_quedo(text) to authenticated;

-- El equipo: plan, hasta cuándo, fundadora y nota. Solo cambia las claves que
-- vengan en `p_cambios`; una fecha a null la quita.
create or replace function public.admin_tienda_plan(p_tienda uuid, p_cambios jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.tienda_planes;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Solo el equipo.' using errcode = '42501';
  end if;
  if not exists (select 1 from user_profiles where id = p_tienda and tipo = 'tienda') then
    raise exception 'Esa cuenta no es una tienda.' using errcode = '22023';
  end if;
  insert into tienda_planes (tienda_id) values (p_tienda) on conflict (tienda_id) do nothing;
  update tienda_planes set
    plan = case when p_cambios ? 'plan' then p_cambios->>'plan' else plan end,
    pagado_hasta = case when p_cambios ? 'pagado_hasta' then (p_cambios->>'pagado_hasta')::timestamptz else pagado_hasta end,
    prueba_hasta = case when p_cambios ? 'prueba_hasta' then (p_cambios->>'prueba_hasta')::timestamptz else prueba_hasta end,
    fundadora = case when p_cambios ? 'fundadora' then coalesce((p_cambios->>'fundadora')::boolean, false) else fundadora end,
    nota = case when p_cambios ? 'nota' then nullif(trim(p_cambios->>'nota'), '') else nota end,
    -- Una prueba alargada vuelve a avisar a sus 7 días.
    aviso_7_at = case when p_cambios ? 'prueba_hasta' then null else aviso_7_at end,
    aviso_fin_at = case when p_cambios ? 'prueba_hasta' then null else aviso_fin_at end,
    updated_at = now()
  where tienda_id = p_tienda
  returning * into v;
  return to_jsonb(v) || jsonb_build_object('vale', public.tienda_plan_de(p_tienda));
end;
$$;
revoke all on function public.admin_tienda_plan(uuid, jsonb) from public;
grant execute on function public.admin_tienda_plan(uuid, jsonb) to authenticated;

-- Al dar de alta una tienda nace su prueba (y es fundadora si entra a tiempo).
create or replace function public.tienda_planes_al_nacer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into tienda_planes (tienda_id, prueba_hasta, fundadora)
  values (new.user_id, now() + interval '60 days', now() < '2027-03-01')
  on conflict (tienda_id) do nothing;
  return new;
exception when others then
  -- Que el alta de la tienda no se caiga por esto: sin fila, el plan es Tienda+.
  return new;
end;
$$;

drop trigger if exists trg_tienda_planes_al_nacer on public.tiendas;
create trigger trg_tienda_planes_al_nacer
  after insert on public.tiendas
  for each row execute function public.tienda_planes_al_nacer();

-- Las que ya están: fundadoras, con sus 60 días desde hoy.
insert into public.tienda_planes (tienda_id, prueba_hasta, fundadora)
select u.id, now() + interval '60 days', true
from public.user_profiles u
where u.tipo = 'tienda'
on conflict (tienda_id) do nothing;

-- La campanita: a 7 días del final de la prueba y el día que acaba. Una vez
-- cada una, de 10 a 22 de Madrid, y se marca antes de avisar (la 665).
create or replace function public.tiendas_planes_al_dia(p_ahora timestamptz default now())
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hora int := extract(hour from p_ahora at time zone 'Europe/Madrid');
  v_n int := 0;
  r record;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(is_admin(), false) then
    raise exception 'Solo el servidor.' using errcode = '42501';
  end if;
  if v_hora < 10 or v_hora >= 22 then
    return 0;
  end if;
  for r in
    update tienda_planes p set aviso_7_at = p_ahora
    where p.prueba_hasta is not null and p.aviso_7_at is null
      and p.prueba_hasta > p_ahora and p.prueba_hasta <= p_ahora + interval '7 days'
      and not (p.pagado_hasta is not null and p.pagado_hasta > p.prueba_hasta)
    returning p.tienda_id, p.prueba_hasta, p.fundadora
  loop
    insert into user_notifications (recipient_id, type, title, body, link)
    values (r.tienda_id, 'tienda_plan',
      'Tu prueba de Tienda+ acaba en ' || greatest(1, ceil(extract(epoch from (r.prueba_hasta - p_ahora)) / 86400))::int || ' días',
      case when r.fundadora then 'Eres fundadora: elige plan y te quedas tu precio mientras sigas. Si no, pasas a Gratis y no se borra nada.'
           else 'Elige plan en Datos → Tu plan. Si no, pasas a Gratis y no se borra nada.' end,
      '/tienda?ver=datos#plan');
    v_n := v_n + 1;
  end loop;
  for r in
    update tienda_planes p set aviso_fin_at = p_ahora
    where p.prueba_hasta is not null and p.aviso_fin_at is null
      and p.prueba_hasta <= p_ahora and p.prueba_hasta > p_ahora - interval '3 days'
      and not (p.pagado_hasta is not null and p.pagado_hasta > p_ahora)
    returning p.tienda_id
  loop
    insert into user_notifications (recipient_id, type, title, body, link)
    values (r.tienda_id, 'tienda_plan', 'Tu prueba de Tienda+ ha acabado',
      'Tu escaparate y tu stock siguen igual. El mostrador, las ventas y las cifras vuelven en cuanto elijas plan.',
      '/tienda?ver=datos#plan');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.tiendas_planes_al_dia(timestamptz) from public;
grant execute on function public.tiendas_planes_al_dia(timestamptz) to authenticated, service_role;
