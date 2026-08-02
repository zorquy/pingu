import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession, validateImageFile, profileUrl } from '../../js/app.js'
import { invalidateAchievementsCache } from '../../js/gamification.js'
import { showToast } from '../../js/toast.js'
import { renderReferenceBlocksHtml } from '../../js/block-editor.js'
import { icons } from '../../js/icons.js'

let categories = []
let guidesCache = []
let collectionsCache = []
let pathsCache = []

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
async function loadDashboard() {
  const [{ count: userCount }, { count: completedCount }, { count: guideCount }] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('guides').select('*', { count: 'exact', head: true }).not('published_at', 'is', null),
  ])

  document.getElementById('dashboardStats').innerHTML = `
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${userCount || 0}</div><div>Usuarios</div></div>
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${completedCount || 0}</div><div>Cursos completados *</div></div>
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${guideCount || 0}</div><div>Guías publicadas</div></div>
    <p style="grid-column: 1/-1; font-size: 12px; color: var(--text-mid);">* Por las políticas RLS actuales de <code>user_progress</code> (solo <code>auth.uid() = user_id</code>, sin excepción para admins), esta cifra solo cuenta tus propios cursos completados, no los de todos los usuarios. Para un total real haría falta añadir una política de lectura para admins en esa tabla.</p>`
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
            <td>${c.icon_image ? `<img src="${c.icon_image.replace(/"/g, '&quot;')}" alt="" style="width:24px; height:24px; object-fit:contain;" />` : c.emoji || ''}</td>
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
    <div class="form-group"><label>Emoji</label><input id="catEmoji" value="${escapeHtml(c.emoji || '')}" /></div>
    <div class="form-group"><label>Icono personalizado (URL, opcional)</label><input id="catIconImage" value="${escapeHtml(c.icon_image || '')}" placeholder="https://..." /><p style="font-size:12px; color:var(--text-mid); margin-top:4px;">Sustituye al emoji en las tarjetas de categoría. Sube la imagen en la pestaña "Imágenes" y pega aquí la URL.</p></div>
    <div class="form-group"><label>Imagen de portada (URL)</label><input id="catCoverImage" value="${escapeHtml(c.cover_image || '')}" /></div>
    <div class="form-group"><label>Orden</label><input id="catOrder" type="number" value="${c.order_pos ?? 0}" /></div>
    <button class="btn-primary btn-block" id="btnSaveCategory">Guardar</button>`)

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

// ── Guide collections ──
async function loadCollections() {
  const { data } = await supabase.from('guide_collections').select('*, categories(name)').order('created_at')
  collectionsCache = data || []

  document.getElementById('collectionsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Emoji</th><th>Título</th><th>Categoría</th><th>Slug</th><th></th></tr></thead>
      <tbody>
        ${collectionsCache
          .map(
            (col) => `
          <tr>
            <td>${col.emoji || ''}</td>
            <td>${escapeHtml(col.title)}</td>
            <td>${escapeHtml(col.categories?.name || '—')}</td>
            <td>${escapeHtml(col.slug)}</td>
            <td class="admin-row-actions">
              <button data-edit="${col.id}">Editar</button>
              <button class="danger" data-delete="${col.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#collectionsTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openCollectionModal(collectionsCache.find((c) => c.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#collectionsTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta colección? Las guías dentro no se eliminan, solo quedan sin colección.')) return
      await supabase.from('guide_collections').delete().eq('id', btn.dataset.delete)
      loadCollections()
    })
  )
}

function openCollectionModal(collection) {
  const col = collection || { title: '', slug: '', emoji: '', description: '', category_id: categories[0]?.id || '' }
  openModal(`
    <h3>${collection ? 'Editar' : 'Nueva'} colección</h3>
    <div class="form-group"><label>Título</label><input id="colTitle" value="${escapeHtml(col.title)}" /></div>
    <div class="form-group"><label>Slug</label><input id="colSlug" value="${escapeHtml(col.slug)}" /></div>
    <div class="form-group"><label>Emoji</label><input id="colEmoji" value="${escapeHtml(col.emoji || '')}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="colDescription">${escapeHtml(col.description || '')}</textarea></div>
    <div class="form-group"><label>Categoría</label>
      <select id="colCategory">${categories.map((c) => `<option value="${c.id}" ${c.id === col.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
    </div>
    <button class="btn-primary btn-block" id="btnSaveCollection">Guardar</button>`)

  document.getElementById('btnSaveCollection').addEventListener('click', async () => {
    const payload = {
      title: document.getElementById('colTitle').value.trim(),
      slug: document.getElementById('colSlug').value.trim(),
      emoji: document.getElementById('colEmoji').value.trim(),
      description: document.getElementById('colDescription').value.trim(),
      category_id: document.getElementById('colCategory').value,
    }
    if (col.id) payload.id = col.id
    const { error } = await supabase.from('guide_collections').upsert(payload)
    if (error) {
      showToast('No se pudo guardar la colección: ' + error.message)
      return
    }
    closeModal()
    loadCollections()
  })
}

document.getElementById('btnNewCollection').addEventListener('click', () => openCollectionModal(null))

// ── Guías pendientes de revisión ──
let pendingCache = []

async function loadPending() {
  const { data } = await supabase
    .from('guides')
    .select('*, categories(name)')
    .eq('review_status', 'pending')
    .order('submitted_at', { ascending: true })

  pendingCache = data || []
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
            <td>${escapeHtml(g.cover_emoji || '')} ${escapeHtml(g.title || 'Sin título')}</td>
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
            <td>${escapeHtml(g.cover_emoji || '')} ${escapeHtml(g.title)}${g.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}${g.has_pro_content ? ` <span class="badge badge-pro">${icons.star(11)} Guía Pro</span>` : ''}</td>
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

// ── Learning paths ──
async function loadPaths() {
  const { data } = await supabase
    .from('learning_paths')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('title')
  pathsCache = data || []

  document.getElementById('pathsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Emoji</th><th>Título</th><th>Slug</th><th>Destacada</th><th></th></tr></thead>
      <tbody>
        ${pathsCache
          .map(
            (p) => `
          <tr>
            <td>${p.emoji || ''}</td>
            <td>${escapeHtml(p.title)}</td>
            <td>${escapeHtml(p.slug)}</td>
            <td>${p.is_featured ? '✓' : ''}</td>
            <td class="admin-row-actions">
              <button data-edit="${p.id}">Editar</button>
              <button class="danger" data-delete="${p.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#pathsTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openPathModal(pathsCache.find((p) => p.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#pathsTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta ruta?')) return
      await supabase.from('learning_paths').delete().eq('id', btn.dataset.delete)
      loadPaths()
    })
  )
}

function openPathModal(path) {
  const p = path || { title: '', slug: '', description: '', emoji: '', is_featured: false }
  openModal(`
    <h3>${path ? 'Editar' : 'Nueva'} ruta</h3>
    <div class="form-group"><label>Título</label><input id="pTitle" value="${escapeHtml(p.title || '')}" /></div>
    <div class="form-group"><label>Slug</label><input id="pSlug" value="${escapeHtml(p.slug)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="pDescription">${escapeHtml(p.description || '')}</textarea></div>
    <div class="form-group"><label>Emoji</label><input id="pEmoji" value="${escapeHtml(p.emoji || '')}" /></div>
    <div class="form-group"><label><input type="checkbox" id="pFeatured" ${p.is_featured ? 'checked' : ''} /> Destacada (se recomienda en el onboarding)</label></div>
    <button class="btn-primary btn-block" id="btnSavePath">Guardar</button>`)

  document.getElementById('btnSavePath').addEventListener('click', async () => {
    const payload = {
      title: document.getElementById('pTitle').value.trim(),
      slug: document.getElementById('pSlug').value.trim(),
      description: document.getElementById('pDescription').value.trim(),
      emoji: document.getElementById('pEmoji').value.trim(),
      is_featured: document.getElementById('pFeatured').checked,
    }
    if (p.id) payload.id = p.id
    const { error } = await supabase.from('learning_paths').upsert(payload)
    if (error) {
      showToast('No se pudo guardar la ruta: ' + error.message)
      return
    }
    closeModal()
    loadPaths()
  })
}

document.getElementById('btnNewPath').addEventListener('click', () => openPathModal(null))

// ── Achievements ──
const CONDITION_LABELS = {
  completed_guides_count: 'Cursos completados',
  total_xp: 'XP total',
  quiz_correct_count: 'Preguntas acertadas',
  approved_guides_count: 'Guías aprobadas (autor)',
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
            <td>${a.emoji || '🏆'}</td>
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
    emoji: '🏆',
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
    <div class="form-group"><label>Emoji</label><input id="aEmoji" value="${escapeHtml(a.emoji || '')}" /></div>
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
      </select>
    </div>
    <div class="form-group"><label>Valor de la condición</label><input id="aConditionCount" type="number" value="${a.condition?.count ?? 1}" /></div>
    <div class="form-group"><label>XP de recompensa</label><input id="aXpReward" type="number" value="${a.xp_reward ?? 50}" /></div>
    <div class="form-group"><label><input type="checkbox" id="aIsActive" ${a.is_active ? 'checked' : ''} /> Activo</label></div>
    <button class="btn-primary btn-block" id="btnSaveAchievement">Guardar</button>`)

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
async function loadUsers() {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, total_xp, level, is_admin, is_pro, is_banned, is_muted')
    .order('total_xp', { ascending: false })
  const users = data || []

  document.getElementById('usersTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Nombre</th><th>Nivel</th><th>XP</th><th>Admin</th><th>Pro</th><th>Estado</th><th></th></tr></thead>
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
            <td>${u.is_banned ? `${icons.ban(14)} Baneado` : u.is_muted ? `${icons.volumeX(14)} Silenciado` : ''}</td>
            <td class="admin-row-actions">
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

// ── Images (Supabase Storage) ──
async function loadImages() {
  const { data, error } = await supabase.storage.from('images').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  const grid = document.getElementById('imagesGrid')

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="empty-state">No hay imágenes todavía.</p>`
    return
  }

  grid.innerHTML = data
    .filter((f) => f.name && !f.name.endsWith('/'))
    .map((f) => {
      const { data: pub } = supabase.storage.from('images').getPublicUrl(f.name)
      return `
      <div class="admin-image-tile" data-url="${pub.publicUrl}">
        <img src="${pub.publicUrl}" loading="lazy" />
        <div class="fname">${escapeHtml(f.name)}</div>
      </div>`
    })
    .join('')

  grid.querySelectorAll('.admin-image-tile').forEach((tile) =>
    tile.addEventListener('click', () => {
      navigator.clipboard?.writeText(tile.dataset.url)
      showToast(`URL copiada: ${tile.dataset.url}`, 'success')
    })
  )
}

document.getElementById('imageUploadInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return
  try {
    validateImageFile(file)
  } catch (err) {
    showToast(err.message)
    e.target.value = ''
    return
  }
  const path = `${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('images').upload(path, file)
  if (error) {
    showToast('Error al subir la imagen: ' + error.message)
    return
  }
  e.target.value = ''
  loadImages()
})

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

async function loadReports() {
  const { data } = await supabase
    .from('content_reports')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const reports = data || []
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

// ── Analítica básica (page_views) — sin servicio externo, sin cookies ──
async function loadAnalytics() {
  const days = Number(document.getElementById('analyticsDays')?.value) || 7
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const { data } = await supabase.from('page_views').select('path, created_at').gte('created_at', since)
  const views = data || []

  const container = document.getElementById('analyticsTable')
  const totalEl = document.getElementById('analyticsTotal')
  if (totalEl) totalEl.textContent = views.length

  if (views.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no hay visitas registradas en este periodo.</p>`
    return
  }

  const countByPath = views.reduce((acc, v) => {
    acc[v.path] = (acc[v.path] || 0) + 1
    return acc
  }, {})
  const rows = Object.entries(countByPath).sort((a, b) => b[1] - a[1])

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Página</th><th>Visitas</th></tr></thead>
      <tbody>
        ${rows.map(([path, count]) => `<tr><td>${escapeHtml(path)}</td><td>${count}</td></tr>`).join('')}
      </tbody>
    </table>`
}

// ── Init ──
async function init() {
  const session = await checkAccess()
  if (!session) return

  initSidebar()
  await loadCategories()
  await Promise.all([loadCollections(), loadPaths()])
  await Promise.all([
    loadDashboard(),
    loadPending(),
    loadGuides(),
    loadAchievements(),
    loadUsers(),
    loadImages(),
    loadReports(),
    loadFeedback(),
    loadClientErrors(),
    loadAnalytics(),
    loadAccountDeletionRequests(),
  ])

  document.getElementById('analyticsDays')?.addEventListener('change', loadAnalytics)
}

init()
