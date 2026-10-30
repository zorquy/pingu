// Tanda 1117 — «Logros» como único nombre del perfil y la ficha de cada logro
// (PINGU: «en el perfil público está medallas, después pone trofeos y también
// logro destacado… vamos a ponerle logros»; «cuando cliques en uno te salga
// un pop-up con ese logro y qué has hecho para conseguirlo o cuál es el
// objetivo»).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}

console.log('── Lo puro ──')
{
  const { objetivoDeLogro } = await import(`${RAIZ}/js/logro-objetivo.js`)
  check('el objetivo sale de la condición', objetivoDeLogro({ condition: { type: 'collection_sets_complete', count: 5 } }) === 'Completa 5 expansiones enteras.' && objetivoDeLogro({ condition: { type: 'forum_posts_count', count: 1 } }) === 'Escribe tu primer mensaje en el foro.')
  check('  …los de torneo, por su id', objetivoDeLogro({ id: 'torneo_campeon', condition: { type: 'manual' } }) === 'Gana un torneo de PokeDoc.')
  check('  …y lo que no se sabe decir, null (se enseña la descripción)', objetivoDeLogro({ id: 'raro', condition: { type: 'manual' } }) === null)
}

console.log('── Un solo nombre ──')
for (const pagina of ['perfil.html', 'usuario.html']) {
  const h = readFileSync(`${RAIZ}/${pagina}`, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  check(`${pagina}: pestaña «Logros», sin «Medallas» ni «Trofeos»`, /data-ptab="logros"[^>]*>Logros</.test(h) && !/>Medallas</.test(h) && !/>Trofeos /.test(h) && /section-title">Logros </.test(h))
}

const LOGROS = [
  { id: 'torneo_jugado', title: 'Competidor', description: 'Jugaste un torneo de PokeDoc hasta el final.', emoji: 'trophy', rarity: 'bronze', xp_reward: 40, is_active: true, condition: { type: 'manual' } },
  { id: 'coleccion_100', title: 'Cien cartas', description: 'Tienes 100 cartas distintas en tu colección.', emoji: 'layers', rarity: 'silver', xp_reward: 25, is_active: true, condition: { type: 'collection_cards_count', count: 100 } },
]
const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'user-1', movil = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ sesion, LOGROS }) => { window.__FAKE_SESSION__ = sesion; window.__FAKE_LOGROS__ = LOGROS }, { sesion, LOGROS })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { ctx, page, errores }
}
const ficha = (page) => page.evaluate(() => {
  const d = document.querySelector('dialog.logro-ficha')
  return d ? { abierta: d.open, titulo: d.querySelector('h2')?.textContent, estado: d.querySelector('.logro-ficha-estado')?.textContent.trim(), texto: d.querySelector('.logro-ficha-texto')?.textContent.replace(/\s+/g, ' ').trim(), destacar: !!d.querySelector('[data-logro-destacar]'), compartir: !!d.querySelector('[data-logro-compartir]') } : null
})

console.log('── Tu perfil ──')
{
  const { ctx, page, errores } = await abrir('/perfil.html?ver=medallas')
  check('un enlace viejo (?ver=medallas) abre «Logros»', await page.locator('#profileTabs [data-ptab="logros"][aria-selected="true"]').count() === 1)
  await page.click('#achievementsGrid [data-logro="coleccion_100"]')
  await page.waitForTimeout(500)
  const f1 = await ficha(page)
  check('uno que no tienes: «Aún no lo tienes» y cómo se consigue', f1?.abierta && /Aún no lo tienes/.test(f1.estado) && /Cómo se consigue\s*Ten 100 cartas distintas/.test(f1.texto) && !f1.destacar, JSON.stringify(f1))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  await page.click('#achievementsGrid [data-logro="torneo_jugado"]')
  await page.waitForTimeout(500)
  const f2 = await ficha(page)
  check('uno que tienes: «Lo tienes», lo que hiciste, destacar y compartir', f2?.abierta && /Lo tienes/.test(f2.estado) && /Lo que hiciste\s*Jugaste un torneo/.test(f2.texto) && f2.destacar && f2.compartir, JSON.stringify(f2))
  const centrada = await page.$eval('dialog.logro-ficha', (d) => { const r = d.getBoundingClientRect(); return Math.abs(r.left + r.width / 2 - innerWidth / 2) < 4 && Math.abs(r.top + r.height / 2 - innerHeight / 2) < 4 })
  check('  …centrada en el PC', centrada)
  await page.click('[data-logro-destacar]')
  await page.waitForTimeout(800)
  const guardado = await page.evaluate(() => window.__TABLAS__.user_profiles.find((p) => p.id === 'user-1')?.showcase_achievement)
  check('«Destacar en mi perfil» lo guarda y lo dice la línea del destacado', guardado === 'torneo_jugado' && /Logro destacado: Competidor/.test(await page.locator('#logroDestacado').innerText()), guardado)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── El perfil de otra persona ──')
{
  const { ctx, page, errores } = await abrir('/usuario.html?u=Ash', { sesion: 'user-2' })
  await page.click('#profileTabs [data-ptab="logros"]')
  await page.click('#achievementsGrid [data-logro="torneo_jugado"]')
  await page.waitForTimeout(500)
  const f = await ficha(page)
  check('«Lo tiene Ash» y lo que hizo, sin destacar ni compartir', f?.abierta && /Lo tiene Ash/.test(f.estado) && /Lo que hizo/.test(f.texto) && !f.destacar && !f.compartir, JSON.stringify(f))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── En el móvil ──')
{
  const { ctx, page } = await abrir('/perfil.html?ver=logros', { movil: true })
  await page.click('#achievementsGrid [data-logro="coleccion_100"]')
  await page.waitForTimeout(500)
  const abajo = await page.$eval('dialog.logro-ficha', (d) => Math.abs(d.getBoundingClientRect().bottom - innerHeight) < 2)
  check('la ficha sale desde abajo', abajo)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
