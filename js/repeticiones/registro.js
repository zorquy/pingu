// Leer el registro de una partida de JCC Pokémon Live (tanda 462).
//
// PINGU: «que te peguen el log de una partida de Pokémon TCG Live en
// español y que se reproduzca sola». El registro es texto para personas,
// no un formato: cada línea es una frase («El Budew de X ha infligido 10
// puntos de daño usando Polen Picazón contra el Dunsparce de Y.») y las
// sublíneas que empiezan por «- » cuelgan de la de antes; las que empiezan
// por «•» son la lista de cartas de la de antes.
//
// Este módulo convierte el texto en una lista de EVENTOS con forma fija
// ({ tipo: 'ataque', jugador, pokemon, danio… }). No sabe nada de la mesa:
// eso es estado.js. Y lee también el registro en INGLÉS, que es el que
// sale si el cliente está en inglés: mismas jugadas, otras palabras.
//
// Lo que no entiende no se pierde: sale como `{ tipo: 'texto' }` y se ve
// en el registro de la repetición, sin mover nada en la mesa. Mejor eso
// que inventarse una jugada.

const quitarPunto = (t) => t.replace(/[.!]+$/, '').trim()
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NUM = { una: 1, un: 1, uno: 1, a: 1, an: 1, one: 1, dos: 2, two: 2, tres: 3, three: 3 }
const num = (x) => (/^\d+$/.test(String(x)) ? Number(x) : NUM[String(x).toLowerCase()] ?? 1)

// Las energías básicas se escriben distinto en cada sitio: «Energía
// Psíquica Básica» (el registro), «Basic Psychic Energy» (el registro en
// inglés), «Energía Psíquica» (el catálogo). Se deja la forma corta.
export function nombreDeCarta(t) {
  let n = String(t || '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()
  n = n.replace(/^Energ[ií]a (.+?) B[aá]sica$/i, 'Energía $1')
  n = n.replace(/^Basic (.+?) Energy$/i, '$1 Energy')
  return n
}
export const esEnergia = (n) => /^energ[ií]a\b|\benergy$/i.test(String(n || ''))

// ── Los jugadores ──
//
// Los nombres de usuario no llevan espacios, pero los de las cartas sí, y
// llevan «de» («Determinación de Lylia», «Zoroark ex de N»): «El Zoroark ex
// de N de Pepe» solo se parte bien sabiendo quién juega. Se sacan primero
// de las líneas de preparación, que empiezan todas por el jugador.
export function jugadoresDe(lineas) {
  const vistos = []
  const pon = (j) => {
    if (j && !vistos.includes(j)) vistos.push(j)
  }
  for (const l of lineas) {
    let m
    if ((m = l.match(/^(\S+) ha (?:elegido|ganado|decidido|robado \d+ cartas de la mano inicial|puesto en juego a)/))) pon(m[1])
    else if ((m = l.match(/^(\S+) (?:chose|won|decided|drew \d+ cards for the opening hand|played .+ to the (?:Active Spot|Bench))/))) pon(m[1])
    else if ((m = l.match(/^Turno de (\S+)$/))) pon(m[1])
    else if ((m = l.match(/^Turn # \d+ - (\S+?)'s Turn$/))) pon(m[1])
    if (vistos.length >= 2) break
  }
  return vistos
}

// Todas las maneras de partir «carta del Pokémon» por un « del ».
export function partesPorDel(texto) {
  const t = String(texto || '')
  const fuera = []
  for (let i = t.indexOf(' del '); i > 0; i = t.indexOf(' del ', i + 1)) fuera.push({ carta: nombreDeCarta(t.slice(0, i)), pokemon: nombreDeCarta(t.slice(i + 5)) })
  return fuera
}

function koEnEspanol(linea, P) {
  const todos = [...linea.matchAll(new RegExp(`(?:^|\\s|¡)(?:El|el|al|del) (.+?) de ${P}(?=[\\s.,!]|$)`, 'g'))]
  const m = todos.at(-1)
  return m ? { tipo: 'ko', jugador: m[2], pokemon: nombreDeCarta(m[1]) } : null
}

// ── Las frases ──
//
// Cada una: [expresión, constructor]. `J` en la expresión es «uno de los
// dos jugadores» (se monta con sus nombres). Van las del español y las del
// inglés juntas: no se pisan.
function frases(J) {
  const P = `(${J})`
  return [
    // — Preparación —
    [new RegExp(`^${P} ha elegido (cara|cruz) para el lanzamiento de moneda inicial$`), (m) => ({ tipo: 'eleccion', jugador: m[1], lado: m[2] })],
    [new RegExp(`^${P} chose (heads|tails) for the opening coin flip$`), (m) => ({ tipo: 'eleccion', jugador: m[1], lado: m[2] === 'heads' ? 'cara' : 'cruz' })],
    [new RegExp(`^${P} ha ganado el lanzamiento de moneda$`), (m) => ({ tipo: 'ganaMoneda', jugador: m[1] })],
    [new RegExp(`^${P} won the coin toss$`), (m) => ({ tipo: 'ganaMoneda', jugador: m[1] })],
    [new RegExp(`^${P} ha decidido empezar en (primer|segundo) lugar$`), (m) => ({ tipo: 'decide', jugador: m[1], primero: m[2] === 'primer' })],
    [new RegExp(`^${P} decided to go (first|second)$`), (m) => ({ tipo: 'decide', jugador: m[1], primero: m[2] === 'first' })],
    [new RegExp(`^${P} ha robado (\\d+) cartas de la mano inicial$`), (m) => ({ tipo: 'manoInicial', jugador: m[1], n: +m[2] })],
    [new RegExp(`^${P} drew (\\d+) cards for the opening hand$`), (m) => ({ tipo: 'manoInicial', jugador: m[1], n: +m[2] })],
    [/^(\d+) cartas robadas$|^(\d+) drawn cards$/, () => ({ tipo: 'nada' })],
    // «ha declarado un mulligan» y «ha declarado 2 mulligans» (913): con el
    // número delante no casaba, y el que los hacía jugaba con la mano a cero.
    [new RegExp(`^${P} (?:ha hecho|ha declarado) (?:(un|\\d+) )?mulligans?`, 'i'), (m) => ({ tipo: 'mulligan', jugador: m[1], n: num(m[2] || 1) })],
    [new RegExp(`^${P} took a mulligan`, 'i'), (m) => ({ tipo: 'mulligan', jugador: m[1] })],
    // La mano del mulligan se ENSEÑA («Cartas mostradas por el mulligan
    // número 1 • …»): es la que vuelve al mazo, no una que llega.
    [/^Cartas mostradas por el mulligan|^Cards revealed from Mulligan/i, () => ({ tipo: 'mostrar' })],
    // La carta de más por el mulligan del otro: su nombre va en la sublínea
    // siguiente («- Rojo ha robado Tarjeta Roja Especial»), que es LA
    // MISMA carta y no otra (tanda 481).
    [new RegExp(`^${P} ha robado (una|\\d+) cartas? más porque`), (m) => ({ tipo: 'robar', jugador: m[1], n: num(m[2]), seNombraDespues: true })],
    [new RegExp(`^${P} drew (a|\\d+) (?:more |extra )?cards? because`), (m) => ({ tipo: 'robar', jugador: m[1], n: num(m[2]), seNombraDespues: true })],
    [new RegExp(`^${P} ha puesto en juego a (.+) en el Puesto Activo$`), (m) => ({ tipo: 'poner', jugador: m[1], carta: nombreDeCarta(m[2]), donde: 'activo' })],
    [new RegExp(`^${P} ha puesto en juego a (.+) en la Banca$`), (m) => ({ tipo: 'poner', jugador: m[1], carta: nombreDeCarta(m[2]), donde: 'banca' })],
    [new RegExp(`^${P} played (.+) to the Active Spot$`), (m) => ({ tipo: 'poner', jugador: m[1], carta: nombreDeCarta(m[2]), donde: 'activo' })],
    [new RegExp(`^${P} played (.+) to the Bench$`), (m) => ({ tipo: 'poner', jugador: m[1], carta: nombreDeCarta(m[2]), donde: 'banca' })],

    // — Turnos —
    [new RegExp(`^Turno(?: n\\.?º? ?(\\d+))?(?: -)? de ${P}$`), (m) => ({ tipo: 'turno', jugador: m[2] })],
    [new RegExp(`^Turn # \\d+ - ${P}'s Turn$`), (m) => ({ tipo: 'turno', jugador: m[1] })],
    [new RegExp(`^${P} ha terminado su turno$`), (m) => ({ tipo: 'finTurno', jugador: m[1] })],
    [new RegExp(`^${P} ended their turn$`), (m) => ({ tipo: 'finTurno', jugador: m[1] })],

    // — Robar y buscar —
    // Los premios, ANTES que «ha robado (.+)»: si no, «ha robado 2 cartas
    // de Premio» se leía como robar una carta llamada «2 cartas de Premio».
    [new RegExp(`^${P} ha (?:cogido|tomado|robado|obtenido) (una|\\d+) cartas? de Premio`, 'i'), (m) => ({ tipo: 'premio', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} took (a|\\d+) Prize cards?`), (m) => ({ tipo: 'premio', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} ha robado (una|\\d+) cartas? y las? ha puesto en juego en la Banca$`), (m) => ({ tipo: 'aBanca', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} drew (a|\\d+) cards? and played (?:it|them) to the Bench$`), (m) => ({ tipo: 'aBanca', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} ha robado (.+) y lo ha puesto en juego en la Banca$`), (m) => ({ tipo: 'aBanca', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [new RegExp(`^${P} drew (.+) and played it to the Bench$`), (m) => ({ tipo: 'aBanca', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [new RegExp(`^${P} ha robado (una|\\d+) cartas?$`), (m) => ({ tipo: 'robar', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} drew (a|\\d+) cards?$`), (m) => ({ tipo: 'robar', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} ha robado (.+)$`), (m) => ({ tipo: 'robar', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [new RegExp(`^${P} drew (.+)$`), (m) => ({ tipo: 'robar', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],

    // — Jugar cartas —
    [new RegExp(`^${P} ha puesto en juego la carta de Estadio (.+)$`), (m) => ({ tipo: 'estadio', jugador: m[1], carta: nombreDeCarta(m[2]) })],
    [new RegExp(`^${P} played (.+) to the Stadium spot$`), (m) => ({ tipo: 'estadio', jugador: m[1], carta: nombreDeCarta(m[2]) })],
    [new RegExp(`^${P} ha jugado (.+)$`), (m) => ({ tipo: 'jugar', jugador: m[1], carta: nombreDeCarta(m[2]) })],
    [new RegExp(`^${P} played (.+)$`), (m) => ({ tipo: 'jugar', jugador: m[1], carta: nombreDeCarta(m[2]) })],
    [new RegExp(`^${P} ha unido (.+?) al? (.+) (?:en la Banca|en el Puesto Activo)$`), (m, l) => ({ tipo: 'unir', jugador: m[1], carta: nombreDeCarta(m[2]), a: nombreDeCarta(m[3]), donde: /Puesto Activo$/.test(l) ? 'activo' : 'banca' })],
    [new RegExp(`^${P} attached (.+?) to (.+) (?:on the Bench|in the Active Spot)$`), (m, l) => ({ tipo: 'unir', jugador: m[1], carta: nombreDeCarta(m[2]), a: nombreDeCarta(m[3]), donde: /Active Spot$/.test(l) ? 'activo' : 'banca' })],
    [new RegExp(`^${P} ha hecho que el (.+) (del Puesto Activo|en Banca|de la Banca) evolucione a (.+)$`), (m) => ({ tipo: 'evolucionar', jugador: m[1], de: nombreDeCarta(m[2]), a: nombreDeCarta(m[4]), donde: /Activo/.test(m[3]) ? 'activo' : 'banca' })],
    [new RegExp(`^${P} evolved (.+) to (.+) (in the Active Spot|on the Bench)$`), (m) => ({ tipo: 'evolucionar', jugador: m[1], de: nombreDeCarta(m[2]), a: nombreDeCarta(m[3]), donde: /Active/.test(m[4]) ? 'activo' : 'banca' })],

    // — Pokémon —
    [new RegExp(`^El (.+) de ${P} ha infligido (\\d+) puntos? de daño usando (.+) contra el (.+) de ${P}$`), (m) => ({ tipo: 'ataque', jugador: m[2], pokemon: nombreDeCarta(m[1]), danio: +m[3], ataque: m[4], objetivo: nombreDeCarta(m[5]), deQuien: m[6] })],
    [new RegExp(`^${P}'s (.+) used (.+) on ${P}[’']s (.+) for (\\d+) damage`), (m) => ({ tipo: 'ataque', jugador: m[1], pokemon: nombreDeCarta(m[2]), ataque: m[3], deQuien: m[4], objetivo: nombreDeCarta(m[5]), danio: +m[6] })],
    [new RegExp(`^El (.+) de ${P} ha usado (.+)$`), (m) => ({ tipo: 'usar', jugador: m[2], pokemon: nombreDeCarta(m[1]), que: m[3] })],
    [new RegExp(`^${P}'s (.+) used (.+)$`), (m) => ({ tipo: 'usar', jugador: m[1], pokemon: nombreDeCarta(m[2]), que: m[3] })],
    [new RegExp(`^${P} ha retirado a (.+) a la Banca$`), (m) => ({ tipo: 'retirar', jugador: m[1], pokemon: nombreDeCarta(m[2]) })],
    [new RegExp(`^${P} retreated (.+) to the Bench$`), (m) => ({ tipo: 'retirar', jugador: m[1], pokemon: nombreDeCarta(m[2]) })],
    [new RegExp(`^El (.+) de ${P} pasa a estar en el Puesto Activo$`), (m) => ({ tipo: 'pasaActivo', jugador: m[2], pokemon: nombreDeCarta(m[1]) })],
    [new RegExp(`^${P}'s (.+) is now in the Active Spot$`), (m) => ({ tipo: 'pasaActivo', jugador: m[1], pokemon: nombreDeCarta(m[2]) })],
    [new RegExp(`^El (.+) de ${P} se ha intercambiado con el (.+) de ${P} y pasa a ser el Pokémon Activo$`), (m) => ({ tipo: 'intercambio', jugador: m[2], sube: nombreDeCarta(m[1]), baja: nombreDeCarta(m[3]) })],
    [new RegExp(`^${P}'s (.+) was switched with ${P}'s (.+) to become the Active Pokémon$`), (m) => ({ tipo: 'intercambio', jugador: m[1], sube: nombreDeCarta(m[2]), baja: nombreDeCarta(m[4]) })],
    // La forma exacta de un KO en el registro en español no es segura: se
    // reconoce por «Fuera de Combate» y el ÚLTIMO «Pokémon de jugador» de
    // la frase, que vale para «El X de A ha quedado Fuera de Combate» y
    // para «El X de A ha dejado Fuera de Combate al Y de B».
    [new RegExp(`fuera de combate|noquead|debilitad`, 'i'), (m, l) => koEnEspanol(l, P)],
    [new RegExp(`^${P}'s (.+) was Knocked Out`), (m) => ({ tipo: 'ko', jugador: m[1], pokemon: nombreDeCarta(m[2]) })],
    [new RegExp(`^${P} ha puesto (\\d+|un|una) contador(?:es)? de daño (?:en|a) el (.+) de ${P}$`), (m) => ({ tipo: 'contadores', jugador: m[1], n: num(m[2]), pokemon: nombreDeCarta(m[3]), deQuien: m[4] })],
    [new RegExp(`^${P} put (\\d+|a) damage counters? on ${P}'s (.+)$`), (m) => ({ tipo: 'contadores', jugador: m[1], n: num(m[2]), deQuien: m[3], pokemon: nombreDeCarta(m[4]) })],
    // «- El Zorua de N de Azul ha recibido 3 contadores de daño de
    // Azul»: el registro le pone al Pokémon el dueño EQUIVOCADO (el que
    // ataca), y lo hace siempre. Se guarda lo que dice y estado.js decide:
    // si el rival del que los pone tiene uno que se llame así, es suyo.
    [new RegExp(`^El (.+) de ${P} ha recibido (\\d+|un|una) contador(?:es)? de daño de ${P}$`), (m) => ({ tipo: 'contadores', jugador: m[4], n: num(m[3]), pokemon: nombreDeCarta(m[1]), dice: m[2] })],
    [new RegExp(`^El (.+) de ${P} ha recibido (\\d+) puntos? de daño$`), (m) => ({ tipo: 'danio', jugador: m[2], pokemon: nombreDeCarta(m[1]), danio: +m[3] })],
    // Curarse (tanda 592: lo escribe el laboratorio; sin esto, el daño de una
    // repetición solo podía subir).
    [new RegExp(`^El (.+) de ${P} se ha curado (\\d+) puntos? de daño$`), (m) => ({ tipo: 'curar', jugador: m[2], pokemon: nombreDeCarta(m[1]), danio: +m[3] })],
    // Y como lo escribe TCG Live (913): «- Se han curado 80 puntos de daño al
    // Metagross de J».
    [new RegExp(`^Se (?:ha|han) curado (\\d+) puntos? de daño al? (.+) de ${P}$`), (m) => ({ tipo: 'curar', jugador: m[3], pokemon: nombreDeCarta(m[2]), danio: +m[1] })],
    // Mover contadores de un Pokémon a otro (913: Adrenalina Mental de
    // Munkidori, el Dunsparce de Robo a la Fuga…). «J ha movido 3 contadores
    // de daño del Dragapult ex de J al Abra de J»: el ORIGEN lleva su dueño
    // bien; el DESTINO, como en «ha recibido N contadores», lo lleva a menudo
    // mal (el Abra era del rival). Se guarda lo que dice y decide estado.js.
    [new RegExp(`^${P} ha movido (un|una|\\d+) contador(?:es)? de daño del (.+) de ${P} al? (.+) de ${P}$`), (m) => ({ tipo: 'moverContadores', jugador: m[1], n: num(m[2]), de: nombreDeCarta(m[3]), deQuien: m[4], a: nombreDeCarta(m[5]), dice: m[6] })],
    // El daño del Chequeo Pokémon (913): «Se ha colocado un contador de daño
    // en el Zoroark ex de N de J por estar afectado por la Condición Especial
    // Envenenado». Aquí el dueño SÍ es el de la frase.
    [new RegExp(`^Se (?:ha|han) colocado (un|una|\\d+) contador(?:es)? de daño en el (.+) de ${P}(?: por .*)?$`), (m) => ({ tipo: 'contadores', jugador: m[3], n: num(m[1]), pokemon: nombreDeCarta(m[2]), deQuien: m[3] })],
    // Los estados especiales (913): «- El Dedenne de J pasa a estar
    // Confundido». Se enseñan en la mesa y los lleva «Jugar desde aquí».
    [new RegExp(`^El (.+) de ${P} pasa a estar (Confundid[oa]|Envenenad[oa]|Dormid[oa]|Paralizad[oa]|Quemad[oa])$`, 'i'), (m) => ({ tipo: 'estado', jugador: m[2], pokemon: nombreDeCarta(m[1]), estado: m[3].toLowerCase().replace(/a$/, 'o') })],
    // Un daño que algo evita (Jaula de Combate): «- Se ha evitado el daño
    // infligido a Alakazam». No mueve nada, pero se ha entendido.
    [/^Se ha evitado el daño infligido a (.+)$/, (m) => ({ tipo: 'evitado', pokemon: nombreDeCarta(m[1]) })],
    // La cabecera del chequeo entre turnos (913).
    [/^Chequeo Pok[eé]mon$|^Pok[eé]mon Checkup$/i, () => ({ tipo: 'chequeo' })],

    // — Energía y cartas que se van —
    [/^Se ha activado (.+)$/, (m) => ({ tipo: 'activar', carta: nombreDeCarta(m[1]) })],
    // «Se ha descartado Energía del Team Rocket del Murkrow del Team Rocket
    // de J» (913): con «del» dentro de los dos nombres hay tres maneras de
    // partirla, y la de siempre (el último «del») daba la carta «Energía del
    // Team Rocket del Murkrow» y el Pokémon «Team Rocket». Se guardan todas
    // y `elegirPartes` (abajo) se queda con la que nombra un Pokémon que ese
    // jugador tiene en la partida.
    [new RegExp(`^Se ha descartado (.+) del (.+) de ${P}$`), (m) => ({ tipo: 'descartarDe', jugador: m[3], carta: nombreDeCarta(m[1]), pokemon: nombreDeCarta(m[2]), partes: partesPorDel(`${m[1]} del ${m[2]}`) })],
    [new RegExp(`^(.+) was discarded from ${P}'s (.+)$`), (m) => ({ tipo: 'descartarDe', jugador: m[2], carta: nombreDeCarta(m[1]), pokemon: nombreDeCarta(m[3]) })],
    // Lo que se descarta sin decir de dónde (tanda 633): el estadio que quita
    // un efecto, o el Pokémon que sobra de la banca cuando el estadio se va.
    [/^Se ha descartado (.+)$/, (m) => ({ tipo: 'descartadoSuelto', carta: nombreDeCarta(m[1]) })],
    [/^(.+) was discarded$/, (m) => ({ tipo: 'descartadoSuelto', carta: nombreDeCarta(m[1]) })],
    // Lo que llega a la mano sin robarlo: los premios (su nombre va en la
    // línea siguiente) y lo que sale del descarte.
    [new RegExp(`^(?:A card|Una carta) (?:was added to|se ha añadido a la mano de) ${P}(?:'s hand)?$`), (m) => ({ tipo: 'llegaAMano', jugador: m[1] })],
    [new RegExp(`^(.+) was added to ${P}'s hand$`), (m) => ({ tipo: 'llegaAMano', jugador: m[2], cartas: [nombreDeCarta(m[1])] })],
    [new RegExp(`^(?:Se ha añadido )?(.+?) (?:se )?(?:ha añadido|ha pasado) a la mano de ${P}$`), (m) => ({ tipo: 'llegaAMano', jugador: m[2], cartas: [nombreDeCarta(m[1])] })],
    // «Se ha añadido Zoroark ex de N a la mano de Rojo», el nombre de un
    // premio; «Una carta» es uno que no se enseña (el del rival).
    [new RegExp(`^Se ha añadido (.+) a la mano de ${P}$`), (m) => ({ tipo: 'llegaAMano', jugador: m[2], cartas: /^una carta$/i.test(m[1].trim()) ? [] : [nombreDeCarta(m[1])] })],
    // Camilla Nocturna, Ciclón Levante: «ha movido X de J a su mano», o
    // «ha movido 5 cartas de J a su mano» con la lista debajo.
    [new RegExp(`^${P} ha movido (\\d+) cartas? de ${P} a su mano$`), (m) => ({ tipo: 'aMano', jugador: m[3], n: num(m[2]) })],
    [new RegExp(`^${P} ha movido (.+) de ${P} a su mano$`), (m) => ({ tipo: 'aMano', jugador: m[3], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [new RegExp(`^${P} put (\\d+|a) cards? on the (?:bottom|top) of their deck$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} put (.+) on (?:the )?(?:top|bottom) of their deck$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [new RegExp(`^${P} ha puesto (una|\\d+) cartas? (?:en el fondo|debajo|encima|en la parte (?:inferior|superior)) de su baraja$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} ha puesto (.+) en la parte (?:inferior|superior) de su baraja$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [/^(.+) was activated$/, (m) => ({ tipo: 'activar', carta: nombreDeCarta(m[1]) })],
    [new RegExp(`^${P} chose (.+)$`), () => ({ tipo: 'nada' })],
    // «- Rojo ha elegido Llama Virtuosa»: el ataque que copia Bromista
    // Nocturno. Se enseña y no mueve nada (la moneda del principio, que
    // también «ha elegido», va arriba y casa antes).
    [new RegExp(`^${P} ha elegido (.+)$`), (m) => ({ tipo: 'elige', jugador: m[1], que: m[2] })],
    // «- Resumen del daño:» con el desglose en viñetas debajo: el desglose
    // no son CARTAS (leerRegistro lo junta en la propia línea).
    [/^Resumen del daño:?$|^Damage breakdown:?$/i, () => ({ tipo: 'resumen' })],
    [new RegExp(`^Se han descartado (\\d+) cartas del (.+) de ${P}$`), (m) => ({ tipo: 'descartarTodoDe', jugador: m[3], pokemon: nombreDeCarta(m[2]) })],
    [new RegExp(`^(\\d+) cards were discarded from ${P}'s (.+)$`), (m) => ({ tipo: 'descartarTodoDe', jugador: m[2], pokemon: nombreDeCarta(m[3]) })],
    [new RegExp(`^${P} ha descartado (una|\\d+) cartas?$`), (m) => ({ tipo: 'descartar', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} discarded (a|\\d+) cards?$`), (m) => ({ tipo: 'descartar', jugador: m[1], n: num(m[2]) })],
    [new RegExp(`^${P} ha descartado (.+)$`), (m) => ({ tipo: 'descartar', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [new RegExp(`^${P} discarded (.+)$`), (m) => ({ tipo: 'descartar', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [new RegExp(`^${P} ha puesto (una|\\d+) cartas? en su baraja y ha barajado todas las cartas$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: num(m[2]) })],
    // Con su nombre (913): «- J ha puesto Órdenes de Jefes en su baraja y ha
    // barajado todas las cartas».
    [new RegExp(`^${P} ha puesto (.+) en su baraja y ha barajado todas las cartas$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: 1, cartas: [nombreDeCarta(m[2])] })],
    [new RegExp(`^${P} shuffled (\\d+|a) cards? into their deck$`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: num(m[2]) })],
    // «Ha barajado su mano» a secas es solo barajarla (E-Nigma: la línea
    // siguiente dice cuántas van debajo del mazo). «…en su baraja» sí la
    // mete en el mazo.
    [new RegExp(`^${P} ha barajado su mano (?:en|con) su baraja`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: null })],
    [new RegExp(`^${P} shuffled their hand into their deck`), (m) => ({ tipo: 'alMazo', jugador: m[1], n: null })],
    [new RegExp(`^${P} ha barajado su mano$`), (m) => ({ tipo: 'barajar', jugador: m[1] })],
    // «- J ha barajado las cartas de su mano» (antes de mandarlas al fondo:
    // Tarjeta Roja Especial) y «- J ha barajado sus cartas» (913): barajar,
    // sin mover nada; lo que se mueve lo dice la línea siguiente.
    [new RegExp(`^${P} ha barajado (?:las cartas de su mano|sus cartas)$`), (m) => ({ tipo: 'barajar', jugador: m[1] })],
    [new RegExp(`^${P} shuffled their hand$`), (m) => ({ tipo: 'barajar', jugador: m[1] })],
    [new RegExp(`^${P} moved ${P}'s (\\d+) cards? to their deck$`), (m) => ({ tipo: 'alMazo', jugador: m[2], n: num(m[3]) })],
    [new RegExp(`^${P} ha movido (\\d+) cartas? de ${P} a su baraja$`), (m) => ({ tipo: 'alMazo', jugador: m[3], n: num(m[2]) })],
    [new RegExp(`^${P} ha barajado su baraja$`), (m) => ({ tipo: 'barajar', jugador: m[1] })],
    [new RegExp(`^${P} shuffled their deck$`), (m) => ({ tipo: 'barajar', jugador: m[1] })],
    [new RegExp(`^${P} ha lanzado una moneda y ha salido (cara|cruz)$`), (m) => ({ tipo: 'moneda', jugador: m[1], cara: m[2] === 'cara' })],
    [new RegExp(`^${P} flipped a coin and it landed on (heads|tails)$`), (m) => ({ tipo: 'moneda', jugador: m[1], cara: m[2] === 'heads' })],

    // — El final —
    [new RegExp(`^El rival se ha rendido\\.? ${P} ha ganado$`), (m) => ({ tipo: 'fin', ganador: m[1], porque: 'rendicion' })],
    // El final por premios (tanda 481): «Todas las cartas de Premio
    // cogidas. Rojo ha ganado.» empieza por la razón, no por quién gana.
    [new RegExp(`^Todas las cartas de Premio (?:cogidas|tomadas)\\.? ${P} ha ganado$`), (m) => ({ tipo: 'fin', ganador: m[1], porque: 'premios' })],
    [new RegExp(`^All Prize cards taken\\.? ${P} wins$`), (m) => ({ tipo: 'fin', ganador: m[1], porque: 'premios' })],
    [new RegExp(`^${P} ha ganado`), (m) => ({ tipo: 'fin', ganador: m[1] })],
    [new RegExp(`^(?:Opponent conceded|.*conceded)\\.? ${P} wins`), (m) => ({ tipo: 'fin', ganador: m[1], porque: 'rendicion' })],
    [new RegExp(`${P} wins$`), (m) => ({ tipo: 'fin', ganador: m[1] })],
    // Cualquier otra razón delante (tanda 553): «El rival no tiene Pokémon
    // en juego. Rojo ha ganado.» Sin esto, una partida que acaba así no dice
    // quién ganó y no se puede apuntar sin preguntar.
    [new RegExp(`\\. ${P} ha ganado(?: la partida)?$`), (m) => ({ tipo: 'fin', ganador: m[1] })],
  ]
}

// Leer el registro entero. Devuelve { jugadores, eventos, sinLeer }.
export function leerRegistro(texto) {
  const crudas = String(texto || '').replace(/\r/g, '').split('\n')
  const limpias = crudas.map((l) => l.replace(/ /g, ' ').trimEnd())
  const jugadores = jugadoresDe(limpias.map((l) => quitarPunto(l.trim())))
  if (jugadores.length < 2) return { jugadores, eventos: [], sinLeer: [], error: 'No encuentro a los dos jugadores: ¿es el registro de una partida de JCC Pokémon Live?' }
  const tabla = frases(jugadores.map(esc).join('|'))
  const eventos = []
  const sinLeer = []
  let ultimo = null
  let padre = null
  for (const [fila, cruda] of limpias.entries()) {
    const t = cruda.trim()
    if (!t) continue
    // «   ◦ lugar 2» y «   ◦ de la baraja» (tanda 592): lo que un registro
    // hecho por el laboratorio sabe y TCG Live no escribe —CUÁL de los que se
    // llaman igual, y de DÓNDE sale una energía que une un efecto—. TCG Live
    // no escribe nunca «◦»: el suyo se sigue leyendo como siempre.
    const pista = t.match(/^◦\s*(?:lugar\s+(\d+)|(de la baraja|del descarte))$/)
    if (pista) {
      if (ultimo && pista[1]) ultimo.lugar = Number(pista[1])
      if (ultimo && pista[2]) ultimo.desde = pista[2] === 'de la baraja' ? 'mazo' : 'descarte'
      continue
    }
    // «   • Erin, Dunsparce, …»: la lista de cartas de la línea de antes.
    if (/^[•·]/.test(t)) {
      if (ultimo?.tipo === 'resumen') {
        ultimo.linea += `${ultimo.linea.endsWith(':') ? ' ' : ' · '}${t.replace(/^[•·]\s*/, '')}`
        continue
      }
      const cartas = t.replace(/^[•·]\s*/, '').split(/,\s*/).map(nombreDeCarta).filter(Boolean)
      if (ultimo) ultimo.cartas = [...(ultimo.cartasLista ? ultimo.cartas || [] : []), ...cartas]
      if (ultimo) ultimo.cartasLista = true
      continue
    }
    const sub = /^-\s/.test(t)
    const frase = quitarPunto(t.replace(/^-\s*/, ''))
    if (/^Preparaci[oó]n$|^Setup$/i.test(frase)) continue
    let ev = null
    // Una línea puede traer DOS frases («…for 340 damage. Shinwrld's
    // Radiant Greninja took 170 more damage because of Lightning
    // Weakness.»): se prueba entera y, si no, la primera.
    for (const intento of [frase, frase.split(/\.\s+/)[0]]) {
      for (const [re, hacer] of tabla) {
        const m = intento.match(re)
        if (m) {
          ev = hacer(m, intento)
          break
        }
      }
      if (ev) break
    }
    if (!ev) {
      ev = { tipo: 'texto' }
      sinLeer.push(t)
    }
    if (ev.tipo === 'nada') continue
    ev.linea = t.replace(/^-\s*/, '')
    // La línea del texto de la que sale (desde 0). Es lo que no cambia el
    // día que este lector aprenda a leer una línea más: las notas de una
    // repetición guardada se anclan aquí y no al número de jugada.
    ev.fila = fila
    ev.sub = sub
    // De qué cuelga una sublínea: una energía que se une «- …» bajo una
    // carta de Entrenador sale de otro sitio que bajo un ataque.
    if (sub && padre) ev.padre = { tipo: padre.tipo, jugador: padre.jugador || null, carta: padre.carta || padre.que || null }
    // La carta de más por el mulligan se nombra en la sublínea siguiente:
    // es la MISMA, no una segunda.
    // Con más de una (dos mulligans del otro), la sublínea dice «ha robado
    // 2 cartas» y los nombres van en la lista de debajo: también es la misma.
    if (sub && ev.tipo === 'robar' && ultimo?.seNombraDespues && ultimo.jugador === ev.jugador && (ev.cartas?.length || ev.n === ultimo.n)) {
      ev.tipo = 'nombrar'
      ultimo.seNombraDespues = false
    }
    // «Cartas mostradas por el mulligan» no dice de quién: del que acaba
    // de hacerlo.
    if (ev.tipo === 'mostrar' && padre?.tipo === 'mulligan') ev.jugador = padre.jugador
    if (!sub) padre = ev
    eventos.push(ev)
    ultimo = ev
  }
  for (const e of eventos) {
    delete e.cartasLista
    delete e.seNombraDespues
  }
  elegirPartes(eventos)
  return { jugadores, eventos, sinLeer }
}

// ── Qué «del» parte la frase (913) ──
//
// De cada jugador, los Pokémon que el registro le nombra EN JUEGO (los que
// pone, los que evolucionan, a los que une algo…) y lo que le une. Con eso,
// de las maneras de partir «Se ha descartado X del Y de J», la buena es la
// que nombra a uno de sus Pokémon; y a igualdad, la que nombra algo que se
// le unió. Si ninguna, la de siempre.
const plana = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
export function elegirPartes(eventos) {
  const pokemon = new Map()
  const unidas = new Map()
  const pon = (mapa, jugador, nombre) => {
    if (!jugador || !nombre) return
    if (!mapa.has(jugador)) mapa.set(jugador, new Set())
    mapa.get(jugador).add(plana(nombre))
  }
  for (const e of eventos) {
    const j = e.jugador
    if (e.tipo === 'poner') pon(pokemon, j, e.carta)
    if (e.tipo === 'aBanca') for (const c of e.cartas || []) pon(pokemon, j, c)
    if (e.tipo === 'evolucionar') {
      pon(pokemon, j, e.de)
      pon(pokemon, j, e.a)
    }
    if (e.tipo === 'unir') {
      pon(pokemon, j, e.a)
      pon(unidas, j, e.carta)
    }
    if (['pasaActivo', 'retirar', 'usar', 'ko'].includes(e.tipo)) pon(pokemon, j, e.pokemon)
    if (e.tipo === 'ataque') {
      pon(pokemon, j, e.pokemon)
      pon(pokemon, e.deQuien, e.objetivo)
    }
  }
  for (const e of eventos) {
    if (!e.partes || e.partes.length < 2) {
      delete e.partes
      continue
    }
    const suyos = pokemon.get(e.jugador) || new Set()
    const suyas = unidas.get(e.jugador) || new Set()
    const nota = (p) => (suyos.has(plana(p.pokemon)) ? 2 : 0) + (suyas.has(plana(p.carta)) ? 1 : 0)
    let mejor = null
    for (const p of e.partes) if (nota(p) > (mejor ? nota(mejor) : 0)) mejor = p
    if (mejor) {
      e.carta = mejor.carta
      e.pokemon = mejor.pokemon
    }
    delete e.partes
  }
  return eventos
}
