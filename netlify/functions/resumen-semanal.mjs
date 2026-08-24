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

// Junta el contenido de la semana: los 3 temas con más mensajes en los
// últimos 7 días y la guía aprobada más reciente (si es de esta semana).
export async function contenidoSemanal(rest, clave) {
  const desde = new Date(Date.now() - 7 * 86400e3).toISOString()

  // PostgREST no agrupa: se piden los mensajes de la semana (id + tema)
  // y se cuenta aquí. Con tope: en una semana loca, 2000 mensajes ya
  // dicen de sobra cuáles son los hilos calientes.
  const posts = await rest(`forum_posts?created_at=gte.${encodeURIComponent(desde)}&select=thread_id&limit=2000`, clave)
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

  return { temas: temasOrdenados, mensajesPorTema: cuenta, guia: guias?.[0] || null }
}

export async function procesar({ env = process.env, rest = restReal, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: true, saltado: 'sin SUPABASE_SERVICE_ROLE_KEY: no se encola nada' }

  const semana = claveSemana(ahora)
  const { temas, mensajesPorTema, guia } = await contenidoSemanal(rest, clave)

  // Semana sin vida = sin correo. Mejor callar que escribir para nada.
  if (temas.length === 0 && !guia) return { ok: true, saltado: 'semana sin contenido: no se manda nada' }

  // El cuerpo va ESTRUCTURADO (JSON en `preview`): send-emails lo pinta
  // con la plantilla propia del resumen (renderResumenSemanal, en
  // lib/email.mjs) — cada tema con su enlace y la guía con el suyo. La
  // primera versión encolaba texto plano y el correo salía como un
  // bloque sin saltos ni enlaces, metido en la cita genérica de los
  // avisos de una línea.
  const preview = JSON.stringify({
    temas: temas.map((t) => ({ id: t.id, titulo: t.title, mensajes: mensajesPorTema[t.id] || 0 })),
    guia: guia ? { titulo: guia.title, slug: guia.slug } : null,
  })

  // A quién: todos los perfiles con el resumen semanal encendido.
  const perfiles = await rest(`user_profiles?select=id,notification_email_disabled&limit=10000`, clave)
  const destinatarios = (perfiles || [])
    .filter((p) => !(p.notification_email_disabled || []).includes('weekly_digest'))
    .map((p) => p.id)

  // La dedupe: quien ya tenga el resumen de ESTA semana encolado o
  // enviado no repite.
  const yaEncolados = await rest(
    `email_outbox?type=eq.weekly_digest&thread_key=eq.${encodeURIComponent(semana)}&select=recipient_id&limit=10000`,
    clave
  )
  const yaTienen = new Set((yaEncolados || []).map((f) => f.recipient_id))
  const nuevos = destinatarios.filter((id) => !yaTienen.has(id))

  if (nuevos.length === 0) return { ok: true, semana, encolados: 0 }

  const filas = nuevos.map((id) => ({
    recipient_id: id,
    type: 'weekly_digest',
    subject: 'Lo mejor de PokeDoc esta semana',
    preview,
    link: '/foro',
    thread_key: semana,
  }))
  await rest(`email_outbox`, clave, { method: 'POST', body: JSON.stringify(filas) })

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
