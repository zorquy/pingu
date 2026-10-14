// «Imprimir decklist» del constructor (tanda 834): el diálogo que pregunta
// lo que la hoja oficial de Play! Pokémon necesita y no está en el mazo
// —nombre, Player ID, fecha de nacimiento, categoría, formato— y descarga
// el PDF relleno. La hoja la escribe js/decklist-oficial.js (sin DOM); aquí
// solo se pregunta y se pinta.
//
// Lo que se sabe se pone solo: tus datos de Play! Pokémon guardados en tu
// perfil (privados, js/play-pokemon.js), el formato del mazo y la categoría
// por tu año de nacimiento. Y lo que escribas se puede guardar ahí para la
// próxima vez. Nada de esto sale del navegador para hacer la hoja.
import { escapeHtml } from '../app.js'
import { showToast } from '../toast.js'
import { supabase } from '../supabase.js'
import {
  PLANTILLA_DECKLIST,
  DIVISIONES,
  divisionPorNacimiento,
  lineasDeLaHoja,
  contenidoDeLaHoja,
  rellenarPlantilla,
  resumenDeLaHoja,
  limpiarPlayerId,
} from '../decklist-oficial.js'
import { leerDatosPlay, guardarDatosPlay, faltaLaTablaPlay, MIGRACION_PLAY } from '../play-pokemon.js'

const $ = (id) => document.getElementById(id)
const IDIOMA = 'pokedoc-decklist-idioma'

function leerIdioma() {
  try {
    return localStorage.getItem(IDIOMA) === 'es' ? 'es' : 'en'
  } catch {
    return 'en'
  }
}
function guardarIdioma(idioma) {
  try {
    localStorage.setItem(IDIOMA, idioma)
  } catch {}
}

const elegido = (nombre) => document.querySelector(`#cmHojaForm input[name="${nombre}"]:checked`)?.value || null
function elegir(nombre, valor) {
  for (const r of document.querySelectorAll(`#cmHojaForm input[name="${nombre}"]`)) r.checked = r.value === valor
}

// Lo que se sabía al abrir, para no reescribir el perfil si no ha cambiado.
// null = no se sabe (falta la migración o la base no contestó): entonces no
// se guarda nada, para no pisar a ciegas lo que hubiera.
let guardados = null
let contexto = null
let plantilla = null // los bytes de la plantilla, una vez por página

// El resumen de debajo: cuántas líneas van en cada tabla y lo que conviene
// revisar a mano ANTES de imprimir.
function pintarResumen() {
  const { entradas, codigoDeSet } = contexto
  const lineas = lineasDeLaHoja(entradas, { codigoDeSet, idioma: elegido('cmHojaIdioma') || 'en' })
  const r = resumenDeLaHoja(lineas)
  const total = entradas.reduce((s, e) => s + e.n, 0)
  const fila = (rotulo, x) =>
    `<li><strong>${rotulo}:</strong> ${x.lineas} ${x.lineas === 1 ? 'línea' : 'líneas'}${
      x.apretada ? ` — la hoja tiene ${x.filas} renglones, así que irán más juntas y en letra más pequeña` : ''
    }</li>`
  const avisos = []
  if (total !== 60) avisos.push(`El mazo tiene ${total} cartas, no 60.`)
  const sinCodigo = lineas.pokemon.filter((l) => l.sinCodigo)
  if (sinCodigo.length) {
    avisos.push(
      `Sin abreviatura oficial de colección: ${sinCodigo.map((l) => `${escapeHtml(l.nombre)} (${escapeHtml(l.set)})`).join(', ')}. Corrígela a mano en la hoja.`
    )
  }
  if (!elegido('cmHojaFormato')) avisos.push('Marca el formato: la hoja lo pide.')
  $('cmHojaResumen').innerHTML = `<ul>${fila('Pokémon', r.pokemon)}${fila('Entrenadores', r.entrenadores)}${fila('Energías', r.energias)}</ul>${
    avisos.length ? `<ul class="cm-hoja-avisos">${avisos.map((a) => `<li>${a}</li>`).join('')}</ul>` : ''
  }`
}

function datosDelFormulario() {
  return {
    nombre: $('cmHojaNombre').value.trim(),
    playerId: $('cmHojaPlayerId').value.trim(),
    nacimiento: $('cmHojaNacimiento').value,
    division: elegido('cmHojaDivision'),
    formato: elegido('cmHojaFormato'),
    idioma: elegido('cmHojaIdioma') || 'en',
  }
}

function nombreDeFichero(mazo) {
  const base = String(mazo || 'mazo')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `decklist-${base || 'mazo'}.pdf`
}

async function hacerPdf(d) {
  if (!plantilla) {
    const r = await fetch(PLANTILLA_DECKLIST)
    if (!r.ok) throw new Error(`no se ha podido bajar la plantilla (${r.status})`)
    plantilla = new Uint8Array(await r.arrayBuffer())
  }
  const lineas = lineasDeLaHoja(contexto.entradas, { codigoDeSet: contexto.codigoDeSet, idioma: d.idioma })
  const contenido = contenidoDeLaHoja({
    nombre: d.nombre,
    playerId: limpiarPlayerId(d.playerId) || '',
    nacimiento: d.nacimiento,
    division: d.division,
    formato: d.formato,
    lineas,
  })
  return new Blob([rellenarPlantilla(plantilla, contenido)], { type: 'application/pdf' })
}

// Guardar en el perfil solo si se pidió, hay cuenta y algo ha cambiado.
async function recordar(d) {
  const userId = contexto.sesion?.user?.id
  if (!userId || !$('cmHojaRecordar').checked || guardados === null) return
  const antes = { nombre: guardados.player_name || '', playerId: guardados.player_id || '', nacimiento: guardados.birth_date || '' }
  const ahora = { nombre: d.nombre, playerId: limpiarPlayerId(d.playerId) || '', nacimiento: d.nacimiento || '' }
  if (antes.nombre === ahora.nombre && antes.playerId === ahora.playerId && antes.nacimiento === ahora.nacimiento) return
  const error = await guardarDatosPlay(userId, ahora)
  if (error) {
    showToast(
      faltaLaTablaPlay(error)
        ? `La hoja está hecha, pero tus datos no se han guardado en el perfil: falta ejecutar ${MIGRACION_PLAY}.`
        : `La hoja está hecha, pero tus datos no se han guardado: ${error.message}`,
      'error'
    )
    return
  }
  guardados = { player_name: ahora.nombre, player_id: ahora.playerId, birth_date: ahora.nacimiento }
}

async function generar(e, { abrir = false } = {}) {
  e?.preventDefault?.()
  const d = datosDelFormulario()
  if (d.playerId && !limpiarPlayerId(d.playerId)) {
    showToast('El Player ID son solo cifras (como 1234567). Déjalo vacío si aún no tienes.', 'error')
    $('cmHojaPlayerId').focus()
    return
  }
  // La ventana se abre YA, en el clic: si se abre después de bajar la
  // plantilla, el navegador la toma por una ventana emergente y la bloquea.
  const ventana = abrir ? window.open('', '_blank') : null
  const botones = [$('cmHojaGenerar'), $('cmHojaAbrir')]
  botones.forEach((b) => (b.disabled = true))
  try {
    const pdf = await hacerPdf(d)
    const url = URL.createObjectURL(pdf)
    if (ventana) {
      ventana.location.href = url
    } else {
      const a = document.createElement('a')
      a.href = url
      a.download = nombreDeFichero(contexto.nombreMazo)
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    // Se suelta cuando ya no hace falta (la pestaña abierta lo ha cargado).
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    guardarIdioma(d.idioma)
    showToast(ventana ? 'Decklist abierta: imprímela desde esa pestaña.' : 'Decklist descargada: ábrela e imprímela en A4, sin ajustar a la página.', 'success')
    await recordar(d)
    contexto.cerrarModal()
  } catch (error) {
    ventana?.close()
    showToast(`No se ha podido hacer la decklist: ${error.message}`, 'error')
  } finally {
    botones.forEach((b) => (b.disabled = false))
  }
}

let enganchado = false
function enganchar() {
  if (enganchado) return
  enganchado = true
  $('cmHojaForm').addEventListener('submit', (e) => generar(e))
  $('cmHojaAbrir').addEventListener('click', (e) => generar(e, { abrir: true }))
  // La categoría sigue a la fecha: es lo que dice la hoja, y casi nadie la
  // cambia a mano (pero puede).
  $('cmHojaNacimiento').addEventListener('change', () => {
    const division = divisionPorNacimiento($('cmHojaNacimiento').value)
    if (division) elegir('cmHojaDivision', division)
  })
  $('cmHojaForm').addEventListener('change', (e) => {
    if (e.target.name === 'cmHojaIdioma' || e.target.name === 'cmHojaFormato') pintarResumen()
  })
}

// ctx: { entradas, codigoDeSet, formato, nombreMazo, sesion, abrirModal, cerrarModal }
export async function abrirHojaOficial(ctx) {
  contexto = ctx
  enganchar()
  // Las categorías, con los años de la temporada de la plantilla.
  for (const [clave, d] of Object.entries(DIVISIONES)) {
    const rotulo = document.querySelector(`[data-division-texto="${clave}"]`)
    if (rotulo) rotulo.textContent = `${d.nombre} (nacidos en ${d.nacidos})`
  }
  elegir('cmHojaFormato', ctx.formato === 'expanded' ? 'expanded' : ctx.formato === 'standard' ? 'standard' : null)
  elegir('cmHojaIdioma', leerIdioma())
  const userId = ctx.sesion?.user?.id || null
  $('cmHojaRecordarCaja').classList.toggle('hidden', !userId)
  pintarResumen()
  ctx.abrirModal('cmModalHoja')

  // Lo guardado en el perfil, si hay: no se pisa lo que ya se haya
  // escrito en esta visita.
  const leido = userId ? await leerDatosPlay(userId) : { estado: 'error', fila: null }
  guardados = leido.fila
  const vacio = (id) => !$(id).value
  if (guardados) {
    if (guardados.player_name && vacio('cmHojaNombre')) $('cmHojaNombre').value = guardados.player_name
    if (guardados.player_id && vacio('cmHojaPlayerId')) $('cmHojaPlayerId').value = guardados.player_id
    if (guardados.birth_date && vacio('cmHojaNacimiento')) $('cmHojaNacimiento').value = guardados.birth_date
  }
  // Sin fecha guardada aquí, la del cumpleaños del perfil (la pública), si
  // la puso: es la misma persona y la misma fecha.
  if (userId && vacio('cmHojaNacimiento')) {
    const { data } = await supabase.from('user_profiles').select('birthday').eq('id', userId).maybeSingle()
    if (data?.birthday && vacio('cmHojaNacimiento')) $('cmHojaNacimiento').value = data.birthday
  }
  if (!elegido('cmHojaDivision')) {
    const division = divisionPorNacimiento($('cmHojaNacimiento').value)
    if (division) elegir('cmHojaDivision', division)
  }
  // Sin la migración, que lo diga junto a la casilla en vez de fallar al
  // guardar.
  $('cmHojaRecordarAviso').textContent =
    userId && leido.estado === 'falta'
      ? `Para guardarlo en tu perfil falta ejecutar ${MIGRACION_PLAY}.`
      : userId && leido.estado === 'error'
        ? 'No se ha podido leer lo que tenías guardado: la hoja se hace igual.'
        : ''
}
