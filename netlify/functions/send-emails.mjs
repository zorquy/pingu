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

async function marcar(id, campos, clave) {
  await rest(`email_outbox?id=eq.${id}`, clave, {
    method: 'PATCH',
    headers: { prefer: 'return=minimal' },
    body: JSON.stringify(campos),
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

  const pendientes = await rest(
    `email_outbox?status=eq.pending&order=created_at.asc&limit=${POR_PASADA}` +
      `&select=id,recipient_id,type,subject,preview,link,attempts`,
    clave
  )

  let enviados = 0
  let fallidos = 0

  // Una sola conexión SMTP para toda la tanda (ver crearTransporteSmtp).
  const transporte = provider === 'smtp' && (pendientes || []).length ? await crearTransporteSmtp(smtp) : null

  for (const fila of pendientes || []) {
    try {
      const to = await buscarDestinatario(fila.recipient_id, clave)
      if (!to) {
        // Sin dirección utilizable no hay reintento que valga: se cierra
        // como fallida en vez de quedarse dando vueltas para siempre.
        await marcar(fila.id, { status: 'failed', last_error: 'Sin dirección de correo confirmada' }, clave)
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

      await marcar(fila.id, { status: 'sent', sent_at: new Date().toISOString(), attempts: fila.attempts + 1 }, clave)
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
          ...(intentos >= MAX_INTENTOS ? { status: 'failed' } : {}),
        },
        clave
      ).catch(() => {})
      fallidos++
    }
  }

  if (transporte && typeof transporte.close === 'function') transporte.close()

  return new Response(JSON.stringify({ ok: true, enviados, fallidos, revisados: (pendientes || []).length }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export const config = { schedule: '*/5 * * * *' }
