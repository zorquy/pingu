// La sala de espera de un torneo (1397, «PokeDoc en modo app», T1; PINGU:
// «más tipo aplicación… pantallas grandes y no demasiado texto»). Antes de
// empezar, Info era una ficha: el día en una caja, cuatro chapas de texto y
// una barra de plazas con su frase. Ahora es la sala de un juego: el cartel
// con la mascota, la cuenta atrás en tres losas, quién está dentro con sus
// caras y el formato en cuatro losas de icono y número.
//
// Puro salvo `montarSala` (lo prueba node con `salaHtml`). Las piezas viejas
// (#torneoCuando, #torneoFormato, .torneo-plazas) siguen en el HTML: el CSS
// las esconde con `.con-sala` y vuelven en cuanto el torneo empieza.
import { escapeHtml } from '../html.js'
import { icons } from '../icons.js'
import { caraHtml } from './caras.js'

export const ANTES_DE_EMPEZAR = new Set(['draft', 'registration_open', 'registration_closed'])

// Días, horas y minutos que faltan; null si ya pasó o no hay fecha.
export function cuentaAtras(fecha, ahora = Date.now()) {
  const ms = Date.parse(fecha || '') - ahora
  if (!Number.isFinite(ms) || ms <= 0) return null
  const min = Math.floor(ms / 60000)
  return { d: Math.floor(min / 1440), h: Math.floor((min % 1440) / 60), m: min % 60 }
}

const dos = (n) => String(n).padStart(2, '0')

function losasDeFormato(t) {
  const liga = t.format === 'league'
  const n = Array.isArray(t.matchday_dates) ? t.matchday_dates.length : 0
  return [
    liga ? [icons.calendar(18), n || '—', n === 1 ? 'jornada' : 'jornadas'] : [icons.layers(18), t.swiss_rounds ?? '—', 'rondas'],
    t.top_cut_size ? [icons.trophy(18), `Top ${t.top_cut_size}`, 'al final'] : [icons.trophy(18), 'Suizo', 'sin corte'],
    [icons.clock(18), `${t.round_time_minutes ?? 30}′`, 'por ronda'],
    [icons.zap ? icons.zap(18) : icons.clock(18), `BO${t.swiss_bo ?? 1}`, 'partidas'],
  ]
}

// `gente`: los inscritos activos, cada uno `{ perfil }`. `yo`: tu id.
export function salaHtml(t, gente = [], { ahora = Date.now() } = {}) {
  const c = cuentaAtras(t.start_at, ahora)
  const dia = Date.parse(t.start_at || '')
  const cuando = Number.isFinite(dia)
    ? new Date(dia).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '') +
      ' · ' + new Date(dia).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : 'Fecha por decidir'
  const ceja = [t.format === 'league' ? 'Liga' : 'Suizo', t.is_private ? 'Con código' : 'Abierto', 'Online'].join(' · ')
  const total = t.max_players ?? null
  const caras = gente.slice(0, 5).map((g) => caraHtml(g.perfil, g.perfil?.username)).join('')
  const mas = gente.length > 5 ? `<span class="sala-cara-mas">+${gente.length - 5}</span>` : ''
  const parte = total ? Math.min(100, (gente.length / total) * 100) : 0
  return `
    <div class="sala-cartel">
      <span class="sala-brillo" aria-hidden="true"></span>
      <small class="sala-ceja">${escapeHtml(ceja.toUpperCase())}</small>
      <strong class="sala-nombre">${escapeHtml(t.name || 'Torneo')}</strong>
      <span class="sala-cuando">${escapeHtml(cuando)}</span>
      <span class="sala-mascota mascota-3d" data-mascota="saludar" data-sin-globo aria-hidden="true"></span>
    </div>
    ${c ? `<div class="sala-cuenta" role="timer" aria-label="${escapeHtml(`Empieza en ${c.d} días, ${c.h} horas y ${c.m} minutos`)}" data-sala-cuenta>
      <div><b data-d>${dos(c.d)}</b><small>${c.d === 1 ? 'DÍA' : 'DÍAS'}</small></div>
      <div><b data-h>${dos(c.h)}</b><small>HORAS</small></div>
      <div><b data-m>${dos(c.m)}</b><small>MIN</small></div>
    </div>` : ''}
    <div class="sala-gente">
      <span class="sala-caras">${caras}${mas}</span>
      <span class="sala-gente-texto"><b>${total ? `${gente.length}/${total}` : gente.length} en la sala</b>${total ? `<span class="sala-barra" aria-hidden="true"><i style="width:${parte.toFixed(0)}%"></i></span>` : '<small>sin límite de plazas</small>'}</span>
    </div>
    <div class="sala-losas">${losasDeFormato(t)
      .map(([ico, n, rot]) => `<div class="sala-losa">${ico}<b>${escapeHtml(String(n))}</b><small>${escapeHtml(rot)}</small></div>`)
      .join('')}</div>`
}

// Pinta (o quita) la sala en #torneoInfoCaja y deja la cuenta atrás andando.
let reloj = null
export function montarSala(caja, t, gente) {
  if (!caja) return
  let sala = caja.querySelector('.torneo-sala')
  const toca = ANTES_DE_EMPEZAR.has(t?.status)
  caja.classList.toggle('con-sala', toca)
  if (!toca) {
    sala?.remove()
    if (reloj) clearInterval(reloj)
    reloj = null
    return
  }
  if (!sala) {
    sala = document.createElement('div')
    sala.className = 'torneo-sala'
    caja.prepend(sala)
  }
  const html = salaHtml(t, gente)
  // Solo se repinta si cambia algo más que los números (la mascota no
  // se monta dos veces): los números los mueve el reloj.
  const clave = html.replace(/<b data-[dhm]>\d+<\/b>/g, '')
  if (sala.dataset.clave !== clave) {
    sala.innerHTML = html
    sala.dataset.clave = clave
  }
  if (reloj) clearInterval(reloj)
  reloj = setInterval(() => {
    const c = cuentaAtras(t.start_at)
    const caja = sala.querySelector('[data-sala-cuenta]')
    if (!c || !caja) return
    for (const k of ['d', 'h', 'm']) {
      const b = caja.querySelector(`[data-${k}]`)
      if (b && b.textContent !== dos(c[k])) b.textContent = dos(c[k])
    }
  }, 20000)
}

// «Tu plaza» como misiones (1397, T2 y T4): inscrito, tu lista y «¡Estoy!»
// (confirmar la participación, el check-in de antes de la R1). La hecha en
// verde, la que toca brillando y la que aún no se puede con candado. El botón
// de confirmar conserva su id (`btnConfirmarParticipacion`): el manejador de
// torneo.js es el mismo. Puro.
export function misionesHtml({ tcg = '', listaHecha = false, confirmado = false }) {
  const hechas = 1 + (listaHecha ? 1 : 0) + (confirmado ? 1 : 0)
  const mision = (estado, icono, titulo, sub, extra = '') => `
    <li class="sala-mision ${estado}">
      <span class="sala-mision-ico">${icono}</span>
      <span class="sala-mision-texto"><b>${titulo}</b><small>${sub}</small></span>
      ${extra}
    </li>`
  const listo = hechas === 3
  return `
    <div class="sala-misiones-cab">
      <span class="sala-anillo" style="--p:${Math.round((hechas / 3) * 100)}"><b>${hechas}/3</b></span>
      <span><small class="sala-ceja">TUS MISIONES</small><strong>${listo ? '¡Todo listo!' : `Te ${3 - hechas === 1 ? 'falta 1' : `faltan ${3 - hechas}`}`}</strong></span>
    </div>
    <ol class="sala-misiones">
      ${mision('hecha', icons.checkCircle(20), 'Inscrito', `como ${escapeHtml(tcg || '—')} <button type="button" class="link-btn sala-cambiar" id="btnEditarTcg">Cambiar</button>`)}
      ${listaHecha
        ? mision('hecha', icons.checkCircle(20), 'Lista entregada', 'puedes cambiarla hasta la ronda 1', '<button type="button" class="link-btn" data-abrir-lista>Ver</button>')
        : mision('toca', icons.layers(20), 'Manda tu lista', 'sin ella no juegas', '<button type="button" class="btn-primary sala-mision-boton" data-abrir-lista>Elegir mazo</button>')}
      ${confirmado
        ? mision('hecha', icons.checkCircle(20), '¡Estás!', 'entras en el pareo de la ronda 1')
        : listaHecha
          ? mision('toca', icons.zap ? icons.zap(20) : icons.checkCircle(20), 'Confirma que juegas', 'sin esto no te emparejan')
          : mision('cerrada', icons.lock(20), 'Confirma que juegas', 'se abre al mandar tu lista')}
    </ol>
    ${listaHecha && !confirmado ? `<button type="button" class="sala-estoy" id="btnConfirmarParticipacion"><span>¡ESTOY!<small>toca para confirmar</small></span></button>` : ''}`
}
