// Tanda 1145 — «Otra vuelta por la web» (PINGU: «todo menos lo último de la
// ficha»): W1, la ficha de un torneo en el móvil con la cabecera baja (datos
// en una fila que se desliza, descripción en dos líneas con «Más», Compartir
// y Calendario como iconos) y «Tu plaza» a la vista; W4, Repeticiones con una
// línea arriba, lo largo plegado y el cuadro que empieza bajo y crece.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const b = await chromium.launch()

console.log('── 1. Torneo en el móvil ──')
{
  const larga = () => { for (const t of window.__FAKE_TORNEOS__ || []) if (t.slug === 'copa-delta') t.description = 'Torneo de lanzamiento de Delta Reign. Suizo a cuatro rondas y top 4 al mejor de tres. Trae tu lista en papel o en el móvil, y llega diez minutos antes para el check-in. Habrá sobres para todos los que terminen.' }
  const ctx = await contexto(b, true, 'user-1', larga)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/torneo?slug=copa-delta`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const d = await page.evaluate(() => {
    const f = document.getElementById('torneoFormato')
    const tops = [...f.querySelectorAll('.torneo-dato')].map((x) => Math.round(x.getBoundingClientRect().top))
    const cal = document.getElementById('btnCalendario')
    const comp = document.getElementById('btnCompartirTorneo')
    const plaza = [...document.querySelectorAll('h2, h3')].find((h) => /Tu plaza/.test(h.textContent))
    return {
      // Desde la 1341 los datos van en el cartel de Info, en chapas que bajan de
      // línea: lo que importa es que se ven todos sin salirse de lado.
      unaFila: tops.length >= 4,
      desliza: f.scrollWidth <= f.clientWidth + 1,
      // Desde la 1342 el calendario va junto al día, en Info.
      calEnCabecera: !!cal?.closest('.torneo-cuando-fila'),
      alto: innerHeight,
      iconos: [cal, comp].every((x) => x && Math.round(x.getBoundingClientRect().width) <= 48 && x.getAttribute('aria-label')),
      plaza: plaza ? Math.round(plaza.getBoundingClientRect().top) : null,
      desc: Math.round(document.getElementById('torneoDescripcion').getBoundingClientRect().height),
      mas: !document.getElementById('torneoDescMas')?.hidden,
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  check('los datos, todos y sin salirse de lado (1341: en el cartel de Info)', d.unaFila && d.desliza, JSON.stringify(d))
  check('Compartir en la cabecera y Calendario junto al día (1342), iconos con su nombre para el lector', d.calEnCabecera && d.iconos, JSON.stringify(d))
  check('la descripción larga, plegada (tres líneas desde la 1342) con «Leer más»', d.desc < 90 && d.mas, JSON.stringify(d))
  await page.click('#torneoDescMas')
  await page.waitForTimeout(200)
  const abierta = await page.evaluate(() => ({ h: Math.round(document.getElementById('torneoDescripcion').getBoundingClientRect().height), mas: document.getElementById('torneoDescMas').hidden }))
  check('  …y «Más» la abre entera', abierta.h > d.desc + 20 && abierta.mas, JSON.stringify(abierta))
  check('«Tu plaza» asoma en la primera pantalla (desde la 1341 va bajo el cartel de Info)', d.plaza !== null && d.plaza < d.alto, d.plaza)
  check('nada se sale de lado', d.ancho)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/1145-torneo.png' })
  await ctx.close()
}
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/torneo?slug=copa-delta`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const t = await page.evaluate(() => ({ cal: document.getElementById('btnCalendario')?.textContent.trim(), comp: document.getElementById('btnCompartirTorneo')?.textContent.trim() }))
  check('en el PC, los dos con su palabra', t.cal === 'Añadir al calendario' && t.comp === 'Compartir', JSON.stringify(t))
  await ctx.close()
}

console.log('── 2. Repeticiones ──')
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/repeticiones`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const d = await page.evaluate(() => ({
    ayuda: getComputedStyle(document.querySelector('.rep-pegar-ayuda')).display,
    corta: getComputedStyle(document.querySelector('.rep-pegar-corta')).display,
    lema: document.querySelector('.rep-lema').textContent.length,
    alto: Math.round(document.getElementById('repTexto').getBoundingClientRect().height),
  }))
  const nombre = movil ? 'móvil' : 'PC'
  check(`${nombre}: una línea y «¿Cómo se copia?» plegado, sin el párrafo largo`, d.ayuda === 'none' && d.corta === 'flex' && d.lema < 100, JSON.stringify(d))
  check(`${nombre}: el cuadro empieza bajo (≤ 150 px; era 240)`, d.alto <= 150, d.alto)
  if (!movil) {
    await page.evaluate(() => { const t = document.getElementById('repTexto'); t.value = Array.from({ length: 30 }, (_, i) => `Línea ${i}`).join('\n'); t.dispatchEvent(new Event('input')) })
    const crece = await page.evaluate(() => Math.round(document.getElementById('repTexto').getBoundingClientRect().height))
    check('  …y crece con lo pegado, hasta su tope', crece > 300 && crece <= 422, crece)
  }
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
