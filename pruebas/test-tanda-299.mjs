// Tanda 299 (D, E y F): el foro, /aprender y la portada.
//
// PINGU: «me convence, todo perfecto, dale con todo a la vez», sobre las
// maquetas de las tres pantallas que quedaban por modernizar.
//
// Lo que se prueba no es que quede bonito —eso se mira— sino lo que el
// rediseño promete y lo que puede romper al moverlo:
//
//  · D — el foro enseña de qué se está hablando ANTES de la lista de
//    subforos, y el CSS del foro deja de bajarlo todo el mundo. Lo
//    peligroso de mover CSS de hoja es dejar una pantalla sin sus
//    reglas: eso pasó con .foro-vivo y por eso hay una prueba que
//    recorre las clases de la portada una por una.
//  · E — las guías se VEN al entrar en /aprender, sin un segundo clic,
//    y las categorías son filtros que no vuelven a la base.
//  · F — el reto abre la portada, en grande y con sus cinco puntos, y
//    la noticia va al lado; y el peso de la portada sigue cabiendo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const ahora = Date.now()

const CATS = [
  { id: 'cat-1', slug: 'empezar', name: 'Empezar de cero', description: 'Lo básico.', order_pos: 0, guide_count: 3 },
  { id: 'cat-2', slug: 'falsas', name: 'Cartas falsas', description: 'Copias y originales.', order_pos: 1, guide_count: 2 },
  { id: 'cat-3', slug: 'mazos', name: 'Construir mazos', description: 'De 60 cartas a una lista.', order_pos: 2, guide_count: 2 },
]
const NIV = ['beginner', 'intermediate', 'advanced']
const RAR = ['bronze', 'silver', 'gold', 'platinum']
const GUIAS = Array.from({ length: 7 }, (_, i) => ({
  id: `guia-${i + 1}`, slug: `guia-${i + 1}`, title: `Guía número ${i + 1}`,
  description: 'Lo que vas a encontrar dentro.',
  kind: 'guide', category_id: CATS[i % 3].id, level: NIV[i % 3], guide_rarity: RAR[i % 4],
  estimated_mins: 5 + i * 3, author_id: 'admin-1', review_status: 'published',
  published_at: new Date(ahora - (i + 1) * 86400e3).toISOString(),
  blocks: i % 2 === 0 ? [{ type: 'quiz' }, { type: 'quiz' }, { type: 'quiz' }, { type: 'quiz' }] : [],
}))
// guia-1 a medias (es la de «sigue donde lo dejaste»), guia-3 terminada.
// La guía TERMINADA es la empezada MÁS RECIENTE, a propósito: así
// «sigue donde lo dejaste» tiene que descartarla por estar terminada y
// no por ser más vieja. Al revés, quitar el filtro de `completed` no
// cambiaría el resultado y la prueba no probaría nada.
const PROGRESO = [
  { user_id: 'user-1', guide_id: 'guia-1', status: 'in_progress', current_block: 2, read_at: null, started_at: new Date(ahora - 3600e3).toISOString() },
  { user_id: 'user-1', guide_id: 'guia-3', status: 'completed', current_block: 4, read_at: new Date(ahora - 600e3).toISOString(), started_at: new Date(ahora - 600e3).toISOString() },
]
const NOTICIA = [{ id: 'n1', slug: 'mew-rgb', title: 'Mew RGB secretas en la Celebración 30', kind: 'news', cover_image: '/fotos/portada-noticia.png', author_id: 'admin-1', review_status: 'published', published_at: new Date(ahora - 5400e3).toISOString(), blocks: [] }]
const SECCIONES = [{ id: 's1', slug: 'general', name: 'General', order_pos: 0 }]
const FOROS = [
  { id: 'f1', slug: 'charla', name: 'Charla general', description: 'De todo un poco.', section_id: 's1', order_pos: 0 },
  { id: 'f2', slug: 'mazos', name: 'Mazos y listas', description: 'Enseña lo que juegas.', section_id: 's1', order_pos: 1 },
]
// CINCO temas y no tres: con tres, subir el tope de la franja de 3 a 9
// no cambiaría nada y la prueba del tope no probaría nada.
const TEMAS = [
  { id: 'th1', slug: 'a', title: '¿Qué mazo me recomendáis para empezar?', board_id: 'f1', author_id: 'user-1', prefix: 'Duda', post_count: 12, reply_count: 12, created_at: new Date(ahora - 7200e3).toISOString(), last_post_at: new Date(ahora - 600e3).toISOString() },
  { id: 'th2', slug: 'b', title: 'Abriendo una caja de la Celebración 30', board_id: 'f1', author_id: 'user-2', post_count: 5, reply_count: 5, created_at: new Date(ahora - 3 * 3600e3).toISOString(), last_post_at: new Date(ahora - 2400e3).toISOString() },
  { id: 'th3', slug: 'c', title: 'Mi lista de Charizard para el regional', board_id: 'f2', author_id: 'mod-1', prefix: 'Mazo', post_count: 3, reply_count: 3, created_at: new Date(ahora - 5 * 3600e3).toISOString(), last_post_at: new Date(ahora - 4000e3).toISOString() },
  { id: 'th4', slug: 'd', title: 'Fundas mate o brillantes para torneo', board_id: 'f1', author_id: 'user-2', post_count: 2, reply_count: 2, created_at: new Date(ahora - 7 * 3600e3).toISOString(), last_post_at: new Date(ahora - 5000e3).toISOString() },
  { id: 'th5', slug: 'e', title: 'Precios de la Celebración 30 en tiendas', board_id: 'f2', author_id: 'user-1', post_count: 2, reply_count: 2, created_at: new Date(ahora - 9 * 3600e3).toISOString(), last_post_at: new Date(ahora - 6000e3).toISOString() },
]
// El primer tema se lleva UNA RÁFAGA de mensajes recientes: son los
// cuatro más nuevos del foro. Sin eso, coger los 3 mensajes más nuevos
// sin mirar de qué tema son daría igualmente tres temas distintos y la
// prueba de «un tema por tarjeta» no probaría nada.
const MENSAJES = [
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `rafaga-${i}`, thread_id: 'th1', author_id: i % 2 ? 'user-2' : 'mod-1',
    content: 'Yo empezaría por una baraja de liga.', created_at: new Date(ahora - (600 + i * 60) * 1000).toISOString(),
  })),
  ...TEMAS.map((t, i) => ({ id: `m${i}`, thread_id: t.id, author_id: t.author_id, content: 'El primero.', created_at: t.created_at })),
  ...TEMAS.slice(1).map((t, i) => ({ id: `u${i}`, thread_id: t.id, author_id: 'user-2', content: 'Depende de para qué.', created_at: t.last_post_at })),
]

const browser = await chromium.launch()
const abrir = async (url, { sesion = 'user-1', ancho = 1280, noticias = NOTICIA, retos = [], guias = GUIAS } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, c, g, p, n, r, se, fo, te, me]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_CATEGORIAS__ = c
    window.__FAKE_GUIAS__ = g
    window.__FAKE_PROGRESO__ = p
    window.__FAKE_NOTICIAS__ = n
    window.__FAKE_RETOS__ = r
    window.__FAKE_SECCIONES__ = se
    window.__FAKE_FOROS__ = fo
    window.__FAKE_TEMAS__ = te
    window.__FAKE_MENSAJES__ = me
  }, [sesion, CATS, guias, PROGRESO, noticias, retos, SECCIONES, FOROS, TEMAS, MENSAJES])
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

console.log('\n── 1. D · El foro dice de qué se está hablando ──')
{
  const { page, errores } = await abrir('/foro.html')
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  const franja = page.locator('#foroDestacado')
  check('hay franja de lo caliente', await franja.isVisible())
  const tarjetas = franja.locator('.foro-caliente')
  const n = await tarjetas.count()
  check('  …con 3 temas, ni más ni menos', n === 3, `${n} de ${5} temas que hay`)
  // Un tema por tarjeta: si la franja repitiera el mismo tema por cada
  // mensaje suyo, el tema más hablado taparía a los demás.
  const titulos = await franja.locator('.foro-caliente-titulo').allTextContents()
  check('  …sin repetir tema', new Set(titulos).size === titulos.length, titulos.join(' | '))
  // El fallo del <a> dentro de <a>: la tarjeta tiene que ser un div, que
  // si no el navegador cierra el enlace de fuera y la caja se descoloca.
  check('  …y la tarjeta no es un enlace', await tarjetas.first().evaluate((e) => e.tagName === 'ARTICLE' || e.tagName === 'DIV'),
    await tarjetas.first().evaluate((e) => e.tagName))
  check('  …pero el título sí lleva a su tema', /tema/.test((await franja.locator('.foro-caliente-titulo').first().getAttribute('href')) || ''),
    await franja.locator('.foro-caliente-titulo').first().getAttribute('href'))
  // La franja va ARRIBA, antes de la lista de subforos: si quedara
  // debajo no cambiaría nada de lo que se ve al entrar.
  const orden = await page.evaluate(() => {
    const d = document.getElementById('foroDestacado')
    const c = document.querySelector('.foro-columnas')
    return d && c ? d.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING : 0
  })
  check('  …y va por encima de los subforos', orden !== 0)
  // Y lo que ya estaba tiene que seguir: la lista de subforos.
  check('la lista de subforos sigue ahí', (await page.locator('.foro-fila').count()) >= 2, String(await page.locator('.foro-fila').count()))
  await page.close()
}

console.log('\n── 2. D · El CSS del foro deja de bajarlo todo el mundo ──')
{
  const comp = leer('css/components.css')
  const foro = leer('css/foro.css')
  check('components.css ya no lleva las reglas del foro', !/\n\.foro-fila[,\s]/.test(comp))
  check('  …y foro.css sí', /\n\.foro-fila[,\s]/.test(foro))
  // Y en components.css no puede quedar NINGÚN @media del foro. Un
  // @media no suma especificidad, así que una regla de foro dentro de
  // uno, en components.css —que carga primero—, PIERDE contra la base
  // que ahora vive en foro.css. Así se quedó el índice del foro sin
  // apilarse en el móvil, con la lateral de 280 px saliéndose de la
  // pantalla. Las reglas de foro de fuera de un @media que quedan en
  // components.css están ahí a propósito (.foro-etiqueta y su tema
  // oscuro), y ésas mandan por especificidad.
  const dentroDeMedia = []
  for (const m of comp.matchAll(/@media[^{]*\{/g)) {
    // El cuerpo del @media: se cuentan llaves hasta cerrarlo.
    let i = m.index + m[0].length
    let nivel = 1
    while (i < comp.length && nivel > 0) {
      if (comp[i] === '{') nivel++
      else if (comp[i] === '}') nivel--
      i++
    }
    const cuerpo = comp.slice(m.index + m[0].length, i - 1)
    for (const c of cuerpo.matchAll(/\.(foro-[\w-]+)/g)) dentroDeMedia.push(c[1])
  }
  check('  …y no queda ningún @media del foro en components.css', dentroDeMedia.length === 0, [...new Set(dentroDeMedia)].join(', '))

  const gz = (t) => gzipSync(Buffer.from(t)).length
  check('  …y components.css baja de 32 KB gzip', gz(comp) < 32 * 1024, `${(gz(comp) / 1024).toFixed(1)} KB`)

  // LA PRUEBA QUE HABRÍA CAZADO EL FALLO, y que en su primera versión
  // NO LO CAZÓ ENTERO.
  //
  // La 299 movió 191 bloques de foro de components.css a foro.css.
  // Comprobé la portada («Ahora en el foro» se había quedado sin estilo)
  // y foro.html, escribí esta prueba... mirando SOLO LA PORTADA. Y la
  // vista de un tema —tema.html— no carga foro.css: el mensaje, la
  // columna del autor, las citas y las reacciones salieron a producción
  // sin una sola regla. Lo vio PINGU, no la prueba.
  //
  // Así que ahora se recorre LA WEB ENTERA: para cada página, qué clases
  // pintan su HTML y su JavaScript, y si cada una tiene regla en alguna
  // de las hojas QUE ESA PÁGINA CARGA. Se cuentan solo las que sí existen
  // en otra hoja — una clase sin regla en ninguna parte es otra cosa
  // (puede ser un gancho de JavaScript) y no un estilo perdido.
  const clasesDeTexto = (txt) => {
    const fuera = new Set()
    for (const m of txt.matchAll(/class="([^"$]*)"/g)) {
      for (const c of m[1].split(/\s+/)) if (/^[a-zA-Z][\w-]*$/.test(c)) fuera.add(c)
    }
    return fuera
  }
  const reglasDe = (rutas) => {
    const fuera = new Set()
    for (const r of rutas) {
      if (!existsSync(`${RAIZ}/${r}`)) continue
      for (const m of leer(r).matchAll(/\.([a-zA-Z][\w-]*)/g)) fuera.add(m[1])
    }
    return fuera
  }
  const todasLasHojas = readdirSync(`${RAIZ}/css`).filter((f) => f.endsWith('.css')).map((f) => `css/${f}`)
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const rotas = []
  for (const pagina of paginas) {
    const fuente = leer(pagina)
    const hojas = [...fuente.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1].replace(/^\//, ''))
    let usadas = clasesDeTexto(fuente)
    for (const m of fuente.matchAll(/<script[^>]+src="([^"]+)"/g)) {
      const js = m[1].replace(/^\//, '')
      if (existsSync(`${RAIZ}/${js}`)) usadas = new Set([...usadas, ...clasesDeTexto(leer(js))])
    }
    const tiene = reglasDe(hojas)
    const enOtra = reglasDe(todasLasHojas.filter((h) => !hojas.includes(h)))
    const huerfanas = [...usadas].filter((c) => !tiene.has(c) && enOtra.has(c))
    if (huerfanas.length) rotas.push(`${pagina}: ${huerfanas.slice(0, 6).join(', ')}`)
  }
  check(`ninguna de las ${paginas.length} páginas usa clases de una hoja que no carga`, rotas.length === 0, rotas.join(' | '))
}

console.log('\n── 3. E · Las guías se ven al entrar en /aprender ──')
{
  const { page, errores } = await abrir('/aprender.html')
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  const tarjetas = page.locator('.guia-tarjeta')
  check('las 7 guías salen sin dar un clic', (await tarjetas.count()) === 7, String(await tarjetas.count()))
  check('  …con su enlace a la guía', /guia\.html\?slug=/.test((await page.locator('.guia-tarjeta-enlace').first().getAttribute('href')) || ''))
  // La franja de seguir: el curso empezado y sin terminar más reciente.
  const seguir = page.locator('.aprender-seguir')
  check('hay «sigue donde lo dejaste»', await seguir.isVisible())
  check('  …con el curso a medias, no el terminado', (await seguir.textContent())?.includes('Guía número 1'), await seguir.textContent())
  check('  …y dice por dónde va', (await seguir.textContent())?.includes('Bloque 2 de 4'), await seguir.textContent())
  const vuelta = await page.locator('.aprender-aro').evaluate((e) => Number(getComputedStyle(e).getPropertyValue('--vuelta')))
  check('  …y el aro va a medias', vuelta > 0 && vuelta < 1, String(vuelta))
  await page.close()
}

console.log('\n── 4. E · Las categorías son filtros, y filtran sin ir a la base ──')
{
  const { page } = await abrir('/aprender.html')
  // Las consultas se cuentan con el contador del DOBLE, no con
  // page.on('request'): el doble no hace ni una petición de red, así que
  // mirar la red daría cero pasara lo que pasara — y la prueba pasaría
  // aunque el filtro volviera a la base en cada clic.
  const antes = await page.evaluate(() => window.__CONSULTAS__?.n ?? -1)
  check('el doble deja contar sus consultas', antes >= 0, String(antes))
  const chipCat = page.locator('[data-cat]:not([data-cat="todas"])').first()
  const cuenta = Number((await chipCat.locator('.aprender-chip-n').textContent()) || 0)
  await chipCat.click()
  await page.waitForTimeout(400)
  check('al pulsar una categoría quedan solo las suyas', (await page.locator('.guia-tarjeta').count()) === cuenta,
    `${await page.locator('.guia-tarjeta').count()} vs ${cuenta}`)
  const despues = await page.evaluate(() => window.__CONSULTAS__?.n ?? -1)
  check('  …sin volver a la base', despues === antes, `${antes} → ${despues}`)
  // El nivel y «sin leer» son INTERRUPTORES: volver a pulsar los quita.
  await page.locator('[data-cat="todas"]').click()
  await page.waitForTimeout(300)
  const nivel = page.locator('[data-nivel="beginner"]')
  await nivel.click()
  await page.waitForTimeout(300)
  const conNivel = await page.locator('.guia-tarjeta').count()
  check('el nivel filtra', conNivel > 0 && conNivel < 7, String(conNivel))
  await nivel.click()
  await page.waitForTimeout(300)
  check('  …y volver a pulsarlo lo quita', (await page.locator('.guia-tarjeta').count()) === 7, String(await page.locator('.guia-tarjeta').count()))
  // «Sin leer» tiene que esconder la que ya está terminada.
  await page.locator('[data-sinleer]').click()
  await page.waitForTimeout(300)
  const sinLeer = await page.locator('.guia-tarjeta').allTextContents()
  check('«Sin leer» esconde la terminada', !sinLeer.some((t) => t.includes('Guía número 3')), String(sinLeer.length))
  await page.close()
}

console.log('\n── 5. F · El reto abre la portada, en grande ──')
{
  const { page, errores } = await abrir('/index.html')
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  const fila = page.locator('#portadaHoy')
  check('hay fila de «hoy»', await fila.isVisible())
  const heroe = page.locator('.reto-hoy')
  check('  …con el héroe del reto', await heroe.isVisible())
  check('  …y la noticia al lado', await page.locator('.noticia-banner').isVisible())
  // En grande: el héroe tiene que ser bastante más alto que la fila fina
  // que era antes (84px de esqueleto).
  const alto = await heroe.evaluate((e) => e.getBoundingClientRect().height)
  check('  …y es de verdad grande', alto > 150, `${Math.round(alto)}px`)
  // Y ARRIBA: por encima del panel de dos columnas.
  const arriba = await page.evaluate(() => {
    const h = document.getElementById('portadaHoy')
    const p = document.getElementById('panelPortada')
    return h && p ? h.getBoundingClientRect().top < p.getBoundingClientRect().top : false
  })
  check('  …por encima del panel', arriba)
  // Los cinco puntos: sin jugar, los cinco vacíos.
  const puntos = page.locator('.reto-punto')
  check('salen los cinco puntos', (await puntos.count()) === 5, String(await puntos.count()))
  check('  …vacíos si no has jugado', (await page.locator('.reto-punto.acertado').count()) === 0)
  check('  …y el botón lleva al reto', /reto=hoy/.test((await page.locator('.reto-hoy-boton').getAttribute('href')) || ''),
    await page.locator('.reto-hoy-boton').getAttribute('href'))
  await page.close()
}

console.log('\n── 6. F · Los puntos cuentan lo que acertaste ──')
{
  const { page } = await abrir('/index.html', { retos: [{ user_id: 'user-1', correct: 3, total: 5, score: 30 }] })
  check('el titular da el resultado', (await page.locator('.reto-hoy-titular').textContent())?.includes('3 de 5'),
    await page.locator('.reto-hoy-titular').textContent())
  check('  …y hay 3 puntos encendidos de 5', (await page.locator('.reto-punto.acertado').count()) === 3 && (await page.locator('.reto-punto').count()) === 5)
  check('  …y el héroe se apaga', (await page.locator('.reto-hoy-hecha').count()) === 1)
  // Jugado no puede llevar otra vez al reto de hoy: se juega una vez.
  const hrefs = await page.locator('.reto-hoy a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  check('  …y ya no invita a jugar el de hoy', !hrefs.some((h) => /reto=hoy/.test(h || '')), hrefs.join(' | '))
  await page.close()
}

console.log('\n── 7. F · Sin cuenta, y sin noticia ──')
{
  const { page, errores } = await abrir('/index.html', { sesion: 'none' })
  check('sin errores de JavaScript sin cuenta', errores.length === 0, errores.join(' | '))
  check('al visitante también se le enseña el reto', await page.locator('.reto-hoy').isVisible())
  check('  …con los cinco puntos', (await page.locator('.reto-punto').count()) === 5)
  check('  …y el botón lleva a crear cuenta', /auth/.test((await page.locator('.reto-hoy-boton').getAttribute('href')) || ''),
    await page.locator('.reto-hoy-boton').getAttribute('href'))
  await page.close()
}
{
  // Sin noticia la sección se recoge y el héroe se queda la fila entera:
  // si no, media portada en blanco.
  const { page } = await abrir('/index.html', { noticias: [] })
  check('sin noticia, la sección se recoge', !(await page.locator('#noticiaPortadaSeccion').isVisible()))
  const anchos = await page.evaluate(() => {
    const f = document.getElementById('portadaHoy')
    const h = document.querySelector('.reto-hoy')
    return [f.getBoundingClientRect().width, h.getBoundingClientRect().width]
  })
  check('  …y el héroe se lleva la fila', anchos[1] > anchos[0] * 0.9, anchos.map(Math.round).join(' de '))
  await page.close()
}

console.log('\n── 8. F · El color deja de gritar en las rejillas ──')
{
  // La tanda 300 cambió DÓNDE se lee esto, no QUÉ: las seis tarjetas de
  // categoría son ahora chips de tema, y la rareza pasó del galón del
  // borde a una pastilla sobre la portada de la guía. Lo que se vigila
  // sigue siendo lo mismo — que ningún color salga de un hash y que
  // ninguno pinte el marco entero.
  const { page } = await abrir('/index.html')
  const chip = page.locator('.portada-tema').first()
  check('el tema es un chip, no una tarjeta con marco de color',
    !(await chip.evaluate((e) => e.className)).includes('icon-tint'), await chip.evaluate((e) => e.className))
  // El tinte sí, pero SOLO en la pastilla del icono.
  check('  …y el tinte se queda en la pastilla del icono',
    (await page.locator('.portada-tema-icono').first().evaluate((e) => e.className)).includes('icon-tint'))
  const fondoChip = await chip.evaluate((e) => getComputedStyle(e).backgroundColor)
  const fondoCaja = await page.evaluate(() => getComputedStyle(document.querySelector('.foro-vivo')).backgroundColor)
  check('  …y el chip es blanco como el resto de cajas', fondoChip === fondoCaja, `${fondoChip} vs ${fondoCaja}`)

  const guia = page.locator('#recentGrid .recent-card').first()
  check('la guía reciente no lleva marco de rareza', !(await guia.evaluate((e) => e.className)).includes('border-rarity'),
    await guia.evaluate((e) => e.className))
  const grosor = await guia.evaluate((e) => getComputedStyle(e).borderTopWidth)
  check('  …y su borde es fino', grosor === '1px', grosor)
  check('  …pero la rareza se sigue diciendo, sobre la portada',
    (await page.locator('#recentGrid .recent-arte .rarity-chip').count()) > 0)
  // Y en español: la columna guarda «gold» y eso no lo dice nadie aquí.
  const rareza = await page.locator('#recentGrid .rarity-chip').first().textContent()
  check('  …y en español', /Oro|Plata|Bronce|Platino/.test(rareza || ''), rareza)
  // Las .border-tint-* solo las usaba esto: si quedaron, es CSS muerto.
  check('y el CSS muerto se fue', !/\.border-tint-\d \{/.test(leer('css/style.css')))
  await page.close()
}

console.log('\n── 9. La portada sigue cabiendo en el presupuesto ──')
{
  const vistos = new Set()
  let total = 0
  const pesar = (abs) => {
    const real = resolve(abs)
    if (vistos.has(real) || !existsSync(real)) return null
    vistos.add(real)
    const b = readFileSync(real)
    total += gzipSync(b).length
    return b.toString('utf8')
  }
  const recorrer = (abs) => {
    const src = pesar(abs)
    if (src === null) return
    const base = dirname(resolve(abs))
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]/g)) {
      const r = m[1]
      if (!r.startsWith('.') && !r.startsWith('/')) continue
      recorrer(r.startsWith('/') ? resolve(RAIZ, `.${r}`) : resolve(base, r))
    }
  }
  const html = leer('index.html')
  pesar(`${RAIZ}/index.html`)
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) pesar(resolve(RAIZ, `.${m[1].startsWith('/') ? m[1] : '/' + m[1]}`))
  for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) recorrer(resolve(RAIZ, `.${m[1].startsWith('/') ? m[1] : '/' + m[1]}`))
  check('la portada cabe en 170 KB gzip', total / 1024 <= 170, `${(total / 1024).toFixed(1)} KB`)
  // Y la hoja propia de la portada tiene que estar contada: si no
  // estuviera enlazada, esta cuenta saldría bien por el motivo malo.
  check('  …con css/portada.css enlazada', /css\/portada\.css/.test(html))
}

console.log('\n── 10. Nada se sale de la pantalla ──')
{
  for (const [url, ancho] of [['/index.html', 320], ['/index.html', 400], ['/aprender.html', 320], ['/foro.html', 320]]) {
    const { page } = await abrir(url, { ancho })
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`${url} a ${ancho}px no se sale`, desborde <= 1, String(desborde))
    await page.close()
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
