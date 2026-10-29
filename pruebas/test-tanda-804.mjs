import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'

// Tanda 804. Tres cosas que PINGU pidió de una vez:
//  1. El foro: «es un poco lioso… para eso mantener mejor el foro como
//     estaba antes, y cada tema que sea como lo nuevo». El índice vuelve a
//     ser el de secciones y foros (sin la lista de conversaciones con
//     «Para ti» y «Siguiendo»), y la lista de temas de cada foro va en
//     filas de conversación.
//  2. El icono de la app instalada: el suyo, no el favicon.
//  3. Las hojas de abajo se cierran arrastrándolas hacia abajo.

const REPO = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()

const FORO = {
  __FAKE_SECCIONES__: [{ id: 's1', name: 'Comunidad', position: 1 }, { id: 's2', name: 'Juego', position: 2 }],
  __FAKE_FOROS__: [
    { id: 'f-pre', section_id: 's1', slug: 'presentaciones', name: 'Presentaciones', position: 1, post_policy: 'todos' },
    { id: 'f-reg', section_id: 's2', slug: 'dudas-de-reglas', name: 'Dudas de reglas', position: 1, post_policy: 'todos' },
  ],
  __FAKE_TEMAS__: [
    { id: 't1', board_id: 'f-reg', title: '¿Iono cuenta para Arven?', author_id: 'user-2', last_post_author_id: 'user-3', post_count: 3, last_post_at: hace(5), created_at: hace(60), is_pinned: false },
    { id: 't2', board_id: 'f-reg', title: 'Reglas de la Estadio', author_id: 'user-1', last_post_author_id: 'user-1', post_count: 1, last_post_at: hace(90), created_at: hace(90), is_pinned: true },
    { id: 't3', board_id: 'f-pre', title: 'Hola desde Sevilla', author_id: 'user-3', last_post_author_id: 'user-3', post_count: 1, last_post_at: hace(200), created_at: hace(200) },
  ],
  __FAKE_MENSAJES__: [
    { id: 'm1', thread_id: 't1', author_id: 'user-2', body_html: '<p>Pregunta</p>', created_at: hace(60) },
    { id: 'm2', thread_id: 't1', author_id: 'user-3', body_html: '<blockquote>cita</blockquote><p>Arven busca un <b>Objeto</b> y una Herramienta.</p>', created_at: hace(5) },
  ],
}

const browser = await chromium.launch()
const abrir = async (ruta, { movil = false, sesion = 'user-1', semillas = FORO } = {}) => {
  const ctx = await browser.newContext(movil ? { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(([s, sem]) => { window.__FAKE_SESSION__ = s; Object.assign(window, sem) }, [sesion, semillas])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}

console.log('\n── 1. El índice del foro es el de siempre ──')
for (const movil of [false, true]) {
  const nombre = movil ? 'móvil' : 'ordenador'
  const { page, ctx, errores } = await abrir('/foro.html', { movil })
  check(`[${nombre}] sin errores`, errores.length === 0, errores[0] || '')
  check(`[${nombre}] sin la lista de conversaciones ni sus chips`, (await page.locator('#foroConversaciones, [data-conv-filtro]').count()) === 0)
  check(`[${nombre}] las secciones y sus foros, a la vista`,
    (await page.locator('.foro-seccion-titulo:visible').allTextContents()).join('|') === 'Comunidad|Juego'
    && (await page.locator('.foro-fila:visible').count()) === 2)
  const calientes = page.locator('.foro-calientes')
  // Desde la 1096 en el PC lo último va en el lateral («Lo último») y la
  // franja es solo del móvil.
  if (movil) check('[móvil] «Lo que se está hablando» arriba', (await calientes.count()) === 1 && (await calientes.isVisible()))
  else check('[ordenador] la franja no se ve y «Lo último» va en el lateral', !(await calientes.isVisible()) && (await page.locator('#foroLateral .foro-lou:visible').count()) === 1)
  if (movil) {
    // La franja se desliza de lado y no saca la página de ancho.
    const r = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, ventana: innerWidth, fila: getComputedStyle(document.querySelector('.foro-calientes-rejilla')).overflowX }))
    check('[móvil] la franja se desliza y la página no se sale de ancho', r.fila === 'auto' && r.ancho <= r.ventana, JSON.stringify(r))
  }
  await ctx.close()
}

console.log('\n── 2. Dentro de un foro, los temas como conversaciones ──')
for (const movil of [false, true]) {
  const nombre = movil ? 'móvil' : 'ordenador'
  const { page, ctx, errores } = await abrir('/foro.html?f=dudas-de-reglas', { movil })
  check(`[${nombre}] sin errores`, errores.length === 0, errores[0] || '')
  const filas = await page.$$eval('.foro-tema-fila', (fs) => fs.map((f) => ({
    conv: f.classList.contains('foro-tema-conv'),
    titulo: f.querySelector('h3')?.textContent.trim(),
    trozo: f.querySelector('.foro-conv-trozo')?.textContent.trim(),
    resp: f.querySelector('.foro-conv-resp')?.textContent.trim(),
    avatar: !!f.querySelector('.mini-avatar'),
    fijado: /Fijado/.test(f.querySelector('.foro-conv-arriba')?.textContent || ''),
  })))
  check(`[${nombre}] dos temas, los dos en fila de conversación`, filas.length === 2 && filas.every((f) => f.conv && f.avatar), JSON.stringify(filas))
  const iono = filas.find((f) => /Iono/.test(f.titulo || ''))
  // Desde la 966 la fila es solo el título (PINGU: «es demasiado lioso»).
  check(`[${nombre}] la fila es solo el título: sin trozo del mensaje`, iono && iono.trozo === undefined, iono?.trozo)
  check(`[${nombre}] y cuántas respuestas lleva`, iono?.resp === '2', iono?.resp)
  const estadio = filas.find((f) => /Estadio/.test(f.titulo || ''))
  check(`[${nombre}] un tema sin respuestas, tampoco`, estadio && estadio.trozo === undefined, estadio?.trozo)
  check(`[${nombre}] el fijado, con su chapa`, estadio?.fijado === true)
  // Toda la fila lleva al tema: tocar a la derecha del título abre el tema.
  const caja = await page.locator('.foro-tema-fila', { hasText: 'Iono' }).boundingBox()
  await page.mouse.click(caja.x + caja.width * 0.6, caja.y + caja.height - 6)
  await page.waitForTimeout(600)
  check(`[${nombre}] tocar la fila abre el tema`, /tema/.test(page.url()) && /t1/.test(page.url()), page.url())
  await ctx.close()
}

console.log('\n── 3. El icono de la app ──')
{
  const m = JSON.parse(readFileSync(`${REPO}/manifest.webmanifest`, 'utf8'))
  check('el manifiesto ya no ofrece el favicon como icono', !m.icons.some((i) => /favicon/.test(i.src)), JSON.stringify(m.icons.map((i) => i.src)))
  check('lleva iconos «any» y «maskable» de 192 y 512',
    ['any', 'maskable'].every((p) => ['192x192', '512x512'].every((t) => m.icons.some((i) => i.purpose === p && i.sizes === t))))
  check('  …y todos existen', m.icons.every((i) => existsSync(`${REPO}${i.src}`)))
  const sinTouch = []
  for (const p of ['index.html', 'foro.html', 'mi-coleccion.html', 'cartas.html', 'perfil.html', 'torneo.html']) {
    if (!/rel="apple-touch-icon" href="\/assets\/apple-touch-icon\.png"/.test(readFileSync(`${REPO}/${p}`, 'utf8'))) sinTouch.push(p)
  }
  check('el icono del iPhone es el nuevo en las páginas', sinTouch.length === 0, sinTouch.join(', '))
  check('  …y existe', existsSync(`${REPO}/assets/apple-touch-icon.png`))
}

console.log('\n── 4. Las hojas de abajo se cierran arrastrándolas ──')
{
  const { tocaCerrar } = await import(`${REPO}/js/hoja-arrastre.js`)
  check('un cuarto de la hoja, cierra', tocaCerrar({ dy: 160, alto: 600 }) === true)
  check('un poco y despacio, no', tocaCerrar({ dy: 40, alto: 600, velocidad: 0.1 }) === false)
  check('un tirón corto y rápido, sí', tocaCerrar({ dy: 40, alto: 600, velocidad: 1.2 }) === true)
  check('hacia arriba, nunca', tocaCerrar({ dy: -200, alto: 600, velocidad: 2 }) === false)

  const { page, ctx, errores } = await abrir('/index.html', { movil: true })
  const arrastrar = (sel, pasos) => page.evaluate(([sel, pasos]) => {
    const el = document.querySelector(sel)
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const y0 = r.top + 20
    const toque = (y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
    const lanzar = (tipo, y) => el.dispatchEvent(new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: tipo === 'touchend' ? [] : [toque(y)], changedTouches: [toque(y)] }))
    lanzar('touchstart', y0)
    for (const dy of pasos) lanzar('touchmove', y0 + dy)
    lanzar('touchend', y0 + pasos[pasos.length - 1])
  }, [sel, pasos])
  const abierta = () => page.evaluate(() => !document.getElementById('navUserDropdown').classList.contains('hidden'))
  await page.click('#navUserBtn')
  await page.waitForTimeout(900)
  check('la hoja «Tú» se abre', await abierta())
  await arrastrar('#navUserDropdown', [10, 20, 30])
  await page.waitForTimeout(500)
  check('un arrastre corto la deja abierta y en su sitio', (await abierta()) && (await page.evaluate(() => document.getElementById('navUserDropdown').style.transform)) === '')
  await arrastrar('#navUserDropdown', [20, 60, 120, 200, 260])
  await page.waitForTimeout(600)
  check('arrastrarla hacia abajo la cierra', !(await abierta()))
  check('  …y se lleva el velo', !(await page.evaluate(() => document.documentElement.classList.contains('bm-tu-abierta'))))
  check('  …sin errores', errores.length === 0, errores[0] || '')
  // Y al volver a abrirla no queda desplazada.
  await page.click('#navUserBtn')
  await page.waitForTimeout(500)
  check('al volver a abrirla sale entera', (await abierta()) && (await page.evaluate(() => document.getElementById('navUserDropdown').style.transform)) === '')
  // Un arrastre de lado no es suyo.
  await page.evaluate(() => {
    const el = document.getElementById('navUserDropdown')
    const r = el.getBoundingClientRect()
    const t = (x, y) => new Touch({ identifier: 2, target: el, clientX: x, clientY: y })
    const l = (tipo, x, y) => el.dispatchEvent(new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: tipo === 'touchend' ? [] : [t(x, y)], changedTouches: [t(x, y)] }))
    l('touchstart', r.left + 40, r.top + 30); l('touchmove', r.left + 140, r.top + 60); l('touchmove', r.left + 260, r.top + 90); l('touchend', r.left + 260, r.top + 90)
  })
  await page.waitForTimeout(500)
  check('un gesto de lado no la cierra', await abierta())
  await ctx.close()

  const css = readFileSync(`${REPO}/js/tirar-refrescar.js`, 'utf8')
  check('tirar para refrescar no salta desde la hoja «Tú»', /\.nav-user-dropdown/.test(css))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
