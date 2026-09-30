// Tanda 371 — el archivador con cara de archivador.
//
// PINGU, enseñando HoloNook: «en general mejora visualmente todo».
// Lo que se trae de allí: tapa de color, lomo con anillas, cabecera por
// página y las que faltan como grabadas en la funda en vez de en gris
// plano. Lo que NO se trae es su piel pastel: PokeDoc tiene su escala de
// color y calcarla la rompería.
//
// Y lo de debajo, que es lo que evita que esto se pudra: el archivador
// estaba escrito DOS VECES —el álbum de una colección y los soñados—,
// cada uno con su copia del «9 por página». Ya habían empezado a
// separarse, y de eso se quejó PINGU en la 369 («en álbumes está
// perfecto, pero en álbumes soñados debería ser igual»). Ahora lo monta
// un módulo compartido.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = 'http://localhost:8892'

console.log('\n── 1. El archivador se monta en UN sitio ──')
{
  const uno = leer('js/mi-coleccion.js')
  const dos = leer('js/mi-coleccion/albumes.js')
  // El «9 por página» estaba en los dos ficheros. Dos constantes iguales
  // en dos sitios se separan y no dan error (la lección de la 322).
  check('el 9 por página ya no está escrito dos veces',
    !/const POR_PAGINA = 9/.test(uno) && !/const POR_PAGINA = 9/.test(dos))
  check('los dos usan el archivador compartido',
    /archivador\.js'/.test(uno) && /archivador\.js'/.test(dos))
  // Y lo que NO se comparte: cómo se pinta un bolsillo, que sí es
  // distinto en cada uno (uno lleva −/+, el otro las flechas de
  // ordenar). Se pasa como función.
  const mod = leer('js/mi-coleccion/archivador.js')
  check('  …y el bolsillo se sigue pintando en cada uno', /pintarBolsillo/.test(mod))
  check('  …sin que el módulo sepa de DOM', !/document\./.test(mod) && !/getElementById/.test(mod))
}

console.log('\n── 2. La cabecera dice el rango DE ESA HOJA ──')
{
  // No se calcula: con «solo las que me faltan» puesto los números no
  // son seguidos, y un `001 – 009` deducido de la página mentiría.
  const { archivadorHtml } = await import('/home/user/pingu/js/mi-coleccion/archivador.js')
  const salteadas = [1, 4, 9, 15, 22].map((n) => ({ id: `x${n}`, local_id: String(n).padStart(3, '0') }))
  const { html } = archivadorHtml({
    lista: salteadas,
    deUnaVez: 1,
    pintarBolsillo: () => '<span class="mc-bolsillo"></span>',
  })
  check('el rango es el primero y el último de la hoja', html.includes('001 – 022'),
    (html.match(/<span>[^<]*–[^<]*<\/span>/) || [])[0])
  // Una hoja con una sola carta no dice «003 – 003».
  const sola = archivadorHtml({ lista: [{ id: 'a', local_id: '003' }], deUnaVez: 1, pintarBolsillo: () => '' })
  check('  …y con una sola carta no se repite', sola.html.includes('<span>003</span>') && !sola.html.includes('003 – 003'))

  // Y la página se corrige al pliego: un archivador se abre por pares.
  const pares = archivadorHtml({
    lista: Array.from({ length: 40 }, (_, i) => ({ id: `c${i}`, local_id: String(i + 1) })),
    pagina: 3,
    deUnaVez: 2,
    pintarBolsillo: () => '',
  })
  check('la página impar cae en su pliego', pares.pagina === 2, String(pares.pagina))
  check('  …y salen las dos hojas', (pares.html.match(/class="mc-hoja"/g) || []).length === 2)
  check('  …con sus anillas', pares.html.includes('mc-anillas'))
  // En el móvil se pasa hoja a hoja: ahí no hay lomo que pintar.
  const movil = archivadorHtml({ lista: [{ id: 'a', local_id: '1' }], deUnaVez: 1, pintarBolsillo: () => '' })
  check('con una hoja a la vez no hay anillas', !movil.html.includes('mc-anillas'))
}

console.log('\n── 3. El color de la tapa ──')
{
  const { TAPAS, tapaGuardada, guardarTapa, TAPA_POR_DEFECTO } = await import('/home/user/pingu/js/mi-coleccion/archivador.js')
  check('hay ocho tapas', TAPAS.length === 8, String(TAPAS.length))
  // Sin `localStorage` (Node, ventana privada, almacenamiento cortado)
  // no puede reventar: que no se recuerde el color no puede dejar sin
  // álbum a nadie.
  check('sin almacenamiento, el color por defecto', tapaGuardada() === TAPA_POR_DEFECTO)
  check('  …y guardar tampoco revienta', (() => { try { guardarTapa('rojo'); return true } catch { return false } })())
  // Un color que no existe no se guarda: si no, un `data-tapa` inventado
  // deja el archivador sin fondo y no da error.
  check('un color inventado no se cuela', (() => { guardarTapa('fucsia'); return tapaGuardada() !== 'fucsia' })())

  // Los ocho tienen su regla en el CSS. Sin ella, `--tapa` se queda en el
  // valor por defecto y elegir color no haría nada.
  const css = leer('css/mi-coleccion.css')
  const sinRegla = TAPAS.filter((t) => !new RegExp(`\\.mc-binder\\[data-tapa='${t.id}'\\]`).test(css))
  check('los ocho tienen color en el CSS', sinRegla.length === 0, sinRegla.map((t) => t.id).join(', '))
  const sinBoton = TAPAS.filter((t) => !new RegExp(`\\.mc-tapa\\[data-tapa='${t.id}'\\]`).test(css))
  check('  …y su botón', sinBoton.length === 0, sinBoton.map((t) => t.id).join(', '))
}

const browser = await chromium.launch()
const CARTA = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" rx="12" fill="#f7d354"/><text x="122" y="180" font-size="44" text-anchor="middle" fill="#8a6a20">${n}</text></svg>`

async function abrir(opciones = {}) {
  const page = await browser.newPage({ viewport: opciones.viewport || { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => {
    const m = String(r.request().url()).match(/(\d+)\/low/)
    r.fulfill({ contentType: 'image/svg+xml', body: CARTA(m ? m[1] : '1') })
  })
  await page.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', card_count_total: 40, release_date: '2023-03-31', tcg_online_code: 'SVI' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 40 }, (_, i) => ({
      id: `sv1-${i + 1}`, set_id: 'sv1', local_id: String(i + 1).padStart(3, '0'),
      name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv01/${i + 1}`, market: 'WEST',
    }))
    window.__FAKE_COLECCION__ = [1, 5, 11].map((n, i) => ({ id: `c${i}`, card_id: `sv1-${n}`, cantidad: 1 }))
  })
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.locator('[data-pestania="album"]').click()
  await page.waitForTimeout(1600)
  return { page, errores }
}

console.log('\n── 4. En pantalla, y cambiando de color ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el archivador tiene tapa', (await page.locator('.mc-binder').count()) === 1)
  check('  …con lomo de tres anillas', (await page.locator('.mc-anillas i').count()) === 3,
    String(await page.locator('.mc-anillas i').count()))
  check('  …y cada hoja su cabecera', (await page.locator('.mc-hoja-cabecera').count()) === 2)
  check('  …que dice la página y el rango',
    /PÁGINA 1|Página 1/i.test((await page.locator('.mc-hoja-cabecera').first().textContent()) || '') &&
      /001/.test((await page.locator('.mc-hoja-cabecera').first().textContent()) || ''),
    await page.locator('.mc-hoja-cabecera').first().textContent())

  // La tapa se ve DE VERDAD: no vale que el atributo cambie si el color
  // pintado es el mismo. Es la lección de la 313 (comprobar el efecto,
  // no la llamada).
  const color = () => page.locator('.mc-binder').evaluate((e) => getComputedStyle(e).backgroundColor)
  const antes = await color()
  await page.locator('#mcAlbumTapa').click()
  await page.waitForTimeout(400)
  check('el selector de color sale', (await page.locator('.mc-tapa').count()) === 8,
    String(await page.locator('.mc-tapa').count()))
  await page.locator('.mc-tapa[data-tapa="rojo"]').click()
  await page.waitForTimeout(700)
  check('  …y el archivador cambia de color', (await color()) !== antes, `${antes} → ${await color()}`)
  check('  …y queda marcado cuál es', (await page.locator('.mc-tapa[data-tapa="rojo"]').getAttribute('aria-pressed')) === 'true')

  // Y se recuerda al volver.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  await page.locator('[data-pestania="album"]').click()
  await page.waitForTimeout(1600)
  check('el color se recuerda', (await page.locator('.mc-binder').getAttribute('data-tapa')) === 'rojo',
    await page.locator('.mc-binder').getAttribute('data-tapa'))
  await page.close()
}

console.log('\n── 5. El «Ir a…» ──')
{
  const { page } = await abrir()
  const salto = page.locator('#mcAlbumSalto')
  check('sale con varios pliegos', await salto.isVisible())
  // 40 cartas = 5 hojas = 3 pliegos (1-2, 3-4, 5).
  check('  …una opción por pliego', (await salto.locator('option').count()) === 3,
    String(await salto.locator('option').count()))
  await salto.selectOption('2')
  await page.waitForTimeout(700)
  check('  …y salta de verdad', /3/.test((await page.locator('#mcAlbumPaginas').textContent()) || ''),
    await page.locator('#mcAlbumPaginas').textContent())
  await page.close()
}

console.log('\n── 6. Las que faltan se distinguen de las que tienes ──')
{
  // Antes iban en gris al 30 %: parecía una foto mal cargada. Lo que
  // importa no es el filtro exacto sino que se DISTINGAN — se mide la
  // opacidad calculada de una y de otra.
  const { page } = await abrir()
  const opacidad = (sel) => page.locator(sel).first().evaluate((e) => Number(getComputedStyle(e).opacity))
  const tengo = await opacidad('.mc-bolsillo.tengo img')
  const falta = await opacidad('.mc-bolsillo:not(.tengo) img')
  check('la que tienes se ve entera', tengo === 1, String(tengo))
  check('  …y la que falta, apagada', falta < 0.8 && falta > 0.2, String(falta))
  // Pero no invisible: el dibujo tiene que reconocerse para saber qué
  // buscas.
  const filtro = await page.locator('.mc-bolsillo:not(.tengo) img').first().evaluate((e) => getComputedStyle(e).filter)
  check('  …sin quitarle TODO el color', !/grayscale\(1\)/.test(filtro), filtro)
  await page.close()
}

console.log('\n── 7. En el móvil, una hoja y sin lomo ──')
{
  const { page, errores } = await abrir({ viewport: { width: 390, height: 900 } })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('una hoja a la vez', (await page.locator('.mc-hoja:not(.mc-hoja-fantasma)').count()) === 1)
  // Sin dos hojas no hay lomo que pintar: unas anillas al borde de la
  // pantalla serían un adorno encima del contenido.
  check('  …y sin anillas', (await page.locator('.mc-anillas').count()) === 0)
  check('  …pero con tapa igual', (await page.locator('.mc-binder').count()) === 1)
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
