// LA PORTADA «HOY» (744, J5 de la lista de propuestas). Para quien tiene
// cuenta, la portada era una pila de bloques —bienvenida, primeros pasos,
// reto, torneo, foro, lanzamiento…— y lo de HOY había que ir a buscarlo
// bajando. Ahora, debajo del saludo con tu racha, un bloque con lo que
// cambia cada día: lo que vale tu colección con su línea de 30 días y
// cuatro fichas —el reto, tu próximo torneo, el próximo lanzamiento y las
// respuestas en tus hilos—. Lo de debajo sigue igual: es el detalle.
//
// Entra por `import()` desde home.js y solo con sesión, con su hoja: la
// portada tiene 0,4 KB de presupuesto y esto no los toca (la 704).
//
// Cada ficha se pinta con lo que haya y dice «no se sabe» con un guion, no
// con un cero (la 319): si una consulta falla, la ficha se queda, sin
// cifra inventada.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'
import { hojaInyectada } from './hoja.js'
import { lineasDeTodo, preciosGuardados, valorDeLineas } from './mi-coleccion/datos.js'
import { estadoDeHoy, fichaRetosHtml } from './portada-retos.js'
import { guideHasCourse } from './guia-contenido.js'
import { proximaCita } from './torneos/rondas-jornada.js'

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
// Hecho, 4 de 5».
const ficha = ({ href, icono, rotulo, titular, sub, hecho = false, destaca = false }) => `
  <a class="hoy-ficha${hecho ? ' hoy-hecho' : ''}${destaca ? ' hoy-destaca' : ''}" href="${escapeHtml(href)}" aria-label="${escapeHtml([rotulo, titular, sub].filter(Boolean).join(': '))}">
    <span class="hoy-ficha-icono" aria-hidden="true">${icons[icono]?.(22) || ''}</span>
    <b>${escapeHtml(titular)}</b>${sub ? `<span>${escapeHtml(sub)}</span>` : ''}
  </a>`

// Las horas que le quedan al reto de hoy (se cambia a medianoche).
const horasHastaMañana = (ahora = Date.now()) => {
  const d = new Date(ahora)
  return Math.max(1, Math.ceil((new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d) / 3600e3))
}

// Las cuatro fichas, con lo que se sepa de cada una. Puro.
export function fichasHtml({ reto = null, retos, torneo = null, lanzamiento = null, respuestas = null } = {}, ahora = Date.now()) {
  const quedan = `${horasHastaMañana(ahora)} h`
  const cuando = torneo ? cuandoEs(torneo.start_at, ahora) : ''
  // Con la hora si es hoy o mañana (879): «Torneo hoy a las 19:00».
  const hora = torneo && /^(hoy|mañana)$/.test(cuando) && Number.isFinite(Date.parse(torneo.start_at)) ? ` a las ${new Date(torneo.start_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''
  return [
    // Los seis retos (843) cuando se sabe lo de hoy; si no, la de antes.
    retos !== undefined
      ? fichaRetosHtml(retos)
      : ficha(
          reto
            ? { href: '/retos', icono: 'checkCircle', rotulo: 'Reto de hoy', titular: 'Reto del día', sub: `Hecho: ${reto.correct ?? 0} de ${reto.total ?? 5}`, hecho: true }
            : { href: '/retos', icono: 'lightbulb', rotulo: 'Reto de hoy', titular: 'Reto del día', sub: reto === null ? 'Cinco preguntas' : `Sin hacer · ${quedan}`, destaca: true }
        ),
    ficha(
      torneo
        ? { href: `/torneo?slug=${encodeURIComponent(torneo.slug)}`, icono: 'trophy', rotulo: torneo.mio ? 'Tu próximo torneo' : 'Próximo torneo', titular: /^\d/.test(cuando) ? `Torneo el ${cuando}` : `Torneo ${cuando}${hora}`, sub: torneo.jornada ? `${torneo.name} · jornada ${torneo.jornada}` : torneo.name }
        : { href: '/torneos.html', icono: 'trophy', rotulo: 'Torneos', titular: 'Torneos', sub: 'Ninguno a la vista' }
    ),
    ficha(
      lanzamiento
        ? { href: '/lanzamientos.html', icono: 'calendar', rotulo: 'Próximo lanzamiento', titular: `Sale ${cuandoEs(lanzamiento.fecha, ahora)}`, sub: lanzamiento.nombre }
        : { href: '/lanzamientos.html', icono: 'calendar', rotulo: 'Lanzamientos', titular: 'Lanzamientos', sub: 'El calendario' }
    ),
    ficha({
      href: '/foro.html',
      icono: 'messageSquare',
      rotulo: 'Tus hilos',
      titular: respuestas == null ? 'El foro' : respuestas ? `${respuestas} ${respuestas === 1 ? 'respuesta' : 'respuestas'}` : 'Nada nuevo',
      sub: respuestas == null ? 'De lo que se habla' : 'en tus hilos del foro',
    }),
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
  const bloques = Array.isArray(g.blocks) ? g.blocks.length : 0
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
// abriste) y el último mazo que tocaste si no llega a 60.
async function aMedias(uid) {
  const [{ data: filas }, { data: mazos }] = await Promise.all([
    supabase.from('user_progress').select('guide_id, current_block, status, started_at, read_at').eq('user_id', uid).neq('status', 'completed').not('started_at', 'is', null).order('started_at', { ascending: false }).limit(4),
    supabase.from('user_decks').select('id, name, cards, updated_at').eq('user_id', uid).order('updated_at', { ascending: false }).limit(3),
  ])
  const ids = (filas || []).map((f) => f.guide_id)
  const { data: guias } = ids.length ? await supabase.from('guides').select('id, slug, title, blocks, estimated_mins').in('id', ids) : { data: [] }
  const porId = Object.fromEntries((guias || []).map((g) => [g.id, g]))
  const items = (filas || [])
    .filter((f) => porId[f.guide_id] && !f.read_at)
    .slice(0, 2)
    .map((f) => ({ tipo: 'guia', guia: porId[f.guide_id], fila: f, curso: guideHasCourse(porId[f.guide_id]) }))
  const mazo = (mazos || []).map((m) => ({ ...m, n: (m.cards || []).reduce((t, c) => t + (Number(c.n) || 0), 0) })).find((m) => m.n > 0 && m.n !== 60)
  if (mazo) items.push({ tipo: 'mazo', id: mazo.id, nombre: mazo.name, cartas: mazo.n })
  return items
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

async function intentar(fn) {
  try { return await fn() } catch { return undefined }
}

export async function montarHoy(session, { doc = document } = {}) {
  const seccion = doc.getElementById('bienvenidaSeccion')
  if (!session || !seccion || doc.getElementById('hoyPortada')) return null
  const hoja = hojaInyectada('css/hoy.css')
  const uid = session.user.id
  const caja = doc.createElement('div')
  caja.className = 'hoy'
  caja.id = 'hoyPortada'
  caja.setAttribute('aria-label', 'Hoy')
  // El hueco con la forma de lo que llega (la tarjeta y las cuatro fichas):
  // si llegara de golpe, lo de debajo pegaría un salto.
  caja.innerHTML = `<h2 class="sr-only">Hoy</h2><div class="hoy-rejilla"><div class="skeleton hoy-esq-valor"></div>${'<div class="skeleton hoy-esq-ficha"></div>'.repeat(4)}</div>`
  // Con su hoja ya puesta (748): sin ella el hueco no mide nada y crece al
  // llegar, que es un salto más.
  await hoja
  if (doc.getElementById('hoyPortada')) return null
  seccion.appendChild(caja)

  const hoy = hoyISO()
  const [valor, reto, mio, abierto, sets, sigue, respuestas, productos, retos] = await Promise.all([
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
    intentar(async () => {
      const { data, error } = await supabase.from('daily_challenge_results').select('correct, total').eq('user_id', uid).eq('day', hoy).maybeSingle()
      return error ? null : data || false
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
      const { data } = await supabase.from('tcg_sets').select('name,name_en,release_date,oculto,tcggo_id').eq('market', 'WEST').neq('serie_id', 'tcgp').gte('release_date', hoy).order('release_date').limit(3)
      // Las próximas de TCGGO nacen escondidas (756) y cuentan, como en
      // el calendario.
      return (data || []).filter((s) => (!s.oculto || s.tcggo_id) && s.release_date)
    }),
    intentar(() => aMedias(uid)),
    intentar(async () => {
      const { count, error } = await supabase.from('user_notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', uid).eq('type', 'forum_reply').is('read_at', null)
      return error ? null : count ?? null
    }),
    // Lo que valen tus productos (766), como lo suma el Panel.
    intentar(async () => (await import('./productos-valor.js')).valorParaElPanel(uid)),
    // Los seis retos de hoy (843).
    intentar(() => estadoDeHoy(uid)),
  ])
  const torneo = mio ? { ...mio, mio: true } : abierto || null
  const lanzamiento = sets?.[0] ? { nombre: sets[0].name || sets[0].name_en, fecha: sets[0].release_date } : null
  caja.querySelector('.hoy-rejilla').innerHTML = valorHtml(valor ?? null, { productos: productos?.unidades ? productos.total : 0 }) + fichasHtml({ reto: reto === undefined ? null : reto, retos: retos ?? null, torneo, lanzamiento, respuestas: respuestas ?? null })
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
