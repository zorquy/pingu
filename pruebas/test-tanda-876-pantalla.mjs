// Tanda 876 — una noticia ya no abre hilo en el foro; se comenta en la
// noticia, y eso cuenta como conversación.
//
// PINGU: «no sé si tiene sentido que las noticias generen un hilo en el
// foro... normalmente se quedan sin comentarios y la gente comenta
// directamente en la noticia». Tres partes:
//   1. El hilo automático (la 273) se va: ni módulo, ni llamada en los dos
//      editores, ni botón «Comentar en el foro» en la noticia.
//   2. El subforo «Noticias» se ESCONDE (migración) y un foro escondido no
//      sale en el índice ni en «Lo que se está hablando», para nadie.
//   3. Un comentario en una noticia sale en «Lo que se está hablando», en
//      la actividad de /usuarios y en la pestaña Foro del perfil.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. El hilo automático se ha ido ──')
{
  check('js/noticias-foro.js ya no existe', !existsSync(`${RAIZ}/js/noticias-foro.js`))
  const quienLoImporta = [...readdirSync(`${RAIZ}/js`).map((f) => `js/${f}`), ...readdirSync(`${RAIZ}/admin/js`).map((f) => `admin/js/${f}`)]
    .filter((f) => f.endsWith('.js') && /noticias-foro|abrirHiloDeNoticia/.test(leer(f)))
  check('nadie lo importa ni lo llama', quienLoImporta.length === 0, quienLoImporta.join(', '))
  check('la noticia no ofrece «Comentar en el foro»', !/Comentar en el foro/.test(leer('js/guia.js')))
  const sql = leer('supabase-migration-876-foro-noticias-escondido.sql')
  check('la migración esconde el subforo, no lo borra', /update public\.forum_boards set is_hidden = true where slug = 'noticias'/.test(sql) && !/delete from/.test(sql))
}

const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const SEMILLAS = {
  __FAKE_SECCIONES__: [{ id: 's1', name: 'Comunidad', position: 1 }],
  __FAKE_FOROS__: [
    { id: 'f-pre', section_id: 's1', slug: 'presentaciones', name: 'Presentaciones', position: 1, post_policy: 'todos' },
    { id: 'f-not', section_id: 's1', slug: 'noticias', name: 'Noticias', position: 0, post_policy: 'staff', is_hidden: true },
  ],
  __FAKE_TEMAS__: [
    { id: 't1', board_id: 'f-pre', title: 'Hola desde Sevilla', author_id: 'user-3', last_post_author_id: 'user-3', post_count: 2, last_post_at: hace(200), created_at: hace(300) },
    // El hilo viejo de una noticia, en el foro escondido, con el mensaje MÁS nuevo de todos.
    { id: 't-viejo', board_id: 'f-not', title: 'Noticia: lo de antes', author_id: 'admin-1', last_post_author_id: 'user-2', post_count: 2, last_post_at: hace(1), created_at: hace(5000), prefix: 'Noticia' },
  ],
  __FAKE_MENSAJES__: [
    { id: 'm1', thread_id: 't1', author_id: 'user-3', body_html: '<p>Hola</p>', created_at: hace(300) },
    { id: 'm2', thread_id: 't1', author_id: 'user-2', body_html: '<p>Bienvenido</p>', created_at: hace(200) },
    { id: 'm-viejo', thread_id: 't-viejo', author_id: 'user-2', body_html: '<p>En el escondido</p>', created_at: hace(1) },
  ],
  __FAKE_NOTICIAS__: [{ id: 'noticia-1', slug: 'mega-heatran', title: 'Mega Heatran ex llega en noviembre' }],
  __FAKE_GUIAS__: [],
  // Un comentario en la noticia, más nuevo que el mensaje del foro visible.
  __FAKE_COMENTARIOS_GUIA__: [{ id: 'gc-1', guide_id: 'noticia-1', author_id: 'user-1', body: 'Qué ganas de la carta', created_at: hace(30) }],
}

const browser = await chromium.launch()
const abrir = async (ruta, { sesion = 'user-1', semillas = SEMILLAS, movil = false } = {}) => {
  const ctx = await browser.newContext(movil ? { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(([s, sem]) => { window.__FAKE_SESSION__ = s; Object.assign(window, sem) }, [sesion, semillas])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}

console.log('\n── 2. El índice del foro: sin el foro escondido, y la noticia comentada en la franja ──')
for (const sesion of ['user-1', 'admin-1']) {
  const { page, ctx, errores } = await abrir('/foro.html', { sesion })
  check(`[${sesion}] sin errores`, errores.length === 0, errores[0] || '')
  const foros = await page.locator('.foro-fila .foro-fila-nombre, .foro-fila h3, .foro-fila a').allTextContents()
  check(`[${sesion}] el foro escondido no está en el índice (ni para administración)`, !foros.some((t) => /^Noticias$/.test(t.trim())) && foros.some((t) => /Presentaciones/.test(t)), foros.join(' | '))
  const filas = await page.$$eval('.foro-caliente', (xs) => xs.map((x) => ({ href: x.querySelector('.foro-caliente-titulo')?.getAttribute('href'), titulo: x.querySelector('.foro-caliente-titulo')?.textContent.trim(), meta: x.querySelector('.foro-caliente-meta')?.textContent.replace(/\s+/g, ' ').trim() })))
  check(`[${sesion}] la noticia comentada va la primera, con su enlace y «1 comentario»`, filas[0]?.href === '/noticias/mega-heatran' && /Noticia/.test(filas[0].meta) && /1 comentario\b/.test(filas[0].meta), JSON.stringify(filas))
  check(`[${sesion}] el tema del foro visible, detrás`, filas[1]?.href === '/tema/t1' && /2 mensajes/.test(filas[1].meta), JSON.stringify(filas))
  check(`[${sesion}] y el hilo viejo del foro escondido no sale, aunque sea el mensaje más nuevo`, !filas.some((f) => /t-viejo/.test(f.href || '')), JSON.stringify(filas))
  await ctx.close()
}

console.log('\n── 3. La actividad de /usuarios: «comentó en» la noticia ──')
{
  const { page, ctx, errores } = await abrir('/usuarios.html#activity')
  check('sin errores', errores.length === 0, errores[0] || '')
  const filas = await page.locator('#activityFeed .suc-lista li').allTextContents()
  const juntas = filas.join(' | ').replace(/\s+/g, ' ')
  check('hay una fila de «comentó en» la noticia', /comentó en Mega Heatran ex llega en noviembre/.test(juntas), juntas)
  const href = await page.locator('#activityFeed .suc-lista li a[href^="/noticias/"]').first().getAttribute('href').catch(() => null)
  check('  …y lleva a la noticia, no al foro', href === '/noticias/mega-heatran', String(href))
  await ctx.close()
}

console.log('\n── 4. La pestaña Foro del perfil cuenta los comentarios en noticias y guías ──')
{
  const { page, ctx, errores } = await abrir('/usuario?u=Ash', { sesion: 'user-2' })
  await page.locator('.tab-btn[data-ptab="foro"]').click()
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores[0] || '')
  const chapa = (await page.locator('.tab-btn[data-ptab="foro"] .pest-cuenta').textContent().catch(() => '')) || ''
  check('la chapa de la pestaña suma el comentario (Ash no tiene nada más)', chapa.trim() === '1', chapa)
  const texto = (await page.locator('#foroActividad').textContent()).replace(/\s+/g, ' ')
  check('hay una sección «Comentarios en noticias y guías» con 1', /Comentarios en noticias y guías\s*1/.test(texto), texto.slice(0, 200))
  const fila = await page.$eval('#foroActividad .foro-act-fila a.foro-act-titulo[href^="/noticias/"]', (a) => ({ href: a.getAttribute('href'), texto: a.textContent.replace(/\s+/g, ' ').trim() })).catch(() => null)
  check('  …con la noticia, su etiqueta y el enlace a la noticia', fila?.href === '/noticias/mega-heatran' && /Noticia/.test(fila.texto) && /Mega Heatran/.test(fila.texto), JSON.stringify(fila))
  check('  …y el trozo del comentario', /Qué ganas de la carta/.test(texto))
  await ctx.close()
}

console.log('\n── 5. La portada y el buscador tampoco enseñan los hilos del foro escondido ──')
{
  const { page, ctx, errores } = await abrir('/index.html', { sesion: 'admin-1' })
  check('sin errores', errores.length === 0, errores[0] || '')
  const enlaces = await page.$$eval('#foroVivo a[href^="/tema/"]', (as) => as.map((a) => a.getAttribute('href')))
  check('«Ahora en el foro» lleva el tema visible y no el del foro escondido (aunque sea el más reciente)', enlaces.includes('/tema/t1') && !enlaces.some((h) => /t-viejo/.test(h)), JSON.stringify(enlaces))
  await ctx.close()
  const b = await abrir('/buscar.html?q=Noticia&en=temas')
  const hs = await b.page.$$eval('#searchResults .bs-fila', (as) => as.map((a) => a.getAttribute('href')))
  check('/buscar en el foro no encuentra el hilo del foro escondido', !hs.some((h) => /t-viejo/.test(h || '')), JSON.stringify(hs))
  const b2 = await b.page.evaluate(() => { const i = document.getElementById('searchInput'); i.value = 'Sevilla'; i.dispatchEvent(new Event('input', { bubbles: true })) })
  await b.page.waitForTimeout(1200)
  const hs2 = await b.page.$$eval('#searchResults .bs-fila', (as) => as.map((a) => a.getAttribute('href')))
  check('  …y sí el tema del foro visible', hs2.includes('/tema/t1'), JSON.stringify(hs2))
  await b.ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
