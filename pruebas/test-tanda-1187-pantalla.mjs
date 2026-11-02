// Tanda 1187 — la portada, la A de la propuesta con el orden de PINGU: foro y
// noticias, Aprende, los primeros pasos y, abajo del todo, la comunidad (⅔) y
// la clasificación (⅓) a la misma altura. La caja verde de retos se va del PC
// (la tarjeta «Retos de hoy» de arriba dice lo mismo) y se queda en el móvil y
// sin cuenta. La comunidad enseña los sucesos que caben al lado de la
// clasificación. Y esta vez con la clasificación DE VERDAD: la 1186 la
// cambiaba por un bloque falso y no vio que «Semana / Mes» se salía.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const clasificacion = () => {
  const p = (puesto, n, xp, tu) => ({ puesto, username: n.toLowerCase(), display_name: n, xp, ...(tu ? { tu: true } : {}) })
  window.__FAKE_CLASIFICACION__ = { semana: { jugadores: 25, ranking: [p(1, 'Sergio.M', 235), p(2, 'Manuel', 179), p(3, 'Ash', 176, true), p(4, 'RubenGP', 175), p(5, 'Unai', 169)], tu: { puesto: 3, xp: 176, faltan: 4, pasarA: 'Manuel' } } }
}
const sembrar = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const s = (tipo, m, n, datos) => ({ tipo, fecha: hace(m), username: n.toLowerCase(), display_name: n, datos })
  window.__FAKE_COMUNIDAD_SUCESOS__ = [
    s('perfecto', 6, 'Asierasti', { dia: '2026-11-02' }), s('registro', 7, 'El Visionario', {}), s('perfecto', 14, 'Sylphid', { dia: '2026-11-02' }),
    s('registro', 27, 'Teseo', {}), s('mazo', 56, 'Dra Valdis', { id: 'm1', nombre: 'Dragapult ex' }), s('perfecto', 60, 'Teseo', { dia: '2026-11-02' }),
    s('coleccion', 90, 'Laia', { set: 'base1', market: 'WEST', nombre: 'Base Set' }), s('campeon', 120, 'Ibai', { slug: 'otono', nombre: 'Liga de otoño' }),
    s('registro', 150, 'Misty', {}), s('perfecto', 200, 'Brock', { dia: '2026-11-02' }), s('registro', 260, 'Gary', {}), s('perfecto', 300, 'Oak', { dia: '2026-11-02' }),
  ]
}
const medir = (page) => page.evaluate(() => {
  const caja = (id) => { const s = document.getElementById(id); if (!s || getComputedStyle(s).display === 'none' || s.classList.contains('hidden') || s.classList.contains('seccion-recogida')) return null; const r = s.getBoundingClientRect(); const d = s.firstElementChild?.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), hDentro: d ? Math.round(d.height) : 0 } }
  return Object.fromEntries(['foroVivoSeccion', 'recientesSeccion', 'primerosPasos', 'retoSeccion', 'clasificacionSeccion', 'homeActivity'].map((id) => [id, caja(id)]))
})
const comunidad = (page) => page.evaluate(() => {
  const c = document.getElementById('homeActivityFeed')
  const lis = [...c.querySelectorAll('.suc-lista > li')]
  const vistas = lis.filter((l) => l.style.display !== 'none')
  const abajo = c.getBoundingClientRect().bottom
  return { total: lis.length, vistas: vistas.length, dentro: vistas.every((l) => l.getBoundingClientRect().bottom <= abajo + 1), sobra: Math.round(abajo - Math.max(...vistas.map((l) => l.getBoundingClientRect().bottom))) }
})
async function abrir(b, movil, quien, conClas) {
  const ctx = await contexto(b, movil, quien, sembrar)
  if (conClas) await ctx.addInitScript(clasificacion)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#homeActivityFeed .suc', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1800)
  return { ctx, page, errores }
}

const b = await chromium.launch()
console.log('── 1. El PC, con cuenta y con la clasificación ──')
{
  const { ctx, page, errores } = await abrir(b, false, 'user-1', true)
  const m = await medir(page)
  check('sin la caja verde de retos (la tarjeta de arriba dice lo mismo)', m.retoSeccion === null && (await page.locator('.hoy-retos').count()) === 1, JSON.stringify(m.retoSeccion))
  // La primera 1187 lo colgaba de «Sigue donde lo dejaste», y PINGU no lo
  // tiene: la caja verde salió a todo el ancho. Lo que manda es la tarjeta.
  await page.evaluate(() => document.getElementById('sigueSeccion').classList.add('hidden'))
  await page.waitForTimeout(200)
  check('  …también sin «Sigue donde lo dejaste»', (await medir(page)).retoSeccion === null)
  check('el orden: foro, Aprende, primeros pasos y la comunidad abajo del todo', m.foroVivoSeccion.y < m.recientesSeccion.y && m.recientesSeccion.y < m.primerosPasos.y && m.primerosPasos.y < m.homeActivity.y, JSON.stringify(m))
  const [c, k] = [m.homeActivity, m.clasificacionSeccion]
  check('comunidad y clasificación en la misma fila, la comunidad a la izquierda y el doble de ancha', c && k && c.y === k.y && c.x < k.x && Math.abs(c.w - 2 * k.w) < 40, JSON.stringify([c, k]))
  check('  …con los mismos anchos que el foro y las noticias', c.x === m.foroVivoSeccion.x && c.w === m.foroVivoSeccion.w, JSON.stringify([c, m.foroVivoSeccion]))
  check('  …y miden lo mismo: manda la clasificación', c.h === k.h && Math.abs(k.hDentro - k.h) <= 1 && Math.abs(c.hDentro - c.h) <= 1, JSON.stringify([c, k]))
  const n = await comunidad(page)
  check('la comunidad enseña las que caben, sin cortar ninguna y sin hueco de más de una línea', n.vistas >= 8 && n.dentro && n.sobra < 80, JSON.stringify(n))
  const pest = await page.evaluate(() => { const s = document.getElementById('clasificacionSeccion').getBoundingClientRect(); const t = document.querySelector('#clasificacionSeccion .pb-pestanas').getBoundingClientRect(); return { dentro: t.right <= s.right && t.left >= s.left, sobra: Math.round(s.right - t.right) } })
  check('«Semana / Mes» dentro de la caja de la clasificación', pest.dentro, JSON.stringify(pest))
  check('sin desbordar a lo ancho', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  await page.screenshot({ path: '/tmp/1187-pc.png', fullPage: true })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. El PC sin clasificación: la comunidad a lo ancho, y con sus líneas ──')
{
  const { ctx, page } = await abrir(b, false, 'user-1', false)
  const m = await medir(page)
  const n = await comunidad(page)
  check('la clasificación recogida y la comunidad a todo el ancho', m.clasificacionSeccion === null && m.homeActivity?.w === m.recientesSeccion.w, JSON.stringify(m))
  check('  …sin quedarse a cero de alto ni cortarse', m.homeActivity.h > 150 && n.vistas >= 6 && n.dentro, JSON.stringify([m.homeActivity, n]))
  await ctx.close()
}

console.log('── 3. Sin cuenta, la caja de retos sigue ──')
{
  const { ctx, page } = await abrir(b, false, 'none', false)
  const m = await medir(page)
  check('la caja de retos a la vista', m.retoSeccion !== null && m.retoSeccion.h > 60, JSON.stringify(m.retoSeccion))
  await ctx.close()
}

console.log('── 4. El móvil ──')
{
  const { ctx, page, errores } = await abrir(b, true, 'user-1', true)
  const m = await medir(page)
  check('la tira de retos sigue, arriba', m.retoSeccion !== null && m.retoSeccion.y < m.foroVivoSeccion.y, JSON.stringify(m.retoSeccion))
  check('clasificación y comunidad al final', m.clasificacionSeccion.y > m.primerosPasos.y && m.homeActivity.y > m.clasificacionSeccion.y, JSON.stringify(m))
  const n = await comunidad(page)
  check('  …con seis sucesos como mucho', n.vistas === 6, JSON.stringify(n))
  check('sin desbordar a lo ancho', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
