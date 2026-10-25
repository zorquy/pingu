// Los retos en la portada (tanda 843): la ficha de arriba y el bloque de la
// derecha hablan de los SEIS retos, no solo del de preguntas. PINGU: «arriba
// está el reto del día… te lleva a la pantalla de todos los retos, no
// solamente el reto de preguntas».
//
// Lo de hoy sale de la base (`retos_mis_numeros`, la 835) y, si no está, del
// navegador (las claves de cada juego en `RETOS[].local`), como en /retos.
// El cuestionario («El reto de hoy») ya no es uno de los seis (989).
// Sin importar gamification.js ni retos-datos.js: la portada tiene
// presupuesto de peso y aquí solo se lee.
import { supabase } from './supabase.js'
import { icons } from './icons.js'
// Sin app.js: `hoy.js` importa este módulo, y app.js monta la barra al cargarse.
import { escapeHtml } from './html.js'
import { RETOS, resumenLocal, resumenDeBase } from './retos-xp.js'
import { hojaInyectada } from './hoja.js'

// Su hoja, que la portada no baja hasta que hay sesión (el peso de la 170).
export const hoja = typeof document !== 'undefined' ? hojaInyectada('css/portada-retos.css') : Promise.resolve()

const icono = (n, t = 16) => icons[n]?.(t) || ''
const hoyUTC = () => new Date().toISOString().slice(0, 10)
const leer = (clave) => { try { return JSON.parse(localStorage.getItem(clave) || 'null') } catch { return null } }

let pedido = null
// Lo de hoy, una vez por visita (lo piden la ficha y el bloque a la vez).
// Con `numeros` (los de `retos_mis_numeros` que ya trajo `portada_hoy`, la
// 1017) no se pide nada; sin ellos (`undefined`), se piden.
export function estadoDeHoy(uid, numeros) {
  if (!pedido) pedido = (numeros !== undefined ? Promise.resolve(resumenDelDia(numeros, hoyUTC(), (clave) => leer(clave))) : cargar(uid)).catch(() => null)
  return pedido
}

async function cargar(uid) {
  const dia = hoyUTC()
  const numeros = uid ? await supabase.rpc('retos_mis_numeros', { p_dias: 7 }).then(({ data, error }) => (error ? null : data || null)) : null
  return resumenDelDia(numeros, dia, (clave) => leer(clave))
}

// Puro: qué retos llevas hoy, cuánta XP y tu racha.
export function resumenDelDia(numeros, dia, leerLocal = () => null) {
  const hechos = new Set()
  let xp = numeros?.xpHoy ?? 0
  for (const r of RETOS) {
    const base = resumenDeBase(r.juego, numeros?.hoy?.[r.juego])
    const local = r.local ? resumenLocal(r.juego, leerLocal(r.local), dia) : null
    if (base?.hecho || local?.hecho) hechos.add(r.juego)
    if (!numeros && local?.hecho) xp += local.xp || 0
  }
  const siguiente = RETOS.find((r) => !hechos.has(r.juego)) || null
  return { hechos, total: RETOS.length, xp, racha: numeros?.racha || 0, siguiente }
}

const horasHastaMañana = () => {
  const d = new Date()
  return Math.max(1, Math.ceil((new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d) / 3600e3))
}

// La ficha de arriba: «Retos de hoy · 2/6».
export function fichaRetosHtml(e) {
  const n = e ? e.hechos.size : 0
  const total = e?.total || RETOS.length
  // Corto (1012, P2): «Seis retos · quedan 7 h» se cortaba a dos columnas, y
  // los seis ya los dice el anillo.
  const sub = !e ? `quedan ${horasHastaMañana()} h` : n >= total ? '¡Día perfecto!' : n ? `${e.xp ? `+${e.xp} XP · ` : ''}te ${total - n === 1 ? 'queda 1' : `quedan ${total - n}`}` : `quedan ${horasHastaMañana()} h`
  return `<a class="hoy-ficha hoy-retos${n >= total ? ' hoy-hecho' : ' hoy-destaca'}" href="/retos" aria-label="${escapeHtml(`Retos de hoy: ${n} de ${total}. ${sub}`)}">
    <span class="hoy-retos-anillo" style="--lleno:${Math.round((n / total) * 360)}deg" aria-hidden="true"><strong>${n}/${total}</strong></span>
    <b>Retos de hoy</b><span>${escapeHtml(sub)}</span>
  </a>`
}

// Quien llama pone las caras (home.js tiene `avatarStyle` de app.js); sin
// ellas, la inicial a secas.
function caraSencilla(p) {
  const nombre = p?.display_name || p?.username || '?'
  return `<span class="tr-cara" title="${escapeHtml(nombre)}">${escapeHtml(nombre.charAt(0).toUpperCase())}</span>`
}

// El bloque de la derecha: los seis, tus XP y racha, el siguiente y la gente.
export function bloqueRetosHtml(e, comunidad = null, repaso = '', cara = caraSencilla) {
  const n = e.hechos.size
  const perfecto = n >= e.total
  const casillas = RETOS.map((r) => `<a class="tr-casilla${e.hechos.has(r.juego) ? ' hecha' : ''}" href="${r.ruta}" aria-label="${escapeHtml(`${r.titulo}: ${e.hechos.has(r.juego) ? 'hecho' : 'sin hacer'}`)}">${icono(r.icono, 20)}</a>`).join('')
  const chips = [
    e.xp ? `<span class="tr-chip">${icono('zap', 12)} +${e.xp} XP hoy</span>` : '',
    e.racha > 1 ? `<span class="tr-chip">${icono('flame', 12)} ${e.racha} días seguidos</span>` : '',
    `<span class="tr-chip">${perfecto ? 'Mañana, más' : `Quedan ${horasHastaMañana()} h`}</span>`,
  ].join('')
  const s = e.siguiente
  const siguiente = s
    ? `<div class="tr-siguiente"><span class="tr-sig-icono" style="background:var(--arte-${s.arte})" aria-hidden="true">${icono(s.icono, 20)}</span><div><small>${n ? 'El siguiente' : 'Empieza por'}</small><b>${escapeHtml(s.titulo)}</b><small>${escapeHtml(s.chips.join(' · '))}</small></div><a class="btn-primary tr-jugar" href="${s.ruta}">Jugar</a></div>`
    : `<div class="tr-siguiente"><span class="tr-sig-icono" style="background:var(--arte-verde)" aria-hidden="true">${icono('trophy', 20)}</span><div><b>¡Día perfecto!</b><small>Los seis retos de hoy. Mañana hay más.</small></div><a class="btn-secondary tr-jugar" href="/retos">Ver</a></div>`
  const gente = comunidad?.jugadores
    ? `<a class="tr-gente" href="/retos"><span class="tr-caras">${(comunidad.caras || []).slice(0, 4).map(cara).join('')}</span><span><b>${comunidad.jugadores} ${comunidad.jugadores === 1 ? 'persona' : 'personas'}</b> ${comunidad.jugadores === 1 ? 'ha' : 'han'} jugado hoy</span></a>`
    : ''
  return `<div class="tr-bloque${perfecto ? ' perfecto' : ''}">
    <div class="tr-cabeza">
      <span class="tr-rotulo">${icono('flame', 14)} Tus retos de hoy</span>
      <strong class="tr-titular">${perfecto ? '¡Los seis hechos!' : `${n} de ${e.total} hechos`}</strong>
      <div class="tr-casillas">${casillas}</div>
      <div class="tr-chips">${chips}</div>
    </div>
    <div class="tr-cuerpo">${siguiente}${gente}${repaso}</div>
  </div>`
}

export async function comunidadDeHoy() {
  const { data, error } = await supabase.rpc('retos_comunidad', { p_dia: hoyUTC() })
  return error ? null : data || null
}
