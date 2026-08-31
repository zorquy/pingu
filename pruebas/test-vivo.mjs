import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 227: el tiempo real. Lo que se prueba NO es que llegue el
// websocket (eso solo pasa contra el Supabase de verdad), sino las tres
// cosas que sí dependen de nuestro código: que la página se SUSCRIBA a
// lo que dice, que reaccione cuando llega un cambio, y —lo importante—
// que si el websocket se cae la página siga funcionando como antes.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript((s) => {
    for (const [clave, valor] of Object.entries(s)) window[clave] = valor
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const suscripciones = (page) =>
  page.evaluate(() =>
    (window.__VIVO__?.suscripciones || []).map((s) => ({
      nombre: s.nombre,
      tablas: s.tablas.map((t) => t.tabla),
      filtros: s.tablas.map((t) => t.filtro || null),
      eventos: s.tablas.map((t) => t.evento || '*'),
    }))
  )

const TORNEO = {
  __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'vivo', name: 'Copa Viva', status: 'in_progress', max_players: 8, swiss_rounds: 3 }],
  __FAKE_INSCRIPCIONES__: [{ id: 'i-1', tournament_id: 'torneo-1', user_id: 'admin-1', status: 'active', tcg_live_username: 'TCG' }],
  __FAKE_RONDAS__: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active' }],
  __FAKE_MESAS__: [{ id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'admin-1', player_b_id: 'user-1', status: 'active' }],
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La ficha del torneo escucha lo que se mueve ──')
{
  const { page, errores } = await abrir('/torneo?slug=vivo', TORNEO)
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const subs = await suscripciones(page)
  const delTorneo = subs.find((s) => /^torneo-/.test(s.nombre))
  check('se suscribe al torneo', Boolean(delTorneo), JSON.stringify(subs.map((s) => s.nombre)))
  for (const tabla of ['rounds', 'judge_calls', 'tournament_matches', 'match_messages', 'match_reports', 'match_results']) {
    check(`escucha ${tabla}`, delTorneo?.tablas.includes(tabla), JSON.stringify(delTorneo?.tablas))
  }
  // Y NO escucha lo que no se mueve: suscribirse a inscritos o
  // decklists sería pagar un canal para nada.
  check('no escucha las decklists', !delTorneo?.tablas.includes('tournament_decklists'), JSON.stringify(delTorneo?.tablas))
  // Tabla por tabla, no con `.some()`: como judge_calls lleva el mismo
  // filtro, comprobarlo en bloque dejaba pasar que a rounds se le
  // quitara — y entonces cada torneo del mundo despertaría a esta ficha.
  const filtroDe = (tabla) => {
    const i = delTorneo?.tablas.indexOf(tabla)
    return i >= 0 ? delTorneo.filtros[i] : null
  }
  check('las rondas van filtradas por ESTE torneo', /tournament_id=eq\.torneo-1/.test(filtroDe('rounds') || ''), JSON.stringify(filtroDe('rounds')))
  check('y las llamadas a juez también', /tournament_id=eq\.torneo-1/.test(filtroDe('judge_calls') || ''), JSON.stringify(filtroDe('judge_calls')))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Cuando llega un cambio, la ficha se refresca ──')
{
  const { page } = await abrir('/torneo?slug=vivo', TORNEO)
  const antes = await page.evaluate(() => window.__CONSULTAS__?.n ?? 0)
  // Al canal DEL TORNEO y solo a él: emitir a todos despertaría también
  // a la campanita, y entonces esta comprobación pasaría aunque la
  // ficha no reaccionara a nada.
  const canal = await page.evaluate(
    () => (window.__VIVO__?.suscripciones || []).find((s) => /^torneo-/.test(s.nombre))?.nombre || null
  )
  check('hay canal de torneo al que emitir', Boolean(canal), String(canal))
  await page.evaluate((n) => window.__VIVO__?.emitir(n), canal)
  await page.waitForTimeout(1200)
  const despues = await page.evaluate(() => window.__CONSULTAS__?.n ?? 0)
  check('un evento provoca una recarga', despues > antes, `${antes} → ${despues}`)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. LA RED DE SEGURIDAD: si el vivo se cae, se sigue ──')
{
  // Esta es la rama que importa. En el navegador de verdad casi nunca
  // pasa, y por eso es justo la que se rompe sin que nadie lo note.
  const { page } = await abrir('/torneo?slug=vivo', TORNEO)
  const conVivo = await page.evaluate(() => (window.__VIVO__?.sondeos || []).map((s) => s.__estado.ms))
  check('hay sondeo de respaldo en la ficha', conVivo.length >= 1, JSON.stringify(conVivo))
  check('con el vivo conectado va al ralentí', conVivo.length >= 1 && conVivo.every((ms) => ms >= 60000), JSON.stringify(conVivo))

  await page.evaluate(() => window.__VIVO__?.estado(false))
  await page.waitForTimeout(300)
  const sinVivo = await page.evaluate(() => (window.__VIVO__?.sondeos || []).map((s) => s.__estado.ms))
  check('si se cae, el sondeo vuelve a su ritmo', sinVivo.length >= 1 && sinVivo.every((ms) => ms === 10000), JSON.stringify(sinVivo))

  // Y que el sondeo siga LLAMANDO de verdad, no solo teniendo el número
  // bien: un intervalo bien configurado que nadie arranca no sirve.
  const cuenta = () => page.evaluate(() => window.__VIVO__?.sondeos?.[0]?.__estado?.llamadas ?? -1)
  const llamadasAntes = await cuenta()
  check('hay un sondeo de respaldo que mirar', llamadasAntes >= 0, `${llamadasAntes}`)
  await page.waitForTimeout(11000)
  const llamadasDespues = await cuenta()
  check('y de verdad vuelve a pedir datos', llamadasDespues > llamadasAntes && llamadasAntes >= 0, `${llamadasAntes} → ${llamadasDespues}`)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La campanita escucha lo suyo y nada más ──')
{
  const { page, errores } = await abrir('/foro', {})
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const subs = await suscripciones(page)
  const campana = subs.find((s) => /^campanita-/.test(s.nombre))
  check('se suscribe la campanita', Boolean(campana), JSON.stringify(subs.map((s) => s.nombre)))
  check('solo a user_notifications', campana?.tablas.join() === 'user_notifications', JSON.stringify(campana?.tablas))
  // Filtrada por destinatario: la RLS ya lo impediría, pero pedirlo así
  // evita que el servidor evalúe y descarte los avisos de los demás.
  check('filtrada a MIS avisos', /recipient_id=eq\./.test(campana?.filtros?.[0] || ''), JSON.stringify(campana?.filtros))
  check('y solo de los nuevos (INSERT)', campana?.eventos?.[0] === 'INSERT', JSON.stringify(campana?.eventos))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El tema del foro: en vivo, pero SIN sondeo nuevo ──')
{
  const { page, errores } = await abrir('/tema?t=tema-1', {
    __FAKE_SECCIONES__: [{ name: 'General' }],
    __FAKE_FOROS__: [{ id: 'foro-1', slug: 'dudas', name: 'Dudas', section_id: 'seccion-1' }],
    __FAKE_TEMAS__: [{ id: 'tema-1', board_id: 'foro-1', title: 'Un tema vivo', author_id: 'user-1' }],
    __FAKE_MENSAJES__: [{ id: 'msg-1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>Hola</p>' }],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const subs = await suscripciones(page)
  const delTema = subs.find((s) => /^tema-/.test(s.nombre))
  check('se suscribe al tema', Boolean(delTema), JSON.stringify(subs.map((s) => s.nombre)))
  check('solo a los mensajes nuevos', delTema?.eventos?.[0] === 'INSERT', JSON.stringify(delTema?.eventos))
  check('filtrado a ESTE tema', /thread_id=eq\.tema-1/.test(delTema?.filtros?.[0] || ''), JSON.stringify(delTema?.filtros))

  // Leer un tema NO puede estrenar un sondeo: el foro nunca lo tuvo, y
  // ponerlo ahora gastaría MÁS que antes de la tanda.
  const sondeos = await page.evaluate(() => (window.__VIVO__?.sondeos || []).length)
  check('leer un tema no estrena ningún sondeo', sondeos === 0, `${sondeos} sondeos`)
  await page.close()
}

await browser.close()
console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
