// Darse de baja de los avisos por correo SIN iniciar sesión.
//
// Va con token (`user_profiles.email_unsubscribe_token`) porque quien
// recibe un correo puede no tener la sesión abierta —o estar leyéndolo en
// el móvil, o haber dejado de usar la web—. Obligar a iniciar sesión para
// dejar de recibir correo es de las cosas que hacen que en vez de darse
// de baja te marquen como spam, y eso sí que hace daño.
//
// Acepta los dos métodos a propósito:
//
//   GET   el enlace del pie del correo, que abre esta página en el
//         navegador y enseña la confirmación.
//   POST  la baja de un clic de RFC 8058: Gmail y Outlook enseñan su
//         propio botón de "cancelar suscripción" y hacen POST aquí solos,
//         sin que la persona llegue a abrir nada.
//
// El token NO se invalida al usarlo: si volviera a activar los avisos
// desde su perfil, el mismo enlace de un correo antiguo debe seguir
// sirviendo para volver a darse de baja.

import { escapeHtml } from '../lib/email.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

// Los tipos que mandan correo hoy, y cómo se llaman en la página de
// baja. Se valida contra estas claves para que nadie pueda meter basura
// en la columna a través del parámetro `tipo`.
//
// Tiene que ir a la par de EMAIL_TYPES (js/notifications.js) y de quien
// encola: las migraciones (supabase-migration-correo-avisos.sql y
// supabase-migration-correo-foro.sql) y, para los de torneo, el
// barredor (netlify/functions/torneos-barredor.mjs).
const NOMBRES = {
  private_message: 'los mensajes privados',
  comment_reply: 'las respuestas a tus comentarios',
  forum_reply: 'las respuestas en los temas que sigues',
  forum_mention: 'los avisos de cuando te mencionan',
  new_follower: 'los avisos de seguidores nuevos',
  guide_approved: 'los avisos de cuando se aprueba tu guía',
  guide_rejected: 'los avisos de cuando tu guía necesita cambios',
  // Solo lo recibe el equipo, pero tiene que estar aquí igual: un tipo
  // que esta lista no reconoce apaga TODOS los correos de esa persona
  // (ver más abajo), y darse de baja de "guías para revisar" no puede
  // dejar a un admin sin sus mensajes privados.
  guide_submitted: 'los avisos de guías nuevas para revisar',
  weekly_digest: 'el resumen semanal de la comunidad',
  // Torneos (tanda 223). Sin estas claves aquí, el enlace de baja de un
  // correo de torneo apagaría TODOS los correos de esa persona.
  torneo_partida: 'los avisos de tu partida',
  torneo_recordatorio: 'los avisos de que tu torneo va a empezar',
  torneo_cancelado: 'los avisos de torneos cancelados',
  torneo_plaza: 'los avisos de que la lista de espera te da plaza',
  torneo_ronda: 'los avisos de que empieza tu ronda',
  torneo_apertura: 'los avisos de torneos nuevos',
  torneo_final: 'los avisos de cuando termina un torneo',
  torneo_juez: 'los avisos de llamada a un juez',
}
const TIPOS = Object.keys(NOMBRES)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function pagina(titulo, mensaje, ok = true) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(titulo)} · PokeDoc</title></head>
<body style="margin:0;padding:32px 20px;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:460px;margin:40px auto;background:#fff;border-radius:12px;padding:32px;text-align:center;">
    <p style="margin:0 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#1e5175;font-weight:600;">PokeDoc</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:${ok ? '#111827' : '#b91c1c'};">${escapeHtml(titulo)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#374151;">${mensaje}</p>
    <a href="https://pokedoc.es/" style="display:inline-block;background:#1e5175;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:15px;">Ir a PokeDoc</a>
  </div>
</body></html>`
}

function respuestaHtml(html, status = 200) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export default async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('t') || ''
  const tipo = url.searchParams.get('tipo') || ''

  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) {
    return respuestaHtml(pagina('No se ha podido completar', 'Falta configuración en el servidor. Escríbenos y lo arreglamos.', false), 500)
  }

  // Un token con formato raro no llega ni a consultarse.
  if (!UUID.test(token)) {
    return respuestaHtml(pagina('Enlace no válido', 'Este enlace de baja no es correcto o ha caducado. Puedes cambiar tus avisos desde <b>Editar perfil</b> en la web.', false), 400)
  }

  const cabeceras = { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?email_unsubscribe_token=eq.${token}&select=id,notification_email_disabled`,
    { headers: cabeceras }
  )
  const [perfil] = res.ok ? await res.json() : []
  if (!perfil) {
    return respuestaHtml(pagina('Enlace no válido', 'Este enlace de baja no es correcto o ha caducado. Puedes cambiar tus avisos desde <b>Editar perfil</b> en la web.', false), 404)
  }

  // Sin tipo (o con uno que no existe) se desactiva TODO. Es lo que
  // espera quien pulsa "cancelar suscripción" en Gmail: no quiere elegir
  // categorías, quiere dejar de recibir correos.
  const aDesactivar = TIPOS.includes(tipo) ? [tipo] : TIPOS
  const actuales = perfil.notification_email_disabled || []
  const nuevos = [...new Set([...actuales, ...aDesactivar])]

  const upd = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${perfil.id}`, {
    method: 'PATCH',
    headers: { ...cabeceras, prefer: 'return=minimal' },
    body: JSON.stringify({ notification_email_disabled: nuevos }),
  })
  if (!upd.ok) {
    return respuestaHtml(pagina('No se ha podido completar', 'Inténtalo otra vez en un momento, o cámbialo desde <b>Editar perfil</b>.', false), 500)
  }

  // La baja de un clic espera un 200 a secas, sin HTML: el cliente de
  // correo no va a enseñar nada.
  if (req.method === 'POST') {
    return new Response('OK', { status: 200, headers: { 'content-type': 'text/plain' } })
  }

  const queTipo = NOMBRES[tipo] || 'todos los avisos'

  return respuestaHtml(
    pagina(
      'Listo, no te escribiremos más',
      `Has dejado de recibir por correo <b>${escapeHtml(queTipo)}</b>. Los seguirás viendo en la campanita al entrar en la web.<br /><br />Si te arrepientes, puedes volver a activarlos desde <b>Editar perfil</b>.`
    )
  )
}
