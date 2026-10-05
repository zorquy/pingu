// Tanda 628 — Mis partidas: filtros, gráficos y estadísticas.
//
// PINGU: «un filtro para filtrar por días, victorias, derrotas, partidas
// más recientes, más antiguas, etc. Además de hacer gráficos y sacar
// estadísticas de todo, para tener el máximo de información al alcance».
//
//   1. Las cuentas (js/estadisticas-partidas.js), en Node: periodos,
//      filtros, orden, rachas y las series de los gráficos.
//   2. Los gráficos (js/graficos-partidas.js), en Node: lo que dibujan.
//   3. La pestaña de estadísticas: los filtros mandan en TODO, las cifras
//      nuevas, los gráficos al verse y al cambiar de ancho, y su cartel.
//   4. La lista de sueltas y los torneos: orden y filtros.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.RAIZ || '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const E = await import(`${RAIZ}/js/estadisticas-partidas.js`)
const G = await import(`${RAIZ}/js/graficos-partidas.js`)

const P = (fecha, resultado, extra = {}) => ({ fecha, resultado, tipo: 'normal', mio: 'a:1', mioNombre: 'Dragapult', rival: 'd:lugia', rivalNombre: 'Lugia', donde: 'TCG Live', ...extra })

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las cuentas ──')
{
  const HOY = '2026-10-05'
  check('«hoy» es hoy', JSON.stringify(E.rangoDePeriodo('hoy', HOY)) === JSON.stringify({ desde: HOY, hasta: HOY }))
  check('«últimos 7 días» son siete contando hoy', E.rangoDePeriodo('7', HOY).desde === '2026-09-29' && E.rangoDePeriodo('7', HOY).hasta === HOY)
  check('«siempre», sin límites', E.rangoDePeriodo('siempre', HOY).desde === null && E.rangoDePeriodo('siempre', HOY).hasta === null)
  check('«entre dos fechas» puestas al revés se entienden al derecho', JSON.stringify(E.rangoDePeriodo('rango', HOY, '2026-10-01', '2026-09-01')) === JSON.stringify({ desde: '2026-09-01', hasta: '2026-10-01' }))
  check('  …y con una sola, abierto por el otro lado', JSON.stringify(E.rangoDePeriodo('rango', HOY, '2026-09-01', '')) === JSON.stringify({ desde: '2026-09-01', hasta: null }))
  check('el cambio de mes y de año al restar días', E.sumarDias('2026-03-01', -1) === '2026-02-28' && E.sumarDias('2027-01-01', -1) === '2026-12-31')

  const todas = [
    P('2026-10-05', 'win', { creada: '2026-10-05T10:00' }),
    P('2026-10-05', 'loss', { creada: '2026-10-05T12:00', rival: 'd:gardevoir', rivalNombre: 'Gardevoir', donde: 'Liga de tienda' }),
    P('2026-09-30', 'draw', { deTorneo: true }),
    P('2026-09-01', 'win', { torneoId: 'tl-1', mazoGuardado: 'mazo-1' }),
    P(null, 'loss'),
  ]
  const f = (filtros) => E.filtrarPartidas(todas, filtros, HOY).length
  check('filtrar por resultado', f({ resultado: 'win' }) === 2 && f({ resultado: 'loss' }) === 2 && f({ resultado: 'draw' }) === 1)
  check('filtrar por periodo, y una SIN fecha no entra en ninguno', f({ periodo: '7' }) === 3 && f({ periodo: 'hoy' }) === 2 && f({ periodo: 'siempre' }) === 5, `${f({ periodo: '7' })} ${f({ periodo: 'hoy' })}`)
  check('filtrar por rival, dónde y mazo guardado', f({ rival: 'd:gardevoir' }) === 1 && f({ donde: 'Liga de tienda' }) === 1 && f({ guardado: 'mazo-1' }) === 1)
  check('filtrar por origen: de PokeDoc, torneo apuntado, suelta', f({ origen: 'pokedoc' }) === 1 && f({ origen: 'torneo' }) === 1 && f({ origen: 'suelta' }) === 3)

  const rec = E.ordenarPartidas(todas, 'recientes').map((p) => `${p.fecha}/${p.resultado}`)
  const ant = E.ordenarPartidas(todas, 'antiguas').map((p) => `${p.fecha}/${p.resultado}`)
  check('las más recientes primero; a igual fecha, la apuntada después va antes', rec.slice(0, 2).join(' ') === '2026-10-05/loss 2026-10-05/win', rec.join(' '))
  check('las más antiguas primero', ant[0] === '2026-09-01/win' && ant[3] === '2026-10-05/loss', ant.join(' '))
  check('  …y la que no tiene fecha, al final en los dos órdenes', rec.at(-1) === 'null/loss' && ant.at(-1) === 'null/loss')

  const c = E.cuenta([P('2026-01-01', 'win'), P('2026-01-01', 'draw')])
  check('el porcentaje, el de la matriz: un empate cuenta medio', c.pct === 0.75 && c.total === 2)
  check('  …y sin partidas no hay porcentaje (no «0 %»)', E.cuenta([]).pct === null)

  const seguidas = ['win', 'win', 'win', 'loss', 'draw', 'loss', 'loss'].map((r, i) => P(E.sumarDias('2026-09-01', i), r))
  const r = E.rachas(seguidas)
  check('la racha de ahora: 2 derrotas', r.actual?.resultado === 'loss' && r.actual.n === 2, JSON.stringify(r))
  check('  …la mejor de victorias, 3; la peor de derrotas, 2 (el empate corta)', r.mejorVictorias === 3 && r.peorDerrotas === 2, JSON.stringify(r))
  check('las últimas N, de la más reciente a la más vieja', E.ultimas(seguidas, 3).map((p) => p.resultado).join(',') === 'loss,loss,draw')

  const serie = E.porPeriodo([P('2026-09-01', 'win'), P('2026-09-20', 'loss')])
  check('por semanas cuando son más de 31 días… o no: 20 días van por días', serie.unidad === 'dia' && serie.cubos.length === 20, `${serie.unidad} ${serie.cubos.length}`)
  check('  …con los días vacíos dentro (el eje no se come los huecos)', serie.cubos.filter((x) => x.total === 0).length === 18)
  const semanas = E.porPeriodo([P('2026-08-05', 'win'), P('2026-10-05', 'loss')])
  check('dos meses van por semanas, que empiezan en LUNES', semanas.unidad === 'semana' && semanas.cubos[0].clave === '2026-08-03' && semanas.cubos.at(-1).clave === '2026-10-05', `${semanas.unidad} ${semanas.cubos[0]?.clave} ${semanas.cubos.at(-1)?.clave}`)
  const meses = E.porPeriodo([P('2025-11-30', 'win'), P('2026-10-05', 'loss')])
  check('un año va por meses, cruzando de año', meses.unidad === 'mes' && meses.cubos.length === 12 && meses.cubos[1].clave === '2025-12-01' && meses.cubos[2].clave === '2026-01-01', meses.cubos.map((x) => x.clave).join(' '))
  const dias = E.porDiaDeLaSemana([P('2026-10-05', 'win'), P('2026-10-11', 'loss')])
  check('por día de la semana: el 5 de octubre de 2026 es lunes y el 11 domingo', dias[0].total === 1 && dias[6].total === 1 && dias[0].etiqueta === 'Lun')
  const grupos = E.porGrupo([P('x', 'win', { rival: 'a', rivalNombre: 'A' }), P('x', 'win', { rival: 'b', rivalNombre: 'B' }), P('x', 'loss', { rival: 'b', rivalNombre: 'B' })], (p) => p.rival, (p) => p.rivalNombre)
  check('agrupar: el más jugado primero, con su cuenta', grupos[0].clave === 'b' && grupos[0].total === 2 && grupos[0].pct === 0.5)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Los gráficos ──')
{
  check('el techo del eje es redondo y no se pasa de largo', G.topeRedondo(7) === 8 && G.topeRedondo(21) === 30 && G.topeRedondo(1) === 1 && G.topeRedondo(0) === 1)
  check('las etiquetas del eje: todas si caben, si no tres', G.etiquetasVisibles(5, 400).length === 5 && G.etiquetasVisibles(40, 400).join(',') === '0,19,39')
  const uno = G.graficoEvolucion([{ etiqueta: 'a', total: 3, ganadas: 1, perdidas: 2, empatadas: 0, pct: 1 / 3 }], { ancho: 500 })
  check('la evolución con un solo periodo jugado no se inventa una línea: lo dice', !uno.svg && /al menos dos/.test(uno.vacio))
  const cubos = [
    { etiqueta: '1', total: 2, ganadas: 2, perdidas: 0, empatadas: 0, pct: 1 },
    { etiqueta: '2', total: 2, ganadas: 0, perdidas: 2, empatadas: 0, pct: 0 },
    { etiqueta: '3', total: 0, ganadas: 0, perdidas: 0, empatadas: 0, pct: null },
    { etiqueta: '4', total: 4, ganadas: 2, perdidas: 1, empatadas: 1, pct: 0.625 },
    { etiqueta: '5', total: 2, ganadas: 1, perdidas: 1, empatadas: 0, pct: 0.5 },
  ]
  const ev = G.graficoEvolucion(cubos, { ancho: 500, alto: 180 })
  check('un punto por periodo con partidas (4), con su cartel', (ev.svg.match(/class="graf-punto"/g) || []).length === 4 && (ev.svg.match(/data-tip=/g) || []).length === 4)
  check('  …y la línea del acumulado se CORTA donde no se jugó (dos tramos)', (ev.svg.match(/<polyline/g) || []).length === 2, (ev.svg.match(/<polyline/g) || []).length)
  check('  …el cartel dice el acumulado: tras 2-0 y 0-2, 50%', /2: 2 partidas \(0-2\) · 0% · acumulado 50%/.test(ev.svg), (ev.svg.match(/data-tip="([^"]*)"/g) || []).join(' | '))
  check('  …y el empate cuenta medio también en el acumulado: tras 4-2-1 de 8, 56%', /4: 4 partidas \(2-1-1\) · 63% · acumulado 56%/.test(ev.svg), (ev.svg.match(/data-tip="4:[^"]*"/g) || []).join(' | '))
  check('  …mide lo que se le pide (no un viewBox que encoge la letra)', /<svg class="graf" width="500" height="180"/.test(ev.svg) && !/viewBox/.test(ev.svg))
  const br = G.graficoBarras(cubos, { ancho: 500, alto: 160 })
  const rects = [...br.svg.matchAll(/<rect class="graf-(v|e|d)" x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/g)].map((m) => ({ k: m[1], x: +m[2], y: +m[3], h: +m[4] }))
  const col4 = rects.filter((r) => r.x === rects.find((q) => q.k === 'e')?.x)
  check('las columnas se apilan: victorias abajo, empates, derrotas arriba', col4.map((r) => r.k).join('') === 'ved' && col4[0].y > col4[1].y && col4[1].y > col4[2].y, JSON.stringify(col4))
  check('  …con un hueco entre trozos (lo que separa el verde del rojo sin color)', col4[1].y + col4[1].h < col4[0].y && col4[2].y + col4[2].h < col4[1].y, JSON.stringify(col4))
  check('  …y el periodo sin partidas también tiene su cartel', /data-tip="3: sin partidas"/.test(br.svg))
  check('sin ninguna partida, lo dice', /No hay partidas/.test(G.graficoBarras(cubos.map((c) => ({ ...c, total: 0, ganadas: 0, perdidas: 0, empatadas: 0 })), { ancho: 500 }).vacio))
}

// ═════════════════════════════════════════════════════════════════════
const browser = await chromium.launch()
const hoy = new Date()
const fechaHace = (n) => {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// 12 partidas a mano: 7 ganadas, 4 perdidas, 1 empate, repartidas en 60
// días. La última, una derrota hoy (racha actual: 1 derrota).
const RES = ['win', 'win', 'loss', 'win', 'win', 'win', 'loss', 'draw', 'win', 'loss', 'win', 'loss']
const PARTIDAS = RES.map((resultado, i) => ({
  id: `p${i}`,
  user_id: 'user-1',
  mi_mazo: i % 3 ? 'd:dragapult ex' : 'd:gardevoir ex',
  mi_mazo_nombre: i % 3 ? 'Dragapult ex' : 'Gardevoir ex',
  rival_mazo: i % 2 ? 'd:lugia vstar' : 'd:charizard ex',
  rival_mazo_nombre: i % 2 ? 'Lugia VSTAR' : 'Charizard ex',
  resultado,
  jugada_el: fechaHace((RES.length - 1 - i) * 5),
  donde: i < 9 ? 'TCG Live' : 'Liga de tienda',
  created_at: `2026-01-01T00:00:${String(i).padStart(2, '0')}Z`,
}))

async function abrir({ ancho = 1100, antes = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/cdn\.jsdelivr|limitlesstcg|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(({ partidas, antes }) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_PARTIDAS__ = partidas
    Object.assign(window, antes)
  }, { partidas: PARTIDAS, antes })
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, errores }
}
const texto = (page, sel) => page.innerText(sel).then((t) => t.replace(/\s+/g, ' ').trim())

console.log('\n── 3. La pestaña de estadísticas ──')
{
  const { page, errores } = await abrir()
  check('con la pestaña escondida no se pintan gráficos (su caja mide 0)', (await page.locator('#partidasGraficos svg').count()) === 0)
  await page.click('#partidasTabs [data-vista="stats"]')
  await page.waitForTimeout(300)
  check('al abrirla, sí: evolución, por periodo y por día de la semana', (await page.locator('#partidasGraficos svg.graf').count()) === 3, String(await page.locator('#partidasGraficos svg.graf').count()))
  const ancho = await page.evaluate(() => [document.getElementById('partidasGraficos').clientWidth, +document.querySelector('#partidasGraficos svg').getAttribute('width')])
  check('  …medidos con el ancho de su caja', ancho[1] > 0 && ancho[1] <= ancho[0] && ancho[1] > ancho[0] - 60, ancho.join(' / '))
  const resumen = await texto(page, '#partidasResumen')
  check('el resumen de siempre: 12 partidas, 7-4-1, 63% (el empate cuenta medio)', /12/.test(resumen) && /7-4-1/.test(resumen) && /63%/.test(resumen), resumen)
  const extra = await texto(page, '#partidasExtra')
  check('las cifras nuevas: la racha de ahora y la mejor', /Racha actual 1 derrota/i.test(extra) && /Mejor: 3 victorias/.test(extra), extra)
  const forma = (await page.$$eval('#partidasExtra .partidas-forma .partidas-ronda-res', (xs) => xs.map((x) => x.textContent))).join('')
  check('  …las últimas 10, con la más reciente a la derecha', forma === 'DVVVDEVDVD', forma)
  check('  …y el mazo más jugado (Dragapult, 8)', /Tu mazo más jugado Dragapult ex 8 partidas/i.test(extra), extra)
  const graf = await texto(page, '#partidasGraficos')
  check('por mazo, por rival y dónde juegas', /Con cada mazo tuyo/.test(graf) && /Contra qué mazos/.test(graf) && /Dónde juegas/.test(graf) && /Liga de tienda/.test(graf), graf.slice(0, 300))

  // El cartel: al pasar por una columna dice lo que hay.
  const zona = page.locator('#partidasGraficos svg').nth(1).locator('.graf-zona').first()
  // Dos veces: la primera puede traer un desplazamiento hasta la columna,
  // y desplazarse esconde el cartel (a propósito).
  await zona.hover()
  await page.waitForTimeout(150)
  await zona.hover({ position: { x: 3, y: 10 } })
  await page.waitForTimeout(100)
  const cartel = await page.evaluate(() => { const c = document.querySelector('.partidas-cartel'); return c && !c.classList.contains('hidden') ? c.textContent : '' })
  check('al pasar por encima sale el cartel con el número', /partida|sin partidas/.test(cartel), cartel)

  // Los filtros mandan en todo.
  await page.selectOption('#filtroResultado', 'win')
  await page.waitForTimeout(200)
  check('«Victorias»: el resumen cuenta 7, y lo dice', /7/.test(await texto(page, '#partidasResumen')) && /7 de 12 partidas/.test(await texto(page, '#filtroCuenta')), await texto(page, '#filtroCuenta'))
  check('  …y aparece «Quitar filtros»', await page.isVisible('#filtroLimpiar'))
  await page.selectOption('#filtroResultado', '')
  await page.selectOption('#filtroPeriodo', '7')
  await page.waitForTimeout(200)
  check('«Últimos 7 días»: las dos de los últimos 5 días', /2 de 12 partidas/.test(await texto(page, '#filtroCuenta')), await texto(page, '#filtroCuenta'))
  await page.selectOption('#filtroPeriodo', 'rango')
  check('«Entre dos fechas» abre sus dos campos', (await page.isVisible('#filtroFechaDesde')) && (await page.isVisible('#filtroFechaHasta')))
  await page.fill('#filtroFechaDesde', fechaHace(20))
  await page.dispatchEvent('#filtroFechaDesde', 'change')
  await page.waitForTimeout(200)
  check('  …y desde hace 20 días son 5', /5 de 12 partidas/.test(await texto(page, '#filtroCuenta')), await texto(page, '#filtroCuenta'))
  await page.selectOption('#filtroRival', { label: 'Lugia VSTAR' })
  await page.waitForTimeout(200)
  const matriz = await texto(page, '#partidasMatriz')
  check('el rival filtra también los enfrentamientos', /Lugia VSTAR/.test(matriz) && !/Charizard ex/.test(matriz), matriz.slice(0, 200))
  await page.click('#filtroLimpiar')
  await page.waitForTimeout(200)
  check('«Quitar filtros» lo deja todo como al entrar', (await page.inputValue('#filtroPeriodo')) === 'siempre' && (await page.inputValue('#filtroRival')) === '' && !(await page.isVisible('#filtroFechaDesde')) && (await texto(page, '#filtroCuenta')) === '')

  // Al estrechar la ventana, se vuelven a medir.
  await page.setViewportSize({ width: 420, height: 1200 })
  await page.waitForTimeout(500)
  const estrecho = await page.evaluate(() => [document.getElementById('partidasGraficos').clientWidth, +document.querySelector('#partidasGraficos svg').getAttribute('width')])
  check('al estrechar, los gráficos se vuelven a medir', estrecho[1] <= estrecho[0] && estrecho[1] < ancho[1], estrecho.join(' / '))
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  check('  …y la página no se sale por el lado', !desborda)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. La lista de sueltas y los torneos ──')
{
  const { page, errores } = await abrir()
  await page.click('#partidasTabs [data-vista="sueltas"]')
  const fechas = async () => page.$$eval('#partidasLista .partidas-fila-donde', (xs) => xs.map((x) => x.textContent.match(/\d{4}-\d{2}-\d{2}/)?.[0]))
  const recientes = await fechas()
  check('por defecto, las más recientes primero', recientes[0] === fechaHace(0) && recientes.at(-1) === fechaHace(55), recientes.join(' '))
  await page.selectOption('#listaOrden', 'antiguas')
  await page.waitForTimeout(150)
  const antiguas = await fechas()
  check('«Más antiguas primero» les da la vuelta', antiguas[0] === fechaHace(55) && antiguas.at(-1) === fechaHace(0), antiguas.join(' '))
  await page.selectOption('#listaResultado', 'loss')
  await page.waitForTimeout(150)
  check('«Derrotas»: solo las 4', (await page.locator('#partidasLista .partidas-fila').count()) === 4 && (await page.locator('#partidasLista .partidas-fila.partidas-loss').count()) === 4)
  await page.selectOption('#listaPeriodo', 'hoy')
  await page.selectOption('#listaResultado', 'win')
  await page.waitForTimeout(150)
  check('y si el filtro no deja pasar ninguna, lo dice así (no «aún no hay partidas»)', /Ninguna partida suelta casa con estos filtros/.test(await texto(page, '#partidasLista')), await texto(page, '#partidasLista'))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  const { page } = await abrir({ antes: { __FAKE_LOG_TORNEOS__: [
    { id: 'tl-viejo', user_id: 'user-1', nombre: 'Liga de agosto', mi_mazo: 'd:x', mi_mazo_nombre: 'X', jugado_el: '2026-08-01' },
    { id: 'tl-nuevo', user_id: 'user-1', nombre: 'Liga de octubre', mi_mazo: 'd:x', mi_mazo_nombre: 'X', jugado_el: '2026-10-01' },
  ] } })
  const nombres = () => page.$$eval('#partidasTorneos .partidas-torneo-titulo strong', (xs) => xs.map((x) => x.textContent))
  check('los torneos, el más reciente arriba', (await nombres()).join(',') === 'Liga de octubre,Liga de agosto', (await nombres()).join(','))
  await page.selectOption('#torneoOrden', 'antiguas')
  await page.waitForTimeout(150)
  check('  …y al revés si se pide', (await nombres()).join(',') === 'Liga de agosto,Liga de octubre', (await nombres()).join(','))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
