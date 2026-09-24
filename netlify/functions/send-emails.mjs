import { renderFilaDeCola, sendEmail, PROVEEDORES } from '../lib/email.mjs'
import { smtpConfigDesdeEntorno, sendViaSmtp, crearTransporteSmtp } from '../lib/email-smtp.mjs'

// Vacía la cola de correo (`email_outbox`) y envía lo pendiente.
//
// Se ejecuta sola cada 5 minutos. Se eligió esto en vez de un webhook de
// Supabase por dos motivos: no hay que configurar nada en el panel de
// Supabase (todo vive en el repositorio) y, si el proveedor de correo
// está caído, la siguiente pasada lo reintenta sola en vez de perderse
// el aviso.
//
// VARIABLES DE ENTORNO (en Netlify → Site settings → Environment variables)
//
//   SUPABASE_SERVICE_ROLE_KEY  obligatoria. Se salta la RLS: es la única
//                              forma de leer la cola y de resolver la
//                              dirección de correo desde auth.users.
//                              NO la pongas en ningún fichero del repo.
//   EMAIL_PROVIDER             smtp | resend | brevo | postmark | mailgun | sendgrid
//   EMAIL_FROM                 p.ej. PokeDoc <avisos@pokedoc.es>
//   SITE_URL                   opcional, por defecto https://pokedoc.es
//
//   Con EMAIL_PROVIDER=smtp (buzón normal: Hostinger, Zoho, Gmail...):
//   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
//
//   Con un proveedor de API HTTP:
//   EMAIL_API_KEY, y EMAIL_MAILGUN_DOMAIN solo si usas Mailgun
//
// Si falta la configuración de envío, la función NO falla: no hace nada
// y lo dice. Así se puede desplegar todo esto antes de tener el correo
// listo sin que el registro de Netlify se llene de errores rojos.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const POR_PASADA = 50
const MAX_INTENTOS = 5

// ── Por qué se RECLAMA antes de mandar (tanda 350) ──
//
// Una función programada de Netlify se mata a los 30 segundos. Esta
// pasada mandaba el correo y DESPUÉS marcaba la fila, así que al morir a
// mitad dejaba en `pending` filas ya enviadas — y la pasada siguiente,
// cinco minutos después, las volvía a mandar. Con dos avisos sueltos no
// se nota; con el resumen semanal, que encola una fila por persona, la
// gente recibía el mismo correo tres veces.
//
// Ahora se reclaman primero (status `sending`) con un UPDATE
// condicionado a que sigan `pending`: lo resuelve Postgres, así que dos
// pasadas a la vez no pueden llevarse la misma fila.
const PRESUPUESTO_MS = 20000

// Una fila reclamada hace más de esto es una pasada que murió. Vuelve a
// la cola contando el intento: si no, moriría en bucle para siempre.
const RESCATE_MINUTOS = 20

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}

async function rest(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...servicio(clave), ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

// La dirección de correo vive en auth.users, que PostgREST no expone. Se
// pide por la API de administración, que sí necesita la clave de servicio.
async function buscarDestinatario(userId, clave) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { headers: servicio(clave) })
  if (!res.ok) return null
  const user = await res.json()
  if (!user?.email) return null
  // A quien no ha confirmado su dirección no se le escribe: puede ser de
  // otra persona (alguien se registró con un correo que no es suyo) y
  // enviar ahí es la vía rápida a que te marquen como spam.
  if (!user.email_confirmed_at && !user.confirmed_at) return null
  return user.email
}

// `claimed_at` solo viaja si la migración está puesta: sin ella la
// columna no existe y PostgREST responde 400 a TODO el PATCH, así que
// una fila enviada se quedaría sin marcar y se volvería a mandar — el
// mismo fallo que esto viene a arreglar, por el otro lado.
async function marcar(id, campos, clave, conReclamo = true) {
  const limpios = conReclamo ? campos : Object.fromEntries(Object.entries(campos).filter(([k]) => k !== 'claimed_at'))
  await rest(`email_outbox?id=eq.${id}`, clave, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(limpios),
  })
}

export default async () => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.EMAIL_API_KEY
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase()
  const from = process.env.EMAIL_FROM || 'PokeDoc <avisos@pokedoc.es>'
  const siteUrl = process.env.SITE_URL || 'https://pokedoc.es'
  const smtp = provider === 'smtp' ? smtpConfigDesdeEntorno() : null

  if (!PROVEEDORES.includes(provider)) {
    return new Response(
      JSON.stringify({ ok: false, error: `EMAIL_PROVIDER="${provider}" no vale. Válidos: ${PROVEEDORES.join(', ')}` }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }

  // Cada proveedor necesita cosas distintas, así que se dice cuál falta
  // en vez de un "no configurado" genérico que obliga a adivinar.
  const falta = !clave
    ? 'SUPABASE_SERVICE_ROLE_KEY'
    : provider === 'smtp'
      ? (smtp ? null : 'SMTP_HOST, SMTP_USER y SMTP_PASS')
      : (apiKey ? null : 'EMAIL_API_KEY')

  if (falta) {
    return new Response(
      JSON.stringify({ ok: true, enviados: 0, nota: `Falta configurar ${falta}: no se envía nada.` }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }

  // ── El rescate, lo primero ──
  //
  // Lo que se quedó reclamado y sin mandar vuelve a la cola. Va antes de
  // pedir pendientes para que entre en esta misma pasada.
  const limite = new Date(Date.now() - RESCATE_MINUTOS * 60000).toISOString()
  const rescatadas = await rest(
    `email_outbox?status=eq.sending&claimed_at=lt.${encodeURIComponent(limite)}&select=id`,
    clave,
    {
      method: 'PATCH',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify({ status: 'pending', claimed_at: null }),
    }
  ).catch(() => [])

  // ── Reclamar: el UPDATE decide, no el JavaScript ──
  //
  // Se piden los candidatos y se reclaman con un filtro que exige que
  // sigan `pending`. Lo que vuelve es EXACTAMENTE lo que esta pasada se
  // ha llevado: si otra llegó antes, aquí no vuelve nada y no se manda
  // nada dos veces.
  const candidatos = await rest(
    `email_outbox?status=eq.pending&order=created_at.asc&limit=${POR_PASADA}&select=id`,
    clave
  )
  const ids = (candidatos || []).map((f) => f.id)
  const COLUMNAS = 'id,recipient_id,type,subject,preview,link,attempts'
  let reclamando = true
  let pendientes = []
  if (ids.length) {
    try {
      pendientes = await rest(
        `email_outbox?status=eq.pending&id=in.(${ids.join(',')})&select=${COLUMNAS}`,
        clave,
        {
          method: 'PATCH',
          headers: { prefer: 'return=representation' },
          body: JSON.stringify({ status: 'sending', claimed_at: new Date().toISOString() }),
        }
      )
    } catch {
      // La migración la ejecuta un humano, y hasta entonces ni el estado
      // `sending` ni `claimed_at` existen: el UPDATE devuelve un 400 y
      // tumbaría la pasada entera. Sin reclamar se sigue como se hacía
      // antes —que es el comportamiento con el que lleva meses— en vez
      // de dejar de mandar correo hasta que alguien abra el SQL Editor.
      reclamando = false
      pendientes = await rest(
        `email_outbox?status=eq.pending&order=created_at.asc&limit=${POR_PASADA}&select=${COLUMNAS}`,
        clave
      )
    }
  }

  let enviados = 0
  let fallidos = 0

  // Una sola conexión SMTP para toda la tanda (ver crearTransporteSmtp).
  const transporte = provider === 'smtp' && (pendientes || []).length ? await crearTransporteSmtp(smtp) : null

  const arranque = Date.now()
  let sinTiempo = 0

  for (const fila of pendientes || []) {
    // El presupuesto de tiempo: lo que no dé tiempo vuelve a la cola
    // ANTES de que Netlify mate la pasada. Sin esto, morir a mitad
    // dejaría reclamadas unas filas que habría que esperar 20 minutos a
    // rescatar.
    if (Date.now() - arranque > PRESUPUESTO_MS) {
      if (reclamando) await marcar(fila.id, { status: 'pending', claimed_at: null }, clave, true).catch(() => {})
      sinTiempo++
      continue
    }
    try {
      const to = await buscarDestinatario(fila.recipient_id, clave)
      if (!to) {
        // Sin dirección utilizable no hay reintento que valga: se cierra
        // como fallida en vez de quedarse dando vueltas para siempre.
        await marcar(fila.id, { status: 'failed', claimed_at: null, last_error: 'Sin dirección de correo confirmada' }, clave, reclamando)
        fallidos++
        continue
      }

      const [perfil] = await rest(
        `user_profiles?id=eq.${fila.recipient_id}&select=email_unsubscribe_token`,
        clave
      )
      const unsubscribeUrl = perfil?.email_unsubscribe_token
        ? `${siteUrl}/baja-correo?t=${perfil.email_unsubscribe_token}&tipo=${encodeURIComponent(fila.type)}`
        : null

      // Cada tipo con su pintura (el resumen semanal es una lista con
      // enlaces, no un aviso de una línea): la elección vive en
      // email.mjs para poder probarse sin red.
      const { subject, html, text } = renderFilaDeCola(fila, { siteUrl, unsubscribeUrl })

      const mensaje = { apiKey, from, to, subject, html, text, unsubscribeUrl, mailgunDomain: process.env.EMAIL_MAILGUN_DOMAIN }
      if (provider === 'smtp') {
        await sendViaSmtp(smtp, mensaje, transporte)
      } else {
        await sendEmail(provider, mensaje)
      }

      await marcar(fila.id, { status: 'sent', sent_at: new Date().toISOString(), attempts: fila.attempts + 1, claimed_at: null }, clave, reclamando)
      enviados++
    } catch (e) {
      const intentos = (fila.attempts || 0) + 1
      // Se reintenta unas cuantas veces (un 500 del proveedor suele ser
      // pasajero) y luego se deja como fallida, para que un correo roto
      // no bloquee la cola eternamente.
      await marcar(
        fila.id,
        {
          attempts: intentos,
          last_error: String(e.message || e).slice(0, 500),
          claimed_at: null,
          // Y si aún le quedan intentos, vuelve a la cola: dejarla en
          // `sending` la congelaría hasta que la rescatara el tiempo.
          status: intentos >= MAX_INTENTOS ? 'failed' : 'pending',
        },
        clave,
        reclamando
      ).catch(() => {})
      fallidos++
    }
  }

  if (transporte && typeof transporte.close === 'function') transporte.close()

  return new Response(JSON.stringify({
    ok: true,
    enviados,
    fallidos,
    revisados: (pendientes || []).length,
    // Lo que se devolvió a la cola por tiempo y lo que se rescató de una
    // pasada muerta. Los dos números tienen que ser CERO casi siempre:
    // si no lo son, es que la cola va más rápido de lo que se vacía.
    sinTiempo,
    rescatadas: (rescatadas || []).length,
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export const config = { schedule: '*/5 * * * *' }
