// Tanda 790 — bloque 11 de «PokeDoc al detalle»: entrar (PA17), la semana de
// torneos (PA15), los interruptores y chips de sí/no (SI7) y Jugar al día
// (PA14: constructor con anillo de 60 y formato en chips, Mis partidas en
// pastilla, Laboratorio y Repeticiones a lo ancho con «Pegar»).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. En el código ──')
const auth = leer('auth.html')
check('entrar: «Hola de nuevo» y Google antes del email (PA17)', /Hola de nuevo/.test(auth) && auth.indexOf('auth-o') > 0 && /class="auth-ventajas"/.test(auth))
check('torneos: la tira de la semana antes de la lista (PA15)', leer('torneos.html').indexOf('id="torneosSemana"') < leer('torneos.html').indexOf('id="listaTorneos"'))
check('constructor: las casillas son interruptores (SI7)', /\.cm-check input \{\s*appearance: none;/.test(leer('css/constructor.css')))
check('constructor: el formato en chips (SI7)', /chipsDeSelect\(\$\('cmFormato'\)/.test(leer('js/constructor.js')))
check('constructor: el anillo de 60 (PA14)', /--lleno/.test(leer('js/constructor.js')) && /conic-gradient\(var\(--anillo\) var\(--lleno\)/.test(leer('css/constructor.css')))
check('Mis partidas: pestañas en pastilla (PA14)', /class="seg partidas-tabs" id="partidasTabs"/.test(leer('mis-partidas.html')) && !/tab-btn/.test(leer('mis-partidas.html')))
check('Laboratorio y Repeticiones: «Pegar» (PA14)', /id="lpPegar"/.test(leer('laboratorio.html')) && /id="repPegarBoton"/.test(leer('repeticiones.html')))

console.log('── 2. En el navegador ──')
const b = await chromium.launch()
{
  const p = await b.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const { semanaDeTorneos } = await import('/js/torneos/torneos.js')
    const ahora = new Date(2026, 9, 9, 10, 0)
    const dias = semanaDeTorneos([
      { slug: 'a', status: 'open', start_at: new Date(2026, 9, 11, 18, 0).toISOString() },
      { slug: 'b', status: 'open', start_at: new Date(2026, 9, 11, 16, 30).toISOString() },
      { slug: 'c', status: 'draft', start_at: new Date(2026, 9, 12, 18, 0).toISOString() },
      { slug: 'd', status: 'open', start_at: new Date(2026, 9, 20, 18, 0).toISOString() },
    ], ahora)
    return { n: dias.length, hoy: dias[0].nombre, sab: dias[2].torneos.map((t) => t.slug), hora: dias[2].primera, dom: dias[3].torneos.length }
  })
  check('la semana: siete días desde hoy', r.n === 7 && r.hoy === 'hoy', JSON.stringify(r))
  check('  …con los de cada día por hora y sin borradores', r.sab.join() === 'b,a' && r.hora === '16:30' && r.dom === 0, JSON.stringify(r))
  await p.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/constructor.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.chips-de-select', { timeout: 8000 }).catch(() => {})
  const c = await p.evaluate(() => {
    const caja = document.querySelector('.chips-de-select')
    if (!caja) return null
    const antes = [...caja.querySelectorAll('[aria-pressed="true"]')].map((x) => x.dataset.valor)
    caja.querySelector('[data-valor="expanded"]').click()
    return { botones: caja.querySelectorAll('button').length, antes, valor: document.getElementById('cmFormato').value, marcado: caja.querySelector('[aria-pressed="true"]')?.dataset.valor, libre: caja.querySelector('[data-valor="libre"]').textContent }
  })
  check('constructor: tres chips, uno marcado, y el desplegable los sigue', c?.botones === 3 && c.antes.length === 1 && c.valor === 'expanded' && c.marcado === 'expanded', JSON.stringify(c))
  check('  …con el rótulo corto («Libre», sin el paréntesis)', c?.libre === 'Libre', JSON.stringify(c))
  const anillo = await p.evaluate(() => getComputedStyle(document.getElementById('cmTotal'), '::before').backgroundImage)
  check('constructor: el anillo se dibuja', /conic-gradient/.test(anillo), anillo)

  await p.goto(`${BASE}/laboratorio.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  const l = await p.evaluate(() => [...document.querySelectorAll('.lp-bloque')].map((x) => Math.round(x.getBoundingClientRect().top)))
  check('laboratorio en el PC: las tres puertas en una fila', l.length === 3 && new Set(l).size === 1, JSON.stringify(l))
  await ctx.close()
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/mis-partidas.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1500)
  await p.click('#partidasTabs [data-vista="stats"]').catch(() => {})
  const m = await p.evaluate(() => ({
    marcado: document.querySelector('#partidasTabs [aria-pressed="true"]')?.dataset.vista,
    vista: document.getElementById('vista-stats')?.classList.contains('active'),
  }))
  check('Mis partidas: la pastilla marca la vista que se abre', m.marcado === 'stats' && m.vista, JSON.stringify(m))
  await ctx.close()
}
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
