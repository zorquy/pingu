// Tanda 1329 — Traer tu colección de otras apps (G5 del plan): de dónde viene
// (cómo sacarla y qué se lee), los moldes de TCGplayer y Cardmarket, y lo que
// no casa con «Buscarla» y un CSV para arreglarlo a mano.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const ap = await import(`${REPO}/js/mi-coleccion/importar-apps.js`)
const csv = await import(`${REPO}/js/mi-coleccion/importar-csv.js`)
check('seis orígenes: Dex, Collectr, TCGplayer, Cardmarket, Pokellector y «Excel u otra»', JSON.stringify(ap.APPS.map((a) => a.id)) === '["dex","collectr","tcgplayer","cardmarket","pokellector","otra"]')
check('los pasos dicen cómo sacarla y qué se lee, sin inventarse menús de otra app', /En Dex, busca «Exportar»/.test(ap.pasosDe('dex')) && /expansión y el número/.test(ap.pasosDe('dex')) && /Guarda la hoja como CSV/.test(ap.pasosDe('otra')) && ap.pasosDe('x') === '')
// TCGplayer
const tp = csv.leerCsv('Quantity,Name,Simple Name,Set,Card Number,Set Code,Printing,Condition,Language,Rarity,Product ID,SKU\n2,Pikachu ex - 063/191,Pikachu ex,SV08: Surging Sparks,063/191,SSP,Holofoil,Near Mint,English,Double Rare,123,456')
const rtp = csv.reconocerColumnas(tp[0])
const etp = csv.entradasDe(tp.slice(1), rtp.columnas)[0]
check('TCGplayer: se reconoce y se lee expansión, código, número, cantidad, versión, estado e idioma', rtp.origen === 'TCGplayer' && etp.codigo === 'SSP' && etp.numero && etp.cantidad === 2 && etp.idioma === 'en' && etp.estado === 'NM' && etp.variante === 'holo', JSON.stringify({ origen: rtp.origen, etp }))
// Cardmarket
const cm = csv.leerCsv('idProduct;Count;Name;Expansion;Number;Language;Condition;isFoil\n765432;1;Charizard ex;Obsidian Flames;125;Spanish;NM;true')
const rcm = csv.reconocerColumnas(cm[0])
const ecm = csv.entradasDe(cm.slice(1), rcm.columnas)[0]
check('Cardmarket: se reconoce, con su «;» y un foil como Reverse', rcm.origen === 'Cardmarket' && ecm.set === 'Obsidian Flames' && ecm.numero && ecm.idioma === 'es' && ecm.variante === 'reverse', JSON.stringify({ origen: rcm.origen, ecm }))
const perdidas = [{ entrada: { fila: 3, nombre: 'Mew', set: 'Raro', numero: '151', cantidad: 1, idioma: 'es', estado: 'NM' }, motivo: 'no conozco la expansión «Raro»' }, { entrada: { fila: 4, nombre: '', set: '151', numero: '7', cantidad: 2 }, motivo: 'sin número' }]
const h = ap.perdidasHtml(perdidas)
check('lo que no casa: cada fila con «Buscarla» (por nombre, o por expansión y número) y «Descargar las que faltan»', /href="\/mi-coleccion\?ver=buscar&amp;q=Mew"/.test(h) && /q=151%207/.test(h) && /data-imp-descargar-perdidas/.test(h), h.slice(0, 300))
const c = ap.csvDePerdidas(perdidas)
check('  …y su CSV con el porqué de cada una', c.split('\n').length === 3 && /Por qué no entró/.test(c) && /no conozco la expansión «Raro»/.test(c))
const imp = readFileSync(`${REPO}/js/mi-coleccion/importar.js`, 'utf8')
check('el importador pinta lo que no casa con perdidasHtml y ofrece elegir la app', /perdidasHtml\(/.test(imp) && /data-imp-app/.test(imp))

console.log('── La pantalla ──')
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'sv2', name: 'Evoluciones en Paldea', name_en: 'Paldea Evolved', serie_id: 'sv', market: 'WEST', card_count_official: 193, card_count_total: 279, logo_path: 'x/l', tcg_online_code: 'PAL' }]
  window.__FAKE_CARTAS__ = [{ id: 'sv2-25', market: 'WEST', set_id: 'sv2', local_id: '25', name: 'Pikachu', name_es: 'Pikachu', image_path: 'x/1', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } }]
  window.__FAKE_COLECCION__ = []
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**api.tcgdex.net/**', (r) => r.abort())
await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#mcImportarAbrir', { state: 'attached', timeout: 10000 }).catch(() => {})
await page.evaluate(() => document.getElementById('mcImportarAbrir')?.click())
await page.waitForSelector('#mcImpApps', { timeout: 8000 }).catch(() => {})
check('al abrir: «¿De dónde la traes?» con las seis', (await page.locator('#mcImpApps [data-imp-app]').count()) === 6)
await page.click('#mcImpApps [data-imp-app="tcgplayer"]')
check('elegir TCGplayer dice cómo sacarla y qué se lee', /En TCGplayer, busca «Exportar»/.test(await page.locator('#mcImpPasos').textContent()) && (await page.getAttribute('[data-imp-app="tcgplayer"]', 'aria-pressed')) === 'true')
await page.fill('#mcImpTexto', 'Quantity,Name,Simple Name,Set,Card Number,Set Code,Printing,Condition,Language\n1,Pikachu - 025/193,Pikachu,Paldea Evolved,025/193,PAL,Normal,Near Mint,English\n1,Mew,Mew,Set Inventado,151/165,ZZZ,Normal,Near Mint,English')
await page.click('#mcImpAnalizar')
await page.waitForSelector('#mcImpPaso2:not(.hidden)', { timeout: 8000 }).catch(() => {})
const res = await page.locator('#mcImpResumen').textContent().catch(() => '')
check('reconoce el formato de TCGplayer y casa la que existe', /formato de TCGplayer/.test(res) && /1 carta encontrada/.test(res), res.replace(/\s+/g, ' '))
check('la que no casa sale con «Buscarla» y «Descargar las que faltan»', (await page.locator('#mcImpPerdidas .mc-imp-buscar[href*="q=Mew"]').count()) === 1 && (await page.locator('[data-imp-descargar-perdidas]').count()) === 1)
const [d] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('[data-imp-descargar-perdidas]')])
check('  …y se descarga el CSV de las que faltan', d && d.suggestedFilename() === 'cartas-sin-encontrar.csv')
check('sin errores en la página', errores.length === 0, errores.join(' | '))
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
