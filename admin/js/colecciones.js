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
import { escapeHtml, validateImageFile, uploadGuideImage } from '../../js/app.js'
import { showToast } from '../../js/toast.js'
import { nombreDeSet, esDelTCG, plegarHermanos, padreDeColeccion } from '../../js/catalogo-series.js'
import { MERCADOS_VISIBLES, NOMBRE_MERCADO } from '../../js/mercados.js'
import { moverEnLista, loQueCambia, dondeCae, idDeEraNueva, conEraEn } from './orden-arrastrable.js'
import { erasDeEstanteria } from '../../js/mi-coleccion/estanteria.js'
import { avisarALaWeb } from './avisar-web.js'
import { loQueCambia as cambiosDe, faltaLaMigracion as esFaltaDeRpc } from './catalogo-puro.js'
import { cartasDeLista, idDeCartaAMano } from './lista-cartas-puro.js'

const $ = (id) => document.getElementById(id)

let mercado = 'WEST'
// TODAS las filas del catálogo (para editar cualquiera por su id)…
let sets = []
// …y lo que de ellas enseña la web (976): `repartir()`.
let principales = []
let hijosDe = new Map()
let escondidas = []
let fueraDelTcg = 0
let eras = new Map()
let filtro = ''

const COLUMNAS =
  'id,market,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,logo_tcggo,' +
  'symbol_scrydex,release_date,card_count_official,card_count_total,tcg_online_code,' +
  'orden,oculto,scrydex_manda,scrydex_id,tcggo_id,origen'
// Las ediciones gemelas (1027) van aparte y con respaldo (la 624): sin la
// migración la columna no existe y la consulta fallaría entera.
const COLUMNA_GEMELAS = 'tcggo_gemelos'
let sinGemelas = false

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
  'symbol_scrydex', 'oculto', 'orden', 'origen', 'tcggo_gemelos'])
const AVISO_MIGRACION = 'Guardado, pero falta ejecutar supabase-migration-885-catalogo-correcciones.sql: hasta entonces una pasada automática puede pisarlo.'
// id del set → Map(columna → { valor, anterior })
let correcciones = new Map()

// ¿Está puesta la migración? Una columna que no existe da un 400 de
// PostgREST con el nombre dentro, y eso se puede CONTAR como lo que es —
// «falta la migración»— en vez de dejar la pantalla en blanco (la 510).
let faltaLaMigracion = false
// ¿Existe `tcg_eras.grupo` (904)? Si no, el editor de eras no lo ofrece.
let hayGrupo = false

// Supabase corta a 1.000 filas sin avisar (la 808), y el japonés con sus
// escondidas pasa de ahí: a trozos, como `setsDelCatalogo`.
const TROZO = 1000
async function leerSets() {
  const filas = []
  for (let desde = 0; desde < 10 * TROZO; desde += TROZO) {
    const { data, error } = await supabase
      .from('tcg_sets')
      .select(sinGemelas ? COLUMNAS : `${COLUMNAS},${COLUMNA_GEMELAS}`)
      .eq('market', mercado)
      .order('release_date', { ascending: false, nullsFirst: false })
      .order('id')
      .range(desde, desde + TROZO - 1)
    if (error && !sinGemelas && /tcggo_gemelos/.test(error.message || '')) { sinGemelas = true; desde -= TROZO; continue }
    if (error) return { error }
    filas.push(...(data || []))
    if ((data || []).length < TROZO) break
  }
  return { data: filas }
}

// ── LO QUE SE VE AQUÍ ES LO QUE SE VE EN LA WEB (tanda 976) ──
//
// PINGU: «veo duplicado Silver Tempest Trainer Gallery… en la web no
// están». El panel pintaba la tabla en crudo, y la web (`pintarEstanteria`)
// hace tres cosas antes: quita lo que no es del TCG (Pocket), quita lo
// escondido y PLIEGA cada galería, Shiny Vault o set con el mismo
// `tcggo_id` dentro de su expansión (`plegarHermanos`). Aquí se hacen las
// mismas tres, con las mismas funciones y sobre las mismas filas: las
// plegadas salen DENTRO de su expansión (y se editan una a una), y las
// escondidas en su propio bloque al fondo.
function repartir() {
  const delTcg = sets.filter(esDelTCG)
  fueraDelTcg = sets.length - delTcg.length
  escondidas = delTcg.filter((s) => s.oculto)
  const visibles = delTcg.filter((s) => !s.oculto)
  principales = plegarHermanos(visibles.map((s) => ({ ...s })))
  const porId = new Map(principales.map((s) => [String(s.id).toLowerCase(), s]))
  hijosDe = new Map()
  for (const s of visibles) {
    const padre = padreDeColeccion(s.id)
    const suyo = padre ? porId.get(padre) : null
    if (!suyo) continue
    if (!hijosDe.has(suyo.id)) hijosDe.set(suyo.id, [])
    hijosDe.get(suyo.id).push(s)
  }
}

async function cargar() {
  faltaLaMigracion = false
  const { data, error } = await leerSets()
  if (error && /column|42703/i.test(error.message || '')) {
    faltaLaMigracion = true
    sets = []
    eras = new Map()
    repartir()
    return
  }
  if (error) showToast(`No se han podido leer las colecciones: ${String(error.message || error).slice(0, 100)}`, 'error')
  sets = data || []
  repartir()
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

// Las eras de este catálogo, en el orden en que se van a enseñar, con la
// MISMA cuenta que la web (`erasDeEstanteria`, 975): lo que se ve aquí es lo
// que sale. Con las eras sin colecciones también, que una recién creada se
// tiene que ver para meterle cosas.
function porEras() {
  return erasDeEstanteria(principales, eras, { vacias: true }).map((g) => ({ ...g, nombre: g.titulo }))
}

// Las opciones de un desplegable de era, por su nombre (975: antes había que
// escribir el identificador a mano).
function opcionesDeEra(actual) {
  const lista = porEras()
  // Y las eras que solo tienen escondidas (976), que no salen en la lista.
  for (const x of escondidas) if (x.serie_id && !lista.some((g) => g.id === x.serie_id)) lista.push({ id: x.serie_id, nombre: x.serie_name || x.serie_id })
  if (actual && !lista.some((g) => g.id === actual)) lista.push({ id: actual, nombre: actual })
  return `<option value=""${actual ? '' : ' selected'}>Sin era</option>` +
    lista.filter((g) => g.id).map((g) => `<option value="${escapeHtml(g.id)}"${g.id === actual ? ' selected' : ''}>${escapeHtml(g.nombre)}</option>`).join('')
}

// ── PLEGADAS (975) ──
//
// PINGU: «que esté plegado». 231 colecciones abiertas eran una lista que no
// se podía recorrer. Se pliegan todas de salida y se recuerda cuáles abres,
// por catálogo; buscar abre las que tienen algo que casa y esconde las demás.
let abiertas = new Set()
const claveAbiertas = () => `pd-col-abiertas-${mercado}`
function leerAbiertas() {
  try { abiertas = new Set(JSON.parse(localStorage.getItem(claveAbiertas()) || '[]')) } catch { abiertas = new Set() }
}
function guardarAbiertas() {
  try { localStorage.setItem(claveAbiertas(), JSON.stringify([...abiertas])) } catch { /* sin almacenamiento, se pliegan al volver */ }
}

// La clave del bloque de escondidas entre las abiertas: no es una era.
const ID_ESCONDIDAS = '__escondidas'

// Las marcadas para «Mover a…». Por id de set; se vacían al cambiar de catálogo.
let marcadas = new Set()

function casa(s) {
  if (!filtro) return true
  const t = filtro.toLowerCase()
  const suyo = (x) => [x.id, x.name, x.name_en, x.tcg_online_code].filter(Boolean).some((v) => String(v).toLowerCase().includes(t))
  // Buscar una galería encuentra la expansión en la que se ve.
  return suyo(s) || (hijosDe.get(s.id) || []).some(suyo)
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
  const marcada = marcadas.has(s.id)
  return `<li class="col-set${s.oculto ? ' col-set-oculto' : ''}${marcada ? ' col-set-marcada' : ''}" data-set="${escapeHtml(s.id)}" draggable="${s.oculto ? 'false' : 'true'}">
    <input type="checkbox" class="col-marcar" data-marcar="${escapeHtml(s.id)}" aria-label="Marcar ${escapeHtml(nombreDeSet(s) || s.id)}"${marcada ? ' checked' : ''}>
    ${s.oculto ? '' : `<button class="col-asa" data-asa="${escapeHtml(s.id)}" aria-label="Mover ${escapeHtml(nombreDeSet(s) || s.id)}. Arrastra, o usa las flechas arriba y abajo." title="Arrastra para colocar (o flechas ↑ ↓)">⠿</button>`}
    <span class="col-set-logo">${logo ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy">` : '<span class="col-set-sinlogo">sin logo</span>'}</span>
    <span class="col-set-nombre">
      <strong>${escapeHtml(nombreDeSet(s) || s.id)}</strong>
      <small>${escapeHtml(s.id)}${s.tcg_online_code ? ` · ${escapeHtml(s.tcg_online_code)}` : ''}${s.release_date ? ` · ${escapeHtml(s.release_date)}` : ''} · ${cartas} cartas ${chapaDe(s)}</small>
    </span>
    <span class="col-set-acciones">
      <button class="btn-outline btn-small" data-editar="${escapeHtml(s.id)}">Editar</button>
      ${s.oculto ? '' : `<button class="btn-outline btn-small" data-mover="${escapeHtml(s.id)}">Mover a…</button>`}
      <button class="btn-outline btn-small" data-ocultar="${escapeHtml(s.id)}">${s.oculto ? 'Mostrar' : 'Esconder'}</button>
      <button class="btn-outline btn-small col-borrar" data-borrar="${escapeHtml(s.id)}" aria-label="Borrar ${escapeHtml(nombreDeSet(s) || s.id)}">Borrar</button>
    </span>
    ${hijosHtml(s)}
  </li>`
}

// Lo que la web enseña DENTRO de esta expansión (976), cada uno con su
// botón para editarlo: la fila es la misma que en /cartas, y lo de dentro
// sigue siendo una colección con sus datos.
function hijosHtml(s) {
  const hijos = hijosDe.get(s.id) || []
  if (!hijos.length) return ''
  return `<div class="col-hijos"><span class="col-hijos-rotulo">Dentro, como en la web:</span>${hijos.map((h) =>
    `<button class="col-hijo" data-editar="${escapeHtml(h.id)}" title="Editar «${escapeHtml(nombreDeSet(h) || h.id)}» (${escapeHtml(h.id)})">${escapeHtml(nombreDeSet(h) || h.id)} <small>${h.card_count_official || h.card_count_total || 0}</small></button>`).join('')}</div>`
}

// Las escondidas, al fondo y aparte (976): la web no las enseña, así que
// mezclarlas con las demás era ver en el panel algo que no está.
function escondidasHtml() {
  if (!escondidas.length) return ''
  const visibles = escondidas.filter(casa)
  if (filtro && !visibles.length) return ''
  const abierta = filtro ? true : abiertas.has(ID_ESCONDIDAS)
  return `<section class="col-era col-era-escondidas${abierta ? ' col-era-abierta' : ''}" data-escondidas>
    <header class="col-era-cab">
      <button class="col-era-plegar" data-plegar="${ID_ESCONDIDAS}" aria-expanded="${abierta}">
        <span class="col-chevron" aria-hidden="true">▸</span>
        <h3>Escondidas</h3>
        <span class="col-era-cuenta">${escondidas.length}</span>
        <span class="col-era-nota">No salen en la web</span>
      </button>
    </header>
    <ul class="col-sets"${abierta ? '' : ' hidden'}>${visibles.map(filaDeSet).join('')}</ul>
  </section>`
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
    const dentro = [...hijosDe.values()].reduce((n, l) => n + l.length, 0)
    resumen.textContent =
      `${principales.length} colecciones en la web, en ${grupos.filter((g) => g.sets.length).length} eras` +
      (dentro ? ` · ${dentro} dentro de otra` : '') +
      (escondidas.length ? ` · ${escondidas.length} escondida${escondidas.length === 1 ? '' : 's'}` : '') +
      (fueraDelTcg ? ` · ${fueraDelTcg} de TCG Pocket (no salen)` : '') +
      ` · ${principales.filter((s) => !logoDe(s)).length} sin logo`
  }
  caja.innerHTML = grupos
    .map((g, i) => {
      const visibles = g.sets.filter(casa)
      if (filtro && !visibles.length) return ''
      const abierta = filtro ? true : abiertas.has(g.id)
      const logos = g.sets.map(logoDe).filter(Boolean).slice(0, 4)
      const aMano = g.sets.some((x) => x.orden !== null && x.orden !== undefined)
      return `<section class="col-era${abierta ? ' col-era-abierta' : ''}" data-era="${escapeHtml(g.id)}" draggable="true">
        <header class="col-era-cab">
          <button class="col-asa" data-asa-era="${escapeHtml(g.id)}" aria-label="Mover la era ${escapeHtml(g.nombre)}. Arrastra, o usa las flechas arriba y abajo." title="Arrastra para colocar (o flechas ↑ ↓)">⠿</button>
          <button class="col-era-plegar" data-plegar="${escapeHtml(g.id)}" aria-expanded="${abierta}">
            <span class="col-chevron" aria-hidden="true">▸</span>
            <h3>${escapeHtml(g.nombre)}</h3>
            <span class="col-era-cuenta">${g.sets.length}</span>
            <span class="col-era-logos" aria-hidden="true">${logos.map((l) => `<img src="${escapeHtml(l)}" alt="" loading="lazy">`).join('')}</span>
          </button>
          ${aMano ? `<button class="col-chapa-orden" data-por-fecha="${escapeHtml(g.id)}" title="Quita el orden puesto a mano dentro de esta era">a mano · por fecha</button>` : ''}
          <span class="col-era-mandos">
            <button class="col-icono" data-subir-era="${escapeHtml(g.id)}" aria-label="Subir la era ${escapeHtml(g.nombre)}"${i === 0 ? ' disabled' : ''}>↑</button>
            <button class="col-icono" data-bajar-era="${escapeHtml(g.id)}" aria-label="Bajar la era ${escapeHtml(g.nombre)}"${i === grupos.length - 1 ? ' disabled' : ''}>↓</button>
            <button class="btn-outline btn-small" data-era-editar="${escapeHtml(g.id)}">Renombrar</button>
          </span>
        </header>
        <ul class="col-sets"${abierta ? '' : ' hidden'}>${visibles.map(filaDeSet).join('') || '<li class="col-vacia">Sin colecciones. Arrastra aquí, o márcalas y «Mover a…».</li>'}</ul>
      </section>`
    })
    .join('') + escondidasHtml() || '<p class="empty-state">Ninguna colección coincide con el filtro.</p>'
  pintarSeleccion()
  escuchar()
}

// La barra de las marcadas, pegada abajo: lo que se hace con varias a la vez.
function pintarSeleccion() {
  const barra = $('coleccionesSeleccion')
  if (!barra) return
  for (const id of [...marcadas]) if (!sets.some((x) => x.id === id)) marcadas.delete(id)
  barra.hidden = !marcadas.size
  barra.innerHTML = marcadas.size
    ? `<b>${marcadas.size} ${marcadas.size === 1 ? 'marcada' : 'marcadas'}</b>
       <button class="btn-primary btn-small" id="colMoverA">Mover a…</button>
       <button class="btn-secondary btn-small" id="colQuitarMarcas">Quitar marcas</button>`
    : ''
  $('colMoverA')?.addEventListener('click', () => abrirMoverA([...marcadas]))
  $('colQuitarMarcas')?.addEventListener('click', () => { marcadas.clear(); pintarColecciones() })
}

// Guardar un puñado de columnas de un set. Devuelve si ha ido bien: una
// escritura que la política rechaza NO da error, así que se mira la fila
// que vuelve (la lección de los torneos, tanda 252).
// Lo que avisa a la web después de guardar vive en `avisar-web.js` (978),
// que también lo usa el editor de cartas.
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
// La era PLEGADA sobre cuya cabecera está un set (975): soltarlo ahí lo mete
// en esa era sin tener que abrirla.
let cabeceraDestino = null

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

function marcarCabecera(cab) {
  if (cabeceraDestino === cab) return
  cabeceraDestino?.classList.remove('col-era-destino')
  cabeceraDestino = cab
  cab?.classList.add('col-era-destino')
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
    if (esSet) {
      // Sobre la cabecera de OTRA era: soltarlo ahí la mueve a esa era.
      const cab = e.target.closest('.col-era-cab')
      if (cab && cab.closest('[data-era]') !== arrastrando.closest('[data-era]')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        marcarCabecera(cab)
        return
      }
      marcarCabecera(null)
    }
    // Un set se suelta en la lista de sets de CUALQUIER era abierta —que es
    // como se mueve de era arrastrando— y una era entre las eras.
    const destino = esSet ? e.target.closest('.col-sets') : lista
    // Las escondidas no son una era: ahí no se suelta nada.
    if (!destino || destino.closest('[data-escondidas]')) return
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
    const cab = cabeceraDestino
    marcarCabecera(null)
    if (cab && fila.dataset.set) {
      await moverA([fila.dataset.set], cab.closest('[data-era]').dataset.era)
      return
    }
    await guardarLoQueSeVe(fila)
  })
}

// El orden de TODAS las eras tal como quedan, en una sola escritura (975).
// Cada una con su nombre —una era sin fila en `tcg_eras` la estrena con el
// que se le ve— y sin grupo: colocar las eras las deja todas al mismo nivel.
async function guardarOrdenDeEras(ids) {
  const nombres = new Map(porEras().map((g) => [g.id, g.nombre]))
  const filas = ids.filter((id) => id !== '').map((id, i) => {
    const fila = { market: mercado, id, nombre: eras.get(id)?.nombre || nombres.get(id) || id, orden: (i + 1) * 10 }
    if (hayGrupo) fila.grupo = null
    return fila
  })
  const { error } = await supabase.from('tcg_eras').upsert(filas, { onConflict: 'market,id' })
  if (error) { showToast(error.message.slice(0, 120), 'error'); return false }
  for (const f of filas) eras.set(f.id, { nombre: f.nombre, orden: f.orden, grupo: null })
  avisarALaWeb()
  return true
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
    if (await guardarOrdenDeEras(ids)) showToast('Eras colocadas')
  }
  await cargar()
  pintarColecciones()
}

// Mover colecciones a una era (marcadas con «Mover a…», o una soltada sobre
// la cabecera de una era plegada). Llegan por fecha a la nueva: su número de
// la vieja no significa nada allí. La era va como corrección (908).
async function moverA(ids, era) {
  let n = 0
  const nombres = []
  for (const id of ids) {
    const s = sets.find((x) => x.id === id)
    if (!s || (s.serie_id || '') === (era || '')) continue
    nombres.push(id)
    if (await guardarSet(id, { serie_id: era || null }, { comoCorreccion: true })) {
      if (s.orden !== null && s.orden !== undefined) await guardarSet(id, { orden: null })
      n++
    }
  }
  const destino = porEras().find((g) => g.id === era)?.nombre || era || 'Sin era'
  for (const id of ids) marcadas.delete(id)
  abiertas.add(era); guardarAbiertas()
  await cargar()
  pintarColecciones()
  if (n) showToast(`${n === 1 ? '1 colección movida' : `${n} colecciones movidas`} a «${destino}»`, 'success')
  return n
}

// ── «MOVER A…» (975) ──
//
// Arrastrar en un móvil no se puede, y con 231 colecciones tampoco apetece en
// el ordenador: se marcan las que sean y se elige la era en una lista. Desde
// aquí mismo se puede crear la era nueva.
function abrirMoverA(ids) {
  if (!ids.length) return
  const lista = porEras().filter((g) => g.id)
  abrirHoja(`
    <h3>Mover ${ids.length === 1 ? '1 colección' : `${ids.length} colecciones`} a…</h3>
    <div class="col-destinos" role="radiogroup" aria-label="Era de destino">
      ${lista.map((g, i) => `<label class="col-destino"><input type="radio" name="colDestino" value="${escapeHtml(g.id)}"${i === 0 ? ' checked' : ''}><span>${escapeHtml(g.nombre)}</span><small>${g.sets.length}</small></label>`).join('')}
    </div>
    <div class="col-hoja-pie">
      <button class="btn-secondary" id="colMoverNueva">+ En una era nueva</button>
      <span style="flex:1"></span>
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-primary" id="colMoverAqui">Mover aquí</button>
    </div>`)
  $('colMoverAqui').addEventListener('click', async () => {
    const era = document.querySelector('input[name="colDestino"]:checked')?.value
    if (!era) return
    cerrarHoja()
    await moverA(ids, era)
  })
  $('colMoverNueva').addEventListener('click', () => abrirNuevaEra(ids))
}

// ── «NUEVA ERA» (975) ──
//
// Antes una era se «creaba» escribiendo el mismo identificador en cada una de
// sus colecciones. Ahora: un nombre, dónde va y, si hay marcadas, meterlas.
// El identificador sale del nombre (`idDeEraNueva`) y no lo ve nadie.
function abrirNuevaEra(ids = []) {
  const lista = porEras().filter((g) => g.id)
  abrirHoja(`
    <h3>Nueva era</h3>
    <label>Cómo se llama<input id="colNuevaEraNombre" type="text" maxlength="80" placeholder="McDonald's"></label>
    <label>Dónde va
      <select id="colNuevaEraDonde">
        <option value="__arriba">Arriba del todo</option>
        ${lista.map((g) => `<option value="${escapeHtml(g.id)}">Después de «${escapeHtml(g.nombre)}»</option>`).join('')}
        <option value="__abajo" selected>Abajo del todo</option>
      </select></label>
    ${ids.length ? `<label class="col-check"><input type="checkbox" id="colNuevaEraMeter" checked> Meter las ${ids.length} marcadas</label>` : ''}
    <div class="col-hoja-pie">
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-primary" id="colNuevaEraCrear">Crear era</button>
    </div>`)
  $('colNuevaEraNombre').focus()
  $('colNuevaEraCrear').addEventListener('click', async () => {
    const nombre = $('colNuevaEraNombre').value.trim()
    if (!nombre) return showToast('La era necesita un nombre.', 'error')
    const id = idDeEraNueva(nombre, [...new Set([...eras.keys(), ...sets.map((x) => x.serie_id).filter(Boolean)])])
    const orden = conEraEn(lista.map((g) => g.id), id, $('colNuevaEraDonde').value)
    // Se lee ANTES de cerrar la hoja, que se lleva la casilla con ella.
    const meter = ids.length > 0 && !!$('colNuevaEraMeter')?.checked
    eras.set(id, { nombre, orden: 0, grupo: null })
    if (!(await guardarOrdenDeEras(orden))) return
    cerrarHoja()
    abiertas.add(id); guardarAbiertas()
    if (meter) await moverA(ids, id)
    else { await cargar(); pintarColecciones() }
    showToast(`Era «${nombre}» creada`, 'success')
  })
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
  // ↑ ↓ de cada era: lo mismo sin arrastrar, que en el móvil es la forma.
  document.querySelectorAll('[data-subir-era], [data-bajar-era]').forEach((b) =>
    b.addEventListener('click', async () => {
      const id = b.dataset.subirEra ?? b.dataset.bajarEra
      const ids = porEras().map((g) => g.id)
      const movida = moverEnLista(ids, id, b.dataset.subirEra !== undefined ? -1 : 1)
      if (movida.join() === ids.join()) return
      if (await guardarOrdenDeEras(movida)) { await cargar(); pintarColecciones(); document.querySelector(`[${b.dataset.subirEra !== undefined ? 'data-subir-era' : 'data-bajar-era'}="${CSS.escape(id)}"]`)?.focus() }
    })
  )
  document.querySelectorAll('[data-plegar]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.plegar
      if (filtro) return
      if (abiertas.has(id)) abiertas.delete(id)
      else abiertas.add(id)
      guardarAbiertas()
      const seccion = b.closest('.col-era')
      const abierta = abiertas.has(id)
      seccion.classList.toggle('col-era-abierta', abierta)
      seccion.querySelector('.col-sets').hidden = !abierta
      b.setAttribute('aria-expanded', String(abierta))
    })
  )
  document.querySelectorAll('[data-marcar]').forEach((c) =>
    c.addEventListener('change', () => {
      if (c.checked) marcadas.add(c.dataset.marcar)
      else marcadas.delete(c.dataset.marcar)
      c.closest('.col-set')?.classList.toggle('col-set-marcada', c.checked)
      pintarSeleccion()
    })
  )
  document.querySelectorAll('[data-por-fecha]').forEach((b) =>
    b.addEventListener('click', async () => {
      const g = porEras().find((x) => x.id === b.dataset.porFecha)
      if (!g) return
      for (const x of g.sets) if (x.orden !== null && x.orden !== undefined) await guardarSet(x.id, { orden: null })
      await cargar(); pintarColecciones(); showToast(`«${g.nombre}» vuelve a ir por fecha`)
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
  document.querySelectorAll('[data-mover]').forEach((b) =>
    b.addEventListener('click', () => abrirMoverA([b.dataset.mover]))
  )
  document.querySelectorAll('[data-borrar]').forEach((b) =>
    b.addEventListener('click', () => abrirBorrar(b.dataset.borrar))
  )
  document.querySelectorAll('[data-era-editar]').forEach((b) =>
    b.addEventListener('click', () => abrirEditorDeEra(b.dataset.eraEditar))
  )
}

// ── Las eras ──
//
// La era de un set es su `serie_id`, y lo que se guarda en `tcg_eras` es
// cómo se llama y dónde va. Lo contrario —una tabla de la que cuelguen—
// obligaría a migrar los ~40 identificadores que ya vienen de los catálogos.
async function guardarEra(id, campos) {
  const antes = eras.get(id) || { nombre: porEras().find((g) => g.id === id)?.nombre || id, orden: 0, grupo: null }
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

// Renombrar, sin números ni grupos (975): el sitio se le da arrastrando o con
// ↑ ↓, y el grupo de la 904 ya no existe.
function abrirEditorDeEra(id) {
  const g = porEras().find((x) => x.id === id)
  if (!g) return
  abrirHoja(`
    <h3>La era «${escapeHtml(g.nombre)}»</h3>
    <p class="admin-note">${g.sets.length === 1 ? '1 colección' : `${g.sets.length} colecciones`}.</p>
    <label>Cómo se llama<input id="colEraNombre" type="text" maxlength="80" value="${escapeHtml(g.nombre)}"></label>
    <div class="col-hoja-pie">
      ${id ? '<button class="btn-danger btn-small" id="colEraBorrar">Borrar la era…</button>' : ''}
      <span style="flex:1"></span>
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-primary" id="colEraGuardar">Guardar</button>
    </div>`)
  $('colEraBorrar')?.addEventListener('click', () => abrirBorrarEra(id))
  $('colEraGuardar').addEventListener('click', async () => {
    const nombre = $('colEraNombre').value.trim()
    if (!nombre) return showToast('La era necesita un nombre.', 'error')
    if (await guardarEra(id, { nombre })) {
      cerrarHoja(); pintarColecciones(); showToast('Era guardada')
    }
  })
}

// ── BORRAR UNA ERA (976) ──
//
// Una era es su `serie_id` en las colecciones más su fila de `tcg_eras`
// (nombre y sitio). Borrarla sin más dejaría sus colecciones con un
// `serie_id` que ya no se llama de ninguna manera y la era volvería a salir
// con el nombre del catálogo. Así que primero se llevan TODAS las suyas
// —también las escondidas y las que se ven dentro de otra— a la era que se
// elija (como corrección, 908), y después se borra la fila.
function abrirBorrarEra(id) {
  const g = porEras().find((x) => x.id === id)
  if (!g) return
  const suyas = sets.filter((s) => (s.serie_id || '') === id)
  const destinos = porEras().filter((x) => x.id && x.id !== id)
  abrirHoja(`
    <h3>Borrar la era «${escapeHtml(g.nombre)}»</h3>
    ${suyas.length
      ? `<p class="admin-note">Tiene ${suyas.length === 1 ? '1 colección' : `${suyas.length} colecciones`} (contando las escondidas y las que van dentro de otra). Se mueven antes a:</p>
         <div class="col-destinos" role="radiogroup" aria-label="Era a la que van sus colecciones">
           ${destinos.map((x, i) => `<label class="col-destino"><input type="radio" name="colEraDestino" value="${escapeHtml(x.id)}"${i === 0 ? ' checked' : ''}><span>${escapeHtml(x.nombre)}</span><small>${x.sets.length}</small></label>`).join('')}
         </div>`
      : '<p class="admin-note">No tiene ninguna colección.</p>'}
    <div class="col-hoja-pie">
      <span style="flex:1"></span>
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-danger" id="colEraBorrarYa">Borrar la era</button>
    </div>`)
  $('colEraBorrarYa').addEventListener('click', async () => {
    const destino = document.querySelector('input[name="colEraDestino"]:checked')?.value || null
    if (suyas.length && !destino) return showToast('Elige a qué era van sus colecciones.', 'error')
    $('colEraBorrarYa').disabled = true
    for (const s of suyas) {
      if (!(await guardarSet(s.id, { serie_id: destino }, { comoCorreccion: true }))) {
        $('colEraBorrarYa').disabled = false
        return showToast(`Se ha parado en «${nombreDeSet(s) || s.id}»: la era no se ha borrado.`, 'error')
      }
      if (s.orden !== null && s.orden !== undefined) await guardarSet(s.id, { orden: null })
    }
    if (eras.has(id)) {
      const { data, error } = await supabase.from('tcg_eras').delete().eq('market', mercado).eq('id', id).select('id')
      if (error || !data?.length) {
        $('colEraBorrarYa').disabled = false
        return showToast(error ? error.message.slice(0, 120) : 'Sus colecciones se han movido, pero la era no se ha podido borrar: ¿sigues teniendo permiso de admin?', 'error')
      }
      eras.delete(id)
    }
    abiertas.delete(id)
    if (destino) abiertas.add(destino)
    guardarAbiertas()
    avisarALaWeb()
    cerrarHoja(); await cargar(); pintarColecciones()
    showToast(`Era «${g.nombre}» borrada${suyas.length ? `; sus colecciones, en «${destinos.find((x) => x.id === destino)?.nombre || destino}»` : ''}`, 'success')
  })
}

function abrirEditor(id) {
  const s = sets.find((x) => x.id === id)
  if (!s) return
  const corr = correcciones.get(s.id) || new Map()
  const quitar = (col, rotulo = 'corregida · quitar') => corr.has(col) ? ` <button type="button" class="cat-quitar" data-quitar-set="${col}" title="Quitar la corrección y volver a lo que traía el catálogo">${rotulo}</button>` : ''
  const clase = (col) => corr.has(col) ? ' class="cat-campo-corregida"' : ''
  const logoActual = s.logo_scrydex || s.logo_tcggo || ''
  abrirHoja(`
    <h3>${escapeHtml(nombreDeSet(s) || s.id)}</h3>
    <p class="admin-note"><code>${escapeHtml(s.id)}</code> · ${escapeHtml(mercado)}${s.tcggo_id ? ` · TCGGO ${escapeHtml(String(s.tcggo_id))}` : ''}${s.origen === 'mano' ? ' · escrita a mano' : ''}${corr.size ? ` · ${corr.size} ${corr.size === 1 ? 'corrección' : 'correcciones'}` : ''}</p>
    ${notaDePadre(s)}
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
      ${sinGemelas ? '' : `<label class="cat-campo-medio${corr.has('tcggo_gemelos') ? ' cat-campo-corregida' : ''}">Edición gemela <small>(ids de TCGGO en el otro catálogo, separados por comas; la pone la pasada)</small>${quitar('tcggo_gemelos')}<input id="colGemelas" type="text" inputmode="numeric" value="${escapeHtml((Array.isArray(s.tcggo_gemelos) ? s.tcggo_gemelos : []).join(', '))}"></label>`}
    </div>
    <label>Era <small>(para una nueva, «+ Nueva era» arriba; dentro de la era se coloca arrastrando)</small>
      <select id="colEra">${opcionesDeEra(s.serie_id || '')}</select></label>
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
    const era = $('colEra').value
    const numero = (id) => { const t = $(id).value.trim(); return t === '' ? null : Number(t) }
    const campos = {
      name: $('colNombre').value.trim() || s.name,
      name_en: $('colNombreEn').value.trim() || null,
      serie_id: era || null,
      // Cambiar de era la deja por fecha en la nueva; si no, su sitio se queda.
      orden: (era || null) === (s.serie_id || null) ? s.orden ?? null : null,
      release_date: $('colFecha').value.trim() || null,
      tcg_online_code: $('colCodigo').value.trim() || null,
      card_count_official: numero('colCuentaOficial'),
      card_count_total: numero('colCuentaTotal'),
      scrydex_manda: $('colScrydexManda').checked,
      oculto: $('colOculto').checked,
    }
    // Las gemelas (1027): una lista de ids, o null si se vacía.
    if ($('colGemelas')) {
      const ids = [...new Set($('colGemelas').value.split(/[,\s]+/).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b)
      campos.tcggo_gemelos = ids.length ? ids : null
    }
    // El logo puesto a mano va en LAS DOS columnas (885): la biblioteca
    // mira `logo_tcggo` primero en el japonés y `logo_scrydex` en el
    // occidental, y las dos las reescriben sus pasadas.
    const logo = $('colLogo').value.trim() || null
    if (logo !== (logoActual || null)) { campos.logo_scrydex = logo; campos.logo_tcggo = logo }
    if (await guardarSet(s.id, campos, { comoCorreccion: true })) {
      await cargar(); cerrarHoja(); pintarColecciones(); showToast('Colección guardada', 'success')
    }
  })

  $('colBorrar').addEventListener('click', () => abrirBorrar(s.id))
}

// Si esta colección se ve DENTRO de otra en la web (976), se dice: su era y
// su sitio no cuentan, sale donde salga su expansión.
function notaDePadre(s) {
  const padre = principales.find((p) => (hijosDe.get(p.id) || []).some((h) => h.id === s.id))
  if (!padre) return ''
  return `<p class="col-nota-padre">En la web se ve <b>dentro de «${escapeHtml(nombreDeSet(padre) || padre.id)}»</b> (${s.tcggo_id && s.tcggo_id === padre.tcggo_id ? 'TCGGO las da como una sola expansión' : 'es su galería'}): su era y su sitio son los de esa expansión.</p>`
}

// ── BORRAR UNA COLECCIÓN (976) ──
//
// PINGU: «ni las expansiones ni las eras se pueden eliminar». Estaba, pero
// dentro del editor y con un `prompt`. Ahora sale en cada fila, con lo que
// se lleva por delante a la vista ANTES (la 543) y con la salida que se
// deshace al lado: esconder. Y se avisa de lo que no se ve: lo que trae un
// catálogo automático lo puede volver a crear su pasada; esconder, como es
// una corrección (885), no lo pisa nadie.
async function abrirBorrar(id) {
  const s = sets.find((x) => x.id === id)
  if (!s) return
  const nombre = nombreDeSet(s) || s.id
  const { count: cartas } = await supabase
    .from('tcg_cards').select('id', { count: 'exact', head: true })
    .eq('set_id', s.id).eq('market', mercado)
  const hijos = hijosDe.get(s.id) || []
  const automatica = s.origen !== 'mano'
  abrirHoja(`
    <h3>Borrar «${escapeHtml(nombre)}»</h3>
    <p class="admin-note"><code>${escapeHtml(s.id)}</code> · ${cartas ?? '?'} cartas</p>
    <ul class="col-impacto">
      <li>Se borran sus <b>${cartas ?? '?'} cartas</b>, y las copias que alguien tenga de ellas se quedan sin carta.</li>
      ${hijos.length ? `<li>Lo que lleva dentro (${hijos.map((h) => `«${escapeHtml(nombreDeSet(h) || h.id)}»`).join(', ')}) <b>no</b> se borra: saldrá suelto.</li>` : ''}
      ${automatica ? '<li>Viene de un catálogo automático: su pasada <b>puede volver a crearla</b>. Si lo que quieres es no verla, escóndela.</li>' : ''}
    </ul>
    ${s.oculto ? '' : '<p><button class="btn-primary" id="colBorrarEsconder">Mejor esconderla (se deshace)</button></p>'}
    <label>Para borrarla del todo, escribe <code>${escapeHtml(s.id)}</code><input id="colBorrarConfirma" type="text" autocomplete="off" spellcheck="false"></label>
    <div class="col-hoja-pie">
      <span style="flex:1"></span>
      <button class="btn-secondary" data-cerrar-hoja>Cancelar</button>
      <button class="btn-danger" id="colBorrarYa" disabled>Borrar del todo</button>
    </div>`)
  $('colBorrarConfirma').addEventListener('input', (e) => { $('colBorrarYa').disabled = e.target.value.trim() !== s.id })
  $('colBorrarEsconder')?.addEventListener('click', async () => {
    if (await guardarSet(s.id, { oculto: true }, { comoCorreccion: true })) {
      cerrarHoja(); await cargar(); pintarColecciones(); showToast(`«${nombre}» escondida`, 'success')
    }
  })
  $('colBorrarYa').addEventListener('click', async () => {
    if ($('colBorrarConfirma').value.trim() !== s.id) return
    // La fila que vuelve dice si se ha borrado: una política que no deja
    // borrar NO da error, devuelve cero filas (la 252).
    const { data, error } = await supabase.from('tcg_sets').delete().eq('id', s.id).eq('market', mercado).select('id')
    if (error) return showToast(error.message.slice(0, 120), 'error')
    if (!data?.length) return showToast('No se ha borrado: ¿sigues teniendo permiso de admin?', 'error')
    marcadas.delete(s.id)
    avisarALaWeb()
    cerrarHoja(); await cargar(); pintarColecciones(); showToast(`«${nombre}» borrada`, 'success')
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
      <label class="cat-campo-medio">Era<select id="colNuevoEra">${opcionesDeEra('')}</select></label>
    </div>
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
    // Las tres primeras y la última, para ver que se ha leído bien (962).
    const muestra = cartas.length > 4 ? [...cartas.slice(0, 3), null, cartas[cartas.length - 1]] : cartas
    const vistas = muestra.map((c) => (c ? `${c.local_id} ${c.name}` : '…')).join(', ')
    $('colNuevoListaResumen').textContent = !cartas.length && !errores.length ? '' : `${cartas.length} ${cartas.length === 1 ? 'carta' : 'cartas'}${vistas ? `: ${vistas}` : ''}${errores.length ? ` · ${errores.join(' · ')}` : ''}`
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
    if ($('colNuevoEra').value) cambios.serie_id = $('colNuevoEra').value
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
      marcadas.clear(); leerAbiertas()
      await cargar()
      pintarColecciones()
    })
  }
  $('coleccionesFiltro')?.addEventListener('input', (e) => { filtro = e.target.value.trim(); pintarColecciones() })
  $('coleccionesRecargar')?.addEventListener('click', async () => { await cargar(); pintarColecciones(); showToast('Recargado') })
  $('coleccionesReordenar')?.addEventListener('click', volverAlOrdenDelCatalogo)
  $('coleccionesNueva')?.addEventListener('click', abrirNuevaColeccion)
  $('coleccionesNuevaEra')?.addEventListener('click', () => abrirNuevaEra([...marcadas]))
  $('coleccionesDesplegar')?.addEventListener('click', () => { abiertas = new Set([...porEras().map((g) => g.id), ID_ESCONDIDAS]); guardarAbiertas(); pintarColecciones() })
  $('coleccionesPlegar')?.addEventListener('click', () => { abiertas.clear(); guardarAbiertas(); pintarColecciones() })
  leerAbiertas()
  await cargar()
  pintarColecciones()
  // Las repetidas (987), por su módulo: se miran poco.
  import('./repetidas.js').then((m) => m.iniciarRepetidas()).catch(() => {})
}
