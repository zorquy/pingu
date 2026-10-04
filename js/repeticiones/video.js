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
// Los dos formatos (tanda 493). El vertical es para TikTok, Reels y
// Shorts: 720×1280 y no 1080×1920, porque es lo más grande que cabe en el
// mismo nivel de H.264 que el horizontal (3.1: 3.600 macrobloques), y un
// teléfono no le saca más a un tapete.
export const FORMATOS = {
  horizontal: { ancho: ANCHO, alto: ALTO },
  vertical: { ancho: 720, alto: 1280 },
}
const medidasDe = (formato) => FORMATOS[formato] || FORMATOS.horizontal
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

export async function codecDisponible(formato = 'horizontal') {
  if (typeof VideoEncoder !== 'function' || typeof VideoFrame !== 'function') return null
  for (const c of CODECS) {
    try {
      const r = await VideoEncoder.isConfigSupported(configDe(c, formato))
      if (r?.supported) return c
    } catch {
      /* ese no: el siguiente */
    }
  }
  return null
}

function configDe(c, formato = 'horizontal') {
  const { ancho, alto } = medidasDe(formato)
  return {
    codec: c.codec,
    width: ancho,
    height: alto,
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
//
// Desde la tanda 493 hay dos composiciones —la horizontal de siempre y una
// vertical para el móvil— hechas con las MISMAS piezas: el Pokémon con su
// vida y sus energías, las pilas, la jugada del centro, la carta en
// grande, la mano, la firma y el cartel. Lo que cambia es dónde va cada
// una; una pieza arreglada en una se arregla en las dos.
// `donde`: { i, tiempo } — la foto dentro del trozo y el segundo del vídeo
// en que empieza este fotograma (para la nota y la barra de momentos).
function dibujarFoto(ctx, C, s, t, M, donde = { i: 0, tiempo: 0 }) {
  const { abajo, imagenes, psDe, letraDe, colorDe } = M
  const K = {
    ctx,
    C,
    s,
    t,
    f: s.foco,
    abajo,
    arribaJ: s.orden.find((n) => n !== abajo),
    img: (n) => imagenes.get(n) || null,
    psDe,
    letraDe,
    colorDe,
    nota: M.notas?.get(donde.i) || null,
    barra: M.barra || null,
    tiempo: donde.tiempo,
  }
  if (M.formato === 'vertical') dibujarVertical(K)
  else dibujarHorizontal(K)
}

// ── Las piezas ──

function pintarTapete(K, ancho, alto, cy) {
  const { ctx, C } = K
  const g = ctx.createLinearGradient(0, 0, 0, alto)
  g.addColorStop(0, C.oscuro)
  g.addColorStop(0.5, C.medio)
  g.addColorStop(1, C.oscuro)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ancho, alto)
  const r = ctx.createRadialGradient(ancho / 2, cy, 40, ancho / 2, cy, 620)
  r.addColorStop(0, 'rgba(255,255,255,0.10)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = r
  ctx.fillRect(0, 0, ancho, alto)
}

// El nombre del jugador y, debajo, si es su turno o si ha ganado.
function pintarNombre(K, nombre, x, y) {
  const { ctx, C, s, colorDe } = K
  pastilla(ctx, nombre, x, y, { fondo: C.j[colorDe(nombre)], color: C.oscuro, tam: 15 })
  if (s.deQuien === nombre && !s.fin) pastilla(ctx, 'SU TURNO', x, y + 30, { fondo: C.blanco, color: C.oscuro, tam: 11, peso: 800 })
  if (s.fin?.ganador === nombre) pastilla(ctx, 'GANA', x, y + 30, { fondo: C.brillo, color: C.oscuro, tam: 11, peso: 800 })
}

// Los premios, en una rejilla de `columnas`, con su cuenta debajo.
function pintarPremios(K, nombre, x, y, { columnas = 3, ancho = W_PREMIO, alinear = 'left' } = {}) {
  const { ctx, C, s, f } = K
  const p = s.jugadores[nombre]
  const alto = Math.round((ancho * 342) / 245)
  const n = s.turno ? p.premios : 6
  const filas = Math.ceil(6 / columnas)
  for (let k = 0; k < n; k++) {
    const px = x + (k % columnas) * (ancho + 6)
    const py = y + Math.floor(k / columnas) * (alto + 6)
    if (s.turno) dorso(ctx, C, px, py, ancho, alto)
    else {
      redondo(ctx, px, py, ancho, alto, 3)
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
  if (alinear === 'right') ctx.textAlign = 'right'
  const xTexto = alinear === 'right' ? x + columnas * (ancho + 6) - 6 : x
  ctx.fillText(s.turno ? `${p.premios} ${p.premios === 1 ? 'premio' : 'premios'}` : 'Premios', xTexto, y + filas * (alto + 6) + 14)
  ctx.restore()
}

// Las pilas: mazo, descarte y (del de arriba) la mano.
function pintarPilas(K, nombre, xPilas, yPilas, conMano) {
  const { ctx, C, s, img } = K
  const p = s.jugadores[nombre]
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
  if (conMano) {
    ctx.fillStyle = C.blanco
    ctx.font = '700 18px Inter, sans-serif'
    ctx.fillText(String(p.mano), xPilas + 128 + W_PILA / 2, yPilas + H_PILA + 20)
    ctx.font = '500 11px Inter, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.76)'
    ctx.fillText('en la mano', xPilas + 128 + W_PILA / 2, yPilas + H_PILA + 34)
  }
  ctx.restore()
  if (conMano) for (let k = 0; k < Math.min(p.mano, 5); k++) dorso(ctx, C, xPilas + 128 + k * 4, yPilas + k * 2, W_PILA - 12, H_PILA - 16)
}

// El activo (o su hueco) y la banca, en fila y centrada en `cx`.
function pintarActivo(K, p, cx, y, w = W_ACTIVO) {
  const { ctx } = K
  const h = Math.round((w * 342) / 245)
  if (p.activo) pintarSlot(K, p.activo, cx - w / 2, y, w, h, true)
  else {
    redondo(ctx, cx - w / 2, y, w, h, 6)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }
}

function pintarBanca(K, p, cx, y, wMax = W_BANCA, cabe = Infinity) {
  const { ctx } = K
  const huecos = Math.max(5, p.banca.length)
  const hueco = 12
  // Con más de cinco (un estadio que amplía la banca) y sin sitio, las
  // cartas se encogen: la vertical no tiene los 1.232 px de la otra.
  const w = Math.min(wMax, Math.floor((cabe - (huecos - 1) * hueco) / huecos))
  const h = Math.round((w * 342) / 245)
  const anchoBanca = huecos * w + (huecos - 1) * hueco
  const x0 = cx - anchoBanca / 2
  for (let k = 0; k < huecos; k++) {
    const x = x0 + k * (w + hueco)
    if (p.banca[k]) pintarSlot(K, p.banca[k], x, y, w, h, false)
    else {
      redondo(ctx, x, y, w, h, 4)
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }
  }
}

function pintarSlot(K, sl, x, y, w, h, activo) {
  const { ctx, C, f, t, img, psDe, letraDe } = K
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

// La caja del centro: el estadio, el turno y la línea del registro.
function pintarCentro(K, { x, y, w, h, xTexto, yEtiqueta, yLinea, anchoLinea, lineas, xEstadio, yEstadio }) {
  const { ctx, C, s, img, colorDe } = K
  ctx.save()
  redondo(ctx, x, y, w, h, 14)
  ctx.fillStyle = 'rgba(8, 24, 38, 0.55)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
  if (s.estadio) {
    carta(ctx, C, img(s.estadio.carta), s.estadio.carta, xEstadio, yEstadio, 44, 62)
  }
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.76)'
  ctx.font = '700 12px Inter, sans-serif'
  const etiqueta = s.turno ? `TURNO ${s.turno}` : 'PREPARACIÓN'
  ctx.fillText(etiqueta, xTexto, yEtiqueta)
  if (s.turno && s.deQuien) pastilla(ctx, s.deQuien, xTexto + ctx.measureText(etiqueta).width + 8, yEtiqueta - 12, { fondo: C.j[colorDe(s.deQuien)], color: C.oscuro, tam: 11 })
  ctx.fillStyle = C.blanco
  ctx.font = '500 16px Inter, sans-serif'
  renglones(ctx, s.linea || (s.turno ? '' : 'La partida está a punto de empezar.'), anchoLinea, lineas).forEach((l, i) => ctx.fillText(l, xTexto, yLinea + i * 20))
  ctx.restore()
}

// Lo que pasa, junto a la línea: el ataque y su daño, la moneda, el KO…
// `yF` es la línea media; `xDanio`, el borde derecho del daño.
function pintarJugada(K, xF, yF, xDanio) {
  const { ctx, C, f, img } = K
  ctx.save()
  ctx.textBaseline = 'middle'
  if (f?.tipo === 'ataque' || f?.tipo === 'elige') {
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillStyle = C.blanco
    ctx.fillText(recortar(ctx, f.que || 'Ataque', 200), xF, yF)
    if (f.tipo === 'ataque' && f.danio) pastilla(ctx, String(f.danio), xDanio, yF - 17, { fondo: C.peligro, color: C.blanco, tam: 22, alinear: 'right', peso: 800 })
  } else if (f?.tipo === 'moneda') {
    ctx.beginPath()
    ctx.arc(xF + 20, yF, 20, 0, Math.PI * 2)
    ctx.fillStyle = f.cara ? C.brillo : 'rgba(255,255,255,0.18)'
    ctx.fill()
    ctx.fillStyle = f.cara ? C.oscuro : C.blanco
    ctx.font = '700 18px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(f.cara ? 'C' : 'X', xF + 20, yF + 1)
    ctx.textAlign = 'left'
    ctx.fillStyle = C.blanco
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillText(f.cara ? 'Cara' : 'Cruz', xF + 52, yF)
  } else if (f?.tipo === 'premio') {
    ctx.fillStyle = C.blanco
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillText(`${f.jugador} coge ${f.n} ${f.n === 1 ? 'premio' : 'premios'}`, xF, yF)
  } else if (f?.tipo === 'ko') {
    ctx.fillStyle = C.brillo
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillText('Fuera de combate', xF + 56, yF)
    carta(ctx, C, img(f.carta), f.carta, xF, yF - 31, 44, 62, { gris: true })
  } else if (f?.tipo === 'jugar' || f?.tipo === 'habilidad') {
    const nombre = f.tipo === 'habilidad' ? f.carta : f.carta
    if (nombre) carta(ctx, C, img(nombre), nombre, xF, yF - 31, 44, 62)
    ctx.fillStyle = C.blanco
    ctx.font = '700 15px Inter, sans-serif'
    ctx.fillText(recortar(ctx, f.tipo === 'habilidad' ? f.que || 'Habilidad' : f.estadio ? 'Pone el estadio' : 'Juega', 260), xF + 56, yF)
  }
  ctx.restore()
}

// La carta que se juega, en GRANDE un momento: es lo que en la mesa de
// verdad se enseña al rival. `x` es su borde izquierdo y `cy` su centro.
function pintarCartaGrande(K, x, cy, w = 170) {
  const { ctx, C, f, t, img } = K
  if ((f?.tipo === 'jugar' || f?.tipo === 'evoluciona') && f.carta && t < ANIMACION + 0.4) {
    const entra = Math.min(1, t / 0.2)
    const sale = t > ANIMACION ? Math.max(0, 1 - (t - ANIMACION) / 0.4) : 1
    const h = Math.round((w * 342) / 245)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 24
    carta(ctx, C, img(f.carta), f.carta, x, cy - h / 2 + (1 - entra) * 20, w, h, { alfa: entra * sale })
    ctx.restore()
  }
}

// La mano del de abajo, en abanico si no cabe.
function pintarMano(K, x, yRotulo, y, ancho, w = W_MANO) {
  const { ctx, C, s, abajo, img } = K
  const h = Math.round((w * 342) / 245)
  const p = s.jugadores[abajo]
  const conocidas = p.manoConocida.slice(0, p.mano)
  const tapadas = Math.max(0, p.mano - conocidas.length)
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.76)'
  ctx.font = '700 12px Inter, sans-serif'
  ctx.fillText(`MANO · ${p.mano}`, x, yRotulo)
  ctx.restore()
  const total = conocidas.length + tapadas
  const paso = total > 1 ? Math.min(w + 6, (ancho - w) / (total - 1)) : 0
  conocidas.forEach((c, k) => carta(ctx, C, img(c), c, x + k * paso, y, w, h))
  for (let k = 0; k < tapadas; k++) dorso(ctx, C, x + (conocidas.length + k) * paso, y, w, h)
}

function pintarFirma(K, x, y, alinear = 'right') {
  const { ctx } = K
  ctx.save()
  ctx.textAlign = alinear
  ctx.fillStyle = 'rgba(255,255,255,0.86)'
  ctx.font = '700 22px Fredoka, Inter, sans-serif'
  ctx.fillText('PokeDoc', x, y)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '500 12px Inter, sans-serif'
  ctx.fillText('pokedoc.es/repeticiones', x, y + 20)
  ctx.restore()
}

// El cartel del cambio de turno, y el del final, centrado en (cx, cy).
// Desde la tanda 514 el del turno lleva su NÚMERO («Turno 5 de Rojo»): en
// un vídeo no hay deslizador que mirar para saber por dónde va. Y un KO
// tiene el suyo, en el color del brillo, que es lo que se busca al
// recortar un trozo para enseñarlo.
function pintarCartel(K, cx, cy) {
  const { ctx, C, s, f, t, colorDe } = K
  const cartel =
    f?.tipo === 'turno' && /^Turn|^Turno/.test(s.linea || '')
      ? `Turno ${s.turno} de ${s.deQuien}`
      : f?.tipo === 'fin'
        ? `Gana ${s.fin?.ganador}`
        : f?.tipo === 'ko' && f.carta
          ? `KO · ${f.carta}`
          : null
  if (cartel && (f.tipo === 'fin' || t < 1.1)) {
    const a = f.tipo === 'fin' ? Math.min(1, t / 0.3) : t < 0.2 ? t / 0.2 : t > 0.8 ? Math.max(0, 1 - (t - 0.8) / 0.3) : 1
    ctx.save()
    ctx.globalAlpha = a
    ctx.font = '700 34px Fredoka, Inter, sans-serif'
    const w = ctx.measureText(cartel).width + 64
    redondo(ctx, cx - w / 2, cy - 31, w, 62, 31)
    ctx.fillStyle = C.oscuro
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = f.tipo === 'turno' ? C.j[colorDe(s.deQuien)] : C.brillo
    ctx.stroke()
    ctx.fillStyle = C.blanco
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(cartel, cx, cy + 1)
    ctx.restore()
  }
}

// La nota del dueño en su jugada (tanda 514): un rótulo como un subtítulo,
// que entra con la foto y se queda lo que dura (la línea de tiempo le da
// lo que se tarda en LEERLA). `y` es su borde de arriba.
function pintarNota(K, cx, y, ancho) {
  const { ctx, C, nota, t } = K
  if (!nota) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, t / 0.25)
  ctx.font = '500 20px Inter, sans-serif'
  const lineas = renglones(ctx, nota, ancho - 48, 3)
  const alto = 52 + lineas.length * 26
  redondo(ctx, cx - ancho / 2, y, ancho, alto, 16)
  ctx.fillStyle = 'rgba(8, 24, 38, 0.92)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = C.brillo
  ctx.stroke()
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.brillo
  ctx.font = '700 14px Inter, sans-serif'
  ctx.fillText('NOTA', cx - ancho / 2 + 24, y + 30)
  ctx.fillStyle = C.blanco
  ctx.font = '500 20px Inter, sans-serif'
  lineas.forEach((l, k) => ctx.fillText(l, cx - ancho / 2 + 24, y + 58 + k * 26))
  ctx.restore()
}

// La barra de momentos (tanda 514): por dónde va el vídeo, con una raya
// fina en cada turno y una marca en cada KO. Es la misma idea que las
// marcas del deslizador de la página.
function pintarBarra(K, x, y, ancho) {
  const { ctx, C, barra, tiempo } = K
  if (!barra?.total) return
  const pos = (s) => x + Math.min(1, s / barra.total) * ancho
  ctx.save()
  redondo(ctx, x, y, ancho, 6, 3)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)'
  ctx.fill()
  redondo(ctx, x, y, Math.max(6, pos(tiempo) - x), 6, 3)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  for (const s of barra.turnos) ctx.fillRect(pos(s) - 1, y - 4, 2, 14)
  ctx.fillStyle = C.brillo
  for (const s of barra.kos) {
    ctx.beginPath()
    ctx.arc(pos(s), y + 3, 6, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ── La horizontal (1280×720), la de siempre ──
function dibujarHorizontal(K) {
  const { s, abajo, arribaJ } = K
  pintarTapete(K, ANCHO, ALTO, 300)
  for (const [nombre, rival] of [[arribaJ, true], [abajo, false]]) {
    const p = s.jugadores[nombre]
    // Arriba: la banca arriba y el activo pegado al centro, como en la
    // mesa de la página (se mira de frente al rival).
    pintarNombre(K, nombre, 24, rival ? 18 : 346)
    pintarPremios(K, nombre, 24, rival ? 112 : 410)
    pintarPilas(K, nombre, 1040, rival ? 112 : 352, rival)
    pintarActivo(K, p, ANCHO / 2, rival ? 112 : 346)
    pintarBanca(K, p, ANCHO / 2, rival ? 14 : 488)
  }
  pintarCentro(K, { x: 24, y: 256, w: ANCHO - 48, h: 74, xTexto: 96, yEtiqueta: 280, yLinea: 302, anchoLinea: 760, lineas: 2, xEstadio: 36, yEstadio: 262 })
  pintarJugada(K, 900, 293, 1240)
  pintarCartaGrande(K, 846, 360)
  pintarMano(K, 24, 604, 616, 1000)
  pintarFirma(K, ANCHO - 24, 680)
  pintarCartel(K, ANCHO / 2, 293)
  // Sobre la mano, que es lo que menos se mira mientras se lee.
  pintarNota(K, 512, 560, 976)
  // Hasta donde empieza la firma, que va en la esquina de abajo.
  pintarBarra(K, 24, 704, 976)
}

// ── La vertical (720×1280), para el móvil ──
//
// Lo que importa —los dos activos y la jugada del centro— va entre los
// 120 y los 1030 px de alto: TikTok, Reels y Shorts tapan arriba las
// pestañas y abajo el texto y los botones. El de arriba se mira de frente,
// como en la mesa: su banca arriba y su activo pegado al centro.
const V = { ancho: 720, alto: 1280, activo: 124, banca: 84, mano: 56, premio: 22 }
function dibujarVertical(K) {
  const { s, abajo, arribaJ } = K
  const cx = V.ancho / 2
  const hActivo = Math.round((V.activo * 342) / 245)
  const hBanca = Math.round((V.banca * 342) / 245)
  pintarTapete(K, V.ancho, V.alto, 600)

  // El de arriba.
  const pa = s.jugadores[arribaJ]
  pintarNombre(K, arribaJ, 24, 112)
  pintarPremios(K, arribaJ, V.ancho - 24 - 6 * (V.premio + 6) + 6, 112, { columnas: 6, ancho: V.premio, alinear: 'right' })
  pintarBanca(K, pa, cx, 168, V.banca, V.ancho - 48)
  pintarActivo(K, pa, cx, 168 + hBanca + 24, V.activo)
  pintarPilas(K, arribaJ, 24, 168 + hBanca + 40, true)

  // El centro.
  const yC = 168 + hBanca + 24 + hActivo + 18
  pintarCentro(K, { x: 24, y: yC, w: V.ancho - 48, h: 168, xTexto: 92, yEtiqueta: yC + 28, yLinea: yC + 54, anchoLinea: V.ancho - 48 - 92, lineas: 3, xEstadio: 36, yEstadio: yC + 14 })
  pintarJugada(K, 92, yC + 134, V.ancho - 40)

  // El de abajo.
  const pb = s.jugadores[abajo]
  const yA = yC + 168 + 18
  pintarActivo(K, pb, cx, yA, V.activo)
  pintarPilas(K, abajo, 24, yA + 16, false)
  pintarBanca(K, pb, cx, yA + hActivo + 20, V.banca, V.ancho - 48)
  const yN = yA + hActivo + 20 + hBanca + 22
  pintarNombre(K, abajo, 24, yN)
  pintarPremios(K, abajo, V.ancho - 24 - 6 * (V.premio + 6) + 6, yN, { columnas: 6, ancho: V.premio, alinear: 'right' })
  pintarMano(K, 24, yN + 70, yN + 82, V.ancho - 48, V.mano)

  pintarFirma(K, cx, V.alto - 56, 'center')
  pintarCartaGrande(K, cx - 100, yC + 84, 200)
  pintarCartel(K, cx, yC + 84)
  // La nota, sobre la banca de arriba: dentro de lo que las redes no tapan
  // (de 120 a 1030) y lejos de la jugada del centro. La barra, justo
  // encima del nombre de abajo, que también queda dentro.
  pintarNota(K, cx, 128, V.ancho - 48)
  pintarBarra(K, 24, yN - 14, V.ancho - 48)
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
//
// `cierre`: segundos de más en la ÚLTIMA foto (tanda 493). Un trozo
// recortado que no acaba en el final de la partida se cortaba en seco.
//
// `extraDe(i)`: milisegundos de más en la foto i que NO van con el ritmo
// (tanda 514): lo que se tarda en leer una nota no va más deprisa a 4×,
// igual que en el reproductor de la página.
export function lineaDeTiempo(fotos, esperaDe, ritmo, { cierre = 0, extraDe = null } = {}) {
  const out = []
  fotos.forEach((s, i) => {
    const total = Math.max(0.25, esperaDe(s) / 1000 / ritmo) + (s.foco?.tipo === 'fin' ? 2.5 : i === fotos.length - 1 ? cierre : 0) + (extraDe ? extraDe(i) / 1000 : 0)
    const anima = ['ataque', 'danio', 'turno', 'jugar', 'evoluciona', 'fin', 'entra', 'sube', 'unir', 'habilidad', 'ko'].includes(s.foco?.tipo)
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
// `senal.cancelado`: para pararlo. `formato`: 'horizontal' o 'vertical'.
// `desde`/`hasta`: las fotos del trozo (las dos dentro). Devuelve { blob,
// extension, codec, tiempoReal }.
export function tramoDe(fotos, desde = 0, hasta = fotos.length - 1) {
  const a = Math.max(0, Math.min(desde, fotos.length - 1))
  const b = Math.max(a, Math.min(hasta, fotos.length - 1))
  return { fotos: fotos.slice(a, b + 1), cierre: b < fotos.length - 1 ? 1 : 0, desde: a }
}

// Cuándo empieza cada foto en el vídeo, y con eso, dónde caen los turnos y
// los KO en la barra.
export function barraDeMomentos(fotos, linea) {
  const inicio = new Map()
  let tiempo = 0
  for (const fr of linea) {
    if (!inicio.has(fr.foto)) inicio.set(fr.foto, tiempo)
    tiempo += fr.duracion
  }
  const cuando = (tipo) => fotos.flatMap((s, i) => (s.foco?.tipo === tipo && inicio.has(i) ? [inicio.get(i)] : []))
  return { total: tiempo, turnos: cuando('turno'), kos: cuando('ko') }
}

// `notas`: Map de la foto (en la partida ENTERA) a su texto, o null; cada
// una sale como rótulo y alarga su foto lo que se tarda en leerla
// (`esperaDeNota(texto)`, en ms). `barra`: si va la barra de momentos.
export async function hacerVideo({ fotos: todas, M, ritmo = 2, alAvanzar = () => {}, senal = {}, formato = 'horizontal', desde = 0, hasta = todas.length - 1, notas = null, esperaDeNota = () => 0, barra = false }) {
  const { fotos, cierre, desde: a } = tramoDe(todas, desde, hasta)
  const notasDelTramo = new Map([...(notas || [])].filter(([i]) => i >= a && i < a + fotos.length).map(([i, texto]) => [i - a, texto]))
  const { ancho, alto } = medidasDe(formato)
  if (document.fonts?.load) {
    await Promise.all(['500 16px Inter', '700 16px Inter', '700 34px Fredoka'].map((f) => document.fonts.load(f).catch(() => null)))
  }
  alAvanzar('imagenes', 0)
  const imagenes = await cargarImagenes(nombresDeLasFotos(fotos), M.fuentesDe, (x) => alAvanzar('imagenes', x))
  const C = leerColores()
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')
  const linea = lineaDeTiempo(fotos, M.esperaDe, ritmo, { cierre, extraDe: (i) => (notasDelTramo.has(i) ? esperaDeNota(notasDelTramo.get(i)) : 0) })
  const dibujo = { ...M, imagenes, formato, notas: notasDelTramo, barra: barra ? barraDeMomentos(fotos, linea) : null }

  const codec = await codecDisponible(formato)
  if (codec) return { ...(await conWebCodecs({ codec, lienzo, ctx, C, fotos, linea, dibujo, alAvanzar, senal, formato })), tiempoReal: false }
  const grabadora = grabadoraDisponible()
  if (grabadora) return { ...(await conGrabadora({ grabadora, lienzo, ctx, C, fotos, linea, dibujo, alAvanzar, senal })), tiempoReal: true }
  throw new Error('Este navegador no sabe hacer vídeos. Prueba con Chrome, Edge o Safari al día.')
}

const cancelar = () => Object.assign(new Error('Cancelado.'), { name: 'AbortError' })

async function conWebCodecs({ codec, lienzo, ctx, C, fotos, linea, dibujo, alAvanzar, senal, formato }) {
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
  codificador.configure(configDe(codec, formato))
  let us = 0
  let ultimaClave = -Infinity
  try {
    for (let k = 0; k < linea.length; k++) {
      if (senal.cancelado) throw cancelar()
      if (fallo) throw fallo
      const fr = linea[k]
      dibujarFoto(ctx, C, fotos[fr.foto], fr.t, dibujo, { i: fr.foto, tiempo: us / 1e6 })
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
  const mp4 = empaquetarMp4({ codec: codec.caja, codecCompleto: codec.codec, ancho: lienzo.width, alto: lienzo.height, escala: ESCALA_MP4, descripcion }, muestras)
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
      dibujarFoto(ctx, C, fotos[fr.foto], fr.t, dibujo, { i: fr.foto, tiempo: hecho })
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
export async function dibujarUna({ foto, M, t = 0, formato = 'horizontal', nota = null, barra = null, tiempo = 0 }) {
  const imagenes = await cargarImagenes(nombresDeLasFotos([foto]), M.fuentesDe)
  const { ancho, alto } = medidasDe(formato)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  dibujarFoto(lienzo.getContext('2d'), leerColores(), foto, t, { ...M, imagenes, formato, notas: nota ? new Map([[0, nota]]) : null, barra }, { i: 0, tiempo })
  return lienzo
}
