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
import { escapeHtml } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { nombreDeSet, eraDeSet } from '../../js/catalogo-series.js'
import { MERCADOS_VISIBLES, NOMBRE_MERCADO } from '../../js/mercados.js'

const $ = (id) => document.getElementById(id)

let mercado = 'WEST'
let sets = []
let eras = new Map()
let filtro = ''

const COLUMNAS =
  'id,market,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,' +
  'symbol_scrydex,release_date,card_count_official,card_count_total,tcg_online_code,' +
  'orden,oculto,scrydex_manda,scrydex_id'

// ¿Está puesta la migración? Una columna que no existe da un 400 de
// PostgREST con el nombre dentro, y eso se puede CONTAR como lo que es —
// «falta la migración»— en vez de dejar la pantalla en blanco (la 510).
let faltaLaMigracion = false

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
  const { data: filas } = await supabase.from('tcg_eras').select('id,nombre,orden').eq('market', mercado)
  eras = new Map((filas || []).map((e) => [e.id, { nombre: e.nombre, orden: e.orden }]))
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
  if (s.logo_path) return `https://assets.tcgdex.net/${mercado === 'JP' ? 'ja' : 'es'}/${s.logo_path}.webp`
  return null
}

function filaDeSet(s) {
  const logo = logoDe(s)
  const cartas = s.card_count_official || s.card_count_total || 0
  return `<li class="col-set${s.oculto ? ' col-set-oculto' : ''}" data-set="${escapeHtml(s.id)}">
    <span class="col-set-tira" title="Orden dentro de la era">
      <input type="number" class="col-orden" data-orden="${escapeHtml(s.id)}" value="${s.orden ?? ''}" placeholder="—" aria-label="Orden de ${escapeHtml(nombreDeSet(s))}">
    </span>
    <span class="col-set-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy">` : '<span class="col-set-sinlogo">sin logo</span>'}</span>
    <span class="col-set-nombre">
      <strong>${escapeHtml(nombreDeSet(s) || s.id)}</strong>
      <small>${escapeHtml(s.id)}${s.tcg_online_code ? ` · ${escapeHtml(s.tcg_online_code)}` : ''}${s.release_date ? ` · ${escapeHtml(s.release_date)}` : ''} · ${cartas} cartas</small>
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
  caja.innerHTML = grupos
    .map((g) => {
      const visibles = g.sets.filter(casa)
      if (!visibles.length) return ''
      return `<section class="col-era" data-era="${escapeHtml(g.id)}">
        <header class="col-era-cab">
          <input type="number" class="col-orden col-orden-era" data-orden-era="${escapeHtml(g.id)}" value="${g.orden ?? ''}" placeholder="—" aria-label="Orden de la era ${escapeHtml(g.nombre)}">
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
async function guardarSet(id, campos) {
  const { data, error } = await supabase
    .from('tcg_sets')
    .update(campos)
    .eq('id', id)
    .eq('market', mercado)
    .select('id')
  if (error) { showToast(error.message.slice(0, 120), 'error'); return false }
  if (!data?.length) { showToast('No se ha podido guardar: ¿sigues teniendo permiso de admin?', 'error'); return false }
  const s = sets.find((x) => x.id === id)
  if (s) Object.assign(s, campos)
  return true
}

function escuchar() {
  document.querySelectorAll('[data-orden]').forEach((inp) =>
    inp.addEventListener('change', async () => {
      const v = inp.value.trim()
      if (await guardarSet(inp.dataset.orden, { orden: v === '' ? null : Number(v) })) pintarColecciones()
    })
  )
  document.querySelectorAll('[data-orden-era]').forEach((inp) =>
    inp.addEventListener('change', async () => {
      const v = inp.value.trim()
      await guardarEra(inp.dataset.ordenEra, { orden: v === '' ? 0 : Number(v) })
      pintarColecciones()
    })
  )
  document.querySelectorAll('[data-ocultar]').forEach((b) =>
    b.addEventListener('click', async () => {
      const s = sets.find((x) => x.id === b.dataset.ocultar)
      if (s && (await guardarSet(s.id, { oculto: !s.oculto }))) pintarColecciones()
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
  const antes = eras.get(id) || { nombre: id, orden: 0 }
  const fila = { market: mercado, id, nombre: campos.nombre ?? antes.nombre, orden: campos.orden ?? antes.orden ?? 0 }
  const { error } = await supabase.from('tcg_eras').upsert(fila, { onConflict: 'market,id' })
  if (error) { showToast(error.message.slice(0, 120), 'error'); return false }
  eras.set(id, { nombre: fila.nombre, orden: fila.orden })
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
      <input id="colEraOrden" type="number" value="${g.orden ?? ''}"></label>
    <div class="col-hoja-pie">
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-primary" id="colEraGuardar">Guardar</button>
    </div>`)
  $('colEraGuardar').addEventListener('click', async () => {
    const nombre = $('colEraNombre').value.trim()
    if (!nombre) return showToast('La era necesita un nombre.', 'error')
    const o = $('colEraOrden').value.trim()
    if (await guardarEra(id, { nombre, orden: o === '' ? 0 : Number(o) })) {
      cerrarHoja(); pintarColecciones(); showToast('Era guardada')
    }
  })
}

function abrirEditor(id) {
  const s = sets.find((x) => x.id === id)
  if (!s) return
  const erasDisponibles = [...new Set(sets.map((x) => x.serie_id).filter(Boolean))].sort()
  abrirHoja(`
    <h3>${escapeHtml(nombreDeSet(s) || s.id)}</h3>
    <p class="admin-note"><code>${escapeHtml(s.id)}</code> · ${escapeHtml(mercado)}${s.scrydex_id ? ` · emparejado con Scrydex (<code>${escapeHtml(s.scrydex_id)}</code>)` : ' · sin emparejar con Scrydex'}</p>
    <label>Nombre<input id="colNombre" type="text" value="${escapeHtml(s.name || '')}"></label>
    <label>Nombre occidental <small>(el que se enseña si el de arriba lleva kanji)</small>
      <input id="colNombreEn" type="text" value="${escapeHtml(s.name_en || '')}"></label>
    <label>Era
      <input id="colEra" type="text" list="colErasLista" value="${escapeHtml(s.serie_id || '')}" placeholder="mcdonalds">
      <datalist id="colErasLista">${erasDisponibles.map((e) => `<option value="${escapeHtml(e)}">`).join('')}</datalist>
    </label>
    <label>Cómo se llama esa era <small>(solo si la estás creando)</small>
      <input id="colEraNombreNuevo" type="text" maxlength="80" placeholder="McDonald's"></label>
    <label>Orden dentro de la era <small>(vacío = por fecha)</small>
      <input id="colOrden" type="number" value="${s.orden ?? ''}"></label>
    <label>Logo <small>(dirección de imagen; vacío = el que traiga el catálogo)</small>
      <input id="colLogo" type="url" value="${escapeHtml(s.logo_scrydex || '')}" placeholder="https://images.scrydex.com/…"></label>
    <label class="col-check"><input id="colScrydexManda" type="checkbox"${s.scrydex_manda ? ' checked' : ''}> Rellenar este set desde Scrydex aunque sea occidental</label>
    <label class="col-check"><input id="colOculto" type="checkbox"${s.oculto ? ' checked' : ''}> Escondido de la biblioteca</label>
    <div class="col-hoja-pie">
      <button class="btn-danger btn-small" id="colBorrar">Borrar la colección…</button>
      <span style="flex:1"></span>
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-primary" id="colGuardar">Guardar</button>
    </div>`)

  $('colGuardar').addEventListener('click', async () => {
    const era = $('colEra').value.trim().toLowerCase()
    if (era && !/^[a-z0-9][a-z0-9-]*$/.test(era)) {
      return showToast('El identificador de la era va en minúsculas, sin espacios (p. ej. «mcdonalds»).', 'error')
    }
    const o = $('colOrden').value.trim()
    const campos = {
      name: $('colNombre').value.trim() || s.name,
      name_en: $('colNombreEn').value.trim() || null,
      serie_id: era || null,
      orden: o === '' ? null : Number(o),
      logo_scrydex: $('colLogo').value.trim() || null,
      scrydex_manda: $('colScrydexManda').checked,
      oculto: $('colOculto').checked,
    }
    const nombreEra = $('colEraNombreNuevo').value.trim()
    if (era && nombreEra) await guardarEra(era, { nombre: nombreEra })
    if (await guardarSet(s.id, campos)) {
      cerrarHoja(); pintarColecciones(); showToast('Colección guardada')
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
    cerrarHoja(); pintarColecciones(); showToast('Colección borrada')
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
  await cargar()
  pintarColecciones()
}
