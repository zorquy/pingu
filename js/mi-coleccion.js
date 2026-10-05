// /mi-coleccion: tus cartas, lo que valen y tu álbum (tanda 365).
//
// Tres pestañas:
//   · Cartas: la lista, con su valor y el enlace a Cardmarket con el
//     idioma, el estado y la versión de CADA línea ya filtrados.
//   · Álbum: una colección entera como las páginas de un archivador de
//     nueve bolsillos, con lo que tienes a color y lo que te falta en
//     gris. Con «tocar para añadir», rellenarlo es ir tocando cartas.
//   · Añadir: buscar una carta y guardarla.
//
// /mi-coleccion?u=<usuario> enseña la de otra persona si la ha hecho
// pública, sin nada que se pueda tocar.
import { escapeHtml, getSession, profileUrl, avatarStyle, getInitial } from './app.js'
import { atributosDeRango } from './rangos.js'
import { showToast } from './toast.js'
import { supabase } from './supabase.js'
import { normalizeSearch } from './tcgdex.js'
// Del módulo puro: `tcgdex.js` lo reexporta, pero esto no necesita nada de
// aquel y pedírselo arrastraría el cliente de Supabase a quien lo importe.
import { tieneCJK, variantesDeMarcas } from './texto.js'
import { rutaDeCarta, urlDeLogo, urlDeLogoPorPartes } from './carta-ruta.js'
// El escaneo con su respaldo (tanda 370): TCGdex no tiene imagen de
// muchas cartas viejas, y sin esto el bolsillo se quedaba en blanco.
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
// La rareza, en cristiano, para el reparto del resumen (tanda 374).
// De las TABLAS, no del núcleo: `carta-nucleo.js` pinta la ficha entera,
// y el barrido de la 299 sigue los imports —así que importarlo por una
// rareza dejaba seis clases de `carta.css` huérfanas en esta página, que
// no carga esa hoja.
import { rarezaEs, rarezaDeCarta, rarezaCrudaDeCarta, marcaDeCartaHtml, categoriaEs, tipoEs, entrenadorEs, familiaDeBrillo, formasDeRareza, marcaDeRarezaHtml, CATEGORIAS_ES, TIPOS_ES, ENTRENADORES_ES, RAREZAS_ES } from './carta-traducciones.js'
import { esDelTCG, padreDeColeccion, idsDeColeccion, plegarHermanos, registrarEpisodios, variacionSemanal, eraDeSet, nombreDeSet, nombreDeCarta, nombresDeCartaParaBuscar } from './catalogo-series.js'
import {
  IDIOMAS,
  ESTADOS,
  VARIANTES,
  ESTADO_POR_DEFECTO,
  idiomaDe,
  estadoDe,
  varianteDe,
  euros,
  valorDeLinea, resumenDePrecio } from './cardmarket.js'
import { bloqueDePrecio, banderaHtml } from './precio-vista.js'
import { icons, icon } from './icons.js'
import { ICONOS_COLECCION } from './mi-coleccion/iconos.js'
// La marca de Cardmarket, dibujada (su CSS va en css/cardmarket.css, que
// cargan esta página y la ficha de una carta).
import * as datos from './mi-coleccion/datos.js'
import * as albumes from './mi-coleccion/albumes.js'
import { gruposDeEstanteria } from './mi-coleccion/estanteria.js'
import { diapoHtml, tiraHtml } from './mi-coleccion/diapos.js'
import { migasHtml } from './mi-coleccion/migas.js'
import { ORDENES, ordenar, porNumero, rangoDeRareza } from './mi-coleccion/orden.js'
import { ORDENES_COLECCION, GRUPOS_FILTRO, ordenarLineas, pasaLosFiltros, filtrosVacios, sentidoNatural, FILTROS_CATALOGO, ORDENES_CATALOGO, filtrosCatalogoVacios, cuantosFiltrosCatalogo, ordenarCartas, valoresDeCartas, pasaFiltrosDeCarta, pasaFiltrosCrudos } from './mi-coleccion/filtros.js'
import { balanceDeCompra } from './mi-coleccion/balance.js'
import { textoDeLoQueFalta } from './mi-coleccion/lo-que-falta.js'
import { copiarEnlace } from './compartir.js'
import { iniciarDialogoAdorno, abrirDialogoAdorno } from './mi-coleccion/dialogo-adorno.js'
import { archivadorHtml, textoDePaginas, opcionesDeSalto, tapaGuardada, guardarTapa, TAPAS } from './mi-coleccion/archivador.js'
import { variantesDeCarta, tieneVarias, nombreDeVariante, varianteDeCarta, TODAS as TODAS_LAS_VARIANTES } from './mi-coleccion/variantes.js'
import { CASAS, OTRA, notasDeCasa, escribirGradeo, leerGradeo } from './mi-coleccion/gradeo.js'
import { especiePorDex } from './pokedex-especies.js'
import { progresoDeSet, barrasDeSet, porcentaje } from './mi-coleccion/progreso-set.js'
import { MERCADO_POR_DEFECTO } from './mercados.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)

// ── Estado de la página ──
let sesion = null
let dueno = null // { id, username, display_name, coleccion_publica }
// Las cuatro cifras de la cabecera, tal como se pintaron (tanda 571).
let resumenHero = null
let quiereImportar = new URLSearchParams(location.search).get('importar') === '1'
let esMia = false
let lineas = []
let cartas = new Map() // id → fila de tcg_cards
// ── EL PANEL ES GENERAL, LAS OTRAS CUATRO PESTAÑAS SON DEL CATÁLOGO
// (tanda 485) ──
//
// PINGU: «cambio el idioma y pongo japonés […] y seguido me vuelvo al panel
// y me sale solo mi colección en ese idioma. Está mal. Debería ser un
// overall de todas las cartas que tengas independientemente del idioma. El
// panel es general».
//
// Así que hay DOS colecciones en memoria y no una filtrada de dos formas:
// `lineas`/`cartas` son del mercado elegido —y las pintan Cartas,
// Expansiones, Carpetas y la Pokédex— y este par es TODO lo que tienes, y
// lo pinta solo el Panel.
//
// OJO A LA CLAVE, que es la razón por la que no vale filtrar: `cartas` va
// por id a secas y puede, porque mira un solo mercado. Con los cuatro
// juntos eso se rompe — la clave de `tcg_cards` es (id, market) porque el
// japonés comparte identificadores de set con el inglés (tanda 437), así
// que `sv1a-1` son DOS cartas y un mapa por id se queda con una SIN DAR
// NINGÚN ERROR. Este va por `claveDeCarta(id, market)`.
let lineasTodo = []
let cartasTodo = new Map() // `id|market` → fila de tcg_cards
// La carta de una línea, en cada una de las dos memorias. Van sueltas
// porque los ayudantes del Panel las reciben como argumento: así el mismo
// cálculo sirve para las dos y no hay dos versiones de «lo que te sobra»
// que se puedan separar.
const cartaDeLinea = (l) => cartas.get(l?.card_id)
const cartaDeLineaTodo = (l) => cartasTodo.get(datos.claveDeLineaEnMercado(l))
let guardados = new Map() // id → fila de tcg_card_prices
const vivos = new Map() // id → { pricing, variants } pedido a TCGdex
// Las cinco pestañas (tanda 408) y, al lado, los tres nombres viejos que
// siguen llegando por enlace: no se borran, se REDIRIGEN a donde se ha
// mudado cada cosa. Un `?ver=` que ya no existe no da error — abre la
// primera pestaña y parece que el enlace estaba mal.
const PESTANAS = ['cartas', 'album', 'carpetas', 'pokedex', 'resumen', 'buscar', 'cambios']
// `cambios` ya NO se muda al panel (tanda 451): vuelve a tener pantalla
// propia, así que su enlace de siempre lleva otra vez a donde dice.
const MUDANZAS = { anadir: 'cartas', albumes: 'carpetas' }
const pedida = params.get('ver')
// El PANEL es lo primero que se abre (tanda 436). PINGU: «el panel
// debería ser lo primero que se abre cuando abres mi colección». Tiene
// sentido: las otras cuatro pestañas son para hacer algo concreto —buscar
// una carta, repasar un set, ver la Pokédex—, y el panel es para ver qué
// tienes, que es a lo que entra uno cuando entra sin un plan.
let pestania = PESTANAS.includes(pedida) ? pedida : MUDANZAS[pedida] || 'resumen'
// ── EL CATÁLOGO PÚBLICO ES ESTA MISMA PANTALLA (tanda 649) ──
//
// /cartas es mi-coleccion.html generado con `<body data-modo="catalogo">`
// (generar-cartas.mjs): la misma estantería, la misma expansión por
// dentro y la misma ficha emergente. Lo que cambia con el modo es poco y
// está todo detrás de este nombre: se enseñan TODAS las expansiones
// aunque mires sin cuenta (la colección vacía y la ficha diciendo «entra
// para añadirla»), la cabecera es la de una página pública y las pestañas
// son dos (Expansiones y Buscar). Con cuenta, tu colección se carga igual
// y la estantería enseña tu progreso. Y Mi colección CONSERVA su pestaña
// de Expansiones: PINGU, «creo que es muy importante».
const modoCatalogo = document.body.dataset.modo === 'catalogo'
const PESTANAS_CATALOGO = ['album', 'buscar']
// La pestaña por defecto es la que NO va en la dirección: compartir
// /mi-coleccion o /cartas a secas tiene que abrir lo mismo que ve quien
// lo comparte.
const PESTANA_POR_DEFECTO = modoCatalogo ? 'album' : 'resumen'
if (modoCatalogo && !PESTANAS_CATALOGO.includes(pestania)) pestania = PESTANA_POR_DEFECTO
let albumesAbiertos = false

// ── EL BOTÓN DE ATRÁS (tanda 468) ──
//
// PINGU: «en el PC estoy en mi colección, abro una expansión o un Pokémon,
// le doy para atrás y no me lleva para atrás: me saca al inicio».
//
// Y era eso exactamente: TODA la navegación de esta página usaba
// `history.replaceState`, que CAMBIA la entrada actual en vez de añadir
// una. Así que el historial nunca tenía dónde volver dentro de la página y
// el botón de atrás te sacaba a la anterior — que normalmente es el
// inicio. Lo mismo con el gesto de deslizar en el móvil.
//
// Peor: abrir una expansión no tocaba la dirección SIQUIERA, así que
// recargar te devolvía a la estantería y no se podía compartir el enlace
// de una colección abierta.
//
// Ahora cada paso que CAMBIA lo que ves añade su entrada (`pushState`) y
// `popstate` reconstruye la pantalla desde la dirección. El primer pintado
// no empuja: la entrada de llegada ya existe.
function irA(cambios, { push = true } = {}) {
  const url = new URL(location.href)
  for (let [k, v] of Object.entries(cambios)) {
    if (k === 'ver' && v === PESTANA_POR_DEFECTO) v = null
    if (v == null || v === '') url.searchParams.delete(k)
    else url.searchParams.set(k, String(v))
  }
  // Sin cambio, sin entrada: si no, pulsar dos veces la misma pestaña
  // dejaría dos entradas iguales y el botón de atrás no haría nada la
  // primera vez.
  if (url.href === location.href) return
  if (push) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
}

// Reconstruye la pantalla desde la dirección. Es lo que corre al dar
// atrás, y por eso NINGUNO de los pasos que da puede volver a empujar: se
// les pasa `desdeHistorial` para que no lo hagan.
function aplicarDireccion() {
  const p = new URLSearchParams(location.search)
  const pedidaAhora = p.get('ver')
  const ver = PESTANAS.includes(pedidaAhora) ? pedidaAhora : MUDANZAS[pedidaAhora] || PESTANA_POR_DEFECTO
  if (ver !== pestania) cambiarPestania(ver, { push: false })
  if (ver === 'album') {
    const set = p.get('set')
    if (set && album.set !== set) void abrirAlbum(set, { push: false })
    else if (!set && album.set) volverALaEstanteria({ push: false })
  }
  if (ver === 'pokedex') {
    const dex = Number(p.get('dex')) || null
    if (dex && especieAbierta !== dex) void pintarEspecie(dex, { push: false })
    else if (!dex && especieAbierta != null) {
      especieAbierta = null
      pintarPokedex()
    }
  }
}

window.addEventListener('popstate', aplicarDireccion)

// ── QUÉ CATÁLOGO SE MIRA (tanda 437) ──
//
// PINGU: «vamos a hacer que tengamos dos catálogos distintos… y después,
// si seleccionas las japonesas». Ya están los cuatro en la base —el
// occidental con 206 colecciones, el japonés con 186, el taiwanés con 98 y
// el chino simplificado con 56—, así que esto no trae datos: deja de fijar
// 'WEST' a mano en las diez consultas que lo tenían escrito.
//
// EL MERCADO ES DE TODA LA PANTALLA, no solo del catálogo. Quien elige el
// japonés quiere ver SU colección japonesa, no sus cartas inglesas sobre
// un catálogo japonés — y además hace falta que sea así: la clave de
// `tcg_cards` es (id, market) porque el japonés comparte cuatro
// identificadores de set con el inglés, de modo que el mapa `cartas`, que
// va por la id a secas, mezclaría dos cartas DISTINTAS sin dar ningún
// error. Mientras cada visita mira un solo mercado, ese choque no existe.
//
// Los cuatro son los que están importados (MERCADOS_A_IMPORTAR en
// js/tcgdex.js). Los otros tres que admite la base —coreano, indonesio y
// tailandés— no se ofrecen porque saldrían vacíos.
// Y lo que se elige NO es un mercado, es una VISTA (tanda 438). PINGU:
// «tendrías que meter español, inglés, japonés y chino». Eso son DOS ejes
// y conviene no confundirlos, porque confundirlos es lo que lleva a
// preguntarse si hay que meter también el alemán y el italiano:
//
//   - El MERCADO dice qué cartas EXISTEN. El occidental es UN catálogo
//     publicado en ocho idiomas con las MISMAS cartas —el español
//     comparte sus 154 identificadores de set con el inglés, el alemán
//     153, el italiano 190: todos—. El japonés y los dos chinos sí son
//     catálogos propios.
//   - El IDIOMA dice cómo se ESCRIBE: `name_es` contra `name`.
//
// O sea que español e inglés son el MISMO catálogo con dos rótulos, y por
// eso añadir alemán o italiano mañana es una línea en esta lista y ni una
// carta más que importar. Mientras que japonés y chino traen su catálogo.
//
// El tradicional se queda fuera porque PINGU lo pidió. Queda apuntado que
// es el que tiene catálogo DE VERDAD: 98 colecciones y 7.436 cartas,
// contra las 56 y 877 del simplificado.
// ── DOS CATÁLOGOS, COMO LA API (tanda 648) ──
//
// PINGU, con TCGGO delante: «ellos tienen dos apartados, Pokémon
// occidental —con la bandera inglesa— y Pokémon japonés; es mejor hacerlo
// así y dejarnos de filtros de español, inglés y japonés, porque es un
// lío». Así que lo que se elige es el CATÁLOGO y nada más: el occidental
// (en español, que es como se lee aquí; el idioma de cada copia se elige
// al añadirla) y el japonés. La vista «en» no se borra —quien la tuviera
// guardada vuelve al occidental, y el resto del código sigue sabiendo
// de qué va— pero no se ofrece, igual que el chino desde la 509.
const VISTAS = [
  { id: 'es', bandera: '🇬🇧', nombre: 'Pokémon', mercado: 'WEST', enEspanol: true },
  { id: 'en', bandera: '🇬🇧', nombre: 'Pokémon (en inglés)', mercado: 'WEST', enEspanol: false, oculta: true },
  { id: 'ja', bandera: '🇯🇵', nombre: 'Pokémon Japón', mercado: 'JP', enEspanol: true },
  // EL CHINO SE ESCONDE, NO SE BORRA (tanda 509). PINGU: «el chino no lo
  // borres, pero ocúltamelo, porque Scrydex no tiene chino, vamos por
  // ahora a obviar las colecciones chinas».
  //
  // Se queda la entrada entera con una marca en vez de quitarla, por tres
  // motivos: las cartas chinas que alguien tenga guardadas siguen
  // resolviendo su mercado y su idioma; `catalogo-asia` sigue
  // engordándolo en segundo plano, así que no se queda viejo; y volver a
  // enseñarlo es borrar UNA palabra. Quitar la fila habría dejado a quien
  // tuviera cartas chinas con filas que no saben de qué catálogo son.
  { id: 'zh', bandera: '🇨🇳', nombre: 'Chino', mercado: 'CN', enEspanol: false, oculta: true },
]
const VISTAS_VISIBLES = VISTAS.filter((v) => !v.oculta)
const CLAVE_MERCADO = 'mc-vista'

// Se recuerda por navegador, no en el perfil: es cómo MIRAS la página, no
// un dato tuyo, y quien colecciona las dos cosas cambia a menudo. El
// try/catch no es por gusto — en una ventana privada `localStorage` lanza.
function vistaGuardada() {
  try {
    const v = localStorage.getItem(CLAVE_MERCADO)
    // Una vista ESCONDIDA no se recupera de la memoria: quien estuviera
    // mirando el chino vuelve al español, que es lo que se pidió.
    return VISTAS_VISIBLES.some((x) => x.id === v) ? v : 'es'
  } catch {
    return 'es'
  }
}
// Y LA DIRECCIÓN MANDA (656): `?catalogo=JP` abre el catálogo japonés
// aunque la última vez se mirara el occidental. Es lo que hace que un
// enlace de /lanzamientos a un set japonés abra ESE set y no «no existe».
// No se guarda: es cómo se ha llegado, no lo que se ha elegido.
function vistaDeDireccion() {
  try {
    const c = new URLSearchParams(location.search).get('catalogo')
    return VISTAS_VISIBLES.find((v) => v.mercado === c)?.id || null
  } catch {
    return null
  }
}
let vista = vistaDeDireccion() || vistaGuardada()
const laVista = () => VISTAS.find((v) => v.id === vista) || VISTAS[0]
// `mercado` se queda como lo que es: el catálogo que se consulta. Lo
// calcula la vista, así que las diez consultas de la 437 no se enteran.
let mercado = laVista().mercado

// ── CON QUÉ IDIOMA SE AÑADE LO MANDA EL CATÁLOGO (tanda 472) ──
//
// PINGU: «tenemos el filtro de idioma en todos los sitios… si yo tengo el
// filtro en español y agrego una carta, se me está agregando en español.
// Me gustaría que cuando cambiases el idioma en el menú, si yo pongo
// inglés… esa carta debería añadirse en inglés. Lo mismo con la carta en
// japonés, en chino… es un añadido de calidad de vida totalmente
// necesario».
//
// Y es más que comodidad: en el catálogo JAPONÉS no existe una carta en
// español, así que ofrecerlo era ofrecer algo que no se puede tener. Una
// opción de la interfaz es una AFIRMACIÓN sobre lo que hay (la norma de la
// 447), y esta decía que sí.
//
// Los dos ejes del comentario de arriba, otra vez: el MERCADO dice qué
// cartas EXISTEN y el IDIOMA cómo se escriben. El occidental es UN
// catálogo publicado en ocho idiomas, así que ahí se ofrecen todos; el
// japonés y el chino son catálogos propios y ofrecen el suyo y nada más.
const IDIOMA_UNICO_DE_VISTA = { ja: 'ja', zh: 'zh' }

function idiomasDeLaVista() {
  const solo = IDIOMA_UNICO_DE_VISTA[vista]
  if (solo) return IDIOMAS.filter((i) => i.id === solo)
  // El chino fuera del catálogo chino no es que no se ofrezca por gusto:
  // una carta china no está en el catálogo occidental, así que no hay
  // ninguna a la que ponerle esa etiqueta.
  return IDIOMAS.filter((i) => i.id !== 'zh')
}

// El idioma por defecto es EL DE LA VISTA. Los cuatro identificadores de
// vista (`es`, `en`, `ja`, `zh`) coinciden a propósito con los de
// `IDIOMAS`: si alguna vez deja de coincidir, el `|| lista[0]` evita que
// se quede sin valor, pero lo que hay que arreglar es la coincidencia.
function idiomaDeLaVista() {
  const lista = idiomasDeLaVista()
  return (lista.find((i) => i.id === vista) || lista[0])?.id
}

// Para EDITAR una línea que ya existe hace falta una lista distinta: la
// que lleva además el idioma que esa línea tiene.
//
// Sin esto, abrir en el catálogo español una carta que apuntaste en
// francés pintaría el desplegable en la primera opción —porque un
// `<select>` cuyo valor no está entre sus opciones se queda con la
// primera— y al guardar le cambiaría el idioma SIN QUE NADIE LO PIDIERA.
// No daría ningún error: diría que tu carta francesa es española.
// Las versiones que se le ofrecen a ESTA línea (tanda 563).
//
// Las de la carta, y encima la que la línea YA tiene aunque la carta no
// la declare: un `<select>` cuyo valor no está entre sus opciones se
// queda con la primera y al guardar escribe esa (tanda 472), así que
// abrir una carta apuntada como «1.ª edición» de un set que TCGdex dice
// que no las tiene se la habría cambiado a «normal» sin que nadie lo
// pidiera. Y lo que no se sabe se ofrece entero: ver `variantes.js`.
// ══════════════════════════════════════════════════════════════════
// AÑADIR, COMO EN TCGGO (tanda 650)
// ══════════════════════════════════════════════════════════════════
//
// PINGU: «yo agrego la primera copia en español y me pone tu copia en
// español, pero después si quiero agregar una copia en inglés voy, cambio
// el idioma, le doy a añadir en el panel de editar y me dice que ahora las
// dos copias son inglesas. Eso está mal». El camino para añadir era el
// formulario de EDITAR la línea que ya tenías, así que cambiar el idioma
// ahí la reescribía. Añadir es otra cosa: una LÍNEA nueva, con su idioma,
// y `datos.anadir` ya lo hacía bien — lo que faltaba era una puerta que
// fuera a `anadir` y no a `actualizar`.
//
// La puerta es el «+» pegado a la carta, que abre este diálogo. Con la
// carta ya en tu colección enseña primero lo que tienes («Ya en tu
// colección», con «Añadir más»); si no, el formulario directamente.
const anadir = { carta: null }

// La carta por su id, esté donde esté: en tu colección (los dos mapas),
// en la expansión abierta o en lo último que devolvió el buscador. Una
// que no tienes no está en `cartas` (la lección de la 418).
function cartaPorId(cardId) {
  return cartas.get(cardId) || cartaDeLineaTodo({ card_id: cardId, market: mercado }) || album.cartas.find((x) => x.id === cardId) || ultimaBusqueda.find((x) => x.id === cardId) || null
}

const misLineasDe = (cardId) => lineas.filter((l) => l.card_id === cardId)

function abrirAnadir(cardId) {
  const c = cartaPorId(cardId)
  if (!c || !sesion || !esMia) return
  anadir.carta = c
  const d = $('mcAnadirDialogo')
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  $('mcAdCarta').innerHTML = escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="eager" />` : ''
  // El set por su NOMBRE: las cartas de una expansión abierta traen de
  // `tcg_sets` solo el código y la serie, así que se busca en la lista.
  const set = c.tcg_sets?.name ? c.tcg_sets : (todosLosSets || []).find((x) => x.id === c.set_id) || c.tcg_sets
  $('mcAdNombre').innerHTML = `Añadiendo <b>${escapeHtml(nombreDe(c))}</b> · ${escapeHtml(nombreDeSet(set) || c.set_id)} ${escapeHtml(c.local_id || '')}`
  const mias = misLineasDe(cardId)
  if (mias.length) {
    $('mcAdYaLista').innerHTML = mias.map((l) => `<div class="mc-ad-ya-linea"><span class="mc-ficha-chapas">${chipsDe(l)}</span><b>${l.cantidad} ${l.cantidad === 1 ? 'copia' : 'copias'}</b></div>`).join('')
  }
  caraDeAnadir(mias.length ? 'ya' : 'form')
  if (!d.open) d.showModal()
}

// Las dos caras del diálogo. El formulario se prepara al pasar a él: con
// el idioma que se recuerda para este catálogo (el del álbum, tanda 461),
// el estado por defecto y la versión de la carta.
function caraDeAnadir(cara) {
  $('mcAdYa').classList.toggle('hidden', cara !== 'ya')
  $('mcAdForm').classList.toggle('hidden', cara !== 'form')
  if (cara !== 'form') return
  const c = anadir.carta
  const idiomas = idiomasDeLaVista()
  const recordado = $('mcTocarIdioma')?.value || idiomaDeLaVista()
  pintarIdiomasDeAnadir(idiomas, idiomas.some((i) => i.id === recordado) ? recordado : idiomas[0]?.id)
  $('mcAdEstado').innerHTML = opciones(ESTADOS, $('mcTocarEstado')?.value || ESTADO_POR_DEFECTO)
  // Las versiones de ESA carta (563): con una sola no hay nada que elegir.
  const vs = variantesParaEditar(c, null)
  $('mcAdVariante').innerHTML = opciones(vs, vs.some((v) => v.id === 'normal') ? 'normal' : vs[0]?.id)
  $('mcAdVarianteLabel').classList.toggle('hidden', vs.length < 2)
  $('mcAdCantidad').value = '1'
  $('mcAdCompra').value = ''
  $('mcAdGuardar').disabled = false
}

// Los idiomas, con su bandera y de un toque: un `<select>` no admite la
// bandera dentro, y es la bandera lo que se reconoce.
function pintarIdiomasDeAnadir(idiomas, puesto) {
  $('mcAdIdiomas').innerHTML = idiomas
    .map((i) => `<button type="button" class="mc-idioma-chip${i.id === puesto ? ' activo' : ''}" role="radio" aria-checked="${i.id === puesto ? 'true' : 'false'}" data-idioma="${escapeHtml(i.id)}">${banderaHtml(i.id)}<span>${escapeHtml(i.nombre)}</span></button>`)
    .join('')
}

const idiomaDeAnadir = () => $('mcAdIdiomas').querySelector('.mc-idioma-chip.activo')?.dataset.idioma || idiomaDeLaVista()

async function guardarAnadir(e) {
  e.preventDefault()
  const c = anadir.carta
  if (!c || !sesion) return
  const boton = $('mcAdGuardar')
  boton.disabled = true
  const linea = {
    card_id: c.id,
    idioma: idiomaDeAnadir(),
    estado: $('mcAdEstado').value,
    variante: $('mcAdVariante').value,
    cantidad: Math.max(1, Math.min(999, Math.round(Number($('mcAdCantidad').value) || 1))),
  }
  // Lo que pagaste, solo si lo has escrito: un cero no es «no lo sé».
  const pagado = Number(String($('mcAdCompra').value || '').replace(',', '.'))
  if (Number.isFinite(pagado) && pagado > 0) linea.precio_compra = pagado
  try {
    const nueva = await datos.anadir(sesion.user.id, linea, mercado)
    meterLinea(nueva, c)
    $('mcAnadirDialogo').close()
    showToast(`${nombreDe(c)} añadida en ${idiomaDe(nueva.idioma).nombre.toLowerCase()}.`, 'success')
    repintar()
    // Y si la ficha de esa carta está abierta, pasa a ser la de la copia
    // que acabas de meter: lo que se acaba de hacer es tener la carta.
    if ($('mcEditor').open && cartaAbierta === c.id) abrirEditor(nueva)
  } catch (err) {
    showToast(err.message, 'error')
    boton.disabled = false
  }
}

// El bloque de precio de la ficha (589), suelto desde la 651 porque se
// pinta dos veces: al abrir, y cuando llega el precio que no estaba.
function pintarPrecioDeFicha(l, c, tuya) {
  const precio = precioDe(l)
  $('mcEdPrecioBloque').innerHTML = bloqueDePrecio(precio, {
    idioma: l.idioma, estado: l.estado, variante: l.variante, nombre: nombreDe(c), tcgplayerId: c?.tp_id_product_propio || null,
    variantes: variantesParaEditar(c, l.variante), rotuloActivo: tuya ? 'tu copia' : 'tu idioma',
  })
  // El resumen de tu copia (645), con los campos plegados: se abre para
  // mirar, y Editar los despliega.
  if (tuya) pintarResumenDeCopia(l, precio)
  return precio
}

// EL PRECIO DE UNA QUE NO TIENES (651). `guardados` son las filas de
// precio de tu colección; de cualquier otra carta no hay nada en memoria,
// y la ficha decía «Sin precio» de una carta que sí lo tiene. Se pide su
// fila (una consulta) y, si tampoco dice nada, TCGdex en vivo; y si la
// ficha sigue en esa carta, se repinta. Una vez por carta y visita.
const preciosPedidos = new Set()
async function completarPrecioDeFicha(l, c, tuya) {
  const id = l.card_id
  if (preciosPedidos.has(id)) return
  preciosPedidos.add(id)
  try {
    if (!guardados.has(id)) {
      const mapa = await datos.preciosGuardados([id])
      for (const [k, v] of mapa) guardados.set(k, v)
    }
    if (!datos.tieneCifras(precioDe(l)) && !vivos.has(id)) {
      const v = await datos.preciosEnVivo(id)
      if (v) vivos.set(id, v)
    }
  } catch {
    return
  }
  if (!$('mcEditor').open || cartaAbierta !== id) return
  // La línea de AHORA: si mientras tanto la has añadido, la ficha ya es
  // la de tu copia y es esa la que se repinta.
  const actual = lineas.find((x) => x.id === $('mcEditor').dataset.linea) || l
  pintarPrecioDeFicha(actual, c, Boolean(actual.id))
}

// Las acciones de la ficha (650): el «+» y, si la tienes, «Tienes N».
function pintarAccionesDeFicha(l) {
  const caja = $('mcEdAcciones')
  if (!caja) return
  caja.classList.toggle('hidden', !esMia || !sesion)
  const n = misLineasDe(l.card_id).reduce((a, x) => a + (Number(x.cantidad) || 0), 0)
  const tienes = $('mcEdTienes')
  tienes.classList.toggle('hidden', n === 0)
  tienes.textContent = n ? `Tienes ${n}` : ''
}

// Tus OTRAS líneas de esta carta, para cambiar la ficha a ellas.
function pintarOtrasCopias(l) {
  const caja = $('mcEdOtrasCopias')
  if (!caja) return
  const otras = misLineasDe(l.card_id).filter((x) => x.id !== l.id)
  caja.classList.toggle('hidden', !otras.length)
  caja.innerHTML = otras.length
    ? `<span class="mc-otras-rotulo">También tienes</span>${otras.map((x) => `<button type="button" class="mc-otra-copia" data-linea-otra="${escapeHtml(x.id)}"><span class="mc-ficha-chapas">${chipsDe(x)}</span><b>×${x.cantidad}</b></button>`).join('')}`
    : ''
}

function variantesParaEditar(carta, variante) {
  const hay = variantesDeCarta(carta, TODAS_LAS_VARIANTES).map((v) => ({ id: v.nuestro, nombre: v.nombre }))
  if (!variante || hay.some((v) => v.id === variante)) return hay
  return [...hay, ...VARIANTES.filter((v) => v.id === variante)]
}

// El gradeo son dos desplegables y un escape (tanda 563). El escape no
// es un adorno: la columna llevaba texto libre desde la 365 y lo que
// haya escrito ahí no se puede tirar ni «corregir» — vuelve tal cual.
function pintarGradeo(guardado) {
  const { casa, nota, libre } = leerGradeo(guardado)
  $('mcEdGradeoCasa').innerHTML = opciones(
    [{ id: '', nombre: 'Sin gradear' }, ...CASAS.map((c) => ({ id: c.id, nombre: c.nombre })), { id: OTRA, nombre: 'Otra' }],
    casa
  )
  $('mcEdGradeo').value = libre
  pintarNotaDeGradeo(casa, nota)
}

// La nota depende de la casa, así que se repinta cada vez que la casa
// cambia. Y el desplegable de notas y el campo libre no son dos maneras
// de lo mismo: solo se enseña UNO, el que la casa elegida pide.
function pintarNotaDeGradeo(casa, nota = '') {
  const notas = notasDeCasa(casa)
  const sel = $('mcEdGradeoNota')
  sel.innerHTML = opciones([{ id: '', nombre: 'Sin nota' }, ...notas.map((n) => ({ id: n, nombre: n }))], nota)
  $('mcEdGradeoNotaLabel').classList.toggle('hidden', !notas.length)
  $('mcEdGradeoLibreLabel').classList.toggle('hidden', casa !== OTRA)
}

function idiomasParaEditar(idioma) {
  const lista = idiomasDeLaVista()
  if (!idioma || lista.some((i) => i.id === idioma)) return lista
  return [...lista, ...IDIOMAS.filter((i) => i.id === idioma)]
}

// Lo que se eligió se recuerda POR CATÁLOGO y no a secas, y esa es justo
// la mitad que faltaba (tanda 461 lo guardó en una clave única). Con una
// sola clave, quien había elegido «español» una vez se lo llevaba al
// catálogo inglés para siempre — que es el fallo que PINGU describe.
const claveDeIdioma = (id) => `${id}-${vista}`
// Las expansiones favoritas. TRES estados y no dos: `null` es «no se
// sabe» —la migración no está puesta—, y entonces ni se pinta el grupo ni
// sale la estrella. Un `new Set()` por defecto diría «no tienes ninguna»,
// que es otra cosa.
let favoritos = null

// Los intercambios (tanda 376). El módulo entra por `import()` la
// primera vez que se abre la pestaña: es la que menos se abre y no
// tiene por qué pesar en la primera visita de nadie.
let cambios = null // el módulo de consultas, cuando llegue
let tablon = null // el módulo que pinta
let deseos = [] // lo que busco
let cambiosCargados = false
// Lo último que devolvieron las dos RPC. Se guarda porque el botón de
// escribir necesita las cartas de ESA persona para redactar el mensaje,
// y volver a pedirlas sería una consulta por clic.
let tablonTiene = []
let tablonBusca = []

// La Pokédex (tanda 381). El módulo entra por `import()` la primera vez
// que se abre: se trae los 1.025 nombres de `sprites-pokemon.js` y no
// tiene por qué pesar en la primera visita de nadie.
let pokedex = null
let totalesPokedex = new Map()
let pdxSoloMios = false
// Dentro de una especie (tanda 577): solo las que me faltan, y en qué
// idioma cuentan mis copias. Se vacían al abrir otra especie, como sus
// filtros.
let pdxSoloFaltan = false
let pdxIdioma = ''
let pokedexCargada = false
let especieAbierta = null

// EN ESPAÑOL se pinta el traducido; en las demás vistas, el de la carta
// (tanda 438). El inglés es además la CLAVE con la que se cruzan las
// decklists y las reimpresiones, así que `name` nunca se toca: lo que
// cambia es cuál de los dos se ENSEÑA.
// Desde la 546 es `nombreDeCarta` quien decide, que es la ÚNICA puerta por
// la que sale un nombre a la pantalla: esta línea no sabía que desde la 537
// hay un nombre occidental, así que la biblioteca japonesa seguía en kanji
// con el dato bueno guardado al lado.
const nombreDe = (c) => nombreDeCarta(c, { enEspanol: laVista().enEspanol }) || 'Carta'

// `porNumero` vive en `mi-coleccion/orden.js` desde la 427, con los otros
// tres órdenes. Estaba aquí, y una constante copiada se separa sin que
// nada lo cante (la lección de la 322): mejor una sola.

function aviso(html) {
  $('mcAviso').innerHTML = html
  $('mcAviso').classList.toggle('hidden', !html)
}

function opciones(lista, activo) {
  return lista.map((o) => `<option value="${escapeHtml(o.id)}"${o.id === activo ? ' selected' : ''}>${escapeHtml(o.nombre)}</option>`).join('')
}

// ── Precios ──
const precioDe = (l) => datos.precioDeLinea(l, guardados, vivos)

// Las cartas sin precio guardado se piden a TCGdex en el momento, con
// un tope: la función programada rellenará el resto en sus pasadas, y
// pedir 500 fichas de golpe a un servicio gratuito no se hace.
const EN_VIVO_POR_VISITA = 40

// «Sin precio guardado» es SIN CIFRAS, no sin fila (tanda 375): la
// función programada guarda fila para toda carta que mira, así que
// mirar solo si la fila existe dejaba fuera para siempre a las que
// aquel día no tenían precio. Son justo las que hay que reintentar.
const SIN_VIVOS = new Map()
const yaSeSabe = (id) => datos.tieneCifras(datos.precioDeLinea({ card_id: id }, guardados, SIN_VIVOS))

async function completarPrecios() {
  // EL CATÁLOGO ELEGIDO PRIMERO Y LO DEMÁS DETRÁS (tanda 485). El Panel
  // suma la colección ENTERA, así que un precio que no se pida deja esa
  // carta en «sin precio» y el total de arriba más bajo del que es. Pero el
  // presupuesto por visita es el mismo, así que el orden importa: lo que
  // está EN PANTALLA se pregunta antes que lo que solo aparece en un total.
  const delCatalogo = lineas.map((l) => l.card_id)
  const faltan = [...new Set([...delCatalogo, ...lineasTodo.map((l) => l.card_id)])]
    .filter((id) => !vivos.has(id) && !yaSeSabe(id))
    .slice(0, EN_VIVO_POR_VISITA)
  let i = 0
  const trabajador = async () => {
    while (i < faltan.length) {
      const id = faltan[i++]
      const v = await datos.preciosEnVivo(id)
      if (v) vivos.set(id, v)
    }
  }
  await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()])
}

// ── El resumen ──
//
// Lo que vale la colección AHORA. Suelto desde la 377 porque lo piden
// DOS sitios: la cifra de arriba y la cabecera de la gráfica del valor.
// Sumarlo dos veces sería la forma más fácil de que un día dijeran
// números distintos de lo mismo en la misma pantalla.
// DE TODA LA COLECCIÓN (tanda 485), y aquí había un desajuste de antes:
// el HISTÓRICO de la gráfica sale de `user_collection_value`, que se filtra
// solo por `user_id` y por tanto YA era de todos los catálogos — mientras
// que este punto, el de «ahora», era del catálogo elegido. Con el japonés
// puesto, la gráfica subía dos años y se caía por un precipicio en el
// último punto. No daba error: daba una gráfica que parecía decir que
// acabas de perder tu colección.
function valorDeAhora() {
  let total = 0
  for (const l of (lineasTodo.length ? lineasTodo : lineas)) total += valorDeLinea(l, precioDe(l)) || 0
  return total
}

// Quién eres y desde cuándo, que es lo que abre el panel de Dex y lo que
// aquí era un título suelto. La fecha sale de TU LÍNEA MÁS ANTIGUA y no de
// cuándo te registraste: dice desde cuándo coleccionas AQUÍ, que es lo que
// significa en esta pantalla, y además no hace falta pedir una columna más.
function pintarHero() {
  const quien = esMia ? 'tu' : dueno?.display_name || dueno?.username || ''
  const av = $('mcHeroAvatar')
  if (av) {
    const perfil = { avatar_url: dueno?.avatar_url || null, display_name: dueno?.display_name, username: dueno?.username }
    av.setAttribute('style', avatarStyle(perfil))
    av.textContent = perfil.avatar_url ? '' : getInitial(dueno?.display_name || dueno?.username || 'P')
  }
  const desde = $('mcHeroDesde')
  if (!desde) return
  // DE TODA LA COLECCIÓN, no del catálogo elegido (tanda 485). Con el
  // japonés puesto y sin cartas japonesas todavía, esto decía «Todavía no
  // has añadido ninguna carta» a alguien con 21.000 — y eso no es un filtro
  // que se note: es la cabecera de la página negando la colección entera.
  // Y la fecha, igual: desde cuándo coleccionas no depende del catálogo que
  // tengas abierto ahora mismo.
  const todo = lineasTodo.length ? lineasTodo : lineas
  if (!todo.length) {
    desde.textContent = esMia ? 'Todavía no has añadido ninguna carta.' : ''
    return
  }
  const primera = todo.reduce((a, b) => (String(a.created_at || '9') <= String(b.created_at || '9') ? a : b))
  const cuando = primera?.created_at ? new Date(primera.created_at) : null
  desde.textContent = cuando && !Number.isNaN(cuando.getTime())
    ? `Coleccionando desde ${cuando.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`
    : ''
  void quien
}

// LAS CUATRO CIFRAS DE ARRIBA SON DE TODA LA COLECCIÓN (tanda 485), no
// del catálogo elegido. Viven en la cabecera, que se ve en las cinco
// pestañas, y lo que dicen es «cuánto tienes» — con el japonés elegido,
// «Cartas: 312» cuando tienes 21.788 no es una cifra filtrada: es una
// cifra FALSA debajo del rótulo «Mi colección».
//
// Lo del catálogo tiene su sitio y ya lo tiene: la estantería de
// Expansiones mide cada colección, y las pestañas de Cartas y Pokédex son
// del catálogo porque ahí es donde se va a MIRAR algo concreto.
function pintarResumen() {
  const todo = lineasTodo.length ? lineasTodo : lineas
  const buscaTodo = lineasTodo.length ? cartaDeLineaTodo : cartaDeLinea
  const claveTodo = lineasTodo.length ? datos.claveDeLineaEnMercado : (l) => l.card_id
  const copias = todo.reduce((s, l) => s + l.cantidad, 0)
  const distintas = new Set(todo.map(claveTodo)).size
  let valor = 0
  let sinPrecio = 0
  let pagado = 0
  let conCompra = 0
  for (const l of todo) {
    const v = valorDeLinea(l, precioDe(l))
    if (v) valor += v
    else sinPrecio += l.cantidad
    if (Number(l.precio_compra) > 0) {
      pagado += Number(l.precio_compra) * l.cantidad
      conCompra += l.cantidad
    }
  }
  // Las colecciones DISTINTAS se cuentan con el mercado delante: el set
  // `sv1a` japonés y el `sv1a` inglés no son la misma colección, y sin el
  // mercado dos estanterías se contarían como una (tanda 485).
  const sets = new Set(todo.map((l) => {
    const c = buscaTodo(l)
    return c?.set_id ? `${c.set_id}|${c.market || l.market || ''}` : null
  }).filter(Boolean)).size
  // Y a mano, para «Mi colección en una imagen» (tanda 571): la imagen
  // dice LAS MISMAS cifras que la cabecera, no otras calculadas aparte.
  resumenHero = { copias, distintas, sets, valor: euros(valor) }
  $('mcResumen').innerHTML = `
    <div class="mc-cifra"><dt>Cartas</dt><dd>${copias.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra"><dt>Distintas</dt><dd>${distintas.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra"><dt>Colecciones</dt><dd>${sets.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra mc-cifra-valor"><dt>Valor</dt><dd>${euros(valor)}</dd><small class="mc-cifra-cambio hidden" id="mcCifraCambio"></small></div>
`
  // Y el cambio del mes, si el histórico ya ha llegado (tanda 582).
  pintarCambioDelMes()
  // AQUÍ VIVÍA «Pagado» (fuera en la 440). Sigue existiendo, pero en su
  // sitio: la tarjeta «Lo que te costó» del panel, que además dice en
  // CUÁNTAS cartas lo has apuntado —que es el dato sin el cual un «Pagado:
  // 20 €» al lado del valor de la colección ENTERA se lee como un balance
  // y no lo es—. En la cabecera eran cinco cifras donde caben cuatro.
  void pagado
  void conCompra
  // Solo lo que hay que saber para leer el número de al lado (tanda 439).
  // La explicación larga de cómo se calcula el valor estaba aquí Y dentro
  // de la diapositiva, dos renglones encima de la primera carta.
  pintarHero()
  // Y LA NOTA DICE DE QUÉ HABLAN LAS CIFRAS (tanda 485). Dos números del
  // mismo sitio con dos alcances distintos —arriba toda la colección, en
  // Expansiones la del catálogo— se leen como una contradicción si nadie
  // lo dice. La frase solo sale cuando hay algo de más de un catálogo, que
  // es cuando la diferencia existe: decírselo a quien solo colecciona
  // occidental sería contarle un problema que no tiene.
  const cuantosCatalogos = new Set(todo.map((l) => l.market || MERCADO_POR_DEFECTO)).size
  const avisos = []
  if (todo.length && sinPrecio) {
    avisos.push(`${sinPrecio} ${sinPrecio === 1 ? 'carta no tiene' : 'cartas no tienen'} precio todavía.`)
  }
  if (cuantosCatalogos > 1) {
    avisos.push('Estas cifras y el Panel son de TODA tu colección; Cartas, Expansiones y Pokédex son del catálogo que tengas elegido.')
  }
  $('mcResumenNota').textContent = avisos.join(' ')
  // Y LA GRÁFICA, QUE TAMBIÉN ENSEÑA ESE NÚMERO (tanda 458). PINGU: «¿cada
  // cuándo se actualiza la barra de los precios? Si yo añado o quito
  // cartas, el gráfico debería subir o bajar».
  //
  // Su último punto es el valor de AHORA, no la foto de las 4:07 — eso ya
  // era así— pero se pintaba una sola vez al abrir el panel, así que
  // añadir una carta movía la cifra de la cabecera y dejaba la gráfica
  // quieta: dos números distintos de lo mismo en la misma pantalla.
  //
  // Repintar no cuesta una consulta: el histórico está en memoria desde la
  // primera vez, y si todavía no ha llegado esta llamada no hace nada —la
  // suya lo pintará con el valor bueno—.
  if (historico) void pintarValorEnElTiempo()
}

// ══════════════════════════════════════════════════════════════════
// La pestaña «Resumen» (tanda 374)
// ══════════════════════════════════════════════════════════════════
//
// Las cuatro cifras de arriba dicen CUÁNTO tienes; esta pestaña dice QUÉ
// tienes. Todo sale de lo que ya está guardado — ni una consulta más.

// ── Meter, cambiar y quitar una línea: EN LAS DOS MEMORIAS (tanda 485) ──
//
// Desde que el Panel se pinta con la colección ENTERA y las otras cuatro
// pestañas con la del catálogo, cada cambio local hay que hacerlo dos
// veces. Había SEIS sitios que hacían `lineas.unshift(...)` a mano; con el
// par nuevo, cada uno de los seis que se olvidara dejaría el Panel
// diciendo lo de antes justo después de añadir una carta — y sin dar
// ningún error, que es el fallo de esta casa.
//
// Por eso van aquí y no a mano: una función que no se puede hacer a medias.
function meterLinea(l, carta = null) {
  for (const lista of [lineas, lineasTodo]) {
    const i = lista.findIndex((x) => x.id === l.id)
    if (i >= 0) lista[i] = l
    else lista.unshift(l)
  }
  if (carta) {
    if (!cartas.has(l.card_id)) cartas.set(l.card_id, carta)
    const k = datos.claveDeLineaEnMercado(l)
    if (!cartasTodo.has(k)) cartasTodo.set(k, { ...carta, market: carta.market || l.market || mercado })
  }
}

function cambiarLinea(id, nueva) {
  lineas = lineas.map((l) => (l.id === id ? nueva : l))
  lineasTodo = lineasTodo.map((l) => (l.id === id ? nueva : l))
}

function quitarLinea(id) {
  lineas = lineas.filter((l) => l.id !== id)
  lineasTodo = lineasTodo.filter((l) => l.id !== id)
}

// ── Las repetidas ──
//
// «tienes 3 · te sobran 2». Es la puerta a los intercambios: sin saber
// qué te sobra no hay nada que ofrecer, y es la pregunta que se hace
// cualquiera que abre una caja de cartas repetidas.
//
// Se cuenta por CARTA y no por línea: tres copias de la misma carta en
// tres estados distintos son tres líneas y una sola carta repetida. Lo
// que sobra es todo menos una.
//
// Y SE AGRUPA POR LA CLAVE DE LA CARTA, no por su id (tanda 485). En el
// Panel, que ahora mira los cuatro catálogos, agrupar por id juntaría la
// Charizard japonesa con la inglesa y las llamaría «repetidas»: son dos
// cartas distintas y para quien colecciona eso no se parece ni de lejos.
// Por eso el agrupador y el mapa usan LA MISMA clave — si fueran dos, una
// diría que tienes dos copias y el otro no encontraría la carta.
function repetidas(ls = lineas, clave = (l) => l.card_id, busca = cartaDeLinea) {
  const porCarta = new Map()
  for (const l of ls) {
    const k = clave(l)
    if (!porCarta.has(k)) porCarta.set(k, { n: 0, linea: l })
    porCarta.get(k).n += l.cantidad
  }
  return [...porCarta.entries()]
    .filter(([, v]) => v.n > 1)
    .map(([k, v]) => ({ carta: busca(v.linea), id: v.linea.card_id, clave: k, tengo: v.n, sobran: v.n - 1 }))
    .sort((a, b) => b.sobran - a.sobran)
}

// ── Lo más valioso ──
//
// Por el valor de UNA copia y no por el de la línea entera: diez cartas
// de un euro no son «lo más valioso que tienes», son diez cartas de un
// euro. Lo que se quiere enseñar es la pieza.
function masValiosas(cuantas = 10, ls = lineas, clave = (l) => l.card_id, busca = cartaDeLinea) {
  const porCarta = new Map()
  for (const l of ls) {
    const v = valorDeLinea(l, precioDe(l))
    if (!v) continue
    const unidad = v / (Number(l.cantidad) || 1)
    const k = clave(l)
    if (unidad > (porCarta.get(k)?.valor || 0)) porCarta.set(k, { valor: unidad, linea: l })
  }
  return [...porCarta.entries()]
    .sort((a, b) => b[1].valor - a[1].valor)
    .slice(0, cuantas)
    .map(([k, v]) => ({ carta: busca(v.linea), id: v.linea.card_id, clave: k, valor: v.valor }))
}

// ── El reparto ──
//
// Cuántas cartas DISTINTAS por serie y por rareza. Distintas y no
// copias: «tengo 40 de Espada y Escudo» se entiende; «tengo 78 contando
// repetidas» no dice nada de la colección.
function repartoPor(saca, ls = lineas, clave = (l) => l.card_id, busca = cartaDeLinea) {
  const cuenta = new Map()
  const vistas = new Map()
  for (const l of ls) if (!vistas.has(clave(l))) vistas.set(clave(l), l)
  for (const l of vistas.values()) {
    const k = saca(busca(l))
    if (!k) continue
    cuenta.set(k, (cuenta.get(k) || 0) + 1)
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1])
}

function barrasHtml(filas) {
  if (!filas.length) return ''
  const mayor = filas[0][1]
  return `<ul class="mc-reparto">${filas
    .map(
      ([nombre, n]) => `<li>
        <span class="mc-reparto-nombre">${escapeHtml(nombre)}</span>
        <span class="mc-barra" aria-hidden="true"><i style="--ancho:${Math.round((n / mayor) * 100)}%"></i></span>
        <span class="mc-reparto-n">${n}</span>
      </li>`
    )
    .join('')}</ul>`
}

function filaDeCartaHtml(c, derecha) {
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  return `<li class="mc-fila-carta">
    <a href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''}>
      <span class="mc-fila-foto">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
      <span class="mc-fila-nombre">${escapeHtml(nombreDe(c))}<small>${escapeHtml(nombreDeSet(c?.tcg_sets))}</small></span>
    </a>
    <span class="mc-fila-dato">${derecha}</span>
  </li>`
}

// ── EL PANEL (tanda 410) ──
//
// PINGU: «el panel está desordenadísimo, lo de los cambios está ahí
// abajo, es demasiado scroll para lo que es. Reordénalo, que tenga
// sentido. Fíjate en Dex: te pone slides con toda la info, y le das a
// ver todo y te saca todas las estadísticas».
//
// Así que el panel son TRES cosas y en este orden: una tira de tarjetas
// que se desliza con lo que se viene a mirar, los cambios —que es lo
// único del panel que pide hacer algo— y, detrás de un botón, las
// estadísticas largas. Lo que antes ocupaba cuatro pantallas de
// desplazamiento ahora cabe en una.
// Y DE TODA LA COLECCIÓN, no del catálogo elegido (tanda 485). Los tres
// ayudantes reciben con qué contar: `pTodo()` devuelve el trío —líneas,
// clave y buscador— de la colección entera, y las otras pestañas siguen
// llamándolos sin argumentos, que es su valor por defecto.
function pTodo() {
  return lineasTodo.length
    ? [lineasTodo, datos.claveDeLineaEnMercado, cartaDeLineaTodo]
    : [lineas, (l) => l.card_id, cartaDeLinea]
}

function pintarResumenPanel() {
  const caja = $('mcResumenPanel')
  if (!caja) return
  const [ls, clave, busca] = pTodo()
  if (!ls.length) {
    // UN ESTADO VACÍO CON UNA ACCIÓN (tanda 581). Era una frase gris; es
    // la primera pantalla de quien se acaba de registrar, y una frase
    // gris no lleva a ninguna parte.
    caja.innerHTML = `<section class="mc-vacio">
      <span class="mc-vacio-icono" aria-hidden="true">${icons.cards(40)}</span>
      <h2 class="mc-vacio-titulo">Tu colección está vacía</h2>
      <p class="mc-vacio-texto">Apunta tus cartas y aquí verás cuántas tienes, cuánto valen y qué te falta de cada expansión.</p>
      <div class="mc-vacio-acciones">
        <a class="btn-primary" href="/mi-coleccion?ver=buscar">Buscar y añadir una carta</a>
        <button type="button" class="btn-secondary mc-importar-abrir">Importar un CSV</button>
      </div>
    </section>`
    return
  }
  const rep = repetidas(ls, clave, busca)
  const sobran = rep.reduce((n, r) => n + r.sobran, 0)
  const valiosas = masValiosas(3, ls, clave, busca)
  const porRareza = repartoPor((c) => rarezaDeCarta(c), ls, clave, busca)

  // Arriba, solo la gráfica: es la ÚNICA cifra que cambia sola y es a
  // lo que se entra (la lección de la 416). Las listas de números van
  // debajo de tus cartas y plegadas, en #mcMasEstadisticas.
  caja.innerHTML = `
    <!-- LA GRÁFICA, A LA VISTA (tanda 416). La 410 la metió detrás de
         «Ver todas las estadísticas» para que el panel no fuera tan
         largo, y PINGU: «¿y dónde está el gráfico de precios? No
         existe». Tenía razón: es la ÚNICA cifra que cambia sola, y es la
         que se viene a mirar. Escondida detrás de un botón, no existe.
         Lo que sigue detrás del botón es lo demás, que son listas. -->
    <section class="mc-resumen-caja mc-valor-caja" id="mcValorCaja">
      <h3>Lo que vale tu colección</h3>
      <div class="skeleton" style="height:120px"></div>
    </section>

`

  const mas = $('mcMasEstadisticas')
  if (mas) {
    mas.innerHTML = `
    <!-- CON LA MISMA CABECERA QUE LOS DEMÁS BLOQUES DEL PANEL (tanda
         451). Era un botón suelto detrás del último vistazo, y PINGU: «el
         botón de ver todas es un enlace pocho». Pegado debajo de la
         tarjeta de Cambios parecía además que era SUYO. Todo lo que hay en
         este panel es una tarjeta con su título y su enlace a la derecha;
         esto también, y así se sabe de qué es el botón sin leerlo entero.

         Y lo largo sigue sin enseñarse hasta que se pide: la gráfica del
         valor es una consulta, y sin abrir esto no se pide. -->
    <section class="mc-vistazo">
      <div class="mc-vistazo-cabecera">
        <h2 class="mc-subtitulo">Estadísticas</h2>
        <button type="button" class="link-btn" id="mcVerTodo" aria-expanded="false" aria-controls="mcEstadisticas">Ver todas</button>
      </div>
    </section>

    <div class="mc-estadisticas hidden" id="mcEstadisticas">
          <div class="mc-diapos">
      ${
        // AQUÍ VIVÍAN «Tu colección» y el total de «Lo que vale» (fuera en
        // la 439). Las cartas, las distintas, las colecciones y el valor ya
        // están en el listón de arriba, que además se ve desde CUALQUIER
        // pestaña: repetirlos aquí era decir cuatro números dos veces y
        // gastar en ello las dos primeras diapositivas, que son las únicas
        // que se ven sin deslizar. Lo que sí añadía la segunda —CUÁLES son
        // las que más valen— se queda, que es lo que no estaba en ningún
        // otro sitio.
        valiosas.length
          ? diapoHtml('Las que más valen', `<ul class="mc-diapo-lista">${valiosas
              .map((v) => `<li><span>${escapeHtml(nombreDe(v.carta))}</span><strong>${escapeHtml(euros(v.valor))}</strong></li>`)
              .join('')}</ul>`)
          : ''
      }
      ${esMia ? diapoDelBalance() : ''}
      ${diapoHtml('Lo que te sobra', `
        <p class="mc-diapo-cifra">${sobran.toLocaleString('es-ES')}</p>
        <p class="mc-diapo-pie">${sobran === 1 ? 'copia repetida' : 'copias repetidas'}${rep.length ? `, de ${rep.length} ${rep.length === 1 ? 'carta' : 'cartas'}` : ''}</p>
        ${
          rep.length
            ? `<ul class="mc-diapo-lista">${rep
                .slice(0, 3)
                .map((r) => `<li><span>${escapeHtml(nombreDe(r.carta))}</span><strong>+${r.sobran}</strong></li>`)
                .join('')}</ul>`
            : '<p class="subtext">No tienes ninguna repetida todavía.</p>'
        }`)}
      ${diapoHtml('Por rareza', porRareza.length
        ? barrasHtml(porRareza.slice(0, 5))
        : '<p class="subtext">Tus cartas todavía no tienen rareza guardada.</p>')}
    </div>
      <div class="mc-resumen-rejilla">
        <section class="mc-resumen-caja">
          <h3>Tus repetidas</h3>
          ${
            rep.length
              // El verbo concuerda también (tanda 485): «Te sobran 1 copia»
              // se leía con una sola repetida, y lo vi en lo que imprimía
              // la prueba al lado de un `ok`.
              ? `<p class="subtext">${sobran === 1 ? 'Te sobra' : 'Te sobran'} <strong>${sobran}</strong> ${sobran === 1 ? 'copia' : 'copias'} de ${rep.length} ${rep.length === 1 ? 'carta' : 'cartas'}. ${sobran === 1 ? 'Es la que puedes' : 'Son las que puedes'} cambiar.</p>
                 <ul class="mc-lista-cartas">${rep.slice(0, 12).map((r) => filaDeCartaHtml(r.carta, `tienes ${r.tengo} · <strong>te sobran ${r.sobran}</strong>`)).join('')}</ul>`
              : '<p class="subtext">No tienes ninguna repetida todavía.</p>'
          }
        </section>
        <section class="mc-resumen-caja">
          <h3>Lo más valioso</h3>
          ${
            masValiosas(10, ls, clave, busca).length
              ? `<ul class="mc-lista-cartas">${masValiosas(10, ls, clave, busca).map((v) => filaDeCartaHtml(v.carta, `<strong>${euros(v.valor)}</strong>`)).join('')}</ul>
                 <p class="subtext">Por lo que vale UNA copia, no la línea entera.</p>`
              : '<p class="subtext">Todavía no sabemos el precio de ninguna de tus cartas.</p>'
          }
        </section>
        <section class="mc-resumen-caja">
          <h3>Por colección</h3>
          ${barrasHtml(repartoPor((c) => nombreDeSet(c?.tcg_sets), ls, clave, busca).slice(0, 10)) || '<p class="subtext">—</p>'}
        </section>
        <section class="mc-resumen-caja">
          <h3>Por rareza</h3>
          ${barrasHtml(porRareza.slice(0, 10)) || '<p class="subtext">Tus cartas todavía no tienen rareza guardada.</p>'}
        </section>
      </div>
    </div>`
  }

  // AQUÍ SE LLAMABA A `engancharTira()` (fuera en la 440): el resumen ya no
  // es una tira. La del álbum tampoco desde la 459, así que la función se
  // ha ido con ella.
  $('mcVerTodo').addEventListener('click', () => {
    const abierto = !$('mcEstadisticas').classList.toggle('hidden')
    $('mcVerTodo').setAttribute('aria-expanded', abierto ? 'true' : 'false')
    $('mcVerTodo').textContent = abierto ? 'Ocultar' : 'Ver todas'
  })
  // La gráfica es una consulta y llega cuando llega: el resto del panel
  // sale de lo que ya está en memoria y no la espera.
  pintarValorEnElTiempo()
}

// Una tarjeta de la tira. Todas iguales por fuera: lo que cambia es lo
// que llevan dentro, y así la tira se lee como una tira y no como cuatro
// cajas distintas puestas en fila.
// ── Lo que te costó (tanda 428) ──
//
// Un balance solo vale sobre las MISMAS cartas en los dos lados. Si se
// compara lo pagado —que solo se sabe de donde lo hayas apuntado— con el
// valor de la colección entera, sale una ganancia inventada.
//
// Y dice SOBRE CUÁNTAS es: «+12,40 €» sin saber si es de tres cartas o de
// trescientas no es un dato, es un número suelto.
function diapoDelBalance() {
  // De toda la colección (tanda 485): «si vas ganando» no es una pregunta
  // sobre un catálogo, y lo que pagaste por una carta japonesa lo pagaste.
  const b = balanceDeCompra(lineasTodo.length ? lineasTodo : lineas, (l) => valorDeLinea(l, precioDe(l)))
  if (!b.hayBalance) {
    return diapoHtml('Lo que te costó', `
      <p class="subtext">Apunta lo que pagaste por una carta —al editarla, «Lo que pagaste»— y aquí te decimos si vas ganando.</p>`)
  }
  // Redondeado a céntimos ANTES de decidir el signo: una diferencia de
  // 0,004 € es «ni ganas ni pierdes», y un «+0,00 €» con el signo puesto
  // se lee como una ganancia que no existe.
  const dif = Math.round(b.diferencia * 100) / 100
  // «en las 1 carta» no lo escribe nadie: con una se dice de otra manera.
  const cuantas = b.copias === 1
    ? 'la única carta en la que apuntaste lo que pagaste'
    : `las ${b.copias.toLocaleString('es-ES')} cartas en las que apuntaste lo que pagaste`
  const clase = dif === 0 ? '' : dif > 0 ? ' mc-gana' : ' mc-pierde'
  // El signo delante, que es lo que lee quien no distingue el verde del
  // rojo: el color nunca va solo.
  const signo = dif === 0 ? '' : dif > 0 ? '+' : '−'
  return diapoHtml('Lo que te costó', `
    <p class="mc-diapo-cifra${clase}">${signo}${escapeHtml(euros(Math.abs(dif)))}</p>
    <p class="mc-diapo-pie">${dif === 0 ? 'ni ganas ni pierdes, ' : ''}en ${escapeHtml(cuantas)}</p>
    <dl class="mc-diapo-datos">
      <div><dt>Pagaste</dt><dd>${escapeHtml(euros(b.pagado))}</dd></div>
      <div><dt>Valen</dt><dd>${escapeHtml(euros(b.valor))}</dd></div>
    </dl>
    ${
      // Las que tienen precio de compra pero no de mercado se dicen, no se
      // cuentan como cero: un cero diría que no valen nada, y lo que pasa
      // es que no se sabe.
      b.sinValorar
        ? `<p class="subtext">${b.sinValorar} ${b.sinValorar === 1 ? 'carta más tiene' : 'cartas más tienen'} precio de compra pero todavía no de mercado, así que ${b.sinValorar === 1 ? 'no entra' : 'no entran'} en la cuenta.</p>`
        : ''
    }`)
}

// `diapoHtml` y `tiraHtml` se mudaron a `js/mi-coleccion/diapos.js` en la
// tanda 476: la Pokédex tenía su propio molde de tarjeta de datos
// (`.mc-pdx-caja`) y dos moldes para el mismo objeto se separan.

// ── Los vistazos del panel (tanda 436) ──
//
// PINGU, con el panel de Dex delante: «que el panel se asemeje más a lo
// que existe en Dex, cogiendo la información de las otras pestañas». Eso
// es lo que son: un asomo de cada pestaña con su «ver todas», para que el
// panel sea una PORTADA de la colección y no una pestaña más.
//
// Lo que ya está en memoria se pinta al momento; lo que son consultas
// —las expansiones y las carpetas— llega después, igual que la gráfica. Y
// se piden una sola vez por visita.
const DE_VISTAZO = 8

// El rótulo del enlace se puede cambiar (tanda 451): «Ver todas» vale
// para cartas y para expansiones, pero debajo de «Cambios» suena a que
// hay una lista de cambios que ver, y lo que hay es una pantalla donde se
// hacen. Un enlace dice a dónde lleva o no sirve de nada.
function vistazoHtml(titulo, pestana, dentro, rotulo = 'Ver todas') {
  return `<section class="mc-vistazo">
    <div class="mc-vistazo-cabecera">
      <h2 class="mc-subtitulo">${escapeHtml(titulo)}</h2>
      <button type="button" class="link-btn" data-ir-a="${escapeHtml(pestana)}">${escapeHtml(rotulo)}</button>
    </div>
    ${dentro}
  </section>`
}

// Las últimas que has metido, que es lo que se quiere ver al entrar: «¿qué
// añadí el otro día?». Por `created_at` y no por nombre — una lista
// alfabética no cambia nunca y deja de decir nada.
// Y DE TODA LA COLECCIÓN (tanda 485): «lo último que añadí» es la pregunta
// que contesta esta tira, y la carta que acabas de meter no deja de ser lo
// último porque ahora estés mirando otro catálogo. Era justo el caso de
// PINGU: añadir una japonesa, volver al Panel y no verla.
function vistazoDeCartas() {
  const [ls, , busca] = pTodo()
  const ultimas = [...ls]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, DE_VISTAZO)
  if (!ultimas.length) {
    return vistazoHtml('Tus cartas', 'cartas', '<p class="empty-state">Todavía no has añadido ninguna carta.</p>')
  }
  const cuerpo = ultimas.map((l) => {
    const c = busca(l)
    const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
    const nombre = nombreDe(c)
    // `data-carta` es lo que hace que se abra la ficha EN LA MISMA PÁGINA
    // (tanda 562): el `href` se queda para el Ctrl+clic, para el «abrir en
    // otra pestaña» del móvil y para cuando no hay JavaScript.
    return `<a class="mc-vistazo-carta" href="${escapeHtml(c ? rutaDeCarta(c) : '#')}"${c ? ` data-carta="${escapeHtml(c.id)}"` : ''} aria-label="${escapeHtml(nombre)}">${
      escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />`
        : `<span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>`
    }</a>`
  }).join('')
  return vistazoHtml('Tus cartas', 'cartas', `<div class="mc-vistazo-cartas">${cuerpo}</div>`)
}

// Las expansiones en las que MÁS llevas. No las más nuevas: lo que se
// quiere ver de un vistazo es dónde estás cerca de algo, que es lo mismo
// que decidió la tanda 429 para la Pokédex.
// AQUÍ VIVIÓ «DÓNDE ESTÁS CERCA», de la tanda 440 a la 441, y se va por
// donde se fueron las dos diapositivas repetidas de la 439: PINGU, al
// verlo puesto, «no tiene sentido porque abajo ya están las expansiones».
// Y es el mismo argumento que se usó para quitar aquellas — una pantalla
// que dice lo mismo dos veces con dos formas distintas no dice más, dice
// lo mismo más largo. El vistazo de «Expansiones» de aquí abajo ya enseña
// por dónde vas en cada colección, con su barra y su cuenta.
//
// Queda escrito el criterio por si vuelve en otra parte: se ordenaba por
// CARTAS QUE FALTAN y no por porcentaje, porque un 96 % de un set de 100
// son 4 cartas y un 80 % de uno de 10 son 2 — el porcentaje dice que vas
// mejor en el primero y la verdad es que acabas antes el segundo.

function vistazoDeSets(sets) {
  const conAlgo = (sets || [])
    .map((s) => {
      // Las de sus hijos cuentan como suyas: si no, el vistazo diría que
      // de una colección plegada tienes menos de las que tienes.
      const suyas = [...cartas.values()].filter((c) => c?.set_id && (padreDeColeccion(c.set_id) || c.set_id) === s.id)
      const tengo = suyas.filter((c) => tengoDe(c.id) > 0).length
      return { set: s, tengo }
    })
    .filter((x) => x.tengo > 0)
    // LAS MÁS NUEVAS PRIMERO (tanda 451), no las que tienes más llenas.
    // PINGU: «¿qué ha pasado con las expansiones? ¿Ya no están las más
    // nuevas? Escarlata y Púrpura se ha ido hacia abajo». Ordenaba por
    // CUÁNTAS TIENES, y eso en un vistazo de una sola fila esconde justo
    // lo que acabas de empezar — que es lo que uno viene a mirar. Y además
    // decía una cosa distinta de la pantalla de Expansiones, que ordena
    // por fecha: dos listas de lo mismo en dos órdenes distintos parecen
    // dos webs.
    //
    // Sin fecha va al final y no al principio: lo que no se sabe no puede
    // ser lo más nuevo.
    .sort((a, b) => {
      const fa = Date.parse(a.set?.release_date || '')
      const fb = Date.parse(b.set?.release_date || '')
      if (Number.isFinite(fa) && Number.isFinite(fb)) return fb - fa
      if (Number.isFinite(fa)) return -1
      if (Number.isFinite(fb)) return 1
      return b.tengo - a.tengo
    })
    // SEIS en el DOM, UNA FILA a la vista. PINGU: «muestra cuatro
    // expansiones y no tiene sentido porque son tres columnas máximo;
    // debería estar mostrando tres, igual que tus cartas».
    //
    // Y por eso no se corta a tres aquí: cuántas caben depende del ancho —
    // tres en un escritorio, una en un móvil—, así que un número fijo deja
    // una huérfana en cualquier otro ancho que no sea el que miraste. Se
    // pide UNA FILA en el CSS y las que sobren caen en filas de alto cero.
    // Es exactamente lo que ya hace «Tus cartas» desde la tanda 446.
    .slice(0, 6)
  if (!conAlgo.length) {
    return vistazoHtml('Expansiones', 'album', '<p class="empty-state">Cuando añadas cartas, aquí verás por dónde vas en cada colección.</p>')
  }
  // «Ver todas» abre la estantería ENTERA (tanda 649; el filtro de «solo
  // las empezadas» se quita al llegar, en el manejador del vistazo).
  // PINGU: «cuando le des a ver todas, que no te lleve a solo las
  // empezadas, que te deje ver todas directamente».
  return vistazoHtml('Expansiones', 'album', `<div class="mc-estanteria mc-vistazo-sets">${conAlgo.map((x) => tarjetaDeSet(x.set, x.tengo)).join('')}</div>`)
}

// La tarjeta de Cambios del Panel: dos cifras y la puerta. Las dos salen
// de lo que YA está cargado —las líneas de tu colección—, así que no
// cuesta ni una consulta: el Panel es lo primero que se abre y no puede
// quedarse esperando a nadie.
// EN CIFRAS, NO EN PROSA (651). PINGU: «actualizar un poco el panel,
// que se ve demasiado texto, poco botón, poco visual». Dos números y la
// puerta; la explicación de cómo se marca una carta para cambiar vive en
// la pantalla de Cambios, que es donde se hace.
function vistazoDeCambios() {
  const doy = loQueDoy().length
  const busco = Array.isArray(deseos) ? deseos.length : null
  const dentro = `<div class="mc-panel-cifras">
    <button type="button" class="mc-panel-cifra" data-ir-a="cambios"><b>${doy}</b><span>${doy === 1 ? 'carta que das' : 'cartas que das'}</span></button>
    ${busco === null ? '' : `<button type="button" class="mc-panel-cifra" data-ir-a="cambios"><b>${busco}</b><span>${busco === 1 ? 'carta que buscas' : 'cartas que buscas'}</span></button>`}
  </div>`
  return vistazoHtml('Cambios', 'cambios', dentro, 'Abrir')
}

// El icono de descargar, aquí y no en js/icons.js: ese fichero lo baja la
// portada, que no tiene sitio (CLAUDE.md), y esto solo lo usa el Panel.
const ICONO_DESCARGAR = (size) => icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>', size)

// LAS ACCIONES DEL PANEL, EN LOSETAS (651): la imagen para compartir,
// importar y exportar eran dos tarjetas con un párrafo cada una y un
// enlace pequeño. Son tres botones; se pintan como tres botones. Los ids
// se quedan (los manejadores y las pruebas cuelgan de ellos).
function vistazoDeAcciones() {
  const hay = lineasTodo.length || lineas.length
  const loseta = (id, dibujo, texto, extra = '') => `<button type="button" class="mc-accion-loseta" id="${id}"${extra}><span class="mc-accion-icono" aria-hidden="true">${dibujo}</span><span>${texto}</span></button>`
  return `<section class="mc-vistazo mc-vistazo-imagen mc-vistazo-importar">
      <div class="mc-vistazo-cabecera">
        <h2 class="mc-subtitulo">Compartir, importar y exportar</h2>
      </div>
      <div class="mc-acciones-rejilla">
        ${hay ? loseta('mcImagenCrear', icons.image(24), 'Mi colección en una imagen') : ''}
        ${loseta('mcImportarAbrir', icons.upload(24), 'Importar un CSV')}
        ${loseta('mcExportar', ICONO_DESCARGAR(24), 'Descargar mi colección (CSV)', hay ? '' : ' disabled')}
      </div>
    </section>`
}

async function pintarVistazos() {
  const caja = $('mcVistazos')
  if (!caja || !esMia) return
  // Lo de memoria, ya. Lo demás, cuando llegue: el panel es lo primero que
  // se abre y no puede quedarse en blanco esperando a dos consultas.
  caja.innerHTML = vistazoDeCartas()
  const sets = await cargarSets().catch(() => null)
  if (pestania !== 'resumen') return
  caja.insertAdjacentHTML('beforeend', vistazoDeSets(sets))
  // LA TARJETA DE CAMBIOS (tanda 451). Lo que estaba debajo —la pantalla
  // entera— se ha ido a la suya; aquí queda lo que el Panel sí tiene que
  // decir: cuántas das, cuántas buscas, y un sitio por donde entrar. Sin
  // esto, una pantalla que existe deja de tener puerta.
  caja.insertAdjacentHTML('beforeend', vistazoDeCambios())
  // MI COLECCIÓN EN UNA IMAGEN (571), IMPORTAR Y EXPORTAR (580): desde la
  // 651 son tres losetas en una tarjeta (`vistazoDeAcciones`). Importar
  // sale siempre: es justo quien NO tiene cartas aquí quien lo necesita.
  if (quiereImportar) {
    // Desde la bienvenida (581): «¿ya la tienes en otra app? Impórtala».
    quiereImportar = false
    setTimeout(() => $('mcImportarAbrir')?.click(), 0)
  }
  caja.insertAdjacentHTML('beforeend', vistazoDeAcciones())
  if (carpetasLista.length) {
    caja.insertAdjacentHTML('beforeend', vistazoHtml('Álbumes', 'carpetas',
      carpetas.rejillaHtml(carpetas.arbolDeCarpetas(carpetasLista), carpetasResumen)))
  }
}

// La gráfica llega DESPUÉS y por su cuenta: el resto del resumen sale de
// lo que ya está en memoria y no tiene por qué esperar a una consulta.
// Se pide una sola vez por visita.
let historico = null

// EN CUÁNTOS DÍAS SE MIRA (tanda 464). PINGU, con Collectr delante:
// «quiero que pongas en cuántos días quieres ver el gráfico». Se recuerda
// en el navegador, como el color de la tapa y la vista de variantes: es
// gusto de quien mira, no un dato de la colección.
let rangoDelValor = 'MAX'
try {
  const guardado = localStorage.getItem('mc-valor-rango')
  if (guardado) rangoDelValor = guardado
} catch {
  // En una ventana privada `localStorage` LANZA, no devuelve null.
}

// «+12,50 € este mes» debajo del valor de la cabecera (tanda 582). La
// gráfica existe desde la 377, pero vive en el Panel; la cabecera —que se
// ve en todas las pestañas— decía el valor de hoy y nada más. Un número
// solo no cuenta nada; el cambio es lo que hace volver a mirar.
function cambioDelMes() {
  if (!historico) return null
  const { resumenDeValor, diasDelRango } = historico.grafica
  const todo = resumenDeValor(historico.filas, { ahora: valorDeAhora() })
  if (!todo.bastante) return null
  const mes = resumenDeValor(diasDelRango(todo.dias, '1M'))
  if (!mes.bastante) return null
  return { cambio: mes.cambio, pct: mes.pct, desde: mes.primero.dia }
}

function textoDelCambio(c) {
  if (!c) return ''
  const signo = c.cambio > 0 ? '+' : c.cambio < 0 ? '−' : ''
  const pct = typeof c.pct === 'number' && Number.isFinite(c.pct) ? ` (${signo}${Math.abs(c.pct).toFixed(1).replace('.', ',')} %)` : ''
  return `${signo}${euros(Math.abs(c.cambio))}${pct} este mes`
}

function pintarCambioDelMes() {
  const sitio = $('mcCifraCambio')
  const c = cambioDelMes()
  if (resumenHero) resumenHero.cambioMes = c ? textoDelCambio(c) : null
  if (!sitio) return
  sitio.textContent = textoDelCambio(c)
  sitio.classList.toggle('hidden', !c)
  sitio.classList.toggle('sube', !!c && c.cambio > 0)
  sitio.classList.toggle('baja', !!c && c.cambio < 0)
}

async function pintarValorEnElTiempo() {
  const caja = $('mcValorCaja')
  if (!caja) return
  try {
    if (!historico) {
      const [grafica, filas] = await Promise.all([
        import('./mi-coleccion/grafica-valor.js'),
        datos.valorHistorico(dueno.id),
      ])
      historico = { grafica, filas }
    }
    // Con el valor de AHORA, que es el mismo que enseña la cifra de
    // arriba: la foto diaria es de las 4:07 y sin esto la pantalla
    // enseñaría dos totales distintos de lo mismo.
    caja.innerHTML = `<h3>Lo que vale tu colección</h3>${historico.grafica.graficaHtml(historico.filas, { ahora: valorDeAhora(), rango: rangoDelValor })}`
    engancharRangosDelValor()
    // Y la lectura al pasar el dedo (653), sobre el lienzo recién pintado.
    historico.grafica.engancharLectura(caja.querySelector('.mc-valor-lienzo'))
    pintarCambioDelMes()
  } catch {
    // Una gráfica que no llega no puede tumbar el resumen: se quita la
    // caja y lo demás sigue ahí.
    caja.remove()
  }
}

// Los botones de rango. Delegado en la CAJA y enganchado una sola vez: la
// gráfica se repinta entera en cada cambio, así que un oyente por botón
// se quedaría colgando de un botón que ya no está.
function engancharRangosDelValor() {
  const caja = $('mcValorCaja')
  if (!caja || caja.dataset.enganchada) return
  caja.dataset.enganchada = '1'
  caja.addEventListener('click', (e2) => {
    const b2 = e2.target.closest('[data-rango]')
    if (!b2 || b2.disabled) return
    rangoDelValor = b2.dataset.rango
    try { localStorage.setItem('mc-valor-rango', rangoDelValor) } catch {}
    void pintarValorEnElTiempo()
  })
}

// ── Pestaña «Cartas» ──
// La carta que la ficha tiene abierta: el histórico llega tarde y no debe
// pintarse encima de otra carta si se pasó de página mientras cargaba.
let cartaAbierta = null

// El resumen de tu copia (645): las chapas, cuántas y cuánto vale.
function pintarResumenDeCopia(l, precio) {
  const chapas = $('mcEdCopiaChapas')
  const vale = $('mcEdCopiaVale')
  if (!chapas || !vale) return
  chapas.innerHTML = chipsDe(l)
  const n = Number(l.cantidad) || 0
  const total = valorDeLinea(l, precio)
  const pagado = Number(l.precio_compra)
  const partes = [`${n} ${n === 1 ? 'copia' : 'copias'}`]
  if (total) partes.push(`${n === 1 ? 'vale' : 'valen'} <b>${euros(total)}</b>${l.valor_manual ? ' (tu valor)' : ''}`)
  if (Number.isFinite(pagado) && pagado > 0) partes.push(`pagaste ${euros(pagado)}`)
  if (l.notas) partes.push('con nota')
  vale.innerHTML = partes.join(' · ')
}

function chipsDe(l) {
  const chips = [idiomaDe(l.idioma).id.toUpperCase(), estadoDe(l.estado).id]
  if (l.variante !== 'normal') chips.push(varianteDe(l.variante).nombre)
  let base = chips.map((c) => `<span class="mc-chip">${escapeHtml(c)}</span>`).join('')
  // La del gradeo va con el COLOR de la casa (tanda 563). PINGU pidió los
  // logos, y un `<option>` no admite imágenes y los logos de PSA, Beckett
  // o CGC son marcas de otros que habría que alojar: lo que sí se puede
  // es que la chapa se reconozca de un vistazo en una lista de 300.
  if (l.gradeo) {
    const casa = leerGradeo(l.gradeo).casa
    base += `<span class="mc-chip mc-chip-gradeo"${casa && casa !== OTRA ? ` data-casa="${escapeHtml(casa)}"` : ''}>${escapeHtml(l.gradeo)}</span>`
  }
  // Y si la das, se ve AQUÍ (tanda 376). El dato se pone en el editor,
  // pero un dato que solo se ve abriendo el editor es un dato que se te
  // olvida que pusiste: en una lista de 300 cartas no sabrías cuáles
  // están a cambio sin abrirlas una a una.
  const doy = Number(l.cambio) || 0
  return base + (doy > 0 ? `<span class="mc-chip mc-chip-cambio">${icons.refreshCw(11)}doy ${doy}</span>` : '')
}

// De dónde sale el número, cuando no sale de donde debería. Un precio
// prestado de la versión normal es MEJOR que un hueco —la carta vale
// eso como poco— pero callarlo sería decir que el reverso vale eso, y
// un reverso suele valer más (tanda 375).
function notaDePrecio(l, precio) {
  if (!precio?.prestado || (l && typeof l.valor_manual === 'number' && l.valor_manual > 0)) return ''
  return ' <span class="mc-nota-precio" title="Cardmarket no publica precio del reverso holográfico de esta carta. Se enseña el de la versión normal, que es el mínimo que vale.">de la normal</span>'
}

// Una carta de la colección: LA CARTA Y YA (tanda 392).
//
// PINGU, enseñando la app de Dex: «me gusta más cómo lo hacen ellos
// porque es solo la imagen, y cuando le clicas te sale un pop-up con
// toda la información».
//
// Y tiene razón por un motivo que no es de gusto: antes cada casilla
// llevaba nombre, set, cuatro chips, el precio, su nota y dos botones.
// Con trescientas cartas eso no es una colección, es una hoja de
// cálculo con fotos — y el escaneo, que es lo único que de verdad
// reconoces de un vistazo, quedaba del tamaño de un sello entre tanto
// texto.
//
// Lo que se enseña encima es solo lo que NO se ve mirando la carta: la
// cantidad (una carta repetida no se distingue de una suelta) y la
// variante, cuando no es la normal (el reverso holo y el normal son la
// misma ilustración). Todo lo demás vive en la ficha, a un toque.
//
// La ficha es el diálogo que ya existía desde la 369 con la foto, el
// nombre, el set, el precio, Cardmarket y los campos. Estaba escondido
// tras un botón «Editar» en cada fila: lo mismo que pedía PINGU, pero
// sin que nadie lo encontrara.
function lineaHtml(l) {
  const c = cartas.get(l.card_id) || cartaDeLineaTodo(l)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  // Solo para la ETIQUETA que lee quien no ve la carta: lo que se PINTA es
  // la chapa de encima (tanda 461), que sale siempre. Aquí se calla cuando
  // es la normal porque decir «Pikachu, Normal» en voz alta no añade nada.
  const variante = l.variante !== 'normal' ? varianteDe(l.variante).nombre : ''
  const brillo = c ? familiaDeBrillo(rarezaCrudaDeCarta(c)) : null
  // La etiqueta la lee quien no ve la carta, así que lleva lo que la
  // imagen dice sin palabras: qué es, de dónde y cuántas.
  const etiqueta = `${nombreDe(c)}${nombreDeSet(c?.tcg_sets) ? `, ${nombreDeSet(c.tcg_sets)}` : ''}${
    variante ? `, ${variante}` : ''
  }${l.cantidad > 1 ? `, ${l.cantidad} copias` : ''}`
  return `
    <article class="mc-carta" data-linea="${escapeHtml(l.id)}">
      <button type="button" class="mc-carta-foto carta-scan-holo"${
        brillo ? ` data-brillo="${brillo}"` : ''
      } data-ficha aria-label="${escapeHtml(etiqueta)}">
        ${
          // EL NOMBRE VA SIEMPRE DEBAJO, y la imagen encima (tanda 441).
          //
          // Antes era un «o esto o lo otro»: con escaneo, la imagen; sin
          // escaneo, el nombre. El caso que faltaba es el de en medio —hay
          // dirección PERO NO RESPONDE—, y es de lejos el más común: la
          // cadena de respaldo se queda sin sitios, el `onerror` quita la
          // imagen y el botón se queda vacío. No es un hueco de cero
          // píxeles (el `aspect-ratio` del botón lo reserva desde la 321),
          // es algo peor de explicar: un rectángulo INVISIBLE que sí se
          // puede pulsar. Y ahora mismo le pasa a cientos de cartas, que
          // es lo que PINGU viene diciendo desde hace tandas.
          //
          // Poniendo el nombre DEBAJO y la imagen ENCIMA no hace falta
          // inventar nada al fallar: basta con que la imagen se quite y
          // debajo aparece el nombre, que es lo que ya se pintaba cuando
          // no había dirección. Cero cadenas montadas dentro de un
          // `onerror` —que con un apellido como «Boss's Orders» es justo
          // donde se rompen las comillas—.
          `<span class="mc-carta-sinfoto">${escapeHtml(nombreDe(c))}${
            c?.local_id ? `<small>${escapeHtml(c.local_id)}</small>` : ''
          }</span>` +
          (escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : '')
        }
        ${veloDeVariante(l.variante)}
        ${l.cantidad > 1 ? `<span class="mc-cantidad">×${l.cantidad}</span>` : ''}
        ${chapaDeVarianteHtml(l.variante)}
      </button>
    </article>`
}

// ── Los filtros de chips (tanda 399) ──
//
// PINGU, enseñando Dex: su panel lleva tipo de carta, energía y rareza en
// chips. Nosotros teníamos tres desplegables y ya no cabían.
//
// Los grupos se arman con lo que hay EN TU colección y no con una lista
// escrita a mano: una lista ofrece rarezas que no tienes y se queda sin
// las que salgan mañana (la lección de la tanda 323). Si de un grupo solo
// sale un valor, el grupo no se pinta: un filtro con una sola opción no
// filtra nada.
const filtros = filtrosVacios()
const GRUPOS = GRUPOS_FILTRO
let ordenElegido = 'valor'
let sentidoElegido = sentidoNatural('valor')

// Las traducciones y los descodificadores que los grupos y los órdenes
// necesitan. Van en un objeto y no sueltos porque `filtros.js` NO importa
// nada del navegador a propósito —así se prueba en Node—, y lo que no
// importa hay que dárselo.
const AYUDAS = {
  categoriaEs, tipoEs, rarezaEs, entrenadorEs, varianteDe, estadoDe,
  carta: (l) => cartas.get(l.card_id),
  nombre: (c) => nombreDe(c),
  valor: (l) => valorDeLinea(l, precioDe(l)) || 0,
  rango: rangoDeRareza,
  porNumero,
}

function valoresDeGrupo(g) {
  const vistos = new Set()
  for (const l of lineas) for (const v of g.de(l, cartas.get(l.card_id), AYUDAS)) if (v) vistos.add(v)
  return [...vistos].sort((a, b) => a.localeCompare(b, 'es'))
}

// La hoja de ordenar, con el elegido marcado. El rótulo del botón de la
// barra se repinta aquí mismo: son la misma información y tenerla en dos
// sitios que se actualizan por separado es cómo se desincronizan.
function pintarHojaOrden() {
  const lista = $('mcOrdenLista')
  if (!lista) return
  lista.innerHTML = ORDENES_COLECCION.map((o) => {
    const elegido = o.id === ordenElegido
    return `<li><button type="button" class="mc-orden-opcion${elegido ? ' elegido' : ''}" data-orden="${escapeHtml(o.id)}" aria-current="${elegido ? 'true' : 'false'}">
      <span class="mc-orden-icono" aria-hidden="true">${icons[o.icono] ? icons[o.icono](18) : ''}</span>
      <span class="mc-orden-nombre">${escapeHtml(o.nombre)}</span>
      <span class="mc-orden-marca" aria-hidden="true">${elegido ? icons.checkCircle(18) : ''}</span>
    </button></li>`
  }).join('')
  for (const b of $('mcHojaOrden').querySelectorAll('[data-sentido]')) {
    const puesto = b.dataset.sentido === sentidoElegido
    b.classList.toggle('elegido', puesto)
    b.setAttribute('aria-checked', puesto ? 'true' : 'false')
  }
  const rotulo = $('mcOrdenRotulo')
  if (rotulo) rotulo.textContent = ORDENES_COLECCION.find((o) => o.id === ordenElegido)?.nombre || 'Ordenar'
  // La flecha dice el sentido sin gastar una palabra, que en una barra que
  // se desliza es sitio que no hay.
  const flecha = $('mcOrdenFlecha')
  if (flecha) flecha.textContent = sentidoElegido === 'desc' ? '↓' : '↑'
}

function pintarGruposDeChips() {
  const hueco = $('mcGruposChips')
  if (!hueco) return
  hueco.innerHTML = GRUPOS.map((g) => {
    const valores = valoresDeGrupo(g)
    if (valores.length < 2) return ''
    return `<div class="mc-grupo-filtro"><h3>${escapeHtml(g.nombre)}</h3><div class="mc-chips-filtro">${valores
      .map((v) => {
        const puesto = filtros[g.id].has(v)
        // La MARCA de la rareza delante del nombre (tanda 463): una rareza
        // se reconoce por su dibujo antes que por su nombre, y es lo que
        // lleva impreso la carta en la esquina — o sea, la forma de
        // comprobar que lo que dice la web es lo que tienes en la mano.
        const marca = g.id === 'rareza' ? marcaDeRarezaHtml(v) : ''
        return `<button type="button" class="mc-chip-filtro${puesto ? ' activo' : ''}" data-grupo="${g.id}" data-valor="${escapeHtml(v)}" aria-pressed="${puesto ? 'true' : 'false'}">${marca}${escapeHtml(v)}</button>`
      })
      .join('')}</div></div>`
  }).join('')
}

// Cuántos filtros hay puestos, para la chapa del botón: sin ella, un
// filtro olvidado parece una colección que ha encogido.
function cuantosFiltros() {
  return GRUPOS.reduce((n, g) => n + filtros[g.id].size, 0) +
    ($('mcFiltroSet')?.value ? 1 : 0) + ($('mcFiltroIdioma')?.value ? 1 : 0)
}

function limpiarFiltros() {
  for (const g of GRUPOS) filtros[g.id].clear()
  $('mcFiltroSet').value = ''
  $('mcFiltroIdioma').value = ''
  pintarGruposDeChips()
  pintarCartas()
  pintarCuentaDeFiltros()
}

function pintarCuentaDeFiltros() {
  const chapa = $('mcFiltrosCuenta')
  if (!chapa) return
  const n = cuantosFiltros()
  chapa.textContent = n ? String(n) : ''
  chapa.classList.toggle('hidden', n === 0)
  // La chapa de quitarlo todo cuenta también el texto buscado: para quien
  // mira, «lo que estoy filtrando» incluye lo que ha escrito.
  $('mcFiltrosQuitar')?.classList.toggle('hidden', n === 0 && !$('mcBuscar')?.value)
}

function lineasFiltradas() {
  const texto = normalizeSearch($('mcBuscar').value)
  const set = $('mcFiltroSet').value
  const idioma = $('mcFiltroIdioma').value
  const filtradas = lineas.filter((l) => {
    const c = cartas.get(l.card_id)
    if (set && c?.set_id !== set) return false
    if (idioma && l.idioma !== idioma) return false
    if (texto && !normalizeSearch(`${nombresDeCartaParaBuscar(c)} ${nombreDeSet(c?.tcg_sets)}`).includes(texto)) return false
    return pasaLosFiltros(l, c, filtros, AYUDAS)
  })
  // El orden vive en `js/mi-coleccion/filtros.js`, sin DOM, para poder
  // probarlo en Node. Y el sentido NO es un `reverse()` de la lista ya
  // ordenada (tanda 449): lo que no se sabe —una carta cuyo ilustrador
  // todavía no ha curado `cartas-detalle`— tiene que quedarse al final
  // MIRE COMO SE MIRE, y un `reverse()` la subiría la primera.
  return ordenarLineas(filtradas, ordenElegido, sentidoElegido, AYUDAS)
}

function pintarCartas() {
  const lista = lineasFiltradas()
  $('mcCartas').innerHTML = lista.map(lineaHtml).join('')
  $('mcCartasVacio').classList.toggle('hidden', lineas.length > 0)
  $('mcFiltros').classList.toggle('hidden', !lineas.length)
  $('mcSinResultados').classList.toggle('hidden', !lineas.length || lista.length > 0)
  pintarCuantas(lista.length)
}

// Cuántas estás viendo (tanda 441). Dice «9 de 12» SOLO cuando hay algo
// filtrado: un «12 de 12» es ruido, y además la cuenta de la colección
// entera ya está en la cabecera. Lo que faltaba era el caso en que la
// rejilla se acorta y nada explica por qué.
function pintarCuantas(cuantas) {
  const caja = $('mcCuantas')
  if (!caja) return
  const total = lineas.length
  caja.textContent = !total
    ? ''
    : cuantas === total
      ? `${total.toLocaleString('es-ES')} ${total === 1 ? 'carta' : 'cartas'}`
      : `${cuantas.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')}`
}

function pintarFiltros() {
  const sets = new Map()
  for (const l of lineas) {
    const c = cartas.get(l.card_id)
    if (c?.set_id) sets.set(c.set_id, nombreDeSet(c.tcg_sets) || c.set_id)
  }
  const actual = $('mcFiltroSet').value
  $('mcFiltroSet').innerHTML = '<option value="">Todas las colecciones</option>' + [...sets].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([id, n]) => `<option value="${escapeHtml(id)}"${id === actual ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')
}

// ── Editar una línea ──
// La ficha de una carta, la tengas o no (tanda 418).
//
// PINGU: «en una expansión, cuando clicas en una carta te lleva a la
// ficha completa, pero debería ser igual que en la Pokédex y en todo lo
// que tenemos en mi colección: que te abra el pop-up con toda la info y
// después un botón para ir a la ficha completa».
//
// Para una carta que no tienes no hay línea que editar, así que se monta
// una de mentira SOLO para pintar —no se guarda nunca— y en vez del
// bloque de «tu copia» sale el de añadirla.
// ── Moverse por la ficha sin cerrarla (tanda 422) ──
//
// El vecindario es la LISTA que estabas mirando cuando abriste la ficha,
// leída del DOM en ese momento. Se lee del DOM a propósito y no de los
// datos: la rejilla ya está filtrada y ordenada por quien mira, así que
// «la siguiente» es la de al lado EN LA PANTALLA y no la siguiente de una
// lista que nadie ve. Y así el mismo mecanismo vale para las tres
// rejillas sin que ninguna tenga que contarle nada.
//
// Guarda IDs y no elementos: entre una flecha y la siguiente la rejilla
// puede repintarse (bajas una copia a cero) y los elementos de antes ya
// no estarían en la página.
let vecindario = null // { modo: 'linea' | 'carta', ids: [], i }

function fijarVecindario(zona, selector, atributo, actual) {
  const ids = [...($(zona)?.querySelectorAll(selector) || [])].map((x) => x.dataset[atributo]).filter(Boolean)
  const i = ids.indexOf(actual)
  vecindario = i < 0 ? null : { modo: atributo === 'linea' ? 'linea' : 'carta', ids, i }
}

async function abrirVecino(paso) {
  if (!vecindario) return
  const i = vecindario.i + paso
  if (i < 0 || i >= vecindario.ids.length) return
  // Lo que estabas escribiendo se guarda ANTES de cambiar de carta. El
  // guardado va con retardo, así que sin esto el temporizador saltaría ya
  // con la ficha de OTRA carta puesta: se perdería lo escrito en esta y
  // se reescribiría la de al lado con sus propios valores.
  await cerrarGuardadoPendiente()
  vecindario.i = i
  const id = vecindario.ids[i]
  if (vecindario.modo === 'linea') {
    const l = lineas.find((x) => x.id === id)
    if (l) abrirEditor(l)
    return
  }
  abrirCarta(id)
}

// El mando de la ficha: dónde estás y si hay a dónde ir. Con UNA sola
// carta detrás no se pinta nada: dos flechas apagadas y un «1 de 1» son
// tres cosas que ocupan sitio para decir que no hay nada que hacer — y
// pasa de verdad, en cuanto el buscador deja una sola carta.
function pintarPasosDeLaFicha() {
  const pasos = $('mcEdPasos')
  if (!pasos) return
  pasos.hidden = !vecindario || vecindario.ids.length < 2
  if (!vecindario) return
  $('mcEdSitio').textContent = `${vecindario.i + 1} de ${vecindario.ids.length}`
  $('mcEdAnterior').disabled = vecindario.i === 0
  $('mcEdSiguiente').disabled = vecindario.i >= vecindario.ids.length - 1
}

function abrirCarta(cardId, carta = null) {
  // La carta puede no estar en `cartas`: ese mapa es el de TU colección,
  // y aquí se abre cualquiera. Se busca donde esté a la vista —la
  // colección abierta o la especie abierta— y se guarda, que es lo que
  // lee todo lo que pinta la ficha.
  // Y en la colección ENTERA (648): desde el Panel se abre lo último que
  // añadiste aunque sea de otro catálogo. Primero la línea del catálogo
  // que miras —dos catálogos pueden compartir id— y si no, la que sea.
  const miaDeTodo = lineasTodo.find((x) => x.card_id === cardId) || null
  const encontrada = carta
    || cartas.get(cardId)
    || album.cartas?.find((x) => x.id === cardId)
    || cartasDeLaEspecie.find((x) => x.id === cardId)
    || ultimaBusqueda.find((x) => x.id === cardId)
    || (miaDeTodo ? cartaDeLineaTodo(miaDeTodo) : null)
  // Al mapa del catálogo solo entra lo que es de ese catálogo: una
  // española metida en el mapa japonés se pintaría como japonesa.
  if (encontrada && !cartas.has(cardId) && (!encontrada.market || encontrada.market === mercado)) cartas.set(cardId, encontrada)
  const mia = lineas.find((x) => x.card_id === cardId) || miaDeTodo
  if (mia) return abrirEditor(mia)
  // El idioma de una carta NUEVA sale del catálogo que miras, no de la
  // primera opción de la lista (tanda 472): en el catálogo japonés
  // `IDIOMAS[0]` es el español, y una carta japonesa en español no existe.
  // La versión y el estado, los de VERDAD (tanda 564): `ESTADOS[0]` es
  // Mint, no Near Mint, así que la ficha de una carta que no tienes
  // enseñaba un estado que no es con el que se iba a añadir; y la versión
  // era «normal» aunque la carta solo exista en holo.
  abrirEditor({ id: null, card_id: cardId, cantidad: 0, idioma: idiomaDeLaVista(), estado: ESTADO_POR_DEFECTO, variante: varianteDeCarta(encontrada) })
}

function abrirEditor(l) {
  // La carta del catálogo que se mira, o la de la colección ENTERA (648):
  // desde el Panel se abre cualquiera de tus cartas, y si estabas mirando
  // el japonés una española no estaba en `cartas` — la ficha salía sin
  // foto, sin precio y sin TCGplayer, sin error. Es el fallo que PINGU
  // describió: «cambio a japonés, vuelvo al panel y deja de cargar todo».
  const c = cartas.get(l.card_id) || cartaDeLineaTodo(l)
  const d = $('mcEditor')
  // Sin `id` es una carta que no tienes: el bloque de tu copia no pinta
  // nada y lo que hace falta es poder añadirla.
  const tuya = Boolean(l.id)
  $('mcEdCopiaBloque')?.classList.toggle('hidden', !tuya)
  pintarAccionesDeFicha(l)
  // Sin cuenta (tanda 649): en el catálogo público, o mirando la
  // colección pública de alguien, la ficha se abre igual — y en vez del
  // botón de añadir dice cómo tener una colección donde añadirla. El
  // `volver` es ESTA página, para que al entrar se siga donde se estaba.
  $('mcEdEntrarBloque')?.classList.toggle('hidden', Boolean(sesion))
  const entrar = $('mcEdEntrar')
  if (entrar && !sesion) entrar.href = `/auth.html?volver=${encodeURIComponent(location.pathname + location.search)}`
  // La carta, a la vista (tanda 369): el escaneo, el nombre y de qué
  // colección es. Antes la ventana solo decía el nombre en un título, y
  // con dos impresiones de la misma carta en la colección no había forma
  // de saber cuál estabas tocando hasta guardar.
  // La imagen de la ficha va en GRANDE (tanda 395). Antes se reutilizaba
  // la miniatura de la rejilla: a 380 px de ancho, una imagen pensada
  // para 140 se ve borrosa, y la carta es justo lo que has venido a
  // mirar. `high` es la misma que usa la ficha de /carta.
  //
  // Y con el holo encima, que es lo que pidió PINGU: la carta se inclina
  // siguiendo al ratón y le corre el brillo por encima. El envoltorio
  // `.carta-scan-holo` y el `data-brillo` son los mismos que allí —si
  // fueran otros, el día que alguien toque el efecto arreglaría una
  // pantalla y dejaría la otra a medias.
  // Esta imagen va `eager` a propósito y no diferida como las de la
  // rejilla: es la carta que ACABAS de pulsar, así que diferirla es
  // retrasar lo único que has pedido. Es la misma excepción que el
  // lightbox, y va escrita en el atributo para que se lea aquí.
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c, null, 'high'))
  const brillo = c ? familiaDeBrillo(rarezaCrudaDeCarta(c)) : null
  $('mcEdFoto').innerHTML = escaneo
    ? `<span class="carta-scan-holo"${brillo ? ` data-brillo="${brillo}"` : ''}><img ${escaneo} alt="" width="600" height="825" decoding="async" loading="eager" /></span>`
    : ''
  // El holo se monta sobre el envoltorio recién pintado. A demanda, como
  // en /carta: con el dedo o con «menos movimiento» puesto no se monta
  // nada, así que tampoco hace falta bajar el módulo.
  const caja = $('mcEdFoto').querySelector('.carta-scan-holo')
  if (caja) import('./carta-holo.js').then(({ montarHolo }) => montarHolo(caja)).catch(() => {})
  $('mcEditorTitulo').textContent = nombreDe(c)
  // El set va ARRIBA del nombre y el número con él, como una miga de pan:
  // «de dónde es» antes que «cómo se llama» (tanda 393).
  $('mcEdSet').textContent = c
    ? `${nombreDeSet(c.tcg_sets)}${c.local_id ? ` · ${c.local_id}` : ''}`
    : l.card_id
  // Las chapas de TU copia, para no tener que leer los desplegables:
  // versión, idioma, estado, gradeo y cuántas das.
  $('mcEdChapas').innerHTML = chipsDe(l)
  $('mcEdChapas').classList.toggle('hidden', tuya)
  // Y la tabla de datos. No es adorno: la rareza, el tipo de energía y el
  // ilustrador son justo por lo que se filtra, así que verlos aquí es lo
  // que enseña qué se puede pedir. Una fila que no se sabe NO se pinta —
  // «Ilustrador: —» ocupa lo mismo que el dato y no dice nada.
  $('mcEdTabla').innerHTML = tablaDeCarta(c)
  // Las carpetas cuelgan de una LÍNEA, así que sin ella no hay nada que
  // enseñar; el «quién la tiene» es de la carta y sí vale siempre.
  if (l.id) pintarCarpetasDeLaFicha(l.id)
  else $('mcEdCarpetasBloque')?.classList.add('hidden')
  pintarQuienLaTiene(l.card_id)
  // La lista lleva además el idioma que ESTA línea tiene, aunque el
  // catálogo de ahora no lo ofrezca: un `<select>` cuyo valor no está
  // entre sus opciones se queda con la primera, y al guardar le cambiaría
  // el idioma a la carta sin que nadie lo pidiera (tanda 472).
  $('mcEdIdioma').innerHTML = opciones(idiomasParaEditar(l.idioma), l.idioma)
  $('mcEdEstado').innerHTML = opciones(ESTADOS, l.estado)
  // Las versiones de ESTA carta y no las cuatro (tanda 563). PINGU:
  // «este Lapras exactamente solo tiene una versión, la holográfica;
  // en el desplegable no debería salir primera edición». Ofrecer una
  // versión que no se ha impreso invita a apuntar una carta que no
  // existe. Cuando no se sabe —la carta sin engordar— se ofrecen todas,
  // que es lo que ya hacía la ficha: ahí la carta la tienes tú en la
  // mano y sabes mejor que nosotros en qué versión está.
  $('mcEdVariante').innerHTML = opciones(variantesParaEditar(c, l.variante), l.variante)
  $('mcEdCantidad').value = l.cantidad
  // `?? 0` y no `|| 0`: son lo mismo hoy, pero el día que la columna no
  // esté (la migración sin ejecutar) `undefined || 0` y `undefined ?? 0`
  // siguen dando 0 — lo que no vale es un `l.cambio` a pelo, que
  // dejaría el campo con «undefined» escrito dentro.
  $('mcEdCambio').value = Number(l.cambio) || 0
  pintarGradeo(l.gradeo)
  $('mcEdValor').value = l.valor_manual ?? ''
  $('mcEdCompra').value = l.precio_compra ?? ''
  $('mcEdNotas').value = l.notas || ''
  pintarNota(l.notas || '')
  // El bloque de precio (589): la cifra de TU idioma, las chapas de los
  // demás, Cardmarket y TCGplayer, y las gradeadas. Un solo módulo para
  // esta ficha y para /carta, así que lo que se ve aquí es lo que se ve allí.
  const precio = pintarPrecioDeFicha(l, c, tuya)
  // Y si no dice nada, se pide (651): los precios guardados se cargan
  // solo para TUS cartas, así que una que no tienes salía «Sin precio»
  // hasta que la añadías. PINGU: «las cartas que no están en tu
  // colección no muestran precio; eso no debería ser así».
  if (!datos.tieneCifras(precio)) void completarPrecioDeFicha(l, c, tuya)
  pintarOtrasCopias(l)
  $('mcEdCopiaCampos')?.classList.add('hidden')
  $('mcEdEditar')?.setAttribute('aria-expanded', 'false')
  // Y el histórico (643): se pide al abrir y se calla si no hay filas.
  // La carta cambia con las flechas, así que cada ficha pide el suyo.
  const historial = $('mcEdHistorial')
  if (historial) {
    historial.classList.add('hidden')
    historial.innerHTML = ''
    const esta = l.card_id
    import('./carta-historial.js')
      .then(({ montarHistorial }) => (d.dataset.linea === String(l.id) || cartaAbierta === esta ? montarHistorial(historial, esta, () => l.idioma) : null))
      .catch(() => {})
    cartaAbierta = esta
  }
  // Y la salida a la ficha entera. Si la carta no está en el catálogo no
  // hay adónde ir, así que el enlace se esconde en vez de llevar a una
  // página rota.
  const ficha = $('mcEdFicha')
  if (c) {
    ficha.href = rutaDeCarta(c)
    ficha.hidden = false
  } else {
    ficha.hidden = true
  }
  d.dataset.linea = l.id
  pintarPasosDeLaFicha()
  // `showModal()` sobre un diálogo YA abierto revienta (InvalidStateError):
  // con las flechas de la 422 se repinta la misma ficha una y otra vez sin
  // cerrarla, así que abrir dejó de ser siempre lo primero que pasa.
  if (!d.open) d.showModal()
  // Y al cambiar de carta, arriba: la ficha es otra, y quedarse a media
  // altura de la anterior deja la carta nueva fuera de la pantalla.
  else d.scrollTop = 0
}

// La tabla de datos de la ficha (tanda 393), con lo mismo que enseña
// Dex. Lo que no se sabe no se pinta: una fila con una raya ocupa igual
// que el dato y no dice nada — y además miente sobre lo que el catálogo
// tiene (la regla de los tres estados, tanda 319).
function tablaDeCarta(c) {
  if (!c) return ''
  const fecha = c.tcg_sets?.release_date
  const filas = [
    ['Tipo', categoriaEs(c.category)],
    ['Energía', Array.isArray(c.types) && c.types.length ? c.types.map(tipoEs).join(', ') : ''],
    ['Rareza', rarezaDeCarta(c)],
    ['Número', c.local_id ? `${c.local_id}${c.tcg_sets?.card_count_official ? ` / ${c.tcg_sets.card_count_official}` : ''}` : ''],
    ['Ilustrador', c.illustrator],
    ['Salida', fecha ? new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
    // El número nacional solo si la carta es de UNA especie: una TAG TEAM
    // lleva dos y «25, 133» no es un número de Pokédex, es una lista.
    ['N.º nacional', Array.isArray(c.dex_ids) && c.dex_ids.length === 1 ? String(c.dex_ids[0]) : ''],
  ]
  return filas
    .filter(([, v]) => v)
    .map(([k, v]) => {
      // La rareza lleva su marca impresa delante: es la que trae la carta
      // en la esquina de abajo, así que con ella la ficha se compara con
      // lo que tienes en la mano sin leer nada.
      const marca = k === 'Rareza' ? marcaDeCartaHtml(c) : ''
      return `<div><dt>${escapeHtml(k)}</dt><dd>${marca}${escapeHtml(String(v))}</dd></div>`
    })
    .join('')
}

// ── Se guarda SOLO (tanda 397) ──
//
// PINGU, comparando con Dex: «quiero que sea automático; que no tengas
// botón de guardar o cancelar o quitar de la colección, todo eso sobra;
// según haces el cambio, que se guarde».
//
// Y tiene razón en algo más que el gusto: con botón de guardar, cerrar
// la ficha de cualquier otra manera —pulsando fuera, con Escape— TIRABA
// lo escrito sin avisar. Ahora no hay nada que perder porque no hay nada
// pendiente.
//
// El retardo es para no mandar una petición por tecla mientras escribes
// una nota. Los desplegables y el contador no esperan: ahí el cambio ya
// está hecho en cuanto sueltas.
let guardadoPendiente = null

// Cerrar lo que estuviera a medias (tanda 422). El guardado va con retardo
// mientras escribes; cambiar de carta tiene que llevárselo por delante
// GUARDÁNDOLO, no descartándolo. Y el temporizador se pone a null al
// saltar: si no, la variable guarda un id ya gastado y esto no sabría
// distinguir «hay algo a medias» de «no hay nada».
async function cerrarGuardadoPendiente() {
  if (!guardadoPendiente) return
  clearTimeout(guardadoPendiente)
  guardadoPendiente = null
  await guardarEditor()
}

function leerEditor() {
  const num = (v) => (String(v).trim() === '' ? null : Math.max(0, Math.round(Number(String(v).replace(',', '.')) * 100) / 100))
  // El cero es legal AQUÍ y solo aquí: significa «ya no la tengo», y es
  // lo que sustituye al botón de quitar. Lo convierte en un borrado
  // `guardarEditor`, no la base.
  const cantidad = Math.max(0, Math.min(999, Math.round(Number($('mcEdCantidad').value) || 0)))
  return {
    idioma: $('mcEdIdioma').value,
    estado: $('mcEdEstado').value,
    variante: $('mcEdVariante').value,
    cantidad,
    gradeo: escribirGradeo($('mcEdGradeoCasa').value, $('mcEdGradeoCasa').value === OTRA ? $('mcEdGradeo').value : $('mcEdGradeoNota').value),
    // No se pueden dar más copias de las que tienes: el tope se recorta
    // aquí Y en la base (`user_collection_cambio`). Aquí para que no dé
    // un error feo; allí porque la API está abierta.
    cambio: Math.max(0, Math.min(cantidad, Math.round(Number($('mcEdCambio').value) || 0))),
    valor_manual: num($('mcEdValor').value),
    precio_compra: num($('mcEdCompra').value),
    notas: $('mcEdNotas').value.trim().slice(0, 280) || null,
  }
}

// La nota, plegada (tanda 405). Tres estados y no dos: sin nota se
// ofrece ponerla, con nota se LEE (y se puede tocar para cambiarla), y
// escribiendo está el campo. Un campo de texto vacío ocupando cinco
// renglones en una ficha que casi nunca lleva nota es el bulto más
// grande de la pantalla.
function pintarNota(texto, abierta = false) {
  const puesta = $('mcEdNotaPuesta')
  const campo = $('mcEdNotaCampo')
  const abrir = $('mcEdNotaAbrir')
  if (!puesta || !campo || !abrir) return
  campo.classList.toggle('hidden', !abierta)
  puesta.classList.toggle('hidden', abierta || !texto)
  abrir.classList.toggle('hidden', abierta || Boolean(texto))
  puesta.textContent = texto
}

async function guardarEditor({ retardo = 0 } = {}) {
  const d = $('mcEditor')
  const id = d.dataset.linea
  if (!id) return
  clearTimeout(guardadoPendiente)
  if (retardo) {
    guardadoPendiente = setTimeout(() => {
      guardadoPendiente = null
      void guardarEditor()
    }, retardo)
    return
  }
  const cambios = leerEditor()
  const aviso = $('mcEdEstadoGuardado')
  try {
    // Cero copias es quitarla. Se pregunta porque no se puede deshacer y
    // porque aquí no hay botón de cancelar: sin la pregunta, un «−» de
    // más en la última copia se lleva la carta y lo que tuviera escrito.
    if (cambios.cantidad === 0) {
      if (!window.confirm('¿Quitar esta carta de tu colección? No se puede deshacer.')) {
        // Se devuelve el campo a lo que había: dejarlo en 0 diría que
        // está quitada cuando no lo está.
        const l = lineas.find((x) => x.id === id)
        $('mcEdCantidad').value = String(l?.cantidad ?? 1)
        return
      }
      await datos.borrar(id)
      quitarLinea(id)
      d.dataset.linea = ''
      d.close()
      showToast('Quitada de tu colección.', 'success')
      repintar()
      return
    }
    const nueva = await datos.actualizar(id, cambios)
    cambiarLinea(id, nueva)
    // Sin toast: saldría uno por cada toque del contador. El aviso vive
    // en la propia ficha y se apaga solo.
    if (aviso) {
      aviso.textContent = 'Guardado'
      aviso.classList.add('visible')
      clearTimeout(aviso.dataset.reloj)
      aviso.dataset.reloj = setTimeout(() => aviso.classList.remove('visible'), 1600)
    }
    // Y las chapas de ARRIBA de esta misma ficha (tanda 563). Existen
    // «para no tener que leer los desplegables», así que una que dice
    // «PSA 10» mientras el desplegable de al lado dice Beckett es lo
    // contrario de para lo que están. Se quedaban con lo que había al
    // abrir desde la 393, y con el gradeo en dos desplegables se ve: lo
    // que acabas de poner es justo lo que la chapa no decía.
    $('mcEdChapas').innerHTML = chipsDe(nueva)
    pintarResumenDeCopia(nueva, precioDe(nueva))
    // Y la rejilla de detrás, al día: si cambias la versión o las
    // copias, la casilla lo dice.
    repintar()
  } catch (err) {
    if (aviso) {
      aviso.textContent = 'No se ha podido guardar'
      aviso.classList.add('visible')
    }
    showToast(err.message, 'error')
  }
}

// ── Pestaña «Álbum» ──
//
// Un archivador de nueve bolsillos: páginas de 3×3, de dos en dos en
// pantalla ancha (como al abrirlo) y de una en una en el móvil.
let album = { set: null, cartas: [], pagina: 0, soloFaltan: false, split: false, vista: 'archivador', idioma: '' }

// ── LAS TRES FORMAS DE VER UNA EXPANSIÓN (tanda 478) ──
//
// PINGU, enumerando la barra de Dex: «un botón que si le das te sale el
// desplegable si lo quieres ver en grid, en lista o en binder».
//
// Y son tres cosas distintas de verdad, no tres tamaños:
//
//   · ARCHIVADOR es lo que había: cada carta en su bolsillo, con su −, su
//     + y sus chapas de versión. Es la de APUNTAR — lo que haces con un
//     sobre recién abierto en la mano.
//   · CUADRÍCULA es la de MIRAR: los escaneos y nada más, el doble por
//     fila, sin un solo mando encima. Es como se repasa un set entero.
//   · LISTA es la de BUSCAR: un renglón por carta con su número, su
//     nombre y cuántas tienes. En un set de 200, leer una columna de
//     nombres es muchísimo más rápido que mirar 200 dibujos.
//
// El icono de cada una no es adorno: es lo único que distingue tres
// renglones de menú que dicen tres palabras parecidas.
const VISTAS_DE_ALBUM = [
  { id: 'archivador', nombre: 'Archivador', icono: 'layers' },
  { id: 'cuadricula', nombre: 'Cuadrícula', icono: 'image' },
  { id: 'lista', nombre: 'Lista', icono: 'alignLeft' },
]
const CLAVE_VISTA_ALBUM = 'mc-album-vista'
// Solo las colecciones de las que tienes algo (tanda 443). Fuera del
// objeto `album` porque no es del álbum abierto, es de la estantería.
let soloEmpezadas = false
let todosLosSets = null
// Las eras colocadas a mano desde /admin (tanda 550). `null` = todavía no
// se han pedido; un mapa vacío = se han pedido y no hay ninguna, que es lo
// normal hasta que PINGU coloque la primera.
let erasAMano = null

// Lo que PINGU haya decidido de las eras de ESTE catálogo. Si la consulta
// falla se sigue sin ellas: la biblioteca se ordena como siempre, que es
// mejor que no pintar nada (y la RLS no da error, devuelve lista vacía).
async function cargarEras() {
  if (erasAMano) return erasAMano
  const { data } = await supabase.from('tcg_eras').select('id,nombre,orden').eq('market', mercado)
  erasAMano = new Map((data || []).map((e) => [e.id, { nombre: e.nombre, orden: e.orden }]))
  return erasAMano
}

async function cargarSets() {
  if (todosLosSets) return todosLosSets
  const { data } = await supabase
    .from('tcg_sets')
    // El logo y la serie viajan desde la tanda 372: la estantería se ve
    // por los logos, y agrupar por serie es lo que hace navegable una
    // lista de 220 colecciones.
    // `orden` y `oculto` son de la 550: una columna que no se pide llega
    // `undefined` y el orden a mano no se usaría, sin dar error (la 523).
    .select('id,market,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,logo_tcggo,symbol_scrydex,symbol_url,release_date,card_count_official,card_count_total,tcg_online_code,orden,oculto,tcggo_id')
    .eq('market', mercado)
    .order('release_date', { ascending: false, nullsFirst: false })
    // Y un desempate (tanda 510): un `order` por fecha a secas deja los
    // sets del MISMO día en el orden que quiera Postgres, que además
    // puede cambiar entre dos cargas de la misma página. Y salen el mismo
    // día más de los que parece: un set principal y su galería de
    // entrenador, o un set y sus promos. `id` no es el orden ideal, pero
    // es ESTABLE, que es lo que hace que la lista no baile.
    .order('id')
    .limit(1000)
  // Un set ESCONDIDO no sale en la biblioteca (tanda 550). Es lo que se
  // usa en vez de borrar: un borrado se lleva por delante las cartas, y
  // con ellas las de la colección de quien las tuviera.
  todosLosSets = (data || []).filter((s) => esDelTCG(s) && !s.oculto)
  return todosLosSets
}

// Cuántas copias tienes de una carta. Con `variante` cuenta solo las de
// esa versión (tanda 383); sin ella, todas — que es lo que mide el
// progreso de una colección, porque un álbum se llena por BOLSILLOS y
// un bolsillo lo llena cualquier versión.
function tengoDe(cardId, variante = null, idioma = null) {
  return lineas
    .filter((l) => l.card_id === cardId && (!variante || (l.variante || 'normal') === variante) && (!idioma || l.idioma === idioma))
    .reduce((s, l) => s + l.cantidad, 0)
}

// Lo que el ÁLBUM cuenta como «la tengo» (tanda 577): en el idioma que
// diga su filtro, o en cualquiera. Es una función aparte y no un
// parámetro por defecto en `tengoDe` para que el filtro del álbum no se
// cuele en el Panel ni en la Pokédex, que cuentan con la de siempre.
const tengoEnAlbum = (cardId, variante = null) => tengoDe(cardId, variante, album.idioma || null)

// ── La estantería (tanda 372) ──
//
// Aquí había un `<select>` con 220 colecciones dentro. PINGU, enseñando
// HoloNook: «en general mejora visualmente todo». Un desplegable es lo
// menos vistoso que hay y, peor, **esconde lo único que engancha de
// coleccionar: cuánto llevas**. Con la lista abierta ves de un vistazo
// dónde te falta poco para completar, que es exactamente lo que hace
// volver al día siguiente.
//
// Dos estados, como en los álbumes soñados: la estantería y el
// archivador abierto. Se parecen a propósito — son la misma idea.
// Las eras que hay en ESTE catálogo, en el desplegable.
//
// EL RÓTULO SALE DE `eraDeSet` (tanda 541): con `serie_name` a secas, una
// era japonesa salía en japonés —o vacía, porque los sets que vienen de
// Scrydex no traen `serie_name`, traen `serie_name_en`—.
function montarDesplegableDeEras(sets, mercado, eras = null) {
  const sel = $('mcEstanteriaSerie')
  if (!sel) return
  // El rótulo que haya puesto PINGU manda sobre el del catálogo (tanda 550).
  const series = [...new Map(sets.filter((s) => s.serie_id)
    .map((s) => [s.serie_id, eras?.get?.(s.serie_id)?.nombre || eraDeSet(s) || s.serie_id])).entries()]
  const firma = `${mercado}|${series.map(([id, n]) => `${id}:${n}`).join(',')}`
  if (sel.dataset.firma === firma) return
  // Lo elegido se conserva si en el catálogo nuevo existe; si no, se vuelve
  // a «todas». Dejar el valor viejo puesto es el fallo de la 472 al revés:
  // un `<select>` cuyo valor no está entre sus opciones se queda con la
  // PRIMERA, y entonces la pantalla dice una cosa y el filtro hace otra.
  const antes = sel.value
  sel.dataset.firma = firma
  sel.innerHTML = '<option value="">Todas las series</option>'
    + series.map(([id, n]) => `<option value="${escapeHtml(id)}">${escapeHtml(n)}</option>`).join('')
  sel.value = series.some(([id]) => id === antes) ? antes : ''
}

// Lo que vale cada expansión y cómo va (646), de `tcg_set_valor`. Si la
// tabla no está, la estantería se pinta igual, sin esas dos cifras.
let variacionDeSets = new Map()
async function cargarValoresDeSets() {
  try {
    const desde = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10)
    const { data } = await supabase.from('tcg_set_valor').select('set_id,dia,valor_cm').eq('market', mercado).gte('dia', desde).order('dia').limit(5000)
    variacionDeSets = variacionSemanal(data || [])
  } catch {
    variacionDeSets = new Map()
  }
}

const fmtEnteroEuros = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' })

async function pintarEstanteria() {
  const sets = await cargarSets()
  // Qué sets son una expansión de TCGGO (646), antes de contar nada: las
  // cartas del hijo se cuentan en el padre.
  registrarEpisodios(sets)
  await cargarValoresDeSets()
  // Cuántas DISTINTAS tienes de cada colección. Distintas y no copias:
  // el progreso de un álbum es cuántos bolsillos has llenado, y tres
  // Charizards llenan uno.
  // ── LA ESTANTERÍA PLIEGA IGUAL QUE EL CATÁLOGO (tanda 535) ──
  //
  // PINGU: «el 30 Classic Collection no tiene logo y debería ir después
  // del 30 Celebration». Y en /cartas ya salía plegado desde la 347 — lo
  // que estaba viendo era ESTA pantalla, que no plegaba nada: las trece
  // colecciones que son parte de otra salían sueltas, sin logo y con el
  // progreso partido en dos barras.
  //
  // Y plegar aquí son DOS cosas, no una: la fila se va, y lo que TIENES de
  // ella tiene que sumarse a la del padre. Si solo se hiciera lo primero,
  // las cartas del hijo desaparecerían del recuento y el álbum diría que
  // tienes menos de las que tienes.
  const cuantas = new Map()
  for (const id of new Set(lineas.map((l) => l.card_id))) {
    const s = cartas.get(id)?.set_id
    if (s) {
      const suyo = padreDeColeccion(s) || s
      cuantas.set(suyo, (cuantas.get(suyo) || 0) + 1)
    }
  }
  // ── EL DESPLEGABLE DE ERAS SE REHACE AL CAMBIAR DE CATÁLOGO (tanda 546) ──
  //
  // PINGU: «el filtro está fatal, debería cambiar al escoger otro idioma;
  // se queda con el español/inglés y al cambiar a japonés el filtro está
  // mal». Y estaba literalmente escrito: `if (sel && !sel.dataset.montado)`
  // montaba las opciones UNA VEZ y no volvía a mirar. Así que en el
  // catálogo japonés el desplegable seguía ofreciendo «Escarlata y Púrpura»
  // y «Espada y Escudo» —eras que ahí no existen—, y elegir una dejaba la
  // estantería vacía sin decir por qué.
  //
  // La firma es el mercado y las eras que hay: cuando cambia, se rehace.
  // Y va ANTES de leer el valor a propósito, que es la otra mitad del
  // fallo: si se rehace después, esta pasada filtra todavía por la era
  // vieja —que en el catálogo nuevo no casa con nada— y el desplegable que
  // se ve ya dice «Todas las series». Dos cosas distintas en pantalla a la
  // vez, y ninguna es la verdad.
  const eras = await cargarEras()
  montarDesplegableDeEras(sets, mercado, eras)
  const texto = normalizeSearch($('mcEstanteriaBuscar')?.value || '').trim()
  const serie = $('mcEstanteriaSerie')?.value || ''
  const cumple = (s) =>
    (!serie || s.serie_id === serie) &&
    (!texto || normalizeSearch(`${s.name} ${nombreDeSet(s)} ${s.id}`).includes(texto)) &&
    // Y la de la 443: con 206 colecciones, de casi todas no tienes
    // ninguna. Esto QUITA esas, que es distinto de ordenarlas —la 409
    // probó a subirlas arriba y con cien empezadas la lista seguía
    // midiendo lo mismo—.
    (!soloEmpezadas || cuantas.has(s.id))

  // Por ERAS, y dentro por año (tanda 409). Antes subían arriba las que
  // tenías empezadas; con cien empezadas eso no es un orden, es una lista
  // igual de larga pero sin fechas. Ahora arriba va solo lo que marcas.
  // En el catálogo se ven TODAS (tanda 649), tengas o no: es el catálogo.
  // Fuera de él, mirando la colección de otro, solo las que tiene.
  const seVe = (s) => modoCatalogo || esMia || cuantas.has(s.id)
  const visibles = plegarHermanos(sets.map((s) => ({ ...s }))).filter((s) => cumple(s) && seVe(s))
  const grupos = gruposDeEstanteria(visibles, favoritos || new Set(), eras)

  $('mcEstanteriaRejilla').innerHTML = grupos
    .map((g) => `<h3 class="mc-estanteria-titulo">${escapeHtml(g.titulo)}</h3>
      <div class="mc-estanteria">${g.sets.map((x) => tarjetaDeSet(x, cuantas.get(x.id) || 0)).join('')}</div>`)
    .join('')
  // `hay` es el total SIN filtrar, y es lo que distingue las dos cosas:
  // sin nada en el catálogo es un estado; con doscientas y cero visibles
  // es que has filtrado de más, y eso se arregla con un botón.
  const totalSinFiltrar = sets.filter(seVe).length
  const filtrado = visibles.length === 0 && totalSinFiltrar > 0
  $('mcAlbumVacio').classList.toggle('hidden', visibles.length > 0 || filtrado)
  $('mcAlbumFiltrado')?.classList.toggle('hidden', !filtrado)
  if (filtrado) {
    $('mcAlbumFiltradoCuantas').textContent =
      `Tienes ${totalSinFiltrar.toLocaleString('es-ES')} ${totalSinFiltrar === 1 ? 'colección' : 'colecciones'} que mirar; estos filtros las esconden todas.`
  }
  // Cuántas estás viendo de cuántas hay. `cumple` ya lleva el filtro
  // dentro, así que el total se cuenta aparte: es el del catálogo, no el
  // de lo que queda después de filtrar.
  const hay = totalSinFiltrar
  const caja = $('mcEstanteriaCuantas')
  if (caja) {
    caja.textContent = !hay
      ? ''
      : visibles.length === hay
        ? `${hay.toLocaleString('es-ES')} ${hay === 1 ? 'colección' : 'colecciones'}`
        : `${visibles.length.toLocaleString('es-ES')} de ${hay.toLocaleString('es-ES')}`
  }
}

// Cuántas cartas tiene una colección. `card_count_official` es la
// numeración impresa («1/198») y es la que cuenta para un álbum; si no
// la sabemos, el total. Si no hay ninguna, no se inventa un porcentaje.
function totalDe(set) {
  return set?.card_count_official || set?.card_count_total || 0
}

// La tarjeta de una expansión (rehecha en la tanda 405).
//
// PINGU: «algunos logos se salen, todos deberían ser del mismo tamaño, y
// podríamos hacer como Dex, que pone una imagen de fondo emborronada y
// el logo en el medio más pequeñito».
//
// El fondo es el PROPIO logo, ampliado y desenfocado. No hace falta
// pedir el arte de una carta del set —serían doscientas peticiones más—
// y el resultado es el mismo lavado de color, con una imagen que el
// navegador ya tiene en la caché porque la enseña encima.
//
// Y el logo, con el alto Y el ancho topados: antes solo tenía alto, así
// que los logos anchos —Roaring Skies, Primal Clash— se salían de la
// tarjeta. Un `max-height` no contiene nada a lo ancho.
function tarjetaDeSet(set, tengo) {
  const total = totalDe(set)
  const pct = total ? Math.round((tengo / total) * 100) : 0
  // DÓNDE SE BUSCA EL DIBUJO (tanda 415). PINGU: «hay expansiones que no
  // tienen logo; no sé de dónde los estáis sacando, pero hay un montón
  // que no salen».
  //
  // El logo sale de TCGdex y hay sets a los que sencillamente no se lo
  // han puesto —los más nuevos y los de promos—. Pero la misma fila
  // guarda el SÍMBOLO del set, que estaba ahí sin usarse desde que se
  // importa: es más pequeño y más feo que un logo, pero es el dibujo de
  // esa colección y es mejor que un cuadro vacío.
  //
  // Y si tampoco está, el NOMBRE, pintado en la cabecera. Lo importante
  // es que la cadena no pueda acabar en nada: una tarjeta sin dibujo y
  // sin nombre no dice qué colección es.
  const logo = urlDeLogo(set.logo_path, set.market || mercado)
  // Y si no hay, la ruta montada a mano (tanda 434): TCGdex tiene logos en
  // su CDN que su manifiesto no lista, y la ruta es `serie/set/logo`. De
  // los 41 sets sin dibujo, el curador de la 380 ya pasó por 37 y volvió
  // vacío —o sea que la API no lo da—, pero el fichero puede estar igual.
  // Si no está, la cadena sigue al símbolo y acaba en el nombre.
  const logoAMano = set.logo_path ? null : urlDeLogoPorPartes(set.serie_id, set.id, set.market || mercado)
  // Y EL OCCIDENTAL COMO ÚLTIMO DIBUJO (tanda 454). PINGU: «no hay fotos
  // de los sets japoneses, chinos ni de los demás idiomas que no sean
  // inglés». TCGdex guarda los ficheros por idioma, y de los catálogos que
  // no son el inglés faltan muchísimos; pero el identificador de set es EL
  // MISMO —por eso la clave ajena de `tcg_cards` es compuesta—, así que la
  // misma dirección con `/en/` delante suele existir.
  //
  // Es un logo en inglés sobre una colección japonesa, sí. Pero el dibujo
  // de un logo es el mismo y lo que cambia es el rótulo, así que se
  // reconoce igual — y la alternativa de hoy no es un logo japonés: es el
  // nombre escrito en una caja gris. Va el ÚLTIMO de los logos y antes del
  // símbolo, que es el orden de «lo más suyo primero».
  const suMercado = set.market || mercado
  const logoIngles = suMercado === 'WEST' ? null : urlDeLogoPorPartes(set.serie_id, set.id, 'WEST')
  const simbolo = set.symbol_url ? `${set.symbol_url}.webp` : null
  // SCRYDEX VA PRIMERO (tanda 507). Es de pago y tiene los logos que a
  // TCGdex le faltan, así que manda — pero la cadena de TCGdex se queda
  // DETRÁS y no se borra: un respaldo que vive en el mismo sitio no es un
  // respaldo (tanda 321), y el día que su CDN no conteste se sigue viendo
  // algo. Su URL va entera y sin extensión, que es como la publican.
  // El de TCGGO (589) detrás del de Scrydex y delante del montado a mano.
  const dibujos = [set.logo_scrydex, set.logo_tcggo, logo, logoAMano, logoIngles, set.symbol_scrydex, simbolo].filter(Boolean)
  const completo = total && tengo >= total
  // Sin código de TCG Live, el identificador en mayúsculas (649; lo hacía
  // el /cartas viejo): una tarjeta sin chapa descuadra la fila y el
  // identificador es lo que la gente escribe cuando no hay código. Los
  // que creó TCGGO (`tcggo-123`) no dicen nada a nadie y van sin ella.
  const codigo = set.tcg_online_code || (/^tcggo-/i.test(String(set.id)) ? '' : String(set.id).toUpperCase().slice(0, 6))
  // EL NOMBRE, SIEMPRE A LA VISTA (tanda 458), y el logo a un lado.
  //
  // Hasta ahora el logo ocupaba la tarjeta entera y el nombre se escondía
  // detrás de él, porque un logo occidental LLEVA SU NOMBRE ESCRITO. PINGU,
  // con los sets japoneses ya cargados: «si no viene el nombre y solo viene
  // el logo va a ser muy complicado saber qué set es». Y tiene razón dos
  // veces: un logo japonés está en kanji, y un set sin logo se quedaba
  // enseñando solo una caja.
  //
  // Así que el reparto de Dex, que resuelve las dos: el logo pequeño a la
  // IZQUIERDA sobre su propio arte desenfocado, y a la derecha el nombre,
  // la fecha y el progreso como TEXTO. El nombre ya no depende de que haya
  // dibujo ni de en qué idioma esté escrito.
  const fecha = set.release_date
    ? new Date(set.release_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  return `
    <button type="button" class="mc-set-tarjeta${completo ? ' completo' : ''}" data-set="${escapeHtml(set.id)}">
      <span class="mc-set-mini">
        ${dibujos.length ? `<span class="mc-set-arte" style="--arte:url('${escapeHtml(dibujos[0])}')" aria-hidden="true"></span>` : ''}
        <span class="mc-set-logo">${
          dibujos.length ? `<img ${atributosDeEscaneo(dibujos)} alt="" loading="lazy" />` : ''
        }</span>
      </span>
      <span class="mc-set-info">
        <!-- El código arriba a la derecha y en línea con el nombre, como en
             Dex: es una etiqueta de la colección, no un dato más del pie. -->
        <span class="mc-set-titulo">
          <span class="mc-set-nombre">${escapeHtml(nombreDeSet(set) || set.id)}</span>
          ${codigo ? `<span class="mc-set-codigo">${escapeHtml(codigo)}</span>` : ''}
        </span>
        ${fecha ? `<span class="mc-set-sub">${escapeHtml(fecha)}</span>` : ''}
        ${
          total
            // La cuenta y la barra en la MISMA línea (como en el móvil de
            // Dex): apiladas gastaban dos renglones para decir una cosa, y
            // en una tarjeta de 88 px eso es la mitad del alto.
            ? `<span class="mc-set-progreso">
                 <span class="mc-set-cuenta">${tengo} de ${total}${completo ? ' · completa' : ''}</span>
                 <span class="mc-barra" aria-hidden="true"><i style="--ancho:${pct}%"></i></span>
               </span>`
            : '<span class="mc-set-cuenta">Sin numeración</span>'
        }
        ${valorDeSetHtml(set)}
      </span>
    </button>`
}

// Lo que vale la expansión y cómo va la semana (646): solo si TCGGO lo
// ha dicho. Sin fila, nada — una raya ocupa lo mismo y no dice nada.
function valorDeSetHtml(set) {
  const v = variacionDeSets.get(set?.id)
  if (!v?.ahora) return ''
  const semanal = v.pct === null ? '' : ` · <b class="${v.pct > 0 ? 'sube' : v.pct < 0 ? 'baja' : 'igual'}">${v.pct > 0 ? '+' : ''}${v.pct} %</b>`
  return `<span class="mc-set-valor" title="Lo que vale la expansión entera: la suma de sus mínimos en Cardmarket">${escapeHtml(fmtEnteroEuros.format(v.ahora))} €${semanal}</span>`
}

// EL RESPALDO DEL NOMBRE YA NO HACE FALTA (tanda 458) y por eso se queda
// en nada. Existía porque el nombre iba en `sr-only` —el logo lo llevaba
// escrito— y el día que la CDN se cayó entera (2026-09-20) las tarjetas se
// quedaron sin NADA que leer. Ahora el nombre está siempre a la vista, así
// que la caída de la CDN deja una tarjeta sin dibujo y con su nombre, que
// es justo lo que aquel parche conseguía a la brava.
//
// Lo que SÍ se hace es quitar la imagen rota: la cadena ya ha probado
// todos sus sitios y un hueco con el icono roto del navegador se lee como
// un fallo. El `error` de una imagen no burbujea, así que se escucha en
// captura.
function respaldarNombresDeSet(zona) {
  zona.addEventListener('error', (e) => {
    const img = e.target
    if (!img.matches?.('.mc-set-logo img')) return
    // Si a la cadena le quedan sitios donde mirar, aquí no se hace nada:
    // su propio `onerror` cambia el `src` y lo vuelve a intentar.
    if ((img.dataset.respaldos || '').trim()) return
    img.remove()
  }, true)
}

// La estrella del archivador (tanda 409). Solo sale si es TU colección y
// si la migración está puesta: sin ella, `favoritos` es `null` y marcar
// no guardaría nada — un botón que no hace nada es peor que ninguno.
function pintarEstrella() {
  const b = $('mcAlbumFavorito')
  if (!b) return
  const puede = esMia && favoritos instanceof Set && Boolean(album.set)
  b.classList.toggle('hidden', !puede)
  if (!puede) return
  const marcada = favoritos.has(album.set)
  b.classList.toggle('activa', marcada)
  b.setAttribute('aria-pressed', marcada ? 'true' : 'false')
  // Desde la 475 es una opción del menú de ⋮ y SÍ lleva rótulo, así que
  // lo que dice qué hace es el texto. El `title` y el `aria-label` se
  // quedan por si acaso, pero el que se lee es el de dentro: un icono
  // suelto cuyo globo hay que esperar es justo lo que PINGU no quería.
  const dice = marcada ? 'Quitar de favoritas' : 'Marcar como favorita'
  const texto = $('mcAlbumFavoritoTexto')
  if (texto) texto.textContent = dice
  b.title = dice
  b.setAttribute('aria-label', dice)
}

async function cambiarFavorita() {
  if (!(favoritos instanceof Set) || !album.set) return
  const marcada = favoritos.has(album.set)
  // Se pinta antes de guardar: el botón tiene que responder al dedo. Si
  // la base dice que no, se deshace y se avisa.
  if (marcada) favoritos.delete(album.set)
  else favoritos.add(album.set)
  pintarEstrella()
  try {
    await datos.marcarFavorito(sesion.user.id, album.set, !marcada)
  } catch (err) {
    if (marcada) favoritos.add(album.set)
    else favoritos.delete(album.set)
    pintarEstrella()
    aviso(`<p>${escapeHtml(err.message)}</p>`)
  }
}

// ── Abrir y cerrar el archivador ──
function volverALaEstanteria({ push = true } = {}) {
  if (push) irA({ set: null })
  album.set = null
  album.pagina = 0
  $('mcEstanteriaZona').classList.remove('hidden')
  $('mcArchivadorZona').classList.add('hidden')
  pintarEstanteria()
}

async function abrirAlbum(setId, { push = true } = {}) {
  if (push) irA({ ver: 'album', set: setId })
  // Entrar en una expansión empieza SIEMPRE con el modo marcar apagado
  // (tanda 426): lo marcado es de un set concreto y no se ha guardado,
  // así que arrastrarlo a otro sería guardar luego cartas que ya no
  // estás mirando. Va aquí y SOLO aquí: ponerlo también al volver a la
  // estantería era la misma guarda dos veces —el único camino de vuelta a
  // una rejilla pasa por aquí—, y una guarda con red de repuesto no se
  // puede probar, porque quitarla no cambia nada (CLAUDE.md).
  if (marcadas) modoMarcar(false)
  album.set = setId
  album.pagina = 0
  // La estantería se va y sale el archivador (tanda 372). Los dos viven
  // en la misma pestaña, como en los álbumes soñados.
  $('mcEstanteriaZona').classList.add('hidden')
  $('mcArchivadorZona').classList.remove('hidden')
  const set = (todosLosSets || []).find((s) => s.id === setId)
  $('mcAlbumTitulo').textContent = nombreDeSet(set) || ''
  pintarEstrella()
  pintarSoloFaltan()
  // La miga se pinta aquí y no una vez al arrancar: su botón vive dentro
  // del HTML que esta función repinta, y el clic va delegado en la zona
  // (ver `mcArchivadorZona`), así que no hay oyente que volver a colgar.
  $('mcAlbumMigas').innerHTML = migasHtml([{ texto: 'Expansiones', id: 'mcAlbumVolver' }])
  $('mcAlbum').innerHTML = '<p class="subtext">Cargando la colección…</p>'
  try {
    // Una expansión PLEGADA se abre entera (649): la tarjeta dice «1 de
    // 128» contando las dos mitades del 30 aniversario, y abrirla tenía
    // que enseñar solo las 92 del Celebration, con tu Charizard de la
    // Classic en ninguna parte. El orden bloque a bloque lo pone
    // `cartasDelAlbumFiltradas`, que es quien ordena.
    const ids = idsDeColeccion(setId)
    const lista = ids.length > 1 ? await datos.cartasDeSets(ids, mercado) : await datos.cartasDeSet(setId, mercado)
    album.cartas = lista.sort(porNumero)
  } catch (err) {
    $('mcAlbum').innerHTML = `<p class="subtext">${escapeHtml(err.message)}</p>`
    return
  }
  pintarAlbum()
}

// ── El bolsillo del archivador (tanda 368) ──
//
// Hasta hoy el bolsillo era UNA cosa o la OTRA, según un interruptor de
// arriba: o un enlace a la ficha, o un botón que añadía una copia. Y eso
// obligaba a elegir — lo dijo PINGU: «para añadir a la colección, cuando
// estoy en el álbum, debería haber un botoncito en la carta para añadir o
// quitar sin tener que ir a la carta».
//
// Ahora son las dos: el bolsillo entero sigue llevando a la ficha y
// encima lleva su mando de − y +. Por eso es un `div` con un enlace
// ENCIMA en vez de un `<a>` con todo dentro: un `<button>` dentro de un
// `<a>` no es HTML válido y el navegador lo desmonta por su cuenta.
// Una casilla de UNA versión (tanda 398). Misma forma que la de la carta
// entera para que el pliego no baile, pero lo que cuenta y lo que marca
// es solo esa versión.
// Lo que una casilla necesita para poder MARCARSE (tanda 426). Va en los
// dos moldes de bolsillo porque en «separar variantes» cada casilla es una
// versión distinta de la misma carta. Y el estado se pinta AQUÍ y no solo
// al pulsar: la rejilla se repinta entera a cada rato, y una marca que
// vive únicamente en una clase del DOM se pierde en el primer repintado.
// Los atributos van en el ENLACE, que es lo que ya se pulsa, y no en la
// caja de fuera: una caja con `role="button"` que lleva dentro un enlace y
// dos botones son controles anidados, y eso no lo sabe leer nadie. En modo
// marcar, el − y el + se esconden con `display: none` —que además los saca
// del tabulador—, así que cada casilla tiene UN solo destino.
function marcaDeBolsillo(cardId, variante = 'normal') {
  if (!marcadas) return ''
  const clave = claveMarca(cardId, variante)
  return ` data-marca="${escapeHtml(clave)}" role="button" aria-pressed="${marcadas.has(clave) ? 'true' : 'false'}"`
}
const claseMarcada = (cardId, variante = 'normal') =>
  marcadas?.has(claveMarca(cardId, variante)) ? ' marcada' : ''

// ── LA CHAPA DE LA VERSIÓN (tanda 461) ──
//
// PINGU, con la pantalla de una expansión en «separar variantes»: «sale
// Weedle y Weedle, o sea, no pone la diferencia; debería haber una
// tarjetita que ponga Holo o Reverse». Y tenía toda la razón: el rótulo
// EXISTÍA desde la 383 (`.mc-bolsillo-variante`), pero iba en el flujo
// normal DEBAJO de `.mc-bolsillo-enlace`, que está puesto a `inset: 0` y
// cubre el bolsillo entero. O sea que estaba pintado y tapado: dos huecos
// idénticos, y el dato que los distingue debajo de una capa.
//
// Ahora es una chapa ENCIMA de la carta, como en Dex, y sale SIEMPRE —
// también en la normal—: si solo saliera en la rara, la normal se leería
// como «no se sabe» y no como «esta es la normal».
//
// El código corto va dentro y el nombre al lado, que es lo que hace que se
// entienda sin tener que aprenderse las siglas.
function chapaDeVarianteHtml(id) {
  const v = varianteDe(id)
  const corto = CORTO_DE_VARIANTE[v.id] || 'N'
  // El nombre va en su propia caja para que pueda recortarse sin empujar al
  // código: un hijo de flex sin `min-width: 0` no cede, desborda (la 320).
  return `<span class="mc-chapa-variante" data-var="${escapeHtml(v.id)}" aria-hidden="true"><b>${escapeHtml(corto)}</b><span>${escapeHtml(v.nombre)}</span></span>`
}

const CORTO_DE_VARIANTE = { normal: 'N', reverse: 'RH', holo: 'H', primera: '1.ª' }

// EL VELO DEL REVERSE (tanda 461). PINGU: «sé que la carta es la misma
// imagen para las dos; en Dex sí las diferencian, las reverse son como más
// oscuras porque tienen el holográfico en toda la carta; igual meterle un
// filtro más oscuro».
//
// Y es exactamente eso: un reverse holo lleva el brillo en TODO el marco,
// no solo en la ilustración, así que se ve más oscuro y con tornasol. El
// catálogo guarda UN escaneo por carta —el normal—, de modo que sin esto
// las dos casillas son la misma imagen y la chapa es el único dato.
//
// Va como ELEMENTO y no como `::after` del botón: en la pantalla de Cartas
// el botón es `.carta-scan-holo`, que ya se gasta sus dos pseudos en el
// brillo de la rareza (css/carta-holo.css). Dos dueños para el mismo
// pseudo es un apaño que se rompe al tocar cualquiera de los dos.
function veloDeVariante(id) {
  return id === 'reverse' ? '<span class="mc-velo-reverse" aria-hidden="true"></span>' : ''
}

function bolsilloDeVariante(c, v) {
  const n = tengoEnAlbum(c.id, v.nuestro)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const nombre = nombreDe(c)
  const etiqueta = `${nombre} (${c.local_id}), ${v.nombre}${n ? `, tienes ${n}` : ', te falta'}`
  // EL NOMBRE SE PINTA SIEMPRE, DEBAJO (tanda 458), y la imagen encima.
  //
  // Antes el nombre salía solo cuando la cadena de escaneos estaba VACÍA.
  // Pero la cadena casi nunca lo está —desde la 434 se monta una ruta a
  // mano y desde la 435 hay un tercer sitio—, así que el caso normal es
  // otro: la cadena TIENE direcciones y todas fallan. Entonces
  // `atributosDeEscaneo` quita el `<img>` y el bolsillo se quedaba
  // literalmente en blanco. Y un bolsillo vacío ya significa «no la
  // tienes», así que uno LLENO y en blanco dice lo contrario de lo que
  // pasa.
  //
  // Es la lección de la tanda 441 —una carta cuya imagen no responde se
  // queda en un rectángulo invisible— en el sitio donde no se había
  // aplicado. Y con los catálogos japoneses recién cargados es el caso
  // COMÚN y no el raro. Se hace como en los resultados de Buscar: los dos
  // puestos, y el que quede manda.
  const dentro = `
    <span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
    ${veloDeVariante(v.nuestro)}
    <span class="mc-bolsillo-num">${escapeHtml(c.local_id)}</span>
    ${n > 1 ? `<span class="mc-cantidad">×${n}</span>` : ''}
    ${chapaDeVarianteHtml(v.nuestro)}`
  const enlace = `<a class="mc-bolsillo-enlace" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}" aria-label="${escapeHtml(etiqueta)}"${marcaDeBolsillo(c.id, v.nuestro)}>${dentro}</a>`
  // SIN MANDO (tanda 565). PINGU, con Dex delante: «Dex no tiene botón de
  // agregar desde ahí: le das a una, te sale la ficha, y ahí eliges la
  // versión y sumas». La casilla era más botones que carta —dos filas de
  // 44 px en una casilla de 154—, y la carta es justo lo único que se
  // reconoce de un vistazo. Ahora la casilla es la carta, su cuenta y su
  // versión; tocarla abre la ficha, que ya tiene la versión y el contador.
  return `<div class="mc-bolsillo${n ? ' tengo' : ''}${esMia ? claseMarcada(c.id, v.nuestro) : ''}">${enlace}</div>`
}

function bolsilloHtml(c) {
  // En «una por versión» la casilla es de ESA versión: su cuenta, su
  // nombre y sus botones. Sin esto, las cuatro casillas de una carta
  // enseñarían el mismo número y marcarían todas a la vez — cuatro
  // huecos que no se distinguen no son cuatro huecos.
  if (c.__variante) return bolsilloDeVariante(c, c.__variante)
  const n = tengoEnAlbum(c.id)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const nombre = nombreDe(c)
  const etiqueta = `${nombre} (${c.local_id})${n ? `, tienes ${n}` : ', te falta'}`
  // Igual que el bolsillo de arriba (tanda 458): el nombre siempre debajo.
  // Son DOS pintadores de bolsillo —este y el de las variantes— y arreglar
  // uno solo deja medio álbum con el fallo; ni siquiera se nota, porque
  // cuál de los dos te toca depende de si la carta tiene varias versiones.
  const dentro = `
    <span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
    <span class="mc-bolsillo-num">${escapeHtml(c.local_id)}</span>
    ${n > 1 ? `<span class="mc-cantidad">×${n}</span>` : ''}`
  // La marca lleva la versión DE LA CARTA por lo mismo que el «+» (tanda
  // 564): de esta clave sale lo que `guardarMarcadas` escribe en la base,
  // así que marcar veinte ultra raras las guardaba las veinte en «normal».
  const enlace = `<a class="mc-bolsillo-enlace" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}" aria-label="${escapeHtml(etiqueta)}"${marcaDeBolsillo(c.id, varianteDeCarta(c))}>${dentro}</a>`
  // El número de copias vive DENTRO del mando y no suelto en una
  // esquina: así lo que dice cuántas tienes está pegado a lo que lo
  // cambia, y de paso no hay dos chapas peleándose por el mismo sitio.
  // ── Las versiones ya no van en la casilla (tanda 565) ──
  // Iban aquí como botones N / RH desde la 383; ahora se eligen en la
  // ficha, que es donde Dex las pone y donde ya estaban también. La
  // casilla de «juntas» enseña la carta y cuántas tienes de todas sus
  // versiones; la de «separadas» (arriba) lleva la chapa de la suya.
  //
  // Solo si la carta tiene MÁS DE UNA: con una sola sería una casilla
  // que solo se puede marcar de una manera. Y las que se enseñan son
  // las que existen de verdad (`tcg_cards.variants`), no las cuatro
  // siempre: ofrecer «1.ª edición» en una carta de 2024 invita a
  // apuntar algo que no se ha impreso nunca.
  return `<div class="mc-bolsillo${n ? ' tengo' : ''}${esMia ? claseMarcada(c.id, varianteDeCarta(c)) : ''}">${enlace}</div>`
}

// Las opciones de los dos filtros salen de las cartas que hay DE VERDAD
// en esta colección, no de una lista escrita a mano: un set con una
// rareza nueva la trae solo. Es la lección de la 323 — una lista curada
// se queda vieja y el que lo nota es quien busca.
function pintarFiltrosDeAlbum() {
  const opcionesDe = (saca, vacio) => {
    const valores = [...new Set(album.cartas.map(saca).filter(Boolean))].sort((a, b) =>
      String(a).localeCompare(String(b), 'es')
    )
    return `<option value="">${vacio}</option>` +
      valores.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')
  }
  // Solo se repintan si cambió la colección: repintar un `<select>` le
  // borra lo elegido, y eso al filtrar sería insoportable.
  const rareza = $('mcAlbumRareza')
  const tipo = $('mcAlbumTipo')
  // El de ORDEN no depende de la colección, así que se rellena una vez y
  // no se toca al cambiar de set: repintarlo le borraría lo elegido.
  const orden = $('mcAlbumOrden')
  if (orden && !orden.options.length) {
    orden.innerHTML = ORDENES.map((o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.nombre)}</option>`).join('')
  }
  // El idioma en que cuentan tus copias (tanda 577). Los del catálogo que
  // se mira, y «cualquiera» el primero. Se rellena una vez por catálogo.
  const idioma = $('mcAlbumIdioma')
  if (idioma && idioma.dataset.vista !== vista) {
    idioma.innerHTML = '<option value="">Cualquier idioma</option>' + opciones(idiomasDeLaVista(), '')
    idioma.dataset.vista = vista
    album.idioma = ''
  }
  if (rareza.dataset.set !== album.set) {
    rareza.innerHTML = opcionesDe((c) => rarezaDeCarta(c), 'Cualquier rareza')
    tipo.innerHTML = opcionesDe((c) => (c.category ? categoriaEs(c.category) : null), 'Cualquier categoría')
    rareza.dataset.set = album.set
    // Y si la colección no tiene ni rarezas ni categorías guardadas —el
    // engorde todavía no ha llegado— se esconde el GRUPO ENTERO y no solo
    // el desplegable (tanda 473): desde que viven dentro del panel cada uno
    // lleva su rótulo encima, y esconder el desplegable dejaba un «Rareza»
    // suelto sobre nada.
    $('mcAlbumGrupoRareza')?.classList.toggle('hidden', rareza.options.length <= 1)
    $('mcAlbumGrupoTipo')?.classList.toggle('hidden', tipo.options.length <= 1)
  }
}

function cartasDelAlbumFiltradas() {
  // El idioma en que cuentan tus copias se lee AQUÍ, al filtrar, y no en
  // un oyente aparte: así `tengoEnAlbum` lo ve en cuanto cambia (577).
  album.idioma = $('mcAlbumIdioma')?.value || ''
  const rareza = $('mcAlbumRareza').value
  const tipo = $('mcAlbumTipo').value
  // Por nombre O por número (tanda 417): en Dex se busca «por nombre de
  // carta, número o ilustrador», y el número es como se busca una carta
  // dentro de un set — «la 102» —, que es justo lo que no se podía.
  const texto = normalizeSearch($('mcAlbumBuscar')?.value || '').trim()
  const encajan = album.cartas.filter((c) => {
    if (album.soloFaltan && tengoEnAlbum(c.id)) return false
    if (rareza && rarezaDeCarta(c) !== rareza) return false
    if (tipo && (!c.category || categoriaEs(c.category) !== tipo)) return false
    if (texto && !normalizeSearch(`${nombreDe(c)} ${c.local_id || ''}`).includes(texto)) return false
    return true
  })
  // El orden va DESPUÉS de filtrar y sobre una copia: `album.cartas` es la
  // lista buena del set, y ordenarla en el sitio dejaría «por número»
  // dependiendo de lo último que hubieras elegido.
  const orden = $('mcAlbumOrden')?.value || 'numero'
  const ordenadas = ordenar(encajan, orden, { tengo: tengoDe, nombre: nombreDe })
  // Una expansión PLEGADA por número va BLOQUE a bloque (649): el 001 de
  // la Classic no se cuela entre el 001 y el 002 del Celebration. Solo en
  // «por número», que es el orden del set; los demás son de la carta.
  const ids = idsDeColeccion(album.set)
  if (orden !== 'numero' || ids.length < 2) return ordenadas
  const bloque = (c) => Math.max(0, ids.indexOf(String(c.set_id || '').toLowerCase()))
  return ordenadas.sort((a, b) => bloque(a) - bloque(b))
}

// Cómo están las variantes, en UN solo botón (tanda 473).
//
// Eran dos chapas y una de las dos estaba siempre de adorno. PINGU: «el
// botón de juntar variantes y separar variantes que sea solamente uno».
//
// El rótulo dice cómo están AHORA, no lo que pasa al pulsarlo: un control
// que guarda un estado tiene que decir el estado, o hay que pulsarlo para
// saber qué tenías puesto (la lección de la 449 con el botón de ordenar).
// Y `aria-pressed` además de la clase, porque para quien no ve el color la
// clase no dice nada.
// El rótulo del botón dice la vista PUESTA, y el menú marca cuál es
// (tanda 478). Las dos cosas: el rótulo para quien mira la barra, el
// `aria-checked` para quien abre el menú y para quien no ve el color.
function pintarVistaDeAlbum() {
  const actual = VISTAS_DE_ALBUM.find((v) => v.id === album.vista) || VISTAS_DE_ALBUM[0]
  const rotulo = $('mcAlbumVistaRotulo')
  if (rotulo) rotulo.textContent = actual.nombre
  const boton = $('mcAlbumVista')
  if (boton) boton.setAttribute('aria-label', `Cómo se ven las cartas: ${actual.nombre}`)
  for (const b of document.querySelectorAll('#mcAlbumVistaMenu [data-vista]')) {
    const suya = b.dataset.vista === actual.id
    b.setAttribute('aria-checked', suya ? 'true' : 'false')
    b.classList.toggle('activo', suya)
  }
}

function pintarVistaVariantes() {
  const b = $('mcVistaVariantes')
  if (!b) return
  b.classList.toggle('activo', album.split)
  b.setAttribute('aria-pressed', album.split ? 'true' : 'false')
  const rotulo = $('mcVistaVariantesRotulo')
  if (rotulo) rotulo.textContent = album.split ? 'Variantes separadas' : 'Variantes juntas'
}

// ── La cuenta del botón «Filtros» (tanda 473) ──
//
// Sin ella, un filtro olvidado parece una colección que ha encogido — y
// dentro de un panel que hay que abrir para mirar, eso pasa el doble.
// Misma pieza que la de la pestaña «Cartas» (`cuantosFiltros`).
function cuantosFiltrosDeAlbum() {
  return ($('mcAlbumRareza')?.value ? 1 : 0) +
    ($('mcAlbumTipo')?.value ? 1 : 0) +
    (album.soloFaltan ? 1 : 0) +
    (album.idioma ? 1 : 0) +
    // El orden cuenta solo si NO es el de siempre: «por número» es como
    // viene una expansión, y marcarlo como filtro puesto diría que has
    // tocado algo cuando no.
    ($('mcAlbumOrden')?.value && $('mcAlbumOrden').value !== 'numero' ? 1 : 0)
}

function pintarCuentaDeFiltrosDeAlbum() {
  const chapa = $('mcAlbumFiltrosCuenta')
  if (!chapa) return
  const n = cuantosFiltrosDeAlbum()
  chapa.textContent = n ? String(n) : ''
  chapa.classList.toggle('hidden', n === 0)
  // La chapa de quitarlo todo cuenta también el texto buscado: para quien
  // mira, «lo que estoy filtrando» incluye lo que ha escrito.
  $('mcAlbumQuitar')?.classList.toggle('hidden', n === 0 && !$('mcAlbumBuscar')?.value)
}

function limpiarFiltrosDeAlbum() {
  if ($('mcAlbumRareza')) $('mcAlbumRareza').value = ''
  if ($('mcAlbumTipo')) $('mcAlbumTipo').value = ''
  if ($('mcAlbumOrden')) $('mcAlbumOrden').value = 'numero'
  if ($('mcAlbumIdioma')) $('mcAlbumIdioma').value = ''
  album.idioma = ''
  album.soloFaltan = false
  album.pagina = 0
  pintarSoloFaltan()
  pintarAlbum()
}

// La chapa de «solo las que me faltan» se pone a lo que DIGA el estado y
// no al revés (tanda 459). Cambiar de catálogo vacía `album` entero, así
// que el filtro se apaga sin que nadie toque la chapa: si no se pintara,
// se quedaría encendida enseñando la colección completa.
function pintarSoloFaltan() {
  const b = $('mcAlbumSoloFaltan')
  if (!b) return
  b.classList.toggle('activo', album.soloFaltan)
  b.setAttribute('aria-pressed', album.soloFaltan ? 'true' : 'false')
}

// La CUADRÍCULA: el escaneo y nada más. Sin mandos a propósito — si
// quieres apuntar, la vista de apuntar es el archivador; aquí lo que se
// quiere es ver el set. El nombre se queda de respaldo para la carta sin
// escaneo (la lección de la 415: un hueco en blanco se lee como un fallo
// y una carta con su nombre escrito se lee como una carta).
function celdaDeCuadriculaHtml(c) {
  const v = c.__variante || null
  const n = tengoEnAlbum(c.id, v?.nuestro || null)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const nombre = nombreDe(c)
  const etiqueta = `${nombre} (${c.local_id})${v ? ` — ${v.nombre}` : ''}${n ? `, tienes ${n}` : ', te falta'}`
  return `<a class="mc-rejilla-celda${n ? ' tengo' : ''}" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}" aria-label="${escapeHtml(etiqueta)}" title="${escapeHtml(etiqueta)}">
    <span class="mc-carta-sinfoto">${escapeHtml(nombre)}<small>${escapeHtml(c.local_id || '')}</small></span>
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
    ${n > 1 ? `<span class="mc-rejilla-copias" aria-hidden="true">×${n}</span>` : ''}
  </a>`
}

// La LISTA: un renglón por carta. El número PRIMERO porque es por donde
// se busca dentro de un set —«la 102»— y porque alineado en una columna
// se recorre con el ojo sin leer.
function filaDeAlbumHtml(c) {
  const v = c.__variante || null
  const n = tengoEnAlbum(c.id, v?.nuestro || null)
  const nombre = nombreDe(c)
  return `<a class="mc-album-fila${n ? ' tengo' : ''}" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}">
    <span class="mc-album-fila-num">${escapeHtml(c.local_id || '')}</span>
    <span class="mc-album-fila-nombre">${escapeHtml(nombre)}${v ? ` <small>${escapeHtml(v.nombre)}</small>` : ''}</span>
    ${rarezaDeCarta(c) ? `<span class="mc-album-fila-rareza">${escapeHtml(rarezaDeCarta(c))}</span>` : ''}
    <span class="mc-album-fila-cuenta">${n ? `×${n}` : '—'}</span>
  </a>`
}

// Qué pintor toca. Un objeto y no un `if` en cascada: añadir una vista
// cuarta tiene que ser una línea en `VISTAS_DE_ALBUM` y otra aquí.
const PINTOR_DE_VISTA = {
  archivador: { clase: 'mc-album-rejilla', celda: bolsilloHtml },
  cuadricula: { clase: 'mc-album-cuadricula', celda: celdaDeCuadriculaHtml },
  lista: { clase: 'mc-album-lista', celda: filaDeAlbumHtml },
}

function pintarAlbum() {
  pintarFiltrosDeAlbum()
  pintarCuentaDeFiltrosDeAlbum()
  const lista = cartasDelAlbumFiltradas()
  const total = album.cartas.length
  // El progreso es SIEMPRE el de la colección entera, filtres lo que
  // filtres: «llevas 40 de 198» no puede cambiar porque estés mirando
  // solo las ultra raras. Lo que cambia es la cuenta de al lado.
  const filtrando = lista.length !== total
  $('mcAlbumCuenta').textContent = filtrando ? `${lista.length} de ${total} cartas a la vista` : ''
  // `album.set` es el ID, no el set: el recuento oficial hay que
  // buscarlo. Sin él, `esAdicional` no puede separar los secretos y la
  // barra de «completo» se come el set entero — que es lo que pasaba.
  const elSet = (todosLosSets || []).find((x) => x.id === album.set) || null
  pintarTiraDeSet(elSet)

  if (!lista.length) {
    $('mcAlbum').innerHTML = album.cartas.length
      ? '<p class="subtext">Ninguna carta de esta colección encaja con esos filtros.</p>'
      : '<p class="subtext">¡No te falta ninguna! Colección completa.</p>'
    return
  }
  // En «una por versión» cada carta se abre en tantas casillas como
  // versiones tenga. Se hace AQUÍ y no en el filtro para que la cuenta
  // de arriba siga siendo la del set y no la de lo que se ve.
  const paraPintar = album.split
    ? lista.flatMap((c) => variantesDeCarta(c).map((v) => ({ ...c, __variante: v })))
    : lista
  // Una rejilla y no un archivador (tanda 417): una expansión ya viene
  // ordenada y lo que se quiere es verla entera. El archivador —pliegos,
  // páginas y tapa— se queda para los álbumes soñados, que es donde el
  // orden lo pones tú.
  const pintor = PINTOR_DE_VISTA[album.vista] || PINTOR_DE_VISTA.archivador
  $('mcAlbum').innerHTML = `<div class="${pintor.clase}">${paraPintar.map(pintor.celda).join('')}</div>`
  // Lo que hay EN PANTALLA, que es de donde sale la lista de «lo que me
  // falta» (tanda 430). Se guarda aquí y no se recalcula allí: recalcular
  // sería escribir una segunda vez los filtros, el orden y el split, y dos
  // listas que se parecen acaban siendo dos que ya no se parecen.
  album.aLaVista = paraPintar
  // Y si hay filtros puestos, que ya lo sabe `pintarAlbum`: deducirlo otra
  // vez más abajo sería escribir la misma regla dos veces, y con «separar
  // variantes» la segunda saldría MAL —hay más huecos que cartas, así que
  // comparar tamaños diría «filtrando» sin que haya ningún filtro—.
  album.filtrando = filtrando
  pintarBotonDeFaltan(filtrando)
}

// ── Lo que me falta, para pegarlo en un chat (tanda 430) ──
//
// Es la otra mitad de un intercambio: el Panel dice desde la 374 lo que te
// SOBRA, que es lo que puedes ofrecer, y lo que te falta había que ir
// leyéndolo de la rejilla hueco por hueco.
function loQueFaltaAhora() {
  return (album.aLaVista || []).filter((c) => !tengoEnAlbum(c.id, c.__variante?.nuestro || null))
}

function pintarBotonDeFaltan(filtrando) {
  const boton = $('mcFaltanCopiar')
  if (!boton) return
  const cuantas = loQueFaltaAhora().length
  // Un botón que no lleva a ninguna parte miente: sin nada que copiar, se
  // apaga y lo dice.
  //
  // Y desde la 461 es un ICONO en la cabecera, así que lo que lo cuenta es
  // su rótulo accesible —que es también el globo al pasar por encima—: un
  // icono que cambia de dibujo según cuántas faltan no se entendería, pero
  // uno cuyo globo dice «Copiar las 485 que me faltan» sí.
  boton.disabled = !cuantas
  const dice = cuantas
    ? `Copiar las ${cuantas} que me faltan`
    : filtrando ? 'No te falta ninguna de estas' : 'No te falta ninguna'
  // Y desde la 475 lo dice EN PANTALLA, dentro del menú de ⋮: el aviso de
  // arriba valía para un icono cuyo globo hay que esperar, y una opción de
  // menú tiene sitio para la frase entera — que era justo lo que PINGU
  // echaba de menos («es un botón que no hace nada»).
  const texto = $('mcFaltanCopiarTexto')
  if (texto) texto.textContent = dice
  boton.title = dice
  boton.setAttribute('aria-label', dice)
}

async function copiarLoQueFalta() {
  const faltan = loQueFaltaAhora()
  if (!faltan.length) return
  const elSet = (todosLosSets || []).find((x) => x.id === album.set) || null
  const texto = textoDeLoQueFalta(faltan, {
    nombreDelSet: elSet?.name,
    codigo: elSet?.tcg_online_code,
    // Con las versiones separadas, el total del set no cuadra con lo que
    // se está listando —son huecos de versión, no cartas—, así que no se
    // dice ninguno. `null` aquí es una respuesta, no un olvido.
    total: album.split ? null : album.cartas.length,
    filtrando: Boolean(album.filtrando),
  })
  const bien = await copiarEnlace(texto)
  showToast(bien ? `Copiadas ${faltan.length}. Ya puedes pegarlas donde quieras.` : 'No se ha podido copiar.', bien ? 'success' : 'error')
}

// ── La tira de una expansión (tanda 417) ──
//
// PINGU, con la pantalla de Dex delante: «mira las expansiones cómo se
// muestran, quiero lo mismo». Allí, antes de las cartas, hay una tira con
// lo que se pregunta de una colección: cuánto llevas, lo que vale y de
// qué va. Es la misma pieza que la del panel.
function pintarTiraDeSet(elSet) {
  const caja = $('mcAlbumProgreso')
  if (!caja) return
  const barras = barrasDeSet(progresoDeSet({ cartas: album.cartas, set: elSet, tengo: tengoEnAlbum }))
  const completo = barras.find((b) => b.id === 'completo') || barras[0]
  const pct = completo ? porcentaje(completo) ?? 0 : 0
  // Lo que valen TUS copias de esta colección, que es lo que se puede
  // decir con lo que hay en memoria: el precio del set entero pediría el
  // de todas las cartas, las tengas o no.
  const mias = lineas.filter((l) => album.cartas.some((c) => c.id === l.card_id))
  const valor = mias.reduce((n, l) => n + (valorDeLinea(l, precioDe(l)) || 0), 0)
  const caras = masValiosasDe(mias, 2)
  // De qué va la colección: cuántas de cada clase. Sale de las cartas que
  // ya están en memoria, sin pedir nada.
  const tipos = new Map()
  for (const c of album.cartas) {
    const t = categoriaEs(c.category) || 'Otras'
    tipos.set(t, (tipos.get(t) || 0) + 1)
  }
  const porTipo = [...tipos.entries()].sort((a, b) => b[1] - a[1])

  // ── UNA TIRA QUE SE DESLIZA DE VERDAD (tanda 467) ──
  //
  // PINGU, con Dex al lado: «las estadísticas, en deslizables, ¿ves que se
  // pueden deslizar? Pues igual».
  //
  // La 459 las sacó de una tira y las puso en rejilla, y el motivo que
  // escribió —«una cifra cortada por el borde se lee como un fallo»— era
  // el de la 439… pero el síntoma que medí entonces era otro: las tres
  // tarjetas se encogían a 97 px CADA UNA. No es que la tira estuviera
  // mal, es que **no se deslizaba**: un hijo de flex cede antes de
  // desbordar (la 320) y le faltaba el `flex-shrink: 0`. Con él, la tira
  // hace lo que decía hacer: una tarjeta entera a la vista, la siguiente
  // asomando y los puntos diciendo cuántas hay.
  //
  // Y una cifra ya no se corta, porque lo que asoma es la tarjeta DE AL
  // LADO y no la mitad de la que estás leyendo. En un escritorio no hay
  // nada que deslizar y se quedan las tres en fila.
  caja.innerHTML = tiraHtml([
        diapoHtml('Conjunto completo', `
          <p class="mc-diapo-cifra">${completo ? completo.tengo : 0}</p>
          <p class="mc-diapo-pie">de ${completo ? completo.total : 0} cartas</p>
          <span class="mc-anillo" style="--pct:${pct}" role="img" aria-label="${pct} % del conjunto"><b>${pct} %</b></span>
          ${barras
            .filter((b) => b.id !== 'completo')
            .map((b) => `<div class="mc-barra-fila">
              <span class="mc-barra-nombre">${escapeHtml(b.nombre)}</span>
              <span class="mc-barra" aria-hidden="true"><i style="--ancho:${porcentaje(b) ?? 0}%"></i></span>
              <span class="mc-barra-cuenta"><strong>${b.tengo}</strong> de ${b.total}</span>
            </div>`)
            .join('')}`),
        diapoHtml('Lo que tienes de aquí', `
          <p class="mc-diapo-cifra">${escapeHtml(euros(valor))}</p>
          <p class="mc-diapo-pie">${mias.length ? `en ${mias.length} ${mias.length === 1 ? 'carta' : 'cartas'} tuyas` : 'todavía no tienes ninguna'}</p>
          ${caras.length
            ? `<ul class="mc-diapo-lista">${caras
                .map((v) => `<li><span>${escapeHtml(nombreDe(v.carta))}</span><strong>${escapeHtml(euros(v.valor))}</strong></li>`)
                .join('')}</ul>`
            : ''}`),
        diapoHtml('Tipos de carta', porTipo.length
          ? `<p class="mc-diapo-cifra">${porTipo.length}</p>
             <p class="mc-diapo-pie">${porTipo.map(([t]) => escapeHtml(t)).join(', ')}</p>
             ${barrasHtml(porTipo)}`
          : '<p class="subtext">El catálogo todavía no dice de qué clase es cada carta.</p>'),
  ], { idPuntos: 'mcAlbumPuntos' })
  engancharPuntos('mcAlbumProgreso')
}

// ── LOS PUNTOS DE UNA TIRA (tanda 467) ──
//
// Dicen cuántas tarjetas hay y en cuál estás, que es lo que convierte un
// corte por el borde en «hay más a la derecha». Sin ellos, una tira es
// indistinguible de una tarjeta mal cortada — que es justo lo que la 439
// intentó disimular con una máscara.
//
// Se pintan DESDE AQUÍ y no en la plantilla porque cuántos hay depende de
// cuántas tarjetas se hayan pintado, y eso cambia: «Tipos de carta» no
// sale si el catálogo no sabe de qué clase es ninguna.
function engancharPuntos(idCaja) {
  const caja = $(idCaja)
  const tira = caja?.querySelector('.mc-diapos')
  const puntos = caja?.querySelector('.mc-puntos')
  if (!tira || !puntos) return
  const tarjetas = [...tira.children]
  if (tarjetas.length < 2) {
    puntos.innerHTML = ''
    return
  }
  puntos.innerHTML = tarjetas
    .map((t, i) => {
      const titulo = t.querySelector('.mc-diapo-titulo')?.textContent || `Dato ${i + 1}`
      return `<button type="button" class="mc-punto${i === 0 ? ' activo' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" aria-label="${escapeHtml(titulo)}"></button>`
    })
    .join('')
  const marcar = () => {
    // Por el CENTRO de la tira y no por `scrollLeft / ancho`: con la
    // última tarjeta el desplazamiento se queda corto —no hay sitio para
    // llevarla al borde izquierdo— y la cuenta diría que estás en la
    // penúltima para siempre.
    const centro = tira.scrollLeft + tira.clientWidth / 2
    let cual = 0
    let mejor = Infinity
    tarjetas.forEach((t, i) => {
      const medio = t.offsetLeft + t.offsetWidth / 2
      const d = Math.abs(medio - centro)
      if (d < mejor) {
        mejor = d
        cual = i
      }
    })
    puntos.querySelectorAll('.mc-punto').forEach((p, i) => {
      p.classList.toggle('activo', i === cual)
      p.setAttribute('aria-selected', i === cual ? 'true' : 'false')
    })
  }
  tira.addEventListener('scroll', marcar, { passive: true })
  puntos.addEventListener('click', (e) => {
    const i = [...puntos.children].indexOf(e.target.closest('.mc-punto'))
    if (i < 0) return
    tira.scrollTo({ left: tarjetas[i].offsetLeft - tira.offsetLeft, behavior: 'smooth' })
  })
  marcar()
}

// Lo más valioso de una lista de líneas, por el valor de UNA copia.
function masValiosasDe(filas, cuantas = 3) {
  const porCarta = new Map()
  for (const l of filas) {
    const v = valorDeLinea(l, precioDe(l))
    if (!v) continue
    const unidad = v / (Number(l.cantidad) || 1)
    if (unidad > (porCarta.get(l.card_id) || 0)) porCarta.set(l.card_id, unidad)
  }
  return [...porCarta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cuantas)
    .map(([id, v]) => ({ carta: cartas.get(id) || album.cartas.find((c) => c.id === id), id, valor: v }))
}

// `variante` llega desde «una por versión» (tanda 398): ahí el + suma a
// ESA versión y no a la normal, que es lo que distingue las casillas.
// ── Marcar varias de golpe (tanda 426) ──
//
// PINGU no lo pidió con estas palabras, pero es lo que cuesta de verdad:
// apuntar un sobre son diez cartas, y una a una eran diez botones
// pequeños, diez repintados de la rejilla y veinte peticiones.
//
// NO es el interruptor de la tanda 365 que se quitó en la 368. Aquel
// obligaba a elegir —con él puesto no se podía abrir una ficha, sin él no
// se podía añadir— y vivía puesto para siempre. Este se enciende, se usa
// y se apaga, lleva su barra diciendo en qué estás y no guarda NADA hasta
// que lo dices. Mientras está apagado la rejilla se comporta igual que
// siempre.
//
// La clave lleva la versión porque en «separar variantes» cada casilla ES
// una versión: con el id de la carta a secas, marcar el reverse holo
// marcaría también la normal.
let marcadas = null // Set de `cardId|variante`, o null si el modo está apagado
const claveMarca = (cardId, variante = 'normal') => `${cardId}|${variante || 'normal'}`

function modoMarcar(encender) {
  marcadas = encender ? new Set() : null
  $('mcMarcarAbrir')?.setAttribute('aria-pressed', encender ? 'true' : 'false')
  $('mcMarcarBarra')?.classList.toggle('hidden', !encender)
  $('mcAlbum')?.classList.toggle('mc-album-marcando', Boolean(encender))
  pintarMarcadas()
  pintarAlbum()
}

function pintarMarcadas() {
  const cuantas = marcadas ? marcadas.size : 0
  const cuenta = $('mcMarcarCuenta')
  if (cuenta) {
    cuenta.textContent = cuantas
      ? `${cuantas} ${cuantas === 1 ? 'carta marcada' : 'cartas marcadas'}`
      : 'Toca las cartas que tienes'
  }
  const guardar = $('mcMarcarGuardar')
  if (guardar) {
    guardar.disabled = !cuantas
    // El botón dice CUÁNTAS va a añadir: «Añadir» a secas, con doce
    // marcadas, no deja claro si añade una o las doce.
    guardar.textContent = cuantas ? `Añadir ${cuantas}` : 'Añadir'
  }
}

// Marcar o desmarcar una casilla. No toca la base: lo que se marca vive
// en memoria hasta que se pulsa «Añadir», que es lo que permite
// corregirse sin haber escrito nada.
function alternarMarca(enlace) {
  if (!marcadas) return
  const clave = enlace.dataset.marca
  if (!clave) return
  if (marcadas.has(clave)) marcadas.delete(clave)
  else marcadas.add(clave)
  const puesta = marcadas.has(clave)
  enlace.setAttribute('aria-pressed', puesta ? 'true' : 'false')
  // La clase va en la CAJA, que es la que se puede dibujar entera; el
  // enlace es solo la foto. Y se toca a mano en vez de repintar la
  // rejilla: con 200 casillas, repintar a cada toque se nota.
  enlace.closest('.mc-bolsillo')?.classList.toggle('marcada', puesta)
  pintarMarcadas()
}

async function guardarMarcadas() {
  if (!marcadas?.size) return
  const boton = $('mcMarcarGuardar')
  const idioma = $('mcTocarIdioma').value
  const estado = $('mcTocarEstado').value
  const lineasNuevas = [...marcadas].map((clave) => {
    const corte = clave.lastIndexOf('|')
    return { card_id: clave.slice(0, corte), variante: clave.slice(corte + 1), idioma, estado }
  })
  boton.disabled = true
  try {
    const puestas = await datos.anadirVarias(sesion.user.id, lineasNuevas, mercado)
    // Las que ya estaban vuelven ACTUALIZADAS y las nuevas, nuevas: se
    // mezclan por id para no acabar con la misma línea dos veces en la
    // lista, que es lo que pasa si se hace `unshift` a lo bruto.
    //
    // Y CON SU CARTA, en la MISMA pasada (tanda 487). Esto eran DOS bucles
    // —uno para las líneas y otro para el catálogo— y al pasar el primero
    // por `meterLinea` se quedó el segundo rellenando solo `cartas` y no
    // `cartasTodo`. Resultado: el Panel, que desde la 485 se pinta con la
    // memoria global, sacaba las recién marcadas SIN NOMBRE («Carta») en
    // «Tus cartas». No daba ningún error — lo cazó la suite entera, con un
    // clic que esas tarjetas sin nombre interceptaban.
    //
    // La lección es la de siempre con dos memorias: un solo camino. Si la
    // carta va en el mismo sitio que la línea, no hay un segundo bucle que
    // se pueda quedar corto.
    const elSet = (todosLosSets || []).find((x) => x.id === album.set)
    for (const l of puestas) {
      const c = album.cartas.find((x) => x.id === l.card_id)
      meterLinea(l, c ? { ...c, tcg_sets: elSet ? { id: elSet.id, name: elSet.name, release_date: elSet.release_date } : null } : null)
    }
    const cuantas = puestas.length
    modoMarcar(false)
    pintarResumen()
    pintarCartas()
    showToast(`${cuantas} ${cuantas === 1 ? 'carta añadida' : 'cartas añadidas'} a tu colección.`, 'success')
  } catch (err) {
    showToast(err.message || 'No se han podido añadir.', 'error')
    boton.disabled = false
  }
}

// `tocarBolsillo` (el «+» con el idioma y el estado del álbum) se fue en
// la 650: añadir pasa siempre por el diálogo, que pregunta el idioma.



// ══════════════════════════════════════════════════════════════════
// BUSCAR EN TODO EL CATÁLOGO (tanda 447)
// ══════════════════════════════════════════════════════════════════
//
// La consulta ya existía —`buscarCartas`, la misma que usa el bloque de
// «añadir» de la pestaña de cartas—, así que lo nuevo es la PANTALLA. Se
// reutiliza a propósito: dos buscadores que buscan lo mismo se separan y
// acaban dando resultados distintos (la lección de `IDIOMA_POR_MERCADO`).
let turnoBuscarTodo = 0
// Lo último que ha devuelto el buscador. Hace falta para abrir la ficha:
// `cartas` es el mapa de TU colección y aquí sale cualquiera del catálogo,
// así que sin esto la ficha se abriría vacía.
let ultimaBusqueda = []
const filtrosCatalogo = filtrosCatalogoVacios()
let ordenCatalogo = 'nombre'
let sentidoCatalogo = sentidoNatural('nombre')

// Los chips del catálogo salen de los mapas de traducción, que es donde ya
// están escritos y traducidos. En tu colección salen de lo que TIENES;
// aquí no hay nada de donde sacarlos.
const MAPAS = { CATEGORIAS_ES, TIPOS_ES, ENTRENADORES_ES, RAREZAS_ES }

function pintarGruposDelCatalogo() {
  const hueco = $('mcBuscarGrupos')
  if (!hueco) return
  hueco.innerHTML = FILTROS_CATALOGO.map((g) => {
    const mapa = MAPAS[g.mapa] || {}
    return `<div class="mc-grupo-filtro"><h3>${escapeHtml(g.nombre)}</h3><div class="mc-chips-filtro">${Object.entries(mapa)
      .map(([clave, rotulo]) => {
        const puesto = filtrosCatalogo[g.id].has(clave)
        const marca = g.id === 'rarity' ? marcaDeRarezaHtml(clave) : ''
        return `<button type="button" class="mc-chip-filtro${puesto ? ' activo' : ''}" data-cgrupo="${g.id}" data-cvalor="${escapeHtml(clave)}" aria-pressed="${puesto ? 'true' : 'false'}">${marca}${escapeHtml(rotulo)}</button>`
      })
      .join('')}</div></div>`
  }).join('')
  const n = cuantosFiltrosCatalogo(filtrosCatalogo)
  const chapa = $('mcBuscarFiltrosCuenta')
  if (chapa) {
    chapa.textContent = n ? String(n) : ''
    chapa.classList.toggle('hidden', n === 0)
  }
}

function pintarBandejaCatalogo() {
  const lista = $('mcBuscarOrdenLista')
  if (!lista) return
  lista.innerHTML = ORDENES_CATALOGO.map((o) => {
    const elegido = o.id === ordenCatalogo
    return `<li><button type="button" class="mc-orden-opcion${elegido ? ' elegido' : ''}" data-borden="${escapeHtml(o.id)}" aria-current="${elegido ? 'true' : 'false'}">
      <span class="mc-orden-icono" aria-hidden="true">${icons[o.icono] ? icons[o.icono](18) : ''}</span>
      <span class="mc-orden-nombre">${escapeHtml(o.nombre)}</span>
      <span class="mc-orden-marca" aria-hidden="true">${elegido ? icons.checkCircle(18) : ''}</span>
    </button></li>`
  }).join('')
  for (const b of $('mcBuscarHojaOrden').querySelectorAll('[data-bsentido]')) {
    const puesto = b.dataset.bsentido === sentidoCatalogo
    b.classList.toggle('elegido', puesto)
    b.setAttribute('aria-checked', puesto ? 'true' : 'false')
  }
  const rotulo = $('mcBuscarOrdenRotulo')
  if (rotulo) rotulo.textContent = ORDENES_CATALOGO.find((o) => o.id === ordenCatalogo)?.nombre || 'Ordenar'
  const flecha = $('mcBuscarOrdenFlecha')
  if (flecha) flecha.textContent = sentidoCatalogo === 'desc' ? '↓' : '↑'
}

async function buscarEnTodo({ variantes = null } = {}) {
  const campo = $('mcBuscarTodo')
  if (!campo) return
  const texto = normalizeSearch(campo.value)
  const mio = ++turnoBuscarTodo
  const vacio = $('mcBuscarVacio')
  const caja = $('mcBuscarResultados')
  const cuenta = $('mcBuscarCuantas')
  // Con menos de dos letras no se busca: una sola trae media base. Un
  // NÚMERO sí vale solo —«64» quiere decir «enséñame las 64»—, que es
  // justo lo que no se podía antes de la tanda 450.
  const { soloNumero } = partirBusqueda(texto)
  if (texto.length < 2 && !soloNumero) {
    vacio?.classList.remove('hidden')
    caja.innerHTML = ''
    if (cuenta) cuenta.textContent = ''
    return
  }
  vacio?.classList.add('hidden')
  caja.innerHTML = '<div class="skeleton" style="height:180px"></div>'
  const TOPE = 120
  let lista
  let porIlustrador = false
  try {
    lista = await buscarCartas(texto, TOPE, { filtros: filtrosCatalogo, variantes })
    // Si por nombre no sale nada, se prueba por ILUSTRADOR. La pasada cara
    // solo ocurre cuando ya no hay nada que perder.
    if (!lista.length) {
      lista = await buscarPorIlustrador(texto, TOPE)
      porIlustrador = lista.length > 0
    }
  } catch (error) {
    if (mio !== turnoBuscarTodo) return
    caja.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`
    return
  }
  // El turno: sin esto, una búsqueda lenta pisa a la que escribiste
  // después y la pantalla enseña lo que ya no buscas.
  if (mio !== turnoBuscarTodo) return
  // El orden se aplica a lo que HA VUELTO. Y por eso la cuenta dice
  // cuándo se ha llegado al tope: ordenar 120 de 400 por fecha no da «las
  // más nuevas del catálogo», da «las más nuevas de estas 120», y callarlo
  // sería enseñar una lista que parece lo que no es.
  lista = ordenarCartas(lista, ordenCatalogo, sentidoCatalogo, {
    nombre: (c) => nombreDe(c),
    valor: () => null,
    rango: rangoDeRareza,
    porNumero,
  })
  if (cuenta) {
    const cuantas = lista.length ? `${lista.length} ${lista.length === 1 ? 'carta' : 'cartas'}` : ''
    const tope = lista.length >= TOPE ? ' · hay más, afina la búsqueda' : ''
    cuenta.textContent = cuantas + (porIlustrador ? ' · por ilustrador' : '') + tope
  }
  ultimaBusqueda = lista
  caja.innerHTML = lista.length
    ? lista.map((c) => {
        const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
        return `<a class="mc-resultado" href="${escapeHtml(rutaDeCarta(c))}" data-carta="${escapeHtml(c.id)}">
          <span class="mc-resultado-foto">
            <span class="mc-carta-sinfoto">${escapeHtml(nombreDe(c))}</span>
            ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
          </span>
          <span class="mc-resultado-nombre">${escapeHtml(nombreDe(c))}</span>
          <span class="mc-resultado-set">${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)} · ${escapeHtml(c.local_id)}</span>
        </a>`
      }).join('')
    : '<p class="empty-state">No encuentro ninguna carta así. Prueba con menos letras.</p>'
}

// ── EL ESCÁNER (tanda 447) ──
//
// El módulo con las cuentas entra por un `import()` dinámico: quien no
// abra el escáner no se baja ni una línea de él, igual que la pestaña del
// foro de los perfiles. Y la cámara no se pide hasta que se abre — pedirla
// al cargar la página saca el aviso del navegador sin que nadie lo haya
// pedido, que es la forma más rápida de que te digan que no para siempre.
let escaner = null
let camara = null

async function abrirEscaner() {
  const caja = $('mcEscanerCaja')
  if (!caja) return
  const ayuda = $('mcEscanerAyuda')
  try {
    escaner = escaner || (await import('./mi-coleccion/escaner.js'))
  } catch {
    showToast('No se ha podido cargar el escáner.', 'error')
    return
  }
  const sel = $('mcEscanerIdioma')
  if (sel) {
    // Se repinta CADA VEZ que se abre el escáner, y no solo la primera
    // (tanda 472). El idioma por defecto sale del catálogo que miras, y el
    // catálogo cambia sin recargar la página: con el `!sel.options.length`
    // de antes, quien abría el escáner una vez en español se lo llevaba
    // en español al catálogo japonés el resto de la visita.
    sel.innerHTML = escaner.IDIOMAS_ESCANER
      .map((i) => `<option value="${i.id}">${escapeHtml(i.nombre)}</option>`)
      .join('')
    // El idioma de la carta se recuerda —quien colecciona japonés escanea
    // japonés veinte veces seguidas— y se recuerda POR CATÁLOGO, por lo
    // mismo que los otros dos desplegables.
    //
    // La lista del escáner es la suya y no `IDIOMAS`: aquí el idioma dice
    // en qué está ESCRITA la carta que tienes delante, que es otra pregunta.
    const clave = claveDeIdioma('mc-escaner-idioma')
    const porDefecto = escaner.IDIOMAS_ESCANER.some((i) => i.id === idiomaDeLaVista())
      ? idiomaDeLaVista()
      : sel.value
    sel.value = porDefecto
    try {
      const guardado = localStorage.getItem(clave)
      if (guardado && escaner.IDIOMAS_ESCANER.some((i) => i.id === guardado)) sel.value = guardado
    } catch {
      // Ventana privada: se queda el del catálogo y ya está.
    }
    // `onchange` y no `addEventListener`: esto corre cada vez que se abre
    // el escáner, y con `addEventListener` se apilaría un oyente por
    // apertura, cada uno escribiendo en la clave de otro catálogo.
    sel.onchange = () => {
      try {
        localStorage.setItem(clave, sel.value)
      } catch {
        // Lo mismo: no poder recordarlo no impide escanear.
      }
    }
  }
  if (!caja.open) caja.showModal()
  if (ayuda) ayuda.textContent = 'Pidiendo permiso para la cámara…'
  try {
    // `environment` es la cámara de atrás. Y se PIDE, no se exige: un
    // portátil solo tiene la de delante y con `exact` fallaría del todo.
    camara = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
  } catch (err) {
    // Aquí hay que distinguir: que digas que NO es distinto de que el
    // aparato no tenga cámara, y un mensaje que no distingue deja a la
    // gente dándole al botón sin saber qué pasa.
    const nombre = String(err?.name || '')
    if (ayuda) {
      ayuda.textContent = nombre === 'NotAllowedError'
        ? 'Has dicho que no a la cámara. Dale permiso en el candado de la barra de direcciones.'
        : nombre === 'NotFoundError'
          ? 'Este aparato no tiene cámara.'
          : 'No se ha podido abrir la cámara.'
    }
    $('mcEscanerDisparo')?.setAttribute('disabled', '')
    return
  }
  const video = $('mcEscanerVideo')
  video.srcObject = camara
  await video.play().catch(() => null)
  $('mcEscanerDisparo')?.removeAttribute('disabled')
  if (ayuda) ayuda.textContent = 'Encuadra la carta dentro del marco'
}

// APAGAR LA CÁMARA AL CERRAR, y esto no es limpieza opcional: una pista de
// vídeo que se queda viva deja el piloto del móvil encendido y se come la
// batería hasta que recargas la página.
function cerrarEscaner() {
  const caja = $('mcEscanerCaja')
  const video = $('mcEscanerVideo')
  if (camara) {
    for (const pista of camara.getTracks()) pista.stop()
    camara = null
  }
  if (video) video.srcObject = null
  if (caja?.open) caja.close()
}

// DISPARAR. Se recortan las dos franjas en el navegador y se mandan a
// leer. No se manda la foto: una foto de cámara son dos o tres megas para
// leer cuatro palabras, y el dibujo de la carta es justo donde un OCR se
// inventa texto.
let leyendo = false

async function dispararEscaner() {
  if (leyendo || !escaner) return
  const video = $('mcEscanerVideo')
  const marco = $('mcEscanerMarco')
  const lienzo = $('mcEscanerLienzo')
  const ayuda = $('mcEscanerAyuda')
  const boton = $('mcEscanerDisparo')
  const franjas = escaner.recortarFranjas(video, marco, lienzo)
  if (!franjas) {
    if (ayuda) ayuda.textContent = 'No he podido leer la imagen. Inténtalo otra vez.'
    return
  }
  leyendo = true
  boton?.setAttribute('disabled', '')
  if (ayuda) ayuda.textContent = 'Leyendo la carta…'
  try {
    const res = await fetch('/.netlify/functions/leer-carta', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nombre: franjas.nombre, codigo: franjas.codigo, idioma: $('mcEscanerIdioma')?.value || 'es' }),
    })
    const datos = await res.json().catch(() => ({}))
    if (!res.ok) {
      // El mensaje del servidor tal cual: distingue «no está montado» de
      // «no se te ha leído la carta», y quien lo prueba necesita saber
      // cuál de las dos es.
      //
      // Y con `sinConfigurar` se enseña ADEMÁS el detalle, que dice POR QUÉ
      // no llega la clave (otro nombre, o sin el ámbito «Functions»). No es
      // un secreto: ahí van NOMBRES de variables, nunca valores. Y es un
      // estado pasajero que desaparece en cuanto el escáner funciona —
      // mientras dura, es la diferencia entre arreglarlo en un minuto y
      // mirar el panel de Netlify a ciegas desde el móvil.
      if (ayuda) {
        ayuda.textContent = datos.sinConfigurar && datos.detalle
          ? `${datos.error} ${datos.detalle}`
          : datos.error || 'No he podido leer la carta.'
      }
      return
    }
    // CÓMO SE USA LO LEÍDO, que no es «meterlo todo en el buscador».
    //
    // El buscador cruza contra `name_search`, o sea contra el NOMBRE. Si
    // se le echa el texto entero —«Charizard ex SSP 125»— exige que «SSP»
    // y «125» estén también en el nombre, y no lo están: salen CERO
    // resultados con la carta correcta delante. Lo descubrió la primera
    // prueba del camino completo.
    //
    // Así que cada franja hace su trabajo: la de arriba BUSCA y la de
    // abajo AFINA. El número de la franja del código se usa para quedarse
    // con la carta que lo lleva, que es lo que distingue una Charizard de
    // las otras veinte.
    // LA FRANJA DE ARRIBA NO ES EL NOMBRE (tanda 451). Lleva la fase a la
    // izquierda, el nombre en medio y los puntos de vida con su símbolo a
    // la derecha, y el OCR las lee las tres porque las tres están ahí.
    // PINGU escaneó un Reshiram y en el buscador le quedó «BÁSICO Reshiram
    // EX pv180·»: cero resultados.
    const nombreLeido = escaner.nombreDeLaFranja(datos?.textos?.nombre)
    if (!nombreLeido) {
      if (ayuda) ayuda.textContent = 'No he reconocido el nombre. Acerca más la carta.'
      return
    }
    // ── SI ESO NO PUEDE SER UNA CARTA, SE DICE AQUÍ (tanda 560) ──
    //
    // PINGU escaneó y el aviso dijo «He leído: 19:054 Card Trader 111 5G»:
    // el reloj, el nombre de la app y la cobertura. El marco pilló la
    // PANTALLA del móvil que tenía delante, no la carta de dentro.
    //
    // Hasta ahora eso cerraba el escáner, saltaba a Buscar y enseñaba «no
    // encuentro ninguna carta así» — la MISMA pantalla que cuando la carta
    // no está en el catálogo. Dos cosas muy distintas con la misma cara, y
    // la que toca es «vuelve a encuadrar». Así que el escáner se queda
    // ABIERTO y lo dice: volver a abrirlo para repetir el tiro es la parte
    // que convierte un fallo de encuadre en abandonar.
    const idiomaCarta = $('mcEscanerIdioma')?.value || 'es'
    const juicio = escaner.pareceNombreDeCarta(nombreLeido, idiomaCarta)
    if (!juicio.vale) {
      if (ayuda) {
        ayuda.textContent = juicio.porque === 'pantalla'
          ? `He leído «${nombreLeido}»: eso es una pantalla, no una carta. Encuadra solo la carta dentro del marco.`
          : `He leído «${nombreLeido}», que no parece el nombre de una carta japonesa. Encuadra solo la carta, o cambia el idioma si no es japonesa.`
      }
      return
    }
    // El número impreso viene como «22/99»: lo de delante de la barra es
    // la carta, lo de detrás cuántas tiene el set.
    const numero = escaner.numeroDeLaFranja(datos?.textos?.codigo)
    cerrarEscaner()
    cambiarPestania('buscar')
    // PRIMERO CON EL NÚMERO, Y SI NO SALE NADA, SIN ÉL. Desde la tanda 450
    // el buscador entiende «Mewtwo 64», así que la búsqueda más fina es
    // nombre + número; pero el número lo ha leído un OCR de una foto a
    // pulso, y un 8 donde hay un 6 dejaría cero resultados con la carta
    // delante. Así que se intenta lo preciso y se afloja si no hay nada:
    // nunca se acaba en una pantalla vacía por culpa de una cifra.
    const campo = $('mcBuscarTodo')
    campo.value = numero ? `${nombreLeido} ${numero}` : nombreLeido
    await buscarEnTodo()
    // ── LO QUE SE HA LEÍDO, DICHO (tanda 558b) ──
    //
    // Sin esto, «no he podido leer el número» y «lo he leído y no casaba»
    // se ven EXACTAMENTE IGUAL: una lista larga de cartas parecidas. Es la
    // familia de siempre —un vacío que se lee como una respuesta— y aquí
    // además deja a quien lo usa sin saber si acercar más la carta o si es
    // que esa carta no está. PINGU vio 23 Charizards y tuvo que
    // adivinar cuál de las dos cosas era.
    let aflojado = numero ? '' : ' · no he podido leer el número'
    if (numero && !$('mcBuscarResultados').querySelector('.mc-resultado')) {
      // Y al aflojar, el número SE TIRA. Aquí vivía `afinarPorNumero`, que
      // lo usaba para subir la carta probable; se quitó al ver que en este
      // punto ese número YA HA FALLADO —si casara con algo, la búsqueda de
      // arriba habría encontrado esa carta—. Volver a confiarle el orden
      // es confiar en una lectura que acaba de demostrarse mala, y lo que
      // haría es poner PRIMERA una carta equivocada: peor que no ordenar.
      campo.value = nombreLeido
      await buscarEnTodo()
      aflojado = ` · el nº ${numero} no casaba con ninguna`
    }
    // ── Y UN ÚLTIMO INTENTO CON UNA SOLA PALABRA (tanda 558) ──
    //
    // La búsqueda exige TODAS las palabras: un `like` por cada una. Así
    // que basta con que el OCR cuele una basura para que no case nada
    // aunque el nombre esté perfecto — que es exactamente lo que le pasó a
    // PINGU con una リザードンex: en el buscador quedó «己進化 リザードン ex
    // シダードか テ テキス…» y cero resultados.
    //
    // La limpieza de la franja ya quita lo que SE SABE que no es el
    // nombre; esto es la red de debajo, para lo que no se sabe. Se queda
    // con la palabra más larga, que es la que más se parece a un nombre, y
    // afloja todo lo demás. Es el mismo criterio que con el número: lo
    // preciso primero, y si no hay nada, menos exigente.
    if (!$('mcBuscarResultados').querySelector('.mc-resultado')) {
      const palabras = nombreLeido.split(/\s+/).filter((p) => p.length >= 2)
      const masLarga = palabras.length > 1 ? palabras.reduce((a, b) => (b.length > a.length ? b : a)) : null
      if (masLarga) {
        campo.value = masLarga
        await buscarEnTodo()
        aflojado += ' · he buscado solo por la palabra más larga'
      }
    }
    // ── Y LO ÚLTIMO: LAS MARCAS QUE EL OCR SE COME (tanda 561) ──
    //
    // PINGU escaneó una リザードン y el aviso dijo «He leído: リサードン»:
    // el dakuten de ザ —dos comillitas de dos píxeles— se perdió en la
    // foto. Con un carácter cambiado el `like` se va a cero, y hasta aquí
    // eso se veía como «esa carta no está».
    //
    // Es el error más común leyendo japonés, así que se prueban las
    // variantes del nombre con una marca puesta o quitada, todas en UNA
    // consulta. Va al final porque es lo más flojo que se hace: si algo
    // casó antes, esto ni se pregunta.
    if (!$('mcBuscarResultados').querySelector('.mc-resultado') && tieneCJK(nombreLeido)) {
      const variantes = variantesDeMarcas(nombreLeido)
      if (variantes.length > 1) {
        campo.value = nombreLeido
        await buscarEnTodo({ variantes })
        if ($('mcBuscarResultados').querySelector('.mc-resultado')) {
          aflojado += ' · puede que se perdiera algún dakuten, he probado las variantes'
        }
      }
    }
    showToast(`He leído: ${nombreLeido}${aflojado}`)
  } catch {
    if (ayuda) ayuda.textContent = 'No he podido conectar. Mira tu conexión.'
  } finally {
    leyendo = false
    boton?.removeAttribute('disabled')
  }
}

// ── Pestaña «Añadir» ──
let seleccion = null
let turnoBusqueda = 0

// La consulta del buscador de cartas, suelta desde la 376 porque la
// usan DOS sitios: «Añadir cartas» y la lista de búsqueda de los
// cambios. Copiarla habría dejado dos buscadores que se separan sin
// que nadie se entere — la lección de `IDIOMA_POR_MERCADO`.
// LAS DOS FORMAS DE CADA VALOR (tanda 455). TCGdex TRADUCE LOS ENUMS: si
// pides el catálogo en español te devuelve `rarity: 'Común'`, y en inglés
// `'Common'`. El catálogo se ha ido importando en varios momentos y en
// varios idiomas, así que la columna tiene las dos formas MEZCLADAS — se
// ve a simple vista en los chips de la Pokédex, donde salían «Común» y
// «Common» como si fueran rarezas distintas.
//
// El chip guarda la clave inglesa, que es la del mapa. Si la consulta
// mandara solo esa, las filas guardadas en español se quedarían fuera y el
// filtro enseñaría LA MITAD sin que nada lo dijera. Así que se mandan las
// dos.
function variantesDeValor(clave) {
  const traducciones = [CATEGORIAS_ES, TIPOS_ES, ENTRENADORES_ES, RAREZAS_ES]
    .map((m) => m[clave])
    .filter((v) => v && v !== clave)
  // Y LAS RAREZAS, TODAS SUS FORMAS (tanda 463). Con dos no basta: la
  // misma rareza está escrita de hasta tres maneras en el catálogo —la
  // inglesa de TCGdex, la española de TCGdex y la que nosotros decíamos
  // antes de usar el nombre oficial—, así que mandar solo dos dejaba fuera
  // las filas de la tercera. Y eso no da ningún error: el filtro enseña
  // menos cartas de las que hay.
  return [...new Set([clave, ...traducciones, ...formasDeRareza(clave)])]
}

const COLUMNAS_BUSCAR = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,rarity,rarity_en,category,types,trainer_type,illustrator,dex_ids,tcg_sets(id,name,name_en,serie_id,serie_name_en,release_date,tcg_online_code)'

// UN NÚMERO SUELTO NO ES PARTE DEL NOMBRE (tanda 450), y esto era un fallo
// de verdad: PINGU escribió «Mewtwo 64» —el Mega-Mewtwo X de Breakthrough,
// que es la 64— y no salía NADA. El buscador exigía que «64» estuviera
// también en `name_search`, que son los dos nombres y nada más.
//
// Y un número que alguien escribe junto a un nombre puede querer decir dos
// cosas, así que vale cualquiera de las dos: el NÚMERO IMPRESO de la carta
// («la 64 del set») o el NÚMERO NACIONAL de Pokédex («el 25 es Pikachu»).
// Quedarse solo con uno dejaría media web sin encontrar a la primera.
//
// Se acepta como número una palabra de dígitos sola, y se compara también
// con ceros delante porque hay sets que imprimen «064». Y solo dígitos:
// esto se monta dentro de un `or=` de PostgREST, donde una coma o un
// paréntesis del usuario cambiaría la consulta.
export function partirBusqueda(texto) {
  const palabras = String(texto || '').split(/\s+/).filter(Boolean)
  const numeros = palabras.filter((p) => /^\d{1,4}$/.test(p))
  const nombre = palabras.filter((p) => !/^\d{1,4}$/.test(p))
  // Si SOLO se escribe un número, ese número es la búsqueda entera y no
  // un afinado: «64» a secas quiere decir «enséñame las 64».
  return { nombre, numero: numeros[0] || null, soloNumero: numeros.length > 0 && nombre.length === 0 }
}

function variantesDeNumero(n) {
  const limpio = String(n).replace(/^0+/, '') || '0'
  return [...new Set([limpio, limpio.padStart(2, '0'), limpio.padStart(3, '0'), String(n)])]
}

async function buscarCartas(texto, limite = 60, { filtros: fcat = null, variantes = null } = {}) {
  const { nombre, numero } = partirBusqueda(texto)
  let q = supabase.from('tcg_cards').select(COLUMNAS_BUSCAR).eq('market', mercado)
  if (variantes?.length) {
    // ── UNA SOLA CONSULTA PARA TODAS LAS VARIANTES (tanda 561) ──
    //
    // Cuando el escáner se come una marca, lo que hay que preguntar es
    // «¿alguno de estos nombres?». En un `or` es UNA ida y vuelta; en un
    // bucle serían hasta trece, y esto corre en el móvil de quien acaba de
    // hacer una foto.
    //
    // La coma y el paréntesis se quitan porque son la sintaxis del propio
    // `or` de PostgREST: un nombre con una coma partiría la condición en
    // dos y la segunda mitad no querría decir nada.
    const limpias = variantes.map((x) => String(x).replace(/[%_*,()]/g, '')).filter(Boolean)
    if (limpias.length) q = q.or(limpias.map((x) => `name_search.like.*${x}*`).join(','))
  } else {
    for (const p of nombre) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  }
  if (numero) {
    const comoLocal = variantesDeNumero(numero).map((v) => `local_id.eq.${v}`)
    q = q.or([...comoLocal, `dex_ids.cs.{${Number(numero)}}`].join(','))
  }
  // Los filtros del catálogo van EN LA CONSULTA, no después: el catálogo
  // tiene 21.000 cartas y esto trae 120, así que filtrar lo que vuelve
  // sería filtrar la muestra y no el catálogo.
  for (const g of FILTROS_CATALOGO) {
    const puestos = [...(fcat?.[g.id] || [])].flatMap(variantesDeValor)
    if (!puestos.length) continue
    if (g.array) q = q.overlaps(g.columna, puestos)
    else q = q.in(g.columna, puestos)
  }
  const { data, error } = await q.order('name_search').limit(limite)
  if (error) throw error
  return (data || []).filter((c) => esDelTCG({ id: c.set_id, serie_id: c.tcg_sets?.serie_id }))
}

// Y si por nombre no sale nada, se prueba por ILUSTRADOR. Va como segunda
// consulta y no como un `or` de la primera a propósito: un `or` entre
// `name_search` y `illustrator` no puede usar el índice del nombre y
// obligaría a recorrer las 23.000 cartas EN CADA TECLA. Así el caso
// normal —buscar un nombre— sigue yendo por su índice, y la pasada cara
// solo ocurre cuando ya no hay nada que perder.
async function buscarPorIlustrador(texto, limite = 60) {
  const { nombre } = partirBusqueda(texto)
  if (!nombre.length) return []
  let q = supabase.from('tcg_cards').select(COLUMNAS_BUSCAR).eq('market', mercado)
  for (const p of nombre) q = q.ilike('illustrator', `%${p.replace(/[%_]/g, '')}%`)
  const { data, error } = await q.order('name_search').limit(limite)
  if (error) throw error
  return (data || []).filter((c) => esDelTCG({ id: c.set_id, serie_id: c.tcg_sets?.serie_id }))
}

// El catálogo que se enseña DEBAJO de tus cartas (tanda 408): mismo
// buscador, dos respuestas. Hace falta un mínimo de dos letras porque una
// sola trae media base.
async function buscar() {
  const texto = normalizeSearch($('mcBuscar').value)
  const mio = ++turnoBusqueda
  // Mirando la colección de otro no hay nada que añadir, así que ni se
  // pregunta: el bloque ni siquiera existe en pantalla.
  if (!esMia || texto.length < 2) {
    $('mcCatalogo').classList.add('hidden')
    $('mcAnadirResultados').innerHTML = ''
    return
  }
  $('mcCatalogo').classList.remove('hidden')
  let lista
  try {
    lista = await buscarCartas(texto)
  } catch (error) {
    if (mio !== turnoBusqueda) return
    $('mcAnadirResultados').innerHTML = `<p class="subtext">${escapeHtml(error.message)}</p>`
    return
  }
  if (mio !== turnoBusqueda) return
  $('mcAnadirResultados').innerHTML = lista.length
    ? lista
        .map((c) => {
          const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
          return `<button type="button" class="mc-resultado" data-carta="${escapeHtml(c.id)}">
            ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
            <span class="mc-resultado-nombre">${escapeHtml(nombreDe(c))}</span>
            <span class="mc-resultado-set">${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)} · ${escapeHtml(c.local_id)}</span>
          </button>`
        })
        .join('')
    : '<p class="subtext">No encuentro ninguna carta con ese nombre.</p>'
  buscar.ultimas = new Map(lista.map((c) => [c.id, c]))
}

async function elegir(cardId) {
  const c = buscar.ultimas?.get(cardId)
  if (!c) return
  seleccion = c
  const escaneoElegida = atributosDeEscaneo(cadenaDeEscaneo(c))
  $('mcAnadirElegida').innerHTML = `${escaneoElegida ? `<img ${escaneoElegida} alt="" width="245" height="342" loading="lazy" />` : ''}
    <div><strong>${escapeHtml(nombreDe(c))}</strong><p class="subtext">${escapeHtml(nombreDeSet(c.tcg_sets))} · ${escapeHtml(c.local_id)}</p><p class="subtext" id="mcAnadirPrecio">Buscando precio…</p></div>`
  // Las versiones de la carta ELEGIDA (tanda 563). Aquí ya se sabe cuál
  // es, así que ofrecer las cuatro es el mismo fallo que en el editor: se
  // apunta una versión que de esta carta no se ha impreso. Se pinta
  // ANTES de enseñar el formulario para que no se vea el cambio.
  const vs = variantesParaEditar(c, null)
  $('mcAnadirVariante').innerHTML = opciones(vs, vs.some((v) => v.id === 'normal') ? 'normal' : vs[0]?.id)
  $('mcAnadirForm').classList.remove('hidden')
  $('mcAnadirForm').scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  const v = await datos.preciosEnVivo(c.id)
  if (seleccion?.id !== c.id) return
  if (v) vivos.set(c.id, v)
  const p = datos.precioDeLinea({ card_id: c.id, variante: $('mcAnadirVariante').value }, guardados, vivos)
  // Con el idioma con el que se va a añadir (589): «Desde 140 € en español».
  $('mcAnadirPrecio').textContent = datos.tieneCifras(p) ? resumenDePrecio(p, $('mcTocarIdioma')?.value || idiomaDeLaVista()) : 'Sin precio.'
}

async function anadirSeleccion(e) {
  e.preventDefault()
  if (!seleccion) return
  const boton = $('mcAnadirBoton')
  boton.disabled = true
  try {
    const nueva = await datos.anadir(sesion.user.id, {
      card_id: seleccion.id,
      idioma: $('mcAnadirIdioma').value,
      estado: $('mcAnadirEstado').value,
      variante: $('mcAnadirVariante').value,
      cantidad: Math.max(1, Math.min(999, Math.round(Number($('mcAnadirCantidad').value) || 1))),
    }, mercado)
    meterLinea(nueva, seleccion)
    cartas.set(seleccion.id, seleccion)
    showToast(`${nombreDe(seleccion)} añadida.`, 'success')
    $('mcAnadirCantidad').value = 1
    repintar()
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    boton.disabled = false
  }
}

// ── Pestañas y repintado ──
function cambiarPestania(nueva, { push = true } = {}) {
  pestania = nueva
  for (const b of document.querySelectorAll('[data-pestania]')) {
    const activa = b.dataset.pestania === nueva
    b.classList.toggle('activa', activa)
    b.setAttribute('aria-selected', String(activa))
  }
  for (const [id, nombre] of [['mcPanelCartas', 'cartas'], ['mcPanelAlbum', 'album'], ['mcPanelResumen', 'resumen'], ['mcPanelCarpetas', 'carpetas'], ['mcPanelPokedex', 'pokedex'], ['mcPanelBuscar', 'buscar'], ['mcPanelCambios', 'cambios']]) {
    $(id).classList.toggle('hidden', nombre !== nueva)
  }
  const url = new URL(location.href)
  // La nota que explica de dónde sale el valor solo hace falta donde se
  // enseña el valor (tanda 413). En las otras cuatro pestañas eran tres
  // renglones de letra pequeña entre la cabecera y lo que venías a ver.
  $('mcResumenNota')?.classList.toggle('hidden', nueva !== 'resumen')
  // Y de dónde salen los precios, solo donde se enseñan precios (tanda
  // 442). Son las cartas y el panel; en Expansiones, la Pokédex y las
  // carpetas no hay ninguno.
  $('mcFuente')?.classList.toggle('hidden', !['cartas', 'resumen'].includes(nueva))
  // LA CABECERA, SOLO EN EL PANEL (tanda 444). PINGU: «lo de mi colección
  // debería verse solo en el panel, porque en los demás módulos es un
  // espacio desperdiciado». Son ~400 px de avatar, cifras y interruptor
  // antes de la primera carta, repetidos en las cinco pestañas, diciendo
  // lo mismo que el Panel ya cuenta entero.
  //
  // El `<h1>` NO se esconde con el resto: se queda en `sr-only`. Un
  // `display: none` lo saca también del árbol de accesibilidad y la
  // pantalla se queda SIN encabezado, que es peor que el espacio. Así
  // sigue leyéndose en voz alta y ocupa cero.
  // En el catálogo (tanda 649) la cabecera es el título de la página y
  // se queda: no hay Panel al que reservarle el espacio.
  const mini = !modoCatalogo && nueva !== 'resumen'
  $('mcHero')?.classList.toggle('mc-hero-mini', mini)
  $('mcTitulo')?.classList.toggle('sr-only', mini)
  // La pestaña por defecto es la que NO lleva `?ver=`: si no, compartir
  // /mi-coleccion a secas llevaría a una pestaña distinta de la que ve
  // quien la abre.
  if (nueva === PESTANA_POR_DEFECTO) url.searchParams.delete('ver')
  else url.searchParams.set('ver', nueva)
  if (nueva !== 'carpetas') url.searchParams.delete('album')
  // Y al salir de una pestaña se va lo que había abierto DENTRO: un
  // `?set=` colgando en la pestaña de la Pokédex no significa nada, y al
  // volver abriría una expansión que no habías pedido.
  if (nueva !== 'album') url.searchParams.delete('set')
  if (nueva !== 'pokedex') url.searchParams.delete('dex')
  // Cambiar de pestaña ES un paso: el botón de atrás vuelve a la anterior.
  if (push && url.href !== location.href) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
  // Los álbumes soñados (tanda 366) se cargan la primera vez que se abren.
  // Los álbumes soñados viven dentro de «Carpetas» desde la 408, así que
  // es esa pestaña la que los enciende la primera vez.
  if (nueva === 'carpetas' && !albumesAbiertos && esMia) {
    albumesAbiertos = true
    albumes.entrar(params.get('album'))
  }
  if (nueva === 'album' && !album.set) pintarEstanteria()
  if (nueva === 'resumen') {
    pintarResumenPanel()
    void pintarVistazos()
  }
  if (nueva === 'cambios' && esMia) abrirCambios()
  if (nueva === 'carpetas') abrirCarpetas()
  if (nueva === 'pokedex') abrirPokedex()
  // Al entrar en Buscar, el foco al campo: se viene a escribir.
  // AQUÍ SE ENFOCABA EL BUSCADOR, y se quita (tanda 452). PINGU: «en móvil,
  // siempre que abres Buscar te abre ya el teclado, pero también tienes el
  // botón de escanear; alguien que quiere escanear tendría que cerrar el
  // teclado».
  //
  // Tiene razón y es un caso de libro: enfocar un campo al entrar es un
  // atajo para UNA de las dos cosas que se pueden hacer en esta pantalla, y
  // en un móvil no es un atajo barato — el teclado se come media pantalla y
  // tapa justo la otra opción. En un escritorio el coste sería cero, pero
  // el que escanea es precisamente el del móvil.

}

// ── Las carpetas (tanda 402) ──
//
// Se cargan la primera vez que se abre la pestaña, como los álbumes
// soñados: quien nunca entra no se baja el módulo ni hace las dos
// consultas.
let carpetas = null
let carpetasLista = []
let carpetasResumen = new Map()
let carpetaAbierta = null

// Las carpetas de la carta abierta (tanda 402). El bloque entero se
// esconde si no hay ninguna carpeta: un rótulo «Carpetas» encima de un
// hueco vacío no dice qué hacer, y lo que hay que hacer está en otra
// pestaña.
// Quién de los que sigues tiene esta carta (tanda 403). El bloque se
// esconde si no hay nadie: un rótulo «La tienen» encima de un hueco
// vacío dice «no tienes amigos» sin querer, y además no se distingue de
// «todavía no lo he mirado».
async function pintarQuienLaTiene(cardId) {
  const bloque = $('mcEdQuienBloque')
  const hueco = $('mcEdQuien')
  if (!bloque || !hueco || !cardId) return
  bloque.classList.add('hidden')
  let gente = []
  try {
    gente = await datos.quienLaTiene(cardId)
  } catch {
    return
  }
  // Puede haber llegado tarde: si mientras tanto se ha abierto otra
  // carta, esto pintaría la gente de la anterior.
  const l = lineas.find((x) => x.id === $('mcEditor').dataset.linea)
  if (!l || l.card_id !== cardId) return
  if (!gente.length) return
  bloque.classList.remove('hidden')
  hueco.innerHTML = gente
    .map((g) => {
      const nombre = g.display_name || g.username || 'Alguien'
      return `<a class="mc-quien-persona" href="${escapeHtml(profileUrl(g))}"${atributosDeRango(g)}>
        <span class="mini-avatar" style="${avatarStyle(g)}">${g.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>
        <span class="mc-quien-nombre">${escapeHtml(nombre)}</span>
        <span class="mc-quien-cuantas">×${Number(g.copias) || 1}</span>
      </a>`
    })
    .join('')
}

async function pintarCarpetasDeLaFicha(lineId) {
  const bloque = $('mcEdCarpetasBloque')
  const hueco = $('mcEdCarpetas')
  if (!bloque || !hueco) return
  if (!carpetas) {
    try {
      carpetas = await import('./mi-coleccion/carpetas.js')
    } catch {
      bloque.classList.add('hidden')
      return
    }
  }
  if (!carpetasLista.length) {
    const lista = await carpetas.listarCarpetas().catch(() => null)
    carpetasLista = lista || []
  }
  if (!carpetasLista.length) {
    bloque.classList.add('hidden')
    return
  }
  bloque.classList.remove('hidden')
  const dentro = new Set(await carpetas.carpetasDeLinea(lineId).catch(() => []))
  hueco.innerHTML = carpetasLista
    .map((c) => {
      const puesta = dentro.has(c.id)
      return `<button type="button" class="mc-chip-filtro${puesta ? ' activo' : ''}" data-carpeta-chip="${escapeHtml(c.id)}" aria-pressed="${puesta ? 'true' : 'false'}">${escapeHtml(c.emoji ? `${c.emoji} ` : '')}${escapeHtml(c.nombre)}</button>`
    })
    .join('')
}

async function abrirCarpetas() {
  const caja = $('mcCarpetasPanel')
  if (!caja) return
  if (!carpetas) {
    caja.innerHTML = '<div class="skeleton" style="height:200px"></div>'
    try {
      carpetas = await import('./mi-coleccion/carpetas.js')
    } catch (err) {
      caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
      return
    }
  }
  await recargarCarpetas()
}

async function recargarCarpetas() {
  const caja = $('mcCarpetasPanel')
  const lista = await carpetas.listarCarpetas().catch(() => null)
  // `null` = la migración no está puesta. Es distinto de «no tienes
  // ninguna»: lo primero se arregla ejecutando un SQL y lo segundo
  // creando una carpeta, y decir lo que no es manda a la gente a buscar
  // un botón que no existe.
  if (lista === null) {
    caja.innerHTML = '<p class="empty-state">Las carpetas todavía no están activadas en la base. En cuanto lo estén, aquí podrás ordenar tu colección como quieras.</p>'
    $('mcCarpetaNueva').disabled = true
    return
  }
  carpetasLista = lista
  carpetasResumen = await carpetas.resumenDeCarpetas().catch(() => new Map())
  pintarCarpetas()
}

function pintarCarpetas() {
  const caja = $('mcCarpetasPanel')
  const migas = $('mcCarpetaMigas')
  const barra = $('mcCarpetaBarra')
  const buscador = $('mcCarpetaBuscadorCaja')
  const mandos = $('mcCarpetasMandos')
  if (carpetaAbierta) {
    const c = carpetasLista.find((x) => x.id === carpetaAbierta)
    if (!c) {
      carpetaAbierta = null
      return pintarCarpetas()
    }
    const hijas = carpetasLista.filter((x) => x.parent_id === c.id).map((x) => ({ ...x, hijas: [] }))
    // La miga, en su forma CORTA desde la tanda 477: el nombre lo dice el
    // título grande de debajo, como en una expansión, y repetirlo en la
    // miga era decir dos veces lo mismo en dos renglónes seguidos.
    migas.innerHTML = migasHtml([{ texto: 'Álbumes', id: 'mcCarpetaVolver' }])
    $('mcCarpetaTitulo').textContent = c.nombre
    barra.classList.remove('hidden')
    buscador.classList.remove('hidden')
    // Dentro de una carpeta lo que se crea es una SUBcarpeta, y eso vive
    // en el ⋮: dos botones que crean cosas distintas con el mismo rótulo
    // es justo cómo se pulsa el que no era.
    mandos.classList.add('hidden')
    caja.innerHTML = (hijas.length ? carpetas.rejillaHtml(hijas, carpetasResumen) : '') +
      '<div class="mc-cartas" id="mcCarpetaCartas"></div>'
    pintarCartasDeCarpeta(c.id)
    return
  }
  migas.textContent = ''
  barra.classList.add('hidden')
  buscador.classList.add('hidden')
  mandos.classList.remove('hidden')
  // Al salir se olvida lo buscado: un filtro que sobrevive a la pantalla
  // que lo puso deja la siguiente medio vacía sin decir por qué.
  if ($('mcCarpetaBuscar')) $('mcCarpetaBuscar').value = ''
  caja.innerHTML = carpetas.rejillaHtml(carpetas.arbolDeCarpetas(carpetasLista), carpetasResumen)
}

// Las de dentro se piden UNA vez y se guardan: el buscador de la 477
// filtra en memoria, y volver a preguntar en cada tecla sería una consulta
// por letra.
let lineasDeLaCarpeta = []

async function pintarCartasDeCarpeta(id) {
  const hueco = $('mcCarpetaCartas')
  if (!hueco) return
  const ids = new Set(await carpetas.lineasDeCarpeta(id).catch(() => []))
  lineasDeLaCarpeta = lineas.filter((l) => ids.has(l.id))
  pintarCartasDeCarpetaFiltradas()
}

function pintarCartasDeCarpetaFiltradas() {
  const hueco = $('mcCarpetaCartas')
  if (!hueco) return
  const texto = normalizeSearch($('mcCarpetaBuscar')?.value || '').trim()
  // Por nombre y por colección, igual que el buscador de la pestaña
  // «Cartas»: dentro de una carpeta de 200 cartas, llegar a una a ojo es
  // lo mismo de imposible que dentro de una expansión (la lección de la
  // 417).
  const dentro = texto
    ? lineasDeLaCarpeta.filter((l) => {
        const c = cartas.get(l.card_id)
        return normalizeSearch(`${nombresDeCartaParaBuscar(c)} ${c?.local_id || ''} ${nombreDeSet(c?.tcg_sets)}`).includes(texto)
      })
    : lineasDeLaCarpeta
  hueco.innerHTML = dentro.length
    ? dentro.map(lineaHtml).join('')
    // Y el vacío DICE CUÁL de los dos vacíos es: una carpeta sin cartas no
    // es lo mismo que una búsqueda sin resultados, y la primera frase
    // mandaba a la ficha de una carta cuando el problema era lo escrito.
    : texto
      ? '<p class="empty-state">Ninguna carta de esta carpeta encaja con lo que buscas.</p>'
      : '<p class="empty-state">Esta carpeta todavía no tiene cartas. Ábrelas desde tu colección y métela en una carpeta desde su ficha.</p>'
}

// ── La Pokédex (tanda 381) ──
//
// Lo que TIENES no se consulta: tu colección ya está en memoria y de qué
// Pokémon es cada carta sale de su nombre. Lo único que se pregunta es
// cuántas hay en el catálogo de cada una, una vez por visita.
async function abrirPokedex() {
  const caja = $('mcPokedexPanel')
  if (!caja) return
  if (!pokedexCargada) {
    caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
    try {
      const [modulo, totales] = await Promise.all([
        import('./mi-coleccion/pokedex.js'),
        datos.pokedexResumen(mercado).catch(() => []),
      ])
      pokedex = modulo
      totalesPokedex = new Map((totales || []).map((f) => [Number(f.dex), Number(f.cartas)]))
      pokedexCargada = true
    } catch (err) {
      caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
      return
    }
  }
  // `?dex=25` entra directa a una especie (tanda 384): es lo que hace
  // que el enlace desde la ficha de una carta lleve a algún sitio y no
  // a una rejilla de 1.025 donde hay que buscarla otra vez.
  const pedida = Number(params.get('dex'))
  if (!especieAbierta && pedida >= 1 && pedida <= 1025) especieAbierta = pedida
  if (especieAbierta) return pintarEspecie(especieAbierta)
  pintarPokedex()
}

function pintarPokedex() {
  const caja = $('mcPokedexPanel')
  $('mcPdxMandos').classList.remove('hidden')
  const mio = pokedex.loMioPorEspecie(lineas, cartas)
  const filas = pokedex.filasDePokedex({
    mio,
    totales: totalesPokedex,
    soloMios: pdxSoloMios,
    texto: $('mcPdxBuscar').value,
  })
  // La cabecera con las cuatro cifras (tanda 400), y debajo la rejilla.
  // Se pinta siempre, incluso filtrando: «llevas 701 de 1.025» no puede
  // cambiar porque estés buscando «char», igual que el progreso de un
  // set no cambia al filtrar por rareza.
  const resumen = pokedex.resumenDePokedex({ mio, totales: totalesPokedex })
  caja.innerHTML = pokedex.cabeceraHtml(resumen, { nombreDe: (d) => especiePorDex(d) || `#${d}` }) +
    pokedex.rejillaHtml(filas, $('mcPdxOrden')?.value || 'dex')
  // Los puntos de la tira, como en una expansión (tanda 476). Se enganchan
  // DESPUÉS de pintar porque cuántos hay depende de cuántas tarjetas hayan
  // salido: «El que menos» no sale si es el mismo que «el que más».
  engancharPuntos('mcPokedexPanel')
  // El contador de arriba cuenta especies DISTINTAS, no cartas: es una
  // Pokédex, y lo que se llena son huecos de Pokémon.
  $('mcPdxCuenta').textContent = `${resumen.registrados} de 1.025 Pokémon`
}

let cartasDeLaEspecie = []
// Los filtros de la especie abierta (tanda 453). Se vacían al abrir otra:
// las rarezas de un Pikachu no son las de un Charizard, así que arrastrar
// un filtro de una especie a la siguiente dejaría la pantalla vacía sin
// que nada dijera por qué.
const filtrosEspecie = filtrosCatalogoVacios()
let textoEspecie = ''

// Repinta la especie abierta con los filtros puestos. Las cartas no se
// vuelven a pedir: están todas en memoria desde que se abrió, así que
// aquí se filtra en memoria —al revés que en Buscar, donde la consulta
// trae 120 de 21.000 y filtrar lo que vuelve sería filtrar la muestra.
function pintarEspecieFiltrada() {
  const caja = $('mcPokedexPanel')
  if (!caja || especieAbierta == null) return
  // «La tengo» en el idioma elegido, o en cualquiera (577).
  const tuyas = new Set(lineas.filter((l) => !pdxIdioma || l.idioma === pdxIdioma).map((l) => l.card_id))
  const grupos = valoresDeCartas(cartasDeLaEspecie, AYUDAS)
  // Se compara por el RÓTULO traducido y no por el valor crudo: la columna
  // tiene las dos formas mezcladas porque TCGdex traduce los enums y el
  // catálogo se ha importado en varios idiomas (tanda 455).
  const texto = normalizeSearch(textoEspecie).trim()
  const lista = cartasDeLaEspecie.filter((c) => {
    if (pdxSoloFaltan && tuyas.has(c.id)) return false
    if (!pasaFiltrosDeCarta(c, filtrosEspecie, AYUDAS)) return false
    // Por nombre, número o ilustrador, igual que el buscador de Buscar
    // (tanda 458). Aquí se hace en memoria porque las cartas de la especie
    // ya están todas cargadas; allí va en la consulta porque son 21.000.
    if (!texto) return true
    return normalizeSearch(`${nombresDeCartaParaBuscar(c)} ${c.local_id || ''} ${c.illustrator || ''} ${nombreDeSet(c.tcg_sets)}`).includes(texto)
  })
  // Los chips viven en el panel, que está FUERA de la caja que se repinta:
  // si se pintaran dentro, abrir el panel después de filtrar enseñaría los
  // de antes.
  const hueco = $('mcPdxGrupos')
  if (hueco) hueco.innerHTML = pokedex.gruposDeEspecieHtml(grupos, filtrosEspecie)
  caja.innerHTML = pokedex.especieHtml({
    dex: especieAbierta,
    cartas: lista,
    tuyas,
    sinCatalogo: cartasDeLaEspecie.length === 0,
    grupos,
    puestos: filtrosEspecie,
    deCuantas: cartasDeLaEspecie.length,
    texto: textoEspecie,
    soloFaltan: pdxSoloFaltan,
    idioma: pdxIdioma,
    idiomas: idiomasDeLaVista(),
  })
  // El selector de catálogo se repinta porque la cabecera entera es HTML
  // nuevo: sus `<option>` los pone `pintarVistas`, y sin esta llamada
  // saldría vacío — un desplegable sin opciones es peor que no tenerlo.
  pintarVistas()
  pintarIconos()
}

async function pintarEspecie(dex, { push = true } = {}) {
  const caja = $('mcPokedexPanel')
  if (push) irA({ ver: 'pokedex', dex })
  especieAbierta = dex
  $('mcPdxMandos').classList.add('hidden')
  caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
  let delCatalogo = []
  try {
    delCatalogo = await datos.cartasDeEspecie(dex, 300, mercado)
  } catch {
    // Que no se vea el catálogo no puede dejar la pantalla en blanco:
    // abajo se enseña lo tuyo igualmente.
  }
  const tuyas = new Set(lineas.map((l) => l.card_id))
  // Las TUYAS salen siempre, vengan o no del catálogo. Mientras la
  // columna `dex_ids` se esté rellenando, la consulta de arriba devuelve
  // poco o nada — y lo tuyo es justo lo que has venido a ver. Se saca
  // del NOMBRE, que ya está en memoria, así que no cuesta nada.
  const porId = new Map(delCatalogo.map((c) => [c.id, c]))
  for (const id of tuyas) {
    const c = cartas.get(id)
    if (c && !porId.has(id) && pokedex.esDeLaEspecie(c, dex)) porId.set(id, c)
  }
  const lista = [...porId.values()].sort(porSetYNumero)
  // Se guardan para la ficha (tanda 418): al pulsar una carta de aquí
  // hay que poder pintarla, y las que no son tuyas no están en `cartas`.
  cartasDeLaEspecie = lista
  for (const g of FILTROS_CATALOGO) filtrosEspecie[g.id].clear()
  textoEspecie = ''
  // Y los de la 577, por lo mismo: una especie no hereda lo de otra.
  pdxSoloFaltan = false
  pdxIdioma = ''
  pintarEspecieFiltrada()
}

// Por colección y, dentro, por número impreso: es el orden del álbum, y
// así una especie se lee como se leería en el archivador.
function porSetYNumero(a, b) {
  const fa = a.tcg_sets?.release_date || ''
  const fb = b.tcg_sets?.release_date || ''
  return String(fb).localeCompare(String(fa)) || porNumero(a, b)
}

// ── Los cambios (tanda 376) ──
//
// Lo que doy sale de las líneas que ya están cargadas (`cambio > 0`);
// lo que busco y el tablón piden tres consultas, y solo la primera vez
// que se abre la pestaña.
const loQueDoy = () => lineas.filter((l) => Number(l.cambio) > 0)

async function abrirCambios() {
  const caja = $('mcCambiosPanel')
  if (!caja) return
  if (cambiosCargados) return pintarCambios()
  caja.innerHTML = '<div class="skeleton" style="height:180px"></div>'
  try {
    ;[cambios, tablon] = await Promise.all([import('./mi-coleccion/cambios.js'), import('./mi-coleccion/tablon.js')])
    deseos = await cambios.deseosDe(sesion.user.id)
    cambiosCargados = true
    await pintarCambios()
  } catch (err) {
    // Sin la migración no se enseña un tablón vacío, que parecería que
    // no hay nadie: se dice qué falta. Es el mismo trato que le da el
    // resto de la página a `sinMigracion`.
    caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
  }
}

// Una cifra de los cambios. Mismo dibujo que las chapas del resto de la
// pantalla: el icono, el número y de qué va.
function chapaDeCambio(n, texto, icono) {
  return `<div class="mc-cambio-cifra">
    <span class="mc-cambio-icono" aria-hidden="true">${icons[icono] ? icons[icono](18) : ''}</span>
    <strong>${n}</strong>
    <span>${escapeHtml(texto)}</span>
  </div>`
}

async function pintarCambios() {
  const caja = $('mcCambiosPanel')
  const doy = loQueDoy()
  let tiene = []
  let busca = []
  try {
    // Las dos direcciones a la vez: son independientes y la pantalla
    // las enseña juntas.
    ;[tiene, busca] = await Promise.all([
      deseos.length ? cambios.quienTiene() : Promise.resolve([]),
      doy.length ? cambios.quienBusca() : Promise.resolve([]),
    ])
  } catch (err) {
    caja.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`
    return
  }
  tablonTiene = tiene
  tablonBusca = busca
  // Las cartas del tablón pueden no estar en el mapa: son de OTRA gente
  // y esta página solo cargó las tuyas.
  const faltan = [...tiene, ...busca, ...deseos].map((f) => f.card_id).filter((id) => !cartas.has(id))
  if (faltan.length) {
    const nuevas = await datos.cartasPorIds(faltan, mercado)
    for (const [id, c] of nuevas) cartas.set(id, c)
  }
  // LO PRIMERO, LAS CIFRAS (tanda 415). PINGU: «el tema de los cambios
  // ponlo mucho más visual, de otra manera». El problema no eran las
  // tarjetas de quien encaja contigo —esas ya llevan avatar, cartas y un
  // botón—, era que SIN NADA APUNTADO la pantalla eran cuatro cajas
  // grises de texto seguidas. Y sin nada apuntado es como la ve todo el
  // mundo la primera vez.
  const encajan = tiene.length + busca.length
  const vacio = !doy.length && !deseos.length
  caja.innerHTML = `
    ${
      // Sin nada apuntado, las tres chapas son tres CEROS, y debajo ya
      // están los tres pasos que explican qué hacer (tanda 439). Una fila
      // de ceros encima de «así funciona» no informa: ocupa. Con algo
      // apuntado sí dicen, que es cuando salen.
      vacio
        ? ''
        : `<div class="mc-cambio-cifras">
      ${chapaDeCambio(encajan, 'encajan contigo', 'refreshCw')}
      ${chapaDeCambio(doy.length, doy.length === 1 ? 'carta que das' : 'cartas que das', 'package')}
      ${chapaDeCambio(deseos.length, deseos.length === 1 ? 'carta que buscas' : 'cartas que buscas', 'target')}
    </div>`
    }
    ${
      vacio
        // Sin nada apuntado no se enseñan dos tablones vacíos: se enseña
        // CÓMO funciona, que es lo que hace falta la primera vez.
        ? `<ol class="mc-cambio-pasos">
             <li><span class="mc-cambio-paso">1</span><div><strong>Marca lo que das</strong><p class="subtext">Abre una repetida y pon cuántas copias das: <button type="button" class="link-btn" data-ir-cartas>ver tus cartas</button>.</p></div></li>
             <li><span class="mc-cambio-paso">2</span><div><strong>Apunta lo que buscas</strong><p class="subtext">Aquí abajo, con el buscador.</p></div></li>
             <li><span class="mc-cambio-paso">3</span><div><strong>Te decimos quién encaja</strong><p class="subtext">Y le escribes desde aquí, sin salir de PokeDoc.</p></div></li>
           </ol>`
        : tablon.tablonHtml({ tiene, busca, cartas, deseos, doy })
    }
    <section class="mc-cambio-bloque">
      <h3>Lo que das</h3>
      ${doy.length
        ? `<ul class="mc-lista-cartas">${doy.map((l) => filaDeCartaHtml(cartas.get(l.card_id), `das <strong>${l.cambio}</strong> de ${l.cantidad}`)).join('')}</ul>
           <p class="subtext">Se cambia en cada carta, con «Editar» → «Para cambio».</p>`
        : `<p class="subtext">Todavía no das ninguna. Abre una carta repetida, dale a «Editar» y pon cuántas copias das: <button type="button" class="link-btn" data-ir-cartas>ver tus cartas</button>.${repetidas().length ? ` Te sobran copias de ${repetidas().length} ${repetidas().length === 1 ? 'carta' : 'cartas'} — mira el <button type="button" class="link-btn" data-ir-resumen>resumen</button>.` : ''}</p>`}
    </section>
    <section class="mc-cambio-bloque">
      <h3>Lo que buscas</h3>
      <div class="mc-deseo-alta">
        <input type="search" id="mcDeseoBuscar" placeholder="Busca una carta para apuntarla…" autocomplete="off" />
        <div id="mcDeseoResultados" class="mc-deseo-resultados hidden"></div>
      </div>
      ${deseos.length
        ? `<ul class="mc-lista-cartas mc-deseos">${deseos.map(deseoHtml).join('')}</ul>
           <p class="subtext">Tu lista de búsqueda la ve todo el mundo: es lo que hace que alguien te escriba.</p>`
        : '<p class="subtext">Apunta las cartas que te faltan y te diremos quién las tiene.</p>'}
    </section>`
  engancharCambios()
}

// Las tres prioridades, con la palabra que las explica. El número solo
// no dice nada: «2» no es «la busco mucho».
const PRIORIDADES = [
  { valor: 1, nombre: 'La busco' },
  { valor: 2, nombre: 'La busco mucho' },
  { valor: 3, nombre: 'Es LA que me falta' },
]

// El buscador de la lista de búsqueda, con su propio turno: dos
// buscadores en la misma página compartiendo contador se pisarían.
let turnoDeseo = 0

async function buscarParaDesear() {
  const caja = $('mcDeseoResultados')
  const texto = normalizeSearch($('mcDeseoBuscar').value)
  const mio = ++turnoDeseo
  if (texto.length < 2) {
    caja.classList.add('hidden')
    caja.innerHTML = ''
    return
  }
  let lista
  try {
    lista = await buscarCartas(texto, 24)
  } catch (err) {
    if (mio !== turnoDeseo) return
    caja.classList.remove('hidden')
    caja.innerHTML = `<p class="subtext">${escapeHtml(err.message)}</p>`
    return
  }
  if (mio !== turnoDeseo) return
  // Las que ya están apuntadas se enseñan, pero desactivadas: quitarlas
  // de la lista haría pensar que el buscador no las encuentra.
  const yaEstan = new Set(deseos.map((d) => d.card_id))
  caja.classList.remove('hidden')
  caja.innerHTML = lista.length
    ? lista
        .map((c) => {
          const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
          const ya = yaEstan.has(c.id)
          return `<button type="button" class="mc-resultado" data-desear="${escapeHtml(c.id)}"${ya ? ' disabled' : ''}>
            ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
            <span class="mc-resultado-nombre">${escapeHtml(nombreDe(c))}</span>
            <span class="mc-resultado-set">${ya ? 'Ya la buscas' : `${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)} · ${escapeHtml(c.local_id)}`}</span>
          </button>`
        })
        .join('')
    : '<p class="subtext">Ninguna carta con ese nombre.</p>'
  // Y al mapa, que es de donde lo saca la lista al repintarse.
  for (const c of lista) if (!cartas.has(c.id)) cartas.set(c.id, c)
}

// El panel se repinta entero en cada cambio, así que los oyentes van
// UNA vez y sobre la caja de fuera —que no se repinta— y no sobre lo de
// dentro. Sin esto, apuntar tres deseos deja tres oyentes y el cuarto
// clic hace la misma cosa cuatro veces.
let cambiosEnganchados = false

function engancharCambios() {
  const caja = $('mcCambiosPanel')
  // El buscador SÍ se repinta, así que su oyente se pone cada vez; y va
  // en el elemento nuevo, que es otro objeto.
  const buscarDeseo = $('mcDeseoBuscar')
  if (buscarDeseo) buscarDeseo.addEventListener('input', buscarParaDesear)
  if (cambiosEnganchados) return
  cambiosEnganchados = true
  caja.addEventListener('change', async (e) => {
    const sel = e.target.closest('.mc-deseo-prioridad')
    if (!sel) return
    try {
      const nuevo = await cambios.cambiarPrioridad(sel.dataset.deseo, Number(sel.value))
      deseos = deseos.map((d) => (d.id === nuevo.id ? nuevo : d))
      showToast('Guardado.', 'success')
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
  caja.addEventListener('click', async (e) => {
    const escribir = e.target.closest('[data-escribir]')
    if (escribir) return abrirMensaje(escribir.dataset.escribir, escribir.dataset.direccion)

    const alResumen = e.target.closest('[data-ir-resumen]')
    if (alResumen) return cambiarPestania('resumen')

    // UN CAMINO ESCRITO EN PROSA ES UN ENLACE QUE NADIE COMPRUEBA (tanda
    // 524, y es la tercera vez). Estos dos textos decían «en la pestaña
    // “Cartas”», y esa pestaña SALIÓ DEL MENÚ en la 447 — la pantalla
    // sigue, pero se llega por el panel. O sea que llevaba desde entonces
    // mandando a buscar una pestaña que no está, en la primera pantalla de
    // Cambios. Un botón se rompe si su destino se borra; una frase, no.
    const aCartas = e.target.closest('[data-ir-cartas]')
    if (aCartas) return cambiarPestania('cartas')

    const desear = e.target.closest('[data-desear]')
    if (desear) {
      desear.disabled = true
      try {
        const d = await cambios.anadirDeseo({ user_id: sesion.user.id, card_id: desear.dataset.desear })
        deseos = [d, ...deseos]
        $('mcDeseoBuscar').value = ''
        showToast('Apuntada. Si alguien la da, saldrá arriba.', 'success')
        await pintarCambios()
      } catch (err) {
        desear.disabled = false
        showToast(err.message, err.yaEstaba ? 'info' : 'error')
      }
      return
    }

    const quitar = e.target.closest('[data-quitar-deseo]')
    if (quitar) {
      try {
        await cambios.borrarDeseo(quitar.dataset.quitarDeseo)
        deseos = deseos.filter((d) => d.id !== quitar.dataset.quitarDeseo)
        await pintarCambios()
      } catch (err) {
        showToast(err.message, 'error')
      }
    }
  })
}

// El mensaje se deja ESCRITO, no enviado: quien lo manda lo lee antes.
// Un botón que manda un mensaje a un desconocido sin enseñárselo es una
// forma rápida de quedar mal, y encima con el nombre de la casa.
function abrirMensaje(userId, direccion) {
  const filas = (direccion === 'tiene' ? tablonTiene : tablonBusca).filter((f) => f.user_id === userId)
  const persona = { reciproco: filas.some((f) => f.reciproco) }
  const texto = tablon.borradorDe(persona, filas.map((f) => ({ ...f, carta: cartas.get(f.card_id) })), direccion)
  location.href = `/mensajes.html?with=${encodeURIComponent(userId)}&texto=${encodeURIComponent(texto)}`
}

function deseoHtml(d) {
  const c = cartas.get(d.card_id)
  const sel = PRIORIDADES.map((p) => `<option value="${p.valor}"${p.valor === d.prioridad ? ' selected' : ''}>${escapeHtml(p.nombre)}</option>`).join('')
  return filaDeCartaHtml(
    c,
    `<select class="mc-deseo-prioridad" data-deseo="${escapeHtml(d.id)}" aria-label="Cuánto buscas ${escapeHtml(nombreDe(c))}">${sel}</select>
     <span class="mc-deseo-idioma">${d.idioma ? escapeHtml(idiomaDe(d.idioma).nombre) : 'cualquier idioma'}</span>
     <button type="button" class="link-btn mc-borrar" data-quitar-deseo="${escapeHtml(d.id)}" aria-label="Quitar ${escapeHtml(nombreDe(c))} de tu lista">${icons.trash(14)}</button>`
  )
}

function repintar() {
  pintarResumen()
  pintarFiltros()
  pintarCartas()
  if (album.set) pintarAlbum()
  // Y las pestañas que se pintan de una vez, si están abiertas (tanda
  // 377). Aquí estaba el fallo: `cambiarPestania` corre ANTES de que
  // lleguen las líneas —hace falta para que la pestaña que pide la
  // dirección se vea enseguida—, así que entrar directo a
  // /mi-coleccion?ver=resumen pintaba «Cuando añadas cartas» con la
  // colección todavía vacía... y ya no se volvía a pintar nunca.
  //
  // No se veía porque la prueba de la 374 PULSABA la pestaña, y para
  // entonces las líneas ya estaban. Un enlace directo, no.
  if (pestania === 'resumen') pintarResumenPanel()
  // Y los vistazos, por lo mismo: se pintan de lo que hay en memoria, y al
  // arrancar no hay nada todavía. Esta línea es la que evita repetir el
  // fallo de la 377 con una pieza nueva — el panel decía «todavía no has
  // añadido ninguna carta» con la colección entera cargada.
  if (pestania === 'resumen') void pintarVistazos()
  if (pestania === 'cambios' && esMia) abrirCambios()
  if (pestania === 'pokedex') abrirPokedex()
}

// Los iconos del menú y de la barra se ponen desde aquí y no en el HTML:
// el dibujo de cada uno vive en js/icons.js y copiarlo a mano en la página
// deja dos versiones del mismo icono que se separan.
// Se puede llamar las veces que haga falta (tanda 458): desde que la
// cabecera de una especie se vuelve a pintar entera, hay botones con
// `data-icono` que nacen después del arranque. Y como esto METE el dibujo
// al principio del elemento, sin la guarda una segunda pasada dejaría dos
// iconos en cada botón viejo — un fallo que se ve, pero solo si miras.
function pintarIconos() {
  for (const el of document.querySelectorAll('[data-icono]')) {
    if (el.querySelector('svg')) continue
    // Los de esta pantalla primero: viven en su propio módulo para no
    // engordar `js/icons.js`, que lo baja también la portada.
    const dibujar = ICONOS_COLECCION[el.dataset.icono] || icons[el.dataset.icono]
    if (dibujar) el.insertAdjacentHTML('afterbegin', dibujar(18))
  }
}

function enganchar() {
  pintarIconos()
  // El selector de catálogo (tanda 437), en los tres sitios a la vez.
  pintarVistas()
  for (const sel of document.querySelectorAll('.mc-mercado')) {
    sel.addEventListener('change', () => void cambiarVista(sel.value))
  }
  for (const b of document.querySelectorAll('[data-pestania]')) b.addEventListener('click', () => cambiarPestania(b.dataset.pestania))
  // Los ATAJOS a una pestaña (los del estado vacío) llevan su propio
  // gancho: hacen lo mismo que la barra, pero no SON la barra, y mezclar
  // los dos deja `[data-pestania]` sin identificar a nadie.
  for (const b of document.querySelectorAll('[data-ir-pestania]')) b.addEventListener('click', () => cambiarPestania(b.dataset.irPestania))
  // AQUÍ VIVÍA el observador que apartaba la barra flotante al llegar al
  // pie (tanda 406). Se fue en la 419 y el motivo merece quedar escrito:
  // en una página CORTA el pie se ve desde el primer momento, así que la
  // barra nacía escondida y en el móvil no había forma de cambiar de
  // pestaña. Un menú que desaparece es peor que un menú que tapa.
  //
  // Lo que había que resolver —que la barra no se coma los enlaces del
  // pie— se resuelve en el CSS y sin piezas móviles: el pie reserva su
  // sitio. Así la barra está SIEMPRE, como en una app.

  let esperaCatalogo = null
  for (const id of ['mcBuscar', 'mcFiltroSet', 'mcFiltroIdioma']) {
    $(id).addEventListener(id === 'mcBuscar' ? 'input' : 'change', () => {
      pintarCartas()
      pintarCuentaDeFiltros()
      // Y el catálogo detrás, con su espera: lo tuyo se filtra en memoria
      // y es instantáneo, pero esto es una consulta por tecla.
      if (id !== 'mcBuscar') return
      clearTimeout(esperaCatalogo)
      esperaCatalogo = setTimeout(buscar, 250)
    })
  }

  // ── Importar y exportar (tanda 580) ──
  document.addEventListener('click', async (e) => {
    if (e.target.closest('#mcImportarAbrir, .mc-importar-abrir')) {
      const { abrirImportar } = await import('./mi-coleccion/importar.js')
      abrirImportar({
        sesion,
        mercado,
        alTerminar: async () => {
          await cargarColeccion(dueno.id)
          repintar()
        },
      })
    } else if (e.target.closest('#mcExportar')) {
      const { descargarExport } = await import('./mi-coleccion/importar.js')
      const todas = lineasTodo.length ? lineasTodo : lineas
      descargarExport({ lineas: todas, cartaDe: (l) => cartasTodo.get(datos.claveDeLineaEnMercado(l)) || cartas.get(l.card_id) || null })
    }
  })

  // ── Mi colección en una imagen (tanda 571) ──
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#mcImagenCrear')) return
    const d = $('mcImagenDialogo')
    if (!d || !resumenHero) return
    const [ls, clave, busca] = pTodo()
    // Las tres que más valen, con la cadena de fotos de cada una.
    const valiosas = masValiosas(3, ls, clave, busca).map((v) => ({
      nombre: nombreDe(v.carta),
      cadena: cadenaDeEscaneo(v.carta, v.carta?.tcg_sets?.tcg_online_code || null, 'high'),
      valor: euros(v.valor),
    }))
    // La expansión más completa: la misma cuenta que el vistazo de
    // Expansiones, y el total oficial del set.
    const sets = await cargarSets().catch(() => null)
    let mejorSet = null
    for (const s of sets || []) {
      const suyas = [...cartas.values()].filter((c) => c?.set_id && (padreDeColeccion(c.set_id) || c.set_id) === s.id)
      const tengo = suyas.filter((c) => tengoDe(c.id) > 0).length
      const total = Number(s.card_count_official) || Number(s.card_count_total) || suyas.length
      if (!tengo || !total) continue
      const pct = tengo / total
      if (!mejorSet || pct > mejorSet.pct) mejorSet = { nombre: nombreDeSet(s) || s.id, tengo, total, pct }
    }
    const datos = {
      quien: dueno?.username || null,
      ...resumenHero,
      valiosas,
      mejorSet: mejorSet ? { nombre: mejorSet.nombre, tengo: mejorSet.tengo, total: mejorSet.total } : null,
      desde: $('mcHeroDesde')?.textContent?.trim() || '',
    }
    // A mano, para la prueba y para depurar: lo que se le dio al dibujo.
    window.__mcImagenDatos = datos
    d.showModal()
    const { pintarImagenDeColeccion } = await import('./mi-coleccion/imagen.js')
    await pintarImagenDeColeccion($('mcImagenLienzo'), datos)
  })
  $('mcImagenCerrar')?.addEventListener('click', () => $('mcImagenDialogo').close())
  $('mcImagenCompartir')?.addEventListener('click', async () => {
    const { compartirLienzo } = await import('./imagen-compartir.js')
    compartirLienzo($('mcImagenLienzo'), {
      nombreFichero: `mi-coleccion${dueno?.username ? `-${dueno.username}` : ''}.png`,
      texto: 'Mi colección de Pokémon TCG en PokeDoc. pokedoc.es/mi-coleccion',
    })
  })
  $('mcImagenDescargar')?.addEventListener('click', async () => {
    const { descargarLienzo } = await import('./imagen-compartir.js')
    descargarLienzo($('mcImagenLienzo'), `mi-coleccion${dueno?.username ? `-${dueno.username}` : ''}.png`)
  })

  // ── La nota, plegada (tanda 405) ──
  // ── Añadir, como en TCGGO (tanda 650) ──
  $('mcEdMas')?.addEventListener('click', () => cartaAbierta && abrirAnadir(cartaAbierta))
  $('mcEdTienes')?.addEventListener('click', () => $('mcEdCopiaBloque')?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  $('mcEdOtrasCopias')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-linea-otra]')
    const otra = b && lineas.find((x) => x.id === b.dataset.lineaOtra)
    if (otra) abrirEditor(otra)
  })
  for (const id of ['mcAdCerrar', 'mcAdYaCerrar', 'mcAdCancelar']) $(id)?.addEventListener('click', () => $('mcAnadirDialogo').close())
  $('mcAdMas')?.addEventListener('click', () => caraDeAnadir('form'))
  $('mcAdIdiomas')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.mc-idioma-chip')
    if (!chip) return
    for (const x of $('mcAdIdiomas').querySelectorAll('.mc-idioma-chip')) {
      const puesto = x === chip
      x.classList.toggle('activo', puesto)
      x.setAttribute('aria-checked', puesto ? 'true' : 'false')
    }
  })
  $('mcAdForm')?.addEventListener('submit', (e) => void guardarAnadir(e))

  // Quitar desde la ficha (tanda 574): es el cero del contador, con su
  // pregunta. Un camino que ya existía, con un nombre.
  $('mcEdQuitar')?.addEventListener('click', () => {
    $('mcEdCantidad').value = '0'
    guardarEditor()
  })
  // Los del resumen (645): Editar despliega los campos de siempre; Quitar
  // es el mismo camino que el de dentro (pregunta y quita).
  $('mcEdEditar')?.addEventListener('click', () => {
    const campos = $('mcEdCopiaCampos')
    const abierto = campos.classList.toggle('hidden') === false
    $('mcEdEditar').setAttribute('aria-expanded', String(abierto))
    $('mcEdEditar').textContent = abierto ? 'Listo' : 'Editar'
    if (abierto) $('mcEdIdioma')?.focus()
  })
  $('mcEdQuitarResumen')?.addEventListener('click', () => $('mcEdQuitar')?.click())

  $('mcEdNotaAbrir').addEventListener('click', () => {
    pintarNota($('mcEdNotas').value, true)
    $('mcEdNotas').focus()
  })
  // Tocar la nota puesta la abre para cambiarla: si no, habría que
  // borrarla para corregir una letra.
  $('mcEdNotaPuesta').addEventListener('click', () => {
    pintarNota($('mcEdNotas').value, true)
    $('mcEdNotas').focus()
  })
  $('mcEdNotaCerrar').addEventListener('click', () => pintarNota($('mcEdNotas').value, false))
  $('mcEdNotaQuitar').addEventListener('click', () => {
    $('mcEdNotas').value = ''
    pintarNota('', false)
    // Se guarda al momento, como todo lo demás: quitar una nota es un
    // cambio, no un borrador.
    guardarEditor()
  })

  // ── Las carpetas (tandas 402 y 411) ──
  //
  // El `window.prompt` se fue en la 411: pedía el nombre y nada más, así
  // que una carpeta nacía sin cara y había que ir a editarla para
  // ponérsela. Ahora el diálogo pregunta las tres cosas de una vez.
  iniciarDialogoAdorno()
  $('mcCarpetaNueva').addEventListener('click', () => {
    abrirDialogoAdorno({
      titulo: 'Nueva carpeta',
      boton: 'Crear carpeta',
      alGuardar: async (v) => {
        try {
          // Si estás DENTRO de una, la nueva nace dentro: es lo que
          // esperas al pulsar «nueva» estando en «Vintage».
          await carpetas.crearCarpeta(sesion.user.id, { ...v, parent_id: carpetaAbierta })
          await recargarCarpetas()
        } catch (err) {
          showToast(err.message, 'error')
        }
      },
    })
  })
  // ── El ⋮ de una carpeta abierta (tanda 477) ──
  //
  // Las dos acciones que antes solo existían desde FUERA: crear dentro
  // —que era pulsar «Nueva carpeta» estando dentro, y no lo decía ninguna
  // palabra— y cambiarla, que pedía salir, buscar su burbuja y pulsar su
  // engranaje.
  $('mcCarpetaSub')?.addEventListener('click', () => $('mcCarpetaNueva').click())
  $('mcCarpetaEditar')?.addEventListener('click', () => {
    const c = carpetasLista.find((x) => x.id === carpetaAbierta)
    if (c) editarCarpeta(c)
  })
  $('mcCarpetaBuscar')?.addEventListener('input', pintarCartasDeCarpetaFiltradas)

  $('mcCarpetasPanel').addEventListener('click', async (e) => {
    const abrir = e.target.closest('[data-abrir]')
    if (abrir) {
      carpetaAbierta = abrir.dataset.abrir
      return pintarCarpetas()
    }
    const editar = e.target.closest('[data-ajustes]')
    if (!editar) return
    const c = carpetasLista.find((x) => x.id === editar.dataset.ajustes)
    if (!c) return
    editarCarpeta(c)
  })

  // El diálogo de cambiar una carpeta, en una función: lo abren el
  // engranaje de su burbuja y el ⋮ de dentro (tanda 477), y escribirlo dos
  // veces es como se separan dos cosas que tenían que ser una.
  function editarCarpeta(c) {
    abrirDialogoAdorno({
      titulo: 'Cambiar la carpeta',
      boton: 'Guardar',
      valores: { nombre: c.nombre, icono: c.icono, dex_id: c.dex_id, emoji: c.emoji, color: c.color },
      alGuardar: async (v) => {
        try {
          await carpetas.renombrarCarpeta(c.id, v)
          await recargarCarpetas()
        } catch (err) {
          showToast(err.message, 'error')
        }
      },
      alBorrar: async () => {
        // Borrar se lleva las SUBcarpetas, así que se avisa de eso y no
        // de «se borrará la carpeta» a secas. Las cartas no se tocan:
        // viven en tu colección, no en la carpeta.
        const hijas = carpetasLista.filter((x) => x.parent_id === c.id).length
        const aviso = hijas
          ? `¿Borrar «${c.nombre}» y sus ${hijas} subcarpetas? Las cartas se quedan en tu colección.`
          : `¿Borrar «${c.nombre}»? Las cartas se quedan en tu colección.`
        if (!window.confirm(aviso)) return
        try {
          await carpetas.borrarCarpeta(c.id)
          if (carpetaAbierta === c.id) carpetaAbierta = c.parent_id || null
          await recargarCarpetas()
        } catch (err) {
          showToast(err.message, 'error')
        }
      },
    })
  }

  $('mcCarpetaMigas').addEventListener('click', (e) => {
    // Por ID desde la tanda 474: la miga ya no lleva `data-volver-carpetas`
    // —el molde común pone un identificador y nada más—, y el viejo se
    // queda admitido por si alguna prueba o algún sitio lo usa todavía.
    if (!e.target.closest('#mcCarpetaVolver, [data-volver-carpetas]')) return
    const c = carpetasLista.find((x) => x.id === carpetaAbierta)
    carpetaAbierta = c?.parent_id || null
    pintarCarpetas()
  })

  // Meter y sacar la carta abierta de una carpeta, desde su ficha.
  $('mcEdCarpetas').addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-carpeta-chip]')
    if (!chip) return
    const id = $('mcEditor').dataset.linea
    if (!id) return
    const folder = chip.dataset.carpetaChip
    const dentro = chip.getAttribute('aria-pressed') === 'true'
    try {
      if (dentro) await carpetas.sacarDeCarpeta(folder, id)
      else await carpetas.meterEnCarpeta(folder, id)
      // Se repinta desde la base y no a ojo: si la escritura falló, el
      // chip se quedaría diciendo que está dentro cuando no lo está.
      await pintarCarpetasDeLaFicha(id)
      carpetasResumen = await carpetas.resumenDeCarpetas().catch(() => carpetasResumen)
    } catch (err) {
      showToast(err.message, 'error')
    }
  })

  // ── El panel de filtros (tanda 399) ──
  $('mcAbrirFiltros').addEventListener('click', () => {
    pintarGruposDeChips()
    $('mcPanelFiltros').showModal()
  })
  $('mcFiltrosCerrar').addEventListener('click', () => $('mcPanelFiltros').close())
  $('mcFiltrosVer').addEventListener('click', () => $('mcPanelFiltros').close())
  // Pulsar fuera también cierra, igual que la ficha: mirar que el clic
  // caiga FUERA de la caja y no solo que el destino sea el diálogo.
  $('mcPanelFiltros').addEventListener('click', (e) => {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!dentro) e.currentTarget.close()
  })
  $('mcGruposChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-grupo]')
    if (!chip) return
    const conjunto = filtros[chip.dataset.grupo]
    if (conjunto.has(chip.dataset.valor)) conjunto.delete(chip.dataset.valor)
    else conjunto.add(chip.dataset.valor)
    pintarGruposDeChips()
    pintarCartas()
    pintarCuentaDeFiltros()
  })
  $('mcAbrirOrden').addEventListener('click', () => {
    pintarHojaOrden()
    $('mcHojaOrden').showModal()
  })
  $('mcOrdenCerrar').addEventListener('click', () => $('mcHojaOrden').close())
  $('mcHojaOrden').addEventListener('click', (e) => {
    const sentido = e.target.closest('[data-sentido]')
    if (sentido) {
      sentidoElegido = sentido.dataset.sentido
      pintarHojaOrden()
      pintarCartas()
      return
    }
    const criterio = e.target.closest('[data-orden]')
    if (criterio) {
      // Al cambiar de criterio se pone SU sentido natural: el precio se
      // mira de más caro a más barato y el nombre de la A a la Z, y
      // heredar el sentido del criterio anterior deja la lista al revés
      // de como la espera quien acaba de elegir.
      ordenElegido = criterio.dataset.orden
      sentidoElegido = sentidoNatural(ordenElegido)
      pintarHojaOrden()
      pintarCartas()
      // Elegir un criterio ES la respuesta a la pregunta de la hoja, así
      // que la hoja se va. El sentido no la cierra: es un ajuste del
      // mismo criterio y se toca mirando el resultado.
      $('mcHojaOrden').close()
      return
    }
    // Pulsar fuera de la hoja la cierra, como el panel de filtros.
    const c = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom
    if (!dentro) e.currentTarget.close()
  })
  $('mcFiltrosLimpiar').addEventListener('click', limpiarFiltros)
  // El ✕ de la barra limpia ADEMÁS el texto, porque es lo que se ve a su
  // lado: dejarlo puesto haría que la lista siguiera recortada después de
  // pulsar «quitar» y parecería que no ha hecho nada.
  $('mcFiltrosQuitar').addEventListener('click', () => {
    $('mcBuscar').value = ''
    limpiarFiltros()
  })
  $('mcCartas').addEventListener('click', (e) => {
    // Ahora la ficha se abre pulsando la CARTA, no un botón «Editar» en
    // cada fila (tanda 392). `data-editar` se sigue aceptando: lo usan
    // otras pantallas que todavía pintan la fila con su botón.
    if (!e.target.closest('[data-ficha], [data-editar]')) return
    const l = lineas.find((x) => x.id === e.target.closest('[data-linea]').dataset.linea)
    if (!l) return
    fijarVecindario('mcCartas', '[data-linea]', 'linea', l.id)
    abrirEditor(l)
  })
  $('mcFaltanCopiar')?.addEventListener('click', () => void copiarLoQueFalta())

  // Los «ver todas» de los vistazos (tanda 436). Delegado en la caja, que
  // no se repinta: los vistazos de dentro sí, y uno por botón habría que
  // volver a colgarlo cada vez.
  $('mcVistazos')?.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-ir-a]')
    if (ir) {
      // «Ver todas» de Expansiones son TODAS (tanda 649): si «Solo las
      // empezadas» se quedó pulsado de antes, se quita, que si no el botón
      // dice una cosa y la estantería enseña otra.
      if (ir.dataset.irA === 'album' && soloEmpezadas) {
        soloEmpezadas = false
        $('mcEstanteriaEmpezadas')?.classList.remove('activo')
        $('mcEstanteriaEmpezadas')?.setAttribute('aria-pressed', 'false')
        void pintarEstanteria()
      }
      return cambiarPestania(ir.dataset.irA)
    }
    // Y una expansión del vistazo abre esa expansión, no la estantería: es
    // lo que espera quien pulsa una tarjeta con su nombre y su progreso.
    const set = e.target.closest('[data-set]')
    if (!set) return
    cambiarPestania('album')
    void abrirAlbum(set.dataset.set)
  })

  // ── Marcar varias (tanda 426) ──
  $('mcMarcarAbrir')?.addEventListener('click', () => modoMarcar(!marcadas))
  $('mcMarcarCancelar')?.addEventListener('click', () => modoMarcar(false))
  $('mcMarcarGuardar')?.addEventListener('click', () => void guardarMarcadas())
  // Con el teclado: un enlace ya responde a Intro, pero `role="button"`
  // promete también la BARRA ESPACIADORA, y un enlace no la tiene.
  $('mcAlbum')?.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Spacebar') return
    const enlace = e.target.closest('.mc-bolsillo-enlace[data-marca]')
    if (!marcadas || !enlace) return
    e.preventDefault()
    alternarMarca(enlace)
  })

  // Las flechas y el cerrar de la ficha (tanda 422).
  $('mcEdAnterior')?.addEventListener('click', () => void abrirVecino(-1))
  $('mcEdSiguiente')?.addEventListener('click', () => void abrirVecino(1))
  $('mcEdCerrar')?.addEventListener('click', () => $('mcEditor').close())
  // Y con el teclado, que es como se repasa una lista larga. Solo cuando
  // el foco NO está en un campo: dentro de un desplegable o de un número
  // las flechas ya hacen lo suyo, y robárselas sería cambiar el valor de
  // la carta creyendo que pasas a la siguiente.
  $('mcEditor').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (e.target.closest('input, select, textarea')) return
    e.preventDefault()
    void abrirVecino(e.key === 'ArrowRight' ? 1 : -1)
  })

  // Pulsar FUERA cierra la ficha (tanda 395). Un `<dialog>` no lo hace
  // solo: el clic en el fondo llega al propio diálogo, así que se mira si
  // el destino ES el diálogo —y no algo de dentro— y si cae fuera de su
  // caja. Sin lo segundo, pulsar en el hueco entre dos campos lo cerraría
  // con lo que estabas escribiendo a medias.
  $('mcEditor').addEventListener('click', (e) => {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!dentro) e.currentTarget.close()
  })

  // El holo de la rejilla, montado la PRIMERA vez que el ratón entra en
  // una carta y no al pintarlas: con trescientas, montarlo en todas sería
  // trescientos juegos de escuchas para las dos o tres por las que vas a
  // pasar. `once` por tarjeta, que el módulo ya se encarga del resto.
  $('mcCartas').addEventListener('pointerover', (e) => {
    const caja = e.target.closest('.mc-carta-foto')
    if (!caja || caja.dataset.holoPuesto) return
    caja.dataset.holoPuesto = '1'
    import('./carta-holo.js').then(({ montarHolo }) => montarHolo(caja)).catch(() => {})
  })

  // Los dos botones del contador. Suman sobre lo que haya escrito, y se
  // quedan dentro de los topes del propio campo: pulsar «−» con una sola
  // copia no puede dejarte en cero, que es «no la tengo» y eso se dice
  // quitándola de la colección, no poniendo un cero.
  for (const b of document.querySelectorAll('.mc-contador-btn')) {
    b.addEventListener('click', () => {
      // El campo es el de SU mando y no uno escrito aquí: desde la 563
      // hay dos contadores en la ficha —copias y «Para cambio»— y con el
      // id a pelo los dos botones de abajo movían el de arriba.
      const campo = b.closest('.mc-contador-mando')?.querySelector('input')
      if (!campo) return
      const n = Math.round(Number(campo.value) || 0) + Number(b.dataset.paso)
      // `Number(campo.min) || 1` estaba mal desde que el mínimo es CERO:
      // el 0 es falsy, así que el `||` lo convertía en 1 y el «−» nunca
      // llegaba a quitar la última copia.
      const tope = Number(campo.max)
      const suelo = Number(campo.min)
      campo.value = String(Math.min(Number.isFinite(tope) ? tope : 999, Math.max(Number.isFinite(suelo) ? suelo : 0, n)))
      campo.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  // Cada campo se guarda solo (tanda 397). Los desplegables y el
  // contador, al soltar; lo que se escribe, con medio segundo de
  // retardo, que si no sale una petición por tecla.
  for (const id of ['mcEdIdioma', 'mcEdEstado', 'mcEdVariante', 'mcEdGradeoNota']) {
    $(id).addEventListener('change', () => guardarEditor())
  }
  // La casa repinta las notas ANTES de guardar: cambiar de PSA a Beckett
  // deja una nota que la casa nueva no da, y guardar eso escribiría un
  // «BGS 1.5» de un «PSA 1.5» que sí existía. Al cambiar de casa la nota
  // se vacía y se vuelve a elegir, que es lo que de verdad ha pasado.
  $('mcEdGradeoCasa').addEventListener('change', (e) => {
    pintarNotaDeGradeo(e.target.value)
    guardarEditor()
  })
  for (const id of ['mcEdCantidad', 'mcEdCambio']) {
    $(id).addEventListener('change', () => guardarEditor())
  }
  for (const id of ['mcEdGradeo', 'mcEdValor', 'mcEdCompra', 'mcEdNotas']) {
    $(id).addEventListener('input', () => guardarEditor({ retardo: 600 }))
  }
  // Y al cerrar, lo que quedara en el aire se manda: si no, escribir una
  // nota y pulsar fuera antes de los 600 ms la perdería.
  $('mcEditor').addEventListener('close', () => {
    if (guardadoPendiente) {
      clearTimeout(guardadoPendiente)
      guardadoPendiente = null
    }
  })

  // La estantería: buscar, filtrar por serie y abrir una colección.
  for (const id of ['mcEstanteriaBuscar', 'mcEstanteriaSerie']) {
    $(id).addEventListener(id === 'mcEstanteriaBuscar' ? 'input' : 'change', () => pintarEstanteria())
  }
  // El escáner (tanda 447).
  $('mcEscanear')?.addEventListener('click', () => void abrirEscaner())
  $('mcEscanerCerrar')?.addEventListener('click', cerrarEscaner)
  $('mcEscanerDisparo')?.addEventListener('click', () => void dispararEscaner())
  // Y con la tecla de escape, que es como se cierra un diálogo. El evento
  // `close` lo cubre todo: lo dispara tanto el botón como el escape, así
  // que la cámara se apaga por los dos caminos sin escribirlo dos veces.
  $('mcEscanerCaja')?.addEventListener('close', cerrarEscaner)

  // El buscador de todo el catálogo (tanda 447).
  $('mcBuscarTodo')?.addEventListener('input', () => void buscarEnTodo())
  // ── Los mandos de Buscar (tanda 450) ──
  $('mcBuscarAbrirOrden')?.addEventListener('click', () => {
    pintarBandejaCatalogo()
    $('mcBuscarHojaOrden').showModal()
  })
  $('mcBuscarOrdenCerrar')?.addEventListener('click', () => $('mcBuscarHojaOrden').close())
  $('mcBuscarHojaOrden')?.addEventListener('click', (e) => {
    const sentido = e.target.closest('[data-bsentido]')
    if (sentido) {
      sentidoCatalogo = sentido.dataset.bsentido
      pintarBandejaCatalogo()
      void buscarEnTodo()
      return
    }
    const criterio = e.target.closest('[data-borden]')
    if (criterio) {
      ordenCatalogo = criterio.dataset.borden
      sentidoCatalogo = sentidoNatural(ordenCatalogo)
      pintarBandejaCatalogo()
      void buscarEnTodo()
      $('mcBuscarHojaOrden').close()
      return
    }
    const c = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom
    if (!dentro) e.currentTarget.close()
  })
  $('mcBuscarAbrirFiltros')?.addEventListener('click', () => {
    pintarGruposDelCatalogo()
    $('mcBuscarPanelFiltros').showModal()
  })
  $('mcBuscarFiltrosCerrar')?.addEventListener('click', () => $('mcBuscarPanelFiltros').close())
  $('mcBuscarFiltrosVer')?.addEventListener('click', () => $('mcBuscarPanelFiltros').close())
  $('mcBuscarFiltrosLimpiar')?.addEventListener('click', () => {
    for (const g of FILTROS_CATALOGO) filtrosCatalogo[g.id].clear()
    pintarGruposDelCatalogo()
    void buscarEnTodo()
  })
  $('mcBuscarGrupos')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cgrupo]')
    if (!chip) return
    const conjunto = filtrosCatalogo[chip.dataset.cgrupo]
    if (conjunto.has(chip.dataset.cvalor)) conjunto.delete(chip.dataset.cvalor)
    else conjunto.add(chip.dataset.cvalor)
    pintarGruposDelCatalogo()
    void buscarEnTodo()
  })
  $('mcBuscarPanelFiltros')?.addEventListener('click', (e) => {
    const c = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom
    if (!dentro) e.currentTarget.close()
  })
  // Las sugerencias del estado vacío escriben en el campo y buscan: son un
  // ejemplo que se puede pulsar, no un adorno.
  $('mcBuscarVacio')?.addEventListener('click', (e) => {
    const s = e.target.closest('[data-sugerencia]')
    if (!s) return
    $('mcBuscarTodo').value = s.dataset.sugerencia
    void buscarEnTodo()
  })

  $('mcEstanteriaEmpezadas')?.addEventListener('click', () => {
    soloEmpezadas = !soloEmpezadas
    $('mcEstanteriaEmpezadas').classList.toggle('activo', soloEmpezadas)
    $('mcEstanteriaEmpezadas').setAttribute('aria-pressed', soloEmpezadas ? 'true' : 'false')
    void pintarEstanteria()
  })
  // Quitar los filtros los quita LOS TRES, que es lo que espera quien
  // pulsa «quitar los filtros»: dejar uno puesto sería dejar la pantalla
  // igual de vacía y el botón pareciendo roto.
  $('mcEstanteriaLimpiar')?.addEventListener('click', () => {
    const buscar = $('mcEstanteriaBuscar')
    if (buscar) buscar.value = ''
    const serie = $('mcEstanteriaSerie')
    if (serie) serie.value = ''
    soloEmpezadas = false
    $('mcEstanteriaEmpezadas')?.classList.remove('activo')
    $('mcEstanteriaEmpezadas')?.setAttribute('aria-pressed', 'false')
    void pintarEstanteria()
  })
  $('mcEstanteriaRejilla').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]')
    if (b) abrirAlbum(b.dataset.set)
  })
  respaldarNombresDeSet($('mcEstanteriaRejilla'))
  $('mcAlbumFavorito').addEventListener('click', cambiarFavorita)

  // ── El menú de ⋮ se cierra solo (tanda 475) ──
  //
  // Un `<details>` se queda abierto hasta que alguien lo cierra, y un menú
  // que sigue abierto encima de lo que acabas de cambiar tapa justo lo que
  // has venido a mirar. Así que al elegir una opción se cierra — pero no
  // al tocar los dos desplegables de «al pulsar +», que son un ajuste y no
  // una acción: ahí se suele cambiar los dos seguidos.
  //
  // Y va por CLASE y no por el identificador del menú de una expansión
  // (tanda 477): la carpeta abierta tiene el suyo, y copiar estas seis
  // líneas con otro `#id` delante es cómo se acaba con un menú que se
  // cierra y otro que no.
  for (const menu of document.querySelectorAll('.mc-menu-caja')) {
    menu.addEventListener('click', (e) => {
      if (e.target.closest('.mc-menu-opcion')) menu.open = false
    })
  }
  // Y al tocar fuera, como cualquier menú. Uno solo para todos: se cierra
  // el que esté abierto y que no haya recibido el clic.
  document.addEventListener('click', (e) => {
    for (const menu of document.querySelectorAll('.mc-menu-caja[open]')) {
      if (!menu.contains(e.target)) menu.open = false
    }
  })
  // DELEGADO, porque la miga se pinta con la pantalla (tanda 474): al
  // arrancar `#mcAlbumVolver` todavía no existe, y un `addEventListener`
  // sobre un elemento que no está no engancha nada — y no da error, que es
  // lo peor: el botón sale y no hace nada.
  $('mcArchivadorZona').addEventListener('click', (e) => {
    if (e.target.closest('#mcAlbumVolver')) volverALaEstanteria()
  })

  // ── La Pokédex (tanda 381) ──
  //
  // Los dos mandos y la delegación del clic van AQUÍ y no dentro de la
  // pestaña: el panel se repinta entero en cada filtro, así que un
  // oyente puesto dentro se duplicaría en cada tecla. La caja de fuera
  // no se repinta nunca.
  for (const id of ['mcPdxBuscar', 'mcPdxOrden']) {
    $(id).addEventListener(id === 'mcPdxBuscar' ? 'input' : 'change', () => {
      // Al filtrar se vuelve a la rejilla: filtrar con una especie
      // abierta no significa nada.
      especieAbierta = null
      if (pokedexCargada) pintarPokedex()
    })
  }
  // «Solo los que tengo» es una CHAPA desde la 465, así que su estado lo
  // guarda una variable y no un `checked`.
  $('mcPdxSoloMios').addEventListener('click', () => {
    pdxSoloMios = !pdxSoloMios
    $('mcPdxSoloMios').classList.toggle('activo', pdxSoloMios)
    $('mcPdxSoloMios').setAttribute('aria-pressed', pdxSoloMios ? 'true' : 'false')
    especieAbierta = null
    if (pokedexCargada) pintarPokedex()
  })
  $('mcPanelPokedex').addEventListener('click', (e) => {
    const especie = e.target.closest('[data-dex]')
    if (especie) return pintarEspecie(Number(especie.dataset.dex))
    if (e.target.closest('#pdxVolver')) {
      especieAbierta = null
      // Y fuera de la dirección: si se queda, recargar vuelve a abrir la
      // especie que acabas de cerrar. Con `pushState` desde la 468, para
      // que el botón de atrás del navegador haga lo mismo que este.
      irA({ dex: null })
      pintarPokedex()
    }
  })
  for (const id of ['mcAlbumRareza', 'mcAlbumTipo', 'mcAlbumOrden', 'mcAlbumIdioma']) {
    $(id).addEventListener('change', () => {
      // Al filtrar se vuelve a la primera página: seguir en la 7 de una
      // lista que ahora tiene 2 deja el archivador en blanco.
      album.pagina = 0
      pintarAlbum()
    })
  }
  $('mcAlbumSoloFaltan').addEventListener('click', () => {
    album.soloFaltan = !album.soloFaltan
    pintarSoloFaltan()
    album.pagina = 0
    pintarAlbum()
  })

  // ── El panel de filtros de una expansión (tanda 473) ──
  //
  // Mismo enganche que los otros tres de la sección. El clic en el FONDO
  // cierra: es lo que espera quien abre una hoja desde abajo en el móvil, y
  // se distingue del clic de dentro porque `e.target` es el propio
  // `<dialog>` — su caja ocupa toda la pantalla y el contenido va en hijos.
  $('mcAlbumAbrirFiltros')?.addEventListener('click', () => {
    pintarFiltrosDeAlbum()
    $('mcAlbumPanelFiltros').showModal()
  })
  $('mcAlbumFiltrosCerrar')?.addEventListener('click', () => $('mcAlbumPanelFiltros').close())
  $('mcAlbumFiltrosVer')?.addEventListener('click', () => $('mcAlbumPanelFiltros').close())
  $('mcAlbumPanelFiltros')?.addEventListener('click', (e) => {
    if (e.target === $('mcAlbumPanelFiltros')) $('mcAlbumPanelFiltros').close()
  })
  $('mcAlbumFiltrosLimpiar')?.addEventListener('click', limpiarFiltrosDeAlbum)
  // Y el ✕ de la barra, que quita TAMBIÉN lo escrito: para quien mira, «lo
  // que estoy filtrando» incluye la búsqueda.
  $('mcAlbumQuitar')?.addEventListener('click', () => {
    if ($('mcAlbumBuscar')) $('mcAlbumBuscar').value = ''
    limpiarFiltrosDeAlbum()
  })
  // ── El color de la tapa (tanda 371) ──
  //
  // Es lo que convierte «una rejilla de cartas» en «mi archivador». Se
  // guarda en el navegador y no en la base: es gusto de quien mira, no
  // un dato de la colección, y así no hace falta migración para esto.
  $('mcAlbumTapa').addEventListener('click', () => {
    const caja = $('mcAlbumTapas')
    const abierto = caja.classList.toggle('hidden')
    $('mcAlbumTapa').setAttribute('aria-expanded', String(!abierto))
    if (!abierto && !caja.dataset.montado) {
      caja.dataset.montado = '1'
      const puesta = tapaGuardada()
      caja.innerHTML = TAPAS.map(
        (t) =>
          `<button type="button" class="mc-tapa" data-tapa="${t.id}" aria-pressed="${t.id === puesta}" title="${escapeHtml(t.nombre)}">` +
          `<span class="sr-only">${escapeHtml(t.nombre)}</span></button>`
      ).join('')
    }
  })
  $('mcAlbumTapas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tapa]')
    if (!b) return
    guardarTapa(b.dataset.tapa)
    for (const otro of $('mcAlbumTapas').querySelectorAll('[data-tapa]')) {
      otro.setAttribute('aria-pressed', String(otro === b))
    }
    // Se repintan los dos: el álbum de la colección y el soñado que haya
    // abierto. La tapa es una sola para toda la pantalla.
    if (album.set) pintarAlbum()
    albumes.repintar?.()
  })
  // El buscador de dentro de una colección (tanda 417): en un set de 200
  // cartas, llegar a una por los filtros es imposible.
  $('mcAlbumBuscar').addEventListener('input', () => pintarAlbum())
  // El mando del bolsillo (tanda 368). Va delegado en el archivador y no
  // botón a botón: el álbum se repinta entero en cada cambio, así que un
  // oyente por bolsillo habría que volver a colgarlo cada vez.
  // El clic en una carta abre la FICHA, no la página (tanda 418). El
  // enlace se queda puesto a propósito: con el botón de en medio, con
  // Ctrl o con ⌘ sigue abriendo la página entera en otra pestaña, que es
  // lo que espera cualquiera de un enlace. Lo que se cambia es el clic
  // normal.
  const abreLaPagina = (e) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
  const engancharFicha = (zona, selector) => {
    $(zona)?.addEventListener('click', (e) => {
      const enlace = e.target.closest(selector)
      if (!enlace || !enlace.dataset.carta) return
      // En modo marcar, pulsar una casilla la MARCA. Y aquí sí se le gana
      // al Ctrl+clic: con el modo encendido, abrir la carta en otra
      // pestaña no es lo que estabas haciendo.
      if (marcadas && enlace.dataset.marca) {
        e.preventDefault()
        return alternarMarca(enlace)
      }
      if (abreLaPagina(e)) return
      e.preventDefault()
      fijarVecindario(zona, selector, 'carta', enlace.dataset.carta)
      abrirCarta(enlace.dataset.carta)
    })
  }
  // LAS TRES VISTAS (651). PINGU: «en el móvil, si voy a una expansión y
  // clico en una carta no sale el pop-up, te lleva a la ficha completa».
  // Solo estaba enganchado el archivador: en cuadrícula y en lista las
  // celdas son enlaces iguales (`data-carta`) y nadie les quitaba el
  // clic, así que se iban a la página. En el ordenador no se veía porque
  // ahí se usa el archivador; en el móvil, la cuadrícula.
  engancharFicha('mcAlbum', '.mc-bolsillo-enlace, .mc-rejilla-celda, .mc-album-fila')
  engancharFicha('mcPanelPokedex', '.pdx-carta')
  // ── EL PANEL TAMBIÉN (tanda 562) ──
  //
  // PINGU: «desde el panel, cuando le das a una carta debería salir el
  // popup y no llevarte a la ficha completa». Y es lo coherente: en el
  // álbum, en la Pokédex y en el buscador una carta se abre AQUÍ —con su
  // cantidad, su idioma y su estado, que es lo que se va a tocar—, y solo
  // en el Panel te sacaba de la página. Irse de /mi-coleccion para ver una
  // carta tuya y tener que volver es justo la fricción que esta pantalla
  // lleva seis tandas quitando.
  //
  // Son los dos sitios donde el Panel enseña cartas: la tira de «Tus
  // cartas» y las listas de «te sobran» y «las más valiosas».
  engancharFicha('mcPanelResumen', '.mc-vistazo-carta, .mc-fila-carta a')
  $('mcPokedexPanel')?.addEventListener('click', (e) => {
    if (e.target.closest('#pdxAbrirFiltros')) $('mcPdxPanelFiltros').showModal()
    if (e.target.closest('#pdxSoloFaltan')) {
      pdxSoloFaltan = !pdxSoloFaltan
      pintarEspecieFiltrada()
    }
  })
  // El idioma de la especie, en delegación por lo mismo que el buscador:
  // la cabecera se repinta entera.
  $('mcPokedexPanel')?.addEventListener('change', (e) => {
    if (e.target.id !== 'pdxIdioma') return
    pdxIdioma = e.target.value
    pintarEspecieFiltrada()
  })
  // En DELEGACIÓN, no en el campo: la cabecera de la especie se vuelve a
  // pintar entera con cada tecla, así que un oyente puesto sobre el
  // `<input>` se perdería con el primer repintado. Y el foco y el cursor
  // se devuelven a mano por lo mismo.
  $('mcPokedexPanel')?.addEventListener('input', (e) => {
    if (e.target.id !== 'pdxEspecieBuscar') return
    const donde = e.target.selectionStart
    textoEspecie = e.target.value
    pintarEspecieFiltrada()
    const campo = $('pdxEspecieBuscar')
    if (campo) {
      campo.focus()
      campo.setSelectionRange(donde, donde)
    }
  })
  $('mcPdxGrupos')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-egrupo]')
    if (!chip) return
    const conjunto = filtrosEspecie[chip.dataset.egrupo]
    if (conjunto.has(chip.dataset.evalor)) conjunto.delete(chip.dataset.evalor)
    else conjunto.add(chip.dataset.evalor)
    pintarEspecieFiltrada()
  })
  $('mcPdxFiltrosCerrar')?.addEventListener('click', () => $('mcPdxPanelFiltros').close())
  $('mcPdxFiltrosVer')?.addEventListener('click', () => $('mcPdxPanelFiltros').close())
  $('mcPdxFiltrosLimpiar')?.addEventListener('click', () => {
    for (const g of FILTROS_CATALOGO) filtrosEspecie[g.id].clear()
    pintarEspecieFiltrada()
  })
  $('mcPdxPanelFiltros')?.addEventListener('click', (e) => {
    const c = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= c.left && e.clientX <= c.right && e.clientY >= c.top && e.clientY <= c.bottom
    if (!dentro) e.currentTarget.close()
  })
  // Y los resultados de Buscar (tanda 452). PINGU: «cuando abres una carta
  // desde el buscador te va a la ficha completa, y hemos dicho que toda
  // carta que se abra desde mi colección tiene que abrir el pop-up y desde
  // ahí dar la opción de ir a la ficha completa».
  //
  // El `href` SE QUEDA aunque el clic normal ya no navegue: es lo que hace
  // que el Ctrl+clic y el «abrir en otra pestaña» sigan funcionando —de eso
  // se encarga `abreLaPagina`— y es el enlace que ve Google. Un `<a>` sin
  // destino es un botón disfrazado.
  engancharFicha('mcBuscarResultados', '.mc-resultado')

  // ── El menú de la VISTA (tanda 478) ──
  //
  // Se pinta una vez y se marca la puesta con `aria-checked`: es un
  // `menuitemradio` y no tres botones sueltos porque son UNA pregunta con
  // tres respuestas, y tres botones la cuentan como tres (la misma razón
  // por la que el sentido del orden es un interruptor y no dos chapas).
  const menuVista = $('mcAlbumVistaMenu')
  if (menuVista) {
    menuVista.innerHTML = VISTAS_DE_ALBUM.map((v) =>
      `<button type="button" class="mc-menu-opcion" role="menuitemradio" data-vista="${v.id}" aria-checked="false">
        <span class="mc-menu-icono" data-icono="${v.icono}" aria-hidden="true"></span>${escapeHtml(v.nombre)}
      </button>`).join('')
    // Los dibujos, aquí mismo: `pintarIconos` corre UNA vez al arrancar y
    // este menú se pinta después, así que sin esta llamada los tres
    // renglones saldrían sin icono — y el icono es lo único que distingue
    // tres palabras parecidas. No da error: salen vacíos.
    pintarIconos()
    menuVista.addEventListener('click', (e) => {
      const b = e.target.closest('[data-vista]')
      if (!b) return
      album.vista = b.dataset.vista
      album.pagina = 0
      try { localStorage.setItem(CLAVE_VISTA_ALBUM, album.vista) } catch {}
      pintarVistaDeAlbum()
      pintarAlbum()
      // La hoja se cierra al elegir: lo que has venido a ver está debajo.
      $('mcAlbumVistaHoja')?.close()
    })
  }
  $('mcAlbumVista')?.addEventListener('click', () => $('mcAlbumVistaHoja')?.showModal())
  $('mcAlbumVistaCerrar')?.addEventListener('click', () => $('mcAlbumVistaHoja')?.close())
  // El clic en el FONDO cierra, como las otras hojas: se distingue del de
  // dentro porque `e.target` es el propio `<dialog>`.
  $('mcAlbumVistaHoja')?.addEventListener('click', (e) => {
    if (e.target === $('mcAlbumVistaHoja')) $('mcAlbumVistaHoja').close()
  })
  // Se recuerda, como «juntas / separadas»: quien repasa un set entero en
  // cuadrícula lo quiere en cuadrícula también en el siguiente.
  try {
    const guardada = localStorage.getItem(CLAVE_VISTA_ALBUM)
    if (VISTAS_DE_ALBUM.some((v) => v.id === guardada)) album.vista = guardada
  } catch {}
  pintarVistaDeAlbum()

  // Juntas / separadas, en un solo botón (tanda 473). Se recuerda, porque
  // quien colecciona set maestro lo quiere SIEMPRE y volver a pulsarlo en
  // cada set sería un peaje. La clave de `localStorage` no cambia: lo que
  // se guarda es el estado, y el estado es el mismo que antes.
  $('mcVistaVariantes')?.addEventListener('click', () => {
    album.split = !album.split
    album.pagina = 0
    try { localStorage.setItem('mc-split', album.split ? '1' : '0') } catch {}
    pintarVistaVariantes()
    pintarAlbum()
  })
  try { album.split = localStorage.getItem('mc-split') === '1' } catch {}
  pintarVistaVariantes()

  $('mcAnadirResultados').addEventListener('click', (e) => {
    const b = e.target.closest('[data-carta]')
    if (b) elegir(b.dataset.carta)
  })
  $('mcAnadirForm').addEventListener('submit', anadirSeleccion)
  $('mcPublica')?.addEventListener('change', async (e) => {
    try {
      dueno.coleccion_publica = await datos.ponerPublica(sesion.user.id, e.target.checked)
      pintarCompartir()
      showToast(dueno.coleccion_publica ? 'Tu colección ya es pública.' : 'Tu colección vuelve a ser privada.', 'success')
    } catch (err) {
      e.target.checked = !e.target.checked
      showToast(err.message, 'error')
    }
  })
  $('mcCopiarEnlace')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/mi-coleccion?u=${encodeURIComponent(dueno.username)}`)
      showToast('Enlace copiado.', 'success')
    } catch {
      showToast('No se ha podido copiar.', 'error')
    }
  })
}

function pintarCompartir() {
  if (!esMia) return
  $('mcCompartir').classList.remove('hidden')
  $('mcPublica').checked = Boolean(dueno.coleccion_publica)
  $('mcCopiarEnlace').classList.toggle('hidden', !dueno.coleccion_publica || !dueno.username)
}

function prepararOpcionesDeFormulario() {
  // Los idiomas son los DEL CATÁLOGO que se mira (tanda 472), y por eso
  // esto se vuelve a llamar al cambiar de catálogo. Filtrar por francés en
  // el catálogo japonés no encuentra nada — y ofrecerlo dice que sí.
  //
  // Al repintar, un `<select>` vuelve a su primera opción: en el filtro esa
  // es «Todos los idiomas», que es justo donde debe quedarse si el idioma
  // que había elegido ya no se ofrece.
  $('mcFiltroIdioma').innerHTML = '<option value="">Todos los idiomas</option>' + opciones(idiomasDeLaVista(), '')
  $('mcAnadirEstado').innerHTML = opciones(ESTADOS, ESTADO_POR_DEFECTO)
  $('mcAnadirVariante').innerHTML = opciones(VARIANTES, 'normal')
  // CON QUÉ SE AÑADE, Y SE RECUERDA (tanda 461). Era un ajuste que se
  // olvidaba al recargar: quien colecciona en inglés tenía que volver a
  // elegirlo en cada visita, lo que convierte un ajuste en un trámite. Va
  // en el navegador y no en la base porque es gusto de quien mira, igual
  // que el color de la tapa (tanda 371) y la vista de variantes.
  //
  // Y los DOS desplegables de idioma (el de «Añadir» y el de tocar una
  // carta en el álbum) llevan su memoria POR CATÁLOGO: con una sola clave,
  // haber elegido «español» una vez se lo llevaba al catálogo inglés para
  // siempre, que es el fallo que PINGU describe. El ESTADO no lleva
  // catálogo: «Near Mint» es Near Mint en todos.
  for (const [id, lista, porDefecto, clave] of [
    ['mcAnadirIdioma', idiomasDeLaVista(), idiomaDeLaVista(), claveDeIdioma('mcAnadirIdioma')],
    ['mcTocarIdioma', idiomasDeLaVista(), idiomaDeLaVista(), claveDeIdioma('mcTocarIdioma')],
    ['mcTocarEstado', ESTADOS, ESTADO_POR_DEFECTO, 'mcTocarEstado'],
  ]) {
    let puesto = porDefecto
    // En una ventana privada `localStorage` LANZA, no devuelve null: sin el
    // try/catch se caería la preparación entera del formulario.
    try {
      const guardado = localStorage.getItem(clave)
      if (guardado && lista.some((x) => x.id === guardado)) puesto = guardado
    } catch {}
    $(id).innerHTML = opciones(lista, puesto)
    // `onchange` y no `addEventListener`: esto se vuelve a llamar cada vez
    // que se cambia de catálogo, y con `addEventListener` se apilaría un
    // oyente más en cada cambio — todos escribiendo en la clave del
    // catálogo que había cuando se engancharon, o sea en la equivocada.
    $(id).onchange = () => {
      try { localStorage.setItem(clave, $(id).value) } catch {}
    }
  }
}

// Lo que los álbumes soñados necesitan de esta página. Con getters: la
// colección y sus cartas se cargan después y se reasignan.
const contexto = {
  get sesion() {
    return sesion
  },
  lineas: () => lineas,
  get cartas() {
    return cartas
  },
  sets: () => cargarSets(),
  // Un getter y no un valor: el mercado cambia sin recargar la página, y
  // una copia se quedaría con el de cuando se montó el contexto.
  get mercado() {
    return mercado
  },
  porNumero,
}

// /mi-coleccion?album=<id> de OTRA persona: solo ese álbum, para verlo.
async function verAlbumAjeno(fila) {
  $('mcTitulo').textContent = 'Álbum soñado'
  document.title = `${fila.nombre} — Álbum soñado — PokeDoc`
  for (const id of ['mcResumen', 'mcResumenNota', 'mcCargando', 'mcCompartir']) $(id)?.classList.add('hidden')
  document.querySelector('.mc-pestanias').classList.add('hidden')
  cambiarPestania('carpetas')
  await albumes.abrir(fila.id, { soloVer: true })
}

async function iniciar() {
  prepararOpcionesDeFormulario()
  enganchar()
  albumes.iniciarAlbumes(contexto)
  sesion = await getSession().catch(() => null)
  if (modoCatalogo) return iniciarCatalogo()
  const idAlbum = params.get('album')
  if (idAlbum) {
    const fila = await albumes.cargarParaVer(idAlbum)
    if (!fila) {
      aviso('<p>Ese álbum no existe o es privado.</p>')
      if (!sesion) {
        $('mcContenido').classList.add('hidden')
        return
      }
    } else if (fila.user_id !== sesion?.user.id) {
      await verAlbumAjeno(fila)
      return
    } else {
      pestania = 'carpetas'
    }
  }
  const usuario = params.get('u')
  try {
    if (usuario) {
      dueno = await datos.perfilPorUsuario(usuario)
      if (!dueno) {
        aviso('<p>No existe nadie con ese nombre de usuario.</p>')
        $('mcContenido').classList.add('hidden')
        return
      }
      esMia = sesion?.user.id === dueno.id
      if (!esMia && !dueno.coleccion_publica) {
        aviso(`<p>La colección de <strong>${escapeHtml(dueno.display_name || dueno.username)}</strong> es privada.</p>`)
        $('mcContenido').classList.add('hidden')
        return
      }
    } else {
      if (!sesion) {
        $('mcContenido').classList.add('hidden')
        $('mcEntrar').classList.remove('hidden')
        return
      }
      // `avatar_url` ENTRA AQUÍ (tanda 458). PINGU: «hay una P con mi
      // avatar arriba a la izquierda, pero debería estar cogiendo el que
      // tengo en el perfil». La cabecera pinta la inicial cuando no hay
      // foto, y aquí no había foto porque esta consulta no la pedía — la
      // de OTRA persona (`perfilPorUsuario`) sí, así que el avatar salía
      // bien mirando la colección ajena y mal mirando la tuya. Un dato que
      // no se pide no da error: se dibuja el respaldo, que es exactamente
      // lo que se ve cuando de verdad no tienes foto.
      //
      // Y la marca de abajo va PEGADA a la consulta y no arriba del todo
      // (tanda 459): el barrido de la 386 la busca en las siete líneas
      // anteriores, así que el comentario de la 458 la empujó fuera y la
      // prueba se puso roja sin que la consulta hubiera cambiado.
      // sin rango: el nombre del dueño de la colección va en el título de la
      // pantalla («La colección de Ash»), como texto (tanda 386).
      const { data } = await supabase.from('user_profiles').select('id,username,display_name,avatar_url,coleccion_publica').eq('id', sesion.user.id).maybeSingle()
      dueno = data || { id: sesion.user.id }
      esMia = true
    }
  } catch (err) {
    aviso(`<p>${escapeHtml(err.message)}</p>`)
    return
  }

  if (!esMia) {
    const quien = dueno.display_name || dueno.username
    $('mcTitulo').textContent = `Colección de ${quien}`
    document.title = `Colección de ${quien} — PokeDoc`
    // Lo que era una pestaña escondida ahora es un BLOQUE escondido
    // dentro de otra (tanda 408): el catálogo para añadir, los álbumes
    // soñados y los cambios. Los cambios son de QUIEN MIRA, no de la
    // colección que se mira —«quién encaja conmigo» no significa nada en
    // la página de otra persona, y las dos RPC van contra `auth.uid()` de
    // todas formas—.
    for (const id of ['mcCatalogo', 'mcBloqueAlbumes', 'mcBloqueCambios']) $(id)?.classList.add('hidden')
    // Mirando la colección de otro no hay nada que añadir: los bolsillos
    // salen sin mando (bolsilloHtml) y esta línea sobraría en pantalla.
    $('mcTocarOpciones').classList.add('hidden')
  }
  pintarCompartir()
  // La hoja de ordenar se pinta UNA vez al arrancar, no al abrirla: el
  // rótulo del botón de la barra sale de aquí, y sin esto diría «Ordenar»
  // hasta que alguien la abriera — o sea, mentiría sobre el orden puesto.
  pintarHojaOrden()
  pintarBandejaCatalogo()
  pintarGruposDelCatalogo()
  cambiarPestania(pestania)

  await cargarColeccion(dueno.id, { primeraVez: true })
  window.addEventListener('resize', () => album.set && pintarAlbum())
}

// ── EL ARRANQUE DEL CATÁLOGO (tanda 649) ──
//
// Lo mismo que el de la colección, sin lo que aquí no tiene sentido: ni
// `?u=` (no es la colección de nadie), ni `?album=`, ni la puerta de
// «entra para guardar tus cartas» — el catálogo se mira sin cuenta, y lo
// que pide cuenta es AÑADIR, que lo dice la ficha de cada carta.
//
// Con cuenta se carga tu colección entera igual que en /mi-coleccion:
// es lo que hace que la estantería enseñe tu progreso y la ficha, tu
// copia. Sin cuenta, la colección es la vacía y se pinta la estantería
// directamente, que es lo que `cargarColeccion` haría al acabar.
async function iniciarCatalogo() {
  if (sesion) {
    // sin rango: la colección es la de quien mira (tanda 386).
    const { data } = await supabase.from('user_profiles').select('id,username,display_name,avatar_url,coleccion_publica').eq('id', sesion.user.id).maybeSingle()
    dueno = data || { id: sesion.user.id }
    esMia = true
  } else {
    dueno = null
    esMia = false
    // Lo que solo tiene sentido con una colección detrás: añadir del
    // catálogo, «solo las empezadas» (no hay ninguna empezada), el escáner
    // (añade lo que lee) y el desplegable de con qué se añade.
    for (const id of ['mcCatalogo', 'mcBloqueAlbumes', 'mcBloqueCambios', 'mcEstanteriaEmpezadas', 'mcEscanear']) $(id)?.classList.add('hidden')
    $('mcTocarOpciones')?.classList.add('hidden')
  }
  pintarHojaOrden()
  pintarBandejaCatalogo()
  pintarGruposDelCatalogo()
  cambiarPestania(pestania)
  if (sesion) {
    await cargarColeccion(dueno.id, { primeraVez: true })
  } else {
    $('mcCargando').classList.add('hidden')
    if (pestania === 'album') await pintarEstanteria()
    if (pestania === 'album' && params.get('set')) void abrirAlbum(params.get('set'), { push: false })
  }
  window.addEventListener('resize', () => album.set && pintarAlbum())
}

// La carga, suelta desde la tanda 437 porque se hace DOS veces: al entrar
// y cada vez que se cambia de catálogo. Copiarla habría dejado dos cargas
// que se separan sin que nadie se entere.
let duenoActual = null
async function cargarColeccion(duenoId, { primeraVez = false } = {}) {
  duenoActual = duenoId
  try {
    // Las DOS colecciones, a la vez (tanda 485): la del catálogo elegido,
    // que pintan Cartas / Expansiones / Carpetas / Pokédex, y la ENTERA,
    // que pinta el Panel. No es una filtrada de la otra — ver el comentario
    // de `lineasTodo` arriba: la clave de una carta solo puede ser la id a
    // secas mientras se mire un mercado.
    //
    // Si la entera falla, el Panel se queda con la del catálogo y lo demás
    // sigue: es peor número, pero es un número — y los ayudantes ya caen
    // solos a `lineas` cuando `lineasTodo` está vacío.
    ;[lineas, lineasTodo] = await Promise.all([
      datos.lineasDe(duenoId, mercado),
      datos.lineasDeTodo(duenoId).catch(() => []),
    ])
    const ids = lineas.map((l) => l.card_id)
    // Los PRECIOS se piden con las ids de las DOS: `tcg_card_prices` va por
    // `card_id` sin mercado, así que un solo mapa sirve a las dos
    // colecciones y pedirlo dos veces sería pedir lo mismo.
    const idsTodo = [...new Set([...ids, ...lineasTodo.map((l) => l.card_id)])]
    ;[cartas, cartasTodo, guardados] = await Promise.all([
      datos.cartasPorIds(ids, mercado),
      datos.cartasPorClaves(lineasTodo).catch(() => new Map()),
      datos.preciosGuardados(idsTodo),
    ])
    // Las favoritas van aparte y sin parar nada: si fallan, la estantería
    // se pinta igual, solo que sin su grupo de arriba.
    if (esMia) favoritos = await datos.favoritosDeSets(duenoId).catch(() => null)
  } catch (err) {
    aviso(`<p>${escapeHtml(err.message)}</p>`)
    return
  }
  $('mcCargando').classList.add('hidden')
  repintar()
  if (pestania === 'album') pintarEstanteria()
  // Y si el enlace trae una expansión abierta, se abre (tanda 468). Es la
  // otra mitad de meter `?set=` en la dirección: sin esto, el enlace de
  // una colección abierta llevaría a la estantería, y al dar atrás desde
  // dentro la dirección diría una cosa y la pantalla otra.
  // Solo al ENTRAR: al cambiar de catálogo, el `?set=` de la dirección ya
  // no es dónde estás.
  if (primeraVez && pestania === 'album' && params.get('set')) void abrirAlbum(params.get('set'), { push: false })
  // Si se entró directo a un álbum, se repinta ahora que se sabe qué
  // cartas tienes. Solo al entrar: al cambiar de catálogo, el `?album=`
  // de la dirección ya no es dónde estás.
  if (primeraVez && pestania === 'carpetas' && params.get('album')) albumes.abrir(params.get('album'))
  // Los precios que falten llegan después y repintan: la lista no espera.
  await completarPrecios()
  repintar()
}

// ── Cambiar de catálogo (tanda 437) ──
//
// Todo lo que hay en memoria es DE UN MERCADO: las líneas, el mapa de
// cartas, los precios, la lista de colecciones, la Pokédex, el álbum
// abierto y la gráfica del valor. Se tira TODO y se vuelve a cargar — no
// es una optimización que falte, es que quedarse con la mitad mezclaría
// dos catálogos en la misma pantalla y nada daría error.
async function cambiarVista(nuevo) {
  if (!VISTAS_VISIBLES.some((v) => v.id === nuevo) || nuevo === vista) return
  const antes = mercado
  vista = nuevo
  mercado = laVista().mercado
  try {
    localStorage.setItem(CLAVE_MERCADO, nuevo)
  } catch {
    // En una ventana privada no se puede guardar. Se pierde la elección
    // al recargar y ya está: no es motivo para no cambiar de catálogo.
  }
  pintarVistas()
  // Los desplegables de idioma dependen del catálogo (tanda 472), y esto va
  // ANTES del atajo de abajo: entre español e inglés no cambia el mercado
  // pero SÍ cambia con qué idioma se añade, que es justo lo que pedía
  // PINGU. Puesto después del `return`, el caso más común —cambiar de
  // español a inglés— sería el único que no se arreglaría.
  prepararOpcionesDeFormulario()
  // ATAJO, Y VA AQUÍ ARRIBA: entre español e inglés NO cambia el catálogo
  // —son el mismo mercado, el occidental—, solo cuál de los dos nombres se
  // enseña. Tirar la colección entera para volver a pedirla igual sería
  // una espera por nada... pero además, puesto DEBAJO del vaciado de aquí
  // abajo, repintaba sobre una memoria ya borrada y dejaba la pantalla en
  // blanco. El orden ES la corrección.
  if (mercado === antes) return repintar()
  todosLosSets = null
  // Las eras son POR MERCADO: quedarse con las del anterior rotularía la
  // biblioteca japonesa con los nombres que PINGU puso a las occidentales.
  erasAMano = null
  album = { set: null, cartas: [], pagina: 0, soloFaltan: false, split: false }
  pokedex = null
  pokedexCargada = false
  especieAbierta = null
  historico = null
  // Estas tres las vuelve a escribir `cargarColeccion` enseguida, así que
  // parecen de sobra. No lo son: si la carga FALLA, su `catch` enseña el
  // aviso y vuelve, y sin vaciarlas antes la pantalla se quedaría con la
  // colección del catálogo anterior debajo del rótulo del nuevo.
  lineas = []
  cartas = new Map()
  guardados = new Map()
  // `lineasTodo` y `cartasTodo` NO se vacían a propósito (tanda 485):
  // cambiar de catálogo no cambia la colección entera, así que vaciarlas
  // aquí dejaría el Panel en blanco durante la recarga —y si la recarga
  // falla, para siempre— a cambio de nada. `cargarColeccion` las vuelve a
  // pedir igual, y mientras tanto lo que hay sigue siendo verdad.
  $('mcCargando')?.classList.remove('hidden')
  await cargarColeccion(duenoActual)
}

// El mismo desplegable en los tres sitios donde se mira el catálogo: la
// estantería, la lista de cartas y la Pokédex. Es UNO repetido y no tres
// distintos, así que se pintan y se escuchan juntos — si se separan, un
// camino se queda con el mercado viejo y lo enseña como si tal cosa.
// SOLO LA BANDERA, sin texto: lo pidió PINGU y es como lo hace Dex. Es
// la segunda excepción deliberada a la regla de «iconos, nunca emojis»
// (la primera era la banderita del tono español) y tiene su motivo: una
// bandera no es un icono de interfaz, es el nombre de un idioma, y
// dibujar cuatro banderas a mano en SVG sería dibujar banderas peor.
//
// El nombre no se pierde: va en el `title` de cada opción y en el
// `aria-label` del desplegable, que es lo que lee un lector de pantalla.
function pintarVistas() {
  // Con dos catálogos que se llaman como en la API, la bandera va CON el
  // nombre (648): «Pokémon» y «Pokémon Japón» se leen; una bandera sola
  // dice un idioma, y lo que se elige ya no es un idioma.
  const opciones = VISTAS_VISIBLES
    .map((v) => `<option value="${v.id}" title="${escapeHtml(v.nombre)}">${v.bandera} ${escapeHtml(v.nombre)}</option>`)
    .join('')
  for (const sel of document.querySelectorAll('.mc-mercado')) {
    if (sel.innerHTML !== opciones) sel.innerHTML = opciones
    sel.value = vista
    sel.setAttribute('aria-label', `Qué catálogo se mira: ${laVista().nombre}`)
  }
}

iniciar()
