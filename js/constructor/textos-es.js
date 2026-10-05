// El texto de las cartas EN ESPAÑOL, pasado a la plantilla inglesa (tanda 593).
//
// textos.js lee las frases de un ataque en inglés porque «el espejo guarda
// el texto en inglés»… y desde la tanda 330 no es verdad para casi nada
// moderno: el engorde pide la carta primero en español, así que el Budew
// de verdad dice «Durante el próximo turno de tu rival, este no puede jugar
// ninguna carta de Objeto de su mano» y la frase inglesa no casaba NUNCA.
// Sin error: el ataque se quedaba «a mano» y el veto de objetos no existía.
//
// Las traducciones oficiales también son plantillas, así que se hace lo
// mismo que con el inglés pero un paso antes: cada frase española se
// convierte en SU frase inglesa y luego la lee el mismo lector. Un solo
// lector quiere decir una sola forma de entender cada efecto — si se
// escribieran pasos aquí, el español y el inglés acabarían separándose.
//
// Lo vigila una prueba con los ~1.300 pares (inglés, español) de los
// ataques de Escarlata y Púrpura y Megaevolución: donde el inglés se lee
// entero, el español tiene que dar EXACTAMENTE los mismos pasos.
//
// Sin dependencias: lo importa textos.js y se prueba en Node.

const N = '(\\d+|una?|uno)'
const num = (x) => (/^\d+$/.test(x) ? Number(x) : 1)
// «1» en inglés se escribe «a»/«an» en unas plantillas y «1» en otras, y
// el lector inglés solo conoce la que trae la carta: se devuelve la forma
// que su expresión espera en cada caso.
const unoA = (x) => (num(x) === 1 ? 'a' : String(num(x)))

const ESTADO = { dormido: 'asleep', quemado: 'burned', confundido: 'confused', paralizado: 'paralyzed', envenenado: 'poisoned' }
const EST = '(dormido|quemado|confundido|paralizado|envenenado)'

// «Pokémon de Eco» es «Ethan's Pokémon»: el dueño va en inglés porque es
// lo que guarda la partida (`claveDeEfecto`) y lo que compara `esDe`.
const DUENO = {
  'del team rocket': "team rocket's", 'de n': "n's", 'de cintia': "cynthia's", 'de paul': "hop's", 'de roxy': "marnie's",
  'de eco': "ethan's", 'de lylia': "lillie's", 'de e-nigma': "iono's", 'de e nigma': "iono's", 'de máximo': "steven's",
  'de maximo': "steven's", 'de damián': "arven's", 'de damian': "arven's", 'de erika': "erika's", 'de misty': "misty's",
  'de brock': "brock's", 'de lt. surge': "lt. surge's", 'de sabrina': "sabrina's", 'de koga': "koga's", 'de blaine': "blaine's",
  'de giovanni': "giovanni's", 'de clemont': "clemont's", 'de lino': "larry's",
}
// Las clases de Pokémon que cuentan «por cada uno de tus X en juego».
const CLASE = { básicos: 'basic', basicos: 'basic', 'evolución': 'evolution', evolucion: 'evolution', 'de fase 1': 'stage 1', 'de fase 2': 'stage 2', 'del pasado': 'ancient', 'del futuro': 'future' }
function clase(x) {
  const t = String(x || '').trim()
  if (CLASE[t]) return CLASE[t]
  if (DUENO[t]) return DUENO[t]
  if (/^{[a-z]}$/.test(t)) return t
  const de = t.match(/^del? (.+)$/)
  return de ? `${de[1]}'s` : t
}

// «energía {R}», «energía especial», «energía del Team Rocket».
function energia(x) {
  const t = String(x || '').trim()
  let m
  if ((m = t.match(/^energías? ({[a-z]})$/))) return `${m[1]} energy`
  if (/^energías? especial(?:es)?$/.test(t)) return 'special energy'
  if ((m = t.match(/^energías? (del? .+)$/))) return `${clase(m[1])} energy`
  return null
}

const FASE = { 'básico': 'basic', basico: 'basic', 'de fase 1': 'stage 1', 'de fase 2': 'stage 2' }
const CLASE_DESCARTE = { partidario: 'supporter', objeto: 'item', 'energía': 'energy', energia: 'energy' }

// «hace 30 puntos de daño» y «hace 30 puntos de daño más».
const D = 'este ataque hace (\\d+) puntos de daño( más)?'
const mas = (m) => (m ? 'more ' : '')

// Cada entrada: [expresión sobre la frase ya normalizada, (m) => frase inglesa].
const TRADUCIR = [
  // — El daño —
  [new RegExp(`^${D}$`), (m) => (m[2] ? `this attack does ${m[1]} more damage` : null)],
  [/^este ataque no hace nada$/, () => 'this attack does nothing'],
  [new RegExp(`^${D} por cada contador de daño en el pokémon activo de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each damage counter on your opponent's active pokémon`],
  [new RegExp(`^${D} por cada contador de daño en este pokémon$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each damage counter on this pokémon`],
  [new RegExp(`^${D} por cada energía unida al pokémon activo de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each energy attached to your opponent's active pokémon`],
  [new RegExp(`^${D} por cada energía unida a este pokémon$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each energy attached to this pokémon`],
  [new RegExp(`^${D} por cada energía ({[a-z]}) unida a (este pokémon|cada uno de tus pokémon)$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each ${m[3]} energy attached to ${m[4] === 'este pokémon' ? 'this pokémon' : 'all of your pokémon'}`],
  [new RegExp(`^${D} por cada carta en la mano de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each card in your opponent's hand`],
  [new RegExp(`^${D} por cada carta en tu mano$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each card in your hand`],
  [new RegExp(`^${D} por cada {c} en el coste de retirada del pokémon activo de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each {c} in your opponent's active pokémon's retreat cost`],
  [new RegExp(`^${D} por cada uno de tus pokémon en banca$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each of your benched pokémon`],
  [new RegExp(`^${D} por cada uno de los pokémon en banca de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each of your opponent's benched pokémon`],
  [new RegExp(`^${D} por cada pokémon en banca$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each benched pokémon`],
  [new RegExp(`^${D} por cada uno de tus pokémon (.+?) en juego$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each of your ${clase(m[3])} pokémon in play`],
  [new RegExp(`^${D} por cada carta de energía básica en la pila de descartes de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each basic energy card in your opponent's discard pile`],
  [new RegExp(`^${D} por cada carta de (partidario|objeto|energía) en tu pila de descartes que tenga "(.+?)" en su nombre$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each ${CLASE_DESCARTE[m[3]]} card that has "${m[4]}" in its name in your discard pile`],
  [new RegExp(`^${D} por cada carta de (partidario|objeto|energía) en tu pila de descartes$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each ${CLASE_DESCARTE[m[3]]} card in your discard pile`],
  [new RegExp(`^${D} por cada pokémon en tu pila de descartes$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each pokémon in your discard pile`],
  [new RegExp(`^${D} por cada cara$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each heads`],
  [new RegExp(`^si el pokémon activo de tu rival es un pokémon ex, ${D}$`), (m) => `if your opponent's active pokémon is a pokémon ex, this attack does ${m[1]} more damage`],
  [new RegExp(`^si el pokémon activo de tu rival es un pokémon (básico|basico|de fase 1|de fase 2), ${D}$`), (m) => `if your opponent's active pokémon is a ${FASE[m[1]]} pokémon, this attack does ${m[2]} more damage`],
  [new RegExp(`^si el pokémon activo de tu rival es un pokémon ({[a-z]}), ${D}$`), (m) => `if your opponent's active pokémon is a ${m[1]} pokémon, this attack does ${m[2]} more damage`],
  [new RegExp(`^si el pokémon activo de tu rival (?:ya )?tiene algún contador de daño sobre él, ${D}$`), (m) => `if your opponent's active pokémon has any damage counters on it, this attack does ${m[1]} more damage`],
  [new RegExp(`^si este pokémon tiene algún contador de daño sobre él, ${D}$`), (m) => `if this pokémon has any damage counters on it, this attack does ${m[1]} more damage`],
  [new RegExp(`^si el pokémon activo de tu rival está ${EST}, ${D}$`), (m) => `if your opponent's active pokémon is ${ESTADO[m[1]]}, this attack does ${m[2]} more damage`],
  [new RegExp(`^si el pokémon activo de tu rival se ve afectado por una condición especial, ${D}$`), (m) => `if your opponent's active pokémon is affected by a special condition, this attack does ${m[1]} more damage`],
  [new RegExp(`^si tus pokémon en banca tienen algún contador de daño sobre ellos, ${D}$`), (m) => `if your benched pokémon have any damage counters on them, this attack does ${m[1]} more damage`],
  [new RegExp(`^si este pokémon se ha movido de tu banca al puesto activo en este turno, ${D}$`), (m) => `if this pokémon moved from your bench to the active spot this turn, this attack does ${m[1]} more damage`],
  [new RegExp(`^si este pokémon tiene por lo menos (\\d+) energías? adicional(?:es)? unidas?, ${D}$`), (m) => `if this pokémon has at least ${m[1]} extra energy attached, this attack does ${m[2]} more damage`],
  [/^si este pokémon tiene por lo menos (\d+) energías? adicional(?:es)? unidas?, este ataque también hace (\d+) puntos de daño a uno de los pokémon en banca de tu rival$/, (m) => `if this pokémon has at least ${m[1]} extra energy attached, this attack also does ${m[2]} damage to 1 of your opponent's benched pokémon`],
  [new RegExp(`^si este pokémon tiene alguna (.+?) unida, ${D}$`), (m) => (energia(m[1]) ? `if this pokémon has any ${energia(m[1])} attached, this attack does ${m[2]} more damage` : null)],
  [new RegExp(`^si hay un estadio en juego, ${D}$`), (m) => `if a stadium is in play, this attack does ${m[1]} more damage`],
  [/^después, descarta ese estadio$/, () => 'then, discard that stadium'],
  [/^si no hay ningún estadio en juego, este ataque no hace nada$/, () => 'if there is no stadium in play, this attack does nothing'],
  [/^si no tienes a (.+?) en tu banca, este ataque no hace nada$/, (m) => `if you don't have ${m[1].replace(/ y /g, ' and ')} on your bench, this attack does nothing`],
  [/^si a tu rival no le quedan exactamente (\d+) o (\d+) cartas de premio, este ataque no hace nada$/, (m) => `if your opponent doesn't have exactly ${m[1]} or ${m[2]} prize cards remaining, this attack does nothing`],
  [new RegExp(`^si tienes en tu pila de descartes (\\d+) pokémon o más que tengan la habilidad (.+?), ${D}$`), (m) => `if you have ${m[1]} or more pokémon that have the ${m[2]} ability in your discard pile, this attack does ${m[3]} more damage`],
  [/^si tienes en tu pila de descartes (\d+) pokémon o más que tengan la habilidad (.+?), pon (\d+) contadores de daño en cada uno de los pokémon de tu rival$/, (m) => `if you have ${m[1]} or more pokémon that have the ${m[2]} ability in your discard pile, put ${m[3]} damage counters on each of your opponent's pokémon`],
  [new RegExp(`^si alguno de tus pokémon(?: (.+?))? quedó fuera de combate por el daño de un ataque durante el último turno de tu rival, ${D}$`), (m) => `if any of your ${m[1] ? `${clase(m[1])} ` : ''}pokémon were knocked out by damage from an attack during your opponent's last turn, this attack does ${m[2]} more damage`],
  [/^el daño de este ataque no se ve afectado por debilidad (?:o|ni) resistencia, (?:o|ni) por ningún efecto en el pokémon activo de tu rival$/, () => "this attack's damage isn't affected by weakness or resistance, or by any effects on your opponent's active pokémon"],
  [/^el daño de este ataque no se ve afectado por debilidad (?:o|ni) resistencia$/, () => "this attack's damage isn't affected by weakness or resistance"],
  [/^el daño de este ataque no se ve afectado por debilidad$/, () => "this attack's damage isn't affected by weakness"],
  [/^el daño de este ataque no se ve afectado por resistencia$/, () => "this attack's damage isn't affected by resistance"],
  [/^el daño de este ataque no se ve afectado por ningún efecto en el pokémon activo de tu rival$/, () => "this attack's damage isn't affected by any effects on your opponent's active pokémon"],
  [/^puedes descartar (todas las|\d+|una) energías? (?:({[a-z]}) )?de este pokémon y hacer que este ataque haga (\d+) puntos de daño más$/, (m) => `you may discard ${m[1] === 'todas las' ? 'all' : unoA(m[1])} ${m[2] ? `${m[2]} ` : ''}energy from this pokémon and have this attack do ${m[3]} more damage`],
  [/^puedes poner (\d+|una) energía (?:({[a-z]}) )?unida a este pokémon en tu mano y hacer que este ataque haga (\d+) puntos de daño más$/, (m) => (num(m[1]) === 1 ? `you may put an ${m[2] ? `${m[2]} ` : ''}energy attached to this pokémon into your hand and have this attack do ${m[3]} more damage` : null)],
  [new RegExp(`^puedes descartar (\\d+) energías? (?:({[a-z]}) )?de este pokémon y dejar al pokémon activo de tu rival ${EST}$`), (m) => `you may discard ${m[1]} ${m[2] ? `${m[2]} ` : ''}energy from this pokémon and make your opponent's active pokémon ${ESTADO[m[3]]}`],
  [/^este ataque hace (\d+) puntos de daño a uno de los pokémon (en banca )?de tu rival$/, (m) => `this attack does ${m[1]} damage to 1 of your opponent's ${m[2] ? 'benched ' : ''}pokémon`],

  // — Lo que se puede o no se puede usar —
  [/^puedes usar este ataque solo si sales en segundo lugar, y solo durante tu primer turno$/, () => 'you can use this attack only if you go second, and only during your first turn'],

  // — Estados —
  [new RegExp(`^el pokémon activo de tu rival pasa a estar ${EST}(?: y ${EST})?$`), (m) => `your opponent's active pokémon is now ${ESTADO[m[1]]}${m[2] ? ` and ${ESTADO[m[2]]}` : ''}`],
  [new RegExp(`^este pokémon pasa a estar ${EST}$`), (m) => `this pokémon is now ${ESTADO[m[1]]}`],
  [/^este pokémon se recupera de todas las condiciones especiales$/, () => 'this pokémon recovers from all special conditions'],

  // — Daño a otros —
  [/^este pokémon también se hace (\d+) puntos de daño a s[ií] mismo$/, (m) => `this pokémon also does ${m[1]} damage to itself`],
  [/^este ataque (también )?hace (\d+) puntos de daño a (uno|1|2|cada uno) de los pokémon en banca de tu rival$/, (m) => `this attack ${m[1] ? 'also ' : ''}does ${m[2]} damage to ${m[3] === 'cada uno' ? 'each' : m[3] === 'uno' ? '1' : m[3]} of your opponent's benched pokémon`],
  [/^este ataque también hace (\d+) puntos de daño a cada uno de tus pokémon en banca$/, (m) => `this attack also does ${m[1]} damage to each of your benched pokémon`],
  [new RegExp(`^pon ${N} contador(?:es)? de daño en el pokémon activo de tu rival$`), (m) => `put ${num(m[1])} damage counters on your opponent's active pokémon`],
  [new RegExp(`^pon ${N} contador(?:es)? de daño en cada uno de los pokémon de tu rival$`), (m) => `put ${num(m[1])} damage counters on each of your opponent's pokémon`],
  [new RegExp(`^pon ${N} contador(?:es)? de daño en uno de los pokémon (en banca )?de tu rival$`), (m) => `put ${num(m[1])} damage counters on 1 of your opponent's ${m[2] ? 'benched ' : ''}pokémon`],
  [/^ambos pokémon activos quedan fuera de combate$/, () => 'both active pokémon are knocked out'],
  [/^si el pokémon activo de tu rival se ve afectado por una condición especial, queda fuera de combate$/, () => "if your opponent's active pokémon is affected by a special condition, it is knocked out"],
  [new RegExp(`^si (?:un|el) pokémon de tu rival queda fuera de combate por el daño de este ataque, coge ${N} cartas? de premio más$`), (m) => `if your opponent's pokémon is knocked out by damage from this attack, take ${num(m[1])} more prize cards`],

  // — Curar —
  [/^cura (\d+) puntos de daño a este pokémon$/, (m) => `heal ${m[1]} damage from this pokémon`],
  [/^cura (\d+) puntos de daño a uno de tus pokémon$/, (m) => `heal ${m[1]} damage from 1 of your pokémon`],
  [/^cura (\d+) puntos de daño a cada uno de tus pokémon$/, (m) => `heal ${m[1]} damage from each of your pokémon`],

  // — Energía —
  [/^descarta (todas las|\d+|una) energías? (?:({[a-z]}) )?de este pokémon$/, (m) => `discard ${m[1] === 'todas las' ? 'all' : unoA(m[1])} ${m[2] ? `${m[2]} ` : ''}energy from this pokémon`],
  [new RegExp(`^descarta ${N} energía del pokémon activo de tu rival$`), (m) => (num(m[1]) === 1 ? "discard an energy from your opponent's active pokémon" : null)],
  [new RegExp(`^mueve ${N} energía de este pokémon a uno de tus pokémon en banca$`), (m) => (num(m[1]) === 1 ? 'move an energy from this pokémon to 1 of your benched pokémon' : null)],
  [new RegExp(`^pon ${N} energía unida a este pokémon en tu mano$`), (m) => (num(m[1]) === 1 ? 'put an energy attached to this pokémon into your hand' : null)],
  [new RegExp(`^mueve ${N} energía de uno de los pokémon de tu rival a otro de sus pokémon$`), (m) => (num(m[1]) === 1 ? "move an energy from 1 of your opponent's pokémon to another of their pokémon" : null)],
  [/^une (\d+|una|hasta \d+) cartas? de energía ({[a-z]}) básica de tu pila de descartes a este pokémon$/, (m) => `attach ${/^hasta/.test(m[1]) ? `up to ${m[1].replace(/\D/g, '')}` : unoA(m[1])} basic ${m[2]} energy cards from your discard pile to this pokémon`],

  // — Cartas —
  [new RegExp(`^roba ${N} cartas?$`), (m) => `draw ${num(m[1])} cards`],
  [/^descarta la primera carta de la baraja de tu rival$/, () => "discard the top card of your opponent's deck"],
  [/^descarta las (\d+) primeras cartas de la baraja de tu rival$/, (m) => `discard the top ${m[1]} cards of your opponent's deck`],
  [new RegExp(`^tu rival enseña las cartas de su mano, y tú descartas ${N} carta que encuentres entre ellas$`), (m) => (num(m[1]) === 1 ? 'your opponent reveals their hand, and you discard a card you find there' : null)],
  [/^pon este pokémon y todas las cartas unidas a él en tu mano$/, () => 'put this pokémon and all attached cards into your hand'],
  [new RegExp(`^busca en tu baraja hasta ${N} pokémon básicos? y ponl[oa]s? en tu banca$`), (m) => `search your deck for up to ${num(m[1])} basic pokémon and put them onto your bench`],
  [new RegExp(`^busca en tu baraja (hasta )?${N} cartas? y ponlas? en tu mano$`), (m) => `search your deck for ${m[1] ? 'up to ' : ''}${num(m[2])} cards and put them into your hand`],
  [/^después, baraja las cartas de tu baraja$/, () => 'then, shuffle your deck'],

  // — Cambios —
  [/^(puedes )?cambia(?:r)? este pokémon por uno de tus pokémon en banca$/, (m) => `${m[1] ? 'you may ' : ''}switch this pokémon with 1 of your benched pokémon`],
  [/^mueve el pokémon activo de tu rival a la banca$/, () => "switch out your opponent's active pokémon to the bench"],
  [/^tu rival cambia su pokémon activo por uno de sus pokémon en banca$/, () => 'your opponent switches their active pokémon with 1 of their benched pokémon'],
  [/^cambia (?:1|uno) de los pokémon en banca de tu rival por (?:el pokémon que esté en el|su) puesto activo$/, () => "switch in 1 of your opponent's benched pokémon to the active spot"],
  [/^cambia (?:1|uno) de los pokémon en banca de tu rival por el pokémon activo$/, () => "switch in 1 of your opponent's benched pokémon to the active spot"],

  // — El turno que viene —
  [/^durante el próximo turno de tu rival, este no puede jugar ninguna carta de objeto de su mano$/, () => "during your opponent's next turn, they can't play any item cards from their hand"],
  [/^tu rival no puede jugar ninguna carta de partidario de su mano durante su próximo turno$/, () => "your opponent can't play any supporter cards from their hand during their next turn"],
  [/^durante el próximo turno de tu rival, este no puede jugar ninguna carta de partidario de su mano$/, () => "during your opponent's next turn, they can't play any supporter cards from their hand"],
  [/^durante el próximo turno de tu rival, este no puede jugar ningún pokémon de su mano para hacer evolucionar a sus pokémon$/, () => "during your opponent's next turn, they can't play any pokémon from their hand to evolve their pokémon"],
  [/^durante el próximo turno de tu rival, (?:el pokémon defensor|ese pokémon|dicho pokémon) no puede retirarse$/, () => "during your opponent's next turn, the defending pokémon can't retreat"],
  [/^durante el próximo turno de tu rival, el pokémon defensor no puede (?:atacar|usar ataques)$/, () => "during your opponent's next turn, the defending pokémon can't attack"],
  [/^elige uno de los ataques del pokémon activo de tu rival$/, () => "choose 1 of your opponent's active pokémon's attacks"],
  [/^durante el próximo turno de tu rival, (?:dicho|ese) pokémon no puede usar ese ataque$/, () => "during your opponent's next turn, that pokémon can't use that attack"],
  [/^durante el próximo turno de tu rival, los ataques (?:usados por el|del) pokémon defensor hacen (\d+) puntos de daño menos$/, (m) => `during your opponent's next turn, attacks used by the defending pokémon do ${m[1]} less damage`],
  [/^durante el próximo turno de tu rival, los ataques hacen (\d+) puntos de daño menos a este pokémon$/, (m) => `during your opponent's next turn, this pokémon takes ${m[1]} less damage from attacks`],
  [/^durante el próximo turno de tu rival, se evitan? todo el daño y todos los efectos de los ataques infligidos a este pokémon$/, () => "during your opponent's next turn, prevent all damage from and effects of attacks done to this pokémon"],
  [/^durante el próximo turno de tu rival, se evita todo el daño infligido a este pokémon por ataques$/, () => "during your opponent's next turn, prevent all damage done to this pokémon by attacks"],
  [/^durante el próximo turno de tu rival, se evita todo el daño infligido a este pokémon por ataques de pokémon (básicos|evolución)$/, (m) => `during your opponent's next turn, prevent all damage done to this pokémon by attacks from ${m[1] === 'básicos' ? 'basic' : 'evolution'} pokémon`],
  [/^durante el próximo turno de tu rival, se evita todo el daño infligido a este pokémon por ataques de pokémon ex$/, () => "during your opponent's next turn, prevent all damage done to this pokémon by attacks from pokémon ex"],
  [/^durante tu próximo turno, este pokémon no puede (?:atacar|usar ataques)$/, () => "during your next turn, this pokémon can't attack"],
  [/^este pokémon no puede (?:atacar|usar ataques) durante tu próximo turno$/, () => "during your next turn, this pokémon can't attack"],
  [/^durante tu próximo turno, este pokémon no puede usar (.+)$/, (m) => `during your next turn, this pokémon can't use ${m[1]}`],
  [/^durante tu próximo turno, los ataques hacen (\d+) puntos de daño más al pokémon defensor$/, (m) => `during your next turn, the defending pokémon takes ${m[1]} more damage from attacks`],

  // — Tanda 593: lo que el lector inglés aprendió en la misma tanda —
  [/^si el pokémon activo de tu rival es un pokémon ex o un pokémon v, este ataque hace (\d+) puntos de daño más$/, (m) => `if your opponent's active pokémon is a pokémon ex or pokémon v, this attack does ${m[1]} more damage`],
  [new RegExp(`^${D} por cada carta de premio que haya cogido tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each prize card your opponent has taken`],
  [new RegExp(`^${D} por cada carta de premio que hayas cogido$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each prize card you have taken`],
  [/^este ataque hace (\d+) puntos de daño menos por cada contador de daño en este pokémon$/, (m) => `this attack does ${m[1]} less damage for each damage counter on this pokémon`],
  [/^antes de infligir daño, descarta todas las herramientas pokémon del pokémon activo de tu rival$/, () => "before doing damage, discard all pokémon tools from your opponent's active pokémon"],
  [new RegExp(`^pon ${N} energías? unidas? a este pokémon en tu mano$`), (m) => `put ${unoA(m[1]) === 'a' ? 'an' : unoA(m[1])} energy attached to this pokémon into your hand`],
  [/^mueve todas las energías de este pokémon a uno de tus pokémon en banca$/, () => 'move all energy from this pokémon to 1 of your benched pokémon'],
  [new RegExp(`^descarta ${N} energía especial del pokémon activo de tu rival$`), (m) => (num(m[1]) === 1 ? "discard a special energy from your opponent's active pokémon" : null)],
  [/^después, roba (\d+) cartas?$/, (m) => `then, draw ${m[1]} cards`],
  [/^(puedes )?robar? cartas hasta (?:que tengas|tener) (\d+) cartas en tu mano$/, (m) => `${m[1] ? 'you may ' : ''}draw cards until you have ${m[2]} cards in your hand`],
  [/^pon las cartas de tu mano en tu baraja y barájalas todas$/, () => 'shuffle your hand into your deck'],
  [/^descarta las cartas de tu mano y roba (\d+) cartas$/, (m) => `discard your hand and draw ${m[1]} cards`],
  [/^descarta las (\d+) primeras cartas de tu baraja$/, (m) => `discard the top ${m[1]} cards of your deck`],
  [/^descarta la primera carta de tu baraja$/, () => 'discard the top card of your deck'],
  [new RegExp(`^descarta ${N} carta aleatoria de la mano de tu rival$`), (m) => (num(m[1]) === 1 ? "discard a random card from your opponent's hand" : null)],
  [new RegExp(`^tu rival descarta ${N} cartas? de su mano$`), (m) => `your opponent discards ${unoA(m[1])} cards from their hand`],
  [new RegExp(`^(puedes )?descartar? ${N} estadio en juego$`), (m) => (num(m[2]) === 1 ? `${m[1] ? 'you may ' : ''}discard a stadium in play` : null)],
  [/^deja fuera de combate al pokémon activo de tu rival$/, () => "knock out your opponent's active pokémon"],
  [/^pon este pokémon y todas las cartas unidas a él en tu baraja, y baraja todas las cartas$/, () => 'shuffle this pokémon and all attached cards into your deck'],
  [new RegExp(`^busca en tu baraja ${N} pokémon básicos? y ponlo en tu banca$`), (m) => (num(m[1]) === 1 ? 'search your deck for a basic pokémon and put it onto your bench' : null)],
  [new RegExp(`^busca en tu baraja (hasta )?${N} (cartas? de (?:partidario|objeto|estadio|herramienta pokémon|energía básica)|pokémon), enséñal[ao]s? y ponl[ao]s? en tu mano$`), (m) => {
    const k = m[3].replace(/^cartas? de /, '')
    const clase = { partidario: 'supporter', objeto: 'item', estadio: 'stadium', 'herramienta pokémon': 'pokémon tool', 'energía básica': 'basic energy', 'pokémon': 'pokémon' }[k]
    if (!clase) return null
    const n = num(m[2])
    const cuantas = m[1] ? `up to ${n}` : n === 1 ? (clase === 'item' ? 'an' : 'a') : null
    if (!cuantas) return null
    return `search your deck for ${cuantas} ${clase}${clase === 'pokémon' ? '' : n === 1 && !m[1] ? ' card' : ' cards'}, reveal ${n === 1 && !m[1] ? 'it' : 'them'}, and put ${n === 1 && !m[1] ? 'it' : 'them'} into your hand`
  }],

  // — Monedas —
  [new RegExp(`^lanza ${N} monedas?( hasta que salga cruz)?$`), (m) => `flip ${unoA(m[1])} coin${num(m[1]) === 1 ? '' : 's'}${m[2] ? ' until you get tails' : ''}`],

  // ── Tanda 625: el repaso del formato entero ──
  [/^lanza 1 moneda por cada energía (?:({[a-z]}) )?unida a este pokémon$/, (m) => `flip a coin for each ${m[1] ? `${m[1]} ` : ''}energy attached to this pokémon`],
  [/^por cada cara, (.+)$/, (m) => {
    const dentro = alIngles(m[1])
    return dentro ? `for each heads, ${dentro}` : null
  }],
  [new RegExp(`^${D} por cada herramienta pokémon unida a (cada uno de tus pokémon|cada pokémon)$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each pokémon tool attached to ${m[3] === 'cada pokémon' ? 'all pokémon' : 'all of your pokémon'}`],
  [new RegExp(`^si este pokémon tiene una herramienta pokémon unida, ${D}$`), (m) => `if this pokémon has a pokémon tool attached, this attack does ${m[1]} more damage`],
  [new RegExp(`^si el pokémon activo de tu rival tiene una herramienta pokémon unida, ${D}$`), (m) => `if your opponent's active pokémon has a pokémon tool attached, this attack does ${m[1]} more damage`],
  [new RegExp(`^si el pokémon activo de tu rival es un pokémon evolución, ${D}$`), (m) => `if your opponent's active pokémon is an evolution pokémon, this attack does ${m[1]} more damage`],
  [new RegExp(`^si el pokémon activo de tu rival es un pokémon teracristal, ${D}$`), (m) => `if your opponent's active pokémon is a tera pokémon, this attack does ${m[1]} more damage`],
  [new RegExp(`^si tienes por lo menos (\\d+) energías? (?:({[a-z]}) )?en juego, ${D}$`), (m) => `if you have at least ${m[1]} ${m[2] ? `${m[2]} ` : ''}energy in play, this attack does ${m[3]} more damage`],
  [new RegExp(`^si tienes (\\d+) energías? (?:({[a-z]}) )?o más en juego, ${D}$`), (m) => `if you have ${m[1]} or more ${m[2] ? `${m[2]} ` : ''}energy in play, this attack does ${m[3]} more damage`],
  [new RegExp(`^${D} por cada uno de tus pokémon en juego$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each of your pokémon in play`],
  [new RegExp(`^${D} por cada energía (especial |{[a-z]} )?unida a cada uno de los pokémon de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each ${m[3] === 'especial ' ? 'special ' : m[3] || ''}energy attached to all of your opponent's pokémon`],
  [new RegExp(`^si a tu rival le quedan (\\d+) cartas de premio o menos, ${D}$`), (m) => `if your opponent has ${m[1]} or fewer prize cards remaining, this attack does ${m[2]} more damage`],
  [new RegExp(`^si a tu rival le quedan exactamente (\\d+) o (\\d+) cartas de premio, ${D}$`), (m) => `if your opponent has exactly ${m[1]} or ${m[2]} prize cards remaining, this attack does ${m[3]} more damage`],
  [new RegExp(`^si te quedan más cartas de premio que a tu rival, ${D}$`), (m) => `if you have more prize cards remaining than your opponent, this attack does ${m[1]} more damage`],
  [new RegExp(`^si te quedan? exactamente (\\d+) cartas? de premio, ${D}$`), (m) => `if you have exactly ${m[1]} prize cards remaining, this attack does ${m[2]} more damage`],
  [new RegExp(`^si tu rival tiene (\\d+) cartas o menos en su mano, ${D}$`), (m) => `if your opponent has ${m[1]} or fewer cards in their hand, this attack does ${m[2]} more damage`],
  [/^este ataque hace (\d+) puntos de daño menos por cada {c} en el coste de retirada del pokémon activo de tu rival$/, (m) => `this attack does ${m[1]} less damage for each {c} in your opponent's active pokémon's retreat cost`],
  [new RegExp(`^si este pokémon no tiene ningún contador de daño sobre él, ${D}$`), (m) => `if this pokémon has no damage counters on it, this attack does ${m[1]} more damage`],
  [new RegExp(`^si este pokémon tiene (\\d+) contadores de daño o más sobre él, ${D}$`), (m) => `if this pokémon has ${m[1]} or more damage counters on it, this attack does ${m[2]} more damage`],
  [new RegExp(`^si este pokémon y el pokémon activo de tu rival tienen la misma cantidad de energías unidas, ${D}$`), (m) => `if this pokémon and your opponent's active pokémon have the same amount of energy attached, this attack does ${m[1]} more damage`],
  [new RegExp(`^${D} por cada condición especial que afecte al pokémon activo de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each special condition affecting your opponent's active pokémon`],
  [new RegExp(`^si el pokémon activo de tu rival no está ${EST}, este ataque no hace nada$`), (m) => `if your opponent's active pokémon isn't ${ESTADO[m[1]]}, this attack does nothing`],
  [new RegExp(`^${D} por cada contador de daño en cada uno de los pokémon de tu rival$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each damage counter on all of your opponent's pokémon`],
  [new RegExp(`^si tienes algún pokémon (teracristal|{[a-z]})?( de fase 2)? en tu banca, ${D}$`), (m) => `if you have any ${m[2] ? 'stage 2 ' : ''}${m[1] === 'teracristal' ? 'tera ' : m[1] ? `${m[1]} ` : ''}pokémon on your bench, this attack does ${m[3]} more damage`],
  [new RegExp(`^si hay (\\d+) cartas o menos en tu baraja, ${D}$`), (m) => `if there are ${m[1]} or fewer cards in your deck, this attack does ${m[2]} more damage`],
  [new RegExp(`^si hay un pokémon en tu banca que tenga "(.+?)" en su nombre, ${D}$`), (m) => `if a pokémon that has "${m[1]}" in its name is on your bench, this attack does ${m[2]} more damage`],
  [new RegExp(`^si (.+?) están? en tu banca, ${D}$`), (m) => `if ${m[1].replace(/ y /g, ' and ')} ${/ y /.test(m[1]) ? 'are' : 'is'} on your bench, this attack does ${m[2]} more damage`],
  [/^si no tienes exactamente (\d+) cartas en tu mano, este ataque no hace nada$/, (m) => `if you don't have exactly ${m[1]} cards in your hand, this attack does nothing`],
  [/^si tienes (\d+) pokémon en banca o menos, este ataque no hace nada$/, (m) => `if you have ${m[1]} or fewer benched pokémon, this attack does nothing`],
  [new RegExp(`^si tienes la misma cantidad de cartas en tu mano que tu rival, ${D}$`), (m) => `if you have the same number of cards in your hand as your opponent, this attack does ${m[1]} more damage`],
  [/^si no tienes la misma cantidad de cartas en tu mano que tu rival, este ataque no hace nada$/, () => "if you don't have the same number of cards in your hand as your opponent, this attack does nothing"],
  [new RegExp(`^${D} por cada carta que hayas descartado de esta manera$`), (m) => `this attack does ${m[1]} ${mas(m[2])}damage for each card you discarded in this way`],
  [/^descarta hasta (\d+) (?:cartas de energía|energías) (?:({[a-z]}) )?de tus pokémon$/, (m) => `discard up to ${m[1]} ${m[2] ? `${m[2]} ` : ''}energy cards from your pokémon`],
  [/^descarta hasta (\d+) (?:cartas de energía|energías) (?:({[a-z]}) )?de este pokémon$/, (m) => `discard up to ${m[1]} ${m[2] ? `${m[2]} ` : ''}energy from this pokémon`],
  [new RegExp(`^descarta hasta (\\d+) cartas de energía (?:({[a-z]}) )?(básica )?de tu mano, y ${D} por cada carta que hayas descartado de esta manera$`), (m) => `discard up to ${m[1]} ${m[3] ? 'basic ' : ''}${m[2] ? `${m[2]} ` : ''}energy cards from your hand, and this attack does ${m[4]} ${mas(m[5])}damage for each card you discarded in this way`],
  [new RegExp(`^descarta hasta (\\d+) cartas de energía de este pokémon, y ${D} por cada carta que hayas descartado de esta manera$`), (m) => `discard up to ${m[1]} energy cards from this pokémon, and this attack does ${m[2]} ${mas(m[3])}damage for each card you discarded in this way`],
  [/^descarta (\d+) cartas de energía ({[a-z]}) básica de tu mano$/, (m) => `discard ${m[1]} basic ${m[2]} energy cards from your hand`],
  [/^descarta (\d+) cartas de energía ({[a-z]}) básica de tu mano y deja fuera de combate al pokémon activo de tu rival$/, (m) => `discard ${m[1]} basic ${m[2]} energy cards from your hand, and knock out your opponent's active pokémon`],
  [/^si no puedes descartar (\d+) cartas de esta manera, este ataque no hace nada$/, (m) => `if you can't discard ${m[1]} cards in this way, this attack does nothing`],
  [/^este ataque hace (\d+) puntos de daño a cada uno de los pokémon( ex)? de tu rival$/, (m) => `this attack does ${m[1]} damage to each of your opponent's pokémon${m[2] ? ' ex' : ''}`],
  [/^este ataque hace (\d+) puntos de daño a (\d+) de los pokémon de tu rival$/, (m) => `this attack does ${m[1]} damage to ${m[2]} of your opponent's pokémon`],
  [/^este ataque hace (\d+) puntos de daño a uno de los pokémon ex en banca o (?:de los )?pokémon v en banca de tu rival$/, (m) => `this attack does ${m[1]} damage to 1 of your opponent's benched pokémon ex or benched pokémon v`],
  [/^este ataque hace (\d+) puntos de daño a uno de los pokémon (en banca )?de tu rival por cada energía (?:({[a-z]}) )?unida a este pokémon$/, (m) => `this attack does ${m[1]} damage to 1 of your opponent's ${m[2] ? 'benched ' : ''}pokémon for each ${m[3] ? `${m[3]} ` : ''}energy attached to this pokémon`],
  [/^este ataque hace (\d+) puntos de daño a uno de los pokémon (en banca )?de tu rival por cada contador de daño en este pokémon$/, (m) => `this attack does ${m[1]} damage to 1 of your opponent's ${m[2] ? 'benched ' : ''}pokémon for each damage counter on this pokémon`],
  [/^descarta (todas las|\d+|una) energías? (?:({[a-z]}) )?de este pokémon, y este ataque hace (\d+) puntos de daño a uno de los pokémon de tu rival$/, (m) => `discard ${m[1] === 'todas las' ? 'all' : unoA(m[1])} ${m[2] ? `${m[2]} ` : ''}energy from this pokémon, and this attack does ${m[3]} damage to 1 of your opponent's pokémon`],
  [/^pon (\d+) contadores de daño en cada uno de los pokémon de tu rival que tenga algún contador de daño sobre él$/, (m) => `put ${m[1]} damage counters on each of your opponent's pokémon that has any damage counters on it`],
  [/^pon (\d+) contadores de daño en los pokémon (en banca )?de tu rival de la manera que desees$/, (m) => `put ${m[1]} damage counters on your opponent's ${m[2] ? 'benched ' : ''}pokémon in any way you like`],
  [new RegExp(`^(puedes )?(?:pon|poner) ${N} energías? unidas? al pokémon activo de tu rival en su mano$`), (m) => `${m[1] ? 'you may ' : ''}put ${num(m[2]) === 1 ? 'an' : num(m[2])} energy attached to your opponent's active pokémon into their hand`],
  [/^durante tu próximo turno, este pokémon no puede retirarse$/, () => "during your next turn, this pokémon can't retreat"],
  [/^cura a este pokémon la misma cantidad de puntos de daño que hayas infligido al pokémon activo de tu rival$/, () => "heal from this pokémon the same amount of damage you did to your opponent's active pokémon"],
  [/^cura (\d+) puntos de daño a uno de tus pokémon en banca$/, (m) => `heal ${m[1]} damage from 1 of your benched pokémon`],
  [/^cura todos los puntos de daño a uno de tus pokémon en banca$/, () => 'heal all damage from 1 of your benched pokémon'],
  [/^cura (\d+) puntos de daño a cada uno de tus pokémon en banca$/, (m) => `heal ${m[1]} damage from each of your benched pokémon`],
  [new RegExp(`^este ataque también hace (\\d+) puntos de daño a ${N} de tus pokémon en banca$`), (m) => `this attack also does ${m[1]} damage to ${num(m[2])} of your benched pokémon`],
  [/^durante tu próximo turno, el ataque (.+?) de este pokémon hace (\d+) puntos de daño más$/, (m) => `during your next turn, this pokémon's ${m[1]} attack does ${m[2]} more damage`],
  [/^durante tu próximo turno, los ataques usados por este pokémon hacen (\d+) puntos de daño más al pokémon activo de tu rival$/, (m) => `during your next turn, attacks used by this pokémon do ${m[1]} more damage to your opponent's active pokémon`],
  [/^si sales en primer lugar, puedes usar este ataque durante tu primer turno$/, () => 'if you go first, you can use this attack during your first turn'],
  [/^busca en tu baraja 1 carta que evolucione de este pokémon y ponla sobre este pokémon para hacerlo evolucionar$/, () => 'search your deck for a card that evolves from this pokémon and put it onto this pokémon to evolve it'],
  [new RegExp(`^descarta ${N} carta de tu mano$`), (m) => (num(m[1]) === 1 ? 'discard a card from your hand' : null)],
  [new RegExp(`^si lo haces, roba ${N} cartas?$`), (m) => `if you do, draw ${num(m[1])} cards`],
  [/^tu rival enseña las cartas de su mano$/, () => 'your opponent reveals their hand'],
  [new RegExp(`^pon (hasta \\d+|${N.slice(1, -1)}) (pokémon|cartas? de partidario|cartas? de objeto|cartas? de energía básica|cartas? de energía ({[a-z]}) básica) de tu pila de descartes en tu mano$`), (m) => {
    const hasta = /^hasta/.test(m[1])
    const n = hasta ? Number(m[1].replace(/\D/g, '')) : num(m[1])
    const clase = m[2] === 'pokémon' ? 'pokémon' : /partidario/.test(m[2]) ? 'supporter card' : /objeto/.test(m[2]) ? 'item card' : m[3] ? `basic ${m[3]} energy card` : 'basic energy card'
    const plural = clase === 'pokémon' ? clase : n === 1 && !hasta ? clase : `${clase}s`
    return `put ${hasta ? `up to ${n}` : n === 1 ? (clase === 'item card' ? 'an' : 'a') : n} ${plural} from your discard pile into your hand`
  }],
  [new RegExp(`^busca en tu baraja (hasta \\d+|${N.slice(1, -1)}) cartas? de energía (?:({[a-z]}) )?básica y únel[ao]s? a (este pokémon|uno de tus pokémon)$`), (m) => {
    const hasta = /^hasta/.test(m[1])
    const n = hasta ? Number(m[1].replace(/\D/g, '')) : num(m[1])
    const cuantas = hasta ? `up to ${n}` : 'a'
    return `search your deck for ${cuantas} basic ${m[2] ? `${m[2]} ` : ''}energy card${hasta ? 's' : ''} and attach ${hasta ? 'them' : 'it'} to ${m[3] === 'este pokémon' ? 'this pokémon' : '1 of your pokémon'}`
  }],
  [/^busca en tu baraja hasta (\d+) cartas de energía (?:({[a-z]}) )?básica y únelas a tus pokémon (en banca )?de la manera que desees$/, (m) => `search your deck for up to ${m[1]} basic ${m[2] ? `${m[2]} ` : ''}energy cards and attach them to your ${m[3] ? 'benched ' : ''}pokémon in any way you like`],
  [/^busca en tu baraja 1 carta de energía (?:({[a-z]}) )?y únela a uno de tus pokémon (?:({[a-z]}) )?en banca$/, (m) => `search your deck for an ${m[1] ? `${m[1]} ` : ''}energy card and attach it to 1 of your benched ${m[2] ? `${m[2]} ` : ''}pokémon`],
  [/^une (1|hasta \d+) cartas? de energía (?:({[a-z]}) )?básica de tu pila de descartes a (uno de tus pokémon en banca|tus pokémon en banca de la manera que desees|tus pokémon de la manera que desees)$/, (m) => `attach ${m[1] === '1' ? 'a' : `up to ${m[1].replace(/\D/g, '')}`} basic ${m[2] ? `${m[2]} ` : ''}energy card${m[1] === '1' ? '' : 's'} from your discard pile to ${m[3] === 'uno de tus pokémon en banca' ? '1 of your benched pokémon' : m[3] === 'tus pokémon en banca de la manera que desees' ? 'your benched pokémon in any way you like' : 'your pokémon in any way you like'}`],
  [/^une 1 carta de energía (?:({[a-z]}) )?básica de tu mano a uno de tus pokémon en banca$/, (m) => `attach a basic ${m[1] ? `${m[1]} ` : ''}energy card from your hand to 1 of your benched pokémon`],
  [/^durante el próximo turno de tu rival, si el pokémon defensor intenta usar un ataque, tu rival lanza 1 moneda$/, () => "during your opponent's next turn, if the defending pokémon tries to use an attack, your opponent flips a coin"],
  [/^si sale cruz, ese ataque no se lleva a cabo$/, () => "if tails, that attack doesn't happen"],
  [/^este ataque hace (\d+) puntos de daño al nuevo pokémon activo$/, (m) => `this attack does ${m[1]} damage to the new active pokémon`],
  [/^puedes hacer (\d+) puntos de daño más$/, (m) => `you may do ${m[1]} more damage`],
  [/^si lo haces, este pokémon también se hace (\d+) puntos de daño a s[ií] mismo$/, (m) => `if you do, this pokémon also does ${m[1]} damage to itself`],
]

// La frase inglesa de una frase española, o null si no se reconoce. «Si
// sale cara, …» se traduce por dentro: la rama es otra frase entera.
export function alIngles(frase) {
  const f = String(frase || '').trim()
  const rama = f.match(/^si sale (cara|cruz), (.+)$/)
  if (rama) {
    const dentro = alIngles(rama[2])
    if (dentro) return `if ${rama[1] === 'cara' ? 'heads' : 'tails'}, ${dentro}`
    // Si la rama no se entiende sola, puede ser una frase entera que
    // empieza así («Si sale cruz, ese ataque no se lleva a cabo»).
  }
  for (const [re, hacer] of TRADUCIR) {
    const m = f.match(re)
    if (m) {
      const en = hacer(m)
      if (en) return en
    }
  }
  return null
}

// ── Las habilidades que se aplican solas ──
//
// Lo mismo para los rasgos de textos.js (`leerHabilidad`): cada frase
// española, a la inglesa que ya se sabe leer.
function claseBono(x) {
  // «{G} y Pokémon {R}» son dos clases; «{R} Evolución» es una con dos
  // condiciones, que en inglés va al revés («Evolution {R}»).
  return String(x || '')
    .split(/ y pokémon /)
    .map((t) => {
      const m = t.trim().match(/^({[a-z]}) (evolución|básicos)$/)
      return m ? `${CLASE[m[2]]} ${m[1]}` : clase(t)
    })
    .join(' pokémon and ')
}

const TRADUCIR_HABILIDAD = [
  [/^los ataques hacen (\d+) puntos de daño menos a este pokémon$/, (m) => `this pokémon takes ${m[1]} less damage from attacks`],
  [/^se evita todo el daño infligido a este pokémon por ataques de los pokémon ex de tu rival$/, () => "prevent all damage done to this pokémon by attacks from your opponent's pokémon ex"],
  [/^se evita todo el daño infligido a este pokémon por ataques de los pokémon (básicos|evolución) de tu rival$/, (m) => `prevent all damage done to this pokémon by attacks from your opponent's ${m[1] === 'básicos' ? 'basic' : 'evolution'} pokémon`],
  [/^se evita todo el daño infligido a este pokémon por ataques de los pokémon de tu rival que tengan una habilidad$/, () => "prevent all damage from attacks done to this pokémon by your opponent's pokémon that have an ability"],
  [/^se evita todo el daño infligido a tus pokémon en banca que no tengan un recuadro de regla por ataques de los pokémon de tu rival$/, () => "prevent all damage done to your benched pokémon that don't have a rule box by attacks from your opponent's pokémon"],
  [/^se evitan todo el daño y todos los efectos de los ataques de los pokémon de tu rival infligidos a tus pokémon en banca$/, () => "prevent all damage from and effects of attacks from your opponent's pokémon done to your benched pokémon"],
  [/^se evitan todos los efectos de los ataques y las habilidades de los pokémon de tu rival infligidos a este pokémon$/, () => "prevent all effects of your opponent's pokémon's attacks and abilities done to this pokémon"],
  [/^se evitan todos los efectos de los ataques usados por los pokémon de tu rival e infligidos a este pokémon$/, () => "prevent all effects of attacks used by your opponent's pokémon done to this pokémon"],
  [/^se evitan todos los efectos de los ataques usados por los pokémon de tu rival e infligidos a tus pokémon (.+?) básicos$/, (m) => `prevent all effects of attacks used by your opponent's pokémon done to your basic ${clase(m[1])} pokémon`],
  [/^mientras tengas por lo menos a otro (.+?) en juego, los ataques de los pokémon de tu rival hacen (\d+) puntos de daño menos a todos tus pokémon {c} básicos$/, (m) => `as long as you have at least 1 other ${m[1]} in play, all of your basic {c} pokémon take ${m[2]} less damage from attacks from your opponent's pokémon`],
  [/^el coste de retirada del pokémon activo de tu rival es de {c} más$/, () => "your opponent's active pokémon's retreat cost is {c} more"],
  [/^mientras este pokémon esté en el puesto activo, tu rival no puede jugar ninguna carta de objeto( ni de herramienta pokémon)? de su mano$/, (m) => `as long as this pokémon is in the active spot, your opponent can't play any item cards${m[1] ? ' or pokémon tool cards' : ''} from their hand`],
  [/^mientras este pokémon esté en el puesto activo, el pokémon activo de tu rival no tiene ninguna habilidad, excepto (.+)$/, (m) => `as long as this pokémon is in the active spot, your opponent's active pokémon has no abilities, except for ${m[1]}`],
  [/^mientras este pokémon esté en el puesto activo, pon (\d+) contadores de daño más en los pokémon envenenados de tu rival durante el chequeo pokémon$/, (m) => `as long as this pokémon is in the active spot, put ${m[1]} more damage counters on your opponent's poisoned pokémon during pokémon checkup`],
  [/^los ataques usados por tus pokémon (.+?)(?:, excepto los de (.+?),)? hacen (\d+) puntos de daño más al pokémon activo de tu rival$/, (m) => `attacks used by your ${claseBono(m[1])} pokémon${m[2] ? `, except any ${m[2]},` : ''} do ${m[3]} more damage to your opponent's active pokémon`],
  [/^si este pokémon queda fuera de combate por el daño de un ataque de los pokémon de tu rival, lanza 1 moneda$/, () => "if this pokémon is knocked out by damage from an attack from your opponent's pokémon, flip a coin"],
  [/^si sale cara, el pokémon atacante queda fuera de combate$/, () => 'if heads, the attacking pokémon is knocked out'],
  [/^si este pokémon está en el puesto activo y queda fuera de combate por el daño de un ataque de los pokémon de tu rival, pon (\d+) contadores de daño en el pokémon atacante$/, (m) => `if this pokémon is in the active spot and is knocked out by damage from an attack from your opponent's pokémon, put ${m[1]} damage counters on the attacking pokémon`],
  [/^si uno de tus pokémon ({[a-z]}) queda fuera de combate por el daño de un ataque de los pokémon ex de tu rival, ese jugador coge 1 carta de premio menos$/, (m) => `if 1 of your ${m[1]} pokémon is knocked out by damage from an attack from your opponent's pokémon ex, that player takes 1 fewer prize card`],
  [/^la debilidad de cada uno de los pokémon ({[a-z]}) en juego de tu rival pasa a ser ({[a-z]})$/, (m) => `the weakness of each of your opponent's ${m[1]} pokémon in play is now ${m[2]}`],
  [/^este pokémon no puede atacar a menos que tengas (\d+) pokémon (.+?) o más en juego$/, (m) => `this pokémon can't attack unless you have ${m[1]} or more ${clase(m[2])} pokémon in play`],
  [/^si este pokémon tiene una herramienta pokémon unida, tu rival no puede jugar ninguna carta de as táctico de su mano$/, () => "if this pokémon has a pokémon tool attached, your opponent can't play any ace spec cards from their hand"],
  [/^los contadores de daño de cada pokémon no se pueden mover a otro pokémon$/, () => "damage counters on each pokémon can't be moved to other pokémon"],
  // Tanda 625.
  [/^si este pokémon tiene todos sus ps y fuese a quedar fuera de combate por el daño de un ataque, no queda fuera de combate y sus ps restantes pasan a ser 10$/, () => 'if this pokémon has full hp and would be knocked out by damage from an attack, it is not knocked out, and its remaining hp becomes 10'],
  [/^mientras este pokémon esté en tu banca, se evitan todo el daño y todos los efectos de los ataques de los pokémon de tu rival infligidos a este pokémon$/, () => "as long as this pokémon is on your bench, prevent all damage from and effects of attacks from your opponent's pokémon done to this pokémon"],
  [/^mientras este pokémon esté en tu banca, se evita todo el daño infligido a este pokémon por ataques de los pokémon de tu rival$/, () => "as long as this pokémon is on your bench, prevent all damage done to this pokémon by attacks from your opponent's pokémon"],
  [/^el pokémon activo de tu rival no puede ser curado$/, () => "your opponent's active pokémon can't be healed"],
  [/^este pokémon no puede pasar a estar (dormido|quemado|confundido|paralizado|envenenado)$/, (m) => `this pokémon can't be ${{ dormido: 'asleep', quemado: 'burned', confundido: 'confused', paralizado: 'paralyzed', envenenado: 'poisoned' }[m[1]]}`],
  [/^este pokémon no puede verse afectado por ninguna condición especial$/, () => "this pokémon can't be affected by any special conditions"],
  [/^si tu rival tiene alguna carta en su pila de descartes que tenga "(.+?)" en el nombre, este pokémon puede usar el ataque (.+?) por (?:colorless|{c})$/, (m) => `if your opponent has any cards in their discard pile that have "${m[1]}" in the name, this pokémon can use the ${m[2]} attack for {c}`],
]

export function alInglesHabilidad(frase) {
  const f = String(frase || '').trim().replace(/\s+/g, ' ')
  for (const [re, hacer] of TRADUCIR_HABILIDAD) {
    const m = f.match(re)
    if (m) return hacer(m)
  }
  return null
}
