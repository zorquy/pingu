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
    cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal',
    // Repartidas en TRES meses a propósito, y la más vieja en MARZO. Con
    // todas en el mismo mes —como estaban— «la más vieja» y «la más
    // nueva» dan el mismo texto, así que la afirmación de abajo no
    // probaba nada: es la trampa de un fixture que no distingue las dos
    // ramas.
    created_at: `2026-${['03', '08', '11'][i % 3]}-1${i % 9}T00:00:00Z` }))
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
  // `count()` cuenta también lo escondido: lo que se pide aquí es que SE
  // VEA, que es distinto. Lo cazó el rigor poniéndole `hidden` al h1.
  check('el h1 vive dentro de la cabecera y se ve',
    await page.locator('.mc-hero h1#mcTitulo').isVisible())
  check('  …y las cifras también', await page.locator('.mc-hero #mcResumen').isVisible())
  // El avatar lleva la inicial cuando no hay foto. Sin ella es un círculo
  // de color y nada más, y no hay ningún otro sitio donde se vea de quién
  // es esta pantalla.
  check('  …y el avatar lleva su inicial',
    ((await page.locator('#mcHeroAvatar').textContent()) || '').trim().length === 1,
    await page.locator('#mcHeroAvatar').textContent())
  check('dice desde cuándo coleccionas',
    /Coleccionando desde/.test(await page.locator('#mcHeroDesde').textContent()),
    await page.locator('#mcHeroDesde').textContent())
  // La fecha sale de TU LÍNEA MÁS ANTIGUA, no de la más nueva ni de
  // cuándo te registraste. Con las líneas repartidas en marzo, agosto y
  // noviembre, cada criterio da un mes distinto.
  const desde = await page.locator('#mcHeroDesde').textContent()
  check('  …y es la de tu carta más vieja', /marzo de 2026/.test(desde), desde)
  check('  …y no la más nueva', !/noviembre/.test(desde), desde)
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
  // Y CABEN DE VERDAD, que es lo que la fila sola no dice: con el recuadro
  // puesto, la columna sigue siendo una cuarta parte del ancho pero el
  // relleno se come 40 px de ella y el número se sale de su hueco. El
  // rigor lo cazó devolviéndole la caja: «una fila» seguía siendo cierto.
  const dentro = await page.locator('#mcResumen .mc-cifra').evaluateAll((ns) => ns.map((x) => ({
    nombre: x.querySelector('dt').textContent,
    sobra: Math.max(x.scrollWidth - x.clientWidth, x.querySelector('dd').scrollWidth - x.clientWidth),
  })))
  check('  …y cada cifra cabe dentro de su hueco',
    dentro.every((d) => d.sobra <= 1), JSON.stringify(dentro))
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
  // Y con el sitio de una pantalla ancha, la rejilla REPARTE: varias
  // tarjetas por fila. Una sola columna de 300 px es el carrusel otra vez,
  // solo que sin poder deslizarlo — y «es una rejilla» seguía siendo
  // cierto, que es lo que cazó el rigor.
  const reparto = await page.locator('.mc-diapos').evaluate((g) => {
    const hijos = [...g.children]
    return { tarjetas: hijos.length, filas: new Set(hijos.map((n) => Math.round(n.getBoundingClientRect().top))).size,
      anchoRejilla: Math.round(g.getBoundingClientRect().width),
      anchoTarjeta: hijos[0] ? Math.round(hijos[0].getBoundingClientRect().width) : 0 }
  })
  check('  …y en una pantalla ancha reparte varias por fila',
    reparto.tarjetas > 1 && reparto.filas < reparto.tarjetas, JSON.stringify(reparto))
  check('  …aprovechando el ancho que hay',
    reparto.anchoTarjeta * reparto.tarjetas >= reparto.anchoRejilla * 0.8, JSON.stringify(reparto))
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
