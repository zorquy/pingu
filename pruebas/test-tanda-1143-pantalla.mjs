// Tanda 1143 — «Lo que se ha quedado viejo» (PINGU: «dale con lo
// recomendado»): V2, el Laboratorio sin el hueco bajo el título, sin el
// «Probar» cortado y con los tres pasos numerados; V1, Mis partidas en filas
// (chapa del resultado, mazos, dónde y cuándo, ⋯) agrupadas por mes.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Lo puro ──')
{
  const E = await import(`${RAIZ}/js/estadisticas-partidas.js`)
  const hoy = new Date(2026, 9, 31)
  check('fecha corta: «31 oct», con el año si no es el de hoy', E.fechaCorta('2026-10-31', hoy) === '31 oct' && E.fechaCorta('2025-01-02', hoy) === '2 ene 2025' && E.fechaCorta(null, hoy) === '')
  const g = E.porMeses([{ fecha: '2026-10-31', resultado: 'win' }, { fecha: '2026-10-02', resultado: 'loss' }, { fecha: null, resultado: 'draw' }, { fecha: '2026-09-20', resultado: 'win' }])
  check('por meses, en el orden en que llegan, con su balance', JSON.stringify(g.map((x) => [x.titulo, x.balance, x.partidas.length])) === JSON.stringify([['Octubre de 2026', '1-1-0', 2], ['Septiembre de 2026', '1-0-0', 1], ['Sin fecha', '0-0-1', 1]]), JSON.stringify(g.map((x) => x.titulo)))
}

const b = await chromium.launch()
console.log('── 2. Laboratorio en el PC ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/laboratorio`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const m = await page.evaluate(() => {
    const cab = document.querySelector('.lp-cabecera').getBoundingClientRect()
    const bloques = [...document.querySelectorAll('.lp-bloque')].map((x) => x.getBoundingClientRect())
    const mazos = [...document.querySelectorAll('.lp-mazo')].map((x) => { const r = x.getBoundingClientRect(); const p = x.querySelector('.lp-mazo-probar').getBoundingClientRect(); const caja = x.closest('.lp-bloque').getBoundingClientRect(); return p.right <= r.right + 1 && r.right <= caja.right + 1 })
    return { hueco: Math.round(bloques[0].top - cab.bottom), alturas: bloques.map((x) => Math.round(x.height)), mazos, desborda: [...document.querySelectorAll('.lp-bloque')].some((x) => x.scrollWidth > x.clientWidth + 1), pasos: [...document.querySelectorAll('.lp-paso')].map((x) => x.textContent).join('') }
  })
  check('sin el hueco bajo el título (era ~240 px)', m.hueco < 60, m.hueco)
  check('el «Probar» de cada mazo, dentro de su tarjeta', m.mazos.length >= 1 && m.mazos.every(Boolean) && !m.desborda, JSON.stringify(m))
  check('las tres cajas, de la misma altura', new Set(m.alturas).size === 1, JSON.stringify(m.alturas))
  check('los tres pasos numerados', m.pasos === '123', m.pasos)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

async function abrirPartidas(movil) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  await page.locator('button, [role=tab]', { hasText: /^Partidas( sueltas)?$/ }).first().click()
  await page.waitForTimeout(800)
  return { ctx, page, errores }
}

console.log('── 3. Mis partidas en el PC ──')
{
  const { ctx, page, errores } = await abrirPartidas(false)
  const d = await page.evaluate(() => ({
    meses: [...document.querySelectorAll('.partidas-mes-titulo')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
    filas: document.querySelectorAll('#partidasLista .partidas-fila').length,
    altos: [...document.querySelectorAll('#partidasLista .partidas-fila')].map((f) => Math.round(f.getBoundingClientRect().height)),
    botones: document.querySelectorAll('#partidasLista .partidas-fila [data-editar]:not(.partidas-mas-menu [data-editar])').length,
    fechas: [...document.querySelectorAll('#partidasLista .partidas-fila-donde time')].map((t) => t.textContent).slice(0, 3),
    columnas: [...document.querySelectorAll('#partidasLista .partidas-fila-donde')].map((x) => Math.round(x.getBoundingClientRect().right)),
  }))
  check('agrupadas por mes, con el balance', d.meses.length >= 1 && /^[A-ZÁÉÍÓÚ][a-z]+ de \d{4} \d+-\d+-\d+$/i.test(d.meses[0]), JSON.stringify(d.meses))
  check('una fila por partida, baja (≤ 80 px)', d.filas >= 5 && d.altos.every((h) => h <= 80), JSON.stringify(d.altos))
  check('la fecha corta («31 oct»), no «2026-10-31»', d.fechas.length && d.fechas.every((f) => /^\d{1,2} [a-z]{3,4}( \d{4})?$/.test(f)), JSON.stringify(d.fechas))
  check('dónde y cuándo, alineados a la derecha en todas las filas', new Set(d.columnas).size === 1, JSON.stringify(d.columnas))
  check('sin botones sueltos en la fila (van en el ⋯)', d.botones === 0, d.botones)
  await page.locator('#partidasLista .partidas-mas-btn').first().click()
  await page.waitForTimeout(300)
  const menu = await page.evaluate(() => { const m = document.querySelector('.partidas-mas[open] .partidas-mas-menu'); return m ? [...m.querySelectorAll('button, a')].map((x) => x.textContent.trim()) : null })
  check('el ⋯ abre Compartir, Editar y Borrar', menu && ['Compartir', 'Editar', 'Borrar'].every((t) => menu.includes(t)), JSON.stringify(menu))
  await page.mouse.click(5, 300)
  await page.waitForTimeout(200)
  check('  …y un clic fuera lo cierra', (await page.locator('.partidas-mas[open]').count()) === 0)
  await page.locator('#partidasLista .partidas-mas-btn').first().click()
  await page.locator('.partidas-mas[open] [data-editar]').click()
  await page.waitForTimeout(400)
  check('«Editar» abre el formulario de la partida', await page.locator('#partidaForm').isVisible().catch(() => false))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/1143-partidas-pc.png' })
  await ctx.close()
}

console.log('── 4. Mis partidas en el móvil ──')
{
  const { ctx, page, errores } = await abrirPartidas(true)
  const d = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    nombres: [...document.querySelectorAll('#partidasLista .partidas-fila-mazos strong')].slice(0, 4).map((s) => s.scrollWidth <= s.clientWidth + 1),
    altos: [...document.querySelectorAll('#partidasLista .partidas-fila')].map((f) => Math.round(f.getBoundingClientRect().height)),
  }))
  check('nada se sale de lado', d.ancho)
  check('los nombres de los mazos se leen enteros', d.nombres.every(Boolean), JSON.stringify(d.nombres))
  check('cada partida mide menos de la mitad que antes (≤ 130 px; eran ~280)', d.altos.every((h) => h <= 130), JSON.stringify(d.altos))
  const ultimo = page.locator('#partidasLista .partidas-mas-btn').nth(3)
  await ultimo.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(200)
  await ultimo.click()
  await page.waitForTimeout(300)
  const tapa = await page.evaluate(() => {
    const m = document.querySelector('.partidas-mas[open] .partidas-mas-menu')?.getBoundingClientRect()
    const barra = document.querySelector('.bm-burbuja, nav.bm')?.getBoundingClientRect()
    return m && barra ? m.bottom <= barra.top + 1 || m.top >= barra.bottom : null
  })
  check('el ⋯ no se abre debajo de la burbuja', tapa !== false, tapa)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.screenshot({ path: '/tmp/1143-partidas-movil.png' })
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
