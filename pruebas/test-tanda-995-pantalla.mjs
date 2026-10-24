// Tanda 995 — el paginador del foro, arriba y abajo.
//
// PINGU: «en otros foros lo de la paginación siempre está arriba y abajo».
// En la lista de temas de un foro y dentro de un tema largo: los dos
// paginadores, iguales, el de arriba antes de la lista, y los dos llevan a
// la página que dicen (en un tema, viéndola desde arriba).
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 0. Lo puro ──')
const P = await import(`${RAIZ}/js/paginacion.js`)
const arriba = P.paginacionHtml(2, 3, { arriba: true })
const abajo = P.paginacionHtml(2, 3)
check('el de arriba lleva su clase y dice que es el de arriba', /class="paginacion paginacion-arriba"/.test(arriba) && /aria-label="Páginas \(arriba\): estás en la 2 de 3"/.test(arriba))
check('el de abajo, como siempre', /class="paginacion"/.test(abajo) && /aria-label="Páginas: estás en la 2 de 3"/.test(abajo))
check('con una página sola, ninguno', P.paginacionHtml(1, 1, { arriba: true }) === '')
check('tema.html tiene el hueco de arriba antes de los mensajes', /id="temaPaginacionArriba"><\/div>\s*<div id="temaMensajes">/.test(readFileSync(`${RAIZ}/tema.html`, 'utf8')))

const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const SEM = {
  __FAKE_SECCIONES__: [{ id: 's', name: 'Juego', position: 1 }],
  __FAKE_FOROS__: [{ id: 'f', section_id: 's', slug: 'reglas', name: 'Reglas', position: 1, post_policy: 'todos' }],
  __FAKE_TEMAS__: [
    { id: 't1', board_id: 'f', title: 'Un tema con muchos mensajes', author_id: 'user-2', post_count: 120, last_post_at: hace(1), created_at: hace(9000) },
    ...Array.from({ length: 44 }, (_, i) => ({ id: `x${i + 2}`, board_id: 'f', title: `Tema número ${i + 2}`, author_id: 'user-2', post_count: 1, last_post_at: hace(10 + i), created_at: hace(5000 + i) })),
  ],
  __FAKE_MENSAJES__: Array.from({ length: 120 }, (_, i) => ({ id: `m${i + 1}`, thread_id: 't1', author_id: i % 2 ? 'user-1' : 'user-2', body_html: `<p>Mensaje ${i + 1}</p>`, created_at: hace(600 - i) })),
}
const browser = await chromium.launch()
const leerPaginadores = (page, raiz) => page.evaluate((raiz) => {
  const navs = [...document.querySelectorAll(`${raiz} nav.paginacion`)]
  const lista = document.querySelector('#temaMensajes, #foroTemas')
  return navs.map((n) => ({
    arriba: n.classList.contains('paginacion-arriba'),
    antes: Boolean(lista && n.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING),
    actual: [...n.querySelectorAll('.pag-actual')].find((e) => e.offsetParent)?.textContent,
    numeros: [...n.querySelectorAll('.pag-num')].filter((e) => e.offsetParent).map((e) => e.textContent.trim()).join(),
    cabe: n.getBoundingClientRect().right <= innerWidth,
  }))
}, raiz)

for (const movil of [false, true]) {
  const que = movil ? 'móvil' : 'PC'
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript((sem) => { window.__FAKE_SESSION__ = 'user-1'; try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-push-no', JSON.stringify({ en: Date.now(), veces: 2 })) } catch {} ; Object.assign(window, sem) }, SEM)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))

  console.log(`── 1. La lista de temas (${que}) ──`)
  await page.goto(`${BASE}/foro/reglas`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#foroTemas', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  let p = await leerPaginadores(page, 'body')
  check(`${que}: dos paginadores, uno arriba de la lista y otro abajo`, p.length === 2 && p[0].arriba && p[0].antes && !p[1].arriba && !p[1].antes, JSON.stringify(p))
  check(`${que}: los dos dicen lo mismo (página 1 de 3) y caben`, p.length === 2 && p.every((x) => x.actual === '1' && x.numeros === '1,2,3' && x.cabe), JSON.stringify(p))
  if (!movil) await page.screenshot({ path: '/tmp/995-lista.png' })
  await page.click('nav.paginacion-arriba button.pag-sig')
  await page.waitForURL(/[?&]p=2/, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  p = await leerPaginadores(page, 'body')
  check(`${que}: «Siguiente» de ARRIBA lleva a la 2, y los dos lo dicen`, /[?&]p=2/.test(page.url()) && p.length === 2 && p.every((x) => x.actual === '2'), page.url() + ' ' + JSON.stringify(p))

  console.log(`── 2. Un tema largo (${que}) ──`)
  await page.goto(`${BASE}/tema/t1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#temaPaginacionArriba .paginacion', { timeout: 15000 }).catch(() => {})
  p = await leerPaginadores(page, 'main')
  check(`${que}: dos paginadores, arriba de los mensajes y abajo`, p.length === 2 && p[0].arriba && p[0].antes && !p[1].antes, JSON.stringify(p))
  check(`${que}: los dos en la página 1`, p.length === 2 && p.every((x) => x.actual === '1' && x.cabe), JSON.stringify(p))
  if (!movil) await page.screenshot({ path: '/tmp/995-tema.png' })
  await page.click('#temaPaginacionArriba button.pag-sig')
  await page.waitForFunction(() => /Mensaje 21\b/.test(document.getElementById('temaMensajes')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  const tras = await page.evaluate(() => ({ p: new URL(location.href).searchParams.get('p'), primero: document.querySelector('#temaMensajes [data-mensaje]')?.textContent || '', arriba: document.getElementById('temaMensajes').getBoundingClientRect().top < innerHeight }))
  p = await leerPaginadores(page, 'main')
  check(`${que}: «Siguiente» de arriba lleva a la 2 y los dos se repintan`, tras.p === '2' && /Mensaje 21\b/.test(tras.primero) && p.length === 2 && p.every((x) => x.actual === '2'), JSON.stringify({ tras, p }))
  await page.click('#temaPaginacion button.pag-sig')
  await page.waitForFunction(() => /Mensaje 41\b/.test(document.getElementById('temaMensajes')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  const tras2 = await page.evaluate(() => ({ p: new URL(location.href).searchParams.get('p'), arriba: document.getElementById('temaMensajes').getBoundingClientRect().top < innerHeight }))
  check(`${que}: el de abajo sigue funcionando (a la 3, vista desde arriba)`, tras2.p === '3' && tras2.arriba, JSON.stringify(tras2))
  check(`${que}: sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO BIEN')
process.exit(fails ? 1 : 0)
