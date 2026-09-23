// De la respuesta de TCGdex a las columnas de `tcg_cards`.
//
// Vivía en `netlify/lib/carta-detalle.mjs` y se muda aquí en la tanda
// 331 porque lo necesita TAMBIÉN el navegador: cuando alguien abre una
// carta que la tarea programada todavía no ha engordado, la ficha se la
// pide a TCGdex en el momento y la pinta igual. Una petición, y solo
// para la carta que alguien ha abierto de verdad — que es exactamente
// donde vale la pena gastarla.
//
// Sigue siendo PURA y sin un solo import: así la usan las dos mitades
// (el navegador y la función de Netlify, que la reexporta) sin copiarla.
// Es lo mismo que se hizo con `js/carta-nucleo.js` en la 324.

const API = 'https://api.tcgdex.net/v2'

// Un entero o null.
//
// TCGdex da los PS y la retirada como número, pero algunas cartas
// antiguas los traen en texto ("70"), con sufijo ("70+") o vacíos. Una
// cadena donde Postgres espera integer tumba la fila ENTERA: la carta se
// quedaría sin engordar para siempre por culpa de un campo secundario.
function entero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isInteger(n) ? n : null
}

// Una lista, o null si el campo no venía.
//
// La diferencia importa, y es la misma lección de la barra de progreso
// de la tanda 319: `[]` afirma «esta carta no tiene ataques» y null dice
// «no se sabe». Un Entrenador no tiene ataques de verdad y TCGdex
// devuelve el campo ausente, no vacío — así que null es lo honesto.
function lista(valor) {
  return Array.isArray(valor) ? valor : null
}

// Los campos cambian según la categoría (un Entrenador no trae `hp`, una
// Energía no trae `attacks`) y el catálogo lo mantiene gente, así que en
// las cartas viejas falta de todo. Lo que no venga se queda null: nada
// de valores por defecto, que es justo lo que hace que una página afirme
// algo falso sin que nada dé error.
export function detalleDeCarta(card) {
  if (!card || typeof card !== 'object') return null
  const fila = {
    category: card.category || null,
    hp: entero(card.hp),
    types: Array.isArray(card.types) && card.types.length ? card.types : null,
    stage: card.stage || null,
    evolve_from: card.evolveFrom || null,
    retreat: entero(card.retreat),
    attacks: lista(card.attacks),
    abilities: lista(card.abilities),
    weaknesses: lista(card.weaknesses),
    resistances: lista(card.resistances),
    trainer_type: card.trainerType || null,
    energy_type: card.energyType || null,
    suffix: card.suffix || null,
    rarity: card.rarity || null,
    illustrator: card.illustrator || null,
    description: card.description || null,
    variants: card.variants && typeof card.variants === 'object' ? card.variants : null,
  }
  // La marca de regulación ya la rellenó de una vez
  // supabase-migration-cartas-marcas.sql. Esta petición la trae de paso,
  // así que las que aquel volcado no cubrió se arreglan solas — pero
  // solo se escribe SI VIENE. Ponerla a null cuando falta borraría lo
  // que ya estaba bien, y eso rompería la comprobación de reglamento de
  // las decklists sin que nadie se entere.
  if (card.regulationMark) fila.regulation_mark = card.regulationMark
  // Y con los enums en su forma canónica: TCGdex los traduce igual que
  // los ataques, y todo el resto del código los compara en inglés.
  return canonizarCarta(fila)
}

// ── El idioma de la ficha (tanda 330) ──
//
// El catálogo occidental se IMPORTA en inglés a propósito, pero eso es
// una decisión sobre el listado, donde lo único que hay es el nombre. El
// texto de los ataques viene en la petición POR CARTA, que hacemos
// igual: pedirla en español no cuesta ni una petición más, cuesta
// pedirla en otro idioma.
//
// El orden importa. Primero español, y si esa carta no está traducida
// —TCGdex no tiene las anteriores a 2011—, inglés. Al revés no tendría
// sentido, y quedarse solo en español dejaría media ficha vacía.
export const IDIOMAS_DE_FICHA = ['es', 'en']

export function urlDeCartaEnIdioma(cardId, idioma) {
  return `${API}/${idioma}/cards/${encodeURIComponent(cardId)}`
}

// Pide la carta en español y cae a inglés. Devuelve TAMBIÉN en qué
// idioma vino, que es lo que se guarda en `detalle_lang`: sin eso, una
// carta traducida y una que no lo está son indistinguibles, y
// reintentarlo dentro de un año costaría reengordar las 23.000.
//
// `pedir` se inyecta para poder probar esto sin red. Y `idiomas` también
// (tanda 333): quien compara huellas quiere la candidata en el idioma de
// la carta que YA tiene —los nombres de los ataques solo casan dentro de
// un idioma—, así que pasa el suyo primero. Para pintar, el orden por
// defecto es el bueno: español, y si no hay, inglés.
export async function detalleEnEspanol(cardId, pedir, idiomas = IDIOMAS_DE_FICHA) {
  for (const idioma of idiomas) {
    const carta = await pedir(urlDeCartaEnIdioma(cardId, idioma))
    if (!carta) continue
    const fila = detalleDeCarta(carta)
    if (!fila) continue
    // El NOMBRE también viene traducido, y es lo primero que se lee.
    // Se devuelve aparte porque `detalleDeCarta` no lo toca: la columna
    // `name` la escribe la importación y aquí se pisa solo si de verdad
    // ha llegado algo.
    const nombre = typeof carta.name === 'string' && carta.name.trim() ? carta.name.trim() : null
    return { fila, idioma, nombre }
  }
  return null
}

// ════════════════════════════════════════════════════════════════════
// Devolver los ENUMS a su forma canónica (tanda 334)
// ════════════════════════════════════════════════════════════════════
//
// Al empezar a engordar en español (tanda 330) se nos pasó lo obvio:
// TCGdex no traduce solo los ataques. Traduce TAMBIÉN los campos que
// el código compara con cadenas inglesas — `category`, `stage`, los
// tipos, la rareza. La ficha de PINGU lo enseñaba a la vista: donde
// nuestra tabla dice «Doble rara» salía «Rara Doble», que es la cadena
// de TCGdex tal cual.
//
// Y eso no era cosmético. `category === 'Pokemon'` es la puerta del
// subtítulo, del cuadro de debilidad/resistencia/retirada Y de la
// huella — así que una carta engordada en español se quedaba sin las
// tres cosas a la vez, y sin huella tampoco salían sus reimpresiones.
// Los tres síntomas que PINGU llevaba dos días viendo eran UNO.
//
// Aquí se deshace: lo que se guarda y lo que se compara vuelve al
// inglés, que es la forma canónica de todo el resto del código. Lo que
// se ENSEÑA se sigue traduciendo al pintar, con las tablas de siempre.

const sinTildes = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// Se construye INVIRTIENDO las tablas de traducción que ya existen, no
// escribiendo una lista nueva: así no puede separarse de ellas. Y con
// las claves sin tildes ni mayúsculas, que es lo que evita depender de
// cómo escriba TCGdex cada palabra.
function inverso(tabla, extras = {}) {
  const mapa = new Map()
  for (const [ingles, español] of Object.entries(tabla)) {
    mapa.set(sinTildes(español), ingles)
    mapa.set(sinTildes(ingles), ingles)
  }
  for (const [alias, ingles] of Object.entries(extras)) mapa.set(sinTildes(alias), ingles)
  return mapa
}

// Las mismas tablas que usa `js/carta-nucleo.js` para pintar, aquí al
// revés. Van escritas otra vez porque este módulo no importa NADA a
// propósito —lo usan el navegador y dos funciones de servidor— y una
// prueba compara las dos para que no se separen.
const TIPOS = { Grass: 'Planta', Fire: 'Fuego', Water: 'Agua', Lightning: 'Rayo',
  Psychic: 'Psíquico', Fighting: 'Lucha', Darkness: 'Oscuro', Metal: 'Metal',
  Fairy: 'Hada', Dragon: 'Dragón', Colorless: 'Incolora' }
const FASES = { Basic: 'Básico', Stage1: 'Fase 1', Stage2: 'Fase 2', MEGA: 'MEGA',
  VMAX: 'VMAX', VSTAR: 'VSTAR', Restored: 'Restaurado', 'LEVEL-UP': 'Nivel superior' }
const CATEGORIAS = { Pokemon: 'Pokémon', Trainer: 'Entrenador', Energy: 'Energía' }
const ENTRENADORES = { Supporter: 'Partidario', Item: 'Objeto', Stadium: 'Estadio', Tool: 'Herramienta' }

// Los alias son las formas que NO salen de invertir la tabla: como lo
// escribe TCGdex en su español, o las variantes que se ven por ahí. Si
// aparece una que no está, el valor se queda tal cual y lo salva la
// comprobación por ESTRUCTURA de `esPokemon` — no se pierde la ficha.
// TCGdex declina los tipos en FEMENINO, porque concuerdan con «energía»:
// manda «Oscura», no «Oscuro». La tabla de arriba tenía la forma
// masculina y la debilidad del Mew ex de 30th Celebration salía sin
// traducir — lo vio PINGU (tanda 342). Van las dos formas de cada uno
// que tiene género; los demás son nombres y no varían (Agua, Fuego,
// Lucha, Metal, Hada, Dragón, Planta, Rayo).
const A_TIPO = inverso(TIPOS, { Relampago: 'Lightning', Electrico: 'Lightning',
  Electrica: 'Lightning', Oscuridad: 'Darkness', Siniestro: 'Darkness',
  Siniestra: 'Darkness', Oscura: 'Darkness', Acero: 'Metal', Metalica: 'Metal',
  Metalico: 'Metal', Normal: 'Colorless', Incoloro: 'Colorless',
  Psiquica: 'Psychic', Planta2: 'Grass', Combate: 'Fighting' })
const A_FASE = inverso(FASES, { Basica: 'Basic', 'Nivel 1': 'Stage1', 'Nivel 2': 'Stage2',
  'Fase1': 'Stage1', 'Fase2': 'Stage2' })
const A_CATEGORIA = inverso(CATEGORIAS, { Pokemon: 'Pokemon', Entrenadora: 'Trainer',
  Energias: 'Energy' })
const A_ENTRENADOR = inverso(ENTRENADORES, { Apoyo: 'Supporter', Articulo: 'Item',
  Herramienta: 'Tool', 'Ace Spec': 'Item' })
// Y el tipo de energía, que también viene traducido y decide si una
// carta está SIEMPRE dentro del formato (tanda 335). TCGdex lo llama
// «Normal» en inglés; en español se ha visto escrito de las dos maneras,
// así que van las dos — si mañana sale una tercera, el valor se queda
// tal cual y lo único que pasa es que esa energía no se marca como
// básica, que es el lado seguro del error.
const A_ENERGIA = inverso({ Normal: 'Normal', Special: 'Especial' }, { Basica: 'Normal' })

const canonico = (mapa, valor) => (valor == null ? valor : mapa.get(sinTildes(valor)) || valor)

export function canonizarCarta(fila) {
  if (!fila || typeof fila !== 'object') return fila
  const tipo = (t) => canonico(A_TIPO, t)
  const conTipo = (lista) =>
    Array.isArray(lista) ? lista.map((f) => (f && typeof f === 'object' ? { ...f, type: tipo(f.type) } : f)) : lista
  return {
    ...fila,
    category: canonico(A_CATEGORIA, fila.category),
    stage: canonico(A_FASE, fila.stage),
    trainer_type: canonico(A_ENTRENADOR, fila.trainer_type),
    energy_type: canonico(A_ENERGIA, fila.energy_type),
    types: Array.isArray(fila.types) ? fila.types.map(tipo) : fila.types,
    weaknesses: conTipo(fila.weaknesses),
    resistances: conTipo(fila.resistances),
    attacks: Array.isArray(fila.attacks)
      ? fila.attacks.map((a) =>
          a && typeof a === 'object' && Array.isArray(a.cost) ? { ...a, cost: a.cost.map(tipo) } : a
        )
      : fila.attacks,
  }
}

// ¿Es un Pokémon?
//
// Por la categoría canónica, y si esa palabra no la conocemos, POR LA
// ESTRUCTURA: los PS solo los tiene un Pokémon. Esa segunda vía es la
// que hace que un idioma nuevo, o una palabra que TCGdex cambie mañana,
// no vuelva a dejar media ficha en blanco sin que nada dé error.
export function esPokemon(carta) {
  const cat = canonico(A_CATEGORIA, carta?.category)
  if (cat === 'Pokemon') return true
  if (cat === 'Trainer' || cat === 'Energy') return false
  return Number.isInteger(carta?.hp)
}

// ¿Es una energía básica? Importa porque una energía básica se puede
// jugar SIEMPRE, lleve la marca de regulación que lleve: es regla del
// juego y no del formato (tanda 335).
//
// El revisor de decklists lo pregunta por el NOMBRE de la línea pegada,
// porque allí no hay más que texto. Aquí hay ficha, así que se pregunta
// por lo que la carta ES — y el nombre queda de respaldo para las que
// todavía no se han engordado y tienen la categoría a null.
export function esEnergiaBasica(carta) {
  const cat = canonico(A_CATEGORIA, carta?.category)
  if (cat === 'Energy') return canonico(A_ENERGIA, carta?.energy_type) !== 'Special'
  if (cat) return false
  return /^basic\b|energ[íi]a b[áa]sica/i.test(String(carta?.name ?? ''))
}
