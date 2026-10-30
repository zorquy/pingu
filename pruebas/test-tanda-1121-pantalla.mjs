// Tanda 1121 — /admin → Usuarios en pantalla: la lista con chips y buscador,
// la ficha en el cajón (roles como interruptores que escriben ya, silenciar
// con motivo y duración y quitarlo, dar y quitar un logro, el título del
// foro), sin «Pro», sin la migración (como antes, a pelo) y en el móvil.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const LOGROS = [
  { id: 'sorteo', title: 'Ganó el sorteo', description: '', emoji: 'trophy', rarity: 'gold', xp_reward: 30, is_active: true, condition: { type: 'manual' } },
  { id: 'foro_10', title: 'Charlatán', description: '', emoji: 'flame', rarity: 'bronze', xp_reward: 20, is_active: true, condition: { type: 'forum_posts_count', count: 10 } },
]
const browser = await chromium.launch()
const errores = []
async function abrir({ viewport = { width: 1440, height: 900 }, sin1121 = false } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ L, sin }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_LOGROS__ = L
    if (sin) window.__SIN_1121__ = true
  }, { L: LOGROS, sin: sin1121 })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'/.test(String(e))) errores.push(String(e).slice(0, 180)) })
  page.on('dialog', (d) => d.accept())
  await page.goto(`${BASE}/admin/?ver=users`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.us-fila', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(300)
  return page
}

console.log('── La lista ──')
const page = await abrir()
const filas = await page.$$eval('.us-fila', (els) => els.map((e) => ({ id: e.dataset.us, txt: e.innerText.replace(/\s+/g, ' ') })))
const usuarios = await page.evaluate(() => window.__TABLAS__.user_profiles.map((u) => ({ id: u.id, username: u.username, admin: u.is_admin })))
check('una fila por persona, con nombre, @usuario y nivel', filas.length === usuarios.length && filas.every((f) => /@/.test(f.txt)), `${filas.length} de ${usuarios.length}`)
check('ni rastro de «Pro» ni de los ocho botones por fila', !/Hacer Pro|Quitar Pro|Hacer admin/.test(await page.textContent('#section-users')))
const chips = await page.$$eval('[data-us-filtro]', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
check('los chips con su cuenta', /^Todos \d+$/.test(chips[0]) && chips.some((c) => /^Equipo \d+$/.test(c)) && chips.some((c) => /^Baneados \d+$/.test(c)), chips.join(' | '))
await page.click('[data-us-filtro="equipo"]')
const soloEquipo = await page.$$eval('.us-fila', (els) => els.map((e) => e.dataset.us))
check('  …«Equipo» deja solo a los del equipo', soloEquipo.length > 0 && soloEquipo.every((id) => usuarios.find((u) => u.id === id)?.admin), soloEquipo.join())
await page.click('[data-us-filtro="todos"]')
const otro = usuarios.find((u) => u.id !== 'admin-1' && u.username)
await page.fill('#usBuscar', `@${otro.username}`)
check('el buscador encuentra por @usuario', (await page.$$eval('.us-fila', (els) => els.map((e) => e.dataset.us))).join() === otro.id)

console.log('── La ficha ──')
await page.click(`.us-fila[data-us="${otro.id}"]`)
await page.waitForTimeout(200)
check('se abre en el cajón con sus roles, moderación, logros y título', await page.isVisible('#usCajon') && /Roles.*Moderación.*Logros/s.test(await page.textContent('#usCajon')))
await page.check(`[data-us-rol="is_moderator"]`)
await page.waitForTimeout(400)
const tras = () => page.evaluate((id) => window.__TABLAS__.user_profiles.find((u) => u.id === id), otro.id)
check('un interruptor de rol escribe ya', (await tras()).is_moderator === true && /Moderación/.test(await page.textContent(`.us-fila[data-us="${otro.id}"]`)))
await page.fill('#usMotivo', 'Spam en el foro')
await page.selectOption('#usDuracion', '7')
await page.click('[data-us-moderar="silencio"]')
await page.waitForTimeout(500)
const mods = await page.evaluate(() => window.__TABLAS__.moderaciones)
check('silenciar con motivo y una semana', (await tras()).is_muted === true && mods.length === 1 && mods[0].motivo === 'Spam en el foro' && mods[0].hasta && /Silencio hasta el .*«Spam en el foro»/.test(await page.textContent('#usCajon')), JSON.stringify(mods))
check('  …y la fila lo dice', /Silenciado/.test(await page.textContent(`.us-fila[data-us="${otro.id}"]`)))
check('  …y el historial lo guarda', /Historial de moderación \(1\)/.test(await page.textContent('#usCajon')))
await page.click('[data-us-quitar="silencio"]')
await page.waitForTimeout(500)
check('quitar el silencio', (await tras()).is_muted === false && !(await page.$('[data-us-quitar="silencio"]')))
await page.selectOption('#usLogro', 'sorteo')
await page.fill('#usLogroMotivo', 'Ganó el sorteo de octubre')
await page.click('[data-us-dar-logro]')
await page.waitForTimeout(500)
check('dar un logro (con su aviso)', ((await tras()).achievements || []).includes('sorteo') && (await page.evaluate((id) => window.__TABLAS__.user_notifications.some((n) => n.recipient_id === id && n.type === 'logro'), otro.id)))
await page.click('[data-us-quitar-logro="sorteo"]')
await page.waitForTimeout(500)
check('  …y quitarlo', !((await tras()).achievements || []).includes('sorteo'))
if (await page.$('#usTitulo')) {
  await page.fill('#usTitulo', 'Perito de falsificaciones')
  await page.click('[data-us-titulo]')
  await page.waitForTimeout(400)
  check('el título del foro se guarda', (await tras()).forum_title === 'Perito de falsificaciones')
}
await page.screenshot({ path: '/tmp/1121-pc.png' })
await page.fill('#usBuscar', '')
await page.click('.us-fila[data-us="admin-1"]')
await page.waitForTimeout(200)
check('a uno mismo: ni quitarse el equipo ni moderarse', (await page.isDisabled('[data-us-rol="is_admin"]')) && /Eres tú/.test(await page.textContent('#usCajon')) && !(await page.$('[data-us-moderar]')))

console.log('── Sin la migración 1121 ──')
const sin = await abrir({ sin1121: true })
const alguien = (await sin.$$eval('.us-fila', (els) => els.map((e) => e.dataset.us))).find((id) => id !== 'admin-1')
await sin.click(`.us-fila[data-us="${alguien}"]`)
await sin.click('[data-us-moderar="baneo"]')
await sin.waitForTimeout(500)
check('banea igual, como antes (la columna a pelo), y lo dice', (await sin.evaluate((id) => window.__TABLAS__.user_profiles.find((u) => u.id === id)?.is_banned, alguien)) === true && /sin motivo ni fecha de fin/.test(await sin.textContent('#usCajon')))

console.log('── En el móvil ──')
const movil = await abrir({ viewport: { width: 390, height: 844 } })
await movil.click('.us-fila >> nth=1')
await movil.waitForTimeout(300)
const ancho = await movil.evaluate(() => document.documentElement.scrollWidth)
check('la ficha cabe sin desbordar de lado', (await movil.isVisible('#usCajon')) && ancho <= 392, ancho)
await movil.screenshot({ path: '/tmp/1121-movil.png', fullPage: true })
check('sin errores en las páginas', !errores.length, errores.join(' | '))

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
