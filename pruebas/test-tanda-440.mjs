// Tanda 440 — el rediseño de /mi-coleccion: cabecera de perfil, fuera el
// carrusel, y «dónde estás cerca».
//
// PINGU: «quiero algo mucho mejor pensado, cosas quizá sobran; me gusta
// mucho la app Dex y creo que lo tienen perfecto y muy moderno».
//
// Nada de esto da error al romperse. Una cabecera que vuelve a partirse en
// dos filas, un bloque accionable que se cuela debajo de todo o un orden
// por porcentaje en vez de por cartas se ven perfectamente bien.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const browser = await chromium.launch()

// CINCO colecciones elegidas para que ordenar por CARTAS y ordenar por
// PORCENTAJE den resultados DISTINTOS. Es lo que decide esta tanda y, con
// un fixture descuidado, las dos reglas dan lo mismo y la prueba no prueba
// nada (la trampa de siempre):
//
//   pequeno   8 de 10  →  80 %  ·  faltan 2
//   casi     96 de 100 →  96 %  ·  faltan 4
//   medio     8 de 20  →  40 %  ·  faltan 12
//   grande    5 de 191 → 2,6 %  ·  faltan 186
//   completo  3 de 3   → 100 %  ·  faltan 0  (no sale)
//
// Por porcentaje mandaría «casi»; por cartas manda «pequeno». Si alguien
// cambia el criterio, el primer nombre cambia.
const semilla = () => {
  window.__FAKE_SETS__ = [
    { id: 'pequeno', name: 'Promo Pequeña', serie_id: 'sv', serie_name: 'EP', market: 'WEST',
      logo_path: 'sv/pequeno/logo', card_count_official: 10, card_count_total: 10, release_date: '2024-02-01' },
    { id: 'medio', name: 'Set Mediano', serie_id: 'sv', serie_name: 'EP', market: 'WEST',
      logo_path: 'sv/medio/logo', card_count_official: 20, card_count_total: 20, release_date: '2024-05-01' },
    { id: 'grande', name: 'Surging Sparks', serie_id: 'sv', serie_name: 'EP', market: 'WEST',
      logo_path: 'sv/grande/logo', card_count_official: 191, card_count_total: 191, release_date: '2024-11-08' },
    { id: 'casi', name: 'Casi Entera', serie_id: 'sv', serie_name: 'EP', market: 'WEST',
      logo_path: 'sv/casi/logo', card_count_official: 100, card_count_total: 100, release_date: '2024-07-01' },
    { id: 'completo', name: 'Ya Completa', serie_id: 'sv', serie_name: 'EP', market: 'WEST',
      logo_path: 'sv/completo/logo', card_count_official: 3, card_count_total: 3, release_date: '2024-01-01' },
  ]
  const hacer = (set, n) => [...Array(n)].map((_, i) => ({ id: `${set}-${i + 1}`, market: 'WEST', set_id: set,
    local_id: String(i + 1), name: `${set} ${i + 1}`, name_es: `${set} ${i + 1}`, image_path: `sv/${set}/${i + 1}`,
    rarity: 'Rare', category: 'Pokemon', dex_ids: [25], variants: { normal: true } }))
  window.__FAKE_CARTAS__ = [...hacer('pequeno', 8), ...hacer('casi', 96), ...hacer('medio', 8), ...hacer('grande', 5), ...hacer('completo', 3)]
  window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST',
    cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-09-01T00:00:0${i % 10}Z` }))
}
const abrir = async (ancho = 1280) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La cabecera de perfil ──')
{
  const { page, errores } = await abrir()
  check('el h1 vive dentro de la cabecera',
    await page.locator('.mc-hero h1#mcTitulo').count() === 1)
  check('  …y las cifras también', await page.locator('.mc-hero #mcResumen').count() === 1)
  check('dice desde cuándo coleccionas',
    /Coleccionando desde/.test(await page.locator('#mcHeroDesde').textContent()),
    await page.locator('#mcHeroDesde').textContent())
  // La fecha sale de TU LÍNEA MÁS ANTIGUA y no de cuándo te registraste.
  check('  …y es la de tu carta más vieja, no la de hoy',
    /septiembre de 2026/.test(await page.locator('#mcHeroDesde').textContent()),
    await page.locator('#mcHeroDesde').textContent())
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // ESTO es lo que justifica la cabecera entera: cuatro cifras sin
  // recuadro CABEN en 390 px. Con caja no cabían, y de ahí salieron la
  // tira que se desliza de la 412 y el disimulo de la 439.
  const { page } = await abrir(390)
  const r = await page.locator('#mcResumen').evaluate((n) => ({
    filas: new Set([...n.children].map((e) => Math.round(e.getBoundingClientRect().top))).size,
    sobra: n.scrollWidth > n.clientWidth + 4,
  }))
  check('en 390 px las cuatro cifras caben en una fila', r.filas === 1, JSON.stringify(r))
  check('  …y sin deslizarse', !r.sobra, JSON.stringify(r))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Fuera el carrusel, y las listas de números al final ──')
{
  const { page } = await abrir()
  check('el resumen ya no es una tira que se desliza',
    (await page.locator('#mcTira').count()) === 0)
  check('  …sino una rejilla', (await page.locator('.mc-diapos').count()) === 1)
  // Y están PLEGADAS: lo que se ve al entrar es tu colección, no listas de
  // rarezas. Si el bloque sale abierto, el panel vuelve a ser larguísimo
  // y nada da error.
  check('las estadísticas nacen plegadas', await page.locator('#mcEstadisticas').isHidden())
  check('  …y la rejilla de números está DENTRO del plegado',
    await page.locator('#mcEstadisticas .mc-diapos').count() === 1)
  check('  …y las cajas de listas también',
    await page.locator('#mcEstadisticas .mc-resumen-rejilla').count() === 1)
  await page.locator('#mcVerTodo').click()
  await page.waitForTimeout(400)
  check('y el botón las abre', await page.locator('#mcEstadisticas').isVisible())
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
// AQUÍ VIVÍA el bloque 3, «Dónde estás cerca», que duró de la tanda 440 a
// la 441. PINGU, al verlo puesto: «no tiene sentido porque abajo ya están
// las expansiones». Es el mismo argumento con el que la 439 quitó las dos
// diapositivas repetidas, así que fuera.

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
