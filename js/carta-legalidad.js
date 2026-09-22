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

// ¿Hay alguna impresión LEGAL de esta carta?
//
// Una carta fuera de reglamento no es una carta prohibida: casi siempre
// existe una reimpresión moderna con una marca válida, y lo que está
// fuera es ESA copia, no la carta. Se pregunta por el nombre INGLÉS
// —`name`, nunca `name_es`— porque es la clave con la que se cruzan las
// impresiones entre sí; el nombre traducido es lo que se enseña, no lo
// que se cruza (tanda 335).
//
// Mientras la reparación de nombres de la 335 no haya pasado por un set,
// las cartas que se engordaron en español llevan el español en `name` y
// aquí no encuentran a sus gemelas: una carta con reimpresión legal sale
// como «no es legal». Se arregla solo según avanza la tarea, y el error
// va del lado visible —decir que no cuando sí— y no al revés.
//
// Se guarda la PROMESA, no el resultado: las cuatro copias de una carta
// de una decklist se resuelven a la vez y con el resultado a secas
// saldrían cuatro consultas idénticas antes de que vuelva la primera.
const reimpresiones = new Map()
export function hayReimpresionLegal(nombre, legales) {
  if (!reimpresiones.has(nombre)) {
    reimpresiones.set(
      nombre,
      supabase
        .from('tcg_cards')
        .select('id')
        .eq('market', 'WEST')
        .eq('name', nombre)
        .in('regulation_mark', legales)
        .limit(1)
        .then(({ data }) => !!data?.length)
        .catch(() => false)
    )
  }
  return reimpresiones.get(nombre)
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
    const reimpresion = carta.name ? await hayReimpresionLegal(carta.name, marcas) : false
    return { marcas, reimpresion }
  } catch {
    return null
  }
}
