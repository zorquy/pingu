// Tanda 1301 — el panel de Inicio A (PINGU: «me gusta la propuesta
// recomendada»): cada ficha con el color de su sección y su barra de «cuánto»,
// y la mascota que dice lo de hoy. Lo puro de hoy.js y la pantalla.
import { fraseDeHoy, barraDeLanzamiento, fichasHtml, valorHtml } from '/home/user/pingu/js/hoy.js'
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const AHORA = Date.parse('2026-11-12T15:00:00Z')

console.log('── Lo puro ──')
const manana = { name: 'Liga FDN [Oct–Dic]', slug: 'liga', start_at: '2026-11-13T18:00:00Z', jornada: 6, matchday_dates: Array(10).fill('2026-11-13') }
check('jugar mañana va primero, con la jornada y sin los corchetes', fraseDeHoy({ torneo: manana, retos: { hechos: 6, total: 6 } }, AHORA) === 'Mañana juegas la jornada 6 de Liga FDN. ¡Has hecho todos los retos de hoy!', fraseDeHoy({ torneo: manana, retos: { hechos: 6, total: 6 } }, AHORA))
check('dos frases como mucho: torneo y lo que más sube', fraseDeHoy({ torneo: manana, sube: { nombre: 'Charizard ex', pct: 147.2 }, retos: { hechos: 2, total: 6 } }, AHORA) === 'Mañana juegas la jornada 6 de Liga FDN. ¡Charizard ex sube un 147 %!')
check('retos a medias', fraseDeHoy({ retos: { hechos: 5, total: 6 } }, AHORA) === 'Te queda 1 reto de hoy.')
check('la colección, con su signo', /^Tu colección baja 3\.007,22\s€ este mes\.$/.test(fraseDeHoy({ mes: { cambio: -3007.22 } }, AHORA)), fraseDeHoy({ mes: { cambio: -3007.22 } }, AHORA))
check('un torneo dentro de una semana no se dice', fraseDeHoy({ torneo: { ...manana, start_at: '2026-11-19T18:00:00Z' } }, AHORA) === null)
check('sin nada que decir: null', fraseDeHoy({}, AHORA) === null)
check('la barra del lanzamiento: a 9 días casi llena, a 200 días casi vacía', barraDeLanzamiento('2026-11-21', AHORA) === 90 && barraDeLanzamiento('2027-06-01', AHORA) === 4)
const f = fichasHtml({ torneo: { ...manana, mio: true }, lanzamiento: { nombre: 'Flowing Fists', fecha: '2027-02-05' }, hilos: { cuenta: 0 } }, AHORA)
check('las fichas llevan su sección', /hoy-sec-aprender/.test(f) && /hoy-sec-jugar/.test(f) && /hoy-sec-cartas/.test(f) && /hoy-sec-comunidad/.test(f))
check('la liga: «jornada 6 de 10» y su barra al 60 %', /jornada 6 de 10/.test(f) && /--pct:60/.test(f))
check('el foro sin nada: «Al día»', /Al día/.test(f))
check('la colección, con el color de Colección', /hoy-valor hoy-sec-cartas/.test(valorHtml([{ dia: '2026-11-12', valor: 10 }])))

console.log('── La pantalla ──')
const b = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  const err = []
  page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  if (!movil) await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.hoy-rejilla .hoy-ficha', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => {
    const fichas = [...document.querySelectorAll('.hoy-rejilla > a')]
    return {
      secs: fichas.map((x) => [...x.classList].find((c) => c.startsWith('hoy-sec-')) || ''),
      franjas: fichas.map((x) => getComputedStyle(x, '::before').backgroundColor),
      barras: document.querySelectorAll('.hoy-rejilla .hoy-barra').length,
      globo: document.querySelector('.banda-bocadillo')?.textContent || '',
      ancho: document.documentElement.scrollWidth <= innerWidth,
    }
  })
  check(`${movil ? 'móvil' : 'PC'}: cinco fichas, cada una con su sección y su franja de color`, r.secs.length === 5 && r.secs.every(Boolean) && new Set(r.franjas).size >= 4, JSON.stringify(r.secs))
  check('  …alguna con su barra', r.barras >= 1, r.barras)
  check('  …y la mascota dice algo de hoy', r.globo.length > 10, r.globo)
  check('  …sin salirse de la pantalla y sin errores', r.ancho && !err.length, err.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
