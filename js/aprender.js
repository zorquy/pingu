import { supabase } from './supabase.js'
import { conVueltaAtrasDeTipo } from './articulos.js'
import { escapeHtml, getSession, tintClassForKey, categoryIconHtml } from './app.js'
import { guideHasCourse } from './guia-contenido.js'
import { tarjetaDeGuia, NIVELES } from './guia-tarjeta.js'
import { icons } from './icons.js'
import { medallasPorCurso } from './medallero.js'
import { filaDeGuia } from './guia-fila.js'
import { normalizeSearch } from './texto.js'

// El medallero: convierte los cursos en un álbum por completar. Solo
// con sesión y solo si hay cursos publicados; el que aún no ha jugado
// ninguno también lo ve — «13 por jugar» es la invitación.
function pintarMedallero(cursosConCurso, medallas) {
  const hueco = document.getElementById('medallero')
  if (!hueco || !cursosConCurso.length) return
  const cuenta = { oro: 0, plata: 0, bronce: 0 }
  let jugados = 0
  for (const g of cursosConCurso) {
    const m = medallas[g.id]
    if (!m) continue
    jugados++
    if (m in cuenta) cuenta[m]++
  }
  const porJugar = cursosConCurso.length - jugados
  // Una píldora al lado del título (865): las cifras, y el texto entero
  // para quien no ve los colores. Lleva a tus medallas del perfil.
  hueco.setAttribute('aria-label', `Medallero: ${cuenta.oro} ${cuenta.oro === 1 ? 'oro' : 'oros'}, ${cuenta.plata} ${cuenta.plata === 1 ? 'plata' : 'platas'}, ${cuenta.bronce} ${cuenta.bronce === 1 ? 'bronce' : 'bronces'}; ${porJugar === 0 ? 'todos los cursos jugados' : `${porJugar} ${porJugar === 1 ? 'curso' : 'cursos'} por jugar`}`)
  hueco.innerHTML = `
    <span class="medallero-titulo">${icons.trophy(14)}</span>
    <span class="medalla-chip medalla-oro">${cuenta.oro}</span>
    <span class="medalla-chip medalla-plata">${cuenta.plata}</span>
    <span class="medalla-chip medalla-bronce">${cuenta.bronce}</span>
    <span class="medallero-restante">${porJugar === 0 ? 'todos jugados' : `${porJugar} por jugar`}</span>`
  hueco.classList.remove('hidden')
}

// ── Las guías, a la vista (tanda 299) ──
//
// /aprender era una pantalla de TRES CAJAS que solo servían para llevarte
// a otra pantalla: las guías no se veían hasta el segundo clic, y lo
// único que se leía de cada categoría era una barra vacía de «0 de 2
// guías leídas», que no invita a nada.
//
// Ahora las guías se ven YA y las categorías son FILTROS. Todo el
// filtrado es en el navegador: las guías publicadas se traen de una vez
// (son decenas, no miles) y cambiar de filtro no vuelve a la base.


// El estado de la pantalla: qué filtro está puesto. Vive fuera de la
// función de pintar para que un repintado no lo pierda.
//
// Puede venir puesto de fuera: los chips de tema de la portada (tanda
// 300) enlazan aquí con ?tema=<slug> en vez de a categoria.html, para
// que nadie caiga en una página de categoría con dos guías. Se guarda el
// SLUG porque es lo que viaja en la URL; el id de la categoría no se
// sabe hasta que responde la consulta.
let temaDeLaUrl = null
try {
  temaDeLaUrl = new URLSearchParams(location.search).get('tema') || null
} catch {}
let filtroNivel = null
let soloSinLeer = false

let conCurso = false
let busqueda = ''

// En el móvil la primera va en grande y las demás en FILAS (tanda 846; la
// fila es la de js/guia-fila.js desde la 847):
// PINGU, «las guías están muy muy abajo». Una tarjeta entera por guía son
// 400 px de pantalla cada una; una fila, 88.
const movil = typeof matchMedia === 'function' ? matchMedia('(max-width: 640px)') : { matches: false, addEventListener() {} }

// La franja de «sigue donde lo dejaste»: el curso empezado y sin
// terminar más reciente. Es lo que hace volver — sin ella, quien dejó un
// curso a medias tiene que acordarse de cuál era y buscarlo. Desde la 846
// es una fila y no un panel: en el móvil se comía la pantalla entera.
function seguirHtml(guias, progreso) {
  const empezados = guias
    .map((g) => ({ g, p: progreso[g.id] }))
    .filter(({ g, p }) => p && p.status !== 'completed' && (p.current_block || 0) > 0 && guideHasCourse(g))
    .sort((a, b) => new Date(b.p.started_at || 0) - new Date(a.p.started_at || 0))
  if (!empezados.length) return ''
  const { g, p } = empezados[0]
  const bloques = Array.isArray(g.blocks) ? g.blocks.length : 0
  const pct = bloques ? Math.round((Math.min(p.current_block, bloques) / bloques) * 100) : 0
  return `
  <a class="aprender-seguir" href="/curso.html?slug=${encodeURIComponent(g.slug)}">
    <span class="aprender-aro" style="--vuelta:${pct / 100}"><b>${pct}%</b></span>
    <span class="aprender-seguir-texto">
      <span class="aprender-seguir-rotulo">Sigue donde lo dejaste</span>
      <strong>${escapeHtml(g.title)}</strong>
      <span class="aprender-seguir-sub">Bloque ${Math.min(p.current_block, bloques)} de ${bloques}</span>
    </span>
    <span class="aprender-seguir-boton"><span class="aprender-seguir-palabra">Continuar</span> →</span>
  </a>`
}

const chip = (activo, texto, datos, cuenta) =>
  `<button type="button" class="aprender-chip ${activo ? 'activa' : ''}" ${datos} aria-pressed="${activo}">${escapeHtml(texto)}${
    cuenta !== undefined ? `<span class="aprender-chip-n">${cuenta}</span>` : ''
  }</button>`

// UNA fila que se desliza con el dedo (865): la cuenta y los
// interruptores (nivel, sin leer, con curso). Los temas ya no van aquí:
// son las baldosas de arriba, y tocar una abre su página.
function chipsHtml(hayCursos, visibles) {
  return `
  <div class="aprender-filtros ap-interruptores" role="group" aria-label="Filtros">
    <span class="ap-cuenta" id="apCuenta">${cuantasHtml(visibles)}</span>
    ${Object.entries(NIVELES)
      .map(([clave, texto]) => chip(filtroNivel === clave, texto, `data-nivel="${clave}"`))
      .join('')}
    ${chip(soloSinLeer, 'Sin leer', 'data-sinleer="1"')}
    ${hayCursos ? chip(conCurso, 'Con curso', 'data-concurso="1"') : ''}
  </div>`
}

const cuantasHtml = (n) => `${n} ${n === 1 ? 'guía' : 'guías'}`

async function loadCategories(session) {
  const list = document.getElementById('categoriesList')
  const { data: categories } = await supabase.from('categories').select('*').order('order_pos')

  // «Aprender» es de guías y cursos: las noticias tienen su sección. Con
  // vuelta atrás mientras la migración de noticias no esté puesta — sin
  // ella la consulta falla y esta página se queda a cero.
  const COLUMNAS = 'id, slug, title, description, category_id, collection_id, collection_order, blocks, level, estimated_mins, cover_image, guide_rarity, published_at'
  const pedirGuias = (filtrar) => {
    const q = supabase.from('guides').select(COLUMNAS).not('published_at', 'is', null).order('published_at', { ascending: false })
    return filtrar ? q.eq('kind', 'guide') : q
  }
  // EL `error` NO SE TIRA (tanda 510). Destructurando solo `data`, una
  // consulta que falla deja `publicadas` en undefined y la página decía
  // «todavía no hay ninguna guía publicada» — o sea, presentaba un fallo
  // nuestro como un dato sobre el catálogo, en la página principal de
  // aprender. Es el mismo silencio que tenía /cartas.
  const { data: publicadas, error } = await conVueltaAtrasDeTipo(() => pedirGuias(true), () => pedirGuias(false))
  const guias = publicadas || []

  if (error) {
    list.innerHTML = '<p class="empty-state">No se han podido cargar las guías. Vuelve a intentarlo en un momento.</p>'
    return
  }
  if (!guias.length) {
    list.innerHTML = `<p class="empty-state">Todavía no hay ninguna guía publicada.</p>`
    return
  }

  const progreso = {}
  if (session) {
    const { data: filas } = await supabase
      .from('user_progress')
      .select('guide_id, status, read_at, current_block, started_at')
      .eq('user_id', session.user.id)
    for (const f of filas || []) progreso[f.guide_id] = f
  }

  // UN TEMA (863): /aprender?tema=<slug> es la página del tema, a la que
  // vuelve una guía. Antes era /categoria.html, la vista vieja. Si el slug
  // no existe —enlace viejo, tema borrado— se sigue como siempre: todas.
  const tema = temaDeLaUrl ? (categories || []).find((c) => c.slug === temaDeLaUrl) : null
  if (tema) {
    temaDeLaUrl = null
    return pintarTema({ tema, guias: guias.filter((g) => g.category_id === tema.id), progreso, session, list })
  }

  if (session) {
    const conCurso = guias.filter((g) => guideHasCourse(g))
    medallasPorCurso(session.user.id).then((m) => pintarMedallero(conCurso, m)).catch(() => {})
  }

  // Un `?tema=` que no casa con ningún tema (enlace viejo, tema borrado)
  // no filtra nada: se ven todas, que es mejor que una pantalla vacía.
  temaDeLaUrl = null

  const hayCursos = guias.some((g) => guideHasCourse(g))
  // La caja se arma UNA vez: el buscador no se repinta mientras escribes
  // (perdería el foco a cada letra). Lo que cambia son los chips y la lista.
  // Cuatro capas (865): lo tuyo, los temas, una fila de mandos, las guías.
  list.innerHTML = `
    ${seguirHtml(guias, progreso)}
    ${temasHtml(categories || [], guias, progreso, session)}
    <div class="ap-herramientas">
      <label class="ap-buscar">${icons.search(16)}<input type="search" id="apBuscar" enterkeyhint="search" placeholder="Busca una guía" aria-label="Buscar guías" autocomplete="off" /></label>
      <div id="apChips"></div>
    </div>
    <div class="ap-lista" id="apLista"></div>`
  const caja = { chips: list.querySelector('#apChips'), lista: list.querySelector('#apLista') }

  const pintar = () => {
    const q = normalizeSearch(busqueda)
    const visibles = guias.filter((g) => {
      if (filtroNivel && g.level !== filtroNivel) return false
      if (soloSinLeer && (progreso[g.id]?.read_at || progreso[g.id]?.status === 'completed')) return false
      if (conCurso && !guideHasCourse(g)) return false
      if (q && !normalizeSearch(`${g.title || ''} ${g.description || ''}`).includes(q)) return false
      return true
    })
    caja.chips.innerHTML = chipsHtml(hayCursos, visibles.length)
    if (!visibles.length) {
      caja.lista.innerHTML = `<p class="empty-state">${q ? 'Ninguna guía habla de eso.' : 'No hay ninguna guía con esos filtros.'} Prueba a quitar alguno.</p>`
      return
    }
    const [primera, ...resto] = visibles
    caja.lista.innerHTML = movil.matches
      ? `${tarjetaDeGuia(primera, { progreso })}${resto.length ? `<div class="ap-filas">${resto.map((g) => filaDeGuia(g, { progreso })).join('')}</div>` : ''}`
      : `<div class="guia-rejilla ap-rejilla">${visibles.map((g) => tarjetaDeGuia(g, { progreso })).join('')}</div>`
  }

  // Delegado, una sola vez: los chips se repintan y no hay que volver a
  // engancharlos. Son INTERRUPTORES: volver a pulsarlos los quita, o no
  // habría forma de volver a verlas todas sin recargar.
  caja.chips.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    const clave = b && ['nivel', 'sinleer', 'concurso'].find((k) => b.dataset[k] !== undefined)
    if (!clave) return
    const valor = b.dataset[clave]
    if (clave === 'nivel') filtroNivel = filtroNivel === valor ? null : valor
    else if (clave === 'sinleer') soloSinLeer = !soloSinLeer
    else conCurso = !conCurso
    pintar()
    // El chip pulsado es otro nodo tras repintar: el foco vuelve a él, que
    // con el teclado no se pierda la posición.
    caja.chips.querySelector(`[data-${clave}="${CSS.escape(valor)}"]`)?.focus()
  })
  list.querySelector('#apBuscar').addEventListener('input', (e) => {
    busqueda = e.target.value
    pintar()
  })
  movil.addEventListener?.('change', pintar)
  pintar()
}

// ── LOS TEMAS COMO BALDOSAS (tanda 864) ──
//
// La puerta de Aprender (la propuesta «Aprender por temas»): encima de la
// lista, cada tema con su icono, cuántas guías y cursos tiene y, con
// cuenta, la barra de lo que llevas leído. Tocarlo abre la página del tema
// (863). En el móvil van en una fila que se desliza, para que la lista
// siga cerca (la 846: «las guías están muy muy abajo»); en el PC, en
// rejilla. Las cuentas salen de las guías ya cargadas: ninguna consulta
// más. Un tema sin guías publicadas no sale: una baldosa vacía es la caja
// de «0 de 2» que la 299 quitó.
function temasHtml(categorias, guias, progreso, session) {
  const n = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`
  const baldosas = categorias.map((c) => {
    const suyas = guias.filter((g) => g.category_id === c.id)
    if (!suyas.length) return ''
    const cursos = suyas.filter((g) => guideHasCourse(g)).length
    const leidas = suyas.filter((g) => leida(g, progreso)).length
    const sub = `${n(suyas.length, 'guía', 'guías')}${cursos ? ` · ${n(cursos, 'curso', 'cursos')}` : ''}`
    return `<a class="ap-baldosa" href="/aprender?tema=${encodeURIComponent(c.slug)}" aria-label="${escapeHtml(`${c.name}: ${sub}${session ? `, ${leidas} leídas` : ''}`)}">
      <span class="ap-baldosa-icono ${tintClassForKey(c.id)}">${categoryIconHtml(c, 18)}</span>
      <span class="ap-baldosa-texto">
        <span class="ap-baldosa-nombre">${escapeHtml(c.name)}</span>
        <span class="ap-baldosa-sub">${escapeHtml(sub)}</span>
        ${session ? `<span class="ap-baldosa-barra" aria-hidden="true"><i style="width:${Math.round((leidas / suyas.length) * 100)}%"></i></span>` : ''}
      </span>
    </a>`
  }).join('')
  if (!baldosas) return ''
  return `<nav class="ap-baldosas" id="apTemas" aria-label="Temas">${baldosas}</nav>`
}

// ── LA PÁGINA DE UN TEMA (tanda 863) ──
//
// PINGU: «si el botón de para atrás te lleva a la categoría, deberíamos
// tener la categoría renovada, no con la vista antigua». La vieja
// (/categoria.html) tenía su cabecera grande, su barra y unas tarjetas de
// antes de la 676. Esto es el mismo contenido con las piezas de ahora: las
// migas (en el móvil, «‹ Aprender»), una cabecera compacta con el icono,
// el nombre, la descripción y el aro de lo leído, Guías · Cursos en un
// segmentado, los chips de nivel y «Sin leer», la MISMA tarjeta de guía
// que el resto de la web y, al bajar en el móvil, la barra pegada (858).
// Los grupos («colecciones») del tema se conservan como títulos.
let vistaTema = 'guias'

const leida = (g, progreso) => Boolean(progreso[g.id]?.read_at) || progreso[g.id]?.status === 'completed'

function cabeceraDeTemaHtml(tema, guias, progreso, session) {
  const cursos = guias.filter((g) => guideHasCourse(g))
  const leidas = guias.filter((g) => leida(g, progreso)).length
  const hechos = cursos.filter((g) => progreso[g.id]?.status === 'completed').length
  const n = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`
  const cuenta = session
    ? `${leidas} de ${n(guias.length, 'guía leída', 'guías leídas')}${cursos.length ? ` · ${hechos} de ${n(cursos.length, 'curso hecho', 'cursos hechos')}` : ''}`
    : `${n(guias.length, 'guía', 'guías')}${cursos.length ? ` · ${n(cursos.length, 'curso', 'cursos')}` : ''}`
  return `
    <div class="ap-tema-cab" id="apTemaCab">
      <span class="ap-tema-icono ${tintClassForKey(tema.id)}">${categoryIconHtml(tema, 28)}</span>
      <div class="ap-tema-texto">
        <h1>${escapeHtml(tema.name)}</h1>
        ${tema.description ? `<p>${escapeHtml(tema.description)}</p>` : ''}
        <p class="ap-tema-cuenta">${escapeHtml(cuenta)}</p>
      </div>
      ${session && guias.length ? `<span class="aprender-aro ap-tema-aro" style="--vuelta:${(leidas / guias.length).toFixed(3)}" aria-hidden="true"><b>${leidas}/${guias.length}</b></span>` : ''}
    </div>`
}

function pintarTema({ tema, guias, progreso, session, list }) {
  document.title = `${tema.name} · Aprender · PokeDoc`
  const cabecera = document.querySelector('.page-header')
  if (cabecera) {
    cabecera.insertAdjacentHTML('beforebegin', `<nav class="breadcrumb" aria-label="Dónde estás"><a href="/">Inicio</a> <span>›</span> <a href="/aprender">Aprender</a> <span>›</span> <span>${escapeHtml(tema.name)}</span></nav>`)
    cabecera.outerHTML = cabeceraDeTemaHtml(tema, guias, progreso, session)
  }
  document.getElementById('medallero')?.classList.add('hidden')
  if (!guias.length) {
    list.innerHTML = '<p class="empty-state">Todavía no hay guías en este tema.</p>'
    return
  }
  const cursos = guias.filter((g) => guideHasCourse(g))
  // Dentro del tema, el orden es el del temario (la vieja lo respetaba):
  // primero las ordenadas, luego las nuevas.
  const ordenadas = [...guias].sort((a, b) => {
    const oa = a.collection_order ?? Infinity
    const ob = b.collection_order ?? Infinity
    return oa !== ob ? oa - ob : new Date(b.published_at || 0) - new Date(a.published_at || 0)
  })
  list.innerHTML = `
    <div class="ap-herramientas">
      <div class="ap-tema-filtros">
        ${cursos.length ? `<div class="seg ap-seg" role="group" aria-label="Guías o cursos" id="apSeg">
          <button type="button" class="seg-btn" data-vista="guias" aria-pressed="true">Guías <span class="aprender-chip-n">${guias.length}</span></button>
          <button type="button" class="seg-btn" data-vista="cursos" aria-pressed="false">Cursos <span class="aprender-chip-n">${cursos.length}</span></button>
        </div>` : ''}
        <label class="ap-buscar">${icons.search(16)}<input type="search" id="apBuscar" enterkeyhint="search" placeholder="Busca en este tema" aria-label="Buscar en este tema" autocomplete="off" /></label>
      </div>
      <div id="apChips"></div>
    </div>
    <div class="ap-lista" id="apLista"></div>`
  const caja = { chips: list.querySelector('#apChips'), lista: list.querySelector('#apLista'), seg: list.querySelector('#apSeg') }
  const pintar = () => {
    const q = normalizeSearch(busqueda)
    const visibles = ordenadas.filter((g) => {
      if (vistaTema === 'cursos' && !guideHasCourse(g)) return false
      if (filtroNivel && g.level !== filtroNivel) return false
      if (soloSinLeer && leida(g, progreso)) return false
      if (q && !normalizeSearch(`${g.title || ''} ${g.description || ''}`).includes(q)) return false
      return true
    })
    caja.chips.innerHTML = `<div class="aprender-filtros ap-interruptores" role="group" aria-label="Filtros">
      <span class="ap-cuenta" id="apCuenta">${cuantasHtml(visibles.length)}</span>
      ${Object.entries(NIVELES).map(([clave, texto]) => chip(filtroNivel === clave, texto, `data-nivel="${clave}"`)).join('')}
      ${session ? chip(soloSinLeer, 'Sin leer', 'data-sinleer="1"') : ''}
    </div>`
    if (!visibles.length) {
      caja.lista.innerHTML = `<p class="empty-state">${q ? 'Ninguna guía de este tema habla de eso.' : 'No hay ninguna guía con esos filtros.'} Prueba a quitar alguno.</p>`
      return
    }
    caja.lista.innerHTML = movil.matches
      ? `<div class="ap-filas">${visibles.map((g) => filaDeGuia(g, { progreso })).join('')}</div>`
      : `<div class="guia-rejilla">${visibles.map((g) => tarjetaDeGuia(g, { progreso })).join('')}</div>`
  }
  caja.chips.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    const clave = b && ['nivel', 'sinleer'].find((k) => b.dataset[k] !== undefined)
    if (!clave) return
    if (clave === 'nivel') filtroNivel = filtroNivel === b.dataset.nivel ? null : b.dataset.nivel
    else soloSinLeer = !soloSinLeer
    pintar()
    caja.chips.querySelector(`[data-${clave}="${CSS.escape(b.dataset[clave])}"]`)?.focus()
  })
  caja.seg?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-vista]')
    if (!b) return
    vistaTema = b.dataset.vista
    for (const x of caja.seg.querySelectorAll('[data-vista]')) x.setAttribute('aria-pressed', String(x === b))
    pintar()
  })
  list.querySelector('#apBuscar').addEventListener('input', (e) => { busqueda = e.target.value; pintar() })
  movil.addEventListener?.('change', pintar)
  pintar()
  // La barra pegada del móvil (858): la flecha a Aprender, el tema y lo leído.
  if (matchMedia('(max-width: 900px)').matches) {
    import('./barra-pegada.js').then((m) => m.montarBarraPegada({
      cabecera: document.getElementById('apTemaCab'),
      titulo: tema.name,
      volverHref: '/aprender',
      volverTexto: 'Volver a Aprender',
      cifra: () => (session ? `${guias.filter((g) => leida(g, progreso)).length} de ${guias.length} leídas` : `${guias.length} ${guias.length === 1 ? 'guía' : 'guías'}`),
    })).catch(() => {})
  }
}

async function init() {
  const session = await getSession()
  await loadCategories(session)
}

init()
