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

// LAS RAREZAS SE MUDARON A `js/rarezas.js` (tanda 463), con el nombre
// OFICIAL en español y su marca impresa. Se re-exportan desde aquí para no
// mover los seis sitios que las importan — y porque es verdad: siguen
// siendo el español del catálogo, solo que con dibujo.
export { RAREZAS_ES, rarezaEs, rarezaDeCarta, formasDeRareza, marcaDeRarezaHtml } from './rarezas.js'
import { rarezaEs as rarezaEsImpl } from './rarezas.js'

// AQUÍ ESTABA `ALIAS_TCGDEX` (tanda 455, fuera en la 463). TCGdex traduce
// los enums, así que la misma cosa está guardada en inglés o en español
// según en qué idioma se importara esa fila, y el catálogo se ha importado
// en varios. La tabla juntaba las que NO coincidían… y todas las que no
// coincidían eran RAREZAS, porque éramos nosotros los que les habíamos
// puesto otro nombre («Doble rara» donde el oficial es «Rara Doble»).
// Ahora decimos el nombre oficial, que es el mismo que dice TCGdex, y la
// tabla de excepciones se queda sin excepciones. Las formas sueltas que
// aún se ven en el catálogo viven en `js/rarezas.js`, junto a su rareza.
//
// Lo que no esté en la tabla sale tal cual vino: vale más un «Trainer»
// suelto que un hueco, y una categoría nueva de TCGdex no rompe nada.
const traducir = (tabla, valor) => {
  if (!valor) return null
  return tabla[valor] || String(valor)
}

export const tipoEs = (v) => traducir(TIPOS_ES, v)
export const faseEs = (v) => traducir(FASES_ES, v)
export const categoriaEs = (v) => traducir(CATEGORIAS_ES, v)
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
// POR EL NOMBRE CANÓNICO (tanda 463) y no por el inglés: la misma carta
// está guardada en inglés o en español según en qué idioma se importara su
// fila, así que una tabla en inglés dejaba sin brillo a media base. Pasa
// por `rarezaEs`, que entiende las dos.
const BRILLO_POR_RAREZA = {
  Común: null,
  Infrecuente: null,
  Rara: null,
  Promo: null,
  'Sin rareza': null,
  'Rara Holo': 'holo',
  'Rara Doble': 'holo',
  'Rara ACE SPEC': 'acespec',
  'Rara Ultra': 'cosmos',
  'Rara Ilustración': 'cosmos',
  'Rara Radiante': 'radiante',
  'Rara Asombrosa': 'radiante',
  'Rara Brillante': 'radiante',
  'Rara Brillante Ultra': 'arcoiris',
  'Rara Ilustración Especial': 'arcoiris',
  'Rara Híper': 'dorada',
  'Rara Híper Mega': 'dorada',
  'Rara Ataque Mega': 'arcoiris',
}

// Las rarezas llegan canonizadas al inglés (`canonizarCarta`), pero el
// catálogo lo mantiene gente y aparecen variantes: se compara sin
// mayúsculas y, si no está en la tabla, por palabras. Una rareza nueva
// que diga «Hyper» tiene que brillar como una hiperrara desde el día
// uno, no cuando alguien se acuerde de añadirla.
export function familiaDeBrillo(rareza) {
  if (!rareza) return null
  const canonica = rarezaEsImpl(rareza)
  if (canonica in BRILLO_POR_RAREZA) return BRILLO_POR_RAREZA[canonica]
  const clave = Object.keys(BRILLO_POR_RAREZA).find((k) => k.toLowerCase() === String(canonica).toLowerCase())
  if (clave) return BRILLO_POR_RAREZA[clave]
  const r = String(rareza).toLowerCase()
  if (/hyper|hiperrara|rainbow|arco/.test(r)) return 'dorada'
  if (/special illustration|ilustraci[oó]n especial/.test(r)) return 'arcoiris'
  if (/radiant|radiante|shiny|variocolor|amazing|asombrosa/.test(r)) return 'radiante'
  if (/ultra|illustration|ilustraci[oó]n/.test(r)) return 'cosmos'
  if (/holo|double rare|doble rara|rara doble/.test(r)) return 'holo'
  return null
}
