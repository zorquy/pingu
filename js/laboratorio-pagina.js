// /laboratorio (tanda 621): el laboratorio con su propia puerta.
//
// PINGU: «estaría bien hacerle un apartado al laboratorio en el menú y que
// no solo se acceda desde el constructor de mazos». Hasta ahora se entraba
// por «Probar» en el constructor, desde un mazo del meta o desde una
// repetición. Aquí se elige CON QUÉ mazo —uno guardado, el que está a
// medias en el constructor, una lista pegada o uno del meta— y el
// laboratorio (js/constructor/laboratorio.js, el mismo) se abre encima de
// esta página: al cerrarlo se vuelve aquí y no al constructor.
//
// `/laboratorio?mazo=<id>` abre ese mazo nada más llegar: es a donde manda
// «Probar» en «Mis mazos». Y las posiciones que se comparten desde el
// laboratorio llegan aquí también (`/lab/<id>` → `?pos=<id>`, o la larga
// `#pos=…`): al cerrar la mesa se queda uno en el laboratorio y no en un
// constructor vacío. El constructor las sigue abriendo, por los enlaces
// que ya se han mandado.
import { getSession, escapeHtml } from './app.js'
import { showToast } from './toast.js'
import { cargarSets, cartasPorIds, cargarMazo, misMazos, resolverLineas } from './constructor/datos.js'
import { leerLista, leerEnlaceLimitless, decodificarMazo, esBasico } from './constructor/nucleo.js'

const $ = (id) => document.getElementById(id)
// El que el constructor guarda en el navegador mientras se edita (la misma
// clave que js/constructor.js): un mazo a medias también se puede probar.
const BORRADOR = 'pokedoc-constructor-borrador'

let sesion = null
let mazos = []
let sets = null

// Los códigos de TCG Live de cada set: con ellos el laboratorio pinta las
// imágenes. Se piden una vez, al abrir el primero.
async function codigos() {
  if (!sets) sets = await cargarSets().catch(() => null)
  return (setId) => sets?.codigoDeId.get(setId) || null
}

function leerBorrador() {
  try {
    const b = JSON.parse(localStorage.getItem(BORRADOR) || 'null')
    return b && Array.isArray(b.cartas) && b.cartas.length ? b : null
  } catch {
    return null
  }
}

const totalDe = (cartas) => (cartas || []).reduce((s, c) => s + (c.n || 0), 0)
// El mensaje de un error, para meterlo en una frase que ya pone su punto.
const motivo = (err) => String(err?.message || 'error de red').replace(/\.+$/, '')

// ── Abrir el laboratorio con unas entradas ──
//
// Las mismas comprobaciones que el «Probar» del constructor: sin ellas el
// motor no puede ni repartir.
let abriendo = false
async function abrir(entradas, nombre) {
  if (abriendo) return
  const n = entradas.reduce((s, e) => s + e.n, 0)
  if (n < 13) return showToast('Hacen falta al menos 13 cartas en el mazo para repartir una mano y los premios.', 'error')
  if (!entradas.some((e) => esBasico(e.carta) !== false)) return showToast('El mazo necesita algún Pokémon básico para poder empezar una partida.', 'error')
  abriendo = true
  try {
    const [{ abrirLaboratorio }, codigoDeSet] = await Promise.all([import('./constructor/laboratorio.js'), codigos()])
    await abrirLaboratorio({ entradas, nombre, codigoDeSet, userId: sesion?.user?.id || null })
  } catch (err) {
    showToast(`No se ha podido abrir el laboratorio: ${motivo(err)}.`, 'error')
  } finally {
    abriendo = false
  }
}

// Las cartas de una fila de `user_decks` (o del borrador), con su carta
// del catálogo. Las que el catálogo ya no tiene se quedan fuera y se dice.
async function entradasDe(cartas) {
  const mapa = await cartasPorIds(cartas.map((c) => c.id))
  const entradas = cartas.filter((c) => mapa.get(c.id)).map((c) => ({ carta: mapa.get(c.id), n: c.n }))
  const faltan = totalDe(cartas) - entradas.reduce((s, e) => s + e.n, 0)
  if (faltan > 0) showToast(`${faltan} ${faltan === 1 ? 'carta ya no está' : 'cartas ya no están'} en el catálogo: se prueba sin ${faltan === 1 ? 'ella' : 'ellas'}.`)
  return entradas
}

async function probarMazo(id, boton) {
  const m = mazos.find((x) => x.id === id) || (await cargarMazo(id).catch(() => null))
  if (!m) return showToast('Ese mazo no existe o es privado.', 'error')
  if (boton) boton.disabled = true
  try {
    await abrir(await entradasDe(m.cards || []), m.name)
  } catch (err) {
    showToast(`No se ha podido cargar el mazo: ${motivo(err)}.`, 'error')
  } finally {
    if (boton) boton.disabled = false
  }
}

// ── Tus mazos ──
function filaHtml({ id, nombre, total, detalle, editar }) {
  return `<li class="lp-mazo">
      <div class="lp-mazo-texto">
        <strong class="lp-mazo-nombre">${escapeHtml(nombre)}</strong>
        <span class="lp-mazo-detalle">${total}/60${detalle ? ` · ${escapeHtml(detalle)}` : ''}</span>
      </div>
      <a class="link-btn lp-mazo-editar" href="${escapeHtml(editar)}">Editar</a>
      <button type="button" class="btn-primary lp-mazo-probar" data-probar="${escapeHtml(id)}" aria-label="Probar ${escapeHtml(nombre)}">Probar</button>
    </li>`
}

async function pintarMios() {
  const caja = $('lpMios')
  const b = leerBorrador()
  // El borrador va aparte si no es un mazo guardado (o si tiene cambios):
  // es lo último que se tocó en el constructor y lo primero que se quiere
  // probar.
  const borrador = b && (!b.id || b.cambiado)
    ? filaHtml({ id: 'borrador', nombre: b.nombre || 'Mazo sin nombre', total: totalDe(b.cartas), detalle: b.id ? 'con cambios sin guardar' : 'a medias en el constructor', editar: '/constructor' })
    : ''
  if (!sesion) {
    caja.innerHTML = `${borrador ? `<ul class="lp-mazos">${borrador}</ul>` : ''}
      <p class="subtext">Tus mazos guardados salen aquí cuando entras con tu cuenta.</p>
      <div class="lp-acciones">
        <a class="btn-secondary" href="/auth.html?volver=${encodeURIComponent('/laboratorio')}">Entrar</a>
        <a class="btn-secondary" href="/constructor">Montar un mazo</a>
      </div>`
    return
  }
  try {
    mazos = await misMazos(sesion.user.id)
  } catch (err) {
    // No se ha podido preguntar: no es lo mismo que no tener ninguno.
    caja.innerHTML = `${borrador ? `<ul class="lp-mazos">${borrador}</ul>` : ''}<p class="lp-error">No se han podido cargar tus mazos: ${escapeHtml(motivo(err))}. <button type="button" class="link-btn" data-reintentar>Reintentar</button></p>`
    return
  }
  if (!mazos.length && !borrador) {
    caja.innerHTML = `<p class="subtext">Todavía no tienes mazos guardados.</p>
      <div class="lp-acciones"><a class="btn-secondary" href="/constructor">Montar un mazo</a></div>`
    return
  }
  const filas = mazos.map((m) => filaHtml({ id: m.id, nombre: m.name, total: totalDe(m.cards), detalle: '', editar: `/constructor?mazo=${m.id}` }))
  caja.innerHTML = `<ul class="lp-mazos">${borrador}${filas.join('')}</ul>`
}

// ── Una lista pegada ──
//
// Lo mismo que entiende «Importar» en el constructor: el texto de TCG Live
// o de Limitless, un enlace del constructor de Limitless o uno de aquí.
async function probarLista() {
  const texto = $('lpLista').value.trim()
  const res = $('lpResultado')
  const boton = $('lpProbarLista')
  res.classList.add('hidden')
  if (!texto) return $('lpLista').focus()
  boton.disabled = true
  boton.textContent = 'Leyendo…'
  try {
    let entradas
    if (/[?&]l=/.test(texto) && !/\s/.test(texto)) {
      const piezas = decodificarMazo(new URL(texto, location.origin).searchParams.get('l'))
      const mapa = await cartasPorIds(piezas.map((p) => p.id))
      entradas = piezas.filter((p) => mapa.get(p.id)).map((p) => ({ carta: mapa.get(p.id), n: p.n }))
    } else {
      const limitless = /limitlesstcg\.com\/builder\?i=|^1(?:[01][0-9a-zA-Z]\d\d)/.test(texto) && !/\s/.test(texto)
      const { lineas, ilegibles } = limitless
        ? { lineas: leerEnlaceLimitless(texto).map((l) => ({ n: l.n, nombre: '', set: l.set, numero: l.numero, original: `${l.n} ${l.set} ${l.numero}` })), ilegibles: [] }
        : leerLista(texto)
      if (!lineas.length) {
        res.innerHTML = '<p>No he encontrado ninguna carta. Cada línea tiene que empezar por la cantidad: «4 Dreepy TWM 128».</p>'
        res.classList.remove('hidden')
        return
      }
      const { resueltas, sinResolver } = await resolverLineas(lineas)
      entradas = resueltas.map((r) => ({ carta: r.carta, n: r.linea.n }))
      const fuera = [...sinResolver.map((l) => l.original), ...ilegibles]
      if (fuera.length) {
        res.innerHTML = `<p>Se prueba sin ${fuera.length === 1 ? 'esta línea, que no he encontrado' : `estas ${fuera.length} líneas, que no he encontrado`}:</p><ul>${fuera.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
        res.classList.remove('hidden')
      }
    }
    // Varias impresiones de la misma carta llegan como líneas distintas:
    // se juntan por id, que es como las cuenta el constructor.
    const porId = new Map()
    for (const e of entradas) porId.set(e.carta.id, { carta: e.carta, n: (porId.get(e.carta.id)?.n || 0) + e.n })
    await abrir([...porId.values()], 'Lista pegada')
  } catch (err) {
    res.innerHTML = `<p>No se ha podido leer la lista: ${escapeHtml(motivo(err))}.</p>`
    res.classList.remove('hidden')
  } finally {
    boton.disabled = false
    boton.textContent = 'Probar esta lista'
  }
}

// ── Los mazos del meta ──
//
// Los más jugados, cada uno a su ficha: allí están sus listas de verdad y
// el «Probar en el laboratorio» de cada una. Si la consulta falla, se
// queda el botón a /meta (que ya está en el HTML) y no se dice nada más:
// es un atajo, no la sección.
async function pintarMeta() {
  try {
    const [{ resumen }, { periodoDe, porcentaje, ARQUETIPO_OTROS }] = await Promise.all([import('./meta/datos.js'), import('./meta/nucleo.js')])
    // «Otros» (lo que Limitless no encaja en ningún arquetipo) no es un mazo
    // que se pueda abrir.
    const filas = (await resumen(periodoDe(null))).filter((f) => f.arquetipo !== ARQUETIPO_OTROS).slice(0, 8)
    if (!filas.length) return
    $('lpMeta').innerHTML = `<ul class="lp-meta-lista">${filas
      .map((f) => `<li><a class="lp-meta-mazo" href="/meta/${encodeURIComponent(f.arquetipo)}">${escapeHtml(f.nombre || f.arquetipo)}${f.cuota != null ? ` <span class="lp-meta-cuota">${porcentaje(f.cuota)}</span>` : ''}</a></li>`)
      .join('')}</ul>`
  } catch {
    // Sin la lista, el botón de abajo sigue llevando a /meta.
  }
}

// Una posición que llega por un enlace: la misma que abre el constructor
// (js/constructor.js, `abrirPosicionDelEnlace`).
async function abrirPosicion(id) {
  const P = await import('./constructor/posicion-compartida.js')
  let hash = location.hash
  if (id) {
    const { leerCorto } = await import('./enlace-corto.js')
    const fila = await leerCorto(id)
    if (!fila) return showToast('Este enlace no existe: ¿se copió entero?', 'error')
    if (fila.tipo !== 'posicion') return location.replace(`/repeticiones#${fila.carga}`)
    hash = `#${fila.carga}`
  }
  const x = await P.desempaquetarPosicion(hash)
  if (!x) return showToast('El enlace de la posición está roto o incompleto: ¿se cortó al copiarlo?', 'error')
  const [catalogo, { abrirPosicionCompartida }, codigoDeSet] = await Promise.all([
    cartasPorIds(P.idsDelCatalogo(x)).catch(() => new Map()),
    import('./constructor/laboratorio.js'),
    codigos(),
  ])
  await abrirPosicionCompartida({ posicion: P.expandir(x, catalogo), codigoDeSet, userId: sesion?.user?.id || null })
}

async function iniciar() {
  sesion = await getSession().catch(() => null)
  $('lpMios').addEventListener('click', (e) => {
    if (e.target.closest('[data-reintentar]')) return pintarMios()
    const b = e.target.closest('[data-probar]')
    if (!b) return
    if (b.dataset.probar !== 'borrador') return probarMazo(b.dataset.probar, b)
    const borrador = leerBorrador()
    if (!borrador) return showToast('El mazo del constructor ya no está en este navegador.', 'error')
    b.disabled = true
    entradasDe(borrador.cartas)
      .then((entradas) => abrir(entradas, borrador.nombre || 'Mazo sin nombre'))
      .catch((err) => showToast(`No se ha podido cargar el mazo: ${motivo(err)}.`, 'error'))
      .finally(() => (b.disabled = false))
  })
  $('lpProbarLista').addEventListener('click', probarLista)
  // Ctrl+Intro en la lista: probar sin ir a por el ratón.
  $('lpLista').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) probarLista()
  })
  await pintarMios()
  pintarMeta()
  const q = new URLSearchParams(location.search)
  const pos = q.get('pos')
  if (pos || location.hash.startsWith('#pos=')) {
    abrirPosicion(pos).catch((err) => showToast(`No se ha podido abrir la posición: ${motivo(err)}.`, 'error'))
  } else if (q.get('mazo')) probarMazo(q.get('mazo'))
}

iniciar()
