// I3 del plan 2027 (tanda 1332): el esquema de HOY en un fichero.
//
// Aplica TODAS las migraciones del repo, en el orden en que entraron (la
// fecha del commit que añadió cada fichero, que es el orden en que un humano
// las ha ido ejecutando), sobre una base vacía del PostgreSQL de pruebas con
// lo mínimo de Supabase delante (roles, auth, storage, cron, net, vault). Cada
// sentencia va por su lado, como en el SQL Editor: un error no para el resto.
// Después vuelca `public` sin datos a `supabase-esquema-actual.sql` en la raíz del repo (no se sirve: `/supabase-*` va en las rutas internas).
//
// Solo para LEER: lo que manda siguen siendo las migraciones. Se regenera con
// cada migración nueva:  node herramientas/esquema-actual.mjs
// (y test-tanda-1332 comprueba que el fichero está al día).
import { spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BD = process.env.PD_BD_ESQUEMA || 'esquema_actual'
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres']
const correr = (cmd, args, entrada) => spawnSync(cmd, args, { encoding: 'utf8', input: entrada, maxBuffer: 1 << 28, timeout: 600000 })
const psql = (args, entrada) => correr('psql', [...PG, '-q', ...args], entrada)

// El orden: la fecha en que se AÑADIÓ cada migración (git), y el nombre para
// desempatar las que entraron en el mismo commit.
export function ordenDeMigraciones(repo = REPO) {
  const log = correr('git', ['-C', repo, 'log', '--diff-filter=A', '--reverse', '--format=@%at', '--name-only', '--', 'supabase-migration-*.sql']).stdout
  const vistos = new Map()
  let t = 0
  for (const linea of log.split('\n')) {
    if (linea.startsWith('@')) t = Number(linea.slice(1))
    else if (linea.trim() && !vistos.has(linea.trim())) vistos.set(linea.trim(), t)
  }
  // Las que aún no tienen commit: sin añadir (`--others`) o ya añadidas al
  // índice (`diff --cached`); las dos van al final, que son las últimas.
  const sinCommit = [
    ...correr('git', ['-C', repo, 'ls-files', '--others', '--exclude-standard', '--', 'supabase-migration-*.sql']).stdout.split('\n'),
    ...correr('git', ['-C', repo, 'diff', '--cached', '--name-only', '--diff-filter=A', '--', 'supabase-migration-*.sql']).stdout.split('\n'),
  ].filter(Boolean)
  for (const f of sinCommit) if (!vistos.has(f)) vistos.set(f, Number.MAX_SAFE_INTEGER)
  return [...vistos.entries()].filter(([f]) => existsSync(`${repo}/${f}`)).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([f]) => f)
}

// Lo de Supabase que las migraciones dan por hecho. No es Supabase: es lo
// justo para que las sentencias que lo nombran entren.
export const PRELUDIO = `
create extension if not exists unaccent; create extension if not exists pg_trgm;
create extension if not exists pgcrypto; create extension if not exists "uuid-ossp"; create extension if not exists citext;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_admin nologin; exception when duplicate_object then null; end $$;
grant usage on schema public to anon, authenticated, service_role;
create schema if not exists extensions;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, phone text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now(), email_confirmed_at timestamptz, last_sign_in_at timestamptz, banned_until timestamptz, deleted_at timestamptz, is_anonymous boolean default false);
create table if not exists auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid, created_at timestamptz default now(), updated_at timestamptz, user_agent text, ip inet, not_after timestamptz, refreshed_at timestamp, aal text);
create table if not exists auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid, status text, factor_type text, created_at timestamptz default now());
create table if not exists auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid, provider text, created_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
create or replace function auth.role() returns text language sql stable as $f$ select nullif(current_setting('request.jwt.claim.role', true), '') $f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, owner uuid, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(), last_accessed_at timestamptz);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $f$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $f$;
create or replace function storage.filename(name text) returns text language sql immutable as $f$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $f$;
create or replace function storage.extension(name text) returns text language sql immutable as $f$ select reverse(split_part(reverse(name), '.', 1)) $f$;
create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true);
create or replace function cron.schedule(p_nombre text, p_cuando text, p_orden text) returns bigint language sql as $f$ insert into cron.job (jobname, schedule, command) values (p_nombre, p_cuando, p_orden) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $f$;
create or replace function cron.unschedule(p_nombre text) returns boolean language sql as $f$ with b as (delete from cron.job where jobname = p_nombre returning 1) select exists (select 1 from b) $f$;
create schema if not exists net;
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $f$ select 1::bigint $f$;
create or replace function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $f$ select 1::bigint $f$;
create schema if not exists vault;
create table if not exists vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
create or replace view vault.decrypted_secrets as select id, name, secret as decrypted_secret, description from vault.secrets;
create or replace function vault.create_secret(p_secreto text, p_nombre text default null, p_desc text default null) returns uuid language sql as $f$ insert into vault.secrets (name, secret, description) values (p_nombre, p_secreto, p_desc) returning id $f$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
`


// La base de PARTIDA: las tablas que ya existían antes de la primera migración
// (se crearon a mano en el panel de Supabase) tal como las describe el primer
// SCHEMA.md (commit 994c594d, «confirmado desde el SQL Editor»). Los nombres
// son esos; los TIPOS son los que dice o, si no lo dice, el evidente. Sin esto,
// dos de cada tres migraciones fallan en cascada.
export const BASE_ORIGINAL = `
create table if not exists public.categories (id uuid primary key default gen_random_uuid(), slug text unique, name text, description text, emoji text, order_pos int, guide_count int default 0, cover_image text);
create table if not exists public.learning_paths (id uuid primary key default gen_random_uuid(), slug text unique, title text, description text, emoji text, guide_ids uuid[], is_featured boolean default false);
create table if not exists public.guide_collections (id uuid primary key default gen_random_uuid(), title text, slug text, emoji text, description text, category_id uuid references public.categories(id), created_at timestamptz default now());
create table if not exists public.guides (id uuid primary key default gen_random_uuid(), slug text unique, title text, description text, category_id uuid references public.categories(id), blocks jsonb, is_pro boolean default false, xp_reward int default 0, estimated_mins int, tags text[], cover_emoji text, cover_image text, published_at timestamptz, created_at timestamptz default now(), reference_blocks jsonb, reference_unlocked_by_default boolean default true, has_reference_blocks boolean default false, route_ids uuid[], level text, view_count int default 0, collection_id uuid references public.guide_collections(id), collection_order int, guide_rarity text, search_content text);
create table if not exists public.guide_routes (guide_id uuid references public.guides(id) on delete cascade, route_id uuid references public.learning_paths(id) on delete cascade, position int, primary key (guide_id, route_id));
create table if not exists public.achievement_definitions (id text primary key, title text, description text, emoji text, icon_url text, condition jsonb, rarity text, xp_reward int default 0, is_active boolean default true, cover_image text);
create table if not exists public.home_config (id int primary key, blocks jsonb, updated_at timestamptz default now());
create table if not exists public.notifications (id uuid primary key default gen_random_uuid(), title text, body text, data jsonb, target text default 'all', status text default 'draft', scheduled_at timestamptz, sent_at timestamptz, sent_count int default 0, created_at timestamptz default now());
create table if not exists public.user_profiles (id uuid primary key references auth.users(id) on delete cascade, username text, display_name text, total_xp int default 0, level text default 'Novato', is_pro boolean default false, achievements text[] default '{}', saved_guides uuid[] default '{}', unlocked_references uuid[] default '{}', avatar_color text, is_admin boolean default false, quiz_correct_count int default 0, push_token text, onboarding_completed boolean default false, interests text[], recommended_path text, created_at timestamptz default now());
create table if not exists public.user_progress (id uuid primary key default gen_random_uuid(), user_id uuid references public.user_profiles(id) on delete cascade, guide_id uuid references public.guides(id) on delete cascade, status text, xp_earned int default 0, started_at timestamptz default now(), completed_at timestamptz, current_block int default 0, unique (user_id, guide_id));
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $f$ select coalesce((select is_admin from public.user_profiles where id = auth.uid()), false) $f$;
insert into storage.buckets (id, name, public) values ('images', 'images', true) on conflict do nothing;
`

export function generar({ repo = REPO, salida = `${repo}/supabase-esquema-actual.sql`, escribir = true } = {}) {
  const lista = ordenDeMigraciones(repo)
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const pre = psql(['-d', BD, '-v', 'ON_ERROR_STOP=1'], PRELUDIO + BASE_ORIGINAL)
  if (pre.status !== 0) throw new Error(`el preludio no entra: ${pre.stderr}`)
  const conErrores = []
  for (const f of lista) {
    const r = psql(['-d', BD, '-v', 'ON_ERROR_STOP=0', '-f', `${repo}/${f}`])
    const n = (r.stderr.match(/ERROR:/g) || []).length
    if (n) conErrores.push({ fichero: f, errores: n, primero: (r.stderr.match(/ERROR:.*$/m) || [''])[0].slice(0, 160) })
  }
  const dump = correr('pg_dump', [...PG, '-d', BD, '--schema-only', '--schema=public', '--no-owner', '--no-comments'])
  if (dump.status !== 0) throw new Error(`pg_dump: ${dump.stderr}`)
  // Sin las líneas que cambian de una pasada a otra (versión, `\\restrict` con
  // su clave al azar), para que «está al día» sea comparar texto.
  const cuerpo = dump.stdout.split('\n')
    .filter((l) => !/^-- Dumped (from|by)/.test(l) && !/^\\(un)?restrict /.test(l))
    .join('\n').replace(/\n{3,}/g, '\n\n')
  const cabecera = `-- ESQUEMA ACTUAL de PokeDoc (tanda 1332, I3). GENERADO: no se edita a mano.
--
-- Solo para LEER cómo es hoy una tabla o una función sin recorrer las
-- migraciones. Lo que manda siguen siendo las supabase-migration-*.sql, que
-- es lo que un humano ejecuta. Se rehace con  node herramientas/esquema-actual.mjs
-- (rama pruebas), aplicando las ${lista.length} migraciones en el orden en que
-- entraron sobre un PostgreSQL vacío con lo justo de Supabase delante y la base
-- de partida del primer SCHEMA.md (las tablas de antes de la primera migración:
-- sus TIPOS son aproximados).
${conErrores.length ? `--\n-- Sentencias que no entraron en esa base (lo suyo puede faltar aquí):\n${conErrores.map((e) => `--   ${e.fichero} (${e.errores})`).join('\n')}\n` : ''}
`
  const texto = cabecera + cuerpo.trim() + '\n'
  if (escribir) writeFileSync(salida, texto)
  psql(['-c', `drop database if exists ${BD}`])
  return { texto, migraciones: lista.length, conErrores }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = generar()
  console.log(`${r.migraciones} migraciones; ${r.conErrores.length} con algún error:`)
  for (const e of r.conErrores) console.log(`  ${e.fichero}: ${e.errores} — ${e.primero}`)
}
