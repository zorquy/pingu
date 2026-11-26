// Tanda 1459 — la pantalla: traer un CSV de TheHobbyClub (lo que tienes a la
// colección, lo que te falta a «La quiero» y, si quieres, a una lista por
// colección), «Adónde van → para cambio» con un CSV de Cardmarket, y «Para
// Cardmarket» desde el ⋯ de «La quiero» y de «Las que doy».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`) }

const SETS = [{ id: 'sm3', name: 'Sombras Ardientes', name_en: 'Burning Shadows', serie_id: 'sm', market: 'WEST', card_count_official: 147, card_count_total: 169, logo_path: 'x/l', tcg_online_code: 'BUS', release_date: '2017-08-04' }]
const carta = (id, name, category, extra = {}) => ({ id, market: 'WEST', set_id: 'sm3', local_id: id.split('-')[1], name, name_es: name, image_path: `x/${id}`, rarity: 'Common', category, variants: { normal: true, reverse: true }, ...extra })
const CARTAS = [
  carta('sm3-112', 'Acerola', 'Trainer', { name_en: 'Acerola', cm_id_product_propio: 449253 }),
  carta('sm3-142', 'Acerola', 'Trainer', { name_en: 'Acerola' }),
  carta('sm3-20', 'Lucario', 'Pokemon', { name_en: 'Lucario', cm_id_product_propio: 700020, detalle_lang: 'en', attacks: [{ name: 'Vacuum Wave' }, { name: 'Fight Alone' }] }),
  carta('sm3-21', 'Lucario', 'Pokemon', { name_en: 'Lucario', detalle_lang: 'es', attacks: [{ name: 'Esfera Aural' }] }),
]
const CAB = 'coleccion,tipo,estado,carta,set,set_id,numero,variante,idioma,estado_carta,gradeada,empresa_gradeo,nota_gradeo,precio_compra,fecha_compra,notas,posicion,pokedex,cardmarket_id'
const THC = [
  CAB,
  'Liga,custom,have,Lucario [Vacuum Wave | Fight Alone],Burning Shadows,sm3_es,sm3_es-20,normal,ES,NM,0,,,,,,1,,700020',
  'Liga,custom,missing,Acerola,Burning Shadows,sm3_es,sm3_es-112,reverseHolofoil,ES,NM,0,,,,,,2,,449253',
  'Liga,custom,missing,Acerola,Burning Shadows,cmset_1824_es,449248,cardmarket_only,ES,NM,0,,,,,,3,,449248',
  'Liga,custom,,Acerola,Burning Shadows,cmset_1824_es,449249,cardmarket_only,ES,NM,0,,,,,,4,,449249',
].join('\n')

const browser = await chromium.launch()
async function abrir(ruta, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block', acceptDownloads: true })
  await ctx.addInitScript((d) => Object.assign(window, { __FAKE_SESSION__: 'admin-1', __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: [], __FAKE_DESEOS__: [], __FAKE_PRECIOS__: [] }, d.extra), { SETS, CARTAS, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  // TCGdex en inglés: la GraphQL contesta por alias con los ataques EN INGLÉS.
  const preguntas = []
  await ctx.route(/api\.tcgdex\.net/, (r) => {
    const q = r.request().postData() || ''
    if (!/graphql/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    const ids = [...JSON.parse(q).query.matchAll(/(c\d+): card\(id: "([^"]+)"\)/g)]
    preguntas.push(ids.map((m) => m[2]))
    const EN = { 'sm3-21': { name: 'Lucario', attacks: [{ name: 'Aura Sphere' }], abilities: [] }, 'sm3-20': { name: 'Lucario', attacks: [{ name: 'Vacuum Wave' }, { name: 'Fight Alone' }], abilities: [] } }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: Object.fromEntries(ids.map((m) => [m[1], EN[m[2]] || null])) }) })
  })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 220)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores, preguntas }
}
const tablas = (page) => page.evaluate(() => JSON.parse(JSON.stringify({ c: window.__TABLAS__.user_collection, w: window.__TABLAS__.user_wants, l: window.__TABLAS__.user_want_lists || [], i: window.__TABLAS__.user_want_list_items || [] })))
async function importar(page, { app, texto, destino }) {
  await page.waitForSelector('#mcImportarAbrir', { state: 'attached', timeout: 10000 }).catch(() => {})
  await page.evaluate(() => document.getElementById('mcImportarAbrir')?.click())
  await page.waitForSelector('#mcImpApps', { timeout: 8000 }).catch(() => {})
  if (app) await page.click(`#mcImpApps [data-imp-app="${app}"]`)
  if (destino) await page.selectOption('#mcImpDestino', destino)
  await page.fill('#mcImpTexto', texto)
  await page.click('#mcImpAnalizar')
  await page.waitForSelector('#mcImpPaso2:not(.hidden)', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(400)
}

console.log('── 1. Un CSV de TheHobbyClub ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=resumen', { __FAKE_LISTAS__: [] })
  await importar(page, { app: 'thehobbyclub', texto: THC })
  check('elegir TheHobbyClub dice qué se lee', /TheHobbyClub/.test(await page.textContent('#mcImpPasos')) && /La quiero/.test(await page.textContent('#mcImpPasos')))
  const resumen = (await page.textContent('#mcImpResumen')).replace(/\s+/g, ' ')
  check('el resumen: 3 encontradas, 1 sin encontrar, formato de TheHobbyClub', /3 cartas encontradas/.test(resumen) && /1 sin encontrar/.test(resumen) && /formato de TheHobbyClub/.test(resumen), resumen)
  check('  …1 a tu colección y 2 a «La quiero», y por qué', /1 a tu colección/.test(resumen) && /2 a «La quiero»/.test(resumen) && /marca como que te faltan van a «La quiero»/.test(resumen), resumen)
  check('  …y la del sello, sin número, encontrada por su nombre', /1 sin número .* se ha encontrado por su nombre/.test(resumen), resumen)
  check('lo que no dice si la tienes o te falta, en «Sin encontrar» con su porqué', /no dice si la tienes o te falta/.test(await page.textContent('#mcImpPerdidas')))
  check('la casilla de las listas, una por colección (1)', await page.isVisible('#mcImpListasSi') && /colección de TheHobbyClub \(1\)/.test(await page.textContent('#mcImpListas')), await page.textContent('#mcImpListas').catch(() => ''))
  check('el botón dice «Importar 3 cartas»', /Importar 3 cartas/.test(await page.textContent('#mcImpConfirmar')), await page.textContent('#mcImpConfirmar'))
  const lista = (await page.textContent('#mcImpLista')).replace(/\s+/g, ' ')
  check('la lista marca cuáles van a «La quiero», con el nombre de su expansión', (lista.match(/La quiero/g) || []).length === 2 && (lista.match(/Sombras Ardientes/g) || []).length === 3, lista)
  await page.click('#mcImpConfirmar')
  await page.waitForTimeout(1500)
  const t = await tablas(page)
  const mias = t.c.filter((l) => l.user_id === 'admin-1')
  check('a la colección: el Lucario que tienes', mias.length === 1 && mias[0].card_id === 'sm3-20' && mias[0].idioma === 'es', JSON.stringify(mias))
  const w = t.w.filter((x) => x.user_id === 'admin-1').map((x) => `${x.card_id}|${x.idioma}|${x.variante}`).sort()
  check('a «La quiero»: la Acerola reverse y la del sello (sobre la normal)', JSON.stringify(w) === JSON.stringify(['sm3-112|es|normal', 'sm3-112|es|reverse']), JSON.stringify(w))
  const listas = t.l.filter((x) => x.user_id === 'admin-1')
  check('  …y en una lista que se llama como la colección', listas.length === 1 && listas[0].nombre === 'Liga' && t.i.some((x) => x.list_id === listas[0].id && x.card_id === 'sm3-112'), JSON.stringify({ l: listas, i: t.i }))
  check('el diálogo se cierra', !(await page.evaluate(() => document.getElementById('mcImportarDialogo')?.open)))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. «Adónde van → para cambio» con un CSV de Cardmarket ──')
{
  // El Lucario ya estaba (una copia, ninguna para cambio): importar 3 suma 3.
  const ya = [{ id: 'm1', user_id: 'admin-1', card_id: 'sm3-20', market: 'WEST', cantidad: 1, cambio: 0, idioma: 'es', estado: 'EX', variante: 'normal', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' }]
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=resumen', { __FAKE_COLECCION__: ya })
  await importar(page, { app: 'cardmarket', destino: 'cambio', texto: 'idProduct,Count,Name,Expansion,Number,Language,Condition,isFoil,Comments\r\n700020,3,Lucario,Burning Shadows,20,Spanish,EX,,\r\n449253,1,Acerola,Burning Shadows,112,English,NM,true,' })
  const resumen = (await page.textContent('#mcImpResumen')).replace(/\s+/g, ' ')
  check('2 a tu colección y para cambio, en «Las que doy»', /2<\/strong> a tu colección y para cambio|2 a tu colección y para cambio/.test(resumen) && /4 copias/.test(resumen), resumen)
  await page.click('#mcImpConfirmar')
  await page.waitForTimeout(1500)
  const mias = (await tablas(page)).c.filter((l) => l.user_id === 'admin-1').map((l) => `${l.card_id}|${l.cantidad}|${l.cambio}|${l.idioma}|${l.estado}|${l.variante}`).sort()
  check('entran con todas sus copias para cambio, su idioma, su estado y el foil como reverse; la que ya tenías suma las 3 y las da', JSON.stringify(mias) === JSON.stringify(['sm3-112|1|1|en|NM|reverse', 'sm3-20|4|3|es|EX|normal']), JSON.stringify(mias))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. «Para Cardmarket» en el ⋯ de «La quiero» ──')
{
  const extra = {
    __FAKE_COLECCION__: [{ id: 'm1', user_id: 'admin-1', card_id: 'sm3-20', market: 'WEST', cantidad: 2, cambio: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' }],
    __FAKE_DESEOS__: [{ id: 'd1', user_id: 'admin-1', card_id: 'sm3-112', idioma: null, variante: null, prioridad: 1, created_at: '2026-11-01T10:00:00Z' }],
  }
  const { ctx, page, errores, preguntas } = await abrir('/mi-coleccion.html?ver=quiero', extra)
  await page.click('#mcQuieroMenu')
  await page.waitForTimeout(300)
  check('la opción está en el ⋯', await page.isVisible('#mcListasHoja [data-accion="cardmarket"]'))
  await page.click('#mcListasHoja [data-accion="cardmarket"]')
  await page.waitForSelector('#mcCmHoja[open]', { timeout: 5000 }).catch(() => {})
  const hoja = (await page.textContent('#mcCmHoja').catch(() => '')).replace(/\s+/g, ' ')
  check('se abre la hoja con «La quiero» (1 carta) marcada', /Lo que tienes en «La quiero» \(1 carta\)/.test(hoja) && await page.isChecked('#mcCmQuiero'), hoja)
  check('  …y tus expansiones empezadas, sin marcar (eliges tú cuáles)', /Sombras Ardientes/.test(hoja) && /tienes 1 de 169/.test(hoja) && !(await page.isChecked('#mcCmHoja [data-cm-set="sm3"]')), hoja)
  await page.check('#mcCmHoja [data-cm-set="sm3"]')
  await page.click('#mcCmPreparar')
  await page.waitForSelector('#mcCmTexto', { timeout: 8000 }).catch(() => {})
  const texto = await page.inputValue('#mcCmTexto').catch(() => '')
  check('la lista: las dos Acerola en una línea y el Lucario que falta con sus ataques en inglés', texto.split('\n').sort().join('|') === '1x Lucario Aura Sphere|2x Acerola', texto)
  check('  …el Lucario que tienes no está (no te falta)', !/Vacuum Wave/.test(texto), texto)
  check('  …y a TCGdex solo se le pregunta por lo que no está en inglés, en una consulta', preguntas.length === 1 && JSON.stringify(preguntas[0]) === '["sm3-21"]', JSON.stringify(preguntas))
  check('«Copiar la lista» está', await page.isVisible('#mcCmCopiar'))
  check('sin errores', !errores.length, errores.join(' | '))

  console.log('── 4. «Para Cardmarket» en el ⋯ de «Las que doy» ──')
  await page.evaluate(() => document.getElementById('mcCmHoja')?.close())
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(1200)
  await page.click('#mcDoyMenu')
  await page.waitForTimeout(300)
  const espera = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.click('#mcListasHoja [data-accion="cardmarket"]')
  const descarga = await espera
  check('se descarga las-que-doy-cardmarket.csv', descarga?.suggestedFilename() === 'las-que-doy-cardmarket.csv', descarga?.suggestedFilename())
  if (descarga) {
    const { readFileSync } = await import('node:fs')
    const csv = readFileSync(await descarga.path(), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)
    check('  …con la cabecera de Cardmarket y la que das con su id de producto', csv[0] === 'idProduct,Count,Name,Expansion,Number,Language,Condition,isFoil,Comments' && csv[1] === '700020,1,Lucario,Burning Shadows,20,Spanish,NM,,', csv.join(' | '))
  }
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
