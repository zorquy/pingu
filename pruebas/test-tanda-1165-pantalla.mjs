// Tanda 1165 — Gente, la gente primero (M1 de «PokeDoc entera»): en el PC las
// cifras son una línea bajo el lema, el top del mes (desde la 1209) el podio
// de la banda de arriba, la caja de buscar va en la fila de las pestañas (solo con
// «Gente»), el segundo título queda para el lector y la primera persona sale
// antes de 480 px. En el móvil, la tira también y la primera persona antes
// del 40 %.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const b = await chromium.launch()
const abrir = async (ruta, movil = false) => {
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  if (!movil) await p.setViewportSize({ width: 1280, height: 800 })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errores }
}
const medir = (p) => p.evaluate(() => {
  const top = (s) => Math.round(document.querySelector(s)?.getBoundingClientRect().top ?? -1)
  const cifras = [...document.querySelectorAll('.com-cifra')].map((x) => Math.round(x.getBoundingClientRect().top))
  const lupa = document.getElementById('userSearchInput')?.closest('.search-input-wrap')
  const podio = document.querySelector('.banda-s-podio')
  const banda = document.querySelector('.banda-gente')
  const h2 = document.querySelector('#ctab-users > .seccion-cabecera')
  const cs = h2 && getComputedStyle(h2)
  return {
    cifrasUnaLinea: cifras.length === 4 && new Set(cifras).size === 1,
    cifrasSinCaja: getComputedStyle(document.querySelector('.com-cifras')).borderTopWidth === '0px',
    lupaEnChips: lupa?.parentElement.id === 'communityTabs', lupaVisible: lupa && !lupa.hidden && lupa.getBoundingClientRect().width > 100,
    podioEnBanda: Boolean(podio && banda?.contains(podio)), puestos: [...document.querySelectorAll('.banda-s-puesto')].filter((x) => x.getBoundingClientRect().height > 0).length,
    banda: banda ? Math.round(banda.getBoundingClientRect().height) : 0,
    h2Lector: cs ? cs.position === 'absolute' && /inset\(50%\)/.test(cs.clipPath) : null,
    primera: top('#userDirectoryGrid > *'), vh: innerHeight,
  }
})

console.log('── PC ──')
{
  const { p, ctx, errores } = await abrir('/usuarios')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await medir(p)
  check('las cuatro cifras en una línea, sin caja', r.cifrasUnaLinea && r.cifrasSinCaja, JSON.stringify(r))
  check('la caja de buscar en la fila de las pestañas, a la vista con «Gente»', r.lupaEnChips && r.lupaVisible, JSON.stringify(r))
  check('el top del mes es el podio de la banda (1209), con sus tres puestos', r.podioEnBanda && r.puestos === 3, JSON.stringify(r))
  check('«Gente de PokeDoc» queda solo para el lector', r.h2Lector === true, JSON.stringify(r))
  check('la primera persona sale antes de 480 px', r.primera > 0 && r.primera < 480, JSON.stringify(r))
  await p.click('#communityTabs [data-ctab="guides"]')
  await p.waitForTimeout(300)
  const guias = await p.evaluate(() => { const l = document.getElementById('userSearchInput').closest('.search-input-wrap'); return { oculta: l.hidden || l.getBoundingClientRect().width === 0 } })
  check('en «Sus guías» la caja de buscar gente se esconde', guias.oculta, JSON.stringify(guias))
  await p.click('#communityTabs [data-ctab="users"]')
  await p.waitForTimeout(300)
  check('  …y vuelve con «Gente»', (await medir(p)).lupaVisible)
  await ctx.close()
}

console.log('── Móvil ──')
{
  const { p, ctx, errores } = await abrir('/usuarios', true)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await medir(p)
  check('el podio va en la banda, que es una tira baja (≤ 120 px)', r.podioEnBanda && r.puestos === 3 && r.banda > 0 && r.banda <= 120, JSON.stringify(r))
  check('la caja de buscar sigue en su panel (no en la fila de chips)', !r.lupaEnChips && r.lupaVisible, JSON.stringify(r))
  check('la primera persona antes del 40 % de la pantalla', r.primera > 0 && r.primera < r.vh * 0.4, JSON.stringify(r))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
