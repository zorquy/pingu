import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 255: terminar la apertura de torneos.
//
//  1. La PORTADA no decía ni una palabra de la sección más grande de la
//     web. Ahora enseña el próximo torneo con inscripciones abiertas.
//  2. El SONDEO de la ficha pedía en cada refresco cosas de jueces y de
//     jugadores para todo el que mirase. Con la sección pública eso son
//     decenas de espectadores preguntando cada diez segundos por algo
//     que no van a ver.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const enHoras = (h) => new Date(Date.now() + h * 3600e3).toISOString()

// «Mañana a mediodía», calculado sobre el calendario y NO como «dentro
// de 30 horas»: con esto último la prueba dependía de la hora a la que
// se corriera —a las 00:15, treinta horas caen en PASADO mañana— y
// fallaba de madrugada diciendo «El domingo» donde esperaba «Mañana».
const manana = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(12, 0, 0, 0)
  return d.toISOString()
}
const torneo = (extra = {}) => ({
  id: 't1', slug: 'copa', name: 'Copa Inaugural PokeDoc', admin_id: 'admin-1',
  status: 'registration_open', max_players: 16, swiss_rounds: 3, start_at: manana(), ...extra,
})

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La portada enseña el próximo torneo ──')
{
  const { page, errores } = await abrir('/', {
    __FAKE_SESSION__: 'admin-1',
    __FAKE_TORNEOS__: [torneo()],
    // Uno dentro y dos que se fueron: los que se fueron NO ocupan plaza,
    // así que de 16 tienen que quedar 15, no 13.
    __FAKE_INSCRIPCIONES__: [
      { id: 'i1', tournament_id: 't1', user_id: 'user-1', status: 'active' },
      { id: 'i2', tournament_id: 't1', user_id: 'user-2', status: 'dropped' },
      { id: 'i3', tournament_id: 't1', user_id: 'user-3', status: 'withdrawn' },
    ],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('sale la tarjeta', (await page.locator('#torneoPortada .reto-tarjeta').count()) === 1)
  const texto = await page.locator('#torneoPortada').innerText()
  check('con el nombre del torneo', /Copa Inaugural PokeDoc/.test(texto), texto.replace(/\n/g, ' | '))
  check('y cuándo se juega', /Mañana a las \d{2}:\d{2}/.test(texto), texto.replace(/\n/g, ' | '))
  check('y las plazas que quedan (sin contar a quien se fue)', /quedan 15 plazas/.test(texto), texto.replace(/\n/g, ' | '))
  const href = await page.locator('#torneoPortada a').getAttribute('href')
  check('el enlace lleva a ESE torneo', href === '/torneo?slug=copa', String(href))
  await page.close()
}

console.log('\n── 2. Sin torneos abiertos, la portada queda como estaba ──')
{
  for (const [etiqueta, torneos] of [
    ['sin ningún torneo', []],
    ['con uno en borrador', [torneo({ status: 'draft' })]],
    ['con uno ya en juego', [torneo({ status: 'in_progress' })]],
    ['con uno que ya se jugó', [torneo({ start_at: enHoras(-48) })]],
  ]) {
    const { page, errores } = await abrir('/', { __FAKE_SESSION__: 'admin-1', __FAKE_TORNEOS__: torneos })
    check(`${etiqueta}: la sección se recoge`, await page.locator('#torneoPortadaSeccion').isHidden())
    check(`${etiqueta}: y sin errores`, errores.length === 0, errores[0] || '')
    await page.close()
  }
}

console.log('\n── 3. Se enseña el que antes se juega ──')
{
  const { page } = await abrir('/', {
    __FAKE_SESSION__: 'admin-1',
    __FAKE_TORNEOS__: [
      torneo({ id: 't2', slug: 'tarde', name: 'Copa de Octubre', start_at: enHoras(700) }),
      torneo({ id: 't1', slug: 'pronto', name: 'Copa de Mañana', start_at: manana() }),
    ],
  })
  const texto = await page.locator('#torneoPortada').innerText()
  check('sale el más cercano', /Copa de Mañana/.test(texto) && !/Copa de Octubre/.test(texto), texto.replace(/\n/g, ' | '))
  await page.close()
}

console.log('\n── 4. Aforo sin límite: no se inventa plazas ──')
{
  const { page } = await abrir('/', { __FAKE_SESSION__: 'admin-1', __FAKE_TORNEOS__: [torneo({ max_players: null })] })
  const texto = await page.locator('#torneoPortada').innerText()
  check('no habla de plazas', !/plaza/.test(texto), texto.replace(/\n/g, ' | '))
  check('pero sí de las inscripciones', /Inscripciones abiertas/.test(texto))
  await page.close()
}

console.log('\n── 5. Y sin cuenta también se ve ──')
{
  const { page, errores } = await abrir('/', { __FAKE_SESSION__: 'none', __FAKE_TORNEOS__: [torneo()] })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('la tarjeta sale igual', (await page.locator('#torneoPortada .reto-tarjeta').count()) === 1)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
// El sondeo de la ficha
// ═════════════════════════════════════════════════════════════════════

// Dos llamadas al juez vivas: la de user-1 y la de OTRO jugador. Así se
// puede exigir que a un jugador se le traiga solo la suya.
const LLAMADAS = [
  { id: 'c-1', tournament_id: 't1', match_id: 'mesa-1', created_by: 'user-1', status: 'open', created_at: '2026-09-03T10:00:00Z' },
  { id: 'c-2', tournament_id: 't1', match_id: 'mesa-2', created_by: 'user-9', status: 'open', created_at: '2026-09-03T10:01:00Z' },
]

const MUNDO_FICHA = {
  __FAKE_LLAMADAS__: LLAMADAS,
  __FAKE_TORNEOS__: [torneo({ status: 'in_progress', current_round_id: 'ronda-1' })],
  __FAKE_INSCRIPCIONES__: [
    { id: 'i-0', tournament_id: 't1', user_id: 'admin-1', status: 'active' },
    { id: 'i-1', tournament_id: 't1', user_id: 'user-1', status: 'active' },
  ],
  __FAKE_RONDAS__: [{ id: 'ronda-1', tournament_id: 't1', round_number: 1, phase: 'swiss', status: 'active' }],
  __FAKE_MESAS__: [{ id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'admin-1', player_b_id: 'user-1', status: 'active' }],
}

// Las tablas que se piden en UN refresco, contando de verdad.
const filtrosDe = (page, tabla) => page.evaluate((t) => window.__CONSULTAS__.igualdades[t] || [], tabla)

const tablasDeUnRefresco = async (page) => {
  const antes = await page.evaluate(() => ({ ...window.__CONSULTAS__.porTabla }))
  await page.evaluate(() => document.getElementById('btnActualizarCiclo')?.click())
  await page.waitForTimeout(1600)
  const fin = await page.evaluate(() => ({ ...window.__CONSULTAS__.porTabla }))
  return Object.keys(fin).filter((t) => (fin[t] || 0) > (antes[t] || 0))
}

console.log('\n── 6. Quien SOLO MIRA no pide lo que no puede ver ──')
{
  // user-2 no está inscrito, no es juez y no es admin.
  const { page, errores } = await abrir('/torneo?slug=copa', { ...MUNDO_FICHA, __FAKE_SESSION__: 'user-2' })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const tablas = await tablasDeUnRefresco(page)
  check('NO pide la cola de llamadas al juez', !tablas.includes('judge_calls'), tablas.join(', '))
  check('NO pide los reportes de las mesas', !tablas.includes('match_reports'), tablas.join(', '))
  check('NO pide una decklist que no tiene', !tablas.includes('tournament_decklists'), tablas.join(', '))
  // Y sí pide lo que hace falta para enseñar el torneo.
  for (const t of ['tournament_registrations', 'rounds', 'tournament_matches', 'match_results']) {
    check(`sí pide ${t}`, tablas.includes(t), tablas.join(', '))
  }
  check('en total, seis consultas', tablas.length === 6, `${tablas.length}: ${tablas.join(', ')}`)
  await page.close()
}

console.log('\n── 7. Pero se sigue viendo el torneo entero ──')
{
  const { page } = await abrir('/torneo?slug=copa', { ...MUNDO_FICHA, __FAKE_SESSION__: 'user-2' })
  const cuerpo = await page.locator('body').innerText()
  check('sale el nombre del torneo', /Copa Inaugural/.test(cuerpo))
  check('y las mesas', (await page.locator('.torneo-mesas-tabla, [class*="mesa"]').count()) > 0)
  await page.close()
}

console.log('\n── 8. Quien JUEGA sí pide lo suyo ──')
{
  const { page } = await abrir('/torneo?slug=copa', { ...MUNDO_FICHA, __FAKE_SESSION__: 'user-1' })
  const tablas = await tablasDeUnRefresco(page)
  check('pide los reportes (los necesita su mesa)', tablas.includes('match_reports'), tablas.join(', '))
  check('y sus llamadas al juez', tablas.includes('judge_calls'), tablas.join(', '))
  const filtros = await filtrosDe(page, 'judge_calls')
  check('pero acotadas a las SUYAS', filtros.includes('created_by=user-1'), filtros.join(', '))
  check('y su decklist', tablas.includes('tournament_decklists'), tablas.join(', '))
  await page.close()
}

console.log('\n── 9. Al organizador no se le ha quitado nada ──')
{
  const { page } = await abrir('/torneo?slug=copa', { ...MUNDO_FICHA, __FAKE_SESSION__: 'admin-1' })
  const tablas = await tablasDeUnRefresco(page)
  for (const t of ['judge_calls', 'match_reports', 'tournament_decklists', 'match_results']) {
    check(`sigue pidiendo ${t}`, tablas.includes(t), tablas.join(', '))
  }
  const filtros = await filtrosDe(page, 'judge_calls')
  check('y la cola ENTERA, no solo las suyas', !filtros.some((f) => f.startsWith('created_by=')), filtros.join(', '))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
