// COMPARTIR UNA NOTICIA (880): la hoja común (871) con el texto para X,
// la portada dibujada en los dos formatos y el botón «Publicar en X».
//
// Antes el botón de compartir de una noticia hacía lo de una guía: la hoja
// del sistema con el título y la dirección, y en el PC copiar el enlace. En
// X eso salía con el enlace pelado. Ahora el texto es título + entradilla
// recortada + enlace (`compartir-x.js`), y la imagen es LA PORTADA con el
// título encima, que es lo que uno sube a una historia o adjunta a mano.
// En X la portada sale sola con el enlace (la tarjeta de `meta-social.js`),
// así que «Publicar en X» abre el cuadro con el texto y el enlace, y X
// pone la foto. Entra por `import()` al pulsar: la ficha no paga nada.
import { medidasDe, fondo } from './reto-imagen.js'
import { cargarImagen } from './imagen-compartir.js'
import { rutaDeArticulo } from './articulos.js'
import { textoParaX, textoConEnlace } from './compartir-x.js'

const TITULAR = 'Fredoka, Inter, sans-serif'
const TEXTO = 'Inter, sans-serif'
const SITIO = 'https://pokedoc.es'

// Parte un texto en líneas que caben en `maxAncho` con la fuente puesta en
// `ctx`; como mucho `maximo` líneas, la última con puntos suspensivos.
export function envolver(ctx, texto, maxAncho, maximo = 3) {
  const palabras = String(texto ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lineas = []
  let linea = ''
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p
    if (ctx.measureText(prueba).width <= maxAncho || !linea) {
      linea = prueba
      continue
    }
    lineas.push(linea)
    linea = p
    if (lineas.length === maximo) break
  }
  if (lineas.length < maximo && linea) lineas.push(linea)
  if (lineas.length === maximo && (palabras.join(' ') !== lineas.join(' '))) {
    let ultima = lineas[maximo - 1]
    while (ultima && ctx.measureText(`${ultima}…`).width > maxAncho) ultima = ultima.replace(/\s*\S+$/, '')
    lineas[maximo - 1] = `${ultima}…`
  }
  return lineas
}

// La foto cubriendo el lienzo entero (recortada por el centro, como un
// `background-size: cover`), y un velo oscuro de abajo arriba para que el
// título se lea encima de cualquier portada.
function portadaDeFondo(ctx, img, W, H) {
  const escala = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const w = img.naturalWidth * escala
  const h = img.naturalHeight * escala
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, 'rgba(13,27,42,0.35)')
  g.addColorStop(0.4, 'rgba(13,27,42,0.05)')
  g.addColorStop(0.62, 'rgba(13,27,42,0.72)')
  g.addColorStop(1, 'rgba(13,27,42,0.96)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// `portada` es una Image ya cargada, o null (sin foto: el degradado de los
// retos y el título en el centro).
export function pintarNoticia(lienzo, { titulo, descripcion = '', portada = null, formato = 'historia' }) {
  const { w: W, h: H } = medidasDe(formato)
  const apaisada = formato === 'apaisada'
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  if (portada) portadaDeFondo(ctx, portada, W, H)
  else fondo(ctx, W, H)
  const margen = apaisada ? 64 : 72
  const ancho = W - margen * 2
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // Arriba a la izquierda, quién lo dice.
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${apaisada ? 26 : 34}px ${TITULAR}`
  ctx.fillText('PokeDoc · Noticias', margen, apaisada ? 64 : 92)

  // Abajo, el título grande y la entradilla; se mide desde el pie hacia
  // arriba para que el bloque quede pegado abajo pase lo que pase.
  const cuerpoTitulo = apaisada ? 52 : 68
  ctx.font = `700 ${cuerpoTitulo}px ${TITULAR}`
  const lineasTitulo = envolver(ctx, titulo, ancho, apaisada ? 3 : 4)
  const cuerpoTexto = apaisada ? 26 : 34
  ctx.font = `500 ${cuerpoTexto}px ${TEXTO}`
  const lineasTexto = descripcion ? envolver(ctx, descripcion, ancho, apaisada ? 2 : 3) : []

  const altoEnlace = apaisada ? 56 : 80
  let y = H - altoEnlace
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `700 ${apaisada ? 24 : 32}px ${TEXTO}`
  ctx.fillText('pokedoc.es/noticias', margen, y)

  y -= apaisada ? 36 : 52
  if (lineasTexto.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `500 ${cuerpoTexto}px ${TEXTO}`
    const paso = Math.round(cuerpoTexto * 1.35)
    y -= paso * (lineasTexto.length - 1)
    lineasTexto.forEach((l, i) => ctx.fillText(l, margen, y + i * paso))
    y -= apaisada ? 28 : 40
  }
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${cuerpoTitulo}px ${TITULAR}`
  const pasoTitulo = Math.round(cuerpoTitulo * 1.15)
  y -= pasoTitulo * (lineasTitulo.length - 1)
  lineasTitulo.forEach((l, i) => ctx.fillText(l, margen, y + i * pasoTitulo))
  return lienzo
}

// Abre la hoja con todo puesto. `guide` es la fila de `guides` que ya tiene
// la ficha (slug, title, description, cover_image).
export async function compartirNoticia(guide) {
  const url = `${SITIO}${rutaDeArticulo('news', guide.slug)}`
  const datos = { titulo: guide.title, descripcion: guide.description || '' }
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  let portada = null
  let portadaPedida = false
  const imagen = async (formato) => {
    if (!portadaPedida) {
      portadaPedida = true
      // Supabase Storage la sirve con permiso de CORS; si no carga (una
      // portada borrada, sin red), se dibuja sin foto en vez de no dibujar.
      if (guide.cover_image) portada = await cargarImagen(guide.cover_image).catch(() => null)
    }
    return pintarNoticia(document.createElement('canvas'), { ...datos, portada, formato })
  }
  return abrirHojaCompartir({
    titulo: 'Compartir la noticia',
    texto: textoConEnlace({ ...datos, url }),
    imagen,
    nombre: `noticia-${guide.slug || 'pokedoc'}`,
    x: { texto: textoParaX(datos), url },
  })
}
