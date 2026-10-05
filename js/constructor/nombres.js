// El nombre INGLÉS de las cartas que el espejo guarda en español
// (tanda 384).
//
// El laboratorio busca el efecto de cada carta por su nombre inglés, que
// es el que no cambia entre reimpresiones (tanda 335). Pero la reparación
// de esa tanda no ha llegado a todas: el 2026-09-30, de las 318 cartas
// más jugadas del meta, 176 tenían el ESPAÑOL en `name` —«Órdenes de
// Jefes», «Pokétableta», «Zoroark ex de N»—. Buscarlas por el inglés
// dejaba media mesa sin efectos, y sin dar error.
//
// La tabla sale de la base, no de memoria: el nombre de la impresión que
// juega el meta (por su código de TCG Live y su número) contra su nombre
// oficial en inglés. Mientras la reparación no acabe, esto es lo que
// casa las dos. Cuando acabe, sobra — y no estorba.
//
// Las claves van normalizadas como las deja `normalizarNombre` (sin
// tildes, en minúsculas, guiones como espacios).
export const INGLES_DE = {
  'ordenes de jefes': "boss's orders", poketableta: 'poke pad', 'pokochos gemelos': 'buddy buddy poffin', 'camilla nocturna': 'night stretcher',
  denis: 'crispin', 'determinacion de lylia': "lillie's determination", 'sello injusto': 'unfair stamp', 'apoyo de nanci': "rosa's encouragement",
  'ruinas peligrosas': 'risky ruins', 'martillo demoledor': 'crushing hammer', 'tarjeta roja especial': 'special red card', juez: 'judge',
  'energia fuego': 'fire energy', 'energia psiquica': 'psychic energy', 'energia oscura': 'darkness energy',
  'zorua de n': "n's zorua", 'zoroark ex de n': "n's zoroark ex", 'zekrom de n': "n's zekrom", 'reshiram de n': "n's reshiram",
  'darumaka de n': "n's darumaka", 'darmanitan de n': "n's darmanitan", 'mas pp de n': "n's pp up", mirtilo: 'cyrano',
  'entrenamiento de karateka': "black belt's training", 'mochi cadena': 'binding mochi', 'palacio de n': "n's castle", 'caja secreta': 'secret box',
  'torre de defensa del team rocket': "team rocket's watchtower", 'tomo de transformacion': 'transformation tome', 'artes secretas de sachiko': "janine's secret art",
  'globo helio': 'air balloon', 'clefairy ex de lylia': "lillie's clefairy ex", 'academia de noche': 'academy at night', 'refuerzo prodigioso': 'wondrous patch',
  'ciberentusiasta descifracodigos': "ciphermaniac's codebreaking", cambio: 'switch', 'capturador supremo': 'prime catcher', 'casco suerte': 'lucky helmet',
  'pulsera osada': 'brave bangle', surfista: 'surfer', 'energia psychic telepatica': 'telepathic psychic energy', 'energia bumeran': 'boomerang energy',
  'torre de interferencia': 'jamming tower', maya: 'dawn', 'caramelo raro': 'rare candy', liza: 'hilda', 'ceniza sagrada': 'sacred ash',
  'jaula de combate': 'battle cage', 'ayuda de nereida': "lana's aid", erin: 'eri', 'martillo mejorado': 'enhanced hammer', 'ventilador de mano': 'handheld fan',
  'mina nocturna': 'nighttime mine', 'energia enriquecedora': 'enriching energy', 'ogerpon mascara turquesa ex': 'teal mask ogerpon ex',
  'ogerpon mascara fuente ex': 'wellspring mask ogerpon ex', 'ferroverdor ex': 'iron leaves ex', 'electrofuria ex': 'raging bolt ex', 'ferrotesta ex': 'iron crown ex',
  'interruptor de energia': 'energy switch', 'caverna abisal cero': 'area zero underdepths', 'trompeta de cristal': 'glass trumpet', 'capa de heroes': "hero's cape",
  'petrel del team rocket': "team rocket's petrel", 'helado colosal': 'jumbo ice cream', 'reciclaje de energia': 'energy recycler', cass: 'kieran',
  'exploracion de brock': "brock's scouting", 'walkie talkie del team rocket': "team rocket's transceiver", 'carrito valioso': 'precious trolley',
  'montana gravedad': 'gravity mountain', 'energia metalica': 'metal energy', 'ursaluna luna carmesi ex': 'bloodmoon ursaluna ex', 'torre prisma': 'prism tower',
  inma: 'gwynn', 'guia de exploracion': "explorer's guidance", 'batidora esplendida': 'brilliant blender', 'energia legado': 'legacy energy',
  'recinto del festival': 'festival grounds', 'combate final de gladio': "gladion's final battle", 'kit capturabichos': 'bug catching set',
  reciclaherramientas: 'tool scrapper', 'bosque vitalidad': 'forest of vitality', 'energia grass creciente': 'growing grass energy', 'rotom ventilador': 'fan rotom',
  'compasion de blasco': "wally's compassion", 'energia neblina': 'mist energy', 'energia prisma': 'prism energy', 'maquinaciones de xero': "xerosic's machinations",
  'chica del centro pokemon': 'pokemon center lady', 'fabrica del team rocket': "team rocket's factory", 'ciudad luminalia': 'lumiose city',
  'energia espinosa': 'spiky energy', 'gong de lucha': 'fighting gong', 'potencia premium plus': 'premium power pro', 'energia fighting rocosa': 'rocky fighting energy',
  brie: 'briar', 'reloj extrano': 'strange timepiece', 'murkrow del team rocket': "team rocket's murkrow", 'honchkrow del team rocket': "team rocket's honchkrow",
  'porygon del team rocket': "team rocket's porygon", 'articuno del team rocket': "team rocket's articuno", 'porygon2 del team rocket': "team rocket's porygon2",
  'atlas del team rocket': "team rocket's archer", 'atenea del team rocket': "team rocket's ariana", 'proton del team rocket': "team rocket's proton",
  'giovanni del team rocket': "team rocket's giovanni", 'paloselfi rotom': 'roto stick', 'auriculares milagrosos': 'miracle headset',
  'energia del team rocket': "team rocket's energy", 'energia ignicion': 'ignition energy', 'impidimp de roxy': "marnie's impidimp",
  'grimmsnarl ex de roxy': "marnie's grimmsnarl ex", 'morgrem de roxy': "marnie's morgrem", 'gimnasio de pueblo crampon': 'spikemuth gym',
  'gible de cintia': "cynthia's gible", 'gabite de cintia': "cynthia's gabite", 'roselia de cintia': "cynthia's roselia", 'roserade de cintia': "cynthia's roserade",
  'garchomp ex de cintia': "cynthia's garchomp ex", 'spiritomb de cintia': "cynthia's spiritomb", 'pesa recia de cintia': "cynthia's power weight",
  'energia neosuperior': 'neo upper energy', melenaleteo: 'flutter mane', silvio: 'salvatore', 'playa surfera': 'surfing beach',
  'recuperacion de energia': 'energy retrieval', 'tarountula del team rocket': "team rocket's tarountula", 'spidops del team rocket': "team rocket's spidops",
  'mewtwo ex del team rocket': "team rocket's mewtwo ex", 'mimikyu del team rocket': "team rocket's mimikyu", 'sneasel del team rocket': "team rocket's sneasel",
  'cinturon colosal': 'maximum belt', 'arbol colosal': 'grand tree', 'tenacidad de acromo': "colress's tenacity", 'energia water burbujeante': 'bubbly water energy',
  'entrada canjeable': 'redeemable ticket', maxicana: 'max rod', 'beldum de maximo': "steven's beldum", 'metagross ex de maximo': "steven's metagross ex",
  'metang de maximo': "steven's metang", furioseta: 'brute bonnet', 'conviccion de morti': "morty's conviction", hesperio: 'hassel',
  'phantump de paul': "hop's phantump", 'trevenant de paul': "hop's trevenant", 'snorlax de paul': "hop's snorlax", 'cramorant de paul': "hop's cramorant",
  'dubwool de paul': "hop's dubwool", 'wooloo de paul': "hop's wooloo", 'zacian ex de paul': "hop's zacian ex", 'cinta eleccion de paul': "hop's choice band",
  'pueblo yarda': 'postwick', 'bolsa de paul': "hop's bag", 'macarra ♂': 'ruffian', 'colagrito ex': 'scream tail ex', 'ocaso ball': 'dusk ball',
  'recortadora de mano': 'hand trimmer', megasenal: 'mega signal', 'busqueda de energia': 'energy search', 'ogerpon mascara cimiento ex': 'cornerstone mask ogerpon ex',
  'cyndaquil de eco': "ethan's cyndaquil", 'quilava de eco': "ethan's quilava", 'typhlosion de eco': "ethan's typhlosion", 'aventura de eco': "ethan's adventure",
  'tranquilidad de a. z.': "az's tranquility", 'tauros de paldea': 'paldean tauros', 'perla de lylia': "lillie's pearl",
  'kilowattrel de e nigma': "iono's kilowattrel", 'wattrel de e nigma': "iono's wattrel", naria: 'canari', 'energia lightning voltaica': 'voltaic lightning energy',
  'campanilla oscuridad': 'dark bell', 'estadio animado': 'lively stadium', 'laser peligroso': 'dangerous laser', 'energia darkness sombria': 'shadowy darkness energy',
  // Los clásicos que siguen vivos en Expandido (comprobados por su
  // identificador en la misma consulta).
  'nido ball': 'nest ball', 'investigacion de profesores': "professor's research", 'capturador contraataque': 'counter catcher', 'super ball': 'great ball',
  damian: 'arven', 'bloc de amigos': 'pal pad', noa: 'penny', 'e nigma': 'iono', supercana: 'super rod', 'vasija terrestre': 'earthen vessel',
  'plan del profesor turo': "professor turo's scenario", 'ogerpon mascara horno ex': 'hearthflame mask ogerpon ex', corin: 'carmine', nakara: 'irida',
  'nivel ball': 'level ball', 'pase de combate vip': 'battle vip pass',
  // Las dos energías de me04 que faltaban (tanda 629).
  'energia metal magnetica': 'magnetic metal energy', 'energia fire nitro': 'nitro fire energy',
}

// Y las energías con el tipo YA traducido (tanda 629): TCGdex escribe
// «Energía Psychic Telepática», la migración de esa tanda lo deja como en
// la carta —«Energía Psíquica Telepática»—, y el efecto tiene que seguir
// encontrándose con las dos.
const TIPO_EN_ESPANOL = { grass: 'planta', fire: 'fuego', water: 'agua', lightning: 'rayo', psychic: 'psiquica', fighting: 'lucha', darkness: 'oscura', metal: 'metalica', fairy: 'hada', dragon: 'dragon', colorless: 'incolora' }
for (const [es, en] of Object.entries(INGLES_DE)) {
  const m = es.match(/^energia (grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy|dragon|colorless)( .+)$/)
  if (m) INGLES_DE[`energia ${TIPO_EN_ESPANOL[m[1]]}${m[2]}`] = en
}
