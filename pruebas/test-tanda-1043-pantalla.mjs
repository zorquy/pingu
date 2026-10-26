// Tanda 1043 — una carta se abre en su pop-up, en CUALQUIER página (PINGU:
// «siempre que cliques una carta te abra el pop-up, para no irte de donde
// estás… y a la ficha completa solo si le das a ver ficha completa»). Lo
// hace UN oyente en js/app.js sobre los enlaces a `/carta/…` y a
// `/cartas?…&carta=`; el pop-up es js/ficha-rapida.js (lo de /carta: núcleo,
// precio, «Añadir»). En Mi colección y /cartas se abre el pop-up de siempre;
// con Ctrl/Cmd o la rueda, lo de siempre (otra pestaña); y en /carta no se
// toca nada (ya es la ficha).
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const b = await chromium.launch()
async function abrir(ruta, movil = false) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { ctx, page, errores }
}
const ficha = (page) => page.evaluate(() => {
  const d = document.getElementById('fichaRapida')
  const r = d?.getBoundingClientRect()
  return d && { abierta: d.open, titulo: document.querySelector('#fichaRapida #cartaNucleo h1')?.textContent.trim(), completa: document.getElementById('fichaRapidaCompleta')?.getAttribute('href'), precio: !document.getElementById('cartaMercado')?.classList.contains('hidden'), anadir: !!document.querySelector('#fichaRapida #cmAnadir'), centrada: Math.abs((r.left + r.width / 2) - innerWidth / 2) < 4 }
})

for (const movil of [false, true]) {
  const lado = movil ? 'móvil' : 'PC'
  console.log(`── 1. ${lado}: Modo evento, tocar una carta ──`)
  const { ctx, page, errores } = await abrir('/evento', movil)
  const antes = page.url()
  await page.click('#eventoLista .evento-carta')
  await page.waitForTimeout(2500)
  const f = await ficha(page)
  check('no se va de la página', page.url() === antes, page.url())
  check('  …y abre el pop-up con la carta, su precio y «Añadir»', f?.abierta && f.titulo === 'Terapagos ex' && f.precio && f.anadir, JSON.stringify(f))
  check(movil ? '  …desde abajo, a lo ancho' : '  …centrado', movil ? (await page.evaluate(() => Math.round(document.getElementById('fichaRapida').getBoundingClientRect().width) === innerWidth)) : f?.centrada, JSON.stringify(f))
  check('  …con «Ver ficha completa» que lleva a /carta', /^\/carta\/terapagos-ex-sv08-13/.test(f?.completa || ''), f?.completa)
  const tapa = await page.evaluate(() => {
    // Nada fijo del pop-up encima de su contenido (la barra de «Añadir» de /carta).
    const a = document.querySelector('#fichaRapida .carta-acciones')
    return a ? getComputedStyle(a).position : 'sin'
  })
  check('  …«Añadir» bajo la carta, no flotando encima', tapa === 'static' || tapa === 'relative', tapa)
  await page.click('#fichaRapidaCerrar')
  check('se cierra con la ✕ y sigues donde estabas', !(await page.evaluate(() => document.getElementById('fichaRapida').open)) && page.url() === antes)
  // Otra carta: el pop-up se rehace con la nueva.
  await page.click('#eventoLista li:nth-child(2) .evento-carta')
  await page.waitForTimeout(2000)
  check('otra carta, otro pop-up', (await ficha(page))?.titulo === 'Ogerpon ex', JSON.stringify(await ficha(page)))
  // «Ver ficha completa» SÍ navega.
  await Promise.all([page.waitForURL(/\/carta\//, { timeout: 8000 }).catch(() => {}), page.click('#fichaRapidaCompleta')])
  check('«Ver ficha completa» lleva a la ficha', /\/carta\/ogerpon-ex/.test(page.url()), page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Ctrl+clic: lo de siempre ──')
{
  const { ctx, page } = await abrir('/evento')
  const r = await page.evaluate(() => {
    const a = document.querySelector('#eventoLista .evento-carta')
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true, button: 0 })
    // Que no navegue de verdad la prueba: se mira solo si alguien lo paró.
    a.addEventListener('click', (e) => { window.__parado = e.defaultPrevented; e.preventDefault() }, { once: true })
    document.addEventListener('click', (e) => { window.__paradoDoc = e.defaultPrevented }, { once: true, capture: false })
    a.dispatchEvent(ev)
    return { abierta: !!document.getElementById('fichaRapida')?.open }
  })
  await page.waitForTimeout(800)
  check('con Ctrl no se abre el pop-up (otra pestaña, como siempre)', !r.abierta && !(await page.evaluate(() => !!document.getElementById('fichaRapida')?.open)))
  await ctx.close()
}

console.log('── 3. En Mi colección, el pop-up de siempre ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion?ver=cartas')
  const antes = page.url()
  await page.evaluate(() => {
    const a = document.createElement('a')
    a.href = '/carta/charizard-ex-sv08-1'
    a.id = 'enlacePrueba'
    a.textContent = 'Charizard ex'
    document.querySelector('main').prepend(a)
  })
  await page.click('#enlacePrueba')
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => ({ editor: document.getElementById('mcEditor')?.open, rapida: !!document.getElementById('fichaRapida')?.open }))
  check('un enlace a una carta abre la ficha de Mi colección (#mcEditor), no otra', r.editor && !r.rapida && page.url() === antes, JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. La lupa de arriba (paleta) ──')
{
  const { ctx, page, errores } = await abrir('/aprender')
  const antes = page.url()
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(600)
  await page.keyboard.type('terapagos')
  await page.waitForTimeout(2200)
  const hay = await page.evaluate(() => [...document.querySelectorAll('.paleta a[href*="carta="], .paleta [data-grupo="cartas"]')].length)
  if (hay) {
    await page.click('.paleta a[href*="carta="]').catch(async () => page.keyboard.press('Enter'))
    await page.waitForTimeout(2500)
    const f = await ficha(page)
    check('una carta de la paleta se abre en el pop-up, sin irse', f?.abierta && page.url() === antes, JSON.stringify({ f, url: page.url() }))
  } else {
    check('la paleta encuentra la carta (para poder probarlo)', false, 'sin resultados de cartas')
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. En /carta no se toca nada ──')
{
  const { ctx, page } = await abrir('/carta/terapagos-ex-sv08-13')
  const r = await page.evaluate(() => {
    const a = document.createElement('a')
    a.href = '/carta/ogerpon-ex-sv08-14'
    document.body.append(a)
    let parado = null
    document.addEventListener('click', (e) => { parado = e.defaultPrevented; e.preventDefault() })
    a.click()
    return { parado, rapida: !!document.getElementById('fichaRapida') }
  })
  check('el enlace sigue siendo un enlace (ya estás en la ficha)', r.parado === false && !r.rapida, JSON.stringify(r))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
