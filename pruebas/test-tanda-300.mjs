// Tanda 300: la portada, en dos columnas de verdad.
//
// PINGU, sobre la 299: «la portada no ibas a tocar más? es muy parecida».
// Y tenía razón: la 299 movió la fila de arriba y de ahí para abajo la
// portada seguía siendo la torre de bloques de siempre. Esto es lo que
// faltaba de la maqueta que aprobó.
//
// Lo que se prueba:
//  · El reparto: lo que PASA en la columna ancha, lo TUYO en la
//    estrecha. Si un bloque se queda en la columna equivocada, la
//    portada vuelve a ser una torre.
//  · Los chips de tema NO llevan a categoria.html. Es el punto entero de
//    la tanda: con 16 guías en 6 categorías, entrar en una te deja en
//    una página con dos guías. Llevan a /aprender con el filtro puesto.
//  · Que /aprender sepa leer ese filtro, y que un tema que no existe no
//    deje la pantalla vacía.
//  · Y que nada de lo que ya funcionaba se haya caído por el camino.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

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
  { id: 'cat-1', slug: 'empezar', name: 'Empezar de cero', description: 'Lo básico.', order_pos: 0, guide_count: 6 },
  { id: 'cat-2', slug: 'falsas', name: 'Cartas falsas', description: 'Copias.', order_pos: 1, guide_count: 2 },
  { id: 'cat-3', slug: 'mazos', name: 'Construir mazos', description: 'Listas.', order_pos: 2, guide_count: 9 },
  // Una categoría VACÍA: no puede salir como chip, que llevaría a una
  // pantalla sin nada — el fallo que esta tanda viene a quitar.
  { id: 'cat-4', slug: 'vacia', name: 'Sin guías todavía', description: '', order_pos: 3, guide_count: 0 },
]
const GUIAS = Array.from({ length: 6 }, (_, i) => ({
  id: `guia-${i + 1}`, slug: `guia-${i + 1}`, title: `Guía número ${i + 1}`,
  description: 'Lo que vas a encontrar dentro.', kind: 'guide',
  category_id: CATS[i % 3].id, level: ['beginner', 'intermediate', 'advanced'][i % 3],
  guide_rarity: ['bronze', 'silver', 'gold', 'platinum'][i % 4],
  estimated_mins: 5 + i * 3, author_id: 'admin-1', review_status: 'published',
  published_at: new Date(ahora - (i + 1) * 86400e3).toISOString(), blocks: [],
}))
const NOTICIA = [{ id: 'n1', slug: 'mew', title: 'Mew RGB en la Celebración 30', kind: 'news', author_id: 'admin-1', review_status: 'published', published_at: new Date(ahora - 5400e3).toISOString(), blocks: [] }]
const TORNEOS = [{ id: 't1', slug: 'pachanga', name: 'La Pachanga de Otoño', status: 'registration_open', admin_id: 'admin-1', max_players: 16, swiss_rounds: 3, start_at: new Date(ahora + 2 * 86400e3).toISOString() }]
const SECCIONES = [{ id: 's1', slug: 'general', name: 'General', order_pos: 0 }]
const FOROS = [{ id: 'f1', slug: 'charla', name: 'Charla general', section_id: 's1', order_pos: 0 }]
const TEMAS = [
  { id: 'th1', slug: 'a', title: '¿Qué mazo me recomendáis para empezar?', board_id: 'f1', author_id: 'user-1', prefix: 'Duda', post_count: 24, reply_count: 24, created_at: new Date(ahora - 7200e3).toISOString(), last_post_at: new Date(ahora - 720e3).toISOString() },
  { id: 'th2', slug: 'b', title: 'Abriendo una caja de la Celebración 30', board_id: 'f1', author_id: 'user-2', post_count: 1, reply_count: 1, created_at: new Date(ahora - 3 * 3600e3).toISOString(), last_post_at: new Date(ahora - 2400e3).toISOString() },
]

const browser = await chromium.launch()
const abrir = async (url, { sesion = 'user-1', ancho = 1280, cats = CATS, torneos = TORNEOS } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, c, g, n, t, se, fo, te]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_CATEGORIAS__ = c
    window.__FAKE_GUIAS__ = g
    window.__FAKE_NOTICIAS__ = n
    window.__FAKE_TORNEOS__ = t
    window.__FAKE_SECCIONES__ = se
    window.__FAKE_FOROS__ = fo
    window.__FAKE_TEMAS__ = te
  }, [sesion, cats, GUIAS, NOTICIA, torneos, SECCIONES, FOROS, TEMAS])
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
// ¿En qué columna ha caído este bloque?
const columnaDe = (page, id) =>
  page.evaluate((i) => {
    const e = document.getElementById(i)
    if (!e) return 'no está'
    if (e.closest('.portada-lateral')) return 'lateral'
    if (e.closest('.portada-principal')) return 'principal'
    if (e.closest('.portada-hoy')) return 'hoy'
    return 'suelto'
  }, id)

console.log('\n── 1. El reparto: lo que pasa, y lo tuyo ──')
{
  const { page, errores } = await abrir('/index.html')
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  for (const [id, donde] of [
    ['retoSeccion', 'hoy'],
    ['noticiaPortadaSeccion', 'hoy'],
    ['foroVivoSeccion', 'principal'],
    ['recientesSeccion', 'principal'],
    ['temasSeccion', 'principal'],
    ['torneoPortadaSeccion', 'lateral'],
    ['primerosPasos', 'lateral'],
    ['homeActivity', 'lateral'],
    ['ligaSeccion', 'lateral'],
  ]) {
    check(`${id} → ${donde}`, (await columnaDe(page, id)) === donde, await columnaDe(page, id))
  }
  // Los dos atajos se van: con el foro ya en pantalla y la comunidad en
  // la lateral, no les quedaba trabajo.
  check('los atajos ya no están', (await page.locator('#atajosSeccion').count()) === 0)
  // Y la fila de «hoy» cuadra con el panel: si cada una llevara su
  // reparto, la portada se vería partida por la mitad.
  const bordes = await page.evaluate(() => {
    const a = document.querySelector('.reto-hoy').getBoundingClientRect().right
    const b = document.querySelector('.foro-vivo').getBoundingClientRect().right
    return [Math.round(a), Math.round(b)]
  })
  check('la fila de hoy cuadra con el panel de abajo', Math.abs(bordes[0] - bordes[1]) <= 2, bordes.join(' vs '))
  await page.close()
}

console.log('\n── 2. El torneo es una cita, no un enlace más ──')
{
  const { page } = await abrir('/index.html')
  const t = page.locator('.portada-torneo')
  check('hay tarjeta de torneo', await t.isVisible())
  check('  …con el día en grande', (await t.locator('.portada-torneo-fecha b').textContent())?.trim().length > 0)
  const mes = await t.locator('.portada-torneo-fecha span').textContent()
  check('  …y su mes', /^[A-Z]{3}$/.test((mes || '').trim()), mes)
  check('  …con botón de apuntarse', (await t.locator('.portada-torneo-boton').textContent())?.includes('Apuntarme'))
  check('  …y lleva a su ficha', /torneo\?slug=pachanga/.test((await t.getAttribute('href')) || ''), await t.getAttribute('href'))
  check('  …y ya no es una fila fina', (await page.locator('#torneoPortada .reto-tarjeta').count()) === 0)
  // Sin torneo abierto, la sección se recoge: un hueco que diga «no hay
  // torneos» solo ocupa sitio.
  const v = await abrir('/index.html', { torneos: [] })
  check('sin torneo abierto, la sección se recoge', !(await v.page.locator('#torneoPortadaSeccion').isVisible()))
  await v.page.close()
  await page.close()
}

console.log('\n── 3. Los temas NO llevan a una página vacía ──')
{
  const { page } = await abrir('/index.html')
  const chips = page.locator('.portada-tema')
  check('hay chips de tema', (await chips.count()) > 0, String(await chips.count()))
  // LO IMPORTANTE de la tanda: ni un solo enlace a categoria.html.
  const hrefs = await chips.evaluateAll((as) => as.map((a) => a.getAttribute('href')))
  check('  …y NINGUNO lleva a categoria.html', !hrefs.some((h) => /categoria/.test(h || '')), hrefs.join(' | '))
  check('  …todos llevan a /aprender con su tema', hrefs.every((h) => /aprender\.html\?tema=/.test(h || '')), hrefs.join(' | '))
  // La categoría sin guías no sale: es justo la pantalla vacía que se
  // viene a quitar.
  check('  …y la categoría sin guías no sale', !hrefs.some((h) => /tema=vacia/.test(h || '')), hrefs.join(' | '))
  // Ordenados por número de guías: un tema con una guía no va primero.
  const cuentas = await chips.locator('b').evaluateAll((bs) => bs.map((b) => Number(b.textContent)))
  check('  …y van de más guías a menos', cuentas.every((n, i) => i === 0 || cuentas[i - 1] >= n), cuentas.join(' > '))
  // El color de cada tema se queda en la pastilla del icono: es lo único
  // que hace reconocible un tema de un vistazo. En el chip entero sería
  // volver a los seis marcos de colores que quitó la 299.
  const iconos = await page.locator('.portada-tema-icono').evaluateAll((es) => es.map((e) => e.className))
  check('  …con su color en la pastilla del icono', iconos.every((c) => /icon-tint-\d/.test(c)), iconos.join(' | '))
  check('  …y no en el chip entero', !(await chips.first().evaluate((e) => e.className)).includes('icon-tint'),
    await chips.first().evaluate((e) => e.className))
  await page.close()
}

console.log('\n── 4. /aprender sabe leer el tema de la URL ──')
{
  // Se navega a la URL LIMPIA y no a /aprender.html?tema=: el servidor
  // de pruebas (`serve`) redirige .html a la limpia y por el camino se
  // come la query, cosa que Netlify no hace —no tiene ese redirect, y el
  // resto de la web enlaza con .html 61 veces—. Que el chip apunte a
  // .html se comprueba arriba, en el bloque 3.
  const { page, errores } = await abrir('/aprender?tema=mazos')
  check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  const activo = await page.locator('.aprender-chip.activa').first().textContent()
  check('el chip del tema viene ya puesto', (activo || '').includes('Construir mazos'), activo)
  const titulos = await page.locator('.guia-titulo').allTextContents()
  const deMazos = GUIAS.filter((g) => g.category_id === 'cat-3').map((g) => g.title)
  check('  …y solo se ven las suyas', titulos.length === deMazos.length && titulos.every((t) => deMazos.includes(t)),
    titulos.join(' | '))
  // Y a un clic se ven todas: la puerta no puede ser una trampa.
  await page.locator('[data-cat="todas"]').click()
  await page.waitForTimeout(300)
  check('  …y a un clic se ven todas', (await page.locator('.guia-tarjeta').count()) === GUIAS.length,
    String(await page.locator('.guia-tarjeta').count()))
  await page.close()
}
{
  // Un tema que no existe —enlace viejo, categoría borrada— no puede
  // dejar la pantalla en blanco sin explicar nada.
  const { page, errores } = await abrir('/aprender?tema=esto-no-existe')
  check('un tema que no existe no vacía la pantalla', (await page.locator('.guia-tarjeta').count()) === GUIAS.length,
    String(await page.locator('.guia-tarjeta').count()))
  check('  …ni da error', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 5. El foro dice cuánta conversación hay ──')
{
  const { page } = await abrir('/index.html')
  const cuentas = page.locator('.foro-vivo-cuenta')
  // Se exige que se VEAN, no solo que estén: un elemento escondido
  // cuenta igual, y entonces esconder la cuenta pasaría la prueba.
  check('cada tema lleva su cuenta de mensajes', (await cuentas.count()) === TEMAS.length, String(await cuentas.count()))
  check('  …y se ven', await cuentas.first().isVisible())
  check('  …con el número del tema más hablado', (await cuentas.first().locator('b').textContent())?.trim() === '24',
    await cuentas.first().locator('b').textContent())
  // Singular y plural: «1 mensajes» canta.
  const textos = await cuentas.allTextContents()
  check('  …y en singular cuando es uno', textos.some((t) => /1\s*mensaje$/.test(t.replace(/\s+/g, ' ').trim())), textos.join(' | '))
  // Y sale de la línea de texto, que es de donde venía.
  check('  …y ya no va escondida entre el nombre y la hora',
    !(await page.locator('.foro-vivo-meta').first().textContent())?.includes('mensaje'),
    await page.locator('.foro-vivo-meta').first().textContent())
  await page.close()
}

console.log('\n── 6. Las guías nuevas, con su portada ──')
{
  const { page } = await abrir('/index.html')
  // Desde la tanda 316 la portada usa la MISMA tarjeta que /aprender.
  const tarjetas = page.locator('#recentGrid .guia-tarjeta')
  check('salen cuatro guías', (await tarjetas.count()) === 4, String(await tarjetas.count()))
  check('  …cada una con su portada de color', (await page.locator('#recentGrid .guia-arte').count()) === 4)
  // El degradado sale del SLUG, no al azar: si cambiara en cada pintada
  // la rejilla parpadearía. Se comprueba recargando.
  const artes = () => page.locator('#recentGrid .guia-arte').evaluateAll((es) => es.map((e) => [...e.classList].find((c) => c.startsWith('arte-'))))
  const antes = await artes()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  check('  …y el color no cambia al recargar', JSON.stringify(antes) === JSON.stringify(await artes()), antes.join(','))
  check('  …y sale del slug, no de Math.random', !/Math\.random/.test(leer('js/app.js').match(/export function arteDe[\s\S]{0,320}/)?.[0] || 'Math.random'))
  // El degradado lo comparten /aprender y la portada: tiene que vivir en
  // la hoja que bajan las dos, no duplicado en cada una.
  check('  …y el degradado vive en la hoja compartida', /\.arte-1 \{/.test(leer('css/components.css')))
  check('  …y no duplicado en aprender.css', !/\.arte-1 \{/.test(leer('css/aprender.css')))
  check('  …ni en portada.css', !/\.arte-1 \{/.test(leer('css/portada.css')))
  // La rareza se muda del galón de la 299 a una pastilla SOBRE la
  // portada: tiene que seguir diciéndose, y en español — la columna
  // guarda «gold» y eso aquí no lo dice nadie.
  // La rareza baja de la franja a la fila de etiquetas en la tanda 316,
  // con el nivel y el curso: son las tres cómo es esta guía. Lo que
  // defiende esta comprobación —que se diga, y en español— no cambia.
  const rarezas = await page.locator('#recentGrid .guia-rareza').allTextContents()
  check('  …y cada una dice su rareza', rarezas.length === 4, String(rarezas.length))
  check('  …en español', rarezas.every((r) => /^(Bronce|Plata|Oro|Platino)$/.test(r.trim())), rarezas.join(' | '))
  await page.close()
}

console.log('\n── 7. Sin noticia, el reto se lleva la fila ──')
{
  // La fila de «hoy» pasó de flex a rejilla en esta tanda para cuadrar
  // con el panel de abajo, y una rejilla de dos columnas NO encoge sola
  // cuando falta un hijo: dejaría 320 px en blanco al lado del reto.
  // Lo arregla `.seccion-recogida` + `:has()`, y esto es lo que lo
  // vigila — es un caso que la tanda 299 ya resolvía y que este cambio
  // podía llevarse por delante.
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  await page.addInitScript(([c, g, t]) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_CATEGORIAS__ = c
    window.__FAKE_GUIAS__ = g
    window.__FAKE_NOTICIAS__ = []
    window.__FAKE_TORNEOS__ = t
  }, [CATS, GUIAS, TORNEOS])
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  check('la sección sin noticia se recoge', !(await page.locator('#noticiaPortadaSeccion').isVisible()))
  check('  …y queda marcada para el CSS',
    await page.locator('#noticiaPortadaSeccion').evaluate((e) => e.classList.contains('seccion-recogida')))
  const [fila, heroe] = await page.evaluate(() => [
    document.getElementById('portadaHoy').getBoundingClientRect().width,
    document.querySelector('.reto-hoy').getBoundingClientRect().width,
  ])
  check('  …y el reto se lleva la fila entera', heroe > fila * 0.9, `${Math.round(heroe)} de ${Math.round(fila)}`)
  await page.close()
}

console.log('\n── 8. Los primeros pasos, con su barra ──')
{
  const { page } = await abrir('/index.html')
  const panel = page.locator('#primerosPasos .primeros-pasos')
  if (await panel.count()) {
    check('el panel lleva barra de progreso', (await page.locator('.primeros-pasos-barra').count()) === 1)
    const ancho = await page.locator('.primeros-pasos-barra i').evaluate((e) => e.style.width)
    check('  …y la barra dice por dónde vas', /^\d+%$/.test(ancho), ancho)
  } else {
    check('el panel de primeros pasos no sale (ya hecho)', true)
  }
  await page.close()
}

console.log('\n── 9. Nada se sale de la pantalla ──')
{
  for (const [url, ancho, sesion] of [
    ['/index.html', 320, 'user-1'],
    ['/index.html', 320, 'none'],
    ['/index.html', 400, 'user-1'],
    ['/index.html', 1280, 'none'],
    ['/aprender?tema=mazos', 320, 'user-1'],
  ]) {
    const { page } = await abrir(url, { ancho, sesion })
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`${url} a ${ancho}px (${sesion}) no se sale`, desborde <= 1, String(desborde))
    await page.close()
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
