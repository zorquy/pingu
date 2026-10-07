// Las cuatro cifras del perfil (743, J4 de la lista de propuestas): cartas,
// racha, guías y torneos. Las mismas en tu perfil y en el que ven los
// demás, y con UNA definición (la 628: si dos pantallas cuentan lo mismo,
// lo cuenta una función). La nota de tus guías va pegada a «Guías»: es la
// de lo que escribes, no una nota puesta a ti.
//
// Lo que no se ha podido contar sale «—», no un cero (la 319): la RLS de
// otra persona puede no dejar contar su colección o sus torneos, y un cero
// diría que no tiene ninguno.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('es-ES', { useGrouping: 'always' }) : '—')

// Puro: lo prueba node.
export function cifrasHtml({ cartas = null, racha = null, guias = null, nota = null, votos = 0, torneos = null } = {}) {
  const conNota = typeof nota === 'number' && nota > 0
  return `
    <div class="perfil-cifra">
      <span class="valor">${n(cartas)}</span>
      <span class="rotulo">Cartas</span>
    </div>
    <div class="perfil-cifra">
      <span class="valor">${icons.flame(16)} ${n(racha)}</span>
      <span class="rotulo">Racha</span>
    </div>
    <div class="perfil-cifra"${conNota ? ` title="${escapeHtml(`Nota de sus guías: ${nota.toFixed(1)} (${votos} ${votos === 1 ? 'voto' : 'votos'})`)}"` : ''}>
      <span class="valor">${n(guias)}${conNota ? ` <small class="perfil-cifra-nota">${icons.star(12)} ${nota.toFixed(1)}</small>` : ''}</span>
      <span class="rotulo">Guías</span>
    </div>
    <div class="perfil-cifra">
      <span class="valor">${n(torneos)}</span>
      <span class="rotulo">Torneos</span>
    </div>`
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
