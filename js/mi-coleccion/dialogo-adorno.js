// El diálogo de «cómo quieres que se vea» (tanda 411).
//
// PINGU: «cuando vayas a crear una carpeta que te salga un pop-up para
// elegir cómo quieres crearla: un emoji, o un sprite de la Pokédex, o un
// color de fondo. Para los álbumes lo mismo; la única diferencia es que
// uno es una carpeta y otro es un álbum».
//
// Por eso el diálogo es UNO y no dos: lo único que cambia entre los dos
// es el título y la palabra del botón, y dos diálogos que se parecen
// acaban siendo dos que ya no se parecen.
import { ICONOS, EMOJIS, COLORES, colorDe, iconoHtml } from './adorno.js'
import { icons } from '../icons.js'
import { urlDeSprite, atributosDeRespaldo } from '../torneos/sprites-pokemon.js'
import { POKEMON_POR_DEX } from '../pokedex-especies.js'

const $ = (id) => document.getElementById(id)
const escapeHtml = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Cuántos Pokémon se pintan de una vez. Son 1.025 y cada uno es una
// imagen: pintarlos todos es pedir mil imágenes para elegir una.
const DE_GOLPE = 60

let estado = null

export function iniciarDialogoAdorno() {
  $('mcDlgTabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pestania-adorno]')
    if (b) verPestania(b.dataset.pestaniaAdorno)
  })
  $('mcDlgIconos').addEventListener('click', (e) => elegir(e, 'icono'))
  $('mcDlgEmojis').addEventListener('click', (e) => elegir(e, 'emoji'))
  $('mcDlgDexRejilla').addEventListener('click', (e) => elegir(e, 'dex_id'))
  $('mcDlgColores').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]')
    if (!b) return
    // Volver a pulsar el que ya está puesto lo quita: así se vuelve al
    // color automático sin tener que adivinar cuál era.
    estado.valores.color = estado.valores.color === b.dataset.color ? null : b.dataset.color
    pintar()
  })
  $('mcDlgDexBuscar').addEventListener('input', pintarDex)
  $('mcDlgCerrar').addEventListener('click', () => $('mcDlgAdorno').close())
  $('mcDlgCancelar').addEventListener('click', () => $('mcDlgAdorno').close())
  $('mcDlgBorrar').addEventListener('click', () => {
    const borrar = estado.alBorrar
    $('mcDlgAdorno').close()
    borrar?.()
  })
  $('mcDlgForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const nombre = $('mcDlgNombre').value.trim()
    if (!nombre) return $('mcDlgNombre').focus()
    const { valores, alGuardar } = estado
    $('mcDlgAdorno').close()
    alGuardar({ ...valores, nombre })
  })
  // Pulsar fuera cierra, como las demás ventanas de la pantalla.
  $('mcDlgAdorno').addEventListener('click', (e) => {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    const dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (!dentro) e.currentTarget.close()
  })
}

// `valores` es lo que ya tiene (al editar) o nada (al crear).
export function abrirDialogoAdorno({ titulo, boton, valores = {}, alGuardar, alBorrar = null, conOrigen = false }) {
  estado = { valores: { icono: null, dex_id: null, emoji: null, color: null, ...valores }, alGuardar, alBorrar }
  // El borrar solo existe al EDITAR: en «nueva carpeta» no hay nada que
  // borrar y un botón apagado al lado del de crear solo confunde.
  $('mcDlgBorrar').classList.toggle('hidden', !alBorrar)
  $('mcDlgOrigen').classList.toggle('hidden', !conOrigen)
  $('mcDlgTitulo').textContent = titulo
  $('mcDlgGuardar').textContent = boton
  $('mcDlgNombre').value = valores.nombre || ''
  $('mcDlgDexBuscar').value = ''
  verPestania(estado.valores.dex_id ? 'dex' : estado.valores.emoji ? 'emoji' : 'icono')
  pintar()
  $('mcDlgAdorno').showModal()
  $('mcDlgNombre').focus()
}

function elegir(e, campo) {
  const b = e.target.closest('[data-valor]')
  if (!b) return
  // Uno de los tres, nunca dos: el adorno es UNA cosa, y dejar el emoji
  // puesto por debajo del Pokémon haría que al quitar el Pokémon
  // reapareciera un emoji que nadie recuerda haber elegido.
  estado.valores.icono = null
  estado.valores.dex_id = null
  estado.valores.emoji = null
  estado.valores[campo] = campo === 'dex_id' ? Number(b.dataset.valor) : b.dataset.valor
  pintar()
}

function verPestania(cual) {
  for (const b of $('mcDlgTabs').querySelectorAll('[data-pestania-adorno]')) {
    const activa = b.dataset.pestaniaAdorno === cual
    b.classList.toggle('activo', activa)
    b.setAttribute('aria-selected', String(activa))
  }
  $('mcDlgIconos').classList.toggle('hidden', cual !== 'icono')
  $('mcDlgEmojis').classList.toggle('hidden', cual !== 'emoji')
  $('mcDlgDex').classList.toggle('hidden', cual !== 'dex')
  if (cual === 'dex') pintarDex()
}

function pintar() {
  const v = estado.valores
  // La vista previa es la MISMA burbuja que se va a ver luego, no un
  // dibujo parecido: si fuera otra cosa, elegir a ciegas.
  $('mcDlgVista').innerHTML = `<span class="mc-burbuja-cabecera" style="--burbuja-color:${escapeHtml(colorDe(v))}">${iconoHtml(v, 56)}</span>`
  $('mcDlgIconos').innerHTML = ICONOS.map(
    (n) => `<button type="button" class="mc-dlg-opcion${v.icono === n ? ' activa' : ''}" data-valor="${n}" aria-label="${n}">${icons[n](22)}</button>`
  ).join('')
  $('mcDlgEmojis').innerHTML = EMOJIS.map(
    (x) => `<button type="button" class="mc-dlg-opcion${v.emoji === x ? ' activa' : ''}" data-valor="${escapeHtml(x)}">${escapeHtml(x)}</button>`
  ).join('')
  $('mcDlgColores').innerHTML =
    `<button type="button" class="mc-dlg-color${v.color ? '' : ' activa'}" data-color="" aria-label="Automático, según el icono"><span style="background:${escapeHtml(colorDe({ ...v, color: null }))}"></span>auto</button>` +
    COLORES.map(
      (c) => `<button type="button" class="mc-dlg-color${v.color === c ? ' activa' : ''}" data-color="${c}" aria-label="Color ${c}"><span style="background:${c}"></span></button>`
    ).join('')
}

function pintarDex() {
  const texto = sinTildes($('mcDlgDexBuscar').value.trim())
  const v = estado.valores
  const filas = []
  for (let i = 0; i < POKEMON_POR_DEX.length && filas.length < DE_GOLPE; i++) {
    const nombre = POKEMON_POR_DEX[i]
    const dex = i + 1
    if (texto && !sinTildes(nombre).includes(texto) && String(dex) !== texto) continue
    filas.push({ dex, nombre })
  }
  $('mcDlgDexRejilla').innerHTML = filas.length
    ? filas
        .map(({ dex, nombre }) => {
          const url = urlDeSprite(dex)
          return `<button type="button" class="mc-dlg-opcion${v.dex_id === dex ? ' activa' : ''}" data-valor="${dex}" title="${escapeHtml(nombre)}" aria-label="${escapeHtml(nombre)}">
            ${url ? `<img src="${escapeHtml(url)}" alt="" width="28" height="28" loading="lazy" ${atributosDeRespaldo(url)} />` : escapeHtml(nombre.slice(0, 2))}
          </button>`
        })
        .join('')
    : '<p class="subtext">Ningún Pokémon con ese nombre.</p>'
}
