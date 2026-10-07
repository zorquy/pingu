// La barra de abajo del móvil, ESCRITA en cada página (tanda 753, A4).
//
// Hasta la 752 la montaba js/barra-movil.js cuando ya había sesión, así
// que cada página se pintaba sin barra y la barra llegaba después: un
// parpadeo en cada cambio de página, y sin transición posible (la página
// nueva no la tiene cuando el navegador hace la foto). Ahora va en el HTML,
// como el pie, con la sección de la página ya marcada; el JavaScript solo
// la remata (el destino de Cartas con cuenta, los oyentes) — no la crea.
//
// No se escribe a mano en 37 páginas: este guion la saca de las mismas
// funciones que usa la web (js/barra-movil.js) y de la barra de arriba de
// cada página, y la pone entre sus dos marcas. Una prueba comprueba que lo
// que hay en el repo es lo que sale de aquí. Si cambias la barra de arriba
// o las secciones:
//
//     node generar-barra-movil.mjs && node generar-cartas.mjs
//
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ICONOS, ORDEN, claveDePagina, seccionActual, destinoDe } from './js/barra-movil.js'
import { icons } from './js/icons.js'

const RAIZ = dirname(fileURLToPath(import.meta.url))
export const INICIO = '<!-- barra-movil: la escribe generar-barra-movil.mjs -->'
export const FIN = '<!-- /barra-movil -->'

// Las secciones de la barra de arriba de una página, como
// `seccionesDeLaBarra` pero leyendo el HTML.
export function seccionesDelHtml(html) {
  const grupos = [...html.matchAll(/<div class="nav-grupo[^"]*">\s*<button[^>]*class="nav-grupo-btn"[^>]*>([^<]+)<\/button>\s*<div class="nav-sub">([\s\S]*?)<\/div>/g)].map((m) => ({
    nombre: m[1].trim(),
    enlaces: [...m[2].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((a) => ({ href: a[1], texto: a[2].trim() })),
  }))
  const noticias = html.match(/<div class="nav-links"[^>]*>[\s\S]*?<a href="([^"]*noticias[^"]*)"[^>]*>([^<]+)<\/a>/)
  const inicio = { nombre: 'Inicio', enlaces: [{ href: '/index.html', texto: 'Inicio' }, ...(noticias ? [{ href: noticias[1], texto: noticias[2].trim() }] : [])] }
  return [inicio, ...grupos].filter((s) => ORDEN.includes(s.nombre)).sort((a, b) => ORDEN.indexOf(a.nombre) - ORDEN.indexOf(b.nombre))
}

// El HTML de la barra: lo mismo que pintaba el JavaScript, sin cuenta (el
// destino de Cartas con cuenta lo cambia js/barra-movil.js al llegar).
export function barraHtml(html, fichero) {
  const secciones = seccionesDelHtml(html)
  const actual = seccionActual(secciones, claveDePagina(`/${fichero}`))
  return `<nav class="bm" aria-label="Secciones">${secciones.map((s) => `<a href="${destinoDe(s, false)}"${s.nombre === actual ? ' aria-current="page"' : ''}>${icons[ICONOS[s.nombre]]?.(24) || ''}<span>${s.nombre}</span></a>`).join('')}</nav>`
}

// La pone justo detrás de la barra de arriba (o sustituye la que hubiera).
export function conBarra(html, fichero) {
  const bloque = `${INICIO}\n  ${barraHtml(html, fichero)}\n  ${FIN}`
  if (html.includes(INICIO)) return html.replace(new RegExp(`${INICIO}[\\s\\S]*?${FIN}`), bloque)
  const desde = html.indexOf('id="navbar"')
  if (desde < 0) return html
  // El cierre de la barra de arriba, contando las <nav> de dentro.
  const re = /<\/?nav\b/g
  re.lastIndex = html.lastIndexOf('<nav', desde)
  let nivel = 0
  let m
  while ((m = re.exec(html))) {
    nivel += m[0] === '<nav' ? 1 : -1
    if (nivel === 0) {
      const fin = html.indexOf('>', m.index) + 1
      return `${html.slice(0, fin)}\n  ${bloque}${html.slice(fin)}`
    }
  }
  throw new Error(`${fichero}: no encuentro el cierre de la barra de arriba`)
}

// cartas.html sale de mi-coleccion.html (generar-cartas.mjs): no se toca aquí.
export const PAGINAS = () => readdirSync(RAIZ).filter((f) => f.endsWith('.html') && f !== 'cartas.html')

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let n = 0
  for (const f of PAGINAS()) {
    const ruta = join(RAIZ, f)
    const antes = readFileSync(ruta, 'utf8')
    if (!antes.includes('id="navbar"')) continue
    const despues = conBarra(antes, f)
    if (despues !== antes) { writeFileSync(ruta, despues); n++ }
  }
  console.log(`barra de abajo al día en ${n} páginas`)
}
