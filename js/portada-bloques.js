// La portada nueva (tanda 844), la que PINGU vio en imágenes y aprobó («mola,
// dale todo»): el foro con el tema más hablado delante, «Aprende» con los
// temas dentro, las noticias con el titular sobre la foto, la clasificación
// de la semana y del mes con la XP de los seis retos, y la comunidad en una
// línea por suceso.
//
// Entra por `import()` desde home.js con su hoja (css/portada-bloques.css):
// el presupuesto de peso de la portada mide lo que baja AL ABRIRLA, y esto
// llega con los datos, que es cuando se pinta. Los huecos del HTML (los
// esqueletos de index.html) reservan el sitio mientras tanto.
//
// Cada bloque se calla si no hay datos o si falla su consulta: la sección se
// recoge (`recoger`), no se queda un esqueleto girando ni un «no hay nada»
// que a lo mejor es «no he podido preguntar» (la 510).
import { supabase } from './supabase.js'
import { escapeHtml, avatarStyle, getInitial, arteDe } from './app.js'
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'
import { rutaDeArticulo, cuandoFue, conVueltaAtrasDeTipo } from './articulos.js'
import { haceCuanto, perfilesPorId, urlTema, etiquetaHtml, nombreDe } from './foro-comun.js'
import { tarjetaDeGuia } from './guia-tarjeta.js'
import { filaDeGuia, hoja as hojaFila } from './guia-fila.js'
import { sinMigracion } from './sin-migracion.js'

export const hoja = typeof document !== 'undefined' ? hojaInyectada('css/portada-bloques.css') : Promise.resolve()

const ic = (n, t = 16) => icons[n]?.(t) || ''
const nombre = (p) => p?.display_name || p?.username || 'Alguien'

// La cara de alguien. Sin enlace a propósito: a su lado va siempre el nombre,
// que sí lo lleva (o la fila entera lleva a otro sitio), y una cara de 36 px
// que se pulsa se queda por debajo de los 44 (la 312).
export function caraHtml(p, t = 32) {
  const dentro = p?.avatar_url ? '' : escapeHtml(getInitial(nombre(p)))
  return `<span class="pb-cara" style="width:${t}px;height:${t}px;${avatarStyle(p)}" title="${escapeHtml(nombre(p))}" aria-hidden="true">${dentro}</span>`
}

// El texto de un mensaje del foro, sin etiquetas y cortado. Puro.
export function extracto(html, largo = 170) {
  const texto = String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  return texto.length > largo ? `${texto.slice(0, largo).replace(/\s+\S*$/, '')}…` : texto
}

function recoger(id) {
  const s = document.getElementById(id)
  if (!s) return
  s.style.display = 'none'
  s.classList.add('seccion-recogida')
}

const cabecera = (titulo, derecha = '') => `<div class="pb-cab"><h2>${titulo}</h2>${derecha}</div>`
const verTodo = (href, texto = 'Ver todo') => `<a class="ver-todo" href="${href}">${texto} <span class="ver-todo-flecha" aria-hidden="true">→</span></a>`

// ── 2 · El foro ──
//
// El tema que más se mueve HOY va delante, con su último mensaje y quién
// participa; los otros, en filas. «Lo más hablado» solo si de verdad ha
// tenido mensajes hoy; si no, es «lo último», y se dice así. Puro.
export function foroHtml({ temas, perfiles = {}, foros = {}, hoy = {}, escribiendo = 0, ultimo = null, participantes = [], nuevos = {}, sesion = false }) {
  if (!temas?.length) return ''
  const [top, ...resto] = temas
  const masHablado = (hoy[top.id] || 0) > 0
  const quien = perfiles[ultimo?.author_id] || perfiles[top.last_post_author_id] || perfiles[top.author_id]
  const mensajes = top.post_count || 1
  const nuevosTop = nuevos[top.id] || 0
  const derecha = `<span class="pb-cab-der">${escribiendo > 1 ? `<span class="pb-vivo"><i aria-hidden="true"></i>${escribiendo} personas escribiendo hoy</span>` : ''}<a class="btn-secondary pb-boton" href="${sesion ? '/foro' : '/auth.html?registro=1'}">Participar</a></span>`
  const fila = (t) => {
    const p = perfiles[t.last_post_author_id] || perfiles[t.author_id]
    const verbo = t.last_post_author_id && t.last_post_author_id !== t.author_id ? 'respondió' : (t.post_count || 1) > 1 ? 'escribió' : 'abrió el tema'
    const sinLeer = nuevos[t.id] > 0
    return `<li class="pb-foro-fila">
      ${caraHtml(p, 36)}
      <a class="pb-foro-fila-texto" href="${urlTema(t.id)}">
        <b>${etiquetaHtml(t.prefix)}${escapeHtml(t.title)}</b>
        <small><span class="pb-quien">${escapeHtml(nombre(p))}</span> ${verbo} ${haceCuanto(t.last_post_at || t.created_at)}${foros[t.board_id] ? ` · ${escapeHtml(foros[t.board_id])}` : ''}</small>
      </a>
      <span class="pb-foro-n${sinLeer ? ' nuevo' : ''}" title="${(t.post_count || 1) === 1 ? '1 mensaje' : `${t.post_count} mensajes`}">${t.post_count || 1}</span>
    </li>`
  }
  return `${cabecera('Ahora en el foro', derecha)}
    <div class="pb-foro-top">
      <div class="pb-foro-top-cab">${foros[top.board_id] ? `<span class="pb-chip">${escapeHtml(foros[top.board_id])}</span>` : ''}<span class="pb-foro-caliente">${ic(masHablado ? 'flame' : 'clock', 12)} ${masHablado ? 'Lo más hablado hoy' : 'Lo último'}</span></div>
      <a class="pb-foro-titulo" href="${urlTema(top.id)}">${etiquetaHtml(top.prefix)}${escapeHtml(top.title)}</a>
      ${ultimo ? `<div class="pb-foro-ultimo">${caraHtml(quien, 32)}<div><small><b>${escapeHtml(nombre(quien))}</b> · ${haceCuanto(ultimo.created_at)}</small><p>«${escapeHtml(extracto(ultimo.body_html))}»</p></div></div>` : ''}
      <div class="pb-foro-pie">
        ${participantes.length > 1 ? `<span class="pb-pila">${participantes.slice(0, 5).map((p) => caraHtml(p, 26)).join('')}</span>` : ''}
        <span class="pb-tenue">${mensajes} ${mensajes === 1 ? 'mensaje' : 'mensajes'}</span>
        ${nuevosTop > 0 ? `<span class="pb-nuevos">${nuevosTop} ${nuevosTop === 1 ? 'nuevo' : 'nuevos'}</span>` : ''}
        <a class="btn-primary pb-boton" href="${urlTema(top.id)}">Entrar</a>
      </div>
    </div>
    ${resto.length ? `<ul class="pb-foro-lista">${resto.map(fila).join('')}</ul>` : ''}
    <div class="pb-pie-enlace">${verTodo('/foro', 'Todo el foro')}</div>`
}

// Lo que pinta el bloque, de UNA vez (1017): `portada_foro()` trae los
// cuatro temas de los foros que se ven, lo de hoy, el último mensaje del que
// más se mueve, quién escribe y, con cuenta, lo que no has leído; antes
// eran siete consultas en cinco olas (`datosDelForoAntiguo`, que se queda
// para mientras la migración no esté). `p_desde` es TU medianoche: «lo más
// hablado hoy» se cuenta en la hora de quien mira.
async function datosDelForo(session) {
  const medianoche = new Date()
  medianoche.setHours(0, 0, 0, 0)
  const { data, error } = await supabase.rpc('portada_foro', { p_desde: medianoche.toISOString() })
  if (error) {
    if (!sinMigracion(error)) console.warn('portada_foro', error.message || error)
    return datosDelForoAntiguo(session)
  }
  if (!data) return datosDelForoAntiguo(session)
  const perfiles = data.perfiles || {}
  return {
    temas: data.temas || [],
    perfiles,
    foros: data.foros || {},
    hoy: data.hoy || {},
    escribiendo: Number(data.escribiendo) || 0,
    ultimo: data.ultimo || null,
    participantes: (data.participantes || []).map((id) => perfiles[id]).filter(Boolean),
    nuevos: data.nuevos || {},
    sesion: Boolean(session),
  }
}

async function montarForo(session) {
  const hueco = document.getElementById('foroVivo')
  if (!hueco) return []
  const d = await datosDelForo(session)
  if (!d.temas?.length) {
    recoger('foroVivoSeccion')
    return []
  }
  await hoja
  hueco.innerHTML = foroHtml(d)
  document.getElementById('foroVivoSeccion').style.display = ''
  return d.temas.map((t) => `tema:${t.id}`)
}

async function datosDelForoAntiguo(session) {
  // Primero los foros que se VEN (876): la lectura de los temas es abierta,
  // así que sin esto los hilos viejos del subforo de Noticias —escondido
  // desde la 876— seguían encabezando la portada. Administración recibe
  // también los escondidos: se quitan por `is_hidden`. Si la lista no llega
  // (o viene vacía), se pide como siempre: mejor el foro que un hueco.
  const { data: forosTodos } = await supabase.from('forum_boards').select('id, name, is_hidden')
  const visibles = (forosTodos || []).filter((f) => !f.is_hidden)
  let q = supabase
    .from('forum_threads')
    .select('id, title, prefix, post_count, created_at, last_post_at, author_id, last_post_author_id, board_id')
  if (visibles.length) q = q.in('board_id', visibles.map((f) => f.id))
  const { data: temas, error } = await q.order('last_post_at', { ascending: false }).limit(4)
  if (error || !temas?.length) return { temas: [] }
  const medianoche = new Date()
  medianoche.setHours(0, 0, 0, 0)
  const { data: deHoy } = await supabase.from('forum_posts').select('thread_id, author_id').gte('created_at', medianoche.toISOString()).limit(1000)
  const foros = visibles.length ? visibles : forosTodos || []
  const hoy = {}
  for (const m of deHoy || []) hoy[m.thread_id] = (hoy[m.thread_id] || 0) + 1
  // Delante, el de la lista que más mensajes ha tenido hoy (a igualdad, el
  // más reciente, que es como vienen).
  const top = [...temas].sort((a, b) => (hoy[b.id] || 0) - (hoy[a.id] || 0))[0]
  const ordenados = [top, ...temas.filter((t) => t !== top)]
  const { data: ultimos } = await supabase
    .from('forum_posts')
    .select('id, author_id, body_html, created_at')
    .eq('thread_id', top.id)
    .order('created_at', { ascending: false })
    .limit(10)
  const ultimo = (ultimos || [])[0] || null
  const ids = [...temas.flatMap((t) => [t.last_post_author_id, t.author_id]), ...(ultimos || []).map((m) => m.author_id)]
  const perfiles = await perfilesPorId(ids)
  const participantes = [...new Set((ultimos || []).map((m) => m.author_id))].map((id) => perfiles[id]).filter(Boolean)
  // Lo que no has leído: el tema con su cuenta exacta, los demás con su punto.
  const nuevos = {}
  if (session) {
    try {
      const { marcasDeLectura, estaSinLeer } = await import('./foro-lecturas.js')
      const marcas = await marcasDeLectura(session.user.id)
      for (const t of ordenados) if (estaSinLeer(t, marcas)) nuevos[t.id] = 1
      if (nuevos[top.id]) {
        const desde = [marcas.porTema[top.id], marcas.todoHasta].filter(Boolean).sort().pop()
        nuevos[top.id] = desde ? (ultimos || []).filter((m) => m.created_at > desde && m.author_id !== session.user.id).length || 1 : Math.min(top.post_count || 1, 10)
      }
    } catch {}
  }
  return {
    temas: ordenados,
    perfiles,
    foros: Object.fromEntries((foros || []).map((f) => [f.id, f.name])),
    hoy,
    escribiendo: new Set((deHoy || []).map((m) => m.author_id)).size,
    ultimo,
    participantes,
    nuevos,
    sesion: Boolean(session),
  }
}

// ── 3 · Aprende, con los temas dentro ──
//
// Las categorías eran una fila suelta al final («Busca por tema»): ahora son
// el filtro del bloque. «Novedades» es lo último; un tema trae lo suyo. La
// grande es la tarjeta de guía de siempre (una sola tarjeta, la 316) y las
// otras, la misma en fila. (La «guía destacada» de /admin se fue en la 1119:
// PINGU, «eso no lo vamos a hacer».)
export function aprendeHtml({ guias, temas = [], activo = '', progreso = null }) {
  const chips = [`<button type="button" class="pb-tema${activo ? '' : ' activo'}" data-tema="" aria-pressed="${activo ? 'false' : 'true'}">Novedades</button>`]
    .concat(temas.map((c) => `<button type="button" class="pb-tema${activo === c.id ? ' activo' : ''}" data-tema="${escapeHtml(c.id)}" aria-pressed="${activo === c.id ? 'true' : 'false'}">${escapeHtml(c.name)} <small>${c.guide_count ?? 0}</small></button>`))
    .join('')
  const [grande, ...resto] = guias || []
  const cuerpo = grande
    ? `<div class="pb-aprende-rejilla">
        <div class="pb-aprende-grande">${tarjetaDeGuia(grande, { progreso, categoria: grande.categories?.name || '', pie: true })}</div>
        <div class="pb-aprende-lista">${resto.slice(0, 3).map((g) => filaDeGuia(g, { progreso })).join('')}</div>
      </div>`
    : '<p class="pb-vacio">De este tema todavía no hay guías.</p>'
  return `${cabecera('Aprende', verTodo(activo ? `/aprender.html?tema=${encodeURIComponent(temas.find((c) => c.id === activo)?.slug || '')}` : '/aprender.html', 'Todas las guías'))}
    <div class="pb-temas" role="group" aria-label="Temas">${chips}</div>
    <div class="pb-aprende-cuerpo">${cuerpo}</div>`
}

const COLUMNAS_GUIA = 'id, slug, title, description, kind, category_id, level, guide_rarity, estimated_mins, blocks, cover_image, author_id, published_at, categories(name, slug, emoji)'

async function guiasDe(tema) {
  const consulta = (filtrar) => {
    let q = supabase.from('guides').select(COLUMNAS_GUIA).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(4)
    if (tema) q = q.eq('category_id', tema)
    return filtrar ? q.eq('kind', 'guide') : q
  }
  const { data, error } = await conVueltaAtrasDeTipo(() => consulta(true), () => consulta(false))
  if (error) throw error
  return data || []
}

async function progresoDe(session, guias) {
  if (!session) return null
  const { data } = await supabase.from('user_progress').select('guide_id, status, read_at, current_block, started_at').eq('user_id', session.user.id).in('guide_id', guias.map((g) => g.id))
  return Object.fromEntries((data || []).map((f) => [f.guide_id, f]))
}

async function montarAprende(session) {
  const caja = document.getElementById('aprende')
  if (!caja) return
  const [guias, { data: cats }] = await Promise.all([
    guiasDe(''),
    supabase.from('categories').select('id, slug, name, guide_count, order_pos').order('order_pos'),
  ])
  if (!guias.length) return recoger('recientesSeccion')
  // Los temas con guías, de más a menos (la 300), como mucho cinco.
  const temas = (cats || []).filter((c) => (c.guide_count ?? 0) > 0).sort((a, b) => (b.guide_count ?? 0) - (a.guide_count ?? 0)).slice(0, 5)
  const porTema = { '': guias }
  let progreso = await progresoDe(session, guias).catch(() => null)
  let version = 0
  const pintar = (activo) => {
    caja.innerHTML = aprendeHtml({ guias: porTema[activo] || [], temas, activo, progreso })
    // El autor y el guardar de la tarjeta grande, como en /aprender (la 316).
    import('./guide-card.js').then(({ decorateGuideCards }) => decorateGuideCards(caja, session)).catch(() => {})
  }
  await Promise.all([hoja, hojaFila])
  pintar('')
  document.getElementById('recientesSeccion').style.display = ''
  caja.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tema]')
    if (!b) return
    const activo = b.dataset.tema
    const mia = ++version
    if (!porTema[activo]) {
      b.setAttribute('aria-busy', 'true')
      try {
        porTema[activo] = await guiasDe(activo)
        const p = await progresoDe(session, porTema[activo]).catch(() => null)
        if (p) progreso = { ...(progreso || {}), ...p }
      } catch {
        b.removeAttribute('aria-busy')
        return
      }
    }
    // Si mientras tanto se ha pulsado otro tema, gana el último (la 663).
    if (mia !== version) return
    pintar(activo)
    caja.querySelector(`[data-tema="${CSS.escape(activo)}"]`)?.focus()
  })
}

// ── 4 · Noticias ──
// La última con el titular encima de su foto; dos más debajo, en filas. Sin
// foto, el color de su arte. Puro.
export function noticiasHtml(noticias) {
  if (!noticias?.length) return ''
  const [n, ...resto] = noticias
  const foto = (x, cls) => (x.cover_image ? `<img class="${cls}" src="${escapeHtml(x.cover_image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />` : '')
  return `<a class="pb-noticia arte-${arteDe(n)}" href="${rutaDeArticulo('news', n.slug)}">
      ${foto(n, 'pb-noticia-foto')}
      <span class="pb-noticia-sobre"><span class="pb-chip claro">${ic('newspaper', 12)} Noticia · ${escapeHtml(cuandoFue(n.published_at))}</span><strong>${escapeHtml(n.title)}</strong></span>
    </a>
    ${resto.length ? `<ul class="pb-noticias-mas">${resto.map((x) => `<li><a href="${rutaDeArticulo('news', x.slug)}"><span class="pb-noticia-mini arte-${arteDe(x)}" aria-hidden="true">${foto(x, '')}</span><span><b>${escapeHtml(x.title)}</b><small>${escapeHtml(cuandoFue(x.published_at))}</small></span></a></li>`).join('')}</ul>` : ''}
    <div class="pb-pie-enlace">${verTodo('/noticias', 'Todas las noticias')}</div>`
}

async function montarNoticias() {
  const hueco = document.getElementById('noticiaPortada')
  if (!hueco) return []
  const { data, error } = await supabase.from('guides').select('id, slug, title, published_at, cover_image').eq('kind', 'news').not('published_at', 'is', null).order('published_at', { ascending: false }).limit(3)
  if (error || !data?.length) {
    recoger('noticiaPortadaSeccion')
    return []
  }
  await hoja
  hueco.innerHTML = noticiasHtml(data)
  document.getElementById('noticiaPortadaSeccion').style.display = ''
  return data.flatMap((n) => [`noticia:${n.id}`])
}

// ── 6 · La clasificación ──
//
// Junta la liga de la semana y el top del mes, y los dos cuentan lo mismo:
// la XP de los seis retos (`portada_clasificacion`, supabase-migration-
// portada.sql). Podio con los tres primeros, el 4.º y el 5.º, y tu puesto
// siempre: es lo que se mira. Puro.
export function clasificacionHtml(d, { periodo = 'semana', conSesion = false } = {}) {
  const r = d?.ranking || []
  const sub = periodo === 'mes' ? 'La XP de los seis retos desde el día 1' : 'La XP de los seis retos, de lunes a domingo'
  const pestanas = `<span class="pb-pestanas" role="group" aria-label="Periodo">${['semana', 'mes'].map((p) => `<button type="button" data-periodo="${p}" class="${p === periodo ? 'activo' : ''}" aria-pressed="${p === periodo}">${p === 'semana' ? 'Semana' : 'Mes'}</button>`).join('')}</span>`
  if (!r.length) {
    return `${cabecera('Clasificación', pestanas)}<p class="pb-tenue pb-clas-sub">${sub}</p><p class="pb-vacio">${periodo === 'mes' ? 'Este mes' : 'Esta semana'} todavía no ha puntuado nadie. <a href="/retos">Juega un reto</a> y estrénala.</p>`
  }
  const podio = [r[1], r[0], r[2]]
    .map((x, i) => (x ? `<div class="pb-podio-${[2, 1, 3][i]}">${[2, 1, 3][i] === 1 ? `<span class="pb-corona" aria-hidden="true">${ic('crown', 18)}</span>` : ''}${caraHtml(x, [2, 1, 3][i] === 1 ? 56 : 46)}<b>${x.tu ? 'Tú' : escapeHtml(nombre(x))}</b><small>${x.xp} XP</small><span class="pb-podio-caja">${x.puesto}</span></div>` : '<div></div>'))
    .join('')
  const fila = (x) => `<li class="${x.tu ? 'tu' : ''}"><span class="pb-pos">${x.puesto}</span>${caraHtml(x, 28)}<b>${x.tu ? 'Tú' : escapeHtml(nombre(x))}</b><span class="pb-xp">${x.xp}</span></li>`
  const t = d.tu
  const enLista = r.slice(0, 5).some((x) => x.tu)
  const tuHtml = t && !enLista
    ? `<div class="pb-clas-tu"><span class="pb-pos">${t.puesto}</span><b>Tú</b><small class="pb-tenue">${t.faltan ? `${t.faltan} XP para pasar${t.pasarA ? ` a ${escapeHtml(t.pasarA)}` : ' al de delante'}` : ''}</small><span class="pb-xp">${t.xp}</span></div>`
    : conSesion && !t
      ? `<p class="pb-clas-invita">${periodo === 'mes' ? 'Este mes' : 'Esta semana'} todavía no puntúas — <a href="/retos">juega un reto</a></p>`
      : ''
  return `${cabecera('Clasificación', pestanas)}
    <p class="pb-tenue pb-clas-sub">${sub}</p>
    <div class="pb-podio">${podio}</div>
    ${r.length > 3 ? `<ol class="pb-clas-lista">${r.slice(3, 5).map(fila).join('')}</ol>` : ''}
    ${tuHtml}`
}

async function montarClasificacion(session) {
  const caja = document.getElementById('clasificacion')
  if (!caja) return
  const cache = {}
  const pedir = async (periodo) => {
    if (!cache[periodo]) {
      const { data, error } = await supabase.rpc('portada_clasificacion', { p_periodo: periodo })
      if (error) throw error
      cache[periodo] = data
    }
    return cache[periodo]
  }
  let datos
  try {
    datos = await pedir('semana')
  } catch {
    // Sin la migración, ni semana ni mes: no se sabe, y no se dice «nadie».
    return recoger('clasificacionSeccion')
  }
  let periodo = 'semana'
  await hoja
  caja.innerHTML = clasificacionHtml(datos, { periodo, conSesion: Boolean(session) })
  document.getElementById('clasificacionSeccion').style.display = ''
  caja.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-periodo]')
    if (!b || b.dataset.periodo === periodo) return
    periodo = b.dataset.periodo
    try {
      const d = await pedir(periodo)
      if (periodo !== b.dataset.periodo) return
      caja.innerHTML = clasificacionHtml(d, { periodo, conSesion: Boolean(session) })
      caja.querySelector(`[data-periodo="${periodo}"]`)?.focus()
    } catch {}
  })
}

// ── 7 · En la comunidad ──
//
// Una línea por suceso, con el molde de js/comunidad-sucesos.js (el mismo que
// la pestaña Actividad de /usuarios, 845). Aquí, seis como mucho, sin las
// noticias —van en su bloque— y sin lo que ya está arriba.
async function montarComunidad(session, yaEnPantalla) {
  const caja = document.getElementById('homeActivityFeed')
  if (!session || !caja) return
  try {
    const m = await import('./comunidad-sucesos.js')
    const [{ actividad, nuevos }, fuera] = await Promise.all([m.cargarSucesos(12), yaEnPantalla.catch(() => new Set())])
    const clave = (e) => (e.tipo === 'tema' ? `tema:${String(e.enlace || '').split('/').pop()}` : e.tipo === 'noticia' ? `noticia:${e.guideId}` : null)
    const deSiempre = actividad.filter((e) => e.tipo !== 'noticia' && !fuera.has(clave(e)))
    const sucesos = m.sucesosDeLaComunidad(deSiempre, nuevos).slice(0, 6)
    if (!sucesos.length) return
    await Promise.all([hoja, m.hoja])
    caja.innerHTML = `${cabecera('En la comunidad', verTodo('/usuarios.html#activity'))}${m.listaHtml(sucesos, { dos: true })}`
    document.getElementById('homeActivity').classList.remove('hidden')
  } catch {}
}

// Todo a la vez: cada bloque va por su lado y se calla solo si falla.
export function montarPortada(session) {
  const arriba = Promise.all([montarForo(session).catch(() => []), montarNoticias().catch(() => [])]).then((l) => new Set(l.flat()))
  return Promise.all([
    arriba,
    montarAprende(session).catch(() => recoger('recientesSeccion')),
    montarClasificacion(session).catch(() => recoger('clasificacionSeccion')),
    montarComunidad(session, arriba),
  ])
}
