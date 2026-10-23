// El paginador del foro (tanda 990): la lista de temas y un tema largo.
// Hasta aquí eran botones `.page-btn` sin una sola regla de CSS —los del
// navegador, diminutos— y uno por página: un tema de 30 páginas eran 30.
// Ahora: «‹ Anterior», las páginas que importan (la primera, la última y las
// de al lado de la tuya, con «…» en medio) y «Siguiente ›». Su CSS, en foro.css.
import { icons } from './icons.js'

// Puro: qué números se enseñan. `null` es un «…».
export function paginasAVer(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const fuera = [1]
  const desde = Math.max(2, Math.min(actual - 1, total - 4))
  const hasta = Math.min(total - 1, Math.max(actual + 1, 5))
  if (desde > 2) fuera.push(null)
  for (let i = desde; i <= hasta; i++) fuera.push(i)
  if (hasta < total - 1) fuera.push(null)
  fuera.push(total)
  return fuera
}

// En el móvil caben menos: la primera, la tuya y la última (y las dos de
// al lado si estás cerca de un extremo), siempre cinco o menos.
export function paginasAVerEstrecho(actual, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  const van = new Set([1, actual, total])
  if (actual <= 3) [2, 3].forEach((p) => van.add(p))
  if (actual >= total - 2) [total - 2, total - 1].forEach((p) => van.add(p))
  const fuera = []
  for (const p of [...van].sort((a, b) => a - b)) {
    if (fuera.length && p - fuera[fuera.length - 1] > 1) fuera.push(null)
    fuera.push(p)
  }
  return fuera
}

export function paginacionHtml(actual, total) {
  if (total <= 1) return ''
  const flecha = (p, texto, clase) => p >= 1 && p <= total
    ? `<button type="button" class="pag-flecha ${clase}" data-pagina="${p}" aria-label="${texto}: página ${p}">${clase === 'pag-ant' ? `${icons.chevronRight(16)}<span class="pag-texto">${texto}</span>` : `<span class="pag-texto">${texto}</span>${icons.chevronRight(16)}`}</button>`
    : `<span class="pag-flecha ${clase}" aria-hidden="true"></span>`
  const numeros = (lista) => lista.map((p) => p === null
    ? '<span class="pag-hueco" aria-hidden="true">…</span>'
    : p === actual
      ? `<span class="pag-num pag-actual" aria-current="page">${p}</span>`
      : `<button type="button" class="pag-num" data-pagina="${p}" aria-label="Página ${p}">${p}</button>`).join('')
  return `<nav class="paginacion" aria-label="Páginas: estás en la ${actual} de ${total}">
    ${flecha(actual - 1, 'Anterior', 'pag-ant')}
    <span class="pag-numeros pag-ancho">${numeros(paginasAVer(actual, total))}</span>
    <span class="pag-numeros pag-estrecho">${numeros(paginasAVerEstrecho(actual, total))}</span>
    ${flecha(actual + 1, 'Siguiente', 'pag-sig')}
  </nav>`
}
