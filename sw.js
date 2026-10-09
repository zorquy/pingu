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
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('pokedoc-') && k !== CACHE && k !== ASSETS).map((k) => caches.delete(k))))
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

async function revisar(peticion, cache, guardada) {
  const fresca = await fetch(peticion, { cache: 'no-cache' })
  if (!fresca.ok || fresca.type !== 'basic') return fresca
  // La firma es el `etag` (Netlify lo pone) o la fecha; sin ninguna de las
  // dos, se compara el contenido, que sin firma no hay otra forma de saberlo.
  const firma = (r) => r.headers.get('etag') || r.headers.get('last-modified')
  let cambio = false
  if (guardada) {
    if (firma(guardada) && firma(fresca)) cambio = firma(guardada) !== firma(fresca)
    else cambio = (await guardada.clone().text()) !== (await fresca.clone().text())
  }
  if (cambio) {
    // Un despliegue nuevo: fuera todo lo de antes, y entra solo este.
    for (const k of await cache.keys()) await cache.delete(k)
  }
  await cache.put(peticion, fresca.clone())
  return fresca
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
    e.respondWith(fetch(req).catch(async () => (await caches.match(PAGINA)) || Response.error()))
    return
  }
  if (req.method !== 'GET' || !esFichero(new URL(req.url))) return
  e.respondWith(
    (async () => {
      const cache = await caches.open(ASSETS)
      const guardada = await cache.match(req)
      const revision = revisar(req, cache, guardada)
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
      icon: '/assets/icon-192.png',
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
