// Tanda 937 — las versiones de una carta son las que diga TCGGO, también
// cuando no dice ninguna.
//
// PINGU, con el Dracloak: «en Prismatic Evolutions TCGGO tiene la estándar,
// Master Ball, Poké Ball y Reverse Holo; en Twilight Masquerade, estándar y
// Reverse Holo; en el Prize Pack solo una, la del sello… y nosotros le
// ponemos Normal y Reverse Holo. Deberíamos estar mirando las versiones que
// trae cada carta de TCGGO». La respuesta real de TCGGO (la del Lunatone, la
// 930, y la página de la 929) trae `variants: []` cuando no hay más que la
// carta: «no dice nada» y «no se le ha preguntado» eran lo mismo. La pasada
// de precios escribe ahora la fila «Standard» de cada carta que mira.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const lib = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
const datos = await import(`${RAIZ}/js/mi-coleccion/datos.js`)
const AHORA = new Date('2026-10-21T12:00:00Z')
const DOC = JSON.parse(readFileSync(join(AQUI, 'fixtures-929', 'episodio-cartas-con-variantes.json'), 'utf8'))

console.log('── 1. La fila de la carta misma ──')
{
  const sin = DOC.data.find((c) => !(c.variants || []).length)
  check('la respuesta real trae cartas con `variants` vacío (la carta sola)', Boolean(sin), DOC.data.map((c) => (c.variants || []).length).join())
  const f = lib.filaDeLaCarta(sin, { id: 'por-9', set_id: 'por' }, { ahora: AHORA })
  check('la fila «Standard» lleva el id de TCGGO de la carta, cuelga de la nuestra y lleva su precio', f.length === 1 && f[0].tcggo_id === sin.id && f[0].etiqueta === 'Standard' && f[0].card_id === 'por-9' && f[0].set_id === 'por' && f[0].cm_low === sin.prices.cardmarket.lowest_near_mint, JSON.stringify(f))
  const de = lib.filasDeVariantes(DOC.data[0], { id: 'por-1', set_id: 'por' }, { ahora: AHORA })
  check('  …con las MISMAS columnas que las versiones (van en el mismo lote)', Object.keys(f[0]).sort().join() === Object.keys(de[0]).sort().join(), `${Object.keys(f[0]).sort()} | ${Object.keys(de[0]).sort()}`)
  check('  …y sin id no hay fila', lib.filaDeLaCarta({ id: null }, { id: 'x' }).length === 0)
}

console.log('\n── 2. Lo que ofrece la web ──')
{
  const ids = (c) => v.variantesDeCarta(c).map((x) => x.nuestro).join()
  const standard = (id, card) => ({ tcggo_id: id, card_id: card, etiqueta: 'Standard' })
  // El Dracloak del Prize Pack: TCGdex dice normal y reverse; TCGGO, solo ella.
  const prize = { id: 'pps6-1', set_id: 'pps6', variants: { normal: true, reverse: true }, versiones: [standard(1, 'pps6-1')] }
  check('Prize Pack: TCGGO la ha mirado y no da más → UNA versión, sin la Reverse de TCGdex', ids(prize) === 'normal', ids(prize))
  const twm = { id: 'sv6-1', set_id: 'sv6', variants: { normal: true, reverse: true }, versiones: [standard(2, 'sv6-1'), { tcggo_id: 3, card_id: 'sv6-1', etiqueta: 'Reverse Holo' }] }
  check('Twilight Masquerade: estándar y Reverse Holo, como TCGGO', ids(twm) === 'normal,reverse', ids(twm))
  const pre = { id: 'sv8pt5-1', set_id: 'sv8pt5', variants: { normal: true, reverse: true }, versiones: [standard(4, 'sv8pt5-1'), { tcggo_id: 5, etiqueta: 'Master Ball' }, { tcggo_id: 6, etiqueta: 'Poké Ball' }, { tcggo_id: 7, etiqueta: 'Reverse Holo' }] }
  check('Prismatic Evolutions: estándar, Reverse, Master Ball y Poké Ball', ids(pre) === 'normal,reverse,master-ball,poke-ball', ids(pre))
  const holo = { id: 'x-1', set_id: 'x', variants: { holo: true }, versiones: [standard(8, 'x-1')] }
  check('una holo: la «Standard» es la holo, no una «Normal» de más', ids(holo) === 'holo', ids(holo))
  const nada = { id: 'y-1', set_id: 'y', variants: null, versiones: [standard(9, 'y-1')] }
  check('una de la que TCGdex no sabe nada: una sola versión, no las cuatro', v.variantesDeCarta(nada, v.TODAS).map((x) => x.nuestro).join() === 'normal', v.variantesDeCarta(nada, v.TODAS).map((x) => x.nuestro).join())
  const sinMirar = { id: 'z-1', set_id: 'z', variants: { normal: true, reverse: true } }
  check('la que TCGGO aún no ha mirado sigue con lo de TCGdex (hasta que pase)', ids(sinMirar) === 'normal,reverse', ids(sinMirar))
  // El precio de la copia normal es el de la carta (con cada idioma), no el
  // general de la fila «Standard».
  datos.registrarVersiones([{ tcggo_id: 11, card_id: 'pps6-1', etiqueta: 'Standard', cm_low: 1 }])
  const p = datos.precioDeLinea({ card_id: 'pps6-1', variante: 'normal' }, new Map([['pps6-1', { card_id: 'pps6-1', cm_low: 7, cm_low_es: 9, checked_at: '2026-10-21T10:00:00Z' }]]), new Map())
  check('el precio de la normal sale de la carta y no de la fila «Standard»', p?.desde === 7, JSON.stringify(p))
}

console.log('\n── 3. La pasada de precios la escribe ──')
{
  const precios = await import(`${RAIZ}/netlify/functions/tcggo-precios.mjs`)
  const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
  check('la pasada rehace hoy lo hecho (VERSION_VARIANTES subida)', precios.VERSION_VARIANTES === 937)
  const estados = { [CLAVE_PARES]: { episodios: { fecha: '2026-10-21T10:00:00Z', lista: [{ id: 431, nombre: '30th', codigo: '30C', cartas: 128, fecha: '2026-09-16', logo: 'https://images.tcggo.com/l.png', valorCm: 10 }] }, hechos: { por: { episodio: 431, pares: 3 } } }, tcggo_catalogo: {}, [precios.CLAVE_ESTADO]: {} }
  const vers = []
  const r = await precios.procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0', TCGGO_TOPE_DIARIO: '14000' },
    fetchImpl: async (url) => (/episode_id=431/.test(url) ? { ok: true, status: 200, text: async () => JSON.stringify({ ...DOC, paging: { current: 1, total: 1, per_page: 100 } }) } : { ok: false, status: 404, text: async () => 'no' }),
    restImpl: async (ruta) => {
      if (/^tcg_sets\?select=id&market=eq\.WEST/.test(ruta)) return [{ id: 'por' }]
      if (/^tcg_cards\?select=id,set_id,cm_id_product_propio/.test(ruta)) return DOC.data.map((c, i) => ({ id: `por-${i + 1}`, set_id: 'por', cm_id_product_propio: c.cardmarket_id }))
      return []
    },
    guardarImpl: async () => {}, guardarSetsImpl: async (f) => f.length, fotoImpl: async () => null,
    guardarVersionesImpl: async (f) => { vers.push(...f) },
    estadoImpl: async (k) => estados[k], guardarEstadoImpl: async (k, x) => { estados[k] = JSON.parse(JSON.stringify(x)) },
    pausa: async () => {}, ahora: AHORA,
  })
  const std = vers.filter((f) => f.etiqueta === 'Standard')
  check('una fila «Standard» por carta mirada, también las que no tienen versiones', r.ok && std.length === DOC.data.length && DOC.data.filter((c) => !(c.variants || []).length).every((c) => std.some((f) => f.tcggo_id === c.id)), `${std.length} de ${DOC.data.length}`)
  const vista = new Set()
  check('  …y ninguna fila repetida en el lote', vers.every((f) => (vista.has(f.tcggo_id) ? false : (vista.add(f.tcggo_id), true))))
  const fuente = readFileSync(join(RAIZ, 'netlify/functions/tcggo-versiones.mjs'), 'utf8')
  check('el refresco de versiones (807) no gasta peticiones en la fila de la carta', /or=\(etiqueta\.is\.null,etiqueta\.neq\.Standard\)/.test(fuente))
}

console.log('\n── 4. En la expansión ──')
{
  const SETS = [{ id: 'pps6', name: 'Prize Pack Series 6', name_en: 'Prize Pack Series 6', serie_id: 'sv', market: 'WEST', release_date: '2025-01-01', card_count_official: 2, card_count_total: 2 }]
  const CARTAS = [1, 2].map((n) => ({ id: `pps6-${n}`, market: 'WEST', set_id: 'pps6', local_id: String(n), name: n === 1 ? 'Dragapult' : 'Otra', name_es: n === 1 ? 'Dragapult' : 'Otra', image_path: `sv/pps6/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [887], variants: { normal: true, reverse: true }, tcg_sets: { id: 'pps6', name: 'Prize Pack Series 6', serie_id: 'sv' } }))
  // La 1 la ha mirado TCGGO (sin versiones); la 2 todavía no.
  const VERSIONES = [{ tcggo_id: 70001, market: 'WEST', card_id: 'pps6-1', set_id: 'pps6', etiqueta: 'Standard', cm_low: 2 }]
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => { window.__FAKE_SESSION__ = 'user-1'; try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}; Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_COLECCION__: [], __FAKE_ERAS__: [] }) }, { SETS, CARTAS, VERSIONES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|raw\.githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await p.goto(`${BASE}/mi-coleccion.html?ver=album&set=pps6`, { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await p.waitForTimeout(1000)
  await p.click('#mcVistaVariantes')
  await p.waitForTimeout(600)
  const sep = await p.evaluate(() => [...document.querySelectorAll('#mcAlbum .mc-bolsillo-enlace')].map((a) => `${a.dataset.carta}:${a.dataset.variante || '-'}`).join(' '))
  check('separadas: la del Prize Pack sale UNA vez; la que TCGGO no ha mirado, con lo de TCGdex', sep === 'pps6-1:normal pps6-2:normal pps6-2:reverse', sep)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await b.close()
}

console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
