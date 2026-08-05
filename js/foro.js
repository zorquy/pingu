import { supabase } from './supabase.js'
import { getSession, escapeHtml } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import {
  haceCuanto,
  fechaLarga,
  perfilesPorId,
  avatarHtml,
  enlacePerfil,
  etiquetaHtml,
  urlForo,
  urlTema,
  foroDeLaRuta,
  esDelEquipo,
  faltaElForo,
} from './foro-comun.js'

// El foro. Esta página hace dos cosas según la URL:
//
//   /foro            → el índice: secciones, foros y subforos
//   /foro/<slug>     → la lista de temas de un foro
//
// Van juntas porque comparten cabecera, migas de pan y barra lateral, y
// porque el índice no es más que la lista de foros: separarlas obligaría
// a repetir las tres cosas.

const PAGINA = 20

const params = new URLSearchParams(window.location.search)
const slugForo = foroDeLaRuta()
const paginaActual = Math.max(1, Number(params.get('p') || 1))

const principal = document.getElementById('foroPrincipal')
const lateral = document.getElementById('foroLateral')
const migas = document.getElementById('foroMigas')
const acciones = document.getElementById('foroAcciones')

let sesion = null
let soyStaff = false

function migasHtml(trozos) {
  return trozos
    .map((t, i) =>
      i === trozos.length - 1
        ? `<span aria-current="page">${escapeHtml(t.texto)}</span>`
        : `<a href="${t.url}">${escapeHtml(t.texto)}</a>`
    )
    .join('<span class="foro-migas-sep" aria-hidden="true">›</span>')
}

function sinActivar() {
  principal.innerHTML = `<p class="empty-state">El foro todavía no está activado.</p>`
  lateral.innerHTML = ''
}

// ─────────────────────────────────────────────────────────────
// El último mensaje de un foro o de un tema, en una columna
// ─────────────────────────────────────────────────────────────
function ultimoHtml({ titulo, url, fecha, perfil }) {
  if (!fecha) return `<div class="foro-ultimo foro-ultimo-vacio"><span class="subtext">Sin mensajes todavía</span></div>`
  return `
    <div class="foro-ultimo">
      ${avatarHtml(perfil, 30)}
      <div class="foro-ultimo-texto">
        <a class="foro-ultimo-titulo" href="${url}">${escapeHtml(titulo || 'Ver tema')}</a>
        <span class="subtext" title="${escapeHtml(fechaLarga(fecha))}">${escapeHtml(haceCuanto(fecha))} · ${enlacePerfil(perfil)}</span>
      </div>
    </div>`
}

// ─────────────────────────────────────────────────────────────
// 1. El índice
// ─────────────────────────────────────────────────────────────
async function pintarIndice() {
  const [seccionesRes, forosRes] = await Promise.all([
    supabase.from('forum_sections').select('*').order('position'),
    supabase.from('forum_boards_resumen').select('*').order('position'),
  ])

  if (faltaElForo(seccionesRes.error) || faltaElForo(forosRes.error)) return sinActivar()

  const secciones = seccionesRes.data || []
  const foros = forosRes.data || []
  const perfiles = await perfilesPorId(foros.map((f) => f.last_post_author_id))

  const hijosDe = (id) => foros.filter((f) => f.parent_id === id).sort((a, b) => a.position - b.position)

  const filaForo = (f) => {
    const subforos = hijosDe(f.id)
    return `
    <div class="foro-fila">
      <div class="foro-fila-icono" aria-hidden="true">${icons.messageSquare(22)}</div>
      <div class="foro-fila-cuerpo">
        <h3><a href="${urlForo(f.slug)}">${escapeHtml(f.name)}</a></h3>
        ${f.description ? `<p class="subtext">${escapeHtml(f.description)}</p>` : ''}
        ${
          subforos.length
            ? `<p class="foro-subforos">${subforos
                .map((s) => `<a href="${urlForo(s.slug)}">${icons.messageSquare(12)} ${escapeHtml(s.name)}</a>`)
                .join('')}</p>`
            : ''
        }
      </div>
      <div class="foro-fila-numeros">
        <span><small>Temas</small><strong>${f.thread_count || 0}</strong></span>
        <span><small>Mensajes</small><strong>${f.post_count || 0}</strong></span>
      </div>
      ${ultimoHtml({
        titulo: f.last_thread_title,
        url: f.last_thread_id ? urlTema(f.last_thread_id) : '#',
        fecha: f.last_post_at,
        perfil: perfiles[f.last_post_author_id],
      })}
    </div>`
  }

  const bloques = secciones
    .map((s) => {
      const suyos = foros.filter((f) => f.section_id === s.id && !f.parent_id).sort((a, b) => a.position - b.position)
      if (suyos.length === 0) return ''
      return `
      <section class="foro-seccion">
        <h2 class="foro-seccion-titulo">${escapeHtml(s.name)}</h2>
        ${suyos.map(filaForo).join('')}
      </section>`
    })
    .join('')

  principal.innerHTML =
    bloques ||
    `<p class="empty-state">Todavía no hay ningún foro abierto. Se crean desde el panel de administración.</p>`

  migas.innerHTML = migasHtml([{ texto: 'Inicio', url: '/index.html' }, { texto: 'Foro' }])
  await pintarLateral()
}

// ─────────────────────────────────────────────────────────────
// La barra lateral: lo último que se ha escrito
// ─────────────────────────────────────────────────────────────
//
// Esto es lo que hace que un foro parezca vivo. Un índice de foros con
// números y nada más se lee como un archivo; con los últimos mensajes a
// la vista se lee como un sitio donde hay gente.
//
// A propósito NO hay "usuarios en línea": con veinte personas, un "en
// línea: 1" enseña soledad. Los mensajes recientes, no.
async function pintarLateral() {
  const { data: mensajes, error } = await supabase
    .from('forum_posts')
    .select('id, thread_id, author_id, created_at, body_html')
    .order('created_at', { ascending: false })
    .limit(8)
  if (error || !mensajes || mensajes.length === 0) {
    lateral.innerHTML = ''
    return
  }

  const { data: temas } = await supabase
    .from('forum_threads')
    .select('id, title, board_id')
    .in('id', [...new Set(mensajes.map((m) => m.thread_id))])
  const temaPorId = Object.fromEntries((temas || []).map((t) => [t.id, t]))
  const perfiles = await perfilesPorId(mensajes.map((m) => m.author_id))

  // Un mensaje por tema: si alguien contesta cinco veces seguidas, no
  // llena él solo toda la columna.
  const vistos = new Set()
  const filas = mensajes
    .filter((m) => {
      if (vistos.has(m.thread_id)) return false
      vistos.add(m.thread_id)
      return true
    })
    .slice(0, 6)
    .map((m) => {
      const tema = temaPorId[m.thread_id]
      if (!tema) return ''
      return `
      <a class="foro-reciente" href="${urlTema(m.thread_id)}">
        ${avatarHtml(perfiles[m.author_id], 28)}
        <span class="foro-reciente-texto">
          <strong>${escapeHtml(tema.title)}</strong>
          <small>${escapeHtml(haceCuanto(m.created_at))}</small>
        </span>
      </a>`
    })
    .join('')

  lateral.innerHTML = filas ? `<div class="foro-panel"><h3>Lo último</h3>${filas}</div>` : ''
}

// ─────────────────────────────────────────────────────────────
// 2. La lista de temas de un foro
// ─────────────────────────────────────────────────────────────
async function pintarForo() {
  const { data: foro, error } = await supabase.from('forum_boards_resumen').select('*').eq('slug', slugForo).maybeSingle()
  if (faltaElForo(error)) return sinActivar()
  if (!foro) {
    principal.innerHTML = `<p class="empty-state">Este foro no existe o ya no está.</p>`
    migas.innerHTML = migasHtml([{ texto: 'Inicio', url: '/index.html' }, { texto: 'Foro', url: '/foro.html' }, { texto: 'No encontrado' }])
    return
  }

  document.getElementById('foroTitulo').textContent = foro.name
  document.getElementById('foroSubtitulo').textContent = foro.description || ''
  document.title = `${foro.name} — Foro de PokeDoc`

  const [{ data: seccion }, { data: padre }] = await Promise.all([
    supabase.from('forum_sections').select('name').eq('id', foro.section_id).maybeSingle(),
    foro.parent_id
      ? supabase.from('forum_boards').select('name, slug').eq('id', foro.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  migas.innerHTML = migasHtml(
    [
      { texto: 'Inicio', url: '/index.html' },
      { texto: 'Foro', url: '/foro.html' },
      seccion ? { texto: seccion.name, url: '/foro.html' } : null,
      padre ? { texto: padre.name, url: urlForo(padre.slug) } : null,
      { texto: foro.name },
    ].filter(Boolean)
  )

  const puedeEscribir = foro.post_policy === 'todos' || soyStaff
  acciones.innerHTML = puedeEscribir
    ? `<button type="button" class="btn-primary" id="btnNuevoTema">${icons.edit(15)} Abrir un tema</button>`
    : `<span class="subtext">${icons.lock ? icons.lock(14) : ''} Solo el equipo abre temas aquí</span>`

  await pintarListaDeTemas(foro)
  await pintarLateral()

  document.getElementById('btnNuevoTema')?.addEventListener('click', () => abrirFormularioTema(foro))
}

async function pintarListaDeTemas(foro) {
  const desde = (paginaActual - 1) * PAGINA
  const hasta = desde + PAGINA - 1

  const [{ data: subforos }, { count }, { data: temas }] = await Promise.all([
    supabase.from('forum_boards_resumen').select('*').eq('parent_id', foro.id).order('position'),
    supabase.from('forum_threads').select('*', { count: 'exact', head: true }).eq('board_id', foro.id),
    supabase
      .from('forum_threads')
      .select('*')
      .eq('board_id', foro.id)
      .order('is_pinned', { ascending: false })
      .order('last_post_at', { ascending: false })
      .range(desde, hasta),
  ])

  const lista = temas || []
  const perfiles = await perfilesPorId(lista.map((t) => t.author_id))
  const totalPaginas = Math.max(1, Math.ceil((count || 0) / PAGINA))

  const filaTema = (t) => `
    <div class="foro-tema-fila ${t.is_pinned ? 'foro-tema-fijado' : ''}">
      <div class="foro-fila-icono" aria-hidden="true">${
        t.is_pinned ? icons.pin?.(18) || icons.star(18) : icons.messageSquare(18)
      }</div>
      <div class="foro-fila-cuerpo">
        <h3>
          ${t.is_pinned ? '<span class="foro-chapa">Fijado</span>' : ''}
          ${t.is_locked ? '<span class="foro-chapa foro-chapa-cerrado">Cerrado</span>' : ''}
          ${etiquetaHtml(t.prefix)}
          <a href="${urlTema(t.id)}">${escapeHtml(t.title)}</a>
        </h3>
        <p class="subtext">${avatarHtml(perfiles[t.author_id], 18)} ${enlacePerfil(perfiles[t.author_id])} · <span title="${escapeHtml(
          fechaLarga(t.created_at)
        )}">${escapeHtml(haceCuanto(t.created_at))}</span></p>
      </div>
      <div class="foro-fila-numeros">
        <span><small>Respuestas</small><strong>${Math.max(0, (t.post_count || 1) - 1)}</strong></span>
        <span><small>Visitas</small><strong>${t.view_count || 0}</strong></span>
      </div>
      ${ultimoHtml({ titulo: 'Ir al último', url: urlTema(t.id), fecha: t.last_post_at, perfil: null })}
    </div>`

  const subforosHtml = (subforos || []).length
    ? `<section class="foro-seccion">
         <h2 class="foro-seccion-titulo">Subforos</h2>
         ${(subforos || [])
           .map(
             (s) => `
         <div class="foro-fila">
           <div class="foro-fila-icono" aria-hidden="true">${icons.messageSquare(22)}</div>
           <div class="foro-fila-cuerpo">
             <h3><a href="${urlForo(s.slug)}">${escapeHtml(s.name)}</a></h3>
             ${s.description ? `<p class="subtext">${escapeHtml(s.description)}</p>` : ''}
           </div>
           <div class="foro-fila-numeros">
             <span><small>Temas</small><strong>${s.thread_count || 0}</strong></span>
             <span><small>Mensajes</small><strong>${s.post_count || 0}</strong></span>
           </div>
         </div>`
           )
           .join('')}
       </section>`
    : ''

  principal.innerHTML = `
    ${subforosHtml}
    <div id="formularioTema"></div>
    <section class="foro-seccion" id="foroTemas">
      ${
        lista.length === 0
          ? `<p class="empty-state">Aquí no hay ningún tema todavía. Si tienes una duda o algo que enseñar, ábrelo tú — alguien lo leerá.</p>`
          : lista.map(filaTema).join('')
      }
    </section>
    ${paginacionHtml(totalPaginas)}`

  document.querySelectorAll('[data-pagina]').forEach((b) =>
    b.addEventListener('click', () => {
      const url = new URL(window.location.href)
      url.searchParams.set('p', b.dataset.pagina)
      window.location.href = url.toString()
    })
  )
}

function paginacionHtml(total) {
  if (total <= 1) return ''
  const botones = []
  for (let i = 1; i <= total; i++) {
    botones.push(
      `<button type="button" class="page-btn ${i === paginaActual ? 'active' : ''}" data-pagina="${i}">${i}</button>`
    )
  }
  return `<div class="pagination">${botones.join('')}</div>`
}

// ─────────────────────────────────────────────────────────────
// Abrir un tema
// ─────────────────────────────────────────────────────────────
//
// El formulario se carga a demanda: el editor con formato son dos módulos
// y una hoja de estilos, y la inmensa mayoría de quien entra en un foro
// viene a leer, no a escribir.
async function abrirFormularioTema(foro) {
  if (!sesion) {
    showToast('Entra con tu cuenta para abrir un tema.')
    return
  }
  const hueco = document.getElementById('formularioTema')
  if (hueco.dataset.abierto === '1') {
    hueco.innerHTML = ''
    hueco.dataset.abierto = ''
    return
  }
  hueco.dataset.abierto = '1'

  const [{ richTextToolbarHtml, initRichTextEditor }, { sanitizeRichText }] = await Promise.all([
    import('./richtext-editor.js'),
    import('./richtext-format.js'),
  ])
  const { uploadGuideImage } = await import('./app.js')

  hueco.innerHTML = `
    <form class="simple-card foro-form" id="temaForm">
      <h3>Abrir un tema en ${escapeHtml(foro.name)}</h3>
      <div class="foro-form-fila">
        <select id="temaEtiqueta" aria-label="Etiqueta">
          <option value="">Sin etiqueta</option>
          <option value="Duda">Duda</option>
          <option value="Ayuda">Ayuda</option>
          <option value="Debate">Debate</option>
          <option value="Muestra">Muestra</option>
        </select>
        <!-- Sin el atributo required a propósito: la validación la hace
             el submit con un aviso del sitio. El globo del navegador se
             sale del estilo de todo lo demás. -->
        <input type="text" id="temaTitulo" maxlength="140" placeholder="El título, claro y concreto" />
      </div>
      <div class="rte-wrap">
        <div id="temaBarra"></div>
        <div class="rte-surface" id="temaCuerpo"></div>
      </div>
      <div class="foro-form-acciones">
        <button type="submit" class="btn-primary" id="btnPublicarTema">Publicar</button>
        <button type="button" class="btn-secondary" id="btnCancelarTema">Cancelar</button>
      </div>
    </form>`

  const barra = document.getElementById('temaBarra')
  barra.innerHTML = richTextToolbarHtml()
  let cuerpoHtml = ''
  initRichTextEditor({
    toolbarEl: barra,
    surfaceEl: document.getElementById('temaCuerpo'),
    initialHtml: '',
    onChange: (html) => {
      cuerpoHtml = html
    },
    uploadImage: (file) => uploadGuideImage(sesion.user.id, file),
  })

  document.getElementById('btnCancelarTema').addEventListener('click', () => {
    hueco.innerHTML = ''
    hueco.dataset.abierto = ''
  })

  let enviando = false
  document.getElementById('temaForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (enviando) return

    const titulo = document.getElementById('temaTitulo').value.trim()
    const cuerpo = sanitizeRichText(cuerpoHtml || document.getElementById('temaCuerpo').innerHTML)
    if (!titulo) {
      showToast('Ponle un título al tema.')
      return
    }
    if (cuerpo.replace(/<[^>]*>/g, '').trim().length < 10) {
      showToast('Escribe algo en el mensaje, aunque sea corto.')
      return
    }

    enviando = true
    const boton = document.getElementById('btnPublicarTema')
    boton.disabled = true

    // El tema y su primer mensaje son dos filas. Si la segunda falla, el
    // tema se queda vacío y sin sentido, así que se retira.
    const { data: tema, error } = await supabase
      .from('forum_threads')
      .insert({
        board_id: foro.id,
        author_id: sesion.user.id,
        title: titulo,
        prefix: document.getElementById('temaEtiqueta').value || null,
      })
      .select('id')
      .single()

    if (error || !tema) {
      enviando = false
      boton.disabled = false
      showToast('No se ha podido abrir el tema: ' + (error?.message || 'inténtalo otra vez'))
      return
    }

    const { error: errorMensaje } = await supabase.from('forum_posts').insert({
      thread_id: tema.id,
      author_id: sesion.user.id,
      body_html: cuerpo,
    })

    if (errorMensaje) {
      await supabase.from('forum_threads').delete().eq('id', tema.id)
      enviando = false
      boton.disabled = false
      showToast('No se ha podido publicar: ' + errorMensaje.message)
      return
    }

    window.location.href = urlTema(tema.id)
  })
}

// ─────────────────────────────────────────────────────────────
async function init() {
  sesion = await getSession()
  if (sesion) soyStaff = await esDelEquipo(sesion)
  if (slugForo) await pintarForo()
  else await pintarIndice()
}

init().catch(() => {
  principal.innerHTML = `<p class="empty-state">No se ha podido cargar el foro.</p>`
})
