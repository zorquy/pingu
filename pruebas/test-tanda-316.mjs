import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

// Tanda 316: seis cosas medidas en la portada, el foro y los torneos.
//
// Todas salieron de MIRAR el sitio corriendo, no de leer el código, y
// cada una tiene aquí la medida que la destapó.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const ahora = Date.now()

const CATS = [
  { id: 'cat-1', slug: 'empezar', name: 'Empezar de cero', order_pos: 0, guide_count: 4 },
  { id: 'cat-2', slug: 'mazos', name: 'Construir mazos', order_pos: 1, guide_count: 2 },
]
const GUIAS = Array.from({ length: 6 }, (_, i) => ({
  id: `g${i + 1}`, slug: `g${i + 1}`, title: `Guía número ${i + 1}`,
  description: 'Lo que vas a encontrar dentro.', kind: 'guide',
  category_id: CATS[i % 2].id, level: 'beginner',
  guide_rarity: ['bronze', 'silver', 'gold', 'platinum'][i % 4],
  estimated_mins: 5 + i, author_id: 'admin-1', review_status: 'published',
  published_at: new Date(ahora - (i + 1) * 86400e3).toISOString(),
  blocks: [{ type: 'quiz' }, { type: 'quiz' }],
}))
const SECCIONES = [{ id: 's1', slug: 'general', name: 'General', order_pos: 0 }]
const FOROS = [{ id: 'f1', slug: 'charla', name: 'Charla general', description: 'De todo.', section_id: 's1', order_pos: 0 }]
// Un título LARGO a propósito: es el que destapó el recorte.
const TEMAS = [
  { id: 'th1', slug: 'a', title: '¿Qué mazo me recomendáis para empezar?', board_id: 'f1', author_id: 'user-1', prefix: 'Duda', post_count: 12, reply_count: 12, created_at: new Date(ahora - 7200e3).toISOString(), last_post_at: new Date(ahora - 600e3).toISOString() },
  { id: 'th2', slug: 'b', title: 'Abriendo una caja de la Celebración 30', board_id: 'f1', author_id: 'user-2', post_count: 5, reply_count: 5, created_at: new Date(ahora - 3 * 3600e3).toISOString(), last_post_at: new Date(ahora - 2400e3).toISOString() },
  { id: 'th3', slug: 'c', title: 'Mi lista de Charizard para el regional', board_id: 'f1', author_id: 'mod-1', prefix: 'Mazo', post_count: 3, reply_count: 3, created_at: new Date(ahora - 5 * 3600e3).toISOString(), last_post_at: new Date(ahora - 4000e3).toISOString() },
]
const MENSAJES = TEMAS.map((t, i) => ({ id: `m${i}`, thread_id: t.id, author_id: t.author_id, content: 'x', created_at: t.last_post_at }))
const NOTICIAS = [{ id: 'n1', slug: 'mew', title: 'Mew RGB secretas en la Celebración 30', kind: 'news', author_id: 'admin-1', review_status: 'published', published_at: new Date(ahora - 5400e3).toISOString(), blocks: [] }]

const browser = await chromium.launch()
const abrir = async (url, ancho = 1280, extra = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(([c, g, se, fo, te, me, n, ex]) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_CATEGORIAS__ = c; window.__FAKE_GUIAS__ = g
    window.__FAKE_SECCIONES__ = se; window.__FAKE_FOROS__ = fo
    window.__FAKE_TEMAS__ = te; window.__FAKE_MENSAJES__ = me
    window.__FAKE_NOTICIAS__ = n; window.__FAKE_RETOS__ = []
    Object.assign(window, ex)
  }, [CATS, GUIAS, SECCIONES, FOROS, TEMAS, MENSAJES, NOTICIAS, extra])
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Una guía se dibuja IGUAL en /aprender, y la portada dice lo mismo ──')
{
  // Desde la 1188 la portada pinta las guías como PORTADAS (`.pb-portada`,
  // PINGU: «demasiada letra y poco visual»): ya no es la tarjeta de
  // /aprender, a propósito. Lo que la 316 defendía —que la portada diga de
  // qué es la guía y cuánto cuesta leerla— se sigue exigiendo.
  const { page, errores } = await abrir('/index.html')
  check('[portada] sin errores de JavaScript', errores.length === 0, errores.join(' | '))
  const chapa = (await page.locator('#aprende .pb-portada .pb-chip').first().textContent({ timeout: 3000 }).catch(() => ''))?.trim() || ''
  check('  …y en portada dice de qué es la guía', CATS.some((c) => chapa.includes(c.name)), chapa || '(vacía)')
  // Los minutos salieron de la portada en la 1191 (PINGU: la chapa se alargaba y rompía la tarjeta); /aprender los sigue diciendo.
  check('  …y sin los minutos, que rompían la tarjeta (1191)', !/\d+ min/.test(chapa), chapa || '(vacía)')
  await page.close()
  // La tarjeta de /aprender vive desde la 1219 en la página de un tema (la
  // lista general del PC son portadas).
  const a = await abrir('/aprender?tema=empezar')
  // El tema lo dice la portada de la lista general (1219: la tarjeta entera es
  // un enlace a la guía y no cabe otro dentro); dentro de un tema no se repite.
  const g = await abrir('/aprender')
  const chapaA = (await g.page.locator('.guia-portada .guia-portada-tema').first().textContent({ timeout: 1500 }).catch(() => ''))?.trim()
  await g.page.close()
  check('  …y en /aprender la portada dice su tema', !!chapaA && CATS.some((c) => c.name === chapaA), chapaA || '(sin chapa)')
  // Desde la 1338 el tema es un filtro y pinta portadas: los minutos van en su chapa.
  const min = (await a.page.locator('#apLista .guia-portada-mins').first().textContent().catch(() => ''))?.trim()
  check('  …y cuánto cuesta leerla', /\d+ min/.test(min || ''), min || '(vacía)')
  await a.page.close()
  check('  …y ya no existe el molde viejo', !/class="recent-card"/.test(leer('js/home.js')))
  // (Hasta la 1338 aquí se miraba el color de la rareza en la tarjeta de un
  // tema de /aprender; desde entonces el tema es un filtro que pinta portadas
  // y la tarjeta con etiquetas solo sale en el perfil y en Guardados.)
  // (Hasta la 1188 aquí se exigía que la portada pintara la tarjeta de
  // /aprender; desde entonces pinta portadas, a propósito: arriba.)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. En el móvil se lee de qué va cada tema ──')
{
  // Medido antes de la tanda: 160 px de título y los tres cortados.
  for (const ancho of [320, 390, 1280]) {
    const { page } = await abrir('/index.html', ancho)
    const titulos = await page.evaluate(() =>
      // Desde la 1207: los cuatro temas, iguales (.pb-hilo-texto b).
      [...document.querySelectorAll('.pb-hilo-texto b')].map((n) => ({
        w: Math.round(n.clientWidth),
        corta: n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1,
        entero: n.getAttribute('title') || '',
        t: n.textContent.trim(),
      })))
    check(`[${ancho}] hay temas en la portada`, titulos.length >= 3, String(titulos.length))
    // En el PC (1207) la caja mide lo que la noticia: dos líneas, y el título
    // entero al pasar el ratón. En el móvil, entero siempre.
    const cortados = titulos.filter((x) => x.corta && (ancho < 960 || !x.entero.length))
    check(`  …y ninguno se corta${ancho >= 960 ? ' sin su título entero al pasar' : ''}`, cortados.length === 0, cortados.map((x) => `${x.t} (${x.w}px)`).join(' | '))
    // Y la portada no se sale de la pantalla por arreglarlo.
    check('  …sin desborde lateral', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La portada no cuenta lo mismo dos veces ──')
{
  const { page } = await abrir('/index.html')
  const r = await page.evaluate(() => {
    // El ÚLTIMO enlace de cada fila es su destino: el primero es el
    // avatar, cuyo texto es una inicial suelta y casaría con cualquier
    // título si se comparase por trozos.
    const enActividad = [...document.querySelectorAll('#homeActivityFeed .suc-lista li')]
      .map((f) => [...f.querySelectorAll('a')].pop()?.textContent.trim())
      .filter((x) => x && x.length > 3)
    const enForo = [...document.querySelectorAll('.pb-hilo-texto b')].map((n) => n.textContent.trim())
    const noticia = document.querySelector('#noticiaPortada strong')?.textContent.trim() || ''
    return { enForo, enActividad, noticia }
  })
  check('la franja del foro trae temas', r.enForo.length >= 3, String(r.enForo.length))
  // El título de la franja lleva la etiqueta pegada delante («Duda¿Qué
  // mazo…»), así que se compara por el final y no por igualdad.
  const repes = r.enActividad.filter((a) => r.enForo.some((f) => f.endsWith(a)))
  check('  …y la actividad no repite ninguno', repes.length === 0, `${repes.join(' | ')} || feed: ${r.enActividad.join(' / ')}`)
  const repeNoticia = r.noticia && r.enActividad.some((a) => a === r.noticia)
  check('  …ni repite la noticia del banner', !repeNoticia, r.noticia)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. En el móvil, los primeros pasos van arriba ──')
{
  // Medido antes: y = 2.401 de 3.917. En escritorio, 470.
  const donde = async (ancho) => {
    const { page } = await abrir('/index.html', ancho)
    const r = await page.evaluate(() => {
      const n = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /Tus primeros pasos/.test(e.textContent))
      const top = (id) => Math.round((document.getElementById(id)?.getBoundingClientRect().top || 0) + window.scrollY)
      return n ? { y: Math.round(n.getBoundingClientRect().top + window.scrollY), alto: document.body.scrollHeight, aprende: top('recientesSeccion'), clasificacion: top('clasificacionSeccion') } : null
    })
    await page.close()
    return r
  }
  const movil = await donde(390)
  const escritorio = await donde(1280)
  check('el panel existe en los dos tamaños', !!movil && !!escritorio, JSON.stringify({ movil, escritorio }))
  if (movil && escritorio) {
    // La FORMA: que esté en el primer tercio, no un número exacto —un
    // número exacto se rompe en cuanto cambie cualquier bloque de arriba.
    // Desde la 1012 (P3) en el móvil «Primeros pasos» (para quien acaba de
    // llegar) va DETRÁS de «Sigue», el foro, la noticia y Aprende, y antes
    // de la clasificación: ya no está en el primer tercio a propósito.
    // Desde la 1188 (el mosaico; PINGU dijo «dale» a ponerlos arriba) van
    // DELANTE de las noticias y de las guías, en el móvil y en el PC: son
    // solo de los primeros días y se van solos al acabarlos.
    const noticias = async (ancho) => { const { page } = await abrir('/index.html', ancho); const y = await page.evaluate(() => Math.round(document.getElementById('noticiaPortadaSeccion').getBoundingClientRect().top + scrollY)); await page.close(); return y }
    const [nm, ne] = [await noticias(390), await noticias(1280)]
    check('  …y en el móvil va antes de las noticias y de las guías (1188)', movil.y < nm && movil.y < movil.aprende, `y=${movil.y}, noticias=${nm}, aprende=${movil.aprende}`)
    check('  …y en escritorio, encima del mosaico (1188)', escritorio.y < ne && escritorio.y < escritorio.aprende, `y=${escritorio.y}, noticias=${ne}, aprende=${escritorio.aprende}`)
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Con pocos torneos la rejilla no guarda sitio vacío ──')
{
  // `auto-fill` CREA las pistas que caben aunque nadie las use. Y la
  // trampa de verdad: una pista que CRUZA alguien no está vacía, así que
  // con las pestañas dentro de la misma rejilla `auto-fit` tampoco
  // plegaba nada. De ahí que las tarjetas tengan su propia caja.
  const torneo = (i, extra = {}) => ({
    id: `t${i}`, slug: `t${i}`, name: `Torneo ${i}`, status: 'in_progress', format: 'standard',
    starts_at: new Date(ahora + i * 3600e3).toISOString(), max_players: 32, created_by: 'admin-1', ...extra,
  })
  const medir = async (cuantos) => {
    const { page } = await abrir('/torneos', 1280, { __FAKE_TORNEOS__: Array.from({ length: cuantos }, (_, i) => torneo(i + 1)) })
    const r = await page.evaluate(() => {
      const g = document.querySelector('.torneos-rejilla')
      if (!g) return null
      const anchos = [...g.children].map((n) => Math.round(n.getBoundingClientRect().width))
      return { fila: Math.round(g.getBoundingClientRect().width), anchos }
    })
    await page.close()
    return r
  }
  const uno = await medir(1)
  const dos = await medir(2)
  const cuatro = await medir(4)
  check('las tarjetas tienen su propia caja', !!uno && !!dos && !!cuatro, JSON.stringify({ uno, dos, cuatro }))
  if (uno && dos && cuatro) {
    // Con una: ancha de verdad (más del doble de los 330 de pista), pero
    // con tope — estirada a la fila entera es una banda, no una tarjeta.
    check('  …con UNA, ancha pero con tope', uno.anchos[0] > 500 && uno.anchos[0] <= 640, `${uno.anchos[0]}px de ${uno.fila}`)
    // Con dos: media fila cada una, sin hueco de una tercera.
    check('  …con DOS, media fila cada una', dos.anchos.every((w) => w > dos.fila / 2 - 20), dos.anchos.join(' / '))
    // Con cuatro ya no sobra sitio: la rejilla normal.
    check('  …y con CUATRO vuelve la rejilla de siempre', cuatro.anchos[0] < 400, cuatro.anchos.join(' / '))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. El nombre de la pantalla va antes que el buscador ──')
{
  const { page } = await abrir('/foro')
  const r = await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    const buscador = document.querySelector('.foro-buscador')
    if (!h1 || !buscador) return null
    const a = h1.getBoundingClientRect(), b = buscador.getBoundingClientRect()
    return { h1: Math.round(a.top), buscador: Math.round(b.top), mismaFila: Math.abs(a.top - b.top) < 80,
      dentro: !!buscador.closest('.foro-cabecera') }
  })
  check('están los dos', !!r, JSON.stringify(r))
  if (r) {
    check('  …el buscador ya no va por encima del título', r.buscador >= r.h1 - 8, JSON.stringify(r))
    check('  …y vive dentro de la cabecera', r.dentro)
  }
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. La tarjeta se mide a sí misma, no a la ventana ──')
{
  // El dato que obliga a `@container` y no a `@media`: con la ventana en
  // 960 la misma tarjeta mide 264 px en la portada y 432 en /aprender.
  // En /aprender la PRIMERA es la grande desde la 846 (dos pistas y la foto
  // al lado): la que se mide es la segunda, una de las de siempre.
  const anchoDe = async (url, ancho, sel = '.guia-tarjeta') => {
    const { page } = await abrir(url, ancho)
    const r = await page.evaluate((sel) => {
      const c = document.querySelector(sel)
      if (!c) return null
      const arte = c.querySelector('.guia-arte')
      return { tarjeta: Math.round(c.getBoundingClientRect().width), arte: Math.round(arte.getBoundingClientRect().height) }
    }, sel)
    await page.close()
    return r
  }
  // Hasta la 1188 se comparaba con la portada; desde entonces la portada pinta
  // portadas (`.pb-portada`) y no la tarjeta. Se queda lo de /aprender.
  // Desde la 1219, en la página de un tema (la general son portadas).
  // (Desde la 1338 /aprender no pinta la tarjeta: queda la declaración.)
  check('la declaración está en la hoja que bajan las dos',
    /container-type:\s*inline-size/.test(leer('css/components.css')) && /@container guia/.test(leer('css/components.css')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. Los títulos se reparten las líneas ──')
{
  const { page } = await abrir('/index.html')
  const v = await page.evaluate(() => {
    const h = document.querySelector('h1, h2')
    return h ? getComputedStyle(h).textWrap || getComputedStyle(h).textWrapStyle : null
  })
  check('un título pide `balance`', /balance/.test(String(v)), String(v))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
