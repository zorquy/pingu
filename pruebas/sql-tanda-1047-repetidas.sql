-- Tanda 1047, la otra mitad: juntar repetidas en /admin deja los deseos con
-- su versión, y deshacer los devuelve como estaban. Encima del fixture de la
-- 987 (sql-tanda-885/934/987 y sus migraciones, más la 996), con lo que las
-- demás funciones de la 1047 necesitan para crearse. Después de esto se
-- pasan los casos de la 987 tal cual (con las funciones nuevas) y luego
-- sql-tanda-1047-repetidas-casos.sql.
\set ON_ERROR_STOP on
alter table public.user_wants add column prioridad int not null default 1, add column notas text, add column created_at timestamptz not null default now();
alter table public.user_collection add column cambio int not null default 0, add column estado text not null default 'NM', add column gradeo text, add column updated_at timestamptz default now();
alter table public.user_profiles add column display_name text, add column avatar_url text, add column is_moderator boolean, add column is_banned boolean, add column notification_prefs_disabled text[];
alter table public.tcg_card_prices add column if not exists cm_trend numeric;
alter table public.tcg_cards add column if not exists name_search text;
create table public.user_follows (follower_id uuid, following_id uuid);
create table public.user_notifications (id serial primary key, recipient_id uuid, type text, title text, body text, link text, read_at timestamptz);
create table public.trade_offers (id uuid primary key, de uuid, para uuid);
create table public.trade_offer_items (id uuid primary key, oferta uuid, quien uuid, linea uuid, card_id text, market text, idioma text, estado text, variante text, gradeo text, cantidad int);
\i /home/user/pingu/supabase-migration-1047-deseos-con-version.sql
\i /home/user/pingu/supabase-migration-1047-deseos-con-version.sql
