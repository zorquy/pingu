import { supabase } from './supabase.js'

// Este fichero se llamaba analytics.js. Se renombró porque los
// bloqueadores de anuncios y de rastreo (uBlock, los escudos de Brave,
// los bloqueadores de contenido de Safari) bloquean por norma cualquier
// URL cuya ruta contenga "analytics". Con el nombre viejo, el import
// dinámico fallaba con "Failed to fetch" en el navegador de cualquiera
// que use uno — que son muchos — y eso llenaba el registro de errores.
//
// Analítica mínima y propia, sin cookies ni servicio externo: solo
// registra qué ruta se ha cargado (y el usuario, si hay sesión). No hay
// identificador de visitante ni nada persistido en el navegador — cada
// carga de página es una fila suelta, pensada solo para ver qué páginas
// se usan más, no para perfilar a nadie.

// Una misma página se puede alcanzar por varias URLs: "/" e "/index.html"
// son la misma, y también "/aprender" y "/aprender.html" (Netlify sirve
// las dos). Guardando `location.pathname` en crudo, las visitas de una
// misma página se repartían entre dos o tres filas distintas y el ranking
// mentía.
//
// Además, la parte interesante estaba en la query: "/categoria.html"
// juntaba TODAS las categorías en una sola fila, así que no se podía
// saber cuál se usa más — que es justo para lo que sirve esta tabla. Se
// mete el slug en la ruta normalizada.
const SLUG_MAX = 60

function limpiarSlug(valor) {
  // Cualquiera puede escribir lo que quiera en la query, y esto acaba en
  // una tabla y luego en una pantalla: se limita a lo que un slug puede
  // ser de verdad.
  return String(valor || '')
    .slice(0, SLUG_MAX)
    .replace(/[^a-zA-Z0-9_-]/g, '')
}

// Páginas cuya identidad real está en la query. El resto se quedan como
// están.
const POR_SLUG = { '/categoria': 'slug', '/guia': 'slug', '/curso': 'slug' }

export function normalizePath(pathname, search = '') {
  let ruta = String(pathname || '/').replace(/\/+$/, '') || '/'
  ruta = ruta.replace(/\.html$/i, '')
  ruta = ruta.replace(/\/index$/i, '') || '/'

  // Los perfiles se ven por /usuario/<nombre> y por /usuario.html?u=...
  // Se juntan todos en "/usuario" A PROPÓSITO: guardar a quién ha mirado
  // cada persona sería un registro de quién vigila a quién, y para saber
  // si la gente usa los perfiles basta con el total.
  if (ruta === '/usuario' || ruta.startsWith('/usuario/')) return '/usuario'

  // Los temas del foro se juntan todos en "/tema", y aquí la razón es
  // otra: la ruta es un uuid. Una tabla con cincuenta filas de
  // "/tema/8f3a1c…" no le dice nada a nadie, y para saber qué temas se
  // leen ya está el contador de visitas de cada tema.
  if (ruta === '/tema' || ruta.startsWith('/tema/')) return '/tema'

  const clave = POR_SLUG[ruta]
  if (clave) {
    const slug = limpiarSlug(new URLSearchParams(search || '').get(clave))
    if (slug) return `${ruta}/${slug}`
  }
  return ruta
}

const NOMBRES = {
  '/': 'Inicio',
  '/aprender': 'Aprender',
  '/foro': 'Foro · portada',
  '/tema': 'Foro · temas',
  '/usuarios': 'Comunidad',
  '/perfil': 'Mi perfil',
  '/usuario': 'Perfiles de usuario',
  '/buscar': 'Buscador',
  '/guardados': 'Guardados',
  '/mensajes': 'Mensajes',
  '/auth': 'Entrar y registro',
  '/onboarding': 'Bienvenida',
  '/reset-password': 'Recuperar contraseña',
  '/terminos': 'Términos de uso',
  '/privacidad': 'Privacidad',
  '/editor-guia': 'Editor de guías',
  '/admin': 'Panel de admin',
  '/admin/editor-guia': 'Panel · editor de guías',
  // Las visitas guardadas antes de meter el slug en la ruta no se pueden
  // repartir por categoría/guía a posteriori: el dato nunca se guardó.
  // Se dicen tal cual en vez de mezclarlas con las nuevas.
  '/categoria': 'Categoría · sin detalle (visitas antiguas)',
  '/guia': 'Guía · sin detalle (visitas antiguas)',
  '/curso': 'Curso · sin detalle (visitas antiguas)',
}

const PREFIJOS = [
  ['/categoria/', 'Categoría'],
  ['/guia/', 'Guía'],
  ['/curso/', 'Curso'],
  // /foro/<slug> sí se guarda entero: el slug se lee, a diferencia del
  // uuid de un tema, y saber qué foro se usa es justo lo interesante.
  ['/foro/', 'Foro'],
]

// Nombre legible para la tabla del panel. "/" no le dice nada a nadie.
export function pageLabel(ruta) {
  if (NOMBRES[ruta]) return NOMBRES[ruta]
  for (const [prefijo, titulo] of PREFIJOS) {
    if (ruta.startsWith(prefijo)) return `${titulo} · ${ruta.slice(prefijo.length)}`
  }
  return ruta
}

// ¿Esta carga de página la está haciendo un robot?
//
// Existe porque al investigar las visitas aparecieron cientos al día que
// iban de guía en guía con segundos de diferencia, todas anónimas: Google
// (y otros) EJECUTAN JavaScript al indexar, así que también disparan este
// registro. Sin separarlos, el número de visitas mide sobre todo cuánto te
// rastrean.
//
// Un robot se delata por dos sitios, y se miran los dos:
//   - navigator.webdriver: lo pone a true cualquier navegador automatizado
//     (los renderizadores de los buscadores incluidos).
//   - El user agent: los rastreadores se identifican en él a propósito
//     (Googlebot, bingbot...), y las herramientas de captura también
//     (HeadlessChrome, Lighthouse).
//
// Quien quiera mentir puede mentir — esto no es seguridad, es limpiar la
// estadística del 99% de robots, que son los educados que se identifican.
export function pareceRobot(ua = navigator.userAgent, webdriver = navigator.webdriver) {
  if (webdriver) return true
  return /bot|crawl|spider|slurp|preview|headless|lighthouse|scrap|python-requests|curl\//i.test(String(ua || ''))
}

// De dónde llega la gente (tanda 848), SOLO el dominio y ya traducido a un
// nombre: la dirección entera de la página de origen puede llevar datos de
// quien la mira (una búsqueda, un perfil). «interno» si viene de otra página
// nuestra (eso no es una entrada), «directo» si no hay de dónde.
const ORIGENES = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)(instagram\.com|l\.instagram\.com)$/, 'instagram'],
  [/(^|\.)(t\.me|telegram\.org|telegram\.me)$/, 'telegram'],
  [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'],
  [/(^|\.)(facebook\.com|fb\.com|l\.facebook\.com|m\.facebook\.com)$/, 'facebook'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)reddit\.com$/, 'reddit'],
  [/(^|\.)(discord\.com|discord\.gg|discordapp\.com)$/, 'discord'],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, 'whatsapp'],
  [/(^|\.)ko-fi\.com$/, 'ko-fi'],
]
export function origenDe(referrer = '', host = '') {
  if (!referrer) return 'directo'
  let h
  try {
    h = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'directo'
  }
  if (!h) return 'directo'
  if (h === String(host || '').toLowerCase().replace(/^www\./, '')) return 'interno'
  for (const [re, nombre] of ORIGENES) if (re.test(h)) return nombre
  return h.slice(0, 60)
}

// La etiqueta de campaña de un enlace que compartes (`?utm_source=telegram`).
export function campanaDe(search = '') {
  try {
    const v = new URLSearchParams(search).get('utm_source')
    const limpia = String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40)
    return limpia || null
  } catch {
    return null
  }
}

// Tres grupos por el ancho (y el puntero, para la tableta): no identifica a
// nadie y es lo que hace falta para saber dónde se mira la web.
export function aparatoDe(ancho = 0, tactil = false) {
  if (ancho < 768) return 'movil'
  if (ancho < 1200 && tactil) return 'tablet'
  return 'pc'
}

// APP O WEB, Y PERSONAS SIN IDENTIFICARLAS (tanda 1065). Abierta desde el
// icono de la pantalla de inicio, la web va «en modo app» y el navegador lo
// dice (display-mode standalone; en iPhone, navigator.standalone).
export function modoDe(win = window) {
  try {
    return win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone === true ? 'app' : 'web'
  } catch {
    return 'web'
  }
}
// Para contar las instalaciones por sistema: tres grupos, nada más.
export function plataformaDe(ua = navigator.userAgent, maxTouch = navigator.maxTouchPoints) {
  const u = String(ua || '')
  if (/iphone|ipad|ipod/i.test(u) || (/macintosh/i.test(u) && Number(maxTouch) > 1)) return 'ios'
  if (/android/i.test(u)) return 'android'
  return 'otro'
}
// Lo que el navegador recuerda de sí mismo: la fecha de su última visita, el
// momento de la última página y si ya se abrió alguna vez como app. Nunca
// sale de aquí: a la base solo van tres sí/no. `guardado` es lo de la vez
// anterior (o null), `hoy` la fecha local (AAAA-MM-DD) y `ms` el reloj.
export const MEDIA_HORA = 30 * 60 * 1000
export function marcasDeVisita(guardado, { hoy, ms, modo }) {
  const g = guardado && typeof guardado === 'object' ? guardado : {}
  const marcas = {
    primera_del_dia: g.dia !== hoy,
    nueva_visita: !(Number(g.ultima) > 0 && ms - Number(g.ultima) < MEDIA_HORA),
    primera_en_app: modo === 'app' && !g.app,
  }
  return { marcas, guardar: { dia: hoy, ultima: ms, app: Boolean(g.app || modo === 'app') } }
}
const CLAVE_VISTO = 'pd-visto'
function marcasDeEsteNavegador(modo) {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_VISTO) || 'null')
    const d = new Date()
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const { marcas, guardar } = marcasDeVisita(guardado, { hoy, ms: d.getTime(), modo })
    localStorage.setItem(CLAVE_VISTO, JSON.stringify(guardar))
    return marcas
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado) no se sabe: no se
    // cuenta como persona antes que contarla en cada página.
    return { primera_del_dia: null, nueva_visita: null, primera_en_app: null }
  }
}
const COLUMNAS_1065 = ['modo', 'primera_del_dia', 'primera_en_app', 'nueva_visita', 'plataforma']

export async function logPageView(session) {
  try {
    // supabase-js NO lanza excepciones: los fallos vienen en `error`, y
    // aquí nunca se leía. Si el insert llevaba tiempo fallando en
    // producción (permisos, política, tabla), no había NINGUNA forma de
    // enterarse: ni en pantalla ni en el registro de errores — el panel
    // solo enseñaba un tranquilo "0 visitas". Exactamente lo que pasó.
    const fila = {
      path: normalizePath(window.location.pathname, window.location.search),
      user_id: session?.user?.id || null,
      is_bot: pareceRobot(),
      origen: origenDe(document.referrer, location.hostname),
      campana: campanaDe(location.search),
      aparato: aparatoDe(window.innerWidth, matchMedia?.('(pointer: coarse)').matches),
    }
    // Lo de la 1065: app o web, y las tres marcas del navegador.
    const modo = modoDe()
    Object.assign(fila, { modo, plataforma: plataformaDe(), ...marcasDeEsteNavegador(modo) })
    // Abrir la app no viene de ninguna web: era «directo». Va aparte.
    if (modo === 'app' && fila.origen === 'directo') fila.origen = 'app'
    let { error } = await supabase.from('page_views').insert(fila)
    // Sin la migración 1065 sus columnas no existen: se manda sin ellas.
    if (error && new RegExp(COLUMNAS_1065.join('|')).test(error.message || '')) {
      for (const c of COLUMNAS_1065) delete fila[c]
      ;({ error } = await supabase.from('page_views').insert(fila))
    }
    // Sin la migración de la 848 las tres columnas no existen: se vuelve a
    // mandar sin ellas, que la visita no se pierda (como con is_bot).
    if (error && /origen|campana|aparato/.test(error.message || '')) {
      const { origen: _o, campana: _c, aparato: _a, ...sinNuevas } = fila
      ;({ error } = await supabase.from('page_views').insert(sinNuevas))
    }
    // Si la base aún no tiene la columna (la web se despliega antes de
    // ejecutar la migración), la visita NO se pierde: se registra sin
    // clasificar, que es como quedaban todas hasta ahora.
    if (error && /is_bot/.test(error.message || '')) {
      const { is_bot: _fuera, ...sinColumna } = fila
      ;({ error } = await supabase.from('page_views').insert(sinColumna))
    }
    if (error) {
      // Al registro de errores del admin, que es donde se mira. Solo los
      // errores DEL SERVIDOR (con código de PostgREST): un fallo de red es
      // normalmente un bloqueador de anuncios cortando la petición, y
      // apuntar uno por visitante con uBlock sería llenar el registro de
      // ruido sin culpa de la web.
      const { logClientError } = await import('./error-log.js')
      logClientError(`No se pudo registrar la visita: ${error.message}`, error.code || error.details || null)
    }
  } catch {
    // Red caída o bloqueador: la visita se pierde y no pasa nada más.
  }
}
