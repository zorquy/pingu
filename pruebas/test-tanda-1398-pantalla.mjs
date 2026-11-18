// Tanda 1398 — «PokeDoc en modo app» en Jugar (PINGU: «lo de los mazos
// también me gusta»):
//   · /torneos: «Tu próximo torneo» es un cartel en el panel de juego, con los
//     días que faltan en una losa grande (y «HOY» el mismo día), el nombre y
//     los dos caminos; en el móvil, sin la línea de datos;
//   · /mazos: cada mazo un póster oscuro (en los dos temas) con UN botón,
//     «Probar», a lo ancho; Editar y «A un torneo» en el «⋯»; en el móvil, un
//     póster por fila con la portada grande (ya no la fila de la 1150).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const b = await chromium.launch()
for (const movil of [false, true]) {
  console.log(`── 1. /torneos (${movil ? 'móvil' : 'PC'}) ──`)
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('#torneosProximo:not([hidden]) .t-proximo-dias', { timeout: 15000 }).catch(() => {})
  const r = await p.evaluate(() => {
    const t = document.getElementById('torneosProximo')
    const dias = t?.querySelector('.t-proximo-dias')
    const fondo = t ? getComputedStyle(t).backgroundImage : ''
    const datos = t?.querySelector('.t-proximo-datos')
    return {
      dias: dias?.querySelector('b')?.textContent, rotulo: dias?.querySelector('small')?.textContent, alto: Math.round(dias?.getBoundingClientRect().height || 0),
      panel: /gradient/.test(fondo), nombre: t?.querySelector('.t-proximo-nombre')?.textContent,
      datos: datos ? getComputedStyle(datos).display !== 'none' : false,
      botones: [...(t?.querySelectorAll('.t-proximo-botones a') || [])].filter((a) => a.getClientRects().length).map((a) => a.textContent.trim()),
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  check('el cartel en el panel de juego, con los días en su losa grande', r.panel && /^\d+$/.test(r.dias || '') && /DÍAS?/.test(r.rotulo || '') && r.alto >= 60, JSON.stringify(r))
  check('el nombre del torneo y sus caminos', /Copa Delta/.test(r.nombre || '') && r.botones[0] === 'Tu lista' && r.botones.length === (movil ? 1 : 2), JSON.stringify(r.botones))
  check(movil ? 'en el móvil, sin la línea de datos' : 'en el PC, con el día, la hora y las plazas', movil ? !r.datos : r.datos)
  check('nada se sale de lado y sin errores', r.ancho && !errores.length, errores.join(' | '))
  if (!movil) {
    // La losa, en la función pura (torneos.js no se carga en node: tira de app.js).
    const l = await p.evaluate(async () => {
      const { proximoHtml } = await import('/js/torneos/torneos.js')
      const ahora = new Date(2026, 10, 18, 10, 0).getTime()
      const t = (d) => ({ slug: 'x', name: 'Copa', start_at: new Date(2026, 10, 18 + d, 18, 0).toISOString(), max_players: 8 })
      const losa = (h) => (h.match(/t-proximo-dias[^>]*><b>([^<]*)<\/b><small>([^<]*)</) || []).slice(1).join(' ')
      return [13, 1, 0].map((d) => losa(proximoHtml(t(d), 3, ahora)))
    })
    check('la losa: «13 DÍAS», «1 DÍA» y «HOY» con la hora', l.join('|') === '13 DÍAS|1 DÍA|HOY 18:00', l.join('|'))
  }
  await ctx.close()
}

for (const [movil, tema] of [[false, 'claro'], [true, 'oscuro']]) {
  console.log(`── 2. /mazos (${movil ? 'móvil' : 'PC'}, tema ${tema}) ──`)
  const ctx = await contexto(b, movil, 'user-1', tema === 'claro' ? () => { try { localStorage.setItem('pokedoc-theme', 'light') } catch {} } : null)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}/mazos`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.cm-mazo-tarjeta', { timeout: 15000 }).catch(() => {})
  const r = await p.evaluate(() => {
    const t = document.querySelector('.cm-mazo-tarjeta')
    if (!t) return null
    const rt = t.getBoundingClientRect()
    const portada = t.querySelector('.cm-mazo-portada').getBoundingClientRect()
    const probar = t.querySelector('.cm-mazo-probar')
    const rp = probar?.getBoundingClientRect()
    return {
      oscuro: /gradient/.test(getComputedStyle(t).backgroundImage),
      nombreBlanco: getComputedStyle(t.querySelector('.cm-mazo-nombre')).color === 'rgb(255, 255, 255)',
      vista: [...t.querySelectorAll('.cm-mazo-pie > a')].filter((a) => a.getClientRects().length).map((a) => a.textContent.trim()),
      probarAncho: rp ? rp.width / rt.width : 0, probarHref: probar?.getAttribute('href'),
      portadaArriba: portada.width >= rt.width - 2 && portada.height >= 120,
      meta: [...t.querySelectorAll('.cm-mazo-meta, .mz-leyenda')].some((e) => e.getClientRects().length),
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  check('el póster oscuro con el nombre en blanco', r && r.oscuro && r.nombreBlanco, JSON.stringify(r))
  check('UN botón a la vista, «Probar», a lo ancho y al laboratorio', r && r.vista.join('|') === 'Probar' && r.probarAncho > 0.6 && /^\/laboratorio\?mazo=/.test(r.probarHref || ''), JSON.stringify(r))
  check('la portada arriba a todo lo ancho y sin la letra pequeña', r && r.portadaArriba && !r.meta, JSON.stringify(r))
  await p.locator('.cm-mazo-tarjeta .cm-mazo-mas summary').first().click()
  const menu = await p.evaluate(() => [...document.querySelector('.cm-mazo-tarjeta .cm-mazo-menu').children].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()))
  check('el «⋯» lleva Editar y «A un torneo» antes que lo demás', menu[0] === 'Editar' && menu[1] === 'A un torneo', menu.join(' | '))
  check('nada se sale de lado y sin errores', r && r.ancho && !errores.length, errores.join(' | '))
  await p.screenshot({ path: `/tmp/1398-mazos-${movil ? 'movil' : 'pc'}.png` })
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLO(S)` : '\nTodo bien')
process.exit(fails ? 1 : 0)
