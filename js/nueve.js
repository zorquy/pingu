// Mis 9 cartas (tanda 566): nueve huecos, un buscador y una imagen para
// compartir. El porqué largo, en SCHEMA.md.
//
// Se juega SIN cuenta: lo elegido vive en el navegador. Si para empezar
// hubiera que registrarse, nadie empezaría — la cuenta se pide al final,
// cuando ya tienes algo que querrías conservar.
import { supabase } from './supabase.js'
import { escapeHtml, getSession, getProfile } from './app.js'
import { showToast } from './toast.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta, nombreDeSet } from './catalogo-series.js'
import { normalizeSearch } from './texto.js'
import { MERCADOS_VISIBLES, NOMBRE_MERCADO, MERCADO_POR_DEFECTO } from './mercados.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pokedoc-nueve'
const HUECOS = 9
// Lo justo para pintar un hueco, un resultado y la imagen. Sin `rarity`:
// no se enseña, y pedirla obliga a pedir también `rarity_en` (tanda 523).
const COLUMNAS = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,tcg_sets(name,name_en,tcg_online_code)'

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
let setsPorMercado = new Map()

async function setsDe(mercado) {
  if (setsPorMercado.has(mercado)) return setsPorMercado.get(mercado)
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('id,name,name_en,release_date')
    .eq('market', mercado)
    .order('release_date', { ascending: false, nullsFirst: false })
    .limit(600)
  if (error) {
    showToast(error.message, 'error')
    return []
  }
  setsPorMercado.set(mercado, data || [])
  return data || []
}

async function pintarSets() {
  const mercado = $('nvMercado').value
  const sets = await setsDe(mercado)
  $('nvSet').innerHTML =
    '<option value="">Todas</option>' + sets.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(nombreDeSet(s) || s.id)}</option>`).join('')
}

async function buscar() {
  const mercado = $('nvMercado').value
  const set = $('nvSet').value
  // NFC después de normalizar (tanda 557): sin él, una búsqueda en
  // japonés con dakuten no casa con lo que guarda Postgres.
  const texto = normalizeSearch($('nvBuscar').value).normalize('NFC').trim()
  const palabras = texto.split(/\s+/).filter(Boolean).slice(0, 4)
  if (!palabras.length && !set) {
    $('nvResultados').innerHTML = '<p class="subtext">Escribe un nombre o elige una expansión.</p>'
    return
  }
  let q = supabase.from('tcg_cards').select(COLUMNAS).eq('market', mercado)
  if (set) q = q.eq('set_id', set)
  for (const p of palabras) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  const { data, error } = await q.order('name_search').limit(60)
  if (error) {
    $('nvResultados').innerHTML = `<p class="subtext">No se ha podido buscar: ${escapeHtml(error.message)}</p>`
    return
  }
  if (!data?.length) {
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

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('no carga'))
    img.src = url
  })
}

async function fotoParaElLienzo(c) {
  for (const url of fotos(c, 'high')) {
    try {
      return await cargarImagen(url)
    } catch {
      // sin permiso o sin foto: por nuestra función
    }
    try {
      return await cargarImagen(`/.netlify/functions/imagen-carta?u=${encodeURIComponent(url)}`)
    } catch {
      // la siguiente de la cadena
    }
  }
  return null
}

function redondeado(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

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
    const imagenes = await Promise.all(mias.map((c) => (c ? fotoParaElLienzo(c) : null)))
    if (pintando !== tarea) return
    mias.forEach((c, i) => {
      const x = x0 + (i % 3) * (cw + hueco)
      const y = y0 + Math.floor(i / 3) * (ch + hueco)
      ctx.save()
      redondeado(ctx, x, y, cw, ch, 14)
      ctx.clip()
      if (imagenes[i]) {
        ctx.drawImage(imagenes[i], x, y, cw, ch)
      } else {
        ctx.fillStyle = '#2a3a4c'
        ctx.fillRect(x, y, cw, ch)
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 26px Inter, sans-serif'
        ctx.fillText(c ? nombreDeCarta(c) : '', x + cw / 2, y + ch / 2)
      }
      ctx.restore()
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

function comoBlob() {
  return new Promise((resolve, reject) => {
    try {
      $('nvLienzo').toBlob((b) => (b ? resolve(b) : reject(new Error('sin imagen'))), 'image/png')
    } catch (err) {
      reject(err)
    }
  })
}

async function descargar() {
  try {
    const blob = await comoBlob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nombreDelFichero()
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  } catch {
    showToast('No se ha podido generar la imagen. Prueba a cambiar alguna carta.', 'error')
  }
}

async function compartir() {
  try {
    const blob = await comoBlob()
    const fichero = new File([blob], nombreDelFichero(), { type: 'image/png' })
    const texto = 'Mis 9 cartas favoritas de Pokémon TCG. ¿Cuáles son las tuyas? pokedoc.es/nueve'
    if (navigator.canShare?.({ files: [fichero] })) {
      await navigator.share({ files: [fichero], text: texto })
      return
    }
    // Sin menú de compartir (escritorio): se descarga y se abre X con el
    // texto puesto, que es lo más cerca que se puede llegar.
    await descargar()
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  } catch (err) {
    if (err?.name === 'AbortError') return
    showToast('No se ha podido compartir. Prueba a descargar la imagen.', 'error')
  }
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
