// Tanda 1048 — el álbum abierto sin anillas (PINGU, con dos fotos: «un
// álbum moderno se ve así, y no usa anillas»).
//
// Lo que se comprueba, en el ordenador y en el móvil:
//   · el dibujo: tapa con su acabado, cremallera, lomo de tela, hojas
//     grises y fundas con pespunte; nada de anillas;
//   · la cabecera: la tapa en pequeño, el nombre y el anillo de lo que llevas;
//   · una fila de mandos (sin «Ordenar y quitar»), «Todas / Tengo / Faltan»
//     y el «⋯» con público, compartir, lista y borrar;
//   · Seleccionar: marcar, quitar del álbum con Deshacer, la portada (con una
//     sola) y las quiero; la portada es una cinta, no una estrella;
//   · arrastrar a la papelera saca la carta; las flechas ← → ya no existen;
//   · el mapa del álbum lleva a su pliego;
//   · la vista «Archivador» de una expansión es el mismo dibujo.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'
import { estiloDe } from '/home/user/pingu/js/mi-coleccion/archivador.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''
// Las cartas de las capturas de PINGU, para que la pantalla se parezca a la
// de verdad (si no están, un rectángulo de color).
const DIR_CARTAS = process.env.PD_CARTAS || '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/albumes/pub/cartas'
let FOTOS = []
try { FOTOS = readdirSync(DIR_CARTAS).filter((f) => f.endsWith('.jpg')).map((f) => readFileSync(`${DIR_CARTAS}/${f}`)) } catch { /* sin fotos */ }

console.log('── 1. El estilo, puro ──')
check('sin estilo: lona, hojas grises y cremallera', JSON.stringify(estiloDe(null)) === '{"acabado":"lona","hojas":"grises","cierre":"cremallera"}')
check('lo que no se reconoce cae en lo de por defecto', JSON.stringify(estiloDe({ acabado: 'oro', hojas: 'blancas', cierre: 'velcro' })) === '{"acabado":"lona","hojas":"blancas","cierre":"cremallera"}')

const browser = await chromium.launch()
const N = 30
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, logo_tcggo: 'https://images.tcggo.com/logo-sv8.png' }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
// Un binder de 3×3 y 6 páginas: 14 cartas, con huecos, y una de portada.
const EN_BINDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, 12, 13, 14, null, 16]
const ALBUMES = [
  { id: 'alb-bin', user_id: 'admin-1', nombre: 'BW/XY', descripcion: 'Las Full Art', tipo: 'binder', rejilla: '3x3', paginas: 6, tapa: 'azul', portada: 'sv8-4', is_public: false, cartas: EN_BINDER.map((n) => (n ? { id: `sv8-${n}` } : {})), updated_at: '2026-10-05T10:00:00Z' },
  { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', cartas: CARTAS.map((c) => ({ id: c.id })), updated_at: '2026-10-04T10:00:00Z' },
]
const COLECCION = [1, 2, 4, 5, 7, 12].map((n, i) => ({ id: `l${n}`, card_id: `sv8-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${(i % 8) + 1}T10:00:00Z` }))

async function abrir(url, { movil = false, ancho = 1280, vistaAlbum = null } = {}) {
  // Sin service worker: lo que él pide no pasa por `route` (897) y las fotos
  // de mentira no llegarían.
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' } : { viewport: { width: ancho, height: 1000 }, locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES, COLECCION, vistaAlbum }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = COLECCION
    window.__FAKE_ALBUMES__ = ALBUMES
    window.__FAKE_DESEOS__ = [{ id: 'd1', user_id: 'admin-1', card_id: 'sv8-3', idioma: null, created_at: '2026-10-01T10:00:00Z' }]
    try { localStorage.setItem('pokedoc-theme', 'dark'); if (vistaAlbum) localStorage.setItem('mc-album-vista', vistaAlbum) } catch {}
  }, { SETS, CARTAS, ALBUMES, COLECCION, vistaAlbum })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => {
    const url = r.request().url()
    if (/logo/.test(url)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' })
    const n = Number((url.match(/sv8\/(\d+)/) || [])[1] || 0)
    if (FOTOS.length) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: FOTOS[n % FOTOS.length] })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-hoja, .mc-exp-archivador .mc-hoja', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}
const guardado = (page, id) => page.evaluate((id) => (window.__TABLAS__.user_albums.find((a) => a.id === id)?.cartas || []).map((c) => (c.id || '·').replace('sv8-', '')).join(), id)

console.log('── 2. El binder abierto, en el ordenador ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const dibujo = await page.evaluate(() => {
    const b = document.querySelector('#mcAlbArchivador .mc-binder')
    const funda = document.querySelector('#mcAlbArchivador .mc-bolsillo.tengo')
    const hoja = document.querySelector('#mcAlbArchivador .mc-hoja')
    return {
      acabado: b?.dataset.acabado, hojas: b?.dataset.hojas, cierre: b?.dataset.cierre,
      anillas: document.querySelectorAll('#mcAlbArchivador .mc-anillas, #mcAlbArchivador .mc-anillas i').length,
      lomo: !!document.querySelector('#mcAlbArchivador .mc-lomo'),
      dos: document.querySelector('#mcAlbArchivador .mc-archivador')?.classList.contains('mc-dos'),
      lados: [...document.querySelectorAll('#mcAlbArchivador .mc-hoja')].map((h) => (h.classList.contains('mc-hoja-izq') ? 'izq' : h.classList.contains('mc-hoja-der') ? 'der' : '?')).join(),
      pespunte: funda ? getComputedStyle(funda).outlineStyle : '',
      funda: funda ? getComputedStyle(funda, '::before').content : '',
      cremallera: b ? getComputedStyle(b, '::before').content : '',
      hoja: hoja ? getComputedStyle(hoja).backgroundColor : '',
    }
  })
  check('sin anillas: lomo de tela entre dos hojas (izquierda y derecha)', dibujo.anillas === 0 && dibujo.lomo && dibujo.dos && dibujo.lados === 'izq,der', JSON.stringify(dibujo))
  check('  …lona, hojas grises y cremallera, por defecto', dibujo.acabado === 'lona' && dibujo.hojas === 'grises' && dibujo.cierre === 'cremallera' && dibujo.cremallera !== 'none', JSON.stringify(dibujo))
  check('  …la hoja gris y cada funda con su pespunte y su plástico', dibujo.hoja === 'rgb(43, 48, 53)' && dibujo.pespunte === 'dashed' && dibujo.funda !== 'none', JSON.stringify(dibujo))
  const cab = await page.evaluate(() => ({
    tapa: !!document.querySelector('#mcAlbCabeceraLogo .mc-tapa-cerrada .mc-tapa-ventana img'),
    titulo: document.getElementById('mcAlbTitulo').tagName + ':' + document.getElementById('mcAlbTitulo').textContent,
    desc: document.getElementById('mcAlbDescripcion').textContent,
    anillo: document.querySelector('#mcAlbProgreso .mc-alb-anillo')?.style.getPropertyValue('--p'),
    cuenta: document.querySelector('#mcAlbProgreso .mc-alb-cuenta')?.textContent.replace(/\s+/g, ' ').trim(),
  }))
  check('la cabecera: la tapa en pequeño con la portada, el nombre y el anillo', cab.tapa && cab.titulo === 'H3:BW/XY' && cab.desc === 'Las Full Art' && cab.anillo === '43' && /6 de 14/.test(cab.cuenta), JSON.stringify(cab))
  const mandos = await page.evaluate(() => ({
    viejos: ['mcAlbEditar', 'mcAlbSoloFaltan', 'mcAlbSalto', 'mcAlbumTapa', 'mcAlbAyuda'].filter((id) => document.getElementById(id)),
    fila: (() => { const hs = [...document.querySelectorAll('#mcAlbHerramientas .mc-alb-fila > *, #mcAlbMenu')].filter((e) => e.offsetParent); return new Set(hs.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2))).size })(),
    flechas: document.querySelectorAll('#mcAlbArchivador [data-mover]').length,
    estrella: document.querySelectorAll('#mcAlbArchivador .mc-alb-es-portada, #mcAlbArchivador .mc-bolsillo-portada').length,
  }))
  check('sin «Ordenar y quitar», sin casillas sueltas ni «Ir a…»: una fila de mandos', mandos.viejos.length === 0 && mandos.fila === 1, JSON.stringify(mandos))
  check('  …y sin flechas ← → ni estrellas en las cartas', mandos.flechas === 0 && mandos.estrella === 0, JSON.stringify(mandos))
  const cinta = await page.evaluate(() => {
    const c = document.querySelector('#mcAlbArchivador .mc-alb-cinta')
    const caja = c?.closest('.mc-bolsillo')
    if (!c || !caja) return null
    const r = c.getBoundingClientRect(), b = caja.getBoundingClientRect()
    return { carta: caja.dataset.carta, abajo: r.bottom > b.top + b.height * 0.7, izq: r.left < b.left + b.width * 0.5, texto: c.textContent.trim() }
  })
  check('la portada es una cinta abajo a la izquierda, no encima del corazón', cinta && cinta.carta === 'sv8-4' && cinta.abajo && cinta.izq && cinta.texto === 'Portada', JSON.stringify(cinta))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1048-pc.png`, fullPage: false })

  console.log('── 3. Todas / Tengo / Faltan ──')
  await page.click('#mcAlbQue [data-filtro="faltan"]')
  await page.waitForTimeout(200)
  const faltan = await page.evaluate(() => [...document.querySelectorAll('#mcAlbArchivador .mc-bolsillo[data-carta]')].map((b) => b.dataset.carta.replace('sv8-', '')).join())
  check('«Faltan» enseña solo las que no tienes', faltan === '3,6,8,9,10,13,14,16', faltan)
  check('  …y sin mapa (las páginas no son las del álbum)', (await page.locator('#mcAlbMapa .mc-alb-pliego').count()) === 0)
  await page.click('#mcAlbQue [data-filtro="tengo"]')
  await page.waitForTimeout(200)
  const tengo = await page.evaluate(() => [...document.querySelectorAll('#mcAlbArchivador .mc-bolsillo[data-carta]')].map((b) => b.dataset.carta.replace('sv8-', '')).join())
  check('«Tengo», solo las tuyas', tengo === '1,2,4,5,7,12', tengo)
  await page.click('#mcAlbQue [data-filtro="todas"]')
  await page.waitForTimeout(200)

  console.log('── 4. El mapa del álbum ──')
  const mapa = await page.evaluate(() => [...document.querySelectorAll('#mcAlbMapa .mc-alb-pliego')].map((b) => `${b.dataset.pliego}${b.classList.contains('aqui') ? '*' : ''}:${[...b.querySelectorAll('i')].map((i) => i.style.getPropertyValue('--tengo')).join('/')}`).join(' '))
  check('un botón por pliego, con lo que tienes de cada página', mapa === '0*:0.556/0.111 2:0.000/0.000 4:0.000/0.000', mapa)
  await page.click('#mcAlbMapa [data-pliego="2"]')
  await page.waitForTimeout(300)
  check('  …y lleva a su pliego', /^Página 3-4 de 6/.test(await page.textContent('#mcAlbPaginas')), await page.textContent('#mcAlbPaginas'))
  await page.click('#mcAlbMapa [data-pliego="0"]')
  await page.waitForTimeout(300)

  console.log('── 5. Seleccionar ──')
  await page.click('#mcAlbSeleccionar')
  await page.waitForTimeout(200)
  check('sale la barra de seleccionar', await page.isVisible('#mcAlbSel .mc-sel-arriba'))
  check('  …y se esconden el ✓, el corazón y la cinta', await page.evaluate(() => getComputedStyle(document.querySelector('#mcAlbArchivador .mc-tengo-marca')).visibility === 'hidden' && getComputedStyle(document.querySelector('#mcAlbArchivador .mc-alb-cinta')).visibility === 'hidden'))
  await page.click('#mcAlbArchivador .mc-bolsillo[data-carta="sv8-2"]')
  await page.click('#mcAlbArchivador .mc-bolsillo[data-carta="sv8-3"]')
  check('tocar marca (y no abre la ficha)', /2 seleccionadas/.test(await page.textContent('#mcAlbSelCuenta')) && !(await page.evaluate(() => document.querySelector('dialog[open]:not(.mc-panel-filtros)'))), await page.textContent('#mcAlbSelCuenta'))
  check('  …«De portada» solo con una', await page.isDisabled('#mcAlbSelPortada') && /Quitar 2 del álbum/.test(await page.textContent('#mcAlbSelQuitar')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1048-seleccion.png` })
  await page.click('#mcAlbSelQuitar')
  await page.waitForTimeout(800)
  check('quitar deja los bolsillos vacíos y las demás en su sitio', (await guardado(page, 'alb-bin')) === '1,·,·,4,5,6,7,8,9,10,·,12,13,14,·,16', await guardado(page, 'alb-bin'))
  check('  …se sale de seleccionar y el aviso trae Deshacer', !(await page.isVisible('#mcAlbSel .mc-sel-arriba')) && (await page.locator('.toast-accion', { hasText: 'Deshacer' }).count()) === 1)
  await page.click('.toast-accion')
  await page.waitForTimeout(800)
  check('Deshacer las devuelve', (await guardado(page, 'alb-bin')) === '1,2,3,4,5,6,7,8,9,10,·,12,13,14,·,16', await guardado(page, 'alb-bin'))
  await page.click('#mcAlbSeleccionar')
  await page.click('#mcAlbArchivador .mc-bolsillo[data-carta="sv8-7"]')
  check('con una, «De portada» se enciende', !(await page.isDisabled('#mcAlbSelPortada')))
  await page.click('#mcAlbSelPortada')
  await page.waitForTimeout(800)
  check('  …y la guarda', (await page.evaluate(() => window.__TABLAS__.user_albums.find((a) => a.id === 'alb-bin').portada)) === 'sv8-7')
  await page.click('#mcAlbSeleccionar')
  await page.click('#mcAlbArchivador .mc-bolsillo[data-carta="sv8-6"]')
  await page.click('#mcAlbArchivador .mc-bolsillo[data-carta="sv8-8"]')
  await page.click('#mcAlbSelQuiero')
  await page.waitForTimeout(800)
  const deseos = await page.evaluate(() => (window.__TABLAS__.user_wants || []).map((d) => d.card_id).sort().join())
  check('«Las quiero» las apunta', /sv8-6/.test(deseos) && /sv8-8/.test(deseos), deseos)

  console.log('── 6. Arrastrar a la papelera ──')
  const de = await page.locator('#mcAlbArchivador .mc-bolsillo[data-carta="sv8-9"]').boundingBox()
  await page.mouse.move(de.x + de.width / 2, de.y + de.height / 2)
  await page.mouse.down()
  await page.mouse.move(de.x + de.width / 2 + 20, de.y + de.height / 2 + 20, { steps: 4 })
  const visible = await page.isVisible('#mcAlbPapelera')
  const cubo = await page.locator('#mcAlbPapelera').boundingBox()
  await page.mouse.move(cubo.x + cubo.width / 2, cubo.y + cubo.height / 2, { steps: 8 })
  const activa = await page.evaluate(() => document.getElementById('mcAlbPapelera').classList.contains('activa'))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1048-papelera.png` })
  await page.mouse.up()
  await page.waitForTimeout(800)
  check('al coger una carta sale la papelera, y se enciende encima', visible && activa)
  check('  …soltarla ahí la saca del álbum', (await guardado(page, 'alb-bin')) === '1,2,3,4,5,6,7,8,·,10,·,12,13,14,·,16', await guardado(page, 'alb-bin'))
  check('  …y la papelera se va', !(await page.isVisible('#mcAlbPapelera')))
  const a = await page.locator('#mcAlbArchivador .mc-bolsillo[data-carta="sv8-1"]').boundingBox()
  const b = await page.locator('#mcAlbArchivador .mc-bolsillo[data-carta="sv8-2"]').boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(800)
  check('arrastrar sobre otra las cambia de sitio, sin modo aparte', (await guardado(page, 'alb-bin')).startsWith('2,1,'), await guardado(page, 'alb-bin'))

  console.log('── 7. El «⋯» ──')
  await page.click('#mcAlbMenu summary')
  check('el «⋯» lleva público y lista para imprimir (borrar, en la hoja de editar: 1032)', await page.isVisible('#mcAlbPublico') && await page.isVisible('#mcAlbChecklist') && (await page.locator('#mcAlbMenu #mcAlbBorrar, #mcAlbMenu .mc-menu-peligro').count()) === 0 && !(await page.isVisible('#mcAlbCopiar')))
  await page.click('#mcAlbPublico')
  await page.waitForTimeout(800)
  check('  …«Hacer público» lo guarda y enseña «Compartir enlace»', (await page.evaluate(() => window.__TABLAS__.user_albums.find((a) => a.id === 'alb-bin').is_public)) === true && /Hacer privado/.test(await page.textContent('#mcAlbPublicoTexto')))
  await ctx.close()
}

console.log('── 8. En el móvil ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin', { movil: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await page.evaluate(() => {
    const lomo = document.querySelector('#mcAlbArchivador .mc-lomo')?.getBoundingClientRect()
    const hoja = document.querySelector('#mcAlbArchivador .mc-hoja')?.getBoundingClientRect()
    const hs = [...document.querySelectorAll('#mcAlbHerramientas .mc-alb-fila > *, #mcAlbMenu')].filter((e) => e.offsetParent)
    return {
      hojas: document.querySelectorAll('#mcAlbArchivador .mc-hoja').length,
      lomoIzq: lomo && hoja ? lomo.right <= hoja.left + 1 : false,
      fila: new Set(hs.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2))).size,
      ancho: document.documentElement.scrollWidth <= window.innerWidth,
      mapa: getComputedStyle(document.getElementById('mcAlbMapa')).flexWrap,
    }
  })
  check('una hoja, con el lomo a su izquierda', m.hojas === 1 && m.lomoIzq, JSON.stringify(m))
  check('  …los mandos en una fila y nada se sale de la pantalla', m.fila === 1 && m.ancho, JSON.stringify(m))
  check('  …el mapa, una fila que se desliza', m.mapa === 'nowrap', JSON.stringify(m))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1048-movil.png`, fullPage: true })
  await ctx.close()
}

console.log('── 9. La expansión en vista «Archivador», el mismo dibujo ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv8', { vistaAlbum: 'archivador' })
  const exp = await page.evaluate(() => ({ binder: !!document.querySelector('.mc-exp-archivador .mc-binder[data-hojas="grises"]'), lomo: !!document.querySelector('.mc-exp-archivador .mc-lomo'), anillas: document.querySelectorAll('.mc-exp-archivador .mc-anillas').length }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la expansión en «Archivador» lleva el álbum nuevo, sin anillas', exp.binder && exp.lomo && exp.anillas === 0, JSON.stringify(exp))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1048-expansion.png` })
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
