// Tanda 1310 — el timbre (C2) y las programadas espaciadas (C1).
//  · `timbre_hay_trabajo` dice lo mismo que mira cada función al empezar.
//  · `timbre_tocar` sin clave en el Vault no llama a nadie; con clave, llama
//    a /timbre?que=… solo por lo que tiene trabajo, con la clave en `x-timbre`,
//    y apunta lo hecho en `scrydex_estado.timbre`.
//  · La función `timbre`: solo POST, solo con la clave, solo lo que conoce.
//  · Los horarios de C1 no vuelven a ir más rápido de lo acordado.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── la migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1310'
const q = (s, rol = null) => { const r = psql(['-At', '-d', BD, '-c', (rol ? `set role ${rol}; ` : '') + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1310-timbre.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
check('ninguna clave escrita en la migración', !/create_secret\('[^L]/.test(mig.replace(/^--.*$/gm, '')))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  // Lo de Supabase que aquí no hay: el Vault, pg_net (apunta las llamadas) y pg_cron.
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create schema vault; create table vault.decrypted_secrets (name text, decrypted_secret text);
    create schema net; create table net.llamadas (url text, headers jsonb);
    create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds int) returns bigint language sql as $f$ insert into net.llamadas values (url, headers) returning 1::bigint $f$;
    create schema cron; create table cron.trabajos (nombre text primary key, cuando text, que text);
    create function cron.schedule(n text, c text, q text) returns bigint language sql as $f$ insert into cron.trabajos values (n, c, q) on conflict (nombre) do update set cuando = excluded.cuando, que = excluded.que returning 1::bigint $f$;
    create table scrydex_estado (clave text primary key, valor jsonb not null default '{}', updated_at timestamptz not null default now());
    create table rounds (id int, status text);
    create table tournaments (id int primary key, status text, registration_notified_at timestamptz, cancel_notified_at timestamptz, reminder_notified_at timestamptz, start_at timestamptz, podium jsonb, xp_awarded_at timestamptz, finish_notified_at timestamptz);
    create table judge_calls (id int, status text, notified_at timestamptz);
    create table tournament_registrations (id int, tournament_id int, status text);
    create table email_outbox (id int, status text, claimed_at timestamptz);
    create table user_notifications (id int, pushed_at timestamptz, created_at timestamptz default now());`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|revoke|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 100), x.stderr) } }
  check('la 1310 entra sentencia a sentencia y otra vez encima (sin pg_net ni pg_cron instalables: avisa y sigue)', todas, sentencias.length)
  check('el cron queda puesto cada minuto', q(`select cuando || ' ' || que from cron.trabajos where nombre = 'pokedoc-timbre'`).out === '* * * * * select public.timbre_tocar()')
  const trabajo = (que) => q(`select public.timbre_hay_trabajo('${que}')`).out
  check('nada pendiente: ni torneos, ni correos, ni push', trabajo('torneos') === 'f' && trabajo('correos') === 'f' && trabajo('push') === 'f')
  check('sin clave en el Vault no llama a nadie ni apunta nada', q(`select public.timbre_tocar(); select count(*) from net.llamadas; select count(*) from scrydex_estado`).out === '0\n0')
  psql(['-d', BD, '-c', `insert into vault.decrypted_secrets values ('timbre_secreto', 'clave-de-prueba')`])
  check('con clave y sin trabajo: no llama, pero apunta que ha mirado', q(`select public.timbre_tocar(); select count(*) from net.llamadas; select valor->'llamadas' from scrydex_estado where clave = 'timbre'`).out === '0\n{}')
  // Un correo en cola y un aviso de hace un rato sin empujar.
  psql(['-d', BD, '-c', `insert into email_outbox values (1, 'pending', null); insert into user_notifications (id) values (1)`])
  check('correos: uno pendiente', trabajo('correos') === 't')
  check('push: uno sin empujar de las últimas 24 h', trabajo('push') === 't')
  q(`select public.timbre_tocar()`)
  const llamadas = q(`select string_agg(url || '|' || (headers->>'x-timbre'), ',' order by url) from net.llamadas`).out
  check('llama a correos y a push, con la clave en x-timbre', llamadas === 'https://pokedoc.es/.netlify/functions/timbre?que=correos|clave-de-prueba,https://pokedoc.es/.netlify/functions/timbre?que=push|clave-de-prueba', llamadas)
  check('…y lo apunta: dos llamadas hoy', q(`select valor->>'llamadasHoy' from scrydex_estado where clave = 'timbre'`).out === '2')
  // Torneos: cada condición del barredor, una a una.
  psql(['-d', BD, '-c', `delete from email_outbox; delete from user_notifications; delete from net.llamadas`])
  const casos = [
    ['una ronda en marcha', `insert into rounds values (1, 'active')`, `delete from rounds`],
    ['inscripción abierta sin anunciar', `insert into tournaments (id, status) values (1, 'registration_open')`, `delete from tournaments`],
    ['cancelado sin avisar', `insert into tournaments (id, status) values (1, 'cancelled')`, `delete from tournaments`],
    ['empieza en media hora sin recordatorio', `insert into tournaments (id, status, registration_notified_at, start_at) values (1, 'registration_closed', now(), now() + interval '30 minutes')`, `delete from tournaments`],
    ['terminado sin XP repartido', `insert into tournaments (id, status, podium, finish_notified_at) values (1, 'finished', '[]', now())`, `delete from tournaments`],
    ['un juez llamado sin avisar', `insert into judge_calls values (1, 'open', null)`, `delete from judge_calls`],
    ['lista de espera en un torneo abierto', `insert into tournaments (id, status, registration_notified_at) values (1, 'registration_open', now()); insert into tournament_registrations values (1, 1, 'waitlisted')`, `delete from tournament_registrations; delete from tournaments`],
  ]
  for (const [nombre, poner, quitar] of casos) {
    psql(['-d', BD, '-c', poner])
    check(`torneos: ${nombre}`, trabajo('torneos') === 't')
    psql(['-d', BD, '-c', quitar])
  }
  psql(['-d', BD, '-c', `insert into tournaments (id, status, registration_notified_at, start_at, finish_notified_at, xp_awarded_at) values (1, 'registration_closed', now(), now() + interval '3 hours', null, null), (2, 'finished', now(), now() - interval '1 day', now(), now())`])
  check('torneos: un torneo dentro de tres horas y otro ya cerrado del todo no son trabajo', trabajo('torneos') === 'f')
  // Una tabla que falta no deja un torneo parado: se llama igual.
  psql(['-d', BD, '-c', `drop table judge_calls`])
  q(`select public.timbre_tocar()`)
  check('si una consulta falla, se llama igual (más vale de más que un torneo parado)', q(`select count(*) from net.llamadas where url like '%que=torneos'`).out === '1')
  check('nadie desde la web puede tocarlo', !q(`select public.timbre_tocar()`, 'authenticated').ok && !q(`select public.timbre_hay_trabajo('push')`, 'anon').ok)
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── la función timbre ──')
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
// Las dependencias de las funciones (web-push, nodemailer) las instala
// Netlify, no este contenedor: aquí se cambian por un módulo vacío.
const { register } = await import('node:module')
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { if (s === 'web-push' || s === 'nodemailer') return { url: 'data:text/javascript,export default {}', shortCircuit: true }; return n(s, c) }`))
const T = await import(`${REPO}/netlify/functions/timbre.mjs`)
check('la clave se compara entera', T.claveBuena('abc', 'abc') && !T.claveBuena('abd', 'abc') && !T.claveBuena('ab', 'abc') && !T.claveBuena(null, 'abc') && !T.claveBuena('', ''))
check('conoce los tres trabajos', Object.keys(T.TRABAJOS).sort().join() === 'correos,push,torneos' && Object.values(T.TRABAJOS).every((f) => typeof f === 'function'))
const pedir = (metodo, que, clave) => T.default(new Request(`https://pokedoc.es/.netlify/functions/timbre?que=${que}`, { method: metodo, headers: clave ? { 'x-timbre': clave } : {} }))
process.env.TIMBRE_SECRETO = 'clave-de-prueba'
check('GET no', (await pedir('GET', 'push', 'clave-de-prueba')).status === 405)
check('sin clave, no', (await pedir('POST', 'push')).status === 401)
check('con otra clave, no', (await pedir('POST', 'push', 'otra')).status === 401)
check('un trabajo que no existe, no', (await pedir('POST', 'borrarlo-todo', 'clave-de-prueba')).status === 404)
delete process.env.TIMBRE_SECRETO
check('sin TIMBRE_SECRETO en Netlify, nadie despierta nada', (await pedir('POST', 'push', '')).status === 401)
check('el timbre no se programa a sí mismo', !/export const config/.test(readFileSync(`${REPO}/netlify/functions/timbre.mjs`, 'utf8')))

console.log('── C1: las programadas, espaciadas ──')
const horario = (f) => (readFileSync(`${REPO}/netlify/functions/${f}.mjs`, 'utf8').match(/schedule:\s*'([^']+)'/) || [])[1]
const ACORDADO = {
  'decks-jp-a-mano': '9 */6 * * *', 'scrydex-decks-jp': '7 3 * * *', 'scrydex-rellenar-set': '4 */6 * * *',
  'tcgdex-rellenar-set': '6 */3 * * *', 'tcggo-reemplazar-set': '4 * * * *', 'escaneos-asia': '2-59/20 * * * *',
  'catalogo-asia': '*/20 * * * *', 'cartas-detalle': '*/10 * * * *', 'cartas-pokedex': '*/30 * * * *',
  'tcggo-versiones': '0-54/6 * * * *', 'tcggo-calco-jp': '1-59/6 * * * *', 'tcggo-precios': '*/4 * * * *',
  'tcggo-catalogo': '2-59/15 * * * *', 'tcggo-versiones-idioma': '*/20 * * * *', 'meta-limitless': '*/30 * * * *',
}
const distintos = Object.entries(ACORDADO).filter(([f, h]) => horario(f) !== h).map(([f]) => `${f}: ${horario(f)}`)
check('cada una con el horario de la 1310', !distintos.length, distintos.join(' | '))
check('el despliegue pasa por antes-de-salir', /\[build\][\s\S]*?command\s*=\s*"node herramientas\/antes-de-salir\.mjs"/.test(readFileSync(`${REPO}/netlify.toml`, 'utf8')))
check('el semáforo de /admin conoce el timbre', /\['timbre', /.test(readFileSync(`${REPO}/admin/js/semaforo.js`, 'utf8')))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
