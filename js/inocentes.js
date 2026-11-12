// LOS INOCENTES (tanda 1287, PINGU eligió «Sí, todo Ditto»). El 28 de
// diciembre la línea de la cabecera pone `data-fiesta="inocentes"` (y
// `css/inocentes.css`: la marca dice «PokeDitto»), y esto cambia cada sprite o
// dibujo de Pokémon de la web por Ditto: los que hay y los que lleguen. Las
// fotos de las cartas, los precios y los textos NO se tocan (lo decide
// `dittoDe` por la dirección). Al tocar un Ditto, la primera vez, «¡Inocente!».
// Una tienda no lo ve: está trabajando.
import { showToast } from './toast.js'
import { hojaInyectada } from './hoja.js'
import { DITTO, dittoDe } from './fiestas-puro.js'
import { esTienda } from './navidad.js'

const AVISO = '¡Inocente! Ditto se ha transformado en toda la web. Vuelve mañana.'
const veces = new WeakMap()

// Un Ditto por imagen; si el Ditto no carga, el de PokeAPI. Con tope, para que
// una cadena de respaldos que vuelva a poner su sprite no dé vueltas.
export function cambiar(img) {
  const src = img.getAttribute('src') || ''
  const ditto = dittoDe(src)
  if (!ditto) return false
  const n = veces.get(img) || 0
  if (n >= 3) return false
  veces.set(img, n + 1)
  img.removeAttribute('srcset')
  delete img.dataset.respaldo
  img.dataset.respaldos = ditto === DITTO.pixel ? '' : DITTO.pixel
  img.dataset.ditto = ''
  img.src = ditto
  return true
}

function repasar(raiz) {
  if (raiz.tagName === 'IMG') cambiar(raiz)
  for (const img of raiz.querySelectorAll?.('img') || []) cambiar(img)
}

export async function montarInocentes({ doc = document, win = window } = {}) {
  const raiz = doc.documentElement
  if (await esTienda(doc)) { delete raiz.dataset.fiesta; return }
  hojaInyectada('css/inocentes.css')
  repasar(doc.body)
  new MutationObserver((cambios) => {
    for (const c of cambios) {
      if (c.type === 'attributes') cambiar(c.target)
      else for (const n of c.addedNodes) if (n.nodeType === 1) repasar(n)
    }
  }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
  // El de PokeAPI, si el de Limitless no está.
  doc.addEventListener('error', (e) => {
    const img = e.target
    if (img?.tagName === 'IMG' && img.getAttribute('src') === DITTO.sprite) img.src = DITTO.pixel
  }, true)
  // La primera vez que se toca un Ditto, se cuenta la broma (y no se navega,
  // para que se lea); después, cada Ditto lleva a donde llevaba.
  doc.addEventListener('click', (e) => {
    if (!e.target.closest?.('img[data-ditto]')) return
    try { if (win.sessionStorage.getItem('pd-inocente')) return; win.sessionStorage.setItem('pd-inocente', '1') } catch { return }
    e.preventDefault()
    e.stopPropagation()
    showToast(AVISO, 'success')
  }, true)
}
