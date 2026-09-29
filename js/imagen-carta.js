// La imagen de una carta de una lista, con una cadena de respaldos que
// no se queda NUNCA en blanco con una energía básica (tanda 366).
//
// POR QUÉ. En las decklists de torneo las energías salían casi siempre
// sin imagen, y otras cartas a menudo también. Tres causas, las tres
// sin dar error:
//   · TCGdex no tiene escaneo de NINGUNA energía básica: en el espejo
//     `image_path` es null en sve y mee (tanda 357). La rejilla montaba
//     `src="null"`, fallaba y se quitaba.
//   · Una carta de un set que el espejo no sabe cruzar por su código de
//     TCG Live (pasa con cada set nuevo) se buscaba por nombre, y si no
//     aparecía no se pintaba nada.
//   · Y si la imagen de TCGdex no contestaba, no había segundo sitio.
//
// LA CADENA, de mejor a peor:
//   1. El escaneo de nuestro espejo, si la carta es la EXACTA (su set y
//      su número).
//   2. El de la CDN de Limitless por set y número, que tiene TODAS las
//      cartas de torneo con el código de TCG Live — justo lo que trae
//      una lista, así que no depende de que el espejo sepa cruzar el set.
//   3. El de la gemela encontrada por nombre en el espejo.
//   4. Y se quita la imagen: queda la caja con el nombre (nunca el icono
//      roto del navegador).
// Las energías básicas tienen su PROPIA cadena, y siempre las mismas
// cartas —reales y con su número de verdad—, venga como venga la línea
// («Basic {P} Energy SVE 5», «Energía Psíquica», «Psychic Energy MEE 13»…).
// Lo pidió PINGU en dos veces: «pon unas por defecto siempre», y después
// «tienen que ser energías que existan con números que existan» (la
// primera versión de esta tanda pintaba unas dibujadas por nosotros y no
// se reconocían como energías). La cadena cruza de origen (tanda 321):
//   1. Las del 30 aniversario de Mega Evolución, MEE 9–16, de la CDN de
//      Limitless (las mismas que pinta el constructor).
//   2. Las de Escarlata y Púrpura, SVE 1–8, de la CDN de pokemontcg.io:
//      otro servidor, así que una caída de Limitless no las apaga.
//   3. Las normales de Mega Evolución, MEE 1–8, otra vez en Limitless.
//   4. Y solo si no contesta NADIE, la de /assets/energias/, nuestra.
//
// Sin DOM y sin Supabase: se prueba en Node.
import { letraDeEnergia } from './constructor/nucleo.js'
// La dirección de Limitless vive aparte desde la tanda 370: la usan
// también el catálogo, la ficha de una carta y «Mi colección», y
// traérsela de aquí les habría metido el constructor entero encima.
export { imagenDeLimitless } from './escaneo-carta.js'
import { imagenDeLimitless } from './escaneo-carta.js'

// Las ocho letras de las básicas, que son las de los ficheros.
export const LETRAS_DE_ENERGIA = ['G', 'R', 'W', 'L', 'P', 'F', 'D', 'M']

// ¿Es una energía básica? Por el nombre, en cualquiera de las formas en
// que llega una lista: «Basic {R} Energy», «Fire Energy», «Energía
// Fuego», «Energía {R} básica»… Las especiales («Neo Upper Energy»,
// «Energía Prisma») no tienen letra y se quedan fuera.
export function letraDeEnergiaBasica(nombre) {
  const n = String(nombre || '')
  if (!/energ/i.test(n)) return null
  // Las especiales que se llaman como un tipo («Energía Fuego Creciente»,
  // «Luminous Energy») no son básicas: la básica es el nombre A SECAS.
  const limpio = n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  const basica =
    /^(basic )?(\{[grwlpfdm]\}|grass|fire|water|lightning|psychic|fighting|darkness|metal) energy$/.test(limpio) ||
    /^energia (\{[grwlpfdm]\}|planta|fuego|agua|rayo|psiquica|lucha|oscura|metalica)( basica)?$/.test(limpio) ||
    /^energia (\{[grwlpfdm]\} )?basica( (planta|fuego|agua|rayo|psiquica|lucha|oscura|metalica))?$/.test(limpio)
  if (!basica) return null
  const letra = letraDeEnergia(n)
  return LETRAS_DE_ENERGIA.includes(letra) ? letra : null
}

export function imagenDeEnergiaLocal(letra) {
  return LETRAS_DE_ENERGIA.includes(letra) ? `/assets/energias/${letra}.svg` : null
}

// La carta REAL que se enseña para cada básica: MEE 9–16 (30 aniversario),
// en el orden de siempre de las básicas (G R W L P F D M). Comprobado en
// listas de Limitless: «Fire Energy MEE 10», «Psychic Energy MEE 13»,
// «Darkness Energy MEE 15».
export function cartaDeEnergia(letra) {
  const i = LETRAS_DE_ENERGIA.indexOf(letra)
  return i < 0 ? null : { set: 'MEE', numero: String(9 + i) }
}

export function cadenaDeEnergia(letra) {
  const i = LETRAS_DE_ENERGIA.indexOf(letra)
  if (i < 0) return []
  return [
    imagenDeLimitless('MEE', String(9 + i)),
    `https://images.pokemontcg.io/sve/${i + 1}.png`,
    imagenDeLimitless('MEE', String(1 + i)),
    imagenDeEnergiaLocal(letra),
  ]
}

// La cadena entera para una línea de lista ({ name, set, number }) y lo
// que haya devuelto el espejo (o null). `urlDelEspejo` monta la URL de un
// `image_path` (cardImageUrl), inyectada para que esto no importe tcgdex.js.
export function cadenaDeImagenes(linea, carta, urlDelEspejo) {
  const letra = letraDeEnergiaBasica(linea?.name)
  if (letra) return cadenaDeEnergia(letra)
  const cadena = []
  const espejo = carta?.image_path ? urlDelEspejo(carta.image_path) : null
  if (espejo && carta.exacta) cadena.push(espejo)
  const limitless = imagenDeLimitless(linea?.set, linea?.number)
  if (limitless) cadena.push(limitless)
  if (espejo && !carta.exacta) cadena.push(espejo)
  return [...new Set(cadena)]
}

// Los atributos de <img> que recorren la cadena. Como en los sprites
// (sprites-pokemon.js), el manejador va en línea porque estas imágenes
// nacen de cadenas de HTML; las URLs las montamos nosotros y no llevan
// ni espacios ni comillas. Al agotarse, la imagen se QUITA: la caja de
// la carta ya tiene su estilo para cuando no hay imagen.
const SALTO =
  "var r=(this.dataset.respaldos||'').split(' ').filter(Boolean);" +
  "if(r.length){this.src=r.shift();this.dataset.respaldos=r.join(' ')}" +
  "else{this.remove()}"

export function atributosDeImagen(cadena) {
  const [primera, ...resto] = cadena
  if (!primera) return null
  return `src="${primera}"${resto.length ? ` data-respaldos="${resto.join(' ')}"` : ''} onerror="${SALTO}"`
}
