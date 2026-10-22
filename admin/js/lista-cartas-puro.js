// Una lista de cartas pegada al crear una colección a mano (957): una carta
// por línea, «número · nombre · nombre en inglés» (el inglés, si quieres), y
// en cualquier sitio de la línea la dirección de su foto (961).
// Vale cualquiera de estos separadores: «·», «;», «|», un tabulador o, entre
// el número y el nombre, un espacio. Sin tocar la base: así se prueba en Node.
// Y la tabla de un set de Bulbapedia copiada tal cual (962): el número con su
// cuenta («001/049»), las columnas de tipo y rareza, que sobran, y la fila de
// los títulos, que no es una carta.
const SEPARADOR = /\s*(?:·|;|\||\t)\s*/
const SOBRAN = new Set(['grass', 'fire', 'water', 'lightning', 'psychic', 'fighting', 'darkness', 'metal', 'fairy', 'dragon', 'colorless',
  'c', 'u', 'r', 'rr', 'rrr', 'ar', 'sar', 'sr', 'ur', 'hr', 'chr', 'csr', 's', 'ssr', 'tr', 'k', 'pr', 'p', 'a', '★', '☆', '◆', '●', '◇',
  'common', 'uncommon', 'rare', 'rare holo', 'holo rare', 'double rare', 'ultra rare', 'secret rare', 'illustration rare',
  'special illustration rare', 'hyper rare', 'promo', 'trainer', 'energy', 'item', 'supporter', 'stadium', 'pokémon tool', 'basic energy', 'special energy'])
const TITULOS = /^(no\.?|nº|#|number|número)?\s*(·|\t|\s)*\s*(name|card name|nombre|carta)\b/i

export function cartasDeLista(texto) {
  const cartas = []
  const errores = []
  const vistos = new Set()
  String(texto || '').split(/\r?\n/).forEach((linea, i) => {
    const t = linea.trim()
    if (!t || TITULOS.test(t)) return
    const m = /^([A-Za-z]{0,4}\d+[A-Za-z]?)(?:\/\d+)?(?:\s*(?:·|;|\||\t)\s*|\s+)(.+)$/.exec(t)
    if (!m) return errores.push(`Línea ${i + 1}: no empieza por un número («${t.slice(0, 40)}»)`)
    const trozos = m[2].split(SEPARADOR).map((x) => x.trim())
    const foto = trozos.find((x) => /^https?:\/\/\S+$/i.test(x))
    const [nombre, ingles] = trozos.filter((x) => x && x !== foto && !SOBRAN.has(x.toLowerCase()))
    if (!nombre) return errores.push(`Línea ${i + 1}: falta el nombre`)
    const n = m[1]
    if (vistos.has(n.toLowerCase())) return errores.push(`Línea ${i + 1}: el número ${n} está dos veces`)
    vistos.add(n.toLowerCase())
    cartas.push({ local_id: n, name: nombre, ...(ingles ? { name_en: ingles } : {}), ...(foto ? { image_path: foto } : {}) })
  })
  return { cartas, errores }
}

// El id de una carta a mano, el mismo que pone «Nueva carta» del panel.
export const idDeCartaAMano = (setId, numero) => `mano-${setId}-${numero}`.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
