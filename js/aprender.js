import { supabase } from './supabase.js'
import { conVueltaAtrasDeTipo } from './articulos.js'
import { escapeHtml, getSession, guideHasCourse, arteDe } from './app.js'
import { icons } from './icons.js'
import { medallasPorCurso } from './medallero.js'

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
  hueco.innerHTML = `
    <span class="medallero-titulo">${icons.trophy(16)} Tu medallero</span>
    <span class="medalla-chip medalla-oro">${cuenta.oro} ${cuenta.oro === 1 ? 'oro' : 'oros'}</span>
    <span class="medalla-chip medalla-plata">${cuenta.plata} ${cuenta.plata === 1 ? 'plata' : 'platas'}</span>
    <span class="medalla-chip medalla-bronce">${cuenta.bronce} ${cuenta.bronce === 1 ? 'bronce' : 'bronces'}</span>
    <span class="medallero-restante">${porJugar === 0 ? '¡Todos jugados! A por el pleno de oros' : `${porJugar} ${porJugar === 1 ? 'curso por jugar' : 'cursos por jugar'}`}</span>`
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

const NIVELES = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' }
const RAREZAS = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino' }

// El estado de la pantalla: qué filtro está puesto. Vive fuera de la
// función de pintar para que un repintado no lo pierda.
//
// Puede venir puesto de fuera: los chips de tema de la portada (tanda
// 300) enlazan aquí con ?tema=<slug> en vez de a categoria.html, para
// que nadie caiga en una página de categoría con dos guías. Se guarda el
// SLUG porque es lo que viaja en la URL; el id de la categoría no se
// sabe hasta que responde la consulta.
let filtroCategoria = 'todas'
let temaDeLaUrl = null
try {
  temaDeLaUrl = new URLSearchParams(location.search).get('tema') || null
} catch {}
let filtroNivel = null
let soloSinLeer = false

function tarjetaDeGuia(g, progreso) {
  const p = progreso[g.id] || null
  const bloques = Array.isArray(g.blocks) ? g.blocks.length : 0
  const hechoPct = p?.status === 'completed' ? 100 : p && bloques ? Math.round((Math.min(p.current_block || 0, bloques) / bloques) * 100) : 0
  const leida = Boolean(p?.read_at) || p?.status === 'completed'
  const nivel = NIVELES[g.level] || null
  return `
  <article class="guia-tarjeta">
    <a class="guia-tarjeta-enlace" href="/guia.html?slug=${encodeURIComponent(g.slug)}">
      <span class="guia-arte arte-${arteDe(g)}">
        ${g.cover_image ? `<img src="${escapeHtml(g.cover_image)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
        ${g.guide_rarity && RAREZAS[g.guide_rarity] ? `<span class="guia-rareza rareza-${escapeHtml(g.guide_rarity)}">${RAREZAS[g.guide_rarity]}</span>` : ''}
      </span>
      <span class="guia-cuerpo">
        <strong class="guia-titulo">${escapeHtml(g.title)}</strong>
        ${g.description ? `<span class="guia-desc">${escapeHtml(g.description)}</span>` : ''}
        <span class="guia-etiquetas">
          ${nivel ? `<span class="guia-etiqueta">${nivel}</span>` : ''}
          ${g.estimated_mins ? `<span class="guia-etiqueta">${g.estimated_mins} min</span>` : ''}
          ${guideHasCourse(g) ? '<span class="guia-etiqueta">Con curso</span>' : ''}
        </span>
        <span class="guia-progreso">
          ${hechoPct > 0 || leida ? `<span class="guia-barra"><i style="width:${leida && hechoPct === 0 ? 100 : hechoPct}%"></i></span>` : ''}
          <span class="guia-progreso-texto">${
            p?.status === 'completed'
              ? '<span class="guia-hecha">✓ Curso hecho</span>'
              : leida
                ? '<span class="guia-hecha">✓ Leída</span>'
                : hechoPct > 0
                  ? `Vas por el ${hechoPct}%`
                  : 'Sin empezar'
          }</span>
        </span>
      </span>
    </a>
  </article>`
}

// La franja de «sigue donde lo dejaste»: el curso empezado y sin
// terminar más reciente. Es lo que hace volver — sin ella, quien dejó un
// curso a medias tiene que acordarse de cuál era y buscarlo.
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
    <span class="btn-primary aprender-seguir-boton">Continuar →</span>
  </a>`
}

function chipsHtml(categorias, guias, porCategoria) {
  const chip = (activo, texto, datos, cuenta) =>
    `<button type="button" class="aprender-chip ${activo ? 'activa' : ''}" ${datos}>${escapeHtml(texto)}${
      cuenta !== undefined ? `<span class="aprender-chip-n">${cuenta}</span>` : ''
    }</button>`
  return `
  <div class="aprender-filtros">
    ${chip(filtroCategoria === 'todas', 'Todas', 'data-cat="todas"', guias.length)}
    ${categorias
      .filter((c) => porCategoria[c.id])
      .map((c) => chip(filtroCategoria === c.id, c.name, `data-cat="${escapeHtml(c.id)}"`, porCategoria[c.id]))
      .join('')}
    <span class="aprender-filtros-sep"></span>
    ${Object.entries(NIVELES)
      .map(([clave, texto]) => chip(filtroNivel === clave, texto, `data-nivel="${clave}"`))
      .join('')}
    ${chip(soloSinLeer, 'Sin leer', 'data-sinleer="1"')}
  </div>`
}

async function loadCategories(session) {
  const list = document.getElementById('categoriesList')
  const { data: categories } = await supabase.from('categories').select('*').order('order_pos')

  // «Aprender» es de guías y cursos: las noticias tienen su sección. Con
  // vuelta atrás mientras la migración de noticias no esté puesta — sin
  // ella la consulta falla y esta página se queda a cero.
  const COLUMNAS = 'id, slug, title, description, category_id, blocks, level, estimated_mins, cover_image, guide_rarity, published_at'
  const pedirGuias = (filtrar) => {
    const q = supabase.from('guides').select(COLUMNAS).not('published_at', 'is', null).order('published_at', { ascending: false })
    return filtrar ? q.eq('kind', 'guide') : q
  }
  const { data: publicadas } = await conVueltaAtrasDeTipo(() => pedirGuias(true), () => pedirGuias(false))
  const guias = publicadas || []

  if (!guias.length) {
    list.innerHTML = `<p class="empty-state">Todavía no hay ninguna guía publicada.</p>`
    return
  }

  if (session) {
    const conCurso = guias.filter((g) => guideHasCourse(g))
    medallasPorCurso(session.user.id).then((m) => pintarMedallero(conCurso, m)).catch(() => {})
  }

  const progreso = {}
  if (session) {
    const { data: filas } = await supabase
      .from('user_progress')
      .select('guide_id, status, read_at, current_block, started_at')
      .eq('user_id', session.user.id)
    for (const f of filas || []) progreso[f.guide_id] = f
  }

  const porCategoria = {}
  for (const g of guias) if (g.category_id) porCategoria[g.category_id] = (porCategoria[g.category_id] || 0) + 1

  // El tema que venía en la URL se traduce a su id ahora que hay
  // categorías. Si el slug no existe —enlace viejo, categoría borrada—
  // no se filtra nada: se ven todas, que es mejor que una pantalla vacía
  // sin explicación.
  if (temaDeLaUrl) {
    const cat = (categories || []).find((c) => c.slug === temaDeLaUrl)
    if (cat && porCategoria[cat.id]) filtroCategoria = cat.id
    temaDeLaUrl = null
  }

  const pintar = () => {
    const visibles = guias.filter((g) => {
      if (filtroCategoria !== 'todas' && g.category_id !== filtroCategoria) return false
      if (filtroNivel && g.level !== filtroNivel) return false
      if (soloSinLeer && (progreso[g.id]?.read_at || progreso[g.id]?.status === 'completed')) return false
      return true
    })
    list.innerHTML = `
      ${seguirHtml(guias, progreso)}
      ${chipsHtml(categories || [], guias, porCategoria)}
      ${
        visibles.length
          ? `<div class="guia-rejilla">${visibles.map((g) => tarjetaDeGuia(g, progreso)).join('')}</div>`
          : '<p class="empty-state">No hay ninguna guía con esos filtros. Prueba a quitar alguno.</p>'
      }`
    list.querySelectorAll('[data-cat]').forEach((b) =>
      b.addEventListener('click', () => {
        filtroCategoria = b.dataset.cat
        pintar()
      })
    )
    // Los de nivel y «sin leer» son INTERRUPTORES: volver a pulsarlos los
    // quita. Si no, una vez puesto un nivel no habría forma de volver a
    // verlas todas sin recargar.
    list.querySelectorAll('[data-nivel]').forEach((b) =>
      b.addEventListener('click', () => {
        filtroNivel = filtroNivel === b.dataset.nivel ? null : b.dataset.nivel
        pintar()
      })
    )
    list.querySelectorAll('[data-sinleer]').forEach((b) =>
      b.addEventListener('click', () => {
        soloSinLeer = !soloSinLeer
        pintar()
      })
    )
  }
  pintar()
}

async function init() {
  const session = await getSession()
  await loadCategories(session)
}

init()
