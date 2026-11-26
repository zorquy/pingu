// ── La agenda de /torneos, lo que se calcula sin pantalla (1454–1456) ──
//
// Puro a propósito: lo prueba node sin navegador (test-tanda-1454.mjs). La
// pantalla (js/torneos/torneos.js) solo pinta lo que sale de aquí.

// La ciudad de un torneo en persona sale de su dirección: es lo último que
// se escribe («Calle Ercilla 12, Bilbao», «Gran Vía 30, 28013 Madrid»). El
// código postal y el país sobran para elegir ciudad. Online no tiene ciudad.
const PAISES = /^(españa|spain|espanya|espainia)$/i
export function ciudadDe(t) {
  if (t?.modalidad !== 'presencial') return null
  const trozos = String(t.direccion || '')
    .split(',')
    .map((s) => s.replace(/\b\d{4,5}\b/g, '').replace(/\(.*?\)/g, '').trim())
    .filter(Boolean)
  while (trozos.length && PAISES.test(trozos[trozos.length - 1])) trozos.pop()
  const ciudad = trozos.length > 1 ? trozos[trozos.length - 1] : null
  if (!ciudad || /\d/.test(ciudad)) return null
  // «bilbao» y «BILBAO» son la misma: la primera en mayúscula, como se escribe.
  return ciudad.length <= 3 ? ciudad.toUpperCase() : ciudad.charAt(0).toUpperCase() + ciudad.slice(1)
}

// Las ciudades que hay, con cuántos torneos cada una (las de más arriba,
// primero; a la par, por nombre).
export function ciudadesDe(torneos) {
  const cuenta = new Map()
  for (const t of torneos || []) {
    const c = ciudadDe(t)
    if (c) cuenta.set(c, (cuenta.get(c) || 0) + 1)
  }
  return [...cuenta].map(([ciudad, n]) => ({ ciudad, n })).sort((a, b) => b.n - a.n || a.ciudad.localeCompare(b.ciudad, 'es'))
}

const inicioDelDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

// En qué tramo de la agenda va un torneo: lo que se juega hoy (o ya está en
// juego, o tenía que haber empezado y aún no), la semana que viene y más
// adelante. Se cuenta por días de calendario, no por horas: el del domingo
// por la noche es «esta semana» aunque falten 6 días y 23 horas.
export function tramoDe(t, ahora = new Date()) {
  if (t.status === 'in_progress') return 'hoy'
  const dias = Math.round((inicioDelDia(new Date(t.start_at)) - inicioDelDia(ahora)) / 864e5)
  if (dias <= 0) return 'hoy'
  return dias <= 7 ? 'semana' : 'luego'
}

export const TRAMOS = [
  ['hoy', 'Hoy'],
  ['semana', 'Esta semana'],
  ['luego', 'Más adelante'],
]

// Lo que viene, por fecha (el más cercano arriba), con lo que está en juego
// por delante de todo.
export function ordenarProximos(torneos) {
  return [...(torneos || [])].sort((a, b) => (b.status === 'in_progress') - (a.status === 'in_progress') || new Date(a.start_at) - new Date(b.start_at))
}

// Los terminados, del último al primero, en grupos por mes («Noviembre 2026»).
export function terminadosPorMes(torneos) {
  const grupos = []
  for (const t of [...(torneos || [])].sort((a, b) => new Date(b.start_at) - new Date(a.start_at))) {
    const d = new Date(t.start_at)
    const clave = `${d.getFullYear()}-${d.getMonth()}`
    let g = grupos[grupos.length - 1]
    if (!g || g.clave !== clave) {
      const mes = d.toLocaleString('es-ES', { month: 'long' })
      g = { clave, texto: `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getFullYear()}`, torneos: [] }
      grupos.push(g)
    }
    g.torneos.push(t)
  }
  return grupos
}

// Sin tildes ni mayúsculas, para que «bilbao» encuentre «Bilbao» y «copa
// otono» encuentre «Copa de Otoño».
const plano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Los filtros de la fila: uno de Todos/Los míos/Online/En persona/Oficiales/
// Ligas, la ciudad (solo con «En persona») y lo que se escriba en el buscador
// (nombre, sitio, dirección u organizador).
export const FILTROS = ['todos', 'mios', 'online', 'persona', 'oficiales', 'ligas']
export function filtrarTorneos(torneos, { filtro = 'todos', ciudad = null, busca = '', mio = () => false, oficial = () => false, organiza = () => '' } = {}) {
  const q = plano(busca).trim()
  return (torneos || []).filter((t) => {
    if (filtro === 'mios' && !mio(t)) return false
    if (filtro === 'online' && t.modalidad === 'presencial') return false
    if (filtro === 'persona' && (t.modalidad !== 'presencial' || (ciudad && ciudadDe(t) !== ciudad))) return false
    if (filtro === 'oficiales' && !oficial(t)) return false
    if (filtro === 'ligas' && t.format !== 'league') return false
    if (q && !plano([t.name, t.lugar, t.direccion, organiza(t)].join(' ')).includes(q)) return false
    return true
  })
}

// Los borradores son de quien los crea, y de nadie más (1454, PINGU: «a mí
// me salen los borradores de los demás porque soy admin, pero creo que solo
// deberían salir a los que lo han creado»). Ser admin del sitio no cambia
// esto: un borrador no es de la comunidad hasta que se abre.
export function borradoresDe(torneos, userId) {
  if (!userId) return []
  return (torneos || []).filter((t) => t.status === 'draft' && t.admin_id === userId)
}
