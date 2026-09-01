// La página de torneos (/torneos): listar y crear. Parte del porte de
// TrainerArena (ver CLAUDE.md, sección «Jugar»). La creación va por el
// wizard de pasos del original, sin el paso de pago: aquí todo es
// gratis.
//
// MIENTRAS DURE LA PRUEBA es solo para admins: quien no lo sea sale
// rebotado a la portada antes de ver nada (y las políticas RLS de
// supabase-migration-torneos.sql cierran los datos por si acaso).
import { supabase } from '../supabase.js'
import { escapeHtml, getSession, getProfile, slugify, uploadProfileImage } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { officialStructure } from './motor.js'
import { ESTADOS, fechaBonita, textoFormato, puedeBorrarTorneo } from './comun.js'
import { borrarTorneo, anunciarBorrado, textoConfirmarBorrado } from './borrar.js'

const $ = (id) => document.getElementById(id)

// 32 caracteres de azar del navegador: la semilla que hace reproducibles
// el sorteo de ronda 1 y la moneda de los desempates.
function semillaDePareo() {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const valores = crypto.getRandomValues(new Uint8Array(32))
  return [...valores].map((v) => abc[v % abc.length]).join('')
}

// ── La lista ──

function tarjetaHtml(t, ocupadas, extra = '', puedeBorrar = false) {
  const estado = ESTADOS[t.status] || ESTADOS.draft
  const fecha = new Date(t.start_at)
  const mes = fecha.toLocaleString('es-ES', { month: 'short' }).replace('.', '')
  // max_players NULL = aforo sin límite (tanda 228): sin denominador no
  // hay barra de ocupación que pintar — se dice cuánta gente hay y ya.
  const sinLimite = t.max_players == null
  const porcentaje = sinLimite ? 0 : Math.min(100, (ocupadas / t.max_players) * 100)
  return `
  <a class="torneo-tarjeta" href="/torneo?slug=${encodeURIComponent(t.slug)}">
    ${
      // La imagen del torneo (tanda 239) ocupa el hueco del bloque de
      // fecha: la fecha ya se repite en texto justo debajo, así que no
      // se pierde nada. Si la imagen no carga se esconde — mejor sin
      // icono que con el icono roto del navegador.
      t.image_url
        ? `<img class="torneo-tarjeta-imagen" src="${escapeHtml(t.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
        : `<span class="torneo-fecha-bloque" aria-hidden="true"><strong>${fecha.getDate()}</strong><span>${escapeHtml(mes)}</span></span>`
    }
    <span class="torneo-texto">
      <strong>${escapeHtml(t.name)}</strong>
      <span class="subtext">${fechaBonita(t.start_at)} · ${t.format === 'league' ? `liga de ${t.swiss_rounds} jornadas` : `${t.swiss_rounds} suizas`}${t.top_cut_size ? ` + top ${t.top_cut_size}` : ''}</span>
      <span class="torneo-ocupacion">
        ${sinLimite ? '' : `<span class="torneo-ocupacion-barra"><span class="torneo-ocupacion-relleno" style="width:${porcentaje}%"></span></span>`}
        ${sinLimite ? `${ocupadas} inscrito${ocupadas === 1 ? '' : 's'} · sin límite` : `${ocupadas}/${t.max_players} plazas`}
      </span>
    </span>
    <span class="torneo-tarjeta-chapas">
      ${extra}
      <span class="torneo-estado ${estado.clase}">${estado.texto}</span>
      ${
        // Duplicar (tanda 218): la liga semanal se monta igual cada vez,
        // así que un torneo pasado sirve de plantilla. Va dentro del
        // enlace de la tarjeta, de ahí el preventDefault del manejador.
        ['finished', 'cancelled'].includes(t.status)
          ? `<button type="button" class="btn-secondary torneo-duplicar" data-duplicar="${escapeHtml(t.id)}">Duplicar</button>`
          : ''
      }
      ${
        // Borrar desde la lista (tanda 223): antes había que entrar a la
        // ficha para deshacerse de un torneo de prueba. Misma regla que
        // allí — admin del sitio o quien lo creó — y mismos dos toques.
        puedeBorrar
          ? `<button type="button" class="torneo-borrar torneo-borrar-fila" data-borrar="${escapeHtml(t.id)}" data-nombre="${escapeHtml(t.name)}" data-dentro="${ocupadas}">Borrar</button>`
          : ''
      }
    </span>
  </a>`
}

// La lista por PESTAÑAS (petición de los admins): Tus torneos, Abiertas,
// En juego, Terminados y — como aquí todos somos organizadores mientras
// dure la prueba — Borradores. Las vacías ni aparecen. El «Mis torneos»
// del menú de cuenta llega con #mios para abrir directamente la tuya.
let pestanaLista = window.location.hash === '#mios' ? 'mios' : null

function pintarGrupos(grupos) {
  const lista = $('listaTorneos')
  const conAlgo = grupos.filter((g) => g.filas.length)
  if (!conAlgo.length) {
    lista.innerHTML = ''
    return
  }
  if (!pestanaLista || !conAlgo.some((g) => g.id === pestanaLista)) pestanaLista = conAlgo[0].id
  const activa = conAlgo.find((g) => g.id === pestanaLista)
  lista.innerHTML = `
    <nav class="torneo-pestanas" aria-label="Grupos de torneos">
      ${conAlgo
        .map(
          (g) =>
            `<button class="torneo-pestana ${g.id === pestanaLista ? 'activa' : ''}" data-grupo="${g.id}">${g.texto} <span class="torneo-pestana-cuenta">${g.filas.length}</span></button>`
        )
        .join('')}
    </nav>
    ${activa.filas.join('')}
    ${activa.pie || ''}`
  lista.querySelectorAll('[data-grupo]').forEach((b) =>
    b.addEventListener('click', () => {
      pestanaLista = b.dataset.grupo
      pintarGrupos(grupos)
    })
  )
  // «Ver N más» de los terminados: levanta el corte y vuelve a pedir la
  // lista (no basta con repintar: las filas de más ni se construyeron).
  document.getElementById('btnVerMasTerminados')?.addEventListener('click', () => {
    verTodosLosTerminados = true
    recargarLista()
  })
}

// Cuántos torneos terminados se enseñan de golpe. Antes se cortaba en
// 10 y no había manera de ver el resto: el historial de la comunidad
// se perdía por el borde. Ahora el corte lo levanta un botón.
const TERMINADOS_DE_GOLPE = 10
let verTodosLosTerminados = false
// Quién está mirando, guardado para los repintados que nacen de un
// clic suelto («ver más», borrar una fila) y no tienen a mano ni la
// sesión ni el perfil.
let quienMira = { session: null, perfil: null }
const recargarLista = () => cargarLista(quienMira.session, quienMira.perfil)

async function cargarLista(session, perfil = null) {
  quienMira = { session, perfil }
  const vacio = $('torneosVacio')
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_at', { ascending: false })
    .limit(50)
  const torneos = data || []
  // El calendario pinta sobre esta misma lista: se guarda y, si es la
  // vista activa, se repinta con lo recién traído.
  torneosCargados = torneos
  pintarCalendario()

  // Una sola consulta da la ocupación de cada torneo Y mi estado (la
  // sección es solo-admins: la RLS deja leerlo todo).
  const { data: inscripciones } = await supabase
    .from('tournament_registrations')
    .select('tournament_id, user_id, status')
  const ocupadasDe = {}
  const miEstado = {}
  for (const i of inscripciones || []) {
    if (i.status === 'active') ocupadasDe[i.tournament_id] = (ocupadasDe[i.tournament_id] || 0) + 1
    if (i.user_id === session.user.id) miEstado[i.tournament_id] = i.status
  }

  vacio.classList.toggle('hidden', torneos.length > 0)

  const tarjeta = (t, extra = '') =>
    tarjetaHtml(t, ocupadasDe[t.id] || 0, extra, puedeBorrarTorneo(perfil, t, session?.user?.id))
  const mios = torneos
    .filter((t) => miEstado[t.id] && t.status !== 'draft')
    .map((t) =>
      tarjeta(
        t,
        `<span class="torneo-mio ${miEstado[t.id] === 'dropped' ? 'retirado' : ''}">${miEstado[t.id] === 'dropped' ? 'Retirado' : 'Inscrito'}</span>`
      )
    )
  const abiertas = torneos.filter((t) => t.status === 'registration_open').map((t) => tarjeta(t))
  const enJuego = torneos
    .filter((t) => ['registration_closed', 'in_progress'].includes(t.status))
    .map((t) => tarjeta(t))
  const acabados = torneos.filter((t) => ['finished', 'cancelled'].includes(t.status))
  const terminados = (verTodosLosTerminados ? acabados : acabados.slice(0, TERMINADOS_DE_GOLPE)).map((t) => tarjeta(t))
  const ocultos = acabados.length - terminados.length
  const borradores = torneos.filter((t) => t.status === 'draft').map((t) => tarjeta(t))

  pintarGrupos([
    { id: 'mios', texto: 'Tus torneos', filas: mios },
    { id: 'abiertas', texto: 'Abiertas', filas: abiertas },
    { id: 'enjuego', texto: 'En juego', filas: enJuego },
    {
      id: 'terminados',
      texto: 'Terminados',
      filas: terminados,
      pie: ocultos > 0 ? `<button type="button" class="btn-secondary torneo-ver-mas" id="btnVerMasTerminados">Ver ${ocultos} más</button>` : '',
    },
    { id: 'borradores', texto: 'Borradores', filas: borradores },
  ])
}

// ── El calendario anual (tanda 242, pedido por Ibai) ──
//
// El año entero, mes a mes, con los días de torneo en navy: la vista
// de «¿cuándo se juega?» que una lista ordenada no da. Se pinta de la
// MISMA lista ya cargada (nada de consultas nuevas); en una liga
// cuentan también sus jornadas, que son días de juego de verdad.
let torneosCargados = []
let vistaTorneos = localStorage.getItem('pokedoc-torneos-vista') === 'calendario' ? 'calendario' : 'lista'
// La ventana del calendario EMPIEZA en el mes actual (tanda 243): lo
// que importa es lo que viene, y lo pasado se alcanza con la flecha.
const hoyCal = new Date()
let inicioCalendario = { anio: hoyCal.getFullYear(), mes: hoyCal.getMonth() }

function claveDeDia(fecha) {
  const d = new Date(fecha)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function torneosPorDia() {
  const porDia = new Map()
  for (const t of torneosCargados) {
    if (t.status === 'cancelled') continue
    const fechas = [t.start_at]
    if (t.format === 'league' && Array.isArray(t.matchday_dates)) fechas.push(...t.matchday_dates)
    for (const f of fechas) {
      if (!f) continue
      const clave = claveDeDia(f)
      if (!porDia.has(clave)) porDia.set(clave, [])
      if (!porDia.get(clave).some((x) => x.id === t.id)) porDia.get(clave).push(t)
    }
  }
  return porDia
}

// `direccion` dice de dónde viene el cambio (−1 atrás, 1 adelante, 0
// primer pintado) y decide hacia dónde desliza la animación de entrada.
function pintarCalendario(direccion = 0) {
  const caja = $('torneosCalendario')
  if (!caja || vistaTorneos !== 'calendario') return
  const porDia = torneosPorDia()
  const hoy = claveDeDia(new Date())
  const mesDeHoy = `${hoyCal.getFullYear()}-${hoyCal.getMonth()}`

  // Doce meses SEGUIDOS desde la ventana actual: el primero es el mes
  // en el que estamos (o donde hayan llevado las flechas), y la ventana
  // cruza el cambio de año sin cortarse.
  const meses = []
  for (let i = 0; i < 12; i++) {
    const primero = new Date(inicioCalendario.anio, inicioCalendario.mes + i, 1)
    const anio = primero.getFullYear()
    const mes = primero.getMonth()
    const nombreMes = primero.toLocaleString('es-ES', { month: 'long' })
    const diasEnMes = new Date(anio, mes + 1, 0).getDate()
    // La semana empieza en lunes, como los calendarios de aquí.
    const hueco = (primero.getDay() + 6) % 7
    const celdas = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
      .map((d) => `<span class="torneo-cal-diasemana">${d}</span>`)
      .join('')
      .concat('<span></span>'.repeat(hueco))
    let dias = ''
    for (let dia = 1; dia <= diasEnMes; dia++) {
      const clave = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      const deEsteDia = porDia.get(clave)
      const esHoy = clave === hoy ? ' hoy' : ''
      dias += deEsteDia
        ? `<button type="button" class="torneo-cal-dia con-torneo${esHoy}" data-cal-dia="${clave}"
            title="${escapeHtml(deEsteDia.map((t) => t.name).join(' · '))}">${dia}</button>`
        : `<span class="torneo-cal-dia${esHoy}">${dia}</span>`
    }
    const esMesActual = `${anio}-${mes}` === mesDeHoy
    // El --i escalona la entrada de las tarjetas (25 ms por mes).
    meses.push(`<div class="torneo-cal-mes ${esMesActual ? 'actual' : ''}" style="--i:${i}">
      <h5>${escapeHtml(nombreMes)} <span class="torneo-cal-anio">${anio}</span>${esMesActual ? '<span class="torneo-cal-chapa-hoy">hoy</span>' : ''}</h5>
      <div class="torneo-cal-dias">${celdas}${dias}</div></div>`)
  }

  const fin = new Date(inicioCalendario.anio, inicioCalendario.mes + 11, 1)
  const rango = `${new Date(inicioCalendario.anio, inicioCalendario.mes, 1).toLocaleString('es-ES', { month: 'long' })} ${inicioCalendario.anio} — ${fin.toLocaleString('es-ES', { month: 'long' })} ${fin.getFullYear()}`
  const enHoy = inicioCalendario.anio === hoyCal.getFullYear() && inicioCalendario.mes === hoyCal.getMonth()
  const claseEntrada = direccion > 0 ? 'cal-entra-der' : direccion < 0 ? 'cal-entra-izq' : 'cal-entra'
  caja.innerHTML = `
    <div class="torneo-cal-cabecera">
      <button type="button" class="btn-secondary" data-cal-mes="-1" aria-label="Mes anterior">←</button>
      <strong class="torneo-cal-rango">${escapeHtml(rango)}</strong>
      <button type="button" class="btn-secondary ${enHoy ? 'hidden' : ''}" data-cal-hoy>Hoy</button>
      <button type="button" class="btn-secondary" data-cal-mes="1" aria-label="Mes siguiente">→</button>
    </div>
    <div class="torneo-cal-meses ${claseEntrada}">${meses.join('')}</div>
    <div id="torneoCalDia"></div>`

  caja.querySelectorAll('[data-cal-mes]').forEach((b) =>
    b.addEventListener('click', () => {
      const paso = Number(b.dataset.calMes)
      const d = new Date(inicioCalendario.anio, inicioCalendario.mes + paso, 1)
      inicioCalendario = { anio: d.getFullYear(), mes: d.getMonth() }
      pintarCalendario(paso)
    })
  )
  caja.querySelector('[data-cal-hoy]')?.addEventListener('click', () => {
    const atras = inicioCalendario.anio * 12 + inicioCalendario.mes > hoyCal.getFullYear() * 12 + hoyCal.getMonth()
    inicioCalendario = { anio: hoyCal.getFullYear(), mes: hoyCal.getMonth() }
    pintarCalendario(atras ? -1 : 1)
  })
  caja.querySelectorAll('[data-cal-dia]').forEach((b) =>
    b.addEventListener('click', () => {
      const clave = b.dataset.calDia
      const lista = porDia.get(clave) || []
      // La clave es un día, no un instante: se construye la fecha LOCAL
      // a mano (parsear '2026-08-30' a secas la haría UTC y saldría una
      // hora fantasma en el título).
      const [a, m, d] = clave.split('-').map(Number)
      const titulo = new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      // El día elegido se marca en la rejilla y el panel entra animado.
      caja.querySelectorAll('.torneo-cal-dia.elegido').forEach((x) => x.classList.remove('elegido'))
      b.classList.add('elegido')
      $('torneoCalDia').innerHTML = `
        <div class="torneo-cal-dia-panel">
        <h4 class="torneo-cal-dia-titulo">${escapeHtml(titulo[0].toUpperCase() + titulo.slice(1))}</h4>
        ${lista
          .map(
            (t) => `
          <a class="torneo-cal-torneo" href="/torneo?slug=${encodeURIComponent(t.slug)}">
            ${
              t.image_url
                ? `<img class="torneo-tarjeta-imagen" src="${escapeHtml(t.image_url)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
                : ''
            }
            <span class="torneo-cal-torneo-nombre"><strong>${escapeHtml(t.name)}</strong>
              <span class="subtext">${escapeHtml(fechaBonita(t.start_at))}</span></span>
            <span class="torneo-estado ${(ESTADOS[t.status] || ESTADOS.draft).clase}">${(ESTADOS[t.status] || ESTADOS.draft).texto}</span>
          </a>`
          )
          .join('')}
        </div>`
      $('torneoCalDia').scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  )
}

// El conmutador Lista/Calendario. La elección se recuerda por
// navegador: quien piensa en fechas vuelve a encontrarse su calendario.
function engancharVistas() {
  const aplicar = () => {
    document.querySelectorAll('[data-vista-torneos]').forEach((b) =>
      b.classList.toggle('activa', b.dataset.vistaTorneos === vistaTorneos)
    )
    const calendario = vistaTorneos === 'calendario'
    $('torneosCalendario').classList.toggle('hidden', !calendario)
    $('listaTorneos').classList.toggle('hidden', calendario)
    if (calendario) $('torneosVacio').classList.add('hidden')
    pintarCalendario()
  }
  document.querySelectorAll('[data-vista-torneos]').forEach((b) =>
    b.addEventListener('click', () => {
      vistaTorneos = b.dataset.vistaTorneos
      localStorage.setItem('pokedoc-torneos-vista', vistaTorneos)
      aplicar()
    })
  )
  aplicar()
}

// ── El wizard de crear (3 pasos, como el original sin el de pago) ──

const PASOS_WIZARD = ['Básicos', 'Formato', 'Tiempos']
let pasoActual = 0

function pintarPasos() {
  $('wizardPasos').innerHTML = PASOS_WIZARD.map((texto, i) => {
    const clase = i < pasoActual ? 'hecho' : i === pasoActual ? 'actual' : ''
    const numero = i < pasoActual ? icons.checkCircle(14) : `<span class="torneo-wizard-numero">${i + 1}</span>`
    return `<span class="torneo-wizard-paso ${clase}">${numero}<span>${texto}</span></span>`
  }).join('')
}

function irAPaso(n) {
  pasoActual = n
  document.querySelectorAll('#torneoForm [data-paso]').forEach((s) => {
    s.classList.toggle('hidden', Number(s.dataset.paso) !== n)
  })
  pintarPasos()
  $('btnPasoAtras').classList.toggle('hidden', n === 0)
  $('btnPasoSiguiente').classList.toggle('hidden', n === PASOS_WIZARD.length - 1)
  $('btnCrearTorneo').classList.toggle('hidden', n !== PASOS_WIZARD.length - 1)
  if (n === PASOS_WIZARD.length - 1) pintarResumen()
}

// ── Las jornadas de una liga (tanda 219; añadir/quitar en la 220) ──
// En formato liga cada ronda suiza es una JORNADA con fecha propia: los
// campos se regeneran al cambiar el tipo o el número de rondas, sin
// perder lo ya escrito, y cada fila lleva su «Quitar» (si queda más de
// una) además del botón de añadir — el número de rondas y la lista de
// jornadas son la misma cosa y se mantienen a la par.
function esLigaElegida() {
  return $('torneoTipo').value === 'league'
}

// ── El aforo sin límite (tanda 228) ──
// Marcar «Sin límite» apaga el campo de plazas y guarda max_players a
// NULL: nunca hay «lleno» ni lista de espera. La sugerencia de rondas
// que aquí sale de las plazas llega entonces al CERRAR las
// inscripciones (en la ficha), que es cuando se sabe cuánta gente hay.
function sinLimiteElegido() {
  return $('torneoSinLimite').checked
}

function pintarSinLimite() {
  $('torneoPlazas').disabled = sinLimiteElegido()
}

function pintarCamposJornadas(fechas = null) {
  const caja = $('torneoJornadasCampos')
  const liga = esLigaElegida()
  caja.classList.toggle('hidden', !liga)
  $('torneoRondasEtiqueta').firstChild.textContent = liga ? 'Jornadas' : 'Rondas suizas'
  if (!liga) return
  const cuantas = Math.min(12, Math.max(1, Number($('torneoRondas').value) || 1))
  const lista = $('torneoJornadasLista')
  const previas = fechas ?? [...lista.querySelectorAll('input')].map((i) => i.value)
  lista.innerHTML = Array.from({ length: cuantas }, (_, i) => `
    <div class="torneo-jornada-campo">
      <label>Jornada ${i + 1}
        <input type="datetime-local" data-jornada="${i}" value="${escapeHtml(previas[i] || '')}" />
      </label>
      ${cuantas > 1 ? `<button type="button" class="btn-secondary torneo-quitar-jornada" data-quitar-jornada="${i}" title="Quitar esta jornada">✕</button>` : ''}
    </div>`).join('')
  lista.querySelectorAll('[data-quitar-jornada]').forEach((b) =>
    b.addEventListener('click', () => {
      const sinEsa = fechasDeJornadas().filter((_, i) => i !== Number(b.dataset.quitarJornada))
      $('torneoRondas').value = String(sinEsa.length)
      pintarCamposJornadas(sinEsa)
    })
  )
}

function fechasDeJornadas() {
  return [...document.querySelectorAll('#torneoJornadasLista input')].map((i) => i.value)
}

// Valida lo que se ve antes de dejar avanzar, como el original.
function pasoValido(n) {
  if (n === 0) {
    if (!$('torneoNombre').value.trim()) {
      showToast('Ponle un nombre al torneo.')
      return false
    }
    if (!$('torneoFecha').value) {
      showToast('Ponle fecha y hora de inicio.')
      return false
    }
    return true
  }
  if (n === 1) {
    const plazas = Number($('torneoPlazas').value)
    if (!sinLimiteElegido() && (!plazas || plazas < 4 || plazas > 256)) {
      showToast('Las plazas deben estar entre 4 y 256 (o marca «Sin límite»).')
      return false
    }
    const rondas = Number($('torneoRondas').value)
    if (!rondas || rondas < 1 || rondas > 12) {
      showToast('Las rondas suizas deben estar entre 1 y 12.')
      return false
    }
    if (esLigaElegida()) {
      const fechas = fechasDeJornadas()
      if (fechas.some((f) => !f)) {
        showToast('Ponle fecha a todas las jornadas de la liga.')
        return false
      }
      for (let i = 1; i < fechas.length; i++) {
        if (new Date(fechas[i]) <= new Date(fechas[i - 1])) {
          showToast(`La jornada ${i + 1} no puede ir antes que la ${i}.`)
          return false
        }
      }
    }
    return true
  }
  return true
}

// Los tres modos de las listas (tanda 241), con su texto para el
// resumen del wizard.
const TEXTO_MODO_LISTAS = {
  al_terminar: 'Públicas al terminar',
  en_juego: 'Públicas desde la ronda 1',
  nunca: 'Nunca públicas',
}

// Sin corte no hay «al mejor de» que elegir: el campo se esconde
// cuando el corte es 0 (lo pidió Ibai en la tanda 241).
function pintarCorteBo() {
  $('torneoCorteBoCampo').classList.toggle('hidden', !Number($('torneoCorte').value))
}

function pintarResumen() {
  const corte = Number($('torneoCorte').value)
  const liga = esLigaElegida()
  const datos = [
    ['Nombre', $('torneoNombre').value.trim() || '—'],
    ['Tipo', liga ? 'Liga por jornadas' : 'Torneo de un día'],
    ['Inicio', $('torneoFecha').value ? fechaBonita($('torneoFecha').value) : '—'],
    ['Plazas', sinLimiteElegido() ? 'Sin límite' : $('torneoPlazas').value],
    [liga ? 'Jornadas' : 'Suizas', `${$('torneoRondas').value} · BO${$('torneoSwissBo').value}`],
    ['Top cut', corte ? `Top ${corte} · BO${$('torneoCorteBo').value}` : 'Sin corte'],
    ['Ronda', `${$('torneoMinutos').value} min`],
    ['Check-in', `${$('torneoCheckin').value} min`],
    ['Listas rivales', TEXTO_MODO_LISTAS[$('torneoListasModo').value] || '—'],
    ['Inscripción', 'Gratuita'],
  ]
  if (liga) {
    fechasDeJornadas().forEach((f, i) => {
      if (f) datos.splice(5 + i, 0, [`Jornada ${i + 1}`, fechaBonita(f)])
    })
  }
  $('wizardResumen').innerHTML = datos
    .map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${escapeHtml(String(dd))}</dd></div>`)
    .join('')
}

// ── La descripción con formato (tanda 220) ──
// El mismo editor del foro: negrita, listas, colores, imágenes… Los dos
// módulos del editor se cargan al ABRIR el wizard, no antes (quien solo
// mira la lista de torneos no los paga). El HTML sale saneado por la
// misma lista cerrada que las guías y el foro.
let descripcionHtml = ''
async function montarEditorDescripcion(session, htmlInicial = '') {
  descripcionHtml = htmlInicial
  const [{ richTextToolbarHtml, initRichTextEditor }] = await Promise.all([import('../richtext-editor.js')])
  const { uploadGuideImage } = await import('../app.js')
  const barra = $('torneoDescBarra')
  barra.innerHTML = richTextToolbarHtml()
  initRichTextEditor({
    toolbarEl: barra,
    surfaceEl: $('torneoDescCuerpo'),
    initialHtml: htmlInicial,
    placeholder: 'Reglas de la casa, premios…',
    onChange: (html) => {
      descripcionHtml = html
    },
    uploadImage: (file) => uploadGuideImage(session.user.id, file),
  })
}

function engancharFormulario(session, perfil) {
  const form = $('torneoForm')
  const plazas = $('torneoPlazas')

  $('btnNuevoTorneo').addEventListener('click', () => {
    form.classList.toggle('hidden')
    if (!form.classList.contains('hidden')) {
      irAPaso(0)
      void montarEditorDescripcion(session, '')
      $('torneoNombre').focus()
    }
  })
  // Borrar desde la tarjeta (tanda 223). Dos toques como en la ficha: el
  // primero avisa —y dice a cuánta gente afecta—, el segundo va. La
  // tarjeta es un enlace al torneo, de ahí el preventDefault.
  document.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-borrar]')
    if (!boton) return
    e.preventDefault()
    const dentro = Number(boton.dataset.dentro || 0)
    if (boton.dataset.confirmar !== '1') {
      boton.dataset.confirmar = '1'
      boton.textContent = textoConfirmarBorrado(dentro)
      return
    }
    boton.disabled = true
    const { error, diferido } = await borrarTorneo(boton.dataset.borrar, dentro)
    if (error) {
      boton.disabled = false
      boton.dataset.confirmar = ''
      boton.textContent = 'Borrar'
      showToast(`No se ha podido borrar: ${error.message}`, 'error')
      return
    }
    showToast(
      diferido
        ? `«${boton.dataset.nombre}» cancelado. Se avisa a ${dentro} inscrito${dentro === 1 ? '' : 's'} y desaparece en un minuto.`
        : `«${boton.dataset.nombre}» borrado.`,
      'success'
    )
    await recargarLista()
  })

  // Duplicar: abre el wizard con la estructura del torneo elegido y el
  // nombre listo para retocar. La fecha NO se copia (un torneo nuevo
  // nunca empieza en el pasado): se propone la semana que viene.
  document.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-duplicar]')
    if (!boton) return
    e.preventDefault()
    const { data: viejo } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', boton.dataset.duplicar)
      .maybeSingle()
    if (!viejo) return
    form.classList.remove('hidden')
    irAPaso(0)
    $('torneoNombre').value = viejo.name
    // El tipo y la visibilidad de listas se copian; las fechas de las
    // jornadas no (una liga nueva se juega en días nuevos).
    $('torneoTipo').value = viejo.format === 'league' ? 'league' : 'standard'
    $('torneoListasModo').value = viejo.decklist_visibility || (viejo.show_opponent_decklists ? 'en_juego' : 'al_terminar')
    const semanaQueViene = new Date(Date.now() + 7 * 86400e3)
    semanaQueViene.setMinutes(semanaQueViene.getMinutes() - semanaQueViene.getTimezoneOffset())
    $('torneoFecha').value = semanaQueViene.toISOString().slice(0, 16)
    $('torneoSinLimite').checked = viejo.max_players == null
    $('torneoPlazas').value = viejo.max_players ?? 16
    pintarSinLimite()
    $('torneoRondas').value = viejo.swiss_rounds
    $('torneoCorte').value = String(viejo.top_cut_size ?? 0)
    pintarCorteBo()
    if ($('torneoMinutos')) $('torneoMinutos').value = viejo.round_time_minutes
    if ($('torneoCheckin') && viejo.checkin_minutes != null) $('torneoCheckin').value = viejo.checkin_minutes
    void montarEditorDescripcion(session, viejo.description || '')
    pintarCamposJornadas()
    $('torneoNombre').focus()
    $('torneoNombre').select()
    showToast('Plantilla cargada: cambia lo que quieras y créalo.', 'success')
  })

  $('btnCancelarTorneo').addEventListener('click', () => form.classList.add('hidden'))
  $('btnPasoAtras').addEventListener('click', () => irAPaso(pasoActual - 1))
  $('btnPasoSiguiente').addEventListener('click', () => {
    if (pasoValido(pasoActual)) irAPaso(pasoActual + 1)
  })

  // Al cambiar las plazas, la tabla oficial rellena rondas y corte; el
  // admin puede retocarlos después si quiere otra cosa.
  plazas.addEventListener('input', () => {
    const n = Number(plazas.value)
    if (!n || n < 4) return
    const { swissRounds, topCutSize } = officialStructure(n)
    $('torneoRondas').value = swissRounds
    const corte = $('torneoCorte')
    if ([...corte.options].some((o) => Number(o.value) === topCutSize)) corte.value = String(topCutSize)
    pintarCorteBo()
    pintarCamposJornadas()
  })
  $('torneoCorte').addEventListener('change', pintarCorteBo)
  $('torneoSinLimite').addEventListener('change', pintarSinLimite)
  // El tipo y el número de rondas gobiernan los campos de jornadas.
  $('torneoTipo').addEventListener('change', () => pintarCamposJornadas())
  $('torneoRondas').addEventListener('input', () => pintarCamposJornadas())
  $('btnAnadirJornada').addEventListener('click', () => {
    const fechas = fechasDeJornadas()
    if (fechas.length >= 12) {
      showToast('Una liga puede tener 12 jornadas como máximo.')
      return
    }
    $('torneoRondas').value = String(fechas.length + 1)
    pintarCamposJornadas([...fechas, ''])
  })

  // La imagen del torneo (tanda 239): se elige con vista previa y se
  // sube al bucket de avatares (carpeta del usuario, como la foto de
  // perfil) SOLO al crear — elegir y arrepentirse no debe dejar
  // ficheros huérfanos en Storage.
  let imagenElegida = null
  let bannerElegido = null
  // El icono y el banner comparten el mismo trío de piezas
  // (previa/elegir/quitar): un solo montador para los dos.
  function montarCampoImagen(prefijo, alCambiar) {
    const preview = $(`${prefijo}Preview`)
    const input = $(`${prefijo}Input`)
    const boton = $(`btn${prefijo[0].toUpperCase()}${prefijo.slice(1)}`)
    const quitar = $(`btn${prefijo[0].toUpperCase()}${prefijo.slice(1)}Quitar`)
    const esBanner = /Banner/.test(prefijo)
    const pintar = (fichero) => {
      if (fichero) preview.src = URL.createObjectURL(fichero)
      preview.classList.toggle('hidden', !fichero)
      quitar.classList.toggle('hidden', !fichero)
      boton.textContent = fichero ? (esBanner ? 'Cambiar banner' : 'Cambiar imagen') : esBanner ? 'Elegir banner' : 'Elegir imagen'
    }
    boton.addEventListener('click', () => input.click())
    input.addEventListener('change', () => {
      const f = input.files?.[0] || null
      alCambiar(f)
      pintar(f)
    })
    quitar.addEventListener('click', () => {
      input.value = ''
      alCambiar(null)
      pintar(null)
    })
    return pintar
  }
  const pintarImagenElegida = montarCampoImagen('torneoImagen', (f) => (imagenElegida = f))
  const pintarBannerElegido = montarCampoImagen('torneoBanner', (f) => (bannerElegido = f))

  let enviando = false
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (enviando) return
    if (!pasoValido(0) || !pasoValido(1)) return
    const nombre = $('torneoNombre').value.trim()
    const liga = esLigaElegida()
    enviando = true
    // Primero la imagen: si la subida falla, el torneo NO se crea a
    // medias — se avisa y se deja reintentar con todo lo escrito.
    let imageUrl = null
    let bannerUrl = null
    try {
      if (imagenElegida) imageUrl = await uploadProfileImage(session.user.id, imagenElegida, 'torneo')
      if (bannerElegido) bannerUrl = await uploadProfileImage(session.user.id, bannerElegido, 'torneo-banner')
    } catch (err) {
      enviando = false
      showToast('No se ha podido subir la imagen: ' + (err?.message || err), 'error')
      return
    }
    // El modo de listas se guarda por partida doble: la columna nueva
    // (la que manda) y el booleano viejo, que la política RLS y el
    // código anterior a la migración siguen leyendo.
    const modoListas = $('torneoListasModo').value
    const fila = {
      decklist_visibility: modoListas,
      image_url: imageUrl,
      banner_url: bannerUrl,
      slug: `${slugify(nombre)}-${Date.now().toString(36)}`,
      admin_id: session.user.id,
      name: nombre,
      description: descripcionHtml || null,
      start_at: new Date($('torneoFecha').value).toISOString(),
      status: 'draft',
      format: liga ? 'league' : 'standard',
      matchday_dates: liga ? fechasDeJornadas().map((f) => new Date(f).toISOString()) : null,
      show_opponent_decklists: modoListas === 'en_juego',
      max_players: sinLimiteElegido() ? null : Number($('torneoPlazas').value),
      swiss_rounds: Number($('torneoRondas').value),
      round_time_minutes: Number($('torneoMinutos').value),
      checkin_minutes: Number($('torneoCheckin').value),
      swiss_bo: Number($('torneoSwissBo').value),
      top_cut_bo: Number($('torneoCorteBo').value),
      top_cut_size: Number($('torneoCorte').value),
      pairing_seed: semillaDePareo(),
    }
    let { error } = await supabase.from('tournaments').insert(fila)
    // Entre el despliegue y que un humano ejecute las migraciones de
    // las columnas nuevas pueden pasar horas, y en ese rato crear
    // torneos tiene que seguir funcionando: si la base no conoce una
    // columna, se reintenta sin ella (del modo de listas queda el
    // booleano viejo, que dice lo mismo salvo el «nunca»).
    for (const columna of ['decklist_visibility', 'image_url', 'banner_url']) {
      if (error && (error.message || '').includes(columna)) {
        delete fila[columna]
        ;({ error } = await supabase.from('tournaments').insert(fila))
      }
    }
    enviando = false
    if (error) {
      showToast(
        /tournaments/.test(error.message || '')
          ? 'Falta ejecutar supabase-migration-torneos.sql en el SQL Editor de Supabase.'
          : 'No se ha podido crear: ' + error.message,
        'error'
      )
      return
    }
    form.classList.add('hidden')
    form.reset()
    // El reset del formulario no llega al contenteditable del editor,
    // ni a la imagen elegida (vive en una variable, no en el input).
    descripcionHtml = ''
    $('torneoDescCuerpo').innerHTML = ''
    imagenElegida = null
    bannerElegido = null
    pintarImagenElegida(null)
    pintarBannerElegido(null)
    pintarCorteBo()
    pintarCamposJornadas()
    pintarSinLimite()
    irAPaso(0)
    showToast(`«${nombre}» creado como borrador. Abre las inscripciones cuando esté listo.`, 'success')
    cargarLista(session, perfil)
  })
}

async function init() {
  const session = await getSession()
  const perfil = session ? await getProfile(session.user.id) : null
  if (!perfil?.is_admin) {
    window.location.href = '/index.html'
    return
  }
  document.getElementById('torneosContenido').style.display = ''
  // El aviso de «borrado» lo deja la ficha antes de traernos aquí: allí
  // no se podía enseñar, porque la página que lo diría ya no existe.
  const borrado = sessionStorage.getItem('torneo-borrado')
  if (borrado) {
    const avisados = Number(sessionStorage.getItem('torneo-borrado-inscritos') || 0)
    sessionStorage.removeItem('torneo-borrado')
    sessionStorage.removeItem('torneo-borrado-inscritos')
    // Con gente dentro el borrado es diferido (tanda 223): primero se
    // les avisa y luego desaparece. Decirlo, para que no extrañe verlo
    // todavía ahí un minuto más.
    showToast(
      avisados
        ? `«${borrado}» cancelado. Se avisa a ${avisados} inscrito${avisados === 1 ? '' : 's'} y desaparece en un minuto.`
        : `«${borrado}» borrado.`,
      'success'
    )
  }
  engancharFormulario(session, perfil)
  engancharVistas()
  await cargarLista(session, perfil)
}

init()
