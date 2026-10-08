// Las jornadas de una LIGA, una a una (tanda 634).
//
// Cada inscrito dice qué jornadas juega: por defecto todas, y puede
// desapuntarse (o volver a apuntarse) de cualquiera mientras sus pareos
// no estén generados. Quien no juega una jornada no se empareja en ella
// —ni puntos ni derrota— y entra solo en la siguiente.
//
// Se guarda solo la AUSENCIA (`tournament_matchday_absences`): lo normal
// es ir, y así una liga de antes de esta tanda sigue igual sin tocarla.
// Se escribe por la RPC `torneos_jornada`, que es quien de verdad cierra
// la jornada cuando empieza; aquí solo se pinta lo que la base dirá.

import { supabase } from '../supabase.js'
import { icons } from '../icons.js'
import { escapeHtml } from '../app.js'

// Lo que la ficha necesita saber de las jornadas, de una tacada:
// quién falta a cuál y qué jornadas ya tienen pareos. NULL = no se sabe
// (la migración no está puesta, o no es una liga): entonces no se pinta
// nada y el pareo se hace como siempre. No es lo mismo que «nadie falta»
// (la tanda 319: no se sabe no se pinta como un cero).
export async function cargarJornadas(torneo) {
  if (torneo?.format !== 'league') return null
  const [ausencias, rondas] = await Promise.all([
    supabase.from('tournament_matchday_absences').select('user_id, matchday').eq('tournament_id', torneo.id),
    supabase.from('rounds').select('round_number').eq('tournament_id', torneo.id),
  ])
  if (ausencias.error || rondas.error) return null
  return {
    ausencias: ausencias.data || [],
    empezadas: new Set((rondas.data || []).map((r) => r.round_number)),
  }
}

// Quién NO juega la jornada n.
export function ausentesEn(jornadas, n) {
  return new Set((jornadas?.ausencias || []).filter((a) => a.matchday === n).map((a) => a.user_id))
}

// Las jornadas de un jugador: número, fecha, si la juega y si todavía
// se puede cambiar (sin pareos generados).
export function misJornadas(torneo, jornadas, userId) {
  if (!jornadas || !userId) return []
  const fechas = Array.isArray(torneo.matchday_dates) ? torneo.matchday_dates : []
  const total = Number(torneo.swiss_rounds) || fechas.length
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1
    return {
      n,
      fecha: fechas[i] || null,
      juego: !ausentesEn(jornadas, n).has(userId),
      abierta: !jornadas.empezadas.has(n),
    }
  })
}

// La caja de «Tu plaza» con tus jornadas. Una fila por jornada: las que
// ya empezaron solo dicen lo que fue; las demás llevan su interruptor.
export function misJornadasHtml(lista, fechaBonita) {
  if (!lista.length) return ''
  const filas = lista
    .map((j) => {
      const fecha = j.fecha ? ` · ${escapeHtml(fechaBonita(j.fecha))}` : ''
      const estado = j.juego
        ? `<span class="torneo-chapa torneo-chapa-exito">${icons.checkCircle(14)} Juegas</span>`
        : '<span class="torneo-chapa torneo-chapa-neutra">No juegas</span>'
      const boton = j.abierta
        ? `<button type="button" class="btn-secondary torneo-jornada-cambiar" data-jornada="${j.n}" data-juega="${j.juego ? 'no' : 'si'}"
             aria-label="${j.juego ? 'Desapuntarme' : 'Apuntarme'} de la jornada ${j.n}">${j.juego ? 'Desapuntarme' : 'Apuntarme'}</button>`
        : '<span class="subtext torneo-jornada-cerrada">Ya empezó</span>'
      return `<li class="torneo-mis-jornadas-fila${j.juego ? '' : ' torneo-mis-jornadas-fuera'}">
          <span class="torneo-mis-jornadas-cual">${icons.calendar(14)} <strong>Jornada ${j.n}</strong>${fecha}</span>
          ${estado}${boton}
        </li>`
    })
    .join('')
  return `<div class="torneo-mis-jornadas" id="torneoMisJornadas">
      <p class="torneo-mis-jornadas-titulo"><strong>Tus jornadas</strong></p>
      <p class="subtext">Si no puedes ir a una, desapúntate antes de que empiece: no te emparejarán en ella (no suma puntos ni cuenta como derrota) y vuelves en la siguiente.</p>
      <ul class="torneo-mis-jornadas-lista">${filas}</ul>
    </div>`
}

// Apuntarse o desapuntarse. Devuelve el error tal cual: el mensaje de
// la base («La jornada 2 ya ha empezado…») es justo lo que hay que
// enseñar.
export async function cambiarJornada(torneoId, n, juega) {
  const { error } = await supabase.rpc('torneos_jornada', { p_torneo: torneoId, p_jornada: n, p_juega: juega })
  return error || null
}
