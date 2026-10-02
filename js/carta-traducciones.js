// El español del catálogo, y el brillo que le toca a cada rareza.
//
// POR QUÉ ESTÁ SUELTO Y NO DENTRO DE carta-nucleo.js (tanda 374): esto
// son TABLAS, no un molde. `carta-nucleo.js` pinta la ficha entera, así
// que quien lo importa «usa» —a ojos del barrido de la 299, que sigue
// los imports y no las llamadas— todas las clases de `carta.css`. A
// /mi-coleccion le hacía falta traducir una rareza para el reparto del
// resumen y se llevó por delante media ficha: seis clases huérfanas en
// una página que no carga esa hoja.
//
// Es la MISMA razón por la que existen `carta-ruta.js` y
// `escaneo-carta.js`: lo que solo necesita un dato no tiene que
// arrastrar el dibujo.
//
// Lo que no esté en la tabla sale tal cual vino —vale más un «Trainer»
// suelto que un hueco—, y el día que TCGdex se invente una categoría
// nueva no se rompe nada.
export const TIPOS_ES = {
  Grass: 'Planta', Fire: 'Fuego', Water: 'Agua', Lightning: 'Rayo',
  Psychic: 'Psíquico', Fighting: 'Lucha', Darkness: 'Oscuro',
  Metal: 'Metal', Fairy: 'Hada', Dragon: 'Dragón', Colorless: 'Incolora',
}

// Las ONCE fases de TCGdex, copiadas de su `interfaces.d.ts` (tanda 450).
// Faltaban BREAK, V-UNION y Baby, y «Restored» estaba escrito así cuando
// en TCGdex es `RESTORED`: `traducir` busca la clave EXACTA, así que esa
// se enseñaba en inglés y en mayúsculas sin que nada diera error.
export const FASES_ES = {
  Basic: 'Básico', Stage1: 'Fase 1', Stage2: 'Fase 2',
  MEGA: 'MEGA', VMAX: 'VMAX', VSTAR: 'VSTAR', 'V-UNION': 'V-UNION',
  BREAK: 'BREAK', Baby: 'Bebé', RESTORED: 'Restaurado',
  'LEVEL-UP': 'Nivel superior',
}

// Los OCHO tipos de entrenador de TCGdex, no los cuatro de siempre. PINGU:
// «te he dicho solo partidario, objeto, herramienta y estadio; realmente
// hay muchos más — máquina técnica, máquina secreta de Rocket…». Los que
// faltaban son de sets viejos, y por eso no se echan de menos hasta que
// alguien colecciona Neo o EX Team Rocket Returns: entonces el filtro
// enseña el valor en inglés, que es la forma de quedarse viejo sin dar
// error.
export const ENTRENADORES_ES = {
  Supporter: 'Partidario', Item: 'Objeto', Stadium: 'Estadio',
  Tool: 'Herramienta', 'Ace Spec': 'ACE SPEC',
  'Technical Machine': 'Máquina técnica',
  "Rocket's Secret Machine": 'Máquina secreta de Rocket',
  'Goldenrod Game Corner': 'Casino de Ciudad Trigal',
}

export const CATEGORIAS_ES = { Pokemon: 'Pokémon', Trainer: 'Entrenador', Energy: 'Energía' }

export const RAREZAS_ES = {
  Common: 'Común', Uncommon: 'Poco común', Rare: 'Rara',
  'Double rare': 'Doble rara', 'Ultra Rare': 'Ultra rara',
  'Illustration rare': 'Ilustración rara',
  'Special illustration rare': 'Ilustración especial rara',
  'Hyper rare': 'Hiperrara', 'Shiny rare': 'Variocolor rara',
  'Rare Holo': 'Rara holo', 'Amazing Rare': 'Rara asombrosa',
  'Radiant Rare': 'Rara radiante', Promo: 'Promo', 'ACE SPEC Rare': 'ACE SPEC',
}

const traducir = (tabla, valor) => (valor ? tabla[valor] || String(valor) : null)

export const tipoEs = (v) => traducir(TIPOS_ES, v)
export const faseEs = (v) => traducir(FASES_ES, v)
export const categoriaEs = (v) => traducir(CATEGORIAS_ES, v)
export const rarezaEs = (v) => traducir(RAREZAS_ES, v)
export const entrenadorEs = (v) => traducir(ENTRENADORES_ES, v)

// ── Qué brillo le toca a cada rareza (tanda 373) ──
//
// Lo pidió PINGU viendo HoloNook: «cada rareza, su brillo». Hasta ahora
// el escaneo de CUALQUIER carta se inclinaba con el mismo destello, así
// que una común y una hiperrara relucían igual — que es justo lo que un
// coleccionista no perdona, porque el brillo ES la rareza.
//
// Seis familias y no trece, una por rareza: lo que distingue a una
// lámina de otra en la mano es el PATRÓN (barras, polvo de estrellas,
// arcoíris, purpurina dorada), y hay cuatro o cinco patrones de verdad.
// Trece efectos distintos serían trece que mantener y ninguno
// reconocible.
//
// `null` es una respuesta, no un olvido: una común NO brilla, y darle un
// brillo suave sería mentir sobre lo que tienes en la mano.
const BRILLO_POR_RAREZA = {
  Common: null,
  Uncommon: null,
  Rare: null,
  Promo: null,
  'Rare Holo': 'holo',
  'Double rare': 'holo',
  'ACE SPEC Rare': 'acespec',
  'Ultra Rare': 'cosmos',
  'Illustration rare': 'cosmos',
  'Radiant Rare': 'radiante',
  'Amazing Rare': 'radiante',
  'Shiny rare': 'radiante',
  'Special illustration rare': 'arcoiris',
  'Hyper rare': 'dorada',
}

// Las rarezas llegan canonizadas al inglés (`canonizarCarta`), pero el
// catálogo lo mantiene gente y aparecen variantes: se compara sin
// mayúsculas y, si no está en la tabla, por palabras. Una rareza nueva
// que diga «Hyper» tiene que brillar como una hiperrara desde el día
// uno, no cuando alguien se acuerde de añadirla.
export function familiaDeBrillo(rareza) {
  if (!rareza) return null
  const clave = Object.keys(BRILLO_POR_RAREZA).find((k) => k.toLowerCase() === String(rareza).toLowerCase())
  if (clave) return BRILLO_POR_RAREZA[clave]
  const r = String(rareza).toLowerCase()
  if (/hyper|hiperrara|rainbow|arco/.test(r)) return 'dorada'
  if (/special illustration|ilustraci[oó]n especial/.test(r)) return 'arcoiris'
  if (/radiant|radiante|shiny|variocolor|amazing|asombrosa/.test(r)) return 'radiante'
  if (/ultra|illustration|ilustraci[oó]n/.test(r)) return 'cosmos'
  if (/holo|double rare|doble rara/.test(r)) return 'holo'
  return null
}
