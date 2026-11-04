// LA PORTADA DE UNA GUÍA (1217, «La web como la portada»): la forma que
// comparten /aprender y /guardados en el PC. Su hoja es css/guia-portada.css
// (las dos páginas la cargan). Pura.
import { escapeHtml, arteDe } from './app.js'
import { avanceDeGuia } from './guia-tarjeta.js'
import { pokemonDe, artePokemonHtml } from './arte-pokemon.js'

// LAS PORTADAS (1217, la maqueta de «La web como la portada»): en el PC cada
// guía es una portada del mismo alto —su foto, o un Pokémon sobre el color
// de su tema—, con el tema y los minutos encima, el título y la barra de lo
// leído; la primera, a doble ancho. En el móvil siguen la tarjeta y las filas.
export { pokemonDe, artePokemonHtml }
export function portadaDeGuia(g, { progreso = null, tema = null } = {}) {
  const t = tema || (g.categories ? { nombre: g.categories.name, slug: g.categories.slug } : null)
  const pct = avanceDeGuia(g, progreso)
  const foto = g.cover_image
    ? `<img class="guia-portada-foto" src="${escapeHtml(g.cover_image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />`
    : artePokemonHtml(pokemonDe(g.slug || g.id), 'guia-portada-arte')
  return `<a class="guia-portada arte-${arteDe(t?.slug || g.category_id || g)}" href="/guia/${encodeURIComponent(g.slug)}">
    ${foto}
    ${g.estimated_mins ? `<span class="guia-portada-mins">${g.estimated_mins} min</span>` : ''}
    <span class="guia-portada-sobre">
      ${t?.nombre ? `<span class="guia-portada-tema">${escapeHtml(t.nombre)}</span>` : ''}
      <strong>${escapeHtml(g.title)}</strong>
      ${pct ? `<span class="guia-portada-barra" role="img" aria-label="Llevas el ${pct} %"><i style="width:${pct}%"></i></span>` : ''}
    </span>
  </a>`
}

