// Tanda 1050 — Personalizar un álbum: la hoja de editar con dos pestañas
// (Aspecto y Datos) y la vista previa al lado (la propuesta que PINGU aprobó,
// «todo lo de la maqueta»).
//
// Lo que se comprueba:
//   · lo puro: `cambiosDelEditor` escribe el estilo entero solo si cambia y
//     solo si la fila trae la columna; cambiar los bolsillos no corta un
//     binder (crece si hace falta);
//   · «Personalizar» abre Aspecto; el ⋯ de una baldosa, Datos;
//   · cada toque cambia la vista previa (color, acabado, hojas, cierre,
//     ventana y bolsillos), que es el mismo dibujo que el álbum;
//   · al guardar se escribe en la fila y el álbum abierto se repinta;
//   · sin la migración (la fila sin `estilo`) solo se ofrece lo que existe;
//   · un álbum de set también cambia de color y de bolsillos;
//   · en el móvil la vista va arriba, en una fila.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { cambiosDelEditor, estiloCompleto } from '/home/user/pingu/js/mi-coleccion/album-editar.js'

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

console.log('── 1. Lo puro ──')
{
  const base = { id: 'a', nombre: 'X', tapa: 'azul', portada: null, is_public: false, rejilla: '3x3', paginas: 2, estilo: null, cartas: Array.from({ length: 18 }, (_, i) => ({ id: `c${i}` })) }
  const datos = { nombre: 'X', descripcion: '', tapa: 'azul', portada: null, is_public: false, rejilla: '3x3' }
  check('sin tocar nada, nada que escribir', JSON.stringify(cambiosDelEditor(base, { ...datos, estilo: { acabado: 'lona', hojas: 'grises', cierre: 'cremallera', ventana: 'si' } })) === '{}')
  check('el estilo se escribe entero cuando cambia una cosa', JSON.stringify(cambiosDelEditor(base, { ...datos, estilo: { acabado: 'piel', hojas: 'grises', cierre: 'cremallera', ventana: 'si' } })) === '{"estilo":{"acabado":"piel","hojas":"grises","cierre":"cremallera","ventana":"si"}}')
  check('sin la columna en la fila, el estilo no se escribe', JSON.stringify(cambiosDelEditor({ ...base, estilo: undefined, ...{} } && Object.fromEntries(Object.entries(base).filter(([k]) => k !== 'estilo')), { ...datos, estilo: { acabado: 'holo' } })) === '{}')
  check('de 3×3 a 2×2: 18 cartas en 2 páginas no caben y el binder crece a 5', JSON.stringify(cambiosDelEditor(base, { ...datos, rejilla: '2x2' })) === '{"rejilla":"2x2","paginas":5}')
  check('de 3×3 a 4×4 caben: las páginas no cambian', JSON.stringify(cambiosDelEditor(base, { ...datos, rejilla: '4x4' })) === '{"rejilla":"4x4"}')
  check('estiloCompleto: lo de por defecto, con ventana', JSON.stringify(estiloCompleto(null)) === '{"acabado":"lona","hojas":"grises","cierre":"cremallera","ventana":"si"}' && estiloCompleto({ ventana: 'no' }).ventana === 'no')
}

const browser = await chromium.launch()
const N = 30
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, logo_tcggo: 'https://images.tcggo.com/logo-sv8.png' }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
const ALBUMES = [
  { id: 'alb-bin', user_id: 'admin-1', nombre: 'BW/XY', descripcion: null, tipo: 'binder', rejilla: '3x3', paginas: 4, tapa: 'azul', portada: 'sv8-4', estilo: null, is_public: false, cartas: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => ({ id: `sv8-${n}` })), updated_at: '2026-10-05T10:00:00Z' },
  { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', descripcion: null, tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', tapa: null, portada: null, estilo: null, cartas: CARTAS.map((c) => ({ id: c.id })), updated_at: '2026-10-04T10:00:00Z' },
]
const COLECCION = [1, 2, 4, 5, 7, 12].map((n, i) => ({ id: `l${n}`, card_id: `sv8-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${(i % 8) + 1}T10:00:00Z` }))

async function abrir(url, { movil = false, albumes = ALBUMES } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, albumes, COLECCION }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = COLECCION
    window.__FAKE_ALBUMES__ = albumes
    try { localStorage.setItem('pokedoc-theme', 'dark') } catch {}
  }, { SETS, CARTAS, albumes, COLECCION })
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
  await page.waitForSelector('#mcAlbArchivador .mc-hoja, #mcAlbumesRejilla > *', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}
const fila = (page, id) => page.evaluate((id) => {
  const a = window.__TABLAS__.user_albums.find((x) => x.id === id)
  return a && { tapa: a.tapa, estilo: a.estilo, rejilla: a.rejilla, paginas: a.paginas, nombre: a.nombre, tieneEstilo: 'estilo' in a }
}, id)
const vista = (page) => page.evaluate(() => {
  const v = document.getElementById('mcAlbEditVista')
  const t = v.querySelector('.mc-tapa-cerrada')
  const b = v.querySelector('.mc-binder')
  return {
    tapa: t?.dataset.tapa, acabado: t?.dataset.acabado, cierre: t?.dataset.cierre, ventana: !!t?.querySelector('.mc-tapa-ventana'), placa: t?.querySelector('.mc-tapa-placa')?.textContent,
    hojas: b?.dataset.hojas, acabadoDentro: b?.dataset.acabado, tapaDentro: b?.dataset.tapa, bolsillos: b?.querySelectorAll('.mc-hoja:not(.mc-hoja-fantasma) .mc-bolsillo').length, columnas: b?.style.getPropertyValue('--cols') || '3',
  }
})
const pestaniaVista = (page) => page.evaluate(() => ({
  apretada: document.querySelector('[data-albe-pestania][aria-pressed="true"]')?.dataset.albePestania,
  aspecto: !document.querySelector('[data-albe-panel="aspecto"]').hidden,
  datos: !document.querySelector('[data-albe-panel="datos"]').hidden,
}))

console.log('── 2. Personalizar un binder, en el ordenador ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin')
  await page.click('#mcAlbAjustes')
  await page.waitForTimeout(300)
  const p = await pestaniaVista(page)
  check('«Personalizar» abre la hoja en Aspecto', (await page.$eval('#mcAlbEdit', (d) => d.open)) && p.apretada === 'aspecto' && p.aspecto && !p.datos, JSON.stringify(p))
  let v = await vista(page)
  check('la vista previa: la tapa cerrada (azul, lona, cremallera, con ventana y su nombre) y una hoja por dentro', v.tapa === 'azul' && v.acabado === 'lona' && v.cierre === 'cremallera' && v.ventana && v.placa === 'BW/XY' && v.hojas === 'grises' && v.bolsillos === 9, JSON.stringify(v))
  const grupos = await page.evaluate(() => ['mcAlbEditTapasBloque', 'mcAlbEditAcabadoBloque', 'mcAlbEditVentanaBloque', 'mcAlbEditHojasBloque', 'mcAlbEditCierreBloque', 'mcAlbEditRejillaBloque'].filter((id) => document.getElementById(id).getClientRects().length))
  check('se ofrece todo: color, acabado, ventana, hojas, cierre y bolsillos', grupos.length === 6, JSON.stringify(grupos))
  check('  …con lo que tiene puesto apretado', await page.evaluate(() => ['mcAlbEditAcabado', 'mcAlbEditHojas', 'mcAlbEditCierre', 'mcAlbEditVentana', 'mcAlbEditRejilla'].map((id) => document.querySelector(`#${id} [aria-pressed="true"]`)?.textContent.trim()).join('|')) === 'Lona|Grises|Cremallera|Con carta de portada|3×3')
  if (CAPS) await page.screenshot({ path: `${CAPS}/1050-aspecto-pc.png` })
  await page.click('#mcAlbEditTapas [data-tapa="rojo"]')
  await page.click('[data-acabado-op="piel"]')
  await page.click('[data-hojas-op="blancas"]')
  await page.click('[data-cierre-op="goma"]')
  await page.click('[data-ventana-op="no"]')
  await page.click('#mcAlbEditRejilla [data-rejilla="2x2"]')
  v = await vista(page)
  check('cada toque cambia la vista: rojo, piel, hojas blancas, goma, sin ventana y 2×2', v.tapa === 'rojo' && v.tapaDentro === 'rojo' && v.acabado === 'piel' && v.acabadoDentro === 'piel' && v.hojas === 'blancas' && v.cierre === 'goma' && !v.ventana && v.bolsillos === 4 && v.columnas === '2', JSON.stringify(v))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1050-aspecto-pc-cambiado.png` })
  await page.click('#mcAlbEditGuardar')
  await page.waitForTimeout(500)
  const f = await fila(page, 'alb-bin')
  check('al guardar, la fila lleva el estilo entero, el color y los bolsillos (11 cartas caben en sus 4 páginas de 2×2)', f.tapa === 'rojo' && JSON.stringify(f.estilo) === '{"acabado":"piel","hojas":"blancas","cierre":"goma","ventana":"no"}' && f.rejilla === '2x2' && f.paginas === 4, JSON.stringify(f))
  const dentro = await page.evaluate(() => {
    const b = document.querySelector('#mcAlbArchivador .mc-binder')
    return { tapa: b?.dataset.tapa, acabado: b?.dataset.acabado, hojas: b?.dataset.hojas, cierre: b?.dataset.cierre, porHoja: b?.querySelector('.mc-hoja:not(.mc-hoja-fantasma)')?.querySelectorAll('.mc-bolsillo').length, cabecera: document.querySelector('#mcAlbCabeceraLogo .mc-tapa-cerrada')?.dataset.acabado, abierta: document.getElementById('mcAlbEdit').open }
  })
  check('  …y el álbum abierto se repinta así, también la tapa de la cabecera', !dentro.abierta && dentro.tapa === 'rojo' && dentro.acabado === 'piel' && dentro.hojas === 'blancas' && dentro.cierre === 'goma' && dentro.porHoja === 4 && dentro.cabecera === 'piel', JSON.stringify(dentro))
  // Datos.
  await page.click('#mcAlbAjustes')
  await page.click('[data-albe-pestania="datos"]')
  const p2 = await pestaniaVista(page)
  check('la pestaña Datos: nombre, descripción, público y borrar', p2.apretada === 'datos' && !p2.aspecto && p2.datos && (await page.isVisible('#mcAlbEditNombre')) && (await page.isVisible('#mcAlbEditBorrar')) && !(await page.isVisible('#mcAlbEditAcabado')), JSON.stringify(p2))
  await page.fill('#mcAlbEditNombre', 'Mis Full Art')
  await page.click('#mcAlbEditGuardar')
  await page.waitForTimeout(400)
  check('  …y el nombre se guarda', (await fila(page, 'alb-bin')).nombre === 'Mis Full Art' && (await page.textContent('#mcAlbTitulo')).trim() === 'Mis Full Art')
  // Cancelar no escribe.
  await page.click('#mcAlbAjustes')
  await page.click('[data-acabado-op="holo"]')
  await page.click('#mcAlbEditCancelar')
  check('«Cancelar» cierra sin escribir', !(await page.$eval('#mcAlbEdit', (d) => d.open)) && (await fila(page, 'alb-bin')).estilo.acabado === 'piel')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Desde la lista, el ⋯ abre Datos; y Mis álbumes lo pinta ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas', { albumes: [{ ...ALBUMES[0], estilo: { acabado: 'holo', hojas: 'negras', cierre: 'ninguno', ventana: 'si' }, tapa: 'morado' }] })
  const t = await page.$eval('[data-album="alb-bin"] .mc-tapa-cerrada', (x) => ({ tapa: x.dataset.tapa, acabado: x.dataset.acabado, cierre: x.dataset.cierre }))
  check('la tapa de la lista lleva su estilo', t.tapa === 'morado' && t.acabado === 'holo' && t.cierre === 'ninguno', JSON.stringify(t))
  await page.click('[data-album-menu="alb-bin"] > summary')
  await page.click('[data-album-menu="alb-bin"] [data-album-accion="editar"]')
  await page.waitForTimeout(300)
  const p = await pestaniaVista(page)
  check('el ⋯ «Editar…» abre la hoja en Datos, con el nombre a mano', p.apretada === 'datos' && p.datos && (await page.evaluate(() => document.activeElement?.id)) === 'mcAlbEditNombre', JSON.stringify(p))
  await page.click('[data-albe-pestania="aspecto"]')
  const v = await vista(page)
  check('  …y su Aspecto enseña lo que tiene', v.tapa === 'morado' && v.acabado === 'holo' && v.hojas === 'negras' && v.cierre === 'ninguno', JSON.stringify(v))
  await page.click('#mcAlbEditTapas [data-tapa="verde"]')
  await page.click('#mcAlbEditGuardar')
  await page.waitForTimeout(500)
  check('al guardar, la baldosa cambia', await page.$eval('[data-album="alb-bin"] .mc-tapa-cerrada', (x) => x.dataset.tapa) === 'verde')
  await page.click('[data-alb-vista="lomos"]')
  const lomo = await page.$eval('.mc-lomo-libro[data-album="alb-bin"]', (x) => ({ tapa: x.dataset.tapa, acabado: x.dataset.acabado }))
  check('  …y su lomo en la estantería, con el mismo color y acabado', lomo.tapa === 'verde' && lomo.acabado === 'holo', JSON.stringify(lomo))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Sin la migración ──')
{
  const sinEstilo = Object.fromEntries(Object.entries(ALBUMES[0]).filter(([k]) => k !== 'estilo'))
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin', { albumes: [sinEstilo] })
  await page.click('#mcAlbAjustes')
  await page.waitForTimeout(300)
  const grupos = await page.evaluate(() => ['mcAlbEditTapasBloque', 'mcAlbEditAcabadoBloque', 'mcAlbEditVentanaBloque', 'mcAlbEditHojasBloque', 'mcAlbEditCierreBloque', 'mcAlbEditRejillaBloque', 'mcAlbEditVentana'].filter((id) => document.getElementById(id).getClientRects().length))
  check('solo lo que la base tiene: color, portada y bolsillos', grupos.join() === 'mcAlbEditTapasBloque,mcAlbEditVentanaBloque,mcAlbEditRejillaBloque', JSON.stringify(grupos))
  await page.click('#mcAlbEditTapas [data-tapa="rosa"]')
  await page.click('#mcAlbEditGuardar')
  await page.waitForTimeout(400)
  const f = await fila(page, 'alb-bin')
  check('  …y al guardar no se pide la columna que no existe', f.tapa === 'rosa' && !f.tieneEstilo, JSON.stringify(f))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Un álbum de set ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-set')
  await page.click('#mcAlbAjustes')
  await page.waitForTimeout(300)
  check('también tiene color y bolsillos', (await page.isVisible('#mcAlbEditTapas')) && (await page.isVisible('#mcAlbEditRejilla')))
  await page.click('#mcAlbEditTapas [data-tapa="negro"]')
  await page.click('#mcAlbEditRejilla [data-rejilla="4x4"]')
  await page.click('#mcAlbEditGuardar')
  await page.waitForTimeout(500)
  const d = await page.evaluate(() => {
    const b = document.querySelector('#mcAlbArchivador .mc-binder')
    return { tapa: b?.dataset.tapa, porHoja: [...b.querySelectorAll('.mc-hoja')].map((h) => h.querySelectorAll('.mc-bolsillo').length) }
  })
  const f = await fila(page, 'alb-set')
  check('al guardar, el set va en negro y a 16 por página', f.tapa === 'negro' && f.rejilla === '4x4' && d.tapa === 'negro' && d.porHoja.some((n) => n === 16), JSON.stringify({ f, d }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. En el móvil ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin', { movil: true })
  await page.click('#mcAlbAjustes')
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => {
    const d = document.getElementById('mcAlbEdit').getBoundingClientRect()
    const t = document.querySelector('#mcAlbEditVista .mc-albe-tapa').getBoundingClientRect()
    const b = document.querySelector('#mcAlbEditVista .mc-albe-dentro').getBoundingClientRect()
    return { cabe: d.left >= 0 && d.right <= innerWidth && d.bottom <= innerHeight, enFila: Math.abs(t.top + t.height / 2 - (b.top + b.height / 2)) < 40 && b.left > t.right, botones: [...document.querySelectorAll('#mcAlbEditAcabado button')].map((x) => Math.round(x.getBoundingClientRect().height)) }
  })
  check('la hoja cabe y la vista va arriba, la tapa al lado de la hoja', m.cabe && m.enFila, JSON.stringify(m))
  check('  …con botones de 44', m.botones.every((h) => h >= 44), JSON.stringify(m.botones))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1050-aspecto-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `❌ ${fails} FALLAN` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)
