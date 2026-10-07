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
  const hoja = hojaInyectada('css/lateral.css')
  const actual = seccionActual(secciones, clave)
  const logo = navbar.querySelector('.nav-logo')
  const barra = doc.createElement('nav')
  barra.className = 'lat'
  barra.setAttribute('aria-label', 'Secciones')
  // Escondida hasta que llegue su hoja: sin ella es un bloque en el flujo.
  barra.hidden = true
  hoja.then(() => { barra.hidden = false })
  barra.innerHTML = `${logo ? `<a class="nav-logo lat-logo" href="/index.html">${logo.innerHTML}</a>` : ''}<ul class="lat-lista">${lateralHtml(secciones, actual, clave, { conSesion })}</ul>`
  // Delante de todo en el orden de tabulación, justo después del «Saltar
  // al contenido»: es la navegación, y la de arriba se esconde.
  const salto = doc.querySelector('.salta-al-contenido')
  if (salto) salto.after(barra)
  else doc.body.prepend(barra)
  doc.documentElement.classList.add('con-lateral')
  // EL MENÚ DE MI COLECCIÓN, DENTRO (740, D2). Panel, Expansiones, Pokédex,
  // Álbumes y Buscar son las páginas de «Mi colección»: con la lateral
  // puesta, su columna propia (216 px) era una segunda barra lateral al
  // lado de la primera, y se comía el sitio de la rejilla. Se MUEVE el
  // mismo nodo —con sus escuchas— debajo de su página, y vuelve a su sitio
  // si la ventana se estrecha.
  const menu = doc.getElementById('mcMenu')
  const suyo = barra.querySelector('.lat-paginas [aria-current="page"]')?.closest('li')
  const origen = menu ? { padre: menu.parentNode, siguiente: menu.nextSibling } : null
  const meterMenu = (dentro) => {
    if (!menu || !suyo) return
    if (dentro) suyo.appendChild(menu)
    else origen.padre.insertBefore(menu, origen.siguiente)
    doc.documentElement.classList.toggle('mc-menu-al-lado', dentro)
  }
  meterMenu(true)
  // LA BARRA DE ARRIBA DE SU MAQUETA (748, D1): el buscador es una pastilla
  // ancha que se lee —con su «Ctrl K»— y tu cuenta baja a la lateral, abajo,
  // como «Nombre · Ver perfil». El botón y el avatar de arriba siguen
  // siendo los que mandan: la pastilla ES el botón de buscar, y la tarjeta
  // de abajo pulsa el avatar (que abre la hoja «Tú»).
  const pintarBuscador = () => {
    const buscar = doc.getElementById('navSearchBtn')
    if (!buscar) return false
    if (!buscar.querySelector('.nav-busca-texto')) {
      const mac = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform || '')
      buscar.insertAdjacentHTML('beforeend', `<span class="nav-busca-texto">Busca cartas, guías, gente…</span><kbd class="nav-busca-kbd">${mac ? '⌘ K' : 'Ctrl K'}</kbd>`)
    }
    return true
  }
  const montarYo = () => {
    const avatar = doc.getElementById('navUserBtn')
    if (!avatar || barra.querySelector('.lat-yo')) return !!avatar
    const yo = doc.createElement('button')
    yo.type = 'button'
    yo.className = 'lat-yo'
    yo.innerHTML = `<span class="lat-yo-avatar" style="${avatar.getAttribute('style') || ''}" aria-hidden="true">${avatar.childNodes[0]?.nodeType === 3 ? avatar.childNodes[0].textContent : ''}</span><span class="lat-yo-texto"><b></b><small>Ver perfil</small></span>${icons.settings(18)}`
    yo.querySelector('b').textContent = avatar.getAttribute('title') || 'Tu cuenta'
    yo.setAttribute('aria-label', `Tu cuenta: ${avatar.getAttribute('title') || ''}`)
    // El clic no sube al documento: si subiera, el «cerrar al pulsar fuera»
    // del menú lo cerraría en el mismo toque que lo abre.
    yo.addEventListener('click', (e) => { e.stopPropagation(); avatar.click() })
    barra.appendChild(yo)
    doc.documentElement.classList.add('lat-con-yo')
    return true
  }
  // La barra de arriba se pinta por partes (el avatar llega después): se
  // mira hasta que estén las dos piezas. Sin sesión no hay avatar que
  // esperar, y el vigía se quedaría mirando para siempre.
  const listo = () => { const b = pintarBuscador(); const y = conSesion ? montarYo() : true; return b && y }
  if (!listo() && globalThis.MutationObserver) {
    const ob = new MutationObserver(() => { if (listo()) ob.disconnect() })
    ob.observe(navbar, { childList: true, subtree: true })
  }
  // Quien tenga algo que colgar de la lateral (los álbumes de Mi colección,
  // 741) se entera aquí: la lateral llega por `import()` y puede ser después.
  doc.dispatchEvent(new CustomEvent('pokedoc:lateral'))
  // Si la ventana se estrecha, la hoja la esconde (y la barra de arriba
  // vuelve a ser la de siempre); se quita la clase para que lo de arriba
  // reaparezca aunque la hoja no lo sepa.
  const mq = globalThis.matchMedia?.(CONSULTA)
  mq?.addEventListener?.('change', () => {
    doc.documentElement.classList.toggle('con-lateral', mq.matches)
    meterMenu(mq.matches)
  })
  return { actual, secciones }
}
