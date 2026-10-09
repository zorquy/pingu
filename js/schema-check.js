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
  { tabla: 'tcg_cards', columna: 'name_es', fichero: 'supabase-migration-cartas-nombre-es.sql', rompe: 'Las fichas de carta salen con el nombre en inglés y el buscador no encuentra por el español.' },
  { tabla: 'tcg_sets', columna: 'imported_at', fichero: 'supabase-migration-cartas.sql', rompe: 'No se pueden importar las cartas.' },
  { tabla: 'tcg_sets', columna: 'names_fixed_at', fichero: 'supabase-migration-cartas-nombre-es.sql', rompe: 'Las cartas engordadas en español se quedan con el nombre traducido en la clave, y su bloque de torneos no sale.' },
  { tabla: 'tcg_sets', columna: 'regulation_mark', fichero: 'supabase-migration-marcas-por-set.sql', rompe: 'Los sets que TCGdex no marca dejan sus cartas sin marca, y la ficha dice que no son legales cuando sí lo son.' },
  { tabla: 'tcg_sets', columna: 'curado_at', fichero: 'supabase-migration-sets-curado.sql', rompe: 'El código de TCG Live no se cura, y los sets salen con el identificador de TCGdex (ME05) en vez del que usa la gente (PBL).' },
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
  // Basta con vigilar `detalle_at`: es la columna que la función
  // programada consulta en CADA pasada, así que si falta, `cartas-detalle`
  // revienta una vez por hora en silencio y nadie se entera.
  { tabla: 'tcg_cards', columna: 'detalle_at', fichero: 'supabase-migration-cartas-detalle.sql', rompe: 'Las cartas no se engordan: sin PS, ataques, rareza ni ilustrador, y la función cartas-detalle falla cada hora.' },
  // Tabla entera, no columna: si falta, el select ya falla igual y el
  // aviso sale. Sin ella los mazos NO dejan de identificarse (se deducen
  // solos), pero el catálogo curado no existe y /admin no puede llenarlo.
  { tabla: 'tcg_archetypes', columna: 'requiere', fichero: 'supabase-migration-arquetipos.sql', rompe: 'Los mazos salen siempre deducidos: el catálogo de arquetipos no existe.' },
  { tabla: 'match_log', columna: 'rival_mazo', fichero: 'supabase-migration-partidas.sql', rompe: '/mis-partidas no deja apuntar partidas de fuera (las de torneo sí salen).' },
  { tabla: 'tcg_sets', columna: 'tcg_online_code', fichero: 'supabase-migration-sets-live.sql', rompe: 'Los sets nuevos no traen su código de TCG Live: sus cartas salen sin imagen en las decklists.' },
  // Se comprueba la columna nueva de match_log y no solo la tabla: la
  // migración crea las dos cosas en el mismo fichero.
  { tabla: 'match_log', columna: 'torneo_id', fichero: 'supabase-migration-partidas-torneos.sql', rompe: '/mis-partidas no deja apuntar torneos (las partidas sueltas sí funcionan).' },
  { tabla: 'tournaments', columna: 'image_url', fichero: 'supabase-migration-torneos-imagen.sql', rompe: 'No se puede poner imagen a un torneo (crear y editar torneos sí funciona).' },
  { tabla: 'tournaments', columna: 'decklist_visibility', fichero: 'supabase-migration-torneos-listas.sql', rompe: 'El modo «listas nunca públicas» no se guarda (los otros dos modos van por el booleano viejo).' },
  { tabla: 'tournaments', columna: 'banner_url', fichero: 'supabase-migration-torneos-banner.sql', rompe: 'No se puede poner banner a un torneo (todo lo demás funciona).' },
  { tabla: 'tournaments', columna: 'prizes', fichero: 'supabase-migration-torneos-premios.sql', rompe: 'Los premios de un torneo no se guardan: se pueden escribir y al recargar no están.' },
  // Tabla entera (tanda 367). Un torneo con código sin ella se queda a la
  // vista y sin llave: se ve, pero no entra nadie.
  { tabla: 'tournament_join_codes', columna: 'code', fichero: 'supabase-migration-torneos-codigo.sql', rompe: 'Los torneos con código no guardan el suyo: se ven, pero no se puede entrar.' },
  // Los intercambios (tanda 376). Se comprueba `user_wants`, que es la
  // tabla NUEVA; la columna `user_collection.cambio` la cubre el puente
  // de `js/mi-coleccion/datos.js`, que deja de pedirla si no está.
  { tabla: 'user_wants', columna: 'prioridad', fichero: 'supabase-migration-intercambios.sql', rompe: 'La pestaña «Cambios» de Mi colección no funciona: nadie puede apuntar lo que busca ni ver quién le encaja.' },
  // El valor en el tiempo (tanda 377). Sin esto la gráfica dice «la
  // primera foto se toma esta noche» para siempre, y la función
  // programada se salta cada pasada sin dar guerra.
  { tabla: 'user_collection_value', columna: 'valor', fichero: 'supabase-migration-valor-historico.sql', rompe: 'La gráfica del valor de una colección no sale nunca (el resto de Mi colección funciona).' },
  // Las repeticiones guardadas (tanda 480). Solo las lee su dueño: con
  // sesión de admin, la consulta va bien si la tabla existe.
  { tabla: 'replays', columna: 'compartida', fichero: 'supabase-migration-repeticiones.sql', rompe: 'No se pueden guardar repeticiones ni compartirlas con un enlace corto (el enlace largo, que lleva la partida dentro, sigue funcionando).' },
  // Lo que se le añadió a la misma migración después (tandas 494 a 496):
  // con la de antes puesta, guardar sigue funcionando, y esto avisa de que
  // hay que ejecutarla otra vez.
  { tabla: 'replays', columna: 'notas', fichero: 'supabase-migration-repeticiones.sql', rompe: 'Las repeticiones guardadas no llevan su mazo ni se les pueden poner notas (guardar y compartir sí funcionan): hay que ejecutar la migración otra vez.' },
  { tabla: 'match_log', columna: 'replay_id', fichero: 'supabase-migration-repeticiones.sql', rompe: 'Guardar una repetición no la apunta en Mis partidas: hay que ejecutar la migración otra vez.' },
  { tabla: 'tournament_match_replays', columna: 'replay_id', fichero: 'supabase-migration-repeticiones.sql', rompe: 'No se puede adjuntar la repetición de una partida de torneo: hay que ejecutar la migración otra vez.' },
  // Las de la 630 en adelante (tanda 791, LO7): hasta aquí la lista se
  // había quedado en la 480, y las pendientes se llevaban de memoria en la
  // bitácora. Las que solo crean funciones se miran con `rpc` (ver abajo).
  { tabla: 'tcg_eras', columna: 'market', fichero: 'supabase-migration-colecciones-editables.sql', rompe: 'Las eras del catálogo no se pueden editar desde /admin.' },
  { tabla: 'carta_del_dia', columna: 'day', fichero: 'supabase-migration-carta-del-dia.sql', rompe: 'El reto «¿Qué carta es?» no tiene carta.' },
  { tabla: 'mas_caro_del_dia', columna: 'day', fichero: 'supabase-migration-mas-caro.sql', rompe: 'El reto «¿Más caro o más barato?» no tiene partida.' },
  { tabla: 'enlaces_cortos', columna: 'id', fichero: 'supabase-migration-enlaces-cortos.sql', rompe: 'Los enlaces cortos no se crean (el largo sigue funcionando).' },
  { tabla: 'tcg_card_prices', columna: 'cm_url', fichero: 'supabase-migration-precios-url.sql', rompe: 'Las fichas no enlazan a la página exacta de Cardmarket.' },
  { tabla: 'tcg_card_prices', columna: 'tp_normal_market', fichero: 'supabase-migration-precios-tcgplayer.sql', rompe: 'Los precios de TCGplayer no se guardan.' },
  { tabla: 'tcg_cards', columna: 'cm_id_product_propio', fichero: 'supabase-migration-cardmarket-propio.sql', rompe: 'El emparejamiento propio con Cardmarket no se guarda.' },
  { tabla: 'tcg_card_prices', columna: 'cm_low_en', fichero: 'supabase-migration-tcggo-precios.sql', rompe: 'Los precios por idioma de TCGGO no se guardan.' },
  { tabla: 'tcg_card_prices', columna: 'cm_low_ja', fichero: 'supabase-migration-tcggo-japones.sql', rompe: 'Las cartas japonesas no tienen precio.' },
  { tabla: 'tcg_card_history', columna: 'card_id', fichero: 'supabase-migration-tcggo-historial.sql', rompe: 'La gráfica del histórico de una carta no sale.' },
  { tabla: 'tcg_cards', columna: 'tcggo_id', fichero: 'supabase-migration-tcggo-catalogo.sql', rompe: 'El catálogo de TCGGO no se escribe: los sets nuevos no entran.' },
  { tabla: 'tcg_set_valor', columna: 'set_id', fichero: 'supabase-migration-tcggo-expansiones.sql', rompe: 'Las expansiones no enseñan su valor.' },
  { rpc: 'match_log_mazo_propio', fichero: 'supabase-migration-partidas-mazo-guardado.sql', rompe: 'Mis partidas no puede apuntar el mazo guardado con el que jugaste.' },
  { tabla: 'user_price_alerts', columna: 'id', fichero: 'supabase-migration-avisos-precio.sql', rompe: 'Los avisos de precio no se pueden poner.' },
  { tabla: 'tcg_card_prices', columna: 'cm_low_ko', fichero: 'supabase-migration-tcggo-corea-china.sql', rompe: 'Las cartas coreanas y chinas no tienen precio.' },
  { tabla: 'match_log', columna: 'formato', fichero: 'supabase-migration-partidas-juegos.sql', rompe: 'Las partidas no guardan su formato ni sus juegos.' },
  { tabla: 'user_showcase', columna: 'user_id', fichero: 'supabase-migration-vitrina.sql', rompe: 'La vitrina del perfil no se guarda.' },
  { tabla: 'user_release_alerts', columna: 'id', fichero: 'supabase-migration-avisos-lanzamientos.sql', rompe: 'No se puede pedir aviso de un lanzamiento.' },
  { tabla: 'user_albums', columna: 'tipo', fichero: 'supabase-migration-albumes-tipos.sql', rompe: 'Los álbumes no guardan su tipo (binder, archivador…).' },
  { tabla: 'tcg_products', columna: 'id', fichero: 'supabase-migration-productos.sql', rompe: 'La pestaña Productos de Mi colección no tiene nada.' },
  { rpc: 'intercambios_avisar', fichero: 'supabase-migration-cambios-seguidos.sql', rompe: 'No avisa cuando alguien a quien sigues da una carta que buscas.' },
  { tabla: 'user_albums', columna: 'portada', fichero: 'supabase-migration-albumes-portada.sql', rompe: 'Los álbumes no guardan su portada.' },
  { rpc: 'coleccion_seguidos_y_mis_deseos', fichero: 'supabase-migration-seguidos-y-deseos.sql', rompe: 'El bloque de quién tiene lo que te falta no sale.' },
  { tabla: 'tcg_product_history', columna: 'product_id', fichero: 'supabase-migration-productos-ficha.sql', rompe: 'La ficha de un producto sale sin gráfica.' },
  { rpc: 'intercambios_mercado', fichero: 'supabase-migration-mercado.sql', rompe: 'El Mercado sale vacío.' },
  { tabla: 'tournament_matchday_decklists', columna: 'tournament_id', fichero: 'supabase-migration-torneos-jornadas.sql', rompe: 'En las ligas no se puede entregar la lista de cada jornada.' },
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

// Una función se mira SIN ejecutarla: se la llama con un argumento que no
// tiene, y PostgREST contesta PGRST202 sin correr nada. Si existe, su pista
// la nombra («Perhaps you meant to call the function public.x(p_…)»); si no,
// no. Así una RPC que escribe no escribe por mirar si está.
export function veredictoDeSonda(nombre, error) {
  if (!error) return { estado: 'ok' }
  const texto = `${error.message || ''} ${error.hint || ''} ${error.details || ''}`
  if (new RegExp(`public\\.${nombre}\\(`).test(error.hint || '')) return { estado: 'ok' }
  if (error.code === 'PGRST202') return { estado: 'falta', detalle: error.message }
  return { estado: 'duda', detalle: texto.trim() }
}

async function sondearFuncion(nombre) {
  const { error } = await supabase.rpc(nombre, { __sonda_791: 1 })
  return veredictoDeSonda(nombre, error)
}

export async function checkSchema() {
  const resultados = await Promise.all(
    REQUISITOS.map(async (r) => {
      if (r.rpc) return { ...r, ...(await sondearFuncion(r.rpc)) }
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
