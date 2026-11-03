// Tanda 1193 — Eventos: Trade night, días con horario y varias entradas.
// La migración contra PostgreSQL (encima de la 1192, con un evento ya dentro,
// como en producción, y sentencia a sentencia como el SQL Editor), y lo puro
// de los días y las entradas.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── Lo puro ──')
const m = await import(`${REPO}/js/eventos-puro.js`)
check('«Trade night» es un tipo', m.TIPOS.trade_night === 'Trade night')
const viejo = { empieza: new Date(2026, 10, 7, 10).toISOString(), termina: new Date(2026, 10, 8, 20).toISOString() }
check('un evento de antes (empieza y termina) da sus dos días con su hora', JSON.stringify(m.horarioDe(viejo)) === JSON.stringify([{ dia: '2026-11-07', desde: '10:00', hasta: '20:00' }, { dia: '2026-11-08', desde: '10:00', hasta: '20:00' }]), JSON.stringify(m.horarioDe(viejo)))
check('  …y se lee «Sábado 7 y domingo 8 de noviembre · 10:00 – 20:00»', m.fechaLarga(viejo) === 'Sábado 7 y domingo 8 de noviembre · 10:00 – 20:00', m.fechaLarga(viejo))
check('un día sin hora: solo el día', m.fechaLarga({ empieza: new Date(2026, 10, 7).toISOString() }) === 'Sábado, 7 de noviembre')
const sueltos = [{ dia: '2026-11-14', desde: '10:00', hasta: '14:00' }, { dia: '2026-11-07', desde: '10:00', hasta: '20:00' }]
check('días sueltos, en orden y sin hora común: «7 y 14 de noviembre»', m.fechaLarga({ horario: sueltos }) === '7 y 14 de noviembre', m.fechaLarga({ horario: sueltos }))
check('  …y la ficha los pone uno a uno', JSON.stringify(m.diasConHora({ horario: sueltos })) === JSON.stringify([{ texto: 'Sábado 7', horas: '10:00 – 20:00' }, { texto: 'Sábado 14', horas: '10:00 – 14:00' }]))
check('tres días seguidos: «Del 6 al 8 de noviembre»', m.fechaLarga({ horario: ['06', '07', '08'].map((d) => ({ dia: `2026-11-${d}`, desde: '', hasta: '' })) }) === 'Del 6 al 8 de noviembre')
const ext = m.extremosDeHorario(sueltos)
check('empieza y termina salen del primer y el último día con su hora', new Date(ext.empieza).getTime() === new Date(2026, 10, 7, 10).getTime() && new Date(ext.termina).getTime() === new Date(2026, 10, 14, 14).getTime(), JSON.stringify(ext))
check('  …y sin hora de acabar en varios días, el último a las 23:59', new Date(m.extremosDeHorario([{ dia: '2026-11-07', desde: '10:00' }, { dia: '2026-11-08', desde: '10:00' }]).termina).getHours() === 23)
const ent = m.entradasDe({ entradas: [{ nombre: 'General', precio: 5 }, { nombre: 'VIP', precio: 15.5, nota: 'Entra a las 9' }, { nombre: 'Niños', precio: 0 }, { nombre: '', precio: 3 }, { nombre: 'Prensa' }] })
check('entradas: las que tienen nombre, con precio o sin él', ent.length === 4 && ent[3].precio === null, JSON.stringify(ent))
check('el resumen: «General 5 € · VIP 15,50 € · Niños Gratis · Prensa»', m.resumenEntradas(ent) === 'General 5 € · VIP 15,50 € · Niños Gratis · Prensa', m.resumenEntradas(ent))
check('«Desde» con la de pago más barata (la gratis de los niños no la baja a 0 €); «Gratis» si todas lo son', m.desdePrecio(ent) === 'Desde 5 €' && m.desdePrecio([{ precio: 5 }, { precio: 15 }]) === 'Desde 5 €' && m.desdePrecio([{ precio: 0 }]) === 'Gratis' && m.desdePrecio([{ precio: null }]) === '')

console.log('── La migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1193'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1193-eventos-dias-entradas.sql`, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
if (psql(['-c', 'select 1']).status !== 0) check('hay un PostgreSQL en /var/tmp:5433', false)
else {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create schema if not exists auth; create table auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
    create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text);`])
  check('el andamio', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', `${REPO}/supabase-migration-1192-eventos.sql`])
  check('la 1192', r.status === 0, r.stderr)
  check('el card show que ya hay', q(`insert into eventos (slug, nombre, empieza, termina, entrada) values ('iberian-2026', 'Iberian Card Show', '2026-11-07 09:00+00', '2026-11-08 19:00+00', '5 €')`).ok)
  // Sentencia a sentencia, cada una en su conexión (la 631), y dos veces.
  const sentencias = mig.replace(/--[^\n]*/g, '').split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)
  for (const vuelta of [1, 2]) {
    const malas = sentencias.map((s) => [s, q(s)]).filter(([, x]) => !x.ok)
    check(`la 1193, sentencia a sentencia (vuelta ${vuelta})`, !malas.length, malas.map(([s, x]) => `${s.slice(0, 60)}: ${x.err}`).join(' | '))
  }
  check('el evento de antes sigue igual, con horario y entradas vacíos', q(`select nombre || '|' || entrada || '|' || horario::text || '|' || entradas::text from eventos`).out === 'Iberian Card Show|5 €|[]|[]')
  check('admite «Trade night»', q(`insert into eventos (slug, nombre, tipo, empieza) values ('tn', 'Trade Night', 'trade_night', now())`).ok)
  check('  …y sigue rechazando un tipo que no existe', !q(`insert into eventos (slug, nombre, tipo, empieza) values ('x1', 'Raro', 'feria', now())`).ok)
  const h = `'[{"dia":"2026-11-07","desde":"10:00","hasta":"20:00"},{"dia":"2026-11-08","desde":"10:00","hasta":"20:00"}]'`
  const e = `'[{"nombre":"General","precio":5,"nota":""},{"nombre":"VIP","precio":15,"nota":"Entra a las 9"}]'`
  check('guarda los días y las entradas', q(`update eventos set horario = ${h}, entradas = ${e} where slug = 'iberian-2026'`).ok)
  check('rechaza un horario que no es una lista', !q(`update eventos set horario = '{"dia":"2026-11-07"}' where slug = 'tn'`).ok)
  check('rechaza más de doce entradas', !q(`update eventos set entradas = (select jsonb_agg(jsonb_build_object('nombre', 'E' || g)) from generate_series(1, 13) g) where slug = 'tn'`).ok)
  const j = q(`select evento_ficha('iberian-2026')::text`)
  const ficha = j.ok ? JSON.parse(j.out) : null
  check('la ficha (evento_json de la 1192) ya trae los días y las entradas', ficha?.horario?.length === 2 && ficha?.entradas?.[1]?.nombre === 'VIP', j.err || j.out.slice(0, 200))
  psql(['-c', `drop database if exists ${BD}`])
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
