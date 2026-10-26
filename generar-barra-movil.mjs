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
import { claveDePagina, seccionActual, destinoDe, seccionesDe, ICONOS } from './js/barra-movil.js'
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
  // Los enlaces sueltos de la barra: los de primer nivel de .nav-links,
  // fuera de los desplegables.
  const barra = (html.match(/<div class="nav-links"[^>]*>([\s\S]*?)<div class="nav-right"/) || [])[1] || ''
  const sinGrupos = barra.replace(/<div class="nav-grupo[\s\S]*?<\/div>\s*<\/div>/g, '')
  const sueltos = [...sinGrupos.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((a) => ({ href: a[1], texto: a[2].trim() }))
  return seccionesDe(grupos, sueltos)
}

// El HTML de la barra: lo mismo que pintaba el JavaScript, sin cuenta (el
// destino de Cartas con cuenta lo cambia js/barra-movil.js al llegar).
export function barraHtml(html, fichero) {
  const secciones = seccionesDelHtml(html)
  const actual = seccionActual(secciones, claveDePagina(`/${fichero}`))
  return `<nav class="bm" aria-label="Secciones">${secciones.map((s) => `<a href="${destinoDe(s, false)}"${s.nombre === actual ? ' aria-current="page"' : ''}>${icons[ICONOS[s.nombre]]?.(24) || ''}<span>${s.nombre}</span></a>`).join('')}</nav>`
}

// LA SECCIÓN, EN <html> (1018): `data-seccion="aprender"`, para que el CSS
// pinte la barra, la burbuja, la lateral y el botón principal con su color
// (`--acento` en style.css) desde el primer pintado, sin JavaScript.
export function seccionDe(html, fichero) {
  const secciones = seccionesDelHtml(html)
  const actual = seccionActual(secciones, claveDePagina(`/${fichero}`))
  return actual ? actual.toLowerCase() : null
}
// Y SI ES UNA PÁGINA DE DETALLE (1019): de una sección pero fuera de su
// lista (una guía, un tema, un torneo, un perfil ajeno…), `data-detalle`:
// en el móvil lleva la cabecera de app (volver + de dónde + compartir) y
// no pinta sus migas, y eso tiene que estar decidido ANTES del primer
// pintado, o las migas se esconderían con la página ya en pantalla (981).
export function esDetalle(html, fichero) {
  const secciones = seccionesDelHtml(html)
  const clave = claveDePagina(`/${fichero}`)
  const actual = seccionActual(secciones, clave)
  if (!actual || clave === 'index') return false
  const seccion = secciones.find((s) => s.nombre === actual)
  return !seccion.enlaces.some((e) => claveDePagina(e.href) === clave)
}
export function conSeccion(html, fichero) {
  const seccion = seccionDe(html, fichero)
  const detalle = esDetalle(html, fichero)
  return html.replace(/<html([^>]*?)(\s+data-seccion="[^"]*")?(\s+data-detalle)?>/, (m, attrs) => `<html${attrs}${seccion ? ` data-seccion="${seccion}"` : ''}${detalle ? ' data-detalle' : ''}>`)
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

// LA HOJA DEL MÓVIL, EN LA CABECERA (tanda 981). Hasta aquí la inyectaba
// js/barra-movil.js (704), y llegaba DESPUÉS del primer pintado: las
// cabeceras de una línea, la burbuja y los márgenes del móvil se aplicaban
// con la página ya en pantalla y todo bajaba de golpe (medido: un salto en
// /glosario, /retos, /mazos, /torneos… en cada carga). Con `media`, el
// ordenador no la espera para pintar: la baja sin prisa, detrás de todo.
export const HOJA_MOVIL = '<link rel="stylesheet" href="/css/movil.css" media="(max-width: 900px)">'
export function conHojaMovil(html) {
  if (html.includes('href="/css/movil.css"')) return html
  return html.replace('</head>', `  ${HOJA_MOVIL}\n</head>`)
}

// Y LA CLASE DEL MÓVIL, antes del primer pintado (981): con ella la página
// se pinta ya con el hueco y la barra del móvil, en vez de subir 64 px cuando
// llega js/barra-movil.js. DETRÁS de la etiqueta `viewport`: antes de ella
// `matchMedia` cree que la pantalla mide 980 px y no casa nunca.
export const CLASE_MOVIL = "<script>if(window.matchMedia('(max-width: 900px)').matches)document.documentElement.classList.add('con-barra-movil')</script>"
export function conClaseMovil(html) {
  if (html.includes(CLASE_MOVIL)) return html
  return html.replace(/(\n(\s*)<meta name="viewport"[^>]*>)/, (m, linea, sangria) => `${linea}\n${sangria}${CLASE_MOVIL}`)
}

// cartas.html sale de mi-coleccion.html (generar-cartas.mjs): no se toca aquí.
export const PAGINAS = () => readdirSync(RAIZ).filter((f) => f.endsWith('.html') && f !== 'cartas.html')

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let n = 0
  for (const f of PAGINAS()) {
    const ruta = join(RAIZ, f)
    const antes = readFileSync(ruta, 'utf8')
    if (!antes.includes('id="navbar"')) continue
    const despues = conSeccion(conClaseMovil(conHojaMovil(conBarra(antes, f))), f)
    if (despues !== antes) { writeFileSync(ruta, despues); n++ }
  }
  console.log(`barra de abajo al día en ${n} páginas`)
}
