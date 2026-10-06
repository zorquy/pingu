// LA BARRA INFERIOR DEL MÓVIL (tanda 704). PINGU: «la interfaz de móvil,
// ¿cómo podríamos mejorar?». Lo que más pesaba: la navegación era de
// ratón —siete iconos sin rótulo arriba y las secciones detrás de una
// hamburguesa—. Ahora, en pantallas de móvil, tres niveles y cada uno en
// su sitio:
//
//  1. ABAJO, FIJA: la sección (Inicio, Aprender, Cartas, Comunidad,
//     Jugar). La misma en todas las páginas; nunca cambia.
//  2. ARRIBA, PÍLDORAS: las páginas de esa sección — exactamente lo que
//     hoy vive en cada desplegable de la barra de escritorio. Se LEEN del
//     HTML de la barra (`.nav-grupo`), así que no hay una segunda lista
//     que mantener: si alguien añade un enlace al desplegable, sale aquí.
//  3. Dentro de la página, lo que ya tiene (las pestañas de Mi colección).
//
// Se carga solo en el móvil (app.js lo importa con `import()` tras
// comprobar el ancho) y se trae su hoja: en el escritorio no se descarga
// ni un byte, que es lo que cuida el presupuesto de la portada.
import { icons } from './icons.js'

// La hoja que este módulo necesita. La prueba 299 lee este marcador para
// saber que las clases `bm-*` tienen hoja aunque no esté en el HTML.
export function hojaInyectada(ruta) {
  if (document.querySelector(`link[href="${ruta}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = ruta
  document.head.appendChild(l)
}

// Qué icono lleva cada sección (por el nombre del desplegable).
export const ICONOS = { Inicio: 'home', Aprender: 'bookOpen', Cartas: 'cards', Comunidad: 'messageSquare', Jugar: 'trophy' }
export const ORDEN = ['Inicio', 'Aprender', 'Cartas', 'Comunidad', 'Jugar']

// Una página que no está en ningún desplegable (la ficha de una carta, un
// tema del foro, un torneo…) pertenece a la sección de lo que enseña.
export const SECCION_DE = {
  Aprender: ['aprender', 'retos', 'guardados', 'guia', 'curso', 'categoria', 'carta-del-dia', 'mas-caro', 'nueve'],
  Cartas: ['cartas', 'lanzamientos', 'mi-coleccion', 'carta', 'coleccion'],
  Comunidad: ['foro', 'usuarios', 'tema', 'usuario', 'mensajes', 'buscar', 'colabora'],
  Jugar: ['torneos', 'torneo', 'meta', 'mazo-meta', 'constructor', 'laboratorio', 'mazos', 'mis-partidas', 'repeticiones'],
  Inicio: ['index', 'noticias'],
}

// «/mi-coleccion», «/mi-coleccion.html» y «mi-coleccion.html?ver=panel»
// son la misma página: su clave es el primer tramo sin extensión.
export function claveDePagina(href, origen = 'https://pokedoc.es') {
  let ruta
  try { ruta = new URL(href, origen).pathname } catch { return '' }
  const limpia = ruta.replace(/\.html$/, '').replace(/\/+$/, '').replace(/^\/+/, '')
  return (limpia.split('/')[0] || 'index').toLowerCase()
}

// Las secciones, leídas de la barra de escritorio: nombre y enlaces.
export function seccionesDeLaBarra(doc = document) {
  const grupos = [...doc.querySelectorAll('.nav-links .nav-grupo')].map((g) => ({
    nombre: g.querySelector('.nav-grupo-btn')?.textContent.trim() || '',
    enlaces: [...g.querySelectorAll('.nav-sub a')].map((a) => ({ href: a.getAttribute('href'), texto: a.textContent.trim() })),
  }))
  const noticias = doc.querySelector('.nav-links > a[href*="noticias"]')
  const inicio = { nombre: 'Inicio', enlaces: [{ href: '/index.html', texto: 'Inicio' }, ...(noticias ? [{ href: noticias.getAttribute('href'), texto: noticias.textContent.trim() }] : [])] }
  return [inicio, ...grupos].filter((s) => ORDEN.includes(s.nombre)).sort((a, b) => ORDEN.indexOf(a.nombre) - ORDEN.indexOf(b.nombre))
}

// La sección de la página actual: por sus enlaces, y si no, por la tabla.
export function seccionActual(secciones, clave) {
  const porEnlace = secciones.find((s) => s.enlaces.some((e) => claveDePagina(e.href) === clave))
  if (porEnlace) return porEnlace.nombre
  return Object.keys(SECCION_DE).find((n) => SECCION_DE[n].includes(clave)) || null
}

// A dónde lleva cada hueco de la barra: la primera página de la sección,
// salvo Cartas, que con cuenta es Mi colección y sin ella el catálogo.
export function destinoDe(seccion, conSesion) {
  if (seccion.nombre === 'Cartas') return conSesion ? '/mi-coleccion' : '/cartas'
  return seccion.enlaces[0]?.href || '/'
}

export function montarBarraMovil({ conSesion = false, doc = document, clave = claveDePagina(location.pathname, location.origin) } = {}) {
  if (!doc.getElementById('navbar') || doc.querySelector('.bm')) return null
  hojaInyectada('css/movil.css')
  const secciones = seccionesDeLaBarra(doc)
  const actual = seccionActual(secciones, clave)
  doc.documentElement.classList.add('con-barra-movil')

  const barra = doc.createElement('nav')
  barra.className = 'bm'
  barra.setAttribute('aria-label', 'Secciones')
  barra.innerHTML = secciones.map((s) => `<a href="${destinoDe(s, conSesion)}"${s.nombre === actual ? ' aria-current="page"' : ''}>${icons[ICONOS[s.nombre]]?.(24) || ''}<span>${s.nombre}</span></a>`).join('')
  doc.body.appendChild(barra)

  // Las páginas de la sección (lo que hoy vive en su desplegable) NO van
  // arriba (704c: PINGU, «estamos cogiendo demasiado espacio con las
  // píldoras»): salen en una hoja pequeña encima de la barra al volver a
  // tocar la sección en la que ya estás, como hace cualquier app.
  const seccion = secciones.find((s) => s.nombre === actual)
  const activo = barra.querySelector('[aria-current="page"]')
  if (seccion && activo && seccion.enlaces.length > 1) {
    activo.setAttribute('aria-haspopup', 'true')
    activo.setAttribute('aria-expanded', 'false')
    const velo = doc.createElement('div')
    velo.className = 'bm-velo'
    velo.hidden = true
    const hoja = doc.createElement('div')
    hoja.className = 'bm-hoja'
    hoja.hidden = true
    hoja.setAttribute('role', 'menu')
    hoja.setAttribute('aria-label', `Páginas de ${seccion.nombre}`)
    hoja.innerHTML = `<p class="bm-hoja-titulo">${seccion.nombre}</p>` + seccion.enlaces.map((e) => `<a role="menuitem" href="${e.href}"${claveDePagina(e.href) === clave ? ' aria-current="page"' : ''}>${e.texto}</a>`).join('')
    doc.body.append(velo, hoja)
    const abrir = (si) => { velo.hidden = !si; hoja.hidden = !si; activo.setAttribute('aria-expanded', String(si)) }
    activo.addEventListener('click', (ev) => { ev.preventDefault(); abrir(hoja.hidden) })
    velo.addEventListener('click', () => abrir(false))
    doc.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !hoja.hidden) abrir(false) })
  }
  return { actual, secciones }
}
