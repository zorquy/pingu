// La portada de noticias (tanda 269).
//
// Una noticia es un artículo de `guides` con `kind = 'news'`: mismo
// editor, misma página de lectura, mismo índice. Lo que cambia es cómo
// se listan — por fecha, no por categoría — y que aquí la portada manda.
//
// POR QUÉ AQUÍ LA IMAGEN VA GRANDE Y EN LAS GUÍAS NO. En las tarjetas de
// guía se probó la portada grande arriba y se descartó, y está escrito en
// components.css: «la mayoría de las guías no tienen portada, quedaba una
// rejilla a parches». En noticias eso se da la vuelta — la carta
// revelada, el logo del set, el sobre: TODAS llevan imagen, y la imagen
// es media noticia. Así que aquí sí.
import { supabase } from './supabase.js'
import { claveDeVista, pintarUltimaVista, guardarVista, tomarPartes, vistaAlDia } from './ultima-vista.js'
import { escapeHtml, getSession, getProfile } from './app.js'
import { urlParaCss } from './html.js'
import { icons } from './icons.js'
import { faltaElTipo, rutaDeArticulo, cuandoFue, fechaMaquina } from './articulos.js'
import { urlDeLogo } from './carta-ruta.js'
import { tarjetasPorGrupo as porGrupos, cuentasDeNoticias, grupoSemanaOAntes, POR_PAGINA, paginaDeDireccion, paginasDe } from './noticias-grupos.js'
import { paginacionHtml } from './paginacion.js'


const enlaceDeNoticia = (slug) => rutaDeArticulo('news', slug)

// Por semanas (1152, D1): `js/noticias-grupos.js`.
const tarjetasPorGrupo = (lista, anterior) => porGrupos(lista, anterior, tarjetaHtml, new Date(), grupoSemanaOAntes)

// LA NOTICIA DE UN SET, CON SU LOGO (787, SI4). Las que no traen portada y
// nombran un set de los dos últimos años llevan su logo en grande. Se casa
// por el NOMBRE en el título (el más largo primero, que «Chispas
// Fulgurantes» no se lo lleve «Chispas»), y sin casar se queda el icono.
let setsConLogo = []
async function cargarSetsConLogo() {
  const desde = new Date(Date.now() - 2 * 365 * 864e5).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('tcg_sets')
    .select('id, name, market, logo_tcggo, logo_path')
    .eq('market', 'WEST')
    .gte('release_date', desde)
  setsConLogo = (data || [])
    .map((s) => ({ nombre: String(s.name || '').toLowerCase(), logo: s.logo_tcggo || urlDeLogo(s.logo_path, s.market) }))
    .filter((s) => s.nombre.length >= 4 && s.logo)
    .sort((a, b) => b.nombre.length - a.nombre.length)
}
export function setDeTitulo(titulo, sets = setsConLogo) {
  const t = String(titulo || '').toLowerCase()
  return sets.find((s) => t.includes(s.nombre)) || null
}

function portadaHtml(n, tamano) {
  const set = n.cover_image ? null : setDeTitulo(n.title)
  if (set) {
    return `<div class="noticia-portada noticia-portada-${tamano} noticia-portada-vacia noticia-portada-set"><img src="${escapeHtml(set.logo)}" alt="" width="240" height="120" loading="lazy" onerror="this.remove()"></div>`
  }
  if (n.cover_image) {
    return `<div class="noticia-portada noticia-portada-${tamano}" style="background-image:url('${urlParaCss(n.cover_image)}')" role="presentation"></div>`
  }
  // Sin portada no se deja un hueco gris: se pinta el icono de la
  // noticia sobre el color de la casa. Pasará poco, pero cuando pase no
  // puede parecer que la imagen no ha cargado.
  return `<div class="noticia-portada noticia-portada-${tamano} noticia-portada-vacia">${icons.newspaper(38)}</div>`
}

// Lo de esta semana, en tarjeta con su foto; lo de antes, en una fila
// compacta a dos columnas (1215, como la maqueta; la 1210 dejaba también la
// semana pasada en tarjetas): la foto pequeña, la fecha y el titular.
function tarjetaHtml(n, g) {
  const fila = g && g.clave !== 's0'
  return `<a class="noticia-tarjeta${fila ? ' noticia-fila' : ''}" href="${enlaceDeNoticia(n.slug)}">
    ${portadaHtml(n, 'chica')}
    <div class="noticia-cuerpo">
      <time class="noticia-fecha" datetime="${fechaMaquina(n.published_at)}">${escapeHtml(cuandoFue(n.published_at))}</time>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.description || '')}</p>
    </div>
  </a>`
}

// El titular (1210): la foto a lo ancho y el texto encima, sobre un velo,
// como las portadas de la portada.
function titularHtml(n) {
  return `<a class="noticia-titular" href="${enlaceDeNoticia(n.slug)}">
    ${portadaHtml(n, 'grande')}
    <div class="noticia-cuerpo">
      <span class="noticia-ultima">Lo último</span>
      <time class="noticia-fecha" datetime="${fechaMaquina(n.published_at)}">${escapeHtml(cuandoFue(n.published_at))}</time>
      <h2>${escapeHtml(n.title)}</h2>
      <p>${escapeHtml(n.description || '')}</p>
    </div>
  </a>`
}

// Una página (1217): doce, con la cuenta de cuántas hay para saber cuántas
// páginas salen. El tema elegido en los chips de arriba (1216); null es «Todas».
let temaElegido = null
async function pedir(pagina) {
  let q = supabase
    .from('guides')
    .select('id, slug, title, description, cover_image, published_at', { count: 'exact' })
    .eq('kind', 'news')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
  if (temaElegido) q = q.eq('category_id', temaElegido)
  const { data, error, count } = await q
  // Mientras la migración no esté puesta, `kind` no existe y esto falla.
  // No es un error que enseñarle a nadie: es que todavía no hay noticias.
  if (faltaElTipo(error)) {
    console.warn('[noticias] Falta la columna `kind`. Ejecuta supabase-migration-noticias.sql en Supabase.')
    return { noticias: [], total: 0, error: null }
  }
  if (error) return { noticias: [], total: 0, error }
  const noticias = (data || []).slice(0, POR_PAGINA)
  return { noticias, total: Number.isFinite(count) ? count : noticias.length, error: null }
}

// El botón de escribir, para administración y para quien redacta
// noticias (tanda 803). El admin va a su editor; el redactor, al de la
// comunidad, que es el que puede usar sin entrar al panel.
//
// Va AQUÍ y no escondido en /admin porque es donde se está cuando se te
// ocurre que algo es noticia: mirando las de hoy. Lleva `?tipo=noticia`,
// así que el editor abre ya puesto en noticia — la diferencia entre
// escribir una noticia y acordarse de marcarla.
//
// El candado de verdad está en la base (un disparador devuelve la fila a
// «guía» si quien escribe no es del equipo). Esto es no enseñar un botón
// que no lleva a ninguna parte.
async function pintarBotonEscribir() {
  const caja = document.getElementById('noticiasEscribir')
  if (!caja) return
  const sesion = await getSession()
  if (!sesion) return
  const perfil = await getProfile(sesion.user.id)
  if (!perfil?.is_admin && !perfil?.is_news_writer) return
  const editor = perfil.is_admin ? '/admin/editor-guia.html' : '/editor-guia.html'
  caja.innerHTML = `<a class="btn-primary" href="${editor}?tipo=noticia">${icons.edit(15)} Escribir noticia</a>`
}

// Chips por tema (1216, la propuesta del repaso: «si las noticias llevan
// tema; si no, solo Todas»). Los temas son las categorías que ya tiene cada
// artículo; con uno solo (o ninguno) no sale nada, que un chip que no filtra
// es ruido. Una consulta de dos columnas, con su número.
export function chipsDeTemas(filas, elegido = null) {
  const porTema = new Map()
  for (const f of filas || []) {
    if (!f?.category_id) continue
    const t = porTema.get(f.category_id) || { id: f.category_id, nombre: f.categories?.name || 'Otras', n: 0 }
    t.n++
    porTema.set(f.category_id, t)
  }
  if (porTema.size < 2) return ''
  const temas = [...porTema.values()].sort((a, b) => b.n - a.n)
  const chip = (id, nombre, n) => `<button type="button" class="chip-filtro noticias-tema" data-tema="${escapeHtml(id || '')}" aria-pressed="${(elegido || '') === (id || '')}">${escapeHtml(nombre)}${n != null ? ` <span class="noticias-tema-n">${n}</span>` : ''}</button>`
  return chip('', 'Todas', (filas || []).length) + temas.map((t) => chip(t.id, t.nombre, t.n)).join('')
}
async function pintarTemas() {
  const caja = document.getElementById('noticiasTemas')
  if (!caja) return
  const { data, error } = await supabase.from('guides').select('category_id, categories(name)').eq('kind', 'news').not('published_at', 'is', null).limit(1000)
  if (error) return
  const html = chipsDeTemas(data, temaElegido)
  caja.innerHTML = html
  caja.hidden = !html
  // En el PC los chips van en la banda, a la derecha (1217, la maqueta); en
  // el móvil, sin banda, encima de la última. Se MUEVE el elemento (893).
  const cabecera = document.querySelector('.noticias-cabecera')
  if (html && cabecera && !document.documentElement.classList.contains('con-barra-movil') && caja.parentElement !== cabecera) {
    cabecera.insertBefore(caja, document.getElementById('noticiasEscribir'))
  }
  if (caja.dataset.enganchado) return
  caja.dataset.enganchado = '1'
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tema]')
    if (!b) return
    temaElegido = b.dataset.tema || null
    for (const x of caja.querySelectorAll('[data-tema]')) x.setAttribute('aria-pressed', String(x === b))
    // Otro tema empieza en su primera página.
    if (pagina !== 1) return irAPagina(1)
    pintarNoticias({ sinCache: true })
  })
}

let pagina = paginaDeDireccion(location.search)
export async function pintarNoticias({ sinCache = false } = {}) {
  const titular = document.getElementById('noticiaTitular')
  const rejilla = document.getElementById('noticiasRejilla')
  const masCaja = document.getElementById('noticiasMasCaja')
  if (!rejilla) return

  // Las de la última vez, ya (894). Y la rejilla deja de ser la silueta
  // (`aria-hidden`) en cuanto lleva noticias de verdad, de la caché o de
  // ahora: antes se quedaba escondida para quien escucha.
  const clave = claveDeVista(`noticias${temaElegido ? `-${temaElegido}` : ''}${pagina > 1 ? `-p${pagina}` : ''}`)
  if (!sinCache && pintarUltimaVista(clave)) rejilla.removeAttribute('aria-hidden')
  let [{ noticias, total, error }] = await Promise.all([pedir(pagina), cargarSetsConLogo().catch(() => {})])
  // Una página que ya no existe (se publicó menos, o un enlace viejo): la última.
  if (!error && !noticias.length && pagina > 1 && total) {
    pagina = paginasDe(total)
    ;({ noticias, total, error } = await pedir(pagina))
  }
  vistaAlDia()
  if (error) {
    rejilla.innerHTML = `<p class="empty-state">No se han podido cargar las noticias. Vuelve a intentarlo en un momento.</p>`
    return
  }
  if (noticias.length === 0) {
    titular.innerHTML = ''
    masCaja.innerHTML = ''
    for (const id of ['noticiasNSemana', 'noticiasNMes']) { const el = document.getElementById(id); if (el) el.textContent = '0' }
    rejilla.innerHTML = `<p class="empty-state">Todavía no hay noticias publicadas. Vuelve pronto.</p>`
    rejilla.removeAttribute('aria-hidden')
    guardarVista(clave, tomarPartes(['noticiaTitular', 'noticiasRejilla']))
    return
  }

  // En la primera, la última en grande; en las demás, todo en filas.
  const [primera, ...resto] = pagina === 1 ? noticias : [null, ...noticias]
  titular.innerHTML = primera ? titularHtml(primera) : ''
  if (pagina === 1) {
    const cuentas = cuentasDeNoticias(noticias, total > noticias.length)
    for (const [id, n] of [['noticiasNSemana', cuentas.semana], ['noticiasNMes', cuentas.mes]]) {
      const el = document.getElementById(id)
      if (el) el.textContent = n
    }
  }
  // La rejilla empieza siempre con su rótulo, aunque sea de la misma
  // semana que el titular: dice dónde empieza la lista.
  rejilla.innerHTML = tarjetasPorGrupo(resto, null).html
  rejilla.removeAttribute('aria-hidden')
  guardarVista(clave, tomarPartes(['noticiaTitular', 'noticiasRejilla']))
  masCaja.innerHTML = paginacionHtml(pagina, paginasDe(total))
  if (!masCaja.dataset.enganchado) {
    masCaja.dataset.enganchado = '1'
    masCaja.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pagina]')
      if (!b) return
      irAPagina(Number(b.dataset.pagina))
    })
  }
}

// Cambiar de página pone `?p=` en la dirección (sin recargar) y sube arriba.
function irAPagina(n) {
  pagina = Math.max(1, n)
  const url = new URL(location.href)
  if (pagina > 1) url.searchParams.set('p', String(pagina))
  else url.searchParams.delete('p')
  history.pushState(null, '', url)
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  void pintarNoticias({ sinCache: true })
}
window.addEventListener('popstate', () => {
  pagina = paginaDeDireccion(location.search)
  void pintarNoticias({ sinCache: true })
})

pintarNoticias()
pintarTemas()
pintarBotonEscribir()
