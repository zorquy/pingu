// La decklist con cartas de verdad: cada línea del export de TCG Live
// se busca en NUESTRO espejo de cartas (`tcg_cards`, el mismo que usa el
// buscador — a TCGdex no se le llama desde aquí) y se pinta con su
// imagen y su contador. Lo que el espejo no tenga se queda como línea de
// texto, que una lista nunca debe perder cartas por culpa del catálogo.
//
// La tabla de códigos de set de TCG Live vive en comun.js (sin DOM):
// con ella la carta se busca dentro de SU set y por su NÚMERO — sin
// pasar por el nombre, que el export viene en el idioma del jugador y
// el espejo guarda el español cuando existe: cruzar nombres entre
// idiomas era la causa de las cartas «sin imagen». Sin correspondencia
// de set, se cae a la búsqueda global por nombre de siempre.
//
// Además de la imagen, la carta trae su MARCA DE REGULACIÓN (D…J): con
// las marcas legales de la temporada (site_settings 'torneos_reglas',
// hoy H/I/J) la rejilla señala las cartas fuera del reglamento. Las
// energías básicas están exentas, como en el juego real. Una carta que
// el espejo aún no tenga marcada (columna a NULL) no se señala: sin
// dato no hay acusación.
import { supabase } from '../supabase.js'
import { searchCards, cardImageUrl, normalizeSearch } from '../tcgdex.js'
import { escapeHtml } from '../app.js'
import { nombreDeSetLive, MARCAS_LEGALES_DEFECTO } from './comun.js'
import { spriteDeCarta } from './sprites-pokemon.js'

const cache = new Map()
const setsPorCodigo = new Map() // código Live → set_id del espejo (o null)
let marcasCache = null

// Las marcas legales de la temporada, una sola vez por página.
export async function marcasLegales() {
  if (marcasCache) return marcasCache
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'torneos_reglas').maybeSingle()
    const marcas = data?.value?.marcas_legales
    marcasCache = Array.isArray(marcas) && marcas.length ? marcas : MARCAS_LEGALES_DEFECTO
  } catch {
    marcasCache = MARCAS_LEGALES_DEFECTO
  }
  return marcasCache
}

// Una energía básica nunca está fuera de reglamento, lleve la marca que
// lleve (regla del juego real). Por nombre y no por categoría: la
// importación básica del espejo deja category a null.
function esEnergiaBasica(linea) {
  return /^basic\b|b[áa]sica/i.test(linea.name)
}

// Los códigos que un admin ha asignado a mano desde /admin, en
// site_settings. Existen porque la tabla de comun.js está escrita a mano
// y se queda corta CADA VEZ que sale un set: el 2026-09-01 una lista
// traía ASC, POR, CRI y MEE, y ninguno estaba — las cartas de esos
// cuatro sets salían sin imagen y nadie podía arreglarlo sin desplegar.
//
// Con esto se arregla desde el panel en un minuto y sin tocar código.
// Manda sobre la tabla del código: si algo está mal ahí, se corrige
// aquí sin esperar a nadie.
let codigosDeAdmin = null
async function overridesDeSets() {
  if (codigosDeAdmin) return codigosDeAdmin
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'torneos_sets_live').maybeSingle()
    codigosDeAdmin = data?.value?.codigos || {}
  } catch {
    codigosDeAdmin = {}
  }
  return codigosDeAdmin
}

// De «TWM» al identificador de nuestro set. Tres intentos, en este
// orden y por este motivo:
//
//   1. Lo que un admin haya dicho a mano. Va primero para poder corregir
//      un error de TCGdex sin esperar a nadie. Casi siempre está vacío.
//   2. LA BASE: `tcg_sets.tcg_online_code`, que lo rellena la
//      importación con lo que dice TCGdex (tanda 233). Este es el camino
//      normal, y el que hace que un set nuevo funcione SOLO.
//   3. La tabla escrita a mano de comun.js, que busca por el nombre del
//      set. Se queda como red para los sets importados antes de que
//      existiera la columna, y para nada más: NO hay que ampliarla al
//      salir un set nuevo — de eso se encarga el paso 2.
async function setDeCodigo(codigo) {
  if (setsPorCodigo.has(codigo)) return setsPorCodigo.get(codigo)
  const clave = String(codigo || '').toUpperCase()

  const overrides = await overridesDeSets()
  if (overrides[clave]) {
    setsPorCodigo.set(codigo, overrides[clave])
    return overrides[clave]
  }

  let setId = null
  try {
    const { data } = await supabase
      .from('tcg_sets')
      .select('id')
      .eq('market', 'WEST')
      .eq('tcg_online_code', clave)
      .limit(1)
    setId = data?.[0]?.id || null
  } catch {
    // Sin la columna (migración sin ejecutar) esto falla y se sigue por
    // la tabla de siempre, que es exactamente lo que hacía antes.
    setId = null
  }

  if (!setId) {
    const nombre = nombreDeSetLive(clave)
    if (nombre) {
      try {
        const { data } = await supabase.from('tcg_sets').select('id').eq('market', 'WEST').eq('name', nombre).limit(1)
        setId = data?.[0]?.id || null
      } catch {
        setId = null
      }
    }
  }

  setsPorCodigo.set(codigo, setId)
  return setId
}

// Los códigos de set que aparecen en una lista y que NO sabemos
// resolver. Es lo que el panel de /admin enseña para que se puedan
// asignar: sin esto, un set nuevo se queda sin imágenes en silencio y
// hay que descubrirlo mirando decklists a mano.
export async function codigosSinResolver(parsed) {
  const lineas = [...(parsed?.pokemon || []), ...(parsed?.trainer || []), ...(parsed?.energy || [])]
  const codigos = [...new Set(lineas.map((l) => String(l.set || '').toUpperCase()).filter(Boolean))]
  const sinResolver = []
  for (const c of codigos) {
    if (!(await setDeCodigo(c))) sinResolver.push(c)
  }
  return sinResolver
}

async function resolverCarta(linea) {
  const clave = `${normalizeSearch(linea.name)}|${linea.set}|${linea.number}`
  if (cache.has(clave)) return cache.get(clave)
  const nombreNorm = normalizeSearch(linea.name)
  let carta = null
  try {
    // Primero el tiro exacto: su set y su número de colección, SIN el
    // nombre (los sets nuevos numeran con ceros por delante — 057 — y
    // el export dice 57, así que se prueban las dos formas).
    const setId = await setDeCodigo(linea.set)
    if (setId) {
      const numero = String(linea.number)
      const { data } = await supabase
        .from('tcg_cards')
        .select('id, set_id, local_id, name, image_path, regulation_mark')
        .eq('market', 'WEST')
        .eq('set_id', setId)
        .in('local_id', [numero, numero.padStart(3, '0')])
        .limit(1)
      carta = data?.[0] || null
    }
    // Sin set en el espejo (o carta que no aparece): por nombre, como antes.
    if (!carta) {
      const { cartas } = await searchCards(linea.name, { limite: 24 })
      const gemelas = cartas.filter((c) => normalizeSearch(c.name) === nombreNorm)
      carta = gemelas.find((c) => c.local_id === String(linea.number)) || gemelas[0] || cartas[0] || null
    }
  } catch {
    carta = null
  }
  cache.set(clave, carta)
  return carta
}

// ── Los dos iconos del arquetipo (tanda 230) ──
//
// Reutiliza resolverCarta() a propósito: misma caché, mismo camino de
// respaldo por nombre y mismo comportamiento con las cartas que el
// espejo no tiene. Un icono que no se resuelve no se pinta — antes eso
// que un hueco roto.
//
// MINISPRITE del Pokémon cuando lo hay, y miniatura de la carta cuando
// no (tanda 231, pedido por PINGU: «como Limitless»). Los dos casos hacen
// falta — un arquetipo se nombra por un Pokémon casi siempre, pero
// también por un objeto («Martillos»), y un objeto no tiene sprite.
//
// Lo mejor de resolver el sprite por el NOMBRE: los iconos deducidos ya
// traen el nombre de la carta, así que no cuestan NI UNA consulta. Solo
// los del catálogo (que se guardan como set + número) hay que buscarlos
// en el espejo, y solo para saber cómo se llama la carta.
// Los sprites que YA se ha visto que no cargan. Sin esto, la ficha —que
// se repinta sola cada pocos segundos— volvería a meter la misma imagen
// rota una y otra vez, y el nombre del mazo aparecería y desaparecería
// en bucle. Con la lista, el primer fallo es el último: a partir de ahí
// se usa directamente la miniatura de la carta, o el nombre.
//
// Es por carga de página a propósito: si la CDN vuelve, basta recargar.
const spritesRotos = new Set()

export async function resolverIconosDeArquetipo(iconos) {
  const lineas = (iconos || []).slice(0, 2).map((i) => ({
    name: i.nombre || '',
    set: i.set,
    // El catálogo dice `numero` y una línea de decklist dice `number`.
    number: i.numero ?? i.number,
  }))

  const resueltos = await Promise.all(
    lineas.map(async (l) => {
      // 1. El sprite con lo que ya tenemos: cero consultas.
      const directo = l.name ? spriteDeCarta(l.name) : null
      if (directo && !spritesRotos.has(directo)) return { url: directo, nombre: l.name, sprite: true }

      // 2. Sin sprite (o con uno que ya se sabe roto): al espejo de
      //    cartas, que es de donde sale la miniatura de respaldo.
      const carta = await resolverCarta(l).catch(() => null)
      if (!carta) return null
      const porNombre = spriteDeCarta(carta.name)
      if (porNombre && !spritesRotos.has(porNombre)) return { url: porNombre, nombre: carta.name, sprite: true }

      // 3. No es un Pokémon: la miniatura de la carta, que para un
      //    objeto es justo lo que hay que enseñar.
      const url = cardImageUrl(carta.image_path, 'low')
      return url ? { url, nombre: carta.name || l.name, sprite: false } : null
    })
  )
  return resueltos.filter(Boolean)
}

// La chapa se pinta en DOS TIEMPOS, como la rejilla de la decklist: la
// clasificación se construye como una cadena de HTML de una vez, y
// resolver las cartas es ir a la base. Primero sale el hueco con el
// nombre (que ya es útil por sí solo), y después se rellenan las
// imágenes. Si no llegan, se queda el nombre: nunca un hueco roto.
export function chapaArquetipoHtml(arq, { marcar = false } = {}) {
  if (!arq) return ''
  const sinCatalogar = marcar && !arq.curado ? ' torneo-arquetipo-sin-catalogar' : ''
  return `<span class="torneo-arquetipo${sinCatalogar}" role="img" aria-label="${escapeHtml(arq.nombre)}"
    title="${escapeHtml(arq.nombre)}${marcar && !arq.curado ? ' (sin catalogar)' : ''}"
    data-arquetipo="${escapeHtml(JSON.stringify(arq.iconos || []))}"><span class="torneo-arquetipo-nombre">${escapeHtml(arq.nombre)}</span></span>`
}

// Rellena las chapas que haya dentro de `raiz`. Se llama tras pintar, y
// es idempotente: una chapa ya rellenada no se vuelve a pedir (el
// refresco de la ficha repinta la tabla entera cada pocos segundos).
export async function rellenarChapasArquetipo(raiz) {
  const chapas = [...(raiz || document).querySelectorAll('[data-arquetipo]')]
  await Promise.all(
    chapas.map(async (chapa) => {
      let iconos = []
      try {
        iconos = JSON.parse(chapa.dataset.arquetipo || '[]')
      } catch {
        return
      }
      delete chapa.dataset.arquetipo // que un repintado no lo pida dos veces
      if (!iconos.length) return
      const resueltos = await resolverIconosDeArquetipo(iconos)
      if (!resueltos.length) return
      chapa.insertAdjacentHTML(
        'afterbegin',
        resueltos
          .map(
            (c) =>
              `<img class="torneo-arquetipo-icono ${c.sprite ? 'es-sprite' : 'es-carta'}" src="${escapeHtml(c.url)}" alt="" loading="lazy" />`
          )
          .join('')
      )
      chapa.classList.add('torneo-arquetipo-con-iconos')

      // Red debajo: las imágenes vienen de una CDN de fuera y una CDN de
      // fuera se puede caer, cambiar de rutas o estar bloqueada por la
      // red de quien mira. Si una no carga, se quita; y si no queda
      // ninguna, vuelve el NOMBRE del arquetipo — que es lo que había
      // antes de los iconos y dice lo mismo. Nunca un hueco roto.
      for (const img of chapa.querySelectorAll('.torneo-arquetipo-icono')) {
        img.addEventListener('error', () => {
          if (img.classList.contains('es-sprite')) spritesRotos.add(img.src)
          img.remove()
          if (!chapa.querySelector('.torneo-arquetipo-icono')) {
            chapa.classList.remove('torneo-arquetipo-con-iconos')
          }
        })
      }
    })
  )
}

const SECCIONES = [
  { campo: 'pokemon', titulo: 'Pokémon' },
  { campo: 'trainer', titulo: 'Trainer' },
  { campo: 'energy', titulo: 'Energía' },
]

// Pinta la rejilla en `contenedor` y va rellenando las imágenes según se
// resuelven. Devuelve cuando todas las líneas están decididas.
export async function pintarDecklistVisual(contenedor, parsed) {
  if (!parsed || !SECCIONES.some((s) => parsed[s.campo]?.length)) {
    contenedor.innerHTML = ''
    return
  }
  contenedor.innerHTML =
    '<p class="torneo-decklist-reglamento hidden" data-reglamento></p>' +
    SECCIONES.filter((s) => parsed[s.campo]?.length)
      .map(
        (s) => `
      <h5 class="torneo-cartas-titulo">${s.titulo} <span class="subtext">(${parsed[s.campo].reduce((n, l) => n + l.quantity, 0)})</span></h5>
      <div class="torneo-cartas-rejilla">
        ${parsed[s.campo]
          .map(
            (l, i) => `
          <figure class="torneo-carta" data-linea="${s.campo}-${i}">
            <span class="torneo-carta-cuantas">×${l.quantity}</span>
            <figcaption>${escapeHtml(l.name)}</figcaption>
          </figure>`
          )
          .join('')}
      </div>`
      )
      .join('')

  const legales = await marcasLegales()
  let fuera = 0
  await Promise.all(
    SECCIONES.flatMap((s) =>
      (parsed[s.campo] || []).map(async (linea, i) => {
        const carta = await resolverCarta(linea)
        const hueco = contenedor.querySelector(`[data-linea="${s.campo}-${i}"]`)
        if (!hueco || !carta) return
        hueco.insertAdjacentHTML(
          'afterbegin',
          `<img src="${cardImageUrl(carta.image_path, 'low')}" alt="${escapeHtml(linea.name)}" loading="lazy" onerror="this.remove()" />`
        )
        if (carta.regulation_mark && !legales.includes(carta.regulation_mark) && !esEnergiaBasica(linea)) {
          fuera += linea.quantity
          hueco.classList.add('torneo-carta-ilegal')
          hueco.insertAdjacentHTML(
            'beforeend',
            `<span class="torneo-carta-marca" title="Marca de regulación ${escapeHtml(carta.regulation_mark)}: fuera del reglamento (legales: ${legales.join(', ')})">${escapeHtml(carta.regulation_mark)}</span>`
          )
        }
      })
    )
  )
  const aviso = contenedor.querySelector('[data-reglamento]')
  if (aviso && fuera > 0) {
    aviso.textContent = `Fuera del reglamento: ${fuera} ${fuera === 1 ? 'carta' : 'cartas'} — esta temporada solo valen las marcas ${legales.join(', ')} (la letra pequeña de la esquina de la carta).`
    aviso.classList.remove('hidden')
  }
}
