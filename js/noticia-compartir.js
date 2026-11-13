// COMPARTIR UNA NOTICIA (880; con el marco de redes desde la 1156): la hoja
// común (871) con el texto para X, la noticia dibujada en los tres tamaños y
// el botón «Publicar en X».
//
// El texto es título + entradilla recortada + enlace (`compartir-x.js`). La
// imagen, desde la 1156, es la del marco común (`redes-marco.js`): la marca
// arriba con la chapa NOTICIA, el título, la entradilla, la portada en una
// tarjeta y la dirección abajo; antes era la portada con el título encima y
// sin logo. En X la tarjeta del enlace la pone `meta-social.js`, así que
// «Publicar en X» abre el cuadro con el texto y el enlace. Entra por
// `import()` al pulsar: la ficha no paga nada.
import { cargarImagen } from './imagen-compartir.js'
import { rutaDeArticulo } from './articulos.js'
import { textoParaX, textoConEnlace } from './compartir-x.js'
import { pintarMarco, tarjetaGirada, prepararMarco } from './redes-marco.js'

const SITIO = 'https://pokedoc.es'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaCorta = (iso) => {
  const d = new Date(iso || '')
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

// EL MARCO DE LA 1156: la noticia con la marca y la chapa NOTICIA arriba, el
// título en grande, la entradilla, la portada en una tarjeta blanca girada en
// medio y la dirección abajo. En los tres tamaños: «historia» (la
// publicación), «larga» (la historia de 1080×1920, que antes montaba la hoja
// con la publicación encima de sí misma desenfocada) y «apaisada».
// `portada` es una Image ya cargada, o null (sin foto: solo el texto).
export function pintarNoticia(lienzo, { titulo, descripcion = '', portada = null, formato = 'historia', fecha = '' }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'noticias',
    chapa: 'Noticia',
    titulo,
    entradilla: descripcion,
    enlace: 'pokedoc.es/noticias',
    linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : 'La noticia entera, en español',
    chapaPie: apaisada ? '' : fechaCorta(fecha),
    maxLineas: portada ? null : apaisada ? 5 : 6,
  })
  if (portada && caja.h > 80) tarjetaGirada(ctx, portada, { x: caja.x, y: caja.y, w: caja.w, h: caja.h, angulo: apaisada ? 2 : -1.6, borde: apaisada ? 10 : 14 })
  return lienzo
}

// Abre la hoja con todo puesto. `guide` es la fila de `guides` que ya tiene
// la ficha (slug, title, description, cover_image).
export async function compartirNoticia(guide) {
  const url = `${SITIO}${rutaDeArticulo('news', guide.slug)}`
  const datos = { titulo: guide.title, descripcion: guide.description || '', fecha: guide.published_at || '' }
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  let portada = null
  let portadaPedida = false
  const imagen = async (formato) => {
    await prepararMarco()
    if (!portadaPedida) {
      portadaPedida = true
      // Supabase Storage la sirve con permiso de CORS; si no carga (una
      // portada borrada, sin red), se dibuja sin foto en vez de no dibujar.
      if (guide.cover_image) portada = await cargarImagen(guide.cover_image).catch(() => null)
    }
    return pintarNoticia(document.createElement('canvas'), { ...datos, portada, formato })
  }
  return abrirHojaCompartir({
    invitar: false, // (1327) ya es una invitación, o es de PokeDoc y no de quien la comparte
    titulo: 'Compartir la noticia',
    texto: textoConEnlace({ ...datos, url }),
    imagen,
    nombre: `noticia-${guide.slug || 'pokedoc'}`,
    historiaPropia: true,
    x: { texto: textoParaX(datos), url },
  })
}

// LA TARJETA DEL ENLACE (1157, R3): la apaisada del marco, en JPEG, para que
// al pegar el enlace de una noticia en X, WhatsApp o Telegram salga con la
// marca y no la portada pelada. La dibuja el editor al publicar (aquí, en el
// navegador: el servidor no tiene lienzo ni letras) y `meta-social.js` la
// pone de `og:image`. Devuelve un Blob, o null si no se puede (una portada
// sin permiso de CORS deja el lienzo «manchado» y no se exporta: entonces se
// dibuja sin foto antes que no tener tarjeta).
export async function tarjetaDeEnlace(guia) {
  await prepararMarco()
  const datos = { titulo: guia.title || '', descripcion: guia.description || '', fecha: guia.published_at || '', formato: 'apaisada' }
  const portada = guia.cover_image ? await cargarImagen(guia.cover_image).catch(() => null) : null
  const aBlob = (lienzo) => new Promise((res) => {
    try { lienzo.toBlob((b) => res(b), 'image/jpeg', 0.9) } catch { res(null) }
  })
  return (await aBlob(pintarNoticia(document.createElement('canvas'), { ...datos, portada })))
    || (portada ? aBlob(pintarNoticia(document.createElement('canvas'), { ...datos, portada: null })) : null)
}

// ¿Hay que rehacerla? Solo si cambia lo que se ve en ella, o no la hay.
export function tarjetaCaducada(antes, ahora) {
  if (!antes?.og_image) return true
  return ['title', 'description', 'cover_image'].some((k) => (antes?.[k] || '') !== (ahora?.[k] || ''))
}
