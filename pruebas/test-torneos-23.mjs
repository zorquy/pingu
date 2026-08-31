import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 230: las chapas de arquetipo en la ficha del torneo.
//
// Lo que de verdad se prueba aquí NO es que salgan, es CUÁNDO NO SALEN.
// La chapa se deduce de la decklist, así que enseñarla a mitad de un
// torneo de lista cerrada es contarle a alguien a qué juega su rival.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const MAZO = {
  pokemon: [
    { quantity: 3, name: 'Dragapult ex', set: 'TWM', number: '130' },
    { quantity: 4, name: 'Dreepy', set: 'TWM', number: '128' },
    { quantity: 2, name: 'Dusknoir', set: 'SFA', number: '20' },
  ],
  trainer: [],
  energy: [],
}
const OTRO = {
  pokemon: [
    { quantity: 3, name: 'Gardevoir ex', set: 'SVI', number: '86' },
    { quantity: 4, name: 'Ralts', set: 'SVI', number: '84' },
  ],
  trainer: [],
  energy: [],
}

const INSCRIPCIONES = [
  { id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'Ash' },
  { id: 'ins-2', tournament_id: 'torneo-1', user_id: 'user-2', status: 'active', tcg_live_username: 'Misty' },
]
const RONDAS = [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'finished' }]
const MESAS = [
  { id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' },
]
const RESULTADOS = [{ id: 'res-1', match_id: 'mesa-1', result: 'a_wins', winner_id: 'user-1' }]
const DECKLISTS = [
  { id: 'dk-1', tournament_id: 'torneo-1', user_id: 'user-1', parsed_cards: MAZO },
  { id: 'dk-2', tournament_id: 'torneo-1', user_id: 'user-2', parsed_cards: OTRO },
]

// ¿Se VE el nombre de las chapas? Se mira el estilo calculado y no el
// innerText: innerText devuelve el texto aunque el span esté oculto, y
// con él la comprobación pasaba en los dos casos — o sea, no probaba
// nada. Se aprendió rompiendo el arreglo a propósito y viendo que la
// prueba seguía en verde.
// La clasificación vive en su pestaña, y hasta que se abre el panel está
// oculto. Eso importa más de lo que parece: los iconos van con
// `loading="lazy"`, y una imagen perezosa dentro de algo oculto NO se
// pide — así que tampoco falla, y el respaldo de «si no carga, enseña el
// nombre» no se puede probar sin abrir la pestaña primero.
const abrirClasificacion = async (page) => {
  await page.click('[data-pestana="clasificacion"]').catch(() => {})
  await page.waitForTimeout(400)
}

const nombreSeVe = (page) =>
  page.evaluate(() => {
    const spans = [...document.querySelectorAll('#clasificacionContenido .torneo-arquetipo-nombre')]
    return spans.length > 0 && spans.every((s) => getComputedStyle(s).display !== 'none')
  })

// Un PNG de 1×1 transparente. Los sprites vienen de una CDN de fuera y
// esto se ejecuta sin internet, así que se sirven desde aquí: la prueba
// no puede depender de que jsDelivr esté en pie ni de tener red. La
// prueba 7 hace lo contrario a propósito (los corta) para comprobar el
// respaldo.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const abrir = async (semillas) => {
  const page = await browser.newPage()
  await page.route('**/cdn.jsdelivr.net/**', (r) =>
    r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 })
  )
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = s.sesion
    window.__FAKE_TORNEOS__ = s.torneos
    window.__FAKE_INSCRIPCIONES__ = s.inscripciones
    window.__FAKE_RONDAS__ = s.rondas
    window.__FAKE_MESAS__ = s.mesas
    window.__FAKE_RESULTADOS__ = s.resultados
    window.__FAKE_DECKLISTS__ = s.decklists
    if (s.arquetipos) window.__FAKE_ARQUETIPOS__ = s.arquetipos
  }, semillas)
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}

const TORNEO = {
  id: 'torneo-1', slug: 'copa', name: 'Copa', admin_id: 'admin-1',
  max_players: 8, swiss_rounds: 3,
}
const BASE_SEMILLA = {
  sesion: 'user-1', inscripciones: INSCRIPCIONES, rondas: RONDAS, mesas: MESAS,
  resultados: RESULTADOS, decklists: DECKLISTS,
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Torneo TERMINADO: las chapas salen ──')
{
  const { page, errores } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'finished', show_opponent_decklists: false }],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const chapas = await page.locator('#clasificacionContenido .torneo-arquetipo').count()
  check('hay una chapa por jugador', chapas === 2, String(chapas))
  const etiquetas = await page.locator('#clasificacionContenido .torneo-arquetipo').evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label'))
  )
  // Sin catálogo se deduce, y NO puede llamarse por los básicos.
  check('deduce el mazo bien', etiquetas.some((e) => /Dragapult ex/.test(e || '')), JSON.stringify(etiquetas))
  check('sin nombrarlo por los básicos', !etiquetas.some((e) => /Dreepy|Ralts/.test(e || '')), JSON.stringify(etiquetas))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. EN JUEGO con lista CERRADA: no sale ninguna ──')
{
  const { page } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'in_progress', show_opponent_decklists: false }],
  })
  const chapas = await page.locator('.torneo-arquetipo').count()
  check('ni una chapa en toda la página', chapas === 0, String(chapas))
  const cuerpo = await page.locator('body').innerText()
  check('ni el nombre de ningún mazo suelto', !/Dragapult|Gardevoir/.test(cuerpo))
  check('ni el botón de ver la lista del rival', (await page.locator('[data-ver-lista]').count()) === 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. EN JUEGO con lista ABIERTA: sí salen ──')
{
  const { page } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'in_progress', show_opponent_decklists: true }],
  })
  check('vuelven las chapas', (await page.locator('#clasificacionContenido .torneo-arquetipo').count()) === 2)
  check('y el botón de ver la lista', (await page.locator('[data-ver-lista]').count()) > 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Con el catálogo puesto, manda el nombre curado ──')
{
  const { page } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'finished', show_opponent_decklists: false }],
    arquetipos: [
      {
        id: 'dragapult-dusknoir', nombre: 'Dragapult Dusknoir', activo: true,
        iconos: [{ set: 'TWM', numero: '130' }, { set: 'SFA', numero: '20' }],
        requiere: [{ nombres: ['Dragapult ex'] }, { nombres: ['Dusknoir'] }],
      },
    ],
  })
  const etiquetas = await page.locator('#clasificacionContenido .torneo-arquetipo').evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label'))
  )
  check('sale el nombre del catálogo', etiquetas.includes('Dragapult Dusknoir'), JSON.stringify(etiquetas))
  // Y el que no casa sigue deducido, no desaparece.
  check('el que no casa sigue saliendo', etiquetas.some((e) => /Gardevoir/.test(e || '')), JSON.stringify(etiquetas))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Sin cuenta, en un torneo terminado ──')
{
  // El escaparate de la 229: un visitante ve la clasificación de un
  // torneo acabado, y con ella los arquetipos. Nada que esconder ya.
  const { page, errores } = await abrir({
    ...BASE_SEMILLA,
    sesion: 'none',
    torneos: [{ ...TORNEO, status: 'finished', show_opponent_decklists: false }],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('el visitante también las ve', (await page.locator('#clasificacionContenido .torneo-arquetipo').count()) === 2)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Los iconos son MINISPRITES (tanda 231) ──')
{
  const { page } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'finished', show_opponent_decklists: false }],
  })
  // Se espera a que las imágenes se metan: se resuelven después de
  // pintar la tabla, en un segundo paso.
  await abrirClasificacion(page)
  await page.waitForSelector('.torneo-arquetipo-icono', { timeout: 5000 }).catch(() => {})
  const iconos = await page.locator('.torneo-arquetipo-icono').evaluateAll((els) =>
    els.map((e) => ({ src: e.getAttribute('src'), clases: e.className }))
  )
  check('hay iconos pintados', iconos.length >= 2, String(iconos.length))
  check('son sprites de Pokémon, no cartas',
    iconos.every((i) => /PokeAPI\/sprites/.test(i.src || '')),
    JSON.stringify(iconos.map((i) => i.src)))
  check('con su clase de sprite', iconos.every((i) => /es-sprite/.test(i.clases || '')), JSON.stringify(iconos.map((i) => i.clases)))
  // Dragapult es el 887 y Gardevoir el 282: si la tabla se desplazara,
  // saldría el Pokémon de al lado y no lo notaría nadie mirando.
  check('Dragapult es el 887', iconos.some((i) => /\/887\.png$/.test(i.src || '')), JSON.stringify(iconos.map((i) => i.src)))
  check('Gardevoir es el 282', iconos.some((i) => /\/282\.png$/.test(i.src || '')), JSON.stringify(iconos.map((i) => i.src)))
  // Y con los iconos puestos el nombre se esconde: esa es la gracia de
  // la chapa. Sigue en el aria-label para quien no reconozca el sprite.
  check('con iconos, el nombre se esconde', (await nombreSeVe(page)) === false)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Si la CDN de sprites falla, vuelve el nombre ──')
{
  // No es un caso raro: las imágenes vienen de fuera, y de fuera se cae
  // todo tarde o temprano. Aquí se cortan a propósito.
  const page = await browser.newPage()
  await page.route('**/cdn.jsdelivr.net/**', (r) => r.abort())
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [{ ...s.t, status: 'finished', show_opponent_decklists: false }]
    window.__FAKE_INSCRIPCIONES__ = s.ins
    window.__FAKE_RONDAS__ = s.rondas
    window.__FAKE_MESAS__ = s.mesas
    window.__FAKE_RESULTADOS__ = s.res
    window.__FAKE_DECKLISTS__ = s.dk
  }, { t: TORNEO, ins: INSCRIPCIONES, rondas: RONDAS, mesas: MESAS, res: RESULTADOS, dk: DECKLISTS })
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  await abrirClasificacion(page)

  // Se ESPERA al resultado en vez de fotografiar un instante: la ficha
  // se repinta sola cada pocos segundos y vuelve a intentar cargar los
  // iconos, así que siempre hay alguno recién puesto que aún no ha
  // fallado.
  const volvioElNombre = await page
    .waitForFunction(
      () => {
        const spans = [...document.querySelectorAll('#clasificacionContenido .torneo-arquetipo-nombre')]
        return spans.length > 0 && spans.every((s) => getComputedStyle(s).display !== 'none')
      },
      { timeout: 8000 }
    )
    .then(() => true)
    .catch(() => false)
  check('con la CDN caída, vuelve a VERSE el nombre', volvioElNombre)
  const etiquetas = await page.locator('#clasificacionContenido .torneo-arquetipo').evaluateAll((els) =>
    els.map((e) => e.innerText.trim())
  )
  check('y vuelve a verse el nombre del mazo',
    etiquetas.some((t) => /Dragapult/.test(t)),
    JSON.stringify(etiquetas))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
