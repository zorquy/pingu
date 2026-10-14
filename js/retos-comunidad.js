// «Hoy en PokeDoc» en /retos (tanda 842): cuánta gente ha jugado hoy, quién
// lleva más XP de retos, cómo va cada reto, los últimos 14 días y la racha
// más larga. Todo sale de `retos_comunidad` (supabase-migration-retos-
// comunidad.sql); sin esa función, la sección no se enseña.
//
// Privacidad (PINGU): con nombre sale todo el mundo menos quien pide no salir
// (el interruptor de abajo) o tiene oculta su actividad. Se cuentan igual.
import { escapeHtml, avatarStyle, getInitial, profileUrl } from './app.js'
import { icons } from './icons.js'
import { supabase } from './supabase.js'
import { RETOS } from './retos-xp.js'

const icono = (n, t = 16) => icons[n]?.(t) || ''
const nombreDe = (p) => p?.display_name || p?.username || 'Alguien'
// Los que son «acertar o no» y los que van por aciertos de cinco.
const DE_ACERTAR = new Set(['carta', 'silueta', 'ordena'])

function avatar(p, t = 32) {
  const estilo = `width:${t}px;height:${t}px;${avatarStyle(p)}`
  const dentro = p?.avatar_url ? '' : escapeHtml(getInitial(nombreDe(p)))
  return p?.username
    ? `<a class="rt-com-avatar" href="${profileUrl(p)}" style="${estilo}" title="${escapeHtml(nombreDe(p))}">${dentro}</a>`
    : `<span class="rt-com-avatar" style="${estilo}">${dentro}</span>`
}

// Lo que se dice de un reto (puro): «30 jugaron · 64 % acertó» o «… · 3,4 de 5 de media».
export function textoDeReto(juego, x) {
  if (!x?.jugadores) return 'Nadie todavía'
  const quien = `${x.jugadores} ${x.jugadores === 1 ? 'jugó' : 'jugaron'}`
  if (DE_ACERTAR.has(juego)) return `${quien} · ${Math.round((x.acertaron / x.jugadores) * 100)} % acertó`
  if (!x.total) return quien
  const media = (x.aciertos / x.jugadores).toLocaleString('es-ES', { maximumFractionDigits: 1 })
  return `${quien} · ${media} de ${Math.round(x.total / x.jugadores)} de media`
}

export function diferenciaConAyer(hoy, ayer) {
  const d = (hoy || 0) - (ayer || 0)
  if (!ayer && !hoy) return ''
  if (d > 0) return `${d} más que ayer`
  if (d < 0) return `${-d} menos que ayer`
  return 'Los mismos que ayer'
}

export function comunidadHtml(d, { conSesion = false } = {}) {
  const n = d?.jugadores || 0
  const caras = d?.caras || []
  const sobran = Math.max(0, n - caras.length)
  const cabecera = `
    <div class="rt-com-cab">
      <div><h2 id="rtComunidadTitulo">Hoy en PokeDoc</h2><p class="subtext">Lo que llevamos de retos todos juntos</p></div>
      <div class="rt-com-grande"><b>${n}</b><small>${n === 1 ? 'persona ha jugado hoy' : 'personas han jugado hoy'}</small></div>
      ${diferenciaConAyer(n, d?.ayer) ? `<span class="rt-com-chip${n >= (d?.ayer || 0) ? ' sube' : ''}">${icono('trendingUp', 12)} ${escapeHtml(diferenciaConAyer(n, d?.ayer))}</span>` : ''}
      ${caras.length ? `<span class="rt-com-pila">${caras.map((p) => avatar(p, 32)).join('')}${sobran ? `<span class="rt-com-avatar rt-com-mas">+${sobran}</span>` : ''}</span>` : ''}
    </div>`
  if (!n) return `${cabecera}<p class="rt-com-vacio">Todavía no ha jugado nadie hoy. ¡Estrena tú el día!</p>`
  const fila = (x) => `
    <li class="rt-com-fila${x.tu ? ' tu' : ''}">
      <span class="rt-com-pos${x.puesto === 1 ? ' oro' : ''}">${x.puesto}</span>
      ${avatar(x, 32)}
      <span class="rt-com-nombre"><b>${x.tu ? 'Tú' : escapeHtml(nombreDe(x))}</b><small>${x.juegos} de ${RETOS.length}${x.racha > 1 ? ` · racha de ${x.racha} días` : ''}</small></span>
      <span class="rt-com-puntos" aria-hidden="true">${Array.from({ length: RETOS.length }, (_, i) => `<i class="${i < x.juegos ? 'si' : ''}"></i>`).join('')}</span>
      <span class="rt-com-xp">+${x.xp} XP</span>
    </li>`
  const ranking = d.ranking || []
  const tuFuera = d.tu && !ranking.some((x) => x.tu)
  const filas = ranking.map(fila).join('') + (tuFuera ? `<li class="rt-com-hueco" aria-hidden="true">…</li>${fila({ ...d.tu, tu: true, racha: 0 })}` : '')
  const porJuego = RETOS.map((r) => {
    const x = d.porJuego?.[r.juego] || null
    const ancho = x?.jugadores ? Math.round((x.jugadores / n) * 100) : 0
    return `<li class="rt-com-reto"><span class="rt-com-ic" style="background:var(--arte-${r.arte})" aria-hidden="true">${icono(r.icono, 16)}</span>
      <span class="rt-com-reto-txt"><span><a href="${r.ruta}">${escapeHtml(r.titulo)}</a><small>${escapeHtml(textoDeReto(r.juego, x))}</small></span>
      <span class="rt-com-barra"><i style="width:${ancho}%;background:var(--arte-${r.arte})"></i></span></span></li>`
  }).join('')
  const dias = d.dias || []
  const max = Math.max(1, ...dias.map((x) => x.n))
  const fecha = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  const r = d.rachaMax
  return `${cabecera}
    <div class="rt-com-cols">
      <div><h3>Quién lleva más hoy <small>por XP de los retos</small></h3><ol class="rt-com-lista">${filas || '<li class="subtext">Hoy solo han jugado quienes prefieren no salir.</li>'}</ol></div>
      <div><h3>Cada reto, hoy <small>de los ${n}</small></h3><ul class="rt-com-retos">${porJuego}</ul></div>
    </div>
    <div class="rt-com-pie">
      <div>
        <h3>Gente que juega, cada día</h3>
        <div class="rt-com-dias" role="img" aria-label="${escapeHtml(dias.map((x) => `${fecha(x.dia)}: ${x.n}`).join(', '))}">${dias.map((x, i) => `<i class="${i === dias.length - 1 ? 'hoy' : ''}" style="height:${Math.max(4, Math.round((x.n / max) * 100))}%"></i>`).join('')}</div>
        <div class="rt-com-dias-pie"><span>${dias[0] ? escapeHtml(fecha(dias[0].dia)) : ''}</span><span>hoy · ${n}</span></div>
      </div>
      ${r ? `<div class="rt-com-racha">${avatar(r, 40)}<div><small class="subtext">La racha más larga</small><b>${escapeHtml(nombreDe(r))} · ${r.dias} días</b></div><span class="rt-com-fuego" aria-hidden="true">${icono('flame', 20)}</span></div>` : ''}
    </div>
    ${conSesion ? `<label class="rt-com-privado"><input type="checkbox" id="rtComunidadSalir"${d.oculto ? '' : ' checked'} /> Salir con mi nombre en esta lista <span class="subtext">(si lo quitas, se te cuenta igual, sin nombre)</span></label>` : ''}`
}

export async function pintarComunidad(caja, session) {
  if (!caja) return
  const { data, error } = await supabase.rpc('retos_comunidad', { p_dia: new Date().toISOString().slice(0, 10) })
  // Sin la migración (o si falla) no se enseña: «no se sabe» no es «nadie».
  if (error || !data) return caja.classList.add('hidden')
  caja.innerHTML = comunidadHtml(data, { conSesion: Boolean(session) })
  caja.classList.remove('hidden')
  caja.querySelector('#rtComunidadSalir')?.addEventListener('change', async (e) => {
    const salir = e.target.checked
    e.target.disabled = true
    const { error: err } = await supabase.from('user_profiles').update({ retos_oculto: !salir }).eq('id', session.user.id)
    if (err) {
      e.target.checked = !salir
      e.target.disabled = false
      const { showToast } = await import('./toast.js')
      return showToast('No se ha podido cambiar ahora. Prueba otra vez.', 'error')
    }
    pintarComunidad(caja, session)
  })
}
