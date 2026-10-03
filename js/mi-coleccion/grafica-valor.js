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
const ALTO = 180
const MARGEN = { arriba: 14, abajo: 14, izq: 0, der: 0 }

// ── EN CUÁNTOS DÍAS SE MIRA (tanda 464) ──
//
// PINGU, con la app de Collectr delante: «quiero que pongas en cuántos
// días quieres ver el gráfico: uno, siete días, un mes, tres meses, seis
// meses o MAX».
//
// `dias: null` es MAX y significa «todo lo que haya», que no es lo mismo
// que un número muy grande: el día que la colección tenga tres años, MAX
// los enseña sin que nadie toque esta tabla.
export const RANGOS = [
  { id: '1D', dias: 1, nombre: 'un día' },
  { id: '7D', dias: 7, nombre: 'siete días' },
  { id: '1M', dias: 30, nombre: 'un mes' },
  { id: '3M', dias: 90, nombre: 'tres meses' },
  { id: '6M', dias: 180, nombre: 'seis meses' },
  { id: 'MAX', dias: null, nombre: 'todo' },
]

export const RANGO_POR_DEFECTO = 'MAX'

// Los días que entran en un rango. El corte se hace por FECHA y no por
// cuántos puntos hay: con una foto al día son lo mismo, pero el día que
// falte una —un despliegue, una noche sin cron— «los últimos 7 puntos»
// serían diez días y el rótulo mentiría.
//
// Y se añade el ÚLTIMO punto de antes del corte, si lo hay: sin él, una
// serie con huecos empieza la línea a mitad del hueco y parece que la
// colección no existía. Eso NO cambia el rótulo —sigue diciendo los días
// que se piden— pero sí dibuja la línea desde el borde.
export function diasDelRango(dias, rango) {
  const r = RANGOS.find((x) => x.id === rango)
  if (!r || r.dias === null || !dias.length) return dias
  const ultimo = new Date(`${dias[dias.length - 1].dia.slice(0, 10)}T00:00:00Z`)
  const corte = new Date(ultimo.getTime() - r.dias * 86400000).toISOString().slice(0, 10)
  const dentro = dias.filter((d) => d.dia.slice(0, 10) >= corte)
  if (dentro.length >= 2) {
    // El punto de ANTES del corte solo se añade si dentro no hay ninguno
    // justo en el borde — o sea, si falta la foto de ese día. Añadirlo
    // siempre alargaba el tramo un día de más y el rótulo decía «los
    // últimos 2 días» con «1D» puesto.
    const i = dias.indexOf(dentro[0])
    const pegadoAlBorde = dentro[0].dia.slice(0, 10) <= corte
    return i > 0 && !pegadoAlBorde ? [dias[i - 1], ...dentro] : dentro
  }
  // Menos de dos puntos no es una línea: se devuelve vacío y quien
  // pregunta apaga ese rango. Dibujar un punto suelto diría «no ha
  // cambiado nada», que es otra cosa que «no lo sabemos» (la 319).
  return []
}

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
export function graficaHtml(filas, { ahora = null, rango = RANGO_POR_DEFECTO } = {}) {
  const r = resumenDeValor(filas, { ahora })
  // Con un solo día no hay línea que dibujar, y una línea plana de un
  // punto diría «no ha cambiado nada» cuando lo que pasa es que todavía
  // no sabemos nada. Son dos cosas distintas (la lección de la 319).
  if (!r.bastante) {
    return `<p class="subtext">La primera foto del valor de tu colección se toma esta noche. En cuanto haya dos, aquí verás si sube o baja.</p>`
  }
  // QUÉ RANGOS SE PUEDEN PEDIR: los que tengan dos puntos. Un botón que
  // no lleva a ninguna parte miente, así que el que no tiene datos se
  // apaga en vez de enseñar un hueco.
  const hay = RANGOS.map((x) => ({ ...x, dias: diasDelRango(r.dias, x.id) }))
  const elegido = hay.find((x) => x.id === rango && x.dias.length >= 2)
    || hay.find((x) => x.dias.length >= 2 && x.id === RANGO_POR_DEFECTO)
    || hay.filter((x) => x.dias.length >= 2).pop()
  const dias = elegido ? elegido.dias : r.dias
  const primero = dias[0]
  const ultimo = dias[dias.length - 1]
  const cambio = ultimo.valor - primero.valor
  const pct = primero.valor > 0 ? (cambio / primero.valor) * 100 : null

  const valores = dias.map((d) => d.valor)
  const max = Math.max(...valores)
  const min = Math.min(...valores)
  // Un margen arriba y abajo para que la línea no bese los bordes; y si
  // todos los días valen igual, el rango es 1 para no dividir por cero.
  const span = max - min || 1
  const ancho = ANCHO - MARGEN.izq - MARGEN.der
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i2) => MARGEN.izq + (dias.length === 1 ? ancho / 2 : (i2 / (dias.length - 1)) * ancho)
  const y = (v) => MARGEN.arriba + alto - ((v - min) / span) * alto
  const puntos = dias.map((d, i2) => `${x(i2).toFixed(1)},${y(d.valor).toFixed(1)}`)
  const linea = `M${puntos.join(' L')}`
  // Y el relleno: la misma línea, bajada al suelo y cerrada.
  const relleno = `${linea} L${x(dias.length - 1).toFixed(1)},${ALTO} L${x(0).toFixed(1)},${ALTO} Z`
  const sube = cambio >= 0
  const signo = cambio > 0 ? '+' : ''
  // CUÁNTOS DÍAS ABARCA DE VERDAD, que es lo que dice Collectr («in the
  // last 151 days») y es más honesto que el nombre del rango: con MAX
  // puesto y dos semanas de historia, «todo» no dice nada y «en los
  // últimos 14 días» sí.
  const cuantosDias = Math.max(
    1,
    Math.round(
      (Date.parse(`${ultimo.dia.slice(0, 10)}T00:00:00Z`) - Date.parse(`${primero.dia.slice(0, 10)}T00:00:00Z`)) / 86400000
    )
  )
  const botones = hay
    .map((b) => {
      const puede = b.dias.length >= 2
      const puesto = elegido && b.id === elegido.id
      return `<button type="button" class="mc-valor-rango${puesto ? ' activo' : ''}" data-rango="${b.id}"${puede ? '' : ' disabled'} aria-pressed="${puesto ? 'true' : 'false'}" aria-label="Ver ${escapeHtml(b.nombre)}">${b.id}</button>`
    })
    .join('')

  // El trazo lleva `vector-effect="non-scaling-stroke"` porque el SVG se
  // estira a lo ancho con `preserveAspectRatio="none"`: sin él, el trazo se
  // estira con el dibujo y la línea sale más gorda en una pantalla ancha
  // que en una estrecha.
  return `
    <div class="mc-valor-cifras">
      <p class="mc-valor-ahora">${escapeHtml(euros(ultimo.valor))}</p>
      <p class="mc-valor-cambio ${sube ? 'sube' : 'baja'}">
        ${escapeHtml(signo + euros(cambio))}${pct === null ? '' : ` <span>(${signo}${pct1.format(pct)} %)</span>`}
        en ${cuantosDias === 1 ? 'el último día' : `los últimos ${cuantosDias} días`}
      </p>
    </div>
    <svg class="mc-valor-grafica" viewBox="0 0 ${ANCHO} ${ALTO}" preserveAspectRatio="none"
         role="img" aria-label="El valor de tu colección, del ${escapeHtml(fechaCorta(primero.dia))} al ${escapeHtml(fechaCorta(ultimo.dia))}: de ${escapeHtml(euros(primero.valor))} a ${escapeHtml(euros(ultimo.valor))}.">
      <defs>
        <linearGradient id="mcValorDegradado" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" class="mc-valor-arriba" />
          <stop offset="100%" class="mc-valor-abajo" />
        </linearGradient>
      </defs>
      <path class="mc-valor-area" d="${relleno}" />
      <path class="mc-valor-linea" d="${linea}" vector-effect="non-scaling-stroke" />
    </svg>
    <div class="mc-valor-rangos" role="group" aria-label="En cuántos días se mira">${botones}</div>
    ${r.sinPrecio
      ? `<p class="subtext">${r.sinPrecio} ${r.sinPrecio === 1 ? 'carta no tiene' : 'cartas no tienen'} precio todavía, así que no cuentan. Cuando lo tengan, la línea dará un salto que no es que hayan subido.</p>`
      : ''}`
}
