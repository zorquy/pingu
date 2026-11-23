// Los torneos de mentira de «Por torneo» (1421–1423): uno oficial, uno de
// PokeDoc, uno online y uno viejo que solo entra con 30 días. Se mete en la
// página con `window.__FAKE_FILAS__` y `__RPC_RESPUESTAS__`.
const dia = (n) => new Date(Date.now() - n * 864e5).toISOString()
export const ARQUETIPOS = [
  ['dragapult-dusknoir', 'Dragapult Dusknoir', ['dragapult', 'dusknoir']],
  ['gardevoir-ex', 'Gardevoir ex', ['gardevoir']],
  ['gholdengo-ex', 'Gholdengo ex', ['gholdengo']],
  ['raging-bolt-ex', 'Raging Bolt ex', ['raging-bolt']],
  ['grimmsnarl-ex', 'Grimmsnarl ex', ['grimmsnarl']],
  ['charizard-ex', 'Charizard ex', ['charizard', 'pidgeot']],
].map(([id, nombre, iconos]) => ({ id, nombre, iconos, visto_at: dia(1) }))

export const TORNEOS = [
  { id: 'oficial-900', nombre: 'Regional de Stuttgart', fecha: dia(1), jugadores: 1842, clasificados: 40, con_lista: 4, fuente: 'oficial', tipo: 'Regional', enlace: 'https://limitlesstcg.com/tournaments/900' },
  { id: 'pokedoc-liga-6', nombre: 'Liga del Friki · jornada 6', fecha: dia(2), jugadores: 24, clasificados: 10, con_lista: 3, fuente: 'pokedoc', tipo: 'PokeDoc', enlace: '/torneo?slug=liga-del-friki' },
  { id: 'abc123', nombre: 'Limitless Weekly #318', fecha: dia(3), jugadores: 212, clasificados: 12, con_lista: 2, fuente: 'online', tipo: null, enlace: null },
  { id: 'oficial-800', nombre: 'Special Event de Lisboa', fecha: dia(20), jugadores: 618, clasificados: 8, con_lista: 0, fuente: 'oficial', tipo: 'Especial', enlace: null },
]

// La clasificación de Stuttgart: 40 mazos. Grimmsnarl es el 5 % de la sala
// (2 de 40) y mete 1 en el Top 8: es «el que más rindió».
const reparto = ['dragapult-dusknoir', 'gardevoir-ex', 'dragapult-dusknoir', 'gholdengo-ex', 'raging-bolt-ex', 'grimmsnarl-ex', 'gardevoir-ex', 'charizard-ex']
const resto = [...Array(32)].map((_, i) => ['dragapult-dusknoir', 'gardevoir-ex', 'gholdengo-ex', 'raging-bolt-ex', 'charizard-ex', 'dragapult-dusknoir', 'gardevoir-ex', 'grimmsnarl-ex'][i % 8]).map((a, i) => (a === 'grimmsnarl-ex' && i > 8 ? 'charizard-ex' : a))
const nombres = ['Jonas Weber', 'Léa Martin', 'Marco Rossi', 'Álvaro Ruiz', 'Tomasz Nowak', 'Sara Berg', 'Noah Klein', 'Hugo Smit']
export const RESULTADOS = [
  ...[...reparto, ...resto].map((arquetipo, i) => ({
    torneo_id: 'oficial-900', jugador: `lista-${i + 1}`, arquetipo, puesto: i + 1, victorias: 0, derrotas: 0, empates: 0, abandono: null, con_lista: i < 4,
    nombre_jugador: i < 4 ? nombres[i] : null, pais: i < 4 ? ['DE', 'FR', 'IT', 'ES'][i] : null,
    lista: i < 4 ? { pokemon: [{ count: 4, name: 'Dreepy', set: 'TWM', number: '128' }], trainer: [{ count: 4, name: 'Arven', set: 'OBF', number: '186' }], energy: [{ count: 52, name: 'Basic Psychic Energy', set: 'SVE', number: '5' }] } : null,
    enlace: i < 4 ? `https://limitlesstcg.com/decks/list/${i + 1}` : null,
  })),
  ...['gholdengo-ex', 'dragapult-dusknoir', 'gardevoir-ex', 'raging-bolt-ex', 'charizard-ex', 'gardevoir-ex', 'dragapult-dusknoir', 'grimmsnarl-ex', 'gholdengo-ex', 'charizard-ex'].map((arquetipo, i) => ({
    torneo_id: 'pokedoc-liga-6', jugador: `pokedoc-u${i}`, arquetipo, puesto: i + 1, victorias: 5 - Math.min(i, 5), derrotas: Math.min(i, 5), empates: 0, abandono: null, con_lista: i < 3, nombre_jugador: i < 3 ? ['saul_tcg', 'mery', 'kike'][i] : null, pais: null, lista: null, enlace: null,
  })),
  ...['raging-bolt-ex', 'dragapult-dusknoir', 'gardevoir-ex', 'dragapult-dusknoir', 'gholdengo-ex', 'grimmsnarl-ex', 'raging-bolt-ex', 'charizard-ex', 'gardevoir-ex', 'gholdengo-ex', 'dragapult-dusknoir', 'charizard-ex'].map((arquetipo, i) => ({
    torneo_id: 'abc123', jugador: `jug${i}`, arquetipo, puesto: i + 1, victorias: 7 - Math.min(i, 6), derrotas: Math.min(i, 6), empates: i === 2 ? 1 : 0, abandono: null, con_lista: i < 2, nombre_jugador: i < 2 ? ['kurogane', 'pk_lola'][i] : null, pais: i < 2 ? 'JP' : null, lista: null, enlace: null,
  })),
  ...['gardevoir-ex', 'dragapult-dusknoir', 'gholdengo-ex', 'gardevoir-ex', 'grimmsnarl-ex', 'dragapult-dusknoir', 'charizard-ex', 'raging-bolt-ex'].map((arquetipo, i) => ({
    torneo_id: 'oficial-800', jugador: `puesto-${i + 1}`, arquetipo, puesto: i + 1, victorias: 0, derrotas: 0, empates: 0, abandono: null, con_lista: false, nombre_jugador: null, pais: null, lista: null, enlace: null,
  })),
]

export const INICIO = `
  window.__FAKE_FILAS__ = Object.assign(window.__FAKE_FILAS__ || {}, ${JSON.stringify({ meta_torneos: TORNEOS, meta_resultados: RESULTADOS, meta_arquetipos: ARQUETIPOS })});
  window.__RPC_RESPUESTAS__ = Object.assign(window.__RPC_RESPUESTAS__ || {}, {
    meta_totales: () => [{ torneos: 3, jugadores: 2078, oficiales: 1, online: 1, pokedoc: 1, ultima_lectura: new Date().toISOString() }],
    meta_resumen: () => ${JSON.stringify(ARQUETIPOS.map((a, i) => ({ arquetipo: a.id, nombre: a.nombre, iconos: a.iconos, mazos: 40 - i * 5, top8: 2, cuota: 20 - i * 3, cuota_anterior: 19 - i * 3, victorias: 50, derrotas: 40, empates: 2, porcentaje_victorias: 52, torneos: 3, listas: 4 })))},
    meta_listas: () => ${JSON.stringify([{ torneo_id: 'oficial-900', torneo: 'Regional de Stuttgart', fecha: new Date(Date.now() - 864e5).toISOString(), jugadores: 1842, fuente: 'oficial', tipo: 'Regional', jugador: 'lista-1', nombre_jugador: 'Jonas Weber', pais: 'DE', puesto: 1, victorias: 0, derrotas: 0, empates: 0, lista: { pokemon: [{ count: 4, name: 'Dreepy', set: 'TWM', number: '128' }], trainer: [], energy: [] }, enlace: 'https://limitlesstcg.com/decks/list/1', torneo_enlace: 'https://limitlesstcg.com/tournaments/900' }])},
  });
`
