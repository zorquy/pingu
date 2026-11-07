// Tanda 1264 — lo de las tiendas va por privado. PINGU pidió fotos a una
// tienda; al subirlas le llegó el aviso… y se le marcó «Deseos y cambios»
// («las tiendas van por privado, no en Cruces»), y en Mensajes «Ver las fotos»
// no hacía nada. Ahora: los avisos de ofertas y fotos de una tienda son de
// Mensajes (no suman en Colección ni en Deseos y cambios, que ya cuenta el
// sobre); Deseos y cambios cuenta solo los tratos entre personas y los cruces;
// un aviso a /usuario/<tienda> se lee en /tiendas/<tienda>; y «Ver las fotos»
// dice lo que pasa si no puede enseñarlas.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const N = await import(`${RAIZ}/js/numeros-seccion.js`)
  check('ofertas y fotos de tiendas son de Mensajes', N.seccionDeAviso('tienda_fotos') === 'Mensajes' && N.seccionDeAviso('tienda_oferta') === 'Mensajes')
  const c = N.cuentasDeSecciones([
    { type: 'tienda_fotos', link: '/mensajes.html?c=c1' }, { type: 'tienda_oferta', link: '/mensajes.html?c=c1' },
    { type: 'aviso_precio', link: '/carta/sv3-1' }, { type: 'tienda_la_tiene', link: '/usuario/ryu?carta=c1' },
    { type: 'cambio_aceptado', link: '/mi-coleccion?ver=cambios#oferta-1' },
  ], '2')
  check('Colección: el trato, la alerta y «la tiene una tienda»; Mensajes: solo el sobre', c['Colección'] === 3 && c.Mensajes === 2, JSON.stringify(c))
  check('  …Deseos y cambios y Cruces: solo el trato', c.paginas.cambios === 1 && c.paginas.cruces === 1, JSON.stringify(c.paginas))
  check('  …y la campana no cuenta lo de las tiendas (va con su mensaje)', N.avisosSinSeccion([{ type: 'tienda_fotos' }, { type: 'tienda_oferta' }]).length === 0)
  const loc = (u) => { const x = new URL(u, 'https://pokedoc.es'); return { pathname: x.pathname, search: x.search, host: x.host } }
  check('un aviso a /usuario/<tienda> se lee en /tiendas/<tienda>', N.casaConLaPagina('/usuario/ryu?carta=c1', loc('/tiendas/ryu?carta=c1')) && !N.casaConLaPagina('/usuario/ryu', loc('/tiendas')) && !N.casaConLaPagina('/usuario/ryu', loc('/tiendas/otra')))
  const G = await import(`${RAIZ}/js/avisos-chips.js`)
  check('/avisos tiene el chip Mensajes', G.casaConChip({ type: 'tienda_fotos' }, 'Mensajes') && !G.casaConChip({ type: 'tienda_fotos' }, 'para-ti'))
}

const conAvisoDeTienda = () => {
  const quien = window.__FAKE_SESSION__
  window.__FAKE_NOTIFICACIONES__ = [
    { recipient_id: quien, type: 'tienda_fotos', title: 'Ya tienes las fotos', body: 'Ya están las fotos que me pediste.', link: '/mensajes.html?c=c9', created_at: new Date(Date.now() - 60000).toISOString() },
  ]
}
const b = await chromium.launch()
console.log('── 2. Deseos y cambios no se marca ──')
for (const movil of [true, false]) {
  const ctx = await contexto(b, movil, 'user-1', conAvisoDeTienda)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion?ver=mercado`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const llego = await page.evaluate(() => (window.__pdAvisos || []).some((a) => a.type === 'tienda_fotos' && !a.read_at))
  check(`${movil ? 'móvil' : 'PC'}: el aviso de la tienda está sin leer`, llego)
  const nums = await page.$$eval('.sec-num', (es) => es.filter((e) => e.offsetParent && e.textContent.trim() && !/foro|Comunidad/.test(e.parentElement.outerHTML.slice(0, 200))).map((e) => e.parentElement.outerHTML.slice(0, 120)))
  check('  …y ni Colección, ni Deseos y cambios, ni Cruces llevan número', !nums.length, JSON.stringify(nums))
  if (!movil) {
    const campana = await page.$eval('#navBellBadge', (x) => (x.classList.contains('hidden') ? '' : x.textContent)).catch(() => '')
    check('  …ni la campana lo cuenta (lo cuenta el sobre)', campana === '', campana)
  }
  check('  sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. «Ver las fotos» nunca se queda callado ──')
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' })
  const ahora = Date.now()
  await ctx.addInitScript((ahora) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_PERFILES__ = [{ id: 'tienda-1', username: 'ryu', display_name: 'RyuCards', tipo: 'tienda' }, { id: 'user-1', username: 'ane', display_name: 'Ane', tipo: 'persona' }]
    window.__FAKE_FILAS__ = { conversations: [{ id: 'c1' }], conversation_participants: [{ conversation_id: 'c1', user_id: 'user-1' }, { conversation_id: 'c1', user_id: 'tienda-1' }],
      private_messages: [{ id: 'm1', conversation_id: 'c1', sender_id: 'tienda-1', body: 'Ya están las fotos que me pediste.', created_at: new Date(ahora - 6e4).toISOString(), deleted_at: null, adjuntos: [{ tipo: 'fotos_tienda', stock_id: 'e1', evento: 'fotos_subidas' }] }],
      tienda_stock_fotos: [] }
  }, ahora)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}/mensajes.html?c=c1`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  await p.tap('[data-fotos-ver="e1"]'); await p.waitForTimeout(900)
  const aviso = await p.locator('.toast').allTextContents()
  check('sin fotos a la vista: lo dice (no se queda callado)', aviso.some((t) => /ya no tiene fotos a la vista/.test(t)), JSON.stringify(aviso))
  check('  …y no abre una ventana vacía', !(await p.isVisible('#tdfVer[open]')))
  check('  sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
