// El vídeo de una repetición (tanda 480).
//
// PINGU: «que te dé la opción de descargar la repetición en mp4». La mesa
// de la página es HTML, y el HTML no se graba: lo que se graba es un
// LIENZO. Así que aquí la mesa se dibuja otra vez, en un <canvas> de
// 1280×720, foto a foto, y cada dibujo se codifica:
//
//   · Con WebCodecs (`VideoEncoder`), que codifica MÁS RÁPIDO que el
//     tiempo real: una partida de tres minutos sale en unos segundos, y
//     la pestaña puede estar detrás sin que se pare nada. El codificador
//     da trozos sueltos y `mp4.js` los mete en su caja. H.264 si el
//     navegador lo tiene (Chrome, Edge, Safari): es el que se ve en todas
//     partes, de WhatsApp a Instagram. Si no, VP9 dentro del MP4.
//   · Si no hay WebCodecs, con `MediaRecorder` sobre el lienzo, que graba
//     EN TIEMPO REAL (lo que dura la partida) y en el formato que el
//     navegador sepa hacer — a veces solo WebM. La pantalla lo dice.
//
// Las imágenes de las cartas se piden con permiso (CORS): un lienzo que
// pinta una imagen de otro dominio sin permiso queda «manchado» y ya no se
// puede grabar. Las de Limitless vienen por /escaneo, que las sirve desde
// pokedoc.es (tanda 413); las de TCGdex ya traen el permiso. La que no
// llegue se pinta como un hueco con su nombre — el vídeo sale igual.
import { empaquetarMp4 } from './mp4.js'
import { arriba } from './estado.js'

export const ANCHO = 1280
export const ALTO = 720
const FPS = 24
// Cuánto dura lo que se mueve al principio de cada jugada (el golpe, el
// cartel del turno); el resto de la jugada es UN fotograma largo.
const ANIMACION = 0.8
const ESCALA_MP4 = 90000

// Los códecs, del que más se ve en todas partes al que menos.
const CODECS = [
  { codec: 'avc1.64001f', caja: 'avc1' },
  { codec: 'avc1.4d001f', caja: 'avc1' },
  { codec: 'avc1.42e01f', caja: 'avc1' },
  { codec: 'vp09.00.31.08', caja: 'vp09' },
]

export async function codecDisponible() {
  if (typeof VideoEncoder !== 'function' || typeof VideoFrame !== 'function') return null
  for (const c of CODECS) {
    try {
      const r = await VideoEncoder.isConfigSupported(configDe(c))
      if (r?.supported) return c
    } catch {
      /* ese no: el siguiente */
    }
  }
  return null
}

function configDe(c) {
  return {
    codec: c.codec,
    width: ANCHO,
    height: ALTO,
    bitrate: 1_500_000,
    framerate: FPS,
    ...(c.caja === 'avc1' ? { avc: { format: 'avc' } } : {}),
  }
}

export function grabadoraDisponible() {
  if (typeof MediaRecorder !== 'function' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null
  for (const tipo of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(tipo)) return { tipo, extension: tipo.startsWith('video/mp4') ? 'mp4' : 'webm' }
  }
  return null
}

// ════════════════════════════════════════════════════════════════════
// Los colores, de la casa
// ════════════════════════════════════════════════════════════════════
//
// Se LEEN de las hojas en vez de copiarlos: son los tokens fijos (los que
// no cambian con el tema, tanda 315) y la paleta de las energías del
// laboratorio. Una copia aquí se separaría sin avisar.
function leerColores() {
  const raiz = getComputedStyle(document.documentElement)
  const v = (n) => raiz.getPropertyValue(n).trim()
  const energias = {}
  const sonda = document.createElement('span')
  sonda.className = 'lab-energia'
  sonda.style.position = 'absolute'
  sonda.style.visibility = 'hidden'
  document.body.append(sonda)
  for (const letra of 'GRWLPFDMYNC') {
    sonda.dataset.tipo = letra
    energias[letra] = { fondo: getComputedStyle(sonda).backgroundColor, texto: getComputedStyle(sonda).color }
  }
  sonda.remove()
  return {
    oscuro: v('--navy-solid-dark'),
    medio: v('--navy-solid'),
    claro: v('--navy-solid-light'),
    blanco: v('--blanco-fijo'),
    peligro: v('--danger-solid'),
    bien: v('--success'),
    aviso: v('--warning'),
    brillo: '#ffd166',
    j: ['#9fd0f0', '#f5cf7a'],
    energias,
  }
}

// ════════════════════════════════════════════════════════════════════
// Dibujar
// ════════════════════════════════════════════════════════════════════

const W_ACTIVO = 96
const H_ACTIVO = Math.round((W_ACTIVO * 342) / 245)
const W_BANCA = 60
const H_BANCA = Math.round((W_BANCA * 342) / 245)
const W_MANO = 52
const H_MANO = Math.round((W_MANO * 342) / 245)
const W_PILA = 44
const H_PILA = Math.round((W_PILA * 342) / 245)
const W_PREMIO = 26
const H_PREMIO = Math.round((W_PREMIO * 342) / 245)

function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function recortar(ctx, texto, ancho) {
  let t = String(texto)
  if (ctx.measureText(t).width <= ancho) return t
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

// Partir un texto en renglones que quepan.
function renglones(ctx, texto, ancho, max) {
  const out = ['']
  for (const p of String(texto).split(/\s+/)) {
    const prueba = out.at(-1) ? `${out.at(-1)} ${p}` : p
    if (ctx.measureText(prueba).width > ancho && out.at(-1)) out.push(p)
    else out[out.length - 1] = prueba
  }
  if (out.length > max) {
    const resto = out.slice(max - 1).join(' ')
    out.length = max - 1
    out.push(recortar(ctx, resto, ancho))
  }
  return out
}

function dorso(ctx, C, x, y, w, h) {
  ctx.save()
  redondo(ctx, x, y, w, h, Math.max(3, w * 0.08))
  ctx.fillStyle = C.medio
  ctx.fill()
  ctx.clip()
  ctx.strokeStyle = C.oscuro
  ctx.lineWidth = Math.max(2, w * 0.08)
  for (let k = -h; k < w + h; k += Math.max(6, w * 0.16)) {
    ctx.beginPath()
    ctx.moveTo(x + k, y)
    ctx.lineTo(x + k + h, y + h)
    ctx.stroke()
  }
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h / 2, w * 0.14, 0, Math.PI * 2)
  ctx.fillStyle = C.blanco
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h / 2, w * 0.07, 0, Math.PI * 2)
  ctx.fillStyle = C.oscuro
  ctx.fill()
  redondo(ctx, x, y, w, h, Math.max(3, w * 0.08))
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

// Una carta: su imagen, o un hueco con su nombre si no llegó.
function carta(ctx, C, img, nombre, x, y, w, h, { gris = false, alfa = 1 } = {}) {
  ctx.save()
  ctx.globalAlpha = alfa
  redondo(ctx, x, y, w, h, Math.max(3, w * 0.06))
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  ctx.fill()
  if (img) {
    ctx.save()
    ctx.clip()
    if (gris) ctx.filter = 'grayscale(1)'
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.86)'
    ctx.font = `600 ${Math.max(10, Math.round(w / 7))}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lin = renglones(ctx, nombre, w - 6, 4)
    const alto = Math.max(12, Math.round(w / 6))
    lin.forEach((l, i) => ctx.fillText(l, x + w / 2, y + h / 2 + (i - (lin.length - 1) / 2) * alto))
  }
  ctx.restore()
}

function pastilla(ctx, texto, x, y, { fondo, color, tam = 14, peso = 700, alinear = 'left', alto = null }) {
  ctx.save()
  ctx.font = `${peso} ${tam}px Inter, sans-serif`
  const w = ctx.measureText(texto).width + tam
  const h = alto || Math.round(tam * 1.6)
  const x0 = alinear === 'center' ? x - w / 2 : alinear === 'right' ? x - w : x
  redondo(ctx, x0, y, w, h, h / 2)
  ctx.fillStyle = fondo
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, x0 + w / 2, y + h / 2 + 1)
  ctx.restore()
  return w
}

function energia(ctx, C, nombre, x, y, letraDe) {
  const letra = letraDe(nombre)
  const col = C.energias[letra] || C.energias.C
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + 9, y + 9, 9, 0, Math.PI * 2)
  ctx.fillStyle = col.fondo
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = col.texto
  ctx.font = '800 11px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letra, x + 9, y + 10)
  ctx.restore()
}

function barraDeVida(ctx, C, x, y, w, vida, ps) {
  const pct = Math.max(0, Math.min(1, vida / ps))
  ctx.save()
  redondo(ctx, x, y, w, 6, 3)
  ctx.fillStyle = 'rgba(255,255,255,0.24)'
  ctx.fill()
  if (pct > 0) {
    redondo(ctx, x, y, Math.max(6, w * pct), 6, 3)
    ctx.fillStyle = pct <= 0.25 ? C.peligro : pct <= 0.5 ? C.aviso : C.bien
    ctx.fill()
  }
  ctx.restore()
}

// Lo que el dibujo necesita saber de la jugada en curso, en el instante t
// (segundos desde que empezó): el golpe tiembla, el daño sube, el cartel
// entra y sale.
function dibujarFoto(ctx, C, s, t, M) {
  const { abajo, imagenes, psDe, letraDe, colorDe } = M
  const f = s.foco
  const arribaJ = s.orden.find((n) => n !== abajo)
  const img = (n) => imagenes.get(n) || null

  // El tapete.
  const g = ctx.createLinearGradient(0, 0, 0, ALTO)
  g.addColorStop(0, C.oscuro)
  g.addColorStop(0.5, C.medio)
  g.addColorStop(1, C.oscuro)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ANCHO, ALTO)
  const r = ctx.createRadialGradient(ANCHO / 2, 300, 40, ANCHO / 2, 300, 620)
  r.addColorStop(0, 'rgba(255,255,255,0.10)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = r
  ctx.fillRect(0, 0, ANCHO, ALTO)

  const lado = (nombre, rival) => {
    const p = s.jugadores[nombre]
    // Arriba: la banca arriba y el activo pegado al centro, como en la
    // mesa de la página (se mira de frente al rival).
    const yActivo = rival ? 112 : 346
    const yBanca = rival ? 14 : 488
    const yCab = rival ? 18 : 346
    // El nombre y los premios, a la izquierda.
    pastilla(ctx, nombre, 24, yCab, { fondo: C.j[colorDe(nombre)], color: C.oscuro, tam: 15 })
    if (s.deQuien === nombre && !s.fin) pastilla(ctx, 'SU TURNO', 24, yCab + 30, { fondo: C.blanco, color: C.oscuro, tam: 11, peso: 800 })
    if (s.fin?.ganador === nombre) pastilla(ctx, 'GANA', 24, yCab + 30, { fondo: C.brillo, color: C.oscuro, tam: 11, peso: 800 })
    const yPrem = rival ? 112 : 410
    for (let k = 0; k < (s.turno ? p.premios : 6); k++) {
      const px = 24 + (k % 3) * (W_PREMIO + 6)
      const py = yPrem + Math.floor(k / 3) * (H_PREMIO + 6)
      if (s.turno) dorso(ctx, C, px, py, W_PREMIO, H_PREMIO)
      else {
        redondo(ctx, px, py, W_PREMIO, H_PREMIO, 3)
        ctx.strokeStyle = 'rgba(255,255,255,0.28)'
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    const brillaPremio = f?.tipo === 'premio' && f.jugador === nombre
    ctx.save()
    ctx.fillStyle = brillaPremio ? C.brillo : 'rgba(255,255,255,0.76)'
    ctx.font = '600 13px Inter, sans-serif'
    ctx.fillText(s.turno ? `${p.premios} ${p.premios === 1 ? 'premio' : 'premios'}` : 'Premios', 24, yPrem + 2 * (H_PREMIO + 6) + 14)
    ctx.restore()

    // Las pilas, a la derecha: mazo, descarte y (del de arriba) la mano.
    const xPilas = 1040
    const yPilas = rival ? 112 : 352
    dorso(ctx, C, xPilas, yPilas, W_PILA, H_PILA)
    const ultima = p.descarte.at(-1)
    if (ultima) carta(ctx, C, img(ultima), ultima, xPilas + 64, yPilas, W_PILA, H_PILA)
    else {
      redondo(ctx, xPilas + 64, yPilas, W_PILA, H_PILA, 4)
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.save()
    ctx.fillStyle = C.blanco
    ctx.textAlign = 'center'
    ctx.font = '700 18px Inter, sans-serif'
    ctx.fillText(String(p.mazo), xPilas + W_PILA / 2, yPilas + H_PILA + 20)
    ctx.fillText(String(p.descarte.length), xPilas + 64 + W_PILA / 2, yPilas + H_PILA + 20)
    ctx.font = '500 11px Inter, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.76)'
    ctx.fillText('mazo', xPilas + W_PILA / 2, yPilas + H_PILA + 34)
    ctx.fillText('descarte', xPilas + 64 + W_PILA / 2, yPilas + H_PILA + 34)
    if (rival) {
      ctx.fillStyle = C.blanco
      ctx.font = '700 18px Inter, sans-serif'
      ctx.fillText(String(p.mano), xPilas + 128 + W_PILA / 2, yPilas + H_PILA + 20)
      ctx.font = '500 11px Inter, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.76)'
      ctx.fillText('en la mano', xPilas + 128 + W_PILA / 2, yPilas + H_PILA + 34)
    }
    ctx.restore()
    if (rival) for (let k = 0; k < Math.min(p.mano, 5); k++) dorso(ctx, C, xPilas + 128 + k * 4, yPilas + k * 2, W_PILA - 12, H_PILA - 16)

    // El activo, en el centro; su vida y sus energías, a la derecha.
    if (p.activo) slot(p.activo, ANCHO / 2 - W_ACTIVO / 2, yActivo, W_ACTIVO, H_ACTIVO, true)
    else {
      redondo(ctx, ANCHO / 2 - W_ACTIVO / 2, yActivo, W_ACTIVO, H_ACTIVO, 6)
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
    // La banca, en fila y centrada.
    const huecos = Math.max(5, p.banca.length)
    const anchoBanca = huecos * W_BANCA + (huecos - 1) * 12
    const x0 = ANCHO / 2 - anchoBanca / 2
    for (let k = 0; k < huecos; k++) {
      const x = x0 + k * (W_BANCA + 12)
      if (p.banca[k]) slot(p.banca[k], x, yBanca, W_BANCA, H_BANCA, false)
      else {
        redondo(ctx, x, yBanca, W_BANCA, H_BANCA, 4)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }

  const slot = (sl, x, y, w, h, activo) => {
    const nombre = arriba(sl)
    const ps = psDe(nombre)
    const golpe = (f?.tipo === 'ataque' && f.objetivo === sl.id) || (f?.tipo === 'danio' && f.slot === sl.id)
    const foco = !golpe && (f?.slot === sl.id || f?.slots?.includes(sl.id))
    // El golpe: tiembla el primer medio segundo.
    const dx = golpe && t < 0.5 ? Math.round(Math.sin(t * 40) * 6 * (1 - t / 0.5)) : 0
    if (foco || golpe) {
      ctx.save()
      ctx.shadowColor = golpe ? C.peligro : C.brillo
      ctx.shadowBlur = 18
      redondo(ctx, x + dx - 3, y - 3, w + 6, h + 6, 8)
      ctx.strokeStyle = golpe ? C.peligro : C.brillo
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()
    }
    carta(ctx, C, img(nombre), nombre, x + dx, y, w, h, { gris: ps && sl.danio >= ps })
    if (sl.danio) pastilla(ctx, String(sl.danio), x + dx + w - 4, y + 4, { fondo: C.peligro, color: C.blanco, tam: activo ? 14 : 11, alinear: 'right', peso: 800 })
    // Lo de debajo (o al lado, el activo).
    if (activo) {
      const xi = x + w + 14
      if (ps) {
        barraDeVida(ctx, C, xi, y + 8, 100, Math.max(0, ps - sl.danio), ps)
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.86)'
        ctx.font = '600 13px Inter, sans-serif'
        ctx.fillText(`${Math.max(0, ps - sl.danio)}/${ps}`, xi, y + 32)
        ctx.restore()
      }
      sl.energias.slice(0, 10).forEach((e, k) => energia(ctx, C, e, xi + (k % 5) * 20, y + 42 + Math.floor(k / 5) * 20, letraDe))
      const chapas = []
      if (sl.herramienta) chapas.push(sl.herramienta)
      if (sl.cartas.length > 1) chapas.push(`evol. ${sl.cartas.length - 1}`)
      chapas.forEach((c, k) => {
        ctx.save()
        ctx.font = '600 11px Inter, sans-serif'
        pastilla(ctx, recortar(ctx, c, 140), xi, y + 88 + k * 22, { fondo: 'rgba(255,255,255,0.16)', color: C.blanco, tam: 11, peso: 600 })
        ctx.restore()
      })
    } else {
      if (ps) barraDeVida(ctx, C, x, y + h + 4, w, Math.max(0, ps - sl.danio), ps)
      sl.energias.slice(0, 4).forEach((e, k) => energia(ctx, C, e, x + 2 + k * 14, y + h - 20, letraDe))
    }
    // El daño de este golpe, subiendo encima de la carta.
    if (golpe && f.danio) {
      const subida = Math.min(1, t / 0.6)
      pastilla(ctx, `−${f.danio}`, x + w / 2, y + h * 0.42 - subida * 22, { fondo: C.peligro, color: C.blanco, tam: activo ? 24 : 16, alinear: 'center', peso: 800 })
    }
  }

  lado(arribaJ, true)
  lado(abajo, false)

  // El centro: el turno, la línea del registro y la jugada en grande.
  ctx.save()
  redondo(ctx, 24, 256, ANCHO - 48, 74, 14)
  ctx.fillStyle = 'rgba(8, 24, 38, 0.55)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
  if (s.estadio) {
    carta(ctx, C, img(s.estadio.carta), s.estadio.carta, 36, 262, 44, 62)
  }
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.76)'
  ctx.font = '700 12px Inter, sans-serif'
  const etiqueta = s.turno ? `TURNO ${s.turno}` : 'PREPARACIÓN'
  ctx.fillText(etiqueta, 96, 280)
  if (s.turno && s.deQuien) pastilla(ctx, s.deQuien, 96 + ctx.measureText(etiqueta).width + 8, 268, { fondo: C.j[colorDe(s.deQuien)], color: C.oscuro, tam: 11 })
  ctx.fillStyle = C.blanco
  ctx.font = '500 16px Inter, sans-serif'
  renglones(ctx, s.linea || (s.turno ? '' : 'La partida está a punto de empezar.'), 760, 2).forEach((l, i) => ctx.fillText(l, 96, 302 + i * 20))
  ctx.restore()

  // A la derecha del centro, lo que pasa.
  const xF = 900
  ctx.save()
  ctx.textBaseline = 'middle'
  if (f?.tipo === 'ataque' || f?.tipo === 'elige') {
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillStyle = C.blanco
    ctx.fillText(recortar(ctx, f.que || 'Ataque', 200), xF, 293)
    if (f.tipo === 'ataque' && f.danio) pastilla(ctx, String(f.danio), 1240, 276, { fondo: C.peligro, color: C.blanco, tam: 22, alinear: 'right', peso: 800 })
  } else if (f?.tipo === 'moneda') {
    ctx.beginPath()
    ctx.arc(xF + 20, 293, 20, 0, Math.PI * 2)
    ctx.fillStyle = f.cara ? C.brillo : 'rgba(255,255,255,0.18)'
    ctx.fill()
    ctx.fillStyle = f.cara ? C.oscuro : C.blanco
    ctx.font = '700 18px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(f.cara ? 'C' : 'X', xF + 20, 294)
    ctx.textAlign = 'left'
    ctx.fillStyle = C.blanco
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillText(f.cara ? 'Cara' : 'Cruz', xF + 52, 293)
  } else if (f?.tipo === 'premio') {
    ctx.fillStyle = C.blanco
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillText(`${f.jugador} coge ${f.n} ${f.n === 1 ? 'premio' : 'premios'}`, xF, 293)
  } else if (f?.tipo === 'ko') {
    ctx.fillStyle = C.brillo
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillText('Fuera de combate', xF + 56, 293)
    carta(ctx, C, img(f.carta), f.carta, xF, 262, 44, 62, { gris: true })
  } else if (f?.tipo === 'jugar' || f?.tipo === 'habilidad') {
    const nombre = f.tipo === 'habilidad' ? f.carta : f.carta
    if (nombre) carta(ctx, C, img(nombre), nombre, xF, 262, 44, 62)
    ctx.fillStyle = C.blanco
    ctx.font = '700 15px Inter, sans-serif'
    ctx.fillText(recortar(ctx, f.tipo === 'habilidad' ? f.que || 'Habilidad' : f.estadio ? 'Pone el estadio' : 'Juega', 260), xF + 56, 293)
  }
  ctx.restore()

  // La carta que se juega, en GRANDE un momento: es lo que en la mesa de
  // verdad se enseña al rival.
  if ((f?.tipo === 'jugar' || f?.tipo === 'evoluciona') && f.carta && t < ANIMACION + 0.4) {
    const entra = Math.min(1, t / 0.2)
    const sale = t > ANIMACION ? Math.max(0, 1 - (t - ANIMACION) / 0.4) : 1
    const w = 170
    const h = Math.round((w * 342) / 245)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 24
    carta(ctx, C, img(f.carta), f.carta, 846, 360 - h / 2 + (1 - entra) * 20, w, h, { alfa: entra * sale })
    ctx.restore()
  }

  // La mano del de abajo.
  const p = s.jugadores[abajo]
  const conocidas = p.manoConocida.slice(0, p.mano)
  const tapadas = Math.max(0, p.mano - conocidas.length)
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.76)'
  ctx.font = '700 12px Inter, sans-serif'
  ctx.fillText(`MANO · ${p.mano}`, 24, 604)
  ctx.restore()
  const total = conocidas.length + tapadas
  const paso = total > 1 ? Math.min(W_MANO + 6, (1000 - W_MANO) / (total - 1)) : 0
  conocidas.forEach((c, k) => carta(ctx, C, img(c), c, 24 + k * paso, 616, W_MANO, H_MANO))
  for (let k = 0; k < tapadas; k++) dorso(ctx, C, 24 + (conocidas.length + k) * paso, 616, W_MANO, H_MANO)

  // La firma.
  ctx.save()
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.86)'
  ctx.font = '700 22px Fredoka, Inter, sans-serif'
  ctx.fillText('PokeDoc', ANCHO - 24, 680)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '500 12px Inter, sans-serif'
  ctx.fillText('pokedoc.es/repeticiones', ANCHO - 24, 700)
  ctx.restore()

  // El cartel del cambio de turno, y el del final.
  const cartel = f?.tipo === 'turno' && /^Turn|^Turno/.test(s.linea || '') ? `Turno de ${s.deQuien}` : f?.tipo === 'fin' ? `Gana ${s.fin?.ganador}` : null
  if (cartel && (f.tipo === 'fin' || t < 1.1)) {
    const a = f.tipo === 'fin' ? Math.min(1, t / 0.3) : t < 0.2 ? t / 0.2 : t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.3) : 1
    ctx.save()
    ctx.globalAlpha = a
    ctx.font = '700 34px Fredoka, Inter, sans-serif'
    const w = ctx.measureText(cartel).width + 64
    redondo(ctx, ANCHO / 2 - w / 2, 262, w, 62, 31)
    ctx.fillStyle = C.oscuro
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = f.tipo === 'fin' ? C.brillo : C.j[colorDe(s.deQuien)]
    ctx.stroke()
    ctx.fillStyle = C.blanco
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(cartel, ANCHO / 2, 294)
    ctx.restore()
  }
}

// ════════════════════════════════════════════════════════════════════
// Las imágenes
// ════════════════════════════════════════════════════════════════════

function cargarImagen(url) {
  return new Promise((resolver) => {
    const img = new Image()
    // Con permiso, o nada: una sin permiso mancharía el lienzo y no se
    // podría grabar.
    img.crossOrigin = 'anonymous'
    const fin = setTimeout(() => resolver(null), 8000)
    img.onload = () => {
      clearTimeout(fin)
      resolver(img)
    }
    img.onerror = () => {
      clearTimeout(fin)
      resolver(null)
    }
    img.src = url
  })
}

async function cargarImagenes(nombres, fuentesDe, alAvanzar) {
  const mapa = new Map()
  let hechas = 0
  const lista = [...nombres]
  // De seis en seis: no se lanza medio centenar de peticiones a la vez.
  for (let k = 0; k < lista.length; k += 6) {
    await Promise.all(
      lista.slice(k, k + 6).map(async (n) => {
        for (const url of fuentesDe(n)) {
          const img = await cargarImagen(url)
          if (img) {
            mapa.set(n, img)
            break
          }
        }
        hechas++
        alAvanzar?.(hechas / lista.length)
      })
    )
  }
  return mapa
}

// Todas las cartas que salen en algún momento.
function nombresDeLasFotos(fotos) {
  const out = new Set()
  for (const s of fotos) {
    for (const p of Object.values(s.jugadores)) {
      for (const x of [p.activo, ...p.banca].filter(Boolean)) out.add(arriba(x))
      if (p.descarte.length) out.add(p.descarte.at(-1))
      for (const c of p.manoConocida) out.add(c)
    }
    if (s.estadio) out.add(s.estadio.carta)
    if (s.foco?.carta) out.add(s.foco.carta)
  }
  out.delete('')
  out.delete('?')
  return out
}

// ════════════════════════════════════════════════════════════════════
// La línea de tiempo
// ════════════════════════════════════════════════════════════════════
//
// Cada foto: unos fotogramas al principio mientras algo se mueve, y luego
// UNO que dura el resto (lo que no cambia no hace falta repetirlo).
// Devuelve [{ foto, t, duracion }] en segundos.
export function lineaDeTiempo(fotos, esperaDe, ritmo) {
  const out = []
  fotos.forEach((s, i) => {
    const total = Math.max(0.25, esperaDe(s) / 1000 / ritmo) + (s.foco?.tipo === 'fin' ? 2.5 : 0)
    const anima = ['ataque', 'danio', 'turno', 'jugar', 'evoluciona', 'fin', 'entra', 'sube', 'unir', 'habilidad'].includes(s.foco?.tipo)
    // El cartel del turno dura algo más que el resto.
    const tAnim = anima ? Math.min(total, s.foco?.tipo === 'turno' || s.foco?.tipo === 'fin' ? 1.2 : ANIMACION) : 0
    const n = Math.floor(tAnim * FPS)
    for (let k = 0; k < n; k++) out.push({ foto: i, t: k / FPS, duracion: 1 / FPS })
    // Lo quieto, en fotogramas de medio segundo como mucho: uno de tres
    // segundos se ve igual, pero al saltar dentro del vídeo (o al subirlo
    // a una red que lo recodifica) hay reproductores que no encuentran
    // nada entre fotograma y fotograma.
    let t = n / FPS
    while (total - t > 0.001) {
      const d = Math.min(0.5, total - t)
      out.push({ foto: i, t, duracion: d })
      t += d
    }
  })
  return out
}

// ════════════════════════════════════════════════════════════════════
// Hacer el vídeo
// ════════════════════════════════════════════════════════════════════

// `fotos`: las de la repetición. `M`: { abajo, psDe, letraDe, colorDe,
// fuentesDe, esperaDe }. `ritmo`: 1, 2 o 4. `alAvanzar(fase, fraccion)`.
// `senal.cancelado`: para pararlo. Devuelve { blob, extension, codec,
// tiempoReal }.
export async function hacerVideo({ fotos, M, ritmo = 2, alAvanzar = () => {}, senal = {} }) {
  if (document.fonts?.load) {
    await Promise.all(['500 16px Inter', '700 16px Inter', '700 34px Fredoka'].map((f) => document.fonts.load(f).catch(() => null)))
  }
  alAvanzar('imagenes', 0)
  const imagenes = await cargarImagenes(nombresDeLasFotos(fotos), M.fuentesDe, (x) => alAvanzar('imagenes', x))
  const C = leerColores()
  const lienzo = document.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = ALTO
  const ctx = lienzo.getContext('2d')
  const dibujo = { ...M, imagenes }
  const linea = lineaDeTiempo(fotos, M.esperaDe, ritmo)

  const codec = await codecDisponible()
  if (codec) return { ...(await conWebCodecs({ codec, lienzo, ctx, C, fotos, linea, dibujo, alAvanzar, senal })), tiempoReal: false }
  const grabadora = grabadoraDisponible()
  if (grabadora) return { ...(await conGrabadora({ grabadora, lienzo, ctx, C, fotos, linea, dibujo, alAvanzar, senal })), tiempoReal: true }
  throw new Error('Este navegador no sabe hacer vídeos. Prueba con Chrome, Edge o Safari al día.')
}

const cancelar = () => Object.assign(new Error('Cancelado.'), { name: 'AbortError' })

async function conWebCodecs({ codec, lienzo, ctx, C, fotos, linea, dibujo, alAvanzar, senal }) {
  const trozos = []
  let descripcion = null
  let fallo = null
  const codificador = new VideoEncoder({
    output: (trozo, meta) => {
      const d = meta?.decoderConfig?.description
      if (d && !descripcion) descripcion = d instanceof ArrayBuffer ? new Uint8Array(d.slice(0)) : new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice()
      const datos = new Uint8Array(trozo.byteLength)
      trozo.copyTo(datos)
      trozos.push({ datos, clave: trozo.type === 'key', ts: trozo.timestamp, dur: trozo.duration })
    },
    error: (e) => {
      fallo = e
    },
  })
  codificador.configure(configDe(codec))
  let us = 0
  let ultimaClave = -Infinity
  try {
    for (let k = 0; k < linea.length; k++) {
      if (senal.cancelado) throw cancelar()
      if (fallo) throw fallo
      const fr = linea[k]
      dibujarFoto(ctx, C, fotos[fr.foto], fr.t, dibujo)
      const duracion = Math.round(fr.duracion * 1e6)
      const frame = new VideoFrame(lienzo, { timestamp: us, duration: duracion })
      // Una clave cada dos segundos como poco: se puede saltar a
      // cualquier punto del vídeo sin esperar.
      const clave = us - ultimaClave >= 2e6
      if (clave) ultimaClave = us
      codificador.encode(frame, { keyFrame: clave })
      frame.close()
      us += duracion
      // Sin atascar al codificador: si se le acumula trabajo, se espera.
      while (codificador.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4))
      if (k % 10 === 0) alAvanzar('video', k / linea.length)
    }
    await codificador.flush()
  } finally {
    if (codificador.state !== 'closed') codificador.close()
  }
  if (fallo) throw fallo
  alAvanzar('video', 1)
  // Del orden de decodificar al MP4: cada muestra dura hasta la siguiente
  // (en orden de PRESENTACIÓN), y si el codificador reordena (fotogramas
  // B) cada una lleva su desfase.
  // Todo en la escala del MP4 ANTES de restar: redondear cada duración
  // por su lado acumulaba un tic de desfase por fotograma.
  const a90 = (x) => Math.round((x * ESCALA_MP4) / 1e6)
  const fin90 = a90(us)
  const porTiempo = [...trozos].sort((a, b) => a.ts - b.ts)
  const durDe = new Map()
  porTiempo.forEach((t, i) => durDe.set(t, (i + 1 < porTiempo.length ? a90(porTiempo[i + 1].ts) : fin90) - a90(t.ts)))
  let dts = 0
  const muestras = trozos.map((t) => {
    const m = { datos: t.datos, clave: t.clave, duracion: Math.max(1, durDe.get(t)), desfase: a90(t.ts) - dts }
    dts += m.duracion
    return m
  })
  const mp4 = empaquetarMp4({ codec: codec.caja, codecCompleto: codec.codec, ancho: ANCHO, alto: ALTO, escala: ESCALA_MP4, descripcion }, muestras)
  return { blob: new Blob([mp4], { type: 'video/mp4' }), extension: 'mp4', codec: codec.caja }
}

// El respaldo: grabar el lienzo en tiempo real.
async function conGrabadora({ grabadora, lienzo, ctx, C, fotos, linea, dibujo, alAvanzar, senal }) {
  const flujo = lienzo.captureStream(FPS)
  const rec = new MediaRecorder(flujo, { mimeType: grabadora.tipo, videoBitsPerSecond: 1_500_000 })
  const partes = []
  rec.ondataavailable = (e) => e.data.size && partes.push(e.data)
  const acabado = new Promise((r) => (rec.onstop = r))
  dibujarFoto(ctx, C, fotos[0], 0, dibujo)
  rec.start(1000)
  const total = linea.reduce((t, x) => t + x.duracion, 0)
  let hecho = 0
  try {
    for (const fr of linea) {
      if (senal.cancelado) throw cancelar()
      dibujarFoto(ctx, C, fotos[fr.foto], fr.t, dibujo)
      await new Promise((r) => setTimeout(r, fr.duracion * 1000))
      hecho += fr.duracion
      alAvanzar('video', hecho / total)
    }
  } finally {
    rec.stop()
    flujo.getTracks().forEach((t) => t.stop())
  }
  await acabado
  return { blob: new Blob(partes, { type: grabadora.tipo.split(';')[0] }), extension: grabadora.extension, codec: grabadora.tipo }
}

// Para las pruebas y para la vista previa: dibujar una foto suelta.
export async function dibujarUna({ foto, M, t = 0 }) {
  const imagenes = await cargarImagenes(nombresDeLasFotos([foto]), M.fuentesDe)
  const lienzo = document.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = ALTO
  dibujarFoto(lienzo.getContext('2d'), leerColores(), foto, t, { ...M, imagenes })
  return lienzo
}
