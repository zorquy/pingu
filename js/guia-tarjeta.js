// La tarjeta de una guía, UNA sola vez (tanda 316).
//
// Había dos, para el mismo objeto y a dos metros la una de la otra: la
// de /aprender (`.guia-tarjeta`) y la de la portada (`.recent-card`), sin
// una clase en común. La de la portada no decía de qué era la guía, ni
// el nivel, ni si traía curso, ni por dónde ibas — y gastaba 170 px de
// degradado para enseñar una chapa de rareza. Eso no es una decisión de
// diseño: es que nadie volvió a mirar las dos a la vez.
//
// La que queda es la de /aprender, que es la que dice más, con lo que la
// portada aportaba: quién la escribió y el botón de guardar. Esos dos
// van FUERA del enlace, en un pie: un <button> dentro de un <a> no
// existe en HTML y el navegador lo escupe fuera, descolocando la caja.
import { escapeHtml, guideHasCourse, arteDe } from './app.js'

export const NIVELES = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' }
export const RAREZAS = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino' }

// `progreso` es el mapa por id de guía; `categoria`, el nombre ya
// resuelto —la tarjeta no tiene por qué saber cómo se buscan—; y `pie`
// dice si se pintan los ganchos del autor y del guardar, que solo tienen
// sentido donde alguien los va a rellenar (decorateGuideCards).
export function tarjetaDeGuia(g, { progreso = {}, categoria = '', pie = false } = {}) {
  const p = progreso[g.id] || null
  const bloques = Array.isArray(g.blocks) ? g.blocks.length : 0
  const hechoPct = p?.status === 'completed' ? 100 : p && bloques ? Math.round((Math.min(p.current_block || 0, bloques) / bloques) * 100) : 0
  const leida = Boolean(p?.read_at) || p?.status === 'completed'
  const nivel = NIVELES[g.level] || null
  const rareza = g.guide_rarity && RAREZAS[g.guide_rarity] ? g.guide_rarity : null
  // La barra se pinta SIEMPRE, con el relleno a cero si no has empezado:
  // antes aparecía y desaparecía según el progreso, y una tarjeta con
  // barra al lado de otra sin barra no se leen como lo mismo.
  const relleno = leida && hechoPct === 0 ? 100 : hechoPct
  const estado =
    p?.status === 'completed'
      ? '<span class="guia-hecha">✓ Curso hecho</span>'
      : leida
        ? '<span class="guia-hecha">✓ Leída</span>'
        : hechoPct > 0
          ? `Vas por el ${hechoPct}%`
          : 'Sin empezar'
  return `
  <article class="guia-tarjeta" data-guide-id="${escapeHtml(g.id || '')}" data-author-id="${escapeHtml(g.author_id || '')}">
    <a class="guia-tarjeta-enlace" href="/guia.html?slug=${encodeURIComponent(g.slug)}">
      <span class="guia-arte arte-${arteDe(g)}">
        ${g.cover_image ? `<img src="${escapeHtml(g.cover_image)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
        <span class="guia-arte-info">
          ${categoria ? `<span class="guia-chapa-cat">${escapeHtml(categoria)}</span>` : '<span></span>'}
          ${g.estimated_mins ? `<span class="guia-chapa-min">${g.estimated_mins} min</span>` : ''}
        </span>
      </span>
      <span class="guia-cuerpo">
        <strong class="guia-titulo">${escapeHtml(g.title)}</strong>
        ${g.description ? `<span class="guia-desc">${escapeHtml(g.description)}</span>` : ''}
        <span class="guia-etiquetas">
          ${nivel ? `<span class="guia-etiqueta">${nivel}</span>` : ''}
          ${guideHasCourse(g) ? '<span class="guia-etiqueta">Con curso</span>' : ''}
          ${rareza ? `<span class="guia-etiqueta guia-rareza rareza-${escapeHtml(rareza)}">${RAREZAS[rareza]}</span>` : ''}
        </span>
        <span class="guia-progreso">
          <span class="guia-progreso-texto">${estado}</span>
          <span class="guia-barra"><i style="width:${relleno}%"></i></span>
        </span>
      </span>
    </a>
    ${
      pie
        ? `<div class="guia-pie">
      <span class="guia-pie-autor" data-card-author></span>
      <button class="card-save-btn" data-card-save title="Guardar" aria-label="Guardar">${''}</button>
    </div>`
        : ''
    }
  </article>`
}
