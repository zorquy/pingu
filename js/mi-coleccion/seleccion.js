// MARCAR VARIAS DE GOLPE, aparte (tanda 1011). Solo quien mira SU colección
// puede marcar, y el catálogo público (/cartas, la misma pantalla) se bajaba
// esto entero. Entra por import() cuando hay sesión y la colección es la
// tuya (en un rato libre, o al pulsar «Seleccionar» si llega antes); lo que
// la rejilla pregunta mientras pinta (`marcadasAhora`) contesta null hasta
// entonces, que es «apagado». El estado de la pantalla llega en `ctx`
// (getters: cambia mientras se usa), como en el Panel de la 895.
import { escapeHtml } from '../app.js'
import { showToast } from '../toast.js'
import * as datos from './datos.js'
import * as albumes from './albumes.js'

const $ = (id) => document.getElementById(id)

// Lo compartido con mi-coleccion.js llega aquí (ver `ctxSeleccion` allí).
let ctx = null
export function montar(c) {
  ctx = c
  enganchar()
}

// Lo que la rejilla y el clic de main leen sin esperar al módulo.
export const marcadasAhora = () => marcadas
export const marcarEnAhora = () => marcarEn

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
let marcadas = null // Set de `cardId|variante` (expansión) o de ids de línea (Cartas); null = apagado
// DÓNDE se selecciona (747). En una expansión se marca cada CARTA (y su
// versión); en «Cartas» se marca cada COPIA tuya, que es una línea: dos
// copias de la misma carta en dos idiomas son dos casillas distintas.
let marcarEn = 'album'

// LA POKÉDEX Y BUSCAR (1054, PINGU: «un selector para elegir varias cartas…
// que sea consistente en todos los sitios donde salgan cartas»). Se marca
// como en una expansión —la carta y su versión, `id|versión`—, pero sus
// rejillas no saben de marcas: se marcan aquí, sobre los enlaces
// `a[data-carta]` que pintan, y se vuelven a poner si la rejilla se repinta
// (filtrar, apilar) mientras se selecciona.
const ZONAS = { pokedex: 'mcPokedexPanel', buscar: 'mcBuscarResultados' }
const DONDE_DE_PESTANA = { cartas: 'cartas', pokedex: 'pokedex', buscar: 'buscar' }
const claveDeEnlace = (a) => `${a.dataset.carta}|${a.dataset.version || a.dataset.variante || ctx.varianteDe(a.dataset.carta)}`
let vigia = null
function pintarMarcasDeZona() {
  const zona = $(ZONAS[marcarEn])
  if (!zona) return
  for (const a of zona.querySelectorAll('a[data-carta]')) {
    const puesta = Boolean(marcadas?.has(claveDeEnlace(a)))
    if (a.classList.contains('marcada') !== puesta) a.classList.toggle('marcada', puesta)
    if (marcadas) { if (a.getAttribute('aria-pressed') !== String(puesta)) a.setAttribute('aria-pressed', String(puesta)) } else if (a.hasAttribute('aria-pressed')) a.removeAttribute('aria-pressed')
  }
}

export function modoMarcar(encender, donde = DONDE_DE_PESTANA[ctx.pestania] || 'album', { repintar = true } = {}) {
  const antes = marcarEn
  marcadas = encender ? new Set() : null
  if (encender) marcarEn = donde
  // Un «Seleccionar» por barra (1053 en la expansión, 1054 en las demás):
  // todos dicen lo mismo.
  for (const b of document.querySelectorAll('[data-seleccionar]')) b.setAttribute('aria-pressed', encender ? 'true' : 'false')
  $('mcMarcarBarra')?.classList.toggle('hidden', !encender)
  document.documentElement.classList.toggle('mc-seleccionando', Boolean(encender))
  $('mcAlbum')?.classList.toggle('mc-album-marcando', Boolean(encender) && marcarEn === 'album')
  $('mcCartas')?.classList.toggle('mc-cartas-marcando', Boolean(encender) && marcarEn === 'cartas')
  for (const [d, id] of Object.entries(ZONAS)) $(id)?.classList.toggle('mc-cat-marcando', Boolean(encender) && marcarEn === d)
  pintarMarcadas()
  // En la Pokédex y Buscar no se repinta la rejilla: se marcan sus enlaces,
  // y un vigía los vuelve a marcar si ella se repinta sola.
  vigia?.disconnect()
  vigia = null
  const zona = (encender ? marcarEn : antes) in ZONAS ? (encender ? marcarEn : antes) : null
  if (zona) {
    const previo = marcarEn
    marcarEn = zona
    pintarMarcasDeZona()
    marcarEn = previo
    if (encender && $(ZONAS[zona])) {
      vigia = new MutationObserver(() => pintarMarcasDeZona())
      vigia.observe($(ZONAS[zona]), { childList: true, subtree: true })
    }
    return
  }
  if (!repintar) return
  if ((encender ? marcarEn : antes) === 'cartas') ctx.pintarCartas()
  else ctx.pintarAlbum()
}

// Lo marcado, como una lista de {cardId, variante, linea} sea cual sea la
// rejilla: las acciones no tienen que saber de dónde viene.
function entradasMarcadas() {
  if (!marcadas) return []
  if (marcarEn === 'cartas') {
    return [...marcadas].map((id) => ctx.lineas.find((l) => l.id === id)).filter(Boolean)
      .map((l) => ({ cardId: l.card_id, variante: l.variante || 'normal', linea: l }))
  }
  return [...marcadas].map((k) => {
    const corte = k.lastIndexOf('|')
    return { cardId: k.slice(0, corte), variante: k.slice(corte + 1), linea: null }
  })
}

function pintarMarcadas() {
  const cuantas = marcadas ? marcadas.size : 0
  const cuenta = $('mcMarcarCuenta')
  if (cuenta) {
    cuenta.textContent = cuantas
      ? `${cuantas} ${cuantas === 1 ? 'seleccionada' : 'seleccionadas'}`
      : 'Toca las cartas'
  }
  const guardar = $('mcMarcarGuardar')
  if (guardar) {
    guardar.disabled = !cuantas
    // El botón dice CUÁNTAS va a añadir: «Añadir» a secas, con doce
    // marcadas, no deja claro si añade una o las doce.
    // En una tienda (1076) lo marcado va a su stock, y lo dice.
    $('mcMarcarGuardarTexto').textContent = ctx.modoTienda ? (cuantas ? `${cuantas} al stock` : 'Al stock') : cuantas ? `Añadir ${cuantas}` : 'Añadir'
  }
  // 713: lo demás que se hace con varias. «Quitar» cuenta solo las tuyas.
  for (const id of ['mcMarcarAlbum', 'mcMarcarQuiero', 'mcMarcarCambio']) if ($(id)) $(id).disabled = !cuantas
  confirmarQuitar = false
  const tuyas = lineasDeLasMarcadas().length
  const quitar = $('mcMarcarQuitar')
  if (quitar) {
    quitar.disabled = !tuyas
    $('mcMarcarQuitarTexto').textContent = tuyas ? `Quitar ${tuyas}` : 'Quitar'
    quitar.classList.remove('confirmando')
  }
}

// «Seleccionar todas»: las que están A LA VISTA en la rejilla, con los
// filtros puestos —seleccionar las 400 de la colección con un filtro de
// «Fuego» delante no es lo que nadie espera—.
function marcarTodas() {
  if (!marcadas) return
  if (marcarEn === 'cartas') {
    for (const t of $('mcCartas').querySelectorAll('.mc-carta[data-linea]')) { marcadas.add(t.dataset.linea); t.classList.add('marcada'); t.querySelector('[data-ficha]')?.setAttribute('aria-pressed', 'true') }
  } else if (marcarEn in ZONAS) {
    for (const a of $(ZONAS[marcarEn])?.querySelectorAll('a[data-carta]') || []) marcadas.add(claveDeEnlace(a))
    pintarMarcasDeZona()
  } else {
    for (const a of $('mcAlbum').querySelectorAll('.mc-bolsillo-enlace[data-marca]')) { marcadas.add(a.dataset.marca); a.setAttribute('aria-pressed', 'true'); a.closest('.mc-bolsillo')?.classList.add('marcada') }
  }
  pintarMarcadas()
}

// Marcar o desmarcar una copia de la rejilla de Cartas. Sin repintar: con
// cientos de casillas, repintar a cada toque se nota.
export function alternarLinea(tarjeta) {
  if (!marcadas || marcarEn !== 'cartas') return
  const id = tarjeta.dataset.linea
  if (marcadas.has(id)) marcadas.delete(id)
  else marcadas.add(id)
  const puesta = marcadas.has(id)
  tarjeta.classList.toggle('marcada', puesta)
  tarjeta.querySelector('[data-ficha]')?.setAttribute('aria-pressed', puesta ? 'true' : 'false')
  pintarMarcadas()
}

// ── Lo demás que se hace con varias (713, C4) ──
//
// PINGU eligió la selección múltiple de la lista de propuestas: con varias
// marcadas, además de añadirlas, mandarlas a un álbum, apuntarlas como «la
// quiero» o quitarlas. Lo que se quita es UNA copia de cada una que
// tengas (de la línea de esa versión con más copias): quitar una carta
// entera con todos sus idiomas desde una rejilla sería demasiado para un
// toque, y para eso está su ficha.
const idsDeLasMarcadas = () => [...new Set(entradasMarcadas().map((e) => e.cardId))]
function lineasDeLasMarcadas() {
  const out = []
  for (const e of entradasMarcadas()) {
    // En «Cartas» lo marcado YA es una línea; en una expansión, la tuya de
    // esa versión con más copias.
    if (e.linea) { out.push(e.linea); continue }
    const suyas = ctx.misLineasDe(e.cardId).filter((l) => (l.variante || 'normal') === e.variante)
    if (suyas.length) out.push(suyas.sort((a, b) => (b.cantidad || 0) - (a.cantidad || 0))[0])
  }
  return out
}

let confirmarQuitar = false
let quitarTiempo = null
async function quitarMarcadas() {
  const ls = lineasDeLasMarcadas()
  if (!ls.length) return
  const b = $('mcMarcarQuitar')
  // Un segundo toque confirma: quitar es lo único de la barra que borra.
  if (!confirmarQuitar) {
    confirmarQuitar = true
    b.classList.add('confirmando')
    $('mcMarcarQuitarTexto').textContent = `¿Quitar ${ls.length}? Toca otra vez`
    clearTimeout(quitarTiempo)
    quitarTiempo = setTimeout(() => pintarMarcadas(), 4000)
    return
  }
  clearTimeout(quitarTiempo)
  b.disabled = true
  let hechas = 0
  try {
    for (const l of ls) {
      if ((Number(l.cantidad) || 1) > 1) ctx.cambiarLinea(l.id, await datos.actualizar(l.id, { cantidad: Number(l.cantidad) - 1 }))
      else { await datos.borrar(l.id); ctx.quitarLinea(l.id) }
      hechas++
    }
    showToast(`${hechas} ${hechas === 1 ? 'copia quitada' : 'copias quitadas'} de tu colección.`, 'success')
  } catch (err) {
    showToast(`${hechas ? `Quitadas ${hechas}; ` : ''}${err.message}`, 'error')
  }
  modoMarcar(false)
  ctx.repintar()
}

async function quererMarcadas() {
  const ids = idsDeLasMarcadas()
  if (!ids.length) return
  const b = $('mcMarcarQuiero')
  b.disabled = true
  try {
    // Pregunta el idioma una vez para todas (1064).
    const nuevas = await ctx.quererVarias(ids)
    if (nuevas === null) return
    showToast(nuevas ? `${nuevas} ${nuevas === 1 ? 'carta apuntada' : 'cartas apuntadas'} en «La quiero».` : 'Ya estaban todas en «La quiero».', 'success')
    modoMarcar(false)
  } catch (err) {
    showToast(err.message, 'error')
  } finally {
    b.disabled = false
  }
}

async function elegirAlbumParaMarcadas() {
  const d = $('mcElegirAlbum')
  const lista = $('mcEaLista')
  lista.innerHTML = '<p class="subtext">Cargando tus álbumes…</p>'
  if (!d.open) d.showModal()
  try {
    const todos = await albumes.albumesParaElegir(ctx.sesion.user.id)
    lista.innerHTML = todos.length
      ? todos.map((a) => `<button type="button" class="mc-ea-album" data-album="${escapeHtml(a.id)}"><b>${escapeHtml(a.nombre || 'Sin nombre')}</b><span>${(a.cartas || []).length} cartas</span></button>`).join('')
      : `<p class="subtext">Todavía no tienes ningún álbum.</p><a class="btn-secondary" href="?ver=carpetas">Crear uno en Álbumes</a>`
  } catch (err) {
    lista.innerHTML = `<p class="subtext">${escapeHtml(err.message)}</p>`
  }
}

async function meterMarcadasEnAlbum(albumId) {
  const ids = idsDeLasMarcadas()
  // CAMBIA YA (896, R6): el diálogo se cierra y se sale del modo marcar en
  // el acto; el resultado llega después como aviso.
  $('mcElegirAlbum').close()
  modoMarcar(false)
  try {
    const r = await albumes.meterCartas(albumId, ids)
    const partes = [`${r.anadidas} ${r.anadidas === 1 ? 'carta' : 'cartas'} a «${r.nombre}»`]
    if (r.yaEstaban) partes.push(`${r.yaEstaban} ya estaban`)
    if (r.sinSitio) partes.push(`${r.sinSitio} no caben`)
    showToast(partes.join(' · ') + '.', r.sinSitio ? 'error' : 'success')
    albumes.repintar?.()
  } catch (err) {
    showToast(err.message, 'error')
  }
}

// Marcar o desmarcar una casilla. No toca la base: lo que se marca vive
// en memoria hasta que se pulsa «Añadir», que es lo que permite
// corregirse sin haber escrito nada.
export function alternarMarca(enlace) {
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

function meterPuestas(puestas) {
  const elSet = (ctx.todosLosSets || []).find((x) => x.id === ctx.album.set)
  for (const l of puestas) {
    const c = (ctx.album.cartas || []).find((x) => x.id === l.card_id)
    // Desde la Pokédex o Buscar (1054) la carta no es de la expansión
    // abierta: se busca donde esté, que sin ella el Panel la pinta sin
    // nombre (la 487).
    ctx.meterLinea(l, c ? { ...c, tcg_sets: elSet ? { id: elSet.id, name: elSet.name, release_date: elSet.release_date } : null } : ctx.cartas.get(l.card_id) || ctx.cartaPorId(l.card_id) || null)
  }
}

// «Para cambio» con varias (1097): las tuyas pasan a darse (cuántas lo dice
// la hoja de `cambio-varias.js`) y las que no tienes se añaden ya dándose.
async function cambiarMarcadas() {
  const entradas = entradasMarcadas()
  if (!entradas.length) return
  const tuyas = []
  const nuevas = []
  for (const e of entradas) {
    const ls = e.linea ? [e.linea] : ctx.misLineasDe(e.cardId).filter((l) => (l.variante || 'normal') === e.variante)
    if (ls.length) tuyas.push(ls)
    else nuevas.push(e)
  }
  const { preguntarCambio, cambioDeLineas } = await import('./cambio-varias.js')
  const idiomas = [...($('mcTocarIdioma')?.options || [])].map((o) => o.value)
  const r = await preguntarCambio({ tuyas: tuyas.length, nuevas: nuevas.length, idiomas, idioma: $('mcTocarIdioma')?.value || 'es', estado: $('mcTocarEstado')?.value || 'NM' })
  if (!r) return
  const b = $('mcMarcarCambio')
  b.disabled = true
  let dadas = 0
  let anadidas = 0
  try {
    for (const ls of tuyas) {
      const cambios = cambioDeLineas(ls, r.cuantas)
      for (const c of cambios) ctx.cambiarLinea(c.id, await datos.actualizar(c.id, { cambio: c.cambio }))
      if (cambios.length) dadas++
    }
    if (nuevas.length) {
      const puestas = await datos.anadirVarias(ctx.sesion.user.id, nuevas.map((e) => ({ card_id: e.cardId, variante: e.variante, idioma: r.idioma, estado: r.estado, cambio: 1 })), ctx.mercado)
      // Una que ya estaba en la base (entró desde otro sitio) sube una copia
      // y no trae el cambio: se le pone aquí.
      for (const [i, l] of puestas.entries()) {
        if ((Number(l.cambio) || 0) < 1) puestas[i] = await datos.actualizar(l.id, { cambio: 1 })
      }
      meterPuestas(puestas)
      anadidas = puestas.length
    }
    modoMarcar(false)
    ctx.pintarResumen()
    ctx.repintar()
    const partes = []
    if (dadas) partes.push(`${dadas} ${dadas === 1 ? 'carta' : 'cartas'} para cambio`)
    if (anadidas) partes.push(`${anadidas} ${anadidas === 1 ? 'añadida' : 'añadidas'} y para cambio`)
    showToast(partes.length ? `${partes.join(' · ')}.` : 'Ya estaban todas para cambio.', 'success')
  } catch (err) {
    showToast(`${dadas || anadidas ? 'Se ha quedado a medias: ' : ''}${err.message || 'No se ha podido poner para cambio.'}`, 'error')
    ctx.repintar()
  } finally {
    b.disabled = false
  }
}

async function guardarMarcadas() {
  if (!marcadas?.size) return
  const boton = $('mcMarcarGuardar')
  const idioma = $('mcTocarIdioma')?.value || 'es'
  const estado = $('mcTocarEstado')?.value || 'NM'
  // Desde «Cartas», una copia MÁS de cada una, con su idioma y su estado:
  // es «otra igual que esta», no una carta nueva.
  const lineasNuevas = entradasMarcadas().map((e) => ({
    card_id: e.cardId, variante: e.variante, idioma: e.linea?.idioma || idioma, estado: e.linea?.estado || estado,
  }))
  boton.disabled = true
  try {
    const puestas = await datos.anadirVarias(ctx.sesion.user.id, lineasNuevas, ctx.mercado)
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
    meterPuestas(puestas)
    const cuantas = puestas.length
    modoMarcar(false)
    ctx.pintarResumen()
    ctx.pintarCartas()
    const tachados = new Set(datos.deseosTachadosPor(puestas).map((f) => f.card_id)).size
    showToast(`${cuantas} ${cuantas === 1 ? 'carta añadida' : 'cartas añadidas'} a tu colección${tachados ? ` · ${tachados === 1 ? 'una sale' : `${tachados} salen`} de «La quiero»` : ''}.`, 'success')
  } catch (err) {
    showToast(err.message || 'No se han podido añadir.', 'error')
    boton.disabled = false
  }
}

// `tocarBolsillo` (el «+» con el idioma y el estado del álbum) se fue en
// la 650: añadir pasa siempre por el diálogo, que pregunta el idioma.

function enganchar() {
  // Tocar una carta de la Pokédex o de Buscar mientras se selecciona (1054):
  // la marca. En CAPTURA en el documento, antes que el que abre la ficha y
  // que el «+» (que en este modo además se esconde).
  document.addEventListener('click', (e) => {
    if (!marcadas || !(marcarEn in ZONAS)) return
    const zona = $(ZONAS[marcarEn])
    const a = e.target.closest?.('a[data-carta]')
    if (!zona || !a || !zona.contains(a)) return
    e.preventDefault()
    e.stopImmediatePropagation()
    const clave = claveDeEnlace(a)
    if (marcadas.has(clave)) marcadas.delete(clave)
    else marcadas.add(clave)
    pintarMarcasDeZona()
    pintarMarcadas()
  }, true)
  // ── Marcar varias (tanda 426) ──
  $('mcMarcarCancelar')?.addEventListener('click', () => modoMarcar(false))
  $('mcMarcarTodas')?.addEventListener('click', () => marcarTodas())
  $('mcMarcarGuardar')?.addEventListener('click', () => void guardarMarcadas())
  $('mcMarcarQuitar')?.addEventListener('click', () => void quitarMarcadas())
  $('mcMarcarQuiero')?.addEventListener('click', () => void quererMarcadas())
  $('mcMarcarCambio')?.addEventListener('click', () => void cambiarMarcadas())
  $('mcMarcarAlbum')?.addEventListener('click', () => void elegirAlbumParaMarcadas())
  $('mcEaCerrar')?.addEventListener('click', () => $('mcElegirAlbum').close())
  $('mcEaLista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-album]')
    if (b) void meterMarcadasEnAlbum(b.dataset.album)
  })
  // MANTENER PULSADA UNA CARTA LA MARCA (713). Es el gesto de cualquier
  // galería de fotos: medio segundo quieto encima enciende el modo y deja
  // esa carta marcada. Moverse más de 10 px es desplazarse, no pulsar; y el
  // clic que llega al soltar se come, o abriría la ficha encima.
  //
  // Durante la pulsación NO se repinta nada: solo se marca la casilla a la
  // vista. Con el dedo el navegador manda el «soltar» al elemento donde
  // EMPEZÓ, y si la rejilla se repinta a mitad ese elemento ya no está en
  // la página: el soltar no llega a nadie y el gesto se queda a medias. El
  // modo de verdad se enciende al soltar.
  //
  // Y EN LAS DOS REJILLAS (747). Hasta aquí solo estaba en la de una
  // expansión, y PINGU lo probaba —con razón— en «Cartas». En la de Cartas
  // no se repinta nada al marcar (solo clases), así que el modo se enciende
  // en cuanto se cumple el medio segundo, que es lo que hace la galería
  // del iPhone; en la expansión sigue esperando al soltar, por lo de arriba.
  // Lo que en el iPhone se comía el gesto —la vista previa del sistema al
  // mantener un enlace o una imagen— lo quita la hoja (`-webkit-touch-
  // callout`), y el menú contextual, el `contextmenu` de abajo.
  {
    let reloj = null, origen = null, pendiente = null, comer = false, yaEncendido = false
    const parar = () => { clearTimeout(reloj); reloj = null }
    const aplicar = () => {
      const p = pendiente
      pendiente = null
      if (!p) return
      const zona = $('mcAlbum')
      if (!marcadas) modoMarcar(true, 'album')
      const nuevo = zona.querySelector(`.mc-bolsillo-enlace[data-marca="${CSS.escape(ctx.claveMarca(p.carta, p.variante))}"]`) || zona.querySelector(`.mc-bolsillo-enlace[data-carta="${CSS.escape(p.carta)}"][data-marca]`)
      if (nuevo && !marcadas.has(nuevo.dataset.marca)) alternarMarca(nuevo)
    }
    const zonas = [
      { zona: $('mcAlbum'), casilla: '.mc-bolsillo-enlace[data-carta]', yaMarcando: () => marcadas && marcarEn === 'album',
        alCumplir: (el) => {
          pendiente = { carta: el.dataset.carta, variante: el.dataset.variante || 'normal' }
          el.closest('.mc-bolsillo')?.classList.add('marcada')
        } },
      { zona: $('mcCartas'), casilla: '.mc-carta[data-linea]', yaMarcando: () => marcadas && marcarEn === 'cartas',
        alCumplir: (el) => {
          if (!marcadas) modoMarcar(true, 'cartas', { repintar: false })
          if (!marcadas.has(el.dataset.linea)) alternarLinea(el)
          yaEncendido = true
        } },
    ]
    for (const { zona, casilla, yaMarcando, alCumplir } of zonas) {
      zona?.addEventListener('pointerdown', (e) => {
        const el = e.target.closest(casilla)
        if (!el || !ctx.esMia || !ctx.sesion || e.button !== 0) return
        // Con el modo ya puesto, un toque marca: no hace falta mantener.
        if (yaMarcando()) return
        origen = { x: e.clientX, y: e.clientY }
        parar()
        reloj = setTimeout(() => {
          reloj = null
          alCumplir(el)
          navigator.vibrate?.(10)
        }, 450)
      })
      zona?.addEventListener('pointermove', (e) => {
        if (reloj && origen && Math.hypot(e.clientX - origen.x, e.clientY - origen.y) > 10) parar()
      })
      zona?.addEventListener('pointerup', () => {
        parar()
        if (!pendiente && !yaEncendido) return
        // El clic de este mismo soltar se come; si no llega, a los 250 ms se
        // deja de esperar para no comerse el siguiente toque de verdad.
        // Y el modo se enciende DESPUÉS de ese clic: encenderlo saca la barra
        // de marcar, que empuja la rejilla, y el clic caía en su «Cancelar».
        comer = true
        yaEncendido = false
        setTimeout(() => { comer = false }, 250)
        if (pendiente) setTimeout(aplicar, 60)
      })
      zona?.addEventListener('pointercancel', () => { parar(); yaEncendido = false; if (pendiente) setTimeout(aplicar, 0) })
      zona?.addEventListener('pointerleave', parar)
      zona?.addEventListener('contextmenu', (e) => { if (e.target.closest(casilla)) e.preventDefault() })
    }
    // En el DOCUMENTO y no en la zona: si el clic acaba en otro sitio (la
    // barra que acaba de salir), también se lo come.
    document.addEventListener('click', (e) => {
      if (!comer) return
      comer = false
      e.preventDefault()
      e.stopImmediatePropagation()
    }, true)
  }
  // Con el teclado: un enlace ya responde a Intro, pero `role="button"`
  // promete también la BARRA ESPACIADORA, y un enlace no la tiene.
  $('mcAlbum')?.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Spacebar') return
    const enlace = e.target.closest('.mc-bolsillo-enlace[data-marca]')
    if (!marcadas || !enlace) return
    e.preventDefault()
    alternarMarca(enlace)
  })
}
