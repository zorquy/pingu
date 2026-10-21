// Una lista de cartas pegada al crear una colección a mano (957): una carta
// por línea, «número · nombre · nombre en inglés» (el inglés, si quieres).
// Vale cualquiera de estos separadores: «·», «;», «|», un tabulador o, entre
// el número y el nombre, un espacio. Sin tocar la base: así se prueba en Node.
const SEPARADOR = /\s*(?:·|;|\||\t)\s*/

export function cartasDeLista(texto) {
  const cartas = []
  const errores = []
  const vistos = new Set()
  String(texto || '').split(/\r?\n/).forEach((linea, i) => {
    const t = linea.trim()
    if (!t) return
    const m = /^([A-Za-z]{0,4}\d+[A-Za-z]?)(?:\s*(?:·|;|\||\t)\s*|\s+)(.+)$/.exec(t)
    if (!m) return errores.push(`Línea ${i + 1}: no empieza por un número («${t.slice(0, 40)}»)`)
    const [nombre, ingles] = m[2].split(SEPARADOR).map((x) => x.trim())
    if (!nombre) return errores.push(`Línea ${i + 1}: falta el nombre`)
    const n = m[1]
    if (vistos.has(n.toLowerCase())) return errores.push(`Línea ${i + 1}: el número ${n} está dos veces`)
    vistos.add(n.toLowerCase())
    cartas.push({ local_id: n, name: nombre, ...(ingles ? { name_en: ingles } : {}) })
  })
  return { cartas, errores }
}

// El id de una carta a mano, el mismo que pone «Nueva carta» del panel.
export const idDeCartaAMano = (setId, numero) => `mano-${setId}-${numero}`.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')
