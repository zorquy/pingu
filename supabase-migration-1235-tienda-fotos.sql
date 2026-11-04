-- ============================================================
-- Tanda 1235: fotos de verdad de las cartas del stock (frontal y trasera).
--
-- PINGU: «agregar imágenes a cada carta, solo a cartas no a productos. Que te
-- deje meter imagen frontal y trasera, para ver. Es algo opcional». Una tienda
-- vende ESA copia, no la carta del catálogo: el centrado, el canto, el dorso o
-- la cápsula se ven solo en su foto.
--
--   1. `tienda_stock_fotos`: una fila por línea del stock, con la ruta de la
--      foto de delante (`frente`) y la de detrás (`dorso`). Aparte de
--      `tienda_stock` a propósito: así `tienda_escaparate`, `tienda_vender` y
--      las demás no se redefinen, y lo que no la necesita no la pide.
--      Solo cartas: una línea de producto sellado no tiene fotos.
--   2. El cubo `tienda-fotos`, PÚBLICO (lo ve quien mira el escaparate, con o
--      sin cuenta, como los avatares): una carpeta por tienda y solo esa
--      tienda sube y borra en la suya.
--
-- Se puede ejecutar más de una vez. Cada sentencia va por su lado (631).
-- ============================================================

-- ── 1. La tabla ──
create table if not exists public.tienda_stock_fotos (
  stock_id uuid primary key references public.tienda_stock(id) on delete cascade,
  tienda_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  frente text,
  dorso text,
  updated_at timestamptz not null default now(),
  -- La ruta va DENTRO de la carpeta de la tienda: una fila no puede apuntar a
  -- la foto de otra.
  constraint tienda_stock_fotos_frente_suya check (frente is null or (char_length(frente) <= 300 and frente like tienda_id::text || '/%')),
  constraint tienda_stock_fotos_dorso_suya check (dorso is null or (char_length(dorso) <= 300 and dorso like tienda_id::text || '/%'))
);

create index if not exists tienda_stock_fotos_tienda on public.tienda_stock_fotos (tienda_id);

alter table public.tienda_stock_fotos enable row level security;

-- Se ven las fotos de una línea que se ve en el escaparate (visible y con
-- unidades), y las tuyas siempre. Security definer porque `tienda_stock` solo
-- deja ver a su dueña; lo llama anon también, así que se le da a los dos (555).
create or replace function public.tienda_foto_se_ve(p_stock uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from tienda_stock s
    where s.id = p_stock and (s.tienda_id = auth.uid() or (s.visible and s.unidades > 0))
  );
$$;
revoke all on function public.tienda_foto_se_ve(uuid) from public;
grant execute on function public.tienda_foto_se_ve(uuid) to anon, authenticated;

-- Se escribe solo la de una línea TUYA que sea una carta (no un producto).
create or replace function public.tienda_foto_puedo(p_stock uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.soy_tienda() and exists (
    select 1 from tienda_stock s
    where s.id = p_stock and s.tienda_id = auth.uid() and s.card_id is not null
  );
$$;
revoke all on function public.tienda_foto_puedo(uuid) from public;
grant execute on function public.tienda_foto_puedo(uuid) to authenticated;

drop policy if exists tienda_stock_fotos_ver on public.tienda_stock_fotos;
create policy tienda_stock_fotos_ver on public.tienda_stock_fotos for select to anon, authenticated
  using (public.tienda_foto_se_ve(stock_id));

drop policy if exists tienda_stock_fotos_poner on public.tienda_stock_fotos;
create policy tienda_stock_fotos_poner on public.tienda_stock_fotos for insert to authenticated
  with check (tienda_id = auth.uid() and public.tienda_foto_puedo(stock_id));

drop policy if exists tienda_stock_fotos_cambiar on public.tienda_stock_fotos;
create policy tienda_stock_fotos_cambiar on public.tienda_stock_fotos for update to authenticated
  using (tienda_id = auth.uid())
  with check (tienda_id = auth.uid() and public.tienda_foto_puedo(stock_id));

drop policy if exists tienda_stock_fotos_quitar on public.tienda_stock_fotos;
create policy tienda_stock_fotos_quitar on public.tienda_stock_fotos for delete to authenticated
  using (tienda_id = auth.uid());

grant select on public.tienda_stock_fotos to anon, authenticated;
grant insert, update, delete on public.tienda_stock_fotos to authenticated;

-- ── 2. El cubo público ──
-- 3 MB por fichero: el navegador comprime a 1.600 px y WebP antes de subir
-- (js/imagen-comprimir.js); el tope es por si alguien se salta el cliente.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tienda-fotos', 'tienda-fotos', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Un cubo público se sirve por su dirección sin política de lectura; la de
-- abajo es solo la de la propia carpeta, porque Storage la pide para BORRAR
-- (y para sobrescribir). Así nadie lista las carpetas de las demás tiendas.
drop policy if exists "tienda_fotos_select" on storage.objects;
create policy "tienda_fotos_select" on storage.objects for select to authenticated
  using (bucket_id = 'tienda-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "tienda_fotos_insert" on storage.objects;
create policy "tienda_fotos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'tienda-fotos' and (storage.foldername(name))[1] = auth.uid()::text and public.soy_tienda());

drop policy if exists "tienda_fotos_update" on storage.objects;
create policy "tienda_fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'tienda-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "tienda_fotos_delete" on storage.objects;
create policy "tienda_fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tienda-fotos' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
