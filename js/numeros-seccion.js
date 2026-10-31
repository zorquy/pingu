// EL NÚMERO DE CADA SECCIÓN (tanda 1139, N2 de la propuesta de comunidad).
// PINGU: «un número en la barra cuando algo te espera, sí». Hasta ahora lo
// que tenías sin leer solo se sumaba en el avatar (avisos + mensajes) y desde
// la barra de abajo no se sabía dónde estaba. Ahora Comunidad cuenta los
// mensajes sin leer y los avisos del foro, y Jugar los de torneos (te toca
// una ronda, un recordatorio, tu plaza…). Lo mismo en la lateral del PC.
//
// Desde la 1142 (PINGU eligió A1, A2 y A3 de «La campana y los números»):
// Colección cuenta lo de los cambios, los cruces, las alertas de precio y
// «la tiene una tienda»; la campana cuenta SOLO lo que no es de ninguna
// sección (`avisosSinSeccion`), así que un aviso se cuenta en un sitio; el
// número va también en la PÁGINA de la burbuja y del cajón (Foro, Torneos,
// Deseos y cambios), y un aviso se da por leído al abrir la página a la que
// apunta (`casaConLaPagina`), vengas de la campana o no.
//
// No pregunta nada a la base: lee lo que ya cuentan la campanita
// (`window.__pdAvisos`, que deja notifications.js) y el sobre (#navMsgBadge),
// y se repinta con el evento `pd-avisos` que lanzan los dos. Lo puro va
// arriba y lo prueba Node.

export function seccionDeAviso(tipo = '') {
  const t = String(tipo || '')
  if (t.startsWith('forum_')) return 'Comunidad'
  if (t.startsWith('torneo_') || t.startsWith('tournament_')) return 'Jugar'
  if (t.startsWith('cambio_') || t.startsWith('trade_match') || t === 'aviso_precio' || t === 'tienda_la_tiene') return 'Colección'
  return null
}

// Lo que cuenta la campana (A2): lo sin leer que no lleva número en otra parte.
export const avisosSinSeccion = (avisos = []) => (avisos || []).filter((a) => a && !a.read_at && !seccionDeAviso(a.type))

// La página de cada sección donde está lo que te espera: el número de la
// sección se repite en ESA página de la burbuja y del cajón de la lateral.
const PAGINA_DE_SECCION = { Comunidad: 'foro', Jugar: 'torneos', 'Colección': 'cambios' }

// Qué página es un enlace de la burbuja, del cajón o del menú de Mi colección
// (Deseos y cambios es su pestaña `mercado`).
export function paginaDeEnlace(el) {
  if (el?.dataset?.pestania === 'mercado') return 'cambios'
  const href = el?.getAttribute?.('href') || ''
  if (/[?&]ver=(mercado|cambios)(&|#|$)/.test(href)) return 'cambios'
  const ruta = href.split(/[?#]/)[0].replace(/\.html$/, '').replace(/\/$/, '')
  return { '/foro': 'foro', '/torneos': 'torneos', '/mensajes': 'mensajes' }[ruta] || null
}

// ¿Este aviso apunta a la página que se está viendo? (A1) Misma ruta (con o
// sin `.html`) y todos los parámetros del enlace con el mismo valor aquí; el
// ancla no cuenta (`#mensaje-80` está DENTRO del tema). La portada no «lee»
// nada: un aviso que lleva a `/` se lee en la campana.
const rutaLimpia = (p) => {
  const r = String(p || '').replace(/\.html$/, '').replace(/\/+$/, '')
  return r === '' || r === '/index' ? '/' : r
}
export function casaConLaPagina(link, loc) {
  if (!link || !loc) return false
  let u
  try { u = new URL(link, 'https://pokedoc.es') } catch { return false }
  if (/^https?:/i.test(String(link)) && !['pokedoc.es', 'www.pokedoc.es', loc.host].includes(u.host)) return false
  const ruta = rutaLimpia(u.pathname)
  if (ruta === '/' || ruta !== rutaLimpia(loc.pathname)) return false
  const aqui = new URLSearchParams(loc.search || '')
  for (const [k, v] of u.searchParams) if (aqui.get(k) !== v) return false
  return true
}
export const avisosDeEstaPagina = (avisos, ...sitios) =>
  (avisos || []).filter((a) => a && !a.read_at && sitios.some((loc) => casaConLaPagina(a.link, loc)))

// «9+» del sobre vale diez: más de nueve, que es lo que se pinta igual.
const numeroDeChapa = (texto) => {
  const s = String(texto || '').trim()
  return s.endsWith('+') ? 10 : Number(s) || 0
}

// Por sección (los nombres de la barra) y por página (`paginas`). Mensajes es
// la sección de una cuenta de tienda (tienda-marco.js) y la página /mensajes.
export function cuentasDeSecciones(avisos = [], mensajes = 0) {
  const m = numeroDeChapa(mensajes)
  const cuentas = { Comunidad: m, Jugar: 0, 'Colección': 0, Mensajes: m }
  const paginas = { foro: 0, torneos: 0, cambios: 0, mensajes: m }
  for (const a of avisos || []) {
    if (a?.read_at) continue
    const s = seccionDeAviso(a?.type)
    if (!s) continue
    cuentas[s] += 1
    paginas[PAGINA_DE_SECCION[s]] += 1
  }
  Object.defineProperty(cuentas, 'paginas', { value: paginas, enumerable: false })
  return cuentas
}

export const textoDeNumero = (n) => (n > 9 ? '9+' : n > 0 ? String(n) : '')

// Pinta (o quita) la chapa en cada enlace de sección: los de la barra de
// abajo (`nav.bm a`) y los de la lateral (`.lat-seccion-enlace`). El nombre
// de la sección es el texto de su <span>, el mismo que usan las dos barras.
export function pintarNumeros(doc, cuentas) {
  for (const a of doc.querySelectorAll('nav.bm > a, .lat-seccion-enlace')) {
    const nombre = a.querySelector('span:not(.sec-num)')?.textContent.trim() || ''
    const texto = textoDeNumero(cuentas[nombre] || 0)
    let chapa = a.querySelector('.sec-num')
    if (!texto) {
      chapa?.remove()
      if (a.dataset.secNombre) { a.removeAttribute('aria-label'); delete a.dataset.secNombre }
      continue
    }
    if (!chapa) {
      chapa = doc.createElement('b')
      chapa.className = 'sec-num'
      chapa.setAttribute('aria-hidden', 'true')
      a.appendChild(chapa)
    }
    if (chapa.textContent !== texto) chapa.textContent = texto
    a.dataset.secNombre = nombre
    a.setAttribute('aria-label', `${nombre} (${texto} sin leer)`)
  }
  // Y la página: en línea, al final de la píldora o de la fila (una burbuja
  // que se desliza recortaría una chapa puesta encima del icono).
  const paginas = cuentas.paginas || {}
  for (const el of doc.querySelectorAll('.bm-burbuja-item, .lat-paginas a, .mc-pestania')) {
    const pagina = paginaDeEnlace(el)
    const texto = textoDeNumero(pagina ? paginas[pagina] || 0 : 0)
    let chapa = el.querySelector('.sec-num')
    if (!texto) {
      chapa?.remove()
      if (el.dataset.secNombre) { el.removeAttribute('aria-label'); delete el.dataset.secNombre }
      continue
    }
    const nombre = (el.querySelector('.mc-texto-largo, .bm-texto, span:not(.sec-num)')?.textContent || el.getAttribute('title') || '').trim()
    if (!chapa) {
      chapa = doc.createElement('b')
      chapa.className = 'sec-num sec-num-pagina'
      chapa.setAttribute('aria-hidden', 'true')
      el.appendChild(chapa)
    }
    if (chapa.textContent !== texto) chapa.textContent = texto
    el.dataset.secNombre = nombre
    if (nombre) el.setAttribute('aria-label', `${nombre} (${texto} sin leer)`)
  }
}

export function montarNumerosDeSeccion({ doc = document, win = window } = {}) {
  if (doc.documentElement.dataset.secNumeros) return
  doc.documentElement.dataset.secNumeros = '1'
  let pendiente = false
  const pintar = () => {
    if (pendiente) return
    pendiente = true
    win.requestAnimationFrame(() => {
      pendiente = false
      const sobre = doc.getElementById('navMsgBadge')
      const mensajes = sobre && !sobre.classList.contains('hidden') ? sobre.textContent : 0
      pintarNumeros(doc, cuentasDeSecciones(win.__pdAvisos || [], mensajes))
    })
  }
  win.addEventListener('pd-avisos', pintar)
  pintar()
}
