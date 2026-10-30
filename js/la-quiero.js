// «LA QUIERO» (tanda 751): el corazón de una carta, en la ficha de
// /mi-coleccion y en /carta.
//
// No es una lista nueva: es «Lo que buscas» de los cambios (`user_wants`,
// tanda 376). Una carta que quieres ES una carta que buscas, y dos listas
// del mismo dato se separan el primer día — la quitas de una y en la otra
// sigue. Por eso el corazón apunta «en cualquier idioma» (idioma null), que
// era lo que apuntaba el buscador, y al quitarlo se van TODAS las filas de
// esa carta: si quitas el corazón, ya no la quieres en ningún idioma.
// Desde la 771 se pregunta el idioma al ponerlo (js/idioma-deseo.js), y
// desde la 1047 la versión, si la carta tiene varias.
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'
import { anadirDeseo, borrarDeseo } from './mi-coleccion/cambios.js'
import { showToast } from './toast.js'
import { preguntarDeseo } from './idioma-deseo.js'
import { combosDe } from './deseo-idiomas.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { nombreDeCarta } from './catalogo-series.js'

// En los iconos de la colección y no en js/icons.js, que lo baja la
// portada (CLAUDE.md).
export const corazon = (size = 16) => ICONOS_COLECCION.corazon(size)

// `deseos` son las filas de esa carta: [] = no la quieres, null = no se
// sabe (sin la migración, o sin poder preguntar), y entonces la loseta no
// sale — un corazón vacío diría «no la quieres» de algo que no sabemos.
export function pintarLoseta(boton, cardId, deseos) {
  if (!boton) return
  boton.dataset.quiero = cardId || ''
  boton.classList.toggle('hidden', !cardId || !Array.isArray(deseos))
  const puesta = Array.isArray(deseos) && deseos.some((d) => d.card_id === cardId)
  // Late al PONERSE (784, MV9), no al pintarse la primera vez ni al quitarse.
  const antes = boton.getAttribute('aria-pressed') === 'true'
  if (puesta && !antes && boton.dataset.quieroVisto === cardId) import('./efectos.js').then(({ latir }) => latir(boton)).catch(() => {})
  boton.dataset.quieroVisto = cardId || ''
  boton.setAttribute('aria-pressed', String(puesta))
  const rotulo = boton.querySelector('span')
  if (rotulo) rotulo.textContent = puesta ? 'La quieres' : 'La quiero'
}

// Pone o quita el corazón y devuelve la lista nueva. `deseos` puede ser la
// lista entera (en /mi-coleccion) o solo los de esta carta (en /carta): se
// tocan solo los de `cardId`.
// `carta` dice el catálogo y el nombre que pregunta la ventana del idioma;
// si se cancela, la lista vuelve igual.
// `alCambiar(lista)` recibe la lista PROVISIONAL en el acto (899, R6): quien
// llama pinta con ella antes de que la base conteste; si falla, se lanza y
// quien llama vuelve a pintar con la de antes.
export async function alternar({ userId, cardId, deseos, carta = null, alCambiar = () => {} }) {
  const suyos = deseos.filter((d) => d.card_id === cardId)
  if (suyos.length) {
    const sin = deseos.filter((d) => d.card_id !== cardId)
    alCambiar(sin)
    for (const d of suyos) await borrarDeseo(d.id)
    showToast('Quitada de «La quiero».', 'success')
    return sin
  }
  // El idioma y, si la carta tiene varias, la versión (1047).
  const r = await preguntarDeseo({ nombre: carta ? nombreDeCarta(carta) : '', market: carta?.market || 'WEST', setId: carta?.set_id || null, carta })
  if (r === undefined) return deseos
  // Un deseo por idioma y versión marcados (1128, 1129).
  const combos = r.combos || combosDe(r, carta?.market || 'WEST')
  alCambiar([...combos.map((x, i) => ({ id: `provisional-${Date.now()}-${i}`, user_id: userId, card_id: cardId, idioma: x.idioma, variante: x.variante, provisional: true })), ...deseos])
  const hechas = []
  for (const x of combos) hechas.push(await anadirDeseo({ user_id: userId, card_id: cardId, idioma: x.idioma, ...(x.variante ? { variante: x.variante } : {}) }))
  const versiones = [...new Set(combos.map((x) => x.variante).filter(Boolean))].map(nombreDeVariante)
  showToast(`En «La quiero»${versiones.length ? ` (${versiones.join(' y ')})` : ''}. Si alguien la da, te saldrá en Cruces.`, 'success')
  return [...hechas, ...deseos]
}
