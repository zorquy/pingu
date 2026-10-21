// ── El editor de colecciones (tanda 550) ──
//
// PINGU: «me gustaría que los sets en el panel de admin fuesen editables.
// Ya sea para ordenar yo manualmente los sets por eras, añadir una era
// nueva… que yo pudiese crear una era, por ejemplo McDonald's, y ahí
// incluir todas las expansiones del McDonald's. Los sets que sobren los
// borro, y los que estén mal los puedo corregir yo. También para meterle
// el logo o no, y para mover el orden».
//
// Lo que hay aquí no es una pantalla de base de datos: es la biblioteca
// COMO SE VE, con las mismas eras y el mismo orden, y cada cosa editable
// donde está. Una tabla de 231 filas con una columna `serie_id` sería más
// corta de escribir y no se podría usar para esto, que es colocar.
//
// ── POR QUÉ ESCONDER Y NO BORRAR ──
//
// Borrar un set se lleva sus cartas por delante (`on delete cascade`), y
// con ellas las de la colección de quien las tuviera. Así que el botón
// normal es ESCONDER —que se deshace— y el de borrar pregunta cuántas
// cartas y cuántas líneas de colección se lleva por delante ANTES de
// hacerlo. Un borrado que no enseña su impacto es un borrado a ciegas, y
// de eso ya se aprendió en la 543.
import { supabase } from '../../js/supabase.js'
import { escapeHtml, validateImageFile, uploadGuideImage, getSession } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { nombreDeSet, eraDeSet } from '../../js/catalogo-series.js'
import { MERCADOS_VISIBLES, NOMBRE_MERCADO } from '../../js/mercados.js'
import { moverEnLista, loQueCambia, dondeCae } from './orden-arrastrable.js'
import { TITULOS_DE_GRUPO } from '../../js/mi-coleccion/estanteria.js'
import { loQueCambia as cambiosDe, faltaLaMigracion as esFaltaDeRpc } from './catalogo-puro.js'
import { cartasDeLista, idDeCartaAMano } from './lista-cartas-puro.js'

const $ = (id) => document.getElementById(id)

let mercado = 'WEST'
let sets = []
let eras = new Map()
let filtro = ''

const COLUMNAS =
  'id,market,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,logo_tcggo,' +
  'symbol_scrydex,release_date,card_count_official,card_count_total,tcg_online_code,' +
  'orden,oculto,scrydex_manda,scrydex_id,tcggo_id,origen'

// ── LO CORREGIDO A MANO MANDA (tanda 885) ──
//
// PINGU: «debería ser reemplazable lo que meto a mano sobre lo que está
// automático». Un `update` a secas lo pisa la siguiente pasada (el calco
// japonés rotula el set con lo de TCGGO cada día). Así que lo que se
// cambia desde el editor va por `catalogo_corregir`, que lo apunta como
// CORRECCIÓN y la base lo vuelve a poner encima de cualquier escritura.
// Solo las columnas que han CAMBIADO: una corrección sobre una columna
// que no se tocó la clavaría para siempre en el valor de hoy.
//
// Lo que no es dato del catálogo (`scrydex_manda`, un interruptor de las
// pasadas) y lo que se coloca arrastrando (`orden`, la era) siguen yendo
// por `update`: eso ya lo escribe solo una persona.
const CORREGIBLES = new Set(['name', 'name_en', 'serie_id', 'serie_name', 'serie_name_en', 'release_date',
  'card_count_official', 'card_count_total', 'tcg_online_code', 'logo_tcggo', 'logo_scrydex', 'logo_path',
  'symbol_scrydex', 'oculto', 'orden', 'origen'])
const AVISO_MIGRACION = 'Guardado, pero falta ejecutar supabase-migration-885-catalogo-correcciones.sql: hasta entonces una pasada automática puede pisarlo.'
// id del set → Map(columna → { valor, anterior })
let correcciones = new Map()

// ¿Está puesta la migración? Una columna que no existe da un 400 de
// PostgREST con el nombre dentro, y eso se puede CONTAR como lo que es —
// «falta la migración»— en vez de dejar la pantalla en blanco (la 510).
let faltaLaMigracion = false
// ¿Existe `tcg_eras.grupo` (904)? Si no, el editor de eras no lo ofrece.
let hayGrupo = false

async function cargar() {
  faltaLaMigracion = false
  const { data, error } = await supabase
    .from('tcg_sets')
    .select(COLUMNAS)
    .eq('market', mercado)
    .limit(1000)
  if (error && /column|42703/i.test(error.message || '')) {
    faltaLaMigracion = true
    sets = []
    eras = new Map()
    return
  }
  sets = data || []
  // `grupo` (904) llega con su migración: hasta entonces pedirla tumba la
  // consulta entera (42703), así que se vuelve a pedir sin ella y el
  // editor no la ofrece (`hayGrupo`).
  let { data: filas, error: eg } = await supabase.from('tcg_eras').select('id,nombre,orden,grupo').eq('market', mercado)
  hayGrupo = !eg
  if (eg) ({ data: filas } = await supabase.from('tcg_eras').select('id,nombre,orden').eq('market', mercado))
  eras = new Map((filas || []).map((e) => [e.id, { nombre: e.nombre, orden: e.orden, grupo: e.grupo || null }]))
  // Las correcciones de los sets (885). Si la tabla no está, no hay.
  correcciones = new Map()
  const { data: corr, error: e2 } = await supabase
    .from('tcg_correcciones').select('id,columna,valor,anterior').eq('tabla', 'tcg_sets').eq('market', mercado).limit(5000)
  if (!e2) {
    for (const c of corr || []) {
      if (!correcciones.has(c.id)) correcciones.set(c.id, new Map())
      correcciones.get(c.id).set(c.columna, { valor: c.valor, anterior: c.anterior })
    }
  }
}

// Las eras de este catálogo, en el orden en que se van a enseñar. Cada una
// con sus sets. Mismo criterio que la biblioteca: lo puesto a mano primero
// y en su orden, lo demás detrás por su set más nuevo.
function porEras() {
  const grupos = new Map()
  for (const s of sets) {
    const clave = s.serie_id || ''
    if (!grupos.has(clave)) {
      const aMano = eras.get(clave)
      grupos.set(clave, {
        id: clave,
        nombre: aMano?.nombre || eraDeSet(s) || clave || 'Sin era',
        suya: !!aMano,
        orden: Number.isFinite(Number(aMano?.orden)) ? Number(aMano.orden) : null,
        grupo: TITULOS_DE_GRUPO[aMano?.grupo] ? aMano.grupo : null,
        sets: [],
      })
    }
    grupos.get(clave).sets.push(s)
  }
  const fecha = (x) => Date.parse(x?.release_date || '') || -Infinity
  const lista = [...grupos.values()]
  for (const g of lista) {
    g.sets.sort((a, b) => {
      const oa = Number.isFinite(Number(a.orden)) ? Number(a.orden) : null
      const ob = Number.isFinite(Number(b.orden)) ? Number(b.orden) : null
      if (oa !== null && ob !== null && oa !== ob) return oa - ob
      if (oa !== null && ob === null) return -1
      if (oa === null && ob !== null) return 1
      return fecha(b) - fecha(a)
    })
  }
  lista.sort((a, b) => {
    // Las de «Otros sets» al fondo, como en la biblioteca (904).
    if (!!a.grupo !== !!b.grupo) return a.grupo ? 1 : -1
    if (a.orden !== null && b.orden !== null && a.orden !== b.orden) return a.orden - b.orden
    if (a.orden !== null && b.orden === null) return -1
    if (a.orden === null && b.orden !== null) return 1
    const na = Math.max(...a.sets.map(fecha))
    const nb = Math.max(...b.sets.map(fecha))
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na
    return String(a.id).localeCompare(String(b.id))
  })
  return lista
}

function casa(s) {
  if (!filtro) return true
  const t = filtro.toLowerCase()
  return [s.id, s.name, s.name_en, s.tcg_online_code].filter(Boolean).some((x) => String(x).toLowerCase().includes(t))
}

function logoDe(s) {
  if (s.logo_scrydex) return s.logo_scrydex
  if (s.logo_tcggo) return s.logo_tcggo
  if (s.logo_path) return `https://assets.tcgdex.net/${mercado === 'JP' ? 'ja' : 'es'}/${s.logo_path}.webp`
  return null
}

function chapaDe(s) {
  const n = correcciones.get(s.id)?.size || 0
  if (s.origen === 'mano') return '<span class="cat-chapa cat-chapa-mano">a mano</span>'
  if (n) return `<span class="cat-chapa cat-chapa-corregida">${n === 1 ? '1 corrección' : `${n} correcciones`}</span>`
  return ''
}

function filaDeSet(s) {
  const logo = logoDe(s)
  const cartas = s.card_count_official || s.card_count_total || 0
  // EL ASA, QUE ES UN BOTÓN DE VERDAD (tanda 551). PINGU: «no quiero meter
  // números, quiero simplemente arrastrar una colección arriba o abajo».
  // Es un `<button>` y no un adorno porque arrastrar no se puede hacer con
  // el teclado: con el asa enfocada, las flechas mueven la colección.
  return `<li class="col-set${s.oculto ? ' col-set-oculto' : ''}" data-set="${escapeHtml(s.id)}" draggable="true">
    <button class="col-asa" data-asa="${escapeHtml(s.id)}" aria-label="Mover ${escapeHtml(nombreDeSet(s) || s.id)}. Arrastra, o usa las flechas arriba y abajo." title="Arrastra para colocar (o flechas ↑ ↓)">⠿</button>
    <span class="col-set-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy">` : '<span class="col-set-sinlogo">sin logo</span>'}</span>
    <span class="col-set-nombre">
      <strong>${escapeHtml(nombreDeSet(s) || s.id)}</strong>
      <small>${escapeHtml(s.id)}${s.tcg_online_code ? ` · ${escapeHtml(s.tcg_online_code)}` : ''}${s.release_date ? ` · ${escapeHtml(s.release_date)}` : ''} · ${cartas} cartas ${chapaDe(s)}</small>
    </span>
    <span class="col-set-acciones">
      <button class="btn-outline btn-small" data-editar="${escapeHtml(s.id)}">Editar</button>
      <button class="btn-outline btn-small" data-ocultar="${escapeHtml(s.id)}">${s.oculto ? 'Mostrar' : 'Esconder'}</button>
    </span>
  </li>`
}

export function pintarColecciones() {
  const caja = $('coleccionesLista')
  if (!caja) return
  if (faltaLaMigracion) {
    caja.innerHTML = `<p class="empty-state">Falta por ejecutar <code>supabase-migration-colecciones-editables.sql</code> en el SQL Editor. Hasta entonces esto no puede ordenar nada.</p>`
    return
  }
  const grupos = porEras()
  const resumen = $('coleccionesResumen')
  if (resumen) {
    const ocultos = sets.filter((s) => s.oculto).length
    resumen.textContent =
      `${sets.length} colecciones en ${grupos.length} eras` +
      (ocultos ? ` · ${ocultos} escondida${ocultos === 1 ? '' : 's'}` : '') +
      ` · ${sets.filter((s) => !logoDe(s)).length} sin logo`
  }
  let rotuloPuesto = false
  caja.innerHTML = grupos
    .map((g) => {
      const visibles = g.sets.filter(casa)
      if (!visibles.length) return ''
      // El rótulo del grupo, una vez, encima de la primera era que cae en
      // él. Va FUERA de la sección para que arrastrar una era no lo mueva.
      let rotulo = ''
      if (g.grupo && !rotuloPuesto) { rotuloPuesto = true; rotulo = `<h2 class="col-grupo">${escapeHtml(TITULOS_DE_GRUPO[g.grupo])}</h2>` }
      return `${rotulo}<section class="col-era" data-era="${escapeHtml(g.id)}" draggable="true">
        <header class="col-era-cab">
          <button class="col-asa" data-asa-era="${escapeHtml(g.id)}" aria-label="Mover la era ${escapeHtml(g.nombre)}. Arrastra, o usa las flechas arriba y abajo." title="Arrastra para colocar (o flechas ↑ ↓)">⠿</button>
          <h3>${escapeHtml(g.nombre)}</h3>
          <span class="col-era-cuenta">${g.sets.length}</span>
          <button class="btn-outline btn-small" data-era-editar="${escapeHtml(g.id)}">Renombrar</button>
        </header>
        <ul class="col-sets">${visibles.map(filaDeSet).join('')}</ul>
      </section>`
    })
    .join('') || '<p class="empty-state">Ninguna colección coincide con el filtro.</p>'
  escuchar()
}

// Guardar un puñado de columnas de un set. Devuelve si ha ido bien: una
// escritura que la política rechaza NO da error, así que se mira la fila
// que vuelve (la lección de los torneos, tanda 252).
// ── QUE LA WEB LO ENSEÑE YA (tanda 908) ──
//
// PINGU: «ordeno las eras, meto las expansiones o cambio cosas y luego en
// la web no se ha cambiado». La estantería sale de una copia que guarda la
// CDN (813); después de guardar se le pide a Netlify que la tire. Una vez
// por tanda de cambios: arrastrar diez colecciones son diez guardados y un
// solo vaciado, un segundo después del último.
let vaciado = null
function avisarALaWeb() {
  clearTimeout(vaciado)
  vaciado = setTimeout(async () => {
    try {
      const session = await getSession()
      const res = await fetch('/.netlify/functions/sets-purgar', { method: 'POST', headers: { authorization: `Bearer ${session?.access_token || ''}` } })
      const r = await res.json().catch(() => ({}))
      if (!res.ok || !r.ok) throw new Error(r.error || `Error ${res.status}`)
      showToast('La web ya enseña los cambios.', 'success')
    } catch (e) {
      showToast(`Guardado, pero la web puede tardar hasta diez minutos en enseñarlo (${String(e?.message || e).slice(0, 90)}).`, 'error')
    }
  }, 1000)
}

async function guardarSet(id, campos, { comoCorreccion = false } = {}) {
  const s = sets.find((x) => x.id === id)
  let directos = campos
  if (comoCorreccion) {
    // Lo corregible que ha cambiado, por la RPC; lo demás, directo.
    const cambios = cambiosDe(s, Object.fromEntries(Object.entries(campos).filter(([k]) => CORREGIBLES.has(k))))
    directos = Object.fromEntries(Object.entries(campos).filter(([k]) => !CORREGIBLES.has(k)))
    if (Object.keys(cambios).length) {
      const { error } = await supabase.rpc('catalogo_corregir', { p_tabla: 'tcg_sets', p_id: id, p_market: mercado, p_cambios: cambios })
      if (error && !esFaltaDeRpc(error)) { showToast(error.message.slice(0, 120), 'error'); return false }
      if (error) { showToast(AVISO_MIGRACION, 'error'); directos = { ...directos, ...cambios } }
    }
  }
  if (Object.keys(directos).length) {
    const { data, error } = await supabase
      .from('tcg_sets')
      .update(directos)
      .eq('id', id)
      .eq('market', mercado)
      .select('id')
    if (error) { showToast(error.message.slice(0, 120), 'error'); return false }
    if (!data?.length) { showToast('No se ha podido guardar: ¿sigues teniendo permiso de admin?', 'error'); return false }
  }
  if (s) Object.assign(s, campos)
  avisarALaWeb()
  return true
}

// ── COLOCAR ARRASTRANDO (tanda 551) ──
//
// PINGU: «no me gusta la forma de ordenar, no quiero meter números; quiero
// simplemente arrastrar una colección arriba o abajo».
//
// Y tenía razón: un número es cómo se GUARDA el orden, no cómo se decide.
// Para mover una colección tres puestos había que mirar qué número tenían
// las de alrededor y calcular uno en medio, que es pedirle a una persona
// que haga de base de datos.
//
// Lo que se guarda sigue siendo el número, y se recalcula de diez en diez
// al soltar (10, 20, 30…). De diez y no de uno por una razón: así una
// colocación suelta —arrastrar UNA— solo tiene que escribir las filas que
// de verdad se movieron, y no renumerar las doscientas.

// Escribe el orden nuevo de una lista, y SOLO lo que cambia. Devuelve
// cuántas filas se han tocado, que es lo que se dice por pantalla.
async function guardarOrden(ids, enLaEra = null) {
  const antes = new Map(sets.map((s) => [s.id, s.orden]))
  const cambios = new Map(loQueCambia(antes, ids).map((c) => [c.id, c.orden]))
  let tocadas = 0
  for (const id of ids) {
    const s = sets.find((x) => x.id === id)
    if (!s) continue
    const campos = {}
    if (cambios.has(id)) campos.orden = cambios.get(id)
    // Arrastrar una colección a otra era la MUEVE de era, que es lo que
    // espera quien la suelta ahí. Y la era va como CORRECCIÓN (908): a
    // pelo, la siguiente pasada del catálogo le devolvía la suya y el
    // cambio se deshacía solo. El orden sigue directo: nadie lo reescribe,
    // y «Volver al orden del catálogo» lo tiene que poder quitar.
    if (enLaEra !== null && s.serie_id !== enLaEra) {
      if (!(await guardarSet(s.id, { serie_id: enLaEra }, { comoCorreccion: true }))) continue
      if (!Object.keys(campos).length) { tocadas++; continue }
    }
    if (!Object.keys(campos).length) continue
    if (await guardarSet(s.id, campos)) tocadas++
  }
  return tocadas
}

// El que se está arrastrando. Uno a la vez, así que una variable basta.
let arrastrando = null

// Lo de arriba traducido a elementos: el módulo puro habla de cajas y aquí
// se le dan las de verdad.
function filaDondeCae(contenedor, y) {
  const hijos = [...contenedor.querySelectorAll(':scope > [data-set], :scope > [data-era]')]
  const cajas = hijos.map((h, i) => {
    const c = h.getBoundingClientRect()
    return { id: i, top: c.top, alto: c.height }
  })
  const i = dondeCae(cajas, y)
  return i === null ? null : hijos[i]
}

function escucharArrastre() {
  const lista = $('coleccionesLista')
  if (!lista || lista.dataset.arrastre) return
  lista.dataset.arrastre = '1'

  lista.addEventListener('dragstart', (e) => {
    const fila = e.target.closest('[data-set], [data-era]')
    if (!fila) return
    arrastrando = fila
    fila.classList.add('col-arrastrando')
    // Firefox no empieza a arrastrar si no se pone algo en el paquete.
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', fila.dataset.set || fila.dataset.era || '') } catch { /* da igual */ }
  })

  lista.addEventListener('dragover', (e) => {
    if (!arrastrando) return
    const esSet = !!arrastrando.dataset.set
    // Un set se suelta en la lista de sets de CUALQUIER era —que es como
    // se mueve de era arrastrando— y una era entre las eras.
    const destino = esSet ? e.target.closest('.col-sets') : lista
    if (!destino) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const antes = filaDondeCae(destino, e.clientY)
    if (antes === arrastrando) return
    if (antes) destino.insertBefore(arrastrando, antes)
    else destino.appendChild(arrastrando)
  })

  lista.addEventListener('dragend', async () => {
    if (!arrastrando) return
    const fila = arrastrando
    arrastrando = null
    fila.classList.remove('col-arrastrando')
    await guardarLoQueSeVe(fila)
  })
}

// Lo que hay en pantalla ES el orden. Se lee del DOM y se guarda.
async function guardarLoQueSeVe(fila) {
  if (fila.dataset.set) {
    const ul = fila.closest('.col-sets')
    const era = ul?.closest('.col-era')?.dataset.era ?? null
    const ids = [...ul.querySelectorAll(':scope > [data-set]')].map((x) => x.dataset.set)
    const n = await guardarOrden(ids, era === '' ? null : era)
    if (n) showToast(n === 1 ? 'Colocada' : `Colocadas ${n}`)
  } else {
    const ids = [...$('coleccionesLista').querySelectorAll(':scope > [data-era]')].map((x) => x.dataset.era)
    for (let i = 0; i < ids.length; i++) await guardarEra(ids[i], { orden: (i + 1) * 10 })
    showToast('Eras colocadas')
  }
  await cargar()
  pintarColecciones()
}

function escuchar() {
  escucharArrastre()
  // Con el asa enfocada, las flechas mueven: arrastrar no se puede hacer
  // con el teclado, y esta pantalla la usa PINGU pero no solo un ratón.
  document.querySelectorAll('[data-asa], [data-asa-era]').forEach((b) =>
    b.addEventListener('keydown', async (e) => {
      const paso = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
      if (!paso) return
      e.preventDefault()
      const fila = b.closest('[data-set], [data-era]')
      const contenedor = fila.dataset.set ? fila.closest('.col-sets') : $('coleccionesLista')
      const sel = fila.dataset.set ? ':scope > [data-set]' : ':scope > [data-era]'
      const ids = [...contenedor.querySelectorAll(sel)].map((x) => x.dataset.set || x.dataset.era)
      const movida = moverEnLista(ids, fila.dataset.set || fila.dataset.era, paso)
      if (movida.join() === ids.join()) return
      const refs = new Map([...contenedor.querySelectorAll(sel)].map((x) => [x.dataset.set || x.dataset.era, x]))
      for (const id of movida) contenedor.appendChild(refs.get(id))
      await guardarLoQueSeVe(fila)
      // El foco se va con el repintado: se devuelve a la misma asa, que si
      // no hay que volver a buscarla para dar el segundo paso.
      const atributo = fila.dataset.set ? 'data-asa' : 'data-asa-era'
      document.querySelector(`[${atributo}="${CSS.escape(fila.dataset.set || fila.dataset.era)}"]`)?.focus()
    })
  )
  document.querySelectorAll('[data-ocultar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const s = sets.find((x) => x.id === b.dataset.ocultar)
      if (s && (await guardarSet(s.id, { oculto: !s.oculto }, { comoCorreccion: true }))) { await cargar(); pintarColecciones() }
    })
  )
  document.querySelectorAll('[data-editar]').forEach((b) =>
    b.addEventListener('click', () => abrirEditor(b.dataset.editar))
  )
  document.querySelectorAll('[data-era-editar]').forEach((b) =>
    b.addEventListener('click', () => abrirEditorDeEra(b.dataset.eraEditar))
  )
}

// ── Las eras ──
//
// Una era no se «crea» en ninguna parte: la era de un set es su
// `serie_id`, y lo que se guarda aquí es cómo se llama y dónde va. Por eso
// crear una es escribir un identificador y un nombre, y meterle sets es
// editar los sets. Lo contrario —una tabla de la que cuelguen— obligaría a
// migrar los ~40 identificadores que ya vienen de los catálogos.
async function guardarEra(id, campos) {
  const antes = eras.get(id) || { nombre: id, orden: 0, grupo: null }
  const fila = { market: mercado, id, nombre: campos.nombre ?? antes.nombre, orden: campos.orden ?? antes.orden ?? 0 }
  // El grupo solo se escribe si la columna existe (904): un upsert que
  // nombra una columna que no está falla ENTERO, nombre y orden incluidos.
  if (hayGrupo) fila.grupo = 'grupo' in campos ? campos.grupo || null : antes.grupo ?? null
  const { error } = await supabase.from('tcg_eras').upsert(fila, { onConflict: 'market,id' })
  if (error) { showToast(error.message.slice(0, 120), 'error'); return false }
  eras.set(id, { nombre: fila.nombre, orden: fila.orden, grupo: fila.grupo ?? null })
  avisarALaWeb()
  return true
}

function abrirEditorDeEra(id) {
  const g = porEras().find((x) => x.id === id)
  if (!g) return
  abrirHoja(`
    <h3>La era «${escapeHtml(g.nombre)}»</h3>
    <p class="admin-note">Identificador: <code>${escapeHtml(id || '(sin era)')}</code> · ${g.sets.length} colecciones.</p>
    <label>Cómo se llama<input id="colEraNombre" type="text" maxlength="80" value="${escapeHtml(g.nombre)}"></label>
    <label>En qué orden va <small>(menor = más arriba; vacío = por fecha)</small>
      <input id="colEraOrden" type="number" inputmode="numeric" value="${g.orden ?? ''}"></label>
    ${hayGrupo ? `<label>Dónde va <small>(«Otros sets» cuelga al fondo, debajo de la última era)</small>
      <select id="colEraGrupo">
        <option value=""${g.grupo ? '' : ' selected'}>Entre las eras</option>
        ${Object.entries(TITULOS_DE_GRUPO).map(([v, t]) => `<option value="${escapeHtml(v)}"${g.grupo === v ? ' selected' : ''}>En «${escapeHtml(t)}»</option>`).join('')}
      </select></label>` : ''}
    <div class="col-hoja-pie">
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-primary" id="colEraGuardar">Guardar</button>
    </div>`)
  $('colEraGuardar').addEventListener('click', async () => {
    const nombre = $('colEraNombre').value.trim()
    if (!nombre) return showToast('La era necesita un nombre.', 'error')
    const o = $('colEraOrden').value.trim()
    const campos = { nombre, orden: o === '' ? 0 : Number(o) }
    if (hayGrupo) campos.grupo = $('colEraGrupo').value || null
    if (await guardarEra(id, campos)) {
      cerrarHoja(); pintarColecciones(); showToast('Era guardada')
    }
  })
}

function abrirEditor(id) {
  const s = sets.find((x) => x.id === id)
  if (!s) return
  const erasDisponibles = [...new Set(sets.map((x) => x.serie_id).filter(Boolean))].sort()
  const corr = correcciones.get(s.id) || new Map()
  const quitar = (col, rotulo = 'corregida · quitar') => corr.has(col) ? ` <button type="button" class="cat-quitar" data-quitar-set="${col}" title="Quitar la corrección y volver a lo que traía el catálogo">${rotulo}</button>` : ''
  const clase = (col) => corr.has(col) ? ' class="cat-campo-corregida"' : ''
  const logoActual = s.logo_scrydex || s.logo_tcggo || ''
  abrirHoja(`
    <h3>${escapeHtml(nombreDeSet(s) || s.id)}</h3>
    <p class="admin-note"><code>${escapeHtml(s.id)}</code> · ${escapeHtml(mercado)}${s.tcggo_id ? ` · TCGGO ${escapeHtml(String(s.tcggo_id))}` : ''}${s.origen === 'mano' ? ' · escrita a mano' : ''}${corr.size ? ` · ${corr.size} ${corr.size === 1 ? 'corrección' : 'correcciones'}` : ''}</p>
    <p><button class="btn-secondary btn-small" id="colCartas">Ver y editar sus cartas →</button></p>
    <div class="idi-caja" id="colIdiomas"></div>
    <label${clase('name')}>Nombre${quitar('name')}<input id="colNombre" type="text" value="${escapeHtml(s.name || '')}"></label>
    <label${clase('name_en')}>Nombre occidental <small>(el que se enseña si el de arriba lleva kanji)</small>${quitar('name_en')}
      <input id="colNombreEn" type="text" value="${escapeHtml(s.name_en || '')}"></label>
    <div class="cat-campos">
      <label class="cat-campo-medio${corr.has('release_date') ? ' cat-campo-corregida' : ''}">Fecha de salida${quitar('release_date')}<input id="colFecha" type="date" value="${escapeHtml(s.release_date || '')}"></label>
      <label class="cat-campo-medio${corr.has('tcg_online_code') ? ' cat-campo-corregida' : ''}">Código (TCG Live)${quitar('tcg_online_code')}<input id="colCodigo" type="text" value="${escapeHtml(s.tcg_online_code || '')}"></label>
      <label class="cat-campo-medio${corr.has('card_count_official') ? ' cat-campo-corregida' : ''}">Cartas (oficial)${quitar('card_count_official')}<input id="colCuentaOficial" type="number" inputmode="numeric" value="${s.card_count_official ?? ''}"></label>
      <label class="cat-campo-medio${corr.has('card_count_total') ? ' cat-campo-corregida' : ''}">Cartas (total)${quitar('card_count_total')}<input id="colCuentaTotal" type="number" inputmode="numeric" value="${s.card_count_total ?? ''}"></label>
    </div>
    <label>Era
      <input id="colEra" type="text" list="colErasLista" value="${escapeHtml(s.serie_id || '')}" placeholder="mcdonalds">
      <datalist id="colErasLista">${erasDisponibles.map((e) => `<option value="${escapeHtml(e)}">`).join('')}</datalist>
    </label>
    <label>Cómo se llama esa era <small>(solo si la estás creando)</small>
      <input id="colEraNombreNuevo" type="text" maxlength="80" placeholder="McDonald's"></label>
    <label>Orden dentro de la era <small>(vacío = por fecha)</small>
      <input id="colOrden" type="number" inputmode="numeric" value="${s.orden ?? ''}"></label>
    <label${corr.has('logo_scrydex') || corr.has('logo_tcggo') ? ' class="cat-campo-corregida"' : ''}>Logo <small>(vacío = el que traiga el catálogo)</small>${quitar('logo_scrydex', 'corregido · quitar')}
      <span class="col-logo-caja">
        <span class="col-logo-ver" id="colLogoVer">${logoDe(s) ? `<img src="${escapeHtml(logoDe(s))}" alt="">` : '<span class="col-set-sinlogo">sin logo</span>'}</span>
        <input type="file" id="colLogoFichero" accept="image/*" aria-label="Subir un logo">
      </span>
      <input id="colLogo" type="url" value="${escapeHtml(logoActual)}" placeholder="…o pega una dirección"></label>
    <label class="col-check"><input id="colScrydexManda" type="checkbox"${s.scrydex_manda ? ' checked' : ''}> Rellenar este set desde Scrydex aunque sea occidental</label>
    <label class="col-check${corr.has('oculto') ? ' cat-campo-corregida' : ''}"><input id="colOculto" type="checkbox"${s.oculto ? ' checked' : ''}> Escondido de la biblioteca${quitar('oculto', 'corregido · quitar')}</label>
    <div class="col-hoja-pie">
      <button class="btn-danger btn-small" id="colBorrar">Borrar la colección…</button>
      <span style="flex:1"></span>
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-primary" id="colGuardar">Guardar</button>
    </div>`)

  // ── SUBIR EL LOGO, no solo pegar un enlace (tanda 551) ──
  //
  // PINGU: «al editar el logo, que también pueda cargar yo una imagen, no
  // solamente poner un enlace».
  //
  // Va al mismo sitio que las imágenes de las guías (`guide-images`), que
  // es un cubo PÚBLICO y con permiso de subida para quien ha entrado. Un
  // cubo nuevo pediría otra migración y otras políticas para guardar lo
  // mismo: una imagen que se va a enseñar a todo el mundo.
  //
  // Lo que se sube RELLENA la caja de la dirección en vez de guardarse por
  // su cuenta: así solo hay un sitio del que sale el logo y se puede
  // cancelar sin haber cambiado nada.
  $('colLogoFichero')?.addEventListener('change', async (e) => {
    const fichero = e.target.files?.[0]
    if (!fichero) return
    const ver = $('colLogoVer')
    try {
      validateImageFile(fichero)
      if (ver) ver.innerHTML = '<span class="col-set-sinlogo">subiendo…</span>'
      const { data: { session } = {} } = await supabase.auth.getSession()
      if (!session) throw new Error('Hay que entrar para subir una imagen.')
      const url = await uploadGuideImage(session.user.id, fichero)
      $('colLogo').value = url
      if (ver) ver.innerHTML = `<img src="${escapeHtml(url)}" alt="">`
      showToast('Logo subido. Dale a Guardar para dejarlo puesto.')
    } catch (err) {
      if (ver) ver.innerHTML = '<span class="col-set-sinlogo">sin logo</span>'
      showToast(String(err?.message || err).slice(0, 140), 'error')
    } finally {
      e.target.value = ''
    }
  })

  // Los idiomas del set y sus versiones por idioma (956), en su módulo.
  void import('./idiomas-set.js').then((m) => m.pintarIdiomasDeSet({
    set: s,
    mercado,
    caja: $('colIdiomas'),
    abrirVersiones: () => m.abrirVersionesPorIdioma({ set: s, mercado, hoja: { abrir: abrirHoja }, volver: () => abrirEditor(s.id) }),
  }))

  $('colCartas').addEventListener('click', async () => {
    const { abrirCartasDeSet } = await import('./catalogo-cartas.js')
    abrirCartasDeSet(s, mercado, { abrir: abrirHoja, cerrar: cerrarHoja }, () => abrirEditor(s.id))
  })

  document.querySelectorAll('[data-quitar-set]').forEach((b) =>
    b.addEventListener('click', async () => {
      const col = b.dataset.quitarSet
      // El logo va en las dos columnas: se quitan las dos.
      const cols = col === 'logo_scrydex' ? ['logo_scrydex', 'logo_tcggo'].filter((c) => corr.has(c)) : [col]
      for (const c of cols) {
        const { error } = await supabase.rpc('catalogo_descorregir', { p_tabla: 'tcg_sets', p_id: s.id, p_market: mercado, p_columna: c })
        if (error) return showToast(error.message.slice(0, 140), 'error')
      }
      showToast('Corrección quitada: vuelve lo del catálogo', 'success')
      avisarALaWeb()
      await cargar(); pintarColecciones(); abrirEditor(s.id)
    })
  )

  $('colGuardar').addEventListener('click', async () => {
    const era = $('colEra').value.trim().toLowerCase()
    if (era && !/^[a-z0-9][a-z0-9-]*$/.test(era)) {
      return showToast('El identificador de la era va en minúsculas, sin espacios (p. ej. «mcdonalds»).', 'error')
    }
    const o = $('colOrden').value.trim()
    const numero = (id) => { const t = $(id).value.trim(); return t === '' ? null : Number(t) }
    const campos = {
      name: $('colNombre').value.trim() || s.name,
      name_en: $('colNombreEn').value.trim() || null,
      serie_id: era || null,
      orden: o === '' ? null : Number(o),
      release_date: $('colFecha').value.trim() || null,
      tcg_online_code: $('colCodigo').value.trim() || null,
      card_count_official: numero('colCuentaOficial'),
      card_count_total: numero('colCuentaTotal'),
      scrydex_manda: $('colScrydexManda').checked,
      oculto: $('colOculto').checked,
    }
    // El logo puesto a mano va en LAS DOS columnas (885): la biblioteca
    // mira `logo_tcggo` primero en el japonés y `logo_scrydex` en el
    // occidental, y las dos las reescriben sus pasadas.
    const logo = $('colLogo').value.trim() || null
    if (logo !== (logoActual || null)) { campos.logo_scrydex = logo; campos.logo_tcggo = logo }
    const nombreEra = $('colEraNombreNuevo').value.trim()
    if (era && nombreEra) await guardarEra(era, { nombre: nombreEra })
    if (await guardarSet(s.id, campos, { comoCorreccion: true })) {
      await cargar(); cerrarHoja(); pintarColecciones(); showToast('Colección guardada', 'success')
    }
  })

  $('colBorrar').addEventListener('click', async () => {
    // EL IMPACTO, ANTES. Borrar un set se lleva sus cartas por `on delete
    // cascade`, y con ellas lo que alguien tuviera guardado.
    const { count: cartas } = await supabase
      .from('tcg_cards').select('id', { count: 'exact', head: true })
      .eq('set_id', s.id).eq('market', mercado)
    const texto = `Se va a borrar «${nombreDeSet(s) || s.id}» y sus ${cartas ?? '?'} cartas.\n\n`
      + 'Las cartas se van con el set, y con ellas las copias que alguien tuviera guardadas de ese set.\n\n'
      + 'Si solo quieres que no salga en la biblioteca, cancela y usa «Esconder», que se deshace.\n\n'
      + `Escribe el identificador (${s.id}) para confirmar:`
    const dicho = window.prompt(texto)
    if (dicho !== s.id) return showToast('No se ha borrado nada.')
    const { error } = await supabase.from('tcg_sets').delete().eq('id', s.id).eq('market', mercado)
    if (error) return showToast(error.message.slice(0, 120), 'error')
    sets = sets.filter((x) => x.id !== s.id)
    avisarALaWeb()
    cerrarHoja(); pintarColecciones(); showToast('Colección borrada')
  })
}

// ── VOLVER AL ORDEN DEL CATÁLOGO (tanda 552) ──
//
// PINGU: «recolócame todas las eras por orden de Scrydex, porque no sé qué
// he hecho aquí, he hecho un lío». Y eso no puede ser algo que haya que
// pedirme: colocar a mano se entiende probando, y probando se lía uno.
//
// No inventa un orden: QUITA el de a mano para que vuelva a mandar el del
// catálogo —cada era vale lo que su set más nuevo, y dentro de cada era
// mandan las fechas—. Los NOMBRES que se les hayan puesto a las eras se
// quedan, y los sets movidos de era también: eso son decisiones, no el
// lío.
async function volverAlOrdenDelCatalogo() {
  const colocados = sets.filter((s) => s.orden !== null && s.orden !== undefined)
  const erasColocadas = [...eras.entries()].filter(([, e]) => Number(e.orden) !== 0)
  if (!colocados.length && !erasColocadas.length) return showToast('No hay nada colocado a mano en este catálogo.')
  const dicho = window.confirm(
    `Se va a quitar el orden puesto a mano en ${colocados.length} colecciones`
    + (erasColocadas.length ? ` y ${erasColocadas.length} eras` : '')
    + ' de este catálogo.\n\nVuelve a mandar el orden del catálogo: cada era en el sitio de su colección más nueva, '
    + 'y dentro de cada era las fechas, lo más nuevo arriba.\n\n'
    + 'Los nombres que les hayas puesto a las eras NO se pierden, y las colecciones que hayas movido de era se quedan donde están.'
  )
  if (!dicho) return
  const btn = $('coleccionesReordenar')
  if (btn) btn.disabled = true
  let n = 0
  for (const s of colocados) if (await guardarSet(s.id, { orden: null })) n++
  for (const [id] of erasColocadas) await guardarEra(id, { orden: 0 })
  if (btn) btn.disabled = false
  await cargar()
  pintarColecciones()
  showToast(`Hecho: ${n} ${n === 1 ? 'colección vuelve' : 'colecciones vuelven'} al orden del catálogo`)
}

// ── UNA COLECCIÓN NUEVA, A MANO (885) ──
//
// Para lo que ninguna API tiene (el Silver Deck Kit, 884). Nace con
// `origen = 'mano'`, que el calco japonés y los reemplazos respetan, y
// luego se le meten las cartas desde su editor.
function abrirNuevaColeccion() {
  abrirHoja(`
    <h3>Nueva colección</h3>
    <p class="admin-note">Para una colección que ninguna API tiene. Nace «a mano»: ninguna pasada automática la esconderá ni la borrará. Las cartas se pueden pegar abajo, o añadirlas después desde «Ver y editar sus cartas».</p>
    <label>Identificador <small>(minúsculas, sin espacios; será su dirección)</small><input id="colNuevoId" type="text" placeholder="pcg-silver_ja"></label>
    <label>Nombre<input id="colNuevoNombre" type="text" placeholder="ロケット団ハーフデッキW -silver-"></label>
    <label>Nombre occidental<input id="colNuevoNombreEn" type="text" placeholder="Silver Deck Kit"></label>
    <div class="cat-campos">
      <label class="cat-campo-medio">Fecha de salida<input id="colNuevoFecha" type="date"></label>
      <label class="cat-campo-medio">Código (TCG Live)<input id="colNuevoCodigo" type="text"></label>
      <label class="cat-campo-medio">Cartas (total)<input id="colNuevoCuenta" type="number" inputmode="numeric"></label>
      <label class="cat-campo-medio">Era<input id="colNuevoEra" type="text" list="colErasLista" placeholder="pcg"></label>
    </div>
    <datalist id="colErasLista">${[...new Set(sets.map((x) => x.serie_id).filter(Boolean))].sort().map((e) => `<option value="${escapeHtml(e)}">`).join('')}</datalist>
    <label>Las cartas <small>(opcional: una por línea con su número, su nombre y, si quieres, el nombre en inglés, separados por ·)</small>
      <textarea id="colNuevoLista" rows="8" placeholder="001 · ストライク · Scyther&#10;002 · アサナン · Meditite"></textarea></label>
    <p class="admin-note" id="colNuevoListaResumen" aria-live="polite"></p>
    <div class="col-hoja-pie">
      <span style="flex:1"></span>
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-primary" id="colNuevoCrear">Crear</button>
    </div>`)
  // Lo que se va a crear, al escribir la lista: una línea mala se ve antes.
  const leerLista = () => cartasDeLista($('colNuevoLista').value)
  $('colNuevoLista').addEventListener('input', () => {
    const { cartas, errores } = leerLista()
    $('colNuevoListaResumen').textContent = !cartas.length && !errores.length ? '' : `${cartas.length} ${cartas.length === 1 ? 'carta' : 'cartas'}${errores.length ? ` · ${errores.join(' · ')}` : ''}`
  })
  $('colNuevoCrear').addEventListener('click', async () => {
    const lista = leerLista()
    if (lista.errores.length) return showToast(`Corrige la lista antes: ${lista.errores[0]}`, 'error')
    const id = $('colNuevoId').value.trim().toLowerCase()
    const name = $('colNuevoNombre').value.trim()
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) return showToast('El identificador va en minúsculas, sin espacios (letras, números, guion y guion bajo).', 'error')
    if (!name) return showToast('La colección necesita un nombre.', 'error')
    if (sets.some((x) => x.id === id)) return showToast(`Ya hay una colección «${id}» en este catálogo.`, 'error')
    const cuenta = $('colNuevoCuenta').value.trim()
    const cambios = { name }
    if ($('colNuevoNombreEn').value.trim()) cambios.name_en = $('colNuevoNombreEn').value.trim()
    if ($('colNuevoFecha').value) cambios.release_date = $('colNuevoFecha').value
    if ($('colNuevoCodigo').value.trim()) cambios.tcg_online_code = $('colNuevoCodigo').value.trim()
    if (cuenta !== '') { cambios.card_count_total = Number(cuenta); cambios.card_count_official = Number(cuenta) }
    else if (lista.cartas.length) { cambios.card_count_total = lista.cartas.length; cambios.card_count_official = lista.cartas.length }
    if ($('colNuevoEra').value.trim()) cambios.serie_id = $('colNuevoEra').value.trim().toLowerCase()
    const { error } = await supabase.rpc('catalogo_corregir', { p_tabla: 'tcg_sets', p_id: id, p_market: mercado, p_cambios: cambios, p_crear: true })
    if (error) return showToast(esFaltaDeRpc(error) ? 'Falta ejecutar supabase-migration-885-catalogo-correcciones.sql: sin ella no se pueden crear colecciones a mano.' : error.message.slice(0, 140), 'error')
    // Las cartas de la lista, una a una por la misma función que «Nueva
    // carta». Una que falle no para las demás, y se dice cuántas.
    let hechas = 0
    const fallos = []
    for (const c of lista.cartas) {
      const { error: e } = await supabase.rpc('catalogo_corregir', { p_tabla: 'tcg_cards', p_id: idDeCartaAMano(id, c.local_id), p_market: mercado, p_cambios: { ...c, set_id: id }, p_crear: true })
      if (e) fallos.push(`${c.local_id}: ${e.message.slice(0, 60)}`)
      else hechas++
    }
    avisarALaWeb()
    await cargar(); pintarColecciones()
    if (fallos.length) showToast(`Colección creada con ${hechas} de ${lista.cartas.length} cartas. No se han podido crear: ${fallos.slice(0, 3).join(' · ')}`, 'error')
    else showToast(lista.cartas.length ? `Colección creada con ${hechas} ${hechas === 1 ? 'carta' : 'cartas'}` : 'Colección creada', 'success')
    abrirEditor(id)
  })
}

// ── La hoja lateral ──
function abrirHoja(html) {
  const hoja = $('coleccionesHoja')
  if (!hoja) return
  hoja.innerHTML = `<div class="col-hoja-caja">${html}</div>`
  hoja.classList.remove('hidden')
  hoja.querySelectorAll('[data-cerrar-hoja]').forEach((b) => b.addEventListener('click', cerrarHoja))
}
function cerrarHoja() {
  const hoja = $('coleccionesHoja')
  if (!hoja) return
  hoja.classList.add('hidden')
  hoja.innerHTML = ''
}

export async function iniciarColecciones() {
  const sel = $('coleccionesMercado')
  if (sel && !sel.dataset.montado) {
    sel.dataset.montado = '1'
    sel.innerHTML = MERCADOS_VISIBLES.map((m) => `<option value="${m}">${escapeHtml(NOMBRE_MERCADO[m] || m)}</option>`).join('')
    sel.value = mercado
    sel.addEventListener('change', async () => {
      mercado = sel.value
      await cargar()
      pintarColecciones()
    })
  }
  $('coleccionesFiltro')?.addEventListener('input', (e) => { filtro = e.target.value.trim(); pintarColecciones() })
  $('coleccionesRecargar')?.addEventListener('click', async () => { await cargar(); pintarColecciones(); showToast('Recargado') })
  $('coleccionesReordenar')?.addEventListener('click', volverAlOrdenDelCatalogo)
  $('coleccionesNueva')?.addEventListener('click', abrirNuevaColeccion)
  await cargar()
  pintarColecciones()
}
