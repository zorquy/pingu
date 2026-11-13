// «Ligas en curso» en /torneos (tanda 1303, la T1 que eligió PINGU: «al ser
// un torneo en proceso no se está viendo que ha habido jornadas»). Una
// tarjeta ancha por liga en marcha, encima de la lista: su portada, la tira
// de jornadas (hechas, la siguiente con su fecha), los tres primeros de la
// clasificación y el botón que toca.
//
// Se pinta en DOS tiempos para que no salte nada (la 981): la tarjeta entera
// sale con lo que la lista ya trae (las rondas de las ligas), y el podio y
// «N de M ya han mandado lista» caen después en su hueco, que mide lo mismo
// lleno que vacío.
import { escapeHtml } from '../html.js'
import { icons } from '../icons.js'
import { jornadasDeLiga, clasificacionDeLiga } from './liga-en-curso.js'
import { rondasPorJornada, rondaEnJornada } from './rondas-jornada.js'

const DIA_MS = 864e5
const ARTES = 6
// La misma cuenta que las tarjetas de la lista (arteDe en torneos.js), para
// que la liga lleve el mismo degradado en los dos sitios.
function arteDe(t) {
  const clave = String(t.slug || t.id || '')
  let suma = 0
  for (let i = 0; i < clave.length; i++) suma = (suma * 31 + clave.charCodeAt(i)) % 100000
  return (suma % ARTES) + 1
}

const diaCorto = (f) => new Date(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
const hora = (f) => new Date(f).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

// El día (local) de una fecha, como clave: «2026-11-13».
const diaDe = (x) => { const d = new Date(x); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

// Las jornadas de una liga como días de juego (1303): una entrada por jornada
// con su fecha en `start_at` y su número en `jornadaDeLiga`; la liga suelta
// solo si su comienzo no cae ya en una jornada. Para el calendario y la
// semana, que así nombran «Liga FDN · J6» en su día y a su hora.
export function conJornadas(torneos) {
  const salida = []
  for (const t of torneos || []) {
    const fechas = t.format === 'league' && Array.isArray(t.matchday_dates) ? t.matchday_dates.filter(Boolean) : []
    if (!fechas.length) { salida.push(t); continue }
    fechas.forEach((f, i) => salida.push({ ...t, start_at: f, jornadaDeLiga: i + 1 }))
    if (t.start_at && !fechas.some((f) => diaDe(f) === diaDe(t.start_at))) salida.push(t)
  }
  return salida
}

// «hoy», «mañana» o «jue 13 nov», por el día del navegador.
export function cuandoEs(fecha, ahora = Date.now()) {
  const f = Date.parse(fecha || '')
  if (!Number.isFinite(f)) return ''
  const dia = (x) => { const d = new Date(x); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
  const n = Math.round((dia(f) - dia(ahora)) / DIA_MS)
  return n === 0 ? 'hoy' : n === 1 ? 'mañana' : diaCorto(f)
}

// Lo que dice la chapa de la portada.
export function chapaDeLiga(j, ahora = Date.now()) {
  const s = j.siguiente
  if (!s) return 'Última jornada jugada'
  if (s.estado === 'en_juego') return `Jornada ${s.n} · en juego`
  const cuando = s.fecha ? cuandoEs(s.fecha, ahora) : ''
  return `Jornada ${s.n}${cuando ? ` · ${cuando}` : ''}`
}

// El botón: «Manda tu lista» si estás dentro y aún no la has mandado para la
// siguiente jornada; si no, «Ver la liga».
export function botonDeLiga(t, { inscrito = false, conLista = null, siguiente = null } = {}) {
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  if (inscrito && siguiente?.estado === 'pendiente' && conLista === false) return { texto: 'Manda tu lista', clase: 'btn-primary', href: `${url}#torneoMisJornadas` }
  return { texto: 'Ver la liga', clase: inscrito ? 'btn-primary' : 'btn-secondary', href: url }
}

// La tarjeta. `podio` es null mientras llega (el hueco ya está), [] si no hay
// puntos todavía, o filas { nombre, puntos }.
export function ligaFranjaHtml(t, rondas, { ahora = Date.now(), inscrito = false, conLista = null, podio = null, listas = null } = {}) {
  const j = jornadasDeLiga(t, rondas)
  const url = `/torneo?slug=${encodeURIComponent(t.slug)}`
  const s = j.siguiente
  const tira = j.lista
    .map((x) => {
      const clase = x === s ? (x.estado === 'en_juego' ? 'en-juego' : 'siguiente') : x.estado === 'hecha' ? 'hecha' : x.estado === 'saltada' ? 'saltada' : 'pendiente'
      const titulo = `Jornada ${x.n}${x.fecha ? ` · ${diaCorto(x.fecha)}` : ''}${x.estado === 'saltada' ? ' · no se jugó' : x.estado === 'hecha' ? ' · jugada' : ''}`
      return `<li class="lc-j lc-j-${clase}" title="${escapeHtml(titulo)}"><span class="sr-only">${escapeHtml(titulo)}</span><span aria-hidden="true">${x.n}</span></li>`
    })
    .join('')
  const ultima = [...j.lista].reverse().find((x) => x.fecha)?.fecha
  const datos = [
    `${j.hechas} ${j.hechas === 1 ? 'jugada' : 'jugadas'}`,
    s ? `Jornada ${s.n} de ${j.total}` : `${j.total} jornadas`,
    ultima ? `Termina el ${new Date(ultima).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')}` : '',
  ].filter(Boolean)
  const cita = s?.fecha
    ? `${icons.calendar(14)} <span>${escapeHtml(diaCorto(s.fecha))} · ${escapeHtml(hora(s.fecha))}</span>`
    : ''
  let boton = botonDeLiga(t, { inscrito, conLista, siguiente: s })
  // LA LIGA EN VIVO (1346, PINGU: «que se actualice la liga en curso y no que
  // haya dos cabeceras»): con su jornada jugándose, la tarjeta dice qué ronda,
  // lleva el reloj y, si juegas, «Ir a tu mesa». El aviso «Ronda 17 de 30» de
  // arriba ya no sale para una liga.
  const viva = s?.estado === 'en_juego' ? (rondas || []).find((r) => r.status === 'active') || null : null
  const k = rondasPorJornada(t)
  const vivoHtml = viva
    ? `<p class="lc-vivo"><span class="torneo-punto"></span><b>Jornada ${s.n}${k > 1 ? ` · ronda ${rondaEnJornada(t, viva.round_number)} de ${k}` : ''}</b>${viva.ends_at ? ` <span class="lc-vivo-reloj" data-lc-reloj="${escapeHtml(viva.ends_at)}">–:––</span>` : ''}</p>`
    : ''
  if (viva && inscrito) boton = { texto: 'Ir a tu mesa', clase: 'btn-primary', href: url }
  return `<article class="lc-tarjeta${viva ? ' lc-en-vivo' : ''}" data-liga="${escapeHtml(String(t.id))}">
    <a class="lc-portada torneo-arte torneo-arte-${arteDe(t)}" href="${url}" data-torneo="${escapeHtml(String(t.id))}" tabindex="-1" aria-hidden="true">
      ${t.image_url ? `<img class="torneo-arte-imagen" src="${escapeHtml(t.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'" />` : ''}
      <span class="lc-chapa">${escapeHtml(chapaDeLiga(j, ahora))}</span>
    </a>
    <div class="lc-cuerpo">
      <span class="lc-ceja">Liga en curso</span>
      <h3 class="lc-nombre"><a href="${url}">${escapeHtml(t.name)}</a></h3>
      ${vivoHtml}
      <ol class="lc-tira" aria-label="Jornadas de la liga">${tira}</ol>
      <p class="lc-datos">${escapeHtml(datos.join(' · '))}</p>
      ${cita ? `<p class="lc-cita">${cita}</p><p class="lc-listas" data-lc-listas>${listasHtml(listas, conLista)}</p>` : ''}
    </div>
    <div class="lc-lado">
      <ol class="lc-podio" aria-label="Los tres primeros" data-lc-podio>${podioHtml(podio)}</ol>
      <a class="${boton.clase} lc-boton" href="${boton.href}" data-lc-boton>${escapeHtml(boton.texto)}</a>
    </div>
  </article>`
}

// Tres filas SIEMPRE (las que faltan, vacías): el hueco mide lo mismo antes y
// después de llegar los datos.
export function podioHtml(podio) {
  return [0, 1, 2]
    .map((i) => {
      const p = podio?.[i]
      return p
        ? `<li class="lc-p"><span class="lc-p-pos">${i + 1}</span><span class="lc-p-nombre">${escapeHtml(p.nombre)}</span><b>${p.puntos}</b></li>`
        : `<li class="lc-p lc-p-vacia${podio ? '' : ' esq-linea'}" aria-hidden="true"><span class="lc-p-pos">${i + 1}</span><span class="lc-p-nombre"></span></li>`
    })
    .join('')
}

// Su propia línea, con el alto guardado aunque esté vacía (llega después).
export function listasHtml(listas, conLista = null) {
  const partes = []
  if (listas?.inscritos) partes.push(escapeHtml(`${listas.enviadas} de ${listas.inscritos} ya han mandado lista`))
  if (conLista) partes.push(`${icons.checkCircle(13)} la tuya, enviada`)
  return partes.join(' · ')
}

// Lo que llega después: la clasificación (para el podio), cuántos han
// mandado lista y si tú la has mandado. Una liga a la vez y sin romper nada
// si algo falla (se queda el hueco vacío, que no dice nada falso).
export async function completarLiga(supabase, caja, t, rondas, { userId = null, inscrito = false, inscritos = 0, gente = {} } = {}) {
  const j = jornadasDeLiga(t, rondas)
  const s = j.siguiente
  const ids = rondas.map((r) => r.id).filter(Boolean)
  const [insc, partidas, cuenta, mia] = await Promise.all([
    supabase.from('tournament_registrations').select('user_id, status').eq('tournament_id', t.id),
    ids.length ? supabase.from('tournament_matches').select('id, round_id, table_number, player_a_id, player_b_id, status, finished_at').in('round_id', ids) : Promise.resolve({ data: [] }),
    s?.estado === 'pendiente' ? supabase.rpc('liga_listas_jornada', { p_torneo: t.id, p_jornada: s.n }) : Promise.resolve({ data: null }),
    s?.estado === 'pendiente' && userId && inscrito
      ? supabase.from('tournament_matchday_decklists').select('user_id').eq('tournament_id', t.id).eq('matchday', s.n).eq('user_id', userId)
      : Promise.resolve({ data: null }),
  ])
  const matchIds = (partidas.data || []).map((m) => m.id)
  const res = matchIds.length ? await supabase.from('match_results').select('match_id, result').in('match_id', matchIds) : { data: [] }
  let podio = []
  if (!insc.error && !partidas.error && !res.error) {
    const tabla = clasificacionDeLiga(t, { inscripciones: insc.data || [], rondas, partidas: partidas.data || [], resultados: res.data || [] }).filter((e) => e.matchPoints > 0).slice(0, 3)
    const faltan = tabla.map((e) => e.playerId).filter((id) => !gente[id])
    if (faltan.length) {
      const { data } = await supabase.from('user_profiles').select('id, username').in('id', faltan)
      for (const p of data || []) gente[p.id] = p
    }
    podio = tabla.map((e) => ({ nombre: gente[e.playerId]?.username || 'Alguien', puntos: e.matchPoints }))
  }
  const hueco = caja.querySelector('[data-lc-podio]')
  if (hueco) hueco.innerHTML = podioHtml(podio)
  const conLista = mia.data ? mia.data.length > 0 : null
  const listas = !cuenta.error && Number.isFinite(cuenta.data) ? { enviadas: cuenta.data, inscritos } : null
  const sitio = caja.querySelector('[data-lc-listas]')
  if (sitio) sitio.innerHTML = listasHtml(listas, conLista)
  // En vivo (1346) el botón ya dice «Ir a tu mesa»: no se pisa.
  if (conLista !== null && !(inscrito && caja.classList.contains('lc-en-vivo'))) {
    const b = botonDeLiga(t, { inscrito, conLista, siguiente: s })
    const a = caja.querySelector('[data-lc-boton]')
    if (a) { a.className = `${b.clase} lc-boton`; a.href = b.href; a.textContent = b.texto }
  }
}
