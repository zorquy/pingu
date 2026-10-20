// El service worker de PokeDoc: las notificaciones push y, desde la 745,
// la página «Sin conexión».
//
// La regla de siempre sigue en pie: un fallo aquí jamás puede dejar la web
// sirviendo ficheros viejos. La página «Sin conexión» solo se sirve cuando
// una NAVEGACIÓN no llega a la red; los ficheros de la web, desde la 786,
// con la caché que se vacía entera al primer cambio (abajo).
const CACHE = 'pokedoc-sin-conexion-1'
const PAGINA = '/sin-conexion.html'

self.addEventListener('install', (e) => {
  // La versión nueva entra sin esperar a que se cierren las pestañas.
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(PAGINA, { cache: 'reload' }))).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  // Las cachés de versiones anteriores de esta página, fuera.
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('pokedoc-') && k !== CACHE && k !== ASSETS && k !== LECTURA && k !== PAGINAS).map((k) => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim())
  )
})

// LOS FICHEROS DE LA WEB, AL MOMENTO (786, LO1). Las hojas, los módulos y
// las imágenes propias se sirven desde la caché y se revisan por detrás
// («stale-while-revalidate»): con `max-age=0` cada pantalla preguntaba por
// sus 25 o 30 ficheros antes de pintar, y en la app instalada con 4G regular
// era medio segundo en blanco. Las páginas siguen yendo a la red primero.
//
// La regla de arriba (nunca servir la web VIEJA) se cumple así: en cuanto la
// revisión de UN fichero ve que ha cambiado, se vacía la caché ENTERA. Lo
// viejo se sirve como mucho en una pantalla —y de una vez, todo del mismo
// despliegue—, y la siguiente lo baja todo nuevo. Mezclar módulos de dos
// despliegues es lo que rompe una página entera (la 510), y por eso no se
// guarda uno nuevo junto a otros viejos. Si una tanda no puede convivir ni
// una pantalla con la anterior, sube ASSETS_VERSION.
const ASSETS_VERSION = 1
const ASSETS = `pokedoc-ficheros-${ASSETS_VERSION}`
const esFichero = (url) => url.origin === self.location.origin && /^\/(css|js|assets)\//.test(url.pathname)

// LAS PÁGINAS, TAMBIÉN AL MOMENTO (897, R5). La página HTML iba siempre a
// la red primero: 150–400 ms en blanco en 4G antes de empezar, con los
// ficheros ya en caché. Ahora las páginas de la casa se sirven de su caché
// y se revisan por detrás, como los ficheros. Y la regla de no servir la
// web vieja se cumple ATANDO las dos cachés: un cambio visto en cualquier
// fichero o en cualquier página vacía LAS DOS (`vaciarTodo`), así que lo que
// hay guardado entró siempre después del último cambio visto —del mismo
// despliegue que lo demás— y lo viejo dura, como mucho, una pantalla.
//
// Solo la dirección pelada de una página (`/foro`, `/aprender.html`): con
// consulta o con más trozos no se guarda, que ahí el servidor puede
// contestar otra cosa (meta-social reescribe la cabecera de /guia, /carta,
// /coleccion, /curso y /categoria según lo que se pide; /usuario y /tema
// llegan por reescritura). Y se quedan fuera las que son otra cosa: la
// feria y las de leer tienen su propia caché, /sin-conexion es el respaldo,
// y /auth, /reset-password, /onboarding y /admin no se abren «al momento»
// desde ninguna barra.
const PAGINAS = 'pokedoc-paginas-1'
const SIN_PAGINA = new Set(['feria', 'sin-conexion', 'auth', 'reset-password', 'onboarding', 'admin', 'guia', 'carta', 'coleccion', 'curso', 'categoria', 'editor-guia', '404'])
function esPaginaDeCache(url) {
  if (url.origin !== self.location.origin || url.search) return false
  const m = /^\/([a-z0-9-]*)(\.html)?$/.exec(url.pathname)
  return !!m && !SIN_PAGINA.has(m[1])
}

// Un despliegue nuevo: fuera todo lo de antes, páginas y ficheros, y entra
// solo lo que llegue desde ahora. DE UNA VEZ (910): borrar llave a llave
// dejaba la caché a medias durante cientos de vueltas, y una página que se
// abría en ese rato bajaba unos módulos nuevos y otros viejos —«Importing
// binding name 'TOPE_CARTAS' is not found» en /buscar, la 510 otra vez—.
// `generacion` cuenta los vaciados: una revisión que empezó antes de uno
// no guarda lo suyo, que pudo pedirlo antes del despliegue.
let generacion = 0
async function vaciarTodo() {
  generacion++
  await Promise.all([caches.delete(ASSETS), caches.delete(PAGINAS)])
}

async function revisar(peticion, nombre, guardada) {
  const desde = generacion
  const fresca = await fetch(peticion, { cache: 'no-cache' })
  // Una respuesta que viene de una redirección no sirve para una navegación.
  if (!fresca.ok || fresca.type !== 'basic' || fresca.redirected) return fresca
  // La firma es el `etag` (Netlify lo pone) o la fecha; sin ninguna de las
  // dos, se compara el contenido, que sin firma no hay otra forma de saberlo.
  const firma = (r) => r.headers.get('etag') || r.headers.get('last-modified')
  let cambio = false
  if (guardada) {
    if (firma(guardada) && firma(fresca)) cambio = firma(guardada) !== firma(fresca)
    else cambio = (await guardada.clone().text()) !== (await fresca.clone().text())
  }
  if (cambio) await vaciarTodo()
  else if (desde !== generacion) return fresca
  // Abierta otra vez por su nombre: si se vació, la de antes ya no es la caché.
  await (await caches.open(nombre)).put(peticion, fresca.clone())
  return fresca
}

// Una página de la casa: la copia guardada ya, y la red por detrás (897).
// La petición de navegación no se puede volver a hacer con otras opciones
// («Cannot construct a Request with mode navigate and a RequestInit»), así
// que la revisión va por la dirección, que es también la llave.
async function paginaDeCasa(req, e) {
  const guardada = await (await caches.open(PAGINAS)).match(req.url)
  const revision = revisar(req.url, PAGINAS, guardada)
  if (guardada) {
    e.waitUntil(revision.catch(() => {}))
    return guardada
  }
  return revision.catch(async () => (await caches.match(PAGINA)) || Response.error())
}

// LAS PÁGINAS DE LEER (819, VE4): una guía o una noticia ya leída se abre
// aunque la red vaya mal. Red primero; si en dos segundos y medio no ha
// contestado y hay copia de la última vez, la copia (y la red sigue por
// detrás para la siguiente). Sin copia se espera a la red, como siempre: un
// fallo de red sin copia es la página «Sin conexión». El texto del artículo
// viene ya en el HTML (lo pinta meta-social en el servidor), así que la copia
// se lee. Se guardan las últimas MAX_LECTURA, no todas.
const LECTURA = 'pokedoc-lectura-1'
const MAX_LECTURA = 30
const ESPERA_LECTURA_MS = 2500
const esDeLeer = (url) => url.origin === self.location.origin && /^\/(guia|noticias)\/[^/]+$/.test(url.pathname)

async function guardarLectura(req, r) {
  // Una respuesta que viene de una redirección no sirve para una navegación.
  if (!r.ok || r.redirected) return
  const cache = await caches.open(LECTURA)
  await cache.put(req, r)
  const claves = await cache.keys()
  for (const k of claves.slice(0, Math.max(0, claves.length - MAX_LECTURA))) await cache.delete(k)
}

async function paginaDeLeer(req, e) {
  const red = fetch(req).then((r) => {
    e.waitUntil(guardarLectura(req, r.clone()).catch(() => {}))
    return r
  })
  const copia = await caches.match(req, { cacheName: LECTURA })
  if (!copia) return red.catch(async () => (await caches.match(PAGINA)) || Response.error())
  const tarde = new Promise((ok) => setTimeout(() => ok(null), ESPERA_LECTURA_MS))
  e.waitUntil(red.catch(() => {}))
  return (await Promise.race([red.catch(() => null), tarde])) || copia
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.mode === 'navigate') {
    // El modo feria (794, NU5) es la única PÁGINA que se guarda: se abre en
    // un pabellón sin cobertura. Red primero, y la copia de la última vez.
    if (new URL(req.url).pathname.replace(/\.html$/, '') === '/feria') {
      e.respondWith(
        fetch(req)
          .then(async (r) => { if (r.ok) await (await caches.open(CACHE)).put('/feria', r.clone()); return r })
          .catch(async () => (await caches.match('/feria')) || (await caches.match(PAGINA)) || Response.error())
      )
      return
    }
    if (esDeLeer(new URL(req.url))) {
      e.respondWith(paginaDeLeer(req, e))
      return
    }
    if (esPaginaDeCache(new URL(req.url))) {
      e.respondWith(paginaDeCasa(req, e))
      return
    }
    e.respondWith(fetch(req).catch(async () => (await caches.match(PAGINA)) || Response.error()))
    return
  }
  if (req.method !== 'GET' || !esFichero(new URL(req.url))) return
  e.respondWith(
    (async () => {
      const guardada = await (await caches.open(ASSETS)).match(req)
      const revision = revisar(req, ASSETS, guardada)
      if (guardada) {
        e.waitUntil(revision.catch(() => {}))
        return guardada
      }
      return revision
    })().catch(() => fetch(req))
  )
})

self.addEventListener('push', (e) => {
  // El cuerpo lo cifra la función de Netlify: { title, body, link }.
  let datos = {}
  try {
    datos = e.data ? e.data.json() : {}
  } catch {
    datos = { body: e.data ? e.data.text() : '' }
  }
  e.waitUntil(
    self.registration.showNotification(datos.title || 'PokeDoc', {
      body: datos.body || '',
      icon: '/assets/app-icon-192.png',
      badge: '/assets/icon-192.png',
      data: { link: datos.link || '/' },
      // Dos avisos del mismo tipo no se apilan hasta el infinito.
      tag: datos.tag || 'pokedoc',
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const destino = new URL(e.notification.data?.link || '/', self.location.origin).href
  e.waitUntil(
    (async () => {
      // Si ya hay una pestaña de PokeDoc, se reutiliza; si no, se abre.
      const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const nuestra = abiertas.find((c) => new URL(c.url).origin === self.location.origin)
      if (nuestra) {
        await nuestra.navigate(destino)
        return nuestra.focus()
      }
      return self.clients.openWindow(destino)
    })()
  )
})
