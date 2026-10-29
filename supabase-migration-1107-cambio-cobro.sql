-- Tanda 1107: el Bizum o el PayPal de quien cobra, en el trato (PINGU: «si
-- elijo Bizum, que me pague por Bizum, que yo también tenga el número
-- metido, y si es PayPal, el email o el arroba de PayPal»).
--
-- Igual que la dirección (1102): pone su dato quien RECIBE el dinero de un
-- trato que se paga por Bizum o PayPal, y quien paga lo ve en el trato para
-- copiarlo. En mano u «otro», nada.
--
--   1. `user_cobros`: tu Bizum (teléfono) y tu PayPal (email o usuario),
--      guardados en Ajustes. Solo los lees y escribes tú (RLS).
--   2. `trade_offer_cobros`: el de cada trato (oferta, quien, como, dato).
--      Sin políticas: se escribe con `cambio_cobro_poner` y se lee con
--      `cambio_cobros`, que da el tuyo siempre y el del otro con el trato
--      aceptado o hecho (y no de uno cerrado hace más de 30 días).
--   3. `cambio_cobro_poner(oferta, dato)`: quien cobra, con la propuesta
--      enviada o aceptada; ya aceptada, avisa a quien paga.
--   4. `cambio_direcciones_purgar` (1103) borra también estos datos a los 30
--      días de cerrarse el trato: la llama `cambio_avisar` en cada paso.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 942, la 1101 y la 1103.
begin;

create table if not exists public.user_cobros (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  bizum text check (bizum is null or bizum ~ '^\+?[0-9 ]{9,20}$'),
  paypal text check (paypal is null or char_length(paypal) between 3 and 120),
  updated_at timestamptz not null default now()
);

alter table public.user_cobros enable row level security;
drop policy if exists user_cobros_ver on public.user_cobros;
create policy user_cobros_ver on public.user_cobros for select to authenticated using (user_id = auth.uid());
drop policy if exists user_cobros_poner on public.user_cobros;
create policy user_cobros_poner on public.user_cobros for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_cobros_cambiar on public.user_cobros;
create policy user_cobros_cambiar on public.user_cobros for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_cobros_borrar on public.user_cobros;
create policy user_cobros_borrar on public.user_cobros for delete to authenticated using (user_id = auth.uid());
revoke all on public.user_cobros from anon;
grant select, insert, update, delete on public.user_cobros to authenticated;

create table if not exists public.trade_offer_cobros (
  oferta uuid not null references public.trade_offers (id) on delete cascade,
  quien uuid not null references auth.users (id) on delete cascade,
  como text not null check (como in ('bizum', 'paypal')),
  dato text not null check (char_length(dato) between 3 and 120),
  created_at timestamptz not null default now(),
  primary key (oferta, quien)
);

-- Sin políticas a propósito: nadie la lee ni la escribe directamente.
alter table public.trade_offer_cobros enable row level security;
revoke all on public.trade_offer_cobros from anon, authenticated;

-- Quién cobra en un trato: el lado que NO paga el dinero apuntado.
create or replace function public.cambio_quien_cobra(p_oferta uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when coalesce(o.dinero, 0) > 0 and o.dinero_paga = 'de' then o.para
              when coalesce(o.dinero, 0) > 0 and o.dinero_paga = 'para' then o.de end
  from public.trade_offers o
  where o.id = p_oferta
$$;

create or replace function public.cambio_cobro_poner(p_oferta uuid, p_dato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  v_otro uuid;
  v_dato text := btrim(coalesce(p_dato, ''));
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado not in ('enviada', 'aceptada') then raise exception 'Ese trato ya no está en marcha.'; end if;
  if coalesce(o.dinero_como, '') not in ('bizum', 'paypal') then raise exception 'Ese trato no se paga por Bizum ni por PayPal.'; end if;
  if public.cambio_quien_cobra(o.id) is distinct from yo then raise exception 'En ese trato no cobras tú.'; end if;
  if o.dinero_como = 'bizum' then
    v_dato := regexp_replace(v_dato, '[^0-9+]', '', 'g');
    if v_dato !~ '^\+?[0-9]{9,15}$' then raise exception 'Ese no parece un número de teléfono para Bizum.'; end if;
  elsif char_length(v_dato) < 3 or char_length(v_dato) > 120 or v_dato !~ '^(@?[A-Za-z0-9._-]+|[^@ ]+@[^@ ]+\.[^@ ]+|(https?://)?(www\.)?paypal\.me/[A-Za-z0-9._-]+)$' then
    raise exception 'Pon el email o el usuario de PayPal.';
  end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  insert into public.trade_offer_cobros (oferta, quien, como, dato)
  values (o.id, yo, o.dinero_como, v_dato)
  on conflict (oferta, quien) do update set como = excluded.como, dato = excluded.dato, created_at = now();
  if o.estado = 'aceptada' then
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_cobro', 'Ya tienes cómo pagarle',
      case o.dinero_como when 'bizum' then 'Ya tienes mi Bizum para pagarme.' else 'Ya tienes mi PayPal para pagarme.' end);
  end if;
end
$$;

create or replace function public.cambio_cobros(p_ofertas uuid[])
returns table (oferta uuid, quien uuid, como text, dato text)
language sql
stable
security definer
set search_path = public
as $$
  select c.oferta, c.quien, c.como, c.dato
  from public.trade_offer_cobros c
  join public.trade_offers o on o.id = c.oferta
  where c.oferta = any (p_ofertas)
    and auth.uid() in (o.de, o.para)
    and (c.quien = auth.uid() or o.estado in ('aceptada', 'hecha'))
    and not (o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada') and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days')
$$;

-- La de la 1103, que ahora borra también los datos de pago.
create or replace function public.cambio_direcciones_purgar()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.trade_offer_direcciones d
  using public.trade_offers o
  where o.id = d.oferta
    and o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada')
    and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days';
  delete from public.trade_offer_cobros c
  using public.trade_offers o
  where o.id = c.oferta
    and o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada')
    and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days';
$$;

revoke all on function public.cambio_quien_cobra(uuid) from public, anon, authenticated;
revoke all on function public.cambio_direcciones_purgar() from public, anon, authenticated;
revoke all on function public.cambio_cobro_poner(uuid, text) from public, anon;
revoke all on function public.cambio_cobros(uuid[]) from public, anon;
grant execute on function public.cambio_cobro_poner(uuid, text) to authenticated;
grant execute on function public.cambio_cobros(uuid[]) to authenticated;

commit;

notify pgrst, 'reload schema';
