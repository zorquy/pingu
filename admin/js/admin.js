import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession, validateImageFile, profileUrl, slugify } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
// Del módulo de LECTURA, que existe para esto desde la 316 (ver su
// cabecera): `block-editor.js` solo lo reexporta, y pedírselo a él
// arrastraba el editor entero —y con él sus clases— a una página que no
// edita nada. El barrido de la 299 sigue los imports, no las llamadas.
import { renderReferenceBlocksHtml } from '../../js/bloques-lectura.js'
import { icons } from '../../js/icons.js'
import { contentIconHtml, inlineIconHtml } from '../../js/content-icon.js'
import { attachEmojiPicker } from '../../js/emoji-picker.js'
import { normalizePath, pageLabel } from '../../js/page-views.js'
import { revisarBloques } from '../../js/curso-lint.js'
import { PASADAS, semaforoDe } from './semaforo.js'
import { ponerContadorNav } from './hoy.js'
import { notaDeVital } from '../../js/vitales.js'
import { claveDePregunta, esPractica } from '../../js/curso-juego.js'
import { checkSchema } from '../../js/schema-check.js'
import { iniciarColecciones } from './colecciones.js'
import { iniciarTiendas } from './tiendas.js'

let categories = []
let perfilAdmin = null
let avisosMontados = false
let guidesCache = []

// ── Access gate ──
async function checkAccess() {
  const session = await getSession()
  if (!session) {
    window.location.href = '/auth.html'
    return null
  }
  const { data: profile } = await supabase.from('user_profiles').select('is_admin, display_name, username').eq('id', session.user.id).single()
  perfilAdmin = profile
  if (!profile?.is_admin) {
    window.location.href = '/'
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
      // Las colecciones se piden al abrir su sección y no al arrancar: son
      // ~231 filas por catálogo y casi siempre se entra a otra cosa.
      if (btn.dataset.section === 'colecciones') iniciarColecciones()
      if (btn.dataset.section === 'tiendas') iniciarTiendas()
      if (btn.dataset.section === 'users') loadUsers()
      if (btn.dataset.section === 'correos') pintarCorreos()
      if (btn.dataset.section === 'avisos' && !avisosMontados) {
        avisosMontados = true
        import('./avisos-admin.js').then((m) => m.montarAvisos(document.getElementById('avisosPanel')))
      }
    })
  })
  // Un enlace que abre una sección (1066: el resumen del lunes lleva a
  // /admin/?ver=analytics).
  const pedida = new URLSearchParams(location.search).get('ver')
  if (pedida && /^[a-z-]+$/.test(pedida)) document.querySelector(`.admin-nav-item[data-section="${pedida}"]`)?.click()
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

// ── Hoy (1119): ver admin/js/hoy.js ──

// ── El aviso global: /admin → Avisos (admin/js/avisos-admin.js, 1120) ──

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
  loadClavesPush().catch(() => {})
  const { montarHoy } = await import('./hoy.js')
  await montarHoy({ nombre: perfilAdmin?.display_name || perfilAdmin?.username || '' })
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
    <div class="form-group"><label>Orden</label><input id="catOrder" type="number" inputmode="numeric" value="${c.order_pos ?? 0}" /></div>
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
  // Solo GUÍAS: las noticias tienen su propio apartado desde la tanda
  // 278. Mezcladas, una noticia salía en esta tabla con una categoría
  // que no significa nada, y escribir una obligaba a entrar en «Guías».
  const { data, error } = await supabase
    .from('guides')
    .select('*, categories(name)')
    .eq('kind', 'guide')
    .order('created_at', { ascending: false })
  guidesCache =
    (error
      ? (await supabase.from('guides').select('*, categories(name)').order('created_at', { ascending: false })).data
      : data) || []

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

// ── Noticias (tanda 278) ──
//
// Su propia pantalla, aunque compartan tabla con las guías en la base.
// Son dos trabajos distintos: una guía se escribe en una semana y una
// noticia en veinte minutos, y tener que buscarla entre treinta guías
// era justo lo que sobraba.
//
// Las columnas también son otras: aquí no pinta la categoría (una
// noticia no tiene) y sí la fecha, que es lo que ordena una noticia.
let noticiasCache = []

async function loadNoticias() {
  const caja = document.getElementById('noticiasTable')
  if (!caja) return
  // `telegram_sent_at` la trae la migración de la tanda 280, y las
  // migraciones se ejecutan a mano DESPUÉS de desplegar: si todavía no
  // está, se pide la lista sin ella en vez de dejar el panel en blanco.
  const columnas = 'id, title, slug, published_at, created_at, forum_thread_id'
  const pedir = (sel) => supabase.from('guides').select(sel).eq('kind', 'news').order('created_at', { ascending: false })
  // Y `x_sent_at`/`x_post_id` las trae la de la 902: mismo trato. Se
  // pide primero con todo y se va quitando lo que la base no tenga.
  let { data, error } = await pedir(`${columnas}, telegram_sent_at, x_sent_at, x_post_id`)
  if (error?.code === '42703') ({ data, error } = await pedir(`${columnas}, telegram_sent_at`))
  if (error?.code === '42703') ({ data, error } = await pedir(columnas))
  if (error) {
    caja.innerHTML = `<p class="empty-state">No se han podido cargar las noticias: ${escapeHtml(error.message)}</p>`
    return
  }
  noticiasCache = data || []

  if (noticiasCache.length === 0) {
    caja.innerHTML = `<p class="empty-state">Todavía no hay ninguna noticia. Con «+ Nueva noticia» se escribe la primera.</p>`
    return
  }

  caja.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Titular</th><th>Publicada</th><th>Estado</th><th>Telegram</th><th>X</th><th></th></tr></thead>
      <tbody>
        ${noticiasCache
          .map(
            (n) => `
          <tr>
            <td>${escapeHtml(n.title)}${
              // Si tiene hilo en el foro, se dice: es la señal de que la
              // noticia salió de verdad y la gente puede comentarla.
              n.forum_thread_id ? ` <a class="badge" href="/tema/${encodeURIComponent(n.forum_thread_id)}" target="_blank" rel="noopener">hilo</a>` : ''
            }</td>
            <td>${n.published_at ? escapeHtml(new Date(n.published_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })) : '—'}</td>
            <td>${n.published_at ? '<span class="badge badge-completed">Publicada</span>' : '<span class="badge badge-progress">Borrador</span>'}</td>
            <td>${
              // Esta columna es la que faltaba: una noticia publicada que
              // NO ha salido por el canal no se distinguía de una que sí,
              // y por eso un fallo de configuración podía pasar semanas
              // sin que nadie se enterara.
              !n.published_at
                ? '—'
                : n.telegram_sent_at
                  ? `<span class="badge badge-completed">Mandada</span>`
                  : `<span class="badge badge-progress">Sin mandar</span>`
            }</td>
            <td>${
              // Lo mismo para X (902): y con el enlace al post, que es la
              // comprobación de verdad de que salió.
              !n.published_at
                ? '—'
                : n.x_sent_at
                  ? n.x_post_id
                    ? `<a class="badge badge-completed" href="https://x.com/pokedoc_es/status/${encodeURIComponent(n.x_post_id)}" target="_blank" rel="noopener">Publicada</a>`
                    : `<span class="badge badge-completed">Publicada</span>`
                  : `<span class="badge badge-progress">Sin publicar</span>`
            }</td>
            <td class="admin-row-actions">
              ${n.published_at ? `<a class="btn-outline" href="/noticias/${encodeURIComponent(n.slug)}" target="_blank" rel="noopener">Ver</a>` : ''}
              ${n.published_at ? `<button class="btn-secondary" data-telegram-noticia="${n.id}" title="Mandar esta noticia al canal de Telegram">${icons.send(15)} Telegram</button>` : ''}
              ${n.published_at ? `<button class="btn-secondary" data-x-noticia="${n.id}" title="Publicar esta noticia en la cuenta de X">${icons.send(15)} X</button>` : ''}
              <button data-editar-noticia="${n.id}">Editar</button>
              <button class="danger" data-borrar-noticia="${n.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  caja.querySelectorAll('[data-telegram-noticia]').forEach((btn) =>
    btn.addEventListener('click', () => mandarNoticiaATelegram(btn.dataset.telegramNoticia, btn))
  )
  caja.querySelectorAll('[data-x-noticia]').forEach((btn) =>
    btn.addEventListener('click', () => mandarNoticiaAX(btn.dataset.xNoticia, btn))
  )
  pintarParadaDeX(caja)
  caja.querySelectorAll('[data-editar-noticia]').forEach((btn) =>
    btn.addEventListener('click', () => (window.location.href = `editor-guia.html?id=${btn.dataset.editarNoticia}`))
  )
  caja.querySelectorAll('[data-borrar-noticia]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const n = noticiasCache.find((x) => x.id === btn.dataset.borrarNoticia)
      if (!confirm(`¿Eliminar la noticia «${n?.title || ''}»?`)) return
      // El hilo del foro NO se borra con ella: ahí puede haber una
      // conversación de otra gente, y llevársela por delante porque el
      // artículo se retira sería borrar lo que han escrito. La columna
      // del hilo apunta a la noticia, no al revés.
      await supabase.from('guides').delete().eq('id', btn.dataset.borrarNoticia)
      loadNoticias()
    })
  )
}

// Si la función de X está PARADA (un 401/403/402 de X, 902), se dice
// encima de la lista y se ofrece quitar la parada. Se lee con la sesión
// del admin (la política de la 510 deja ver `scrydex_estado`); si la tabla
// no se deja leer, no se enseña nada: «no se sabe», no «no hay».
async function pintarParadaDeX(caja) {
  const { data } = await supabase.from('scrydex_estado').select('valor').eq('clave', 'x_noticias').maybeSingle()
  const parado = data?.valor?.parado
  if (!parado) return
  const aviso = document.createElement('div')
  aviso.className = 'admin-aviso-parada'
  aviso.innerHTML = `<p><strong>La publicación automática en X está parada</strong> (${escapeHtml(parado.fecha || '')}): ${escapeHtml(parado.motivo || '')}</p><button class="btn-secondary" id="btnReanudarX">Quitar la parada</button>`
  caja.prepend(aviso)
  aviso.querySelector('#btnReanudarX').addEventListener('click', async (e) => {
    const btn = e.currentTarget
    btn.disabled = true
    btn.textContent = 'Quitando…'
    try {
      const session = await getSession()
      const res = await fetch('/.netlify/functions/x-mandar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reanudar: true }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(r.error || `Error ${res.status}`)
      showToast('Parada quitada: la función volverá a intentarlo en su próxima pasada.', 'success')
      aviso.remove()
    } catch (err) {
      btn.disabled = false
      btn.textContent = 'Quitar la parada'
      showToast(String(err.message || err), 'error')
    }
  })
}

// Publicar una noticia en X desde el panel (902). Misma forma que el
// botón de Telegram de abajo: lo que la función programada se calla
// («Unauthorized», «Forbidden», la variable que falta) sale en un aviso.
async function mandarNoticiaAX(id, btn, forzar = false) {
  const n = noticiasCache.find((x) => x.id === id)
  if (forzar && !confirm(`«${n?.title || 'Esta noticia'}» ya se publicó en X. ¿Publicarla otra vez?`)) return

  const session = await getSession()
  const original = btn.innerHTML
  btn.disabled = true
  btn.textContent = 'Publicando…'
  try {
    const res = await fetch('/.netlify/functions/x-mandar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, forzar }),
    })
    const r = await res.json().catch(() => ({}))
    if (res.status === 409) {
      btn.disabled = false
      btn.innerHTML = original
      return mandarNoticiaAX(id, btn, true)
    }
    if (!res.ok) throw new Error(r.error || `Error ${res.status}`)
    showToast(r.aviso || 'Publicada en X.', r.aviso ? 'error' : 'success')
    loadNoticias()
  } catch (err) {
    btn.disabled = false
    btn.innerHTML = original
    showToast(String(err.message || err), 'error')
  }
}

// Empujar una noticia al canal de Telegram desde el panel.
//
// El envío automático (netlify/functions/telegram-noticias.mjs) solo
// mira las noticias de las últimas 48 horas y salta las ya mandadas, así
// que con él no hay manera de recuperar una que se quedó atrás. Esto sí.
//
// Y sobre todo: aquí el fallo SE VE. Lo que la función programada se
// calla —«falta TELEGRAM_CANAL_NOTICIAS», «chat not found», «bot is not
// a member»— sale en un aviso, que es lo que permite arreglarlo.
async function mandarNoticiaATelegram(id, btn, forzar = false) {
  const n = noticiasCache.find((x) => x.id === id)
  if (forzar && !confirm(`«${n?.title || 'Esta noticia'}» ya se mandó al canal. ¿Mandarla otra vez?`)) return

  const session = await getSession()
  const original = btn.innerHTML
  btn.disabled = true
  btn.textContent = 'Mandando…'
  try {
    const res = await fetch('/.netlify/functions/telegram-mandar', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, forzar }),
    })
    const r = await res.json().catch(() => ({}))
    // 409 es «ya mandada»: no es un fallo, es que hay que confirmarlo.
    if (res.status === 409) {
      btn.disabled = false
      btn.innerHTML = original
      return mandarNoticiaATelegram(id, btn, true)
    }
    if (!res.ok) throw new Error(r.error || `Error ${res.status}`)
    // Si la portada no ha entrado como foto se dice POR QUÉ: «file is
    // too big», «failed to get HTTP URL content»… eso es lo que se puede
    // arreglar. La noticia sí ha salido, con la portada en la vista previa.
    const sinPortada = r.sinFoto ? `Mandada al canal, pero la portada no ha entrado como foto: ${r.motivo || 'Telegram no la ha aceptado'}. Sale en la vista previa del enlace.` : 'Mandada al canal.'
    showToast(r.aviso || sinPortada, r.aviso || r.sinFoto ? 'error' : 'success')
    loadNoticias()
  } catch (err) {
    btn.disabled = false
    btn.innerHTML = original
    showToast(String(err.message || err), 'error')
  }
}

document.getElementById('btnNuevaNoticia')?.addEventListener('click', () => {
  window.location.href = 'editor-guia.html?tipo=noticia'
})

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
// Los logros (1118): su panel vive en logros-admin.js, que entra al abrirlo.
async function loadAchievements() {
  const { montarLogros } = await import('./logros-admin.js')
  await montarLogros(document.getElementById('achievementsTable'))
}

// ── Users ──

// ── Usuarios: admin/js/usuarios-admin.js (1121), por import() al abrir la
// sección. Antes era una tabla con ocho botones por fila.
let usuariosMontados = false
function loadUsers() {
  if (usuariosMontados) return
  usuariosMontados = true
  import('./usuarios-admin.js').then((m) => m.montarUsuarios(document.getElementById('usersTable')))
}

// ── Reportes de contenido ──
const REPORT_TYPE_LABELS = {
  guide: `${icons.bookOpen(14)} Guía`,
  profile_comment: `${icons.messageSquare(14)} Comentario de muro (ya no existe)`,
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
      previews[g.id] = { text: g.title, url: `/guia/${encodeURIComponent(g.slug)}` }
    })
  }

  if (idsByType.guide_comment?.length > 0) {
    const { data: comments } = await supabase.from('guide_comments').select('id, body, guide_id').in('id', idsByType.guide_comment)
    const guideIds = [...new Set((comments || []).map((c) => c.guide_id))]
    const { data: guides } = guideIds.length > 0 ? await supabase.from('guides').select('id, slug').in('id', guideIds) : { data: [] }
    const slugById = Object.fromEntries((guides || []).map((g) => [g.id, g.slug]))
    ;(comments || []).forEach((c) => {
      previews[c.id] = { text: snippet(c.body), url: slugById[c.guide_id] ? `/guia/${encodeURIComponent(slugById[c.guide_id])}` : null }
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

  // Los comentarios de muro ya no existen (867): una denuncia vieja de uno
  // se queda sin vista previa, no sin página.
  if (idsByType.profile_review?.length > 0) {
    const reviewIds = idsByType.profile_review || []
    const { data: reviews } = await supabase.from('profile_reviews').select('id, body, rating, profile_id').in('id', reviewIds)
    const profileIds = [...new Set((reviews || []).map((r) => r.profile_id))]
    const { data: profiles } = profileIds.length > 0 ? await supabase.from('user_profiles').select('id, username').in('id', profileIds) : { data: [] }
    const profileById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
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
      <td><input type="number" inputmode="numeric" value="${f.position}" data-pos="${f.id}" style="width:64px;" /></td>
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
          <input type="number" inputmode="numeric" value="${s.position}" data-seccion-pos="${s.id}" style="width:64px;" />
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

function logAnaliticaRota(e) {
  import('../../js/error-log.js').then(({ logClientError }) => logClientError(`Panel de analítica: ${e?.message || e}`, null)).catch(() => {})
}

// Lo que tarda DE VERDAD cada página (821): el p75 de LCP, INP y CLS de
// las visitas medidas, con el color de los umbrales de Google (bueno / a
// mejorar / malo). Lo cuenta la base (`vitales_resumen`).
async function pintarVitales(days) {
  const caja = document.getElementById('analyticsVitales')
  if (!caja) return
  const { data, error } = await supabase.rpc('vitales_resumen', { p_dias: days })
  if (error) {
    caja.innerHTML = `<p class="admin-note">No se puede leer: ${escapeHtml(error.message)}. ¿Falta ejecutar <code>supabase-migration-vitales.sql</code>?</p>`
    return
  }
  if (!data?.length) {
    caja.innerHTML = '<p class="empty-state">Todavía no hay medidas: se apunta una visita de cada cuatro, al salir de la página.</p>'
    return
  }
  const celda = (tipo, v, txt) => `<td><span class="vital vital-${notaDeVital(tipo, v)}">${txt}</span></td>`
  caja.innerHTML = `<table class="admin-table"><thead><tr><th>Página</th><th>Medidas</th><th>LCP p75</th><th>INP p75</th><th>CLS p75</th><th>Móvil</th></tr></thead><tbody>${data
    .map((f) => `<tr><td>${escapeHtml(f.path)}</td><td>${f.visitas}</td>${celda('lcp', f.lcp_p75, f.lcp_p75 == null ? '—' : `${(f.lcp_p75 / 1000).toFixed(1)} s`)}${celda('inp', f.inp_p75, f.inp_p75 == null ? '—' : `${f.inp_p75} ms`)}${celda('cls', f.cls_p75 == null ? null : Number(f.cls_p75), f.cls_p75 == null ? '—' : Number(f.cls_p75).toFixed(2))}<td>${f.movil_pct ?? 0} %</td></tr>`)
    .join('')}</tbody></table>`
}

// LAS PESTAÑAS DE LA ANALÍTICA (1066): la sección enseña solo los bloques
// de la elegida (`data-an-ver`, en admin.css), y se recuerda la última.
const CLAVE_PESTANA_AN = 'pd-admin-analitica'
// Sin el Resumen (falta la migración 1065) se abre en Tráfico, que sí tiene.
let pestanaPorDefecto = 'resumen'
function ponerPestanaAnalitica(cual) {
  const seccion = document.getElementById('section-analytics')
  const nav = document.getElementById('anPestanas')
  if (!seccion || !nav) return
  let ver = cual
  if (!ver) {
    try { ver = localStorage.getItem(CLAVE_PESTANA_AN) } catch {}
    if (ver === 'resumen') ver = pestanaPorDefecto
  }
  if (!nav.querySelector(`[data-an-pestana="${ver}"]`)) ver = pestanaPorDefecto
  seccion.dataset.anVer = ver
  for (const b of nav.querySelectorAll('[data-an-pestana]')) b.setAttribute('aria-selected', String(b.dataset.anPestana === ver))
  if (cual) {
    try { localStorage.setItem(CLAVE_PESTANA_AN, ver) } catch {}
  }
}
document.getElementById('anPestanas')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-an-pestana]')
  if (b) ponerPestanaAnalitica(b.dataset.anPestana)
})
// La salud del Resumen lleva a donde se mira: Técnico, o la sección de errores.
document.getElementById('anResumen')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-an-ir]')
  if (!b) return
  if (b.dataset.anIr === 'errores') document.querySelector('.admin-nav-item[data-section="errors"]')?.click()
  else ponerPestanaAnalitica(b.dataset.anIr)
})

async function loadAnalytics() {
  const days = Number(document.getElementById('analyticsDays')?.value) || 7
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  // El panel en visual (848): lo cuenta la base. Mientras recarga, se queda
  // lo de antes medio apagado (sin esqueleto ni salto). Si la función no
  // está —falta la migración— se pinta lo de siempre y se dice.
  const panel = document.getElementById('anPanel')
  const viejo = document.getElementById('anViejo')
  panel?.classList.add('cargando')
  // Las dos a la vez (1066): la de siempre y la del Resumen. La segunda puede
  // no estar (falta la migración 1065): entonces el Resumen lo dice y lo
  // demás sale igual.
  const [{ data: an, error: anError }, { data: res, error: resError }] = await Promise.all([
    supabase.rpc('admin_analitica', { p_dias: days }),
    supabase.rpc('admin_analitica_resumen', { p_dias: days }),
  ])
  const nuevo = Boolean(panel && !anError && an)
  const cajaResumen = document.getElementById('anResumen')
  const pestanas = document.getElementById('anPestanas')
  if (nuevo) {
    try {
      const { pintarAnalitica, pintarResumen } = await import('./analitica.js')
      pintarAnalitica(panel, an, { pageLabel, resumen: resError ? null : res })
      panel.hidden = false
      viejo.hidden = true
      if (cajaResumen) {
        cajaResumen.hidden = false
        if (res && !resError) pintarResumen(cajaResumen, res, an)
        else cajaResumen.innerHTML = `<div class="admin-warning"><strong>El Resumen no está.</strong> ${
          /PGRST202|Could not find the function/i.test(`${resError?.code} ${resError?.message}`)
            ? 'Falta ejecutar <code>supabase-migration-1065-analitica-app.sql</code> en el SQL Editor; las otras pestañas salen igual.'
            : `No se ha podido leer: ${escapeHtml(resError?.message || 'error desconocido')}.`
        }</div>`
      }
      if (pestanas) pestanas.hidden = false
      pestanaPorDefecto = res && !resError ? 'resumen' : 'trafico'
      ponerPestanaAnalitica()
    } catch (e) {
      panel.hidden = true
      viejo.hidden = false
      logAnaliticaRota(e)
    }
  } else if (panel) {
    panel.hidden = false
    viejo.hidden = false
    panel.innerHTML = `<div class="admin-warning"><strong>El panel nuevo no está.</strong> ${
      /PGRST202|Could not find the function/i.test(`${anError?.code} ${anError?.message}`)
        ? 'Falta ejecutar <code>supabase-migration-analitica.sql</code> en el SQL Editor; mientras, abajo tienes lo de siempre.'
        : `No se ha podido leer: ${escapeHtml(anError?.message || 'error desconocido')}.`
    }</div>`
  }
  panel?.classList.remove('cargando')

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

  const [viewsRes, profilesRes, guidesRes, progressRes, guideCommentsRes] = await Promise.all([
    // Con el panel nuevo las visitas ya vienen contadas: no se bajan.
    nuevo ? Promise.resolve({ data: [], error: null }) : todasLasVisitas(),
    supabase.from('user_profiles').select('id, created_at, current_streak'),
    supabase.from('guides').select('id, title, slug, view_count, blocks').not('published_at', 'is', null),
    supabase.from('user_progress').select('guide_id, user_id, status, read_at'),
    supabase.from('guide_comments').select('id, created_at').gte('created_at', since),
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

  if (nuevo) {
    pintarVitales(days).catch(() => {})
  } else {
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
  pintarVitales(days).catch(() => {})
  }

  // ── Guías más vistas ──
  const guideRows = guides
    .filter((g) => (g.view_count || 0) > 0)
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 15)
    .map((g) => ({
      html: `<a href="/guia/${encodeURIComponent(g.slug)}" target="_blank" rel="noopener">${escapeHtml(g.title)}</a>`,
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
                   `<li><code>${escapeHtml(fichero)}</code> <button type="button" class="btn-secondary" data-copiar-sql="${escapeHtml(fichero)}">Copiar el SQL</button> — ${escapeHtml(rs.map((r) => r.rompe).join(' '))}</li>`
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
              <td>${r.rpc ? `función ${escapeHtml(r.rpc)}()` : `${escapeHtml(r.tabla)}.${escapeHtml(r.columna)}`} <span class="admin-path">${escapeHtml(r.fichero)}</span></td>
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

  // «Copiar el SQL» (791, LO7): el fichero se sirve con la web, así que se
  // copia tal cual para pegarlo en el SQL Editor. Solo lee: no toca la base.
  for (const b of document.querySelectorAll('#schemaTable [data-copiar-sql]')) {
    b.addEventListener('click', async () => {
      try {
        const r = await fetch(`/${b.dataset.copiarSql}`, { cache: 'no-cache' })
        if (!r.ok) throw new Error(String(r.status))
        await navigator.clipboard.writeText(await r.text())
        showToast(`Copiado: pégalo en el SQL Editor de Supabase.`)
      } catch (e) {
        showToast(`No se ha podido copiar ${b.dataset.copiarSql} (${e.message}).`, 'error')
      }
    })
  }

  // Y un aviso en «Hoy», que es lo primero que se abre. Si solo
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

let tcgSetsLocales = []   // lo que ya tenemos importado

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
// MARCAS DE REGULACIÓN LEGALES (tanda 336)
//
// La letra de la esquina que decide si una carta se puede jugar en
// Estándar. Vive en site_settings ('torneos_reglas') y de ahí salen las
// DOS cosas que se lo dicen a la gente: el aviso del revisor de
// decklists y la chapa de la ficha de una carta.
//
// POR QUÉ ESTO EXISTE: hasta ahora la fila solo se podía cambiar desde
// el SQL Editor, y **las marcas rotan cada abril**. Un ajuste que hay
// que cambiar una vez al año y que no tiene pantalla se queda viejo sin
// que nada dé error — y el síntoma es de los peores que hay: la web
// diciéndole a alguien que un mazo legal no lo es.
//
// Por eso la pantalla hace tres cosas, no una:
//   · deja cambiarlas,
//   · CANTA cuando ha pasado un abril desde la última vez, y
//   · antes de guardar cuenta cuántas cartas quedarían legales, para que
//     una letra mal escrita se vea aquí y no en el mazo de alguien.
// ═══════════════════════════════════════════════════════════════════

let marcasLegalesActuales = []
let marcasActualizado = null

// El 1 de abril MÁS RECIENTE que ya ha pasado. Si las marcas se tocaron
// antes de esa fecha, se han saltado una rotación.
function ultimaRotacion(hoy = new Date()) {
  const abril = new Date(Date.UTC(hoy.getUTCFullYear(), 3, 1))
  if (abril > hoy) abril.setUTCFullYear(abril.getUTCFullYear() - 1)
  return abril
}

function marcasDelCampo() {
  return (document.getElementById('marcasLegales')?.value || '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean)
}

async function loadMarcasLegales() {
  const { data } = await supabase
    .from('site_settings')
    .select('value,updated_at')
    .eq('key', 'torneos_reglas')
    .maybeSingle()
  const marcas = data?.value?.marcas_legales
  marcasLegalesActuales = Array.isArray(marcas) ? marcas : []
  marcasActualizado = data?.updated_at || null
  const campo = document.getElementById('marcasLegales')
  if (campo) campo.value = marcasLegalesActuales.join(', ')
  pintarAvisoMarcas()
}

function pintarAvisoMarcas() {
  const caja = document.getElementById('marcasAviso')
  if (!caja) return

  if (!marcasLegalesActuales.length) {
    caja.innerHTML =
      '<p class="admin-note admin-note-warn admin-note-alerta">No hay ninguna marca guardada, así que manda el respaldo del código' +
      ' (H, I, J). Guárdalas aquí para poder cambiarlas sin desplegar.</p>'
    return
  }

  const cuando = marcasActualizado ? new Date(marcasActualizado) : null
  const vieja = cuando && cuando < ultimaRotacion()
  const fecha = cuando
    ? cuando.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'nunca desde que esto se guarda'
  caja.innerHTML = vieja
    ? `<p class="admin-note admin-note-warn admin-note-alerta"><strong>Ha pasado un abril desde la última vez.</strong>` +
      ` Estas marcas (${marcasLegalesActuales.join(', ')}) se tocaron el ${fecha}, y la rotación es en abril:` +
      ' lo más probable es que estén viejas. Compruébalas.</p>'
    : `<p class="admin-note">Ahora mismo valen <strong>${marcasLegalesActuales.join(', ')}</strong>,` +
      ` puestas el ${fecha}.</p>`
}

// Cuántas cartas quedarían legales con lo que hay escrito. Es la red
// contra la errata: una letra que no existe da cero, y cero se ve aquí
// en vez de en el mazo de alguien.
async function comprobarMarcas() {
  const caja = document.getElementById('marcasRecuento')
  const marcas = marcasDelCampo()
  if (!caja) return marcas
  if (!marcas.length) {
    caja.innerHTML = '<p class="admin-note admin-note-warn admin-note-alerta">No has escrito ninguna marca.</p>'
    return marcas
  }
  caja.innerHTML = '<p class="admin-note">Contando…</p>'
  const { count, error } = await supabase
    .from('tcg_cards')
    .select('id', { count: 'exact', head: true })
    .eq('market', 'WEST')
    .in('regulation_mark', marcas)
  if (error) {
    caja.innerHTML = `<p class="admin-note">No se ha podido contar: ${escapeHtml(error.message)}</p>`
    return marcas
  }
  caja.innerHTML = count
    ? `<p class="admin-note">Con ${marcas.join(', ')} queda${count === 1 ? '' : 'n'} <strong>${count}</strong>` +
      ` carta${count === 1 ? '' : 's'} legal${count === 1 ? '' : 'es'} en el catálogo.</p>`
    : `<p class="admin-note admin-note-warn admin-note-alerta"><strong>Ninguna carta del catálogo lleva esas marcas.</strong>` +
      ' Casi seguro que hay una letra mal: mira la esquina de una carta de la rotación antes de guardar.</p>'
  return marcas
}

async function guardarMarcasLegales() {
  const marcas = await comprobarMarcas()
  if (!marcas.length) {
    showToast('Escribe al menos una marca (H, I, J).', 'error')
    return
  }
  const nota = document.getElementById('marcasNota')
  // `updated_at` se escribe A MANO: la columna tiene `default now()`,
  // que solo corre al INSERTAR, y no hay disparador. Sin esto, la fecha
  // se quedaría en la del día que se sembró la fila y el aviso de la
  // rotación mentiría justo al revés de como conviene.
  const { error } = await supabase.from('site_settings').upsert(
    { key: 'torneos_reglas', value: { marcas_legales: marcas }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
  if (error) {
    showToast('No se ha podido guardar: ' + error.message, 'error')
    return
  }
  marcasLegalesActuales = marcas
  marcasActualizado = new Date().toISOString()
  pintarAvisoMarcas()
  if (nota) nota.textContent = 'Guardado.'
  showToast('Marcas guardadas. Las decklists y las fichas ya las usan.', 'success')
}

function initMarcasSection() {
  document.getElementById('btnComprobarMarcas')?.addEventListener('click', () => {
    comprobarMarcas().catch(() => {})
  })
  document.getElementById('btnGuardarMarcas')?.addEventListener('click', () => {
    guardarMarcasLegales().catch(() => {})
  })
}

// ═══════════════════════════════════════════════════════════════════
// MARCA DE REGULACIÓN DE CADA SET (tanda 341)
//
// La marca es del SET: todas sus cartas llevan la misma. TCGdex no la
// trae para algunos —al 30th Celebration le faltaba entera— y sin ella
// la ficha de una carta dice que no es legal cuando sí lo es.
//
// La migración de la 339 las resolvió casi todas sin adivinar, y la
// tarea programada hace lo mismo con los sets que van llegando. Esta
// pantalla es para lo ÚNICO que ninguna de las dos puede garantizar: las
// DEDUCIDAS. Se heredan del set anterior por fecha, y si la rotación
// cayó justo entre uno y el siguiente se quedan con la letra de antes.
//
// Por eso la lista de arriba no son los 220 sets: son esos. Una pantalla
// que te enseña 220 filas para que encuentres tres es una pantalla que
// nadie mira.
// ═══════════════════════════════════════════════════════════════════

// Lo que se puede escribir en la casilla: una letra, o dos por si algún
// día se pasa de la Z. Ni una palabra ni un número.
//
// Y la casilla NO lleva `maxlength`: lo tuvo, y recortaba «Jota» a «Jo»
// —que pasa esta comprobación— y guardaba «JO» como marca, dejando el
// set entero fuera de reglamento. Un campo que se traga lo que escribes
// en silencio y te lo convierte en algo válido es peor que uno que te
// dice que no. Se valida LO QUE SE ESCRIBIÓ.
const MARCA_VALIDA = /^[A-Z]{1,2}$/

function setsPorMarca() {
  const oeste = tcgSetsLocales.filter((x) => (x.market || 'WEST') === 'WEST')
  return {
    oeste,
    deCartas: oeste.filter((x) => x.regulation_mark_origen === 'cartas'),
    deducidos: oeste
      .filter((x) => x.regulation_mark_origen === 'fecha')
      .sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || ''))),
    aMano: oeste.filter((x) => x.regulation_mark_origen === 'mano'),
    sinMarca: oeste.filter((x) => !x.regulation_mark),
  }
}

function pintarMarcasDeSet() {
  const caja = document.getElementById('marcasSetLista')
  const resumen = document.getElementById('marcasSetResumen')
  if (!caja || !resumen) return

  const { oeste, deCartas, deducidos, aMano, sinMarca } = setsPorMarca()

  // Sin la migración puesta la columna no viaja y no hay nada que
  // enseñar. Se dice, en vez de pintar una tabla vacía que parece un
  // fallo.
  if (!oeste.some((x) => x.regulation_mark || x.regulation_mark_origen)) {
    resumen.innerHTML =
      '<p class="admin-note admin-note-warn admin-note-alerta">Falta ejecutar' +
      ' <strong>supabase-migration-marcas-por-set.sql</strong>: hasta entonces los sets no tienen' +
      ' marca y las cartas que TCGdex no marca salen como no legales.</p>'
    caja.innerHTML = ''
    return
  }

  resumen.innerHTML =
    `<p class="admin-note"><strong>${deCartas.length}</strong> salen de sus propias cartas (seguras)` +
    `${aMano.length ? `, <strong>${aMano.length}</strong> puestas a mano` : ''}` +
    `, <strong>${deducidos.length}</strong> deducidas y ` +
    `<strong>${sinMarca.length}</strong> sin marca —esas son anteriores a que existieran, y ahí` +
    ' el hueco es la verdad.</p>'

  caja.innerHTML = deducidos.length
    ? `<table class="admin-table">
        <thead><tr><th>Set</th><th>Salió</th><th>Marca</th><th></th></tr></thead>
        <tbody>${deducidos
          .map(
            (s) => `<tr>
              <td><strong>${escapeHtml(s.name || s.id)}</strong> <span class="subtext">${escapeHtml(s.id)}</span></td>
              <td>${escapeHtml(s.release_date || '—')}</td>
              <td><input type="text" style="max-width: 70px;"
                    aria-label="Marca de ${escapeHtml(s.name || s.id)}"
                    data-marca-set="${escapeHtml(s.id)}" value="${escapeHtml(s.regulation_mark || '')}" /></td>
              <td><button class="btn-outline btn-small" data-confirmar-marca="${escapeHtml(s.id)}">Confirmar</button></td>
            </tr>`
          )
          .join('')}</tbody>
      </table>
      <p class="admin-note">Confirmar una la deja marcada como puesta A MANO, aunque no cambies la
       letra: eso es lo que hace que ninguna pasada futura la vuelva a deducir.</p>`
    : '<p class="admin-note">Ninguna deducida: todas salen de sus cartas o están puestas a mano.</p>'

  caja.querySelectorAll('[data-confirmar-marca]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.confirmarMarca
      const campo = caja.querySelector(`[data-marca-set="${CSS.escape(id)}"]`)
      guardarMarcaDeSet(id, (campo?.value || '').trim().toUpperCase()).catch(() => {})
    })
  )

  const sel = document.getElementById('marcaSetCual')
  if (sel) {
    sel.innerHTML = oeste
      .slice()
      .sort((a, b) => String(b.release_date || '').localeCompare(String(a.release_date || '')))
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name || s.id)}` +
          `${s.regulation_mark ? ` — ${escapeHtml(s.regulation_mark)}` : ' — sin marca'}</option>`
      )
      .join('')
  }
}

// Guarda la marca de un set Y la de sus cartas que no la tengan.
//
// Las dos cosas, y en este orden: el set es de dónde se hereda, pero lo
// que lee la ficha de una carta es la columna de la CARTA. Cambiar solo
// el set dejaría la pantalla diciendo una letra y las fichas otra.
//
// Solo donde está vacía: lo que TCGdex haya dicho de una carta concreta
// no se pisa nunca.
async function guardarMarcaDeSet(setId, letra) {
  const nota = document.getElementById('marcasSetNota')
  if (!MARCA_VALIDA.test(letra)) {
    showToast('La marca es una letra: la de la esquina de la carta (H, I, J…).', 'error')
    return
  }
  const { error } = await supabase
    .from('tcg_sets')
    .update({ regulation_mark: letra, regulation_mark_origen: 'mano' })
    .eq('id', setId)
    .eq('market', 'WEST')
  if (error) {
    showToast('No se ha podido guardar: ' + error.message, 'error')
    return
  }
  const { error: errorCartas, count } = await supabase
    .from('tcg_cards')
    .update({ regulation_mark: letra }, { count: 'exact' })
    .eq('set_id', setId)
    .eq('market', 'WEST')
    .is('regulation_mark', null)
  if (errorCartas) {
    showToast('El set se ha guardado, pero sus cartas no: ' + errorCartas.message, 'error')
    return
  }
  const fila = tcgSetsLocales.find((x) => x.id === setId && (x.market || 'WEST') === 'WEST')
  if (fila) {
    fila.regulation_mark = letra
    fila.regulation_mark_origen = 'mano'
  }
  pintarMarcasDeSet()
  if (nota) nota.textContent = `${setId} → ${letra}${count ? ` (${count} cartas)` : ''}.`
  showToast(`Marca ${letra} guardada. Las fichas ya la usan.`, 'success')
}

function initMarcasDeSetSection() {
  document.getElementById('btnMarcaSetGuardar')?.addEventListener('click', () => {
    const id = document.getElementById('marcaSetCual')?.value
    const letra = (document.getElementById('marcaSetLetra')?.value || '').trim().toUpperCase()
    if (!id) {
      showToast('Elige un set.', 'error')
      return
    }
    guardarMarcaDeSet(id, letra).catch(() => {})
  })
}

async function loadCards() {
  // Desde la 1123 solo hace falta la lista de sets: la marca de cada set
  // (en Colecciones) se pinta con ella. Los importadores de TCGdex se fueron.
  const { data, error } = await supabase.from('tcg_sets').select('*').order('release_date', { ascending: false, nullsFirst: false })
  if (error) {
    cardsNota(`No se puede leer tcg_sets: ${error.message}.`, true)
    return
  }
  tcgSetsLocales = data || []
}

// El estado de las funciones programadas de TCGGO, tal cual lo han dejado
// en `scrydex_estado` (655): el catálogo (por dónde va, qué expansión no
// se ha dejado escribir y por qué, cuáles han escrito cero cartas), los
// pares y los reemplazos. Lee con la sesión del admin: la política de la
// 510 le deja ver esa tabla y a nadie más.
async function tcggoEstado() {
  const caja = document.getElementById('cardsDiagnostico')
  caja.classList.remove('hidden')
  caja.value = 'Leyendo el estado…'
  const { data, error } = await supabase.from('scrydex_estado').select('clave,valor,updated_at').in('clave', PASADAS.map(([k]) => k))
  if (error) { caja.value = `No se ha podido leer el estado: ${error.message}`; return }
  const de = (k) => (data || []).find((f) => f.clave === k)
  // El semáforo (817), encima de la caja: una luz por pasada.
  let luces = document.getElementById('tcggoSemaforo')
  if (!luces) {
    luces = document.createElement('div')
    luces.id = 'tcggoSemaforo'
    luces.className = 'semaforo'
    caja.before(luces)
  }
  luces.innerHTML = PASADAS.map(([k, nombre]) => {
    const s = semaforoDe(de(k))
    return `<div class="semaforo-pasada" data-luz="${s.luz}"><span class="semaforo-luz" aria-hidden="true"></span><strong>${escapeHtml(nombre)}</strong><small>${escapeHtml(s.motivo)}</small></div>`
  }).join('')
  const cat = de('tcggo_catalogo')
  const v = cat?.valor || {}
  const lista = (obj, f) => Object.entries(obj || {}).map(([id, x]) => `  · #${id} ${f(x)}`)
  const lineas = [
    `CATÁLOGO (tcggo_catalogo) — última pasada: ${cat?.updated_at || 'nunca'}`,
    cat ? `  semana ${v.semana} · hecho: ${v.hecho ? 'sí' : 'no'} · hechas: WEST ${v.hechos?.WEST?.length ?? 0}, JP ${v.hechos?.JP?.length ?? 0} · expansiones JP en lista: ${v.episodiosJp?.lista?.length ?? '—'} · peticiones hoy: ${v.gasto?.peticiones ?? 0}` : '  (todavía no ha corrido ninguna vez — o la tabla no te deja leer)',
    v.ultimoError ? `  ⚠ ÚLTIMO ERROR: ${v.ultimoError.mercado} #${v.ultimoError.episodio} ${v.ultimoError.nombre} (intento ${v.ultimoError.intentos}, ${v.ultimoError.fecha}): ${v.ultimoError.error}` : '  sin errores apuntados',
    ...['WEST', 'JP'].flatMap((m) => {
      const f = lista(v.fallidos?.[m], (x) => `${x.nombre}: ${x.intentos} intentos — ${x.error}`)
      const z = lista(v.vacios?.[m], (x) => `${x.nombre}: ${x.filas} cartas pedidas, CERO escritas (sets ${(x.sets || []).join(', ')})`)
      return [
        f.length ? `  ${m} — expansiones que no se han dejado escribir:` : '', ...f,
        z.length ? `  ${m} — expansiones que escribieron cero cartas:` : '', ...z,
      ]
    }),
    '',
    `PARES (tcggo_pares) — ${de('tcggo_pares')?.updated_at || 'nunca'}: ${Object.keys(de('tcggo_pares')?.valor?.hechos || {}).length} sets con expansión decidida · ${Object.keys(de('tcggo_pares')?.valor?.sinEpisodio || {}).length} sin expansión suya`,
    // La pasada de precios (671): hasta ahora solo salía la fecha, y «las
    // japonesas no tienen precio» no se veía en ninguna parte.
    ...(() => {
      const p = de('tcggo_precios')?.valor || {}
      return [
        `PRECIOS (tcggo_precios) — ${de('tcggo_precios')?.updated_at || 'nunca'}: día ${p.dia || '—'} · hecho: ${p.hecho ? 'sí' : 'no'} · expansiones hechas hoy: WEST ${p.hechos?.length ?? 0}, JP ${p.hechosJp?.length ?? 0} · peticiones hoy: ${p.gasto?.peticiones ?? 0}`,
        p.ultimoParado ? `  ⚠ ÚLTIMO PARÓN (${p.ultimoParado.fecha}): ${p.ultimoParado.motivo}` : '  sin parones apuntados',
        // La expansión a medias (826): se sigue página a página.
        p.enCurso ? `  en curso: ${p.enCurso.mercado} #${p.enCurso.episodio} ${de('tcggo_calco_jp')?.valor?.lista?.episodios?.find((e) => e.id === p.enCurso.episodio)?.nombre || ''}, por la página ${p.enCurso.pagina} (${p.enCurso.suyas} cartas suyas, ${p.enCurso.escritas} precios escritos)` : '',
        Object.keys(p.sinCm || {}).length ? `  sin id de Cardmarket en TCGGO (dadas por hechas a la tercera): ${Object.keys(p.sinCm).join(', ')}` : '',
        p.jpBloqueado ? `  ⚠ JAPONÉS BLOQUEADO el ${p.jpBloqueado.dia}: TCGGO dice que el catálogo japonés pide el plan Ultra — ${p.jpBloqueado.motivo}` : '',
        p.faltaMigracionKoZh ? `  ⚠ falta ejecutar supabase-migration-tcggo-corea-china.sql (visto el ${p.faltaMigracionKoZh}): el coreano y el chino se están tirando; se vuelve a probar mañana` : '',
        // Cada expansión japonesa de hoy (825): de quién es la culpa de que
        // una se quede sin precio.
        ...lineasDePreciosJp(p.resumenJp, de('tcggo_calco_jp')?.valor?.lista?.episodios),
      ]
    })(),
    // Los decks japoneses a mano (884): la lista escrita en la función.
    ...(() => {
      const d = de('decks_jp_a_mano')?.valor
      if (!d) return ['DECKS JAPONESES A MANO (decks_jp_a_mano, 884): todavía no ha corrido']
      return [
        `DECKS JAPONESES A MANO (decks_jp_a_mano, 884) — ${de('decks_jp_a_mano')?.updated_at || 'nunca'}: ${Object.entries(d.hechos || {}).map(([k, h]) => `${k}: ${h.estado}${h.cartas ? ` (${h.cartas} cartas, ${h.copiadas} con ficha copiada)` : ''}${h.expansion ? ` (${h.expansion})` : ''}${h.set && h.estado === 'yaExiste' ? ` (${h.set})` : ''}`).join(' · ') || 'nada hecho todavía'}${Object.keys(d.esperas || {}).length ? ` · esperando a Scrydex: ${JSON.stringify(d.esperas)}` : ''}`,
        d.ultimoError ? `  último error (${d.ultimoError.fecha}): ${d.ultimoError.error}` : '',
      ]
    })(),
    // Lo que le falta a un set, de Scrydex (886): las 172 de VSTAR Universe.
    ...(() => {
      const d = de('scrydex_rellenar_set')?.valor
      if (!d) return ['RELLENO DE SETS DESDE SCRYDEX (scrydex_rellenar_set, 886): todavía no ha corrido']
      return [
        `RELLENO DE SETS DESDE SCRYDEX (scrydex_rellenar_set, 886) — ${de('scrydex_rellenar_set')?.updated_at || 'nunca'}: ${Object.entries(d.hechos || {}).map(([k, h]) => `${k}: ${h.estado}${h.estado === 'hecho' ? ` (${h.escritas} escritas de ${h.suyas} suyas; teníamos ${h.teniamos}${h.numeros ? `; ${h.numeros}` : ''}; expansión ${h.expansion} por ${h.por})` : ''}${h.estado === 'sinSet' ? ` (buscado ${JSON.stringify(h.buscado)}; ${h.esperas} veces; se vuelve a mirar)` : ''}${h.error ? ` — ${h.error}` : ''}${h.nota ? ` — ${h.nota}` : ''}`).join(' · ') || 'nada hecho todavía'} · créditos gastados: ${d.gasto?.creditos ?? 0}`,
        d.parado ? `  ⚠ PARADA (${d.parado.fecha}): ${d.parado.motivo}` : '',
        d.ultimoError ? `  último error (${d.ultimoError.fecha}, ${d.ultimoError.clave}, intento ${d.ultimoError.intento}): ${d.ultimoError.error}` : '',
      ]
    })(),
    // Los decks japoneses de Scrydex (883): lo que TCGGO no tiene.
    ...(() => {
      const d = de('scrydex_decks_jp')?.valor
      if (!d) return ['DECKS JAPONESES DE SCRYDEX (scrydex_decks_jp, 883): todavía no ha corrido']
      const creados = Object.entries(d.creados || {})
      return [
        `DECKS JAPONESES DE SCRYDEX (scrydex_decks_jp, 883) — ${de('scrydex_decks_jp')?.updated_at || 'nunca'}: ${Object.keys(d.conservados || {}).length} conservados (${Object.values(d.conservados || {}).filter((c) => c.por === 'vuelto').length} vueltos a enseñar, ${creados.filter(([, c]) => c.estado === 'creado').length} creados) · créditos gastados: ${d.gasto?.creditos ?? 0}${d.faltan ? ` · faltan ${d.faltan.cuantas} (${d.faltan.fecha})` : ''}`,
        d.parado ? `  ⚠ PARADA (${d.parado.fecha}): ${d.parado.motivo}` : '',
        ...creados.filter(([, c]) => c.estado !== 'creado').map(([id, c]) => `  ${c.estado === 'parado' ? '⚠' : '·'} ${id}: ${c.estado}${c.error ? ` — ${c.error}` : ''}`),
        d.faltan?.lista?.length ? `  por traer: ${d.faltan.lista.slice(0, 12).map((f) => `${f.id} «${f.nombre}» (${f.total ?? '?'})`).join(' · ')}${d.faltan.lista.length > 12 ? ' …' : ''}` : '',
        d.ultimoError ? `  último error (${d.ultimoError.fecha}): ${d.ultimoError.error}` : '',
      ]
    })(),
    // El calco japonés (674): expansión a expansión desde TCGGO.
    ...(() => {
      const k = de('tcggo_calco_jp')?.valor
      if (!k) return ['CALCO JAPONÉS (tcggo_calco_jp, 674): todavía no ha corrido']
      const total = k.lista?.episodios?.length ?? 0
      const hechas = Object.keys(k.hechos || {}).length
      const paradas = (k.lista?.episodios || []).filter((e) => !k.hechos?.[e.id] && (Number(k.intentos?.[e.id]) || 0) >= 3)
      return [
        `CALCO JAPONÉS (tcggo_calco_jp, 674) — ${de('tcggo_calco_jp')?.updated_at || 'nunca'}: vuelta ${k.vuelta || 1}${(k.vuelta || 1) >= 4 ? ' (sin casar, con el nombre inglés: 811)' : (k.vuelta || 1) >= 3 ? ' (sin casar: todo de TCGGO, 810)' : (k.vuelta || 1) >= 2 ? ' (entera, todo de TCGGO: 806)' : ''} · ${hechas} de ${total} expansiones hechas · ${paradas.length} paradas · cascarones: ${Object.values(k.cascarones?.vistos || {}).filter((v) => v.estado === 'escondido').length} escondidos${k.cascarones?.listo ? ' (listo)' : ''}`,
        // La vuelta entera (806): cuánto de lo que tenía alguien se recolocó,
        // lo que se quedó sin pareja y lo que se escondió al final.
        ...((k.vuelta || 1) >= 2 ? [
          `  recolocadas por número: ${Object.values(k.hechos || {}).reduce((t, h) => t + (Number(h?.recolocadas) || 0), 0)} · líneas movidas: ${Object.values(k.hechos || {}).reduce((t, h) => t + (Number(h?.lineasMovidas) || 0), 0)} · cartas con dueño sin pareja (se quedan): ${Object.values(k.hechos || {}).reduce((t, h) => t + (Number(h?.seQuedan) || 0), 0)}`,
          Object.keys(k.escondidosAlFinal || {}).length ? `  escondidos al final (sin tcggo_id): ${Object.entries(k.escondidosAlFinal).map(([id, x]) => `${id} «${x.nombre}»`).join(' · ')}` : '',
          ...Object.entries(k.vueltas || {}).map(([n, v]) => `  vuelta ${n}: ${v.hechas} hechas, ${v.dudosas} dudosas (hasta ${v.hasta})`),
        ] : []),
        k.limpieza ? `  al empezar se escondieron ${k.limpieza.escondidos ?? '?'} sets japoneses sin tcggo_id (${k.limpieza.fecha})` : '',
        // Cómo llega una carta de TCGGO (811): para no suponer el idioma.
        k.muestra ? `  muestra de TCGGO (#${k.muestra.episodio} ${k.muestra.nombre || ''}): name «${k.muestra.name}» · slug «${k.muestra.slug}» · numerada «${k.muestra.name_numbered}» → inglés «${k.muestra.ingles}» · campos: ${(k.muestra.campos || []).join(', ')}` : '',
        // Lo que va primero (809), y si TCGGO lo tiene.
        k.primero ? `  primero: ${(k.primero.buscados || []).join(', ')} → ${(k.primero.encontrados || []).length ? k.primero.encontrados.map((e) => `#${e.id} ${e.nombre}${e.codigo ? ` (${e.codigo})` : ''}: ${e.rehecha ? 'rehecha' : 'en cola'}`).join(' · ') : 'TCGGO no tiene ninguna con ese nombre'}` : '',
        ...Object.entries(k.hechos || {}).filter(([, h]) => (h?.viejosEscondidos || []).length).map(([id, h]) => `  ⤓ #${id} → ${h.set}: escondidos los viejos ${h.viejosEscondidos.join(', ')}`),
        ...paradas.map((e) => `  ⚠ parada #${e.id} ${e.nombre}`),
        // Las que la huella no ha sabido colocar (755): no se crean, para
        // no duplicar; se vuelven a mirar a la semana.
        ...Object.entries(k.dudosos || {}).map(([id, d]) => `  ? dudosa #${id} ${d.nombre || ''} (${d.fecha}): ${d.porque}${(d.candidatos || []).length ? ` — candidatos: ${d.candidatos.join(', ')}` : ''}`),
        // Y las fundidas: creadas de nuevo cuando ya había un set nuestro (755).
        ...Object.entries(k.hechos || {}).filter(([, h]) => h?.fundidoDe).map(([id, h]) => `  ↣ fundida #${id}: ${h.fundidoDe} → ${h.set} (${h.por}; ${h.porNumero ?? 0} conservadas por número)`),
        k.ultimoError ? `  último error: #${k.ultimoError.episodio ?? '—'} ${k.ultimoError.nombre ?? ''} (${k.ultimoError.fecha}): ${k.ultimoError.error}` : '',
        ...lineasDeErasJp(k.eras),
        // Los logos (825): cuántas expansiones japonesas traen el suyo en la
        // lista de TCGGO. La que no lo trae se queda con el de Scrydex o sin él.
        (() => {
          const eps = k.lista?.episodios || []
          const sin = eps.filter((e) => !e.logo)
          return eps.length ? `  logos: ${eps.length - sin.length} de ${eps.length} expansiones traen logo en la lista de TCGGO${sin.length ? ` · sin logo: ${sin.slice(0, 30).map((e) => `#${e.id} ${e.nombre}`).join(' · ')}` : ''}` : ''
        })(),
        k.planBloqueado ? `  ⚠ PLAN: ${k.planBloqueado.dia} — ${k.planBloqueado.motivo}` : '',
      ]
    })(),
    // Las cartas japonesas que se quedaron en sets escondidos (824): adónde
    // irían. Solo el informe; reapuntar lo decide PINGU.
    ...(() => {
      const e = de('jp_lineas_viejas')?.valor
      if (!e) return ['LÍNEAS JAPONESAS EN SETS ESCONDIDOS (jp_lineas_viejas, 824): todavía no ha corrido']
      if (e.ultimoError && !e.dia) return [`LÍNEAS JAPONESAS EN SETS ESCONDIDOS (824): ⚠ ${e.ultimoError.error}`]
      return [
        `LÍNEAS JAPONESAS EN SETS ESCONDIDOS (jp_lineas_viejas, 824) — ${e.dia}: ${e.huerfanas} de ${e.lineasJp} líneas japonesas están en un set escondido · ${e.casadas} tienen carta de TCGGO con el mismo número · ${e.aplicar ? 'SE REAPUNTAN' : 'no se toca nada (solo informe)'}`,
        ...Object.entries(e.porSet || {}).map(([id, x]) => `  ${x.casadas === x.lineas ? '✓' : '·'} ${id} «${x.nombre || ''}»: ${x.lineas} líneas → ${x.destino?.set ? `${x.destino.set} (por ${x.destino.por}), ${x.casadas} casan` : x.destino?.dudoso ? `dudoso entre ${x.destino.dudoso.join(', ')}` : 'sin set de TCGGO'}${(x.ejemplos || []).length ? ` · p. ej. ${x.ejemplos.join(', ')}` : ''}${(x.sinCarta || []).length ? ` · sin carta: ${x.sinCarta.join(', ')}` : ''}`),
      ]
    })(),
    // Los huecos desde Scrydex (684) y el espejo de precios (686) ya no
    // existen (817): se retiraron en la 806 y la 809 y se borraron después.
    // Las cartas sueltas sin foto, buscadas en TCGGO por nombre (693).
    ...(() => {
      const e = de('tcggo_sueltas')?.valor
      if (!e) return ['CARTAS SUELTAS SIN FOTO (tcggo_sueltas, 693): todavía no ha corrido']
      const hechas = Object.entries(e.hechas || {})
      const sinPar = Object.entries(e.sinPar || {})
      return [
        `CARTAS SUELTAS SIN FOTO (tcggo_sueltas, 693) — ${de('tcggo_sueltas')?.updated_at || 'nunca'}: ${hechas.length} con foto de TCGGO (${hechas.filter(([, x]) => x.movida).length} cambiadas de set) · ${sinPar.length} sin par · peticiones hoy: ${e.peticionesHoy ?? 0} (Scrydex ${e.scrydexHoy ?? 0}) · parámetro que contesta: ${e.parametro || 'aún no se sabe'}`,
        ...hechas.slice(-8).map(([k, x]) => `  ✓ ${k} «${x.nombre || ''}» ← ${x.por === 'scrydex' ? `Scrydex ${x.scrydex}${x.precio ? ' (con precio de TCGplayer)' : ''}` : `TCGGO ${x.tcggo}${x.episodio ? ` (${x.episodio})` : ''}${x.movida ? ` · de ${x.movida.de} a ${x.movida.a}` : ''}`}`),
        ...sinPar.slice(0, 6).map(([k, x]) => `  · ${k} «${x.nombre || ''}»: ${x.motivo} (intento ${x.intentos})`),
        e.parado ? `  ⚠ PARADO ${e.parado.dia}: ${e.parado.motivo}` : '',
        e.ultimoError ? `  último error (${e.ultimoError.fecha}): ${e.ultimoError.carta || ''} ${e.ultimoError.error}` : '',
      ]
    })(),
    // Las versiones de cada carta (807): el recorrido de ids de TCGGO.
    ...(() => {
      const e = de('tcggo_versiones')?.valor
      if (!e) return ['VERSIONES (tcggo_versiones, 807): todavía no ha corrido']
      const c = e.cuentas || {}
      const tramo = (t, n) => (t?.acabado ? `${n} acabado (${t.porque || ''})` : `${n} por el ${t?.siguiente ?? '—'}`)
      const ej = (tipo, titulo) => (e.ejemplos?.[tipo] || []).length ? [`  ${titulo}: ${e.ejemplos[tipo].map((x) => `${x.id} ${x.nombre || ''} ${x.numero ?? ''}${x.carta ? ` → ${x.carta}` : ''}${x.porque ? ` (${x.porque})` : ''}`).join(' · ')}`] : []
      return [
        `VERSIONES (tcggo_versiones, 807) — ${de('tcggo_versiones')?.updated_at || 'nunca'}: ${tramo(e.subiendo, 'subiendo')} · ${tramo(e.bajando, 'bajando')} · peticiones hoy: ${e.gasto?.peticiones ?? 0} · pendientes de repetir: ${(e.reintentar || []).length}`,
        `  pedidas ${c.pedidas ?? 0} · versiones ${c.versiones ?? 0} · refrescadas ${c.refrescadas ?? 0} · ya eran nuestras ${c.principal ?? 0} · sin id de TCGGO en la nuestra ${c.sinPrincipal ?? 0} · sin carta nuestra ${c.sinCarta ?? 0} · otro producto ${c.otraCarta ?? 0} · dudosas ${c.dudosa ?? 0} · ajenas ${c.ajena ?? 0} · vacías ${c.vacias ?? 0} · saltadas ${c.saltadas ?? 0} · retiradas ${c.retiradas ?? 0}`,
        ...ej('version', 'últimas versiones'),
        ...ej('sinPrincipal', 'sin id de TCGGO en la nuestra'),
        ...ej('sinCarta', 'sin carta nuestra'),
        ...ej('dudosa', 'dudosas'),
        e.sonda ? '' : '  (todavía no ha comprobado la ruta Get card de TCGGO)',
        e.parado ? `  ⚠ PARADO ${e.parado.dia}: ${e.parado.motivo}` : '',
        e.planBloqueado ? `  ⚠ PLAN ${e.planBloqueado.dia}: ${e.planBloqueado.motivo}` : '',
        e.ultimoError ? `  último error (${e.ultimoError.fecha}): ${e.ultimoError.donde}: ${e.ultimoError.error}` : '',
      ]
    })(),
    // Los reemplazos, legibles (697): antes era el JSON cortado a 1.500
    // letras y no se veía si el de Celebrations había corrido.
    ...(() => {
      const e = de('tcggo_reemplazos')?.valor
      if (!e) return ['REEMPLAZOS (tcggo_reemplazos): todavía no ha corrido']
      const hechos = Object.entries(e.hechos || {})
      return [
        `REEMPLAZOS (tcggo_reemplazos) — ${de('tcggo_reemplazos')?.updated_at || 'nunca'}: ${hechos.length} hechos · intentos: ${JSON.stringify(e.intentos || {})}`,
        ...hechos.map(([k, x]) => `  ✓ ${k} (${x.fecha}, expansión ${x.episodio} por ${x.por}): suyas ${x.resumen?.suyas ?? '?'}, escritas ${x.resumen?.escritas ?? '?'}, nuevas ${x.resumen?.nuevas ?? '?'}, borradas ${x.resumen?.borradas ?? '?'}${x.resumen?.fueraDeSuLista != null ? `, fuera de su lista (se quedan) ${x.resumen.fueraDeSuLista}` : ''}, se quedan ${(x.resumen?.seQuedan || []).length}, líneas sin destino ${(x.resumen?.lineasSinDestino || []).length}`),
        // Lo que espera a saber su expansión (1000), y el porqué.
        ...(Array.isArray(e.esperando) ? e.esperando : []).map((x) => `  … ${x.clave}: esperando (${x.motivo})`),
        e.ultimo ? `  último: ${e.ultimo.clave} (${e.ultimo.fecha}): ${e.ultimo.error || e.ultimo.aviso || ''}` : '',
      ]
    })(),
    // El barrido de huecos (670): sets sin cartas que se rellenan solos.
    ...(() => {
      const h = de('tcggo_reemplazos')?.valor?.huecos
      if (!h) return ['HUECOS (sets sin cartas, 670): todavía no ha barrido']
      const vistos = Object.entries(h.vistos || {})
      const de2 = (estado) => vistos.filter(([, v]) => v.estado === estado)
      return [
        `HUECOS (sets sin cartas, 670): ${vistos.length} mirados · ${de2('lleno').length} con cartas · ${de2('rellenado').length} rellenados · ${de2('hermano').length} plegados con otro · ${de2('sinEpisodio').length + de2('vacioEnTcggo').length} sin expansión suya · ${de2('ocultado').length} escondidos (vacíos sin expansión) · ${de2('parado').length} parados`,
        ...de2('rellenado').map(([k, v]) => `  · rellenado ${k} ← expansión #${v.episodio} (${v.cartas} cartas, ${v.fecha})`),
        ...de2('parado').map(([k, v]) => `  ⚠ parado ${k}: ${v.error}`),
        h.ultimoError ? `  último error: ${h.ultimoError.set} (intento ${h.ultimoError.intento}, ${h.ultimoError.fecha}): ${h.ultimoError.error}` : '',
      ]
    })(),
  ].filter((l) => l !== '')
  caja.value = lineas.join('\n')
}

// Una pasada de precios de TCGGO ahora mismo (589): lo mismo que hace la
// La sonda de orígenes (683): de una carta, qué tiene cada sitio. Lo
// contesta la función `sonda-origenes` (es la que tiene las claves) y aquí
// se escribe tal cual, legible, en la caja de diagnóstico.
async function sondaOrigenes() {
  const caja = document.getElementById('cardsDiagnostico')
  const boton = document.getElementById('btnSondaOrigenes')
  const id = (document.getElementById('sondaCartaId')?.value || '').trim() || 'base1-4'
  const mercado = document.getElementById('sondaMercado')?.value || 'WEST'
  const { data: { session } = {} } = await supabase.auth.getSession()
  if (!session) return
  boton.disabled = true
  caja.classList.remove('hidden')
  caja.value = `Preguntando por ${id} (${mercado}) a nuestra base, TCGdex, TCGGO y Scrydex… unos 30 segundos.`
  try {
    const res = await fetch('/.netlify/functions/sonda-origenes', { method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ id, mercado }) })
    const r = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(r.error || `Error ${res.status}`)
    const pinta = (titulo, objeto) => `── ${titulo} ──\n${JSON.stringify(objeto, null, 2)}`
    const ex = (m) => {
      const e = r.tcggo?.[`expansiones_${m}`]
      if (!e) return `(sin lista ${m})`
      return `${m}: ${e.total} expansiones (${e.sinFecha} sin fecha)${e.fin ? ` · ${e.fin}` : ''}\n  más antiguas: ${(e.primeras || []).map((x) => `${x.fecha} ${x.nombre} [${x.codigo || '—'}] #${x.id} (${x.cartas ?? '?'} cartas)`).join('\n                ')}\n  más nueva: ${e.ultima ? `${e.ultima.fecha} ${e.ultima.nombre}` : '—'}`
    }
    caja.value = [
      `Carta ${r.id} · mercado ${r.mercado} · peticiones: TCGGO ${r.peticiones?.tcggo}, TCGdex ${r.peticiones?.tcgdex}, Scrydex ${r.peticiones?.scrydex}`,
      '',
      pinta('NUESTRA BASE', r.nuestra),
      '',
      pinta('EL SET, Y QUÉ HA HECHO CADA FUNCIÓN CON ÉL', r.setNuestro),
      '',
      pinta('TCGDEX', r.tcgdex),
      '',
      '── TCGGO · expansiones más antiguas ──',
      ex('WEST'),
      ex('JP'),
      '',
      pinta('TCGGO · la expansión de este set', r.tcggo?.expansionDelSet ?? r.tcggo?.saltado),
      pinta('TCGGO · la carta dentro', { cartasDeLaExpansion: r.tcggo?.cartasDeLaExpansion, ...(r.tcggo?.laCarta || {}) }),
      pinta('TCGGO · ¿busca por nombre?', r.tcggo?.busqueda),
      '',
      pinta('SCRYDEX', r.scrydex),
    ].join('\n')
  } catch (err) {
    caja.value = `Error: ${err.message}`
  } finally {
    boton.disabled = false
  }
}

// La sonda de TCGGO (929): lo que contesta, tal cual, en la caja de
// diagnóstico; las repetidas de un set, una línea por número.
async function tcggoSonda() {
  const caja = document.getElementById('cardsDiagnostico')
  const boton = document.getElementById('btnTcggoSonda')
  const modo = document.getElementById('tcggoSondaModo')?.value || 'carta'
  const valor = (document.getElementById('tcggoSondaValor')?.value || '').trim()
  const mercado = document.getElementById('tcggoSondaMercado')?.value || 'WEST'
  const { data: { session } = {} } = await supabase.auth.getSession()
  if (!session) return
  boton.disabled = true
  caja.classList.remove('hidden')
  caja.value = 'Preguntando…'
  try {
    const res = await fetch('/.netlify/functions/tcggo-sonda', { method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ modo, valor, mercado }) })
    const r = await res.json().catch(() => ({}))
    if (!res.ok || r.error) throw new Error(r.error || `Error ${res.status}`)
    if (modo === 'versiones') {
      caja.value = [
        `Expansión ${r.episodio} de TCGGO → ${(r.sets || []).join(', ')}`,
        `${r.peticiones} peticiones · ${r.suyas} cartas suyas, ${r.conVersiones} con versiones`,
        `${r.emparejadas} de nuestras ${r.nuestras} casadas · ${r.escritas} versiones guardadas`,
      ].join('\n')
    } else if (modo === 'duplicados') {
      caja.value = [
        `Set ${r.set?.id} (${r.set?.name}) · tcggo_id ${r.set?.tcggo_id ?? '—'} · ${r.cartas} cartas`,
        `Sets con esa expansión: ${(r.sets || []).map((s) => `${s.id}${s.oculto ? ' (oculto)' : ''}${s.origen ? ` [${s.origen}]` : ''}`).join(', ')}`,
        '',
        r.repetidas?.length ? `${r.repetidas.length} números repetidos:` : 'Ningún número repetido.',
        ...(r.repetidas || []).map((x) => `  ${x.numero}: ${x.cartas.map((c) => `${c.id} «${c.name}» set ${c.set_id}${c.origen ? ` [${c.origen}]` : ''} tcggo ${c.tcggo_id ?? '—'} cm ${c.cm_id_product_propio ?? '—'}`).join('  ·  ')}`),
      ].join('\n')
    } else {
      let cuerpo = r.cuerpo
      try { cuerpo = JSON.stringify(JSON.parse(r.cuerpo), null, 2) } catch { /* no es JSON: tal cual */ }
      caja.value = `${r.url} → ${r.estado}${r.recortado ? ' (recortado)' : ''}\n\n${cuerpo}`
    }
  } catch (err) {
    caja.value = `Error: ${err.message}`
  } finally {
    boton.disabled = false
  }
}

function initCardsSection() {
  document.getElementById('btnTcggoEstado')?.addEventListener('click', tcggoEstado)
  document.getElementById('btnSondaOrigenes')?.addEventListener('click', sondaOrigenes)
  document.getElementById('btnTcggoSonda')?.addEventListener('click', tcggoSonda)
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
    loadNoticias(),
    loadAchievements(),
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
  await loadMarcasLegales()

  initCardsSection()
  initArquetiposSection()
  initMarcasSection()
  initMarcasDeSetSection()
  // Después de loadCards(): se pinta con `tcgSetsLocales`.
  pintarMarcasDeSet()

  document.getElementById('analyticsDays')?.addEventListener('change', loadAnalytics)

  // La cola, al arrancar: si la migración no está puesta lo dice y ya.
  loadCorreosCola().catch(() => {})
  loadColabora().catch(() => {})
}

// ═══════════════════════════════════════════════════════════════════
// Correos (tanda 350)
// ═══════════════════════════════════════════════════════════════════
//
// «Quiero ver todos los correos que mandamos» (PINGU). Hasta ahora la
// única manera de ver uno era esperar a que te tocara, y así es como se
// vive meses con un enlace que lleva a otro sitio.
//
// La vista previa se pinta con `js/email-plantilla.js`, que es EL MISMO
// módulo que usa la función de envío — no una copia parecida. Una copia
// se separa, y la del correo no la ve nadie hasta que sale mal en la
// bandeja de alguien.
// La lista y el editor de textos: admin/js/correos-admin.js (1122), por
// import() al abrir la sección (antes eran veinte vistas previas al arrancar).
let correosMontados = false
function pintarCorreos() {
  if (correosMontados) return
  correosMontados = true
  import('./correos-admin.js').then((m) => m.montarCorreos(document.getElementById('correosLista')))
}

// ── Cómo va la cola ──
//
// `email_outbox` no la puede leer nadie desde el navegador (RLS sin
// políticas, a propósito). Estas dos funciones devuelven RECUENTOS y
// errores, nunca asuntos ni destinatarios, y solo al admin.
async function loadCorreosCola() {
  const resumen = document.getElementById('correosResumen')
  const errores = document.getElementById('correosErrores')
  if (!resumen) return

  const { data, error } = await supabase.rpc('email_outbox_resumen')
  if (error) {
    resumen.innerHTML = ''
    if (errores) {
      errores.innerHTML = `<p class="admin-note admin-note-alerta">No se puede leer la cola: ${escapeHtml(error.message)}.
        Si pone que no existe la función, falta ejecutar <code>supabase-migration-correo-envio.sql</code>.</p>`
    }
    return
  }

  const filas = data || []
  const porEstado = {}
  for (const f of filas) porEstado[f.status] = (porEstado[f.status] || 0) + Number(f.cuantos || 0)
  resumen.innerHTML = [
    statCardHtml(porEstado.pending || 0, 'En cola', 'esperando a salir'),
    statCardHtml(porEstado.sending || 0, 'Enviándose', 'reclamados por una pasada'),
    statCardHtml(porEstado.sent || 0, 'Enviados', 'en total'),
    statCardHtml(porEstado.failed || 0, 'Fallidos', 'no se pudieron mandar'),
  ].join('')

  const { data: fallos } = await supabase.rpc('email_outbox_errores')
  if (errores) {
    errores.innerHTML = (fallos || []).length
      ? `<details class="admin-detalle-avanzado"><summary>Últimos errores (${fallos.length})</summary>
          <table class="admin-table"><thead><tr><th>Tipo</th><th>Error</th><th>Intentos</th></tr></thead>
          <tbody>${fallos
            .map((f) => `<tr><td><code>${escapeHtml(f.type)}</code></td><td>${escapeHtml(String(f.last_error || '').slice(0, 160))}</td><td>${escapeHtml(f.attempts)}</td></tr>`)
            .join('')}</tbody></table></details>`
      : '<p class="admin-note">Ningún error en la cola.</p>'
  }
}

// ═══════════════════════════════════════════════════════════════════
// Colabora (tanda 361)
// ═══════════════════════════════════════════════════════════════════
//
// Las solicitudes de /colabora, con el HISTORIAL de cada persona al
// lado. Ese es el motivo de que el formulario pida sesión: un formulario
// de fuera te da un nombre, y con un nombre no se decide nada. Con sus
// mensajes en el foro, sus torneos y su antigüedad, sí.
const ESTADOS_COLABORA = {
  nueva: 'Nueva',
  hablando: 'Hablando',
  aceptada: 'Aceptada',
  descartada: 'Descartada',
}

const PUESTOS_COLABORA = {
  noticias: 'Noticias', guias: 'Guías', torneos: 'Torneos',
  foro: 'Foro', redes: 'Diseño y redes', otra: 'Otra cosa',
}

const HORAS_COLABORA = { poca: 'Poco tiempo', media: 'Un rato por semana', mucha: 'Bastante' }

async function loadColabora() {
  const caja = document.getElementById('colaboraLista')
  const resumen = document.getElementById('colaboraResumen')
  if (!caja) return

  const { data, error } = await supabase
    .from('collab_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    resumen.innerHTML = ''
    caja.innerHTML = `<p class="admin-note admin-note-alerta">No se puede leer: ${escapeHtml(error.message)}.
      Si dice que no existe la tabla, falta ejecutar <code>supabase-migration-colabora.sql</code>.</p>`
    return
  }

  const filas = data || []
  const porEstado = {}
  for (const f of filas) porEstado[f.status] = (porEstado[f.status] || 0) + 1
  resumen.innerHTML = [
    statCardHtml(porEstado.nueva || 0, 'Sin contestar', 'esperando respuesta'),
    statCardHtml(porEstado.hablando || 0, 'Hablando', 'conversación abierta'),
    statCardHtml(porEstado.aceptada || 0, 'Dentro', 'ya colaboran'),
    statCardHtml(filas.length, 'En total', 'desde que existe la página'),
  ].join('')

  if (!filas.length) {
    caja.innerHTML = '<p class="admin-note">Nadie se ha ofrecido todavía.</p>'
    return
  }

  // El historial, en tres consultas para TODAS las solicitudes juntas y
  // no una por persona: con cinco solicitudes da igual, con cincuenta es
  // la diferencia entre una pantalla y una espera.
  const ids = [...new Set(filas.map((f) => f.user_id))]
  const [perfiles, mensajes, torneos] = await Promise.all([
    supabase.from('user_profiles').select('id,username,display_name,avatar_url,created_at').in('id', ids),
    supabase.from('forum_posts').select('author_id').in('author_id', ids),
    supabase.from('tournament_registrations').select('user_id').in('user_id', ids),
  ])
  const perfilDe = new Map((perfiles.data || []).map((p) => [p.id, p]))
  const cuenta = (lista, campo) => {
    const m = new Map()
    for (const f of lista || []) m.set(f[campo], (m.get(f[campo]) || 0) + 1)
    return m
  }
  const mensajesDe = cuenta(mensajes.data, 'author_id')
  const torneosDe = cuenta(torneos.data, 'user_id')

  caja.innerHTML = filas
    .map((f) => {
      const p = perfilDe.get(f.user_id)
      const nombre = p?.display_name || p?.username || 'Alguien'
      const desde = p?.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : '—'
      const roles = (f.roles || []).map((r) => PUESTOS_COLABORA[r] || r).join(', ')
      return `<div class="admin-card" style="margin-bottom: 16px;">
        <h3 style="margin-top: 0;">
          ${p?.username ? `<a href="/usuario/${escapeHtml(p.username)}" target="_blank" rel="noopener">${escapeHtml(nombre)}</a>` : escapeHtml(nombre)}
          <span class="subtext">· ${escapeHtml(ESTADOS_COLABORA[f.status] || f.status)}</span>
        </h3>
        <p class="admin-note">
          <strong>${escapeHtml(roles || '—')}</strong> · ${escapeHtml(HORAS_COLABORA[f.horas] || f.horas)} ·
          ${escapeHtml(new Date(f.created_at).toLocaleDateString('es-ES'))}
        </p>
        <p class="admin-note">
          En PokeDoc desde ${escapeHtml(desde)} ·
          <strong>${mensajesDe.get(f.user_id) || 0}</strong> mensajes en el foro ·
          <strong>${torneosDe.get(f.user_id) || 0}</strong> torneos jugados
        </p>
        ${f.experiencia ? `<p class="admin-note"><strong>Ha hecho:</strong> ${escapeHtml(f.experiencia)}</p>` : ''}
        ${f.por_que ? `<p class="admin-note"><strong>Por qué:</strong> ${escapeHtml(f.por_que)}</p>` : ''}
        ${f.muestra ? `<blockquote class="admin-cita">${escapeHtml(f.muestra)}</blockquote>` : ''}
        <div class="foro-admin-fila">
          <select data-colabora-estado="${escapeHtml(f.id)}">
            ${Object.entries(ESTADOS_COLABORA)
              .map(([v, t]) => `<option value="${v}" ${f.status === v ? 'selected' : ''}>${t}</option>`)
              .join('')}
          </select>
          <input type="text" data-colabora-nota="${escapeHtml(f.id)}" placeholder="Nota para ti" value="${escapeHtml(f.nota_admin || '')}" />
          <button class="btn-secondary" data-colabora-guardar="${escapeHtml(f.id)}">Guardar</button>
        </div>
      </div>`
    })
    .join('')

  caja.querySelectorAll('[data-colabora-guardar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.dataset.colaboraGuardar
      const estado = caja.querySelector(`[data-colabora-estado="${id}"]`).value
      const nota = caja.querySelector(`[data-colabora-nota="${id}"]`).value.trim()
      const { error } = await supabase
        .from('collab_applications')
        .update({ status: estado, nota_admin: nota || null, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        showToast('No se ha podido guardar: ' + error.message, 'error')
        return
      }
      showToast('Guardado.', 'success')
      loadColabora().catch(() => {})
    })
  )
}

init()

// Las expansiones japonesas de la pasada de precios de hoy (825): solo las
// que se han quedado sin precio o con menos de la mitad, y por qué.
function lineasDePreciosJp(resumen, episodios) {
  const filas = Object.entries(resumen || {})
  if (!filas.length) return []
  const nombres = new Map((episodios || []).map((e) => [String(e.id), e.nombre]))
  const malas = filas.filter(([, x]) => !x.escritas || x.conPrecio < x.suyas / 2)
  const porque = (x) =>
    !x.suyas ? 'TCGGO no da ninguna carta'
      : !x.conCm && !x.escritas ? 'TCGGO no da el id de Cardmarket de ninguna (y no casa ninguna por su id de TCGGO)'
        : !x.conPrecio ? 'TCGGO no da precio de ninguna'
          : !x.nuestras && x.sinCarta ? `TCGGO tiene ${x.sinCarta} cartas que no están en nuestra base (las tiene que escribir el calco)`
          : !x.nuestras ? `nuestras cartas no tienen id de Cardmarket (${(x.sets || []).join(', ')})`
            : !x.escritas ? 'los ids de Cardmarket no casan con los nuestros'
              : 'TCGGO da precio de menos de la mitad'
  const corregidas = filas.reduce((t, [, x]) => t + (Number(x.corregidas) || 0), 0)
  const movidas = filas.reduce((t, [, x]) => t + (Number(x.movidas) || 0), 0)
  const sinCarta = filas.reduce((t, [, x]) => t + (Number(x.sinCarta) || 0), 0)
  const adoptadas = filas.reduce((t, [, x]) => t + (Number(x.adoptadas) || 0), 0)
  const repetidas = filas.reduce((t, [, x]) => t + (Number(x.repetidas) || 0), 0)
  const deDonde = [...new Set(filas.flatMap(([, x]) => x.deDonde || []))].slice(0, 12)
  return [
    `  japonés de hoy: ${filas.length} expansiones con precio mirado · ${malas.length} sin precio o con menos de la mitad${corregidas ? ` · ${corregidas} cartas con el id de Cardmarket de antes, cambiado por el de TCGGO (830)` : ''}${movidas ? ` · ${movidas} estaban en otro set y se han llevado al de su expansión (831; venían de ${deDonde.join(', ')})` : ''}${adoptadas ? ` · ${adoptadas} nuestras sin id de TCGGO casadas por número` : ''}${repetidas ? ` · ${repetidas} traídas que ya tenían otra con su número (no se borra nada)` : ''}${sinCarta ? ` · ${sinCarta} cartas de TCGGO no están en nuestra base` : ''}`,
    ...malas.slice(0, 40).map(([id, x]) => `  · #${id} ${nombres.get(id) || ''}: ${porque(x)} — TCGGO ${x.suyas} cartas, ${x.conCm} con id de Cardmarket, ${x.conPrecio} con precio · nuestras ${x.nuestras} · escritas ${x.escritas}`),
  ]
}

// Las eras del japonés según TCGGO (825).
function lineasDeErasJp(eras) {
  const u = eras?.ultima
  if (!u) return ['  eras (825): todavía no se han mirado (van cuando el calco está entero, una vez al día)']
  const sinEra = u.sinEra || []
  return [
    `  eras (825, ${u.fecha}): ${u.sets} sets a la vista, ${u.conSerieDeTcggo ?? '?'} con serie de TCGGO, ${u.viejos ?? '?'} viejos escondidos con era · movidos en la última pasada: ${u.movidosAhora} · quedan: ${u.quedan} · sin era: ${u.sinEraTotal ?? sinEra.length} · respetados por estar cambiados a mano: ${(u.respetadas || []).length}`,
    '    series de TCGGO: ' + ((u.eras || []).map((e) => `${e.nombre || '—'} → ${e.serie_id} (${e.sets})`).join(' · ') || 'ninguna'),
    ...((u.estanteria || []).length ? ['    la estantería japonesa queda así:', ...u.estanteria.map((e) => `      ${e.serie_id}${e.nombre ? ` «${e.nombre}»` : ''}: ${e.sets} sets${e.desde ? `, ${e.desde} → ${e.hasta}` : ''}`)] : []),
    ...(sinEra.length ? ['    sin era (se quedan como están):', ...sinEra.map((x) => (typeof x === 'string' ? `      ${x}` : `      ${x.id} «${x.nombre}» (${x.fecha || 'sin fecha'}): ${x.porque}`))] : []),
    ...(eras.movidos || []).slice(0, 60).map((m) => `    ↦ ${m.id} «${m.nombre}»: ${m.soloNombre ? `${m.a} (solo el nombre de la era)` : `${m.de || 'sin era'} → ${m.a}`}${m.por === 'tcggo' ? '' : ` (por ${m.por})`}`),
    eras.ultimoError ? `    ⚠ último error (${eras.ultimoError.fecha}): ${eras.ultimoError.set ? `${eras.ultimoError.set}: ` : ''}${eras.ultimoError.error}` : '',
  ]
}
