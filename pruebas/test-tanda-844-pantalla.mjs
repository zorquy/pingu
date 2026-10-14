// Tanda 844 — la portada nueva en el navegador, la que PINGU vio en imágenes
// («mola, dale todo»): «Sigue donde lo dejaste» con guías, cursos y el mazo a
// medias; el foro con el tema más hablado delante; «Aprende» con los temas
// dentro; las noticias; la clasificación de la semana y del mes; la comunidad
// con los sucesos nuevos, y el orden del móvil.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'

const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
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


const CLAS = {
  semana: { jugadores: 14, ranking: [{ puesto: 1, username: 'brock', display_name: 'Brock', xp: 910 }, { puesto: 2, username: 'misty', display_name: 'Misty', xp: 820 }, { puesto: 3, username: 'ibai', display_name: 'Ibai', xp: 705 }, { puesto: 4, username: 'laia', display_name: 'Laia', xp: 640 }, { puesto: 5, username: 'ane', display_name: 'Ane', xp: 590 }], tu: { puesto: 12, xp: 385, faltan: 40, pasarA: 'Gary' } },
  mes: { jugadores: 30, ranking: [{ puesto: 1, username: 'misty', display_name: 'Misty', xp: 3100 }, { puesto: 2, username: 'ash', display_name: 'Ash', xp: 2900, tu: true }], tu: { puesto: 2, xp: 2900, faltan: 201, pasarA: 'Misty' } },
}
const SUC = [
  { tipo: 'perfecto', fecha: new Date(ahora - 600e3).toISOString(), username: 'misty', display_name: 'Misty', datos: { dia: '2026-10-14' } },
  { tipo: 'mazo', fecha: new Date(ahora - 2400e3).toISOString(), username: 'brock', display_name: 'Brock', datos: { id: 'm1', nombre: 'Charizard ex' } },
  { tipo: 'campeon', fecha: new Date(ahora - 7200e3).toISOString(), username: 'ibai', display_name: 'Ibai', datos: { slug: 'otono', nombre: 'Liga de otoño' } },
  { tipo: 'coleccion', fecha: new Date(ahora - 86400e3).toISOString(), username: 'laia', display_name: 'Laia', datos: { set: 'base1', market: 'WEST', nombre: 'Base Set' } },
]
const MAZOS = [{ id: 'mz1', user_id: 'user-1', name: 'Dragapult ex', cards: [{ id: 'a', n: 52 }], updated_at: new Date(ahora - 3600e3).toISOString() }]
const NOTICIAS = [
  ...NOTICIA,
  { id: 'n2', slug: 'regionales', title: 'Fechas de los regionales', kind: 'news', author_id: 'admin-1', review_status: 'published', published_at: new Date(ahora - 86400e3).toISOString(), blocks: [] },
  { id: 'n3', slug: 'heroes', title: 'Lo que trae Héroes Ascendentes', kind: 'news', author_id: 'admin-1', review_status: 'published', published_at: new Date(ahora - 3 * 86400e3).toISOString(), blocks: [] },
]

// La columna de verdad es `body_html`; el fixture de la 299 la llamaba `content`.
const MENSAJES_HTML = MENSAJES.map((m) => ({ ...m, body_html: `<p>${m.content}</p>` }))
const b = await chromium.launch()
async function abrir({ sesion = 'user-1', movil = false, clas = CLAS, suc = SUC } = {}) {
  const ctx = await b.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES' })
  await ctx.route('**/fotos/**', (r) => r.fulfill({ contentType: 'image/png', body: readFileSync('/tmp/claude-0/maq/charizard-art.png') }))
  await ctx.addInitScript(([s, c, g, p, n, se, fo, te, me, cl, su, mz]) => {
    window.__FAKE_SESSION__ = s; window.__FAKE_CATEGORIAS__ = c; window.__FAKE_GUIAS__ = g; window.__FAKE_PROGRESO__ = p; window.__FAKE_NOTICIAS__ = n
    window.__FAKE_SECCIONES__ = se; window.__FAKE_FOROS__ = fo; window.__FAKE_TEMAS__ = te; window.__FAKE_MENSAJES__ = me
    if (cl) window.__FAKE_CLASIFICACION__ = cl
    if (su) window.__FAKE_COMUNIDAD_SUCESOS__ = su
    window.__FAKE_MAZOS__ = mz
  }, [sesion, CATS, GUIAS, PROGRESO, NOTICIAS, SECCIONES, FOROS, TEMAS, MENSAJES_HTML, clas, suc, MAZOS])
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/index.html`, { waitUntil: 'load' })
  await p.waitForTimeout(3500)
  return { p, ctx, errores }
}
const texto = (p, sel) => p.locator(sel).first().innerText().catch(() => '')

console.log('── 1. Con cuenta, en el ordenador ──')
{
  const { p, ctx, errores } = await abrir()
  check('sin errores de JavaScript', !errores.length, errores.join(' | '))
  check('lo viejo se ha ido: ni temas sueltos, ni liga, ni top del mes, ni destacada aparte', !(await p.locator('#temasSeccion, #ligaSeccion, #topMesSeccion, #destacadaSeccion, .portada-temas').count()))

  console.log('  · Sigue donde lo dejaste')
  const sg = await p.$$eval('#sigueSeccion .hoy-sg', (xs) => xs.map((x) => [x.getAttribute('href'), x.innerText.replace(/\s+/g, ' ')]))
  check('el curso a medias (guía 1, con preguntas) y el mazo de 52', sg.length === 2 && sg[0][0] === '/guia/guia-1' && /Curso/i.test(sg[0][1]) && /Bloque 2 de 4/.test(sg[0][1]) && sg[1][0] === '/constructor.html?mazo=mz1' && /52 de 60 · te faltan 8/.test(sg[1][1]), JSON.stringify(sg))
  check('  …va en la columna ancha, encima del foro', await p.evaluate(() => { const s = document.getElementById('sigueSeccion'); return s.closest('.portada-principal') && s.getBoundingClientRect().bottom <= document.getElementById('foroVivoSeccion').getBoundingClientRect().top }))
  check('  …y la guía terminada (la 3) no sale', !sg.some((x) => x[0] === '/guia/guia-3'))

  console.log('  · El foro')
  const foro = await texto(p, '#foroVivo')
  check('el tema con la ráfaga de hoy va delante, «Lo más hablado hoy»', /Lo más hablado hoy/.test(foro) && /¿Qué mazo me recomendáis para empezar\?/.test(await texto(p, '.pb-foro-titulo')), foro.slice(0, 200))
  check('  …con su último mensaje citado y quién participa', /«Yo empezaría por una baraja de liga\.»/.test(await texto(p, '.pb-foro-ultimo')) && (await p.locator('.pb-foro-pie .pb-pila .pb-cara').count()) >= 2, await texto(p, '.pb-foro-ultimo'))
  check('  …cuánta gente ha escrito hoy', /\d+ personas escribiendo hoy/.test(foro))
  check('  …y los otros tres en filas, sin repetir el de arriba', (await p.locator('.pb-foro-fila').count()) === 3 && !(await p.$$eval('.pb-foro-fila b', (xs) => xs.some((x) => /Qué mazo me recomendáis/.test(x.textContent)))))
  check('  …«Participar» lleva al foro', (await p.locator('#foroVivo .pb-cab .pb-boton').getAttribute('href')) === '/foro')

  console.log('  · Aprende')
  const chips = await p.$$eval('.pb-tema', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  check('«Novedades» y los temas con su cuenta, de más a menos', chips[0] === 'Novedades' && /Empezar de cero 3/.test(chips[1]) && chips.length === 4, chips.join(' | '))
  check('  …la grande es la tarjeta de siempre y las otras tres, en fila', (await p.locator('.pb-aprende-grande .guia-tarjeta').count()) === 1 && (await p.locator('.pb-aprende-lista .guia-fila').count()) === 3)
  check('  …la fila dice lo que ya está hecho', /✓ hecha/.test(await p.locator('.guia-fila[href="/guia/guia-3"]').innerText().catch(() => '')))
  await p.locator('.pb-tema', { hasText: 'Cartas falsas' }).click()
  await p.waitForTimeout(700)
  const cat2 = await p.$$eval('#aprende a[href^="/guia/"]', (xs) => [...new Set(xs.map((x) => x.getAttribute('href')))])
  check('al pulsar «Cartas falsas» salen solo las suyas (la 2 y la 5)', cat2.length === 2 && cat2.every((h) => ['/guia/guia-2', '/guia/guia-5'].includes(h)), cat2.join(' '))
  check('  …con el tema marcado y «Todas las guías» a ese tema', (await p.locator('.pb-tema.activo').innerText()).includes('Cartas falsas') && /tema=falsas/.test(await p.locator('#aprende .pb-cab .ver-todo').getAttribute('href')))
  await p.locator('.pb-tema', { hasText: 'Novedades' }).click()
  await p.waitForTimeout(400)
  check('  …y «Novedades» vuelve a lo último', (await p.locator('#aprende .guia-tarjeta').count()) === 1 && (await p.locator('.pb-aprende-lista .guia-fila').count()) === 3)

  console.log('  · Noticias')
  check('la última con el titular sobre la foto y dos más debajo', /Mew RGB secretas/.test(await texto(p, '.pb-noticia')) && (await p.locator('.pb-noticia-foto').count()) === 1 && (await p.locator('.pb-noticias-mas li').count()) === 2)

  console.log('  · Clasificación')
  const pod = await p.$$eval('.pb-podio > div', (xs) => xs.map((x) => x.className))
  check('el podio en su orden (2.º, 1.º, 3.º), el 4.º y el 5.º, y tu puesto con lo que te falta', pod.join() === 'pb-podio-2,pb-podio-1,pb-podio-3' && (await p.locator('.pb-clas-lista li').count()) === 2 && /40 XP para pasar a Gary/.test(await texto(p, '.pb-clas-tu')), pod.join())
  await p.locator('[data-periodo="mes"]').click()
  await p.waitForTimeout(500)
  check('«Mes» cambia a la del mes, contigo dentro del podio («Tú»)', /desde el día 1/.test(await texto(p, '#clasificacion')) && /Tú/.test(await texto(p, '.pb-podio-2')) && !(await p.locator('.pb-clas-tu').count()))

  console.log('  · En la comunidad')
  const comu = await p.$$eval('.pb-comu li', (xs) => xs.map((x) => x.innerText.replace(/\s+/g, ' ')))
  check('los sucesos nuevos: seis retos, mazo, torneo y colección', ['hizo los seis retos del día', 'compartió su mazo Charizard ex', 'ganó el torneo Liga de otoño', 'completó Base Set'].every((t) => comu.some((x) => x.includes(t))), comu.join(' / '))
  check('  …seis como mucho, en la columna ancha', comu.length <= 6 && (await p.locator('.portada-principal #homeActivity').count()) === 1)
  const enlaces = await p.$$eval('.pb-comu a[href]', (xs) => xs.map((x) => x.getAttribute('href')))
  const existe = (h) => { const r = h.split('?')[0]; return ['/torneo', '/usuarios.html'].includes(r) || r.startsWith('/usuario/') || r.startsWith('/guia/') || r.startsWith('/tema/') || existsSync(`${RAIZ}${r.endsWith('.html') ? r : `${r}.html`}`) }
  check('  …y cada enlace lleva a una página que existe', enlaces.length > 0 && enlaces.every(existe), enlaces.filter((h) => !existe(h)).join(' '))
  check('  …las noticias no se cuelan (van en su bloque)', !comu.some((x) => /Mew RGB/.test(x)))
  await ctx.close()
}

console.log('── 2. Sin las funciones de la 844 (la migración sin correr) ──')
{
  const { p, ctx, errores } = await abrir({ clas: null, suc: null })
  check('la clasificación no sale (no se sabe, no «nadie»), y la portada sigue sin errores', !(await p.locator('#clasificacionSeccion').isVisible()) && !errores.length, errores.join(' | '))
  check('  …y la comunidad sale con lo de siempre', (await p.locator('.pb-comu li').count()) > 0 && !(await texto(p, '.pb-comu')).includes('Charizard ex'))
  await ctx.close()
}

console.log('── 3. Sin cuenta ──')
{
  const { p, ctx, errores } = await abrir({ sesion: 'none' })
  check('sin errores, sin «Sigue» y sin comunidad', !errores.length && !(await p.locator('#sigueSeccion').isVisible()) && !(await p.locator('#homeActivity').isVisible()), errores.join(' | '))
  check('  …el foro, Aprende, las noticias y la clasificación, sí', (await p.locator('#foroVivo .pb-foro-top').count()) === 1 && (await p.locator('#aprende .guia-tarjeta').count()) === 1 && (await p.locator('.pb-noticia').count()) === 1 && (await p.locator('.pb-podio').count()) === 1)
  check('  …y «Participar» lleva a crear la cuenta', /auth\.html\?registro=1/.test(await p.locator('#foroVivo .pb-cab .pb-boton').getAttribute('href')))
  await ctx.close()
}

console.log('── 4. En el móvil ──')
{
  const { p, ctx, errores } = await abrir({ movil: true })
  const y = await p.evaluate(() => Object.fromEntries(['retoSeccion', 'sigueSeccion', 'foroVivoSeccion', 'noticiaPortadaSeccion', 'recientesSeccion', 'clasificacionSeccion', 'homeActivity'].map((id) => [id, Math.round(document.getElementById(id).getBoundingClientRect().top + scrollY)])))
  const orden = Object.entries(y).sort((a, b) => a[1] - b[1]).map((x) => x[0])
  check('el orden: retos, sigue, foro, noticias, aprende, clasificación y comunidad', orden.join() === 'retoSeccion,sigueSeccion,foroVivoSeccion,noticiaPortadaSeccion,recientesSeccion,clasificacionSeccion,homeActivity', orden.join(' → '))
  const sale = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('  …nada se sale de la pantalla, y sin errores', sale <= 1 && !errores.length, `${sale}px ${errores.join(' | ')}`)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTODO OK')
process.exit(fails ? 1 : 0)
