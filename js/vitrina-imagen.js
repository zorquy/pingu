// La vitrina en una imagen (873): tus seis cartas, para presumir fuera.
// Entra por `import()` desde vitrina.js al pulsar «Compartir».
import { fotoParaElLienzo, dibujarCarta } from './imagen-compartir.js'
import { pintarMarco } from './redes-marco.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'

// Puro: lo que se pega.
export function textoDeVitrina({ cartas = [], usuario = '' }) {
  const lineas = [`🖼️ Mi vitrina en PokeDoc${usuario ? ` (@${usuario})` : ''}`]
  for (const c of cartas) lineas.push(`· ${nombreDeCarta(c)}${nombreDeSet(c.tcg_sets) ? ` (${nombreDeSet(c.tcg_sets)})` : ''}`)
  lineas.push(usuario ? `pokedoc.es/usuario/${usuario}` : 'pokedoc.es')
  return lineas.join('\n')
}

// Desde la 1156, con el marco de redes (`redes-marco.js`): el color de
// Colección, la chapa «Mi vitrina» y las cartas en la caja de en medio, tres
// por fila y tan grandes como quepan. Tres formas: «historia» (la
// publicación), «larga» (la historia de 1080×1920) y «apaisada».
export function pintarVitrina(lienzo, { fotos = [], usuario = '', formato = 'historia' }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'coleccion',
    chapa: 'Mi vitrina',
    titulo: usuario ? `Las favoritas de *@${usuario}*` : 'Mis cartas *favoritas*',
    entradilla: apaisada ? '' : 'Las seis cartas que más me gustan de mi colección.',
    enlace: usuario ? `pokedoc.es/usuario/${usuario}` : 'pokedoc.es',
    linea: formato === 'larga' ? 'Enlace en la bio' : apaisada ? '' : 'Haz la tuya en PokeDoc',
    maxLineas: 2,
  })
  const lista = fotos.slice(0, 6)
  if (!lista.length) return lienzo
  const columnas = Math.min(3, lista.length)
  const filas = Math.ceil(lista.length / columnas)
  const hueco = apaisada ? 14 : 28
  const prop = 342 / 245
  // Tan grandes como quepan a lo ancho Y a lo alto de la caja.
  const w = Math.floor(Math.min((caja.w - hueco * (columnas - 1)) / columnas, (caja.h - hueco * (filas - 1)) / filas / prop))
  const h = Math.round(w * prop)
  const altoTodo = filas * h + (filas - 1) * hueco
  const y0 = caja.y + Math.max(0, (caja.h - altoTodo) / 2)
  // Cada fila centrada con las que tiene: con cuatro cartas no se deja un
  // hueco a la derecha.
  lista.forEach((f, i) => {
    const fila = Math.floor(i / columnas)
    const enFila = Math.min(columnas, lista.length - fila * columnas)
    const x0 = caja.x + (caja.w - (enFila * w + (enFila - 1) * hueco)) / 2
    const x = x0 + (i % columnas) * (w + hueco)
    const y = y0 + fila * (h + hueco)
    dibujarCarta(ctx, f.img, { x, y, w, h, r: Math.round(w / 18), nombre: f.nombre })
  })
  return lienzo
}

export async function compartirVitrina({ cartas = [], usuario = '' }) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  let fotos = null
  return abrirHojaCompartir({
    titulo: 'Mi vitrina',
    texto: textoDeVitrina({ cartas, usuario }),
    nombre: `vitrina${usuario ? `-${usuario}` : ''}`,
    historiaPropia: true,
    imagen: async (formato) => {
      if (!fotos) fotos = await Promise.all(cartas.slice(0, 6).map(async (c) => ({ img: await fotoParaElLienzo(cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, 'high')), nombre: nombreDeCarta(c) })))
      return pintarVitrina(document.createElement('canvas'), { fotos, usuario, formato })
    },
  })
}
