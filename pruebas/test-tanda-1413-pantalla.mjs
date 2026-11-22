// Tanda 1413 — Informe PDF de tu colección (PINGU, de «Dónde va cada función»:
// «1, sí»). En el Panel › Más, «Informe PDF» descarga un A4: la primera hoja
// con tus cifras, las doce que más valen con foto y el reparto por expansión;
// después todas tus cartas en una tabla, 44 por hoja, con «Página N de M».
//   · Lo puro: filas (orden por expansión y número), cifras, por expansión,
//     las que más valen (una por carta) y las hojas con su tope.
//   · El botón descarga un PDF de verdad con las páginas que tocan.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync } from 'node:fs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const N = 100
const SETS = [
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 60, card_count_total: 60 },
  { id: 'sv7', name: 'Corona Astral', serie_id: 'sv', market: 'WEST', release_date: '2024-09-13', card_count_official: 60, card_count_total: 60 },
]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `${i < 60 ? 'sv8' : 'sv7'}-${(i % 60) + 1}`, market: 'WEST', set_id: i < 60 ? 'sv8' : 'sv7', local_id: String((i % 60) + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv8/${(i % 60) + 1}`, rarity: 'Rare', category: 'Pokemon' }))
// 100 cartas y 10 de ellas en dos idiomas: 110 líneas = 3 hojas de lista.
const COLECCION = [...CARTAS.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: i % 7 === 0 ? 2 : 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: i + 1, created_at: '2026-11-01T10:00:00Z' })),
  ...CARTAS.slice(0, 10).map((c, i) => ({ id: `m${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'en', estado: 'LP', variante: 'normal', gradeo: i === 0 ? 'PSA 10' : null, created_at: '2026-11-01T10:00:00Z' }))]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block', acceptDownloads: true })
await ctx.addInitScript(({ SETS, CARTAS, COLECCION }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS; window.__FAKE_COLECCION__ = COLECCION
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
}, { SETS, CARTAS, COLECCION })
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c62828"/></svg>'
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: svg }))
await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 200)) })
await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#mcMas', { timeout: 10000 }).catch(() => {})

console.log('\n── Lo puro ──')
{
  const r = await page.evaluate(async () => {
    const m = await import('/js/mi-coleccion/informe.js')
    const set = (id, fecha) => ({ id, name: id, release_date: fecha })
    const c = (id, s, n) => ({ id, local_id: String(n), market: 'WEST', set_id: s.id, tcg_sets: s, name: id })
    const A = set('Nueva', '2025-01-01'); const B = set('Vieja', '2020-01-01')
    const cartas = { a: c('a', A, 10), b: c('b', A, 2), x: c('x', B, 1) }
    const lineas = [{ card_id: 'x', cantidad: 1, valor: 50 }, { card_id: 'a', cantidad: 2, valor: 20 }, { card_id: 'b', cantidad: 1, valor: 5, idioma: 'en', gradeo: 'PSA 9' }, { card_id: 'a', cantidad: 1, valor: 30, idioma: 'jp' }]
    const filas = m.filasDelInforme(lineas, { cartaDe: (l) => cartas[l.card_id], valorDe: (l) => l.valor, nombreDe: (k) => k.name })
    const top = m.lasQueMasValen(filas)
    const h = m.hojasDeLista(Array.from({ length: 100 }, (_, i) => ({ valor: i })), 44, 2)
    return {
      orden: filas.map((f) => f.nombre).join(','), estado: filas.find((f) => f.nombre === 'b').estado, idioma: filas[2].idioma,
      cifras: m.cifrasDe(filas), sets: m.porExpansion(filas).map((s) => `${s.set}:${s.copias}:${s.valor}`).join(','),
      top: top.map((f) => f.nombre).join(','),
      hojas: h.hojas.map((x) => x.length).join(','), cortada: h.cortada, fuera: h.fuera, guardaCaras: h.hojas.flat().every((f) => f.valor >= 12),
    }
  })
  check('por expansión (la más nueva antes) y número', r.orden === 'b,a,a,x', r.orden)
  check('una gradeada dice su nota en el estado', r.estado === 'PSA 9', r.estado)
  check('el idioma en mayúsculas', ['JP', 'EN', ''].includes(r.idioma), r.idioma)
  check('cifras: 5 copias, 3 distintas, 2 expansiones y 105 €', r.cifras.copias === 5 && r.cifras.distintas === 3 && r.cifras.expansiones === 2 && r.cifras.valor === 105, JSON.stringify(r.cifras))
  check('por expansión, de más a menos valor', r.sets === 'Nueva:4:55,Vieja:1:50', r.sets)
  check('las que más valen, por copia y una vez cada carta', r.top === 'x,a,b', r.top)
  check('con tope de hojas se queda con las que más valen', r.hojas === '44,44' && r.cortada && r.fuera === 12 && r.guardaCaras, `${r.hojas} ${r.cortada} ${r.fuera}`)
}

console.log('\n── El botón ──')
{
  check('«Informe PDF» está en Más', await page.isVisible('#mcInforme'))
  const espera = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
  await page.click('#mcInforme')
  const d = await espera
  check('descarga un fichero', !!d)
  if (d) {
    check('se llama mi-coleccion-<fecha>.pdf', /^mi-coleccion-\d{4}-\d{2}-\d{2}\.pdf$/.test(d.suggestedFilename()), d.suggestedFilename())
    const ruta = await d.path()
    const { readFileSync } = await import('node:fs')
    const b = readFileSync(ruta)
    const txt = b.toString('latin1')
    check('es un PDF', txt.startsWith('%PDF-1.4') && txt.trimEnd().endsWith('%%EOF'), txt.slice(0, 10))
    check('con 4 páginas (portada y 110 líneas en 3)', /\/Count 4\b/.test(txt), (txt.match(/\/Count \d+/) || [])[0])
    check('en A4', /\/MediaBox \[0 0 595\.\d+ 841\.\d+\]/.test(txt), (txt.match(/\/MediaBox \[[^\]]+\]/) || [])[0])
    check('y no pesa demasiado', b.length < 3_000_000, b.length)
    if (process.env.CAPTURAS) writeFileSync(`${process.env.CAPTURAS}/1413-informe.pdf`, b)
  }
  await page.waitForTimeout(400)
  check('el botón vuelve a su texto', (await page.textContent('#mcInforme')).trim() === 'Informe PDF', await page.textContent('#mcInforme'))
}
check('sin errores', !errores.length, errores.join(' | '))

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
