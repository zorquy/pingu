// Tanda 1192 — Eventos en pantalla: la agenda (/eventos) con filtros por tipo y
// provincia, «Solo a los que voy» y lo pasado debajo; «Voy» que cambia ya y
// deshace si falla; la ficha (/eventos/<slug>) con quién va, ir «sin decirlo»,
// los enlaces (web, Instagram, mapa, TCG Map Spain) y «Abrir mi modo evento»;
// sin cuenta, «Voy» lleva a registrarse; sin la migración, «llega muy pronto».
// En /admin → Eventos se da de alta uno y sale en la agenda; y en la portada,
// el más cercano de los próximos 14 días al lado del torneo.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const sembrar = () => {
  const d = (dias, h = 10) => { const x = new Date(); x.setDate(x.getDate() + dias); x.setHours(h, 0, 0, 0); return x.toISOString() }
  window.__FAKE_EVENTOS__ = [
    { id: 'e1', slug: 'castellon-card-show-2026', nombre: 'Castellón Card Show', tipo: 'card_show', empieza: d(4), termina: d(4, 19), sitio: 'Recinto Ferial', ciudad: 'Castellón de la Plana', provincia: 'Castellón', siglas: 'CCS', color: '#c62a5c', entrada: '3 € · menores gratis', juegos: 'Pokémon · One Piece', web: 'castelloncardshow.es', instagram: '@castelloncardshow', tcgmap_url: 'https://tcgmapspain.com/evento/ccs', publicado: true, asistentes: [{ user_id: 'user-2' }, { user_id: 'mod-1' }, { user_id: 'user-3', oculto: true }] },
    { id: 'e2', slug: 'iberian-card-show-2026', nombre: 'Iberian Card Show', tipo: 'card_show', empieza: d(12), termina: d(12, 20), sitio: 'Pabellón Cristal', ciudad: 'Madrid', provincia: 'Madrid', color: '#5f43d9', publicado: true, asistentes: [{ user_id: 'user-2' }] },
    { id: 'e3', slug: 'trade-night-valencia', nombre: 'Trade Night PokeDoc', tipo: 'quedada', empieza: d(19, 19), ciudad: 'Valencia', provincia: 'Valencia', publicado: true, asistentes: [] },
    { id: 'e4', slug: 'portugaltcg-show', nombre: 'PortugalTCG Show', tipo: 'card_show', empieza: d(-3), ciudad: 'Setúbal', provincia: 'Portugal', publicado: true, asistentes: [{ user_id: 'user-2' }, { user_id: 'user-3' }] },
    { id: 'e5', slug: 'borrador', nombre: 'Borrador sin publicar', tipo: 'card_show', empieza: d(2), publicado: false, asistentes: [] },
  ]
}
const sinNada = () => {}

async function abrir(b, ruta, { movil = false, quien = 'user-1', extra = sembrar, antes = null } = {}) {
  const ctx = await contexto(b, movil, quien, extra)
  if (antes) await ctx.addInitScript(antes)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/serviceWorker' property/.test(String(e))) errores.push(String(e).slice(0, 160)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1600)
  return { ctx, page, errores }
}
const textos = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()))

const b = await chromium.launch()

console.log('── 1. La agenda, con cuenta ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos')
  const prox = await textos(page, '#evProximosT ~ .ev-carteles .ev-tarjeta-texto strong')
  check('próximos, del más cercano al más lejano, sin el que no está publicado', JSON.stringify(prox) === JSON.stringify(['Castellón Card Show', 'Iberian Card Show', 'Trade Night PokeDoc']), JSON.stringify(prox))
  const pas = await textos(page, '#evPasadosT + .ev-carteles .ev-tarjeta-texto strong')
  check('lo pasado, debajo y apagado, sin «Voy»', pas.length === 1 && pas[0] === 'PortugalTCG Show' && (await page.$eval('#evPasadosT + .ev-carteles .ev-tarjeta', (li) => li.classList.contains('pasado') && !li.querySelector('[data-voy]'))), JSON.stringify(pas))
  const van = await page.$eval('#evProximosT ~ .ev-carteles .ev-tarjeta', (li) => li.querySelector('[data-van]').textContent)
  check('cuántos van cuenta también los que van sin decirlo', van === '3 van', van)
  check('las caras son solo las de los que se ven', (await page.$$eval('#evProximosT ~ .ev-carteles .ev-tarjeta:first-child .ev-cara', (x) => x.length)) === 2)
  await page.click('.chip-filtro[data-tipo="quedada"]')
  check('el chip «Quedada» deja solo las quedadas', JSON.stringify(await textos(page, '#evProximosT ~ .ev-carteles .ev-tarjeta-texto strong')) === '["Trade Night PokeDoc"]')
  await page.click('.chip-filtro[data-tipo=""]')
  await page.selectOption('#evProvincia', 'Madrid')
  check('la provincia deja solo lo de esa provincia', JSON.stringify(await textos(page, '#evProximosT ~ .ev-carteles .ev-tarjeta-texto strong')) === '["Iberian Card Show"]')
  await page.selectOption('#evProvincia', '')
  await page.click('#evSoloVoy')
  check('«Solo a los que voy» sin ninguno lo dice', /no has marcado «Voy»/.test(await page.textContent('#eventos')))
  await page.click('#evSoloVoy')
  // «Voy» cambia ya y se confirma.
  await page.click('[data-voy="e2"]')
  await page.waitForTimeout(300)
  const tras = await page.$eval('[data-voy="e2"]', (x) => ({ p: x.getAttribute('aria-pressed'), van: x.closest('.ev-tarjeta').querySelector('[data-van]').textContent }))
  check('«Voy» se marca y suma uno', tras.p === 'true' && tras.van === '2 van', JSON.stringify(tras))
  await page.click('#evSoloVoy')
  check('  …y con «Solo a los que voy», sale ese', JSON.stringify(await textos(page, '#evProximosT ~ .ev-carteles .ev-tarjeta-texto strong')) === '["Iberian Card Show"]')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. «Voy» que falla se deshace ──')
{
  const { ctx, page } = await abrir(b, '/eventos')
  // Lo despublican mientras miras: la base dice «Ese evento no existe».
  await page.evaluate(() => { window.__FAKE_EVENTOS__.find((e) => e.id === 'e3').publicado = false })
  await page.click('[data-voy="e3"]')
  await page.waitForTimeout(400)
  const st = await page.$eval('[data-voy="e3"]', (x) => ({ p: x.getAttribute('aria-pressed'), van: x.closest('.ev-tarjeta').querySelector('[data-van]').textContent }))
  check('si la base dice que no, vuelve como estaba y avisa', st.p === 'false' && st.van === 'Sé el primero' && /guardar/.test(await page.textContent('body')), JSON.stringify(st))
  await ctx.close()
}

console.log('── 3. La ficha ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos/castellon-card-show-2026')
  check('el título y la cabecera', (await page.textContent('.ev-cab h1')) === 'Castellón Card Show' && /Castellón Card Show/.test(await page.title()))
  const gente = await textos(page, '.ev-gente li')
  check('quién va: los que se ven, y el número con los que no', gente.length === 2 && /3 personas van/.test(await page.textContent('.ev-cuantos')) && /1 sin decirlo/.test(await page.textContent('.ev-cuantos')), JSON.stringify(gente))
  const enlaces = await page.$$eval('.ev-datos a, .ev-caja a', (as) => as.map((a) => a.href))
  check('web, Instagram, mapa y TCG Map Spain', enlaces.some((h) => h === 'https://castelloncardshow.es/') && enlaces.some((h) => h === 'https://www.instagram.com/castelloncardshow/') && enlaces.some((h) => /google\.com\/maps/.test(h)) && enlaces.some((h) => /tcgmapspain\.com/.test(h)), JSON.stringify(enlaces))
  check('sin ir, no hay «sin decirlo» ni modo evento', !(await page.$('#evOculto')) && !(await page.$('a[href="/evento"]')))
  await page.click('.ev-acciones [data-voy]')
  await page.waitForTimeout(300)
  check('al marcar «Voy»: el número sube, sale «Ir sin decirlo» y «Abrir mi modo evento»', /4 personas van/.test(await page.textContent('.ev-cuantos')) && !!(await page.$('#evOculto')) && !!(await page.$('a[href="/evento"]')))
  check('  …y sales en la lista', (await page.$$eval('.ev-gente li', (x) => x.length)) === 3)
  await page.check('#evOculto')
  await page.waitForTimeout(300)
  check('«Ir sin decirlo» te quita de la lista y sigues contando', (await page.$$eval('.ev-gente li', (x) => x.length)) === 2 && /4 personas van/.test(await page.textContent('.ev-cuantos')) && (await page.isChecked('#evOculto')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Sin cuenta, el móvil y lo que no existe ──')
{
  const { ctx, page, errores } = await abrir(b, '/eventos', { quien: 'none', movil: true })
  const voy = await page.$eval('#evProximosT ~ .ev-carteles .ev-voy', (a) => a.getAttribute('href'))
  check('sin cuenta, «Voy» lleva a registrarse y vuelve al evento', /\/auth\.html\?registro=1&volver=%2Feventos%2Fcastellon-card-show-2026/.test(voy || ''), voy)
  check('sin cuenta no hay «Solo a los que voy»', !(await page.$('#evSoloVoy')))
  check('en el móvil no se sale de lado', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.goto(`${BASE}/eventos/no-existe`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  check('un evento que no existe lo dice, con la agenda a mano', /no existe/.test(await page.textContent('#eventos')) && !!(await page.$('#eventos a[href="/eventos"]')))
  await page.goto(`${BASE}/eventos/borrador`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  check('uno sin publicar no se ve', /no existe/.test(await page.textContent('#eventos')))
  await ctx.close()
  const sin = await abrir(b, '/eventos', { extra: sinNada })
  check('sin la migración: «llega muy pronto», sin errores', /llega muy pronto/.test(await sin.page.textContent('#eventos')) && !sin.errores.length, sin.errores.join(' | '))
  await sin.ctx.close()
}

console.log('── 5. El menú ──')
{
  const { ctx, page } = await abrir(b, '/eventos')
  check('«Eventos» en el menú de Comunidad, y la página es de Comunidad', (await page.$$eval('a[href="/eventos"]', (as) => as.length)) >= 1 && (await page.getAttribute('html', 'data-seccion')) === 'comunidad')
  await ctx.close()
}

console.log('── 6. /admin → Eventos ──')
{
  const { ctx, page, errores } = await abrir(b, '/admin/?ver=eventos', { quien: 'admin-1' })
  await page.waitForSelector('#eventosPanel .evadm-fila', { timeout: 8000 }).catch(() => {})
  const filas = await textos(page, '#eventosPanel .evadm-cuerpo b')
  check('la lista con todos, también el borrador (marcado)', filas.length === 5 && /Sin publicar/.test(await page.textContent('#eventosPanel')), JSON.stringify(filas))
  await page.click('#evNuevo')
  await page.fill('#evf-nombre', 'Gijón Trade Day')
  await page.selectOption('#evf-tipo', 'trade_day')
  // El día en el calendario (1193): si cae en el mes siguiente, se pasa de mes.
  const dia = await page.evaluate(() => { const x = new Date(); x.setDate(x.getDate() + 6); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}` })
  if (!(await page.$(`[data-cal-dia="${dia}"]`))) await page.click('[data-cal-mes="1"]')
  await page.click(`[data-cal-dia="${dia}"]`)
  await page.fill('#evf-ciudad', 'Gijón')
  await page.fill('#evf-provincia', 'Asturias')
  await page.fill('#evf-tcgmap_url', 'https://tcgmapspain.com/evento/gijon')
  check('la vista previa del logo pinta las siglas del nombre', (await page.textContent('#evfLogoVista')) === 'GTD')
  await page.click('#evfGuardar')
  await page.waitForTimeout(600)
  const nueva = await page.evaluate(() => window.__FAKE_EVENTOS__.find((e) => e.nombre === 'Gijón Trade Day'))
  check('guardar lo crea con su dirección (nombre y año), publicado', nueva && nueva.slug === `gijon-trade-day-${new Date(Date.now() + 6 * 864e5).getFullYear()}` && nueva.publicado === true && nueva.tipo === 'trade_day', JSON.stringify(nueva))
  check('  …y sale en la lista', (await textos(page, '#eventosPanel .evadm-cuerpo b')).includes('Gijón Trade Day'))
  await page.click('[data-ev-editar="e3"]')
  await page.fill('[data-entrada="0"] [data-campo="precio"]', '0')
  await page.click('#evfGuardar')
  await page.waitForTimeout(500)
  check('editar guarda solo en ese', (await page.evaluate(() => window.__FAKE_EVENTOS__.find((e) => e.id === 'e3').entrada)) === 'General Gratis')
  await page.click('[data-ev-editar="e3"]')
  await page.click('#evfBorrar')
  check('borrar pide un segundo toque', (await page.evaluate(() => window.__FAKE_EVENTOS__.some((e) => e.id === 'e3'))) && /Seguro/.test(await page.textContent('#evfBorrar')))
  await page.click('#evfBorrar')
  await page.waitForTimeout(500)
  check('  …y al segundo, se va', !(await textos(page, '#eventosPanel .evadm-cuerpo b')).includes('Trade Night PokeDoc'))
  await page.click('#evNuevo')
  await page.click('#evfGuardar')
  check('sin nombre no se guarda y lo dice', /nombre/.test(await page.textContent('#evfError')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const sin = await abrir(b, '/admin/?ver=eventos', { quien: 'admin-1', extra: sinNada, antes: () => { window.__SIN_TABLAS__ = ['eventos'] } })
  await sin.page.waitForTimeout(800)
  check('sin la migración, /admin dice qué falta', /supabase-migration-1192-eventos\.sql/.test(await sin.page.textContent('#eventosPanel')))
  await sin.ctx.close()
}

console.log('── 7. La portada ──')
{
  const caja = (page, id) => page.evaluate((id) => { const s = document.getElementById(id); if (!s || getComputedStyle(s).display === 'none') return null; const r = s.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width) } }, id)
  const { ctx, page, errores } = await abrir(b, '/')
  await page.waitForTimeout(1200)
  const ev = await caja(page, 'eventoPortadaSeccion')
  const t = await caja(page, 'torneoPortadaSeccion')
  check('el próximo evento sale en la portada, en la fila del torneo', ev && (!t || t.y === ev.y), JSON.stringify([t, ev]))
  const tx = await page.textContent('#eventoPortada')
  check('  …el más cercano, con quién va y a su ficha', /Castellón Card Show/.test(tx) && /3 van de PokeDoc/.test(tx) && (await page.getAttribute('#eventoPortada a', 'href')) === '/eventos/castellon-card-show-2026', tx.replace(/\s+/g, ' '))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
  const lejos = () => { const x = new Date(); x.setDate(x.getDate() + 40); window.__FAKE_EVENTOS__ = [{ id: 'x', slug: 'lejos', nombre: 'Lejos', tipo: 'card_show', empieza: x.toISOString(), publicado: true, asistentes: [] }] }
  for (const [nombre, extra] of [['sin eventos en 14 días', lejos], ['sin la migración', sinNada]]) {
    const r = await abrir(b, '/', { extra })
    await r.page.waitForTimeout(1200)
    check(`${nombre}, la sección se recoge`, !(await caja(r.page, 'eventoPortadaSeccion')) && !r.errores.length, r.errores.join(' | '))
    await r.ctx.close()
  }
  const m = await abrir(b, '/', { movil: true })
  await m.page.waitForTimeout(1200)
  const [mt, me] = [await caja(m.page, 'torneoPortadaSeccion'), await caja(m.page, 'eventoPortadaSeccion')]
  check('en el móvil, a lo ancho y después del torneo', me && (!mt || me.y > mt.y), JSON.stringify([mt, me]))
  await m.ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
