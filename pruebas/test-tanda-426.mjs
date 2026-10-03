// Tanda 426 — marcar varias cartas de golpe en una expansión.
//
// Apuntar un sobre son diez cartas, y una a una eran diez botones
// pequeños, diez repintados de la rejilla y VEINTE peticiones (`anadir`
// hace un `select` por carta antes de su insert).
//
// Lo que se prueba, y por qué cada cosa:
//
//   · que el modo esté APAGADO por defecto y la rejilla se comporte igual
//     que siempre. En la tanda 365 hubo un interruptor de «tocar una carta
//     la añade» y se quitó en la 368 porque obligaba a elegir; si este se
//     quedara puesto, sería el mismo fallo con otro nombre;
//   · que marcar NO escriba nada hasta pulsar «Añadir», que es lo que
//     permite corregirse;
//   · que guardar sea UNA petición para las nuevas y no una por carta,
//     que es la razón de existir de la tanda;
//   · que una carta que YA tienes suba de copias en vez de nacer una fila
//     gemela —la lista la enseñaría dos veces—;
//   · y que en «separar variantes» marcar el reverse holo no marque la
//     normal: con el id de la carta a secas marcaría las dos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
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
const BASE = process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const browser = await chromium.launch()

const semilla = () => {
  window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Roaring Skies', market: 'WEST', card_count_official: 10,
    card_count_total: 10, release_date: '2015-05-06', logo_path: 'x/logo', tcg_online_code: 'ROS' }]
  window.__FAKE_CARTAS__ = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `sv1-10${n}`, set_id: 'sv1',
    local_id: `10${n}`, name: `Carta ${n}`, image_path: `x/${n}`, market: 'WEST', rarity: 'Common',
    category: 'Pokemon', illustrator: 'R', types: ['Colorless'], dex_ids: [n],
    // La primera tiene DOS versiones: hace falta para «separar variantes».
    variants: n === 1 ? { normal: true, reverse: true } : { normal: true } }))
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-101', cantidad: 1, idioma: 'es',
    estado: 'NM', variante: 'normal', notas: null }]
}

const abrir = async ({ ancho = 1280, alto = 1000, antes = null } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  if (antes) await page.addInitScript((a) => Object.assign(window, a), antes)
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  return { page, errores }
}
const escrituras = (page) =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').map((x) => `${x.tipo}:${x.tabla}:${x.filas.length}`))
const marcadas = (page) => page.locator('#mcAlbum .mc-bolsillo.marcada').count()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Apagado, la rejilla es la de siempre ──')
{
  const { page, errores } = await abrir()
  check('la barra no está', await page.locator('#mcMarcarBarra').isHidden())
  check('  …y el botón no está pulsado', (await page.locator('#mcMarcarAbrir').getAttribute('aria-pressed')) === 'false')
  check('el − y el + siguen ahí', await page.locator('#mcAlbum .mc-bolsillo-mando').first().isVisible())
  // Lo que se quitó en la 368: un modo puesto para siempre que no te deja
  // abrir una ficha. Pulsar una carta tiene que seguir abriéndola.
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(1).click()
  await page.waitForTimeout(700)
  check('pulsar una carta abre su ficha', (await page.locator('#mcEditor[open]').count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Encendido: se marca, y no se escribe nada ──')
{
  const { page, errores } = await abrir()
  await page.evaluate(() => sessionStorage.removeItem('__escrituras__'))
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(400)
  check('sale la barra', await page.locator('#mcMarcarBarra').isVisible())
  check('  …diciendo qué hacer', /Toca las cartas/.test(await page.locator('#mcMarcarCuenta').textContent()))
  check('  …con «Añadir» apagado mientras no haya nada', await page.locator('#mcMarcarGuardar').isDisabled())
  // Cada casilla tiene UN destino: el − y el + se van, y de paso salen del
  // tabulador (`display: none`, no `visibility`).
  check('el − y el + se esconden', await page.locator('#mcAlbum .mc-bolsillo-mando').first().isHidden())
  const enlaces = page.locator('#mcAlbum .mc-bolsillo-enlace')
  await enlaces.nth(1).click()
  await enlaces.nth(2).click()
  await page.waitForTimeout(400)
  check('pulsar marca, no abre la ficha', (await page.locator('#mcEditor[open]').count()) === 0)
  check('  …y van dos', (await marcadas(page)) === 2, String(await marcadas(page)))
  // El mismo botón lo apaga: es un interruptor, no un encendedor.
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(500)
  check('el mismo botón lo apaga', await page.locator('#mcMarcarBarra').isHidden())
  check('  …y lo dice', (await page.locator('#mcMarcarAbrir').getAttribute('aria-pressed')) === 'false')
  check('  …y el − y el + vuelven', await page.locator('#mcAlbum .mc-bolsillo-mando').first().isVisible())
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(500)
  check('  …y al volver a encenderlo no quedan marcas de antes', (await marcadas(page)) === 0, String(await marcadas(page)))
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(1).click()
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(2).click()
  await page.waitForTimeout(400)
  check('  …y el botón dice CUÁNTAS añade', (await page.locator('#mcMarcarGuardar').textContent()).trim() === 'Añadir 2',
    await page.locator('#mcMarcarGuardar').textContent())
  // Lo marcado vive en memoria: es lo que permite corregirse sin haber
  // escrito nada. Si marcara contra la base, «Cancelar» no podría existir.
  check('todavía no se ha escrito NADA', (await escrituras(page)).length === 0, JSON.stringify(await escrituras(page)))
  await enlaces.nth(2).click()
  await page.waitForTimeout(300)
  check('volver a pulsar desmarca', (await marcadas(page)) === 1, String(await marcadas(page)))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Lo marcado aguanta un repintado ──')
{
  // La rejilla se repinta entera cada dos por tres (un filtro, una
  // búsqueda). Una marca que viviera solo en una clase del DOM se
  // perdería en el primer repintado, y sin dar error: parecería que has
  // desmarcado tú.
  const { page } = await abrir()
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(400)
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(1).click()
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(3).click()
  await page.waitForTimeout(300)
  check('dos marcadas', (await marcadas(page)) === 2)
  await page.fill('#mcAlbumBuscar', 'Carta')
  await page.waitForTimeout(900)
  check('siguen marcadas tras buscar', (await marcadas(page)) === 2, String(await marcadas(page)))
  check('  …y la cuenta no se ha movido', /2 cartas marcadas/.test(await page.locator('#mcMarcarCuenta').textContent()))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Cancelar no guarda nada ──')
{
  const { page } = await abrir()
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(400)
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(1).click()
  await page.waitForTimeout(300)
  await page.evaluate(() => sessionStorage.removeItem('__escrituras__'))
  await page.click('#mcMarcarCancelar')
  await page.waitForTimeout(600)
  check('la barra se va', await page.locator('#mcMarcarBarra').isHidden())
  check('  …sin escribir nada', (await escrituras(page)).length === 0, JSON.stringify(await escrituras(page)))
  check('  …y sin marcas', (await marcadas(page)) === 0)
  check('  …y el − y el + vuelven', await page.locator('#mcAlbum .mc-bolsillo-mando').first().isVisible())
  // Y salir de la expansión también lo apaga: lo marcado es de ESTE set.
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(300)
  await page.click('#mcAlbumVolver')
  await page.waitForTimeout(800)
  // Y se MIRA volviendo a entrar. Con la expansión cerrada, la barra está
  // dentro de una zona escondida, así que `isHidden()` sale verde por el
  // padre aunque el modo siguiera puesto: estaría comprobando que la zona
  // se esconde, que es otra cosa.
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1500)
  check('entrar en una expansión empieza con el modo apagado', await page.locator('#mcMarcarBarra').isHidden())
  check('  …y el − y el + están donde siempre', await page.locator('#mcAlbum .mc-bolsillo-mando').first().isVisible())
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Guardar: UNA petición, no una por carta ──')
{
  const { page, errores } = await abrir()
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(400)
  const enlaces = page.locator('#mcAlbum .mc-bolsillo-enlace')
  // Tres que no tengo y la primera, que SÍ tengo.
  await enlaces.nth(1).click()
  await enlaces.nth(2).click()
  await enlaces.nth(3).click()
  await enlaces.nth(0).click()
  await page.waitForTimeout(400)
  await page.evaluate(() => sessionStorage.removeItem('__escrituras__'))
  await page.click('#mcMarcarGuardar')
  await page.waitForTimeout(1800)
  const esc = await escrituras(page)
  // La razón de ser de la tanda: cuatro cartas, no cuatro inserts.
  check('las nuevas entran en UNA sola petición', esc.filter((x) => x.startsWith('insert')).length === 1, JSON.stringify(esc))
  check('  …con las tres dentro', esc.includes('insert:user_collection:3'), JSON.stringify(esc))
  // La que ya tenías sube de copias. Una fila gemela no daría error: la
  // lista de «Cartas» la enseñaría dos veces y nadie sabría por qué.
  const suyas = await page.evaluate(() => window.__TABLAS__.user_collection.filter((x) => x.card_id === 'sv1-101'))
  check('la que ya tenías sigue siendo UNA fila', suyas.length === 1, JSON.stringify(suyas.length))
  check('  …con una copia más', Number(suyas[0].cantidad) === 2, String(suyas[0].cantidad))
  check('en total, cuatro filas', (await page.evaluate(() => window.__TABLAS__.user_collection.length)) === 4)
  check('la barra se cierra sola', await page.locator('#mcMarcarBarra').isHidden())
  // Y lo guardado entra en la lista de la página, no solo en la base: sin
  // eso, la pestaña «Cartas» seguiría enseñando la colección de antes
  // hasta que recargaras, y no daría error en ninguna parte.
  // A «Cartas» NO SE VA POR EL MENÚ desde la tanda 447, que la sacó de ahí
  // a propósito —el menú es Panel · Expansiones · Pokédex · Carpetas ·
  // Buscar— y dejó la PANTALLA, a la que se llega por el «Ver todas» del
  // Panel y por `?ver=cartas`. Esta prueba clicaba la pestaña que ya no
  // existe y se caía con un tiempo agotado que parece un fallo de la web.
  //
  // Y se va por el «Ver todas», no recargando con `?ver=cartas`: lo que se
  // comprueba aquí es que lo guardado entra en la lista DE LA PÁGINA, y una
  // recarga la traería de la base y daría verde pase lo que pase.
  await page.click('[data-pestania="resumen"]')
  await page.waitForTimeout(700)
  await page.click('[data-ir-a="cartas"]')
  await page.waitForTimeout(900)
  check('las nuevas salen ya en «Cartas»', (await page.locator('#mcCartas .mc-carta').count()) === 4,
    String(await page.locator('#mcCartas .mc-carta').count()))
  check('  …y lo dice', /4 cartas añadidas/.test(await page.locator('.toast, [class*="toast"]').first().textContent().catch(() => '')) ||
    (await page.locator('body').textContent()).includes('4 cartas añadidas'))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Con las versiones separadas, cada casilla es la suya ──')
{
  const { page, errores } = await abrir()
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(900)
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(400)
  // La carta 1 tiene normal y reverse: dos casillas con el MISMO id de
  // carta. Con el id a secas, marcar una marcaría las dos.
  const dos = page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="sv1-101"]')
  check('la carta de dos versiones tiene dos casillas', (await dos.count()) === 2, String(await dos.count()))
  await dos.nth(1).click()
  await page.waitForTimeout(400)
  check('marcar una versión no marca la otra', (await marcadas(page)) === 1, String(await marcadas(page)))
  const clave = await dos.nth(1).getAttribute('data-marca')
  check('  …y la clave lleva la versión', /\|/.test(clave || '') && !/\|normal$/.test(clave || ''), clave)
  await page.evaluate(() => sessionStorage.removeItem('__escrituras__'))
  await page.click('#mcMarcarGuardar')
  await page.waitForTimeout(1800)
  const nuevas = await page.evaluate(() => window.__TABLAS__.user_collection.filter((x) => x.card_id === 'sv1-101'))
  check('se guarda la versión marcada y no la normal', nuevas.length === 2 &&
    nuevas.some((x) => x.variante !== 'normal'), JSON.stringify(nuevas.map((x) => `${x.variante}:${x.cantidad}`)))
  check('  …y la normal se queda con su copia', nuevas.find((x) => x.variante === 'normal')?.cantidad === 1,
    JSON.stringify(nuevas.map((x) => `${x.variante}:${x.cantidad}`)))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Teclado y señales que no son solo color ──')
{
  const { page } = await abrir()
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(400)
  const enlace = page.locator('#mcAlbum .mc-bolsillo-enlace').nth(1)
  // `role="button"` promete la barra espaciadora, y un enlace no la tiene.
  await enlace.focus()
  await page.keyboard.press(' ')
  await page.waitForTimeout(400)
  check('la barra espaciadora marca', (await marcadas(page)) === 1, String(await marcadas(page)))
  check('  …y lo dice quien no lo ve', (await enlace.getAttribute('aria-pressed')) === 'true')
  await page.keyboard.press(' ')
  await page.waitForTimeout(300)
  check('  …y desmarca', (await marcadas(page)) === 0)
  // El color solo no vale: hay quien no lo distingue. La marca es también
  // una FORMA.
  // Y se mira PINTADO, no en el texto de la hoja: `content: ''` también
  // casa con un `/content:/`, que es la trampa de las tandas 312 y 313 —
  // al barrer texto, todo lo que CONTIENE la cadena cuenta—.
  await page.keyboard.press(' ')
  await page.waitForTimeout(400)
  const signo = await page.locator('#mcAlbum .mc-bolsillo.marcada').first().evaluate((n) => {
    const cs = getComputedStyle(n, '::after')
    return { contenido: cs.content, ancho: cs.width, fondo: cs.backgroundColor }
  })
  check('la marca lleva un signo PINTADO, no solo color',
    signo.contenido !== 'none' && signo.contenido !== '""' && signo.contenido !== "''", JSON.stringify(signo))
  check('  …y ese signo ocupa sitio', parseFloat(signo.ancho) > 8, signo.ancho)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7 bis. Si la base no deja escribir, se dice ──')
{
  // Una escritura que la política rechaza NO da error: vuelve con el
  // cuerpo vacío (CLAUDE.md, y van tres veces). Sin mirarlo, «4 cartas
  // añadidas» saldría igual y no se habría guardado nada.
  const { page } = await abrir({ antes: { __SIN_PERMISO__: ['user_collection'] } })
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(400)
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(1).click()
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(2).click()
  await page.waitForTimeout(400)
  await page.click('#mcMarcarGuardar')
  await page.waitForTimeout(1500)
  const texto = await page.locator('body').textContent()
  check('no dice que las haya añadido', !/cartas añadidas/.test(texto))
  check('  …sino que no ha podido', /No se ha podido guardar/.test(texto), texto.slice(0, 160))
  check('  …y la barra sigue puesta para reintentar', await page.locator('#mcMarcarBarra').isVisible())
  check('  …con lo marcado intacto', (await marcadas(page)) === 2, String(await marcadas(page)))
  check('  …y nada en la base', (await page.evaluate(() => window.__TABLAS__.user_collection.length)) === 1)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. En el móvil ──')
{
  const { page, errores } = await abrir({ ancho: 390, alto: 820 })
  await porElMenu(page, '#mcMarcarAbrir')
  await page.waitForTimeout(400)
  await page.locator('#mcAlbum .mc-bolsillo-enlace').nth(1).click()
  await page.waitForTimeout(300)
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('la barra no desborda', sobra <= 1, `${sobra}px`)
  // La barra de arriba del sitio es `sticky` a 0 con 70 px de alto: a 0,
  // esta se le metía por debajo y los botones quedaban cortados.
  //
  // Hay que DESPLAZAR primero. Sin bajar, la barra está donde la puso el
  // flujo normal —muy por debajo de la cabecera— y la comprobación sale
  // verde aunque el `top` sea 0: estaría mirando un sitio donde el
  // `sticky` todavía no ha entrado.
  await page.evaluate(() => window.scrollTo(0, 1200))
  await page.waitForTimeout(400)
  const caja = await page.locator('#mcMarcarBarra').boundingBox()
  const cabecera = await page.locator('nav.navbar').boundingBox()
  check('  …y sigue a la vista al bajar', caja.y >= 0 && caja.y < 300, `y=${Math.round(caja.y)}`)
  check('  …por DEBAJO de la barra del sitio', caja.y >= cabecera.y + cabecera.height - 1,
    `barra ${Math.round(caja.y)} vs cabecera ${Math.round(cabecera.y + cabecera.height)}`)
  for (const id of ['mcMarcarCancelar', 'mcMarcarGuardar']) {
    const c = await page.locator(`#${id}`).boundingBox()
    check(`  …y ${id} se puede tocar (44 px de alto)`, c.height >= 44, `${Math.round(c.width)}×${Math.round(c.height)}`)
  }
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
