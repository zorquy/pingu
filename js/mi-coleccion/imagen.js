// «Mi colección en una imagen» (tanda 571): el dibujo. La máquina —fotos
// con permiso, exportar, compartir— está en js/imagen-compartir.js.
//
// Esto no lo puede hacer PTCGenius ni TCGdex: no tienen tu colección.
// Desde la 691 son CUATRO dibujos sin un solo euro, pensados para una
// cadena en Twitter e Instagram (PINGU: «no quiero centrarme en la pasta,
// eso es privado; que se centre en cuántos Pokémon, tu Pokémon, el que
// más tienes, datos sobre las cartas»), y se pasa de uno a otro en el
// diálogo (la 689):
//
//   · equipo  — tu equipo de 6: los Pokémon de los que más cartas tienes,
//               el líder grande con sus cartas, y las medallas.
//   · perfil  — qué coleccionista eres: un perfil con nombre, cuatro
//               rasgos y de qué son tus cartas.
//   · viaje   — tu viaje en el tiempo: la carta más antigua y la más
//               nueva, los años entre ellas y tus cartas por época.
//   · pokedex — especies sobre 1.025, tipos, regiones y trofeos.
//
// 1080 × 1350, el retrato de Instagram. Los colores van a pelo porque no
// es la página: es una imagen que se ve fuera, donde no hay tema claro ni
// oscuro. Los números los cuenta js/mi-coleccion/imagen-datos.js.
import { fotoParaElLienzo, dibujarCarta, redondeado } from '../imagen-compartir.js'

export const ANCHO = 1080
export const ALTO = 1350

// ── Lo común ──
const F_TITULO = '700 64px Fredoka, Inter, sans-serif'
const F_SUB = '500 28px Inter, sans-serif'
const BLANCO = '#ffffff'
const SUAVE = 'rgba(255,255,255,0.72)'
const VERDE = '#6fd3a0'
const AMARILLO = '#e8c547'
const PROPORCION = 342 / 245

async function lienzoLimpio(lienzo, c1, c2) {
  const ctx = lienzo.getContext('2d')
  await document.fonts.ready
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const grad = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
  grad.addColorStop(0, c1)
  grad.addColorStop(1, c2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, ANCHO, ALTO)
  return ctx
}

function texto(ctx, str, x, y, { font = F_SUB, color = BLANCO, align = 'left' } = {}) {
  ctx.textAlign = align
  ctx.fillStyle = color
  ctx.font = font
  ctx.fillText(String(str), x, y)
}

// Recorta un texto con «…» para que quepa en `ancho`.
function recortado(ctx, str, ancho, font) {
  ctx.font = font
  let t = String(str)
  if (ctx.measureText(t).width <= ancho) return t
  while (t.length > 1 && ctx.measureText(`${t}…`).width > ancho) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function caja(ctx, x, y, w, h, { r = 22, color = 'rgba(255,255,255,0.08)' } = {}) {
  redondeado(ctx, x, y, w, h, r)
  ctx.fillStyle = color
  ctx.fill()
}

// Una chapa redonda con texto, centrada en `cx`.
function chapa(ctx, str, cx, y, { font = '700 28px Inter, sans-serif', bg = 'rgba(255,255,255,0.12)', color = BLANCO, px = 26, alto = 52 } = {}) {
  ctx.font = font
  const w = ctx.measureText(str).width + px * 2
  caja(ctx, cx - w / 2, y, w, alto, { r: alto / 2, color: bg })
  texto(ctx, str, cx, y + alto / 2 + 10, { font, color, align: 'center' })
  return w
}

function cifraPequena(ctx, cx, y, valor, rotulo) {
  texto(ctx, valor, cx, y, { font: '700 40px Fredoka, Inter, sans-serif', align: 'center' })
  texto(ctx, rotulo, cx, y + 34, { font: '500 22px Inter, sans-serif', color: SUAVE, align: 'center' })
}

function pieDeMarca(ctx, datos, { y = ALTO - 40 } = {}) {
  const quien = datos.quien ? `@${datos.quien} ·` : ''
  ctx.font = '500 26px Inter, sans-serif'
  // El hueco tras el punto se pone a mano: un espacio al final de lo que
  // se mide no cuenta igual en todos los navegadores.
  const a = quien ? ctx.measureText(quien).width + 10 : 0
  ctx.font = '800 26px Inter, sans-serif'
  const b = ctx.measureText('pokedoc.es').width
  ctx.font = '500 26px Inter, sans-serif'
  const c = ctx.measureText('/mi-coleccion').width
  let x = ANCHO / 2 - (a + b + c) / 2
  texto(ctx, quien, x, y, { color: SUAVE })
  x += a
  texto(ctx, 'pokedoc.es', x, y, { font: '800 26px Inter, sans-serif' })
  x += b
  texto(ctx, '/mi-coleccion', x, y, { color: SUAVE })
}

// La carta girada: un cuadro con sombra y la foto dentro.
function cartaGirada(ctx, img, { cx, cy, w, h, grados, nombre, r = 18 }) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((grados * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 24
  redondeado(ctx, -w / 2, -h / 2, w, h, r)
  ctx.fillStyle = '#0f151c'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  dibujarCarta(ctx, img, { x: -w / 2, y: -h / 2, w, h, r, nombre })
  ctx.restore()
}


// Un sprite redondo: la foto dentro de un círculo de color y, si no llega,
// la inicial del nombre.
function spriteRedondo(ctx, img, { cx, cy, r, color, nombre }) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.4)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 12
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
  if (img) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    const lado = r * 1.5
    ctx.drawImage(img, cx - lado / 2, cy - lado / 2, lado, lado)
    ctx.restore()
  } else {
    texto(ctx, String(nombre || '?').slice(0, 1).toUpperCase(), cx, cy + r * 0.32, { font: `800 ${Math.round(r * 0.9)}px Fredoka, Inter, sans-serif`, color: '#0b1118', align: 'center' })
  }
}

const COLORES_EQUIPO = ['#ffd84a', '#ff7a3d', '#d77dff', '#4aa8ff', '#b8c4cc', '#6fd36f']

// ── equipo: tu equipo de 6 ──
async function pintarEquipo(lienzo, datos) {
  const ctx = await lienzoLimpio(lienzo, '#27507a', '#0b1118')
  const equipo = (datos.equipo || []).slice(0, 6)
  texto(ctx, 'Mi equipo de 6', 80, 130, { font: F_TITULO })
  texto(ctx, `${datos.quien ? `@${datos.quien} · ` : ''}los Pokémon de los que más cartas tengo`, 80, 176, { color: SUAVE })
  if (!equipo.length) {
    texto(ctx, 'Todavía sin Pokémon', ANCHO / 2, 600, { font: '700 48px Fredoka, Inter, sans-serif', align: 'center' })
    pieDeMarca(ctx, datos)
    return
  }
  const sprites = await Promise.all(equipo.map((m) => fotoParaElLienzo(m.sprites)))
  // El líder, grande.
  const lider = equipo[0]
  caja(ctx, 80, 230, ANCHO - 160, 290, { r: 26, color: 'rgba(232,197,71,0.16)' })
  spriteRedondo(ctx, sprites[0], { cx: 230, cy: 375, r: 110, color: COLORES_EQUIPO[0], nombre: lider.nombre })
  texto(ctx, 'EL LÍDER', 370, 316, { font: '800 22px Inter, sans-serif', color: AMARILLO })
  texto(ctx, recortado(ctx, lider.nombre, ANCHO - 80 - 370, '700 64px Fredoka, Inter, sans-serif'), 370, 382, { font: '700 64px Fredoka, Inter, sans-serif' })
  ctx.font = '700 26px Inter, sans-serif'
  const chapaLider = `${lider.cartas} ${lider.cartas === 1 ? 'carta' : 'cartas'} · ${lider.expansiones} ${lider.expansiones === 1 ? 'expansión' : 'expansiones'}${lider.desde ? ` · desde ${lider.desde}` : ''}`
  chapa(ctx, chapaLider, 370 + ctx.measureText(chapaLider).width / 2 + 18, 408, { font: '700 26px Inter, sans-serif', px: 18, alto: 50 })
  // Los otros cinco.
  const resto = equipo.slice(1)
  const wm = (ANCHO - 160 - 16 * 4) / 5
  resto.forEach((m, i) => {
    const x = 80 + i * (wm + 16)
    caja(ctx, x, 544, wm, 256, { r: 26 })
    spriteRedondo(ctx, sprites[i + 1], { cx: x + wm / 2, cy: 628, r: 60, color: COLORES_EQUIPO[i + 1], nombre: m.nombre })
    texto(ctx, recortado(ctx, m.nombre, wm - 20, '700 28px Fredoka, Inter, sans-serif'), x + wm / 2, 730, { font: '700 28px Fredoka, Inter, sans-serif', align: 'center' })
    chapa(ctx, `${m.cartas} ${m.cartas === 1 ? 'carta' : 'cartas'}`, x + wm / 2, 748, { font: '700 20px Inter, sans-serif', px: 14, alto: 38 })
  })
  // Las medallas.
  const medallas = []
  if (datos.mejorSet && datos.mejorSet.tengo >= datos.mejorSet.total) medallas.push({ t: `${datos.mejorSet.nombre} 100 %`, oro: true })
  if (datos.pokedex?.especies) medallas.push({ t: `${datos.pokedex.especies} Pokémon` })
  if (datos.sets) medallas.push({ t: `${datos.sets} ${datos.sets === 1 ? 'expansión' : 'expansiones'}` })
  if (datos.viaje?.antigua?.anio) medallas.push({ t: `desde ${datos.viaje.antigua.anio}` })
  let x = 80
  texto(ctx, 'Medallas', x, 902, { font: '500 24px Inter, sans-serif', color: SUAVE })
  x += 130
  for (const m of medallas) {
    ctx.font = '600 22px Inter, sans-serif'
    const w = ctx.measureText(m.t).width + 36
    if (x + w > ANCHO - 80) break
    chapa(ctx, m.t, x + w / 2, 870, { font: '600 22px Inter, sans-serif', bg: m.oro ? AMARILLO : 'rgba(255,255,255,0.1)', color: m.oro ? '#1a1300' : BLANCO, px: 18, alto: 46 })
    x += w + 14
  }
  // Las cartas del líder.
  const ejemplos = (lider.ejemplos || []).slice(0, 5)
  const fotos = await Promise.all(ejemplos.map((e) => fotoParaElLienzo(e.cadena)))
  const cw = 148
  const ch = Math.round(cw * PROPORCION)
  const huecos = ejemplos.length + (lider.cartas > ejemplos.length ? 1 : 0)
  const x0 = Math.round((ANCHO - (huecos * cw + (huecos - 1) * 14)) / 2)
  ejemplos.forEach((e, i) => dibujarCarta(ctx, fotos[i], { x: x0 + i * (cw + 14), y: 960, w: cw, h: ch, r: 10, nombre: e.nombre }))
  if (lider.cartas > ejemplos.length) {
    const x = x0 + ejemplos.length * (cw + 14)
    ctx.save()
    ctx.setLineDash([10, 10])
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 2
    redondeado(ctx, x, 960, cw, ch, 10)
    ctx.stroke()
    ctx.restore()
    texto(ctx, `+${lider.cartas - ejemplos.length}`, x + cw / 2, 960 + ch / 2 + 12, { font: '700 34px Inter, sans-serif', align: 'center' })
  }
  texto(ctx, 'Enseña tu equipo', ANCHO / 2, ALTO - 84, { font: '500 26px Inter, sans-serif', color: SUAVE, align: 'center' })
  pieDeMarca(ctx, datos, { y: ALTO - 44 })
}

// ── perfil: qué coleccionista eres ──
async function pintarPerfil(lienzo, datos) {
  const ctx = await lienzoLimpio(lienzo, '#3b1d5e', '#0b1118')
  const p = datos.perfil
  texto(ctx, 'Qué coleccionista soy', 80, 130, { font: F_TITULO })
  texto(ctx, `${datos.quien ? `@${datos.quien} · ` : ''}según mis cartas`, 80, 176, { color: SUAVE })
  if (!p) {
    texto(ctx, 'Todavía sin cartas', ANCHO / 2, 600, { font: '700 48px Fredoka, Inter, sans-serif', align: 'center' })
    pieDeMarca(ctx, datos)
    return
  }
  texto(ctx, 'MI PERFIL', ANCHO / 2, 250, { font: '800 26px Inter, sans-serif', color: '#f3a0d8', align: 'center' })
  const fuente = ctx.measureText(p.perfil.nombre).width > 0 && p.perfil.nombre.length > 18 ? '700 72px Fredoka, Inter, sans-serif' : '700 92px Fredoka, Inter, sans-serif'
  texto(ctx, recortado(ctx, p.perfil.nombre, ANCHO - 160, fuente), ANCHO / 2, 350, { font: fuente, align: 'center' })
  texto(ctx, recortado(ctx, p.perfil.frase, ANCHO - 160, F_SUB), ANCHO / 2, 410, { color: 'rgba(255,255,255,0.78)', align: 'center' })
  // Los cuatro rasgos.
  const rasgos = [
    { r: 'Brillo', b: `${Math.round(p.brillo * 100)} %`, s: 'holo, reverse o especiales' },
    { r: 'Región favorita', b: p.region?.nombre || '—', s: p.region ? `${p.region.cuenta} de ${p.pokemon} Pokémon` : 'sin Pokémon todavía' },
    { r: 'Tipo favorito', b: p.tipo?.nombre || '—', s: p.tipo ? `${p.tipo.cuenta} ${p.tipo.cuenta === 1 ? 'carta' : 'cartas'}` : '' },
    { r: 'Fetiche', b: p.fetiche?.nombre || '—', s: p.fetiche ? `${p.fetiche.veces} cartas distintas` : 'ninguno repetido' },
  ]
  const wr = (ANCHO - 160 - 20) / 2
  rasgos.forEach((x, i) => {
    const px = 80 + (i % 2) * (wr + 20)
    const py = 470 + Math.floor(i / 2) * 184
    caja(ctx, px, py, wr, 164, { r: 22 })
    texto(ctx, x.r, px + 28, py + 44, { font: '500 22px Inter, sans-serif', color: 'rgba(255,255,255,0.65)' })
    texto(ctx, recortado(ctx, x.b, wr - 56, '700 44px Fredoka, Inter, sans-serif'), px + 28, py + 98, { font: '700 44px Fredoka, Inter, sans-serif' })
    texto(ctx, recortado(ctx, x.s, wr - 56, '500 22px Inter, sans-serif'), px + 28, py + 136, { font: '500 22px Inter, sans-serif', color: 'rgba(255,255,255,0.75)' })
  })
  // De qué son las cartas.
  const partes = [['Pokémon', p.pokemon, VERDE], ['Entrenadores', p.entrenadores, '#4aa8ff'], ['Energías', p.energias, AMARILLO]].filter((x) => x[1] > 0)
  const suma = partes.reduce((a, x) => a + x[1], 0) || 1
  texto(ctx, `De qué son mis ${p.total} cartas`, 80, 900, { font: '600 24px Inter, sans-serif', color: SUAVE })
  ctx.save()
  redondeado(ctx, 80, 920, ANCHO - 160, 40, 20)
  ctx.clip()
  let x = 80
  for (const [, n, color] of partes) {
    const w = Math.round(((ANCHO - 160) * n) / suma)
    ctx.fillStyle = color
    ctx.fillRect(x, 920, w, 40)
    x += w
  }
  ctx.restore()
  x = 80
  for (const [nombre, n, color] of partes) {
    ctx.beginPath()
    ctx.arc(x + 7, 996, 7, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    const t = `${nombre} ${Math.round((n / suma) * 100)} %`
    texto(ctx, t, x + 24, 1004, { font: '500 22px Inter, sans-serif', color: 'rgba(255,255,255,0.8)' })
    ctx.font = '500 22px Inter, sans-serif'
    x += 24 + ctx.measureText(t).width + 28
  }
  // Las tres cartas de firma: el fetiche si lo hay, si no las más antiguas.
  const firma = (datos.firma || []).slice(0, 3)
  const fotos = await Promise.all(firma.map((v) => fotoParaElLienzo(v.cadena)))
  const cw = 120
  const ch = Math.round(cw * PROPORCION)
  firma.forEach((v, i) => dibujarCarta(ctx, fotos[i], { x: 80 + i * (cw + 20), y: 1060, w: cw, h: ch, r: 10, nombre: v.nombre }))
  const xTexto = 80 + firma.length * (cw + 20) + (firma.length ? 20 : 0)
  texto(ctx, recortado(ctx, datos.desde || 'Mi colección en PokeDoc', ANCHO - 80 - xTexto, '700 26px Inter, sans-serif'), xTexto, 1130, { font: '700 26px Inter, sans-serif' })
  texto(ctx, '¿Y tú? · pokedoc.es/mi-coleccion', xTexto, 1170, { font: '500 24px Inter, sans-serif', color: SUAVE })
}

// ── viaje: la más antigua, la más nueva, y las épocas ──
async function pintarViaje(lienzo, datos) {
  const ctx = await lienzoLimpio(lienzo, '#1a2b3d', '#0d131a')
  const v = datos.viaje
  texto(ctx, 'Mi viaje en el tiempo', 80, 130, { font: F_TITULO })
  texto(ctx, `${datos.quien ? `@${datos.quien} · ` : ''}de mi carta más antigua a la más nueva`, 80, 176, { color: SUAVE })
  if (!v) {
    texto(ctx, 'Todavía sin fechas', ANCHO / 2, 600, { font: '700 48px Fredoka, Inter, sans-serif', align: 'center' })
    pieDeMarca(ctx, datos)
    return
  }
  const [fa, fn] = await Promise.all([fotoParaElLienzo(v.antigua.cadena), fotoParaElLienzo(v.nueva.cadena)])
  const cw = 260
  const ch = Math.round(cw * PROPORCION)
  const extremo = (cx, foto, carta, rotulo) => {
    texto(ctx, rotulo, cx, 250, { font: '800 22px Inter, sans-serif', color: AMARILLO, align: 'center' })
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 16
    redondeado(ctx, cx - cw / 2, 272, cw, ch, 16)
    ctx.fillStyle = '#0f151c'
    ctx.fill()
    ctx.restore()
    dibujarCarta(ctx, foto, { x: cx - cw / 2, y: 272, w: cw, h: ch, r: 16, nombre: carta.nombre })
    texto(ctx, recortado(ctx, carta.nombre, 330, '700 30px Inter, sans-serif'), cx, 272 + ch + 52, { font: '700 30px Inter, sans-serif', align: 'center' })
    texto(ctx, recortado(ctx, `${carta.expansion || ''}${carta.expansion ? ' · ' : ''}${carta.anio}`, 330, '500 22px Inter, sans-serif'), cx, 272 + ch + 86, { font: '500 22px Inter, sans-serif', color: SUAVE, align: 'center' })
  }
  extremo(250, fa, v.antigua, 'LA MÁS ANTIGUA')
  extremo(ANCHO - 250, fn, v.nueva, 'LA MÁS NUEVA')
  texto(ctx, String(v.anios), ANCHO / 2, 500, { font: '700 120px Fredoka, Inter, sans-serif', align: 'center' })
  texto(ctx, v.anios === 1 ? 'año de cartas' : 'años de cartas', ANCHO / 2, 544, { font: '500 26px Inter, sans-serif', color: SUAVE, align: 'center' })
  // Las épocas.
  texto(ctx, 'Mis cartas, por época', 80, 820, { font: '600 28px Inter, sans-serif', color: 'rgba(255,255,255,0.75)' })
  const epocas = v.epocas || []
  const tope = Math.max(1, ...epocas.map((e) => e.cuenta))
  const n = Math.max(1, epocas.length)
  const wb = (ANCHO - 160 - 12 * (n - 1)) / n
  const suelo = 1070
  const altoMax = 180
  epocas.forEach((e, i) => {
    const x = 80 + i * (wb + 12)
    const h = Math.max(8, Math.round((altoMax * e.cuenta) / tope))
    const esTope = e.cuenta === tope
    redondeado(ctx, x, suelo - h, wb, h, 8)
    ctx.fillStyle = esTope ? AMARILLO : '#4aa8ff'
    ctx.fill()
    texto(ctx, String(e.cuenta), x + wb / 2, suelo - h - 14, { font: '700 22px Inter, sans-serif', align: 'center' })
    texto(ctx, recortado(ctx, e.nombre, wb, '500 18px Inter, sans-serif'), x + wb / 2, suelo + 30, { font: '500 18px Inter, sans-serif', color: 'rgba(255,255,255,0.75)', align: 'center' })
    texto(ctx, e.anios, x + wb / 2, suelo + 54, { font: '500 18px Inter, sans-serif', color: 'rgba(255,255,255,0.55)', align: 'center' })
  })
  texto(ctx, `Mi época: ${v.miEpoca || '—'}`, 80, 1190, { font: '500 26px Inter, sans-serif', color: SUAVE })
  texto(ctx, `${datos.distintas} cartas distintas`, ANCHO - 80, 1190, { font: '500 26px Inter, sans-serif', color: SUAVE, align: 'right' })
  pieDeMarca(ctx, datos, { y: ALTO - 44 })
}

// ── pokedex: sin precio ──
const COLOR_DE_TIPO = { Agua: '#4aa8ff', Fuego: '#ff7a3d', Psíquico: '#d77dff', Rayo: '#ffd84a', Planta: '#6fd36f', Lucha: '#d9955a', Oscuro: '#8c8cff', Metal: '#b8c4cc', Hada: '#ff9ad5', Dragón: '#7a6cff', Incolora: '#dddddd', Entrenador: '#c9c9c9', Energía: '#9be7b4' }

function trofeo(ctx, x, y, w, { sello, titulo, sub }) {
  caja(ctx, x, y, w, 140, { r: 22 })
  texto(ctx, sello, x + 24, y + 44, { font: '800 22px Inter, sans-serif', color: AMARILLO })
  texto(ctx, recortado(ctx, titulo, w - 48, '700 30px Inter, sans-serif'), x + 24, y + 88, { font: '700 30px Inter, sans-serif' })
  texto(ctx, recortado(ctx, sub, w - 48, '500 22px Inter, sans-serif'), x + 24, y + 120, { font: '500 22px Inter, sans-serif', color: SUAVE })
}

async function pintarPokedex(lienzo, datos) {
  const ctx = await lienzoLimpio(lienzo, '#16263a', '#0c1218')
  const p = datos.pokedex || { especies: 0, total: 1025, pct: 0, tipos: [], regiones: [] }
  texto(ctx, 'Mi Pokédex de cartas', 80, 130, { font: F_TITULO })
  texto(ctx, `${datos.quien ? `@${datos.quien} · ` : ''}${datos.copias} cartas · ${datos.sets} ${datos.sets === 1 ? 'expansión' : 'expansiones'}`, 80, 176, { color: SUAVE })
  // El anillo.
  const cx = 270
  const cy = 420
  const r = 165
  ctx.lineWidth = 34
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  if (p.especies > 0) {
    ctx.strokeStyle = VERDE
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p.especies / (p.total || 1)))
    ctx.stroke()
  }
  texto(ctx, String(p.especies), cx, cy + 10, { font: '700 92px Fredoka, Inter, sans-serif', align: 'center' })
  const total = String(p.total).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const pct = p.pct < 10 ? String(Math.round(p.pct * 10) / 10).replace('.', ',') : String(Math.round(p.pct))
  texto(ctx, `de ${total} Pokémon`, cx, cy + 54, { font: '500 26px Inter, sans-serif', color: SUAVE, align: 'center' })
  texto(ctx, `${pct} % de la Pokédex`, cx, cy + 88, { font: '500 26px Inter, sans-serif', color: SUAVE, align: 'center' })
  // Los tipos.
  texto(ctx, 'Lo que más colecciono', 520, 258, { font: '600 28px Inter, sans-serif', color: 'rgba(255,255,255,0.75)' })
  const tope = p.tipos[0]?.cuenta || 1
  p.tipos.slice(0, 6).forEach((t, i) => {
    const y = 288 + i * 46
    texto(ctx, t.nombre, 520, y + 10, { font: '500 26px Inter, sans-serif' })
    caja(ctx, 686, y - 8, 228, 18, { r: 9, color: 'rgba(255,255,255,0.12)' })
    caja(ctx, 686, y - 8, Math.max(18, Math.round((228 * t.cuenta) / tope)), 18, { r: 9, color: COLOR_DE_TIPO[t.nombre] || '#c9c9c9' })
    texto(ctx, String(t.cuenta), ANCHO - 80, y + 10, { font: '500 24px Inter, sans-serif', color: SUAVE, align: 'right' })
  })
  // Las regiones.
  texto(ctx, 'Por región', 80, 690, { font: '600 28px Inter, sans-serif', color: 'rgba(255,255,255,0.75)' })
  const wr = (ANCHO - 160 - 8 * 10) / 9
  ;(p.regiones || []).forEach((g, i) => {
    const x = 80 + i * (wr + 10)
    caja(ctx, x, 712, wr, 90, { r: 14 })
    texto(ctx, String(g.cuenta), x + wr / 2, 756, { font: '700 30px Fredoka, Inter, sans-serif', align: 'center' })
    texto(ctx, g.nombre, x + wr / 2, 786, { font: '500 20px Inter, sans-serif', color: 'rgba(255,255,255,0.65)', align: 'center' })
  })
  // Los trofeos: hasta tres, los que haya.
  const trofeos = []
  if (datos.mejorSet) {
    const completa = datos.mejorSet.tengo >= datos.mejorSet.total
    trofeos.push({ sello: completa ? 'AL 100 %' : 'LA MÁS COMPLETA', titulo: datos.mejorSet.nombre, sub: `${datos.mejorSet.tengo} de ${datos.mejorSet.total}` })
  }
  if (p.masAntigua) trofeos.push({ sello: 'LA MÁS ANTIGUA', titulo: `${p.masAntigua.nombre}, ${p.masAntigua.anio}`, sub: p.masAntigua.expansion || '' })
  if (p.favorito) trofeos.push({ sello: 'EL FAVORITO', titulo: `${p.favorito.nombre} ×${p.favorito.veces}`, sub: `en ${p.favorito.expansiones} ${p.favorito.expansiones === 1 ? 'expansión' : 'expansiones'}` })
  const wt = (ANCHO - 160 - 20 * 2) / 3
  trofeos.forEach((t, i) => trofeo(ctx, 80 + i * (wt + 20), 860, wt, t))
  // Las tres cartas de firma y desde cuándo.
  const firma = (datos.firma || []).slice(0, 3)
  const fotos = await Promise.all(firma.map((v) => fotoParaElLienzo(v.cadena)))
  const cw = 120
  const ch = Math.round(cw * PROPORCION)
  firma.forEach((v, i) => dibujarCarta(ctx, fotos[i], { x: 80 + i * (cw + 20), y: 1060, w: cw, h: ch, r: 10, nombre: v.nombre }))
  const xTexto = 80 + firma.length * (cw + 20) + 20
  texto(ctx, recortado(ctx, datos.desde || 'Mi colección en PokeDoc', ANCHO - 80 - xTexto, '700 26px Inter, sans-serif'), xTexto, 1130, { font: '700 26px Inter, sans-serif' })
  texto(ctx, `pokedoc.es/mi-coleccion${datos.quien ? ` · @${datos.quien}` : ''}`, xTexto, 1170, { font: '500 24px Inter, sans-serif', color: SUAVE })
}


// ── Las cuatro, en el orden del carrusel ──
export const VARIANTES_IMAGEN = [
  { id: 'equipo', nombre: 'Mi equipo de 6', pintar: pintarEquipo },
  { id: 'perfil', nombre: 'Qué coleccionista soy', pintar: pintarPerfil },
  { id: 'viaje', nombre: 'Mi viaje en el tiempo', pintar: pintarViaje },
  { id: 'pokedex', nombre: 'Mi Pokédex', pintar: pintarPokedex },
]

// Con su nombre de siempre: quien la importaba pinta la primera.
export async function pintarImagenDeColeccion(lienzo, datos, variante = VARIANTES_IMAGEN[0].id) {
  const v = VARIANTES_IMAGEN.find((x) => x.id === variante) || VARIANTES_IMAGEN[0]
  await v.pintar(lienzo, datos)
}
