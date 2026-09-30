// La gráfica del valor de la colección (tanda 377).
//
// SVG a mano y sin librería: son dos `path` y seis etiquetas, y meter
// una dependencia de gráficas en el cliente rompería la norma de la casa
// (vanilla, sin build, sin npm) por una línea quebrada.
//
// No toca el DOM: devuelve HTML. Así se puede probar en Node.
import { escapeHtml } from '../html.js'
import { euros } from '../cardmarket.js'

// El porcentaje, en español: `toFixed` escribe «50.0» con PUNTO, y en
// una web donde el euro sale «50,00 €» eso canta. Un formateador y no
// un `replace('.', ',')`, que se lleva por delante el separador de
// miles el día que alguien tenga una colección que suba un 1.200 %.
const pct1 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// El alto es fijo y el ancho se estira: dentro va un `viewBox`, así que
// el dibujo se escala solo con la caja que lo contenga.
const ANCHO = 600
const ALTO = 160
const MARGEN = { arriba: 12, abajo: 22, izq: 8, der: 8 }

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

// Qué se enseña de una serie de días. Suelto de lo que la dibuja porque
// es lo único que puede estar mal de verdad.
export function resumenDeValor(filas, { ahora = null } = {}) {
  const dias = (filas || [])
    .map((f) => ({ dia: String(f.dia), valor: num(f.valor), copias: num(f.copias), sinPrecio: num(f.sin_precio) }))
    .filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f.dia))
    .sort((a, b) => a.dia.localeCompare(b.dia))
  // El valor de AHORA pisa al del último punto si es de hoy, y se añade
  // como punto nuevo si no. Es lo que pasa cuando añades una carta a
  // mediodía: la foto de esta madrugada ya no dice la verdad, y la
  // pantalla no puede enseñar dos totales distintos de lo mismo.
  if (typeof ahora === 'number' && Number.isFinite(ahora) && dias.length) {
    const hoy = new Date().toISOString().slice(0, 10)
    const ultimo = dias[dias.length - 1]
    if (ultimo.dia.slice(0, 10) === hoy) ultimo.valor = ahora
    else dias.push({ dia: hoy, valor: ahora, copias: ultimo.copias, sinPrecio: ultimo.sinPrecio })
  }
  if (dias.length < 2) return { dias, bastante: false }
  const primero = dias[0]
  const ultimo = dias[dias.length - 1]
  const cambio = ultimo.valor - primero.valor
  // El porcentaje NO se calcula desde cero: una colección que empieza en
  // 0 € y llega a 40 no ha subido «infinito por ciento», ha subido 40 €.
  const pct = primero.valor > 0 ? (cambio / primero.valor) * 100 : null
  return {
    dias,
    bastante: true,
    primero,
    ultimo,
    cambio,
    pct,
    // Cuántas cartas seguían sin precio el último día. Sin esto, un
    // salto en la gráfica no se distingue de «ese día se curaron 200
    // precios», que es lo que va a pasar las primeras semanas.
    sinPrecio: ultimo.sinPrecio,
  }
}

// La fecha, corta y en cristiano: «14 sept».
function fechaCorta(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

// `ahora` es lo que vale la colección EN ESTE MOMENTO: la misma suma
// que enseña la cifra de arriba de la página.
//
// Y no es un adorno. La foto diaria se toma a las 4:07, así que si la
// gráfica se encabezara con el último punto guardado, la pantalla
// enseñaría DOS números distintos de lo mismo —768 € arriba y 534 en la
// gráfica— y nadie sabría cuál creerse. Con `ahora`, el número grande es
// el de arriba y el histórico solo aporta la DIFERENCIA, que es para lo
// que está.
export function graficaHtml(filas, { ahora = null } = {}) {
  const r = resumenDeValor(filas, { ahora })
  // Con un solo día no hay línea que dibujar, y una línea plana de un
  // punto diría «no ha cambiado nada» cuando lo que pasa es que todavía
  // no sabemos nada. Son dos cosas distintas (la lección de la 319).
  if (!r.bastante) {
    return `<p class="subtext">La primera foto del valor de tu colección se toma esta noche. En cuanto haya dos, aquí verás si sube o baja.</p>`
  }
  const valores = r.dias.map((d) => d.valor)
  const max = Math.max(...valores)
  const min = Math.min(...valores)
  // Un margen arriba y abajo para que la línea no bese los bordes; y si
  // todos los días valen igual, el rango es 1 para no dividir por cero.
  const rango = max - min || 1
  const ancho = ANCHO - MARGEN.izq - MARGEN.der
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i) => MARGEN.izq + (r.dias.length === 1 ? ancho / 2 : (i / (r.dias.length - 1)) * ancho)
  const y = (v) => MARGEN.arriba + alto - ((v - min) / rango) * alto
  const puntos = r.dias.map((d, i) => `${x(i).toFixed(1)},${y(d.valor).toFixed(1)}`)
  const linea = `M${puntos.join(' L')}`
  // Y el relleno: la misma línea, bajada al suelo y cerrada.
  const relleno = `${linea} L${x(r.dias.length - 1).toFixed(1)},${ALTO - MARGEN.abajo} L${x(0).toFixed(1)},${ALTO - MARGEN.abajo} Z`
  const sube = r.cambio >= 0
  const signo = r.cambio > 0 ? '+' : ''
  return `
    <div class="mc-valor-cifras">
      <p class="mc-valor-ahora">${escapeHtml(euros(r.ultimo.valor))}</p>
      <p class="mc-valor-cambio ${sube ? 'sube' : 'baja'}">
        ${escapeHtml(signo + euros(r.cambio))}${r.pct === null ? '' : ` <span>(${signo}${pct1.format(r.pct)} %)</span>`}
        desde el ${escapeHtml(fechaCorta(r.primero.dia))}
      </p>
    </div>
    <svg class="mc-valor-grafica" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none"
         role="img" aria-label="El valor de tu colección, del ${escapeHtml(fechaCorta(r.primero.dia))} al ${escapeHtml(fechaCorta(r.ultimo.dia))}: de ${escapeHtml(euros(r.primero.valor))} a ${escapeHtml(euros(r.ultimo.valor))}.">
      <path class="mc-valor-area" d="${relleno}" />
      <path class="mc-valor-linea" d="${linea}" />
      <circle class="mc-valor-punto" cx="${x(r.dias.length - 1).toFixed(1)}" cy="${y(r.ultimo.valor).toFixed(1)}" r="4" />
    </svg>
    <p class="mc-valor-pie">
      <span>${escapeHtml(fechaCorta(r.primero.dia))}</span>
      <span>${escapeHtml(fechaCorta(r.ultimo.dia))}</span>
    </p>
    ${r.sinPrecio
      ? `<p class="subtext">${r.sinPrecio} ${r.sinPrecio === 1 ? 'carta no tiene' : 'cartas no tienen'} precio todavía, así que no cuentan. Cuando lo tengan, la línea dará un salto que no es que hayan subido.</p>`
      : ''}`
}
