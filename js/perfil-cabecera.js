// LA CABECERA DE UNA FICHA DE PERSONA (1273, PINGU eligió la «A · Cabecera
// ancha»: «la descripción, la exp y esas cosas están fuera de lugar»). Debajo
// del nombre, una FRANJA de progreso con sus celdas: el nivel con la barra
// entera y lo que falta (antes «9.995 de 10.000 XP para Alto Mando» partido en
// 320 px), la racha, los logros y los seguidores. Lo comparten /perfil y
// /usuario: las celdas están en el HTML y esto las rellena.
import { levelProgress, levelBadgeHtml, LEVEL_THRESHOLDS } from './gamification.js'
import { milesXp } from './niveles.js'
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { avatarStyle, getInitial, profileUrl } from './app.js'
import { abrirPestania } from './perfil-pestanias.js'

// Puro: el botón del nivel (tocarlo abre la escalera, `btnLevelInfo`).
export function nivelDeFranjaHtml(xp = 0) {
  const p = levelProgress(Number(xp) || 0)
  const i = LEVEL_THRESHOLDS.findIndex((l) => l.level === p.level)
  const sig = LEVEL_THRESHOLDS[i + 1]
  const cifra = sig ? `${milesXp(xp)} / ${milesXp(sig.min)} XP` : `${milesXp(xp)} XP`
  const falta = sig ? `${milesXp(sig.min - xp)} XP para ${sig.level}` : 'Nivel máximo'
  return `<button type="button" class="pf-nivel-btn" id="btnLevelInfo" title="Ver los niveles">
      <span class="pf-rotulo">Nivel</span>
      <span class="pf-nivel-l">${levelBadgeHtml(p.level)}<b>${cifra}</b><span class="pf-falta">${escapeHtml(falta)}</span></span>
      <span class="pf-barra" aria-hidden="true"><i style="--pct:${sig ? p.pct : 100}"></i></span>
    </button>`
}

// La racha solo si la hay: un «0 días» no cuenta nada (como en la hoja «Tú»).
export function rachaDeFranjaHtml(racha = 0) {
  const dias = Number(racha) || 0
  if (dias <= 0) return ''
  return `<span class="pf-rotulo">Racha</span><b class="pf-grande perfil-racha">${icons.flame(18)}${dias.toLocaleString('es-ES')} <em>${dias === 1 ? 'día' : 'días'}</em></b>`
}

// «En PokeDoc desde marzo de 2026», de la fecha de alta; sin fecha, nada.
export function desdeTexto(iso) {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return ''
  return `En PokeDoc desde ${d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`
}

// La línea de debajo del nombre: «@pingu · En PokeDoc desde marzo de 2026».
export function arrobaHtml(username, creado) {
  const partes = [username ? `@${escapeHtml(username)}` : '', desdeTexto(creado)].filter(Boolean)
  return partes.length ? `<p class="perfil-arroba">${partes.join('<span aria-hidden="true"> · </span>')}</p>` : ''
}

export function pintarFranja({ xp = 0, racha = 0 } = {}) {
  const nivel = document.getElementById('franjaNivel')
  if (nivel) nivel.innerHTML = nivelDeFranjaHtml(xp)
  const celda = document.getElementById('franjaRacha')
  if (celda) {
    celda.innerHTML = rachaDeFranjaHtml(racha)
    celda.hidden = !celda.innerHTML
  }
}

// Los logros, cuando se saben: «39 de 64». Tocarlos abre su pestaña.
export function ponerLogrosEnFranja(ganados, total) {
  const celda = document.getElementById('franjaLogros')
  if (!celda) return
  celda.innerHTML = `<span class="pf-rotulo">Logros</span><b class="pf-grande">${Number(ganados || 0).toLocaleString('es-ES')}${total ? ` <em>de ${Number(total).toLocaleString('es-ES')}</em>` : ''}</b>`
  celda.hidden = false
  celda.onclick = () => {
    abrirPestania('logros')
    document.getElementById('profileTabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
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
  // La tarjeta de la derecha en el PC (1273): hasta doce caras, cada una a su
  // perfil, y «Ver los N», que abre la misma lista que el botón de la franja.
  const tarjeta = $('perfilSeguidores')
  if (tarjeta) {
    tarjeta.hidden = !n
    tarjeta.innerHTML = n
      ? `<header class="ps-cab"><h2>Seguidores</h2><button type="button" class="ps-ver" data-ps-ver>${n === 1 ? 'Ver' : `Ver los ${n.toLocaleString('es-ES')}`} ${icons.chevronRight(14)}</button></header>
        <div class="ps-caras">${orden.slice(0, 12).map((p) => `<a class="mini-avatar" href="${escapeHtml(profileUrl(p))}" title="${escapeHtml(nombre(p))}" aria-label="${escapeHtml(nombre(p))}" style="${avatarStyle(p)}">${p.avatar_url ? '' : escapeHtml(getInitial(nombre(p)))}</a>`).join('')}</div>
        ${suyos.length ? `<p class="ps-pie">Entre ellos ${suyos.join(' y ')}</p>` : ''}`
      : ''
    tarjeta.querySelector('[data-ps-ver]')?.addEventListener('click', () => $('btnShowFollowers')?.click())
  }
}
