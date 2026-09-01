import { parseDecklist, decklistUnparsed, validateDecklist } from '/home/user/pingu/js/torneos/motor.js'
import { arquetipoDeMazo } from '/home/user/pingu/js/torneos/arquetipos.js'

// Tanda 232: el export de TCG Live en español (y en el resto de idiomas).
//
// El fallo que esto vigila, del 2026-09-01: las cabeceras solo se
// reconocían en inglés, así que en una lista en español las 32 cartas de
// «Entrenador» y las 9 de «Energía» se colaban en la sección de POKÉMON
// —la última cabecera reconocida— y el total daba 60. O sea: parecía
// correcta y estaba mal por dentro, que es peor que un error.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

// La lista de verdad que pegó PINGU, tal cual.
const ESPANOL = `Pokémon: 19
4 Dreepy TWM 128
4 Drakloak TWM 129
3 Dragapult ex TWM 130
2 Munkidori TWM 95
2 Budew ASC 16
1 Dunsparce JTG 120
1 Dudunsparce TEF 129
1 Meowth ex POR 62
1 Fezandipiti ex ASC 142

Entrenador: 32
4 Determinación de Lylia MEG 119
3 Órdenes de Jefes MEG 114
2 Denis SCR 133
1 Apoyo de Nanci POR 84
4 Pokétableta POR 81
4 Martillo Demoledor POR 71
4 Pokochos Gemelos TEF 144
3 Camilla Nocturna ASC 196
3 Ultra Ball MEG 131
1 Sello Injusto TWM 165
1 Tarjeta Roja Especial CRI 82
2 Ruinas Peligrosas MEG 127

Energía: 9
3 Energía Fuego MEE 2
3 Energía Oscura MEE 7
3 Energía Psíquica MEE 5`

const INGLES = ESPANOL.replace('Entrenador: 32', 'Trainer: 32')
  .replace('Energía: 9', 'Energy: 9')

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La lista en español ──')
{
  const r = parseDecklist(ESPANOL)
  check('60 cartas', r.total === 60, String(r.total))
  check('19 Pokémon', r.pokemon.reduce((t, l) => t + l.quantity, 0) === 19,
    String(r.pokemon.reduce((t, l) => t + l.quantity, 0)))
  check('32 de Entrenador', r.trainer.reduce((t, l) => t + l.quantity, 0) === 32,
    String(r.trainer.reduce((t, l) => t + l.quantity, 0)))
  check('9 de Energía', r.energy.reduce((t, l) => t + l.quantity, 0) === 9,
    String(r.energy.reduce((t, l) => t + l.quantity, 0)))
  check('ninguna línea sin entender', decklistUnparsed(ESPANOL).length === 0,
    JSON.stringify(decklistUnparsed(ESPANOL)))
  check('y la valida el motor', validateDecklist(r).valid !== false, JSON.stringify(validateDecklist(r)))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Da EXACTAMENTE lo mismo que en inglés ──')
{
  // Es la misma lista: si los dos idiomas no dan el mismo mazo, alguno
  // de los dos está mal clasificado.
  const es = parseDecklist(ESPANOL)
  const en = parseDecklist(INGLES)
  const forma = (r) => [r.total, r.pokemon.length, r.trainer.length, r.energy.length].join('/')
  check('mismo reparto por secciones', forma(es) === forma(en), `es ${forma(es)} · en ${forma(en)}`)
  check('mismos códigos de set', JSON.stringify(es.trainer.map((l) => l.set)) === JSON.stringify(en.trainer.map((l) => l.set)))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Y el arquetipo sale bien ──')
{
  // Con el fallo, los Entrenadores estaban en `pokemon` y podían acabar
  // dando nombre al mazo.
  const arq = arquetipoDeMazo(parseDecklist(ESPANOL), [])
  check('lo nombra por sus Pokémon', /Dragapult/.test(arq.nombre), arq.nombre)
  check('y NO por un objeto', !/Martillo|Ultra Ball|Pokétableta/.test(arq.nombre), arq.nombre)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Los otros idiomas ──')
{
  const casos = [
    ['francés', 'Dresseur', 'Énergie'],
    ['alemán', 'Trainer', 'Energie'],
    ['italiano', 'Allenatore', 'Energia'],
    ['portugués', 'Treinador', 'Energia'],
  ]
  for (const [idioma, entrenador, energia] of casos) {
    const texto = `Pokémon: 1\n1 Dreepy TWM 128\n\n${entrenador}: 1\n1 Ultra Ball MEG 131\n\n${energia}: 1\n1 Fire Energy MEE 2`
    const r = parseDecklist(texto)
    check(`en ${idioma}`, r.pokemon.length === 1 && r.trainer.length === 1 && r.energy.length === 1,
      `${r.pokemon.length}/${r.trainer.length}/${r.energy.length}`)
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Lo que NO puede pasar ──')
{
  // Una carta que empiece por una palabra de sección no es una cabecera.
  // Sin los dos puntos, «Energy Switch» partiría el mazo en dos.
  const r = parseDecklist('Pokémon: 1\n1 Dreepy TWM 128\n\nTrainer: 2\n2 Energy Switch SVI 173\n1 Trainers Mail SVI 1')
  check('«Energy Switch» no abre sección', r.energy.length === 0, JSON.stringify(r.energy))
  check('sigue siendo un Trainer', r.trainer.length === 2, String(r.trainer.length))
  // Y una cabecera desconocida no puede tragarse las cartas en silencio.
  const raro = parseDecklist('Pokémon: 1\n1 Dreepy TWM 128\n\nSección Rara: 1\n1 Ultra Ball MEG 131')
  check('una cabecera desconocida no cambia de sección', raro.trainer.length === 0)

  // Los DOS PUNTOS son lo que distingue una cabecera de una nota suelta.
  // Sin exigirlos, cualquier línea que empiece por «Trainer» cambiaría
  // de sección — y quien pega una lista a veces mete una nota.
  const conNota = parseDecklist('Pokémon: 2\n1 Dreepy TWM 128\nTrainer cards van abajo\n1 Drakloak TWM 129')
  check('una nota que empieza por «Trainer» no abre sección',
    conNota.trainer.length === 0 && conNota.pokemon.length === 2,
    `${conNota.pokemon.length}/${conNota.trainer.length}`)
  check('y la línea rara se declara', decklistUnparsed('Pokémon: 1\n1 Dreepy TWM 128\n\nSección Rara: 1').length === 1)
}

console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
