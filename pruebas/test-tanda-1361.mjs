// Tanda 1361 — nadie podía crear una cuenta (2026-11-15). El disparador de
// auth.users (`handle_new_user`, hecho a mano en el panel, fuera del repo)
// escribía `saved_guides`, que la 1306 borró de user_profiles: «Database error
// saving new user» en cada alta. Se monta la tabla y sus disparadores de HOY
// (supabase-esquema-actual.sql), con el disparador viejo tal como estaba en la
// base, y se comprueba que falla y que la migración 1361 lo arregla.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const PG = ['-h', '/var/tmp', '-p', '5433', '-X', '-q']
const BD = 'prueba1361'
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const sql = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0 && !/ERROR/.test(r.stderr), out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }

const mig = leer('supabase-migration-1361-alta-de-cuentas.sql')
check('la función nueva no nombra columnas que se puedan ir (solo id y el color)', /insert into public\.user_profiles \(id, avatar_color\)/.test(mig) && !/saved_guides\)|saved_guides,/.test(mig.split('create or replace')[1]))
check('…con search_path fijo y sin tumbar el alta si el perfil falla', /set search_path = public, pg_catalog/.test(mig) && /exception when others/.test(mig))

const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const esq = leer('supabase-esquema-actual.sql')
  const trozo = (re) => (esq.match(re) || [''])[0]
  const base = [
    `do $$ begin create role anon; exception when duplicate_object then null; end $$;`,
    `do $$ begin create role authenticated; exception when duplicate_object then null; end $$;`,
    `create schema auth; create table auth.users (id uuid primary key, email text);`,
    `create function public.is_admin() returns boolean language sql stable as 'select false';`,
    `create function public.nivel_de_xp(int) returns text language sql immutable as $$select 'Novato'$$;`,
    `create function public.url_de_imagen_segura(text) returns boolean language sql immutable as 'select true';`,
    `create function public.plegar_texto(text) returns text language sql immutable as 'select lower($1)';`,
    trozo(/^CREATE TABLE public\.user_profiles \([\s\S]*?^\);/m),
    `alter table public.user_profiles add primary key (id);`,
    trozo(/^CREATE FUNCTION public\.perfil_guarda_columnas\(\) RETURNS[\s\S]*?^\$\$;/m),
    trozo(/^CREATE FUNCTION public\.tienda_guarda_tipo\(\) RETURNS[\s\S]*?^\$\$;/m),
    trozo(/^CREATE FUNCTION public\.privado_al_nacer\(\) RETURNS[\s\S]*?^end \$\$;/m),
    (leer('supabase-migration-1306-perfil-privado.sql').match(/create table if not exists public\.user_privado \([\s\S]*?\);/) || [''])[0],
    ...esq.split('\n').filter((l) => /^CREATE TRIGGER trg_(perfil_guarda_columnas|tienda_guarda_tipo|privado_al_nacer) /.test(l)),
    // El disparador como estaba en la base (lo pegó PINGU del SQL Editor).
    `CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$ BEGIN INSERT INTO public.user_profiles (id, display_name, avatar_color, total_xp, level, is_pro, achievements, saved_guides, unlocked_references) VALUES (NEW.id, NULL, '#1e5175', 0, 'Novato', FALSE, ARRAY[]::TEXT[], ARRAY[]::UUID[], ARRAY[]::UUID[]) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $function$;`,
    `create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();`,
  ]
  const montada = base.every((s) => sql(s).ok)
  check('se monta user_profiles de hoy con sus disparadores', montada)
  const U = '11111111-1111-1111-1111-111111111111'
  const antes = sql(`insert into auth.users values ('${U}', 'a@b.c')`)
  check('con el disparador viejo, el alta falla por saved_guides (lo que veía PINGU)', !antes.ok && /saved_guides/.test(antes.err), antes.err)
  // La migración, sentencia a sentencia en su conexión (631), y dos veces.
  for (let v = 0; v < 2; v++) { const r = psql(['-d', BD, '-c', mig]); check(`la migración entra (${v + 1}.ª vez)`, r.status === 0 && !/ERROR/.test(r.stderr), r.stderr) }
  const despues = sql(`insert into auth.users values ('${U}', 'a@b.c')`)
  check('con la 1361, el alta entra', despues.ok, despues.err)
  const p = sql(`select level || '|' || total_xp || '|' || coalesce(display_name, '-') || '|' || tipo || '|' || onboarding_completed from user_profiles where id = '${U}'`).out
  check('…con su perfil por defecto (sin nombre: la web lo manda a la bienvenida)', p === 'Novato|0|-|persona|false', p)
  check('…y su fila privada (trg_privado_al_nacer)', sql(`select count(*) from user_privado where user_id = '${U}'`).out === '1')
  // Si un día el perfil vuelve a fallar, la cuenta se crea igual.
  sql(`alter table user_profiles add column obligatoria text not null default 'x'; alter table user_profiles alter column obligatoria drop default;`)
  const U2 = '22222222-2222-2222-2222-222222222222'
  const tercera = sql(`insert into auth.users values ('${U2}', 'd@e.f')`)
  check('si el perfil fallara, la cuenta se crea igual (la bienvenida pone el perfil)', tercera.ok && sql(`select count(*) from auth.users where id = '${U2}'`).out === '1', tercera.err)
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n${fails} FALLA(N)` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
