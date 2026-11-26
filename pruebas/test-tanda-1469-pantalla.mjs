// Tanda 1469 — el día del torneo, en «modo Hoy» (propuesta «Arena: siguientes
// mejoras», idea 5; PINGU: «adelante con todo lo recomendado»):
//   · la cuenta de la cabecera dice «Hoy · 19:00» y corre con segundos;
//   · la losa del día de la sala dice «Hoy»; la entrada (QR) abierta;
//   · en el móvil, lo que te falta («Manda tu lista», «¡Estoy!») en una barra
//     fija abajo que pulsa el botón de verdad.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const { esDiaDelTorneo, cuentaDeCabecera, cuentaConSegundos } = await import(`${REPO}/js/torneos/cabecera.js`)
  const ahora = new Date(2026, 10, 26, 16, 45, 23).getTime()
  const t = { status: 'registration_open', start_at: new Date(2026, 10, 26, 19, 0, 0).toISOString() }
  check('a las 16:45 de su día, es el día del torneo', esDiaDelTorneo(t, ahora))
  check('…pero no si es mañana a la 1:00', !esDiaDelTorneo({ ...t, start_at: new Date(2026, 10, 27, 1, 0).toISOString() }, ahora))
  check('…ni si ya ha empezado', !esDiaDelTorneo({ ...t, status: 'in_progress' }, ahora))
  check('…ni si ya pasó la hora', !esDiaDelTorneo(t, new Date(2026, 10, 26, 19, 0, 1).getTime()))
  const c = cuentaDeCabecera(t, { ahora })
  check('la cabecera: «Hoy · 19:00» y «2 h 14 min 37 s»', c?.rotulo === 'Hoy · 19:00' && c?.valor === '2 h 14 min 37 s' && c?.hoy, JSON.stringify(c))
  check('los segundos con dos cifras: «1 min 05 s», «09 s»', cuentaConSegundos(65e3) === '1 min 05 s' && cuentaConSegundos(9e3) === '09 s')
  const otro = cuentaDeCabecera({ ...t, start_at: new Date(2026, 10, 28, 19, 0).toISOString() }, { ahora })
  check('otro día, como antes (sin segundos)', !otro?.hoy && /^2 d 2 h 14 min$/.test(otro?.valor || ''), JSON.stringify(otro))
  const { salaHtml } = await import(`${REPO}/js/torneos/sala.js`)
  check('la losa del día dice «Hoy»', /class="sala-dia hoy"[^>]*><small>Hoy<\/small>/.test(salaHtml({ ...t, modalidad: 'presencial' }, [], ahora)))
}

// Hoy dentro de dos horas (si ya es tarde, la parte de pantalla no se puede
// hacer «hoy»: se avisa y se salta).
const inicio = new Date(Date.now() + 2 * 36e5)
const mismoDia = inicio.toDateString() === new Date().toDateString()
const COPA = { id: 't-hoy', slug: 'copa-de-hoy', name: 'Copa de hoy', status: 'registration_open', format: 'standard', swiss_rounds: 4, swiss_bo: 1, top_cut_size: 0, round_time_minutes: 30, checkin_minutes: 15, max_players: 16, start_at: inicio.toISOString(), modalidad: 'presencial', lugar: 'Cartas Bilbao', direccion: 'Calle Ercilla 12, Bilbao', inscripcion: 'pedir', admin_id: 'admin-1', pairing_seed: 's' }
const GENTE = Array.from({ length: 6 }, (_, i) => ({ id: `g${i}`, tournament_id: 't-hoy', user_id: i === 0 ? 'user-1' : `p${i}`, status: 'active', tcg_live_username: `j${i}` }))

const b = await chromium.launch()
async function abrir({ movil = false } = {}) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(([t, g]) => { window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = g; window.__FAKE_RONDAS__ = [] }, [COPA, GENTE])
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.goto(`${BASE}/torneo?slug=copa-de-hoy`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}

if (!mismoDia) {
  console.log('  (son más de las 22:00: la parte de pantalla necesita un torneo hoy; se salta)')
} else {
  console.log('── PC ──')
  {
    const { ctx, page, errores } = await abrir()
    const a = await page.evaluate(() => ({
      hoy: document.documentElement.hasAttribute('data-torneo-hoy'),
      cuenta: document.getElementById('torneoCuenta')?.textContent.replace(/\s+/g, ' ').trim(),
      clase: document.getElementById('torneoCuenta')?.classList.contains('hoy'),
      dia: document.querySelector('.sala-dia')?.textContent.replace(/\s+/g, ' ').trim(),
      qr: Boolean(document.querySelector('.torneo-billete.abierto .torneo-billete-qr')?.getClientRects().length),
      barra: document.getElementById('torneoHoyBarra') ? getComputedStyle(document.getElementById('torneoHoyBarra')).display : 'no',
    }))
    await page.waitForTimeout(2100)
    const despues = await page.evaluate(() => document.getElementById('torneoCuenta')?.textContent.replace(/\s+/g, ' ').trim())
    check('la raíz sabe que es el día del torneo', a.hoy)
    check('la cabecera: «Hoy · HH:MM» y la cuenta con segundos', /^Hoy · \d\d:\d\d\s*\d+ h \d+ min \d\d s$/.test(a.cuenta || '') && a.clase, a.cuenta)
    check('…y corre (a los dos segundos ya es otra)', despues && despues !== a.cuenta, `${a.cuenta} → ${despues}`)
    check('la losa del día dice «Hoy»', /^Hoy/.test(a.dia || ''), a.dia)
    check('la entrada, con su QR abierto', a.qr)
    check('en el PC no hay barra fija', a.barra === 'no' || a.barra === 'none', a.barra)
    check('sin errores', !errores.length, errores.join(' | '))
    await ctx.close()
  }
  console.log('── Móvil ──')
  {
    const { ctx, page, errores } = await abrir({ movil: true })
    const r = await page.evaluate(() => {
      const barra = document.getElementById('torneoHoyBarra')
      const rc = barra?.getBoundingClientRect()
      return {
        texto: barra?.textContent.replace(/\s+/g, ' ').trim(),
        visible: Boolean(rc && rc.height > 30 && getComputedStyle(barra).display !== 'none'),
        abajo: rc ? Math.round(innerHeight - rc.bottom) : null,
        ancho: document.documentElement.scrollWidth - innerWidth,
      }
    })
    check('abajo, lo que te falta: «Manda tu lista»', r.visible && /Te falta/.test(r.texto || '') && /Manda tu lista/.test(r.texto || ''), JSON.stringify(r))
    check('…por encima de la barra de abajo', r.abajo != null && r.abajo >= 70, r.abajo)
    check('no ensancha la página', r.ancho <= 0, r.ancho)
    await page.click('#torneoHoyBarra button')
    await page.waitForTimeout(800)
    const abierta = await page.evaluate(() => Boolean(document.querySelector('dialog[open]')))
    check('el botón de la barra abre lo mismo que «Elegir mazo»', abierta)
    check('sin errores', !errores.length, errores.join(' | '))
    await ctx.close()
  }
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ todo bien')
process.exit(fails ? 1 : 0)
