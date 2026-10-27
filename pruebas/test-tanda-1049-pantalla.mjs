// Tanda 1049 — Mis álbumes como tapas cerradas o como una estantería de
// lomos (PINGU: «un botón para verlo o tapas o estantería de lomos… las dos
// me parecen buena idea»).
//
// Lo que se comprueba:
//   · la cabecera: «Mis álbumes» con la cuenta, Tapas / Estantería y «Nuevo
//     álbum» en una fila (también en el móvil);
//   · en Tapas, cada álbum es su tapa cerrada: color, acabado, cierre,
//     costura, ventana con la portada (o el logo del set), placa, % y si es
//     público; el «⋯» va al lado del nombre, no encima de la tapa; «Mi
//     colección» es una caja con las tres últimas; un binder vacío lo dice;
//   · en Estantería, un lomo por álbum con su color y su nombre, todos
//     posados en la balda; abrir uno abre el álbum; la vista se recuerda;
//   · «Nuevo álbum» y el hueco del final abren «Empezar un álbum»;
//   · con un álbum abierto, la cabecera de la lista no se ve.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''
const DIR_CARTAS = process.env.PD_CARTAS || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/albumes/pub/cartas'
let FOTOS = []
try { FOTOS = readdirSync(DIR_CARTAS).filter((f) => f.endsWith('.jpg')).map((f) => readFileSync(`${DIR_CARTAS}/${f}`)) } catch { /* sin fotos */ }

const browser = await chromium.launch()
const N = 30
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, logo_tcggo: 'https://images.tcggo.com/logo-sv8.png' }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
const ALBUMES = [
  { id: 'alb-bin', user_id: 'admin-1', nombre: 'BW/XY', tipo: 'binder', rejilla: '3x3', paginas: 6, tapa: 'azul', portada: 'sv8-4', is_public: true, cartas: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `sv8-${n}` })), updated_at: '2026-10-05T10:00:00Z' },
  { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', cartas: CARTAS.map((c) => ({ id: c.id })), updated_at: '2026-10-04T10:00:00Z' },
  { id: 'alb-vacio', user_id: 'admin-1', nombre: 'Plasma', tipo: 'binder', rejilla: '3x3', paginas: 20, tapa: 'negro', estilo: { cierre: 'goma' }, is_public: false, cartas: [], updated_at: '2026-10-03T10:00:00Z' },
  { id: 'alb-holo', user_id: 'admin-1', nombre: 'Eones', tipo: 'binder', rejilla: '2x2', paginas: 3, tapa: 'crema', estilo: { acabado: 'holo', cierre: 'ninguno' }, is_public: false, cartas: [7, 8].map((n) => ({ id: `sv8-${n}` })), updated_at: '2026-10-02T10:00:00Z' },
]
const COLECCION = [1, 2, 4, 5, 7, 12].map((n, i) => ({ id: `l${n}`, card_id: `sv8-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${(i % 8) + 1}T10:00:00Z` }))

async function abrir(url, { movil = false, vista = null, claro = false } = {}) {
  // Sin service worker: lo que él pide no pasa por `route` (897).
  const tema = claro ? 'light' : 'dark'
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: tema, serviceWorkers: 'block' } : { viewport: { width: 1280, height: 1000 }, locale: 'es-ES', colorScheme: tema, serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES, COLECCION, vista, tema }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = COLECCION
    window.__FAKE_ALBUMES__ = ALBUMES
    try {
      localStorage.setItem('pokedoc-theme', tema)
      if (vista && !sessionStorage.getItem('vista-puesta')) { localStorage.setItem('mc-albumes-vista', vista); sessionStorage.setItem('vista-puesta', '1') }
    } catch {}
  }, { SETS, CARTAS, ALBUMES, COLECCION, vista, tema })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => {
    const u = r.request().url()
    if (/logo/.test(u)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' })
    const n = Number((u.match(/sv8\/(\d+)/) || [])[1] || 0)
    if (FOTOS.length) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: FOTOS[n % FOTOS.length] })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbumesRejilla > *', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}
const URL = '/mi-coleccion.html?ver=carpetas'

const leerTapas = (page) => page.evaluate(() => {
  const r = (el) => el && el.getBoundingClientRect()
  return [...document.querySelectorAll('#mcAlbumesRejilla .mc-albt-caja')].map((caja) => {
    const b = caja.querySelector('[data-album]')
    const t = caja.querySelector('.mc-tapa-cerrada')
    const v = t?.querySelector('.mc-tapa-ventana')
    return {
      id: b?.dataset.album,
      tapa: t?.dataset.tapa, acabado: t?.dataset.acabado, cierre: t?.dataset.cierre,
      costura: !!t?.querySelector('.mc-tapa-costura'),
      tirador: t?.querySelector('.mc-tapa-tirador') ? getComputedStyle(t.querySelector('.mc-tapa-tirador')).position : null,
      foto: Boolean(v?.querySelector('img')?.naturalWidth),
      vacia: v?.classList.contains('mc-tapa-vacia') ? v.textContent.trim() : null,
      logo: Boolean(t?.querySelector('.mc-tapa-logo img')?.naturalWidth),
      placa: t?.querySelector('.mc-tapa-placa')?.textContent,
      pct: t?.querySelector('.mc-tapa-pct')?.textContent || null,
      pub: !!t?.querySelector('.mc-tapa-pub'),
      pie: caja.querySelector('.mc-albt-pie')?.textContent,
      fondo: t ? getComputedStyle(t).backgroundImage.slice(0, 40) : null,
      dientes: t ? getComputedStyle(t, '::after').backgroundImage.slice(0, 30) : null,
      tapaAbajo: r(t)?.bottom, menuArriba: r(caja.querySelector('.mc-albt-menu > summary'))?.top,
      alto: r(t)?.height, ancho: r(t)?.width,
    }
  })
})

console.log('── 1. Tapas, en el ordenador ──')
{
  const { ctx, page, errores } = await abrir(URL)
  const cab = await page.evaluate(() => {
    const c = document.getElementById('mcAlbumesCab')
    const hijos = [...c.children].map((h) => ({ id: h.id, top: Math.round(h.getBoundingClientRect().top + h.getBoundingClientRect().height / 2) }))
    return {
      titulo: c.querySelector('.mc-albumes-titulo')?.textContent.replace(/\s+/g, ' ').trim(),
      vista: document.getElementById('mcAlbumesRejilla').dataset.vista,
      apretado: document.querySelector('[data-alb-vista][aria-pressed="true"]')?.dataset.albVista,
      iconos: [...document.querySelectorAll('[data-alb-vista] .mc-vista-icono svg')].length,
      nuevo: document.getElementById('mcAlbNuevoArriba')?.textContent.trim(),
      unaFila: new Set(hijos.map((h) => Math.round(h.top / 6))).size === 1,
      hijos,
    }
  })
  check('la cabecera: «Mis álbumes 4», en Tapas, con sus dos iconos y «Nuevo álbum»', cab.titulo === 'Mis álbumes 4' && cab.vista === 'tapas' && cab.apretado === 'tapas' && cab.iconos === 2 && /Nuevo álbum/.test(cab.nuevo), JSON.stringify(cab))
  check('  …todo en una fila', cab.unaFila, JSON.stringify(cab.hijos))
  const t = await leerTapas(page)
  const de = (id) => t.find((x) => x.id === id) || {}
  check('cada álbum es su tapa cerrada (cuatro), con su costura', t.length === 4 && t.every((x) => x.tapa && x.costura), JSON.stringify(t.map((x) => [x.id, x.tapa, x.costura])))
  check('  …de 5 × 6, como un álbum de pie', t.every((x) => Math.abs(x.alto / x.ancho - 1.2) < 0.03), JSON.stringify(t.map((x) => [x.ancho, x.alto])))
  const bin = de('alb-bin')
  check('el binder: azul, lona, cremallera SIN asomar por fuera (1052), la portada en la ventana y su nombre en la placa', bin.tapa === 'azul' && bin.acabado === 'lona' && bin.cierre === 'cremallera' && bin.tirador === null && bin.dientes === 'none' && bin.foto && bin.placa === 'BW/XY' && /repeating-linear-gradient/.test(bin.fondo), JSON.stringify(bin))
  check('  …con el % que llevas (4 de 6) y el ojo de público', bin.pct === '67 %' && bin.pub && bin.pie === '4 de 6 · 3×3, 6 págs. · público', JSON.stringify(bin))
  check('  …y el ⋯ debajo de la tapa, al lado del nombre', bin.menuArriba >= bin.tapaAbajo, JSON.stringify(bin))
  const set = de('alb-set')
  check('el de un set lleva su logo en la tapa y «Tienes 6 de 30»', set.logo && set.pct === '20 %' && set.pie === 'Tienes 6 de 30' && !set.pub, JSON.stringify(set))
  const vacio = de('alb-vacio')
  check('el vacío lo dice en la ventana, sin %; con su goma', vacio.vacia === 'Aún sin cartas' && !vacio.pct && vacio.pie === 'Vacío · 3×3, 20 págs.' && vacio.cierre === 'goma' && vacio.tirador === 'absolute', JSON.stringify(vacio))
  const holo = de('alb-holo')
  check('el holo de color crema, sin cierre (sin tirador)', holo.acabado === 'holo' && holo.tapa === 'crema' && holo.cierre === 'ninguno' && holo.tirador === null, JSON.stringify(holo))
  const placaCrema = await page.$eval('[data-album="alb-holo"] .mc-tapa-placa', (p) => getComputedStyle(p).color)
  check('  …y su placa en oscuro, que en crema el blanco no se lee', /rgba\(13, 27, 42/.test(placaCrema), placaCrema)
  const caja = await page.evaluate(() => {
    const c = document.querySelector('[data-alb-coleccion]')
    return { fotos: [...c.querySelectorAll('.mc-albt-abanico img')].filter((i) => i.naturalWidth).length, frente: c.querySelector('.mc-caja-frente')?.textContent, pie: c.querySelector('.mc-albt-pie')?.textContent, primero: c === document.querySelector('#mcAlbumesRejilla > *') }
  })
  check('«Mi colección» es la caja con las tres últimas, la primera', caja.fotos === 3 && caja.frente === 'Mi colección' && caja.pie === '6 cartas' && caja.primero, JSON.stringify(caja))
  const hueco = await page.evaluate(() => {
    const h = document.querySelector('#mcAlbNuevoAbrir .mc-albt-hueco')
    return h && { ultimo: document.querySelector('#mcAlbumesRejilla').lastElementChild.id, borde: getComputedStyle(h).borderStyle, ratio: h.getBoundingClientRect().height / h.getBoundingClientRect().width }
  })
  check('«Empezar un álbum» al final, un hueco de rayas con la forma de una tapa', hueco?.ultimo === 'mcAlbNuevoAbrir' && hueco.borde === 'dashed' && Math.abs(hueco.ratio - 1.2) < 0.03, JSON.stringify(hueco))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1049-tapas-pc.png`, clip: { x: 0, y: 0, width: 1280, height: 760 } })
  await page.click('#mcAlbNuevoArriba')
  check('«Nuevo álbum» de arriba abre «Empezar un álbum»', await page.$eval('#mcAlbNuevo', (d) => d.open))
  await page.keyboard.press('Escape')
  // El ⋯ sigue funcionando.
  await page.click('[data-album-menu="alb-bin"] > summary')
  check('el ⋯ abre su menú', await page.$eval('[data-album-menu="alb-bin"]', (d) => d.open))
  await page.click('body', { position: { x: 5, y: 5 } })
  await page.click('[data-album="alb-bin"]')
  await page.waitForSelector('#mcAlbArchivador .mc-hoja', { timeout: 5000 }).catch(() => {})
  check('con un álbum abierto, la cabecera de la lista no se ve', await page.$eval('#mcAlbumesCab', (c) => !c.getClientRects().length))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. La estantería ──')
{
  const { ctx, page, errores } = await abrir(URL)
  await page.click('[data-alb-vista="lomos"]')
  await page.waitForTimeout(200)
  const lomos = () => page.evaluate(() => {
    const caja = document.getElementById('mcAlbumesRejilla')
    return {
      vista: caja.dataset.vista,
      guardada: localStorage.getItem('mc-albumes-vista'),
      apretado: document.querySelector('[data-alb-vista][aria-pressed="true"]')?.dataset.albVista,
      fondo: getComputedStyle(caja).backgroundImage.slice(0, 30),
      lomos: [...caja.children].map((b) => {
        const r = b.getBoundingClientRect()
        return { album: b.dataset.album || (b.hasAttribute('data-alb-coleccion') ? 'coleccion' : b.id), tapa: b.dataset.tapa || null, nombre: b.querySelector('.mc-lomo-nombre')?.textContent || null, modo: b.querySelector('.mc-lomo-nombre') ? getComputedStyle(b.querySelector('.mc-lomo-nombre')).writingMode : null, barra: b.querySelector('.mc-lomo-barra i')?.style.getPropertyValue('--ancho') || null, abajo: Math.round(r.bottom), ancho: Math.round(r.width), alto: Math.round(r.height) }
      }),
    }
  })
  const l = await lomos()
  const por = (id) => l.lomos.find((x) => x.album === id) || {}
  check('la estantería: Mi colección, los cuatro y el hueco de empezar', l.vista === 'lomos' && l.apretado === 'lomos' && l.lomos.map((x) => x.album).join() === 'coleccion,alb-bin,alb-set,alb-vacio,alb-holo,mcAlbNuevoAbrir', JSON.stringify(l.lomos.map((x) => x.album)))
  check('  …se recuerda en el navegador', l.guardada === 'lomos', l.guardada)
  check('cada lomo con su color, su nombre en vertical y lo que llevas', por('alb-bin').tapa === 'azul' && por('alb-bin').nombre === 'BW/XY' && por('alb-bin').modo === 'vertical-rl' && por('alb-bin').barra === '67%' && por('alb-holo').tapa === 'crema', JSON.stringify(l.lomos))
  check('  …el vacío, sin barra', por('alb-vacio').barra === null, JSON.stringify(por('alb-vacio')))
  check('  …y más grueso el que más cartas lleva', por('alb-set').ancho > por('alb-bin').ancho && por('alb-bin').ancho > por('alb-vacio').ancho, JSON.stringify(l.lomos.map((x) => [x.album, x.ancho])))
  check('todos posados en la misma balda', new Set(l.lomos.map((x) => x.abajo)).size === 1, JSON.stringify(l.lomos.map((x) => x.abajo)))
  check('  …que es de madera (un degradado que se repite)', /repeating-linear-gradient/.test(l.fondo), l.fondo)
  if (CAPS) await page.screenshot({ path: `${CAPS}/1049-lomos-pc.png`, clip: { x: 0, y: 0, width: 1280, height: 560 } })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbumesRejilla > *', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  check('al volver, sigue en Estantería', (await lomos()).vista === 'lomos')
  await page.click('.mc-lomo-libro[data-album="alb-holo"]')
  await page.waitForSelector('#mcAlbArchivador .mc-hoja', { timeout: 5000 }).catch(() => {})
  check('tocar un lomo abre el álbum', await page.$eval('#mcAlbTitulo', (h) => h.textContent.trim()) === 'Eones')
  await page.click('#mcAlbVolver')
  await page.waitForTimeout(400)
  check('  …y al volver, la estantería', (await lomos()).vista === 'lomos')
  await page.click('.mc-lomo-nuevo')
  check('el hueco del final abre «Empezar un álbum»', await page.$eval('#mcAlbNuevo', (d) => d.open))
  await page.keyboard.press('Escape')
  await page.click('.mc-lomo-coleccion')
  await page.waitForTimeout(400)
  check('la caja de Mi colección lleva a tus cartas', await page.evaluate(() => new URL(location.href).searchParams.get('ver')) === 'cartas')
  await page.click('[data-alb-vista="tapas"]').catch(() => {})
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. En el móvil ──')
{
  const { ctx, page, errores } = await abrir(URL, { movil: true })
  const m = await page.evaluate(() => {
    const c = document.getElementById('mcAlbumesCab')
    const vis = [...c.children].filter((h) => h.getBoundingClientRect().width > 2 && getComputedStyle(h).position !== 'absolute')
    const tops = vis.map((h) => Math.round(h.getBoundingClientRect().top + h.getBoundingClientRect().height / 2))
    const tapas = [...document.querySelectorAll('#mcAlbumesRejilla > *')].map((b) => Math.round(b.getBoundingClientRect().top))
    return {
      tops,
      tituloVisible: document.querySelector('.mc-albumes-titulo').getBoundingClientRect().width > 2,
      botones: [...document.querySelectorAll('[data-alb-vista]')].map((b) => [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height), b.getAttribute('aria-label')]),
      porFila: tapas.filter((t) => t === tapas[0]).length,
      desborda: document.documentElement.scrollWidth > innerWidth,
    }
  })
  check('la cabecera en una fila, sin el título (lo dice la burbuja)', new Set(m.tops.map((t) => Math.round(t / 6))).size === 1 && !m.tituloVisible, JSON.stringify(m))
  check('  …con Tapas y Estantería en iconos de 44 y su nombre para el lector', m.botones.every(([w, h, a]) => w >= 44 && h >= 44 && a), JSON.stringify(m.botones))
  check('dos tapas por fila, sin salirse de la pantalla', m.porFila === 2 && !m.desborda, JSON.stringify(m))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1049-tapas-movil.png` })
  await page.click('[data-alb-vista="lomos"]')
  await page.waitForTimeout(200)
  const e = await page.evaluate(() => ({ desborda: document.documentElement.scrollWidth > innerWidth, abajo: [...document.querySelectorAll('#mcAlbumesRejilla > *')].map((b) => Math.round(b.getBoundingClientRect().bottom)) }))
  check('la estantería cabe y sus lomos siguen posados', !e.desborda && new Set(e.abajo).size === 1, JSON.stringify(e))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1049-lomos-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

if (CAPS) {
  console.log('── 4. Capturas en claro ──')
  const { ctx, page } = await abrir(URL, { claro: true })
  await page.screenshot({ path: `${CAPS}/1049-tapas-pc-claro.png`, clip: { x: 0, y: 0, width: 1280, height: 760 } })
  await page.click('[data-alb-vista="lomos"]')
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${CAPS}/1049-lomos-pc-claro.png`, clip: { x: 0, y: 0, width: 1280, height: 560 } })
  await ctx.close()
}

await browser.close()
console.log(fails ? `❌ ${fails} FALLAN` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)
