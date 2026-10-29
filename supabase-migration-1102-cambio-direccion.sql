-- Tanda 1102: la dirección en los cambios por correo (propuesta «La
-- dirección en los cambios por correo», PINGU: «dale» con lo recomendado).
--
-- Pone su dirección quien RECIBE cartas en un trato por correo: en una venta,
-- quien compra; en un cambio, los dos; en mano, nadie. Quien manda la ve en el
-- trato para copiarla. Tres piezas:
--
--   1. `user_direcciones`: TU dirección guardada (Ajustes → Dirección de
--      envío), una por persona. Solo la lees y la escribes tú (RLS).
--   2. `trade_offer_direcciones`: la copia de cada trato, para que si cambias
--      de casa el trato de ayer siga diciendo a dónde se mandó. Sin políticas:
--      se escribe con `cambio_direccion_poner` y se lee con
--      `cambio_direcciones`, que solo da la del OTRO cuando el trato está
--      aceptado (o hecho). La tuya, siempre.
--   3. `cambio_direccion_poner(oferta, dir)`: quien la recibe la pone al
--      aceptar (la web la manda justo antes de `cambio_aceptar`); quien la
--      propone, al enviarla; y quien no la puso, después. Con el trato ya
--      aceptado, avisa al otro («Dirección lista» en Mensajes).
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 942, la 1099 (el envío) y la 1101 (el mensaje con su tarjeta).
begin;

create table if not exists public.user_direcciones (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  calle text not null check (char_length(btrim(calle)) between 3 and 200),
  cp text not null check (char_length(btrim(cp)) between 3 and 12),
  ciudad text not null check (char_length(btrim(ciudad)) between 2 and 80),
  provincia text check (provincia is null or char_length(provincia) <= 80),
  telefono text check (telefono is null or char_length(telefono) <= 30),
  updated_at timestamptz not null default now()
);

alter table public.user_direcciones enable row level security;
drop policy if exists user_direcciones_ver on public.user_direcciones;
create policy user_direcciones_ver on public.user_direcciones for select to authenticated using (user_id = auth.uid());
drop policy if exists user_direcciones_poner on public.user_direcciones;
create policy user_direcciones_poner on public.user_direcciones for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_direcciones_cambiar on public.user_direcciones;
create policy user_direcciones_cambiar on public.user_direcciones for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_direcciones_borrar on public.user_direcciones;
create policy user_direcciones_borrar on public.user_direcciones for delete to authenticated using (user_id = auth.uid());
revoke all on public.user_direcciones from anon;
grant select, insert, update, delete on public.user_direcciones to authenticated;

create table if not exists public.trade_offer_direcciones (
  oferta uuid not null references public.trade_offers (id) on delete cascade,
  quien uuid not null references auth.users (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  calle text not null check (char_length(btrim(calle)) between 3 and 200),
  cp text not null check (char_length(btrim(cp)) between 3 and 12),
  ciudad text not null check (char_length(btrim(ciudad)) between 2 and 80),
  provincia text check (provincia is null or char_length(provincia) <= 80),
  telefono text check (telefono is null or char_length(telefono) <= 30),
  created_at timestamptz not null default now(),
  primary key (oferta, quien)
);

-- Sin políticas a propósito: nadie la lee ni la escribe directamente.
alter table public.trade_offer_direcciones enable row level security;
revoke all on public.trade_offer_direcciones from anon, authenticated;

create or replace function public.cambio_direccion_poner(p_oferta uuid, p_dir jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  v_otro uuid;
  v_nombre text := btrim(coalesce(p_dir ->> 'nombre', ''));
  v_calle text := btrim(coalesce(p_dir ->> 'calle', ''));
  v_cp text := btrim(coalesce(p_dir ->> 'cp', ''));
  v_ciudad text := btrim(coalesce(p_dir ->> 'ciudad', ''));
  v_provincia text := nullif(btrim(coalesce(p_dir ->> 'provincia', '')), '');
  v_telefono text := nullif(btrim(coalesce(p_dir ->> 'telefono', '')), '');
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado not in ('enviada', 'aceptada') then raise exception 'Ese trato ya no está en marcha.'; end if;
  if o.envio is distinct from 'correo' or o.envio_tipo = 'mano' then raise exception 'Ese trato no va por correo.'; end if;
  if not exists (select 1 from public.trade_offer_items i where i.oferta = o.id and i.quien <> yo) then
    raise exception 'En ese trato no te mandan cartas: no hace falta tu dirección.';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_calle) < 3 or char_length(v_cp) < 3 or char_length(v_ciudad) < 2 then
    raise exception 'Falta algo de la dirección: nombre, calle, código postal y ciudad.';
  end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  insert into public.trade_offer_direcciones (oferta, quien, nombre, calle, cp, ciudad, provincia, telefono)
  values (o.id, yo, v_nombre, v_calle, v_cp, v_ciudad, v_provincia, v_telefono)
  on conflict (oferta, quien) do update
    set nombre = excluded.nombre, calle = excluded.calle, cp = excluded.cp, ciudad = excluded.ciudad,
        provincia = excluded.provincia, telefono = excluded.telefono, created_at = now();
  -- Con el trato aceptado, el otro ya puede mandarlo: se le dice.
  if o.estado = 'aceptada' then
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_direccion', 'Ya tienes su dirección', 'Ya tienes mi dirección para el envío.');
  end if;
end
$$;

-- Las direcciones de tus tratos: la tuya siempre; la del otro, con el trato
-- aceptado o hecho.
create or replace function public.cambio_direcciones(p_ofertas uuid[])
returns table (oferta uuid, quien uuid, nombre text, calle text, cp text, ciudad text, provincia text, telefono text)
language sql
stable
security definer
set search_path = public
as $$
  select d.oferta, d.quien, d.nombre, d.calle, d.cp, d.ciudad, d.provincia, d.telefono
  from public.trade_offer_direcciones d
  join public.trade_offers o on o.id = d.oferta
  where d.oferta = any (p_ofertas)
    and auth.uid() in (o.de, o.para)
    and (d.quien = auth.uid() or o.estado in ('aceptada', 'hecha'))
$$;

revoke all on function public.cambio_direccion_poner(uuid, jsonb) from public, anon;
revoke all on function public.cambio_direcciones(uuid[]) from public, anon;
grant execute on function public.cambio_direccion_poner(uuid, jsonb) to authenticated;
grant execute on function public.cambio_direcciones(uuid[]) to authenticated;

commit;

notify pgrst, 'reload schema';
