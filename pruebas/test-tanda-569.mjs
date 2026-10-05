// Tanda 569 — «Retos diarios»: el índice de los minijuegos.
//
// PINGU: «en Aprender, en vez de que te lleve al reto de hoy, una página
// que sea un índice de los minijuegos que tenemos, que se llamen retos
// diarios». Una tarjeta por juego con su estado de HOY, y la entrada del
// menú y del pie cambiada en TODAS las páginas: un menú que dice una cosa
// en una página y otra en la de al lado es dos menús.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { numeroDelDia } from '/home/user/pingu/js/reto-compartir.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const hoy = new Date().toISOString().slice(0, 10)
const diaMenos = (n) => { const [y, m, d] = hoy.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10) }

console.log('── 1. La entrada del menú, en todas las páginas ──')
{
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const conBarra = paginas.filter((p) => /<nav class="navbar"/.test(leer(p)))
  const sinNueva = conBarra.filter((p) => !/href="\/retos">Retos diarios<\/a>/.test(leer(p)))
  const conVieja = paginas.filter((p) => /href="\/curso\.html\?reto=hoy">Reto de hoy<\/a>/.test(leer(p)))
  check('toda página con barra enlaza a /retos como «Retos diarios»', sinNueva.length === 0, sinNueva.join(', '))
  check('  …y ninguna conserva la entrada vieja', conVieja.length === 0, conVieja.join(', '))
  check('el sitemap lista /retos', /\['\/retos'/.test(leer('netlify/functions/sitemap.mjs')))
  // La portada SIGUE llevando al reto directamente desde su tarjeta: eso
  // no es el menú, es el juego.
  check('la portada sigue con su botón al reto', /reto-hoy-boton/.test(leer('js/home.js')))
}

const browser = await chromium.launch()
async function abrir({ sesion, retos = [] }) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, r]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_RETOS__ = r
  }, [sesion, retos])
  await page.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, errores }
}

console.log('── 2. Sin cuenta ──')
{
  const { page, errores } = await abrir({ sesion: 'none' })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('hay un h1 «Retos diarios»', (await page.locator('h1').textContent()).trim() === 'Retos diarios')
  // Tres desde la 583 («¿Más caro o más barato?»).
  check('tres retos en la lista', (await page.locator('.rt-reto').count()) === 3)
  const boton = page.locator('#rtHoyEstado a')
  check('el de hoy manda a crear cuenta', /auth\.html/.test((await boton.getAttribute('href')) || ''), await boton.getAttribute('href'))
  check('  …y dice el número del día', (await page.locator('#rtHoyEstado').innerText()).includes(`Reto #${numeroDelDia(hoy)}`))
  // Desde la 570 se juega: su tarjeta lleva al juego.
  check('«¿Qué carta es?» lleva al juego', (await page.locator('#rtCartaEstado a').getAttribute('href')) === '/carta-del-dia')
  await page.close()
}

console.log('── 3. Con cuenta y sin jugar hoy ──')
{
  const { page } = await abrir({ sesion: 'admin-1', retos: [diaMenos(1), diaMenos(2)].map((d, i) => ({ id: `r${i}`, user_id: 'admin-1', day: d, correct: 4, total: 5, score: 40 })) })
  const boton = page.locator('#rtHoyEstado a')
  check('el botón lleva a /reto', (await boton.getAttribute('href')) === '/reto', await boton.getAttribute('href'))
  // Sin el de hoy no hay racha que enseñar: la racha cuenta hasta hoy.
  check('sin el de hoy, no presume de racha', (await page.locator('.rt-chip-racha').count()) === 0)
  await page.close()
}

console.log('── 4. Con cuenta y ya jugado ──')
{
  const { page } = await abrir({ sesion: 'admin-1', retos: [hoy, diaMenos(1), diaMenos(2)].map((d, i) => ({ id: `r${i}`, user_id: 'admin-1', day: d, correct: i ? 4 : 3, total: 5, score: 40 })) })
  const texto = await page.locator('#rtHoyEstado').innerText()
  check('enseña tu marca de hoy', /3 de 5/.test(texto), texto)
  check('  …y la racha contando hoy', /3 días seguidos/.test(texto), texto)
  check('  …con tres puntos acertados', (await page.locator('.rt-punto.acertado').count()) === 3)
  check('  …y manda a la liga, no a jugar otra vez', /usuarios\.html/.test((await page.locator('#rtHoyEstado a').getAttribute('href')) || ''))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
