// Tanda 1192 — Eventos: la migración, contra PostgreSQL de verdad. La tabla
// la escribe solo el equipo, la gente lee lo publicado, «Voy» pasa por
// `evento_voy` y los que van «sin decirlo» cuentan en el número pero no salen
// en la lista.
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
const BD = 'prueba_1192'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1192-eventos.sql`, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const ADMIN = '00000000-0000-0000-0000-00000000ad01'
  const ANE = '00000000-0000-0000-0000-0000000000a1'
  const UNAI = '00000000-0000-0000-0000-0000000000a2'
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create schema if not exists auth; create table auth.users (id uuid primary key);
    grant usage on schema auth to anon, authenticated;
    create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    -- Como en producción: is_admin() solo la puede ejecutar quien tiene sesión.
    create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
    revoke all on function is_admin() from public; grant execute on function is_admin() to authenticated;
    grant usage on schema public to anon, authenticated;
    create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text);
    grant select on user_profiles to anon, authenticated;
    insert into auth.users values ('${ADMIN}'), ('${ANE}'), ('${UNAI}');
    insert into user_profiles (id, username, display_name) values ('${ADMIN}', 'pingu', 'PINGU'), ('${ANE}', 'ane', 'Ane'), ('${UNAI}', 'unai', 'Unai');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
  r = psql(['-d', BD, '-c', sinNotify])
  check('la 1192 entra', r.status === 0, r.stderr)
  check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
  // En el SQL Editor cada sentencia va por su lado (la 631): se prueba igual.
  const comoAdmin = `set prueba.uid = '${ADMIN}'; set prueba.admin = 'si'; set role authenticated;`
  const comoAne = `set prueba.uid = '${ANE}'; set prueba.admin = 'no'; set role authenticated;`
  const comoUnai = `set prueba.uid = '${UNAI}'; set prueba.admin = 'no'; set role authenticated;`
  const sinSesion = `set prueba.uid = ''; set role anon;`

  let x = q(`${comoAdmin} insert into eventos (slug, nombre, tipo, empieza, ciudad) values ('iberian-card-show-2026', 'Iberian Card Show', 'card_show', now() + interval '12 days', 'Madrid'), ('trade-night', 'Trade Night', 'quedada', now() + interval '3 days', 'Valencia'), ('pasado', 'PortugalTCG Show', 'card_show', now() - interval '20 days', 'Setúbal') returning slug`)
  check('el equipo da de alta eventos', x.ok && x.out.split('\n').length === 3, x.err)
  check('  …y uno sin publicar', q(`${comoAdmin} insert into eventos (slug, nombre, empieza, publicado) values ('borrador', 'Borrador', now() + interval '5 days', false)`).ok)
  check('alguien que no es del equipo, no', !q(`${comoAne} insert into eventos (slug, nombre, empieza) values ('mio', 'Mío', now())`).ok)
  check('  …ni lo cambia', q(`${comoAne} update eventos set nombre = 'Hackeado' where slug = 'trade-night'`).ok && q(`select nombre from eventos where slug = 'trade-night'`).out === 'Trade Night')
  check('una dirección rara, no', !q(`${comoAdmin} insert into eventos (slug, nombre, empieza) values ('Con Espacios', 'X', now())`).ok)

  const lista = (como) => JSON.parse(q(`${como} select eventos_lista()`).out || '[]')
  let l = lista(sinSesion)
  check('sin sesión, la agenda: lo publicado, lo pasado incluido, en orden', l.map((e) => e.slug).join() === 'pasado,trade-night,iberian-card-show-2026', l.map((e) => e.slug).join())
  check('  …sin decir quién lo creó', !('creado_por' in l[0]))
  check('  …y sin sesión la tabla tampoco enseña el borrador', q(`${sinSesion} select count(*) from eventos`).out === '3')
  check('el equipo ve el borrador por su ficha', JSON.parse(q(`${comoAdmin} select evento_ficha('borrador')`).out || 'null')?.slug === 'borrador')
  check('  …y la gente no', q(`${comoAne} select evento_ficha('borrador')`).out === '' && q(`${sinSesion} select evento_ficha('borrador')`).out === '')

  const idIb = q(`select id from eventos where slug = 'iberian-card-show-2026'`).out
  x = q(`${comoAne} select evento_voy('${idIb}', true, false)`)
  check('«Voy»: Ane va', x.ok && JSON.parse(x.out).van === 1, x.err)
  x = q(`${comoUnai} select evento_voy('${idIb}', true, true)`)
  check('  …Unai va «sin decirlo»', x.ok && JSON.parse(x.out).oculto === true && JSON.parse(x.out).van === 2, x.err)
  const f = JSON.parse(q(`${sinSesion} select evento_ficha('iberian-card-show-2026')`).out)
  check('la ficha: van 2, y en la lista solo Ane', f.van === 2 && f.caras.map((c) => c.username).join() === 'ane', JSON.stringify(f.caras))
  const fu = JSON.parse(q(`${comoUnai} select evento_ficha('iberian-card-show-2026')`).out)
  check('  …y Unai sabe que va, sin decirlo', fu.voy === true && fu.oculto === true)
  check('nadie lee la tabla de quién va entera', q(`${comoAne} select count(*) from evento_asistentes`).out === '1' && q(`${sinSesion} select count(*) from evento_asistentes`).ok === false)
  check('sin sesión no se marca «Voy»', /permission denied/.test(q(`${sinSesion} select evento_voy('${idIb}', true, false)`).err))
  const idPas = q(`select id from eventos where slug = 'pasado'`).out
  check('en uno que ya pasó, no', /ya pasó/.test(q(`${comoAne} select evento_voy('${idPas}', true, false)`).err))
  const idBor = q(`select id from eventos where slug = 'borrador'`).out
  check('en uno sin publicar, no', /no existe/.test(q(`${comoAne} select evento_voy('${idBor}', true, false)`).err))
  x = q(`${comoAne} select evento_voy('${idIb}', false)`)
  check('quitar «Voy»', x.ok && JSON.parse(x.out).van === 1, x.err)
  check('  …y Ane ya no sale', JSON.parse(q(`${sinSesion} select evento_ficha('iberian-card-show-2026')`).out).caras.length === 0)
  check('borrar un evento se lleva a quién va', q(`${comoAdmin} delete from eventos where slug = 'iberian-card-show-2026'`).ok && q(`select count(*) from evento_asistentes`).out === '0')
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
