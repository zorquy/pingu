// La IMAGEN del meta de un torneo (tanda 425), para compartirla al
// terminar: el anillo con los mazos y sus porcentajes, los sprites de cada
// mazo dentro de su trozo, la leyenda, cuántos jugaron y el top 4. PINGU:
// «que los admin puedan generar esa imagen al acabar todos los torneos»,
// como las que se publican de los regionales.
//
// Los mazos son los de la pestaña Meta (`agruparMeta`, tanda 421: por el
// Pokémon principal) y los sprites, los MISMOS de las chapas de la web
// (`resolverIconosDeArquetipo`). Como Limitless no da permiso de CORS y un
// canvas que pinta una imagen sin permiso ya no se puede guardar, sus
// sprites se piden a /sprite (netlify/functions/sprite.mjs), desde nuestro
// dominio; detrás va la cadena de respaldos de siempre (PokeAPI por
// jsDelivr y por GitHub, que sí dan permiso). Un mazo cuyo sprite no llega
// por ningún lado enseña su número de jugadores: la imagen sale igual.
//
// Se dibuja a mano en un canvas, sin librerías y sin una sola clase de
// CSS: se carga al pulsar el botón, no antes.
import { showToast } from '../toast.js'
import { resolverIconosDeArquetipo } from './cartas-decklist.js'
import { CDN_SPRITES, cadenaDeRespaldos } from './sprites-pokemon.js'

const W = 1080
const H = 1350
const ESCALA = 2

// Los colores de los mazos: la paleta categórica validada para fondo
// oscuro (separación para daltonismo y contraste ≥ 3:1 sobre el azul de
// fondo), en orden fijo. «Otros» va en gris, que no compite.
export const COLORES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#2f9fb3', '#b0732f']
const GRIS_OTROS = '#4b5d6c'
const MAX_MAZOS = COLORES.length

const C = {
  fondo: '#0e1722',
  navy: '#1e5175',
  navyClaro: '#2a6b96',
  navyOscuro: '#163d59',
  hielo: '#7cc6d8',
  suave: '#bfdcec',
  apagado: '#9db4c4',
  blanco: '#ffffff',
  ambar: '#e0b252',
}

// Sin el «ex»: en una imagen para compartir los mazos se llaman como los
// llama la gente («Dragapult», «N's Zoroark»), como en la de Limitless.
export const nombreCorto = (n) => String(n || '').replace(/\s+ex\b/gi, '').replace(/\s+/g, ' ').trim()

// Qué trozos lleva el anillo: los mazos de más de un jugador, hasta ocho;
// si caben todos, todos. Lo demás va junto en «Otros», que es lo que hace
// cualquier gráfico de meta con 20 mazos de una persona.
export function trozosDelMeta(meta) {
  const grupos = meta?.arquetipos || []
  const total = meta?.total || 0
  const propios = grupos.length <= MAX_MAZOS ? grupos : grupos.filter((g) => g.cuantos > 1).slice(0, MAX_MAZOS)
  const resto = grupos.filter((g) => !propios.includes(g))
  const trozos = propios.map((g, i) => ({ nombre: nombreCorto(g.arq.nombre), n: g.cuantos, color: COLORES[i], arq: g.arq }))
  if (resto.length === 1) {
    // Un «Otros» de un solo mazo no es «otros»: va con su nombre y su
    // sprite, en el gris de «Otros» porque los ocho colores ya están dados.
    const [g] = resto
    trozos.push({ nombre: nombreCorto(g.arq.nombre), n: g.cuantos, color: GRIS_OTROS, arq: g.arq })
  } else if (resto.length) {
    trozos.push({
      nombre: 'Otros',
      n: resto.reduce((s, g) => s + g.cuantos, 0),
      color: GRIS_OTROS,
      otros: resto.map((g) => nombreCorto(g.arq.nombre)),
    })
  }
  return { trozos, total }
}

export const porcentaje = (n, total) => `${((n / (total || 1)) * 100).toFixed(1).replace('.', ',')} %`

// ── Cargar imágenes que se puedan pintar en el canvas ──
function cargar(url) {
  return new Promise((ok) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const fin = setTimeout(() => ok(null), 8000)
    img.onload = () => {
      clearTimeout(fin)
      ok(img)
    }
    img.onerror = () => {
      clearTimeout(fin)
      ok(null)
    }
    img.src = url
  })
}

// De la CDN de Limitless a /sprite, que es nuestra; lo demás, tal cual.
export function fuenteDeSprite(url) {
  const u = String(url || '')
  return u.startsWith(`${CDN_SPRITES}/`) ? `/sprite/${u.slice(CDN_SPRITES.length + 1).replace(/\.png$/, '')}` : u
}

async function imagenDeIcono(icono) {
  if (!icono?.url) return null
  const cadena = icono.sprite ? [icono.url, ...cadenaDeRespaldos(icono.url)].map(fuenteDeSprite) : [icono.url]
  for (const u of [...new Set(cadena)]) {
    const img = await cargar(u)
    if (img) return { img, sprite: icono.sprite }
  }
  return null
}

async function iconosDe(arq) {
  if (!arq?.iconos?.length) return []
  const resueltos = await resolverIconosDeArquetipo(arq.iconos).catch(() => [])
  return (await Promise.all(resueltos.map(imagenDeIcono))).filter(Boolean)
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

function recortar(ctx, texto, ancho) {
  let t = String(texto)
  if (ctx.measureText(t).width <= ancho) return t
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

// Un icono dentro de una caja de `lado`: el sprite entero y nítido (es
// pixel art); la carta, recortada a su ilustración en un cuadrado.
function pintarIcono(ctx, icono, cx, cy, lado) {
  const { img, sprite } = icono
  ctx.save()
  if (sprite) {
    const k = lado / Math.max(img.width, img.height)
    const w = img.width * k
    const h = img.height * k
    ctx.imageSmoothingEnabled = false
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h)
  } else {
    const l = lado * 0.8
    redondo(ctx, cx - l / 2, cy - l / 2, l, l, l * 0.2)
    ctx.clip()
    const w = l * 2.05
    ctx.drawImage(img, cx - l / 2 - w * 0.254, cy - l / 2 - l * 0.3, w, (w * img.height) / img.width)
  }
  ctx.restore()
}

function pintarFondo(ctx) {
  ctx.fillStyle = C.fondo
  ctx.fillRect(0, 0, W, H)
  const brillo = ctx.createRadialGradient(CX, CY, 0, CX, CY, 540)
  brillo.addColorStop(0, 'rgba(42, 107, 150, 0.35)')
  brillo.addColorStop(1, 'rgba(42, 107, 150, 0)')
  ctx.fillStyle = brillo
  ctx.fillRect(0, 0, W, H)
  // La malla de hexágonos: la insignia de la casa, de fondo.
  ctx.save()
  ctx.strokeStyle = 'rgba(124, 198, 216, 0.07)'
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
        const px = x + S * Math.cos(a)
        const py = y + S * Math.sin(a)
        if (k) ctx.lineTo(px, py)
        else ctx.moveTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
  }
  ctx.restore()
}

function pintarCabecera(ctx, { nombre, linea }) {
  ctx.save()
  const g = ctx.createLinearGradient(0, 0, W, 252)
  g.addColorStop(0, C.navyClaro)
  g.addColorStop(0.45, C.navy)
  g.addColorStop(1, C.navyOscuro)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 32
  ctx.shadowOffsetY = 8
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, 252)
  ctx.restore()
  // La marca: el cuadrado girado del favicon.
  ctx.save()
  ctx.translate(131, 126)
  ctx.rotate((-6 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10
  redondo(ctx, -75, -75, 150, 150, 40)
  ctx.fillStyle = C.blanco
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = C.navy
  ctx.font = '800 104px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('P', 0, 6)
  ctx.restore()

  ctx.save()
  const x = 246
  const ancho = W - x - 48
  let tam = 60
  ctx.font = `700 ${tam}px Fredoka, Inter, sans-serif`
  while (tam > 38 && ctx.measureText(nombre).width > ancho) {
    tam -= 2
    ctx.font = `700 ${tam}px Fredoka, Inter, sans-serif`
  }
  ctx.fillStyle = C.blanco
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(recortar(ctx, nombre, ancho), x, 100)
  ctx.font = '600 40px Fredoka, Inter, sans-serif'
  ctx.fillStyle = C.hielo
  ctx.fillText('El meta del torneo', x, 158)
  ctx.font = '500 26px Inter, sans-serif'
  ctx.fillStyle = C.suave
  ctx.fillText(recortar(ctx, linea, ancho), x, 204)
  ctx.restore()
}

const CX = 360
const CY = 615
const R = 226
const r = 130
// Hasta dónde pueden ir los porcentajes: por arriba y por abajo, un poco
// más allá del anillo; a los lados, sin salirse de la imagen ni pisar la
// leyenda.
const ARRIBA = CY - R - 64
const ABAJO = CY + R + 64
const BORDE_IZQ = 20
const BORDE_DER = 716
const SEPARACION = 30

// Los porcentajes de UN lado del anillo, sin pisarse: dos trozos pequeños
// seguidos tienen el centro casi a la misma altura y sus cifras se
// montaban. Se recorren de arriba abajo juntando en un BLOQUE los que se
// pisan; cada bloque se pone a `sep` de distancia entre cifras y centrado
// donde querían estar las suyas (así un racimo se queda donde estaba, en
// vez de caerse entero hacia abajo), sin salirse de [min, max]. Si al
// meterlo en su sitio pisa al de encima, se juntan los dos y vuelta a
// empezar.
export function colocarEtiquetas(ys, { sep = SEPARACION, min = ARRIBA, max = ABAJO } = {}) {
  const orden = ys.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0])
  const bloques = []
  const asentar = (b) => {
    b.ini = Math.max(min, Math.min(b.suma / b.n - ((b.n - 1) * sep) / 2, max - (b.n - 1) * sep))
  }
  for (const [y] of orden) {
    const nuevo = { suma: y, n: 1 }
    asentar(nuevo)
    bloques.push(nuevo)
    while (bloques.length > 1) {
      const b = bloques[bloques.length - 1]
      const a = bloques[bloques.length - 2]
      if (a.ini + a.n * sep <= b.ini) break
      a.suma += b.suma
      a.n += b.n
      bloques.pop()
      asentar(a)
    }
  }
  const sitio = []
  let k = 0
  for (const b of bloques) {
    for (let j = 0; j < b.n; j++) sitio[orden[k++][1]] = b.ini + j * sep
  }
  return sitio
}

// Cuánto se aparta del centro, en horizontal, el anillo a la altura de una
// cifra (contando su alto): la cifra empieza más allá, para no pintarse
// encima de un trozo cuando se la ha subido o bajado.
function anchoDelAnilloEn(y) {
  const alto = 13
  const dy = y - alto > CY ? y - alto - CY : y + alto < CY ? CY - y - alto : 0
  const rad = R + 8
  return dy >= rad ? 0 : Math.sqrt(rad * rad - dy * dy)
}

// Dónde va la cifra de un trozo cuyo centro está en el ángulo `medio`,
// ya colocada a la altura `y` y con `w` de ancho: la guía sale del borde
// del anillo, hace codo un poco más allá y llega a la cifra. La cifra
// nunca se pinta encima del anillo (cuando se la ha subido o bajado, se
// aparta lo que haga falta) ni se sale de la imagen o pisa la leyenda
// (entonces guía y cifra se recogen hacia dentro).
export function sitioDeCifra(medio, y, w) {
  const derecha = Math.cos(medio) >= 0
  const s = derecha ? 1 : -1
  const libre = anchoDelAnilloEn(y)
  const gx = CX + (R + 20) * Math.cos(medio)
  let hx = derecha ? Math.max(gx + 14, CX + libre) : Math.min(gx - 14, CX - libre)
  hx = derecha ? Math.min(hx, BORDE_DER - 6 - w) : Math.max(hx, BORDE_IZQ + 6 + w)
  return {
    derecha,
    ex: CX + (R + 6) * Math.cos(medio),
    ey: CY + (R + 6) * Math.sin(medio),
    gx,
    gy: CY + (R + 20) * Math.sin(medio),
    hx,
    x: hx + s * 6,
  }
}

// Para las pruebas: dónde está el anillo y hasta dónde pueden ir las cifras.
export const ANILLO = { CX, CY, R, r, ARRIBA, ABAJO, BORDE_IZQ, BORDE_DER }

function pintarAnillo(ctx, trozos, total, iconos) {
  let ang = -Math.PI / 2
  const punto = (rad, a) => [CX + rad * Math.cos(a), CY + rad * Math.sin(a)]
  const etiquetas = []
  for (const [i, t] of trozos.entries()) {
    const a0 = ang
    const a1 = ang + (t.n / total) * Math.PI * 2
    ang = a1
    ctx.save()
    ctx.beginPath()
    ctx.arc(CX, CY, R, a0, a1)
    ctx.arc(CX, CY, r, a1, a0, true)
    ctx.closePath()
    ctx.fillStyle = t.color
    ctx.fill()
    // El hueco entre trozos, del color del fondo.
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = C.fondo
    ctx.stroke()
    ctx.restore()

    const medio = (a0 + a1) / 2
    const [mx, my] = punto((R + r) / 2, medio)
    // Lo de dentro: los sprites del mazo (dos si caben a lo ancho del
    // trozo), y si no hay, el número de jugadores.
    const largo = ((R + r) / 2) * (a1 - a0)
    const suyos = iconos[i] || []
    if (suyos.length && largo >= 46) {
      // Dos sprites (el mazo y su pareja, como los pinta Limitless) en
      // cuanto caben a lo largo del trozo, un poco más pequeños.
      const dos = suyos.length > 1 && largo >= 110
      const lado = dos ? Math.min(62, largo * 0.42) : Math.min(70, largo * 0.8)
      if (dos) {
        // A lo largo del arco: uno a cada lado del centro del trozo.
        const d = lado * 0.55
        const tx = -Math.sin(medio)
        const ty = Math.cos(medio)
        pintarIcono(ctx, suyos[0], mx - tx * d, my - ty * d, lado)
        pintarIcono(ctx, suyos[1], mx + tx * d, my + ty * d, lado)
      } else {
        pintarIcono(ctx, suyos[0], mx, my, lado)
      }
    } else if (largo >= 30) {
      // (En un trozo más estrecho que la cifra no se pone nada: la
      // leyenda ya lo dice, y una cifra que se sale no se lee.)
      ctx.save()
      ctx.font = '800 30px Inter, sans-serif'
      ctx.fillStyle = C.blanco
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(t.otros ? `+${t.otros.length}` : String(t.n), mx, my)
      ctx.restore()
    }
    etiquetas.push({ medio, derecha: Math.cos(medio) >= 0, texto: porcentaje(t.n, total) })
  }

  // El porcentaje de cada trozo, fuera, con su guía: primero se reparten
  // las alturas de cada lado y después se pinta.
  for (const derecha of [true, false]) {
    const suyas = etiquetas.filter((e) => e.derecha === derecha)
    const ys = colocarEtiquetas(suyas.map((e) => punto(R + 20, e.medio)[1]))
    suyas.forEach((e, k) => {
      e.y = ys[k]
    })
  }
  ctx.save()
  ctx.strokeStyle = C.apagado
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.font = '700 23px Inter, sans-serif'
  ctx.fillStyle = C.blanco
  ctx.textBaseline = 'middle'
  for (const e of etiquetas) {
    const c = sitioDeCifra(e.medio, e.y, ctx.measureText(e.texto).width)
    ctx.beginPath()
    ctx.moveTo(c.ex, c.ey)
    ctx.lineTo(c.gx, c.gy)
    ctx.lineTo(c.hx, e.y)
    ctx.stroke()
    ctx.textAlign = c.derecha ? 'left' : 'right'
    ctx.fillText(e.texto, c.x, e.y)
  }
  ctx.restore()

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = C.blanco
  ctx.font = '700 92px Fredoka, Inter, sans-serif'
  ctx.fillText(String(total), CX, CY - 18)
  ctx.fillStyle = C.hielo
  ctx.font = '600 26px Inter, sans-serif'
  ctx.fillText(total === 1 ? 'lista' : 'listas', CX, CY + 50)
  ctx.restore()
}

function pintarLeyenda(ctx, trozos) {
  const x = 736
  const ancho = W - 40 - x
  let y = 380
  ctx.save()
  ctx.font = '700 18px Inter, sans-serif'
  ctx.letterSpacing = '2.5px'
  ctx.fillStyle = C.hielo
  ctx.textBaseline = 'middle'
  ctx.fillText('MAZOS', x, y)
  ctx.letterSpacing = '0px'
  y += 26
  const alto = trozos.length > 7 ? 41 : 47
  for (const t of trozos) {
    const cy = y + alto / 2
    redondo(ctx, x, cy - 10, 20, 20, 6)
    ctx.fillStyle = t.color
    ctx.fill()
    ctx.font = '700 23px Inter, sans-serif'
    ctx.fillStyle = C.suave
    ctx.textAlign = 'right'
    ctx.fillText(String(t.n), x + ancho, cy)
    ctx.textAlign = 'left'
    ctx.fillStyle = t.otros ? '#d5e3ec' : C.blanco
    // Un nombre largo («Mega Lucario Hariyama») encoge un poco antes de
    // cortarse: el nombre del mazo es justo lo que se viene a leer.
    const sitio = ancho - 36 - 44
    let tam = 23
    ctx.font = `600 ${tam}px Inter, sans-serif`
    while (tam > 19 && ctx.measureText(t.nombre).width > sitio) {
      tam -= 1
      ctx.font = `600 ${tam}px Inter, sans-serif`
    }
    const etiqueta = recortar(ctx, t.nombre, sitio)
    ctx.fillText(etiqueta, x + 34, cy)
    if (t.otros) {
      const w = ctx.measureText(etiqueta).width
      ctx.font = '500 18px Inter, sans-serif'
      ctx.fillStyle = C.apagado
      ctx.fillText(`(${t.otros.length} ${t.otros.length === 1 ? 'mazo' : 'mazos'})`, x + 34 + w + 8, cy + 1)
    }
    ctx.fillStyle = 'rgba(191, 220, 236, 0.12)'
    ctx.fillRect(x, y + alto, ancho, 1)
    y += alto
  }
  // Los «otros», con su nombre: en un torneo pequeño, un mazo de una
  // persona puede ser el que ha quedado segundo.
  const otros = trozos.find((t) => t.otros)
  if (otros) {
    ctx.font = '500 15.5px Inter, sans-serif'
    ctx.fillStyle = C.apagado
    const palabras = `Otros: ${otros.otros.join(' · ')}`.split(' ')
    const lineas = ['']
    for (const p of palabras) {
      const prueba = lineas[lineas.length - 1] ? `${lineas[lineas.length - 1]} ${p}` : p
      if (ctx.measureText(prueba).width > ancho && lineas[lineas.length - 1]) lineas.push(p)
      else lineas[lineas.length - 1] = prueba
    }
    const maximo = Math.max(2, Math.floor((900 - y - 24) / 23))
    lineas.slice(0, maximo).forEach((l, i) => {
      const texto = i === maximo - 1 && lineas.length > maximo ? recortar(ctx, `${l}…`, ancho) : l
      ctx.fillText(texto, x, y + 24 + i * 23)
    })
  }
  ctx.restore()
}

function caja(ctx, x, y, w, h) {
  ctx.save()
  redondo(ctx, x, y, w, h, 24)
  ctx.fillStyle = 'rgba(30, 81, 117, 0.45)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(124, 198, 216, 0.25)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

const MEDALLAS = [
  ['#fbedc4', '#f0cf7c', '#3a2c05'],
  ['#eef2f4', '#c3d0d7', '#3a2c05'],
  ['#f3e1d1', '#e6c6a4', '#3a2c05'],
]

function pintarAbajo(ctx, { jugadores, total, top, iconosTop }) {
  const y = 990
  const h = 250
  caja(ctx, 56, y, 300, h)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.blanco
  ctx.font = '700 96px Fredoka, Inter, sans-serif'
  ctx.fillText(String(jugadores), 206, y + 118)
  ctx.fillStyle = C.ambar
  ctx.font = '700 26px Fredoka, Inter, sans-serif'
  ctx.fillText(jugadores === 1 ? 'Jugador' : 'Jugadores', 206, y + 158)
  ctx.fillStyle = C.apagado
  ctx.font = '500 17px Inter, sans-serif'
  ctx.fillText(`${total} ${total === 1 ? 'lista entregada' : 'listas entregadas'}`, 206, y + 190)
  ctx.restore()

  // Sin clasificación no hay top que enseñar: la caja no se pinta vacía.
  if (!top.length) return
  const x = 384
  const w = W - 56 - x
  caja(ctx, x, y, w, h)
  ctx.save()
  ctx.font = '700 18px Inter, sans-serif'
  ctx.letterSpacing = '2.5px'
  ctx.fillStyle = C.hielo
  ctx.textBaseline = 'middle'
  ctx.fillText(`TOP ${top.length}`, x + 26, y + 34)
  ctx.letterSpacing = '0px'
  top.forEach((t, i) => {
    const cy = y + 80 + i * 46
    const [a, b, tinta] = MEDALLAS[i] || ['rgba(191,220,236,.18)', 'rgba(191,220,236,.18)', C.blanco]
    const g = ctx.createLinearGradient(x + 26, cy - 18, x + 62, cy + 18)
    g.addColorStop(0, a)
    g.addColorStop(1, b)
    redondo(ctx, x + 26, cy - 18, 36, 36, 10)
    ctx.fillStyle = g
    ctx.fill()
    ctx.fillStyle = tinta
    ctx.font = '700 19px Fredoka, Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(i + 1), x + 44, cy + 1)
    ctx.textAlign = 'left'
    const icono = iconosTop[i]?.[0]
    let tx = x + 76
    if (icono) {
      pintarIcono(ctx, icono, tx + 20, cy, 40)
      tx += 48
    }
    ctx.font = '500 18px Inter, sans-serif'
    ctx.fillStyle = C.apagado
    ctx.textAlign = 'right'
    const quien = recortar(ctx, t.nombre, 180)
    ctx.fillText(quien, x + w - 26, cy)
    const wq = ctx.measureText(quien).width
    ctx.textAlign = 'left'
    ctx.fillStyle = C.blanco
    ctx.font = '600 22px Inter, sans-serif'
    ctx.fillText(recortar(ctx, t.mazo ? nombreCorto(t.mazo) : 'Sin lista', x + w - 26 - wq - 20 - tx), tx, cy)
  })
  ctx.restore()
}

function pintarPie(ctx, total) {
  ctx.save()
  ctx.fillStyle = 'rgba(9, 15, 22, 0.75)'
  ctx.fillRect(0, H - 84, W, 84)
  ctx.fillStyle = 'rgba(124, 198, 216, 0.18)'
  ctx.fillRect(0, H - 84, W, 1)
  ctx.textBaseline = 'middle'
  ctx.font = '700 30px Fredoka, Inter, sans-serif'
  let x = 56
  for (const [texto, color] of [['Poke', C.blanco], ['Doc', C.hielo], ['.es', C.blanco]]) {
    ctx.fillStyle = color
    ctx.fillText(texto, x, H - 42)
    x += ctx.measureText(texto).width
  }
  ctx.font = '500 17px Inter, sans-serif'
  ctx.fillStyle = C.apagado
  ctx.textAlign = 'right'
  ctx.fillText('Mazos agrupados por su Pokémon principal ·', W - 56, H - 53)
  ctx.fillText(`porcentajes sobre las ${total} listas`, W - 56, H - 31)
  ctx.restore()
}

// datos = { torneo: { nombre, fecha (ISO), rondas, corte, liga }, meta
// (agruparMeta), jugadores, top: [{ nombre, mazo, arq }] }
export async function dibujarImagenMeta(datos) {
  const { trozos, total } = trozosDelMeta(datos.meta)
  try {
    await Promise.all(['700 60px Fredoka', '600 40px Fredoka', '500 26px Inter', '700 25px Inter', '800 104px Inter'].map((f) => document.fonts.load(f)))
  } catch {}
  const [iconos, iconosTop] = await Promise.all([
    Promise.all(trozos.map((t) => (t.arq ? iconosDe(t.arq) : []))),
    Promise.all(datos.top.map((t) => (t.arq ? iconosDe({ ...t.arq, iconos: (t.arq.iconos || []).slice(0, 1) }) : []))),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = W * ESCALA
  canvas.height = H * ESCALA
  const ctx = canvas.getContext('2d')
  ctx.scale(ESCALA, ESCALA)
  const t = datos.torneo
  const fecha = t.fecha ? new Date(t.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const linea = [
    fecha,
    t.liga ? 'Liga' : null,
    // En una liga cada ronda es una jornada, y así se llaman en la ficha.
    t.rondas ? `${t.rondas} ${t.liga ? 'jornada' : 'ronda'}${t.rondas === 1 ? '' : 's'}` : null,
    t.corte ? `top ${t.corte}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  pintarFondo(ctx)
  pintarCabecera(ctx, { nombre: t.nombre || 'Torneo', linea })
  pintarAnillo(ctx, trozos, total, iconos)
  pintarLeyenda(ctx, trozos)
  pintarAbajo(ctx, { jugadores: datos.jugadores, total, top: datos.top, iconosTop })
  pintarPie(ctx, total)
  return canvas
}

export async function descargarImagenMeta(datos) {
  if (!datos?.meta?.arquetipos?.length) {
    showToast('No hay listas con las que hacer la imagen.', 'error')
    return null
  }
  showToast('Preparando la imagen del meta…')
  const canvas = await dibujarImagenMeta(datos)
  let blob
  try {
    blob = await new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('sin imagen'))), 'image/png'))
  } catch {
    showToast('No se ha podido montar la imagen.', 'error')
    return null
  }
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  const nombre = String(datos.torneo?.nombre || 'torneo')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  enlace.download = `meta-${nombre || 'torneo'}.png`
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return canvas
}
