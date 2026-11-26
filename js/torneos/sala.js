// La sala de espera de un torneo (1397, «PokeDoc en modo app», T1; PINGU:
// «más tipo aplicación… pantallas grandes y no demasiado texto»). Antes de
// empezar, Info era una ficha: el día en una caja, cuatro chapas de texto y
// una barra de plazas con su frase. Ahora es la sala de un juego: el cartel
// con la mascota, la cuenta atrás en tres losas, quién está dentro con sus
// caras y el formato en cuatro losas de icono y número. Desde la 1465, de un
// vistazo: el día, el sitio y la sala en una fila, y el formato en una tira
// (el nombre y la cuenta atrás ya los dice la cabecera).
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

// El formato, en una TIRA de pastillas (1465): rondas, suizo o corte,
// minutos, BO y, si hace falta, el código. Antes eran cuatro losas altas.
function pastillasDeFormato(t) {
  const liga = t.format === 'league'
  const n = Array.isArray(t.matchday_dates) ? t.matchday_dates.length : 0
  return [
    liga ? [icons.calendar(15), n || '—', n === 1 ? 'jornada' : 'jornadas'] : [icons.layers(15), t.swiss_rounds ?? '—', 'rondas'],
    t.top_cut_size ? [icons.trophy(15), `Top ${t.top_cut_size}`, 'al final'] : [icons.trophy(15), 'Suizo', 'sin corte'],
    [icons.clock(15), `${t.round_time_minutes ?? 30}′`, 'por ronda'],
    [icons.zap ? icons.zap(15) : icons.clock(15), `BO${t.swiss_bo ?? 1}`, ''],
    ...(t.is_private ? [[icons.lock(15), 'Con código', '']] : []),
  ]
}

const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

// La sala de antes de empezar (1465, propuesta «Campeones y ficha», PINGU:
// «hay demasiado espacio para enseñar lo que hay que enseñar… es como
// demasiado lista»). Era un cartel con el nombre (que ya está en la
// cabecera), la cuenta atrás en tres losas (que ya está en la cabecera),
// la sala y cuatro losas: nueve bloques uno debajo de otro. Ahora es una
// FILA de tres —el día, el sitio y quién hay— y el formato en una tira.
// `gente`: los inscritos activos, cada uno `{ perfil }`.
export function salaHtml(t, gente = [], ahora = Date.now()) {
  const ms = Date.parse(t.start_at || '')
  const f = Number.isFinite(ms) ? new Date(ms) : null
  const tipo = t.format === 'league' ? 'liga' : t.modalidad === 'presencial' ? 'persona' : 'online'
  // El día del torneo (1469) la losa dice «Hoy» y lleva el color de lo vivo.
  const hoy = f && f.toDateString() === new Date(ahora).toDateString() && ms > ahora
  const dia = f
    ? `<div class="sala-dia${hoy ? ' hoy' : ''}" data-tipo-torneo="${tipo}"><small>${hoy ? 'Hoy' : DIA[f.getDay()]}</small><b>${f.getDate()}</b><span>${escapeHtml(f.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''))} · ${escapeHtml(f.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))}</span></div>`
    : `<div class="sala-dia" data-tipo-torneo="${tipo}"><small>Fecha</small><b>—</b><span>por decidir</span></div>`
  // Dónde: en persona, el sitio con «Cómo llegar»; online, TCG Live.
  const destino = [t.lugar, t.direccion].filter(Boolean).join(', ')
  const sitio = t.modalidad === 'presencial'
    ? `<div class="sala-sitio" data-tipo-torneo="persona"><small class="sala-ceja">${icons.mapPin(13)} En persona</small><b>${escapeHtml(t.lugar || 'Sitio por decidir')}</b>${t.direccion ? `<span>${escapeHtml(t.direccion)}</span>` : ''}${destino ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destino)}" target="_blank" rel="noopener">Cómo llegar →</a>` : ''}</div>`
    : `<div class="sala-sitio" data-tipo-torneo="online"><small class="sala-ceja">${icons.globe(13)} Online</small><b>TCG Live</b><span>${t.is_private ? 'Se entra con código' : 'Juegas desde casa'}</span></div>`
  const total = t.max_players ?? null
  const caras = gente.slice(0, 5).map((g) => caraHtml(g.perfil, g.perfil?.username)).join('')
  const mas = gente.length > 5 ? `<span class="sala-cara-mas">+${gente.length - 5}</span>` : ''
  const parte = total ? Math.min(100, (gente.length / total) * 100) : 0
  const quedan = total ? Math.max(0, total - gente.length) : null
  return `
    <div class="sala-tres">
      ${dia}
      ${sitio}
      <div class="sala-gente">
        <span class="sala-caras">${caras}${mas}</span>
        <span class="sala-gente-texto"><b>${total ? `${gente.length}/${total}` : gente.length} en la sala</b><small>${total ? (quedan ? `quedan ${quedan}` : 'completo') : 'sin límite de plazas'}</small>${total ? `<span class="sala-barra" aria-hidden="true"><i style="width:${parte.toFixed(0)}%"></i></span>` : ''}</span>
      </div>
    </div>
    <div class="sala-tira">${pastillasDeFormato(t)
      .map(([ico, n, rot]) => `<span class="sala-pastilla">${ico}<b>${escapeHtml(String(n))}</b>${rot ? `<small>${escapeHtml(rot)}</small>` : ''}</span>`)
      .join('')}</div>`
}

// Pinta (o quita) la sala en #torneoInfoCaja y deja la cuenta atrás andando.
export function montarSala(caja, t, gente) {
  if (!caja) return
  let sala = caja.querySelector('.torneo-sala')
  const toca = ANTES_DE_EMPEZAR.has(t?.status)
  caja.classList.toggle('con-sala', toca)
  if (!toca) {
    sala?.remove()
    return
  }
  if (!sala) {
    sala = document.createElement('div')
    sala.className = 'torneo-sala'
    caja.prepend(sala)
  }
  const html = salaHtml(t, gente)
  if (sala.dataset.clave !== html) {
    sala.innerHTML = html
    sala.dataset.clave = html
  }
}

// «Tu plaza» como misiones (1397, T2 y T4): inscrito, tu lista y «¡Estoy!»
// (confirmar la participación, el check-in de antes de la R1). La hecha en
// verde, la que toca brillando y la que aún no se puede con candado. El botón
// de confirmar conserva su id (`btnConfirmarParticipacion`): el manejador de
// torneo.js es el mismo. Puro.
export function misionesHtml({ tcg = '', listaHecha = false, confirmado = false, enPersona = false, conPuerta = false, dentro = false }) {
  // En persona con puerta (1453) el tercer paso no es «¡Estoy!» sino entrar por
  // la puerta con tu QR, y la lista ya no te deja fuera.
  if (conPuerta) confirmado = dentro
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
      ${mision('hecha', icons.checkCircle(20), 'Inscrito', enPersona ? 'tienes plaza (en persona no hace falta TCG Live)' : `como ${escapeHtml(tcg || '—')} <button type="button" class="link-btn sala-cambiar" id="btnEditarTcg">Cambiar</button>`)}
      ${listaHecha
        ? mision('hecha', icons.checkCircle(20), 'Lista entregada', 'puedes cambiarla hasta la ronda 1', '<button type="button" class="link-btn" data-abrir-lista>Ver</button>')
        : mision('toca', icons.layers(20), 'Manda tu lista', conPuerta ? 'la ve el juez y cuenta en los mazos del torneo' : 'sin ella no juegas', '<button type="button" class="btn-primary sala-mision-boton" data-abrir-lista>Elegir mazo</button>')}
      ${conPuerta
        ? confirmado
          ? mision('hecha', icons.checkCircle(20), '¡Dentro!', 'has pasado por la puerta: juegas la ronda 1')
          : mision('toca', icons.mapPin(20), 'Entra por la puerta', 'enseña el QR de tu entrada al llegar; sin entrar no juegas')
        : confirmado
        ? mision('hecha', icons.checkCircle(20), '¡Estás!', 'entras en el pareo de la ronda 1')
        : listaHecha
          ? mision('toca', icons.zap ? icons.zap(20) : icons.checkCircle(20), 'Confirma que juegas', 'sin esto no te emparejan')
          : mision('cerrada', icons.lock(20), 'Confirma que juegas', 'se abre al mandar tu lista')}
    </ol>
    ${listaHecha && !confirmado && !conPuerta ? `<button type="button" class="sala-estoy" id="btnConfirmarParticipacion"><span>¡ESTOY!<small>toca para confirmar</small></span></button>` : ''}`
}
