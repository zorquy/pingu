// Tanda 753 — la barra de abajo escrita en el HTML con la transición entre
// páginas (A4), los atajos del icono (A2), la hoja de instalar en Android
// (A1; la del iPhone la mira la 732) y los avisos de lanzamientos (P2).
//
// Lo que se mira: que cada página lleva la barra que sale del generador, con
// su sección marcada, y que se ve SIN JavaScript (es lo que la pone en el
// primer pintado); que la transición solo se pide en el móvil y sin «menos
// movimiento»; que con cuenta Cartas lleva a Mi colección; que el
// manifiesto trae los cinco atajos; que en Android sale «Instalar» cuando
// el navegador dice que se puede y abre su instalador; que en
// /lanzamientos cada set que viene lleva «Avísame», que se guarda, se
// cambia y se quita, con la preventa cuando se sabe; y que la función
// programada avisa una vez, apuntándolo antes de avisar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La barra en el HTML (A4) ──')
{
  const gen = await import(`${RAIZ}/generar-barra-movil.mjs`)
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && f !== 'cartas.html')
  const conBarraArriba = paginas.filter((f) => readFileSync(`${RAIZ}/${f}`, 'utf8').includes('id="navbar"'))
  const distintas = conBarraArriba.filter((f) => { const h = readFileSync(`${RAIZ}/${f}`, 'utf8'); return gen.conBarra(h, f) !== h || !h.includes(gen.INICIO) })
  check(`las ${conBarraArriba.length} páginas con barra de arriba llevan la de abajo tal como sale del generador`, conBarraArriba.length >= 36 && distintas.length === 0, distintas.join(', '))
  const marcada = (f) => (readFileSync(`${RAIZ}/${f}`, 'utf8').match(/<nav class="bm"[\s\S]*?<\/nav>/)?.[0].match(/<span>([^<]+)<\/span><\/a>/g) || []).length && (readFileSync(`${RAIZ}/${f}`, 'utf8').match(/<a href="[^"]*" aria-current="page">[\s\S]*?<span>([^<]+)<\/span>/)?.[1] || null)
  check('  …con su sección marcada (portada → Inicio, un hilo → Comunidad, una carta → Cartas, un torneo → Jugar)', marcada('index.html') === 'Inicio' && marcada('tema.html') === 'Comunidad' && marcada('carta.html') === 'Cartas' && marcada('torneo.html') === 'Jugar', [marcada('index.html'), marcada('tema.html'), marcada('carta.html'), marcada('torneo.html')].join(','))
  const css = readFileSync(`${RAIZ}/css/style.css`, 'utf8')
  check('la transición entre páginas solo en el móvil y sin «menos movimiento», con las dos barras quietas', /@media \(max-width: 900px\) and \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{ navigation: auto; \}\s*\.bm \{ view-transition-name: barra-abajo; \}\s*\.navbar \{ view-transition-name: barra-arriba; \}/.test(css))
}

const browser = await chromium.launch()
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: false })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const m = await page.evaluate(() => { const b = document.querySelector('.bm'); const r = b?.getBoundingClientRect(); return b && { visible: getComputedStyle(b).display !== 'none', abajo: Math.round(innerHeight - r.bottom), enlaces: [...b.querySelectorAll('a')].map((a) => a.textContent.trim()), hueco: parseFloat(getComputedStyle(document.body).paddingBottom) } })
  check('sin JavaScript la barra ya está, abajo, con sus cinco secciones y su hueco', m?.visible && Math.abs(m.abajo) <= 1 && m.enlaces.join() === 'Inicio,Aprender,Cartas,Comunidad,Jugar' && m.hueco >= 72, JSON.stringify(m))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const m = await page.evaluate(() => ({ barras: document.querySelectorAll('.bm').length, cartas: document.querySelector('.bm a:nth-child(3)')?.getAttribute('href') }))
  check('con cuenta, el JavaScript la remata (Cartas → Mi colección) sin poner otra', m.barras === 1 && m.cartas === '/mi-coleccion', JSON.stringify(m))
  await ctx.close()
}

console.log('── 2. Los atajos del icono (A2) ──')
{
  const m = JSON.parse(readFileSync(`${RAIZ}/manifest.webmanifest`, 'utf8'))
  const atajos = m.shortcuts || []
  check('cinco atajos: escanear, añadir, reto, La quiero y Mi colección', JSON.stringify(atajos.map((a) => a.short_name)) === JSON.stringify(['Escanear', 'Añadir', 'Reto', 'La quiero', 'Colección']), JSON.stringify(atajos.map((a) => a.short_name)))
  check('  …cada uno a una página que existe, con su icono', atajos.every((a) => a.url.startsWith('/') && existsSync(`${RAIZ}/${a.url.slice(1).split('?')[0].replace(/^$/, 'index')}${/\.html$/.test(a.url.split('?')[0]) ? '' : '.html'}`) && a.icons?.every((i) => existsSync(`${RAIZ}${i.src}`))), JSON.stringify(atajos.map((a) => a.url)))
  const pags = readdirSync(RAIZ).filter((f) => f.endsWith('.html') && readFileSync(`${RAIZ}/${f}`, 'utf8').includes('id="navbar"'))
  check('las páginas se abren a pantalla completa en el iPhone, con su nombre', pags.every((f) => /apple-mobile-web-app-capable" content="yes"/.test(readFileSync(`${RAIZ}/${f}`, 'utf8')) && /apple-mobile-web-app-title" content="PokeDoc"/.test(readFileSync(`${RAIZ}/${f}`, 'utf8'))))
}

console.log('── 3. Instalar en Android (A1) ──')
{
  const ctx = await browser.newContext({ ...devices['Pixel 7'] })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none'; try { localStorage.setItem('pokedoc-visitas', '3') } catch {} })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  check('sin que el navegador diga que se puede, no sale nada', (await page.locator('.bm-instalar').count()) === 0)
  await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__pedido = true }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e) })
  await page.waitForTimeout(300)
  const t = await page.evaluate(() => { const c = document.querySelector('.bm-instalar-tarjeta'); const r = c?.getBoundingClientRect(); const bm = document.querySelector('.bm').getBoundingClientRect(); return c && { texto: c.textContent.replace(/\s+/g, ' ').trim(), encima: r.bottom <= bm.top + 1 } })
  check('cuando lo dice, la tarjeta con «Instalar», encima de la barra', /Instala PokeDoc/.test(t?.texto || '') && t.encima, JSON.stringify(t))
  await page.click('.bm-instalar [data-instalar="si"]')
  await page.waitForTimeout(300)
  check('  …y «Instalar» abre el instalador del navegador', await page.evaluate(() => window.__pedido === true) && (await page.locator('.bm-instalar').count()) === 0)
  await ctx.close()
}

console.log('── 4. Avísame en Lanzamientos (P2) ──')
const enDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
async function lanzamientos({ sesion = 'admin-1', avisos = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(([sesion, sets, ajustes, avisos]) => {
    window.__FAKE_SESSION__ = sesion
    window.__FAKE_SETS__ = sets
    window.__FAKE_AJUSTES__ = ajustes
    window.__FAKE_AVISOS_LANZAMIENTO__ = avisos
  }, [sesion, [
    { id: 'me03', name: 'Héroes Ascendentes', market: 'WEST', serie_id: 'me', release_date: enDias(10), card_count_official: 200 },
    { id: 'me04', name: 'Fuego Fantasmal', market: 'WEST', serie_id: 'me', release_date: enDias(40), card_count_official: 180 },
    { id: 'sv10', name: 'Rivales Destinados', market: 'WEST', serie_id: 'sv', release_date: enDias(-60), card_count_official: 190 },
  ], [{ key: 'lanzamientos', value: { sets: [{ fecha: enDias(40), nombre: 'Fuego Fantasmal', preventa: enDias(20) }, { fecha: enDias(70), nombre: 'Un set anunciado' }] } }], avisos])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/lanzamientos.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const filas = (page) => page.evaluate(async () => { const { supabase } = await import('/js/supabase.js'); const { data } = await supabase.from('user_release_alerts').select('clave,market,nombre,semana,dia,preventa'); return data || [] })
{
  const { page, ctx, errores } = await lanzamientos()
  const botones = await page.$$eval('.lanz-avisar', (bs) => bs.map((b) => b.textContent.trim()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('cada set que viene lleva «Avísame» (el siguiente y los demás; los que ya salieron, no)', botones.length === 3 && botones.every((t) => t === 'Avísame') && (await page.locator('#listaPasados .lanz-avisar').count()) === 0, JSON.stringify(botones))
  await page.locator('#proximoDestacado .lanz-avisar').click()
  await page.waitForTimeout(300)
  const d = await page.evaluate(() => { const d = document.getElementById('lanzAvisoDialogo'); return { open: d.open, titulo: d.querySelector('h2').textContent, semana: d.querySelector('[name=semana]').checked, dia: d.querySelector('[name=dia]').checked, preventa: !d.querySelector('#lanzAvisoPreventa').hidden } })
  check('el diálogo: una semana antes y el día que sale, marcados; sin preventa si no se sabe', d.open && d.titulo === 'Avísame de Héroes Ascendentes' && d.semana && d.dia && !d.preventa, JSON.stringify(d))
  await page.uncheck('#lanzAvisoDialogo [name=semana]')
  await page.click('#lanzAvisoDialogo button[type=submit]')
  await page.waitForTimeout(700)
  let f = await filas(page)
  check('Guardar lo apunta (solo el día que sale) y el botón dice «Avisado»', f.length === 1 && f[0].clave === 'me03' && f[0].semana === false && f[0].dia === true && (await page.locator('#proximoDestacado .lanz-avisar').textContent()).trim() === 'Avisado', JSON.stringify(f))
  await page.locator('#proximoDestacado .lanz-avisar').click()
  await page.waitForTimeout(300)
  check('  …al volver a abrirlo dice lo que pusiste', await page.evaluate(() => !document.querySelector('#lanzAvisoDialogo [name=semana]').checked && !document.querySelector('[data-lanz="quitar"]').hidden))
  await page.check('#lanzAvisoDialogo [name=semana]')
  await page.click('#lanzAvisoDialogo button[type=submit]')
  await page.waitForTimeout(700)
  f = await filas(page)
  check('  …cambiarlo no deja dos filas', f.length === 1 && f[0].semana === true, JSON.stringify(f))
  await page.locator('#proximoDestacado .lanz-avisar').click()
  await page.waitForTimeout(300)
  await page.click('#lanzAvisoDialogo [data-lanz="quitar"]')
  await page.waitForTimeout(700)
  check('  …y «Quitar aviso» lo borra', (await filas(page)).length === 0 && (await page.locator('#proximoDestacado .lanz-avisar').textContent()).trim() === 'Avísame')
  // El de la preventa: un set del catálogo con la preventa en la lista a mano.
  await page.locator('#listaProximos .lanz-evento').first().locator('.lanz-avisar').click()
  await page.waitForTimeout(300)
  const p = await page.evaluate(() => ({ visible: !document.getElementById('lanzAvisoPreventa').hidden, texto: document.getElementById('lanzAvisoPreventa').textContent.trim() }))
  check('con la preventa en la lista a mano, también se puede pedir', p.visible && /^Cuando abra la preventa \(\d+ de [a-z]+\)$/.test(p.texto), JSON.stringify(p))
  await page.click('#lanzAvisoDialogo button[type=submit]')
  await page.waitForTimeout(700)
  f = await filas(page)
  check('  …y se guarda con ella', f.length === 1 && f[0].clave === 'me04' && f[0].preventa === true, JSON.stringify(f))
  // Y el anunciado a mano: su clave es su nombre.
  await page.locator('#listaProximos .lanz-evento').nth(1).locator('.lanz-avisar').click()
  await page.waitForTimeout(300)
  await page.click('#lanzAvisoDialogo button[type=submit]')
  await page.waitForTimeout(700)
  f = await filas(page)
  check('un set anunciado a mano se apunta por su nombre', f.some((x) => x.clave === 'manual:un set anunciado' && x.market === 'WEST'), JSON.stringify(f))
  await ctx.close()
}
{
  const { page, ctx } = await lanzamientos({ sesion: 'none' })
  const href = await page.locator('#proximoDestacado .lanz-avisar').getAttribute('href')
  check('sin cuenta, «Avísame» lleva a crear una', /^\/auth\.html\?registro=1&volver=/.test(href || ''), href)
  await ctx.close()
}
await browser.close()

console.log('── 5. La función que avisa ──')
{
  const f = await import(`${RAIZ}/netlify/functions/avisos-lanzamientos.mjs`)
  const a = { semana: true, dia: true, preventa: true, enviados: [] }
  check('una semana antes (con margen de 5 a 7 días), el día y la preventa', JSON.stringify(f.avisosDeHoy(a, { fecha: '2026-10-14', preventa: '2026-10-07' }, '2026-10-07').map((x) => x.tipo)) === '["semana","preventa"]' && f.avisosDeHoy(a, { fecha: '2026-10-11' }, '2026-10-07').length === 0 && f.avisosDeHoy(a, { fecha: '2026-10-06' }, '2026-10-07')[0]?.tipo === 'dia' && f.avisosDeHoy({ ...a, enviados: ['dia'] }, { fecha: '2026-10-07' }, '2026-10-07').length === 0)
  check('el día es el de España (a las 23:30 UTC ya es mañana allí)', f.hoyEnEspana(new Date('2026-10-07T23:30:00Z')) === '2026-10-08')
  const llamadas = []
  const tabla = { user_release_alerts: [{ id: 'a1', user_id: 'u1', clave: 'me03', market: 'WEST', nombre: 'Héroes Ascendentes', semana: true, dia: true, preventa: false, enviados: [] }], tcg_sets: [{ id: 'me03', market: 'WEST', name: 'Héroes', release_date: '2026-10-14' }], site_settings: [] }
  const rest = async (ruta, _c, op = {}) => { llamadas.push(`${op.method || 'GET'} ${ruta.split('?')[0]}`); if (op.method === 'PATCH') { tabla.user_release_alerts[0].enviados = JSON.parse(op.body).enviados; return null } if (op.method === 'POST') return null; return tabla[ruta.split('?')[0]] || [] }
  const r1 = await f.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'x' }, rest, ahora: new Date('2026-10-07T07:00:00Z') })
  const orden = llamadas.filter((l) => /PATCH|POST/.test(l))
  check('avisa una semana antes, apuntándolo ANTES de avisar', r1.enviados === 1 && JSON.stringify(orden) === JSON.stringify(['PATCH user_release_alerts', 'POST user_notifications']), JSON.stringify({ r1, orden }))
  const r2 = await f.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'x' }, rest, ahora: new Date('2026-10-08T07:00:00Z') })
  check('  …y al día siguiente no lo repite', r2.enviados === 0, JSON.stringify(r2))
  const r3 = await f.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'x' }, rest: async () => { throw new Error('Supabase 404: relation "user_release_alerts" does not exist 42P01') } })
  check('sin la migración no hace nada y lo dice', r3.ok && /supabase-migration-avisos-lanzamientos/.test(r3.saltado || ''), JSON.stringify(r3))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
