// Mis 9 cartas (tanda 566): nueve huecos, un buscador y una imagen para
// compartir. El porqué largo, en SCHEMA.md.
//
// Se juega SIN cuenta: lo elegido vive en el navegador. Si para empezar
// hubiera que registrarse, nadie empezaría — la cuenta se pide al final,
// cuando ya tienes algo que querrías conservar.
import { escapeHtml, getSession, getProfile } from './app.js'
import { showToast } from './toast.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { setsDelMercado, buscarEnCatalogo } from './catalogo-buscar.js'
import { fotoParaElLienzo, dibujarCarta, descargarLienzo, compartirLienzo } from './imagen-compartir.js'
import { MERCADOS_VISIBLES, NOMBRE_MERCADO, MERCADO_POR_DEFECTO } from './mercados.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pokedoc-nueve'
const HUECOS = 9

// ── Lo elegido ──
let huecos = Array(HUECOS).fill(null)
let huecoActivo = -1
let yo = null

function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (Array.isArray(guardado) && guardado.length === HUECOS) huecos = guardado
  } catch {
    // Un JSON roto en el navegador no es motivo para no jugar: se empieza
    // de cero.
  }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(huecos))
  } catch {
    // Sin sitio o en privado: la partida sigue en memoria.
  }
}

// ── La foto de una carta ──
//
// La cadena de siempre (`cadenaDeEscaneo`), que ya sabe de Scrydex, de
// TCGdex y de Limitless. Para el hueco vale la pequeña; para la imagen
// que se comparte, la grande.
const fotos = (c, calidad = 'low') => cadenaDeEscaneo(c, c?.tcg_sets?.tcg_online_code || null, calidad)

function fotoHtml(c, clase) {
  const [primera, ...resto] = fotos(c)
  if (!primera) return ''
  const salto =
    "var r=(this.dataset.respaldos||'').split(' ').filter(Boolean);" +
    "if(r.length){this.src=r.shift();this.dataset.respaldos=r.join(' ')}else{this.remove()}"
  return `<img class="${clase}" src="${primera}"${resto.length ? ` data-respaldos="${resto.join(' ')}"` : ''} onerror="${salto}" alt="" width="245" height="342" loading="lazy" />`
}

// ── Los huecos ──
function pintarHuecos() {
  $('nvRejilla').innerHTML = huecos
    .map((c, i) => {
      if (!c) {
        return `<button type="button" class="nv-hueco" data-hueco="${i}" aria-label="Hueco ${i + 1}: elegir una carta"><span class="nv-hueco-mas" aria-hidden="true">+</span></button>`
      }
      return `<button type="button" class="nv-hueco lleno" data-hueco="${i}" aria-label="Hueco ${i + 1}: ${escapeHtml(nombreDeCarta(c))}, ${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)}">
        <span class="nv-hueco-nombre">${escapeHtml(nombreDeCarta(c))}</span>
        ${fotoHtml(c, 'nv-hueco-foto')}
        <span class="nv-hueco-num" aria-hidden="true">${i + 1}</span>
      </button>`
    })
    .join('')
  const llenos = huecos.filter(Boolean).length
  // Compartir pide las nueve: una imagen con huecos vacíos no es «mis 9».
  $('nvCompartir').disabled = llenos < HUECOS
  $('nvDescargar').disabled = llenos < HUECOS
  $('nvAviso').textContent =
    llenos === HUECOS
      ? 'Las nueve están. Mira cómo queda la imagen y compártela.'
      : llenos
        ? `${llenos} de 9. Toca un hueco para seguir.`
        : 'Toca un hueco para elegir una carta. Se guardan en este navegador.'
  if (llenos === HUECOS) void pintarImagen()
  else $('nvVista').hidden = true
}

// ── El buscador ──
let esperaBusqueda = null

async function pintarSets() {
  const mercado = $('nvMercado').value
  const sets = await setsDelMercado(mercado).catch((e) => {
    showToast(e.message, 'error')
    return []
  })
  $('nvSet').innerHTML =
    '<option value="">Todas</option>' + sets.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(nombreDeSet(s) || s.id)}</option>`).join('')
}

async function buscar() {
  let data
  try {
    data = await buscarEnCatalogo({ mercado: $('nvMercado').value, set: $('nvSet').value, texto: $('nvBuscar').value })
  } catch (error) {
    $('nvResultados').innerHTML = `<p class="subtext">No se ha podido buscar: ${escapeHtml(error.message)}</p>`
    return
  }
  if (data === null) {
    $('nvResultados').innerHTML = '<p class="subtext">Escribe un nombre o elige una expansión.</p>'
    return
  }
  if (!data.length) {
    $('nvResultados').innerHTML = '<p class="subtext">No encuentro ninguna carta así.</p>'
    return
  }
  buscar.ultimas = new Map(data.map((c) => [c.id, c]))
  $('nvResultados').innerHTML = data
    .map(
      (c) => `<button type="button" class="nv-resultado" data-elegir="${escapeHtml(c.id)}" aria-label="${escapeHtml(nombreDeCarta(c))}, ${escapeHtml(nombreDeSet(c.tcg_sets) || c.set_id)} ${escapeHtml(c.local_id)}">
        ${fotoHtml(c, 'nv-resultado-foto')}
        <span class="nv-resultado-pie">${escapeHtml(nombreDeCarta(c))} · ${escapeHtml(c.local_id)}</span>
      </button>`
    )
    .join('')
}

function abrirBuscador(i) {
  huecoActivo = i
  const d = $('nvElegir')
  if (!d.open) d.showModal()
  $('nvBuscar').focus()
}

function elegir(id) {
  const c = buscar.ultimas?.get(id)
  if (!c || huecoActivo < 0) return
  huecos[huecoActivo] = c
  huecoActivo = -1
  guardar()
  $('nvElegir').close()
  pintarHuecos()
}

// ── Un hueco lleno: cambiar, mover, quitar ──
function menuDeHueco(i) {
  const d = $('nvHuecoMenu')
  d.returnValue = ''
  d.showModal()
  d.addEventListener(
    'close',
    () => {
      const que = d.returnValue
      if (que === 'cambiar') return abrirBuscador(i)
      if (que === 'quitar') huecos[i] = null
      if (que === 'izquierda' && i > 0) [huecos[i - 1], huecos[i]] = [huecos[i], huecos[i - 1]]
      if (que === 'derecha' && i < HUECOS - 1) [huecos[i + 1], huecos[i]] = [huecos[i], huecos[i + 1]]
      if (que) {
        guardar()
        pintarHuecos()
      }
    },
    { once: true }
  )
}

// ── La imagen ──
//
// 1080 × 1350, que es el retrato de Instagram y se ve entero en X. Se
// dibuja en el navegador con un canvas; una imagen de otro dominio solo
// se puede dibujar si ese dominio da permiso (CORS), así que cada foto se
// prueba directa y, si no deja, por nuestra función `imagen-carta`, que
// la sirve con el permiso puesto. Si tampoco, el nombre en su hueco: una
// imagen con un hueco en blanco no se comparte.
const ANCHO = 1080
const ALTO = 1350

let pintando = null
async function pintarImagen() {
  const lienzo = $('nvLienzo')
  const ctx = lienzo.getContext('2d')
  const mias = huecos.slice()
  const tarea = (pintando = (async () => {
    // Los colores van a pelo porque esto NO es la página: es una imagen
    // que se ve en Instagram, y allí no hay tema claro ni oscuro.
    await document.fonts.ready
    ctx.fillStyle = '#10141c'
    ctx.fillRect(0, 0, ANCHO, ALTO)
    const grad = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
    grad.addColorStop(0, '#1e5175')
    grad.addColorStop(1, '#10141c')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, ANCHO, ALTO)
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = '700 64px Fredoka, Inter, sans-serif'
    ctx.fillText('Mis 9 cartas', ANCHO / 2, 92)
    ctx.font = '500 30px Inter, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.fillText(yo?.username ? `de @${yo.username} · Pokémon TCG` : 'favoritas de Pokémon TCG', ANCHO / 2, 138)
    // Tres por tres, con la proporción de una carta. A 252 de ancho las
    // tres filas acaban en 1292 y dejan sitio al pie: con 270, la tercera
    // fila se salía por abajo y el «pokedoc.es» caía encima de las cartas
    // (se vio en la primera imagen generada).
    const cw = 252
    const ch = Math.round((cw * 342) / 245)
    const hueco = 30
    const x0 = (ANCHO - (cw * 3 + hueco * 2)) / 2
    const y0 = 176
    const imagenes = await Promise.all(mias.map((c) => (c ? fotoParaElLienzo(fotos(c, 'high')) : null)))
    if (pintando !== tarea) return
    mias.forEach((c, i) => {
      const x = x0 + (i % 3) * (cw + hueco)
      const y = y0 + Math.floor(i / 3) * (ch + hueco)
      dibujarCarta(ctx, imagenes[i], { x, y, w: cw, h: ch, nombre: c ? nombreDeCarta(c) : '' })
    })
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '700 34px Fredoka, Inter, sans-serif'
    ctx.fillText('pokedoc.es/nueve', ANCHO / 2, ALTO - 26)
    $('nvVista').hidden = false
  })())
  await tarea
}

function nombreDelFichero() {
  return `mis-9-cartas${yo?.username ? `-${yo.username}` : ''}.png`
}

function descargar() {
  return descargarLienzo($('nvLienzo'), nombreDelFichero())
}

function compartir() {
  return compartirLienzo($('nvLienzo'), {
    nombreFichero: nombreDelFichero(),
    texto: 'Mis 9 cartas favoritas de Pokémon TCG. ¿Cuáles son las tuyas? pokedoc.es/nueve',
  })
}

// ── Arranque ──
async function init() {
  cargar()
  $('nvMercado').innerHTML = MERCADOS_VISIBLES.map((m) => `<option value="${m}"${m === MERCADO_POR_DEFECTO ? ' selected' : ''}>${escapeHtml(NOMBRE_MERCADO[m])}</option>`).join('')
  pintarHuecos()
  void pintarSets()

  $('nvRejilla').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hueco]')
    if (!b) return
    const i = Number(b.dataset.hueco)
    if (huecos[i]) menuDeHueco(i)
    else abrirBuscador(i)
  })
  $('nvBuscar').addEventListener('input', () => {
    clearTimeout(esperaBusqueda)
    esperaBusqueda = setTimeout(buscar, 250)
  })
  $('nvMercado').addEventListener('change', async () => {
    await pintarSets()
    buscar()
  })
  $('nvSet').addEventListener('change', buscar)
  $('nvResultados').addEventListener('click', (e) => {
    const b = e.target.closest('[data-elegir]')
    if (b) elegir(b.dataset.elegir)
  })
  // Pulsar fuera cierra el diálogo (el formulario de dentro lo cierra con
  // la ✕ por `method="dialog"`).
  $('nvElegir').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.close()
  })
  // Escape CIERRA el diálogo también con el cursor en el buscador (tanda
  // 573). Un `<input type="search" enterkeyhint="search">` se queda la tecla para borrar el
  // texto, y el diálogo no se enteraba: la gente pulsaba Escape y se
  // quedaba dentro con la caja vacía.
  $('nvElegir').addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.currentTarget.close()
  })
  $('nvCompartir').addEventListener('click', compartir)
  $('nvDescargar').addEventListener('click', descargar)

  // Con cuenta, la imagen lleva tu nombre. Sin ella, se juega igual.
  try {
    const sesion = await getSession()
    if (sesion?.user) {
      yo = await getProfile(sesion.user.id)
      if (huecos.filter(Boolean).length === HUECOS) void pintarImagen()
    }
  } catch {
    // sin sesión
  }
}

init()
