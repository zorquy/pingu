// Guardados (tanda 847): lo que te guardaste para luego, separado en «Por
// leer» y «Ya leídas», lo último que guardaste primero. Desde la 1209, en
// portadas (la tarjeta de /aprender, js/guia-tarjeta.js) con la banda de la
// sección arriba y chips para filtrar, como lo demás de la web. PINGU: «¿te parece algo útil? Y si
// no… hay que mejorarla». Útil sí —está en la burbuja de Aprender—, pero era
// una lista de títulos en cualquier orden que no decía si ya la habías leído.
import { supabase } from './supabase.js'
import { escapeHtml, requireAuth } from './app.js'
import { icons } from './icons.js'
import { estadoDeGuia } from './guia-fila.js'
import { tarjetaDeGuia } from './guia-tarjeta.js'
import { abanicoHtml } from './banda-seccion.js'
import { showToast } from './toast.js'
import { servidoPorGuia, frasePersonas } from './guias-servido.js'

const COLUMNAS = 'id, slug, title, description, kind, level, estimated_mins, blocks, cover_image, category_id, categories(name, slug, emoji)'

const vacioHtml = () => `
  <div class="empty-state gd-vacio">
    <img src="/assets/images/mascota.webp" class="gd-vacio-mascota" alt="" width="523" height="791" loading="lazy" decoding="async" />
    <p>Todavía no has guardado nada. Toca ${icons.bookmark(14)} <b>Guardar</b> en una guía o una noticia, o <b>Seguir</b> en un tema del foro, y lo tendrás aquí para luego.</p>
    <div id="gdParaEmpezar"></div>
    <a class="btn-secondary" href="/aprender">Ver todas las guías</a>
  </div>`

// El marcador encima de la portada: fuera del enlace (un botón dentro de un
// <a> no existe), en la esquina del arte.
const marcadorHtml = (g, { quitar }) =>
  quitar
    ? `<button type="button" class="gd-marca gd-quitar" data-quitar="${escapeHtml(g.id)}" aria-label="Quitar «${escapeHtml(g.title)}» de guardados" title="Quitar de guardados">${icons.bookmark(18, true)}</button>`
    : `<button type="button" class="gd-marca gd-guardar" data-guardar="${escapeHtml(g.id)}" aria-pressed="false" aria-label="Guardar «${escapeHtml(g.title)}»" title="Guardar">${icons.bookmark(18)}</button>`

// VACÍO, CON SALIDA (1153, D4). Era un icono, una frase y «Ver guías». Ahora,
// tres guías para empezar —las que a más gente le han servido de las últimas
// publicadas— con su marcador, que guarda ahí mismo (cambia ya y vuelve si
// falla, la 896). Sin «Me ha servido» que contar, las más recientes.
async function pintarParaEmpezar() {
  const caja = document.getElementById('gdParaEmpezar')
  if (!caja) return
  const { data, error } = await supabase
    .from('guides')
    .select(COLUMNAS)
    .eq('kind', 'guide')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(30)
  if (error || !data?.length) return
  const servido = (await servidoPorGuia(data.map((g) => g.id))) || {}
  const tres = [...data].sort((a, b) => (servido[b.id] || 0) - (servido[a.id] || 0)).slice(0, 3)
  caja.innerHTML = `<h2 class="gd-empezar-titulo">Para empezar</h2>
    <div class="guia-rejilla gd-rejilla gd-empezar en-cascada">${tres.map((g) => `
      <div class="gd-item" title="${servido[g.id] ? escapeHtml(frasePersonas(servido[g.id])) : ''}">
        ${tarjetaDeGuia(g)}
        ${marcadorHtml(g, { quitar: false })}
      </div>`).join('')}</div>`
}

// Lee la lista de la base cada vez que escribe: si has guardado algo en otra
// pestaña mientras tanto, no se pisa.
async function escribir(session, cambiar) {
  const { data, error } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
  if (error) throw error
  const next = cambiar(data?.saved_guides || [])
  const { error: e2 } = await supabase.from('user_profiles').update({ saved_guides: next }).eq('id', session.user.id)
  if (e2) throw e2
}

// Cada portada lleva lo que hace falta para filtrar sin volver a pedir nada.
function itemHtml(g, progreso) {
  const { leida, pct } = estadoDeGuia(g, progreso)
  const estado = leida ? 'leida' : pct > 0 ? 'medias' : 'leer'
  return `
  <div class="gd-item${leida ? ' gd-item-leida' : ''}" data-id="${escapeHtml(g.id)}" data-estado="${estado}" data-kind="${g.kind === 'news' ? 'news' : 'guide'}">
    ${tarjetaDeGuia(g, { progreso })}
    ${marcadorHtml(g, { quitar: true })}
  </div>`
}

// Los chips de arriba de la rejilla: por estado y, si hay de los dos, por tipo.
const FILTROS = {
  todas: () => true,
  leer: (el) => el.dataset.estado !== 'leida' && el.dataset.kind !== 'tema',
  medias: (el) => el.dataset.estado === 'medias',
  leidas: (el) => el.dataset.estado === 'leida',
  guias: (el) => el.dataset.kind === 'guide',
  noticias: (el) => el.dataset.kind === 'news',
  temas: (el) => el.dataset.kind === 'tema',
}
let filtro = 'todas'

function aplicarFiltro(list) {
  const ok = FILTROS[filtro] || FILTROS.todas
  for (const el of list.querySelectorAll('.gd-rejilla-tuyas > .gd-item')) el.hidden = !ok(el)
  for (const b of list.querySelectorAll('[data-gd-filtro]')) b.setAttribute('aria-pressed', String(b.dataset.gdFiltro === filtro))
}

function ponerCifras(porLeer, medias, leidas) {
  const poner = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n) }
  poner('gdNLeer', porLeer)
  poner('gdNMedias', medias)
  poner('gdNLeidas', leidas)
}

// Los TEMAS del foro que sigues (1216, la propuesta del repaso: «toca el
// marcador de cualquier guía, noticia o tema y sale aquí»). En un tema, el
// marcador es «Seguir» (forum_subscriptions): lo que sigues es lo que has
// dejado para volver. Quitar es dejar de seguir, con Deshacer.
async function temasQueSigues(session) {
  const { data: subs, error } = await supabase.from('forum_subscriptions').select('thread_id').eq('user_id', session.user.id).limit(200)
  if (error || !subs?.length) return []
  const { data } = await supabase.from('forum_threads').select('id, title, post_count, last_post_at').in('id', subs.map((x) => x.thread_id))
  return (data || []).sort((a, b) => String(b.last_post_at || '').localeCompare(String(a.last_post_at || '')))
}
const haceCuanto = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4))
  if (!iso || Number.isNaN(min)) return ''
  if (min < 60) return `hace ${Math.max(1, min)} min`
  if (min < 1440) return `hace ${Math.round(min / 60)} h`
  return `hace ${Math.round(min / 1440)} d`
}
export function temaHtml(t) {
  const n = Math.max(0, Number(t.post_count) || 0)
  return `<div class="gd-item gd-item-tema" data-id="tema-${escapeHtml(t.id)}" data-estado="leer" data-kind="tema">
    <a class="gd-tema" href="/tema/${escapeHtml(t.id)}">
      <span class="gd-tema-ico" aria-hidden="true">${icons.messageSquare(22)}</span>
      <span class="gd-tema-texto"><b>${escapeHtml(t.title || 'Tema')}</b><small>${n} ${n === 1 ? 'mensaje' : 'mensajes'}${t.last_post_at ? ` · ${haceCuanto(t.last_post_at)}` : ''}</small></span>
    </a>
    <button type="button" class="gd-marca gd-quitar" data-dejar-tema="${escapeHtml(t.id)}" aria-label="Dejar de seguir «${escapeHtml(t.title || 'el tema')}»" title="Dejar de seguir">${icons.bookmark(18, true)}</button>
  </div>`
}

async function loadSaved(session) {
  const list = document.getElementById('savedList')
  const pidiendoTemas = temasQueSigues(session).catch(() => [])

  const { data: profile, error } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
  if (error) {
    list.innerHTML = '<p class="empty-state">No se han podido cargar tus guardados. Vuelve a intentarlo en un momento.</p>'
    return
  }
  // Se guardan al final de la lista: dándole la vuelta, lo último primero.
  const ids = [...(profile?.saved_guides || [])].reverse()
  const temas = await pidiendoTemas
  if (!ids.length && !temas.length) {
    ponerCifras(0, 0, 0)
    list.innerHTML = vacioHtml()
    void pintarParaEmpezar().catch(() => {})
    return
  }

  const [{ data: guias, error: eGuias }, { data: filas }] = await Promise.all([
    supabase.from('guides').select(COLUMNAS).in('id', ids),
    supabase.from('user_progress').select('guide_id, status, read_at, current_block').eq('user_id', session.user.id).in('guide_id', ids),
  ])
  if (eGuias) {
    list.innerHTML = '<p class="empty-state">No se han podido cargar tus guardados. Vuelve a intentarlo en un momento.</p>'
    return
  }
  const progreso = Object.fromEntries((filas || []).map((f) => [f.guide_id, f]))
  // Una guardada que ya no está publicada no vuelve en la consulta: se calla.
  const porId = new Map((guias || []).map((g) => [g.id, g]))
  const todas = ids.map((id) => porId.get(id)).filter(Boolean)
  if (!todas.length && !temas.length) {
    ponerCifras(0, 0, 0)
    list.innerHTML = vacioHtml()
    void pintarParaEmpezar().catch(() => {})
    return
  }
  // Lo que queda por leer primero; dentro, lo último que guardaste primero.
  const porLeer = todas.filter((g) => !estadoDeGuia(g, progreso).leida)
  const leidas = todas.filter((g) => estadoDeGuia(g, progreso).leida)
  const medias = porLeer.filter((g) => estadoDeGuia(g, progreso).pct > 0)
  const noticias = todas.filter((g) => g.kind === 'news').length
  const chip = (clave, texto, n) => (n ? `<button type="button" class="seg-btn gd-chip" data-gd-filtro="${clave}" aria-pressed="false">${texto} <span class="gd-n">${n}</span></button>` : '')
  const chips = [
    chip('todas', 'Todas', todas.length + temas.length),
    porLeer.length && leidas.length ? chip('leer', 'Por leer', porLeer.length) : '',
    medias.length ? chip('medias', 'A medias', medias.length) : '',
    porLeer.length && leidas.length ? chip('leidas', 'Leídas', leidas.length) : '',
    noticias && noticias < todas.length ? chip('guias', 'Guías', todas.length - noticias) + chip('noticias', 'Noticias', noticias) : '',
    temas.length && todas.length ? chip('temas', 'Temas', temas.length) : '',
  ].join('')
  // Si el filtro de antes ya no tiene nada (se han quitado las leídas), a «Todas».
  if (!chips.includes(`data-gd-filtro="${filtro}"`)) filtro = 'todas'

  list.innerHTML = `
    <div class="gd-mandos">
      <div class="gd-chips" role="group" aria-label="Filtrar">${chips}</div>
      ${leidas.length > 1 ? '<button type="button" class="link-btn gd-limpiar" data-limpiar>Quitar <span class="cab-largo">las </span>leídas</button>' : ''}
    </div>
    ${porLeer.length || !todas.length ? '' : '<p class="gd-todo-leido">' + icons.checkCircle(16) + ' Te has leído todo lo que guardaste. <a href="/aprender">Busca algo nuevo</a>.</p>'}
    <div class="guia-rejilla gd-rejilla gd-rejilla-tuyas en-cascada">${[...porLeer, ...leidas].map((g) => itemHtml(g, progreso)).join('')}${temas.map(temaHtml).join('')}</div>`
  aplicarFiltro(list)
  ponerCifras(porLeer.length, medias.length, leidas.length)
  // Las tres primeras portadas con foto, en abanico a la derecha de la banda.
  const fotos = todas.filter((g) => g.cover_image).map((g) => `<img src="${escapeHtml(g.cover_image)}" alt="" loading="lazy" />`)
  const abanico = document.getElementById('gdAbanico')
  if (abanico) abanico.innerHTML = abanicoHtml(fotos)

  ultimasLeidas = leidas
}

// Las que salen ahora en «Ya leídas», para «Quitar las leídas».
let ultimasLeidas = []

// Delegado y enganchado UNA vez (en init): al limpiar se vuelve a pintar la
// lista y un segundo oyente lo haría todo dos veces.
function engancharAcciones(list, session) {
  list.addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-gd-filtro]')
    if (chip) {
      filtro = chip.dataset.gdFiltro
      aplicarFiltro(list)
      return
    }
    // Guardar una de «Para empezar»: se marca ya; si la base dice que no, se
    // desmarca con su aviso. Tocar otra vez la quita (mismo camino).
    const guardar = e.target.closest('[data-guardar]')
    if (guardar) {
      const id = guardar.dataset.guardar
      const poner = guardar.getAttribute('aria-pressed') !== 'true'
      guardar.setAttribute('aria-pressed', String(poner))
      try {
        await escribir(session, (lista) => (poner ? (lista.includes(id) ? lista : [...lista, id]) : lista.filter((x) => x !== id)))
        if (poner) showToast('Guardada. La tienes en «Por leer».', 'success')
      } catch {
        guardar.setAttribute('aria-pressed', String(!poner))
        showToast(poner ? 'No se ha podido guardar. Inténtalo otra vez.' : 'No se ha podido quitar. Inténtalo otra vez.')
      }
      return
    }
    const quitar = e.target.closest('[data-quitar]')
    if (quitar) {
      const id = quitar.dataset.quitar
      const item = quitar.closest('.gd-item')
      const antes = item.innerHTML
      // Quitar no se pregunta: se deshace. La fila se queda en su sitio con el
      // «Deshacer» a mano, que es lo que se busca cuando se toca sin querer.
      let pos = -1
      try {
        await escribir(session, (lista) => {
          pos = lista.indexOf(id)
          return lista.filter((x) => x !== id)
        })
      } catch {
        showToast('No se ha podido quitar. Inténtalo otra vez.')
        return
      }
      item.classList.add('gd-quitada')
      item.innerHTML = `<span>Quitada de guardados.</span><button type="button" class="link-btn" data-deshacer="${escapeHtml(id)}">Deshacer</button>`
      item.dataset.antes = antes
      item.dataset.pos = pos
      item.querySelector('[data-deshacer]').focus()
      return
    }
    const dejar = e.target.closest('[data-dejar-tema]')
    if (dejar) {
      const id = dejar.dataset.dejarTema
      const item = dejar.closest('.gd-item')
      const { desuscribir } = await import('./foro-lecturas.js')
      if (!(await desuscribir(session.user.id, id))) return showToast('No se ha podido quitar. Inténtalo otra vez.')
      item.dataset.antes = item.innerHTML
      item.classList.add('gd-quitada')
      item.innerHTML = `<span>Ya no sigues este tema.</span><button type="button" class="link-btn" data-volver-tema="${escapeHtml(id)}">Deshacer</button>`
      item.querySelector('[data-volver-tema]').focus()
      return
    }
    const volver = e.target.closest('[data-volver-tema]')
    if (volver) {
      const id = volver.dataset.volverTema
      const item = volver.closest('.gd-item')
      const { suscribir } = await import('./foro-lecturas.js')
      if (!(await suscribir(session.user.id, id))) return showToast('No se ha podido volver a seguir. Inténtalo otra vez.')
      item.classList.remove('gd-quitada')
      item.innerHTML = item.dataset.antes
      delete item.dataset.antes
      return
    }
    const deshacer = e.target.closest('[data-deshacer]')
    if (deshacer) {
      const id = deshacer.dataset.deshacer
      const item = deshacer.closest('.gd-item')
      try {
        // A su sitio de antes, no al final: si no, al volver saldría como la
        // última que guardaste.
        const pos = Number(item.dataset.pos)
        await escribir(session, (lista) => (lista.includes(id) ? lista : pos >= 0 ? [...lista.slice(0, pos), id, ...lista.slice(pos)] : [...lista, id]))
      } catch {
        showToast('No se ha podido volver a guardar. Inténtalo otra vez.')
        return
      }
      item.classList.remove('gd-quitada')
      item.innerHTML = item.dataset.antes
      delete item.dataset.antes
      delete item.dataset.pos
      item.querySelector('[data-quitar]')?.focus()
      return
    }
    if (e.target.closest('[data-limpiar]')) {
      const fuera = new Set(ultimasLeidas.map((g) => g.id))
      if (!confirm(`¿Quitar de guardados las ${fuera.size} que ya has leído?`)) return
      try {
        await escribir(session, (lista) => lista.filter((x) => !fuera.has(x)))
      } catch {
        showToast('No se han podido quitar. Inténtalo otra vez.')
        return
      }
      showToast(`Quitadas ${fuera.size} leídas.`, 'success')
      loadSaved(session)
    }
  })
}

async function init() {
  const session = await requireAuth()
  if (!session) return
  engancharAcciones(document.getElementById('savedList'), session)
  await loadSaved(session)
}

init()
