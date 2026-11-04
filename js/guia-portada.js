// LA PORTADA DE UNA GUÍA (1217, «La web como la portada»): la forma que
// comparten /aprender y /guardados en el PC. Su hoja es css/guia-portada.css
// (las dos páginas la cargan). Pura.
import { escapeHtml, arteDe } from './app.js'
import { avanceDeGuia } from './guia-tarjeta.js'
import { pokemonDe, artePokemonHtml } from './arte-pokemon.js'
import { rutaDeArticulo } from './articulos.js'
import { icons } from './icons.js'

// «Leída» va arriba a la izquierda, en el color de la sección, y la barra
// sale siempre que se sepa el progreso (vacía si no la has empezado): así el
// tema y el título quedan a la misma altura en todas (1230, PINGU: «si no está
// leído la categoría baja y el otro sube»).
// LAS PORTADAS (1217, la maqueta de «La web como la portada»): en el PC cada
// guía es una portada del mismo alto —su foto, o un Pokémon sobre el color
// de su tema—, con el tema y los minutos encima, el título y la barra de lo
// leído; la primera, a doble ancho. En el móvil siguen la tarjeta y las filas.
export { pokemonDe, artePokemonHtml }
// El enlace es el de la tarjeta (`rutaDeArticulo`): una noticia guardada va
// a /noticias/…, no a /guia/… (1221b, lo cazó la prueba de Guardados).
export function portadaDeGuia(g, { progreso = null, tema = null } = {}) {
  const t = tema || (g.categories ? { nombre: g.categories.name, slug: g.categories.slug } : null)
  const pct = avanceDeGuia(g, progreso)
  const foto = g.cover_image
    ? `<img class="guia-portada-foto" src="${escapeHtml(g.cover_image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />`
    : artePokemonHtml(pokemonDe(g.slug || g.id), 'guia-portada-arte')
  return `<a class="guia-portada arte-${arteDe(t?.slug || g.category_id || g)}" href="${rutaDeArticulo(g.kind, g.slug)}">
    ${foto}
    ${g.estimated_mins ? `<span class="guia-portada-mins">${g.estimated_mins} min</span>` : ''}
    ${pct >= 100 ? `<span class="guia-portada-leida">${icons.checkCircle(12)}Leída</span>` : ''}
    <span class="guia-portada-sobre">
      ${t?.nombre ? `<span class="guia-portada-tema">${escapeHtml(t.nombre)}</span>` : ''}
      <strong>${escapeHtml(g.title)}</strong>
      ${progreso ? `<span class="guia-portada-barra"${pct ? ` role="img" aria-label="Llevas el ${pct} %"` : ' aria-hidden="true"'}><i style="width:${pct}%"></i></span>` : ''}
    </span>
  </a>`
}

