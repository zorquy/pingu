// Tanda 1168 — M4 de «PokeDoc entera»: /avisos, TODOS tus avisos (leídos y
// sin leer) por días y meses, chips por sección con lo sin leer, «Marcar
// todo como leído», la lista crece al bajar; «Ver todos los avisos» al pie
// de la campana (y dentro de la hoja «Tú» del móvil). La campana sigue
// enseñando solo lo sin leer.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { agruparAvisos, tramoDe } from '/home/user/pingu/js/avisos-grupos.js'
import { casaConChip, cuentasDeChips } from '/home/user/pingu/js/avisos-chips.js'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Puro: tramos por meses, agrupar por tramo, chips ──')
{
  const AHORA = new Date('2026-11-01T18:00:00').getTime()
  const hace = (h) => new Date(AHORA - h * 3600e3).toISOString()
  check('por meses: «Octubre» este año, «Marzo de 2025» otro año; Hoy/Ayer/Esta semana como siempre', tramoDe(hace(24 * 9), AHORA, { meses: true }) === 'Octubre' && tramoDe(new Date('2025-03-10').toISOString(), AHORA, { meses: true }) === 'Marzo de 2025' && tramoDe(hace(1), AHORA, { meses: true }) === 'Hoy' && tramoDe(hace(24 * 9), AHORA) === 'Antes')
  const lista = [
    { id: 'a', type: 'forum_reply', title: 'R hoy', link: '/tema/1#m-1', created_at: hace(1) },
    { id: 'b', type: 'forum_reply', title: 'R hace 3 semanas', link: '/tema/1#m-2', created_at: hace(24 * 20), read_at: hace(24 * 19) },
    { id: 'c', type: 'forum_reply', title: 'R hace 3 semanas y un día', link: '/tema/1#m-3', created_at: hace(24 * 21), read_at: hace(24 * 19) },
  ]
  const campana = agruparAvisos(lista, AHORA)
  const pagina = agruparAvisos(lista, AHORA, { porTramo: true, meses: true })
  check('la campana sigue juntando las tres en una de hoy', campana.length === 1 && campana[0].tramo === 'Hoy' && campana[0].grupos[0].n === 3, JSON.stringify(campana))
  check('/avisos las parte por tramo: una de hoy y dos juntas en Octubre, con `leido`', pagina.map((t) => `${t.tramo}:${t.grupos.map((g) => `${g.n}${g.leido ? 'L' : ''}`).join(',')}`).join('|') === 'Hoy:1|Octubre:2L', JSON.stringify(pagina))
  const avisos = [{ type: 'forum_reply' }, { type: 'trade_match', read_at: 'x' }, { type: 'torneo_ronda' }, { type: 'new_follower' }, { type: 'aviso_precio' }]
  check('chips: «Para ti» es lo sin sección; las cuentas son lo SIN LEER', casaConChip(avisos[3], 'para-ti') && !casaConChip(avisos[0], 'para-ti') && casaConChip(avisos[0], 'Comunidad') && JSON.stringify(cuentasDeChips(avisos)) === '{"todos":4,"para-ti":1,"Comunidad":1,"Colección":1,"Jugar":1,"Mensajes":0}', JSON.stringify(cuentasDeChips(avisos)))
}

const b = await chromium.launch()
// Muchos avisos, de varios días y secciones, leídos y sin leer.
const muchos = (n = 70) => new Function(`
  const ahora = Date.now(); const hace = (h) => new Date(ahora - h * 3600e3).toISOString()
  const tipos = [['forum_reply', 'Misty ha respondido en «¿Charizard sigue siendo top?»', '/tema/tema-2'], ['new_follower', 'Brock te sigue', '/usuario/Brock'], ['trade_match', 'Misty da una carta que buscas', '/mi-coleccion?ver=cambios'], ['torneo_ronda', 'Ronda 2 de Liga FDN: te toca en la mesa 4', '/torneo?slug=liga-fdn-otono'], ['guide_helpful', 'A alguien le ha servido tu guía', '/guia/charizard-ex'], ['aviso_precio', 'Charizard ex ha bajado a 48 €', '/carta/sv3-125'], ['forum_reaction', 'A Misty le ha gustado tu mensaje', '/tema/tema-2#mensaje-80'], ['aviso_equipo', 'Novedades de octubre en PokeDoc', '/novedades']]
  window.__FAKE_NOTIFICACIONES__ = [...Array(${n})].map((_, i) => { const t = tipos[i % tipos.length]; return { id: 'av-' + i, recipient_id: 'user-1', type: t[0], title: t[1], body: i % 3 === 0 ? 'Un trozo del mensaje.' : null, link: t[2], created_at: hace(i * 7), read_at: i < 4 ? null : hace(i * 6) } })
`)
const abrir = async (ruta, movil, extra = null, quien = 'user-1') => {
  const ctx = await contexto(b, movil, quien, extra)
  const p = await ctx.newPage()
  if (!movil) await p.setViewportSize({ width: 1280, height: 800 })
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errores }
}
const estado = (p) => p.evaluate(() => ({ chips: [...document.querySelectorAll('.av-chip')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), activo: document.querySelector('.av-chip[aria-selected="true"]')?.dataset.chip, filas: document.querySelectorAll('.av-lista .nav-bell-item').length, sinLeer: document.querySelectorAll('.av-lista .unread').length, tramos: [...document.querySelectorAll('.av-lista .nav-bell-tramo')].map((x) => x.textContent), pie: document.getElementById('avPie').innerText.trim(), leerTodo: Boolean(document.getElementById('avLeerTodo').offsetParent), vacio: document.querySelector('.av-vacio')?.innerText || null, desborda: document.documentElement.scrollWidth > innerWidth, url: location.search, punto: (() => { const u = document.querySelector('.av-lista .unread'); return u ? getComputedStyle(u, '::before').width : null })() }))

console.log('── /avisos en el PC ──')
{
  const { p, ctx, errores } = await abrir('/avisos', false, muchos())
  check('sin errores', errores.length === 0, errores.join(' | '))
  let r = await estado(p)
  check('los chips con lo SIN LEER de cada uno; «Todos» activo', JSON.stringify(r.chips) === JSON.stringify(['Todos 4', 'Para ti 1', 'Comunidad 1', 'Colección 1', 'Jugar 1', 'Mensajes']) && r.activo === 'todos', JSON.stringify(r))
  check('las filas de la campana, por días y por meses, con los leídos también', r.filas > 15 && r.sinLeer === 4 && r.tramos.includes('Hoy') && r.tramos.includes('Octubre') && !r.tramos.includes('Antes'), JSON.stringify(r))
  check('  …lo sin leer con punto, «Cargar más» (son 70, de 60 en 60) y «Marcar todo como leído» a la vista', r.punto === '8px' && r.pie === 'Cargar más' && r.leerTodo && !r.desborda, JSON.stringify(r))
  await p.click('.av-chip[data-chip="Jugar"]')
  await p.waitForTimeout(300)
  r = await estado(p)
  const soloJugar = await p.evaluate(() => [...document.querySelectorAll('.av-lista .nav-bell-item .nav-bell-seccion')].every((x) => x.textContent === 'Jugar'))
  check('el chip filtra (solo Jugar) y lo escribe en la dirección', r.activo === 'Jugar' && soloJugar && r.filas >= 2 && r.url === '?ver=Jugar', JSON.stringify(r))
  await p.click('.av-chip[data-chip="todos"]')
  await p.waitForTimeout(200)
  // Pulsar una fila sin leer: se marca (escritura con sus ids) y navega.
  await Promise.all([p.waitForURL(/tema\/tema-2/, { timeout: 4000 }).catch(() => null), p.click('.av-lista .nav-bell-item.unread')])
  const escrituras = await p.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'user_notifications'))
  check('pulsar una fila la marca leída (con su id) y lleva a su enlace', /\/tema\/tema-2/.test(p.url()) && escrituras.length >= 1 && escrituras[0].filas.every((f) => f.read_at) && escrituras[0].filas.some((f) => f.id === 'av-0'), p.url() + ' ' + JSON.stringify(escrituras).slice(0, 200))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/avisos', false, muchos())
  await p.click('#avLeerTodo')
  await p.waitForTimeout(600)
  const r = await estado(p)
  const campana = await p.evaluate(() => ({ chapa: document.getElementById('navBellBadge')?.classList.contains('hidden'), avisos: (window.__pdAvisos || []).filter((a) => !a.read_at).length }))
  check('«Marcar todo como leído»: sin puntos, sin números y el botón se va; la campana se entera', r.sinLeer === 0 && JSON.stringify(r.chips) === JSON.stringify(['Todos', 'Para ti', 'Comunidad', 'Colección', 'Jugar', 'Mensajes']) && !r.leerTodo && campana.chapa && campana.avisos === 0, JSON.stringify({ r, campana }))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/avisos', false, muchos(130))
  let r = await estado(p)
  check('crece al bajar: primero 60 (con «Cargar más»)…', r.pie === 'Cargar más' && r.filas > 10, JSON.stringify(r))
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await p.waitForTimeout(1200)
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await p.waitForTimeout(1200)
  r = await estado(p)
  check('  …y al llegar al final trae el resto: «Eso es todo · 130 avisos»', r.pie === 'Eso es todo · 130 avisos', JSON.stringify(r))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/avisos', false, () => { window.__FAKE_NOTIFICACIONES__ = [] })
  const r = await estado(p)
  const salidas = await p.$$eval('.av-vacio .av-salidas > *', (xs) => xs.map((x) => `${x.textContent.trim()}→${x.getAttribute('href') || 'botón'}`))
  check('sin avisos: vacío con salida (Ajustes › Avisos y el foro) y sin el botón de marcar', /Todavía no tienes ningún aviso/.test(r.vacio) && JSON.stringify(salidas) === JSON.stringify(['Qué avisos recibir→/ajustes?ver=avisos', 'Pasarte por el foro→/foro']) && !r.leerTodo, JSON.stringify({ r, salidas }))
  await ctx.close()
}
{
  const ctx = await contexto(b, false, 'none')
  const p = await ctx.newPage()
  await p.goto(`${BASE}/avisos`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  check('sin cuenta manda a entrar, de vuelta a /avisos', /\/auth\.html\?volver=%2Favisos/.test(p.url()), p.url())
  await ctx.close()
}

console.log('── La campana: «Ver todos los avisos» (PC y hoja «Tú» del móvil) ──')
{
  const { p, ctx } = await abrir('/', false, muchos())
  await p.click('#navBellBtn')
  await p.waitForTimeout(800)
  const r = await p.evaluate(() => { const d = document.getElementById('navBellDropdown').getBoundingClientRect(); const pie = document.querySelector('.nav-bell-pie'); const b = pie.getBoundingClientRect(); return { texto: pie.textContent, href: pie.getAttribute('href'), dentro: b.bottom <= d.bottom + 1 && b.top >= d.top, sinLeer: document.querySelectorAll('#navBellList .nav-bell-item').length, leidos: document.querySelectorAll('#navBellList .nav-bell-item:not(.unread)').length } })
  check('el pie se queda a la vista bajo la lista y lleva a /avisos; la campana sigue siendo solo lo sin leer', r.texto === 'Ver todos los avisos' && r.href === '/avisos' && r.dentro && r.sinLeer >= 3 && r.leidos === 0, JSON.stringify(r))
  await ctx.close()
}
{
  const { p, ctx, errores } = await abrir('/avisos', true, muchos())
  const r = await estado(p)
  const cab = await p.evaluate(() => ({ cab: document.querySelector('.av-cab').getBoundingClientRect().height, boton: document.getElementById('avLeerTodo').innerText.trim(), chipsScroll: (() => { const c = document.getElementById('avChips'); return c.scrollWidth > c.clientWidth && getComputedStyle(c).overflowX === 'auto' })() }))
  check('en el móvil: sin errores ni desbordes, cabecera de una línea con «Marcar todo» y los chips en una fila que se desliza', errores.length === 0 && !r.desborda && cab.cab < 70 && cab.boton === 'Marcar todo' && cab.chipsScroll, JSON.stringify({ r, cab, errores }))
  await p.click('#navUserBtn', { timeout: 3000 }).catch(() => null)
  await p.waitForTimeout(600)
  await p.click('[data-tu="avisos"]', { timeout: 3000 }).catch(() => null)
  await p.waitForTimeout(800)
  const hoja = await p.evaluate(() => { const pie = document.querySelector('.tu-avisos-sitio .nav-bell-pie'); return pie ? { visible: pie.getBoundingClientRect().height > 0, href: pie.getAttribute('href') } : null })
  check('  …y en la hoja «Tú» → Avisos, la lista acaba en «Ver todos los avisos»', hoja?.visible && hoja.href === '/avisos', JSON.stringify(hoja))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
