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
import { montarArrastreDeHojas } from './hoja-arrastre.js'
import { engancharCompartir } from './compartir.js'
import { escapeHtml } from './html.js'

// Qué icono lleva cada sección (por el nombre del desplegable). «Colección»
// se llamaba «Cartas» hasta la 1036 (PINGU: «dentro no solo hay cartas: hay
// expansiones, la Pokédex, álbumes, productos, deseos y cambios»); el color
// sigue colgando de `data-seccion="cartas"` (SLUG_DE_SECCION del generador).
export const ICONOS = { Inicio: 'home', Aprender: 'bookOpen', 'Colección': 'cards', Comunidad: 'messageSquare', Jugar: 'trophy' }
export const ORDEN = ['Inicio', 'Aprender', 'Colección', 'Comunidad', 'Jugar']

// Una página que no está en ningún desplegable (la ficha de una carta, un
// tema del foro, un torneo…) pertenece a la sección de lo que enseña.
export const SECCION_DE = {
  Aprender: ['aprender', 'retos', 'guardados', 'guia', 'curso', 'categoria', 'carta-del-dia', 'mas-caro', 'quien-es', 'ordena-precio', 'que-expansion', 'parejas', 'nueve', 'glosario'],
  'Colección': ['cartas', 'mi-coleccion', 'carta', 'coleccion', 'ilustrador', 'evento'],
  Comunidad: ['foro', 'usuarios', 'tema', 'usuario', 'mensajes', 'buscar', 'colabora', 'tiendas', 'tienda'],
  Jugar: ['torneos', 'torneo', 'meta', 'mazo-meta', 'constructor', 'laboratorio', 'mazos', 'mis-partidas', 'repeticiones'],
  Inicio: ['index', 'noticias', 'lanzamientos', 'novedades'],
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
  const sueltos = [...doc.querySelectorAll('.nav-links > a')].map((a) => ({ href: a.getAttribute('href'), texto: a.textContent.trim() }))
  return seccionesDe(grupos, sueltos)
}

// Los enlaces SUELTOS de la barra de arriba (758): Noticias y Lanzamientos
// son de Inicio, y «Mi colección», que dejó de ser el desplegable
// «Cartas», es la sección Cartas. Lo usan la web y el generador.
export function seccionesDe(grupos, sueltos) {
  const deCartas = sueltos.filter((e) => claveDePagina(e.href) === 'mi-coleccion')
  const deInicio = sueltos.filter((e) => !deCartas.includes(e))
  const inicio = { nombre: 'Inicio', enlaces: [{ href: '/', texto: 'Inicio' }, ...deInicio] }
  const cartas = deCartas.length && !grupos.some((g) => g.nombre === 'Colección') ? [{ nombre: 'Colección', enlaces: deCartas }] : []
  return [inicio, ...grupos, ...cartas].filter((s) => ORDEN.includes(s.nombre)).sort((a, b) => ORDEN.indexOf(a.nombre) - ORDEN.indexOf(b.nombre))
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
  // Las secciones que llegan de fuera (las de una tienda, 1071) llevan el suyo.
  if (seccion.nombre === 'Colección' && !seccion.fija) return conSesion ? '/mi-coleccion' : '/cartas'
  return seccion.enlaces[0]?.href || '/'
}

// El icono de cada página de una sección (lo que hay en js/icons.js).
export const ICONO_DE_PAGINA = { index: 'home', noticias: 'newspaper', aprender: 'bookOpen', retos: 'zap', guardados: 'bookmark', cartas: 'cards', lanzamientos: 'calendar', novedades: 'sparkles', 'mi-coleccion': 'layers', foro: 'messageSquare', usuarios: 'users', torneos: 'trophy', meta: 'trendingUp', constructor: 'edit', laboratorio: 'lightbulb', mazos: 'package', 'mis-partidas': 'gamepad', repeticiones: 'eye' }
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
  win.addEventListener('keydown', parar, { once: true })
  // Se sigue mirando hasta el tope aunque ya se haya llegado (797): desde
  // que el service worker sirve los módulos de la caché (786), esto corre
  // ANTES de que el navegador restaure la suya —recortada a lo que medía la
  // página— y la del navegador pisaba la buena.
  const intentar = () => {
    if (tocado || Date.now() - empezo > 4000) return
    if (Math.abs(win.scrollY - guardada) >= 40 && doc.documentElement.scrollHeight - win.innerHeight >= guardada) win.scrollTo({ top: guardada, behavior: 'instant' })
    win.setTimeout(intentar, 150)
  }
  win.setTimeout(intentar, 50)
}

// EL VISOR QUE iOS NO DEVUELVE (776). En la app instalada, al cerrar el
// teclado iOS puede dejar el visor movido respecto a la página (o más
// corto), y todo lo fijo de abajo se queda flotando a media pantalla
// —PINGU lo vio en Torneos y en Gente, unos 340 px: lo que mide el
// teclado—. No da error ni se va solo. Se mide el visor de verdad y lo fijo
// se mueve lo que falta (`translate`, que no pisa el `transform` de las
// barras que se apartan). Pura para poder probarla; el porqué, SCHEMA 776.
export function desfaseDelVisor({ alto, visor, maximo = 0, escribiendo = false, instalada = false }) {
  const nada = { arriba: 0, abajo: 0 }
  // Con el teclado fuera lo fijo DEBE quedarse donde está, y con zoom el
  // visor se mueve a propósito.
  if (escribiendo || !visor || Math.abs((visor.scale || 1) - 1) > 0.01) return nada
  const arriba = visor.offsetTop > 1 ? Math.round(visor.offsetTop) : 0
  const fondo = Math.round(visor.offsetTop + visor.height - alto)
  // Encogido: el alto de la página bajó y el visor bajó con él, así que no
  // se nota en el visor; se nota contra el mayor alto visto con ese ancho.
  // Solo instalada: en Safari las barras del navegador cambian el alto de
  // verdad al hacer scroll.
  const encogido = instalada && maximo - alto > 1 && Math.abs(visor.height - alto) < 2 ? maximo - alto : 0
  return { arriba, abajo: Math.max(0, fondo > 1 ? fondo : 0) + encogido }
}

const CLAVE_ALTO = 'bm-alto-max:'
function vigilarVisor(doc, win) {
  const visor = win.visualViewport
  // Solo en iOS (el mismo filtro que la 775): en los demás, el visor lo
  // devuelven bien y moverlo sería un fallo nuevo.
  if (!visor || !win.CSS?.supports?.('-webkit-touch-callout', 'none')) return
  const html = doc.documentElement
  const instalada = win.navigator.standalone === true || win.matchMedia('(display-mode: standalone)').matches
  const escribiendo = () => doc.activeElement?.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=button]), textarea, select, [contenteditable="true"]')
  let pendiente = false
  const medir = () => {
    pendiente = false
    const clave = CLAVE_ALTO + win.innerWidth
    let maximo = 0
    try { maximo = Number(win.sessionStorage.getItem(clave)) || 0 } catch {}
    if (win.innerHeight > maximo && !escribiendo()) {
      maximo = win.innerHeight
      try { win.sessionStorage.setItem(clave, String(maximo)) } catch {}
    }
    const { arriba, abajo } = desfaseDelVisor({ alto: win.innerHeight, visor, maximo, escribiendo: escribiendo(), instalada })
    html.classList.toggle('ios-desfase', arriba > 0 || abajo > 0)
    html.style.setProperty('--ios-arriba', `${arriba}px`)
    html.style.setProperty('--ios-abajo', `${abajo}px`)
  }
  const pedir = () => { if (!pendiente) { pendiente = true; win.requestAnimationFrame(medir) } }
  visor.addEventListener('resize', pedir)
  visor.addEventListener('scroll', pedir)
  win.addEventListener('resize', pedir)
  win.addEventListener('scroll', pedir, { passive: true })
  win.addEventListener('pageshow', pedir)
  // El teclado tarda en irse: se vuelve a mirar cuando ya se ha ido.
  doc.addEventListener('focusout', () => { pedir(); win.setTimeout(pedir, 400) })
  medir()
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

function montarTu(doc, win, buscar = { href: '/buscar.html', texto: 'Busca cartas, guías, gente…' }) {
  const inner = doc.querySelector('.nav-inner')
  const derecha = doc.querySelector('.nav-right')
  if (inner && derecha && !doc.querySelector('.bm-pastilla')) {
    const a = doc.createElement('a')
    a.className = 'bm-pastilla'
    a.href = buscar.href
    a.innerHTML = `${icons.search?.(17) || ''}<span>${escapeHtml(buscar.texto)}</span>`
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
  // Avisos, mensajes y el tema van DENTRO de la hoja desde la 748 (la N8
  // de su maqueta, js/menu-tu.js): aquí solo queda el velo y el número.
  // La hoja se abre y se cierra con la MISMA clase de siempre (`hidden` en
  // el desplegable); aquí solo se pone el velo detrás y las filas dentro.
  const vigilarHoja = () => {
    const d = doc.getElementById('navUserDropdown')
    const abierta = !!d && !d.classList.contains('hidden')
    doc.documentElement.classList.toggle('bm-tu-abierta', abierta)
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
    win.requestAnimationFrame(() => { pendiente = false; pintarPunto(); vigilarHoja() })
  }).observe(derecha || doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] })
  pintarPunto()
}

// LA CABECERA DE UNA PÁGINA DE DETALLE (1019, A2 de «PokeDoc como app»):
// en una guía, un tema, un torneo o un perfil ajeno la barra de arriba no
// es la de la lista (logo + buscador) sino la de una hoja abierta: volver,
// de dónde vienes (la última miga, o la sección) y compartir. El título
// de la página sube a la barra cuando su <h1> sale por arriba, como los
// títulos grandes de iOS. La página lo dice con `data-detalle` en <html>
// (generar-barra-movil.mjs), que es también lo que esconde sus migas.
export function montarCabeceraDetalle({ doc = document, win = window, seccion, conSesion = false } = {}) {
  const inner = doc.querySelector('.nav-inner')
  const derecha = doc.querySelector('.nav-right')
  if (!inner || doc.querySelector('.bm-cab')) return null
  const cab = doc.createElement('div')
  cab.className = 'bm-cab'
  cab.innerHTML = `<button type="button" class="bm-cab-volver" aria-label="Volver">${icons.chevronLeft?.(24) || ''}</button><b class="bm-cab-titulo"><small>${escapeHtml(seccion?.nombre || 'Volver')}</small><span></span></b><button type="button" class="bm-cab-compartir" aria-label="Compartir">${icons.share?.(20) || ''}</button>`
  inner.insertBefore(cab, derecha)
  doc.documentElement.classList.add('con-cabecera-detalle')
  // Las migas y el <h1> los escribe cada página cuando le llega su dato
  // (el tema, la guía, el torneo), DESPUÉS de montarse esta barra: se leen
  // ahora y cada vez que el contenido cambie, hasta tenerlos.
  const laMiga = () => doc.querySelector('.breadcrumb a:last-of-type, .foro-migas a:last-of-type, .carta-migas a:last-of-type')
  const elH1 = () => [...doc.querySelectorAll('h1')].find((h) => h.getBoundingClientRect().height > 0 && h.textContent.trim())
  const titulo = (h1) => { const c = h1.cloneNode(true); c.querySelectorAll('[class*="chapa"], .chip, .sr-only').forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim() }
  let h1Visto = null
  const rellenar = () => {
    const miga = laMiga()
    if (miga?.textContent.trim()) cab.querySelector('.bm-cab-titulo small').textContent = miga.textContent.trim()
    const h1 = elH1()
    if (h1 && h1 !== h1Visto) {
      h1Visto = h1
      cab.querySelector('.bm-cab-titulo span').textContent = titulo(h1)
      // El título entra cuando el <h1> sale por arriba; sin observador, va siempre.
      if ('IntersectionObserver' in win) new win.IntersectionObserver(([e]) => cab.classList.toggle('bm-cab-con-titulo', !e.isIntersecting && e.boundingClientRect.top < 0), { rootMargin: '-70px 0px 0px 0px' }).observe(h1)
      else cab.classList.add('bm-cab-con-titulo')
    }
    return Boolean(miga && h1)
  }
  if (!rellenar() && 'MutationObserver' in win) {
    let pendiente = false
    const ob = new win.MutationObserver(() => {
      if (pendiente) return
      pendiente = true
      win.requestAnimationFrame(() => { pendiente = false; if (rellenar()) ob.disconnect() })
    })
    ob.observe(doc.body, { childList: true, subtree: true, characterData: true })
    win.setTimeout(() => ob.disconnect(), 15000)
  }
  // Volver: atrás si se vino de aquí; si no (un enlace de fuera, una
  // pestaña nueva), a la miga, y si no la hay, a la primera página de la
  // sección. Así nunca saca de PokeDoc.
  cab.querySelector('.bm-cab-volver').addEventListener('click', () => {
    let deCasa = false
    try { deCasa = Boolean(doc.referrer) && new URL(doc.referrer).origin === win.location.origin } catch { deCasa = false }
    if (deCasa && win.history.length > 1) win.history.back()
    else win.location.href = laMiga()?.getAttribute('href') || (seccion ? destinoDe(seccion, conSesion) : '/')
  })
  engancharCompartir(cab.querySelector('.bm-cab-compartir'), { titulo: doc.title, url: win.location.href })
  return cab
}

// Las secciones, la activa, la lupa y si es una página de detalle se pueden
// dar desde fuera (1071): la web de una tienda tiene las suyas, que no están
// en la barra de arriba (js/tienda-marco.js).
export function montarBarraMovil({ conSesion = false, doc = document, clave = claveDePagina(location.pathname, location.origin), secciones: dadas = null, actual: dada, detalle = null, buscar } = {}) {
  // Montada una vez. La CLASE ya no sirve de marca (981): la pone el guion
  // de la cabecera de cada página antes del primer pintado, para que el
  // hueco y la barra del móvil estén desde el principio y no salte todo
  // 64 px cuando llega este módulo.
  if (!doc.getElementById('navbar') || doc.documentElement.dataset.bmMontada) return null
  doc.documentElement.dataset.bmMontada = '1'
  hojaInyectada('css/movil.css')
  const secciones = dadas || seccionesDeLaBarra(doc)
  const actual = dada !== undefined ? dada : seccionActual(secciones, clave)
  doc.documentElement.classList.add('con-barra-movil')

  // DESDE LA 753 LA BARRA VIENE EN EL HTML (generar-barra-movil.mjs), para
  // que esté en el primer pintado y en la transición entre páginas. Aquí se
  // vuelve a escribir con la cuenta (Cartas lleva a Mi colección) solo si
  // cambia algo; una página sin ella (una vieja en caché) la recibe entera.
  const html = secciones.map((s) => `<a href="${destinoDe(s, conSesion)}"${s.clase ? ` class="${s.clase}"` : ''}${s.ver ? ` data-ver="${s.ver}"` : ''}${s.nombre === actual ? ' aria-current="page"' : ''}>${icons[s.icono || ICONOS[s.nombre]]?.(24) || ''}<span>${s.nombre}</span></a>`).join('')
  let barra = doc.querySelector('nav.bm')
  if (!barra) {
    barra = doc.createElement('nav')
    barra.className = 'bm'
    barra.setAttribute('aria-label', 'Secciones')
    doc.body.appendChild(barra)
  }
  if (barra.innerHTML !== html) barra.innerHTML = html

  // TOCAR LA SECCIÓN EN LA QUE YA ESTÁS TE SUBE ARRIBA (709, X1), como
  // en iOS: volver a cargar la misma página no le sirve a nadie.
  // Y DESDE LA 860, TAMBIÉN TE QUITA LO QUE TENGAS PUESTO: con un filtro
  // en la dirección (/aprender?tema=…, el foro buscando) solo subir parecía
  // que no hacía nada, así que se deja ir al enlace, que es la lista limpia.
  // Una página con «dentro» (Mi colección) se queda el toque con el evento
  // y sube un nivel o quita sus filtros ella.
  barra.addEventListener('click', (ev) => {
    const a = ev.target.closest('a')
    // Una pestaña de la misma página (las de /tienda, 1071) la cambia la página.
    if (!a || a.dataset.ver) return
    // EL ICONO SE MARCA YA (892): al tocar otra sección, la pestaña nueva
    // se pinta activa en el mismo instante, antes de que llegue la página.
    // Si el clic no acaba navegando, la página sigue aquí y no pasa nada.
    if (claveDePagina(a.getAttribute('href'), location.origin) !== clave) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button > 0) return
      barra.querySelectorAll('a[aria-current]').forEach((x) => x.removeAttribute('aria-current'))
      a.setAttribute('aria-current', 'page')
      return
    }
    const propio = new CustomEvent('pokedoc:seccion-otra-vez', { cancelable: true })
    doc.dispatchEvent(propio)
    if (!propio.defaultPrevented && (location.search || location.hash)) return
    ev.preventDefault()
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  })
  vigilarBajada(doc, window)
  recordarPosicion(doc, window)
  vigilarVisor(doc, window)
  montarTu(doc, window, buscar)
  // Las hojas de abajo se cierran arrastrándolas (804).
  montarArrastreDeHojas({ doc, win: window })
  // Instalar en la pantalla de inicio (A1) y, ya instalada —sin barra del
  // navegador—, tirar hacia abajo para refrescar (X4). Tanda 732.

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
  // La cabecera de detalle (1019): lo decide `data-detalle`, que puso el
  // generador; sin él (una página vieja en caché), lo mismo que decide él.
  const esDetalle = detalle ?? (doc.documentElement.hasAttribute('data-detalle') || Boolean(seccion && !enLista && clave !== 'index'))
  if (esDetalle) montarCabeceraDetalle({ doc, win: window, seccion, conSesion })
  // Instalar en la pantalla de inicio (A1) y, ya instalada —sin barra del
  // navegador—, tirar hacia abajo para refrescar (X4). Tanda 732; desde la
  // 753 se ofrece en la portada y en las páginas de la lista de cada sección.
  import('./instalar.js')
    .then((m) => (m.estaInstalada(window) ? import('./tirar-refrescar.js').then((t) => t.montarTirarRefrescar()) : m.montarInstalar({ aqui: clave === 'index' || Boolean(enLista) })))
    .catch(() => {})
  // Y los avisos en el móvil (994): con cuenta y en las mismas páginas.
  if (conSesion && (clave === 'index' || enLista)) import('./invitar-push.js').then((m) => m.montarInvitarPush()).catch(() => {})
  const propia = clave === 'mi-coleccion' ? doc.querySelector('.mc-pestanias') : null
  if (seccion && enLista && (propia || seccion.enlaces.length > 1)) {
    const item = (e, clase) => { const k = claveDePagina(e.href); return `<a class="${clase}" href="${e.href}"${k === clave ? ' aria-current="page"' : ''} title="${e.texto}">${icons[iconoDePagina(k)]?.(24) || ''}<span class="bm-texto">${rotuloCorto(k, e.texto)}</span></a>` }
    // SIN ESCANEAR (758): PINGU, «ocúltalo, que no funciona muy bien». Se
    // va de la burbuja, de la paleta y del atajo del icono; el código del
    // escáner se queda en Mi colección, sin ninguna puerta que lleve a él.
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
