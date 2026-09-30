-- ─────────────────────────────────────────────────────────────────────
-- INTERCAMBIOS (tanda 376): lo que doy, lo que busco, y quién encaja.
--
-- Es la pieza grande que le faltaba a «Mi colección», y es donde le
-- ganamos a HoloNook: su propio tutorial dice «HoloNook no tiene chat:
-- los cambios se hablan por fuera» y te manda a X o a Instagram.
-- PokeDoc tiene foro y mensajes propios, así que aquí el cambio se
-- cierra DENTRO.
--
-- ── DOS LISTAS Y NINGUNA TABLA NUEVA PARA LO QUE DOY ──
--
-- Lo que DOY no es una lista aparte: es una columna en la línea que ya
-- tienes (`user_collection.cambio` = de estas copias, doy tantas). Una
-- tabla nueva sería el mismo dato escrito dos veces, y el día que
-- vendieras la carta se quedaría una de las dos sin enterarse.
--
-- Lo que BUSCO sí es tabla (`user_wants`), porque es justo lo que NO
-- tienes: no hay ninguna fila donde colgarlo.
--
-- ── QUÉ SE VE DE QUIÉN ──
--
-- Marcar `cambio > 0` es DECIR EN VOZ ALTA «doy esta carta», y apuntar
-- algo en `user_wants` es «busco esta». Las dos cosas son públicas por
-- definición: un tablón de cambios donde no se vea quién tiene qué no
-- sirve para nada. Lo que NO se abre es el resto de la colección — ni
-- para quien tiene la colección pública.
--
-- Por eso las políticas de `user_collection` NO se tocan y el tablón
-- sale de DOS FUNCIONES `security definer` que devuelven solo las
-- columnas que se pueden enseñar: la carta, el idioma, el estado, la
-- versión y cuántas das. Ni `precio_compra`, ni `valor_manual`, ni
-- `notas`. Lo que pagaste por una carta no es asunto de nadie, y una
-- política sobre la tabla entera lo habría soltado sin que se note.
--
-- ── LA DOBLE COINCIDENCIA ──
--
-- Un cambio de verdad es RECÍPROCO: yo tengo lo tuyo y tú tienes lo
-- mío. Las funciones lo marcan (`reciproco`) y el tablón las pone
-- primero, porque son las únicas que se cierran de un mensaje.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

-- ── Lo que doy: una columna en la línea que ya existe ──
alter table public.user_collection add column if not exists cambio int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_collection_cambio') then
    alter table public.user_collection
      add constraint user_collection_cambio check (cambio between 0 and 999);
  end if;
end;
$$;

-- El índice va sobre las que SE DAN y nada más: son un puñado frente a
-- la tabla entera, y es la única consulta que cruza dueños.
create index if not exists user_collection_cambio_idx
  on public.user_collection (card_id) where cambio > 0;

-- ── Lo que busco ──
create table if not exists public.user_wants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null,
  -- El idioma que buscas, o null = «me da igual». Son cosas distintas:
  -- quien colecciona en español no quiere la inglesa, y quien está
  -- completando el álbum se conforma con cualquiera. Un valor por
  -- defecto de 'es' habría decidido por la mitad de la gente.
  idioma text,
  -- 1 la busco, 2 la busco mucho, 3 es LA que me falta. Ordena el
  -- tablón: de una lista de 200 deseos, los tres de arriba son los que
  -- de verdad cierran un cambio.
  prioridad int not null default 1,
  notas text,
  created_at timestamptz not null default now(),

  constraint user_wants_idioma check (idioma is null or idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja')),
  constraint user_wants_prioridad check (prioridad between 1 and 3),
  constraint user_wants_notas check (notas is null or char_length(notas) <= 280)
);

-- La misma carta dos veces en la misma lista no es nada: es la misma
-- carta. El índice único lo impide en la base y no en el navegador,
-- que es donde tiene que estar.
--
-- `coalesce(idioma, '*')` porque en un índice único los NULL NO CHOCAN
-- entre sí: sin él, «cualquier idioma» se podría apuntar cien veces.
create unique index if not exists user_wants_unico
  on public.user_wants (user_id, card_id, coalesce(idioma, '*'));
create index if not exists user_wants_carta_idx on public.user_wants (card_id);

-- Un tope, como en la colección: la API está abierta a cualquiera con
-- cuenta. 2.000 deseos es una lista enorme.
create or replace function public.user_wants_tope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.user_wants where user_id = new.user_id) >= 2000 then
    raise exception 'Has llegado al máximo de 2.000 cartas en tu lista de búsqueda.';
  end if;
  return new;
end;
$$;

drop trigger if exists user_wants_tope on public.user_wants;
create trigger user_wants_tope
  before insert on public.user_wants
  for each row execute function public.user_wants_tope();

alter table public.user_wants enable row level security;

-- Apuntar una carta en tu lista de búsqueda es decir en voz alta que la
-- buscas: se lee sin cuenta, como el resto del escaparate.
drop policy if exists user_wants_ver on public.user_wants;
create policy user_wants_ver on public.user_wants for select using (true);

drop policy if exists user_wants_crear on public.user_wants;
create policy user_wants_crear on public.user_wants
  for insert with check (auth.uid() = user_id and not public.is_banned());

drop policy if exists user_wants_editar on public.user_wants;
create policy user_wants_editar on public.user_wants
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_wants_borrar on public.user_wants;
create policy user_wants_borrar on public.user_wants
  for delete using (auth.uid() = user_id);

grant select on public.user_wants to anon;
grant select, insert, update, delete on public.user_wants to authenticated;

-- ── El tablón ──
--
-- Las dos funciones devuelven lo MISMO para las dos direcciones del
-- cambio, así que se lee igual una lista que la otra.

-- Quién tiene, para dar, alguna de las cartas que yo busco.
create or replace function public.intercambios_quien_tiene(p_limite int default 200)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  card_id text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int,
  prioridad int,
  reciproco boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (select auth.uid() as id),
  -- Lo que yo doy, para saber si la otra persona busca algo mío.
  mias as (
    select c.card_id, c.idioma
    from public.user_collection c, yo
    where c.user_id = yo.id and c.cambio > 0
  )
  select
    c.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    c.card_id,
    c.idioma,
    c.estado,
    c.variante,
    c.gradeo,
    c.cambio,
    w.prioridad,
    exists (
      select 1
      from public.user_wants w2
      join mias m on m.card_id = w2.card_id and (w2.idioma is null or w2.idioma = m.idioma)
      where w2.user_id = c.user_id
    ) as reciproco
  from public.user_wants w
  join yo on w.user_id = yo.id
  join public.user_collection c
    on c.card_id = w.card_id
   and c.cambio > 0
   and c.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
  join public.user_profiles p on p.id = c.user_id
  where not coalesce(p.is_banned, false)
  -- Lo recíproco primero: es lo único que se cierra de un mensaje.
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

-- Y al revés: quién busca alguna de las cartas que yo doy.
create or replace function public.intercambios_quien_busca(p_limite int default 200)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  card_id text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int,
  prioridad int,
  reciproco boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (select auth.uid() as id),
  -- Lo que yo busco, para saber si la otra persona da algo que quiero.
  busco as (select w.card_id, w.idioma from public.user_wants w, yo where w.user_id = yo.id)
  select
    w.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    c.card_id,
    c.idioma,
    c.estado,
    c.variante,
    c.gradeo,
    c.cambio,
    w.prioridad,
    exists (
      select 1
      from public.user_collection c2
      join busco b on b.card_id = c2.card_id and (b.idioma is null or b.idioma = c2.idioma)
      where c2.user_id = w.user_id and c2.cambio > 0
    ) as reciproco
  from public.user_collection c
  join yo on c.user_id = yo.id
  join public.user_wants w
    on w.card_id = c.card_id
   and w.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
  join public.user_profiles p on p.id = w.user_id
  where c.cambio > 0 and not coalesce(p.is_banned, false)
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

-- Y el escaparate de una carta suelta: quién da ESTA. Va sin sesión a
-- propósito — es lo que se enseña en la ficha de una carta, que se ve
-- sin cuenta, igual que los torneos (tanda 252).
create or replace function public.intercambios_de_carta(p_card_id text, p_limite int default 20)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  idioma text,
  estado text,
  variante text,
  gradeo text,
  cambio int
)
language sql
stable
security definer
set search_path = public
as $$
  select c.user_id, p.username, p.display_name, p.avatar_url,
         c.idioma, c.estado, c.variante, c.gradeo, c.cambio
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.card_id = p_card_id
    and c.cambio > 0
    and not coalesce(p.is_banned, false)
    and c.user_id is distinct from auth.uid()
  order by c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 20), 100));
$$;

-- ── El aviso: alguien ha empezado a dar una carta que buscas ──
--
-- Es lo que hace volver. Sin esto, el tablón solo funciona si te
-- acuerdas de entrar a mirarlo, y nadie se acuerda.
--
-- Va en un DISPARADOR y no en el cliente por dos razones. Una: quien
-- marca «doy dos» no puede escribir en `user_notifications` de otra
-- persona sin que la política se lo permita, y abrirla sería peor. Dos:
-- si el aviso lo manda el navegador, se pierde en cuanto alguien cierra
-- la pestaña antes de tiempo — y este aviso es el producto.
--
-- TRES CUIDADOS, y los tres son sobre no molestar:
--
--   · Solo cuando `cambio` PASA de 0 a algo. Subir de 2 a 3 copias no es
--     una noticia, y avisar de cada ajuste convierte la campanita en
--     ruido que la gente aprende a ignorar.
--   · Un tope de destinatarios. Una carta que buscan 500 personas
--     metería 500 filas en una sola pulsación del botón «Guardar», y esa
--     pulsación se quedaría colgada.
--   · Y no se repite: si a alguien ya le avisamos de ESTA carta y no lo
--     ha leído, no se le avisa otra vez porque un tercero la dé también.
create or replace function public.intercambios_avisar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  -- De 0 a algo, y nada más. En un INSERT `old` es null, así que el
  -- coalesce cubre los dos casos con una sola condición.
  if coalesce(new.cambio, 0) <= 0 or coalesce(old.cambio, 0) > 0 then
    return new;
  end if;

  -- El nombre de la carta se saca del espejo. Si no está (una carta que
  -- todavía no se ha importado), el aviso se manda igual sin nombre: el
  -- enlace lleva a la carta y ahí se ve.
  select coalesce(name_es, name) into v_nombre from public.tcg_cards where id = new.card_id;

  -- El `distinct on (w.user_id)` NO es adorno, y costó verlo: una misma
  -- persona puede tener la MISMA carta apuntada dos veces —una «en
  -- español» y otra «me da igual», que el índice único deja convivir
  -- porque son deseos distintos—, y las dos casan con la misma carta.
  -- Sin el distinct se le metían DOS avisos idénticos de un solo clic, y
  -- la guarda de «ya tiene uno sin leer» no lo evita: no ve las filas
  -- que está insertando esta misma sentencia.
  insert into public.user_notifications (recipient_id, type, title, body, link)
  select d.user_id,
         'trade_match',
         'Alguien da una carta que buscas',
         d.nombre,
         '/mi-coleccion?ver=cambios'
    from (
      select distinct on (w.user_id)
             w.user_id,
             w.prioridad,
             w.created_at,
             coalesce(v_nombre, new.card_id) as nombre
        from public.user_wants w
        join public.user_profiles u on u.id = w.user_id
       where w.card_id = new.card_id
         and w.user_id <> new.user_id
         and (w.idioma is null or w.idioma = new.idioma)
         and coalesce(u.is_banned, false) = false
         and not (coalesce(u.notification_prefs_disabled, '{}') @> array['trade_match'])
         -- Sin repetir: si ya tiene uno de esta carta sin leer, basta.
         and not exists (
           select 1 from public.user_notifications n
            where n.recipient_id = w.user_id
              and n.type = 'trade_match'
              and n.read_at is null
              and n.body = coalesce(v_nombre, new.card_id)
         )
       -- El `distinct on` se queda con la PRIMERA de cada persona según
       -- este orden, así que el deseo que manda es el de más prioridad.
       order by w.user_id, w.prioridad desc, w.created_at
    ) d
   -- Y los que más la buscan primero, porque el tope corta por abajo.
   order by d.prioridad desc, d.created_at
   limit 25;

  return new;
end;
$$;

drop trigger if exists intercambios_avisar on public.user_collection;
create trigger intercambios_avisar
  after insert or update of cambio on public.user_collection
  for each row execute function public.intercambios_avisar();

grant execute on function public.intercambios_quien_tiene(int) to authenticated;
grant execute on function public.intercambios_quien_busca(int) to authenticated;
grant execute on function public.intercambios_de_carta(text, int) to anon, authenticated;

commit;

-- Comprobación: la tabla con sus cuatro políticas y las tres funciones.
select policyname, cmd from pg_policies where tablename = 'user_wants' order by policyname;
select proname from pg_proc where proname like 'intercambios%' order by proname;

notify pgrst, 'reload schema';
