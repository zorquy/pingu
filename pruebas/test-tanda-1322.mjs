// Tanda 1322 — «Tu semana en PokeDoc», los lunes (P6 del plan). El resumen
// semanal (272, 821) ya llevaba tu colección y las respuestas en tus temas;
// ahora también tus cruces nuevos, tus jornadas y eventos de la semana y tu
// racha, con «Tu semana en PokeDoc» de asunto cuando hay algo tuyo, y sale
// aunque la comunidad haya estado tranquila (solo a quien tiene algo suyo).
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const rs = await import(`${REPO}/netlify/functions/resumen-semanal.mjs`)
const { lineasDeTuSemana, renderResumenSemanal } = await import(`${REPO}/js/email-plantilla.js`)
const AHORA = new Date('2026-11-16T08:10:00Z') // lunes

console.log('── Lo tuyo ──')
{
  const tu = rs.tuSemana({
    cruces: [{ recipient_id: 'a' }, { recipient_id: 'a' }, { recipient_id: 'b' }],
    torneos: [{ id: 't1', name: 'Liga FDN', matchday_dates: ['2026-11-12T18:00:00Z', '2026-11-19T18:00:00Z', '2026-11-26T18:00:00Z'] }],
    inscripciones: [{ tournament_id: 't1', user_id: 'a', status: 'active' }, { tournament_id: 't1', user_id: 'c', status: 'dropped' }],
    eventos: [{ id: 'e1', slug: 'trade-night', nombre: 'Trade night', empieza: '2026-11-21T17:00:00Z' }],
    asistentes: [{ evento_id: 'e1', user_id: 'a' }],
    perfiles: [{ id: 'a', current_streak: 12 }, { id: 'b', current_streak: 2 }],
    ahora: AHORA,
  })
  const a = tu.get('a')
  check('cruces de la semana, la jornada de ESTA semana (no la pasada ni la de dentro de dos), el evento con «Voy» y la racha', a.cruces === 2 && a.jornadas.length === 1 && a.jornadas[0].n === 2 && a.eventos[0].slug === 'trade-night' && a.racha === 12, JSON.stringify(a))
  check('quien dejó la liga no la recibe; una racha de 2 no cuenta', !tu.get('c') && !tu.get('b')?.racha && tu.get('b').cruces === 1)
  check('hayAlgoTuyo: sí con algo, no sin nada', rs.hayAlgoTuyo(a) && rs.hayAlgoTuyo({ cruces: 1 }) && !rs.hayAlgoTuyo({}) && !rs.hayAlgoTuyo(null) && !rs.hayAlgoTuyo({ racha: 2 }))
  const l = lineasDeTuSemana(a)
  check('en el correo: los cruces a Cruces, la jornada a su torneo, el evento a su ficha y la racha a los retos', l.some((x) => /^2 cruces nuevos/.test(x.texto) && x.ruta === '/mi-coleccion?ver=cambios') && l.some((x) => /^Liga FDN · Jornada 2, el jueves 19$/.test(x.texto) && x.ruta === '/torneo?id=t1') && l.some((x) => /^Trade night, el sábado 21: vas$/.test(x.texto) && x.ruta === '/eventos/trade-night') && l.some((x) => /12 días de racha/.test(x.texto) && x.ruta === '/retos'), JSON.stringify(l))
  const conTu = renderResumenSemanal({ temas: [], tu: a, siteUrl: 'https://pokedoc.es', unsubscribeUrl: 'https://pokedoc.es/baja' })
  const sinTu = renderResumenSemanal({ temas: [{ id: 'x', titulo: 'Iono', mensajes: 3 }], tu: null, siteUrl: 'https://pokedoc.es', unsubscribeUrl: 'https://pokedoc.es/baja' })
  check('el asunto: «Tu semana en PokeDoc» con algo tuyo, el de siempre sin nada', conTu.subject === 'Tu semana en PokeDoc' && sinTu.subject === 'Lo mejor de PokeDoc esta semana', `${conTu.subject} | ${sinTu.subject}`)
}

console.log('── La pasada ──')
function montarRest({ perfiles = [], posts = [], cruces = [] } = {}) {
  const encolado = []
  const rest = async (ruta, _c, o = {}) => {
    if (o.method === 'POST') { encolado.push(...JSON.parse(o.body)); return null }
    if (ruta.startsWith('user_profiles?')) return perfiles
    if (ruta.startsWith('forum_posts?')) return posts
    if (ruta.startsWith('forum_threads?')) return posts.length ? [{ id: 't1', title: 'Iono', post_count: 3 }] : []
    if (ruta.startsWith('user_notifications?')) return cruces
    return []
  }
  return { rest, encolado }
}
{
  // Una semana tranquila en la comunidad, pero «a» tiene un cruce.
  const m = montarRest({ perfiles: [{ id: 'a', notification_email_disabled: [], current_streak: 0 }, { id: 'b', notification_email_disabled: [] }], cruces: [{ recipient_id: 'a' }] })
  const r = await rs.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest: m.rest, ahora: AHORA })
  check('semana tranquila: solo le llega a quien tiene algo suyo', r.encolados === 1 && m.encolado.length === 1 && m.encolado[0].recipient_id === 'a', JSON.stringify(r))
  check('  …con «Tu semana en PokeDoc» de asunto y su cruce dentro', m.encolado[0].subject === 'Tu semana en PokeDoc' && JSON.parse(m.encolado[0].preview).tu.cruces === 1)
  const vacio = montarRest({ perfiles: [{ id: 'a', notification_email_disabled: [] }] })
  const r2 = await rs.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest: vacio.rest, ahora: AHORA })
  check('sin nada de nadie: no sale ninguno', r2.saltado && vacio.encolado.length === 0, JSON.stringify(r2))
  const apagado = montarRest({ perfiles: [{ id: 'a', notification_email_disabled: ['weekly_digest'] }], cruces: [{ recipient_id: 'a' }] })
  await rs.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest: apagado.rest, ahora: AHORA })
  check('quien lo apagó no lo recibe', apagado.encolado.length === 0)
  const comun = montarRest({ perfiles: [{ id: 'a', notification_email_disabled: [] }, { id: 'b', notification_email_disabled: [] }], posts: [{ thread_id: 't1', author_id: 'z' }] })
  const r3 = await rs.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest: comun.rest, ahora: AHORA })
  check('con algo de la comunidad: a todos, como siempre (y sin campanita aquí: la pone lunes.mjs)', r3.encolados === 2 && comun.encolado.every((f) => f.type === 'weekly_digest' && f.subject === 'Lo mejor de PokeDoc esta semana'), JSON.stringify(comun.encolado.map((f) => f.type)))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
