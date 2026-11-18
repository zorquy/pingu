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
