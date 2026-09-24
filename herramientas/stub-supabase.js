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

// ── Las tablas ──
const T = {
  user_profiles: [],
  tournaments: [],
  tournament_registrations: [],
  tournament_decklists: [],
  rounds: [],
  tournament_matches: [],
  match_reports: [],
  match_results: [],
  pairing_history: [],
  judge_applications: [],
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
  tcg_card_play: [],
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
  filas.forEach((fila, i) => T[tabla].push({ ...porDefecto(i), ...fila }))
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
sembrar('__FAKE_SETS__', 'tcg_sets', (i) => ({
  id: `set-${i}`, name: `Set ${i}`, market: 'WEST',
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

sembrar('__FAKE_JUECES__', 'judge_applications', (i) => ({
  id: `juez-${i + 1}`,
  tournament_id: 'torneo-1',
  user_id: 'user-2',
  status: 'pending',
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
  const EMBEBIDOS = {
    categories: 'category_id',
    guides: 'guide_id',
    tcg_sets: 'set_id',
    forum_posts: 'post_id',
  }

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
        const relacionada = (T[e.tabla] || []).find((r) => r.id === fila[e.fk])
        // Sin relación, `null` — que es lo que devuelve PostgREST, y lo
        // que las páginas ya saben manejar con `?.`.
        copia[e.clave] = relacionada
          ? Object.fromEntries(e.campos.map((c) => [c, relacionada[c]]))
          : null
      }
      return copia
    })
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
    // Escrituras
    if (st.op === 'insert' || st.op === 'upsert') {
      const filas = (Array.isArray(st.cuerpo) ? st.cuerpo : [st.cuerpo]).map((f, i) => ({
        id: f.id || `${tabla}-nuevo-${(T[tabla] || []).length + i + 1}`,
        ...f,
      }))
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
    const filas = conEmbebidos(aplicar())
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
      const trozos = String(expresion).split(',')
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
    not: (col, _op, val) =>
      consulta(tabla, { ...st, filtros: [...st.filtros, (f) => (val === null ? f[col] !== null && f[col] !== undefined : f[col] !== val)] }),
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
      const api = new Proxy(
        { then: undefined },
        { get: (_, prop) => (prop === 'then' ? undefined : prop === 'maybeSingle' || prop === 'single' ? fallo : () => api) }
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
