// Tanda 757 — en una expansión, lo que falta en gris y lo tuyo con su marca.
//
// PINGU eligió la «propuesta 1»: lo que te falta en gris de verdad (sin
// transparencia, sin el nombre asomando), lo tuyo a color con un ✓ arriba
// a la derecha —«×N» si tienes más de una— y abajo la versión que tienes
// cuando la carta tiene varias; el «+» pequeño en la esquina y solo en lo
// que falta (lo tuyo se suma desde la ficha). Se mira en las dos vistas
// que pintan cartas (archivador y cuadrícula), en el móvil y con ratón.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const CARTA = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="hsl(${n * 40} 70% 55%)"/></svg>`

async function abrir({ movil, vista }) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES' })
  await ctx.addInitScript((v) => {
    window.__FAKE_SESSION__ = 'admin-1'
    if (v) localStorage.setItem('mc-album-vista', v)
    window.__FAKE_SETS__ = [{ id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', card_count_official: 6, card_count_total: 6, release_date: '2023-09-22', tcg_online_code: 'MEW' }]
    window.__FAKE_CARTAS__ = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `sv3pt5-${n}`, set_id: 'sv3pt5', market: 'WEST', local_id: String(n), name: `Carta ${n}`, image_path: `sv/sv3pt5/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: n === 6 ? { normal: true } : { normal: true, reverse: true } }))
    const l = (id, card, cantidad, variante = 'normal') => ({ id, user_id: 'admin-1', card_id: card, market: 'WEST', cantidad, idioma: 'es', estado: 'NM', variante, created_at: '2026-10-01T10:00:00Z' })
    // 1: una normal · 2: dos reverse · 3: normal + reverse · 6: una (sin versiones)
    window.__FAKE_COLECCION__ = [l('a', 'sv3pt5-1', 1), l('b', 'sv3pt5-2', 2, 'reverse'), l('c', 'sv3pt5-3', 1), l('d', 'sv3pt5-3', 1, 'reverse'), l('e', 'sv3pt5-6', 1)]
  }, vista)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg\.io|scrydex/, (r) => {
    const m = r.request().url().match(/sv3pt5\/(\d+)/)
    // La 5 sin foto en ningún sitio: su casilla enseña nombre y número.
    if (!m || m[1] === '5') return r.fulfill({ status: 404, body: '' })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: CARTA(Number(m[1])) })
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv3pt5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { page, ctx, errores }
}

for (const [rotulo, movil, vista, sel] of [['móvil · archivador', true, null, '.mc-bolsillo'], ['ratón · archivador', false, null, '.mc-bolsillo'], ['móvil · cuadrícula', true, 'cuadricula', '.mc-rejilla-celda']]) {
  console.log(`── ${rotulo} ──`)
  const { page, ctx, errores } = await abrir({ movil, vista })
  const casillas = await page.evaluate((s) => [...document.querySelectorAll(`#mcAlbum ${s}`)].map((c) => {
    const id = c.querySelector('[data-carta]')?.dataset.carta || c.dataset.carta
    const img = c.querySelector('img')
    const mas = c.querySelector('.mc-mas')
    const marca = c.querySelector('.mc-tengo-marca')
    const version = c.querySelector('.mc-tengo-version')
    const num = c.querySelector('.mc-bolsillo-num')
    const r = c.getBoundingClientRect()
    const rm = mas?.getBoundingClientRect()
    const dibujo = mas ? (getComputedStyle(mas, '::before').content !== 'none' ? mas.getBoundingClientRect().width - 16 : rm.width) : null
    return {
      id, tengo: c.classList.contains('tengo'),
      img: img ? { filtro: getComputedStyle(img).filter, opacidad: getComputedStyle(img).opacity } : null,
      mas: mas && getComputedStyle(mas).display !== 'none' ? { ancho: rm.width, dibujo, abajoDerecha: rm.right <= r.right + 0.5 && rm.bottom <= r.bottom + 0.5 && rm.left > r.left + r.width / 2 && rm.top > r.top + r.height / 2 } : null,
      marca: marca && getComputedStyle(marca).display !== 'none' ? { texto: marca.textContent, arribaDerecha: marca.getBoundingClientRect().top < r.top + 16 && marca.getBoundingClientRect().right > r.right - 16 } : null,
      version: version ? version.textContent : null,
      num: num ? getComputedStyle(num).display !== 'none' : null,
    }
  }), sel)
  const de = (n) => casillas.find((c) => c.id === `sv3pt5-${n}`)
  check('salen las seis', casillas.length === 6, JSON.stringify(casillas.map((c) => c.id)))
  check('lo que falta, en GRIS y opaco (sin el nombre asomando)', [4].every((n) => /grayscale\(1\)/.test(de(n)?.img?.filtro || '') && de(n).img.opacidad === '1'), JSON.stringify(de(4)?.img))
  check('lo tuyo, a color', [1, 2, 3, 6].every((n) => de(n)?.img?.filtro === 'none'), JSON.stringify([1, 2, 3, 6].map((n) => de(n)?.img)))
  check('una copia: ✓ arriba a la derecha', de(1)?.marca?.texto === '✓' && de(1).marca.arribaDerecha && de(6)?.marca?.texto === '✓', JSON.stringify([de(1)?.marca, de(6)?.marca]))
  check('más de una: «×N» en su sitio', de(2)?.marca?.texto === '×2' && de(2).marca.arribaDerecha && de(3)?.marca?.texto === '×2', JSON.stringify([de(2)?.marca, de(3)?.marca]))
  check('lo que falta no lleva marca', !de(4)?.marca && !de(5)?.marca)
  if (sel === '.mc-bolsillo' || vista) {
    check('la versión que tienes, abajo, solo si la carta tiene varias (y no es solo la normal, 781)', de(1)?.version === null && de(2)?.version === 'Reverse holo' && de(3)?.version === 'N + RH' && de(6)?.version === null && de(4)?.version === null, JSON.stringify([1, 2, 3, 4, 6].map((n) => de(n)?.version)))
  }
  check('el «+» solo en lo que falta, en la esquina de abajo a la derecha', [4, 5].every((n) => de(n)?.mas?.abajoDerecha) && [1, 2, 3, 6].every((n) => !de(n)?.mas), JSON.stringify(casillas.map((c) => [c.id, c.mas])))
  check(movil ? '  …44 px que se tocan, con un círculo dibujado de 28' : '  …de 28 px con el ratón', movil ? de(4)?.mas?.ancho === 44 : de(4)?.mas?.ancho === 28, JSON.stringify(de(4)?.mas))
  if (sel === '.mc-bolsillo') check('el número de la casilla, solo en la que no tiene foto', de(4)?.num === false && de(5)?.num === true, JSON.stringify([de(4)?.num, de(5)?.num]))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
