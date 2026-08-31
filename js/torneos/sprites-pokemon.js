// Los 1025 Pokémon en orden de Pokédex, para sacar su minisprite
// (tanda 231). GENERADO — no se edita a mano.
//
// CÓMO SE REGENERA (hace falta salida a npm, no a internet abierto):
//
//   mkdir /tmp/gen && cd /tmp/gen
//   npm install pokemon --no-save
//   node -e …   ← el guion está en SCHEMA.md, tanda 231
//
// El paquete `pokemon` se usa SOLO para generar esto y NO queda como
// dependencia: la norma de la casa es cero dependencias de npm en el
// cliente, y esto es un fichero de datos, no una librería.
//
// El número de Pokédex es la POSICIÓN + 1. Está comprobado al generar
// (0 desajustes sobre 1025): si no lo fuera, la tabla saldría desplazada
// y TODOS los sprites serían el Pokémon de al lado, que es un fallo que
// no canta a simple vista.
//
// Nidoran♀ y Nidoran♂ colapsan en el mismo nombre al quitarles el
// símbolo. Se queda la hembra (la primera). Ninguno de los dos da
// nombre a un mazo, así que da igual cuál.
export const POKEMON_POR_DEX = [
  "bulbasaur", "ivysaur", "venusaur", "charmander", "charmeleon", "charizard", "squirtle", "wartortle",
  "blastoise", "caterpie", "metapod", "butterfree", "weedle", "kakuna", "beedrill", "pidgey",
  "pidgeotto", "pidgeot", "rattata", "raticate", "spearow", "fearow", "ekans", "arbok",
  "pikachu", "raichu", "sandshrew", "sandslash", "nidoran", "nidorina", "nidoqueen", "nidoran",
  "nidorino", "nidoking", "clefairy", "clefable", "vulpix", "ninetales", "jigglypuff", "wigglytuff",
  "zubat", "golbat", "oddish", "gloom", "vileplume", "paras", "parasect", "venonat",
  "venomoth", "diglett", "dugtrio", "meowth", "persian", "psyduck", "golduck", "mankey",
  "primeape", "growlithe", "arcanine", "poliwag", "poliwhirl", "poliwrath", "abra", "kadabra",
  "alakazam", "machop", "machoke", "machamp", "bellsprout", "weepinbell", "victreebel", "tentacool",
  "tentacruel", "geodude", "graveler", "golem", "ponyta", "rapidash", "slowpoke", "slowbro",
  "magnemite", "magneton", "farfetchd", "doduo", "dodrio", "seel", "dewgong", "grimer",
  "muk", "shellder", "cloyster", "gastly", "haunter", "gengar", "onix", "drowzee",
  "hypno", "krabby", "kingler", "voltorb", "electrode", "exeggcute", "exeggutor", "cubone",
  "marowak", "hitmonlee", "hitmonchan", "lickitung", "koffing", "weezing", "rhyhorn", "rhydon",
  "chansey", "tangela", "kangaskhan", "horsea", "seadra", "goldeen", "seaking", "staryu",
  "starmie", "mrmime", "scyther", "jynx", "electabuzz", "magmar", "pinsir", "tauros",
  "magikarp", "gyarados", "lapras", "ditto", "eevee", "vaporeon", "jolteon", "flareon",
  "porygon", "omanyte", "omastar", "kabuto", "kabutops", "aerodactyl", "snorlax", "articuno",
  "zapdos", "moltres", "dratini", "dragonair", "dragonite", "mewtwo", "mew", "chikorita",
  "bayleef", "meganium", "cyndaquil", "quilava", "typhlosion", "totodile", "croconaw", "feraligatr",
  "sentret", "furret", "hoothoot", "noctowl", "ledyba", "ledian", "spinarak", "ariados",
  "crobat", "chinchou", "lanturn", "pichu", "cleffa", "igglybuff", "togepi", "togetic",
  "natu", "xatu", "mareep", "flaaffy", "ampharos", "bellossom", "marill", "azumarill",
  "sudowoodo", "politoed", "hoppip", "skiploom", "jumpluff", "aipom", "sunkern", "sunflora",
  "yanma", "wooper", "quagsire", "espeon", "umbreon", "murkrow", "slowking", "misdreavus",
  "unown", "wobbuffet", "girafarig", "pineco", "forretress", "dunsparce", "gligar", "steelix",
  "snubbull", "granbull", "qwilfish", "scizor", "shuckle", "heracross", "sneasel", "teddiursa",
  "ursaring", "slugma", "magcargo", "swinub", "piloswine", "corsola", "remoraid", "octillery",
  "delibird", "mantine", "skarmory", "houndour", "houndoom", "kingdra", "phanpy", "donphan",
  "porygon2", "stantler", "smeargle", "tyrogue", "hitmontop", "smoochum", "elekid", "magby",
  "miltank", "blissey", "raikou", "entei", "suicune", "larvitar", "pupitar", "tyranitar",
  "lugia", "hooh", "celebi", "treecko", "grovyle", "sceptile", "torchic", "combusken",
  "blaziken", "mudkip", "marshtomp", "swampert", "poochyena", "mightyena", "zigzagoon", "linoone",
  "wurmple", "silcoon", "beautifly", "cascoon", "dustox", "lotad", "lombre", "ludicolo",
  "seedot", "nuzleaf", "shiftry", "taillow", "swellow", "wingull", "pelipper", "ralts",
  "kirlia", "gardevoir", "surskit", "masquerain", "shroomish", "breloom", "slakoth", "vigoroth",
  "slaking", "nincada", "ninjask", "shedinja", "whismur", "loudred", "exploud", "makuhita",
  "hariyama", "azurill", "nosepass", "skitty", "delcatty", "sableye", "mawile", "aron",
  "lairon", "aggron", "meditite", "medicham", "electrike", "manectric", "plusle", "minun",
  "volbeat", "illumise", "roselia", "gulpin", "swalot", "carvanha", "sharpedo", "wailmer",
  "wailord", "numel", "camerupt", "torkoal", "spoink", "grumpig", "spinda", "trapinch",
  "vibrava", "flygon", "cacnea", "cacturne", "swablu", "altaria", "zangoose", "seviper",
  "lunatone", "solrock", "barboach", "whiscash", "corphish", "crawdaunt", "baltoy", "claydol",
  "lileep", "cradily", "anorith", "armaldo", "feebas", "milotic", "castform", "kecleon",
  "shuppet", "banette", "duskull", "dusclops", "tropius", "chimecho", "absol", "wynaut",
  "snorunt", "glalie", "spheal", "sealeo", "walrein", "clamperl", "huntail", "gorebyss",
  "relicanth", "luvdisc", "bagon", "shelgon", "salamence", "beldum", "metang", "metagross",
  "regirock", "regice", "registeel", "latias", "latios", "kyogre", "groudon", "rayquaza",
  "jirachi", "deoxys", "turtwig", "grotle", "torterra", "chimchar", "monferno", "infernape",
  "piplup", "prinplup", "empoleon", "starly", "staravia", "staraptor", "bidoof", "bibarel",
  "kricketot", "kricketune", "shinx", "luxio", "luxray", "budew", "roserade", "cranidos",
  "rampardos", "shieldon", "bastiodon", "burmy", "wormadam", "mothim", "combee", "vespiquen",
  "pachirisu", "buizel", "floatzel", "cherubi", "cherrim", "shellos", "gastrodon", "ambipom",
  "drifloon", "drifblim", "buneary", "lopunny", "mismagius", "honchkrow", "glameow", "purugly",
  "chingling", "stunky", "skuntank", "bronzor", "bronzong", "bonsly", "mimejr", "happiny",
  "chatot", "spiritomb", "gible", "gabite", "garchomp", "munchlax", "riolu", "lucario",
  "hippopotas", "hippowdon", "skorupi", "drapion", "croagunk", "toxicroak", "carnivine", "finneon",
  "lumineon", "mantyke", "snover", "abomasnow", "weavile", "magnezone", "lickilicky", "rhyperior",
  "tangrowth", "electivire", "magmortar", "togekiss", "yanmega", "leafeon", "glaceon", "gliscor",
  "mamoswine", "porygonz", "gallade", "probopass", "dusknoir", "froslass", "rotom", "uxie",
  "mesprit", "azelf", "dialga", "palkia", "heatran", "regigigas", "giratina", "cresselia",
  "phione", "manaphy", "darkrai", "shaymin", "arceus", "victini", "snivy", "servine",
  "serperior", "tepig", "pignite", "emboar", "oshawott", "dewott", "samurott", "patrat",
  "watchog", "lillipup", "herdier", "stoutland", "purrloin", "liepard", "pansage", "simisage",
  "pansear", "simisear", "panpour", "simipour", "munna", "musharna", "pidove", "tranquill",
  "unfezant", "blitzle", "zebstrika", "roggenrola", "boldore", "gigalith", "woobat", "swoobat",
  "drilbur", "excadrill", "audino", "timburr", "gurdurr", "conkeldurr", "tympole", "palpitoad",
  "seismitoad", "throh", "sawk", "sewaddle", "swadloon", "leavanny", "venipede", "whirlipede",
  "scolipede", "cottonee", "whimsicott", "petilil", "lilligant", "basculin", "sandile", "krokorok",
  "krookodile", "darumaka", "darmanitan", "maractus", "dwebble", "crustle", "scraggy", "scrafty",
  "sigilyph", "yamask", "cofagrigus", "tirtouga", "carracosta", "archen", "archeops", "trubbish",
  "garbodor", "zorua", "zoroark", "minccino", "cinccino", "gothita", "gothorita", "gothitelle",
  "solosis", "duosion", "reuniclus", "ducklett", "swanna", "vanillite", "vanillish", "vanilluxe",
  "deerling", "sawsbuck", "emolga", "karrablast", "escavalier", "foongus", "amoonguss", "frillish",
  "jellicent", "alomomola", "joltik", "galvantula", "ferroseed", "ferrothorn", "klink", "klang",
  "klinklang", "tynamo", "eelektrik", "eelektross", "elgyem", "beheeyem", "litwick", "lampent",
  "chandelure", "axew", "fraxure", "haxorus", "cubchoo", "beartic", "cryogonal", "shelmet",
  "accelgor", "stunfisk", "mienfoo", "mienshao", "druddigon", "golett", "golurk", "pawniard",
  "bisharp", "bouffalant", "rufflet", "braviary", "vullaby", "mandibuzz", "heatmor", "durant",
  "deino", "zweilous", "hydreigon", "larvesta", "volcarona", "cobalion", "terrakion", "virizion",
  "tornadus", "thundurus", "reshiram", "zekrom", "landorus", "kyurem", "keldeo", "meloetta",
  "genesect", "chespin", "quilladin", "chesnaught", "fennekin", "braixen", "delphox", "froakie",
  "frogadier", "greninja", "bunnelby", "diggersby", "fletchling", "fletchinder", "talonflame", "scatterbug",
  "spewpa", "vivillon", "litleo", "pyroar", "flabebe", "floette", "florges", "skiddo",
  "gogoat", "pancham", "pangoro", "furfrou", "espurr", "meowstic", "honedge", "doublade",
  "aegislash", "spritzee", "aromatisse", "swirlix", "slurpuff", "inkay", "malamar", "binacle",
  "barbaracle", "skrelp", "dragalge", "clauncher", "clawitzer", "helioptile", "heliolisk", "tyrunt",
  "tyrantrum", "amaura", "aurorus", "sylveon", "hawlucha", "dedenne", "carbink", "goomy",
  "sliggoo", "goodra", "klefki", "phantump", "trevenant", "pumpkaboo", "gourgeist", "bergmite",
  "avalugg", "noibat", "noivern", "xerneas", "yveltal", "zygarde", "diancie", "hoopa",
  "volcanion", "rowlet", "dartrix", "decidueye", "litten", "torracat", "incineroar", "popplio",
  "brionne", "primarina", "pikipek", "trumbeak", "toucannon", "yungoos", "gumshoos", "grubbin",
  "charjabug", "vikavolt", "crabrawler", "crabominable", "oricorio", "cutiefly", "ribombee", "rockruff",
  "lycanroc", "wishiwashi", "mareanie", "toxapex", "mudbray", "mudsdale", "dewpider", "araquanid",
  "fomantis", "lurantis", "morelull", "shiinotic", "salandit", "salazzle", "stufful", "bewear",
  "bounsweet", "steenee", "tsareena", "comfey", "oranguru", "passimian", "wimpod", "golisopod",
  "sandygast", "palossand", "pyukumuku", "typenull", "silvally", "minior", "komala", "turtonator",
  "togedemaru", "mimikyu", "bruxish", "drampa", "dhelmise", "jangmoo", "hakamoo", "kommoo",
  "tapukoko", "tapulele", "tapubulu", "tapufini", "cosmog", "cosmoem", "solgaleo", "lunala",
  "nihilego", "buzzwole", "pheromosa", "xurkitree", "celesteela", "kartana", "guzzlord", "necrozma",
  "magearna", "marshadow", "poipole", "naganadel", "stakataka", "blacephalon", "zeraora", "meltan",
  "melmetal", "grookey", "thwackey", "rillaboom", "scorbunny", "raboot", "cinderace", "sobble",
  "drizzile", "inteleon", "skwovet", "greedent", "rookidee", "corvisquire", "corviknight", "blipbug",
  "dottler", "orbeetle", "nickit", "thievul", "gossifleur", "eldegoss", "wooloo", "dubwool",
  "chewtle", "drednaw", "yamper", "boltund", "rolycoly", "carkol", "coalossal", "applin",
  "flapple", "appletun", "silicobra", "sandaconda", "cramorant", "arrokuda", "barraskewda", "toxel",
  "toxtricity", "sizzlipede", "centiskorch", "clobbopus", "grapploct", "sinistea", "polteageist", "hatenna",
  "hattrem", "hatterene", "impidimp", "morgrem", "grimmsnarl", "obstagoon", "perrserker", "cursola",
  "sirfetchd", "mrrime", "runerigus", "milcery", "alcremie", "falinks", "pincurchin", "snom",
  "frosmoth", "stonjourner", "eiscue", "indeedee", "morpeko", "cufant", "copperajah", "dracozolt",
  "arctozolt", "dracovish", "arctovish", "duraludon", "dreepy", "drakloak", "dragapult", "zacian",
  "zamazenta", "eternatus", "kubfu", "urshifu", "zarude", "regieleki", "regidrago", "glastrier",
  "spectrier", "calyrex", "wyrdeer", "kleavor", "ursaluna", "basculegion", "sneasler", "overqwil",
  "enamorus", "sprigatito", "floragato", "meowscarada", "fuecoco", "crocalor", "skeledirge", "quaxly",
  "quaxwell", "quaquaval", "lechonk", "oinkologne", "tarountula", "spidops", "nymble", "lokix",
  "pawmi", "pawmo", "pawmot", "tandemaus", "maushold", "fidough", "dachsbun", "smoliv",
  "dolliv", "arboliva", "squawkabilly", "nacli", "naclstack", "garganacl", "charcadet", "armarouge",
  "ceruledge", "tadbulb", "bellibolt", "wattrel", "kilowattrel", "maschiff", "mabosstiff", "shroodle",
  "grafaiai", "bramblin", "brambleghast", "toedscool", "toedscruel", "klawf", "capsakid", "scovillain",
  "rellor", "rabsca", "flittle", "espathra", "tinkatink", "tinkatuff", "tinkaton", "wiglett",
  "wugtrio", "bombirdier", "finizen", "palafin", "varoom", "revavroom", "cyclizar", "orthworm",
  "glimmet", "glimmora", "greavard", "houndstone", "flamigo", "cetoddle", "cetitan", "veluza",
  "dondozo", "tatsugiri", "annihilape", "clodsire", "farigiraf", "dudunsparce", "kingambit", "greattusk",
  "screamtail", "brutebonnet", "fluttermane", "slitherwing", "sandyshocks", "irontreads", "ironbundle", "ironhands",
  "ironjugulis", "ironmoth", "ironthorns", "frigibax", "arctibax", "baxcalibur", "gimmighoul", "gholdengo",
  "wochien", "chienpao", "tinglu", "chiyu", "roaringmoon", "ironvaliant", "koraidon", "miraidon",
  "walkingwake", "ironleaves", "dipplin", "poltchageist", "sinistcha", "okidogi", "munkidori", "fezandipiti",
  "ogerpon", "archaludon", "hydrapple", "gougingfire", "ragingbolt", "ironboulder", "ironcrown", "terapagos",
  "pecharunt",
]

// ── De «Dragapult ex» a su minisprite ──
//
// El nombre que llega es el de la carta, y una carta NO se llama como la
// especie: lleva sufijos («ex», «V», «VMAX»), formas regionales
// («Alolan Ninetales») y, desde la novena generación, el nombre del
// entrenador delante («Iono's Bellibolt»).
//
// En vez de una lista de sufijos que se queda corta cada temporada, se
// prueban TODOS los trozos seguidos del nombre, del más largo al más
// corto, y se coge el primero que sea una especie. «Iono's Bellibolt» va
// probando [ionos bellibolt] → [ionos] → [bellibolt] ✓, y «Dragapult
// ex» → [dragapult ex] → [dragapult] ✓. Lo que no case con ninguna
// especie (un Trainer, un objeto) no tiene sprite y se queda con la
// miniatura de la carta, que es lo correcto.
//
// OJO con las formas regionales: «Alolan Ninetales» acaba en el sprite
// de Ninetales a secas. Es la especie correcta con la forma equivocada.
// Los sprites de las formas viven en otros números de la Pokédex
// (>10000) que este fichero no trae; enseñar el Ninetales de Kanto es
// mejor que no enseñar nada, y para reconocer un mazo de un vistazo
// sirve igual.

const DEX_POR_NOMBRE = new Map()
for (let i = 0; i < POKEMON_POR_DEX.length; i++) {
  // El primero gana: Nidoran♀ y Nidoran♂ colapsan en el mismo nombre.
  if (!DEX_POR_NOMBRE.has(POKEMON_POR_DEX[i])) DEX_POR_NOMBRE.set(POKEMON_POR_DEX[i], i + 1)
}

// Misma normalización que se usó al generar la tabla: sin tildes, sin
// mayúsculas y sin nada que no sea letra o número. Es lo que hace que
// «Farfetch'd», «Mr. Mime» y «Ho-Oh» encuentren su número.
function aplastar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// El número de Pokédex de la especie que nombra esta carta, o null.
export function dexDeCarta(nombreDeCarta) {
  const palabras = String(nombreDeCarta ?? '')
    .split(/\s+/)
    .filter(Boolean)
  if (!palabras.length) return null

  // Trozos seguidos, del más largo al más corto. Del mismo largo, el que
  // empieza antes: «Iron Valiant ex» tiene que dar Iron Valiant y no
  // Valiant a secas (si existiera).
  for (let largo = palabras.length; largo >= 1; largo--) {
    for (let desde = 0; desde + largo <= palabras.length; desde++) {
      const dex = DEX_POR_NOMBRE.get(aplastar(palabras.slice(desde, desde + largo).join('')))
      if (dex) return dex
    }
  }
  return null
}

// De dónde salen los sprites: el repositorio de PokéAPI servido por
// jsDelivr, que es una CDN pública hecha precisamente para esto (a
// diferencia de raw.githubusercontent.com, que pide que no se enlace
// desde una web). Mismo trato que las imágenes de las cartas, que
// también se enlazan a la CDN de TCGdex en vez de copiarlas.
//
// Se usa `sprites/pokemon/<n>.png` y NO los de la quinta generación
// (más bonitos, en píxel): esos solo llegan hasta el 649, y la mitad de
// los mazos de hoy son de la octava y la novena. Un sprite que falta
// para justo los Pokémon que interesan no sirve de nada.
const CDN_SPRITES = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'

export function urlDeSprite(dex) {
  return dex ? `${CDN_SPRITES}/${dex}.png` : null
}

// El atajo: nombre de carta → URL del sprite, o null si no es un Pokémon.
export function spriteDeCarta(nombreDeCarta) {
  return urlDeSprite(dexDeCarta(nombreDeCarta))
}
