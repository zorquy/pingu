// «TUS COLORES» (tanda 1411, PINGU: «tu colección en colores también»; la
// propuesta con imágenes: Panel › Más › Tus colores, y «Por colores» en
// «Empezar un álbum»). Tus ilustraciones en una PARED ordenada por color, del
// rojo al morado y al final las blancas, grises y negras; tu color y el que
// menos tienes; un chip por color para ver solo esas; «Hazme un álbum con
// estas» (un binder ya ordenado, con «Ordenar la página» hecho en cada hoja) y
// «Compartir» la pared con el marco de redes.
//
// Los colores salen de la huella de «Sugerir» (`armonia.js`, la 1407), con
// su caché: la primera vez se mira la foto pequeña de cada ilustración y luego
// sale al momento. Solo ilustraciones (PINGU eligió lo recomendado): en una
// carta normal el color lo pone el marco de su tipo, no el arte.
//
// Desde la 1418 (PINGU con su binder delante: «los colores no están casando»)
// el color es el VOTO POR PÍXEL de `color-de-carta.js`, con Multicolor,
// Claras y Oscuras; las energías no entran; y la pared son HOJAS de nueve con
// la paleta parecida, las mismas que salen en el álbum.
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
import { huellasDe, hexDe, ordenarPagina } from './armonia.js'
import { hojasDe, hexDeColores, fondoDeGrupo, NEUTROS, APARTE } from './color-de-carta.js'
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
// Las energías no entran aunque sean doradas o full art (1418, PINGU: «las
// energías yo no las contaría»): son casi de un color plano y rompían las
// hojas. Sin categoría (alguna japonesa), por el nombre.
export const esEnergia = (carta) => carta?.category === 'Energy' || (!carta?.category && /\b(Energy|Energía)\b/i.test(`${carta?.name || ''} ${carta?.name_en || ''}`))
export const entraEnColores = (carta) => esDeArte(carta) && !esEnergia(carta)

// El orden de los grupos: la rueda del color y al final los que no son un
// color (1418). Los neutros ya no salen: una carta casi sin color es Clara u
// Oscura.
export const ORDEN = ['rojo', 'naranja', 'amarillo', 'verde', 'turquesa', 'celeste', 'azul', 'morado', 'rosa', 'marrón', 'multicolor', 'claras', 'oscuras']
export const NOMBRE = { rojo: 'Rojo', naranja: 'Naranja', amarillo: 'Amarillo', verde: 'Verde', turquesa: 'Turquesa', celeste: 'Celeste', azul: 'Azul', morado: 'Morado', rosa: 'Rosa', 'marrón': 'Marrón', multicolor: 'Multicolor', claras: 'Claras', oscuras: 'Oscuras', blanco: 'Blanco', gris: 'Gris', negro: 'Negro' }
export { NEUTROS, APARTE }

// La ficha de una carta en la pared: su grupo, su muestra y sus colores.
export function fichaDe(carta, huella) {
  const c = huella?.colores
  if (!c?.color) return null
  return { carta, color: c.color, hex: hexDeColores(c), colores: c }
}

// La pared: las hojas de nueve que casan (`hojasDe`), cada una con sus
// cartas ya colocadas para que la escena siga (`ordenarPagina`, la de
// «Ordenar»). Lo que se ve es lo que sale en el álbum.
export function paredDe(fichas, huellaDe = () => null, columnas = 3) {
  return hojasDe(fichas).map((hoja) => {
    const hs = hoja.map((f) => huellaDe(f.carta.id) || null)
    const r = hoja.length >= 3 && hs.every(Boolean) ? ordenarPagina(hs, columnas) : null
    return r ? r.orden.map((k) => hoja[k]) : hoja
  })
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

// Tu color y el que menos: entre los que tienen tono (un «tu color: gris» o
// «multicolor» no dice nada de una colección).
export function resumenDe(grupos, total) {
  const vivos = grupos.filter((g) => !NEUTROS.includes(g.color) && !APARTE.includes(g.color))
  if (!vivos.length || !total) return null
  const pct = (g) => Math.round((g.n / total) * 100)
  const mas = [...vivos].sort((a, b) => b.n - a.n)[0]
  const menos = [...vivos].sort((a, b) => a.n - b.n)[0]
  return { mas: { ...mas, pct: pct(mas) }, menos: vivos.length > 1 ? { ...menos, pct: pct(menos) } : null }
}

// ── La pantalla ──

let ctx = null
let elegido = 'todos'
let fichas = []
let huellas = new Map()
let hojas = []

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
    if (c?.id && !vistas.has(c.id) && entraEnColores(c)) vistas.set(c.id, c)
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
    conColores: true,
    alAvanzar: (h, t) => { const e = $('vcEstado'); if (e && h < t) e.textContent = `Mirando los colores de tus ilustraciones… ${h} de ${t}` },
  })
  fichas = cartas.map((carta) => fichaDe(carta, huellas.get(carta.id))).filter(Boolean)
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

// Lo que se ve, ya en hojas: con un chip, las hojas se montan SOLO con las de
// ese color (un álbum «Colores: Rojo» casa por dentro igual).
const visibles = () => hojas.flat()

// Sus tres colores con lo que pesa cada uno, de lado a lado (los tres suman
// menos de 1: se reparten la barra entre ellos).
const barraHtml = (c) => {
  const total = c.paleta.reduce((s, p) => s + p.s, 0) || 1
  return `<i class="vc-barra" aria-hidden="true">${c.paleta.map((p) => `<b style="flex:${(p.s / total).toFixed(3)} 1 0;background:${hexDe(p.lab)}"></b>`).join('')}</i>`
}

function pintar() {
  const caja = $('vcColores')
  if (!caja) return
  const grupos = gruposDe(fichas)
  if (elegido !== 'todos' && !grupos.some((g) => g.color === elegido)) elegido = 'todos'
  const r = resumenDe(grupos, fichas.length)
  hojas = paredDe(elegido === 'todos' ? fichas : fichas.filter((f) => f.color === elegido), (id) => huellas.get(id))
  const ver = visibles()
  // Cuántas se quedan fuera, con número (1417): «las que no se han podido
  // leer» sin cifra hacía pensar que la pared contaba mal.
  const sinLeer = Math.max(0, tusIlustraciones().length - fichas.length)
  const muestra = (g) => fondoDeGrupo(g.color, g.hex)
  caja.innerHTML = `
    <p class="mc-vista-resumen"><b>${fichas.length}</b> ${fichas.length === 1 ? 'ilustración tuya' : 'ilustraciones tuyas'}, en hojas de nueve que comparten colores, como saldrán en el álbum.${sinLeer ? ` ${sinLeer === 1 ? 'Hay 1 que no se ha' : `Hay ${sinLeer} que no se han`} podido leer: no tienen ninguna foto que deje mirar sus colores.` : ''}</p>
    ${r ? `<div class="vc-cifras">
      <div><span>Tu color</span><b><i style="background:${r.mas.hex}"></i>${escapeHtml(NOMBRE[r.mas.color])} · ${r.mas.pct} %</b></div>
      ${r.menos ? `<div><span>El que menos</span><b><i style="background:${r.menos.hex}"></i>${escapeHtml(NOMBRE[r.menos.color])} · ${r.menos.pct} %</b></div>` : ''}
    </div>` : ''}
    <div class="vc-rueda" aria-hidden="true">${grupos.map((g) => `<span style="flex:${g.n};background:${muestra(g)}"></span>`).join('')}</div>
    <div class="vc-chips" role="group" aria-label="Qué color ver">
      <button type="button" class="mc-chip-mando${elegido === 'todos' ? ' activo' : ''}" data-color="todos" aria-pressed="${elegido === 'todos'}">Todos · ${fichas.length}</button>
      ${grupos.map((g) => `<button type="button" class="mc-chip-mando${elegido === g.color ? ' activo' : ''}" data-color="${escapeHtml(g.color)}" aria-pressed="${elegido === g.color}"><i style="background:${muestra(g)}" aria-hidden="true"></i>${escapeHtml(NOMBRE[g.color])} · ${g.n}</button>`).join('')}
    </div>
    <div class="vc-hojas">${hojas.map((hoja, i) => `<section class="vc-hoja" aria-label="Hoja ${i + 1}"><ul class="vc-pared">${hoja.map((f) => {
      const escaneo = atributosDeEscaneo(cadenaDeEscaneo(f.carta))
      const nombre = ctx.nombreDe(f.carta)
      return `<li><a class="mc-movida" href="${escapeHtml(rutaDeCarta(f.carta))}" data-carta="${escapeHtml(f.carta.id)}" aria-label="${escapeHtml(`${nombre}: ${NOMBRE[f.color] || f.color}`)}">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : `<span class="mc-carta-sinfoto">${escapeHtml(nombre)}</span>`}</a>${barraHtml(f.colores)}</li>`
    }).join('')}</ul><p>Hoja ${i + 1}</p></section>`).join('')}</div>
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
    // Ya va en hojas de nueve con la escena colocada: el álbum es la pared.
    const orden = ver
    const nombre = elegido === 'todos' ? 'Por colores' : `Colores: ${NOMBRE[elegido]}`
    const { crearBinderCon } = await import('./albumes.js')
    const creada = await crearBinderCon({ nombre, descripcion: elegido === 'todos' ? 'Mis ilustraciones, en hojas que comparten colores.' : APARTE.includes(elegido) ? `Mis ilustraciones ${NOMBRE[elegido].toLowerCase()}.` : `Mis ilustraciones de color ${NOMBRE[elegido].toLowerCase()}.`, ids: orden.map((f) => f.carta.id), abrirlo: false })
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
