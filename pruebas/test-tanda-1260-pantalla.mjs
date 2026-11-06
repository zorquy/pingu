// Tanda 1260 — los avisos en pantalla. En la web: la franja nueva (con lo que
// queda y «Me apunto»), la tarjeta de Inicio, el pop-up (centrado en el PC,
// hoja abajo en el móvil) que abre `?aviso=` y la franja, «Me apunto» con y
// sin cuenta, las cifras, una tienda que no lo ve y el aviso de antes sin la
// migración. En /admin → Avisos: la lista por estado, crear y publicar un
// concurso (que avisa a la campanita), los apuntados y «Sortear».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
const errores = []

const CONCURSO = { id: 'av-1', tipo: 'concurso', titulo: 'Gana la caja de Funko Pop de los iniciales de Kanto', texto: 'Bulbasaur, Charmander y Squirtle pueden ser tuyos.', sitios: ['popup', 'franja', 'inicio', 'campanita'], participar: true, cuenta_atras: true, recordar: true, publicado: true, publico: 'todos', enlace: '/foro', enlace_texto: 'Bases del concurso' }
async function abrir(ruta, { sesion = 'user-1', avisos = [CONCURSO], movil = false, extra = {}, rpc = '' } = {}) {
  const ctx = await b.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block', hasTouch: movil, isMobile: movil })
  await ctx.addInitScript(({ s, av, ex, rpc }) => {
    if (s) window.__FAKE_SESSION__ = s
    const h = (d) => new Date(Date.now() + d * 3600e3).toISOString()
    window.__FAKE_FILAS__ = { avisos: av.map((a) => ({ publicado_at: h(-2), hasta: h(9 * 24 + 5), ...a })), ...(ex.filas || {}) }
    if (ex.sinTablas) window.__SIN_TABLAS__ = ex.sinTablas
    if (ex.tienda) document.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.seccion = 'tienda' })
    window.__APUNTADOS__ = 4
    window.__RPC_RESPUESTAS__ = {
      aviso_participacion: () => ({ total: window.__APUNTADOS__, yo: false }),
      aviso_apuntarme: () => ({ ok: true, ya: false, total: ++window.__APUNTADOS__ }),
      aviso_contar: null,
      admin_aviso_avisar: { ok: true, personas: 120 },
      admin_aviso_participantes: [{ user_id: 'user-1', username: 'Ash', display_name: 'Ash', created_at: h(-5) }, { user_id: 'user-2', username: 'Misty', display_name: 'Misty', created_at: h(-3) }],
      admin_aviso_sortear: { total: 2, ganador: { id: 'user-2', username: 'Misty', display_name: 'Misty' } },
    }
    if (rpc) eval(rpc)
  }, { s: sesion, av: avisos, ex: extra, rpc })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await ctx.route((u) => /\.(webp|png|jpg)(\?|$)/.test(String(u)) && /supabase\.co/.test(String(u)), (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#e0b252"/></svg>' }))
  const page = await ctx.newPage()
  // El salto entre páginas en un navegador sin pantalla aborta la transición
  // («ViewTransition opt-in disabled», como en la 1237b): no es de esta tanda.
  page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'|ViewTransition/.test(String(e))) errores.push(`${ruta}: ${String(e).slice(0, 180)}`) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, ctx }
}
const rpcs = (page, nombre) => page.evaluate((n) => (window.__RPCS__ || []).filter((r) => r.nombre === n).map((r) => r.args), nombre)

console.log('── 1. Inicio en el PC, con cuenta ──')
{
  const { page, ctx } = await abrir('/')
  const franja = page.locator('.aviso-global[data-tipo="concurso"]')
  check('la franja del concurso, con lo que queda y «Me apunto»', (await franja.count()) === 1 && /Concurso:/.test(await franja.textContent()) && /Quedan 9 días/.test(await franja.textContent()) && (await franja.locator('[data-abrir-aviso]').isVisible()))
  const despues = await page.evaluate(() => { const n = document.querySelector('.navbar'); const f = document.querySelector('.aviso-global'); return [Boolean(n.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING), f.getBoundingClientRect().top - n.getBoundingClientRect().bottom] })
  check('  …debajo de la barra', despues[0] && Math.abs(despues[1]) < 2, JSON.stringify(despues))
  const tarjeta = page.locator('#avisoPortada .aviso-tarjeta')
  check('la tarjeta de Inicio, encima de los bloques, con su chapa y lo que queda', (await tarjeta.count()) === 1 && /Quedan 9 días · hasta el/.test(await tarjeta.textContent()) && (await page.evaluate(() => document.querySelector('.portada-principal').firstElementChild?.id === 'avisoPortada')))
  check('el pop-up NO se abre solo a un navegador automático', (await page.locator('dialog.aviso-pop').count()) === 0)
  const vistos = await rpcs(page, 'aviso_contar')
  check('cuenta «visto» una vez', vistos.filter((a) => a.p_que === 'visto' && a.p_aviso === 'av-1').length === 1, JSON.stringify(vistos))
  await franja.locator('[data-abrir-aviso]').click()
  await page.waitForSelector('dialog.aviso-pop[open]', { timeout: 4000 }).catch(() => {})
  const pop = page.locator('dialog.aviso-pop[open]')
  check('«Me apunto» de la franja abre el pop-up', (await pop.count()) === 1)
  const caja = await pop.boundingBox()
  // Centrado por sus márgenes (la animación de entrada mueve la caja unos px).
  const margenes = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('dialog.aviso-pop')); return [c.marginTop, c.marginBottom, c.marginLeft, c.marginRight].map(parseFloat) })
  check('  …centrado en el PC', caja && Math.abs(margenes[0] - margenes[1]) < 1 && Math.abs(margenes[2] - margenes[3]) < 1 && margenes[0] > 100 && caja.width === 680, JSON.stringify(margenes))
  check('  …con título, cuenta atrás (9 días), el enlace pequeño y cuántos van', /Gana la caja/.test(await pop.textContent()) && (await pop.locator('.aviso-cuenta b').first().textContent()) === '9' && (await pop.locator('a[href="/foro"]').textContent()) === 'Bases del concurso' && /Ya se han apuntado 4 personas/.test(await pop.textContent()))
  check('  …y la página de detrás quieta', (await page.evaluate(() => getComputedStyle(document.documentElement).overflow)) === 'hidden')
  await pop.locator('[data-apuntarme]').click()
  await page.waitForTimeout(500)
  check('«Me apunto»: el botón cambia y dice cuántos sois', /Ya estás dentro/.test(await pop.locator('.aviso-pop-boton').textContent()) && (await pop.locator('.aviso-pop-boton').isDisabled()) && /Ya sois 5 apuntados/.test(await pop.textContent()))
  check('  …llamando a aviso_apuntarme y contando el clic', (await rpcs(page, 'aviso_apuntarme')).length === 1 && (await rpcs(page, 'aviso_contar')).some((a) => a.p_que === 'clic'))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Escape lo cierra (y no cuenta «cerrado»: ya hizo algo)', (await page.locator('dialog.aviso-pop').count()) === 0 && !(await rpcs(page, 'aviso_contar')).some((a) => a.p_que === 'cerrado'))
  await page.click('.aviso-global-cerrar')
  check('cerrar la franja la quita y cuenta «cerrado»', (await page.locator('.aviso-global').count()) === 0 && (await rpcs(page, 'aviso_contar')).some((a) => a.p_que === 'cerrado'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  check('  …y al volver sigue cerrada (la tarjeta de Inicio no)', (await page.locator('.aviso-global').count()) === 0 && (await page.locator('.aviso-tarjeta').count()) === 1)
  await ctx.close()
}

console.log('── 2. El enlace de la campanita, sin cuenta ──')
{
  const { page, ctx } = await abrir('/foro.html?aviso=av-1', { sesion: 'none' })
  await page.waitForSelector('dialog.aviso-pop[open]', { timeout: 4000 }).catch(() => {})
  check('`?aviso=` abre el pop-up en cualquier página', (await page.locator('dialog.aviso-pop[open]').count()) === 1)
  check('  …sin tarjeta fuera de Inicio', (await page.locator('.aviso-tarjeta').count()) === 0)
  await Promise.all([page.waitForURL(/auth\.html/, { timeout: 5000 }).catch(() => {}), page.click('dialog.aviso-pop [data-apuntarme]')])
  const u = new URL(page.url())
  check('sin cuenta, «Me apunto» lleva a registrarse y vuelve al aviso', /auth\.html$/.test(u.pathname) && u.searchParams.get('registro') === '1' && u.searchParams.get('volver') === '/foro.html?aviso=av-1', page.url())
  await ctx.close()
}

console.log('── 3. En el móvil ──')
{
  const { page, ctx } = await abrir('/', { movil: true })
  const franja = page.locator('.aviso-global')
  const alto = (await franja.boundingBox())?.height || 0
  check('la franja en una línea (sin botón; el texto se corta)', alto > 0 && alto <= 60 && !(await franja.locator('[data-abrir-aviso]').isVisible()), alto)
  await franja.locator('.aviso-global-texto').click()
  await page.waitForSelector('dialog.aviso-pop[open]', { timeout: 4000 }).catch(() => {})
  const caja = await page.locator('dialog.aviso-pop[open]').boundingBox()
  const abajo = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('dialog.aviso-pop')); return [parseFloat(c.marginBottom), parseFloat(c.marginTop)] })
  check('tocar la franja abre el pop-up como hoja desde abajo', caja && abajo[0] === 0 && abajo[1] > 100 && caja.width >= 389, JSON.stringify([caja, abajo]))
  check('  …y cabe sin desbordar el ancho', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await page.click('dialog.aviso-pop .aviso-pop-ahora-no')
  await page.waitForTimeout(300)
  check('«Ahora no» lo cierra y cuenta «cerrado»', (await page.locator('dialog.aviso-pop').count()) === 0 && (await rpcs(page, 'aviso_contar')).some((a) => a.p_que === 'cerrado'))
  await ctx.close()
}

console.log('── 4. A quién ──')
{
  const h = (d) => new Date(Date.now() + d * 3600e3).toISOString()
  let r = await abrir('/', { avisos: [{ ...CONCURSO, publico: 'sin_cuenta' }] })
  check('«Sin cuenta» no sale a quien tiene cuenta', (await r.page.locator('.aviso-global, .aviso-tarjeta').count()) === 0)
  await r.ctx.close()
  r = await abrir('/', { avisos: [{ ...CONCURSO, hasta: h(-1) }] })
  check('un aviso terminado no sale', (await r.page.locator('.aviso-global, .aviso-tarjeta').count()) === 0)
  await r.ctx.close()
  r = await abrir('/', { avisos: [{ ...CONCURSO, id: 'n', tipo: 'novedad', sitios: ['franja'], participar: false, boton_texto: 'Ver', boton_enlace: '/novedades', titulo: 'Novedad' }, { ...CONCURSO, id: 'm', tipo: 'mantenimiento', sitios: ['franja'], participar: false, titulo: 'Esta noche la web irá lenta' }] })
  check('con dos franjas sale la más urgente (mantenimiento)', (await r.page.locator('.aviso-global').count()) === 1 && (await r.page.getAttribute('.aviso-global', 'data-tipo')) === 'mantenimiento')
  await r.ctx.close()
  r = await abrir('/tienda.html', { sesion: 'user-2', extra: { tienda: true, filas: { tiendas: [{ user_id: 'user-2' }] } }, avisos: [CONCURSO, { ...CONCURSO, id: 'm', tipo: 'mantenimiento', sitios: ['franja'], participar: false, titulo: 'Esta noche la web irá lenta' }] })
  check('una tienda solo ve el de mantenimiento', (await r.page.locator('.aviso-global').count()) === 1 && (await r.page.getAttribute('.aviso-global', 'data-tipo')) === 'mantenimiento')
  await r.ctx.close()
  r = await abrir('/', { avisos: [], extra: { sinTablas: ['avisos'], filas: { site_settings: [{ key: 'aviso_global', value: { texto: 'Torneo el sábado', tono: 'aviso', enlace: '/torneos', texto_enlace: 'Apúntate', activo: true } }] } } })
  check('sin la migración, el aviso de antes sigue saliendo en la franja', (await r.page.locator('.aviso-global[data-tipo="aviso"]').count()) === 1 && /Torneo el sábado/.test(await r.page.textContent('.aviso-global')) && (await r.page.getAttribute('.aviso-global a', 'href')) === '/torneos')
  await r.ctx.close()
}

console.log('── 5. /admin → Avisos ──')
{
  const h = (d) => new Date(Date.now() + d * 3600e3).toISOString()
  const avisos = [{ ...CONCURSO, created_at: h(-20) }, { id: 'av-2', tipo: 'mantenimiento', titulo: 'Esta noche la web puede ir lenta', sitios: ['franja'], publicado: true, desde: h(30), publico: 'todos', created_at: h(-2) }, { id: 'av-3', tipo: 'novedad', titulo: 'Borrador de novedad', sitios: ['franja'], publicado: false, publico: 'todos', created_at: h(-1) }]
  const { page, ctx } = await abrir('/admin/?ver=avisos', { sesion: 'admin-1', avisos, extra: { filas: { aviso_cifras: [{ aviso_id: 'av-1', dia: '2026-11-06', vistos: 1204, clics: 318, cerrados: 85 }, { aviso_id: 'av-1', dia: '2026-11-07', vistos: 96, clics: 2, cerrados: 5 }] } } })
  await page.waitForSelector('.av-fila', { timeout: 8000 }).catch(() => {})
  check('la lista empieza en «En marcha», con las cuentas de cada pestaña', /En marcha\s*1/.test(await page.textContent('[data-pestana="en_marcha"]')) && /Programados\s*1/.test(await page.textContent('[data-pestana="programado"]')) && /Borradores\s*1/.test(await page.textContent('[data-pestana="borrador"]')) && (await page.locator('.av-fila').count()) === 1)
  check('  …la fila con su estado, dónde sale y las cifras sumadas (1.300 vistos)', /quedan 9 días/.test(await page.textContent('.av-fila')) && (await page.locator('.av-fila .av-donde svg').count()) === 4 && /1\.300\s*lo vieron/.test(await page.textContent('.av-fila')))
  await page.click('[data-pestana="programado"]')
  check('  …y «Programados» dice cuándo sale', /Sale el/.test(await page.textContent('.av-fila')))
  await page.click('[data-pestana="en_marcha"]')
  await page.click('[data-abrir="av-1"]')
  await page.waitForSelector('#avDetalle .av-apuntados-lista', { timeout: 5000 }).catch(() => {})
  check('al abrir uno: sus cifras y los apuntados', /1\.300/.test(await page.textContent('#avDetalle')) && (await page.locator('.av-apuntados-lista li').count()) === 2)
  await page.click('[data-accion="sortear"]')
  await page.waitForTimeout(600)
  check('«Sortear» llama a la base y lo dice', (await rpcs(page, 'admin_aviso_sortear')).length === 1 && /Ha ganado @Misty/.test(await page.textContent('body')))
  for (const s of ['franja', 'inicio', 'campanita', 'popup']) {
    await page.click(`[data-previa="${s}"]`)
    const ok = await page.locator({ franja: '#avPrevia .aviso-global', inicio: '#avPrevia .aviso-tarjeta', campanita: '#avPrevia .aviso-campanita-fila', popup: '#avPrevia .aviso-pop-caja' }[s]).count()
    if (!ok) check(`la vista previa pinta «${s}»`, false)
  }
  check('la vista previa pinta los cuatro sitios con las piezas de la web', true)
  await page.click('[data-volver]')
  await page.click('.av-nuevo')
  await page.waitForSelector('#avTitulo')
  check('un aviso nuevo empieza como concurso, con sus cuatro sitios y «Me apunto»', (await page.getAttribute('[data-av-tipo="concurso"]', 'aria-checked')) === 'true' && (await page.locator('[data-sitio]:checked').count()) === 4 && (await page.isChecked('#avParticipar')))
  await page.click('[data-av-tipo="mantenimiento"]')
  check('  …y al cambiar de tipo se rellena con su plantilla (mantenimiento: solo la franja)', (await page.locator('[data-sitio]:checked').count()) === 1 && !(await page.isChecked('#avParticipar')))
  await page.click('[data-av-tipo="concurso"]')
  await page.fill('#avTitulo', 'Sorteo de Navidad')
  check('la vista previa cambia mientras escribes', /Sorteo de Navidad/.test(await page.textContent('#avPrevia')))
  await page.fill('#avEnlace', 'javascript:alert(1)')
  check('un enlace raro avisa', await page.isVisible('#avEnlacesNota'))
  await page.fill('#avEnlace', '/foro')
  await page.setInputFiles('#avImagenArchivo', { name: 'caja.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') })
  await page.waitForTimeout(1500)
  check('la imagen se sube al cubo «avisos» y sale en la vista previa', /\/avisos\//.test(await page.inputValue('#avImagen')) && (await page.locator('#avPrevia img').count()) === 1, await page.inputValue('#avImagen'))
  await page.click('[data-guardar="publicar"]')
  await page.waitForTimeout(1200)
  const fila = await page.evaluate(() => (window.__TABLAS__.avisos || []).find((a) => a.titulo === 'Sorteo de Navidad'))
  check('«Publicar» guarda el aviso publicado con lo elegido', fila?.publicado === true && fila.tipo === 'concurso' && fila.participar === true && fila.sitios.length === 4 && fila.enlace === '/foro' && /\/avisos\//.test(fila.imagen || ''), JSON.stringify(fila))
  check('  …y lo manda a la campanita (admin_aviso_avisar)', (await rpcs(page, 'admin_aviso_avisar')).length === 1 && /mandado a 120 personas/.test(await page.textContent('body')))
  await ctx.close()
  const r = await abrir('/admin/?ver=avisos', { sesion: 'admin-1', avisos: [], extra: { sinTablas: ['avisos'] } })
  await r.page.waitForTimeout(500)
  check('sin la migración, el panel dice qué falta', /supabase-migration-1260-avisos\.sql/.test(await r.page.textContent('#avisosPanel')))
  await r.ctx.close()
}

check('sin errores', !errores.length, errores.join(' | '))
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
