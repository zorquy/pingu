// Cuánto llevas de un set, contado de TRES maneras (tanda 398).
//
// PINGU, enseñando la app de Dex: la cabecera de una expansión lleva tres
// barras y no una, y son tres preguntas distintas que la gente hace de
// verdad:
//
//   · **Completo** — las cartas numeradas del set, una por número. Es el
//     «me falta la 47» de toda la vida, y lo que entiende cualquiera.
//   · **Maestro** — cada VERSIÓN cuenta por separado: la normal y su
//     reverse holo son dos casillas. Es el objetivo del que colecciona en
//     serio, y el número es mucho mayor (en 151: 164 de 207 contra 257 de
//     360).
//   · **Adicionales** — lo que viene DESPUÉS del número oficial: los
//     secretos. Van aparte porque mezclarlos con el set completo hace que
//     nadie llegue nunca al 100 %, y porque mucha gente no los persigue.
//
// Este módulo es PURO a propósito: no toca la red ni el DOM, así que las
// tres cuentas se prueban en Node. Lo de «cuántas tengo» entra como
// función, que es lo que ya sabe la pantalla.

import { variantesDeCarta } from './variantes.js'

// Una carta es ADICIONAL si su número impreso pasa del recuento oficial
// del set. Solo se mira cuando el número es un número: las promos y las
// galerías llevan cosas como «XY122» o «GG10», y ahí no hay forma de
// decir si va antes o después — se quedan en el set completo, que es
// donde la gente las busca.
export function esAdicional(carta, oficiales) {
  const n = Number(carta?.local_id)
  return Boolean(oficiales) && Number.isFinite(n) && n > oficiales
}

// `tengo(cardId)` → copias de esa carta en cualquier versión.
// `tengo(cardId, variante)` → copias de ESA versión.
export function progresoDeSet({ cartas = [], set = null, tengo = () => 0 } = {}) {
  const oficiales = Number(set?.card_count_official) || 0
  const base = []
  const extra = []
  for (const c of cartas) (esAdicional(c, oficiales) ? extra : base).push(c)

  const cuenta = (lista) => ({
    tengo: lista.filter((c) => tengo(c.id) > 0).length,
    total: lista.length,
  })

  // El maestro recorre las versiones que EXISTEN de cada carta, no
  // cuatro por carta: ofrecer «1.ª edición» en una de 2024 inventaría
  // casillas que nadie puede llenar (la regla de la tanda 383).
  let maestroTengo = 0
  let maestroTotal = 0
  for (const c of cartas) {
    for (const v of variantesDeCarta(c)) {
      maestroTotal++
      if (tengo(c.id, v.nuestro) > 0) maestroTengo++
    }
  }

  return {
    completo: cuenta(base),
    maestro: { tengo: maestroTengo, total: maestroTotal },
    adicional: cuenta(extra),
  }
}

// El porcentaje, con una regla: sin total no es un cero, es que no se
// sabe. Un 0 % diría «no llevas nada» de un set del que no sabemos
// cuántas cartas tiene (la regla de los tres estados, tanda 319).
export function porcentaje({ tengo, total }) {
  return total > 0 ? Math.round((tengo / total) * 100) : null
}

// Las tres barras, listas para pintar. Se devuelve una LISTA y no tres
// campos sueltos para que la pantalla no tenga que saber cuáles hay: la
// de adicionales desaparece sola en los sets que no tienen secretos, que
// son la mayoría de los viejos.
export function barrasDeSet(progreso) {
  return [
    { id: 'completo', nombre: 'Set completo', ...progreso.completo },
    { id: 'maestro', nombre: 'Set maestro', ...progreso.maestro },
    { id: 'adicional', nombre: 'Adicionales', ...progreso.adicional },
  ].filter((b) => b.total > 0)
}
