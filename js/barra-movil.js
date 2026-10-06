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

// El icono de cada página de una sección (lo que hay en js/icons.js).
export const ICONO_DE_PAGINA = { index: 'home', noticias: 'newspaper', aprender: 'bookOpen', retos: 'zap', guardados: 'bookmark', cartas: 'cards', lanzamientos: 'calendar', 'mi-coleccion': 'layers', foro: 'messageSquare', usuarios: 'users', torneos: 'trophy', meta: 'trendingUp', constructor: 'edit', laboratorio: 'lightbulb', mazos: 'package', 'mis-partidas': 'gamepad', repeticiones: 'eye' }
export const iconoDePagina = (clave) => ICONO_DE_PAGINA[clave] || 'compass'
// En una burbuja la palabra es corta: «Constructor de mazos» pide 160 px
// y «Constructor» dice lo mismo debajo de un lápiz.
export const ROTULO_CORTO = { aprender: 'Guías', retos: 'Retos', cartas: 'Catálogo', 'mi-coleccion': 'Mi colección', meta: 'Meta', constructor: 'Constructor', 'mis-partidas': 'Partidas', usuarios: 'Gente' }
export const rotuloCorto = (clave, texto) => ROTULO_CORTO[clave] || texto

// Una burbuja con más de lo que cabe lleva un degradado en el lado por el
// que sigue, para que se vea que se desliza; al llegar al final, se quita.
function vigilarDesborde(el) {
  const mirar = () => {
    const sobra = el.scrollWidth - el.clientWidth
    el.classList.toggle('desborda-derecha', sobra > 2 && el.scrollLeft < sobra - 2)
    el.classList.toggle('desborda-izquierda', sobra > 2 && el.scrollLeft > 2)
  }
  el.addEventListener('scroll', mirar, { passive: true })
  mirar()
  setTimeout(mirar, 300)
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

  // LA BURBUJA DE LA SECCIÓN (704d). PINGU probó la hoja al volver a
  // tocar la pestaña («súper poco intuitivo, la gente no lo va a
  // entender») y eligió, con cuatro maquetas delante, la burbuja que ya
  // tenía Mi colección: una píldora flotando encima de la barra, con icono
  // y palabra, que se desliza a un lado cuando hay muchas. Sale solo en
  // las páginas que ESTÁN en la lista de la sección (no en una ficha, un
  // tema o un torneo, que son hojas y donde abajo va otra cosa). Y en Mi
  // colección, que ya tiene la suya, las otras páginas de Cartas se
  // cuelgan al final de esa misma burbuja: dos burbujas no caben.
  const seccion = secciones.find((s) => s.nombre === actual)
  const enLista = seccion?.enlaces.some((e) => claveDePagina(e.href) === clave)
  if (seccion && enLista && seccion.enlaces.length > 1) {
    const item = (e, clase) => { const k = claveDePagina(e.href); return `<a class="${clase}" href="${e.href}"${k === clave ? ' aria-current="page"' : ''} title="${e.texto}">${icons[iconoDePagina(k)]?.(24) || ''}<span class="bm-texto">${rotuloCorto(k, e.texto)}</span></a>` }
    const propia = clave === 'mi-coleccion' ? doc.querySelector('.mc-pestanias') : null
    if (propia) {
      propia.insertAdjacentHTML('beforeend', seccion.enlaces.filter((e) => claveDePagina(e.href) !== clave).map((e) => item(e, 'mc-pestania bm-ajena')).join(''))
      propia.classList.add('bm-con-ajenas')
      vigilarDesborde(propia)
    } else {
      const burbuja = doc.createElement('nav')
      burbuja.className = 'bm-burbuja'
      burbuja.setAttribute('aria-label', `Páginas de ${seccion.nombre}`)
      burbuja.innerHTML = seccion.enlaces.map((e) => item(e, 'bm-burbuja-item')).join('')
      doc.body.appendChild(burbuja)
      doc.documentElement.classList.add('con-burbuja-movil')
      vigilarDesborde(burbuja)
      // La activa, a la vista. NO con `scrollIntoView`: en un elemento
      // fijo también desplaza la PÁGINA, y dejaba la portada en el pie.
      const activa = burbuja.querySelector('[aria-current]')
      if (activa) burbuja.scrollLeft = Math.max(0, activa.offsetLeft - (burbuja.clientWidth - activa.offsetWidth) / 2)
    }
  }
  return { actual, secciones }
}
