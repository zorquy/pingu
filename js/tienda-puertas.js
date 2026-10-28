// Lo que una cuenta de TIENDA puede abrir (tanda 1071). PINGU: «a una cuenta
// de tienda le limitaría el acceso a PokeDoc. Que tenga este panel y ya
// está… si quiere lo demás, que se haga una cuenta de usuario aparte».
//
// Sin dependencias: lo importa app.js, que lo baja todo el mundo, y lo
// prueba node. Lo que se abre es su panel, sus mensajes, SU escaparate (su
// perfil público) y las páginas sin barra o legales; lo demás vuelve a
// /tienda. Es una puerta de la web, no de la base: la cuenta sigue pudiendo
// leer lo que lee cualquiera (SCHEMA 1071).
export const MARCA_TIENDA = 'pd-tienda'

// `cartas` (1075): su Colección, el catálogo entero con su stock (la misma
// pantalla en modo tienda, js/mi-coleccion.js). La ficha completa, /carta, no.
const SUYAS = ['tienda', 'cartas', 'mensajes', 'privacidad', 'terminos', 'sobre', '404', 'sin-conexion', 'auth', 'alta-tienda', 'reset-password', 'onboarding']

export function puedeAbrirTienda(ruta, buscar, tienda) {
  const tramos = String(ruta || '/').replace(/\.html$/, '').split('/').filter(Boolean)
  const k = (tramos[0] || 'index').toLowerCase()
  if (k !== 'usuario') return SUYAS.includes(k)
  // Su perfil sí (es su escaparate), el de otra persona no.
  const p = new URLSearchParams(buscar || '')
  const u = tramos[1] ? decodeURIComponent(tramos[1]) : p.get('u')
  if (u) return Boolean(tienda?.u) && u.toLowerCase() === String(tienda.u).toLowerCase()
  return Boolean(tienda?.id) && p.get('id') === tienda.id
}

// La marca de la última vez: con ella la web echa a /tienda antes de saber
// la sesión, sin pintar media página de PokeDoc. Se borra al salir.
export function tiendaRecordada() {
  try { return JSON.parse(localStorage.getItem(MARCA_TIENDA) || 'null') } catch { return null }
}

export function recordarTienda(perfil) {
  try {
    if (perfil) localStorage.setItem(MARCA_TIENDA, JSON.stringify({ u: perfil.username || '', id: perfil.id }))
    else localStorage.removeItem(MARCA_TIENDA)
  } catch {}
}
