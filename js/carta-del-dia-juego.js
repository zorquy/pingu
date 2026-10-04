// «¿Qué carta es?» en el navegador (tanda 570). Lo puro está en
// js/carta-del-dia.js; aquí, el tablero. El porqué largo, en SCHEMA.md.
import { escapeHtml } from './app.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { supabase } from './supabase.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
// `rarezaDeCarta` por `carta-traducciones.js` y no por `rarezas-nombres.js`:
// este último arrastra el holo (carta-holo.js) y con él las clases de
// carta-holo.css, que esta página no carga — lo cazó el barrido de la 299.
import { tipoEs, rarezaDeCarta } from './carta-traducciones.js'
import { setsDelMercado, buscarEnCatalogo } from './catalogo-buscar.js'
import { rutaDeCarta } from './carta-ruta.js'
import {
  INTENTOS, DESENFOQUES, PISTAS, ORDEN_CASILLAS, compararIntento, textoParaCompartir, rachaDeDias, numeroDelDia,
} from './carta-del-dia.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pokedoc-carta-del-dia'
const CLAVE_DIAS = 'pokedoc-carta-del-dia-acertados'

let dia = null
let respuesta = null
let ayer = null
let eras = new Map()
// El estado de HOY: los intentos (la carta que dijiste y sus casillas) y
// si se ha acabado. Vive en el navegador: se juega sin cuenta.
let estado = { dia: null, intentos: [], acertada: false }

function cargarEstado() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (g && g.dia === dia && Array.isArray(g.intentos)) estado = g
    else estado = { dia, intentos: [], acertada: false }
  } catch {
    estado = { dia, intentos: [], acertada: false }
  }
}
function guardarEstado() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado))
  } catch {}
}
function diasAcertados() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_DIAS) || '[]')
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}
function apuntarAcierto() {
  const d = diasAcertados()
  if (!d.includes(dia)) d.push(dia)
  try {
    localStorage.setItem(CLAVE_DIAS, JSON.stringify(d.slice(-120)))
  } catch {}
}

const terminado = () => estado.acertada || estado.intentos.length >= INTENTOS

// ── La carta, borrosa ──
//
// Un <img> con `filter: blur()` que se afloja con cada intento (tanda
// 572). Sin canvas: una foto de otro dominio se desenfoca igual, y no hay
// nada que exportar. Al acabar, nítida.
function pintarFoto() {
  const img = $('cdFoto')
  const cadena = cadenaDeEscaneo(respuesta, respuesta?.tcg_sets?.tcg_online_code || null, 'high')
  if (!img.dataset.puesta) {
    img.dataset.puesta = '1'
    let i = 0
    img.onerror = () => {
      i++
      if (i < cadena.length) img.src = cadena[i]
      else img.remove()
    }
    img.src = cadena[0] || ''
  }
  const px = terminado() ? 0 : DESENFOQUES[Math.min(estado.intentos.length, DESENFOQUES.length - 1)]
  $('cdRecorte').style.setProperty('--cd-desenfoque', `${px}px`)
}

// ── Las pistas ──
function textoDePista(cual) {
  const s = respuesta.tcg_sets || {}
  if (cual === 'era') return `Era: ${escapeHtml(eras.get(String(s.serie_id || '').toLowerCase()) || s.serie_id || '—')}`
  if (cual === 'tipo') return `Tipo: ${escapeHtml(tipoEs((respuesta.types || [])[0]) || '—')}`
  if (cual === 'rareza') return `Rareza: ${escapeHtml(rarezaDeCarta(respuesta) || '—')}`
  if (cual === 'ilustrador') return `Ilustrador: ${escapeHtml(respuesta.illustrator || '—')}`
  if (cual === 'inicial') return `Empieza por «${escapeHtml(String(respuesta.name || '?').charAt(0))}»`
  return ''
}

function pintarPistas() {
  const abiertas = terminado() ? PISTAS.length : Math.min(estado.intentos.length, PISTAS.length)
  $('cdPistas').innerHTML = PISTAS.map((p, i) =>
    i < abiertas
      ? `<li class="cd-pista">${icons.lightbulb(14)} ${textoDePista(p)}</li>`
      : `<li class="cd-pista cd-pista-cerrada">${icons.lock(14)} Pista ${i + 1}: se abre al fallar</li>`
  ).join('')
}

// ── Los intentos ──
function pintarIntentos() {
  const filas = estado.intentos.map((it) => `
    <li class="cd-intento">
      <span class="cd-intento-nombre">${escapeHtml(it.nombre)}</span>
      <span class="cd-casillas" role="img" aria-label="${ORDEN_CASILLAS.map((k) => `${k}: ${it.casillas[k] ? 'bien' : 'mal'}`).join(', ')}">
        ${ORDEN_CASILLAS.map((k) => `<span class="cd-casilla${it.casillas[k] ? ' bien' : ''}" title="${k}"></span>`).join('')}
      </span>
    </li>`)
  for (let i = estado.intentos.length; i < INTENTOS; i++) filas.push('<li class="cd-intento cd-intento-vacio"><span class="cd-intento-nombre">·</span></li>')
  $('cdIntentos').innerHTML = filas.join('')
}

function pintarFinal() {
  const final = $('cdFinal')
  if (!terminado()) {
    final.classList.add('hidden')
    $('cdAcciones').classList.remove('hidden')
    return
  }
  $('cdAcciones').classList.add('hidden')
  const racha = rachaDeDias(diasAcertados(), dia)
  final.innerHTML = `
    <p class="cd-final-titulo">${estado.acertada ? `¡Era ${escapeHtml(nombreDeCarta(respuesta))}!` : `Era ${escapeHtml(nombreDeCarta(respuesta))}.`}</p>
    <p class="subtext">${escapeHtml(nombreDeSet(respuesta.tcg_sets) || respuesta.set_id)} · ${escapeHtml(respuesta.local_id || '')}${racha >= 2 ? ` · ${racha} días seguidos` : ''}</p>
    <div class="cd-final-botones">
      <button type="button" class="btn-primary" id="cdCompartir">Compartir el resultado</button>
      <a class="btn-secondary" href="${escapeHtml(rutaDeCarta(respuesta))}">Ver la carta</a>
    </div>
    <p class="subtext">Mañana hay otra.</p>`
  final.classList.remove('hidden')
  $('cdCompartir').addEventListener('click', compartir)
}

function pintarTodo() {
  pintarFoto()
  pintarPistas()
  pintarIntentos()
  pintarFinal()
  $('cdSub').textContent = `Carta #${numeroDelDia(dia)} · ${terminado() ? 'resuelta' : `intento ${estado.intentos.length + 1} de ${INTENTOS}`}`
}

async function compartir() {
  const texto = textoParaCompartir({
    dia,
    comparaciones: estado.intentos.map((it) => it.casillas),
    acertada: estado.acertada,
    rachaDias: rachaDeDias(diasAcertados(), dia),
  })
  try {
    if (navigator.share) {
      await navigator.share({ text: texto })
      return
    }
  } catch (err) {
    if (err?.name === 'AbortError') return
  }
  try {
    await navigator.clipboard.writeText(texto)
    showToast('Resultado copiado. ¡Pégalo donde quieras presumir!', 'success')
  } catch {
    showToast('No se ha podido copiar el resultado.')
  }
}

function intentar(carta) {
  if (terminado()) return
  const casillas = compararIntento(carta, respuesta)
  estado.intentos.push({ id: carta.id, nombre: nombreDeCarta(carta), casillas })
  if (casillas.nombre) {
    estado.acertada = true
    apuntarAcierto()
  }
  guardarEstado()
  $('nvElegir').close()
  pintarTodo()
}

// ── El buscador (el de /nueve, con el catálogo occidental fijo) ──
let esperaBusqueda = null
async function buscar() {
  let data
  try {
    data = await buscarEnCatalogo({ mercado: 'WEST', set: $('nvSet').value, texto: $('nvBuscar').value })
  } catch (error) {
    $('nvResultados').innerHTML = `<p class="subtext">No se ha podido buscar: ${escapeHtml(error.message)}</p>`
    return
  }
  if (data === null) {
    $('nvResultados').innerHTML = '<p class="subtext">Escribe el nombre que crees que es.</p>'
    return
  }
  if (!data.length) {
    $('nvResultados').innerHTML = '<p class="subtext">No encuentro ninguna carta así.</p>'
    return
  }
  buscar.ultimas = new Map(data.map((c) => [c.id, c]))
  $('nvResultados').innerHTML = data.map((c) => {
    const [primera, ...resto] = cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null)
    const salto = "var r=(this.dataset.respaldos||'').split(' ').filter(Boolean);if(r.length){this.src=r.shift();this.dataset.respaldos=r.join(' ')}else{this.remove()}"
    return `<button type="button" class="nv-resultado" data-elegir="${escapeHtml(c.id)}" aria-label="${escapeHtml(nombreDeCarta(c))}, ${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)} ${escapeHtml(c.local_id)}">
      ${primera ? `<img src="${primera}"${resto.length ? ` data-respaldos="${resto.join(' ')}"` : ''} onerror="${salto}" alt="" width="245" height="342" loading="lazy" />` : ''}
      <span class="nv-resultado-pie">${escapeHtml(nombreDeCarta(c))} · ${escapeHtml(c.local_id)}</span>
    </button>`
  }).join('')
}

async function init() {
  let r
  try {
    const res = await fetch('/.netlify/functions/carta-del-dia', { headers: { accept: 'application/json' } })
    r = await res.json()
    if (!res.ok || r.error) throw new Error(r.error || `HTTP ${res.status}`)
  } catch (err) {
    $('cdSub').textContent = 'Hoy no se ha podido traer la carta. Vuelve en un rato.'
    $('cdAcciones').classList.add('hidden')
    return
  }
  dia = r.dia
  respuesta = r.carta
  ayer = r.ayer || null
  cargarEstado()
  // «Ayer era X»: lo que hace volver a quien no jugó ayer.
  if (ayer?.name) {
    $('cdAyer').textContent = `Ayer era ${nombreDeCarta(ayer)}${ayer.tcg_sets ? ` (${nombreDeSet(ayer.tcg_sets)})` : ''}.`
    $('cdAyer').hidden = false
  }
  // Los nombres de las eras, para la pista: sin ellos saldría «sv».
  try {
    const { data } = await supabase.from('tcg_eras').select('id,nombre').eq('market', 'WEST')
    eras = new Map((data || []).map((e) => [String(e.id).toLowerCase(), e.nombre]))
  } catch {}
  pintarTodo()
  // Las expansiones del buscador, de fondo.
  setsDelMercado('WEST').then((sets) => {
    $('nvSet').innerHTML = '<option value="">Todas</option>' + sets.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(nombreDeSet(s) || s.id)}</option>`).join('')
  }).catch(() => {})

  $('cdAdivinar').addEventListener('click', () => {
    $('nvElegir').showModal()
    $('nvBuscar').focus()
  })
  $('nvBuscar').addEventListener('input', () => {
    clearTimeout(esperaBusqueda)
    esperaBusqueda = setTimeout(buscar, 250)
  })
  $('nvSet').addEventListener('change', buscar)
  $('nvResultados').addEventListener('click', (e) => {
    const b = e.target.closest('[data-elegir]')
    const c = b && buscar.ultimas?.get(b.dataset.elegir)
    if (c) intentar(c)
  })
  $('nvElegir').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close()
  })
}

init()
