// Tanda 1460 — las cartas en su forma de Estándar, con el doble de Supabase:
// el resolutor del constructor (que usan también el laboratorio y las
// repeticiones) y el de /torneo, contra un catálogo con lo que tiene el de
// verdad: cartas que crea TCGGO («tcggo-…», números sin ceros o con el código
// delante), promos de «PR-SV» y una carta con su impresión de Prize Pack.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`) }

const SETS = [
  { id: 'me01', name: 'Mega Evolution', market: 'WEST', tcg_online_code: 'MEG', release_date: '2025-09-26', card_count_official: 132 },
  { id: 'dlr', name: 'Delta Reign', market: 'WEST', tcg_online_code: 'DLR', release_date: '2026-11-06', card_count_official: 140 },
  { id: 'svp', name: 'SVP Black Star Promos', market: 'WEST', tcg_online_code: 'PR-SV', release_date: '2023-01-01', card_count_official: 0 },
  { id: 'sv02', name: 'Paldea Evolved', market: 'WEST', tcg_online_code: 'PAL', release_date: '2023-06-09', card_count_official: 193 },
  { id: 'sv04.5', name: 'Paldean Fates', market: 'WEST', tcg_online_code: 'PAF', release_date: '2024-01-26', card_count_official: 91 },
  { id: 'tg-743', name: 'Play! Pokémon Prize Pack Series Nine', market: 'WEST', tcg_online_code: null, release_date: '2026-07-01', card_count_official: 0 },
]
const carta = (id, set_id, local_id, name, extra = {}) => ({ id, set_id, local_id, name, name_es: name, market: 'WEST', category: 'Trainer', rarity: 'Uncommon', regulation_mark: 'I', image_path: `x/${id}`, ...extra })
const CARTAS = [
  // Delta Reign: la crea TCGGO, con su id y su número sin ceros.
  carta('tcggo-81898', 'dlr', '84', 'Mega Rayquaza ex', { category: 'Pokemon', hp: 340, regulation_mark: 'J', rarity: 'Double Rare' }),
  // SVP: la de TCGdex con su número, y una de TCGGO con «SVP 225».
  carta('svp-149', 'svp', '149', 'Pecharunt', { category: 'Pokemon', hp: 80, rarity: 'Promo' }),
  carta('tcggo-48088', 'svp', 'SVP 225', 'Mega Kangaskhan ex', { category: 'Pokemon', hp: 300, rarity: 'Promo' }),
  // La Boss's Orders: la de Mega Evolution (I) y la de su Prize Pack (J, sin código).
  carta('me01-114', 'me01', '114', "Boss's Orders", { name_es: 'Órdenes de Jefes' }),
  carta('tcggo-76248', 'tg-743', '114/132', "Boss's Orders", { name_es: 'Órdenes de Jefes', regulation_mark: 'J' }),
  // Iono: las de juego con la G (rotadas) y una de Prize Pack legal.
  carta('sv02-185', 'sv02', '185', 'Iono', { name_es: 'e-Nigma', regulation_mark: 'G' }),
  // Esta, con el español en `name` (la 330) y el inglés en `name_en`: el meta
  // va en inglés y tiene que encontrarla igual.
  carta('sv04.5-080', 'sv04.5', '080', 'e-Nigma', { name_es: 'e-Nigma', name_en: 'Iono', regulation_mark: 'G' }),
  carta('tcggo-75881', 'tg-743', '185/193', 'Iono', { name_es: 'e-Nigma', regulation_mark: 'I' }),
]
const hoy = new Date().toISOString().slice(0, 10)

const browser = await chromium.launch()
async function abrir({ meta = [] } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' })
  await ctx.addInitScript((d) => Object.assign(window, { __FAKE_SESSION__: 'none', __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_META_CARTAS__: d.meta }), { SETS, CARTAS, meta })
  await ctx.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/constructor.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(800)
  return { ctx, page, errores }
}
const resolver = (page, lineas) =>
  page.evaluate(async (lineas) => {
    const d = await import('/js/constructor/datos.js')
    const r = await d.resolverLineas(lineas)
    return { resueltas: r.resueltas.map((x) => ({ nombre: x.linea.nombre, id: x.carta?.id, exacta: x.exacta })), sinResolver: r.sinResolver.map((x) => x.nombre) }
  }, lineas)

console.log('── 1. El constructor: por colección y número ──')
{
  const { ctx, page, errores } = await abrir()
  const r = await resolver(page, [
    { n: 2, nombre: 'Mega Rayquaza ex', set: 'DLR', numero: '084' },
    { n: 1, nombre: 'Pecharunt', set: 'SVP', numero: '149' },
    { n: 1, nombre: 'Mega Kangaskhan ex', set: 'SVP', numero: '225' },
  ])
  const de = (n) => r.resueltas.find((x) => x.nombre === n)
  check('«DLR 084» es la «tcggo-81898» de Delta Reign (su id no es «dlr-084»), y exacta', de('Mega Rayquaza ex')?.id === 'tcggo-81898' && de('Mega Rayquaza ex').exacta, JSON.stringify(r))
  check('«SVP 149» es la `svp-149`', de('Pecharunt')?.id === 'svp-149' && de('Pecharunt').exacta)
  check('«SVP 225», la de TCGGO numerada «SVP 225»', de('Mega Kangaskhan ex')?.id === 'tcggo-48088' && de('Mega Kangaskhan ex').exacta)
  check('nada sin resolver ni errores', !r.sinResolver.length && !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Por el nombre: la forma en que se juega ──')
{
  const { ctx, page } = await abrir()
  const r = await resolver(page, [{ n: 4, nombre: "Boss's Orders" }, { n: 1, nombre: 'Iono' }])
  const de = (n) => r.resueltas.find((x) => x.nombre === n)?.id
  check('sin meta: la Boss\'s Orders de Mega Evolution, no la de su Prize Pack (aunque la del Prize Pack lleve la J)', de("Boss's Orders") === 'me01-114', JSON.stringify(r))
  check('  …y el Iono de una colección de TCG Live (la G vale por la reimpresión), no el del Prize Pack', ['sv02-185', 'sv04.5-080'].includes(de('Iono')), de('Iono'))
  await ctx.close()
}
{
  // Con el meta: el Iono que llevan los mazos es el de Evoluciones en Paldea.
  const { ctx, page } = await abrir({ meta: [{ nombre: 'Iono', seccion: 'trainer', set_codigo: 'PAL', numero: '185', mazos: 30, dia: hoy }, { nombre: 'Iono', seccion: 'trainer', set_codigo: 'PAF', numero: '80', mazos: 5, dia: hoy }] })
  const r = await resolver(page, [{ n: 1, nombre: 'Iono' }, { n: 1, nombre: 'e-Nigma' }])
  check('con el meta, la que más mazos llevan (PAL 185), también escrita en español (por su `name_en`)', r.resueltas.length && r.resueltas.every((x) => x.id === 'sv02-185'), JSON.stringify(r))
  const consultas = await page.evaluate(() => window.__CONSULTAS__?.porTabla?.meta_cartas_dia || 0)
  check('  …una consulta al meta por nombre', consultas >= 1 && consultas <= 3, consultas)
  await ctx.close()
}

console.log('── 3. /torneo: la lista con códigos ──')
{
  const { ctx, page, errores } = await abrir()
  const r = await page.evaluate(async () => {
    const lc = await import('/js/lista-canonica.js')
    const de = async (l) => { const c = await lc.resolverCarta(l); return { id: c?.id, exacta: c?.exacta } }
    return { dlr: await de({ name: 'Mega Rayquaza ex', set: 'DLR', number: '084' }), svp: await de({ name: 'Pecharunt', set: 'SVP', number: '149' }), svp2: await de({ name: 'Mega Kangaskhan ex', set: 'SVP', number: '225' }) }
  })
  check('«DLR 084» exacta (Delta Reign guarda «84»)', r.dlr.id === 'tcggo-81898' && r.dlr.exacta, JSON.stringify(r))
  check('«SVP 149» exacta (el set dice «PR-SV»)', r.svp.id === 'svp-149' && r.svp.exacta)
  check('«SVP 225» exacta (la de TCGGO)', r.svp2.id === 'tcggo-48088' && r.svp2.exacta)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
