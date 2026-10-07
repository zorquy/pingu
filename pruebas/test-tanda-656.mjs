// Tanda 656 — el calendario de lanzamientos sale del catálogo.
//
// PINGU: «transformar la página en un calendario de lanzamientos REAL,
// trayéndonos las fechas de la API… dos catálogos, occidental y japonés,
// con un desplegable; el próximo arriba y todos los demás en orden de
// fecha; literal todos; y automático».
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const hoy = new Date()
const d = (n) => new Date(hoy.getTime() + n * 86400000).toISOString().slice(0, 10)
const HOY = d(0)

const SETS = [
  { id: 'me03', market: 'WEST', name: 'Dominio Delta', name_en: 'Delta Reign', serie_id: 'me', release_date: d(32), card_count_official: 180, tcg_online_code: 'DRN', logo_tcggo: 'https://images.tcggo.com/me03.png' },
  { id: 'me04', market: 'WEST', name: 'Otra futura', name_en: 'Other', serie_id: 'me', release_date: d(90), card_count_official: 100, tcg_online_code: 'OTH' },
  { id: '30th', market: 'WEST', name: 'Celebración 30.º Aniversario', name_en: '30th Celebration', serie_id: 'me', release_date: d(-20), card_count_official: 25, tcg_online_code: '30C', tcggo_id: 552 },
  { id: '30th-c', market: 'WEST', name: 'Classic', name_en: 'Classic Collection', serie_id: 'me', release_date: d(-20), card_count_official: 30, tcg_online_code: '30C', tcggo_id: 552 },
  { id: 'me02', market: 'WEST', name: 'Oscuridad Absoluta', name_en: 'Pitch Black', serie_id: 'me', release_date: d(-81), card_count_official: 120, tcg_online_code: 'PBL', logo_tcggo: 'https://images.tcggo.com/me02.png' },
  { id: 'sv1', market: 'WEST', name: 'Escarlata y Púrpura', name_en: 'Scarlet & Violet', serie_id: 'sv', release_date: '2023-03-31', card_count_official: 198, tcg_online_code: 'SVI', logo_path: 'sv/sv1/logo' },
  { id: 'sinfecha', market: 'WEST', name: 'Sin fecha', serie_id: 'sv', release_date: null },
  { id: 'oculto1', market: 'WEST', name: 'Oculto', serie_id: 'sv', release_date: d(5), oculto: true },
  { id: 'A1', market: 'WEST', name: 'Pocket', serie_id: 'tcgp', release_date: d(3) },
  { id: 'base1_', market: 'JP', name: '拡張パック', name_en: 'Expansion Pack', serie_id: null, release_date: '1996-10-20', card_count_total: 102, tcg_online_code: 'BASE1_' },
  { id: 'M5', market: 'JP', name: 'アビスアイ', name_en: 'Abyss Eye', serie_id: 'M', release_date: d(12), card_count_total: 80, tcg_online_code: 'M5', logo_tcggo: 'https://images.tcggo.com/m5.png' },
]
const A_MANO = [
  { nombre: 'Dominio Delta', fecha: d(32), imagen: 'https://x/no.png' },
  { nombre: 'Set Anunciado', fecha: d(60), imagen: '', notas: 'anuncio de Japón' },
]

console.log('── 1. En puro ──')
{
  const m = await import(`${RAIZ}/js/lanzamientos.js`).catch((e) => ({ error: e }))
  // El módulo arranca `init()` al importarse; sin DOM no hace nada.
  if (m.error) { check('el módulo importa en Node', false, String(m.error)); process.exit(1) }
  const { eventosDelCatalogo, fundirConManuales, partir, porAnno, catalogoElegido, CATALOGOS } = m
  const ev = eventosDelCatalogo(SETS.filter((s) => s.market === 'WEST'), 'WEST')
  const ids = ev.map((e) => e.id)
  check('entran las que tienen fecha, no están escondidas y son del TCG', ids.includes('me03') && ids.includes('sv1') && !ids.includes('sinfecha') && !ids.includes('oculto1') && !ids.includes('A1'), ids.join(','))
  check('el 30 y la Classic son UNA expansión (y no desaparece ninguna)', ids.filter((x) => /30th/.test(x)).length === 1 && ev.find((e) => /30th/.test(e.id)).cartas === 55, ids.join(','))
  const delta = ev.find((e) => e.id === 'me03')
  check('cada evento lleva nombre, fecha, logo, código, cartas y su enlace al catálogo', delta.nombre === 'Dominio Delta' && delta.fecha === d(32) && delta.imagen === 'https://images.tcggo.com/me03.png' && delta.codigo === 'DRN' && delta.cartas === 180 && delta.href === '/cartas.html?ver=album&set=me03&catalogo=WEST', JSON.stringify(delta))
  check('  …y el logo cae a la ruta de TCGdex si no hay otro', ev.find((e) => e.id === 'sv1').imagen === 'https://assets.tcgdex.net/en/sv/sv1/logo.webp', ev.find((e) => e.id === 'sv1').imagen)
  const jp = eventosDelCatalogo(SETS.filter((s) => s.market === 'JP'), 'JP')
  check('el japonés se lee (nombre inglés) y enlaza con su catálogo', jp.find((e) => e.id === 'M5').nombre === 'Abyss Eye' && /catalogo=JP/.test(jp.find((e) => e.id === 'M5').href))
  const fundidos = fundirConManuales(ev, A_MANO)
  check('la lista a mano solo añade lo que el catálogo no tiene', fundidos.length === ev.length + 1 && fundidos.some((e) => e.manual && e.nombre === 'Set Anunciado' && e.href === null), fundidos.map((e) => e.nombre).join(','))
  const { siguiente, proximos, pasados } = partir(fundidos, HOY)
  check('el siguiente es el primero que viene', siguiente.id === 'me03')
  check('  …los demás que vienen, por fecha', proximos.map((e) => e.nombre).join(',') === 'Set Anunciado,Otra futura', proximos.map((e) => e.nombre).join(','))
  check('  …y los pasados TODOS, del más reciente al más viejo', pasados.map((e) => e.id).join(',') === '30th-c,me02,sv1', pasados.map((e) => e.id).join(','))
  check('un set que sale HOY cuenta como el siguiente', partir([{ nombre: 'Hoy', fecha: HOY }], HOY).siguiente?.nombre === 'Hoy')
  check('los pasados se agrupan por año', porAnno(pasados).map((g) => `${g.anno}:${g.eventos.length}`).join(',') === `${d(-20).slice(0, 4)}:2,2023:1` || porAnno(pasados).length === 3, JSON.stringify(porAnno(pasados).map((g) => [g.anno, g.eventos.length])))
  check('qué catálogo: la dirección manda, luego lo recordado, luego el occidental', catalogoElegido('?catalogo=JP', 'WEST') === 'JP' && catalogoElegido('', 'JP') === 'JP' && catalogoElegido('?catalogo=XX', 'ZZ') === 'WEST' && CATALOGOS.length === 2)
}

console.log('\n── 2. El ciclo de padres (lo destapó la captura) ──')
{
  const m = await import(`${RAIZ}/js/catalogo-series.js`)
  const sets = [{ id: '30th', tcggo_id: 552, card_count_official: 25 }, { id: '30th-c', tcggo_id: 552, card_count_official: 30 }]
  m.registrarEpisodios(sets)
  check('TCGGO manda: la Classic es el padre y el 30 cuelga de ella', m.padreDeColeccion('30th') === '30th-c' && m.padreDeColeccion('30th-c') === null)
  check('  …y al plegar queda UNA, con las cartas de las dos', m.plegarHermanos(sets.map((s) => ({ ...s }))).map((s) => `${s.id}:${s.card_count_official}`).join() === '30th-c:55')
  m.registrarEpisodios([])
  check('sin TCGGO, manda la lista a mano (el 30 es el padre)', m.padreDeColeccion('30th-c') === '30th' && m.padreDeColeccion('30th') === null)
}

const browser = await chromium.launch()
async function abrir(ruta, { ancho = 1200 } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(({ sets, aMano }) => { window.__FAKE_SETS__ = sets; window.__FAKE_AJUSTES__ = [{ key: 'lanzamientos', value: { sets: aMano } }]; window.__FAKE_SESSION__ = 'none' }, { sets: SETS, aMano: A_MANO })
  await page.route(/images\.tcggo\.com|assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" fill="#b08a2a"/></svg>' }))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, errores }
}

console.log('\n── 3. La página ──')
{
  const { page, errores } = await abrir('/lanzamientos.html')
  check('el desplegable ofrece los dos catálogos, con el occidental puesto', (await page.locator('#lanzCatalogo option').count()) === 2 && (await page.inputValue('#lanzCatalogo')) === 'WEST')
  // Desde la 753 cada uno lleva además su «Avísame» (un enlace sin cuenta).
  const dest = page.locator('#proximoDestacado')
  check('el siguiente va arriba, en grande, con cuenta atrás y enlace a su página', await dest.isVisible() && /Dominio Delta/.test(await dest.innerText()) && /Faltan 32 días/.test(await dest.innerText()) && (await dest.locator('a:not(.lanz-avisar)').getAttribute('href')) === '/cartas.html?ver=album&set=me03&catalogo=WEST', limpio(await dest.innerText()))
  const prox = page.locator('#listaProximos .lanz-evento')
  check('debajo, los que vienen (con el anunciado a mano)', (await prox.count()) === 2 && /Set Anunciado/.test(await prox.nth(0).innerText()) && /anunciado/.test(await prox.nth(0).innerText()) && (await prox.nth(0).locator('a:not(.lanz-avisar)').count()) === 0, limpio(await page.locator('#listaProximos').innerText()))
  const pas = page.locator('#listaPasados .lanz-evento')
  check('y los ya salidos, todos, por año y como enlaces', (await pas.count()) === 3 && (await page.locator('#listaPasados .lanz-anno-titulo').count()) === 2 && (await pas.nth(1).locator('a.lanzamiento-tarjeta').getAttribute('href')) === '/cartas.html?ver=album&set=me02&catalogo=WEST' && /3 expansiones/.test(await page.locator('#cuantosPasados').innerText()), limpio(await page.locator('#seccionPasados').innerText()).slice(0, 200))
  check('  …y Pocket, los escondidos y los sin fecha no están', !/Pocket|Oculto|Sin fecha/.test(await page.locator('main').innerText()))
  // Cambiar al japonés.
  await page.selectOption('#lanzCatalogo', 'JP')
  await page.waitForTimeout(1200)
  check('con el japonés, la dirección lo lleva y la lista cambia', /catalogo=JP/.test(page.url()) && /Abyss Eye/.test(await dest.innerText()) && /Expansion Pack/.test(await page.locator('#listaPasados').innerText()) && !/Dominio Delta/.test(await page.locator('main').innerText()), page.url())
  check('  …y el enlace de un set japonés lleva el catálogo', (await dest.locator('a:not(.lanz-avisar)').getAttribute('href')) === '/cartas.html?ver=album&set=M5&catalogo=JP')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
  const r = await abrir('/lanzamientos.html?catalogo=JP')
  check('la dirección manda al entrar', (await r.page.inputValue('#lanzCatalogo')) === 'JP' && /Abyss Eye/.test(await r.page.locator('#proximoDestacado').innerText()))
  await r.page.close()
}

console.log('\n── 4. El enlace abre el set en SU catálogo ──')
{
  const { page, errores } = await abrir('/cartas.html?ver=album&set=M5&catalogo=JP')
  await page.waitForTimeout(1200)
  check('/cartas con ?catalogo=JP se pone en japonés', (await page.locator('.mc-mercado').first().inputValue()) === 'ja')
  check('  …y abre el set', /Abyss Eye|アビスアイ/.test(limpio(await page.locator('main').innerText())), limpio(await page.locator('main').innerText()).slice(0, 160))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 5. La portada ──')
{
  const { page, errores } = await abrir('/index.html')
  const t = limpio(await page.locator('#lanzamientoPortada').innerText())
  check('la miniatura de la portada sale del catálogo', /Faltan 32 días/.test(t) && (await page.locator('#lanzamientoPortada img').getAttribute('src')) === 'https://images.tcggo.com/me03.png', t)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
  // Y si lo anunciado a mano sale ANTES, gana.
  const page2 = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page2.addInitScript(({ sets }) => { window.__FAKE_SETS__ = sets; window.__FAKE_AJUSTES__ = [{ key: 'lanzamientos', value: { sets: [{ nombre: 'Antes', fecha: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }] } }] }, { sets: SETS })
  await page2.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page2.waitForTimeout(1800)
  check('  …y gana el que salga antes, venga de donde venga', /Faltan 2 días/.test(limpio(await page2.locator('#lanzamientoPortada').innerText())) && /Antes/.test(limpio(await page2.locator('#lanzamientoPortada').innerText())), limpio(await page2.locator('#lanzamientoPortada').innerText()))
  await page2.close()
}

console.log('\n── 6. Lo estático ──')
{
  const html = readFileSync(`${RAIZ}/lanzamientos.html`, 'utf8')
  check('la página ya no dice que se mantiene a mano', !/mantenemos a mano/.test(html) && /id="lanzCatalogo"/.test(html))
  const admin = readFileSync(`${RAIZ}/admin/index.html`, 'utf8')
  check('/admin dice que la lista es para lo que TCGGO no tiene', /todavía no tiene/.test(admin))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
