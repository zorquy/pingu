// LA PESTAÑA «RESUMEN» DEL PERFIL (tanda 1271, PINGU eligió la recomendada:
// «una pestaña Resumen nueva, la primera»). Lo último de cada cosa en una
// línea, con su «Ver» a la pestaña: la vitrina, su última guía, su último
// torneo, lo último que dijo en el foro y sus logros. Lo que no hay no sale;
// sin nada de nada, una frase. Se pinta la PRIMERA vez que se abre (es la de
// entrada, así que casi siempre al llegar), con consultas pequeñas de una fila
// cada una; la vitrina llega aparte (`ponerVitrinaEnResumen`), que ya la pinta
// vitrina.js y aquí solo se copian sus fotos.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { haceCuanto } from './foro-comun.js'
import { rutaDeArticulo } from './articulos.js'
import { abrirPestania } from './perfil-pestanias.js'
import { getAllAchievements } from './gamification.js'
import { achievementIconHtml } from './app.js'
import { fotosDe, imgDeFoto, engancharCadena } from './fotos-cadena.js'

// El «Ver» de cada bloque es un BOTÓN en pastilla que dice adónde lleva (1299,
// PINGU: «que fuesen botones, no letras»).
const bloque = (ver, titulo, dentro, texto = 'Ver') => `<section class="pr-bloque" data-pr="${ver}">
    <header class="pr-cab"><h3>${escapeHtml(titulo)}</h3><button type="button" class="pr-ver" data-pr-ver="${ver}"><span>${escapeHtml(texto)}</span>${icons.chevronRight(14)}</button></header>
    ${dentro}
  </section>`

const fila = (href, dibujo, titulo, sub) => `<a class="pr-fila" href="${escapeHtml(href)}">${dibujo}<span class="pr-fila-t"><b>${escapeHtml(titulo)}</b><small>${escapeHtml(sub)}</small></span></a>`

async function ultimaGuia(userId) {
  const { data } = await supabase.from('guides').select('slug, title, kind, published_at, categories(name)').eq('author_id', userId).eq('review_status', 'approved').eq('kind', 'guide').order('published_at', { ascending: false }).limit(1)
  return data?.[0] || null
}

async function ultimoTorneo(userId) {
  const { data: ins } = await supabase.from('tournament_registrations').select('tournament_id').eq('user_id', userId)
  const ids = [...new Set((ins || []).map((i) => i.tournament_id))]
  if (!ids.length) return null
  const { data } = await supabase.from('tournaments').select('slug, name, status, start_at, champion_id, podium').in('id', ids).in('status', ['finished', 'in_progress']).order('start_at', { ascending: false }).limit(1)
  return data?.[0] || null
}

async function ultimoDelForo(userId) {
  const { data: posts, error } = await supabase.from('forum_posts').select('thread_id, created_at').eq('author_id', userId).order('created_at', { ascending: false }).limit(1)
  if (error || !posts?.length) return null
  const { data: hilo } = await supabase.from('forum_threads').select('id, title, author_id').eq('id', posts[0].thread_id).maybeSingle()
  return hilo ? { ...hilo, created_at: posts[0].created_at, abrio: hilo.author_id === userId } : null
}

// Puro con lo que ha llegado: el HTML de los bloques.
export function resumenHtml({ guia = null, torneo = null, foro = null, logros = [], userId = '', propia = false }) {
  const partes = []
  partes.push('<section class="pr-bloque pr-vitrina" data-pr="vitrina" hidden></section>')
  if (guia) partes.push(bloque('guides', propia ? 'Tu última guía' : 'Su última guía', fila(rutaDeArticulo(guia.kind, guia.slug), `<span class="pr-ico pr-ico-aprender" aria-hidden="true">${icons.bookOpen(18)}</span>`, guia.title, [guia.categories?.name, guia.published_at ? haceCuanto(guia.published_at) : ''].filter(Boolean).join(' · ')), 'Todas las guías'))
  if (torneo) {
    const p = torneo.champion_id === userId ? 0 : Array.isArray(torneo.podium) ? torneo.podium.indexOf(userId) : -1
    const medalla = p === 0 ? '<span class="pr-medalla pr-oro">1.º</span>' : p > 0 ? `<span class="pr-medalla${p === 1 ? ' pr-plata' : p === 2 ? ' pr-bronce' : ''}">${p + 1}.º</span>` : `<span class="pr-ico pr-ico-jugar" aria-hidden="true">${icons.trophy(18)}</span>`
    const sub = [torneo.status === 'in_progress' ? 'En juego' : p === 0 ? 'Campeón' : p > 0 ? `${p + 1}.º puesto` : 'Jugado', String(torneo.start_at || '').slice(0, 10)].filter(Boolean).join(' · ')
    partes.push(bloque('torneos', propia ? 'Tu último torneo' : 'Su último torneo', fila(`/torneo?slug=${encodeURIComponent(torneo.slug)}`, medalla, torneo.name, sub), 'Todos los torneos'))
  }
  if (foro) partes.push(bloque('foro', 'En el foro', fila(`/tema/${encodeURIComponent(foro.id)}`, `<span class="pr-ico pr-ico-comunidad" aria-hidden="true">${icons.messageSquare(18)}</span>`, foro.title, `${foro.abrio ? 'Abrió el tema' : 'Respondió'} · ${haceCuanto(foro.created_at)}`), 'Todo en el foro'))
  if (logros.length) {
    partes.push(bloque('logros', 'Logros', `<div class="pr-logros">${logros.slice(0, 6).map((a) => `<span class="pr-logro" title="${escapeHtml(a.title)}"><span class="icon rarity-${escapeHtml(a.rarity || 'bronze')}">${achievementIconHtml(a, 18)}</span><small>${escapeHtml(a.title)}</small></span>`).join('')}</div>`, `Ver los ${logros.length}`))
  }
  return partes.join('')
}

let pintado = false
export async function pintarResumen(caja, { userId, propia = false, logros = [] } = {}) {
  if (!caja || !userId || pintado) return
  pintado = true
  const [guia, torneo, foro, definiciones] = await Promise.all([
    ultimaGuia(userId).catch(() => null),
    ultimoTorneo(userId).catch(() => null),
    ultimoDelForo(userId).catch(() => null),
    logros.length ? getAllAchievements().catch(() => []) : [],
  ])
  const suyos = new Set(logros)
  const ganados = definiciones.filter((d) => suyos.has(d.id))
  const vitrinaAntes = caja.querySelector('.pr-vitrina')?.outerHTML
  caja.innerHTML = resumenHtml({ guia, torneo, foro, logros: ganados, userId, propia })
  if (vitrinaAntes) caja.querySelector('.pr-vitrina').outerHTML = vitrinaAntes
  caja.dataset.vacio = String(!guia && !torneo && !foro && !ganados.length)
  if (!caja.querySelector('.pr-vitrina:not([hidden])') && caja.dataset.vacio === 'true') caja.insertAdjacentHTML('beforeend', `<p class="empty-state pr-vacio">${propia ? 'Aquí saldrá lo último que hagas: tu vitrina, tus guías, tus torneos y tus logros.' : 'Todavía no hay nada que enseñar.'}</p>`)
  if (!caja.dataset.prEnganchado) {
    caja.dataset.prEnganchado = '1'
    caja.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pr-ver]')
      if (!b) return
      abrirPestania(b.dataset.prVer)
      document.getElementById('profileTabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
}

// La vitrina, cuando llega: sus fotos en una tira, con «Ver» a Colección.
export function ponerVitrinaEnResumen(caja, vitrina, nombre = '') {
  if (!caja) return
  // Con su cadena de respaldo (1296): copiar solo `src` se llevaba la rota.
  const fotos = fotosDe(vitrina, 8)
  let sitio = caja.querySelector('.pr-vitrina')
  if (!sitio) {
    caja.insertAdjacentHTML('afterbegin', '<section class="pr-bloque pr-vitrina" data-pr="vitrina" hidden></section>')
    sitio = caja.querySelector('.pr-vitrina')
  }
  if (!fotos.length) return
  // La vitrina de cristal (1299), la misma de la pestaña Colección: cada carta
  // en su celda (la balda es un `::after` de la celda) y la placa con el nombre.
  const placa = nombre ? `<span class="vitrina-placa">Vitrina de ${escapeHtml(nombre)}</span>` : ''
  sitio.outerHTML = bloque('vitrina', 'Vitrina', `<div class="vitrina-cristal pr-cartas"><div class="vitrina-rejilla" style="--vc-n:${Math.min(6, fotos.length)};--vc-n3:${Math.min(3, fotos.length)}">${fotos.map((f) => `<span class="vc-celda">${imgDeFoto(f, 120, 168)}</span>`).join('')}</div>${placa}</div>`, 'Ver colección').replace('class="pr-bloque"', 'class="pr-bloque pr-vitrina"')
  engancharCadena(caja.querySelector('.pr-vitrina'))
  caja.querySelector('.pr-vacio')?.remove()
}
