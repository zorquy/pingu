// Tanda 744 — la portada «Hoy» (J5 de la lista de propuestas, elegidas por
// PINGU): debajo del saludo, lo que vale tu colección con su línea de 30
// días y cuatro fichas —el reto, tu próximo torneo, el próximo lanzamiento
// y las respuestas en tus hilos—.
//
// Lo que se mira: las reglas puras (el cambio de 30 días solo si el
// histórico los cubre; la línea; «hoy/mañana/en N días»; el reto hecho, por
// hacer o «no se sabe»); y en la portada con cuenta, el bloque con sus
// cinco piezas y lo que dicen; que sin cuenta no sale; y que la portada
// sigue cabiendo en su presupuesto (la 299 lo pesa: esto entra por
// `import()`).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { cambioDelMes, chispaSvg, cuandoEs, fichasHtml, valorHtml } = await import(`${RAIZ}/js/hoy.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const n = (t) => String(t ?? '').replace(/ | /g, ' ')
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const AHORA = Date.parse('2026-10-07T12:00:00Z')
const dia = (d) => new Date(AHORA - d * 86400e3).toISOString().slice(0, 10)

console.log('── 1. Las reglas ──')
{
  const filas = [{ dia: dia(40), valor: 100 }, { dia: dia(31), valor: 120 }, { dia: dia(1), valor: 150 }]
  const m = cambioDelMes(filas, AHORA)
  check('el cambio de 30 días sale del punto de antes del corte', m && m.cambio === 30 && Math.round(m.pct) === 25, JSON.stringify(m))
  check('  …y sin un mes de historia, no se afirma', cambioDelMes([{ dia: dia(10), valor: 1 }, { dia: dia(1), valor: 2 }], AHORA) === null)
  check('la línea necesita dos puntos', chispaSvg([{ valor: 1 }]) === '' && /<path d="M0\.0,/.test(chispaSvg(filas)))
  check('hoy, mañana, en N días, o la fecha', cuandoEs(dia(0), AHORA) === 'hoy' && cuandoEs(new Date(AHORA + 86400e3).toISOString(), AHORA) === 'mañana' && cuandoEs(new Date(AHORA + 3 * 86400e3).toISOString(), AHORA) === 'en 3 días' && /oct/.test(cuandoEs(new Date(AHORA + 20 * 86400e3).toISOString(), AHORA)))
  const f = (x) => fichasHtml(x, AHORA)
  // Desde la 748 cada ficha es la de su maqueta (J5): lo que es en grande
  // y el detalle debajo («Reto del día · Sin hacer · 7 h»).
  check('el reto: hecho, por hacer, o «no se sabe» (sin afirmar nada)', /Hecho: 4 de 5/.test(f({ reto: { correct: 4, total: 5 } })) && /Sin hacer · \d+ h/.test(f({ reto: false })) && !/Hecho|Sin hacer/.test(f({ reto: null })))
  check('las respuestas: con cifra, «nada nuevo», o el foro a secas si no se sabe', /<b>2 respuestas<\/b>/.test(f({ respuestas: 2 })) && /Nada nuevo/.test(f({ respuestas: 0 })) && /<b>El foro<\/b>/.test(f({ respuestas: null })))
  check('el valor: sin la migración no sale; sin fotos, invita', valorHtml(null) === '' && /Empieza a llevarla/.test(valorHtml([])))
}

const browser = await chromium.launch()
async function abrir(sesion) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript((s) => {
    window.__FAKE_SESSION__ = s
    const d = (n) => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10)
    window.__FAKE_VALOR__ = [{ user_id: 'user-1', dia: d(45), valor: 200 }, { user_id: 'user-1', dia: d(31), valor: 200 }, { user_id: 'user-1', dia: d(10), valor: 220 }, { user_id: 'user-1', dia: d(1), valor: 250 }]
    window.__FAKE_RETOS__ = [{ user_id: 'user-1', correct: 4, total: 5 }]
    window.__FAKE_TORNEOS__ = [{ id: 'torneo-1', slug: 'liga-otono', name: 'Liga de otoño', status: 'registration_open', start_at: new Date(Date.now() + 2 * 86400e3).toISOString() }]
    window.__FAKE_INSCRIPCIONES__ = [{ tournament_id: 'torneo-1', user_id: 'user-1', status: 'active' }]
    window.__FAKE_SETS__ = [{ id: 'me3', name: 'Héroes Ascendentes', serie_id: 'me', market: 'WEST', release_date: new Date(Date.now() + 86400e3).toISOString().slice(0, 10) }]
    window.__FAKE_NOTIFICACIONES__ = [{ recipient_id: 'user-1', type: 'forum_reply', title: 'Te han respondido', link: '/tema/1' }, { recipient_id: 'user-1', type: 'forum_reply', title: 'Te han respondido', link: '/tema/2' }, { recipient_id: 'user-1', type: 'new_follower', title: 'Nuevo seguidor' }]
  }, sesion)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  return { page, ctx, errores }
}

console.log('── 2. La portada con cuenta ──')
{
  const { page, ctx, errores } = await abrir('user-1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const h = await page.evaluate(() => {
    const c = document.getElementById('hoyPortada')
    const b = document.getElementById('bienvenida')
    if (!c) return null
    return { debajo: !!b && b.getBoundingClientRect().bottom <= c.getBoundingClientRect().top, valor: c.querySelector('.hoy-valor')?.innerText.replace(/\s+/g, ' '), linea: !!c.querySelector('.hoy-chispa path'), fichas: [...c.querySelectorAll('.hoy-ficha')].map((a) => ({ t: a.innerText.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') })), borde: getComputedStyle(c.querySelector('.hoy-ficha')).borderTopWidth }
  })
  check('el bloque «Hoy», debajo del saludo, con su hoja', h?.debajo && h.borde === '1px', JSON.stringify(h))
  check('  …lo que vale tu colección, su cambio en 30 días y su línea', /250,00 €/.test(n(h?.valor)) && /Sube 50,00 € este mes/.test(n(h?.valor)) && h.linea, n(h?.valor))
  const t = (h?.fichas || []).map((f) => f.t).join(' | ')
  check('  …el reto, hecho hoy', /Hecho: 4 de 5/.test(t), t)
  check('  …tu próximo torneo (estás apuntado), y lleva a él', /Torneo en 2 días Liga de otoño/i.test(t) && h.fichas.some((f) => f.href === '/torneo?slug=liga-otono'), t)
  check('  …el próximo lanzamiento', /Sale mañana Héroes Ascendentes/.test(t), t)
  check('  …y las respuestas en tus hilos (solo las del foro)', /2 respuestas en tus hilos del foro/.test(t), t)
  check('todo se pulsa con 44 o más', await page.$$eval('#hoyPortada a', (as) => as.length === 5 && as.every((a) => a.getBoundingClientRect().height >= 44)))
  await ctx.close()
}

console.log('── 3. Sin cuenta ──')
{
  const { page, ctx, errores } = await abrir('none')
  check('no sale, y la portada de siempre sí', (await page.locator('#hoyPortada').count()) === 0 && (await page.locator('.hero').isVisible()) && errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
