// Una colección entera: la cabecera del set y todas sus cartas (tanda
// 324).
//
// Igual que la ficha, el centro de la página normalmente ya viene
// pintado desde el borde y esto NO lo repinta. Lo que sí hace siempre es
// lo que el borde no puede: traer el resto de la colección, porque un
// set puede tener 400 cartas y meterlas todas en el documento haría una
// respuesta de medio mega en cada visita.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import {
  cabeceraDeColeccion,
  filtroDeColeccion,
  idDeRutaDeColeccion,
  rejillaDeCartas,
  rutaDeColeccion,
  TIPOS_ES,
} from './carta-nucleo.js'
import { normalizeSearch } from './tcgdex.js'
import { esDelTCG, padreDeColeccion, prefijoDeColeccion } from './catalogo-series.js'

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
let desde = 0

// Todas las cartas que han llegado, en crudo. Hacen falta enteras porque
// el filtro es de aquí: ya están bajadas, así que preguntar otra vez a
// la base por «las de tipo Fuego» sería pedir lo que ya tenemos.
let todas = []

async function cargar() {
  const clave = idDeRutaDeColeccion(location.pathname) || new URLSearchParams(location.search).get('set')
  if (!clave) return fallo()

  // Dos columnas, porque la dirección puede ser el código nuevo (`pbl`) o
  // el identificador de siempre (`me05`): los enlaces viejos, los de
  // fuera y los que ya indexó Google tienen que seguir llegando.
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('id,name,serie_id,serie_name,logo_path,release_date,card_count_official,card_count_total,tcg_online_code')
    .eq('market', MERCADO)
    .or(filtroDeColeccion(clave))
    .limit(1)
  let set = data?.[0] || null
  // Una colección que no es del TCG de mesa no tiene página aquí.
  if (error || !set || !esDelTCG(set)) return fallo()

  // Y si este set es parte de otro —la Classics Collection lo es del 30
  // aniversario—, la página es la del padre: es un set solo, y tener dos
  // direcciones para él las deja a las dos a medias.
  const padre = padreDeColeccion(set.id)
  if (padre) {
    const { data: suyo } = await supabase
      .from('tcg_sets')
      .select('id,name,serie_id,serie_name,logo_path,release_date,card_count_official,card_count_total,tcg_online_code')
      .eq('market', MERCADO)
      .eq('id', padre)
      .limit(1)
    if (suyo?.[0]) set = suyo[0]
  }
  setId = set.id

  // Y si se llegó por la vieja, la barra pasa a decir la buena sin
  // recargar: una sola dirección para una sola página.
  const buena = rutaDeColeccion(set)
  if (location.pathname !== buena) history.replaceState(null, '', buena + location.search)

  document.title = `${set.name} — Cartas de Pokémon TCG — PokeDoc`
  const miga = $('migaColeccion')
  if (miga) miga.textContent = set.name

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

  // La cuenta declarada del set plegado es solo la de su mitad: con las
  // cartas ya contadas se repinta con el número de verdad. Un «160
  // cartas» encima de 190 es peor que no decir ninguna.
  if (prefijoDeColeccion(setId) && caja) {
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
  const prefijo = prefijoDeColeccion(setId)
  let consulta = supabase
    .from('tcg_cards')
    .select('id,name,name_es,local_id,image_path,types,category,rarity')
    .eq('market', MERCADO)
  consulta = prefijo ? consulta.like('set_id', `${prefijo}%`) : consulta.eq('set_id', setId)
  // Y si son dos mitades, PRIMERO la del set y después la otra: los dos
  // empiezan la numeración en el 001, así que ordenar solo por el número
  // impreso las mezcla —001, 001, 002, 002…— y parecen la misma lista
  // mal ordenada. El identificador del padre es prefijo del hijo, así
  // que ordenar por `set_id` deja al padre delante solo.
  if (prefijo) consulta = consulta.order('set_id')
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

// ── El filtro de la colección (tanda 346) ──
//
// «Como guardamos todos los datos, podemos usar todos los filtros
// necesarios» (PINGU). Y aquí no cuesta una consulta: las cartas ya
// están todas bajadas, así que filtrar es repintar.
//
// El tipo solo lo tienen las cartas ENGORDADAS: una sin `types` no es
// «de ningún tipo», es una de la que no se sabe. Por eso el desplegable
// solo ofrece los tipos que de verdad hay en esta colección — un tipo
// que no filtrara nada sería una promesa falsa.
function tiposDeLaColeccion() {
  const hay = new Set()
  for (const c of todas) for (const t of c.types || []) hay.add(t)
  return Object.keys(TIPOS_ES).filter((t) => hay.has(t))
}

function montarFiltros() {
  const caja = $('coleccionFiltros')
  if (!caja) return
  const tipos = tiposDeLaColeccion()
  const sel = $('filtroTipo')
  if (sel) {
    sel.innerHTML = '<option value="">Todos los tipos</option>' +
      tipos.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(TIPOS_ES[t])}</option>`).join('')
    // Sin tipos que ofrecer —una colección sin engordar— el desplegable
    // sobra: enseñarlo vacío es enseñar un control que no hace nada.
    sel.closest('.coleccion-filtro-campo')?.classList.toggle('hidden', tipos.length < 2)
  }
  caja.classList.remove('hidden')
}

function cumple(carta, texto, tipo) {
  if (tipo && !(carta.types || []).includes(tipo)) return false
  if (!texto) return true
  const busca = normalizeSearch(`${carta.name_es || ''} ${carta.name || ''} ${carta.local_id || ''}`)
  return busca.includes(texto)
}

function pintar() {
  const rejilla = $('coleccionRejilla')
  if (!rejilla) return
  const texto = normalizeSearch($('filtroNombre')?.value || '').trim()
  const tipo = $('filtroTipo')?.value || ''
  const vistas = todas.filter((c) => cumple(c, texto, tipo))
  rejilla.innerHTML = rejillaDeCartas(vistas)
  const vacio = $('coleccionVacia')
  if (vacio) vacio.classList.toggle('hidden', vistas.length > 0 || !todas.length)
  const cuenta = $('coleccionCuenta')
  if (cuenta) {
    cuenta.textContent = texto || tipo ? `${vistas.length} de ${todas.length} cartas` : ''
  }
}

$('filtroNombre')?.addEventListener('input', () => pintar())
$('filtroTipo')?.addEventListener('change', () => pintar())

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
