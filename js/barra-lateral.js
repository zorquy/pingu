// LA BARRA LATERAL DEL ORDENADOR (739, D1 de la lista de propuestas).
//
// Arriba, cinco desplegables: para llegar a una página había que abrir el
// suyo cada vez. En una pantalla ancha sobra sitio a la izquierda, así que
// las cinco secciones van en una barra fija y, debajo de la activa, sus
// páginas a la vista. Arriba quedan el buscador, los avisos y tu avatar.
//
// La lista es la MISMA que la de la barra del móvil (704): se lee de los
// desplegables de la barra de arriba con `seccionesDeLaBarra`, así que no
// hay una segunda lista que mantener. Y como la del móvil, entra por
// `import()` solo en pantallas anchas y trae su hoja: la portada no paga
// nada por ella (lo único que cuesta es la línea de app.js que la llama).
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'
import { ICONOS, claveDePagina, seccionesDeLaBarra, seccionActual, destinoDe, iconoDePagina, rotuloCorto } from './barra-movil.js'

export const CONSULTA = '(min-width: 1400px) and (pointer: fine)'

// El HTML de la barra. Puro: lo prueba node con las secciones a mano.
export function lateralHtml(secciones, actual, clave, { conSesion = false } = {}) {
  return secciones
    .map((s) => {
      const activa = s.nombre === actual
      const paginas = activa && s.enlaces.length > 1
        ? `<ul class="lat-paginas">${s.enlaces
            .map((e) => {
              const k = claveDePagina(e.href)
              return `<li><a href="${e.href}"${k === clave ? ' aria-current="page"' : ''}>${icons[iconoDePagina(k)]?.(18) || ''}<span>${rotuloCorto(k, e.texto)}</span></a></li>`
            })
            .join('')}</ul>`
        : ''
      // La sección lleva `aria-current` solo si ES la página (Inicio en la
      // portada); si no, «estás aquí» lo dice la página de debajo.
      const esLaPagina = claveDePagina(destinoDe(s, conSesion)) === clave
      return `<li class="lat-seccion${activa ? ' lat-activa' : ''}"><a class="lat-seccion-enlace" href="${destinoDe(s, conSesion)}"${esLaPagina && !paginas ? ' aria-current="page"' : ''}>${icons[ICONOS[s.nombre]]?.(20) || ''}<span>${s.nombre}</span></a>${paginas}</li>`
    })
    .join('')
}

export function montarBarraLateral({ conSesion = false, doc = document, clave = claveDePagina(location.pathname, location.origin) } = {}) {
  const navbar = doc.getElementById('navbar')
  if (!navbar || doc.querySelector('.lat')) return null
  const secciones = seccionesDeLaBarra(doc)
  if (!secciones.length) return null
  hojaInyectada('css/lateral.css')
  const actual = seccionActual(secciones, clave)
  const logo = navbar.querySelector('.nav-logo')
  const barra = doc.createElement('nav')
  barra.className = 'lat'
  barra.setAttribute('aria-label', 'Secciones')
  barra.innerHTML = `${logo ? `<a class="nav-logo lat-logo" href="/index.html">${logo.innerHTML}</a>` : ''}<ul class="lat-lista">${lateralHtml(secciones, actual, clave, { conSesion })}</ul>`
  // Delante de todo en el orden de tabulación, justo después del «Saltar
  // al contenido»: es la navegación, y la de arriba se esconde.
  const salto = doc.querySelector('.salta-al-contenido')
  if (salto) salto.after(barra)
  else doc.body.prepend(barra)
  doc.documentElement.classList.add('con-lateral')
  // Si la ventana se estrecha, la hoja la esconde (y la barra de arriba
  // vuelve a ser la de siempre); se quita la clase para que lo de arriba
  // reaparezca aunque la hoja no lo sepa.
  const mq = globalThis.matchMedia?.(CONSULTA)
  mq?.addEventListener?.('change', () => doc.documentElement.classList.toggle('con-lateral', mq.matches))
  return { actual, secciones }
}
