// La IMAGEN RESUMEN de una partida (tanda 513), para subirla a una red: quién
// ganó, con qué mazos, la carrera de premios y tres números. PINGU, de la
// lista de ideas: «una imagen 1080×1350 para redes, sin sprites ni arte de
// cartas».
//
// Sin sprites ni dibujos de cartas A PROPÓSITO, y no por pereza: el arte de
// las cartas es de sus ilustradores y de The Pokémon Company, y una imagen
// pensada para circular por redes es justo donde no puede ir. Lo que se
// dibuja aquí es nuestro: los nombres, las cifras y el gráfico.
//
// Va en dos mitades, como meta-imagen.js: `datosDelResumen` decide QUÉ se
// cuenta (sin DOM: se prueba en Node) y `dibujarResumen` lo pinta en un
// canvas. Se carga al pulsar el botón, no antes.

export const W = 1080
export const H = 1350
const ESCALA = 1

// Los colores de cada jugador son los MISMOS de la mesa y del vídeo
// (--lab-j1 y --lab-j2): el protagonista en azul hielo, el otro en oro.
// Sobre este fondo los dos pasan de 9:1 y no se confunden con daltonismo
// (uno es frío y claro, el otro cálido).
export const COLOR_J = ['#9fd0f0', '#f5cf7a']

const C = {
  fondo: '#0e1722',
  navy: '#1e5175',
  navyClaro: '#2a6b96',
  navyOscuro: '#163d59',
  hielo: '#7cc6d8',
  suave: '#bfdcec',
  apagado: '#9db4c4',
  rejilla: 'rgba(191, 220, 236, 0.16)',
  tarjeta: 'rgba(30, 81, 117, 0.32)',
  borde: 'rgba(124, 198, 216, 0.22)',
  blanco: '#ffffff',
  ambar: '#e0b252',
}

const POR = { premios: 'por premios', rendicion: 'por rendición' }

// Lo que cuenta la imagen. `esconder` es el nombre que no se quiere enseñar
// (el del rival, normalmente): sale como «Rival» en TODAS partes —el
// ganador, la leyenda y los números—, que esconderlo en un sitio y dejarlo
// en otro es no esconderlo.
//
// `izquierda` es quien va a la izquierda (el que se mira abajo en la mesa) y
// `protagonista` decide los COLORES, que son los de la mesa: girarla cambia
// de lado a los jugadores, no de color.
export function datosDelResumen({ numeros, momentos = [], mazos = null, titulo = '', izquierda = null, protagonista = null, esconder = null, fecha = null }) {
  const orden = numeros?.jugadores || []
  if (orden.length < 2) return null
  const yo = orden.includes(izquierda) ? izquierda : orden[0]
  const lados = [yo, orden.find((n) => n !== yo)]
  const color = (n) => COLOR_J[n === (orden.includes(protagonista) ? protagonista : orden[0]) ? 0 : 1]
  const nombre = (n) => (n && n === esconder ? 'Rival' : n)
  const fin = [...momentos].reverse().find((m) => m.tipo === 'fin') || null
  const por = numeros.por
  const golpe = (n) => por[n]?.golpeMax || null
  return {
    titulo: titulo && !(esconder && titulo.includes(esconder)) ? titulo : `${nombre(lados[0])} contra ${nombre(lados[1])}`,
    linea: [
      `${numeros.turnos} ${numeros.turnos === 1 ? 'turno' : 'turnos'}`,
      fecha ? new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    ganador: fin ? { nombre: nombre(fin.jugador), color: color(fin.jugador), porque: POR[fin.porque] || null, turno: fin.turno || null } : null,
    jugadores: lados.map((n) => ({ nombre: nombre(n), color: color(n), mazo: mazos?.[n]?.arq?.nombre || null })),
    carrera: (numeros.carrera || []).map((c) => ({ turno: c.turno, premios: lados.map((n) => c.premios[n] ?? 6) })),
    cifras: [
      { etiqueta: 'Daño hecho', valores: lados.map((n) => String(por[n]?.danio ?? 0)) },
      { etiqueta: 'Pokémon noqueados', valores: lados.map((n) => String(por[n]?.kos ?? 0)) },
      {
        etiqueta: 'Golpe más fuerte',
        valores: lados.map((n) => (golpe(n) ? String(golpe(n).danio) : '—')),
        notas: lados.map((n) => golpe(n)?.ataque || ''),
      },
    ],
  }
}

// El nombre del fichero: el título sin acentos ni símbolos.
export function nombreDeFichero(titulo) {
  const s = String(titulo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `partida-${s || 'pokedoc'}.png`
}

// ── Dibujo ──
function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Corta con «…» lo que no cabe: un nombre de TCG Live puede ser largo.
function recortar(ctx, texto, ancho) {
  const t = String(texto ?? '')
  if (ctx.measureText(t).width <= ancho) return t
  let n = t.length
  while (n > 1 && ctx.measureText(`${t.slice(0, n)}…`).width > ancho) n--
  return `${t.slice(0, n)}…`
}

// El tamaño de letra más grande, entre dos, con el que cabe el texto.
function ajustar(ctx, texto, ancho, { peso, familia, max, min }) {
  let tam = max
  ctx.font = `${peso} ${tam}px ${familia}`
  while (tam > min && ctx.measureText(texto).width > ancho) {
    tam -= 2
    ctx.font = `${peso} ${tam}px ${familia}`
  }
  return tam
}

function pintarFondo(ctx) {
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, W, H)
  const brillo = ctx.createRadialGradient(W / 2, 520, 0, W / 2, 520, 620)
  brillo.addColorStop(0, 'rgba(42, 107, 150, 0.32)')
  brillo.addColorStop(1, 'rgba(42, 107, 150, 0)')
  ctx.fillStyle = brillo
  ctx.fillRect(0, 0, W, H)
  // La malla de hexágonos de la casa, la misma de la imagen del meta.
  ctx.save()
  ctx.strokeStyle = 'rgba(124, 198, 216, 0.06)'
  ctx.lineWidth = 2
  const S = 64
  const A = Math.sqrt(3) * S
  for (let f = -1; f < 26; f++) {
    for (let c = -1; c < 14; c++) {
      const x = c * A + (f % 2 ? A / 2 : 0)
      const y = f * S * 1.5
      ctx.beginPath()
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 3
        if (k) ctx.lineTo(x + S * Math.cos(a), y + S * Math.sin(a))
        else ctx.moveTo(x + S * Math.cos(a), y + S * Math.sin(a))
      }
      ctx.closePath()
      ctx.stroke()
    }
  }
  ctx.restore()
}

function pintarCabecera(ctx, d) {
  ctx.save()
  const g = ctx.createLinearGradient(0, 0, W, 220)
  g.addColorStop(0, C.navyClaro)
  g.addColorStop(0.45, C.navy)
  g.addColorStop(1, C.navyOscuro)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 8
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, 220)
  ctx.restore()
  // La marca: el cuadrado girado del favicon.
  ctx.save()
  ctx.translate(118, 110)
  ctx.rotate((-6 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  redondo(ctx, -64, -64, 128, 128, 34)
  ctx.fillStyle = C.blanco
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = C.navy
  ctx.font = '800 88px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('P', 0, 5)
  ctx.restore()

  ctx.save()
  const x = 222
  const ancho = W - x - 48
  ctx.textBaseline = 'alphabetic'
  ctx.font = '600 34px Fredoka, Inter, sans-serif'
  ctx.fillStyle = C.hielo
  ctx.fillText('La partida', x, 72)
  ajustar(ctx, d.titulo, ancho, { peso: 700, familia: 'Fredoka, Inter, sans-serif', max: 54, min: 36 })
  ctx.fillStyle = C.blanco
  ctx.fillText(recortar(ctx, d.titulo, ancho), x, 136)
  ctx.font = '500 26px Inter, sans-serif'
  ctx.fillStyle = C.suave
  ctx.fillText(recortar(ctx, d.linea, ancho), x, 184)
  ctx.restore()
}

// Quién ganó: la frase grande de la imagen. Sin ganador en el registro (un
// registro copiado a medias) se dice, en vez de dejar el hueco.
function pintarGanador(ctx, d) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  if (!d.ganador) {
    ctx.font = '600 40px Fredoka, Inter, sans-serif'
    ctx.fillStyle = C.apagado
    ctx.fillText('El registro no dice quién ganó', W / 2, 330)
    ctx.restore()
    return
  }
  ctx.font = '700 28px Inter, sans-serif'
  ctx.fillStyle = C.ambar
  ctx.fillText('GANA', W / 2, 292)
  ajustar(ctx, d.ganador.nombre, W - 160, { peso: 700, familia: 'Fredoka, Inter, sans-serif', max: 92, min: 48 })
  ctx.fillStyle = d.ganador.color
  ctx.fillText(recortar(ctx, d.ganador.nombre, W - 160), W / 2, 380)
  const como = [d.ganador.porque, d.ganador.turno ? `en el turno ${d.ganador.turno}` : null].filter(Boolean).join(', ')
  if (como) {
    ctx.font = '500 30px Inter, sans-serif'
    ctx.fillStyle = C.suave
    ctx.fillText(como.charAt(0).toUpperCase() + como.slice(1), W / 2, 428)
  }
  ctx.restore()
}

// Los dos jugadores y su mazo, cara a cara.
function pintarJugadores(ctx, d) {
  const y = 470
  const alto = 132
  const ancho = (W - 96 - 24) / 2
  d.jugadores.forEach((j, k) => {
    const x = 48 + k * (ancho + 24)
    ctx.save()
    redondo(ctx, x, y, ancho, alto, 24)
    ctx.fillStyle = C.tarjeta
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = C.borde
    ctx.stroke()
    // La barra de color del jugador: la identidad no va solo en el texto.
    redondo(ctx, x, y, 12, alto, 6)
    ctx.fillStyle = j.color
    ctx.fill()
    ctx.textBaseline = 'alphabetic'
    ajustar(ctx, j.nombre, ancho - 64, { peso: 700, familia: 'Fredoka, Inter, sans-serif', max: 44, min: 30 })
    ctx.fillStyle = j.color
    ctx.fillText(recortar(ctx, j.nombre, ancho - 64), x + 36, y + 58)
    ctx.font = '500 26px Inter, sans-serif'
    ctx.fillStyle = j.mazo ? C.suave : C.apagado
    ctx.fillText(recortar(ctx, j.mazo || 'Mazo sin identificar', ancho - 64), x + 36, y + 102)
    ctx.restore()
  })
}

// La carrera de premios en escalones, de 6 a 0: el mismo dibujo que la
// web (repeticiones/carrera.js), con el valor al final de cada línea.
function pintarCarrera(ctx, d) {
  const x0 = 120
  const x1 = W - 120
  const y0 = 720
  const y1 = 1000
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.font = '600 32px Fredoka, Inter, sans-serif'
  ctx.fillStyle = C.blanco
  ctx.fillText('La carrera de premios', 48, 674)
  ctx.font = '500 22px Inter, sans-serif'
  ctx.fillStyle = C.apagado
  ctx.textAlign = 'right'
  ctx.fillText('Premios que le quedan a cada uno, turno a turno', W - 48, 674)
  ctx.textAlign = 'left'
  const T = Math.max(1, d.carrera.length - 1)
  const x = (k) => x0 + (k / T) * (x1 - x0)
  const y = (v) => y0 + ((6 - v) / 6) * (y1 - y0)
  // La rejilla: 6, 4, 2 y 0.
  ctx.lineWidth = 2
  ctx.font = '600 22px Inter, sans-serif'
  for (const v of [6, 4, 2, 0]) {
    ctx.strokeStyle = C.rejilla
    ctx.beginPath()
    ctx.moveTo(x0, y(v))
    ctx.lineTo(x1, y(v))
    ctx.stroke()
    ctx.fillStyle = C.apagado
    ctx.textAlign = 'right'
    ctx.fillText(String(v), x0 - 16, y(v) + 8)
  }
  // El eje de abajo: el turno 1 y el último, que es lo que se lee de un
  // vistazo (con veinte turnos, veinte números son ruido).
  ctx.textAlign = 'center'
  ctx.fillText('Inicio', x(0), y1 + 40)
  ctx.fillText(`Turno ${T}`, x(T), y1 + 40)
  // Las dos líneas, un pelo separadas para que una no tape a la otra
  // cuando van empatadas.
  const desvio = [-3, 3]
  ctx.lineWidth = 6
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const k of [1, 0]) {
    ctx.strokeStyle = d.jugadores[k].color
    ctx.beginPath()
    d.carrera.forEach((c, i) => {
      const yy = y(c.premios[k]) + desvio[k]
      if (!i) ctx.moveTo(x(i), yy)
      else {
        ctx.lineTo(x(i), y(d.carrera[i - 1].premios[k]) + desvio[k])
        ctx.lineTo(x(i), yy)
      }
    })
    ctx.stroke()
  }
  // El valor al final: lo que le quedaba a cada uno al acabar.
  const ultimo = d.carrera.at(-1)
  if (ultimo) {
    const ys = ultimo.premios.map((v, k) => y(v) + desvio[k])
    // Si quedan a la misma altura, se separan para que se lean los dos.
    if (Math.abs(ys[0] - ys[1]) < 30) {
      const medio = (ys[0] + ys[1]) / 2
      ys[0] = medio - 16
      ys[1] = medio + 16
    }
    ctx.font = '800 28px Inter, sans-serif'
    ctx.textAlign = 'left'
    ultimo.premios.forEach((v, k) => {
      ctx.fillStyle = d.jugadores[k].color
      ctx.fillText(String(v), x1 + 16, ys[k] + 10)
    })
  }
  ctx.restore()
}

// Tres cifras, una tarjeta cada una, con el valor de cada jugador en su color.
function pintarCifras(ctx, d) {
  const y = 1080
  const alto = 176
  const hueco = 24
  const ancho = (W - 96 - hueco * 2) / 3
  d.cifras.forEach((c, i) => {
    const x = 48 + i * (ancho + hueco)
    ctx.save()
    redondo(ctx, x, y, ancho, alto, 24)
    ctx.fillStyle = C.tarjeta
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = C.borde
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = '600 24px Inter, sans-serif'
    ctx.fillStyle = C.suave
    ctx.fillText(c.etiqueta, x + ancho / 2, y + 44)
    const mitad = ancho / 2
    c.valores.forEach((v, k) => {
      const cx = x + mitad / 2 + k * mitad
      ctx.font = '800 52px Inter, sans-serif'
      ctx.fillStyle = d.jugadores[k].color
      ctx.fillText(v, cx, y + 112)
      if (c.notas?.[k]) {
        ctx.font = '500 20px Inter, sans-serif'
        ctx.fillStyle = C.apagado
        ctx.fillText(recortar(ctx, c.notas[k], mitad - 20), cx, y + 148)
      }
    })
    // La raya entre los dos: es una comparación, no una suma.
    ctx.strokeStyle = C.borde
    ctx.beginPath()
    ctx.moveTo(x + mitad, y + 70)
    ctx.lineTo(x + mitad, y + 156)
    ctx.stroke()
    ctx.restore()
  })
}

function pintarPie(ctx) {
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.font = '600 26px Inter, sans-serif'
  ctx.fillStyle = C.hielo
  ctx.textAlign = 'center'
  ctx.fillText('pokedoc.es/repeticiones', W / 2, H - 36)
  ctx.restore()
}

export async function dibujarResumen(d) {
  try {
    await Promise.all(['700 54px Fredoka', '600 34px Fredoka', '500 26px Inter', '800 52px Inter'].map((f) => document.fonts.load(f)))
  } catch {
    /* sin las fuentes de la casa sale con las del sistema: la imagen sale igual */
  }
  const canvas = document.createElement('canvas')
  canvas.width = W * ESCALA
  canvas.height = H * ESCALA
  const ctx = canvas.getContext('2d')
  ctx.scale(ESCALA, ESCALA)
  pintarFondo(ctx)
  pintarCabecera(ctx, d)
  pintarGanador(ctx, d)
  pintarJugadores(ctx, d)
  pintarCarrera(ctx, d)
  pintarCifras(ctx, d)
  pintarPie(ctx)
  return canvas
}

export const blobDe = (canvas) => new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido montar la imagen.'))), 'image/png'))
