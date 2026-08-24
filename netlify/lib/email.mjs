// Todo lo que se puede probar SIN red: pintar el correo y construir la
// petición al proveedor. La función programada (send-emails.mjs) solo
// junta estas piezas y hace el fetch.
//
// Está separado a propósito: así las pruebas comprueban el escapado y las
// cabeceras de verdad, sin depender de tener una clave ni de que el
// proveedor esté levantado.

export function escapeHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Un asunto de correo es una CABECERA. Un salto de línea dentro de una
// cabecera permite colar otras (Bcc:, Reply-To:...). El texto viene ya
// limpio de la base, pero esto es la segunda cerradura: si algún día
// alguien encola desde otro sitio, aquí no pasa.
export function sanitizeHeader(texto, maxLargo = 200) {
  // Se filtra por punto de código en vez de con un rango en la expresión
  // regular: un rango de caracteres de control escrito literalmente es
  // ilegible y fácil de romper sin darse cuenta al editar el fichero.
  const limpio = Array.from(String(texto ?? ''))
    .map((c) => (c.codePointAt(0) < 32 || c.codePointAt(0) === 127 ? ' ' : c))
    .join('')
  return limpio.replace(/\s+/g, ' ').trim().slice(0, maxLargo)
}

// El enlace que se guarda en la cola es una ruta del propio sitio. Se
// comprueba que lo siga siendo antes de convertirla en una URL absoluta:
// sin esto, un `//evil.example` o un `javascript:` acabarían en un correo
// firmado con tu dominio, que es phishing con tu propia reputación.
export function safePath(link) {
  const s = String(link ?? '')
  if (!s.startsWith('/')) return null
  if (s.startsWith('//')) return null
  if (Array.from(s).some((c) => c.codePointAt(0) < 32 || c.codePointAt(0) === 127)) return null
  if (/\s/.test(s)) return null
  return s
}

export function absoluteUrl(siteUrl, path) {
  const base = String(siteUrl || '').replace(/\/+$/, '')
  const ruta = safePath(path)
  return ruta ? `${base}${ruta}` : base || null
}

const PIE = 'Recibes este correo porque alguien se ha dirigido a ti en PokeDoc.'

export function renderEmail({ subject, preview, link, siteUrl, unsubscribeUrl, cta = 'Verlo en PokeDoc' }) {
  const asunto = sanitizeHeader(subject)
  const url = absoluteUrl(siteUrl, link)
  const bajaTexto = unsubscribeUrl ? `\n\nPara dejar de recibir estos correos: ${unsubscribeUrl}` : ''

  const text =
    `${asunto}\n\n` +
    (preview ? `«${String(preview).replace(/\s+/g, ' ').trim()}»\n\n` : '') +
    (url ? `${cta}: ${url}\n\n` : '') +
    PIE +
    bajaTexto

  // Estilos en línea y sin imágenes externas: los clientes de correo no
  // aplican hojas de estilo y bloquean imágenes remotas por defecto, así
  // que una plantilla "bonita" con CSS externo se ve rota en la mitad de
  // las bandejas.
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#1e5175;font-weight:600;">PokeDoc</p>
    <h1 style="margin:0 0 16px;font-size:19px;line-height:1.35;color:#111827;">${escapeHtml(asunto)}</h1>
    ${preview ? `<blockquote style="margin:0 0 20px;padding:12px 16px;background:#f4f6f8;border-left:3px solid #1e5175;border-radius:4px;font-size:15px;line-height:1.5;color:#374151;">${escapeHtml(preview)}</blockquote>` : ''}
    ${url ? `<p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1e5175;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(cta)}</a></p>` : ''}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
      ${escapeHtml(PIE)}
      ${unsubscribeUrl ? `<br /><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;">Dejar de recibir estos avisos por correo</a>` : ''}
    </p>
  </div>
</body></html>`

  return { subject: asunto, html, text }
}

// ────────────────────────────────────────────────────────────
// El resumen semanal, con forma propia
// ────────────────────────────────────────────────────────────
//
// La plantilla genérica de arriba está pensada para UN aviso: asunto,
// una línea citada y un botón. El resumen semanal es una LISTA — varios
// temas, cada uno con su enlace — y metido en la cita genérica salía
// como un bloque de texto sin saltos ni enlaces. Aquí cada tema es un
// enlace directo, la guía nueva va con el suyo, y el pie dice la verdad
// («una vez por semana») en vez del genérico «alguien se ha dirigido a
// ti».
export function renderResumenSemanal({ temas = [], guia = null, siteUrl, unsubscribeUrl }) {
  const asunto = sanitizeHeader('Lo mejor de PokeDoc esta semana')
  const pie = 'Recibes este correo una vez por semana porque tienes activado el resumen semanal en tu perfil.'
  const urlForo = absoluteUrl(siteUrl, '/foro')

  const filas = temas.map((t) => ({
    titulo: sanitizeHeader(t.titulo, 160),
    url: absoluteUrl(siteUrl, `/tema/${encodeURIComponent(String(t.id ?? ''))}`),
    mensajes: Number(t.mensajes) || 0,
  }))
  const filaGuia = guia
    ? { titulo: sanitizeHeader(guia.titulo, 160), url: absoluteUrl(siteUrl, `/guia.html?slug=${encodeURIComponent(String(guia.slug ?? ''))}`) }
    : null

  const bajaTexto = unsubscribeUrl ? `\n\nPara dejar de recibir estos correos: ${unsubscribeUrl}` : ''
  const text =
    `${asunto}\n\n` +
    filas.map((f) => `· ${f.titulo} (${f.mensajes} ${f.mensajes === 1 ? 'mensaje' : 'mensajes'} esta semana)\n  ${f.url}`).join('\n') +
    (filaGuia ? `\n· Guía nueva: ${filaGuia.titulo}\n  ${filaGuia.url}` : '') +
    `\n\nVer el foro: ${urlForo}\n\n` +
    pie +
    bajaTexto

  const filaHtml = (url, titulo, detalle) => `
    <p style="margin:0 0 14px;">
      <a href="${escapeHtml(url)}" style="color:#1e5175;font-weight:700;font-size:15px;line-height:1.4;text-decoration:none;">${escapeHtml(titulo)}</a><br />
      <span style="font-size:13px;color:#6b7280;">${escapeHtml(detalle)}</span>
    </p>`

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
    <p style="margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#1e5175;font-weight:600;">PokeDoc</p>
    <h1 style="margin:0 0 6px;font-size:19px;line-height:1.35;color:#111827;">${escapeHtml(asunto)}</h1>
    <p style="margin:0 0 20px;font-size:13.5px;color:#6b7280;">Lo que más se ha movido en el foro estos días.</p>
    ${filas.map((f) => filaHtml(f.url, f.titulo, `${f.mensajes} ${f.mensajes === 1 ? 'mensaje' : 'mensajes'} esta semana`)).join('')}
    ${filaGuia ? filaHtml(filaGuia.url, filaGuia.titulo, 'Guía nueva de esta semana') : ''}
    <p style="margin:10px 0 24px;"><a href="${escapeHtml(urlForo)}" style="display:inline-block;background:#1e5175;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:15px;">Ver el foro</a></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
      ${escapeHtml(pie)}
      ${unsubscribeUrl ? `<br /><a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;">Dejar de recibir estos avisos por correo</a>` : ''}
    </p>
  </div>
</body></html>`

  return { subject: asunto, html, text }
}

// Cada fila de la cola con su pintura. El resumen semanal guarda en
// `preview` un JSON con los temas y la guía (lo encola
// resumen-semanal.mjs); si no parsea — filas antiguas de antes de este
// cambio — cae a la plantilla genérica de siempre y el correo sale
// igual que salía.
export function renderFilaDeCola(fila, { siteUrl, unsubscribeUrl }) {
  if (fila?.type === 'weekly_digest') {
    try {
      const carga = JSON.parse(fila.preview)
      if (carga && Array.isArray(carga.temas)) {
        return renderResumenSemanal({ temas: carga.temas, guia: carga.guia || null, siteUrl, unsubscribeUrl })
      }
    } catch {}
  }
  return renderEmail({ subject: fila.subject, preview: fila.preview, link: fila.link, siteUrl, unsubscribeUrl })
}

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
