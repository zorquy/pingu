// La página de torneos (/torneos): listar y crear. Parte del porte de
// TrainerArena (ver CLAUDE.md, sección «Jugar»). La creación va por el
// wizard de pasos del original, sin el paso de pago: aquí todo es
// gratis.
//
// MIENTRAS DURE LA PRUEBA es solo para admins: quien no lo sea sale
// rebotado a la portada antes de ver nada (y las políticas RLS de
// supabase-migration-torneos.sql cierran los datos por si acaso).
import { supabase } from '../supabase.js'
import { escapeHtml, getSession, getProfile, slugify } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { officialStructure } from './motor.js'
import { ESTADOS, fechaBonita, textoFormato } from './comun.js'

const $ = (id) => document.getElementById(id)

// 32 caracteres de azar del navegador: la semilla que hace reproducibles
// el sorteo de ronda 1 y la moneda de los desempates.
function semillaDePareo() {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const valores = crypto.getRandomValues(new Uint8Array(32))
  return [...valores].map((v) => abc[v % abc.length]).join('')
}

// ── La lista ──

function tarjetaHtml(t, ocupadas, extra = '') {
  const estado = ESTADOS[t.status] || ESTADOS.draft
  const fecha = new Date(t.start_at)
  const mes = fecha.toLocaleString('es-ES', { month: 'short' }).replace('.', '')
  const porcentaje = Math.min(100, (ocupadas / t.max_players) * 100)
  return `
  <a class="torneo-tarjeta" href="/torneo?slug=${encodeURIComponent(t.slug)}">
    <span class="torneo-fecha-bloque" aria-hidden="true"><strong>${fecha.getDate()}</strong><span>${escapeHtml(mes)}</span></span>
    <span class="torneo-texto">
      <strong>${escapeHtml(t.name)}</strong>
      <span class="subtext">${fechaBonita(t.start_at)} · ${t.format === 'league' ? `liga de ${t.swiss_rounds} jornadas` : `${t.swiss_rounds} suizas`}${t.top_cut_size ? ` + top ${t.top_cut_size}` : ''}</span>
      <span class="torneo-ocupacion">
        <span class="torneo-ocupacion-barra"><span class="torneo-ocupacion-relleno" style="width:${porcentaje}%"></span></span>
        ${ocupadas}/${t.max_players} plazas
      </span>
    </span>
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
    ${activa.filas.join('')}`
  lista.querySelectorAll('[data-grupo]').forEach((b) =>
    b.addEventListener('click', () => {
      pestanaLista = b.dataset.grupo
      pintarGrupos(grupos)
    })
  )
}

async function cargarLista(session) {
  const vacio = $('torneosVacio')
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_at', { ascending: false })
    .limit(50)
  const torneos = data || []

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

  const tarjeta = (t, extra = '') => tarjetaHtml(t, ocupadasDe[t.id] || 0, extra)
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
  const terminados = torneos
    .filter((t) => ['finished', 'cancelled'].includes(t.status))
    .slice(0, 10)
    .map((t) => tarjeta(t))
  const borradores = torneos.filter((t) => t.status === 'draft').map((t) => tarjeta(t))

  pintarGrupos([
    { id: 'mios', texto: 'Tus torneos', filas: mios },
    { id: 'abiertas', texto: 'Abiertas', filas: abiertas },
    { id: 'enjuego', texto: 'En juego', filas: enJuego },
    { id: 'terminados', texto: 'Terminados', filas: terminados },
    { id: 'borradores', texto: 'Borradores', filas: borradores },
  ])
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
    if (!plazas || plazas < 4 || plazas > 256) {
      showToast('Las plazas deben estar entre 4 y 256.')
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

function pintarResumen() {
  const corte = Number($('torneoCorte').value)
  const liga = esLigaElegida()
  const datos = [
    ['Nombre', $('torneoNombre').value.trim() || '—'],
    ['Tipo', liga ? 'Liga por jornadas' : 'Torneo de un día'],
    ['Inicio', $('torneoFecha').value ? fechaBonita($('torneoFecha').value) : '—'],
    ['Plazas', $('torneoPlazas').value],
    [liga ? 'Jornadas' : 'Suizas', `${$('torneoRondas').value} · BO${$('torneoSwissBo').value}`],
    ['Top cut', corte ? `Top ${corte} · BO${$('torneoCorteBo').value}` : 'Sin corte'],
    ['Ronda', `${$('torneoMinutos').value} min`],
    ['Check-in', `${$('torneoCheckin').value} min`],
    ['Listas rivales', $('torneoListasRivales').checked ? 'Visibles en la clasificación' : 'Solo jueces y organizador'],
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

function engancharFormulario(session) {
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
    $('torneoListasRivales').checked = viejo.show_opponent_decklists === true
    const semanaQueViene = new Date(Date.now() + 7 * 86400e3)
    semanaQueViene.setMinutes(semanaQueViene.getMinutes() - semanaQueViene.getTimezoneOffset())
    $('torneoFecha').value = semanaQueViene.toISOString().slice(0, 16)
    $('torneoPlazas').value = viejo.max_players
    $('torneoRondas').value = viejo.swiss_rounds
    $('torneoCorte').value = String(viejo.top_cut_size ?? 0)
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
    pintarCamposJornadas()
  })
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

  let enviando = false
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (enviando) return
    if (!pasoValido(0) || !pasoValido(1)) return
    const nombre = $('torneoNombre').value.trim()
    const liga = esLigaElegida()
    enviando = true
    const { error } = await supabase.from('tournaments').insert({
      slug: `${slugify(nombre)}-${Date.now().toString(36)}`,
      admin_id: session.user.id,
      name: nombre,
      description: descripcionHtml || null,
      start_at: new Date($('torneoFecha').value).toISOString(),
      status: 'draft',
      format: liga ? 'league' : 'standard',
      matchday_dates: liga ? fechasDeJornadas().map((f) => new Date(f).toISOString()) : null,
      show_opponent_decklists: $('torneoListasRivales').checked,
      max_players: Number($('torneoPlazas').value),
      swiss_rounds: Number($('torneoRondas').value),
      round_time_minutes: Number($('torneoMinutos').value),
      checkin_minutes: Number($('torneoCheckin').value),
      swiss_bo: Number($('torneoSwissBo').value),
      top_cut_bo: Number($('torneoCorteBo').value),
      top_cut_size: Number($('torneoCorte').value),
      pairing_seed: semillaDePareo(),
    })
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
    // El reset del formulario no llega al contenteditable del editor.
    descripcionHtml = ''
    $('torneoDescCuerpo').innerHTML = ''
    pintarCamposJornadas()
    irAPaso(0)
    showToast(`«${nombre}» creado como borrador. Abre las inscripciones cuando esté listo.`, 'success')
    cargarLista(session)
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
  engancharFormulario(session)
  await cargarLista(session)
}

init()
