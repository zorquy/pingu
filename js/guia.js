import { supabase } from './supabase.js'
import { rutaDeArticulo, fechaLarga, fechaMaquina, slugDeArticuloEnLaUrl, conVueltaAtrasDeTipo } from './articulos.js'
import { escapeHtml, getInitial, getSession, getProfile, profileUrl, avatarStyle } from './app.js'
import { guideHasCourse } from './guia-contenido.js'
import { renderReferenceBlocksHtml } from './bloques-lectura.js'
import { hydrateDecks } from './cards-block.js'
import { hydrateVideos } from './video-youtube.js'
import { initGuideForum } from './guide-forum.js'
import { markGuideRead, READ_XP } from './gamification.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { MOSTRAR_PLANES } from './planes.js'
import { montarBotonHelpful } from './guide-helpful.js'
import { compartirHtml } from './compartir.js'
import { contributorBadgeHtml } from './contributor-badge.js'
import { montarSugerencia, creditosHtml } from './guide-suggestions.js'
import { laVeLaGente, estadoDeGuia } from './guia-estado.js'
import { atributosDeRango, COLUMNAS_RANGO } from './rangos.js'
import { portadaDeArticuloHtml, importanteHtml, minutosQueQuedan, numerarApartados, indiceHtml } from './articulo-cabecera.js'


const slug = slugDeArticuloEnLaUrl()


// CAMBIA YA, CONFIRMA DESPUÉS, DESHAZ SI FALLA (896, R6): el marcador se
// pinta como queda en el acto y la base lo confirma detrás; antes se
// esperaban dos consultas antes de cambiar el dibujo.
const pintarGuardada = (btn, guardada) => {
  btn.innerHTML = guardada ? icons.bookmark(16, true) : icons.bookmark(16)
  btn.setAttribute('aria-label', guardada ? 'Guardada · quitar de guardados' : 'Guardar')
}
async function toggleSave(session, guideId, btn) {
  const estaba = btn.getAttribute('aria-label') !== 'Guardar'
  pintarGuardada(btn, !estaba)
  if (!estaba) import('./efectos.js').then(({ latir }) => latir(btn)).catch(() => {})
  // Los guardados son privados desde la 1306: se leen y se escriben por su sitio.
  const { cambiarGuardada } = await import('./perfil-privado.js')
  const { error } = await cambiarGuardada(supabase, session.user.id, guideId, !estaba)
  if (error) {
    pintarGuardada(btn, estaba)
    showToast('No se ha podido guardar. Vuelve a intentarlo.')
  }
}

// Marcar una guía como leída solo por abrirla sería regalar el XP: se
// espera a que el final del artículo entre en pantalla Y a que haya
// pasado un tiempo mínimo, para que no cuente quien baja de golpe hasta
// los comentarios.
const MIN_READ_SECONDS = 15

function setupReadTracking(session, guide, esNoticia = false) {
  if (!session) return
  const sentinel = document.getElementById('articleEndSentinel')
  if (!sentinel || typeof IntersectionObserver === 'undefined') return

  const openedAt = Date.now()
  let done = false
  let timer = null

  async function marcar() {
    if (done) return
    done = true
    observer.disconnect()
    if (timer) clearTimeout(timer)
    try {
      const esNueva = await markGuideRead(session.user.id, guide.id)
      // El XP se da igual —leer es leer—, pero el aviso no puede
      // llamarle «guía» a una noticia.
      if (esNueva) showToast(`${esNoticia ? 'Noticia leída' : 'Guía leída'} · +${READ_XP} XP`, 'success')
    } catch {
      // Ya queda registrado en client_errors. No se avisa al usuario:
      // ha venido a leer, no a que le demos la turra con el XP.
    }
  }

  const observer = new IntersectionObserver((entries) => {
    if (done) return
    const visible = entries.some((e) => e.isIntersecting)
    if (!visible) {
      // Ha vuelto a subir antes de tiempo: se cancela la cuenta atrás.
      if (timer) { clearTimeout(timer); timer = null }
      return
    }
    const falta = MIN_READ_SECONDS * 1000 - (Date.now() - openedAt)
    if (falta <= 0) { marcar(); return }
    // En una guía corta el final ya se ve nada más abrir, y el
    // observador NO vuelve a dispararse porque la intersección no
    // cambia. Sin este temporizador, esas guías no se marcarían nunca.
    if (!timer) timer = setTimeout(marcar, falta)
  })
  observer.observe(sentinel)
}

// SIGUE LEYENDO (866; portadas desde la 1283): al acabar, tres más del mismo
// tema —o, en una noticia, las tres últimas noticias— con la portada de
// /aprender (js/guia-portada.js, su hoja la carga guia.html).
async function pintarMasDelTema(guide, esNoticia) {
  const caja = document.getElementById('guiaMasDelTema')
  if (!caja) return
  const COLS = 'id, slug, title, description, kind, level, estimated_mins, blocks, cover_image, published_at, category_id'
  const pedir = (filtrar) => {
    let q = supabase.from('guides').select(COLS).neq('id', guide.id).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(3)
    if (esNoticia) return q.eq('kind', 'news')
    q = q.eq('category_id', guide.category_id)
    return filtrar ? q.eq('kind', 'guide') : q
  }
  const { data } = esNoticia ? await pedir(true) : await conVueltaAtrasDeTipo(() => pedir(true), () => pedir(false))
  if (!data?.length) return
  const { portadaDeGuia } = await import('./guia-portada.js')
  const tema = guide.categories || {}
  const nombre = tema.name || tema.slug || 'este tema'
  const temaDe = esNoticia ? { nombre: 'Noticia', slug: 'noticias' } : { nombre, slug: tema.slug }
  caja.innerHTML = `
    <div class="guia-mas-tema-cab">
      <h2 class="guia-mas-tema-titulo">${esNoticia ? 'Más noticias' : `Sigue leyendo en ${escapeHtml(nombre)}`}</h2>
      ${esNoticia ? '<a class="link-btn guia-mas-tema-todo" href="/noticias">Todas →</a>' : tema.slug ? `<a class="link-btn guia-mas-tema-todo" href="/aprender?tema=${encodeURIComponent(tema.slug)}">Todo el tema →</a>` : ''}
    </div>
    <div class="guia-mas-tema-lista">${data.map((g) => portadaDeGuia(g, { tema: temaDe })).join('')}</div>`
  caja.classList.remove('hidden')
}

// QUIEN LA ESCRIBE, al final (1283): su nombre con la chapa, cuántas guías
// tiene publicadas y «Seguir» (lo mismo que la tarjeta flotante, hovercard.js).
function autorFinalHtml(author, nombre, estiloAvatar) {
  return `
    <a class="mini-avatar gf-avatar" href="${profileUrl(author)}" style="${estiloAvatar}" aria-hidden="true" tabindex="-1">${author.avatar_url ? '' : getInitial(nombre)}</a>
    <div class="gf-autor-texto">
      <span class="gf-autor-quien">Escrita por</span>
      <a class="gf-autor-nombre" href="${profileUrl(author)}"${atributosDeRango(author)}>${escapeHtml(nombre)}</a>${author.is_writer ? '<span class="guia-chapa-redaccion">Redacción</span>' : ''}
      <span class="gf-autor-cuenta" id="guiaAutorCuenta"></span>
    </div>
    <div class="gf-autor-botones">
      <button type="button" class="btn-primary gf-seguir hidden" id="guiaSeguir">Seguir</button>
      <a class="btn-secondary" href="${profileUrl(author)}?ver=guides">Ver sus guías</a>
    </div>`
}

async function montarAutorFinal(author, session) {
  const cuenta = document.getElementById('guiaAutorCuenta')
  const boton = document.getElementById('guiaSeguir')
  if (!cuenta || !boton) return
  const { count } = await supabase.from('guides').select('id', { count: 'exact', head: true }).eq('author_id', author.id).eq('kind', 'guide').not('published_at', 'is', null)
  if (count) cuenta.textContent = `${count} ${count === 1 ? 'guía publicada' : 'guías publicadas'} en PokeDoc`
  if (session?.user.id === author.id) return
  if (!session) {
    boton.classList.remove('hidden')
    boton.addEventListener('click', () => { window.location.href = `/auth.html?volver=${encodeURIComponent(location.pathname)}` })
    return
  }
  const { data } = await supabase.from('user_follows').select('follower_id').eq('follower_id', session.user.id).eq('following_id', author.id).maybeSingle()
  let sigo = !!data
  const pintar = () => {
    boton.classList.toggle('btn-primary', !sigo)
    boton.classList.toggle('btn-secondary', sigo)
    boton.textContent = sigo ? 'Siguiendo' : 'Seguir'
  }
  pintar()
  boton.classList.remove('hidden')
  // Cambia ya, confirma después y deshace si falla (896, R6).
  boton.addEventListener('click', async () => {
    sigo = !sigo
    pintar()
    const { error } = sigo
      ? await supabase.from('user_follows').insert({ follower_id: session.user.id, following_id: author.id })
      : await supabase.from('user_follows').delete().eq('follower_id', session.user.id).eq('following_id', author.id)
    if (error) { sigo = !sigo; pintar(); showToast('No se ha podido. Vuelve a intentarlo.') }
  })
}

async function init() {
  const main = document.getElementById('articleMain')

  // Si el servidor ya dejó el artículo pintado (tanda 270), no se pisa
  // con un error.
  //
  // Es lo que pasó al estrenar las noticias: el servidor puso el texto
  // bien y el JavaScript, que no encontraba el slug, lo sustituyó por
  // «Guía no encontrada». O sea que el fallo del cliente se llevó por
  // delante una página que YA ESTABA BIEN. Con Supabase caído pasaría
  // igual. Mejor un artículo sin sus botones que un artículo que no
  // está.
  const loPintoElServidor = () => !!main.querySelector('h1')
  // Sin ella, el molde de lo que no existe con salida (1149, C2): el
  // buscador relleno con las palabras de la dirección y las parecidas.
  const noEncontrada = () => {
    if (loPintoElServidor()) return
    // Se vuelve a mirar al llegar el módulo: en ese rato el servidor puede
    // haber dejado el artículo puesto, y eso manda.
    import('./no-encontrado.js').then((m) => { if (!loPintoElServidor()) m.pintarNoEncontrado(main, { tipo: location.pathname.startsWith('/noticias/') ? 'noticia' : 'guia', trozo: slug }) }).catch(() => { if (!loPintoElServidor()) main.innerHTML = `<p class="empty-state">Guía no encontrada.</p>` })
  }

  if (!slug) {
    noEncontrada()
    return
  }

  const { data: guide, error } = await supabase
    .from('guides')
    .select('*, categories(*)')
    .eq('slug', slug)
    .single()

  // «No existe» y «no se ha podido preguntar» son dos cosas (la 510):
  // `single` sin fila es PGRST116; otro error es la red o la base.
  if (error && error.code !== 'PGRST116') {
    if (!loPintoElServidor()) import('./no-encontrado.js').then((m) => { if (!loPintoElServidor()) m.pintarSinRespuesta(main, 'la guía') }).catch(() => {})
    return
  }
  if (!guide) {
    noEncontrada()
    return
  }

  // Una noticia es este mismo artículo con otro traje: otra sección, otra
  // dirección y otros datos estructurados. El texto, el índice y el
  // editor son los mismos — porque es lo mismo.
  const esNoticia = guide.kind === 'news'

  // UNA dirección por artículo. Se puede llegar a una noticia por
  // /guia.html?slug=… (un enlace viejo, que llega por el 301), pero
  // la buena es /noticias/<slug>: se corrige la barra de direcciones sin
  // recargar y se apunta ahí la canónica, que es lo que evita que Google
  // vea dos páginas con el mismo texto.
  if (esNoticia) {
    const buena = rutaDeArticulo('news', guide.slug)
    if (window.location.pathname + window.location.search !== buena) {
      history.replaceState(null, '', buena)
    }
    let canonica = document.querySelector('link[rel="canonical"]')
    if (!canonica) {
      canonica = document.createElement('link')
      canonica.rel = 'canonical'
      document.head.appendChild(canonica)
    }
    canonica.href = `https://pokedoc.es${buena}`
  }

  document.title = `${guide.title} — PokeDoc`
  supabase.from('guides').update({ view_count: (guide.view_count || 0) + 1 }).eq('id', guide.id)

  // Una NOTICIA no la firma nadie (tanda 289).
  //
  // La guía la escribe una persona y ponerle su nombre es el pago: sale
  // en la portada de quien la lee y le cuenta como colaboración. Una
  // noticia no — es del sitio. Que ponga «Publicada por PINGU» hace que
  // parezca la opinión de alguien en vez de lo que ha pasado, y encima
  // deja la sección atada a una persona el día que la escriba otra.
  //
  // `author_id` se sigue guardando: hace falta para los permisos de
  // edición. Lo que cambia es lo que se ENSEÑA.
  let author = null
  if (guide.author_id && !esNoticia) {
    // `is_writer` (Redacción, 1282) se pide con respaldo: sin la migración la
    // columna no existe y la consulta entera fallaría (la 624).
    const pedir = (extra) => supabase
      .from('user_profiles')
      .select(`id, display_name, username, avatar_url, ${COLUMNAS_RANGO}${extra}`)
      .eq('id', guide.author_id)
      .single()
    let { data, error: e } = await pedir(', is_writer')
    if (e && /is_writer|column/i.test(e.message || '')) ({ data } = await pedir(''))
    author = data
  }
  const authorName = author ? author.display_name || author.username || 'un colaborador' : 'PokeDoc'
  const authorAvatarStyle = avatarStyle(author)
  // El rango de colaborador se enseña AQUÍ, junto al nombre, y no solo
  // en el perfil: el reconocimiento que hay que ir a buscar no
  // recompensa a nadie. Esta es la única pantalla donde a un autor lo
  // lee gente que no lo conoce.
  const authorBadge = author ? await contributorBadgeHtml(author.id) : ''
  // Quién ha ayudado a mejorarla. Va aquí, junto a la firma, porque es
  // donde se mira quién está detrás de lo que estás leyendo.
  const creditos = await creditosHtml(guide.id).catch(() => '')
  const opHeaderHtml = `
    <div class="guide-author">
      ${
        author
          ? `<a class="mini-avatar" href="${profileUrl(author)}" style="width:36px; height:36px; font-size:14px; ${authorAvatarStyle}">${author.avatar_url ? '' : getInitial(authorName)}</a>`
          : `<span class="mini-avatar" style="width:36px; height:36px; background-color:var(--navy); color:var(--white); display:flex; align-items:center; justify-content:center;">${esNoticia ? icons.newspaper(18) : icons.shield(18)}</span>`
      }
      <div>
        <span class="subtext" style="margin:0; display:block;">${
          // "Publicada por" es falso mientras está en revisión: no está
          // publicada. Se dice lo que sí es cierto — que la ha escrito.
          author ? (guide.review_status === 'pending' ? 'Escrita por' : 'Publicada por') : esNoticia ? 'Noticia de' : 'Guía oficial de'
        }</span>
        ${author ? `<a href="${profileUrl(author)}"${atributosDeRango(author, 'font-weight:700; color:var(--navy)')}>${escapeHtml(authorName)}</a>${author.is_writer ? '<span class="guia-chapa-redaccion" title="Redacción de PokeDoc">Redacción</span>' : ''}${authorBadge}` : `<strong>${escapeHtml(authorName)}</strong>`}
      </div>
    </div>`

  const session = await getSession()
  const profile = session ? await getProfile(session.user.id) : null
  // ¿La está mirando quien la escribió? Se usa para ofrecerle seguir
  // editándola desde aquí mismo.
  const esMia = !!(session && guide.author_id && guide.author_id === session.user.id)
  // `mostrarPro` manda sobre todo lo de esta guía: si los planes están
  // ocultos no hay pestaña, no hay muro y ni siquiera se pide el contenido
  // Pro a la base — una consulta menos por visita.
  const mostrarPro = MOSTRAR_PLANES && guide.has_pro_content
  const proContent = mostrarPro
    ? (await supabase.from('guide_pro_content').select('*').eq('guide_id', guide.id).maybeSingle()).data
    : null

  const hasContent = Array.isArray(guide.reference_blocks) && guide.reference_blocks.length > 0
  // Las dos mitades de una guía —la teoría y el curso— viven en páginas
  // distintas y hasta ahora no se enlazaban entre sí: se leía la guía y
  // no había manera de enterarse de que existía un curso encima.
  const hayCurso = guideHasCourse(guide)

  const headings = []
  const bodyHtml = hasContent
    ? renderReferenceBlocksHtml(guide.reference_blocks, headings)
    // La descripción ya va debajo del título: repetirla aquí era decir lo
    // mismo dos veces en las guías que son solo curso (787, PA5).
    // Con curso y sin texto, la tarjeta del curso ya lo dice (1014).
    : guideHasCourse(guide) ? '' : '<p class="subtext">Esta guía todavía no tiene contenido de referencia.</p>'

  // Los minutos de lectura se calculan del texto de verdad (unas 200
  // palabras por minuto), no del numerito que puso el autor al crearla:
  // ese se queda viejo en cuanto la guía crece o encoge. Sin contenido
  // todavía, vale el del autor.
  const palabras = hasContent ? bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length : 0
  const minutosLectura = hasContent ? Math.max(1, Math.round(palabras / 200)) : guide.estimated_mins || 5

  const proBodyHtml = mostrarPro
    ? proContent
      ? renderReferenceBlocksHtml(proContent.blocks)
      : `
      <div class="empty-state pro-paywall">
        <span style="display:flex; justify-content:center;">${icons.star(32)}</span>
        <p style="margin-top: 8px;">Este contenido es exclusivo para usuarios Pro: ejemplos, consejos y trucos avanzados aparte de la documentación gratuita.</p>
        ${session ? '' : `<a href="/auth.html" class="btn-primary" style="margin-top:12px;">Inicia sesión</a>`}
      </div>`
    : ''

  // LA PORTADA (1283): la misma que pinta el servidor (js/articulo-cabecera.js)
  // y, debajo, la franja de quien la firma con lo que se tarda y los botones.
  // Lo de debajo de la franja (créditos, «Lo importante», el índice del móvil)
  // va en la misma caja de arriba, a lo ancho en el PC.
  const apartados = numerarApartados(headings).filter((h) => h.n).length
  const indiceMovil = headings.length >= 2
    ? `<details class="gi-movil">
        <summary>${icons.listOrdered(16)}<span>${apartados} ${apartados === 1 ? 'apartado' : 'apartados'}</span><span class="gi-barra" aria-hidden="true"><i></i></span><span class="gi-queda-corto">${minutosLectura} min</span></summary>
        <ol class="gi-lista">${indiceHtml(headings)}</ol>
      </details>`
    : ''
  main.innerHTML = `
    <div class="gh-arriba">
      ${
        // Una guía sin publicar se veía EXACTAMENTE igual que una
        // publicada, y de ahí venía el lío: creer que tienes una guía viva
        // que no aparece en ningún sitio. Si lo que estás mirando no lo ve
        // nadie más, la página lo dice.
        !laVeLaGente(guide)
          ? `<p class="subtext guia-aviso-borrador">${icons.clock(14)} <span>Vista previa · <strong>${escapeHtml(
              estadoDeGuia(guide).texto
            )}</strong> — esto no lo ve nadie más que tú y el equipo. No sale en la web ni en los buscadores.</span>${
              esMia
                ? `<a class="btn-secondary guia-seguir-editando" href="/editor-guia.html?id=${encodeURIComponent(guide.id)}">${icons.edit(14)} Seguir editando</a>`
                : ''
            }</p>`
          : ''
      }
      ${
        guide.review_status === 'pending'
          ? `<p class="subtext guia-aviso-pendiente">${icons.clock(14)} <span>Guía de la comunidad pendiente de revisión — todavía no la ha comprobado el equipo de PokeDoc.</span>${
              // Si quien la está mirando es quien la escribió, el aviso
              // deja de ser solo información y se convierte en el sitio
              // desde el que seguir. Es la pantalla donde el autor
              // relee lo que lleva escrito, así que es donde tiene que
              // estar el botón — no escondido en su perfil.
              esMia
                ? `<a class="btn-secondary guia-seguir-editando" href="/editor-guia.html?id=${encodeURIComponent(guide.id)}">${icons.edit(14)} Seguir editando</a>`
                : ''
            }</p>`
          : ''
      }
      ${portadaDeArticuloHtml(guide, { tema: guide.categories })}
      <div class="gh-franja">
        ${opHeaderHtml}
        <div class="gh-datos">
          ${
            // En una noticia lo primero que se mira es CUÁNDO. El <time>
            // con `datetime` no es decoración: es de donde Google saca la
            // fecha de publicación.
            esNoticia
              ? `<time class="time-tag gh-dato" datetime="${escapeHtml(fechaMaquina(guide.published_at))}">${escapeHtml(fechaLarga(guide.published_at))}</time>`
              : ''
          }
          <span class="gh-dato" title="Tiempo de lectura estimado">${icons.clock(14)} ${minutosLectura} min</span>
          ${apartados >= 2 ? `<span class="gh-dato">${icons.listOrdered(14)} ${apartados} apartados</span>` : ''}
          ${MOSTRAR_PLANES && !esNoticia ? `<span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>` : ''}
        </div>
        <div class="guia-acciones">
          <button class="btn-secondary guia-accion-icono" id="btnSave" aria-label="Guardar">${icons.bookmark(16)}</button>
          ${
            // Compartir va aquí, junto a Guardar, y se le enseña también
            // a quien no tiene cuenta: es justo quien acaba de llegar de
            // fuera y quiere pasársela a alguien.
            compartirHtml('btnCompartir', { clase: 'btn-secondary guia-accion-icono', texto: '' })
          }
          ${
            // Y si la guía es tuya y ya está publicada, a editarla desde
            // aquí. Es donde su autor la relee y donde ve la errata.
            esMia && guide.review_status === 'approved'
              ? `<a class="btn-secondary guia-editar-mia" href="/editor-guia.html?id=${encodeURIComponent(guide.id)}">${icons.edit(14)} Editar</a>`
              : ''
          }
        </div>
      </div>
      ${creditos}
      ${importanteHtml(guide)}
      ${indiceMovil}
    </div>
    ${
      // UNA sola llamada al curso (1014, L5), antes del texto: una tarjeta
      // con el borde de la casa. Antes eran tres —un botón arriba, una frase
      // y una caja morada abajo— antes de leer una línea. `guia-ir-al-curso`
      // sigue en el botón: es el asidero de las pruebas 548 y 549.
      hayCurso
        ? `
    <div class="guia-cta-curso">
      <div>
        <h2>Esta guía tiene curso</h2>
        <p class="subtext">Preguntas, racha y medalla · ${guide.estimated_mins || 5} min</p>
      </div>
      <a class="btn-primary guia-ir-al-curso" href="/curso.html?slug=${encodeURIComponent(guide.slug)}">${icons.zap(15)} Hacer el curso</a>
    </div>`
        : ''
    }
    ${
      mostrarPro
        ? `
    <div class="tabs" id="articleTabs">
      <button class="tab-btn active" data-atab="docu">${icons.bookOpen(15)} Básico</button>
      <button class="tab-btn" data-atab="pro">${icons.star(15)} Guía Pro</button>
    </div>
    <div class="tab-panel active" id="atab-docu"><div class="article-body">${bodyHtml}</div></div>
    <div class="tab-panel" id="atab-pro"><div class="article-body">${proBodyHtml}</div></div>`
        : `<div class="article-body">${bodyHtml}</div>`
    }
    <div id="articleEndSentinel" aria-hidden="true"></div>
    <div class="gf">
      ${
        // EL FINAL (1283): quien la escribe (con «Seguir») y «Me ha servido»
        // en una fila; debajo, «También en…» (Redacción, la 1282) y «Sigue
        // leyendo». Antes el artículo se acababa sin más.
        author && !esNoticia ? `<div class="gf-autor" id="guiaAutor">${autorFinalHtml(author, authorName, authorAvatarStyle)}</div>` : ''
      }
      <div class="gf-servido">
        <div id="guideHelpful"></div>
        <div id="guideSuggestion"></div>
      </div>
    </div>
    ${tambienEnHtml(guide)}
    <div class="guia-mas-tema hidden" id="guiaMasDelTema"></div>
    <div id="guideWriteInvite"></div>
    <section class="guide-forum">
      <h2 class="section-title">${icons.messageSquare(18)} Comentarios</h2>
      <div id="forumContainer"></div>
    </section>`

  // LA BARRA PEGADA DEL MÓVIL (858): al bajar por la guía, la flecha de
  // volver, el título y lo que queda de lectura. Solo en el móvil, y por
  // `import()` para que el ordenador no la baje.
  if (window.matchMedia?.('(max-width: 900px)').matches) {
    import('./barra-pegada.js').then((m) => {
      const cuerpo = main.querySelector('.article-body')
      m.montarBarraPegada({
        cabecera: main.querySelector('.article-header'),
        titulo: guide.title,
        volverHref: esNoticia ? '/noticias' : guide.categories?.slug ? `/aprender?tema=${encodeURIComponent(guide.categories.slug)}` : '/aprender',
        volverTexto: esNoticia ? 'Volver a Noticias' : 'Volver a las guías',
        cifra: () => (cuerpo ? m.loQueQueda(minutosLectura, m.fraccionDe(cuerpo)) : ''),
        progreso: cuerpo,
        // El índice (1139, G1): en el móvil no se ve el de al lado.
        indice: headings,
      })
    }).catch(() => {})
  }

  // El glosario (792, NU11): la primera vez que sale un término, subrayado.
  import('./glosario.js').then((m) => { const vistos = new Set(); main.querySelectorAll('.article-body').forEach((c) => m.subrayarGlosario(c, vistos)) }).catch(() => {})

  document.getElementById('articleTabs')?.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('articleTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel[id^="atab-"]').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`atab-${btn.dataset.atab}`).classList.add('active')
    })
  })

  // Las listas de cartas se guardan solo como identificadores; aquí se
  // rellenan con los datos de nuestra tabla. Va con .catch() porque una
  // lista que no cargue no puede tumbar el resto de la guía.
  hydrateDecks(main).catch(() => {})
  // Los vídeos: pinta la portada, y el iframe no se carga hasta que
  // alguien lo pulsa. Ver js/video-youtube.js.
  hydrateVideos(main)
  // Los spoilers: que seleccionar sobre la pestaña no los pliegue y que
  // copiar por encima de uno cerrado no se lleve lo oculto.
  import('./spoilers.js').then((m) => m.engancharSpoilers(main)).catch(() => {})
  // Los enlaces internos pegados a pelo se convierten en tarjetitas.
  import('./enlaces-internos.js').then((m) => m.enriquecerEnlacesInternos(main)).catch(() => {})

  // "Me ha servido" es la única señal de una guía desde la 974 (la caja
  // «¿Te ha servido? Sí / No tanto» de debajo preguntaba lo mismo). En una
  // noticia dice «Me gusta» (973).
  montarBotonHelpful(document.getElementById('guideHelpful'), guide, session).catch(() => {})

  // Sugerir una corrección va DESPUÉS de agradecer, y en tono menor: la
  // mayoría viene a leer, no a corregir. Pero quien ve un fallo lo ve
  // justo aquí, al terminar.
  montarSugerencia(document.getElementById('guideSuggestion'), guide, session).catch(() => {})

  // MÁS DE ESTE TEMA (866): al acabar de leer, tres guías más del mismo
  // tema y el enlace al tema entero; es el «siguiente reto» de la 860
  // llevado a las guías. Antes una guía terminaba en la valoración.
  if (esNoticia || guide.category_id) void pintarMasDelTema(guide, esNoticia)
  if (author && !esNoticia) montarAutorFinal(author, session).catch(() => {})

  // Invitación a escribir, al terminar de leer.
  //
  // Va aquí y no en un banner de la home porque el momento importa: quien
  // acaba de leerse una guía entera sobre un tema es justo quien puede
  // pensar "pues de esto yo sé otra cosa". En la home, la misma frase le
  // llega a alguien que todavía no sabe ni de qué va el sitio.
  //
  // Se le enseña solo a quien ha iniciado sesión: a quien está de paso,
  // pedirle que escriba una guía antes de tener cuenta es pedirle dos
  // cosas a la vez, y no hace ninguna.
  //
  // Tampoco en una noticia: quien acaba de leer que sale una película no
  // está pensando en escribir una guía, y encima da a entender que lo
  // que acaba de leer era una.
  const invitacion = document.getElementById('guideWriteInvite')
  if (invitacion && session && !esNoticia) {
    invitacion.innerHTML = `
      <p class="write-invite">
        ${icons.edit(14)} ¿Sabes algo que no está en PokeDoc?
        <a href="/editor-guia.html">Escribe tu propia guía</a> — no hace falta
        terminarla de una sentada, se guarda sola.
      </p>`
  }

  // EL ÍNDICE (1283): numerado, con lo leído marcado, la barra de lectura y
  // los minutos que quedan. En el PC va al lado; en el móvil, la píldora de
  // arriba (`.gi-movil`) lleva la misma barra y la misma lista.
  if (headings.length > 0) {
    document.getElementById('articleSidebar').innerHTML = `
      <div class="gi-caja">
        <h4>En esta ${esNoticia ? 'noticia' : 'guía'}</h4>
        <div class="gi-barra" aria-hidden="true"><i></i></div>
        <ol class="gi-lista">${indiceHtml(headings)}</ol>
        <p class="gi-queda" id="giQueda">${minutosLectura} min de lectura</p>
      </div>`

    // La sección actual es la última cuyo título ya pasó por debajo de la
    // barra. Se mira en scroll y no con IntersectionObserver a propósito:
    // con secciones más altas que la pantalla, el observador pierde el
    // título de vista y el índice se quedaría sin sección a mitad.
    const cuerpo = main.querySelector('.article-body')
    const pasos = [...document.querySelectorAll('#articleSidebar .gi-paso, .gi-movil .gi-paso')]
    const barras = [...document.querySelectorAll('.gi-barra i')]
    const queda = document.getElementById('giQueda')
    const quedaCorto = main.querySelector('.gi-queda-corto')
    const titulos = headings.map((h) => document.getElementById(h.id))
    const marcarSeccion = () => {
      let actual = 0
      titulos.forEach((t, i) => {
        if (t && t.getBoundingClientRect().top <= 140) actual = i
      })
      pasos.forEach((a) => {
        const i = Number(a.dataset.i)
        a.classList.toggle('activo', i === actual)
        a.classList.toggle('hecho', i < actual)
      })
      if (!cuerpo) return
      const r = cuerpo.getBoundingClientRect()
      const fraccion = r.height > 0 ? (window.innerHeight * 0.6 - r.top) / r.height : 0
      const pct = Math.round(Math.min(1, Math.max(0, fraccion)) * 100)
      barras.forEach((b) => { b.style.width = `${pct}%` })
      const min = minutosQueQuedan(minutosLectura, fraccion)
      const texto = pct <= 0 ? `${minutosLectura} min de lectura` : min > 0 ? `Te quedan unos ${min} min` : 'Ya casi está'
      if (queda) queda.textContent = texto
      if (quedaCorto) quedaCorto.textContent = pct <= 0 ? `${minutosLectura} min` : min > 0 ? `${min} min` : 'Listo'
    }
    window.addEventListener('scroll', marcarSeccion, { passive: true })
    marcarSeccion()
  }

  const btnSave = document.getElementById('btnSave')
  if (!session) {
    btnSave.addEventListener('click', () => (window.location.href = 'auth.html'))
  } else {
    btnSave.addEventListener('click', () => toggleSave(session, guide.id, btnSave))
    // Si está guardada llega aparte (privado, 1306): sin esperarlo para pintar.
    import('./perfil-privado.js')
      .then(({ leerPrivado }) => leerPrivado(supabase, session.user.id))
      .then((p) => { if ((p.saved_guides || []).includes(guide.id) && btnSave.getAttribute('aria-label') === 'Guardar') pintarGuardada(btnSave, true) })
      .catch(() => {})
  }

  // Una noticia se comparte con su hoja (880): el texto para X, la
  // portada dibujada y «Publicar en X». Una guía, como siempre.
  if (esNoticia) {
    document.getElementById('btnCompartir')?.addEventListener('click', async () => {
      const { compartirNoticia } = await import('./noticia-compartir.js')
      compartirNoticia(guide)
    })
  } else {
    // Una guía, con su portada dibujada (1336): la misma pieza que saca el
    // equipo en /admin → Redes, en la hoja de compartir.
    document.getElementById('btnCompartir')?.addEventListener('click', async () => {
      const [{ piezaDeGuia }, { compartirPieza }] = await Promise.all([import('./redes-textos.js'), import('./redes-compartir.js')])
      compartirPieza(piezaDeGuia(guide), { titulo: 'Compartir la guía' })
    })
  }

  setupReadTracking(session, guide, esNoticia)

  initGuideForum({
    containerEl: document.getElementById('forumContainer'),
    guideId: guide.id,
    currentSession: session,
    isAdmin: !!profile?.is_admin,
    guideAuthorId: guide.author_id,
    guideTitle: guide.title,
    guideSlug: guide.slug,
  })
}

init()

// «También en…» (1282): el artículo también está en la web de quien lo
// escribe (Redacción). La base solo deja una dirección https sin nada raro;
// aquí se vuelve a mirar porque se pinta en un enlace.
function tambienEnHtml(guide) {
  const url = guide?.tambien_en_url
  if (!url || !/^https:\/\/[^\s"'<>`]+$/.test(url)) return ''
  let sitio = guide.tambien_en_nombre
  if (!sitio) { try { sitio = new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
  return `<a class="guia-tambien" href="${escapeHtml(url)}" target="_blank" rel="noopener">
    <span class="guia-tambien-logo" aria-hidden="true">${escapeHtml(sitio.slice(0, 2).toUpperCase())}</span>
    <span class="guia-tambien-texto"><b>También en ${escapeHtml(sitio)}</b><small>El artículo en la web de su autor</small></span>
    <span class="guia-tambien-ir">Leer allí ${icons.arrowRight(14)}</span>
  </a>`
}
