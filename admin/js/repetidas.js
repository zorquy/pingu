// ── /admin → Colecciones → «Posibles repetidas» (tanda 987) ──
//
// PINGU, con el N's Darmanitan SVP 181 dos veces en las promos (una es la
// Staff): «¿no es mejor traernos solamente una y meterle dos variantes?», y
// que el panel avise de cada repetida y él elija. Eligió lo recomendado: la
// lista propone y él decide; la Staff es un sello (no cuenta para completar
// la colección); la principal es la que ya teníamos.
//
// Entra por `import()` desde colecciones.js: es una caja que se abre poco.
// Lo escriben las funciones de supabase-migration-987-repetidas-en-versiones.
import { supabase } from '../../js/supabase.js'
import { escapeHtml } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../../js/escaneo-carta.js'
import { avisarALaWeb } from './avisar-web.js'
import { faltaLaMigracion } from './catalogo-puro.js'
import { ETIQUETAS, claveDeGrupo, senalesDelPar, sugerencia, etiquetaValida, esImpresionDeSiempre, principalDe, claseDe, precioCorto, quienLaTiene, filtrarGrupos, holoDelPrizePack } from './repetidas-puro.js'

const $ = (id) => document.getElementById(id)
const AVISO = 'Falta ejecutar supabase-migration-987-repetidas-en-versiones.sql en el SQL Editor: hasta entonces aquí no se puede decidir nada.'

let datos = { total: 0, grupos: [], hechas: [], distintas: [] }
let vista = 'revisar'
let filtro = ''
let cargando = false
// Lo que se va eligiendo en cada grupo: su principal y, por carta, el nombre
// de su versión y si cuenta para completar la colección.
const eleccion = new Map()
const deGrupo = (clave) => {
  if (!eleccion.has(clave)) eleccion.set(clave, { principal: null, etiquetas: new Map(), cuenta: new Map(), otra: new Set() })
  return eleccion.get(clave)
}
const mercadoActual = () => $('coleccionesMercado')?.value || 'WEST'

async function cargar() {
  cargando = true
  pintar()
  const { data, error } = await supabase.rpc('catalogo_posibles_repetidas', { p_market: mercadoActual(), p_limite: 1000 })
  cargando = false
  if (error) {
    datos = { total: 0, grupos: [], hechas: [], distintas: [], error: faltaLaMigracion(error) ? AVISO : `No se ha podido mirar: ${error.message}` }
  } else {
    datos = { total: Number(data?.total) || 0, grupos: data?.grupos || [], hechas: data?.hechas || [], distintas: data?.distintas || [] }
  }
  pintar()
}

function foto(c, ancho = 120) {
  const attrs = atributosDeEscaneo(cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, 'low'), "this.replaceWith(Object.assign(document.createElement('span'),{className:'rep-sinfoto',textContent:'sin foto'}))")
  return attrs ? `<img ${attrs} alt="" width="${ancho}" height="${Math.round(ancho * 88 / 63)}" loading="lazy">` : '<span class="rep-sinfoto">sin foto</span>'
}

function figura(c, { principal, grupo }) {
  return `<figure class="rep-fig">
    ${foto(c)}
    <figcaption>
      ${principal ? '<span class="rep-chapa">Principal</span>' : `<button type="button" class="btn-secondary btn-small" data-rep-principal="${escapeHtml(c.id)}" data-rep-grupo="${escapeHtml(grupo)}">Hacer principal</button>`}
      <code>${escapeHtml(c.id)}</code>
      <span>${escapeHtml(precioCorto(c))} · ${escapeHtml(quienLaTiene(c))}</span>
    </figcaption>
  </figure>`
}

function senales(a, b) {
  return `<ul class="rep-senales">${senalesDelPar(a, b).map((s) => `<li class="rep-senal${s.coincide === false && !s.aviso ? ' rep-senal-no' : ''}${s.coincide === null ? ' rep-senal-nada' : ''}">${escapeHtml(s.texto)}</li>`).join('')}</ul>`
}

function par(g, clave, p, c) {
  const e = deGrupo(clave)
  const elegida = e.etiquetas.get(c.id) || ''
  const otra = e.otra.has(c.id)
  const sug = sugerencia(p, c)
  const valida = etiquetaValida(elegida)
  return `<div class="rep-par" data-rep-carta="${escapeHtml(c.id)}" data-rep-grupo="${escapeHtml(clave)}">
    ${figura(c, { principal: false, grupo: clave })}
    <div class="rep-datos">
      ${senales(p, c)}
      ${sug === 'misma' ? '<p class="admin-note">Las dos son el mismo producto de Cardmarket: seguramente es la misma carta dos veces.</p>' : ''}
      <div class="rep-etiquetas" role="group" aria-label="Qué versión es">
        <span>Es la versión:</span>
        ${ETIQUETAS.map((t) => `<button type="button" class="chip-filtro" data-rep-etiqueta="${escapeHtml(t)}" aria-pressed="${!otra && elegida === t}">${escapeHtml(t)}</button>`).join('')}
        <button type="button" class="chip-filtro" data-rep-otra aria-pressed="${otra}">Otra…</button>
        ${otra ? `<input type="text" class="rep-otra" maxlength="40" placeholder="Nombre de la versión" aria-label="Nombre de la versión" value="${escapeHtml(elegida)}">` : ''}
      </div>
      ${esImpresionDeSiempre(elegida)
        ? '<p class="rep-cuenta">Una impresión de siempre: cuenta para completar la colección.</p>'
        : `<label class="rep-cuenta"><input type="checkbox" data-rep-cuenta ${e.cuenta.get(c.id) ? 'checked' : ''}> Cuenta para completar la colección (si no, es un sello)</label>`}
      <div class="rep-botones">
        <button type="button" class="${sug === 'version' ? 'btn-primary' : 'btn-secondary'} btn-small" data-rep-hacer="version" ${valida ? '' : 'disabled'}>Es una versión de la principal</button>
        <button type="button" class="${sug === 'misma' ? 'btn-primary' : 'btn-secondary'} btn-small" data-rep-hacer="misma">Es la misma carta</button>
      </div>
    </div>
  </div>`
}

function grupoHtml(g) {
  const clave = claveDeGrupo(g)
  const e = deGrupo(clave)
  const idP = principalDe(g, e.principal)
  const p = g.cartas.find((c) => c.id === idP)
  const otras = g.cartas.filter((c) => c.id !== idP)
  return `<article class="rep-grupo" data-rep-grupo="${escapeHtml(clave)}">
    <header class="rep-grupo-cab">
      <h3>${escapeHtml(p?.name || '')} <small>${escapeHtml(g.set?.name || g.set_id)} · ${escapeHtml(p?.local_id || g.numero)}</small></h3>
      <button type="button" class="btn-secondary btn-small" data-rep-distintas="${escapeHtml(clave)}">Son cartas distintas</button>
    </header>
    <div class="rep-cuerpo">
      ${figura(p, { principal: true, grupo: clave })}
      <div class="rep-pares">${otras.map((c) => par(g, clave, p, c)).join('')}</div>
    </div>
  </article>`
}

function hechaHtml(h) {
  const que = h.decision === 'version' ? `versión «${escapeHtml(h.etiqueta || '')}» de <code>${escapeHtml(h.destino)}</code>` : `la misma carta que <code>${escapeHtml(h.destino)}</code>`
  return `<li class="rep-fila"><span><b>${escapeHtml(h.nombre || h.carta)}</b> <code>${escapeHtml(h.carta)}</code> → ${que}<small> · ${escapeHtml(new Date(h.hecha_at).toLocaleString('es-ES'))}</small></span>
    <button type="button" class="btn-secondary btn-small" data-rep-deshacer="${escapeHtml(String(h.id))}">Deshacer</button></li>`
}

function distintaHtml(d) {
  return `<li class="rep-fila"><span><b>${escapeHtml(d.nombre)}</b> · ${escapeHtml(d.set_id)} · ${escapeHtml(d.numero)} <small>${escapeHtml((d.ids || []).join(', '))}</small></span>
    <button type="button" class="btn-secondary btn-small" data-rep-quitar="${escapeHtml(JSON.stringify([d.set_id, d.numero, d.nombre]))}">Volver a revisarlas</button></li>`
}

// Los grupos que tienen ya nombre elegido para todas sus repetidas: los que
// «Convertir las marcadas» hace de una vez.
function marcados() {
  const fuera = []
  for (const g of filtrarGrupos(datos.grupos, filtro)) {
    const clave = claveDeGrupo(g)
    const e = eleccion.get(clave)
    if (!e) continue
    const idP = principalDe(g, e.principal)
    for (const c of g.cartas) if (c.id !== idP && etiquetaValida(e.etiquetas.get(c.id))) fuera.push({ g, clave, carta: c, destino: idP, etiqueta: e.etiquetas.get(c.id).trim(), clase: claseDe(e.cuenta.get(c.id), e.etiquetas.get(c.id)) })
  }
  return fuera
}

function pintar() {
  const resumen = $('repetidasResumen')
  if (resumen) resumen.textContent = cargando ? 'Mirando…' : datos.error ? 'sin la migración' : `${datos.total} por revisar · ${datos.hechas.length} hechas · ${datos.distintas.length} distintas`
  document.querySelectorAll('[data-rep-vista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.repVista === vista)))
  const todas = $('repetidasTodas')
  if (todas) todas.hidden = vista !== 'revisar' || !datos.grupos.length
  const prize = $('repetidasPrize')
  const np = vista === 'revisar' ? delPrizePack().length : 0
  if (prize && !prize.dataset.ocupado) { prize.hidden = !np; prize.textContent = prize.dataset.confirmar ? `¿Convertir ${np}? Pulsa otra vez` : `Prize Pack: la más cara es la Holo (${np})` }
  const lote = $('repetidasLote')
  const n = vista === 'revisar' ? marcados().length : 0
  if (lote) { lote.hidden = !n; lote.textContent = `Convertir las marcadas (${n})` }
  const lista = $('repetidasLista')
  if (!lista) return
  if (cargando && !datos.grupos.length) { lista.innerHTML = '<p class="admin-note">Buscando repetidas en el catálogo…</p>'; return }
  if (datos.error) { lista.innerHTML = `<p class="admin-note admin-note-warn">${escapeHtml(datos.error)}</p>`; return }
  if (vista === 'hechas') {
    lista.innerHTML = datos.hechas.length ? `<ul class="rep-filas">${datos.hechas.map(hechaHtml).join('')}</ul>` : '<p class="admin-note">Todavía no has convertido ninguna.</p>'
    return
  }
  if (vista === 'distintas') {
    lista.innerHTML = datos.distintas.length ? `<ul class="rep-filas">${datos.distintas.map(distintaHtml).join('')}</ul>` : '<p class="admin-note">No has marcado ningún grupo como «cartas distintas».</p>'
    return
  }
  const grupos = filtrarGrupos(datos.grupos, filtro)
  if (!datos.grupos.length) { lista.innerHTML = '<p class="admin-note">No hay repetidas en este catálogo.</p>'; return }
  if (!grupos.length) { lista.innerHTML = '<p class="admin-note">Ninguna repetida casa con ese filtro.</p>'; return }
  const mas = datos.total > datos.grupos.length ? `<p class="admin-note">Se enseñan las ${datos.grupos.length} primeras de ${datos.total}, de las colecciones más nuevas a las más viejas.</p>` : ''
  lista.innerHTML = mas + grupos.map(grupoHtml).join('')
}

function imagenDe(c) {
  return cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, 'high')[0] || null
}

async function resolver({ carta, destino, decision, etiqueta = null, clase = 'sello' }, { silencio = false } = {}) {
  const { data, error } = await supabase.rpc('catalogo_repetida_resolver', {
    p_carta: carta.id, p_destino: destino, p_market: carta.market || mercadoActual(), p_decision: decision,
    p_etiqueta: decision === 'version' ? etiqueta : null, p_clase: clase, p_imagen: decision === 'version' ? imagenDe(carta) : null,
  })
  if (error) {
    showToast(faltaLaMigracion(error) ? AVISO : `No se ha podido: ${error.message}`)
    return null
  }
  if (!silencio) {
    showToast(decision === 'version' ? `Hecho: ahora es la versión «${etiqueta}» de ${destino}` : `Hecho: ${carta.id} ya es ${destino}`, 'success', {
      accion: { texto: 'Deshacer', alPulsar: () => deshacer(data?.hecha) },
    })
  }
  return data
}

async function deshacer(id) {
  if (!id) return
  const { error } = await supabase.rpc('catalogo_repetida_deshacer', { p_hecha: Number(id) })
  if (error) { showToast(`No se ha podido deshacer: ${error.message}`); return }
  showToast('Deshecho', 'success')
  avisarALaWeb()
  await cargar()
}

function alClic(e) {
  const t = e.target.closest('button')
  if (!t) return
  if (t.dataset.repVista) { vista = t.dataset.repVista; pintar(); return }
  const grupoEl = t.closest('[data-rep-grupo]')
  const clave = t.dataset.repGrupo || grupoEl?.dataset.repGrupo
  if (t.dataset.repPrincipal) { deGrupo(clave).principal = t.dataset.repPrincipal; pintar(); return }
  if (t.dataset.repDeshacer) { t.disabled = true; deshacer(t.dataset.repDeshacer); return }
  if (t.dataset.repQuitar) {
    const [set, numero, nombre] = JSON.parse(t.dataset.repQuitar)
    t.disabled = true
    supabase.rpc('catalogo_repetidas_distintas', { p_market: mercadoActual(), p_set: set, p_numero: numero, p_nombre: nombre, p_ids: null, p_quitar: true })
      .then(({ error }) => { if (error) showToast(`No se ha podido: ${error.message}`); return cargar() })
    return
  }
  const g = datos.grupos.find((x) => claveDeGrupo(x) === clave)
  if (!g) return
  if (t.dataset.repDistintas) {
    t.disabled = true
    supabase.rpc('catalogo_repetidas_distintas', { p_market: g.market, p_set: g.set_id, p_numero: g.numero, p_nombre: g.nombre, p_ids: g.cartas.map((c) => c.id) })
      .then(({ error }) => {
        if (error) { t.disabled = false; showToast(faltaLaMigracion(error) ? AVISO : `No se ha podido: ${error.message}`); return }
        showToast('Apuntado: no volverán a salir', 'success')
        return cargar()
      })
    return
  }
  const parEl = t.closest('[data-rep-carta]')
  const carta = parEl && g.cartas.find((c) => c.id === parEl.dataset.repCarta)
  if (!carta) return
  const el = deGrupo(clave)
  if (t.dataset.repEtiqueta) { el.etiquetas.set(carta.id, t.dataset.repEtiqueta); el.otra.delete(carta.id); pintar(); return }
  if ('repOtra' in t.dataset) {
    el.otra.add(carta.id); el.etiquetas.set(carta.id, ''); pintar()
    document.querySelector(`[data-rep-carta="${CSS.escape(carta.id)}"] .rep-otra`)?.focus()
    return
  }
  if (t.dataset.repHacer) {
    const destino = principalDe(g, el.principal)
    const etiqueta = (el.etiquetas.get(carta.id) || '').trim()
    t.disabled = true
    t.textContent = 'Haciendo…'
    resolver({ carta, destino, decision: t.dataset.repHacer, etiqueta, clase: claseDe(el.cuenta.get(carta.id), etiqueta) }).then((r) => {
      if (!r) { pintar(); return }
      avisarALaWeb()
      return cargar()
    })
  }
}

// El mismo nombre a todas las repetidas que se ven (con el filtro puesto, las
// de una colección): el Prize Pack son cientos, todas «Holo». Solo las elige;
// convertir sigue siendo «Convertir las marcadas», después de mirarlas.
function ponerATodas(etiqueta) {
  if (!etiquetaValida(etiqueta)) return
  for (const g of filtrarGrupos(datos.grupos, filtro)) {
    const clave = claveDeGrupo(g)
    const e = deGrupo(clave)
    const idP = principalDe(g, e.principal)
    for (const c of g.cartas) if (c.id !== idP) { e.etiquetas.set(c.id, etiqueta); e.otra.delete(c.id) }
  }
  pintar()
}

// Las del Prize Pack que se deciden solas (987c): la cara es la Holo.
const delPrizePack = () => datos.grupos.map((g) => holoDelPrizePack(g)).filter((r) => r.holo)

async function convertirPrizePack() {
  const boton = $('repetidasPrize')
  // Dos toques: son cientos de una vez (se deshacen una a una en «Hechas»).
  if (!boton.dataset.confirmar) {
    boton.dataset.confirmar = '1'
    pintar()
    setTimeout(() => { delete boton.dataset.confirmar; pintar() }, 6000)
    return
  }
  delete boton.dataset.confirmar
  boton.dataset.ocupado = '1'
  boton.disabled = true
  let hechas = 0
  let fallo = false
  // A tandas: la lista trae como mucho mil grupos y detrás puede haber más.
  for (let vuelta = 0; vuelta < 10 && !fallo; vuelta++) {
    const lista = delPrizePack()
    if (!lista.length) break
    for (const { normal, holo } of lista) {
      boton.textContent = `Convirtiendo ${hechas + 1}…`
      const r = await resolver({ carta: holo, destino: normal.id, decision: 'version', etiqueta: 'Holo', clase: 'impresion' }, { silencio: true })
      if (!r) { fallo = true; break }
      hechas++
    }
    await cargar()
  }
  delete boton.dataset.ocupado
  boton.disabled = false
  const quedan = datos.grupos.filter((g) => holoDelPrizePack(g).duda && holoDelPrizePack(g).duda !== 'no es del Prize Pack').length
  showToast(`${hechas} del Prize Pack convertidas en «Holo» (la más cara). ${quedan ? `${quedan} se quedan para que las mires (precio parecido, sin precio o brillan de serie).` : ''} Se deshacen desde «Hechas».`, fallo ? 'error' : 'success')
  if (hechas) avisarALaWeb()
  pintar()
}

async function convertirMarcadas() {
  const lista = marcados()
  if (!lista.length) return
  const boton = $('repetidasLote')
  boton.disabled = true
  let hechas = 0
  for (const m of lista) {
    boton.textContent = `Convirtiendo ${hechas + 1} de ${lista.length}…`
    const r = await resolver({ carta: m.carta, destino: m.destino, decision: 'version', etiqueta: m.etiqueta, clase: m.clase }, { silencio: true })
    if (!r) break
    hechas++
  }
  boton.disabled = false
  showToast(`${hechas} de ${lista.length} convertidas en versión. Se deshacen desde «Hechas».`, hechas === lista.length ? 'success' : 'error')
  if (hechas) avisarALaWeb()
  await cargar()
}

let montada = false
export async function iniciarRepetidas() {
  const caja = $('repetidasCaja')
  if (!caja) return
  if (!montada) {
    montada = true
    caja.addEventListener('click', alClic)
    caja.addEventListener('input', (e) => {
      if (e.target.id === 'repetidasFiltro') { filtro = e.target.value; pintar(); return }
      if (e.target.classList.contains('rep-otra')) {
        const parEl = e.target.closest('[data-rep-carta]')
        deGrupo(parEl.dataset.repGrupo).etiquetas.set(parEl.dataset.repCarta, e.target.value)
        // Sin repintar (se perdería el foco): solo el botón y la barra.
        const b = parEl.querySelector('[data-rep-hacer="version"]')
        if (b) b.disabled = !etiquetaValida(e.target.value)
        const lote = $('repetidasLote')
        const n = marcados().length
        if (lote) { lote.hidden = !n; lote.textContent = `Convertir las marcadas (${n})` }
      }
    })
    caja.addEventListener('change', (e) => {
      if (!e.target.matches('[data-rep-cuenta]')) return
      const parEl = e.target.closest('[data-rep-carta]')
      deGrupo(parEl.dataset.repGrupo).cuenta.set(parEl.dataset.repCarta, e.target.checked)
    })
    $('repetidasLote')?.addEventListener('click', convertirMarcadas)
    $('repetidasPrize')?.addEventListener('click', convertirPrizePack)
    const todas = $('repetidasTodas')
    if (todas) {
      todas.innerHTML = '<option value="">Poner a todas las que se ven…</option>' + ETIQUETAS.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')
      todas.addEventListener('change', () => { ponerATodas(todas.value); todas.value = '' })
    }
    $('coleccionesMercado')?.addEventListener('change', () => { eleccion.clear(); cargar() })
  }
  await cargar()
}
