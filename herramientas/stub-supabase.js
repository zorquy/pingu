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
  forum_threads: [],
  forum_boards: [],
  forum_posts: [],
  user_notifications: [],
  tcg_cards: [],
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

sembrar('__FAKE_JUECES__', 'judge_applications', (i) => ({
  id: `juez-${i + 1}`,
  tournament_id: 'torneo-1',
  user_id: 'user-2',
  status: 'pending',
}))

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

// ── El encadenado ──
// Un objeto «then-able»: se puede esperar en cualquier punto de la
// cadena, igual que el cliente de verdad.
function consulta(tabla, estado = {}) {
  const st = {
    filtros: [],
    orden: null,
    limite: null,
    unico: null,
    op: null,
    cuerpo: null,
    ...estado,
  }

  const aplicar = () => {
    let filas = (T[tabla] || []).slice()
    for (const f of st.filtros) filas = filas.filter(f)
    if (st.orden) {
      const { col, asc } = st.orden
      filas.sort((a, b) => {
        const x = a[col] ?? ''
        const y = b[col] ?? ''
        return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1)
      })
    }
    if (st.limite != null) filas = filas.slice(0, st.limite)
    return filas
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
      return { data: null, error: null }
    }
    // Lecturas
    const filas = aplicar()
    if (st.unico === 'maybe') return { data: filas[0] || null, error: null }
    if (st.unico === 'one') {
      return filas.length === 1
        ? { data: filas[0], error: null }
        : { data: null, error: { message: 'no rows', code: 'PGRST116' } }
    }
    return { data: filas, error: null }
  }

  const api = {
    select: (_cols) => consulta(tabla, st),
    eq: (col, val) => consulta(tabla, { ...st, filtros: [...st.filtros, (f) => String(f[col]) === String(val)] }),
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
    order: (col, opts = {}) => consulta(tabla, { ...st, orden: { col, asc: opts.ascending !== false } }),
    limit: (n) => consulta(tabla, { ...st, limite: n }),
    maybeSingle: () => consulta(tabla, { ...st, unico: 'maybe' }),
    single: () => consulta(tabla, { ...st, unico: 'one' }),
    insert: (cuerpo) => consulta(tabla, { ...st, op: 'insert', cuerpo }),
    upsert: (cuerpo) => consulta(tabla, { ...st, op: 'upsert', cuerpo }),
    update: (cuerpo) => consulta(tabla, { ...st, op: 'update', cuerpo }),
    delete: () => consulta(tabla, { ...st, op: 'delete' }),
    then: (ok, mal) => Promise.resolve(resolver()).then(ok, mal),
  }
  return api
}

export const supabase = {
  from: (tabla) => {
    if (!T[tabla]) T[tabla] = []
    return consulta(tabla)
  },
  rpc: async () => ({ data: null, error: { message: 'rpc sin doble' } }),
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
if (typeof window !== 'undefined') window.__TABLAS__ = T
