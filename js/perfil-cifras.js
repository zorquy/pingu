// Las cifras del perfil (743, J4; desde la 867, cinco iguales): cartas,
// guías y torneos aquí, y seguidores y siguiendo ya escritos en el HTML. Las
// mismas en tu perfil y en el que ven los demás, y con UNA definición (la
// 628: si dos pantallas cuentan lo mismo, lo cuenta una función). La nota de
// tus guías va pegada a «Guías»: es la de lo que escribes, no una nota
// puesta a ti. La racha ya no es una cifra: es un estado, y va en la línea
// de la cabecera con el nivel y el rango.
//
// Cada cifra lleva a un sitio: Cartas a tu colección (solo en la tuya: la de
// otro no se puede abrir), Guías y Torneos a su pestaña. Lo que no se ha
// podido contar sale «—», no un cero (la 319): la RLS de otra persona puede
// no dejar contar su colección o sus torneos, y un cero diría que no tiene
// ninguno.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('es-ES', { useGrouping: 'always' }) : '—')

// Puro: lo prueba node.
export function cifrasHtml({ cartas = null, guias = null, nota = null, votos = 0, torneos = null, propia = false } = {}) {
  const conNota = typeof nota === 'number' && nota > 0
  const cifra = (valor, rotulo, { href = '', ver = '', title = '' } = {}) => {
    const dentro = `<span class="valor">${valor}</span><span class="rotulo">${rotulo}</span>`
    const t = title ? ` title="${escapeHtml(title)}"` : ''
    if (href) return `<a class="perfil-cifra" href="${escapeHtml(href)}"${t}>${dentro}</a>`
    if (ver) return `<button type="button" class="perfil-cifra" data-ver="${ver}"${t}>${dentro}</button>`
    return `<div class="perfil-cifra"${t}>${dentro}</div>`
  }
  return (
    cifra(n(cartas), 'Cartas', { href: propia ? '/mi-coleccion' : '' }) +
    cifra(`${n(guias)}${conNota ? ` <small class="perfil-cifra-nota">${icons.star(12)} ${nota.toFixed(1)}</small>` : ''}`, 'Guías', {
      ver: 'guides',
      title: conNota ? `Nota de sus guías: ${nota.toFixed(1)} (${votos} ${votos === 1 ? 'voto' : 'votos'})` : '',
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
