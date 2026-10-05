// Los gráficos de /mis-partidas (tanda 628), dibujados a mano en SVG: aquí
// no hay librerías (CLAUDE.md), y para dos tipos de gráfico no hacen falta.
// Devuelven TEXTO (el SVG) y se miden en píxeles de verdad —el ancho de su
// caja—, no en un `viewBox` que se estira: estirado, la letra de los ejes
// se encoge con la pantalla y en un móvil no se lee.
//
// Los colores son los del estado (--success, --danger) y no una paleta
// de categorías: ganar y perder SON estados. El rojo y el verde se separan
// poco para quien no distingue esos dos colores, así que nunca van solos:
// orden fijo (las victorias abajo), un hueco de 2 px entre trozos, leyenda
// con su nombre y el número en el cartel al pasar por encima.
//
// Cada marca lleva `data-tip` con su cartel; quien pinta el gráfico pone
// un solo escuchador para todos (mis-partidas.js).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const r1 = (n) => Math.round(n * 10) / 10
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`)
const record = (c) => `${c.ganadas}-${c.perdidas}${c.empatadas ? `-${c.empatadas}` : ''}`

// Las etiquetas del eje que caben sin pisarse: con pocas, todas; con
// muchas, la primera, la del medio y la última.
export function etiquetasVisibles(n, ancho) {
  if (n <= 0) return []
  if (n * 44 <= ancho) return [...Array(n).keys()]
  return [...new Set([0, Math.floor((n - 1) / 2), n - 1])]
}

// Un tope «redondo» para el eje de las cuentas (1, 2, 3, 4, 5, 6, 8, 10,
// 20, 30…): con solo 1-2-5, 21 partidas ponían el techo en 50 y las
// columnas se quedaban en la mitad de abajo.
export function topeRedondo(max) {
  if (max <= 0) return 1
  const base = 10 ** Math.floor(Math.log10(max))
  for (const k of [1, 2, 3, 4, 5, 6, 8, 10]) if (k * base >= max) return k * base
  return 10 * base
}

const M = { izq: 40, der: 12, arriba: 12, abajo: 24 }

// ── El porcentaje de victorias en el tiempo ──
//
// Dos cosas en el MISMO eje (los dos son porcentajes): un punto por cada
// día/semana/mes con partidas, y la línea del ACUMULADO, que es la que
// dice hacia dónde vas sin el ruido de una semana de dos partidas. La
// línea se corta donde no se jugó: unirla sería dibujar datos que no hay.
export function graficoEvolucion(cubos, { ancho = 600, alto = 180, unidad = 'semana' } = {}) {
  const conPartidas = cubos.filter((c) => c.total > 0)
  const nombreUnidad = { dia: 'días', semana: 'semanas', mes: 'meses' }[unidad] || 'semanas'
  if (conPartidas.length < 2) return { svg: '', vacio: `Hace falta jugar en al menos dos ${nombreUnidad} distintos para ver cómo evoluciona.` }
  const w = Math.max(240, ancho)
  const ix = w - M.izq - M.der
  const iy = alto - M.arriba - M.abajo
  const paso = cubos.length > 1 ? ix / (cubos.length - 1) : 0
  const x = (i) => r1(M.izq + i * paso)
  const y = (p) => r1(M.arriba + (1 - p) * iy)

  const rejilla = [0, 0.5, 1]
    .map((p) => `<line class="graf-rejilla${p === 0.5 ? ' graf-rejilla-media' : ''}" x1="${M.izq}" x2="${w - M.der}" y1="${y(p)}" y2="${y(p)}" />
      <text class="graf-eje" x="${M.izq - 6}" y="${y(p) + 4}" text-anchor="end">${p * 100}%</text>`)
    .join('')

  // El acumulado, por tramos seguidos de cubos con partidas.
  let g = 0
  let e = 0
  let t = 0
  const tramos = []
  let tramo = []
  const puntos = []
  cubos.forEach((c, i) => {
    if (!c.total) {
      if (tramo.length) tramos.push(tramo)
      tramo = []
      return
    }
    g += c.ganadas
    e += c.empatadas
    t += c.total
    // Como el porcentaje de la matriz: un empate cuenta medio.
    const acumulado = (g + e / 2) / t
    tramo.push(`${x(i)},${y(acumulado)}`)
    puntos.push({ i, c, acumulado })
  })
  if (tramo.length) tramos.push(tramo)
  const lineas = tramos.map((tr) => (tr.length > 1 ? `<polyline class="graf-linea" points="${tr.join(' ')}" />` : '')).join('')

  const marcas = puntos
    .map(({ i, c, acumulado }) => {
      const tip = `${c.etiqueta}: ${c.total} ${c.total === 1 ? 'partida' : 'partidas'} (${record(c)}) · ${pct(c.pct)} · acumulado ${pct(acumulado)}`
      return `<circle class="graf-punto" cx="${x(i)}" cy="${y(c.pct)}" r="4" />
        <circle class="graf-zona" cx="${x(i)}" cy="${y(c.pct)}" r="14" data-tip="${esc(tip)}" role="img" aria-label="${esc(tip)}" />`
    })
    .join('')

  const ejeX = etiquetasVisibles(cubos.length, ix)
    .map((i) => `<text class="graf-eje" x="${x(i)}" y="${alto - 6}" text-anchor="${i === 0 ? 'start' : i === cubos.length - 1 ? 'end' : 'middle'}">${esc(cubos[i].etiqueta)}</text>`)
    .join('')

  const total = puntos.at(-1)
  const resumen = `Porcentaje de victorias por ${{ dia: 'día', semana: 'semana', mes: 'mes' }[unidad] || 'semana'}, de ${cubos[0].etiqueta} a ${cubos.at(-1).etiqueta}. Acumulado al final: ${pct(total?.acumulado)}.`
  return {
    svg: `<svg class="graf" width="${w}" height="${alto}" role="group" aria-label="${esc(resumen)}">${rejilla}${lineas}${marcas}${ejeX}</svg>`,
    vacio: null,
  }
}

// ── Las partidas de cada día/semana/mes, con su resultado ──
//
// Columnas apiladas: victorias abajo, empates, derrotas arriba. La altura
// es cuántas se jugaron; los colores, cómo fueron.
export function graficoBarras(cubos, { ancho = 600, alto = 160, todasLasEtiquetas = false } = {}) {
  if (!cubos.some((c) => c.total > 0)) return { svg: '', vacio: 'No hay partidas en este periodo.' }
  const w = Math.max(240, ancho)
  const ix = w - M.izq - M.der
  const iy = alto - M.arriba - M.abajo
  const tope = topeRedondo(Math.max(...cubos.map((c) => c.total)))
  const hueco = ix / cubos.length
  const anchoBarra = r1(Math.max(2, Math.min(28, hueco * 0.7)))
  const base = M.arriba + iy
  const alturaDe = (n) => (n / tope) * iy

  const rejilla = [0, tope]
    .map((v) => {
      const yy = r1(base - alturaDe(v))
      return `<line class="graf-rejilla" x1="${M.izq}" x2="${w - M.der}" y1="${yy}" y2="${yy}" />
        <text class="graf-eje" x="${M.izq - 6}" y="${yy + 4}" text-anchor="end">${v}</text>`
    })
    .join('')

  const columnas = cubos
    .map((c, i) => {
      const cx = M.izq + i * hueco + (hueco - anchoBarra) / 2
      let y0 = base
      const trozos = []
      for (const [n, clase] of [[c.ganadas, 'graf-v'], [c.empatadas, 'graf-e'], [c.perdidas, 'graf-d']]) {
        if (!n) continue
        const h = alturaDe(n)
        // El hueco de 2 px entre trozos (lo que separa el verde del rojo
        // para quien no los distingue), sin comerse un trozo de 1 partida.
        const alto1 = Math.max(1, h - (trozos.length ? 2 : 0))
        trozos.push(`<rect class="${clase}" x="${r1(cx)}" y="${r1(y0 - h)}" width="${anchoBarra}" height="${r1(alto1)}" rx="2" />`)
        y0 -= h
      }
      const tip = `${c.etiqueta}: ${c.total ? `${c.total} ${c.total === 1 ? 'partida' : 'partidas'} · ${c.ganadas} V · ${c.perdidas} D${c.empatadas ? ` · ${c.empatadas} E` : ''}` : 'sin partidas'}`
      const zona = `<rect class="graf-zona" x="${r1(M.izq + i * hueco)}" y="${M.arriba}" width="${r1(hueco)}" height="${iy}" data-tip="${esc(tip)}" role="img" aria-label="${esc(tip)}" />`
      return trozos.join('') + zona
    })
    .join('')

  const visibles = todasLasEtiquetas ? cubos.map((_, i) => i) : etiquetasVisibles(cubos.length, ix)
  const ejeX = visibles
    .map((i) => `<text class="graf-eje" x="${r1(M.izq + i * hueco + hueco / 2)}" y="${alto - 6}" text-anchor="middle">${esc(cubos[i].etiqueta)}</text>`)
    .join('')

  const t = cubos.reduce((s, c) => s + c.total, 0)
  const resumen = `${t} ${t === 1 ? 'partida' : 'partidas'} repartidas en ${cubos.length} columnas, de ${cubos[0].etiqueta} a ${cubos.at(-1).etiqueta}.`
  return { svg: `<svg class="graf" width="${w}" height="${alto}" role="group" aria-label="${esc(resumen)}">${rejilla}${columnas}${ejeX}</svg>`, vacio: null }
}
