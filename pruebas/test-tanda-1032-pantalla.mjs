// Tanda 1032 — editar y borrar un álbum desde un sitio: el ⋯ de cada
// baldosa (Abrir, Editar…, Hacer público/privado, Borrar) y «Editar álbum»
// dentro; la hoja con nombre, descripción, color de la tapa (binder),
// portada (una de sus cartas) y público, y el botón de borrar con confirm.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const CARTAS = [
  { id: 'sv8-1', market: 'WEST', set_id: 'sv8', local_id: '1', name: 'Uno', name_es: 'Uno', image_path: 'x/1', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
  { id: 'sv8-2', market: 'WEST', set_id: 'sv8', local_id: '2', name: 'Dos', name_es: 'Dos', image_path: 'x/2', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
  { id: 'sv8-3', market: 'WEST', set_id: 'sv8', local_id: '3', name: 'Tres', name_es: 'Tres', image_path: 'x/3', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
]
const ALBUMES = [
  { id: 'alb-1', user_id: 'admin-1', nombre: 'Mis favoritas', descripcion: null, cartas: [{ id: 'sv8-1' }, { id: 'sv8-2' }, { id: 'sv8-3' }], is_public: false, tipo: 'binder', rejilla: '3x3', paginas: 2, tapa: 'azul', portada: null, updated_at: '2026-10-25T10:00:00Z' },
  { id: 'alb-2', user_id: 'admin-1', nombre: 'Chispas', descripcion: null, cartas: [{ id: 'sv8-1' }], is_public: true, tipo: 'set', set_id: 'sv8', set_market: 'WEST', rejilla: '3x3', paginas: null, tapa: null, portada: null, updated_at: '2026-10-24T10:00:00Z' },
]
const b = await chromium.launch()
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 3, card_count_total: 3 }]
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }]
    window.__FAKE_ALBUMES__ = d.ALBUMES
    window.__FAKE_PRECIOS__ = []
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
  }, { CARTAS, ALBUMES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbumesRejilla .mc-albt-caja', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  return { ctx, page, errores }
}
const baldosas = (page) => page.evaluate(() => [...document.querySelectorAll('#mcAlbumesRejilla .mc-albt-caja')].map((c) => ({
  id: c.querySelector('[data-album]')?.dataset.album,
  nombre: c.querySelector('.mc-albt-nombre')?.textContent,
  pie: c.querySelector('.mc-albt-pie')?.textContent,
  tapa: c.querySelector('.mc-albt-tapa')?.dataset.tapa || null,
  portada: Boolean(c.querySelector('.mc-albt-portada')),
  menu: c.querySelector('.mc-albt-menu') ? [...c.querySelectorAll('[data-album-accion]')].map((o) => o.textContent.trim()) : null,
  menuAlto: Math.round(c.querySelector('.mc-albt-menu > summary')?.getBoundingClientRect().height || 0),
})))
const hoja = (page) => page.evaluate(() => {
  const d = document.getElementById('mcAlbEdit')
  return {
    abierta: d?.open === true && getComputedStyle(d).display !== 'none',
    titulo: document.getElementById('mcAlbEditTitulo')?.textContent,
    nombre: document.getElementById('mcAlbEditNombre')?.value,
    descripcion: document.getElementById('mcAlbEditDescripcion')?.value,
    tapasVisible: !document.getElementById('mcAlbEditTapasBloque')?.classList.contains('hidden'),
    tapa: document.querySelector('#mcAlbEditTapas [aria-pressed="true"]')?.dataset.tapa,
    portadas: [...document.querySelectorAll('#mcAlbEditPortadas [data-portada]')].map((p) => `${p.dataset.portada || 'ninguna'}${p.getAttribute('aria-pressed') === 'true' ? '*' : ''}`),
    publico: document.getElementById('mcAlbEditPublico')?.checked,
    botones: [...(d?.querySelectorAll('.mc-albe-pie button') || [])].map((x) => x.textContent.trim()),
  }
})

console.log('── 1. PC: el ⋯ de cada baldosa y la hoja de editar ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas')
  const antes = await baldosas(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('las dos baldosas llevan su ⋯ (44 px) con Abrir, Editar…, público/privado y Borrar', antes.length === 2 && antes.every((x) => x.menuAlto >= 44) && antes[0].menu?.join('|') === 'Abrir|Editar…|Hacer público|Borrar' && antes[1].menu?.join('|') === 'Abrir|Editar…|Hacer privado|Borrar', JSON.stringify(antes))
  check('la colección y «Empezar un álbum» no llevan menú', (await page.evaluate(() => document.querySelectorAll('#mcAlbumesRejilla .mc-albt-menu').length)) === 2)
  await page.click('[data-album-menu="alb-1"] > summary')
  await page.waitForTimeout(200)
  const abiertoMenu = await page.evaluate(() => { const m = document.querySelector('[data-album-menu="alb-1"] .mc-menu'); const r = m.getBoundingClientRect(); return { visible: getComputedStyle(m).display !== 'none' && r.width > 0, dentro: r.right <= innerWidth && r.left >= 0 } })
  check('el menú se abre y cabe en pantalla', abiertoMenu.visible && abiertoMenu.dentro, JSON.stringify(abiertoMenu))
  await page.click('[data-album-menu="alb-1"] [data-album-accion="editar"]')
  await page.waitForSelector('#mcAlbEdit[open]', { timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(400)
  const h = await hoja(page)
  check('la hoja «Editar binder» con el nombre, la tapa azul, las tres portadas (y «Ninguna» puesta) y privado', h.abierta && h.titulo === 'Editar binder' && h.nombre === 'Mis favoritas' && h.tapasVisible && h.tapa === 'azul' && h.portadas.join('|') === 'ninguna*|sv8-1|sv8-2|sv8-3' && h.publico === false && h.botones.join('|') === 'Borrar álbum|Guardar', JSON.stringify(h))
  check('el menú se ha cerrado al elegir', await page.evaluate(() => !document.querySelector('[data-album-menu="alb-1"]').hasAttribute('open')))
  await page.fill('#mcAlbEditNombre', 'Las mejores')
  await page.fill('#mcAlbEditDescripcion', 'Lo que más me gusta')
  await page.click('#mcAlbEditTapas [data-tapa="rojo"]')
  await page.click('#mcAlbEditPortadas [data-portada="sv8-2"]')
  await page.check('#mcAlbEditPublico')
  await page.click('#mcAlbEditGuardar')
  await page.waitForTimeout(800)
  const despues = await baldosas(page)
  const guardado = await page.evaluate(() => window.__STUB_TABLAS__?.user_albums?.find?.((a) => a.id === 'alb-1') || null)
  check('la hoja se cierra y la baldosa dice lo nuevo: nombre, tapa roja, portada y «público»', !(await hoja(page)).abierta && despues[0]?.nombre === 'Las mejores' && despues[0].tapa === 'rojo' && despues[0].portada && /público/.test(despues[0].pie) && despues[0].menu[2] === 'Hacer privado', JSON.stringify(despues[0]))
  check('  …y en la base van solo las columnas que cambian', !guardado || (guardado.nombre === 'Las mejores' && guardado.tapa === 'rojo' && guardado.portada === 'sv8-2' && guardado.is_public === true && guardado.descripcion === 'Lo que más me gusta'), JSON.stringify(guardado))
  // Hacer privado desde el menú, sin abrir la hoja: cambia ya (896).
  await page.click('[data-album-menu="alb-1"] > summary')
  await page.click('[data-album-menu="alb-1"] [data-album-accion="publico"]')
  await page.waitForTimeout(500)
  const privado = await baldosas(page)
  check('«Hacer privado» desde el menú: la baldosa deja de decir «público»', !/público/.test(privado[0].pie) && privado[0].menu[2] === 'Hacer público', JSON.stringify(privado[0]))
  // Un álbum de set: sin tapa en la hoja.
  await page.click('[data-album-menu="alb-2"] > summary')
  await page.click('[data-album-menu="alb-2"] [data-album-accion="editar"]')
  await page.waitForTimeout(500)
  const hs = await hoja(page)
  check('un álbum de set: «Editar álbum», sin color de tapa, con su portada y público marcado', hs.abierta && hs.titulo === 'Editar álbum' && !hs.tapasVisible && hs.portadas.length === 2 && hs.publico === true, JSON.stringify(hs))
  await page.click('#mcAlbEditCerrar')
  await page.waitForTimeout(200)
  // Borrar, con confirm: primero se dice que no.
  page.once('dialog', (d) => d.dismiss())
  await page.click('[data-album-menu="alb-2"] > summary')
  await page.click('[data-album-menu="alb-2"] [data-album-accion="borrar"]')
  await page.waitForTimeout(400)
  check('Borrar pide confirmación, y con «no» todo sigue', (await baldosas(page)).length === 2)
  page.once('dialog', (d) => d.accept())
  await page.click('[data-album-menu="alb-2"] > summary')
  await page.click('[data-album-menu="alb-2"] [data-album-accion="borrar"]')
  await page.waitForTimeout(800)
  const quedan = await baldosas(page)
  check('  …y con «sí» la baldosa se va', quedan.length === 1 && quedan[0].id === 'alb-1', JSON.stringify(quedan.map((x) => x.id)))
  await ctx.close()
}

console.log('\n── 2. Dentro del álbum: «Editar álbum» y borrar desde la hoja ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-1')
  await page.waitForSelector('#mcAlbAjustes', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const boton = await page.evaluate(() => { const b = document.getElementById('mcAlbAjustes'); const r = b?.getBoundingClientRect(); return { visible: Boolean(r && r.height > 0), texto: b?.textContent.trim(), sinBorrarAbajo: !document.getElementById('mcAlbBorrar') } })
  check('el botón «Editar álbum» está en la barra y el «Borrar» suelto de abajo se fue', boton.visible && boton.texto === 'Editar álbum' && boton.sinBorrarAbajo, JSON.stringify(boton))
  await page.click('#mcAlbAjustes')
  await page.waitForTimeout(500)
  const h = await hoja(page)
  check('la misma hoja, con lo del álbum abierto', h.abierta && h.nombre === 'Mis favoritas' && h.tapa === 'azul', JSON.stringify(h))
  await page.fill('#mcAlbEditNombre', 'Renombrado')
  await page.click('#mcAlbEditTapas [data-tapa="verde"]')
  await page.click('#mcAlbEditGuardar')
  await page.waitForTimeout(700)
  const cab = await page.evaluate(() => ({ titulo: document.getElementById('mcAlbTitulo')?.value, tapa: document.getElementById('mcAlbCabecera')?.dataset.tapa, archivador: document.querySelector('#mcAlbArchivador [data-tapa]')?.dataset.tapa }))
  check('la cabecera y el archivador se repintan con el nombre y la tapa verde', cab.titulo === 'Renombrado' && cab.tapa === 'verde' && cab.archivador === 'verde', JSON.stringify(cab))
  await page.click('#mcAlbAjustes')
  await page.waitForTimeout(400)
  page.once('dialog', (d) => d.accept())
  await page.click('#mcAlbEditBorrar')
  await page.waitForTimeout(900)
  const tras = await page.evaluate(() => ({ lista: !document.getElementById('mcAlbumesLista').classList.contains('hidden'), detalle: document.getElementById('mcAlbumesDetalle').classList.contains('hidden'), url: location.search, baldosas: document.querySelectorAll('#mcAlbumesRejilla .mc-albt-caja').length }))
  check('borrar desde la hoja vuelve a la lista, sin el álbum y sin `album=` en la dirección', tras.lista && tras.detalle && !/album=/.test(tras.url) && tras.baldosas === 1, JSON.stringify(tras))
  await ctx.close()
}

console.log('\n── 3. iPhone: el ⋯ se ve y la hoja cabe ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas', { movil: true })
  const r = await baldosas(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el ⋯ de la baldosa mide 44 px', r.length === 2 && r.every((x) => x.menuAlto >= 44), JSON.stringify(r.map((x) => x.menuAlto)))
  await page.click('[data-album-menu="alb-1"] > summary')
  await page.click('[data-album-menu="alb-1"] [data-album-accion="editar"]')
  await page.waitForTimeout(500)
  const m = await page.evaluate(() => { const d = document.getElementById('mcAlbEdit'); const r = d.getBoundingClientRect(); const g = document.getElementById('mcAlbEditGuardar').getBoundingClientRect(); return { cabe: r.left >= 0 && r.right <= innerWidth, guardarVisible: g.bottom <= innerHeight && g.height >= 44, sinScrollLateral: document.getElementById('mcAlbEditPortadas').scrollWidth >= document.getElementById('mcAlbEditPortadas').clientWidth } })
  check('la hoja cabe en el ancho y «Guardar» está a la vista', m.cabe && m.guardarVisible, JSON.stringify(m))
  await ctx.close()
}

console.log('\n── 4. Lo escrito ──')
{
  const js = readFileSync(`${RAIZ}/js/mi-coleccion/albumes.js`, 'utf8')
  check('la hoja entra por import() y el módulo no toca la base', /import\('\.\/album-editar\.js'\)/.test(js) && !/supabase/.test(readFileSync(`${RAIZ}/js/mi-coleccion/album-editar.js`, 'utf8')))
  check('cartas.html lleva lo mismo que la plantilla (649)', /id="mcAlbEdit"/.test(readFileSync(`${RAIZ}/cartas.html`, 'utf8')))
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
