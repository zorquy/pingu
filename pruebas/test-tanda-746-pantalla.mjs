// Tanda 746 — el foro como una app de mensajes (J1 de la lista de
// propuestas, elegidas por PINGU).
//
// Lo que se mira:
//   · lo puro: el trozo de un mensaje sin etiquetas ni citas y el último
//     por tema;
//   · la lista de temas de un foro, como conversaciones (desde la 804; en
//     la 746 era una lista aparte encima del índice, con chips): el punto
//     en lo que no has leído (y el enlace a lo nuevo), quién escribió lo
//     último y un trozo;
//   · el tema: en el móvil cada mensaje es una burbuja, los tuyos a la
//     derecha con otro fondo, y la caja de responder se queda encima de la
//     barra sin que asome nada entre las dos; en el PC (1095), un foro: la
//     columna del autor, todos del mismo lado, «Tú» en lo tuyo y la caja al
//     final.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const MUNDO = {
  __FAKE_SECCIONES__: [{ name: 'General' }],
  __FAKE_FOROS__: [
    { id: 'foro-1', slug: 'dudas', name: 'Dudas de reglas', section_id: 'seccion-1' },
    { id: 'foro-2', slug: 'mercado', name: 'Mercadillo', section_id: 'seccion-1', position: 1 },
  ],
  __FAKE_TEMAS__: [
    { id: 'tema-1', board_id: 'foro-1', title: '¿Esta Pikachu es legal?', author_id: 'user-1', post_count: 3, last_post_at: hace(5), last_post_author_id: 'user-2' },
    { id: 'tema-2', board_id: 'foro-2', title: 'Cambio Charizard', author_id: 'user-1', post_count: 2, last_post_at: hace(60), last_post_author_id: 'user-1' },
    { id: 'tema-3', board_id: 'foro-1', title: 'Duda con Boss', author_id: 'user-3', post_count: 1, last_post_at: hace(120), last_post_author_id: 'user-3' },
  ],
  __FAKE_MENSAJES__: [
    { id: 'msg-1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>Tengo una Pikachu sin marca</p>', created_at: hace(30) },
    { id: 'msg-2', thread_id: 'tema-1', author_id: 'admin-1', body_html: '<p>Enséñala por detrás</p>', created_at: hace(20) },
    { id: 'msg-3', thread_id: 'tema-1', author_id: 'user-2', body_html: '<blockquote>Enséñala</blockquote><p>Es de una promo vieja</p>', created_at: hace(5) },
    { id: 'msg-4', thread_id: 'tema-2', author_id: 'admin-1', body_html: '<p>Me interesa</p>', created_at: hace(90) },
    { id: 'msg-5', thread_id: 'tema-2', author_id: 'user-1', body_html: '<p>Te escribo</p>', created_at: hace(60) },
    { id: 'msg-6', thread_id: 'tema-3', author_id: 'user-3', body_html: '<p>¿Se puede jugar dos?</p>', created_at: hace(120) },
  ],
  // tema-2 leído después de su último mensaje; tema-1 y tema-3, no.
  __FAKE_LECTURAS__: [{ thread_id: 'tema-2', user_id: 'admin-1', last_read_at: hace(1) }],
  __FAKE_SUSCRIPCIONES__: [{ thread_id: 'tema-3', user_id: 'admin-1' }],
}

const browser = await chromium.launch()
async function abrir(ruta, { sesion = 'admin-1', movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(([s, m]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(m)) window[k] = v
  }, [sesion, MUNDO])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, ctx, errores }
}
// Desde la 804 la forma de conversación la lleva la lista de temas de CADA
// foro (el índice volvió a ser el de secciones): las filas se miran ahí.
const filas = (page) => page.$$eval('.foro-tema-conv', (fs) => fs.map((f) => ({ t: f.querySelector('h3')?.textContent.trim(), href: f.querySelector('h3 a')?.getAttribute('href'), nueva: f.classList.contains('foro-tema-nuevo'), punto: !!f.querySelector('.foro-conv-punto'), trozo: f.querySelector('.foro-conv-trozo')?.textContent.trim(), alto: f.getBoundingClientRect().height })))

console.log('── 1. Lo puro ──')
{
  // En el navegador: el módulo cuelga de app.js, que no se deja importar en Node.
  const { page, ctx } = await abrir('/foro')
  const r = await page.evaluate(async () => {
    const { fragmento, ultimosPorTema } = await import('/js/foro-conversaciones.js')
    const u = ultimosPorTema([{ thread_id: 't1', id: 'nuevo' }, { thread_id: 't2', id: 'b' }, { thread_id: 't1', id: 'viejo' }])
    return {
      trozo: fragmento('<blockquote>lo de antes</blockquote><p>Hola &amp; <b>adiós</b></p>'),
      corto: fragmento('a'.repeat(200), 20),
      ultimo: u.get('t1').id, cuantos: u.size,
    }
  })
  check('el trozo quita etiquetas, citas y entidades', r.trozo === 'Hola & adiós', r.trozo)
  check('  …y recorta con puntos suspensivos', r.corto.length === 20 && r.corto.endsWith('…'))
  check('el último de cada tema es el primero que llega', r.ultimo === 'nuevo' && r.cuantos === 2)
  await ctx.close()
}

console.log('── 2. Los temas de un foro, como conversaciones (804) ──')
{
  const { page, ctx, errores } = await abrir('/foro?f=dudas')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const f = await filas(page)
  check('los temas de ESE foro, el más reciente primero', f.map((x) => x.t).join('|') === '¿Esta Pikachu es legal?|Duda con Boss', JSON.stringify(f.map((x) => x.t)))
  check('lo no leído lleva punto y va a lo nuevo', f[0].punto && f[0].nueva && /\?nuevo=1$/.test(f[0].href), JSON.stringify(f[0]))
  check('la fila es solo el título, sin el trozo del último mensaje (966)', f[0].trozo === undefined, f[0].trozo)
  check('las filas se pulsan con 44 o más', f.every((x) => x.alto >= 44))
  await ctx.close()
}

console.log('── 3. Sin cuenta ──')
{
  const { page, ctx, errores } = await abrir('/foro?f=dudas', { sesion: 'none' })
  const f = await filas(page)
  check('salen los temas, sin puntos de no leído', errores.length === 0 && f.length === 2 && !f.some((x) => x.punto), errores.join(' | '))
  await ctx.close()
}

console.log('── 4. El tema en el PC: un foro (1095) ──')
{
  // Desde la 1095 la conversación es solo del móvil: en el PC vuelve la
  // columna del autor, todos del mismo lado, y lo tuyo se marca con «Tú».
  const { page, ctx, errores } = await abrir('/tema?t=tema-1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await page.evaluate(() => [...document.querySelectorAll('.foro-mensaje')].map((a) => {
    const r = a.getBoundingClientRect()
    const col = a.querySelector('.foro-mensaje-autor')
    const av = col.querySelector('.mini-avatar')?.getBoundingClientRect()
    const tu = col.querySelector('.foro-chapa-tu')
    return {
      mio: a.classList.contains('foro-mensaje-mio'), autor: a.dataset.autor, izq: Math.round(r.left), der: Math.round(r.right),
      columna: Math.round(col.getBoundingClientRect().width), alColado: col.getBoundingClientRect().right <= a.querySelector('.foro-mensaje-cuerpo').getBoundingClientRect().left + 1,
      avatar: Math.round(av?.width || 0), fondoCol: getComputedStyle(col).backgroundColor, tu: !!tu && getComputedStyle(tu).display !== 'none',
      cifras: [...col.querySelectorAll('.foro-autor-mensajes')].some((s) => getComputedStyle(s).display !== 'none'),
    }
  }))
  const mio = m.find((x) => x.autor === 'admin-1')
  const otro = m.find((x) => x.autor === 'user-2')
  check('tres mensajes; solo el tuyo lleva la marca', m.length === 3 && m.filter((x) => x.mio).length === 1 && mio?.mio, JSON.stringify(m))
  check('  …todos del mismo lado y del mismo ancho', mio && otro && mio.izq === otro.izq && mio.der === otro.der, JSON.stringify({ mio, otro }))
  check('  …con la columna del autor a la izquierda, avatar grande y sus cifras', m.every((x) => x.columna >= 120 && x.alColado && x.avatar >= 56 && x.cifras), JSON.stringify(m))
  check('  …lo tuyo con la columna en otro color y la chapa «Tú»; lo de los demás, sin ella', mio.tu && !otro.tu && mio.fondoCol !== otro.fondoCol, JSON.stringify({ mio, otro }))
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(200)
  const r = await page.evaluate(() => {
    const c = document.getElementById('temaResponder')
    const ms = [...document.querySelectorAll('.foro-mensaje')]
    return { pos: getComputedStyle(c).position, debajo: c.getBoundingClientRect().top >= ms.at(-1).getBoundingClientRect().bottom, barra: getComputedStyle(c.querySelector('.rte-toolbar') || c).display }
  })
  check('la caja de responder va al final del tema (no pegada) y recogida hasta que escribes', r.pos === 'static' && r.debajo && r.barra === 'none', JSON.stringify(r))
  await page.click('#temaResponder [contenteditable="true"]')
  check('  …al escribir, sale su barra', (await page.evaluate(() => getComputedStyle(document.querySelector('#temaResponder .rte-toolbar')).display)) !== 'none')
  await ctx.close()
}

console.log('── 5. El tema, en el móvil ──')
{
  // Con muchos mensajes para que haya que bajar y la caja se quede pegada.
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  const muchos = Array.from({ length: 14 }, (_, i) => ({ id: `m-${i}`, thread_id: 'tema-1', author_id: i % 3 ? 'user-2' : 'admin-1', body_html: `<p>Mensaje número ${i + 1} con algo de texto para que ocupe</p>`, created_at: hace(100 - i) }))
  await ctx.addInitScript(([m, ms]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    for (const [k, v] of Object.entries(m)) window[k] = v
    window.__FAKE_MENSAJES__ = ms
  }, [MUNDO, muchos])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const medir = () => page.evaluate(() => {
    const c = document.getElementById('temaResponder').getBoundingClientRect()
    const barra = document.querySelector('nav.bm')?.getBoundingClientRect()
    const tapa = getComputedStyle(document.getElementById('temaResponder'), '::after')
    return { conBarra: document.documentElement.classList.contains('con-barra-movil'), escondidas: document.documentElement.classList.contains('bm-escondidas'), cajaAbajo: Math.round(c.bottom), barraArriba: barra ? Math.round(barra.top) : null, alto: innerHeight, tapa: tapa.content, tapaAlto: tapa.height }
  })
  // Al bajar, la barra se esconde (la 709): la caja baja al fondo.
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(300)
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(700)
  const abajo = await medir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('al bajar se esconde la barra y la caja baja al fondo (sin hueco debajo)', abajo.conBarra && abajo.escondidas && Math.abs(abajo.cajaAbajo - abajo.alto) <= 2, JSON.stringify(abajo))
  // Al subir un poco vuelve la barra: la caja se pone justo encima.
  await page.mouse.wheel(0, -120)
  await page.waitForTimeout(700)
  const s = await medir()
  check('con la barra a la vista, la caja se queda pegada justo encima', !s.escondidas && s.barraArriba !== null && s.cajaAbajo <= s.barraArriba && s.barraArriba - s.cajaAbajo <= 24, JSON.stringify(s))
  check('  …y una banda tapa el hueco hasta la barra (no asoma el mensaje de debajo)', s.tapa !== 'none' && s.tapa !== 'normal' && parseFloat(s.tapaAlto) >= s.barraArriba - s.cajaAbajo, JSON.stringify(s))
  // En el móvil sigue siendo una conversación: lo tuyo a la derecha, con
  // otro fondo, y sin la chapa «Tú» (ya lo dice el lado).
  const lados = await page.evaluate(() => [...document.querySelectorAll('.foro-mensaje:not(.foro-mensaje-seguido)')].map((a) => ({
    mio: a.classList.contains('foro-mensaje-mio'), izq: a.getBoundingClientRect().left,
    fondo: getComputedStyle(a.querySelector('.foro-mensaje-cuerpo')).backgroundColor,
    tu: [...a.querySelectorAll('.foro-chapa-tu')].some((s) => getComputedStyle(s).display !== 'none'),
  })))
  const mioM = lados.find((x) => x.mio)
  const otroM = lados.find((x) => !x.mio)
  check('en el móvil, burbujas: la tuya a la derecha, con otro fondo y sin «Tú»', mioM && otroM && mioM.izq > otroM.izq + 10 && mioM.fondo !== otroM.fondo && !lados.some((x) => x.tu), JSON.stringify(lados))
  check('las burbujas no se salen de la pantalla', await page.$$eval('.foro-mensaje', (as) => as.every((a) => a.getBoundingClientRect().right <= innerWidth + 1 && a.getBoundingClientRect().left >= -1)))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
