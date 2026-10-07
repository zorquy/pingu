// «LA QUIERO» (tanda 751): el corazón de una carta, en la ficha de
// /mi-coleccion y en /carta.
//
// No es una lista nueva: es «Lo que buscas» de los cambios (`user_wants`,
// tanda 376). Una carta que quieres ES una carta que buscas, y dos listas
// del mismo dato se separan el primer día — la quitas de una y en la otra
// sigue. Por eso el corazón apunta «en cualquier idioma» (idioma null), que
// es lo que apunta el buscador, y al quitarlo se van TODAS las filas de esa
// carta: si quitas el corazón, ya no la quieres en ningún idioma.
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'
import { anadirDeseo, borrarDeseo } from './mi-coleccion/cambios.js'
import { showToast } from './toast.js'

// En los iconos de la colección y no en js/icons.js, que lo baja la
// portada (CLAUDE.md).
export const corazon = (size = 16) => ICONOS_COLECCION.corazon(size)

export function losetaHtml(id) {
  return `<button type="button" class="mc-ficha-tile mc-ficha-quiero hidden" id="${id}" aria-pressed="false"><i aria-hidden="true">${corazon(16)}</i><span>La quiero</span></button>`
}

// `deseos` son las filas de esa carta: [] = no la quieres, null = no se
// sabe (sin la migración, o sin poder preguntar), y entonces la loseta no
// sale — un corazón vacío diría «no la quieres» de algo que no sabemos.
export function pintarLoseta(boton, cardId, deseos) {
  if (!boton) return
  boton.dataset.quiero = cardId || ''
  boton.classList.toggle('hidden', !cardId || !Array.isArray(deseos))
  const puesta = Array.isArray(deseos) && deseos.some((d) => d.card_id === cardId)
  boton.setAttribute('aria-pressed', String(puesta))
  const rotulo = boton.querySelector('span')
  if (rotulo) rotulo.textContent = puesta ? 'La quieres' : 'La quiero'
}

// Pone o quita el corazón y devuelve la lista nueva. `deseos` puede ser la
// lista entera (en /mi-coleccion) o solo los de esta carta (en /carta): se
// tocan solo los de `cardId`.
export async function alternar({ userId, cardId, deseos }) {
  const suyos = deseos.filter((d) => d.card_id === cardId)
  if (suyos.length) {
    for (const d of suyos) await borrarDeseo(d.id)
    showToast('Quitada de «La quiero».', 'success')
    return deseos.filter((d) => d.card_id !== cardId)
  }
  const d = await anadirDeseo({ user_id: userId, card_id: cardId })
  showToast('En «La quiero». Si alguien la da, te saldrá en Cambios.', 'success')
  return [d, ...deseos]
}
