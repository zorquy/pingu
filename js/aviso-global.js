import { supabase } from './supabase.js'
import { hojaInyectada } from './hoja.js'
import { sinMigracion } from './sin-migracion.js'
import { seVeAviso, elegir, huellaDeAviso, franjaHtml, tarjetaHtml, desdeAvisoViejo, quedanTexto, cuentaAtrasHtml } from './aviso-puro.js'

// Los AVISOS DEL EQUIPO en la web (1260; la franja sola, desde la 1120). Se
// escriben en /admin → Avisos (tabla `avisos`) y cada uno sale donde diga:
//   · la FRANJA de debajo de la barra, en todas las páginas (una: la más
//     urgente), que se cierra y se queda cerrada para ese aviso;
//   · el POP-UP, una vez por persona (js/aviso-pop.js, por import()), que
//     también abre `?aviso=<id>` (el enlace de la campanita) y la franja;
//   · la TARJETA de Inicio, encima de los bloques de la portada.
// Las reglas (a quién, cuál gana, la cuenta atrás) están en js/aviso-puro.js.
// Sin la migración 1260 sale el aviso de antes (site_settings.aviso_global).

const CERRADOS = 'pd-avisos-cerrados'
const VISTOS = 'pd-avisos-vistos'
const CONTADOS = 'pd-avisos-contados'
const GUARDADOS = 'pd-avisos-ultimos'
const COLUMNAS = 'id, tipo, titulo, texto, imagen, boton_texto, boton_enlace, participar, enlace_texto, enlace, sitios, cuenta_atras, publico, desde, hasta, publicado, publicado_at'

const leer = (clave, defecto) => {
  try {
    return JSON.parse(localStorage.getItem(clave)) ?? defecto
  } catch {
    return defecto
  }
}
const escribir = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {}
}
const conjunto = (clave) => new Set(leer(clave, []))
const apuntarEn = (clave, huella) => escribir(clave, [...conjunto(clave), huella].slice(-50))

let pedido = null
// Los avisos en marcha (la política de la base ya solo deja ver esos), una
// vez por página: los comparten la franja, el pop-up y la tarjeta.
export function avisosEnMarcha() {
  if (!pedido) pedido = pedir()
  return pedido
}
async function pedir() {
  const r = await supabase.from('avisos').select(COLUMNAS)
  if (!r.error) {
    escribir(GUARDADOS, r.data || [])
    return r.data || []
  }
  if (!sinMigracion(r.error)) return leer(GUARDADOS, [])
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'aviso_global').maybeSingle()
  const viejo = desdeAvisoViejo(data?.value)
  return viejo ? [viejo] : []
}

// Una persona cuenta una vez por aviso y cosa (lo recuerda el navegador); la
// base solo suma, sin saber quién (aviso_contar).
export function contar(a, que) {
  if (!a?.id || a.id === 'viejo') return
  const hechos = leer(CONTADOS, {})
  const letra = { visto: 'v', clic: 'c', cerrado: 'x' }[que]
  if (!letra || (hechos[a.id] || '').includes(letra)) return
  hechos[a.id] = (hechos[a.id] || '') + letra
  escribir(CONTADOS, hechos)
  supabase.rpc('aviso_contar', { p_aviso: a.id, p_que: que }).then(() => {}, () => {})
}

async function contexto() {
  const raiz = document.documentElement
  const movil = raiz.classList.contains('con-barra-movil') || matchMedia('(max-width: 760px)').matches
  const conCuenta = Boolean((await supabase.auth.getSession()).data?.session)
  const tienda = raiz.dataset.seccion === 'tienda' || document.body?.hasAttribute('data-tienda')
  return { movil, conCuenta, tienda }
}

export const abrirAviso = (a, opciones) => import('./aviso-pop.js').then((m) => m.abrirPop(a, opciones))

// La cuenta atrás de lo que esté pintado, cada minuto.
let reloj = null
function ponerReloj() {
  if (reloj) return
  reloj = setInterval(() => {
    const ahora = new Date()
    for (const el of document.querySelectorAll('[data-quedan]')) {
      const t = quedanTexto(el.dataset.quedan, ahora)
      if (!t) el.remove()
      else el.lastChild.textContent = ` ${t}`
    }
    for (const el of document.querySelectorAll('[data-cuenta]')) el.innerHTML = cuentaAtrasHtml(el.dataset.cuenta, ahora)
  }, 60000)
}

function pintarFranja(a) {
  const caja = document.createElement('div')
  caja.innerHTML = franjaHtml(a)
  const franja = caja.firstElementChild
  const navbar = document.querySelector('.navbar') || document.querySelector('nav')
  if (navbar?.parentNode) navbar.after(franja)
  else document.body.prepend(franja)
  franja.addEventListener('click', (e) => {
    if (e.target.closest('.aviso-global-cerrar')) {
      franja.remove()
      apuntarEn(CERRADOS, huellaDeAviso(a))
      return contar(a, 'cerrado')
    }
    if (e.target.closest('[data-aviso-clic]')) return contar(a, 'clic')
    // «Me apunto» y, en el móvil (sin botón), tocar la franja: el pop-up.
    if (e.target.closest('[data-abrir-aviso]') || matchMedia('(max-width: 760px)').matches) {
      e.preventDefault()
      abrirAviso(a)
    }
  })
}

function pintarTarjeta(a) {
  const sitio = document.querySelector('#panelPortada .portada-principal')
  if (!sitio || document.getElementById('avisoPortada')) return
  const caja = document.createElement('section')
  caja.id = 'avisoPortada'
  caja.innerHTML = tarjetaHtml(a)
  sitio.prepend(caja)
  caja.addEventListener('click', (e) => {
    if (e.target.closest('[data-aviso-clic]')) return contar(a, 'clic')
    if (e.target.closest('[data-abrir-aviso]')) {
      e.preventDefault()
      abrirAviso(a)
    }
  })
}

// El pop-up que toca solo: uno por visita, el más nuevo que no hayas visto,
// nunca encima de otra ventana ni mientras Chrome solo prepara la página
// (985), ni a un navegador automático (las pruebas lo piden con ?aviso=).
async function popupSolo(lista) {
  const a = elegir(lista, 'popup', { vistos: conjunto(VISTOS) })
  if (!a || navigator.webdriver) return
  if (/^\/(auth|alta-tienda|admin)/.test(location.pathname)) return
  if (document.prerendering) await new Promise((r) => document.addEventListener('prerenderingchange', r, { once: true }))
  await new Promise((r) => setTimeout(r, 1200))
  if (document.querySelector('dialog:modal, dialog[open]')) return
  apuntarEn(VISTOS, huellaDeAviso(a))
  abrirAviso(a)
}

export async function pintarAvisoGlobal() {
  try {
    const [todos, ctx] = await Promise.all([avisosEnMarcha(), contexto()])
    const lista = todos.filter((a) => seVeAviso(a, ctx))
    // `?aviso=<id>` (el enlace de la campanita) lo abre aunque ya lo vieras.
    const pedidoId = new URLSearchParams(location.search).get('aviso')
    const pedidoAviso = pedidoId && todos.find((a) => a.id === pedidoId)
    if (!lista.length && !pedidoAviso) return
    // Su hoja solo la baja quien ve uno (1120: salió de components.css).
    await hojaInyectada('css/aviso-global.css')
    const vistos = new Set()
    const franja = elegir(lista, 'franja')
    if (franja && !conjunto(CERRADOS).has(huellaDeAviso(franja))) {
      pintarFranja(franja)
      vistos.add(franja)
    }
    const enInicio = /^\/(index(\.html)?)?$/.test(location.pathname) && elegir(lista, 'inicio')
    if (enInicio) {
      pintarTarjeta(enInicio)
      vistos.add(enInicio)
    }
    for (const a of vistos) contar(a, 'visto')
    if (vistos.size) ponerReloj()
    if (pedidoAviso) {
      apuntarEn(VISTOS, huellaDeAviso(pedidoAviso))
      return abrirAviso(pedidoAviso)
    }
    popupSolo(lista)
  } catch {
    // El aviso jamás puede tumbar una página.
  }
}
