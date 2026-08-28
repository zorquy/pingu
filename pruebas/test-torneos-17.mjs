import { procesar } from '/home/user/pingu/netlify/functions/torneos-barredor.mjs'

// Tanda 223: los avisos que faltaban — cancelación (con borrado
// diferido), recordatorio antes de empezar, y TODO también por correo.
//
// No hace falta navegador ni doble de Supabase: el barredor recibe su
// `rest` por parámetro, así que el mundo se monta aquí mismo.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

// Un PostgREST de mentira, con lo justo que usa el barredor.
function mundoFalso(datos) {
  const m = { ...datos, enviados: [], correos: [], campanas: [], borradas: [] }
  m.rest = async (ruta, _clave, opciones = {}) => {
    const [tabla, query = ''] = ruta.split('?')
    const metodo = opciones.method || 'GET'
    if (metodo === 'POST') {
      const filas = JSON.parse(opciones.body)
      if (tabla === 'email_outbox') m.correos.push(...filas)
      else if (tabla === 'user_notifications') m.campanas.push(...filas)
      else (m[tabla] = m[tabla] || []).push(...filas)
      return null
    }
    let filas = m[tabla] || []
    for (const [, col, val] of query.matchAll(/(?:^|&)(\w+)=eq\.([^&]+)/g)) {
      filas = filas.filter((f) => String(f[col]) === decodeURIComponent(val))
    }
    for (const [, col] of query.matchAll(/(\w+)=is\.null/g)) {
      filas = filas.filter((f) => f[col] === null || f[col] === undefined)
    }
    for (const [, col, valores] of query.matchAll(/(\w+)=in\.\(([^)]*)\)/g)) {
      const set = new Set(valores.split(','))
      filas = filas.filter((f) => set.has(String(f[col])))
    }
    for (const [, col, val] of query.matchAll(/(\w+)=gte\.([^&]+)/g)) {
      filas = filas.filter((f) => new Date(f[col]) >= new Date(decodeURIComponent(val)))
    }
    for (const [, col, val] of query.matchAll(/(\w+)=lte\.([^&]+)/g)) {
      filas = filas.filter((f) => new Date(f[col]) <= new Date(decodeURIComponent(val)))
    }
    if (metodo === 'PATCH') {
      const cambios = JSON.parse(opciones.body)
      filas.forEach((f) => Object.assign(f, cambios))
      return null
    }
    if (metodo === 'DELETE') {
      m.borradas.push({ tabla, ids: filas.map((f) => f.id) })
      m[tabla] = (m[tabla] || []).filter((f) => !filas.includes(f))
      return null
    }
    return filas
  }
  m.enviar = (sub, cuerpo) => m.enviados.push({ endpoint: sub.endpoint, cuerpo: JSON.parse(cuerpo) })
  return m
}

const ENV = { SUPABASE_SERVICE_ROLE_KEY: 'clave', PUSH_VAPID_PRIVATE: 'priv' }
const AJUSTES = [{ key: 'push_vapid_public', value: { clave: 'pub' } }]
const correr = (m, ahora = new Date()) => procesar({ env: ENV, rest: m.rest, enviar: m.enviar, ahora })

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Cancelar un torneo avisa a los inscritos ──')
{
  const m = mundoFalso({
    tournaments: [{ id: 't-1', slug: 'copa', name: 'Copa Cola', status: 'cancelled', cancel_notified_at: null, delete_after_notice_at: null }],
    tournament_registrations: [
      { id: 'r-1', tournament_id: 't-1', user_id: 'ash', status: 'active' },
      { id: 'r-2', tournament_id: 't-1', user_id: 'zoe', status: 'waitlisted' },
      { id: 'r-3', tournament_id: 't-1', user_id: 'ida', status: 'dropped' },
    ],
    push_subscriptions: [{ endpoint: 'e-ash', user_id: 'ash', p256dh: 'p', auth: 'a' }],
    user_profiles: [
      { id: 'ash', notification_email_disabled: [], notification_prefs_disabled: [] },
      { id: 'zoe', notification_email_disabled: [], notification_prefs_disabled: [] },
      { id: 'ida', notification_email_disabled: [], notification_prefs_disabled: [] },
    ],
    site_settings: AJUSTES,
    rounds: [],
  })
  const r = await correr(m)
  check('cuenta una cancelación', r.cancelaciones === 1, JSON.stringify(r.cancelaciones))
  check('avisa por push a quien lo tiene', m.enviados.length === 1 && /cancelado/i.test(m.enviados[0].cuerpo.title), JSON.stringify(m.enviados.map((e) => e.endpoint)))
  // La cola de espera TAMBIÉN se entera: estaba esperando sitio en algo
  // que ya no va a existir. Quien se dio de baja, no.
  const aQuien = m.correos.map((c) => c.recipient_id).sort()
  check('encola correo para el inscrito y el de la cola', JSON.stringify(aQuien) === '["ash","zoe"]', JSON.stringify(aQuien))
  check('y NO para quien se había dado de baja', !aQuien.includes('ida'))
  check('el correo lleva su tipo', m.correos.every((c) => c.type === 'torneo_cancelado'), JSON.stringify(m.correos.map((c) => c.type)))

  const r2 = await correr(m)
  check('a la segunda pasada ya no repite', r2.cancelaciones === 0 && m.correos.length === 2, `${r2.cancelaciones} · ${m.correos.length} correos`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Borrado diferido: primero avisa, después borra ──')
{
  const m = mundoFalso({
    tournaments: [{ id: 't-2', slug: 'fin', name: 'Copa Final', status: 'cancelled', cancel_notified_at: null, delete_after_notice_at: '2026-08-28T10:00:00Z' }],
    tournament_registrations: [{ id: 'r-1', tournament_id: 't-2', user_id: 'ash', status: 'active' }],
    push_subscriptions: [{ endpoint: 'e-ash', user_id: 'ash', p256dh: 'p', auth: 'a' }],
    user_profiles: [{ id: 'ash', notification_email_disabled: [], notification_prefs_disabled: [] }],
    site_settings: AJUSTES,
    rounds: [],
  })
  const r = await correr(m)
  check('avisa antes de borrar', m.correos.length === 1 && m.enviados.length === 1)
  check('y borra el torneo', r.borrados === 1 && !m.tournaments.length, JSON.stringify({ borrados: r.borrados, quedan: m.tournaments.length }))
  // El enlace del correo no puede ir a la ficha: no va a existir.
  check('el enlace lleva a la lista, no a una ficha muerta', /\/torneos$/.test(m.correos[0].link), m.correos[0].link)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Un torneo cancelado y ya avisado no se toca ──')
{
  const m = mundoFalso({
    tournaments: [{ id: 't-3', slug: 'vieja', name: 'Copa Vieja', status: 'cancelled', cancel_notified_at: '2026-08-01T10:00:00Z', delete_after_notice_at: null }],
    tournament_registrations: [{ id: 'r-1', tournament_id: 't-3', user_id: 'ash', status: 'active' }],
    push_subscriptions: [{ endpoint: 'e-ash', user_id: 'ash', p256dh: 'p', auth: 'a' }],
    user_profiles: [{ id: 'ash', notification_email_disabled: [], notification_prefs_disabled: [] }],
    site_settings: AJUSTES,
    rounds: [],
  })
  const r = await correr(m)
  check('ni avisa ni borra', r.cancelaciones === 0 && !m.correos.length && m.tournaments.length === 1)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El recordatorio de «empieza pronto» ──')
{
  const ahora = new Date('2026-08-28T10:00:00Z')
  const m = mundoFalso({
    tournaments: [
      // Dentro de media hora: le toca.
      { id: 't-a', slug: 'ya', name: 'Copa Inminente', status: 'registration_closed', reminder_notified_at: null, start_at: '2026-08-28T10:30:00Z' },
      // Mañana: todavía no.
      { id: 't-b', slug: 'luego', name: 'Copa de Mañana', status: 'registration_open', reminder_notified_at: null, start_at: '2026-08-29T10:00:00Z' },
      // Empezó hace un rato: ya no es un recordatorio.
      { id: 't-c', slug: 'tarde', name: 'Copa Pasada', status: 'registration_closed', reminder_notified_at: null, start_at: '2026-08-28T09:00:00Z' },
    ],
    tournament_registrations: [
      { id: 'r-1', tournament_id: 't-a', user_id: 'ash', status: 'active' },
      { id: 'r-2', tournament_id: 't-a', user_id: 'zoe', status: 'waitlisted' },
      { id: 'r-3', tournament_id: 't-b', user_id: 'ash', status: 'active' },
      { id: 'r-4', tournament_id: 't-c', user_id: 'ash', status: 'active' },
    ],
    push_subscriptions: [{ endpoint: 'e-ash', user_id: 'ash', p256dh: 'p', auth: 'a' }],
    user_profiles: [{ id: 'ash', notification_email_disabled: [], notification_prefs_disabled: [] }, { id: 'zoe', notification_email_disabled: [], notification_prefs_disabled: [] }],
    site_settings: AJUSTES,
    rounds: [],
  })
  const r = await correr(m, ahora)
  check('avisa de UNO solo', r.recordatorios === 1, JSON.stringify(r.recordatorios))
  check('y es el que empieza dentro de media hora', m.correos.length === 1 && /Inminente/.test(m.correos[0].subject), JSON.stringify(m.correos.map((c) => c.subject)))
  // Quien está en la cola de espera no juega: no se le recuerda nada.
  check('a la lista de espera no se le recuerda', m.correos[0].recipient_id === 'ash', m.correos[0].recipient_id)
  check('el de mañana sigue sin marca', m.tournaments.find((t) => t.id === 't-b').reminder_notified_at === null)
  check('el que ya empezó, tampoco se avisa', !m.correos.some((c) => /Pasada/.test(c.subject)))

  const r2 = await correr(m, ahora)
  check('no se repite en la pasada siguiente', r2.recordatorios === 0)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Quien apagó ese correo, no lo recibe ──')
{
  const m = mundoFalso({
    tournaments: [{ id: 't-4', slug: 'copa', name: 'Copa Cola', status: 'cancelled', cancel_notified_at: null, delete_after_notice_at: null }],
    tournament_registrations: [
      { id: 'r-1', tournament_id: 't-4', user_id: 'ash', status: 'active' },
      { id: 'r-2', tournament_id: 't-4', user_id: 'zoe', status: 'active' },
    ],
    push_subscriptions: [{ endpoint: 'e-zoe', user_id: 'zoe', p256dh: 'p', auth: 'a' }],
    user_profiles: [
      { id: 'ash', notification_email_disabled: [], notification_prefs_disabled: [] },
      // zoe apagó los correos de torneo cancelado, pero NO el push.
      { id: 'zoe', notification_email_disabled: ['torneo_cancelado'] },
    ],
    site_settings: AJUSTES,
    rounds: [],
  })
  await correr(m)
  const aQuien = m.correos.map((c) => c.recipient_id)
  check('a quien lo apagó no le llega correo', !aQuien.includes('zoe'), JSON.stringify(aQuien))
  check('al que no lo apagó, sí', aQuien.includes('ash'), JSON.stringify(aQuien))
  // Apagar el CORREO no apaga el push: son dos preferencias distintas,
  // igual que en el resto del sitio.
  check('pero el push le sigue llegando', m.enviados.some((e) => e.endpoint === 'e-zoe'), JSON.stringify(m.enviados.map((e) => e.endpoint)))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Sin clave de push, el correo sale igual ──')
{
  // Es el caso que de verdad importa del cambio: hasta ahora, sin push
  // no había NADA. El correo no puede depender de la fontanería del push.
  const m = mundoFalso({
    tournaments: [{ id: 't-5', slug: 'copa', name: 'Copa Cola', status: 'cancelled', cancel_notified_at: null, delete_after_notice_at: null }],
    tournament_registrations: [{ id: 'r-1', tournament_id: 't-5', user_id: 'ash', status: 'active' }],
    push_subscriptions: [],
    user_profiles: [{ id: 'ash', notification_email_disabled: [], notification_prefs_disabled: [] }],
    site_settings: [],
    rounds: [],
  })
  const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'clave' }, rest: m.rest, enviar: m.enviar, ahora: new Date() })
  check('sin push configurado, el correo se encola', m.correos.length === 1, JSON.stringify(m.correos.length))
  check('y la cancelación se cuenta igual', r.cancelaciones === 1, JSON.stringify(r.cancelaciones))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. La campanita (tanda 224) ──')
{
  const m = mundoFalso({
    tournaments: [{ id: 't-6', slug: 'copa', name: 'Copa Cola', status: 'cancelled', cancel_notified_at: null, delete_after_notice_at: null }],
    tournament_registrations: [
      { id: 'r-1', tournament_id: 't-6', user_id: 'ash', status: 'active' },
      { id: 'r-2', tournament_id: 't-6', user_id: 'zoe', status: 'active' },
    ],
    push_subscriptions: [{ endpoint: 'e-ash', user_id: 'ash', p256dh: 'p', auth: 'a' }],
    user_profiles: [
      { id: 'ash', notification_email_disabled: [], notification_prefs_disabled: [] },
      // zoe apagó la campanita de cancelados, pero no el correo.
      { id: 'zoe', notification_email_disabled: [], notification_prefs_disabled: ['torneo_cancelado'] },
    ],
    site_settings: AJUSTES,
    rounds: [],
  })
  const r = await correr(m)
  check('deja rastro en la campanita', m.campanas.length === 1, JSON.stringify(m.campanas.length))
  check('con su tipo', m.campanas[0]?.type === 'torneo_cancelado', m.campanas[0]?.type)
  check('y lo cuenta', r.campanas === 1, JSON.stringify(r.campanas))
  check('a quien la apagó no le llega', !m.campanas.some((c) => c.recipient_id === 'zoe'), JSON.stringify(m.campanas.map((c) => c.recipient_id)))
  check('pero el correo sí le llega (son preferencias distintas)', m.correos.some((c) => c.recipient_id === 'zoe'))
  // Lo que evita el aviso por duplicado: enviar-push.mjs recorre la
  // campanita sin empujar cada cinco minutos. Si esto no viniera
  // marcado, cada aviso saldría dos veces.
  check('viene marcado como ya empujado', Boolean(m.campanas[0]?.pushed_at), JSON.stringify(m.campanas[0]?.pushed_at))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. Sin push configurado, la campanita queda por empujar ──')
{
  // Al revés que el caso de arriba: si aquí no se ha empujado, hay que
  // dejar que lo haga enviar-push.mjs cuando el push esté puesto.
  const m = mundoFalso({
    tournaments: [{ id: 't-7', slug: 'copa', name: 'Copa Cola', status: 'cancelled', cancel_notified_at: null, delete_after_notice_at: null }],
    tournament_registrations: [{ id: 'r-1', tournament_id: 't-7', user_id: 'ash', status: 'active' }],
    push_subscriptions: [],
    user_profiles: [{ id: 'ash', notification_email_disabled: [], notification_prefs_disabled: [] }],
    site_settings: [],
    rounds: [],
  })
  await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'clave' }, rest: m.rest, enviar: m.enviar, ahora: new Date() })
  check('la campanita se escribe igual', m.campanas.length === 1)
  check('y SIN marcar, para que la empuje quien toca', m.campanas[0]?.pushed_at === null, JSON.stringify(m.campanas[0]?.pushed_at))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 9. Cuando el torneo termina (tanda 224) ──')
{
  const m = mundoFalso({
    tournaments: [{ id: 't-8', slug: 'fin', name: 'Copa Final', status: 'finished', finish_notified_at: null, champion_id: 'ash' }],
    tournament_registrations: [
      { id: 'r-1', tournament_id: 't-8', user_id: 'ash', status: 'active' },
      { id: 'r-2', tournament_id: 't-8', user_id: 'zoe', status: 'active' },
      // Quien se retiró a mitad también jugó: se le avisa.
      { id: 'r-3', tournament_id: 't-8', user_id: 'ida', status: 'dropped' },
      // Quien se quedó en la cola, no: nunca llegó a jugar.
      { id: 'r-4', tournament_id: 't-8', user_id: 'noa', status: 'waitlisted' },
    ],
    push_subscriptions: [],
    user_profiles: ['ash', 'zoe', 'ida', 'noa'].map((id) => ({ id, notification_email_disabled: [], notification_prefs_disabled: [] })),
    site_settings: AJUSTES,
    rounds: [],
  })
  const r = await correr(m)
  check('cuenta un final', r.finales === 1, JSON.stringify(r.finales))
  const aQuien = m.campanas.map((c) => c.recipient_id).sort()
  check('avisa a los tres que jugaron', JSON.stringify(aQuien) === '["ash","ida","zoe"]', JSON.stringify(aQuien))
  check('y no a quien se quedó en la cola', !aQuien.includes('noa'))
  const delCampeon = m.campanas.find((c) => c.recipient_id === 'ash')
  check('al campeón se le felicita', /has ganado/i.test(delCampeon?.title || ''), delCampeon?.title)
  const deOtro = m.campanas.find((c) => c.recipient_id === 'zoe')
  check('al resto se le manda a la clasificación', /terminado/i.test(deOtro?.title || ''), deOtro?.title)
  check('el enlace lleva a la ficha', /\/torneo\?slug=fin/.test(deOtro?.link || ''), deOtro?.link)

  const r2 = await correr(m)
  check('no se repite en la pasada siguiente', r2.finales === 0)
}

console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
