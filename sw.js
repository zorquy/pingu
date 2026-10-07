// El service worker de PokeDoc: las notificaciones push y, desde la 745,
// la página «Sin conexión».
//
// La regla de siempre sigue en pie: un fallo aquí jamás puede dejar la web
// sirviendo ficheros viejos. Por eso NO se guarda en caché nada de la web:
// solo una página suelta (/sin-conexion.html, con su CSS dentro), y solo se
// sirve cuando una NAVEGACIÓN no llega a la red. Con red, todo va a la red
// como antes; los JS, las hojas y las imágenes ni se tocan.
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
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('pokedoc-') && k !== CACHE).map((k) => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(fetch(e.request).catch(async () => (await caches.match(PAGINA)) || Response.error()))
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
