// Guardados (tanda 847): lo que te guardaste para luego, separado en «Por
// leer» y «Ya leídas», lo último que guardaste primero, con la misma fila que
// la portada y /aprender (js/guia-fila.js). PINGU: «¿te parece algo útil? Y si
// no… hay que mejorarla». Útil sí —está en la burbuja de Aprender—, pero era
// una lista de títulos en cualquier orden que no decía si ya la habías leído.
import { supabase } from './supabase.js'
import { escapeHtml, requireAuth } from './app.js'
import { icons } from './icons.js'
import { filaDeGuia, estadoDeGuia, hoja } from './guia-fila.js'
import { showToast } from './toast.js'

const COLUMNAS = 'id, slug, title, description, kind, level, estimated_mins, blocks, cover_image, category_id, categories(name, slug, emoji)'

const vacioHtml = () => `
  <div class="empty-state">
    <p>Todavía no has guardado nada. Toca ${icons.bookmark(14)} <b>Guardar</b> en una guía o una noticia y la tendrás aquí para luego.</p>
    <a class="btn-primary" href="/aprender">Ver guías</a>
  </div>`

// Lee la lista de la base cada vez que escribe: si has guardado algo en otra
// pestaña mientras tanto, no se pisa.
async function escribir(session, cambiar) {
  const { data, error } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
  if (error) throw error
  const next = cambiar(data?.saved_guides || [])
  const { error: e2 } = await supabase.from('user_profiles').update({ saved_guides: next }).eq('id', session.user.id)
  if (e2) throw e2
}

function itemHtml(g, progreso) {
  return `
  <li class="gd-item" data-id="${escapeHtml(g.id)}">
    ${filaDeGuia(g, { progreso })}
    <button type="button" class="gd-quitar" data-quitar="${escapeHtml(g.id)}" aria-label="Quitar «${escapeHtml(g.title)}» de guardados" title="Quitar de guardados">${icons.xCircle(20)}</button>
  </li>`
}

async function loadSaved(session) {
  const list = document.getElementById('savedList')
  const resumen = document.getElementById('gdResumen')

  const { data: profile, error } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
  if (error) {
    list.innerHTML = '<p class="empty-state">No se han podido cargar tus guardados. Vuelve a intentarlo en un momento.</p>'
    return
  }
  // Se guardan al final de la lista: dándole la vuelta, lo último primero.
  const ids = [...(profile?.saved_guides || [])].reverse()
  if (!ids.length) {
    list.innerHTML = vacioHtml()
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
  if (!todas.length) {
    list.innerHTML = vacioHtml()
    return
  }
  const porLeer = todas.filter((g) => !estadoDeGuia(g, progreso).leida)
  const leidas = todas.filter((g) => estadoDeGuia(g, progreso).leida)

  await hoja
  const bloque = (titulo, guias, extra = '', clase = '') =>
    guias.length
      ? `<section class="gd-bloque${clase}">
          <div class="gd-cab"><h2>${titulo} <span class="gd-n">${guias.length}</span></h2>${extra}</div>
          <ul class="gd-lista">${guias.map((g) => itemHtml(g, progreso)).join('')}</ul>
        </section>`
      : ''
  list.innerHTML = `
    ${bloque('Por leer', porLeer)}
    ${porLeer.length ? '' : '<p class="gd-todo-leido">' + icons.checkCircle(16) + ' Te has leído todo lo que guardaste. <a href="/aprender">Busca algo nuevo</a>.</p>'}
    ${bloque('Ya leídas', leidas, leidas.length > 1 ? '<button type="button" class="link-btn gd-limpiar" data-limpiar>Quitar las leídas</button>' : '', ' gd-leidas')}`
  resumen.textContent = porLeer.length
    ? `${porLeer.length} por leer${leidas.length ? ` · ${leidas.length} ${leidas.length === 1 ? 'leída' : 'leídas'}` : ''}`
    : 'Todo leído'

  ultimasLeidas = leidas
}

// Las que salen ahora en «Ya leídas», para «Quitar las leídas».
let ultimasLeidas = []

// Delegado y enganchado UNA vez (en init): al limpiar se vuelve a pintar la
// lista y un segundo oyente lo haría todo dos veces.
function engancharAcciones(list, session) {
  list.addEventListener('click', async (e) => {
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
