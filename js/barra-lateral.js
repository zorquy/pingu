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
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'
import { ICONOS, claveDePagina, seccionesDeLaBarra, seccionActual, destinoDe, iconoDePagina, rotuloCorto } from './barra-movil.js'

export const CONSULTA = '(min-width: 1400px) and (pointer: fine)'

// Los dibujos que la barra necesita y js/icons.js no tiene (la flecha del
// desplegable y la taza). Viven aquí y no en icons.js
// porque icons.js lo baja la portada, que no tiene ni un byte de margen.
const svg = (d, t) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
// «Apoyar PokeDoc» (758; desde la 774, en la lateral, encima de tu cuenta).
export const KOFI = 'https://ko-fi.com/pokedoc'
export const DIBUJOS = {
  flecha: (t = 16) => svg('<path d="m6 9 6 6 6-6"/>', t),
  taza: (t = 20) => svg('<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v2M10 2v2M14 2v2"/>', t),
}

// El HTML de la barra. Puro: lo prueba node con las secciones a mano.
//
// DESPLEGABLE (tanda 633). PINGU: «que el menú nuevo sea desplegable y
// tenga animaciones y transiciones para hacerlo más clean; y que se ajuste
// a todas las pantallas, que en la mía el apartado de Jugar sale con barra
// de desplazamiento». Cada sección con más de una página lleva su cajón y
// una flecha que lo abre y lo cierra; sale abierto el de la sección en la
// que estás, y abrir otro cierra el que hubiera (así cabe). Un cajón
// cerrado es `inert`: lo que no se ve no se tabula.
// LAS PARTES DE MI COLECCIÓN, en el cajón de Cartas (758). Desde que el
// catálogo salió del menú y Lanzamientos se fue a Inicio, Cartas es solo
// «Mi colección», y un cajón de un enlace no se pintaba: PINGU, «la
// categoría Cartas no tiene desplegable y tendría que tener». Fuera de
// /mi-coleccion el cajón lleva sus partes como enlaces; DENTRO lleva su
// propio menú (`#mcMenu`, la 740), que cambia de pestaña sin recargar, y
// desde la 767 sin la fila «Mi colección» encima.
export const PARTES_DE_LA_COLECCION = [
  { ver: 'resumen', texto: 'Panel', icono: () => icons.barChart(18) },
  { ver: 'album', texto: 'Expansiones', icono: () => icons.layers(18) },
  { ver: 'pokedex', texto: 'Pokédex', icono: () => ICONOS_COLECCION.pokedex(18) },
  { ver: 'carpetas', texto: 'Álbumes', icono: () => icons.folder(18) },
  { ver: 'productos', texto: 'Productos', icono: () => icons.package(18) },
  // Deseos y cambios (765), que es lo que dice el menú de Mi colección; desde
  // la 770 abre por el Mercado.
  { ver: 'mercado', texto: 'Deseos y cambios', icono: () => ICONOS_COLECCION.corazon(18) },
  // Y Buscar, que vuelve a ser su pestaña (767).
  { ver: 'buscar', texto: 'Buscar', icono: () => icons.search(18) },
]
const soloLaColeccion = (s) => s.enlaces.length === 1 && claveDePagina(s.enlaces[0].href) === 'mi-coleccion'

// Las páginas que cuelgan de una sección en la lateral: sin la portada (1024,
// PINGU: «la pestaña de inicio la quitaba porque ya hay inicio»), que es la
// propia fila «Inicio». La burbuja del móvil la conserva: ahí la fila de la
// sección no se pulsa.
const paginasDe = (s) => s.enlaces.filter((e) => claveDePagina(e.href) !== 'index')

export function lateralHtml(secciones, actual, clave, { conSesion = false, abierta = actual } = {}) {
  return secciones
    .map((s, i) => {
      const activa = s.nombre === actual
      const partes = soloLaColeccion(s) && clave !== 'mi-coleccion'
      const conCajon = s.enlaces.length > 1 || soloLaColeccion(s)
      const abierto = conCajon && s.nombre === abierta
      const id = `lat-cajon-${i}`
      const cajon = conCajon
        ? `<div class="lat-cajon${abierto ? ' lat-abierto' : ''}" id="${id}"${abierto ? '' : ' inert'}><ul class="lat-paginas">${soloLaColeccion(s) && clave === 'mi-coleccion'
          // Dentro de Mi colección, sin la fila «Mi colección» (767, PINGU:
          // «no hace falta ese submenú»): su menú va directamente aquí.
          ? '<li class="lat-menu-sitio"></li>'
          : partes
          ? PARTES_DE_LA_COLECCION.map((p) => `<li><a href="/mi-coleccion?ver=${p.ver}">${p.icono()}<span>${p.texto}</span></a></li>`).join('')
          : paginasDe(s)
            .map((e) => {
              const k = claveDePagina(e.href)
              return `<li><a href="${e.href}"${k === clave ? ' aria-current="page"' : ''}>${icons[iconoDePagina(k)]?.(18) || ''}<span>${rotuloCorto(k, e.texto)}</span></a></li>`
            })
            .join('')}</ul></div>`
        : ''
      const flecha = conCajon
        ? `<button type="button" class="lat-flecha" aria-expanded="${abierto}" aria-controls="${id}" aria-label="${abierto ? 'Plegar' : 'Desplegar'} ${s.nombre}" title="${abierto ? 'Plegar' : 'Desplegar'}">${DIBUJOS.flecha(16)}</button>`
        : ''
      // La sección lleva `aria-current` solo si ES la página (Inicio en la
      // portada); si no, «estás aquí» lo dice la página de debajo.
      // Las pestañas de una misma página (las de /tienda, 1071) comparten la
      // clave: la que está aquí es la activa.
      const esLaPagina = s.ver ? activa : claveDePagina(destinoDe(s, conSesion)) === clave
      const aquiDebajo = conCajon && paginasDe(s).some((e) => claveDePagina(e.href) === clave)
      return `<li class="lat-seccion${activa ? ' lat-activa' : ''}"><div class="lat-fila"><a class="lat-seccion-enlace" href="${destinoDe(s, conSesion)}" title="${s.nombre}"${s.ver ? ` data-ver="${s.ver}"` : ''}${esLaPagina && !aquiDebajo ? ' aria-current="page"' : ''}>${icons[s.icono || ICONOS[s.nombre]]?.(20) || ''}<span>${s.nombre}</span></a>${flecha}</div>${cajon}</li>`
    })
    .join('')
}

// Abrir el cajón de una sección (y cerrar los demás), o cerrarlo.
export function abrirCajon(barra, boton, abrir = boton.getAttribute('aria-expanded') !== 'true') {
  for (const b of barra.querySelectorAll('.lat-flecha')) {
    const si = b === boton ? abrir : false
    const cajon = barra.querySelector(`#${b.getAttribute('aria-controls')}`)
    const nombre = b.closest('.lat-seccion')?.querySelector('.lat-seccion-enlace span')?.textContent || ''
    b.setAttribute('aria-expanded', String(si))
    b.setAttribute('aria-label', `${si ? 'Plegar' : 'Desplegar'} ${nombre}`)
    b.title = si ? 'Plegar' : 'Desplegar'
    cajon?.classList.toggle('lat-abierto', si)
    if (cajon) cajon.inert = !si
  }
}

// ¿Se sale de la pantalla? Entonces va PRIETA (renglones más bajos, menos
// aire): no a un alto de ventana elegido a ojo, sino midiendo lo que ocupa
// de verdad (la lección de la 320: un punto de corte es una afirmación
// sobre un ancho que nadie ha medido). Se mide sin prieta y, si no cabe, se
// pone.
export function ajustarAlto(barra) {
  barra.classList.remove('lat-prieta')
  if (barra.scrollHeight > barra.clientHeight + 1) barra.classList.add('lat-prieta')
}

// Como la del móvil, las secciones, la activa y los textos de la lupa y de
// tu cuenta se pueden dar desde fuera (1071, la web de una tienda); `apoyar`
// a false quita el Ko-fi.
export function montarBarraLateral({ conSesion = false, doc = document, clave = claveDePagina(location.pathname, location.origin), secciones: dadas = null, actual: dada, buscarTexto = 'Busca cartas, guías, gente…', yoTexto = 'Ver perfil', apoyar = true } = {}) {
  const navbar = doc.getElementById('navbar')
  if (!navbar || doc.querySelector('.lat')) return null
  const secciones = dadas || seccionesDeLaBarra(doc)
  if (!secciones.length) return null
  const hoja = hojaInyectada('css/lateral.css')
  const actual = dada !== undefined ? dada : seccionActual(secciones, clave)
  const logo = navbar.querySelector('.nav-logo')
  const barra = doc.createElement('nav')
  barra.className = 'lat'
  barra.setAttribute('aria-label', 'Secciones')
  // Escondida hasta que llegue su hoja: sin ella es un bloque en el flujo.
  barra.hidden = true
  hoja.then(() => { barra.hidden = false })
  // SIEMPRE ABIERTA (tanda 914). PINGU: «no quiero que se pliegue la barra;
  // la barra siempre ahí y ya está». Plegada (633) había que desplegarla
  // para abrir un submenú, y se plegaba sola al entrar en una expansión
  // (788). Lo que quedara apuntado de antes se olvida.
  try { localStorage.removeItem('pokedoc-lateral-plegada') } catch {}
  barra.innerHTML = `<div class="lat-cabeza">${logo ? `<a class="nav-logo lat-logo" href="/">${logo.innerHTML}</a>` : ''}</div><ul class="lat-lista">${lateralHtml(secciones, actual, clave, { conSesion })}</ul>${apoyar ? `<a class="lat-apoyar" href="${KOFI}" target="_blank" rel="noopener" title="Apoyar PokeDoc: un café en Ko-fi">${DIBUJOS.taza(20)}<span class="lat-apoyar-texto"><b>Apoyar PokeDoc</b><small>Un café en Ko-fi</small></span></a>` : ''}`
  barra.addEventListener('click', (e) => {
    const flecha = e.target.closest('.lat-flecha')
    if (flecha) {
      abrirCajon(barra, flecha)
      // El cajón crece con una transición: se vuelve a medir al acabar.
      setTimeout(() => ajustarAlto(barra), 320)
      return
    }
  })
  // Delante de todo en el orden de tabulación, justo después del «Saltar
  // al contenido»: es la navegación, y la de arriba se esconde.
  const salto = doc.querySelector('.salta-al-contenido')
  if (salto) salto.after(barra)
  else doc.body.prepend(barra)
  doc.documentElement.classList.add('con-lateral')
  // EL MENÚ DE MI COLECCIÓN, DENTRO (740, D2). Panel, Expansiones, Pokédex,
  // Álbumes, Productos y Deseos y cambios son las páginas de «Mi colección»: con la lateral
  // puesta, su columna propia (216 px) era una segunda barra lateral al
  // lado de la primera, y se comía el sitio de la rejilla. Se MUEVE el
  // mismo nodo —con sus escuchas— debajo de su página, y vuelve a su sitio
  // si la ventana se estrecha.
  const menu = doc.getElementById('mcMenu')
  const suyo = barra.querySelector('.lat-menu-sitio') || barra.querySelector('.lat-paginas [aria-current="page"]')?.closest('li')
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
      buscar.insertAdjacentHTML('beforeend', `<span class="nav-busca-texto">${buscarTexto}</span><kbd class="nav-busca-kbd">${mac ? '⌘ K' : 'Ctrl K'}</kbd>`)
    }
    return true
  }
  const montarYo = () => {
    const avatar = doc.getElementById('navUserBtn')
    if (!avatar || barra.querySelector('.lat-yo')) return !!avatar
    const yo = doc.createElement('button')
    yo.type = 'button'
    yo.className = 'lat-yo'
    yo.innerHTML = `<span class="lat-yo-avatar" style="${avatar.getAttribute('style') || ''}" aria-hidden="true">${avatar.childNodes[0]?.nodeType === 3 ? avatar.childNodes[0].textContent : ''}</span><span class="lat-yo-texto"><b></b><small>${yoTexto}</small></span>${icons.settings(18)}`
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
  // Que quepa: se mide al llegar la hoja, al cambiar el alto de la ventana
  // y cuando algo crece dentro (el menú de Mi colección, los álbumes).
  hoja.then(() => ajustarAlto(barra))
  globalThis.addEventListener?.('resize', () => ajustarAlto(barra))
  if (globalThis.MutationObserver) {
    let t = null
    new MutationObserver(() => {
      clearTimeout(t)
      t = setTimeout(() => ajustarAlto(barra), 60)
    }).observe(barra, { childList: true, subtree: true })
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
