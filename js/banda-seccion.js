// La banda de arriba de una página principal (1208, lo de la portada en el
// resto de la web): una ceja con la sección, el título, una línea y sus
// cifras grandes, y a la derecha un dibujo (tres cartas en abanico, una
// cara, un botón). Va en el color de la sección (`--acento`). Su hoja es
// css/seccion.css. Puro.
import { escapeHtml } from './html.js'

// `cifras`: [{ n, texto, accion }], donde `accion` son los atributos del
// botón que la lleva a su sitio (o nada, y es texto). `derecha` ya es HTML.
export function bandaSeccionHtml({ ceja = '', titulo = '', lema = '', cifras = [], derecha = '', id = '' } = {}) {
  const cifra = (c) => {
    const dentro = `<b>${escapeHtml(String(c.n))}</b><small>${escapeHtml(c.texto)}</small>`
    return c.accion ? `<button type="button" class="banda-s-cifra" ${c.accion}>${dentro}</button>` : `<span class="banda-s-cifra">${dentro}</span>`
  }
  return `<section class="banda-s"${id ? ` id="${escapeHtml(id)}"` : ''}>
    <div class="banda-s-texto">
      ${ceja ? `<span class="banda-s-ceja">${escapeHtml(ceja)}</span>` : ''}
      <h2>${escapeHtml(titulo)}</h2>
      ${lema ? `<p class="banda-s-lema">${escapeHtml(lema)}</p>` : ''}
      ${cifras.length ? `<div class="banda-s-cifras">${cifras.map(cifra).join('')}</div>` : ''}
    </div>
    ${derecha ? `<div class="banda-s-derecha">${derecha}</div>` : ''}
  </section>`
}

// Tres fotos de carta en abanico: `fotos` son trozos de HTML (una `<img>` o
// un enlace con ella dentro). Con menos de tres no se pinta: un abanico a
// medias parece un fallo.
export function abanicoHtml(fotos = []) {
  return fotos.length >= 3 ? `<span class="banda-s-abanico" aria-hidden="true">${fotos.slice(0, 3).map((f) => `<span>${f}</span>`).join('')}</span>` : ''
}
