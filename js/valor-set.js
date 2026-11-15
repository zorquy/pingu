// LA GRÁFICA DEL VALOR DE UNA EXPANSIÓN (tanda 1365, la E y la F de «Lo nuevo
// de la API de TCGGO»). En la página de la expansión (/coleccion/<set>), bajo
// sus cifras: lo que suman sus cartas y, aparte, lo que suman sus productos
// sellados, día a día, con rangos de 1 mes a 1 año.
//
// Las dos líneas van CADA UNA A SU ESCALA: el sellado vale varias veces lo que
// las cartas y en una sola escala aplastaría la otra línea; por eso no hay eje
// con cifras, y lo que vale cada día se lee al pasar el dedo o el ratón.
// Texto y marcas van en HTML encima del SVG, nunca dentro (la 653: con
// `preserveAspectRatio="none"` un texto se deforma).
//
// Entra por `import()` desde js/coleccion.js solo si hay datos que pintar.
import { escapeHtml } from './html.js'

export const RANGOS = [
  { id: '1m', texto: '1M', dias: 30 },
  { id: '3m', texto: '3M', dias: 91 },
  { id: '6m', texto: '6M', dias: 182 },
  { id: '1a', texto: '1A', dias: 365 },
]
const RANGO_DE_SERIE = '3m'
const ANCHO = 600
const ALTO = 200
const MARGEN = 10

const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)
const ms = (dia) => Date.parse(`${String(dia).slice(0, 10)}T00:00:00Z`)
const fmtEuros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' })
const fecha = (dia) => new Date(ms(dia)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Las filas del rango, en orden, solo las que tienen alguna de las dos cifras.
export function filasDelRango(filas, rango = RANGO_DE_SERIE, hoy = new Date()) {
  const r = RANGOS.find((x) => x.id === rango) || RANGOS[1]
  const corte = hoy.getTime() - r.dias * 86_400_000
  return [...(filas || [])]
    .filter((f) => /^\d{4}-\d{2}-\d{2}/.test(String(f?.dia || '')) && ms(f.dia) >= corte && (num(f.valor_cm) || num(f.valor_sellado)))
    .sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
}

// Los rangos que se pueden ofrecer: los que tienen al menos dos días de
// cartas o de sellado (un chip que enseña lo mismo que el anterior sobra).
export function rangosConDatos(filas, hoy = new Date()) {
  let antes = -1
  return RANGOS.filter((r) => {
    const n = filasDelRango(filas, r.id, hoy).length
    const vale = n >= 2 && n > antes
    if (vale) antes = n
    return vale
  })
}

function linea(filas, campo, x0, x1) {
  const pts = filas.filter((f) => num(f[campo]))
  if (pts.length < 2) return null
  const vals = pts.map((f) => num(f[campo]))
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const x = (dia) => (x1 === x0 ? 0 : ((ms(dia) - x0) / (x1 - x0)) * ANCHO)
  const y = (v) => MARGEN + (1 - (v - min) / span) * (ALTO - 2 * MARGEN)
  return pts.map((f) => `${x(f.dia).toFixed(1)},${y(num(f[campo])).toFixed(1)}`).join(' ')
}

// El HTML de la gráfica (sin manejadores). Vacío si no hay dos días de nada.
export function graficaValorSetHtml(filas, { rango = RANGO_DE_SERIE, hoy = new Date() } = {}) {
  const rangos = rangosConDatos(filas, hoy)
  if (!rangos.length) return ''
  const puesto = rangos.some((r) => r.id === rango) ? rango : rangos[rangos.length - 1].id
  const t = filasDelRango(filas, puesto, hoy)
  const x0 = ms(t[0].dia)
  const x1 = ms(t[t.length - 1].dia)
  const cartas = linea(t, 'valor_cm', x0, x1)
  const sellado = linea(t, 'valor_sellado', x0, x1)
  const area = cartas ? `0,${ALTO} ${cartas} ${ANCHO},${ALTO}` : ''
  const chips = rangos.map((r) => `<button type="button" class="vs-rango" data-rango="${r.id}" aria-pressed="${r.id === puesto}">${r.texto}</button>`).join('')
  const leyenda = `${cartas ? '<span class="vs-ley"><i class="vs-ley-cartas"></i>Sus cartas</span>' : ''}${sellado ? '<span class="vs-ley"><i class="vs-ley-sellado"></i>Su sellado</span>' : ''}`
  return `<div class="vs-mandos"><div class="vs-rangos" role="group" aria-label="Qué tiempo ver">${chips}</div><div class="vs-leyenda">${leyenda}</div></div>`
    + `<div class="vs-lienzo" role="img" aria-label="${escapeHtml(`Valor de la expansión del ${fecha(t[0].dia)} al ${fecha(t[t.length - 1].dia)}`)}">`
    + `<svg viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none" aria-hidden="true">${area ? `<polygon class="vs-area" points="${area}"/>` : ''}${cartas ? `<polyline class="vs-cartas" points="${cartas}" vector-effect="non-scaling-stroke"/>` : ''}${sellado ? `<polyline class="vs-sellado" points="${sellado}" vector-effect="non-scaling-stroke"/>` : ''}</svg>`
    + '<span class="vs-guia" hidden></span><span class="vs-marca" hidden></span></div>'
    + `<p class="vs-pie">${cartas && sellado ? 'Cada línea va a su escala. ' : ''}Toca la gráfica para ver lo que valía cada día.</p>`
}

// La fila más cercana a una posición (0..1 a lo ancho del lienzo). Pura.
export function filaEn(filas, fraccion) {
  if (!filas?.length) return null
  const x0 = ms(filas[0].dia)
  const x1 = ms(filas[filas.length - 1].dia)
  const objetivo = x0 + Math.min(1, Math.max(0, fraccion)) * (x1 - x0)
  return filas.reduce((mejor, f) => (Math.abs(ms(f.dia) - objetivo) < Math.abs(ms(mejor.dia) - objetivo) ? f : mejor), filas[0])
}

// Monta la gráfica en `caja` con sus mandos: rangos y la lectura de un día.
export function montarValorSet(caja, filas, { hoy = new Date() } = {}) {
  if (!caja) return
  let rango = RANGO_DE_SERIE
  const pintar = () => {
    caja.innerHTML = graficaValorSetHtml(filas, { rango, hoy })
    caja.hidden = !caja.innerHTML
  }
  pintar()
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rango]')
    if (!b) return
    rango = b.dataset.rango
    pintar()
  })
  const leer = (e) => {
    const lienzo = e.target.closest?.('.vs-lienzo')
    if (!lienzo) return
    const caja2 = lienzo.getBoundingClientRect()
    const fr = (e.clientX - caja2.left) / caja2.width
    const puesto = caja.querySelector('[data-rango][aria-pressed="true"]')?.dataset.rango || rango
    const t = filasDelRango(filas, puesto, hoy)
    const f = filaEn(t, fr)
    if (!f) return
    const x0 = ms(t[0].dia)
    const x1 = ms(t[t.length - 1].dia)
    const izq = x1 === x0 ? 0 : ((ms(f.dia) - x0) / (x1 - x0)) * 100
    const guia = lienzo.querySelector('.vs-guia')
    const marca = lienzo.querySelector('.vs-marca')
    guia.hidden = false
    guia.style.left = `${izq}%`
    marca.hidden = false
    marca.style.left = `${Math.min(80, Math.max(20, izq))}%`
    marca.innerHTML = `<b>${escapeHtml(fecha(f.dia))}</b>${num(f.valor_cm) ? `<span>Cartas <b>${escapeHtml(fmtEuros.format(num(f.valor_cm)))}</b></span>` : ''}${num(f.valor_sellado) ? `<span>Sellado <b>${escapeHtml(fmtEuros.format(num(f.valor_sellado)))}</b></span>` : ''}`
  }
  caja.addEventListener('pointermove', leer)
  caja.addEventListener('pointerdown', leer)
  // Con el dedo la lectura se queda puesta; con el ratón se va al salir.
  caja.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return
    caja.querySelector('.vs-guia')?.setAttribute('hidden', '')
    caja.querySelector('.vs-marca')?.setAttribute('hidden', '')
  })
}
