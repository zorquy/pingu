// La bienvenida de cada sección (tanda 1239, PINGU: «que te explique todas las
// subcategorías dentro de una categoría de la web… que solo salga la primera
// vez que entras en eso»). Una ventana con las páginas de la sección (icono,
// nombre y una frase), la de ahora con «Estás aquí» y cada fila a su página.
// Sale a TODO el mundo, con cuenta o sin ella y también a los de siempre
// (PINGU: «al ser algo nuevo está bien que se muestre a todo el mundo»), UNA vez
// por sección: `pd-bienvenida-<sección>` en el navegador. Se vuelve a abrir desde
// el menú del avatar («Qué hay en esta sección»). La carga app.js por `import()`
// solo si toca, así que la portada no pesa más. Ver SCHEMA 1239.
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { icons } from './icons.js'
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'

export const LLAVE = (seccion) => `pd-bienvenida-${seccion}`

// `clave` es la de `claveDePagina` (el primer tramo sin .html); en Colección,
// la pestaña de /mi-coleccion. `soloCuenta`: no está en /cartas sin cuenta.
export const BIENVENIDAS = {
  inicio: {
    nombre: 'Inicio', icono: 'home', titulo: 'Lo de hoy, de un vistazo',
    lema: 'Lo nuevo de la web y del Pokémon TCG, en cuatro páginas.',
    paginas: [
      { nombre: 'Inicio', icono: 'home', href: '/', clave: 'index', texto: 'Tus retos de hoy, lo último del foro y las noticias, en una pantalla.' },
      { nombre: 'Noticias', icono: 'newspaper', href: '/noticias', clave: 'noticias', texto: 'Lo que pasa en Pokémon TCG, contado en español.' },
      { nombre: 'Lanzamientos', icono: 'calendar', href: '/lanzamientos', clave: 'lanzamientos', texto: 'Las expansiones que vienen con su cuenta atrás, y lo que llevas de cada una.' },
      { nombre: 'Novedades', icono: 'sparkles', href: '/novedades', clave: 'novedades', texto: 'Lo que cambia en PokeDoc, mes a mes.' },
    ],
  },
  aprender: {
    nombre: 'Aprender', icono: 'bookOpen', titulo: 'Aprende a jugar y a coleccionar',
    lema: 'Guías, retos para cada día y las palabras del juego.',
    paginas: [
      { nombre: 'Guías y cursos', icono: 'graduationCap', href: '/aprender', clave: 'aprender', texto: 'Guías para empezar y para mejorar. Un curso es la guía preguntándote, con medalla al final.' },
      { nombre: 'Retos diarios', icono: 'flame', href: '/retos', clave: 'retos', texto: 'Seis retos nuevos cada día: suma experiencia, cuida la racha y sube en la liga de la semana.' },
      { nombre: 'Guardados', icono: 'bookmark', href: '/guardados', clave: 'guardados', texto: 'Las guías y noticias que guardas para leer luego.' },
      { nombre: 'Glosario', icono: 'lightbulb', href: '/glosario', clave: 'glosario', texto: 'SIR, reverse, mulligan, banca… cada palabra con su ejemplo.' },
    ],
  },
  cartas: {
    nombre: 'Colección', icono: 'cards', titulo: 'Tu colección, entera',
    lema: 'Apunta tus cartas y sabrás lo que vale, lo que te falta y con quién cambiar.',
    lemaSinCuenta: 'Todas las cartas de Pokémon TCG con su precio. Con una cuenta, además apuntas las tuyas: Panel, Pokédex, Álbumes y Deseos y cambios.',
    paginas: [
      { nombre: 'Panel', icono: 'barChart', pestania: 'resumen', soloCuenta: true, texto: 'Lo que vale tu colección hoy, cómo ha ido, las que más se mueven y lo último que has añadido.' },
      { nombre: 'Expansiones', icono: 'layers', pestania: 'album', texto: 'Todas, por eras y de la más nueva a la más vieja. Entra en una para marcar las que tienes y filtrar las que te faltan.' },
      { nombre: 'Pokédex', icono: 'pokedex', pestania: 'pokedex', soloCuenta: true, texto: 'Tus cartas ordenadas por Pokémon: cuántas tienes de cada uno y quién te falta.' },
      { nombre: 'Álbumes', icono: 'folder', pestania: 'carpetas', soloCuenta: true, texto: 'Álbumes como los de verdad: elige la tapa, coloca las cartas a tu gusto y compártelos.' },
      { nombre: 'Productos', icono: 'package', pestania: 'productos', texto: 'Sobres, cajas y latas: lo que llevan dentro y lo que valen.' },
      { nombre: 'Deseos y cambios', icono: 'corazon', pestania: 'mercado', soloCuenta: true, texto: 'Apunta las que quieres y las que das. Cruces te dice con quién encajas para proponerle un trato.' },
      { nombre: 'Buscar', icono: 'search', pestania: 'buscar', texto: 'Cualquier carta por su nombre, para añadirla con su idioma y su versión.' },
    ],
  },
  comunidad: {
    nombre: 'Comunidad', icono: 'messageSquare', titulo: 'La gente de PokeDoc',
    lema: 'Habla, queda y conoce a otros entrenadores. Tus mensajes privados están en el sobre de arriba.',
    paginas: [
      { nombre: 'Foro', icono: 'messageSquare', href: '/foro', clave: 'foro', texto: 'Pregunta, comparte y habla de lo que quieras. Sigue un tema y te avisamos de lo nuevo.' },
      { nombre: 'Eventos', icono: 'calendar', href: '/eventos', clave: 'eventos', texto: 'Card shows, trade days y quedadas en España: di «Voy» y apúntalo en tu calendario.' },
      { nombre: 'Gente', icono: 'users', href: '/usuarios', clave: 'usuarios', texto: 'Otros coleccionistas y jugadores: mira su vitrina y escríbeles.' },
    ],
  },
  jugar: {
    nombre: 'Jugar', icono: 'trophy', titulo: 'Juega mejor',
    lema: 'Torneos, mazos y todo lo que necesitas para practicar.',
    paginas: [
      { nombre: 'Torneos', icono: 'trophy', href: '/torneos', clave: 'torneos', texto: 'Apúntate a torneos de PokeDoc: emparejamientos, resultados y clasificación en vivo.' },
      { nombre: 'Mazos del meta', icono: 'trendingUp', href: '/meta', clave: 'meta', texto: 'Los mazos que más se juegan y ganan, con sus listas para copiar a TCG Live.' },
      { nombre: 'Constructor de mazos', icono: 'edit', href: '/constructor', clave: 'constructor', texto: 'Monta tu mazo carta a carta y comprueba que es legal en Estándar.' },
      { nombre: 'Laboratorio', icono: 'target', href: '/laboratorio', clave: 'laboratorio', texto: 'Prueba tu mazo contra un muñeco o contra ti, con las probabilidades de robo en vivo.' },
      { nombre: 'Mis mazos', icono: 'cards', href: '/mazos', clave: 'mazos', texto: 'Tus listas guardadas, para editarlas o llevarlas a un torneo.' },
      { nombre: 'Mis partidas', icono: 'checkSquare', href: '/mis-partidas', clave: 'mis-partidas', texto: 'Apunta tus partidas y mira contra qué mazos ganas y pierdes.' },
      { nombre: 'Repeticiones', icono: 'eye', href: '/repeticiones', clave: 'repeticiones', texto: 'Pega el registro de TCG Live y mira la partida jugada a jugada.' },
    ],
  },
}

// La clave de una ruta, como `claveDePagina` de barra-movil.js (que no se
// importa: arrastraría la barra entera).
export function claveDeRuta(ruta = '/') {
  const limpia = String(ruta).replace(/\.html$/, '').replace(/\/+$/, '').replace(/^\/+/, '')
  return (limpia.split('/')[0] || 'index').toLowerCase()
}

// Las páginas que se enseñan y cuál es la de ahora. En Colección, /cartas
// (el catálogo, sin cuenta) lleva solo las suyas y enlaza a /cartas.
export function paginasDe(seccion, { ruta = '/', pestania = null, catalogo = false } = {}) {
  const s = BIENVENIDAS[seccion]
  if (!s) return []
  const clave = claveDeRuta(ruta)
  return s.paginas
    .filter((p) => !(catalogo && p.soloCuenta))
    .map((p) => {
      const href = p.pestania ? `/${catalogo ? 'cartas' : 'mi-coleccion'}?ver=${p.pestania}` : p.href
      const aqui = p.pestania ? p.pestania === pestania : p.clave === clave
      return { ...p, href, aqui }
    })
}

const icono = (n, t) => (ICONOS_COLECCION[n] || icons[n] || icons.compass)(t)

export function bienvenidaHtml(seccion, opts = {}) {
  const s = BIENVENIDAS[seccion]
  if (!s) return ''
  const lema = opts.catalogo && s.lemaSinCuenta ? s.lemaSinCuenta : s.lema
  const filas = paginasDe(seccion, opts).map((p) => `<li><a class="bvs-fila${p.aqui ? ' aqui' : ''}" href="${escapeHtml(p.href)}"${p.pestania ? ` data-bvs-pestania="${escapeHtml(p.pestania)}"` : ''}${p.aqui ? ' aria-current="page"' : ''}>
      <span class="bvs-fila-ico" aria-hidden="true">${icono(p.icono, 16)}</span>
      <span class="bvs-fila-texto"><b>${escapeHtml(p.nombre)}${p.aqui ? ' <span class="bvs-aqui">Estás aquí</span>' : ''}</b><span>${escapeHtml(p.texto)}</span></span>
      <span class="bvs-flecha" aria-hidden="true">${icons.chevronRight(14)}</span>
    </a></li>`).join('')
  return `<div class="bvs-banda">
      <button type="button" class="bvs-cerrar" data-bvs-cerrar aria-label="Cerrar">${icons.x(16)}</button>
      <span class="bvs-ico" aria-hidden="true">${icono(s.icono, 22)}</span>
      <small>Bienvenid@ a ${escapeHtml(s.nombre)}</small>
      <h2 id="bvsTitulo">${escapeHtml(s.titulo)}</h2>
      <p>${escapeHtml(lema)}</p>
    </div>
    <ul class="bvs-lista">${filas}</ul>
    <div class="bvs-pie">
      <button type="button" class="btn-primary bvs-entendido" data-bvs-cerrar>Entendido</button>
      ${opts.conCuenta ? '<span class="bvs-nota">Puedes volver a verla desde tu avatar, en «Qué hay en esta sección».</span>' : ''}
    </div>`
}

// Lo que hace falta saber de la página en la que se está.
function contexto(doc = document) {
  const raiz = doc.documentElement
  const seccion = raiz.dataset.seccion
  const catalogo = doc.body?.dataset.modo === 'catalogo'
  const activa = doc.querySelector('.mc-pestania[aria-selected="true"]')
  const pestania = activa?.dataset.pestania || (seccion === 'cartas' ? (catalogo ? 'album' : 'resumen') : null)
  const conCuenta = Boolean(doc.getElementById('navUserBtn'))
  return { seccion, catalogo, pestania, ruta: location.pathname, conCuenta }
}

// Abre la ventana de la sección de esta página. Devuelve el diálogo (o null).
export async function abrirBienvenida({ doc = document } = {}) {
  const ctx = contexto(doc)
  if (!BIENVENIDAS[ctx.seccion]) return null
  await hojaInyectada('css/bienvenida-seccion.css')
  doc.getElementById('bvsDialogo')?.remove()
  const d = doc.createElement('dialog')
  d.id = 'bvsDialogo'
  d.className = 'bvs-dialogo'
  d.setAttribute('aria-labelledby', 'bvsTitulo')
  d.setAttribute('data-sin-arrastre', '')
  d.innerHTML = bienvenidaHtml(ctx.seccion, ctx)
  doc.body.appendChild(d)
  d.addEventListener('click', (e) => {
    // Tocar fuera (el fondo es el propio diálogo) también cierra.
    if (e.target === d || e.target.closest('[data-bvs-cerrar]')) return d.close()
    const fila = e.target.closest('.bvs-fila')
    if (!fila) return
    // La página en la que ya estás, o una pestaña de esta misma pantalla: sin
    // recargar, se cierra y se cambia de pestaña.
    if (fila.classList.contains('aqui')) { e.preventDefault(); return d.close() }
    const boton = fila.dataset.bvsPestania && doc.querySelector(`.mc-pestania[data-pestania="${fila.dataset.bvsPestania}"]`)
    if (boton) { e.preventDefault(); d.close(); boton.click() }
  })
  d.addEventListener('close', () => d.remove())
  d.tabIndex = -1
  d.showModal()
  // El foco al diálogo y no a un botón: sin el aro puesto nada más abrir (1237).
  d.focus()
  return d
}

// ¿Toca sola? La primera vez en la sección; nunca encima de otra ventana ni
// mientras se escribe (no se apunta: sale en la página siguiente), ni a un
// navegador automático salvo con `?bienvenida=1` (las pruebas).
export function tocaBienvenida({ doc = document, win = window } = {}) {
  const seccion = doc.documentElement.dataset.seccion
  if (!BIENVENIDAS[seccion] || doc.documentElement.hasAttribute('data-detalle')) return false
  const forzada = new URLSearchParams(win.location.search).get('bienvenida') === '1'
  if (win.navigator.webdriver && !forzada) return false
  try { if (!forzada && win.localStorage.getItem(LLAVE(seccion))) return false } catch { return false }
  return true
}

// Otra ventana MODAL: un `dialog` abierto con `show()` (los Filtros de Mi
// colección en el PC, que están siempre abiertos al lado) no cuenta.
function hayOtraVentana(doc) {
  try { return Boolean(doc.querySelector('dialog:modal')) } catch { return Boolean(doc.querySelector('dialog[open]')) }
}

export function montarBienvenida({ doc = document, win = window } = {}) {
  if (!tocaBienvenida({ doc, win })) return
  // Después de lo que la página pinta al llegar (y de Halloween, a los 900 ms).
  const luego = () => win.setTimeout(async () => {
    if (hayOtraVentana(doc) || doc.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return
    try { win.localStorage.setItem(LLAVE(doc.documentElement.dataset.seccion), new Date().toISOString().slice(0, 10)) } catch { return }
    await abrirBienvenida({ doc })
  }, 1200)
  // Una página que Chrome solo está preparando no la gasta (985).
  if (doc.prerendering) doc.addEventListener('prerenderingchange', luego, { once: true })
  else luego()
}
