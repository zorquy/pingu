// Tanda 990 — tres cosas que PINGU vio el 2026-10-23:
//   1. El paginador del foro eran botones sin una regla de CSS (los del
//      navegador, diminutos) y uno por página. Ahora: «Anterior», las páginas
//      que importan con «…» y «Siguiente», de 44 px, y en el móvil cabe.
//   2. Fuera lo de «escribe [[Arven]]»: la pista de la caja de responder y la
//      novedad destacada (en su sitio, Parejas, con su dibujo).
//   3. Parejas más rápida: lo de la función y la mesa tapada desde el HTML
//      están en test-tanda-989.mjs.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro del paginador ──')
const P = await import(`${RAIZ}/js/paginacion.js`)
check('pocas páginas: todas', JSON.stringify(P.paginasAVer(2, 5)) === '[1,2,3,4,5]')
check('muchas: la primera, la última y las de al lado de la tuya', JSON.stringify(P.paginasAVer(5, 10)) === '[1,null,4,5,6,null,10]', JSON.stringify(P.paginasAVer(5, 10)))
check('  …y nunca más de siete casillas', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 30].every((a) => P.paginasAVer(Math.min(a, 30), 30).length <= 7))
check('en el móvil, cinco como mucho', [1, 2, 3, 5, 8, 9, 10].every((a) => P.paginasAVerEstrecho(a, 10).length <= 5 && P.paginasAVerEstrecho(a, 10).includes(a)), JSON.stringify(P.paginasAVerEstrecho(5, 10)))
check('una página sola: nada', P.paginacionHtml(1, 1) === '')
const h = P.paginacionHtml(1, 3)
check('en la primera no hay «Anterior» que pulsar, y la tuya no es un botón', !/data-pagina="0"/.test(h) && /aria-current="page">1</.test(h) && /data-pagina="2"[^>]*aria-label="Siguiente/.test(h))
check('foro.js y tema.js usan el mismo (ya no hay .page-btn)', !/page-btn/.test(leer('js/foro.js') + leer('js/tema.js')) && /from '\.\/paginacion\.js'/.test(leer('js/foro.js')) && /from '\.\/paginacion\.js'/.test(leer('js/tema.js')))

console.log('\n── 2. En un tema largo ──')
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const MENSAJES = Array.from({ length: 120 }, (_, i) => ({ id: `m${i + 1}`, thread_id: 't1', author_id: i % 2 ? 'user-1' : 'user-2', body_html: `<p>Mensaje ${i + 1}</p>`, created_at: hace(600 - i) }))
const SEM = {
  __FAKE_FOROS__: [{ id: 'f', section_id: 's', slug: 'reglas', name: 'Reglas', position: 1, post_policy: 'todos' }],
  __FAKE_SECCIONES__: [{ id: 's', name: 'Juego', position: 1 }],
  __FAKE_TEMAS__: [{ id: 't1', board_id: 'f', title: 'Un tema con muchos mensajes', author_id: 'user-2', post_count: 120, last_post_at: hace(5), created_at: hace(600) }],
  __FAKE_MENSAJES__: MENSAJES,
}
const browser = await chromium.launch()
for (const movil of [false, true]) {
  const que = movil ? 'móvil' : 'PC'
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((sem) => { window.__FAKE_SESSION__ = 'user-1'; Object.assign(window, sem) }, SEM)
  await page.goto(`${BASE}/tema/t1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#temaPaginacion .paginacion', { timeout: 15000 }).catch(() => {})
  const v = await page.evaluate(() => {
    const nav = document.querySelector('#temaPaginacion .paginacion')
    if (!nav) return null
    const vistos = [...nav.querySelectorAll('.pag-num, button.pag-flecha')].filter((e) => e.offsetParent)
    const actual = [...nav.querySelectorAll('.pag-actual')].find((e) => e.offsetParent)
    return {
      numeros: vistos.filter((e) => e.classList.contains('pag-num')).map((e) => e.textContent.trim()),
      textos: vistos.filter((e) => e.matches('button.pag-flecha')).map((e) => e.innerText.trim()),
      menor: Math.min(...vistos.map((e) => Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))),
      fondo: actual ? getComputedStyle(actual).backgroundColor : null,
      cabe: nav.getBoundingClientRect().right <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  check(`${que}: sale el paginador nuevo`, Boolean(v), 'no hay .paginacion')
  if (v) {
    check(`  …con las páginas que importan (seis páginas: ${movil ? '1 2 3 … 6' : 'todas'})`, movil ? v.numeros.join() === '1,2,3,6' : v.numeros.join() === '1,2,3,4,5,6', v.numeros.join())
    check(`  …«Siguiente»${movil ? ' como flecha sola' : ' con su texto'}`, movil ? v.textos.join() === '' : v.textos.join() === 'Siguiente', JSON.stringify(v.textos))
    check('  …todo de 44 px o más', v.menor >= 44, String(v.menor))
    check('  …la tuya en el azul de la casa', /rgb\(\s*(2[0-9]|3[0-9]|4[0-9])/.test(v.fondo || ''), v.fondo)
    check('  …y no se sale de la pantalla', v.cabe)
  }
  await page.click('#temaPaginacion button.pag-sig')
  await page.waitForFunction(() => /Mensaje 21\b/.test(document.getElementById('temaMensajes')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  const despues = await page.evaluate(() => ({ p: new URL(location.href).searchParams.get('p'), primero: document.querySelector('#temaMensajes [data-mensaje]')?.textContent || '', actual: [...document.querySelectorAll('#temaPaginacion .pag-actual')].find((e) => e.offsetParent)?.textContent, arriba: document.getElementById('temaMensajes').getBoundingClientRect().top < innerHeight }))
  check('  «Siguiente» lleva a la página 2, con su dirección, y se ve desde arriba', despues.p === '2' && /Mensaje 21\b/.test(despues.primero) && despues.actual === '2' && despues.arriba, JSON.stringify(despues))
  check('  …y ahora sí hay «Anterior»', (await page.locator('#temaPaginacion button.pag-ant').count()) === 1)
  check('  sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Fuera lo de [[Arven]] ──')
check('la caja de responder ya no lo anuncia', !/foro-ayuda-cartas/.test(leer('js/tema.js') + leer('css/foro.css')))
const nov = JSON.parse(leer('novedades.json'))
check('ninguna novedad lo promete', !/\[\[/.test(JSON.stringify(nov)))
const dest = nov.destacadas.filter((d) => d.mes === '2026-10')
check('las tres destacadas de octubre siguen, una es Parejas con su dibujo', dest.length === 3 && dest.some((d) => d.enlace === '/parejas' && d.dibujo === 'parejas'), dest.map((d) => d.titulo).join(' | '))
check('el dibujo de Parejas existe y el del foro se fue', /^\s*parejas: \(\) =>/m.test(leer('js/novedades.js')) && !/'foro-carta'/.test(leer('js/novedades.js')))
check('el carrusel de redes tampoco lo cuenta', !/\[\[Arven\]\] y sale/.test(leer('js/redes-carrusel.js')))

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
