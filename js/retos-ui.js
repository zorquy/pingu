// Las piezas de pantalla que comparten los retos diarios (tanda 835): la
// cuenta atrás, lo que has ganado y el reparto de intentos. Su CSS está en
// css/retos-juego.css. Sin Supabase: lo que se pinta llega ya calculado.
import { escapeHtml } from './html.js'
import { icons } from './icons.js'

// Lo que falta para el reto de mañana (medianoche UTC, como `numeroDelDia`).
export function hastaManana(ahora = new Date()) {
  const manana = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1)
  const s = Math.max(0, Math.floor((manana - ahora.getTime()) / 1000))
  const dos = (n) => String(n).padStart(2, '0')
  return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}:${dos(s % 60)}`
}

// Una cuenta atrás que se mueve sola. Devuelve cómo pararla.
export function cuentaAtras(caja, texto = 'La siguiente en') {
  if (!caja) return () => {}
  const pintar = () => { caja.innerHTML = `${icons.clock(14)} ${escapeHtml(texto)} <b>${hastaManana()}</b>` }
  pintar()
  const t = setInterval(pintar, 1000)
  return () => clearInterval(t)
}

// Lo ganado, según lo que contestó `guardarResultado` (js/retos-datos.js).
// `posible` es la XP que habría dado con cuenta; `volver`, a dónde volver
// tras registrarse.
export function premiosHtml(guardado, { posible = 0, volver = '/retos', racha = 0, rachaTexto = 'días seguidos' } = {}) {
  const premios = []
  if (guardado?.nuevo) {
    premios.push(`<div class="rj-premio xp"><b>+${guardado.xp || 0} XP</b><small>por el reto de hoy</small></div>`)
    if (guardado.perfecto) premios.push(`<div class="rj-premio xp"><b>+${guardado.xpPerfecto} XP</b><small>día perfecto</small></div>`)
    if (guardado.bonoRacha) premios.push(`<div class="rj-premio xp"><b>+${guardado.xpRacha} XP</b><small>${guardado.racha} días jugando</small></div>`)
  } else if (guardado?.nuevo === false) {
    premios.push(`<div class="rj-premio xp"><b>+${guardado.xp || 0} XP</b><small>ya contados hoy</small></div>`)
  } else if (guardado?.sinCuenta && posible > 0) {
    premios.push(`<div class="rj-premio"><b>+${posible} XP</b><small><a href="/auth.html?registro=1&amp;volver=${encodeURIComponent(volver)}">Crea tu cuenta</a> y cuentan</small></div>`)
  }
  if (racha >= 2) premios.push(`<div class="rj-premio racha"><b>${racha} días</b><small>${escapeHtml(rachaTexto)}</small></div>`)
  return premios.length ? `<div class="rj-premios">${premios.join('')}</div>` : ''
}

// El reparto: `cuentas` = { 1: n, 2: n… }; `tuyo` = la fila de hoy.
export function repartoHtml(cuentas, { filas = 6, tuyo = null } = {}) {
  const valores = Array.from({ length: filas }, (_, i) => Number(cuentas?.[i + 1]) || 0)
  const max = Math.max(1, ...valores)
  return `<div class="rj-reparto" aria-label="Tus partidas por intentos">${valores
    .map((n, i) => `<div class="rj-reparto-fila">${i + 1}<span class="rj-reparto-barra${tuyo === i + 1 ? ' tuyo' : ''}" style="width:${Math.max(8, Math.round((n / max) * 100))}%">${n}</span></div>`)
    .join('')}</div>`
}

// El % de la gente que lo ha acertado hoy, o nada con menos de cinco.
export function genteHtml(stats, texto = 'lo ha acertado') {
  const j = Number(stats?.jugadores) || 0
  if (j < 5) return ''
  return ` · hoy ${texto} el ${Math.round(((Number(stats.acertaron) || 0) / j) * 100)} % de la gente`
}

