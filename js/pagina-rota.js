// La 404 apunta qué dirección no existía y desde dónde se llegó (tanda 848),
// para el panel: si «desde» es una página NUESTRA, el enlace roto es nuestro y
// se puede arreglar. Sin la consulta (puede llevar datos de quien mira) y sin
// los robots, que prueban direcciones a ciegas.
import { supabase } from './supabase.js'
import { origenDe, pareceRobot } from './page-views.js'

export function datosDeRota(pathname, referrer, host) {
  const ruta = String(pathname || '/').slice(0, 200)
  let desde = null
  if (referrer) {
    const o = origenDe(referrer, host)
    if (o === 'interno') {
      try {
        desde = new URL(referrer).pathname.slice(0, 200)
      } catch {}
    } else desde = o
  }
  return { ruta, desde }
}

if (typeof window !== 'undefined' && !pareceRobot()) {
  supabase
    .from('enlaces_rotos')
    .insert(datosDeRota(location.pathname, document.referrer, location.hostname))
    .then(() => {}, () => {})
}
