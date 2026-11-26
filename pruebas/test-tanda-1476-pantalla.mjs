// Tanda 1476 — Tus avisos de torneos (PINGU: «tengo una notificación en Jugar
// y Torneos, pero luego no tengo nada… esa notificación no la puedo borrar»).
// En /torneos salen arriba con su enlace y «Marcar como leídos», y la ficha
// de un torneo da por leídos los suyos aunque el aviso lleve `&ver=jugar`.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { datosArena, sembrarArena } from './fixture-arena.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const { casaConLaPagina } = await import(`${REPO}/js/numeros-seccion.js`)
  check('un aviso de la ficha con &ver=jugar casa con la ficha sin él', casaConLaPagina('/torneo?slug=copa&ver=jugar', { pathname: '/torneo', search: '?slug=copa', host: 'pokedoc.es' }))
  check('…pero no con otro torneo', !casaConLaPagina('/torneo?slug=copa&ver=jugar', { pathname: '/torneo', search: '?slug=otra', host: 'pokedoc.es' }))
  check('el resto sigue pidiendo todos los parámetros', !casaConLaPagina('/mi-coleccion?ver=cambios', { pathname: '/mi-coleccion', search: '?ver=mercado', host: 'pokedoc.es' }))
}

const AVISO = (id, slug, extra = {}) => ({ id, recipient_id: 'user-1', type: 'torneo_ronda', title: 'Empieza la ronda 2', body: 'Tu mesa: la 3', link: `/torneo?slug=${slug}&ver=jugar`, read_at: null, created_at: new Date().toISOString(), ...extra })
const b = await chromium.launch()
async function abrir(ruta, avisos) {
  const ctx = await contexto(b, false, 'user-1')
  await ctx.addInitScript(sembrarArena, datosArena())
  await ctx.addInitScript((av) => { window.__FAKE_NOTIFICACIONES__ = av }, avisos)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}
const d = datosArena()
const slug = d.torneos.find((t) => t.id === 't-copa').slug

console.log('── /torneos ──')
{
  const { ctx, page, errores } = await abrir('/torneos', [AVISO('a1', slug)])
  const r = await page.evaluate(() => ({
    visible: !document.getElementById('torneosAvisos').classList.contains('hidden'),
    texto: document.getElementById('torneosAvisos').textContent.replace(/\s+/g, ' ').trim(),
    href: document.querySelector('#torneosAvisos .tav-aviso')?.getAttribute('href'),
    numero: document.querySelector('.lat-seccion-enlace .sec-num, nav.bm .sec-num')?.textContent || '',
  }))
  check('el aviso sale arriba, con su título y su enlace', r.visible && /Tienes 1 aviso de torneos/.test(r.texto) && /Empieza la ronda 2/.test(r.texto) && r.href?.includes(slug), JSON.stringify(r))
  check('…y el número de Jugar lo cuenta', r.numero === '1', r.numero)
  await page.click('[data-tav-todos]')
  await page.waitForTimeout(800)
  const despues = await page.evaluate(() => ({
    visible: !document.getElementById('torneosAvisos').classList.contains('hidden'),
    numero: document.querySelector('.lat-seccion-enlace .sec-num, nav.bm .sec-num')?.textContent || '',
  }))
  check('«Marcar como leídos»: se va la caja y el número', !despues.visible && !despues.numero, JSON.stringify(despues))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/torneos', [])
  check('sin avisos, no hay caja', await page.evaluate(() => document.getElementById('torneosAvisos').classList.contains('hidden')))
  await ctx.close()
}

console.log('── La ficha da el suyo por leído ──')
{
  const { ctx, page, errores } = await abrir(`/torneo?slug=${slug}`, [AVISO('a2', slug)])
  await page.waitForTimeout(1500)
  const numero = await page.evaluate(() => document.querySelector('.lat-seccion-enlace .sec-num, nav.bm .sec-num')?.textContent || '')
  check('al abrir la ficha (sin &ver=jugar), su aviso se lee y el número se va', !numero, numero)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ todo bien')
process.exit(fails ? 1 : 0)
