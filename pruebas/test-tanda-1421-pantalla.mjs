// Tanda 1421 — Meta «Por torneo» (PINGU eligió lo recomendado de «Los mazos,
// también por torneo»).
//   · El interruptor Por mazo · Por torneo está en el HTML y marca el que toca.
//   · Por torneo: los torneos del periodo, del más reciente al más viejo, con
//     su chapa, el campeón (mazo y nombre) y el Top 8 en iconos; el viejo no.
//   · Con 30 días sale el viejo; con «Oficiales», solo los oficiales.
//   · La vista va en la dirección (?ver=torneos) y vuelve a Por mazo.
//   · Cada fila lleva a /meta/torneo/<id>.
//   · En el móvil nada se sale de lado y la fila cabe; en oscuro, se lee.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { INICIO } from './datos-meta-torneos.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="16" fill="#8b5cf6"/></svg>'
const b = await chromium.launch()
async function abrir(ruta, { movil = false, oscuro = false, sinTorneos = false } = {}) {
  const ctx = await contexto(b, movil, null)
  await ctx.addInitScript(INICIO)
  if (sinTorneos) await ctx.addInitScript(() => { window.__FAKE_FILAS__.meta_torneos = [] })
  await ctx.addInitScript((t) => localStorage.setItem('pokedoc-theme', t), oscuro ? 'dark' : 'light')
  await ctx.route(/r2\.limitlesstcg\.net|limitlesstcg\.com\/.*\.png/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: SPRITE }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const filas = (page) => page.evaluate(() => [...document.querySelectorAll('#metaTorneos .mt-fila')].map((li) => ({
  nombre: li.querySelector('.mt-nombre strong')?.textContent,
  chapa: li.querySelector('.mt-chapa')?.textContent,
  campeon: li.querySelector('.mt-campeon-texto b')?.textContent,
  quien: li.querySelector('.mt-campeon-texto em')?.textContent || '',
  minis: li.querySelectorAll('.mt-mini').length,
  href: li.querySelector('a')?.getAttribute('href'),
})))

console.log('── El interruptor, desde el primer pintado ──')
{
  const { ctx, page, errores } = await abrir('/meta')
  const r = await page.evaluate(() => ({
    html: !!document.querySelector('#metaVer [data-ver="torneos"]'),
    puesto: document.querySelector('#metaVer [aria-pressed="true"]')?.dataset.ver,
    torneosOcultos: document.getElementById('metaTorneos').hidden,
    ranking: !document.querySelector('.meta-tabla').hidden,
  }))
  check('el interruptor está y marca «Por mazo»; el ranking a la vista y los torneos no', r.html && r.puesto === 'mazos' && r.torneosOcultos && r.ranking, JSON.stringify(r))
  await page.click('#metaVer [data-ver="torneos"]')
  await page.waitForTimeout(1200)
  const f = await filas(page)
  check('al pulsar «Por torneo» salen los tres del periodo, del más reciente al más viejo', f.map((x) => x.nombre).join('|') === 'Regional de Stuttgart|Liga del Friki · jornada 6|Limitless Weekly #318', JSON.stringify(f.map((x) => x.nombre)))
  check('  …con su chapa (Regional, PokeDoc, Online)', f.map((x) => x.chapa).join('|') === 'Regional|PokeDoc|Online', JSON.stringify(f.map((x) => x.chapa)))
  check('  …el campeón con su mazo y su nombre', f[0]?.campeon === 'Dragapult Dusknoir' && /Jonas Weber · DE/.test(f[0]?.quien) && f[1]?.campeon === 'Gholdengo ex', JSON.stringify(f.slice(0, 2)))
  check('  …y el Top 8 en ocho iconos', f.every((x) => x.minis === 8), JSON.stringify(f.map((x) => x.minis)))
  check('  …cada fila lleva a su ficha', f[0]?.href === '/meta/torneo/oficial-900' && f[2]?.href === '/meta/torneo/abc123', JSON.stringify(f.map((x) => x.href)))
  const v = await page.evaluate(() => ({ url: location.search, ranking: document.querySelector('.meta-tabla').hidden }))
  check('la dirección dice ?ver=torneos y el ranking se esconde', /ver=torneos/.test(v.url) && v.ranking, JSON.stringify(v))
  await page.click('#metaVer [data-ver="mazos"]')
  await page.waitForTimeout(400)
  const w = await page.evaluate(() => ({ url: location.search, ranking: !document.querySelector('.meta-tabla').hidden, torneos: document.getElementById('metaTorneos').hidden }))
  check('«Por mazo» vuelve al ranking y quita ?ver', !/ver=/.test(w.url) && w.ranking && w.torneos, JSON.stringify(w))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Los filtros valen para las dos vistas ──')
{
  const { ctx, page } = await abrir('/meta?ver=torneos&dias=30')
  const f = await filas(page)
  check('con 30 días entra el viejo (Lisboa), el último', f.length === 4 && f[3]?.nombre === 'Special Event de Lisboa', JSON.stringify(f.map((x) => x.nombre)))
  check('  …un oficial sin nombres guardados no se inventa el del campeón', f[3]?.campeon === 'Gardevoir ex' && f[3]?.quien === '', JSON.stringify(f[3]))
  check('  …y la fila lleva el periodo a la ficha', /\?dias=30$/.test(f[0]?.href || ''), f[0]?.href)
  await page.click('#metaFuente [data-fuente="oficial"]')
  await page.waitForTimeout(1200)
  const g = await filas(page)
  check('«Oficiales» deja solo los oficiales', g.length === 2 && g.every((x) => x.chapa !== 'PokeDoc' && x.chapa !== 'Online'), JSON.stringify(g.map((x) => x.nombre)))
  await ctx.close()
}

console.log('── Sin torneos de esa fuente, lo dice ──')
{
  const { ctx, page } = await abrir('/meta?ver=torneos&dias=7&fuente=pokedoc', { sinTorneos: true })
  const t = await page.evaluate(() => document.querySelector('#metaTorneos')?.textContent || '')
  check('una frase, no un hueco', /No hay torneos de PokeDoc terminados/.test(t), t.slice(0, 120))
  await ctx.close()
}

console.log('── En el móvil y en oscuro ──')
for (const oscuro of [false, true]) {
  const { ctx, page, errores } = await abrir('/meta?ver=torneos', { movil: true, oscuro })
  const r = await page.evaluate(() => {
    const fila = document.querySelector('#metaTorneos .mt-fila')
    const caja = fila?.getBoundingClientRect()
    const ver = document.getElementById('metaVer').getBoundingClientRect()
    const nombre = fila?.querySelector('.mt-nombre strong')
    const cs = nombre && getComputedStyle(nombre)
    return { ancho: document.documentElement.scrollWidth - innerWidth, fila: caja ? Math.round(caja.right) <= innerWidth : false, ver: Math.round(ver.width), anchoVentana: innerWidth, color: cs?.color, fondo: getComputedStyle(fila).backgroundColor }
  })
  check(`${oscuro ? 'oscuro' : 'claro'}: nada se sale de lado y la fila cabe`, r.ancho <= 0 && r.fila, JSON.stringify(r))
  check(`${oscuro ? 'oscuro' : 'claro'}: el interruptor va a lo ancho`, r.ver >= r.anchoVentana - 48, JSON.stringify(r))
  check(`${oscuro ? 'oscuro' : 'claro'}: el nombre no es del color del fondo`, r.color !== r.fondo, JSON.stringify(r))
  check(`${oscuro ? 'oscuro' : 'claro'}: sin errores`, !errores.length, errores.join(' | '))
  await page.screenshot({ path: `/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/1421-movil${oscuro ? '-oscuro' : ''}.png` }).catch(() => {})
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/meta?ver=torneos')
  await page.screenshot({ path: '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/1421-pc.png' }).catch(() => {})
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
