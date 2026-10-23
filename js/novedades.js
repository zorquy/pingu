// /novedades (tanda 829): lo que cambia en PokeDoc, contado corto. Arriba las
// tres destacadas del mes con su dibujo; debajo, el resto por semanas, con
// filtro por tipo. Los datos son `/novedades.json` (ver js/novedades-datos.js).
import { escapeHtml } from './html.js'
import { icons } from './icons.js'
import { TIPOS, porSemanas, destacadasDelMes, nombreDeMes, semanasNuevas, ultimaFecha, CLAVE_VISTO } from './novedades-datos.js'

const $ = (id) => document.getElementById(id)
// Cuántas semanas se ven de entrada; «Ver semanas anteriores» enseña el resto.
const SEMANAS_DE_ENTRADA = 2
// Y cuántas filas por semana: PINGU quiere «menos info»; el resto, a un toque.
const FILAS_POR_SEMANA = 6

// Los dibujos de las destacadas: una miniatura de la pantalla hecha con
// HTML, no una captura (una captura se queda vieja en cuanto la pantalla
// cambia, y pesa). Uno que no está en la lista sale con el icono del tipo.
const DIBUJOS = {
  'estanteria-jp': () => `<div class="nv-mini nv-mini-estante" aria-hidden="true">
    <span class="nv-mini-era">Original</span>
    <span class="nv-mini-fila"><i class="nv-tono-1"></i><span>Expansion Pack</span><b>450 €</b></span>
    <span class="nv-mini-fila"><i class="nv-tono-2"></i><span>Jungle</span><b>12 €</b></span>
    <span class="nv-mini-era">Neo</span>
    <span class="nv-mini-fila"><i class="nv-tono-3"></i><span>Gold, Silver, to a New World</span><b>8 €</b></span>
  </div>`,
  parejas: () => `<div class="nv-mini nv-mini-parejas" aria-hidden="true">
    <i></i><i class="nv-par"></i><i></i><i></i>
    <i></i><i></i><i class="nv-par"></i><i></i>
  </div>`,
  retos: () => `<div class="nv-mini nv-mini-estante" aria-hidden="true">
    <span class="nv-mini-era">Tu día · 4 de 6</span>
    <span class="nv-mini-fila"><i class="nv-tono-2"></i><span>¿Qué carta es?</span><b>+45 XP</b></span>
    <span class="nv-mini-fila"><i class="nv-tono-1"></i><span>¿Quién es ese Pokémon?</span><b>+20 XP</b></span>
    <span class="nv-mini-fila"><i class="nv-tono-3"></i><span>Ordena por precio</span><b>Jugar</b></span>
  </div>`,
  'sin-conexion': () => `<div class="nv-mini nv-mini-guia" aria-hidden="true">
    <span class="nv-mini-sinred">Sin conexión</span>
    <span class="nv-mini-lineas"><i style="--largo: 80%"></i><i style="--largo: 96%"></i><i style="--largo: 60%"></i><i style="--largo: 88%"></i></span>
  </div>`,
}
const FONDOS = ['rosa', 'azul', 'verde', 'ambar', 'cian', 'morado']
const ICONO_DE_TIPO = { nuevo: 'sparkles', mejora: 'trendingUp', arreglo: 'checkCircle' }

const chip = (tipo) => `<span class="nv-chip nv-${tipo}">${TIPOS[tipo].rotulo}</span>`

// Un enlace interno y nada más: lo que sale de un fichero del repo ya es de
// fiar, pero un `javascript:` no tiene por qué llegar nunca a un href.
const enlaceSeguro = (h) => (typeof h === 'string' && /^\/(?!\/)/.test(h) ? h : null)

export function destacadaHtml(d) {
  const tipo = TIPOS[d.tipo] ? d.tipo : 'nuevo'
  const fondo = FONDOS.includes(d.fondo) ? d.fondo : 'azul'
  const dibujo = DIBUJOS[d.dibujo]?.() || `<span class="nv-mini-icono" aria-hidden="true">${icons[ICONO_DE_TIPO[tipo]](48)}</span>`
  const enlace = enlaceSeguro(d.enlace)
  // `[[Arven]]` en el texto se pinta como lo que es: lo que se escribe.
  const texto = escapeHtml(d.texto || '').replace(/\[\[([^\]]+)\]\]/g, '<code>[[$1]]</code>')
  return `<article class="nv-dest">
    <div class="nv-dest-dibujo nv-fondo-${fondo}">${dibujo}</div>
    <div class="nv-dest-texto">
      ${chip(tipo)}
      <h3>${escapeHtml(d.titulo)}</h3>
      <p>${texto}</p>
      ${enlace ? `<a class="btn-secondary nv-ir" href="${escapeHtml(enlace)}">${escapeHtml(d.boton || 'Verlo')}</a>` : ''}
    </div>
  </article>`
}

export function filaHtml(e) {
  const enlace = enlaceSeguro(e.enlace)
  const dentro = `${chip(e.tipo)}<span class="nv-fila-texto">${escapeHtml(e.texto)}</span>${enlace ? '<span class="nv-ver">Ver</span>' : ''}`
  return enlace ? `<a class="nv-fila" href="${escapeHtml(enlace)}">${dentro}</a>` : `<div class="nv-fila">${dentro}</div>`
}

function leerVisto() {
  try { return localStorage.getItem(CLAVE_VISTO) } catch { return null }
}
function guardarVisto(fecha) {
  try { if (fecha) localStorage.setItem(CLAVE_VISTO, fecha) } catch { /* sin almacenamiento, sin marca */ }
}

let datos = null
let filtro = null
let todas = false
const semanasAbiertas = new Set()
// Lo que había visto AL ENTRAR: se guarda lo nuevo enseguida (para el punto
// del menú), pero la marca de esta visita sigue con lo de antes.
let vistoAlEntrar = null

function pintarLista() {
  const semanas = porSemanas(datos.entradas, filtro)
  const nuevas = semanasNuevas(porSemanas(datos.entradas), vistoAlEntrar)
  const aLaVista = todas ? semanas : semanas.slice(0, SEMANAS_DE_ENTRADA)
  $('nvLista').innerHTML = aLaVista.length
    ? aLaVista.map((s) => `<section class="nv-semana" data-semana="${s.lunes}">
        <h2 class="nv-semana-titulo">${escapeHtml(s.rotulo)}${nuevas.has(s.lunes) ? ' <span class="nv-punto">nuevo para ti</span>' : ''}</h2>
        ${(semanasAbiertas.has(s.lunes) ? s.entradas : s.entradas.slice(0, FILAS_POR_SEMANA)).map(filaHtml).join('')}
        ${!semanasAbiertas.has(s.lunes) && s.entradas.length > FILAS_POR_SEMANA ? `<button type="button" class="nv-mas-semana" data-abrir="${s.lunes}">Ver ${s.entradas.length - FILAS_POR_SEMANA} más de esta semana</button>` : ''}
      </section>`).join('')
    : `<p class="empty-state">No hay ${filtro ? TIPOS[filtro].filtro.toLowerCase() : 'novedades'} todavía.</p>`
  $('nvMas').classList.toggle('hidden', todas || semanas.length <= SEMANAS_DE_ENTRADA)
}

function pintar() {
  const { mes, lista } = destacadasDelMes(datos.destacadas)
  $('nvDestacadasSeccion').classList.toggle('hidden', !lista.length)
  if (lista.length) {
    $('nvDestacadasTitulo').textContent = `Lo mejor de ${nombreDeMes(mes)}`
    $('nvDestacadas').innerHTML = lista.map(destacadaHtml).join('')
  }
  $('nvFiltros').innerHTML = [['', 'Todo'], ...Object.entries(TIPOS).map(([k, t]) => [k, t.filtro])]
    .map(([k, t]) => `<button type="button" class="chip-filtro nv-filtro" data-tipo="${k}" aria-pressed="${(filtro || '') === k}">${t}</button>`)
    .join('')
  $('nvFiltros').classList.remove('hidden')
  pintarLista()
}

async function arrancar() {
  vistoAlEntrar = leerVisto()
  try {
    const res = await fetch('/novedades.json', { cache: 'no-cache' })
    if (!res.ok) throw new Error(String(res.status))
    datos = await res.json()
  } catch {
    $('nvCargando').classList.add('hidden')
    $('nvError').classList.remove('hidden')
    return
  }
  $('nvCargando').classList.add('hidden')
  if (datos.foro && enlaceSeguro(datos.foro)) $('nvForo').href = datos.foro
  pintar()
  guardarVisto(ultimaFecha(datos.entradas))
}

function alPulsar(ev) {
  const b = ev.target.closest('.nv-filtro')
  if (b && datos) {
    filtro = b.dataset.tipo || null
    for (const x of document.querySelectorAll('.nv-filtro')) x.setAttribute('aria-pressed', String(x === b))
    pintarLista()
    return
  }
  const abrir = ev.target.closest('[data-abrir]')
  if (abrir && datos) {
    semanasAbiertas.add(abrir.dataset.abrir)
    pintarLista()
    return
  }
  if (ev.target.closest('#nvMas') && datos) {
    todas = true
    pintarLista()
  }
}

// Lo que toca la página solo corre en la página (así node puede probar lo
// de arriba sin un `document`).
if (typeof document !== 'undefined' && $('nvLista')) {
  document.addEventListener('click', alPulsar)
  arrancar()
}
