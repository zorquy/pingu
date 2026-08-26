// La página de torneos (/torneos): listar y crear. Parte del porte de
// TrainerArena (ver CLAUDE.md, sección «Jugar»).
//
// MIENTRAS DURE LA PRUEBA es solo para admins: quien no lo sea sale
// rebotado a la portada antes de ver nada (y las políticas RLS de
// supabase-migration-torneos.sql cierran los datos por si acaso).
import { supabase } from '../supabase.js'
import { escapeHtml, getSession, getProfile, slugify } from '../app.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { officialStructure } from './motor.js'
import { ESTADOS, fechaBonita } from './comun.js'

// 32 caracteres de azar del navegador: la semilla que hace reproducibles
// el sorteo de ronda 1 y la moneda de los desempates.
function semillaDePareo() {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const valores = crypto.getRandomValues(new Uint8Array(32))
  return [...valores].map((v) => abc[v % abc.length]).join('')
}

function tarjetaHtml(t, extra = '') {
  const estado = ESTADOS[t.status] || ESTADOS.draft
  return `
  <a class="torneo-tarjeta" href="/torneo?slug=${encodeURIComponent(t.slug)}">
    <span class="torneo-icono">${icons.trophy(22)}</span>
    <span class="torneo-texto">
      <strong>${escapeHtml(t.name)}</strong>
      <span class="subtext">${fechaBonita(t.start_at)} · ${t.max_players} plazas · ${t.swiss_rounds} suizas${t.top_cut_size ? ` + top ${t.top_cut_size}` : ''}</span>
    </span>
    ${extra}
    <span class="torneo-estado ${estado.clase}">${estado.texto}</span>
  </a>`
}

// La lista por PESTAÑAS (petición de los admins): Tus torneos, Abiertas,
// En juego, Terminados y — como aquí todos somos organizadores mientras
// dure la prueba — Borradores. Las vacías ni aparecen.
let pestanaLista = null

function pintarGrupos(grupos) {
  const lista = document.getElementById('listaTorneos')
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
  const lista = document.getElementById('listaTorneos')
  const vacio = document.getElementById('torneosVacio')
  const { data } = await supabase
    .from('tournaments')
    .select('id, slug, name, status, start_at, max_players, swiss_rounds, top_cut_size')
    .order('start_at', { ascending: false })
    .limit(50)
  const torneos = data || []
  const { data: inscripciones } = await supabase
    .from('tournament_registrations')
    .select('tournament_id, status')
    .eq('user_id', session.user.id)
  const miEstado = Object.fromEntries((inscripciones || []).map((i) => [i.tournament_id, i.status]))

  vacio.classList.toggle('hidden', torneos.length > 0)

  const mios = torneos
    .filter((t) => miEstado[t.id] && t.status !== 'draft')
    .map((t) =>
      tarjetaHtml(
        t,
        `<span class="torneo-mio ${miEstado[t.id] === 'dropped' ? 'retirado' : ''}">${miEstado[t.id] === 'dropped' ? 'Retirado' : 'Inscrito'}</span>`
      )
    )
  const abiertas = torneos.filter((t) => t.status === 'registration_open').map((t) => tarjetaHtml(t))
  const enJuego = torneos
    .filter((t) => ['registration_closed', 'in_progress'].includes(t.status))
    .map((t) => tarjetaHtml(t))
  const terminados = torneos
    .filter((t) => ['finished', 'cancelled'].includes(t.status))
    .slice(0, 10)
    .map((t) => tarjetaHtml(t))
  const borradores = torneos.filter((t) => t.status === 'draft').map((t) => tarjetaHtml(t))

  pintarGrupos([
    { id: 'mios', texto: 'Tus torneos', filas: mios },
    { id: 'abiertas', texto: 'Abiertas', filas: abiertas },
    { id: 'enjuego', texto: 'En juego', filas: enJuego },
    { id: 'terminados', texto: 'Terminados', filas: terminados },
    { id: 'borradores', texto: 'Borradores', filas: borradores },
  ])
}

function engancharFormulario(session) {
  const form = document.getElementById('torneoForm')
  const plazas = document.getElementById('torneoPlazas')

  document.getElementById('btnNuevoTorneo').addEventListener('click', () => {
    form.classList.toggle('hidden')
    if (!form.classList.contains('hidden')) document.getElementById('torneoNombre').focus()
  })
  document.getElementById('btnCancelarTorneo').addEventListener('click', () => form.classList.add('hidden'))

  // Al cambiar las plazas, la tabla oficial rellena rondas y corte; el
  // admin puede retocarlos después si quiere otra cosa.
  plazas.addEventListener('input', () => {
    const n = Number(plazas.value)
    if (!n || n < 4) return
    const { swissRounds, topCutSize } = officialStructure(n)
    document.getElementById('torneoRondas').value = swissRounds
    const corte = document.getElementById('torneoCorte')
    if ([...corte.options].some((o) => Number(o.value) === topCutSize)) corte.value = String(topCutSize)
  })

  let enviando = false
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    if (enviando) return
    const nombre = document.getElementById('torneoNombre').value.trim()
    const fecha = document.getElementById('torneoFecha').value
    if (!nombre) {
      showToast('Ponle un nombre al torneo.')
      return
    }
    if (!fecha) {
      showToast('Ponle fecha y hora de inicio.')
      return
    }
    enviando = true
    const { error } = await supabase.from('tournaments').insert({
      slug: `${slugify(nombre)}-${Date.now().toString(36)}`,
      admin_id: session.user.id,
      name: nombre,
      description: document.getElementById('torneoDescripcion').value.trim() || null,
      start_at: new Date(fecha).toISOString(),
      status: 'draft',
      max_players: Number(document.getElementById('torneoPlazas').value),
      swiss_rounds: Number(document.getElementById('torneoRondas').value),
      round_time_minutes: Number(document.getElementById('torneoMinutos').value),
      swiss_bo: Number(document.getElementById('torneoSwissBo').value),
      top_cut_bo: Number(document.getElementById('torneoCorteBo').value),
      top_cut_size: Number(document.getElementById('torneoCorte').value),
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
