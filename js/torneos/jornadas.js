// Las jornadas de una LIGA (tandas 634 y 635).
//
// En una liga cada jornada se juega con SU lista: «apuntarse a la jornada
// N» es enviar la lista de la N (puede ser la misma de siempre) y
// «desapuntarse» es retirarla. Sin lista no se juega esa jornada —no se
// empareja, ni puntos ni derrota— y se sigue en la liga. Y cada jornada
// se cierra por separado: cerrada (o con sus pareos hechos) ya no admite
// listas ni cambios, y la liga sigue admitiendo gente para las demás.
//
// Todo se escribe por funciones de la base (supabase-migration-torneos-
// jornadas.sql), que son las que de verdad dicen si una jornada está
// abierta; aquí solo se pinta lo que dirán.

import { supabase } from '../supabase.js'
import { icons } from '../icons.js'
import { escapeHtml } from '../app.js'

// Lo que la ficha necesita saber de las jornadas, de una tacada: cuáles
// están cerradas, cuáles tienen pareos y las listas que quien mira puede
// ver (las suyas; quien lleva la liga, las de todos). NULL = no se sabe
// (no es una liga, o la migración no está puesta): no se pinta nada y
// el torneo funciona como siempre (tanda 319: no se sabe ≠ no hay).
export async function cargarJornadas(torneo, { userId = null, todas = false } = {}) {
  if (torneo?.format !== 'league') return null
  const listas = userId
    ? (() => {
        // Quien lleva la liga las ve todas (para saber quién juega cada
        // jornada, y puede ser jugador a la vez); el jugador, las suyas.
        let q = supabase
          .from('tournament_matchday_decklists')
          .select('user_id, matchday, raw_text, parsed_cards, submitted_at')
          .eq('tournament_id', torneo.id)
        if (!todas) q = q.eq('user_id', userId)
        return q
      })()
    : Promise.resolve({ data: [], error: null })
  const [cerradas, rondas, mias] = await Promise.all([
    supabase.from('tournament_matchday_closures').select('matchday').eq('tournament_id', torneo.id),
    supabase.from('rounds').select('round_number').eq('tournament_id', torneo.id),
    listas,
  ])
  if (cerradas.error || rondas.error || mias.error) return null
  return {
    cerradas: new Set((cerradas.data || []).map((c) => c.matchday)),
    empezadas: new Set((rondas.data || []).map((r) => r.round_number)),
    listas: mias.data || [],
    todas,
  }
}

export const jornadaEmpezada = (j, n) => Boolean(j?.empezadas.has(n))
export const jornadaCerrada = (j, n) => Boolean(j?.cerradas.has(n)) || jornadaEmpezada(j, n)

// Quién juega la jornada n: quien tiene lista para ella. Solo lo sabe
// quien ve las listas de todos (el organizador); NULL si no.
export function quienesJuegan(j, n) {
  if (!j?.todas) return null
  return new Set(j.listas.filter((l) => l.matchday === n).map((l) => l.user_id))
}

// La primera jornada que todavía admite listas, o null si no queda ninguna.
export function primeraAbierta(torneo, j) {
  if (!j) return null
  for (let n = 1; n <= (Number(torneo.swiss_rounds) || 0); n++) if (!jornadaCerrada(j, n)) return n
  return null
}

// Tus jornadas: número, fecha, tu lista (o null) y si se puede cambiar.
export function misJornadas(torneo, j, userId) {
  if (!j || !userId) return []
  const fechas = Array.isArray(torneo.matchday_dates) ? torneo.matchday_dates : []
  const total = Number(torneo.swiss_rounds) || fechas.length
  return Array.from({ length: total }, (_, i) => {
    const n = i + 1
    return {
      n,
      fecha: fechas[i] || null,
      lista: j.listas.find((l) => l.matchday === n && l.user_id === userId) || null,
      abierta: !jornadaCerrada(j, n),
      empezada: jornadaEmpezada(j, n),
    }
  })
}

// La lista que se ofrece para una jornada sin lista: la de la jornada
// anterior más cercana que tenga una. «No importa si es la misma todas
// las jornadas»: así basta con guardarla tal cual.
export function listaAnterior(lista, n) {
  return [...lista].reverse().find((x) => x.n < n && x.lista)?.lista || null
}

// «Tus jornadas», en tu plaza. Una fila por jornada: si la juegas (= has
// mandado lista) y lo que puedes hacer mientras siga abierta.
export function misJornadasHtml(lista, fechaBonita) {
  if (!lista.length) return ''
  const filas = lista
    .map((j) => {
      const fecha = j.fecha ? ` · ${escapeHtml(fechaBonita(j.fecha))}` : ''
      const estado = j.lista
        ? `<span class="torneo-chapa torneo-chapa-exito">${icons.checkCircle(14)} Juegas</span>`
        : `<span class="torneo-chapa torneo-chapa-neutra">${j.abierta ? 'Sin lista' : 'No juegas'}</span>`
      let acciones
      if (!j.abierta) {
        acciones = `<span class="subtext torneo-jornada-cerrada">${j.empezada ? 'Ya empezó' : 'Cerrada'}</span>`
      } else if (j.lista) {
        acciones = `<button type="button" class="btn-secondary torneo-jornada-cambiar" data-jornada="${j.n}" data-accion="lista">Cambiar lista</button>
          <button type="button" class="btn-secondary torneo-jornada-cambiar" data-jornada="${j.n}" data-accion="quitar"
            aria-label="No juego la jornada ${j.n}">No juego</button>`
      } else {
        acciones = `<button type="button" class="btn-primary torneo-jornada-cambiar" data-jornada="${j.n}" data-accion="lista">Enviar lista</button>`
      }
      return `<li class="torneo-mis-jornadas-fila${j.lista ? '' : ' torneo-mis-jornadas-fuera'}">
          <span class="torneo-mis-jornadas-cual">${icons.calendar(14)} <strong>Jornada ${j.n}</strong>${fecha}</span>
          ${estado}<span class="torneo-mis-jornadas-acciones">${acciones}</span>
        </li>`
    })
    .join('')
  return `<div class="torneo-mis-jornadas" id="torneoMisJornadas">
      <p class="torneo-mis-jornadas-titulo"><strong>Tus jornadas</strong></p>
      <p class="subtext">En una liga cada jornada se juega con su lista (puede ser la misma). Para jugar una jornada, envía tu lista antes de que se cierre; sin lista no te emparejan en ella (no suma puntos ni cuenta como derrota) y sigues en la liga.</p>
      <ul class="torneo-mis-jornadas-lista">${filas}</ul>
    </div>`
}

// ── Lo que se escribe (las funciones de la base) ──
// Devuelven el error tal cual: el mensaje de la base («Las inscripciones
// de la jornada 2 están cerradas.») es justo lo que hay que enseñar.

export async function enviarListaJornada(torneoId, n, texto, cartas) {
  const { error } = await supabase.rpc('torneos_lista_jornada', { p_torneo: torneoId, p_jornada: n, p_texto: texto, p_cartas: cartas })
  return error || null
}

export async function quitarListaJornada(torneoId, n) {
  const { error } = await supabase.rpc('torneos_quitar_lista_jornada', { p_torneo: torneoId, p_jornada: n })
  return error || null
}

export async function cerrarJornada(torneoId, n, cerrar) {
  const { error } = await supabase.rpc('torneos_cerrar_jornada', { p_torneo: torneoId, p_jornada: n, p_cerrar: cerrar })
  return error || null
}

export async function publicarListasJornada(torneoId, n) {
  const { error } = await supabase.rpc('torneos_publicar_listas_jornada', { p_torneo: torneoId, p_jornada: n })
  return error || null
}
