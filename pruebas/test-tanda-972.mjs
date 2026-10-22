// Tanda 972 — el buscador de arriba, B1–B6 (lo puro).
//
// PINGU: «el buscador es un poco mierda… hay gente que busca ahí
// expansiones, cartas o productos directamente y no sale». Aquí, sin
// navegador: qué expansiones casan, cuándo hay una carta «mejor», las
// cuentas de las chapas y la regla de «@».
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { expansionesQueCasan, rutaDeExpansion, mejorResultado, cuentaDeGrupo, esPersona, sinArroba } = await import(`${RAIZ}/js/buscador-puro.js`)

const SETS = [
  { id: 'sv3pt5', market: 'WEST', name: '151', name_en: '151', tcg_online_code: 'MEW', release_date: '2023-09-22' },
  { id: 'SV2a', market: 'JP', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', tcg_online_code: 'SV2a', release_date: '2023-06-16' },
  { id: 'sv3', market: 'WEST', name: 'Obsidiana en Llamas', name_en: 'Obsidian Flames', tcg_online_code: 'OBF', release_date: '2023-08-11' },
  { id: 'sm115', market: 'WEST', name: 'Destinos Ocultos', name_en: 'Hidden Fates', tcg_online_code: 'HIF', release_date: '2019-08-23' },
  { id: 'sma', market: 'WEST', name: 'Destinos Ocultos: Shiny Vault', name_en: 'Hidden Fates Shiny Vault', release_date: '2019-08-23' },
  { id: 'escondido', market: 'WEST', name: 'Obsidiana Secreta', oculto: true, release_date: '2024-01-01' },
  { id: 'A1', market: 'WEST', name: 'Genetic Apex', serie_id: 'tcgp', release_date: '2024-10-30' },
]
const ids = (r) => r.filas.map((s) => s.id).join()

console.log('── B1 · Expansiones ──')
check('«151»: el occidental (nombre igual) y luego el japonés (empieza por…)', ids(expansionesQueCasan(SETS, '151')) === 'sv3pt5,SV2a', ids(expansionesQueCasan(SETS, '151')))
check('«MEW»: por su código', ids(expansionesQueCasan(SETS, 'mew')) === 'sv3pt5')
check('«sv3»: por su id', ids(expansionesQueCasan(SETS, 'SV3')) === 'sv3')
check('«obsidiana»: en español, sin la escondida', ids(expansionesQueCasan(SETS, 'obsidiana')) === 'sv3')
check('«obsidian flames»: en inglés', ids(expansionesQueCasan(SETS, 'Obsidian Flames')) === 'sv3')
check('«pokemon card 151»: el japonés, por su nombre inglés', ids(expansionesQueCasan(SETS, 'pokemon card 151')) === 'SV2a')
check('«destinos ocultos»: el igual primero y el que empieza por ello después', ids(expansionesQueCasan(SETS, 'destinos ocultos')) === 'sm115,sma')
check('  …y «vault shiny» por las palabras, en cualquier orden', ids(expansionesQueCasan(SETS, 'vault shiny')) === 'sma')
check('ni TCG Pocket ni una letra suelta', !expansionesQueCasan(SETS, 'genetic').filas.length && !expansionesQueCasan(SETS, 'o').filas.length)
check('el total cuenta todas aunque se enseñen menos', expansionesQueCasan(SETS, 'destinos', 1).total === 2 && expansionesQueCasan(SETS, 'destinos', 1).filas.length === 1)
check('una expansión lleva a su estantería en /cartas, y la japonesa en su catálogo', rutaDeExpansion(SETS[0]) === '/cartas?ver=album&set=sv3pt5' && rutaDeExpansion(SETS[1]) === '/cartas?ver=album&set=SV2a&catalogo=JP')

console.log('\n── B2 · El mejor resultado ──')
const C = (id, local_id) => ({ id, local_id })
check('«charizard 4» con un solo Charizard que lleva el 4: ese', mejorResultado([C('a-4', '4'), C('b-11', '11')], { numero: '4' })?.id === 'a-4')
check('  …con varios que lo llevan: ninguno (no hay uno mejor)', mejorResultado([C('a-25', '25'), C('b-25', '25')], { numero: '25' }) === null)
check('  …salvo si la expansión la ha dicho quien escribe («MEW 151»)', mejorResultado([C('mew-151', '151'), C('x-151', '151')], { numero: '151', setIds: ['sv3pt5'] })?.id === 'mew-151')
check('sin número, no hay mejor', mejorResultado([C('a', '1')], { numero: null }) === null)

console.log('\n── B4 · Las cuentas de las chapas ──')
check('las cartas: su total, y «120+» si se llegó al tope', cuentaDeGrupo({ filas: [1, 2, 3, 4], total: 35 }) === '35' && cuentaDeGrupo({ filas: [1], total: 120, hayMas: true }) === '120+')
check('los demás: cuántos, y «4+» si se pidieron 4 y salieron 4', cuentaDeGrupo({ filas: [1, 2] }, 4) === '2' && cuentaDeGrupo({ filas: [1, 2, 3, 4] }, 4) === '4+')
check('un grupo que ha fallado o no se ha preguntado, sin número', cuentaDeGrupo({ error: true }) === null && cuentaDeGrupo(undefined) === null)

console.log('\n── B6 · «@» es una persona ──')
check('«@ibai» es una persona; «ibai», no', esPersona('@ibai') && esPersona('  @ibai') && !esPersona('ibai'))
check('  …y se busca sin la arroba', sinArroba('@@ibai ') === 'ibai')

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
