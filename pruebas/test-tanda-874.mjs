// Tanda 874 — «Pokémon + expansión» en los buscadores, sin navegador.
//
// PINGU: «mucha gente hace la búsqueda con pokemon + expansión. por ejemplo:
// pikachu ascended heroes o hypno rocket […] si voy poniendo pikachu asc, que
// salga el pikachu (o los pikachus) de ascended heroes». `expansionEnBusqueda`
// lee la cola de lo escrito como expansión (cada palabra, el principio de
// una del nombre del set, o el código entero) y `tocaProbarExpansion` dice
// cuándo se pregunta por ella: sin nada por nombre, siempre; con algo pero
// poco, solo si la cola son palabras enteras («pikachu ex» no arrastra a los
// Mewtwo de los sets «EX»).
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { expansionEnBusqueda, tocaProbarExpansion } = await import(`${RAIZ}/js/mi-coleccion/busqueda.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const SETS = [
  { id: 'me2pt5', name: 'Héroes Ascendidos', name_en: 'Ascended Heroes', tcg_online_code: 'ASC' },
  { id: 'base5', name: 'Team Rocket', name_en: 'Team Rocket', tcg_online_code: 'TR' },
  { id: 'ex7', name: 'EX Team Rocket Returns', name_en: 'EX Team Rocket Returns', tcg_online_code: 'RR' },
  { id: 'ex1', name: 'EX Rubí y Zafiro', name_en: 'EX Ruby & Sapphire', tcg_online_code: 'RS' },
  { id: 'sv3pt5', name: '151', name_en: '151', tcg_online_code: 'MEW' },
  { id: 'sv8', name: 'Chispas Fulgurantes', name_en: 'Surging Sparks', tcg_online_code: 'SSP' },
]
const e = (t) => expansionEnBusqueda(t, SETS)

console.log('── 1. La cola como expansión ──')
{
  check('«pikachu ascended heroes» → pikachu en Héroes Ascendidos', e('pikachu ascended heroes')?.texto === 'pikachu' && e('pikachu ascended heroes').setIds.join() === 'me2pt5', JSON.stringify(e('pikachu ascended heroes')))
  check('«pikachu asc» (a medio escribir) → lo mismo', e('pikachu asc')?.setIds.join() === 'me2pt5' && e('pikachu asc').texto === 'pikachu')
  check('«pikachu héroes» en español, y sin tilde, también', e('pikachu héroes')?.setIds.join() === 'me2pt5' && e('pikachu heroes')?.setIds.join() === 'me2pt5')
  check('«hypno rocket» → los dos sets con Rocket', e('hypno rocket')?.setIds.join() === 'base5,ex7' && e('hypno rocket').texto === 'hypno', JSON.stringify(e('hypno rocket')))
  check('«dark charizard team rocket» → la cola más larga que casa, y el nombre entero delante', e('dark charizard team rocket')?.texto === 'dark charizard' && e('dark charizard team rocket').expansion === 'team rocket')
  check('«pikachu 151» → el set 151 (un número también puede ser una expansión)', e('pikachu 151')?.setIds.join() === 'sv3pt5')
  check('«pikachu ASC» → el código del set, entero y sin distinguir caja', e('pikachu ASC')?.setIds.join() === 'me2pt5' && e('pikachu mew')?.setIds.join() === 'sv3pt5')
  check('  …pero un trozo de código no: «pikachu me» no es MEW ni ASC (y sí lo que empieza por «me»)', !e('pikachu me')?.setIds.includes('sv3pt5') && !e('pikachu me')?.setIds.includes('me2pt5'))
  check('«pikachu ex» casa los sets EX, marcado como cola CORTA', e('pikachu ex')?.setIds.join() === 'ex7,ex1' && e('pikachu ex').corta === true)
  check('«pikachu sparks» por el nombre inglés', e('pikachu sparks')?.setIds.join() === 'sv8')
}

console.log('── 2. Lo que no es una expansión ──')
{
  check('una sola palabra, nada: «pikachu» es un nombre', e('pikachu') === null)
  check('una letra de cola no cuenta: «pikachu a» (iría a por media estantería)', e('pikachu a') === null)
  check('una cola que no casa con ningún set, nada: «mewtwo mega»', e('mewtwo mega') === null)
  check('siempre queda algo delante: «ascended heroes» no se lee como set + nada', e('ascended heroes')?.texto === 'ascended')
  check('sin sets, nada', expansionEnBusqueda('pikachu asc', []) === null && expansionEnBusqueda('pikachu asc') === null)
}

console.log('── 3. Cuándo se pregunta por la expansión ──')
{
  const larga = e('pikachu asc')
  const corta = e('pikachu ex')
  check('sin nada por nombre, siempre (cola larga o corta)', tocaProbarExpansion(larga, 0, 48) && tocaProbarExpansion(corta, 0, 48))
  check('con poco por nombre y cola larga, también («hypno rocket» con el Hypno de Team Rocket’s delante)', tocaProbarExpansion(larga, 1, 48))
  check('con poco por nombre y cola CORTA, no: «pikachu ex» son los Pikachu ex y nada más', !tocaProbarExpansion(corta, 5, 48))
  check('con la pantalla llena, no', !tocaProbarExpansion(larga, 48, 48) && !tocaProbarExpansion(larga, 60, 48))
  check('sin expansión leída, no', !tocaProbarExpansion(null, 0, 48))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
