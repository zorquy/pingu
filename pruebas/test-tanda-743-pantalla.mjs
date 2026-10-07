// Tanda 743 — la vitrina del perfil (J4 de la lista de propuestas, elegidas
// por PINGU): seis cartas que eliges tú.
//
// Lo que se mira: las reglas puras (orden, sin repetidas, posiciones 1…n y
// tope de seis); en TU perfil, la vitrina con sus huecos y «Elegir cartas»,
// el selector con tus cartas, que marca hasta seis en orden y que al
// guardar escribe esas filas y repinta; en el perfil de OTRA persona, solo
// lo que tiene (sin huecos ni botón); y que sin la migración —la tabla no
// existe— no sale nada y el perfil sigue como estaba. Y la migración: tabla
// propia, lectura para todo el mundo y escritura solo de la tuya.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { ordenDeVitrina, filasDeEleccion, HUECOS } = await import(`${RAIZ}/js/vitrina.js`).catch((e) => { console.log('  (no se pudo importar js/vitrina.js en node:', String(e).slice(0, 120), ')'); return {} })

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Las reglas y la migración ──')
if (ordenDeVitrina) {
  const o = ordenDeVitrina([{ posicion: 3, card_id: 'c' }, { posicion: 1, card_id: 'a' }, { posicion: 2, card_id: 'a' }, { posicion: 9, card_id: 'z' }])
  check('en su orden, sin repetidas y sin huecos fuera de 1–6', JSON.stringify(o.map((f) => f.card_id)) === JSON.stringify(['a', 'c']), JSON.stringify(o))
  const f = filasDeEleccion('u1', ['a|WEST', 'b|JP', 'c|WEST', 'd|WEST', 'e|WEST', 'f|WEST', 'g|WEST'])
  check('posiciones 1…n, con su mercado, y seis como mucho', HUECOS === 6 && f.length === 6 && f[1].posicion === 2 && f[1].market === 'JP' && f[0].user_id === 'u1', JSON.stringify(f[1]))
}
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-vitrina.sql`, 'utf8')
  check('la migración: tabla propia, RLS, lectura para todos y escritura de la tuya', /create table if not exists public\.user_showcase/.test(sql) && /enable row level security/.test(sql) && /for select to anon, authenticated/.test(sql) && /auth\.uid\(\) = user_id/.test(sql) && !/temp(orary)? table/i.test(sql))
}

const browser = await chromium.launch()
const semilla = ({ vitrina, sinTabla }) => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
  window.__FAKE_CARTAS__ = Array.from({ length: 8 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}`, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = Array.from({ length: 8 }, (_, i) => ({ id: `l${i}`, user_id: 'user-1', card_id: `xy5-${i + 1}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
  window.__FAKE_VITRINA__ = vitrina
  if (sinTabla) window.__FAKE_FALLA__ = { user_showcase: true }
}
async function abrir(ruta, opciones = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { vitrina: [], sinTabla: false, ...opciones })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const vitrina = (page) => page.evaluate(() => {
  const v = document.getElementById('perfilVitrina')
  if (!v) return null
  return { visto: !v.hidden && getComputedStyle(v).display !== 'none', cartas: [...v.querySelectorAll('.vitrina-carta span')].map((s) => s.textContent), huecos: v.querySelectorAll('.vitrina-hueco').length, boton: v.querySelector('.vitrina-editar')?.textContent.trim() || null }
})

console.log('── 2. Tu perfil ──')
{
  const { page, ctx, errores } = await abrir('/perfil.html', { vitrina: [{ posicion: 1, card_id: 'xy5-2', market: 'WEST' }] })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const v = await vitrina(page)
  check('la vitrina, con tu carta, cinco huecos y «Cambiar»', v?.visto && JSON.stringify(v.cartas) === JSON.stringify(['Carta 2']) && v.huecos === 5 && v.boton === 'Cambiar', JSON.stringify(v))
  await page.click('#perfilVitrina .vitrina-editar')
  await page.waitForTimeout(1200)
  const s = await page.evaluate(() => ({ open: document.getElementById('vitrinaElegir')?.open, opciones: document.querySelectorAll('#vitrinaOpciones .vitrina-opcion').length, marcadas: [...document.querySelectorAll('#vitrinaOpciones [aria-pressed="true"]')].map((b) => b.textContent.trim()), cuenta: document.getElementById('vitrinaCuenta')?.textContent }))
  check('el selector, con tus ocho cartas y la que ya estaba marcada', s.open && s.opciones === 8 && s.marcadas.length === 1 && /1 de 6/.test(s.cuenta), JSON.stringify(s))
  for (const n of [5, 7, 3, 4, 6, 8]) await page.click(`#vitrinaOpciones [data-clave="xy5-${n}|WEST"]`).catch(() => {})
  const lleno = await page.evaluate(() => ({ cuenta: document.getElementById('vitrinaCuenta').textContent, apagadas: document.querySelectorAll('#vitrinaOpciones .vitrina-opcion:disabled').length }))
  check('marca hasta seis, y entonces las demás se apagan', /6 de 6/.test(lleno.cuenta) && lleno.apagadas === 2, JSON.stringify(lleno))
  await page.fill('#vitrinaBuscar', 'Carta 1')
  await page.waitForTimeout(200)
  check('el buscador filtra', (await page.locator('#vitrinaOpciones .vitrina-opcion').count()) === 1)
  await page.click('[data-vitrina="guardar"]')
  await page.waitForTimeout(1200)
  const escrituras = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'user_showcase'))
  const insert = escrituras.find((e) => e.tipo === 'insert')
  check('guardar borra la vitrina y escribe las seis, en el orden marcado', escrituras.some((e) => e.tipo === 'delete') && insert?.filas.length === 6 && JSON.stringify(insert.filas.map((f) => f.card_id)) === JSON.stringify(['xy5-2', 'xy5-5', 'xy5-7', 'xy5-3', 'xy5-4', 'xy5-6']) && insert.filas.every((f) => f.user_id === 'user-1'), JSON.stringify(escrituras).slice(0, 300))
  const v2 = await vitrina(page)
  check('  …y se repinta sin huecos', v2.cartas.length === 6 && v2.huecos === 0 && v2.cartas[1] === 'Carta 5', JSON.stringify(v2))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. El perfil de otra persona ──')
{
  const { page, ctx, errores } = await abrir('/usuario.html?id=user-2', { vitrina: [{ user_id: 'user-2', posicion: 1, card_id: 'xy5-1', market: 'WEST' }, { user_id: 'user-2', posicion: 2, card_id: 'xy5-3', market: 'WEST' }] })
  const v = await vitrina(page)
  check('solo lo que tiene: sin huecos ni botón', v?.visto && JSON.stringify(v.cartas) === JSON.stringify(['Carta 1', 'Carta 3']) && v.huecos === 0 && v.boton === null, JSON.stringify(v))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
  const b = await abrir('/usuario.html?id=user-2', { vitrina: [] })
  check('sin vitrina, no sale nada', (await vitrina(b.page))?.visto === false)
  await b.ctx.close()
}

console.log('── 4. Sin la migración ──')
{
  const { page, ctx, errores } = await abrir('/perfil.html', { sinTabla: true })
  check('la vitrina no sale y el perfil sigue (sin errores)', (await vitrina(page))?.visto === false && errores.length === 0 && (await page.locator('#profileStats .perfil-cifra').count()) > 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
