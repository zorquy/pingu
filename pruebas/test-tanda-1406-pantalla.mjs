// Tanda 1406 — el «1» que se quedaba en Jugar: un aviso «Inscripciones
// abiertas» de un torneo que se BORRÓ. Al entrar en Torneos, los avisos de
// torneos que ya no existen se dan por leídos y el número se va; el de un
// torneo que sí existe se queda.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const TORNEO = { id: 't-vivo', slug: 'copa-viva', name: 'Copa viva', status: 'registration_open', format: 'swiss', admin_id: 'user-2', max_players: 32, swiss_rounds: 4, swiss_bo: 1, top_cut_size: 0, start_at: new Date(ahora + 5 * 86400e3).toISOString(), created_at: new Date(ahora - 86400e3).toISOString() }
const AVISOS = [
  { id: 'n-borrado', type: 'torneo_apertura', title: 'Inscripciones abiertas — Torneo por error', link: 'https://pokedoc.es/torneo?slug=torneo-por-error', created_at: new Date(ahora - 3600e3).toISOString() },
]
const AVISOS_CON_VIVO = [...AVISOS, { id: 'n-vivo', type: 'torneo_apertura', title: 'Inscripciones abiertas — Copa viva', link: 'https://pokedoc.es/torneo?slug=copa-viva', created_at: new Date(ahora - 1800e3).toISOString() }]

const browser = await chromium.launch()
async function abrir(movil, avisos, ruta) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.addInitScript(([t, a]) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [t]
    window.__FAKE_NOTIFICACIONES__ = a
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [TORNEO, avisos])
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { ctx, page, errores }
}
// El número de Jugar, donde se vea: la barra de abajo del móvil o la lateral.
const numeroDeJugar = (page) => page.evaluate(() => {
  const a = [...document.querySelectorAll('nav.bm > a, .lat-seccion-enlace')].find((x) => /Jugar/.test(x.textContent) && x.offsetParent !== null)
  return a?.querySelector('.sec-num')?.textContent || ''
})
const leido = (page, id) => page.evaluate((i) => !!(window.__TABLAS__?.user_notifications || []).find((n) => n.id === i)?.read_at, id)

for (const movil of [false, true]) {
  const D = movil ? 'Móvil' : 'PC'
  // En la portada se ve el número (lo que vio PINGU).
  {
    const { ctx, page } = await abrir(movil, AVISOS, '/')
    check(`${D}: en Inicio, Jugar lleva el «1» del aviso huérfano`, (await numeroDeJugar(page)) === '1', await numeroDeJugar(page))
    await ctx.close()
  }
  // Al entrar en Torneos se da por leído y el número se va.
  {
    const { ctx, page, errores } = await abrir(movil, AVISOS, '/torneos')
    check(`${D}: en Torneos, el aviso del torneo borrado queda leído`, await leido(page, 'n-borrado'))
    check(`${D}: …y Jugar se queda sin número`, (await numeroDeJugar(page)) === '', await numeroDeJugar(page))
    check(`${D}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
  // El de un torneo que SÍ existe no se toca.
  {
    const { ctx, page } = await abrir(movil, AVISOS_CON_VIVO, '/torneos')
    check(`${D}: el aviso de un torneo que existe sigue sin leer`, !(await leido(page, 'n-vivo')) && (await leido(page, 'n-borrado')))
    check(`${D}: …y Jugar lleva su «1»`, (await numeroDeJugar(page)) === '1', await numeroDeJugar(page))
    await ctx.close()
  }
}
await browser.close()
console.log(fails ? `    ❌ ${fails} fallan` : '    ✅ todo en verde')
process.exit(fails ? 1 : 0)
