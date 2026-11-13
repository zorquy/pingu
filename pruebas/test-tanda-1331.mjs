// Tanda 1331 — Las tiendas organizan sus torneos (G11 del plan 2027): el precio
// de la inscripción (informativo) en la base, lo puro, las puertas de una tienda
// (/torneos y /torneo), la pestaña «Torneos» del panel y la chapa «Torneo de
// tienda» en /torneos.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const leer = (f) => readFileSync(`${REPO}/${f}`, 'utf8')

console.log('── La base ──')
const mig = leer('supabase-migration-1331-torneos-de-tienda.sql')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
if (psql(['-c', 'select 1']).status === 0) {
  const BD = 'prueba_1331'
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const q = (s) => { const r = psql(['-At', '-d', BD, '-v', 'ON_ERROR_STOP=1', '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  q('create table tournaments (id serial primary key, name text, status text)')
  const una = q(mig)
  const dos = q(mig)
  check('la migración entra y se puede repetir', una.ok && dos.ok, una.err || dos.err)
  check('  …la columna existe y es numérica', q("select data_type from information_schema.columns where table_name = 'tournaments' and column_name = 'precio_entrada'").out === 'numeric')
  check('  …acepta 10, 0 y NULL', q("insert into tournaments (name, precio_entrada) values ('a', 10), ('b', 0), ('c', null)").ok)
  check('  …y rechaza un negativo y más de 1.000', !q("insert into tournaments (name, precio_entrada) values ('d', -1)").ok && !q("insert into tournaments (name, precio_entrada) values ('e', 2000)").ok)
  psql(['-c', `drop database if exists ${BD}`])
} else console.log('  (sin PostgreSQL de pruebas: se salta la base)')

console.log('── Lo puro ──')
const { esTorneoDeTienda, textoDePrecio, precioDelCampo, proximosDeTienda, cifrasDeTorneos } = await import(`${REPO}/js/torneos/torneo-tienda.js`)
check('«10 € en tienda», «5,5 € inscripción», «Gratis» y nada si no se dice', textoDePrecio(10, { deTienda: true }) === '10 € en tienda' && textoDePrecio('5.5') === '5,5 € inscripción' && textoDePrecio(0) === 'Gratis' && textoDePrecio(null) === null && textoDePrecio('') === null)
check('el campo: «10,50» → 10.5, vacío → null, lo que no es un precio → undefined', precioDelCampo('10,50') === 10.5 && precioDelCampo('7 €') === 7 && precioDelCampo('') === null && precioDelCampo('-3') === undefined && precioDelCampo('abc') === undefined && precioDelCampo('5000') === undefined)
check('es de tienda si quien lo creó es una cuenta de tienda', esTorneoDeTienda({ admin_id: 't' }, { t: { tipo: 'tienda' } }) && !esTorneoDeTienda({ admin_id: 'p' }, { p: { tipo: null } }) && !esTorneoDeTienda({ admin_id: 'x' }, {}))
const ahora = new Date('2026-11-13T12:00:00Z')
const T = [
  { id: 1, status: 'finished', start_at: '2026-11-01T10:00:00Z' },
  { id: 2, status: 'registration_open', start_at: '2026-11-20T10:00:00Z' },
  { id: 3, status: 'in_progress', start_at: '2026-11-13T09:00:00Z' },
  { id: 4, status: 'draft', start_at: '2026-11-15T10:00:00Z' },
  { id: 5, status: 'registration_open', start_at: '2026-11-16T10:00:00Z' },
]
check('próximos: el que está en juego primero, luego por fecha, sin terminados ni borradores', proximosDeTienda(T, { ahora }).map((t) => t.id).join() === '3,5,2')
check('  …con borradores en el panel', proximosDeTienda(T, { ahora, conBorradores: true }).map((t) => t.id).join() === '3,4,5,2')
const c = cifrasDeTorneos(T, [{ tournament_id: 1, user_id: 'a' }, { tournament_id: 3, user_id: 'a' }, { tournament_id: 3, user_id: 'b' }, { tournament_id: 99, user_id: 'z' }],
  [{ creado: '2026-11-01T15:00:00Z', total: 300 }, { creado: '2026-11-13T10:00:00Z', total: 100 }, { creado: '2026-11-05T15:00:00Z', total: 100 }, { creado: '2026-11-06T15:00:00Z', total: 100 }], { ahora })
check('cifras: torneos del mes sin borradores, jugadores distintos y +100 % en días de torneo', c.esteMes === 4 && c.jugadores === 2 && c.mejora === 100, JSON.stringify(c))
check('  …sin días de los dos tipos, la mejora no se sabe (null), no es cero', cifrasDeTorneos(T, [], [], { ahora }).mejora === null)

console.log('── Las puertas y el panel de la tienda ──')
const { puedeAbrirTienda } = await import(`${REPO}/js/tienda-puertas.js`)
check('una tienda puede abrir /torneos y /torneo (y sigue sin abrir /foro)', puedeAbrirTienda('/torneos', '', {}) && puedeAbrirTienda('/torneo', '?slug=x', {}) && !puedeAbrirTienda('/foro', '', {}))
const { SECCIONES_DE_TIENDA, seccionDeTienda } = await import(`${REPO}/js/tienda-marco.js`)
check('«Torneos» es una sección de su panel, y /torneos y /torneo son de ella', SECCIONES_DE_TIENDA.some((s) => s.nombre === 'Torneos' && s.ver === 'torneos') && seccionDeTienda('/torneos', '') === 'Torneos' && seccionDeTienda('/torneo', '?slug=x') === 'Torneos' && seccionDeTienda('/tienda', '?ver=torneos') === 'Torneos')
const html = leer('tienda.html')
check('tienda.html lleva su pestaña y su hoja', /data-td="torneos"/.test(html) && /data-td-hoja="torneos"/.test(html) && /id="tdTorneos"/.test(html))
check('el formulario de crear y el editor llevan la inscripción', /id="torneoPrecio"/.test(leer('torneos.html')) && /id="editarPrecio"/.test(leer('js/torneos/torneo-editor.js')))
check('crear y editar se guardan sin la migración (reintento sin la columna)', /'prizes', 'precio_entrada'\]/.test(leer('js/torneos/torneos.js')) && /'prizes', 'precio_entrada'\]/.test(leer('js/torneos/torneo-editor.js')))

console.log('── /torneos con un torneo de tienda ──')
const TIENDA = { id: 'tienda-1', username: 'cartassol', tipo: 'tienda' }
const TORNEOS = [
  { id: 't1', slug: 'copa-delta', name: 'Copa Delta Reign', format: 'swiss', status: 'registration_open', swiss_rounds: 4, max_players: 32, start_at: '2027-01-16T10:30:00Z', admin_id: 'tienda-1', precio_entrada: 10 },
  { id: 't2', slug: 'quedada', name: 'Quedada del barrio', format: 'swiss', status: 'registration_open', swiss_rounds: 3, max_players: 16, start_at: '2027-01-17T10:30:00Z', admin_id: 'p9', precio_entrada: null },
]
const b = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(({ TORNEOS, TIENDA }) => {
    window.__FAKE_TORNEOS__ = TORNEOS
    window.__FAKE_INSCRIPCIONES__ = []
    window.__FAKE_PERFILES__ = [TIENDA, { id: 'p9', username: 'mar' }]
  }, { TORNEOS, TIENDA })
  const page = await ctx.newPage()
  const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.torneo-tarjeta', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => [...document.querySelectorAll('.torneo-tarjeta')].map((t) => ({ nombre: t.querySelector('.torneo-nombre')?.textContent, tienda: Boolean(t.querySelector('.torneo-de-tienda')), precio: t.querySelector('.torneo-etiqueta-precio')?.textContent || null })))
  const q = movil ? 'móvil' : 'PC'
  const copa = r.find((x) => x.nombre === 'Copa Delta Reign')
  const quedada = r.find((x) => x.nombre === 'Quedada del barrio')
  check(`${q}: la de la tienda lleva «Torneo de tienda» y «10 € en tienda»`, copa?.tienda && copa?.precio === '10 € en tienda', JSON.stringify(r))
  check('  …la de una persona, ni chapa ni precio (no lo dijo)', quedada && !quedada.tienda && !quedada.precio, JSON.stringify(quedada))
  check('  …sin errores', err.length === 0, err.join(' | '))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
