// «¿Qué carta es?» en el navegador (tanda 570; rehecho en la 835 con la
// maqueta que aprobó PINGU). Lo puro está en js/carta-del-dia.js; aquí, el
// tablero. El porqué largo, en SCHEMA.md.
import { escapeHtml, getSession } from './app.js'
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
  INTENTOS, DESENFOQUES, PISTAS, ORDEN_CASILLAS, compararDetallado, comoBooleanas, textoParaCompartir, rachaDeDias, numeroDelDia, ENLACE,
} from './carta-del-dia.js'
import { mismaFamilia } from './familias-pokemon.js'
import { xpDe, xpSiAciertasCarta } from './retos-xp.js'
import { guardarResultado, estadisticas, misNumeros, traerPartidaDeHoy } from './retos-datos.js'
import { premiosHtml, repartoHtml, cuentaAtras, genteHtml } from './retos-ui.js'
import { siguienteReto, hechoHoy, siguienteRetoHtml } from './retos-siguiente.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pokedoc-carta-del-dia'
const CLAVE_DIAS = 'pokedoc-carta-del-dia-acertados'
// En cuántos intentos se acertó cada día (0 = no), para el reparto de quien
// juega sin cuenta. Con cuenta manda la base.
const CLAVE_HISTORIAL = 'pokedoc-carta-del-dia-historial'
// Lo que se pide de cada carta que dices (835): sin el tipo, la rareza, la
// familia y la fecha, las casillas salían SIEMPRE en rojo.
const COLUMNAS_INTENTO = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,types,rarity,rarity_en,dex_ids,tcg_sets(name,name_en,tcg_online_code,serie_id,serie_name,serie_name_en,oculto,release_date)'

let dia = null
let respuesta = null
let ayer = null
let eras = new Map()
let sesion = null
let numeros = null
let guardado = null
let pararCuenta = () => {}
// El estado de HOY: los intentos (la carta que dijiste y sus casillas) y
// si se ha acabado. Vive en el navegador: se juega sin cuenta.
let estado = { dia: null, intentos: [], acertada: false }

const leerJson = (clave, defecto) => {
  try {
    const v = JSON.parse(localStorage.getItem(clave) || 'null')
    return v ?? defecto
  } catch {
    return defecto
  }
}
const escribirJson = (clave, valor) => {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch {}
}

function cargarEstado() {
  const g = leerJson(CLAVE, null)
  estado = g && g.dia === dia && Array.isArray(g.intentos) ? g : { dia, intentos: [], acertada: false }
}
const guardarEstado = () => escribirJson(CLAVE, estado)
function diasAcertados() {
  const d = leerJson(CLAVE_DIAS, [])
  return Array.isArray(d) ? d : []
}
function apuntarAcierto() {
  const d = diasAcertados()
  if (!d.includes(dia)) d.push(dia)
  escribirJson(CLAVE_DIAS, d.slice(-120))
}
function apuntarHistorial() {
  const h = leerJson(CLAVE_HISTORIAL, {})
  h[dia] = estado.acertada ? estado.intentos.length : 0
  escribirJson(CLAVE_HISTORIAL, Object.fromEntries(Object.entries(h).slice(-200)))
}

const terminado = () => estado.acertada || estado.intentos.length >= INTENTOS
// El estado de una casilla, también de las partidas guardadas antes de la
// 835 (que solo tenían verdadero/falso).
const estadoDe = (it, k) => it.det?.[k]?.estado || (it.casillas?.[k] ? 'si' : 'no')
const esAcierto = (it) => estadoDe(it, 'nombre') === 'si'
const nombreDeEra = (c) => eras.get(String(c?.tcg_sets?.serie_id || '').toLowerCase()) || c?.tcg_sets?.serie_id || '—'

// ── La carta, borrosa ──
//
// Un <img> con `filter: blur()` que se afloja con cada intento (tanda
// 572). Al acabar, nítida y con su brillo.
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
  const n = estado.intentos.length
  const px = terminado() ? 0 : DESENFOQUES[Math.min(n, DESENFOQUES.length - 1)]
  $('cdRecorte').style.setProperty('--cd-desenfoque', `${px}px`)
  $('cdRecorte').classList.toggle('resuelta', terminado() && estado.acertada)
  // Lo que vale acertar ahora (835): baja con cada fallo.
  const bote = $('cdBote')
  bote.classList.toggle('hidden', terminado())
  bote.innerHTML = `${icons.zap(14)} ${sesion ? 'Ahora vale' : 'Con cuenta, ahora vale'} <b>+${xpSiAciertasCarta(n)} XP</b>`
  $('cdGastados').innerHTML = Array.from({ length: INTENTOS }, (_, i) => `<i${i < n ? ' class="gastado"' : ''}></i>`).join('')
}

// ── Las pistas, en baldosas ──
function pista(cual) {
  const s = respuesta.tcg_sets || {}
  if (cual === 'era') return ['Era', eras.get(String(s.serie_id || '').toLowerCase()) || s.serie_id || '—', 'layers']
  if (cual === 'tipo') return ['Tipo', tipoEs((respuesta.types || [])[0]) || '—', 'droplet']
  if (cual === 'rareza') return ['Rareza', rarezaDeCarta(respuesta) || '—', 'gem']
  if (cual === 'ilustrador') return ['Ilustrador', respuesta.illustrator || '—', 'palette']
  if (cual === 'inicial') return ['Empieza por', `«${String(nombreDeCarta(respuesta) || '?').charAt(0)}»`, 'hash']
  return ['', '', 'lightbulb']
}

function pintarPistas() {
  const abiertas = terminado() ? PISTAS.length : Math.min(estado.intentos.length, PISTAS.length)
  $('cdPistas').innerHTML = PISTAS.map((p, i) => {
    const [rotulo, valor, icono] = pista(p)
    return i < abiertas
      ? `<li class="cd-pista">${(icons[icono] || icons.lightbulb)(16)}${escapeHtml(rotulo)}<b>${escapeHtml(valor)}</b></li>`
      : `<li class="cd-pista cd-pista-cerrada">${icons.lock(16)}${escapeHtml(rotulo)}<b>al fallar ${i + 1}</b></li>`
  }).join('')
}

// ── Los intentos ──
const flechaArriba = (t) => `<small><span style="display:inline-flex;transform:rotate(180deg)">${icons.arrowDown(10)}</span>${t}</small>`
const flechaAbajo = (t) => `<small>${icons.arrowDown(10)}${t}</small>`

function casillaHtml(it, k) {
  const e = estadoDe(it, k)
  const clase = e === 'si' ? ' bien' : e === 'casi' ? ' casi' : ''
  const f = it.det?.[k]?.flecha
  let texto = ''
  let extra = ''
  if (k === 'nombre') texto = e === 'casi' ? 'Misma familia' : 'No'
  if (k === 'era') {
    texto = it.valores?.era || (e === 'si' ? 'Sí' : 'No')
    if (f === 'nueva') extra = flechaArriba('más nueva')
    if (f === 'antigua') extra = flechaAbajo('más antigua')
  }
  if (k === 'tipo') texto = it.valores?.tipo || (e === 'si' ? 'Sí' : 'No')
  if (k === 'rareza') {
    texto = it.valores?.rareza || (e === 'si' ? 'Sí' : 'No')
    if (f === 'rara') extra = flechaArriba('más rara')
    if (f === 'comun') extra = flechaAbajo('más común')
  }
  return `<span class="cd-casilla${clase} rj-voltea" title="${k}">${escapeHtml(texto)}${extra}</span>`
}

function pintarIntentos() {
  const filas = estado.intentos.map((it) => {
    const quien = `<span class="cd-quien">${it.foto ? `<span class="cd-mini"><img src="${escapeHtml(it.foto)}" alt="" width="36" height="50" loading="lazy" onerror="this.remove()" /></span>` : '<span class="cd-mini"></span>'}<span class="cd-quien-texto"><span class="cd-intento-nombre">${escapeHtml(it.nombre)}</span>${it.set ? `<small>${escapeHtml(it.set)}${it.num ? ` · ${escapeHtml(it.num)}` : ''}</small>` : ''}</span></span>`
    if (esAcierto(it)) return `<li class="cd-intento acierto">${quien}<span class="cd-acierto-texto rj-voltea">${icons.checkCircle(22)} ¡Es esta!</span></li>`
    const etiqueta = ORDEN_CASILLAS.map((k) => `${k}: ${{ si: 'bien', casi: 'casi', no: 'mal' }[estadoDe(it, k)]}`).join(', ')
    return `<li class="cd-intento" aria-label="${escapeHtml(it.nombre)} — ${etiqueta}">${quien}${ORDEN_CASILLAS.map((k) => casillaHtml(it, k)).join('')}</li>`
  })
  for (let i = estado.intentos.length; i < INTENTOS; i++) filas.push('<li class="cd-intento cd-intento-vacio"></li>')
  $('cdIntentos').innerHTML = filas.join('')
}

// ── El final ──
function pintarFinal() {
  const final = $('cdFinal')
  if (!terminado()) {
    final.classList.add('hidden')
    $('cdAcciones').classList.remove('hidden')
    return
  }
  $('cdAcciones').classList.add('hidden')
  const n = estado.intentos.length
  const nombre = nombreDeCarta(respuesta)
  final.className = `cd-final rj-final${estado.acertada ? '' : ' fallado'}`
  final.innerHTML = `
    <p class="rj-final-titulo cd-final-titulo">${estado.acertada ? `¡Acertada en ${n}!` : `Era ${escapeHtml(nombre)}`}</p>
    <p class="subtext cd-final-sub">${escapeHtml(nombre)} · ${escapeHtml(nombreDeSet(respuesta.tcg_sets) || respuesta.set_id)} · ${escapeHtml(respuesta.local_id || '')}<span id="cdGente"></span></p>
    <div id="cdPremios"></div>
    <div id="cdReparto"></div>
    <div class="rj-botones">
      <button type="button" class="btn-secondary" id="cdCompartir">${icons.share(16)} Compartir</button>
      <button type="button" class="btn-secondary" id="cdImagen">Como imagen</button>
      <a class="btn-secondary" href="${escapeHtml(rutaDeCarta(respuesta))}">Ver la carta</a>
      <span class="rj-cuenta" id="cdCuenta"></span>
    </div>
    <div class="rj-adonde">${siguienteRetoHtml(siguienteReto('carta', hechoHoy(dia)))}</div>`
  final.classList.remove('hidden')
  $('cdCompartir').addEventListener('click', compartir)
  $('cdImagen').addEventListener('click', compartirImagen)
  pararCuenta()
  pararCuenta = cuentaAtras($('cdCuenta'))
  pintarPremios()
  estadisticas('carta', dia).then((s) => { const c = $('cdGente'); if (c) c.textContent = genteHtml(s) }).catch(() => {})
}

// Lo ganado y el reparto: de lo que contestó la base al guardar, o de tus
// números si ya estaba guardado; sin cuenta, lo que habría dado.
function pintarPremios() {
  const caja = $('cdPremios')
  if (!caja) return
  const r = guardado || (numeros?.hoy?.carta ? { nuevo: false, xp: numeros.hoy.carta.xp } : sesion ? null : { sinCuenta: true })
  caja.innerHTML = premiosHtml(r, {
    posible: xpDe('carta', { acertada: estado.acertada, intentos: estado.intentos.length }),
    volver: '/carta-del-dia',
    racha: rachaDeDias(diasAcertados(), dia),
    rachaTexto: 'acertando seguidos',
  })
  let cuentas = numeros?.cartaIntentos || null
  if (!cuentas) {
    cuentas = {}
    for (const v of Object.values(leerJson(CLAVE_HISTORIAL, {}))) if (v > 0) cuentas[v] = (cuentas[v] || 0) + 1
  }
  if (estado.acertada && !Object.keys(cuentas).length) cuentas = { [estado.intentos.length]: 1 }
  $('cdReparto').innerHTML = Object.keys(cuentas).length ? repartoHtml(cuentas, { tuyo: estado.acertada ? estado.intentos.length : null }) : ''
}

async function guardar() {
  if (!terminado() || estado.guardado) return
  const r = await guardarResultado('carta', dia, { aciertos: estado.acertada ? 1 : 0, total: 1, intentos: estado.intentos.length, acertada: estado.acertada }).catch(() => ({ error: true }))
  if (r && (r.nuevo === true || r.nuevo === false)) {
    estado.guardado = true
    guardarEstado()
    guardado = r
  } else if (r?.sinCuenta) {
    guardado = r
  }
  pintarPremios()
}

// La imagen del resultado (tanda 583): la carta ya resuelta, las filas
// de casillas y la racha. Como el texto, se arma al pulsar.
async function compartirImagen() {
  const [{ pintarResultadoReto }, { compartirLienzo, fotoParaElLienzo }] = await Promise.all([import('./reto-imagen.js'), import('./imagen-compartir.js')])
  const foto = await fotoParaElLienzo(cadenaDeEscaneo(respuesta, respuesta?.tcg_sets?.tcg_online_code || null, 'high'))
  const lienzo = pintarResultadoReto(document.createElement('canvas'), {
    titulo: '¿Qué carta es?',
    cuenta: `${estado.acertada ? estado.intentos.length : 'X'}/${INTENTOS}`,
    detalle: `Carta #${numeroDelDia(dia)} · ${nombreDeCarta(respuesta)}`,
    filas: estado.intentos.map((it) => (esAcierto(it) ? [true, true, true, true] : ORDEN_CASILLAS.map((k) => estadoDe(it, k) === 'si'))),
    racha: rachaDeDias(diasAcertados(), dia),
    enlace: ENLACE,
    foto,
    fotoNombre: '',
  })
  await compartirLienzo(lienzo, { nombreFichero: `carta-del-dia-${numeroDelDia(dia)}.png`, texto: textoCompartido() })
}

const textoCompartido = () => textoParaCompartir({
  dia,
  comparaciones: estado.intentos.map((it) => it.det || it.casillas),
  acertada: estado.acertada,
  rachaDias: rachaDeDias(diasAcertados(), dia),
})

function pintarTodo() {
  pintarFoto()
  pintarPistas()
  pintarIntentos()
  pintarFinal()
  $('cdSub').textContent = `Carta #${numeroDelDia(dia)} · ${terminado() ? 'resuelta' : `intento ${estado.intentos.length + 1} de ${INTENTOS}`}`
}

async function compartir() {
  const texto = textoCompartido()
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

// La carta sale de un sobre (796, MV7): al acertar o al gastar los
// intentos EN ESTA visita —no al volver a la página ya resuelta— el sobre se
// rasga, baja y la carta sube con un brillo. Con «menos movimiento», nada: la
// carta ya está nítida. El sobre se quita con un temporizador (la 313: sin
// animación no hay `animationend`).
export function abrirSobre(caja) {
  if (!caja || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  caja.querySelector('.cd-sobre')?.remove()
  caja.insertAdjacentHTML('beforeend', '<span class="cd-sobre" aria-hidden="true"><span class="cd-sobre-tapa"></span><span class="cd-sobre-cuerpo"></span></span>')
  caja.classList.remove('sale')
  void caja.offsetWidth
  caja.classList.add('sale')
  setTimeout(() => { caja.querySelector('.cd-sobre')?.remove(); caja.classList.remove('sale') }, 1800)
  return true
}

function intentar(carta) {
  if (terminado()) return
  const det = compararDetallado(carta, respuesta, { familia: mismaFamilia })
  estado.intentos.push({
    id: carta.id,
    nombre: nombreDeCarta(carta),
    set: nombreDeSet(carta.tcg_sets) || carta.set_id || '',
    num: carta.local_id || '',
    foto: cadenaDeEscaneo(carta, carta?.tcg_sets?.tcg_online_code || null)[0] || '',
    det,
    casillas: comoBooleanas(det),
    valores: { era: nombreDeEra(carta), tipo: tipoEs((carta.types || [])[0]) || '—', rareza: rarezaDeCarta(carta) || '—' },
  })
  if (det.nombre.estado === 'si') {
    estado.acertada = true
    apuntarAcierto()
  }
  if (terminado()) apuntarHistorial()
  guardarEstado()
  $('nvElegir').close()
  pintarTodo()
  if (terminado()) abrirSobre($('cdRecorte'))
  if (terminado()) guardar()
}

// ── El buscador (el de /nueve, con el catálogo occidental fijo) ──
let esperaBusqueda = null
async function buscar() {
  let data
  try {
    data = await buscarEnCatalogo({ mercado: 'WEST', set: $('nvSet').value, texto: $('nvBuscar').value, soloTCG: true, columnas: COLUMNAS_INTENTO, categoria: 'Pokemon' })
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
  $('cdLupa').innerHTML = icons.search(18)
  let r
  try {
    const res = await fetch('/.netlify/functions/carta-del-dia', { headers: { accept: 'application/json' } })
    r = await res.json()
    // Sin día o sin carta tampoco hay reto: el mismo aviso (780, LO9).
    if (!res.ok || r.error || !r.dia || !r.carta) throw new Error(r?.error || `HTTP ${res.status}`)
  } catch (err) {
    $('cdSub').textContent = 'Hoy no se ha podido traer la carta. Vuelve en un rato.'
    $('cdAcciones').classList.add('hidden')
    return
  }
  dia = r.dia
  respuesta = r.carta
  ayer = r.ayer || null
  // Si hoy ya lo jugaste en otro aparato, la partida baja de la base (841).
  await traerPartidaDeHoy('carta', dia).catch(() => false)
  cargarEstado()
  // «Ayer era X»: lo que hace volver a quien no jugó ayer.
  if (ayer?.name) {
    $('cdAyer').textContent = `Ayer era ${nombreDeCarta(ayer)}${ayer.tcg_sets ? ` (${nombreDeSet(ayer.tcg_sets)})` : ''}.`
    $('cdAyer').hidden = false
  }
  sesion = await getSession().catch(() => null)
  // Los nombres de las eras, para la pista: sin ellos saldría «sv».
  try {
    const { data } = await supabase.from('tcg_eras').select('id,nombre').eq('market', 'WEST')
    eras = new Map((data || []).map((e) => [String(e.id).toLowerCase(), e.nombre]))
  } catch {}
  pintarTodo()
  // Tus números (lo ganado hoy y tu reparto) y, si se acabó antes sin
  // guardarse (sin red, sin cuenta entonces), se guarda ahora.
  if (sesion) {
    misNumeros(400).then((n) => { numeros = n; pintarPremios() }).catch(() => {})
    if (terminado() && !estado.guardado) guardar()
  }
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
  // Escape CIERRA el diálogo también con el cursor en el buscador (tanda
  // 573). Un `<input type="search" enterkeyhint="search">` se queda la tecla para borrar el
  // texto, y el diálogo no se enteraba: la gente pulsaba Escape y se
  // quedaba dentro con la caja vacía.
  $('nvElegir').addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.currentTarget.close()
  })
}

init()
