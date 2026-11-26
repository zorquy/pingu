// Tandas 1464–1465 — propuesta «Campeones y ficha» (PINGU: «adelante con todo
// lo recomendado»):
//   1464 · «Últimos resultados» pasa a ser Campeones: carteles dorados con la
//          cara del campeón, su mazo, el 2.º y 3.º y «Quedaste 3.º»; en las
//          filas de Terminados, «Campeón · su mazo». En el móvil, carrusel.
//   1465 · Info antes de empezar, de un vistazo: día · sitio · sala en una
//          fila, el formato en una tira, sin el cartel ni las losas repetidas
//          (la cuenta atrás, con minutos, en la cabecera), los premios en
//          podio y «Tu plaza» como entrada (al lado en el PC; en el móvil,
//          antes de los premios y con el QR plegado).
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { datosArena, sembrarArena } from './fixture-arena.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const { podioDePremios } = await import(`${REPO}/js/torneos/comun.js`)
  const P = (a) => a.map(([puesto, premio]) => ({ puesto, premio }))
  check('1º, 2º y 3º → podio', podioDePremios(P([['1º', 'a'], ['2º', 'b'], ['3º', 'c'], ['Resto', 'd']]))?.length === 3)
  check('«1.», «2.», «3.» también', podioDePremios(P([['1.', 'a'], ['2.', 'b'], ['3.', 'c']]))?.length === 3)
  check('«1º, 2º, Todos» no es podio (lista de siempre)', podioDePremios(P([['1º', 'a'], ['2º', 'b'], ['Todos', 'c']])) === null)
  check('«Top 4» no es podio', podioDePremios(P([['Top 4', 'a'], ['2º', 'b'], ['3º', 'c']])) === null)
  const { cuentaDeCabecera } = await import(`${REPO}/js/torneos/cabecera.js`)
  const ahora = Date.parse('2026-11-26T10:00:00Z')
  const c = cuentaDeCabecera({ status: 'registration_open', start_at: '2026-12-18T09:40:00Z' }, { ahora })
  check('la cuenta de la cabecera lleva minutos: «21 d 23 h 40 min»', c?.valor === '21 d 23 h 40 min', c?.valor)
  const c2 = cuentaDeCabecera({ status: 'registration_open', start_at: '2026-11-26T15:05:00Z' }, { ahora })
  check('…y con menos de un día, como antes: «5 h 5 min»', c2?.valor === '5 h 5 min', c2?.valor)
}

const b = await chromium.launch()
async function abrirLista({ movil = false, ruta = '/torneos' } = {}) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(sembrarArena, datosArena())
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}

console.log('── 1464: Campeones (PC) ──')
{
  const { ctx, page, errores } = await abrirLista()
  const r = await page.evaluate(() => ({
    cab: document.querySelector('.t-campeones-tramo .torneos-tramo-cab')?.textContent,
    viejo: [...document.querySelectorAll('.torneos-tramo-cab')].some((h) => /Últimos resultados/.test(h.textContent)),
    camp: [...document.querySelectorAll('.t-campeon')].map((c) => ({
      id: c.dataset.torneoId,
      nombre: c.querySelector('.t-campeon-nombre')?.textContent.replace('Campeón', '').trim(),
      mazo: c.querySelector('.t-campeon-mazo-nombre')?.textContent,
      podio: [...c.querySelectorAll('.t-campeon-podio > span')].map((s) => s.textContent.trim()),
      tu: c.querySelector('.t-campeon-tu')?.textContent,
      cara: Math.round(c.querySelector('.t-campeon-cara .torneo-cara')?.getBoundingClientRect().width || 0),
    })),
    fila: document.querySelectorAll('.t-campeones .t-campeon').length && new Set([...document.querySelectorAll('.t-campeon')].map((c) => Math.round(c.getBoundingClientRect().top))).size,
    noSonCarteles: !document.querySelector('.t-carteles-tramo .t-campeon'),
  }))
  check('el tramo se llama «Campeones» (y no «Últimos resultados»)', r.cab === 'Campeones' && !r.viejo, r.cab)
  check('tres carteles dorados, en una fila', r.camp.length === 3 && r.fila === 1, JSON.stringify(r.camp.map((c) => c.id)))
  const t = r.camp.find((c) => c.id === 't-tardeo')
  check('el campeón en grande (cara ≥ 70 px) con su nombre', t?.nombre === 'jesus-bless' && t.cara >= 70, JSON.stringify(t))
  check('su mazo, sacado de su lista («Dragapult ex Dusknoir»)', t?.mazo === 'Dragapult ex Dusknoir', t?.mazo)
  check('el 2.º y el 3.º del podio guardado', t?.podio.length === 2 && /2\s*E?\s*enege/.test(t.podio[0]) && /Ash/.test(t.podio[1]), t?.podio.join(' | '))
  check('y cómo quedaste tú: «Quedaste 3.º»', t?.tu === 'Quedaste 3.º', t?.tu)
  check('los de «Lo próximo» siguen siendo carteles de su tipo, no dorados', r.noSonCarteles)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1464: Terminados (las filas) ──')
{
  const { ctx, page, errores } = await abrirLista({ ruta: '/torneos#terminados' })
  const filas = await page.evaluate(() => [...document.querySelectorAll('[data-mazo-de]')].map((s) => `${s.dataset.mazoDe}:${s.textContent}`).sort())
  check('debajo del campeón, «Campeón · su mazo»', filas.join() === 't-bilbao-ant:Campeón · Gardevoir ex,t-ryu:Campeón · Raging Bolt ex Ogerpon ex,t-tardeo:Campeón · Dragapult ex Dusknoir', filas.join(' | '))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1464: el móvil ──')
{
  const { ctx, page, errores } = await abrirLista({ movil: true })
  const r = await page.evaluate(() => {
    const fila = document.querySelector('.t-campeones')
    return { doc: document.documentElement.scrollWidth, w: innerWidth, desliza: fila && getComputedStyle(fila).overflowX === 'auto' && fila.scrollWidth > fila.clientWidth, puntos: document.querySelectorAll('.t-campeones-tramo .t-carteles-puntos i').length }
  })
  check('carrusel con sus puntos, sin ensanchar la página', r.desliza && r.puntos === 3 && r.doc <= r.w + 1, JSON.stringify(r))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// La ficha: una copa en persona como la Tradeitto (22 días, 12 dentro).
const inicio = new Date(Date.now() + 22 * 864e5); inicio.setHours(11, 0, 0, 0)
const COPA = { id: 't-trad', slug: 'copa-tradeitto-2', name: 'Copa Tradeitto 2', status: 'registration_open', format: 'standard', swiss_rounds: 6, swiss_bo: 1, top_cut_size: 0, round_time_minutes: 30, checkin_minutes: 15, max_players: 32, start_at: inicio.toISOString(), modalidad: 'presencial', lugar: 'Tradeitto 2', direccion: 'Hotel Occidental Bilbao', inscripcion: 'pedir', admin_id: 'admin-1', pairing_seed: 's',
  prizes: [{ puesto: '1º', premio: 'Tapete Champion + 14 sobres' }, { puesto: '2º', premio: 'Deck Box + 8 sobres' }, { puesto: '3º', premio: 'Fundas + 6 sobres' }, { puesto: 'Resto', premio: '2 sobres' }],
  description: 'La primera Copa Tradeitto.' }
const GENTE = Array.from({ length: 12 }, (_, i) => ({ id: `g${i}`, tournament_id: 't-trad', user_id: i === 0 ? 'user-1' : `p${i}`, status: 'active' }))
async function abrirFicha({ movil = false } = {}) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(([t, g]) => { window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = g; window.__FAKE_RONDAS__ = [] }, [COPA, GENTE])
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto(`${BASE}/torneo?slug=copa-tradeitto-2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}
const medirFicha = (page) => page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width) } }
  return {
    tres: ['.sala-dia', '.sala-sitio', '.sala-gente'].map((s) => r(`.sala-tres ${s}`)),
    sitio: document.querySelector('.sala-sitio')?.textContent.replace(/\s+/g, ' ').trim(),
    gente: document.querySelector('.sala-gente')?.textContent.replace(/\s+/g, ' ').trim(),
    pastillas: [...document.querySelectorAll('.sala-pastilla')].map((p) => [...p.querySelectorAll('b, small')].map((x) => x.textContent).join(' ')),
    repetido: Boolean(document.querySelector('.sala-cartel, .sala-cuenta, .sala-mascota')),
    cuenta: document.getElementById('torneoCuenta')?.textContent.replace(/\s+/g, ' ').trim(),
    escalones: [...document.querySelectorAll('.torneo-escalon')].map((e) => ({ n: e.querySelector('.torneo-escalon-medalla')?.textContent, alto: Math.round(e.getBoundingClientRect().height), b: e.querySelector('b')?.textContent })),
    cintas: [...document.querySelectorAll('.torneo-premios-cintas li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()),
    info: r('#torneoInfoCaja'), plaza: r('#torneoMiPlaza'), premios: r('#torneoPremios'),
    mas: document.getElementById('torneoInfoMas')?.contains(document.getElementById('torneoPremios')),
    qr: r('.torneo-billete-qr'),
    doc: document.documentElement.scrollWidth, w: innerWidth,
  }
})

console.log('── 1465: la ficha (PC) ──')
{
  const { ctx, page, errores } = await abrirFicha()
  const f = await medirFicha(page)
  check('día · sitio · sala en UNA fila', f.tres.every(Boolean) && new Set(f.tres.map((t) => t.y)).size === 1, JSON.stringify(f.tres))
  check('el sitio con «Cómo llegar»; la sala con «12/32» y «quedan 20»', /Tradeitto 2/.test(f.sitio) && /Cómo llegar/.test(f.sitio) && /12\/32 en la sala/.test(f.gente) && /quedan 20/.test(f.gente), `${f.sitio} | ${f.gente}`)
  check('el formato en una tira de cuatro pastillas', f.pastillas.join(' · ') === '6 rondas · Suizo sin corte · 30′ por ronda · BO1', f.pastillas.join(' · '))
  check('sin el cartel, la mascota ni las tres losas de la cuenta (1397)', !f.repetido)
  check('la cuenta atrás, en la cabecera y con minutos', /^Empieza en\s*2\d d \d+ h \d+ min$/.test(f.cuenta || ''), f.cuenta)
  check('los premios en podio: 2 · 1 · 3, el oro más alto', f.escalones.map((e) => e.n).join() === '2,1,3' && f.escalones[1].alto > f.escalones[0].alto && f.escalones[0].alto > f.escalones[2].alto, JSON.stringify(f.escalones))
  check('…con lo gordo de cada premio arriba («Tapete Champion»)', f.escalones[1].b === 'Tapete Champion', f.escalones[1].b)
  check('…y «Resto» en una cinta debajo', f.cintas.length === 1 && /Resto/.test(f.cintas[0]), f.cintas.join(' | '))
  check('«Tu plaza» al lado (a la derecha de Info, a su altura)', f.plaza && f.info && f.plaza.x > f.info.x + f.info.w - 2 && Math.abs(f.plaza.y - f.info.y) < 30, JSON.stringify({ info: f.info, plaza: f.plaza }))
  check('los premios y la descripción, en su tarjeta aparte', f.mas === true)
  check('en el PC el QR de la entrada se ve', Boolean(f.qr))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1465: la ficha (móvil) ──')
{
  const { ctx, page, errores } = await abrirFicha({ movil: true })
  const f = await medirFicha(page)
  check('«Tu plaza» antes que los premios', f.plaza && f.premios && f.plaza.y < f.premios.y, JSON.stringify({ plaza: f.plaza, premios: f.premios }))
  check('y en la primera pantalla y media (empieza antes de 1.000 px)', f.plaza && f.plaza.y < 1000, f.plaza?.y)
  check('el QR plegado hasta el día del torneo', !f.qr)
  await page.click('.torneo-billete-ver')
  await page.waitForTimeout(200)
  check('«Ver mi entrada» lo abre', await page.evaluate(() => Boolean(document.querySelector('.torneo-billete.abierto .torneo-billete-qr')?.getClientRects().length)))
  check('nada se sale de lado', f.doc <= f.w + 1, `${f.doc} > ${f.w}`)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
