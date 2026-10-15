// La guía en una FILA (tanda 847): la foto (o el arte de la guía) en pequeño,
// el título, nivel · minutos · curso, y por dónde vas. La pintan la portada
// («Aprende»), /aprender en el móvil y /guardados. Había tres —una en cada
// sitio, con sus clases—, y es la lección de la 316: el mismo objeto se
// dibuja una vez.
//
// `progreso` como en la tarjeta (la 319): `null` = no se sabe y no se dice
// nada; `{}` = se sabe y no hay nada; con la fila, lo que ponga.
import { escapeHtml, arteDe } from './app.js'
import { guideHasCourse } from './guia-contenido.js'
import { energiaDeTexto } from './energia-de-texto.js'
import { rutaDeArticulo } from './articulos.js'
import { NIVELES } from './guia-tarjeta.js'
import { hojaInyectada } from './hoja.js'

export const hoja = typeof document !== 'undefined' ? hojaInyectada('css/guia-fila.css') : Promise.resolve()

export function estadoDeGuia(g, progreso) {
  const p = (progreso && progreso[g.id]) || null
  const bloques = Array.isArray(g.blocks) ? g.blocks.length : 0
  const hecha = p?.status === 'completed'
  const leida = hecha || Boolean(p?.read_at)
  const pct = hecha ? 100 : p && bloques ? Math.round((Math.min(p.current_block || 0, bloques) / bloques) * 100) : 0
  return { hecha, leida, pct }
}

// `tema` (866): { nombre } o lo que traiga `g.categories`; en una fila —que
// es un solo enlace— el tema va de texto, delante del nivel.
export function filaDeGuia(g, { progreso = null, tema = null } = {}) {
  const { hecha, leida, pct } = estadoDeGuia(g, progreso)
  const nombreTema = tema?.nombre || g.categories?.name || ''
  const meta = [g.kind === 'news' ? '' : nombreTema, g.kind === 'news' ? 'Noticia' : NIVELES[g.level], g.estimated_mins ? `${g.estimated_mins} min` : '', guideHasCourse(g) ? 'Con curso' : '']
    .filter(Boolean)
    .join(' · ')
  const energia = g.cover_image ? null : energiaDeTexto(`${g.title || ''} ${g.description || ''}`)
  return `
  <a class="guia-fila" href="${rutaDeArticulo(g.kind, g.slug)}">
    <span class="guia-fila-arte guia-arte arte-${arteDe(g)}${energia ? ' con-energia' : ''}"${energia ? ` style="--energia:url('/assets/energias/${energia}.svg')"` : ''} aria-hidden="true">${
      g.cover_image ? `<img src="${escapeHtml(g.cover_image)}" alt="" loading="lazy" width="80" height="60" onerror="this.style.display='none'" />` : ''
    }</span>
    <span class="guia-fila-texto">
      <strong>${escapeHtml(g.title)}</strong>
      <small>${escapeHtml(meta)}${leida ? `${meta ? ' · ' : ''}<span class="guia-fila-hecha">✓ ${hecha ? 'hecha' : 'leída'}</span>` : ''}</small>
      ${!leida && pct > 0 ? `<span class="guia-fila-barra" role="img" aria-label="${pct} % leído"><i style="width:${pct}%"></i></span>` : ''}
    </span>
  </a>`
}
