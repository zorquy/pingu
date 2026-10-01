// Bajar una decklist como imagen PNG.
//
// Desde la tanda 413, con las CARTAS, como la de Limitless (PINGU: «que
// la imagen que te exportas sea estilo Limitless pero con el toque de
// PokeDoc»): la rejilla de cartas con sus copias, por secciones, sobre el
// azul de la casa, con el nombre del mazo arriba y pokedoc.es abajo. La de
// antes (tanda 219) era una lista de texto: servía para leerla, no para
// compartirla.
//
// Las cartas son las MISMAS que enseña la rejilla de la página
// (js/lista-canonica.js): la impresión de rareza más baja de su colección
// y una casilla por carta.
//
// Se dibuja a mano en un canvas, sin librerías. Y un canvas solo se puede
// guardar si TODAS sus imágenes traen permiso (CORS): las de TCGdex y las
// de pokemontcg.io lo traen; las de Limitless no, así que esas se piden a
// /escaneo, que las sirve desde nuestro dominio
// (netlify/functions/escaneo.mjs). Una carta que no llega por ningún lado
// se pinta como una caja con su nombre: la imagen sale igual.
//
// Vive SUELTO de decklist-export.js (tanda 358): esto no pinta ni una
// clase de CSS, y el constructor de mazos lo usa desde una página que no
// carga torneos.css.
import { showToast } from '../toast.js'
import { cardImageUrl } from '../tcgdex.js'
import { letraDeEnergiaBasica, LETRAS_DE_ENERGIA } from '../imagen-carta.js'

const SECCIONES = [
  { campo: 'pokemon', titulo: 'Pokémon' },
  { campo: 'trainer', titulo: 'Entrenadores' },
  { campo: 'energy', titulo: 'Energías' },
]

// La paleta de la casa, escrita aquí porque un canvas no lee variables de
// CSS. Son los tokens fijos de style.css (los que no cambian con el tema).
const COLOR = {
  fondoArriba: '#163d59', // --navy-solid-dark
  fondoAbajo: '#1e5175', // --navy-solid
  hielo: '#7cc6d8',
  textoSuave: '#bfdcec',
  blanco: '#ffffff',
  ambar: '#e0b252',
  ambarOscuro: '#c8720a',
  caja: '#2a6b96', // --navy-solid-light
}

const ANCHO = 1200
const MARGEN = 40
const COLUMNAS = 9
const HUECO = 12
const CARTA_W = Math.floor((ANCHO - MARGEN * 2 - HUECO * (COLUMNAS - 1)) / COLUMNAS)
const CARTA_H = Math.round((CARTA_W * 342) / 245)

// Las direcciones de donde se intenta sacar cada carta, de mejor a peor,
// y TODAS se pueden pintar en un canvas sin mancharlo.
export function fuentesDeCarta(linea) {
  const letra = letraDeEnergiaBasica(linea?.name)
  if (letra) {
    const i = LETRAS_DE_ENERGIA.indexOf(letra)
    return [`https://images.pokemontcg.io/sve/${i + 1}.png`, `/escaneo/MEE/${9 + i}`]
  }
  const fuentes = []
  if (linea?.carta?.exacta && linea.carta.image_path) fuentes.push(cardImageUrl(linea.carta.image_path, 'low'))
  if (linea?.set && linea?.number) fuentes.push(`/escaneo/${encodeURIComponent(String(linea.set).toUpperCase())}/${encodeURIComponent(String(linea.number).replace(/^0+(?=\d)/, ''))}`)
  if (linea?.carta?.image_path && !linea.carta.exacta) fuentes.push(cardImageUrl(linea.carta.image_path, 'low'))
  return [...new Set(fuentes.filter(Boolean))]
}

function cargarImagen(url) {
  return new Promise((resolver) => {
    const img = new Image()
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

async function primeraQueLlegue(fuentes) {
  for (const url of fuentes) {
    const img = await cargarImagen(url)
    if (img) return img
  }
  return null
}

function rectanguloRedondo(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Un texto que no cabe se corta con «…» en vez de salirse de su sitio.
function recortar(ctx, texto, ancho) {
  let t = String(texto)
  if (ctx.measureText(t).width <= ancho) return t
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

// El nombre de una carta sin imagen, en dos líneas como mucho.
function nombreEnCaja(ctx, nombre, x, y, w) {
  const palabras = String(nombre).split(/\s+/)
  const lineas = ['']
  for (const p of palabras) {
    const prueba = lineas[lineas.length - 1] ? `${lineas[lineas.length - 1]} ${p}` : p
    if (ctx.measureText(prueba).width > w && lineas[lineas.length - 1]) lineas.push(p)
    else lineas[lineas.length - 1] = prueba
  }
  lineas.slice(0, 3).forEach((l, i) => ctx.fillText(recortar(ctx, l, w), x, y + i * 18))
}

function dibujarCarta(ctx, linea, img, x, y) {
  ctx.save()
  rectanguloRedondo(ctx, x, y, CARTA_W, CARTA_H, 8)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  ctx.fillStyle = COLOR.caja
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.clip()
  if (img) {
    ctx.drawImage(img, x, y, CARTA_W, CARTA_H)
  } else {
    ctx.fillStyle = COLOR.blanco
    ctx.font = '600 14px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    nombreEnCaja(ctx, linea.name, x + CARTA_W / 2, y + CARTA_H / 2 - 12, CARTA_W - 16)
    ctx.textAlign = 'left'
  }
  ctx.restore()

  // Las copias, en la esquina de abajo: la pastilla ámbar de la casa, en
  // el sitio donde Limitless pone su hexágono rojo.
  const r = 19
  const cx = x + CARTA_W - r - 4
  const cy = y + CARTA_H - r - 4
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  g.addColorStop(0, COLOR.ambar)
  g.addColorStop(1, COLOR.ambarOscuro)
  ctx.fillStyle = g
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
  ctx.shadowBlur = 6
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 3
  ctx.strokeStyle = COLOR.blanco
  ctx.stroke()
  ctx.fillStyle = COLOR.blanco
  ctx.font = '800 18px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(linea.quantity), cx, cy + 1)
  ctx.restore()
}

// La marca: el cuadrado girado del favicon, en blanco sobre el azul, y
// «PokeDoc» al lado como en la barra de la web.
function dibujarMarca(ctx, x, y) {
  ctx.save()
  ctx.translate(x + 18, y + 18)
  ctx.rotate((-6 * Math.PI) / 180)
  rectanguloRedondo(ctx, -18, -18, 36, 36, 10)
  ctx.fillStyle = COLOR.blanco
  ctx.fill()
  ctx.fillStyle = COLOR.fondoAbajo
  ctx.font = '800 22px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('P', 0, 1)
  ctx.restore()
  ctx.save()
  ctx.font = '700 26px Fredoka, Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLOR.blanco
  ctx.fillText('Poke', x + 48, y + 19)
  const w = ctx.measureText('Poke').width
  ctx.fillStyle = COLOR.hielo
  ctx.fillText('Doc', x + 48 + w, y + 19)
  ctx.restore()
}

// Cuánto mide la imagen, sección a sección, antes de dibujar nada.
export function medidas(porSeccion) {
  const secciones = SECCIONES.map((s) => ({ ...s, lineas: porSeccion?.[s.campo] || [] })).filter((s) => s.lineas.length)
  let alto = 190 // la cabecera
  for (const s of secciones) alto += 40 + Math.ceil(s.lineas.length / COLUMNAS) * (CARTA_H + HUECO)
  alto += 70 // el pie
  return { secciones, alto }
}

export async function descargarImagenDecklist(nombre, parsed, { subtitulo = '' } = {}) {
  if (!SECCIONES.some((s) => parsed?.[s.campo]?.length)) {
    showToast('No hay lista que exportar.', 'error')
    return
  }
  showToast('Preparando la imagen…')
  let porSeccion
  try {
    const { listaParaEnsenar } = await import('../lista-canonica.js')
    porSeccion = (await listaParaEnsenar(parsed)).porSeccion
  } catch {
    // Sin base no se elige impresión: se dibuja la lista tal cual viene.
    porSeccion = parsed
  }
  const { secciones, alto } = medidas(porSeccion)

  // Las letras tienen que estar cargadas ANTES de dibujar: un canvas no
  // espera a una fuente, pinta con la de respaldo y ya no cambia.
  try {
    await Promise.all(['700 26px Fredoka', '700 40px Fredoka', '800 18px Inter', '600 14px Inter'].map((f) => document.fonts.load(f)))
  } catch {}

  // Las imágenes, todas a la vez.
  const imagenes = new Map()
  await Promise.all(
    secciones.flatMap((s) => s.lineas).map(async (l) => imagenes.set(l, await primeraQueLlegue(fuentesDeCarta(l))))
  )

  const canvas = document.createElement('canvas')
  const escala = 2 // nítido también en pantallas retina
  canvas.width = ANCHO * escala
  canvas.height = alto * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)

  // El fondo: el azul de la cabecera de los torneos, con su trama de
  // puntos arriba.
  const fondo = ctx.createLinearGradient(0, 0, 0, alto)
  fondo.addColorStop(0, COLOR.fondoArriba)
  fondo.addColorStop(1, COLOR.fondoAbajo)
  ctx.fillStyle = fondo
  ctx.fillRect(0, 0, ANCHO, alto)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
  for (let y = 12; y < 170; y += 16) for (let x = 12; x < ANCHO; x += 16) ctx.fillRect(x, y, 2, 2)

  dibujarMarca(ctx, MARGEN, 32)
  const total = secciones.reduce((n, s) => n + s.lineas.reduce((m, l) => m + l.quantity, 0), 0)
  ctx.fillStyle = COLOR.blanco
  ctx.font = '700 40px Fredoka, Inter, system-ui, sans-serif'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(recortar(ctx, nombre || 'Mazo', ANCHO - MARGEN * 2), MARGEN, 124)
  ctx.fillStyle = COLOR.textoSuave
  ctx.font = '500 18px Inter, system-ui, sans-serif'
  const resumen = [
    `${total} cartas`,
    ...secciones.map((s) => `${s.lineas.reduce((m, l) => m + l.quantity, 0)} ${s.titulo.toLowerCase()}`),
    subtitulo,
  ].filter(Boolean)
  ctx.fillText(recortar(ctx, resumen.join(' · '), ANCHO - MARGEN * 2), MARGEN, 156)

  let y = 190
  for (const s of secciones) {
    const cuantas = s.lineas.reduce((m, l) => m + l.quantity, 0)
    ctx.fillStyle = COLOR.hielo
    ctx.font = '700 15px Inter, system-ui, sans-serif'
    ctx.fillText(`${s.titulo.toUpperCase()}  ${cuantas}`, MARGEN, y + 24)
    y += 40
    s.lineas.forEach((l, i) => {
      const fila = Math.floor(i / COLUMNAS)
      const col = i % COLUMNAS
      dibujarCarta(ctx, l, imagenes.get(l), MARGEN + col * (CARTA_W + HUECO), y + fila * (CARTA_H + HUECO))
    })
    y += Math.ceil(s.lineas.length / COLUMNAS) * (CARTA_H + HUECO)
  }

  // El pie.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.fillRect(MARGEN, alto - 58, ANCHO - MARGEN * 2, 1)
  ctx.fillStyle = COLOR.blanco
  ctx.font = '700 20px Fredoka, Inter, system-ui, sans-serif'
  ctx.fillText('pokedoc.es', MARGEN, alto - 24)
  ctx.fillStyle = COLOR.textoSuave
  ctx.font = '500 14px Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('La comunidad española de Pokémon TCG', ANCHO - MARGEN, alto - 25)
  ctx.textAlign = 'left'

  let datos
  try {
    datos = canvas.toDataURL('image/png')
  } catch {
    // Una imagen sin permiso se ha colado y el canvas no se deja guardar.
    showToast('No se ha podido montar la imagen. Prueba a copiar la lista.', 'error')
    return
  }
  const enlace = document.createElement('a')
  enlace.href = datos
  enlace.download = `mazo-${String(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'pokedoc'}.png`
  enlace.click()
  return canvas
}
