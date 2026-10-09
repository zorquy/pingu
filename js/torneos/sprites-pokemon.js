// Los 1025 Pokémon en orden de Pokédex, para sacar su minisprite y para
// el buscador de mazos (tandas 231 y 233). GENERADO — no se edita a mano.
//
// Se guardan los nombres COMO SE ESCRIBEN («Iron Valiant», «Mr. Mime»)
// y no aplastados: aplastados ocupan casi lo mismo y no se pueden
// deshacer —no sabemos dónde iban los espacios—, así que el buscador
// enseñaría «Ironvaliant». La versión aplastada se calcula al cargar.
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
// símbolo. Se queda la hembra (la primera) para BUSCAR; en la lista
// siguen los dos con su nombre entero. Ninguno da nombre a un mazo.
export const POKEMON_POR_DEX = [
  "Bulbasaur", "Ivysaur", "Venusaur", "Charmander", "Charmeleon", "Charizard",
  "Squirtle", "Wartortle", "Blastoise", "Caterpie", "Metapod", "Butterfree",
  "Weedle", "Kakuna", "Beedrill", "Pidgey", "Pidgeotto", "Pidgeot",
  "Rattata", "Raticate", "Spearow", "Fearow", "Ekans", "Arbok",
  "Pikachu", "Raichu", "Sandshrew", "Sandslash", "Nidoran♀", "Nidorina",
  "Nidoqueen", "Nidoran♂", "Nidorino", "Nidoking", "Clefairy", "Clefable",
  "Vulpix", "Ninetales", "Jigglypuff", "Wigglytuff", "Zubat", "Golbat",
  "Oddish", "Gloom", "Vileplume", "Paras", "Parasect", "Venonat",
  "Venomoth", "Diglett", "Dugtrio", "Meowth", "Persian", "Psyduck",
  "Golduck", "Mankey", "Primeape", "Growlithe", "Arcanine", "Poliwag",
  "Poliwhirl", "Poliwrath", "Abra", "Kadabra", "Alakazam", "Machop",
  "Machoke", "Machamp", "Bellsprout", "Weepinbell", "Victreebel", "Tentacool",
  "Tentacruel", "Geodude", "Graveler", "Golem", "Ponyta", "Rapidash",
  "Slowpoke", "Slowbro", "Magnemite", "Magneton", "Farfetch'd", "Doduo",
  "Dodrio", "Seel", "Dewgong", "Grimer", "Muk", "Shellder",
  "Cloyster", "Gastly", "Haunter", "Gengar", "Onix", "Drowzee",
  "Hypno", "Krabby", "Kingler", "Voltorb", "Electrode", "Exeggcute",
  "Exeggutor", "Cubone", "Marowak", "Hitmonlee", "Hitmonchan", "Lickitung",
  "Koffing", "Weezing", "Rhyhorn", "Rhydon", "Chansey", "Tangela",
  "Kangaskhan", "Horsea", "Seadra", "Goldeen", "Seaking", "Staryu",
  "Starmie", "Mr. Mime", "Scyther", "Jynx", "Electabuzz", "Magmar",
  "Pinsir", "Tauros", "Magikarp", "Gyarados", "Lapras", "Ditto",
  "Eevee", "Vaporeon", "Jolteon", "Flareon", "Porygon", "Omanyte",
  "Omastar", "Kabuto", "Kabutops", "Aerodactyl", "Snorlax", "Articuno",
  "Zapdos", "Moltres", "Dratini", "Dragonair", "Dragonite", "Mewtwo",
  "Mew", "Chikorita", "Bayleef", "Meganium", "Cyndaquil", "Quilava",
  "Typhlosion", "Totodile", "Croconaw", "Feraligatr", "Sentret", "Furret",
  "Hoothoot", "Noctowl", "Ledyba", "Ledian", "Spinarak", "Ariados",
  "Crobat", "Chinchou", "Lanturn", "Pichu", "Cleffa", "Igglybuff",
  "Togepi", "Togetic", "Natu", "Xatu", "Mareep", "Flaaffy",
  "Ampharos", "Bellossom", "Marill", "Azumarill", "Sudowoodo", "Politoed",
  "Hoppip", "Skiploom", "Jumpluff", "Aipom", "Sunkern", "Sunflora",
  "Yanma", "Wooper", "Quagsire", "Espeon", "Umbreon", "Murkrow",
  "Slowking", "Misdreavus", "Unown", "Wobbuffet", "Girafarig", "Pineco",
  "Forretress", "Dunsparce", "Gligar", "Steelix", "Snubbull", "Granbull",
  "Qwilfish", "Scizor", "Shuckle", "Heracross", "Sneasel", "Teddiursa",
  "Ursaring", "Slugma", "Magcargo", "Swinub", "Piloswine", "Corsola",
  "Remoraid", "Octillery", "Delibird", "Mantine", "Skarmory", "Houndour",
  "Houndoom", "Kingdra", "Phanpy", "Donphan", "Porygon2", "Stantler",
  "Smeargle", "Tyrogue", "Hitmontop", "Smoochum", "Elekid", "Magby",
  "Miltank", "Blissey", "Raikou", "Entei", "Suicune", "Larvitar",
  "Pupitar", "Tyranitar", "Lugia", "Ho-Oh", "Celebi", "Treecko",
  "Grovyle", "Sceptile", "Torchic", "Combusken", "Blaziken", "Mudkip",
  "Marshtomp", "Swampert", "Poochyena", "Mightyena", "Zigzagoon", "Linoone",
  "Wurmple", "Silcoon", "Beautifly", "Cascoon", "Dustox", "Lotad",
  "Lombre", "Ludicolo", "Seedot", "Nuzleaf", "Shiftry", "Taillow",
  "Swellow", "Wingull", "Pelipper", "Ralts", "Kirlia", "Gardevoir",
  "Surskit", "Masquerain", "Shroomish", "Breloom", "Slakoth", "Vigoroth",
  "Slaking", "Nincada", "Ninjask", "Shedinja", "Whismur", "Loudred",
  "Exploud", "Makuhita", "Hariyama", "Azurill", "Nosepass", "Skitty",
  "Delcatty", "Sableye", "Mawile", "Aron", "Lairon", "Aggron",
  "Meditite", "Medicham", "Electrike", "Manectric", "Plusle", "Minun",
  "Volbeat", "Illumise", "Roselia", "Gulpin", "Swalot", "Carvanha",
  "Sharpedo", "Wailmer", "Wailord", "Numel", "Camerupt", "Torkoal",
  "Spoink", "Grumpig", "Spinda", "Trapinch", "Vibrava", "Flygon",
  "Cacnea", "Cacturne", "Swablu", "Altaria", "Zangoose", "Seviper",
  "Lunatone", "Solrock", "Barboach", "Whiscash", "Corphish", "Crawdaunt",
  "Baltoy", "Claydol", "Lileep", "Cradily", "Anorith", "Armaldo",
  "Feebas", "Milotic", "Castform", "Kecleon", "Shuppet", "Banette",
  "Duskull", "Dusclops", "Tropius", "Chimecho", "Absol", "Wynaut",
  "Snorunt", "Glalie", "Spheal", "Sealeo", "Walrein", "Clamperl",
  "Huntail", "Gorebyss", "Relicanth", "Luvdisc", "Bagon", "Shelgon",
  "Salamence", "Beldum", "Metang", "Metagross", "Regirock", "Regice",
  "Registeel", "Latias", "Latios", "Kyogre", "Groudon", "Rayquaza",
  "Jirachi", "Deoxys", "Turtwig", "Grotle", "Torterra", "Chimchar",
  "Monferno", "Infernape", "Piplup", "Prinplup", "Empoleon", "Starly",
  "Staravia", "Staraptor", "Bidoof", "Bibarel", "Kricketot", "Kricketune",
  "Shinx", "Luxio", "Luxray", "Budew", "Roserade", "Cranidos",
  "Rampardos", "Shieldon", "Bastiodon", "Burmy", "Wormadam", "Mothim",
  "Combee", "Vespiquen", "Pachirisu", "Buizel", "Floatzel", "Cherubi",
  "Cherrim", "Shellos", "Gastrodon", "Ambipom", "Drifloon", "Drifblim",
  "Buneary", "Lopunny", "Mismagius", "Honchkrow", "Glameow", "Purugly",
  "Chingling", "Stunky", "Skuntank", "Bronzor", "Bronzong", "Bonsly",
  "Mime Jr.", "Happiny", "Chatot", "Spiritomb", "Gible", "Gabite",
  "Garchomp", "Munchlax", "Riolu", "Lucario", "Hippopotas", "Hippowdon",
  "Skorupi", "Drapion", "Croagunk", "Toxicroak", "Carnivine", "Finneon",
  "Lumineon", "Mantyke", "Snover", "Abomasnow", "Weavile", "Magnezone",
  "Lickilicky", "Rhyperior", "Tangrowth", "Electivire", "Magmortar", "Togekiss",
  "Yanmega", "Leafeon", "Glaceon", "Gliscor", "Mamoswine", "Porygon-Z",
  "Gallade", "Probopass", "Dusknoir", "Froslass", "Rotom", "Uxie",
  "Mesprit", "Azelf", "Dialga", "Palkia", "Heatran", "Regigigas",
  "Giratina", "Cresselia", "Phione", "Manaphy", "Darkrai", "Shaymin",
  "Arceus", "Victini", "Snivy", "Servine", "Serperior", "Tepig",
  "Pignite", "Emboar", "Oshawott", "Dewott", "Samurott", "Patrat",
  "Watchog", "Lillipup", "Herdier", "Stoutland", "Purrloin", "Liepard",
  "Pansage", "Simisage", "Pansear", "Simisear", "Panpour", "Simipour",
  "Munna", "Musharna", "Pidove", "Tranquill", "Unfezant", "Blitzle",
  "Zebstrika", "Roggenrola", "Boldore", "Gigalith", "Woobat", "Swoobat",
  "Drilbur", "Excadrill", "Audino", "Timburr", "Gurdurr", "Conkeldurr",
  "Tympole", "Palpitoad", "Seismitoad", "Throh", "Sawk", "Sewaddle",
  "Swadloon", "Leavanny", "Venipede", "Whirlipede", "Scolipede", "Cottonee",
  "Whimsicott", "Petilil", "Lilligant", "Basculin", "Sandile", "Krokorok",
  "Krookodile", "Darumaka", "Darmanitan", "Maractus", "Dwebble", "Crustle",
  "Scraggy", "Scrafty", "Sigilyph", "Yamask", "Cofagrigus", "Tirtouga",
  "Carracosta", "Archen", "Archeops", "Trubbish", "Garbodor", "Zorua",
  "Zoroark", "Minccino", "Cinccino", "Gothita", "Gothorita", "Gothitelle",
  "Solosis", "Duosion", "Reuniclus", "Ducklett", "Swanna", "Vanillite",
  "Vanillish", "Vanilluxe", "Deerling", "Sawsbuck", "Emolga", "Karrablast",
  "Escavalier", "Foongus", "Amoonguss", "Frillish", "Jellicent", "Alomomola",
  "Joltik", "Galvantula", "Ferroseed", "Ferrothorn", "Klink", "Klang",
  "Klinklang", "Tynamo", "Eelektrik", "Eelektross", "Elgyem", "Beheeyem",
  "Litwick", "Lampent", "Chandelure", "Axew", "Fraxure", "Haxorus",
  "Cubchoo", "Beartic", "Cryogonal", "Shelmet", "Accelgor", "Stunfisk",
  "Mienfoo", "Mienshao", "Druddigon", "Golett", "Golurk", "Pawniard",
  "Bisharp", "Bouffalant", "Rufflet", "Braviary", "Vullaby", "Mandibuzz",
  "Heatmor", "Durant", "Deino", "Zweilous", "Hydreigon", "Larvesta",
  "Volcarona", "Cobalion", "Terrakion", "Virizion", "Tornadus", "Thundurus",
  "Reshiram", "Zekrom", "Landorus", "Kyurem", "Keldeo", "Meloetta",
  "Genesect", "Chespin", "Quilladin", "Chesnaught", "Fennekin", "Braixen",
  "Delphox", "Froakie", "Frogadier", "Greninja", "Bunnelby", "Diggersby",
  "Fletchling", "Fletchinder", "Talonflame", "Scatterbug", "Spewpa", "Vivillon",
  "Litleo", "Pyroar", "Flabébé", "Floette", "Florges", "Skiddo",
  "Gogoat", "Pancham", "Pangoro", "Furfrou", "Espurr", "Meowstic",
  "Honedge", "Doublade", "Aegislash", "Spritzee", "Aromatisse", "Swirlix",
  "Slurpuff", "Inkay", "Malamar", "Binacle", "Barbaracle", "Skrelp",
  "Dragalge", "Clauncher", "Clawitzer", "Helioptile", "Heliolisk", "Tyrunt",
  "Tyrantrum", "Amaura", "Aurorus", "Sylveon", "Hawlucha", "Dedenne",
  "Carbink", "Goomy", "Sliggoo", "Goodra", "Klefki", "Phantump",
  "Trevenant", "Pumpkaboo", "Gourgeist", "Bergmite", "Avalugg", "Noibat",
  "Noivern", "Xerneas", "Yveltal", "Zygarde", "Diancie", "Hoopa",
  "Volcanion", "Rowlet", "Dartrix", "Decidueye", "Litten", "Torracat",
  "Incineroar", "Popplio", "Brionne", "Primarina", "Pikipek", "Trumbeak",
  "Toucannon", "Yungoos", "Gumshoos", "Grubbin", "Charjabug", "Vikavolt",
  "Crabrawler", "Crabominable", "Oricorio", "Cutiefly", "Ribombee", "Rockruff",
  "Lycanroc", "Wishiwashi", "Mareanie", "Toxapex", "Mudbray", "Mudsdale",
  "Dewpider", "Araquanid", "Fomantis", "Lurantis", "Morelull", "Shiinotic",
  "Salandit", "Salazzle", "Stufful", "Bewear", "Bounsweet", "Steenee",
  "Tsareena", "Comfey", "Oranguru", "Passimian", "Wimpod", "Golisopod",
  "Sandygast", "Palossand", "Pyukumuku", "Type: Null", "Silvally", "Minior",
  "Komala", "Turtonator", "Togedemaru", "Mimikyu", "Bruxish", "Drampa",
  "Dhelmise", "Jangmo-o", "Hakamo-o", "Kommo-o", "Tapu Koko", "Tapu Lele",
  "Tapu Bulu", "Tapu Fini", "Cosmog", "Cosmoem", "Solgaleo", "Lunala",
  "Nihilego", "Buzzwole", "Pheromosa", "Xurkitree", "Celesteela", "Kartana",
  "Guzzlord", "Necrozma", "Magearna", "Marshadow", "Poipole", "Naganadel",
  "Stakataka", "Blacephalon", "Zeraora", "Meltan", "Melmetal", "Grookey",
  "Thwackey", "Rillaboom", "Scorbunny", "Raboot", "Cinderace", "Sobble",
  "Drizzile", "Inteleon", "Skwovet", "Greedent", "Rookidee", "Corvisquire",
  "Corviknight", "Blipbug", "Dottler", "Orbeetle", "Nickit", "Thievul",
  "Gossifleur", "Eldegoss", "Wooloo", "Dubwool", "Chewtle", "Drednaw",
  "Yamper", "Boltund", "Rolycoly", "Carkol", "Coalossal", "Applin",
  "Flapple", "Appletun", "Silicobra", "Sandaconda", "Cramorant", "Arrokuda",
  "Barraskewda", "Toxel", "Toxtricity", "Sizzlipede", "Centiskorch", "Clobbopus",
  "Grapploct", "Sinistea", "Polteageist", "Hatenna", "Hattrem", "Hatterene",
  "Impidimp", "Morgrem", "Grimmsnarl", "Obstagoon", "Perrserker", "Cursola",
  "Sirfetch'd", "Mr. Rime", "Runerigus", "Milcery", "Alcremie", "Falinks",
  "Pincurchin", "Snom", "Frosmoth", "Stonjourner", "Eiscue", "Indeedee",
  "Morpeko", "Cufant", "Copperajah", "Dracozolt", "Arctozolt", "Dracovish",
  "Arctovish", "Duraludon", "Dreepy", "Drakloak", "Dragapult", "Zacian",
  "Zamazenta", "Eternatus", "Kubfu", "Urshifu", "Zarude", "Regieleki",
  "Regidrago", "Glastrier", "Spectrier", "Calyrex", "Wyrdeer", "Kleavor",
  "Ursaluna", "Basculegion", "Sneasler", "Overqwil", "Enamorus", "Sprigatito",
  "Floragato", "Meowscarada", "Fuecoco", "Crocalor", "Skeledirge", "Quaxly",
  "Quaxwell", "Quaquaval", "Lechonk", "Oinkologne", "Tarountula", "Spidops",
  "Nymble", "Lokix", "Pawmi", "Pawmo", "Pawmot", "Tandemaus",
  "Maushold", "Fidough", "Dachsbun", "Smoliv", "Dolliv", "Arboliva",
  "Squawkabilly", "Nacli", "Naclstack", "Garganacl", "Charcadet", "Armarouge",
  "Ceruledge", "Tadbulb", "Bellibolt", "Wattrel", "Kilowattrel", "Maschiff",
  "Mabosstiff", "Shroodle", "Grafaiai", "Bramblin", "Brambleghast", "Toedscool",
  "Toedscruel", "Klawf", "Capsakid", "Scovillain", "Rellor", "Rabsca",
  "Flittle", "Espathra", "Tinkatink", "Tinkatuff", "Tinkaton", "Wiglett",
  "Wugtrio", "Bombirdier", "Finizen", "Palafin", "Varoom", "Revavroom",
  "Cyclizar", "Orthworm", "Glimmet", "Glimmora", "Greavard", "Houndstone",
  "Flamigo", "Cetoddle", "Cetitan", "Veluza", "Dondozo", "Tatsugiri",
  "Annihilape", "Clodsire", "Farigiraf", "Dudunsparce", "Kingambit", "Great Tusk",
  "Scream Tail", "Brute Bonnet", "Flutter Mane", "Slither Wing", "Sandy Shocks", "Iron Treads",
  "Iron Bundle", "Iron Hands", "Iron Jugulis", "Iron Moth", "Iron Thorns", "Frigibax",
  "Arctibax", "Baxcalibur", "Gimmighoul", "Gholdengo", "Wo-Chien", "Chien-Pao",
  "Ting-Lu", "Chi-Yu", "Roaring Moon", "Iron Valiant", "Koraidon", "Miraidon",
  "Walking Wake", "Iron Leaves", "Dipplin", "Poltchageist", "Sinistcha", "Okidogi",
  "Munkidori", "Fezandipiti", "Ogerpon", "Archaludon", "Hydrapple", "Gouging Fire",
  "Raging Bolt", "Iron Boulder", "Iron Crown", "Terapagos", "Pecharunt",
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

// Misma normalización que se usó al generar la tabla: sin tildes, sin
// mayúsculas y sin nada que no sea letra o número. Es lo que hace que
// «Farfetch'd», «Mr. Mime» y «Ho-Oh» encuentren su número.
//
// EL SÍMBOLO DE GÉNERO SE QUEDA, COMO LETRA (tanda 460). PINGU: «has
// metido al Nidoran macho dentro de la categoría de Nidoran hembra en la
// Pokédex». Son DOS especies con dos números (29 y 32), dos sprites y dos
// líneas de evolución, y aquí se borraban los dos símbolos y las dos
// casaban con «nidoran» — ganaba la primera, la hembra, y todas las cartas
// del macho acababan en la ficha de la hembra. Sin dar ningún error: la
// especie existe, la carta existe y el número que sale es un número
// válido. Es el mismo mapeo que ya hacía `slugLimitless` para pedir el
// sprite (nidoran-f / nidoran-m), que por eso sí salía bien.
function aplastar(texto) {
  return String(texto ?? '')
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const DEX_POR_NOMBRE = new Map()
for (let i = 0; i < POKEMON_POR_DEX.length; i++) {
  const clave = aplastar(POKEMON_POR_DEX[i])
  if (!DEX_POR_NOMBRE.has(clave)) DEX_POR_NOMBRE.set(clave, i + 1)
}
// Y «Nidoran» A SECAS sigue dando la hembra, que es lo que daba antes.
// Un nombre de mazo escrito a mano no lleva el símbolo, y dejar de
// resolverlo sería cambiar una firma de arquetipo por arreglar otra cosa.
if (!DEX_POR_NOMBRE.has('nidoran')) DEX_POR_NOMBRE.set('nidoran', 29)

// ── Formas con carta PROPIA en el TCG ──
//
// La tabla de arriba trae una entrada por especie, y a Ogerpon eso se le
// queda corto: sus cuatro máscaras son CUATRO cartas ex distintas que
// definen mazos distintos, y todas caían en el mismo sprite y la misma
// casilla. Los sprites de las formas viven en números altos de PokéAPI
// (>10000), que el generador de la tabla no recorre — así que las que
// importan al TCG van aquí, curadas a mano.
//
// Esta lista NO intenta traer todas las formas del juego (las
// regionales de un Vulpix de relleno no nombran mazos): solo las que
// son una carta jugable distinta de su especie base. Si sale otra en
// una temporada futura, se añade su línea y ya está.
//
// Los `alias` son el mismo Pokémon con el nombre de la carta en
// ESPAÑOL: el export de TCG Live llega en el idioma del jugador
// (tanda 232) y «Ogerpon Máscara Cimiento ex» tiene que caer en la
// misma forma que «Cornerstone Mask Ogerpon ex». No salen en el
// buscador para no enseñar el mismo Pokémon dos veces.
export const FORMAS_TCG = [
  { nombre: 'Teal Mask Ogerpon', dex: 1017, base: 1017, slug: 'ogerpon' },
  { nombre: 'Wellspring Mask Ogerpon', dex: 10273, base: 1017, slug: 'ogerpon-wellspring' },
  { nombre: 'Hearthflame Mask Ogerpon', dex: 10274, base: 1017, slug: 'ogerpon-hearthflame' },
  { nombre: 'Cornerstone Mask Ogerpon', dex: 10275, base: 1017, slug: 'ogerpon-cornerstone' },
  { nombre: 'Bloodmoon Ursaluna', dex: 10272, base: 901, slug: 'ursaluna-bloodmoon' },
  { nombre: 'Máscara Turquesa', dex: 1017, base: 1017, alias: true },
  { nombre: 'Máscara Fuente', dex: 10273, base: 1017, alias: true },
  { nombre: 'Máscara Horno', dex: 10274, base: 1017, alias: true },
  { nombre: 'Máscara Cimiento', dex: 10275, base: 1017, alias: true },
  { nombre: 'Luna Carmesí', dex: 10272, base: 901, alias: true },
]

// ── Las MEGAS (tanda 240) ──
//
// El TCG de la era MEG trae cartas «Mega X ex» (Kangaskhan, Excadrill,
// Skarmory…, algunas que ni existían como mega en el videojuego) y
// todas caían en el sprite de la especie base. Limitless tiene el
// sprite de CADA una como `<especie>-mega` — TODAS las de esta lista
// están comprobadas contra su CDN una a una (la única que no existe,
// slowking-mega, no está). El 2026-09-02 se volvió a sondear la CDN
// entera (las 1025 especies con «-mega») y salieron 20 nuevas que nos
// faltaban — Mega Darkrai la primera, que ya se jugaba y caía en el
// sprite de Darkrai a secas. Son las del segundo bloque. Y como la CDN
// seguirá añadiendo, lo que no esté aquí se monta solo (ver
// dexDeClave): esta lista es lo que sale en el BUSCADOR del selector,
// no el único camino al sprite.
//
// El número es SINTÉTICO (20000 + dex de la base; 21000 para la
// variante Y): desde la tanda 236 el sprite sale del slug y el número
// solo es la clave interna de forma, así que no hace falta que sea el
// id de PokéAPI. La base va aparte para que «Mega Lucario» y «Lucario»
// en el mismo nombre de mazo no cuenten como dos Pokémon.
//
// En español la carta es «Mega-Lucario ex»: el guion se aplasta y casa
// solo, sin alias.
const MEGAS = [
  'Venusaur', 'Blastoise', 'Beedrill', 'Pidgeot', 'Alakazam', 'Slowbro',
  'Gengar', 'Kangaskhan', 'Pinsir', 'Gyarados', 'Aerodactyl', 'Victreebel',
  'Starmie', 'Dragonite', 'Ampharos', 'Steelix', 'Scizor', 'Heracross',
  'Houndoom', 'Tyranitar', 'Meganium', 'Sceptile', 'Blaziken', 'Swampert',
  'Gardevoir', 'Sableye', 'Mawile', 'Aggron', 'Medicham', 'Manectric',
  'Banette', 'Absol', 'Glalie', 'Salamence', 'Metagross', 'Latias',
  'Latios', 'Rayquaza', 'Lopunny', 'Garchomp', 'Lucario', 'Abomasnow',
  'Gallade', 'Audino', 'Diancie', 'Camerupt', 'Skarmory', 'Excadrill',
  'Chandelure', 'Froslass', 'Sharpedo',
  // Las 20 de la sonda del 2026-09-02, en orden de Pokédex.
  'Clefable', 'Feraligatr', 'Altaria', 'Darkrai', 'Emboar', 'Scolipede',
  'Scrafty', 'Eelektross', 'Chesnaught', 'Delphox', 'Greninja', 'Pyroar',
  'Floette', 'Malamar', 'Barbaracle', 'Dragalge', 'Hawlucha', 'Zygarde',
  'Drampa', 'Falinks',
]
for (const especie of MEGAS) {
  const base = DEX_POR_NOMBRE.get(aplastar(especie))
  if (!base) continue
  FORMAS_TCG.push({ nombre: `Mega ${especie}`, dex: 20000 + base, base, slug: slugLimitless(especie) + '-mega' })
}
// Las que vienen en dos sabores llevan la letra en el nombre, como en
// la carta («Mega Charizard X ex»).
FORMAS_TCG.push(
  { nombre: 'Mega Charizard X', dex: 20006, base: 6, slug: 'charizard-mega-x' },
  { nombre: 'Mega Charizard Y', dex: 21006, base: 6, slug: 'charizard-mega-y' },
  { nombre: 'Mega Mewtwo X', dex: 20150, base: 150, slug: 'mewtwo-mega-x' },
  { nombre: 'Mega Mewtwo Y', dex: 21150, base: 150, slug: 'mewtwo-mega-y' }
)

// La especie de cada forma, para que «Ogerpon Máscara Fuente» (especie
// + forma) no cuente como dos Pokémon distintos al agrupar mazos.
export const BASE_DE_FORMA = new Map(FORMAS_TCG.map((f) => [f.dex, f.base]))

for (const f of FORMAS_TCG) {
  const clave = aplastar(f.nombre)
  if (!DEX_POR_NOMBRE.has(clave)) DEX_POR_NOMBRE.set(clave, f.dex)
}

// El nombre aplastado de cada uno, para buscar sin recalcularlo en cada
// tecla del buscador de mazos.
export const POKEMON_APLASTADOS = POKEMON_POR_DEX.map(aplastar)

// ── Megas que la lista curada no conoce (todavía) ──
//
// La CDN de Limitless añade sprites «-mega» según salen cartas: la
// sonda del 2026-09-02 encontró 20 que nos faltaban, y volverá a
// pasar. Para que la próxima no caiga otra vez en el sprite de la
// base, cualquier «Mega X» cuya X sea una especie se registra sola al
// buscarla: mismo número sintético (20000 + dex) y slug `x-mega`. Si
// la CDN aún no tiene ese sprite, el respaldo (respaldoDeSprite) da el
// de la especie base — mejor el Pokémon sustituto que un hueco.
function dexDeClave(clave) {
  const directo = DEX_POR_NOMBRE.get(clave)
  if (directo) return directo
  if (!clave.startsWith('mega') || clave.length <= 4) return undefined
  const base = DEX_POR_NOMBRE.get(clave.slice(4))
  // Solo especies (≤1025): la «mega de una forma» no existe en el TCG.
  if (!base || base > 1025) return undefined
  const dex = 20000 + base
  const especie = POKEMON_POR_DEX[base - 1]
  DEX_POR_NOMBRE.set(clave, dex)
  BASE_DE_FORMA.set(dex, base)
  SLUG_POR_DEX.set(dex, slugLimitless(especie) + '-mega')
  respaldoDeForma(`${slugLimitless(especie)}-mega`, slugLimitless(especie))
  return dex
}

// El número de EXACTAMENTE este texto, o null. A diferencia de
// dexDeCarta no prueba trozos: es la pieza con la que arquetipos.js
// recorre un nombre de mazo sacando TODOS sus Pokémon, no solo el
// primero.
export function dexExacto(texto) {
  return dexDeClave(aplastar(texto)) ?? null
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
      const dex = dexDeClave(aplastar(palabras.slice(desde, desde + largo).join('')))
      if (dex) return dex
    }
  }
  return null
}

// De dónde salen los sprites (tanda 236): la CDN de Limitless, que es
// EXACTAMENTE la que usa trainingcourt.app — Ibai pidió «los mismos
// sprites que trainingcourt, que son todos iguales», se miró su código
// y esto es lo que hace: nombre en minúsculas con guiones contra
// r2.limitlesstcg.net. Son minisprites de píxel, todos del mismo
// estilo y con las formas del TCG incluidas (ogerpon-wellspring,
// ursaluna-bloodmoon…), que era justo lo que a PokéAPI le fallaba: sus
// sprites por número mezclan generaciones y estilos.
//
// La URL se monta por NOMBRE y no por número, así que del número de
// Pokédex se pasa por una tabla de nombres-guión («Mr. Mime» →
// mr-mime, «Nidoran♀» → nidoran-f, «Farfetch'd» → farfetchd) y las
// formas ponen el suyo a mano (Limitless dice «ogerpon-wellspring», no
// «wellspring-mask-ogerpon»). Comprobado contra la CDN de verdad.
export const CDN_SPRITES = 'https://r2.limitlesstcg.net/pokemon/gen9'

// El nombre como lo escribe Limitless: minúsculas, sin tildes ni
// puntuación, espacios a guiones y los símbolos de género a letra.
function slugLimitless(nombre) {
  return String(nombre ?? '')
    .replace(/♀/g, ' f')
    .replace(/♂/g, ' m')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['.:]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

const SLUG_POR_DEX = new Map()
for (let i = 0; i < POKEMON_POR_DEX.length; i++) SLUG_POR_DEX.set(i + 1, slugLimitless(POKEMON_POR_DEX[i]))
// Después de las especies a propósito: la forma manda sobre la base
// cuando comparten número (la Máscara Turquesa ES el 1017).
for (const f of FORMAS_TCG) if (f.slug) SLUG_POR_DEX.set(f.dex, f.slug)

export function urlDeSprite(dex) {
  const slug = SLUG_POR_DEX.get(dex)
  return slug ? `${CDN_SPRITES}/${slug}.png` : null
}

// ── El segundo ORIGEN: cuando la CDN entera no contesta ──
//
// El 2026-09-20 r2.limitlesstcg.net dejó de responder (no un 404: un
// ERR_CONNECTION_TIMED_OUT) y TODOS los sprites del sitio se apagaron a
// la vez — en /mis-partidas se veían los huecos reservados y nada
// dentro, porque el manejador de abajo esconde lo que no llega. La web
// no puede depender de que un tercero esté en pie.
//
// El segundo origen son los sprites de PokeAPI, que van por NÚMERO de
// Pokédex y cubren los 1025 (los iconos de caja de octava generación,
// que son los que más se parecen, se cortan en el 898 y dejan fuera
// justo la generación que se juega). Y detrás va el MISMO fichero desde
// GitHub a pelo, por si el que se cae es jsDelivr: son el mismo repo,
// así que es un cambio de puerta, no de contenido.
//
// Lo que se perdía al caer aquí era la FORMA. Desde la tanda 511 una
// forma prueba antes SU sprite en PokeAPI (ver respaldoDeForma, abajo).
const CDN_RESPALDO = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'
const CDN_RESPALDO_2 = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'

// ── El respaldo de una FORMA: la misma forma en el otro origen, y luego
//    la especie base ──
//
// El sprite de una forma o una mega puede no existir en la CDN (pasó con
// slowking-mega, y pasará con la primera mega de cada temporada hasta que
// Limitless la suba). Hasta la tanda 511 el siguiente paso era el sprite
// de la ESPECIE BASE, que para reconocer un mazo de un vistazo sirve… salvo
// cuando lo que distingue el mazo ES la mega: «Mega Lucario» y «Lucario»
// son dos mazos. Y donde se notaba de verdad era la IMAGEN del meta de un
// torneo: un lienzo no puede pintar el sprite de Limitless (no da CORS), su
// /sprite devolvía 404 en producción (medido el 2026-10-04 desde el
// navegador: TODOS, megas y no megas, mientras la CDN sí contestaba), y la
// cadena caía en la especie base — PINGU: «los sprites de las megas no
// salen bien, salen los pokemons normales».
//
// PokeAPI tiene las megas como Pokémon aparte, con el MISMO nombre que usa
// Limitless (`gardevoir-mega`, `charizard-mega-x`) y un número propio
// (10051…). La tabla es la de su `pokemon.csv`, y cada número tiene su
// fichero comprobado en su repo de sprites (2026-10-04: 96 de 97; el de
// zygarde-mega no está y por eso no sale). Así una mega pierde el ESTILO
// antes que la FORMA: Limitless → la mega en PokeAPI → la especie en
// Limitless → la especie en PokeAPI.
const MEGAS_POKEAPI = new Map(
  (
  'venusaur-mega:10033 charizard-mega-x:10034 charizard-mega-y:10035 ' +
  'blastoise-mega:10036 alakazam-mega:10037 gengar-mega:10038 ' +
  'kangaskhan-mega:10039 pinsir-mega:10040 gyarados-mega:10041 ' +
  'aerodactyl-mega:10042 mewtwo-mega-x:10043 mewtwo-mega-y:10044 ' +
  'ampharos-mega:10045 scizor-mega:10046 heracross-mega:10047 ' +
  'houndoom-mega:10048 tyranitar-mega:10049 blaziken-mega:10050 ' +
  'gardevoir-mega:10051 mawile-mega:10052 aggron-mega:10053 ' +
  'medicham-mega:10054 manectric-mega:10055 banette-mega:10056 ' +
  'absol-mega:10057 garchomp-mega:10058 lucario-mega:10059 ' +
  'abomasnow-mega:10060 latias-mega:10062 latios-mega:10063 ' +
  'swampert-mega:10064 sceptile-mega:10065 sableye-mega:10066 ' +
  'altaria-mega:10067 gallade-mega:10068 audino-mega:10069 ' +
  'sharpedo-mega:10070 slowbro-mega:10071 steelix-mega:10072 ' +
  'pidgeot-mega:10073 glalie-mega:10074 diancie-mega:10075 ' +
  'metagross-mega:10076 rayquaza-mega:10079 camerupt-mega:10087 ' +
  'lopunny-mega:10088 salamence-mega:10089 beedrill-mega:10090 ' +
  'clefable-mega:10278 victreebel-mega:10279 starmie-mega:10280 ' +
  'dragonite-mega:10281 meganium-mega:10282 feraligatr-mega:10283 ' +
  'skarmory-mega:10284 froslass-mega:10285 emboar-mega:10286 ' +
  'excadrill-mega:10287 scolipede-mega:10288 scrafty-mega:10289 ' +
  'eelektross-mega:10290 chandelure-mega:10291 chesnaught-mega:10292 ' +
  'delphox-mega:10293 greninja-mega:10294 pyroar-mega:10295 ' +
  'floette-mega:10296 malamar-mega:10297 barbaracle-mega:10298 ' +
  'dragalge-mega:10299 hawlucha-mega:10300 drampa-mega:10302 ' +
  'falinks-mega:10303 raichu-mega-x:10304 raichu-mega-y:10305 ' +
  'chimecho-mega:10306 absol-mega-z:10307 staraptor-mega:10308 ' +
  'garchomp-mega-z:10309 lucario-mega-z:10310 heatran-mega:10311 ' +
  'darkrai-mega:10312 golurk-mega:10313 meowstic-male-mega:10314 ' +
  'crabominable-mega:10315 golisopod-mega:10316 magearna-mega:10317 ' +
  'magearna-original-mega:10318 zeraora-mega:10319 scovillain-mega:10320 ' +
  'glimmora-mega:10321 tatsugiri-curly-mega:10322 ' +
  'tatsugiri-droopy-mega:10323 tatsugiri-stretchy-mega:10324 ' +
  'baxcalibur-mega:10325 meowstic-female-mega:10326'
  )
    .split(' ')
    .map((x) => x.split(':'))
    .map(([slug, id]) => [slug, Number(id)])
)

const RESPALDO_POR_URL = new Map()
// Lo que va DESPUÉS del último sitio de una mega en PokeAPI: la especie
// base en Limitless, que sigue siendo mejor que nada.
const DESPUES_DE_POKEAPI = new Map()
// Las formas de FORMAS_TCG que no son megas (Ogerpon, Ursaluna Luna
// Carmesí) ya llevan de número EL DE POKEAPI (10272–10275, comprobados con
// su fichero): ese mismo vale de respaldo.
function respaldoDeForma(slugForma, slugBase, idPokeapi = null) {
  const forma = `${CDN_SPRITES}/${slugForma}.png`
  const base = `${CDN_SPRITES}/${slugBase}.png`
  const id = MEGAS_POKEAPI.get(slugForma) || idPokeapi
  if (!id) return RESPALDO_POR_URL.set(forma, base)
  RESPALDO_POR_URL.set(forma, `${CDN_RESPALDO}/${id}.png`)
  DESPUES_DE_POKEAPI.set(`${CDN_RESPALDO_2}/${id}.png`, base)
}
for (const f of FORMAS_TCG) {
  if (!f.slug || !f.base || f.dex === f.base) continue
  const slugBase = slugLimitless(POKEMON_POR_DEX[f.base - 1])
  if (slugBase && slugBase !== f.slug) respaldoDeForma(f.slug, slugBase, f.dex >= 10000 && f.dex < 20000 ? f.dex : null)
}

// De una URL de Limitless a su número de Pokédex, que es lo que pide el
// segundo origen. Solo ESPECIES, y no es un olvido: una forma nunca
// llega aquí, porque el peldaño anterior (RESPALDO_POR_URL) ya la ha
// mandado a la URL de su especie base, que sí está en esta tabla. Se
// intentó registrar también las formas y el rigor lo cantó — las
// mutaciones sobre esa línea no cambiaban nada porque no se ejecutaba
// nunca. Y menos mal: el `dex` de una mega es inventado (20000 + base)
// y pedírselo a PokeAPI habría dado un 404.
const DEX_POR_URL = new Map()
for (let i = 0; i < POKEMON_POR_DEX.length; i++) {
  const s = slugLimitless(POKEMON_POR_DEX[i])
  if (s) DEX_POR_URL.set(`${CDN_SPRITES}/${s}.png`, i + 1)
}

// El SIGUIENTE sitio donde probar este sprite, o null si ya no quedan.
// Es una cadena y se recorre llamando otra vez con lo que devuelve, que
// es justo lo que hacen los manejadores de `error`: cada fallo da un
// paso más. El orden es de menos a más pérdida, y desde la tanda 511 lo
// que más se pierde es la FORMA, no el estilo: una mega prueba antes su
// propio dibujo en PokeAPI que la especie base de Limitless, porque un
// Gardevoir a secas en un mazo de Mega Gardevoir dice otro mazo.
export function respaldoDeSprite(url) {
  const u = String(url ?? '')
  const base = RESPALDO_POR_URL.get(u)
  if (base) return base
  const dex = DEX_POR_URL.get(u)
  if (dex) return `${CDN_RESPALDO}/${dex}.png`
  if (u.startsWith(`${CDN_RESPALDO}/`)) return `${CDN_RESPALDO_2}/${u.slice(CDN_RESPALDO.length + 1)}`
  return DESPUES_DE_POKEAPI.get(u) || null
}

// La cadena entera de una vez, para quien no puede ir pidiéndola paso a
// paso. El tope es lo único que garantiza que esto TERMINE: una tabla
// mal montada que se apuntara a sí misma colgaría la pestaña. Había
// además un descarte de repetidos, y el rigor lo marcó como «sin
// detectar» — con razón: era red de repuesto del tope, y dos guardas
// que se cubren la una a la otra no las prueba nadie.
export function cadenaDeRespaldos(url) {
  const cadena = []
  let u = String(url ?? '')
  // Seis: la cadena más larga es la de una mega (su sitio en PokeAPI por
  // las dos puertas, y luego la especie por las tres).
  for (let i = 0; i < 6; i++) {
    const siguiente = respaldoDeSprite(u)
    if (!siguiente) break
    cadena.push(siguiente)
    u = siguiente
  }
  return cadena
}

// Los atributos de <img> que recorren esa cadena. Va como onerror en
// línea porque estos sprites nacen de cadenas de HTML (innerHTML) y no
// de createElement, así que aquí no se puede enganchar un listener ni
// llamar a nada de este módulo: la cadena viaja entera en el atributo.
// Al agotarse, la imagen se ESCONDE — nunca el icono roto del
// navegador, que parece la página estropeada.
//
// Las URLs las montamos nosotros (letras, números, guiones y puntos),
// así que van sin escapar sin peligro, y el manejador no lleva ni una
// comilla doble para no cerrar el atributo.
//
// Lo que NO arregla: si la CDN no contesta en vez de dar un 404, cada
// paso espera a que el navegador se canse, así que en una caída entera
// los sprites tardan en aparecer. Aparecen, que era el problema.
// El ÚLTIMO paso ya no es esconder (787, PA16): es un círculo con la
// inicial del Pokémon, que siempre se ve. Va como imagen en línea para que
// el hueco y el tamaño sean los de la `<img>`; sin inicial que leer, se
// esconde como antes.
export const SALTO_DE_RESPALDO =
  "var r=(this.dataset.respaldos||'').split(' ').filter(Boolean);" +
  "if(r.length){this.src=r.shift();this.dataset.respaldos=r.join(' ')}" +
  "else if(this.dataset.inicial){this.onerror=null;this.classList.add('sprite-inicial');" +
  "this.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 40 40\\'><circle cx=\\'20\\' cy=\\'20\\' r=\\'19\\' fill=\\'#5b7186\\'/><text x=\\'20\\' y=\\'27\\' font-family=\\'sans-serif\\' font-size=\\'20\\' font-weight=\\'700\\' fill=\\'#fff\\' text-anchor=\\'middle\\'>'+this.dataset.inicial+'</text></svg>')}" +
  "else{this.style.display='none'}"

// La inicial sale del nombre del fichero de la PRIMERA dirección (la de
// Limitless lleva el nombre, «gardevoir.png»); si es un número, no hay.
export function inicialDeSprite(url) {
  const nombre = decodeURIComponent(String(url || '').split('?')[0].split('/').pop() || '').replace(/\.\w+$/, '')
  const letra = nombre.match(/^[a-z]/i)?.[0]
  return letra ? letra.toUpperCase() : ''
}

export function atributosDeRespaldo(url) {
  const cadena = cadenaDeRespaldos(url)
  const datos = cadena.length ? ` data-respaldos="${cadena.join(' ')}"` : ''
  const inicial = inicialDeSprite(url)
  return `${datos}${inicial ? ` data-inicial="${inicial}"` : ''} onerror="${SALTO_DE_RESPALDO}"`
}

// ── Objetos con sprite propio ──
//
// trainingcourt hace exactamente esto: su ÚNICO sprite local es el
// martillo (assets/sprites/crushing-hammer.png en su repo), y todo lo
// demás va a la CDN de Limitless. El nuestro es SU mismo fichero,
// servido desde nuestros assets — un objeto que da nombre a un mazo se
// merece icono, no la carta en pequeñito. Si otra temporada trae otro
// objeto-nombre-de-mazo, se añade su línea (y su png) y ya.
//
// El alias en español, por lo mismo que en FORMAS_TCG: el export de
// TCG Live llega en el idioma del jugador. Los alias no se enseñan en
// el buscador (sería el mismo objeto dos veces) pero sí casan.
export const OBJETOS_TCG = [
  { nombre: 'Crushing Hammer', sprite: '/assets/sprites/crushing-hammer.png' },
  { nombre: 'Martillo Demoledor', sprite: '/assets/sprites/crushing-hammer.png', alias: true },
]

const SPRITES_OBJETOS = new Map(OBJETOS_TCG.map((o) => [aplastar(o.nombre), o.sprite]))

export function spriteDeObjeto(nombreDeCarta) {
  return SPRITES_OBJETOS.get(aplastar(nombreDeCarta)) ?? null
}

// El atajo: nombre de carta → URL del sprite, o null si no es ni un
// Pokémon ni un objeto con sprite propio.
export function spriteDeCarta(nombreDeCarta) {
  return urlDeSprite(dexDeCarta(nombreDeCarta)) || spriteDeObjeto(nombreDeCarta)
}
