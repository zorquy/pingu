// Tanda 869 — la hoja «Tú», de catorce cosas a nueve.
//
// PINGU: «el menú del perfil quizá muestra demasiadas cosas y debería ser
// más sencillo». Lo que se mira: que la cabecera entera es el enlace al
// perfil (sin «Ver perfil» aparte); Avisos y Mensajes como estaban; lo
// tuyo son cuatro cosas CON SU CUENTA (Guardados, La quiero, Mis mazos, Mis
// partidas) y Ajustes a /ajustes; el pie lleva el tema en UN botón (claro ↔
// oscuro), «Apoyar» pequeño, «Novedades» con su punto y «Salir»; y que lo
// que se fue (Modo feria, Escribir una guía) sigue teniendo su sitio: Modo
// feria en el Panel de Mi colección.
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
  check('la hoja ya no pinta «Ver perfil», «Modo feria» ni «Escribir una guía», y «Ajustes» va a /ajustes', !/Ver perfil|\/feria|editor-guia|data-tema="/.test(js) && /fila\('\/ajustes'/.test(js))
  check('Modo feria tiene su sitio en el Panel de Mi colección', /id="mcModoFeria" href="\/feria"/.test(readFileSync(`${RAIZ}/js/mi-coleccion/panel.js`, 'utf8')))
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
  return {
    cabeza: { tag: d.querySelector('.tu-cabeza')?.tagName, href: d.querySelector('.tu-cabeza')?.getAttribute('href'), texto: t('.tu-quien'), alto: alto(d.querySelector('.tu-cabeza')) },
    verPerfil: Boolean(d.querySelector('.tu-perfil')),
    dos: [...d.querySelectorAll('.tu-dos > *')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
    lista: [...d.querySelectorAll('.tu-lista a')].map((a) => ({ texto: a.querySelector('span').childNodes[0].textContent.trim(), href: a.getAttribute('href'), cuenta: a.querySelector('.tu-n:not([hidden])')?.textContent || null, alto: alto(a) })),
    pie: [...d.querySelectorAll('.tu-pie > *')].map((x) => ({ clase: x.className, texto: x.textContent.replace(/\s+/g, ' ').trim(), href: x.getAttribute('href'), alto: alto(x), ancho: Math.round(x.getBoundingClientRect().width), visible: x.getBoundingClientRect().width > 0, label: x.getAttribute('aria-label') })),
    tema: document.documentElement.dataset.theme,
    tocables: [...d.querySelectorAll('a, button')].filter((x) => x.getBoundingClientRect().width > 0).length,
    dentro: (() => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && [...d.querySelectorAll('.tu-pie > *')].every((x) => x.getBoundingClientRect().right <= r.right + 1) })(),
  }
})

console.log('── 1. En el iPhone ──')
{
  const { page, ctx, errores } = await abrir('/index.html')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await hoja(page)
  check('la cabecera entera es el enlace al perfil, de 44, con «@usuario · nivel»; sin «Ver perfil» aparte', m.cabeza.tag === 'A' && m.cabeza.href === '/perfil.html' && /^Ash @Ash · Novato/.test(m.cabeza.texto) && m.cabeza.alto >= 44 && !m.verPerfil, JSON.stringify(m.cabeza))
  check('Avisos y Mensajes, como estaban', m.dos.length === 2 && /^Avisos/.test(m.dos[0]) && /^Mensajes/.test(m.dos[1]), JSON.stringify(m.dos))
  check('lo tuyo: Guardados, La quiero, Mis mazos, Mis partidas y Ajustes (a /ajustes), de 44', m.lista.map((x) => `${x.texto}>${x.href}`).join(' | ') === 'Guardados>/guardados.html | La quiero>/mi-coleccion?ver=quiero | Mis mazos>/mazos | Mis partidas>/mis-partidas | Ajustes>/ajustes' && m.lista.every((x) => x.alto >= 44), JSON.stringify(m.lista))
  check('  …con su cuenta donde hay algo («Mis mazos 3») y sin cuenta donde no', m.lista.find((x) => x.texto === 'Mis mazos')?.cuenta === '3' && m.lista.find((x) => x.texto === 'Ajustes')?.cuenta === null, JSON.stringify(m.lista.map((x) => [x.texto, x.cuenta])))
  check('el pie: el tema (un botón de 44 de ancho), «Apoyar» a Ko-fi, «Novedades» y «Salir», todos dentro', m.pie.length === 4 && /tu-tema-boton/.test(m.pie[0].clase) && m.pie[0].ancho >= 44 && m.pie[0].alto >= 44 && m.pie[1].href === KOFI && /^Apoyar$/.test(m.pie[1].texto) && m.pie[2].href === '/novedades' && /tu-salir/.test(m.pie[3].clase) && m.dentro, JSON.stringify(m.pie))
  // Eran quince (Ver perfil, dos losetas, nueve filas, tres de tema, Salir).
  check('doce cosas que tocar (eran quince)', m.tocables === 12, String(m.tocables))
  // El tema: un botón, claro ↔ oscuro.
  const antes = m.tema
  await page.click('#navUserDropdown [data-tema-ciclo]')
  await page.waitForTimeout(500)
  const despues = await hoja(page)
  check(`el botón del tema cambia de ${antes} al otro, cambia su etiqueta, y la hoja sigue abierta`, despues.tema !== antes && despues.pie[0].label === (despues.tema === 'dark' ? 'Cambiar al tema claro' : 'Cambiar al tema oscuro') && (await page.evaluate(() => !document.getElementById('navUserDropdown').classList.contains('hidden'))), JSON.stringify({ antes, despues: despues.tema, label: despues.pie[0].label }))
  await ctx.close()
}

console.log('── 2. En el PC ──')
{
  const { page, ctx, errores } = await abrir('/index.html', { movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await hoja(page)
  check('la misma hoja, con todo dentro de su caja', m.lista.length === 5 && m.pie.length === 4 && m.dentro, JSON.stringify({ lista: m.lista.length, pie: m.pie, dentro: m.dentro }))
  await ctx.close()
}

console.log('── 3. Modo feria, en el Panel de Mi colección ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1'; try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch { /* sin memoria */ } })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const f = await page.evaluate(() => { const a = document.getElementById('mcModoFeria'); const r = a?.getBoundingClientRect(); return a && { href: a.getAttribute('href'), texto: a.textContent.trim(), alto: Math.round(r.height), visible: r.height > 0 } })
  check('el Panel lleva la loseta «Modo feria» a /feria', f?.href === '/feria' && f.texto === 'Modo feria' && f.visible && f.alto >= 44, JSON.stringify(f))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
