// Tanda 778 — la chapa y el velo de la versión, también en la CUADRÍCULA.
//
// PINGU, con el iPhone en una expansión y «separar variantes»: «salen las
// variantes, pero no sale como antes cuál es holo y cuál es reverse holo,
// y el brillo especial de la reverse». La chapa (461) y el velo del reverse
// (461) solo los pintaba el ARCHIVADOR (`bolsilloDeVariante`); la
// cuadrícula (478) llevaba la versión en el rótulo accesible y nada más, y
// es la vista que PINGU tiene puesta en el móvil: Tropius y Tropius, dos
// casillas iguales. Es el aviso de la 458 —dos pintores de casilla, y
// arreglar uno deja medio álbum con el fallo— con un tercero.
//
// Lo que se mira, en la cuadrícula y en el móvil y el escritorio: cada
// casilla de una versión lleva su chapa, SE VE (no la tapa nada), no pisa el
// «+», el velo va solo en las reverse, y con las versiones juntas no hay
// chapa.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs"

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// ── LOS MANDOS DE LA CABECERA VIVEN DETRÁS DEL ⋮ (tanda 475) ──
// Encontrar un elemento no es poder pulsarlo, así que hay que abrir el menú
// primero. Y se cierra solo al elegir, así que cada pulsación abre otra vez.
const porElMenu = async (page, sel) => {
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(250)
  await page.click(sel)
  await page.waitForTimeout(350)
}
const browser = await chromium.launch()
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

const abrir = async ({ ancho = 1280, ruta = '/mi-coleccion.html?ver=album' } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  // Una captura con los datos a medias no es la pantalla (la 441).
  await page.route('**assets.tcgdex.net/**', (r) => r.fulfill({ path: SC + '/visual/carta.png', contentType: 'image/png' }))
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    try { localStorage.setItem('mc-album-vista', 'cuadricula') } catch {}
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST',
      card_count_official: 12, card_count_total: 12, logo_path: 'x/l', release_date: '2026-09-26', tcg_online_code: 'MEE' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({
      id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: 'Bulbasaur ' + (i + 1), image_path: 'x/' + (i + 1), rarity: 'Common',
      category: 'Pokemon', types: ['Grass'], dex_ids: [1], variants: { normal: true, reverse: true },
    }))
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-01T00:00:00Z' },
      { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'reverse', created_at: '2026-09-02T00:00:00Z' },
      { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-09-03T00:00:00Z' },
    ]
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}
const abrirSet = async (page) => {
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1300)
}

for (const ancho of [390, 1280]) {
  console.log(`\n── ${ancho} px ──`)
  const { page, errores } = await abrir({ ancho })
  await abrirSet(page)
  check('la vista es la cuadrícula', await page.isVisible('#mcAlbum .mc-album-cuadricula'))
  check('con las versiones juntas, sin chapa', (await page.locator('#mcAlbum .mc-chapa-variante').count()) === 0)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(1000)
  const celdas = await page.locator('#mcAlbum .mc-rejilla-celda').evaluateAll((ns) => ns.map((n) => ({
    chapa: n.querySelector('.mc-chapa-variante')?.dataset.var || null,
    texto: n.querySelector('.mc-chapa-variante')?.textContent || '',
    velo: Boolean(n.querySelector('.mc-velo-reverse')),
  })))
  check('separadas: 24 casillas, cada una con su chapa', celdas.length === 24 && celdas.every((c) => c.chapa), JSON.stringify(celdas.slice(0, 2)))
  check('  …y dicen cuál es cada una', celdas[0].texto.startsWith('N') && celdas[1].texto.startsWith('RH'), celdas.slice(0, 2).map((c) => c.texto).join(' | '))
  check('el velo, en las reverse y en ninguna más', celdas.every((c) => c.velo === (c.chapa === 'reverse')), JSON.stringify(celdas.filter((c) => c.velo !== (c.chapa === 'reverse')).slice(0, 2)))
  const tapadas = await page.locator('#mcAlbum .mc-rejilla-celda .mc-chapa-variante').evaluateAll((ns) =>
    ns.slice(0, 6).filter((n) => {
      const r = n.getBoundingClientRect()
      if (!r.width || !r.height) return true
      n.style.pointerEvents = 'auto'
      const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      n.style.pointerEvents = ''
      return !(encima === n || n.contains(encima))
    }).length)
  check('ninguna chapa tapada', tapadas === 0, String(tapadas))
  const pisa = await page.locator('#mcAlbum .mc-rejilla-celda').evaluateAll((ns) => ns.slice(0, 6).filter((n) => {
    const c = n.querySelector('.mc-chapa-variante')?.getBoundingClientRect()
    const m = n.querySelector('.mc-mas')?.getBoundingClientRect()
    return c && m && c.right > m.left + 1 && c.bottom > m.top + 1 && c.top < m.bottom - 1
  }).length)
  check('  …ni se monta sobre el «+»', pisa === 0, String(pisa))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
