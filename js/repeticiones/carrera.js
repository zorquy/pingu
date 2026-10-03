// La carrera de premios (tanda 492): cuántos premios le QUEDAN a cada uno
// al acabar cada turno, en escalones.
//
// Es el dibujo de cómo fue la partida: quién se adelantó, cuándo se dio la
// vuelta. Dos series y un solo eje (de 6 a 0), escalones y no rectas
// —los premios no bajan poco a poco, caen de golpe—, la leyenda siempre y
// los valores al final de cada línea solo si no se pisan. Al pasar por
// encima, una línea vertical se pega al turno más cercano y dice los dos
// valores; la misma cuenta está en la tabla de debajo, que es lo que lee
// quien no ve el gráfico (el gráfico va `aria-hidden`).
//
// Los nombres de los jugadores vienen del registro: entran con
// `textContent`, nunca pegados a un `innerHTML`.

const NS = 'http://www.w3.org/2000/svg'
const ALTO = 200
const M = { arriba: 12, abajo: 28, izq: 28, der: 36 }

function el(nombre, attrs = {}, padre = null) {
  const x = document.createElementNS(NS, nombre)
  for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, String(v))
  if (padre) padre.append(x)
  return x
}

// `caja` recibe el gráfico; `numeros` sale de numeros.js; `colorDe(nombre)`
// da el 0 o el 1 de cada jugador (el mismo que en la mesa); `alIr(turno)`
// lleva la repetición a ese turno al hacer clic.
export function pintarCarrera(caja, numeros, { colorDe, alIr = null } = {}) {
  const dibujar = () => dibujo(caja, numeros, { colorDe, alIr })
  dibujar()
  // Se redibuja con el ancho de su caja (tanda 316: lo que responde al
  // ancho de su caja se mide en su caja, no en la ventana).
  caja._observador?.disconnect()
  if ('ResizeObserver' in window) {
    let ancho = caja.clientWidth
    caja._observador = new ResizeObserver(() => {
      if (Math.abs(caja.clientWidth - ancho) < 2) return
      ancho = caja.clientWidth
      dibujar()
    })
    caja._observador.observe(caja)
  }
}

function dibujo(caja, { jugadores, carrera }, { colorDe, alIr }) {
  caja.replaceChildren()
  const ancho = Math.max(240, caja.clientWidth || 600)
  const T = Math.max(1, carrera.length - 1)
  const w = ancho - M.izq - M.der
  const h = ALTO - M.arriba - M.abajo
  const x = (k) => M.izq + (k / T) * w
  const y = (v) => M.arriba + ((6 - v) / 6) * h
  // Las dos líneas, un pelo separadas: cuando van empatadas (al principio,
  // casi siempre) una taparía a la otra entera.
  const desvio = (j) => (j === 0 ? -1.5 : 1.5)

  const svg = el('svg', { class: 'rep-carrera-svg', width: ancho, height: ALTO, viewBox: `0 0 ${ancho} ${ALTO}`, 'aria-hidden': 'true', focusable: 'false' })
  // La rejilla: rayas finas a 6, 4, 2 y 0 premios, con su número.
  for (const v of [0, 2, 4, 6]) {
    el('line', { class: 'rep-carrera-rejilla', x1: M.izq, x2: ancho - M.der, y1: y(v), y2: y(v) }, svg)
    el('text', { class: 'rep-carrera-eje', x: M.izq - 8, y: y(v), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = String(v)
  }
  // Los turnos, de uno en uno si caben; si no, a saltos.
  const paso = Math.max(1, Math.ceil(T / Math.max(1, Math.floor(w / 28))))
  for (let k = 0; k <= T; k += paso) {
    el('text', { class: 'rep-carrera-eje', x: x(k), y: ALTO - 8, 'text-anchor': 'middle' }, svg).textContent = k === 0 ? 'Inicio' : String(k)
  }
  const fin = carrera.at(-1)
  jugadores.forEach((n) => {
    const j = colorDe(n)
    const d = carrera.map((c, k) => (k === 0 ? `M ${x(0)} ${y(c.premios[n]) + desvio(j)}` : `H ${x(k)} V ${y(c.premios[n]) + desvio(j)}`)).join(' ')
    el('path', { class: 'rep-carrera-linea', 'data-j': j, d }, svg)
    el('circle', { class: 'rep-carrera-punto', 'data-j': j, cx: x(T), cy: y(fin.premios[n]) + desvio(j), r: 4 }, svg)
  })

  // El cursor: la raya del turno y sus dos puntos.
  const cursor = el('g', { class: 'rep-carrera-cursor', visibility: 'hidden' }, svg)
  const raya = el('line', { class: 'rep-carrera-raya', y1: M.arriba, y2: M.arriba + h }, cursor)
  const puntos = jugadores.map((n) => el('circle', { class: 'rep-carrera-punto', 'data-j': colorDe(n), r: 4 }, cursor))
  const tapa = el('rect', { class: 'rep-carrera-tapa', x: M.izq, y: 0, width: w, height: ALTO }, svg)

  const nota = document.createElement('div')
  nota.className = 'rep-carrera-nota'
  nota.hidden = true
  const titulo = document.createElement('p')
  titulo.className = 'rep-carrera-nota-titulo'
  nota.append(titulo)
  const filas = jugadores.map((n) => {
    const fila = document.createElement('p')
    fila.className = 'rep-carrera-nota-fila'
    const clave = document.createElement('span')
    clave.className = 'rep-carrera-clave'
    clave.dataset.j = String(colorDe(n))
    const valor = document.createElement('strong')
    const quien = document.createElement('span')
    quien.textContent = n
    fila.append(clave, valor, quien)
    nota.append(fila)
    return valor
  })

  const turnoEn = (ev) => {
    const r = svg.getBoundingClientRect()
    const px = ((ev.clientX - r.left) / r.width) * ancho
    return Math.max(0, Math.min(T, Math.round(((px - M.izq) / w) * T)))
  }
  tapa.addEventListener('pointermove', (ev) => {
    const k = turnoEn(ev)
    const c = carrera[k]
    raya.setAttribute('x1', x(k))
    raya.setAttribute('x2', x(k))
    jugadores.forEach((n, i) => {
      puntos[i].setAttribute('cx', x(k))
      puntos[i].setAttribute('cy', y(c.premios[n]) + desvio(colorDe(n)))
      filas[i].textContent = `${c.premios[n]} ${c.premios[n] === 1 ? 'premio' : 'premios'} · `
    })
    titulo.textContent = k === 0 ? 'Al empezar' : `Al acabar el turno ${k}${c.de ? ` (de ${c.de})` : ''}`
    cursor.setAttribute('visibility', 'visible')
    nota.hidden = false
    // A la derecha del cursor, y a la izquierda si no cabe.
    const izquierda = x(k) + 12 + nota.offsetWidth > ancho
    nota.style.left = `${izquierda ? x(k) - 12 - nota.offsetWidth : x(k) + 12}px`
  })
  tapa.addEventListener('pointerleave', () => {
    cursor.setAttribute('visibility', 'hidden')
    nota.hidden = true
  })
  if (alIr) tapa.addEventListener('click', (ev) => alIr(turnoEn(ev)))

  caja.append(svg, nota)

  // El valor al final de cada línea, solo si no se pisan: si se juntan,
  // los llevan la leyenda, la nota y la tabla (separarlos a mano los
  // despega de su línea y se leen peor).
  const ys = jugadores.map((n) => y(fin.premios[n]))
  if (Math.abs(ys[0] - ys[1]) >= 16) {
    jugadores.forEach((n, i) => {
      const etiqueta = document.createElement('span')
      etiqueta.className = 'rep-carrera-final'
      etiqueta.style.top = `${ys[i]}px`
      etiqueta.style.left = `${x(T) + 10}px`
      etiqueta.textContent = String(fin.premios[n])
      caja.append(etiqueta)
    })
  }
}
