// Tanda 1029 — el modo evento (antes «feria»): /evento con el QR y las
// cuentas, las listas Busco / Doy en CARTAS (foto, nombre, número, ×N), los
// botones Copiar lista / Imagen / Exportar CSV, lo guardado con fotos para
// verlo sin cobertura, y /feria que lleva a /evento.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', name_en: 'Surging Sparks', serie_id: 'sv', market: 'WEST', tcg_online_code: 'SSP', card_count_official: 191, card_count_total: 252 }]
const carta = (n, nombre) => ({ id: `sv8-${n}`, set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, market: 'WEST', category: 'Pokemon', rarity: 'Rare', rarity_en: 'Rare', image_path: `sv/sv8/${n}`, variants: { normal: true } })
const CARTAS = [carta(1, 'Pikachu ex'), carta(2, 'Charizard ex'), carta(3, 'Eevee'), carta(4, 'Snorlax')]
const COLECCION = [
  { id: 'l1', user_id: 'user-1', card_id: 'sv8-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 3, cambio: 2 },
  { id: 'l2', user_id: 'user-1', card_id: 'sv8-4', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 1 },
  { id: 'l3', user_id: 'user-1', card_id: 'sv8-3', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 0 },
]
const DESEOS = [{ id: 'd1', user_id: 'user-1', card_id: 'sv8-1', idioma: 'es' }]

const b = await chromium.launch()
async function abrir(ruta, { movil = true, sesion = 'user-1', antes = null } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion || 'none'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: d.DESEOS, __FAKE_PRECIOS__: [] })
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
    if (d.antes) d.antes.forEach(([k, v]) => localStorage.setItem(k, v))
  }, { SETS, CARTAS, COLECCION, DESEOS, sesion, antes })
  const fotos = []
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => { fotos.push(r.request().url()); r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }) })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#eventoQr svg, #eventoQr .empty-state', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(600)
  return { ctx, page, errores, fotos }
}
const estado = (page) => page.evaluate(() => ({
  qr: Boolean(document.querySelector('#eventoQr svg path')),
  // Desde la 1042 las cuentas van en el pase: «1 busco · 2 doy».
  cuentas: document.querySelector('#eventoQr .evento-pase-cifras')?.textContent.replace(/\s+/g, ' ').trim(),
  pestanas: [...document.querySelectorAll('.evento-pestanas [data-lista]')].map((b) => `${b.dataset.lista}:${b.textContent.replace(/\s+/g, ' ').trim()}:${b.getAttribute('aria-pressed')}`),
  cartas: [...document.querySelectorAll('#eventoLista .evento-carta')].map((a) => ({ nombre: a.querySelector('b')?.textContent, num: a.querySelector('small')?.textContent, n: a.querySelector('.evento-cuantas')?.textContent || '', foto: a.querySelector('img')?.getAttribute('src') || '', href: a.getAttribute('href'), ancho: Math.round(a.getBoundingClientRect().width) })),
  vacia: document.querySelector('#eventoLista .evento-vacia')?.textContent || '',
  botones: [...document.querySelectorAll('.evento-botones button')].map((b) => `${b.textContent.trim()}${b.disabled ? '(off)' : ''}`),
  aviso: document.getElementById('eventoGuardado')?.textContent,
  guardado: JSON.parse(localStorage.getItem('pd-evento-v2') || 'null'),
  ancho: document.documentElement.scrollWidth <= innerWidth,
}))

console.log('── 1. iPhone: el QR con las cuentas y Busco en cartas ──')
{
  const { ctx, page, errores } = await abrir('/evento.html')
  const e = await estado(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el QR y «1 busco · 2 doy» en el pase', e.qr && e.cuentas === '1 busco2 doy', JSON.stringify({ qr: e.qr, cuentas: e.cuentas }))
  check('dos pestañas con su número, Busco abierta', e.pestanas.join('|') === 'busco:Busco 1:true|doy:Doy 2:false', e.pestanas.join('|'))
  check('Busco: el Pikachu ex con su foto, su número y su enlace', e.cartas.length === 1 && e.cartas[0].nombre === 'Pikachu ex' && e.cartas[0].num === 'SSP 1' && /sv8\/1/.test(e.cartas[0].foto) && /sv8-1/.test(e.cartas[0].href), JSON.stringify(e.cartas))
  check('las cartas caben de a tres en el iPhone y nada se sale', e.cartas[0]?.ancho >= 100 && e.cartas[0].ancho <= 130 && e.ancho, JSON.stringify({ ancho: e.cartas[0]?.ancho, pagina: e.ancho }))
  check('los tres botones, activos', e.botones.join('|') === 'Copiar lista|Imagen|Exportar CSV', e.botones.join('|'))
  check('«Guardado en este móvil», con las fotos de cada carta', /Guardado en este móvil/.test(e.aviso) && e.guardado?.busco?.[0]?.foto && e.guardado.doy.length === 2, JSON.stringify({ aviso: e.aviso, fotos: e.guardado?.busco?.map((f) => f.foto) }))
  check('el enlace del QR es /evento/<usuario>', /\/evento\/[^/]+$/.test(e.guardado?.enlace || ''), e.guardado?.enlace)
  await page.click('[data-lista="doy"]')
  await page.waitForTimeout(200)
  const d = await estado(page)
  check('Doy: Charizard ×2 y Snorlax, por lo que das (no por lo que tienes)', d.cartas.length === 2 && d.cartas.some((c) => c.nombre === 'Charizard ex' && c.n === '×2') && d.cartas.some((c) => c.nombre === 'Snorlax' && c.n === '') && !d.cartas.some((c) => c.nombre === 'Eevee'), JSON.stringify(d.cartas))
  // Copiar: sin `share` (escritorio o sin soporte) va al portapapeles.
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(() => { navigator.share = undefined })
  await page.click('#eventoCopiar')
  await page.waitForTimeout(300)
  const texto = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  check('Copiar lista: el texto con el título, una línea por carta y el enlace', /^Las que doy · /.test(texto) && /• Charizard ex \(SSP 2\) ×2/.test(texto) && /• Snorlax \(SSP 4\)/.test(texto) && /\/evento\//.test(texto), JSON.stringify(texto))
  // Exportar: un CSV con las dos filas.
  const descarga = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
  await page.click('#eventoExportar')
  const fichero = await descarga
  const csv = fichero ? readFileSync(await fichero.path(), 'utf8') : ''
  check('Exportar CSV: pokedoc-doy-<usuario>.csv con Charizard ×2 y Snorlax', /^pokedoc-doy-.*\.csv$/.test(fichero?.suggestedFilename() || '') && /sv8-2,Charizard ex,.*,SSP,2,es,,normal,2/.test(csv) && /sv8-4,Snorlax/.test(csv), JSON.stringify({ nombre: fichero?.suggestedFilename(), csv: csv.slice(0, 300) }))
  await ctx.close()
}

console.log('\n── 2. Sin cobertura: lo guardado, con sus cartas; y Busco vacío lo dice ──')
{
  const guardado = JSON.stringify({ cuando: '2026-10-25T10:00:00Z', enlace: 'https://pokedoc.es/evento/pingu', nombre: 'PINGU', usuario: 'pingu', busco: [], doy: [{ id: 'sv8-2', market: 'WEST', n: 2, idioma: 'es', nombre: 'Charizard ex', num: 'SSP 2', foto: 'https://assets.tcgdex.net/en/sv/sv8/2/low.webp', cadena: ['https://assets.tcgdex.net/en/sv/sv8/2/low.webp'], carta: CARTAS[1], ruta: '/carta/sv8-2' }] })
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((g) => { window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_FALLA__ = { user_collection: true }; localStorage.setItem('pd-evento-v2', g); localStorage.setItem('pokedoc-instalar-no', String(Date.now())) }, guardado)
  await ctx.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/evento`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#eventoQr svg', { timeout: 8000 }).catch(() => {})
  const e = await estado(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('«Sin conexión: tus listas tal como estaban…», con el QR', e.qr && /Sin conexión/.test(e.aviso) && e.cuentas === '0 busco1 doy', JSON.stringify({ aviso: e.aviso, cuentas: e.cuentas }))
  check('Busco vacío: lo dice y los botones se apagan', /Nada en La quiero/.test(e.vacia) && e.botones.every((x) => /\(off\)$/.test(x)), JSON.stringify({ vacia: e.vacia, botones: e.botones }))
  await page.click('[data-lista="doy"]')
  await page.waitForTimeout(200)
  const d = await estado(page)
  check('Doy desde lo guardado: el Charizard con su foto', d.cartas.length === 1 && d.cartas[0].nombre === 'Charizard ex' && /sv8\/2/.test(d.cartas[0].foto) && d.botones.every((x) => !/\(off\)$/.test(x)), JSON.stringify(d.cartas))
  await ctx.close()
}

console.log('\n── 3. Sin cuenta ni nada guardado, la puerta; y el PC ──')
{
  const { ctx, page } = await abrir('/evento.html', { sesion: 'none' })
  const e = await page.evaluate(() => document.querySelector('#eventoQr .empty-state a')?.getAttribute('href'))
  check('sin cuenta: «Entra» y vuelve a /evento', e === '/auth.html?volver=/evento', e)
  await ctx.close()
  const pc = await abrir('/evento.html', { movil: false })
  const r = await estado(pc.page)
  check('en el PC, lo mismo y sin errores', pc.errores.length === 0 && r.qr && r.cartas.length === 1, JSON.stringify({ errores: pc.errores, cartas: r.cartas.length }))
  await pc.ctx.close()
}

console.log('\n── 4. Lo que queda escrito ──')
{
  const toml = readFileSync(`${RAIZ}/netlify.toml`, 'utf8')
  check('/feria lleva a /evento (301) y /evento/<usuario> a la ficha', /from = "\/feria"\s+to = "\/evento"\s+status = 301/.test(toml) && /from = "\/evento\/:username"\s+to = "\/usuario\.html\?u=:username"/.test(toml))
  const sw = readFileSync(`${RAIZ}/sw.js`, 'utf8')
  check('el service worker sirve una foto de fuera desde la caché del evento si la red no contesta', /FOTOS_EVENTO = 'pokedoc-evento-fotos'/.test(sw) && /req\.destination === 'image'/.test(sw) && /cacheName: FOTOS_EVENTO/.test(sw))
  check('la página guarda las fotos en esa misma caché', /caches\.open\(CACHE_FOTOS\)/.test(readFileSync(`${RAIZ}/js/evento.js`, 'utf8')) && /CACHE_FOTOS = 'pokedoc-evento-fotos'/.test(readFileSync(`${RAIZ}/js/evento.js`, 'utf8')))
  check('no queda ningún feria.html, feria.css ni feria.js', !['feria.html', 'css/feria.css', 'js/feria.js'].some((f) => { try { readFileSync(`${RAIZ}/${f}`); return true } catch { return false } }))
  check('la barra del móvil sabe que /evento es de Cartas', /'evento'\]/.test(readFileSync(`${RAIZ}/js/barra-movil.js`, 'utf8')))
  // Lo que la página pide a `user_wants` existe en la base (624): la primera
  // 1029 pedía `market`, que no está, y en producción la consulta falló entera
  // con el doble en verde (el doble no rechaza columnas que no existen).
  const sql = readFileSync(`${RAIZ}/supabase-migration-intercambios.sql`, 'utf8')
  const tabla = sql.slice(sql.indexOf('create table if not exists public.user_wants'), sql.indexOf(');', sql.indexOf('create table if not exists public.user_wants')))
  const columnas = new Set([...tabla.matchAll(/^\s+([a-z_]+)\s+(?:uuid|text|int|timestamptz|boolean)/gm)].map((m) => m[1]))
  // Desde la 1047 se pide por `conVariante('…', …)`: esas son las columnas de
  // siempre, y `variante` la añade ella con su respaldo si la base no la tiene.
  const evento = readFileSync(`${RAIZ}/js/evento.js`, 'utf8')
  const pedidas = (evento.match(/from\('user_wants'\)\.select\('([^']+)'\)/) || evento.match(/conVariante\('([^']+)',\s*\(cols\)\s*=>\s*supabase\.from\('user_wants'\)/) || [])[1]?.split(',') || []
  check('las columnas que pide a user_wants existen en su migración', pedidas.length > 0 && pedidas.every((c) => columnas.has(c)), `pide ${pedidas.join(',')}; hay ${[...columnas].join(',')}`)
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
