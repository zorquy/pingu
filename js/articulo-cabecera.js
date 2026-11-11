// LA PORTADA DE UN ARTÍCULO (tanda 1283, PINGU: «modernizarlo un poco… más
// chulo, más visual»; eligió lo recomendado de la propuesta). Una guía o una
// noticia abre con su portada a lo ancho: su imagen (o, sin ella, el Pokémon de
// su tema sobre el color de su tarjeta), las migas, los chips, el título y la
// entradilla encima. En una noticia, además, la fecha en grande.
//
// PURO y en un solo sitio porque la pintan DOS mitades: js/guia.js en el
// navegador y netlify/edge-functions/meta-social.js en el servidor, antes de
// que llegue el JavaScript (la 270 y la 309). Si cada una la escribiera a su
// manera, el relevo daría un salto. Debajo va la franja de quien la firma, que
// solo pinta el navegador: el servidor deja su hueco del mismo alto
// (`franjaReservadaHtml`).
import { escapeHtml } from './html.js'
import { pokemonDelTema } from './temas-pokemon.js'
import { pokemonDe } from './arte-pokemon.js'
import { arteDe } from './arte-de.js'

export const NIVELES = { beginner: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado' }
export const RAREZAS = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino' }

const ARTE = 'sprites/pokemon/other/official-artwork'

// El día y el mes, en hora de España en los dos lados: el servidor corre en
// UTC y, a medianoche, una noticia diría un día en el primer pintado y otro
// después.
export function diaYMes(iso) {
  const f = iso ? new Date(iso) : null
  if (!f || Number.isNaN(f.getTime())) return null
  const partes = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'short' }).formatToParts(f)
  const dia = partes.find((p) => p.type === 'day')?.value
  const mes = (partes.find((p) => p.type === 'month')?.value || '').replace('.', '')
  return dia && mes ? { dia, mes } : null
}

// Qué va de fondo: la imagen de la guía; sin ella, el Pokémon de su tema (el
// mismo que en /aprender) o, si el tema no tiene, el de su tarjeta.
export function fondoDeArticulo(g, tema) {
  const foto = typeof g?.cover_image === 'string' && /^(https:\/\/|\/)[^\s"'<>]+$/.test(g.cover_image) ? g.cover_image : null
  if (foto) return { foto }
  const dex = pokemonDelTema(tema) || pokemonDe(g?.slug || g?.id)
  return { dex, arte: arteDe(tema?.slug || g?.category_id || g?.slug || g) }
}

function arteHtml(dex) {
  const url = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/${ARTE}/${dex}.png`
  const respaldo = `https://raw.githubusercontent.com/PokeAPI/sprites/master/${ARTE}/${dex}.png`
  return `<img class="gh-arte" src="${url}" alt="" width="320" height="320" loading="eager" decoding="async" fetchpriority="high" onerror="if(!this.dataset.r){this.dataset.r=1;this.src='${respaldo}'}else{this.remove()}" />`
}

// `g`: la fila (title, description, slug, kind, cover_image, level,
// guide_rarity, published_at, category_id). `tema`: { name, slug, pokemon }.
export function portadaDeArticuloHtml(g, { tema = null } = {}) {
  const esNoticia = g?.kind === 'news'
  const fondo = fondoDeArticulo(g, tema)
  const nombreTema = tema?.name || tema?.slug || ''
  const migas = esNoticia
    ? `<a href="/noticias">Noticias</a>`
    : `<a href="/aprender">Guías</a>${tema?.slug ? ` <span>›</span> <a href="/aprender?tema=${encodeURIComponent(tema.slug)}">${escapeHtml(nombreTema)}</a>` : ''}`
  const fecha = esNoticia ? diaYMes(g?.published_at) : null
  const chips = esNoticia
    ? `<span class="gh-chip gh-chip-tipo guide-label">Noticia</span>`
    : `${nombreTema ? `<span class="gh-chip gh-chip-tipo guide-label">${escapeHtml(nombreTema)}</span>` : ''}${NIVELES[g?.level] ? `<span class="gh-chip">${NIVELES[g.level]}</span>` : ''}<span class="gh-chip gh-chip-${escapeHtml(g?.guide_rarity || 'bronze')}">${RAREZAS[g?.guide_rarity] || 'Bronce'}</span>`
  return `<header class="article-header gh${fondo.foto ? ' gh-con-foto' : ` gh-sin-foto arte-${fondo.arte}`}" data-tipo="${esNoticia ? 'noticia' : 'guia'}">
    ${fondo.foto ? `<img class="gh-foto" src="${escapeHtml(fondo.foto)}" alt="" loading="eager" decoding="async" fetchpriority="high" onerror="this.remove()" />` : arteHtml(fondo.dex)}
    <div class="gh-dentro">
      <nav class="breadcrumb gh-migas" aria-label="Dónde estás"><a href="/">Inicio</a> <span>›</span> ${migas} <span>›</span> <span class="gh-migas-aqui">${escapeHtml(g?.title || '')}</span></nav>
      ${fecha ? `<p class="gh-fecha" aria-hidden="true"><b>${escapeHtml(fecha.dia)}</b><small>${escapeHtml(fecha.mes)}</small></p>` : ''}
      <div class="gh-chips">${chips}</div>
      <h1>${escapeHtml(g?.title || '')}</h1>
      ${g?.description && !(esNoticia && loImportante(g.description).length) ? `<p class="lead">${escapeHtml(g.description)}</p>` : ''}
    </div>
  </header>`
}

// El hueco de la franja del autor en el primer pintado del servidor: el mismo
// alto que la de verdad (lo fija guia.css), vacío.
export const franjaReservadaHtml = () => '<div class="gh-franja gh-franja-reservada" aria-hidden="true"></div>'

// «Lo importante» de una noticia: su entradilla partida en frases, como
// mucho tres. Con una sola frase no se pinta (ya está debajo del título).
export function loImportante(texto) {
  const frases = String(texto || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 3)
  return frases.length >= 2 ? frases.slice(0, 3) : []
}

// La caja de «Lo importante», debajo de la franja. La pintan las dos mitades,
// como la portada: en una noticia con varias frases, la entradilla va aquí y
// no debajo del título.
export function importanteHtml(g) {
  const frases = g?.kind === 'news' ? loImportante(g.description) : []
  if (!frases.length) return ''
  return `<section class="gh-importante" aria-label="Lo importante"><h2>Lo importante</h2><ul>${frases.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul></section>`
}

// El índice (1283): los títulos numerados como en el texto (01, 02…: el
// número lo pone el CSS a cada <h2>) y los subtítulos debajo, sin número.
export function numerarApartados(headings) {
  let n = 0
  return (headings || []).map((h) => ({ ...h, n: (h.nivel || 2) === 2 ? ++n : null }))
}

export function indiceHtml(headings, escape = escapeHtml) {
  return numerarApartados(headings)
    .map((h, i) => `<li${h.n ? '' : ' class="gi-sub"'}><a class="gi-paso" data-i="${i}" href="#${escape(h.id)}"><em>${h.n || ''}</em><span>${escape(h.text || '')}</span></a></li>`)
    .join('')
}

// Los minutos que quedan, con lo leído en tanto por uno.
export function minutosQueQuedan(total, fraccion) {
  const f = Math.min(1, Math.max(0, Number(fraccion) || 0))
  return Math.max(0, Math.ceil((Number(total) || 0) * (1 - f)))
}
