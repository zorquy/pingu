// HALLOWEEN (tanda 1134, PINGU eligió la C: «para hoy solo está gracioso»).
// La línea de la cabecera de cada página decide si toca (el 31 y el 1, o
// `?temporada=halloween` para probarlo) y pone la web de noche con
// `css/temporada.css`; esto solo rellena el bloque de la portada, que ya
// tiene su hueco reservado. Lo entra app.js por `import()` y solo ese día.

import { hojaInyectada } from './hoja.js'

// Los fantasmas que pueden asomar, con su número de Pokédex (el dibujo es el
// de «¿Quién es ese Pokémon?», de PokeAPI).
export const FANTASMAS = [
  [94, 'Gengar'],
  [778, 'Mimikyu'],
  [887, 'Dragapult'],
  [609, 'Chandelure'],
  [354, 'Banette'],
  [711, 'Gourgeist'],
  [477, 'Dusknoir'],
  [429, 'Mismagius'],
  [442, 'Spiritomb'],
  [1013, 'Sinistcha'],
]
const ARTE = 'sprites/pokemon/other/official-artwork'
export const dibujoDe = (dex) => [
  `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/${ARTE}/${dex}.png`,
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/${ARTE}/${dex}.png`,
]

// El 31 de octubre y el 1 de noviembre, en la hora de quien mira: la misma
// regla que la línea de la cabecera.
export const esHalloween = (f = new Date()) => (f.getMonth() === 9 && f.getDate() === 31) || (f.getMonth() === 10 && f.getDate() === 1)

const buscar = (nombre) => `/cartas?ver=buscar&q=${encodeURIComponent(nombre)}`

export function bloqueHtml(azar = Math.random()) {
  const i = Math.floor(azar * FANTASMAS.length) % FANTASMAS.length
  const [dex, nombre] = FANTASMAS[i]
  const otros = [FANTASMAS[i], ...FANTASMAS.filter((_, j) => j !== i)].slice(0, 4)
  return `<section class="temporada-bloque" aria-label="Halloween en PokeDoc">
    <h2>Noche de fantasmas<span class="temporada-largo"> en PokeDoc</span></h2>
    <p>${nombre} se ha colado en la portada.<span class="temporada-largo"> Hoy la web se ha vestido de noche: ¿cuántos fantasmas tienes en tu colección?</span></p>
    <div class="temporada-chips">${otros.map(([, n]) => `<a href="${buscar(n)}">${n}</a>`).join('')}</div>
    <button type="button" class="temporada-quitar" data-temporada-quitar>Quitar la decoración</button>
    <img class="temporada-fantasma" src="${dibujoDe(dex)[0]}" data-respaldo="${dibujoDe(dex)[1]}" alt="" width="160" height="160" loading="lazy" decoding="async">
  </section>`
}

export async function montarTemporada() {
  // La hoja ya la ha puesto la cabecera; esto solo espera a que esté.
  await hojaInyectada('css/temporada.css')
  const hueco = document.getElementById('temporadaHueco')
  if (hueco && !hueco.firstChild) {
    hueco.innerHTML = bloqueHtml()
    const img = hueco.querySelector('.temporada-fantasma')
    // Si la primera CDN no lo da, la segunda; si tampoco, sin fantasma.
    img?.addEventListener('error', () => {
      if (img.dataset.respaldo) { img.src = img.dataset.respaldo; delete img.dataset.respaldo } else img.remove()
    })
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('[data-temporada-quitar]')) return
    try { localStorage.setItem('pd-sin-halloween', '1') } catch { /* sin almacenamiento: solo esta visita */ }
    location.reload()
  })
}
