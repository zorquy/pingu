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
import { rutaDeCarta, urlDeLogo } from './carta-ruta.js'
// El escaneo con su respaldo (tanda 370): TCGdex no tiene imagen de
// muchas cartas viejas, y sin esto el bolsillo se quedaba en blanco.
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
// La rareza, en cristiano, para el reparto del resumen (tanda 374).
// De las TABLAS, no del núcleo: `carta-nucleo.js` pinta la ficha entera,
// y el barrido de la 299 sigue los imports —así que importarlo por una
// rareza dejaba seis clases de `carta.css` huérfanas en esta página, que
// no carga esa hoja.
import { rarezaEs, categoriaEs, tipoEs, familiaDeBrillo } from './carta-traducciones.js'
import { esDelTCG } from './catalogo-series.js'
import {
  IDIOMAS,
  ESTADOS,
  VARIANTES,
  IDIOMA_POR_DEFECTO,
  ESTADO_POR_DEFECTO,
  idiomaDe,
  estadoDe,
  varianteDe,
  euros,
  enlaceCardmarket,
  valorDeLinea,
} from './cardmarket.js'
import { icons } from './icons.js'
// La marca de Cardmarket, dibujada (su CSS va en css/cardmarket.css, que
// cargan esta página y la ficha de una carta).
import { marcaCardmarket } from './cardmarket-marca.js'
import * as datos from './mi-coleccion/datos.js'
import * as albumes from './mi-coleccion/albumes.js'
import { archivadorHtml, textoDePaginas, opcionesDeSalto, tapaGuardada, guardarTapa, TAPAS } from './mi-coleccion/archivador.js'
import { variantesDeCarta, tieneVarias, nombreDeVariante } from './mi-coleccion/variantes.js'
import { especiePorDex } from './pokedex-especies.js'
import { progresoDeSet, barrasDeSet, porcentaje } from './mi-coleccion/progreso-set.js'

const $ = (id) => document.getElementById(id)
const params = new URLSearchParams(location.search)

// ── Estado de la página ──
let sesion = null
let dueno = null // { id, username, display_name, coleccion_publica }
let esMia = false
let lineas = []
let cartas = new Map() // id → fila de tcg_cards
let guardados = new Map() // id → fila de tcg_card_prices
const vivos = new Map() // id → { pricing, variants } pedido a TCGdex
let pestania = ['cartas', 'album', 'albumes', 'anadir', 'resumen', 'cambios', 'carpetas', 'pokedex'].includes(params.get('ver')) ? params.get('ver') : 'cartas'
let albumesAbiertos = false

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
let pokedexCargada = false
let especieAbierta = null

const nombreDe = (c) => c?.name_es || c?.name || 'Carta'

// El número impreso ordena «como en el álbum»: 2 antes que 10, y los
// que llevan letras (TG12, SV045) detrás de los numéricos.
function porNumero(a, b) {
  const na = parseInt(a.local_id, 10)
  const nb = parseInt(b.local_id, 10)
  const ea = String(a.local_id).match(/^\d+$/) ? 0 : 1
  const eb = String(b.local_id).match(/^\d+$/) ? 0 : 1
  return ea - eb || (Number.isFinite(na) && Number.isFinite(nb) ? na - nb : 0) || String(a.local_id).localeCompare(String(b.local_id))
}

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
  const faltan = [...new Set(lineas.map((l) => l.card_id))].filter((id) => !vivos.has(id) && !yaSeSabe(id)).slice(0, EN_VIVO_POR_VISITA)
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
function valorDeAhora() {
  let total = 0
  for (const l of lineas) total += valorDeLinea(l, precioDe(l)) || 0
  return total
}

function pintarResumen() {
  const copias = lineas.reduce((s, l) => s + l.cantidad, 0)
  const distintas = new Set(lineas.map((l) => l.card_id)).size
  let valor = 0
  let sinPrecio = 0
  let pagado = 0
  for (const l of lineas) {
    const v = valorDeLinea(l, precioDe(l))
    if (v) valor += v
    else sinPrecio += l.cantidad
    if (Number(l.precio_compra) > 0) pagado += Number(l.precio_compra) * l.cantidad
  }
  const sets = new Set(lineas.map((l) => cartas.get(l.card_id)?.set_id).filter(Boolean)).size
  $('mcResumen').innerHTML = `
    <div class="mc-cifra"><dt>Cartas</dt><dd>${copias.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra"><dt>Distintas</dt><dd>${distintas.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra"><dt>Colecciones</dt><dd>${sets.toLocaleString('es-ES')}</dd></div>
    <div class="mc-cifra mc-cifra-valor"><dt>Valor estimado</dt><dd>${euros(valor)}</dd></div>
    ${pagado > 0 && esMia ? `<div class="mc-cifra"><dt>Pagado</dt><dd>${euros(pagado)}</dd></div>` : ''}`
  $('mcResumenNota').textContent = lineas.length
    ? `El valor suma la tendencia de Cardmarket de cada carta (o el valor que le hayas puesto tú), sin ajustar por estado.${sinPrecio ? ` ${sinPrecio} ${sinPrecio === 1 ? 'carta no tiene' : 'cartas no tienen'} precio todavía.` : ''}`
    : ''
}

// ══════════════════════════════════════════════════════════════════
// La pestaña «Resumen» (tanda 374)
// ══════════════════════════════════════════════════════════════════
//
// Las cuatro cifras de arriba dicen CUÁNTO tienes; esta pestaña dice QUÉ
// tienes. Todo sale de lo que ya está guardado — ni una consulta más.

// ── Las repetidas ──
//
// «tienes 3 · te sobran 2». Es la puerta a los intercambios: sin saber
// qué te sobra no hay nada que ofrecer, y es la pregunta que se hace
// cualquiera que abre una caja de cartas repetidas.
//
// Se cuenta por CARTA y no por línea: tres copias de la misma carta en
// tres estados distintos son tres líneas y una sola carta repetida. Lo
// que sobra es todo menos una.
function repetidas() {
  const porCarta = new Map()
  for (const l of lineas) porCarta.set(l.card_id, (porCarta.get(l.card_id) || 0) + l.cantidad)
  return [...porCarta.entries()]
    .filter(([, n]) => n > 1)
    .map(([id, n]) => ({ carta: cartas.get(id), id, tengo: n, sobran: n - 1 }))
    .sort((a, b) => b.sobran - a.sobran)
}

// ── Lo más valioso ──
//
// Por el valor de UNA copia y no por el de la línea entera: diez cartas
// de un euro no son «lo más valioso que tienes», son diez cartas de un
// euro. Lo que se quiere enseñar es la pieza.
function masValiosas(cuantas = 10) {
  const porCarta = new Map()
  for (const l of lineas) {
    const v = valorDeLinea(l, precioDe(l))
    if (!v) continue
    const unidad = v / (Number(l.cantidad) || 1)
    if (unidad > (porCarta.get(l.card_id) || 0)) porCarta.set(l.card_id, unidad)
  }
  return [...porCarta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cuantas)
    .map(([id, v]) => ({ carta: cartas.get(id), id, valor: v }))
}

// ── El reparto ──
//
// Cuántas cartas DISTINTAS por serie y por rareza. Distintas y no
// copias: «tengo 40 de Espada y Escudo» se entiende; «tengo 78 contando
// repetidas» no dice nada de la colección.
function repartoPor(saca) {
  const cuenta = new Map()
  for (const id of new Set(lineas.map((l) => l.card_id))) {
    const clave = saca(cartas.get(id))
    if (!clave) continue
    cuenta.set(clave, (cuenta.get(clave) || 0) + 1)
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
    <a href="${c ? escapeHtml(rutaDeCarta(c)) : '#'}">
      <span class="mc-fila-foto">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}</span>
      <span class="mc-fila-nombre">${escapeHtml(nombreDe(c))}<small>${escapeHtml(c?.tcg_sets?.name || '')}</small></span>
    </a>
    <span class="mc-fila-dato">${derecha}</span>
  </li>`
}

function pintarResumenPanel() {
  const caja = $('mcResumenPanel')
  if (!caja) return
  if (!lineas.length) {
    caja.innerHTML = '<p class="subtext">Cuando añadas cartas, aquí te contamos qué tienes.</p>'
    return
  }
  const rep = repetidas()
  const valiosas = masValiosas()
  const porSerie = repartoPor((c) => c?.tcg_sets?.name)
  const porRareza = repartoPor((c) => (c?.rarity ? rarezaEs(c.rarity) : null))
  const sobranTotal = rep.reduce((s, r) => s + r.sobran, 0)
  caja.innerHTML = `
    <!-- El valor en el tiempo (tanda 377). Va ARRIBA y a lo ancho, no en
         la rejilla: es la única cifra que cambia sola, y es la que se
         viene a mirar. -->
    <section class="mc-resumen-caja mc-valor-caja" id="mcValorCaja">
      <h3>Lo que vale tu colección</h3>
      <div class="skeleton" style="height:120px"></div>
    </section>
    <div class="mc-resumen-rejilla">
      <section class="mc-resumen-caja">
        <h3>Tus repetidas</h3>
        ${
          rep.length
            ? `<p class="subtext">Te sobran <strong>${sobranTotal}</strong> ${sobranTotal === 1 ? 'copia' : 'copias'} de ${rep.length} ${rep.length === 1 ? 'carta' : 'cartas'}. Son las que puedes cambiar.</p>
               <ul class="mc-lista-cartas">${rep.slice(0, 12).map((r) => filaDeCartaHtml(r.carta, `tienes ${r.tengo} · <strong>te sobran ${r.sobran}</strong>`)).join('')}</ul>`
            : '<p class="subtext">No tienes ninguna repetida todavía.</p>'
        }
      </section>
      <section class="mc-resumen-caja">
        <h3>Lo más valioso</h3>
        ${
          valiosas.length
            ? `<ul class="mc-lista-cartas">${valiosas.map((v) => filaDeCartaHtml(v.carta, `<strong>${euros(v.valor)}</strong>`)).join('')}</ul>
               <p class="subtext">Por lo que vale UNA copia, no la línea entera.</p>`
            : '<p class="subtext">Todavía no sabemos el precio de ninguna de tus cartas.</p>'
        }
      </section>
      <section class="mc-resumen-caja">
        <h3>Por colección</h3>
        ${barrasHtml(porSerie.slice(0, 10)) || '<p class="subtext">—</p>'}
      </section>
      <section class="mc-resumen-caja">
        <h3>Por rareza</h3>
        ${barrasHtml(porRareza.slice(0, 10)) || '<p class="subtext">Tus cartas todavía no tienen rareza guardada.</p>'}
      </section>
    </div>`
  pintarValorEnElTiempo()
}

// La gráfica llega DESPUÉS y por su cuenta: el resto del resumen sale de
// lo que ya está en memoria y no tiene por qué esperar a una consulta.
// Se pide una sola vez por visita.
let historico = null

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
    caja.innerHTML = `<h3>Lo que vale tu colección</h3>${historico.grafica.graficaHtml(historico.filas, { ahora: valorDeAhora() })}`
  } catch {
    // Una gráfica que no llega no puede tumbar el resumen: se quita la
    // caja y lo demás sigue ahí.
    caja.remove()
  }
}

// ── Pestaña «Cartas» ──
function chipsDe(l) {
  const chips = [idiomaDe(l.idioma).id.toUpperCase(), estadoDe(l.estado).id]
  if (l.variante !== 'normal') chips.push(varianteDe(l.variante).nombre)
  if (l.gradeo) chips.push(l.gradeo)
  const base = chips.map((c) => `<span class="mc-chip">${escapeHtml(c)}</span>`).join('')
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
  const c = cartas.get(l.card_id)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const variante = l.variante !== 'normal' ? varianteDe(l.variante).nombre : ''
  const brillo = c ? familiaDeBrillo(c.rarity) : null
  // La etiqueta la lee quien no ve la carta, así que lleva lo que la
  // imagen dice sin palabras: qué es, de dónde y cuántas.
  const etiqueta = `${nombreDe(c)}${c?.tcg_sets?.name ? `, ${c.tcg_sets.name}` : ''}${
    variante ? `, ${variante}` : ''
  }${l.cantidad > 1 ? `, ${l.cantidad} copias` : ''}`
  return `
    <article class="mc-carta" data-linea="${escapeHtml(l.id)}">
      <button type="button" class="mc-carta-foto carta-scan-holo"${
        brillo ? ` data-brillo="${brillo}"` : ''
      } data-ficha aria-label="${escapeHtml(etiqueta)}">
        ${
          // Sin escaneo se pinta un hueco CON EL NOMBRE dentro, no nada.
          // Al quitar el texto de debajo, una carta sin imagen se quedaba
          // en un botón vacío de cero píxeles: invisible y, peor, sin
          // poder pulsarse para abrir su ficha. Un hueco que no se puede
          // tocar es una carta que has perdido.
          escaneo
            ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />`
            : `<span class="mc-carta-sinfoto">${escapeHtml(nombreDe(c))}${
                c?.local_id ? `<small>${escapeHtml(c.local_id)}</small>` : ''
              }</span>`
        }
        ${l.cantidad > 1 ? `<span class="mc-cantidad">×${l.cantidad}</span>` : ''}
      </button>
      ${variante ? `<span class="mc-carta-variante">${escapeHtml(variante)}</span>` : ''}
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
const filtros = { tipo: new Set(), energia: new Set(), rareza: new Set(), variante: new Set(), estado: new Set() }
let ordenAlReves = false

const GRUPOS = [
  { id: 'tipo', nombre: 'Tipo de carta', de: (l, c) => (c?.category ? [categoriaEs(c.category)] : []) },
  { id: 'energia', nombre: 'Energía', de: (l, c) => (Array.isArray(c?.types) ? c.types.map(tipoEs) : []) },
  { id: 'rareza', nombre: 'Rareza', de: (l, c) => (c?.rarity ? [rarezaEs(c.rarity)] : []) },
  { id: 'variante', nombre: 'Versión', de: (l) => [varianteDe(l.variante).nombre] },
  { id: 'estado', nombre: 'Estado', de: (l) => [estadoDe(l.estado).nombre] },
]

function valoresDeGrupo(g) {
  const vistos = new Set()
  for (const l of lineas) for (const v of g.de(l, cartas.get(l.card_id))) if (v) vistos.add(v)
  return [...vistos].sort((a, b) => a.localeCompare(b, 'es'))
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
        return `<button type="button" class="mc-chip-filtro${puesto ? ' activo' : ''}" data-grupo="${g.id}" data-valor="${escapeHtml(v)}" aria-pressed="${puesto ? 'true' : 'false'}">${escapeHtml(v)}</button>`
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
  const orden = $('mcOrden').value
  const filtradas = lineas.filter((l) => {
    const c = cartas.get(l.card_id)
    if (set && c?.set_id !== set) return false
    if (idioma && l.idioma !== idioma) return false
    if (texto && !normalizeSearch(`${c?.name || ''} ${c?.name_es || ''} ${c?.tcg_sets?.name || ''}`).includes(texto)) return false
    // Los chips: dentro de un grupo suman (quiero Agua O Fuego) y entre
    // grupos restan (Agua Y rara). Es como se espera de un filtro, y al
    // revés no serviría: elegir dos rarezas dejaría cero resultados.
    for (const g of GRUPOS) {
      if (!filtros[g.id].size) continue
      const suyos = g.de(l, c)
      if (!suyos.some((v) => filtros[g.id].has(v))) return false
    }
    return true
  })
  const valor = (l) => valorDeLinea(l, precioDe(l)) || 0
  const cmp = {
    valor: (a, b) => valor(b) - valor(a),
    recientes: (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    nombre: (a, b) => nombreDe(cartas.get(a.card_id)).localeCompare(nombreDe(cartas.get(b.card_id)), 'es'),
    coleccion: (a, b) => {
      const ca = cartas.get(a.card_id)
      const cb = cartas.get(b.card_id)
      return String(cb?.tcg_sets?.release_date || '').localeCompare(String(ca?.tcg_sets?.release_date || '')) || String(ca?.set_id).localeCompare(String(cb?.set_id)) || porNumero(ca || {}, cb || {})
    },
  }[orden]
  const ordenadas = filtradas.sort(cmp)
  // Al revés = al revés de lo que diga el orden elegido, sea cual sea.
  // Invertir la lista YA ordenada y no escribir cuatro comparadores más
  // es lo que hace que un orden nuevo salga con su vuelta puesta.
  return ordenAlReves ? ordenadas.reverse() : ordenadas
}

function pintarCartas() {
  const lista = lineasFiltradas()
  $('mcCartas').innerHTML = lista.map(lineaHtml).join('')
  $('mcCartasVacio').classList.toggle('hidden', lineas.length > 0)
  $('mcFiltros').classList.toggle('hidden', !lineas.length)
  $('mcSinResultados').classList.toggle('hidden', !lineas.length || lista.length > 0)
}

function pintarFiltros() {
  const sets = new Map()
  for (const l of lineas) {
    const c = cartas.get(l.card_id)
    if (c?.set_id) sets.set(c.set_id, c.tcg_sets?.name || c.set_id)
  }
  const actual = $('mcFiltroSet').value
  $('mcFiltroSet').innerHTML = '<option value="">Todas las colecciones</option>' + [...sets].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([id, n]) => `<option value="${escapeHtml(id)}"${id === actual ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('')
}

// ── Editar una línea ──
function abrirEditor(l) {
  const c = cartas.get(l.card_id)
  const d = $('mcEditor')
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
  const brillo = c ? familiaDeBrillo(c.rarity) : null
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
    ? `${c.tcg_sets?.name || ''}${c.local_id ? ` · ${c.local_id}` : ''}`
    : l.card_id
  // Las chapas de TU copia, para no tener que leer los desplegables:
  // versión, idioma, estado, gradeo y cuántas das.
  $('mcEdChapas').innerHTML = chipsDe(l)
  // Y la tabla de datos. No es adorno: la rareza, el tipo de energía y el
  // ilustrador son justo por lo que se filtra, así que verlos aquí es lo
  // que enseña qué se puede pedir. Una fila que no se sabe NO se pinta —
  // «Ilustrador: —» ocupa lo mismo que el dato y no dice nada.
  $('mcEdTabla').innerHTML = tablaDeCarta(c)
  pintarCarpetasDeLaFicha(l.id)
  pintarQuienLaTiene(l.card_id)
  $('mcEdIdioma').innerHTML = opciones(IDIOMAS, l.idioma)
  $('mcEdEstado').innerHTML = opciones(ESTADOS, l.estado)
  $('mcEdVariante').innerHTML = opciones(VARIANTES, l.variante)
  $('mcEdCantidad').value = l.cantidad
  // `?? 0` y no `|| 0`: son lo mismo hoy, pero el día que la columna no
  // esté (la migración sin ejecutar) `undefined || 0` y `undefined ?? 0`
  // siguen dando 0 — lo que no vale es un `l.cambio` a pelo, que
  // dejaría el campo con «undefined» escrito dentro.
  $('mcEdCambio').value = Number(l.cambio) || 0
  $('mcEdGradeo').value = l.gradeo || ''
  $('mcEdValor').value = l.valor_manual ?? ''
  $('mcEdCompra').value = l.precio_compra ?? ''
  $('mcEdNotas').value = l.notas || ''
  pintarNota(l.notas || '')
  const precio = precioDe(l)
  // Con `precio` a secas salía «Desde — · tendencia —» para una carta
  // de la que solo se sabe el `idProduct`: dos rayas no son un precio.
  $('mcEdPrecio').textContent = datos.tieneCifras(precio)
    ? `Desde ${euros(precio.desde)} · tendencia ${euros(precio.tendencia)}${precio.prestado ? ' (de la versión normal: Cardmarket no publica el del reverso)' : ''}`
    : 'Sin precio de Cardmarket.'
  // Y el enlace a Cardmarket también aquí, con los filtros de ESTA línea:
  // es justo cuando estás mirando lo que vale cuando quieres ir a verla.
  const cm = $('mcEdCardmarket')
  cm.href = enlaceCardmarket({ idProduct: precio?.idProduct, idioma: l.idioma, estado: l.estado, variante: l.variante, nombre: nombreDe(c) })
  cm.innerHTML = `${marcaCardmarket(18)}<span>Ver en Cardmarket</span>`
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
  d.showModal()
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
    ['Rareza', rarezaEs(c.rarity)],
    ['Número', c.local_id ? `${c.local_id}${c.tcg_sets?.card_count_official ? ` / ${c.tcg_sets.card_count_official}` : ''}` : ''],
    ['Ilustrador', c.illustrator],
    ['Salida', fecha ? new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : ''],
    // El número nacional solo si la carta es de UNA especie: una TAG TEAM
    // lleva dos y «25, 133» no es un número de Pokédex, es una lista.
    ['N.º nacional', Array.isArray(c.dex_ids) && c.dex_ids.length === 1 ? String(c.dex_ids[0]) : ''],
  ]
  return filas
    .filter(([, v]) => v)
    .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd></div>`)
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
    gradeo: $('mcEdGradeo').value.trim().slice(0, 20) || null,
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
    guardadoPendiente = setTimeout(() => guardarEditor(), retardo)
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
      lineas = lineas.filter((l) => l.id !== id)
      d.dataset.linea = ''
      d.close()
      showToast('Quitada de tu colección.', 'success')
      repintar()
      return
    }
    const nueva = await datos.actualizar(id, cambios)
    lineas = lineas.map((l) => (l.id === id ? nueva : l))
    // Sin toast: saldría uno por cada toque del contador. El aviso vive
    // en la propia ficha y se apaga solo.
    if (aviso) {
      aviso.textContent = 'Guardado'
      aviso.classList.add('visible')
      clearTimeout(aviso.dataset.reloj)
      aviso.dataset.reloj = setTimeout(() => aviso.classList.remove('visible'), 1600)
    }
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
let album = { set: null, cartas: [], pagina: 0, soloFaltan: false, split: false }
let todosLosSets = null

async function cargarSets() {
  if (todosLosSets) return todosLosSets
  const { data } = await supabase
    .from('tcg_sets')
    // El logo y la serie viajan desde la tanda 372: la estantería se ve
    // por los logos, y agrupar por serie es lo que hace navegable una
    // lista de 220 colecciones.
    .select('id,name,serie_id,serie_name,logo_path,release_date,card_count_official,card_count_total,tcg_online_code')
    .eq('market', 'WEST')
    .order('release_date', { ascending: false, nullsFirst: false })
    .limit(1000)
  todosLosSets = (data || []).filter((s) => esDelTCG(s))
  return todosLosSets
}

// Cuántas copias tienes de una carta. Con `variante` cuenta solo las de
// esa versión (tanda 383); sin ella, todas — que es lo que mide el
// progreso de una colección, porque un álbum se llena por BOLSILLOS y
// un bolsillo lo llena cualquier versión.
function tengoDe(cardId, variante = null) {
  return lineas
    .filter((l) => l.card_id === cardId && (!variante || (l.variante || 'normal') === variante))
    .reduce((s, l) => s + l.cantidad, 0)
}

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
async function pintarEstanteria() {
  const sets = await cargarSets()
  // Cuántas DISTINTAS tienes de cada colección. Distintas y no copias:
  // el progreso de un álbum es cuántos bolsillos has llenado, y tres
  // Charizards llenan uno.
  const cuantas = new Map()
  for (const id of new Set(lineas.map((l) => l.card_id))) {
    const s = cartas.get(id)?.set_id
    if (s) cuantas.set(s, (cuantas.get(s) || 0) + 1)
  }
  const texto = normalizeSearch($('mcEstanteriaBuscar')?.value || '').trim()
  const serie = $('mcEstanteriaSerie')?.value || ''
  const cumple = (s) =>
    (!serie || s.serie_id === serie) && (!texto || normalizeSearch(`${s.name} ${s.id}`).includes(texto))

  // Las tuyas primero y por lo lleno que está el álbum, no por cuántas
  // cartas tienes: lo que se quiere ver arriba es lo que estás a punto
  // de completar.
  const mias = sets.filter((s) => cuantas.has(s.id) && cumple(s)).sort((a, b) => pctDe(b, cuantas) - pctDe(a, cuantas))
  const resto = esMia ? sets.filter((s) => !cuantas.has(s.id) && cumple(s)) : []

  const series = [...new Map(sets.filter((s) => s.serie_id).map((s) => [s.serie_id, s.serie_name || s.serie_id])).entries()]
  const sel = $('mcEstanteriaSerie')
  if (sel && !sel.dataset.montado) {
    sel.dataset.montado = '1'
    sel.innerHTML = '<option value="">Todas las series</option>' + series.map(([id, n]) => `<option value="${escapeHtml(id)}">${escapeHtml(n)}</option>`).join('')
  }

  $('mcEstanteriaRejilla').innerHTML =
    (mias.length ? `<h3 class="mc-estanteria-titulo">Tus colecciones</h3><div class="mc-estanteria">${mias.map((s) => tarjetaDeSet(s, cuantas.get(s.id) || 0)).join('')}</div>` : '') +
    (resto.length ? `<h3 class="mc-estanteria-titulo">Empezar otra</h3><div class="mc-estanteria">${resto.map((s) => tarjetaDeSet(s, 0)).join('')}</div>` : '')
  $('mcAlbumVacio').classList.toggle('hidden', Boolean(mias.length || resto.length))
}

// Cuántas cartas tiene una colección. `card_count_official` es la
// numeración impresa («1/198») y es la que cuenta para un álbum; si no
// la sabemos, el total. Si no hay ninguna, no se inventa un porcentaje.
function totalDe(set) {
  return set?.card_count_official || set?.card_count_total || 0
}

function pctDe(set, cuantas) {
  const total = totalDe(set)
  return total ? (cuantas.get(set.id) || 0) / total : 0
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
  const logo = urlDeLogo(set.logo_path)
  const completo = total && tengo >= total
  const codigo = set.tcg_online_code || ''
  return `
    <button type="button" class="mc-set-tarjeta${completo ? ' completo' : ''}" data-set="${escapeHtml(set.id)}">
      <span class="mc-set-cabecera">
        ${logo ? `<span class="mc-set-arte" style="--arte:url('${escapeHtml(logo)}')" aria-hidden="true"></span>` : ''}
        <span class="mc-set-logo">${
          logo
            // El logo LLEVA el nombre escrito, así que el <span> de abajo
            // se esconde a la vista cuando hay logo y se queda para quien
            // navega con lector de pantalla (misma decisión que la 346).
            ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" />`
            : ''
        }</span>
        ${codigo ? `<span class="mc-set-codigo">${escapeHtml(codigo)}</span>` : ''}
      </span>
      <span class="mc-set-info">
        <span class="mc-set-nombre${logo ? ' sr-only' : ''}">${escapeHtml(set.name || set.id)}</span>
        ${
          total
            ? `<span class="mc-set-cuenta">${tengo} de ${total}${completo ? ' · completa' : ` · ${pct} %`}</span>
               <span class="mc-barra" aria-hidden="true"><i style="--ancho:${pct}%"></i></span>`
            : '<span class="mc-set-cuenta">Sin numeración</span>'
        }
      </span>
    </button>`
}

// El logo LLEVA el nombre escrito y por eso el `<span>` del nombre va en
// `sr-only`. Pero el día que la CDN no conteste —el 2026-09-20 se cayó
// entera— la tarjeta se quedaba sin NADA que leer: sin logo y sin nombre,
// y sin dar error. Al fallar la imagen, el nombre vuelve a la vista.
// El `error` de una imagen no burbujea, así que se escucha en captura.
function respaldarNombresDeSet(zona) {
  zona.addEventListener('error', (e) => {
    const img = e.target
    if (!img.matches?.('.mc-set-logo img')) return
    img.closest('.mc-set-tarjeta')?.querySelector('.mc-set-nombre')?.classList.remove('sr-only')
    img.remove()
  }, true)
}

// ── Abrir y cerrar el archivador ──
function volverALaEstanteria() {
  album.set = null
  album.pagina = 0
  $('mcEstanteriaZona').classList.remove('hidden')
  $('mcArchivadorZona').classList.add('hidden')
  pintarEstanteria()
}

async function abrirAlbum(setId) {
  album.set = setId
  album.pagina = 0
  // La estantería se va y sale el archivador (tanda 372). Los dos viven
  // en la misma pestaña, como en los álbumes soñados.
  $('mcEstanteriaZona').classList.add('hidden')
  $('mcArchivadorZona').classList.remove('hidden')
  const set = (todosLosSets || []).find((s) => s.id === setId)
  $('mcAlbumTitulo').textContent = set?.name || ''
  $('mcAlbum').innerHTML = '<p class="subtext">Cargando la colección…</p>'
  try {
    album.cartas = (await datos.cartasDeSet(setId)).sort(porNumero)
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
function bolsilloDeVariante(c, v) {
  const n = tengoDe(c.id, v.nuestro)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const nombre = nombreDe(c)
  const etiqueta = `${nombre} (${c.local_id}), ${v.nombre}${n ? `, tienes ${n}` : ', te falta'}`
  const dentro = `
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
    <span class="mc-bolsillo-num">${escapeHtml(c.local_id)}</span>`
  const enlace = `<a class="mc-bolsillo-enlace" href="${escapeHtml(rutaDeCarta(c))}" aria-label="${escapeHtml(etiqueta)}">${dentro}</a>`
  const pie = `<span class="mc-bolsillo-variante">${escapeHtml(v.nombre)}</span>`
  if (!esMia) return `<div class="mc-bolsillo${n ? ' tengo' : ''}">${enlace}${pie}</div>`
  return `<div class="mc-bolsillo${n ? ' tengo' : ''} mc-bolsillo-con-mando">${enlace}${pie}
    <span class="mc-bolsillo-controles mc-bolsillo-mando">
      <button type="button" data-quitar="${escapeHtml(c.id)}" data-var="${escapeHtml(v.nuestro)}" ${n ? '' : 'disabled'} aria-label="Quitar una copia de ${escapeHtml(nombre)}, ${escapeHtml(v.nombre)}">−</button>
      <span class="mc-bolsillo-cuenta" aria-hidden="true">${n}</span>
      <button type="button" data-anadir="${escapeHtml(c.id)}" data-var="${escapeHtml(v.nuestro)}" aria-label="Añadir una copia de ${escapeHtml(nombre)}, ${escapeHtml(v.nombre)}">+</button>
    </span></div>`
}

function bolsilloHtml(c) {
  // En «una por versión» la casilla es de ESA versión: su cuenta, su
  // nombre y sus botones. Sin esto, las cuatro casillas de una carta
  // enseñarían el mismo número y marcarían todas a la vez — cuatro
  // huecos que no se distinguen no son cuatro huecos.
  if (c.__variante) return bolsilloDeVariante(c, c.__variante)
  const n = tengoDe(c.id)
  const escaneo = atributosDeEscaneo(cadenaDeEscaneo(c))
  const nombre = nombreDe(c)
  const etiqueta = `${nombre} (${c.local_id})${n ? `, tienes ${n}` : ', te falta'}`
  const dentro = `
    ${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : ''}
    <span class="mc-bolsillo-num">${escapeHtml(c.local_id)}</span>`
  const enlace = `<a class="mc-bolsillo-enlace" href="${escapeHtml(rutaDeCarta(c))}" aria-label="${escapeHtml(etiqueta)}">${dentro}</a>`
  if (!esMia) return `<div class="mc-bolsillo${n ? ' tengo' : ''}">${enlace}</div>`
  // El número de copias vive DENTRO del mando y no suelto en una
  // esquina: así lo que dice cuántas tienes está pegado a lo que lo
  // cambia, y de paso no hay dos chapas peleándose por el mismo sitio.
  // ── Las versiones, cada una por su lado (tanda 383) ──
  //
  // Solo si la carta tiene MÁS DE UNA: con una sola sería una casilla
  // que solo se puede marcar de una manera. Y las que se enseñan son
  // las que existen de verdad (`tcg_cards.variants`), no las cuatro
  // siempre: ofrecer «1.ª edición» en una carta de 2024 invita a
  // apuntar algo que no se ha impreso nunca.
  const versiones = tieneVarias(c)
    ? `<span class="mc-bolsillo-controles mc-variantes">${variantesDeCarta(c)
        .map((v) => {
          const tengo = tengoDe(c.id, v.nuestro)
          return `<button type="button" class="mc-variante${tengo ? ' tengo' : ''}" data-variante="${escapeHtml(v.nuestro)}" data-carta="${escapeHtml(c.id)}" title="${escapeHtml(v.nombre)}" aria-pressed="${tengo ? 'true' : 'false'}" aria-label="${escapeHtml(v.nombre)} de ${escapeHtml(nombre)}${tengo ? `, tienes ${tengo}` : ', te falta'}">${escapeHtml(v.corto)}</button>`
        })
        .join('')}</span>`
    : ''
  return `<div class="mc-bolsillo${n ? ' tengo' : ''} mc-bolsillo-con-mando">${enlace}${versiones}
    <span class="mc-bolsillo-controles mc-bolsillo-mando">
      <button type="button" data-quitar="${escapeHtml(c.id)}" ${n ? '' : 'disabled'} aria-label="Quitar una copia de ${escapeHtml(nombre)}">−</button>
      <span class="mc-bolsillo-cuenta" aria-hidden="true">${n}</span>
      <button type="button" data-anadir="${escapeHtml(c.id)}" aria-label="Añadir una copia de ${escapeHtml(nombre)}">+</button>
    </span></div>`
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
  if (rareza.dataset.set !== album.set) {
    rareza.innerHTML = opcionesDe((c) => (c.rarity ? rarezaEs(c.rarity) : null), 'Cualquier rareza')
    tipo.innerHTML = opcionesDe((c) => (c.category ? categoriaEs(c.category) : null), 'Cualquier categoría')
    rareza.dataset.set = album.set
    // Y si la colección no tiene ni rarezas ni categorías guardadas —el
    // engorde todavía no ha llegado— el filtro se esconde en vez de
    // ofrecer un desplegable con una sola opción que no hace nada.
    rareza.classList.toggle('hidden', rareza.options.length <= 1)
    tipo.classList.toggle('hidden', tipo.options.length <= 1)
  }
}

function cartasDelAlbumFiltradas() {
  const rareza = $('mcAlbumRareza').value
  const tipo = $('mcAlbumTipo').value
  return album.cartas.filter((c) => {
    if (album.soloFaltan && tengoDe(c.id)) return false
    if (rareza && (!c.rarity || rarezaEs(c.rarity) !== rareza)) return false
    if (tipo && (!c.category || categoriaEs(c.category) !== tipo)) return false
    return true
  })
}

// Cuál de los dos está puesto. `aria-pressed` además de la clase: para
// quien no ve el color, la clase no dice nada.
function pintarVistaVariantes() {
  for (const [id, split] of [['mcVistaStack', false], ['mcVistaSplit', true]]) {
    const b = $(id)
    if (!b) continue
    b.classList.toggle('activo', album.split === split)
    b.setAttribute('aria-pressed', album.split === split ? 'true' : 'false')
  }
}

function pintarAlbum() {
  pintarFiltrosDeAlbum()
  const lista = cartasDelAlbumFiltradas()
  const tengo = album.cartas.filter((c) => tengoDe(c.id)).length
  const total = album.cartas.length
  // El progreso es SIEMPRE el de la colección entera, filtres lo que
  // filtres: «llevas 40 de 198» no puede cambiar porque estés mirando
  // solo las ultra raras. Lo que cambia es la cuenta de al lado.
  const filtrando = lista.length !== album.cartas.length
  $('mcAlbumCuenta').textContent = filtrando ? `${lista.length} de ${total} cartas a la vista` : ''
  // Tres barras y no una (tanda 398). La de «completo» es la de siempre;
  // la de «maestro» cuenta cada versión por separado y es la que
  // persigue quien colecciona en serio; la de «adicionales» son los
  // secretos, aparte porque mezclarlos hace que nadie llegue al 100 %.
  // La que no tiene nada que contar no se pinta.
  // `album.set` es el ID, no el set: el recuento oficial hay que
  // buscarlo. Sin él, `esAdicional` no puede separar los secretos y la
  // barra de «completo» se come el set entero — que es lo que pasaba.
  const elSet = (todosLosSets || []).find((x) => x.id === album.set) || null
  const barras = barrasDeSet(progresoDeSet({ cartas: album.cartas, set: elSet, tengo: tengoDe }))
  $('mcAlbumProgreso').innerHTML = barras
    .map((b) => {
      const pct = porcentaje(b) ?? 0
      return `<div class="mc-barra-fila">
        <span class="mc-barra-nombre">${escapeHtml(b.nombre)}</span>
        <span class="mc-barra" aria-hidden="true"><i style="--ancho:${pct}%"></i></span>
        <span class="mc-barra-cuenta"><strong>${b.tengo}</strong> de ${b.total}</span>
      </div>`
    })
    .join('')
  const ancho = window.matchMedia('(min-width: 900px)').matches
  const deUnaVez = ancho ? 2 : 1
  if (!lista.length) {
    $('mcAlbum').innerHTML = '<p class="subtext">¡No te falta ninguna! Colección completa.</p>'
    $('mcAlbumPaginas').textContent = ''
    $('mcAlbumSalto').innerHTML = ''
    $('mcAlbumSalto').classList.add('hidden')
    $('mcAlbumAnterior').disabled = true
    $('mcAlbumSiguiente').disabled = true
    return
  }
  // El archivador entero lo monta js/mi-coleccion/archivador.js, que lo
  // comparten esta pantalla y los álbumes soñados: era el mismo dibujo
  // escrito dos veces, y ya había empezado a separarse.
  // En «una por versión» cada carta se abre en tantas casillas como
  // versiones tenga. Se hace AQUÍ y no en el filtro para que la cuenta
  // de arriba siga siendo la del set y no la de lo que se ve.
  const paraPintar = album.split
    ? lista.flatMap((c) => variantesDeCarta(c).map((v) => ({ ...c, __variante: v })))
    : lista
  const armado = archivadorHtml({
    lista: paraPintar,
    pagina: album.pagina,
    deUnaVez,
    tapa: tapaGuardada(),
    pintarBolsillo: (c) => bolsilloHtml(c),
  })
  album.pagina = armado.pagina
  $('mcAlbum').innerHTML = armado.html
  $('mcAlbumPaginas').textContent = textoDePaginas(album.pagina, armado.paginas, deUnaVez)
  // El «Ir a…»: en un set de 200 cartas son 22 pliegos, y pasarlos de
  // dos en dos con el botón es media docena de clics para nada.
  const salto = $('mcAlbumSalto')
  salto.innerHTML = opcionesDeSalto(armado.paginas, deUnaVez, album.pagina)
  salto.classList.toggle('hidden', armado.paginas <= deUnaVez)
  $('mcAlbumAnterior').disabled = album.pagina === 0
  $('mcAlbumSiguiente').disabled = album.pagina + deUnaVez >= armado.paginas
  $('mcAlbumAnterior').dataset.paso = String(deUnaVez)
}

// `variante` llega desde «una por versión» (tanda 398): ahí el + suma a
// ESA versión y no a la normal, que es lo que distingue las casillas.
async function tocarBolsillo(cardId, variante = 'normal') {
  const idioma = $('mcTocarIdioma').value
  const estado = $('mcTocarEstado').value
  try {
    const nueva = await datos.anadir(sesion.user.id, { card_id: cardId, idioma, estado, variante, cantidad: 1 })
    const i = lineas.findIndex((l) => l.id === nueva.id)
    if (i >= 0) lineas[i] = nueva
    else lineas.unshift(nueva)
    if (!cartas.has(cardId)) {
      const c = album.cartas.find((x) => x.id === cardId)
      const set = (todosLosSets || []).find((s) => s.id === album.set)
      if (c) cartas.set(cardId, { ...c, tcg_sets: set ? { id: set.id, name: set.name, release_date: set.release_date } : null })
    }
    pintarAlbum()
    pintarResumen()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// ── Quitar una copia desde el bolsillo (tanda 368) ──
//
// De qué línea se quita, que es lo único que tiene enjundia: de la MÁS
// NUEVA. Una misma carta puede estar en la colección varias veces —una
// española en NM y otra inglesa en played son dos líneas distintas— y el
// botón no pregunta cuál. La más nueva es la que acabas de meter, que es
// lo que quiere deshacer quien pulsa «−» justo después de pulsar «+».
// Para quitar una concreta está el editor de la pestaña «Mi colección»,
// que sí enseña las líneas una a una.
async function quitarDelBolsillo(cardId, variante = null) {
  // Sin versión, la más reciente de cualquiera; con versión, solo de esa
  // — si no, el «−» de la casilla del reverse holo te quitaría la normal.
  const suyas = lineas.filter((l) => l.card_id === cardId && (!variante || l.variante === variante))
  if (!suyas.length) return
  const l = suyas.reduce((a, b) => (String(a.created_at || '') >= String(b.created_at || '') ? a : b))
  try {
    if ((Number(l.cantidad) || 1) > 1) {
      const nueva = await datos.actualizar(l.id, { cantidad: Number(l.cantidad) - 1 })
      lineas[lineas.indexOf(l)] = nueva
    } else {
      await datos.borrar(l.id)
      lineas.splice(lineas.indexOf(l), 1)
    }
    pintarAlbum()
    pintarResumen()
    pintarCartas()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// Marcar o desmarcar UNA versión (tanda 383).
//
// Es un interruptor, no un contador: el `+`/`−` de al lado sigue siendo
// el que cuenta copias. Aquí la pregunta es «¿la tienes en reverse?», y
// esa se contesta sí o no.
//
// Al desmarcar se quita UNA copia y no la línea entera: si tenías tres
// reverse y te desprendes de una, lo que querías era eso y no borrarlas
// las tres de golpe. Cuando llega a cero, la línea desaparece sola.
async function alternarVariante(cardId, variante) {
  const suyas = lineas.filter((l) => l.card_id === cardId && (l.variante || 'normal') === variante)
  try {
    if (!suyas.length) {
      const nueva = await datos.anadir(sesion.user.id, {
        card_id: cardId,
        idioma: $('mcTocarIdioma').value,
        estado: $('mcTocarEstado').value,
        variante,
        cantidad: 1,
      })
      lineas.unshift(nueva)
      // La carta puede no estar en el mapa: el álbum se pinta con las
      // del set, no con las tuyas (mismo caso que `tocarBolsillo`).
      if (!cartas.has(cardId)) {
        const c = album.cartas.find((x) => x.id === cardId)
        const set = (todosLosSets || []).find((x) => x.id === album.set)
        if (c) cartas.set(cardId, { ...c, tcg_sets: set ? { id: set.id, name: set.name, release_date: set.release_date } : null })
      }
    } else {
      const l = suyas.reduce((a, b) => (String(a.created_at || '') >= String(b.created_at || '') ? a : b))
      if ((Number(l.cantidad) || 1) > 1) {
        lineas[lineas.indexOf(l)] = await datos.actualizar(l.id, { cantidad: Number(l.cantidad) - 1 })
      } else {
        await datos.borrar(l.id)
        lineas.splice(lineas.indexOf(l), 1)
      }
    }
    pintarAlbum()
    pintarResumen()
    pintarCartas()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// ── Pestaña «Añadir» ──
let seleccion = null
let turnoBusqueda = 0

// La consulta del buscador de cartas, suelta desde la 376 porque la
// usan DOS sitios: «Añadir cartas» y la lista de búsqueda de los
// cambios. Copiarla habría dejado dos buscadores que se separan sin
// que nadie se entere — la lección de `IDIOMA_POR_MERCADO`.
async function buscarCartas(texto, limite = 60) {
  let q = supabase.from('tcg_cards').select('id,set_id,local_id,name,name_es,image_path,rarity,tcg_sets(id,name,serie_id,release_date,tcg_online_code)').eq('market', 'WEST')
  for (const p of texto.split(/\s+/).filter(Boolean)) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  const { data, error } = await q.order('name_search').limit(limite)
  if (error) throw error
  return (data || []).filter((c) => esDelTCG({ id: c.set_id, serie_id: c.tcg_sets?.serie_id }))
}

async function buscar() {
  const texto = normalizeSearch($('mcAnadirBuscar').value)
  const mio = ++turnoBusqueda
  if (texto.length < 2) {
    $('mcAnadirResultados').innerHTML = ''
    return
  }
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
            <span class="mc-resultado-set">${escapeHtml(c.tcg_sets?.name || c.set_id)} · ${escapeHtml(c.local_id)}</span>
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
    <div><strong>${escapeHtml(nombreDe(c))}</strong><p class="subtext">${escapeHtml(c.tcg_sets?.name || '')} · ${escapeHtml(c.local_id)}</p><p class="subtext" id="mcAnadirPrecio">Buscando precio…</p></div>`
  $('mcAnadirForm').classList.remove('hidden')
  $('mcAnadirForm').scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  const v = await datos.preciosEnVivo(c.id)
  if (seleccion?.id !== c.id) return
  if (v) vivos.set(c.id, v)
  const p = datos.precioDeLinea({ card_id: c.id, variante: $('mcAnadirVariante').value }, guardados, vivos)
  $('mcAnadirPrecio').textContent = datos.tieneCifras(p)
    ? `Cardmarket: desde ${euros(p.desde)} · tendencia ${euros(p.tendencia)}${p.prestado ? ' (de la versión normal)' : ''}`
    : 'Sin precio de Cardmarket.'
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
    })
    const i = lineas.findIndex((l) => l.id === nueva.id)
    if (i >= 0) lineas[i] = nueva
    else lineas.unshift(nueva)
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
function cambiarPestania(nueva) {
  pestania = nueva
  $('mcMenu')?.classList.remove('abierto')
  $('mcMenuMas')?.setAttribute('aria-expanded', 'false')
  for (const b of document.querySelectorAll('[data-pestania]')) {
    const activa = b.dataset.pestania === nueva
    b.classList.toggle('activa', activa)
    b.setAttribute('aria-selected', String(activa))
  }
  for (const [id, nombre] of [['mcPanelCartas', 'cartas'], ['mcPanelAlbum', 'album'], ['mcPanelAlbumes', 'albumes'], ['mcPanelAnadir', 'anadir'], ['mcPanelResumen', 'resumen'], ['mcPanelCambios', 'cambios'], ['mcPanelCarpetas', 'carpetas'], ['mcPanelPokedex', 'pokedex']]) {
    $(id).classList.toggle('hidden', nombre !== nueva)
  }
  const url = new URL(location.href)
  if (nueva === 'cartas') url.searchParams.delete('ver')
  else url.searchParams.set('ver', nueva)
  if (nueva !== 'albumes') url.searchParams.delete('album')
  history.replaceState(null, '', url)
  // Los álbumes soñados (tanda 366) se cargan la primera vez que se abren.
  if (nueva === 'albumes' && !albumesAbiertos && esMia) {
    albumesAbiertos = true
    albumes.entrar(params.get('album'))
  }
  if (nueva === 'album' && !album.set) pintarEstanteria()
  if (nueva === 'resumen') pintarResumenPanel()
  if (nueva === 'cambios') abrirCambios()
  if (nueva === 'carpetas') abrirCarpetas()
  if (nueva === 'pokedex') abrirPokedex()
  if (nueva === 'anadir') $('mcAnadirBuscar').focus()
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
  if (carpetaAbierta) {
    const c = carpetasLista.find((x) => x.id === carpetaAbierta)
    if (!c) {
      carpetaAbierta = null
      return pintarCarpetas()
    }
    const hijas = carpetasLista.filter((x) => x.parent_id === c.id).map((x) => ({ ...x, hijas: [] }))
    migas.innerHTML = `<button type="button" class="link-btn" data-volver-carpetas>← Carpetas</button> <strong>${escapeHtml(c.nombre)}</strong>`
    caja.innerHTML = (hijas.length ? carpetas.rejillaHtml(hijas, carpetasResumen) : '') +
      '<div class="mc-cartas" id="mcCarpetaCartas"></div>'
    pintarCartasDeCarpeta(c.id)
    return
  }
  migas.textContent = ''
  caja.innerHTML = carpetas.rejillaHtml(carpetas.arbolDeCarpetas(carpetasLista), carpetasResumen)
}

async function pintarCartasDeCarpeta(id) {
  const hueco = $('mcCarpetaCartas')
  if (!hueco) return
  const ids = new Set(await carpetas.lineasDeCarpeta(id).catch(() => []))
  const dentro = lineas.filter((l) => ids.has(l.id))
  hueco.innerHTML = dentro.length
    ? dentro.map(lineaHtml).join('')
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
        datos.pokedexResumen().catch(() => []),
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
    soloMios: $('mcPdxSoloMios').checked,
    texto: $('mcPdxBuscar').value,
  })
  // La cabecera con las cuatro cifras (tanda 400), y debajo la rejilla.
  // Se pinta siempre, incluso filtrando: «llevas 701 de 1.025» no puede
  // cambiar porque estés buscando «char», igual que el progreso de un
  // set no cambia al filtrar por rareza.
  const resumen = pokedex.resumenDePokedex({ mio, totales: totalesPokedex })
  caja.innerHTML = pokedex.cabeceraHtml(resumen, { nombreDe: (d) => especiePorDex(d) || `#${d}` }) +
    pokedex.rejillaHtml(filas)
  // El contador de arriba cuenta especies DISTINTAS, no cartas: es una
  // Pokédex, y lo que se llena son huecos de Pokémon.
  $('mcPdxCuenta').textContent = `${resumen.registrados} de 1.025 Pokémon`
}

async function pintarEspecie(dex) {
  const caja = $('mcPokedexPanel')
  especieAbierta = dex
  $('mcPdxMandos').classList.add('hidden')
  caja.innerHTML = '<div class="skeleton" style="height:240px"></div>'
  let delCatalogo = []
  try {
    delCatalogo = await datos.cartasDeEspecie(dex)
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
  caja.innerHTML = pokedex.especieHtml({ dex, cartas: lista, tuyas, sinCatalogo: delCatalogo.length === 0 })
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
    const nuevas = await datos.cartasPorIds(faltan)
    for (const [id, c] of nuevas) cartas.set(id, c)
  }
  caja.innerHTML = `
    ${tablon.tablonHtml({ tiene, busca, cartas, deseos, doy })}
    <section class="mc-cambio-bloque">
      <h3>Lo que das</h3>
      ${doy.length
        ? `<ul class="mc-lista-cartas">${doy.map((l) => filaDeCartaHtml(cartas.get(l.card_id), `das <strong>${l.cambio}</strong> de ${l.cantidad}`)).join('')}</ul>
           <p class="subtext">Se cambia en cada carta, con «Editar» → «De esas, doy».</p>`
        : `<p class="subtext">Todavía no das ninguna. Abre una carta repetida en la pestaña «Cartas», dale a «Editar» y pon cuántas copias das.${repetidas().length ? ` Te sobran copias de ${repetidas().length} ${repetidas().length === 1 ? 'carta' : 'cartas'} — mira el <button type="button" class="link-btn" data-ir-resumen>resumen</button>.` : ''}</p>`}
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
            <span class="mc-resultado-set">${ya ? 'Ya la buscas' : `${escapeHtml(c.tcg_sets?.name || c.set_id)} · ${escapeHtml(c.local_id)}`}</span>
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
  if (pestania === 'cambios') abrirCambios()
  if (pestania === 'pokedex') abrirPokedex()
}

// Los iconos del menú y de la barra se ponen desde aquí y no en el HTML:
// el dibujo de cada uno vive en js/icons.js y copiarlo a mano en la página
// deja dos versiones del mismo icono que se separan.
function pintarIconos() {
  for (const el of document.querySelectorAll('[data-icono]')) {
    const dibujar = icons[el.dataset.icono]
    if (dibujar) el.insertAdjacentHTML('afterbegin', dibujar(18))
  }
}

function enganchar() {
  pintarIconos()
  for (const b of document.querySelectorAll('[data-pestania]')) b.addEventListener('click', () => cambiarPestania(b.dataset.pestania))
  // La barra flota pegada al fondo en el móvil (tanda 406), así que al
  // llegar al pie taparía justo los enlaces del pie. Se aparta sola
  // cuando el pie entra en pantalla — con un observador y no con un
  // oyente de `scroll`, que correría en cada píxel. En el ordenador la
  // clase no pinta nada: su regla vive en el `@media` del móvil.
  const pie = document.querySelector('footer')
  if (pie && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e]) => $('mcMenu').classList.toggle('apartada', e.isIntersecting),
    ).observe(pie)
  }

  // El «Más» del móvil: despliega las pestañas que no caben en los cinco
  // sitios de la barra. En el ordenador está escondido por CSS.
  $('mcMenuMas').addEventListener('click', () => {
    const abierto = $('mcMenu').classList.toggle('abierto')
    $('mcMenuMas').setAttribute('aria-expanded', abierto ? 'true' : 'false')
  })
  for (const id of ['mcBuscar', 'mcFiltroSet', 'mcFiltroIdioma', 'mcOrden']) {
    $(id).addEventListener(id === 'mcBuscar' ? 'input' : 'change', () => {
      pintarCartas()
      pintarCuentaDeFiltros()
    })
  }

  // ── La nota, plegada (tanda 405) ──
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

  // ── Las carpetas (tanda 402) ──
  $('mcCarpetaNueva').addEventListener('click', async () => {
    const nombre = window.prompt('¿Cómo se llama la carpeta?')
    if (!nombre || !nombre.trim()) return
    try {
      // Si estás DENTRO de una, la nueva nace dentro: es lo que esperas
      // al pulsar «nueva» estando en «Vintage».
      await carpetas.crearCarpeta(sesion.user.id, { nombre, parent_id: carpetaAbierta })
      await recargarCarpetas()
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
  $('mcCarpetasPanel').addEventListener('click', async (e) => {
    const abrir = e.target.closest('[data-abrir]')
    if (abrir) {
      carpetaAbierta = abrir.dataset.abrir
      return pintarCarpetas()
    }
    const editar = e.target.closest('[data-editar-carpeta]')
    if (!editar) return
    const c = carpetasLista.find((x) => x.id === editar.dataset.editarCarpeta)
    if (!c) return
    const nombre = window.prompt('Nombre de la carpeta (vacío para borrarla):', c.nombre)
    if (nombre === null) return
    try {
      if (!nombre.trim()) {
        // Borrar se lleva las SUBcarpetas, así que se avisa de eso y no
        // de «se borrará la carpeta» a secas. Las cartas no se tocan:
        // viven en tu colección, no en la carpeta.
        const hijas = carpetasLista.filter((x) => x.parent_id === c.id).length
        const aviso = hijas
          ? `¿Borrar «${c.nombre}» y sus ${hijas} subcarpetas? Las cartas se quedan en tu colección.`
          : `¿Borrar «${c.nombre}»? Las cartas se quedan en tu colección.`
        if (!window.confirm(aviso)) return
        await carpetas.borrarCarpeta(c.id)
        if (carpetaAbierta === c.id) carpetaAbierta = c.parent_id || null
      } else {
        await carpetas.renombrarCarpeta(c.id, { nombre: nombre.trim().slice(0, 60) })
      }
      await recargarCarpetas()
    } catch (err) {
      showToast(err.message, 'error')
    }
  })
  $('mcCarpetaMigas').addEventListener('click', (e) => {
    if (!e.target.closest('[data-volver-carpetas]')) return
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
  $('mcOrdenAlReves').addEventListener('click', () => {
    ordenAlReves = !ordenAlReves
    $('mcOrdenAlReves').classList.toggle('activo', ordenAlReves)
    $('mcOrdenAlReves').setAttribute('aria-pressed', ordenAlReves ? 'true' : 'false')
    pintarCartas()
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
    if (l) abrirEditor(l)
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
      const campo = $('mcEdCantidad')
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
  for (const id of ['mcEdIdioma', 'mcEdEstado', 'mcEdVariante']) {
    $(id).addEventListener('change', () => guardarEditor())
  }
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
  $('mcEstanteriaRejilla').addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]')
    if (b) abrirAlbum(b.dataset.set)
  })
  respaldarNombresDeSet($('mcEstanteriaRejilla'))
  $('mcAlbumVolver').addEventListener('click', volverALaEstanteria)

  // ── La Pokédex (tanda 381) ──
  //
  // Los dos mandos y la delegación del clic van AQUÍ y no dentro de la
  // pestaña: el panel se repinta entero en cada filtro, así que un
  // oyente puesto dentro se duplicaría en cada tecla. La caja de fuera
  // no se repinta nunca.
  for (const id of ['mcPdxBuscar', 'mcPdxSoloMios']) {
    $(id).addEventListener(id === 'mcPdxBuscar' ? 'input' : 'change', () => {
      // Al filtrar se vuelve a la rejilla: filtrar con una especie
      // abierta no significa nada.
      especieAbierta = null
      if (pokedexCargada) pintarPokedex()
    })
  }
  $('mcPanelPokedex').addEventListener('click', (e) => {
    const especie = e.target.closest('[data-dex]')
    if (especie) return pintarEspecie(Number(especie.dataset.dex))
    if (e.target.closest('#pdxVolver')) {
      especieAbierta = null
      // Y fuera de la dirección: si se queda, recargar vuelve a abrir la
      // especie que acabas de cerrar.
      const url = new URL(location.href)
      url.searchParams.delete('dex')
      history.replaceState(null, '', url)
      pintarPokedex()
    }
  })
  for (const id of ['mcAlbumRareza', 'mcAlbumTipo']) {
    $(id).addEventListener('change', () => {
      // Al filtrar se vuelve a la primera página: seguir en la 7 de una
      // lista que ahora tiene 2 deja el archivador en blanco.
      album.pagina = 0
      pintarAlbum()
    })
  }
  $('mcAlbumSoloFaltan').addEventListener('change', (e) => {
    album.soloFaltan = e.target.checked
    album.pagina = 0
    pintarAlbum()
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
  $('mcAlbumSalto').addEventListener('change', (e) => {
    album.pagina = Number(e.target.value) || 0
    pintarAlbum()
  })
  $('mcAlbumAnterior').addEventListener('click', () => {
    album.pagina = Math.max(0, album.pagina - Number($('mcAlbumAnterior').dataset.paso || 1))
    pintarAlbum()
  })
  $('mcAlbumSiguiente').addEventListener('click', () => {
    album.pagina += Number($('mcAlbumAnterior').dataset.paso || 1)
    pintarAlbum()
  })
  // El mando del bolsillo (tanda 368). Va delegado en el archivador y no
  // botón a botón: el álbum se repinta entero en cada cambio, así que un
  // oyente por bolsillo habría que volver a colgarlo cada vez.
  $('mcAlbum').addEventListener('click', (e) => {
    const mas = e.target.closest('button[data-anadir]')
    if (mas) return void tocarBolsillo(mas.dataset.anadir, mas.dataset.var || 'normal')
    const menos = e.target.closest('button[data-quitar]')
    if (menos) return void quitarDelBolsillo(menos.dataset.quitar, menos.dataset.var || null)
    const version = e.target.closest('button[data-variante]')
    if (version) return void alternarVariante(version.dataset.carta, version.dataset.variante)
  })
  // Stack / Split. Se recuerda, porque quien colecciona set maestro lo
  // quiere SIEMPRE y volver a pulsarlo en cada set sería un peaje.
  for (const [id, split] of [['mcVistaStack', false], ['mcVistaSplit', true]]) {
    $(id).addEventListener('click', () => {
      album.split = split
      album.pagina = 0
      try { localStorage.setItem('mc-split', split ? '1' : '0') } catch {}
      pintarVistaVariantes()
      pintarAlbum()
    })
  }
  try { album.split = localStorage.getItem('mc-split') === '1' } catch {}
  pintarVistaVariantes()

  let espera = null
  $('mcAnadirBuscar').addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(buscar, 250)
  })
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
  $('mcFiltroIdioma').innerHTML = '<option value="">Todos los idiomas</option>' + opciones(IDIOMAS, '')
  $('mcAnadirIdioma').innerHTML = opciones(IDIOMAS, IDIOMA_POR_DEFECTO)
  $('mcAnadirEstado').innerHTML = opciones(ESTADOS, ESTADO_POR_DEFECTO)
  $('mcAnadirVariante').innerHTML = opciones(VARIANTES, 'normal')
  $('mcTocarIdioma').innerHTML = opciones(IDIOMAS, IDIOMA_POR_DEFECTO)
  $('mcTocarEstado').innerHTML = opciones(ESTADOS, ESTADO_POR_DEFECTO)
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
  porNumero,
}

// /mi-coleccion?album=<id> de OTRA persona: solo ese álbum, para verlo.
async function verAlbumAjeno(fila) {
  $('mcTitulo').textContent = 'Álbum soñado'
  document.title = `${fila.nombre} — Álbum soñado — PokeDoc`
  for (const id of ['mcResumen', 'mcResumenNota', 'mcCargando', 'mcCompartir']) $(id)?.classList.add('hidden')
  document.querySelector('.mc-pestanias').classList.add('hidden')
  cambiarPestania('albumes')
  await albumes.abrir(fila.id, { soloVer: true })
}

async function iniciar() {
  prepararOpcionesDeFormulario()
  enganchar()
  albumes.iniciarAlbumes(contexto)
  sesion = await getSession().catch(() => null)
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
      pestania = 'albumes'
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
      // sin rango: el nombre del dueño de la colección va en el título de la
      // pantalla («La colección de Ash»), como texto (tanda 386).
      const { data } = await supabase.from('user_profiles').select('id,username,display_name,coleccion_publica').eq('id', sesion.user.id).maybeSingle()
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
    document.querySelector('[data-pestania="anadir"]').classList.add('hidden')
    document.querySelector('[data-pestania="albumes"]').classList.add('hidden')
    // Los cambios son de QUIEN MIRA, no de la colección que se mira:
    // «quién encaja conmigo» no significa nada en la página de otra
    // persona, y las dos RPC van contra `auth.uid()` de todas formas.
    document.querySelector('[data-pestania="cambios"]').classList.add('hidden')
    // Mirando la colección de otro no hay nada que añadir: los bolsillos
    // salen sin mando (bolsilloHtml) y esta línea sobraría en pantalla.
    $('mcTocarOpciones').classList.add('hidden')
    if (['anadir', 'albumes', 'cambios'].includes(pestania)) pestania = 'cartas'
  }
  pintarCompartir()
  cambiarPestania(pestania)

  try {
    lineas = await datos.lineasDe(dueno.id)
    const ids = lineas.map((l) => l.card_id)
    ;[cartas, guardados] = await Promise.all([datos.cartasPorIds(ids), datos.preciosGuardados(ids)])
  } catch (err) {
    aviso(`<p>${escapeHtml(err.message)}</p>`)
    return
  }
  $('mcCargando').classList.add('hidden')
  repintar()
  if (pestania === 'album') pintarEstanteria()
  // Si se entró directo a un álbum, se repinta ahora que se sabe qué
  // cartas tienes.
  if (pestania === 'albumes' && params.get('album')) albumes.abrir(params.get('album'))
  // Los precios que falten llegan después y repintan: la lista no espera.
  await completarPrecios()
  repintar()
  window.addEventListener('resize', () => album.set && pintarAlbum())
}

iniciar()
