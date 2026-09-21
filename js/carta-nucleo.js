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

const ASSETS = 'https://assets.tcgdex.net'

// ── La dirección ──
//
// `/carta/ceruledge-ex-sv5-36`: el nombre delante, porque eso es lo que
// lee una persona antes de pulsar y lo que Google pesa.
//
// El identificador de TCGdex ya es `<set>-<número>`, así que la
// dirección termina en dos trozos separados por guion. Para leerla al
// revés NO se puede dar por hecho dónde acaba el nombre —lleva guiones
// él también—, así que se prueban los candidatos de menos a más trozos y
// se pregunta por TODOS a la vez. Un identificador de set con un guion
// dentro (no he visto ninguno, pero tampoco los he contado todos) se
// resuelve solo por el segundo candidato, en vez de dar un 404 que
// nadie sabría explicar.
export function rutaDeCarta(carta) {
  const id = String(carta?.id ?? '')
  if (!id) return '/cartas'
  return `/carta/${aSlug(carta?.name)}-${id}`
}

export function aSlug(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'carta'
}

// Los identificadores que PODRÍA ser esta dirección, del más probable al
// menos. Se devuelven todos para preguntar una sola vez.
export function candidatosDeRuta(ruta) {
  const m = String(ruta ?? '').match(/^\/carta\/([^/?#]+)/)
  if (!m) return []
  const trozos = decodeURIComponent(m[1]).split('-').filter(Boolean)
  const fuera = []
  for (const cuantos of [2, 3, 4]) {
    if (trozos.length < cuantos) break
    fuera.push(trozos.slice(-cuantos).join('-'))
  }
  return fuera
}

export function urlDeImagen(imagePath, calidad = 'high') {
  if (!imagePath) return null
  return `${ASSETS}/en/${imagePath}/${calidad}.webp`
}

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

// ── El subtítulo ──
//
// La línea de debajo del nombre: lo que se contesta de un vistazo. Cada
// trozo solo aparece si SE SABE. Un Entrenador no tiene PS y una carta
// sin engordar no tiene casi nada: en los dos casos la línea se acorta,
// que es distinto de decir «0 PS» (la lección de la 319).
export function subtituloDeCarta(carta) {
  const partes = []
  if (carta?.category === 'Pokemon') {
    if (carta.stage) partes.push(faseEs(carta.stage))
    if (carta.evolve_from) partes.push(`Evoluciona de ${carta.evolve_from}`)
    if (Number.isInteger(carta.hp)) partes.push(`${carta.hp} PS`)
    const tipos = (carta.types || []).map(tipoEs).filter(Boolean)
    if (tipos.length) partes.push(`Tipo ${tipos.join(' / ')}`)
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
  return lista
    .map((t) => {
      const es = tipoEs(t) || String(t)
      return `<span class="carta-energia" data-tipo="${escapeHtml(t)}" title="${escapeHtml(es)}" aria-label="${escapeHtml(es)}"></span>`
    })
    .join('')
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

// Debilidad, resistencia y retirada. Los tres son del combate y van
// juntos; un Entrenador no tiene ninguno y el bloque no sale.
function bloqueCombate(carta) {
  if (carta?.category !== 'Pokemon') return ''
  const uno = (etiqueta, filas) => {
    const lista = Array.isArray(filas) ? filas : []
    const texto = lista.length
      ? lista.map((f) => `${tipoEs(f?.type) || ''} ${f?.value || ''}`.trim()).join(', ')
      : '—'
    return `<div><dt>${etiqueta}</dt><dd>${escapeHtml(texto)}</dd></div>`
  }
  const retirada = Number.isInteger(carta.retreat)
    ? `<div><dt>Retirada</dt><dd>${carta.retreat === 0 ? 'Gratis' : `${carta.retreat}`}</dd></div>`
    : ''
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

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fechaLarga(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`
}

// ── El núcleo entero ──
//
// Lo pintan las DOS mitades: el borde antes de entregar la página y
// js/carta.js si el borde no llegó. Por eso vive aquí y no en ninguna de
// las dos, y por eso no toca el DOM: devuelve una cadena.
export function nucleoDeCarta(carta, set) {
  if (!carta) return ''
  const img = urlDeImagen(carta.image_path, 'high')
  const sub = subtituloDeCarta(carta)
  const alt = `Carta de ${carta.name}${set?.name ? ` (${set.name})` : ''}`
  return (
    '<div class="carta-cabecera">' +
    `<h1>${escapeHtml(carta.name || 'Carta')}</h1>` +
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
    bloqueCombate(carta) +
    bloqueAtaques(carta) +
    (carta.description ? `<p class="carta-descripcion">${escapeHtml(carta.description)}</p>` : '') +
    '</div>' +
    '</div>'
  )
}

// ── Quién merece salir en Google ──
//
// «Miles de páginas casi vacías hunden el dominio, no lo suben.» Una
// ficha sin engordar es el nombre, una foto y un número: exactamente lo
// que tienen las otras quince bases de cartas que ya existen, y en
// inglés. Esa nace en `noindex`.
//
// Hoy el listón es «está engordada». Cuando entre el bloque de torneos
// —lo que de verdad no tiene nadie más— el listón sube aquí, en un solo
// sitio, y no en cinco ifs repartidos.
export function mereceIndexarse(carta) {
  return Boolean(carta?.detalle_at)
}

// ════════════════════════════════════════════════════════════════════
// La COLECCIÓN (tanda 324)
// ════════════════════════════════════════════════════════════════════
//
// Vive en este mismo fichero y no en uno suyo por el mismo motivo que
// todo lo de arriba: lo pintan las dos mitades, y para que no haya dos
// copias que se separen tiene que estar en un módulo que pueda importar
// tanto el navegador como la función del borde.

export function rutaDeColeccion(set) {
  const id = String(set?.id ?? '')
  if (!id) return '/cartas'
  return `/coleccion/${encodeURIComponent(id)}`
}

export function idDeRutaDeColeccion(ruta) {
  const m = String(ruta ?? '').match(/^\/coleccion\/([^/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export function urlDeLogo(logoPath) {
  if (!logoPath) return null
  return `${ASSETS}/en/${logoPath}.webp`
}

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
      ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(carta?.name || '')}" width="245" height="337" loading="lazy" decoding="async">`
      : '<span class="coleccion-carta-vacia"></span>') +
    `<span class="coleccion-carta-num">${escapeHtml(carta?.local_id || '')}</span>` +
    `<span class="coleccion-carta-nombre">${escapeHtml(carta?.name || '')}</span>` +
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
