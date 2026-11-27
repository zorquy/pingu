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
  collab_application: { cta: 'Ver la solicitud', pie: 'Recibes este correo porque eres del equipo de PokeDoc.' },
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
  torneo_aviso: { cta: 'Ver el torneo', pie: 'Recibes este correo porque estás inscrito en este torneo.' },
  torneo_jornada: { cta: 'Ver la liga', pie: 'Recibes este correo porque estás inscrito en esta liga.' },

  // Tiendas (1067): van a un email sin cuenta, desde tienda-decidir.
  tienda_aceptada: { cta: 'Crear la cuenta de la tienda', pie: 'Recibes este correo porque pediste acceso para tu tienda en PokeDoc.' },
  tienda_rechazada: { cta: 'Ir a PokeDoc', pie: 'Recibes este correo porque pediste acceso para tu tienda en PokeDoc.' },
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
  tiendas: { etiqueta: 'Tiendas', color: '#0e7490', fondo: '#e0f2f6' },
}

export const FAMILIA_POR_TIPO = {
  private_message: 'social',
  comment_reply: 'guias',
  forum_reply: 'foro',
  forum_mention: 'foro',
  new_follower: 'social',
  guide_submitted: 'guias',
  collab_application: 'social',
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
  torneo_aviso: 'torneos',
  torneo_jornada: 'torneos',
  tienda_aceptada: 'tiendas',
  tienda_rechazada: 'tiendas',
}

export function familiaDeTipo(tipo) {
  return FAMILIAS[FAMILIA_POR_TIPO[tipo]] || null
}

const CTA_GENERICO = 'Verlo en PokeDoc'
const PIE_GENERICO = 'Recibes este correo porque alguien se ha dirigido a ti en PokeDoc.'

export function textosDeTipo(tipo, propio = null) {
  const t = TEXTOS_POR_TIPO[tipo] || {}
  const p = limpiarPropio(propio)
  return { cta: p.cta || t.cta || CTA_GENERICO, pie: p.pie || t.pie || PIE_GENERICO }
}

// ── Los textos que cambia el equipo (tanda 1122) ──
//
// Desde /admin → Correos se puede cambiar, por tipo, el asunto, un texto
// encima de la cita, el botón y el motivo del pie (tabla `correo_textos`).
// Lo que se deja vacío es lo de siempre. El asunto de cada aviso lo escribe
// quien lo encola («Ibai te ha enviado un mensaje»), así que el propio es una
// PLANTILLA: `{asunto}` es ese, y sin `{asunto}` se sustituye entero.
export const HUECO_ASUNTO = '{asunto}'

export function limpiarPropio(propio) {
  const t = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
  return { asunto: t(propio?.asunto, 200), intro: t(propio?.intro, 600), cta: t(propio?.cta, 60), pie: t(propio?.pie, 300) }
}

export function asuntoConPropio(asunto, propio) {
  const plantilla = limpiarPropio(propio).asunto
  return plantilla ? plantilla.split(HUECO_ASUNTO).join(asunto) : asunto
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
// las bandejas. La marca se pinta con texto y color. (El resumen semanal sí
// las lleva desde la 1488, PINGU: «pocas imágenes»: cada una con su `alt` y
// lo que dicen, también en texto.)
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

// `ancho`: 520 para un aviso; el resumen semanal, 600 (1488), que lleva fotos.
function envoltorio({ preheader, contenido, ancho = 520 }) {
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
      <table role="presentation" width="${ancho}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${ancho}px;background-color:#ffffff;border-radius:12px;">
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
export function renderEmail({ subject, preview, link, siteUrl, unsubscribeUrl, tipo = null, cta = null, propio = null }) {
  const asunto = sanitizeHeader(asuntoConPropio(sanitizeHeader(subject), propio))
  const url = absoluteUrl(siteUrl, link)
  const { cta: verbo, pie } = textosDeTipo(tipo, propio)
  // El botón del equipo manda sobre el que fuerza quien llama.
  const boton = limpiarPropio(propio).cta || cta || verbo
  const intro = limpiarPropio(propio).intro
  const cita = preview ? String(preview).replace(/\s+/g, ' ').trim() : ''

  const bajaTexto = unsubscribeUrl ? `\n\nPara dejar de recibir estos correos: ${unsubscribeUrl}` : ''
  const text =
    `${asunto}\n\n` +
    (intro ? `${intro}\n\n` : '') +
    (cita ? `«${cita}»\n\n` : '') +
    (url ? `${boton}: ${url}\n\n` : '') +
    pie +
    bajaTexto

  const contenido = `${cabeceraHtml()}
      ${etiquetaHtml(tipo)}
      <tr>
        <td style="padding:${familiaDeTipo(tipo) ? '12px' : '26px'} 28px 0;">
          <h1 style="margin:0 0 14px;font-family:${FUENTE};font-size:21px;line-height:1.35;font-weight:700;color:#111827;">${escapeHtml(asunto)}</h1>
          ${intro ? `<p style="margin:0 0 16px;font-family:${FUENTE};font-size:15px;line-height:1.55;color:#374151;">${escapeHtml(intro)}</p>` : ''}
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
// «Tu semana» (821): el valor de tu colección y lo que te han contestado.
// Solo lo que se sabe: sin foto de hace una semana, no hay «cambio».
export function lineasDeTuSemana(tu) {
  const lineas = []
  if (!tu) return lineas
  const eur = (n) => `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
  if (Number.isFinite(tu.valor)) {
    const cambio = Number.isFinite(tu.cambio) && tu.cambio !== 0 ? ` (${tu.cambio > 0 ? '+' : '−'}${eur(Math.abs(tu.cambio))} en la semana)` : ''
    lineas.push({ texto: `Tu colección vale ${eur(tu.valor)}${cambio}`, ruta: '/mi-coleccion' })
  }
  if (tu.respuestas > 0) lineas.push({ texto: `${tu.respuestas} ${tu.respuestas === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en temas que sigues`, ruta: '/foro' })
  // Lo de la 1322 (P6): cruces, tus jornadas y eventos de esta semana, tu racha.
  if (tu.cruces > 0) lineas.push({ texto: `${tu.cruces} ${tu.cruces === 1 ? 'cruce nuevo' : 'cruces nuevos'}: gente que da cartas de tu «La quiero»`, ruta: '/mi-coleccion?ver=cambios' })
  for (const j of (tu.jornadas || []).slice(0, 3)) lineas.push({ texto: `${j.torneo} · Jornada ${j.n}, ${diaDeLaSemana(j.fecha)}`, ruta: `/torneo?id=${encodeURIComponent(j.id)}` })
  for (const e of (tu.eventos || []).slice(0, 3)) lineas.push({ texto: `${e.nombre}, ${diaDeLaSemana(e.empieza)}: vas`, ruta: `/eventos/${encodeURIComponent(e.slug)}` })
  if (tu.racha >= 3) lineas.push({ texto: `Llevas ${tu.racha} días de racha en los retos: no la pierdas`, ruta: '/retos' })
  return lineas
}

// «el jueves 19» (hora de Madrid).
function diaDeLaSemana(f) {
  const d = new Date(f)
  return Number.isNaN(d.getTime()) ? 'esta semana' : `el ${d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', timeZone: 'Europe/Madrid' })}`
}

// ── El resumen, visual (tanda 1488, PINGU: «es mucho texto, pocas imágenes…
// podríamos meter la mascota por ahí haciendo algo tipo GIF») ──
// La mascota de cartero en la cabecera (un GIF sacado del modelo 3D de la web,
// en /assets/correo/), tu semana en losas, la noticia con su portada, las tres
// cartas que más suben con su foto, el lanzamiento, el foro, la guía y el
// reto. Las imágenes SÍ van ahora (PINGU lo pidió): cada una con su `alt` y
// todo lo que dicen también en texto, para quien las tenga bloqueadas.
const GIF_CABECERA = '/assets/correo/mascota-entregar.gif'
const GIF_RETO = '/assets/correo/mascota-pensar.gif'
// Con el punto de los miles a mano: en es-ES `toLocaleString` no lo pone a
// 1235, y el Node de Netlify no tiene `useGrouping: 'always'`.
const eurosDe = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`

// El asunto, con lo más llamativo de la semana (1488, la D3): lo tuyo que más
// tira (lo que sube tu colección, tus cruces o tu racha) y lo que sale o la
// noticia. Sin nada de eso, el de siempre.
export function asuntoDelResumen({ tu = null, lanzamientos = [], noticias = [] } = {}) {
  let tuyo = ''
  if (tu && Number(tu.cambio) >= 1) tuyo = `Tu colección sube ${eurosDe(tu.cambio)}`
  else if (tu && tu.cruces > 0) tuyo = `${tu.cruces} ${tu.cruces === 1 ? 'cruce nuevo' : 'cruces nuevos'} para ti`
  else if (tu && tu.racha >= 3) tuyo = `Llevas ${tu.racha} días de racha`
  const nuevo = lanzamientos?.[0]?.nombre ? `sale ${lanzamientos[0].nombre}` : noticias?.[0]?.titulo ? String(noticias[0].titulo) : ''
  if (tuyo && nuevo) return `${tuyo} · y ${lanzamientos?.[0]?.nombre ? nuevo : `${nuevo.charAt(0).toLowerCase()}${nuevo.slice(1)}`}`
  if (tuyo) return tuyo
  if (lanzamientos?.[0]?.nombre) return `Esta semana sale ${lanzamientos[0].nombre}`
  if (nuevo) return nuevo
  return tu ? 'Tu semana en PokeDoc' : 'Lo mejor de PokeDoc esta semana'
}

// Una dirección de imagen que el correo puede pedir: entera, o de la web.
const imagenDe = (siteUrl, url) => {
  const u = String(url || '').trim()
  if (/^https:\/\//.test(u)) return u
  return u.startsWith('/') ? absoluteUrl(siteUrl, u) : null
}

export function renderResumenSemanal({ temas = [], guia = null, noticias = [], lanzamientos = [], suben = [], semana = null, tu = null, siteUrl, unsubscribeUrl, propio = null }) {
  const asunto = sanitizeHeader(asuntoConPropio(asuntoDelResumen({ tu: lineasDeTuSemana(tu).length ? tu : null, lanzamientos, noticias }), propio))
  const { cta: verbo, pie } = textosDeTipo('weekly_digest', propio)
  const urlForo = absoluteUrl(siteUrl, '/foro')
  const F = FUENTE
  const temasF = temas.map((t) => ({ titulo: sanitizeHeader(t.titulo, 160), url: absoluteUrl(siteUrl, `/tema/${encodeURIComponent(String(t.id ?? ''))}`), mensajes: Number(t.mensajes) || 0 }))
  const guiaF = guia ? { titulo: sanitizeHeader(guia.titulo, 160), url: absoluteUrl(siteUrl, `/guia/${encodeURIComponent(String(guia.slug ?? ''))}`), portada: imagenDe(siteUrl, guia.portada), minutos: Number(guia.minutos) || 0 } : null
  const noticiasF = (noticias || []).map((n) => ({ titulo: sanitizeHeader(n.titulo, 160), url: absoluteUrl(siteUrl, `/noticias/${encodeURIComponent(String(n.slug ?? ''))}`), portada: imagenDe(siteUrl, n.portada) }))
  const lanzF = (lanzamientos || []).map((x) => ({ titulo: sanitizeHeader(x.nombre, 160), url: absoluteUrl(siteUrl, '/lanzamientos'), fecha: String(x.fecha || '').slice(0, 10) }))
  const subenF = (suben || []).filter((x) => x?.imagen && /^https:\/\//.test(x.imagen)).slice(0, 3).map((x) => ({ nombre: sanitizeHeader(x.nombre, 60), url: absoluteUrl(siteUrl, x.ruta || '/cartas'), imagen: x.imagen, pct: Math.round(Number(x.pct) || 0) }))
  const lineas = lineasDeTuSemana(tu)
  const diaBonito = (f) => { const d = new Date(`${f}T12:00:00Z`); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) }
  const diaCorto = (f) => { const d = new Date(`${f}T12:00:00Z`); return Number.isNaN(d.getTime()) ? null : { n: d.getUTCDate(), dia: d.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'UTC' }).replace('.', '') } }
  const rango = semana?.desde && semana?.hasta ? (() => { const a = new Date(`${semana.desde}T12:00:00Z`); const z = new Date(`${semana.hasta}T12:00:00Z`); const m = (d) => d.toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' }); return Number.isNaN(a) || Number.isNaN(z) ? '' : a.getUTCMonth() === z.getUTCMonth() ? `Del ${a.getUTCDate()} al ${z.getUTCDate()} de ${m(z)}` : `Del ${a.getUTCDate()} de ${m(a)} al ${z.getUTCDate()} de ${m(z)}` })() : ''

  // ── El texto plano, con todo ──
  const bajaTexto = unsubscribeUrl ? `\n\nPara dejar de recibir estos correos: ${unsubscribeUrl}` : ''
  const text =
    `${asunto}\n\n` +
    (lineas.length ? lineas.map((l) => `· ${l.texto}\n  ${absoluteUrl(siteUrl, l.ruta)}`).join('\n') + '\n' : '') +
    (noticiasF.length ? noticiasF.map((n) => `· Noticia: ${n.titulo}\n  ${n.url}`).join('\n') + '\n' : '') +
    (subenF.length ? subenF.map((x) => `· Sube: ${x.nombre} (+${x.pct} %)\n  ${x.url}`).join('\n') + '\n' : '') +
    (lanzF.length ? lanzF.map((x) => `· Sale el ${diaBonito(x.fecha)}: ${x.titulo}\n  ${x.url}`).join('\n') + '\n' : '') +
    temasF.map((f) => `· ${f.titulo} (${f.mensajes} ${f.mensajes === 1 ? 'mensaje' : 'mensajes'} esta semana)\n  ${f.url}`).join('\n') +
    (guiaF ? `\n· Guía nueva: ${guiaF.titulo}\n  ${guiaF.url}` : '') +
    `\n· Los retos de hoy: ${absoluteUrl(siteUrl, '/retos')}` +
    (urlForo ? `\n\n${verbo}: ${urlForo}\n\n` : '\n\n') +
    pie +
    bajaTexto

  // ── Las piezas ──
  const rotulo = (t) => `<tr><td style="padding:22px 24px 8px;font-family:${F};font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#5b6f7c;">${escapeHtml(t)}</td></tr>`
  const gif = absoluteUrl(siteUrl, GIF_CABECERA)
  const cabecera = `<tr>
        <td style="background-color:#1e5175;border-radius:12px 12px 0 0;padding:20px 0 0 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="top" style="padding:0 8px 20px 0;">
              <span style="font-family:${F};font-size:20px;font-weight:800;color:#ffffff;">Poke</span><span style="font-family:${F};font-size:20px;font-weight:800;color:#8fc4e0;">Doc</span>
              <h1 style="margin:14px 0 6px;font-family:${F};font-size:26px;line-height:1.15;font-weight:800;color:#ffffff;">${escapeHtml(lineas.length ? 'Tu semana en PokeDoc' : 'La semana en PokeDoc')}</h1>
              <p style="margin:0;font-family:${F};font-size:14px;line-height:1.45;color:#c9dbe8;">${escapeHtml(rango ? `${rango} · lo tuyo, lo nuevo y lo que más se mueve` : 'Lo tuyo, lo nuevo y lo que más se mueve')}</p>
            </td>
            ${gif ? `<td width="150" valign="bottom" style="width:150px;padding:0;"><img src="${escapeHtml(gif)}" width="150" height="175" alt="La mascota de PokeDoc, de cartero, con tu semana" style="display:block;width:150px;height:175px;border:0;" /></td>` : ''}
          </tr></table>
        </td>
      </tr>`

  // Tu semana en losas: valor, racha, respuestas y cruces (lo que haya).
  const losas = []
  if (tu && Number.isFinite(tu.valor)) {
    const c = Number(tu.cambio)
    losas.push({ cifra: eurosDe(tu.valor), extra: Number.isFinite(c) && Math.round(c) !== 0 ? `${c > 0 ? '+' : '−'}${eurosDe(Math.abs(c))}` : '', extraColor: c > 0 ? '#0f7f55' : '#b42318', texto: 'tu colección', ruta: '/mi-coleccion' })
  }
  if (tu?.racha >= 3) losas.push({ cifra: String(tu.racha), texto: 'días de racha', ruta: '/retos' })
  if (tu?.respuestas > 0) losas.push({ cifra: String(tu.respuestas), texto: tu.respuestas === 1 ? 'respuesta en temas que sigues' : 'respuestas en temas que sigues', ruta: '/foro' })
  if (tu?.cruces > 0) losas.push({ cifra: String(tu.cruces), texto: tu.cruces === 1 ? 'cruce nuevo' : 'cruces nuevos', ruta: '/mi-coleccion?ver=cambios' })
  const otrasTuyas = lineas.filter((l) => !/^(Tu colección vale|Llevas \d+ días|\d+ mensajes? nuevos?|\d+ cruces? nuevos?)/.test(l.texto))
  const bloqueTu = losas.length || otrasTuyas.length ? `${rotulo('Tu semana')}
      ${losas.length ? `<tr><td style="padding:0 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="8" border="0" style="border-collapse:separate;border-spacing:8px 0;"><tr>
            ${losas.map((l) => `<td width="${Math.floor(100 / losas.length)}%" valign="top" align="center" style="background-color:#e7eff5;border-radius:12px;padding:12px 8px;">
              <a href="${escapeHtml(absoluteUrl(siteUrl, l.ruta))}" style="display:block;text-decoration:none;text-align:center;font-family:${F};">
                <span style="display:block;font-size:20px;font-weight:800;color:#0d1b2a;line-height:1.2;">${escapeHtml(l.cifra)}</span>
                ${l.extra ? `<span style="display:block;font-size:12px;font-weight:700;color:${l.extraColor};">${escapeHtml(l.extra)}</span>` : ''}
                <span style="display:block;font-size:12px;color:#5b6f7c;line-height:1.3;">${escapeHtml(l.texto)}</span>
              </a>
            </td>`).join('')}
          </tr></table>
        </td></tr>` : ''}
      ${otrasTuyas.map((l) => `<tr><td style="padding:10px 24px 0;font-family:${F};font-size:14px;"><a href="${escapeHtml(absoluteUrl(siteUrl, l.ruta))}" style="color:#1e5175;font-weight:700;text-decoration:none;">${escapeHtml(l.texto)}</a></td></tr>`).join('')}` : ''

  // La noticia, con su portada; las demás, en fila con la suya pequeña.
  const [noti, ...masNotis] = noticiasF
  const bloqueNoticias = noti ? `${rotulo('La noticia de la semana')}
      <tr><td style="padding:0 24px;">
        <a href="${escapeHtml(noti.url)}" style="display:block;text-decoration:none;">
          ${noti.portada ? `<img src="${escapeHtml(noti.portada)}" width="552" alt="" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:12px 12px 0 0;" />` : ''}
          <span style="display:block;background-color:#0d1b2a;border-radius:${noti.portada ? '0 0 12px 12px' : '12px'};padding:12px 16px;font-family:${F};">
            <span style="display:block;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#8fc4e0;">Noticia</span>
            <span style="display:block;font-size:19px;font-weight:800;line-height:1.25;color:#ffffff;">${escapeHtml(noti.titulo)}</span>
          </span>
        </a>
      </td></tr>
      ${masNotis.map((n) => `<tr><td style="padding:10px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${n.portada ? `<td width="88" valign="middle" style="width:88px;padding-right:12px;"><a href="${escapeHtml(n.url)}"><img src="${escapeHtml(n.portada)}" width="88" height="60" alt="" style="display:block;width:88px;height:60px;object-fit:cover;border:0;border-radius:8px;" /></a></td>` : ''}
          <td valign="middle" style="font-family:${F};font-size:15px;line-height:1.35;"><a href="${escapeHtml(n.url)}" style="color:#0d1b2a;font-weight:700;text-decoration:none;">${escapeHtml(n.titulo)}</a></td>
        </tr></table>
      </td></tr>`).join('')}` : ''

  // Las tres que más suben, con su foto.
  const bloqueSuben = subenF.length === 3 ? `${rotulo('Lo que más sube')}
      <tr><td style="padding:0 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${subenF.map((x) => `<td width="33%" valign="top" align="center" style="padding:0 6px;font-family:${F};">
            <a href="${escapeHtml(x.url)}" style="text-decoration:none;"><img src="${escapeHtml(x.imagen)}" width="172" alt="${escapeHtml(x.nombre)}" style="display:block;width:100%;max-width:172px;height:auto;border:0;border-radius:8px;" />
            <span style="display:block;margin-top:6px;font-size:13px;font-weight:700;color:#0d1b2a;">${escapeHtml(x.nombre)}</span>
            <span style="display:block;font-size:13px;font-weight:800;color:#0f7f55;">+${x.pct} %</span></a>
          </td>`).join('')}
        </tr></table>
      </td></tr>` : ''

  const bloqueLanz = lanzF.length ? `${rotulo('Sale esta semana')}
      ${lanzF.map((x) => { const d = diaCorto(x.fecha); return `<tr><td style="padding:0 24px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e3e9ee;border-radius:12px;"><tr>
          ${d ? `<td width="56" align="center" valign="middle" style="width:56px;padding:10px 0 10px 10px;"><span style="display:block;background-color:#e7eff5;border-radius:10px;padding:6px 0;font-family:${F};"><span style="display:block;font-size:22px;font-weight:800;line-height:1;color:#0d1b2a;">${d.n}</span><span style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;color:#5b6f7c;">${escapeHtml(d.dia)}</span></span></td>` : ''}
          <td valign="middle" style="padding:10px 12px;font-family:${F};"><a href="${escapeHtml(x.url)}" style="color:#0d1b2a;font-size:15px;font-weight:800;text-decoration:none;">${escapeHtml(x.titulo)}</a><br /><span style="font-size:13px;color:#5b6f7c;">Sale el ${escapeHtml(diaBonito(x.fecha))}, con su lista y lo que vale cada carta</span></td>
        </tr></table>
      </td></tr>` }).join('')}` : ''

  const colores = ['#e8763a', '#2a6b96', '#0f7f55', '#c62a5c']
  const bloqueForo = temasF.length ? `${rotulo('Lo más hablado en el foro')}
      ${temasF.map((t, i) => `<tr><td style="padding:0 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:${i ? '1px solid #e3e9ee' : '0'};"><tr>
          <td width="32" valign="middle" style="width:32px;padding:8px 10px 8px 0;"><span style="display:block;width:32px;height:32px;line-height:32px;border-radius:16px;background-color:${colores[i % colores.length]};color:#ffffff;text-align:center;font-family:${F};font-size:13px;font-weight:800;">${escapeHtml((t.titulo.match(/[\p{L}\p{N}]/u) || ['·'])[0].toUpperCase())}</span></td>
          <td valign="middle" style="padding:8px 0;font-family:${F};font-size:14px;line-height:1.35;"><a href="${escapeHtml(t.url)}" style="color:#0d1b2a;font-weight:700;text-decoration:none;">${escapeHtml(t.titulo)}</a></td>
          <td width="40" align="right" valign="middle" style="padding:8px 0 8px 8px;font-family:${F};"><span style="display:inline-block;background-color:#e7eff5;border-radius:999px;padding:1px 8px;font-size:12px;font-weight:700;color:#5b6f7c;">${t.mensajes}</span></td>
        </tr></table>
      </td></tr>`).join('')}
      ${urlForo ? `<tr><td style="padding:10px 24px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#e7eff5;border-radius:999px;"><a href="${escapeHtml(urlForo)}" style="display:inline-block;padding:9px 16px;color:#1e5175;text-decoration:none;font-family:${F};font-weight:700;font-size:14px;">${escapeHtml(verbo)}</a></td></tr></table>
      </td></tr>` : ''}` : ''

  const bloqueGuia = guiaF ? `${rotulo('Guía nueva')}
      <tr><td style="padding:0 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          ${guiaF.portada ? `<td width="120" valign="middle" style="width:120px;padding-right:14px;"><a href="${escapeHtml(guiaF.url)}"><img src="${escapeHtml(guiaF.portada)}" width="120" height="84" alt="" style="display:block;width:120px;height:84px;object-fit:cover;border:0;border-radius:10px;" /></a></td>` : ''}
          <td valign="middle" style="font-family:${F};"><a href="${escapeHtml(guiaF.url)}" style="color:#0d1b2a;font-size:15px;font-weight:800;line-height:1.35;text-decoration:none;">${escapeHtml(guiaF.titulo)}</a>${guiaF.minutos ? `<br /><span style="font-size:13px;color:#5b6f7c;">${guiaF.minutos} min de lectura</span>` : ''}</td>
        </tr></table>
      </td></tr>` : ''

  const gifReto = absoluteUrl(siteUrl, GIF_RETO)
  const urlRetos = absoluteUrl(siteUrl, '/retos')
  const bloqueReto = `<tr><td style="padding:22px 24px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1edff;border-radius:14px;"><tr>
          <td valign="middle" style="padding:16px;font-family:${F};">
            <span style="display:block;font-size:18px;font-weight:800;color:#5f43d9;">Los retos de hoy</span>
            <span style="display:block;margin:4px 0 12px;font-size:14px;line-height:1.45;color:#5b6f7c;">${escapeHtml(tu?.racha >= 3 ? `Seis retos nuevos cada día. Llevas ${tu.racha} días de racha: no la pierdas.` : 'Seis retos nuevos cada día: cartas, precios, siluetas y parejas.')}</span>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:#1e5175;border-radius:999px;"><a href="${escapeHtml(urlRetos)}" style="display:inline-block;padding:10px 18px;color:#ffffff;text-decoration:none;font-family:${F};font-weight:700;font-size:14px;">Jugar el de hoy</a></td></tr></table>
          </td>
          ${gifReto ? `<td width="110" valign="bottom" style="width:110px;padding:8px 8px 0 0;"><img src="${escapeHtml(gifReto)}" width="110" height="128" alt="" style="display:block;width:110px;height:128px;border:0;" /></td>` : ''}
        </tr></table>
      </td></tr>`

  const pieF = `<tr>
        <td style="padding:22px 24px 24px;">
          <div style="border-top:1px solid #e3e9ee;padding-top:16px;font-family:${F};font-size:12px;line-height:1.6;color:#6b7280;">
            ${escapeHtml(pie)}<br />
            ${(() => { const ajustes = absoluteUrl(siteUrl, '/perfil.html'); return `${ajustes ? `<a href="${escapeHtml(ajustes)}" style="color:#6b7280;text-decoration:underline;">Elegir qué avisos quieres</a>` : ''}${ajustes && unsubscribeUrl ? ' · ' : ''}${unsubscribeUrl ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Dejar de recibir estos</a>` : ''}` })()}
          </div>
        </td>
      </tr>`

  const contenido = `${cabecera}
      ${bloqueTu}
      ${bloqueNoticias}
      ${bloqueSuben}
      ${bloqueLanz}
      ${bloqueForo}
      ${bloqueGuia}
      ${bloqueReto}
      ${pieF}`

  // El preheader: lo primero que haya, como antes.
  const cabezas = [...lineas.map((l) => ({ titulo: l.texto })), ...noticiasF, ...lanzF, ...temasF]
  const preheader = cabezas.length ? `${cabezas[0].titulo}${cabezas.length > 1 ? ` y ${cabezas.length - 1} más` : ''}` : 'El resumen de la semana en PokeDoc.'

  return { subject: asunto, html: envoltorio({ preheader, contenido, ancho: 600 }), text }
}

// Cada fila de la cola con su pintura. El resumen semanal guarda en
// `preview` un JSON con los temas y la guía (lo encola
// resumen-semanal.mjs); si no parsea — filas antiguas de antes de este
// cambio — cae a la plantilla genérica de siempre y el correo sale
// igual que salía.
// `textos`: los propios del equipo por tipo (`correo_textos`, 1122), o nada.
export function renderFilaDeCola(fila, { siteUrl, unsubscribeUrl, textos = null }) {
  const propio = textos?.[fila?.type] || null
  if (fila?.type === 'weekly_digest') {
    try {
      const carga = JSON.parse(fila.preview)
      if (carga && Array.isArray(carga.temas)) {
        return renderResumenSemanal({ temas: carga.temas, guia: carga.guia || null, noticias: carga.noticias || [], lanzamientos: carga.lanzamientos || [], suben: carga.suben || [], semana: carga.semana || null, tu: carga.tu || null, siteUrl, unsubscribeUrl, propio })
      }
    } catch {}
  }
  return renderEmail({ subject: fila.subject, preview: fila.preview, link: fila.link, siteUrl, unsubscribeUrl, tipo: fila.type, propio })
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
    link: '/guia/como-leer-una-carta',
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
    link: '/guia/como-montar-tu-primer-mazo',
  },
  {
    type: 'guide_rejected',
    donde: 'Disparador de la base (supabase-migration-aviso-guia-revision.sql)',
    subject: 'Tu guía «Cómo montar tu primer mazo» necesita cambios',
    preview: 'Falta explicar la regla de las cartas de energía especial.',
    link: '/editor-guia.html?id=8c2a1b40-5555-6666-7777-888899990000',
  },
  {
    type: 'collab_application',
    donde: 'Disparador de la base (supabase-migration-colabora.sql)',
    subject: 'Alguien quiere colaborar en PokeDoc',
    preview: 'Ibai se ha ofrecido para echar una mano. Su solicitud está en /admin.',
    link: '/admin/',
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
    // El tablón del torneo (878): un aviso del organizador a los inscritos.
    type: 'torneo_aviso',
    donde: 'torneos_tablon_escribir (supabase-migration-878-tablon-torneo.sql)',
    subject: 'Aviso del torneo — Liga FDN',
    preview: 'La ronda 2 empieza a las 19:30; id yendo a vuestras mesas.',
    link: '/torneo?slug=liga-fdn',
  },
  {
    type: 'torneo_jornada',
    donde: 'ligas-jornadas (netlify/functions/ligas-jornadas.mjs, 1302)',
    subject: 'Mañana, Jornada 6 de la Liga FDN',
    preview: 'Jueves 13 a las 19:00. Aún no has mandado tu lista.',
    link: '/torneo?slug=liga-fdn',
  },
  {
    // Las tiendas (1067): a un email sin cuenta, al decidir en /admin.
    type: 'tienda_aceptada',
    donde: 'Al aceptar en /admin → Tiendas (netlify/functions/tienda-decidir.mjs)',
    subject: 'El Rincón del Entrenador ya puede entrar en PokeDoc',
    preview: 'Hola, Ane: hemos aceptado a El Rincón del Entrenador. Crea la cuenta de la tienda desde el botón: sirve una vez, con este email, durante 14 días.',
    link: '/alta-tienda?i=6f1d2c0a-1111-2222-3333-444455556666',
  },
  {
    type: 'tienda_rechazada',
    donde: 'Al rechazar en /admin → Tiendas (netlify/functions/tienda-decidir.mjs)',
    subject: 'Tu solicitud de tienda en PokeDoc',
    preview: 'Hola, Ane: gracias por querer traer El Rincón del Entrenador a PokeDoc. De momento no podemos abrir más tiendas; te escribiremos cuando abramos.',
    link: '/',
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
      noticias: [{ titulo: 'Reveladas las cartas del 30 aniversario', slug: 'cartas-30-aniversario', portada: '/assets/images/og-default.png' }],
      temas: [
        { id: 128, titulo: 'Mazos de Ceruledge en Mega Evolución', mensajes: 24 },
        { id: 131, titulo: 'Dudas del reglamento', mensajes: 11 },
      ],
      guia: { titulo: 'Cómo montar tu primer mazo', slug: 'como-montar-tu-primer-mazo', minutos: 8 },
      // Las tres que más suben (1488), con su foto en PNG.
      suben: [
        { nombre: 'Charizard ex', ruta: '/carta/sv03.5-199', imagen: 'https://assets.tcgdex.net/en/sv/sv03.5/199/low.png', pct: 38 },
        { nombre: 'Umbreon ex', ruta: '/carta/sv08.5-161', imagen: 'https://assets.tcgdex.net/en/sv/sv08.5/161/low.png', pct: 21 },
        { nombre: 'Charizard ex', ruta: '/carta/sv04.5-234', imagen: 'https://assets.tcgdex.net/en/sv/sv04.5/234/low.png', pct: 17 },
      ],
      lanzamientos: [{ nombre: 'Ascended Heroes', fecha: '2026-11-28' }],
      semana: { desde: '2026-11-20', hasta: '2026-11-26' },
    }),
  },
]
