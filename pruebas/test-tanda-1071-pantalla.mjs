// Tanda 1071 — la web de una tienda, en el navegador. PINGU: «que tenga
// este panel y ya está». Una cuenta de tienda que abre cualquier página de
// PokeDoc vuelve a /tienda (su perfil y sus mensajes sí); su lateral, su
// barra de abajo y su menú de arriba son los del panel, con el color de la
// sección; cambiar de sección no recarga; la lupa y Ctrl+K van al buscador
// del stock; la hoja «Tú» es la de una tienda; y en Datos se cambia la
// contraseña. Una persona no nota nada.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const TIENDA = { tipo: 'tienda', display_name: 'Prueba', username: 'prueba' }
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', perfil = TIENDA, marca = null, ancho = 1500, movil = false, tema = 'dark' } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } })
  await ctx.addInitScript(([s, p, m, t]) => {
    if (!sessionStorage.getItem('ya')) {
      sessionStorage.setItem('ya', '1')
      localStorage.setItem('pokedoc-theme', t)
      if (m) localStorage.setItem('pd-tienda', JSON.stringify(m))
    }
    window.__FAKE_SESSION__ = s
    if (p) window.__FAKE_PERFIL__ = p
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao' }] }
    window.__FAKE_PERFILES__ = [{ id: 'user-1', username: 'Misty', display_name: 'Misty' }]
  }, [sesion, perfil, marca, tema])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  return { p, ctx, errs }
}
const ruta = (p) => new URL(p.url()).pathname.replace(/\.html$/, '').replace(/^\/$/, '/index')

console.log('── 1. Solo su panel ──')
for (const r of ['/index.html', '/mi-coleccion.html?ver=cartas', '/foro.html', '/retos.html', '/ajustes.html', '/usuario.html?u=Misty']) {
  const { p, ctx } = await abrir(r, { ancho: 1200 })
  check(`${r} → /tienda`, ruta(p) === '/tienda', p.url())
  await ctx.close()
}
for (const r of ['/usuario.html?u=prueba', '/mensajes.html']) {
  const { p, ctx, errs } = await abrir(r, { ancho: 1200 })
  check(`${r} se abre (su perfil, sus mensajes)`, ruta(p) === r.split('?')[0].replace(/\.html$/, '') && !errs.length, `${p.url()} ${errs.join(' | ')}`)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { ancho: 1200 })
  check('queda apuntada en el navegador, para irse antes la próxima vez', (await p.evaluate(() => localStorage.getItem('pd-tienda'))) === JSON.stringify({ u: 'prueba', id: 'user-2' }))
  await ctx.close()
}
{
  // Con la marca y sin sesión (caducó): una vuelta por /tienda y se olvida.
  const { p, ctx } = await abrir('/index.html', { sesion: 'none', perfil: null, marca: { u: 'prueba', id: 'user-2' }, ancho: 1200 })
  check('con la marca y sin sesión: a /tienda (que pide entrar) y la marca se borra', ruta(p) === '/tienda' && (await p.evaluate(() => localStorage.getItem('pd-tienda'))) === null && (await p.isVisible('#tdEntrar')))
  await p.goto(`${BASE}/index.html`); await p.waitForTimeout(1500)
  check('  …y la portada ya se abre', ruta(p) === '/index')
  await ctx.close()
}
{
  const { p, ctx, errs } = await abrir('/index.html', { perfil: { tipo: 'persona' }, ancho: 1200 })
  check('una persona: la portada, sin marca y con su menú de siempre', ruta(p) === '/index' && (await p.evaluate(() => localStorage.getItem('pd-tienda'))) === null && (await p.evaluate(() => document.documentElement.dataset.seccion)) !== 'tienda' && !(await p.evaluate(() => document.documentElement.classList.contains('es-tienda'))), errs.join(' | '))
  await ctx.close()
}

console.log('── 2. El ordenador, con la lateral ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html')
  check('sin errores', !errs.length, errs.join(' | '))
  const lat = await p.$$eval('.lat-seccion-enlace', (as) => as.map((a) => a.textContent.trim() + (a.getAttribute('aria-current') ? '*' : '')))
  check('la lateral es la del panel, con Hoy marcada', lat.join(',') === 'Hoy*,Stock,Ventas,Escaparate,Mensajes,Datos', lat.join(','))
  check('  …sin el Ko-fi, y abajo «Tu tienda»', (await p.locator('.lat-apoyar').count()) === 0 && /Tu tienda/.test(await p.textContent('.lat-yo')))
  check('  …la lupa dice que busca en tu stock', /Busca en tu stock/.test(await p.textContent('#navSearchBtn')) && (await p.getAttribute('#navSearchBtn', 'href')) === '/tienda?ver=stock&buscar=1')
  const c = await p.evaluate(() => ({ s: document.documentElement.dataset.seccion, boton: getComputedStyle(document.querySelector('.lat-activa .lat-seccion-enlace')).color, pie: getComputedStyle(document.querySelector('.footer')).display, pestanas: getComputedStyle(document.getElementById('tdPestanas')).display }))
  check('el color de la sección (oscuro), sin pie y sin las pestañas repetidas', c.s === 'tienda' && c.boton === 'rgb(60, 201, 214)' && c.pie === 'none' && c.pestanas === 'none', JSON.stringify(c))
  await p.evaluate(() => { window.__sinRecargar = 1 })
  await p.click('.lat-seccion-enlace[data-ver="escaparate"]'); await p.waitForTimeout(700)
  check('Escaparate: sin recargar, con su pestaña y la dirección', (await p.evaluate(() => window.__sinRecargar)) === 1 && (await p.isVisible('[data-td-hoja="escaparate"]')) && new URL(p.url()).searchParams.get('ver') === 'escaparate')
  check('  …y la lateral marca Escaparate', (await p.getAttribute('.lat-seccion-enlace[data-ver="escaparate"]', 'aria-current')) === 'page' && !(await p.getAttribute('.lat-seccion-enlace[data-ver="hoy"]', 'aria-current')) && (await p.locator('.lat-activa .lat-seccion-enlace[data-ver="escaparate"]').count()) === 1)
  await p.keyboard.press('Control+k'); await p.waitForTimeout(1500)
  check('Ctrl+K: al Stock, con el cursor en su buscador', new URL(p.url()).searchParams.get('ver') === 'stock' && (await p.evaluate(() => document.activeElement?.matches('[data-tds-q]'))) && (await p.evaluate(() => window.__sinRecargar)) === 1)
  await p.click('.lat-seccion-enlace[data-ver="datos"]'); await p.waitForTimeout(500)
  check('Datos: tu cuenta, con tu correo', (await p.textContent('#tdCuentaEmail')) === 'user-2@pruebas.test' && (await p.isVisible('#tdCuentaClave')))
  await p.click('#tdCuentaClave'); await p.waitForTimeout(500)
  const reset = await p.evaluate(() => window.__AUTH__.find((a) => a.que === 'resetPasswordForEmail'))
  check('  …«Cambiar la contraseña» manda el enlace de siempre', reset?.email === 'user-2@pruebas.test' && reset?.redirectTo?.endsWith('/reset-password.html'), JSON.stringify(reset))
  await p.click('.lat-yo'); await p.waitForTimeout(1200)
  const hoja = await p.textContent('#navUserDropdown')
  check('la hoja «Tú»: la de la tienda (Stock, Escaparate, su perfil público, Salir), sin Ajustes ni Ko-fi ni racha', /Stock/.test(hoja) && /Tu perfil público/.test(hoja) && /Salir/.test(hoja) && !/Ajustes|Apoyar|racha|Guardados/.test(hoja), hoja.replace(/\s+/g, ' '))
  check('  …su cabecera lleva al panel y dice «Tienda»', (await p.getAttribute('.tu-cabeza', 'href')) === '/tienda' && /@prueba · Tienda/.test(await p.textContent('.tu-cabeza')))
  await p.click('#navUserDropdown a[data-ver="stock"]'); await p.waitForTimeout(600)
  check('  …y Stock cambia de pestaña sin recargar', (await p.evaluate(() => window.__sinRecargar)) === 1 && (await p.isVisible('[data-td-hoja="stock"]')) && (await p.isHidden('#navUserDropdown')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock')
  check('abrir /tienda?ver=stock marca Stock en la lateral', (await p.getAttribute('.lat-seccion-enlace[data-ver="stock"]', 'aria-current')) === 'page')
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/tienda.html', { ancho: 1200, tema: 'light' })
  const c = await p.evaluate(() => ({ pestanas: getComputedStyle(document.getElementById('tdPestanas')).display, boton: getComputedStyle(document.querySelector('.td-pasos .btn-secondary, .btn-primary')).color, enlaces: [...document.querySelectorAll('.nav-links a')].map((a) => a.textContent) }))
  check('PC estrecho: las pestañas del panel se quedan (no hay lateral)', c.pestanas !== 'none', JSON.stringify(c))
  check('  …y el menú de arriba es el de la tienda', c.enlaces.join(',') === 'Hoy,Stock,Ventas,Escaparate,Mensajes,Datos', c.enlaces.join(','))
  await ctx.close()
}

console.log('── 3. El móvil ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html', { movil: true })
  check('sin errores', !errs.length, errs.join(' | '))
  const bm = await p.$$eval('.bm a', (as) => as.map((a) => a.textContent.trim() + (a.getAttribute('aria-current') ? '*' : '')))
  check('la barra de abajo es la del panel', bm.join(',') === 'Hoy*,Stock,Vender,Escaparate,Mensajes', bm.join(','))
  check('  …sin burbuja ni cabecera de «volver»', (await p.locator('.bm-burbuja').count()) === 0 && (await p.locator('.bm-cab').count()) === 0)
  check('  …y arriba, «Busca en tu stock…»', /Busca en tu stock/.test(await p.textContent('.bm-pastilla')) && /buscar=1/.test(await p.getAttribute('.bm-pastilla', 'href')))
  check('  …la pestaña de en medio no se repite arriba', (await p.evaluate(() => getComputedStyle(document.getElementById('tdPestanas')).display)) === 'none')
  await p.evaluate(() => { window.__sinRecargar = 1 })
  await p.tap('.bm a[data-ver="escaparate"]'); await p.waitForTimeout(700)
  check('tocar Escaparate cambia sin recargar y lo marca abajo', (await p.evaluate(() => window.__sinRecargar)) === 1 && (await p.isVisible('[data-td-hoja="escaparate"]')) && (await p.getAttribute('.bm a[data-ver="escaparate"]', 'aria-current')) === 'page')
  check('sin salirse de ancho', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/mensajes.html', { movil: true })
  check('en Mensajes, la misma barra con Mensajes marcada', (await p.getAttribute('.bm a[href="/mensajes"]', 'aria-current')) === 'page' && (await p.locator('.bm a').count()) === 5)
  await ctx.close()
}
{
  const { p, ctx } = await abrir('/index.html', { perfil: { tipo: 'persona' }, movil: true })
  const bm = await p.$$eval('.bm a span', (as) => as.map((a) => a.textContent.trim()))
  check('una persona en el móvil: su barra de siempre', bm.join(',') === 'Inicio,Aprender,Colección,Comunidad,Jugar', bm.join(','))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
