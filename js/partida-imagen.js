// Compartir una partida o un torneo de /mis-partidas en una imagen (tanda
// 997). PINGU: «imagínate que haces un torneo y lo acabas y quieres
// compartir el resultado… que genere una imagen con el resultado, así
// bonito, que ponga PokeDoc».
//
// Desde la 1070 (Ibai: «que puedas elegir varios formatos al exportar la
// imagen, alguna con la posición en la que quedas, otra que no, distintas
// formas de mostrarse… que haya varias opciones para todos los gustos») un
// torneo se dibuja con uno de cuatro DISEÑOS (`DISENOS`), sobre uno de tres
// FONDOS (`FONDOS`, también la partida suelta) y con tu PUESTO o sin él. La
// hoja de compartir ofrece las tres cosas y recuerda lo último elegido.
//
// Entra por `import()` al pulsar «Compartir»: la página no lo baja hasta
// entonces. La hoja es la de siempre (`compartir-hoja.js`: Instagram en
// historia o publicación, X, compartir y descargar), con la historia dibujada
// entera (`historiaPropia`); abajo va la marca de PokeDoc, sin frase de
// invitación.
//
// Lo puro (los textos, el puesto, qué rondas caben, cómo se reparten las
// baldosas) va exportado para probarlo en Node; el dibujo recibe los sprites
// ya cargados (`img` o null), así que la prueba puede dibujar sin red.
import { redondeado } from './imagen-compartir.js'
import { fondo as fondoNoche, fondoConTono, medidasDe } from './reto-imagen.js'

export const ENLACE = 'pokedoc.es'
const TITULAR = 'Fredoka, Inter, sans-serif'
const TEXTO = 'Inter, sans-serif'

// Los colores del resultado: los mismos verdes y rojos de los cuadrados de
// los retos, y el ámbar de la casa para el empate. Sirven en los tres fondos.
export const RESULTADO = {
  win: { palabra: 'Victoria', letra: 'V', color: '#2e9e5b', emoji: '✅' },
  loss: { palabra: 'Derrota', letra: 'D', color: '#d64545', emoji: '❌' },
  draw: { palabra: 'Empate', letra: 'E', color: '#c98500', emoji: '🤝' },
}
const DE_JUEGO = { W: 'win', L: 'loss', T: 'draw' }
const TIPO = { id: 'ID (empate pactado)', no_show: 'El rival no se presentó', bye: 'Bye' }

// ── Lo que se elige en la hoja (1070) ──

// Los diseños de un torneo. `puesto: true` es el que gira alrededor del
// puesto (sin él, el medallón lleva el récord).
export const DISENOS = [
  { id: 'clasico', nombre: 'Clásico' },
  { id: 'podio', nombre: 'Podio', puesto: true },
  { id: 'record', nombre: 'Récord' },
  { id: 'mosaico', nombre: 'Mosaico' },
]
export const FONDOS = [
  { id: 'noche', nombre: 'Noche', muestra: '#1e5175' },
  { id: 'claro', nombre: 'Claro', muestra: '#eef4f9' },
  { id: 'color', nombre: 'Color', muestra: '#2e9e5b' },
]
const ID_DISENOS = new Set(DISENOS.map((d) => d.id))
const ID_FONDOS = new Set(FONDOS.map((f) => f.id))

// Lo elegido, saneado: lo que no se conoce (una preferencia vieja, un valor
// a mano) vuelve al de siempre en vez de dibujar nada.
export function eleccionValida(e = {}) {
  return {
    diseno: ID_DISENOS.has(e?.diseno) ? e.diseno : 'clasico',
    fondo: ID_FONDOS.has(e?.fondo) ? e.fondo : 'noche',
    puesto: e?.puesto !== false,
  }
}

// ── El puesto ──

// Un puesto que se puede enseñar: un entero de 1 en adelante (y, si se sabe
// cuántos erais, que quepa). Lo demás es «no se sabe»: null.
export function puestoValido(puesto, jugadores = null) {
  const p = Number(puesto)
  if (!Number.isInteger(p) || p < 1) return null
  const j = Number(jugadores)
  if (jugadores != null && Number.isInteger(j) && j >= 2 && p > j) return null
  return p
}

// Oro, plata y bronce para el podio; el resto, el azul de la casa.
export function medallaDe(puesto) {
  return puesto === 1 ? 'oro' : puesto === 2 ? 'plata' : puesto === 3 ? 'bronce' : 'azul'
}

const MEDALLA = {
  oro: { color: '#f2b705', claro: '#ffd970', oscuro: '#c48a00', tinta: '#3d2c00' },
  plata: { color: '#b9c3cd', claro: '#eef2f6', oscuro: '#8a96a3', tinta: '#1f2a36' },
  bronce: { color: '#cd8549', claro: '#f0b789', oscuro: '#9c5a25', tinta: '#2e1606' },
  azul: { color: '#3d8bd4', claro: '#78b6ee', oscuro: '#245f99', tinta: '#ffffff' },
}

// «3.º», «3.º de 24» y la etiqueta del puesto («Campeón», «Top 8»…). La
// etiqueta solo dice lo que el número ya dice en palabras de torneo; pasado
// el top 32 no hay etiqueta.
export function textoDePuesto(puesto, jugadores = null) {
  const p = puestoValido(puesto, jugadores)
  if (!p) return null
  const j = Number(jugadores)
  const de = Number.isInteger(j) && j >= 2 ? j : null
  const etiqueta = p === 1 ? 'Campeón' : p === 2 ? 'Subcampeón' : p <= 4 ? 'Top 4' : p <= 8 ? 'Top 8' : p <= 16 ? 'Top 16' : p <= 32 ? 'Top 32' : ''
  return {
    puesto: p,
    corto: `${p}.º`,
    largo: de ? `${p}.º de ${de}` : `${p}.º`,
    jugadores: de ? `de ${de} jugadores` : '',
    etiqueta,
    medalla: medallaDe(p),
  }
}

// ── Textos ──

// «2-1» de unos juegos al mejor de tres; nada si no los hay.
export function marcadorDe(juegos) {
  if (!juegos?.length) return ''
  const g = juegos.filter((j) => j.r === 'W').length
  const p = juegos.filter((j) => j.r === 'L').length
  return `${g}-${p}`
}

// «4-1» o «4-1-1»: los empates solo si los hay (como en la tarjeta).
export function recordDe(rondas) {
  const r = { win: 0, loss: 0, draw: 0 }
  for (const p of rondas || []) if (r[p.resultado] !== undefined) r[p.resultado]++
  return { ...r, texto: `${r.win}-${r.loss}${r.draw ? `-${r.draw}` : ''}` }
}

const fechaLarga = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''))
  if (!m) return ''
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${Number(m[3])} de ${meses[Number(m[2]) - 1]} de ${m[1]}`
}
export const lugarYFecha = (donde, fecha) => [donde, fechaLarga(fecha)].filter(Boolean).join(' · ')

// El texto que acompaña a la imagen (con emojis: es lo que se pega fuera, la 568).
export function textoDePartida(p) {
  const r = RESULTADO[p.resultado] || RESULTADO.draw
  const marcador = p.formato === 'bo3' ? marcadorDe(p.juegos) : ''
  const contra = p.tipo === 'bye' ? 'bye' : `contra ${p.rival?.nombre || 'un rival'}`
  const lugar = lugarYFecha(p.donde, p.fecha)
  return [
    `${r.emoji} ${r.palabra}${marcador ? ` ${marcador}` : ''} con ${p.mio?.nombre || 'mi mazo'} ${contra}`,
    ...(lugar ? [lugar] : []),
    `Apunto mis partidas en ${ENLACE}`,
  ].join('\n')
}

// Con el puesto delante del récord si se sabe y se quiere enseñar (1070).
export function textoDeTorneo(t, eleccion = {}) {
  const { texto } = recordDe(t.rondas)
  const lugar = lugarYFecha(t.donde, t.fecha)
  const pu = eleccionValida(eleccion).puesto ? textoDePuesto(t.puesto, t.jugadores) : null
  return [
    `🏆 ${t.nombre}: ${pu ? `${pu.largo} · ` : ''}${texto}${t.mazo?.nombre ? ` con ${t.mazo.nombre}` : ''}`,
    ...(lugar ? [lugar] : []),
    `Apunto mis torneos en ${ENLACE}`,
  ].join('\n')
}

// Cuántas rondas caben y cuántas se quedan fuera («y 3 más»).
export function rondasQueCaben(rondas, max) {
  const n = (rondas || []).length
  if (n <= max) return { visibles: rondas || [], fuera: 0 }
  return { visibles: rondas.slice(0, max - 1), fuera: n - (max - 1) }
}

// El mosaico: cuántas columnas y filas para `n` rondas en una caja de esa
// proporción (ancho/alto). Hasta 16 baldosas; con más, la última dice «y N
// más» (`fuera`).
export function rejillaDeMosaico(n, proporcion = 1) {
  const total = Math.max(0, n)
  if (!total) return { columnas: 0, filas: 0, visibles: 0, fuera: 0 }
  const maxBaldosas = 16
  const caben = Math.min(total, maxBaldosas)
  // Las columnas que dejan las baldosas más cuadradas en esta caja.
  let mejor = null
  for (let c = 1; c <= 6; c++) {
    const f = Math.ceil(caben / c)
    if (f > 6) continue
    const forma = (proporcion * f) / c // ancho/alto de cada baldosa
    const desvio = Math.abs(Math.log(forma / 1.1))
    if (!mejor || desvio < mejor.desvio) mejor = { columnas: c, filas: f, desvio }
  }
  const visibles = total > maxBaldosas ? maxBaldosas - 1 : total
  return { columnas: mejor.columnas, filas: mejor.filas, visibles, fuera: total - visibles }
}

// ── Los fondos y su tinta ──
//
// El dibujo pide sus colores a la PALETA del fondo elegido, no a constantes:
// en «Claro» el texto es oscuro y los paneles se oscurecen en vez de
// aclararse. Se fija al empezar cada dibujo (pintar es síncrono).
const TINTA_OSCURA = {
  texto: '#ffffff',
  suave: 'rgba(255,255,255,0.75)',
  tenue: 'rgba(255,255,255,0.6)',
  panel: 'rgba(255,255,255,0.09)',
  panel2: 'rgba(255,255,255,0.04)',
  banda: 'rgba(255,255,255,0.07)',
  circulo: 'rgba(255,255,255,0.08)',
  circuloBorde: 'rgba(255,255,255,0.18)',
  pokeball: 'rgba(255,255,255,0.35)',
  vs: '#ffd166',
  oro: '#ffd166',
}
const TINTA_CLARA = {
  texto: '#0d1b2a',
  suave: 'rgba(13,27,42,0.72)',
  tenue: 'rgba(13,27,42,0.58)',
  panel: 'rgba(13,27,42,0.07)',
  panel2: 'rgba(13,27,42,0.035)',
  banda: 'rgba(13,27,42,0.06)',
  circulo: 'rgba(13,27,42,0.05)',
  circuloBorde: 'rgba(13,27,42,0.14)',
  pokeball: 'rgba(13,27,42,0.3)',
  vs: '#b07400',
  oro: '#a86f00',
}
// En «Color» el fondo YA dice el resultado o la medalla: lo que encima iría
// en ese mismo color (el récord verde sobre verde, el bronce sobre bronce) se
// pinta en blanco, y la píldora del puesto, blanca con la tinta de su medalla.
const TINTA_COLOR = { ...TINTA_OSCURA, tintado: true }
let P = TINTA_OSCURA

function fondoClaro(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#f8fbfd')
  g.addColorStop(1, '#dfeaf3')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

// El tono de «Color»: el de la medalla si estás en el podio y, si no, el del
// resultado (victoria, derrota, empate).
// Las medallas, en su tono OSCURO: el oro de verdad, de fondo, deja el texto
// blanco de encima casi sin leer.
export function tonoDe({ resultado = null, rondas = null, puesto = null, jugadores = null, conPuesto = true } = {}) {
  const pu = conPuesto ? textoDePuesto(puesto, jugadores) : null
  if (pu && pu.medalla !== 'azul') return MEDALLA[pu.medalla].oscuro
  let r = resultado
  if (!r && rondas) {
    const rec = recordDe(rondas)
    r = rec.win > rec.loss ? 'win' : rec.loss > rec.win ? 'loss' : 'draw'
  }
  return (RESULTADO[r] || RESULTADO.draw).color
}

// ── Dibujo ──

function recortar(ctx, texto, ancho) {
  let t = String(texto || '')
  if (ctx.measureText(t).width <= ancho) return t
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t}…`
}

function ajustar(ctx, texto, cuerpo, maxAncho, peso = 700, fuente = TITULAR) {
  let c = cuerpo
  ctx.font = `${peso} ${c}px ${fuente}`
  while (c > 22 && ctx.measureText(texto).width > maxAncho) {
    c -= 4
    ctx.font = `${peso} ${c}px ${fuente}`
  }
  return c
}

// Los sprites de un mazo (hasta dos) en una caja de `lado`, centrados en cx.
// Un sprite es pixel art: sin suavizado. Sin ninguno, una Poké Ball de trazo.
function sprites(ctx, lista, { cx, cy, lado }) {
  const imgs = (lista || []).filter((s) => s?.img).slice(0, 2)
  if (!imgs.length) {
    ctx.save()
    ctx.strokeStyle = P.pokeball
    ctx.lineWidth = Math.max(3, lado / 28)
    ctx.beginPath()
    ctx.arc(cx, cy, lado * 0.3, 0, Math.PI * 2)
    ctx.moveTo(cx - lado * 0.3, cy)
    ctx.lineTo(cx + lado * 0.3, cy)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, lado * 0.08, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    return
  }
  const cada = imgs.length === 2 ? lado * 0.62 : lado * 0.9
  const hueco = imgs.length === 2 ? -lado * 0.12 : 0
  const total = imgs.length * cada + (imgs.length - 1) * hueco
  let x = cx - total / 2
  ctx.save()
  ctx.imageSmoothingEnabled = false
  for (const s of imgs) {
    const c = s.caja || { x: 0, y: 0, w: s.img.width, h: s.img.height }
    const k = Math.min(cada / c.w, cada / c.h)
    const w = c.w * k
    const h = c.h * k
    ctx.drawImage(s.img, c.x, c.y, c.w, c.h, x + (cada - w) / 2, cy - h / 2, w, h)
    x += cada + hueco
  }
  ctx.restore()
}

function pildora(ctx, texto, { cx, y, alto, color, cuerpo, anchoMin = 0, tinta = '#fff' }) {
  ctx.save()
  ctx.font = `700 ${cuerpo}px ${TITULAR}`
  const ancho = Math.max(anchoMin, ctx.measureText(texto).width + alto)
  ctx.fillStyle = color
  redondeado(ctx, cx - ancho / 2, y, ancho, alto, alto / 2)
  ctx.fill()
  ctx.fillStyle = tinta
  ctx.textAlign = 'center'
  ctx.fillText(texto, cx, y + alto / 2 + cuerpo * 0.36)
  ctx.restore()
  return ancho
}

function circuloDeMazo(ctx, { cx, cy, r }) {
  ctx.save()
  ctx.fillStyle = P.circulo
  ctx.strokeStyle = P.circuloBorde
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function textoCentrado(ctx, texto, { cx, y, cuerpo, color = P.texto, peso = 600, fuente = TEXTO, maxAncho = 900 }) {
  ctx.save()
  ctx.font = `${peso} ${cuerpo}px ${fuente}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(recortar(ctx, texto, maxAncho), cx, y)
  ctx.restore()
}

function textoIzquierda(ctx, texto, { x, y, cuerpo, color = P.texto, peso = 600, fuente = TEXTO, maxAncho = 900 }) {
  ctx.save()
  ctx.font = `${peso} ${cuerpo}px ${fuente}`
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.fillText(recortar(ctx, texto, maxAncho), x, y)
  ctx.restore()
}

// Un cuadradito de resultado con su letra (V, D, E).
function cuadro(ctx, resultado, { x, y, lado }) {
  const r = RESULTADO[resultado] || RESULTADO.draw
  ctx.save()
  ctx.fillStyle = r.color
  redondeado(ctx, x, y, lado, lado, lado / 4)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${Math.round(lado * 0.5)}px ${TITULAR}`
  ctx.textAlign = 'center'
  ctx.fillText(r.letra, x + lado / 2, y + lado * 0.68)
  ctx.restore()
}

// Los juegos de un mejor de tres: «V D V» en cuadraditos.
function juegos(ctx, lista, { cx, y, lado }) {
  const hueco = lado * 0.25
  const total = lista.length * lado + (lista.length - 1) * hueco
  let x = cx - total / 2
  for (const j of lista) {
    cuadro(ctx, DE_JUEGO[j.r], { x, y, lado })
    x += lado + hueco
  }
}

// La tira de un torneo: un cuadrado por ronda, en orden. Encoge para caber en
// `ancho`; si ni así, las que quepan.
function tiraDeRondas(ctx, rondas, { cx, y, ancho, lado = 56 }) {
  const n = (rondas || []).length
  if (!n) return 0
  let l = lado
  let hueco = Math.round(l * 0.22)
  while (l > 26 && n * l + (n - 1) * hueco > ancho) {
    l -= 4
    hueco = Math.round(l * 0.22)
  }
  const caben = Math.max(1, Math.min(n, Math.floor((ancho + hueco) / (l + hueco))))
  const total = caben * l + (caben - 1) * hueco
  let x = cx - total / 2
  for (const p of rondas.slice(0, caben)) {
    cuadro(ctx, p.resultado, { x, y, lado: l })
    x += l + hueco
  }
  return l
}

// La historia de Instagram (1080×1920) se dibuja ENTERA, con el mismo fondo
// liso (997, PINGU: la de la hoja, con la publicación encima de sí misma
// agrandada y difuminada, «está muy mal»): lo de la publicación, bajado para
// que quede en medio de la pantalla, y la marca abajo del todo.
const ALTO_LARGA = 1920
const BAJADA = 250

function prepararLienzo(lienzo, formato, { fondo = 'noche', tono = null } = {}) {
  const larga = formato === 'larga'
  const { w, h } = medidasDe(larga ? 'historia' : formato)
  lienzo.width = w
  lienzo.height = larga ? ALTO_LARGA : h
  const ctx = lienzo.getContext('2d')
  P = fondo === 'claro' ? TINTA_CLARA : fondo === 'color' && tono ? TINTA_COLOR : TINTA_OSCURA
  if (fondo === 'claro') fondoClaro(ctx, w, lienzo.height)
  else if (fondo === 'color' && tono) fondoConTono(ctx, w, lienzo.height, tono)
  else fondoNoche(ctx, w, lienzo.height)
  if (larga) ctx.translate(0, BAJADA)
  return { ctx, w, h, larga }
}

// Arriba, qué es («MIS PARTIDAS»), sin más; la marca va abajo.
function rotulo(ctx, texto, { x, y, cuerpo }) {
  ctx.save()
  ctx.font = `700 ${cuerpo}px ${TEXTO}`
  ctx.fillStyle = P.suave
  ctx.textAlign = 'left'
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(cuerpo * 0.14)}px`
  ctx.fillText(texto.toUpperCase(), x, y)
  ctx.restore()
}

// La marca: la «P» de la web y «PokeDoc», centrados. Sin frase ni enlace
// (PINGU: «apunta las tuyas en pokedoc.es» era «muy cargante»).
function marca(ctx, { cx, y, lado }) {
  ctx.save()
  ctx.font = `700 ${Math.round(lado * 0.62)}px ${TITULAR}`
  const palabra = ctx.measureText('PokeDoc').width
  const hueco = lado * 0.32
  const x = cx - (lado + hueco + palabra) / 2
  ctx.fillStyle = '#8ec5ea'
  redondeado(ctx, x, y, lado, lado, Math.round(lado / 4))
  ctx.fill()
  ctx.fillStyle = '#0d1b2a'
  ctx.textAlign = 'center'
  ctx.fillText('P', x + lado / 2, y + lado * 0.74)
  ctx.fillStyle = P.texto
  ctx.textAlign = 'left'
  ctx.fillText('PokeDoc', x + lado + hueco, y + lado * 0.74)
  ctx.restore()
}

function marcaAbajo(ctx, { w, h, larga, apaisada, cx = w / 2 }) {
  if (larga) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    marca(ctx, { cx, y: ALTO_LARGA - 260, lado: 84 })
  } else if (apaisada) marca(ctx, { cx, y: h - 84, lado: 48 })
  else marca(ctx, { cx, y: h - 150, lado: 72 })
}

// La píldora del puesto, en el color de su medalla: «3.º de 24».
function pildoraDePuesto(ctx, pu, { cx, y, alto, cuerpo, anchoMin = 0, alinear = 'centro', x = 0 }) {
  const m = MEDALLA[pu.medalla]
  ctx.save()
  ctx.font = `700 ${cuerpo}px ${TITULAR}`
  const ancho = Math.max(anchoMin, ctx.measureText(pu.largo).width + alto)
  ctx.restore()
  const centro = alinear === 'derecha' ? x - ancho / 2 : alinear === 'izquierda' ? x + ancho / 2 : cx
  pildora(ctx, pu.largo, { cx: centro, y, alto, color: P.tintado ? 'rgba(255,255,255,0.94)' : m.color, cuerpo, anchoMin: ancho, tinta: P.tintado ? m.oscuro : m.tinta })
  return ancho
}

// El medallón del diseño «Podio»: la medalla con su cinta y el número dentro.
// Sin puesto, el mismo medallón en azul con el récord.
function medallon(ctx, { cx, cy, r, texto, medalla = 'azul' }) {
  const m = MEDALLA[medalla]
  ctx.save()
  // La cinta: dos tiras que salen de detrás hacia arriba.
  const cinta = (lado) => {
    ctx.beginPath()
    ctx.moveTo(cx + lado * r * 0.18, cy - r * 0.6)
    ctx.lineTo(cx + lado * r * 0.62, cy - r * 1.42)
    ctx.lineTo(cx + lado * r * 0.98, cy - r * 1.42)
    ctx.lineTo(cx + lado * r * 0.58, cy - r * 0.5)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = '#d64545'
  cinta(-1)
  ctx.fillStyle = '#1e5175'
  cinta(1)
  // El disco, con su canto.
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = r * 0.18
  ctx.shadowOffsetY = r * 0.05
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  g.addColorStop(0, m.claro)
  g.addColorStop(0.55, m.color)
  g.addColorStop(1, m.oscuro)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = Math.max(3, r * 0.04)
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2)
  ctx.stroke()
  // El número (o el récord), lo más grande que quepa en el disco.
  const cuerpo = ajustar(ctx, texto, Math.round(r * 0.95), r * 1.35, 700, TITULAR)
  ctx.fillStyle = m.tinta
  ctx.textAlign = 'center'
  ctx.font = `700 ${cuerpo}px ${TITULAR}`
  ctx.fillText(texto, cx, cy + cuerpo * 0.36)
  ctx.restore()
}

// Una ronda del mosaico: su color de fondo, R1, la letra, los sprites del
// rival y su nombre.
function baldosa(ctx, p, i, { x, y, w, h }) {
  const r = RESULTADO[p.resultado] || RESULTADO.draw
  ctx.save()
  ctx.fillStyle = P.panel
  redondeado(ctx, x, y, w, h, Math.min(28, h / 6))
  ctx.fill()
  ctx.strokeStyle = r.color
  ctx.lineWidth = Math.max(3, Math.round(w / 60))
  redondeado(ctx, x, y, w, h, Math.min(28, h / 6))
  ctx.stroke()
  // Con pocas rondas las baldosas son grandes: la letra tiene tope.
  const pequeno = Math.min(Math.round(w / 10), Math.round(Math.min(w, h) * 0.13))
  ctx.fillStyle = P.tenue
  ctx.font = `700 ${pequeno}px ${TITULAR}`
  ctx.textAlign = 'left'
  ctx.fillText(`R${p.ronda ?? i + 1}`, x + pequeno * 0.8, y + pequeno * 1.5)
  const l = Math.round(Math.min(w, h) * 0.22)
  cuadro(ctx, p.resultado, { x: x + w - l - pequeno * 0.6, y: y + pequeno * 0.6, lado: l })
  const nombre = p.tipo === 'bye' ? 'Bye' : `${p.rival?.nombre || '—'}${p.tipo === 'id' ? ' · ID' : p.tipo === 'no_show' ? ' · no vino' : ''}`
  const lado = Math.min(w * 0.62, h * 0.5)
  if (p.tipo === 'bye') textoCentrado(ctx, 'Bye', { cx: x + w / 2, y: y + h * 0.56, cuerpo: Math.round(h * 0.2), fuente: TITULAR, peso: 700, color: P.suave })
  else sprites(ctx, p.rival?.sprites, { cx: x + w / 2, cy: y + h * 0.5, lado })
  if (p.tipo !== 'bye') textoCentrado(ctx, nombre, { cx: x + w / 2, y: y + h - pequeno * 0.9, cuerpo: Math.round(pequeno * 0.95), color: P.texto, maxAncho: w - pequeno * 1.2 })
  ctx.restore()
}

export function pintarPartida(lienzo, p, formato = 'historia', eleccion = {}) {
  const e = eleccionValida(eleccion)
  const { ctx, w, h, larga } = prepararLienzo(lienzo, formato, { fondo: e.fondo, tono: tonoDe({ resultado: p.resultado }) })
  const r = RESULTADO[p.resultado] || RESULTADO.draw
  const apaisada = formato === 'apaisada'
  const margen = apaisada ? 56 : 72
  rotulo(ctx, 'Mis partidas', { x: margen, y: apaisada ? 68 : 118, cuerpo: apaisada ? 24 : 32 })
  const marcador = p.formato === 'bo3' && p.juegos?.length ? marcadorDe(p.juegos) : ''
  const bye = p.tipo === 'bye'
  // El resultado, en grande y en su color.
  const yRes = apaisada ? 112 : 196
  pildora(ctx, `${r.palabra}${marcador ? `  ${marcador}` : ''}`, { cx: w / 2, y: yRes, alto: apaisada ? 76 : 120, color: r.color, cuerpo: apaisada ? 46 : 72, anchoMin: apaisada ? 320 : 460 })
  // Los dos mazos.
  const rMazo = apaisada ? 112 : 190
  const cy = apaisada ? 330 : 590
  const dx = apaisada ? 290 : 250
  for (const [lado, mazo, etiqueta] of [[-1, p.mio, 'Tú'], [1, bye ? null : p.rival, bye ? '' : 'Rival']]) {
    const cx = w / 2 + lado * dx
    if (bye && lado === 1) {
      circuloDeMazo(ctx, { cx, cy, r: rMazo })
      textoCentrado(ctx, 'Bye', { cx, y: cy + 22, cuerpo: apaisada ? 48 : 64, fuente: TITULAR, peso: 700, color: P.suave })
      continue
    }
    circuloDeMazo(ctx, { cx, cy, r: rMazo })
    sprites(ctx, mazo?.sprites, { cx, cy, lado: rMazo * 1.5 })
    textoCentrado(ctx, etiqueta, { cx, y: cy - rMazo - (apaisada ? 14 : 24), cuerpo: apaisada ? 22 : 30, color: P.suave })
    const cuerpo = ajustar(ctx, mazo?.nombre || '—', apaisada ? 34 : 46, apaisada ? 380 : 420)
    textoCentrado(ctx, mazo?.nombre || '—', { cx, y: cy + rMazo + (apaisada ? 46 : 70), cuerpo, fuente: TITULAR, peso: 700, maxAncho: apaisada ? 380 : 420 })
  }
  textoCentrado(ctx, 'VS', { cx: w / 2, y: cy + (apaisada ? 16 : 24), cuerpo: apaisada ? 44 : 64, fuente: TITULAR, peso: 700, color: P.vs })
  let y = cy + rMazo + (apaisada ? 92 : 150)
  if (marcador && !apaisada) {
    juegos(ctx, p.juegos, { cx: w / 2, y, lado: 72 })
    y += 130
  }
  const nota = TIPO[p.tipo] && !bye ? TIPO[p.tipo] : ''
  const lugar = lugarYFecha(p.donde, p.fecha)
  if (nota) {
    textoCentrado(ctx, nota, { cx: w / 2, y, cuerpo: apaisada ? 24 : 32, color: P.suave })
    y += apaisada ? 36 : 50
  }
  if (lugar && !apaisada) textoCentrado(ctx, lugar, { cx: w / 2, y, cuerpo: 32, color: P.suave, maxAncho: w - margen * 2 })
  if (lugar && apaisada) {
    ctx.save()
    ctx.font = `500 22px ${TEXTO}`
    ctx.fillStyle = P.suave
    ctx.textAlign = 'right'
    ctx.fillText(recortar(ctx, lugar, 520), w - margen, 72)
    ctx.restore()
  }
  marcaAbajo(ctx, { w, h, larga, apaisada })
  return lienzo
}

// ── El torneo, en sus cuatro diseños ──
//
// Todos reciben lo mismo: el lienzo ya preparado (fondo y tinta), el torneo
// con sus sprites cargados, el récord y el puesto (null si no se sabe o no se
// quiere enseñar).

function leyendaDe(rec) {
  return [`${rec.win} ${rec.win === 1 ? 'victoria' : 'victorias'}`, `${rec.loss} ${rec.loss === 1 ? 'derrota' : 'derrotas'}`, ...(rec.draw ? [`${rec.draw} ${rec.draw === 1 ? 'empate' : 'empates'}`] : [])].join(' · ')
}
const colorDeRecord = (rec) => (P.tintado ? P.texto : rec.win > rec.loss ? RESULTADO.win.color : rec.loss > rec.win ? RESULTADO.loss.color : RESULTADO.draw.color)
// El color de la etiqueta del puesto («Top 4»): el de su medalla, más oscuro
// sobre «Claro» y blanco sobre «Color».
const colorDeMedalla = (pu) => (!pu || pu.medalla === 'azul' || P.tintado ? P.texto : P === TINTA_CLARA ? MEDALLA[pu.medalla].oscuro : MEDALLA[pu.medalla].color)

// Las rondas, una por fila (el «Clásico» de la 997). La fila mide lo que
// quepa: hasta 74 px (52 en la apaisada) y no menos de 48 (40); lo que no
// entre ni así se cuenta en «y N más».
function filasDeRondas(ctx, rondas, caja, apaisada) {
  const altoFila = apaisada ? 52 : 74
  const minimo = apaisada ? 40 : 48
  const max = Math.max(1, Math.floor(caja.h / minimo))
  const { visibles, fuera } = rondasQueCaben(rondas, max)
  const fila = Math.max(minimo, Math.min(altoFila, Math.floor(caja.h / Math.max(1, visibles.length + (fuera ? 1 : 0)))))
  visibles.forEach((p, i) => {
    const fy = caja.y + i * fila
    ctx.save()
    ctx.fillStyle = i % 2 ? P.panel2 : P.panel
    redondeado(ctx, caja.x, fy + 3, caja.w, fila - 6, (fila - 6) / 3)
    ctx.fill()
    const medio = fy + fila / 2
    ctx.fillStyle = P.tenue
    ctx.font = `700 ${Math.round(fila * 0.34)}px ${TITULAR}`
    ctx.textAlign = 'left'
    ctx.fillText(`R${p.ronda ?? i + 1}`, caja.x + 18, medio + fila * 0.12)
    const xSprite = caja.x + fila * 1.25
    if (p.tipo !== 'bye') sprites(ctx, p.rival?.sprites, { cx: xSprite + fila * 0.45, cy: medio, lado: fila * 0.95 })
    ctx.fillStyle = P.texto
    ctx.font = `600 ${Math.round(fila * 0.36)}px ${TEXTO}`
    const marcador = p.formato === 'bo3' ? marcadorDe(p.juegos) : ''
    const derecha = fila * 1.1 + (marcador ? fila * 0.9 : 0)
    const nombre = p.tipo === 'bye' ? 'Bye' : `${p.rival?.nombre || '—'}${TIPO[p.tipo] && p.tipo !== 'bye' ? ` · ${p.tipo === 'id' ? 'ID' : 'no se presentó'}` : ''}`
    ctx.fillText(recortar(ctx, nombre, caja.w - (xSprite - caja.x) - fila * 1.1 - derecha), xSprite + fila * 1.05, medio + fila * 0.13)
    const l = fila * 0.66
    cuadro(ctx, p.resultado, { x: caja.x + caja.w - l - 14, y: medio - l / 2, lado: l })
    if (marcador) {
      ctx.fillStyle = P.suave
      ctx.font = `600 ${Math.round(fila * 0.32)}px ${TEXTO}`
      ctx.textAlign = 'right'
      ctx.fillText(marcador, caja.x + caja.w - l - 30, medio + fila * 0.12)
    }
    ctx.restore()
  })
  if (fuera) textoCentrado(ctx, `y ${fuera} ${fuera === 1 ? 'ronda' : 'rondas'} más`, { cx: caja.x + caja.w / 2, y: caja.y + visibles.length * fila + fila * 0.62, cuerpo: Math.round(fila * 0.34), color: P.suave })
  if (!rondas?.length) textoCentrado(ctx, 'Sin rondas todavía', { cx: caja.x + caja.w / 2, y: caja.y + 60, cuerpo: apaisada ? 24 : 32, color: P.suave })
}

function disenoClasico(ctx, t, { w, h, apaisada, margen, rec, pu, lugar }) {
  const colorRec = colorDeRecord(rec)
  const leyenda = leyendaDe(rec)
  let caja
  // El puesto, arriba a la derecha, a la altura del rótulo.
  if (pu) pildoraDePuesto(ctx, pu, { x: w - margen, y: apaisada ? 36 : 74, alto: apaisada ? 48 : 64, cuerpo: apaisada ? 26 : 36, alinear: 'derecha' })
  if (apaisada) {
    // A la izquierda: el torneo, el mazo y el récord; las rondas, a la derecha.
    const colX = margen + 240
    const colAncho = 440
    let y = 140
    let c = ajustar(ctx, t.nombre || 'Torneo', 40, colAncho)
    textoCentrado(ctx, t.nombre || 'Torneo', { cx: colX, y, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: colAncho })
    y += 36
    if (lugar) textoCentrado(ctx, lugar, { cx: colX, y, cuerpo: 20, color: P.suave, maxAncho: colAncho })
    y += 92
    circuloDeMazo(ctx, { cx: colX, cy: y, r: 74 })
    sprites(ctx, t.mazo?.sprites, { cx: colX, cy: y, lado: 120 })
    y += 114
    if (t.mazo?.nombre) {
      c = ajustar(ctx, t.mazo.nombre, 28, colAncho)
      textoCentrado(ctx, t.mazo.nombre, { cx: colX, y, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: colAncho })
    }
    y += 92
    textoCentrado(ctx, rec.texto, { cx: colX, y, cuerpo: 96, fuente: TITULAR, peso: 700, color: colorRec })
    textoCentrado(ctx, leyenda, { cx: colX, y: y + 36, cuerpo: 20, color: P.suave })
    caja = { x: margen + 520, y: 112, w: w - margen * 2 - 520, h: h - 112 - 100 }
  } else {
    // Arriba el torneo y, en una banda, el mazo con el récord al lado: así
    // caben hasta doce rondas debajo.
    const ancho = w - margen * 2
    const c = ajustar(ctx, t.nombre || 'Torneo', 64, ancho)
    textoCentrado(ctx, t.nombre || 'Torneo', { cx: w / 2, y: 232, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: ancho })
    if (lugar) textoCentrado(ctx, lugar, { cx: w / 2, y: 284, cuerpo: 30, color: P.suave, maxAncho: ancho })
    const banda = { x: margen, y: 326, w: ancho, h: 196 }
    ctx.save()
    ctx.fillStyle = P.banda
    redondeado(ctx, banda.x, banda.y, banda.w, banda.h, 36)
    ctx.fill()
    ctx.restore()
    const cx = banda.x + 110
    const cy = banda.y + banda.h / 2
    circuloDeMazo(ctx, { cx, cy, r: 76 })
    sprites(ctx, t.mazo?.sprites, { cx, cy, lado: 124 })
    const tx = banda.x + 220
    const tAncho = banda.w - 220 - 32
    ctx.save()
    ctx.textAlign = 'left'
    ctx.fillStyle = P.suave
    ajustar(ctx, t.mazo?.nombre || 'Mi mazo', 38, tAncho, 700, TITULAR)
    ctx.fillText(recortar(ctx, t.mazo?.nombre || 'Mi mazo', tAncho), tx, banda.y + 70)
    ctx.font = `700 112px ${TITULAR}`
    ctx.fillStyle = colorRec
    ctx.fillText(rec.texto, tx, banda.y + 168)
    const anchoRec = ctx.measureText(rec.texto).width
    ctx.font = `500 26px ${TEXTO}`
    ctx.fillStyle = P.suave
    const resto = tAncho - anchoRec - 28
    // Entera o nada: «2 e…» no dice nada que el récord no diga mejor.
    if (ctx.measureText(leyenda).width <= resto) ctx.fillText(leyenda, tx + anchoRec + 28, banda.y + 160)
    ctx.restore()
    caja = { x: margen, y: banda.y + banda.h + 32, w: ancho, h: h - (banda.y + banda.h + 32) - 190 }
  }
  filasDeRondas(ctx, t.rondas, caja, apaisada)
  return apaisada ? margen + 240 : w / 2
}

// «Podio»: la medalla con el puesto, en grande; debajo, el torneo, tu mazo
// con el récord y la tira de rondas. Sin puesto, el medallón lleva el récord.
function disenoPodio(ctx, t, { w, h, apaisada, margen, rec, pu, lugar }) {
  const colorRec = colorDeRecord(rec)
  const enMedalla = pu ? pu.corto : rec.texto
  const etiqueta = pu ? pu.etiqueta || 'Mi puesto' : 'Mi récord'
  const debajo = pu ? pu.jugadores : leyendaDe(rec)
  if (apaisada) {
    const mx = margen + 190
    medallon(ctx, { cx: mx, cy: 300, r: 136, texto: enMedalla, medalla: pu ? pu.medalla : 'azul' })
    textoCentrado(ctx, etiqueta, { cx: mx, y: 500, cuerpo: 40, fuente: TITULAR, peso: 700, color: colorDeMedalla(pu), maxAncho: 380 })
    if (debajo) textoCentrado(ctx, debajo, { cx: mx, y: 538, cuerpo: 22, color: P.suave, maxAncho: 380 })
    const x = margen + 420
    const ancho = w - x - margen
    const cx = x + ancho / 2
    const c = ajustar(ctx, t.nombre || 'Torneo', 46, ancho)
    textoCentrado(ctx, t.nombre || 'Torneo', { cx, y: 150, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: ancho })
    if (lugar) textoCentrado(ctx, lugar, { cx, y: 190, cuerpo: 22, color: P.suave, maxAncho: ancho })
    ctx.save()
    ctx.fillStyle = P.banda
    redondeado(ctx, x, 222, ancho, 150, 28)
    ctx.fill()
    ctx.restore()
    circuloDeMazo(ctx, { cx: x + 82, cy: 297, r: 58 })
    sprites(ctx, t.mazo?.sprites, { cx: x + 82, cy: 297, lado: 96 })
    ctx.save()
    ctx.font = `700 64px ${TITULAR}`
    const anchoRec = pu ? ctx.measureText(rec.texto).width : 0
    ctx.restore()
    const tAncho = ancho - 170 - (pu ? anchoRec + 40 : 24)
    const cm = ajustar(ctx, t.mazo?.nombre || 'Mi mazo', 34, tAncho)
    textoIzquierda(ctx, t.mazo?.nombre || 'Mi mazo', { x: x + 160, y: 309, cuerpo: cm, fuente: TITULAR, peso: 700, maxAncho: tAncho })
    if (pu) {
      ctx.save()
      ctx.font = `700 64px ${TITULAR}`
      ctx.fillStyle = colorRec
      ctx.textAlign = 'right'
      ctx.fillText(rec.texto, x + ancho - 24, 320)
      ctx.restore()
    }
    tiraDeRondas(ctx, t.rondas, { cx, y: 400, ancho, lado: 48 })
    return cx
  }
  medallon(ctx, { cx: w / 2, cy: 400, r: 176, texto: enMedalla, medalla: pu ? pu.medalla : 'azul' })
  textoCentrado(ctx, etiqueta, { cx: w / 2, y: 660, cuerpo: 60, fuente: TITULAR, peso: 700, color: colorDeMedalla(pu), maxAncho: w - margen * 2 })
  if (debajo) textoCentrado(ctx, debajo, { cx: w / 2, y: 708, cuerpo: 32, color: P.suave, maxAncho: w - margen * 2 })
  const ancho = w - margen * 2
  const c = ajustar(ctx, t.nombre || 'Torneo', 50, ancho)
  textoCentrado(ctx, t.nombre || 'Torneo', { cx: w / 2, y: 800, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: ancho })
  if (lugar) textoCentrado(ctx, lugar, { cx: w / 2, y: 846, cuerpo: 28, color: P.suave, maxAncho: ancho })
  const banda = { x: margen, y: 884, w: ancho, h: 150 }
  ctx.save()
  ctx.fillStyle = P.banda
  redondeado(ctx, banda.x, banda.y, banda.w, banda.h, 32)
  ctx.fill()
  ctx.restore()
  circuloDeMazo(ctx, { cx: banda.x + 92, cy: banda.y + 75, r: 60 })
  sprites(ctx, t.mazo?.sprites, { cx: banda.x + 92, cy: banda.y + 75, lado: 100 })
  ctx.save()
  ctx.font = `700 84px ${TITULAR}`
  const anchoRec = pu ? ctx.measureText(rec.texto).width : 0
  ctx.restore()
  const tAncho = banda.w - 184 - (pu ? anchoRec + 56 : 32)
  const cm = ajustar(ctx, t.mazo?.nombre || 'Mi mazo', 40, tAncho)
  textoIzquierda(ctx, t.mazo?.nombre || 'Mi mazo', { x: banda.x + 176, y: banda.y + 88, cuerpo: cm, fuente: TITULAR, peso: 700, maxAncho: tAncho })
  if (pu) {
    ctx.save()
    ctx.font = `700 84px ${TITULAR}`
    ctx.fillStyle = colorRec
    ctx.textAlign = 'right'
    ctx.fillText(rec.texto, banda.x + banda.w - 32, banda.y + 104)
    ctx.restore()
  }
  tiraDeRondas(ctx, t.rondas, { cx: w / 2, y: 1068, ancho, lado: 64 })
  return w / 2
}

// «Récord»: sin rivales. Tu mazo en grande, el récord enorme y una tira de
// cuadrados; el puesto, en su píldora.
function disenoRecord(ctx, t, { w, h, apaisada, margen, rec, pu, lugar }) {
  const colorRec = colorDeRecord(rec)
  if (apaisada) {
    const mx = margen + 200
    circuloDeMazo(ctx, { cx: mx, cy: 300, r: 168 })
    sprites(ctx, t.mazo?.sprites, { cx: mx, cy: 300, lado: 270 })
    const x = margen + 440
    const ancho = w - x - margen
    const cx = x + ancho / 2
    const c = ajustar(ctx, t.nombre || 'Torneo', 40, ancho)
    textoCentrado(ctx, t.nombre || 'Torneo', { cx, y: 112, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: ancho })
    if (lugar) textoCentrado(ctx, lugar, { cx, y: 148, cuerpo: 20, color: P.suave, maxAncho: ancho })
    const cm = ajustar(ctx, t.mazo?.nombre || 'Mi mazo', 34, ancho)
    textoCentrado(ctx, t.mazo?.nombre || 'Mi mazo', { cx, y: 206, cuerpo: cm, fuente: TITULAR, peso: 700, color: P.suave, maxAncho: ancho })
    textoCentrado(ctx, rec.texto, { cx, y: 340, cuerpo: 150, fuente: TITULAR, peso: 700, color: colorRec })
    textoCentrado(ctx, leyendaDe(rec), { cx, y: 382, cuerpo: 22, color: P.suave, maxAncho: ancho })
    let y = 408
    if (pu) {
      pildoraDePuesto(ctx, pu, { cx, y, alto: 48, cuerpo: 26 })
      y += 64
    }
    tiraDeRondas(ctx, t.rondas, { cx, y, ancho, lado: 40 })
    return cx
  }
  const ancho = w - margen * 2
  const c = ajustar(ctx, t.nombre || 'Torneo', 50, ancho)
  textoCentrado(ctx, t.nombre || 'Torneo', { cx: w / 2, y: 198, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: ancho })
  if (lugar) textoCentrado(ctx, lugar, { cx: w / 2, y: 242, cuerpo: 28, color: P.suave, maxAncho: ancho })
  circuloDeMazo(ctx, { cx: w / 2, cy: 456, r: 168 })
  sprites(ctx, t.mazo?.sprites, { cx: w / 2, cy: 456, lado: 280 })
  const cm = ajustar(ctx, t.mazo?.nombre || 'Mi mazo', 52, ancho)
  textoCentrado(ctx, t.mazo?.nombre || 'Mi mazo', { cx: w / 2, y: 704, cuerpo: cm, fuente: TITULAR, peso: 700, maxAncho: ancho })
  textoCentrado(ctx, rec.texto, { cx: w / 2, y: 900, cuerpo: 210, fuente: TITULAR, peso: 700, color: colorRec })
  textoCentrado(ctx, leyendaDe(rec), { cx: w / 2, y: 952, cuerpo: 30, color: P.suave, maxAncho: ancho })
  let y = 990
  if (pu) {
    pildoraDePuesto(ctx, pu, { cx: w / 2, y, alto: 64, cuerpo: 36, anchoMin: 220 })
    y += 88
  } else y += 24
  tiraDeRondas(ctx, t.rondas, { cx: w / 2, y, ancho, lado: pu ? 56 : 64 })
  return w / 2
}

// «Mosaico»: una baldosa por ronda con el mazo del rival, en el color del
// resultado. Arriba, el torneo, tu mazo, el récord y el puesto.
function disenoMosaico(ctx, t, { w, h, apaisada, margen, rec, pu, lugar }) {
  const colorRec = colorDeRecord(rec)
  let caja
  let cxMarca
  if (apaisada) {
    const colX = margen + 210
    const colAncho = 380
    let y = 132
    const c = ajustar(ctx, t.nombre || 'Torneo', 38, colAncho)
    textoCentrado(ctx, t.nombre || 'Torneo', { cx: colX, y, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: colAncho })
    if (lugar) textoCentrado(ctx, lugar, { cx: colX, y: y + 34, cuerpo: 20, color: P.suave, maxAncho: colAncho })
    y += 120
    circuloDeMazo(ctx, { cx: colX, cy: y, r: 64 })
    sprites(ctx, t.mazo?.sprites, { cx: colX, cy: y, lado: 104 })
    y += 102
    const cm = ajustar(ctx, t.mazo?.nombre || 'Mi mazo', 28, colAncho)
    textoCentrado(ctx, t.mazo?.nombre || 'Mi mazo', { cx: colX, y, cuerpo: cm, fuente: TITULAR, peso: 700, maxAncho: colAncho })
    y += 80
    textoCentrado(ctx, rec.texto, { cx: colX, y, cuerpo: 80, fuente: TITULAR, peso: 700, color: colorRec })
    if (pu) pildoraDePuesto(ctx, pu, { x: w - margen, y: 36, alto: 48, cuerpo: 26, alinear: 'derecha' })
    caja = { x: margen + 440, y: 104, w: w - margen * 2 - 440, h: h - 104 - 110 }
    cxMarca = colX
  } else {
    const ancho = w - margen * 2
    const c = ajustar(ctx, t.nombre || 'Torneo', 56, ancho)
    textoCentrado(ctx, t.nombre || 'Torneo', { cx: w / 2, y: 214, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: ancho })
    if (lugar) textoCentrado(ctx, lugar, { cx: w / 2, y: 260, cuerpo: 28, color: P.suave, maxAncho: ancho })
    // La banda: tu mazo a la izquierda; el récord y el puesto a la derecha.
    const banda = { x: margen, y: 296, w: ancho, h: 132 }
    ctx.save()
    ctx.fillStyle = P.banda
    redondeado(ctx, banda.x, banda.y, banda.w, banda.h, 32)
    ctx.fill()
    ctx.restore()
    circuloDeMazo(ctx, { cx: banda.x + 80, cy: banda.y + 66, r: 52 })
    sprites(ctx, t.mazo?.sprites, { cx: banda.x + 80, cy: banda.y + 66, lado: 88 })
    ctx.save()
    ctx.font = `700 76px ${TITULAR}`
    const anchoRec = ctx.measureText(rec.texto).width
    ctx.fillStyle = colorRec
    ctx.textAlign = 'right'
    ctx.fillText(rec.texto, banda.x + banda.w - 28, banda.y + 84)
    ctx.restore()
    let anchoPu = 0
    if (pu) anchoPu = pildoraDePuesto(ctx, pu, { x: banda.x + banda.w - 28 - anchoRec - 24, y: banda.y + 38, alto: 56, cuerpo: 30, alinear: 'derecha' }) + 24
    const tAncho = banda.w - 156 - anchoRec - 56 - anchoPu
    const cm = ajustar(ctx, t.mazo?.nombre || 'Mi mazo', 40, tAncho)
    textoIzquierda(ctx, t.mazo?.nombre || 'Mi mazo', { x: banda.x + 152, y: banda.y + 80, cuerpo: cm, fuente: TITULAR, peso: 700, maxAncho: tAncho })
    caja = { x: margen, y: 460, w: ancho, h: h - 460 - 186 }
    cxMarca = w / 2
  }
  const rondas = t.rondas || []
  if (!rondas.length) {
    textoCentrado(ctx, 'Sin rondas todavía', { cx: caja.x + caja.w / 2, y: caja.y + 60, cuerpo: apaisada ? 24 : 32, color: P.suave })
    return cxMarca
  }
  const hueco = apaisada ? 14 : 20
  const r = rejillaDeMosaico(rondas.length, caja.w / caja.h)
  const bw = (caja.w - (r.columnas - 1) * hueco) / r.columnas
  const bh = Math.min(bw * 1.15, (caja.h - (r.filas - 1) * hueco) / r.filas)
  const altoTotal = r.filas * bh + (r.filas - 1) * hueco
  const y0 = caja.y + (caja.h - altoTotal) / 2
  rondas.slice(0, r.visibles).forEach((p, i) => {
    const col = i % r.columnas
    const fila = Math.floor(i / r.columnas)
    baldosa(ctx, p, i, { x: caja.x + col * (bw + hueco), y: y0 + fila * (bh + hueco), w: bw, h: bh })
  })
  if (r.fuera) {
    const i = r.visibles
    const x = caja.x + (i % r.columnas) * (bw + hueco)
    const y = y0 + Math.floor(i / r.columnas) * (bh + hueco)
    ctx.save()
    ctx.fillStyle = P.panel2
    redondeado(ctx, x, y, bw, bh, Math.min(28, bh / 6))
    ctx.fill()
    ctx.restore()
    textoCentrado(ctx, `y ${r.fuera} más`, { cx: x + bw / 2, y: y + bh / 2 + 12, cuerpo: Math.round(Math.min(bw, bh) * 0.16), fuente: TITULAR, peso: 700, color: P.suave, maxAncho: bw - 16 })
  }
  return cxMarca
}

const DIBUJO = { clasico: disenoClasico, podio: disenoPodio, record: disenoRecord, mosaico: disenoMosaico }

// t: { nombre, donde, fecha, mazo, rondas, puesto?, jugadores? }; eleccion:
// { diseno, fondo, puesto } (lo que no venga, lo de siempre: el Clásico sobre
// Noche, con el puesto si se sabe).
export function pintarTorneo(lienzo, t, formato = 'historia', eleccion = {}) {
  const e = eleccionValida(eleccion)
  const pu = e.puesto ? textoDePuesto(t.puesto, t.jugadores) : null
  const { ctx, w, h, larga } = prepararLienzo(lienzo, formato, { fondo: e.fondo, tono: tonoDe({ rondas: t.rondas, puesto: t.puesto, jugadores: t.jugadores, conPuesto: e.puesto }) })
  const apaisada = formato === 'apaisada'
  const margen = apaisada ? 56 : 72
  rotulo(ctx, 'Mis torneos', { x: margen, y: apaisada ? 68 : 118, cuerpo: apaisada ? 24 : 32 })
  const datos = { w, h, apaisada, margen, rec: recordDe(t.rondas), pu, lugar: lugarYFecha(t.donde, t.fecha) }
  const cx = DIBUJO[e.diseno](ctx, t, datos)
  marcaAbajo(ctx, { w, h, larga, apaisada, cx: apaisada ? cx : w / 2 })
  return lienzo
}

// ── Cargar los sprites y abrir la hoja ──

// Un sprite para el lienzo: la CDN de Limitless pasa por /sprite (nuestra,
// con permiso CORS) y luego la cadena de respaldos (jsDelivr, GitHub), como
// la imagen del meta. Sin ninguno que cargue, null: el dibujo pone la Poké Ball.
async function cargarSprite(url) {
  const [{ cadenaDeRespaldos }, { fuenteDeSprite, cajaVisible }] = await Promise.all([import('./torneos/sprites-pokemon.js'), import('./torneos/sprite-lienzo.js')])
  for (const u of [...new Set([url, ...cadenaDeRespaldos(url)].map(fuenteDeSprite))]) {
    const img = await new Promise((ok) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      const fin = setTimeout(() => ok(null), 6000)
      i.onload = () => { clearTimeout(fin); ok(i) }
      i.onerror = () => { clearTimeout(fin); ok(null) }
      i.src = u
    })
    if (img) return { img, caja: cajaVisible(img) }
  }
  return null
}

const cache = new Map()
const spritesDe = (urls) => Promise.all((urls || []).slice(0, 2).map((u) => {
  if (!cache.has(u)) cache.set(u, cargarSprite(u).catch(() => null))
  return cache.get(u)
}))
const conSprites = async (mazo) => (mazo ? { ...mazo, sprites: (await spritesDe(mazo.urls)).filter(Boolean) } : null)

const nombreDeFichero = (s) => String(s || 'pokedoc').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'pokedoc'

// Lo último que se eligió en la hoja, por persona y navegador: quien comparte
// siempre con el mismo diseño no tiene que volver a elegirlo.
const CLAVE_ELECCION = 'pokedoc-imagen-partidas'

// p: { mio: { nombre, urls }, rival: { nombre, urls }, resultado, tipo, formato, juegos, donde, fecha }
export async function compartirPartida(p) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const listo = Promise.all([conSprites(p.mio), conSprites(p.rival)]).then(([mio, rival]) => ({ ...p, mio, rival }))
  return abrirHojaCompartir({
    titulo: 'Compartir la partida',
    texto: textoDePartida(p),
    nombre: `partida-${nombreDeFichero(`${p.mio?.nombre || ''}-vs-${p.rival?.nombre || ''}`)}`,
    historiaPropia: true,
    opciones: { fondos: FONDOS, recordar: CLAVE_ELECCION },
    imagen: async (formato, eleccion) => pintarPartida(document.createElement('canvas'), await listo, formato, eleccion),
  })
}

// t: { nombre, donde, fecha, mazo: { nombre, urls }, puesto, jugadores, rondas: [{ rival: { nombre, urls }, resultado, tipo, formato, juegos }] }
export async function compartirTorneo(t) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const listo = Promise.all([conSprites(t.mazo), ...(t.rondas || []).map((r) => conSprites(r.rival))])
    .then(([mazo, ...rivales]) => ({ ...t, mazo, rondas: (t.rondas || []).map((r, i) => ({ ...r, rival: rivales[i] })) }))
  return abrirHojaCompartir({
    titulo: 'Compartir el torneo',
    texto: (eleccion) => textoDeTorneo(t, eleccion),
    nombre: `torneo-${nombreDeFichero(t.nombre)}`,
    historiaPropia: true,
    opciones: { disenos: DISENOS, fondos: FONDOS, puesto: Boolean(textoDePuesto(t.puesto, t.jugadores)), recordar: CLAVE_ELECCION },
    imagen: async (formato, eleccion) => pintarTorneo(document.createElement('canvas'), await listo, formato, eleccion),
  })
}
