// La línea de la cabecera de una ficha de persona (867): nivel (una
// píldora con su barrita; tocarla abre la escalera), el rango de
// colaborador si lo hay (lo rellena quien cuenta las guías, en el hueco) y
// la racha. Lo comparten /perfil y /usuario; antes cada uno la escribía a
// su manera y la tuya llevaba además una barra de XP con «N XP para el
// siguiente nivel» que ya dice la píldora.
import { levelProgress, levelBadgeHtml } from './gamification.js'
import { barraDeRango } from './rango-barra.js'
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { avatarStyle, getInitial } from './app.js'

// La racha solo si la hay: un «0 días» no cuenta nada (como en la hoja «Tú»).
export function lineaDeQuienHtml({ xp = 0, racha = 0 } = {}) {
  const progress = levelProgress(xp)
  const dias = Number(racha) || 0
  return `
    <div class="perfil-chapas">
      <button type="button" class="profile-level" id="btnLevelInfo">${levelBadgeHtml(progress.level)} ${barraDeRango(xp)}</button>
      <span id="rangoHueco"></span>
      ${dias > 0 ? `<span class="perfil-racha">${icons.flame(14)} ${dias} ${dias === 1 ? 'día' : 'días'} de racha</span>` : ''}
    </div>`
}

// El medallero de los cursos para la pestaña Medallas: con las mismas chapas
// que la píldora de Aprender. Vacío (sin partidas) devuelve '' y no se pinta.
export function medalleroHtml(medallas) {
  const cuenta = { oro: 0, plata: 0, bronce: 0 }
  for (const m of Object.values(medallas || {})) if (m in cuenta) cuenta[m]++
  const jugados = cuenta.oro + cuenta.plata + cuenta.bronce
  if (!jugados) return ''
  const texto = `${cuenta.oro} ${cuenta.oro === 1 ? 'oro' : 'oros'}, ${cuenta.plata} ${cuenta.plata === 1 ? 'plata' : 'platas'} y ${cuenta.bronce} ${cuenta.bronce === 1 ? 'bronce' : 'bronces'} en ${jugados} ${jugados === 1 ? 'curso' : 'cursos'}`
  return `<a class="medallero" href="/aprender" aria-label="Medallero de los cursos: ${texto}">
    <span class="medallero-titulo">${icons.trophy(14)}</span>
    <span class="medalla-chip medalla-oro">${cuenta.oro}</span>
    <span class="medalla-chip medalla-plata">${cuenta.plata}</span>
    <span class="medalla-chip medalla-bronce">${cuenta.bronce}</span>
    <span class="medallero-restante">en ${jugados} ${jugados === 1 ? 'curso' : 'cursos'}</span>
  </a>`
}

// LOS SEGUIDORES EN CARAS (1270, PINGU eligió la recomendada: «quizá es más
// visual mostrar los seguidores y siguiendo aparte»): hasta tres caras, «N
// seguidores» y, si entre ellos hay gente que TÚ sigues, «entre ellos Ibai y
// Laura» (esa gente va primero, también en las caras). Pinta en los huecos que
// ya trae el HTML (los botones llevan su oyente desde el principio).
// `seguidores`: perfiles; `conocidos`: ids que sigue quien mira.
export function pintarSocial({ seguidores = [], siguiendo = 0, conocidos = new Set() } = {}) {
  const $ = (id) => document.getElementById(id)
  const n = seguidores.length
  const nombre = (p) => p.display_name || p.username || 'Alguien'
  const orden = [...seguidores.filter((p) => conocidos.has(p.id)), ...seguidores.filter((p) => !conocidos.has(p.id))]
  if ($('followersCount')) $('followersCount').textContent = n.toLocaleString('es-ES')
  if ($('followingCount')) $('followingCount').textContent = Number(siguiendo || 0).toLocaleString('es-ES')
  if ($('seguidoresRotulo')) $('seguidoresRotulo').textContent = n === 1 ? 'seguidor' : 'seguidores'
  const caras = $('seguidoresCaras')
  if (caras) caras.innerHTML = orden.slice(0, 3).map((p) => `<span class="mini-avatar" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre(p)))}</span>`).join('')
  const suyos = orden.filter((p) => conocidos.has(p.id)).slice(0, 2).map((p) => `<b>${escapeHtml(nombre(p))}</b>`)
  if ($('seguidoresConocidos')) $('seguidoresConocidos').innerHTML = suyos.length ? `, entre ellos ${suyos.join(' y ')}` : ''
}
