// El glosario (tanda 792, NU11): los términos del juego en español, en
// inglés y en jerga, con un ejemplo. Lo pinta /glosario y lo usan las guías
// y el foro para subrayar la primera vez que sale cada uno. Sin
// dependencias: lo puede importar cualquiera.
export const GLOSARIO = [
  { id: 'activo', termino: 'Pokémon Activo', en: 'Active Pokémon', alias: ['pokémon activo', 'puesto activo'], def: 'El Pokémon que está delante y es el único que ataca y recibe los ataques.', ejemplo: 'Pones a Dragapult ex de Activo para atacar este turno.' },
  { id: 'banca', termino: 'Banca', en: 'Bench', alias: ['banca', 'bench'], def: 'Los hasta cinco Pokémon que esperan detrás del Activo. Ni atacan ni, salvo efectos, reciben daño.', ejemplo: 'Bajas dos Dreepy a la Banca para evolucionarlos el turno siguiente.' },
  { id: 'premio', termino: 'Cartas de Premio', en: 'Prize cards', alias: ['premios', 'cartas de premio', 'prizes'], def: 'Las seis cartas boca abajo que apartas al empezar. Coges una (o más, con un ex o un V) por cada Pokémon rival que dejas fuera de combate; gana quien coge la última.', ejemplo: 'Un KO a un Pokémon ex te da dos Premios.' },
  { id: 'ko', termino: 'Fuera de combate', en: 'Knock Out (KO)', alias: ['KO', 'fuera de combate', 'noquear'], def: 'Cuando el daño de un Pokémon llega a sus PS: se descarta con todo lo que tenga unido y el rival coge Premios.', ejemplo: 'Con 280 de daño haces KO a un Charizard ex de 330 PS si ya tenía 60.' },
  { id: 'retirar', termino: 'Retirada', en: 'Retreat', alias: ['retirar', 'retirada', 'retreat'], def: 'Cambiar tu Activo por uno de la Banca pagando su coste de retirada en Energías. Una vez por turno.', ejemplo: 'Retiras a Pidgeot ex descartando una Energía para subir a tu atacante.' },
  { id: 'mulligan', termino: 'Mulligan', en: 'Mulligan', alias: ['mulligan'], def: 'Cuando tu mano inicial no tiene ningún Pokémon Básico: la enseñas, barajas y robas otra. Tu rival puede robar una carta más por cada mulligan tuyo.', ejemplo: 'Dos mulligans seguidos le dan dos cartas extra al rival.' },
  { id: 'basico', termino: 'Pokémon Básico', en: 'Basic Pokémon', alias: ['pokémon básico', 'pokémon básicos', 'basic pokémon'], def: 'Un Pokémon que se juega directamente desde la mano, sin evolucionar de otro.', ejemplo: 'Dreepy es Básico; Drakloak evoluciona de él.' },
  { id: 'evolucion', termino: 'Evolucionar', en: 'Evolve', alias: ['evolucionar', 'fase 1', 'fase 2', 'stage 1', 'stage 2'], def: 'Poner encima de un Pokémon su evolución. No se puede el primer turno ni con un Pokémon que acaba de entrar.', ejemplo: 'Con Caramelo Raro pasas de Básico a Fase 2 de un salto.' },
  { id: 'entrenador', termino: 'Carta de Entrenador', en: 'Trainer card', alias: ['entrenador', 'entrenadores', 'trainer', 'trainers'], def: 'Las cartas que no son Pokémon ni Energía: Objetos, Partidarios, Estadios y Herramientas.', ejemplo: 'Un mazo típico lleva unas 30 de Entrenador.' },
  { id: 'partidario', termino: 'Partidario', en: 'Supporter', alias: ['partidario', 'partidarios', 'supporter', 'supporters'], def: 'Un Entrenador potente del que solo puedes jugar uno por turno.', ejemplo: 'Investigación de Profesores, Iono o Arven son Partidarios.' },
  { id: 'objeto', termino: 'Objeto', en: 'Item', alias: ['objeto', 'objetos', 'item', 'items'], def: 'Un Entrenador que puedes jugar tantas veces como quieras en tu turno.', ejemplo: 'Ultra Ball y Caramelo Raro son Objetos.' },
  { id: 'estadio', termino: 'Estadio', en: 'Stadium', alias: ['estadio', 'estadios', 'stadium'], def: 'Un Entrenador que se queda en mesa y afecta a los dos jugadores hasta que otro lo sustituye.', ejemplo: 'Ciudad Arcoíris o el Estadio de Artazon.' },
  { id: 'herramienta', termino: 'Herramienta', en: 'Pokémon Tool', alias: ['herramienta', 'herramientas', 'tool'], def: 'Un Entrenador que se une a un Pokémon y le da un efecto mientras siga ahí. Una por Pokémon.', ejemplo: 'Capa Heroica le sube los PS a un Básico.' },
  { id: 'ex', termino: 'Pokémon ex', en: 'Pokémon ex', alias: ['pokémon ex'], def: 'Pokémon más fuertes y con más PS, pero que dan dos Premios al rival cuando caen.', ejemplo: 'Charizard ex, Gardevoir ex.' },
  { id: 'formato', termino: 'Formato Estándar', en: 'Standard format', alias: ['estándar', 'standard'], def: 'El formato oficial de torneos: solo valen las cartas con las marcas de regulación más recientes.', ejemplo: 'En 2026, Estándar es de la marca G en adelante.' },
  { id: 'marca', termino: 'Marca de regulación', en: 'Regulation mark', alias: ['marca de regulación', 'regulation mark'], def: 'La letra en la esquina de abajo de la carta que dice en qué formatos se puede jugar.', ejemplo: 'Una carta con la «H» es legal en Estándar 2026.' },
  { id: 'rotacion', termino: 'Rotación', en: 'Rotation', alias: ['rotación', 'rotation'], def: 'El cambio anual de qué marcas de regulación entran en Estándar: las más viejas dejan de valer.', ejemplo: 'Con la rotación, las cartas con la «F» salen de Estándar.' },
  { id: 'meta', termino: 'Meta', en: 'Metagame', alias: ['meta', 'metagame'], def: 'Los mazos que más se juegan y mejor van en un momento dado.', ejemplo: 'Dragapult ex es el mazo más jugado del meta.' },
  { id: 'decklist', termino: 'Lista', en: 'Decklist', alias: ['decklist', 'decklists'], def: 'Las 60 cartas exactas de un mazo, escritas para poder copiarlas.', ejemplo: 'En un torneo entregas tu lista antes de la primera ronda.' },
  { id: 'suizo', termino: 'Sistema suizo', en: 'Swiss rounds', alias: ['suizo', 'swiss'], def: 'Rondas en las que juegas contra alguien con tu mismo resultado, sin eliminarte. Al final, los mejores pasan al corte.', ejemplo: 'Cinco rondas de suizo y top 8.' },
  { id: 'topcut', termino: 'Corte', en: 'Top cut', alias: ['top cut', 'top 8', 'top 4'], def: 'La eliminatoria del final de un torneo con los mejores del suizo.', ejemplo: 'Con 4-1 entras en el top 8.' },
  { id: 'sir', termino: 'Rara Ilustración Especial', en: 'Special Illustration Rare (SIR)', alias: ['SIR', 'ilustración especial', 'special illustration rare'], def: 'La rareza de las cartas con un dibujo a toda la carta que cuenta una escena. Suelen ser las más caras del set.', ejemplo: 'El Charizard ex SIR de 151.' },
  { id: 'ir', termino: 'Rara Ilustración', en: 'Illustration Rare (IR)', alias: ['IR', 'illustration rare'], def: 'Un Pokémon normal con el dibujo a toda la carta.', ejemplo: 'Las IR de los Pokémon básicos de cada set.' },
  { id: 'reverse', termino: 'Reverse holo', en: 'Reverse holo', alias: ['reverse', 'reverse holo', 'holo invertida'], def: 'La impresión en la que brilla todo MENOS el dibujo. Existe de casi todas las cartas normales.', ejemplo: 'Un Pikachu común y su reverse son dos impresiones de la misma carta.' },
  { id: 'holo', termino: 'Holo', en: 'Holo', alias: ['holo', 'holográfica'], def: 'La impresión en la que brilla el dibujo.', ejemplo: 'El Charizard holo de Base Set.' },
  { id: 'fullart', termino: 'Full art', en: 'Full art', alias: ['full art', 'arte completo'], def: 'Una carta cuyo dibujo ocupa la carta entera, sin marco.', ejemplo: 'Los Partidarios full art de cada set.' },
  { id: 'nm', termino: 'Near Mint', en: 'Near Mint (NM)', alias: ['near mint', 'NM'], def: 'Casi perfecta: como recién sacada del sobre, como mucho con algún detalle mínimo. Es el estado con el que se dan los precios.', ejemplo: 'El precio de Cardmarket es el mínimo de copias Near Mint.' },
  { id: 'gradeo', termino: 'Gradear', en: 'Grading', alias: ['gradear', 'gradeada', 'gradeadas', 'grading', 'PSA'], def: 'Mandar una carta a una empresa (PSA, Beckett, CGC) que la puntúa del 1 al 10 y la sella en una funda rígida.', ejemplo: 'Un PSA 10 vale varias veces lo que la misma carta sin gradear.' },
  { id: 'setmaestro', termino: 'Set maestro', en: 'Master set', alias: ['set maestro', 'master set'], def: 'Un set con TODAS sus impresiones: cada carta en normal y en reverse, y las secretas.', ejemplo: 'El set maestro de 151 son más de 300 cartas.' },
  { id: 'secreta', termino: 'Carta secreta', en: 'Secret rare', alias: ['secreta', 'secretas', 'secret rare'], def: 'Las que van numeradas por encima del total del set (por ejemplo, 201/198).', ejemplo: 'Las doradas suelen ser secretas.' },
  { id: 'binder', termino: 'Binder', en: 'Binder', alias: ['binder', 'archivador'], def: 'El álbum de fundas donde se guardan las cartas, normalmente de 9 o 12 bolsillos por página.', ejemplo: 'Un binder de 9 bolsillos para el set de 151.' },
  { id: 'tcglive', termino: 'JCC Pokémon Live', en: 'Pokémon TCG Live', alias: ['tcg live', 'jcc pokémon live'], def: 'El juego oficial para jugar al TCG en el ordenador y el móvil. Sus listas se pueden copiar y pegar aquí.', ejemplo: 'Pega en el laboratorio la lista que exportas de TCG Live.' },
  // La jerga de la mesa (1170). Las trece primeras las mandó Sergio.M por
  // mensaje; las demás salen de las guías de Competitivo y del foro. El
  // término principal es como se dice en la mesa en español («Brickear»,
  // «Whiffear»), con el inglés al lado; lo mismo dicho de otra forma va en
  // alias. Un alias es también lo que se subraya en guías y foro: nada de
  // verbos sueltos que salgan en cualquier frase («montar», «sacrificar»).
  { id: 'brick', termino: 'Brickear', en: 'Brick', alias: ['brickear', 'brick', 'brickeo', 'mano muerta', 'dead hand'], def: 'Quedarte con una mano que no hace nada: sin Básicos que bajar, sin robo, sin Energía. Lo contrario de salir.', ejemplo: 'Brickeé dos partidas seguidas con Charizard: siete cartas y ni un Charmander.' },
  { id: 'checkmate', termino: 'Checkmate', en: 'Checkmate', alias: ['checkmate', 'jaque mate'], def: 'La mesa en la que el rival ya no puede ganar haga lo que haga: sin ataque que llegue, sin Premios a tiempo.', ejemplo: 'Con dos Premios y un Dragapult cargado contra su único Pokémon, es checkmate.' },
  { id: 'donk', termino: 'Donkear', en: 'Donk', alias: ['donkear', 'donk', 'donkeo'], def: 'Ganar en el primer turno o el segundo porque el rival solo tenía un Pokémon en mesa y lo dejas KO.', ejemplo: 'Salió con un Dreepy solo y le donkearon con un Kangaskhan.' },
  { id: 'whiff', termino: 'Whiffear', en: 'Whiff', alias: ['whiffear', 'whiff', 'whiffeo'], def: 'Buscar o robar y no encontrar lo que necesitabas.', ejemplo: 'Ultra Ball, miro el mazo y whiffeo el Pidgeot.' },
  { id: 'misplay', termino: 'Misplay', en: 'Misplay', alias: ['misplay', 'misplays'], def: 'Un error de juego: hacer algo que no tocaba, o en otro orden, y que cuesta la partida o parte de ella.', ejemplo: 'Jugar el Partidario antes de la Ultra Ball fue un misplay: me faltó una carta para el Rare Candy.' },
  { id: 'gust', termino: 'Gusting', en: 'Gust', alias: ['gusting', 'gustear', 'gust', 'boss'], def: 'Traer un Pokémon de la Banca rival al Activo para atacarlo, normalmente con Órdenes del Jefe.', ejemplo: 'Gustea al Pidgeot ex de la Banca y le haces KO antes de que busque nada.' },
  { id: 'matchup', termino: 'Matchup', en: 'Matchup', alias: ['matchup', 'matchups', 'enfrentamiento'], def: 'Cómo va un mazo contra otro: favorable, igualado o desfavorable.', ejemplo: 'El matchup de Charizard contra Dragapult es el único feo que tiene.' },
  { id: 'mirror', termino: 'Mirror match', en: 'Mirror', alias: ['mirror match', 'mirror', 'espejo'], def: 'Una partida entre dos copias del mismo mazo.', ejemplo: 'En el top 8 hubo tres mirrors de Dragapult.' },
  { id: 'outs', termino: 'Outs', en: 'Outs', alias: ['outs'], def: 'Las cartas que, si las robas ahora, te salvan la partida. Cuantas más queden en el mazo, más posibilidades.', ejemplo: 'Me quedaban tres outs: dos Órdenes del Jefe y una Pokégear.' },
  { id: 'wincon', termino: 'Win condition', en: 'Win condition', alias: ['win condition', 'wincon'], def: 'La manera concreta en que tu mazo gana cuando todo sale: qué ataca, a qué y en cuántos turnos.', ejemplo: 'La win condition de Gardevoir es cargar un Pokémon con Psíquica y coger dos Premios por KO.' },
  { id: 'stall', termino: 'Stalear', en: 'Stall', alias: ['stalear', 'stall'], def: 'Jugar a no perder: aguantar sin atacar, pasar turnos y dejar que el rival se quede sin mazo o sin tiempo.', ejemplo: 'Un mazo de stall con Snorlax te bloquea y espera a que te quedes sin cartas.' },
  { id: 'chip', termino: 'Chip damage', en: 'Chip damage', alias: ['chip damage'], def: 'Daño pequeño, repartido, que no hace KO pero deja al Pokémon a tiro para el golpe siguiente.', ejemplo: 'Con 30 de chip damage, el Dragapult deja a Charizard en rango del segundo ataque.' },
  { id: 'ohko', termino: 'OHKO', en: 'One-hit knock out', alias: ['OHKO', 'one-shot', 'OTK', 'one turn kill', '2HKO'], def: 'Dejar KO a un Pokémon de un solo golpe. Lo contrario es el 2HKO, de dos.', ejemplo: 'Charizard ex hace OHKO a casi todo con 330 de daño.' },
  { id: 'tempo', termino: 'Tempo', en: 'Tempo', alias: ['tempo'], def: 'Ir por delante en el ritmo de la partida: tener montado antes que el rival.', ejemplo: 'Perdí el tempo al whiffear el turno 2 y ya no lo recuperé.' },
  { id: 'tech', termino: 'Carta tech', en: 'Tech card', alias: ['carta tech', 'tech', 'techs'], def: 'Una carta suelta metida para un matchup concreto, no para el plan del mazo.', ejemplo: 'Un Drifloon como tech contra Dragapult.' },
  { id: 'consistencia', termino: 'Consistencia', en: 'Consistency', alias: ['consistencia', 'consistente'], def: 'Lo que un mazo sale igual partida tras partida: cuántas veces monta y cuántas brickea.', ejemplo: 'Con 14 Básicos y 4 Ultra Ball es un mazo muy consistente.' },
  { id: 'setup', termino: 'Montar', en: 'Setup', alias: ['setup', 'montar el mazo'], def: 'Poner en mesa lo que el mazo necesita para funcionar: los Pokémon, las Energías, el motor.', ejemplo: 'Gardevoir tarda dos turnos en montar.' },
  { id: 'motor', termino: 'Motor', en: 'Engine', alias: ['engine', 'motor del mazo'], def: 'Las cartas que hacen que el mazo robe y busque cada turno.', ejemplo: 'El motor de Charizard es Pidgeot ex: una carta cualquiera por turno.' },
  { id: 'premios-cuenta', termino: 'Cuenta de Premios', en: 'Prize map', alias: ['cuenta de premios', 'prize map', 'prize trade'], def: 'Planear en cuántos KO ganas y cuántos necesita el rival: un ex da dos Premios, uno normal da uno.', ejemplo: 'Si pongo a Pidgeot delante, le regalo dos Premios: mala cuenta.' },
  { id: 'sack', termino: 'Sacrificar', en: 'Sack', alias: ['sack', 'sackear'], def: 'Dejar que te hagan KO a un Pokémon a propósito, para ganar tiempo o para que el rival coja menos Premios.', ejemplo: 'Sacrifico un Dreepy: un Premio, y yo monto detrás.' },
  { id: 'deckout', termino: 'Quedarse sin mazo', en: 'Deck out', alias: ['quedarse sin mazo', 'deck out', 'deckear'], def: 'Perder porque te toca robar y no queda ninguna carta. Es como gana el stall.', ejemplo: 'Iba ganando 2 a 4 y me quedé sin mazo.' },
  { id: 'lock', termino: 'Bloqueo', en: 'Lock', alias: ['bloqueo', 'lock', 'item lock'], def: 'Un efecto que impide al rival jugar un tipo de carta (Objetos, Partidarios) o retirarse.', ejemplo: 'El bloqueo de Objetos de Giratina VSTAR.' },
  { id: 'snipe', termino: 'Daño a la Banca', en: 'Snipe / spread', alias: ['daño a la banca', 'snipe', 'spread'], def: 'Atacar a un Pokémon que no es el Activo (snipe), o repartir daño entre varios (spread).', ejemplo: 'Dragapult reparte 60 de daño en la Banca cada turno.' },
  { id: 'salir', termino: 'Salir primero o segundo', en: 'Going first / second', alias: ['salir primero', 'salir segundo', 'going first', 'going second'], def: 'Quien sale primero no puede jugar Partidarios ni atacar en su primer turno; quien sale segundo sí.', ejemplo: 'Con Dragapult prefiero salir segundo.' },
  { id: 'bo3', termino: 'Mejor de tres', en: 'Best of three (Bo3)', alias: ['mejor de tres', 'bo3', 'bo1', 'best of three'], def: 'Una partida de torneo que se juega hasta ganar dos. Bo1 es a una sola.', ejemplo: 'El top 8 es Bo3; el suizo, Bo1.' },
  { id: 'chase', termino: 'Carta estrella', en: 'Chase card', alias: ['carta estrella', 'chase card', 'chase'], def: 'La carta más buscada y más cara de un set, la que todo el mundo quiere sacar.', ejemplo: 'La estrella de Corona Astral es el Pikachu ex SIR.' },
  { id: 'pullrate', termino: 'Ratio de salida', en: 'Pull rate', alias: ['ratio de salida', 'pull rate', 'pull rates'], def: 'Cada cuántos sobres sale una carta de una rareza.', ejemplo: 'Una SIR cada 50 sobres, más o menos.' },
  { id: 'godpack', termino: 'God pack', en: 'God pack', alias: ['god pack'], def: 'Un sobre en el que todas las cartas son raras o especiales. Rarísimo, y sobre todo en el japonés.', ejemplo: 'Abrió un god pack de VSTAR Universe en directo.' },
  { id: 'hit', termino: 'Hit', en: 'Hit', alias: ['hit', 'hits'], def: 'La carta buena de un sobre: la que vale más que el sobre.', ejemplo: 'Diez sobres y un solo hit.' },
  { id: 'bulk', termino: 'Morralla', en: 'Bulk', alias: ['morralla', 'bulk'], def: 'Las cartas comunes y poco comunes que sobran de abrir sobres y casi no valen nada.', ejemplo: 'Vendo la morralla al peso y me quedo los hits.' },
  { id: 'fundas', termino: 'Fundas y toploader', en: 'Sleeves / top loader', alias: ['fundas', 'sleeves', 'toploader', 'top loader'], def: 'La funda blanda que protege cada carta y la funda rígida para las que valen.', ejemplo: 'Las cartas del mazo en fundas; la SIR en toploader.' },
  { id: 'sellado', termino: 'Sellado', en: 'Sealed', alias: ['sellado', 'sealed', 'producto sellado'], def: 'Un producto sin abrir: sobres, cajas, latas. Se colecciona y se revende así.', ejemplo: 'Guardo una caja sellada de 151.' },
]

const normal = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Las formas que se buscan en un texto, de la más larga a la más corta, para
// que «reverse holo» gane a «holo» y «top cut» a «corte».
export function formasDelGlosario(glosario = GLOSARIO) {
  return glosario.flatMap((g) => g.alias.map((a) => ({ forma: normal(a), id: g.id }))).sort((a, b) => b.forma.length - a.forma.length)
}

// Dónde sale cada término por primera vez en un texto: [{ inicio, fin, id }],
// sin solaparse y una sola vez por término. Puro, para poder probarlo.
export function primerasApariciones(texto, formas = formasDelGlosario(), yaVistos = new Set()) {
  const n = normal(texto)
  const fuera = []
  const ocupado = (i, f) => fuera.some((x) => i < x.fin && f > x.inicio)
  for (const { forma, id } of formas) {
    if (yaVistos.has(id)) continue
    const re = new RegExp(`(^|[^a-z0-9ñ])(${forma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^a-z0-9ñ])`, 'g')
    let m
    while ((m = re.exec(n))) {
      const inicio = m.index + m[1].length, fin = inicio + m[2].length
      if (ocupado(inicio, fin)) continue
      fuera.push({ inicio, fin, id })
      yaVistos.add(id)
      break
    }
  }
  return fuera.sort((a, b) => a.inicio - b.inicio)
}
