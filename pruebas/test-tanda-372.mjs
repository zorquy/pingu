// Tanda 372 — la estantería: fuera el desplegable de 220 colecciones.
//
// Para abrir un álbum había que elegir el set en un `<select>`. Además de
// ser lo menos vistoso que hay, **escondía lo único que engancha de
// coleccionar: cuánto llevas**. Con la lista abierta ves de un vistazo
// dónde te falta poco para completar, que es exactamente lo que hace
// volver al día siguiente.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const LOGO = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"><rect width="240" height="80" fill="#1e5175"/><text x="120" y="50" font-size="26" text-anchor="middle" fill="#fff">${n}</text></svg>`
const SETS = [
  ['sv1', 'Escarlata y Púrpura', 'sv', 'Escarlata y Púrpura', 20],
  ['sv2', 'Evoluciones en Paldea', 'sv', 'Escarlata y Púrpura', 30],
  ['swsh1', 'Espada y Escudo', 'swsh', 'Espada y Escudo', 40],
  ['sm1', 'Sol y Luna', 'sm', 'Sol y Luna', 12],
]

async function abrir(coleccion, opciones = {}) {
  const page = await browser.newPage({ viewport: opciones.viewport || { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => {
    const u = String(r.request().url())
    if (u.includes('/logo')) return r.fulfill({ contentType: 'image/svg+xml', body: LOGO('SET') })
    r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>' })
  })
  await page.addInitScript(([sets, col]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = sets.map(([id, name, sid, sname, n]) => ({
      id, name, serie_id: sid, serie_name: sname, market: 'WEST',
      logo_path: `${id}/logo`, card_count_official: n, card_count_total: n,
      release_date: '2023-03-31', tcg_online_code: id.toUpperCase(),
    }))
    window.__FAKE_CARTAS__ = sets.flatMap(([id, , , , n]) =>
      Array.from({ length: n }, (_, i) => ({
        id: `${id}-${i + 1}`, set_id: id, local_id: String(i + 1).padStart(3, '0'),
        name: `C${i + 1}`, name_es: `C${i + 1}`, image_path: `x/${id}/${i + 1}`, market: 'WEST',
      })))
    window.__FAKE_COLECCION__ = col
  }, [SETS, coleccion])
  // `?ver=album` y los localizadores ACOTADOS a ese panel, desde la tanda
  // 447. La estantería se pinta en DOS sitios: aquí y en el vistazo «Tus
  // colecciones» del Panel (tanda 443), con la misma clase. Sin acotar,
  // `.mc-set-tarjeta` contaba SEIS donde hay cuatro y
  // `.mc-set-tarjeta.completo` casaba con dos — una violación de modo
  // estricto que tumbaba la prueba. Una clase que se pinta en dos
  // pantallas necesita que la prueba diga en CUÁL mira.
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.locator('[data-pestania="album"]').click()
  await page.waitForTimeout(1600)
  return { page, errores }
}

console.log('\n── 1. El desplegable ya no está ──')
{
  const html = leer('mi-coleccion.html')
  const js = leer('js/mi-coleccion.js')
  // El nombre del id ENTERO: buscar el trozo suelto casaría con
  // `mcAlbumSetOtraCosa` (la trampa de la 312).
  check('no queda el select de colecciones', !/id="mcAlbumSet"/.test(html), (html.match(/id="mcAlbumSet[^"]*"/) || [])[0])
  check('  …ni quien lo llenaba', !/pintarSelectorAlbum/.test(js))
}

console.log('\n── 2. La estantería, con su progreso ──')
{
  // 9 distintas de 20 en sv1, 3 de 40 en swsh1, y sv1 completa no.
  const { page, errores } = await abrir([
    ...Array.from({ length: 9 }, (_, i) => ({ id: `a${i}`, card_id: `sv1-${i + 1}`, cantidad: 1 })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, card_id: `swsh1-${i + 1}`, cantidad: 1 })),
  ])
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('salen las cuatro colecciones', (await page.locator('#mcPanelAlbum .mc-set-tarjeta').count()) === 4,
    String(await page.locator('#mcPanelAlbum .mc-set-tarjeta').count()))
  const texto = (n) => page.locator('#mcPanelAlbum .mc-set-tarjeta').nth(n).textContent()
  // Se comprueba LA TARJETA DE SV1, no «la primera» (tanda 510). Lo que
  // esta línea vigila es que el progreso salga, y atarlo a la posición 0
  // mezclaba eso con el orden de la estantería: al darle a la 510 un
  // desempate estable a los sets del mismo día, el fixture reordenó y la
  // prueba se puso roja sin que el progreso tuviera nada de malo. El
  // orden tiene su propia comprobación unas líneas más abajo.
  const tarjetaSv1 = page.locator('#mcPanelAlbum .mc-set-tarjeta[data-set="sv1"]')
  check('la tarjeta de sv1 dice cuánto llevas', /9 de 20/.test((await tarjetaSv1.textContent()) || ''),
    (await tarjetaSv1.textContent())?.replace(/\s+/g, ' '))

  // ── «NO HAY NINGUNA» Y «TUS FILTROS LAS ESCONDEN» SON DOS COSAS (510) ──
  //
  // Compartían frase, y el «todavía» mentía en el segundo caso: decía
  // «espera y se llenará» cuando lo que había que hacer era quitar un
  // filtro. Es la misma familia que el `return` mudo de /cartas.
  // Se ponen LOS DOS filtros que hay, no solo uno: «quitar los filtros»
  // tiene que quitarlos todos, y con uno solo puesto la comprobación se
  // aprobaba sin ejercitar la mitad del botón.
  await page.click('#mcEstanteriaEmpezadas')
  await page.waitForTimeout(400)
  await page.fill('#mcEstanteriaBuscar', 'zzzzz-no-existe')
  await page.waitForTimeout(600)
  const estados = await page.evaluate(() => ({
    vacio: !document.getElementById('mcAlbumVacio')?.classList.contains('hidden'),
    filtrado: !document.getElementById('mcAlbumFiltrado')?.classList.contains('hidden'),
    texto: document.getElementById('mcAlbumFiltradoCuantas')?.textContent || '',
  }))
  check('con filtros que no dejan pasar nada, NO dice «no hay ninguna todavía»', estados.vacio === false, JSON.stringify(estados))
  check('  …dice que son los filtros', estados.filtrado === true, JSON.stringify(estados))
  check('  …y cuántas te está escondiendo', /4 colecciones/.test(estados.texto), estados.texto)
  // Y el botón las QUITA de verdad: dejar uno puesto sería dejar la
  // pantalla igual de vacía y el botón pareciendo roto.
  await page.click('#mcEstanteriaLimpiar')
  await page.waitForTimeout(800)
  check('«quitar los filtros» devuelve las cuatro',
    (await page.locator('#mcPanelAlbum .mc-set-tarjeta').count()) === 4,
    String(await page.locator('#mcPanelAlbum .mc-set-tarjeta').count()))
  check('  …y deja la caja de búsqueda limpia',
    (await page.inputValue('#mcEstanteriaBuscar')) === '', await page.inputValue('#mcEstanteriaBuscar'))
  check('  …y suelta también «solo las empezadas»',
    (await page.getAttribute('#mcEstanteriaEmpezadas', 'aria-pressed')) === 'false',
    await page.getAttribute('#mcEstanteriaEmpezadas', 'aria-pressed'))

  // Desde la tanda 409 el orden NO es «las tuyas primero»: PINGU lo quitó
  // («arriba solo si la pones como favorito; si no, se van a agrupar
  // arriba y no tiene sentido»). Los rótulos son las ERAS, y una
  // colección empezada se queda en la suya. Lo que sigue siendo de esta
  // tanda es el progreso, que es lo que se comprueba aquí.
  check('los rótulos son eras y no «tus colecciones»',
    !(await page.locator('#mcPanelAlbum .mc-estanteria-titulo').allTextContents()).some((t) => /tus colecciones|empezar otra/i.test(t)),
    (await page.locator('#mcPanelAlbum .mc-estanteria-titulo').allTextContents()).join(' | '))

  // La barra no se estira: `.mc-barra` nace con `flex: 1 1 200px` para
  // vivir en una FILA, y dentro de una tarjeta en columna ese grow la
  // convierte en un óvalo del tamaño de la tarjeta. Se mide.
  const alto = await page.locator('#mcPanelAlbum .mc-set-tarjeta .mc-barra').first().evaluate((e) => Math.round(e.getBoundingClientRect().height))
  check('la barra de progreso sigue siendo una barra', alto <= 12, `${alto}px`)
  await page.close()
}

console.log('\n── 3. Una colección completa se nota ──')
{
  const { page } = await abrir(Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, card_id: `sm1-${i + 1}`, cantidad: 1 })))
  const completa = page.locator('#mcPanelAlbum .mc-set-tarjeta.completo')
  check('la completa va marcada', (await completa.count()) === 1, String(await completa.count()))
  check('  …y lo dice con palabras', /completa/i.test((await completa.textContent()) || ''),
    (await completa.textContent())?.replace(/\s+/g, ' '))
  await page.close()
}

console.log('\n── 4. Buscar y filtrar por serie ──')
{
  const { page } = await abrir([{ id: 'a', card_id: 'sv1-1', cantidad: 1 }])
  await page.fill('#mcEstanteriaBuscar', 'paldea')
  await page.waitForTimeout(500)
  check('el buscador filtra', (await page.locator('#mcPanelAlbum .mc-set-tarjeta').count()) === 1,
    String(await page.locator('#mcPanelAlbum .mc-set-tarjeta').count()))
  await page.fill('#mcEstanteriaBuscar', '')
  await page.waitForTimeout(400)
  await page.selectOption('#mcEstanteriaSerie', 'swsh')
  await page.waitForTimeout(500)
  check('y la serie también', (await page.locator('#mcPanelAlbum .mc-set-tarjeta').count()) === 1,
    String(await page.locator('#mcPanelAlbum .mc-set-tarjeta').count()))
  // Las series salen de los sets que hay, no de una lista escrita a
  // mano: una serie nueva aparece sola.
  check('  …con las series que hay de verdad', (await page.locator('#mcEstanteriaSerie option').count()) === 4,
    String(await page.locator('#mcEstanteriaSerie option').count()))
  await page.close()
}

console.log('\n── 5. Abrir una colección y volver ──')
{
  const { page, errores } = await abrir([{ id: 'a', card_id: 'sv1-1', cantidad: 1 }])
  await page.locator('#mcPanelAlbum .mc-set-tarjeta').first().click()
  await page.waitForTimeout(1600)
  // Desde la 417 una expansión es una REJILLA y no un archivador: el
  // formato álbum se quedó para los álbumes soñados, que es donde el
  // orden lo pones tú carta a carta.
  check('se abre la colección', (await page.locator('.mc-album-rejilla').count()) === 1)
  check('  …y no es un archivador', (await page.locator('#mcAlbum .mc-binder').count()) === 0)
  check('  …con el nombre de la colección', ((await page.locator('#mcAlbumTitulo').textContent()) || '').length > 0,
    await page.locator('#mcAlbumTitulo').textContent())
  check('  …y la estantería se esconde', !(await page.locator('#mcEstanteriaZona').isVisible()))
  await page.locator('#mcAlbumVolver').click()
  await page.waitForTimeout(900)
  check('y se vuelve a la estantería', await page.locator('#mcEstanteriaZona').isVisible())
  check('  …con el archivador escondido', !(await page.locator('#mcArchivadorZona').isVisible()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
