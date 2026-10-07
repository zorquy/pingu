// El aviso de «sin conexión» en una página ABIERTA (745, V7). Antes, sin
// red, la página se quedaba cargando sin explicar nada.
//
// Se carga CON red, en un rato libre (app.js), y se queda escuchando: si se
// pidiera al irse la red, ya no podría bajarse. Pinta sus estilos en línea
// por lo mismo: sin red no llega ninguna hoja nueva.
const ID = 'sinRedAviso'

export function vigilarRed(doc = document, win = window) {
  const poner = () => {
    if (doc.getElementById(ID)) return
    const a = doc.createElement('div')
    a.id = ID
    a.setAttribute('role', 'status')
    a.textContent = 'Sin conexión. Lo que ves puede no estar al día; lo que añadas a tu colección se guarda cuando vuelva la red.'
    Object.assign(a.style, {
      position: 'fixed', top: '0', left: '0', right: '0', zIndex: '200',
      padding: 'var(--e-sm) var(--e-lg)', background: 'var(--navy-solid)', color: 'var(--blanco-fijo)',
      fontSize: 'var(--t-sm)', fontWeight: '600', textAlign: 'center',
    })
    doc.body.appendChild(a)
  }
  const quitar = () => doc.getElementById(ID)?.remove()
  win.addEventListener('offline', poner)
  win.addEventListener('online', quitar)
  if (win.navigator?.onLine === false) poner()
}
