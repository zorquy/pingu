// HALLOWEEN (tanda 1134, PINGU eligió la C: «para hoy solo está gracioso»).
// La línea de la cabecera de cada página decide si toca (el 31 y el 1, o
// `?temporada=halloween` para probarlo) y pone la web de noche con
// `css/temporada.css`. Esto saca el pop-up «¿Truco o trato?» (1136, que
// sustituye al bloque de la portada: PINGU, «quitar la cabecera del
// fantasma»), una vez por persona. Lo entra app.js por `import()` y solo
// ese día.

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
const VISTO = 'pd-halloween-visto'

export const elegirFantasma = (azar = Math.random()) => FANTASMAS[Math.floor(azar * FANTASMAS.length) % FANTASMAS.length]

const dibujoHtml = (dex, clase = 'temporada-fantasma', lado = 128) => {
  const [src, respaldo] = dibujoDe(dex)
  return `<img class="${clase}" src="${src}" data-respaldo="${respaldo}" alt="" width="${lado}" height="${lado}" decoding="async">`
}

// Tres pasos en el mismo diálogo: la pregunta, el susto (solo con «Truco»)
// y el fantasma que te toca, que llega igual por los dos caminos.
export function popHtml([dex, nombre]) {
  return `<dialog class="temporada-pop" aria-labelledby="temporadaTitulo">
    <div class="temporada-paso" data-paso="pregunta">
      ${dibujoHtml(dex)}
      <h2 id="temporadaTitulo">¡Feliz Halloween!</h2>
      <p>Esta noche PokeDoc se viste de fantasma. ¿Truco o trato?</p>
      <div class="temporada-botones">
        <button type="button" class="btn-secondary" data-temporada-elige="truco">Truco</button>
        <button type="button" class="btn-primary" data-temporada-elige="trato" autofocus>Trato</button>
      </div>
    </div>
    <div class="temporada-paso" data-paso="bu" hidden>
      <div class="temporada-bu-caja">${dibujoHtml(dex, 'temporada-fantasma', 192)}<b class="temporada-bu">¡BU!</b></div>
    </div>
    <div class="temporada-paso" data-paso="trato" hidden>
      <span class="temporada-chapa" data-temporada-chapa>¡Trato!</span>
      <span class="temporada-carta">${dibujoHtml(dex, 'temporada-carta-dibujo', 120)}</span>
      <h2>Te ha tocado ${nombre}</h2>
      <p>Tu fantasma de esta noche: mira todas sus cartas.</p>
      <div class="temporada-botones">
        <a class="btn-primary" href="${buscar(nombre)}">Ver sus cartas</a>
        <button type="button" class="btn-secondary" data-temporada-cerrar>Cerrar</button>
      </div>
    </div>
    <button type="button" class="temporada-quitar" data-temporada-quitar>Quitar la decoración</button>
  </dialog>`
}

function abrirPop(doc, win) {
  // Nunca encima de algo a medias: otra ventana abierta o escribiendo. No se
  // apunta como visto, así que sale en la página siguiente.
  if (doc.querySelector('dialog[open]') || doc.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return
  try { win.localStorage.setItem(VISTO, '1') } catch { return }
  doc.body.insertAdjacentHTML('beforeend', popHtml(elegirFantasma()))
  const pop = doc.body.lastElementChild
  // Si la primera CDN no da el dibujo, la segunda; si tampoco, sin dibujo.
  for (const img of pop.querySelectorAll('img')) {
    img.addEventListener('error', () => {
      if (img.dataset.respaldo) { img.src = img.dataset.respaldo; delete img.dataset.respaldo } else img.remove()
    })
  }
  const paso = (nombre) => { for (const p of pop.querySelectorAll('[data-paso]')) p.hidden = p.dataset.paso !== nombre }
  pop.addEventListener('click', (e) => {
    // Tocar fuera (el fondo es el propio diálogo) lo cierra.
    if (e.target === pop || e.target.closest('[data-temporada-cerrar]')) return pop.close()
    const elige = e.target.closest('[data-temporada-elige]')?.dataset.temporadaElige
    if (elige === 'trato') return paso('trato')
    if (elige === 'truco') {
      paso('bu')
      pop.querySelector('[data-temporada-chapa]').textContent = '¡Truco! Y trato igualmente'
      win.setTimeout(() => { if (pop.open) paso('trato') }, 1300)
    }
  })
  pop.addEventListener('close', () => pop.remove())
  pop.showModal()
}

export async function montarTemporada({ doc = document, win = window } = {}) {
  // La hoja ya la ha puesto la cabecera; esto solo espera a que esté.
  await hojaInyectada('css/temporada.css')
  doc.addEventListener('click', (e) => {
    if (!e.target.closest?.('[data-temporada-quitar]')) return
    try { win.localStorage.setItem('pd-sin-halloween', '1') } catch { /* sin almacenamiento: solo esta visita */ }
    win.location.reload()
  })
  let visto = true
  try { visto = win.localStorage.getItem(VISTO) === '1' } catch { /* sin almacenamiento, mejor no salir en cada página */ }
  if (visto) return
  // Una página que Chrome solo está preparando no lo gasta (985).
  const luego = () => win.setTimeout(() => abrirPop(doc, win), 900)
  if (doc.prerendering) doc.addEventListener('prerenderingchange', luego, { once: true })
  else luego()
}
