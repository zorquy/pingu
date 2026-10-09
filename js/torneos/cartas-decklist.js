// La decklist con cartas de verdad: la rejilla de imágenes de una lista
// y los iconos del arquetipo.
//
// Desde la tanda 413, CÓMO se resuelve cada línea contra el espejo —el
// código de set, la impresión exacta, la gemela por nombre, la impresión
// que se enseña— vive en js/lista-canonica.js, que no pinta nada: así la
// imagen exportada (que usa también el constructor) enseña las mismas
// cartas sin arrastrar las clases de aquí. Las tres de siempre se
// reexportan para quien ya las importaba de este fichero.
import { rutaDeCarta } from '../carta-ruta.js'
import { cardImageUrl } from '../tcgdex.js'
import { escapeHtml } from '../app.js'
import { marcasLegales, nombresConReimpresionLegal } from '../carta-legalidad.js'
import { claveDeNombre } from '../clave-de-nombre.js'
import { spriteDeCarta, respaldoDeSprite } from './sprites-pokemon.js'
// La imagen de cada línea con su cadena de respaldos, y las energías
// básicas con las nuestras (tanda 366).
import { cadenaDeImagenes, atributosDeImagen } from '../imagen-carta.js'
import { resolverCarta, codigosSinResolver, COLUMNAS_DE_LISTA, esEnergiaBasica, listaParaEnsenar } from '../lista-canonica.js'

export { resolverCarta, codigosSinResolver, COLUMNAS_DE_LISTA }

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
          .map((c) =>
            c.sprite
              ? `<img class="torneo-arquetipo-icono es-sprite" src="${escapeHtml(c.url)}" alt="" loading="lazy" />`
              : // Una carta entera a tamaño de icono no se lee: el marco
                // recorta su ILUSTRACIÓN en un cuadrado, y el icono de un
                // objeto pesa lo mismo a la vista que el minisprite de un
                // Pokémon (lo pidió Ibai en la tanda 235; hasta ahora
                // salía la carta en pequeñito).
                `<span class="torneo-arquetipo-marco"><img class="torneo-arquetipo-icono es-carta" src="${escapeHtml(c.url)}" alt="" loading="lazy" /></span>`
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
          if (img.classList.contains('es-sprite')) {
            spritesRotos.add(img.src)
            // Antes de rendirse se baja un peldaño de la cadena de
            // respaldos: la ESPECIE BASE (una mega recién salida enseña
            // el Pokémon a secas) y, si la caída es de la CDN entera, el
            // segundo ORIGEN. Este mismo manejador vuelve a saltar con
            // cada fallo, así que la cadena se recorre sola; `spritesRotos`
            // es lo que impide dar vueltas si dos peldaños coinciden.
            const respaldo = respaldoDeSprite(img.src)
            if (respaldo && !spritesRotos.has(respaldo)) {
              img.src = respaldo
              return
            }
          }
          // El icono de una carta va dentro de su marco de recorte: se
          // quita el marco entero, que un cuadrado vacío también es un
          // hueco roto.
          ;(img.closest('.torneo-arquetipo-marco') || img).remove()
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

// Pinta la rejilla en `contenedor`. Primero los nombres y las copias —es
// lo que se lee, y sale al momento—; cuando todas las líneas están
// resueltas, la rejilla de verdad con sus imágenes.
//
// Entre medias va la IMPRESIÓN QUE SE ENSEÑA (tanda 413,
// js/impresion-canonica.js): la de rareza más baja de su colección, y una
// sola colección por carta. Por eso la rejilla se pinta DOS veces y no se
// va rellenando casilla a casilla: dos líneas de la lista pueden acabar
// siendo una sola casilla.
export async function pintarDecklistVisual(contenedor, parsed) {
  if (!parsed || !SECCIONES.some((s) => parsed[s.campo]?.length)) {
    contenedor.innerHTML = ''
    return
  }
  const rejilla = (porSeccion, conPie = false) =>
    '<p class="torneo-decklist-reglamento hidden" data-reglamento></p>' +
    SECCIONES.filter((s) => porSeccion[s.campo]?.length)
      .map(
        (s) => `
      <h5 class="torneo-cartas-titulo">${s.titulo} <span class="subtext">(${porSeccion[s.campo].reduce((n, l) => n + l.quantity, 0)})</span></h5>
      <div class="torneo-cartas-rejilla">
        ${porSeccion[s.campo]
          .map(
            (l, i) => `
          <figure class="torneo-carta" data-linea="${s.campo}-${i}">
            <span class="torneo-carta-cuantas">×${l.quantity}</span>
            <figcaption>${conPie && l.carta ? `<a class="torneo-carta-enlace" href="${escapeHtml(rutaDeCarta(l.carta))}">${escapeHtml(l.name)}</a>` : escapeHtml(l.name)}</figcaption>
          </figure>`
          )
          .join('')}
      </div>`
      )
      .join('')
  contenedor.innerHTML = rejilla(parsed)

  const legales = await marcasLegales()
  // Lo que se enseña: cada línea resuelta, con su impresión de rareza más
  // baja y una sola colección por carta (js/lista-canonica.js).
  const { porSeccion, sinIdentificar } = await listaParaEnsenar(parsed)
  contenedor.innerHTML = rejilla(porSeccion, true)

  // La regla de la reimpresión, de una vez para toda la lista y la MISMA
  // que el constructor (tanda 800): las de marca vieja que no son energía
  // básica se preguntan juntas.
  const viejas = SECCIONES.flatMap((s) => porSeccion[s.campo])
    .filter((l) => l.carta?.exacta && l.carta.regulation_mark && !legales.includes(l.carta.regulation_mark) && !esEnergiaBasica(l))
    .map((l) => l.carta)
  const conReimpresion = viejas.length ? await nombresConReimpresionLegal(viejas) : new Set()

  let fuera = 0
  await Promise.all(
    SECCIONES.flatMap((s) =>
      porSeccion[s.campo].map(async (linea, i) => {
        const hueco = contenedor.querySelector(`[data-linea="${s.campo}-${i}"]`)
        if (!hueco) return
        const carta = linea.carta
        // La imagen con su cadena de respaldos (js/imagen-carta.js): las
        // energías básicas con las suyas, y sin carta en el espejo la CDN
        // de Limitless por set y número (tanda 366). Sin carta no se
        // enlaza: no hay dirección que poner.
        const attrs = atributosDeImagen(cadenaDeImagenes(linea, carta, (ruta) => cardImageUrl(ruta, 'low')))
        if (attrs) {
          const img = `<img ${attrs} alt="${escapeHtml(linea.name)}" width="245" height="342" loading="lazy" />`
          // La IMAGEN también enlaza (tanda 340), sin foco propio y oculta
          // al lector de pantalla: el enlace del pie ya lleva al mismo
          // sitio (la excepción de los 44 px de un enlace que repite el
          // destino de una caja mayor).
          hueco.insertAdjacentHTML(
            'afterbegin',
            carta
              ? `<a class="torneo-carta-foto" href="${escapeHtml(rutaDeCarta(carta))}" tabindex="-1" aria-hidden="true">${img}</a>`
              : `<span class="torneo-carta-foto">${img}</span>`
          )
        }
        // `carta.exacta` es la guarda más importante: sin ella se juzgaba
        // a una gemela encontrada por el nombre (tanda 328).
        if (
          carta?.exacta &&
          carta.regulation_mark &&
          !legales.includes(carta.regulation_mark) &&
          !esEnergiaBasica(linea) &&
          // La regla de la reimpresión: una impresión vieja con versión
          // moderna legal se juega — no se acusa.
          !conReimpresion.has(claveDeNombre(carta))
        ) {
          fuera += linea.quantity
          hueco.classList.add('torneo-carta-ilegal')
          hueco.insertAdjacentHTML(
            'beforeend',
            `<span class="torneo-carta-marca" title="Marca de regulación ${escapeHtml(carta.regulation_mark)}: fuera del reglamento y sin reimpresión legal (legales: ${legales.join(', ')})">${escapeHtml(carta.regulation_mark)}</span>`
          )
        }
      })
    )
  )
  const aviso = contenedor.querySelector('[data-reglamento]')
  if (!aviso) return

  // Dos mensajes distintos porque son dos cosas distintas, y mezclarlas
  // fue justo el fallo: «no la reconozco» no es «está prohibida».
  const partes = []
  if (fuera > 0) {
    partes.push(
      `Fuera del reglamento: ${fuera} ${fuera === 1 ? 'carta' : 'cartas'} — esta temporada solo valen las marcas ${legales.join(', ')} (la letra pequeña de la esquina), y estas no tienen reimpresión legal. Es un aviso: la lista se puede entregar igual, lo revisará la organización.`
    )
  }
  if (sinIdentificar > 0) {
    partes.push(
      `No he podido identificar ${sinIdentificar} ${sinIdentificar === 1 ? 'carta' : 'cartas'}: su colección no está en nuestro catálogo todavía. La imagen puede ser de otra impresión y de esas NO se comprueba el reglamento.`
    )
  }
  if (partes.length) {
    aviso.textContent = partes.join(' ')
    aviso.classList.remove('hidden')
  }
}
