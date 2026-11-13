// Tu temporada de liga, en tu perfil (tanda 1323, P3 del plan). En la pestaña
// Torneos, una tarjeta por liga: tu puesto en cada jornada como una línea que
// sube o baja, tus puntos y el resultado y el mazo de cada jornada. Lo que
// se ve de un mazo es lo que la base deja ver (la RLS de las listas, 230):
// en el perfil de otro, solo cuando su lista ya es pública.
//
// La cuenta es la de la ficha: `clasificacionDeLiga` (liga-en-curso.js) con
// las rondas HASTA cada jornada, así que el puesto de la jornada 3 es el que
// tenías al acabarla.
import { jornadasDeLiga, clasificacionDeLiga, nombreCorto } from './torneos/liga-en-curso.js'
import { jornadaDeRonda } from './torneos/rondas-jornada.js'
import { deducirIconos } from './torneos/arquetipos.js'
import { spriteDeCarta } from './torneos/sprites-pokemon.js'
import { spritesHtml } from './sprites-de-mazo.js'
import { escapeHtml } from './html.js'

// El puesto, los puntos y el resultado de cada jornada hecha.
export function temporadaDeLiga(t, { userId, rondas = [], inscripciones = [], partidas = [], resultados = [] } = {}) {
  const { lista, total } = jornadasDeLiga(t, rondas)
  const resultadoDe = new Map(resultados.map((r) => [r.match_id, r.result]))
  const jornadas = []
  for (const j of lista) {
    if (j.estado !== 'hecha') continue
    const hasta = rondas.filter((r) => r.phase !== 'top_cut' && jornadaDeRonda(t, r.round_number) <= j.n)
    const ids = new Set(hasta.map((r) => r.id))
    const tabla = clasificacionDeLiga(t, { inscripciones, rondas: hasta, partidas: partidas.filter((m) => ids.has(m.round_id)), resultados })
    const i = tabla.findIndex((e) => e.playerId === userId)
    if (i < 0) continue
    // Tu resultado en ESA jornada: victorias, derrotas y empates (el bye, victoria).
    const deLaJornada = new Set(rondas.filter((r) => jornadaDeRonda(t, r.round_number) === j.n).map((r) => r.id))
    let v = 0, d = 0, e = 0
    for (const m of partidas) {
      if (!deLaJornada.has(m.round_id) || (m.player_a_id !== userId && m.player_b_id !== userId)) continue
      if (m.status === 'bye') { v++; continue }
      if (m.status !== 'finished') continue
      const r = resultadoDe.get(m.id) || 'draw'
      const soyA = m.player_a_id === userId
      if (r === 'draw') e++
      else if ((r === 'a_wins') === soyA) v++
      else d++
    }
    jornadas.push({ n: j.n, puesto: i + 1, de: tabla.length, puntos: tabla[i].matchPoints, v, d, e })
  }
  const ultima = jornadas.at(-1) || null
  return { jornadas, total, hechas: jornadas.length, puesto: ultima?.puesto || null, de: ultima?.de || null, puntos: ultima?.puntos ?? null, completa: Boolean(total && jornadas.length === total) }
}

export const resultadoTexto = (j) => `${j.v}–${j.d}${j.e ? `–${j.e}` : ''}`

// La línea del puesto: arriba el 1.º. SVG con su caja fija (no se deforma).
export function lineaDePuestosHtml(jornadas, { ancho = 280, alto = 72 } = {}) {
  if (jornadas.length < 2) return ''
  const peor = Math.max(...jornadas.map((j) => j.de), 2)
  const x = (i) => 8 + (i * (ancho - 16)) / (jornadas.length - 1)
  const y = (p) => 8 + ((p - 1) * (alto - 16)) / (peor - 1)
  const puntos = jornadas.map((j, i) => `${x(i).toFixed(1)},${y(j.puesto).toFixed(1)}`).join(' ')
  const circulos = jornadas.map((j, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(j.puesto).toFixed(1)}" r="4"><title>Jornada ${j.n}: ${j.puesto}.º</title></circle>`).join('')
  return `<svg class="pl-linea" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-label="Tu puesto jornada a jornada: ${jornadas.map((j) => `${j.puesto}.º`).join(', ')}"><polyline points="${puntos}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${circulos}</svg>`
}

// Los dos Pokémon de una lista de jornada (parsed_cards), si se puede ver.
export function spritesDeLista(parsed) {
  try { return deducirIconos(parsed || {}).slice(0, 2).map((i) => spriteDeCarta(i.nombre)).filter(Boolean) } catch { return [] }
}

export function tarjetaDeLigaHtml(t, temp, listas = new Map()) {
  const filas = temp.jornadas.map((j) => `
      <li class="pl-jornada">
        <span class="pl-j">J${j.n}</span>
        <span class="pl-sprites">${spritesHtml(spritesDeLista(listas.get(j.n)), 'pl-sprite', 32)}</span>
        <b>${j.puesto}.º</b>
        <span class="subtext">${escapeHtml(resultadoTexto(j))}</span>
      </li>`).join('')
  return `
    <article class="pl-liga" data-liga="${escapeHtml(t.id)}">
      <header class="pl-cabeza">
        <a href="/torneo?slug=${encodeURIComponent(t.slug || '')}"><h3>${escapeHtml(nombreCorto(t.name))}</h3></a>
        <p class="subtext">${temp.puesto ? `${temp.puesto}.º de ${temp.de} · ${temp.puntos} ${temp.puntos === 1 ? 'punto' : 'puntos'} · ` : ''}${temp.hechas} de ${temp.total} jornadas${temp.completa ? ' · temporada completa' : ''}</p>
      </header>
      ${lineaDePuestosHtml(temp.jornadas)}
      <ol class="pl-jornadas">${filas}</ol>
    </article>`
}

// Lo pide y lo pinta: las ligas de esa persona (sin las que dejó ni las
// canceladas), cada una con lo suyo. Si algo falla, esa liga no sale.
export async function pintarLigasDe(supabase, caja, { userId, torneos = [] }) {
  const ligas = torneos.filter((t) => t.format === 'league' && t.status !== 'cancelled' && t.status !== 'draft')
  if (!caja || !ligas.length) return
  const tarjetas = []
  for (const t of ligas) {
    try {
      const [{ data: rondas }, { data: inscripciones }] = await Promise.all([
        supabase.from('rounds').select('id, round_number, phase, status, started_at, closed_at').eq('tournament_id', t.id),
        supabase.from('tournament_registrations').select('user_id, status').eq('tournament_id', t.id),
      ])
      const ids = (rondas || []).map((r) => r.id)
      if (!ids.length) continue
      const { data: partidas } = await supabase.from('tournament_matches').select('id, round_id, table_number, player_a_id, player_b_id, status, finished_at').in('round_id', ids)
      const mids = (partidas || []).map((m) => m.id)
      const [{ data: resultados }, { data: listas }] = await Promise.all([
        mids.length ? supabase.from('match_results').select('match_id, result').in('match_id', mids) : Promise.resolve({ data: [] }),
        supabase.from('tournament_matchday_decklists').select('matchday, parsed_cards').eq('tournament_id', t.id).eq('user_id', userId),
      ])
      const temp = temporadaDeLiga(t, { userId, rondas: rondas || [], inscripciones: inscripciones || [], partidas: partidas || [], resultados: resultados || [] })
      if (!temp.hechas) continue
      tarjetas.push(tarjetaDeLigaHtml(t, temp, new Map((listas || []).map((l) => [l.matchday, l.parsed_cards]))))
    } catch { /* esa liga no sale */ }
  }
  if (tarjetas.length) caja.insertAdjacentHTML('afterbegin', `<section class="pl-ligas" aria-label="Tus ligas"><h3 class="mis-torneos-grupo">Ligas</h3>${tarjetas.join('')}</section>`)
}
