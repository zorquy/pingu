// «TUS COLORES» (tanda 1411, PINGU: «tu colección en colores también»; la
// propuesta con imágenes: Panel › Más › Tus colores, y «Por colores» en
// «Empezar un álbum»). Tus ilustraciones en una PARED ordenada por color, del
// rojo al morado y al final las blancas, grises y negras; tu color y el que
// menos tienes; un chip por color para ver solo esas; «Hazme un álbum con
// estas» (un binder ya ordenado, con «Ordenar la página» hecho en cada hoja) y
// «Compartir» la pared con el marco de redes.
//
// Los colores son la huella de «Sugerir» (`armonia.js`, la 1407), con su
// caché: la primera vez se mira la foto pequeña de cada ilustración y luego
// sale al momento. Solo ilustraciones (PINGU eligió lo recomendado): en una
// carta normal el color lo pone el marco de su tipo, no el arte.
//
// Es una vista del Panel (`?ver=colores`), como Estadísticas: entra por
// `import()` con `ctxPanel` y se vuelve con «‹ Panel».
import { escapeHtml } from '../app.js'
import { rutaDeCarta } from '../carta-ruta.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { rarezaCrudaDeCarta, rarezaEs } from '../rarezas-nombres.js'
import { showToast } from '../toast.js'
import { icons } from '../icons.js'
import { hojaInyectada } from '../hoja.js'
import { huellasDe, nombreDeColor, hexDe, ordenarPagina } from './armonia.js'
import { cabeceraDeVistaHtml, engancharVolver } from './movimientos.js'

const $ = (id) => document.getElementById(id)

// ── Lo puro ──

// Una ilustración: rareza de arte grande (IR, SIR, full art, galerías,
// shiny…). Se mira la rareza canónica en inglés.
const DE_ARTE = /illustration|special art|full art|art rare|character|gallery|shiny|hyper|secret|ultra rare|ace spec|radiant|amazing|super rare|trainer gallery|\bSAR\b|\bAR\b|\bSR\b|\bUR\b|\bCHR\b|\bCSR\b/i
// Y por su nombre en ESPAÑOL (tanda 1417b, PINGU con su Lugia-EX de Plasma
// Storm: «esta no sale, ¿por qué?»). El inglés tiene varias formas para lo
// mismo —«Rare Ultra» en las antiguas y no «Ultra Rare», «Rare Rainbow»—, y
// la regla de arriba solo conocía unas: la Lugia, una full art, pasaba por
// carta normal. `rarezaEs` las junta en una; se miran las dos.
const DE_ARTE_ES = /^Rara (Ultra|Ilustración|Híper|Brillante|Asombrosa|Radiante|Arcoíris|Secreta|ACE SPEC)/
export const esDeArte = (carta) => {
  const cruda = rarezaCrudaDeCarta(carta) || ''
  return DE_ARTE.test(cruda) || DE_ARTE_ES.test(rarezaEs(cruda) || '')
}

// El orden de la pared: la rueda del color y al final los neutros.
export const ORDEN = ['rojo', 'naranja', 'amarillo', 'verde', 'turquesa', 'celeste', 'azul', 'morado', 'rosa', 'marrón', 'blanco', 'gris', 'negro']
export const NEUTROS = ['blanco', 'gris', 'negro']
export const NOMBRE = { rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo', verde: 'Verde', turquesa: 'Turquesa', celeste: 'Celeste', azul: 'Azul', morado: 'Morado', rosa: 'Rosa', 'marrón': 'Marrón', blanco: 'Blanco', gris: 'Gris', negro: 'Negro' }
const tono = (l) => ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360

// EL color de una huella: el de más peso, pero un color con tono vale el
// triple que un blanco o un gris (si no, los fondos claros de media colección
// la pintan de gris: lo vio la propuesta con 62 ilustraciones reales).
export function colorDeHuella(h) {
  if (!h?.labs?.length) return null
  const v = h.labs.map((l, i) => (h.pesos[i] || 0) * (Math.hypot(l[1], l[2]) > 0.04 ? 1 : 0.3))
  const k = v.indexOf(Math.max(...v))
  const l = h.labs[k]
  return { color: nombreDeColor(l), lab: l, hex: hexDe(l), tono: tono(l) }
}

// La pared: [{ carta, color, lab, hex, tono }] en orden de rueda y, dentro de
// cada color, por tono (los neutros, de claro a oscuro).
export function paredDe(fichas) {
  const pos = (c) => (ORDEN.indexOf(c) < 0 ? ORDEN.length : ORDEN.indexOf(c))
  return [...fichas].sort((a, b) => pos(a.color) - pos(b.color) || (NEUTROS.includes(a.color) ? b.lab[0] - a.lab[0] : a.tono - b.tono))
}

// Los grupos, en orden de rueda, con su muestra (el color mediano del grupo).
export function gruposDe(pared) {
  const out = []
  for (const c of ORDEN) {
    const del = pared.filter((f) => f.color === c)
    if (del.length) out.push({ color: c, n: del.length, hex: del[Math.floor(del.length / 2)].hex })
  }
  return out
}

// Tu color y el que menos: entre los que tienen tono (un «tu color: gris» no
// dice nada de una colección).
export function resumenDe(grupos, total) {
  const vivos = grupos.filter((g) => !NEUTROS.includes(g.color))
  if (!vivos.length || !total) return null
  const pct = (g) => Math.round((g.n / total) * 100)
  const mas = [...vivos].sort((a, b) => b.n - a.n)[0]
  const menos = [...vivos].sort((a, b) => a.n - b.n)[0]
  return { mas: { ...mas, pct: pct(mas) }, menos: vivos.length > 1 ? { ...menos, pct: pct(menos) } : null }
}

// Un binder con las cartas de la pared: en su orden, y cada hoja de 9
// reordenada para que la escena siga (`ordenarPagina`, la de «Ordenar»).
export function ordenDeBinder(fichas, huellaDe, porPagina = 9, columnas = 3) {
  const out = []
  for (let i = 0; i < fichas.length; i += porPagina) {
    const trozo = fichas.slice(i, i + porPagina)
    const hs = trozo.map((f) => huellaDe(f.carta.id) || null)
    const r = trozo.length >= 3 && hs.every(Boolean) ? ordenarPagina(hs, columnas) : null
    out.push(...(r ? r.orden.map((k) => trozo[k]) : trozo))
  }
  return out
}

// ── La pantalla ──

let ctx = null
let elegido = 'todos'
let fichas = []
let huellas = new Map()

const fotoDe = (c) => {
  const cadena = cadenaDeEscaneo(c, null, 'low')
  return cadena.find((u) => u.startsWith('https://assets.tcgdex.net/')) || cadena[0] || null
}

// Tus ilustraciones, una por carta (dos copias o dos idiomas son la misma
// pared), del catálogo entero si lo hay en memoria.
function tusIlustraciones() {
  const lineas = ctx.lineasTodo?.length ? ctx.lineasTodo : ctx.lineas
  const cartaDe = ctx.lineasTodo?.length ? ctx.cartaDeLineaTodo : ctx.cartaDeLinea
  const vistas = new Map()
  for (const l of lineas || []) {
    const c = cartaDe(l)
    if (c?.id && !vistas.has(c.id) && esDeArte(c)) vistas.set(c.id, c)
  }
  return [...vistas.values()]
}

export async function abrir(c) {
  ctx = c
  const panel = $('mcPanelColores')
  if (!panel || !ctx.esMia) return
  await hojaInyectada('css/vistas-coleccion.css')
  panel.innerHTML = `${cabeceraDeVistaHtml('Tus colores')}
    <div class="vc-cuerpo" id="vcColores"><p class="mc-vista-resumen" id="vcEstado">Mirando tus ilustraciones…</p></div>`
  engancharVolver(panel, ctx)
  const cartas = tusIlustraciones()
  if (!cartas.length) {
    $('vcColores').innerHTML = '<p class="empty-state">Aquí salen tus ilustraciones (IR, SIR, full art…) ordenadas por color. Todavía no tienes ninguna en tu colección.</p>'
    return
  }
  huellas = await huellasDe(cartas, fotoDe, {
    alAvanzar: (h, t) => { const e = $('vcEstado'); if (e && h < t) e.textContent = `Mirando los colores de tus ilustraciones… ${h} de ${t}` },
  })
  fichas = paredDe(cartas.map((carta) => ({ carta, ...colorDeHuella(huellas.get(carta.id)) })).filter((f) => f.color))
  if (!fichas.length) {
    $('vcColores').innerHTML = '<p class="empty-state">No se han podido leer los colores de tus ilustraciones. Prueba otra vez en un rato.</p>'
    return
  }
  if (!panel.dataset.enganchado) {
    panel.dataset.enganchado = '1'
    panel.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-color]')
      if (chip) { elegido = chip.dataset.color; return pintar() }
      if (e.target.closest('#vcAlbum')) return void hacerAlbum()
      if (e.target.closest('#vcCompartir')) return void compartir()
    })
  }
  pintar()
}

const visibles = () => (elegido === 'todos' ? fichas : fichas.filter((f) => f.color === elegido))

function pintar() {
  const caja = $('vcColores')
  if (!caja) return
  const grupos = gruposDe(fichas)
  if (elegido !== 'todos' && !grupos.some((g) => g.color === elegido)) elegido = 'todos'
  const r = resumenDe(grupos, fichas.length)
  const ver = visibles()
  // Cuántas se quedan fuera, con número (1417): «las que no se han podido
  // leer» sin cifra hacía pensar que la pared contaba mal.
  const sinLeer = Math.max(0, tusIlustraciones().length - fichas.length)
  caja.innerHTML = `
    <p class="mc-vista-resumen"><b>${fichas.length}</b> ${fichas.length === 1 ? 'ilustración tuya' : 'ilustraciones tuyas'}, ordenadas por su color.${sinLeer ? ` ${sinLeer === 1 ? 'Hay 1 que no se ha' : `Hay ${sinLeer} que no se han`} podido leer: no tienen ninguna foto que deje mirar sus colores.` : ''}</p>
    ${r ? `<div class="vc-cifras">
      <div><span>Tu color</span><b><i style="background:${r.mas.hex}"></i>${escapeHtml(NOMBRE[r.mas.color])} · ${r.mas.pct} %</b></div>
      ${r.menos ? `<div><span>El que menos</span><b><i style="background:${r.menos.hex}"></i>${escapeHtml(NOMBRE[r.menos.color])} · ${r.menos.pct} %</b></div>` : ''}
    </div>` : ''}
    <div class="vc-rueda" aria-hidden="true">${grupos.map((g) => `<span style="flex:${g.n};background:${g.hex}"></span>`).join('')}</div>
    <div class="vc-chips" role="group" aria-label="Qué color ver">
      <button type="button" class="mc-chip-mando${elegido === 'todos' ? ' activo' : ''}" data-color="todos" aria-pressed="${elegido === 'todos'}">Todos · ${fichas.length}</button>
      ${grupos.map((g) => `<button type="button" class="mc-chip-mando${elegido === g.color ? ' activo' : ''}" data-color="${escapeHtml(g.color)}" aria-pressed="${elegido === g.color}"><i style="background:${g.hex}" aria-hidden="true"></i>${escapeHtml(NOMBRE[g.color])} · ${g.n}</button>`).join('')}
    </div>
    <ul class="vc-pared">${ver.map((f) => {
      const escaneo = atributosDeEscaneo(cadenaDeEscaneo(f.carta))
      const nombre = ctx.nombreDe(f.carta)
      return `<li><a class="mc-movida" href="${escapeHtml(rutaDeCarta(f.carta))}" data-carta="${escapeHtml(f.carta.id)}" aria-label="${escapeHtml(`${nombre}: ${NOMBRE[f.color]}`)}">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : `<span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>`}</a></li>`
    }).join('')}</ul>
    <div class="vc-acciones">
      <button type="button" class="btn-primary" id="vcAlbum">${icons.layoutGrid(16)} Hazme un álbum con ${ver.length === 1 ? 'esta' : `estas ${ver.length}`}</button>
      <button type="button" class="btn-secondary" id="vcCompartir">${icons.share(16)} Compartir</button>
    </div>`
}

async function hacerAlbum() {
  const ver = visibles()
  if (!ver.length) return
  const b = $('vcAlbum')
  if (b) b.disabled = true
  try {
    const orden = ordenDeBinder(ver, (id) => huellas.get(id))
    const nombre = elegido === 'todos' ? 'Por colores' : `Colores: ${NOMBRE[elegido]}`
    const { crearBinderCon } = await import('./albumes.js')
    const creada = await crearBinderCon({ nombre, descripcion: elegido === 'todos' ? 'Mis ilustraciones, ordenadas por color.' : `Mis ilustraciones de color ${NOMBRE[elegido].toLowerCase()}.`, ids: orden.map((f) => f.carta.id), abrirlo: false })
    showToast(`Binder «${nombre}» creado con ${orden.length} ${orden.length === 1 ? 'carta' : 'cartas'}.`, 'success')
    location.assign(`/mi-coleccion?ver=carpetas&album=${encodeURIComponent(creada.id)}`)
  } catch (err) {
    showToast(err.message || 'No se ha podido crear el álbum.', 'error')
    if (b) b.disabled = false
  }
}

async function compartir() {
  try {
    const { compartirColores } = await import('./imagen-colores.js')
    const grupos = gruposDe(fichas)
    await compartirColores({ fichas: visibles(), grupos, resumen: resumenDe(grupos, fichas.length), color: elegido === 'todos' ? null : NOMBRE[elegido] })
  } catch (err) {
    showToast(err.message || 'No se ha podido hacer la imagen.', 'error')
  }
}
