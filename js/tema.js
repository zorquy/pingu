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
  temaDeLaRuta,
  esDelEquipo,
  faltaElForo,
} from './foro-comun.js'
import { calculateLevel } from './gamification.js'
import { marcarLeido, estaSuscrito, suscribir, desuscribir, avisarSuscritos } from './foro-lecturas.js'
import { perfilesMencionados, enlazarMenciones, porNombre } from './menciones.js'
import { engancharAutocompletarMenciones } from './mencion-autocompletar.js'

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
const temaId = temaDeLaRuta()
const paginaPedida = Math.max(1, Number(params.get('p') || 1))

const elMigas = document.getElementById('temaMigas')
const elCabecera = document.getElementById('temaCabecera')
const elMensajes = document.getElementById('temaMensajes')
const elPaginacion = document.getElementById('temaPaginacion')
const elResponder = document.getElementById('temaResponder')

let sesion = null
let soyStaff = false
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

// El título de debajo del nombre, por orden de mando:
//
//   1. El que le haya puesto un admin a mano (forum_title). Manda sobre
//      todo lo demás: si alguien es "Perito de falsificaciones", eso es
//      lo que se lee, no su nivel.
//   2. El rango de colaborador, que se gana escribiendo guías.
//   3. El nivel, para que nadie se quede sin nada debajo del nombre.
function tituloDe(perfil, guiasAprobadas) {
  if (perfil?.forum_title) {
    return `<span class="foro-autor-titulo foro-autor-titulo-propio">${escapeHtml(perfil.forum_title)}</span>`
  }
  if (guiasAprobadas > 0) return badgeHtml(guiasAprobadas)
  const nivel = perfil?.level || calculateLevel(perfil?.total_xp || 0)
  return `<span class="foro-autor-titulo">${escapeHtml(nivel)}</span>`
}

function chapasDe(perfil, esAutorDelTema) {
  const chapas = []
  if (perfil?.is_admin) chapas.push('<span class="foro-chapa foro-chapa-equipo">Miembro del equipo</span>')
  else if (perfil?.is_moderator) chapas.push('<span class="foro-chapa foro-chapa-equipo">Moderación</span>')
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
      ${sesion ? '<button type="button" class="tema-seguir" id="btnSeguirTema" aria-pressed="false">…</button>' : ''}
    </p>
    ${soyStaff ? panelModeracionHtml() : ''}`

  if (sesion) engancharSeguir()
  if (soyStaff) {
    document.getElementById('btnFijar')?.addEventListener('click', () => moderar({ is_pinned: !tema.is_pinned }))
    document.getElementById('btnCerrar')?.addEventListener('click', () => moderar({ is_locked: !tema.is_locked }))
  }
}

// Seguir un tema: te avisan cuando alguien responde.
//
// Quien escribe queda suscrito solo (lo hace un disparador en la base),
// así que este botón sirve sobre todo para dos cosas: seguir un tema en
// el que aún no has hablado, y dejar de seguir uno que se te ha ido de
// las manos.
async function engancharSeguir() {
  const boton = document.getElementById('btnSeguirTema')
  if (!boton) return

  let siguiendo = await estaSuscrito(sesion.user.id, tema.id)
  const pintar = () => {
    boton.innerHTML = siguiendo
      ? `${icons.bell(13)} Siguiendo`
      : `${icons.bell(13)} Seguir`
    boton.classList.toggle('tema-seguir-si', siguiendo)
    boton.setAttribute('aria-pressed', String(siguiendo))
    boton.title = siguiendo
      ? 'Te avisamos cuando alguien responda. Pulsa para dejar de seguirlo.'
      : 'Te avisaremos cuando alguien responda.'
  }
  pintar()

  boton.addEventListener('click', async () => {
    boton.disabled = true
    // Se pinta el cambio antes de que responda la base: si falla, se
    // vuelve atrás. Un botón que tarda medio segundo en reaccionar se
    // pulsa dos veces.
    const antes = siguiendo
    siguiendo = !siguiendo
    pintar()
    const ok = antes
      ? await desuscribir(sesion.user.id, tema.id)
      : await suscribir(sesion.user.id, tema.id)
    if (!ok) {
      siguiendo = antes
      pintar()
      showToast('No se ha podido cambiar. Puede que falte la migración del foro.')
    }
    boton.disabled = false
  })
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
  // Los @nombre de esta página, resueltos de una sola consulta: se pega
  // todo el HTML y se buscan los mencionados que existen de verdad.
  const mencionados = porNombre(await perfilesMencionados(lista.map((m) => m.body_html || '').join(' ')))
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

  // Quién es del equipo y qué título le han puesto: hace falta para la
  // columna del autor. Si la migración de títulos todavía no está puesta,
  // la consulta falla y se sigue sin ellos — el foro no depende de esto.
  const autores = [...new Set(lista.map((m) => m.author_id).filter(Boolean))]
  if (autores.length) {
    const { data: extra } = await supabase
      .from('user_profiles')
      .select('id, is_admin, is_moderator, forum_title')
      .in('id', autores)
    for (const a of extra || []) if (perfiles[a.id]) Object.assign(perfiles[a.id], a)
  }

  const citadoPorId = Object.fromEntries((citadosData || []).map((c) => [c.id, c]))
  const likesPorMensaje = {}
  for (const l of megustas || []) (likesPorMensaje[l.post_id] ||= []).push(l.user_id)

  elMensajes.innerHTML = lista
    .map((m, i) => mensajeHtml(m, desde + i + 1, perfiles, cuentas, citadoPorId, likesPorMensaje[m.id] || [], mencionados))
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

function mensajeHtml(m, numero, perfiles, cuentas, citadoPorId, likes, mencionados) {
  const perfil = perfiles[m.author_id]
  const nombre = nombreDe(perfil)
  const citado = m.reply_to_id ? citadoPorId[m.reply_to_id] : null
  const meGusta = sesion ? likes.includes(sesion.user.id) : false
  const esMio = sesion && m.author_id === sesion.user.id

  return `
  <article class="foro-mensaje" id="mensaje-${m.id}" data-mensaje="${m.id}" data-autor="${escapeHtml(m.author_id || '')}">
    <div class="foro-mensaje-autor">
      ${avatarHtml(perfil, 56)}
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
      <div class="article-body foro-mensaje-texto" data-texto="${m.id}">${enlazarMenciones(
        sanitizeRichText(m.body_html || ''),
        mencionados
      )}</div>
      <footer class="foro-mensaje-pie">
        <div class="foro-mensaje-izq">
          ${reportButtonHtml('forum_post', m.id)}
          ${esMio || soyStaff ? `<button type="button" class="link-btn" data-editar="${m.id}">${icons.edit(13)} Editar</button>` : ''}
          ${esMio || soyStaff ? `<button type="button" class="link-btn" data-borrar="${m.id}">${icons.trash(13)} Borrar</button>` : ''}
        </div>
        <div class="foro-mensaje-der">
          ${
            // En tu propio mensaje no hay "Me gusta": la base lo prohíbe
            // (aplaudirse solo no es una señal de nada), y enseñar un
            // botón que siempre va a dar error es peor que no enseñarlo.
            esMio
              ? ''
              : `<button type="button" class="foro-accion ${meGusta ? 'foro-accion-on' : ''}" data-megusta="${m.id}"
                  aria-pressed="${meGusta}">${icons.thumbsUp(14, meGusta)} Me gusta${likes.length ? ` · ${likes.length}` : ''}</button>`
          }
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
  elMensajes.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => editarMensaje(b.dataset.editar))
  )
}

// ─────────────────────────────────────────────────────────────
// Editar un mensaje ya publicado
// ─────────────────────────────────────────────────────────────
//
// Se edita EN SU SITIO, con el mismo editor de siempre, en vez de en una
// ventana aparte: así se ve el mensaje rodeado de la conversación a la que
// contesta, que es justo lo que hace falta para corregirlo bien.
//
// El editor se carga a demanda: la mayoría de quien lee un tema no va a
// editar nada.
async function editarMensaje(postId) {
  const caja = elMensajes.querySelector(`[data-texto="${postId}"]`)
  if (!caja || caja.dataset.editando === '1') return
  caja.dataset.editando = '1'

  const { data: mensaje } = await supabase.from('forum_posts').select('body_html').eq('id', postId).maybeSingle()
  const original = mensaje?.body_html || ''

  const [{ richTextToolbarHtml, initRichTextEditor }, { uploadGuideImage }] = await Promise.all([
    import('./richtext-editor.js'),
    import('./app.js'),
  ])

  const antes = caja.innerHTML
  caja.innerHTML = `
    <div class="rte-wrap rte-compacta">
      <div class="rte-toolbar" id="editarBarra-${postId}"></div>
      <div class="rte-surface" id="editarCuerpo-${postId}"></div>
    </div>
    <div class="foro-form-acciones">
      <button type="button" class="btn-primary" data-guardar-edicion="${postId}">Guardar</button>
      <button type="button" class="btn-secondary" data-cancelar-edicion="${postId}">Cancelar</button>
    </div>`

  const barra = document.getElementById(`editarBarra-${postId}`)
  barra.innerHTML = richTextToolbarHtml()
  const superficieEdicion = document.getElementById(`editarCuerpo-${postId}`)
  let html = original
  initRichTextEditor({
    toolbarEl: barra,
    surfaceEl: superficieEdicion,
    initialHtml: original,
    onChange: (nuevo) => {
      html = nuevo
    },
    uploadImage: (file) => uploadGuideImage(sesion.user.id, file),
  })
  engancharAutocompletarMenciones(superficieEdicion)

  const cerrar = () => {
    caja.dataset.editando = ''
    caja.innerHTML = antes
  }
  caja.querySelector('[data-cancelar-edicion]').addEventListener('click', cerrar)

  caja.querySelector('[data-guardar-edicion]').addEventListener('click', async (e) => {
    const limpio = sanitizeRichText(html || document.getElementById(`editarCuerpo-${postId}`).innerHTML)
    if (limpio.replace(/<[^>]*>/g, '').trim().length < 2) {
      showToast('El mensaje no puede quedarse vacío. Si querías quitarlo, bórralo.')
      return
    }
    e.target.disabled = true
    // `edited_at` lo pone un disparador de la base, no esto: si dependiera
    // del navegador, bastaría con no mandarlo para editar a escondidas.
    const { error } = await supabase.from('forum_posts').update({ body_html: limpio }).eq('id', postId)
    e.target.disabled = false
    if (error) {
      showToast('No se ha podido guardar: ' + error.message)
      return
    }
    caja.dataset.editando = ''
    await pintarMensajes()
    showToast('Guardado.', 'success')
  })
}

// `nombre` es para cuando se cita desde la selección: ahí no hay perfil
// cargado a mano, pero el nombre está escrito en el propio mensaje.
function pintarAvisoDeCita(perfil, nombre) {
  const aviso = document.getElementById('respondiendoA')
  if (!aviso) return
  aviso.classList.toggle('hidden', !citandoA)
  const quien = aviso.querySelector('[data-quien]')
  if (quien) quien.textContent = nombre || (perfil ? nombreDe(perfil) : 'un mensaje')
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
    // El caso típico es el mensaje propio, que la base no deja. No se
    // enseña el error de PostgreSQL en crudo: se dice lo que pasa.
    const propio = /row-level security/i.test(error.message || '')
    showToast(
      propio
        ? 'No puedes darle a tu propio mensaje.'
        : (activo ? 'No se ha podido quitar: ' : 'No se ha podido dar: ') + error.message
    )
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
  if (tema.is_locked && !soyStaff) {
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
      <div class="rte-wrap rte-compacta">
        <div class="rte-toolbar" id="respuestaBarra"></div>
        <div class="rte-surface" id="respuestaCuerpo"></div>
      </div>
      <div class="foro-previa hidden" id="respuestaPrevia">
        <span class="foro-previa-eti">Así se va a ver</span>
        <div class="article-body foro-mensaje-texto" id="respuestaPreviaCuerpo"></div>
      </div>
      <div class="foro-form-acciones">
        <button type="submit" class="btn-primary" id="btnResponder">${icons.send(14)} Responder</button>
        <button type="button" class="btn-secondary" id="btnVistaPrevia">${icons.eye(14)} Vista previa</button>
      </div>
    </form>`

  const barra = document.getElementById('respuestaBarra')
  barra.innerHTML = richTextToolbarHtml()
  const superficie = document.getElementById('respuestaCuerpo')
  let cuerpoHtml = borradoSalvado.leer()
  initRichTextEditor({
    toolbarEl: barra,
    surfaceEl: superficie,
    initialHtml: cuerpoHtml,
    placeholder: 'Escribe tu respuesta…',
    onChange: (html) => {
      cuerpoHtml = html
      borradoSalvado.guardar(html)
      if (vistaPreviaAbierta) pintarVistaPrevia(html)
    },
    uploadImage: (file) => uploadGuideImage(sesion.user.id, file),
  })
  engancharAutocompletarMenciones(superficie)
  if (cuerpoHtml) showToast('Hemos recuperado lo que estabas escribiendo.')

  // Vista previa: el mismo saneador y las mismas clases que un mensaje
  // publicado, para que lo que se ve aquí sea lo que se va a ver ahí.
  document.getElementById('btnVistaPrevia').addEventListener('click', () => {
    vistaPreviaAbierta = !vistaPreviaAbierta
    const caja = document.getElementById('respuestaPrevia')
    caja.classList.toggle('hidden', !vistaPreviaAbierta)
    document.getElementById('btnVistaPrevia').classList.toggle('activo', vistaPreviaAbierta)
    if (vistaPreviaAbierta) pintarVistaPrevia(cuerpoHtml || superficie.innerHTML)
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

    await avisar(cuerpo)
    citandoA = null
    borradoSalvado.borrar()
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

// ─────────────────────────────────────────────────────────────
// La caja de responder: borrador, vista previa y citar la selección
// ─────────────────────────────────────────────────────────────

let vistaPreviaAbierta = false

// La previa enseña TAMBIÉN las menciones ya enlazadas. Sin eso prometía
// una cosa y hacía otra: era el único sitio donde comprobar si has
// escrito bien un @nombre antes de publicarlo, y ahí salía en texto
// plano tanto si existía esa persona como si no.
//
// La consulta de los perfiles va detrás, así que la previa se pinta dos
// veces: primero el texto (inmediato, que es lo que se está escribiendo)
// y luego con los enlaces. Al revés se vería un parpadeo en cada tecla.
let previaEnCurso = 0
function pintarVistaPrevia(html) {
  const caja = document.getElementById('respuestaPreviaCuerpo')
  if (!caja) return
  const limpio = sanitizeRichText(html || '')
  if (!limpio.replace(/<[^>]*>/g, '').trim()) {
    caja.innerHTML = '<p class="subtext">Todavía no has escrito nada.</p>'
    return
  }
  caja.innerHTML = limpio

  const mio = ++previaEnCurso
  perfilesMencionados(limpio)
    .then((gente) => {
      // Si se ha seguido escribiendo, esta respuesta ya no vale.
      if (mio !== previaEnCurso || !gente.length) return
      caja.innerHTML = enlazarMenciones(limpio, porNombre(gente))
    })
    .catch(() => {})
}

// El borrador vive en el navegador, no en la base.
//
// Es para el accidente de cerrar la pestaña o darle a atrás, no para
// escribir desde tres sitios: guardarlo en la base costaría una escritura
// por tecla y no arregla nada más. Va por tema, para que dos borradores
// de dos temas no se pisen.
const borradoSalvado = {
  clave: () => `pokedoc-borrador-tema-${temaId}`,
  leer() {
    try {
      return sessionStorage.getItem(this.clave()) || ''
    } catch {
      return ''
    }
  },
  guardar(html) {
    try {
      // Vacío no se guarda: si no, borrar lo escrito dejaría un borrador
      // de un párrafo en blanco que luego "se recupera".
      if (!String(html || '').replace(/<[^>]*>/g, '').trim()) sessionStorage.removeItem(this.clave())
      else sessionStorage.setItem(this.clave(), html)
    } catch {
      // Modo privado con el almacenamiento capado: sin borrador, pero el
      // foro funciona igual.
    }
  },
  borrar() {
    try {
      sessionStorage.removeItem(this.clave())
    } catch {}
  },
}

// Citar justo lo que se ha seleccionado.
//
// Al soltar el ratón sobre el texto de un mensaje sale un botón flotante;
// al pulsarlo, ese trozo entra en la caja de responder como cita y se
// marca el mensaje como citado (para que el aviso llegue a quien toca).
function engancharCitarSeleccion() {
  let boton = null

  const quitar = () => {
    boton?.remove()
    boton = null
  }

  document.addEventListener('selectionchange', () => {
    if (!boton) return
    // Con el ratón encima no se quita nunca: al pulsar, el navegador
    // deshace la selección, y si el botón desapareciera en ese momento el
    // clic no llegaría a producirse.
    if (boton.matches(':hover')) return
    // Y se quita solo si la selección ha CAMBIADO de verdad. El navegador
    // encola los selectionchange, así que uno de la propia selección que
    // acaba de hacerse llega DESPUÉS de haber puesto el botón; comparando
    // el texto, ese no se lo lleva por delante.
    if ((window.getSelection()?.toString().trim() || '') === boton.dataset.cita) return
    quitar()
  })

  elMensajes.addEventListener('mouseup', (e) => {
    const sel = window.getSelection()
    const texto = sel?.toString().trim()
    if (!texto || texto.length < 3) return quitar()

    const dentro = e.target.closest?.('[data-texto]')
    if (!dentro) return quitar()

    quitar()
    boton = document.createElement('button')
    boton.type = 'button'
    boton.className = 'foro-citar-flotante'
    boton.innerHTML = `${icons.quote(13)} Citar esto`
    boton.dataset.cita = texto
    boton.style.left = `${e.pageX}px`
    boton.style.top = `${e.pageY + 10}px`
    const quien = dentro.closest('.foro-mensaje')?.querySelector('.foro-autor-nombre')?.textContent.trim()
    boton.addEventListener('click', () => {
      citarTexto(texto, dentro.dataset.texto, quien)
      quitar()
    })
    document.body.appendChild(boton)
  })
}

function citarTexto(texto, postId, quien) {
  const superficie = document.getElementById('respuestaCuerpo')
  if (!superficie) {
    showToast('Entra con tu cuenta para poder citar.')
    return
  }
  citandoA = postId || null
  pintarAvisoDeCita(null, quien)

  // Se mete como <blockquote> delante de lo que ya hubiera escrito, y se
  // deja el cursor debajo para seguir escribiendo.
  const cita = document.createElement('blockquote')
  cita.textContent = texto
  const hueco = document.createElement('p')
  hueco.innerHTML = '<br>'
  superficie.prepend(cita, hueco)
  superficie.dispatchEvent(new Event('input', { bubbles: true }))
  superficie.focus()
  hueco.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// A quién se avisa de una respuesta:
//
//   · a quien abrió el tema,
//   · a quien se ha citado,
//   · a quien se ha mencionado con @nombre,
//   · y a quien SIGUE el tema (eso lo hace la base, ver más abajo).
//
// Los tres primeros van en un Set: si son la misma persona, un aviso y no
// tres.
async function avisar(cuerpo) {
  const destinatarios = new Set()
  if (tema.author_id && tema.author_id !== sesion.user.id) destinatarios.add(tema.author_id)
  if (citandoA) {
    const { data } = await supabase.from('forum_posts').select('author_id').eq('id', citandoA).maybeSingle()
    if (data?.author_id && data.author_id !== sesion.user.id) destinatarios.add(data.author_id)
  }

  const mencionados = await perfilesMencionados(cuerpo || '')
  mencionados.forEach((p) => {
    if (p.id !== sesion.user.id) destinatarios.add(p.id)
  })

  await Promise.all(
    [...destinatarios].map((uid) =>
      createNotification({
        recipientId: uid,
        actorId: sesion.user.id,
        type: 'forum_reply',
        title: mencionados.some((p) => p.id === uid) ? 'Te han mencionado en el foro' : 'Te han respondido en el foro',
        body: tema.title,
        link: urlTema(tema.id),
      })
    )
  )

  // Y los suscritos, que los avisa una función de la base porque desde
  // aquí no se puede ver quién sigue un tema. Se le pasa el mensaje
  // recién creado para que compruebe que es nuestro; sin ese mensaje no
  // se avisa a nadie.
  const { data: mio } = await supabase
    .from('forum_posts')
    .select('id')
    .eq('thread_id', tema.id)
    .eq('author_id', sesion.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (mio?.id) await avisarSuscritos(tema.id, mio.id, tema.title)
}

// ─────────────────────────────────────────────────────────────
async function init() {
  if (!temaId) {
    elMensajes.innerHTML = `<p class="empty-state">No se ha dicho qué tema abrir.</p>`
    return
  }
  sesion = await getSession()
  if (sesion) soyStaff = await esDelEquipo(sesion)

  if (!(await cargar())) return

  await pintarMensajes()
  await montarRespuesta()
  engancharCitarSeleccion()

  // Entrar en un tema es haberlo leído. Va al final y sin `await`: es lo
  // último que importa de la carga, y si falla (migración sin ejecutar)
  // no puede impedir que se vea el tema.
  if (sesion) marcarLeido(sesion.user.id, tema.id)

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
