// La celebración de una ronda (1391, «Torneos en modo juego», D2: «pantalla
// entera con la mascota»). Cuando TU mesa se cierra (los dos reportes
// casan, o lo resuelve un juez), sale una vez: «¡VICTORIA!» con confeti y la
// mascota contenta, «Derrota» con la mascota triste y «la siguiente es
// tuya», o «Empate». Con los puntos que suma y cuánto subes o bajas.
//
// Una vez por mesa y por navegador (`pd-celebrada-<id>`): volver a la ficha
// no la repite. Un bye no se celebra (no se ha jugado). Un toque la cierra;
// con «menos movimiento», sin confeti.
import { escapeHtml } from '../html.js'
import { icons } from '../icons.js'

const LLAVE = (id) => `pd-celebrada-${id}`

export function yaCelebrada(matchId) {
  try { return localStorage.getItem(LLAVE(matchId)) === '1' } catch { return true }
}

const TEXTO = {
  V: { titulo: '¡VICTORIA!', clase: 'gana', gesto: 'contento', pie: '' },
  D: { titulo: 'Derrota', clase: 'pierde', gesto: 'triste', pie: 'La siguiente es tuya.' },
  E: { titulo: 'Empate', clase: 'empata', gesto: 'guino', pie: '' },
}

// res: 'V' | 'D' | 'E'. puesto/antes: números (antes puede faltar).
export function celebrarRonda({ matchId, res, rival = '', marcador = '', ronda = '', puntos = 0, puesto = null, antes = null, de = null }) {
  const t = TEXTO[res]
  if (!t || !matchId || yaCelebrada(matchId)) return null
  try { localStorage.setItem(LLAVE(matchId), '1') } catch {}
  const sube = puesto && antes ? antes - puesto : 0
  const flecha = sube > 0 ? `▲ subes ${sube}` : sube < 0 ? `▼ bajas ${-sube}` : de ? `de ${de}` : ''
  const d = document.createElement('dialog')
  d.className = `torneo-celebra torneo-celebra-${t.clase}`
  d.setAttribute('aria-labelledby', 'torneoCelebraTitulo')
  d.innerHTML = `
    <div class="torneo-celebra-caja">
      <span class="torneo-celebra-mascota mascota-3d" data-mascota="${t.gesto}" data-sin-globo></span>
      ${ronda ? `<small class="torneo-celebra-ronda">${escapeHtml(ronda.toUpperCase())}</small>` : ''}
      <h2 class="torneo-celebra-titulo" id="torneoCelebraTitulo">${t.titulo}</h2>
      <p class="torneo-celebra-marca">${escapeHtml([marcador, rival ? `contra ${rival}` : ''].filter(Boolean).join(' '))}${t.pie ? ` · ${t.pie}` : ''}</p>
      <div class="torneo-celebra-cifras">
        <span><b>+${puntos}</b><small>${puntos === 1 ? 'punto' : 'puntos'}</small></span>
        ${puesto ? `<span><b>${puesto}º</b><small>${escapeHtml(flecha)}</small></span>` : ''}
      </div>
      <button type="button" class="btn-primary torneo-celebra-seguir" data-cerrar>Seguir</button>
    </div>`
  document.body.appendChild(d)
  const cerrar = () => { d.close(); d.remove() }
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) cerrar() })
  d.addEventListener('cancel', (e) => { e.preventDefault(); cerrar() })
  d.showModal()
  d.querySelector('[data-cerrar]')?.focus()
  if (res === 'V') import('../app.js').then(({ burstConfetti }) => burstConfetti?.(60)).catch(() => {})
  return d
}

// El final (1394, «Torneos en modo juego»): si acabas en el podio de un torneo
// que se acaba de cerrar, la pantalla entera UNA vez por torneo y navegador
// (`pd-campeon-<id>`): campeón con trofeo, confeti y la mascota bailando;
// finalista o semifinalista con su medalla y la mascota contenta.
const PUESTOS = ['¡CAMPEÓN!', '¡Finalista!', '¡Podio!', '¡Podio!']
export function celebrarFinal({ torneoId, puesto, nombre = '', jugadores = null, record = '' }) {
  const llave = `pd-campeon-${torneoId}`
  if (!torneoId || !puesto || puesto > 4) return null
  try { if (localStorage.getItem(llave) === '1') return null; localStorage.setItem(llave, '1') } catch { return null }
  const oro = puesto === 1
  const d = document.createElement('dialog')
  d.className = `torneo-celebra torneo-celebra-final${oro ? ' torneo-celebra-oro' : ''}`
  d.setAttribute('aria-labelledby', 'torneoFinalTitulo')
  d.innerHTML = `
    <div class="torneo-celebra-caja">
      <span class="torneo-celebra-mascota mascota-3d" data-mascota="${oro ? 'bailar' : 'contento'}" data-sin-globo></span>
      <span class="torneo-celebra-trofeo torneo-celebra-trofeo-${puesto}" aria-hidden="true">${oro ? icons.trophy(44) : icons.medal(40)}</span>
      <small class="torneo-celebra-ronda">${escapeHtml(nombre.toUpperCase())}</small>
      <h2 class="torneo-celebra-titulo" id="torneoFinalTitulo">${PUESTOS[puesto - 1]}</h2>
      <div class="torneo-celebra-cifras">
        <span><b>${puesto}º</b><small>${jugadores ? `de ${jugadores}` : 'puesto'}</small></span>
        ${record ? `<span><b>${escapeHtml(record)}</b><small>V-D-E</small></span>` : ''}
      </div>
      <button type="button" class="btn-primary torneo-celebra-seguir" data-cerrar>Seguir</button>
    </div>`
  document.body.appendChild(d)
  const cerrar = () => { d.close(); d.remove() }
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) cerrar() })
  d.addEventListener('cancel', (e) => { e.preventDefault(); cerrar() })
  d.showModal()
  d.querySelector('[data-cerrar]')?.focus()
  import('../app.js').then(({ burstConfetti }) => burstConfetti?.(oro ? 120 : 50)).catch(() => {})
  return d
}

// La entrada a cada ronda (1402, «El torneo, más sencillo», T4; PINGU eligió
// que salga en TODAS): «¡RONDA 2!», las dos caras con el VS, la mesa, el
// tiempo y el TCG Live del rival, y «¡A jugar!». Una vez por mesa y
// navegador (`pd-entrada-<id>`), y solo en los primeros minutos de la ronda:
// abrir la ficha a media partida no te para con un cartel, te deja en tu mesa.
// En Android vibra (no con «menos movimiento»).
const LLAVE_ENTRADA = (id) => `pd-entrada-${id}`
export const MINUTOS_DE_ENTRADA = 10

export function entrarEnRonda({ matchId, ceja = '', titulo, yo, rival, mesa = null, minutos = null, tcg = '' }) {
  if (!matchId || !titulo) return null
  try {
    if (localStorage.getItem(LLAVE_ENTRADA(matchId)) === '1') return null
    localStorage.setItem(LLAVE_ENTRADA(matchId), '1')
  } catch {
    return null
  }
  const cara = (p, quien) => `<span class="torneo-ronda-entra-jugador"><i style="background:${p.color}">${escapeHtml(p.inicial)}</i>${escapeHtml(quien)}</span>`
  const datos = [mesa ? `Mesa ${mesa}` : '', minutos ? `${minutos} minutos` : 'Sin límite de tiempo'].filter(Boolean).join(' · ')
  const d = document.createElement('dialog')
  d.className = 'torneo-ronda-entra'
  d.setAttribute('aria-labelledby', 'torneoRondaEntraTitulo')
  d.innerHTML = `
    <div class="torneo-ronda-entra-caja">
      ${ceja ? `<small class="torneo-ronda-entra-ceja">${escapeHtml(ceja.toUpperCase())}</small>` : ''}
      <h2 class="torneo-ronda-entra-titulo" id="torneoRondaEntraTitulo">${escapeHtml(titulo)}</h2>
      <div class="torneo-ronda-entra-caras">${cara(yo, 'Tú')}<b class="torneo-ronda-entra-vs" aria-label="contra">VS</b>${cara(rival, rival.nombre)}</div>
      <p class="torneo-ronda-entra-datos">${escapeHtml(datos)}${tcg ? ` · TCG Live: <b>${escapeHtml(tcg)}</b>` : ''}</p>
      <button type="button" class="torneo-ronda-entra-jugar" data-cerrar>¡A jugar!</button>
    </div>`
  document.body.appendChild(d)
  const cerrar = () => { d.close(); d.remove() }
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-cerrar]')) cerrar() })
  d.addEventListener('cancel', (e) => { e.preventDefault(); cerrar() })
  d.showModal()
  d.querySelector('[data-cerrar]')?.focus()
  if (!matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    try { navigator.vibrate?.([70, 50, 70]) } catch {}
  }
  return d
}
