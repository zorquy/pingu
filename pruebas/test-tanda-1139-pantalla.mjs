// Tanda 1139 — de la propuesta «Comunidad, guías y menú» (PINGU eligió):
// N2, el número de cada sección en la barra de abajo y en la lateral; G1, el
// índice de la guía en el móvil (desde la barra pegada); F2, en un tema la
// barra dice «N de M», ofrece «N nuevos ↓» y una raya marca lo nuevo.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const N = await import(`${RAIZ}/js/numeros-seccion.js`)
  const c = N.cuentasDeSecciones([{ type: 'forum_reply' }, { type: 'forum_mention', read_at: 'x' }, { type: 'torneo_ronda' }, { type: 'tournament_x' }, { type: 'new_follower' }], '3')
  check('Comunidad: mensajes + avisos del foro sin leer; Jugar: los de torneos', c.Comunidad === 4 && c.Jugar === 2, JSON.stringify(c))
  check('  …«9+» del sobre cuenta como diez', N.cuentasDeSecciones([], '9+').Comunidad === 10)
  check('  …y el número se pinta como el del avatar', N.textoDeNumero(0) === '' && N.textoDeNumero(3) === '3' && N.textoDeNumero(12) === '9+')
  const B = await import(`${RAIZ}/js/barra-pegada.js`)
  check('la sección actual: la última cuyo título ya pasó la barra', B.seccionActual([-400, -10, 300]) === 1 && B.seccionActual([200, 600]) === -1 && B.seccionActual([null, 50]) === 1)
}

const conAvisos = () => {
  window.__FAKE_NOTIFICACIONES__ = [
    ...(window.__FAKE_NOTIFICACIONES__ || []),
    { recipient_id: window.__FAKE_SESSION__, type: 'torneo_ronda', title: 'Ronda 2 publicada', link: '/torneo/copa-delta', created_at: new Date().toISOString() },
  ]
  // La guía con texto de verdad y cuatro secciones (el fixture solo trae `blocks`).
  for (const g of window.__FAKE_GUIAS__ || []) {
    const p = (t) => ({ type: 'paragraph', text: `${t} `.repeat(60) })
    g.reference_blocks = ['La lista', 'Plan de juego', 'Emparejamientos', 'Cambios tras la rotación'].flatMap((t) => [{ type: 'heading', text: t }, p(t), p(t)])
  }
}
const numeros = (page, sel) => page.$$eval(sel, (as) => Object.fromEntries(as.map((a) => [a.querySelector('span:not(.sec-num)')?.textContent.trim(), a.querySelector('.sec-num')?.textContent || ''])))

const b = await chromium.launch()
console.log('── 2. N2: el número de cada sección ──')
{
  const ctx = await contexto(b, true, 'user-1', conAvisos)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const n = await numeros(page, 'nav.bm > a')
  check('móvil: Comunidad 1 (la respuesta del foro) y Jugar 1 (la ronda)', n.Comunidad === '1' && n.Jugar === '1' && !n.Inicio && !n.Aprender, JSON.stringify(n))
  const lbl = await page.getAttribute('nav.bm > a[href*="foro"]', 'aria-label')
  check('  …y quien no ve lo lee', /Comunidad \(1 sin leer\)/.test(lbl || ''), lbl)
  const sitio = await page.$eval('nav.bm > a[href*="foro"] .sec-num', (e) => { const r = e.getBoundingClientRect(); const a = e.parentElement.getBoundingClientRect(); return r.top >= a.top - 1 && r.right <= a.right + 1 })
  check('  …dentro de su hueco de la barra', sitio)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/1139-barra.png' })
  await ctx.close()
}
{
  const ctx = await contexto(b, false, 'user-1', conAvisos)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const n = await numeros(page, '.lat-seccion-enlace')
  check('PC: la lateral lleva los mismos números', n.Comunidad === '1' && n.Jugar === '1', JSON.stringify(n))
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'none')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  check('sin cuenta, ningún número', (await page.$$('nav.bm .sec-num')).length === 0)
  await ctx.close()
}

console.log('── 3. G1: el índice de la guía en el móvil ──')
{
  const ctx = await contexto(b, true, 'user-1', conAvisos)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/guia/charizard-ex`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => document.getElementById('section-1')?.scrollIntoView())
  await page.waitForTimeout(700)
  const btn = page.locator('#barraPegada .barra-pegada-indice-btn')
  check('al bajar, la barra pegada lleva el botón del índice', await btn.isVisible())
  check('  …y no lleva el botón de la derecha (una guía no tiene «nuevos»)', (await page.$eval('#barraPegada .barra-pegada-accion', (b) => getComputedStyle(b).display)) === 'none')
  await btn.click()
  await page.waitForTimeout(300)
  const ind = await page.$$eval('#barraPegadaIndice a', (as) => as.map((a) => [a.textContent, a.classList.contains('activo')]))
  check('  …despliega las cuatro secciones, con la actual marcada', ind.length === 4 && ind[1][1] === true, JSON.stringify(ind))
  check('  …y el botón dice que está abierto', (await btn.getAttribute('aria-expanded')) === 'true')
  await page.screenshot({ path: '/tmp/1139-indice.png' })
  await page.click('#barraPegadaIndice a[href="#section-3"]')
  await page.waitForTimeout(900)
  const top = await page.$eval('#section-3', (h) => Math.round(h.getBoundingClientRect().top))
  check('  …tocar una sección la lleva allí, debajo de las barras, y se pliega', top >= 100 && top < 260 && (await page.$eval('#barraPegadaIndice', (n) => n.hidden)), String(top))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. F2: «N de M» y lo nuevo en un tema ──')
{
  const ctx = await contexto(b, true, 'user-1', conAvisos)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/tema/tema-2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const raya = await page.evaluate(() => { const r = document.querySelector('.foro-raya-nuevos'); return r ? r.nextElementSibling?.id : null })
  check('la raya «Nuevo desde tu última visita» encima del primero que no habías visto', raya === 'mensaje-msg-3', raya)
  await page.evaluate(() => document.getElementById('mensaje-msg-4')?.scrollIntoView())
  await page.waitForTimeout(700)
  const cifra = (await page.textContent('#barraPegada .barra-pegada-cifra-texto'))?.trim()
  check('al bajar, la barra dice por qué mensaje vas («N de 14»)', /^\d+ de 14$/.test(cifra || ''), cifra)
  const accion = page.locator('#barraPegada .barra-pegada-accion')
  check('  …y «2 nuevos ↓» (los de otros desde tu última visita)', (await accion.isVisible()) && (await accion.textContent()).trim() === '2 nuevos ↓', await accion.textContent())
  await page.screenshot({ path: '/tmp/1139-tema.png' })
  await accion.click()
  await page.waitForTimeout(900)
  check('  …tocarlo baja al primero y se quita', !(await accion.isVisible()))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, true, 'user-1', () => { window.__FAKE_LECTURAS__ = [] })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/tema/tema-2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('si nunca habías entrado, sin raya (todo sería nuevo)', !(await page.$('.foro-raya-nuevos')))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
