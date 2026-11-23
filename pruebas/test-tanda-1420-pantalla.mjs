// Tanda 1420 — En Inicio, el torneo y el evento MIDEN LO MISMO (PINGU, con la
// captura: «cuando hay torneo y hay evento, son de tamaños distintos»). Las
// dos cajas de la fila ya medían igual (la rejilla las estira); lo que no
// llenaba su caja era la tarjeta de dentro: el torneo se quedaba en ~76 px y
// el evento en 64.
//   · PC con torneo y evento: misma altura y misma línea de abajo.
//   · Con el lanzamiento también en la fila, las tres iguales.
//   · En el móvil, cada una va en su fila: nada se sale de lado.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const EVENTO = { id: 'id-tradeitto', slug: 'tradeitto-2', nombre: 'Tradeitto 2', tipo: 'card_show', publicado: true, destacado: true, color: '#c62a5c', empieza: new Date(dia(26) + 'T10:00').toISOString(), termina: new Date(dia(26) + 'T20:00').toISOString(), horario: [{ dia: dia(26), desde: '10:00', hasta: '20:00' }], asistentes: [{ user_id: 'user-2' }, { user_id: 'mod-1' }] }
const TORNEO = { id: 't-tardeo', slug: 'tardeo-de-testeo', name: 'Tardeo de Testeo', status: 'registration_open', start_at: new Date(dia(2) + 'T20:00').toISOString(), max_players: null }

const b = await chromium.launch()
async function abrir(movil) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(`window.__FAKE_EVENTOS__ = ${JSON.stringify([EVENTO])}; window.__FAKE_TORNEOS__ = ${JSON.stringify([TORNEO])}`)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#torneoPortada .portada-torneo', { timeout: 15000 }).catch(() => {})
  await page.waitForSelector('#eventoPortada .portada-evento', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  return { ctx, page, errores }
}
const medir = (page) => page.evaluate(() => {
  const caja = (sel) => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r ? { y: Math.round(r.top), alto: Math.round(r.height), abajo: Math.round(r.bottom) } : null }
  const lanz = document.querySelector('#lanzamientoSeccion:not(.seccion-recogida) .lanzamiento-portada')
  return { torneo: caja('#torneoPortada .portada-torneo'), evento: caja('#eventoPortada .portada-evento'), lanzamiento: lanz ? caja('#lanzamientoSeccion .lanzamiento-portada') : null, ancho: document.documentElement.scrollWidth - innerWidth }
})

console.log('── PC ──')
{
  const { page, ctx, errores } = await abrir(false)
  const m = await medir(page)
  check('salen los dos', m.torneo && m.evento, JSON.stringify(m))
  check('en la misma fila', m.torneo && m.evento && m.torneo.y === m.evento.y, JSON.stringify(m))
  check('y miden lo mismo', m.torneo && m.evento && Math.abs(m.torneo.alto - m.evento.alto) <= 1, JSON.stringify(m))
  if (m.lanzamiento && m.lanzamiento.y === m.torneo?.y) check('el lanzamiento de la fila, también', Math.abs(m.lanzamiento.alto - m.torneo.alto) <= 1, JSON.stringify(m))
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/1420-pc.png` })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Móvil ──')
{
  const { page, ctx, errores } = await abrir(true)
  const m = await medir(page)
  check('salen los dos, uno debajo de otro', m.torneo && m.evento && m.evento.y >= m.torneo.abajo - 1, JSON.stringify(m))
  check('nada se sale de lado', m.ancho <= 1, m.ancho)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
