-- ============================================================
-- Tanda 1251 — «PEDIR FOTOS» de una copia de una tienda
-- ============================================================
-- PINGU: «un botón… para pedir fotos… que a la tienda le salga “el cliente
-- quiere fotos”, y lo mismo que tú tienes en el stock para añadir cartas desde
-- el frontal y de la trasera». Quien mira una carta del escaparate sin fotos
-- de verdad (1235) las pide; a la tienda le llega en su pestaña Ofertas y en
-- la conversación; al subirlas (por el camino que sea: la hoja de fotos
-- escribe `tienda_stock_fotos` desde el navegador), un DISPARADOR avisa a
-- quien las pidió, con un mensaje y su aviso.
--
--   1. `tienda_fotos_pedidas`: quién las pide de qué copia, y cuándo se
--      atendieron. Una pendiente por persona y copia. La ven sus dos.
--   2. `tienda_pedir_fotos(stock)`: pedirlas (o decir que ya las tiene).
--   3. `tienda_fotos_pedidas_lista()`: las pendientes de la tienda, con la
--      carta y quien las pide.
--   4. `tienda_fotos_quitar(id)`: la tienda la da por vista sin subir nada.
--   5. `tienda_fotos_subidas()` (disparador): al poner fotos a una copia, las
--      peticiones pendientes de esa copia se atienden y se avisa.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1068, la 1235 (`tienda_stock_fotos`), la 942
-- (`cambio_conversacion`), la 891 (`adjuntos`) y la 1245 (`tienda_publica`).
-- ============================================================

begin;

create table if not exists public.tienda_fotos_pedidas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references auth.users (id) on delete cascade,
  comprador_id uuid not null references auth.users (id) on delete cascade,
  stock_id uuid not null references public.tienda_stock (id) on delete cascade,
  created_at timestamptz not null default now(),
  atendida_at timestamptz,
  -- 'subidas' (puso las fotos) o 'quitada' (la dio por vista sin subirlas).
  como text,
  constraint tienda_fotos_pedidas_como check (como is null or como in ('subidas', 'quitada'))
);
create unique index if not exists tienda_fotos_pedidas_una on public.tienda_fotos_pedidas (comprador_id, stock_id) where atendida_at is null;
create index if not exists tienda_fotos_pedidas_tienda on public.tienda_fotos_pedidas (tienda_id) where atendida_at is null;

alter table public.tienda_fotos_pedidas enable row level security;
drop policy if exists tienda_fotos_pedidas_suyas on public.tienda_fotos_pedidas;
create policy tienda_fotos_pedidas_suyas on public.tienda_fotos_pedidas for select to authenticated
  using (tienda_id = auth.uid() or comprador_id = auth.uid());
grant select on public.tienda_fotos_pedidas to authenticated;

-- El mensaje en la conversación y el aviso, con el adjunto de la copia.
create or replace function public.tienda_fotos_avisar(p_stock uuid, p_de uuid, p_para uuid, p_evento text, p_titulo text, p_texto text, p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid := public.cambio_conversacion(p_de, p_para);
begin
  insert into private_messages (conversation_id, sender_id, body, adjuntos)
  values (v_conv, p_de, p_texto, jsonb_build_array(jsonb_build_object('tipo', 'fotos_tienda', 'stock_id', p_stock, 'evento', p_evento)));
  insert into user_notifications (recipient_id, type, title, body, link)
  values (p_para, 'tienda_fotos', p_titulo, p_texto, coalesce(p_link, '/mensajes.html?c=' || v_conv));
end;
$$;

create or replace function public.tienda_pedir_fotos(p_stock uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_s tienda_stock%rowtype;
  v_f tienda_stock_fotos%rowtype;
  v_id uuid;
  v_nombre text;
begin
  if v_uid is null then
    raise exception 'Entra con tu cuenta para pedir fotos.' using errcode = '42501';
  end if;
  select * into v_s from tienda_stock where id = p_stock;
  if not found or not v_s.visible or v_s.unidades < 1 or v_s.tienda_id = v_uid or not public.tienda_publica(v_s.tienda_id) then
    raise exception 'Esa carta ya no está en la tienda.' using errcode = 'P0002';
  end if;
  select * into v_f from tienda_stock_fotos where stock_id = p_stock;
  if v_f.frente is not null and v_f.dorso is not null then
    return jsonb_build_object('ya_tiene', true);
  end if;
  select id into v_id from tienda_fotos_pedidas where comprador_id = v_uid and stock_id = p_stock and atendida_at is null;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'ya_pedidas', true);
  end if;
  insert into tienda_fotos_pedidas (tienda_id, comprador_id, stock_id) values (v_s.tienda_id, v_uid, v_s.id) returning id into v_id;
  select coalesce(c.name_es, c.name, p.name, 'una carta') into v_nombre
  from tienda_stock s left join tcg_cards c on c.id = s.card_id left join tcg_products p on p.id = s.product_id where s.id = v_s.id;
  perform public.tienda_fotos_avisar(v_s.id, v_uid, v_s.tienda_id, 'fotos_pedidas', 'Te piden fotos',
    '¿Me enseñas fotos de ' || v_nombre || ' (' || upper(v_s.idioma) || ' · ' || coalesce(v_s.gradeo, v_s.estado) || ')? Por delante y por detrás.',
    '/tienda?ver=ofertas#fotos-' || v_id);
  return jsonb_build_object('id', v_id);
end;
$$;

create or replace function public.tienda_fotos_pedidas_lista()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(x.f order by x.k desc) from (
    select jsonb_build_object(
      'id', f.id, 'stock_id', f.stock_id, 'created_at', f.created_at,
      'comprador', (select jsonb_build_object('id', p.id, 'username', p.username, 'nombre', coalesce(p.display_name, p.username)) from user_profiles p where p.id = f.comprador_id),
      'card_id', s.card_id, 'market', s.market, 'product_id', s.product_id, 'idioma', s.idioma, 'estado', s.estado, 'variante', s.variante, 'gradeo', s.gradeo,
      'precio', public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta),
      'nombre', coalesce(c.name_es, c.name, pr.name)
    ) f, extract(epoch from f.created_at) k
    from tienda_fotos_pedidas f
    join tienda_stock s on s.id = f.stock_id
    left join tcg_cards c on c.id = s.card_id
    left join tcg_products pr on pr.id = s.product_id
    where f.tienda_id = v_uid and f.atendida_at is null
    order by f.created_at desc
    limit 200
  ) x), '[]'::jsonb);
end;
$$;

create or replace function public.tienda_fotos_quitar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update tienda_fotos_pedidas set atendida_at = now(), como = 'quitada'
  where id = p_id and tienda_id = auth.uid() and atendida_at is null;
  if not found then
    raise exception 'Esa petición ya no está.' using errcode = 'P0002';
  end if;
end;
$$;

-- Al poner fotos a una copia (las dos, o la que haya si solo hay una), se
-- atiende lo pedido de esa copia y se avisa a cada uno.
create or replace function public.tienda_fotos_subidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p record;
  v_s tienda_stock%rowtype;
begin
  if new.frente is null and new.dorso is null then
    return new;
  end if;
  select * into v_s from tienda_stock where id = new.stock_id;
  for v_p in select * from tienda_fotos_pedidas where stock_id = new.stock_id and atendida_at is null for update loop
    update tienda_fotos_pedidas set atendida_at = now(), como = 'subidas' where id = v_p.id;
    perform public.tienda_fotos_avisar(new.stock_id, v_p.tienda_id, v_p.comprador_id, 'fotos_subidas', 'Ya tienes las fotos',
      'Ya están las fotos que me pediste.', null);
  end loop;
  return new;
end;
$$;
drop trigger if exists trg_tienda_fotos_subidas on public.tienda_stock_fotos;
create trigger trg_tienda_fotos_subidas after insert or update of frente, dorso on public.tienda_stock_fotos
  for each row execute function public.tienda_fotos_subidas();

revoke all on function public.tienda_fotos_avisar(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.tienda_fotos_subidas() from public, anon, authenticated;
revoke all on function public.tienda_pedir_fotos(uuid) from public, anon;
revoke all on function public.tienda_fotos_pedidas_lista() from public, anon;
revoke all on function public.tienda_fotos_quitar(uuid) from public, anon;
grant execute on function public.tienda_pedir_fotos(uuid) to authenticated;
grant execute on function public.tienda_fotos_pedidas_lista() to authenticated;
grant execute on function public.tienda_fotos_quitar(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
