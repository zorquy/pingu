import { supabase } from './supabase.js'
import { getSession, escapeHtml } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { sanitizeRichText } from './richtext-format.js'
import { createNotification } from './notifications.js'
import {
  haceCuanto,
  fechaLarga,
  nombreDe,
  perfilesPorId,
  avatarHtml,
  enlacePerfil,
  etiquetaHtml,
  contributorCounts,
  badgeHtml,
  urlForo,
  urlTema,
  faltaElForo,
} from './foro-comun.js'
import { calculateLevel } from './gamification.js'

// Un tema del foro.
//
// La disposición es la clásica: columna del autor a la izquierda (avatar,
// nombre, título y chapas) y el mensaje a la derecha, con su número, su
// fecha y sus acciones. No se ha inventado nada aquí a propósito: es la
// forma que cualquiera que haya pisado un foro sabe leer sin pensar, y en
// la que se ve de un golpe QUIÉN dice las cosas — que en un foro importa
// tanto como lo que dicen.

const PAGINA = 20

const params = new URLSearchParams(window.location.search)
const temaId = params.get('t')
const paginaPedida = Math.max(1, Number(params.get('p') || 1))

const elMigas = document.getElementById('temaMigas')
const elCabecera = document.getElementById('temaCabecera')
const elMensajes = document.getElementById('temaMensajes')
const elPaginacion = document.getElementById('temaPaginacion')
const elResponder = document.getElementById('temaResponder')

let sesion = null
let soyAdmin = false
let tema = null
let foro = null
let pagina = paginaPedida

// ─────────────────────────────────────────────────────────────
function migasHtml(trozos) {
  return trozos
    .map((t, i) =>
      i === trozos.length - 1
        ? `<span aria-current="page">${escapeHtml(t.texto)}</span>`
        : `<a href="${t.url}">${escapeHtml(t.texto)}</a>`
    )
    .join('<span class="foro-migas-sep" aria-hidden="true">›</span>')
}

// El título de debajo del nombre. Es el rango de colaborador si lo tiene
// (que se gana escribiendo guías) y, si no, el nivel — para que nadie se
// quede sin nada debajo del nombre, que queda desangelado.
function tituloDe(perfil, guiasAprobadas) {
  if (guiasAprobadas > 0) return badgeHtml(guiasAprobadas)
  const nivel = perfil?.level || calculateLevel(perfil?.total_xp || 0)
  return `<span class="foro-autor-titulo">${escapeHtml(nivel)}</span>`
}

function chapasDe(perfil, esAutorDelTema) {
  const chapas = []
  if (perfil?.is_admin) chapas.push('<span class="foro-chapa foro-chapa-equipo">Miembro del equipo</span>')
  if (esAutorDelTema) chapas.push('<span class="foro-chapa">Abrió el tema</span>')
  return chapas.join('')
}

// ─────────────────────────────────────────────────────────────
async function cargar() {
  const { data, error } = await supabase.from('forum_threads').select('*').eq('id', temaId).maybeSingle()
  if (faltaElForo(error)) {
    elMensajes.innerHTML = `<p class="empty-state">El foro todavía no está activado.</p>`
    return false
  }
  if (!data) {
    elMensajes.innerHTML = `<p class="empty-state">Este tema no existe o lo han retirado.</p>`
    elMigas.innerHTML = migasHtml([{ texto: 'Foro', url: '/foro.html' }, { texto: 'No encontrado' }])
    return false
  }
  tema = data

  const { data: b } = await supabase.from('forum_boards').select('*').eq('id', tema.board_id).maybeSingle()
  foro = b
  const { data: seccion } = foro
    ? await supabase.from('forum_sections').select('name').eq('id', foro.section_id).maybeSingle()
    : { data: null }

  document.title = `${tema.title} — Foro de PokeDoc`
  elMigas.innerHTML = migasHtml(
    [
      { texto: 'Inicio', url: '/index.html' },
      { texto: 'Foro', url: '/foro.html' },
      seccion ? { texto: seccion.name, url: '/foro.html' } : null,
      foro ? { texto: foro.name, url: urlForo(foro.slug) } : null,
      { texto: tema.title },
    ].filter(Boolean)
  )
  return true
}

function pintarCabecera(perfilAutor) {
  elCabecera.innerHTML = `
    <h1>
      ${tema.is_pinned ? '<span class="foro-chapa">Fijado</span>' : ''}
      ${tema.is_locked ? '<span class="foro-chapa foro-chapa-cerrado">Cerrado</span>' : ''}
      ${etiquetaHtml(tema.prefix)}
      ${escapeHtml(tema.title)}
    </h1>
    <p class="subtext tema-firma">
      ${avatarHtml(perfilAutor, 20)} ${enlacePerfil(perfilAutor)}
      · <span title="${escapeHtml(fechaLarga(tema.created_at))}">${escapeHtml(haceCuanto(tema.created_at))}</span>
      · ${icons.eye(13)} ${tema.view_count || 0}
    </p>
    ${soyAdmin ? panelModeracionHtml() : ''}`

  if (soyAdmin) {
    document.getElementById('btnFijar')?.addEventListener('click', () => moderar({ is_pinned: !tema.is_pinned }))
    document.getElementById('btnCerrar')?.addEventListener('click', () => moderar({ is_locked: !tema.is_locked }))
  }
}

function panelModeracionHtml() {
  return `
    <div class="tema-moderacion">
      <button type="button" class="btn-secondary" id="btnFijar">${icons.pin(13)} ${tema.is_pinned ? 'Quitar de arriba' : 'Fijar arriba'}</button>
      <button type="button" class="btn-secondary" id="btnCerrar">${icons.lock(13)} ${tema.is_locked ? 'Reabrir' : 'Cerrar'}</button>
    </div>`
}

async function moderar(cambios) {
  const { error } = await supabase.from('forum_threads').update(cambios).eq('id', tema.id)
  if (error) {
    showToast('No se ha podido: ' + error.message)
    return
  }
  Object.assign(tema, cambios)
  window.location.reload()
}

// ─────────────────────────────────────────────────────────────
async function pintarMensajes() {
  const totalPaginas = Math.max(1, Math.ceil((tema.post_count || 1) / PAGINA))
  pagina = Math.min(Math.max(1, pagina), totalPaginas)
  const desde = (pagina - 1) * PAGINA

  const { data: mensajes } = await supabase
    .from('forum_posts')
    .select('*')
    .eq('thread_id', tema.id)
    .order('created_at', { ascending: true })
    .range(desde, desde + PAGINA - 1)

  const lista = mensajes || []
  const citados = [...new Set(lista.map((m) => m.reply_to_id).filter(Boolean))]
  const [perfiles, cuentas, { data: citadosData }, { data: megustas }] = await Promise.all([
    perfilesPorId([...lista.map((m) => m.author_id), tema.author_id]),
    contributorCounts(lista.map((m) => m.author_id)),
    citados.length
      ? supabase.from('forum_posts').select('id, author_id, body_html').in('id', citados)
      : Promise.resolve({ data: [] }),
    lista.length
      ? supabase.from('forum_post_likes').select('post_id, user_id').in('post_id', lista.map((m) => m.id))
      : Promise.resolve({ data: [] }),
  ])

  // Los perfiles de quien administra: hace falta saberlo para la chapa de
  // "Miembro del equipo".
  const { data: admins } = await supabase
    .from('user_profiles')
    .select('id, is_admin')
    .in('id', [...new Set(lista.map((m) => m.author_id).filter(Boolean))])
  for (const a of admins || []) if (perfiles[a.id]) perfiles[a.id].is_admin = a.is_admin

  const citadoPorId = Object.fromEntries((citadosData || []).map((c) => [c.id, c]))
  const likesPorMensaje = {}
  for (const l of megustas || []) (likesPorMensaje[l.post_id] ||= []).push(l.user_id)

  elMensajes.innerHTML = lista
    .map((m, i) => mensajeHtml(m, desde + i + 1, perfiles, cuentas, citadoPorId, likesPorMensaje[m.id] || []))
    .join('')

  elPaginacion.innerHTML = paginacionHtml(totalPaginas)
  elPaginacion.querySelectorAll('[data-pagina]').forEach((b) =>
    b.addEventListener('click', () => {
      pagina = Number(b.dataset.pagina)
      const url = new URL(window.location.href)
      url.searchParams.set('p', String(pagina))
      window.history.replaceState({}, '', url)
      pintarMensajes()
    })
  )

  enganchar(perfiles)
  pintarCabecera(perfiles[tema.author_id])
  wireReportButtons(elMensajes, sesion)
}

function mensajeHtml(m, numero, perfiles, cuentas, citadoPorId, likes) {
  const perfil = perfiles[m.author_id]
  const nombre = nombreDe(perfil)
  const citado = m.reply_to_id ? citadoPorId[m.reply_to_id] : null
  const meGusta = sesion ? likes.includes(sesion.user.id) : false
  const esMio = sesion && m.author_id === sesion.user.id

  return `
  <article class="foro-mensaje" id="mensaje-${m.id}" data-mensaje="${m.id}" data-autor="${escapeHtml(m.author_id || '')}">
    <div class="foro-mensaje-autor">
      ${avatarHtml(perfil, 76)}
      <div class="foro-autor-nombre">${enlacePerfil(perfil)}</div>
      ${tituloDe(perfil, cuentas[m.author_id] || 0)}
      ${chapasDe(perfil, m.author_id && m.author_id === tema.author_id)}
    </div>
    <div class="foro-mensaje-cuerpo">
      <header class="foro-mensaje-cabecera">
        <span class="subtext" title="${escapeHtml(fechaLarga(m.created_at))}">${escapeHtml(haceCuanto(m.created_at))}${
          m.edited_at ? ' · editado' : ''
        }</span>
        <a class="foro-mensaje-num" href="#mensaje-${m.id}" title="Enlace a este mensaje">#${numero}</a>
      </header>
      ${
        citado
          ? `<blockquote class="foro-cita">
               <span class="foro-cita-quien">${escapeHtml(nombreDe(perfiles[citado.author_id]))} escribió:</span>
               <div class="article-body">${sanitizeRichText(recortar(citado.body_html))}</div>
             </blockquote>`
          : ''
      }
      <div class="article-body foro-mensaje-texto">${sanitizeRichText(m.body_html || '')}</div>
      <footer class="foro-mensaje-pie">
        <div class="foro-mensaje-izq">
          ${reportButtonHtml('forum_post', m.id)}
          ${esMio || soyAdmin ? `<button type="button" class="link-btn" data-borrar="${m.id}">${icons.trash(13)} Borrar</button>` : ''}
        </div>
        <div class="foro-mensaje-der">
          <button type="button" class="foro-accion ${meGusta ? 'foro-accion-on' : ''}" data-megusta="${m.id}"
                  aria-pressed="${meGusta}">${icons.thumbsUp(14, meGusta)} Me gusta${likes.length ? ` · ${likes.length}` : ''}</button>
          <button type="button" class="foro-accion" data-citar="${m.id}">${icons.quote(14)} Citar</button>
        </div>
      </footer>
      ${
        likes.length
          ? `<div class="foro-megustas">${icons.thumbsUp(12, true)} Le gusta a ${likes.length} ${
              likes.length === 1 ? 'persona' : 'personas'
            }</div>`
          : ''
      }
    </div>
  </article>`
}

// La cita enseña un trozo, no el mensaje entero: citar un mensaje largo
// completo llena la página de repeticiones.
function recortar(html) {
  const texto = String(html || '')
  return texto.length > 600 ? texto.slice(0, 600) + '…' : texto
}

function paginacionHtml(total) {
  if (total <= 1) return ''
  let botones = ''
  for (let i = 1; i <= total; i++) {
    botones += `<button type="button" class="page-btn ${i === pagina ? 'active' : ''}" data-pagina="${i}">${i}</button>`
  }
  return `<div class="pagination">${botones}</div>`
}

// ─────────────────────────────────────────────────────────────
let citandoA = null

function enganchar(perfiles) {
  elMensajes.querySelectorAll('[data-megusta]').forEach((b) =>
    b.addEventListener('click', () => alternarMeGusta(b.dataset.megusta, b))
  )
  elMensajes.querySelectorAll('[data-citar]').forEach((b) =>
    b.addEventListener('click', () => {
      citandoA = b.dataset.citar
      const autorId = elMensajes.querySelector(`[data-mensaje="${citandoA}"]`)?.dataset.autor
      pintarAvisoDeCita(perfiles[autorId])
      document.getElementById('respuestaCuerpo')?.focus()
      document.getElementById('temaResponder')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  )
  elMensajes.querySelectorAll('[data-borrar]').forEach((b) =>
    b.addEventListener('click', () => borrarMensaje(b.dataset.borrar))
  )
}

function pintarAvisoDeCita(perfil) {
  const aviso = document.getElementById('respondiendoA')
  if (!aviso) return
  aviso.classList.toggle('hidden', !citandoA)
  const quien = aviso.querySelector('[data-quien]')
  if (quien) quien.textContent = perfil ? nombreDe(perfil) : 'un mensaje'
}

async function alternarMeGusta(postId, boton) {
  if (!sesion) {
    showToast('Entra con tu cuenta para dar las gracias por un mensaje.')
    return
  }
  const activo = boton.getAttribute('aria-pressed') === 'true'
  const { error } = activo
    ? await supabase.from('forum_post_likes').delete().eq('post_id', postId).eq('user_id', sesion.user.id)
    : await supabase.from('forum_post_likes').insert({ post_id: postId, user_id: sesion.user.id })

  if (error) {
    showToast(activo ? 'No se ha podido quitar.' : 'No se ha podido dar: ' + error.message)
    return
  }
  await pintarMensajes()
}

async function borrarMensaje(postId) {
  if (!confirm('¿Borrar este mensaje?')) return
  const { error } = await supabase.from('forum_posts').delete().eq('id', postId)
  if (error) {
    showToast('No se ha podido borrar: ' + error.message)
    return
  }
  const { data } = await supabase.from('forum_threads').select('post_count').eq('id', tema.id).maybeSingle()
  if (data) tema.post_count = data.post_count
  await pintarMensajes()
}

// ─────────────────────────────────────────────────────────────
// Responder
// ─────────────────────────────────────────────────────────────
async function montarRespuesta() {
  if (tema.is_locked && !soyAdmin) {
    elResponder.innerHTML = `<p class="empty-state">${icons.lock(14)} Este tema está cerrado. Ya no se puede responder.</p>`
    return
  }
  if (!sesion) {
    elResponder.innerHTML = `<p class="empty-state"><a href="/auth.html">Entra con tu cuenta</a> para responder.</p>`
    return
  }

  const [{ richTextToolbarHtml, initRichTextEditor }, { uploadGuideImage }] = await Promise.all([
    import('./richtext-editor.js'),
    import('./app.js'),
  ])

  elResponder.innerHTML = `
    <form class="simple-card foro-form" id="respuestaForm">
      <p class="foro-respondiendo hidden" id="respondiendoA">
        ${icons.quote(13)} Citando a <strong data-quien>un mensaje</strong>.
        <button type="button" class="link-btn" id="btnQuitarCita">Quitar la cita</button>
      </p>
      <div class="rte-wrap">
        <div id="respuestaBarra"></div>
        <div class="rte-surface" id="respuestaCuerpo"></div>
      </div>
      <div class="foro-form-acciones">
        <button type="submit" class="btn-primary" id="btnResponder">${icons.send(14)} Responder</button>
      </div>
    </form>`

  const barra = document.getElementById('respuestaBarra')
  barra.innerHTML = richTextToolbarHtml()
  let cuerpoHtml = ''
  initRichTextEditor({
    toolbarEl: barra,
    surfaceEl: document.getElementById('respuestaCuerpo'),
    initialHtml: '',
    onChange: (html) => {
      cuerpoHtml = html
    },
    uploadImage: (file) => uploadGuideImage(sesion.user.id, file),
  })

  document.getElementById('btnQuitarCita').addEventListener('click', () => {
    citandoA = null
    pintarAvisoDeCita()
  })

  let enviando = false
  document.getElementById('respuestaForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (enviando) return
    const cuerpo = sanitizeRichText(cuerpoHtml || document.getElementById('respuestaCuerpo').innerHTML)
    if (cuerpo.replace(/<[^>]*>/g, '').trim().length < 2) {
      showToast('Escribe algo antes de enviar.')
      return
    }

    enviando = true
    const boton = document.getElementById('btnResponder')
    boton.disabled = true

    const { error } = await supabase.from('forum_posts').insert({
      thread_id: tema.id,
      author_id: sesion.user.id,
      body_html: cuerpo,
      reply_to_id: citandoA,
    })

    enviando = false
    boton.disabled = false
    if (error) {
      showToast('No se ha podido publicar: ' + error.message)
      return
    }

    await avisar()
    citandoA = null
    document.getElementById('respuestaCuerpo').innerHTML = '<p><br></p>'
    cuerpoHtml = ''
    pintarAvisoDeCita()

    const { data } = await supabase.from('forum_threads').select('post_count').eq('id', tema.id).maybeSingle()
    if (data) tema.post_count = data.post_count
    pagina = Math.max(1, Math.ceil((tema.post_count || 1) / PAGINA))
    await pintarMensajes()
    showToast('Publicado.', 'success')
  })
}

// A quien abrió el tema se le avisa de que le han contestado, y a quien se
// cita, de que le han citado. Si son la misma persona, un aviso y no dos.
async function avisar() {
  const destinatarios = new Set()
  if (tema.author_id && tema.author_id !== sesion.user.id) destinatarios.add(tema.author_id)
  if (citandoA) {
    const { data } = await supabase.from('forum_posts').select('author_id').eq('id', citandoA).maybeSingle()
    if (data?.author_id && data.author_id !== sesion.user.id) destinatarios.add(data.author_id)
  }
  await Promise.all(
    [...destinatarios].map((uid) =>
      createNotification({
        recipientId: uid,
        actorId: sesion.user.id,
        type: 'forum_reply',
        title: 'Te han respondido en el foro',
        body: tema.title,
        link: urlTema(tema.id),
      })
    )
  )
}

// ─────────────────────────────────────────────────────────────
async function init() {
  if (!temaId) {
    elMensajes.innerHTML = `<p class="empty-state">No se ha dicho qué tema abrir.</p>`
    return
  }
  sesion = await getSession()
  if (sesion) {
    const { data } = await supabase.from('user_profiles').select('is_admin').eq('id', sesion.user.id).maybeSingle()
    soyAdmin = !!data?.is_admin
  }

  if (!(await cargar())) return

  await pintarMensajes()
  await montarRespuesta()

  // La visita se suma después de pintar: que se vea el tema no puede
  // depender de que el contador funcione.
  supabase.rpc('forum_ver_tema', { p_thread: tema.id }).then(
    () => {},
    () => {}
  )
}

init().catch(() => {
  elMensajes.innerHTML = `<p class="empty-state">No se ha podido cargar el tema.</p>`
})
