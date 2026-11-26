// La cabecera de la ficha del torneo (tanda 1375, la versión 2 de «El torneo,
// renovado»; PINGU: «tiene que ser como una aplicación, que sea sencillo»).
// Dos cosas que antes se contaban con texto se cuentan ahora de un vistazo:
//
//  - el RELOJ, en una pastilla: cuánto falta para lo próximo («Empieza en
//    2 d 4 h», «Jornada 7 en 4 d 7 h») o en qué ronda va («En juego ·
//    Ronda 3»);
//  - las RAYITAS: una por jornada en una liga (o por ronda suiza en un
//    torneo de un día), hechas, la de ahora y las que faltan.
//
// Lo puro va primero y sin DOM, para probarlo en Node. Las jornadas se cuentan
// con `jornadasDeLiga` (la norma de la 1302: nada de otra cuenta).
import { escapeHtml } from '../html.js'
import { jornadasDeLiga } from './liga-en-curso.js'

// «4 d 7 h», «7 h 33 min», «33 min». Lo que ya pasó no tiene cuenta.
export function cuentaAtras(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const min = Math.max(1, Math.floor(ms / 60e3))
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d) return h ? `${d} d ${h} h` : `${d} d`
  if (h) return m ? `${h} h ${m} min` : `${h} h`
  return `${m} min`
}

const SIN_EMPEZAR = ['draft', 'registration_open', 'registration_closed']

// El DÍA del torneo (1469, «modo Hoy»): sin empezar, la fecha es hoy (en la
// hora de quien mira) y aún no ha llegado la hora. Ese día la ficha cambia de
// tono: la cuenta con segundos, «Hoy · 19:00», la entrada abierta y, en el
// móvil, lo que te falta en una barra fija abajo.
export function esDiaDelTorneo(t, ahora = Date.now()) {
  if (!t || !SIN_EMPEZAR.includes(t.status)) return false
  const ms = Date.parse(t.start_at || '')
  if (!Number.isFinite(ms) || ms <= ahora) return false
  return new Date(ms).toDateString() === new Date(ahora).toDateString()
}

// «2 h 14 min 07 s», «14 min 07 s», «07 s»: con segundos, que el día del
// torneo una cuenta que no se mueve parece rota.
export function cuentaConSegundos(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  if (h) return `${h} h ${m} min ${ss} s`
  if (m) return `${m} min ${ss} s`
  return `${ss} s`
}

// Lo que dice la pastilla, o null si no hay nada que contar (terminado,
// cancelado, sin fecha). `rondas`: las de la liga (jornadas.rondas); `ronda`:
// la viva o la última de un torneo de un día.
export function cuentaDeCabecera(t, { rondas = null, ronda = null, ahora = Date.now() } = {}) {
  if (!t || ['finished', 'cancelled'].includes(t.status)) return null
  if (esDiaDelTorneo(t, ahora)) {
    const hora = new Date(Date.parse(t.start_at)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return { rotulo: `Hoy · ${hora}`, valor: cuentaConSegundos(Date.parse(t.start_at) - ahora), hoy: true }
  }
  if (SIN_EMPEZAR.includes(t.status)) {
    // Con los minutos (1465): es la ÚNICA cuenta atrás de la ficha desde
    // que la sala dejó sus tres losas, y «22 d 21 h» parecía parada.
    const ms = Date.parse(t.start_at || '') - ahora
    const falta = cuentaAtras(ms)
    if (!falta) return null
    const min = Math.max(1, Math.floor(ms / 60e3))
    const d = Math.floor(min / 1440)
    return { rotulo: 'Empieza en', valor: d ? `${d} d ${Math.floor((min % 1440) / 60)} h ${min % 60} min` : falta }
  }
  if (t.format === 'league' && Array.isArray(rondas)) {
    const { siguiente } = jornadasDeLiga(t, rondas)
    if (siguiente?.estado === 'pendiente') {
      const falta = cuentaAtras(Date.parse(siguiente.fecha || '') - ahora)
      return falta ? { rotulo: `Jornada ${siguiente.n} en`, valor: falta } : { rotulo: `Jornada ${siguiente.n}`, valor: 'Por jugar' }
    }
    if (siguiente) return { rotulo: 'En juego', valor: `Jornada ${siguiente.n}` }
  }
  return ronda?.round_number ? { rotulo: 'En juego', valor: `Ronda ${ronda.round_number}` } : { rotulo: 'En juego', valor: 'Ahora' }
}

// Una rayita por jornada (liga) o por ronda suiza: 'h' hecha, 'a' la de
// ahora, '' las que faltan. Solo con el torneo en juego; antes no hay nada
// hecho y al final está todo.
export function rayitasDeTorneo(t, { rondas = null, ronda = null } = {}) {
  if (t?.status !== 'in_progress') return null
  if (t.format === 'league' && Array.isArray(rondas)) {
    const { lista, siguiente } = jornadasDeLiga(t, rondas)
    if (lista.length < 2 || lista.length > 30) return null
    return { que: 'Jornada', marcas: lista.map((j) => (j.estado === 'hecha' || j.estado === 'saltada' ? 'h' : j.n === siguiente?.n ? 'a' : '')) }
  }
  const total = Number(t.swiss_rounds) || 0
  if (total < 2 || total > 30) return null
  const n = ronda?.phase === 'top_cut' ? total + 1 : Number(ronda?.round_number) || 0
  return { que: 'Ronda', marcas: Array.from({ length: total }, (_, i) => (i + 1 < n || (i + 1 === n && ronda?.status === 'finished') ? 'h' : i + 1 === n ? 'a' : '')) }
}

// ── Lo que se pinta ──
// `pintarSiCambia` lo da la ficha: la cabecera se repinta en cada refresco
// (cada 10 s) y rehacerla sin cambios haría parpadear el reloj.
export function pintarCabecera(t, datos, pintarSiCambia) {
  const cuenta = cuentaDeCabecera(t, datos)
  const caja = document.getElementById('torneoCuenta')
  if (caja) {
    caja.classList.toggle('hidden', !cuenta)
    caja.classList.toggle('hoy', Boolean(cuenta?.hoy))
    if (cuenta) pintarSiCambia(caja, `<small>${escapeHtml(cuenta.rotulo)}</small><b>${escapeHtml(cuenta.valor)}</b>`)
  }
  const rayas = rayitasDeTorneo(t, datos)
  const tira = document.getElementById('torneoRayitas')
  if (!tira) return
  tira.classList.toggle('hidden', !rayas)
  if (!rayas) return
  const ahora = rayas.marcas.indexOf('a')
  const hechas = rayas.marcas.filter((m) => m === 'h').length
  tira.setAttribute('role', 'img')
  tira.setAttribute('aria-label', ahora >= 0 ? `${rayas.que} ${ahora + 1} de ${rayas.marcas.length}` : `${hechas} de ${rayas.marcas.length} jugadas`)
  pintarSiCambia(tira, rayas.marcas.map((m, i) => `<i class="${m}" title="${rayas.que === 'Jornada' ? 'J' : 'R'}${i + 1}"></i>`).join(''))
}
