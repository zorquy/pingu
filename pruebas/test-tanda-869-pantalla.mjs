// Tanda 869 — la hoja «Tú», de catorce cosas a nueve.
//
// PINGU: «el menú del perfil quizá muestra demasiadas cosas y debería ser
// más sencillo». Lo que se mira: que la cabecera entera es el enlace al
// perfil (sin «Ver perfil» aparte); Avisos y Mensajes como estaban; lo
// tuyo son cuatro cosas CON SU CUENTA (Guardados, La quiero, Mis mazos, Mis
// partidas) y Ajustes a /ajustes; el pie lleva el tema en UN botón (claro ↔
// oscuro), «Apoyar» pequeño, «Novedades» con su punto y «Salir»; y que lo
// que se fue (Modo feria, Escribir una guía) sigue teniendo su sitio: Modo
// feria (Modo evento desde la 1029) en el Panel de Mi colección.
//
// Desde la 918 la hoja va en BALDOSAS (la propuesta «PokeDoc más sencillo»):
// el tema en un botón redondo al lado de quién eres, seis baldosas iguales
// (Avisos, Mensajes, Guardados, La quiero, Mis mazos, Partidas) con su número,
// y tres renglones: Ajustes, Apoyar PokeDoc y Salir. Novedades sale de la
// hoja (está en Inicio y en el pie).
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const KOFI = 'https://ko-fi.com/pokedoc'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 0. Lo estático ──')
{
  const js = readFileSync(`${RAIZ}/js/menu-tu.js`, 'utf8').replace(/\/\/[^\n]*/g, '')
  check('la hoja ya no pinta «Ver perfil», «Modo feria» ni «Escribir una guía», y «Ajustes» va a /ajustes', !/Ver perfil|\/feria|\/evento|editor-guia|data-tema="/.test(js) && /<a href="\/ajustes">/.test(js))
  check('Modo evento tiene su sitio en el Panel de Mi colección', /id="mcModoEvento" href="\/evento"/.test(readFileSync(`${RAIZ}/js/mi-coleccion/panel.js`, 'utf8')))
}

const browser = await chromium.launch()
async function abrir(ruta, { movil = true, sesion = 'user-1' } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript((s) => {
    window.__FAKE_SESSION__ = s
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('pokedoc-theme') } catch { /* sin memoria */ }
    // Lo tuyo, con algo que contar: tres mazos y dos partidas apuntadas.
    window.__FAKE_MAZOS__ = [1, 2, 3].map((i) => ({ id: `m${i}`, user_id: 'user-1', name: `Mazo ${i}`, cards: [] }))
  }, sesion)
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.click('#navUserBtn')
  await page.waitForTimeout(1200)
  return { page, ctx, errores }
}
const hoja = (page) => page.evaluate(() => {
  const d = document.getElementById('navUserDropdown')
  const t = (s) => (d.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim()
  const alto = (el) => Math.round(el.getBoundingClientRect().height)
  const ancho = (el) => Math.round(el.getBoundingClientRect().width)
  const tema = d.querySelector('.tu-arriba .tu-tema-boton')
  return {
    cabeza: { tag: d.querySelector('.tu-cabeza')?.tagName, href: d.querySelector('.tu-cabeza')?.getAttribute('href'), texto: t('.tu-quien'), alto: alto(d.querySelector('.tu-cabeza')) },
    verPerfil: Boolean(d.querySelector('.tu-perfil')),
    baldosas: [...d.querySelectorAll('.tu-baldosas > *')].map((x) => ({ texto: x.querySelector('span').textContent.trim(), href: x.getAttribute('href'), cuenta: x.querySelector('.tu-n:not([hidden])')?.textContent || null, alto: alto(x), ancho: ancho(x) })),
    lista: [...d.querySelectorAll('.tu-lista > *')].map((x) => ({ clase: x.className, texto: x.textContent.replace(/\s+/g, ' ').trim(), href: x.getAttribute('href'), alto: alto(x), visible: ancho(x) > 0 })),
    tema: document.documentElement.dataset.theme,
    temaBoton: tema && { ancho: ancho(tema), alto: alto(tema), label: tema.getAttribute('aria-label') },
    novedades: /Novedades/.test(d.textContent),
    tocables: [...d.querySelectorAll('a, button')].filter((x) => x.getBoundingClientRect().width > 0).length,
    dentro: (() => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && [...d.querySelectorAll('a, button')].every((x) => x.getBoundingClientRect().right <= r.right + 1) })(),
  }
})

console.log('── 1. En el iPhone ──')
{
  const { page, ctx, errores } = await abrir('/index.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await hoja(page)
  check('la cabecera entera es el enlace al perfil, de 44, con «@usuario · nivel»; sin «Ver perfil» aparte', m.cabeza.tag === 'A' && m.cabeza.href === '/perfil.html' && /^Ash @Ash · Novato/.test(m.cabeza.texto) && m.cabeza.alto >= 44 && !m.verPerfil, JSON.stringify(m.cabeza))
  check('seis baldosas iguales: Avisos, Mensajes, Guardados, La quiero, Mis mazos y Partidas, de 44 o más', m.baldosas.map((x) => x.texto).join() === 'Avisos,Mensajes,Guardados,La quiero,Mis mazos,Partidas' && m.baldosas.every((x) => x.alto >= 44 && Math.abs(x.ancho - m.baldosas[0].ancho) <= 1), JSON.stringify(m.baldosas))
  check('  …lo tuyo a su sitio', m.baldosas.slice(1).map((x) => x.href).join() === '/mensajes.html,/guardados.html,/mi-coleccion?ver=quiero,/mazos,/mis-partidas', JSON.stringify(m.baldosas.map((x) => x.href)))
  check('  …con su número donde hay algo («Mis mazos 3») y sin número donde no', m.baldosas.find((x) => x.texto === 'Mis mazos')?.cuenta === '3' && m.baldosas.find((x) => x.texto === 'Guardados')?.cuenta === null, JSON.stringify(m.baldosas.map((x) => [x.texto, x.cuenta])))
  check('debajo, tres renglones: Ajustes, Apoyar PokeDoc (a Ko-fi) y Salir, de 44', m.lista.length === 3 && m.lista[0].href === '/ajustes' && /^Ajustes$/.test(m.lista[0].texto) && m.lista[1].href === KOFI && /^Apoyar PokeDoc$/.test(m.lista[1].texto) && /tu-salir/.test(m.lista[2].clase) && m.lista.every((x) => x.alto >= 44) && m.dentro, JSON.stringify(m.lista))
  check('el tema, un botón redondo de 44 al lado de quién eres', m.temaBoton && m.temaBoton.ancho >= 44 && m.temaBoton.alto >= 44, JSON.stringify(m.temaBoton))
  check('Novedades ya no está en la hoja (918)', !m.novedades)
  // Eran quince en la 869 (y doce después): perfil, tema, seis y tres.
  check('once cosas que tocar', m.tocables === 11, String(m.tocables))
  // El tema: un botón, claro ↔ oscuro.
  const antes = m.tema
  await page.click('#navUserDropdown [data-tema-ciclo]')
  await page.waitForTimeout(500)
  const despues = await hoja(page)
  check(`el botón del tema cambia de ${antes} al otro, cambia su etiqueta, y la hoja sigue abierta`, despues.tema !== antes && despues.temaBoton.label === (despues.tema === 'dark' ? 'Cambiar al tema claro' : 'Cambiar al tema oscuro') && (await page.evaluate(() => !document.getElementById('navUserDropdown').classList.contains('hidden'))), JSON.stringify({ antes, despues: despues.tema, label: despues.temaBoton.label }))
  await ctx.close()
}

console.log('── 2. En el PC ──')
{
  const { page, ctx, errores } = await abrir('/index.html', { movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await hoja(page)
  check('la misma hoja, con todo dentro de su caja', m.baldosas.length === 6 && m.lista.length === 3 && m.dentro, JSON.stringify({ baldosas: m.baldosas.length, lista: m.lista, dentro: m.dentro }))
  await ctx.close()
}

console.log('── 3. Modo evento, en el Panel de Mi colección ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1'; try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ } })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const f = await page.evaluate(() => { const a = document.getElementById('mcModoEvento'); const r = a?.getBoundingClientRect(); return a && { href: a.getAttribute('href'), texto: a.textContent.trim(), alto: Math.round(r.height), visible: r.height > 0 } })
  check('el Panel lleva la loseta «Modo evento» a /evento', f?.href === '/evento' && f.texto === 'Modo evento' && f.visible && f.alto >= 44, JSON.stringify(f))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
