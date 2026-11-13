// Tanda 1321 — Tu calendario de PokeDoc en el del móvil (P7 del plan): la
// dirección secreta /cal/<clave>.ics con tus torneos, jornadas, eventos con
// «Voy» y lanzamientos. Base (PostgreSQL), lo puro, la función y Ajustes.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const leer = (f) => readFileSync(`${REPO}/${f}`, 'utf8')

console.log('── La base ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1321'
const q = (s, rol = null, uid = '') => { const r = psql(['-At', '-d', BD, '-c', (rol ? `set prueba.uid = '${uid}'; set role ${rol}; ` : '') + s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = leer('supabase-migration-1321-calendario.sql')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
if (psql(['-c', 'select 1']).status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create schema if not exists auth;
    create table auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    grant usage on schema auth to anon, authenticated; grant execute on all functions in schema auth to anon, authenticated;
    insert into auth.users values ('${U(1)}'), ('${U(2)}');
    create table tournaments (id uuid primary key default gen_random_uuid(), name text, start_at timestamptz, status text, matchday_dates jsonb);
    create table tournament_registrations (tournament_id uuid, user_id uuid, status text);
    create table eventos (id uuid primary key default gen_random_uuid(), slug text, nombre text, empieza timestamptz, termina timestamptz, sitio text, direccion text, ciudad text, horario jsonb);
    create table evento_asistentes (evento_id uuid, user_id uuid);
    create table tcg_sets (id text, name text, release_date date, market text);
    create table user_collection (user_id uuid, market text);
    insert into tournaments (id, name, start_at, status, matchday_dates) values
      ('10000000-0000-0000-0000-000000000001', 'Liga FDN', now() + interval '3 days', 'in_progress', '["2026-11-19T18:00:00Z","2026-11-26T18:00:00Z"]'),
      ('10000000-0000-0000-0000-000000000002', 'Copa', now() + interval '10 days', 'registration_open', null),
      ('10000000-0000-0000-0000-000000000003', 'Cancelado', now() + interval '5 days', 'cancelled', null);
    insert into tournament_registrations values ('10000000-0000-0000-0000-000000000001', '${U(1)}', 'active'), ('10000000-0000-0000-0000-000000000002', '${U(1)}', 'dropped'), ('10000000-0000-0000-0000-000000000003', '${U(1)}', 'active'), ('10000000-0000-0000-0000-000000000002', '${U(2)}', 'active');
    insert into eventos (id, slug, nombre, empieza) values ('20000000-0000-0000-0000-000000000001', 'trade-night', 'Trade night', now() + interval '2 days'), ('20000000-0000-0000-0000-000000000002', 'otro', 'Otro', now() + interval '2 days');
    insert into evento_asistentes values ('20000000-0000-0000-0000-000000000001', '${U(1)}');
    insert into tcg_sets values ('sv10', 'Ascended Heroes', current_date + 20, 'WEST'), ('m4', 'JP set', current_date + 30, 'JP'), ('viejo', 'Viejo', current_date - 60, 'WEST');
    insert into user_collection values ('${U(1)}', 'WEST');`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.split(/;\s*\n(?=(?:create|alter|do|grant|update|drop|insert|revoke|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', st.endsWith(';') ? st : st + ';']); if (x.status !== 0) { todas = false; console.log(st.slice(0, 100), x.stderr) } }
  check('la 1321 entra sentencia a sentencia y otra vez encima', todas, sentencias.length)
  const mio = q(`select calendario_mio()`, 'authenticated', U(1))
  const clave = JSON.parse(mio.out || '{}').clave || ''
  check('la tuya se crea al pedirla: 64 cifras al azar, con torneos y eventos y sin lanzamientos', /^[0-9a-f]{64}$/.test(clave) && /"torneos": true/.test(mio.out) && /"lanzamientos": false/.test(mio.out), mio.out + mio.err)
  check('  …y pedirla otra vez da la misma', JSON.parse(q(`select calendario_mio()`, 'authenticated', U(1)).out).clave === clave)
  check('sin cuenta no se pide una', !q(`select calendario_mio()`, 'anon').ok)
  const cal = JSON.parse(q(`select calendario_de('${clave}')`, 'anon').out || 'null')
  check('con la clave y sin cuenta: tus torneos (no los que dejaste ni los cancelados), con sus jornadas', cal?.torneos?.length === 1 && cal.torneos[0].nombre === 'Liga FDN' && cal.torneos[0].jornadas.length === 2, JSON.stringify(cal))
  check('  …tus eventos con «Voy» (solo esos)', cal?.eventos?.length === 1 && cal.eventos[0].slug === 'trade-night')
  check('  …y sin lanzamientos si no los pediste', cal?.lanzamientos?.length === 0)
  q(`select calendario_poner(null, null, true)`, 'authenticated', U(1))
  const cal2 = JSON.parse(q(`select calendario_de('${clave}')`, 'anon').out || 'null')
  check('con lanzamientos: los que vienen de tus catálogos (no los viejos ni los de Japón si no tienes)', JSON.stringify(cal2?.lanzamientos?.map((s) => s.id)) === '["sv10"]', JSON.stringify(cal2?.lanzamientos))
  check('una clave que no existe o corta: nada', q(`select calendario_de('${'0'.repeat(64)}') is null and calendario_de('abc') is null`, 'anon').out === 't')
  const nueva = JSON.parse(q(`select calendario_cambiar_clave()`, 'authenticated', U(1)).out || '{}').clave
  check('cambiar la clave: otra, y la vieja deja de valer', nueva && nueva !== clave && q(`select calendario_de('${clave}') is null`, 'anon').out === 't' && q(`select calendario_de('${nueva}') is not null`, 'anon').out === 't')
  check('la tabla no se lee desde la web', !q(`select * from calendario_claves`, 'authenticated', U(1)).ok)
  psql(['-c', `drop database if exists ${BD}`])
} else check('hay un PostgreSQL en /var/tmp:5433', false)

console.log('── El .ics ──')
{
  const { icsDeCalendario, enlacesDeCalendario } = await import(`${REPO}/js/calendario-puro.js`)
  const ics = icsDeCalendario({
    torneos: [{ id: 't1', nombre: 'Liga FDN', empieza: '2026-11-16T18:00:00Z', jornadas: ['2026-11-19T18:00:00Z', '2026-11-26'] }, { id: 't2', nombre: 'Copa', empieza: '2026-12-01T10:00:00Z', jornadas: [] }],
    eventos: [{ id: 'e1', slug: 'trade-night', nombre: 'Trade night, Madrid', empieza: '2026-11-21T17:00:00Z', sitio: 'Cartas Sol' }],
    lanzamientos: [{ id: 'sv10', nombre: 'Ascended Heroes', dia: '2026-11-27', market: 'WEST' }],
  }, { ahora: new Date('2026-11-13T10:00:00Z') })
  const eventos = ics.split('BEGIN:VEVENT').length - 1
  check('un calendario con nombre y que se refresca solo', /^BEGIN:VCALENDAR\r\n/.test(ics) && /X-WR-CALNAME:PokeDoc/.test(ics) && /REFRESH-INTERVAL;VALUE=DURATION:PT6H/.test(ics) && /END:VCALENDAR\r\n$/.test(ics))
  check('una liga: una cita por jornada (con hora o de día entero); un torneo: su cita', eventos === 5 && /SUMMARY:Liga FDN · Jornada 1/.test(ics) && /DTSTART:20261119T180000Z/.test(ics) && /DTSTART;VALUE=DATE:20261126/.test(ics) && /SUMMARY:Torneo: Copa/.test(ics), ics)
  check('el evento con su sitio y su enlace (y la coma escapada)', /SUMMARY:Trade night\\, Madrid/.test(ics) && /URL:https:\/\/pokedoc\.es\/eventos\/trade-night/.test(ics))
  check('el lanzamiento, de día entero', /SUMMARY:Sale Ascended Heroes/.test(ics) && /DTSTART;VALUE=DATE:20261127/.test(ics) && /DTEND;VALUE=DATE:20261128/.test(ics))
  check('ninguna línea pasa de 75', ics.split('\r\n').every((l) => l.length <= 75))
  const e = enlacesDeCalendario('ab'.repeat(32), 'https://pokedoc.es')
  check('las direcciones: https, webcal (iPhone) y Google con cid', e.https === `https://pokedoc.es/cal/${'ab'.repeat(32)}.ics` && e.webcal.startsWith('webcal://pokedoc.es/cal/') && e.google === `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(e.webcal)}`)
}

console.log('── La función ──')
{
  const { responder, claveDeRuta } = await import(`${REPO}/netlify/functions/calendario.mjs`)
  check('lee la clave de la RUTA (la 633)', claveDeRuta(`/cal/${'a1'.repeat(32)}.ics`) === 'a1'.repeat(32) && claveDeRuta('/cal/../x.ics') === null && claveDeRuta('/cal/abc.ics') === null)
  let pedido = null
  const res = await responder(new Request(`https://pokedoc.es/cal/${'a1'.repeat(32)}.ics`), { fetchImpl: async (u, o) => { pedido = { u, o }; return new Response(JSON.stringify({ torneos: [], eventos: [], lanzamientos: [] })) } })
  check('con clave: un text/calendar privado, pedido a calendario_de con la clave', res.status === 200 && /text\/calendar/.test(res.headers.get('content-type')) && /private/.test(res.headers.get('cache-control')) && /rpc\/calendario_de$/.test(pedido.u) && JSON.parse(pedido.o.body).p_clave === 'a1'.repeat(32))
  const no = await responder(new Request(`https://pokedoc.es/cal/${'a1'.repeat(32)}.ics`), { fetchImpl: async () => new Response('null') })
  check('una clave que no existe: 404', no.status === 404)
  check('va detrás de /cal/* y con freno por IP', /from = "\/cal\/\*"\s*\n\s*to = "\/\.netlify\/functions\/calendario"/.test(leer('netlify.toml')) && /rateLimit: \{ windowLimit: 60/.test(leer('netlify/functions/calendario.mjs')))
  check('usa la clave pública de la casa (no otra)', /sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ/.test(leer('netlify/functions/calendario.mjs')))
}

console.log('── Ajustes › Calendario ──')
{
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    let clave = 'c0ffee'.repeat(10) + 'abcd'
    window.__RPC_RESPUESTAS__ = {
      calendario_mio: () => ({ clave, torneos: true, eventos: true, lanzamientos: false }),
      calendario_poner: (a) => { window.__PUESTO__ = a; return { clave, torneos: a.p_torneos, eventos: a.p_eventos, lanzamientos: a.p_lanzamientos } },
      calendario_cambiar_clave: () => { clave = 'beef'.repeat(16); return { clave, torneos: true, eventos: true, lanzamientos: false } },
    }
  })
  const p = await ctx.newPage(); const err = []
  p.on('pageerror', (e) => err.push(e.message))
  await p.goto(`${BASE}/ajustes.html?ver=calendario`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[data-cal]', { timeout: 6000 }).catch(() => {})
  const t = await p.evaluate(() => ({ h2: document.querySelector('#ajPanel h2')?.textContent, n: document.querySelectorAll('[data-cal]').length, url: document.getElementById('ajCalUrl')?.textContent, google: document.querySelector('.aj-cal-botones a')?.href, webcal: document.querySelectorAll('.aj-cal-botones a')[1]?.getAttribute('href') }))
  check('tres interruptores y tu dirección', t.h2 === 'Calendario' && t.n === 3 && /\/cal\/c0ffee.*\.ics$/.test(t.url), JSON.stringify(t))
  check('  …con «Suscribirme» en Google y en el iPhone', /calendar\.google\.com\/calendar\/r\?cid=webcal/.test(t.google) && /^webcal:\/\//.test(t.webcal), JSON.stringify(t))
  await p.locator('label:has([data-cal="lanzamientos"])').click()
  await p.waitForTimeout(300)
  check('encender lanzamientos lo guarda', await p.evaluate(() => window.__PUESTO__?.p_lanzamientos === true && window.__PUESTO__?.p_torneos === true))
  await p.click('#ajCalCambiar')
  check('cambiar la clave pide confirmar en el propio botón', /otra vez/.test(await p.locator('#ajCalCambiar').textContent()))
  await p.click('#ajCalCambiar')
  await p.waitForTimeout(300)
  check('  …y al confirmar, la dirección nueva', /\/cal\/(beef){16}\.ics$/.test(await p.locator('#ajCalUrl').textContent()))
  check('sin errores', !err.length, err.join(' | '))
  await b.close()
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
