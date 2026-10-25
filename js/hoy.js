// LA PORTADA «HOY» (744, J5 de la lista de propuestas). Para quien tiene
// cuenta, la portada era una pila de bloques —bienvenida, primeros pasos,
// reto, torneo, foro, lanzamiento…— y lo de HOY había que ir a buscarlo
// bajando. Ahora, debajo del saludo con tu racha, un bloque con lo que
// cambia cada día: lo que vale tu colección con su línea de 30 días y
// cuatro fichas —el reto, tu próximo torneo, el próximo lanzamiento y los
// temas del foro que sigues con algo nuevo—. Lo de debajo sigue igual: es el detalle.
//
// Entra por `import()` desde home.js y solo con sesión, con su hoja: la
// portada tiene 0,4 KB de presupuesto y esto no los toca (la 704).
//
// Cada ficha se pinta con lo que haya y dice «no se sabe» con un guion, no
// con un cero (la 319): si una consulta falla, la ficha se queda, sin
// cifra inventada.
//
// Desde la 1017 todo lo de aquí llega de UNA vez por `portada_hoy()`
// (`datosDeHoy`): eran doce consultas en tres olas, y con ellas las de los
// retos (home.js) y las de los primeros pasos. Mientras la migración no esté
// (`sinMigracion`), cada trozo se pide como antes.
import { supabase } from './supabase.js'
import { sinMigracion } from './sin-migracion.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'
import { hojaInyectada } from './hoja.js'
import { lineasDeTodo, preciosGuardados, valorDeLineas } from './mi-coleccion/datos.js'
import { estadoDeHoy, fichaRetosHtml } from './portada-retos.js'
import { guideHasCourse } from './guia-contenido.js'
import { proximaCita } from './torneos/rondas-jornada.js'
import { marcasDeLectura, estaSinLeer } from './foro-lecturas.js'

// La de js/foro-comun.js, sin traerse el módulo (y sus dependencias) entero.
const urlTema = (id) => `/tema/${encodeURIComponent(id)}`

// Lo tuyo de hoy, de una vez (1017): la cartera, tus torneos, los próximos
// lanzamientos, lo que tienes a medias, los temas que sigues, los retos y la
// gente de hoy, las preguntas por repasar y los primeros pasos. UNA vez por
// visita, para quien lo pida primero (hoy.js, el bloque de retos de home.js,
// primeros-pasos.js). `null` si la migración no está o la base no contesta:
// cada uno hace entonces lo de antes.
let pedidoDeHoy = null
export function datosDeHoy(uid) {
  if (!uid) return Promise.resolve(null)
  if (!pedidoDeHoy) {
    pedidoDeHoy = supabase.rpc('portada_hoy').then(({ data, error }) => {
      if (error) {
        if (!sinMigracion(error)) console.warn('portada_hoy', error.message || error)
        return null
      }
      return data || null
    }).catch(() => null)
  }
  return pedidoDeHoy
}

const DIA = 86_400_000
const hoyISO = (ahora = Date.now()) => new Date(ahora).toISOString().slice(0, 10)

// El cambio de los últimos 30 días, solo si el histórico los cubre (la
// 653: con tres fotos no se afirma un mes). Puro.
export function cambioDelMes(filas, ahora = Date.now()) {
  const dias = (filas || []).filter((f) => Number.isFinite(Number(f.valor)) && /^\d{4}-\d{2}-\d{2}/.test(String(f.dia))).sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
  if (dias.length < 2) return null
  const corte = hoyISO(ahora - 30 * DIA)
  const antes = [...dias].reverse().find((f) => String(f.dia) <= corte)
  if (!antes) return null
  const ultimo = Number(dias[dias.length - 1].valor)
  const cambio = ultimo - Number(antes.valor)
  return { cambio, pct: Number(antes.valor) > 0 ? (cambio / Number(antes.valor)) * 100 : null }
}

// La línea del valor con su relleno, como la de la maqueta (748). Puro.
export function chispaSvg(filas, { ancho = 160, alto = 56 } = {}) {
  const v = (filas || []).map((f) => Number(f.valor)).filter(Number.isFinite)
  if (v.length < 2) return ''
  const min = Math.min(...v)
  const max = Math.max(...v)
  const y = (x) => (max === min ? alto / 2 : alto - 2 - ((x - min) / (max - min)) * (alto - 4))
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * ancho).toFixed(1)},${y(x).toFixed(1)}`).join(' ')
  return `<svg class="hoy-chispa" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" aria-hidden="true" preserveAspectRatio="none"><path class="hoy-chispa-area" d="${d} L${ancho},${alto} L0,${alto} Z"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`
}

// El nombre de un torneo sin lo que va entre corchetes o paréntesis (1012,
// P2): «Liga FDN [Oct–Dic]» no cabe en una ficha de dos columnas y se cortaba
// en «Liga FDN [Oct–Dic] …»; «Liga FDN · jornada 3» sí. Puro.
export const nombreCorto = (nombre) => String(nombre || '').replace(/\s*[\[(][^\])]*[\])]/g, '').replace(/\s+/g, ' ').trim() || String(nombre || '')

// «hoy», «mañana», «en 3 días» o la fecha. Puro.
export function cuandoEs(fecha, ahora = Date.now()) {
  const d = Math.round((Date.parse(`${String(fecha).slice(0, 10)}T00:00:00Z`) - Date.parse(`${hoyISO(ahora)}T00:00:00Z`)) / DIA)
  if (!Number.isFinite(d)) return ''
  if (d <= 0) return 'hoy'
  if (d === 1) return 'mañana'
  if (d < 7) return `en ${d} días`
  return new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Una ficha de la maqueta (748): el icono arriba, lo que es en grande y el
// detalle debajo. `rotulo` se queda para quien escucha: «Reto de hoy:
// Hecho, 4 de 5». Con `logo` (1010, el del set que sale), el logo va en el
// sitio del detalle; si no carga, se queda el nombre.
const ficha = ({ href, icono, rotulo, titular, sub, logo = '', hecho = false, destaca = false }) => `
  <a class="hoy-ficha${hecho ? ' hoy-hecho' : ''}${destaca ? ' hoy-destaca' : ''}" href="${escapeHtml(href)}" aria-label="${escapeHtml([rotulo, titular, sub].filter(Boolean).join(': '))}">
    <span class="hoy-ficha-icono" aria-hidden="true">${icons[icono]?.(22) || ''}</span>
    <b>${escapeHtml(titular)}</b>${
      logo
        ? `<span class="hoy-ficha-logo"><img src="${escapeHtml(logo)}" alt="${escapeHtml(sub || '')}" width="120" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.replaceWith(this.alt)"></span>`
        : sub ? `<span>${escapeHtml(sub)}</span>` : ''
    }
  </a>`

// La ficha del foro (1010): los temas que sigues —escribir en uno te
// suscribe— con mensajes que no has visto. Antes contaba los avisos de
// respuesta sin leer, que se marcan leídos al abrir la campana: decía «Nada
// nuevo» con temas por leer. Con uno solo, la ficha lleva a ese tema. Puro.
function fichaForo(hilos) {
  const n = hilos?.cuenta
  if (n == null) return { href: '/foro.html', icono: 'messageSquare', rotulo: 'Tus temas', titular: 'El foro', sub: 'De lo que se habla' }
  if (!n) return { href: '/foro.html', icono: 'messageSquare', rotulo: 'Tus temas', titular: 'Nada nuevo', sub: 'en los temas que sigues' }
  return {
    href: n === 1 && hilos.uno ? urlTema(hilos.uno) : '/foro.html',
    icono: 'messageSquare',
    rotulo: 'Tus temas',
    // Corto: la ficha mide un quinto de la fila y se cortaba.
    titular: `${n} sin leer`,
    sub: n === 1 && hilos.titulo ? hilos.titulo : 'en los temas que sigues',
  }
}

// Las cuatro fichas, con lo que se sepa de cada una. Puro.
export function fichasHtml({ retos = null, torneo = null, lanzamiento = null, hilos = null } = {}, ahora = Date.now()) {
  const cuando = torneo ? cuandoEs(torneo.start_at, ahora) : ''
  // Con la hora si es hoy o mañana (879): «Torneo hoy a las 19:00».
  const hora = torneo && /^(hoy|mañana)$/.test(cuando) && Number.isFinite(Date.parse(torneo.start_at)) ? ` a las ${new Date(torneo.start_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''
  return [
    // Los seis retos (843); sin saber lo de hoy, la ficha sin cuenta (989:
    // el cuestionario, que era la de antes, ya no existe).
    fichaRetosHtml(retos),
    ficha(
      torneo
        ? { href: `/torneo?slug=${encodeURIComponent(torneo.slug)}`, icono: 'trophy', rotulo: torneo.mio ? 'Tu próximo torneo' : 'Próximo torneo', titular: /^\d/.test(cuando) ? `Torneo el ${cuando}` : `Torneo ${cuando}${hora}`, sub: torneo.jornada ? `${nombreCorto(torneo.name)} · jornada ${torneo.jornada}` : nombreCorto(torneo.name) }
        : { href: '/torneos.html', icono: 'trophy', rotulo: 'Torneos', titular: 'Torneos', sub: 'Ninguno a la vista' }
    ),
    ficha(
      lanzamiento
        ? { href: '/lanzamientos.html', icono: 'calendar', rotulo: 'Próximo lanzamiento', titular: `Sale ${cuandoEs(lanzamiento.fecha, ahora)}`, sub: lanzamiento.nombre, logo: lanzamiento.logo || '' }
        : { href: '/lanzamientos.html', icono: 'calendar', rotulo: 'Lanzamientos', titular: 'Lanzamientos', sub: 'El calendario' }
    ),
    ficha(fichaForo(hilos)),
  ].join('')
}

// «SIGUE DONDE LO DEJASTE» (748; desde la 844, hasta tres tarjetas): las
// guías y los cursos que tienes empezados y sin acabar, y el mazo que estás
// montando, cada uno con su anillo y lo que le queda. Sin nada, no sale. Puro.
const anillo = (pct, texto) => `<span class="hoy-sg-anillo" style="--p:${Math.max(0, Math.min(100, pct))}" aria-hidden="true"><b>${escapeHtml(texto)}</b></span>`
export function tarjetaSigueHtml(x) {
  if (x.tipo === 'mazo') {
    const n = x.cartas
    return `<a class="hoy-sg" href="/constructor.html?mazo=${encodeURIComponent(x.id)}">
      <span class="hoy-sg-arte arte-5" aria-hidden="true">${icons.layers(22)}${anillo((n / 60) * 100, String(n))}</span>
      <span class="hoy-sg-texto"><small>Mazo</small><b>${escapeHtml(x.nombre || 'Mazo sin nombre')}</b><span>${n} de 60 · ${n < 60 ? `te faltan ${60 - n}` : `sobran ${n - 60}`}</span></span>
      <span class="btn-secondary hoy-sg-boton">Abrir</span>
    </a>`
  }
  const g = x.guia
  const bloques = Number.isFinite(Number(g.bloques)) ? Number(g.bloques) : Array.isArray(g.blocks) ? g.blocks.length : 0
  const voy = Math.min(x.fila.current_block || 0, bloques)
  const pct = bloques ? Math.round((voy / bloques) * 100) : 0
  const mins = g.estimated_mins && bloques ? Math.max(1, Math.round((g.estimated_mins * (bloques - voy)) / bloques)) : 0
  return `<a class="hoy-sg" href="/guia/${encodeURIComponent(g.slug)}">
    <span class="hoy-sg-arte arte-${x.curso ? 1 : 3}" aria-hidden="true">${(x.curso ? icons.graduationCap : icons.bookOpen)(22)}${anillo(pct, `${pct}%`)}</span>
    <span class="hoy-sg-texto"><small>${x.curso ? 'Curso' : 'Guía'}</small><b>${escapeHtml(g.title || '')}</b><span>${bloques ? `Bloque ${Math.max(1, voy)} de ${bloques}` : 'Empezada'}${mins ? ` · ${mins} min para acabar` : ''}</span></span>
    <span class="btn-${x.primera ? 'primary' : 'secondary'} hoy-sg-boton">Seguir</span>
  </a>`
}
export function sigueHtml(items) {
  if (!items?.length) return ''
  return `<div class="hoy-sigue-cabeza"><h2>Sigue donde lo dejaste</h2><a class="ver-todo" href="/aprender.html">Ver todo <span class="ver-todo-flecha" aria-hidden="true">→</span></a></div>
    <div class="hoy-sg-fila">${items.slice(0, 3).map((x, i) => tarjetaSigueHtml({ ...x, primera: i === 0 })).join('')}</div>`
}

// Lo que tienes a medias: hasta dos guías o cursos empezados (los últimos que
// abriste) y el último mazo que tocaste si no llega a 60. Puro: `filas` son
// tus filas de progreso con su guía (`guia`, con `bloques` y `curso` si la
// base los contó) y `mazos` tus mazos con sus cartas contadas (`cartas`).
export function loQueTienesAMedias(filas, mazos) {
  const items = (filas || [])
    .filter((f) => f.guia && !f.read_at)
    .slice(0, 2)
    .map((f) => ({ tipo: 'guia', guia: f.guia, fila: f, curso: typeof f.guia.curso === 'boolean' ? f.guia.curso : guideHasCourse(f.guia) }))
  const mazo = (mazos || []).find((m) => m.cartas > 0 && m.cartas !== 60)
  if (mazo) items.push({ tipo: 'mazo', id: mazo.id, nombre: mazo.name, cartas: mazo.cartas })
  return items
}
async function aMedias(uid) {
  const [{ data: filas }, { data: mazos }] = await Promise.all([
    supabase.from('user_progress').select('guide_id, current_block, status, started_at, read_at').eq('user_id', uid).neq('status', 'completed').not('started_at', 'is', null).order('started_at', { ascending: false }).limit(4),
    supabase.from('user_decks').select('id, name, cards, updated_at').eq('user_id', uid).order('updated_at', { ascending: false }).limit(3),
  ])
  const ids = (filas || []).map((f) => f.guide_id)
  const { data: guias } = ids.length ? await supabase.from('guides').select('id, slug, title, blocks, estimated_mins').in('id', ids) : { data: [] }
  const porId = Object.fromEntries((guias || []).map((g) => [g.id, g]))
  return loQueTienesAMedias(
    (filas || []).map((f) => ({ ...f, guia: porId[f.guide_id] || null })),
    (mazos || []).map((m) => ({ ...m, cartas: (m.cards || []).reduce((t, c) => t + (Number(c.n) || 0), 0) }))
  )
}

// Lo que vale tu colección AHORA, como lo suma el Panel (756): tus líneas
// con los precios guardados. La foto diaria es de anoche y no lleva el
// precio que pusiste a mano ni lo que subió hoy; arriba tiene que decir
// lo mismo que dentro.
async function valorDeAhora(uid) {
  const lineas = await lineasDeTodo(uid)
  if (!lineas.length) return { total: 0, lineas: 0 }
  return { total: valorDeLineas(lineas, await preciosGuardados(lineas.map((l) => l.card_id))), lineas: lineas.length }
}

// El histórico con el valor de ahora como punto de HOY: el de la foto de
// hoy, si la hay, se cambia; si no, se añade. Puro.
export function conElValorDeAhora(filas, ahora, hoy = hoyISO()) {
  if (ahora == null || !Number.isFinite(Number(ahora))) return filas
  const dias = [...(filas || [])].filter((f) => String(f.dia) < hoy)
  return [...dias, { dia: hoy, valor: Number(ahora) }]
}

// El valor de tu colección: la última foto, su línea y lo que se ha movido
// en 30 días. Sin fotos todavía, la tarjeta invita a Mi colección; sin la
// migración del histórico, no sale.
// `productos` (766, PR2): lo que valen tus productos sellados. La cifra es
// la MISMA que la grande del Panel —cartas más productos—; la línea y «este
// mes» siguen siendo de las cartas, que es de lo que hay historia.
export function valorHtml(filas, { productos = 0 } = {}) {
  if (!filas) return ''
  if (!filas.length) {
    return `<a class="hoy-valor" href="/mi-coleccion"><span class="hoy-valor-texto"><small>Tu colección</small><b class="hoy-valor-invita">Empieza a llevarla</b><span>Añade tus cartas y aquí verás lo que vale</span></span></a>`
  }
  const ultimo = filas[filas.length - 1]
  const mes = cambioDelMes(filas)
  const tono = mes ? (mes.cambio > 0 ? 'sube' : mes.cambio < 0 ? 'baja' : 'igual') : ''
  const sentido = mes && mes.cambio > 0 ? 'Sube ' : mes && mes.cambio < 0 ? 'Baja ' : ''
  return `<a class="hoy-valor" href="/mi-coleccion">
    <span class="hoy-valor-texto">
      <small>Tu colección</small>
      <b>${escapeHtml(conMiles.format(Number(ultimo.valor) + (Number(productos) || 0)))}</b>
      ${mes ? `<span class="hoy-valor-mes ${tono}">${sentido ? `<i class="hoy-flecha" aria-hidden="true"></i><span class="sr-only">${sentido}</span>` : ''}${escapeHtml(euros(Math.abs(mes.cambio)))} <span>este mes</span></span>` : '<span>Todavía sin un mes de historia</span>'}
    </span>
    ${chispaSvg(filas.slice(-30))}
  </a>`
}

// La cifra con el punto de los miles SIEMPRE (747): «4817,20 €» se lee mal.
const conMiles = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' })

// Los temas que sigues con algo que no has visto: las suscripciones (las
// últimas 200), sus temas y tus marcas de lectura, con la MISMA regla que
// pone en negrita la lista del foro (`estaSinLeer`). Sin las tablas, null:
// «no se sabe», no «nada nuevo» (la 319).
async function hilosConNovedades(uid) {
  const { data: subs, error } = await supabase.from('forum_subscriptions').select('thread_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(200)
  if (error) return null
  const ids = (subs || []).map((s) => s.thread_id).filter(Boolean)
  if (!ids.length) return { cuenta: 0 }
  const [marcas, { data: temas, error: e2 }] = await Promise.all([
    marcasDeLectura(uid),
    supabase.from('forum_threads').select('id, title, last_post_at, last_post_author_id').in('id', ids).order('last_post_at', { ascending: false }),
  ])
  if (e2 || !marcas.hayDatos) return null
  const nuevos = (temas || []).filter((t) => estaSinLeer(t, marcas))
  return { cuenta: nuevos.length, uno: nuevos[0]?.id || null, titulo: nuevos[0]?.title || '' }
}

async function intentar(fn) {
  try { return await fn() } catch { return undefined }
}

// Lo mismo que piden las ocho consultas de abajo, sacado de `portada_hoy()`
// (1017), en el mismo orden y con las mismas decisiones: la cita de una liga
// la sigue poniendo `proximaCita`, y qué va en «Sigue», `loQueTienesAMedias`.
async function deLaBase(d, uid, hoy, productosP) {
  const valor = (() => {
    const historia = Array.isArray(d.valor?.historia) ? d.valor.historia : []
    const ahora = d.valor?.ahora
    if (!ahora) return historia
    if (!Number(ahora.lineas)) return []
    return conElValorDeAhora(historia, ahora.valor, hoy)
  })()
  const conCita = (d.torneos || []).map((t) => ({ t, cita: proximaCita(t) })).filter((x) => x.cita)
  conCita.sort((a, b) => Date.parse(a.cita.fecha) - Date.parse(b.cita.fecha))
  const mio = conCita[0] ? { ...conCita[0].t, start_at: conCita[0].cita.fecha, jornada: conCita[0].cita.jornada } : null
  const sets = (d.sets || []).filter((s) => (!s.oculto || s.tcggo_id) && s.release_date)
  const sigue = loQueTienesAMedias(d.sigue?.progreso || [], (d.sigue?.mazos || []).map((m) => ({ ...m, cartas: Number(m.cartas) || 0 })))
  const hilos = d.hilos ? { cuenta: Number(d.hilos.cuenta) || 0, uno: d.hilos.uno || null, titulo: d.hilos.titulo || '' } : null
  const retos = await intentar(() => estadoDeHoy(uid, d.retos ?? null))
  return [valor, mio, d.abierto || null, sets, sigue, hilos, await productosP, retos]
}

export async function montarHoy(session, { doc = document } = {}) {
  const seccion = doc.getElementById('bienvenidaSeccion')
  // La caja que dejó la portada para lo de la última vez (984, `data-uv`) se
  // aprovecha: lo guardado se queda a la vista hasta que llega lo de ahora.
  const previa = doc.getElementById('hoyPortada')
  if (!session || !seccion || (previa && !previa.hasAttribute('data-uv'))) return null
  previa?.removeAttribute('data-uv')
  const hoja = hojaInyectada('css/hoy.css')
  const uid = session.user.id
  const caja = previa || doc.createElement('div')
  caja.className = 'hoy'
  caja.id = 'hoyPortada'
  caja.setAttribute('aria-label', 'Hoy')
  // El hueco con la forma de lo que llega (la tarjeta y las cuatro fichas):
  // si llegara de golpe, lo de debajo pegaría un salto.
  if (!caja.querySelector('.hoy-rejilla')) caja.innerHTML = `<h2 class="sr-only">Hoy</h2><div class="hoy-rejilla"><div class="skeleton hoy-esq-valor"></div>${'<div class="skeleton hoy-esq-ficha"></div>'.repeat(4)}</div>`
  // Con su hoja ya puesta (748): sin ella el hueco no mide nada y crece al
  // llegar, que es un salto más.
  await hoja
  if (!previa && doc.getElementById('hoyPortada')) return null
  if (!previa) seccion.appendChild(caja)

  const hoy = hoyISO()
  // Lo que valen tus productos (766), como lo suma el Panel: va aparte en
  // los dos caminos (su regla por idioma vive en js/productos.js, la 967).
  const productosP = intentar(async () => (await import('./productos-valor.js')).valorParaElPanel(uid))
  const datos = await datosDeHoy(uid)
  const [valor, mio, abierto, sets, sigue, hilos, productos, retos] = datos ? await deLaBase(datos, uid, hoy, productosP) : await Promise.all([
    intentar(async () => {
      const [historia, ahora] = await Promise.all([
        supabase.from('user_collection_value').select('dia,valor').eq('user_id', uid).gte('dia', hoyISO(Date.now() - 60 * DIA)).order('dia', { ascending: true }).then(({ data, error }) => (error ? null : data || [])),
        valorDeAhora(uid).catch(() => null),
      ])
      // Sin la suma de ahora, la foto, que es lo que había; sin las dos,
      // la tarjeta no sale. Sin líneas, la invitación.
      if (!ahora) return historia
      if (!ahora.lineas) return []
      return conElValorDeAhora(historia || [], ahora.total, hoy)
    }),
    // Tu próximo torneo, en dos pasos y no con un embebido: tus
    // inscripciones y luego esos torneos, los que no han acabado.
    intentar(async () => {
      const { data: insc } = await supabase.from('tournament_registrations').select('tournament_id').eq('user_id', uid).eq('status', 'active')
      const ids = [...new Set((insc || []).map((r) => r.tournament_id).filter(Boolean))]
      if (!ids.length) return null
      // Sin filtrar por `start_at` en la consulta (879): una liga empezó hace
      // semanas y su cita es la próxima JORNADA (`proximaCita`), que es lo
      // que se ordena. Son tus torneos vivos: pocos.
      const { data } = await supabase.from('tournaments').select('id, slug, name, start_at, status, format, matchday_dates').in('id', ids)
      const conCita = (data || []).map((t) => ({ t, cita: proximaCita(t) })).filter((x) => x.cita)
      conCita.sort((a, b) => Date.parse(a.cita.fecha) - Date.parse(b.cita.fecha))
      const x = conCita[0]
      return x ? { ...x.t, start_at: x.cita.fecha, jornada: x.cita.jornada } : null
    }),
    intentar(async () => {
      const { data } = await supabase.from('tournaments').select('id, slug, name, start_at').eq('status', 'registration_open').gte('start_at', new Date().toISOString()).order('start_at', { ascending: true }).limit(1)
      return (data || [])[0] || null
    }),
    intentar(async () => {
      const { data } = await supabase.from('tcg_sets').select('name,name_en,release_date,logo_tcggo,logo_scrydex,oculto,tcggo_id').eq('market', 'WEST').neq('serie_id', 'tcgp').gte('release_date', hoy).order('release_date').limit(3)
      // Las próximas de TCGGO nacen escondidas (756) y cuentan, como en
      // el calendario.
      return (data || []).filter((s) => (!s.oculto || s.tcggo_id) && s.release_date)
    }),
    intentar(() => aMedias(uid)),
    intentar(() => hilosConNovedades(uid)),
    productosP,
    // Los seis retos de hoy (843).
    intentar(() => estadoDeHoy(uid)),
  ])
  const torneo = mio ? { ...mio, mio: true } : abierto || null
  // El logo, el mismo que la miniatura de la portada sin cuenta (home.js).
  const lanzamiento = sets?.[0] ? { nombre: sets[0].name || sets[0].name_en, fecha: sets[0].release_date, logo: sets[0].logo_scrydex || sets[0].logo_tcggo || '' } : null
  caja.querySelector('.hoy-rejilla').innerHTML = valorHtml(valor ?? null, { productos: productos?.unidades ? productos.total : 0 }) + fichasHtml({ retos: retos ?? null, torneo, lanzamiento, hilos: hilos ?? null })
  // La cifra cuenta desde la de la última vez (783, MV2).
  const cifra = caja.querySelector('.hoy-valor b:not(.hoy-valor-invita)')
  if (cifra && valor?.length) {
    const total = Number(valor[valor.length - 1].valor) + (productos?.unidades ? Number(productos.total) || 0 : 0)
    import('./contar.js').then(({ contarCifra }) => contarCifra(cifra, 'valor', total, (n) => conMiles.format(n), caja.querySelector('.hoy-chispa'))).catch(() => {})
  }
  // En su hueco de la columna ancha (844); sin el hueco, debajo, como antes.
  const hueco = doc.getElementById('sigueSeccion')
  if (sigue?.length && hueco) {
    hueco.innerHTML = sigueHtml(sigue)
    hueco.classList.add('hoy-sigue')
    hueco.classList.remove('hidden')
  } else if (sigue?.length) caja.insertAdjacentHTML('beforeend', `<section class="hoy-sigue">${sigueHtml(sigue)}</section>`)
  return caja
}
