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
  let promociones = 0
  let avisosCheckin = 0
  let avisosConfirmar = 0
  let avisosResueltas = 0
  let correos = 0
  let cancelaciones = 0
  let recordatorios = 0
  let borrados = 0

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

  // Push a unos jugadores concretos por su id (lo usan la lista de
  // espera y los avisos del ciclo de partida).
  async function avisarJugadoresPorId(ids, cuerpo) {
    const limpios = [...new Set(ids)].filter(Boolean)
    if (!mandar || !limpios.length) return
    const subs = await rest(
      `push_subscriptions?user_id=in.(${limpios.join(',')})&select=endpoint,user_id,p256dh,auth`,
      clave
    )
    await avisar(subs, cuerpo)
  }

  // ── El correo (tanda 223) ──
  // Hasta ahora TODO aviso de torneo salía solo por push, y el push hay
  // que conceder-lo: en un iPhone, si no has instalado PokeDoc como
  // app, no lo tienes. Es decir, media comunidad no se enteraba de que
  // su ronda había empezado. El sitio ya tenía cola de correo montada
  // para el foro (`email_outbox`), así que se usa la misma: se encola y
  // send-emails.mjs la vacía cada cinco minutos.
  //
  // Se respeta `notification_email_disabled`, que es la lista de tipos
  // que cada cual ha apagado en su perfil. El push NO mira esa lista (es
  // la preferencia del correo), igual que en el resto del sitio.
  async function encolarCorreo(ids, { tipo, subject, preview, link, thread }) {
    const limpios = [...new Set(ids)].filter(Boolean)
    if (!limpios.length) return 0
    const perfiles = await rest(
      `user_profiles?id=in.(${limpios.join(',')})&select=id,notification_email_disabled`,
      clave
    ).catch(() => null)
    if (!perfiles) return 0
    const quieren = perfiles.filter((p) => !(p.notification_email_disabled || []).includes(tipo))
    if (!quieren.length) return 0
    await rest('email_outbox', clave, {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(
        quieren.map((p) => ({
          recipient_id: p.id,
          type: tipo,
          subject,
          preview,
          link,
          // Dos avisos del mismo torneo y del mismo tipo no mandan dos
          // correos si el primero sigue en la cola sin salir.
          thread_key: thread || null,
        }))
      ),
    }).catch(() => {})
    return quieren.length
  }

  // Avisar por los dos canales a la vez, que es lo que quiere casi todo
  // el mundo que llama: push para quien lo tenga, correo para el resto
  // (y para quien tenga los dos, los dos — es el mismo criterio que
  // sigue el foro).
  async function avisarPorTodo(ids, { title, body, tag, link, tipo, subject, preview, thread }) {
    await avisarJugadoresPorId(ids, { title, body, link, tag })
    correos += await encolarCorreo(ids, {
      tipo,
      subject: subject || title,
      preview: preview || body,
      link,
      thread,
    })
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
          correos += await encolarCorreo(ids, {
            tipo: 'torneo_apertura',
            subject: `Inscripciones abiertas — ${t.name}`,
            preview: 'Apúntate antes de que se llene y deja lista tu decklist.',
            link: new URL(`/torneo?slug=${encodeURIComponent(t.slug)}`, sitio).href,
            thread: `torneo-apertura-${t.id}`,
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

  // 0a-bis. TORNEO CANCELADO (tanda 223). El agujero más gordo que
  //     tenía esto: cancelabas un torneo con ocho personas dentro y no
  //     se enteraba ninguna. Ahora se les avisa por push y por correo,
  //     una sola vez (`cancel_notified_at`).
  //
  //     Y el BORRADO DIFERIDO: borrar un torneo con gente dentro no
  //     puede ser instantáneo, porque la fila que dice quién estaba
  //     apuntado se va en la misma operación y ya no hay a quién
  //     avisar. La ficha lo deja cancelado con `delete_after_notice_at`
  //     puesta; aquí se avisa PRIMERO y se borra DESPUÉS. Los inscritos
  //     se enteran, y el torneo desaparece igual.
  try {
    const cancelados = await rest(
      `tournaments?status=eq.cancelled&cancel_notified_at=is.null&select=id,slug,name,delete_after_notice_at`,
      clave
    )
    for (const t of cancelados || []) {
      const inscritos = await rest(
        `tournament_registrations?tournament_id=eq.${t.id}&status=in.(active,waitlisted)&select=user_id`,
        clave
      )
      const ids = (inscritos || []).map((i) => i.user_id)
      if (ids.length) {
        await avisarPorTodo(ids, {
          title: `Torneo cancelado — ${t.name}`,
          body: 'El organizador ha cancelado este torneo. No hace falta que hagas nada.',
          tag: 'torneo-cancelado',
          // Si el torneo se va a borrar, su ficha no existirá cuando
          // abran el correo: se les manda a la lista.
          link: new URL(
            t.delete_after_notice_at ? '/torneos' : `/torneo?slug=${encodeURIComponent(t.slug)}`,
            sitio
          ).href,
          tipo: 'torneo_cancelado',
          subject: `Se ha cancelado «${t.name}»`,
          preview: 'El organizador ha cancelado el torneo en el que te habías apuntado. No tienes que hacer nada.',
          thread: `torneo-cancelado-${t.id}`,
        })
      }
      // Marcar ANTES de borrar: si el borrado falla, el aviso no se
      // repite en la pasada siguiente.
      await rest(`tournaments?id=eq.${t.id}`, clave, {
        method: 'PATCH',
        body: JSON.stringify({ cancel_notified_at: ahora.toISOString() }),
      })
      cancelaciones++
      if (t.delete_after_notice_at) {
        await rest(`tournaments?id=eq.${t.id}`, clave, { method: 'DELETE' })
        borrados++
      }
    }
  } catch (e) {
    console.error('aviso de cancelación aparcado:', e?.message || e)
  }

  // 0a-ter. RECORDATORIO (tanda 223): «tu torneo empieza dentro de un
  //     rato». Había aviso de que la ronda YA había empezado, que para
  //     quien se apuntó el lunes a un torneo del sábado llega tarde.
  //     Se manda una vez, en la hora anterior al comienzo.
  try {
    const dentroDeUnaHora = new Date(ahora.getTime() + 60 * 60000).toISOString()
    const proximos = await rest(
      `tournaments?status=in.(registration_open,registration_closed)&reminder_notified_at=is.null` +
        `&start_at=gte.${ahora.toISOString()}&start_at=lte.${dentroDeUnaHora}&select=id,slug,name,start_at`,
      clave
    )
    for (const t of proximos || []) {
      const inscritos = await rest(
        `tournament_registrations?tournament_id=eq.${t.id}&status=eq.active&select=user_id`,
        clave
      )
      const ids = (inscritos || []).map((i) => i.user_id)
      if (ids.length) {
        await avisarPorTodo(ids, {
          title: `Empieza pronto — ${t.name}`,
          body: 'Tu torneo empieza en menos de una hora. Ten TCG Live a mano.',
          tag: 'torneo-recordatorio',
          link: new URL(`/torneo?slug=${encodeURIComponent(t.slug)}`, sitio).href,
          tipo: 'torneo_recordatorio',
          subject: `«${t.name}» empieza en menos de una hora`,
          preview: 'Ten TCG Live abierto y tu decklist lista. Entra a la ficha cuando empiece para ver tu mesa.',
          thread: `torneo-recordatorio-${t.id}`,
        })
      }
      await rest(`tournaments?id=eq.${t.id}`, clave, {
        method: 'PATCH',
        body: JSON.stringify({ reminder_notified_at: ahora.toISOString() }),
      })
      recordatorios++
    }
  } catch (e) {
    console.error('recordatorio aparcado:', e?.message || e)
  }

  // 0b. LISTA DE ESPERA (tanda 218): en los torneos que aún admiten
  //     gente, cada plaza libre se la queda el PRIMERO de la cola (por
  //     orden de llegada) y se le avisa. Va aquí y no en el navegador
  //     para que la promoción ocurra aunque nadie tenga la ficha
  //     abierta: quien se dio de baja a las 3 de la mañana no deja la
  //     plaza muerta hasta que alguien entre. Con su red de seguridad,
  //     como el aviso de apertura: un tropiezo no puede llevarse por
  //     delante el barrido de relojes.
  try {
    const abiertos = await rest(
      `tournaments?status=in.(registration_open,registration_closed)&select=id,slug,name,max_players`,
      clave
    )
    for (const t of abiertos || []) {
      const inscritos = await rest(
        `tournament_registrations?tournament_id=eq.${t.id}&status=in.(active,waitlisted)&select=id,user_id,status,registered_at&order=registered_at.asc`,
        clave
      )
      const activos = (inscritos || []).filter((i) => i.status === 'active').length
      const cola = (inscritos || []).filter((i) => i.status === 'waitlisted')
      let libres = (t.max_players || 0) - activos
      for (const espera of cola) {
        if (libres <= 0) break
        await rest(`tournament_registrations?id=eq.${espera.id}`, clave, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'active' }),
        })
        libres--
        promociones++
        await avisarPorTodo([espera.user_id], {
          title: `¡Tienes plaza! — ${t.name}`,
          body: 'Se ha liberado un hueco y la lista de espera te ha dado paso. Deja lista tu decklist.',
          link: new URL(`/torneo?slug=${encodeURIComponent(t.slug)}`, sitio).href,
          tag: 'torneo-plaza',
          tipo: 'torneo_plaza',
          subject: `Tienes plaza en «${t.name}»`,
          preview: 'Se ha liberado un hueco y la lista de espera te ha dado paso. Deja lista tu decklist.',
        })
      }
    }
  } catch (e) {
    console.error('lista de espera aparcada:', e?.message || e)
  }

  const rondas = await rest(
    `rounds?status=eq.active&select=id,tournament_id,round_number,phase,started_at,ends_at,players_notified_at,checkin_warned_at`,
    clave
  )
  if (!rondas || rondas.length === 0)
    return { ok: true, rondas: 0, aperturas, promociones, avisados, caducadas, correos, cancelaciones, recordatorios, borrados }

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
        correos += await encolarCorreo(jugadores, {
          tipo: 'torneo_ronda',
          subject: `Ronda ${ronda.round_number} en marcha — ${torneo.name}`,
          preview: 'Haz check-in y busca a tu rival en TCG Live. La ronda tiene tiempo contado.',
          link: new URL(`/torneo?slug=${encodeURIComponent(torneo.slug)}`, sitio).href,
          thread: `torneo-ronda-${ronda.id}`,
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
        // Este se queda SOLO en push a propósito: quedan cinco minutos
        // y un correo que se manda cada cinco no llega a tiempo.
        await avisarJugadoresPorId(rezagados, {
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
      await avisarPorTodo(falta, {
        title: `Tu rival ha reportado — ${torneo.name}`,
        body: 'Confirma el resultado de tu mesa para cerrar la ronda.',
        link: new URL(`/torneo?slug=${encodeURIComponent(torneo.slug)}`, sitio).href,
        tag: 'torneo-confirmar',
        tipo: 'torneo_partida',
        subject: `Confirma tu resultado — ${torneo.name}`,
        preview: 'Tu rival ha reportado el resultado de vuestra mesa. Confírmalo para cerrar la ronda.',
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
        await avisarPorTodo([m.player_a_id, m.player_b_id], {
          title: `Vuestra mesa está resuelta${torneo ? ` — ${torneo.name}` : ''}`,
          body: 'El organizador o un juez ha decidido el resultado. Entra a verlo.',
          link: torneo ? new URL(`/torneo?slug=${encodeURIComponent(torneo.slug)}`, sitio).href : new URL('/torneos', sitio).href,
          tag: 'torneo-resuelta',
          tipo: 'torneo_partida',
          subject: `Vuestra mesa está resuelta${torneo ? ` — ${torneo.name}` : ''}`,
          preview: 'El organizador o un juez ha decidido el resultado de vuestra mesa.',
        })
        avisosResueltas++
        await rest(`tournament_matches?id=eq.${m.id}`, clave, {
          method: 'PATCH',
          body: JSON.stringify({ resolved_notified_at: ahora.toISOString() }),
        })
      }
    }
  }

  return {
    ok: true,
    rondas: rondas.length,
    aperturas,
    promociones,
    avisados,
    caducadas,
    forfeitsCheckin,
    forfeitsTiempo,
    avisosCheckin,
    avisosConfirmar,
    avisosResueltas,
    correos,
    cancelaciones,
    recordatorios,
    borrados,
  }
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
