-- Confianza en los cambios (tanda 795, NU4).
--
-- El Mercado junta a quien da con quien busca; lo que frena un cambio con un
-- desconocido es fiarse. Cuando dos personas que han HABLADO (tienen una
-- conversación de Mensajes en común) marcan las dos «Cambio hecho», queda
-- apuntado, y cada una puede dejar un «todo bien» o un «hubo un problema».
-- En el perfil y en el Mercado: «12 cambios · todos bien». Sin estrellas ni
-- reseñas largas, que se llenan de rencillas; los problemas (y su nota) solo
-- los ve la moderación.
--
-- Nadie escribe en la tabla directamente: todo pasa por tres funciones, y la
-- RLS deja leer a cada uno SUS filas (y a la moderación, todas).
-- Se puede ejecutar más de una vez.
begin;

create table if not exists public.trade_confirmations (
  id uuid primary key default gen_random_uuid(),
  -- La pareja siempre en el mismo orden (a < b): una sola fila por cambio.
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  hecho_a_at timestamptz,
  hecho_b_at timestamptz,
  valoracion_a text check (valoracion_a in ('bien', 'problema')),
  valoracion_b text check (valoracion_b in ('bien', 'problema')),
  nota_a text check (char_length(nota_a) <= 500),
  nota_b text check (char_length(nota_b) <= 500),
  created_at timestamptz not null default now(),
  check (user_a < user_b)
);

create index if not exists trade_confirmations_a_idx on public.trade_confirmations (user_a, created_at desc);
create index if not exists trade_confirmations_b_idx on public.trade_confirmations (user_b, created_at desc);

alter table public.trade_confirmations enable row level security;

drop policy if exists trade_confirmations_ver on public.trade_confirmations;
create policy trade_confirmations_ver on public.trade_confirmations
  for select to authenticated
  using (
    auth.uid() in (user_a, user_b)
    or coalesce((select is_admin or is_moderator from public.user_profiles where id = auth.uid()), false)
  );

-- Marcar «Cambio hecho» con otra persona. Si hay uno a medias (lo marcó la
-- otra y tú no), se completa; si no, se abre uno nuevo. Solo entre dos que
-- tienen una conversación en común.
create or replace function public.cambio_marcar(p_otro uuid)
returns public.trade_confirmations
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  a uuid;
  b uuid;
  fila public.trade_confirmations;
begin
  if yo is null then raise exception 'Hace falta entrar con tu cuenta.'; end if;
  if p_otro is null or p_otro = yo then raise exception 'Un cambio es entre dos personas.'; end if;
  if not exists (
    select 1 from public.conversation_participants c1
    join public.conversation_participants c2 on c2.conversation_id = c1.conversation_id
    where c1.user_id = yo and c2.user_id = p_otro
  ) then
    raise exception 'Solo se puede marcar un cambio con alguien con quien has hablado por Mensajes.';
  end if;
  a := least(yo, p_otro);
  b := greatest(yo, p_otro);
  select * into fila from public.trade_confirmations
  where user_a = a and user_b = b
    and (case when yo = a then hecho_a_at else hecho_b_at end) is null
    and (hecho_a_at is null or hecho_b_at is null)
  order by created_at desc limit 1;
  if fila.id is null then
    insert into public.trade_confirmations (user_a, user_b) values (a, b) returning * into fila;
  end if;
  if yo = a then
    update public.trade_confirmations set hecho_a_at = now() where id = fila.id returning * into fila;
  else
    update public.trade_confirmations set hecho_b_at = now() where id = fila.id returning * into fila;
  end if;
  return fila;
end
$$;

-- «Todo bien» o «hubo un problema», sobre un cambio que las dos personas han
-- marcado. La nota solo la lee la moderación.
create or replace function public.cambio_valorar(p_id uuid, p_valor text, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  fila public.trade_confirmations;
begin
  if p_valor not in ('bien', 'problema') then raise exception 'La valoración es «bien» o «problema».'; end if;
  select * into fila from public.trade_confirmations where id = p_id;
  if fila.id is null or yo not in (fila.user_a, fila.user_b) then raise exception 'Ese cambio no es tuyo.'; end if;
  if fila.hecho_a_at is null or fila.hecho_b_at is null then raise exception 'Primero tenéis que marcarlo los dos como hecho.'; end if;
  if yo = fila.user_a then
    update public.trade_confirmations set valoracion_a = p_valor, nota_a = left(p_nota, 500) where id = p_id;
  else
    update public.trade_confirmations set valoracion_b = p_valor, nota_b = left(p_nota, 500) where id = p_id;
  end if;
end
$$;

-- Lo que se enseña de una persona: cuántos cambios ha cerrado y cuántas de
-- las otras personas dijeron «todo bien». Los problemas NO salen aquí: los ve
-- la moderación en la tabla. Sin notas ni nombres: lo lee cualquiera.
drop function if exists public.cambios_de(uuid);
create or replace function public.cambios_de(p_user uuid)
returns table (hechos bigint, bien bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*) filter (where hecho_a_at is not null and hecho_b_at is not null),
    count(*) filter (where (user_a = p_user and valoracion_b = 'bien') or (user_b = p_user and valoracion_a = 'bien'))
  from public.trade_confirmations
  where p_user in (user_a, user_b)
$$;

grant execute on function public.cambio_marcar(uuid) to authenticated;
grant execute on function public.cambio_valorar(uuid, text, text) to authenticated;
grant execute on function public.cambios_de(uuid) to anon, authenticated;

commit;
