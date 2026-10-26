// Una carta se abre en un pop-up, en CUALQUIER página (tanda 1043, PINGU:
// «siempre que cliques una carta te abra el pop-up, para no irte de donde
// estás… y a la ficha completa solo si le das a ver ficha completa»).
//
// Lo que se enseña es lo MISMO que /carta (la 998: un solo sitio): el
// núcleo de `nucleoDeCarta` y el precio, «Añadir» y «La quiero» de
// `pintarMercado`. Por eso el pop-up lleva dentro `#cartaNucleo` y
// `#cartaMercado`, los ids que esas dos piezas buscan; en /carta no se usa
// (los ids chocarían y además ya estás en la ficha).
//
// Lo abre el oyente de `js/app.js` con la dirección del enlace que se ha
// tocado. En Mi colección y /cartas, donde ya hay pop-up propio, la página
// deja en `window.pokedocAbrirCarta` cómo abrirlo, y se usa ese.
import { supabase } from './supabase.js'
import { hojaInyectada } from './hoja.js'
import { showToast } from './toast.js'
import { esDelTCG, nombreDeCarta } from './catalogo-series.js'
import { COLUMNAS_FICHA, nucleoDeCarta } from './carta-nucleo.js'
import { candidatosDeRuta, mercadoDeRuta, elegirCartaDeRuta, rutaDeCarta } from './carta-ruta.js'
import { legalidadDeCarta } from './carta-legalidad.js'
import { pintarMercado } from './carta-mercado.js'

// La carta a la que lleva una dirección: `/carta/<nombre>-<id>?catalogo=`
// o `/cartas?…&carta=<id>&catalogo=` (la de la lupa, 998). Null si la
// dirección no es de una carta.
export function cartaDeDireccion(url) {
  const u = url instanceof URL ? url : new URL(String(url), 'https://pokedoc.es')
  const ruta = u.pathname.replace(/\.html$/, '')
  if (ruta.startsWith('/carta/')) {
    const ids = candidatosDeRuta(ruta)
    return ids.length ? { ids, mercado: mercadoDeRuta(u.search) } : null
  }
  if (ruta === '/carta' && u.searchParams.get('id')) return { ids: [u.searchParams.get('id')], mercado: mercadoDeRuta(u.search) }
  if (ruta === '/cartas' && u.searchParams.get('carta')) return { ids: [u.searchParams.get('carta')], mercado: mercadoDeRuta(u.search) }
  return null
}

async function pedirCarta({ ids, mercado }) {
  const { data, error } = await supabase.from('tcg_cards').select(COLUMNAS_FICHA).in('id', ids).limit(10)
  if (error) throw error
  return elegirCartaDeRuta(data || [], mercado)
}

function dialogo() {
  let d = document.getElementById('fichaRapida')
  if (d) return d
  document.body.insertAdjacentHTML('beforeend', `
    <dialog class="ficha-rapida" id="fichaRapida" aria-labelledby="fichaRapidaTitulo">
      <div class="fr-mando">
        <h2 class="sr-only" id="fichaRapidaTitulo">Carta</h2>
        <a class="btn-secondary fr-completa" id="fichaRapidaCompleta" href="/cartas" data-ficha-completa>Ver ficha completa</a>
        <button type="button" class="fr-cerrar" id="fichaRapidaCerrar" aria-label="Cerrar">✕</button>
      </div>
      <div class="fr-cuerpo">
        <article id="cartaNucleo" class="carta-articulo"></article>
        <section id="cartaMercado" class="carta-seccion hidden" aria-label="Precio"></section>
      </div>
    </dialog>`)
  d = document.getElementById('fichaRapida')
  document.getElementById('fichaRapidaCerrar').addEventListener('click', () => d.close())
  d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  // Lo pintado de una carta no se queda para la siguiente: «Añadir» y el
  // precio se montan otra vez con la carta nueva.
  d.addEventListener('close', () => vaciar(d))
  return d
}

// En el PC `pintarMercado` mete el precio DENTRO del núcleo (al lado de los
// datos): se saca antes de vaciar el núcleo, o se iría con él. Al cerrar y al
// pasar a otra carta sin cerrar (un enlace dentro del pop-up).
function vaciar(d) {
  const mercado = d.querySelector('#cartaMercado')
  const cuerpo = d.querySelector('.fr-cuerpo')
  mercado.innerHTML = ''
  mercado.classList.add('hidden')
  cuerpo.append(mercado)
  for (const c of [...cuerpo.childNodes]) if (c.nodeType === Node.COMMENT_NODE) c.remove()
  d.querySelector('#cartaNucleo').innerHTML = ''
}

let turno = 0

// Abre la carta de `url` en el pop-up. Devuelve false si no ha podido (y
// quien llama navega a la ficha completa, que es lo de antes).
export async function abrirCartaDeEnlace(url) {
  const cual = cartaDeDireccion(url)
  if (!cual) return false
  const mio = ++turno
  const carta = await pedirCarta(cual).catch(() => null)
  if (mio !== turno) return true
  if (!carta || !esDelTCG({ id: carta.set_id, serie_id: carta.tcg_sets?.serie_id })) return false
  // Mi colección y /cartas tienen su pop-up: se usa ese.
  if (typeof window.pokedocAbrirCarta === 'function' && window.pokedocAbrirCarta(carta)) return true
  // Con el nombre escrito: la prueba 299 lee `hojaInyectada('css/…')`.
  await Promise.all([hojaInyectada('css/carta-holo.css'), hojaInyectada('css/cardmarket.css'), hojaInyectada('css/carta.css'), hojaInyectada('css/ficha-rapida.css')])
  if (mio !== turno) return true
  const d = dialogo()
  const completa = document.getElementById('fichaRapidaCompleta')
  completa.href = rutaDeCarta(carta)
  document.getElementById('fichaRapidaTitulo').textContent = nombreDeCarta(carta) || 'Carta'
  const ley = await legalidadDeCarta(carta).catch(() => null)
  if (mio !== turno) return true
  vaciar(d)
  document.getElementById('cartaNucleo').innerHTML = nucleoDeCarta(carta, carta.tcg_sets || null, null, ley)
  if (d.open) d.scrollTop = 0
  else d.showModal()
  pintarMercado(carta).catch((err) => showToast(err?.message || 'No se ha podido cargar el precio.', 'error'))
  return true
}
