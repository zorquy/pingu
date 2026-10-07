// Tanda 746 — el foro como una app de mensajes (J1 de la lista de
// propuestas, elegidas por PINGU).
//
// Lo que se mira:
//   · lo puro: el trozo de un mensaje sin etiquetas ni citas, el último por
//     tema y lo que deja pasar cada chip;
//   · el índice: arriba, «Conversaciones» con los hilos de todos los foros,
//     el punto en lo que no has leído (y el enlace a lo nuevo), quién
//     escribió lo último y un trozo; los chips «Todo», «Para ti»,
//     «Siguiendo» y uno por foro, que filtran; sin cuenta no hay «Para ti»
//     ni «Siguiendo»; el índice de siempre sigue debajo;
//   · el tema: cada mensaje es una burbuja, los tuyos a la derecha con otro
//     fondo; la caja de responder se queda abajo al bajar y, en el móvil,
//     encima de la barra sin que asome nada entre las dos.
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
const filas = (page) => page.$$eval('#foroConversaciones .foro-conv', (as) => as.map((a) => ({ t: a.querySelector('b')?.textContent, href: a.getAttribute('href'), nueva: a.classList.contains('foro-conv-nueva'), punto: !!a.querySelector('.foro-conv-punto'), foro: a.querySelector('.foro-conv-foro')?.textContent, trozo: a.querySelector('.foro-conv-trozo')?.textContent, alto: a.getBoundingClientRect().height })))

console.log('── 1. Lo puro ──')
{
  // En el navegador: el módulo cuelga de app.js, que no se deja importar en Node.
  const { page, ctx } = await abrir('/foro')
  const r = await page.evaluate(async () => {
    const { fragmento, filtrar, ultimosPorTema } = await import('/js/foro-conversaciones.js')
    const temas = [{ id: 'a', board_id: 'f1', author_id: 'yo' }, { id: 'b', board_id: 'f2', author_id: 'otro' }, { id: 'c', board_id: 'f1', author_id: 'otro' }]
    const mios = new Set(['b'])
    mios.yo = 'yo'
    const ids = (l) => l.map((t) => t.id).join(',')
    const u = ultimosPorTema([{ thread_id: 't1', id: 'nuevo' }, { thread_id: 't2', id: 'b' }, { thread_id: 't1', id: 'viejo' }])
    return {
      trozo: fragmento('<blockquote>lo de antes</blockquote><p>Hola &amp; <b>adiós</b></p>'),
      corto: fragmento('a'.repeat(200), 20),
      ultimo: u.get('t1').id, cuantos: u.size,
      paraTi: ids(filtrar(temas, 'para-ti', { mios })),
      sigo: ids(filtrar(temas, 'siguiendo', { sigo: new Set(['c']) })),
      foro: ids(filtrar(temas, 'foro:f1')),
      todo: ids(filtrar(temas, 'todo')),
    }
  })
  check('el trozo quita etiquetas, citas y entidades', r.trozo === 'Hola & adiós', r.trozo)
  check('  …y recorta con puntos suspensivos', r.corto.length === 20 && r.corto.endsWith('…'))
  check('el último de cada tema es el primero que llega', r.ultimo === 'nuevo' && r.cuantos === 2)
  check('«Para ti»: donde escribiste o que abriste tú', r.paraTi === 'a,b')
  check('«Siguiendo» y por foro', r.sigo === 'c' && r.foro === 'a,c' && r.todo === 'a,b,c')
  await ctx.close()
}

console.log('── 2. El índice, con cuenta ──')
{
  const { page, ctx, errores } = await abrir('/foro')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const f = await filas(page)
  check('arriba, las conversaciones de todos los foros, la más reciente primero', f.map((x) => x.t).join('|') === '¿Esta Pikachu es legal?|Cambio Charizard|Duda con Boss', JSON.stringify(f.map((x) => x.t)))
  const orden = await page.evaluate(() => {
    const c = document.getElementById('foroConversaciones')
    const resto = [...document.querySelectorAll('#foroPrincipal > *, main section')].find((s) => s !== c && !c.contains(s) && s.getBoundingClientRect().height > 0 && c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)
    return { titulo: c.querySelector('h2')?.textContent, indiceDebajo: !!resto, foros: /Dudas de reglas/.test(document.body.innerText) && /Mercadillo/.test(document.body.innerText) }
  })
  check('  …con su título, y el índice de siempre debajo', orden.titulo === 'Conversaciones' && orden.indiceDebajo && orden.foros, JSON.stringify(orden))
  check('lo no leído lleva punto y va a lo nuevo; lo leído no', f[0].punto && f[0].nueva && /\?nuevo=1$/.test(f[0].href) && !f[1].punto && !/nuevo/.test(f[1].href), JSON.stringify(f.slice(0, 2)))
  check('cada fila dice de qué foro es y quién dijo qué (sin la cita)', f[0].foro === 'Dudas de reglas' && f[1].foro === 'Mercadillo' && f[0].trozo === 'Misty: Es de una promo vieja', JSON.stringify(f[0]))
  check('las filas se pulsan con 44 o más', f.every((x) => x.alto >= 44))
  check('una fila es UN enlace (sin enlaces dentro)', await page.$$eval('#foroConversaciones .foro-conv', (as) => as.every((a) => !a.querySelector('a'))))
  const chips = await page.$$eval('#foroConversaciones [data-conv-filtro]', (bs) => bs.map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`))
  check('chips: Todo (puesto), Para ti, Siguiendo y uno por foro', chips.join('|') === 'Todo*|Para ti|Siguiendo|Dudas de reglas|Mercadillo', chips.join('|'))
  const pulsar = async (txt) => {
    await page.click(`#foroConversaciones [data-conv-filtro]:text-is("${txt}")`)
    await page.waitForTimeout(150)
    return (await filas(page)).map((x) => x.t).join('|')
  }
  check('«Para ti»: donde has escrito', (await pulsar('Para ti')) === '¿Esta Pikachu es legal?|Cambio Charizard')
  check('  …y el chip queda marcado', (await page.getAttribute('#foroConversaciones [data-conv-filtro="para-ti"]', 'aria-pressed')) === 'true')
  check('«Siguiendo»: lo que sigues', (await pulsar('Siguiendo')) === 'Duda con Boss')
  check('un foro: solo los suyos', (await pulsar('Mercadillo')) === 'Cambio Charizard')
  check('«Todo» vuelve a enseñarlo todo', (await pulsar('Todo')).split('|').length === 3)
  await ctx.close()
}

console.log('── 3. El índice, sin cuenta ──')
{
  const { page, ctx, errores } = await abrir('/foro', { sesion: 'none' })
  const chips = await page.$$eval('#foroConversaciones [data-conv-filtro]', (bs) => bs.map((b) => b.textContent))
  check('salen las conversaciones, sin «Para ti» ni «Siguiendo» y sin puntos', errores.length === 0 && (await filas(page)).length === 3 && !chips.includes('Para ti') && !chips.includes('Siguiendo') && !(await filas(page)).some((x) => x.punto), chips.join('|') + errores.join(' | '))
  await ctx.close()
}

console.log('── 4. El tema, como un chat ──')
{
  const { page, ctx, errores } = await abrir('/tema?t=tema-1')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await page.evaluate(() => {
    const ms = [...document.querySelectorAll('.foro-mensaje')]
    const caja = document.querySelector('main')?.getBoundingClientRect() || { left: 0, right: innerWidth }
    return ms.map((a) => {
      const r = a.getBoundingClientRect()
      const c = a.querySelector('.foro-mensaje-cuerpo')
      return { mio: a.classList.contains('foro-mensaje-mio'), autor: a.dataset.autor, izq: r.left, der: r.right, ancho: r.width, fondo: getComputedStyle(c).backgroundColor, radio: getComputedStyle(c).borderTopRightRadius }
    })
  })
  const mio = m.find((x) => x.autor === 'admin-1')
  const otro = m.find((x) => x.autor === 'user-2')
  check('tres burbujas; solo la tuya lleva la marca', m.length === 3 && m.filter((x) => x.mio).length === 1 && mio?.mio, JSON.stringify(m))
  check('  …la tuya a la derecha y la de los demás a la izquierda', mio && otro && mio.izq > otro.izq + 40 && Math.abs(mio.der - otro.der) > 40, JSON.stringify({ mio, otro }))
  check('  …con otro fondo y el pico al otro lado', mio && otro && mio.fondo !== otro.fondo && mio.radio !== otro.radio, JSON.stringify({ mio, otro }))
  await page.evaluate(() => scrollTo(0, 0))
  await page.waitForTimeout(200)
  const r = await page.evaluate(() => {
    const c = document.getElementById('temaResponder')
    const b = c.getBoundingClientRect()
    return { pos: getComputedStyle(c).position, abajo: Math.round(innerHeight - b.bottom), barra: getComputedStyle(c.querySelector('.rte-toolbar') || c).display }
  })
  check('la caja de responder es pegajosa abajo y recogida (sin barra) hasta que escribes', r.pos === 'sticky' && r.barra === 'none', JSON.stringify(r))
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
  check('las burbujas no se salen de la pantalla', await page.$$eval('.foro-mensaje', (as) => as.every((a) => a.getBoundingClientRect().right <= innerWidth + 1 && a.getBoundingClientRect().left >= -1)))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
