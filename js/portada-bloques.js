// La portada nueva (tanda 844), la que PINGU vio en imágenes y aprobó («mola,
// dale todo»): el foro con el tema más hablado delante, «Aprende» con los
// temas dentro, las noticias con el titular sobre la foto, la clasificación
// de la semana y del mes con la XP de los seis retos, y la comunidad en una
// línea por suceso.
//
// Desde la 1188 es un MOSAICO (la C de «Tres portadas nuevas», con los
// cambios de PINGU): la noticia en grande y las siguientes al lado, el foro
// de arriba abajo a la derecha, y debajo las guías en portada y la comunidad.
// La clasificación salió de la portada: la pinta /retos con
// js/clasificacion.js.
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
import { escapeHtml, arteDe } from './app.js'
import { hoja, caraHtml, cabecera, verTodo, ic, nombre } from './pb-comun.js'
import { rutaDeArticulo, cuandoFue, conVueltaAtrasDeTipo } from './articulos.js'
import { haceCuanto, perfilesPorId, urlTema, etiquetaHtml, nombreDe } from './foro-comun.js'
import { sinMigracion } from './sin-migracion.js'

// La cara, la cabecera de un bloque, «Ver todo» y la hoja viven en
// js/pb-comun.js (1188): /retos pinta la clasificación con ellas y no debe
// arrastrar la portada entera.
export { hoja, caraHtml } from './pb-comun.js'

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


// ── 2 · El foro ──
//
// Desde la 1207 (PINGU: «en el foro tiene un espacio bastante grande abajo y
// parece que nunca se rellena»): SIEMPRE los cuatro temas, en cuatro filas
// iguales que se reparten la caja —cada una con la cara de quien escribió lo
// último, el foro y cuándo, y los mensajes en una burbuja (rosa si hay algo
// que no has leído)—. Antes el tema que más se movía iba en grande con su
// trocito y la caja quitaba filas hasta que cabían, y sobraba sitio abajo.
// «Lo más hablado» solo si el primero ha tenido mensajes hoy; si no, es «En
// el foro». Puro.
export function foroHtml({ temas, perfiles = {}, foros = {}, hoy = {}, escribiendo = 0, nuevos = {}, sesion = false }) {
  if (!temas?.length) return ''
  const masHablado = (hoy[temas[0].id] || 0) > 0
  const fila = (t) => {
    const p = perfiles[t.last_post_author_id] || perfiles[t.author_id]
    const n = t.post_count || 1
    const foro = foros[t.board_id]
    return `<li><a class="pb-hilo" href="${urlTema(t.id)}">
      ${caraHtml(p, 40)}
      <span class="pb-hilo-texto"><b title="${escapeHtml(t.title)}">${etiquetaHtml(t.prefix)}${escapeHtml(t.title)}</b><small>${foro ? `<span class="pb-chip">${escapeHtml(foro)}</span>` : ''}<span class="pb-hilo-quien">${escapeHtml(nombre(p))} · ${haceCuanto(t.last_post_at || t.created_at)}</span></small></span>
      <span class="pb-foro-n${nuevos[t.id] > 0 ? ' nuevo' : ''}" title="${n === 1 ? '1 mensaje' : `${n} mensajes`}">${ic('messageSquare', 12)}${n}</span>
    </a></li>`
  }
  const vivo = escribiendo > 1 ? `<span class="pb-vivo" title="${escribiendo} personas han escrito hoy"><i aria-hidden="true"></i>${escribiendo} hoy</span>` : ''
  return `${cabecera(masHablado ? 'Lo más hablado' : 'En el foro', `<span class="pb-cab-enlaces">${vivo}${verTodo('/foro', 'Foro')}</span>`, 'messageSquare')}
    <ul class="pb-foro-cuatro">${temas.slice(0, 4).map(fila).join('')}</ul>
    ${sesion ? '' : '<div class="pb-pie-enlace"><a class="btn-secondary pb-boton" href="/auth.html?registro=1">Participar</a></div>'}`
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

// ── 3 · Guías nuevas ──
//
// Desde la 1188 (PINGU: «demasiada letra y poco visual»): las últimas guías
// como PORTADAS —la foto o el color de su categoría, la categoría con los
// minutos y el título—, sin descripción, nivel ni progreso, que están en la
// tarjeta de /aprender. Y sin los temas de filtro: «Todas las guías» lleva a
// /aprender, que los tiene. Puro.
export function portadaDeGuia(g) {
  // Solo el tema (1191, PINGU): con los minutos la chapa se alargaba y rompía
  // la tarjeta.
  const meta = g.categories?.name || ''
  return `<a class="pb-portada arte-${arteDe(g.categories?.slug || g.category_id || g)}" href="/guia/${encodeURIComponent(g.slug)}">
      ${g.cover_image ? `<img src="${escapeHtml(g.cover_image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />` : ''}
      <span class="pb-portada-sobre">${meta ? `<span class="pb-chip claro">${escapeHtml(meta)}</span>` : ''}<strong>${escapeHtml(g.title)}</strong></span>
    </a>`
}

export function aprendeHtml({ guias, escribir = false }) {
  if (!guias?.length) return ''
  const escribe = escribir ? `<a class="pb-escribir" href="/editor-guia.html" title="Escribe una guía">${ic('edit', 16)}<span class="sr-only">Escribe una guía</span></a>` : ''
  return `${cabecera('Guías nuevas', `<span class="pb-cab-enlaces">${escribe}${verTodo('/aprender.html', 'Todas las guías')}</span>`, 'bookOpen')}
    <div class="pb-portadas">${guias.slice(0, 4).map(portadaDeGuia).join('')}</div>`
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

async function montarAprende(session) {
  const caja = document.getElementById('aprende')
  if (!caja) return
  const guias = await guiasDe('')
  if (!guias.length) return recoger('recientesSeccion')
  await hoja
  caja.innerHTML = aprendeHtml({ guias, escribir: Boolean(session) })
  document.getElementById('recientesSeccion').style.display = ''
}

// ── 4 · Noticias ──
// La última con el titular encima de su foto y, al lado, «Más noticias» con
// su miniatura. En el móvil (1190, PINGU: la grande desplazaba la portada) no
// hay grande: «Noticias», todas en una tira que se desliza. Por eso la lista
// lleva también la primera, y en el PC se esconde. Sin foto, el color de su
// arte. Puro.
export function noticiasHtml(noticias) {
  if (!noticias?.length) return ''
  const [n, ...resto] = noticias
  const foto = (x, cls) => (x.cover_image ? `<img class="${cls}" src="${escapeHtml(x.cover_image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />` : '')
  return `<a class="pb-noticia arte-${arteDe(n)}" href="${rutaDeArticulo('news', n.slug)}">
      ${foto(n, 'pb-noticia-foto')}
      <span class="pb-noticia-sobre"><span class="pb-chip claro">${ic('newspaper', 12)} Noticia · ${escapeHtml(cuandoFue(n.published_at))}</span><strong>${escapeHtml(n.title)}</strong></span>
    </a>
    <div class="pb-noticias-lado">
      ${cabecera('Noticias', verTodo('/noticias', 'Todas'), 'newspaper')}
      ${noticias.length ? `<ul class="pb-noticias-mas">${noticias.map((x) => `<li><a href="${rutaDeArticulo('news', x.slug)}"><span class="pb-noticia-mini arte-${arteDe(x)}" aria-hidden="true">${foto(x, '')}</span><span><b>${escapeHtml(x.title)}</b><small>${escapeHtml(cuandoFue(x.published_at))}</small></span></a></li>`).join('')}</ul>` : ''}
    </div>`
}

// «Más noticias» en el PC (1207, PINGU: «demasiado texto»): una fila más
// abajo, a lo ancho, con las cuatro siguientes en tarjetas con foto, y no
// cinco renglones al lado de la grande. En el móvil no sale: allí las
// noticias son la tira de arriba (1190). Puro.
export function masNoticiasHtml(noticias) {
  if (!noticias?.length) return ''
  return `${cabecera('Más noticias', verTodo('/noticias', 'Todas'), 'newspaper')}
    <div class="pb-masnot">${noticias.slice(0, 4).map((x) => `<a class="pb-masnot-item" href="${rutaDeArticulo('news', x.slug)}">
      <span class="pb-masnot-foto arte-${arteDe(x)}">${x.cover_image ? `<img src="${escapeHtml(x.cover_image)}" alt="" loading="lazy" decoding="async" onerror="this.remove()" />` : ''}</span>
      <b>${escapeHtml(x.title)}</b><small>${escapeHtml(cuandoFue(x.published_at))}</small>
    </a>`).join('')}</div>`
}

async function montarNoticias() {
  const hueco = document.getElementById('noticiaPortada')
  if (!hueco) return []
  const { data, error } = await supabase.from('guides').select('id, slug, title, published_at, cover_image').eq('kind', 'news').not('published_at', 'is', null).order('published_at', { ascending: false }).limit(6)
  if (error || !data?.length) {
    recoger('noticiaPortadaSeccion')
    recoger('masNoticiasSeccion')
    return []
  }
  await hoja
  hueco.innerHTML = noticiasHtml(data)
  document.getElementById('noticiaPortadaSeccion').style.display = ''
  // Las cuatro siguientes, abajo y a lo ancho (solo en el PC, portada.css).
  const mas = document.getElementById('masNoticias')
  if (mas && data.length > 1) {
    mas.innerHTML = masNoticiasHtml(data.slice(1))
    document.getElementById('masNoticiasSeccion')?.classList.remove('hidden')
  }
  return data.flatMap((n) => [`noticia:${n.id}`])
}

// ── 7 · En la comunidad ──
//
// Una línea por suceso, con el molde de js/comunidad-sucesos.js (el mismo que
// la pestaña Actividad de /usuarios, 845). Aquí, los que quepan, sin las
// noticias —van en su bloque— y sin lo que ya está arriba. Desde la 1188,
// arriba «+N gente nueva esta semana» con sus caras, y los «se unió» salen de
// la lista porque ya están en esa cifra. Puro.
export function genteNuevaHtml(n, caras = []) {
  if (!n) return ''
  return `<a class="pb-gente-nueva" href="/usuarios.html"><b>+${n}</b><span><small>${n === 1 ? 'persona nueva' : 'gente nueva'} esta semana</small><span class="pb-pila">${caras.slice(0, 6).map((p) => caraHtml(p, 24)).join('')}</span></span></a>`
}

// El lunes a las 00:00 de esta semana, en tu hora (1205, PINGU: «que lo
// contabilice de lunes a lunes; cuando empieza el lunes cuenta a cero»). Puro.
export function inicioDeSemana(ahora = new Date()) {
  const d = new Date(ahora)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

// Cuántos se han unido ESTA semana (desde el lunes) y los seis últimos, en
// UNA consulta: la cuenta exacta viene en la cabecera y las filas son las caras.
async function genteNueva() {
  const desde = inicioDeSemana().toISOString()
  const { data, count, error } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url', { count: 'exact' })
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(6)
  return error ? { n: 0, caras: [] } : { n: count ?? (data || []).length, caras: data || [] }
}

// SIEMPRE cuatro (1207, PINGU: «según el evento sale uno o dos o tres… que
// siempre saliese lo mismo, ocupando lo mismo del bloque»). Con la cifra de
// gente nueva arriba, los «se unió» van al final: solo rellenan si no hay
// cuatro de lo demás, para que nunca quede un hueco. Puro.
export function cuatroSucesos(todos, genteNueva = 0) {
  const lista = genteNueva ? [...todos.filter((s) => s.tipo !== 'alta'), ...todos.filter((s) => s.tipo === 'alta')] : todos
  return lista.slice(0, 4)
}

async function montarComunidad(session, yaEnPantalla) {
  const caja = document.getElementById('homeActivityFeed')
  if (!caja) return
  // Su hueco va reservado desde el primer pintado (1200); sin nada que
  // enseñar se recoge y las guías toman el ancho.
  if (!session) return recoger('homeActivity')
  try {
    const m = await import('./comunidad-sucesos.js')
    const [{ actividad, nuevos }, fuera, gente] = await Promise.all([m.cargarSucesos(14), yaEnPantalla.catch(() => new Set()), genteNueva().catch(() => ({ n: 0, caras: [] }))])
    const clave = (e) => (e.tipo === 'tema' ? `tema:${String(e.enlace || '').split('/').pop()}` : e.tipo === 'noticia' ? `noticia:${e.guideId}` : null)
    const deSiempre = actividad.filter((e) => e.tipo !== 'noticia' && !fuera.has(clave(e)))
    const todos = m.sucesosDeLaComunidad(deSiempre, nuevos)
    const sucesos = cuatroSucesos(todos, gente.n)
    if (!sucesos.length && !gente.n) return recoger('homeActivity')
    await Promise.all([hoja, m.hoja])
    caja.innerHTML = `${cabecera('Comunidad', verTodo('/usuarios.html#activity'), 'users')}${genteNuevaHtml(gente.n, gente.caras)}${m.listaHtml(sucesos, { dibujo: true })}`
    document.getElementById('homeActivity').classList.remove('hidden')
  } catch {
    recoger('homeActivity')
  }
}

// Todo a la vez: cada bloque va por su lado y se calla solo si falla.
export function montarPortada(session) {
  const arriba = Promise.all([montarForo(session).catch(() => []), montarNoticias().catch(() => [])]).then((l) => new Set(l.flat()))
  return Promise.all([
    arriba,
    montarAprende(session).catch(() => recoger('recientesSeccion')),
    montarComunidad(session, arriba),
  ])
}
