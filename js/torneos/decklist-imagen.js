// Bajar una decklist como imagen PNG.
//
// Tanda 421: TODAS LAS CARTAS JUNTAS en una sola rejilla y con el FONDO
// TRANSPARENTE, como la de Limitless (PINGU: «que salgan todas las cartas
// juntas, con el toque de PokeDoc y con el fondo transparente, y así
// podamos importar una lista mediante la imagen»). Las copias van en el
// hexágono azul de la casa (js/insignia-copias.js), donde Limitless pone
// el suyo rojo, y debajo de las cartas una franja con la marca, el nombre
// del mazo y pokedoc.es.
//
// Y se puede IMPORTAR en el constructor de dos maneras:
//   · exacta: el PNG lleva la lista en texto dentro (js/lista-en-png.js);
//   · si la imagen se ha recomprimido por el camino (una red social), por
//     cómo se ve: las cartas son los escaneos de Limitless —los mismos de
//     los que salen las huellas del reconocimiento— y el lector sabe leer
//     el hexágono azul.
//
// Las cartas son las MISMAS que enseña la rejilla de la página
// (js/lista-canonica.js): la impresión de rareza más baja de su colección
// y una casilla por carta.
//
// Un canvas solo se puede guardar si TODAS sus imágenes traen permiso
// (CORS): las de Limitless no lo traen, así que se piden a /escaneo, que
// las sirve desde nuestro dominio (netlify/functions/escaneo.mjs); las de
// TCGdex y pokemontcg.io sí, y quedan de respaldo. Una carta que no llega
// por ningún lado se pinta como una caja con su nombre: la imagen sale
// igual.
//
// Vive SUELTO de decklist-export.js (tanda 358): esto no pinta ni una
// clase de CSS, y el constructor de mazos lo usa desde una página que no
// carga torneos.css.
import { showToast } from '../toast.js'
import { cardImageUrl } from '../tcgdex.js'
import { letraDeEnergiaBasica, LETRAS_DE_ENERGIA } from '../imagen-carta.js'
import { dibujarInsignia, cargarLetraInsignia } from '../insignia-copias.js'
import { meterLista } from '../lista-en-png.js'

const SECCIONES = [
  { campo: 'pokemon', titulo: 'Pokémon', cabecera: 'Pokémon' },
  { campo: 'trainer', titulo: 'Entrenadores', cabecera: 'Trainer' },
  { campo: 'energy', titulo: 'Energías', cabecera: 'Energy' },
]

// La paleta de la casa, escrita aquí porque un canvas no lee variables de
// CSS. Son los tokens fijos de style.css (los que no cambian con el tema).
const COLOR = {
  fondoArriba: '#1e5175', // --navy-solid
  fondoAbajo: '#163d59', // --navy-solid-dark
  hielo: '#7cc6d8',
  textoSuave: '#bfdcec',
  blanco: '#ffffff',
  caja: '#2a6b96', // --navy-solid-light
}

// Las medidas, en píxeles «de diseño»: la imagen sale al doble.
const CARTA_W = 150
const CARTA_H = Math.round((CARTA_W * 342) / 245)
const HUECO = 12
const MARGEN = 24
const FRANJA = 76 // la de la marca, debajo de las cartas
const ESCALA = 2

// Las direcciones de donde se intenta sacar cada carta, de mejor a peor,
// y TODAS se pueden pintar en un canvas sin mancharlo. Primero Limitless
// (por /escaneo): son las mismas imágenes de las que salen las huellas
// del reconocimiento, así que una imagen exportada se reconoce mejor al
// importarla. Después TCGdex, que no pasa por nuestra función.
export function fuentesDeCarta(linea) {
  const letra = letraDeEnergiaBasica(linea?.name)
  if (letra) {
    const i = LETRAS_DE_ENERGIA.indexOf(letra)
    return [`/escaneo/MEE/${9 + i}`, `https://images.pokemontcg.io/sve/${i + 1}.png`]
  }
  const fuentes = []
  if (linea?.set && linea?.number) fuentes.push(`/escaneo/${encodeURIComponent(String(linea.set).toUpperCase())}/${encodeURIComponent(String(linea.number).replace(/^0+(?=\d)/, ''))}`)
  if (linea?.carta?.image_path) fuentes.push(cardImageUrl(linea.carta.image_path, 'low'))
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

// El nombre de una carta sin imagen, en tres líneas como mucho.
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
  // Sombra suave: sobre fondo transparente separa la carta de lo que
  // haya detrás, sea claro u oscuro.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
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
    nombreEnCaja(ctx, linea.name, x + CARTA_W / 2, y + CARTA_H / 2 - 30, CARTA_W - 16)
    ctx.textAlign = 'left'
  }
  ctx.restore()
  dibujarInsignia(ctx, linea.quantity, x, y, CARTA_W, CARTA_H)
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
  ctx.fillStyle = COLOR.fondoArriba
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
  const ancho = 48 + w + ctx.measureText('Doc').width
  ctx.restore()
  return ancho
}

// Las cartas en el orden de la lista (Pokémon, entrenadores, energías)
// y cuántas por fila: tres filas para una lista normal, como Limitless
// (24 cartas distintas → 8 por fila), entre 6 y 10; y luego repartidas a
// partes iguales, para que no quede una carta sola en la última fila
// (siete cartas van 4 + 3 y no 6 + 1).
export function medidas(porSeccion) {
  const cartas = SECCIONES.flatMap((s) => porSeccion?.[s.campo] || [])
  const n = cartas.length
  const tope = Math.max(1, Math.min(10, Math.max(Math.min(n, 6), Math.ceil(n / 3))))
  const filas = Math.max(1, Math.ceil(n / tope))
  const columnas = Math.max(1, Math.ceil(n / filas))
  const ancho = MARGEN * 2 + columnas * CARTA_W + (columnas - 1) * HUECO
  const alto = MARGEN + filas * CARTA_H + (filas - 1) * HUECO + 20 + FRANJA + MARGEN
  return { cartas, columnas, filas, ancho, alto }
}

// La lista en el formato de TCG Live, que es el que lee el importador.
export function textoDeLista(porSeccion) {
  return SECCIONES.map((s) => {
    const lineas = porSeccion?.[s.campo] || []
    if (!lineas.length) return ''
    const n = lineas.reduce((m, l) => m + (Number(l.quantity) || 0), 0)
    return [`${s.cabecera}: ${n}`, ...lineas.map((l) => [l.quantity, l.name, l.set, l.number].filter((x) => x !== undefined && x !== null && x !== '').join(' '))].join('\n')
  })
    .filter(Boolean)
    .join('\n\n')
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
  const { cartas, columnas, ancho, alto } = medidas(porSeccion)

  // Las letras tienen que estar cargadas ANTES de dibujar: un canvas no
  // espera a una fuente, pinta con la de respaldo y ya no cambia.
  try {
    await Promise.all(['700 26px Fredoka', '600 14px Inter', '500 16px Inter'].map((f) => document.fonts.load(f)))
  } catch {}
  await cargarLetraInsignia()

  // Las imágenes, todas a la vez.
  const imagenes = await Promise.all(cartas.map((l) => primeraQueLlegue(fuentesDeCarta(l))))

  const canvas = document.createElement('canvas')
  canvas.width = ancho * ESCALA
  canvas.height = alto * ESCALA
  const ctx = canvas.getContext('2d')
  ctx.scale(ESCALA, ESCALA)
  // Sin fondo: transparente, para ponerla encima de lo que se quiera.

  cartas.forEach((l, i) => {
    const fila = Math.floor(i / columnas)
    const col = i % columnas
    dibujarCarta(ctx, l, imagenes[i], MARGEN + col * (CARTA_W + HUECO), MARGEN + fila * (CARTA_H + HUECO))
  })

  // La franja de la casa, debajo de las cartas: la marca, el nombre del
  // mazo con su resumen y la dirección.
  const fy = alto - MARGEN - FRANJA
  const fw = ancho - MARGEN * 2
  ctx.save()
  rectanguloRedondo(ctx, MARGEN, fy, fw, FRANJA, 18)
  const fondo = ctx.createLinearGradient(0, fy, 0, fy + FRANJA)
  fondo.addColorStop(0, COLOR.fondoArriba)
  fondo.addColorStop(1, COLOR.fondoAbajo)
  ctx.fillStyle = fondo
  ctx.fill()
  ctx.restore()
  const marca = dibujarMarca(ctx, MARGEN + 20, fy + FRANJA / 2 - 18)
  ctx.save()
  ctx.font = '600 16px Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'right'
  ctx.fillStyle = COLOR.hielo
  const web = 'pokedoc.es'
  ctx.fillText(web, MARGEN + fw - 22, fy + FRANJA / 2)
  const anchoWeb = ctx.measureText(web).width
  ctx.textAlign = 'left'
  const x0 = MARGEN + 20 + marca + 28
  const libre = MARGEN + fw - 22 - anchoWeb - 24 - x0
  const total = cartas.reduce((m, l) => m + (Number(l.quantity) || 0), 0)
  const resumen = [
    `${total} cartas`,
    ...SECCIONES.map((s) => `${(porSeccion?.[s.campo] || []).reduce((m, l) => m + (Number(l.quantity) || 0), 0)} ${s.titulo.toLowerCase()}`),
    subtitulo,
  ].filter(Boolean)
  ctx.fillStyle = COLOR.blanco
  ctx.font = '700 22px Fredoka, Inter, system-ui, sans-serif'
  ctx.fillText(recortar(ctx, nombre || 'Mazo', libre), x0, fy + FRANJA / 2 - 12)
  ctx.fillStyle = COLOR.textoSuave
  ctx.font = '500 14px Inter, system-ui, sans-serif'
  ctx.fillText(recortar(ctx, resumen.join(' · '), libre), x0, fy + FRANJA / 2 + 14)
  ctx.restore()

  let blob
  try {
    blob = await new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('sin imagen'))), 'image/png'))
  } catch {
    // Una imagen sin permiso se ha colado y el canvas no se deja guardar.
    showToast('No se ha podido montar la imagen. Prueba a copiar la lista.', 'error')
    return
  }
  // La lista va DENTRO del PNG: el constructor la lee al importar la
  // imagen, y entonces la importación es exacta (js/lista-en-png.js).
  const bytes = meterLista(new Uint8Array(await blob.arrayBuffer()), textoDeLista(porSeccion))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `mazo-${String(nombre).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'pokedoc'}.png`
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  return canvas
}
