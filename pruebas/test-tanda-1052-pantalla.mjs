// Tanda 1052 — Meter una carta en un álbum desde su ficha (PINGU: «desde el
// pop-up de una carta no puedes añadir a un álbum… lo de añadir a los álbumes
// sí me gusta») y la cremallera fuera de la tapa cerrada.
//
// Lo que se comprueba:
//   · lo puro (js/mi-coleccion/album-sitio.js): el primer hueco libre, lo que
//     cabe, la página y el hueco, el resumen por álbum (ya / va / lleno, el
//     de su expansión aparte) y el enlace;
//   · los colores de la tapa pequeña son LOS MISMOS que los de Mis álbumes;
//   · la ficha de Mi colección: «En tus álbumes» con un chip por álbum donde
//     está (con su página) y «Añadir a otro»; la ventana con cada binder y lo
//     que pasaría; elegir uno la mete en el primer hueco, sale el aviso con
//     Ver y Deshacer, el chip aparece, y Deshacer lo quita; «Nuevo álbum con
//     esta carta» crea un binder con ella;
//   · el enlace de un chip abre el álbum en su página y señala el bolsillo, y
//     la dirección se queda sin `pag`;
//   · /carta lo lleva también; en el móvil la ventana es una hoja de abajo.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const WEB = process.env.PD_WEB || '/home/user/pingu'

// ── Lo puro ──
const s = await import(`${WEB}/js/mi-coleccion/album-sitio.js`)
{
  const a = { tipo: 'binder', rejilla: '3x3', paginas: 2, cartas: [{ id: 'a' }, {}, { id: 'b' }] }
  check('el primer hueco libre es el de en medio', s.sitioLibre(a) === 1)
  check('sin huecos, detrás de la última', s.sitioLibre({ cartas: [{ id: 'a' }] }) === 1 && s.sitioLibre({}) === 0)
  check('lo que cabe: páginas por bolsillos (2 × 9)', s.capacidadDe(a) === 18 && s.capacidadDe({ rejilla: '2x2', paginas: 3 }) === 12)
  check('sin páginas, el tope de un álbum', s.capacidadDe({}) === s.MAX_CARTAS)
  check('página y hueco desde 1', JSON.stringify(s.lugarDe(a, 0)) === '{"pagina":1,"hueco":1}' && JSON.stringify(s.lugarDe(a, 10)) === '{"pagina":2,"hueco":2}' && JSON.stringify(s.lugarDe({ rejilla: '4x4' }, 17)) === '{"pagina":2,"hueco":2}')
  check('la carta va al hueco, sin mover las demás', JSON.stringify(s.conLaCarta(a, { id: 'c' })) === '[{"id":"a"},{"id":"c"},{"id":"b"}]')
  check('el bolsillo lleva la versión y el catálogo si no es el occidental', JSON.stringify(s.bolsilloDe({ id: 'x', market: 'JP' }, 'holo')) === '{"id":"x","v":"holo","m":"JP"}' && JSON.stringify(s.bolsilloDe({ id: 'x', market: 'WEST' })) === '{"id":"x"}')
  const lleno = { id: 'l', tipo: 'binder', rejilla: '2x2', paginas: 1, cartas: [{ id: 'p' }, { id: 'q' }, { id: 'r' }, { id: 's' }] }
  const suyo = { id: 's1', tipo: 'set', set_id: 'sv8', set_market: 'WEST', cartas: [{ id: 'z' }, { id: 'c' }] }
  const otro = { id: 's2', tipo: 'set', set_id: 'sv7', set_market: 'WEST', cartas: [{ id: 'q' }] }
  const r = s.resumenParaCarta([a, lleno, suyo, otro], { id: 'c', set_id: 'sv8', market: 'WEST' })
  check('va / lleno para cada binder, y los de set no se ofrecen', JSON.stringify(r.opciones.map((o) => [o.estado, o.pagina ?? null, o.hueco ?? null])) === '[["va",1,2],["lleno",null,null]]', JSON.stringify(r.opciones))
  check('el de su expansión, aparte y con su sitio', r.suSet?.album.id === 's1' && r.suSet.dentro && r.suSet.pagina === 1 && r.suSet.hueco === 2)
  check('con ella: el de su expansión', r.conElla.map((x) => x.album.id).join() === 's1')
  const r2 = s.resumenParaCarta([a], { id: 'b', set_id: 'sv8' })
  check('si ya está: «ya», con su página', r2.opciones[0].estado === 'ya' && r2.opciones[0].hueco === 3 && r2.conElla.length === 1)
  check('los textos de cada opción', s.textoDeOpcion({ estado: 'va', pagina: 3, hueco: 5 }) === 'Va en la pág. 3, hueco 5' && s.textoDeOpcion({ estado: 'ya', pagina: 2 }) === 'Ya está · pág. 2' && /Lleno/.test(s.textoDeOpcion({ estado: 'lleno' })))
  check('el enlace al álbum, con página y hueco', s.enlaceAAlbum('x', 2, 4) === '/mi-coleccion?ver=carpetas&album=x&pag=2&hueco=4' && s.enlaceAAlbum('x') === '/mi-coleccion?ver=carpetas&album=x')
}

// ── Los colores de la tapa: los mismos en las dos hojas ──
{
  const leer = (f, prefijo) => Object.fromEntries([...readFileSync(`${WEB}/css/${f}`, 'utf8').matchAll(new RegExp(`${prefijo}\\[data-tapa='(\\w+)'\\] \\{ --tapa: ([^;]+); \\}`, 'g'))].map((m) => [m[1], m[2]]))
  const mc = leer('mi-coleccion.css', '^')
  const eta = leer('en-tus-albumes.css', '\\.eta-tapa')
  // La de mi-coleccion.css empieza la línea por `[data-tapa=…]`.
  const mc2 = Object.fromEntries([...readFileSync(`${WEB}/css/mi-coleccion.css`, 'utf8').matchAll(/^\[data-tapa='(\w+)'\] \{ --tapa: ([^;]+); \}/gm)].map((m) => [m[1], m[2]]))
  check('ocho colores de tapa en las dos hojas, y dicen lo mismo', Object.keys(eta).length === 8 && JSON.stringify(eta) === JSON.stringify(mc2), JSON.stringify({ eta, mc2, mc: Object.keys(mc).length }))
}

// ── La pantalla ──
const browser = await chromium.launch()
const N = 12
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
const ALBUMES = [
  { id: 'alb-bin', user_id: 'admin-1', nombre: 'BW/XY', tipo: 'binder', rejilla: '3x3', paginas: 6, tapa: 'azul', cartas: [1, 2, 3].map((n) => ({ id: `sv8-${n}` })), updated_at: '2026-10-05T10:00:00Z' },
  { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', cartas: CARTAS.map((c) => ({ id: c.id })), updated_at: '2026-10-04T10:00:00Z' },
  { id: 'alb-plasma', user_id: 'admin-1', nombre: 'Plasma', tipo: 'binder', rejilla: '3x3', paginas: 20, tapa: 'negro', cartas: [{ id: 'sv8-7' }, {}, { id: 'sv8-8' }], updated_at: '2026-10-03T10:00:00Z' },
  { id: 'alb-lleno', user_id: 'admin-1', nombre: 'Lleno', tipo: 'binder', rejilla: '2x2', paginas: 1, tapa: 'rojo', cartas: [9, 10, 11, 12].map((n) => ({ id: `sv8-${n}` })), updated_at: '2026-10-02T10:00:00Z' },
]
const COLECCION = [1, 4].map((n, i) => ({ id: `l${n}`, card_id: `sv8-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${i + 1}T10:00:00Z` }))

async function abrir(url, { movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 1000 }, locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES, COLECCION }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = COLECCION
    window.__FAKE_ALBUMES__ = ALBUMES
    try { localStorage.setItem('pokedoc-theme', 'dark') } catch {}
  }, { SETS, CARTAS, ALBUMES, COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const bloque = (page, sel) => page.evaluate((sel) => {
  const b = document.querySelector(sel)
  return {
    visible: Boolean(b && !b.classList.contains('hidden') && b.getBoundingClientRect().height > 0),
    titulo: b?.querySelector('h3')?.textContent,
    chips: [...(b?.querySelectorAll('.eta-chip') || [])].map((c) => `${c.querySelector('.eta-chip-nombre').textContent}|${c.querySelector('small').textContent}|${c.getAttribute('href')}`),
    tapas: [...(b?.querySelectorAll('.eta-chip .eta-tapa') || [])].map((t) => getComputedStyle(t).backgroundColor),
    anadir: b?.querySelector('.eta-anadir')?.textContent.trim(),
  }
}, sel)
const opciones = (page) => page.evaluate(() => [...document.querySelectorAll('#etaDialogo .eta-opcion')].map((o) => `${o.querySelector('b').textContent}|${o.querySelector('small').textContent}|${o.disabled ? 'off' : 'on'}`))

// 1. La ficha de Mi colección, en el PC
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=cartas')
  await page.click('.mc-carta[data-linea="l1"], [data-linea="l1"]').catch(() => {})
  await page.waitForSelector('#mcEdAlbumes .eta-anadir', { timeout: 6000 }).catch(() => {})
  let b = await bloque(page, '#mcEdAlbumes')
  check('la ficha: «En tus álbumes» con los dos donde está, con su página', b.visible && b.titulo === 'En tus álbumes' && b.chips.length === 2 && b.chips.includes('BW/XY|pág. 1|/mi-coleccion?ver=carpetas&album=alb-bin&pag=1&hueco=1') && b.chips.some((c) => c.startsWith('Chispas Fulgurantes|pág. 1|')), JSON.stringify(b))
  check('  …la tapa pequeña con su color (azul, no transparente)', b.tapas.length === 2 && b.tapas.every((c) => c && c !== 'rgba(0, 0, 0, 0)'), JSON.stringify(b.tapas))
  check('  …y «Añadir a otro»', /Añadir a otro/.test(b.anadir || ''), b.anadir)
  if (process.env.PD_CAPS) await page.screenshot({ path: `${process.env.PD_CAPS}/1052-ficha-pc.png` })
  await page.click('#mcEdAlbumes .eta-anadir')
  await page.waitForSelector('#etaDialogo .eta-opcion', { timeout: 5000 }).catch(() => {})
  if (process.env.PD_CAPS) await page.screenshot({ path: `${process.env.PD_CAPS}/1052-ventana-pc.png` })
  const o = await opciones(page)
  check('la ventana: cada binder con lo que pasaría (ya está, el hueco de en medio, lleno)', o.includes('BW/XY|Ya está · pág. 1|on') && o.includes('Plasma|Va en la pág. 1, hueco 2|on') && o.includes('Lleno|Lleno: no le cabe otra|off'), JSON.stringify(o))
  check('  …y el de su expansión aparte, que ya la tiene', o.some((x) => x.startsWith('Chispas Fulgurantes|Ya la tiene')), JSON.stringify(o))
  const caja = await page.evaluate(() => { const d = document.getElementById('etaDialogo'); const r = d.getBoundingClientRect(); return { open: d.open, modal: d.matches(':modal'), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: innerWidth, h: innerHeight } })
  check('  …centrada en el PC y por encima de la ficha', caja.open && caja.modal && Math.abs(caja.x - caja.w / 2) < 4 && Math.abs(caja.y - caja.h / 2) < 4, JSON.stringify(caja))
  await page.click('#etaDialogo .eta-opcion[data-album="alb-plasma"]')
  await page.waitForSelector('.mc-deshacer', { timeout: 5000 }).catch(() => {})
  const aviso = await page.evaluate(() => ({ texto: document.querySelector('.mc-deshacer-texto')?.textContent, ver: document.querySelector('.mc-deshacer .eta-ver')?.getAttribute('href'), cerrada: !document.getElementById('etaDialogo').open }))
  check('elegir Plasma: se cierra y avisa dónde ha caído, con Ver y Deshacer', aviso.cerrada && /Dentro de «Plasma» · pág\. 1, hueco 2/.test(aviso.texto || '') && aviso.ver === '/mi-coleccion?ver=carpetas&album=alb-plasma&pag=1&hueco=2', JSON.stringify(aviso))
  await page.waitForTimeout(500)
  b = await bloque(page, '#mcEdAlbumes')
  check('  …y el chip de Plasma sale en la ficha', b.chips.some((c) => c.startsWith('Plasma|pág. 1|')), JSON.stringify(b.chips))
  await page.click('.mc-deshacer-boton')
  await page.waitForTimeout(800)
  b = await bloque(page, '#mcEdAlbumes')
  check('Deshacer: el chip de Plasma se va', b.chips.length === 2 && !b.chips.some((c) => c.startsWith('Plasma')), JSON.stringify(b.chips))
  await page.click('#mcEdAlbumes .eta-anadir')
  await page.waitForSelector('#etaNuevoNombre', { timeout: 5000 }).catch(() => {})
  check('  …y vuelve a ofrecer el hueco 2 de Plasma', (await opciones(page)).includes('Plasma|Va en la pág. 1, hueco 2|on'))
  await page.fill('#etaNuevoNombre', 'Favoritas')
  await page.click('#etaNuevo button[type="submit"]')
  await page.waitForTimeout(900)
  b = await bloque(page, '#mcEdAlbumes')
  const avisoNuevo = await page.evaluate(() => document.querySelector('.mc-deshacer-texto')?.textContent)
  check('«Nuevo álbum con esta carta»: un binder nuevo con ella dentro', b.chips.some((c) => c.startsWith('Favoritas|pág. 1|')) && /Álbum «Favoritas» creado/.test(avisoNuevo || ''), JSON.stringify({ chips: b.chips, avisoNuevo }))
  check('sin errores de JavaScript', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 2. El enlace de un chip: el álbum en su página, con el bolsillo señalado
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-plasma&pag=1&hueco=3')
  await page.waitForSelector('#mcAlbArchivador .mc-bolsillo-aqui', { timeout: 6000 }).catch(() => {})
  const r = await page.evaluate(() => ({ aqui: [...document.querySelectorAll('#mcAlbArchivador .mc-bolsillo-aqui')].map((b) => b.dataset.indice), url: location.search }))
  check('el enlace abre el álbum y señala su bolsillo', r.aqui.join() === '2', JSON.stringify(r))
  check('  …y la dirección se queda sin pag ni hueco', !/pag=|hueco=/.test(r.url) && /album=alb-plasma/.test(r.url), r.url)
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// 3. /carta y el móvil
{
  const { ctx, page, errores } = await abrir('/carta.html?id=sv8-5', { movil: true })
  await page.waitForSelector('#cmAlbumes .eta-anadir', { state: 'attached', timeout: 8000 }).catch(() => {})
  // En el móvil, /carta va por pestañas: está en «Precio», con el aviso y comparar.
  await page.click('.carta-pestanas button:has-text("Precio")').catch(() => {})
  await page.waitForTimeout(300)
  const b = await bloque(page, '#cmAlbumes')
  check('/carta: «En tus álbumes» con el de su expansión y «Añadir a otro»', b.visible && b.chips.length === 1 && b.chips[0].startsWith('Chispas Fulgurantes|') && /Añadir a otro/.test(b.anadir || ''), JSON.stringify(b))
  await page.click('#cmAlbumes .eta-anadir')
  await page.waitForSelector('#etaDialogo .eta-opcion', { timeout: 5000 }).catch(() => {})
  const r = await page.evaluate(() => { const d = document.getElementById('etaDialogo'); const x = d.getBoundingClientRect(); return { abajo: Math.round(x.bottom), h: innerHeight, ancho: Math.round(x.width), w: innerWidth, rotulos: [...d.querySelectorAll('.eta-rotulo')].map((p) => p.textContent) } })
  if (process.env.PD_CAPS) await page.screenshot({ path: `${process.env.PD_CAPS}/1052-ventana-movil.png` })
  check('en el móvil, la ventana es una hoja pegada abajo y a todo lo ancho', Math.abs(r.abajo - r.h) <= 1 && r.ancho === r.w, JSON.stringify(r))
  check('  …con «Tus binders» y «El de su expansión»', r.rotulos.join('|') === 'Tus binders|El de su expansión', JSON.stringify(r.rotulos))
  const t = await page.evaluate(() => [...document.querySelectorAll('#etaDialogo .eta-opcion, #etaDialogo .eta-cerrar, #etaNuevo input, #etaNuevo button')].map((e) => Math.round(e.getBoundingClientRect().height)))
  check('  …y todo lo que se toca mide 44 o más', t.every((h) => h >= 44), JSON.stringify(t))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
