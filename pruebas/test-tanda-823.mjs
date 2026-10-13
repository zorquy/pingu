// Tanda 823 (PO1) — el resumen del lunes, con «Tu semana» y lo que sale.
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const rs = await import(`${RAIZ}/netlify/functions/resumen-semanal.mjs`)
const { renderResumenSemanal, lineasDeTuSemana } = await import(`${RAIZ}/netlify/lib/email.mjs`).then(async (m) => ({ ...m, ...(await import(`${RAIZ}/js/email-plantilla.js`)) }))
const AHORA = new Date('2026-10-19T08:10:00Z')

console.log('── Tu semana ──')
{
  const t = rs.tuSemana({
    valoresHoy: [{ user_id: 'u1', valor: 120.5 }, { user_id: 'u2', valor: 40 }, { user_id: 'u3', valor: 0 }],
    valoresAntes: [{ user_id: 'u1', valor: 100 }],
    suscripciones: [{ user_id: 'u1', thread_id: 't1' }, { user_id: 'u2', thread_id: 't1' }],
    posts: [{ thread_id: 't1', author_id: 'u2' }, { thread_id: 't1', author_id: 'u3' }, { thread_id: 't9', author_id: 'u3' }],
  })
  check('el valor y lo que ha cambiado en la semana', t.get('u1').valor === 120.5 && t.get('u1').cambio === 20.5)
  check('  …sin foto de hace una semana, no hay cambio (no se inventa)', t.get('u2').valor === 40 && t.get('u2').cambio === undefined)
  check('  …y una colección a cero no dice nada', !t.get('u3')?.valor)
  check('los mensajes de OTROS en lo que sigues', t.get('u1').respuestas === 2 && t.get('u2').respuestas === 1, JSON.stringify([...t]))
  const l = lineasDeTuSemana({ valor: 120.5, cambio: -3.25, respuestas: 1 })
  check('en el correo: «Tu colección vale 120,50 € (−3,25 € en la semana)» y «1 mensaje nuevo»', /120,50 €/.test(l[0]?.texto) && /−3,25 € en la semana/.test(l[0].texto) && /^1 mensaje nuevo en temas que sigues$/.test(l[1]?.texto), JSON.stringify(l))
}

console.log('\n── La pasada ──')
function montarRest({ perfiles = [], posts = [], sets = [], hoy = [], antes = [], subs = [] } = {}) {
  const encolado = []
  const pedidas = []
  const rest = async (ruta, _c, o = {}) => {
    pedidas.push(ruta)
    if (o.method === 'POST') { encolado.push(...JSON.parse(o.body)); return null }
    const off = Number((ruta.match(/offset=(\d+)/) || [])[1] || 0)
    const trozo = (lista) => lista.slice(off, off + 1000)
    if (ruta.startsWith('user_profiles?')) return trozo(perfiles)
    if (ruta.startsWith('forum_posts?')) return posts
    if (ruta.startsWith('forum_threads?')) return [{ id: 't1', title: 'Iono', post_count: 3 }]
    if (ruta.startsWith('tcg_sets?')) return sets
    if (ruta.startsWith('user_collection_value?dia=eq.2026-10-18')) return trozo(hoy)
    if (ruta.startsWith('user_collection_value?dia=eq.2026-10-11')) return trozo(antes)
    if (ruta.startsWith('forum_subscriptions?')) return trozo(subs)
    return []
  }
  return { rest, encolado, pedidas }
}
{
  const perfiles = Array.from({ length: 1500 }, (_, i) => ({ id: `u${i}`, notification_email_disabled: [] }))
  const m = montarRest({ perfiles, posts: [{ thread_id: 't1', author_id: 'u9' }], hoy: [{ user_id: 'u1', valor: 50 }], antes: [{ user_id: 'u1', valor: 45 }], subs: [{ user_id: 'u1', thread_id: 't1' }], sets: [{ id: 'sv11', name: 'Destined Rivals', release_date: '2026-10-22' }] })
  const r = await rs.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest: m.rest, ahora: AHORA })
  check('con más de mil perfiles, llega a TODOS (antes se cortaba en mil)', r.encolados === 1500 && m.encolado.length === 1500, r.encolados)
  const u1 = JSON.parse(m.encolado.find((f) => f.recipient_id === 'u1').preview)
  const u2 = JSON.parse(m.encolado.find((f) => f.recipient_id === 'u2').preview)
  check('cada uno con lo suyo: u1 con su valor, cambio y respuesta', u1.tu?.valor === 50 && u1.tu.cambio === 5 && u1.tu.respuestas === 1, JSON.stringify(u1.tu))
  check('  …y u2, sin nada suyo, sin bloque «tu»', !u2.tu)
  check('  …y todos con lo que sale esta semana', u1.lanzamientos?.[0]?.nombre === 'Destined Rivals' && u2.lanzamientos?.length === 1)
  check('los lanzamientos: de hoy a siete días, occidentales y a la vista', m.pedidas.some((p) => /^tcg_sets\?market=eq\.WEST&oculto=not\.is\.true&serie_id=neq\.tcgp&release_date=gte\.2026-10-19&release_date=lte\.2026-10-26/.test(p)))
}
{
  const m = montarRest({ perfiles: [{ id: 'u1', notification_email_disabled: [] }], sets: [{ id: 'x', name: 'Algo', release_date: '2026-10-20' }] })
  const r = await rs.procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, rest: m.rest, ahora: AHORA })
  check('una semana solo con un lanzamiento también tiene correo', r.encolados === 1, JSON.stringify(r))
}
{
  const correo = renderResumenSemanal({ temas: [], noticias: [], lanzamientos: [{ nombre: 'Destined Rivals', fecha: '2026-10-22' }], tu: { valor: 50, cambio: 5, respuestas: 2 }, siteUrl: 'https://pokedoc.es', unsubscribeUrl: 'https://pokedoc.es/baja-correo?t=x' })
  check('el correo pinta «Tu semana» primero y el lanzamiento con su día', /Tu colección vale 50,00 € \(\+5,00 € en la semana\)/.test(correo.text) && /Sale el jueves, 22 de octubre: Destined Rivals/.test(correo.text) && correo.text.indexOf('Tu colección') < correo.text.indexOf('Destined'), correo.text.slice(0, 400))
  check('  …y en el HTML', /Tu semana/.test(correo.html) && /Destined Rivals/.test(correo.html) && /\/mi-coleccion/.test(correo.html))
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
