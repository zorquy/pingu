// La vitrina en una imagen (873): tus seis cartas, para presumir fuera.
// Entra por `import()` desde vitrina.js al pulsar «Compartir».
import { fondo, medidasDe } from './reto-imagen.js'
import { fotoParaElLienzo, dibujarCarta } from './imagen-compartir.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'

const TITULAR = 'Fredoka, Inter, sans-serif'
const TEXTO = 'Inter, sans-serif'

// Puro: lo que se pega.
export function textoDeVitrina({ cartas = [], usuario = '' }) {
  const lineas = [`🖼️ Mi vitrina en PokeDoc${usuario ? ` (@${usuario})` : ''}`]
  for (const c of cartas) lineas.push(`· ${nombreDeCarta(c)}${nombreDeSet(c.tcg_sets) ? ` (${nombreDeSet(c.tcg_sets)})` : ''}`)
  lineas.push(usuario ? `pokedoc.es/usuario/${usuario}` : 'pokedoc.es')
  return lineas.join('\n')
}

// Historia: tres columnas y dos filas; apaisada: las seis en una fila.
export function pintarVitrina(lienzo, { fotos = [], usuario = '', formato = 'historia' }) {
  const { w: W, h: H } = medidasDe(formato)
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  fondo(ctx, W, H)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  const apaisada = formato === 'apaisada'
  ctx.font = `700 ${apaisada ? 30 : 44}px ${TITULAR}`
  ctx.fillText('PokeDoc · vitrina', W / 2, apaisada ? 64 : 110)
  ctx.font = `700 ${apaisada ? 40 : 64}px ${TITULAR}`
  ctx.fillText(usuario ? `@${usuario}` : 'Mi vitrina', W / 2, apaisada ? 118 : 200)
  const columnas = apaisada ? 6 : 3
  const hueco = apaisada ? 20 : 30
  const w = apaisada ? 150 : 300
  const h = Math.round((w * 342) / 245)
  const lista = fotos.slice(0, 6)
  const y0 = apaisada ? 150 : 270
  // Cada fila centrada con las que tiene: con tres cartas no se dejan tres
  // huecos a la derecha.
  lista.forEach((f, i) => {
    const fila = Math.floor(i / columnas)
    const enFila = Math.min(columnas, lista.length - fila * columnas)
    const x0 = (W - (enFila * w + (enFila - 1) * hueco)) / 2
    const x = x0 + (i % columnas) * (w + hueco)
    const y = y0 + fila * (h + hueco)
    dibujarCarta(ctx, f.img, { x, y, w, h, r: apaisada ? 10 : 16, nombre: f.nombre })
  })
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `700 ${apaisada ? 28 : 40}px ${TEXTO}`
  ctx.fillText(usuario ? `pokedoc.es/usuario/${usuario}` : 'pokedoc.es', W / 2, H - (apaisada ? 40 : 80))
  return lienzo
}

export async function compartirVitrina({ cartas = [], usuario = '' }) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  let fotos = null
  return abrirHojaCompartir({
    titulo: 'Mi vitrina',
    texto: textoDeVitrina({ cartas, usuario }),
    nombre: `vitrina${usuario ? `-${usuario}` : ''}`,
    imagen: async (formato) => {
      if (!fotos) fotos = await Promise.all(cartas.slice(0, 6).map(async (c) => ({ img: await fotoParaElLienzo(cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, 'high')), nombre: nombreDeCarta(c) })))
      return pintarVitrina(document.createElement('canvas'), { fotos, usuario, formato })
    },
  })
}
