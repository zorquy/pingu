// Los efectos que se leen del TEXTO de la carta (tanda 462).
//
// efectos.js escribe a mano lo que hace cada carta del meta, una por una,
// y lo que no está ahí se jugaba «a mano». Pero la inmensa mayoría de los
// ataques dicen lo mismo con las mismas palabras: «Your opponent's Active
// Pokémon is now Confused», «During your opponent's next turn, they can't
// play any Item cards from their hand», «This Pokémon also does 30 damage
// to itself»… Son plantillas de la propia carta (el espejo guarda el texto
// en inglés, que es donde no cambian), así que se pueden LEER: este módulo
// convierte el texto en pasos y la partida los ejecuta.
//
// La regla que manda: TODO O NADA. Si una sola frase del ataque no se
// entiende, el ataque entero se queda como estaba (a mano, o preguntando
// el daño). Aplicar la mitad de un efecto sería peor que no aplicar
// ninguno: el jugador creería que la carta ya ha hecho lo suyo.
//
// Sin DOM y sin importar la partida (es ella la que importa esto): así se
// prueba en Node, frase por frase.
//
// Y en ESPAÑOL (tanda 593): desde la 330 el engorde guarda el texto en
// español siempre que TCGdex lo tiene, así que las frases pasan antes por
// textos-es.js, que las convierte en su plantilla inglesa.
import { alIngles, alInglesHabilidad } from './textos-es.js'

// ── Normalizar ──
//
// Minúsculas, el apóstrofo recto, los símbolos de energía como {x}
// («[M] Energy» y «M Energy» conviven en el espejo) y FUERA los paréntesis:
// son recordatorios («(Don't apply Weakness and Resistance for Benched
// Pokémon.)», «(after applying Weakness and Resistance)») y no cambian lo
// que hace la carta.
// El símbolo de energía a veces llega como el HTML de TCGdex
// («<span class="energy-symbol fire" title="fuego">fire</span>»).
const LETRA_DE_TIPO = { grass: 'g', fire: 'r', water: 'w', lightning: 'l', psychic: 'p', fighting: 'f', darkness: 'd', metal: 'm', colorless: 'c', fairy: 'y', dragon: 'n' }
export function normalizarTexto(t) {
  return String(t || '')
    .replace(/<span[^>]*class="energy-symbol (\w+)"[^>]*>[^<]*<\/span>/gi, (x, tipo) => (LETRA_DE_TIPO[tipo.toLowerCase()] ? `{${LETRA_DE_TIPO[tipo.toLowerCase()]}}` : x))
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/\[([a-z])\]/g, '{$1}')
    .replace(/\b([grwlpfdmc]) energy\b/g, '{$1} energy')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.])/g, '$1')
    .trim()
}

export function frases(t) {
  return normalizarTexto(t)
    .split(/\.\s*/)
    .map((f) => f.trim().replace(/[.;:,]+$/, ''))
    .filter(Boolean)
}

const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }
const num = (x) => (x == null ? null : /^\d+$/.test(x) ? Number(x) : NUM[x] ?? null)
const ESTADO = { asleep: 'dormido', burned: 'quemado', confused: 'confundido', paralyzed: 'paralizado', poisoned: 'envenenado' }
const LETRA = (x) => (x ? x.replace(/[{}]/g, '').toUpperCase() : null)

// ── Las frases de un ATAQUE ──
//
// Cada entrada: [expresión, constructor]. El constructor recibe el
// resultado del `match` y devuelve el paso (o una lista de pasos). Los
// pasos de daño llevan `calc: true`: se resuelven ANTES de hacer el daño;
// el resto, después, en el orden de la carta.
const FRASES_ATAQUE = [
  // — El daño —
  [/^this attack does (\d+) more damage$/, (m) => ({ t: 'mas', n: +m[1], calc: true })],
  [/^this attack does nothing$/, () => ({ t: 'nada', calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each damage counter on your opponent's active pokémon$/, (m) => ({ t: 'porContadoresRival', n: +m[1], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each damage counter on this pokémon$/, (m) => ({ t: 'porContadoresPropio', n: +m[1], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each energy attached to your opponent's active pokémon$/, (m) => ({ t: 'porEnergiaRival', n: +m[1], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each energy attached to this pokémon$/, (m) => ({ t: 'porEnergiaPropia', n: +m[1], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each {([a-z])} energy attached to (this pokémon|all of your pokémon)$/, (m) => ({ t: 'porEnergiaTipo', n: +m[1], letra: LETRA(m[2]), todos: m[3] !== 'this pokémon', calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each card in your opponent's hand$/, (m) => ({ t: 'porManoRival', n: +m[1], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each card in your hand$/, (m) => ({ t: 'porManoPropia', n: +m[1], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each {c} in your opponent's active pokémon's retreat cost$/, (m) => ({ t: 'porRetiradaRival', n: +m[1], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each of your benched pokémon$/, (m) => ({ t: 'porBanca', n: +m[1], de: 'propia', calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each of your opponent's benched pokémon$/, (m) => ({ t: 'porBanca', n: +m[1], de: 'rival', calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each benched pokémon$/, (m) => ({ t: 'porBanca', n: +m[1], de: 'ambas', calc: true })],
  // «Ancient»/«Future» son marcas que el espejo no guarda: no se sabe
  // contarlas, y contar cero sería inventarse el daño.
  [/^this attack does (\d+) (?:more )?damage for each of your (.+?) pokémon in play$/, (m) => (/^(ancient|future)$/.test(m[2]) ? null : { t: 'porEnJuegoDe', n: +m[1], dueno: m[2], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each basic energy card in your opponent's discard pile$/, (m) => ({ t: 'porEnergiaDescarteRival', n: +m[1], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each (supporter|item|pokémon|energy) card that has "(.+?)" in its name in your discard pile$/, (m) => ({ t: 'porDescartePropio', n: +m[1], clase: m[2], contiene: m[3], calc: true })],
  [/^this attack does (\d+) (?:more )?damage for each (pokémon|supporter|item|energy) (?:card )?in your discard pile$/, (m) => ({ t: 'porDescartePropio', n: +m[1], clase: m[2], calc: true })],
  [/^if your opponent's active pokémon is a pokémon ex, this attack does (\d+) more damage$/, (m) => ({ t: 'siRivalEx', n: +m[1], calc: true })],
  [/^if your opponent's active pokémon is a pokémon ex or pokémon v, this attack does (\d+) more damage$/, (m) => ({ t: 'siRivalEx', n: +m[1], v: true, calc: true })],
  [/^this attack does (\d+) (more )?damage for each prize card (your opponent has|you have) taken$/, (m) => ({ t: 'porPremios', n: +m[1], de: m[3] === 'you have' ? 'propio' : 'rival', calc: true })],
  [/^this attack does (\d+) less damage for each damage counter on this pokémon$/, (m) => ({ t: 'menosPorContadoresPropio', n: +m[1], calc: true })],
  [/^before doing damage, discard all pokémon tools from your opponent's active pokémon$/, () => ({ t: 'quitarHerramientasRival', calc: true })],
  [/^if your opponent's active pokémon is a (basic|stage 1|stage 2) pokémon, this attack does (\d+) more damage$/, (m) => ({ t: 'siRivalFase', fase: m[1] === 'basic' ? 0 : +m[1].slice(-1), n: +m[2], calc: true })],
  [/^if your opponent's active pokémon is an? {([a-z])} pokémon, this attack does (\d+) more damage$/, (m) => ({ t: 'siRivalTipo', letra: LETRA(m[1]), n: +m[2], calc: true })],
  [/^if your opponent's active pokémon (?:already )?has any damage counters on it, this attack does (\d+) more damage$/, (m) => ({ t: 'siRivalDanado', n: +m[1], calc: true })],
  [/^if this pokémon has any damage counters on it, this attack does (\d+) more damage$/, (m) => ({ t: 'siPropioDanado', n: +m[1], calc: true })],
  [/^if your opponent's active pokémon is (asleep|burned|confused|paralyzed|poisoned), this attack does (\d+) more damage$/, (m) => ({ t: 'siRivalEstado', estado: ESTADO[m[1]], n: +m[2], calc: true })],
  [/^if your opponent's active pokémon is affected by a special condition, this attack does (\d+) more damage$/, (m) => ({ t: 'siRivalEstado', estado: null, n: +m[1], calc: true })],
  [/^if your benched pokémon have any damage counters on them, this attack does (\d+) more damage$/, (m) => ({ t: 'siBancaDanada', n: +m[1], calc: true })],
  [/^if this pokémon moved from your bench to the active spot this turn, this attack does (\d+) more damage$/, (m) => ({ t: 'siSubioEsteTurno', n: +m[1], calc: true })],
  [/^if this pokémon has at least (\d+) extra energy attached, this attack does (\d+) more damage$/, (m) => ({ t: 'siEnergiaExtra', extra: +m[1], n: +m[2], calc: true })],
  [/^if this pokémon has at least (\d+) extra energy attached, this attack also does (\d+) damage to 1 of your opponent's benched pokémon$/, (m) => ({ t: 'siEnergiaExtraBanca', extra: +m[1], n: +m[2] })],
  [/^if this pokémon has any (.+? energy) attached, this attack does (\d+) more damage$/, (m) => ({ t: 'siTieneEnergia', nombre: m[1], n: +m[2], calc: true })],
  [/^if a stadium is in play, this attack does (\d+) more damage$/, (m) => ({ t: 'siEstadio', n: +m[1], calc: true })],
  [/^then, discard that stadium$/, () => ({ t: 'descartarEstadio' })],
  [/^if there is no stadium in play, this attack does nothing$/, () => ({ t: 'nadaSinEstadio', calc: true })],
  [/^if you don't have (.+?) on your bench, this attack does nothing$/, (m) => ({ t: 'nadaSinEnBanca', nombre: m[1], calc: true })],
  [/^if your opponent doesn't have exactly (\d+) or (\d+) prize cards remaining, this attack does nothing$/, (m) => ({ t: 'nadaSalvoPremios', premios: [+m[1], +m[2]], calc: true })],
  [/^if you have (\d+) or more pokémon that have the (.+?) ability in your discard pile, this attack does (\d+) more damage$/, (m) => ({ t: 'siDescarteConHabilidad', cuantos: +m[1], habilidad: m[2], n: +m[3], calc: true })],
  [/^if you have (\d+) or more pokémon that have the (.+?) ability in your discard pile, (?:put|place) (\d+) damage counters on each of your opponent's pokémon$/, (m) => ({ t: 'siDescarteConHabilidadContadores', cuantos: +m[1], habilidad: m[2], n: +m[3] })],
  [/^if any of your (?:(.+?) )?pokémon were knocked out by damage from an attack during your opponent's last turn, this attack does (\d+) more damage$/, (m) => ({ t: 'siKOUltimoTurno', dueno: m[1] || null, n: +m[2], calc: true })],
  [/^this attack's damage isn't affected by weakness or resistance, or by any effects on your opponent's active pokémon$/, () => [{ t: 'sinDR', calc: true }, { t: 'ignoraEfectos', calc: true }]],
  [/^this attack's damage isn't affected by weakness or resistance$/, () => ({ t: 'sinDR', calc: true })],
  [/^this attack's damage isn't affected by weakness$/, () => ({ t: 'sinDebilidad', calc: true })],
  [/^this attack's damage isn't affected by resistance$/, () => ({ t: 'sinResistencia', calc: true })],
  [/^this attack's damage isn't affected by any effects on your opponent's active pokémon$/, () => ({ t: 'ignoraEfectos', calc: true })],
  [/^you may discard (all|an?|\d+) (?:{([a-z])} )?energy from this pokémon and have this attack do (\d+) more damage$/, (m) => ({ t: 'opcionalDescartar', cuantas: m[1] === 'all' ? 'todas' : num(m[1]), letra: LETRA(m[2]), n: +m[3], calc: true })],
  [/^you may put an? (?:{([a-z])} )?energy attached to this pokémon into your hand and have this attack do (\d+) more damage$/, (m) => ({ t: 'opcionalEnergiaAMano', letra: LETRA(m[1]), n: +m[2], calc: true })],
  [/^you may discard (\d+) (?:{([a-z])} )?energy from this pokémon and make your opponent's active pokémon (asleep|burned|confused|paralyzed|poisoned)$/, (m) => ({ t: 'opcionalDescartarEstado', cuantas: +m[1], letra: LETRA(m[2]), estado: ESTADO[m[3]] })],
  [/^this attack does (\d+) damage to 1 of your opponent's (benched )?pokémon$/, (m) => ({ t: 'danioAUno', n: +m[1], soloBanca: !!m[2], calc: true })],

  // — Lo que se puede o no se puede usar —
  [/^you can use this attack only if you go second, and only during your first turn$/, () => ({ t: 'soloSegundoPrimerTurno', puede: true })],

  // — Estados —
  [/^your opponent's active pokémon is now (asleep|burned|confused|paralyzed|poisoned)(?:,? and (asleep|burned|confused|paralyzed|poisoned))?$/, (m) => ({ t: 'estadoRival', estados: [ESTADO[m[1]], ESTADO[m[2]]].filter(Boolean).sort() })],
  [/^this pokémon is now (asleep|burned|confused|paralyzed|poisoned)$/, (m) => ({ t: 'estadoPropio', estado: ESTADO[m[1]] })],
  [/^this pokémon recovers from all special conditions$/, () => ({ t: 'curarEstadosPropio' })],

  // — Daño a otros —
  [/^this pokémon also does (\d+) damage to itself$/, (m) => ({ t: 'danioPropio', n: +m[1] })],
  [/^this attack (?:also )?does (\d+) damage to (1|2|each) of your opponent's benched pokémon$/, (m) => ({ t: 'bancaRival', n: +m[1], cuantos: m[2] === 'each' ? 'cada' : +m[2] })],
  [/^this attack also does (\d+) damage to each of your benched pokémon$/, (m) => ({ t: 'bancaPropia', n: +m[1] })],
  [/^(?:put|place) (\d+|a|an|one) damage counters? on your opponent's active pokémon$/, (m) => ({ t: 'contadoresActivo', n: num(m[1]) })],
  [/^(?:put|place) (\d+|a|an|one) damage counters? on each of your opponent's pokémon$/, (m) => ({ t: 'contadoresCada', n: num(m[1]) })],
  [/^(?:put|place) (\d+|a|an|one) damage counters? on 1 of your opponent's (benched )?pokémon$/, (m) => ({ t: 'contadoresUno', n: num(m[1]), soloBanca: !!m[2] })],
  [/^both active pokémon are knocked out$/, () => ({ t: 'ambosKO' })],
  [/^if your opponent's active pokémon is affected by a special condition, it is knocked out$/, () => ({ t: 'koSiEstado' })],
  [/^if your opponent's pokémon is knocked out by damage from this attack, take (\d+|one) more prize cards?$/, (m) => ({ t: 'premioExtra', n: num(m[1]), antes: true })],

  // — Curar —
  [/^heal (\d+) damage from this pokémon$/, (m) => ({ t: 'curarPropio', n: +m[1] })],
  [/^heal (\d+) damage from 1 of your pokémon$/, (m) => ({ t: 'curarUno', n: +m[1] })],
  [/^heal (\d+) damage from each of your pokémon$/, (m) => ({ t: 'curarTodos', n: +m[1] })],

  // — Energía —
  [/^discard (all|an?|\d+|one|two) (?:{([a-z])} )?energy from this pokémon$/, (m) => ({ t: 'descartarEnergiaPropia', cuantas: m[1] === 'all' ? 'todas' : num(m[1]), letra: LETRA(m[2]) })],
  [/^discard an energy from your opponent's active pokémon$/, () => ({ t: 'descartarEnergiaRival' })],
  [/^move an energy from this pokémon to 1 of your benched pokémon$/, () => ({ t: 'moverEnergiaABanca' })],
  [/^put (an?|\d+) energy attached to this pokémon into your hand$/, (m) => ({ t: 'energiaPropiaAMano', ...(num(m[1]) > 1 ? { n: num(m[1]) } : {}) })],
  [/^move all energy from this pokémon to 1 of your benched pokémon$/, () => ({ t: 'moverEnergiaABanca', todas: true })],
  [/^discard a special energy from your opponent's active pokémon$/, () => ({ t: 'descartarEnergiaRival', especial: true })],
  [/^move an energy from 1 of your opponent's pokémon to another of their pokémon$/, () => ({ t: 'moverEnergiaRival' })],
  [/^attach (a|an|up to \d+) basic {([a-z])} energy cards? from your discard pile to this pokémon$/, (m) => ({ t: 'unirDescarte', letra: LETRA(m[2]), n: num(m[1]) ?? Number(m[1].replace(/\D/g, '')) })],

  // — Cartas —
  [/^(?:then, )?draw (a|an|one|two|three|\d+) cards?$/, (m) => ({ t: 'robar', n: num(m[1]) })],
  [/^(you may )?draw cards until you have (\d+) cards in your hand$/, (m) => ({ t: 'robarHasta', n: +m[2], opcional: !!m[1] })],
  [/^shuffle your hand into your deck$/, () => ({ t: 'manoAlMazo' })],
  [/^discard your hand and draw (\d+) cards$/, (m) => [{ t: 'descartarMano' }, { t: 'robar', n: +m[1] }]],
  [/^discard the top (a|one|two|three|\d+) cards? of your deck$/, (m) => ({ t: 'molerPropio', n: num(m[1]) })],
  [/^discard the top card of your deck$/, () => ({ t: 'molerPropio', n: 1 })],
  [/^discard a random card from your opponent's hand$/, () => ({ t: 'descartarAlAzarRival' })],
  [/^your opponent discards (a|an|one|two|\d+) cards? from their hand$/, (m) => ({ t: 'rivalDescarta', n: num(m[1]) })],
  [/^(you may )?discard a stadium in play$/, (m) => ({ t: 'descartarEstadio', opcional: !!m[1] })],
  [/^knock out your opponent's active pokémon$/, () => ({ t: 'koActivoRival' })],
  [/^shuffle this pokémon and all attached cards into your deck$/, () => ({ t: 'alMazoPropio' })],
  [/^discard the top (a|one|two|three|\d+) cards? of your opponent's deck$/, (m) => ({ t: 'molerRival', n: num(m[1]) })],
  [/^discard the top card of your opponent's deck$/, () => ({ t: 'molerRival', n: 1 })],
  [/^your opponent reveals their hand, and you discard a card you find there$/, () => ({ t: 'descartarDeManoRival' })],
  [/^put this pokémon and all attached cards into your hand$/, () => ({ t: 'aLaMano' })],
  [/^search your deck for up to (\d+|a|one|two|three) basic pokémon and put them onto your bench$/, (m) => ({ t: 'buscarBasicosBanca', n: num(m[1]) })],
  [/^search your deck for a basic pokémon and put it onto your bench$/, () => ({ t: 'buscarBasicosBanca', n: 1 })],
  [/^search your deck for (?:up to (\d+|two|three)|an?) (supporter|item|stadium|pokémon tool|basic energy|pokémon)(?: cards?)?, reveal (?:it|them), and put (?:it|them) into your hand$/, (m) => ({ t: 'buscarClase', clase: m[2], n: m[1] ? num(m[1]) : 1 }) ],
  [/^search your deck for (?:up to )?(\d+|a|an|one|two|three) cards? and put (?:it|them) into your hand$/, (m) => ({ t: 'buscarCartas', n: num(m[1]) })],
  [/^then, shuffle your deck$/, () => ({ t: 'ruido' })],

  // — Cambios —
  [/^(you may )?switch this pokémon with 1 of your benched pokémon$/, (m) => ({ t: 'cambiarPropio', opcional: !!m[1] })],
  [/^switch out your opponent's active pokémon to the bench$/, () => ({ t: 'echarRival' })],
  [/^your opponent switches their active pokémon with 1 of their benched pokémon$/, () => ({ t: 'echarRival' })],
  [/^switch in 1 of your opponent's benched pokémon to the active spot$/, () => ({ t: 'atraerRival' })],

  // — El turno que viene —
  [/^during your opponent's next turn, they can't play any item cards from their hand$/, () => ({ t: 'veto', que: 'objetos' })],
  [/^your opponent can't play any supporter cards from their hand during their next turn$/, () => ({ t: 'veto', que: 'partidarios' })],
  [/^during your opponent's next turn, they can't play any supporter cards from their hand$/, () => ({ t: 'veto', que: 'partidarios' })],
  [/^during your opponent's next turn, they can't play any pokémon from their hand to evolve their pokémon$/, () => ({ t: 'veto', que: 'evolucionar' })],
  [/^during your opponent's next turn, (?:the defending pokémon|that pokémon) can't retreat$/, () => ({ t: 'rivalNoRetira' })],
  [/^during your opponent's next turn, the defending pokémon can't (?:attack|use attacks)$/, () => ({ t: 'rivalNoAtaca' })],
  [/^choose 1 of your opponent's active pokémon's attacks\s*during your opponent's next turn, that pokémon can't use that attack$/, () => ({ t: 'rivalNoUsa' })],
  [/^during your opponent's next turn, (?:attacks used by the defending pokémon|the defending pokémon's attacks) do (\d+) less damage$/, (m) => ({ t: 'rivalDebil', n: +m[1] })],
  [/^during your opponent's next turn, this pokémon takes (\d+) less damage from attacks$/, (m) => ({ t: 'escudo', tipo: 'menos', n: +m[1] })],
  [/^during your opponent's next turn, prevent all damage from and effects of attacks done to this pokémon$/, () => ({ t: 'escudo', tipo: 'todoYEfectos' })],
  [/^during your opponent's next turn, prevent all damage done to this pokémon by attacks$/, () => ({ t: 'escudo', tipo: 'todo' })],
  [/^during your opponent's next turn, prevent all damage done to this pokémon by attacks from (basic|evolution) pokémon$/, (m) => ({ t: 'escudo', tipo: m[1] === 'basic' ? 'desdeBasicos' : 'desdeEvolucion' })],
  [/^during your opponent's next turn, prevent all damage done to this pokémon by attacks from pokémon ex$/, () => ({ t: 'escudo', tipo: 'desdeEx' })],
  // «can't use attacks» es no atacar: sin esta línea, la de abajo lo leía
  // como un ataque que se llama «attacks» y solo bloqueaba el que se usó.
  [/^during your next turn, this pokémon can't (?:attack|use attacks)$/, () => ({ t: 'noAtacaSiguiente' })],
  [/^this pokémon can't (?:attack|use attacks) during your next turn$/, () => ({ t: 'noAtacaSiguiente' })],
  [/^during your next turn, this pokémon can't use (.+)$/, (m) => ({ t: 'noUsaSiguiente', nombre: m[1] })],
  [/^during your next turn, the defending pokémon takes (\d+) more damage from attacks$/, (m) => ({ t: 'marcaRival', n: +m[1] })],
]

// «Choose 1 of your opponent's Active Pokémon's attacks. During your
// opponent's next turn, that Pokémon can't use that attack.» son DOS
// frases que solo tienen sentido juntas: se pegan antes de leer.
const PEGAR = [
  [/^choose 1 of your opponent's active pokémon's attacks$/, /^during your opponent's next turn, that pokémon can't use that attack$/],
]

function leerFrase(f) {
  for (const [re, hacer] of FRASES_ATAQUE) {
    const m = f.match(re)
    if (m) return hacer(m)
  }
  return null
}

// Leer un ataque entero. Devuelve `{ pasos, completo }`; `completo` es la
// regla del todo o nada.
export function leerAtaque(texto) {
  const fs = frases(texto).map((f) => alIngles(f) ?? f)
  if (!fs.length) return { pasos: [], completo: true, vacio: true }
  // Pegar las parejas que van juntas.
  for (let i = 0; i < fs.length - 1; i++) {
    for (const [a, b] of PEGAR) if (a.test(fs[i]) && b.test(fs[i + 1])) fs.splice(i, 2, `${fs[i]} ${fs[i + 1]}`)
  }
  const pasos = []
  const sinLeer = []
  for (let i = 0; i < fs.length; i++) {
    const f = fs[i]
    // Las monedas: «Flip a coin. If heads, …» / «… If tails, this attack
    // does nothing.» / «Flip N coins. This attack does X damage for each
    // heads.» / «Flip a coin until you get tails…».
    let mm
    if ((mm = f.match(/^flip (a|\d+|two|three|four) coins?( until you get tails)?$/))) {
      const n = num(mm[1])
      const hasta = !!mm[2]
      const sig = fs[i + 1] || ''
      let m2
      if ((m2 = sig.match(/^this attack does (\d+) (more )?damage for each heads$/))) {
        pasos.push({ t: 'monedasPor', n: hasta ? null : n, por: +m2[1], mas: !!m2[2], calc: true })
        i++
        continue
      }
      if (n === 1 && !hasta) {
        // «If heads, X» y/o «If tails, Y», en cualquier orden.
        let leidas = 0
        const rama = {}
        for (let k = 1; k <= 2; k++) {
          const g = fs[i + k]
          const r = g && g.match(/^if (heads|tails), (.+)$/)
          if (!r) break
          const dentro = leerFrase(r[2]) || (r[2] === 'this attack does nothing' ? { t: 'nada', calc: true } : null)
          if (!dentro) {
            sinLeer.push(g)
            leidas = k
            break
          }
          rama[r[1]] = Array.isArray(dentro) ? dentro : [dentro]
          leidas = k
        }
        if (leidas) {
          pasos.push({ t: 'moneda', cara: rama.heads || [], cruz: rama.tails || [], calc: [...(rama.heads || []), ...(rama.tails || [])].some((p) => p.calc) })
          i += leidas
          continue
        }
      }
      sinLeer.push(f)
      continue
    }
    const p = leerFrase(f)
    if (!p) {
      sinLeer.push(f)
      continue
    }
    if (Array.isArray(p)) pasos.push(...p)
    else if (p.t !== 'ruido') pasos.push(p)
  }
  return { pasos, completo: sinLeer.length === 0, sinLeer }
}

// ── Las HABILIDADES que no se usan: se aplican solas ──
//
// Las de defensa («This Pokémon takes 20 less damage from attacks»), las
// que protegen la banca, las que cierran algo al rival («As long as this
// Pokémon is in the Active Spot, your opponent can't play any Item
// cards…») y las que actúan al quedar fuera de combate. Devuelve una lista
// de rasgos; la partida los consulta en cada sitio donde importan.
const FRASES_HABILIDAD = [
  [/^this pokémon takes (\d+) less damage from attacks$/, (m) => ({ t: 'reduce', n: +m[1] })],
  [/^prevent all damage done to this pokémon by attacks from your opponent's pokémon ex$/, () => ({ t: 'previene', de: 'ex' })],
  [/^prevent all damage done to this pokémon by attacks from your opponent's (basic|evolution) pokémon$/, (m) => ({ t: 'previene', de: m[1] === 'basic' ? 'basicos' : 'evolucion' })],
  [/^prevent all damage from attacks done to this pokémon by your opponent's pokémon that have an ability$/, () => ({ t: 'previene', de: 'conHabilidad' })],
  [/^prevent all damage done to your benched pokémon that don't have a rule box by attacks from your opponent's pokémon$/, () => ({ t: 'protegeBanca', sinRegla: true })],
  [/^prevent all damage from and effects of attacks from your opponent's pokémon done to your benched pokémon$/, () => ({ t: 'protegeBanca', efectos: true })],
  [/^prevent all effects of your opponent's pokémon's attacks and abilities done to this pokémon$/, () => ({ t: 'sinEfectos', habilidades: true })],
  [/^prevent all effects of attacks used by your opponent's pokémon done to this pokémon$/, () => ({ t: 'sinEfectos' })],
  [/^prevent all effects of attacks used by your opponent's pokémon done to your basic (.+?) pokémon$/, (m) => ({ t: 'sinEfectosBasicosDe', dueno: m[1] })],
  [/^as long as you have at least 1 other (.+?) in play, all of your basic {c} pokémon take (\d+) less damage from attacks from your opponent's pokémon$/, (m) => ({ t: 'muroIncoloro', nombre: m[1], n: +m[2] })],
  [/^your opponent's active pokémon's retreat cost is {c} more$/, () => ({ t: 'retiradaRivalMas', n: 1 })],
  [/^as long as this pokémon is in the active spot, your opponent can't play any item cards( or pokémon tool cards)? from their hand$/, (m) => ({ t: 'cierraObjetos', herramientas: !!m[1] })],
  [/^as long as this pokémon is in the active spot, your opponent's active pokémon has no abilities, except for (.+)$/, () => ({ t: 'silenciaActivo' })],
  [/^as long as this pokémon is in the active spot, put (\d+) more damage counters on your opponent's poisoned pokémon during pokémon checkup$/, (m) => ({ t: 'venenoMas', n: +m[1] * 10 })],
  [/^attacks used by your (.+?) pokémon(?:, except any (.+?),)? do (\d+) more damage to your opponent's active pokémon$/, (m) => ({ t: 'bono', de: m[1], salvo: m[2] || null, n: +m[3] })],
  [/^if this pokémon is knocked out by damage from an attack from your opponent's pokémon, flip a coin\s*if heads, the attacking pokémon is knocked out$/, () => ({ t: 'alCaerMoneda' })],
  [/^if this pokémon is in the active spot and is knocked out by damage from an attack from your opponent's pokémon, put (\d+) damage counters on the attacking pokémon$/, (m) => ({ t: 'alCaerContadores', n: +m[1] * 10 })],
  [/^if 1 of your {([a-z])} pokémon is knocked out by damage from an attack from your opponent's pokémon ex, that player takes 1 fewer prize card$/, (m) => ({ t: 'menosPremio', letra: LETRA(m[1]) })],
  [/^the weakness of each of your opponent's {([a-z])} pokémon in play is now {([a-z])}$/, (m) => ({ t: 'cambiaDebilidad', de: LETRA(m[1]), a: LETRA(m[2]) })],
  [/^this pokémon can't attack unless you have (\d+) or more (.+?) pokémon in play$/, (m) => ({ t: 'atacaSiTiene', n: +m[1], dueno: m[2] })],
  [/^if this pokémon has a pokémon tool attached, your opponent can't play any ace spec cards from their hand$/, () => ({ t: 'cierraAceSpec' })],
  [/^damage counters on each pokémon can't be moved to other pokémon$/, () => ({ t: 'contadoresQuietos' })],
]

const PEGAR_HABILIDAD = [
  /^if this pokémon is knocked out by damage from an attack from your opponent's pokémon, flip a coin$/,
]

const cacheHabilidad = new Map()
export function leerHabilidad(texto) {
  const clave = String(texto || '')
  if (cacheHabilidad.has(clave)) return cacheHabilidad.get(clave)
  const fs = frases(clave).map((f) => alInglesHabilidad(f) ?? f)
  for (let i = 0; i < fs.length - 1; i++) if (PEGAR_HABILIDAD.some((re) => re.test(fs[i]))) fs.splice(i, 2, `${fs[i]} ${fs[i + 1]}`)
  // «Patrat»: el texto dice «(both yours and your opponent's)» en medio;
  // los paréntesis ya se han ido y queda un doble espacio.
  const rasgos = []
  for (const f of fs) {
    for (const [re, hacer] of FRASES_HABILIDAD) {
      const m = f.replace(/\s+/g, ' ').match(re)
      if (m) {
        rasgos.push(hacer(m))
        break
      }
    }
  }
  cacheHabilidad.set(clave, rasgos)
  return rasgos
}

// Los rasgos pasivos de una carta (todas sus habilidades).
export function rasgosDeCarta(c) {
  const out = []
  for (const h of Array.isArray(c?.abilities) ? c.abilities : []) out.push(...leerHabilidad(h?.effect).map((r) => ({ ...r, habilidad: h?.name || '' })))
  return out
}

const cacheAtaque = new Map()
export function lecturaDeAtaque(ataque) {
  const t = ataque?.effect || ''
  if (cacheAtaque.has(t)) return cacheAtaque.get(t)
  const r = leerAtaque(t)
  cacheAtaque.set(t, r)
  return r
}
