import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession, validateImageFile, uploadGuideImage, profileUrl, slugify } from '../../js/app.js'
import { invalidateAchievementsCache } from '../../js/gamification.js'
import { showToast } from '../../js/toast.js'
import { renderReferenceBlocksHtml } from '../../js/block-editor.js'
import { icons } from '../../js/icons.js'
import { contentIconHtml, inlineIconHtml } from '../../js/content-icon.js'
import { attachEmojiPicker } from '../../js/emoji-picker.js'
import { normalizePath, pageLabel } from '../../js/page-views.js'
import { revisarBloques } from '../../js/curso-lint.js'
import { claveDePregunta, esPractica } from '../../js/curso-juego.js'
import { fetchSets, fetchSet, setToRow, cardToRow, normalizeSearch, diagnosticarCatalogos, diagnosticoComoTexto, MERCADOS_A_IMPORTAR, sinDuplicados, codigoLiveDeSet } from '../../js/tcgdex.js'
import { checkSchema } from '../../js/schema-check.js'

let categories = []
let guidesCache = []

// ── Access gate ──
async function checkAccess() {
  const session = await getSession()
  if (!session) {
    window.location.href = '/auth.html'
    return null
  }
  const { data: profile } = await supabase.from('user_profiles').select('is_admin').eq('id', session.user.id).single()
  if (!profile?.is_admin) {
    window.location.href = '/index.html'
    return null
  }
  document.getElementById('adminGate').classList.add('hidden')
  document.getElementById('adminLayout').classList.remove('hidden')
  return session
}

// ── Sidebar navigation ──
function initSidebar() {
  document.querySelectorAll('.admin-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.admin-section').forEach((s) => s.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`section-${btn.dataset.section}`).classList.add('active')
    })
  })
}

// ── Modal helpers ──
const modal = document.getElementById('adminModal')
const modalContent = document.getElementById('adminModalContent')

function openModal(html) {
  modalContent.innerHTML = html
  modal.classList.remove('hidden')
}

function closeModal() {
  modal.classList.add('hidden')
  modalContent.innerHTML = ''
}

document.getElementById('adminModalClose').addEventListener('click', closeModal)
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal()
})

// ── Dashboard ──
// ── Guía destacada de la portada ──
//
// Se guarda en `home_config`, la fila única que ya existía y que no usaba
// nadie: leerla es público y escribirla solo puede un admin, que es
// exactamente lo que hace falta. Se guarda dentro de `blocks` para no
// añadir columnas a una tabla que quizá algún día sirva para más cosas.
async function loadDestacada() {
  const panel = document.getElementById('destacadaPanel')
  if (!panel) return
  const select = document.getElementById('destacadaSelect')
  const nota = document.getElementById('destacadaNota')

  const [{ data: guias }, { data: config }] = await Promise.all([
    supabase.from('guides').select('id, title').not('published_at', 'is', null).order('title'),
    supabase.from('home_config').select('blocks').eq('id', 1).maybeSingle(),
  ])

  const actual = config?.blocks?.destacada || {}
  select.innerHTML =
    '<option value="">— Ninguna —</option>' +
    (guias || []).map((g) => `<option value="${g.id}" ${g.id === actual.guide_id ? 'selected' : ''}>${escapeHtml(g.title)}</option>`).join('')
  nota.value = actual.nota || ''

  document.getElementById('btnGuardarDestacada').addEventListener('click', async () => {
    const destacada = select.value ? { guide_id: select.value, nota: nota.value.trim() || null } : null
    const { error } = await supabase
      .from('home_config')
      .upsert({ id: 1, blocks: { ...(config?.blocks || {}), destacada }, updated_at: new Date().toISOString() })
    showToast(error ? 'No se ha podido guardar: ' + error.message : 'Guardado. Ya sale en la portada.', error ? 'error' : 'success')
  })
}

// ── El aviso global (la franja de arriba de toda la web) ──
//
// Vive en site_settings, clave `aviso_global` (ver
// supabase-migration-ajustes.sql). Si la tabla no existe todavía, el
// panel lo dice al intentar guardar — leer en vacío no molesta.
async function loadAvisoGlobal() {
  const panel = document.getElementById('avisoGlobalPanel')
  if (!panel) return
  const texto = document.getElementById('avisoGlobalTexto')
  const tono = document.getElementById('avisoGlobalTono')
  const activo = document.getElementById('avisoGlobalActivo')

  const { data } = await supabase.from('site_settings').select('value').eq('key', 'aviso_global').maybeSingle()
  const actual = data?.value || {}
  texto.value = actual.texto || ''
  tono.value = actual.tono === 'aviso' ? 'aviso' : 'info'
  activo.checked = !!actual.activo

  document.getElementById('btnGuardarAvisoGlobal').addEventListener('click', async () => {
    const { error } = await supabase.from('site_settings').upsert(
      {
        key: 'aviso_global',
        value: { texto: texto.value.trim(), tono: tono.value, activo: activo.checked },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    )
    const faltaTabla = error && /site_settings/.test(error.message || '')
    showToast(
      error
        ? faltaTabla
          ? 'Falta ejecutar supabase-migration-ajustes.sql en el SQL Editor de Supabase.'
          : 'No se ha podido guardar: ' + error.message
        : activo.checked
          ? 'Guardado. El aviso ya está en toda la web.'
          : 'Guardado. El aviso queda apagado.',
      error ? 'error' : 'success'
    )
  })
}

// ── Las claves de las notificaciones push (VAPID) ──
//
// Se generan AQUÍ, en el navegador del admin, con WebCrypto: así la
// clave privada no pasa por ningún servidor nuestro ni queda en ningún
// fichero. La pública (que no es secreta) se guarda en site_settings
// para que js/push.js la lea; la privada se enseña una sola vez y su
// sitio es la variable PUSH_VAPID_PRIVATE de Netlify.
async function loadClavesPush() {
  const panel = document.getElementById('pushClavesPanel')
  if (!panel) return
  const estado = document.getElementById('pushClavesEstado')
  const boton = document.getElementById('btnGenerarClavesPush')

  const { data } = await supabase.from('site_settings').select('value').eq('key', 'push_vapid_public').maybeSingle()
  const hay = !!data?.value?.clave
  estado.textContent = hay
    ? 'Ya hay claves: la pública está en la base. Regenera SOLO si perdiste la privada — las suscripciones actuales dejarán de valer y cada cual tendrá que reactivar sus avisos.'
    : 'Sin claves todavía. Genéralas para poder activar los avisos push.'
  if (hay) boton.textContent = 'Regenerar claves (invalida las suscripciones actuales)'

  boton.addEventListener('click', async () => {
    boton.disabled = true
    try {
      const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign'])
      // El formato del estándar VAPID: pública = punto sin comprimir de
      // 65 bytes en base64url; privada = el escalar `d` del JWK, que ya
      // viene en base64url.
      const pubCruda = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey))
      const jwk = await crypto.subtle.exportKey('jwk', par.privateKey)
      const aB64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

      const { error } = await supabase.from('site_settings').upsert(
        { key: 'push_vapid_public', value: { clave: aB64url(pubCruda) }, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
      if (error) {
        const faltaTabla = /site_settings/.test(error.message || '')
        showToast(
          faltaTabla
            ? 'Falta ejecutar supabase-migration-ajustes.sql en el SQL Editor de Supabase.'
            : 'No se ha podido guardar la clave pública: ' + error.message,
          'error'
        )
        return
      }
      document.getElementById('pushClavePrivada').style.display = ''
      document.getElementById('pushClavePrivadaTexto').value = jwk.d
      estado.textContent = 'Clave pública guardada. Pega la privada de abajo en Netlify (PUSH_VAPID_PRIVATE) y redespliega.'
      showToast('Claves generadas. La privada solo se enseña esta vez.', 'success')
    } finally {
      boton.disabled = false
    }
  })
}

async function loadDashboard() {
  loadDestacada().catch(() => {})
  loadAvisoGlobal().catch(() => {})
  loadClavesPush().catch(() => {})
  const [{ count: userCount }, completedRes, { count: guideCount }] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('guides').select('*', { count: 'exact', head: true }).not('published_at', 'is', null),
  ])

  // Hasta la migración supabase-migration-admin-analytics.sql, la única
  // política de lectura de user_progress era auth.uid() = user_id, así
  // que esta cifra contaba solo los cursos del propio admin. Si la
  // consulta falla, se dice en vez de enseñar un cero engañoso.
  const completedLabel = completedRes.error ? '—' : completedRes.count || 0
  const completedNote = completedRes.error
    ? `<p style="grid-column: 1/-1; font-size: 12px; color: var(--text-mid);">No se ha podido leer <code>user_progress</code> (${escapeHtml(completedRes.error.message)}). Aplica <code>supabase-migration-admin-analytics.sql</code> para que el equipo pueda ver el progreso de todos los usuarios.</p>`
    : ''

  document.getElementById('dashboardStats').innerHTML = `
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${userCount || 0}</div><div>Usuarios</div></div>
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${completedLabel}</div><div>Cursos completados</div></div>
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${guideCount || 0}</div><div>Guías publicadas</div></div>
    ${completedNote}`
}

// ── Categories ──
async function recalcCategoryGuideCount(categoryId) {
  if (!categoryId) return
  const { count } = await supabase
    .from('guides')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .not('published_at', 'is', null)
  await supabase.from('categories').update({ guide_count: count || 0 }).eq('id', categoryId)
}

async function loadCategories() {
  const { data } = await supabase.from('categories').select('*').order('order_pos')
  categories = data || []

  document.getElementById('categoriesTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Orden</th><th>Icono</th><th>Nombre</th><th>Slug</th><th>Guías</th><th></th></tr></thead>
      <tbody>
        ${categories
          .map(
            (c) => `
          <tr>
            <td>${c.order_pos ?? ''}</td>
            <td>${c.icon_image ? `<img src="${c.icon_image.replace(/"/g, '&quot;')}" alt="" style="width:24px; height:24px; object-fit:contain;" />` : contentIconHtml(c.emoji, 20, 'bookOpen')}</td>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.slug)}</td>
            <td>${c.guide_count ?? 0}</td>
            <td class="admin-row-actions">
              <button data-edit="${c.id}">Editar</button>
              <button class="danger" data-delete="${c.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#categoriesTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openCategoryModal(categories.find((c) => c.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#categoriesTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta categoría?')) return
      await supabase.from('categories').delete().eq('id', btn.dataset.delete)
      loadCategories()
    })
  )
}

function openCategoryModal(category) {
  const c = category || { name: '', slug: '', description: '', emoji: '', cover_image: '', icon_image: '', order_pos: categories.length }
  openModal(`
    <h3>${category ? 'Editar' : 'Nueva'} categoría</h3>
    <div class="form-group"><label>Nombre</label><input id="catName" value="${escapeHtml(c.name)}" /></div>
    <div class="form-group"><label>Slug</label><input id="catSlug" value="${escapeHtml(c.slug)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="catDescription">${escapeHtml(c.description || '')}</textarea></div>
    <div class="form-group"><label>Icono</label><input id="catEmoji" value="${escapeHtml(c.emoji || '')}" /></div>
    <div class="form-group"><label>Icono personalizado (URL, opcional)</label><input id="catIconImage" value="${escapeHtml(c.icon_image || '')}" placeholder="https://..." /><p style="font-size:12px; color:var(--text-mid); margin-top:4px;">Sustituye al icono en las tarjetas de categoría. Sube la imagen en la pestaña "Imágenes" y pega aquí la URL.</p></div>
    <div class="form-group"><label>Imagen de portada (URL)</label><input id="catCoverImage" value="${escapeHtml(c.cover_image || '')}" /></div>
    <div class="form-group"><label>Orden</label><input id="catOrder" type="number" value="${c.order_pos ?? 0}" /></div>
    <button class="btn-primary btn-block" id="btnSaveCategory">Guardar</button>`)

  attachEmojiPicker(document.getElementById('catEmoji'))

  document.getElementById('btnSaveCategory').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('catName').value.trim(),
      slug: document.getElementById('catSlug').value.trim(),
      description: document.getElementById('catDescription').value.trim(),
      emoji: document.getElementById('catEmoji').value.trim(),
      icon_image: document.getElementById('catIconImage').value.trim() || null,
      cover_image: document.getElementById('catCoverImage').value.trim() || null,
      order_pos: Number(document.getElementById('catOrder').value) || 0,
    }
    if (c.id) payload.id = c.id
    const { error } = await supabase.from('categories').upsert(payload)
    if (error) {
      showToast('No se pudo guardar la categoría: ' + error.message)
      return
    }
    closeModal()
    loadCategories()
  })
}

document.getElementById('btnNewCategory').addEventListener('click', () => openCategoryModal(null))

// Las colecciones se gestionan ya solo desde la base: la comunidad no
// las usa y su panel se retiró del admin (la página de categoría sigue
// pintándolas si algún día vuelven a tener filas).


// ── Guías pendientes de revisión ──
let pendingCache = []


// El contador del nav: cuántas cosas esperan trabajo en una sección,
// visibles sin entrar («Pendientes 3»). Con cero, ni se enseña.
function ponerContadorNav(seccion, n) {
  const boton = document.querySelector(`.admin-nav-item[data-section="${seccion}"]`)
  if (!boton) return
  boton.querySelector('.admin-nav-contador')?.remove()
  if (n > 0) boton.insertAdjacentHTML('beforeend', `<span class="admin-nav-contador">${n}</span>`)
}

async function loadPending() {
  const { data } = await supabase
    .from('guides')
    .select('*, categories(name)')
    .eq('review_status', 'pending')
    .order('submitted_at', { ascending: true })

  pendingCache = data || []
  ponerContadorNav('pending', pendingCache.length)
  const authorIds = [...new Set(pendingCache.map((g) => g.author_id).filter(Boolean))]
  let authorsById = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase.from('user_profiles').select('id, display_name, username').in('id', authorIds)
    authorsById = Object.fromEntries((authors || []).map((a) => [a.id, a]))
  }

  const container = document.getElementById('pendingTable')
  if (pendingCache.length === 0) {
    container.innerHTML = `<p class="empty-state">No hay guías pendientes de revisión.</p>`
    return
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Título</th><th>Categoría</th><th>Autor</th><th>Enviada</th><th></th></tr></thead>
      <tbody>
        ${pendingCache
          .map((g) => {
            const author = authorsById[g.author_id]
            const authorName = author?.display_name || author?.username || 'Usuario'
            return `
          <tr>
            <td>${inlineIconHtml(g.cover_emoji, 16, 'bookOpen')}${escapeHtml(g.title || 'Sin título')}</td>
            <td>${escapeHtml(g.categories?.name || '—')}</td>
            <td>${escapeHtml(authorName)}</td>
            <td>${g.submitted_at ? new Date(g.submitted_at).toLocaleDateString('es-ES') : '—'}</td>
            <td class="admin-row-actions">
              <button data-review="${g.id}">Revisar</button>
            </td>
          </tr>`
          })
          .join('')}
      </tbody>
    </table>`

  container.querySelectorAll('[data-review]').forEach((btn) =>
    btn.addEventListener('click', () => (window.location.href = `editor-guia.html?id=${btn.dataset.review}`))
  )
}

// ── Guides ──
async function loadGuides() {
  const { data } = await supabase.from('guides').select('*, categories(name)').order('created_at', { ascending: false })
  guidesCache = data || []

  document.getElementById('guidesTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Título</th><th>Categoría</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${guidesCache
          .map(
            (g) => `
          <tr>
            <td>${inlineIconHtml(g.cover_emoji, 16, 'bookOpen')}${escapeHtml(g.title)}${g.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}${g.has_pro_content ? ` <span class="badge badge-pro">${icons.star(11)} Guía Pro</span>` : ''}</td>
            <td>${escapeHtml(g.categories?.name || '—')}</td>
            <td>${g.published_at ? '<span class="badge badge-completed">Publicada</span>' : '<span class="badge badge-progress">Borrador</span>'}</td>
            <td class="admin-row-actions">
              <button data-edit="${g.id}">Editar</button>
              <button class="danger" data-delete="${g.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#guidesTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => (window.location.href = `editor-guia.html?id=${btn.dataset.edit}`))
  )
  document.querySelectorAll('#guidesTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta guía?')) return
      const g = guidesCache.find((x) => x.id === btn.dataset.delete)
      await supabase.from('guides').delete().eq('id', btn.dataset.delete)
      await recalcCategoryGuideCount(g?.category_id)
      loadGuides()
      loadCategories()
    })
  )
}

document.getElementById('btnNewGuide').addEventListener('click', () => (window.location.href = 'editor-guia.html'))

// ── Los lanzamientos ──
// La lista de sets con fecha, en site_settings (clave `lanzamientos`),
// editada por FILAS: fecha, nombre, logo (URL o subida) y notas. Antes
// era una caja de texto con líneas «fecha | nombre | …»; el formato por
// filas lo pidió el admin para meter la era actual a mano sin pelearse
// con las barras.
async function loadLanzamientos() {
  const cont = document.getElementById('lanzamientosFilas')
  if (!cont) return

  const filaHtml = (s = {}) => `
    <div class="lanz-fila">
      <input type="date" class="lanz-fecha" aria-label="Fecha de salida" value="${escapeHtml(s.fecha || '')}" />
      <input type="text" class="lanz-nombre" placeholder="Nombre del set" value="${escapeHtml(s.nombre || '')}" />
      <div class="lanz-imagen-campo">
        <input type="url" class="lanz-imagen" placeholder="URL del logo (opcional)" value="${escapeHtml(s.imagen || '')}" />
        <button type="button" class="btn-secondary lanz-subir" title="Subir una imagen">${icons.upload(15)}</button>
      </div>
      <input type="text" class="lanz-notas" placeholder="Notas (opcional)" value="${escapeHtml(s.notas || '')}" />
      <button type="button" class="btn-secondary lanz-quitar" title="Quitar este set">${icons.trash(15)}</button>
    </div>`

  // Siempre queda al menos una fila vacía donde empezar a escribir.
  const pintarFilas = (sets) => {
    cont.innerHTML = (sets.length ? sets : [{}]).map(filaHtml).join('')
  }

  const leerFilas = () => {
    const sets = []
    const malas = []
    for (const fila of cont.querySelectorAll('.lanz-fila')) {
      const v = (sel) => fila.querySelector(sel).value.trim()
      const [fecha, nombre, imagen, notas] = [v('.lanz-fecha'), v('.lanz-nombre'), v('.lanz-imagen'), v('.lanz-notas')]
      if (!fecha && !nombre && !imagen && !notas) continue
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !nombre) {
        malas.push(nombre || imagen || notas || fecha)
        continue
      }
      sets.push({ fecha, nombre, ...(imagen ? { imagen } : {}), ...(notas ? { notas } : {}) })
    }
    return { sets, malas }
  }

  const { data } = await supabase.from('site_settings').select('value').eq('key', 'lanzamientos').maybeSingle()
  pintarFilas(data?.value?.sets || [])

  document.getElementById('btnAnadirLanzamiento').addEventListener('click', () => {
    cont.insertAdjacentHTML('beforeend', filaHtml())
    cont.lastElementChild.querySelector('.lanz-fecha').focus()
  })

  cont.addEventListener('click', async (e) => {
    const quitar = e.target.closest('.lanz-quitar')
    if (quitar) {
      quitar.closest('.lanz-fila').remove()
      if (!cont.querySelector('.lanz-fila')) pintarFilas([])
      return
    }
    // Subir el logo: al mismo bucket que las imágenes de guías, que ya
    // existe y ya tiene la política de subida para usuarios con sesión.
    const subir = e.target.closest('.lanz-subir')
    if (subir) {
      const selector = document.createElement('input')
      selector.type = 'file'
      selector.accept = 'image/*'
      selector.addEventListener('change', async () => {
        const file = selector.files?.[0]
        if (!file) return
        try {
          const session = await getSession()
          const url = await uploadGuideImage(session.user.id, file)
          subir.closest('.lanz-imagen-campo').querySelector('.lanz-imagen').value = url
          showToast('Imagen subida. Recuerda pulsar Guardar.', 'success')
        } catch (err) {
          showToast('No se ha podido subir la imagen: ' + (err.message || err), 'error')
        }
      })
      selector.click()
    }
  })

  document.getElementById('btnGuardarLanzamientos').addEventListener('click', async () => {
    const { sets, malas } = leerFilas()
    if (malas.length) {
      showToast(`Hay ${malas.length} ${malas.length === 1 ? 'fila a la que le falta' : 'filas a las que les falta'} la fecha o el nombre («${String(malas[0]).slice(0, 40)}…» sin completar)`, 'error')
      return
    }
    sets.sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    const { error } = await supabase.from('site_settings').upsert(
      { key: 'lanzamientos', value: { sets }, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    showToast(
      error
        ? /site_settings/.test(error.message || '')
          ? 'Falta ejecutar supabase-migration-ajustes.sql en el SQL Editor de Supabase.'
          : 'No se ha podido guardar: ' + error.message
        : `Guardados ${sets.length} sets. Ya están en /lanzamientos y en la portada.`,
      error ? 'error' : 'success'
    )
  })

}
loadLanzamientos().catch(() => {})

// ── Las preguntas más falladas ──
// Cruza question_stats (el contador público de aciertos por pregunta)
// con los bloques de cada curso publicado, casando por la MISMA clave
// que usa el juego (claveDePregunta): si el autor cambia el enunciado,
// la clave cambia y las estadísticas viejas quedan huérfanas — se
// enseñan aparte, que también cuentan una historia.
function resumenDePregunta(b) {
  const texto =
    b.question || b.statement || b.title ||
    (b.before || b.after ? `${b.before || ''} ___ ${b.after || ''}` : '') ||
    b.headline || ''
  const t = String(texto).trim()
  return t.length > 90 ? t.slice(0, 87) + '…' : t || `(${b.type})`
}

const MINIMO_RESPUESTAS = 3

document.getElementById('btnPreguntasFalladas').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  const hueco = document.getElementById('preguntasFalladas')
  btn.disabled = true
  const etiquetaOriginal = btn.textContent
  btn.textContent = 'Cruzando datos…'
  try {
    const [{ data: stats }, { data: guias }] = await Promise.all([
      supabase.from('question_stats').select('guide_id, question_key, times_answered, times_correct').limit(5000),
      supabase.from('guides').select('id, slug, title, blocks').not('published_at', 'is', null),
    ])

    // El mapa clave → pregunta de cada curso, con la clave del juego.
    const preguntaPor = {}
    for (const g of guias || []) {
      for (const b of g.blocks || []) {
        if (!esPractica(b)) continue
        const clave = claveDePregunta(b)
        if (clave) preguntaPor[`${g.id}|${clave}`] = { guia: g, texto: resumenDePregunta(b) }
      }
    }

    const filas = []
    const huerfanas = []
    for (const f of stats || []) {
      if ((f.times_answered || 0) < MINIMO_RESPUESTAS) continue
      const pct = Math.round(((f.times_correct || 0) / f.times_answered) * 100)
      const pregunta = preguntaPor[`${f.guide_id}|${f.question_key}`]
      if (pregunta) filas.push({ ...pregunta, veces: f.times_answered, pct })
      else huerfanas.push({ guide_id: f.guide_id, veces: f.times_answered, pct })
    }
    filas.sort((a, b) => a.pct - b.pct)
    const peores = filas.slice(0, 20)

    hueco.innerHTML = `
      <div class="admin-revision">
        <p class="admin-revision-titulo">Las preguntas con peor acierto (mínimo ${MINIMO_RESPUESTAS} respuestas; un % muy bajo suele significar pregunta confusa o respuesta mal marcada):</p>
        ${
          peores.length
            ? `<ul>${peores
                .map(
                  (f) => `<li><strong class="${f.pct < 40 ? 'falladas-critica' : ''}">${f.pct}%</strong> de acierto (${f.veces} respuestas) — «${escapeHtml(f.texto)}» · <a href="editor-guia.html?id=${encodeURIComponent(f.guia.id)}">${escapeHtml(f.guia.title)}</a></li>`
                )
                .join('')}</ul>`
            : `<p>Todavía no hay preguntas con ${MINIMO_RESPUESTAS} o más respuestas. Volverá a haber chicha cuando la gente juegue.</p>`
        }
        ${
          huerfanas.length
            ? `<p class="subtext">Además hay ${huerfanas.length} ${huerfanas.length === 1 ? 'estadística huérfana' : 'estadísticas huérfanas'} de preguntas ya retiradas o reescritas (al cambiar el enunciado, la clave cambia y el contador empieza de cero).</p>`
            : ''
        }
      </div>`
    hueco.classList.remove('hidden')
  } catch (err) {
    showToast('No se pudo cruzar: ' + (err?.message || err), 'error')
  }
  btn.disabled = false
  btn.textContent = etiquetaOriginal
})

// ── El chequeo de cursos ──
// Repasa los bloques de todos los cursos publicados con js/curso-lint.js
// y pinta la lista de lo que cojea. Un curso con un índice mal o un slug
// roto no da error ruidoso en la web — la pregunta simplemente se
// comporta raro — así que este repaso es la única forma de enterarse
// antes de que le toque a alguien.
document.getElementById('btnRevisarCursos').addEventListener('click', async (e) => {
  const btn = e.currentTarget
  const hueco = document.getElementById('revisionCursos')
  btn.disabled = true
  const etiquetaOriginal = btn.textContent
  btn.textContent = 'Revisando…'
  try {
    const { data: guias } = await supabase
      .from('guides')
      .select('id, slug, title, blocks')
      .not('published_at', 'is', null)
    const lista = guias || []
    const slugsPublicados = new Set(lista.map((g) => g.slug).filter(Boolean))
    const conCurso = lista.filter((g) => Array.isArray(g.blocks) && g.blocks.length > 0)
    const hallazgos = []
    for (const g of conCurso) {
      for (const aviso of revisarBloques(g.blocks, slugsPublicados)) {
        hallazgos.push({ guia: g, aviso })
      }
    }
    hueco.innerHTML = hallazgos.length
      ? `<div class="admin-revision">
           <p class="admin-revision-titulo">${hallazgos.length} ${hallazgos.length === 1 ? 'aviso' : 'avisos'} en ${new Set(hallazgos.map((h) => h.guia.id)).size} de ${conCurso.length} cursos:</p>
           <ul>
             ${hallazgos
               .map(
                 (h) => `<li><a href="editor-guia.html?id=${encodeURIComponent(h.guia.id)}">${escapeHtml(h.guia.title)}</a> — ${escapeHtml(h.aviso)}</li>`
               )
               .join('')}
           </ul>
         </div>`
      : `<div class="admin-revision admin-revision-limpia"><p>${conCurso.length} cursos revisados y ni un solo aviso. Impecable.</p></div>`
    hueco.classList.remove('hidden')
  } catch (err) {
    showToast('No se pudo revisar: ' + (err?.message || err), 'error')
  }
  btn.disabled = false
  btn.textContent = etiquetaOriginal
})

document.getElementById('btnMigrateOldGuides').addEventListener('click', async (e) => {
  if (!confirm('Esto convierte las guías con el formato de bloques antiguo a un único bloque de texto enriquecido (lo mismo que pasaría si abrieras y guardases cada una en el editor nuevo). ¿Continuar?')) return

  const btn = e.currentTarget
  btn.disabled = true
  const originalLabel = btn.textContent
  btn.textContent = 'Adaptando…'

  const { data: guides } = await supabase.from('guides').select('id, reference_blocks')
  let migrated = 0
  for (const g of guides || []) {
    const blocks = g.reference_blocks || []
    const alreadyMigrated = blocks.length === 1 && blocks[0]?.type === 'richtext'
    if (alreadyMigrated || blocks.length === 0) continue
    const html = renderReferenceBlocksHtml(blocks)
    await supabase.from('guides').update({ reference_blocks: [{ type: 'richtext', html }] }).eq('id', g.id)
    migrated++
  }

  btn.disabled = false
  btn.textContent = originalLabel
  showToast(migrated > 0 ? `Se adaptaron ${migrated} guías al nuevo formato.` : 'No había guías con el formato antiguo.', 'success')
  loadGuides()
})


// ── Achievements ──
const CONDITION_LABELS = {
  completed_guides_count: 'Cursos completados',
  total_xp: 'XP total',
  quiz_correct_count: 'Preguntas acertadas',
  approved_guides_count: 'Guías aprobadas (autor)',
  forum_posts_count: 'Mensajes en el foro',
  forum_threads_count: 'Temas abiertos en el foro',
  forum_reactions_received: 'Reacciones recibidas en el foro',
}

async function loadAchievements() {
  const { data } = await supabase.from('achievement_definitions').select('*').order('xp_reward')
  const achievements = data || []

  document.getElementById('achievementsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Icono</th><th>Título</th><th>Rareza</th><th>Condición</th><th>XP</th><th>Activo</th><th></th></tr></thead>
      <tbody>
        ${achievements
          .map(
            (a) => `
          <tr>
            <td>${contentIconHtml(a.emoji, 20, 'trophy')}</td>
            <td>${escapeHtml(a.title)}</td>
            <td><span class="rarity-chip rarity-${a.rarity || 'bronze'}">${escapeHtml(a.rarity || 'bronze')}</span></td>
            <td>${CONDITION_LABELS[a.condition?.type] || a.condition?.type || '—'} ≥ ${a.condition?.count ?? '—'}</td>
            <td>${a.xp_reward || 0}</td>
            <td>${a.is_active ? '✓' : ''}</td>
            <td class="admin-row-actions">
              <button data-edit="${a.id}">Editar</button>
              <button class="danger" data-delete="${a.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#achievementsTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openAchievementModal(achievements.find((a) => a.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#achievementsTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este logro?')) return
      await supabase.from('achievement_definitions').delete().eq('id', btn.dataset.delete)
      invalidateAchievementsCache()
      loadAchievements()
    })
  )
}

function openAchievementModal(achievement) {
  const a = achievement || {
    id: '',
    title: '',
    description: '',
    emoji: 'trophy',
    icon_url: '',
    cover_image: '',
    rarity: 'bronze',
    xp_reward: 50,
    is_active: true,
    condition: { type: 'completed_guides_count', count: 1 },
  }
  openModal(`
    <h3>${achievement ? 'Editar' : 'Nuevo'} logro</h3>
    <div class="form-group"><label>Clave única (id)</label><input id="aId" value="${escapeHtml(a.id)}" placeholder="first_course" ${achievement ? 'disabled' : ''} /></div>
    <div class="form-group"><label>Título</label><input id="aTitle" value="${escapeHtml(a.title)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="aDescription">${escapeHtml(a.description || '')}</textarea></div>
    <div class="form-group"><label>Icono</label><input id="aEmoji" value="${escapeHtml(a.emoji || '')}" /></div>
    <div class="form-group"><label>Icono (URL, opcional)</label><input id="aIconUrl" value="${escapeHtml(a.icon_url || '')}" /></div>
    <div class="form-group"><label>Imagen de portada (URL, opcional)</label><input id="aCoverImage" value="${escapeHtml(a.cover_image || '')}" /></div>
    <div class="form-group"><label>Rareza</label>
      <select id="aRarity">
        ${['bronze', 'silver', 'gold', 'platinum'].map((r) => `<option value="${r}" ${a.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Tipo de condición</label>
      <select id="aConditionType">
        <option value="completed_guides_count" ${a.condition?.type === 'completed_guides_count' ? 'selected' : ''}>Cursos completados</option>
        <option value="total_xp" ${a.condition?.type === 'total_xp' ? 'selected' : ''}>XP total</option>
        <option value="quiz_correct_count" ${a.condition?.type === 'quiz_correct_count' ? 'selected' : ''}>Preguntas acertadas</option>
        <option value="approved_guides_count" ${a.condition?.type === 'approved_guides_count' ? 'selected' : ''}>Guías aprobadas (autor)</option>
        <option value="forum_posts_count" ${a.condition?.type === 'forum_posts_count' ? 'selected' : ''}>Mensajes en el foro</option>
        <option value="forum_threads_count" ${a.condition?.type === 'forum_threads_count' ? 'selected' : ''}>Temas abiertos en el foro</option>
        <option value="forum_reactions_received" ${a.condition?.type === 'forum_reactions_received' ? 'selected' : ''}>Reacciones recibidas en el foro</option>
      </select>
    </div>
    <div class="form-group"><label>Valor de la condición</label><input id="aConditionCount" type="number" value="${a.condition?.count ?? 1}" /></div>
    <div class="form-group"><label>XP de recompensa</label><input id="aXpReward" type="number" value="${a.xp_reward ?? 50}" /></div>
    <div class="form-group"><label><input type="checkbox" id="aIsActive" ${a.is_active ? 'checked' : ''} /> Activo</label></div>
    <button class="btn-primary btn-block" id="btnSaveAchievement">Guardar</button>`)

  attachEmojiPicker(document.getElementById('aEmoji'))

  document.getElementById('btnSaveAchievement').addEventListener('click', async () => {
    const payload = {
      title: document.getElementById('aTitle').value.trim(),
      description: document.getElementById('aDescription').value.trim(),
      emoji: document.getElementById('aEmoji').value.trim(),
      icon_url: document.getElementById('aIconUrl').value.trim() || null,
      cover_image: document.getElementById('aCoverImage').value.trim() || null,
      rarity: document.getElementById('aRarity').value,
      condition: {
        type: document.getElementById('aConditionType').value,
        count: Number(document.getElementById('aConditionCount').value) || 0,
      },
      xp_reward: Number(document.getElementById('aXpReward').value) || 0,
      is_active: document.getElementById('aIsActive').checked,
    }
    if (achievement) {
      payload.id = a.id
    } else {
      const newId = document.getElementById('aId').value.trim()
      if (!newId) return
      payload.id = newId
    }
    const { error } = await supabase.from('achievement_definitions').upsert(payload)
    if (error) {
      showToast('No se pudo guardar el logro: ' + error.message)
      return
    }
    invalidateAchievementsCache()
    closeModal()
    loadAchievements()
  })
}

document.getElementById('btnNewAchievement').addEventListener('click', () => openAchievementModal(null))

// ── Users ──

// La paleta de colores para los títulos. Cerrada a propósito: el valor
// acaba en un atributo style de cada mensaje del foro, así que aquí no se
// escribe un color a mano — se elige de una lista que ya se sabe legible
// sobre el fondo del foro.
const COLORES_TITULO = [
  ['', 'Sin color'],
  ['#eab308', 'Dorado'],
  ['#f87171', 'Rojo'],
  ['#34d399', 'Verde'],
  ['#5b9cf8', 'Azul'],
  ['#a78bfa', 'Violeta'],
  ['#22d3ee', 'Cian'],
  ['#f472b6', 'Rosa'],
  ['#fb923c', 'Naranja'],
]

function selectorColorTituloHtml(u) {
  // Un color puesto por SQL que no esté en la paleta se enseña como
  // opción extra: si no, con solo abrir y guardar se perdería.
  const actual = u.forum_title_color || ''
  const opciones = COLORES_TITULO.some(([hex]) => hex === actual)
    ? COLORES_TITULO
    : [[actual, actual], ...COLORES_TITULO]
  return `<select data-color-titulo="${u.id}" aria-label="Color del título" style="width:110px;${
    actual ? ` color:${actual};` : ''
  }">
    ${opciones
      .map(
        ([hex, nombre]) =>
          `<option value="${hex}" ${hex === actual ? 'selected' : ''}${hex ? ` style="color:${hex}"` : ''}>${escapeHtml(nombre)}</option>`
      )
      .join('')}
  </select>`
}

async function loadUsers() {
  // is_moderator y forum_title son de supabase-migration-foro-titulos.sql,
  // y forum_title_color de supabase-migration-titulos-color.sql. Son DOS
  // migraciones: se pide primero todo, y se va degradando — sin color, y
  // si tampoco, sin foro — para que la tabla de usuarios nunca quede en
  // blanco por una columna que falta.
  let { data, error } = await supabase
    .from('user_profiles')
    .select(
      'id, username, display_name, total_xp, level, is_admin, is_pro, is_banned, is_muted, is_moderator, forum_title, forum_title_color'
    )
    .order('total_xp', { ascending: false })
  let conColor = !error
  if (error) {
    ;({ data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, total_xp, level, is_admin, is_pro, is_banned, is_muted, is_moderator, forum_title')
      .order('total_xp', { ascending: false }))
  }
  let conForo = !error
  if (error) {
    const alterno = await supabase
      .from('user_profiles')
      .select('id, username, display_name, total_xp, level, is_admin, is_pro, is_banned, is_muted')
      .order('total_xp', { ascending: false })
    data = alterno.data
  }
  const users = data || []

  document.getElementById('usersTable').innerHTML = `
    ${
      conForo
        ? `<p class="admin-note">El <strong>título de foro</strong> es lo que se lee bajo el nombre de esa persona en cada
             mensaje ("Miembro del equipo", "Perito de falsificaciones"…). Es solo reconocimiento: no da ningún permiso.
             La <strong>moderación</strong> sí: puede fijar, cerrar, editar y borrar en el foro, pero no entra aquí.${
               conColor
                 ? ' El color pinta el título en el foro — el dorado de un veterano se ve de lejos.'
                 : ' Para poder darles color, falta ejecutar supabase-migration-titulos-color.sql.'
             }</p>`
        : `<p class="admin-note">Para los títulos de foro y la moderación, falta ejecutar supabase-migration-foro-titulos.sql.</p>`
    }
    <table class="admin-table">
      <thead><tr><th>Nombre</th><th>Nivel</th><th>XP</th><th>Admin</th><th>Pro</th>${
        conForo ? '<th>Título de foro</th>' : ''
      }<th>Estado</th><th></th></tr></thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.display_name || u.username || u.id)}</td>
            <td>${escapeHtml(u.level || 'Novato')}</td>
            <td>${u.total_xp || 0}</td>
            <td>${u.is_admin ? '✓' : ''}</td>
            <td>${u.is_pro ? '✓' : ''}</td>
            ${
              conForo
                ? `<td><input type="text" value="${escapeHtml(u.forum_title || '')}" data-titulo-foro="${u.id}"
                       placeholder="Sin título" style="width:170px;" />${conColor ? ' ' + selectorColorTituloHtml(u) : ''}</td>`
                : ''
            }
            <td>${u.is_banned ? `${icons.ban(14)} Baneado` : u.is_muted ? `${icons.volumeX(14)} Silenciado` : ''}${
              u.is_moderator ? `${icons.shield(14)} Moderación` : ''
            }</td>
            <td class="admin-row-actions">
              ${conForo ? `<button data-guardar-titulo="${u.id}">Guardar título</button>` : ''}
              ${
                conForo
                  ? `<button data-toggle-mod="${u.id}" data-current="${u.is_moderator ? '1' : '0'}">${
                      u.is_moderator ? 'Quitar moderación' : 'Hacer moderador/a'
                    }</button>`
                  : ''
              }
              <button data-toggle-admin="${u.id}" data-current="${u.is_admin ? '1' : '0'}">${u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
              <button data-toggle-pro="${u.id}" data-current="${u.is_pro ? '1' : '0'}">${u.is_pro ? 'Quitar Pro' : 'Hacer Pro'}</button>
              <button data-toggle-muted="${u.id}" data-current="${u.is_muted ? '1' : '0'}">${u.is_muted ? 'Quitar silencio' : 'Silenciar'}</button>
              <button data-toggle-banned="${u.id}" data-current="${u.is_banned ? '1' : '0'}">${u.is_banned ? 'Quitar baneo' : 'Banear'}</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('[data-guardar-titulo]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const id = btn.dataset.guardarTitulo
      const valor = document.querySelector(`[data-titulo-foro="${id}"]`).value.trim()
      const cambios = { forum_title: valor || null }
      if (conColor) {
        // El color solo tiene sentido CON título: guardar un color de un
        // título vacío dejaría un dato huérfano esperando a confundir.
        const color = document.querySelector(`[data-color-titulo="${id}"]`)?.value || null
        cambios.forum_title_color = valor ? color : null
      }
      const { error: err } = await supabase.from('user_profiles').update(cambios).eq('id', id)
      showToast(err ? 'No se ha podido guardar: ' + err.message : 'Título guardado.', err ? 'error' : 'success')
    })
  )

  document.querySelectorAll('[data-toggle-mod]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const nombrar = btn.dataset.current !== '1'
      if (
        !confirm(
          nombrar
            ? 'Va a poder fijar, cerrar, editar y borrar en el foro (pero no entrar a este panel). ¿Continuar?'
            : '¿Quitarle la moderación del foro?'
        )
      )
        return
      const { error: err } = await supabase.from('user_profiles').update({ is_moderator: nombrar }).eq('id', btn.dataset.toggleMod)
      if (err) showToast('No se ha podido: ' + err.message)
      loadUsers()
    })
  )

  document.querySelectorAll('[data-toggle-admin]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const makeAdmin = btn.dataset.current !== '1'
      const confirmMsg = makeAdmin
        ? 'Vas a dar acceso de admin completo a esta persona (podrá gestionar guías, usuarios, reportes y más). ¿Continuar?'
        : '¿Quitarle el acceso de admin a esta persona?'
      if (!confirm(confirmMsg)) return
      await supabase.from('user_profiles').update({ is_admin: makeAdmin }).eq('id', btn.dataset.toggleAdmin)
      loadUsers()
    })
  )
  document.querySelectorAll('[data-toggle-pro]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const makePro = btn.dataset.current !== '1'
      await supabase.from('user_profiles').update({ is_pro: makePro }).eq('id', btn.dataset.togglePro)
      loadUsers()
    })
  )
  document.querySelectorAll('[data-toggle-muted]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const makeMuted = btn.dataset.current !== '1'
      await supabase.from('user_profiles').update({ is_muted: makeMuted }).eq('id', btn.dataset.toggleMuted)
      loadUsers()
    })
  )
  document.querySelectorAll('[data-toggle-banned]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const makeBanned = btn.dataset.current !== '1'
      const confirmMsg = makeBanned
        ? 'Vas a banear a esta persona: se le cerrará la sesión y no podrá volver a entrar ni publicar nada. ¿Continuar?'
        : '¿Quitarle el baneo a esta persona?'
      if (!confirm(confirmMsg)) return
      await supabase.from('user_profiles').update({ is_banned: makeBanned }).eq('id', btn.dataset.toggleBanned)
      loadUsers()
    })
  )
}

// ── Reportes de contenido ──
const REPORT_TYPE_LABELS = {
  guide: `${icons.bookOpen(14)} Guía`,
  profile_comment: `${icons.messageSquare(14)} Comentario de muro`,
  guide_comment: `${icons.messageSquare(14)} Comentario de guía`,
  profile_review: `${icons.star(14)} Reseña de perfil`,
  private_message: `${icons.mail(14)} Mensaje privado`,
}

function snippet(text, len = 90) {
  const clean = (text || '').trim()
  if (!clean) return '(sin texto)'
  return clean.length > len ? clean.slice(0, len) + '…' : clean
}

// Cada content_type reportado vive en una tabla distinta — sin esto el
// admin solo veía "Comentario de guía" o "Reseña de perfil" sin ningún
// rastro de QUÉ se reportó, así que no había forma de moderar sin ir a
// buscarlo a mano fila por fila.
async function loadContentPreviews(reports) {
  const idsByType = reports.reduce((acc, r) => {
    acc[r.content_type] = acc[r.content_type] || []
    acc[r.content_type].push(r.content_id)
    return acc
  }, {})
  const previews = {}

  if (idsByType.guide?.length > 0) {
    const { data } = await supabase.from('guides').select('id, title, slug').in('id', idsByType.guide)
    ;(data || []).forEach((g) => {
      previews[g.id] = { text: g.title, url: `/guia.html?slug=${encodeURIComponent(g.slug)}` }
    })
  }

  if (idsByType.guide_comment?.length > 0) {
    const { data: comments } = await supabase.from('guide_comments').select('id, body, guide_id').in('id', idsByType.guide_comment)
    const guideIds = [...new Set((comments || []).map((c) => c.guide_id))]
    const { data: guides } = guideIds.length > 0 ? await supabase.from('guides').select('id, slug').in('id', guideIds) : { data: [] }
    const slugById = Object.fromEntries((guides || []).map((g) => [g.id, g.slug]))
    ;(comments || []).forEach((c) => {
      previews[c.id] = { text: snippet(c.body), url: slugById[c.guide_id] ? `/guia.html?slug=${encodeURIComponent(slugById[c.guide_id])}` : null }
    })
  }

  if (idsByType.private_message?.length > 0) {
    // La política RLS de private_messages solo deja leer al admin las filas
    // que ya han sido reportadas (private_messages_admin_select_reported) —
    // nunca el resto de una conversación privada.
    const { data: messages } = await supabase.from('private_messages').select('id, body, sender_id').in('id', idsByType.private_message)
    const senderIds = [...new Set((messages || []).map((m) => m.sender_id))]
    const { data: senders } = senderIds.length > 0 ? await supabase.from('user_profiles').select('id, display_name, username').in('id', senderIds) : { data: [] }
    const senderById = Object.fromEntries((senders || []).map((p) => [p.id, p]))
    ;(messages || []).forEach((m) => {
      const sender = senderById[m.sender_id]
      const senderName = sender?.display_name || sender?.username || 'Usuario'
      previews[m.id] = { text: `De ${senderName}: ${snippet(m.body)}`, url: null }
    })
  }

  if (idsByType.profile_comment?.length > 0 || idsByType.profile_review?.length > 0) {
    const commentIds = idsByType.profile_comment || []
    const reviewIds = idsByType.profile_review || []
    const [{ data: comments }, { data: reviews }] = await Promise.all([
      commentIds.length > 0 ? supabase.from('profile_comments').select('id, body, profile_id').in('id', commentIds) : Promise.resolve({ data: [] }),
      reviewIds.length > 0 ? supabase.from('profile_reviews').select('id, body, rating, profile_id').in('id', reviewIds) : Promise.resolve({ data: [] }),
    ])
    const profileIds = [...new Set([...(comments || []), ...(reviews || [])].map((r) => r.profile_id))]
    const { data: profiles } = profileIds.length > 0 ? await supabase.from('user_profiles').select('id, username').in('id', profileIds) : { data: [] }
    const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
    ;(comments || []).forEach((c) => {
      const p = profileById[c.profile_id]
      previews[c.id] = { text: snippet(c.body), url: p ? profileUrl(p) : null }
    })
    ;(reviews || []).forEach((r) => {
      const p = profileById[r.profile_id]
      previews[r.id] = { text: `${'★'.repeat(r.rating)} ${snippet(r.body)}`, url: p ? profileUrl(p) : null }
    })
  }

  return previews
}

// ── El foro: montar la estructura ──
//
// Las secciones y los foros viven en la base de datos, no en el HTML, para
// poder abrir un foro nuevo sin desplegar. Aquí se crean, se renombran, se
// mueven de sitio y se esconden.
//
// La regla de oro es la contraria a la que apetece: NO abrir foros por si
// acaso. Un foro con "0 temas" desanima más que no tenerlo, así que se abre
// uno cuando un tema ya no cabe en los que hay.
async function loadForo() {
  const contenedor = document.getElementById('foroEstructura')
  if (!contenedor) return

  const [{ data: secciones, error }, { data: foros }] = await Promise.all([
    supabase.from('forum_sections').select('*').order('position'),
    supabase.from('forum_boards').select('*').order('position'),
  ])

  if (error) {
    contenedor.innerHTML = `<p class="admin-note">El foro todavía no está activado: falta ejecutar supabase-migration-foro.sql.</p>`
    return
  }

  const listaSecciones = secciones || []
  const listaForos = foros || []

  // Los desplegables de "nuevo foro"
  const selSeccion = document.getElementById('foroNuevoSeccion')
  const selPadre = document.getElementById('foroNuevoPadre')
  selSeccion.innerHTML = listaSecciones.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')
  selPadre.innerHTML =
    '<option value="">— Foro principal —</option>' +
    listaForos
      .filter((f) => !f.parent_id)
      .map((f) => `<option value="${f.id}">Dentro de ${escapeHtml(f.name)}</option>`)
      .join('')

  const hijosDe = (id) => listaForos.filter((f) => f.parent_id === id)

  const filaForo = (f, esHijo) => `
    <tr class="${esHijo ? 'foro-admin-hijo' : ''}">
      <td>${esHijo ? '<span class="foro-admin-rama">└</span> ' : ''}<input type="text" value="${escapeHtml(f.name)}" data-nombre="${f.id}" /></td>
      <td><input type="text" value="${escapeHtml(f.description || '')}" data-desc="${f.id}" placeholder="Sin descripción" /></td>
      <td><input type="number" value="${f.position}" data-pos="${f.id}" style="width:64px;" /></td>
      <td>
        <select data-politica="${f.id}">
          <option value="todos" ${f.post_policy === 'todos' ? 'selected' : ''}>Cualquiera</option>
          <option value="staff" ${f.post_policy === 'staff' ? 'selected' : ''}>Solo equipo</option>
        </select>
      </td>
      <td><label class="foro-admin-check"><input type="checkbox" data-oculto="${f.id}" ${f.is_hidden ? 'checked' : ''} /> Oculto</label></td>
      <td>
        <button class="btn-secondary" data-guardar-foro="${f.id}">Guardar</button>
        <button class="admin-danger" data-borrar-foro="${f.id}">Borrar</button>
      </td>
    </tr>`

  contenedor.innerHTML = listaSecciones
    .map((s) => {
      const suyos = listaForos.filter((f) => f.section_id === s.id && !f.parent_id)
      return `
      <div class="admin-card" style="margin-bottom:18px;">
        <div class="foro-admin-fila">
          <input type="text" value="${escapeHtml(s.name)}" data-seccion-nombre="${s.id}" />
          <input type="number" value="${s.position}" data-seccion-pos="${s.id}" style="width:64px;" />
          <button class="btn-secondary" data-guardar-seccion="${s.id}">Guardar</button>
          <button class="admin-danger" data-borrar-seccion="${s.id}">Borrar sección</button>
        </div>
        ${
          suyos.length === 0
            ? '<p class="admin-note" style="margin:12px 0 0;">Esta sección no tiene foros todavía.</p>'
            : `<table class="admin-table" style="margin-top:12px;">
                 <thead><tr><th>Foro</th><th>Descripción</th><th>Orden</th><th>Quién escribe</th><th></th><th></th></tr></thead>
                 <tbody>${suyos
                   .map((f) => filaForo(f, false) + hijosDe(f.id).map((h) => filaForo(h, true)).join(''))
                   .join('')}</tbody>
               </table>`
        }
      </div>`
    })
    .join('')

  contenedor.querySelectorAll('[data-guardar-foro]').forEach((b) =>
    b.addEventListener('click', () => guardarForo(b.dataset.guardarForo))
  )
  contenedor.querySelectorAll('[data-borrar-foro]').forEach((b) =>
    b.addEventListener('click', () => borrarForo(b.dataset.borrarForo))
  )
  contenedor.querySelectorAll('[data-guardar-seccion]').forEach((b) =>
    b.addEventListener('click', () => guardarSeccion(b.dataset.guardarSeccion))
  )
  contenedor.querySelectorAll('[data-borrar-seccion]').forEach((b) =>
    b.addEventListener('click', () => borrarSeccion(b.dataset.borrarSeccion))
  )
}

async function guardarForo(id) {
  const cambios = {
    name: document.querySelector(`[data-nombre="${id}"]`).value.trim(),
    description: document.querySelector(`[data-desc="${id}"]`).value.trim() || null,
    position: Number(document.querySelector(`[data-pos="${id}"]`).value) || 0,
    post_policy: document.querySelector(`[data-politica="${id}"]`).value,
    is_hidden: document.querySelector(`[data-oculto="${id}"]`).checked,
  }
  const { error } = await supabase.from('forum_boards').update(cambios).eq('id', id)
  showToast(error ? 'No se ha podido guardar: ' + error.message : 'Guardado.', error ? 'error' : 'success')
  if (!error) loadForo()
}

// Borrar un foro se lleva por delante sus temas y mensajes. Se avisa con
// el número exacto, no con un "¿seguro?" a secas: no es lo mismo tirar un
// foro vacío que uno con doscientos mensajes dentro.
async function borrarForo(id) {
  const { count } = await supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('board_id', id)
  const temas = count || 0
  if (!confirm(temas === 0 ? '¿Borrar este foro?' : `Este foro tiene ${temas} tema(s), y se borrarán con él. ¿Seguro?`)) return
  const { error } = await supabase.from('forum_boards').delete().eq('id', id)
  showToast(error ? 'No se ha podido borrar: ' + error.message : 'Borrado.', error ? 'error' : 'success')
  if (!error) loadForo()
}

async function guardarSeccion(id) {
  const { error } = await supabase
    .from('forum_sections')
    .update({
      name: document.querySelector(`[data-seccion-nombre="${id}"]`).value.trim(),
      position: Number(document.querySelector(`[data-seccion-pos="${id}"]`).value) || 0,
    })
    .eq('id', id)
  showToast(error ? 'No se ha podido guardar: ' + error.message : 'Guardado.', error ? 'error' : 'success')
  if (!error) loadForo()
}

async function borrarSeccion(id) {
  const { count } = await supabase.from('forum_boards').select('*', { count: 'exact', head: true }).eq('section_id', id)
  if (!confirm(count ? `La sección tiene ${count} foro(s), y se borrarán con ella. ¿Seguro?` : '¿Borrar esta sección?')) return
  const { error } = await supabase.from('forum_sections').delete().eq('id', id)
  showToast(error ? 'No se ha podido borrar: ' + error.message : 'Borrada.', error ? 'error' : 'success')
  if (!error) loadForo()
}

// El slug se saca del nombre y se le pega un sufijo si ya existe: es lo
// que va en la URL, y una colisión silenciosa dejaría dos foros peleándose
// por la misma dirección.
async function slugLibre(nombre) {
  const base = slugify(nombre) || 'foro'
  const { data } = await supabase.from('forum_boards').select('slug').like('slug', `${base}%`)
  const usados = new Set((data || []).map((f) => f.slug))
  if (!usados.has(base)) return base
  let n = 2
  while (usados.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

document.getElementById('btnCrearSeccion')?.addEventListener('click', async () => {
  const nombre = document.getElementById('foroSeccionNombre').value.trim()
  if (!nombre) return showToast('Ponle nombre a la sección.')
  const { error } = await supabase.from('forum_sections').insert({ name: nombre, position: 99 })
  if (error) return showToast('No se ha podido crear: ' + error.message)
  document.getElementById('foroSeccionNombre').value = ''
  showToast('Sección creada.', 'success')
  loadForo()
})

document.getElementById('btnCrearForo')?.addEventListener('click', async () => {
  const nombre = document.getElementById('foroNuevoNombre').value.trim()
  const seccion = document.getElementById('foroNuevoSeccion').value
  if (!nombre) return showToast('Ponle nombre al foro.')
  if (!seccion) return showToast('Crea antes una sección.')

  const { error } = await supabase.from('forum_boards').insert({
    section_id: seccion,
    parent_id: document.getElementById('foroNuevoPadre').value || null,
    name: nombre,
    slug: await slugLibre(nombre),
    description: document.getElementById('foroNuevaDescripcion').value.trim() || null,
    post_policy: document.getElementById('foroNuevoPolitica').value,
    position: 99,
  })
  if (error) return showToast('No se ha podido crear: ' + error.message)
  document.getElementById('foroNuevoNombre').value = ''
  document.getElementById('foroNuevaDescripcion').value = ''
  showToast('Foro creado.', 'success')
  loadForo()
})

async function loadReports() {
  const { data } = await supabase
    .from('content_reports')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const reports = data || []
  ponerContadorNav('reports', reports.length)
  const reporterIds = [...new Set(reports.map((r) => r.reporter_id))]
  const [reportersData, previews] = await Promise.all([
    reporterIds.length > 0
      ? supabase.from('user_profiles').select('id, display_name, username').in('id', reporterIds)
      : Promise.resolve({ data: [] }),
    loadContentPreviews(reports),
  ])
  const reportersById = Object.fromEntries((reportersData.data || []).map((r) => [r.id, r]))

  const container = document.getElementById('reportsTable')
  if (reports.length === 0) {
    container.innerHTML = `<p class="empty-state">No hay reportes pendientes.</p>`
    return
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Tipo</th><th>Contenido reportado</th><th>Motivo</th><th>Reportado por</th><th>Fecha</th><th></th></tr></thead>
      <tbody>
        ${reports
          .map((r) => {
            const reporter = reportersById[r.reporter_id]
            const reporterName = reporter?.display_name || reporter?.username || 'Usuario'
            const preview = previews[r.content_id]
            return `
          <tr>
            <td>${REPORT_TYPE_LABELS[r.content_type] || r.content_type}</td>
            <td>${
              preview
                ? preview.url
                  ? `<a href="${preview.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(preview.text)}</a>`
                  : escapeHtml(preview.text)
                : '<em>Contenido eliminado</em>'
            }</td>
            <td>${escapeHtml(r.reason || '—')}</td>
            <td>${escapeHtml(reporterName)}</td>
            <td>${new Date(r.created_at).toLocaleDateString('es-ES')}</td>
            <td class="admin-row-actions">
              <button data-report-reviewed="${r.id}">Marcar revisado</button>
              <button data-report-dismiss="${r.id}">Descartar</button>
            </td>
          </tr>`
          })
          .join('')}
      </tbody>
    </table>`

  container.querySelectorAll('[data-report-reviewed]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await supabase.from('content_reports').update({ status: 'reviewed' }).eq('id', btn.dataset.reportReviewed)
      loadReports()
    })
  )
  container.querySelectorAll('[data-report-dismiss]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await supabase.from('content_reports').update({ status: 'dismissed' }).eq('id', btn.dataset.reportDismiss)
      loadReports()
    })
  )
}

// ── Feedback general (bugs/sugerencias, no ligado a contenido concreto) ──
async function loadFeedback() {
  const { data } = await supabase
    .from('app_feedback')
    .select('*')
    .eq('status', 'new')
    .order('created_at', { ascending: true })

  const items = data || []
  ponerContadorNav('feedback', items.length)
  const userIds = [...new Set(items.map((f) => f.user_id))]
  const { data: usersData } = userIds.length > 0 ? await supabase.from('user_profiles').select('id, display_name, username').in('id', userIds) : { data: [] }
  const userById = Object.fromEntries((usersData || []).map((u) => [u.id, u]))

  const container = document.getElementById('feedbackTable')
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">No hay feedback nuevo.</p>`
    return
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>De</th><th>Mensaje</th><th>Página</th><th>Fecha</th><th></th></tr></thead>
      <tbody>
        ${items
          .map((f) => {
            const user = userById[f.user_id]
            const userName = user?.display_name || user?.username || 'Usuario'
            return `
          <tr>
            <td>${escapeHtml(userName)}</td>
            <td>${escapeHtml(f.body)}</td>
            <td>${escapeHtml(f.page_url || '—')}</td>
            <td>${new Date(f.created_at).toLocaleDateString('es-ES')}</td>
            <td class="admin-row-actions">
              <button data-feedback-reviewed="${f.id}">Marcar revisado</button>
              <button data-feedback-dismiss="${f.id}">Descartar</button>
            </td>
          </tr>`
          })
          .join('')}
      </tbody>
    </table>`

  container.querySelectorAll('[data-feedback-reviewed]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await supabase.from('app_feedback').update({ status: 'reviewed' }).eq('id', btn.dataset.feedbackReviewed)
      loadFeedback()
    })
  )
  container.querySelectorAll('[data-feedback-dismiss]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await supabase.from('app_feedback').update({ status: 'dismissed' }).eq('id', btn.dataset.feedbackDismiss)
      loadFeedback()
    })
  )
}

// ── Solicitudes de borrado de cuenta ──
// Solo registra la solicitud: el borrado en sí (auth.users con la service
// role key) hay que hacerlo a mano desde el dashboard de Supabase, porque
// no sabemos cómo se comportan las claves foráneas ya existentes en la
// base real ante ese borrado (cascada, restricción...) y un intento
// automático a ciegas podría fallar a medias o dejar datos huérfanos.
async function loadAccountDeletionRequests() {
  const { data } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const items = data || []
  ponerContadorNav('account-deletions', items.length)
  const userIds = [...new Set(items.map((r) => r.user_id))]
  const { data: usersData } = userIds.length > 0 ? await supabase.from('user_profiles').select('id, display_name, username').in('id', userIds) : { data: [] }
  const userById = Object.fromEntries((usersData || []).map((u) => [u.id, u]))

  const container = document.getElementById('accountDeletionTable')
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">No hay solicitudes de borrado pendientes.</p>`
    return
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Usuario</th><th>Fecha</th><th></th></tr></thead>
      <tbody>
        ${items
          .map((r) => {
            const user = userById[r.user_id]
            const userName = user?.display_name || user?.username || 'Usuario'
            return `
          <tr>
            <td>${escapeHtml(userName)}</td>
            <td>${new Date(r.created_at).toLocaleDateString('es-ES')}</td>
            <td class="admin-row-actions">
              <button data-deletion-done="${r.id}">Marcar hecha</button>
              <button data-deletion-dismiss="${r.id}">Descartar</button>
            </td>
          </tr>`
          })
          .join('')}
      </tbody>
    </table>`

  container.querySelectorAll('[data-deletion-done]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Confirmas que ya has borrado esta cuenta a mano en Supabase? Esto solo marca la solicitud como hecha, no borra nada por sí solo.')) return
      await supabase.from('account_deletion_requests').update({ status: 'done' }).eq('id', btn.dataset.deletionDone)
      loadAccountDeletionRequests()
    })
  )
  container.querySelectorAll('[data-deletion-dismiss]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await supabase.from('account_deletion_requests').update({ status: 'dismissed' }).eq('id', btn.dataset.deletionDismiss)
      loadAccountDeletionRequests()
    })
  )
}

// ── Errores de cliente (registrados automáticamente desde error-log.js) ──
async function loadClientErrors() {
  const { data } = await supabase
    .from('client_errors')
    .select('*')
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(50)

  const items = data || []
  ponerContadorNav('errors', items.length)
  const userIds = [...new Set(items.map((e) => e.user_id).filter(Boolean))]
  const { data: usersData } = userIds.length > 0 ? await supabase.from('user_profiles').select('id, display_name, username').in('id', userIds) : { data: [] }
  const userById = Object.fromEntries((usersData || []).map((u) => [u.id, u]))

  const container = document.getElementById('errorsTable')
  if (items.length === 0) {
    container.innerHTML = `<p class="empty-state">No hay errores nuevos.</p>`
    return
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Mensaje</th><th>Página</th><th>Usuario</th><th>Fecha</th><th></th></tr></thead>
      <tbody>
        ${items
          .map((e) => {
            const user = e.user_id ? userById[e.user_id] : null
            const userName = user?.display_name || user?.username || (e.user_id ? 'Usuario' : 'Anónimo')
            return `
          <tr>
            <td title="${escapeHtml(e.stack || '')}">${escapeHtml(e.message)}</td>
            <td>${escapeHtml(e.page_url || '—')}</td>
            <td>${escapeHtml(userName)}</td>
            <td>${new Date(e.created_at).toLocaleString('es-ES')}</td>
            <td class="admin-row-actions">
              <button data-error-reviewed="${e.id}">Marcar revisado</button>
              <button data-error-dismiss="${e.id}">Descartar</button>
            </td>
          </tr>`
          })
          .join('')}
      </tbody>
    </table>`

  container.querySelectorAll('[data-error-reviewed]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await supabase.from('client_errors').update({ status: 'reviewed' }).eq('id', btn.dataset.errorReviewed)
      loadClientErrors()
    })
  )
  container.querySelectorAll('[data-error-dismiss]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await supabase.from('client_errors').update({ status: 'dismissed' }).eq('id', btn.dataset.errorDismiss)
      loadClientErrors()
    })
  )
}

// ── Analítica (page_views + progreso + contenido) — sin servicio externo ──

// Barra de una fila de tabla, para comparar magnitudes de un vistazo sin
// tener que leer los números.
function barCellHtml(value, max) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return `<span class="bar-cell" style="width:${pct}%"></span>`
}

function rankTableHtml(rows, headers, { max } = {}) {
  if (rows.length === 0) return `<p class="empty-state">Nada que mostrar todavía.</p>`
  const top = max ?? Math.max(...rows.map((r) => r.value))
  return `
    <table class="admin-table">
      <thead><tr><th>${headers[0]}</th><th style="width:90px;">${headers[1]}</th><th style="width:35%;"></th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td>${r.html || escapeHtml(r.label)}</td>
              <td><strong>${r.value}</strong>${r.suffix || ''}</td>
              <td>${barCellHtml(r.value, top)}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`
}

function statCardHtml(value, label, note = '') {
  return `<div class="admin-card">
    <div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${value}</div>
    <div>${escapeHtml(label)}</div>
    ${note ? `<div style="font-size:11.5px;color:var(--text-mid);margin-top:4px;">${escapeHtml(note)}</div>` : ''}
  </div>`
}

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10)
}

async function loadAnalytics() {
  const days = Number(document.getElementById('analyticsDays')?.value) || 7
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  // Las visitas se piden POR PÁGINAS. PostgREST corta cualquier consulta en
  // 1.000 filas aunque no pongas límite: con tráfico de verdad, pedirlas de
  // una vez enseñaría "1.000 visitas" para siempre, sin ningún aviso de que
  // faltan las demás.
  const todasLasVisitas = async () => {
    const POR_PAGINA = 1000
    const TOPE_PAGINAS = 50 // 50.000 visitas: de sobra, y sin bucles eternos
    const filas = []
    for (let pagina = 0; pagina < TOPE_PAGINAS; pagina++) {
      const desde = pagina * POR_PAGINA
      const res = await supabase
        .from('page_views')
        .select('path, user_id, created_at, is_bot')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .range(desde, desde + POR_PAGINA - 1)
      if (res.error) return { data: filas.length ? filas : null, error: res.error }
      filas.push(...(res.data || []))
      if ((res.data || []).length < POR_PAGINA) break
    }
    return { data: filas, error: null }
  }

  const [viewsRes, profilesRes, guidesRes, progressRes, guideCommentsRes, wallCommentsRes] = await Promise.all([
    todasLasVisitas(),
    supabase.from('user_profiles').select('id, created_at, current_streak'),
    supabase.from('guides').select('id, title, slug, view_count, blocks').not('published_at', 'is', null),
    supabase.from('user_progress').select('guide_id, user_id, status, read_at'),
    supabase.from('guide_comments').select('id, created_at').gte('created_at', since),
    supabase.from('profile_comments').select('id, created_at').gte('created_at', since),
  ])

  // Lo que ha fallado se DICE.
  //
  // Antes esto no se miraba: si la consulta se caía —la tabla no existe
  // porque falta la migración, la RLS no deja leerla, lo que sea— se
  // cogía `|| []` y la pantalla enseñaba un tranquilo "0 visitas". Un
  // cero y un error se veían exactamente igual, así que no había forma
  // de saber si la analítica estaba vacía o rota.
  //
  // `user_progress` ya se contaba aparte porque tiene su propia
  // migración; ahora se avisa de todas por el mismo sitio.
  const fallos = [
    ['page_views', viewsRes.error, 'supabase-migration-page-views.sql (y supabase-migration-visitas-bots.sql)'],
    ['user_profiles', profilesRes.error, null],
    ['guides', guidesRes.error, null],
    ['user_progress', progressRes.error, 'supabase-migration-admin-analytics.sql'],
    ['guide_comments', guideCommentsRes.error, null],
    ['profile_comments', wallCommentsRes.error, null],
  ].filter(([, error]) => error)

  document.getElementById('analyticsErrores').innerHTML = fallos.length
    ? `<div class="admin-warning">
         <strong>Faltan datos: ${fallos.length === 1 ? 'una consulta ha fallado' : `${fallos.length} consultas han fallado`}.</strong>
         Lo que salga a cero aquí abajo puede ser eso y no que no haya pasado nada.
         <ul style="margin: 8px 0 0; padding-left: 20px;">
           ${fallos
             .map(
               ([tabla, error, migracion]) =>
                 `<li><code>${escapeHtml(tabla)}</code>: ${escapeHtml(error.message || 'error desconocido')}${
                   migracion ? ` — prueba a aplicar <code>${escapeHtml(migracion)}</code>.` : ''
                 }</li>`
             )
             .join('')}
         </ul>
       </div>`
    : ''

  const views = viewsRes.data || []
  const profiles = profilesRes.data || []
  const guides = guidesRes.data || []
  const progress = progressRes.data || []

  // ── Personas y robots, por separado ──
  //
  // Google (y otros) ejecutan JavaScript al indexar, así que cada pasada
  // suya dispara el registro de visitas igual que una persona. Al separar
  // apareció la foto real: cientos de "visitas" al día que eran un
  // rastreador yendo de guía en guía. La clasificación la hace el navegador
  // al registrar (js/page-views.js); las filas de antes de la migración van
  // sin clasificar (null) y se dicen tal cual, no se cuelan en ningún bando.
  const personas = views.filter((v) => v.is_bot === false)
  const robots = views.filter((v) => v.is_bot === true)
  const sinClasificar = views.length - personas.length - robots.length

  // ── Resumen ──
  const withSession = personas.filter((v) => v.user_id)
  const activeUsers = new Set(withSession.map((v) => v.user_id)).size
  const newUsers = profiles.filter((p) => p.created_at && p.created_at >= since).length
  const pctLogged = personas.length ? Math.round((withSession.length / personas.length) * 100) : 0
  const withStreak = profiles.filter((p) => (p.current_streak || 0) > 1).length

  document.getElementById('analyticsSummary').innerHTML = [
    statCardHtml(personas.length, 'Visitas de personas', `en los últimos ${days} días`),
    statCardHtml(
      robots.length,
      'De robots',
      `buscadores indexando${sinClasificar ? ` · ${sinClasificar} antiguas sin clasificar` : ''}`
    ),
    statCardHtml(activeUsers, 'Usuarios activos', 'con sesión iniciada'),
    statCardHtml(newUsers, 'Altas nuevas', `en los últimos ${days} días`),
    statCardHtml(profiles.length, 'Usuarios registrados', 'en total'),
    statCardHtml(`${pctLogged}%`, 'Visitas con sesión', 'de las de personas'),
    statCardHtml(withStreak, 'Con racha viva', 'más de un día seguido'),
    statCardHtml(
      progressRes.error ? '—' : (progressRes.data || []).filter((p) => p.read_at).length,
      'Guías leídas',
      'en total, por todo el mundo'
    ),
  ].join('')

  // ── Visitas por día ──
  // Sin los robots: una gráfica dominada por el rastreo no dice nada de la
  // comunidad. Las antiguas sin clasificar SÍ entran — son mezcla, pero es
  // la única historia que existe de antes de la migración, y dejarla fuera
  // vaciaría la gráfica de golpe.
  const paraGrafica = views.filter((v) => v.is_bot !== true)
  const byDay = new Map()
  for (let i = days - 1; i >= 0; i--) byDay.set(dayKey(Date.now() - i * 86400_000), 0)
  for (const v of paraGrafica) {
    const k = dayKey(v.created_at)
    if (byDay.has(k)) byDay.set(k, byDay.get(k) + 1)
  }
  const dayEntries = [...byDay.entries()]
  const maxDay = Math.max(1, ...dayEntries.map(([, n]) => n))
  // Con 90 días no caben 90 etiquetas: se enseña una de cada N.
  const labelEvery = Math.ceil(dayEntries.length / 12)
  document.getElementById('analyticsChart').innerHTML = `
    <div class="chart-bars">
      ${dayEntries
        .map(([d, n]) => `<div class="chart-bar" title="${d}: ${n} visitas"><span class="fill" style="height:${Math.round((n / maxDay) * 100)}%"></span></div>`)
        .join('')}
    </div>
    <div class="chart-axis">
      ${dayEntries.map(([d], i) => `<span>${i % labelEvery === 0 ? d.slice(5) : ''}</span>`).join('')}
    </div>`

  // ── Páginas más visitadas ──
  // Se vuelve a normalizar AQUÍ, al leer, no solo al escribir: si no, las
  // filas ya guardadas ("/index.html", "/aprender.html", "/usuario/pingu")
  // seguirían apareciendo sueltas durante meses, que es justo el problema
  // que se está arreglando.
  const countByPath = paraGrafica.reduce((acc, v) => {
    const ruta = normalizePath(v.path)
    acc[ruta] = (acc[ruta] || 0) + 1
    return acc
  }, {})
  const pathRows = Object.entries(countByPath)
    .sort((a, b) => b[1] - a[1])
    .map(([path, value]) => ({
      html: `${escapeHtml(pageLabel(path))} <span class="admin-path">${escapeHtml(path)}</span>`,
      value,
    }))
  document.getElementById('analyticsTable').innerHTML = rankTableHtml(pathRows, ['Página', 'Visitas'])

  // ── Guías más vistas ──
  const guideRows = guides
    .filter((g) => (g.view_count || 0) > 0)
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 15)
    .map((g) => ({
      html: `<a href="/guia.html?slug=${encodeURIComponent(g.slug)}" target="_blank" rel="noopener">${escapeHtml(g.title)}</a>`,
      value: g.view_count || 0,
    }))
  document.getElementById('analyticsGuides').innerHTML = rankTableHtml(guideRows, ['Guía', 'Vistas'])

  // ── Cursos ──
  const note = document.getElementById('analyticsCoursesNote')
  const coursesWithBlocks = guides.filter((g) => Array.isArray(g.blocks) && g.blocks.length > 0)

  if (progressRes.error) {
    note.className = 'admin-note-warn'
    note.textContent = `No se ha podido leer user_progress: ${progressRes.error.message}. Aplica supabase-migration-admin-analytics.sql.`
    document.getElementById('analyticsCourses').innerHTML = ''
  } else {
    const distinctUsers = new Set(progress.map((p) => p.user_id)).size
    // Si solo aparece un usuario habiendo varios registrados, lo más
    // probable es que falte la política de lectura para admins y solo
    // estemos viendo el progreso propio.
    const looksRestricted = distinctUsers <= 1 && profiles.length > 1
    note.className = looksRestricted ? 'admin-note-warn' : 'admin-note'
    note.textContent = looksRestricted
      ? 'Solo se ve el progreso de un usuario. Si esperabas más, falta aplicar supabase-migration-admin-analytics.sql, que da lectura de user_progress al equipo.'
      : `Progreso de ${distinctUsers} usuario(s) sobre ${coursesWithBlocks.length} guías con curso.`

    const byGuide = new Map()
    for (const p of progress) {
      // Desde que existe `read_at`, una fila puede ser solo de lectura y
      // llevar `status` a null. Esas no son cursos empezados.
      if (!p.status) continue
      const e = byGuide.get(p.guide_id) || { started: 0, completed: 0 }
      if (p.status === 'completed') e.completed++
      else e.started++
      byGuide.set(p.guide_id, e)
    }
    const courseRows = coursesWithBlocks
      .map((g) => {
        const e = byGuide.get(g.id) || { started: 0, completed: 0 }
        const total = e.started + e.completed
        return {
          html: `${escapeHtml(g.title)}<div style="font-size:11.5px;color:var(--text-mid);">${e.completed} completado(s) · ${e.started} a medias</div>`,
          value: total,
          suffix: total > 0 ? ` <span style="font-weight:400;color:var(--text-mid);">(${Math.round((e.completed / total) * 100)}% acaba)</span>` : '',
        }
      })
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
    document.getElementById('analyticsCourses').innerHTML = rankTableHtml(courseRows, ['Curso', 'Lo han hecho'])
  }

  // ── Comunidad ──
  document.getElementById('analyticsCommunity').innerHTML = `<div class="admin-stats-grid">
    ${statCardHtml((guideCommentsRes.data || []).length, 'Comentarios en guías', `en los últimos ${days} días`)}
    ${statCardHtml((wallCommentsRes.data || []).length, 'Mensajes en muros', `en los últimos ${days} días`)}
    ${statCardHtml(guides.length, 'Guías publicadas', 'en total')}
    ${statCardHtml(coursesWithBlocks.length, 'De ellas con curso', 'el resto son solo documentación')}
  </div>`
}

// ── Base de datos: ¿está todo migrado? ──
//
// Una migración sin ejecutar no se nota hasta que alguien usa la función
// que la necesita. Pasó: faltaba guide_comments.reply_to_id y nadie
// podía comentar en ninguna guía, y el aviso que salía era un mensaje de
// PostgREST en inglés que no le dice a nadie qué hacer.

async function loadSchemaCheck() {
  const { resultados, faltan, dudas } = await checkSchema()

  document.getElementById('schemaSummary').innerHTML = [
    statCardHtml(resultados.length - faltan.length - dudas.length, 'Comprobaciones OK', 'de ' + resultados.length),
    statCardHtml(faltan.length, 'Migraciones sin ejecutar', faltan.length ? 'hay funciones rotas' : 'ninguna'),
    statCardHtml(dudas.length, 'Sin poder comprobar', 'permisos o red'),
  ].join('')

  // Agrupado por fichero: lo accionable es "ejecuta este .sql", no
  // "falta esta columna". Dos columnas del mismo fichero son una tarea.
  const porFichero = {}
  for (const r of faltan) (porFichero[r.fichero] ||= []).push(r)

  const pendientes = Object.entries(porFichero)
  document.getElementById('schemaTable').innerHTML = `
    ${
      pendientes.length
        ? `<div class="schema-alert">
             <strong>Faltan ${pendientes.length} migración(es) por ejecutar.</strong>
             Ábrelas en el SQL Editor de Supabase, pega el contenido y ejecútalas.
             <ul>${pendientes
               .map(
                 ([fichero, rs]) =>
                   `<li><code>${escapeHtml(fichero)}</code> — ${escapeHtml(rs.map((r) => r.rompe).join(' '))}</li>`
               )
               .join('')}</ul>
           </div>`
        : `<p class="schema-ok">Todo lo que el código necesita está en la base.</p>`
    }
    <table class="admin-table">
      <thead><tr><th>Comprobación</th><th style="width:110px;">Estado</th><th>Si falta</th></tr></thead>
      <tbody>
        ${resultados
          .map(
            (r) => `<tr>
              <td>${escapeHtml(r.tabla)}.${escapeHtml(r.columna)} <span class="admin-path">${escapeHtml(r.fichero)}</span></td>
              <td>${
                r.estado === 'ok'
                  ? '<span class="badge-ok">OK</span>'
                  : r.estado === 'falta'
                    ? '<span class="badge-falta">Falta</span>'
                    : '<span class="badge-pending">¿?</span>'
              }</td>
              <td>${escapeHtml(r.estado === 'ok' ? '' : r.rompe)}${r.detalle ? `<span class="admin-path">${escapeHtml(r.detalle)}</span>` : ''}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  // Y un aviso en el Dashboard, que es lo primero que se abre. Si solo
  // estuviera en su propia pestaña habría que sospechar antes de mirar,
  // y el problema es justo que no se sospecha.
  const banner = document.getElementById('schemaBanner')
  if (banner) {
    banner.innerHTML = pendientes.length
      ? `<div class="schema-alert">
           <strong>Faltan ${pendientes.length} migración(es) por ejecutar</strong> y hay funciones rotas para los usuarios:
           ${escapeHtml(faltan.map((r) => r.rompe).join(' '))}
           <br />Mira la sección <strong>Base de datos</strong> para ver cuáles.
         </div>`
      : ''
  }
}

// ── Cartas (espejo del catálogo de TCGdex) ──
//
// La importación corre AQUÍ, en el navegador de un admin, con su propia
// sesión y las políticas de RLS de siempre. No hay ningún script suelto
// tocando la base por fuera de la web.

let tcgSetsRemotos = []   // lo que TCGdex dice que existe
let tcgSetsLocales = []   // lo que ya tenemos importado
let importCancelado = false

function cardsNota(texto, aviso = false) {
  const el = document.getElementById('cardsImportNote')
  el.className = aviso ? 'admin-note-warn' : 'admin-note'
  el.textContent = texto
}

// ═══════════════════════════════════════════════════════════════════
// ARQUETIPOS (tanda 230)
//
// El catálogo curado que da nombre a los mazos. Lo que no esté aquí NO
// se pierde: la web deduce el arquetipo sola y lo marca como «sin
// catalogar», que es la lista de lo que merece la pena añadir.
//
// La regla de qué mazo es cuál vive en js/torneos/arquetipos.js, sin
// DOM, para poder probarla sin pantalla. Esto es solo el formulario.
// ═══════════════════════════════════════════════════════════════════

let arquetiposCache = []
let arquetipoEditando = null

// Una línea de requisito: «Dragapult ex | TWM | 130» o «Boss's Orders /
// Órdenes del jefe». El nombre puede llevar variantes separadas por
// barra porque el export de TCG Live viene en el idioma del jugador.
function parsearRequisito(linea) {
  const trozos = String(linea).split('|').map((t) => t.trim())
  const nombres = trozos[0].split('/').map((n) => n.trim()).filter(Boolean)
  if (!nombres.length) return null
  const req = { nombres }
  if (trozos[1]) req.set = trozos[1].toUpperCase()
  if (trozos[2]) req.numero = trozos[2]
  return req
}

function requisitoATexto(req) {
  const nombres = (req.nombres || []).join(' / ')
  return [nombres, req.set, req.numero].filter(Boolean).join(' | ')
}

async function loadArquetipos() {
  const { data, error } = await supabase.from('tcg_archetypes').select('*').order('nombre')
  const caja = document.getElementById('arquetiposLista')
  if (!caja) return
  if (error) {
    caja.innerHTML = `<p class="admin-note">${
      /tcg_archetypes/.test(error.message || '')
        ? 'Falta ejecutar <code>supabase-migration-arquetipos.sql</code> en el SQL Editor de Supabase.'
        : escapeHtml(error.message)
    }</p>`
    return
  }
  arquetiposCache = data || []
  if (!arquetiposCache.length) {
    caja.innerHTML =
      '<p class="admin-note">Todavía no hay ninguno. Mientras tanto, los mazos salen deducidos y marcados en las clasificaciones.</p>'
    return
  }
  caja.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Nombre</th><th>Identificador</th><th>Lleva</th><th>Iconos</th><th></th></tr></thead>
      <tbody>${arquetiposCache
        .map(
          (a) => `
        <tr${a.activo ? '' : ' class="admin-fila-apagada"'}>
          <td>${escapeHtml(a.nombre)}${a.activo ? '' : ' <span class="subtext">(inactivo)</span>'}</td>
          <td class="subtext">${escapeHtml(a.id)}</td>
          <td class="subtext">${escapeHtml((a.requiere || []).map(requisitoATexto).join(' + '))}</td>
          <td class="subtext">${escapeHtml((a.iconos || []).map((i) => `${i.set || '?'} ${i.numero || '?'}`).join(', '))}</td>
          <td>
            <button class="btn-secondary" data-editar-arq="${escapeHtml(a.id)}">Editar</button>
            <button class="btn-outline" data-borrar-arq="${escapeHtml(a.id)}">Borrar</button>
          </td>
        </tr>`
        )
        .join('')}</tbody>
    </table>`

  caja.querySelectorAll('[data-editar-arq]').forEach((b) =>
    b.addEventListener('click', () => editarArquetipo(b.dataset.editarArq))
  )
  caja.querySelectorAll('[data-borrar-arq]').forEach((b) =>
    b.addEventListener('click', () => borrarArquetipo(b.dataset.borrarArq))
  )
}

function limpiarFormularioArquetipo() {
  arquetipoEditando = null
  document.getElementById('arqFormTitulo').textContent = 'Nuevo arquetipo'
  for (const id of ['arqId', 'arqNombre', 'arqIcono1Set', 'arqIcono1Num', 'arqIcono2Set', 'arqIcono2Num', 'arqRequiere']) {
    const el = document.getElementById(id)
    if (el) el.value = ''
  }
  document.getElementById('arqId').disabled = false
  document.getElementById('arqActivo').checked = true
  document.getElementById('btnCancelarArquetipo').classList.add('hidden')
}

function editarArquetipo(id) {
  const a = arquetiposCache.find((x) => x.id === id)
  if (!a) return
  arquetipoEditando = id
  document.getElementById('arqFormTitulo').textContent = `Editando «${a.nombre}»`
  document.getElementById('arqId').value = a.id
  // El identificador NO se toca al editar: es lo que agrupa los
  // enfrentamientos del histórico, y cambiarlo los partiría en dos.
  document.getElementById('arqId').disabled = true
  document.getElementById('arqNombre').value = a.nombre
  const [i1, i2] = a.iconos || []
  document.getElementById('arqIcono1Set').value = i1?.set || ''
  document.getElementById('arqIcono1Num').value = i1?.numero || ''
  document.getElementById('arqIcono2Set').value = i2?.set || ''
  document.getElementById('arqIcono2Num').value = i2?.numero || ''
  document.getElementById('arqRequiere').value = (a.requiere || []).map(requisitoATexto).join('\n')
  document.getElementById('arqActivo').checked = a.activo !== false
  document.getElementById('btnCancelarArquetipo').classList.remove('hidden')
  document.getElementById('arqFormTitulo').scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function guardarArquetipo() {
  const id = slugify(document.getElementById('arqId').value.trim())
  const nombre = document.getElementById('arqNombre').value.trim()
  const requiere = document
    .getElementById('arqRequiere')
    .value.split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parsearRequisito)
    .filter(Boolean)

  if (!id || !nombre) {
    showToast('Hacen falta el identificador y el nombre.', 'error')
    return
  }
  // Sin requisitos el arquetipo casaría con TODOS los mazos. La base lo
  // rechaza igualmente; esto es para decirlo en cristiano.
  if (!requiere.length) {
    showToast('Di al menos una carta que tenga que llevar el mazo, o casaría con todos.', 'error')
    return
  }

  const iconos = [
    { set: document.getElementById('arqIcono1Set').value.trim().toUpperCase(), numero: document.getElementById('arqIcono1Num').value.trim() },
    { set: document.getElementById('arqIcono2Set').value.trim().toUpperCase(), numero: document.getElementById('arqIcono2Num').value.trim() },
  ].filter((i) => i.set && i.numero)

  const fila = { id, nombre, iconos, requiere, activo: document.getElementById('arqActivo').checked, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('tcg_archetypes').upsert(fila)
  if (error) {
    showToast('No se ha podido guardar: ' + error.message, 'error')
    return
  }
  showToast(arquetipoEditando ? 'Arquetipo actualizado.' : 'Arquetipo creado.', 'success')
  limpiarFormularioArquetipo()
  await loadArquetipos()
}

async function borrarArquetipo(id) {
  const a = arquetiposCache.find((x) => x.id === id)
  // Borrar no rompe nada del histórico: los arquetipos no se guardan por
  // torneo, se deducen al pintar. Lo que pasa es que esos mazos vuelven a
  // salir deducidos, como antes de catalogarlos.
  if (!confirm(`¿Borrar «${a?.nombre || id}»? Los mazos que lo usaban volverán a salir deducidos.`)) return
  const { error } = await supabase.from('tcg_archetypes').delete().eq('id', id)
  if (error) {
    showToast('No se ha podido borrar: ' + error.message, 'error')
    return
  }
  showToast('Arquetipo borrado.', 'success')
  if (arquetipoEditando === id) limpiarFormularioArquetipo()
  await loadArquetipos()
}

function initArquetiposSection() {
  document.getElementById('btnGuardarArquetipo')?.addEventListener('click', guardarArquetipo)
  document.getElementById('btnCancelarArquetipo')?.addEventListener('click', limpiarFormularioArquetipo)
}

// ═══════════════════════════════════════════════════════════════════
// CÓDIGOS DE SET DE TCG LIVE (tanda 232)
//
// El 2026-09-01 PINGU pegó una lista con ASC, POR, CRI y MEE, y ninguno
// estaba en la tabla del código: esas cartas salían sin imagen y no
// había forma de arreglarlo sin desplegar. Ahora se asignan desde aquí,
// se guardan en site_settings y mandan sobre la tabla.
//
// Y si TCGdex trae el código en su catálogo, se rellena solo al pulsar
// «Buscar sets en TCGdex».
// ═══════════════════════════════════════════════════════════════════

let setsLive = {} // CÓDIGO → id de set nuestro

async function loadSetsLive() {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'torneos_sets_live').maybeSingle()
  setsLive = data?.value?.codigos || {}
  pintarSetsLive()
}

function pintarSetsLive() {
  const caja = document.getElementById('setsLiveLista')
  if (!caja) return

  // Lo primero, el estado de lo AUTOMÁTICO: cuántos sets tienen ya su
  // código. Es lo que responde «¿me falta algo?» sin leer una tabla.
  const oeste = tcgSetsLocales.filter((x) => (x.market || 'WEST') === 'WEST')
  const conCodigo = oeste.filter((x) => x.tcg_online_code)
  const recientes = [...oeste]
    .sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')))
    .slice(0, 20)
  const recientesSinCodigo = recientes.filter((x) => !x.tcg_online_code)
  const resumen = document.getElementById('setsLiveResumen')
  if (resumen) {
    resumen.innerHTML = `<p class="admin-note"><strong>${conCodigo.length}</strong> de ${oeste.length} sets tienen su código de TCG Live.` +
      (recientesSinCodigo.length
        ? ` <strong>Faltan ${recientesSinCodigo.length} de los 20 más nuevos</strong>, que son los que salen en las decklists: ${recientesSinCodigo
            .map((x) => escapeHtml(x.name))
            .join(', ')}.`
        : ' Los 20 más nuevos están todos.') +
      '</p>'
  }

  const entradas = Object.entries(setsLive).sort(([a], [b]) => a.localeCompare(b))
  caja.innerHTML = entradas.length
    ? `<table class="admin-table">
        <thead><tr><th>Código</th><th>Set</th><th></th></tr></thead>
        <tbody>${entradas
          .map(([codigo, setId]) => {
            const set = tcgSetsLocales.find((s) => s.id === setId && (s.market || 'WEST') === 'WEST')
            return `<tr>
              <td><strong>${escapeHtml(codigo)}</strong></td>
              <td>${escapeHtml(set?.name || setId)}${set ? '' : ' <span class="subtext">(no importado)</span>'}</td>
              <td><button class="btn-outline" data-quitar-setlive="${escapeHtml(codigo)}">Quitar</button></td>
            </tr>`
          })
          .join('')}</tbody>
      </table>`
    : '<p class="admin-note">Ninguno asignado a mano: todos vienen de TCGdex.</p>'

  caja.querySelectorAll('[data-quitar-setlive]').forEach((b) =>
    b.addEventListener('click', () => {
      delete setsLive[b.dataset.quitarSetlive]
      pintarSetsLive()
    })
  )

  // El desplegable: los sets occidentales, del más nuevo al más viejo,
  // que es donde están los que faltan.
  const sel = document.getElementById('setLiveSet')
  if (sel) {
    sel.innerHTML = tcgSetsLocales
      .filter((s) => (s.market || 'WEST') === 'WEST')
      .sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')))
      .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}${s.release_date ? ` (${String(s.release_date).slice(0, 4)})` : ''}</option>`)
      .join('')
  }
}

async function guardarSetsLive() {
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key: 'torneos_sets_live', value: { codigos: setsLive } }, { onConflict: 'key' })
  const nota = document.getElementById('setsLiveNota')
  if (error) {
    showToast('No se ha podido guardar: ' + error.message, 'error')
    return
  }
  if (nota) nota.textContent = `Guardado: ${Object.keys(setsLive).length} códigos.`
  showToast('Códigos guardados. Las decklists ya los usan.', 'success')
}

// ── Traer los códigos de lo YA importado (tanda 233) ──
//
// La importación de cartas guarda el código de cada set según lo trae,
// pero los sets importados ANTES de la 233 no lo tienen. Esto los
// rellena sin volver a bajar las cartas: pide el detalle de cada set y
// se queda solo con el código.
//
// De los más NUEVOS a los más viejos a propósito: los que salen en las
// decklists son los de la rotación, así que en un minuto ya está lo que
// hace falta y se puede cancelar el resto.
let codigosCancelado = false

async function traerCodigosLive() {
  const btn = document.getElementById('btnTraerCodigos')
  const nota = document.getElementById('setsLiveNota')
  codigosCancelado = false
  btn.disabled = true
  document.getElementById('btnCancelarCodigos')?.classList.remove('hidden')

  const pendientes = tcgSetsLocales
    .filter((x) => (x.market || 'WEST') === 'WEST' && !x.tcg_online_code)
    .sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')))

  let traidos = 0
  let sinCodigo = 0
  try {
    for (let i = 0; i < pendientes.length; i++) {
      if (codigosCancelado) break
      const fila = pendientes[i]
      if (nota) nota.textContent = `Pidiendo ${i + 1} de ${pendientes.length}: ${fila.name}…`
      let codigo = null
      try {
        codigo = codigoLiveDeSet(await fetchSet(fila.id, 'WEST'))
      } catch {
        // Un set que falle no puede parar la tanda entera: se salta.
        continue
      }
      if (!codigo) {
        // Los sets anteriores a TCG Live no tienen código, y eso es
        // normal: no es un error que haya que enseñar.
        sinCodigo++
        continue
      }
      const { error } = await supabase
        .from('tcg_sets')
        .update({ tcg_online_code: codigo })
        .eq('id', fila.id)
        .eq('market', 'WEST')
      if (!error) {
        fila.tcg_online_code = codigo
        traidos++
      }
    }
  } finally {
    btn.disabled = false
    document.getElementById('btnCancelarCodigos')?.classList.add('hidden')
  }

  if (nota) {
    nota.textContent = traidos
      ? `${traidos} códigos guardados${sinCodigo ? ` (${sinCodigo} sets sin código, normal en los antiguos)` : ''}.` +
        ' Las decklists ya los usan.'
      : 'Ningún código nuevo. Los sets antiguos no tienen: TCG Live no existía.'
  }
  pintarSetsLive()
}

function initSetsLiveSection() {
  document.getElementById('btnAnadirSetLive')?.addEventListener('click', () => {
    const codigo = document.getElementById('setLiveCodigo').value.trim().toUpperCase()
    const setId = document.getElementById('setLiveSet').value
    if (!/^[A-Z0-9]{2,6}$/.test(codigo)) {
      showToast('El código es el que sale en la decklist: dos a seis letras o números (ASC, POR…).', 'error')
      return
    }
    if (!setId) {
      showToast('Elige a qué set corresponde.', 'error')
      return
    }
    setsLive[codigo] = setId
    document.getElementById('setLiveCodigo').value = ''
    pintarSetsLive()
  })
  document.getElementById('btnGuardarSetsLive')?.addEventListener('click', guardarSetsLive)
  document.getElementById('btnTraerCodigos')?.addEventListener('click', traerCodigosLive)
  document.getElementById('btnCancelarCodigos')?.addEventListener('click', () => {
    codigosCancelado = true
  })
}

async function loadCards() {
  const [setsRes, cartasRes] = await Promise.all([
    supabase.from('tcg_sets').select('*').order('release_date', { ascending: false, nullsFirst: false }),
    supabase.from('tcg_cards').select('id', { count: 'exact', head: true }),
  ])

  if (setsRes.error) {
    // El caso típico: la migración todavía no se ha ejecutado. Decirlo
    // claro vale más que una tabla vacía que no explica nada.
    document.getElementById('cardsSummary').innerHTML = ''
    document.getElementById('cardsSetsTable').innerHTML = ''
    cardsNota(`No se puede leer tcg_sets: ${setsRes.error.message}. Aplica supabase-migration-cartas.sql.`, true)
    document.getElementById('btnLoadTcgSets').disabled = true
    return
  }

  tcgSetsLocales = setsRes.data || []
  const importados = tcgSetsLocales.filter((s) => s.imported_at).length
  const cortos = setsCortos()
  // Lo que TCGdex dice que hay, contra lo que tenemos. Sin este número,
  // "faltan cartas" es una sensación; con él es un porcentaje.
  const declaradas = tcgSetsLocales.reduce((t, s) => t + (s.card_count_total || 0), 0)
  const guardadas = tcgSetsLocales.reduce((t, s) => t + (s.imported_cards || 0), 0)

  document.getElementById('cardsSummary').innerHTML = [
    statCardHtml(cartasRes.count ?? 0, 'Cartas', 'en nuestra base'),
    statCardHtml(
      declaradas ? `${Math.round((guardadas / declaradas) * 100)}%` : '—',
      'Cobertura',
      declaradas ? `${guardadas} de ${declaradas} declaradas` : 'sin lista de sets'
    ),
    statCardHtml(importados, 'Sets importados', tcgSetsRemotos.length ? `de ${tcgSetsRemotos.length} en TCGdex` : 'pulsa "Buscar sets"'),
    statCardHtml(tcgSetsLocales.length - importados, 'Sets pendientes', 'conocidos pero sin cartas'),
    statCardHtml(cortos.length, 'Sets cortos', 'importados con menos de lo declarado'),
  ].join('')

  const btnCortos = document.getElementById('btnImportShort')
  if (btnCortos) btnCortos.disabled = cortos.length === 0

  renderCardsSets()
}

// Un set "corto" es uno que se importó y guardó MENOS cartas de las que
// TCGdex declara en cardCount.total.
//
// Dos motivos posibles, y hay que distinguirlos porque llevan a decisiones
// distintas: o la importación se quedó a medias (nuestro, se arregla
// reimportando), o TCGdex declara cartas que no publica (suyo, no se
// arregla con nada). Reimportar y ver si el número cambia es lo que lo
// dice, y eso es lo que cuenta `importarSets` al terminar.
function setsCortos() {
  return tcgSetsLocales.filter(
    (s) => s.imported_at && s.card_count_total && (s.imported_cards || 0) < s.card_count_total
  )
}

function renderCardsSets() {
  const filtro = normalizeSearch(document.getElementById('cardsSetFilter')?.value || '')
  const filas = tcgSetsLocales.filter((s) => !filtro || normalizeSearch(s.name).includes(filtro))

  if (filas.length === 0) {
    document.getElementById('cardsSetsTable').innerHTML = tcgSetsLocales.length
      ? `<p class="empty-state">Ningún set coincide con el filtro.</p>`
      : `<p class="empty-state">Todavía no hay sets. Pulsa "Buscar sets en TCGdex" para traer la lista.</p>`
    return
  }

  document.getElementById('cardsSetsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Set</th><th style="width:110px;">Cartas</th><th style="width:110px;">Estado</th><th style="width:110px;"></th></tr></thead>
      <tbody>
        ${filas
          .map(
            (s) => `<tr>
              <td><span class="badge">${escapeHtml(s.market || 'WEST')}</span> ${escapeHtml(s.name)} <span class="admin-path">${escapeHtml(s.id)}${s.release_date ? ' · ' + s.release_date : ''}</span></td>
              <td>${s.imported_cards || 0}${s.card_count_total ? ` / ${s.card_count_total}` : ''}</td>
              <td>${
                !s.imported_at
                  ? '<span class="badge-pending">Pendiente</span>'
                  : s.card_count_total && (s.imported_cards || 0) < s.card_count_total
                    ? // Se marca aparte del "Importado" a propósito: antes un
                      // set con 30 de 200 cartas se veía igual que uno
                      // completo, y no había forma de dar con él.
                      `<span class="badge-pending">Corto (falta${
                        s.card_count_total - (s.imported_cards || 0) === 1 ? '' : 'n'
                      } ${s.card_count_total - (s.imported_cards || 0)})</span>`
                    : '<span class="badge-ok">Importado</span>'
              }</td>
              <td><button class="btn-outline btn-small" data-import-set="${escapeHtml(s.id)}" data-import-market="${escapeHtml(s.market || 'WEST')}">${s.imported_at ? 'Reimportar' : 'Importar'}</button></td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  // Se pasa el par (id, mercado): sólo con el id no se sabe cuál de los
  // cuatro CS1a hay que importar.
  document.querySelectorAll('[data-import-set]').forEach((btn) =>
    btn.addEventListener('click', () =>
      importarSets([{ id: btn.dataset.importSet, market: btn.dataset.importMarket }])
    )
  )
}

// Trae la LISTA de sets (no las cartas). Son ~220 filas en una petición.
async function cargarSetsDeTcgdex() {
  const btn = document.getElementById('btnLoadTcgSets')
  btn.disabled = true
  cardsNota('Pidiendo la lista de sets a TCGdex…')
  try {
    // Los cuatro mercados, uno detrás de otro. Cada set lleva el suyo
    // dentro: sin eso, el CS1a chino pisaría al occidental — comparten
    // identificador y son sets distintos.
    tcgSetsRemotos = []
    const crudas = []
    for (const market of MERCADOS_A_IMPORTAR) {
      const sets = await fetchSets(market)
      tcgSetsRemotos.push(...sets.map((x) => ({ ...x, market })))
      crudas.push(...sets.map((x) => setToRow(x, market)))
    }
    // El catálogo trae repetidos: el chino simplificado devuelve 57 sets
    // con 56 identificadores. Con los dos en la misma sentencia, Postgres
    // corta con «cannot affect row a second time».
    const { filas, repetidas } = sinDuplicados(crudas, ['id', 'market'])
    // En trozos: PostgREST tiene un límite de tamaño de petición y 220
    // filas de una vez lo rozan.
    for (let i = 0; i < filas.length; i += 100) {
      const { error } = await supabase.from('tcg_sets').upsert(filas.slice(i, i + 100), { onConflict: 'id,market' })
      if (error) throw error
    }
    // El código de TCG Live NO se puede sacar de aquí: el listado
    // devuelve un SetResume y ese campo solo está en el Set completo.
    // Lo trae «Traer códigos de TCG Live», que pide los detalles.
    cardsNota(
      `${filas.length} sets conocidos${repetidas ? ` (${repetidas} repetidos en el catálogo, descartados)` : ''}. ` +
        'Ahora "Importar los que faltan" trae las cartas.'
    )
    document.getElementById('btnImportPending').disabled = false
    await loadCards()
  } catch (err) {
    cardsNota(`No se pudo traer la lista: ${err.message}`, true)
  } finally {
    btn.disabled = false
  }
}

// Pregunta a TCGdex qué catálogos hay y deja el resultado en un cuadro
// de texto para copiarlo. No escribe NADA en la base.
//
// Se hace desde aquí y no desde el servidor por un motivo tonto y real:
// este es el único sitio del proyecto con salida a internet hacia
// TCGdex cuando hace falta mirar algo.
async function diagnosticarCartas() {
  const caja = document.getElementById('cardsDiagnostico')
  const boton = document.getElementById('btnDiagnosticar')
  boton.disabled = true
  caja.classList.remove('hidden')
  caja.value = 'Preguntando a TCGdex… esto tarda un rato, son 16 idiomas.'
  try {
    const datos = await diagnosticarCatalogos((paso) => {
      caja.value = `${paso}\n(no cierres la página)`
    })
    caja.value = diagnosticoComoTexto(datos)
    cardsNota('Diagnóstico hecho. Copia el cuadro de texto entero.')
  } catch (err) {
    caja.value = `No se ha podido: ${err.message}`
    cardsNota(`El diagnóstico ha fallado: ${err.message}`, true)
  }
  boton.disabled = false
}

async function importarSets(ids) {
  if (ids.length === 0) {
    cardsNota('No queda ningún set por importar.')
    return
  }
  importCancelado = false
  const barra = document.getElementById('cardsProgress')
  const relleno = document.getElementById('cardsProgressFill')
  barra.classList.remove('hidden')
  document.getElementById('btnCancelImport').classList.remove('hidden')
  document.getElementById('btnImportPending').disabled = true

  let hechos = 0
  let cartasTotal = 0
  const fallos = []
  // Para poder decir si reimportar ha servido de algo: cuántos sets han
  // traído cartas que no teníamos, y cuántos se han quedado igual.
  let conNuevas = 0
  let nuevasTotal = 0
  let igual = 0

  for (const par of ids) {
    if (importCancelado) break
    // Un mismo identificador de set existe en varios mercados (CS1a está
    // en occidental, chino tradicional, indonesio y tailandés), así que
    // se importa por PAR (id, mercado). Pedirlo sólo con el id traería
    // otro set y lo guardaría encima del que toca.
    const setId = par.id
    const market = par.market || 'WEST'
    try {
      const set = await fetchSet(setId, market)
      // Mismo cuidado que con los sets: un set puede traer la misma
      // carta dos veces, y las dos en la misma sentencia la parten.
      const { filas } = sinDuplicados(
        (set.cards || []).map((c) => cardToRow(c, setId, market)),
        ['id', 'market']
      )
      for (let i = 0; i < filas.length; i += 200) {
        const { error } = await supabase.from('tcg_cards').upsert(filas.slice(i, i + 200), { onConflict: 'id,market' })
        if (error) throw error
      }
      // El código de TCG Live viene en el set COMPLETO (este `set`), no
      // en el listado. Se guarda aquí, que es el único sitio donde lo
      // tenemos sin pedir nada de más (tanda 233).
      const cambiosSet = { imported_at: new Date().toISOString(), imported_cards: filas.length }
      const codigoLive = codigoLiveDeSet(set)
      if (codigoLive) cambiosSet.tcg_online_code = codigoLive
      const { error: errSet } = await supabase
        .from('tcg_sets')
        .update(cambiosSet)
        .eq('id', setId)
        .eq('market', market)
      if (errSet) throw errSet
      cartasTotal += filas.length
      const antes = tcgSetsLocales.find((s) => s.id === setId && (s.market || 'WEST') === market)
      const ganadas = filas.length - (antes?.imported_cards || 0)
      if (antes?.imported_at && ganadas > 0) {
        conNuevas++
        nuevasTotal += ganadas
      } else if (antes?.imported_at) {
        igual++
      }
    } catch (err) {
      fallos.push(`${setId}: ${err.message}`)
    }
    hechos++
    relleno.style.width = `${Math.round((hechos / ids.length) * 100)}%`
    cardsNota(`Importando… ${hechos} de ${ids.length} sets, ${cartasTotal} cartas.${fallos.length ? ` ${fallos.length} con fallo.` : ''}`)
  }

  barra.classList.add('hidden')
  relleno.style.width = '0%'
  document.getElementById('btnCancelImport').classList.add('hidden')
  document.getElementById('btnImportPending').disabled = false

  // Un set que falle no debe parar los otros 219, pero tampoco puede
  // pasar desapercibido: se dicen cuáles y por qué.
  const resumen = importCancelado ? 'Importación cancelada.' : 'Importación terminada.'
  // Si se han reimportado sets que ya estaban, lo que interesa no es el
  // total: es si han venido cartas nuevas. Cuando no vienen, el hueco que
  // queda es de los datos de TCGdex y no lo cierra volver a pedirlo.
  const reimport =
    conNuevas + igual > 0
      ? ` De los ${conNuevas + igual} que ya estaban: ${conNuevas} han traído ${nuevasTotal} cartas nuevas` +
        `${igual ? ` y ${igual} siguen igual (TCGdex declara más de lo que publica)` : ''}.`
      : ''
  cardsNota(
    `${resumen} ${cartasTotal} cartas en ${hechos - fallos.length} sets.${reimport}` +
      `${fallos.length ? ` Fallaron ${fallos.length}: ${fallos.slice(0, 3).join(' · ')}` : ''}`,
    fallos.length > 0
  )
  await loadCards()
}

function initCardsSection() {
  document.getElementById('btnLoadTcgSets')?.addEventListener('click', cargarSetsDeTcgdex)
  document.getElementById('btnDiagnosticar')?.addEventListener('click', diagnosticarCartas)
  document.getElementById('btnImportPending')?.addEventListener('click', () =>
    importarSets(tcgSetsLocales.filter((s) => !s.imported_at).map((s) => ({ id: s.id, market: s.market })))
  )
  // Los cortos, del hueco más grande al más pequeño: si hay que cortar a
  // medias, mejor haber arreglado los peores.
  document.getElementById('btnImportShort')?.addEventListener('click', () =>
    importarSets(
      setsCortos()
        .sort((a, b) => b.card_count_total - b.imported_cards - (a.card_count_total - a.imported_cards))
        .map((s) => ({ id: s.id, market: s.market }))
    )
  )
  document.getElementById('btnCancelImport')?.addEventListener('click', () => {
    importCancelado = true
    cardsNota('Cancelando al terminar el set en curso…')
  })
  document.getElementById('cardsSetFilter')?.addEventListener('input', renderCardsSets)
}

// ── Init ──
async function init() {
  const session = await checkAccess()
  if (!session) return

  initSidebar()
  await loadCategories()
  await Promise.all([
    loadDashboard(),
    loadPending(),
    loadGuides(),
    loadAchievements(),
    loadUsers(),
    loadReports(),
    loadFeedback(),
    loadClientErrors(),
    loadAnalytics(),
    loadAccountDeletionRequests(),
    loadCards(),
    loadSchemaCheck(),
    loadForo(),
    loadArquetipos(),
  ])

  // Después de loadCards(): necesita tcgSetsLocales para poder enseñar
  // el nombre de cada set en vez de su identificador.
  await loadSetsLive()

  initCardsSection()
  initArquetiposSection()
  initSetsLiveSection()

  document.getElementById('analyticsDays')?.addEventListener('change', loadAnalytics)
}

init()
