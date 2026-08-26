import webpush from 'web-push'

// El barredor de torneos: pasa cada minuto por las rondas activas y hace
// lo que en TrainerArena hacían los jobs de BullMQ (decisión de
// CLAUDE.md: función programada en vez de colas):
//
//  1. AVISO — la ronda acaba de arrancar y nadie ha sido avisado
//     (players_notified_at nulo): push «tu ronda empieza» a los
//     jugadores con mesa, una sola vez.
//  2. CHECK-IN CADUCADO (SPEC §6.4) — pasada la ventana de
//     checkin_minutes, cada mesa activa con check-ins a medias cae:
//     forfeit_b si solo vino A, forfeit_a si solo vino B, forfeit_both
//     si no vino nadie. Con resultado apuntado (ganador el presente).
//  3. TIEMPO AGOTADO (SPEC §6.6, solo suizas) — pasado ends_at, las
//     mesas activas SIN NINGÚN reporte caen en forfeit_both; una mesa
//     con algún reporte o esperando confirmación se deja en paz (la
//     cierra la confirmación, el organizador o un juez).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria) y
// PUSH_VAPID_PRIVATE (sin ella se barren forfeits pero no se avisa).

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}

async function restReal(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...servicio(clave), ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

// A qué estado cae una mesa activa según quién hizo check-in (SPEC §6.4).
export function forfeitPorCheckin(partida) {
  const vinoA = Boolean(partida.check_in_a_at)
  const vinoB = Boolean(partida.check_in_b_at)
  if (vinoA && vinoB) return null
  if (vinoA) return { status: 'forfeit_b', winner: partida.player_a_id }
  if (vinoB) return { status: 'forfeit_a', winner: partida.player_b_id }
  return { status: 'forfeit_both', winner: null }
}

export async function procesar({ env = process.env, rest = restReal, enviar = null, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: true, saltado: 'sin SUPABASE_SERVICE_ROLE_KEY: no se barre nada' }

  // El push, con la misma fontanería que el resto de funciones de aviso.
  const privada = env.PUSH_VAPID_PRIVATE
  let mandar = null
  if (privada) {
    const ajustes = await rest(`site_settings?key=eq.push_vapid_public&select=value`, clave).catch(() => null)
    const publica = ajustes?.[0]?.value?.clave
    if (publica) {
      mandar =
        enviar ||
        ((suscripcion, cuerpo) => {
          webpush.setVapidDetails('mailto:avisos@pokedoc.es', publica, privada)
          return webpush.sendNotification(suscripcion, cuerpo)
        })
    }
  }
  const sitio = env.SITE_URL || 'https://pokedoc.es'

  let avisados = 0
  let caducadas = 0
  let aperturas = 0
  let avisosCheckin = 0
  let avisosConfirmar = 0
  let avisosResueltas = 0

  async function avisar(subs, cuerpo) {
    for (const s of subs || []) {
      try {
        await mandar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(cuerpo))
        avisados++
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, clave, {
            method: 'DELETE',
          }).catch(() => {})
          caducadas++
        }
      }
    }
  }

  // 0. AVISO DE APERTURA (tanda 211): un torneo que acaba de abrir
  //    inscripciones se anuncia una sola vez. MIENTRAS DURE LA PRUEBA
  //    solo a los admins — la sección no existe para nadie más; al
  //    abrir los torneos al público, quitar el filtro de is_admin.
  //    Un tropiezo aquí (p. ej. la migración de la columna aún sin
  //    pasar) no puede tumbar el barrido de relojes de más abajo.
  if (mandar) {
    try {
      const recienAbiertos = await rest(
        `tournaments?status=eq.registration_open&registration_notified_at=is.null&select=id,slug,name`,
        clave
      )
      for (const t of recienAbiertos || []) {
        const admins = await rest(`user_profiles?is_admin=eq.true&select=id`, clave)
        const ids = (admins || []).map((a) => a.id)
        if (ids.length) {
          const subs = await rest(
            `push_subscriptions?user_id=in.(${ids.join(',')})&select=endpoint,user_id,p256dh,auth`,
            clave
          )
          await avisar(subs, {
            title: `Inscripciones abiertas — ${t.name}`,
            body: 'Apúntate antes de que se llene y deja lista tu decklist.',
            link: new URL(`/torneo?slug=${encodeURIComponent(t.slug)}`, sitio).href,
            tag: 'torneo-apertura',
          })
        }
        await rest(`tournaments?id=eq.${t.id}`, clave, {
          method: 'PATCH',
          body: JSON.stringify({ registration_notified_at: ahora.toISOString() }),
        })
        aperturas++
      }
    } catch (e) {
      console.error('aviso de apertura aparcado:', e?.message || e)
    }
  }

  const rondas = await rest(
    `rounds?status=eq.active&select=id,tournament_id,round_number,phase,started_at,ends_at,players_notified_at,checkin_warned_at`,
    clave
  )
  if (!rondas || rondas.length === 0) return { ok: true, rondas: 0, aperturas, avisados, caducadas }

  const idsTorneos = [...new Set(rondas.map((r) => r.tournament_id))]
  const torneos = await rest(
    `tournaments?id=in.(${idsTorneos.join(',')})&select=id,slug,name,checkin_minutes`,
    clave
  )
  const torneoDe = Object.fromEntries((torneos || []).map((t) => [t.id, t]))

  const partidas = await rest(
    `tournament_matches?round_id=in.(${rondas.map((r) => r.id).join(',')})&select=id,round_id,player_a_id,player_b_id,status,check_in_a_at,check_in_b_at,await_notified_at,resolved_notified_at`,
    clave
  )
  const activas = (partidas || []).filter((m) => m.status === 'active')
  const esperando = (partidas || []).filter((m) => m.status === 'awaiting_confirmation')
  const conReporte = new Set()
  const reportesPorMesa = {}
  const conReportes = [...activas, ...esperando]
  if (conReportes.length) {
    const reportes = await rest(
      `match_reports?match_id=in.(${conReportes.map((m) => m.id).join(',')})&select=match_id,reporter_id`,
      clave
    )
    for (const r of reportes || []) {
      conReporte.add(r.match_id)
      ;(reportesPorMesa[r.match_id] ||= []).push(r.reporter_id)
    }
  }

  async function caer(partida, status, winner, motivo) {
    await rest(`tournament_matches?id=eq.${partida.id}`, clave, {
      method: 'PATCH',
      body: JSON.stringify({ status, finished_at: ahora.toISOString() }),
    })
    await rest(`match_results`, clave, {
      method: 'POST',
      body: JSON.stringify({ match_id: partida.id, result: status, winner_id: winner, resolved_by: null, score: motivo }),
    })
  }

  // Push a unos jugadores concretos (los avisos del ciclo de partida).
  async function avisarJugadores(ids, cuerpo) {
    const limpios = [...new Set(ids)].filter(Boolean)
    if (!mandar || !limpios.length) return
    const subs = await rest(
      `push_subscriptions?user_id=in.(${limpios.join(',')})&select=endpoint,user_id,p256dh,auth`,
      clave
    )
    await avisar(subs, cuerpo)
  }

  let forfeitsCheckin = 0
  let forfeitsTiempo = 0

  for (const ronda of rondas) {
    const torneo = torneoDe[ronda.tournament_id]
    if (!torneo) continue
    const mesasDeRonda = activas.filter((m) => m.round_id === ronda.id)

    // 1. El aviso único de arranque.
    if (mandar && !ronda.players_notified_at) {
      const jugadores = [...new Set(mesasDeRonda.flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean))]
      if (jugadores.length) {
        const subs = await rest(
          `push_subscriptions?user_id=in.(${jugadores.join(',')})&select=endpoint,user_id,p256dh,auth`,
          clave
        )
        await avisar(subs, {
          title: `Tu ronda ha empezado — ${torneo.name}`,
          body: `Ronda ${ronda.round_number}: haz check-in y busca a tu rival en TCG Live.`,
          link: new URL(`/torneo?slug=${encodeURIComponent(torneo.slug)}`, sitio).href,
          tag: 'torneo-ronda',
        })
      }
      await rest(`rounds?id=eq.${ronda.id}`, clave, {
        method: 'PATCH',
        body: JSON.stringify({ players_notified_at: ahora.toISOString() }),
      })
    }

    // 1b. CHECK-IN POR CADUCAR (tanda 216): quedan 5 minutos o menos de
    //     ventana y hay quien no ha pulsado el botón — un toque, una vez
    //     por ronda, SOLO a los que faltan.
    const cierre = ronda.started_at ? new Date(ronda.started_at).getTime() + (torneo.checkin_minutes || 0) * 60000 : 0
    if (
      mandar &&
      !ronda.checkin_warned_at &&
      ronda.started_at &&
      (torneo.checkin_minutes || 0) > 0 &&
      ahora.getTime() >= cierre - 5 * 60000 &&
      ahora.getTime() < cierre
    ) {
      const rezagados = mesasDeRonda.flatMap((m) => [
        ...(!m.check_in_a_at ? [m.player_a_id] : []),
        ...(!m.check_in_b_at && m.player_b_id ? [m.player_b_id] : []),
      ])
      if (rezagados.length) {
        await avisarJugadores(rezagados, {
          title: `El check-in se acaba — ${torneo.name}`,
          body: 'Te quedan unos minutos para hacer check-in o tu mesa cae por incomparecencia.',
          link: new URL(`/torneo?slug=${encodeURIComponent(torneo.slug)}`, sitio).href,
          tag: 'torneo-checkin',
        })
        avisosCheckin++
      }
      await rest(`rounds?id=eq.${ronda.id}`, clave, {
        method: 'PATCH',
        body: JSON.stringify({ checkin_warned_at: ahora.toISOString() }),
      })
    }

    // 1c. TU RIVAL YA REPORTÓ (tanda 216): la mesa espera tu
    //     confirmación — el aviso va SOLO a quien no ha reportado, una
    //     vez por mesa.
    for (const m of esperando.filter((m) => m.round_id === ronda.id)) {
      if (m.await_notified_at) continue
      const reporteros = reportesPorMesa[m.id] || []
      const falta = [m.player_a_id, m.player_b_id].filter((j) => j && !reporteros.includes(j))
      await avisarJugadores(falta, {
        title: `Tu rival ha reportado — ${torneo.name}`,
        body: 'Confirma el resultado de tu mesa para cerrar la ronda.',
        link: new URL(`/torneo?slug=${encodeURIComponent(torneo.slug)}`, sitio).href,
        tag: 'torneo-confirmar',
      })
      avisosConfirmar++
      await rest(`tournament_matches?id=eq.${m.id}`, clave, {
        method: 'PATCH',
        body: JSON.stringify({ await_notified_at: ahora.toISOString() }),
      })
    }

    // 2. La ventana de check-in.
    const cierreCheckin = new Date(ronda.started_at).getTime() + (torneo.checkin_minutes || 0) * 60000
    if (ronda.started_at && ahora.getTime() > cierreCheckin) {
      for (const m of mesasDeRonda) {
        const caida = forfeitPorCheckin(m)
        if (caida) {
          await caer(m, caida.status, caida.winner, 'check_in')
          m.status = caida.status
          forfeitsCheckin++
        }
      }
    }

    // 3. El tiempo de la ronda (solo suizas: en el cut no hay reloj).
    if (ronda.ends_at && ahora.getTime() > new Date(ronda.ends_at).getTime()) {
      for (const m of mesasDeRonda) {
        if (m.status === 'active' && !conReporte.has(m.id)) {
          await caer(m, 'forfeit_both', null, 'round_time')
          m.status = 'forfeit_both'
          forfeitsTiempo++
        }
      }
    }
  }

  // 4. MESA RESUELTA POR UN JUEZ (tanda 216): un resultado con
  //    resolved_by (disputa o resolución a mano) avisa a los DOS
  //    jugadores, una vez por mesa.
  if (mandar) {
    const terminales = (partidas || []).filter(
      (m) => !['active', 'awaiting_confirmation', 'pending'].includes(m.status) && !m.resolved_notified_at
    )
    if (terminales.length) {
      const resultados = await rest(
        `match_results?match_id=in.(${terminales.map((m) => m.id).join(',')})&select=match_id,resolved_by`,
        clave
      )
      const resueltas = new Set((resultados || []).filter((r) => r.resolved_by).map((r) => r.match_id))
      for (const m of terminales) {
        if (!resueltas.has(m.id)) continue
        const ronda = rondas.find((r) => r.id === m.round_id)
        const torneo = ronda ? torneoDe[ronda.tournament_id] : null
        await avisarJugadores([m.player_a_id, m.player_b_id], {
          title: `Vuestra mesa está resuelta${torneo ? ` — ${torneo.name}` : ''}`,
          body: 'El organizador o un juez ha decidido el resultado. Entra a verlo.',
          link: torneo ? new URL(`/torneo?slug=${encodeURIComponent(torneo.slug)}`, sitio).href : new URL('/torneos', sitio).href,
          tag: 'torneo-resuelta',
        })
        avisosResueltas++
        await rest(`tournament_matches?id=eq.${m.id}`, clave, {
          method: 'PATCH',
          body: JSON.stringify({ resolved_notified_at: ahora.toISOString() }),
        })
      }
    }
  }

  return { ok: true, rondas: rondas.length, aperturas, avisados, caducadas, forfeitsCheckin, forfeitsTiempo, avisosCheckin, avisosConfirmar, avisosResueltas }
}

export default async function handler() {
  const resultado = await procesar()
  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

// Cada minuto: es el sustituto de los jobs con retardo exacto del
// original, con un minuto de granularidad que para torneos sobra.
export const config = { schedule: '* * * * *' }
