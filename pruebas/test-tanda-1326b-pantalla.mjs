// Tanda 1326b — La guía de estilo viva en /admin (D6 del plan): los tokens se
// leen de style.css y cada pieza la pinta su función de siempre.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

globalThis.window = globalThis.window || { location: { href: '' } }
const g = await import(`${REPO}/admin/js/guia-estilo.js`)
const css = readFileSync(`${REPO}/css/style.css`, 'utf8')
const tokens = g.tokensDeHoja(css)
check('lee los tokens del :root de style.css (y solo del primero: el claro)', tokens.length > 40 && tokens.some((t) => t.nombre === '--t-md') && tokens.find((t) => t.nombre === '--bg')?.valor === '#f6f8fa', tokens.length)
const grupos = Object.groupBy ? Object.groupBy(tokens, (t) => g.grupoDeToken(t)) : {}
check('los reparte: la escala de letra entera, los seis pasos de espaciado y colores', grupos.letra?.length === 8 && grupos.espaciado?.length === 6 && grupos.colores?.length > 15, JSON.stringify(Object.fromEntries(Object.entries(grupos).map(([k, v]) => [k, v.length]))))
check('un token nuevo sale solo', g.tokensDeHoja(':root { --nuevo-color: #123456; }').length === 1 && g.grupoDeToken({ nombre: '--nuevo-color', valor: '#123456' }) === 'colores')
const html = g.guiaHtml(tokens)
check('cada apartado sale, con su «dónde»', g.APARTADOS.every((a) => html.includes(`id="gde-${a.id}"`)) && g.APARTADOS.length >= 10)
check('las chapas son las de la web (estado, gradeo, versión, idioma)', /class="chapa-estado"/.test(html) && /class="chapa-gradeo"/.test(html) && /class="mc-chapa-variante"/.test(html) && /class="pv-bandera"/.test(html))
check('  …el nombre con rango, el vacío y los iconos de icons.js', /class="rango-admin"/.test(html) && /class="vacio"/.test(html) && (html.match(/class="gde-icono"/g) || []).length > 50)

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => { if (!/serviceWorker/.test(String(e))) errores.push(String(e).slice(0, 180)) })
await p.goto(`${BASE}/admin/?ver=estilo`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.gde-apartado', { timeout: 15000 }).catch(() => {})
check('/admin/?ver=estilo abre la guía', (await p.locator('#section-estilo.active .gde-apartado').count()) === g.APARTADOS.length)
check('  …y en el menú, en «Sistema»', await p.locator('.admin-nav-item[data-section="estilo"]').isVisible())
const antes = await p.evaluate(() => ({ tema: document.documentElement.dataset.theme, bg: document.querySelector('[data-valor="--bg"]')?.textContent }))
await p.click('[data-gde-tema]')
const despues = await p.evaluate(() => ({ tema: document.documentElement.dataset.theme, bg: document.querySelector('[data-valor="--bg"]')?.textContent, guardado: localStorage.getItem('pokedoc-theme') }))
check('«Ver en el otro tema» cambia el tema y los valores que se leen (sin guardarlo)', antes.tema !== despues.tema && antes.bg !== despues.bg && despues.guardado === null, JSON.stringify({ antes, despues }))
const anchos = await p.evaluate(() => ['--e-xs', '--e-2xl'].map((n) => document.querySelector(`.gde-barra[style*="${n})"]`)?.getBoundingClientRect().width))
check('el espaciado se ve a su medida (4 y 32 px)', anchos[0] === 4 && anchos[1] === 32, JSON.stringify(anchos))
await p.click('[data-gde-popup]')
check('el pop-up de muestra se abre y se cierra', (await p.locator('#gdePopup:not(.hidden)').isVisible()) && (await p.click('#gdePopup [data-gde-cerrar] >> nth=0'), await p.locator('#gdePopup').isHidden()))
await p.click('[data-gde-toast="deshacer"]')
check('un aviso con «Deshacer», el de showToast', await p.locator('.toast-accion', { hasText: 'Deshacer' }).isVisible().catch(() => false))
check('sin errores en la página', errores.length === 0, errores.join(' | '))
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
