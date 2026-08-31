import { supabase } from './supabase.js'
import { getSession, escapeHtml } from './app.js'
import { icons } from './icons.js'
import { showToast } from './toast.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { sanitizeRichText } from './richtext-format.js'
import { hydrateVideos } from './video-youtube.js'
import { createNotification } from './notifications.js'
import {
  haceCuanto,
  fechaLarga,
  nombreDe,
  perfilesPorId,
  avatarHtml,
  enlacePerfil,
  etiquetaHtml,
  ETIQUETAS,
  contributorCounts,
  badgeHtml,
  urlForo,
  urlTema,
  temaDeLaRuta,
  esDelEquipo,
  faltaElForo,
} from './foro-comun.js'
import { calculateLevel, levelBadgeHtml, levelLadderHtml, tierLadderHtml } from './gamification.js'
import { orosPorUsuario } from './medallero.js'
import { marcarLeido, marcasDeLectura, estaSuscrito, suscribir, desuscribir, avisarSuscritos } from './foro-lecturas.js'
import { perfilesMencionados, enlazarMenciones, porNombre } from './menciones.js'
import { engancharCompartir } from './compartir.js'
import { cargarEncuesta, encuestaHtml, engancharEncuesta } from './encuesta.js'
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

// Las etiquetas de debajo del nombre. Antes era UNA sola con un orden de
// mando (título de admin > colaborador > nivel), y salía el efecto raro
// de que a unos se les veía el nivel y a otros no — el rango de
// colaborador te TAPABA el nivel. Ahora:
//
//   1. El NIVEL sale siempre, para todo el mundo: es la vara de medir
//      común. Y es clicable — abre la escalera de niveles con el punto
//      exacto en el que está esa persona.
//   2. DEBAJO, una distinción como máximo: el título puesto a mano por
//      un admin (como etiqueta con su color, no texto suelto) o, si no
//      lo hay, el rango de colaborador (clicable: abre sus rangos).
function tituloDe(perfil, guiasAprobadas) {
  const nivel = perfil?.level || calculateLevel(perfil?.total_xp || 0)
  const trozos = [
    `<button type="button" class="foro-chapa-rango" data-ver-niveles="${perfil?.total_xp || 0}"
       title="Ver todos los niveles">${levelBadgeHtml(nivel)}</button>`,
  ]
  if (perfil?.forum_title) {
    // El color lo elige un admin. Aun así se valida ANTES de meterlo en
    // el style: este valor viene de la base, y en un atributo style no
    // puede entrar nada que no sea exactamente un color hex. La base
    // impone lo mismo con una restricción; cinturón y tirantes.
    const color = /^#[0-9a-fA-F]{6}$/.test(perfil.forum_title_color || '') ? perfil.forum_title_color : null
    trozos.push(
      `<span class="foro-titulo-etiqueta"${
        color ? ` style="--chapa:${color}"` : ''
      }>${escapeHtml(perfil.forum_title)}</span>`
    )
  } else if (guiasAprobadas > 0) {
    trozos.push(
      `<button type="button" class="foro-chapa-rango" data-ver-colaborador="${guiasAprobadas}"
         title="Ver los rangos de colaborador">${badgeHtml(guiasAprobadas)}</button>`
    )
  }
  return `<span class="foro-autor-titulo foro-autor-rangos">${trozos.join('')}</span>`
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

// Quien abrió el tema (o el equipo) puede corregir su título y su
// etiqueta. Editar el primer mensaje no lo hace: el título es una columna
// del tema, no del mensaje — y un título con una errata se queda en el
// índice del foro para siempre si no hay forma de tocarlo.
function puedoEditarTema() {
  return !!sesion && (soyStaff || tema.author_id === sesion.user.id)
}

function pintarCabecera(perfilAutor) {
  elCabecera.innerHTML = `
    <h1>
      ${tema.is_pinned ? '<span class="foro-chapa">Fijado</span>' : ''}
      ${tema.is_locked ? '<span class="foro-chapa foro-chapa-cerrado">Cerrado</span>' : ''}
      ${
        // La chapa lleva al mensaje que lo resolvió: es lo que busca quien
        // llega con la misma duda desde un buscador.
        tema.solved_post_id
          ? `<a class="foro-chapa foro-chapa-resuelto" href="#mensaje-${tema.solved_post_id}">${icons.checkCircle(12)} Resuelto</a>`
          : ''
      }
      ${etiquetaHtml(tema.prefix)}
      ${escapeHtml(tema.title)}
    </h1>
    <p class="subtext tema-leyendo hidden" id="temaLeyendo"></p>
    <p class="subtext tema-firma">
      ${avatarHtml(perfilAutor, 20)} ${enlacePerfil(perfilAutor)}
      · <span title="${escapeHtml(fechaLarga(tema.created_at))}">${escapeHtml(haceCuanto(tema.created_at))}</span>
      · ${icons.eye(13)} ${tema.view_count || 0}
      ${sesion ? '<button type="button" class="tema-seguir" id="btnSeguirTema" aria-pressed="false">…</button>' : ''}
      ${
        // Compartir SIN pedir cuenta, a diferencia de "Seguir": es la
        // mitad de la gracia. Alguien llega a un hilo desde fuera, le
        // resuelve la duda, y se lo pasa a otro que tiene la misma.
        `<button type="button" class="tema-seguir" id="btnCompartirTema">${icons.share(13)} Compartir</button>`
      }
      ${puedoEditarTema() ? `<button type="button" class="tema-seguir" id="btnEditarTema">${icons.edit(13)} Editar título</button>` : ''}
    </p>
    ${soyStaff ? panelModeracionHtml() : ''}`

  engancharCompartir(document.getElementById('btnCompartirTema'), { titulo: tema.title })
  if (sesion) engancharSeguir()
  pintarQuienLee().catch(() => {})
  document.getElementById('btnEditarTema')?.addEventListener('click', () => editarTitulo(perfilAutor))
  if (soyStaff) {
    document.getElementById('btnFijar')?.addEventListener('click', () => moderar({ is_pinned: !tema.is_pinned }))
    document.getElementById('btnCerrar')?.addEventListener('click', () => moderar({ is_locked: !tema.is_locked }))
  }
}

function editarTitulo(perfilAutor) {
  // La etiqueta actual puede no estar en la lista (una vieja, o una
  // puesta a mano): se añade como opción para no perderla al guardar.
  const lista = ETIQUETAS.includes(tema.prefix) || !tema.prefix ? ETIQUETAS : [tema.prefix, ...ETIQUETAS]
  elCabecera.innerHTML = `
    <form class="foro-form tema-editar-titulo" id="formEditarTema">
      <div class="foro-form-fila">
        <select id="temaEtiqueta" aria-label="Etiqueta">
          <option value="">Sin etiqueta</option>
          ${lista
            .map((e) => `<option value="${escapeHtml(e)}" ${e === tema.prefix ? 'selected' : ''}>${escapeHtml(e)}</option>`)
            .join('')}
        </select>
        <input type="text" id="temaTitulo" maxlength="140" value="${escapeHtml(tema.title)}" aria-label="Título del tema" />
      </div>
      <div class="foro-form-acciones">
        <button type="submit" class="btn-primary" id="btnGuardarTitulo">Guardar</button>
        <button type="button" class="btn-secondary" id="btnCancelarTitulo">Cancelar</button>
      </div>
    </form>`

  document.getElementById('temaTitulo').focus()
  document.getElementById('btnCancelarTitulo').addEventListener('click', () => pintarCabecera(perfilAutor))

  document.getElementById('formEditarTema').addEventListener('submit', async (e) => {
    e.preventDefault()
    const titulo = document.getElementById('temaTitulo').value.trim()
    if (!titulo) {
      showToast('El tema no puede quedarse sin título.')
      return
    }
    const boton = document.getElementById('btnGuardarTitulo')
    boton.disabled = true
    const cambios = { title: titulo, prefix: document.getElementById('temaEtiqueta').value || null }
    const { error } = await supabase.from('forum_threads').update(cambios).eq('id', tema.id)
    boton.disabled = false
    if (error) {
      showToast('No se ha podido guardar: ' + error.message)
      return
    }
    Object.assign(tema, cambios)
    // El título vive en más sitios que la cabecera: la pestaña del
    // navegador y la última miga de pan también lo dicen.
    document.title = `${tema.title} — Foro de PokeDoc`
    const miga = elMigas.querySelector('[aria-current="page"]')
    if (miga) miga.textContent = tema.title
    pintarCabecera(perfilAutor)
    showToast('Título guardado.', 'success')
  })
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

// Quién está leyendo este tema ahora mismo, sobre los usuarios en línea:
// el latido de cada visita apunta en qué tema está (js/en-linea.js). Los
// miembros por su nombre —salvo quien esconde su actividad, que se cuenta
// pero no se nombra— y los invitados contados. Si no se puede saber
// (migración sin ejecutar), la línea no sale y no pasa nada más.
async function pintarQuienLee() {
  const linea = document.getElementById('temaLeyendo')
  if (!linea) return
  try {
    const { quienLeeElTema } = await import('./en-linea.js')
    const gente = await quienLeeElTema(tema.id)
    if (!gente || gente.total === 0) return

    const perfiles = await perfilesPorId(gente.miembros)
    const nombrados = gente.miembros.map((id) => perfiles[id]).filter((p) => p && !p.hide_activity)
    const trozos = []
    if (nombrados.length) trozos.push(nombrados.map((p) => enlacePerfil(p)).join(', '))
    const anonimos = gente.total - nombrados.length
    if (anonimos > 0) trozos.push(`${anonimos} ${anonimos === 1 ? 'invitado' : 'invitados'}`)

    linea.innerHTML = `${icons.eye(12)} Leyendo ahora: ${trozos.join(' y ')}`
    linea.classList.remove('hidden')
  } catch {}
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
  // Las reacciones sustituyen al "me gusta" (los que había se migraron
  // como 👍). Si la tabla no existe todavía (migración sin ejecutar), la
  // consulta falla y el tema se ve entero — sin reacciones, pero entero.
  const [perfiles, cuentas, { data: citadosData }, reaccionesRes] = await Promise.all([
    perfilesPorId([...lista.map((m) => m.author_id), tema.author_id]),
    contributorCounts(lista.map((m) => m.author_id)),
    citados.length
      ? supabase.from('forum_posts').select('id, author_id, body_html').in('id', citados)
      : Promise.resolve({ data: [] }),
    lista.length
      ? supabase.from('forum_post_reactions').select('post_id, user_id, kind').in('post_id', lista.map((m) => m.id))
      : Promise.resolve({ data: [] }),
  ])
  const hayReacciones = !reaccionesRes.error

  // Quién es del equipo y qué título le han puesto: hace falta para la
  // columna del autor. Va en dos escalones porque son DOS migraciones:
  // si falta la del color, se reintenta sin él (los títulos salen, sin
  // color); si falta la de títulos entera, se sigue sin ellos — el foro
  // no depende de esto.
  const autores = [...new Set(lista.map((m) => m.author_id).filter(Boolean))]
  if (autores.length) {
    let { data: extra, error: errorExtra } = await supabase
      .from('user_profiles')
      .select('id, is_admin, is_moderator, forum_title, forum_title_color, forum_post_count, forum_signature')
      .in('id', autores)
    if (errorExtra) {
      ;({ data: extra } = await supabase
        .from('user_profiles')
        .select('id, is_admin, is_moderator, forum_title')
        .in('id', autores))
    }
    for (const a of extra || []) if (perfiles[a.id]) Object.assign(perfiles[a.id], a)
  }

  const citadoPorId = Object.fromEntries((citadosData || []).map((c) => [c.id, c]))
  const reaccionesPorMensaje = {}
  for (const r of reaccionesRes.data || []) (reaccionesPorMensaje[r.post_id] ||= []).push(r)

  // Los nombres de quienes reaccionaron (para el "quién" al posar el
  // ratón). Solo se piden los que no estén ya cargados como autores.
  const reactores = [...new Set((reaccionesRes.data || []).map((r) => r.user_id).filter((id) => id && !perfiles[id]))]
  if (reactores.length) Object.assign(perfiles, await perfilesPorId(reactores))

  // El "Gracias: N" de la columna del autor: cuántas reacciones han
  // recibido EN TOTAL los mensajes de cada autor de esta página. Un solo
  // viaje con el join embebido (nunca un .in() con todos sus mensajes);
  // si la tabla no existe (migración sin ejecutar), la línea no sale.
  let graciasPorAutor = null
  if (hayReacciones && autores.length) {
    const { data: recibidas, error: errorGracias } = await supabase
      .from('forum_post_reactions')
      .select('post_id, post:forum_posts!inner(author_id)')
      .in('post.author_id', autores)
      .limit(1000)
    if (!errorGracias && recibidas) {
      graciasPorAutor = Object.fromEntries(autores.map((a) => [a, 0]))
      for (const r of recibidas) {
        const quien = r.post?.author_id
        if (quien in graciasPorAutor) graciasPorAutor[quien]++
      }
    }
  }

  // Los oros de cada autor de esta página, en un solo viaje. Como las
  // gracias: si la tabla no existe o falla, la línea no sale y ya.
  const orosPorAutor = autores.length ? await orosPorUsuario(autores) : {}

  elMensajes.innerHTML = lista
    .map((m, i) =>
      mensajeHtml(m, desde + i + 1, perfiles, cuentas, citadoPorId, {
        reacciones: reaccionesPorMensaje[m.id] || [],
        hayReacciones,
        mencionados,
        gracias: graciasPorAutor,
        oros: orosPorAutor,
      })
    )
    .join('')

  // Los vídeos de YouTube que haya en los mensajes. Pinta la portada; el
  // iframe no se carga hasta que alguien lo pulsa (js/video-youtube.js).
  hydrateVideos(elMensajes)
  // Los spoilers: que seleccionar sobre la pestaña no los pliegue y que
  // copiar por encima de uno cerrado no se lleve lo oculto. La escucha es
  // delegada y se engancha una sola vez aunque esto se repinte.
  import('./spoilers.js').then((m) => m.engancharSpoilers(elMensajes)).catch(() => {})
  // El puntito verde de "en línea ahora" junto al avatar. Va después y
  // por su cuenta: si tarda o falla, el tema ya está en pantalla.
  marcarConectados(perfiles).catch(() => {})
  // Los enlaces internos pegados a pelo se convierten en tarjetitas.
  import('./enlaces-internos.js').then((m) => m.enriquecerEnlacesInternos(elMensajes)).catch(() => {})

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
  pintarEncuesta()
}

// La encuesta del tema, si la tiene.
//
// Va en su propio hueco encima de los mensajes: es lo primero que se
// mira al entrar, y así se puede repintar sola al votar sin tocar la
// lista de mensajes.
//
// Solo en la PRIMERA página: en la tercera página de un hilo largo, la
// votación ya no es de lo que se está hablando.
async function pintarEncuesta() {
  const hueco = document.getElementById('temaEncuesta')
  if (!hueco) return
  if (pagina !== 1) {
    hueco.innerHTML = ''
    return
  }
  const datos = await cargarEncuesta(tema.id)
  if (!datos) {
    hueco.innerHTML = ''
    return
  }
  hueco.innerHTML = encuestaHtml(datos, puedoEditarTema())
  engancharEncuesta(hueco, tema.id, pintarEncuesta, datos)
}

// Las reacciones que puede llevar un mensaje. El emoji es solo cómo se
// pinta: en la base viven como 'like', 'love'..., que la restricción CHECK
// conoce.
const REACCIONES = [
  ['like', '👍'],
  ['love', '❤️'],
  ['laugh', '😂'],
  ['wow', '😮'],
]

// La fila de reacciones de un mensaje. En los ajenos son botones (la tuya
// resaltada); en el propio, solo los recuentos — la base prohíbe
// reaccionarse a uno mismo, y un botón que siempre da error es peor que no
// enseñarlo. Una reacción por persona: pulsar otra te cambia, repetir la
// tuya la quita.
// El "quién": los nombres detrás del numerito, para el title del botón.
// Hasta ocho; con más gente se resume, que un tooltip de treinta nombres
// no se lee.
function quienesReaccionaron(filas, perfiles) {
  const nombres = filas.map((r) => nombreDe(perfiles[r.user_id]) || 'Alguien')
  if (nombres.length > 8) return `${nombres.slice(0, 8).join(', ')} y ${nombres.length - 8} más`
  return nombres.join(', ')
}

function reaccionesHtml(m, reacciones, esMio, perfiles) {
  const mia = sesion ? reacciones.find((r) => r.user_id === sesion.user.id)?.kind : null
  return `<div class="foro-reacciones" data-reacciones="${m.id}">
    ${REACCIONES.map(([kind, emoji]) => {
      const deEsta = reacciones.filter((r) => r.kind === kind)
      const cuenta = deEsta.length
      const quienes = cuenta ? quienesReaccionaron(deEsta, perfiles) : ''
      if (esMio || !sesion) {
        // Sin botón: o es tu mensaje, o no hay sesión. Los ceros no se
        // enseñan — cuatro "0" por mensaje es ruido.
        return cuenta
          ? `<span class="foro-reaccion foro-reaccion-quieta" title="${escapeHtml(quienes)}">${emoji} ${cuenta}</span>`
          : ''
      }
      // Con gente detrás, el title dice QUIÉN; sin nadie, qué hace el botón.
      return `<button type="button" class="foro-reaccion ${mia === kind ? 'foro-reaccion-mia' : ''}"
        data-reaccion="${m.id}" data-kind="${kind}" aria-pressed="${mia === kind}"
        title="${cuenta ? escapeHtml(quienes) : mia === kind ? 'Quitar mi reacción' : 'Reaccionar'}">${emoji}${cuenta ? ` ${cuenta}` : ''}</button>`
    }).join('')}
  </div>`
}

// El puntito verde: a los avatares de quien está EN LÍNEA ahora mismo se
// les pone la marca. El dato ya lo mantiene el latido de en-linea.js;
// quien esconde su actividad se cuenta en el total pero no se le señala.
async function marcarConectados(perfiles) {
  const { quienEstaEnLinea } = await import('./en-linea.js')
  const enLinea = await quienEstaEnLinea()
  if (!enLinea) return
  const conectados = new Set(enLinea.miembros)
  elMensajes.querySelectorAll('article[data-autor]').forEach((art) => {
    const id = art.dataset.autor
    if (!conectados.has(id) || perfiles[id]?.hide_activity) return
    const avatar = art.querySelector('.mini-avatar')
    if (avatar) {
      avatar.classList.add('avatar-conectado')
      avatar.title = 'En línea ahora'
    }
  })
}

function mensajeHtml(m, numero, perfiles, cuentas, citadoPorId, { reacciones, hayReacciones, mencionados, gracias, oros }) {
  const perfil = perfiles[m.author_id]
  const nombre = nombreDe(perfil)
  const citado = m.reply_to_id ? citadoPorId[m.reply_to_id] : null
  const esMio = sesion && m.author_id === sesion.user.id
  const esLaSolucion = tema.solved_post_id && tema.solved_post_id === m.id
  // Marcar la solución: quien abrió el tema (o el equipo), y nunca el
  // primer mensaje — la pregunta no puede ser su propia respuesta.
  const puedeResolver = puedoEditarTema() && numero > 1

  return `
  <article class="foro-mensaje ${esLaSolucion ? 'foro-mensaje-solucion' : ''}" id="mensaje-${m.id}" data-mensaje="${m.id}" data-autor="${escapeHtml(m.author_id || '')}">
    <div class="foro-mensaje-autor">
      ${avatarHtml(perfil, 56)}
      <div class="foro-autor-nombre">${enlacePerfil(perfil)}</div>
      ${tituloDe(perfil, cuentas[m.author_id] || 0)}
      ${chapasDe(perfil, m.author_id && m.author_id === tema.author_id)}
      ${
        // El clásico "Mensajes: 336". Number.isFinite y no truthiness: el
        // 0 de quien estrena cuenta también se dice.
        Number.isFinite(perfil?.forum_post_count)
          ? `<span class="foro-autor-mensajes">Mensajes: ${perfil.forum_post_count}</span>`
          : ''
      }
      ${
        // Y su pareja de toda la vida: "Gracias: N", las reacciones que
        // han recibido sus mensajes. El 0 también se dice.
        gracias && m.author_id in gracias
          ? `<span class="foro-autor-mensajes">Gracias: ${gracias[m.author_id]}</span>`
          : ''
      }
      ${
        // Los oros de los cursos: aquí el 0 NO se dice — a diferencia de
        // mensajes y gracias, que crecen solos con participar, la medalla
        // es un logro y enseñar "Oros: 0" a todo el mundo solo mete ruido.
        oros && oros[m.author_id] > 0
          ? `<span class="foro-autor-mensajes foro-autor-oros" title="Cursos completados con medalla de oro">${icons.trophy(12)} Oros: ${oros[m.author_id]}</span>`
          : ''
      }
    </div>
    <div class="foro-mensaje-cuerpo">
      <header class="foro-mensaje-cabecera">
        <span class="subtext" title="${escapeHtml(fechaLarga(m.created_at))}">${escapeHtml(haceCuanto(m.created_at))}${
          m.edited_at ? ' · editado' : ''
        }</span>
        <button type="button" class="foro-copiar-enlace" data-copiar-enlace="${m.id}" data-num="${numero}" title="Copiar el enlace a este mensaje" aria-label="Copiar el enlace a este mensaje">${icons.link(13)}</button>
        <a class="foro-mensaje-num" href="#mensaje-${m.id}" title="Enlace a este mensaje">#${numero}</a>
      </header>
      ${esLaSolucion ? `<p class="foro-solucion-banda">${icons.checkCircle(14)} Esta respuesta resolvió el tema</p>` : ''}
      ${
        // La cabecera de la cita es un enlace al mensaje citado: salta
        // (resolviendo la página si hace falta) y lo destella. Antes la
        // cita enseñaba un trozo y ahí se acababa el camino.
        citado
          ? `<blockquote class="foro-cita">
               <a class="foro-cita-quien" href="#mensaje-${citado.id}" title="Ver el mensaje completo en su sitio">${escapeHtml(
                 nombreDe(perfiles[citado.author_id])
               )} escribió: <span class="foro-cita-salto" aria-hidden="true">↩</span></a>
               <div class="article-body">${sanitizeRichText(recortar(citado.body_html))}</div>
             </blockquote>`
          : ''
      }
      <div class="article-body foro-mensaje-texto" data-texto="${m.id}">${enlazarMenciones(
        sanitizeRichText(m.body_html || ''),
        mencionados
      )}</div>
      ${
        // La firma: el mismo formato que un mensaje, pasado por el MISMO
        // saneador (se guardó saneada, pero aquí se vuelve a sanear: lo
        // que se pinta en cada mensaje no puede fiarse de lo que haya en
        // la base). Los límites visuales los pone el CSS: altura recortada
        // con scroll propio e imágenes a tamaño de firma.
        perfil?.forum_signature
          ? `<div class="foro-firma article-body">${sanitizeRichText(perfil.forum_signature)}</div>`
          : ''
      }
      <footer class="foro-mensaje-pie">
        <div class="foro-mensaje-izq">
          ${reportButtonHtml('forum_post', m.id)}
          ${esMio || soyStaff ? `<button type="button" class="link-btn" data-editar="${m.id}">${icons.edit(13)} Editar</button>` : ''}
          ${esMio || soyStaff ? `<button type="button" class="link-btn" data-borrar="${m.id}">${icons.trash(13)} Borrar</button>` : ''}
          ${
            puedeResolver
              ? `<button type="button" class="link-btn foro-btn-resolver" data-resolver="${m.id}">${icons.checkCircle(13)} ${
                  esLaSolucion ? 'Quitar la marca de solución' : 'Marcar como solución'
                }</button>`
              : ''
          }
        </div>
        <div class="foro-mensaje-der">
          ${hayReacciones ? reaccionesHtml(m, reacciones, esMio, perfiles) : ''}
          <button type="button" class="foro-accion" data-citar="${m.id}">${icons.quote(14)} Citar</button>
        </div>
      </footer>
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
// La MULTICITA: la primera cita ancla la respuesta (reply_to_id); las
// siguientes entran como blockquote en la caja, y aquí se apuntan sus
// mensajes para que el aviso les llegue también a sus autores.
let citadosExtra = new Set()

function enganchar(perfiles) {
  elMensajes.querySelectorAll('[data-reaccion]').forEach((b) =>
    b.addEventListener('click', () => alternarReaccion(b.dataset.reaccion, b.dataset.kind, b))
  )
  elMensajes.querySelectorAll('[data-resolver]').forEach((b) =>
    b.addEventListener('click', () => alternarSolucion(b.dataset.resolver))
  )
  elMensajes.querySelectorAll('[data-citar]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.citar
      const autorId = elMensajes.querySelector(`[data-mensaje="${id}"]`)?.dataset.autor
      // MULTICITA: si ya se está citando OTRO mensaje, este segundo (y
      // los que vengan) entran como blockquote en la caja, con el aviso
      // apuntado. El primero sigue siendo el ancla de la respuesta.
      if (citandoA && citandoA !== id && !citadosExtra.has(id)) {
        const texto = elMensajes
          .querySelector(`[data-mensaje="${id}"] .foro-mensaje-texto`)
          ?.innerText.replace(/\s+/g, ' ')
          .trim()
          .slice(0, 400)
        if (texto) {
          citadosExtra.add(id)
          citarTexto(`${nombreDe(perfiles[autorId])}: ${texto}`, null, null, { anclar: false })
          showToast(`Cita añadida (${citadosExtra.size + 1} mensajes citados).`, 'success')
          return
        }
      }
      citandoA = id
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

async function alternarReaccion(postId, kind, boton) {
  if (!sesion) {
    showToast('Entra con tu cuenta para reaccionar a un mensaje.')
    return
  }
  // Repetir tu reacción la quita; cualquier otra te cambia a ella. El
  // upsert apoya en la clave (post_id, user_id): una reacción por persona
  // lo impone la base, no esta pantalla.
  const laMia = boton.getAttribute('aria-pressed') === 'true'
  // ¿Es la PRIMERA reacción de esta persona a este mensaje? Cambiar de
  // 👍 a ❤️ no vuelve a avisar: un solo aviso por persona y mensaje.
  const yaTeniaAlguna = !!boton.closest('.foro-reacciones')?.querySelector('.foro-reaccion-mia')
  const { error } = laMia
    ? await supabase.from('forum_post_reactions').delete().eq('post_id', postId).eq('user_id', sesion.user.id)
    : await supabase
        .from('forum_post_reactions')
        .upsert({ post_id: postId, user_id: sesion.user.id, kind }, { onConflict: 'post_id,user_id' })

  if (error) {
    // El caso típico es el mensaje propio, que la base no deja. No se
    // enseña el error de PostgreSQL en crudo: se dice lo que pasa.
    const propio = /row-level security/i.test(error.message || '')
    showToast(propio ? 'No puedes reaccionar a tu propio mensaje.' : 'No se ha podido: ' + error.message)
    return
  }
  // El aviso al autor del mensaje. Después de guardar y sin bloquear el
  // repintado: una campanita que falle no puede estropear la reacción.
  if (!laMia && !yaTeniaAlguna) {
    const autor = boton.closest('article[data-mensaje]')?.dataset.autor
    createNotification({
      recipientId: autor,
      actorId: sesion.user.id,
      type: 'forum_reaction',
      title: `Han reaccionado ${REACCIONES.find(([k]) => k === kind)?.[1] || ''} a tu mensaje`.trim(),
      body: tema.title,
      link: `${urlTema(tema.id)}#mensaje-${postId}`,
    }).catch(() => {})
  }
  await pintarMensajes()
}

// Marcar (o desmarcar) la respuesta que resolvió el tema. Solo el autor
// del tema o el equipo; que el mensaje sea de ESTE tema lo comprueba un
// disparador en la base — desde aquí no se puede mentir.
async function alternarSolucion(postId) {
  const cambios = { solved_post_id: tema.solved_post_id === postId ? null : postId }
  const { error } = await supabase.from('forum_threads').update(cambios).eq('id', tema.id)
  if (error) {
    const faltaColumna = /solved_post_id/.test(error.message || '')
    showToast(
      faltaColumna
        ? 'Falta ejecutar supabase-migration-foro-extras.sql en el SQL Editor de Supabase.'
        : 'No se ha podido: ' + error.message
    )
    return
  }
  Object.assign(tema, cambios)
  await pintarMensajes()
  showToast(cambios.solved_post_id ? 'Marcado como la solución.' : 'Marca quitada.', 'success')
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
    // La marca de lectura se renueva DESPUÉS de publicar. Al abrir el
    // tema ya se marcó, pero tu mensaje es posterior a esa marca, así
    // que el tema te salía como "sin leer" — con tu propio mensaje como
    // novedad. `estaSinLeer` ya perdona cuando el último eres tú; esto
    // cubre además la carrera de que alguien conteste justo detrás.
    marcarLeido(sesion.user.id, tema.id)
    citandoA = null
    citadosExtra = new Set()
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

function citarTexto(texto, postId, quien, { anclar = true } = {}) {
  const superficie = document.getElementById('respuestaCuerpo')
  if (!superficie) {
    showToast('Entra con tu cuenta para poder citar.')
    return
  }
  if (anclar) {
    citandoA = postId || null
    pintarAvisoDeCita(null, quien)
  }

  // Se mete como <blockquote> delante de lo que ya hubiera escrito (las
  // citas EXTRA de la multicita, detrás: en el orden en que se pulsan),
  // y se deja el cursor debajo para seguir escribiendo.
  const cita = document.createElement('blockquote')
  cita.textContent = texto
  const hueco = document.createElement('p')
  hueco.innerHTML = '<br>'
  if (anclar) superficie.prepend(cita, hueco)
  else superficie.append(cita, hueco)
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
  const citados = new Set()
  if (tema.author_id && tema.author_id !== sesion.user.id) destinatarios.add(tema.author_id)
  const idsCitados = [citandoA, ...citadosExtra].filter(Boolean)
  if (idsCitados.length) {
    const { data } = await supabase.from('forum_posts').select('author_id').in('id', idsCitados)
    for (const fila of data || []) {
      if (fila.author_id && fila.author_id !== sesion.user.id) {
        destinatarios.add(fila.author_id)
        citados.add(fila.author_id)
      }
    }
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
        // El aviso dice POR QUÉ te llega: mención > cita > respuesta.
        title: mencionados.some((p) => p.id === uid)
          ? 'Te han mencionado en el foro'
          : citados.has(uid)
            ? 'Te han citado en el foro'
            : 'Te han respondido en el foro',
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
// Llegar al mensaje correcto. Dos maneras de entrar apuntando a un
// mensaje concreto:
//
//   /tema/x?nuevo=1       → el primer mensaje que no habías leído
//   /tema/x#mensaje-<id>  → uno concreto (un aviso, un enlace copiado)
//
// El hash a pelo solo funcionaba si el mensaje caía en la página que se
// estaba pintando: un aviso que apuntaba a la página 3 te dejaba en la 1
// sin decir nada. Aquí se calcula la página de verdad, se repinta y se
// ilumina el mensaje.

// ¿En qué página cae un mensaje? Contando cuántos hay antes que él.
async function paginaDelMensaje(postId) {
  const { data: post } = await supabase.from('forum_posts').select('created_at').eq('id', postId).maybeSingle()
  if (!post) return null
  const { count } = await supabase
    .from('forum_posts')
    .select('*', { count: 'exact', head: true })
    .eq('thread_id', tema.id)
    .lt('created_at', post.created_at)
  return Math.floor((count || 0) / PAGINA) + 1
}

function destellar(postId) {
  const el = document.getElementById(`mensaje-${postId}`)
  if (!el) return false
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // Quitar y volver a poner reinicia la animación si se llega dos veces
  // al mismo mensaje.
  el.classList.remove('foro-mensaje-destello')
  void el.offsetWidth
  el.classList.add('foro-mensaje-destello')
  return true
}

async function irAlMensaje(postId) {
  if (destellar(postId)) return
  const destino = await paginaDelMensaje(postId)
  if (!destino || destino === pagina) return
  pagina = destino
  const url = new URL(window.location.href)
  url.searchParams.set('p', String(pagina))
  window.history.replaceState({}, '', url)
  await pintarMensajes()
  destellar(postId)
}

// El primer mensaje POSTERIOR a tu última lectura. Sin referencia (nunca
// habías entrado), lo nuevo empieza en el primer mensaje: no se salta.
async function irAlPrimerNoLeido(referencia) {
  let q = supabase
    .from('forum_posts')
    .select('id')
    .eq('thread_id', tema.id)
    .order('created_at', { ascending: true })
    .limit(1)
  if (referencia) q = q.gt('created_at', referencia)
  const { data } = await q
  if (data?.[0]?.id) await irAlMensaje(data[0].id)
}

// La escalera de niveles (o de rangos de colaborador) de OTRA persona,
// abierta desde su etiqueta en la columna del autor. El mismo contenido
// que el modal del perfil, hablando en tercera persona.
function abrirEscalera(html) {
  document.querySelector('.foro-modal-escalera')?.remove()
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay foro-modal-escalera'
  overlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-label="Niveles y rangos">
      <button type="button" class="modal-close" aria-label="Cerrar">✕</button>
      ${html}
    </div>`
  document.body.appendChild(overlay)
  const cerrar = () => overlay.remove()
  overlay.querySelector('.modal-close').addEventListener('click', cerrar)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar()
  })
  document.addEventListener(
    'keydown',
    function alEscape(e) {
      if (e.key !== 'Escape') return
      cerrar()
      document.removeEventListener('keydown', alEscape)
    }
  )
}

elMensajes.addEventListener('click', (e) => {
  const nivelBtn = e.target.closest('[data-ver-niveles]')
  if (nivelBtn) return abrirEscalera(levelLadderHtml(Number(nivelBtn.dataset.verNiveles) || 0, { ajeno: true }))
  const rangoBtn = e.target.closest('[data-ver-colaborador]')
  if (rangoBtn) return abrirEscalera(tierLadderHtml(Number(rangoBtn.dataset.verColaborador) || 0, { ajeno: true }))
})

// Copiar el enlace de un mensaje: la URL lleva su página (se calcula del
// número, sin consultas) y su ancla, así que funciona para cualquiera.
elMensajes.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-copiar-enlace]')
  if (!btn) return
  const p = Math.max(1, Math.ceil(Number(btn.dataset.num || 1) / PAGINA))
  const url = new URL(urlTema(tema.id, p), window.location.origin)
  url.hash = `mensaje-${btn.dataset.copiarEnlace}`
  navigator.clipboard
    .writeText(url.toString())
    .then(() => showToast('Enlace copiado.', 'success'))
    .catch(() => showToast('No se ha podido copiar el enlace.'))
})

// Pinchar un ancla de mensaje que no está en esta página (el «#12» de
// otra página, la chapa de Resuelto…) también resuelve y destella.
window.addEventListener('hashchange', () => {
  const id = window.location.hash.match(/^#mensaje-(.+)$/)?.[1]
  if (id && tema) irAlMensaje(decodeURIComponent(id))
})

// ─────────────────────────────────────────────────────────────
async function init() {
  if (!temaId) {
    elMensajes.innerHTML = `<p class="empty-state">No se ha dicho qué tema abrir.</p>`
    return
  }
  sesion = await getSession()
  if (sesion) soyStaff = await esDelEquipo(sesion)

  if (!(await cargar())) return

  // La marca de lectura VIEJA se lee antes de renovarla: es la que dice
  // dónde empieza lo que no has visto.
  const quiereNuevo = params.get('nuevo') === '1' && !!sesion
  let referencia = null
  if (quiereNuevo) {
    const marcas = await marcasDeLectura(sesion.user.id)
    referencia = [marcas.porTema[tema.id], marcas.todoHasta].filter(Boolean).sort().pop() || null
  }

  await pintarMensajes()
  await montarRespuesta()
  engancharCitarSeleccion()

  const enlazado = window.location.hash.match(/^#mensaje-(.+)$/)?.[1]
  if (quiereNuevo) irAlPrimerNoLeido(referencia).catch(() => {})
  else if (enlazado) irAlMensaje(decodeURIComponent(enlazado)).catch(() => {})

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

  // ── En vivo (tanda 227) ──
  // Un tema que se está moviendo se repinta solo cuando alguien
  // responde. AQUÍ NO HAY SONDEO de respaldo, y es a propósito: el foro
  // nunca lo tuvo, así que sin websocket se queda exactamente como
  // estaba — hay que recargar, como toda la vida. Lo que no puede pasar
  // es que la página empiece a consultar cada diez segundos por leer un
  // tema, que sería gastar más que antes.
  //
  // Solo INSERT: una edición o un borrado repintando el tema mientras
  // lees te movería el texto bajo el dedo. Y del DELETE no hay que
  // fiarse (no respeta la RLS).
  import('./vivo.js')
    .then(({ escuchar }) => {
      escuchar({
        nombre: `tema-${tema.id}`,
        tablas: [{ tabla: 'forum_posts', filtro: `thread_id=eq.${tema.id}`, evento: 'INSERT' }],
        alCambiar: () => pintarMensajes(),
      })
    })
    .catch(() => {})
}

init().catch(() => {
  elMensajes.innerHTML = `<p class="empty-state">No se ha podido cargar el tema.</p>`
})
