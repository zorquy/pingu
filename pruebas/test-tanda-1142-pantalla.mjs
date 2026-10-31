// Tanda 1142 — «La campana y los números» (PINGU eligió A1, A2 y A3):
// A1, abrir la página a la que apunta un aviso lo da por leído; A2, la campana
// (y el avatar del móvil) cuenta solo lo que no es de una sección, y su lista
// separa «Para ti» de «En tus secciones» con etiqueta; A3, Colección cuenta los
// cambios, los cruces, las alertas de precio y las tiendas, y el número se
// repite en la página (Foro, Torneos, Deseos y cambios).
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const N = await import(`${RAIZ}/js/numeros-seccion.js`)
  check('Colección: cambios, cruces, precio y tiendas', ['cambio_propuesta', 'trade_match', 'trade_match_seguido', 'aviso_precio', 'tienda_la_tiene'].every((t) => N.seccionDeAviso(t) === 'Colección'))
  check('  …y lo tuyo no es de ninguna', ['new_follower', 'guide_helpful', 'guide_comment', 'aviso_equipo', 'reward'].every((t) => N.seccionDeAviso(t) === null))
  const avisos = [{ type: 'forum_reply' }, { type: 'cambio_propuesta' }, { type: 'aviso_precio' }, { type: 'torneo_ronda' }, { type: 'new_follower' }, { type: 'new_follower', read_at: 'x' }]
  const c = N.cuentasDeSecciones(avisos, '2')
  check('cuentas por sección', c.Comunidad === 3 && c.Jugar === 1 && c['Colección'] === 2 && c.Mensajes === 2, JSON.stringify(c))
  check('  …y por página', JSON.stringify(c.paginas) === JSON.stringify({ foro: 1, torneos: 1, cambios: 2, mensajes: 2 }), JSON.stringify(c.paginas))
  check('la campana: solo lo sin leer y sin sección', N.avisosSinSeccion(avisos).length === 1)
  const loc = (u) => { const x = new URL(u, 'https://pokedoc.es'); return { pathname: x.pathname, search: x.search, host: x.host } }
  check('A1: el tema con su ancla casa con el tema', N.casaConLaPagina('/tema/12#mensaje-80', loc('/tema/12')) && N.casaConLaPagina('/tema/12', loc('/tema/12?p=2')))
  check('  …con o sin .html, y con los parámetros del aviso', N.casaConLaPagina('/torneos.html', loc('/torneos')) && N.casaConLaPagina('/torneo?slug=copa', loc('/torneo.html?slug=copa&ver=rondas')))
  check('  …otro tema u otro torneo, no', !N.casaConLaPagina('/tema/12', loc('/tema/13')) && !N.casaConLaPagina('/torneo?slug=copa', loc('/torneo?slug=liga')))
  check('  …la portada no «lee» nada', !N.casaConLaPagina('/', loc('/')) && !N.casaConLaPagina('/index.html', loc('/')))
  check('  …ni un enlace de fuera', !N.casaConLaPagina('https://otra.com/tema/12', loc('/tema/12')) && N.casaConLaPagina('https://pokedoc.es/tema/12', loc('/tema/12')))
  check('  …ni uno vacío', !N.casaConLaPagina(null, loc('/tema/12')) && !N.casaConLaPagina('', loc('/')))
  const deAqui = N.avisosDeEstaPagina([{ id: 1, link: '/tema/12#m' }, { id: 2, link: '/tema/12', read_at: 'x' }, { id: 3, link: '/tema/9' }], loc('/foro'), loc('/tema/12'))
  check('  …y de una lista, los sin leer de cualquiera de las dos direcciones', deAqui.map((a) => a.id).join() === '1')
  const el = (href, pestania) => ({ getAttribute: () => href, dataset: pestania ? { pestania } : {} })
  check('la página de un enlace', N.paginaDeEnlace(el('/foro.html')) === 'foro' && N.paginaDeEnlace(el('/torneos')) === 'torneos' && N.paginaDeEnlace(el('/mi-coleccion?ver=mercado')) === 'cambios' && N.paginaDeEnlace(el(null, 'mercado')) === 'cambios' && N.paginaDeEnlace(el('/usuarios.html')) === null)
  const G = await import(`${RAIZ}/js/avisos-grupos.js`)
  const bl = G.bloquesDeAvisos(avisos)
  check('los dos bloques de la campana', bl.paraTi.length === 2 && bl.enSecciones.length === 4)
}

const conAvisos = () => {
  const ahora = Date.now()
  const hace = (m) => new Date(ahora - m * 60000).toISOString()
  const quien = window.__FAKE_SESSION__
  window.__FAKE_NOTIFICACIONES__ = [
    ...(window.__FAKE_NOTIFICACIONES__ || []),
    { recipient_id: quien, type: 'torneo_ronda', title: 'Ronda 2 publicada', link: '/torneo?slug=copa-delta', created_at: hace(5) },
    { recipient_id: quien, type: 'cambio_propuesta', title: 'Ash te propone un cambio', link: '/mi-coleccion?ver=cambios#oferta-7', created_at: hace(8) },
    { recipient_id: quien, type: 'new_follower', title: 'Brock te sigue', link: '/usuario/Brock', created_at: hace(9) },
  ]
}
const numeros = (page, sel) => page.$$eval(sel, (as) => Object.fromEntries(as.map((a) => [a.querySelector('span:not(.sec-num)')?.textContent.trim(), a.querySelector('.sec-num')?.textContent || ''])))

const b = await chromium.launch()
console.log('── 2. Móvil: barra, burbuja y avatar ──')
{
  const ctx = await contexto(b, true, 'user-1', conAvisos)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const n = await numeros(page, 'nav.bm > a')
  check('Comunidad 1, Jugar 1 y Colección 1', n.Comunidad === '1' && n.Jugar === '1' && n['Colección'] === '1', JSON.stringify(n))
  const avatar = await page.$eval('#navUserBtn', (b) => b.querySelector('.bm-punto')?.textContent || '').catch(() => 'sin botón')
  check('el avatar dice 1: solo lo tuyo (el seguidor)', avatar === '1', avatar)
  const burbuja = await page.$$eval('.bm-burbuja-item', (as) => as.map((a) => `${a.getAttribute('href')}:${a.querySelector('.sec-num')?.textContent || ''}`))
  check('la burbuja lleva el 1 en Foro y en nada más', burbuja.some((x) => /foro.*:1$/.test(x)) && burbuja.filter((x) => /:\d/.test(x)).length === 1, burbuja.join(' '))
  const dentro = await page.$eval('.bm-burbuja-item .sec-num', (e) => { const r = e.getBoundingClientRect(); const a = e.closest('.bm-burbuja-item').getBoundingClientRect(); return r.top >= a.top - 1 && r.bottom <= a.bottom + 1 && getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)' })
  check('  …dentro de la píldora y pintada', dentro)
  await page.screenshot({ path: '/tmp/1142-burbuja.png' })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. A1: abrir el tema lo da por leído ──')
{
  const ctx = await contexto(b, true, 'user-1', conAvisos)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/tema/tema-2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const leido = await page.evaluate(() => (window.__TABLAS__?.user_notifications || []).find((a) => a.type === 'forum_reply' && a.link === '/tema/tema-2')?.read_at || null)
  check('el aviso del tema queda leído en la base', Boolean(leido), String(leido))
  const n = await numeros(page, 'nav.bm > a')
  check('  …y Comunidad se queda sin número', !n.Comunidad && n.Jugar === '1', JSON.stringify(n))
  const otros = await page.evaluate(() => (window.__TABLAS__?.user_notifications || []).filter((a) => a.type !== 'forum_reply' && !a.read_at && a.type !== 'new_follower' ? true : false).length)
  check('  …y los demás siguen sin leer', otros === 2, otros)
  await ctx.close()
}

console.log('── 4. PC: la campana y la lateral ──')
{
  const ctx = await contexto(b, false, 'user-1', conAvisos)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const campana = await page.$eval('#navBellBadge', (b) => (b.classList.contains('hidden') ? '' : b.textContent))
  check('la campana dice 1 (el seguidor), no 4', campana === '1', campana)
  const n = await numeros(page, '.lat-seccion-enlace')
  check('la lateral: Comunidad, Jugar y Colección con 1', n.Comunidad === '1' && n.Jugar === '1' && n['Colección'] === '1', JSON.stringify(n))
  await page.click('#navBellBtn')
  await page.waitForTimeout(800)
  const lista = await page.$eval('#navBellList', (l) => ({ bloques: [...l.querySelectorAll('.nav-bell-bloque')].map((p) => p.textContent), etiquetas: [...l.querySelectorAll('.nav-bell-seccion')].map((s) => s.textContent), primero: l.querySelector('.nav-bell-item')?.textContent.trim().slice(0, 30) }))
  check('la lista: «Para ti» y «En tus secciones»', lista.bloques.join('|') === 'Para ti|En tus secciones', JSON.stringify(lista))
  check('  …lo tuyo primero', /Brock/.test(lista.primero || ''), lista.primero)
  check('  …y lo de las secciones con su etiqueta', ['Comunidad', 'Jugar', 'Colección'].every((s) => lista.etiquetas.includes(s)), lista.etiquetas.join())
  const color = await page.$$eval('.nav-bell-seccion', (es) => new Set(es.map((e) => getComputedStyle(e).color)).size)
  check('  …cada sección de su color', color === 3, color)
  await page.screenshot({ path: '/tmp/1142-campana.png' })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Deseos y cambios con su número ──')
{
  const ctx = await contexto(b, true, 'user-1', conAvisos)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const t = await page.$eval('.mc-pestania[data-pestania="mercado"]', (e) => e.querySelector('.sec-num')?.textContent || '').catch(() => 'sin pestaña')
  check('la pestaña Deseos y cambios lleva el 1', t === '1', t)
  await page.screenshot({ path: '/tmp/1142-coleccion.png' })
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
