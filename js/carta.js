// La ficha de una carta (tanda 324).
//
// La mayor parte del trabajo no está aquí: el centro de la página lo
// pinta `js/carta-nucleo.js`, y normalmente lo ha pintado YA la función
// del borde antes de entregar el documento. Este fichero hace tres
// cosas: completar la ficha cuando la tarea programada todavía no ha
// llegado a esa carta, rellenar lo que el borde no trae (las otras
// versiones y las menciones) y repintar SOLO si ha conseguido más de lo
// que había pintado.
//
// POR QUÉ CASI NUNCA REPINTA. En un artículo, js/guia.js sustituye
// entero lo que puso el servidor, y por eso las dos mitades tienen que
// coincidir al pixel o la página pega un salto. Aquí el molde es uno
// solo y el relevo no existe: si el borde ya pintó, esto no toca nada…
// salvo que la carta no estuviera engordada y hayamos traído su ficha
// de TCGdex, que entonces lo pintado se queda corto (tanda 332).
import { supabase } from './supabase.js'
import { esDelTCG } from './catalogo-series.js'
import { detalleEnEspanol, IDIOMAS_DE_FICHA } from './carta-detalle.js'
import { legalidadDeCarta, marcasLegales } from './carta-legalidad.js'
import { logClientError } from './error-log.js'
import { escapeHtml } from './app.js'
import {
  candidatosDeRuta,
  clavesDeJuego,
  unirJuego,
  nombreDeCarta,
  esLaMismaCarta,
  huellaDeCarta,
  idiomaDeFicha,
  nucleoDeCarta,
  rutaDeCarta,
  rutaDeColeccion,
  urlDeImagen,
  rarezaEs,
} from './carta-nucleo.js'

const MERCADO = 'WEST'

// Las columnas de la ficha. Se piden por su nombre y no con `*` a
// propósito: `*` traería también `name_search` y `dex_ids`, que no pinta
// nadie, en TODAS las visitas.
const COLUMNAS =
  'id,set_id,local_id,name,name_es,image_path,category,rarity,types,hp,illustrator,' +
  'stage,evolve_from,retreat,attacks,abilities,weaknesses,resistances,' +
  'trainer_type,energy_type,suffix,description,regulation_mark,detalle_at,detalle_lang,' +
  'tcg_sets(id,name,serie_id,release_date,card_count_official,card_count_total,tcg_online_code)'

const $ = (id) => document.getElementById(id)

async function cargar() {
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

  // Una carta de Pokémon TCG Pocket no tiene ficha aquí: es otro juego.
  // Con el identificador del set, que es lo que los reconoce — la serie
  // la traen vacía.
  if (!esDelTCG({ id: carta.set_id, serie_id: set?.serie_id })) return fallo()

  // Los datos de juego hacen falta ANTES de pintar, porque el bloque va
  // dentro del núcleo. Si la tabla no existe todavía —la migración la
  // ejecuta un humano— esto devuelve error y el bloque no sale: la
  // ficha se pinta igual.
  // Las marcas de la temporada se piden YA, sin esperar a nada: no
  // dependen de la carta, y así cuando le toque a la chapa la respuesta
  // está y no hay un viaje más antes de pintar. La promesa se deja
  // suelta a propósito; quien la espera es `legalidadDeCarta`, que
  // comparte la caché.
  marcasLegales().catch(() => {})

  const { data: juegoFilas } = await supabase
    .from('tcg_card_play')
    .select('decks,total_copies,tournaments,archetypes')
    .in('name_key', clavesDeJuego(carta))
  const juego = unirJuego(juegoFilas)

  // Si la tarea programada todavía no ha llegado a esta carta, se le
  // pide la ficha a TCGdex AQUÍ. El engorde va de lo más nuevo a lo más
  // viejo y el catálogo son 23.000 cartas: sin esto, quien abra una
  // carta antigua ve el nombre, la foto y nada más durante días.
  //
  // Una petición, y solo para la carta que alguien ha abierto de
  // verdad. Esa es justo la excepción que la norma de la casa admite:
  // lo caro es pedir las 23.000, no pedir la que se está mirando.
  const completa = carta.detalle_at ? carta : await conDetalleDeTCGdex(carta)

  // Y si se puede jugar hoy. Va ANTES de pintar por lo mismo que los
  // datos de juego: la chapa está dentro del núcleo, y si llegara
  // después habría que repintar la ficha entera para meterla.
  const ley = await legalidadDeCarta(completa)
  // ¿Hemos traído algo que el borde NO tenía? Entonces lo que hay
  // pintado se queda corto y hay que repintarlo, diga lo que diga la
  // marca de «ya pintado».
  const mejorQueLoPintado = completa !== carta

  pintar(completa, set, juego || null, ley, mejorQueLoPintado)
  // Y si ha quedado algún tipo sin traducir, que lo cuente la web y no
  // una persona (tanda 342).
  avisarDeTiposSinTraducir()
  // Estas dos van por libre: llegan cuando llegan y sus secciones nacen
  // escondidas, así que una consulta lenta no retrasa la ficha.
  versiones(completa).catch(() => {})
  menciones(completa).catch(() => {})
}

// La ficha que falta, pedida a TCGdex en el momento.
//
// Devuelve la carta con lo que haya llegado encima. Si falla —red,
// 404, la carta no está en su catálogo— devuelve la de la base tal
// cual: la página se pinta con menos, que es lo que pasaba antes, y no
// se queda en blanco.
//
// NO se escribe en la base: el navegador no tiene permiso para tocar
// `tcg_cards` (y menos mal). Esto es para que se VEA; la tarea
// programada ya lo guardará cuando le toque.
async function conDetalleDeTCGdex(carta, idiomas = undefined) {
  try {
    const encontrado = await detalleEnEspanol(carta.id, async (url) => {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return null
      return res.json()
    }, idiomas)
    if (!encontrado) return carta
    // Lo de la base MANDA sobre lo que llega: la marca de regulación y
    // el número los curamos nosotros y son más de fiar. Solo se rellena
    // lo que estaba vacío.
    const mezcla = { ...encontrado.fila, ...carta }
    for (const [k, v] of Object.entries(encontrado.fila)) {
      if (carta[k] === null || carta[k] === undefined) mezcla[k] = v
    }
    // El nombre traducido va a `name_es`, igual que en el engorde: si
    // pisara `name` se llevaría por delante la clave con la que cruzan
    // las decklists y el bloque de torneos (tanda 335).
    if (encontrado.nombre && encontrado.idioma !== 'en') mezcla.name_es = encontrado.nombre
    // La huella necesita saber en qué idioma están estos ataques: una
    // ficha traída al vuelo no lo tiene apuntado en la base.
    mezcla.detalle_lang = encontrado.idioma
    // Y que conste que la ficha YA la tenemos, aunque la base todavía
    // no. Lo mira la chapa de legalidad para distinguir «esta carta no
    // lleva marca» de «no la hemos pedido»: sin esto, una carta recién
    // traída de TCGdex y sin marca se quedaría muda en vez de decir que
    // está fuera (tanda 338).
    mezcla.detalle_at = carta.detalle_at || new Date().toISOString()
    return mezcla
  } catch {
    return carta
  }
}

function pintar(carta, set, play = null, legalidad = null, repintarIgual = false) {
  document.title = `${nombreDeCarta(carta)} — ${set?.name || 'Pokémon TCG'} — PokeDoc`

  const miga = $('migaColeccion')
  if (miga && set?.name) {
    miga.outerHTML = `<a id="migaColeccion" href="${escapeHtml(rutaDeColeccion(set))}">${escapeHtml(set.name)}</a>`
  }

  const caja = $('cartaNucleo')
  if (!caja) return
  // Si el borde ya lo pintó, no se toca… SALVO que ahora tengamos más
  // de lo que él tenía.
  //
  // El borde pinta con lo que hay en la base. Si esa carta no está
  // engordada, pinta el nombre, la foto y el número — y como deja la
  // caja marcada, el cliente no la repintaba NUNCA. Así que el detalle
  // que acabábamos de pedirle a TCGdex se quedaba en una variable y no
  // llegaba a la pantalla. Lo vio PINGU en el Mew ex y tenía razón: «ya
  // ves que no».
  //
  // Aquí no se rompe la regla de las dos mitades, se completa: el
  // molde sigue siendo UNO, y solo se repinta cuando lo pintado está
  // demostrablemente incompleto.
  if (caja.dataset.servidor !== '1' || repintarIgual) {
    caja.innerHTML = nucleoDeCarta(carta, set, play, legalidad)
  }
}

// ── Que lo cuente la web, no una persona (tanda 342) ──
//
// La debilidad del Mew ex de 30th Celebration salía sin traducir porque
// TCGdex declina los tipos en femenino —«Oscura», no «Oscuro»— y la
// tabla tenía la forma masculina. Se arregló con una línea; lo que costó
// fue ENTERARSE: hizo falta que PINGU lo viera en pantalla, me lo dijera,
// yo probara once grafías a ciegas, y al final sacara el valor de un
// `select`.
//
// Es la lección de la 323 —una lista curada se queda vieja y alguien
// tiene que notarlo— con el mismo remedio que el resto del sitio usa
// para los fallos que no lanzan excepción: `logClientError`. Si a la
// tabla le falta una palabra, aparece sola en /admin → Errores con la
// palabra dentro.
//
// Se mira el DOM y no la carta a propósito: así cubre también lo que
// pintó la función del borde, que es lo que se ve cuando la ficha ya
// está engordada.
function avisarDeTiposSinTraducir() {
  try {
    const sueltos = [...document.querySelectorAll('#cartaNucleo .carta-energia[data-tipo="?"]')]
    if (!sueltos.length) return
    // Los valores crudos van en el título, que es donde los deja
    // `puntoDeEnergia`. Sin repetir: una carta puede llevar el mismo
    // tipo en la debilidad y en el coste de un ataque.
    const crudos = [...new Set(sueltos.map((n) => n.getAttribute('title') || ''))]
    logClientError(`Tipo de energía sin traducir en /carta: ${crudos.join(' | ')}`)
  } catch {
    // Avisar de un fallo no puede provocar otro.
  }
}

// El escaneo se amplía pulsándolo, con el visor de toda la web
// (js/lightbox.js). Aquí había un enlace «Ver en grande» que abría la
// imagen en otra pestaña: una pieza de más para hacer lo que el resto
// del sitio ya hace igual, y encima distinta. Lo quitó PINGU al verlo
// en el móvil.

// Cuántas candidatas se completan pidiéndoselas a TCGdex.
//
// El tope no es por rendimiento: es por educación. Una carta popular
// tiene quince impresiones, y quince peticiones por visita a un
// catálogo comunitario y gratuito no se hace. Con ocho se cubren las
// que le interesan a alguien, y el resto aparece solo según la tarea
// programada va engordando.
const CANDIDATAS_QUE_SE_COMPLETAN = 8

// Las del MISMO set primero: «la alternativa» de la carta que estás
// mirando es casi siempre otra ilustración del mismo set, y es justo la
// que se echa en falta.
function porCercania(carta) {
  return (a, b) => Number(b.set_id === carta.set_id) - Number(a.set_id === carta.set_id)
}

async function conTextoDeReglas(candidatas, carta) {
  const faltan = candidatas
    .filter((v) => !Array.isArray(v.attacks) || !v.attacks.length)
    .sort(porCercania(carta))
    .slice(0, CANDIDATAS_QUE_SE_COMPLETAN)
  if (!faltan.length) return candidatas

  // En el IDIOMA de la carta que se está mirando, y solo si no existe
  // en él se prueba el resto: los nombres de los ataques solo casan
  // dentro de un idioma, así que pedir la candidata en el mismo da la
  // comparación fina — y a una ficha en inglés le ahorra además la
  // petición en español que iba a dar 404.
  const idiomas = [...new Set([idiomaDeFicha(carta), ...IDIOMAS_DE_FICHA])]
  const completadas = new Map()
  await Promise.all(
    faltan.map(async (v) => {
      const completa = await conDetalleDeTCGdex(v, idiomas)
      if (completa !== v) completadas.set(v.id, completa)
    })
  )
  return candidatas.map((v) => completadas.get(v.id) || v)
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
    .select('id,name,name_es,local_id,image_path,rarity,set_id,category,hp,stage,types,attacks,detalle_lang,tcg_sets(name,serie_id)')
    .eq('market', MERCADO)
    .eq('name', carta.name)
    .neq('id', carta.id)
    // Se piden más de las que se enseñan: el nombre es solo el
    // prefiltro barato y la mayoría se van a caer al comparar la huella.
    .limit(60)
  if (error || !data?.length) return

  const candidatas = data.filter((v) => esDelTCG({ id: v.set_id, serie_id: v.tcg_sets?.serie_id }))

  // Y aquí se cae casi todo: mismo nombre no es la misma carta. Pero
  // para comparar hace falta su texto de reglas, y las que la tarea no
  // ha engordado todavía no lo tienen — así que en un set recién salido
  // no salía NINGUNA. Es lo que vio PINGU en el Mew ex: «abajo no salen
  // los otros prints».
  const mismas = (await conTextoDeReglas(candidatas, carta))
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
  // Se busca por el nombre que LEE la gente: las guías y el foro están
  // escritos en español, así que buscar «Boss's Orders» no encontraría
  // nada aunque el hilo hable de esa carta.
  const nombre = String(nombreDeCarta(carta) || '').trim()
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
