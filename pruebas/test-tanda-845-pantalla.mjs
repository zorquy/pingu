// Tanda 845 — la pestaña Actividad de /usuarios con lo mismo que la portada y
// más. PINGU: «en la portada se ven más cosas que hace la gente que en la
// parte de comunidad-actividad». Ahora es una lista (js/comunidad-sucesos.js),
// con filtros por tipo y «Ver más», y cuatro sucesos nuevos de la base.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { existsSync } from 'node:fs'

const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const h = (m) => new Date(ahora - m * 60000).toISOString()
const SUC = [
  { tipo: 'perfecto', fecha: h(10), username: 'misty', display_name: 'Misty', datos: {} },
  { tipo: 'inscripcion', fecha: h(25), username: 'ash', display_name: 'Ash', datos: { slug: 'otono', nombre: 'Liga de otoño' } },
  { tipo: 'respuesta', fecha: h(30), username: 'brock', display_name: 'Brock', datos: { id: 't1', titulo: '¿Qué mazo llevo al regional?' } },
  { tipo: 'mazo', fecha: h(40), username: 'brock', display_name: 'Brock', datos: { id: 'm1', nombre: 'Charizard ex' } },
  { tipo: 'sigue', fecha: h(55), username: 'laia', display_name: 'Laia', datos: { username: 'ibai', display_name: 'Ibai' } },
  { tipo: 'campeon', fecha: h(120), username: 'ibai', display_name: 'Ibai', datos: { slug: 'verano', nombre: 'Liga de verano' } },
  { tipo: 'cambio', fecha: h(200), username: 'ane', display_name: 'Ane', datos: { cartas: 12 } },
  { tipo: 'coleccion', fecha: h(1440), username: 'laia', display_name: 'Laia', datos: { set: 'base1', market: 'WEST', nombre: 'Base Set' } },
]
// Muchos más para el «Ver más»: 30 respuestas.
const MUCHOS = [...SUC, ...Array.from({ length: 30 }, (_, i) => ({ tipo: 'respuesta', fecha: h(300 + i), username: `u${i}`, display_name: `U${i}`, datos: { id: `t${i}`, titulo: `Tema ${i}` } }))]

const b = await chromium.launch()
async function abrir({ suc = SUC, movil = false } = {}) {
  const ctx = await b.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES' })
  await ctx.addInitScript((s) => { window.__FAKE_SESSION__ = 'user-1'; if (s) window.__FAKE_COMUNIDAD_SUCESOS__ = s; window.__FAKE_GUIAS__ = [{}, {}]; window.__FAKE_NOTICIAS__ = [{ title: 'Mew RGB secretas' }]; window.__FAKE_TEMAS__ = [{ title: 'Fundas mate o brillantes' }] }, suc)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/usuarios.html#activity`, { waitUntil: 'load' })
  await p.waitForTimeout(2500)
  return { p, ctx, errores }
}
const filas = (p) => p.$$eval('#activityFeed .suc-lista li', (xs) => xs.map((x) => x.innerText.replace(/\s+/g, ' ')))

console.log('── 1. Lo mismo que la portada, y lo nuevo ──')
{
  const { p, ctx, errores } = await abrir()
  check('sin errores', !errores.length, errores.join(' | '))
  const f = await filas(p)
  for (const t of ['hizo los seis retos del día', 'se apuntó a Liga de otoño', 'respondió en ¿Qué mazo llevo al regional?', 'compartió su mazo Charizard ex', 'empezó a seguir a Ibai', 'ganó el torneo Liga de verano', 'tiene 12 cartas para cambiar', 'completó Base Set']) {
    check(`  «${t}»`, f.some((x) => x.includes(t)), f.slice(0, 3).join(' / '))
  }
  check('y lo de siempre también: el tema, la guía y la noticia (de la casa, con su chapa)', f.some((x) => /abrió el tema Fundas/.test(x)) && f.some((x) => /publicó la guía/.test(x)) && (await p.locator('#activityFeed .suc-de-la-casa .suc-chapa').first().innerText()) === 'NOTICIA')
  const orden = await p.$$eval('#activityFeed .suc-lista li .suc-cuando', (xs) => xs.length)
  check('  …lo más nuevo primero (el día perfecto de hace 10 min, el primero)', /hizo los seis retos/.test(f[0]), f[0])
  const enlaces = await p.$$eval('#activityFeed .suc-lista a[href]', (xs) => xs.map((x) => x.getAttribute('href')))
  const existe = (h) => { const r = h.split('?')[0].split('#')[0]; return ['/torneo'].includes(r) || /^\/(usuario|tema|guia|noticias)\//.test(r) || existsSync(`${RAIZ}${r.endsWith('.html') ? r : `${r}.html`}`) }
  check('cada enlace lleva a una página que existe', enlaces.length > 10 && enlaces.every(existe), enlaces.filter((h) => !existe(h)).join(' '))
  check('  …y la caja de la lateral, con el mismo molde', (await p.locator('#comUltimo .suc-lista li').count()) === 5)

  console.log('── 2. Los filtros ──')
  await p.locator('[data-suc-filtro="torneos"]').click()
  await p.waitForTimeout(200)
  let g = await filas(p)
  check('«Torneos»: el campeón y la inscripción, y nada más', g.length === 2 && g.every((x) => /ganó el torneo|se apuntó a/.test(x)), g.join(' / '))
  check('  …con el filtro marcado', (await p.locator('[data-suc-filtro="torneos"]').getAttribute('aria-pressed')) === 'true')
  await p.locator('[data-suc-filtro="coleccion"]').click()
  g = await filas(p)
  check('«Colección»: la completa y las de cambiar', g.length === 2 && g.every((x) => /completó|para cambiar/.test(x)), g.join(' / '))
  await p.locator('[data-suc-filtro="gente"]').click()
  g = await filas(p)
  check('«Gente»: a quién sigue cada uno', g.length >= 1 && g.every((x) => /empezó a seguir|se unió/.test(x)), g.join(' / '))
  await p.locator('[data-suc-filtro=""]').click()
  check('«Todo» vuelve a todo', (await filas(p)).length === f.length)
  await ctx.close()
}

console.log('── 3. «Ver más» ──')
{
  const { p, ctx } = await abrir({ suc: MUCHOS })
  check('de veinte en veinte', (await filas(p)).length === 20 && (await p.locator('[data-suc-mas]').count()) === 1)
  await p.locator('[data-suc-mas]').click()
  check('  …y «Ver más» trae otras veinte', (await filas(p)).length === 40)
  await ctx.close()
}

console.log('── 4. Sin la función de la base (la migración sin correr) ──')
{
  const { p, ctx, errores } = await abrir({ suc: null })
  const f = await filas(p)
  check('lo de siempre, sin errores', f.length > 0 && !errores.length && !f.some((x) => /Charizard ex/.test(x)), errores.join(' | '))
  await ctx.close()
}

console.log('── 5. En el móvil ──')
{
  const { p, ctx } = await abrir({ movil: true })
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  const alto = await p.locator('.suc-filtros').evaluate((e) => e.getBoundingClientRect().height)
  check('no se sale de la pantalla, y los filtros en una fila que se desliza', sale <= 1 && alto < 60, `${sale}px · ${alto}px`)
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
