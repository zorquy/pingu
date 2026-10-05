// Una colección entera: la cabecera del set y todas sus cartas (tanda
// 324).
//
// Igual que la ficha, el centro de la página normalmente ya viene
// pintado desde el borde y esto NO lo repinta. Lo que sí hace siempre es
// lo que el borde no puede: traer el resto de la colección, porque un
// set puede tener 400 cartas y meterlas todas en el documento haría una
// respuesta de medio mega en cada visita.
import { supabase } from './supabase.js'
import { escapeHtml, getSession } from './app.js'
import {
  cabeceraDeColeccion,
  filtroDeColeccion,
  idDeRutaDeColeccion,
  rejillaDeCartas,
  rutaDeColeccion,
  TIPOS_ES,
} from './carta-nucleo.js'
import { normalizeSearch } from './tcgdex.js'
import { esDelTCG, padreDeColeccion, prefijoDeColeccion, idsDeColeccion, registrarEpisodios, nombreDeSet, variacionSemanal } from './catalogo-series.js'
import { opcionesDeFiltros, cumpleFiltros, ordenarCartas, ORDENES } from './coleccion-filtros.js'
import { preciosGuardados } from './mi-coleccion/datos.js'
import { precioDeFila, valorDe, euros, IDIOMA_POR_DEFECTO } from './cardmarket.js'

const MERCADO = 'WEST'

// ── Todas de golpe (tanda 344) ──
//
// Antes salían 60 y un botón de «ver más». PINGU lo quitó: una colección
// es una lista que se hojea, y partirla obliga a pulsar para ver lo que
// ya sabías que estaba. Un set son ~200 cartas y las imágenes van con
// `loading="lazy"`, así que lo que baja de verdad es lo que se mira.
//
// Se pide por páginas igualmente, pero sin parar: PostgREST corta en
// 1.000 filas por respuesta y un set no llega, pero el bucle no da nada
// por supuesto.
const POR_PAGINA = 500

const $ = (id) => document.getElementById(id)

let setId = null
// El código de TCG Live del set, que es lo que necesita el segundo sitio
// donde buscar un escaneo (tanda 370). Aquí arriba porque lo resuelve
// `cargar` y lo usa `pintar`, que son dos funciones distintas.
let codigoDeSet = null
let desde = 0

// Todas las cartas que han llegado, en crudo. Hacen falta enteras porque
// el filtro es de aquí: ya están bajadas, así que preguntar otra vez a
// la base por «las de tipo Fuego» sería pedir lo que ya tenemos.
let todas = []
// Lo de la 647: el precio de cada carta (el mínimo en español, o lo que
// diga la regla de la casa), las que TIENES si hay sesión, y lo que vale
// la expansión. Todo llega después de las cartas y repinta.
const precioPorCarta = new Map()
let tengo = new Set()
let haySesion = false
const fmtEnteroEuros = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })

async function cargar() {
  const clave = idDeRutaDeColeccion(location.pathname) || new URLSearchParams(location.search).get('set')
  if (!clave) return fallo()

  // Dos columnas, porque la dirección puede ser el código nuevo (`pbl`) o
  // el identificador de siempre (`me05`): los enlaces viejos, los de
  // fuera y los que ya indexó Google tienen que seguir llegando.
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('id,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,logo_tcggo,symbol_scrydex,release_date,card_count_official,card_count_total,tcg_online_code,tcggo_id')
    .eq('market', MERCADO)
    .or(filtroDeColeccion(clave))
    .limit(1)
  let set = data?.[0] || null
  // Una colección que no es del TCG de mesa no tiene página aquí.
  if (error || !set || !esDelTCG(set)) return fallo()

  // Los sets que son la MISMA expansión de TCGGO (646): se registran para
  // que `padreDeColeccion` e `idsDeColeccion` contesten por TCGGO. Si la
  // consulta falla, queda la lista a mano, que es lo que había.
  if (set.tcggo_id) {
    const { data: hermanos } = await supabase
      .from('tcg_sets')
      .select('id,card_count_official,card_count_total,tcggo_id')
      .eq('market', MERCADO)
      .eq('tcggo_id', set.tcggo_id)
      .limit(20)
    registrarEpisodios(hermanos || [])
  }

  // Y si este set es parte de otro —la Classics Collection lo es del 30
  // aniversario—, la página es la del padre: es un set solo, y tener dos
  // direcciones para él las deja a las dos a medias.
  const padre = padreDeColeccion(set.id)
  if (padre) {
    const { data: suyo } = await supabase
      .from('tcg_sets')
      .select('id,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,logo_tcggo,symbol_scrydex,release_date,card_count_official,card_count_total,tcg_online_code,tcggo_id')
      .eq('market', MERCADO)
      .eq('id', padre)
      .limit(1)
    if (suyo?.[0]) set = suyo[0]
  }
  setId = set.id
  codigoDeSet = set.tcg_online_code || null

  // Y si se llegó por la vieja, la barra pasa a decir la buena sin
  // recargar: una sola dirección para una sola página.
  const buena = rutaDeColeccion(set)
  if (location.pathname !== buena) history.replaceState(null, '', buena + location.search)

  document.title = `${nombreDeSet(set)} — Cartas de Pokémon TCG — PokeDoc`
  const miga = $('migaColeccion')
  if (miga) miga.textContent = nombreDeSet(set)

  const caja = $('coleccionCabecera')
  if (caja && caja.dataset.servidor !== '1') caja.innerHTML = cabeceraDeColeccion(set)

  // Se piden TODAS desde la primera aunque el borde ya haya pintado 60
  // (tanda 346). Antes se seguía por donde él las dejó, pero con el
  // filtro hay que poder repintar la rejilla entera — y no se puede
  // filtrar lo que no se tiene. Son 60 filas repetidas en una petición:
  // más barato que un estado partido en dos sitios.
  desde = 0
  todas = []
  await todasLasCartas()
  montarFiltros()
  // Y lo demás, sin bloquear la rejilla: los precios, lo que tienes y lo
  // que vale la expansión. Cada uno repinta al llegar y se calla si falla.
  void cargarPrecios()
  void cargarLoQueTienes()
  void pintarCifras(set)

  // La cuenta declarada del set plegado es solo la de su mitad: con las
  // cartas ya contadas se repinta con el número de verdad. Un «160
  // cartas» encima de 190 es peor que no decir ninguna.
  // (Y lo mismo para una expansión de TCGGO con varios sets nuestros, 646.)
  if ((prefijoDeColeccion(setId) || idsDeColeccion(setId).length > 1) && caja) {
    caja.innerHTML = cabeceraDeColeccion(
      { ...set, card_count_official: null, card_count_total: null },
      todas.length
    )
  }
}

// El orden es por `local_id`, que es el número impreso en la carta — y
// es TEXTO, no número: hay cartas que se llaman «TG12», «SV107» o
// «H31». Ordenar como número las dejaría todas juntas al principio.
async function masCartas(cuantas) {
  // Normalmente un set es UN `set_id`. El 30 aniversario son todos los
  // que empiezan por «30th», porque TCGdex lo parte en dos y es uno.
  // Hay DOS formas de llevarse las cartas de otro set, y son distintas a
  // propósito: por PREFIJO cuando no se sabe cómo va a llamarse la
  // siguiente entrega (el 30 aniversario), y por LISTA cuando son parejas
  // sueltas que no comparten ni el principio del identificador — la
  // Radiant Collection dentro de Legendary Treasures, la Unown dentro de
  // Unseen Forces (tanda 533).
  const prefijo = prefijoDeColeccion(setId)
  const ids = prefijo ? [] : idsDeColeccion(setId)
  let consulta = supabase
    .from('tcg_cards')
    .select('id,set_id,name,name_es,name_en,local_id,image_path,image_scrydex,image_tcggo,types,category,rarity,rarity_en,illustrator,variants')
    .eq('market', MERCADO)
  if (prefijo) consulta = consulta.like('set_id', `${prefijo}%`)
  else if (ids.length) consulta = consulta.in('set_id', ids)
  else consulta = consulta.eq('set_id', setId)
  // Y si son dos mitades, PRIMERO la del set y después la otra: los dos
  // empiezan la numeración en el 001, así que ordenar solo por el número
  // impreso las mezcla —001, 001, 002, 002…— y parecen la misma lista
  // mal ordenada. El identificador del padre es prefijo del hijo, así
  // que ordenar por `set_id` deja al padre delante solo.
  if (prefijo || ids.length) consulta = consulta.order('set_id')
  const { data, error } = await consulta
    .order('local_id')
    .range(desde, desde + cuantas - 1)
  if (error) return 0
  const lista = data || []
  todas = todas.concat(lista)
  desde += lista.length
  if (lista.length) pintar()
  return lista.length
}

// Hasta que no quede ninguna. El tope es por si algún día un set trae
// miles: un bucle sin salida contra una consulta que siempre devuelve
// algo dejaría la pestaña colgada.
const PAGINAS_MAXIMO = 10

async function todasLasCartas() {
  for (let i = 0; i < PAGINAS_MAXIMO; i++) {
    const traidas = await masCartas(POR_PAGINA)
    if (traidas < POR_PAGINA) return
  }
}


// ── Lo que llega después de las cartas (647) ──

// El precio de cada carta: la fila de TCGGO y la regla de la casa (el
// mínimo en español, si no el general, si no TCGplayer). Si la consulta
// falla o no hay migración, se queda sin precios y la página sigue.
async function cargarPrecios() {
  try {
    const filas = await preciosGuardados(todas.map((c) => c.id))
    for (const [id, fila] of filas) {
      const v = valorDe(precioDeFila(fila), IDIOMA_POR_DEFECTO)
      if (v) precioPorCarta.set(id, v)
    }
  } catch {
    return
  }
  if (precioPorCarta.size) {
    montarFiltros()
    pintar()
  }
}

// Las que tienes de esta expansión, si hay sesión: para marcarlas y para
// «las que me faltan». La RLS solo deja ver lo tuyo, que es lo que se pide.
async function cargarLoQueTienes() {
  let sesion = null
  try {
    sesion = await getSession()
  } catch {
    return
  }
  if (!sesion?.user?.id) return
  haySesion = true
  const ids = todas.map((c) => c.id)
  const mias = new Set()
  try {
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await supabase.from('user_collection').select('card_id').eq('user_id', sesion.user.id).in('card_id', ids.slice(i, i + 150))
      for (const f of data || []) mias.add(f.card_id)
    }
  } catch {
    return
  }
  tengo = mias
  $('filtroFaltan')?.classList.remove('hidden')
  pintarTienes()
  pintar()
}

// Lo que vale la expansión y cómo va (de `tcg_set_valor`, 646), y lo
// que tienes: tres cifras bajo la cabecera. Sin dato, la cifra no se pinta.
async function pintarCifras(set) {
  const cabecera = $('coleccionCabecera')?.querySelector('.coleccion-cabecera')
  if (!cabecera) return
  let v = null
  try {
    const desde = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)
    const { data } = await supabase.from('tcg_set_valor').select('set_id,dia,valor_cm').eq('market', MERCADO).eq('set_id', set.id).gte('dia', desde).order('dia').limit(40)
    v = variacionSemanal(data || []).get(set.id) || null
  } catch {
    v = null
  }
  let caja = cabecera.querySelector('.coleccion-cifras')
  if (!caja) {
    caja = document.createElement('div')
    caja.className = 'coleccion-cifras'
    cabecera.appendChild(caja)
  }
  const cifras = []
  if (v?.ahora) cifras.push(`<span><small>Valor del set</small><b>${escapeHtml(fmtEnteroEuros.format(v.ahora))} €</b></span>`)
  if (v?.pct !== null && v?.pct !== undefined) cifras.push(`<span><small>Semanal</small><b class="${v.pct > 0 ? 'sube' : v.pct < 0 ? 'baja' : ''}">${v.pct > 0 ? '+' : ''}${v.pct} %</b></span>`)
  caja.dataset.valor = cifras.join('')
  caja.innerHTML = cifras.join('') + (caja.dataset.tienes || '')
  caja.classList.toggle('hidden', !caja.innerHTML)
}

function pintarTienes() {
  const caja = $('coleccionCabecera')?.querySelector('.coleccion-cifras')
  if (!caja || !haySesion) return
  const n = todas.filter((c) => tengo.has(c.id)).length
  caja.dataset.tienes = `<span><small>Tienes</small><b>${n} / ${todas.length}</b></span>`
  caja.innerHTML = (caja.dataset.valor || '') + caja.dataset.tienes
  caja.classList.remove('hidden')
}

// ── Los filtros (346, rehechos en la 647) ──
//
// «Como guardamos todos los datos, podemos usar todos los filtros
// necesarios» (PINGU). Cada desplegable ofrece solo lo que de verdad hay
// en esta colección —una opción que no filtrara nada sería una promesa
// falsa— y con una sola opción se esconde. Filtrar es repintar: las
// cartas ya están todas bajadas.
function montarFiltros() {
  const caja = $('coleccionFiltros')
  if (!caja) return
  const op = opcionesDeFiltros(todas, precioPorCarta)
  const llenar = (id, todasTexto, opciones, texto = (x) => x, valor = (x) => x) => {
    const sel = $(id)
    if (!sel) return
    const antes = sel.value
    sel.innerHTML = `<option value="">${escapeHtml(todasTexto)}</option>` + opciones.map((o) => `<option value="${escapeHtml(valor(o))}">${escapeHtml(texto(o))}</option>`).join('')
    if ([...sel.options].some((o) => o.value === antes)) sel.value = antes
    sel.closest('.coleccion-filtro-campo')?.classList.toggle('hidden', opciones.length < (id === 'filtroPrecio' || id === 'filtroOrden' ? 1 : 2))
  }
  llenar('filtroRareza', 'Todas las rarezas', op.rarezas)
  llenar('filtroTipo', 'Todos los tipos', op.tipos.filter((t) => TIPOS_ES[t]), (t) => TIPOS_ES[t])
  llenar('filtroImpresion', 'Todas las impresiones', op.impresiones, (i) => i.nombre, (i) => i.id)
  llenar('filtroIlustrador', 'Todos los ilustradores', op.ilustradores)
  llenar('filtroPrecio', 'Cualquier precio', op.precios, (p) => p.nombre, (p) => p.id)
  llenar('filtroOrden', 'Ordenar: número', ORDENES.filter((o) => o.id !== 'numero' && (o.id !== 'precio' || precioPorCarta.size)), (o) => `Ordenar: ${o.nombre.toLowerCase()}`, (o) => o.id)
  caja.classList.remove('hidden')
}

function filtrosElegidos() {
  return {
    texto: normalizeSearch($('filtroNombre')?.value || '').trim(),
    rareza: $('filtroRareza')?.value || '',
    tipo: $('filtroTipo')?.value || '',
    impresion: $('filtroImpresion')?.value || '',
    ilustrador: $('filtroIlustrador')?.value || '',
    precio: $('filtroPrecio')?.value || '',
    soloFaltan: $('filtroFaltan')?.getAttribute('aria-pressed') === 'true',
  }
}

function pintar() {
  const rejilla = $('coleccionRejilla')
  if (!rejilla) return
  const f = filtrosElegidos()
  const ctx = { precios: precioPorCarta, tengo }
  const vistas = ordenarCartas(todas.filter((c) => cumpleFiltros(c, f, ctx)), $('filtroOrden')?.value || 'numero', ctx)
  // El código de TCG Live del set, para el segundo sitio donde buscar un
  // escaneo (tanda 370). Va una vez y no por carta: en esta página todas
  // son del mismo set.
  rejilla.innerHTML = rejillaDeCartas(vistas, codigoDeSet, (c) => ({ precio: precioPorCarta.has(c.id) ? euros(precioPorCarta.get(c.id)) : '', tengo: tengo.has(c.id) }))
  const vacio = $('coleccionVacia')
  if (vacio) vacio.classList.toggle('hidden', vistas.length > 0 || !todas.length)
  const hayFiltro = Object.entries(f).some(([k, v]) => k !== 'texto' ? Boolean(v) : Boolean(v))
  const cuenta = $('coleccionCuenta')
  if (cuenta) cuenta.textContent = hayFiltro ? `${vistas.length} de ${todas.length} cartas` : ''
}

$('filtroNombre')?.addEventListener('input', () => pintar())
for (const id of ['filtroRareza', 'filtroTipo', 'filtroImpresion', 'filtroIlustrador', 'filtroPrecio', 'filtroOrden']) $(id)?.addEventListener('change', () => pintar())
$('filtroFaltan')?.addEventListener('click', () => {
  const b = $('filtroFaltan')
  b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')
  pintar()
})

// Igual que en la ficha: se queda el encabezado, se va el esqueleto. Y
// si el borde ya pintó la cabecera, una consulta que falle no la borra
// — la página ya estaba bien antes de preguntar.
function fallo() {
  const caja = $('coleccionCabecera')
  if (caja?.dataset.servidor === '1') return
  if (caja) caja.innerHTML = '<div class="coleccion-cabecera"><h1>Colección no encontrada</h1></div>'
  $('coleccionRejilla')?.classList.add('hidden')
  $('coleccionError')?.classList.remove('hidden')
}

cargar().catch(fallo)
