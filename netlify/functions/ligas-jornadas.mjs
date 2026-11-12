// Los avisos de cada JORNADA de una liga (tanda 1302, la J1 que eligió PINGU
// en «Ligas y jornadas»). Hasta ahora Telegram y la campanita solo avisaban
// al abrirse las inscripciones de un torneo nuevo, y una liga abre UNA vez:
// la Liga FDN iba por la jornada 6 sin un solo aviso desde la 1.
//
// Cada cuarto de hora mira las ligas vivas y, por cada una:
//   · LA VÍSPERA (24 h antes de la fecha de una jornada que no ha empezado):
//     a Telegram, al tema de torneos, con la portada; y a la campanita de los
//     inscritos activos (el push lo manda enviar-push, que empuja la
//     campanita sola). Quien ya ha mandado su lista lee la hora; quien no,
//     que la mande, porque sin lista no juega esa jornada.
//   · LOS RESULTADOS (la última jornada jugada, cerrada hace menos de un
//     día): a Telegram, con los tres primeros de la clasificación de la liga.
//
// Cada aviso sale UNA vez: se apunta en `tournament_matchday_avisos` (liga,
// jornada y canal). La campanita se apunta ANTES de mandarse (la 665: un
// aviso que se dispara se apaga antes de avisar, o se repetiría cada pasada);
// Telegram, DESPUÉS, como el anuncio de torneos: si falla se reintenta en la
// pasada siguiente, y el freno es el tiempo (solo dentro de su día).
// Una liga con código (`is_private`) no sale en Telegram (como en
// telegram-torneos), pero sus inscritos sí reciben la campanita.
//
// Lo que pasa va al ESTADO (`scrydex_estado`, clave `ligas_jornadas`), que
// /admin enseña en su semáforo (la 655: un error que solo vuelve en la
// respuesta no lo lee nadie).
import { mandarATelegram, mensajeDeJornada, mensajeDeResultados, llavesQueFaltan, canalDe, diaRelativoEs } from '../lib/telegram.mjs'
import { horaEs } from '../lib/fechas.mjs'
import { jornadasDeLiga, jornadaDeVispera, jornadaRecienTerminada, clasificacionDeLiga, campanitaDeVispera } from '../../js/torneos/liga-en-curso.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'ligas_jornadas'
export const TIPO_CAMPANITA = 'torneo_jornada'

async function restReal(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json', ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

const enlaceDe = (t) => `https://pokedoc.es/torneo?slug=${encodeURIComponent(t.slug || '')}`

export async function procesar({ env = process.env, rest = restReal, fetchImpl = fetch, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: true, saltado: 'sin SUPABASE_SERVICE_ROLE_KEY' }
  const apuntar = (valor) =>
    rest('scrydex_estado', clave, {
      method: 'POST',
      headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ clave: CLAVE_ESTADO, valor: { ...valor, ultimaPasada: ahora.toISOString() }, updated_at: ahora.toISOString() }]),
    }).catch(() => {})
  try {
    const r = await pasada({ env, rest, fetchImpl, ahora, clave })
    await apuntar(r.fallos.length ? { ...r, ultimoError: { fecha: ahora.toISOString(), motivo: r.fallos[0] } } : r)
    return { ok: !r.fallos.length, ...r }
  } catch (e) {
    const motivo = String(e?.message || e).slice(0, 200)
    await apuntar({ ultimoError: { fecha: ahora.toISOString(), motivo } })
    return { ok: false, error: motivo }
  }
}

async function pasada({ env, rest, fetchImpl, ahora, clave }) {
  const ms = ahora.getTime()
  const faltanTelegram = llavesQueFaltan(env, { canal: 'TELEGRAM_CANAL_TORNEOS' })
  const telegram = faltanTelegram.length
    ? null
    : { token: env.TELEGRAM_BOT_TOKEN, canal: canalDe(env, 'TELEGRAM_CANAL_TORNEOS'), tema: env.TELEGRAM_TEMA_TORNEOS || null, fetchImpl }
  const hecho = { ligas: 0, telegram: [], campanitas: 0, resultados: [], fallos: [], sinTelegram: faltanTelegram.length ? faltanTelegram : undefined }

  const ligas = await rest(
    `tournaments?format=eq.league&status=in.(registration_open,registration_closed,in_progress)` +
      `&select=id,slug,name,banner_url,matchday_dates,swiss_rounds,rounds_per_matchday,pairing_seed,status,is_private`,
    clave
  )
  for (const t of ligas || []) {
    hecho.ligas++
    const rondas = (await rest(`rounds?tournament_id=eq.${t.id}&select=id,round_number,phase,status,started_at,closed_at`, clave)) || []
    const vispera = jornadaDeVispera(t, rondas, ms)
    const terminada = jornadaRecienTerminada(t, rondas, ms)
    if (!vispera && !terminada) continue
    // Sin la tabla (la migración 1302 sin ejecutar) no se manda NADA: un aviso
    // que no se puede apuntar saldría otra vez cada cuarto de hora.
    let apuntados
    try {
      apuntados = await rest(`tournament_matchday_avisos?tournament_id=eq.${t.id}&select=matchday,canal`, clave)
    } catch (e) {
      return { ...hecho, parado: { motivo: `falta la migración 1302 (tournament_matchday_avisos): ${String(e?.message || e).slice(0, 120)}` } }
    }
    const avisados = new Set((apuntados || []).map((a) => `${a.matchday}:${a.canal}`))
    const ya = (n, canal) => avisados.has(`${n}:${canal}`)
    const apuntarAviso = (n, canal) =>
      rest('tournament_matchday_avisos', clave, {
        method: 'POST',
        headers: { prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify([{ tournament_id: t.id, matchday: n, canal }]),
      })
    const publica = !t.is_private
    const total = jornadasDeLiga(t, rondas).total

    if (vispera && !ya(vispera.n, 'campanita')) {
      // Apuntado ANTES: si otra pasada se adelantó, no devuelve fila y no se
      // repite la campanita.
      const filas = await apuntarAviso(vispera.n, 'campanita')
      if (filas?.length) hecho.campanitas += await campanitaVispera({ rest, clave, t, j: vispera, ahora })
    }
    if (vispera && telegram && publica && !ya(vispera.n, 'telegram')) {
      const r = await mandarATelegram({ texto: mensajeDeJornada(t, { n: vispera.n, total, fecha: vispera.fecha }, { ahora }), portada: t.banner_url }, telegram)
      if (r.ok) {
        await apuntarAviso(vispera.n, 'telegram')
        hecho.telegram.push(`${t.slug} J${vispera.n}`)
      } else hecho.fallos.push(`${t.slug} J${vispera.n}: ${r.error}`)
    }
    if (terminada && telegram && publica && !ya(terminada.n, 'resultados')) {
      const podio = await podioDe({ rest, clave, t, rondas })
      if (!podio.length) continue
      const r = await mandarATelegram({ texto: mensajeDeResultados(t, terminada.n, podio), portada: null }, telegram)
      if (r.ok) {
        await apuntarAviso(terminada.n, 'resultados')
        hecho.resultados.push(`${t.slug} J${terminada.n}`)
      } else hecho.fallos.push(`${t.slug} resultados J${terminada.n}: ${r.error}`)
    }
  }
  return hecho
}

// La campanita de la víspera a los inscritos activos que no la han apagado.
async function campanitaVispera({ rest, clave, t, j, ahora }) {
  const inscritos = ((await rest(`tournament_registrations?tournament_id=eq.${t.id}&status=eq.active&select=user_id`, clave)) || []).map((i) => i.user_id)
  if (!inscritos.length) return 0
  const [perfiles, listas] = await Promise.all([
    rest(`user_profiles?id=in.(${inscritos.join(',')})&select=id,notification_prefs_disabled`, clave),
    rest(`tournament_matchday_decklists?tournament_id=eq.${t.id}&matchday=eq.${j.n}&select=user_id`, clave),
  ])
  const conLista = new Set((listas || []).map((l) => l.user_id))
  const quieren = (perfiles || []).filter((p) => !(p.notification_prefs_disabled || []).includes(TIPO_CAMPANITA))
  if (!quieren.length) return 0
  const hora = horaEs(j.fecha) || ''
  const dia = diaRelativoEs(j.fecha, ahora) || 'Mañana'
  await rest('user_notifications', clave, {
    method: 'POST',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(
      quieren.map((p) => ({
        recipient_id: p.id,
        type: TIPO_CAMPANITA,
        ...campanitaDeVispera(t, j, { conLista: conLista.has(p.id), hora, dia }),
        link: `${enlaceDe(t)}#torneoMisJornadas`,
        // A null: enviar-push la empuja en su pasada (cada cinco minutos).
        pushed_at: null,
      }))
    ),
  })
  return quieren.length
}

// Los tres primeros de la liga, con su nombre.
async function podioDe({ rest, clave, t, rondas }) {
  const ids = rondas.map((r) => r.id)
  if (!ids.length) return []
  const [inscripciones, partidas] = await Promise.all([
    rest(`tournament_registrations?tournament_id=eq.${t.id}&select=user_id,status`, clave),
    rest(`tournament_matches?round_id=in.(${ids.join(',')})&select=id,round_id,table_number,player_a_id,player_b_id,status,finished_at`, clave),
  ])
  const terminales = (partidas || []).map((m) => m.id)
  const resultados = terminales.length ? await rest(`match_results?match_id=in.(${terminales.join(',')})&select=match_id,result`, clave) : []
  const tabla = clasificacionDeLiga(t, { inscripciones: inscripciones || [], rondas, partidas: partidas || [], resultados: resultados || [] }).slice(0, 3)
  if (!tabla.length || !tabla[0].matchPoints) return []
  const nombres = await rest(`user_profiles?id=in.(${tabla.map((e) => e.playerId).join(',')})&select=id,username`, clave)
  const de = new Map((nombres || []).map((p) => [p.id, p.username]))
  return tabla.map((e) => ({ nombre: de.get(e.playerId) || 'Alguien', puntos: e.matchPoints }))
}

export default async function handler() {
  const r = await procesar()
  if (r.error || r.fallos?.length) console.warn('ligas-jornadas:', JSON.stringify(r.error || r.fallos))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: '*/15 * * * *' }
