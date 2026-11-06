// El POP-UP de un aviso del equipo (1260). Entra por import() desde
// js/aviso-global.js solo cuando hay que abrirlo: al entrar (una vez por
// persona), desde la franja o la tarjeta, o con `?aviso=<id>` (el enlace de
// la campanita). Centrado en el PC y hoja desde abajo en el móvil (1045).
//
// «Me apunto» (aviso_apuntarme) cambia el botón YA y deshace si la base dice
// que no (896). Sin cuenta, lleva a registrarse y vuelve aquí con el aviso
// abierto (`volver`).
import { supabase } from './supabase.js'
import { hojaInyectada } from './hoja.js'
import { popHtml } from './aviso-puro.js'
import { contar } from './aviso-global.js'

const n = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const fraseApuntados = (total, yo) => {
  if (!total) return ''
  if (yo) return total === 1 ? 'Eres el primero en apuntarte.' : `Ya sois ${n(total)} apuntados.`
  return total === 1 ? 'Ya se ha apuntado 1 persona.' : `Ya se han apuntado ${n(total)} personas.`
}

// La línea de debajo del botón ocupa su sitio desde el principio (vacía e
// invisible): si apareciera después, el pop-up crecería y dejaría de estar
// centrado (Chrome lo centra al abrir).
function ponerLinea(d, texto) {
  const linea = d.querySelector('[data-apuntados]')
  if (!linea) return
  linea.textContent = texto || '\u00a0'
  linea.setAttribute('aria-hidden', String(!texto))
}

function ponerHecho(boton, hecho) {
  boton.textContent = hecho ? '✓ Ya estás dentro' : 'Me apunto'
  boton.toggleAttribute('data-hecho', hecho)
  boton.disabled = hecho
}

async function participacion(d, a) {
  const { data } = await supabase.rpc('aviso_participacion', { p_aviso: a.id })
  if (!data) return
  const boton = d.querySelector('[data-apuntarme]')
  if (boton && data.yo) ponerHecho(boton, true)
  ponerLinea(d, fraseApuntados(data.total, data.yo))
}

async function apuntarme(d, a, boton) {
  contar(a, 'clic')
  const { data: s } = await supabase.auth.getSession()
  if (!s?.session) {
    const vuelta = `${location.pathname}?aviso=${encodeURIComponent(a.id)}`
    // Con el diálogo abierto, la transición entre páginas se aborta (y salta
    // un error): se cierra antes de irse.
    d.close()
    location.href = `/auth.html?registro=1&volver=${encodeURIComponent(vuelta)}`
    return
  }
  ponerHecho(boton, true)
  const { data, error } = await supabase.rpc('aviso_apuntarme', { p_aviso: a.id })
  if (error) {
    ponerHecho(boton, false)
    return ponerLinea(d, /terminado/.test(error.message) ? 'Este concurso ya ha terminado.' : /tienda/.test(error.message) ? 'Las cuentas de tienda no participan.' : 'No se ha podido apuntar. Prueba otra vez.')
  }
  ponerLinea(d, fraseApuntados(data?.total || 1, true))
}

export async function abrirPop(a) {
  await hojaInyectada('css/aviso-global.css')
  document.getElementById('avisoPop')?.remove()
  const d = document.createElement('dialog')
  d.id = 'avisoPop'
  d.className = 'aviso-pop'
  d.setAttribute('aria-labelledby', 'avisoPopTitulo')
  d.innerHTML = popHtml(a)
  document.body.appendChild(d)
  let hizoAlgo = false
  d.addEventListener('click', (e) => {
    // Tocar fuera (el fondo es el propio diálogo) también cierra.
    if (e.target === d || e.target.closest('[data-aviso-cerrar]')) return d.close()
    if (e.target.closest('[data-aviso-clic]')) {
      hizoAlgo = true
      contar(a, 'clic')
    }
    const boton = e.target.closest('[data-apuntarme]')
    if (boton && !boton.disabled) {
      hizoAlgo = true
      apuntarme(d, a, boton)
    }
  })
  d.addEventListener('close', () => {
    if (!hizoAlgo) contar(a, 'cerrado')
    d.remove()
    // Que «?aviso=» no lo vuelva a abrir al recargar.
    const u = new URL(location.href)
    if (u.searchParams.has('aviso')) {
      u.searchParams.delete('aviso')
      history.replaceState(history.state, '', u.pathname + u.search + u.hash)
    }
  })
  d.tabIndex = -1
  d.showModal()
  d.focus()
  contar(a, 'visto')
  if (a.participar) participacion(d, a)
  return d
}
