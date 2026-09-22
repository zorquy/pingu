// La ficha de una carta (tanda 324).
//
// La mayor parte del trabajo no está aquí: el centro de la página lo
// pinta `js/carta-nucleo.js`, y normalmente lo ha pintado YA la función
// del borde antes de entregar el documento. Este fichero hace tres
// cosas: pintar el núcleo SI el borde no llegó, rellenar lo que el borde
// no trae (las otras versiones) y encender lo que se pulsa.
//
// POR QUÉ NO REPINTA LO QUE YA ESTÁ. En un artículo, js/guia.js sustituye
// entero lo que puso el servidor, y por eso las dos mitades tienen que
// coincidir al pixel o la página pega un salto. Aquí se evita el
// problema de raíz: si el borde ya pintó, esto no toca el núcleo. El
// molde es uno solo y el relevo no existe.
import { supabase } from './supabase.js'
import { esDelTCG } from './catalogo-series.js'
import { escapeHtml } from './app.js'
import {
  candidatosDeRuta,
  claveDeJuego,
  esLaMismaCarta,
  huellaDeCarta,
  nucleoDeCarta,
  rutaDeCarta,
  urlDeImagen,
  rarezaEs,
} from './carta-nucleo.js'

const MERCADO = 'WEST'

// Las columnas de la ficha. Se piden por su nombre y no con `*` a
// propósito: `*` traería también `name_search` y `dex_ids`, que no pinta
// nadie, en TODAS las visitas.
const COLUMNAS =
  'id,set_id,local_id,name,image_path,category,rarity,types,hp,illustrator,' +
  'stage,evolve_from,retreat,attacks,abilities,weaknesses,resistances,' +
  'trainer_type,energy_type,suffix,description,regulation_mark,detalle_at,' +
  'tcg_sets(id,name,release_date,card_count_official,card_count_total)'

const $ = (id) => document.getElementById(id)

async function cargar() {
  // Si el borde ya pintó, lo que se pulsa se enciende YA, sin esperar a
  // la consulta. Antes la lupa colgaba de que la consulta saliera bien,
  // así que una red lenta dejaba una ficha completa sin su enlace.
  const caja = $('cartaNucleo')
  if (caja?.dataset.servidor === '1') encenderLupa(caja)

  const candidatos = candidatosDeRuta(location.pathname)
  // La dirección larga es la buena, pero `?id=` sigue valiendo: es como
  // llega un enlace viejo y como se prueba la página en local sin las
  // reescrituras de Netlify.
  const sueltoEnQuery = new URLSearchParams(location.search).get('id')
  const buscar = sueltoEnQuery ? [sueltoEnQuery] : candidatos
  if (!buscar.length) return fallo()

  // Una sola consulta con todos los candidatos. Probarlos de uno en uno
  // serían tres viajes para el caso raro y dos de más para el normal.
  const { data, error } = await supabase
    .from('tcg_cards')
    .select(COLUMNAS)
    .eq('market', MERCADO)
    .in('id', buscar)
    .limit(1)
  if (error || !data?.length) return fallo()

  const carta = data[0]
  const set = carta.tcg_sets || null

  // Los datos de juego hacen falta ANTES de pintar, porque el bloque va
  // dentro del núcleo. Si la tabla no existe todavía —la migración la
  // ejecuta un humano— esto devuelve error y el bloque no sale: la
  // ficha se pinta igual.
  const { data: juego } = await supabase
    .from('tcg_card_play')
    .select('decks,total_copies,tournaments,archetypes')
    .eq('name_key', claveDeJuego(carta))
    .maybeSingle()

  pintar(carta, set, juego || null)
  // Estas dos van por libre: llegan cuando llegan y sus secciones nacen
  // escondidas, así que una consulta lenta no retrasa la ficha.
  versiones(carta).catch(() => {})
  menciones(carta).catch(() => {})
}

function pintar(carta, set, play = null) {
  document.title = `${carta.name} — ${set?.name || 'Pokémon TCG'} — PokeDoc`

  const miga = $('migaColeccion')
  if (miga && set?.name) {
    miga.outerHTML = `<a id="migaColeccion" href="/coleccion/${escapeHtml(set.id)}">${escapeHtml(set.name)}</a>`
  }

  const caja = $('cartaNucleo')
  if (!caja) return
  // Si el borde ya lo pintó, no se toca. `data-servidor` lo pone
  // `inyectarNucleo` en la función del borde.
  if (caja.dataset.servidor !== '1') {
    caja.innerHTML = nucleoDeCarta(carta, set, play)
  }
  encenderLupa(caja)
}

// La imagen, a tamaño completo. No es un visor: es abrir el escaneo en
// su propia pestaña, que es lo que la gente hace igual con el botón
// derecho y encima funciona sin JavaScript si esto no llega.
function encenderLupa(caja) {
  const img = caja.querySelector('.carta-scan img')
  if (!img || caja.querySelector('.carta-lupa')) return
  const a = document.createElement('a')
  a.className = 'carta-lupa'
  a.href = img.src
  a.target = '_blank'
  a.rel = 'noopener'
  a.textContent = 'Ver en grande'
  img.parentElement.appendChild(a)
}

// ── Otras versiones de la misma carta ──
//
// La misma carta sale reimpresa con otra ilustración y otra rareza, y
// quien busca «Ceruledge ex» quiere verlas todas. Se buscan por NOMBRE
// EXACTO y se quita la que estás viendo.
//
// Esto no lo pinta el borde a propósito: es una segunda consulta, y el
// borde tiene 2,5 segundos para toda la página. Que llegue tarde no
// rompe nada — la sección nace escondida.
async function versiones(carta) {
  // Sin huella no se puede decir qué es la misma carta, así que no se
  // dice nada. Pasa con las que no están engordadas todavía y con los
  // Entrenadores y las Energías, donde no hay ataques que comparar.
  if (!huellaDeCarta(carta)) return

  const { data, error } = await supabase
    .from('tcg_cards')
    .select('id,name,local_id,image_path,rarity,set_id,category,hp,stage,types,attacks,tcg_sets(name,serie_id)')
    .eq('market', MERCADO)
    .eq('name', carta.name)
    .neq('id', carta.id)
    // Se piden más de las que se enseñan: el nombre es solo el
    // prefiltro barato y la mayoría se van a caer al comparar la huella.
    .limit(60)
  if (error || !data?.length) return

  // Y aquí se cae casi todo: mismo nombre no es la misma carta.
  const mismas = data
    .filter((v) => esDelTCG({ serie_id: v.tcg_sets?.serie_id }))
    .filter((v) => esLaMismaCarta(carta, v))
    .slice(0, 12)
  if (!mismas.length) return

  const caja = $('listaVersiones')
  if (!caja) return
  caja.innerHTML = mismas
    .map((v) => {
      const img = urlDeImagen(v.image_path, 'low')
      const pie = [v.local_id, rarezaEs(v.rarity)].filter(Boolean).join(' · ')
      return (
        `<a class="carta-version" href="${escapeHtml(rutaDeCarta(v))}">` +
        (img
          ? `<img src="${escapeHtml(img)}" alt="" width="245" height="337" loading="lazy" decoding="async">`
          : '<span class="carta-version-vacia"></span>') +
        `<span class="carta-version-pie">${escapeHtml(pie)}</span>` +
        `<span class="carta-version-set">${escapeHtml(v.tcg_sets?.name || '')}</span>` +
        '</a>'
      )
    })
    .join('')
  $('cartaVersiones')?.classList.remove('hidden')
}

// Una pantalla sin encabezado no existe para quien la navega con un
// lector: esconder el artículo entero dejaba la página sin `h1`. Se
// queda el título y se dice lo que pasa debajo.
// ── Dónde más se habla de esta carta ──
//
// Guías que la explican e hilos del foro que la nombran. Es la otra
// mitad de «qué tiene esta página que no tenga la de al lado»: las dos
// cosas son NUESTRAS y las dos son enlaces internos, que es lo que
// recorre Google.
//
// Se busca por el nombre tal cual. Un nombre corto («Iono») daría
// falsos positivos dentro de otras palabras, así que por debajo de
// cuatro letras no se busca: mejor no enseñar la sección que enseñarla
// con ruido.
const LETRAS_MINIMAS_PARA_BUSCAR = 4

async function menciones(carta) {
  const nombre = String(carta?.name || '').trim()
  if (nombre.length < LETRAS_MINIMAS_PARA_BUSCAR) return

  const [guias, temas] = await Promise.all([
    supabase
      .from('guides')
      .select('slug,title')
      .not('published_at', 'is', null)
      .ilike('search_content', `%${nombre}%`)
      .limit(4),
    supabase
      .from('forum_threads')
      .select('id,title')
      .ilike('title', `%${nombre}%`)
      .limit(4),
  ])

  const filas = [
    ...(guias.data || []).map((g) => ({ url: `/guia?slug=${encodeURIComponent(g.slug)}`, titulo: g.title, donde: 'Guía' })),
    ...(temas.data || []).map((t) => ({ url: `/tema/${encodeURIComponent(t.id)}`, titulo: t.title, donde: 'Foro' })),
  ]
  if (!filas.length) return

  $('listaMenciones').innerHTML = filas
    .map(
      (f) =>
        `<li><a href="${escapeHtml(f.url)}">` +
        `<span class="mencion-donde">${escapeHtml(f.donde)}</span>` +
        `<span class="mencion-titulo">${escapeHtml(f.titulo)}</span></a></li>`
    )
    .join('')
  $('cartaMenciones')?.classList.remove('hidden')
}

function fallo() {
  const caja = $('cartaNucleo')
  // Y si el borde YA pintó la ficha, esto no toca nada.
  //
  // Lo cazó la prueba y es un fallo de verdad: el borde entrega la
  // página entera y bien, y a continuación el cliente pregunta a
  // Supabase. Si esa consulta falla —red floja, tiempo agotado, una
  // política que cambió— la página buena se borraba sola y ponía «no
  // encontrada» encima de una ficha que se estaba leyendo. Lo único que
  // se pierde de verdad son las otras versiones, y esas nacen
  // escondidas.
  if (caja?.dataset.servidor === '1') return
  if (caja) caja.innerHTML = '<div class="carta-cabecera"><h1>Carta no encontrada</h1></div>'
  $('cartaError')?.classList.remove('hidden')
}

cargar().catch(fallo)
