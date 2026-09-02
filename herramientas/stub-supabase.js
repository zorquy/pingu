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
  user_notifications: [],
  tcg_cards: [],
  tcg_archetypes: [],
  tcg_sets: [],
  tcg_cards: [],
  match_log: [],
  match_log_torneos: [],
  site_settings: [],
  push_subscriptions: [],
  achievement_definitions: [],
  user_achievements: [],
}

// ── Quién eres ──
// Por defecto un admin, que es quien puede entrar hoy en torneos.
const PERSONAS = {
  'admin-1': { username: 'Admin', is_admin: true },
  'user-1': { username: 'Ash', is_admin: false },
  'user-2': { username: 'Misty', is_admin: false },
  'user-3': { username: 'jesus', is_admin: false },
}
for (const [id, p] of Object.entries(PERSONAS)) {
  T.user_profiles.push({
    id,
    username: p.username,
    display_name: p.username,
    is_admin: p.is_admin,
    avatar_url: null,
    xp: 0,
    notification_prefs_disabled: [],
    notification_email_disabled: [],
  })
}

const quienSoy = typeof window !== 'undefined' ? window.__FAKE_SESSION__ || 'admin-1' : 'admin-1'
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

// Las tablas cuya política de borrado dice que no (ver `aplicar`).
const SIN_BORRAR = (typeof window !== 'undefined' && window.__RLS_SIN_BORRAR__) || []

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
    ...estado,
  }

  const aplicar = () => {
    let filas = tabla === 'forum_boards_resumen' ? resumenDeForos() : (T[tabla] || []).slice()
    // Una política de borrado que dice que NO no da error: le añade a la
    // sentencia un filtro que no casa con nada, y el DELETE se va sin
    // haber tocado ninguna fila. Se simula igual, con un filtro, porque
    // es literalmente lo que hace Postgres — y así una prueba puede
    // comprobar que la página se entera de que no ha borrado nada.
    if (st.op === 'delete' && SIN_BORRAR.includes(tabla)) filas = []
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
    const filas = aplicar()
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
        devuelve: true,
        pideCuenta: opciones.count === 'exact' || st.pideCuenta,
        soloCuenta: opciones.head === true || st.soloCuenta,
      })
    },
    range: (desde, hasta) => consulta(tabla, { ...st, rango: [desde, hasta] }),
    // `ilike` de PostgREST: el comodín es % y no distingue mayúsculas.
    ilike: (col, patron) => {
      const re = new RegExp('^' + String(patron).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i')
      return consulta(tabla, { ...st, filtros: [...st.filtros, (f) => re.test(String(f[col] ?? ''))] })
    },
    // `like` de PostgREST: como ilike pero distinguiendo mayúsculas. Lo
    // usa la búsqueda de cartas contra `name_search`, que en la base es
    // una columna GENERADA (minúsculas y sin tildes). Aquí se calcula al
    // vuelo si la fila no la trae, que es como se siembran las cartas.
    like: (col, patron) => {
      const re = new RegExp('^' + String(patron).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$')
      return consulta(tabla, {
        ...st,
        filtros: [
          ...st.filtros,
          (f) => {
            const valor =
              f[col] ??
              (col === 'name_search'
                ? String(f.name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                : '')
            return re.test(String(valor))
          },
        ],
      })
    },
    gt: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => f[col] > val] }),
    lt: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => f[col] < val] }),
    eq: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => String(f[col]) === String(val)] }),
    or: (expresion) => {
      const trozos = String(expresion).split(',')
      const pruebas = trozos.map((t) => {
        const [col, op, ...resto] = t.split('.')
        const valor = resto.join('.')
        if (op === 'eq') return (f) => String(f[col]) === valor
        if (op === 'is') return (f) => (valor === 'null' ? f[col] == null : String(f[col]) === valor)
        throw new Error(`stub: .or() no entiende «${t}». Añádelo si el cliente lo usa.`)
      })
      return consulta(tabla, { ...st, filtros: [...st.filtros, (f) => pruebas.some((p) => p(f))] })
    },
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
      const valor = resolver()
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
export const CONSULTAS = { n: 0, porTabla: {}, columnas: {} }

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
    if (nombre === 'forum_ver_tema') {
      const tema = T.forum_threads.find((t) => t.id === args.p_thread)
      if (tema) tema.view_count = (tema.view_count || 0) + 1
    }
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

// Para que una prueba pueda mirar el estado sin pasar por la API.
if (typeof window !== 'undefined') {
  window.__TABLAS__ = T
  window.__RPCS__ = RPCS
  window.__CONSULTAS__ = CONSULTAS
}
