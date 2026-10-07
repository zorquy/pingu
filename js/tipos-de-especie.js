// EL TIPO DE CADA ESPECIE, en el TCG (748). Una letra por número de la
// Pokédex Nacional, del 1 al 1025: G Planta, R Fuego, W Agua, L Rayo,
// P Psíquico, F Lucha, D Oscuro, M Metal, N Dragón, C Incoloro.
//
// Hasta la 748 el tipo de un Pokémon salía de TUS cartas suyas (su columna
// `types`), y PINGU lo vio en su Pokédex: «hay Pokémon que tienen los tipos
// puestos y otros que no». Pasa porque esa columna la rellena el engorde
// carta a carta y muchas todavía no la traen; y lo mismo en las barras del
// meta. Una especie tiene UN tipo que no depende de qué cartas tengas, así
// que ahora sale de aquí, y lo de tus cartas solo manda cuando lo hay (un
// Charizard tuyo de Oscuro sigue siendo Oscuro).
//
// De dónde sale: el tipo PRINCIPAL de cada especie en los juegos (el CSV
// `pokemon_types` de PokeAPI, a 2026-10-07), pasado a energía con la regla
// del TCG de hoy (Escarlata y Púrpura): Normal y Volador → Incoloro, Veneno
// → Oscuro, Fantasma y Hada → Psíquico, Bicho → Planta, Hielo → Agua,
// Tierra y Roca → Lucha, Acero → Metal, Eléctrico → Rayo. Comprobado a mano
// contra el set 151 (Ekans y Zubat Oscuro, Clefairy y Gastly Psíquico,
// Pidgey Incoloro, Dratini Dragón). Sin dependencias: lo usan la Pokédex
// y el meta.
const TIPOS =
  'GGGRRRWWWGGGGGGCCCCCCCDDLLFFDDDDDDPPRRCCDDGGGGGGGFFCCWWFFRRWWWPPPFFFGGGWWFFF' +
  'RRWWLLCCCWWDDWWPPPFPPWWLLGGFFFFCDDFFCGCWWWWWWPGWLRGCWWWCCWLRCFFFFFCWLRNNNPPG' +
  'GGRRRWWWCCCCGGGGDWWLPCPPPPLLLGWWFWGGGCGGGWWPDDWPPPCGGCFMPPWGGGDCCRRWWWWWWWMD' +
  'DWFFCCCFFWLRCCLRWFFFPRPGGGRRRWWWDDCCGGGGGWWWGGGCCWWPPPGGGGCCCGGGCCCFFCFCCDMM' +
  'MMFFLLLLGGGDDWWWWRRRPPCFFFGGCNCDFFWWWWFFFFFFWWCCPPPPGPDPWWWWWWWWWWNNNMMMFWMN' +
  'NWFNMPGGGRRRWWWCCCCCGGLLLGGFFFFGGGGGLWWGGWWCPPCCPDCCPDDMMFPCCPNNNCFFFFDDDDGW' +
  'WWGGDLCFGLRPGGWFWCPFPWLPPPMWRCPPWWDGCPGGGRRRWWWCCCCCDDGGRRWWPPCCCLLFFFPPFFCF' +
  'FFWWWFFGGGGGGGGGGWFFFRRGGGDDPPPWWFFDDDDCCPPPPPPWWWWWCCLGGGGWWWGGGGMMMLLLPPPP' +
  'PNNNWWWGGFFFNFFDDCCCDDRGDDDGGMFGCLNNFNWCGGGGRRRWWWCCCRRGGGRRPPPGGFFCPPMMMPPP' +
  'PDDFFDDWWLLFFFFPFLFNNNMPPPPWWCCPDNFPRGGGRRRWWWCCCCCGGGFFRGGFFWDDFFWWGGGGDDCC' +
  'GGGPCFGGPPWCCFCRLPWCPNNNLPGWPPPPFGGLMGDPMFDDFRLMMGGGRRRWWWCCCCCGGGDDGGCCWWLL' +
  'FFFGGGFFCWWLLRRFFPPPPPDDDDMPFWFPPFLWWFWPLMMLLWWMNNNPFDFFDLNWPPCGFWFDPGGGRRRW' +
  'WWCCGGGGLLLCCPPGGGCFFFRRRLLLLDDDDGGFFFGGGGPPPPPWWCWWMMNMFFPPCWWWWNFDCCDFPGPG' +
  'LFWFDRFNNNPMDDDDNPFLWGGGGDDDGMGRLFMCD'

export function tipoDeEspecie(dex) {
  const n = Number(dex)
  if (!Number.isInteger(n) || n < 1 || n > TIPOS.length) return null
  return TIPOS[n - 1]
}
