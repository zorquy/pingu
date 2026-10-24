// INVITAR A LOS AVISOS EN EL MÓVIL (tanda 994). PINGU: «¿se puede poner en
// móvil activado automáticamente? o al menos un pop up». Solo, no: el
// navegador (y el iPhone, el que más) no deja pedir el permiso si no lo pide
// un toque de la persona. Así que una tarjeta encima de la barra, como la de
// instalar, con «Activar», que es el toque que saca la pregunta del sistema.
//
// Sale en el móvil (entra por `barra-movil.js`), con cuenta, en las páginas
// de lista, una vez por sesión del navegador y a los pocos segundos de
// llegar. Nunca si el navegador no sabe de push (Safari del iPhone fuera de
// la app instalada), si ya están activados, si el permiso se denegó, si el
// sitio no tiene claves o si está la de instalar a la vista. «Ahora no» la
// calla un mes, y a la segunda no vuelve.
import { icons } from './icons.js'

const CALLADA = 'pokedoc-push-no'
const EN_SESION = 'pokedoc-push-invitada'
const UN_MES = 30 * 86400000
const ESPERA = 3000

// Pura: le llega lo que se sabe y lo guardado.
export function tocaInvitar({ soportado, permiso, suscrito, hayClave, callada = null, yaEnSesion = false, ahora = Date.now() }) {
  if (!soportado || suscrito || !hayClave || yaEnSesion) return false
  if (permiso !== 'default') return false
  if (callada?.veces >= 2) return false
  if (callada?.en && ahora - Number(callada.en) < UN_MES) return false
  return true
}

const leerCallada = (almacen) => { try { return JSON.parse(almacen.getItem(CALLADA) || 'null') } catch { return null } }

export async function montarInvitarPush({ doc = document, win = window, almacen = win.localStorage, espera = ESPERA } = {}) {
  let yaEnSesion = false
  try { yaEnSesion = !!win.sessionStorage.getItem(EN_SESION) } catch {}
  if (yaEnSesion) return null
  const [push, { supabase }] = await Promise.all([import('./push.js'), import('./supabase.js')])
  const [{ data }, estado, clave] = await Promise.all([supabase.auth.getSession(), push.estadoPush(), push.hayClavePush().catch(() => null)])
  const userId = data?.session?.user?.id
  if (!userId) return null
  if (!tocaInvitar({ ...estado, hayClave: !!clave, callada: leerCallada(almacen) })) return null
  await new Promise((r) => setTimeout(r, espera))
  // La de instalar va primero: dos tarjetas a la vez no caben.
  if (doc.querySelector('.bm-instalar, .bm-instalar-banda')) return null
  try { win.sessionStorage.setItem(EN_SESION, '1') } catch {}

  const tarjeta = doc.createElement('div')
  tarjeta.className = 'bm-instalar bm-instalar-tarjeta bm-push'
  tarjeta.setAttribute('role', 'region')
  tarjeta.setAttribute('aria-label', 'Avisos en el móvil')
  tarjeta.innerHTML = `
    <span class="bm-push-icono" aria-hidden="true">${icons.bell(22)}</span>
    <div class="bm-instalar-texto"><b>¿Te avisamos en el móvil?</b><span data-push="texto">Si te responden, te mencionan o baja una carta que vigilas.</span></div>
    <button type="button" class="bm-instalar-no" data-push="no" aria-label="Ahora no">${icons.xCircle(18)}</button>
    <button type="button" class="btn-primary" data-push="si">Activar los avisos</button>`
  doc.body.appendChild(tarjeta)
  tarjeta.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-push]')
    if (!b) return
    if (b.dataset.push === 'no') {
      const antes = leerCallada(almacen)
      try { almacen.setItem(CALLADA, JSON.stringify({ en: Date.now(), veces: (antes?.veces || 0) + 1 })) } catch {}
      tarjeta.remove()
      return
    }
    // Lo primero tras el toque es la pregunta del sistema (ver push.js).
    b.disabled = true
    b.textContent = 'Activando…'
    const r = await push.activarPush(userId, clave)
    const texto = tarjeta.querySelector('[data-push="texto"]')
    if (r.ok) {
      tarjeta.querySelector('b').textContent = 'Avisos activados'
      texto.textContent = 'Los cambias cuando quieras en Ajustes.'
      b.remove()
      setTimeout(() => tarjeta.remove(), 2500)
      return
    }
    // Dijo que no en la pregunta del sistema: el navegador ya no deja volver
    // a preguntar, así que la tarjeta se va y no vuelve (permiso 'denied').
    texto.textContent = r.motivo || 'No se han podido activar.'
    b.remove()
  })
  return tarjeta
}
