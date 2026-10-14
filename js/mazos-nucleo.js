// Lo puro de /mazos (836): el color, el reparto, la chapa de estado, el
// récord y el orden. Aparte para que las pruebas lo importen sin la página.
import { categoriaDe } from './constructor/nucleo.js'

// El tipo del mazo, para el color de la portada: el de la portada si es un
// Pokémon, y si no, el del Pokémon con más copias.
export function tipoDelMazo(entradas, portada) {
  if (portada && categoriaDe(portada) === 'P' && portada.types?.[0]) return portada.types[0]
  const pk = entradas.filter((e) => categoriaDe(e.carta) === 'P' && e.carta.types?.[0]).sort((a, b) => b.n - a.n)
  return pk[0]?.carta.types[0] || null
}

// Cuántas de cada clase (puro): para la barra de Pokémon/Entrenadores/Energías.
export function reparto(entradas) {
  const r = { P: 0, T: 0, E: 0 }
  for (const e of entradas) {
    const k = categoriaDe(e.carta)
    if (k in r) r[k] += e.n
  }
  return r
}

// La chapa de estado (puro). Mientras no tenga 60 no se habla de legal: se
// dice lo que falta o lo que sobra, que es lo que hay que arreglar.
export function estadoDelMazo(total, problemas, formato) {
  if (total < 60) return { clase: 'aviso', texto: `Faltan ${60 - total} para 60` }
  if (total > 60) return { clase: 'mal', texto: `Sobran ${total - 60}` }
  if (problemas.length) return { clase: 'mal', texto: '60/60 · revisar' }
  return { clase: 'ok', texto: formato === 'libre' ? '60/60' : '60/60 · legal' }
}

export function textoDeRecord(r) {
  if (!r) return ''
  const { win = 0, loss = 0, draw = 0 } = r
  return draw ? `${win}-${loss}-${draw}` : `${win}-${loss}`
}

// Primero el que más juegas; los que no tienen partidas, por el último que tocaste.
export function ordenarMazos(lista, recs) {
  const jugadas = (m) => { const r = recs.get(m.id); return r ? (r.win || 0) + (r.loss || 0) + (r.draw || 0) : 0 }
  return [...lista].sort((a, b) => jugadas(b) - jugadas(a) || Date.parse(b.updated_at) - Date.parse(a.updated_at))
}
