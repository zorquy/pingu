-- ============================================================
-- Tanda 969: cada producto sellado que tienes, con SU idioma.
--
-- PINGU: «si tiene que tratar igual que una carta: tú agregas un producto
-- en X idioma; eso tiene que estar sí o sí». Hasta ahora `user_products`
-- era una fila por persona y producto, sin idioma, y la ficha valoraba lo
-- tuyo con el precio en español aunque tu lata fuera inglesa.
--
--  1. `idioma` en `user_products`. Lo que ya había se queda en el idioma del
--     propio producto (`tcg_products.lang`: inglés en el occidental, japonés
--     en el japonés), que es lo que la ficha venía enseñando como suyo.
--  2. La fila única pasa a ser persona + producto + IDIOMA: una lata en
--     inglés y otra en español son dos líneas, como dos copias de una carta.
--
-- Se puede ejecutar dos veces.
-- ============================================================

begin;

alter table public.user_products add column if not exists idioma text;

update public.user_products u
   set idioma = case when lower(coalesce(p.lang, 'en')) like 'ja%' then 'ja' else 'en' end
  from public.tcg_products p
 where p.id = u.product_id and u.idioma is null;
update public.user_products set idioma = 'en' where idioma is null;

alter table public.user_products alter column idioma set default 'en';
alter table public.user_products alter column idioma set not null;

alter table public.user_products drop constraint if exists user_products_idioma_valido;
alter table public.user_products add constraint user_products_idioma_valido
  check (idioma in ('es', 'en', 'de', 'fr', 'it', 'pt', 'nl', 'ja', 'ko', 'zh'));

alter table public.user_products drop constraint if exists user_products_uno;
alter table public.user_products drop constraint if exists user_products_uno_por_idioma;
alter table public.user_products add constraint user_products_uno_por_idioma unique (user_id, product_id, idioma);

notify pgrst, 'reload schema';

commit;

-- ── Comprobación (el SQL Editor enseña la última) ──
select idioma, count(*) as lineas, sum(cantidad) as productos
from public.user_products
group by idioma
order by idioma;
