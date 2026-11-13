// LAS IMÁGENES DE LAS PIEZAS DE REDES (tanda 1335): dibujan las diapositivas
// que describe `redes-textos.js`, con el marco común (`redes-marco.js`) — el
// mismo de las noticias desde la 1156, para que todo lo de PokeDoc se vea de
// la misma casa. Cada pintor recibe sus datos y, ya cargadas, sus imágenes.
//
// Tres tamaños, como todo el marco: «historia» (1080×1350, la publicación de
// Instagram, que es la que PINGU descarga), «larga» (1080×1920, la historia)
// y «apaisada» (1200×630).
import { cargarImagen, redondeado } from './imagen-compartir.js'
import { pintarMarco, tarjetaGirada, prepararMarco, TITULAR, TEXTO } from './redes-marco.js'
import { pintarNoticia } from './noticia-compartir.js'

// «2 / 5» en la chapa de abajo cuando es un carrusel: así se ve que sigue.
const pagina = (n, total) => (total > 1 ? `${n} / ${total}` : '')

// Las imágenes que pide una diapositiva (la portada, el cartel, los sprites).
// Una que no carga (sin permiso de CORS, borrada) se queda en null y la
// diapositiva se dibuja sin ella: mejor sin foto que sin imagen.
const cache = new Map()
const cargar = (url) => {
  if (!url) return Promise.resolve(null)
  if (!cache.has(url)) cache.set(url, cargarImagen(url).catch(() => null))
  return cache.get(url)
}

export async function imagenesDe(d) {
  const x = d?.datos || {}
  const [portada, sprites] = await Promise.all([
    cargar(x.portada || x.imagen || null),
    Promise.all((x.sprites || []).slice(0, 3).map(cargar)),
  ])
  return { portada, sprites: sprites.filter(Boolean) }
}

// ── Guías ──
function guiaPortada(lienzo, x, { formato, n, total, portada }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'aprender',
    chapa: 'Guía',
    titulo: x.titulo,
    entradilla: x.descripcion,
    enlace: 'pokedoc.es/aprender',
    linea: apaisada ? '' : total > 1 ? 'Desliza: lo importante, en tres' : formato === 'larga' ? 'Enlace en la bio' : 'La guía entera, en español',
    chapaPie: apaisada ? '' : pagina(n, total) || (x.minutos ? `${x.minutos} min de lectura` : ''),
    maxLineas: portada ? null : apaisada ? 5 : 6,
  })
  if (portada && caja.h > 80) tarjetaGirada(ctx, portada, { ...caja, angulo: apaisada ? 2 : -1.6, borde: apaisada ? 10 : 14 })
}

// Una de lo importante: el número grande en el color de Aprender y el punto
// como título. Sin foto: es texto para leer de un vistazo.
function guiaClave(lienzo, x, { formato, n, total }) {
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'aprender',
    chapa: 'Lo importante',
    titulo: x.punto,
    entradilla: x.detalle || '',
    enlace: 'pokedoc.es/aprender',
    linea: formato === 'apaisada' ? '' : x.titulo,
    chapaPie: formato === 'apaisada' ? '' : pagina(n, total),
    maxLineas: formato === 'apaisada' ? 4 : 5,
  })
  if (caja.h < 60) return
  const cuerpo = Math.min(caja.h * 0.9, formato === 'apaisada' ? 300 : 420)
  ctx.save()
  ctx.font = `800 ${Math.round(cuerpo)}px ${TITULAR}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = formato === 'apaisada' ? 'center' : 'right'
  ctx.globalAlpha = 0.9
  ctx.fillStyle = acento
  const cx = formato === 'apaisada' ? caja.x + caja.w / 2 : caja.x + caja.w
  ctx.fillText(String(x.numero).padStart(2, '0'), cx, caja.y + caja.h - Math.round(cuerpo * 0.06))
  ctx.restore()
}

function guiaCierre(lienzo, x, { formato, n, total, portada }) {
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'aprender',
    chapa: 'Guía',
    titulo: '*Léela entera* en PokeDoc',
    entradilla: x.titulo,
    enlace: 'pokedoc.es/aprender',
    linea: formato === 'apaisada' ? '' : 'Enlace en la bio · gratis y en español',
    chapaPie: formato === 'apaisada' ? '' : pagina(n, total),
  })
  if (portada && caja.h > 80) tarjetaGirada(ctx, portada, { ...caja, angulo: 1.6, borde: 14 })
}

// ── Torneos ──
// Sin cartel, la caja enseña las plazas: es lo que hace que alguien se apunte.
function cajaDePlazas(ctx, caja, acento, x) {
  const w = Math.min(caja.w, 640)
  const h = Math.min(caja.h, 360)
  const x0 = caja.x + (caja.w - w) / 2
  const y0 = caja.y + (caja.h - h) / 2
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.strokeStyle = acento
  ctx.lineWidth = 4
  redondeado(ctx, x0, y0, w, h, 36)
  ctx.fill()
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#9fb3bd'
  ctx.font = `700 ${Math.round(h * 0.1)}px ${TEXTO}`
  const completo = x.quedan === 0
  const sinTope = x.quedan === null || x.quedan === undefined
  ctx.fillText(sinTope ? 'PLAZAS' : completo ? 'YA ESTÁ' : 'QUEDAN', x0 + w / 2, y0 + h * 0.24)
  ctx.fillStyle = completo ? '#ffffff' : acento
  ctx.font = `800 ${Math.round(h * (sinTope || completo ? 0.3 : 0.46))}px ${TITULAR}`
  ctx.fillText(sinTope ? 'Abiertas' : completo ? 'Completo' : String(x.quedan), x0 + w / 2, y0 + h * (sinTope || completo ? 0.66 : 0.72))
  if (!sinTope && !completo) {
    ctx.fillStyle = '#cfe3f1'
    ctx.font = `600 ${Math.round(h * 0.085)}px ${TEXTO}`
    ctx.fillText(`plazas de ${x.maximo}`, x0 + w / 2, y0 + h * 0.9)
  }
  ctx.restore()
}

function torneoAnuncio(lienzo, x, { formato, portada }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'jugar',
    chapa: x.liga ? 'Liga' : x.oficial ? 'Torneo oficial' : 'Torneo',
    titulo: x.titulo,
    entradilla: [x.cuando, x.formato].filter(Boolean).join(' · '),
    enlace: 'pokedoc.es/torneos',
    linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : 'Te apuntas desde la web',
    chapaPie: apaisada ? '' : x.precio ? `Inscripción: ${x.precio}` : x.quedan ? `Quedan ${x.quedan} plazas` : '',
    maxLineas: apaisada ? 3 : 4,
  })
  if (caja.h < 80) return
  if (portada) tarjetaGirada(ctx, portada, { ...caja, angulo: apaisada ? 2 : -1.6, borde: apaisada ? 10 : 14 })
  else cajaDePlazas(ctx, caja, acento, x)
}

// El podio: el segundo a la izquierda, el campeón en medio y más alto, el
// tercero a la derecha; encima del campeón, los Pokémon de su mazo.
function torneoResultados(lienzo, x, { formato, sprites = [] }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'jugar',
    chapa: 'Resultados',
    titulo: `*${x.campeon}* gana`,
    entradilla: x.titulo,
    enlace: 'pokedoc.es/torneos',
    linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : 'Las partidas, en la web',
    chapaPie: apaisada ? '' : x.jugadores ? `${x.jugadores} jugadores` : '',
    maxLineas: 2,
  })
  if (caja.h < 120) return
  const puestos = x.puestos || []
  const orden = [1, 0, 2].filter((i) => puestos[i])
  const hueco = Math.round(caja.w * 0.03)
  const ancho = Math.round((caja.w - hueco * 2) / 3)
  const altoNombre = Math.round(Math.min(44, caja.h * 0.09))
  const espacioSprites = sprites.length ? Math.round(caja.h * 0.24) : 0
  const maxAlto = caja.h - altoNombre * 1.8 - espacioSprites
  const altos = { 0: maxAlto, 1: maxAlto * 0.72, 2: maxAlto * 0.52 }
  const base = caja.y + caja.h
  ctx.save()
  orden.forEach((i, k) => {
    const x0 = caja.x + k * (ancho + hueco) + (puestos.length < 3 && k === 0 && !puestos[1] ? ancho + hueco : 0)
    const h = Math.round(altos[i])
    const y0 = base - h
    ctx.fillStyle = i === 0 ? acento : 'rgba(255,255,255,0.12)'
    redondeado(ctx, x0, y0, ancho, h, 24)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.fillStyle = i === 0 ? '#0b1219' : '#ffffff'
    ctx.font = `800 ${Math.round(Math.min(ancho * 0.42, h * 0.5))}px ${TITULAR}`
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), x0 + ancho / 2, y0 + h / 2)
    // El nombre encima de su escalón, recortado al ancho.
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#ffffff'
    let cuerpo = altoNombre
    ctx.font = `700 ${cuerpo}px ${TEXTO}`
    while (cuerpo > 18 && ctx.measureText(puestos[i]).width > ancho) {
      cuerpo -= 2
      ctx.font = `700 ${cuerpo}px ${TEXTO}`
    }
    let nombre = puestos[i]
    while (nombre.length > 3 && ctx.measureText(nombre).width > ancho) nombre = `${nombre.slice(0, -2)}…`
    ctx.fillText(nombre, x0 + ancho / 2, y0 - Math.round(altoNombre * 0.45))
    if (i === 0 && sprites.length) {
      const lado = Math.min(espacioSprites, Math.round(ancho / Math.max(1, sprites.length)) + 20)
      const total = lado * sprites.length - 20 * (sprites.length - 1)
      sprites.forEach((img, j) => {
        ctx.drawImage(img, x0 + ancho / 2 - total / 2 + j * (lado - 20), y0 - altoNombre * 1.4 - lado, lado, lado)
      })
    }
  })
  ctx.restore()
}

const PINTORES = {
  'guia-portada': guiaPortada,
  'guia-clave': guiaClave,
  'guia-cierre': guiaCierre,
  'torneo-anuncio': torneoAnuncio,
  'torneo-resultados': torneoResultados,
}

// Dibuja la diapositiva `n` (desde 1) de `total` en el tamaño pedido.
export async function pintarDiapositiva(lienzo, d, { formato = 'historia', n = 1, total = 1 } = {}) {
  await prepararMarco()
  const { portada, sprites } = await imagenesDe(d)
  if (d.pintor === 'noticia') return pintarNoticia(lienzo, { ...d.datos, portada, formato, fecha: d.datos.fecha })
  const pintor = PINTORES[d.pintor]
  if (!pintor) throw new Error(`No hay pintor para «${d.pintor}»`)
  pintor(lienzo, d.datos, { formato, n, total, portada, sprites })
  return lienzo
}

// Todas las de una pieza, en orden, en un tamaño.
export async function lienzosDePieza(pieza, formato = 'historia', doc = document) {
  const total = pieza.diapositivas.length
  const lienzos = []
  for (let i = 0; i < total; i++) lienzos.push(await pintarDiapositiva(doc.createElement('canvas'), pieza.diapositivas[i], { formato, n: i + 1, total }))
  return lienzos
}
