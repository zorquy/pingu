// El service worker de PokeDoc. SOLO se ocupa de las notificaciones
// push: sin caché ni intercepción de peticiones a propósito — un fallo
// aquí jamás puede dejar la web sirviendo ficheros viejos.

self.addEventListener('install', () => {
  // La versión nueva del worker entra sin esperar a que se cierren las
  // pestañas viejas: no hay caché que migrar.
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
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
