// Las filas de un resultado (718). Las pintan /buscar y la paleta de
// Ctrl+K con el MISMO molde: una carta es siempre su foto, su nombre, su
// set y su precio, la busques donde la busques. Su CSS va en
// `css/buscador.css`.
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { avatarStyle, getInitial, profileUrl } from './app.js'
import { rutaDeCarta } from './carta-ruta.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { euros } from './cardmarket.js'
import { atributosDeRango } from './rangos.js'

// Adónde lleva cada fila. Va aparte del HTML porque la paleta navega con
// el teclado y necesita la dirección sin pintar nada.
export function destinoDe(grupo, f) {
  if (grupo === 'cartas') return rutaDeCarta(f)
  if (grupo === 'guias') return `/guia/${encodeURIComponent(f.slug)}`
  if (grupo === 'temas') return `/tema/${encodeURIComponent(f.id)}`
  if (grupo === 'gente') return profileUrl(f)
  return f.href || '#'
}

// El interior de la fila: icono o foto, dos líneas y, en las cartas, el
// precio a la derecha (sin cifra si no la hay: no se inventa una).
export function interiorDe(grupo, f) {
  if (grupo === 'cartas') {
    const cadena = cadenaDeEscaneo(f)
    const numero = f.local_id ? ` · ${escapeHtml(f.local_id)}` : ''
    return `<img class="bs-foto" src="${escapeHtml(cadena[0] || '')}" data-cadena="${escapeHtml(JSON.stringify(cadena.slice(1)))}" width="36" height="50" loading="lazy" alt="">
      <span class="bs-texto"><b>${escapeHtml(nombreDeCarta(f))}</b><small>${escapeHtml(nombreDeSet(f.tcg_sets))}${numero}</small></span>
      ${f.valor ? `<span class="bs-precio">${escapeHtml(euros(f.valor))}</span>` : ''}`
  }
  if (grupo === 'guias') {
    return `<span class="bs-icono" aria-hidden="true">${icons.bookOpen(18)}</span>
      <span class="bs-texto"><b>${escapeHtml(f.title)}</b>${f.description ? `<small>${escapeHtml(f.description)}</small>` : ''}</span>`
  }
  if (grupo === 'temas') {
    return `<span class="bs-icono" aria-hidden="true">${icons.messageSquare(18)}</span>
      <span class="bs-texto"><b>${escapeHtml(f.title)}</b><small>Hilo del foro</small></span>`
  }
  if (grupo === 'gente') {
    const nombre = f.display_name || f.username || 'Entrenador'
    return `<span class="bs-avatar" style="${avatarStyle(f)}" aria-hidden="true">${f.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>
      <span class="bs-texto"><b${atributosDeRango(f)}>${escapeHtml(nombre)}</b>${f.username ? `<small>@${escapeHtml(f.username)}</small>` : ''}</span>`
  }
  return `<span class="bs-icono" aria-hidden="true">${f.icono ? icons[f.icono]?.(18) || '' : ''}</span>
    <span class="bs-texto"><b>${escapeHtml(f.nombre)}</b>${f.detalle ? `<small>${escapeHtml(f.detalle)}</small>` : ''}</span>`
}

// Una foto que no carga pasa a la siguiente de su cadena, y sin más, se
// queda el hueco (con su tamaño reservado): nunca un rectángulo invisible
// que se puede pulsar (la 441).
export function engancharFotos(raiz) {
  raiz.addEventListener('error', (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('bs-foto')) return
    let resto = []
    try { resto = JSON.parse(img.dataset.cadena || '[]') } catch {}
    if (resto.length) {
      img.dataset.cadena = JSON.stringify(resto.slice(1))
      img.src = resto[0]
    } else img.classList.add('bs-sin-foto')
  }, true)
}
