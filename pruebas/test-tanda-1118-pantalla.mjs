// Tanda 1118 — el panel de Logros de /admin, en pantalla: la rejilla con sus
// familias y cuánta gente tiene cada uno, el editor en el cajón (con un tipo
// de los retos, que el formulario viejo cambiaba a «Cursos completados» al
// guardar), la frase en vivo, crear, duplicar y «Quién lo tiene» con dar y
// quitar a mano.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const LOGROS = [
  { id: 'torneo_jugado', title: 'Competidor', description: 'Jugaste un torneo de PokeDoc hasta el final.', emoji: 'trophy', rarity: 'bronze', xp_reward: 40, is_active: true, condition: { type: 'manual' } },
  { id: 'retos_semana', title: 'Semana en llamas', description: 'Jugaste algún reto diario siete días seguidos.', emoji: 'flame', rarity: 'bronze', xp_reward: 50, is_active: true, condition: { type: 'retos_racha', count: 7 } },
  { id: 'coleccion_cinco', title: 'Cinco sets completos', description: '', emoji: 'crown', rarity: 'platinum', xp_reward: 150, is_active: true, condition: { type: 'collection_sets_complete', count: 5 } },
  { id: 'viejo', title: 'Uno apagado', description: '', emoji: 'star', rarity: 'silver', xp_reward: 10, is_active: false, condition: { type: 'forum_posts_count', count: 50 } },
]
const browser = await browser0()
async function browser0() { return chromium.launch() }
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript((L) => { window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_LOGROS__ = L }, LOGROS)
await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
// Las vistas previas de Correos (iframes con `sandbox`) dan este error en
// cualquier sección del admin, desde antes de la 1118: no es de este panel.
page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'/.test(String(e))) errores.push(String(e).slice(0, 180)) })
await page.goto(`${BASE}/admin/?ver=achievements`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.lg-tarjeta', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(800)

console.log('── La rejilla ──')
const tarjetas = await page.$$eval('.lg-tarjeta', (els) => els.map((e) => ({ id: e.dataset.lg, txt: e.innerText.replace(/\s+/g, ' ') })))
check('los cuatro logros, con su «cómo se consigue»', tarjetas.length === 4 && tarjetas.some((t) => /Semana en llamas.*Juega algún reto diario 7 días seguidos/.test(t.txt)), JSON.stringify(tarjetas))
check('  …cuánta gente lo tiene (Ash tiene «Competidor»)', /Competidor.*%/.test(tarjetas.find((t) => t.id === 'torneo_jugado')?.txt || ''), tarjetas.find((t) => t.id === 'torneo_jugado')?.txt)
check('  …«Nadie lo tiene» y «Apagado» a la vista', /Nadie lo tiene/.test(tarjetas.find((t) => t.id === 'coleccion_cinco')?.txt || '') && /Apagado/.test(tarjetas.find((t) => t.id === 'viejo')?.txt || ''))
const chips = await page.$$eval('[data-lg-filtro]', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
check('filtros por familia, solo los que tienen algo', chips.join('|') === 'Todos 4|Foro 1|Colección 1|Retos 1|Torneos 1|Nadie lo tiene 3|Apagados 1', chips.join('|'))
await page.click('[data-lg-filtro="retos"]')
check('  …«Retos» deja solo el de los retos', (await page.$$eval('.lg-tarjeta', (els) => els.map((e) => e.dataset.lg))).join() === 'retos_semana')
await page.click('[data-lg-filtro="todos"]')
await page.fill('#lgBuscar', 'cinco')
check('  …y el buscador busca', (await page.$$eval('.lg-tarjeta', (els) => els.map((e) => e.dataset.lg))).join() === 'coleccion_cinco')
await page.fill('#lgBuscar', '')

console.log('── El editor ──')
await page.click('.lg-tarjeta[data-lg="retos_semana"]')
await page.waitForTimeout(300)
check('se abre en el cajón con su tipo de los retos elegido (no el primero)', (await page.inputValue('#lgTipo')) === 'retos_racha' && (await page.inputValue('#lgCuenta')) === '7')
await page.fill('#lgCuenta', '14')
check('la frase cambia mientras escribes', /Juega algún reto diario 14 días seguidos/.test(await page.textContent('#lgFrase')))
check('  …y la vista previa también', /14 días seguidos/.test(await page.textContent('#lgPrevia')))
await page.click('[data-lg-rareza="gold"]')
await page.click('[data-lg-icono="crown"]')
await page.click('#lgForm button[type="submit"]')
await page.waitForTimeout(900)
const guardado = await page.evaluate(() => window.__TABLAS__.achievement_definitions.find((d) => d.id === 'retos_semana'))
check('guardar escribe la regla, la rareza y el icono (y no cambia el tipo)', guardado?.condition?.type === 'retos_racha' && guardado.condition.count === 14 && guardado.rarity === 'gold' && guardado.emoji === 'crown', JSON.stringify(guardado))

await page.click('[data-lg-duplicar]')
await page.waitForTimeout(300)
check('duplicar abre una copia con su clave libre, apagada', (await page.inputValue('#lgId')) === 'retos_semana_2' && !(await page.isChecked('#lgActivo')) && /\(copia\)/.test(await page.inputValue('#lgTitulo')))
await page.fill('#lgId', 'torneo_jugado')
await page.click('#lgForm button[type="submit"]')
await page.waitForTimeout(500)
check('  …con una clave que ya existe no se guarda (no pisa el otro)', (await page.evaluate(() => window.__TABLAS__.achievement_definitions.find((d) => d.id === 'torneo_jugado')?.title)) === 'Competidor')
await page.fill('#lgId', 'retos_quincena')
await page.fill('#lgTitulo', 'Quincena en llamas')
await page.click('#lgForm button[type="submit"]')
await page.waitForTimeout(900)
check('  …y con una nueva, se crea', (await page.evaluate(() => window.__TABLAS__.achievement_definitions.find((d) => d.id === 'retos_quincena')?.condition?.count)) === 14 && (await page.$$('.lg-tarjeta')).length === 5)

console.log('── Quién lo tiene ──')
await page.click('.lg-tarjeta[data-lg="torneo_jugado"]')
await page.click('[data-lg-pestana="quien"]')
await page.waitForTimeout(800)
check('la lista de quién lo tiene', /Ash/.test(await page.textContent('#lgQuien')), (await page.textContent('#lgQuien')).slice(0, 200))
await page.fill('#lgDarQuien', '@Misty')
await page.fill('#lgDarMotivo', 'Premio del sorteo')
await page.click('#lgDar button[type="submit"]')
await page.waitForTimeout(1200)
const misty = await page.evaluate(() => window.__TABLAS__.user_profiles.find((p) => p.username === 'Misty'))
check('«Dar» se lo da a Misty, y sale en la lista con el motivo', (misty?.achievements || []).includes('torneo_jugado') && /Misty[\s\S]*Premio del sorteo/.test(await page.textContent('#lgQuien')), JSON.stringify(misty?.achievements))
page.once('dialog', (d) => d.accept('Fue un error'))
await page.click(`[data-lg-quitar="${misty.id}"]`)
await page.waitForTimeout(1200)
check('«Quitar» se lo quita', !(await page.evaluate(() => window.__TABLAS__.user_profiles.find((p) => p.username === 'Misty')?.achievements || [])).includes('torneo_jugado'))

console.log('── Estrecho ──')
await page.setViewportSize({ width: 900, height: 900 })
await page.click('[data-lg-pestana="datos"]')
await page.waitForTimeout(300)
const sinDesborde = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
check('a 900 px el cajón va encima de la rejilla, sin salirse', sinDesborde && (await page.$eval('.lg-cajon', (e) => e.getBoundingClientRect().top)) < (await page.$eval('.lg-rejilla', (e) => e.getBoundingClientRect().top)))
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
