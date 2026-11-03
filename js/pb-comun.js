// Lo que comparten los bloques de la portada (js/portada-bloques.js) y la
// clasificación de /retos (js/clasificacion.js): la cara de alguien, la
// cabecera de un bloque, «Ver todo» y la hoja de los bloques (1188). Va
// aparte para que /retos no arrastre la portada entera.
import { escapeHtml, avatarStyle, getInitial } from './app.js'
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'

export const hoja = typeof document !== 'undefined' ? hojaInyectada('css/portada-bloques.css') : Promise.resolve()

export const ic = (n, t = 16) => icons[n]?.(t) || ''
export const nombre = (p) => p?.display_name || p?.username || 'Alguien'

// La cara de alguien. Sin enlace a propósito: a su lado va siempre el nombre,
// que sí lo lleva (o la fila entera lleva a otro sitio), y una cara de 36 px
// que se pulsa se queda por debajo de los 44 (la 312).
export function caraHtml(p, t = 32) {
  const dentro = p?.avatar_url ? '' : escapeHtml(getInitial(nombre(p)))
  return `<span class="pb-cara" style="width:${t}px;height:${t}px;${avatarStyle(p)}" title="${escapeHtml(nombre(p))}" aria-hidden="true">${dentro}</span>`
}

export const cabecera = (titulo, derecha = '') => `<div class="pb-cab"><h2>${titulo}</h2>${derecha}</div>`
export const verTodo = (href, texto = 'Ver todo') => `<a class="ver-todo" href="${href}">${texto} <span class="ver-todo-flecha" aria-hidden="true">→</span></a>`
