// Tanda 1407 — «Sugerir», «Ordenar la página» y «Llenar los huecos» en un
// binder tuyo (PINGU eligió lo recomendado: tus cartas, en el navegador).
// Las fotos son de mentira pero con COLOR (y la cabecera CORS que manda
// TCGdex), para que las cuentas digan algo: la página es azul, y entre tus
// cartas hay azules, rojas y verdes.
//   · Un hueco de una página con cartas lleva «Sugerir»; el de una página
//     vacía, no. Tocar el hueco sigue abriendo el buscador.
//   · «Sugerir» abre la hoja con los 3 colores de la página y la lista: la
//     primera es azul, cada una con su porqué en palabras y sus puntos.
//   · «Ponerla aquí» la mete en ESE bolsillo.
//   · «Ordenar la página» (⋯) reordena sin perder ni repetir, con Deshacer.
//   · «Llenar los huecos» llena los de la página con cartas tuyas, sin repetir.
//   · En el móvil, la hoja sube de abajo y no desborda; en oscuro también.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// 1-12 azules (la página y alguna más), 13-16 rojas, 17-20 verdes, 21-24 azules.
const COLOR = (n) => (n <= 12 || n > 20 ? ['#2f6fb3', '#4a90d9', '#7fb8e8', '#1d4f86'][n % 4] : n <= 16 ? ['#c62828', '#e0521f', '#a3201b', '#d84315'][n % 4] : ['#2e7d32', '#55a630', '#1b5e20', '#7cb342'][n % 4])
const ES_AZUL = (n) => n <= 12 || n > 20
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${COLOR(n)}"/><stop offset="1" stop-color="${COLOR(n + 1)}"/></linearGradient></defs><rect width="245" height="342" fill="url(#g)"/><circle cx="122" cy="140" r="${40 + (n % 5) * 6}" fill="#ffffff" fill-opacity="0.35"/></svg>`
const N = 24
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Illustration Rare', category: 'Pokemon', types: [ES_AZUL(i + 1) ? 'Water' : 'Fire'], variants: { holo: true } }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-11-01T10:00:00Z' }))
// Página 1: azules con el centro vacío (bolsillo 5). Página 2 vacía.
const PAGINA = [1, 2, 3, 4, null, 5, 6, 7, 8]
const ALBUMES = [
  { id: 'alb-agua', user_id: 'admin-1', nombre: 'Agua y cielo', tipo: 'binder', rejilla: '3x3', paginas: 4, tapa: 'azul', is_public: false, cartas: PAGINA.map((n) => (n ? { id: `sv8-${n}` } : {})), updated_at: '2026-11-20T10:00:00Z' },
  // Para ordenar: una mezcla de nueve, azules, rojas y verdes.
  { id: 'alb-mezcla', user_id: 'admin-1', nombre: 'Mezcla', tipo: 'binder', rejilla: '3x3', paginas: 2, tapa: 'roja', is_public: false, cartas: [13, 1, 17, 2, 14, 18, 3, 15, 19].map((n) => ({ id: `sv8-${n}` })), updated_at: '2026-11-19T10:00:00Z' },
]

const browser = await chromium.launch()
async function abrir(album, { movil = false, tema = 'light' } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: tema, serviceWorkers: 'block' } : { viewport: { width: 1440, height: 1000 }, locale: 'es-ES', colorScheme: tema, serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES, COLECCION, tema }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS; window.__FAKE_COLECCION__ = COLECCION; window.__FAKE_ALBUMES__ = ALBUMES
    try { localStorage.setItem('pokedoc-theme', tema); localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('pd-armonia-v1') } catch {}
  }, { SETS, CARTAS, ALBUMES, COLECCION, tema })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|scrydex/, (r) => {
    const n = Number((r.request().url().match(/sv8\/(\d+)/) || [])[1] || 1)
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: svg(n) })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=carpetas&album=${album}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-hoja', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  return { ctx, page, errores }
}
const cartasDe = (page, id) => page.evaluate((id) => (window.__TABLAS__?.user_albums || []).find((a) => a.id === id)?.cartas?.map((c) => c?.id || null) || [], id)

// ── PC ──
{
  const { ctx, page, errores } = await abrir('alb-agua')
  const huecos = await page.evaluate(() => [...document.querySelectorAll('#mcAlbArchivador .mc-bolsillo-hueco')].map((h) => ({ i: Number(h.dataset.indice), elegir: !!h.querySelector('[data-hueco]'), sugerir: !!h.querySelector('[data-sugerir]') })))
  const cinco = huecos.find((h) => h.i === 4)
  check('PC: el hueco 5 lleva su botón de elegir y «Sugerir»', cinco?.elegir && cinco?.sugerir, JSON.stringify(huecos.slice(0, 3)))
  check('PC: los huecos de la página vacía, sin «Sugerir»', huecos.filter((h) => h.i >= 9).length > 0 && huecos.filter((h) => h.i >= 9).every((h) => !h.sugerir), huecos.filter((h) => h.i >= 9).length)
  const pastilla = await page.evaluate(() => {
    const h = document.querySelector('#mcAlbArchivador [data-indice="4"]').getBoundingClientRect()
    const b = document.querySelector('[data-sugerir="4"]').getBoundingClientRect()
    return { dentro: b.left >= h.left && b.right <= h.right && b.bottom <= h.bottom && b.top >= h.top + h.height / 2, alto: Math.round(b.height) }
  })
  check('PC: «Sugerir» va abajo, dentro del bolsillo', pastilla.dentro && pastilla.alto >= 26, JSON.stringify(pastilla))
  // Tocar el hueco (fuera de la pastilla) sigue abriendo el buscador.
  await page.click('#mcAlbArchivador [data-hueco="4"]', { position: { x: 20, y: 20 } })
  await page.waitForTimeout(700)
  const buscador = await page.evaluate(() => /bolsillo 5/i.test(document.body.innerText))
  check('PC: tocar el hueco sigue abriendo el buscador del bolsillo 5', buscador)
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir('alb-agua')
  await page.click('[data-sugerir="4"]')
  await page.waitForFunction(() => document.querySelectorAll('#mcArmoniaLista .arm-fila').length >= 4, null, { timeout: 20000 }).catch(() => {})
  const hoja = await page.evaluate(() => {
    const d = document.getElementById('mcArmonia')
    const filas = [...d.querySelectorAll('.arm-fila')]
    return {
      abierta: d.open,
      titulo: d.querySelector('#mcArmoniaQue')?.textContent,
      paleta: [...d.querySelectorAll('#mcArmoniaPaleta span')].map((s) => s.textContent),
      ids: filas.map((f) => f.querySelector('[data-arm-poner]')?.dataset.armPoner),
      porques: filas.map((f) => f.querySelector('.arm-por')?.textContent),
      puntos: filas.map((f) => f.querySelectorAll('.arm-puntos i.on').length),
      estilo: getComputedStyle(d).backgroundColor,
    }
  })
  check('PC: la hoja se abre «Para el hueco 5»', hoja.abierta && hoja.titulo === 'Para el hueco 5', hoja.titulo)
  check('PC: los tres colores de la página, en hexadecimal', hoja.paleta.length === 3 && hoja.paleta.every((h) => /^#[0-9A-F]{6}$/.test(h)), hoja.paleta.join(' '))
  const n = (id) => Number(String(id).split('-')[1])
  check('PC: la primera sugerencia es azul (la página es azul)', hoja.ids.length >= 4 && ES_AZUL(n(hoja.ids[0])), hoja.ids.join(' '))
  check('PC: las rojas no van delante de las azules', hoja.ids.findIndex((id) => n(id) >= 13 && n(id) <= 16) === -1 || hoja.ids.findIndex((id) => n(id) >= 13 && n(id) <= 16) > hoja.ids.findIndex((id) => ES_AZUL(n(id))), hoja.ids.join(' '))
  check('PC: ninguna sugerencia es una carta que ya está en el álbum', hoja.ids.every((id) => n(id) > 8), hoja.ids.join(' '))
  check('PC: cada una con su porqué en palabras (sin cifras)', hoja.porques.every((p) => p && p.length > 10 && !/\d/.test(p)), hoja.porques[0])
  check('PC: y sus puntos, de 1 a 5, sin subir', hoja.puntos.every((p, i) => p >= 1 && p <= 5 && (i === 0 || p <= hoja.puntos[i - 1])), hoja.puntos.join(''))
  // Cambiar a «Color» repinta la lista.
  await page.click('[data-arm-modo="color"]')
  await page.waitForTimeout(300)
  check('PC: «Color» se marca', await page.evaluate(() => document.querySelector('[data-arm-modo="color"]').getAttribute('aria-checked') === 'true'))
  const elegida = await page.evaluate(() => document.querySelector('#mcArmoniaLista [data-arm-poner]')?.dataset.armPoner)
  await page.click('#mcArmoniaLista [data-arm-poner]')
  await page.waitForTimeout(1200)
  const tras = await cartasDe(page, 'alb-agua')
  check('PC: «Ponerla aquí» la mete en el bolsillo 5', tras[4] === elegida && !(await page.evaluate(() => document.getElementById('mcArmonia').open)), JSON.stringify(tras))
  check('PC: sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/armonia/t1407-pc.png' }).catch(() => {})
  await ctx.close()
}
// La hoja abierta, para mirarla (PC).
{
  const { ctx, page } = await abrir('alb-agua')
  await page.click('[data-sugerir="4"]')
  await page.waitForFunction(() => document.querySelectorAll('#mcArmoniaLista .arm-fila').length >= 4, null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/armonia/t1407-hoja-pc.png' }).catch(() => {})
  await ctx.close()
}
// Ordenar y Llenar, desde el ⋯.
{
  const { ctx, page, errores } = await abrir('alb-mezcla')
  const antes = await page.evaluate(() => JSON.stringify([...document.querySelectorAll('#mcAlbArchivador .mc-hoja')[0].querySelectorAll('[data-carta]')].map((a) => a.dataset.carta)))
  await page.click('#mcAlbMenu summary')
  check('⋯: «Ordenar la página» y «Llenar los huecos» se ven en tu binder', await page.evaluate(() => !document.getElementById('mcAlbOrdenar').classList.contains('hidden') && !document.getElementById('mcAlbLlenar').classList.contains('hidden')))
  await page.click('#mcAlbOrdenar')
  await page.waitForTimeout(2500)
  const ahora = await cartasDe(page, 'alb-mezcla')
  const original = ALBUMES[1].cartas.map((c) => c.id)
  check('Ordenar: cambia el orden', JSON.stringify(ahora) !== JSON.stringify(original), JSON.stringify(ahora))
  check('Ordenar: sin perder ni repetir cartas', [...ahora].sort().join() === [...original].sort().join())
  const aviso = await page.evaluate(() => document.body.innerText.match(/[^\n]*ordenada[^\n]*/)?.[0] || '')
  check('Ordenar: lo dice, con Deshacer', /ordenada/.test(aviso) && (await page.locator('text=Deshacer').count()) > 0, aviso)
  await page.locator('text=Deshacer').first().click()
  await page.waitForTimeout(1200)
  check('Deshacer: vuelve como estaba', JSON.stringify(await cartasDe(page, 'alb-mezcla')) === JSON.stringify(original))
  check('Ordenar: sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir('alb-agua')
  await page.click('#mcAlbMenu summary')
  await page.click('#mcAlbLlenar')
  await page.waitForFunction(() => /en los huecos|en el hueco/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const tras = await cartasDe(page, 'alb-agua')
  const pag1 = tras.slice(0, 9)
  check('Llenar: el hueco 5 de la página 1 queda lleno', Boolean(pag1[4]), JSON.stringify(pag1))
  check('Llenar: sin repetir cartas en el álbum', new Set(tras.filter(Boolean)).size === tras.filter(Boolean).length, JSON.stringify(tras))
  check('Llenar: con una carta azul (la página es azul)', pag1[4] && ES_AZUL(Number(pag1[4].split('-')[1])), pag1[4])
  check('Llenar: sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// ── Móvil, claro y oscuro ──
for (const tema of ['light', 'dark']) {
  const { ctx, page, errores } = await abrir('alb-agua', { movil: true, tema })
  const pastilla = await page.evaluate(() => {
    const b = document.querySelector('[data-sugerir="4"]')
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { ancho: Math.round(r.width), texto: getComputedStyle(b.querySelector('span')).display !== 'none' }
  })
  check(`Móvil ${tema}: el hueco lleva su «Sugerir»`, pastilla && pastilla.ancho > 20, JSON.stringify(pastilla))
  await page.click('[data-sugerir="4"]')
  await page.waitForFunction(() => document.querySelectorAll('#mcArmoniaLista .arm-fila').length >= 4, null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => {
    const d = document.getElementById('mcArmonia')
    const r = d.getBoundingClientRect()
    const fondo = getComputedStyle(d).backgroundColor
    const texto = getComputedStyle(d.querySelector('.arm-nom b')).color
    return { abajo: Math.round(innerHeight - r.bottom), ancho: Math.round(r.width), vw: innerWidth, desborda: d.scrollWidth > d.clientWidth + 1, fondo, texto, filas: d.querySelectorAll('.arm-fila').length }
  })
  check(`Móvil ${tema}: la hoja sube de abajo, a lo ancho, sin desbordar`, m.abajo <= 1 && m.ancho >= m.vw - 1 && !m.desborda && m.filas >= 4, JSON.stringify(m))
  check(`Móvil ${tema}: se lee (texto y fondo distintos)`, m.fondo !== m.texto, `${m.fondo} / ${m.texto}`)
  check(`Móvil ${tema}: sin errores`, !errores.length, errores.join(' | '))
  await page.screenshot({ path: `/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/armonia/t1407-movil-${tema}.png` }).catch(() => {})
  await ctx.close()
}
await browser.close()
console.log(fails ? `    ❌ ${fails} fallan` : '    ✅ todo en verde')
process.exit(fails ? 1 : 0)
