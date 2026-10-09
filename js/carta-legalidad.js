// Las dos preguntas que hay que hacerle a la base para saber si una
// carta se puede jugar hoy (tanda 335).
//
// POR QUÉ ESTÁ SUELTO: lo pregunta el revisor de decklists de un torneo
// y lo pregunta la ficha de una carta. Antes vivía dentro de
// `js/torneos/cartas-decklist.js`, y desde la ficha no se podía importar
// sin arrastrar el revisor entero —con su Pokédex de sprites— a una
// página que no pinta ni un mazo. Copiarlo tampoco: dos copias de la
// regla de legalidad se separan el día que cambie la temporada, y
// entonces la ficha diría una cosa y el revisor otra, sin dar error.
//
// Lo que NO está aquí es DECIDIR: eso es `legalidadEstandar` en
// `js/carta-nucleo.js`, que es puro y lo puede ejecutar también la
// función del borde. Aquí solo se va a buscar el dato.
import { supabase } from './supabase.js'
import { claveDeNombre } from './clave-de-nombre.js'

// El respaldo para cuando la fila de `site_settings` no está puesta
// todavía. Es un valor de temporada y caduca solo: el que manda es el
// de la base, que un admin cambia desde /admin sin tocar el código.
export const MARCAS_LEGALES_DEFECTO = ['H', 'I', 'J']

let marcasCache = null

// Las marcas legales de la temporada, una sola vez por página.
export async function marcasLegales() {
  if (marcasCache) return marcasCache
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'torneos_reglas').maybeSingle()
    const marcas = data?.value?.marcas_legales
    marcasCache = Array.isArray(marcas) && marcas.length ? marcas : MARCAS_LEGALES_DEFECTO
  } catch {
    marcasCache = MARCAS_LEGALES_DEFECTO
  }
  return marcasCache
}

// ── Las colecciones nuevas sin letra (tanda 633, aquí desde la 800) ──
//
// Las cartas que crea TCGGO no traen la letra de reglamento: el Mew ex del
// 30 aniversario, y cualquier reimpresión de una colección reciente que
// TCGdex no haya marcado. Una carta sin letra de una colección que salió
// DESPUÉS de que empezara la marca legal más vieja se da por legal: no hay
// colección nueva que no lo sea. La fecha de corte es la de la colección
// más vieja con alguna carta de esa marca.
const MERCADO = 'WEST'
export function setsRecientesSinMarca(sets, setsConMarcaVieja) {
  const fechas = (setsConMarcaVieja || []).map((id) => sets.find((s) => s.id === id)?.release_date).filter(Boolean).sort()
  const corte = fechas[0]
  if (!corte) return new Set()
  return new Set(sets.filter((s) => s.release_date && String(s.release_date) >= String(corte)).map((s) => s.id))
}
let recientesCache = null
export function coleccionesRecientes() {
  recientesCache ||= (async () => {
    try {
      const legales = await marcasLegales()
      const vieja = [...legales].sort()[0]
      const [cartas, sets] = await Promise.all([
        supabase.from('tcg_cards').select('set_id').eq('market', MERCADO).eq('regulation_mark', vieja).limit(2000),
        supabase.from('tcg_sets').select('id,release_date').eq('market', MERCADO),
      ])
      if (cartas.error || sets.error) throw cartas.error || sets.error
      return setsRecientesSinMarca(sets.data || [], [...new Set((cartas.data || []).map((r) => r.set_id))])
    } catch {
      // Sin poder preguntar, nada se da por legal sin su letra.
      return new Set()
    }
  })()
  return recientesCache
}

// ── La regla de la reimpresión ──
//
// Una carta fuera de reglamento no es una carta prohibida: casi siempre
// existe una reimpresión moderna, y lo que está fuera es ESA copia, no la
// carta (la Ultra Ball de letra F se juega porque hay una Ultra Ball
// legal). Hasta la 800 había DOS versiones de esta regla: la del
// constructor, completa, y la de aquí —la de los torneos y la ficha—, que
// solo buscaba por `name` exacto y solo reimpresiones CON letra legal. Las
// de TCGGO no llevan letra, así que en una lista de torneo la Ultra Ball
// vieja salía «fuera del reglamento» y en el constructor no. Ahora es una.
//
// Se cruza por tres columnas, porque mientras dure la reparación de
// nombres de la 335 no todas las filas dicen lo mismo en cada una: `name`
// (el inglés, la clave buena), `name_key` (una fila que aún lleve el
// español en `name` casa por su clave) y `name_es` (la promo vieja ya con
// el inglés y la moderna todavía con el español se encuentran por el
// traducido). Y cuentan las reimpresiones con letra legal y las sin letra
// de una colección reciente. Devuelve el conjunto de `claveDeNombre` de
// las cartas que tienen reimpresión legal; si algo falla, vacío (se avisa
// de más, nunca de menos).
export async function nombresConReimpresionLegal(cartas) {
  const lista = (cartas || []).filter(Boolean)
  const nombres = [...new Set(lista.map((c) => c.name).filter(Boolean))]
  const claves = [...new Set(lista.map((c) => c.name_key).filter(Boolean))]
  const traducidos = [...new Set(lista.map((c) => c.name_es).filter(Boolean))]
  if (!nombres.length && !claves.length) return new Set()
  try {
    const [legales, recientes] = await Promise.all([marcasLegales(), coleccionesRecientes()])
    const sinLetra = [...recientes]
    const pedir = (columna, valores, conLetra) =>
      valores.length && (conLetra || sinLetra.length)
        ? (conLetra
            ? supabase.from('tcg_cards').select('name,name_es,name_en,name_key').eq('market', MERCADO).in(columna, valores).in('regulation_mark', legales)
            : supabase.from('tcg_cards').select('name,name_es,name_en,name_key').eq('market', MERCADO).in(columna, valores).is('regulation_mark', null).in('set_id', sinLetra)
          )
            .limit(1000)
            .then(({ data }) => data || [])
            .catch(() => [])
        : Promise.resolve([])
    const filas = (
      await Promise.all([
        pedir('name', nombres, true),
        pedir('name_key', claves, true),
        pedir('name_es', traducidos, true),
        pedir('name', nombres, false),
        pedir('name_key', claves, false),
      ])
    ).flat()
    const nombresLegales = new Set(filas.flatMap((r) => [r.name, r.name_es]).filter(Boolean))
    const clavesLegales = new Set(filas.map((r) => r.name_key).filter(Boolean))
    const con = new Set()
    for (const c of lista) {
      if (nombresLegales.has(c.name) || (c.name_es && nombresLegales.has(c.name_es)) || clavesLegales.has(c.name_key)) con.add(claveDeNombre(c))
    }
    return con
  } catch {
    return new Set()
  }
}

// La misma pregunta para UNA carta (la ficha). Se guarda la PROMESA y no
// el resultado: las cuatro copias de una carta se preguntan a la vez.
const reimpresiones = new Map()
export function hayReimpresionLegal(carta) {
  const c = typeof carta === 'string' ? { name: carta } : carta
  const clave = claveDeNombre(c)
  if (!reimpresiones.has(clave)) reimpresiones.set(clave, nombresConReimpresionLegal([c]).then((s) => s.has(clave)))
  return reimpresiones.get(clave)
}

// Lo que `nucleoDeCarta` espera recibir: las marcas de la temporada y si
// esta carta tiene una reimpresión legal. La segunda consulta solo sale
// cuando hace falta —si la marca ya es legal, la respuesta no cambia
// nada— y si algo falla se devuelve null, que es «no se sabe» y hace que
// no se pinte ninguna chapa. Nunca un `false` inventado.
export async function legalidadDeCarta(carta) {
  if (!carta) return null
  try {
    const marcas = await marcasLegales()
    const marca = String(carta.regulation_mark || '')
    if (marca && marcas.includes(marca)) return { marcas, reimpresion: false }
    const reimpresion = carta.name || carta.name_key ? await hayReimpresionLegal(carta) : false
    return { marcas, reimpresion }
  } catch {
    return null
  }
}
