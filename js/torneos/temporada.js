// «Tu temporada» en la banda de /torneos (1468, propuesta «Arena: siguientes
// mejoras», idea 1; PINGU: «adelante con todo lo recomendado»). Con la arena
// tranquila, lo primero que se leía era «0 abiertos» en grande; ahora, si has
// jugado este año, la banda habla de ti: torneos, podios, mejor puesto, tu
// récord y tus cinco últimas partidas. Las cifras de la arena siguen, en
// pequeño, debajo.
//
// «Temporada» = el año natural: es lo que dice la etiqueta, y así el récord
// de 2025 no pesa en el de 2026. Cuenta las ligas (son torneos, y en la
// propuesta se decidió que «la liga también es jugar»).
//
// Las cuentas son las del perfil (`cifrasDeTorneosHtml`, 1271): un podio es
// salir en el podio guardado, el campeón incluido; así el perfil y la arena
// no dicen dos números distintos.
import { escapeHtml } from '../html.js'

export const inicioDeTemporada = (ahora = Date.now()) => new Date(new Date(ahora).getFullYear(), 0, 1)

// Lo que gané, perdí o empaté en una mesa con resultado. El bye no cuenta (no
// hubo rival: lo mismo hace Mis partidas); el doble no presentado es una
// derrota para los dos.
export function desenlace(mesa, resultado, yo) {
  if (!mesa || !resultado || mesa.is_bye || mesa.status === 'bye' || !mesa.player_b_id) return null
  const soyA = mesa.player_a_id === yo
  if (!soyA && mesa.player_b_id !== yo) return null
  switch (resultado) {
    case 'a_wins': case 'forfeit_b': return soyA ? 'V' : 'D'
    case 'b_wins': case 'forfeit_a': return soyA ? 'D' : 'V'
    case 'draw': return 'E'
    case 'forfeit_both': return 'D'
    default: return null
  }
}

// Todo lo de la banda a partir de lo que trae la base. Puro: lo prueba node.
//   torneos: los TERMINADOS de esta temporada en los que me apunté
//   mesas: mis mesas de esta temporada; resultados: [{ match_id, result, resolved_at }]
export function temporadaDe({ torneos = [], mesas = [], resultados = [], yo }) {
  let podios = 0
  let mejor = null
  for (const t of torneos) {
    const p = t.champion_id === yo ? 0 : Array.isArray(t.podium) ? t.podium.indexOf(yo) : -1
    if (p >= 0) {
      podios++
      if (mejor === null || p < mejor) mejor = p
    }
  }
  const mesaPorId = new Map(mesas.map((m) => [m.id, m]))
  const partidas = []
  for (const r of resultados) {
    const d = desenlace(mesaPorId.get(r.match_id), r.result, yo)
    if (d) partidas.push({ d, cuando: Date.parse(r.resolved_at) || 0 })
  }
  partidas.sort((a, b) => a.cuando - b.cuando)
  const cuenta = { V: 0, D: 0, E: 0 }
  for (const p of partidas) cuenta[p.d]++
  return {
    torneos: torneos.length,
    podios,
    mejor: mejor === null ? null : mejor + 1,
    victorias: cuenta.V,
    derrotas: cuenta.D,
    empates: cuenta.E,
    partidas: partidas.length,
    // Las cinco últimas, de la más vieja a la más nueva (se leen como una racha).
    ultimas: partidas.slice(-5).map((p) => p.d),
  }
}

const NOMBRE = { V: 'ganada', D: 'perdida', E: 'empate' }
// La racha lleva LETRA además de color (V/D/E): que no dependa solo del color.
export function temporadaHtml(c, ahora = Date.now()) {
  if (!c || (!c.torneos && !c.partidas)) return ''
  const anio = new Date(ahora).getFullYear()
  const cifra = (valor, texto, clase = '') => `<span class="t-temp-cifra${clase}"><b>${escapeHtml(String(valor))}</b><small>${texto}</small></span>`
  const record = c.empates ? `${c.victorias}-${c.derrotas}-${c.empates}` : `${c.victorias}-${c.derrotas}`
  const cifras = [
    cifra(c.torneos, c.torneos === 1 ? 'torneo' : 'torneos'),
    cifra(c.podios, c.podios === 1 ? 'podio' : 'podios', c.podios ? ' oro' : ''),
    c.partidas ? cifra(record, 'récord') : '',
    c.mejor ? cifra(`${c.mejor}.º`, 'mejor puesto', ' t-temp-mejor') : '',
  ].join('')
  const racha = c.ultimas.length
    ? `<span class="t-temp-racha" role="img" aria-label="Tus últimas partidas: ${c.ultimas.map((d) => NOMBRE[d]).join(', ')}">${c.ultimas.map((d) => `<i class="r-${d}">${d}</i>`).join('')}</span>`
    : ''
  return `<span class="t-temp-ceja">Tu temporada ${anio}</span><div class="t-temp-fila"><div class="t-temp-cifras">${cifras}</div>${racha}</div>`
}

// Lo pide a la base solo con sesión y si te has apuntado a algo (`misIds`):
// tres consultas pequeñas, por persona y no por torneo, después de pintar la
// lista (no la retrasa). Si algo falla, la banda se queda como estaba.
export async function cargarTemporada(supabase, { yo, misIds = [], ahora = Date.now() }) {
  if (!yo || !misIds.length) return null
  const desde = inicioDeTemporada(ahora).toISOString()
  try {
    const [{ data: torneos }, { data: mesas }] = await Promise.all([
      supabase.from('tournaments').select('id, podium, champion_id').in('id', misIds).eq('status', 'finished').gte('start_at', desde),
      supabase.from('tournament_matches').select('id, player_a_id, player_b_id, status, is_bye').or(`player_a_id.eq.${yo},player_b_id.eq.${yo}`).gte('created_at', desde),
    ])
    const jugadas = (mesas || []).filter((m) => !m.is_bye && m.player_b_id)
    const { data: resultados } = jugadas.length
      ? await supabase.from('match_results').select('match_id, result, resolved_at').in('match_id', jugadas.map((m) => m.id))
      : { data: [] }
    return temporadaDe({ torneos: torneos || [], mesas: jugadas, resultados: resultados || [], yo })
  } catch {
    return null
  }
}
