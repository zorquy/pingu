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

// El enlace que se guarda en la cola es del propio sitio. Se comprueba
// que lo siga siendo antes de convertirlo en URL: sin esto, un
// `//evil.example` o un `javascript:` acabarían en un correo firmado con
// tu dominio, que es phishing con tu propia reputación.
export function safePath(link) {
  const s = String(link ?? '')
  if (!s.startsWith('/')) return null
  if (s.startsWith('//')) return null
  if (Array.from(s).some((c) => c.codePointAt(0) < 32 || c.codePointAt(0) === 127)) return null
  if (/\s/.test(s)) return null
  return s
}

// El enlace del correo, ya absoluto — o null si no se puede usar.
//
// ── El fallo que arregla (tanda 249) ──
//
// Aquí solo se aceptaban RUTAS («/tema/12»), y quien encola los avisos de
// torneo —el barredor— guarda URLs ENTERAS, porque la misma cadena le
// sirve para el push, que las necesita así. safePath decía que no, y el
// `?:` de debajo se caía a `base`: TODOS los correos de torneo llevaban
// a la portada de pokedoc.es. Ocho tipos de aviso, meses, y el correo
// parecía correcto — el botón estaba, solo que iba a otro sitio.
//
// Ahora se aceptan las dos formas, y una URL absoluta SOLO si es de
// nuestro propio dominio: una de fuera es exactamente lo que safePath
// existe para frenar.
//
// Y cuando el enlace no vale, se devuelve null y el correo sale SIN
// botón. Mandar a la portada era peor que no mandar a ningún sitio: se
// leía como si funcionara.
export function absoluteUrl(siteUrl, path) {
  const base = String(siteUrl || '').replace(/\/+$/, '')
  const s = String(path ?? '').trim()
  if (!s) return null

  const ruta = safePath(s)
  if (ruta) return base ? `${base}${ruta}` : null

  // ¿Una URL absoluta nuestra?
  if (!base) return null
  try {
    const suya = new URL(s)
    if (suya.protocol !== 'http:' && suya.protocol !== 'https:') return null
    if (suya.origin !== new URL(base).origin) return null
    return suya.href
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────
// Qué dice cada tipo de correo
// ────────────────────────────────────────────────────────────
//
// Hasta la tanda 249 todos los correos acababan igual: un botón que
// ponía «Verlo en PokeDoc» y un pie que decía «alguien se ha dirigido a
// ti». En un aviso de que empieza tu ronda no se ha dirigido a ti nadie,
// y «verlo» no dice qué vas a ver.
//
// Cada tipo trae ahora su verbo y su motivo. El motivo importa más de lo
// que parece: un correo que explica POR QUÉ te ha llegado se denuncia
// como spam mucho menos que uno que no lo explica.
//
// Las claves son las mismas de EMAIL_TYPES (js/notifications.js) y de
// baja-correo.mjs. Un tipo que falte aquí no rompe nada — cae al
// genérico de abajo — pero sale más soso de lo que podría.
export const TEXTOS_POR_TIPO = {
  private_message: { cta: 'Leer el mensaje', pie: 'Recibes este correo porque alguien te ha escrito por privado en PokeDoc.' },
  comment_reply: { cta: 'Ver la respuesta', pie: 'Recibes este correo porque han respondido a un comentario tuyo.' },
  forum_reply: { cta: 'Leer el tema', pie: 'Recibes este correo porque sigues este tema del foro.' },
  forum_mention: { cta: 'Ver la mención', pie: 'Recibes este correo porque te han mencionado en el foro.' },
  new_follower: { cta: 'Ver su perfil', pie: 'Recibes este correo porque alguien ha empezado a seguirte.' },
  guide_submitted: { cta: 'Revisar la guía', pie: 'Recibes este correo porque eres del equipo de PokeDoc.' },
  guide_approved: { cta: 'Ver tu guía publicada', pie: 'Recibes este correo porque escribiste esta guía.' },
  guide_rejected: { cta: 'Ver qué hay que cambiar', pie: 'Recibes este correo porque escribiste esta guía.' },

  // Torneos. El verbo cambia bastante entre unos y otros y eso es la
  // gracia: «ir a tu mesa» cuando estás jugando no es lo mismo que «ver
  // el torneo» cuando aún falta.
  torneo_apertura: { cta: 'Ver el torneo', pie: 'Recibes este correo porque avisamos de los torneos nuevos de PokeDoc.' },
  torneo_recordatorio: { cta: 'Ir al torneo', pie: 'Recibes este correo porque estás inscrito en este torneo.' },
  torneo_cancelado: { cta: 'Ver los torneos', pie: 'Recibes este correo porque estabas inscrito en este torneo.' },
  torneo_plaza: { cta: 'Confirmar tu plaza', pie: 'Recibes este correo porque estabas en la lista de espera de este torneo.' },
  torneo_ronda: { cta: 'Ir a tu mesa', pie: 'Recibes este correo porque estás jugando este torneo.' },
  torneo_partida: { cta: 'Ir a tu mesa', pie: 'Recibes este correo porque estás jugando este torneo.' },
  torneo_final: { cta: 'Ver la clasificación', pie: 'Recibes este correo porque has jugado este torneo.' },
  torneo_juez: { cta: 'Atender la llamada', pie: 'Recibes este correo porque eres juez u organizador de este torneo.' },
}

const CTA_GENERICO = 'Verlo en PokeDoc'
const PIE_GENERICO = 'Recibes este correo porque alguien se ha dirigido a ti en PokeDoc.'

export function textosDeTipo(tipo) {
  const t = TEXTOS_POR_TIPO[tipo] || {}
  return { cta: t.cta || CTA_GENERICO, pie: t.pie || PIE_GENERICO }
}

// ────────────────────────────────────────────────────────────
// La plantilla
// ────────────────────────────────────────────────────────────
//
// Tres cosas que no son capricho y que la versión anterior no tenía:
//
//  · TABLAS, no divs. El Outlook de Windows pinta con el motor de Word,
//    que se salta `max-width`: la tarjeta de 520 px salía a pantalla
//    completa y el correo se leía como un documento, no como un aviso.
//  · PREHEADER. La línea que la bandeja enseña al lado del asunto. Sin
//    él, Gmail la rellenaba con lo primero del cuerpo — que era la
//    palabra «PokeDoc» — y se desperdiciaba el único trozo de texto que
//    decide si alguien abre el correo o no.
//  · Colores declarados en TODO. Los clientes en modo oscuro invierten lo
//    que no tiene fondo puesto, y una cabecera navy con el texto también
//    invertido se queda ilegible.
//
// Sin imágenes, y no por ahorrar: los clientes de correo las bloquean por
// defecto, así que un logotipo en <img> es un hueco roto en la mitad de
// las bandejas. La marca se pinta con texto y color.
const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

function cabeceraHtml() {
  return `<tr>
        <td style="background:#1e5175;padding:18px 28px;border-radius:12px 12px 0 0;">
          <span style="font-family:${FUENTE};font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">Poke</span><span style="font-family:${FUENTE};font-size:18px;font-weight:700;color:#8fc4e0;letter-spacing:-0.2px;">Doc</span>
        </td>
      </tr>`
}

function pieHtml(pie, unsubscribeUrl, siteUrl) {
  const ajustes = absoluteUrl(siteUrl, '/perfil.html')
  return `<tr>
        <td style="padding:0 28px 26px;">
          <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-family:${FUENTE};font-size:12px;line-height:1.6;color:#6b7280;">
            ${escapeHtml(pie)}<br />
            ${ajustes ? `<a href="${escapeHtml(ajustes)}" style="color:#6b7280;text-decoration:underline;">Elegir qué avisos quieres</a>` : ''}${ajustes && unsubscribeUrl ? ' · ' : ''}${unsubscribeUrl ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Dejar de recibir estos</a>` : ''}
          </div>
        </td>
      </tr>`
}

// El preheader va oculto y seguido de espacios invisibles: sin ellos, el
// cliente sigue rellenando con lo que venga detrás hasta completar su
// línea, y se cuela el principio del cuerpo.
function preheaderHtml(texto) {
  if (!texto) return ''
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;height:0;width:0;">${escapeHtml(texto)}${'&#8199;&#65279;&#847; '.repeat(30)}</div>`
}

function envoltorio({ preheader, contenido }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>PokeDoc</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;">
${preheaderHtml(preheader)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;background-color:#ffffff;border-radius:12px;">
${contenido}
      </table>
    </td>
  </tr>
</table>
</body></html>`
}

// UN aviso: de qué va, qué se ha dicho, y un botón para ir a ello.
//
// `tipo` es lo que elige el verbo del botón y el motivo del pie. `cta`
// permite forzar el verbo desde fuera (lo usa el resumen semanal).
export function renderEmail({ subject, preview, link, siteUrl, unsubscribeUrl, tipo = null, cta = null }) {
  const asunto = sanitizeHeader(subject)
  const url = absoluteUrl(siteUrl, link)
  const { cta: verbo, pie } = textosDeTipo(tipo)
  const boton = cta || verbo
  const cita = preview ? String(preview).replace(/\s+/g, ' ').trim() : ''

  const bajaTexto = unsubscribeUrl ? `\n\nPara dejar de recibir estos correos: ${unsubscribeUrl}` : ''
  const text =
    `${asunto}\n\n` +
    (cita ? `«${cita}»\n\n` : '') +
    (url ? `${boton}: ${url}\n\n` : '') +
    pie +
    bajaTexto

  const contenido = `${cabeceraHtml()}
      <tr>
        <td style="padding:26px 28px 0;">
          <h1 style="margin:0 0 14px;font-family:${FUENTE};font-size:20px;line-height:1.35;font-weight:700;color:#111827;">${escapeHtml(asunto)}</h1>
        </td>
      </tr>
      ${
        cita
          ? `<tr>
        <td style="padding:0 28px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8;border-radius:8px;">
            <tr><td style="padding:14px 16px;border-left:3px solid #1e5175;border-radius:8px;font-family:${FUENTE};font-size:15px;line-height:1.55;color:#374151;">${escapeHtml(cita)}</td></tr>
          </table>
        </td>
      </tr>`
          : ''
      }
      ${
        url
          ? `<tr>
        <td style="padding:0 28px 24px;">
          <a href="${escapeHtml(url)}" style="display:inline-block;background-color:#1e5175;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-family:${FUENTE};font-weight:600;font-size:15px;">${escapeHtml(boton)}</a>
        </td>
      </tr>`
          : ''
      }
      ${pieHtml(pie, unsubscribeUrl, siteUrl)}`

  // El preheader es la cita si la hay; si no, el verbo del botón, que al
  // menos dice qué se puede hacer.
  return { subject: asunto, html: envoltorio({ preheader: cita || boton, contenido }), text }
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
    (urlForo ? `\n\nVer el foro: ${urlForo}\n\n` : '\n\n') +
    pie +
    bajaTexto

  // Cada tema, su enlace y cuánto se ha movido. Sin la cita genérica de
  // un aviso: esto es una lista, y metida en un blockquote salía como un
  // bloque de texto sin saltos ni enlaces.
  const filaHtml = (url, titulo, detalle) => `
            <tr>
              <td style="padding:0 0 14px;font-family:${FUENTE};">
                ${url ? `<a href="${escapeHtml(url)}" style="color:#1e5175;font-weight:700;font-size:15px;line-height:1.45;text-decoration:none;">${escapeHtml(titulo)}</a>` : `<span style="color:#111827;font-weight:700;font-size:15px;">${escapeHtml(titulo)}</span>`}<br />
                <span style="font-size:13px;color:#6b7280;">${escapeHtml(detalle)}</span>
              </td>
            </tr>`

  const contenido = `${cabeceraHtml()}
      <tr>
        <td style="padding:26px 28px 0;">
          <h1 style="margin:0 0 4px;font-family:${FUENTE};font-size:20px;line-height:1.35;font-weight:700;color:#111827;">${escapeHtml(asunto)}</h1>
          <p style="margin:0 0 20px;font-family:${FUENTE};font-size:13.5px;line-height:1.5;color:#6b7280;">Lo que más se ha movido en el foro estos días.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${filas.map((f) => filaHtml(f.url, f.titulo, `${f.mensajes} ${f.mensajes === 1 ? 'mensaje' : 'mensajes'} esta semana`)).join('')}
            ${filaGuia ? filaHtml(filaGuia.url, filaGuia.titulo, 'Guía nueva de esta semana') : ''}
          </table>
        </td>
      </tr>
      ${
        urlForo
          ? `<tr>
        <td style="padding:10px 28px 24px;">
          <a href="${escapeHtml(urlForo)}" style="display:inline-block;background-color:#1e5175;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-family:${FUENTE};font-weight:600;font-size:15px;">Ver el foro</a>
        </td>
      </tr>`
          : ''
      }
      ${pieHtml(pie, unsubscribeUrl, siteUrl)}`

  const preheader = filas.length
    ? `${filas[0].titulo}${filas.length > 1 ? ` y ${filas.length - 1} más` : ''}`
    : 'El resumen de la semana en el foro.'

  return { subject: asunto, html: envoltorio({ preheader, contenido }), text }
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
  return renderEmail({ subject: fila.subject, preview: fila.preview, link: fila.link, siteUrl, unsubscribeUrl, tipo: fila.type })
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
