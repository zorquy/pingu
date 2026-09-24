// El envío: qué proveedor, con qué petición. La PINTURA vive en
// `js/email-plantilla.js` (tanda 350) para que /admin pueda enseñar la
// vista previa de cada correo con la MISMA plantilla que sale de aquí.
//
// Se reexporta entera: nada de lo que importaba de este fichero se
// entera del cambio.
export * from '../../js/email-plantilla.js'

// ────────────────────────────────────────────────────────────
// Proveedores
// ────────────────────────────────────────────────────────────
//
// El proveedor se elige con la variable de entorno EMAIL_PROVIDER en vez
// de cablearlo, porque cambiar de proveedor de correo es algo que pasa
// (por precio, por entregabilidad, o porque te cierran la cuenta) y no
// debería obligar a tocar código.
//
// Todos reciben lo mismo y devuelven { url, method, headers, body } para
// que la prueba pueda comprobar la petición sin llegar a hacerla.

// `smtp` va aparte de los demás: no es una API HTTP, es el protocolo de
// correo de toda la vida. Sirve para cualquier buzón normal — Hostinger,
// Zoho, Gmail... — y es lo que hace falta cuando tu correo es un buzón y
// no un servicio de envío transaccional.
export const PROVEEDORES_HTTP = ['resend', 'brevo', 'postmark', 'mailgun', 'sendgrid']
export const PROVEEDORES = [...PROVEEDORES_HTTP, 'smtp']

// RFC 8058: baja de un clic. Con estas dos cabeceras, Gmail y Outlook
// enseñan su propio botón de "cancelar suscripción" y le dan al enlace
// sin que la persona llegue a abrir el correo. Tenerlo mejora la
// entregabilidad además de ser lo correcto.
export function cabecerasDeBaja(unsubscribeUrl) {
  if (!unsubscribeUrl) return {}
  return {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

// El mensaje tal y como lo espera nodemailer. Se construye aquí, y no
// dentro del envío, para poder comprobarlo sin abrir ninguna conexión.
export function buildSmtpMessage(msg) {
  const { from, to, subject, html, text, unsubscribeUrl } = msg
  return { from, to, subject, text, html, headers: cabecerasDeBaja(unsubscribeUrl) }
}

export function buildProviderRequest(provider, msg) {
  const { apiKey, from, to, subject, html, text, unsubscribeUrl, mailgunDomain } = msg

  if (provider === 'smtp') {
    throw new Error('El proveedor "smtp" no usa HTTP: se envía con buildSmtpMessage + sendViaSmtp.')
  }

  const cabecerasBaja = cabecerasDeBaja(unsubscribeUrl)

  switch (provider) {
    case 'resend':
      return {
        url: 'https://api.resend.com/emails',
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html, text, headers: cabecerasBaja }),
      }

    case 'brevo':
      return {
        url: 'https://api.brevo.com/v3/smtp/email',
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: parseFrom(from),
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text,
          headers: cabecerasBaja,
        }),
      }

    case 'postmark':
      return {
        url: 'https://api.postmarkapp.com/email',
        method: 'POST',
        headers: { 'X-Postmark-Server-Token': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          From: from,
          To: to,
          Subject: subject,
          HtmlBody: html,
          TextBody: text,
          MessageStream: 'outbound',
          Headers: Object.entries(cabecerasBaja).map(([Name, Value]) => ({ Name, Value })),
        }),
      }

    case 'mailgun': {
      if (!mailgunDomain) throw new Error('Mailgun necesita EMAIL_MAILGUN_DOMAIN')
      const form = new URLSearchParams({ from, to, subject, html, text })
      // Mailgun pasa cabeceras arbitrarias con el prefijo `h:`.
      Object.entries(cabecerasBaja).forEach(([k, v]) => form.append(`h:${k}`, v))
      return {
        url: `https://api.mailgun.net/v3/${mailgunDomain}/messages`,
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      }
    }

    case 'sendgrid':
      return {
        url: 'https://api.sendgrid.com/v3/mail/send',
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: parseFrom(from),
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
          headers: cabecerasBaja,
        }),
      }

    default:
      throw new Error(`Proveedor de correo desconocido: "${provider}". Válidos: ${PROVEEDORES.join(', ')}`)
  }
}

// "PokeDoc <hola@pokedoc.es>" → { name, email }. Brevo y SendGrid piden
// el remitente troceado; Resend, Postmark y Mailgun aceptan la cadena.
export function parseFrom(from) {
  const s = String(from || '').trim()
  const m = s.match(/^(.*?)\s*<([^>]+)>$/)
  if (m) return { name: m[1].replace(/^"|"$/g, '').trim() || undefined, email: m[2].trim() }
  return { email: s }
}

export async function sendEmail(provider, msg, fetchImpl = fetch) {
  const peticion = buildProviderRequest(provider, msg)
  const res = await fetchImpl(peticion.url, {
    method: peticion.method,
    headers: peticion.headers,
    body: peticion.body,
  })
  if (!res.ok) {
    const detalle = await res.text().catch(() => '')
    throw new Error(`${provider} respondió ${res.status}: ${detalle.slice(0, 300)}`)
  }
  return true
}
