// Tanda 1292 — el destacado y el logo sin fondo, contra PostgreSQL de verdad.
// Hay UN destacado como mucho (lo pone el disparador, no /admin), las
// funciones de la 1192 lo devuelven solas y la migración entra dos veces y
// sentencia a sentencia (la 631).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1292'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const sinNotify = (m) => m.replace(/notify pgrst[^;]*;/g, '')
const m1192 = sinNotify(readFileSync(`${REPO}/supabase-migration-1192-eventos.sql`, 'utf8'))
const mig = readFileSync(`${REPO}/supabase-migration-1292-eventos-destacado.sql`, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const ADMIN = '00000000-0000-0000-0000-00000000ad01'
  const ANE = '00000000-0000-0000-0000-0000000000a1'
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create schema if not exists auth; create table auth.users (id uuid primary key);
    grant usage on schema auth to anon, authenticated;
    create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
    revoke all on function is_admin() from public; grant execute on function is_admin() to authenticated;
    grant usage on schema public to anon, authenticated;
    create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text);
    grant select on user_profiles to anon, authenticated;
    insert into auth.users values ('${ADMIN}'), ('${ANE}');
    insert into user_profiles (id, username) values ('${ADMIN}', 'pingu'), ('${ANE}', 'ane');`])
  check('el andamio carga', r.status === 0, r.stderr)
  check('la 1192 entra', psql(['-d', BD, '-c', m1192]).status === 0)
  const comoAdmin = `set prueba.uid = '${ADMIN}'; set prueba.admin = 'si'; set role authenticated;`
  const comoAne = `set prueba.uid = '${ANE}'; set prueba.admin = 'no'; set role authenticated;`
  check('  …con eventos de antes', q(`${comoAdmin} insert into eventos (slug, nombre, empieza) values ('iberian', 'Iberian', now() + interval '30 days'), ('castellon', 'Castellón', now() + interval '4 days'), ('trade', 'Trade', now() + interval '8 days')`).ok)

  // Sentencia a sentencia, cada una en su conexión (la 631), y dos veces.
  const sentencias = sinNotify(mig).split(/;\s*\n(?=(?:alter|create|drop|notify|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let vuelta = 0; vuelta < 2; vuelta++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(x.stderr) } }
  check('la 1292 entra sentencia a sentencia, y otra vez encima', todas && sentencias.length >= 4, sentencias.length)

  check('los de antes, sin destacar y con logo con fondo', q(`select count(*) from eventos where destacado or logo_sin_fondo`).out === '0')
  check('el equipo destaca uno', q(`${comoAdmin} update eventos set destacado = true where slug = 'iberian'`).ok)
  check('  …y destacar OTRO desmarca el primero', q(`${comoAdmin} update eventos set destacado = true where slug = 'castellon'`).ok && q(`select string_agg(slug, ',') from eventos where destacado`).out === 'castellon')
  check('  …también al dar de alta uno ya destacado', q(`${comoAdmin} insert into eventos (slug, nombre, empieza, destacado) values ('nuevo', 'Nuevo', now() + interval '2 days', true)`).ok && q(`select string_agg(slug, ',') from eventos where destacado`).out === 'nuevo')
  check('  …y guardar el destacado tal cual no lo quita', q(`${comoAdmin} update eventos set destacado = true, nombre = 'Nuevo!' where slug = 'nuevo'`).ok && q(`select string_agg(slug, ',') from eventos where destacado`).out === 'nuevo')
  check('quitarle el destacado lo deja sin ninguno', q(`${comoAdmin} update eventos set destacado = false where slug = 'nuevo'`).ok && q(`select count(*) from eventos where destacado`).out === '0')
  q(`${comoAdmin} update eventos set destacado = true where slug = 'iberian'`)
  check('alguien que no es del equipo no destaca nada', q(`${comoAne} update eventos set destacado = true where slug = 'trade'`).ok && q(`select string_agg(slug, ',') from eventos where destacado`).out === 'iberian')
  check('el logo sin fondo se guarda', q(`${comoAdmin} update eventos set logo_sin_fondo = true where slug = 'iberian'`).ok)
  const l = JSON.parse(q(`${comoAne} select eventos_lista()`).out || '[]')
  const ib = l.find((e) => e.slug === 'iberian')
  check('eventos_lista los devuelve sin tocar la función', ib?.destacado === true && ib?.logo_sin_fondo === true && l.filter((e) => e.destacado).length === 1, JSON.stringify(ib))
  const f = JSON.parse(q(`select evento_ficha('iberian')`).out || 'null')
  check('  …y la ficha también', f?.destacado === true && f?.logo_sin_fondo === true)
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
