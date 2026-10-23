// Tandas 842 y 843 en el navegador. PINGU: «estaría guay ver en la pantalla
// de los retos qué personas han hecho el reto de hoy, cuántas personas» y
// «tienes un banner de reto de hoy, pero te lleva a la pantalla de todos los
// retos, no solamente el reto de preguntas».
//
// 842: /retos enseña «Hoy en PokeDoc» con lo que conteste la base, se esconde
// si la RPC no está (la migración sin correr) y el interruptor escribe
// `retos_oculto`. 843: la portada con cuenta lleva la ficha «Retos de hoy N/6»
// y el bloque de los seis, con el siguiente y la gente de hoy.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hoy = new Date().toISOString().slice(0, 10)

const DIAS = Array.from({ length: 14 }, (_, i) => ({ dia: new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10), n: i + 1 }))
const COMUNIDAD = {
  dia: hoy, jugadores: 37, ayer: 30, oculto: false,
  caras: [{ username: 'misty', display_name: 'Misty' }, { username: 'ibai', display_name: 'Ibai' }],
  ranking: [
    { puesto: 1, username: 'misty', display_name: 'Misty', xp: 120, juegos: 6, racha: 9 },
    { puesto: 2, username: 'ash', display_name: 'Ash', xp: 65, juegos: 2, racha: 5, tu: true },
  ],
  tu: { puesto: 2, xp: 65, juegos: 2, username: 'ash', display_name: 'Ash' },
  porJuego: { carta: { jugadores: 30, acertaron: 21, intentos: 2.4 }, silueta: { jugadores: 25, acertaron: 20 } },
  dias: DIAS,
  rachaMax: { username: 'misty', display_name: 'Misty', dias: 9 },
}
const NUMEROS = { hoy: { carta: { aciertos: 1, total: 1, intentos: 2, acertada: true, xp: 45 }, silueta: { aciertos: 1, total: 1, intentos: 1, acertada: true, xp: 20 } }, xpHoy: 65, racha: 5, dias: {} }

const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-1', comunidad, numeros, quiz = 0, movil = false } = {}) {
  const ctx = await b.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES' })
  await ctx.addInitScript(([s, c, n, q]) => { window.__FAKE_SESSION__ = s; window.__FAKE_GUIAS__ = [{}, {}, {}, {}]; if (q) window.__FAKE_RETOS__ = [{}]; if (c) window.__FAKE_RETOS_COMUNIDAD__ = c; if (n) window.__FAKE_RETOS_NUMEROS__ = n }, [sesion, comunidad, numeros, quiz])
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'load' })
  await p.waitForTimeout(1800)
  // Desde la 989 «Hoy en PokeDoc» va en el historial plegado de /retos, y se
  // pide al abrirlo.
  if (ruta.startsWith('/retos')) {
    await p.click('#rtHistorial summary').catch(() => {})
    await p.waitForTimeout(900)
  }
  return { p, ctx, errores }
}

console.log('── 1. /retos: «Hoy en PokeDoc» ──')
{
  const { p, ctx, errores } = await abrir('/retos.html', { comunidad: COMUNIDAD })
  const sec = p.locator('#rtComunidad')
  check('la sección se ve', await sec.isVisible(), errores.join(' | '))
  check('  …con el título y las 37 personas', /Hoy en PokeDoc/.test(await sec.innerText()) && /37\s*personas han jugado hoy/.test(await sec.innerText()))
  check('  …la diferencia con ayer (+7)', /7 más que ayer|\+7/.test(await sec.innerText()), await p.locator('.rt-com-chip').innerText().catch(() => ''))
  const filas = await p.$$eval('.rt-com-fila', (fs) => fs.map((f) => f.innerText.replace(/\s+/g, ' ')))
  check('  …el ranking: Misty primera y tú segunda, rotulada «Tú»', filas.length === 2 && /Misty/.test(filas[0]) && /^2 .*Tú/.test(filas[1].trim()), filas.join(' / '))
  check('  …cada reto con su barra', (await p.locator('.rt-com-reto').count()) === 6)
  check('  …los 14 días, el último marcado como hoy', (await p.locator('.rt-com-dias i').count()) === 14 && (await p.locator('.rt-com-dias i.hoy').count()) === 1)
  check('  …la racha más larga, con nombre', /Misty · 9 días/.test(await sec.innerText()))
  const caja = p.locator('#rtComunidadSalir')
  check('  …con cuenta, el interruptor marcado (sales con tu nombre)', await caja.isChecked())
  // El doble vuelve a contestar lo mismo al repintar: lo que se mira es lo escrito.
  await caja.click()
  await p.waitForTimeout(600)
  const oculto = await p.evaluate(() => window.__TABLAS__.user_profiles.find((x) => x.id === 'user-1')?.retos_oculto)
  check('  …y al quitarlo escribe retos_oculto = true en tu perfil', oculto === true, String(oculto))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/retos.html', { sesion: 'none', comunidad: COMUNIDAD })
  check('sin cuenta se ve igual, pero sin interruptor', await p.locator('#rtComunidad').isVisible() && !(await p.locator('#rtComunidadSalir').count()))
  await ctx.close()
}
{
  const { p, ctx, errores } = await abrir('/retos.html', {})
  check('sin la migración (la RPC no existe) la sección no sale, y los retos siguen', !(await p.locator('#rtComunidad').isVisible()) && (await p.locator('#rtLista').isVisible()) && !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/retos.html', { comunidad: { ...COMUNIDAD, jugadores: 0, ayer: 0, ranking: [], caras: [], tu: null, porJuego: {}, rachaMax: null } })
  check('un día sin nadie dice «estrena tú el día», no una lista vacía', /Estrena tú el día/.test(await p.locator('#rtComunidad').innerText()))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/retos.html', { comunidad: COMUNIDAD, movil: true })
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('en el móvil no se sale de la pantalla', sale <= 1, `${sale}px`)
  await ctx.close()
}

console.log('── 2. La portada ──')
{
  const { p, ctx, errores } = await abrir('/', { comunidad: COMUNIDAD, numeros: NUMEROS })
  const ficha = p.locator('a.hoy-ficha.hoy-retos')
  check('la ficha «Retos de hoy» con 2/6 y su anillo', (await ficha.count()) === 1 && /2\/6/.test(await ficha.innerText()) && /Retos de hoy/.test(await ficha.innerText()), errores.join(' | '))
  check('  …va a /retos', (await ficha.getAttribute('href')) === '/retos')
  check('  …y ya no está la ficha vieja del reto de preguntas', !(await p.locator('a.hoy-ficha[href="/reto"]').count()))
  const casillas = await p.$$eval('.tr-casilla', (cs) => cs.map((c) => [c.getAttribute('href'), c.classList.contains('hecha')]))
  check('el bloque lleva las seis casillas, cada una a su reto', casillas.length === 6 && new Set(casillas.map((c) => c[0])).size === 6, JSON.stringify(casillas))
  check('  …con hechas exactamente las dos que ha contestado la base', casillas.filter((c) => c[1]).length === 2)
  check('  …«2 de 6 hechos», +65 XP y la racha', /2 de 6 hechos/.test(await p.locator('.tr-titular').innerText()) && /\+65 XP hoy/.test(await p.locator('.tr-chips').innerText()) && /5 días seguidos/.test(await p.locator('.tr-chips').innerText()))
  const sig = await p.locator('.tr-siguiente a.tr-jugar').getAttribute('href')
  const hechas = casillas.filter((c) => c[1]).map((c) => c[0])
  check('  …el siguiente es uno sin hacer', !!sig && !hechas.includes(sig), `${sig} ∉ ${hechas}`)
  check('  …y la gente de hoy, que lleva a /retos', /37 personas han jugado hoy/.test(await p.locator('.tr-gente').innerText()) && (await p.locator('.tr-gente').getAttribute('href')) === '/retos')
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Desde la 989 los seis son los de la base (Parejas en vez del cuestionario).
  const todos = Object.fromEntries(['carta', 'silueta', 'caro', 'ordena', 'expansion'].map((j) => [j, { aciertos: 1, total: 1, acertada: true, xp: 10 }]))
  todos.parejas = { aciertos: 6, total: 6, intentos: 8, acertada: true, xp: 20 }
  const { p, ctx } = await abrir('/', { numeros: { ...NUMEROS, hoy: todos, xpHoy: 70 } })
  check('con los seis hechos: «¡Los seis hechos!», sin «Jugar»', /Los seis hechos/.test(await p.locator('.tr-titular').innerText().catch(() => '')) && /Día perfecto/.test(await p.locator('.tr-siguiente').innerText().catch(() => '')), await p.locator('.tr-bloque').innerText().catch((e) => String(e)))
  check('  …y sin la RPC de la comunidad, el bloque sale igual sin la línea de gente', !(await p.locator('.tr-gente').count()))
  await ctx.close()
}
{
  const { p, ctx, errores } = await abrir('/', { comunidad: COMUNIDAD, numeros: NUMEROS, movil: true })
  const orden = await p.evaluate(() => {
    const r = document.getElementById('retoSeccion')?.getBoundingClientRect().top
    // Desde la 844 las guías son «Aprende».
    const g = document.getElementById('recientesSeccion')?.getBoundingClientRect().top
    return { r, g }
  })
  check('en el móvil el bloque va arriba, antes de las guías', orden.r != null && orden.g != null && orden.r < orden.g, JSON.stringify(orden))
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('  …y no se sale de la pantalla', sale <= 1 && !errores.length, `${sale}px ${errores.join(' | ')}`)
  await ctx.close()
}
{
  const { p, ctx, errores } = await abrir('/', { sesion: 'none' })
  check('sin cuenta la portada sigue sin errores y sin la ficha de retos', !errores.length && !(await p.locator('a.hoy-ficha.hoy-retos').count()), errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
