// Tanda 1401 — Tu mesa en una pieza y esperando a tu rival («El torneo, más
// sencillo», T1 y T2; PINGU: «dale con todo lo recomendado»):
//   · la cabecera de tu mesa es «Mesa N» y tu puesto; fuera las chapas de
//     ronda y «A una partida» (la ronda va en el reloj);
//   · el reloj, DENTRO del VS, gordo; el TCG Live del rival es una pastilla
//     con «Copiar»;
//   · Victoria y Derrota, botones de la web (pastilla, sin degradado desde la 1404; ≥ 52 px) que en el
//     móvil entran en la primera pantalla;
//   · registro de TCG Live, repetición y juez: una línea «¿Algo raro?» que
//     los abre (el registro y el botón del juez, plegados hasta entonces);
//   · el chat de la mesa es su propia tarjeta, a la DERECHA en el PC; tu
//     mazo no sale mientras juegas;
//   · con tu parte mandado: la tarjeta «Has dicho Victoria · Esperando a que
//     marina lo confirme…» con la mascota pensando y «Me he equivocado», que
//     llama a torneos_desreportar;
//   · quien solo mira no ve la tarjeta del chat (ni cuenta para Hoy).
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
  const TORNEO = { id: 'copa-1', slug: 'copa', name: 'Copa de otoño', status: 'in_progress', format: 'swiss', admin_id: 'user-3', max_players: 32, swiss_rounds: 4, swiss_bo: 1, top_cut_size: 0, round_time_minutes: 50, checkin_minutes: 5, start_at: new Date(ahora - 2 * 3600e3).toISOString(), current_round_id: 'r-2' }
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
  const PERFILES = GENTE.map(([id, username]) => ({ id, username, display_name: username }))
  return { TORNEO, RONDAS, MESAS, RES, REP, INSC, PERFILES }
}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
async function abrir(movil, espera, { sesion = 'user-1' } = {}) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, colorScheme: 'dark', serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.addInitScript(([d, s]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = d.REP; window.__FAKE_TABLON__ = []; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [datos(espera), sesion])
  await page.goto(BASE + '/torneo?slug=copa&ver=jugar', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: la ronda en juego ──`)
  {
    const { ctx, page, errores } = await abrir(movil, false)
    const r = await page.evaluate(() => {
      const c = document.getElementById('miPartidaContenido')
      const vis = (el) => Boolean(el) && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0
      const cab = c.querySelector('.torneo-mesa-cab')
      const reloj = c.querySelector('.torneo-duelo .torneo-duelo-medio #mesaReloj')
      const botones = [...c.querySelectorAll(':scope > .torneo-reportar .torneo-boton-resultado')]
      const mesa = document.getElementById('torneoMiPartida').getBoundingClientRect()
      const chat = document.getElementById('miPartidaExtra')
      const h3 = document.querySelector('#torneoMiPartida > h3')
      return {
        // Sin el «⋯» de tu mesa (1436), que lleva «Retirarme del torneo» dentro.
        cab: [...(cab?.childNodes || [])].filter((n) => !n.matches?.('.torneo-mimesa-mas')).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim(),
        chapas: cab?.querySelectorAll('.torneo-chapa').length,
        h3Oculto: h3 ? h3.getBoundingClientRect().width <= 1 : true,
        reloj: reloj && { cifra: reloj.querySelector('#mesaRelojCifra')?.textContent, rotulo: reloj.querySelector('small')?.textContent, tam: parseFloat(getComputedStyle(reloj.querySelector('#mesaRelojCifra')).fontSize) },
        tcg: c.querySelector('[data-copiar-tcg]')?.textContent.replace(/\s+/g, ' ').trim(),
        botones: botones.map((b) => [b.textContent.trim(), getComputedStyle(b).backgroundImage.includes('gradient'), Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().bottom)]),
        raro: [...c.querySelectorAll('.torneo-algo-raro [data-raro]')].map((b) => b.dataset.raro),
        registroVisible: vis(document.getElementById('torneoRegistro')),
        juezVisible: vis(document.getElementById('btnLlamarJuez')),
        juezExiste: Boolean(document.getElementById('btnLlamarJuez')),
        mazoVisible: vis(document.getElementById('torneoMazoCaja')),
        chat: vis(chat) && Boolean(chat.querySelector('#chatDeMesa')),
        chatALaDerecha: chat.getBoundingClientRect().left >= mesa.right - 1,
        chatDebajo: chat.getBoundingClientRect().top >= mesa.bottom - 1,
        barra: (() => { const b = document.querySelector('nav.bm'); return b && getComputedStyle(b).position === 'fixed' ? Math.round(b.getBoundingClientRect().top) : innerHeight })(),
        ancho: document.documentElement.scrollWidth <= innerWidth + 1,
      }
    })
    check(`${q}: la cabecera es «Mesa 1» y tu puesto, sin chapas de ronda`, /^Mesa 1 \d+\.º · \d+ pts$/.test(r.cab || '') && r.chapas === 0, JSON.stringify([r.cab, r.chapas]))
    check(`${q}: «Tu partida» queda solo para el lector de pantalla`, r.h3Oculto)
    check(`${q}: el reloj va dentro del VS, gordo, con la ronda`, r.reloj && /^\d+:\d\d$/.test(r.reloj.cifra) && /RONDA 2/.test(r.reloj.rotulo) && r.reloj.tam >= 26, JSON.stringify(r.reloj))
    check(`${q}: el TCG Live del rival, en pastilla con «Copiar»`, r.tcg === 'TCG_marina Copiar', r.tcg)
    check(`${q}: Victoria y Derrota, botones de la casa (sin degradado, ≥ 52 px)`, r.botones.length === 2 && r.botones.every(([, g, h]) => !g && h >= 52), JSON.stringify(r.botones))
    if (movil) check('Móvil: Victoria y Derrota entran en la primera pantalla (sobre la barra de abajo)', r.botones.every(([, , , b]) => b <= r.barra), JSON.stringify([r.botones, r.barra]))
    check(`${q}: «¿Algo raro?» con registro, repetición y juez`, r.raro.join(',') === 'registro,repeticion,juez', r.raro.join(','))
    check(`${q}: el registro y el botón del juez, plegados`, !r.registroVisible && r.juezExiste && !r.juezVisible, JSON.stringify([r.registroVisible, r.juezVisible]))
    check(`${q}: tu mazo no sale mientras juegas`, !r.mazoVisible)
    check(`${q}: el chat es su tarjeta, ${movil ? 'debajo de tu mesa' : 'a la derecha de tu mesa'}`, r.chat && (movil ? r.chatDebajo : r.chatALaDerecha), JSON.stringify([r.chat, r.chatALaDerecha, r.chatDebajo]))
    if (OUT) await page.screenshot({ path: `${OUT}/1401-mesa-${movil ? 'm' : 'pc'}.png`, scale: 'css', fullPage: !movil })

    await page.click('[data-copiar-tcg]')
    await page.waitForTimeout(400)
    const toast = await page.evaluate(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).join(' | '))
    check(`${q}: «Copiar» avisa con su nombre`, /TCG_marina/.test(toast), toast)
    await page.click('.torneo-algo-raro [data-raro="registro"]')
    await page.waitForTimeout(500)
    const reg = await page.evaluate(() => { const d = document.getElementById('torneoRegistro'); return { visible: getComputedStyle(d).display !== 'none', abierto: d.open, foco: document.activeElement?.id } })
    check(`${q}: «Pegar el registro» lo abre y te deja en el cuadro`, reg.visible && reg.abierto && reg.foco === 'torneoRegistroTexto', JSON.stringify(reg))
    await page.click('.torneo-algo-raro [data-raro="juez"]')
    await page.waitForTimeout(800)
    const juez = await page.evaluate(() => (window.__FAKE_DB__?.judge_calls || window.__T__?.judge_calls || []).length + ' ' + [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).join(' | '))
    check(`${q}: «Llamar al juez» llama`, /juez/i.test(juez), juez)
    check(`${q}: sin desplazamiento de lado y sin errores`, r.ancho && !errores.length, errores.join(' | '))
    await ctx.close()
  }
  console.log(`── ${q}: esperando a tu rival ──`)
  {
    const { ctx, page, errores } = await abrir(movil, true)
    const r = await page.evaluate(() => {
      const e = document.querySelector('#miPartidaContenido .torneo-espera')
      return e && { texto: e.textContent.replace(/\s+/g, ' ').trim(), mascota: e.querySelector('[data-mascota]')?.dataset.mascota, rol: e.getAttribute('role'), boton: e.querySelector('[data-quitar]')?.textContent.trim(), reportar: document.querySelectorAll('#miPartidaContenido > .torneo-reportar').length }
    })
    check(`${q}: «Has dicho Victoria · Esperando a que marina lo confirme…»`, r && /Has dicho Victoria/.test(r.texto) && /Esperando a que marina lo confirme/.test(r.texto) && r.rol === 'status', JSON.stringify(r))
    check(`${q}: …con la mascota pensando y sin los botones de reportar`, r && r.mascota === 'pensar' && r.reportar === 0, JSON.stringify(r))
    if (OUT) await page.screenshot({ path: `${OUT}/1401-espera-${movil ? 'm' : 'pc'}.png`, scale: 'css', fullPage: !movil })
    await page.click('.torneo-espera [data-quitar]')
    await page.waitForTimeout(600)
    const rpc = await page.evaluate(() => (window.__RPCS__ || []).filter((x) => x.nombre === 'torneos_desreportar').map((x) => x.args))
    check(`${q}: «Me he equivocado» retira tu parte (torneos_desreportar de la mesa, juego 0)`, rpc.length === 1 && rpc[0].p_partida === 'm-2-0' && rpc[0].p_juego === 0, JSON.stringify(rpc))
    check(`${q}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
}
console.log('── Quien solo mira ──')
{
  const { ctx, page, errores } = await abrir(false, false, { sesion: 'none' })
  const r = await page.evaluate(() => ({ extra: document.getElementById('miPartidaExtra')?.classList.contains('hidden'), chat: document.querySelectorAll('#chatDeMesa').length, pestana: document.documentElement.dataset.torneoPestana }))
  check('sin cuenta, la tarjeta del chat ni se ve ni se monta', r.extra && r.chat === 0, JSON.stringify(r))
  check('…y no hace que Hoy cuente como pestaña con algo', r.pestana !== 'jugar', JSON.stringify(r))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
