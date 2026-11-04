// /novedades (tanda 829): lo que cambia en PokeDoc, contado corto. Arriba las
// tres destacadas del mes como portadas (1217: con su Pokémon); debajo, el resto por semanas, con
// filtro por tipo. Los datos son `/novedades.json` (ver js/novedades-datos.js).
import { escapeHtml } from './html.js'
import { TIPOS, porSemanas, destacadasDelMes, nombreDeMes, semanasNuevas, ultimaFecha, CLAVE_VISTO, cuentasDelMes } from './novedades-datos.js'

const $ = (id) => document.getElementById(id)
// Cuántas semanas se ven de entrada; «Ver semanas anteriores» enseña el resto.
const SEMANAS_DE_ENTRADA = 2
// Y cuántas filas por semana: PINGU quiere «menos info»; el resto, a un toque.
const FILAS_POR_SEMANA = 6

const FONDOS = ['rosa', 'azul', 'verde', 'ambar', 'cian', 'morado']

const chip = (tipo) => `<span class="nv-chip nv-${tipo}">${TIPOS[tipo].rotulo}</span>`

// Un enlace interno y nada más: lo que sale de un fichero del repo ya es de
// fiar, pero un `javascript:` no tiene por qué llegar nunca a un href.
const enlaceSeguro = (h) => (typeof h === 'string' && /^\/(?!\/)/.test(h) ? h : null)

// LAS DESTACADAS COMO PORTADAS (1217, la maqueta de «La web como la
// portada»): un Pokémon grande sobre el color de su fondo, el tipo y el
// titular encima, y toda la portada lleva a su sitio. El Pokémon es el de
// `pokemon` (su número de la Pokédex) o, si la entrada no dice, uno de la
// lista elegido por el título: siempre el mismo para la misma novedad.
const ARTE = 'sprites/pokemon/other/official-artwork'
const POKEMON_DE_PORTADA = [445, 7, 151, 6, 25, 94, 197, 448, 658, 887, 384, 249, 133, 282, 1008, 4, 1]
export function pokemonDe(d) {
  const n = Number(d?.pokemon)
  if (Number.isInteger(n) && n > 0 && n < 1100) return n
  let h = 0
  for (const ch of String(d?.titulo || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0
  return POKEMON_DE_PORTADA[h % POKEMON_DE_PORTADA.length]
}
export function destacadaHtml(d) {
  const tipo = TIPOS[d.tipo] ? d.tipo : 'nuevo'
  const fondo = FONDOS.includes(d.fondo) ? d.fondo : 'azul'
  const enlace = enlaceSeguro(d.enlace)
  const dex = pokemonDe(d)
  // `[[Arven]]` en el texto se pinta como lo que es: lo que se escribe.
  const texto = escapeHtml(d.texto || '').replace(/\[\[([^\]]+)\]\]/g, '<code>[[$1]]</code>')
  const etiqueta = enlace ? 'a' : 'div'
  // La foto: jsDelivr y, si no contesta, GitHub a pelo (la cadena de la 321);
  // sin las dos, se queda el color.
  const foto = `<img class="nv-dest-arte" src="https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/${ARTE}/${dex}.png" alt="" width="240" height="240" loading="lazy" decoding="async" onerror="if(!this.dataset.r){this.dataset.r=1;this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/${ARTE}/${dex}.png'}else{this.remove()}" />`
  return `<article class="nv-dest nv-dest-portada">
    <${etiqueta} class="nv-dest-dibujo nv-fondo-${fondo}"${enlace ? ` href="${escapeHtml(enlace)}"` : ''}>
      ${foto}
      <span class="nv-dest-texto">
        ${chip(tipo)}
        <h3>${escapeHtml(d.titulo)}</h3>
        <span class="sr-only">${texto}</span>
      </span>
    </${etiqueta}>
  </article>`
}

export function filaHtml(e) {
  const enlace = enlaceSeguro(e.enlace)
  const dentro = `${chip(e.tipo)}<span class="nv-fila-texto">${escapeHtml(e.texto)}</span>${enlace ? '<span class="nv-ver">Ver</span>' : ''}`
  // `nv-fila-<tipo>`: el punto de su color en la línea del tiempo (1210).
  const clase = `nv-fila nv-fila-${TIPOS[e.tipo] ? e.tipo : 'mejora'}`
  return enlace ? `<a class="${clase}" href="${escapeHtml(enlace)}">${dentro}</a>` : `<div class="${clase}">${dentro}</div>`
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

// Lo de cada semana en cifras, al lado de su rótulo (1215, de la propuesta:
// «la semana con sus cuentas»): «3 nuevas · 28 mejoras · 10 arreglos», cada
// una con el punto de su color.
function cuentaDeSemana(entradas) {
  const n = (t) => entradas.filter((e) => e.tipo === t).length
  const partes = [['nuevo', n('nuevo'), 'nueva', 'nuevas'], ['mejora', n('mejora'), 'mejora', 'mejoras'], ['arreglo', n('arreglo'), 'arreglo', 'arreglos']]
    .filter(([, k]) => k)
    .map(([t, k, uno, varios]) => `<span class="nv-cuenta nv-cuenta-${t}">${k} ${k === 1 ? uno : varios}</span>`)
  return partes.length ? `<span class="nv-cuentas">${partes.join('')}</span>` : ''
}

function pintarLista() {
  const semanas = porSemanas(datos.entradas, filtro)
  const nuevas = semanasNuevas(porSemanas(datos.entradas), vistoAlEntrar)
  const aLaVista = todas ? semanas : semanas.slice(0, SEMANAS_DE_ENTRADA)
  $('nvLista').innerHTML = aLaVista.length
    // La semana a la izquierda con sus cuentas debajo, y sus novedades a la
    // derecha en una línea de tiempo (1217, la maqueta).
    ? aLaVista.map((s) => `<section class="nv-semana en-cascada" data-semana="${s.lunes}">
        <h2 class="nv-semana-titulo"><span class="nv-semana-rotulo">${escapeHtml(s.rotulo)}</span>${nuevas.has(s.lunes) ? ' <span class="nv-punto">nuevo para ti</span>' : ''}${cuentaDeSemana(s.entradas)}</h2>
        <div class="nv-semana-lineas">
        ${(semanasAbiertas.has(s.lunes) ? s.entradas : s.entradas.slice(0, FILAS_POR_SEMANA)).map(filaHtml).join('')}
        ${!semanasAbiertas.has(s.lunes) && s.entradas.length > FILAS_POR_SEMANA ? `<button type="button" class="nv-mas-semana" data-abrir="${s.lunes}">Ver ${s.entradas.length - FILAS_POR_SEMANA} más de esta semana</button>` : ''}
        </div>
      </section>`).join('')
    : `<p class="empty-state">No hay ${filtro ? TIPOS[filtro].filtro.toLowerCase() : 'novedades'} todavía.</p>`
  $('nvMas').classList.toggle('hidden', todas || semanas.length <= SEMANAS_DE_ENTRADA)
}

function pintar() {
  const c = cuentasDelMes(datos.entradas)
  for (const [id, n] of [['nvNMes', c.total], ['nvNNuevo', c.nuevo], ['nvNArreglo', c.arreglo]]) $(id).textContent = String(n)
  const { mes, lista } = destacadasDelMes(datos.destacadas)
  $('nvDestacadasSeccion').classList.toggle('hidden', !lista.length)
  if (lista.length) {
    $('nvDestacadasTitulo').textContent = `Lo mejor de ${nombreDeMes(mes)}`
    $('nvDestacadas').innerHTML = lista.map(destacadaHtml).join('')
    // «Imagen para redes», solo para el equipo (1157): por import(), así
    // quien no es del equipo no baja el marco.
    import('./novedad-imagen.js').then((m) => m.montarImagenParaRedes(lista)).catch(() => {})
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
  if (datos.foro && enlaceSeguro(datos.foro)) for (const id of ['nvForo', 'nvForoPie']) $(id).href = datos.foro
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
