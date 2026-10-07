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
import { hojaInyectada } from './hoja.js'

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

// BAJAR ESCONDE, SUBIR ENSEÑA (709, N3). PINGU eligió la propuesta de las
// barras que se apartan: con la de arriba, la de abajo y la burbuja fijas,
// una expansión se quedaba con dos tercios de pantalla. Al bajar se
// esconden las dos barras y queda la burbuja; un poco hacia arriba y
// vuelven, como en Safari o Dex. La decisión es pura para poder probarla:
// cerca del principio nunca se esconde, y hace falta un recorrido mínimo
// en el mismo sentido para cambiar, o un temblor del dedo las haría bailar.
export const ESCONDER = { desde: 120, recorrido: 12 }
export function decidirBarras(estado, y) {
  const { escondidas = false, ancla = y } = estado
  if (y <= ESCONDER.desde) return { escondidas: false, ancla: y }
  if (!escondidas && y - ancla > ESCONDER.recorrido) return { escondidas: true, ancla: y }
  if (escondidas && ancla - y > ESCONDER.recorrido) return { escondidas: false, ancla: y }
  // Seguir en el mismo sentido mueve el ancla; así «subir un poco» se mide
  // desde el punto más bajo y no desde donde se escondieron.
  if (escondidas ? y > ancla : y < ancla) return { escondidas, ancla: y }
  return { escondidas, ancla }
}

function vigilarBajada(doc, win) {
  const html = doc.documentElement
  let estado = { escondidas: false, ancla: win.scrollY }
  let pendiente = false
  const quieto = () => doc.querySelector('dialog[open]') || doc.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')
  win.addEventListener('scroll', () => {
    if (pendiente) return
    pendiente = true
    win.requestAnimationFrame(() => {
      pendiente = false
      // Con un diálogo abierto o el teclado fuera, la barra no se mueve.
      if (quieto()) return
      estado = decidirBarras(estado, win.scrollY)
      html.classList.toggle('bm-escondidas', estado.escondidas)
    })
  }, { passive: true })
}

// VOLVER DEJA DONDE ESTABAS (709, X2). El navegador recupera la posición
// al volver atrás, pero solo si la página ya mide lo bastante en ese
// momento — y aquí casi todo se pinta después, con lo que llega de la
// base: de vuelta de una carta, la rejilla volvía al principio. Al salir se
// apunta la posición por dirección; al volver, se espera a que la página
// crezca lo justo (con un tope, para no saltar cuando ya estás leyendo).
const CLAVE_POSICION = 'bm-posicion:'
function recordarPosicion(doc, win) {
  const clave = CLAVE_POSICION + win.location.pathname + win.location.search
  win.addEventListener('pagehide', () => {
    try { win.sessionStorage.setItem(clave, String(Math.round(win.scrollY))) } catch {}
  })
  let guardada = 0
  try { guardada = Number(win.sessionStorage.getItem(clave)) || 0 } catch {}
  const volviendo = win.performance?.getEntriesByType?.('navigation')?.[0]?.type === 'back_forward'
  if (!volviendo || guardada < 200) return
  const empezo = Date.now()
  let tocado = false
  const parar = () => { tocado = true }
  win.addEventListener('touchstart', parar, { once: true, passive: true })
  win.addEventListener('wheel', parar, { once: true, passive: true })
  const intentar = () => {
    if (tocado || Date.now() - empezo > 4000) return
    if (Math.abs(win.scrollY - guardada) < 40) return
    if (doc.documentElement.scrollHeight - win.innerHeight >= guardada) { win.scrollTo({ top: guardada, behavior: 'instant' }); return }
    win.setTimeout(intentar, 150)
  }
  win.setTimeout(intentar, 50)
}

// LA BARRA DE ARRIBA, LIMPIA, Y LA HOJA «TÚ» (717: N1 y N8 de la lista de
// propuestas, elegidas por PINGU). En el móvil la barra de arriba eran el
// logo y cinco iconos sin rótulo —buscar, tema, mensajes, avisos, avatar—
// que llenaban la fila sin decir qué eran. Queda: el logo, una pastilla que
// SE LEE como un buscador y tu avatar con el número de lo que tienes sin
// leer. Lo demás se va a la hoja que sale al tocar el avatar, que es el
// mismo desplegable de siempre (sus enlaces y su «Cerrar sesión» no se
// copian: se reutilizan) puesto desde abajo, con tres filas más: avisos y
// mensajes con su número, y el tema. Todo aquí y en movil.css, que el
// escritorio no descarga: la portada no paga ni un byte.
export function sumaDeAvisos(textos) {
  let n = 0
  for (const t of textos) {
    const s = String(t || '').trim()
    // Una chapa que ya dice «9+» no se puede sumar: el total también lo es.
    if (s.endsWith('+')) return '9+'
    n += Number(s) || 0
  }
  return n > 9 ? '9+' : n ? String(n) : ''
}

function montarTu(doc, win) {
  const inner = doc.querySelector('.nav-inner')
  const derecha = doc.querySelector('.nav-right')
  if (inner && derecha && !doc.querySelector('.bm-pastilla')) {
    const a = doc.createElement('a')
    a.className = 'bm-pastilla'
    a.href = '/buscar.html'
    a.innerHTML = `${icons.search?.(17) || ''}<span>Busca cartas, guías, gente…</span>`
    inner.insertBefore(a, derecha)
  }
  // El número del avatar: lo que digan las chapas de mensajes y avisos,
  // que siguen vivas aunque sus botones no se vean.
  const chapas = () => [...doc.querySelectorAll('#navMsgBadge, #navBellBadge')].filter((b) => !b.classList.contains('hidden')).map((b) => b.textContent)
  const pintarPunto = () => {
    const btn = doc.getElementById('navUserBtn')
    if (!btn) return
    const n = sumaDeAvisos(chapas())
    let punto = btn.querySelector('.bm-punto')
    if (!n) { punto?.remove(); return }
    if (!punto) { punto = doc.createElement('span'); punto.className = 'bm-punto'; punto.setAttribute('aria-hidden', 'true'); btn.appendChild(punto) }
    if (punto.textContent !== n) punto.textContent = n
    btn.setAttribute('aria-label', `Tu cuenta (${n} sin leer)`)
  }
  const filasDeTu = () => {
    const d = doc.getElementById('navUserDropdown')
    const enlaces = d?.querySelector('.nav-user-links')
    if (!enlaces) return
    let extra = d.querySelector('.bm-tu-extra')
    if (!extra) {
      extra = doc.createElement('div')
      extra.className = 'bm-tu-extra'
      enlaces.insertAdjacentElement('beforebegin', extra)
      extra.addEventListener('click', (e) => {
        const b = e.target.closest('[data-tu]')
        if (!b) return
        // El repintado, DESPUÉS de este clic: si la fila que se acaba de
        // tocar sale del árbol antes de que el clic llegue al documento, el
        // menú lo cuenta como «pulsado fuera» y se cierra.
        if (b.dataset.tu === 'tema') { pulsarSinCerrar(doc.getElementById('navThemeToggle')); win.setTimeout(pintarFilas, 0); return }
        if (b.dataset.tu === 'avisos') {
          // El desplegable de la campana, DENTRO de la hoja: se mueve el
          // nodo (con sus oyentes) y se abre después de este toque, o el
          // «cerrar al pulsar fuera» de la campana lo volvería a cerrar.
          const lista = doc.getElementById('navBellDropdown')
          if (lista && lista.parentElement !== extra) extra.appendChild(lista)
          win.setTimeout(() => pulsarSinCerrar(doc.getElementById('navBellBtn')), 0)
        }
      })
    }
    pintarFilas()
  }
  // Pulsar un botón escondido de la barra SIN que la hoja se cierre: su
  // clic sube hasta el documento, y el menú del usuario cierra con
  // cualquier clic fuera de él. Un oyente de una vez, puesto DESPUÉS del
  // suyo, deja que el botón haga lo suyo y corta la subida.
  const pulsarSinCerrar = (boton) => {
    if (!boton) return
    boton.addEventListener('click', (e) => e.stopPropagation(), { once: true })
    boton.click()
  }
  const pintarFilas = () => {
    const extra = doc.querySelector('#navUserDropdown .bm-tu-extra')
    if (!extra) return
    const msg = doc.getElementById('navMsgBadge'), bell = doc.getElementById('navBellBadge')
    const cuenta = (b) => (b && !b.classList.contains('hidden') && b.textContent !== '0' ? `<span class="bm-tu-cuenta">${b.textContent}</span>` : '')
    const oscuro = doc.documentElement.dataset.theme === 'dark'
    const filas = []
    if (bell) filas.push(`<button type="button" data-tu="avisos">${icons.bell?.(18) || ''}<span>Avisos</span>${cuenta(bell)}</button>`)
    if (msg) filas.push(`<a href="/mensajes.html" data-tu="mensajes">${icons.mail?.(18) || ''}<span>Mensajes</span>${cuenta(msg)}</a>`)
    filas.push(`<button type="button" data-tu="tema">${(oscuro ? icons.sun : icons.moon)?.(18) || ''}<span>${oscuro ? 'Tema claro' : 'Tema oscuro'}</span></button>`)
    const html = filas.join('')
    // Sin tocar lo que ya está bien: la lista de avisos movida vive aquí
    // dentro y repintar a lo bruto se la llevaría por delante.
    let caja = extra.querySelector('.bm-tu-filas')
    if (!caja) { caja = doc.createElement('div'); caja.className = 'bm-tu-filas'; extra.prepend(caja) }
    if (caja.dataset.html !== html) { caja.dataset.html = html; caja.innerHTML = html }
  }
  // La hoja se abre y se cierra con la MISMA clase de siempre (`hidden` en
  // el desplegable); aquí solo se pone el velo detrás y las filas dentro.
  const vigilarHoja = () => {
    const d = doc.getElementById('navUserDropdown')
    const abierta = !!d && !d.classList.contains('hidden')
    doc.documentElement.classList.toggle('bm-tu-abierta', abierta)
    if (abierta) filasDeTu()
  }
  if (!doc.querySelector('.bm-velo')) {
    const velo = doc.createElement('div')
    velo.className = 'bm-velo'
    velo.setAttribute('aria-hidden', 'true')
    doc.body.appendChild(velo)
  }
  let pendiente = false
  new win.MutationObserver(() => {
    if (pendiente) return
    pendiente = true
    win.requestAnimationFrame(() => { pendiente = false; pintarPunto(); vigilarHoja(); pintarFilas() })
  }).observe(derecha || doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })
  pintarPunto()
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

  // TOCAR LA SECCIÓN EN LA QUE YA ESTÁS TE SUBE ARRIBA (709, X1), como
  // en iOS: volver a cargar la misma página no le sirve a nadie.
  barra.addEventListener('click', (ev) => {
    const a = ev.target.closest('a')
    if (!a || claveDePagina(a.getAttribute('href'), location.origin) !== clave) return
    ev.preventDefault()
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  })
  vigilarBajada(doc, window)
  recordarPosicion(doc, window)
  montarTu(doc, window)

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
    // ESCANEAR TIENE BOTÓN PROPIO en la burbuja de Cartas (719, N4), y
    // solo con cuenta: lo leído se añade a TU colección. En Mi colección
    // abre la cámara ahí mismo; desde otra página, va y la abre.
    const escanear = (clase) => (seccion.nombre === 'Cartas' && conSesion
      ? `<a class="${clase} bm-escanear" href="/mi-coleccion?ver=buscar&amp;escanear=1" title="Escanear una carta">${icons.scan?.(24) || ''}<span class="bm-texto">Escanear</span></a>`
      : '')
    if (propia) {
      propia.insertAdjacentHTML('beforeend', escanear('mc-pestania bm-ajena') + seccion.enlaces.filter((e) => claveDePagina(e.href) !== clave).map((e) => item(e, 'mc-pestania bm-ajena')).join(''))
      propia.querySelector('.bm-escanear')?.addEventListener('click', (ev) => {
        const boton = doc.getElementById('mcEscanear')
        if (!boton) return
        ev.preventDefault()
        boton.click()
      })
      propia.classList.add('bm-con-ajenas')
      vigilarDesborde(propia)
    } else {
      const burbuja = doc.createElement('nav')
      burbuja.className = 'bm-burbuja'
      burbuja.setAttribute('aria-label', `Páginas de ${seccion.nombre}`)
      burbuja.innerHTML = seccion.enlaces.map((e) => item(e, 'bm-burbuja-item')).join('') + escanear('bm-burbuja-item')
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
