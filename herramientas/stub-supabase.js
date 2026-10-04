// Doble de Supabase para las pruebas de torneos (reconstruido en la
// tanda 223: el original se perdió al reiniciarse el contenedor).
//
// NO va en el repo por la norma de CLAUDE.md. Vive solo en el entorno
// de pruebas, y sync-forum.sh lo respeta al copiar el sitio.
//
// Emula lo justo de PostgREST que usan /torneos y /torneo: el
// encadenado select/eq/in/is/order/limit + maybeSingle/single, y las
// escrituras insert/update/upsert/delete. Cada escritura se apunta en
// sessionStorage para que una prueba pueda comprobar QUÉ se guardó
// aunque la página navegue después.

// El doble se copia ENCIMA de js/supabase.js, así que `./texto.js` es el
// de verdad. Se importa para generar `name_search` con la MISMA función
// que usa la web: una copia a mano del cálculo de una columna generada se
// separa de la base sin dar error (tanda 447).
import { normalizeSearch } from './texto.js'

// ── Las tablas ──
const T = {
  user_profiles: [],
  tournaments: [],
  tournament_registrations: [],
  tournament_join_codes: [],
  user_collection: [],
  user_albums: [],
  // Lo que cada uno busca (tanda 376). Lo que DA no es tabla: es la
  // columna `cambio` de su linea de `user_collection`.
  user_wants: [],
  // La foto diaria del valor de una coleccion (tanda 377).
  user_collection_value: [],
  // Los precios guardados de Cardmarket (tanda 585): `cm_url` es el
  // enlace exacto que trae pokemontcg.io cuando TCGdex no tiene precio.
  tcg_card_prices: [],
  // Las CARPETAS (tandas 402 y 411), que el doble no tenia hasta la 477:
  // `listarCarpetas` daba un 42P01, el cliente lo lee como «falta la
  // migracion» y la pestaña salia vacia en TODAS las pruebas. O sea que
  // la pantalla de carpetas no la habia probado nadie nunca, y nada lo
  // cantaba porque el vacio es un estado legitimo de esa pantalla.
  collection_folders: [],
  collection_folder_cards: [],
  tournament_decklists: [],
  rounds: [],
  tournament_matches: [],
  match_reports: [],
  match_results: [],
  pairing_history: [],
  judge_applications: [],
  collab_applications: [],
  judge_calls: [],
  judge_messages: [],
  match_messages: [],
  forum_sections: [],
  forum_boards: [],
  forum_threads: [],
  forum_posts: [],
  forum_post_reactions: [],
  forum_thread_reads: [],
  forum_subscriptions: [],
  // Las encuestas del foro (tanda 314). Tres tablas: la encuesta de un
  // tema, sus opciones y los votos.
  forum_polls: [],
  forum_poll_options: [],
  forum_poll_votes: [],
  user_notifications: [],
  tcg_cards: [],
  tcg_archetypes: [],
  tcg_sets: [],
  // Los nombres y el orden que se les pone a las eras desde /admin (550).
  tcg_eras: [],
  tcg_card_play: [],
  // Los mazos del constructor (tanda 361).
  user_decks: [],
  // Las repeticiones guardadas (tanda 480). Solo las ve, cambia y borra
  // su dueño (ver `aplicar`), y se guardan y se abren por sus funciones,
  // como en supabase-migration-repeticiones.sql.
  replays: [],
  // Las repeticiones adjuntas a una mesa de torneo (tanda 496): quién las
  // ve lo decide la política (los dos jugadores, quien lleva el torneo y
  // sus jueces), y nadie escribe en la tabla: se adjunta por función.
  tournament_match_replays: [],
  // Los premios ya dados (tanda 516): una fila por jugador y torneo.
  tournament_prize_deliveries: [],
  // Los mazos del meta (tanda 520, para la ficha de /meta/:arquetipo):
  // el doble no los tenía y la ficha salía siempre «Mazo no encontrado».
  meta_arquetipos: [],
  meta_guias: [],
  // Las cartas de las listas del meta, sumadas por día: de ahí sale qué
  // impresión de un Pokémon se juega de verdad en una repetición.
  meta_cartas_dia: [],
  // Los puzles (tanda 521) y sus respuestas.
  replay_puzzles: [],
  // Los enlaces cortos (tanda 591): solo por sus dos funciones.
  enlaces_cortos: [],
  replay_puzzle_answers: [],
  match_log: [],
  match_log_torneos: [],
  guides: [],
  categories: [],
  guide_suggestions: [],
  site_settings: [],
  push_subscriptions: [],
  achievement_definitions: [],
  user_achievements: [],
  daily_challenge_results: [],
  user_progress: [],
  profile_comments: [],
  xp_mes: [],
}

// ── Quién eres ──
// Por defecto un admin, que es quien puede entrar hoy en torneos.
const PERSONAS = {
  'admin-1': { username: 'Admin', is_admin: true },
  // Moderación NO es administración: ordena el foro pero no abre ni
  // cierra secciones. Hace falta como persona propia para poder exigir
  // la diferencia (tanda 256).
  'mod-1': { username: 'Brock', is_admin: false, is_moderator: true },
  // Ash llega con medallas de torneo ya ganadas: hace falta para probar
  // la vitrina del perfil sin tener que jugarse un torneo entero.
  'user-1': { username: 'Ash', is_admin: false, achievements: ['torneo_jugado', 'torneo_podio', 'torneo_campeon'] },
  'user-2': { username: 'Misty', is_admin: false },
  'user-3': { username: 'jesus', is_admin: false },
}
for (const [id, p] of Object.entries(PERSONAS)) {
  T.user_profiles.push({
    id,
    username: p.username,
    display_name: p.username,
    is_admin: p.is_admin,
    // El rol de organizador de torneos (tanda 295): en la base la columna
    // tiene valor por defecto, así que aquí NINGUNA fila la tiene vacía.
    is_tournament_admin: !!p.is_tournament_admin,
    is_moderator: !!p.is_moderator,
    achievements: p.achievements || [],
    avatar_url: null,
    xp: 0,
    notification_prefs_disabled: [],
    notification_email_disabled: [],
  })
}

// Gente a medida (tanda 301). Las cinco personas de arriba son fijas y no
// tienen ni XP ni racha ni fecha de actividad: /usuarios vive justo de
// eso. Este gancho MEZCLA por id —retoca la que ya existe, añade la que
// no— para que una prueba pueda montar una comunidad entera sin tocar
// las cinco de siempre, que usan las demás pruebas.
const genteExtra = typeof window !== 'undefined' ? window.__FAKE_PERFILES__ : null
if (Array.isArray(genteExtra)) {
  for (const fila of genteExtra) {
    const ya = T.user_profiles.find((p) => p.id === fila.id)
    if (ya) Object.assign(ya, fila)
    else
      T.user_profiles.push({
        is_admin: false,
        is_tournament_admin: false,
        is_moderator: false,
        achievements: [],
        avatar_url: null,
        xp: 0,
        notification_prefs_disabled: [],
        notification_email_disabled: [],
        ...fila,
      })
  }
}

const quienSoy = typeof window !== 'undefined' ? window.__FAKE_SESSION__ || 'admin-1' : 'admin-1'

// Retoques sobre el perfil de QUIEN MIRA (tanda 295). Así una prueba
// puede darle el rol de organizador de torneos sin inventarse una
// persona nueva ni reescribir la tabla entera.
const retoqueDePerfil = typeof window !== 'undefined' ? window.__FAKE_PERFIL__ : null
if (retoqueDePerfil && typeof retoqueDePerfil === 'object') {
  const fila = T.user_profiles.find((p) => p.id === quienSoy)
  if (fila) Object.assign(fila, retoqueDePerfil)
}
const sesion = quienSoy === 'none' ? null : { user: { id: quienSoy, email: `${quienSoy}@pruebas.test` } }

// ── Las semillas ──
// Cada gancho rellena una tabla; los campos que no se digan toman un
// valor por defecto razonable, para que una prueba solo tenga que
// escribir lo que le importa.
function sembrar(gancho, tabla, porDefecto) {
  const filas = typeof window !== 'undefined' ? window[gancho] : null
  if (!Array.isArray(filas)) return
  filas.forEach((fila, i) => T[tabla].push(generadas(tabla, { ...porDefecto(i), ...fila })))
}

// LAS COLUMNAS GENERADAS SE GENERAN, no se siembran (tanda 447).
//
// `name_search` y `name_key` de `tcg_cards` son columnas GENERADAS en la
// base (supabase-migration-cartas-nombre-es.sql): Postgres las calcula de
// `name` y `name_es` y NO SE PUEDEN ESCRIBIR. Aquí no se generaban, así
// que cada fixture se las escribía A MANO — y una copia a mano de algo
// que la base calcula sola dice lo que quiera el que la escribe.
//
// Lo que costó descubrirlo: la prueba del escáner buscaba «Charizard» en
// un fixture SIN `name_search`, y el `like` comparaba contra la cadena
// vacía. CERO resultados, con la carta delante. Al revés también pica:
// una fila con `name: 'Carta 1'` y `name_search: 'charizard'` habría dado
// un verde que en producción no puede pasar.
//
// Y el valor es el de la base, con sus DOS nombres pegados —el inglés y
// el español— porque el buscador tiene que encontrar por los dos.
function generadas(tabla, fila) {
  if (tabla !== 'tcg_cards') return fila
  // Si alguien la sembró a mano, se la pisa: en la base no hay forma de
  // escribirla, y una prueba que dependa de haberla escrito no habla de
  // la web.
  return {
    ...fila,
    // Y `name_en` desde la 546: el buscador tiene que encontrar una carta
    // japonesa por el nombre que la pantalla enseña.
    name_search: normalizeSearch(`${fila.name || ''} ${fila.name_es || ''} ${fila.name_en || ''}`),
    name_key: normalizeSearch(fila.name || ''),
  }
}

sembrar('__FAKE_TORNEOS__', 'tournaments', (i) => ({
  id: `torneo-${i + 1}`,
  slug: `torneo-${i + 1}`,
  admin_id: 'admin-1',
  name: `Torneo ${i + 1}`,
  description: null,
  start_at: new Date(Date.now() + 86400e3).toISOString(),
  status: 'draft',
  format: 'swiss',
  matchday_dates: null,
  max_players: 16,
  swiss_rounds: 4,
  round_time_minutes: 30,
  checkin_minutes: 5,
  swiss_bo: 1,
  top_cut_bo: 3,
  top_cut_size: 4,
  show_opponent_decklists: false,
  current_round_id: null,
  pairing_seed: 'semilla-de-prueba',
  registration_notified_at: null,
  champion_id: null,
  podium: null,
  result_announced_at: null,
  cancel_notified_at: null,
  reminder_notified_at: null,
  delete_after_notice_at: null,
}))

// Los álbumes soñados (tanda 366).
sembrar('__FAKE_ALBUMES__', 'user_albums', (i) => ({
  id: `alb-${i + 1}`,
  user_id: 'admin-1',
  nombre: `Álbum ${i + 1}`,
  descripcion: null,
  cartas: [],
  is_public: false,
  updated_at: new Date().toISOString(),
}))

// Los precios guardados (tanda 585). Solo lo que se siembre: una fila que
// no está es «todavía no se ha mirado», como en la base.
sembrar('__FAKE_PRECIOS__', 'tcg_card_prices', (i) => ({
  card_id: `set1-${i + 1}`,
  cm_id_product: null,
  cm_low: null, cm_trend: null, cm_avg30: null, cm_avg7: null,
  cm_low_holo: null, cm_trend_holo: null, cm_avg30_holo: null,
  cm_updated: null, cm_url: null, origen: null,
  checked_at: new Date().toISOString(),
}))

// Mi colección (tanda 365) y los álbumes a mano (366).
sembrar('__FAKE_COLECCION__', 'user_collection', (i) => ({
  id: `col-${i + 1}`,
  user_id: 'admin-1',
  card_id: `set1-${i + 1}`,
  market: 'WEST',
  idioma: 'es',
  estado: 'NM',
  variante: 'normal',
  cantidad: 1,
  // Cuantas copias de esta linea da su dueno (tanda 376). A 0 por
  // defecto: nadie da nada sin decirlo.
  cambio: 0,
  gradeo: null,
  valor_manual: null,
  precio_compra: null,
  notas: null,
  created_at: new Date(Date.now() - i * 60000).toISOString(),
  updated_at: new Date().toISOString(),
}))

// Lo que cada uno busca (tanda 376). `idioma` a null es «me da igual»,
// que no es lo mismo que «en espanol»: son los dos casos que cruzan
// distinto en el tablon.
// El valor de una coleccion dia a dia (tanda 377). La semilla va vacia:
// con menos de dos dias la grafica dice «la primera foto se toma esta
// noche», que es un estado que hay que poder probar.
sembrar('__FAKE_VALOR__', 'user_collection_value', (i) => ({
  user_id: 'admin-1',
  dia: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
  valor: 100,
  copias: 1,
  distintas: 1,
  sin_precio: 0,
}))

sembrar('__FAKE_DESEOS__', 'user_wants', (i) => ({
  id: `des-${i + 1}`,
  user_id: 'admin-1',
  card_id: `set1-${i + 1}`,
  idioma: null,
  prioridad: 1,
  notas: null,
  created_at: new Date(Date.now() - i * 60000).toISOString(),
}))

// El código de entrada de un torneo (tanda 367). Vive en su propia tabla
// porque la fila del torneo la lee todo el mundo.
sembrar('__FAKE_CODIGOS__', 'tournament_join_codes', (i) => ({
  tournament_id: `torneo-${i + 1}`,
  code: 'PACHA',
}))

sembrar('__FAKE_INSCRIPCIONES__', 'tournament_registrations', (i) => ({
  id: `insc-${i + 1}`,
  tournament_id: 'torneo-1',
  user_id: 'user-1',
  status: 'active',
  tcg_live_username: `TCG_${i + 1}`,
  registered_at: new Date(Date.now() - (10 - i) * 60000).toISOString(),
  dropped_at: null,
  dropped_after_round_id: null,
  participation_confirmed_at: null,
}))

sembrar('__FAKE_DECKLISTS__', 'tournament_decklists', (i) => ({
  id: `deck-${i + 1}`,
  tournament_id: 'torneo-1',
  user_id: 'user-1',
  content: '',
  submitted_at: new Date().toISOString(),
  locked_at: null,
}))

sembrar('__FAKE_RONDAS__', 'rounds', (i) => ({
  id: `ronda-${i + 1}`,
  tournament_id: 'torneo-1',
  round_number: i + 1,
  phase: 'swiss',
  status: 'pending',
  started_at: new Date().toISOString(),
  ends_at: null,
  players_notified_at: null,
  checkin_warned_at: null,
}))

sembrar('__FAKE_MESAS__', 'tournament_matches', (i) => ({
  id: `mesa-${i + 1}`,
  round_id: 'ronda-1',
  table_number: i + 1,
  bracket_position: null,
  player_a_id: null,
  player_b_id: null,
  status: 'active',
  check_in_a_at: null,
  check_in_b_at: null,
  await_notified_at: null,
  resolved_notified_at: null,
}))

// Los partes de resultado. `game_number` es de la tanda 291: 0 es el
// match entero (BO1) y 1-3 cada partida de un BO3 — igual que en la base.
sembrar('__FAKE_REPORTES__', 'match_reports', (i) => ({
  id: `rep-${i + 1}`,
  match_id: 'mesa-1',
  reporter_id: 'user-1',
  result: 'win',
  game_number: 0,
  score: null,
  reported_at: new Date().toISOString(),
}))

sembrar('__FAKE_RESULTADOS__', 'match_results', (i) => ({
  id: `res-${i + 1}`,
  match_id: `mesa-${i + 1}`,
  result: 'a_wins',
  winner_id: null,
  score_a: 1,
  score_b: 0,
  resolved_by: null,
  created_at: new Date().toISOString(),
}))

// ── El foro ──
sembrar('__FAKE_SECCIONES__', 'forum_sections', (i) => ({
  id: `seccion-${i + 1}`,
  name: `Sección ${i + 1}`,
  position: i,
}))

sembrar('__FAKE_FOROS__', 'forum_boards', (i) => ({
  id: `foro-${i + 1}`,
  section_id: 'seccion-1',
  parent_id: null,
  slug: `foro-${i + 1}`,
  name: `Foro ${i + 1}`,
  description: null,
  position: i,
  is_hidden: false,
  min_role: null,
}))

sembrar('__FAKE_TEMAS__', 'forum_threads', (i) => ({
  id: `tema-${i + 1}`,
  board_id: 'foro-1',
  author_id: 'user-1',
  title: `Tema ${i + 1}`,
  prefix: null,
  is_pinned: false,
  is_locked: false,
  view_count: 0,
  post_count: 1,
  last_post_at: new Date(Date.now() - (20 - i) * 60000).toISOString(),
  created_at: new Date(Date.now() - (20 - i) * 60000).toISOString(),
}))

sembrar('__FAKE_MENSAJES__', 'forum_posts', (i) => ({
  id: `msg-${i + 1}`,
  thread_id: 'tema-1',
  author_id: 'user-1',
  body_html: `<p>Mensaje ${i + 1}</p>`,
  reply_to_id: null,
  is_solution: false,
  edited_at: null,
  created_at: new Date(Date.now() - (20 - i) * 60000).toISOString(),
}))

sembrar('__FAKE_REACCIONES__', 'forum_post_reactions', (i) => ({
  id: `reac-${i + 1}`,
  post_id: 'msg-1',
  user_id: 'user-2',
  kind: 'like',
}))

// La encuesta de un tema, sus opciones y los votos (tanda 314).
//
// Se siembran por separado a propósito: hay pruebas que necesitan una
// encuesta SIN votos (para ver que no se enseñan los resultados antes de
// votar) y otras con votos de otra gente.
sembrar('__FAKE_ENCUESTA__', 'forum_polls', (i) => ({
  thread_id: 'tema-1',
  question: `¿Pregunta ${i + 1}?`,
  multiple: false,
  closes_at: null,
}))

sembrar('__FAKE_OPCIONES__', 'forum_poll_options', (i) => ({
  id: `op-${i + 1}`,
  thread_id: 'tema-1',
  label: `Opción ${i + 1}`,
  order_pos: i,
}))

sembrar('__FAKE_VOTOS__', 'forum_poll_votes', (i) => ({
  id: `voto-${i + 1}`,
  option_id: 'op-1',
  thread_id: 'tema-1',
  user_id: `user-${i + 2}`,
}))

sembrar('__FAKE_LECTURAS__', 'forum_thread_reads', (i) => ({
  id: `lect-${i + 1}`,
  thread_id: 'tema-1',
  user_id: 'admin-1',
  read_at: new Date().toISOString(),
}))

// El catálogo curado de arquetipos (tanda 230). Sin sembrar nada, la
// tabla sale vacía y los mazos se deducen solos — que es exactamente lo
// que pasa en producción hasta que un admin la llene.
// El catálogo de cartas y sus sets (tanda 232): hacen falta para probar
// que un código de TCG Live resuelve a una carta con imagen.
sembrar('__FAKE_CARPETAS__', 'collection_folders', (i) => ({
  id: `carpeta-${i}`, user_id: 'admin-1', parent_id: null, nombre: `Carpeta ${i}`,
  icono: 'folder', dex_id: null, emoji: null, color: null, orden: i,
  created_at: new Date(2026, 0, 1 + i).toISOString(),
}))
sembrar('__FAKE_CARPETA_CARTAS__', 'collection_folder_cards', (i) => ({
  id: `cc-${i}`, user_id: 'admin-1', folder_id: 'carpeta-0', line_id: `linea-${i}`,
}))

sembrar('__FAKE_SETS__', 'tcg_sets', (i) => ({
  id: `set-${i}`, name: `Set ${i}`, market: 'WEST',
}))
sembrar('__FAKE_ERAS__', 'tcg_eras', (i) => ({
  market: 'WEST', id: `era-${i}`, nombre: `Era ${i}`, orden: 0,
}))
sembrar('__FAKE_CARTAS__', 'tcg_cards', (i) => ({
  id: `carta-${i}`, set_id: 'set-0', market: 'WEST', local_id: String(i), name: `Carta ${i}`, image_path: `x/y/${i}`,
}))
// Lo que se juega en los torneos (tanda 325). La clave es el nombre
// normalizado, igual que en la tabla de verdad.
sembrar('__FAKE_JUEGO__', 'tcg_card_play', (i) => ({
  name_key: `carta ${i}`, name: `Carta ${i}`, decks: 0, total_copies: 0, tournaments: 0, archetypes: [],
}))

sembrar('__FAKE_AJUSTES__', 'site_settings', (i) => ({ key: `clave-${i}`, value: {} }))

// Los mazos guardados del constructor (tanda 359): los lista «Usar un
// mazo del constructor» en la decklist de un torneo, y /mazos.
sembrar('__FAKE_MAZOS__', 'user_decks', (i) => ({
  id: `mazo-${i + 1}`,
  user_id: 'user-1',
  name: `Mazo ${i + 1}`,
  format: 'standard',
  cards: [],
  cover_card: null,
  is_public: false,
  created_at: new Date(Date.now() - (i + 1) * 86400e3).toISOString(),
  updated_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
}))

sembrar('__FAKE_REPETICIONES__', 'replays', (i) => ({
  id: `rep${String(i + 1).padStart(7, '0')}`,
  user_id: 'user-1',
  titulo: `Repetición ${i + 1}`,
  registro: '',
  jugador_a: 'Rojo',
  jugador_b: 'Azul',
  ganador: null,
  turnos: 10,
  compartida: false,
  // Lo que se añadió en las tandas 494 y 495, con el valor por defecto de
  // la base (tanda 437: al copiar una columna, su defecto también).
  mazo_a: null,
  mazo_b: null,
  notas: [],
  // La galería (tanda 520), con sus valores por defecto de la base.
  publica: false,
  arquetipos: null,
  publicada_at: null,
  created_at: new Date(Date.now() - (i + 1) * 86400e3).toISOString(),
  updated_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
}))

sembrar('__FAKE_PARTIDAS__', 'match_log', (i) => ({
  id: `mlog-${i + 1}`,
  user_id: 'user-1',
  mi_mazo: 'd:mazo',
  rival_mazo: 'd:rival',
  mi_mazo_nombre: 'Mazo',
  rival_mazo_nombre: 'Rival',
  resultado: 'win',
  jugada_el: new Date().toISOString().slice(0, 10),
}))

// Las guías de uno y las correcciones que le sugieren (tanda 253).
sembrar('__FAKE_GUIAS__', 'guides', (i) => ({
  id: `guia-${i + 1}`,
  slug: `guia-${i + 1}`,
  title: `Guía ${i + 1}`,
  // En la base la columna tiene valor por defecto: NINGUNA fila real la
  // tiene vacía. Sembrarla aquí es lo que hace que el doble se parezca a
  // la base y no a un caso que no existe.
  kind: 'guide',
  author_id: 'admin-1',
  review_status: 'published',
  published_at: '2026-08-01T10:00:00Z',
  created_at: '2026-08-01T10:00:00Z',
  submitted_at: '2026-08-01T10:00:00Z',
  category_id: null,
  blocks: [],
}))

// El muro de un perfil (tanda 308). Hacía falta para poder probar la
// pestaña que se abre: sin esta tabla el muro estaba SIEMPRE vacío en el
// doble, así que «se queda en el muro cuando tiene algo» no se podía
// comprobar — y ese es justo el caso en que la página NO debe moverte.
sembrar('__FAKE_MURO__', 'profile_comments', (i) => ({
  id: `muro-${i + 1}`,
  profile_id: 'user-1',
  author_id: 'user-2',
  body: `Comentario ${i + 1}`,
  created_at: new Date(Date.now() - (i + 1) * 60000).toISOString(),
}))

sembrar('__FAKE_CATEGORIAS__', 'categories', (i) => ({
  id: `cat-${i + 1}`,
  slug: `categoria-${i + 1}`,
  name: `Categoría ${i + 1}`,
  description: '',
  order_pos: i,
}))

// Las noticias (tanda 269). Van a la MISMA tabla que las guías, que es
// justo lo que hay que poder probar: que los listados de guías no se
// llenan de noticias y que /noticias no se llena de guías.
sembrar('__FAKE_NOTICIAS__', 'guides', (i) => ({
  id: `noticia-${i + 1}`,
  slug: `noticia-${i + 1}`,
  title: `Noticia ${i + 1}`,
  description: `Lo que ha pasado hoy, número ${i + 1}.`,
  kind: 'news',
  author_id: 'admin-1',
  review_status: 'published',
  published_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
  created_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
  category_id: null,
  blocks: [],
}))

// El reto diario ya jugado y el progreso de los cursos (tanda 299). Sin
// estas dos tablas la portada no puede enseñar el reto HECHO ni /aprender
// la franja de «sigue donde lo dejaste»: las consultas volvían vacías y
// las dos pantallas se probaban siempre en su estado de recién llegado.
sembrar('__FAKE_RETOS__', 'daily_challenge_results', (i) => ({
  id: `reto-${i + 1}`,
  user_id: 'user-1',
  day: new Date().toISOString().slice(0, 10),
  correct: 3,
  total: 5,
  score: 30,
}))

sembrar('__FAKE_PROGRESO__', 'user_progress', (i) => ({
  id: `prog-${i + 1}`,
  user_id: 'user-1',
  guide_id: `guia-${i + 1}`,
  status: 'in_progress',
  current_block: 1,
  read_at: null,
  started_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString(),
}))

// La foto de XP con la que empezó el mes: el podio de /usuarios y el
// «top del mes» de la portada salen de restar esto al total de hoy.
sembrar('__FAKE_XP_MES__', 'xp_mes', (i) => ({
  user_id: `u${i}`,
  mes: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-01`,
  xp_inicio: 0,
}))

sembrar('__FAKE_SUGERENCIAS__', 'guide_suggestions', (i) => ({
  id: `sug-${i + 1}`,
  guide_id: 'guia-1',
  author_id: 'user-1',
  quote: 'Un trozo de la guía',
  body: 'Esto ya no es así desde el último set.',
  status: 'pending',
  created_at: '2026-09-01T10:00:00Z',
}))

// Los torneos APUNTADOS A MANO de /mis-partidas (tanda 236), con su
// cierre (tanda 251): cerrado_el null = abierto, que es como nacen.
sembrar('__FAKE_LOG_TORNEOS__', 'match_log_torneos', (i) => ({
  id: `logt-${i + 1}`,
  user_id: 'admin-1',
  nombre: `Torneo apuntado ${i + 1}`,
  donde: 'Torneo local',
  mi_mazo: 'd:mazo',
  mi_mazo_nombre: 'Mazo',
  jugado_el: '2026-08-30',
  cerrado_el: null,
  notas: null,
}))

sembrar('__FAKE_ARQUETIPOS__', 'tcg_archetypes', (i) => ({
  id: `arq-${i}`,
  nombre: `Arquetipo ${i}`,
  iconos: [],
  requiere: [],
  activo: true,
}))

sembrar('__FAKE_REPETICIONES_MESA__', 'tournament_match_replays', (i) => ({
  match_id: 'mesa-1',
  user_id: 'user-1',
  replay_id: `rep${String(i + 1).padStart(7, '0')}`,
  created_at: new Date(Date.now() - (10 - i) * 60e3).toISOString(),
  // Las DE MESA que añade un juez (tanda 555) llevan `publica`.
  publica: false,
}))

sembrar('__FAKE_ENTREGAS__', 'tournament_prize_deliveries', (i) => ({
  tournament_id: 'torneo-1',
  user_id: `user-${i + 1}`,
  delivered_at: new Date(Date.now() - 3600e3).toISOString(),
  delivered_by: 'admin-1',
}))

sembrar('__FAKE_PUZLES__', 'replay_puzzles', (i) => ({
  id: `pz${String(i + 1).padStart(8, '0')}`,
  replay_id: 'rep0000001',
  user_id: 'user-1',
  foto: 10,
  pregunta: '¿Qué jugarías aquí?',
  opciones: ['A', 'B'],
  correcta: 0,
  explicacion: 'Porque sí.',
  created_at: new Date(Date.now() - (i + 1) * 60e3).toISOString(),
}))

sembrar('__FAKE_ENLACES_CORTOS__', 'enlaces_cortos', (i) => ({
  id: `corto${String(i + 1).padStart(3, '0')}`,
  tipo: 'repeticion',
  carga: 'p=AAAA',
  creado_at: new Date().toISOString(),
}))

sembrar('__FAKE_META_CARTAS__', 'meta_cartas_dia', (i) => ({
  dia: new Date(Date.now() - i * 864e5).toISOString().slice(0, 10),
  arquetipo: 'arq-1',
  seccion: 'pokemon',
  clave: `carta-${i + 1}`,
  nombre: `Carta ${i + 1}`,
  set_codigo: 'SET',
  numero: String(i + 1),
  mazos: 1,
  copias: 1,
}))

sembrar('__FAKE_META_ARQUETIPOS__', 'meta_arquetipos', (i) => ({
  id: `arq-${i + 1}`,
  nombre: `Mazo ${i + 1}`,
  iconos: [],
  visto_at: new Date().toISOString(),
}))

sembrar('__FAKE_JUECES__', 'judge_applications', (i) => ({
  id: `juez-${i + 1}`,
  tournament_id: 'torneo-1',
  user_id: 'user-2',
  status: 'pending',
}))

// Las solicitudes de /colabora (tanda 361).
sembrar('__FAKE_COLABORA__', 'collab_applications', (i) => ({
  id: `colab-${i + 1}`,
  user_id: 'user-2',
  roles: ['noticias'],
  horas: 'media',
  experiencia: null,
  por_que: null,
  muestra: 'Unas líneas de ejemplo.',
  status: 'nueva',
  nota_admin: null,
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:00:00Z',
}))

sembrar('__FAKE_LOGROS__', 'achievement_definitions', (i) => ({
  id: `logro-${i + 1}`,
  title: `Logro ${i + 1}`,
  description: '',
  emoji: 'trophy',
  rarity: 'bronze',
  xp_reward: 10,
  is_active: true,
  condition: { type: 'manual' },
}))

sembrar('__FAKE_LLAMADAS__', 'judge_calls', (i) => ({
  id: `llamada-${i + 1}`,
  tournament_id: 'torneo-1',
  match_id: null,
  created_by: 'user-1',
  assigned_judge_id: null,
  status: 'open',
  created_at: new Date().toISOString(),
}))

// Las RPC que la base todavía no conoce (una base sin la migración de
// apertura puesta).
const SIN_RPC = (typeof window !== 'undefined' && window.__SIN_RPC__) || []

// Las tablas cuya política de borrado dice que no (ver `aplicar`).
const SIN_BORRAR = (typeof window !== 'undefined' && window.__RLS_SIN_BORRAR__) || []

// Y las tablas cuya política de ACTUALIZACIÓN dice que no. Es el mismo
// silencio del borrado y pasa igual de a menudo: un UPDATE que la
// política rechaza no da error, simplemente no toca ninguna fila. Hacía
// falta para poder exigir que una pantalla que mueve o etiqueta temas se
// entere de que no ha movido nada (tanda 256).
const SIN_TOCAR = (typeof window !== 'undefined' && window.__RLS_SIN_TOCAR__) || []

// Las llamadas a RPC, para que una prueba pueda comprobarlas.
const RPCS = []

// ── El registro de escrituras ──
// En sessionStorage y no en una variable porque las páginas navegan
// (borrar un torneo te manda a la lista) y con una variable se perdería
// justo lo que se quiere comprobar.
function anotarEscritura(tabla, filas, tipo = 'insert') {
  try {
    const previas = JSON.parse(sessionStorage.getItem('__escrituras__') || '[]')
    previas.push({ tabla, filas, tipo })
    sessionStorage.setItem('__escrituras__', JSON.stringify(previas))
  } catch {}
}

// ── forum_boards_resumen: una VISTA, no una tabla ──
// El índice del foro no lee `forum_boards` sino esta vista, que le
// añade a cada foro sus cuentas y su último mensaje. En la base es SQL
// recursivo (un foro cuenta también lo de sus subforos); aquí se
// recalcula a mano cada vez que se pide, que para el tamaño de una
// prueba sobra y evita tener que mantener las cuentas al día.
function resumenDeForos() {
  const hijosDe = (id) => {
    const directos = T.forum_boards.filter((b) => b.parent_id === id)
    return [id, ...directos.flatMap((h) => hijosDe(h.id))]
  }
  return T.forum_boards.map((b) => {
    const rama = new Set(hijosDe(b.id))
    const temas = T.forum_threads.filter((t) => rama.has(t.board_id))
    const mensajes = T.forum_posts.filter((m) => temas.some((t) => t.id === m.thread_id))
    // El último mensaje de la rama: lo que el índice enseña en «Último».
    const ultimo = [...mensajes].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0]
    const suTema = ultimo ? temas.find((t) => t.id === ultimo.thread_id) : null
    return {
      ...b,
      thread_count: temas.length,
      post_count: mensajes.length,
      last_thread_id: suTema?.id || null,
      last_thread_title: suTema?.title || null,
      last_post_at: ultimo?.created_at || null,
      last_post_author_id: ultimo?.author_id || null,
    }
  })
}

// ── El encadenado ──
// Un objeto «then-able»: se puede esperar en cualquier punto de la
// cadena, igual que el cliente de verdad.
function consulta(tabla, estado = {}) {
  const st = {
    filtros: [],
    ordenes: [],
    limite: null,
    unico: null,
    op: null,
    cuerpo: null,
    // Cuando se ha filtrado por una columna que «todavía no existe».
    columnaQueFalta: null,
    ...estado,
  }

  // ── Los `select` embebidos de PostgREST (tanda 308) ──
  //
  // `.select('*, categories(name, slug)')` trae la fila relacionada
  // DENTRO de cada resultado: `fila.categories.name`. El doble no lo
  // hacía, así que devolvía las filas sin la relación y la página se
  // comportaba como si esa guía no tuviera categoría — sin dar error.
  // Lo notó la prueba de la ficha: la miga de pan salía apuntando a
  // `?slug=` vacío y parecía un fallo de la web.
  //
  // No se adivina la relación por el nombre: `categories` se enlaza por
  // `category_id`, y de «categories» a «category» no se llega con una
  // regla. Van declaradas, que además documenta cuáles usa el sitio.
  //
  // Y hay una que se resuelve por DOS columnas (tanda 437): la clave ajena
  // de `tcg_cards` a `tcg_sets` es (set_id, market) -> (id, market),
  // porque el japones comparte identificadores de set con el ingles y un
  // join por la id a secas traeria el set del otro catalogo. Resolverlo
  // aqui por la id sola dejaba una carta japonesa ensenando el nombre
  // INGLES de su coleccion, y en verde: el doble escondia justo la clase
  // de fallo que la base de verdad impide por construccion.
  const EMBEBIDOS = {
    categories: 'category_id',
    guides: 'guide_id',
    tcg_sets: 'set_id',
    forum_posts: 'post_id',
  }
  // Columnas que, ademas de la clave ajena, tienen que coincidir, con el
  // valor POR DEFECTO que tienen en la base. El defecto no es un detalle:
  // en `tcg_cards` y `tcg_sets` la columna es `not null default 'WEST'`,
  // asi que una fila de un fixture que no diga nada ES occidental. Sin
  // esto, comparar null contra 'WEST' dejaria sin set a todas las cartas
  // sembradas sin mercado, que son casi todas las de las pruebas viejas.
  const EMBEBIDOS_TAMBIEN_POR = { tcg_sets: [['market', 'WEST']] }

  const embebidosDe = (cols) => {
    const fuera = []
    // `alias:tabla!inner(campos)` — el alias y el `!inner` son opcionales.
    for (const m of String(cols || '').matchAll(/(?:(\w+):)?(\w+)(?:!\w+)?\(([^)]*)\)/g)) {
      const [, alias, nombre, campos] = m
      if (!EMBEBIDOS[nombre]) continue
      fuera.push({
        clave: alias || nombre,
        tabla: nombre,
        fk: EMBEBIDOS[nombre],
        campos: campos.split(',').map((c) => c.trim()).filter(Boolean),
      })
    }
    return fuera
  }

  const conEmbebidos = (filas) => {
    const embebidos = embebidosDe(st.columnas)
    if (!embebidos.length) return filas
    return filas.map((fila) => {
      const copia = { ...fila }
      for (const e of embebidos) {
        const tambien = EMBEBIDOS_TAMBIEN_POR[e.tabla] || []
        const relacionada = (T[e.tabla] || []).find(
          (r) => r.id === fila[e.fk] && tambien.every(([c, pordefecto]) => (r[c] ?? pordefecto) === (fila[c] ?? pordefecto)))
        // Sin relación, `null` — que es lo que devuelve PostgREST, y lo
        // que las páginas ya saben manejar con `?.`.
        copia[e.clave] = relacionada
          ? Object.fromEntries(e.campos.map((c) => [c, relacionada[c]]))
          : null
      }
      return copia
    })
  }

  // Las columnas que se pidieron, y SOLO esas (tanda 413), en las tablas
  // que diga `window.__PROYECTAR__`. Por defecto el doble devuelve la fila
  // entera pida lo que pida, y así un código que necesita una columna que
  // NO pide —los ataques de una carta— funciona aquí y en producción no.
  // Es optativo para no cambiarle el suelo a las pruebas de antes.
  const proyectar = (filas) => {
    const tablas = typeof window !== 'undefined' ? window.__PROYECTAR__ : null
    if (!Array.isArray(tablas) || !tablas.includes(tabla) || !st.columnas || st.columnas === '*') return filas
    const planas = String(st.columnas)
      .replace(/(?:\w+:)?\w+(?:!\w+)?\([^)]*\)/g, '')
      .split(',')
      .map((c) => c.trim().split(':').pop())
      .filter(Boolean)
    if (planas.includes('*')) return filas
    const claves = [...planas, ...embebidosDe(st.columnas).map((e) => e.clave)]
    return filas.map((f) => Object.fromEntries(claves.filter((c) => c in f).map((c) => [c, f[c]])))
  }

  const aplicar = () => {
    let filas = tabla === 'forum_boards_resumen' ? resumenDeForos() : (T[tabla] || []).slice()
    // Una política de borrado que dice que NO no da error: le añade a la
    // sentencia un filtro que no casa con nada, y el DELETE se va sin
    // haber tocado ninguna fila. Se simula igual, con un filtro, porque
    // es literalmente lo que hace Postgres — y así una prueba puede
    // comprobar que la página se entera de que no ha borrado nada.
    if (st.op === 'delete' && SIN_BORRAR.includes(tabla)) filas = []
    if (st.op === 'update' && SIN_TOCAR.includes(tabla)) filas = []
    // Las políticas de `replays`: ver, cambiar y borrar, solo lo tuyo. Sin
    // esto, una pantalla que pidiera las repeticiones SIN filtrar por su
    // dueño vería aquí las de todo el mundo, y en la base ninguna ajena.
    if (tabla === 'replays') filas = filas.filter((f) => f.user_id === (sesion?.user?.id ?? '¬'))
    // Los puzles (tanda 521): el tuyo, o el de una repetición compartida —
    // y nunca con la buena ni la explicación, que en la base no tienen
    // permiso de lectura (salen al contestar).
    if (tabla === 'replay_puzzles') {
      filas = filas.filter((f) => f.user_id === (sesion?.user?.id ?? '¬') || T.replays.some((r) => r.id === f.replay_id && r.compartida))
      // Solo al LEER (un borrado tiene que encontrar la fila de verdad).
      if (!st.op) filas = filas.map(({ correcta, explicacion, ...resto }) => resto)
    }
    // La de `tournament_match_replays` (tanda 496): las de una mesa las
    // ven sus dos jugadores, quien lleva el torneo y un juez APROBADO.
    if (tabla === 'tournament_match_replays') {
      const yo = sesion?.user?.id ?? '¬'
      const perfil = T.user_profiles.find((x) => x.id === yo) || {}
      filas = filas.filter((f) => {
        const m = T.tournament_matches.find((x) => x.id === f.match_id)
        if (!m) return false
        // Las de mesa (tanda 555): cualquiera que vea la mesa.
        if (f.publica) return true
        if (m.player_a_id === yo || m.player_b_id === yo) return true
        const t = T.rounds.find((r) => r.id === m.round_id)?.tournament_id
        if (perfil.is_admin || perfil.is_tournament_admin || T.tournaments.find((x) => x.id === t)?.admin_id === yo) return true
        return T.judge_applications.some((j) => j.tournament_id === t && j.user_id === yo && j.status === 'approved')
      })
    }
    for (const f of st.filtros) filas = filas.filter(f)
    if (st.ordenes?.length) {
      filas.sort((a, b) => {
        for (const { col, asc } of st.ordenes) {
          const x = a[col] ?? ''
          const y = b[col] ?? ''
          // Los booleanos se comparan como en SQL: false < true.
          const cmp = x === y ? 0 : x < y ? -1 : 1
          if (cmp) return cmp * (asc ? 1 : -1)
        }
        return 0
      })
    }
    if (st.limite != null) filas = filas.slice(0, st.limite)
    if (st.rango) filas = filas.slice(st.rango[0], st.rango[1] + 1)
    return filas
  }

  // El contador va ANTES del recorte: `count: 'exact'` cuenta lo que hay,
  // no lo que cabe en la página. Si contara después, el paginador del
  // foro diría siempre que solo hay una página.
  const contar = () => {
    let filas = tabla === 'forum_boards_resumen' ? resumenDeForos() : (T[tabla] || []).slice()
    for (const f of st.filtros) filas = filas.filter(f)
    return filas.length
  }

  const resolver = () => {
    // ── Una escritura que la POLÍTICA rechaza (tanda 426) ──
    //
    // En PostgREST no da error: no toca nada y vuelve con el cuerpo
    // VACÍO. Es de los fallos que más veces ha mordido en este repo
    // (CLAUDE.md lo cuenta tres veces), y el doble no sabía fingirlo: con
    // él, un código que no mira lo que vuelve pasaba por bueno aquí y
    // mentía en producción. Las tablas que lo hagan van en
    // `window.__SIN_PERMISO__`.
    const sinPermiso = (typeof window !== 'undefined' && window.__SIN_PERMISO__) || []
    if (['insert', 'upsert', 'update', 'delete'].includes(st.op) && sinPermiso.includes(tabla)) {
      return { data: st.unico ? null : [], error: null }
    }
    // La buena y la explicación de un puzle no tienen permiso de lectura:
    // el permiso es por COLUMNAS (tanda 521), y en Postgres pedirlas —o
    // pedir `*`, que las incluye— hace fallar la consulta ENTERA con 42501.
    // Quitarlas en silencio, que es lo que hacía el doble, daba por buena
    // una consulta que en la base no devuelve nada.
    if (!st.op && tabla === 'replay_puzzles') {
      const pide = String(st.columnas || '*').split(',').map((c) => c.trim().split(':').pop())
      if (pide.some((c) => c === '*' || c === 'correcta' || c === 'explicacion')) {
        return { data: null, error: { code: '42501', message: 'permission denied for table replay_puzzles' } }
      }
    }
    // Escrituras
    if (st.op === 'insert' || st.op === 'upsert') {
      const filas = (Array.isArray(st.cuerpo) ? st.cuerpo : [st.cuerpo]).map((f, i) => ({
        id: f.id || `${tabla}-nuevo-${(T[tabla] || []).length + i + 1}`,
        ...f,
      }))
      // El índice único de supabase-migration-repeticiones.sql (tanda
      // 494): la misma repetición no se apunta dos veces en Mis partidas.
      if (tabla === 'match_log' && filas.some((f) => f.replay_id && T.match_log.some((x) => x.user_id === f.user_id && x.replay_id === f.replay_id))) {
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "match_log_repeticion"' } }
      }
      // Nadie escribe en las tablas del torneo a mano (tanda 252).
      if (tabla === 'tournament_match_replays') {
        return { data: null, error: { code: '42501', message: 'permission denied for table tournament_match_replays' } }
      }
      T[tabla] = (T[tabla] || []).concat(filas)
      anotarEscritura(tabla, filas, st.op)
      return { data: st.unico ? filas[0] : filas, error: null }
    }
    if (st.op === 'update') {
      const afectadas = aplicar()
      afectadas.forEach((f) => Object.assign(f, st.cuerpo))
      anotarEscritura(tabla, afectadas.map((f) => ({ ...f })), 'update')
      return { data: st.unico ? afectadas[0] || null : afectadas, error: null }
    }
    if (st.op === 'delete') {
      const afectadas = aplicar()
      // Se anota ANTES de quitarlas: si no, una prueba no puede saber
      // QUÉ se borró, solo que algo desapareció.
      anotarEscritura(tabla, afectadas.map((f) => ({ ...f })), 'delete')
      T[tabla] = (T[tabla] || []).filter((f) => !afectadas.includes(f))
      // Como PostgREST: un DELETE devuelve cuerpo SOLO si se pidió
      // (supabase-js manda `Prefer: return=representation` al encadenar
      // .select()). Sin eso, `data` es null aunque se haya borrado —
      // y esa diferencia importa: es como se distingue «borrado» de
      // «la política no dejó borrar nada», que no da error.
      const copia = afectadas.map((f) => ({ ...f }))
      return { data: st.devuelve ? copia : null, error: null }
    }
    // Lecturas
    if (st.soloCuenta) return { data: null, count: contar(), error: null }
    const filas = proyectar(conEmbebidos(aplicar()))
    if (st.unico === 'maybe') return { data: filas[0] || null, error: null }
    if (st.unico === 'one') {
      return filas.length === 1
        ? { data: filas[0], error: null }
        : { data: null, error: { message: 'no rows', code: 'PGRST116' } }
    }
    return { data: filas, count: st.pideCuenta ? contar() : null, error: null }
  }

  const api = {
    select: (cols, opciones = {}) => {
      // Se apunta tal cual llegó, sin proyectar nada (ver CONSULTAS).
      ;(CONSULTAS.columnas[tabla] = CONSULTAS.columnas[tabla] || []).push(
        cols === undefined ? '*' : String(cols)
      )
      // Pedir por su nombre una columna que falta (`__SIN_COLUMNAS__`)
      // falla entera, como en la base (tanda 520: así se sabe si una
      // migración está puesta sin tocar nada).
      const faltan = (typeof window !== 'undefined' && window.__SIN_COLUMNAS__?.[tabla]) || []
      const falta = String(cols ?? '*').split(',').map((c) => c.trim().split(':').pop()).find((c) => faltan.includes(c))
      if (falta) return cadenaRota(tabla, falta)
      return consulta(tabla, {
        ...st,
        columnas: cols === undefined ? '*' : String(cols),
        devuelve: true,
        pideCuenta: opciones.count === 'exact' || st.pideCuenta,
        soloCuenta: opciones.head === true || st.soloCuenta,
      })
    },
    range: (desde, hasta) => consulta(tabla, { ...st, rango: [desde, hasta] }),
    // `like` de PostgREST: igual que `ilike` pero distinguiendo
    // mayúsculas. FALTABA, y no era un detalle: `searchCards` lo usa, y
    // como no existía el método, la llamada reventaba, el `try/catch` de
    // `resolverCarta` se tragaba el error y el camino de respaldo POR
    // NOMBRE no lo había ejercitado ninguna prueba jamás.
    //
    // Ese es justo el camino que marcó en rojo el Mew ex de PINGU. Una
    // prueba que no puede llegar a un camino no dice nada de él, y aquí
    // ni siquiera se veía: el error se perdía en un catch.
    like: (col, patron) => {
      const faltan = (typeof window !== 'undefined' && window.__SIN_COLUMNAS__) || {}
      if ((faltan[tabla] || []).includes(col)) return cadenaRota(tabla, col)
      const re = new RegExp('^' + String(patron).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$')
      return consulta(tabla, {
        ...st,
        filtros: [...st.filtros, (f) => re.test(String(f[col] ?? valorGenerado(f, col)))],
      })
    },
    // `ilike` de PostgREST: el comodín es % y no distingue mayúsculas.
    ilike: (col, patron) => {
      // Fingir que una COLUMNA no existe, que no es lo mismo que fingir
      // que falta la tabla entera: una migración a medias deja la tabla
      // en su sitio y le falta una columna generada. Es el caso del
      // buscador del foro, que se apoya en `search_norm`.
      const faltan = (typeof window !== 'undefined' && window.__SIN_COLUMNAS__) || {}
      if ((faltan[tabla] || []).includes(col)) return cadenaRota(tabla, col)
      const re = new RegExp('^' + String(patron).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i')
      return consulta(tabla, {
        ...st,
        filtros: [...st.filtros, (f) => re.test(String(f[col] ?? valorGenerado(f, col)))],
      })
    },
    gt: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => f[col] > val] }),
    lt: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => f[col] < val] }),
    eq: (col, val) => {
      // Se apunta POR QUÉ columna se filtró (ver CONSULTAS.igualdades).
      // No cambia lo que devuelve el doble: sirve para poder exigir que
      // una consulta venga ACOTADA — «tráete solo las llamadas de este
      // jugador», que en la web de verdad es la diferencia entre pedir
      // una fila o pedir la cola entera del torneo.
      ;(CONSULTAS.igualdades[tabla] = CONSULTAS.igualdades[tabla] || []).push(`${col}=${val}`)
      // «Esa columna todavía no existe»: es lo que devuelve PostgREST
      // entre que se despliega el código y una persona ejecuta el SQL, y
      // es el hueco en el que el sitio se puede quedar a oscuras. Se
      // simula para poder probar los puentes de vuelta atrás.
      if (typeof window !== 'undefined' && (window.__COLUMNAS_QUE_FALTAN__ || []).includes(col)) {
        // Va en el ESTADO y no como respuesta inmediata: detrás del .eq()
        // vienen .order() y .limit(), y cada uno devuelve una consulta
        // nueva. Un error devuelto aquí se perdería en el primer eslabón.
        return consulta(tabla, { ...st, columnaQueFalta: col })
      }
      return consulta(tabla, { ...st, filtros: [...st.filtros, (f) => String(f[col]) === String(val)] })
    },
    or: (expresion) => {
      // Por comas DE PRIMER NIVEL: un «in.(H,I,J)» lleva comas dentro
      // del paréntesis y esas no separan condiciones (tanda 358).
      const trozos = []
      {
        let nivel = 0
        let actual = ''
        for (const ch of String(expresion)) {
          if (ch === '(') nivel++
          if (ch === ')') nivel--
          if (ch === ',' && nivel === 0) {
            trozos.push(actual)
            actual = ''
          } else actual += ch
        }
        if (actual) trozos.push(actual)
      }
      const pruebas = trozos.map((t) => {
        const [col, op, ...resto] = t.split('.')
        const valor = resto.join('.')
        if (op === 'eq') return (f) => String(f[col]) === valor
        if (op === 'is') return (f) => (valor === 'null' ? f[col] == null : String(f[col]) === valor)
        // Las comparaciones de fecha del hilo de actividad
        // («completed_at.gte.…,read_at.gte.…»). Una columna vacía NO
        // cumple: en PostgREST un null no entra en un >=, y sin esto el
        // doble daría por buena media tabla.
        if (op === 'gte') return (f) => f[col] != null && f[col] >= valor
        if (op === 'lte') return (f) => f[col] != null && f[col] <= valor
        if (op === 'gt') return (f) => f[col] != null && f[col] > valor
        if (op === 'lt') return (f) => f[col] != null && f[col] < valor
        // Las dos formas que usa el buscador del constructor (tanda 358):
        // «regulation_mark.in.(H,I,J)» y «set_id.like.bw*».
        if (op === 'in') {
          const lista = valor.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim())
          return (f) => lista.includes(String(f[col]))
        }
        if (op === 'like' || op === 'ilike') {
          const r = new RegExp('^' + valor.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', op === 'ilike' ? 'i' : '')
          return (f) => f[col] != null && r.test(String(f[col]))
        }
        // `cs` es el `@>` de Postgres sobre una columna ARRAY, y lo usa el
        // buscador desde la tanda 450: un número suelto puede ser el
        // número impreso de la carta O su número nacional de Pokédex, que
        // vive en `dex_ids`. Sin esto el doble revienta con «.or() no
        // entiende», que al menos CANTA — pero no estaba.
        if (op === 'cs') {
          const lista = valor.replace(/^\{|\}$/g, '').split(',').map((x) => x.trim()).filter(Boolean)
          return (f) => {
            const suyos = Array.isArray(f[col]) ? f[col].map(String) : []
            return lista.every((v) => suyos.includes(String(v)))
          }
        }
        throw new Error(`stub: .or() no entiende «${t}». Añádelo si el cliente lo usa.`)
      })
      return consulta(tabla, { ...st, filtros: [...st.filtros, (f) => pruebas.some((p) => p(f))] })
    },
    // `contains` de PostgREST sobre una columna ARRAY (`types`): la
    // carta lleva ESE tipo dentro. Una de dos tipos sale en los dos, y
    // una sin engordar —`types` a null— no sale en ninguno, que es lo
    // que hace la base.
    contains: (col, vals) =>
      consulta(tabla, {
        ...st,
        filtros: [...st.filtros, (f) => {
          const suyos = Array.isArray(f[col]) ? f[col] : []
          return (Array.isArray(vals) ? vals : [vals]).every((v) => suyos.includes(v))
        }],
      }),
    // Y `overlaps`, que es el primo: basta con que compartan UNO.
    overlaps: (col, vals) =>
      consulta(tabla, {
        ...st,
        filtros: [...st.filtros, (f) => {
          const suyos = Array.isArray(f[col]) ? f[col] : []
          return (Array.isArray(vals) ? vals : [vals]).some((v) => suyos.includes(v))
        }],
      }),
    neq: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => String(f[col]) !== String(val)] }),
    in: (col, vals) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => vals.map(String).includes(String(f[col]))] }),
    is: (col, val) =>
      consulta(tabla, {
        ...st,
        filtros: [...st.filtros, (f) => (val === null ? f[col] === null || f[col] === undefined : f[col] === val)],
      }),
    not: (col, op, val) =>
      consulta(tabla, {
        ...st,
        filtros: [...st.filtros, (f) => {
          // `.not(col, 'in', '(a,b)')`, como lo escribe PostgREST (lo usa
          // el filtro de energías especiales del constructor, tanda 358).
          if (op === 'in') {
            const lista = String(val).replace(/^\(|\)$/g, '').split(',').map((s) => s.trim())
            return !lista.includes(String(f[col]))
          }
          // `.not(col, 'imatch', regex)` es `!~*` de Postgres (tanda 573):
          // lo usa el buscador para echar a TCG Pocket. Sin esto, el doble
          // comparaba la fila contra el regex como texto y dejaba pasar
          // TODO — un verde que en producción no puede pasar (la 521).
          if (op === 'imatch' || op === 'match') {
            return !new RegExp(String(val), op === 'imatch' ? 'i' : '').test(String(f[col] ?? ''))
          }
          return val === null ? f[col] !== null && f[col] !== undefined : f[col] !== val
        }],
      }),
    gte: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => f[col] >= val] }),
    lte: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => f[col] <= val] }),
    order: (col, opts = {}) => consulta(tabla, { ...st, ordenes: [...(st.ordenes || []), { col, asc: opts.ascending !== false }] }),
    limit: (n) => consulta(tabla, { ...st, limite: n }),
    maybeSingle: () => consulta(tabla, { ...st, unico: 'maybe' }),
    single: () => consulta(tabla, { ...st, unico: 'one' }),
    insert: (cuerpo) => consulta(tabla, { ...st, op: 'insert', cuerpo }),
    upsert: (cuerpo) => consulta(tabla, { ...st, op: 'upsert', cuerpo }),
    update: (cuerpo) => consulta(tabla, { ...st, op: 'update', cuerpo }),
    delete: () => consulta(tabla, { ...st, op: 'delete' }),
    // `window.__FAKE_RETRASO__ = { tcg_cards: 400 }` hace que esa tabla
    // tarde. El doble responde al instante, y hay fallos que SOLO
    // existen cuando una respuesta llega tarde: una búsqueda vieja
    // pisando a una nueva, por ejemplo. Sin poder ir lento, esos
    // arreglos no se pueden probar.
    then: (ok, mal) => {
      const ms = (typeof window !== 'undefined' && window.__FAKE_RETRASO__?.[tabla]) || 0
      const valor = st.columnaQueFalta
        ? { data: null, error: { code: '42703', message: `column ${tabla}.${st.columnaQueFalta} does not exist` } }
        : resolver()
      const p = ms ? new Promise((r) => setTimeout(() => r(valor), ms)) : Promise.resolve(valor)
      return p.then(ok, mal)
    },
  }
  return api
}

// Cuántas consultas se piden, para poder MEDIR lo que le cuesta una
// pantalla a la base en vez de estimarlo a ojo.
// `columnas` REGISTRA lo que pidió cada consulta, tabla por tabla. Ojo
// con lo que esto es: el doble sigue devolviendo la fila entera, NO
// proyecta. Registrar no es fingir — sirve para poder exigir que el
// cliente pida las columnas que debe (por ejemplo, que un visitante sin
// cuenta NO pida `*` de las inscripciones, porque en la base real el
// rol anon no tiene permiso sobre todas y la consulta fallaría entera).
export const CONSULTAS = { n: 0, porTabla: {}, columnas: {}, igualdades: {} }

export const supabase = {
  from: (tabla) => {
    // Fingir que una tabla NO existe (window.__SIN_TABLAS__): es el
    // estado real de producción entre que se despliega el código y un
    // humano ejecuta la migración, y el sitio tiene que aguantarlo.
    const sinTabla = typeof window !== 'undefined' && (window.__SIN_TABLAS__ || []).includes(tabla)
    if (sinTabla) {
      const fallo = async () => ({
        data: null,
        error: { message: `relation "public.${tabla}" does not exist`, code: '42P01' },
      })
      // `then` es lo que hace que el `await` del final de CUALQUIER cadena
      // (select().eq().order().limit()…) resuelva al error. Hasta la tanda
      // 480 devolvía undefined, y una cadena larga resolvía al propio
      // Proxy: `{ data, error }` salían dos funciones y la página decía
      // «no se ha podido hablar con la base» en vez de «falta la tabla».
      const api = new Proxy(
        {},
        {
          get: (_, prop) =>
            prop === 'then' ? (bien, mal) => fallo().then(bien, mal) : prop === 'maybeSingle' || prop === 'single' ? fallo : () => api,
        }
      )
      // El await final: cualquier cadena termina resolviendo al error.
      return Object.assign(fallo(), api, { select: () => api, insert: fallo, upsert: fallo, delete: () => api })
    }
    CONSULTAS.n++
    CONSULTAS.porTabla[tabla] = (CONSULTAS.porTabla[tabla] || 0) + 1
    if (!T[tabla]) T[tabla] = []
    return consulta(tabla)
  },
  // Las RPC se apuntan en vez de ejecutarse: a una prueba le interesa
  // QUE se llamaron y con qué, no lo que harían dentro de Postgres.
  // `forum_ver_tema` suma la visita ahí mismo, que es barato y hace que
  // el contador de la ficha se comporte como en la web de verdad.
  rpc: async (nombre, args = {}) => {
    RPCS.push({ nombre, args })
    // Hacer fallar una función a propósito (tanda 512): lo que pasa cuando
    // la base dice que no es justo lo que una prueba de «éxito» nunca ve.
    const fallos = (typeof window !== 'undefined' && window.__RPC_ERRORES__) || {}
    if (nombre in fallos) return { data: null, error: fallos[nombre] }
    // Hacer TARDAR una función (tanda 596): lo que llega tarde a una
    // ventana que ya no es la suya solo se ve si algo llega tarde.
    const retraso = (typeof window !== 'undefined' && window.__RPC_RETRASO__?.[nombre]) || 0
    if (retraso) await new Promise((ok) => setTimeout(ok, retraso))
    // Los resultados de una encuesta se CALCULAN de las tablas, como en
    // Postgres. Devolverlos a mano desde cada prueba haría que «no se
    // enseñan los resultados antes de votar» comprobara la semilla y no
    // la pantalla.
    if (nombre === 'forum_poll_resultados') {
      const opciones = T.forum_poll_options.filter((o) => o.thread_id === args.p_thread)
      return {
        data: opciones
          .slice()
          .sort((a, b) => (a.order_pos || 0) - (b.order_pos || 0))
          .map((o) => ({
            option_id: o.id,
            label: o.label,
            votos: T.forum_poll_votes.filter((v) => v.option_id === o.id).length,
          })),
        error: null,
      }
    }
    // ── El tablon de cambios (tanda 376) ──
    //
    // Se CALCULAN de las tablas, como los resultados de una encuesta:
    // devolverlos a mano desde cada prueba haria que «las dobles
    // coincidencias van primero» comprobara la semilla y no la pantalla.
    //
    // Es la misma cuenta que hace el SQL, y a proposito: si una de las
    // dos se equivoca, la prueba del navegador y la del PostgreSQL de
    // verdad dicen cosas distintas y eso se ve.
    if (nombre === 'intercambios_quien_tiene' || nombre === 'intercambios_quien_busca' || nombre === 'intercambios_de_carta') {
      const yo = sesion?.user?.id || null
      const perfil = (id) => T.user_profiles.find((p) => p.id === id) || {}
      const casa = (ida, vuelta) => !ida || ida === vuelta
      const doy = T.user_collection.filter((c) => c.user_id === yo && Number(c.cambio) > 0)
      const busco = T.user_wants.filter((w) => w.user_id === yo)
      const fila = (c, w, quien) => {
        const p = perfil(quien)
        return {
          user_id: quien,
          username: p.username || null,
          display_name: p.display_name || null,
          avatar_url: p.avatar_url || null,
          card_id: c.card_id,
          idioma: c.idioma,
          estado: c.estado,
          variante: c.variante,
          gradeo: c.gradeo || null,
          cambio: Number(c.cambio) || 0,
          prioridad: w ? w.prioridad : null,
        }
      }
      if (nombre === 'intercambios_de_carta') {
        const filas = T.user_collection
          .filter((c) => c.card_id === args.p_card_id && Number(c.cambio) > 0 && c.user_id !== yo && !perfil(c.user_id).is_banned)
          .map((c) => fila(c, null, c.user_id))
          .sort((a, b) => b.cambio - a.cambio || String(a.username).localeCompare(String(b.username)))
        return { data: filas.slice(0, args.p_limite || 20), error: null }
      }
      let filas = []
      if (nombre === 'intercambios_quien_tiene') {
        for (const w of busco) {
          for (const c of T.user_collection) {
            if (c.user_id === yo || Number(c.cambio) <= 0) continue
            if (c.card_id !== w.card_id || !casa(w.idioma, c.idioma)) continue
            if (perfil(c.user_id).is_banned) continue
            const f = fila(c, w, c.user_id)
            // Reciproco: esa persona busca algo que yo doy.
            f.reciproco = T.user_wants.some(
              (w2) => w2.user_id === c.user_id && doy.some((m) => m.card_id === w2.card_id && casa(w2.idioma, m.idioma))
            )
            filas.push(f)
          }
        }
      } else {
        for (const c of doy) {
          for (const w of T.user_wants) {
            if (w.user_id === yo) continue
            if (w.card_id !== c.card_id || !casa(w.idioma, c.idioma)) continue
            if (perfil(w.user_id).is_banned) continue
            const f = fila(c, w, w.user_id)
            // Reciproco: esa persona da algo que yo busco.
            f.reciproco = T.user_collection.some(
              (c2) => c2.user_id === w.user_id && Number(c2.cambio) > 0 && busco.some((b) => b.card_id === c2.card_id && casa(b.idioma, c2.idioma))
            )
            filas.push(f)
          }
        }
      }
      filas.sort(
        (a, b) => Number(b.reciproco) - Number(a.reciproco) || (b.prioridad || 0) - (a.prioridad || 0) ||
          b.cambio - a.cambio || String(a.username).localeCompare(String(b.username))
      )
      return { data: filas.slice(0, args.p_limite || 200), error: null }
    }
    // La Pokédex (tanda 381). Se CALCULA del catálogo, como los
    // resultados de una encuesta: devolverlo a mano haría que «tienes 3
    // de 12» comprobara la semilla y no la pantalla.
    if (nombre === 'pokedex_resumen') {
      // `p_market` desde la tanda 437: la funcion nacio sin parametro y
      // con 'WEST' escrito dentro, y el cliente la sigue llamando asi para
      // el catalogo de siempre. Sin el `||` aqui, el doble contestaria
      // vacio a la llamada vieja y la Pokedex saldria a cero.
      const quiero = args?.p_market || 'WEST'
      const porDex = new Map()
      for (const c of T.tcg_cards) {
        if ((c.market || 'WEST') !== quiero) continue
        for (const d of c.dex_ids || []) porDex.set(d, (porDex.get(d) || 0) + 1)
      }
      return {
        data: [...porDex.entries()].sort((a, b) => a[0] - b[0]).map(([dex, cartas]) => ({ dex, cartas })),
        error: null,
      }
    }
    // El resumen de las carpetas (tanda 402, en el doble desde la 477).
    //
    // Es RECURSIVO en la base: una carpeta cuenta lo suyo Y lo de sus
    // subcarpetas. Aqui se hace igual —y no sumando solo lo propio—
    // porque si no, una carpeta que solo contiene carpetas dira «0
    // cartas» en la prueba y en produccion no, que es exactamente la
    // clase de simplificacion que esconde fallos (la leccion de la 437).
    if (nombre === 'carpetas_resumen') {
      const hijasDe = new Map()
      for (const c of T.collection_folders) {
        if (!hijasDe.has(c.parent_id)) hijasDe.set(c.parent_id, [])
        hijasDe.get(c.parent_id).push(c.id)
      }
      const conSusHijas = (id, vistas = new Set()) => {
        if (vistas.has(id)) return []
        vistas.add(id)
        return [id, ...(hijasDe.get(id) || []).flatMap((h) => conSusHijas(h, vistas))]
      }
      const filas = T.collection_folders.map((c) => {
        const rama = new Set(conSusHijas(c.id))
        const lineas = new Set(
          T.collection_folder_cards.filter((x) => rama.has(x.folder_id)).map((x) => x.line_id)
        )
        let copias = 0
        for (const id of lineas) copias += Number(T.user_collection.find((l) => l.id === id)?.cantidad || 0)
        return { folder_id: c.id, cartas: lineas.size, copias }
      })
      return { data: filas, error: null }
    }
    if (nombre === 'forum_ver_tema') {
      const tema = T.forum_threads.find((t) => t.id === args.p_thread)
      if (tema) tema.view_count = (tema.view_count || 0) + 1
    }
    // Una base que todavía NO tiene la migración de apertura contesta
    // que no conoce la función. Es el caso que hace falta para probar el
    // puente del cliente (faltaLaRpc en js/torneos/comun.js): hasta que
    // se ejecute el SQL, apuntarse y reportar tienen que seguir yendo
    // por el camino de siempre.
    if ((SIN_RPC || []).includes(nombre)) {
      return {
        data: null,
        error: { code: 'PGRST202', message: `Could not find the function public.${nombre} in the schema cache` },
      }
    }
    // Un error de la RPC que NO es «no existe»: «Torneo lleno.», «Ya
    // estás inscrito.». El cliente NO puede caerse al camino viejo con
    // estos, porque se saltaría justo lo que la RPC comprueba.
    const errores = (typeof window !== 'undefined' && window.__RPC_ERROR__) || {}
    if (nombre in errores) {
      // Una cadena es un error normal de la función; un objeto permite
      // elegir el código, que hace falta para probar por separado las
      // dos formas de reconocer «esa función no existe».
      const e = errores[nombre]
      return { data: null, error: typeof e === 'string' ? { code: 'P0001', message: e } : e }
    }

    // ── Lo que hace un JUEZ (tanda 394) ──
    //
    // Se HACE sobre las tablas, como en Postgres: si solo se apuntara,
    // «dar de baja» dejaría al jugador en la lista de «Sin check-in» y la
    // prueba estaría mirando la semilla, no la pantalla. Y con la misma
    // puerta que la función de verdad (supabase-migration-torneos-
    // jueces.sql): quien lleva el torneo o un juez APROBADO de ese torneo.
    // La que vale es la del SQL, probada contra PostgreSQL en
    // sql-jueces.sql; esta es para que el navegador se comporte igual.
    if (nombre === 'torneos_dar_de_baja' || nombre === 'torneos_resolver_como_juez') {
      const yo = sesion?.user?.id || null
      const perfil = T.user_profiles.find((p) => p.id === yo) || {}
      const manda = (t) =>
        Boolean(perfil.is_admin || perfil.is_tournament_admin || T.tournaments.find((x) => x.id === t)?.admin_id === yo)
      const juez = (t) =>
        T.judge_applications.some((j) => j.tournament_id === t && j.user_id === yo && j.status === 'approved')
      const no = (message) => ({ data: null, error: { code: 'P0001', message } })
      if (nombre === 'torneos_dar_de_baja') {
        const insc = T.tournament_registrations.find((i) => i.id === args.p_inscripcion)
        if (!insc) return no('Inscripción no encontrada.')
        if (!manda(insc.tournament_id) && !juez(insc.tournament_id)) {
          return no('Solo el organizador o un juez del torneo pueden dar de baja a un jugador.')
        }
        if (insc.status !== 'active') return { data: false, error: null }
        const t = T.tournaments.find((x) => x.id === insc.tournament_id)
        Object.assign(insc, { status: 'dropped', dropped_at: new Date().toISOString(), dropped_after_round_id: t?.current_round_id || null })
        return { data: true, error: null }
      }
      const m = T.tournament_matches.find((x) => x.id === args.p_partida)
      if (!m) return no('Mesa no encontrada.')
      const ronda = T.rounds.find((r) => r.id === m.round_id) || {}
      if (!manda(ronda.tournament_id) && !juez(ronda.tournament_id)) {
        return no('Solo el organizador o un juez del torneo pueden resolver una mesa.')
      }
      if (ronda.status !== 'active') return no('Esa ronda no está en juego.')
      if (['finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both'].includes(m.status)) {
        return no('Esa mesa ya está cerrada: corregirla es cosa del organizador.')
      }
      const r = args.p_resultado
      const ganador = ['a_wins', 'forfeit_b'].includes(r) ? m.player_a_id : ['b_wins', 'forfeit_a'].includes(r) ? m.player_b_id : null
      Object.assign(m, { status: r.startsWith('forfeit') ? r : 'finished', finished_at: new Date().toISOString() })
      const ya = T.match_results.find((x) => x.match_id === m.id)
      const fila = { match_id: m.id, result: r, winner_id: ganador, resolved_by: yo }
      if (ya) Object.assign(ya, fila)
      else T.match_results.push({ id: `res-juez-${m.id}`, created_at: new Date().toISOString(), ...fila })
      return { data: true, error: null }
    }

    // ── Las repeticiones (tanda 480) ──
    //
    // Sobre la tabla, como en Postgres: guardar la MISMA partida dos veces
    // no la duplica (por persona), y abrir una ajena solo vale si está
    // compartida. La de verdad, con sus topes, se prueba contra PostgreSQL
    // en sql-repeticiones.sql; esta es para que el navegador se comporte
    // igual.
    if (nombre === 'repeticiones_guardar') {
      const yo = sesion?.user?.id
      if (!yo) return { data: null, error: { code: '42501', message: 'permission denied for function repeticiones_guardar' } }
      const texto = String(args.p_registro || '')
      if (texto.length < 100) return { data: null, error: { code: '22023', message: 'Eso no parece el registro de una partida.' } }
      const ya = T.replays.find((r) => r.user_id === yo && r.registro === texto)
      const mazo = (k) => String(args.p_mazos?.[k] || '').trim().slice(0, 120) || null
      if (ya) {
        if (args.p_titulo) ya.titulo = String(args.p_titulo).slice(0, 120)
        if (args.p_compartida != null) ya.compartida = Boolean(args.p_compartida)
        ya.mazo_a = mazo(0) ?? ya.mazo_a ?? null
        ya.mazo_b = mazo(1) ?? ya.mazo_b ?? null
        return { data: [{ id: ya.id, compartida: ya.compartida, nueva: false }], error: null }
      }
      const fila = {
        id: Math.random().toString(16).slice(2, 12).padEnd(10, '0'),
        user_id: yo,
        titulo: String(args.p_titulo || 'Repetición').slice(0, 120),
        registro: texto,
        jugador_a: args.p_jugadores?.[0] || null,
        jugador_b: args.p_jugadores?.[1] || null,
        ganador: args.p_ganador || null,
        turnos: args.p_turnos ?? null,
        compartida: Boolean(args.p_compartida),
        mazo_a: mazo(0),
        mazo_b: mazo(1),
        notas: [],
        publica: false,
        arquetipos: null,
        publicada_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      T.replays.push(fila)
      return { data: [{ id: fila.id, compartida: fila.compartida, nueva: true }], error: null }
    }
    if (nombre === 'repeticiones_leer' || nombre === 'repeticiones_resumen') {
      const yo = sesion?.user?.id
      const r = T.replays.find((x) => x.id === args.p_id && (x.compartida || (nombre === 'repeticiones_leer' && yo && x.user_id === yo)))
      if (!r) return { data: [], error: null }
      if (nombre === 'repeticiones_resumen') return { data: [{ titulo: r.titulo, jugador_a: r.jugador_a, jugador_b: r.jugador_b, turnos: r.turnos }], error: null }
      return { data: [{ registro: r.registro, titulo: r.titulo, jugador_a: r.jugador_a, jugador_b: r.jugador_b, turnos: r.turnos, created_at: r.created_at, mia: r.user_id === yo, compartida: r.compartida, notas: r.notas || [], mazo_a: r.mazo_a ?? null, mazo_b: r.mazo_b ?? null }], error: null }
    }
    // Los puzles (tanda 521), con las puertas de las funciones de verdad.
    if (nombre === 'puzles_crear') {
      const yo = sesion?.user?.id
      const no = (message, code = 'P0001') => ({ data: null, error: { code, message } })
      if (!yo) return no('Hace falta iniciar sesión.', '28000')
      const r = T.replays.find((x) => x.id === args.p_repeticion && x.user_id === yo)
      if (!r) return no('Solo se hacen puzles de repeticiones tuyas: guárdala primero.', '42501')
      const opciones = (args.p_opciones || []).map((o) => String(o ?? '').trim()).filter(Boolean)
      if (opciones.length < 2 || opciones.length > 4) return no('Hacen falta de 2 a 4 opciones.', '22023')
      if (!(args.p_correcta >= 0 && args.p_correcta < opciones.length)) return no('new row violates check constraint "replay_puzzles_correcta"', '23514')
      const fila = { id: Math.random().toString(16).slice(2, 12).padEnd(10, '0'), replay_id: r.id, user_id: yo, foto: args.p_foto, pregunta: String(args.p_pregunta).trim(), opciones, correcta: args.p_correcta, explicacion: String(args.p_explicacion).trim(), created_at: new Date().toISOString() }
      T.replay_puzzles.push(fila)
      r.compartida = true
      return { data: fila.id, error: null }
    }
    if (nombre === 'puzles_responder') {
      const yo = sesion?.user?.id
      const pz = T.replay_puzzles.find((x) => x.id === args.p_puzle && (x.user_id === yo || T.replays.some((r) => r.id === x.replay_id && r.compartida)))
      if (!pz) return { data: null, error: { code: 'P0002', message: 'Ese puzle no existe o ya no se comparte.' } }
      if (!(args.p_opcion >= 0 && args.p_opcion < pz.opciones.length)) return { data: null, error: { code: '22023', message: 'Esa opción no es de este puzle.' } }
      if (yo && !T.replay_puzzle_answers.some((a) => a.puzzle_id === pz.id && a.user_id === yo)) T.replay_puzzle_answers.push({ puzzle_id: pz.id, user_id: yo, opcion: args.p_opcion })
      const recuento = pz.opciones.map((_, k) => T.replay_puzzle_answers.filter((a) => a.puzzle_id === pz.id && a.opcion === k).length)
      const tuya = yo ? (T.replay_puzzle_answers.find((a) => a.puzzle_id === pz.id && a.user_id === yo)?.opcion ?? null) : null
      return { data: [{ correcta: pz.correcta, explicacion: pz.explicacion, recuento, tuya }], error: null }
    }
    if (nombre === 'puzles_lista') {
      const autor = (id) => {
        const p = T.user_profiles.find((x) => x.id === id)
        return p ? p.display_name || p.username : null
      }
      const filas = T.replay_puzzles
        .filter((pz) => T.replays.some((r) => r.id === pz.replay_id && r.compartida))
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, Math.min(Math.max(args.p_limite || 20, 1), 50))
        .map((pz) => {
          const resp = T.replay_puzzle_answers.filter((a) => a.puzzle_id === pz.id)
          return { id: pz.id, pregunta: pz.pregunta, created_at: pz.created_at, autor: autor(pz.user_id), respuestas: resp.length, aciertos: resp.filter((a) => a.opcion === pz.correcta).length }
        })
      return { data: filas, error: null }
    }
    // Publicar como partida de ejemplo y la lista de un mazo (tanda 520),
    // con las puertas de las funciones de verdad.
    if (nombre === 'repeticiones_publicar') {
      const yo = sesion?.user?.id
      const no = (message, code = 'P0001') => ({ data: null, error: { code, message } })
      if (!yo) return no('Hace falta iniciar sesión.', '28000')
      const r = T.replays.find((x) => x.id === args.p_id)
      if (!r) return no('Esa repetición no existe.', 'P0002')
      const admin = T.user_profiles.find((p) => p.id === yo)?.is_admin
      if (!args.p_publica) {
        if (r.user_id !== yo && !admin) return no('Solo quien la publicó puede quitarla de la lista.', '42501')
        Object.assign(r, { publica: false, publicada_at: null })
        return { data: false, error: null }
      }
      if (r.user_id !== yo) return no('Solo quien la guardó puede publicarla.', '42501')
      const ids = [...new Set((args.p_arquetipos || []).filter((x) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(x || '')))].slice(0, 2)
      if (!ids.length) return no('Ninguno de los dos mazos es de los del meta: no saldría en ninguna ficha.')
      if (T.replays.filter((x) => x.user_id === yo && x.publica && x.compartida && x.id !== r.id).length >= 30) return no('Caben 30 partidas publicadas por persona: quita alguna antes.')
      Object.assign(r, { publica: true, compartida: true, arquetipos: ids, publicada_at: r.publicada_at || new Date().toISOString() })
      return { data: true, error: null }
    }
    if (nombre === 'repeticiones_publicas') {
      const autor = (id) => {
        const p = T.user_profiles.find((x) => x.id === id)
        return p ? p.display_name || p.username : null
      }
      const filas = T.replays
        .filter((r) => r.publica && r.compartida && (r.arquetipos || []).includes(args.p_arquetipo))
        .sort((a, b) => String(b.publicada_at).localeCompare(String(a.publicada_at)))
        .slice(0, Math.min(Math.max(args.p_limite || 12, 1), 50))
        .map((r) => ({ id: r.id, titulo: r.titulo, jugador_a: r.jugador_a, jugador_b: r.jugador_b, ganador: r.ganador, turnos: r.turnos, mazo_a: r.mazo_a, mazo_b: r.mazo_b, publicada_at: r.publicada_at, autor: autor(r.user_id) }))
      return { data: filas, error: null }
    }
    // Adjuntar y quitar la repetición de una mesa (tanda 496), con las
    // mismas puertas que las funciones de verdad: solo un jugador de esa
    // mesa, solo una repetición suya, y tres como mucho (un BO3).
    if (nombre === 'torneos_adjuntar_repeticion' || nombre === 'torneos_quitar_repeticion') {
      const yo = sesion?.user?.id
      const no = (message, code = 'P0001') => ({ data: null, error: { code, message } })
      if (!yo) return no('Hace falta iniciar sesión.', '28000')
      if (nombre === 'torneos_quitar_repeticion') {
        const antes = T.tournament_match_replays.length
        T.tournament_match_replays = T.tournament_match_replays.filter((x) => !(x.match_id === args.p_partida && x.replay_id === args.p_repeticion && x.user_id === yo))
        return { data: T.tournament_match_replays.length < antes, error: null }
      }
      const m = T.tournament_matches.find((x) => x.id === args.p_partida)
      if (!m || (m.player_a_id !== yo && m.player_b_id !== yo)) return no('Solo los dos jugadores de una partida pueden adjuntarle su repetición.', '42501')
      const r = T.replays.find((x) => x.id === args.p_repeticion && x.user_id === yo)
      if (!r) return no('Esa repetición no es tuya: guárdala primero en «Tus repeticiones».', '42501')
      if (T.tournament_match_replays.some((x) => x.match_id === m.id && x.replay_id === r.id)) return { data: true, error: null }
      if (T.tournament_match_replays.filter((x) => x.match_id === m.id && x.user_id === yo).length >= 3) return no('Caben tres repeticiones tuyas por partida (una por juego de un BO3): quita una antes.')
      r.compartida = true
      T.tournament_match_replays.push({ match_id: m.id, user_id: yo, replay_id: r.id, created_at: new Date().toISOString() })
      return { data: true, error: null }
    }

    // La repetición DE MESA (tanda 555): la añade y la quita quien lleva el
    // torneo o un juez aprobado, con las mismas puertas que la función.
    // Los enlaces cortos (tanda 591), con las puertas de las funciones de
    // verdad: la forma, el tamaño y la misma carga, el mismo id.
    if (nombre === 'enlace_corto_crear') {
      const tipo = args.p_tipo
      const carga = String(args.p_carga || '')
      const no = (message) => ({ data: null, error: { code: '22023', message } })
      if (!['repeticion', 'posicion'].includes(tipo)) return no('Ese tipo de enlace no existe.')
      if (carga.length < 8 || carga.length > 60000) return no('Eso no cabe en un enlace corto: usa el largo.')
      if ((tipo === 'repeticion' && !/^(p|t)=[A-Za-z0-9_-]+$/.test(carga)) || (tipo === 'posicion' && !/^pos=[A-Za-z0-9_-]+$/.test(carga))) return no('Eso no es un enlace de PokeDoc.')
      const ya = T.enlaces_cortos.find((e) => e.tipo === tipo && e.carga === carga)
      if (ya) return { data: ya.id, error: null }
      const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
      const id = Array.from({ length: 8 }, () => letras[Math.floor(Math.random() * letras.length)]).join('')
      T.enlaces_cortos.push({ id, tipo, carga, creado_at: new Date().toISOString() })
      return { data: id, error: null }
    }
    if (nombre === 'enlace_corto_leer') {
      const e = T.enlaces_cortos.find((x) => x.id === args.p_id)
      return { data: e ? [{ tipo: e.tipo, carga: e.carga }] : [], error: null }
    }

    if (nombre === 'torneos_juez_adjuntar_repeticion' || nombre === 'torneos_juez_quitar_repeticion') {
      const yo = sesion?.user?.id
      const no = (message, code = 'P0001') => ({ data: null, error: { code, message } })
      if (!yo) return no('Hace falta iniciar sesión.', '28000')
      const m = T.tournament_matches.find((x) => x.id === args.p_partida)
      const t = m && T.rounds.find((r) => r.id === m.round_id)?.tournament_id
      const perfil = T.user_profiles.find((x) => x.id === yo) || {}
      const manda = Boolean(perfil.is_admin || perfil.is_tournament_admin || T.tournaments.find((x) => x.id === t)?.admin_id === yo)
      const juez = T.judge_applications.some((j) => j.tournament_id === t && j.user_id === yo && j.status === 'approved')
      if (!m) return no('Esa mesa no existe.', 'P0002')
      if (!manda && !juez) return no('Solo quien lleva el torneo y sus jueces añaden la repetición de una mesa.', '42501')
      if (nombre === 'torneos_juez_quitar_repeticion') {
        const antes = T.tournament_match_replays.length
        T.tournament_match_replays = T.tournament_match_replays.filter((x) => !(x.match_id === m.id && x.replay_id === args.p_repeticion && x.publica))
        return { data: T.tournament_match_replays.length < antes, error: null }
      }
      if (['pending', 'bye'].includes(m.status) || !m.player_b_id) return no('Esa mesa no tiene partida que ver (sin empezar, o un bye).')
      const r = T.replays.find((x) => x.id === args.p_repeticion && x.user_id === yo)
      if (!r) return no('Esa repetición no es tuya: guárdala primero.', '42501')
      if (T.tournament_match_replays.filter((x) => x.match_id === m.id && x.publica && x.replay_id !== r.id).length >= 3) return no('Caben tres repeticiones por mesa (una por partida de un BO3): quita una antes.')
      r.compartida = true
      const ya = T.tournament_match_replays.find((x) => x.match_id === m.id && x.replay_id === r.id)
      if (ya) ya.publica = true
      else T.tournament_match_replays.push({ match_id: m.id, user_id: yo, replay_id: r.id, created_at: new Date().toISOString(), publica: true })
      return { data: true, error: null }
    }

    // Marcar un premio como dado (tanda 516), con las puertas de la función
    // de verdad: quien lleva el torneo, terminado, y a quien lo jugó.
    if (nombre === 'torneos_premio_entregado') {
      const yo = sesion?.user?.id
      const no = (message, code = 'P0001') => ({ data: null, error: { code, message } })
      const t = T.tournaments.find((x) => x.id === args.p_torneo)
      const perfil = T.user_profiles.find((p) => p.id === yo)
      if (!yo) return no('Hace falta iniciar sesión.', '28000')
      if (!t || !(t.admin_id === yo || perfil?.is_admin || perfil?.is_tournament_admin)) return no('Solo quien lleva el torneo apunta los premios dados.', '42501')
      if (t.status !== 'finished') return no('Los premios se dan con el torneo terminado.')
      if (!T.tournament_registrations.some((r) => r.tournament_id === t.id && r.user_id === args.p_usuario)) return no('Esa persona no jugó este torneo.')
      const esta = (f) => f.tournament_id === t.id && f.user_id === args.p_usuario
      if (!args.p_entregado) T.tournament_prize_deliveries = T.tournament_prize_deliveries.filter((f) => !esta(f))
      else if (!T.tournament_prize_deliveries.some(esta)) T.tournament_prize_deliveries.push({ tournament_id: t.id, user_id: args.p_usuario, delivered_at: new Date().toISOString(), delivered_by: yo })
      return { data: Boolean(args.p_entregado), error: null }
    }

    // Y si la prueba dice qué tiene que devolver, se devuelve: la RPC de
    // reportar contesta 'esperando' o 'conciliado' y el cliente pinta
    // cosas distintas.
    const respuesta = (typeof window !== 'undefined' && window.__RPC_RESPUESTAS__) || {}
    if (nombre in respuesta) return { data: respuesta[nombre], error: null }
    return { data: null, error: null }
  },
  auth: {
    getSession: async () => ({ data: { session: sesion } }),
    getUser: async () => ({ data: { user: sesion?.user || null } }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
  channel: () => ({ on: () => ({ subscribe: () => {} }), subscribe: () => {} }),
  removeChannel: () => {},
}

// Una cadena de consulta que, se encadene lo que se encadene, termina
// resolviendo a «esa columna no existe». Mismo truco que el de
// `__SIN_TABLAS__`, pero para una columna: una migración a medias deja
// la tabla en su sitio y le falta una columna generada — que es
// exactamente el estado del buscador del foro sin su SQL ejecutado.
function cadenaRota(tabla, col) {
  const err = { data: null, error: { code: '42703', message: `column ${tabla}.${col} does not exist` } }
  const nodo = { then: (res, rej) => Promise.resolve(err).then(res, rej) }
  // Se enumeran a mano en vez de con un Proxy: un Proxy que devuelve una
  // función para CUALQUIER propiedad hace que `resultado.error` y
  // `resultado.data` sean funciones —las dos ciertas— y el cliente ni
  // entra en su rama de error ni se queda sin datos: se queda colgado.
  for (const m of ['select', 'eq', 'neq', 'in', 'or', 'not', 'is', 'gt', 'gte', 'lt', 'lte',
                   'ilike', 'like', 'order', 'limit', 'range', 'filter', 'contains', 'overlaps']) {
    nodo[m] = () => nodo
  }
  nodo.maybeSingle = async () => err
  nodo.single = async () => err
  return nodo
}

// `search_norm` es una columna GENERADA en la base: el título del tema
// —o el cuerpo del mensaje sin etiquetas— en minúsculas y sin tildes
// (ver supabase-migration-buscar-foro.sql y plegarTexto en js/texto.js).
// Aquí se calcula al vuelo, igual que `name_search` de las cartas, para
// que una prueba del buscador no tenga que sembrar a mano una columna
// que en producción se rellena sola — y que por tanto nunca podría
// desincronizarse del título de verdad.
function valorGenerado(fila, col) {
  if (col !== 'search_norm') return ''
  const crudo = fila.title ?? String(fila.body_html ?? '').replace(/<[^>]*>/g, ' ')
  return String(crudo).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Para que una prueba pueda mirar el estado sin pasar por la API.
if (typeof window !== 'undefined') {
  window.__TABLAS__ = T
  window.__RPCS__ = RPCS
  window.__CONSULTAS__ = CONSULTAS
}
