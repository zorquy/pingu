// Tanda 1328 — Probar sin cuenta (G4 del plan): en /cartas sin sesión el «+»
// guarda en el navegador, la franja dice cuántas llevas y lo que valen (desde la
// quinta pide la cuenta) y, al entrar con cuenta, se suben solas.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
const m = await import(`${REPO}/js/coleccion-local.js`)
const mem = () => { const d = {}; return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = String(v) }, removeItem: (k) => { delete d[k] } } }
const a = mem()
const l1 = m.anadir({ card_id: 'sv8-2', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }, 'WEST', { almacen: a })
m.anadir({ card_id: 'sv8-2', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 2 }, 'WEST', { almacen: a })
m.anadir({ card_id: 'sv8-2', idioma: 'en', estado: 'NM', variante: 'normal' }, 'WEST', { almacen: a })
m.anadir({ card_id: 'sv1a-1', idioma: 'ja' }, 'JP', { almacen: a })
check('dos iguales se suman; otro idioma es otra línea; cada catálogo lo suyo', m.lineasDe('WEST', a).length === 2 && m.lineasDe('WEST', a).find((l) => l.idioma === 'es').cantidad === 3 && m.lineasDe('JP', a).length === 1, JSON.stringify(m.lineasDe(null, a)))
check('con la forma de una línea de verdad, de nadie todavía', l1.id.startsWith('local-') && l1.user_id === m.SIN_CUENTA && l1.market === 'WEST')
m.actualizar(l1.id, { cantidad: 1, user_id: 'otro' }, { almacen: a })
check('actualizar cambia lo que se pide (pero no el dueño) y borrar quita', m.lineasDeCarta('sv8-2', a).find((l) => l.id === l1.id).cantidad === 1 && m.lineasDeCarta('sv8-2', a).find((l) => l.id === l1.id).user_id === m.SIN_CUENTA)
const sub = m.paraSubir(m.leer(a))
check('lo que se sube va por catálogo y sin lo que es solo del navegador', sub.get('WEST').length === 2 && sub.get('JP').length === 1 && sub.get('WEST').every((l) => !l.id && !l.user_id && !l.created_at))
check('la franja: nada sin cartas; con pocas, corta; desde la quinta, pide la cuenta con el valor', m.franjaDe([]) === null && !m.franjaDe([{ cantidad: 2 }]).fuerte && m.franjaDe([{ cantidad: 5 }], 48.2).fuerte && m.franjaDe([{ cantidad: 5 }], 48.2).titulo === 'Llevas 5 cartas · 48,20 €', JSON.stringify(m.franjaDe([{ cantidad: 5 }], 48.2)))
m.borrar(l1.id, a)
check('  …y borrar quita esa línea', !m.leer(a).some((l) => l.id === l1.id))

console.log('── La página ──')
const N = 8
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, tcg_online_code: 'SSP' }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
await ctx.addInitScript(({ S, C }) => { window.__FAKE_SESSION__ = sessionStorage.getItem('sesion') || 'none'; window.__FAKE_SETS__ = S; window.__FAKE_CARTAS__ = C }, { S: SETS, C: CARTAS })
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => { if (!/serviceWorker/.test(String(e))) errores.push(String(e).slice(0, 200)) })
await p.goto(`${BASE}/cartas.html?set=sv8`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('#mcAlbum [data-anadir="sv8-2"]', { timeout: 10000 }).catch(() => {})
check('sin cuenta, cada carta de la expansión lleva su «+»', (await p.locator('#mcAlbum [data-anadir]').count()) >= N)
async function anadir(id) {
  await p.locator(`#mcAlbum [data-anadir="${id}"]`).first().click()
  await p.waitForSelector('#mcAnadirDialogo[open]', { timeout: 5000 }).catch(() => {})
  await p.click('#mcAdGuardar')
  await p.waitForFunction(() => !document.querySelector('#mcAnadirDialogo[open]'), null, { timeout: 5000 }).catch(() => {})
}
await anadir('sv8-2')
const guardado = await p.evaluate(() => JSON.parse(localStorage.getItem('pd-coleccion-local') || '[]'))
check('el «+» abre la hoja de siempre y guarda en el navegador', guardado.length === 1 && guardado[0].card_id === 'sv8-2', JSON.stringify(guardado))
await p.waitForSelector('#mcLocalFranja', { timeout: 4000 }).catch(() => {})
check('la franja: «Llevas 1 carta», en suave', /Llevas 1 carta/.test(await p.locator('#mcLocalFranja').textContent().catch(() => '')) && !(await p.locator('#mcLocalFranja.fuerte').count()))
for (const id of ['sv8-3', 'sv8-4', 'sv8-5', 'sv8-6']) await anadir(id)
const fr = await p.locator('#mcLocalFranja').textContent().catch(() => '')
check('a la quinta, la franja pide la cuenta', /Llevas 5 cartas/.test(fr) && /Crear cuenta para no perderlas/.test(fr) && (await p.locator('#mcLocalFranja.fuerte a.btn-primary[href*="auth.html?registro=1"]').count()) === 1, fr)
await p.reload({ waitUntil: 'domcontentloaded' })
await p.waitForSelector('#mcLocalFranja', { timeout: 8000 }).catch(() => {})
check('al volver, siguen ahí (la marca de que la tienes y la franja)', /Llevas 5 cartas/.test(await p.locator('#mcLocalFranja').textContent().catch(() => '')))
await p.click('#mcAlbum [data-anadir="sv8-2"]').catch(() => {})
await p.keyboard.press('Escape')
check('sin errores en la página', errores.length === 0, errores.join(' | '))
// Entrar: con sesión, la próxima página sube lo guardado y lo vacía.
await p.evaluate(() => sessionStorage.setItem('sesion', 'user-1'))
await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
await p.waitForFunction(() => /Hemos guardado en tu cuenta/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => {})
const tras = await p.evaluate(() => ({ local: localStorage.getItem('pd-coleccion-local'), toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ') }))
check('al entrar se suben solas y se vacía el navegador, con su aviso', tras.local === null && /Hemos guardado en tu cuenta las 5 cartas/.test(tras.toast), JSON.stringify(tras))
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
