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
  nombreDe,
  etiquetaHtml,
  urlForo,
  urlTema,
  foroDeLaRuta,
  esDelEquipo,
  faltaElForo,
} from './foro-comun.js'
import { marcasDeLectura, estaSinLeer, marcarTodoLeido, sinLeerPorForo } from './foro-lecturas.js'
import { plegarTexto } from './texto.js'
import { formularioEncuestaHtml, engancharFormularioEncuesta, leerFormularioEncuesta, crearEncuesta } from './encuesta.js'

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
const consulta = (params.get('q') || '').trim()

const principal = document.getElementById('foroPrincipal')
const lateral = document.getElementById('foroLateral')
const migas = document.getElementById('foroMigas')
const acciones = document.getElementById('foroAcciones')

let sesion = null
let soyStaff = false
// Las marcas de lectura de quien mira. Se piden una vez al arrancar y se
// usan en el índice y en la lista de temas.
let marcas = null
// Temas sin leer de cada foro, por su id. El índice lo necesita para poder
// distinguir un foro con novedades de uno que ya te has leído: antes los
// dos se veían igual y había que entrar en todos para saberlo.
let nuevosPorForo = {}

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
      ${avatarHtml(perfil, 28)}
      <div class="foro-ultimo-texto">
        <a class="foro-ultimo-titulo" href="${url}">${escapeHtml(titulo || 'Ver tema')}</a>
        <span class="subtext" title="${escapeHtml(fechaLarga(fecha))}">${escapeHtml(haceCuanto(fecha))} · ${enlacePerfil(perfil)}</span>
      </div>
    </div>`
}

// El botón de "marcar todo como leído".
//
// Solo aparece con sesión iniciada y solo si hay algo sin leer: un botón
// para marcar como leído lo que ya lo está es ruido.
function botonMarcarTodoHtml(hayAlgoSinLeer) {
  if (!sesion || !hayAlgoSinLeer) return ''
  return `<button type="button" class="btn-secondary foro-btn-leido" id="btnMarcarLeido">${icons.checkCircle(15)} Marcar todo como leído</button>`
}

// La chapa de "3 nuevos" de un foro.
//
// No lleva comprobación de sesión, y no es un olvido: sin sesión no se
// piden las marcas de lectura, así que `nuevosPorForo` está vacío y aquí
// nunca llega un número. Se probó poniendo la comprobación y quitándola:
// no cambia nada, o sea que era código que no se ejecutaba nunca.
function chapaNuevosHtml(nuevos) {
  if (!nuevos) return ''
  return `<span class="foro-chapa foro-chapa-nuevos">${nuevos} nuevo${nuevos === 1 ? '' : 's'}</span>`
}

function engancharMarcarTodo() {
  document.getElementById('btnMarcarLeido')?.addEventListener('click', async (e) => {
    const boton = e.currentTarget
    boton.disabled = true
    const ok = await marcarTodoLeido(sesion.user.id)
    if (!ok) {
      boton.disabled = false
      showToast('No se ha podido marcar como leído.')
      return
    }
    // Se recarga en vez de repintar a mano: la marca afecta al índice, a
    // la lista de temas y a los puntos de cada fila, y recargar deja
    // todo coherente sin tres caminos distintos que mantener.
    window.location.reload()
  })
}

// ─────────────────────────────────────────────────────────────
// 1. El índice
// ─────────────────────────────────────────────────────────────
// ── Los temas que nadie ha contestado ──
//
// Con una comunidad pequeña, un hilo sin respuesta el primer día es alguien
// que no vuelve. Esta tira los pone donde todo el mundo los ve, para que a
// nadie se le quede la pregunta colgada.
//
// Quedan fuera los cerrados (no se puede contestar) y los fijados (un
// anuncio de la casa no pide respuestas). Y solo temas de los foros
// VISIBLES: la política de lectura de forum_threads es abierta, así que sin
// este filtro un tema de un foro oculto se colaría por aquí.
async function sinResponderHtml(idsForosVisibles) {
  if (!idsForosVisibles.length) return ''
  const { data, error } = await supabase
    .from('forum_threads')
    .select('id, title, prefix, created_at, author_id')
    .in('board_id', idsForosVisibles)
    .eq('post_count', 1)
    .eq('is_locked', false)
    .eq('is_pinned', false)
    .order('created_at', { ascending: false })
    .limit(5)
  if (error || !data || data.length === 0) return ''

  const perfiles = await perfilesPorId(data.map((t) => t.author_id))
  const filas = data
    .map(
      (t) => `<a class="foro-sr-fila" href="${urlTema(t.id)}">
        <span class="foro-sr-titulo">${etiquetaHtml(t.prefix)} ${escapeHtml(t.title)}</span>
        <small>${escapeHtml(nombreDe(perfiles[t.author_id]))} · ${escapeHtml(haceCuanto(t.created_at))}</small>
      </a>`
    )
    .join('')

  return `<section class="foro-sin-responder">
    <h2>${icons.helpCircle(16)} Sin respuesta todavía</h2>
    <p class="subtext">Nadie ha contestado a ${data.length === 1 ? 'este tema' : 'estos temas'}. Si sabes algo, dentro te esperan.</p>
    <div class="foro-sr-lista">${filas}</div>
  </section>`
}

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

  // Los nuevos de un foro CUENTAN los de sus subforos. Si no, un subforo
  // con novedades se quedaba invisible desde el índice: el padre salía
  // como leído y no había ninguna razón para entrar.
  const nuevosDe = (f) =>
    (nuevosPorForo[f.id] || 0) + hijosDe(f.id).reduce((t, s) => t + (nuevosPorForo[s.id] || 0), 0)

  const filaForo = (f) => {
    const subforos = hijosDe(f.id)
    const nuevos = nuevosDe(f)
    return `
    <div class="foro-fila ${nuevos ? 'foro-fila-nueva' : 'foro-fila-leida'}">
      <div class="foro-fila-icono" aria-hidden="true">${
        nuevos ? `<span class="foro-punto-nuevo" title="Con mensajes nuevos"></span>` : ''
      }${icons.messageSquare(18)}</div>
      <div class="foro-fila-cuerpo">
        <h3>
          <a href="${urlForo(f.slug)}">${escapeHtml(f.name)}</a>
          ${chapaNuevosHtml(nuevos)}
        </h3>
        ${f.description ? `<p class="subtext">${escapeHtml(f.description)}</p>` : ''}
        ${
          subforos.length
            ? `<p class="foro-subforos">${subforos
                .map(
                  (s) =>
                    `<a class="${nuevosPorForo[s.id] ? 'foro-subforo-nuevo' : ''}" href="${urlForo(s.slug)}">${
                      nuevosPorForo[s.id] ? `<span class="foro-punto-nuevo"></span>` : ''
                    }${icons.messageSquare(12)} ${escapeHtml(s.name)}</a>`
                )
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

  const sinResponder = await sinResponderHtml(foros.map((f) => f.id))

  principal.innerHTML = bloques
    ? sinResponder + bloques
    : `<p class="empty-state">Todavía no hay ningún foro abierto. Se crean desde el panel de administración.</p>`

  migas.innerHTML = migasHtml([{ texto: 'Inicio', url: '/index.html' }, { texto: 'Foro' }])
  // El botón faltaba justo donde más falta hace. Estaba sólo dentro de un
  // foro, así que para quitarte el "todo sin leer" de encima tenías que
  // entrar en uno cualquiera y buscarlo allí.
  acciones.innerHTML = botonMarcarTodoHtml(foros.some((f) => nuevosPorForo[f.id]))
  engancharMarcarTodo()
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
// Debajo van los números del foro. Ojo con lo que se enseña: un
// "usuarios en línea: 1" con veinte miembros enseña soledad, así que no
// hay tal cosa. Lo que sí hay es "por aquí hoy", que con poca gente
// sigue siendo un número honesto y agradable de ver.
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
      // Dos enlaces HERMANOS, nunca uno dentro de otro: el avatar ya es un
      // <a> al perfil, y un <a> dentro de otro <a> no existe en HTML — el
      // navegador cierra el de fuera al toparse con el de dentro, y el
      // título se quedaba sin enlace (no se podía entrar en el tema).
      return `
      <div class="foro-reciente">
        ${avatarHtml(perfiles[m.author_id], 26)}
        <span class="foro-reciente-texto">
          <a class="foro-reciente-titulo" href="${urlTema(m.thread_id)}">${escapeHtml(tema.title)}</a>
          <small>${escapeHtml(haceCuanto(m.created_at))} · ${escapeHtml(nombreDe(perfiles[m.author_id]))}</small>
        </span>
      </div>`
    })
    .join('')

  const ultimo = filas ? `<div class="foro-panel"><h3>Lo último</h3>${filas}</div>` : ''
  lateral.innerHTML = ultimo

  // Los números van después y por separado: si tardan o fallan, "Lo
  // último" ya está en pantalla.
  const numeros = await panelDeNumerosHtml()
  lateral.innerHTML = ultimo + numeros
}

// ─────────────────────────────────────────────────────────────
// Los números del foro
// ─────────────────────────────────────────────────────────────
//
// Cuatro consultas de solo contar (`head: true`, sin traerse ni una
// fila) más dos pequeñas. Todas en paralelo y todas tolerantes: si
// alguna falla, esa línea no sale y las demás sí.
function filaNumero(etiqueta, valor) {
  return `<div class="foro-numero"><span>${escapeHtml(etiqueta)}</span><strong>${escapeHtml(String(valor))}</strong></div>`
}

async function contar(tabla) {
  try {
    const { count, error } = await supabase.from(tabla).select('id', { count: 'exact', head: true })
    return error ? null : count || 0
  } catch {
    return null
  }
}

async function panelDeNumerosHtml() {
  const hoy = new Date().toISOString().slice(0, 10)

  const [temas, mensajes, miembros, nuevo, porAqui] = await Promise.all([
    contar('forum_threads'),
    contar('forum_posts'),
    contar('user_profiles'),
    // El último en registrarse. `created_at` puede no existir en bases
    // antiguas, así que si da error simplemente no se enseña esa línea.
    supabase
      .from('user_profiles')
      .select('id, username, display_name')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => (error ? null : data?.[0] || null))
      .catch(() => null),
    // Quién ha pasado por aquí hoy. Sale de `last_active_date`, que ya
    // mantiene la racha diaria. Quien esconde su actividad no aparece.
    supabase
      .from('user_profiles')
      .select('id, username, display_name, hide_activity')
      .eq('last_active_date', hoy)
      .limit(40)
      .then(({ data, error }) => (error ? [] : (data || []).filter((p) => !p.hide_activity)))
      .catch(() => []),
  ])

  const lineas = [
    temas === null ? '' : filaNumero('Temas', temas),
    mensajes === null ? '' : filaNumero('Mensajes', mensajes),
    miembros === null ? '' : filaNumero('Miembros', miembros),
    nuevo
      ? `<div class="foro-numero"><span>El último</span><strong>${enlacePerfil(nuevo)}</strong></div>`
      : '',
  ]
    .filter(Boolean)
    .join('')

  const gente = porAqui.length
    ? `<div class="foro-panel">
         <h3>Por aquí hoy <span class="foro-panel-cuenta">${porAqui.length}</span></h3>
         <p class="foro-gente">${porAqui.map((p) => enlacePerfil(p)).join('<span aria-hidden="true">, </span>')}</p>
       </div>`
    : ''

  const numeros = lineas ? `<div class="foro-panel"><h3>El foro en números</h3>${lineas}</div>` : ''
  return gente + numeros
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
  const abrirTema = puedeEscribir
    ? `<button type="button" class="btn-primary" id="btnNuevoTema">${icons.edit(15)} Abrir un tema</button>`
    : `<span class="subtext">${icons.lock ? icons.lock(14) : ''} Solo el equipo abre temas aquí</span>`

  const hayNuevos = await pintarListaDeTemas(foro)
  acciones.innerHTML = botonMarcarTodoHtml(hayNuevos) + abrirTema
  await pintarLateral()

  document.getElementById('btnNuevoTema')?.addEventListener('click', () => abrirFormularioTema(foro))
  engancharMarcarTodo()
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
  // Los autores de dos cosas a la vez: quien abrió cada tema y quien
  // escribió el último mensaje. Suelen coincidir (un tema sin respuestas
  // los tiene iguales), y `perfilesPorId` ya quita los repetidos.
  const perfiles = await perfilesPorId([
    ...lista.map((t) => t.author_id),
    ...lista.map((t) => t.last_post_author_id),
  ])
  const totalPaginas = Math.max(1, Math.ceil((count || 0) / PAGINA))

  const filaTema = (t) => {
    // Un tema "sin leer" tiene mensajes posteriores a tu última visita.
    // Se marca con una clase (el título en negrita y un punto delante),
    // no con un color distinto: en una lista larga, el peso de la letra
    // se ve de un vistazo y el color no siempre.
    const sinLeer = estaSinLeer(t, marcas)
    return `
    <div class="foro-tema-fila ${t.is_pinned ? 'foro-tema-fijado' : ''} ${sinLeer ? 'foro-tema-nuevo' : ''}">
      <div class="foro-fila-icono" aria-hidden="true">${
        sinLeer ? `<span class="foro-punto-nuevo" title="Con mensajes nuevos"></span>` : ''
      }${t.is_pinned ? icons.pin?.(18) || icons.star(18) : icons.messageSquare(18)}</div>
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
      ${ultimoHtml({
        titulo: 'Ir al último',
        url: urlTema(t.id),
        fecha: t.last_post_at,
        // `last_post_author_id` llega de supabase-migration-foro-ultimo-autor.sql.
        // Sin esa migración es `undefined` y aquí se cae al autor del
        // tema: en un tema sin respuestas es exactamente el mismo, y en
        // uno con respuestas es una aproximación mucho mejor que el
        // "Alguien" que salía antes.
        perfil: perfiles[t.last_post_author_id] || perfiles[t.author_id],
      })}
    </div>`
  }

  const subforosHtml = (subforos || []).length
    ? `<section class="foro-seccion">
         <h2 class="foro-seccion-titulo">Subforos</h2>
         ${(subforos || [])
           .map(
             (s) => `
         <div class="foro-fila ${nuevosPorForo[s.id] ? 'foro-fila-nueva' : 'foro-fila-leida'}">
           <div class="foro-fila-icono" aria-hidden="true">${
             nuevosPorForo[s.id] ? `<span class="foro-punto-nuevo" title="Con mensajes nuevos"></span>` : ''
           }${icons.messageSquare(18)}</div>
           <div class="foro-fila-cuerpo">
             <h3><a href="${urlForo(s.slug)}">${escapeHtml(s.name)}</a> ${chapaNuevosHtml(nuevosPorForo[s.id])}</h3>
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

  // Se devuelve si hay algo sin leer para que la cabecera decida si
  // enseña el botón de "marcar todo como leído".
  return lista.some((t) => estaSinLeer(t, marcas))
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
      <div class="rte-wrap rte-compacta">
        <div class="rte-toolbar" id="temaBarra"></div>
        <div class="rte-surface" id="temaCuerpo"></div>
      </div>
      ${formularioEncuestaHtml()}
      <div class="foro-form-acciones">
        <button type="submit" class="btn-primary" id="btnPublicarTema">Publicar</button>
        <button type="button" class="btn-secondary" id="btnCancelarTema">Cancelar</button>
      </div>
    </form>`

  // La encuesta solo se pone AL ABRIR el tema, no después: la política
  // de la base solo la deja crear en los cinco primeros minutos.
  // Colgarle una votación a un hilo que ya tiene conversación cambia de
  // qué iba el hilo a mitad de camino.
  engancharFormularioEncuesta(document)

  const barra = document.getElementById('temaBarra')
  barra.innerHTML = richTextToolbarHtml()
  const superficieTema = document.getElementById('temaCuerpo')
  let cuerpoHtml = ''
  initRichTextEditor({
    toolbarEl: barra,
    surfaceEl: superficieTema,
    initialHtml: '',
    placeholder: 'Cuenta de qué va…',
    onChange: (html) => {
      cuerpoHtml = html
    },
    uploadImage: (file) => uploadGuideImage(sesion.user.id, file),
  })
  // El módulo se pide aquí y no arriba del todo: la lista de @ solo hace
  // falta cuando alguien abre la caja de escribir, y el índice del foro
  // lo carga todo el mundo.
  import('./mencion-autocompletar.js')
    .then((m) => m.engancharAutocompletarMenciones(superficieTema))
    .catch(() => {})

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

    // Se lee la encuesta ANTES de crear nada. Si le falta la pregunta o
    // le sobran opciones repetidas, se avisa aquí y no se publica —
    // mejor que dejar el tema abierto con media votación dentro.
    const { encuesta, error: errorEncuestaForm } = leerFormularioEncuesta(document)
    if (errorEncuestaForm) {
      showToast(errorEncuestaForm)
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

    // La encuesta va DESPUÉS del mensaje y no se deshace nada si falla:
    // el tema y su primer mensaje ya están publicados y son útiles por
    // sí solos. Tirarlos porque no se pudo crear la votación sería
    // perder lo que la persona acaba de escribir.
    if (encuesta) {
      const errorEncuesta = await crearEncuesta(tema.id, encuesta)
      if (errorEncuesta) showToast('El tema se ha publicado, pero la encuesta no. Puedes preguntarlo en el mensaje.')
    }

    window.location.href = urlTema(tema.id)
  })
}

// ─────────────────────────────────────────────────────────────
// Los resultados de una búsqueda
// ─────────────────────────────────────────────────────────────
//
// Se busca en dos sitios y se juntan: en el TÍTULO de los temas y en el
// TEXTO de los mensajes. Las dos consultas van contra `search_norm`, la
// columna plegada (sin acentos, en minúsculas) que trae
// supabase-migration-foro-mejoras.sql, así que "pikachu" encuentra
// "Pikachu" y "reimpresion" encuentra "reimpresión".
const MAX_RESULTADOS = 25

function trozoConLaPalabra(texto, aguja) {
  const plano = String(texto || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const donde = plegarTexto(plano).indexOf(aguja)
  if (donde === -1) return plano.slice(0, 160)
  // Un poco de texto por delante para que el trozo no empiece a media
  // palabra y se entienda de qué habla.
  const desde = Math.max(0, donde - 60)
  return (desde > 0 ? '…' : '') + plano.slice(desde, desde + 200) + (plano.length > desde + 200 ? '…' : '')
}

async function pintarBusqueda() {
  migas.innerHTML = migasHtml([
    { texto: 'Inicio', url: '/' },
    { texto: 'Foro', url: '/foro' },
    { texto: 'Buscar' },
  ])
  document.getElementById('foroTitulo').textContent = `Buscar: ${consulta}`
  document.getElementById('foroSubtitulo').textContent = 'En los títulos de los temas y en el texto de los mensajes.'
  acciones.innerHTML = ''
  lateral.innerHTML = ''

  const aguja = plegarTexto(consulta)
  const patron = `%${aguja}%`

  const [porTitulo, porMensaje] = await Promise.all([
    supabase
      .from('forum_threads')
      .select('id, title, prefix, last_post_at, post_count')
      .ilike('search_norm', patron)
      .order('last_post_at', { ascending: false })
      .limit(MAX_RESULTADOS),
    supabase
      .from('forum_posts')
      .select('id, thread_id, author_id, body_html, created_at')
      .ilike('search_norm', patron)
      .order('created_at', { ascending: false })
      .limit(MAX_RESULTADOS),
  ])

  // Si la columna no existe todavía (migración sin ejecutar), se dice en
  // vez de enseñar "no hay resultados", que sería mentira.
  if (faltaLaBusqueda(porTitulo.error) || faltaLaBusqueda(porMensaje.error)) {
    principal.innerHTML = `<p class="empty-state">El buscador del foro todavía no está activado.</p>`
    return
  }

  const temas = porTitulo.data || []
  const mensajes = porMensaje.data || []
  const perfiles = await perfilesPorId(mensajes.map((m) => m.author_id))

  // Los temas de los mensajes encontrados, para poder poner su título.
  const idsTema = [...new Set(mensajes.map((m) => m.thread_id))]
  const temasDeMensajes = idsTema.length
    ? (await supabase.from('forum_threads').select('id, title').in('id', idsTema)).data || []
    : []
  const tituloDe = Object.fromEntries(temasDeMensajes.map((t) => [t.id, t.title]))

  if (!temas.length && !mensajes.length) {
    principal.innerHTML = `<p class="empty-state">No hay nada con “${escapeHtml(consulta)}”. Prueba con una palabra más corta.</p>`
    return
  }

  const bloqueTemas = temas.length
    ? `<section class="foro-seccion">
         <h2 class="foro-seccion-titulo">Temas (${temas.length})</h2>
         ${temas
           .map(
             (t) => `
           <div class="foro-fila foro-resultado">
             <div class="foro-fila-icono" aria-hidden="true">${icons.messageSquare(18)}</div>
             <div class="foro-fila-cuerpo">
               <h3>${etiquetaHtml(t.prefix)} <a href="${urlTema(t.id)}">${escapeHtml(t.title)}</a></h3>
               <p class="subtext">${Math.max(0, (t.post_count || 1) - 1)} respuestas · ${escapeHtml(haceCuanto(t.last_post_at))}</p>
             </div>
           </div>`
           )
           .join('')}
       </section>`
    : ''

  const bloqueMensajes = mensajes.length
    ? `<section class="foro-seccion">
         <h2 class="foro-seccion-titulo">Mensajes (${mensajes.length})</h2>
         ${mensajes
           .map(
             (m) => `
           <div class="foro-fila foro-resultado">
             <div class="foro-fila-icono" aria-hidden="true">${avatarHtml(perfiles[m.author_id], 26)}</div>
             <div class="foro-fila-cuerpo">
               <h3><a href="${urlTema(m.thread_id)}#mensaje-${m.id}">${escapeHtml(tituloDe[m.thread_id] || 'Ver el mensaje')}</a></h3>
               <p class="foro-resultado-trozo">${escapeHtml(trozoConLaPalabra(m.body_html, aguja))}</p>
               <p class="subtext">${escapeHtml(nombreDe(perfiles[m.author_id]))} · ${escapeHtml(haceCuanto(m.created_at))}</p>
             </div>
           </div>`
           )
           .join('')}
       </section>`
    : ''

  principal.innerHTML = bloqueTemas + bloqueMensajes
}

// La columna `search_norm` llega con la migración de mejoras. Si no
// está, Postgres devuelve 42703 (columna inexistente).
function faltaLaBusqueda(error) {
  return !!error && (error.code === '42703' || /search_norm/.test(error.message || ''))
}

// ─────────────────────────────────────────────────────────────
// El buscador
// ─────────────────────────────────────────────────────────────
//
// Los resultados salen en el propio /foro?q=..., no en una página nueva:
// es el mismo sitio, con la misma cabecera y las mismas migas, y así el
// botón de atrás del navegador hace lo que se espera.
function engancharBuscador() {
  const form = document.getElementById('foroBuscador')
  const campo = document.getElementById('foroBuscadorTexto')
  if (!form || !campo) return
  campo.value = consulta || ''
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const q = campo.value.trim()
    // Sin texto se vuelve al foro, que es lo que espera quien acaba de
    // vaciar la caja y darle a Enter.
    window.location.href = q ? `/foro?q=${encodeURIComponent(q)}` : '/foro'
  })
}

async function init() {
  sesion = await getSession()
  if (sesion) {
    soyStaff = await esDelEquipo(sesion)
    marcas = await marcasDeLectura(sesion.user.id)
    nuevosPorForo = await sinLeerPorForo(marcas)
  }
  engancharBuscador()
  if (consulta) await pintarBusqueda()
  else if (slugForo) await pintarForo()
  else await pintarIndice()
}

init().catch(() => {
  principal.innerHTML = `<p class="empty-state">No se ha podido cargar el foro.</p>`
})
