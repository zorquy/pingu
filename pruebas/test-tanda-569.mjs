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

// Desde la 989 el menú es compacto: la baldosa entera es el enlace, con UNA
// línea de estado; el cuestionario ya no está (su sitio es «Parejas»).
const RUTAS = { carta: '/carta-del-dia', caro: '/mas-caro', silueta: '/quien-es', ordena: '/ordena-precio', expansion: '/que-expansion', parejas: '/parejas' }

console.log('── 2. Sin cuenta ──')
{
  const { page, errores } = await abrir({ sesion: 'none' })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('hay un h1 «Retos diarios»', (await page.locator('h1').textContent()).trim() === 'Retos diarios')
  const baldosas = await page.$$eval('.rt-reto', (as) => as.map((a) => [a.dataset.juego, a.getAttribute('href'), a.tagName]))
  check('seis retos, y la baldosa entera lleva a su juego', baldosas.length === 6 && baldosas.every(([j, h, t]) => t === 'A' && h === RUTAS[j]), JSON.stringify(baldosas))
  check('  …sin el cuestionario', (await page.locator('#rtHoy, [href="/reto"]').count()) === 0)
  check('sin jugar, cada una dice lo que da', /^Hasta \+50 XP · 6 intentos$/.test((await page.locator('#rtCartaEstado').innerText()).trim()), await page.locator('#rtCartaEstado').innerText())
  check('  …y arriba, que con cuenta cada reto da XP', /Crea tu cuenta/.test(await page.locator('#rtPerfectoTexto').innerText()) && /auth\.html/.test(await page.locator('#rtPerfectoTexto a').getAttribute('href')))
  await page.close()
}

console.log('── 3. Con cuenta ──')
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
  await page.addInitScript((hoy) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_RETOS_NUMEROS__ = { hoy: { carta: { aciertos: 1, total: 1, intentos: 2, acertada: true, xp: 45 } }, racha: 3, dias: { [hoy]: 1 }, jugados: 5, mejorRacha: 3, diasPerfectos: 0, xpHoy: 45 }
  }, hoy)
  await page.goto(`${BASE}/retos.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  const pildora = (await page.locator('#rtDia').innerText()).replace(/\s+/g, ' ')
  check('la píldora: cuántos hoy, la XP y la racha', /1\/6 hoy/.test(pildora) && /\+45 XP/.test(pildora) && /3 días/.test(pildora), pildora)
  check('la hecha, «Acertada en 2 · +45 XP» y su sello', /Acertada en 2 · \+45 XP/.test((await page.locator('#rtCartaEstado').textContent()).replace(/\s+/g, ' ')) && (await page.locator('#rtSello-carta.ok').count()) === 1)
  check('la barra del día perfecto, a un sexto', Math.round(await page.locator('#rtBarraDia').evaluate((i) => parseFloat(i.style.width))) === 17)
  check('  …y su frase con la cuenta atrás', /te faltan 5 \(\+25 XP\) · los de mañana salen en \d\d:\d\d:\d\d/.test(await page.locator('#rtPerfectoTexto').innerText()), await page.locator('#rtPerfectoTexto').innerText())
  check('sin «Compartir mi día» (988)', (await page.locator('[data-mi-dia], .rt-compartir-dia').count()) === 0)
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
