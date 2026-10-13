// «Lo mejor de PokeDoc esta semana»: un correo semanal con los temas
// más movidos del foro y la última guía aprobada. Corre los lunes por
// la mañana y ENCOLA un correo por persona en email_outbox — el envío
// de verdad lo hace la función de siempre (send-emails), con su baja de
// un clic y su respeto a las preferencias.
//
// Quién lo recibe: todo el mundo MENOS quien apagó `weekly_digest` en su
// perfil (o se dio de baja desde un correo). El correo solo sale si la
// semana tuvo algo que contar — un resumen vacío es la manera más rápida
// de que te manden a spam.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY. Sin ella, no hace
// nada y lo dice.

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

// La clave de la semana (año-semana ISO): con ella se deduplica — si la
// función corre dos veces el mismo lunes, nadie recibe el resumen doble.
export function claveSemana(ahora = new Date()) {
  const fecha = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
  fecha.setUTCDate(fecha.getUTCDate() + 4 - (fecha.getUTCDay() || 7))
  const inicioAno = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 1))
  const semana = Math.ceil(((fecha - inicioAno) / 86400000 + 1) / 7)
  return `digest:${fecha.getUTCFullYear()}-${String(semana).padStart(2, '0')}`
}

// Supabase corta a 1.000 filas sin avisar (la 808): lo que puede pasar de
// ahí se pide a trozos. Con más de mil perfiles, el resumen le llegaba solo
// a los mil primeros.
const TROZO = 1000
export async function todas(rest, ruta, clave, { maxTrozos = 50 } = {}) {
  const filas = []
  for (let i = 0; i < maxTrozos; i++) {
    const trozo = (await rest(`${ruta}&offset=${i * TROZO}&limit=${TROZO}`, clave)) || []
    filas.push(...trozo)
    if (trozo.length < TROZO) break
  }
  return filas
}

// Lo que sale ESTA semana (821, PO1): los sets occidentales con fecha entre
// hoy y dentro de siete días. Si falla, no hay bloque y ya.
export async function lanzamientosDeLaSemana(rest, clave, ahora = new Date()) {
  const hoy = ahora.toISOString().slice(0, 10)
  const hasta = new Date(ahora.getTime() + 7 * 86400e3).toISOString().slice(0, 10)
  try {
    const sets = await rest(`tcg_sets?market=eq.WEST&oculto=not.is.true&serie_id=neq.tcgp&release_date=gte.${hoy}&release_date=lte.${hasta}&select=id,name,name_en,release_date&order=release_date&limit=4`, clave)
    return (sets || []).map((x) => ({ nombre: x.name_en || x.name, fecha: x.release_date }))
  } catch {
    return []
  }
}

// «Tu semana» (821, PO1): lo de cada persona, con pocas consultas para
// todos a la vez (una función programada muere a los 30 s).
//   · el valor de su colección hoy contra hace siete días (la foto diaria
//     de `user_collection_value`, tanda 377);
//   · cuántos mensajes nuevos, de OTROS, hay en los temas que sigue.
// Lo que no se sabe no se pone: sin las dos fotos, no hay cifra de valor.
export function tuSemana({ valoresHoy = [], valoresAntes = [], suscripciones = [], posts = [] }) {
  const antes = new Map(valoresAntes.map((v) => [v.user_id, Number(v.valor)]))
  const porUsuario = new Map()
  const de = (id) => { if (!porUsuario.has(id)) porUsuario.set(id, {}); return porUsuario.get(id) }
  for (const v of valoresHoy) {
    const hoy = Number(v.valor)
    if (!Number.isFinite(hoy) || hoy <= 0) continue
    const t = de(v.user_id)
    t.valor = Math.round(hoy * 100) / 100
    if (antes.has(v.user_id) && Number.isFinite(antes.get(v.user_id))) t.cambio = Math.round((hoy - antes.get(v.user_id)) * 100) / 100
  }
  const sigue = new Map()
  for (const s of suscripciones) { if (!sigue.has(s.thread_id)) sigue.set(s.thread_id, []); sigue.get(s.thread_id).push(s.user_id) }
  for (const p of posts) {
    for (const u of sigue.get(p.thread_id) || []) {
      if (u === p.author_id) continue
      const t = de(u)
      t.respuestas = (t.respuestas || 0) + 1
    }
  }
  return porUsuario
}

// Junta el contenido de la semana: los 3 temas con más mensajes en los
// últimos 7 días y la guía aprobada más reciente (si es de esta semana).
export async function contenidoSemanal(rest, clave) {
  const desde = new Date(Date.now() - 7 * 86400e3).toISOString()

  // PostgREST no agrupa: se piden los mensajes de la semana (id + tema)
  // y se cuenta aquí. Con tope: en una semana loca, 2000 mensajes ya
  // dicen de sobra cuáles son los hilos calientes.
  const posts = await rest(`forum_posts?created_at=gte.${encodeURIComponent(desde)}&select=thread_id,author_id&limit=2000`, clave)
  const cuenta = {}
  for (const p of posts || []) if (p.thread_id) cuenta[p.thread_id] = (cuenta[p.thread_id] || 0) + 1
  const topIds = Object.entries(cuenta)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id)

  const temas = topIds.length
    ? await rest(`forum_threads?id=in.(${topIds.join(',')})&select=id,title,post_count`, clave)
    : []
  // El orden del in.() no se respeta: se reordena por los conteos.
  const temasOrdenados = topIds.map((id) => (temas || []).find((t) => t.id === id)).filter(Boolean)

  const guias = await rest(
    `guides?review_status=eq.approved&published_at=gte.${encodeURIComponent(desde)}&select=title,slug&order=published_at.desc&limit=1`,
    clave
  )

  // Las noticias de la semana (tanda 272).
  //
  // POR QUÉ AQUÍ Y NO UN CORREO POR NOTICIA: con tres o cuatro noticias
  // por semana, avisar de cada una es la forma más rápida de que 150
  // personas se den de baja. El resumen ya existe, ya tiene su baja de un
  // clic y su dedupe, y una vez por semana sí se lee. Quien las quiera al
  // momento tiene el canal RSS (/rss.xml, tanda 271).
  //
  // Con vuelta atrás: mientras la migración de noticias no esté puesta la
  // columna `kind` no existe, y pedirla tumbaría el resumen ENTERO —
  // incluida la parte del foro, que no tiene nada que ver.
  let noticias = []
  try {
    noticias =
      (await rest(
        `guides?kind=eq.news&published_at=gte.${encodeURIComponent(desde)}&select=title,slug,published_at&order=published_at.desc&limit=4`,
        clave
      )) || []
  } catch {
    noticias = []
  }

  return { temas: temasOrdenados, mensajesPorTema: cuenta, guia: guias?.[0] || null, noticias, posts: posts || [] }
}

export async function procesar({ env = process.env, rest = restReal, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: true, saltado: 'sin SUPABASE_SERVICE_ROLE_KEY: no se encola nada' }

  const semana = claveSemana(ahora)
  const { temas, mensajesPorTema, guia, noticias, posts } = await contenidoSemanal(rest, clave)
  const lanzamientos = await lanzamientosDeLaSemana(rest, clave, ahora)

  // Semana sin vida = sin correo. Mejor callar que escribir para nada.
  // Una semana con noticias SÍ tiene algo que contar aunque el foro haya
  // estado tranquilo, y una con un lanzamiento también (821).
  if (temas.length === 0 && !guia && (noticias || []).length === 0 && lanzamientos.length === 0) {
    return { ok: true, saltado: 'semana sin contenido: no se manda nada' }
  }

  // «Tu semana» (821). Cada consulta va por su lado y en un `try`: si una
  // tabla no está (o falla), el resumen sale igual, sin esa línea.
  const dia = (n) => new Date(ahora.getTime() - n * 86400e3).toISOString().slice(0, 10)
  const pedir = async (ruta) => { try { return await todas(rest, ruta, clave) } catch { return [] } }
  const [valoresHoy, valoresAntes, suscripciones] = await Promise.all([
    pedir(`user_collection_value?dia=eq.${dia(1)}&select=user_id,valor`),
    pedir(`user_collection_value?dia=eq.${dia(8)}&select=user_id,valor`),
    pedir(`forum_subscriptions?select=user_id,thread_id`),
  ])
  const tuyo = tuSemana({ valoresHoy, valoresAntes, suscripciones, posts })

  // El cuerpo va ESTRUCTURADO (JSON en `preview`): send-emails lo pinta
  // con la plantilla propia del resumen (renderResumenSemanal, en
  // lib/email.mjs) — cada tema con su enlace y la guía con el suyo. La
  // primera versión encolaba texto plano y el correo salía como un
  // bloque sin saltos ni enlaces, metido en la cita genérica de los
  // avisos de una línea.
  const comun = {
    temas: temas.map((t) => ({ id: t.id, titulo: t.title, mensajes: mensajesPorTema[t.id] || 0 })),
    guia: guia ? { titulo: guia.title, slug: guia.slug } : null,
    noticias: (noticias || []).map((n) => ({ titulo: n.title, slug: n.slug })),
    lanzamientos,
  }
  const previewDe = (id) => JSON.stringify(tuyo.has(id) ? { ...comun, tu: tuyo.get(id) } : comun)

  // A quién: todos los perfiles con el resumen semanal encendido (a trozos).
  const perfiles = await todas(rest, `user_profiles?select=id,notification_email_disabled&order=id`, clave)
  const destinatarios = (perfiles || [])
    .filter((p) => !(p.notification_email_disabled || []).includes('weekly_digest'))
    .map((p) => p.id)

  // La dedupe: quien ya tenga el resumen de ESTA semana encolado o
  // enviado no repite.
  const yaEncolados = await todas(rest, `email_outbox?type=eq.weekly_digest&thread_key=eq.${encodeURIComponent(semana)}&select=recipient_id`, clave)
  const yaTienen = new Set((yaEncolados || []).map((f) => f.recipient_id))
  const nuevos = destinatarios.filter((id) => !yaTienen.has(id))

  if (nuevos.length === 0) return { ok: true, semana, encolados: 0 }

  const filas = nuevos.map((id) => ({
    recipient_id: id,
    type: 'weekly_digest',
    subject: 'Lo mejor de PokeDoc esta semana',
    preview: previewDe(id),
    link: '/foro',
    thread_key: semana,
  }))
  // A trozos también al escribir: una petición con miles de filas es lenta y
  // si falla, falla entera.
  for (let i = 0; i < filas.length; i += 500) await rest(`email_outbox`, clave, { method: 'POST', body: JSON.stringify(filas.slice(i, i + 500)) })

  return { ok: true, semana, encolados: nuevos.length, temas: temas.length, guia: !!guia }
}

export default async function handler() {
  const resultado = await procesar()
  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

// Los lunes a las 08:10 UTC: el correo del arranque de semana.
export const config = { schedule: '10 8 * * 1' }
