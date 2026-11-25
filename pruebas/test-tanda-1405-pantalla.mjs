// Tanda 1405 — Arreglos de la Liga FDN en vivo (PINGU, con capturas):
//   · el cara a cara enseña la FOTO de cada uno (antes, la inicial siempre);
//   · un mensaje del chat de la mesa no desaparece: si una consulta falla o
//     vuelve vacía cuando ya había mensajes (sesión caducada), se queda lo
//     que había y se avisa, en vez de «Sin mensajes todavía»;
//   · «Llamar al juez» de la línea «¿Algo raro?» llama de verdad, y si ya
//     tienes una llamada lo dice (antes pulsaba un botón escondido que podía
//     no estar, y no pasaba nada);
//   · el tablón en el PC sale arriba, junto (antes repartía el alto de la
//     pantalla entre sus filas y quedaba roto).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const OUT = process.env.OUT || ''
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const GENTE = [['user-1', 'pingu'], ['user-2', 'marina'], ['user-3', 'teo'], ['mod-1', 'nerea'], ['p5', 'david'], ['p6', 'hugo'], ['p7', 'lucia'], ['p8', 'alex']]
// Copa suiza al mejor de 1: R1 cerrada, R2 en juego contra marina (mesa 1).
// `espera`: ya mandaste «Victoria» y falta que marina lo confirme.
function datos(espera) {
  const TORNEO = { id: 'copa-1', slug: 'copa', name: 'Copa de otoño', status: 'in_progress', format: 'swiss', admin_id: 'user-1', max_players: 32, swiss_rounds: 4, swiss_bo: 1, top_cut_size: 0, round_time_minutes: 50, checkin_minutes: 5, start_at: new Date(ahora - 2 * 3600e3).toISOString(), current_round_id: 'r-2' }
  const RONDAS = [1, 2].map((n) => ({ id: `r-${n}`, tournament_id: 'copa-1', round_number: n, phase: 'swiss', status: n < 2 ? 'finished' : 'active', started_at: new Date(ahora - (n === 2 ? 20 * 60e3 : 2 * 3600e3)).toISOString(), ends_at: new Date(ahora + (n === 2 ? 30 * 60e3 : -3600e3)).toISOString() }))
  const cruces = { 1: [['user-1', 'p5'], ['user-2', 'p6'], ['user-3', 'p7'], ['mod-1', 'p8']], 2: [['user-1', 'user-2'], ['user-3', 'mod-1'], ['p5', 'p7'], ['p6', 'p8']] }
  const MESAS = [], RES = []
  for (const n of [1, 2]) {
    cruces[n].forEach(([a, b], t) => {
      const id = `m-${n}-${t}`
      const mia = n === 2 && t === 0
      const fin = n < 2
      MESAS.push({ id, round_id: `r-${n}`, table_number: t + 1, player_a_id: a, player_b_id: b, status: fin ? 'finished' : mia && espera ? 'awaiting_confirmation' : 'active', check_in_a_at: new Date(ahora - 900e3).toISOString(), check_in_b_at: new Date(ahora - 900e3).toISOString() })
      if (fin) RES.push({ id: `res-${id}`, match_id: id, result: 'a_wins', winner_id: a, score_a: 1, score_b: 0, created_at: new Date(ahora - 3600e3).toISOString() })
    })
  }
  const REP = espera ? [{ id: 'rep-1', match_id: 'm-2-0', reporter_id: 'user-1', result: 'win', game_number: 0, created_at: new Date(ahora - 60e3).toISOString() }] : []
  const INSC = GENTE.map(([u, n], i) => ({ id: `i-${i}`, tournament_id: 'copa-1', user_id: u, status: 'active', tcg_live_username: `TCG_${n}`, registered_at: new Date(ahora - 5 * 86400e3).toISOString() }))
  const PERFILES = GENTE.map(([id, username]) => ({ id, username, display_name: username, avatar_url: id === 'user-2' || id === 'user-1' ? `https://example.com/${username}.png` : null }))
  return { TORNEO, RONDAS, MESAS, RES, REP, INSC, PERFILES }
}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
async function abrir(movil, espera, { sesion = 'user-1', llamadas = [] } = {}) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, colorScheme: 'dark', serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.addInitScript(([d, s]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = d.REP; window.__FAKE_TABLON__ = []; window.__FAKE_JUECES__ = []; window.__FAKE_LLAMADAS__ = d.LLAMADAS || []; window.__FAKE_TABLON__ = [{ id: 'tb-1', tournament_id: 'copa-1', author_id: 'user-1', kind: 'aviso', body: 'En 3 minutos cerramos listas', created_at: new Date(Date.now() - 240e3).toISOString() }]; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [{ ...datos(espera), LLAMADAS: llamadas }, sesion])
  await page.goto(BASE + '/torneo?slug=copa&ver=jugar', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}


const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).join(' | '))
console.log('── Las caras del cara a cara ──')
{
  const { ctx, page, errores } = await abrir(false, false)
  const caras = await page.evaluate(() => [...document.querySelectorAll('#miPartidaContenido .torneo-duelo-cara')].map((c) => [getComputedStyle(c).backgroundImage, c.textContent.trim()]))
  check('tu foto y la de marina, sin inicial encima', caras.length === 2 && caras.every(([bg, t]) => /pingu\.png|marina\.png/.test(bg) && t === ''), JSON.stringify(caras))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
console.log('── El chat no pierde los mensajes ──')
{
  const { ctx, page, errores } = await abrir(false, false)
  await page.fill('#chatDeMesa .torneo-chat-envio input', 'Hello!')
  await page.click('#chatDeMesa .torneo-chat-envio button')
  await page.waitForTimeout(700)
  const leer = () => page.evaluate(() => document.querySelector('#chatDeMesa .torneo-chat-mensajes')?.textContent.replace(/\s+/g, ' ').trim())
  check('el mensaje sale', /Hello!/.test(await leer()), await leer())
  // La sesión caduca: la base deja de enseñarte los mensajes (vacío, sin error).
  await page.evaluate(() => { window.__GUARDA__ = window.__TABLAS__.match_messages; window.__TABLAS__.match_messages = [] })
  await page.evaluate(() => document.getElementById('chatDeMesa').refrescarMensajes())
  await page.waitForTimeout(500)
  check('con la consulta vacía, el mensaje se queda', /Hello!/.test(await leer()) && !/Sin mensajes/.test(await leer()), await leer())
  check('…y avisa de que no se ha podido poner al día', /poner al día el chat/.test(await toasts(page)), await toasts(page))
  // Y si falla la consulta, igual.
  await page.evaluate(() => { window.__TABLAS__.match_messages = window.__GUARDA__; window.__FAKE_FALLA__ = { match_messages: true } })
  await page.evaluate(() => document.getElementById('chatDeMesa').refrescarMensajes())
  await page.waitForTimeout(500)
  check('con la consulta fallando, el mensaje se queda', /Hello!/.test(await leer()), await leer())
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
console.log('── Llamar al juez ──')
{
  const { ctx, page, errores } = await abrir(false, false)
  await page.click('.torneo-algo-raro [data-raro="juez"]')
  // Desde la 1441, primero el motivo.
  await page.waitForTimeout(400)
  await page.click('#torneoMotivoJuez button[type="submit"]')
  await page.waitForTimeout(1200)
  check('llama y lo dice', /Llamada enviada/.test(await toasts(page)), await toasts(page))
  check('…y sale «Esperando juez…» en la tarjeta del chat', /Esperando juez/.test(await page.evaluate(() => document.getElementById('zonaLlamarJuez')?.textContent || '')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir(false, false, { llamadas: [{ id: 'll-1', tournament_id: 'copa-1', match_id: 'm-2-0', created_by: 'user-1', status: 'open', created_at: new Date(ahora - 60e3).toISOString() }] })
  await page.click('.torneo-algo-raro [data-raro="juez"]')
  await page.waitForTimeout(800)
  check('con una llamada ya abierta, lo dice en vez de no hacer nada', /Ya has llamado al juez/.test(await toasts(page)), await toasts(page))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
console.log('── El tablón en el PC ──')
{
  const { ctx, page, errores } = await abrir(false, false)
  await page.click('#torneoTablonLinea')
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => {
    const caja = document.getElementById('torneoTablon').getBoundingClientRect()
    const cab = document.querySelector('.torneo-tablon-cab').getBoundingClientRect()
    const form = document.getElementById('torneoTablonForm').getBoundingClientRect()
    const input = document.querySelector('#torneoTablonForm input[type=text]').getBoundingClientRect()
    return { lado: Math.round(caja.left), hueco: Math.round(form.top - cab.bottom), input: Math.round(input.width), ancho: Math.round(form.width) }
  })
  check('sale por la derecha', r.lado > 900, JSON.stringify(r))
  check('el formulario va justo debajo del título (no a media pantalla)', r.hueco <= 24, JSON.stringify(r))
  check('…y el cuadro de texto ocupa el ancho', r.input >= r.ancho - 2, JSON.stringify(r))
  if (OUT) await page.screenshot({ path: `${OUT}/1405-tablon-pc.png`, scale: 'css' })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
