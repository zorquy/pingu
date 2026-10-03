// Tanda 398 — las tres barras de un set, y una casilla por versión.
//
// PINGU, enseñando Dex: la cabecera de una expansión lleva TRES barras
// —Complete Set, Master Set y Additional— y un interruptor Stack/Split
// que abre cada carta en sus versiones.
//
// Las tres son preguntas distintas: «me falta la 47» (completo), «me
// falta el reverse de la 47» (maestro) y los secretos, que van aparte
// porque mezclarlos hace que nadie llegue nunca al 100 %.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = 'http://localhost:8892'

console.log('\n── 1. Las tres cuentas, sin navegador ──')
{
  const { progresoDeSet, barrasDeSet, porcentaje, esAdicional } =
    await import('/home/user/pingu/js/mi-coleccion/progreso-set.js')
  const cartas = [
    { id: 'a', local_id: '1', variants: { normal: true, reverse: true } },
    { id: 'b', local_id: '2', variants: { normal: true, reverse: true } },
    { id: 'c', local_id: '166', variants: { holo: true } },
  ]
  const mio = { 'a|normal': 1, 'a|reverse': 1, 'b|normal': 2 }
  const tengo = (id, v) =>
    v ? mio[`${id}|${v}`] || 0 : Object.keys(mio).filter((k) => k.startsWith(`${id}|`)).reduce((s, k) => s + mio[k], 0)
  const p = progresoDeSet({ cartas, set: { card_count_official: 165 }, tengo })

  check('el completo cuenta cartas, no versiones', p.completo.tengo === 2 && p.completo.total === 2,
    JSON.stringify(p.completo))
  check('el maestro cuenta cada versión', p.maestro.tengo === 3 && p.maestro.total === 5,
    JSON.stringify(p.maestro))
  check('los secretos van aparte', p.adicional.total === 1, JSON.stringify(p.adicional))

  // Solo es adicional lo que pasa del recuento Y es un número: las promos
  // llevan «XY122» y ahí no se puede decir si va antes o después.
  check('una promo no se cuenta como secreta',
    esAdicional({ local_id: 'XY122' }, 165) === false)
  check('  …y sin recuento oficial, nada es secreto',
    esAdicional({ local_id: '200' }, 0) === false)

  // Sin total no es un cero, es que no se sabe (regla de la 319).
  check('sin total, el porcentaje no se inventa', porcentaje({ tengo: 0, total: 0 }) === null)
  // Y la barra que no tiene nada que contar no se pinta: la mayoría de
  // los sets viejos no tienen secretos.
  check('un set sin secretos no enseña esa barra',
    barrasDeSet(progresoDeSet({ cartas: cartas.slice(0, 2), set: { card_count_official: 165 }, tengo }))
      .every((b) => b.id !== 'adicional'))
}

console.log('\n── 2. En la pantalla ──')
const browser = await chromium.launch()
const abrir = async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    try { localStorage.removeItem('mc-split') } catch {}
    window.__FAKE_SETS__ = [{ id: 'sv1', name: '151', market: 'WEST',
      card_count_official: 2, card_count_total: 3, release_date: '2023-09-22' }]
    window.__FAKE_CARTAS__ = [1, 2, 3].map((n) => ({
      id: `sv1-${n}`, set_id: 'sv1', local_id: String(n), name: `C${n}`,
      image_path: `x/${n}`, market: 'WEST', variants: { normal: true, reverse: true },
    }))
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-1', cantidad: 1, idioma: 'es', estado: 'nueva', variante: 'normal' }]
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1600)
  return { page, errores }
}
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const barras = (await page.locator('#mcAlbumProgreso').textContent())?.replace(/\s+/g, ' ').trim() || ''
  // El set tiene 2 oficiales y 3 cartas: la tercera es secreta, y cada
  // carta tiene dos versiones.
  check('el completo deja fuera la secreta', /Conjunto completo 1 de 2/.test(barras), barras)
  check('el maestro cuenta las seis versiones', /Set maestro 1 de 6/.test(barras), barras)
  check('y la secreta tiene su barra', /Adicionales 0 de 1/.test(barras), barras)

  // `album.set` es el ID y no el set: buscar el recuento oficial es lo
  // que hace que esto funcione, y sin ello el completo se comía el set
  // entero (1 de 3) y la barra de secretos no salía.
  check('  …o sea que el recuento oficial LLEGA', !/Set completo 1 de 3/.test(barras), barras)

  console.log('  · una por versión')
  // El rótulo de la versión se llama `.mc-chapa-variante` desde la 461 y
  // va ENCIMA de la carta. Antes era `.mc-bolsillo-variante` y se pintaba
  // en el flujo normal, debajo del enlace que cubre el bolsillo entero: o
  // sea que esta prueba llevaba desde la 398 contando rótulos que **nunca
  // se vieron**. Contar que un elemento existe no es verlo.
  const pies = () => page.locator('.mc-album-rejilla .mc-chapa-variante').count()
  check('de entrada no hay pies de versión', (await pies()) === 0)
  await page.locator('#mcVistaVariantes').click()
  await page.waitForTimeout(1200)
  check('al partir, cada versión tiene su casilla', (await pies()) === 6, `${await pies()}`)
  check('  …y cada una dice cuál es',
    /Normal|Reverse/.test((await page.locator('.mc-album-rejilla .mc-chapa-variante').first().textContent()) || ''))
  // Para quien no ve el color del chip activo.
  check('  …y el interruptor lo dice sin color',
    // Desde la tanda 473 es UN botón con `aria-pressed`, no dos chapas en
    // un grupo: una de las dos estaba siempre de adorno.
    (await page.locator('#mcVistaVariantes').getAttribute('aria-pressed')) === 'true')

  // El «+» de una casilla partida suma a SU versión, no a la normal: si
  // no, las cuatro casillas de una carta harían lo mismo.
  const marcada = page.locator('.mc-bolsillo').filter({ hasText: 'Reverse' }).first()
  const mas = marcada.locator('button[data-anadir]')
  check('el + de una versión dice a cuál suma',
    (await mas.getAttribute('data-var')) === 'reverse', await mas.getAttribute('data-var'))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
