// Tanda 1414 — Imprimir los huecos (PINGU, de «Dónde va cada función»: «3, sí,
// pero solo el de imprimir los huecos»). En el ⋯ de un álbum tuyo al que le
// faltan cartas: una hoja pregunta «con la foto en gris» o «solo el nombre» y
// descarga un PDF A4 con las que faltan a tamaño real (63 × 88 mm), nueve por
// hoja, con marcas de corte.
//   · Lo puro: qué huecos (solo los que tienen carta y no tienes), la rejilla
//     de 3 × 3 centrada a tamaño real, las hojas y el número «12/165».
//   · En un álbum completo no sale; en uno a medias sí, y el PDF tiene las
//     hojas que tocan en los dos estilos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { writeFileSync, readFileSync } from 'node:fs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const N = 24
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: i === 3 ? 'Pikachu ex de Iono con un nombre muy largo' : `Chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
// Tienes las 4 primeras: faltan 20 (3 hojas).
const COLECCION = CARTAS.slice(0, 4).map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-11-01T10:00:00Z' }))
const ALBUMES = [
  { id: 'alb-medias', user_id: 'admin-1', nombre: 'Chispas a medias', tipo: 'binder', rejilla: '3x3', paginas: 3, tapa: 'azul', is_public: false, cartas: [...CARTAS.map((c) => ({ id: c.id })), {}, {}], updated_at: '2026-11-20T10:00:00Z' },
  { id: 'alb-lleno', user_id: 'admin-1', nombre: 'Lo que tengo', tipo: 'binder', rejilla: '3x3', paginas: 1, tapa: 'roja', is_public: false, cartas: CARTAS.slice(0, 4).map((c) => ({ id: c.id })), updated_at: '2026-11-19T10:00:00Z' },
]
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#2f6fb3"/><circle cx="122" cy="140" r="60" fill="#ffd34d"/></svg>'

const browser = await chromium.launch()
async function abrir(album) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block', acceptDownloads: true })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES, COLECCION }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS; window.__FAKE_COLECCION__ = COLECCION; window.__FAKE_ALBUMES__ = ALBUMES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, { SETS, CARTAS, ALBUMES, COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: svg }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.goto(`${BASE}/mi-coleccion.html?ver=carpetas&album=${album}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-hoja', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)
  return { ctx, page, errores }
}

console.log('\n── Lo puro ──')
{
  const { page, ctx } = await abrir('alb-medias')
  const r = await page.evaluate(async () => {
    const m = await import('/js/mi-coleccion/imprimir-huecos.js')
    const caj = m.rejillaA4()
    const huecos = m.huecosDelAlbum([{ id: 'a' }, {}, { id: 'b' }, null, { id: 'c' }], (c) => c.id === 'b')
    const h = m.hojasDe(Array.from({ length: 20 }, (_, i) => ({ id: i })), 2)
    return {
      huecos: huecos.map((x) => x.id).join(','),
      n: caj.length, primera: caj[0], ultima: caj[8],
      hojas: h.hojas.map((x) => x.length).join(','), fuera: h.fuera,
      num: [m.numeroDe({ local_id: '12', tcg_sets: { card_count_official: 165 } }), m.numeroDe({ local_id: 'TG05', tcg_sets: { card_count_official: 30 } }), m.numeroDe({ local_id: '7' }, 'reverse')],
    }
  })
  check('huecos: las que no tienes y tienen carta', r.huecos === 'a,c', r.huecos)
  check('nueve por hoja, a 63 × 88 mm', r.n === 9 && r.primera.w === 63 && r.primera.h === 88, JSON.stringify(r.primera))
  check('centradas en el A4', Math.abs(r.primera.x - 10.5) < 0.01 && Math.abs(r.primera.y - 16.5) < 0.01 && Math.abs(r.ultima.x + 63 - 199.5) < 0.01 && Math.abs(r.ultima.y + 88 - 280.5) < 0.01, `${r.primera.x},${r.primera.y} → ${r.ultima.x + 63},${r.ultima.y + 88}`)
  check('las hojas, con su tope', r.hojas === '9,9' && r.fuera === 2, `${r.hojas} fuera ${r.fuera}`)
  check('el número con el total del set y la versión', r.num.join('|') === '12/165|TG05|7 · Reverse', r.num.join('|'))
  await ctx.close()
}

console.log('\n── Un álbum completo ──')
{
  const { page, ctx, errores } = await abrir('alb-lleno')
  await page.click('#mcAlbMenu summary').catch(() => {})
  check('no sale «Imprimir los huecos»', !(await page.isVisible('#mcAlbHuecos')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── Un álbum a medias ──')
for (const estilo of ['foto', 'nombre']) {
  const { page, ctx, errores } = await abrir('alb-medias')
  await page.click('#mcAlbMenu summary')
  check(`(${estilo}) sale en el ⋯`, await page.isVisible('#mcAlbHuecos'))
  await page.click('#mcAlbHuecos')
  await page.waitForSelector('#mcHuecos[open]', { timeout: 5000 }).catch(() => {})
  const cuenta = await page.textContent('#mcHuecosCuenta').catch(() => '')
  check(`(${estilo}) la hoja dice cuántas y cuántas hojas`, /20 cartas te faltan · 3 hojas A4/.test(cuenta), cuenta)
  if (estilo === 'nombre') await page.click('#mcHuecos [data-estilo="nombre"]')
  if (process.env.CAPTURAS && estilo === 'foto') await page.screenshot({ path: `${process.env.CAPTURAS}/1414-hoja.png` })
  const espera = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
  await page.click('#mcHuecos [data-huecos="si"]')
  const d = await espera
  check(`(${estilo}) descarga el PDF`, !!d && /^huecos-chispas-a-medias\.pdf$/.test(d.suggestedFilename()), d?.suggestedFilename())
  if (d) {
    const b = readFileSync(await d.path())
    const t = b.toString('latin1')
    check(`(${estilo}) tres hojas A4`, /\/Count 3\b/.test(t) && /\/MediaBox \[0 0 595\.\d+ 841\.\d+\]/.test(t), (t.match(/\/Count \d+/) || [])[0])
    if (process.env.CAPTURAS) writeFileSync(`${process.env.CAPTURAS}/1414-${estilo}.pdf`, b)
  }
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
