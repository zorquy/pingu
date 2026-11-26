// Los datos de /torneos para las pruebas y capturas de la 1462–1463: una
// liga en curso con la jornada 6 mañana (como la Liga FDN), dos torneos
// abiertos (uno en persona que se repite y uno oficial online), dos más
// adelante y dos terminados.
const DIA = 864e5
export function datosArena({ conLiga = true, abiertos = true } = {}) {
  const ahora = Date.now()
  const manana = new Date(ahora + DIA); manana.setHours(19, 0, 0, 0)
  const fechas = Array.from({ length: 10 }, (_, i) => new Date(manana.getTime() + (i - 5) * 7 * DIA).toISOString())
  const en = (dias, h = 18) => { const d = new Date(ahora + dias * DIA); d.setHours(h, 0, 0, 0); return d.toISOString() }
  const LIGA = { id: 'liga-1', slug: 'liga-fdn', name: 'Liga FDN [Oct-Dic]', format: 'league', status: 'in_progress', modalidad: 'online', swiss_rounds: 10, rounds_per_matchday: 1, matchday_dates: fechas, max_players: null, start_at: fechas[0], admin_id: 'admin-1', pairing_seed: 's' }
  const RONDAS = [1, 2, 3, 4, 5].map((n) => ({ id: `ronda-${n}`, tournament_id: 'liga-1', round_number: n, phase: 'swiss', status: 'finished', started_at: fechas[n - 1], closed_at: fechas[n - 1] }))
  const base = { status: 'registration_open', format: 'standard', swiss_rounds: 4, top_cut_size: 0, checkin_minutes: 5, round_time_minutes: 50, pairing_seed: 's' }
  const torneos = [
    ...(conLiga ? [LIGA] : []),
    ...(abiertos ? [
      { ...base, id: 't-bilbao', slug: 'viernes-bilbao', name: 'Viernes en Cartas Bilbao', start_at: en(1, 18), modalidad: 'presencial', lugar: 'Cartas Bilbao', direccion: 'Calle Ercilla 12, Bilbao', inscripcion: 'pedir', max_players: 16, precio_entrada: 5, repite: 'semanal', admin_id: 'tienda-1', prizes: [{ puesto: '1º', premio: 'Caja de sobres' }] },
      { ...base, id: 't-copa', slug: 'copa-diciembre', name: 'Copa PokeDoc de Diciembre', start_at: en(4, 17), modalidad: 'online', max_players: 64, top_cut_size: 8, swiss_rounds: 5, admin_id: 'admin-1', prizes: [{ puesto: '1º', premio: 'ETB + sobres' }] },
      { ...base, id: 't-mega', slug: 'relampago-mega', name: 'Torneo relámpago Mega', start_at: en(10, 20), modalidad: 'online', max_players: 20, admin_id: 'user-2' },
      { ...base, id: 't-madrid', slug: 'sabado-madrid', name: 'Sábado en Madrid', start_at: en(12, 11), modalidad: 'presencial', lugar: 'La Guarida', direccion: 'Gran Vía 30, 28013 Madrid', inscripcion: 'pedir', max_players: 24, admin_id: 'user-2' },
    ] : []),
    // Los terminados (1464): con su podio guardado (user-1 quedó 3.º en el
    // Tardeo) y el de Bilbao, en persona, para que Campeones tenga tres.
    { ...base, id: 't-tardeo', slug: 'tardeo', name: 'Tardeo de Testeo', status: 'finished', start_at: en(-1, 17), modalidad: 'online', admin_id: 'admin-1', champion_id: 'user-2', podium: ['user-2', 'p2', 'user-1', 'p3'] },
    { ...base, id: 't-bilbao-ant', slug: 'viernes-bilbao-anterior', name: 'Viernes en Cartas Bilbao', status: 'finished', start_at: en(-6, 18), modalidad: 'presencial', lugar: 'Cartas Bilbao', direccion: 'Calle Ercilla 12, Bilbao', admin_id: 'tienda-1', champion_id: 'p3', podium: ['p3', 'p4', 'user-2'] },
    { ...base, id: 't-ryu', slug: 'copa-ryu', name: 'Copa RyuCards x PokeDoc', status: 'finished', start_at: en(-57, 17), modalidad: 'online', admin_id: 'admin-1', champion_id: 'user-3', podium: ['user-3', 'p4', 'p2'] },
  ]
  const P = ['user-1', 'p2', 'p3', 'p4']
  const insc = [
    ...P.map((u, i) => ({ id: `i${i}`, tournament_id: 'liga-1', user_id: u, status: 'active' })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, tournament_id: 't-bilbao', user_id: `x${i}`, status: 'active' })),
    ...Array.from({ length: 24 }, (_, i) => ({ id: `c${i}`, tournament_id: 't-copa', user_id: `y${i}`, status: 'active' })),
  ]
  const MESAS = [
    { id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'p2', status: 'finished' },
    { id: 'mesa-2', round_id: 'ronda-1', table_number: 2, player_a_id: 'p3', player_b_id: 'p4', status: 'finished' },
    { id: 'mesa-3', round_id: 'ronda-2', table_number: 1, player_a_id: 'p2', player_b_id: 'p3', status: 'finished' },
    { id: 'mesa-4', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-1', player_b_id: 'p4', status: 'finished' },
  ]
  const RES = [{ match_id: 'mesa-1', result: 'b_wins' }, { match_id: 'mesa-2', result: 'a_wins' }, { match_id: 'mesa-3', result: 'a_wins' }, { match_id: 'mesa-4', result: 'a_wins' }]
  const PERFILES = [{ id: 'p2', username: 'enege' }, { id: 'p3', username: 'srpaquito' }, { id: 'p4', username: 'soyfedeegb' }, { id: 'tienda-1', username: 'cartasbilbao', tipo: 'tienda' }, { id: 'admin-1', username: 'pingu', is_admin: true }, { id: 'user-2', username: 'jesus-bless' }, { id: 'user-3', username: 'ikergbt' }]
  // Las listas de los campeones: su mazo sale en Campeones (1464).
  const lista = (pk) => ({ pokemon: pk.map(([q, name, set, number]) => ({ quantity: q, name, set, number })), trainer: [], energy: [], total: 60 })
  const LISTAS = [
    { id: 'dl-1', tournament_id: 't-tardeo', user_id: 'user-2', parsed_cards: lista([[4, 'Dreepy', 'TWM', '128'], [4, 'Drakloak', 'TWM', '129'], [3, 'Dragapult ex', 'TWM', '130'], [2, 'Duskull', 'SFA', '18'], [2, 'Dusknoir', 'SFA', '20']]) },
    { id: 'dl-2', tournament_id: 't-bilbao-ant', user_id: 'p3', parsed_cards: lista([[4, 'Ralts', 'SVI', '84'], [3, 'Kirlia', 'SVI', '85'], [3, 'Gardevoir ex', 'SVI', '86']]) },
    { id: 'dl-3', tournament_id: 't-ryu', user_id: 'user-3', parsed_cards: lista([[4, 'Raging Bolt ex', 'TEF', '123'], [3, 'Ogerpon ex', 'TWM', '25']]) },
  ]
  return { torneos, RONDAS, insc, MESAS, RES, PERFILES, LISTAS }
}

// Para `ctx.addInitScript(sembrarArena, datosArena())`.
export function sembrarArena(d) {
  window.__FAKE_TORNEOS__ = d.torneos
  window.__FAKE_RONDAS__ = d.RONDAS
  window.__FAKE_INSCRIPCIONES__ = d.insc
  window.__FAKE_MESAS__ = d.MESAS
  window.__FAKE_RESULTADOS__ = d.RES
  window.__FAKE_PERFILES__ = [...(window.__FAKE_PERFILES__ || []), ...d.PERFILES]
  window.__FAKE_LISTAS_JORNADA__ = []
  window.__FAKE_DECKLISTS__ = d.LISTAS || []
  window.__RPC_RESPUESTAS__ = { ...(window.__RPC_RESPUESTAS__ || {}), liga_listas_jornada: 1 }
}
