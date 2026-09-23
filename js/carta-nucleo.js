// El núcleo de la ficha de una carta: la dirección y el HTML del centro
// de la página (tanda 324).
//
// POR QUÉ ESTÁ SUELTO Y NO DENTRO DE js/carta.js: esto lo pintan DOS
// mitades, igual que el texto de un artículo —js/guia.js en el navegador
// y netlify/edge-functions/meta-social.js en el servidor—. Allí son dos
// copias que hay que acordarse de tocar a la vez; aquí no, porque este
// fichero SÍ se puede importar desde la función del borde: no toca el
// DOM y lo único que importa es `js/html.js`, que es escapado puro.
//
// Esa es toda la diferencia con `IDIOMA_POR_MERCADO`, que sí es una
// copia vigilada: aquel vive en `js/tcgdex.js`, que importa
// `./supabase.js` y no se puede arrastrar a un servidor.
import { escapeHtml } from './html.js'
import { normalizarNombre } from './normalizar.js'
// Las direcciones viven aparte para que quien solo quiera enlazar no se
// lleve el molde —y con él, sus clases— por delante. Ver carta-ruta.js.
import { rutaDeCarta, urlDeImagen, urlDeLogo } from './carta-ruta.js'
// Las fichas engordadas en español traen los enums TRADUCIDOS, y todo
// lo de aquí los compara en inglés. Se devuelven a su forma canónica al
// pintar, para que las 2.811 ya guardadas se vean bien sin tener que
// reengordarlas (tanda 334).
import { canonizarCarta, esEnergiaBasica, esPokemon } from './carta-detalle.js'

export {
  aSlug,
  candidatosDeRuta,
  idDeRutaDeColeccion,
  rutaDeCarta,
  rutaDeColeccion,
  urlDeImagen,
  urlDeLogo,
} from './carta-ruta.js'



// ── El español ──
//
// Es la respuesta a «qué tiene esta página que no tenga la de al lado»:
// las otras bases de cartas están en inglés. Lo que no esté en la tabla
// sale tal cual vino —vale más un «Trainer» suelto que un hueco—, y el
// día que TCGdex se invente una categoría nueva no se rompe nada.
export const TIPOS_ES = {
  Grass: 'Planta', Fire: 'Fuego', Water: 'Agua', Lightning: 'Rayo',
  Psychic: 'Psíquico', Fighting: 'Lucha', Darkness: 'Oscuro',
  Metal: 'Metal', Fairy: 'Hada', Dragon: 'Dragón', Colorless: 'Incolora',
}

export const FASES_ES = {
  Basic: 'Básico', Stage1: 'Fase 1', Stage2: 'Fase 2',
  MEGA: 'MEGA', VMAX: 'VMAX', VSTAR: 'VSTAR', Restored: 'Restaurado',
  'LEVEL-UP': 'Nivel superior',
}

export const ENTRENADORES_ES = {
  Supporter: 'Partidario', Item: 'Objeto', Stadium: 'Estadio',
  Tool: 'Herramienta', 'Ace Spec': 'ACE SPEC',
}

export const CATEGORIAS_ES = { Pokemon: 'Pokémon', Trainer: 'Entrenador', Energy: 'Energía' }

export const RAREZAS_ES = {
  Common: 'Común', Uncommon: 'Poco común', Rare: 'Rara',
  'Double rare': 'Doble rara', 'Ultra Rare': 'Ultra rara',
  'Illustration rare': 'Ilustración rara',
  'Special illustration rare': 'Ilustración especial rara',
  'Hyper rare': 'Hiperrara', 'Shiny rare': 'Variocolor rara',
  'Rare Holo': 'Rara holo', 'Amazing Rare': 'Rara asombrosa',
  'Radiant Rare': 'Rara radiante', Promo: 'Promo', 'ACE SPEC Rare': 'ACE SPEC',
}

const traducir = (tabla, valor) => (valor ? tabla[valor] || String(valor) : null)

export const tipoEs = (v) => traducir(TIPOS_ES, v)
export const faseEs = (v) => traducir(FASES_ES, v)
export const categoriaEs = (v) => traducir(CATEGORIAS_ES, v)
export const rarezaEs = (v) => traducir(RAREZAS_ES, v)
export const entrenadorEs = (v) => traducir(ENTRENADORES_ES, v)

// ── ¿Son la misma carta o solo se llaman igual? ──
//
// Un Primeape de Jungle y un Primeape de Pitch Black comparten el
// nombre y NO son la misma carta: distinto ataque, distinta vida,
// distinto todo. Son dos cartas de la misma especie.
//
// La ficha enseñaba «otras versiones» comparando SOLO el nombre, así
// que salían trece Primeapes de trece sets que no tienen nada que ver.
// Una reimpresión de verdad comparte el TEXTO DE REGLAS: misma vida,
// misma fase, mismos ataques con el mismo coste y el mismo daño.
//
// El texto del efecto NO entra en la huella a propósito: se reescribe
// entre erratas y entre idiomas, y dos impresiones de la misma carta
// pueden traerlo distinto. Dentro de un idioma, lo que no cambia nunca
// es el nombre del ataque, su coste y su daño.
export function huellaDeCarta(cartaCruda, conNombresDeAtaque = true) {
  const carta = canonizarCarta(cartaCruda)
  if (!carta || !esPokemon(carta)) return null
  // Sin ataques no hay huella: una carta sin engordar se parecería a
  // cualquier otra sin engordar, y saldrían todas como «la misma».
  const ataques = Array.isArray(carta.attacks) ? carta.attacks : null
  if (!ataques || !ataques.length) return null
  const trozos = ataques
    .map((a) => [
      conNombresDeAtaque ? normalizarNombre(a?.name) : '',
      String(a?.damage ?? ''),
      (Array.isArray(a?.cost) ? a.cost : []).join('+'),
    ].join('/'))
    .sort()
  return [
    normalizarNombre(carta.name),
    carta.hp ?? '',
    carta.stage ?? '',
    (Array.isArray(carta.types) ? carta.types : []).join('+'),
    trozos.join('|'),
  ].join('·')
}

// En qué idioma están los ataques de una ficha. `detalle_lang` lo apunta
// el engorde desde la tanda 330 ('es' o 'en'); null significa engordada
// ANTES, cuando todo se pedía en inglés. Una ficha traída al vuelo lo
// lleva puesto por js/carta.js con el idioma en que llegó.
export function idiomaDeFicha(carta) {
  return carta?.detalle_lang || 'en'
}

export function esLaMismaCarta(a, b) {
  // Los nombres de los ataques solo se comparan si las dos fichas hablan
  // el MISMO idioma: desde la tanda 330 conviven cartas en español y en
  // inglés, y «Hackeo Genoma» no casaría jamás con «Genome Hacking»
  // aunque sean el mismo ataque — así que ninguna reimpresión cruzaba
  // el idioma y la sección salía vacía (tanda 333). Entre idiomas
  // distintos la huella se queda con lo que no se traduce: PS, fase,
  // tipos, y el coste y el daño de cada ataque. El nombre de la CARTA
  // sí entra siempre, porque Pokémon no traduce los nombres de especie.
  const conNombres = idiomaDeFicha(a) === idiomaDeFicha(b)
  const ha = huellaDeCarta(a, conNombres)
  return Boolean(ha) && ha === huellaDeCarta(b, conNombres)
}

// El nombre que se ENSEÑA: el español si lo tenemos, y el inglés si no
// (tanda 335).
//
// `name` se queda SIEMPRE en inglés porque es la clave con la que se
// cruzan las decklists, el agregado de torneos y la huella. Esta función
// es la única puerta por la que sale el nombre a la pantalla.
export function nombreDeCarta(carta) {
  const es = typeof carta?.name_es === 'string' ? carta.name_es.trim() : ''
  return es || carta?.name || ''
}

// ── El subtítulo ──
//
// La línea de debajo del nombre: lo que se contesta de un vistazo. Cada
// trozo solo aparece si SE SABE. Un Entrenador no tiene PS y una carta
// sin engordar no tiene casi nada: en los dos casos la línea se acorta,
// que es distinto de decir «0 PS» (la lección de la 319).
export function subtituloDeCarta(cartaCruda) {
  const carta = canonizarCarta(cartaCruda)
  const partes = []
  if (esPokemon(carta)) {
    if (carta.stage) partes.push(faseEs(carta.stage))
    if (carta.evolve_from) partes.push(`Evoluciona de ${carta.evolve_from}`)
    if (Number.isInteger(carta.hp)) partes.push(`${carta.hp} PS`)
    const tipos = (carta.types || []).map(tipoEs).filter(Boolean)
    if (tipos.length) partes.push(`Tipo ${tipos.join(' / ')}`)
    // OJO: el subtítulo es TEXTO PLANO —se escapa entero al pintarlo—
    // así que aquí el tipo va con su nombre y no con su icono. El icono
    // está en el cuadro de combate, donde sí se puede meter HTML.
  } else if (carta?.category === 'Trainer') {
    partes.push(entrenadorEs(carta.trainer_type) || 'Entrenador')
  } else if (carta?.category === 'Energy') {
    partes.push(carta.energy_type === 'Special' ? 'Energía especial' : 'Energía básica')
  }
  return partes.join(' · ')
}

// ── El coste de un ataque ──
//
// TCGdex da el coste como lista de tipos («Fire», «Colorless»). Se
// pintan como puntos de color con su nombre en el `title`: los símbolos
// de energía son imágenes de Nintendo y no están en la CDN suelta.
function costeDeAtaque(coste) {
  const lista = Array.isArray(coste) ? coste : []
  if (!lista.length) return '<span class="carta-coste-libre">Sin coste</span>'
  return lista.map(puntoDeEnergia).join('')
}

function bloqueAtaques(carta) {
  const ataques = Array.isArray(carta?.attacks) ? carta.attacks : []
  const habilidades = Array.isArray(carta?.abilities) ? carta.abilities : []
  if (!ataques.length && !habilidades.length) return ''
  const filas = [
    ...habilidades.map(
      (h) =>
        '<li class="carta-mov carta-mov-habilidad">' +
        `<p class="carta-mov-nombre"><span class="carta-etiqueta-hab">${escapeHtml(h?.type || 'Habilidad')}</span> ${escapeHtml(h?.name || '')}</p>` +
        (h?.effect ? `<p class="carta-mov-texto">${escapeHtml(h.effect)}</p>` : '') +
        '</li>'
    ),
    ...ataques.map(
      (a) =>
        '<li class="carta-mov">' +
        `<p class="carta-mov-nombre"><span class="carta-mov-coste">${costeDeAtaque(a?.cost)}</span> ${escapeHtml(a?.name || '')}` +
        (a?.damage ? ` <span class="carta-mov-dano">${escapeHtml(a.damage)}</span>` : '') +
        '</p>' +
        (a?.effect ? `<p class="carta-mov-texto">${escapeHtml(a.effect)}</p>` : '') +
        '</li>'
    ),
  ]
  return `<section class="carta-ataques"><h2>Ataques y habilidades</h2><ul class="carta-movs">${filas.join('')}</ul></section>`
}

// Un punto de energía de un tipo, con su nombre puesto para quien no
// ve el color. Se usa en el coste de un ataque, en la debilidad, en la
// resistencia y en la retirada: es el MISMO dibujo en los cuatro
// sitios porque en la carta de verdad también lo es.
// El punto de color de un tipo de energía.
//
// ── Y lo que hace cuando NO conoce el tipo (tanda 340) ──
//
// Antes pintaba el punto igual con cualquier cadena, y el color por
// defecto de `.carta-energia` (#d8dee3) es prácticamente el de Incolora
// (#e6eaed). Así que un tipo que no reconocíamos no se veía como «no lo
// sé»: se veía como **Incolora**, que es otro tipo. No faltaba un color,
// **se estaba diciendo uno falso** — y en una debilidad eso es decirle a
// alguien que su carta es débil a otra cosa.
//
// Lo vio PINGU en el Mew ex de 30th Celebration: débil a Siniestro y con
// el punto blanco. Las grafías que se nos ocurrieron (Oscuro,
// Oscuridad, Siniestro, Darkness) ya se traducían todas, así que lo que
// TCGdex manda para ese set es otra cosa — y el fallo de fondo es que no
// había forma de enterarse.
//
// Ahora un tipo desconocido sale con `data-tipo="?"`, que tiene su
// propio dibujo (hueco y punteado, no un color), y lleva el valor CRUDO
// en el título: así se ve que falta una traducción y además se ve CUÁL.
export const TIPOS_CONOCIDOS = Object.keys(TIPOS_ES)

function puntoDeEnergia(tipo) {
  const conocido = TIPOS_CONOCIDOS.includes(tipo)
  const es = conocido ? tipoEs(tipo) : `Tipo sin traducir: ${String(tipo ?? '—')}`
  return (
    `<span class="carta-energia" data-tipo="${escapeHtml(conocido ? tipo : '?')}"` +
    ` title="${escapeHtml(es)}" aria-label="${escapeHtml(es)}"></span>`
  )
}

// Debilidad, resistencia y retirada. Los tres son del combate y van
// juntos; un Entrenador no tiene ninguno y el bloque no sale.
//
// Con el ICONO del tipo y no con su nombre escrito (tanda 328, pedido
// por PINGU): en la carta de verdad la debilidad es un símbolo rojo, no
// la palabra «Fuego». El nombre sigue estando en el `title` y en el
// `aria-label`, así que no se pierde para quien no ve el color — y al
// lado va el multiplicador, que es el dato que se lee.
function bloqueCombate(carta) {
  if (!esPokemon(carta)) return ''
  const uno = (etiqueta, filas) => {
    const lista = Array.isArray(filas) ? filas : []
    const dentro = lista.length
      ? lista
          .map((f) => `${puntoDeEnergia(f?.type)}<span class="carta-mult">${escapeHtml(f?.value || '')}</span>`)
          .join('')
      : '<span class="carta-nada">—</span>'
    return `<div><dt>${etiqueta}</dt><dd class="carta-combate-dato">${dentro}</dd></div>`
  }
  // La retirada son TANTOS puntos incoloros como cuesta, que es
  // exactamente como está impreso en la carta. Un «2» a secas obliga a
  // traducir mentalmente algo que ya era un dibujo.
  let retirada = ''
  if (Number.isInteger(carta.retreat)) {
    const dentro =
      carta.retreat === 0
        ? '<span class="carta-nada">Gratis</span>'
        : Array.from({ length: carta.retreat }, () => puntoDeEnergia('Colorless')).join('')
    retirada = `<div><dt>Retirada</dt><dd class="carta-combate-dato">${dentro}</dd></div>`
  }
  return `<dl class="carta-combate">${uno('Debilidad', carta.weaknesses)}${uno('Resistencia', carta.resistances)}${retirada}</dl>`
}

// La ficha de coleccionista. `set` puede no llegar (la consulta del
// borde lo trae embebido; una prueba puede no pasarlo) y entonces se
// callan sus filas en vez de inventarlas.
function bloqueFicha(carta, set) {
  const filas = []
  const total = set?.card_count_official || set?.card_count_total
  if (carta?.local_id) {
    filas.push(['Número', total ? `${carta.local_id} / ${total}` : String(carta.local_id)])
  }
  if (set?.name) filas.push(['Colección', set.name])
  if (carta?.rarity) filas.push(['Rareza', rarezaEs(carta.rarity)])
  if (carta?.regulation_mark) filas.push(['Marca de regulación', carta.regulation_mark])
  if (carta?.illustrator) filas.push(['Ilustración', carta.illustrator])
  if (set?.release_date) filas.push(['Salió', fechaLarga(set.release_date)])
  if (!filas.length) return ''
  return (
    '<dl class="carta-ficha">' +
    filas.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('') +
    '</dl>'
  )
}

// ── ¿Se puede jugar hoy? ──
//
// La pregunta que trae a alguien a la ficha de una carta vieja no es
// «¿cuántos PS tiene?» —eso se ve en el escaneo— sino «¿esto lo puedo
// meter en mi mazo?». Hasta ahora la respuesta estaba a la vista SOLO
// para quien pegaba una decklist entera en un torneo.
//
// Se decide con las mismas dos piezas que el revisor de decklists: las
// marcas legales de la temporada y si existe una REIMPRESIÓN legal del
// mismo nombre. Las dos llegan ya resueltas en `legalidad`, porque esto
// lo pinta también la función del borde, que no tiene cliente de
// Supabase — la que las va a buscar es `js/carta-legalidad.js`.
//
// `legalidad` a null significa «no se sabe» y NO se pinta nada. Es la
// lección de la tanda 319: un defecto que convierte «no me lo han dado»
// en «no es legal» miente en la pantalla que no se lo pasa, y aquí
// mentiría diciéndole a alguien que no puede jugar una carta que sí.
//
// Solo se habla de ESTÁNDAR. Expandido no se puede deducir de la marca
// —las cartas anteriores a 2019 no llevan ninguna y muchas son legales
// igual—, así que afirmarlo sería inventárselo.
export function legalidadEstandar(cartaCruda, legalidad) {
  const marcas = legalidad?.marcas
  if (!Array.isArray(marcas) || !marcas.length) return null
  const carta = canonizarCarta(cartaCruda)
  if (!carta) return null
  // Una energía básica está SIEMPRE dentro, lleve la marca que lleve:
  // es regla del juego, no del formato.
  if (esEnergiaBasica(carta)) return { estado: 'legal', energia: true }
  const marca = String(carta.regulation_mark || '')
  if (marca && marcas.includes(marca)) return { estado: 'legal', marca }
  // ── Y aquí, la trampa (tanda 338) ──
  //
  // `regulation_mark` a null son DOS cosas que en la base se ven igual:
  // una carta que NO LLEVA marca —anterior a 2019, y entonces sí está
  // fuera— y una que todavía no hemos engordado, donde la columna está
  // vacía porque nadie la ha pedido. Afirmar sobre la segunda es
  // inventar, y lo que se inventa es lo peor que se puede decir: a un
  // Mew ex recién salido le salía «No es legal en Estándar».
  //
  // Es la lección de la 319 —el defecto que convierte «no me lo han
  // dado» en un dato— aplicada un piso más arriba: allí era el
  // parámetro que no llegaba, aquí es la columna que todavía no se ha
  // rellenado. La escribí en el comentario de esta misma función y la
  // volví a pisar.
  //
  // Se distinguen por `detalle_at`: si la ficha está traída y aun así no
  // hay marca, es que la carta no la lleva.
  if (!marca && !carta.detalle_at) return null
  // Sin marca y con la ficha traída, fuera: desde 2022 el Estándar las
  // exige. Pero la carta puede tener una reimpresión moderna que sí, y
  // entonces lo que no se puede jugar es ESTA impresión, no la carta.
  if (legalidad.reimpresion) return { estado: 'reimpresion', marca }
  return { estado: 'fuera', marca }
}

const TEXTO_LEGALIDAD = {
  legal: 'Legal en Estándar',
  reimpresion: 'Esta impresión no, pero sí una reimpresión',
  fuera: 'No es legal en Estándar',
}

function bloqueLegalidad(carta, legalidad) {
  const ley = legalidadEstandar(carta, legalidad)
  if (!ley) return ''
  const porQue = ley.energia
    ? 'Una energía básica se puede jugar siempre, lleve la marca que lleve.'
    : ley.estado === 'legal'
      ? `Su marca de regulación (${ley.marca}) está entre las de esta temporada: ${legalidad.marcas.join(', ')}.`
      : ley.estado === 'reimpresion'
        ? `Esta copia ${ley.marca ? `lleva la marca ${ley.marca}` : 'no lleva marca de regulación'} y se ha quedado fuera, pero hay otra impresión de la misma carta con una marca legal (${legalidad.marcas.join(', ')}).`
        : `Esta temporada solo valen las marcas ${legalidad.marcas.join(', ')} (la letra pequeña de la esquina), y esta carta no tiene ninguna impresión que las lleve.`
  return (
    `<p class="carta-legal carta-legal-${ley.estado}">` +
    `<span class="carta-legal-titulo">${escapeHtml(TEXTO_LEGALIDAD[ley.estado])}</span>` +
    `<span class="carta-legal-porque">${escapeHtml(porQue)}</span>` +
    '</p>'
  )
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fechaLarga(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`
}

// ════════════════════════════════════════════════════════════════════
// En los torneos de PokeDoc (tanda 325)
// ════════════════════════════════════════════════════════════════════
//
// Esta es la fila que justifica el proyecto entero. El nombre, la foto y
// los ataques los tienen otras quince webs; «la llevan 18 mazos, sobre
// todo de Ceruledge Dusknoir» no lo tiene nadie más, y sale de datos que
// ya recogemos en cada torneo.

// La clave con la que se pregunta por `tcg_card_play`. Es la MISMA
// función que usa la tarea que rellena la tabla — importada, no copiada:
// si las dos se separaran, la ficha preguntaría por una clave que no
// existe y el bloque desaparecería sin dar error.
export function claveDeJuego(carta) {
  return normalizarNombre(carta?.name)
}

// La media de copias, con una cifra decimal y coma, que es como se
// escribe en español. Se calcula al pintar y no se guarda: guardar una
// media ya dividida haría imposible recalcular nada.
export function mediaDeCopias(play) {
  const mazos = Number(play?.decks)
  const copias = Number(play?.total_copies)
  if (!mazos || !Number.isFinite(copias)) return null
  return (copias / mazos).toFixed(1).replace('.', ',')
}

// Cuántos mazos hacen falta para que el bloque salga, y cuántos para
// que se pueda hablar de TENDENCIA. No son el mismo número (tanda 338).
//
// Hasta la 338 el bloque no salía por debajo de tres mazos, y el
// razonamiento era «con dos, *el 100 % la juega a 4 copias* es verdad y
// no dice nada». Eso sigue siendo cierto de la MEDIA y del reparto por
// arquetipo — pero no del hecho en sí. Que una carta se haya jugado en
// un torneo de PokeDoc es justo lo que no tiene ninguna otra web, y
// esconderlo por no poder calcular una media encima es tirar el dato
// bueno para proteger el malo.
//
// Así que el bloque sale desde UN mazo y lo que cambia es lo que DICE:
// con pocos se cuenta el caso («la llevó un mazo, a 4 copias, en la
// Copa de Otoño») y con muestra se habla de tendencia («copias de
// media», «se juega sobre todo en»). Lo que no se hace nunca es pintar
// una media de una muestra de uno.
export const MAZOS_MINIMOS = 1

// A partir de aquí una media y un reparto por arquetipo significan algo.
export const MAZOS_PARA_TENDENCIA = 3

export function hayDatosDeJuego(play) {
  return Number(play?.decks) >= MAZOS_MINIMOS
}

export function hayMuestra(play) {
  return Number(play?.decks) >= MAZOS_PARA_TENDENCIA
}

export function bloqueDeJuego(play) {
  if (!hayDatosDeJuego(play)) return ''
  // Con uno o dos mazos NO se habla de media ni de reparto: una media de
  // una muestra de uno es el mismo número disfrazado de estadística.
  const muestra = hayMuestra(play)
  const media = muestra ? mediaDeCopias(play) : null
  const torneos = Number(play?.tournaments) || 0
  // La guarda de la muestra va SOLO sobre `filas`, más abajo. Aquí había
  // otra, y el rigor la cantó por lo que es: red de repuesto de la de
  // abajo, que no cambia nada si se quita (la trampa de la 314). Y la de
  // abajo es la que tiene que estar, porque es la única que tapa la fila
  // de «Otros».
  const arqs = Array.isArray(play?.archetypes) ? play.archetypes : []
  const masMazos = arqs.reduce((a, b) => a + (Number(b?.mazos) || 0), 0)
  const otros = Math.max(0, Number(play.decks) - masMazos)

  // Con un solo mazo, «copias de media» sería la cuenta de ese mazo
  // llamada media. Se dice lo que es: cuántas copias llevaba.
  const copias = Number(play?.total_copies)
  const unaLista = Number(play.decks) === 1 && Number.isFinite(copias) && copias > 0
  const cifras =
    '<dl class="juego-cifras">' +
    `<div><dt>${Number(play.decks) === 1 ? 'Mazo que la lleva' : 'Mazos que la llevan'}</dt>` +
    `<dd>${escapeHtml(play.decks)}</dd></div>` +
    (media ? `<div><dt>Copias de media</dt><dd>${escapeHtml(media)}</dd></div>` : '') +
    (unaLista ? `<div><dt>${copias === 1 ? 'Copia' : 'Copias'}</dt><dd>${escapeHtml(copias)}</dd></div>` : '') +
    (torneos ? `<div><dt>${torneos === 1 ? 'Torneo' : 'Torneos'}</dt><dd>${escapeHtml(torneos)}</dd></div>` : '') +
    '</dl>'

  // Los arquetipos, con su barra. El ancho sale de una variable en el
  // `style=` y ESE respaldo sí es legítimo: es el valor por defecto de
  // algo que pone el código, no un token que exista en una hoja.
  // Sin muestra no hay reparto NINGUNO: con `arqs` vacío, `otros` se
  // lleva todos los mazos y se pintaba «Se juega sobre todo en · Otros
  // 1», que es la afirmación que esto quería evitar, dicha con otras
  // palabras.
  const filas = !muestra ? [] : [
    ...arqs.map(
      (a) =>
        '<li>' +
        `<span class="juego-arq-nombre">${escapeHtml(a?.nombre || 'Sin catalogar')}</span>` +
        `<span class="juego-arq-barra" style="--parte: ${Math.round(((Number(a?.mazos) || 0) / Number(play.decks)) * 100)}%"></span>` +
        `<span class="juego-arq-num">${escapeHtml(a?.mazos ?? 0)}</span>` +
        '</li>'
    ),
    otros > 0
      ? '<li class="juego-arq-otros">' +
        '<span class="juego-arq-nombre">Otros</span>' +
        `<span class="juego-arq-barra" style="--parte: ${Math.round((otros / Number(play.decks)) * 100)}%"></span>` +
        `<span class="juego-arq-num">${escapeHtml(otros)}</span>` +
        '</li>'
      : '',
  ].filter(Boolean)

  return (
    '<section class="carta-juego">' +
    '<h2>En los torneos de PokeDoc</h2>' +
    cifras +
    (filas.length ? `<p class="juego-donde">Se juega sobre todo en</p><ul class="juego-arqs">${filas.join('')}</ul>` : '') +
    // El pie no es decoración: dice de dónde sale el número y de cuántos
    // mazos, que es lo que permite a quien lee decidir si se lo cree.
    `<p class="juego-pie">` +
    (muestra
      ? ''
      : `Son ${play.decks === 1 ? 'los datos de una sola lista' : `los datos de ${play.decks} listas`}: ` +
        'suficiente para decir que se juega, no para sacar una media ni un mazo típico. ') +
    `Contado sobre las listas públicas de los torneos de PokeDoc. ` +
    `Una lista solo entra aquí cuando su torneo la deja ver.</p>` +
    '<p class="juego-enlace"><a href="/torneos">Ver los torneos</a></p>' +
    '</section>'
  )
}

// ── El núcleo entero ──
//
// Lo pintan las DOS mitades: el borde antes de entregar la página y
// js/carta.js si el borde no llegó. Por eso vive aquí y no en ninguna de
// las dos, y por eso no toca el DOM: devuelve una cadena.
export function nucleoDeCarta(cartaCruda, set, play = null, legalidad = null) {
  if (!cartaCruda) return ''
  // Una sola vez, aquí: a partir de este punto los tipos, la fase y la
  // categoría están en inglés, que es lo que esperan todos los bloques.
  const carta = canonizarCarta(cartaCruda)
  const img = urlDeImagen(carta.image_path, 'high')
  const sub = subtituloDeCarta(carta)
  const alt = `Carta de ${nombreDeCarta(carta)}${set?.name ? ` (${set.name})` : ''}`
  return (
    '<div class="carta-cabecera">' +
    `<h1>${escapeHtml(nombreDeCarta(carta) || 'Carta')}</h1>` +
    (sub ? `<p class="carta-sub">${escapeHtml(sub)}</p>` : '') +
    '</div>' +
    '<div class="carta-cuerpo">' +
    '<figure class="carta-scan">' +
    (img
      // 600×825 son las medidas reales de la imagen de TCGdex. Van
      // puestas para que el hueco esté reservado antes de que llegue:
      // sin ellas la página pega un salto de 800 px al cargarse.
      ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(alt)}" width="600" height="825" loading="eager" decoding="async">`
      : '<div class="carta-scan-vacio">Sin imagen</div>') +
    '</figure>' +
    '<div class="carta-datos">' +
    bloqueFicha(carta, set) +
    bloqueLegalidad(carta, legalidad) +
    bloqueCombate(carta) +
    bloqueAtaques(carta) +
    bloqueDeJuego(play) +
    (carta.description ? `<p class="carta-descripcion">${escapeHtml(carta.description)}</p>` : '') +
    '</div>' +
    '</div>'
  )
}

// ── Quién merece salir en Google ──
//
// «Miles de páginas casi vacías hunden el dominio, no lo suben.» Y no
// solo esas páginas: castiga al sitio ENTERO.
//
// En la tanda 324 el listón era «está engordada», con la idea de que el
// español ya era la diferencia. Al montar el bloque de torneos se vio
// que esa idea no se sostenía todavía: los nombres y el texto de los
// ataques vienen del catálogo OCCIDENTAL, que es inglés. Lo que hoy está
// en español son las etiquetas —tipo, rareza, fase—, no la carta. Una
// ficha engordada es, de momento, lo mismo que tienen otras quince webs.
//
// Así que el listón es el de la tanda 325 y son DOS condiciones:
//
//   · engordada (si no, no hay ni ficha que enseñar), y
//   · con datos de juego (si no, no hay nada que las demás no tengan).
//
// Sale caro a corto plazo —se indexan decenas de fichas, no miles— y es
// lo correcto: las que no entran siguen funcionando para quien llegue,
// se enlazan desde su colección (que SÍ se indexa) y se encienden solas
// en cuanto alguien las juegue en un torneo.
//
// Cuando exista el catálogo en español, la primera condición vuelve a
// valer por sí sola y se cambia AQUÍ, en un sitio y no en cinco.
// Ojo: esto NO usa el listón del bloque (tanda 338). Son dos preguntas
// distintas y desde la 338 tienen dos números. Que el bloque salga con
// un mazo es bueno para quien ya está en la página; ofrecerle a Google
// una ficha cuyo único contenido propio es «la llevó un mazo» es
// justo lo que la casa llama contenido escaso. Para indexar se pide
// MUESTRA, que es el listón que había antes de la 338 — así que aquí no
// cambia nada.
export function mereceIndexarse(carta, play = null) {
  return Boolean(carta?.detalle_at) && hayMuestra(play)
}

// ════════════════════════════════════════════════════════════════════
// La COLECCIÓN (tanda 324)
// ════════════════════════════════════════════════════════════════════
//
// Vive en este mismo fichero y no en uno suyo por el mismo motivo que
// todo lo de arriba: lo pintan las dos mitades, y para que no haya dos
// copias que se separen tiene que estar en un módulo que pueda importar
// tanto el navegador como la función del borde.



// Una carta dentro de la rejilla de su colección.
//
// El hueco va reservado con `width`+`height` (245×337 es la miniatura de
// TCGdex): son 200 imágenes en una página, y sin las medidas la lista
// entera baila mientras cargan.
export function fichaDeRejilla(carta) {
  const img = urlDeImagen(carta?.image_path, 'low')
  return (
    `<a class="coleccion-carta" href="${escapeHtml(rutaDeCarta(carta))}">` +
    (img
      ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(nombreDeCarta(carta))}" width="245" height="337" loading="lazy" decoding="async">`
      : '<span class="coleccion-carta-vacia"></span>') +
    `<span class="coleccion-carta-num">${escapeHtml(carta?.local_id || '')}</span>` +
    `<span class="coleccion-carta-nombre">${escapeHtml(nombreDeCarta(carta))}</span>` +
    '</a>'
  )
}

export function rejillaDeCartas(cartas) {
  const lista = Array.isArray(cartas) ? cartas : []
  if (!lista.length) return ''
  return lista.map(fichaDeRejilla).join('')
}

// La cabecera de una colección: logo, nombre, serie, fecha y cuántas
// cartas tiene. Lo que no se sepa no se dice.
export function cabeceraDeColeccion(set, cuantasHay = null) {
  if (!set) return ''
  const logo = urlDeLogo(set.logo_path)
  const datos = []
  if (set.serie_name) datos.push(set.serie_name)
  if (set.release_date) datos.push(fechaLarga(set.release_date))
  const total = set.card_count_official || set.card_count_total
  if (total) datos.push(`${total} cartas`)
  else if (Number.isInteger(cuantasHay)) datos.push(`${cuantasHay} cartas`)
  return (
    '<div class="coleccion-cabecera">' +
    (logo
      // El logo de un set no tiene medidas fijas (los hay anchos y los
      // hay cuadrados), así que el hueco se reserva con un alto fijo en
      // el CSS y no con width/height, que mentirían.
      ? `<img class="coleccion-logo" src="${escapeHtml(logo)}" alt="" loading="eager" decoding="async">`
      : '') +
    `<h1>${escapeHtml(set.name || 'Colección')}</h1>` +
    (datos.length ? `<p class="coleccion-datos">${escapeHtml(datos.join(' · '))}</p>` : '') +
    '</div>'
  )
}

// Una colección SÍ se indexa aunque sus cartas no.
//
// No es una página escasa: son doscientas cartas con su número, su
// nombre y su imagen, y es la puerta por la que se llega a las fichas.
// El listón de la ficha (estar engordada) es para la ficha.
export function coleccionMereceIndexarse(set, cuantasCartas = 0) {
  return Boolean(set?.name) && cuantasCartas > 0
}
