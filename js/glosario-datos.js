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
