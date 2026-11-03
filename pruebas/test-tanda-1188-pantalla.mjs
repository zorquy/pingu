// Tanda 1188 — la portada en MOSAICO (la C de «Tres portadas nuevas» con los
// cambios de PINGU): la noticia en grande y «Más noticias» al lado, el foro de
// arriba abajo a la derecha, y debajo las guías como portadas y la comunidad
// con la gente nueva. La clasificación sale de la portada y va entera a /retos
// → «Tu historial» (`/retos#clasificacion`).
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const sembrar = () => {
  const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
  const s = (tipo, m, n, datos) => ({ tipo, fecha: hace(m), username: n.toLowerCase(), display_name: n, datos })
  window.__FAKE_COMUNIDAD_SUCESOS__ = [
    s('perfecto', 6, 'Asierasti', { dia: '2026-11-02' }), s('alta', 7, 'El Visionario', {}), s('perfecto', 14, 'Sylphid', { dia: '2026-11-02' }),
    s('mazo', 56, 'Dra Valdis', { id: 'm1', nombre: 'Dragapult ex' }), s('perfecto', 60, 'Teseo', { dia: '2026-11-02' }),
    s('coleccion', 90, 'Laia', { set: 'base1', market: 'WEST', nombre: 'Base Set' }), s('campeon', 120, 'Ibai', { slug: 'otono', nombre: 'Liga de otoño' }),
    s('perfecto', 200, 'Brock', { dia: '2026-11-02' }), s('perfecto', 300, 'Oak', { dia: '2026-11-02' }),
  ]
  // Doce personas nuevas esta semana y una de hace un mes, que no cuenta.
  window.__FAKE_PERFILES__ = ['Nico', 'Íbero', 'El Visionario', 'Dra Valdis', 'Lluís', 'Teseo', 'Javi', 'Sylphid', 'Asierasti', 'Oak', 'Gary', 'Elm', 'Viejo'].map((n, i) => ({ id: `nuevo-${i}`, username: n, display_name: n, created_at: hace(i === 12 ? 30 * 1440 : 30 + i * 600) }))
  window.__FAKE_NOTICIAS__ = [...(window.__FAKE_NOTICIAS__ || []), ...[5, 6, 7].map((i) => ({ id: `n-extra-${i}`, slug: `extra-${i}`, title: `Noticia de relleno ${i}`, kind: 'news', review_status: 'published', published_at: hace(i * 3000), created_at: hace(i * 3000) }))]
}
const caja = (page, id) => page.evaluate((id) => { const s = document.getElementById(id); if (!s || getComputedStyle(s).display === 'none' || s.classList.contains('hidden') || s.classList.contains('seccion-recogida')) return null; const r = s.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), der: Math.round(r.right), abajo: Math.round(r.bottom + scrollY) } }, id)
const cabe = (page, sel, raiz) => page.evaluate(([sel, raiz]) => {
  const c = document.querySelector(raiz)
  const lis = [...c.querySelectorAll(sel)]
  const vistas = lis.filter((l) => l.style.display !== 'none' && l.getClientRects().length)
  const abajo = c.getBoundingClientRect().bottom
  return { total: lis.length, vistas: vistas.length, dentro: vistas.every((l) => l.getBoundingClientRect().bottom <= abajo + 1) }
}, [sel, raiz])
async function abrir(b, movil, quien = 'user-1', extra = sembrar) {
  const ctx = await contexto(b, movil, quien, extra)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#aprende .pb-portada', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}

const b = await chromium.launch()
console.log('── 1. El PC, con cuenta ──')
{
  const { ctx, page, errores } = await abrir(b, false)
  const [n, f, g, c] = [await caja(page, 'noticiaPortadaSeccion'), await caja(page, 'foroVivoSeccion'), await caja(page, 'recientesSeccion'), await caja(page, 'homeActivity')]
  check('la noticia arriba a la izquierda y el foro a la derecha, empezando a la vez', n && f && n.y === f.y && f.x > n.der && Math.abs(f.w * 3 - n.w) < 60, JSON.stringify([n, f]))
  check('debajo de la noticia, las guías y la comunidad, en la misma fila', g && c && g.y === c.y && g.y > n.abajo && c.x > g.x && g.x === n.x && Math.abs(c.der - n.der) <= 1, JSON.stringify([g, c]))
  check('el foro va de arriba abajo: acaba con las guías', Math.abs(f.abajo - g.abajo) <= 1, JSON.stringify([f, g]))
  check('  …y la comunidad mide lo que las guías', c.h === g.h, JSON.stringify([g, c]))
  const lado = await page.evaluate(() => { const g = document.querySelector('.pb-noticia').getBoundingClientRect(); const l = document.querySelector('.pb-noticias-lado').getBoundingClientRect(); return { grande: Math.round(g.width), lado: Math.round(l.width), mismaFila: Math.round(g.top) === Math.round(l.top), mismoAlto: Math.abs(g.height - l.height) <= 1 } })
  check('la noticia grande y «Más noticias» al lado, 2/3 y 1/3, del mismo alto', lado.mismaFila && lado.mismoAlto && Math.abs(lado.grande - 2 * lado.lado) < 60, JSON.stringify(lado))
  const nots = await cabe(page, '.pb-noticias-mas li', '.pb-noticias-lado')
  check('  …con las que caben, sin cortar ninguna', nots.vistas >= 2 && nots.dentro, JSON.stringify(nots))
  const foro = await cabe(page, '.pb-foro-fila', '#foroVivo')
  check('el foro: el tema destacado y los demás que caben, sin cortar', (await page.locator('#foroVivo .pb-foro-top').count()) === 1 && foro.vistas >= 2 && foro.dentro, JSON.stringify(foro))
  const port = await page.$$eval('#aprende .pb-portada', (xs) => xs.map((x) => ({ href: x.getAttribute('href'), visible: getComputedStyle(x).display !== 'none', ratio: Math.round((x.getBoundingClientRect().height / x.getBoundingClientRect().width) * 100) / 100, chapa: x.querySelector('.pb-chip')?.textContent.trim() || '' })))
  const vistas = port.filter((x) => x.visible)
  check('«Guías nuevas»: tres portadas a la vista, cada una a su guía, con su tema y sin minutos (1191)', vistas.length === 3 && vistas.every((x) => x.href.startsWith('/guia/') && x.chapa && !/min/.test(x.chapa) && Math.abs(x.ratio - 1.33) < 0.05), JSON.stringify(port))
  // 1191: todas iguales, con la chapa y el título a la misma altura.
  const alturas = await page.$$eval('#aprende .pb-portada', (xs) => xs.filter((x) => getComputedStyle(x).display !== 'none').map((x) => { const top = x.getBoundingClientRect().top; return [Math.round(x.querySelector('.pb-chip').getBoundingClientRect().top - top), Math.round(x.querySelector('strong').getBoundingClientRect().top - top), Math.round(x.querySelector('strong').getBoundingClientRect().height)] }))
  check('  …con la chapa y el título a la misma altura en todas', new Set(alturas.map((a) => a.join())).size === 1, JSON.stringify(alturas))
  check('  …sin descripción, ni progreso, ni temas de filtro', !(await page.locator('#aprende .guia-desc, #aprende .guia-progreso, #aprende .pb-tema').count()))
  check('la comunidad: «+12 gente nueva esta semana» (la de hace un mes no cuenta)', /\+12\s*gente nueva esta semana/.test(await page.locator('.pb-gente-nueva').innerText().catch(() => '')), await page.locator('.pb-gente-nueva').innerText().catch(() => '(sin bloque)'))
  check('  …y los «se unió» no se repiten debajo', !/se unió/.test(await page.locator('#homeActivityFeed .suc-lista').innerText()))
  const suc = await cabe(page, '#homeActivityFeed .suc-lista > li', '#homeActivityFeed')
  check('  …con los sucesos que caben, sin cortar', suc.vistas >= 1 && suc.dentro, JSON.stringify(suc))
  check('ni clasificación ni caja verde de retos', !(await page.locator('#clasificacionSeccion, .pb-podio').count()) && !(await page.locator('#retoSeccion').isVisible()))
  check('sin desbordar a lo ancho', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  await page.screenshot({ path: '/tmp/1188-pc.png', fullPage: true })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. El PC sin foro: las noticias y las guías a lo ancho ──')
{
  const { ctx, page } = await abrir(b, false, 'user-1', () => { window.__FAKE_TEMAS__ = []; window.__FAKE_MENSAJES__ = [] })
  const [n, g, f] = [await caja(page, 'noticiaPortadaSeccion'), await caja(page, 'recientesSeccion'), await caja(page, 'foroVivoSeccion')]
  check('sin foro, la noticia a todo el ancho y las guías a nueve de doce', f === null && n && g && n.w > 1000 && g.w > 700 && g.w < n.w, JSON.stringify([n, g, f]))
  await ctx.close()
}

console.log('── 3. Sin cuenta: la caja de retos en el sitio de la comunidad ──')
{
  const { ctx, page, errores } = await abrir(b, false, 'none')
  const [g, r] = [await caja(page, 'recientesSeccion'), await caja(page, 'retoSeccion')]
  check('las guías y la caja de retos en la misma fila', g && r && g.y === r.y && r.x > g.x, JSON.stringify([g, r]))
  check('  …y en el foro, «Participar» lleva a crear la cuenta', /auth\.html\?registro=1/.test(await page.locator('#foroVivo .pb-pie-enlace .pb-boton').getAttribute('href').catch(() => '')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. El móvil ──')
{
  const { ctx, page, errores } = await abrir(b, true)
  const ids = ['retoSeccion', 'sigueSeccion', 'primerosPasos', 'noticiaPortadaSeccion', 'foroVivoSeccion', 'recientesSeccion', 'homeActivity']
  const ys = []
  for (const id of ids) ys.push([(await caja(page, id))?.y ?? null, id])
  const orden = ys.filter(([y]) => y !== null).sort((a, b) => a[0] - b[0]).map(([, id]) => id)
  check('el orden: retos, primeros pasos, noticias, foro, guías y comunidad', orden.join() === ids.filter((id) => orden.includes(id)).join(), orden.join(' → '))
  const tiras = await page.evaluate(() => ['.pb-noticias-mas', '.pb-portadas'].map((s) => { const t = document.querySelector(s); return { s, desliza: getComputedStyle(t).overflowX === 'auto' && t.scrollWidth > t.clientWidth } }))
  check('las noticias de al lado y las guías, en tiras que se deslizan', tiras.every((t) => t.desliza), JSON.stringify(tiras))
  // 1190 (PINGU: la grande desplazaba la portada): en el móvil no hay noticia
  // grande, y la tira se llama «Noticias» y empieza por la última.
  const nm = await page.evaluate(() => ({ grande: getComputedStyle(document.querySelector('.pb-noticia')).display, titulo: document.querySelector('.pb-noticias-lado h2').innerText.trim(), primera: document.querySelector('.pb-noticias-mas li a')?.getAttribute('href') === document.querySelector('.pb-noticia').getAttribute('href') }))
  check('  …sin noticia grande: «Noticias», todas en la tira, la última primero (1190)', nm.grande === 'none' && nm.titulo === 'Noticias' && nm.primera, JSON.stringify(nm))
  const suc = await cabe(page, '#homeActivityFeed .suc-lista > li', '#homeActivityFeed')
  check('  …y seis sucesos como mucho', suc.vistas <= 6 && suc.vistas >= 1, JSON.stringify(suc))
  check('sin desbordar a lo ancho', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. La clasificación, entera en /retos ──')
{
  const ctx = await contexto(b, false, 'user-1', () => {
    const p = (puesto, n, xp, tu) => ({ puesto, username: n.toLowerCase(), display_name: n, xp, ...(tu ? { tu: true } : {}) })
    window.__FAKE_CLASIFICACION__ = { semana: { ranking: [p(1, 'Sergio.M', 235), p(2, 'Manuel', 179), p(3, 'Ash', 176, true), p(4, 'RubenGP', 175), p(5, 'Unai', 169)], tu: { puesto: 3, xp: 176 } }, mes: { ranking: [p(1, 'Ash', 900, true)], tu: { puesto: 1, xp: 900 } } }
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/retos#clasificacion`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#rtLiga .pb-podio', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  check('/retos#clasificacion abre «Tu historial» con el podio', await page.locator('#rtHistorial').evaluate((d) => d.open) && (await page.locator('#rtLiga .pb-podio').isVisible()))
  const pest = await page.evaluate(() => { const s = document.getElementById('rtLiga').getBoundingClientRect(); const t = document.querySelector('#rtLiga .pb-pestanas').getBoundingClientRect(); return t.right <= s.right && t.left >= s.left })
  check('  …con «Semana / Mes» dentro de su caja', pest)
  await page.locator('#rtLiga [data-periodo="mes"]').click()
  await page.waitForTimeout(500)
  check('  …y «Mes» cambia a la del mes', /desde el día 1/.test(await page.locator('#rtLiga').innerText()))
  const hoja = await page.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].some((l) => /portada-bloques\.css/.test(l.href)))
  check('  …con su hoja, y sin bajar la portada (solo pb-comun)', hoja && !(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /portada-bloques\.js/.test(r.name)))))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
