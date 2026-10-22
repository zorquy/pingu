// Las cifras del perfil (743, J4; desde la 867, cinco iguales): cartas,
// guías y torneos aquí, y seguidores y siguiendo ya escritos en el HTML. Las
// mismas en tu perfil y en el que ven los demás, y con UNA definición (la
// 628: si dos pantallas cuentan lo mismo, lo cuenta una función). Pegado a
// «Guías», a cuántos les han servido (974; antes era la media de estrellas):
// es lo que escribes, no una nota puesta a ti. La racha ya no es una cifra: es un estado, y va en la línea
// de la cabecera con el nivel y el rango.
//
// Cada cifra lleva a un sitio: Cartas a tu colección (y a la de otro si la
// tiene pública, 944: `coleccion`), Guías y Torneos a su pestaña. Lo que no se ha
// podido contar sale «—», no un cero (la 319): la RLS de otra persona puede
// no dejar contar su colección o sus torneos, y un cero diría que no tiene
// ninguno.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

// La colección entera de alguien, en la vista con buscador y filtros (944).
export const urlDeColeccion = (username) => `/mi-coleccion?u=${encodeURIComponent(username)}&ver=cartas`

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('es-ES', { useGrouping: 'always' }) : '—')

// Puro: lo prueba node.
export function cifrasHtml({ cartas = null, guias = null, servido = null, torneos = null, propia = false, coleccion = '' } = {}) {
  const conServido = typeof servido === 'number' && servido > 0
  const cifra = (valor, rotulo, { href = '', ver = '', title = '' } = {}) => {
    const dentro = `<span class="valor">${valor}</span><span class="rotulo">${rotulo}</span>`
    const t = title ? ` title="${escapeHtml(title)}"` : ''
    if (href) return `<a class="perfil-cifra" href="${escapeHtml(href)}"${t}>${dentro}</a>`
    if (ver) return `<button type="button" class="perfil-cifra" data-ver="${ver}"${t}>${dentro}</button>`
    return `<div class="perfil-cifra"${t}>${dentro}</div>`
  }
  return (
    cifra(n(cartas), 'Cartas', { href: propia ? '/mi-coleccion' : coleccion }) +
    cifra(`${n(guias)}${conServido ? ` <small class="perfil-cifra-nota">${icons.sprout(12)} ${n(servido)}</small>` : ''}`, 'Guías', {
      ver: 'guides',
      title: conServido ? (servido === 1 ? 'A 1 persona le han servido sus guías' : `A ${n(servido)} personas les han servido sus guías`) : '',
    }) +
    cifra(n(torneos), 'Torneos', { ver: 'torneos' })
  )
}

// Cuántas cartas distintas tiene en su colección y en cuántos torneos se ha
// apuntado. `null` si no se ha podido preguntar.
export async function contarCartasYTorneos(supabase, userId) {
  const cuenta = async (consulta) => {
    try {
      const { count, error } = await consulta
      return error ? null : count ?? null
    } catch {
      return null
    }
  }
  const [cartas, torneos] = await Promise.all([
    cuenta(supabase.from('user_collection').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    cuenta(supabase.from('tournament_registrations').select('tournament_id', { count: 'exact', head: true }).eq('user_id', userId)),
  ])
  return { cartas, torneos }
}
