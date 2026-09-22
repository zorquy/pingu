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
  idDeRutaDeColeccion,
  rejillaDeCartas,
} from './carta-nucleo.js'
import { esDelTCG } from './catalogo-series.js'

const MERCADO = 'WEST'

// Cuántas cartas van en el documento que sale del servidor y cuántas
// trae después cada «ver más». Las 60 primeras cubren la pantalla de
// quien llega; el resto se pide cuando se pide.
const PRIMERAS = 60
const POR_TANDA = 120

const $ = (id) => document.getElementById(id)

let setId = null
let desde = 0
let quedan = true

async function cargar() {
  setId = idDeRutaDeColeccion(location.pathname) || new URLSearchParams(location.search).get('set')
  if (!setId) return fallo()

  const { data: set, error } = await supabase
    .from('tcg_sets')
    .select('id,name,serie_id,serie_name,logo_path,release_date,card_count_official,card_count_total')
    .eq('market', MERCADO)
    .eq('id', setId)
    .maybeSingle()
  // Una colección que no es del TCG de mesa no tiene página aquí.
  if (error || !set || !esDelTCG(set)) return fallo()

  document.title = `${set.name} — Cartas de Pokémon TCG — PokeDoc`
  const miga = $('migaColeccion')
  if (miga) miga.textContent = set.name

  const caja = $('coleccionCabecera')
  if (caja && caja.dataset.servidor !== '1') caja.innerHTML = cabeceraDeColeccion(set)

  // Si el borde ya dejó las primeras, se sigue por donde las dejó en vez
  // de volver a pedirlas.
  const yaPintadas = $('coleccionRejilla')?.querySelectorAll('.coleccion-carta').length || 0
  desde = yaPintadas
  if (!yaPintadas) await masCartas(PRIMERAS)
  actualizarBoton()
}

// El orden es por `local_id`, que es el número impreso en la carta — y
// es TEXTO, no número: hay cartas que se llaman «TG12», «SV107» o
// «H31». Ordenar como número las dejaría todas juntas al principio.
async function masCartas(cuantas) {
  const { data, error } = await supabase
    .from('tcg_cards')
    .select('id,name,name_es,local_id,image_path')
    .eq('market', MERCADO)
    .eq('set_id', setId)
    .order('local_id')
    .range(desde, desde + cuantas - 1)
  if (error) return
  const lista = data || []
  if (lista.length) $('coleccionRejilla')?.insertAdjacentHTML('beforeend', rejillaDeCartas(lista))
  desde += lista.length
  quedan = lista.length === cuantas
}

function actualizarBoton() {
  const btn = $('verMas')
  if (!btn) return
  btn.classList.toggle('hidden', !quedan)
  if (btn.dataset.listo === '1') return
  btn.dataset.listo = '1'
  btn.addEventListener('click', async () => {
    btn.disabled = true
    await masCartas(POR_TANDA)
    btn.disabled = false
    actualizarBoton()
  })
}

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
