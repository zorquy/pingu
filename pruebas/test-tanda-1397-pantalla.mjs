// Tanda 1397 — la sala de espera del torneo («PokeDoc en modo app», PINGU:
// «me gusta que toques lo de los torneos… en el PC también se ve guay»).
// Antes de empezar, Info es la sala de un juego:
//   · el cartel con la mascota, la cuenta atrás en tres losas (días, horas,
//     minutos), «N/M en la sala» con caras y barra, y el formato en 4 losas;
//   · las piezas viejas (día, chapas, barra de plazas) se esconden con la sala;
//   · «Tu plaza» son misiones: Inscrito (hecha), tu lista (la que toca, con
//     «Elegir mazo») y confirmar (cerrada hasta mandar la lista);
//   · con la lista mandada sale el «¡ESTOY!», que confirma y deja 3/3;
//   · Jugadores es la sala: caras grandes, la tuya rodeada y las plazas libres;
//   · empezado el torneo no hay sala; y nada se sale de lado (móvil y PC).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 0. Lo puro ──')
{
  // sala.js importa icons.js y caras.js, que en node se cargan sin navegador.
  const REPO = process.env.PD_RAIZ || '/home/user/pingu'
  const { cuentaAtras, salaHtml, misionesHtml } = await import(REPO + '/js/torneos/sala.js')
  const ahora = Date.parse('2026-11-18T10:00:00Z')
  check('cuentaAtras: 1 día, 2 h y 3 min', JSON.stringify(cuentaAtras('2026-11-19T12:03:30Z', ahora)) === '{"d":1,"h":2,"m":3}')
  check('cuentaAtras: ya pasó o sin fecha → null', cuentaAtras('2026-11-18T09:00:00Z', ahora) === null && cuentaAtras(null, ahora) === null)
  const h = salaHtml({ name: 'Copa <b>', status: 'registration_open', start_at: '2026-11-19T12:03:30Z', max_players: 8, swiss_rounds: 3, top_cut_size: 4 }, [{ perfil: { username: 'ana' } }, { perfil: { username: 'bea' } }], { ahora })
  check('salaHtml: nombre escapado, «2/8 en la sala», 4 losas y «DÍA» en singular', h.includes('Copa &lt;b&gt;') && h.includes('2/8 en la sala') && (h.match(/class="sala-losa"/g) || []).length === 4 && h.includes('>DÍA<'))
  check('salaHtml: sin límite de plazas lo dice', salaHtml({ name: 'X', start_at: null }, []).includes('sin límite de plazas'))
  const m0 = misionesHtml({ tcg: 'Ana', listaHecha: false })
  const m1 = misionesHtml({ tcg: 'Ana', listaHecha: true })
  const m2 = misionesHtml({ tcg: 'Ana', listaHecha: true, confirmado: true })
  check('misiones: 1/3 sin lista, sin «¡ESTOY!» y la de confirmar cerrada', m0.includes('1/3') && !m0.includes('btnConfirmarParticipacion') && m0.includes('sala-mision cerrada'))
  check('misiones: con lista, 2/3 y el «¡ESTOY!»', m1.includes('2/3') && m1.includes('id="btnConfirmarParticipacion"'))
  check('misiones: todo hecho, 3/3 y «¡Todo listo!»', m2.includes('3/3') && m2.includes('¡Todo listo!') && !m2.includes('btnConfirmarParticipacion'))
}

const b = await chromium.launch()
const conLista = () => {
  window.__FAKE_DECKLISTS__ = [...(window.__FAKE_DECKLISTS__ || []), { id: 'dk-sala', tournament_id: 'torneo-2', user_id: 'user-1', content: '4 Pikachu SVI 63', parsed_cards: { pokemon: [{ quantity: 4, name: 'Pikachu', set: 'SVI', number: '63' }], trainer: [], energy: [], total: 4 }, submitted_at: new Date().toISOString(), locked_at: null }]
}

for (const movil of [true, false]) {
  console.log(`── 1. La sala (${movil ? 'móvil' : 'PC'}) ──`)
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/torneo?slug=copa-delta`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.torneo-sala .sala-cartel', { timeout: 15000 }).catch(() => {})
  const d = await p.evaluate(() => {
    const vis = (s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 }
    return {
      cartel: vis('.sala-cartel') && /Copa Delta/.test(document.querySelector('.sala-nombre')?.textContent || ''),
      mascota: !!document.querySelector('.sala-cartel .mascota-3d[data-mascota]'),
      cuenta: [...document.querySelectorAll('.sala-cuenta b')].map((x) => x.textContent),
      gente: document.querySelector('.sala-gente-texto b')?.textContent || '',
      losas: document.querySelectorAll('.sala-losa').length,
      viejas: ['#torneoCuando', '#torneoFormato', '.torneo-plazas'].filter(vis),
      anillo: document.querySelector('.sala-anillo b')?.textContent,
      inscrito: !!document.querySelector('.sala-mision.hecha') && /Inscrito/.test(document.querySelector('.sala-mision.hecha')?.textContent || ''),
      toca: document.querySelector('.sala-mision.toca [data-abrir-lista]')?.textContent?.trim(),
      cerrada: !!document.querySelector('.sala-mision.cerrada'),
      estoy: !!document.getElementById('btnConfirmarParticipacion'),
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  check('el cartel con su nombre y la mascota', d.cartel && d.mascota, JSON.stringify(d))
  check('la cuenta atrás en tres losas de dos cifras (12 días)', d.cuenta.length === 3 && d.cuenta.every((x) => /^\d{2,}$/.test(x)) && Number(d.cuenta[0]) >= 12, d.cuenta.join(' '))
  check('«N/16 en la sala» y las cuatro losas del formato', /^\d+\/16 en la sala$/.test(d.gente) && d.losas === 4, d.gente + ' · ' + d.losas)
  check('las piezas viejas (día, chapas, barra de plazas) escondidas', d.viejas.length === 0, d.viejas.join(', '))
  check('misiones: 1/3, Inscrito hecha, «Elegir mazo» la que toca y confirmar cerrada', d.anillo === '1/3' && d.inscrito && d.toca === 'Elegir mazo' && d.cerrada && !d.estoy, JSON.stringify(d))
  check('nada se sale de lado', d.ancho)
  await p.click('.sala-mision.toca [data-abrir-lista]')
  await p.waitForTimeout(400)
  check('«Elegir mazo» abre la ventana de la lista', await p.evaluate(() => !!document.querySelector('#torneoListaVentana[open]')))
  await p.evaluate(() => document.querySelector('#torneoListaVentana[open]')?.close())

  // Jugadores como sala.
  await p.click('[data-pestana="jugadores"], #pestanaJugadores, [aria-controls*="ugadores"]').catch(() => {})
  await p.waitForTimeout(500)
  const j = await p.evaluate(() => ({
    yo: !!document.querySelector('.torneo-inscritos-mosaico .torneo-inscrito.yo'),
    libres: document.querySelectorAll('.torneo-inscritos-mosaico .sala-libre').length,
    cara: Math.round(document.querySelector('.torneo-inscritos-mosaico .torneo-jcara, .torneo-inscritos-mosaico .mini-avatar')?.getBoundingClientRect().width || 0),
    ancho: document.documentElement.scrollWidth <= innerWidth + 1,
  }))
  check('Jugadores: caras grandes, la tuya marcada y plazas libres', j.yo && j.libres > 0 && j.cara >= 48 && j.ancho, JSON.stringify(j))
  check('sin errores', !errores.length, errores.join(' | '))
  await p.screenshot({ path: `/tmp/1397-sala-${movil ? 'movil' : 'pc'}.png`, fullPage: true })
  await ctx.close()
}

console.log('── 2. Con la lista mandada: «¡ESTOY!» ──')
{
  const ctx = await contexto(b, true, 'user-1', conLista)
  const p = await ctx.newPage()
  await p.goto(`${BASE}/torneo?slug=copa-delta`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('#btnConfirmarParticipacion', { timeout: 15000 }).catch(() => {})
  const a = await p.evaluate(() => ({ anillo: document.querySelector('.sala-anillo b')?.textContent, estoy: document.getElementById('btnConfirmarParticipacion')?.textContent || '' }))
  check('2/3 y el botón «¡ESTOY!»', a.anillo === '2/3' && /ESTOY/.test(a.estoy), JSON.stringify(a))
  await p.click('#btnConfirmarParticipacion').catch(() => {})
  await p.waitForFunction(() => document.querySelector('.sala-anillo b')?.textContent === '3/3', null, { timeout: 8000 }).catch(() => {})
  const c = await p.evaluate(() => ({ anillo: document.querySelector('.sala-anillo b')?.textContent, listo: /¡Todo listo!/.test(document.querySelector('.sala-misiones-cab')?.textContent || ''), estoy: !!document.getElementById('btnConfirmarParticipacion') }))
  check('al pulsarlo: 3/3, «¡Todo listo!» y el botón se va', c.anillo === '3/3' && c.listo && !c.estoy, JSON.stringify(c))
  await ctx.close()
}

console.log('── 3. Empezado, sin sala ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const p = await ctx.newPage()
  await p.goto(`${BASE}/torneo?slug=liga-fdn-otono`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const s = await p.evaluate(() => ({ estado: document.querySelector('.torneo-estado, [data-estado]')?.textContent || '', sala: !!document.querySelector('.torneo-sala') }))
  check('un torneo en juego no enseña la sala', !s.sala, JSON.stringify(s))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo bien')
process.exit(fails ? 1 : 0)
