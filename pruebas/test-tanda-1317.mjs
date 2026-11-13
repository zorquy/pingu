// Tanda 1317 — La app (A1, A7, A2, A3 del plan): el manifiesto con atajos e
// id fijo, «Compartir a PokeDoc» desde otra app (share_target + el service
// worker + /compartir), el número en el icono, y pedir instalar después de un
// buen momento (con su entrada en Ajustes).
import { readFileSync, existsSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import vm from 'node:vm'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── A1: el manifiesto ──')
{
  const m = JSON.parse(leer('manifest.webmanifest'))
  check('id fijo y abre en la ventana que ya está abierta', m.id === '/' && JSON.stringify(m.launch_handler?.client_mode) === JSON.stringify(['navigate-existing', 'auto']))
  check('un enlace a pokedoc.es abre la app instalada', m.handle_links === 'preferred')
  const atajos = m.shortcuts || []
  check('cuatro atajos: Añadir, Mensajes, Retos y La quiero', JSON.stringify(atajos.map((a) => a.short_name)) === JSON.stringify(['Añadir', 'Mensajes', 'Retos', 'La quiero']), JSON.stringify(atajos.map((a) => a.short_name)))
  check('  …sin el escáner (escondido desde la 758: «no funciona muy bien»)', !atajos.some((a) => /escanear/.test(a.url)))
  check('  …cada uno con su icono de 192, que existe', atajos.every((a) => a.icons?.length === 1 && a.icons[0].sizes === '192x192' && existsSync(`${RAIZ}${a.icons[0].src}`)))
  check('  …y a una página que existe', atajos.every((a) => existsSync(`${RAIZ}/${a.url.slice(1).split('?')[0]}.html`)), JSON.stringify(atajos.map((a) => a.url)))
}

console.log('── A7: compartir A PokeDoc ──')
{
  const m = JSON.parse(leer('manifest.webmanifest'))
  const st = m.share_target || {}
  check('share_target: POST multipart a /compartir con título, texto, enlace y fotos', st.action === '/compartir' && st.method === 'POST' && st.enctype === 'multipart/form-data' && st.params?.title === 'title' && st.params?.text === 'text' && st.params?.url === 'url' && st.params?.files?.[0]?.name === 'foto' && st.params.files[0].accept.includes('image/*'), JSON.stringify(st))
  const { destinoCompartido: d } = await import(`${RAIZ}/js/compartir-puro.js`)
  check('un enlace de PokeDoc va a esa página', d({ url: 'https://pokedoc.es/foro?x=1#a' }) === '/foro?x=1#a' && d({ url: 'https://www.pokedoc.es/carta/sv3-1' }) === '/carta/sv3-1')
  check('  …y nunca fuera (//otra.web no es una ruta de la casa)', d({ url: 'https://pokedoc.es//otra.web/x' }) === '/otra.web/x' && d({ url: 'https://pokedoc.es/\\otra.web' }).startsWith('/otra'))
  check('  …y otro sitio que se llame parecido no cuenta', !d({ url: 'https://pokedoc.es.malo.com/x' }).startsWith('/x'))
  check('un enlace de Cardmarket busca la carta por su nombre (sin versión ni código)', d({ url: 'https://www.cardmarket.com/es/Pokemon/Products/Singles/Silver-Tempest/Lugia-V-V3-SIT186' }) === '/cartas?ver=buscar&q=Lugia%20V', d({ url: 'https://www.cardmarket.com/es/Pokemon/Products/Singles/Silver-Tempest/Lugia-V-V3-SIT186' }))
  check('  …también si viene dentro del texto', d({ text: 'Mira https://www.cardmarket.com/en/Pokemon/Products/Singles/151/Mew-ex-MEW151 qué precio' }) === '/cartas?ver=buscar&q=Mew%20ex')
  check('un texto busca ese texto', d({ text: 'Charizard ex 151' }) === '/cartas?ver=buscar&q=Charizard%20ex%20151')
  check('nada: el buscador vacío', d({}) === '/cartas?ver=buscar')
  check('la página /compartir no sale en Google', /noindex,follow/.test(leer('compartir.html')) && /compartir-pagina\.js/.test(leer('compartir.html')))

  // El service worker de verdad, en una caja.
  const ORIGEN = 'https://pokedoc.es'
  const almacen = new Map()
  const abrir = (n) => {
    if (!almacen.has(n)) almacen.set(n, new Map())
    const mm = almacen.get(n)
    const clave = (r) => (typeof r === 'string' ? new URL(r, ORIGEN).href : r.url)
    return { match: async (r) => mm.get(clave(r))?.clone(), put: async (r, res) => { mm.set(clave(r), res) }, keys: async () => [], delete: async (r) => mm.delete(clave(r)) }
  }
  const caches = { open: async (n) => abrir(n), keys: async () => [...almacen.keys()], delete: async (n) => almacen.delete(n), match: async () => undefined }
  const oyentes = {}
  const pedidasRed = []
  const self = { location: new URL(ORIGEN), addEventListener: (t, f) => { oyentes[t] = f }, skipWaiting: () => {}, clients: { claim: async () => {} }, navigator: {} }
  vm.runInContext(leer('sw.js'), vm.createContext({ self, caches, fetch: async (r) => { pedidasRed.push(r.url || r); return new Response('red') }, URL, URLSearchParams, Request, Response, FormData, Blob, File, setTimeout, clearTimeout, Promise, console, crypto: webcrypto, Uint8Array, JSON, Date }))
  const enviar = async (form) => {
    let respuesta
    const req = new Request(`${ORIGEN}/compartir`, { method: 'POST', body: form })
    // Un share_target llega como NAVEGACIÓN (el `mode` de Request no se puede poner a mano en Node).
    Object.defineProperty(req, 'mode', { value: 'navigate' })
    oyentes.fetch({ request: req, clientId: '', resultingClientId: 'x', respondWith: (p) => { respuesta = p }, waitUntil: () => {} })
    return respuesta ? await respuesta : null
  }
  const conFoto = new FormData()
  conFoto.append('foto', new File([new Uint8Array([1, 2, 3])], 'carta.jpg', { type: 'image/jpeg' }))
  const r1 = await enviar(conFoto)
  check('una foto: el service worker la recoge (antes que las navegaciones) y lleva al escáner', r1?.status === 303 && r1.headers.get('location') === `${ORIGEN}/mi-coleccion?ver=buscar&compartida=1`, r1 && `${r1.status} ${r1.headers.get('location')}`)
  const guardada = almacen.get('pokedoc-compartido')?.get(`${ORIGEN}/__compartido/foto`)
  check('  …con la foto guardada para el escáner, con su tipo', guardada && guardada.headers.get('content-type') === 'image/jpeg' && (await guardada.clone().arrayBuffer()).byteLength === 3)
  check('  …y sin pedírsela a la red', pedidasRed.length === 0, JSON.stringify(pedidasRed))
  const conEnlace = new FormData()
  conEnlace.append('title', 'Lugia')
  conEnlace.append('text', 'mira')
  conEnlace.append('url', 'https://www.cardmarket.com/x')
  const r2 = await enviar(conEnlace)
  const q = new URL(r2?.headers.get('location') || 'x:/').searchParams
  check('un enlace o un texto: a /compartir por la dirección', r2?.status === 303 && r2.headers.get('location').startsWith(`${ORIGEN}/compartir?`) && q.get('url') === 'https://www.cardmarket.com/x' && q.get('text') === 'mira' && q.get('title') === 'Lugia', r2?.headers.get('location'))
  const otroTxt = new FormData()
  otroTxt.append('foto', new File(['hola'], 'x.txt', { type: 'text/plain' }))
  const r3 = await enviar(otroTxt)
  check('un fichero que no es una foto no va al escáner', r3?.headers.get('location') === `${ORIGEN}/compartir?`, r3?.headers.get('location'))
  check('al estrenar versión no se borra lo compartido', /k !== 'pokedoc-compartido'/.test(leer('sw.js')))
  const esc = leer('js/mi-coleccion/escaner-ui.js')
  check('el escáner la lee una vez y la borra', /export async function leerCompartida/.test(esc) && /CACHE_COMPARTIDO/.test(esc) && /\.delete\(/.test(esc.slice(esc.indexOf('leerCompartida'))))
  check('Mi colección abre el escáner con ?compartida=1', /params\.get\('compartida'\)\) void escanerModulo\(\)\.then\(\(m\) => m\.leerCompartida\(\)\)/.test(leer('js/mi-coleccion.js')))
}

console.log('── A2: el número en el icono ──')
{
  const { totalSinLeer } = await import(`${RAIZ}/js/numeros-seccion.js`)
  check('lo sin leer más los mensajes', totalSinLeer([{ read_at: null }, { read_at: '2026-01-01' }, { read_at: null }], '3') === 5)
  check('  …sin nada, cero (y nada raro con lo que no es número)', totalSinLeer([], 'x') === 0 && totalSinLeer(null, undefined) === 0)
  check('al contar los avisos se pone en el icono (o se quita)', /setAppBadge\(n\) : nav\.clearAppBadge\(\)/.test(leer('js/numeros-seccion.js')))
  check('y el service worker lo enciende al llegar un push', /self\.navigator\?\.setAppBadge\) self\.navigator\.setAppBadge\(\)/.test(leer('sw.js')))
}

console.log('── A3: instalar después de un buen momento ──')
{
  const { exitoDeColeccion, EXITO_PENDIENTE } = await import(`${RAIZ}/js/exito.js`)
  const ventana = () => {
    const ls = new Map(); const ss = new Map(); const ev = []
    return {
      localStorage: { getItem: (k) => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)) },
      sessionStorage: { getItem: (k) => ss.get(k) ?? null, setItem: (k, v) => ss.set(k, String(v)) },
      CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o?.detail } },
      dispatchEvent: (e) => ev.push(e), ev, ss,
    }
  }
  let preguntas = 0
  const base = (n) => ({ from: () => ({ select: () => ({ eq: async () => { preguntas++; return { count: n, error: null } } }) }) })
  const w = ventana()
  await exitoDeColeccion(base(9), 'u1', w)
  check('con 9 cartas, nada', w.ev.length === 0)
  await exitoDeColeccion(base(10), 'u1', w)
  check('con la décima, un buen momento («cartas»), también en la sesión por si cambia la página', w.ev.length === 1 && w.ev[0].type === 'pd-exito' && w.ev[0].detail.motivo === 'cartas' && w.ss.get(EXITO_PENDIENTE) === 'cartas')
  const antes = preguntas
  await exitoDeColeccion(base(11), 'u1', w)
  check('  …una vez, y después ya no se pregunta nunca más', w.ev.length === 1 && preguntas === antes)
  check('lo avisan añadir, acabar un reto e inscribirse', /void exitoDeColeccion\(supabase, userId\)/.test(leer('js/mi-coleccion/datos.js')) && /jugada != null && data\?\.estado\?\.terminada\) avisarExito\('reto'\)/.test(leer('js/reto-arbitro.js')) && /avisarExito\('torneo'\)/.test(leer('js/torneos/torneo.js')))
  check('el permiso del navegador se guarda al llegar (no sale su aviso pronto)', /addEventListener\('beforeinstallprompt', \(e\) => \{ e\.preventDefault\(\); window\.__pdInstalar = e \}\)/.test(leer('js/app.js')))
}

const browser = await chromium.launch()
console.log('── Ajustes › Instalar PokeDoc ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/ajustes.html?ver=instalar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  check('el apartado está en la lista', (await p.locator('#ajLista a[data-ver="instalar"]').textContent().catch(() => '')).includes('Instalar PokeDoc'))
  const panel = await p.locator('#ajPanel').textContent().catch(() => '')
  check('sin el permiso del navegador: dónde está el botón en cada aparato', /Si no te sale el botón/.test(panel) && /Android/.test(panel) && /Ordenador/.test(panel) && /iPhone/.test(panel), panel.slice(0, 200))
  check('  …y el botón escondido', await p.locator('#ajInstalarBoton').isHidden())
  await p.evaluate(() => { const e = new Event('beforeinstallprompt'); e.preventDefault = () => {}; e.prompt = () => { window.__pedido = true }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e) })
  await p.waitForTimeout(200)
  check('cuando el navegador lo dice, sale «Instalar»', await p.locator('#ajInstalarBoton').isVisible())
  await p.click('#ajInstalarBoton [data-instalar="si"]')
  await p.waitForTimeout(300)
  check('  …y abre el instalador; aceptado, lo dice', await p.evaluate(() => window.__pedido === true) && /Instalado/.test(await p.locator('#ajPanel').textContent()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()

  const ctx2 = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx2.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  const q = await ctx2.newPage()
  await q.goto(`${BASE}/ajustes.html?ver=instalar`, { waitUntil: 'domcontentloaded' })
  await q.waitForTimeout(2000)
  check('en el iPhone, los tres pasos de Safari dibujados', (await q.locator('#ajPanel .bm-instalar-pasos li').count()) === 3 && await q.evaluate(() => [...document.querySelectorAll('#ajPanel .bm-instalar-pasos li')].every((li) => li.querySelector('svg') && getComputedStyle(li).display === 'flex')))
  await ctx2.close()

  const ctx3 = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx3.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    const original = window.matchMedia.bind(window)
    window.matchMedia = (qq) => (qq.includes('display-mode: standalone') ? { matches: true, media: qq, addEventListener() {}, removeEventListener() {} } : original(qq))
  })
  const r = await ctx3.newPage()
  await r.goto(`${BASE}/ajustes.html?ver=instalar`, { waitUntil: 'domcontentloaded' })
  await r.waitForTimeout(2000)
  check('ya instalada, lo dice y no enseña pasos', /Ya lo tienes instalado/.test(await r.locator('#ajPanel').textContent()) && (await r.locator('#ajPanel .bm-instalar-pasos').count()) === 0)
  await ctx3.close()
}

console.log('── /compartir salta a donde toca ──')
{
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 } })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/compartir.html?url=${encodeURIComponent('https://www.cardmarket.com/es/Pokemon/Products/Singles/151/Mew-ex-MEW151')}`, { waitUntil: 'domcontentloaded' })
  await p.waitForURL(/\/cartas/, { timeout: 5000 }).catch(() => {})
  const u = new URL(p.url())
  check('un enlace de Cardmarket acaba en el buscador con la carta', /\/cartas/.test(u.pathname) && u.searchParams.get('ver') === 'buscar' && u.searchParams.get('q') === 'Mew ex', p.url())
  await ctx.close()
}
await browser.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
