// La PINTURA de un correo: la plantilla, los textos de cada tipo y el
// enlace seguro. Sin red, sin proveedores y sin nada de Node — solo
// cadenas.
//
// Vive en `js/` y no en `netlify/lib/` desde la tanda 350, por lo mismo
// que `carta-nucleo.js`: /admin enseña una VISTA PREVIA de cada correo
// que mandamos, y para eso el navegador tiene que poder pintar
// exactamente lo que pinta el servidor. Dos copias de una plantilla se
// separan, y la del correo no la ve nadie hasta que sale mal en la
// bandeja de alguien.
//
// `netlify/lib/email.mjs` lo reexporta, así que la función de envío
// sigue pidiéndoselo a donde siempre.

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
  guide_rejected: { cta: 'Abrir la guía en el editor', pie: 'Recibes este correo porque escribiste esta guía.' },

  // El resumen tiene plantilla propia, pero su verbo y su motivo salen
  // de aquí como los demás: escritos en dos sitios se separan, y /admin
  // enseñaría un botón que el correo no tiene (tanda 350).
  weekly_digest: { cta: 'Ver el foro', pie: 'Recibes este correo una vez por semana porque tienes activado el resumen semanal en tu perfil.' },

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

// ── De qué va este correo, de un vistazo (tanda 350) ──
//
// Todos los correos se leían igual: cabecera azul, título, cita, botón.
// En una bandeja con veinte cosas eso es un bloque gris más. La etiqueta
// dice en una palabra de qué va —Foro, Torneo, Guía— antes de leer el
// asunto, y el color la separa del resto.
//
// Sin imágenes, que los clientes de correo las bloquean: es una celda
// con fondo y texto, que se ve en todos.
export const FAMILIAS = {
  foro: { etiqueta: 'Foro', color: '#1e5175', fondo: '#e7eff5' },
  social: { etiqueta: 'Comunidad', color: '#5b21b6', fondo: '#ede9fe' },
  guias: { etiqueta: 'Guías', color: '#166534', fondo: '#dcfce7' },
  torneos: { etiqueta: 'Torneo', color: '#9a3412', fondo: '#ffedd5' },
  resumen: { etiqueta: 'Resumen semanal', color: '#1e5175', fondo: '#e7eff5' },
}

export const FAMILIA_POR_TIPO = {
  private_message: 'social',
  comment_reply: 'guias',
  forum_reply: 'foro',
  forum_mention: 'foro',
  new_follower: 'social',
  guide_submitted: 'guias',
  guide_approved: 'guias',
  guide_rejected: 'guias',
  weekly_digest: 'resumen',
  torneo_apertura: 'torneos',
  torneo_recordatorio: 'torneos',
  torneo_cancelado: 'torneos',
  torneo_plaza: 'torneos',
  torneo_ronda: 'torneos',
  torneo_partida: 'torneos',
  torneo_final: 'torneos',
  torneo_juez: 'torneos',
}

export function familiaDeTipo(tipo) {
  return FAMILIAS[FAMILIA_POR_TIPO[tipo]] || null
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

// La etiqueta de familia, como celda de tabla: un <span> con fondo se lo
// come el Outlook de Windows, que pinta con el motor de Word.
function etiquetaHtml(tipo) {
  const f = familiaDeTipo(tipo)
  if (!f) return ''
  return `<tr>
        <td style="padding:22px 28px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background-color:${f.fondo};border-radius:999px;padding:5px 12px;font-family:${FUENTE};font-size:12px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:${f.color};">${escapeHtml(f.etiqueta)}</td>
          </tr></table>
        </td>
      </tr>`
}

// El botón, y DEBAJO la misma dirección en claro.
//
// «Hay algunos que el botón no funciona» (PINGU). Un botón es un enlace
// con fondo, y hay clientes —correo corporativo, modo texto, alguna app
// de Android— que se comen el fondo o el enlace entero. Con la dirección
// escrita al lado siempre hay por dónde entrar, y además se VE adónde
// lleva antes de pulsar, que es lo que distingue un correo de confianza
// de uno que parece phishing.
function botonHtml(url, texto) {
  if (!url) return ''
  return `<tr>
        <td style="padding:0 28px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="background-color:#1e5175;border-radius:8px;">
              <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 24px;color:#ffffff;text-decoration:none;font-family:${FUENTE};font-weight:700;font-size:15px;">${escapeHtml(texto)}</a>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 22px;font-family:${FUENTE};font-size:12px;line-height:1.5;color:#6b7280;">
          Si el botón no te funciona, copia esta dirección:<br />
          <a href="${escapeHtml(url)}" style="color:#1e5175;text-decoration:underline;word-break:break-all;">${escapeHtml(url)}</a>
        </td>
      </tr>`
}

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
      ${etiquetaHtml(tipo)}
      <tr>
        <td style="padding:${familiaDeTipo(tipo) ? '12px' : '26px'} 28px 0;">
          <h1 style="margin:0 0 14px;font-family:${FUENTE};font-size:21px;line-height:1.35;font-weight:700;color:#111827;">${escapeHtml(asunto)}</h1>
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
      ${botonHtml(url, boton)}
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
export function renderResumenSemanal({ temas = [], guia = null, noticias = [], siteUrl, unsubscribeUrl }) {
  const asunto = sanitizeHeader('Lo mejor de PokeDoc esta semana')
  const { cta: verbo, pie } = textosDeTipo('weekly_digest')
  const urlForo = absoluteUrl(siteUrl, '/foro')

  const filas = temas.map((t) => ({
    titulo: sanitizeHeader(t.titulo, 160),
    url: absoluteUrl(siteUrl, `/tema/${encodeURIComponent(String(t.id ?? ''))}`),
    mensajes: Number(t.mensajes) || 0,
  }))
  const filaGuia = guia
    ? { titulo: sanitizeHeader(guia.titulo, 160), url: absoluteUrl(siteUrl, `/guia.html?slug=${encodeURIComponent(String(guia.slug ?? ''))}`) }
    : null
  // Las noticias van PRIMERO en el correo: es lo más perecedero de todo
  // lo que lleva dentro. Un hilo del foro sigue ahí la semana que viene;
  // «han revelado las cartas del 30 aniversario», no.
  const filasNoticias = (noticias || []).map((n) => ({
    titulo: sanitizeHeader(n.titulo, 160),
    url: absoluteUrl(siteUrl, `/noticias/${encodeURIComponent(String(n.slug ?? ''))}`),
  }))

  const bajaTexto = unsubscribeUrl ? `\n\nPara dejar de recibir estos correos: ${unsubscribeUrl}` : ''
  const text =
    `${asunto}\n\n` +
    (filasNoticias.length ? filasNoticias.map((n) => `· Noticia: ${n.titulo}\n  ${n.url}`).join('\n') + '\n' : '') +
    filas.map((f) => `· ${f.titulo} (${f.mensajes} ${f.mensajes === 1 ? 'mensaje' : 'mensajes'} esta semana)\n  ${f.url}`).join('\n') +
    (filaGuia ? `\n· Guía nueva: ${filaGuia.titulo}\n  ${filaGuia.url}` : '') +
    (urlForo ? `\n\n${verbo}: ${urlForo}\n\n` : '\n\n') +
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
      ${etiquetaHtml('weekly_digest')}
      <tr>
        <td style="padding:12px 28px 0;">
          <h1 style="margin:0 0 4px;font-family:${FUENTE};font-size:20px;line-height:1.35;font-weight:700;color:#111827;">${escapeHtml(asunto)}</h1>
          <p style="margin:0 0 20px;font-family:${FUENTE};font-size:13.5px;line-height:1.5;color:#6b7280;">${escapeHtml(filasNoticias.length ? 'Las noticias de la semana y lo que más se ha movido en el foro.' : 'Lo que más se ha movido en el foro estos días.')}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${filasNoticias.map((n) => filaHtml(n.url, n.titulo, 'Noticia de esta semana')).join('')}
            ${filas.map((f) => filaHtml(f.url, f.titulo, `${f.mensajes} ${f.mensajes === 1 ? 'mensaje' : 'mensajes'} esta semana`)).join('')}
            ${filaGuia ? filaHtml(filaGuia.url, filaGuia.titulo, 'Guía nueva de esta semana') : ''}
          </table>
        </td>
      </tr>
      ${botonHtml(urlForo, verbo)}
      ${pieHtml(pie, unsubscribeUrl, siteUrl)}`

  // El preheader es lo que se lee en la bandeja de entrada, antes de
  // abrir: si hay noticia, manda la noticia.
  const cabezas = [...filasNoticias, ...filas]
  const preheader = cabezas.length
    ? `${cabezas[0].titulo}${cabezas.length > 1 ? ` y ${cabezas.length - 1} más` : ''}`
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
        return renderResumenSemanal({ temas: carga.temas, guia: carga.guia || null, noticias: carga.noticias || [], siteUrl, unsubscribeUrl })
      }
    } catch {}
  }
  return renderEmail({ subject: fila.subject, preview: fila.preview, link: fila.link, siteUrl, unsubscribeUrl, tipo: fila.type })
}

// ────────────────────────────────────────────────────────────
// Todos los correos que mandamos (tanda 350)
// ────────────────────────────────────────────────────────────
//
// «Quiero ver todos los correos que mandamos» (PINGU). Hasta ahora la
// única forma de ver uno era esperar a que te tocara — y así es como se
// vive meses con un botón que lleva a otro sitio.
//
// Esta tabla es la lista, con un ejemplo realista de cada uno: la usa
// /admin → Correos para pintar la vista previa con ESTA MISMA plantilla,
// y la prueba para comprobar que todos tienen enlace, verbo y motivo.
//
// `donde` dice QUIÉN lo encola, que es lo que hace falta saber para
// cambiarlo. Y el enlace de cada ejemplo es el de verdad, con la misma
// forma que escribe quien lo encola: si aquí se ve roto, está roto.
export const EJEMPLOS_DE_CORREO = [
  {
    type: 'private_message',
    donde: 'Disparador de la base (supabase-migration-correo-avisos.sql)',
    subject: 'Ibai te ha enviado un mensaje',
    preview: '¿Te vendría bien jugar la ronda el jueves por la tarde?',
    link: '/mensajes.html?c=6f1d2c0a-1111-2222-3333-444455556666',
  },
  {
    type: 'comment_reply',
    donde: 'Disparador de la base (supabase-migration-correo-avisos.sql)',
    subject: 'Ibai ha respondido a tu comentario',
    preview: 'A mí me pasó lo mismo con la carta de la promo, revisa la marca.',
    link: '/guia.html?slug=como-leer-una-carta',
  },
  {
    type: 'forum_reply',
    donde: 'Disparador de la base (supabase-migration-correo-foro.sql)',
    subject: 'Ibai ha respondido en «Mazos de Ceruledge en Mega Evolución»',
    preview: 'Yo probaría con dos Buddy-Buddy Poffin antes que con tres.',
    link: '/tema/128',
  },
  {
    type: 'forum_mention',
    donde: 'Disparador de la base (supabase-migration-correo-foro.sql)',
    subject: 'Ibai te ha mencionado en «Dudas del reglamento»',
    preview: '@pingu esto lo sabías tú, ¿no?',
    link: '/tema/131',
  },
  {
    type: 'new_follower',
    donde: 'Disparador de la base (supabase-migration-correo-seguidores.sql)',
    subject: 'Ibai ha empezado a seguirte',
    preview: 'Ya tienes 12 seguidores en PokeDoc.',
    link: '/usuario/ibai',
  },
  {
    type: 'guide_submitted',
    donde: 'Disparador de la base (supabase-migration-aviso-guia-revision.sql)',
    subject: 'Guía nueva para revisar: «Cómo montar tu primer mazo»',
    preview: 'La ha enviado Ibai y está esperando revisión.',
    link: '/admin/',
  },
  {
    type: 'guide_approved',
    donde: 'Disparador de la base (supabase-migration-aviso-guia-revision.sql)',
    subject: 'Tu guía «Cómo montar tu primer mazo» ya está publicada',
    preview: 'Ya se puede leer en PokeDoc.',
    link: '/guia.html?slug=como-montar-tu-primer-mazo',
  },
  {
    type: 'guide_rejected',
    donde: 'Disparador de la base (supabase-migration-aviso-guia-revision.sql)',
    subject: 'Tu guía «Cómo montar tu primer mazo» necesita cambios',
    preview: 'Falta explicar la regla de las cartas de energía especial.',
    link: '/editor-guia.html?id=8c2a1b40-5555-6666-7777-888899990000',
  },
  {
    type: 'torneo_recordatorio',
    donde: 'El barredor (netlify/functions/torneos-barredor.mjs)',
    subject: 'Tu torneo empieza en una hora: Pachanga de inauguración',
    preview: 'Acuérdate de hacer el check-in cuando abra.',
    link: '/torneo?slug=pachanga-de-inauguracion',
  },
  {
    type: 'torneo_ronda',
    donde: 'El barredor (netlify/functions/torneos-barredor.mjs)',
    subject: 'Empieza la ronda 2 — mesa 4 contra Ibai',
    preview: 'Tienes 50 minutos para jugar y reportar el resultado.',
    link: '/torneo?slug=pachanga-de-inauguracion',
  },
  {
    type: 'torneo_partida',
    donde: 'El barredor (netlify/functions/torneos-barredor.mjs)',
    subject: 'Tu rival ha reportado el resultado de la mesa 4',
    preview: 'Dice que has ganado 2-1. Confírmalo o avisa al juez.',
    link: '/torneo?slug=pachanga-de-inauguracion',
  },
  {
    type: 'torneo_plaza',
    donde: 'El barredor (netlify/functions/torneos-barredor.mjs)',
    subject: 'Tienes plaza en Pachanga de inauguración',
    preview: 'Se ha caído alguien y la lista de espera te ha dado sitio.',
    link: '/torneo?slug=pachanga-de-inauguracion',
  },
  {
    type: 'torneo_cancelado',
    donde: 'El barredor (netlify/functions/torneos-barredor.mjs)',
    subject: 'Se ha cancelado Pachanga de inauguración',
    preview: 'No hubo jugadores suficientes. Tu inscripción se ha anulado.',
    link: '/torneos.html',
  },
  {
    type: 'torneo_final',
    donde: 'El barredor (netlify/functions/torneos-barredor.mjs)',
    subject: 'Pachanga de inauguración ha terminado',
    preview: 'Has quedado 3º de 16. Ya puedes ver la clasificación final.',
    link: '/torneo?slug=pachanga-de-inauguracion',
  },
  {
    type: 'torneo_juez',
    donde: 'El barredor (netlify/functions/torneos-barredor.mjs)',
    subject: 'Llamada de juez en la mesa 4',
    preview: 'Ibai ha pedido un juez en Pachanga de inauguración.',
    link: '/torneo?slug=pachanga-de-inauguracion',
  },
  {
    type: 'weekly_digest',
    donde: 'Función programada (netlify/functions/resumen-semanal.mjs), lunes 08:10 UTC',
    subject: 'Lo mejor de PokeDoc esta semana',
    link: '/foro',
    // El semanal guarda el contenido ESTRUCTURADO en `preview`: la
    // plantilla del resumen lo lee de ahí. El ejemplo lleva el mismo
    // JSON que encola la función.
    preview: JSON.stringify({
      noticias: [{ titulo: 'Reveladas las cartas del 30 aniversario', slug: 'cartas-30-aniversario' }],
      temas: [
        { id: 128, titulo: 'Mazos de Ceruledge en Mega Evolución', mensajes: 24 },
        { id: 131, titulo: 'Dudas del reglamento', mensajes: 11 },
      ],
      guia: { titulo: 'Cómo montar tu primer mazo', slug: 'como-montar-tu-primer-mazo' },
    }),
  },
]
