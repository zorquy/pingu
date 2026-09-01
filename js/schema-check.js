import { supabase } from './supabase.js'

// Comprueba que la base tiene lo que el código da por hecho.
//
// Por qué existe esto: una migración sin ejecutar no se nota hasta que
// alguien usa la función que la necesita, y entonces revienta con un
// mensaje en inglés de PostgREST que no dice qué hacer. Pasó de verdad:
// faltaba `guide_comments.reply_to_id` y NADIE podía comentar en ninguna
// guía. El error decía "Could not find the 'reply_to_id' column ... in
// the schema cache", que no le sugiere a nadie "ejecuta este fichero".
//
// La comprobación se hace pidiendo la columna por la MISMA vía que usa
// la web (PostgREST). Si la petición falla, es exactamente lo que le
// pasará a un usuario.

// Cada entrada: qué se necesita, qué fichero lo crea y qué se rompe si
// falta. Lo tercero es lo importante: sin ello, un aviso técnico no le
// dice a nadie si corre prisa.
export const REQUISITOS = [
  { tabla: 'guide_comments', columna: 'reply_to_id', fichero: 'supabase-migration-guide-forum.sql', rompe: 'Nadie puede comentar en las guías.' },
  { tabla: 'user_progress', columna: 'read_at', fichero: 'supabase-migration-guias-leidas.sql', rompe: 'Leer una guía no cuenta ni da XP.' },
  { tabla: 'user_profiles', columna: 'hide_activity', fichero: 'supabase-migration-actividad.sql', rompe: 'El hilo de actividad no carga.' },
  { tabla: 'user_profiles', columna: 'username', fichero: 'supabase-migration-usernames.sql', rompe: 'Los perfiles públicos y el directorio no funcionan.' },
  { tabla: 'user_profiles', columna: 'current_streak', fichero: 'supabase-migration-streak.sql', rompe: 'La racha diaria no se guarda.' },
  { tabla: 'user_profiles', columna: 'streak_shields', fichero: 'supabase-migration-protector.sql', rompe: 'El protector de racha no se guarda ni se gasta.' },
  { tabla: 'user_profiles', columna: 'notification_prefs_disabled', fichero: 'supabase-migration-notification-prefs.sql', rompe: 'No se pueden desactivar los avisos.' },
  { tabla: 'user_profiles', columna: 'is_banned', fichero: 'supabase-migration-user-moderation.sql', rompe: 'No se puede banear ni silenciar a nadie.' },
  { tabla: 'guides', columna: 'review_status', fichero: 'supabase-migration-community-guides.sql', rompe: 'Las guías de la comunidad y la cola de revisión no funcionan.' },
  { tabla: 'categories', columna: 'icon_image', fichero: 'supabase-migration-category-icon-image.sql', rompe: 'Los iconos de categoría no se ven.' },
  { tabla: 'guide_reviews', columna: 'rating', fichero: 'supabase-migration-guide-reviews.sql', rompe: 'No se pueden valorar las guías.' },
  { tabla: 'user_follows', columna: 'follower_id', fichero: 'supabase-migration-follows.sql', rompe: 'No se puede seguir a nadie.' },
  { tabla: 'profile_comments', columna: 'body', fichero: 'supabase-migration-social.sql', rompe: 'El muro de los perfiles no funciona.' },
  { tabla: 'content_reports', columna: 'status', fichero: 'supabase-migration-content-reports.sql', rompe: 'No se puede reportar contenido.' },
  { tabla: 'app_feedback', columna: 'body', fichero: 'supabase-migration-app-feedback.sql', rompe: 'El botón de feedback no guarda nada.' },
  { tabla: 'client_errors', columna: 'message', fichero: 'supabase-migration-client-errors.sql', rompe: 'Los errores de los usuarios no se registran.' },
  { tabla: 'page_views', columna: 'path', fichero: 'supabase-migration-page-views.sql', rompe: 'No hay analítica de visitas.' },
  { tabla: 'user_notifications', columna: 'read_at', fichero: 'supabase-migration-user-notifications.sql', rompe: 'La campanita de avisos no funciona.' },
  { tabla: 'private_messages', columna: 'body', fichero: 'supabase-migration-private-messages.sql', rompe: 'Los mensajes privados no funcionan.' },
  { tabla: 'account_deletion_requests', columna: 'status', fichero: 'supabase-migration-account-deletion-requests.sql', rompe: 'No se puede pedir la baja de cuenta.' },
  { tabla: 'guide_pro_content', columna: 'blocks', fichero: 'supabase-migration-guide-pro-content.sql', rompe: 'El contenido Pro no se carga.' },
  { tabla: 'tcg_cards', columna: 'name_search', fichero: 'supabase-migration-cartas.sql', rompe: 'El buscador de cartas del editor no encuentra nada.' },
  { tabla: 'tcg_sets', columna: 'imported_at', fichero: 'supabase-migration-cartas.sql', rompe: 'No se pueden importar las cartas.' },
  // Torneos (tanda 225). Faltaban TODAS, y por eso una migración de
  // torneos sin ejecutar no se notaba: el barredor aparca el paso en
  // silencio y los avisos simplemente no salen, sin que nadie lo diga.
  // Se comprueba la columna MÁS NUEVA de cada fichero: si esa está, las
  // anteriores también, porque la migración es un solo fichero que se
  // ejecuta entero.
  { tabla: 'tournaments', columna: 'finish_notified_at', fichero: 'supabase-migration-torneos.sql', rompe: 'Los avisos de torneo (ronda, cancelación, recordatorio, final) no salen.' },
  { tabla: 'judge_calls', columna: 'notified_at', fichero: 'supabase-migration-torneos.sql', rompe: 'Llamar a un juez no le avisa.' },
  { tabla: 'tournament_registrations', columna: 'participation_confirmed_at', fichero: 'supabase-migration-torneos.sql', rompe: 'La inscripción en dos pasos no funciona.' },
  { tabla: 'tcg_cards', columna: 'regulation_mark', fichero: 'supabase-migration-cartas-marcas.sql', rompe: 'Las decklists no comprueban el reglamento (marcas H/I/J).' },
  // Tabla entera, no columna: si falta, el select ya falla igual y el
  // aviso sale. Sin ella los mazos NO dejan de identificarse (se deducen
  // solos), pero el catálogo curado no existe y /admin no puede llenarlo.
  { tabla: 'tcg_archetypes', columna: 'requiere', fichero: 'supabase-migration-arquetipos.sql', rompe: 'Los mazos salen siempre deducidos: el catálogo de arquetipos no existe.' },
  { tabla: 'match_log', columna: 'rival_mazo', fichero: 'supabase-migration-partidas.sql', rompe: '/mis-partidas no deja apuntar partidas de fuera (las de torneo sí salen).' },
  { tabla: 'tcg_sets', columna: 'tcg_online_code', fichero: 'supabase-migration-sets-live.sql', rompe: 'Los sets nuevos no traen su código de TCG Live: sus cartas salen sin imagen en las decklists.' },
]

// Distingue "no existe" de "existe pero no puedo leerlo". Una tabla que
// solo pueden leer los admins daría error para un usuario normal, y eso
// NO es una migración que falte.
function faltaDeVerdad(error) {
  const msg = (error?.message || '').toLowerCase()
  const code = error?.code || ''
  // 42703 = columna inexistente, 42P01 = tabla inexistente,
  // PGRST204 = PostgREST no la encuentra en su caché de esquema.
  if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(code)) return true
  return /could not find|does not exist|schema cache|unknown column/.test(msg)
}

export async function checkSchema() {
  const resultados = await Promise.all(
    REQUISITOS.map(async (r) => {
      const { error } = await supabase.from(r.tabla).select(r.columna).limit(1)
      if (!error) return { ...r, estado: 'ok' }
      if (faltaDeVerdad(error)) return { ...r, estado: 'falta', detalle: error.message }
      // Cualquier otro error (permisos, red) no se cuenta como que falte
      // la migración: decir "ejecuta este fichero" cuando el problema es
      // otro haría perder el tiempo.
      return { ...r, estado: 'duda', detalle: error.message }
    })
  )
  return {
    resultados,
    faltan: resultados.filter((r) => r.estado === 'falta'),
    dudas: resultados.filter((r) => r.estado === 'duda'),
  }
}
