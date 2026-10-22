// El service worker de PokeDoc: las notificaciones push y, desde la 745,
// la página «Sin conexión».
//
// La regla de siempre sigue en pie: un fallo aquí jamás puede dejar la web
// sirviendo ficheros viejos. La página «Sin conexión» solo se sirve cuando
// una NAVEGACIÓN no llega a la red; los ficheros y las páginas de la web,
// desde la 786 y la 897, desde su caché, por generaciones (982, abajo).
const CACHE = 'pokedoc-sin-conexion-1'
const PAGINA = '/sin-conexion.html'

self.addEventListener('install', (e) => {
  // La versión nueva entra sin esperar a que se cierren las pestañas.
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(PAGINA, { cache: 'reload' }))).catch(() => {}))
})

self.addEventListener('activate', (e) => {
  // Las cachés de versiones anteriores de esta página, fuera. Las de cada
  // generación de la web (982) no: esas las recoge `renovar`.
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('pokedoc-') && k !== CACHE && k !== LECTURA && k !== ESTADO && !DE_GENERACION.test(k)).map((k) => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim())
  )
})

// LOS FICHEROS DE LA WEB, AL MOMENTO (786, LO1). Las hojas, los módulos y
// las imágenes propias se sirven desde la caché y se revisan por detrás
// («stale-while-revalidate»): con `max-age=0` cada pantalla preguntaba por
// sus 25 o 30 ficheros antes de pintar, y en la app instalada con 4G regular
// era medio segundo en blanco.
const esFichero = (url) => url.origin === self.location.origin && /^\/(css|js|assets)\//.test(url.pathname)

// LAS PÁGINAS, TAMBIÉN AL MOMENTO (897, R5): las páginas de la casa se
// sirven de su caché y se revisan por detrás, como los ficheros. Solo la
// dirección pelada (`/foro`, `/aprender.html`): con consulta o con más trozos
// el servidor puede contestar otra cosa (meta-social reescribe /guia, /carta,
// /coleccion, /curso y /categoria; /usuario y /tema llegan por reescritura).
// Fuera también las que son otra cosa: la feria y las de leer tienen su
// caché, /sin-conexion es el respaldo, y /auth, /reset-password, /onboarding
// y /admin no se abren «al momento» desde ninguna barra.
const SIN_PAGINA = new Set(['feria', 'sin-conexion', 'auth', 'reset-password', 'onboarding', 'admin', 'guia', 'carta', 'coleccion', 'curso', 'categoria', 'editor-guia', '404'])
function esPaginaDeCache(url) {
  if (url.origin !== self.location.origin || url.search) return false
  const m = /^\/([a-z0-9-]*)(\.html)?$/.exec(url.pathname)
  return !!m && !SIN_PAGINA.has(m[1])
}

// UN DESPLIEGUE, POR GENERACIONES (982). Ficheros y páginas van en dos
// cachés por GENERACIÓN (`pokedoc-ficheros-N`, `pokedoc-paginas-N`), y la que
// se sirve es la que apunta ESTADO. La regla de siempre —nunca mezclar
// módulos de dos despliegues, que rompe la página entera (la 510, la 910)—
// se cumplía vaciando las dos al primer cambio visto; con ~20 despliegues al
// día eso era bajarlo todo casi en cada visita (medido: la segunda página,
// de 0,4 a 2,2 s en Mi colección). Ahora, al ver un cambio, `renovar` llena
// la generación siguiente por detrás preguntando fichero a fichero «¿ha
// cambiado?» (un 304 no baja nada) y al acabar cambia el puntero DE UNA VEZ.
// Mientras tanto la de antes sigue entera.
//
// Y cada pestaña se queda con SU generación (`genDe`): una página que llegó
// de la red durante la renovación ya es del despliegue nuevo y sus módulos
// no salen de la caché vieja; una que salió de la caché vieja sigue con lo
// viejo aunque el puntero cambie. Si el worker se ha dormido y no sabe de
// quién es una pestaña, la activa (y si aun así llega una mezcla, la página
// se recarga sola: error-log.js, la 910).
const ESTADO = 'pokedoc-estado-1'
const DE_GENERACION = /^pokedoc-(ficheros|paginas)-(\d+)$/
const ficheros = (g) => `pokedoc-ficheros-${g}`
const paginas = (g) => `pokedoc-paginas-${g}`
let activa = null
const genActiva = () =>
  (activa ??= caches.open(ESTADO).then((c) => c.match('/__generacion')).then(async (r) => (r ? Number(await r.text()) || 1 : 1)).catch(() => 1))
const genDe = new Map()
function apuntar(id, g) {
  if (!id) return
  genDe.set(id, g)
  // Las pestañas cerradas no avisan: se olvidan las más viejas.
  if (genDe.size > 100) genDe.delete(genDe.keys().next().value)
}
const genDelCliente = async (id) => (id && genDe.get(id)) || genActiva()
let renovando = null
let renovandoA = 0
// Tres renovaciones fallidas seguidas (sin red a medias, una caché que no
// deja escribir): se vuelve a lo de antes, vaciar, que nunca sirve lo viejo.
let fallos = 0

const firma = (r) => r.headers.get('etag') || r.headers.get('last-modified')
async function distintas(guardada, fresca) {
  // La firma es el `etag` (Netlify lo pone) o la fecha; sin ninguna, el contenido.
  if (firma(guardada) && firma(fresca)) return firma(guardada) !== firma(fresca)
  return (await guardada.clone().text()) !== (await fresca.clone().text())
}
const sirve = (r) => r.ok && r.type === 'basic' && !r.redirected

// ¿Ha cambiado esto? Con la firma de lo guardado: un 304 es «no», sin bajar nada.
async function comoQuedaEn(req, guardada) {
  const cab = {}
  if (guardada.headers.get('etag')) cab['if-none-match'] = guardada.headers.get('etag')
  else if (guardada.headers.get('last-modified')) cab['if-modified-since'] = guardada.headers.get('last-modified')
  const r = await fetch(new Request(req.url, { headers: cab, cache: 'no-store', credentials: 'same-origin' }))
  if (r.status === 304) return guardada
  return sirve(r) ? r : null
}

function renovar(g, disparo, fresca) {
  if (renovando) return renovando
  const n = g + 1
  renovandoA = n
  renovando = (async () => {
    const pares = [
      [await caches.open(ficheros(g)), await caches.open(ficheros(n))],
      [await caches.open(paginas(g)), await caches.open(paginas(n))],
    ]
    if (disparo) await pares[esFichero(new URL(disparo.url || disparo, self.location.href)) ? 0 : 1][1].put(disparo, fresca)
    let preguntadas = 0
    let sinRespuesta = 0
    for (const [vieja, nueva] of pares) {
      const claves = await vieja.keys()
      // De seis en seis, como un navegador por servidor.
      for (let i = 0; i < claves.length; i += 6) {
        await Promise.all(claves.slice(i, i + 6).map(async (req) => {
          if (await nueva.match(req)) return
          const guardada = await vieja.match(req)
          if (!guardada) return
          preguntadas++
          const r = await comoQuedaEn(req, guardada).catch(() => null)
          // Lo que no se ha podido preguntar no entra: se pedirá a la red.
          if (r) await nueva.put(req, r)
          else sinRespuesta++
        }))
      }
    }
    // Si se ha ido la red a mitad, cambiar dejaría una caché medio vacía (y
    // sin nada para cuando no haya cobertura): se queda la de antes.
    if (sinRespuesta > preguntadas / 2) throw new Error('sin red para renovar')
    await (await caches.open(ESTADO)).put('/__generacion', new Response(String(n)))
    activa = Promise.resolve(n)
    fallos = 0
    // La de antes se queda para las pestañas que aún la usan; las anteriores, fuera.
    for (const k of await caches.keys()) {
      const m = DE_GENERACION.exec(k)
      if (m && Number(m[2]) < g) await caches.delete(k)
    }
  })()
    .catch(async () => {
      if (++fallos >= 3) {
        fallos = 0
        await Promise.all([caches.delete(ficheros(g)), caches.delete(paginas(g)), caches.delete(ficheros(n)), caches.delete(paginas(n))]).catch(() => {})
      } else await Promise.all([caches.delete(ficheros(n)), caches.delete(paginas(n))]).catch(() => {})
    })
    .finally(() => {
      renovando = null
      renovandoA = 0
    })
  return renovando
}

// Pide a la red lo de la generación `g` y lo guarda donde toca: en la suya si
// es la activa (o la que se está llenando); en una vieja, no se escribe.
async function revisar(peticion, tipo, guardada, g) {
  const fresca = await fetch(peticion, { cache: 'no-cache' })
  // Una respuesta que viene de una redirección no sirve para una navegación.
  if (!sirve(fresca)) return fresca
  // Con copia, quien espera esto es la revisión por detrás: puede esperar a
  // que se llene la generación nueva.
  const actual = await genActiva()
  if (guardada && (await distintas(guardada, fresca))) {
    // Desde una generación ya pasada no se renueva: esa la renovó otra.
    if (g === actual) await renovar(g, peticion, fresca.clone())
    return fresca
  }
  if (g === actual || g === renovandoA) await (await caches.open(tipo === 'ficheros' ? ficheros(g) : paginas(g))).put(peticion, fresca.clone())
  return fresca
}

// Una página de la casa: la copia guardada ya, y la red por detrás (897).
// La petición de navegación no se puede volver a hacer con otras opciones
// («Cannot construct a Request with mode navigate and a RequestInit»), así
// que la revisión va por la dirección, que es también la llave.
async function paginaDeCasa(req, e) {
  const g = await genActiva()
  const guardada = await (await caches.open(paginas(g))).match(req.url)
  if (guardada) {
    apuntar(e.resultingClientId, g)
    e.waitUntil(revisar(req.url, 'paginas', guardada, g).catch(() => {}))
    return guardada
  }
  // De la red: si hay una renovación en marcha, esta página ya es del despliegue nuevo.
  const de = renovandoA || g
  apuntar(e.resultingClientId, de)
  return revisar(req.url, 'paginas', null, de).catch(async () => (await caches.match(PAGINA)) || Response.error())
}

async function ficheroDeCasa(req, e) {
  const g = await genDelCliente(e.clientId)
  const guardada = await (await caches.open(ficheros(g))).match(req)
  if (guardada) {
    e.waitUntil(revisar(req, 'ficheros', guardada, g).catch(() => {}))
    return guardada
  }
  return revisar(req, 'ficheros', null, g)
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
  e.respondWith(ficheroDeCasa(req, e).catch(() => fetch(req)))
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
