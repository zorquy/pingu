// El constructor de mazos (/constructor): a la izquierda el mazo, a la
// derecha el buscador, como el builder de Limitless — que es lo que la
// comunidad ya sabe usar — pero en español, con la regla de la
// reimpresión de /torneo y guardado en tu cuenta de PokeDoc.
//
// Las reglas, los formatos de texto y los enlaces viven en
// constructor/nucleo.js (sin DOM, probados en Node); la base, en
// constructor/datos.js. Aquí solo se pinta y se escucha.
import { getSession, escapeHtml } from './app.js'
import { supabase } from './supabase.js'
import { showToast } from './toast.js'
import { cardImageUrl } from './tcgdex.js'
import { rutaDeCarta } from './carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import {
  validarMazo,
  seccionesDelMazo,
  esEnergiaBasica,
  claveDeNombre,
  nombreVisible,
  imagenDeEnergiaBasica,
  textoTcgLive,
  comoDecklist,
  codificarMazo,
  decodificarMazo,
  leerLista,
  leerEnlaceLimitless,
  probabilidadEnMano,
  numeroSinCeros,
  esBasico,
} from './constructor/nucleo.js'
import {
  marcasLegales,
  cargarSets,
  buscarCartas,
  cartasPorIds,
  nombresConReimpresionLegal,
  resolverLineas,
  cargarMazo,
  guardarMazo,
  TIPOS,
} from './constructor/datos.js'

const $ = (id) => document.getElementById(id)
const BORRADOR = 'pokedoc-constructor-borrador'
const MAX_POR_NOMBRE = 4

// ── El estado ──
const estado = {
  id: null, // el mazo guardado que se está editando (null = sin guardar)
  duenoId: null,
  soloLectura: false, // un mazo público de otra persona
  nombre: '',
  formato: 'standard',
  publico: false,
  entradas: new Map(), // id de carta → { carta, n }
  // La carta que hace de portada en «Mis mazos» (tanda 413). Null = la
  // elige el constructor al guardar; con una puesta, se respeta mientras
  // siga en el mazo — antes se recalculaba en CADA guardado y pisaba la
  // que hubieras elegido en «Mis mazos».
  portada: null,
  // …o aunque NO esté, si se eligió de fuera: en «Mis mazos» se puede
  // buscar cualquier carta de portada, y el constructor solo elige entre
  // las del mazo, así que una portada que no está en él la ha puesto
  // alguien a propósito. Una que sí estaba y se ha quitado del mazo deja
  // de valer: el mazo ya es otro.
  portadaDeFuera: false,
  historia: [],
  cambiado: false,
  sesion: null,
  legales: ['H', 'I', 'J'],
  reimpresion: new Set(),
  reimpresionPedida: new Set(),
  sets: null,
  modo: 'rejilla',
  avisosAbiertos: false,
}

const busqueda = { desde: 0, total: 0, cartas: [], pidiendo: false, turno: 0 }

// ── Utilidades del estado ──
const lista = () => [...estado.entradas.values()]
const total = () => lista().reduce((s, e) => s + e.n, 0)
const copiasDe = (id) => estado.entradas.get(id)?.n || 0
const codigoDeSet = (setId) => estado.sets?.codigoDeId.get(setId) || null

function copiasDelNombre(carta) {
  const k = claveDeNombre(carta)
  return lista().filter((e) => claveDeNombre(e.carta) === k).reduce((s, e) => s + e.n, 0)
}

function instantanea() {
  return lista().map((e) => [e.carta, e.n])
}

function apuntarHistoria() {
  estado.historia.push(instantanea())
  if (estado.historia.length > 60) estado.historia.shift()
  $('cmDeshacer').disabled = false
}

function deshacer() {
  const anterior = estado.historia.pop()
  if (!anterior) return
  estado.entradas = new Map(anterior.map(([carta, n]) => [carta.id, { carta, n }]))
  $('cmDeshacer').disabled = !estado.historia.length
  marcarCambio()
}

// Poner n copias de una carta. Devuelve si ha cambiado algo.
function ponerCopias(carta, n, { conHistoria = true } = {}) {
  if (estado.soloLectura) {
    avisarSoloLectura()
    return false
  }
  const actual = copiasDe(carta.id)
  let nuevo = Math.max(0, Math.min(60, n))
  // El tope de 4 por nombre se aplica al AÑADIR, no al importar: una
  // lista pegada con 5 se deja entrar (y se avisa) para que la persona
  // vea qué le pasa a su lista en vez de perder una copia sin saberlo.
  if (nuevo > actual && !esEnergiaBasica(carta)) {
    const libres = MAX_POR_NOMBRE - copiasDelNombre(carta)
    if (libres <= 0) {
      showToast(`Ya llevas ${MAX_POR_NOMBRE} copias de ${nombreVisible(carta)} (cuentan juntas todas sus versiones).`, 'error')
      return false
    }
    nuevo = Math.min(nuevo, actual + libres)
  }
  if (nuevo === actual) return false
  if (conHistoria) apuntarHistoria()
  if (nuevo === 0) estado.entradas.delete(carta.id)
  else estado.entradas.set(carta.id, { carta, n: nuevo })
  marcarCambio()
  return true
}

const sumar = (carta, d) => ponerCopias(carta, copiasDe(carta.id) + d)

function marcarCambio() {
  estado.cambiado = true
  guardarBorrador()
  pintarMazo()
  actualizarContadoresBusqueda()
}

// ── El borrador en el navegador ──
//
// Es una comodidad, no el guardado: permite cerrar la pestaña (o ir a
// iniciar sesión para guardar) sin perder el mazo. Por eso todo va en
// try/catch — en una ventana privada no hay localStorage y la página
// tiene que funcionar igual.
function guardarBorrador() {
  if (estado.soloLectura) return
  try {
    localStorage.setItem(
      BORRADOR,
      JSON.stringify({
        id: estado.id,
        nombre: estado.nombre,
        formato: estado.formato,
        publico: estado.publico,
        portada: estado.portada,
        portadaDeFuera: estado.portadaDeFuera,
        cartas: lista().map((e) => ({ id: e.carta.id, n: e.n })),
        cambiado: estado.cambiado,
        cuando: Date.now(),
      })
    )
  } catch {}
}

function leerBorrador() {
  try {
    return JSON.parse(localStorage.getItem(BORRADOR) || 'null')
  } catch {
    return null
  }
}

// ── Pintar el mazo ──
// La imagen de una carta, con su cadena de respaldos (tanda 413). Hasta
// ahora era la del espejo y, si no había, NADA: las promos de Mega
// Evolución (MEP) no tienen escaneo en TCGdex y salían como una caja con
// el nombre — «en el constructor muchas cartas no se ven». La CDN de
// Limitless sí las tiene por código y número, que es la misma cadena que
// ya usaban el laboratorio, la ficha y el catálogo (js/escaneo-carta.js).
// Las energías básicas, con la suya del 30 aniversario.
function cadenaDeImagen(carta, calidad = 'low') {
  if (!carta.image_path && esEnergiaBasica(carta)) {
    const e = imagenDeEnergiaBasica(carta, calidad === 'high' ? 'LG' : 'SM')
    if (e) return [e.url, e.respaldo].filter(Boolean)
  }
  return cadenaDeEscaneo(carta, codigoDeSet(carta.set_id), calidad, cardImageUrl)
}

function imagenHtml(carta, calidad = 'low') {
  // El nombre va DEBAJO de la imagen: si no contesta nadie, la imagen se
  // quita y queda el nombre — nunca un hueco sin nada (CLAUDE.md, 321).
  const attrs = atributosDeEscaneo(cadenaDeImagen(carta, calidad))
  return `<span class="cm-sin-imagen">${escapeHtml(nombreVisible(carta))}</span>${attrs ? `<img ${attrs} alt="" width="245" height="342" loading="lazy" />` : ''}`
}

function etiquetaSet(carta) {
  return `${codigoDeSet(carta.set_id) || String(carta.set_id).toUpperCase()} ${numeroSinCeros(carta.local_id)}`
}

const TITULOS = { P: 'Pokémon', T: 'Entrenador', E: 'Energía', X: 'Sin clasificar todavía' }

function pintarMazo() {
  const entradas = lista()
  const n = total()
  $('cmTotal').innerHTML = `<strong>${n}</strong>/60 cartas`
  $('cmTotal').classList.toggle('cm-total-ok', n === 60)
  $('cmTabCuenta').textContent = n
  // Orden ESTABLE: pulsar «+» no puede cambiar de sitio la carta (ver
  // seccionesDelMazo). El texto de TCG Live sí ordena por copias.
  const secciones = seccionesDelMazo(entradas, { estable: true })
  const suma = (l) => l.reduce((s, e) => s + e.n, 0)
  $('cmReparto').textContent = entradas.length
    ? `${suma(secciones.P)} Pokémon · ${suma(secciones.T) + suma(secciones.X)} Entrenador · ${suma(secciones.E)} Energía`
    : ''

  const v = validarMazo(entradas, { formato: estado.formato, legales: estado.legales, reimpresionLegal: estado.reimpresion })
  const sello = $('cmSello')
  const hayAvisos = entradas.length > 0 && v.problemas.length > 0
  if (!entradas.length) {
    sello.textContent = ''
    sello.className = 'cm-sello'
  } else if (!v.problemas.length) {
    sello.textContent = estado.formato === 'libre' ? 'Mazo completo' : `Válido en ${estado.formato === 'standard' ? 'Estándar' : 'Expandido'}`
    sello.className = 'cm-sello cm-sello-ok'
  } else {
    sello.textContent = `${v.problemas.length} ${v.problemas.length === 1 ? 'cosa por revisar' : 'cosas por revisar'}`
    sello.className = 'cm-sello cm-sello-mal'
  }
  // El sello es el botón que abre los avisos; sin avisos no abre nada.
  sello.disabled = !hayAvisos
  if (!hayAvisos) estado.avisosAbiertos = false
  sello.setAttribute('aria-expanded', String(!!estado.avisosAbiertos))
  const problemas = $('cmProblemas')
  problemas.innerHTML = v.problemas.map((p) => `<li>${escapeHtml(p.texto)}</li>`).join('')
  problemas.classList.toggle('hidden', !hayAvisos || !estado.avisosAbiertos)

  // Se repinta el mazo entero, pero SIN mover su scroll: se guarda la
  // posición y se construye todo fuera antes de cambiarlo de una vez, así
  // que el contenedor nunca se queda vacío (y a cero) entre medias.
  const cont = $('cmMazo')
  const scroll = cont.scrollTop
  cont.dataset.modo = estado.modo
  $('cmVacio').classList.toggle('hidden', entradas.length > 0)
  const nuevas = document.createDocumentFragment()
  for (const clave of ['P', 'T', 'E', 'X']) {
    const grupo = secciones[clave]
    if (!grupo.length) continue
    const sec = document.createElement('div')
    sec.className = 'cm-seccion'
    sec.innerHTML = `
      <h3 class="cm-seccion-titulo">${TITULOS[clave]} <span class="subtext">(${suma(grupo)})</span></h3>
      <div class="${estado.modo === 'lista' ? 'cm-lista' : 'cm-cartas'}">
        ${grupo.map((e) => (estado.modo === 'lista' ? filaHtml(e, v.porCarta.get(e.carta.id)) : cartaHtml(e, v.porCarta.get(e.carta.id)))).join('')}
      </div>`
    nuevas.appendChild(sec)
  }
  cont.querySelectorAll('.cm-seccion').forEach((s) => s.remove())
  cont.appendChild(nuevas)
  cont.scrollTop = scroll
  pedirReimpresiones(entradas)
}

function cartaHtml(e, mal) {
  const c = e.carta
  const nombre = escapeHtml(nombreVisible(c))
  return `
    <div class="cm-carta${mal ? ' cm-carta-mal' : ''}" data-id="${escapeHtml(c.id)}" ${mal ? `title="${escapeHtml(mal.join(' · '))}"` : ''}>
      <button type="button" class="cm-carta-img" data-info aria-label="Ver ${nombre}">${imagenHtml(c)}</button>
      <span class="cm-carta-n" aria-hidden="true">${e.n}</span>
      <div class="cm-carta-botones">
        <button type="button" class="cm-mini" data-menos aria-label="Quitar una ${nombre}">−</button>
        <button type="button" class="cm-mini" data-mas aria-label="Añadir una ${nombre}">+</button>
      </div>
    </div>`
}

function filaHtml(e, mal) {
  const c = e.carta
  const nombre = escapeHtml(nombreVisible(c))
  return `
    <div class="cm-fila${mal ? ' cm-carta-mal' : ''}" data-id="${escapeHtml(c.id)}" ${mal ? `title="${escapeHtml(mal.join(' · '))}"` : ''}>
      <span class="cm-fila-n">${e.n}</span>
      <button type="button" class="cm-fila-nombre" data-info>${nombre}</button>
      <span class="cm-fila-set subtext">${escapeHtml(etiquetaSet(c))}</span>
      <button type="button" class="cm-mini" data-menos aria-label="Quitar una ${nombre}">−</button>
      <button type="button" class="cm-mini" data-mas aria-label="Añadir una ${nombre}">+</button>
    </div>`
}

// La regla de la reimpresión necesita a la base: se pide solo por los
// nombres con marca vieja que no se hayan preguntado ya, y al volver se
// repinta. Así una carta vieja con reimpresión legal no sale en rojo.
function pedirReimpresiones(entradas) {
  if (estado.formato === 'libre') return
  const viejas = entradas
    .filter((e) => e.carta.regulation_mark && !estado.legales.includes(e.carta.regulation_mark) && !esEnergiaBasica(e.carta))
    .map((e) => e.carta)
    .filter((c) => !estado.reimpresionPedida.has(claveDeNombre(c)))
  if (!viejas.length) return
  viejas.forEach((c) => estado.reimpresionPedida.add(claveDeNombre(c)))
  nombresConReimpresionLegal(viejas).then((legales) => {
    if (!legales.size) return
    legales.forEach((k) => estado.reimpresion.add(k))
    pintarMazo()
  })
}

// ── El buscador ──
function filtros() {
  return {
    texto: $('cmTexto').value,
    categoria: $('cmCategoria').value,
    subtipo: $('cmSubtipo').value,
    tipo: $('cmTipo').value,
    set: $('cmSet').value,
    formato: $('cmSoloLegales').checked ? estado.formato : 'libre',
  }
}

async function buscar({ mas = false } = {}) {
  const turno = ++busqueda.turno
  if (!mas) {
    busqueda.desde = 0
    busqueda.cartas = []
    $('cmResultados').innerHTML = '<p class="subtext cm-cargando">Buscando…</p>'
  }
  busqueda.pidiendo = true
  $('cmMas').disabled = true
  try {
    const r = await buscarCartas({ ...filtros(), desde: busqueda.desde, limite: 60 })
    // Si mientras tanto se ha lanzado otra búsqueda, esta ya no vale:
    // pintarla mezclaría resultados de dos consultas.
    if (turno !== busqueda.turno) return
    if (r.sinFiltro) {
      $('cmResultados').innerHTML = '<p class="subtext cm-cargando">Escribe un nombre o elige una colección para ver cartas.</p>'
      $('cmCuenta').textContent = ''
      $('cmMas').classList.add('hidden')
      return
    }
    busqueda.cartas = mas ? busqueda.cartas.concat(r.cartas) : r.cartas
    busqueda.total = r.total
    busqueda.desde += r.leidas ?? r.cartas.length
    pintarResultados(mas ? r.cartas : null)
  } catch (err) {
    if (turno !== busqueda.turno) return
    $('cmResultados').innerHTML = `<p class="subtext cm-cargando">No se ha podido buscar (${escapeHtml(err.message || 'error de red')}). Prueba otra vez.</p>`
  } finally {
    if (turno === busqueda.turno) {
      busqueda.pidiendo = false
      $('cmMas').disabled = false
    }
  }
}

function resultadoHtml(c) {
  const n = copiasDe(c.id)
  const nombre = escapeHtml(nombreVisible(c))
  return `
    <div class="cm-resultado" data-id="${escapeHtml(c.id)}">
      <button type="button" class="cm-resultado-img" data-anadir aria-label="Añadir ${nombre} (${escapeHtml(etiquetaSet(c))}) al mazo">${imagenHtml(c)}</button>
      <span class="cm-resultado-en${n ? '' : ' hidden'}" aria-hidden="true">${n}</span>
      <button type="button" class="cm-info" data-info aria-label="Ver ${nombre} en grande">i</button>
      <span class="cm-resultado-pie subtext">${escapeHtml(etiquetaSet(c))}${c.regulation_mark ? ` · ${escapeHtml(c.regulation_mark)}` : ''}</span>
    </div>`
}

function pintarResultados(nuevas) {
  const cont = $('cmResultados')
  if (!busqueda.cartas.length) {
    cont.innerHTML = $('cmSoloLegales').checked && estado.formato !== 'libre'
      ? '<p class="subtext cm-cargando">No hay cartas con esos filtros en el formato del mazo. Prueba a quitar algún filtro o a desmarcar «Solo cartas del formato del mazo».</p>'
      : '<p class="subtext cm-cargando">No hay cartas con esos filtros. Prueba a quitar alguno.</p>'
  } else if (nuevas) {
    cont.insertAdjacentHTML('beforeend', nuevas.map(resultadoHtml).join(''))
  } else {
    cont.innerHTML = busqueda.cartas.map(resultadoHtml).join('')
  }
  $('cmCuenta').textContent = busqueda.total ? `${busqueda.total.toLocaleString('es-ES')} ${busqueda.total === 1 ? 'carta' : 'cartas'}` : ''
  $('cmMas').classList.toggle('hidden', busqueda.desde >= busqueda.total)
}

// El numerito de «ya lo llevas» en cada resultado, sin repintar la
// rejilla entera (que haría saltar las imágenes).
function actualizarContadoresBusqueda() {
  document.querySelectorAll('#cmResultados .cm-resultado').forEach((el) => {
    const n = copiasDe(el.dataset.id)
    const chapa = el.querySelector('.cm-resultado-en')
    chapa.textContent = n
    chapa.classList.toggle('hidden', !n)
  })
}

function cartaPorId(id) {
  return estado.entradas.get(id)?.carta || busqueda.cartas.find((c) => c.id === id) || null
}

// ── Los modales ──
let modalAbierto = null
let focoPrevio = null
function abrirModal(id) {
  focoPrevio = document.activeElement
  modalAbierto = $(id)
  modalAbierto.classList.remove('hidden')
  modalAbierto.querySelector('[data-cerrar], button, textarea')?.focus()
}
function cerrarModal() {
  if (!modalAbierto) return
  modalAbierto.classList.add('hidden')
  modalAbierto = null
  focoPrevio?.focus?.()
}

let cartaAbierta = null
function abrirCarta(carta) {
  cartaAbierta = carta
  // La grande recorre la misma cadena que la pequeña, de un sitio al
  // siguiente.
  const cadena = cadenaDeImagen(carta, 'high')
  const img = $('cmCartaImg')
  img.src = cadena.shift() || ''
  img.onerror = () => {
    if (cadena.length) img.src = cadena.shift()
    else img.onerror = null
  }
  $('cmCartaImg').alt = nombreVisible(carta)
  $('cmCartaNombre').textContent = nombreVisible(carta)
  const set = estado.sets?.porId.get(carta.set_id)
  $('cmCartaSet').textContent = [set?.name || carta.set_id, `nº ${numeroSinCeros(carta.local_id)}`, carta.regulation_mark ? `marca ${carta.regulation_mark}` : null, carta.rarity].filter(Boolean).join(' · ')
  $('cmCartaFicha').href = rutaDeCarta(carta)
  pintarCartaAbierta()
  abrirModal('cmModalCarta')
}

function pintarCartaAbierta() {
  if (!cartaAbierta) return
  const n = copiasDe(cartaAbierta.id)
  $('cmCartaCopias').textContent = n
  $('cmCartaMenos').disabled = n === 0 || estado.soloLectura
  $('cmCartaMas').disabled = estado.soloLectura
  const t = Math.max(total(), 60)
  // Lo que más se pregunta al ajustar un mazo: con estas copias, ¿cuántas
  // veces la tengo en la mano inicial?
  $('cmCartaProbabilidad').textContent = n
    ? `Con ${n} ${n === 1 ? 'copia' : 'copias'}, la tienes en la mano inicial el ${Math.round(probabilidadEnMano(copiasDelNombre(cartaAbierta), t) * 100)} % de las veces.`
    : `Con 1 copia la tendrías en la mano inicial el ${Math.round(probabilidadEnMano(1, t) * 100)} % de las veces; con 4, el ${Math.round(probabilidadEnMano(4, t) * 100)} %.`
  // «Usar de portada» (tanda 413): solo con la carta en el mazo, y si ya
  // lo es, lo dice en vez de ofrecerlo.
  const portada = $('cmCartaPortada')
  if (portada) {
    const esLa = elegirPortada() === cartaAbierta.id
    portada.classList.toggle('hidden', n === 0 || estado.soloLectura)
    portada.disabled = esLa
    portada.textContent = esLa ? 'Es la portada del mazo' : 'Usar de portada'
  }
  const v = validarMazo(lista(), { formato: estado.formato, legales: estado.legales, reimpresionLegal: estado.reimpresion })
  $('cmCartaAvisos').innerHTML = (v.porCarta.get(cartaAbierta.id) || []).map((m) => `<li>${escapeHtml(m)}</li>`).join('')
}

// ── Importar ──
async function importar() {
  if (modoImportar === 'imagen') return importarImagen()
  const texto = $('cmImportarTexto').value.trim()
  const res = $('cmImportarResultado')
  if (!texto) return
  const boton = $('cmImportarBoton')
  boton.disabled = true
  boton.textContent = 'Leyendo…'
  res.classList.add('hidden')
  try {
    let lineas
    let ilegibles = []
    if (/limitlesstcg\.com\/builder\?i=|^1(?:[01][0-9a-zA-Z]\d\d)/.test(texto) && !/\s/.test(texto)) {
      lineas = leerEnlaceLimitless(texto).map((l) => ({ n: l.n, nombre: '', set: l.set, numero: l.numero, original: `${l.n} ${l.set} ${l.numero}` }))
    } else if (/[?&]l=/.test(texto) && !/\s/.test(texto)) {
      // Un enlace de este mismo constructor.
      const cod = new URL(texto, location.origin).searchParams.get('l')
      const piezas = decodificarMazo(cod)
      const mapa = await cartasPorIds(piezas.map((p) => p.id))
      aplicarImportacion(piezas.filter((p) => mapa.get(p.id)).map((p) => ({ carta: mapa.get(p.id), n: p.n })))
      cerrarModal()
      return
    } else {
      ;({ lineas, ilegibles } = leerLista(texto))
    }
    if (!lineas.length) {
      res.innerHTML = '<p>No he encontrado ninguna carta. Cada línea tiene que empezar por la cantidad: «4 Charmander PAF 7».</p>'
      res.classList.remove('hidden')
      return
    }
    await importarLineas(lineas, ilegibles)
  } catch (err) {
    res.innerHTML = `<p>No se ha podido importar: ${escapeHtml(err.message || 'error de red')}.</p>`
    res.classList.remove('hidden')
  } finally {
    boton.disabled = false
    boton.textContent = 'Importar'
  }
}

// Lo común al texto y a la imagen: resolver las líneas contra el espejo,
// meterlas en el mazo y contar lo que no ha salido limpio.
async function importarLineas(lineas, ilegibles = []) {
  const res = $('cmImportarResultado')
  const { resueltas, sinResolver } = await resolverLineas(lineas)
  aplicarImportacion(resueltas.map((r) => ({ carta: r.carta, n: r.linea.n })))
  const porNombre = resueltas.filter((r) => !r.exacta)
  const avisos = []
  if (sinResolver.length) avisos.push(`<p><strong>No encontradas (${sinResolver.length}):</strong></p><ul>${sinResolver.map((l) => `<li>${escapeHtml(l.original)}</li>`).join('')}</ul>`)
  if (ilegibles.length) avisos.push(`<p><strong>Líneas que no parecen cartas (${ilegibles.length}):</strong></p><ul>${ilegibles.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`)
  if (porNombre.length) avisos.push(`<p><strong>Encontradas por el nombre (${porNombre.length}):</strong> revisa que sea la versión que querías.</p><ul>${porNombre.map((r) => `<li>${escapeHtml(r.linea.original)} → ${escapeHtml(nombreVisible(r.carta))} (${escapeHtml(etiquetaSet(r.carta))})</li>`).join('')}</ul>`)
  if (avisos.length) {
    res.innerHTML = `<p>Importadas ${resueltas.reduce((s, r) => s + r.linea.n, 0)} cartas.</p>${avisos.join('')}`
    res.classList.remove('hidden')
  } else {
    showToast(`Lista importada: ${total()} cartas.`, 'success')
    cerrarModal()
  }
}

// ── Importar desde una imagen de Limitless ──
//
// El reconocimiento (js/constructor/imagen.js) y su base de huellas
// (~3 MB) solo se bajan la primera vez que alguien lo usa: el resto de
// la página no los necesita. Cada carta reconocida sale en una fila con
// su recorte al lado, para poder corregir la carta o las copias antes de
// importar — las dudosas, en amarillo.
let modoImportar = 'texto'
let filasImagen = null
let dbImagen = null
let turnoImagen = 0

function cambiarModoImportar(modo) {
  modoImportar = modo
  for (const [m, tab, panel] of [
    ['texto', 'cmImportarModoTexto', 'cmImportarPanelTexto'],
    ['imagen', 'cmImportarModoImagen', 'cmImportarPanelImagen'],
  ]) {
    $(tab).classList.toggle('activa', m === modo)
    $(tab).setAttribute('aria-selected', String(m === modo))
    $(panel).classList.toggle('hidden', m !== modo)
  }
  $('cmImportarResultado').classList.add('hidden')
  $('cmImportarBoton').disabled = modo === 'imagen' && !filasImagen?.length
}

async function leerImagenSubida(fichero) {
  if (!fichero) return
  if (!/^image\//.test(fichero.type)) return showToast('Eso no es una imagen.', 'error')
  if (modalAbierto !== $('cmModalImportar')) {
    cerrarModal()
    abrirModal('cmModalImportar')
  }
  cambiarModoImportar('imagen')
  const turno = ++turnoImagen
  const aviso = $('cmImagenEstado')
  filasImagen = null
  $('cmImagenFilas').innerHTML = ''
  $('cmImportarBoton').disabled = true
  try {
    // Una imagen exportada por PokeDoc lleva la lista en texto dentro
    // (tanda 421): si sigue ahí, la importación es EXACTA y no hace falta
    // reconocer nada. Se pasa al modo texto con la lista escrita, para
    // revisarla antes de pulsar «Importar» como con cualquier otra.
    const { sacarLista } = await import('./lista-en-png.js')
    const incrustada = sacarLista(new Uint8Array(await fichero.arrayBuffer()))
    if (turno !== turnoImagen) return
    if (incrustada) {
      $('cmImportarTexto').value = incrustada
      cambiarModoImportar('texto')
      const res = $('cmImportarResultado')
      res.innerHTML = '<p>Esta imagen es de PokeDoc y trae la lista dentro: aquí la tienes, exacta. Revísala y pulsa «Importar».</p>'
      res.classList.remove('hidden')
      return
    }
    const mod = await import('./constructor/imagen.js')
    if (!dbImagen) {
      aviso.textContent = 'Cargando la base de cartas (solo la primera vez, unos segundos)…'
      dbImagen = await mod.cargarHuellas()
    }
    aviso.textContent = 'Buscando las cartas en la imagen…'
    const filas = await mod.leerImagen(fichero, dbImagen, (p) => {
      if (turno === turnoImagen) aviso.textContent = `Reconociendo cartas… ${Math.round(p * 100)} %`
    })
    if (turno !== turnoImagen) return // llegó otra imagen mientras tanto
    if (!filas.length) {
      aviso.textContent = 'No he encontrado cartas en esta imagen. Tiene que ser una lista de Limitless o de PokeDoc: las cartas en rejilla, sobre fondo oscuro, claro o transparente.'
      return
    }
    filasImagen = filas.map((f) => ({ ...f, elegida: f.candidatas[0] }))
    pintarFilasImagen()
  } catch (err) {
    if (turno === turnoImagen) aviso.textContent = `No se ha podido leer la imagen: ${err.message || 'error de red'}.`
  }
}

function etiquetaHuella(i) {
  const c = dbImagen.cartas[i]
  return `${c.nombre} · ${c.set} ${c.num}`
}

function resumenImagen() {
  const vivas = filasImagen.filter((f) => f.elegida >= 0)
  const n = vivas.reduce((s, f) => s + (Number(f.copias) || 0), 0)
  const dudas = vivas.filter((f) => f.dudaCarta || f.dudaCopias).length
  $('cmImagenEstado').textContent =
    `${vivas.length} ${vivas.length === 1 ? 'carta distinta' : 'cartas distintas'}, ${n} en total.` +
    (dudas ? ` Revisa ${dudas === 1 ? 'la marcada' : `las ${dudas} marcadas`} en amarillo.` : ' Todo reconocido con seguridad.')
  $('cmImportarBoton').disabled = !vivas.length
}

function pintarFilasImagen() {
  $('cmImagenFilas').innerHTML = filasImagen
    .map(
      (f, k) => `
      <div class="cm-imagen-fila${f.dudaCarta || f.dudaCopias ? ' cm-duda' : ''}" data-k="${k}">
        <img class="cm-imagen-recorte" src="${escapeHtml(f.recorte)}" alt="" width="92" height="128" loading="lazy" />
        <div class="cm-imagen-datos">
          <label class="cm-campo">Carta
            <select data-carta class="${f.dudaCarta ? 'cm-dudoso' : ''}">
              ${f.candidatas.map((i) => `<option value="${i}"${i === f.elegida ? ' selected' : ''}>${escapeHtml(etiquetaHuella(i))}</option>`).join('')}
              <option value="-1">No importar esta carta</option>
            </select>
          </label>
          <label class="cm-campo cm-imagen-copias">Copias
            <input type="number" min="1" max="60" inputmode="numeric" value="${f.copias}" data-copias class="${f.dudaCopias ? 'cm-dudoso' : ''}" />
          </label>
        </div>
      </div>`
    )
    .join('')
  resumenImagen()
}

async function importarImagen() {
  if (!filasImagen?.length) return
  const lineas = filasImagen
    .filter((f) => f.elegida >= 0 && Number(f.copias) > 0)
    .map((f) => {
      const c = dbImagen.cartas[f.elegida]
      const n = Math.min(60, Math.round(Number(f.copias)))
      return { n, nombre: c.nombre, set: c.set, numero: c.num, original: `${n} ${c.nombre} ${c.set} ${c.num}` }
    })
  if (!lineas.length) return
  const boton = $('cmImportarBoton')
  boton.disabled = true
  boton.textContent = 'Importando…'
  try {
    await importarLineas(lineas)
  } catch (err) {
    $('cmImportarResultado').innerHTML = `<p>No se ha podido importar: ${escapeHtml(err.message || 'error de red')}.</p>`
    $('cmImportarResultado').classList.remove('hidden')
  } finally {
    boton.disabled = false
    boton.textContent = 'Importar'
  }
}

function aplicarImportacion(piezas) {
  if (estado.soloLectura) return avisarSoloLectura()
  apuntarHistoria()
  if ($('cmImportarSustituir').checked) estado.entradas = new Map()
  for (const { carta, n } of piezas) {
    const actual = copiasDe(carta.id)
    estado.entradas.set(carta.id, { carta, n: Math.min(60, actual + n) })
  }
  marcarCambio()
}

// ── El laboratorio de pruebas (tanda 384) ──
//
// Sustituye a la «mano de prueba» de la 354: aquella robaba siete cartas
// y ya; esto es una partida con reglas, las cartas del meta funcionando y
// la tabla de probabilidades en vivo. Se baja SOLO al abrirlo — motor,
// efectos y pantalla pesan, y quien monta un mazo no los necesita.
let abriendoLab = false
async function abrirLab() {
  if (abriendoLab) return
  const n = total()
  if (n < 13) return showToast('Hacen falta al menos 13 cartas en el mazo para repartir una mano y los premios.', 'error')
  // Sin fase en el catálogo no se acusa (esBasico da null): puede ser esa.
  if (!lista().some((e) => esBasico(e.carta) !== false)) {
    return showToast('El mazo necesita algún Pokémon básico para poder empezar una partida.', 'error')
  }
  abriendoLab = true
  $('cmProbar').disabled = true
  try {
    const { abrirLaboratorio } = await import('./constructor/laboratorio.js')
    await abrirLaboratorio({ entradas: lista(), nombre: estado.nombre, codigoDeSet })
  } catch (err) {
    showToast(`No se ha podido abrir el laboratorio: ${err.message || 'error de red'}.`, 'error')
  } finally {
    abriendoLab = false
    $('cmProbar').disabled = false
  }
}

// ── Compartir ──
function enlaceDelMazo() {
  if (estado.id && estado.publico && !estado.cambiado) return `${location.origin}/constructor?mazo=${estado.id}`
  return `${location.origin}/constructor?l=${codificarMazo(lista())}`
}

async function copiar(texto, ok) {
  try {
    await navigator.clipboard.writeText(texto)
    showToast(ok, 'success')
  } catch {
    showToast('El navegador no ha dejado copiar. Prueba otra vez.', 'error')
  }
}

async function accionCompartir(accion) {
  if (!lista().length) return showToast('El mazo está vacío.', 'error')
  if (accion === 'enlace') {
    if (estado.id && !estado.publico) {
      showToast('Tu mazo guardado es privado: el enlace lleva la lista dentro, así que funciona igual.', 'success')
    }
    return copiar(enlaceDelMazo(), 'Enlace copiado: quien lo abra verá este mazo.')
  }
  if (accion === 'tcglive') return copiar(textoTcgLive(lista(), codigoDeSet), 'Lista copiada. En TCG Live: Mazos → Crear mazo → Importar.')
  if (accion === 'imagen') {
    // decklist-imagen y no decklist-export: el de al lado pinta botones
    // con clases de torneos.css, que esta página no carga (tanda 358).
    const { descargarImagenDecklist } = await import('./torneos/decklist-imagen.js')
    descargarImagenDecklist(estado.nombre || 'Mazo sin nombre', comoDecklist(lista(), codigoDeSet))
  }
}

async function accionHerramienta(accion) {
  if (accion === 'importar-imagen') {
    $('cmImportarSustituir').checked = true
    abrirModal('cmModalImportar')
    cambiarModoImportar('imagen')
    $('cmImagenFichero').focus()
    return
  }
  if (accion === 'importar') {
    $('cmImportarResultado').classList.add('hidden')
    $('cmImportarSustituir').checked = true
    abrirModal('cmModalImportar')
    cambiarModoImportar('texto')
    // Si en el portapapeles hay una lista, se pega sola: es lo que viene
    // a hacer quien abre esto. Si el navegador no deja leerlo, no pasa
    // nada — se pega a mano.
    try {
      const t = await navigator.clipboard.readText()
      if (t && !$('cmImportarTexto').value && (/^\s*\*?\s*\d{1,2}\s*x?\s+\S/m.test(t) || /limitlesstcg\.com\/builder\?i=/.test(t))) $('cmImportarTexto').value = t
    } catch {}
    return
  }
  if (accion === 'laboratorio' || accion === 'mano') return abrirLab()
  if (accion === 'vaciar') {
    if (!lista().length || estado.soloLectura) return
    apuntarHistoria()
    estado.entradas = new Map()
    marcarCambio()
    showToast('Mazo vaciado. Si ha sido sin querer, pulsa «Deshacer».', 'success')
    return
  }
  if (accion === 'nuevo') {
    if (estado.cambiado && lista().length && !confirmarPerder()) return
    empezarNuevo()
  }
}

function confirmarPerder() {
  // confirm() bloquea, pero aquí es justo lo que se quiere: una decisión
  // que no se puede deshacer y que la persona tiene que ver sí o sí.
  return window.confirm('Tienes cambios sin guardar en este mazo. ¿Empezar uno nuevo de todas formas?')
}

function empezarNuevo() {
  estado.id = null
  estado.duenoId = null
  estado.soloLectura = false
  estado.nombre = ''
  estado.publico = false
  estado.portada = null
  estado.portadaDeFuera = false
  estado.entradas = new Map()
  estado.historia = []
  estado.cambiado = false
  $('cmDeshacer').disabled = true
  history.replaceState(null, '', '/constructor')
  pintarCabecera()
  marcarCambio()
  estado.cambiado = false
  guardarBorrador()
  pintarEstadoGuardado()
}

// ── Guardar ──
async function guardar() {
  if (!lista().length) return showToast('Añade alguna carta antes de guardar.', 'error')
  if (!estado.sesion) {
    guardarBorrador()
    showToast('Entra en tu cuenta para guardar el mazo. Te lo guardamos mientras tanto.', 'success')
    const volver = `/constructor?l=${codificarMazo(lista())}`
    setTimeout(() => (location.href = `/auth.html?volver=${encodeURIComponent(volver)}`), 900)
    return
  }
  const boton = $('cmGuardar')
  boton.disabled = true
  try {
    const copia = estado.soloLectura
    const datos = {
      name: estado.nombre || 'Mazo sin nombre',
      format: estado.formato,
      cards: lista().map((e) => ({ id: e.carta.id, n: e.n })),
      cover_card: elegirPortada(),
      is_public: copia ? false : estado.publico,
    }
    let fila
    let nuevo = false
    try {
      fila = await guardarMazo({ id: copia ? null : estado.id, ...datos })
    } catch (err) {
      // El mazo que se estaba editando ya no está en tu cuenta: se borró
      // desde «Mis mazos» (o en otra pestaña), o venía de un borrador de
      // otra cuenta que entró en este navegador. Antes salía «este mazo no
      // es tuyo» y no había forma de guardarlo; PINGU: «cada uno puede
      // guardar el mazo que quiera en su cuenta». Se guarda como NUEVO.
      if (!err.sinFila) throw err
      fila = await guardarMazo({ id: null, ...datos })
      nuevo = true
    }
    estado.id = fila.id
    estado.duenoId = fila.user_id
    estado.soloLectura = false
    estado.cambiado = false
    history.replaceState(null, '', `/constructor?mazo=${fila.id}`)
    guardarBorrador()
    pintarCabecera()
    pintarEstadoGuardado()
    showToast(copia ? 'Copia guardada en tus mazos.' : nuevo ? 'Guardado como mazo nuevo en tus mazos.' : 'Mazo guardado.', 'success')
  } catch (err) {
    showToast(err.message || 'No se ha podido guardar.', 'error')
  } finally {
    boton.disabled = false
  }
}

// La portada de la tarjeta en /mazos: la que hayas elegido, si sigue en
// el mazo; si no, el Pokémon del que más copias hay (casi siempre el que
// da nombre al mazo).
function elegirPortada() {
  if (estado.portada && (estado.portadaDeFuera || estado.entradas.has(estado.portada))) return estado.portada
  const p = seccionesDelMazo(lista()).P
  const mejor = [...p].sort((a, b) => b.n - a.n)[0] || lista()[0]
  return mejor?.carta.id || null
}

function pintarEstadoGuardado() {
  const el = $('cmEstadoGuardado')
  if (estado.soloLectura) el.textContent = ''
  else if (!estado.id) el.textContent = lista().length ? 'Sin guardar' : ''
  else el.textContent = estado.cambiado ? 'Cambios sin guardar' : 'Guardado'
}

function pintarCabecera() {
  $('cmNombre').value = estado.nombre
  $('cmNombre').readOnly = estado.soloLectura
  $('cmFormato').value = estado.formato
  $('cmPublico').checked = estado.publico
  $('cmPublicoCampo').classList.toggle('hidden', !estado.sesion || estado.soloLectura)
  $('cmGuardar').textContent = estado.soloLectura ? 'Guardar una copia' : 'Guardar'
  document.title = `${estado.nombre ? `${estado.nombre} — ` : ''}Constructor de mazos — PokeDoc`
}

function avisarSoloLectura() {
  showToast('Este mazo es de otra persona. Pulsa «Guardar una copia» para editarlo en tu cuenta.', 'error')
}

function aviso(html) {
  const el = $('cmAviso')
  el.innerHTML = html
  el.classList.toggle('hidden', !html)
}

// ── Cargar lo que diga la dirección ──
async function cargarDesdeUrl() {
  const p = new URLSearchParams(location.search)
  const idMazo = p.get('mazo')
  const l = p.get('l')
  const i = p.get('i')

  if (idMazo) {
    try {
      const fila = await cargarMazo(idMazo)
      if (!fila) {
        aviso('<p>Este mazo no existe o es privado. Te dejamos un mazo nuevo para empezar.</p>')
        return
      }
      await ponerFila(fila)
      const esMio = estado.sesion?.user.id === fila.user_id
      if (!esMio) {
        estado.soloLectura = true
        // sin rango: el nombre del dueño de un mazo sale como texto en la
        // cabecera del laboratorio, sin enlace al perfil (tanda 386).
        const { data: autor } = await supabase.from('user_profiles').select('username,display_name').eq('id', fila.user_id).maybeSingle()
        const quien = autor ? escapeHtml(autor.display_name || autor.username) : 'otra persona'
        aviso(`<p>Estás viendo un mazo de <strong>${quien}</strong>. Puedes exportarlo tal cual, o pulsar «Guardar una copia» para editarlo en tu cuenta.</p>`)
      } else {
        // ¿Hay cambios de este mismo mazo que se quedaron sin guardar?
        const b = leerBorrador()
        if (b && b.id === fila.id && b.cambiado && b.cuando > Date.parse(fila.updated_at)) {
          aviso('<p>Tienes cambios de este mazo que no llegaste a guardar. <button type="button" class="link-btn" id="cmRecuperar">Recuperarlos</button></p>')
          $('cmRecuperar')?.addEventListener('click', async () => {
            await ponerBorrador(b)
            aviso('')
          })
        }
      }
    } catch (err) {
      aviso(`<p>${escapeHtml(err.message)}</p>`)
    }
    return
  }

  if (l) {
    const piezas = decodificarMazo(l)
    const mapa = await cartasPorIds(piezas.map((x) => x.id))
    estado.entradas = new Map(piezas.filter((x) => mapa.get(x.id)).map((x) => [x.id, { carta: mapa.get(x.id), n: x.n }]))
    estado.cambiado = true
    const b = leerBorrador()
    if (b && codificarMazo(lista()) === codificarMazo(b.cartas.map((c) => ({ carta: { id: c.id }, n: c.n })))) {
      estado.nombre = b.nombre || ''
      estado.formato = b.formato || 'standard'
    }
    return
  }

  if (i) {
    const lineas = leerEnlaceLimitless(i).map((x) => ({ n: x.n, nombre: '', set: x.set, numero: x.numero, original: `${x.n} ${x.set} ${x.numero}` }))
    const { resueltas, sinResolver } = await resolverLineas(lineas)
    estado.entradas = new Map(resueltas.map((r) => [r.carta.id, { carta: r.carta, n: r.linea.n }]))
    estado.cambiado = true
    // «Abrir en el constructor» desde /meta (tanda 364) manda también el
    // nombre del arquetipo, para que el mazo no se guarde «sin nombre».
    const nombre = (p.get('nombre') || '').trim().slice(0, 80)
    if (nombre) estado.nombre = nombre
    if (sinResolver.length) aviso(`<p>No he encontrado ${sinResolver.length} ${sinResolver.length === 1 ? 'carta' : 'cartas'} del enlace: ${sinResolver.map((x) => escapeHtml(x.original)).join(', ')}.</p>`)
    return
  }

  // «Nuevo mazo» desde /mazos: empezar de cero aunque haya borrador.
  if (p.has('nuevo')) {
    history.replaceState(null, '', '/constructor')
    return
  }

  // Sin nada en la dirección, el constructor se abre VACÍO (lo pidió
  // PINGU): quien entra por el menú viene a hacer un mazo, no a
  // encontrarse el último que tocó. El borrador no se pierde: se ofrece en
  // una línea, y se guarda en memoria al leerlo, así que sigue ahí aunque
  // el mazo nuevo lo pise en el navegador al añadir la primera carta.
  const b = leerBorrador()
  if (b?.cartas?.length) {
    const n = b.cartas.reduce((s, c) => s + (c.n || 0), 0)
    const nombre = b.nombre ? `«${escapeHtml(b.nombre)}»` : 'sin nombre'
    aviso(`<p>Tu último mazo (${nombre}, ${n} ${n === 1 ? 'carta' : 'cartas'}) sigue guardado en este navegador. <button type="button" class="link-btn" id="cmRecuperar">Seguir con él</button></p>`)
    $('cmRecuperar')?.addEventListener('click', async () => {
      if (lista().length && estado.cambiado && !confirmarPerder()) return
      await ponerBorrador(b)
      aviso('')
    })
  }
}

async function ponerFila(fila) {
  const mapa = await cartasPorIds((fila.cards || []).map((c) => c.id))
  estado.id = fila.id
  estado.duenoId = fila.user_id
  estado.nombre = fila.name
  estado.formato = fila.format
  estado.publico = fila.is_public
  estado.portada = fila.cover_card || null
  estado.entradas = new Map((fila.cards || []).filter((c) => mapa.get(c.id)).map((c) => [c.id, { carta: mapa.get(c.id), n: c.n }]))
  // Si al abrirlo la portada no está en el mazo, es que se eligió de fuera.
  estado.portadaDeFuera = Boolean(estado.portada && !estado.entradas.has(estado.portada))
  estado.cambiado = false
}

async function ponerBorrador(b) {
  const mapa = await cartasPorIds(b.cartas.map((c) => c.id))
  // El borrador vive en el NAVEGADOR, no en la cuenta: puede apuntar a un
  // mazo que ya no existe (borrado en «Mis mazos») o que es de otra cuenta
  // que entró aquí antes (tanda 420). Entonces es un mazo nuevo: si no,
  // «Guardar» intentaba pisar ese y salía «este mazo no es tuyo».
  let id = b.id || null
  if (id) {
    const fila = estado.sesion ? await cargarMazo(id).catch(() => null) : null
    if (!fila || fila.user_id !== estado.sesion.user.id) id = null
  }
  estado.id = id
  estado.nombre = b.nombre || ''
  estado.formato = b.formato || 'standard'
  estado.publico = !!b.publico
  estado.portada = b.portada || null
  estado.portadaDeFuera = !!b.portadaDeFuera
  estado.entradas = new Map(b.cartas.filter((c) => mapa.get(c.id)).map((c) => [c.id, { carta: mapa.get(c.id), n: c.n }]))
  estado.cambiado = !!b.cambiado
  pintarCabecera()
  pintarMazo()
  pintarEstadoGuardado()
}

// ── Los desplegables del buscador ──
const SUBTIPOS_DE = {
  T: [
    ['partidario', 'Partidario'],
    ['objeto', 'Objeto'],
    ['herramienta', 'Herramienta'],
    ['estadio', 'Estadio'],
  ],
  E: [
    ['basica', 'Básica'],
    ['especial', 'Especial'],
  ],
}

function pintarSubtipos() {
  const cat = $('cmCategoria').value
  const opciones = SUBTIPOS_DE[cat] || []
  $('cmSubtipo').innerHTML = '<option value="">Todos</option>' + opciones.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')
  $('cmSubtipo').disabled = !opciones.length
  $('cmTipo').disabled = cat === 'T' || cat === 'E'
  if ($('cmTipo').disabled) $('cmTipo').value = ''
}

function pintarColecciones() {
  const { sets } = estado.sets
  // Agrupadas por serie, las series en el orden de su set más nuevo.
  const series = new Map()
  for (const s of sets) {
    const k = s.serie_name || s.serie_id || 'Otras'
    if (!series.has(k)) series.set(k, [])
    series.get(k).push(s)
  }
  $('cmSet').innerHTML =
    '<option value="">Todas</option>' +
    [...series.entries()]
      .map(
        ([serie, lista]) =>
          `<optgroup label="${escapeHtml(serie)}">${lista
            .map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}${estado.sets.codigoDeId.get(s.id) ? ` (${escapeHtml(estado.sets.codigoDeId.get(s.id))})` : ''}</option>`)
            .join('')}</optgroup>`
      )
      .join('')
}

// ── Los eventos ──
function enganchar() {
  // Pestañas del móvil.
  document.querySelectorAll('.cm-pestania').forEach((b) =>
    b.addEventListener('click', () => {
      const vista = b.dataset.vista
      $('cmRejilla').dataset.vista = vista
      document.querySelectorAll('.cm-pestania').forEach((x) => {
        const activa = x.dataset.vista === vista
        x.classList.toggle('activa', activa)
        x.setAttribute('aria-selected', activa)
      })
    })
  )

  $('cmNombre').addEventListener('input', () => {
    estado.nombre = $('cmNombre').value
    estado.cambiado = true
    guardarBorrador()
    pintarEstadoGuardado()
    pintarCabecera()
  })
  $('cmFormato').addEventListener('change', () => {
    estado.formato = $('cmFormato').value
    marcarCambio()
    buscar()
  })
  $('cmPublico').addEventListener('change', () => {
    estado.publico = $('cmPublico').checked
    estado.cambiado = true
    guardarBorrador()
    pintarEstadoGuardado()
  })
  $('cmGuardar').addEventListener('click', guardar)
  $('cmDeshacer').addEventListener('click', deshacer)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      guardar()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/input|textarea/i.test(document.activeElement?.tagName || '')) {
      e.preventDefault()
      deshacer()
    } else if (e.key === 'Escape') {
      cerrarMenus()
      cerrarAvisos()
      cerrarModal()
    }
  })

  // El sello abre y cierra los avisos; un clic fuera los cierra.
  $('cmSello').addEventListener('click', (e) => {
    e.stopPropagation()
    estado.avisosAbiertos = !estado.avisosAbiertos
    $('cmSello').setAttribute('aria-expanded', String(estado.avisosAbiertos))
    $('cmProblemas').classList.toggle('hidden', !estado.avisosAbiertos)
  })
  $('cmProblemas').addEventListener('click', (e) => e.stopPropagation())
  document.addEventListener('click', cerrarAvisos)

  $('cmVacioImportar').addEventListener('click', () => accionHerramienta('importar'))

  // Los dos menús desplegables.
  const menus = [
    ['cmBtnCompartir', 'cmMenuCompartir', accionCompartir],
    ['cmBtnHerramientas', 'cmMenuHerramientas', accionHerramienta],
  ]
  for (const [btn, menu, accion] of menus) {
    $(btn).addEventListener('click', (e) => {
      e.stopPropagation()
      const abierto = !$(menu).classList.contains('hidden')
      cerrarMenus()
      if (!abierto) {
        $(menu).classList.remove('hidden')
        $(btn).setAttribute('aria-expanded', 'true')
        $(menu).querySelector('button')?.focus()
      }
    })
    $(menu).addEventListener('click', (e) => {
      const b = e.target.closest('[data-accion]')
      if (!b) return
      cerrarMenus()
      accion(b.dataset.accion)
    })
  }
  document.addEventListener('click', cerrarMenus)

  // Vista del mazo: cartas o lista.
  document.querySelectorAll('.cm-vista[data-modo]').forEach((b) =>
    b.addEventListener('click', () => {
      estado.modo = b.dataset.modo
      document.querySelectorAll('.cm-vista[data-modo]').forEach((x) => {
        x.classList.toggle('activa', x === b)
        x.setAttribute('aria-pressed', x === b)
      })
      try {
        localStorage.setItem('pokedoc-constructor-modo', estado.modo)
      } catch {}
      pintarMazo()
    })
  )

  // El mazo: − / + / abrir, y el clic derecho quita una (como Limitless).
  $('cmMazo').addEventListener('click', (e) => {
    const el = e.target.closest('[data-id]')
    if (!el) return
    const carta = cartaPorId(el.dataset.id)
    if (!carta) return
    if (e.target.closest('[data-mas]')) sumar(carta, 1)
    else if (e.target.closest('[data-menos]')) sumar(carta, -1)
    else if (e.target.closest('[data-info]')) abrirCarta(carta)
  })
  $('cmMazo').addEventListener('contextmenu', (e) => {
    const el = e.target.closest('[data-id]')
    if (!el) return
    e.preventDefault()
    const carta = cartaPorId(el.dataset.id)
    if (carta) sumar(carta, -1)
  })

  // Los resultados: pulsar añade; «i» abre; clic derecho quita una.
  $('cmResultados').addEventListener('click', (e) => {
    const el = e.target.closest('.cm-resultado')
    if (!el) return
    const carta = cartaPorId(el.dataset.id)
    if (!carta) return
    if (e.target.closest('[data-info]')) return abrirCarta(carta)
    if (e.target.closest('[data-anadir]') && sumar(carta, 1)) {
      el.classList.remove('cm-recien')
      void el.offsetWidth
      el.classList.add('cm-recien')
    }
  })
  $('cmResultados').addEventListener('contextmenu', (e) => {
    const el = e.target.closest('.cm-resultado')
    if (!el) return
    e.preventDefault()
    const carta = cartaPorId(el.dataset.id)
    if (carta && copiasDe(carta.id)) sumar(carta, -1)
  })

  // Buscar: al enviar y, con pausa, al escribir o cambiar un filtro.
  let espera = null
  const buscarEnUnRato = () => {
    clearTimeout(espera)
    espera = setTimeout(() => buscar(), 350)
  }
  $('cmFormBuscar').addEventListener('submit', (e) => {
    e.preventDefault()
    clearTimeout(espera)
    buscar()
  })
  $('cmTexto').addEventListener('input', () => {
    const t = $('cmTexto').value.trim()
    if (t.length >= 2 || t.length === 0) buscarEnUnRato()
  })
  $('cmCategoria').addEventListener('change', () => {
    pintarSubtipos()
    buscar()
  })
  for (const id of ['cmSubtipo', 'cmTipo', 'cmSet', 'cmSoloLegales']) $(id).addEventListener('change', () => buscar())
  $('cmMas').addEventListener('click', () => buscar({ mas: true }))

  // Modales.
  for (const m of ['cmModalCarta', 'cmModalImportar']) {
    $(m).addEventListener('click', (e) => {
      if (e.target === $(m) || e.target.closest('[data-cerrar]')) cerrarModal()
    })
  }
  $('cmCartaMas').addEventListener('click', () => {
    if (cartaAbierta && sumar(cartaAbierta, 1)) pintarCartaAbierta()
  })
  $('cmCartaMenos').addEventListener('click', () => {
    if (cartaAbierta && sumar(cartaAbierta, -1)) pintarCartaAbierta()
  })
  $('cmCartaPortada')?.addEventListener('click', () => {
    if (!cartaAbierta || estado.soloLectura) return
    estado.portada = cartaAbierta.id
    estado.portadaDeFuera = false
    estado.cambiado = true
    guardarBorrador()
    pintarEstadoGuardado()
    pintarCartaAbierta()
    showToast(estado.id ? 'Portada elegida: se queda al guardar.' : 'Portada elegida: será la de «Mis mazos» al guardar.', 'success')
  })
  $('cmImportarBoton').addEventListener('click', importar)
  $('cmImportarModoTexto').addEventListener('click', () => cambiarModoImportar('texto'))
  $('cmImportarModoImagen').addEventListener('click', () => cambiarModoImportar('imagen'))
  $('cmImagenFichero').addEventListener('change', (e) => {
    leerImagenSubida(e.target.files?.[0])
    e.target.value = '' // que la misma imagen se pueda volver a elegir
  })
  const soltar = $('cmSoltar')
  soltar.addEventListener('dragover', (e) => {
    e.preventDefault()
    soltar.classList.add('cm-encima')
  })
  soltar.addEventListener('dragleave', () => soltar.classList.remove('cm-encima'))
  soltar.addEventListener('drop', (e) => {
    e.preventDefault()
    soltar.classList.remove('cm-encima')
    leerImagenSubida(e.dataTransfer?.files?.[0])
  })
  // Pegar una imagen (Ctrl+V) en cualquier sitio de la página la importa:
  // es lo más rápido después de «Copiar imagen» en Twitter o Discord. En
  // un campo de texto no se toca: ahí se pega texto.
  document.addEventListener('paste', (e) => {
    const fichero = [...(e.clipboardData?.files || [])].find((f) => /^image\//.test(f.type))
    if (!fichero) return
    const enImportar = modalAbierto === $('cmModalImportar')
    if (!enImportar && /input|textarea/i.test(document.activeElement?.tagName || '')) return
    e.preventDefault()
    if (estado.soloLectura) return avisarSoloLectura()
    if (!enImportar) $('cmImportarSustituir').checked = true
    leerImagenSubida(fichero)
  })
  $('cmImagenFilas').addEventListener('change', (e) => {
    const fila = e.target.closest('[data-k]')
    if (!fila || !filasImagen) return
    const f = filasImagen[Number(fila.dataset.k)]
    if (e.target.matches('[data-carta]')) {
      f.elegida = Number(e.target.value)
      f.dudaCarta = false
    } else if (e.target.matches('[data-copias]')) {
      f.copias = Math.max(1, Math.min(60, Math.round(Number(e.target.value) || 1)))
      e.target.value = f.copias
      f.dudaCopias = false
    }
    e.target.classList.remove('cm-dudoso')
    fila.classList.toggle('cm-duda', f.dudaCarta || f.dudaCopias)
    fila.classList.toggle('cm-quitada', f.elegida < 0)
    resumenImagen()
  })
  $('cmProbar').addEventListener('click', abrirLab)
}

function cerrarAvisos() {
  if (!estado.avisosAbiertos) return
  estado.avisosAbiertos = false
  $('cmSello').setAttribute('aria-expanded', 'false')
  $('cmProblemas').classList.add('hidden')
}

function cerrarMenus() {
  for (const [btn, menu] of [
    ['cmBtnCompartir', 'cmMenuCompartir'],
    ['cmBtnHerramientas', 'cmMenuHerramientas'],
  ]) {
    $(menu).classList.add('hidden')
    $(btn).setAttribute('aria-expanded', 'false')
  }
}

// ── Arranque ──
async function iniciar() {
  try {
    estado.modo = localStorage.getItem('pokedoc-constructor-modo') === 'lista' ? 'lista' : 'rejilla'
  } catch {}
  document.querySelectorAll('.cm-vista[data-modo]').forEach((x) => {
    x.classList.toggle('activa', x.dataset.modo === estado.modo)
    x.setAttribute('aria-pressed', x.dataset.modo === estado.modo)
  })
  $('cmTipo').innerHTML = '<option value="">Todos</option>' + TIPOS.map((t) => `<option value="${t.id}">${t.nombre}</option>`).join('')
  pintarSubtipos()
  enganchar()

  const [sesion, legales, sets] = await Promise.all([getSession().catch(() => null), marcasLegales(), cargarSets().catch(() => null)])
  estado.sesion = sesion
  estado.legales = legales
  estado.sets = sets || { sets: [], codigoDeId: new Map(), idDeCodigo: new Map(), porId: new Map() }
  pintarColecciones()

  await cargarDesdeUrl().catch((err) => aviso(`<p>No se ha podido cargar el mazo: ${escapeHtml(err.message || 'error de red')}.</p>`))
  pintarCabecera()
  pintarMazo()
  pintarEstadoGuardado()

  // Lo primero que se ve en el buscador: la colección más nueva que ya
  // está en tiendas, que es de donde sale casi todo lo que se añade.
  const hoy = new Date().toISOString().slice(0, 10)
  const nueva = estado.sets.sets.find((s) => s.release_date && s.release_date <= hoy && estado.sets.codigoDeId.get(s.id) && (s.card_count_official || 0) > 20)
  if (nueva) $('cmSet').value = nueva.id
  buscar()

  // «Probar en el laboratorio» desde /meta: el mazo llega por la
  // dirección y el laboratorio se abre solo.
  if (new URLSearchParams(location.search).has('lab') && lista().length) abrirLab()
}

iniciar()
