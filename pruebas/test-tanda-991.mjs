// Tanda 991 — «¿Quién es ese Pokémon?»: el primer intento, borroso; cada
// fallo lo aclara. Y la XP sube: +30 a la primera, +20 a la segunda, +10 a la
// tercera (antes +20/+10/+5). Y fuera /admin → Redes (PINGU: «no sirve de
// nada»).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const AQUI = dirname(fileURLToPath(import.meta.url))
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
const X = await import(`${RAIZ}/js/retos-xp.js`)
check('+30 a la primera, +20 a la segunda, +10 a la tercera, 0 sin acertar', [1, 2, 3].map((i) => X.xpDe('silueta', { acertada: true, intentos: i })).join() === '30,20,10' && X.xpDe('silueta', { acertada: false, intentos: 3 }) === 0)
check('  …y lo que vale ahora, antes de cada intento', [0, 1, 2].map((f) => X.xpSiAciertasSilueta(f)).join() === '30,20,10')
const reto = X.RETOS.find((r) => r.juego === 'silueta')
check('el menú lo dice: «Hasta +30 XP» y que sale borroso', reto.chips[0] === 'Hasta +30 XP' && /borrosa/.test(reto.texto) && /Hasta \+30 XP · 3 intentos/.test(leer('retos.html')))

console.log('\n── 2. La migración ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_991'
if (psql(['-c', 'select 1']).status === 0) {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  psql(['-d', BD, '-f', join(AQUI, 'sql-tanda-835.sql')])
  psql(['-d', BD, '-f', join(RAIZ, 'supabase-migration-retos-xp.sql')])
  psql(['-d', BD, '-f', join(RAIZ, 'supabase-migration-989-parejas.sql')])
  let r = psql(['-d', BD, '-f', join(RAIZ, 'supabase-migration-991-quien-es.sql')])
  check('la 991 carga detrás de la 989', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(RAIZ, 'supabase-migration-991-quien-es.sql')])
  check('  …y se puede ejecutar otra vez', r.status === 0, r.stderr)
  const q = (s) => (psql(['-t', '-A', '-d', BD, '-c', s]).stdout || '').trim()
  const casos = []
  for (let i = 1; i <= 5; i++) for (const ac of [true, false]) casos.push([i, ac])
  const base = q(casos.map(([i, ac]) => `select public.retos_xp('silueta', 0, 0, ${i}, ${ac}, null)`).join(' union all ')).split('\n').map(Number)
  const distintos = casos.filter(([i, ac], k) => X.xpDe('silueta', { intentos: i, acertada: ac }) !== base[k])
  check('la base da lo mismo que la web para la silueta', base.length === casos.length && !distintos.length, `${base.join(',')} · distintos ${JSON.stringify(distintos)}`)
  check('  …y Parejas sigue como en la 989 (9 movimientos, 20)', q(`select public.retos_xp('parejas', 6, 6, 9, true, null)`) === '20')
  psql(['-c', `drop database if exists ${BD}`])
} else check('hay un PostgreSQL en /var/tmp:5433 donde probar', false)

console.log('\n── 3. En pantalla ──')
const browser = await chromium.launch()
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="475" height="475"><circle cx="237" cy="260" r="160" fill="#e8b000"/></svg>'
  await page.route(/official-artwork/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: svg }))
  await page.goto(`${BASE}/quien-es.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const borrosidad = () => page.evaluate(() => { const f = getComputedStyle(document.getElementById('qeDibujo')).filter; const m = f.match(/blur\(([\d.]+)px\)/); return { intento: document.getElementById('qeEscena').dataset.intento, blur: m ? Number(m[1]) : 0, negro: /brightness\(0\)/.test(f), bote: document.getElementById('qeBote').textContent, sub: document.getElementById('qeSub').textContent } })
  const uno = await borrosidad()
  check('el primer intento, borroso y en negro, y avisado', uno.intento === '1' && uno.blur >= 10 && uno.negro && /borroso/.test(uno.sub), JSON.stringify(uno))
  check('  …y vale +30', /\+30 XP/.test(uno.bote), uno.bote)
  const buena = await page.evaluate(async () => { const m = await import('/js/quien-es.js'); const d = await import('/js/reto-diario.js'); return String(m.pokemonDelDia(d.hoyISO())) })
  const malas = (await page.$$eval('.qe-opcion', (bs) => bs.map((b) => b.dataset.dex))).filter((d) => d !== buena)
  await page.click(`.qe-opcion[data-dex="${malas[0]}"]`)
  await page.waitForTimeout(400)
  const dos = await borrosidad()
  check('tras un fallo, menos borroso, y vale +20', dos.intento === '2' && dos.blur > 0 && dos.blur < uno.blur && /\+20 XP/.test(dos.bote), JSON.stringify(dos))
  await page.click(`.qe-opcion[data-dex="${malas[1]}"]`)
  await page.waitForTimeout(400)
  const tres = await borrosidad()
  check('tras dos, la silueta nítida de siempre, y vale +10', tres.intento === '3' && tres.blur === 0 && tres.negro && /\+10 XP/.test(tres.bote), JSON.stringify(tres))
  await page.click(`.qe-opcion[data-dex="${buena}"]`)
  await page.waitForTimeout(600)
  const fin = await borrosidad()
  check('al acertar se ve en color, sin borrón', !fin.negro && fin.blur === 0, JSON.stringify(fin))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. Fuera /admin → Redes ──')
check('sin botón ni sección en /admin', !/data-section="redes"/.test(leer('admin/index.html')) && !/section-redes/.test(leer('admin/index.html')) && !/redes\.js/.test(leer('admin/js/admin.js')))
check('  …ni sus módulos ni su CSS', !existsSync(`${RAIZ}/admin/js/redes.js`) && !existsSync(`${RAIZ}/js/redes-carrusel.js`) && !/\.redes-/.test(leer('admin/css/admin.css')))
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const secciones = await page.$$eval('.admin-nav-item', (bs) => bs.map((b) => b.dataset.section))
  check('/admin abre bien y sin Redes en el menú', secciones.length > 3 && !secciones.includes('redes') && !errores.length, `${secciones.join(',')} ${errores.join(' | ')}`)
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
