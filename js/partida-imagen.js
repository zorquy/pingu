// Compartir una partida o un torneo de /mis-partidas en una imagen (tanda
// 997). PINGU: «imagínate que haces un torneo y lo acabas y quieres
// compartir el resultado… que genere una imagen con el resultado, así
// bonito, que ponga PokeDoc».
//
// Entra por `import()` al pulsar «Compartir»: la página no lo baja hasta
// entonces. La hoja es la de siempre (`compartir-hoja.js`: Instagram en
// historia o publicación, X, compartir y descargar) y el marco el de los
// retos (`reto-imagen.js`: fondo, la «P» con «PokeDoc · …» y la píldora con
// el enlace), para que todo lo que sale de PokeDoc se reconozca igual.
//
// Lo puro (los textos, qué rondas caben) va exportado para probarlo en Node;
// el dibujo recibe los sprites ya cargados (`img` o null), así que la prueba
// puede dibujar sin red.
import { redondeado } from './imagen-compartir.js'
import { fondo, cabecera, invitacionAbajo, medidasDe } from './reto-imagen.js'

export const ENLACE = 'pokedoc.es'
const TITULAR = 'Fredoka, Inter, sans-serif'
const TEXTO = 'Inter, sans-serif'

// Los colores del resultado: los mismos verdes y rojos de los cuadrados de
// los retos, y el ámbar de la casa para el empate.
export const RESULTADO = {
  win: { palabra: 'Victoria', letra: 'V', color: '#2e9e5b', emoji: '✅' },
  loss: { palabra: 'Derrota', letra: 'D', color: '#d64545', emoji: '❌' },
  draw: { palabra: 'Empate', letra: 'E', color: '#c98500', emoji: '🤝' },
}
const DE_JUEGO = { W: 'win', L: 'loss', T: 'draw' }
const TIPO = { id: 'ID (empate pactado)', no_show: 'El rival no se presentó', bye: 'Bye' }

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

export function textoDeTorneo(t) {
  const { texto } = recordDe(t.rondas)
  const lugar = lugarYFecha(t.donde, t.fecha)
  return [
    `🏆 ${t.nombre}: ${texto}${t.mazo?.nombre ? ` con ${t.mazo.nombre}` : ''}`,
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
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
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

function pildora(ctx, texto, { cx, y, alto, color, cuerpo, anchoMin = 0 }) {
  ctx.save()
  ctx.font = `700 ${cuerpo}px ${TITULAR}`
  const ancho = Math.max(anchoMin, ctx.measureText(texto).width + alto)
  ctx.fillStyle = color
  redondeado(ctx, cx - ancho / 2, y, ancho, alto, alto / 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.fillText(texto, cx, y + alto / 2 + cuerpo * 0.36)
  ctx.restore()
  return ancho
}

function circuloDeMazo(ctx, { cx, cy, r }) {
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function textoCentrado(ctx, texto, { cx, y, cuerpo, color = '#fff', peso = 600, fuente = TEXTO, maxAncho = 900 }) {
  ctx.save()
  ctx.font = `${peso} ${cuerpo}px ${fuente}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(recortar(ctx, texto, maxAncho), cx, y)
  ctx.restore()
}

// Los juegos de un mejor de tres: «V D V» en cuadraditos y el marcador.
function juegos(ctx, lista, { cx, y, lado }) {
  const hueco = lado * 0.25
  const total = lista.length * lado + (lista.length - 1) * hueco
  let x = cx - total / 2
  for (const j of lista) {
    const r = RESULTADO[DE_JUEGO[j.r]] || RESULTADO.draw
    ctx.fillStyle = r.color
    redondeado(ctx, x, y, lado, lado, lado / 4)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(lado * 0.5)}px ${TITULAR}`
    ctx.textAlign = 'center'
    ctx.fillText(r.letra, x + lado / 2, y + lado * 0.68)
    x += lado + hueco
  }
}

export function pintarPartida(lienzo, p, formato = 'historia') {
  const { w, h } = medidasDe(formato)
  lienzo.width = w
  lienzo.height = h
  const ctx = lienzo.getContext('2d')
  fondo(ctx, w, h)
  const r = RESULTADO[p.resultado] || RESULTADO.draw
  const apaisada = formato === 'apaisada'
  const margen = apaisada ? 56 : 72
  cabecera(ctx, { x: margen, y: apaisada ? 72 : 118, ancho: w - margen * 2, arriba: 'PokeDoc · Mis partidas', cuerpo: apaisada ? 30 : 40 })
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
      textoCentrado(ctx, 'Bye', { cx, y: cy + 22, cuerpo: apaisada ? 48 : 64, fuente: TITULAR, peso: 700, color: 'rgba(255,255,255,0.7)' })
      continue
    }
    circuloDeMazo(ctx, { cx, cy, r: rMazo })
    sprites(ctx, mazo?.sprites, { cx, cy, lado: rMazo * 1.5 })
    textoCentrado(ctx, etiqueta, { cx, y: cy - rMazo - (apaisada ? 14 : 24), cuerpo: apaisada ? 22 : 30, color: 'rgba(255,255,255,0.7)' })
    const cuerpo = ajustar(ctx, mazo?.nombre || '—', apaisada ? 34 : 46, apaisada ? 380 : 420)
    textoCentrado(ctx, mazo?.nombre || '—', { cx, y: cy + rMazo + (apaisada ? 46 : 70), cuerpo, fuente: TITULAR, peso: 700, maxAncho: apaisada ? 380 : 420 })
  }
  textoCentrado(ctx, 'VS', { cx: w / 2, y: cy + (apaisada ? 16 : 24), cuerpo: apaisada ? 44 : 64, fuente: TITULAR, peso: 700, color: '#ffd166' })
  let y = cy + rMazo + (apaisada ? 92 : 150)
  if (marcador && !apaisada) {
    juegos(ctx, p.juegos, { cx: w / 2, y, lado: 72 })
    y += 130
  }
  const nota = TIPO[p.tipo] && !bye ? TIPO[p.tipo] : ''
  const lugar = lugarYFecha(p.donde, p.fecha)
  if (nota) {
    textoCentrado(ctx, nota, { cx: w / 2, y, cuerpo: apaisada ? 24 : 32, color: 'rgba(255,255,255,0.8)' })
    y += apaisada ? 36 : 50
  }
  if (lugar && !apaisada) textoCentrado(ctx, lugar, { cx: w / 2, y, cuerpo: 32, color: 'rgba(255,255,255,0.8)', maxAncho: w - margen * 2 })
  if (lugar && apaisada) {
    ctx.save()
    ctx.font = `500 22px ${TEXTO}`
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.textAlign = 'right'
    ctx.fillText(recortar(ctx, lugar, 520), w - margen, 72)
    ctx.restore()
  }
  if (!apaisada) invitacionAbajo(ctx, { cx: w / 2, y: h - 170, ancho: 720, alto: 96, texto: 'Apunta las tuyas en', enlace: ENLACE, cuerpo: 36 })
  else invitacionAbajo(ctx, { cx: w / 2, y: h - 78, ancho: 520, alto: 54, texto: 'Apunta las tuyas en', enlace: ENLACE, cuerpo: 24 })
  return lienzo
}

export function pintarTorneo(lienzo, t, formato = 'historia') {
  const { w, h } = medidasDe(formato)
  lienzo.width = w
  lienzo.height = h
  const ctx = lienzo.getContext('2d')
  fondo(ctx, w, h)
  const apaisada = formato === 'apaisada'
  const margen = apaisada ? 56 : 72
  cabecera(ctx, { x: margen, y: apaisada ? 72 : 118, ancho: w - margen * 2, arriba: 'PokeDoc · Mis torneos', cuerpo: apaisada ? 30 : 40 })
  const rec = recordDe(t.rondas)
  const colorRec = rec.win > rec.loss ? RESULTADO.win.color : rec.loss > rec.win ? RESULTADO.loss.color : RESULTADO.draw.color
  const lugar = lugarYFecha(t.donde, t.fecha)

  const leyenda = [`${rec.win} ${rec.win === 1 ? 'victoria' : 'victorias'}`, `${rec.loss} ${rec.loss === 1 ? 'derrota' : 'derrotas'}`, ...(rec.draw ? [`${rec.draw} ${rec.draw === 1 ? 'empate' : 'empates'}`] : [])].join(' · ')
  let caja
  if (apaisada) {
    // A la izquierda: el torneo, el mazo y el récord; las rondas, a la derecha.
    const colX = margen + 240
    const colAncho = 440
    let y = 140
    let c = ajustar(ctx, t.nombre || 'Torneo', 40, colAncho)
    textoCentrado(ctx, t.nombre || 'Torneo', { cx: colX, y, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: colAncho })
    y += 36
    if (lugar) textoCentrado(ctx, lugar, { cx: colX, y, cuerpo: 20, color: 'rgba(255,255,255,0.75)', maxAncho: colAncho })
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
    textoCentrado(ctx, leyenda, { cx: colX, y: y + 36, cuerpo: 20, color: 'rgba(255,255,255,0.75)' })
    caja = { x: margen + 520, y: 112, w: w - margen * 2 - 520, h: h - 112 - 100 }
  } else {
    // Arriba el torneo y, en una banda, el mazo con el récord al lado: así
    // caben hasta doce rondas debajo.
    const ancho = w - margen * 2
    const c = ajustar(ctx, t.nombre || 'Torneo', 64, ancho)
    textoCentrado(ctx, t.nombre || 'Torneo', { cx: w / 2, y: 232, cuerpo: c, fuente: TITULAR, peso: 700, maxAncho: ancho })
    if (lugar) textoCentrado(ctx, lugar, { cx: w / 2, y: 284, cuerpo: 30, color: 'rgba(255,255,255,0.75)', maxAncho: ancho })
    const banda = { x: margen, y: 326, w: ancho, h: 196 }
    ctx.save()
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
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
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ajustar(ctx, t.mazo?.nombre || 'Mi mazo', 38, tAncho, 700, TITULAR)
    ctx.fillText(recortar(ctx, t.mazo?.nombre || 'Mi mazo', tAncho), tx, banda.y + 70)
    ctx.font = `700 112px ${TITULAR}`
    ctx.fillStyle = colorRec
    ctx.fillText(rec.texto, tx, banda.y + 168)
    const anchoRec = ctx.measureText(rec.texto).width
    ctx.font = `500 26px ${TEXTO}`
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    const resto = tAncho - anchoRec - 28
    // Entera o nada: «2 e…» no dice nada que el récord no diga mejor.
    if (ctx.measureText(leyenda).width <= resto) ctx.fillText(leyenda, tx + anchoRec + 28, banda.y + 160)
    ctx.restore()
    caja = { x: margen, y: banda.y + banda.h + 32, w: ancho, h: h - (banda.y + banda.h + 32) - 190 }
  }

  // Las rondas, una por fila.
  // La fila mide lo que quepa: hasta 74 px (52 en la apaisada) y no menos de
  // 48 (40); lo que no entre ni así se cuenta en «y N más».
  const altoFila = apaisada ? 52 : 74
  const minimo = apaisada ? 40 : 48
  const max = Math.max(1, Math.floor(caja.h / minimo))
  const { visibles, fuera } = rondasQueCaben(t.rondas, max)
  const fila = Math.max(minimo, Math.min(altoFila, Math.floor(caja.h / Math.max(1, visibles.length + (fuera ? 1 : 0)))))
  visibles.forEach((p, i) => {
    const fy = caja.y + i * fila
    ctx.save()
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)'
    redondeado(ctx, caja.x, fy + 3, caja.w, fila - 6, (fila - 6) / 3)
    ctx.fill()
    const medio = fy + fila / 2
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `700 ${Math.round(fila * 0.34)}px ${TITULAR}`
    ctx.textAlign = 'left'
    ctx.fillText(`R${p.ronda ?? i + 1}`, caja.x + 18, medio + fila * 0.12)
    const xSprite = caja.x + fila * 1.25
    if (p.tipo !== 'bye') sprites(ctx, p.rival?.sprites, { cx: xSprite + fila * 0.45, cy: medio, lado: fila * 0.95 })
    ctx.fillStyle = '#fff'
    ctx.font = `600 ${Math.round(fila * 0.36)}px ${TEXTO}`
    const marcador = p.formato === 'bo3' ? marcadorDe(p.juegos) : ''
    const derecha = fila * 1.1 + (marcador ? fila * 0.9 : 0)
    const nombre = p.tipo === 'bye' ? 'Bye' : `${p.rival?.nombre || '—'}${TIPO[p.tipo] && p.tipo !== 'bye' ? ` · ${p.tipo === 'id' ? 'ID' : 'no se presentó'}` : ''}`
    ctx.fillText(recortar(ctx, nombre, caja.w - (xSprite - caja.x) - fila * 1.1 - derecha), xSprite + fila * 1.05, medio + fila * 0.13)
    const r = RESULTADO[p.resultado] || RESULTADO.draw
    const l = fila * 0.66
    ctx.fillStyle = r.color
    redondeado(ctx, caja.x + caja.w - l - 14, medio - l / 2, l, l, l / 4)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = `700 ${Math.round(l * 0.55)}px ${TITULAR}`
    ctx.fillText(r.letra, caja.x + caja.w - l / 2 - 14, medio + l * 0.2)
    if (marcador) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = `600 ${Math.round(fila * 0.32)}px ${TEXTO}`
      ctx.textAlign = 'right'
      ctx.fillText(marcador, caja.x + caja.w - l - 30, medio + fila * 0.12)
    }
    ctx.restore()
  })
  if (fuera) textoCentrado(ctx, `y ${fuera} ${fuera === 1 ? 'ronda' : 'rondas'} más`, { cx: caja.x + caja.w / 2, y: caja.y + visibles.length * fila + fila * 0.62, cuerpo: Math.round(fila * 0.34), color: 'rgba(255,255,255,0.7)' })
  if (!t.rondas?.length) textoCentrado(ctx, 'Sin rondas todavía', { cx: caja.x + caja.w / 2, y: caja.y + 60, cuerpo: apaisada ? 24 : 32, color: 'rgba(255,255,255,0.7)' })

  if (!apaisada) invitacionAbajo(ctx, { cx: w / 2, y: h - 150, ancho: 720, alto: 96, texto: 'Apunta los tuyos en', enlace: ENLACE, cuerpo: 36 })
  else invitacionAbajo(ctx, { cx: margen + 240, y: h - 78, ancho: 440, alto: 54, texto: 'Apunta los tuyos en', enlace: ENLACE, cuerpo: 22 })
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

// p: { mio: { nombre, urls }, rival: { nombre, urls }, resultado, tipo, formato, juegos, donde, fecha }
export async function compartirPartida(p) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const listo = Promise.all([conSprites(p.mio), conSprites(p.rival)]).then(([mio, rival]) => ({ ...p, mio, rival }))
  return abrirHojaCompartir({
    titulo: 'Compartir la partida',
    texto: textoDePartida(p),
    nombre: `partida-${nombreDeFichero(`${p.mio?.nombre || ''}-vs-${p.rival?.nombre || ''}`)}`,
    imagen: async (formato) => pintarPartida(document.createElement('canvas'), await listo, formato),
  })
}

// t: { nombre, donde, fecha, mazo: { nombre, urls }, rondas: [{ rival: { nombre, urls }, resultado, tipo, formato, juegos }] }
export async function compartirTorneo(t) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  const listo = Promise.all([conSprites(t.mazo), ...(t.rondas || []).map((r) => conSprites(r.rival))])
    .then(([mazo, ...rivales]) => ({ ...t, mazo, rondas: (t.rondas || []).map((r, i) => ({ ...r, rival: rivales[i] })) }))
  return abrirHojaCompartir({
    titulo: 'Compartir el torneo',
    texto: textoDeTorneo(t),
    nombre: `torneo-${nombreDeFichero(t.nombre)}`,
    imagen: async (formato) => pintarTorneo(document.createElement('canvas'), await listo, formato),
  })
}
