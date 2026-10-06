// «Mi colección en una imagen» (tanda 571): el dibujo. La máquina —fotos
// con permiso, exportar, compartir— está en js/imagen-compartir.js.
//
// Esto no lo puede hacer PTCGenius ni TCGdex: no tienen tu colección.
// Desde la 689 son CINCO dibujos y se pasa de uno a otro en el diálogo
// (PINGU: «me gustan todas; dejar la que está y añadir estas cuatro, y
// con un slide vayas pasando entre la que quieres compartir»):
//
//   · resumen  — la de siempre: cuatro cifras, las tres que más valen y
//                la expansión más completa.
//   · joya     — UNA carta grande, la que más vale, con su nombre y su
//                expansión; las cifras de pie.
//   · vitrina  — las NUEVE que más valen en una pared de 3 × 3 (PINGU:
//                «en vez de catorce, nueve») y un «+N más».
//   · mes      — qué ha pasado en los últimos 30 días: cartas nuevas,
//                las tres últimas en abanico, cuatro hitos.
//   · pokedex  — SIN precio: especies sobre 1.025, tipos, regiones y
//                tres trofeos.
//
// 1080 × 1350, el retrato de Instagram. Los colores van a pelo porque no
// es la página: es una imagen que se ve fuera, donde no hay tema claro ni
// oscuro. Los números los cuenta js/mi-coleccion/imagen-datos.js.
import { fotoParaElLienzo, dibujarCarta, redondeado } from '../imagen-compartir.js'

export const ANCHO = 1080
export const ALTO = 1350

function cifra(ctx, x, y, valor, rotulo) {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 64px Fredoka, Inter, sans-serif'
  ctx.fillText(valor, x, y)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '500 26px Inter, sans-serif'
  ctx.fillText(rotulo, x, y + 36)
}

// `datos`: { quien, copias, distintas, sets, valor, valiosas: [{ nombre,
// cadena, valor }], mejorSet: { nombre, tengo, total } | null, desde }
async function pintarResumen(lienzo, datos) {
  const ctx = await lienzoLimpio(lienzo, '#1e5175', '#10141c')

  // Cabecera
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 64px Fredoka, Inter, sans-serif'
  ctx.fillText('Mi colección', ANCHO / 2, 96)
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = '500 30px Inter, sans-serif'
  ctx.fillText(`${datos.quien ? `de @${datos.quien} · ` : ''}Pokémon TCG`, ANCHO / 2, 142)

  // Las cuatro cifras, en dos por dos
  cifra(ctx, 90, 260, String(datos.copias), 'cartas')
  cifra(ctx, 560, 260, String(datos.distintas), 'distintas')
  cifra(ctx, 90, 400, String(datos.sets), datos.sets === 1 ? 'colección' : 'colecciones')
  cifra(ctx, 560, 400, datos.valor, 'de valor')
  // Y cuánto ha cambiado este mes (tanda 582), si se sabe.
  if (datos.cambioMes) {
    ctx.fillStyle = datos.cambioMes.startsWith('−') ? '#ff9b9b' : '#9be7b4'
    ctx.font = '600 26px Inter, sans-serif'
    ctx.fillText(datos.cambioMes, 560, 466)
  }

  // Las tres que más valen, con su foto
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 30px Inter, sans-serif'
  ctx.fillText('Las que más valen', 90, 512)
  const valiosas = (datos.valiosas || []).slice(0, 3)
  const fotos = await Promise.all(valiosas.map((v) => fotoParaElLienzo(v.cadena)))
  const cw = 280
  const ch = Math.round((cw * 342) / 245)
  const hueco = (ANCHO - 180 - cw * 3) / 2
  valiosas.forEach((v, i) => {
    const x = 90 + i * (cw + hueco)
    dibujarCarta(ctx, fotos[i], { x, y: 540, w: cw, h: ch, nombre: v.nombre })
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 26px Inter, sans-serif'
    ctx.fillText(v.valor, x + cw / 2, 540 + ch + 40)
  })

  // La expansión más completa, con su barra
  const yExp = 540 + ch + 120
  if (datos.mejorSet) {
    const { nombre, tengo, total } = datos.mejorSet
    const pct = total ? Math.round((tengo / total) * 100) : 0
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '700 30px Inter, sans-serif'
    ctx.fillText('Mi expansión más completa', 90, yExp)
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 34px Inter, sans-serif'
    ctx.fillText(nombre, 90, yExp + 50)
    ctx.textAlign = 'right'
    ctx.fillText(`${tengo} de ${total} · ${pct} %`, ANCHO - 90, yExp + 50)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(90, yExp + 72, ANCHO - 180, 18)
    ctx.fillStyle = '#5ad1a4'
    ctx.fillRect(90, yExp + 72, Math.round((ANCHO - 180) * Math.min(1, tengo / (total || 1))), 18)
  }

  // Pie
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = '500 26px Inter, sans-serif'
  if (datos.desde) ctx.fillText(datos.desde, ANCHO / 2, ALTO - 72)
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '700 34px Fredoka, Inter, sans-serif'
  ctx.fillText('pokedoc.es/mi-coleccion', ANCHO / 2, ALTO - 26)
}

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

// ── joya: una carta, grande ──
async function pintarJoya(lienzo, datos) {
  const ctx = await lienzoLimpio(lienzo, '#2a6ea3', '#0b1118')
  const joya = (datos.valiosas || [])[0] || null
  // El halo detrás de la carta.
  const halo = ctx.createRadialGradient(ANCHO / 2, 560, 0, ANCHO / 2, 560, 420)
  halo.addColorStop(0, 'rgba(126,200,255,0.45)')
  halo.addColorStop(1, 'rgba(126,200,255,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, ANCHO, ALTO)
  texto(ctx, 'LA JOYA DE MI COLECCIÓN', ANCHO / 2, 100, { font: '600 30px Inter, sans-serif', color: 'rgba(255,255,255,0.75)', align: 'center' })
  const foto = joya ? await fotoParaElLienzo(joya.cadena) : null
  const w = 540
  const h = Math.round(w * PROPORCION)
  cartaGirada(ctx, foto, { cx: ANCHO / 2, cy: 160 + h / 2, w, h, grados: -6, nombre: joya?.nombre || '', r: 26 })
  if (joya) {
    texto(ctx, recortado(ctx, joya.nombre, ANCHO - 160, '700 76px Fredoka, Inter, sans-serif'), ANCHO / 2, 1010, { font: '700 76px Fredoka, Inter, sans-serif', align: 'center' })
    const sub = [joya.rareza, joya.expansion, joya.anio].filter(Boolean).join(' · ')
    texto(ctx, recortado(ctx, sub, ANCHO - 160, F_SUB), ANCHO / 2, 1058, { color: SUAVE, align: 'center' })
    chapa(ctx, `${joya.valor}${datos.distintas ? ` · 1 de ${datos.distintas}` : ''}`, ANCHO / 2, 1082, { font: '700 30px Inter, sans-serif', alto: 56 })
  } else {
    texto(ctx, 'Todavía sin precios', ANCHO / 2, 1010, { font: '700 48px Fredoka, Inter, sans-serif', align: 'center' })
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(80, 1164, ANCHO - 160, 1)
  cifraPequena(ctx, 160, 1236, String(datos.copias), 'cartas')
  cifraPequena(ctx, ANCHO / 2, 1236, String(datos.sets), datos.sets === 1 ? 'expansión' : 'expansiones')
  cifraPequena(ctx, ANCHO - 160, 1236, datos.valor, 'de valor')
  pieDeMarca(ctx, datos, { y: ALTO - 36 })
}

// ── vitrina: las nueve que más valen ──
async function pintarVitrina(lienzo, datos) {
  const ctx = await lienzoLimpio(lienzo, '#1b2a3a', '#0f151c')
  const valiosas = (datos.valiosas || []).slice(0, 9)
  texto(ctx, 'Mi vitrina', 80, 130, { font: '700 72px Fredoka, Inter, sans-serif' })
  const mas = Math.max(0, (Number(datos.distintas) || 0) - valiosas.length)
  texto(ctx, `${datos.quien ? `de @${datos.quien} · ` : ''}las ${valiosas.length} que más valen${mas ? ` · +${mas} más` : ''}`, 80, 176, { color: SUAVE })
  if (datos.valor) {
    ctx.font = '800 26px Inter, sans-serif'
    const w = ctx.measureText(`${datos.valor} en total`).width + 48
    chapa(ctx, `${datos.valor} en total`, ANCHO - 80 - w / 2, 110, { font: '800 26px Inter, sans-serif', bg: AMARILLO, color: '#1a1300', px: 24, alto: 56 })
  }
  const fotos = await Promise.all(valiosas.map((v) => fotoParaElLienzo(v.cadena)))
  // Tres por tres y que quepan: 224 de ancho son 313 de alto, tres filas
  // acaban en 1.199 y dejan sitio a las cifras y al pie.
  const hueco = 20
  const cw = 224
  const ch = Math.round(cw * PROPORCION)
  const y0 = 220
  const x0 = Math.round((ANCHO - (cw * 3 + hueco * 2)) / 2)
  valiosas.forEach((v, i) => {
    const x = x0 + (i % 3) * (cw + hueco)
    const y = y0 + Math.floor(i / 3) * (ch + hueco)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 10
    redondeado(ctx, x, y, cw, ch, 14)
    ctx.fillStyle = '#0f151c'
    ctx.fill()
    ctx.restore()
    dibujarCarta(ctx, fotos[i], { x, y, w: cw, h: ch, r: 14, nombre: v.nombre })
  })
  // Los huecos que falten, con rayas: una vitrina de tres cartas no se
  // pinta con seis cuadros en blanco sin decir nada.
  for (let i = valiosas.length; i < 9; i++) {
    const x = x0 + (i % 3) * (cw + hueco)
    const y = y0 + Math.floor(i / 3) * (ch + hueco)
    ctx.save()
    ctx.setLineDash([10, 10])
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 2
    redondeado(ctx, x, y, cw, ch, 14)
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fillRect(80, 1216, ANCHO - 160, 1)
  cifraPequena(ctx, 170, 1262, String(datos.copias), 'cartas')
  cifraPequena(ctx, 420, 1262, String(datos.distintas), 'distintas')
  cifraPequena(ctx, 660, 1262, String(datos.sets), datos.sets === 1 ? 'expansión' : 'expansiones')
  cifraPequena(ctx, 910, 1262, datos.mejorSet && datos.mejorSet.tengo >= datos.mejorSet.total ? '1' : '0', 'al 100 %')
  pieDeMarca(ctx, datos, { y: ALTO - 14 })
}

// ── mes: qué ha pasado en 30 días ──
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function hito(ctx, x, y, w, { sello, color, tinta, titulo, sub }) {
  caja(ctx, x, y, w, 150, { r: 22 })
  caja(ctx, x + 28, y + 43, 64, 64, { r: 16, color })
  texto(ctx, sello, x + 60, y + 85, { font: `800 ${String(sello).length > 2 ? 22 : 28}px Inter, sans-serif`, color: tinta, align: 'center' })
  texto(ctx, recortado(ctx, titulo, w - 130, '700 28px Inter, sans-serif'), x + 112, y + 70, { font: '700 28px Inter, sans-serif' })
  texto(ctx, recortado(ctx, sub, w - 140, '500 22px Inter, sans-serif'), x + 112, y + 104, { font: '500 22px Inter, sans-serif', color: SUAVE })
}

async function pintarMes(lienzo, datos) {
  const ctx = await lienzoLimpio(lienzo, '#1e5175', '#10141c')
  const m = datos.mes || { nuevas: 0, ultimas: [], expansionesNuevas: [] }
  const ahora = datos.ahora ? new Date(datos.ahora) : new Date()
  texto(ctx, `Mi ${MESES[ahora.getMonth()]} coleccionando`, 80, 130, { font: F_TITULO })
  texto(ctx, `${datos.quien ? `@${datos.quien} · ` : ''}Pokémon TCG`, 80, 176, { color: SUAVE })
  // Las tres últimas en abanico (o las que más valen si este mes no ha
  // entrado ninguna: un abanico vacío no es una imagen).
  const abanico = (m.ultimas?.length ? m.ultimas : datos.valiosas || []).slice(0, 3)
  const fotos = await Promise.all(abanico.map((v) => fotoParaElLienzo(v.cadena)))
  const w = 300
  const h = Math.round(w * PROPORCION)
  const giros = [-12, -2, 8]
  abanico.forEach((v, i) => {
    cartaGirada(ctx, fotos[i], { cx: 230 + i * 90, cy: 290 + h / 2 - i * 30, w, h, grados: giros[i], nombre: v.nombre, r: 16 })
  })
  // Las cartas nuevas, en grande.
  texto(ctx, `+${m.nuevas}`, 600, 340, { font: '700 120px Fredoka, Inter, sans-serif' })
  texto(ctx, m.nuevas === 1 ? 'carta nueva este mes' : 'cartas nuevas este mes', 600, 392, { font: '600 34px Inter, sans-serif', color: 'rgba(255,255,255,0.75)' })
  const frases = []
  if (datos.cambioMes) frases.push(`La colección vale ${datos.cambioMes.replace(' este mes', '')} que hace 30 días.`)
  if (datos.valiosas?.[0]) frases.push(`La que más vale: ${datos.valiosas[0].nombre}, ${datos.valiosas[0].valor}.`)
  let y = 450
  for (const frase of frases) {
    // A dos líneas si hace falta.
    const palabras = frase.split(' ')
    let linea = ''
    ctx.font = '500 26px Inter, sans-serif'
    for (const p of palabras) {
      const prueba = linea ? `${linea} ${p}` : p
      if (ctx.measureText(prueba).width > 400 && linea) {
        texto(ctx, linea, 600, y, { font: '500 26px Inter, sans-serif', color: SUAVE })
        y += 36
        linea = p
      } else linea = prueba
    }
    if (linea) { texto(ctx, linea, 600, y, { font: '500 26px Inter, sans-serif', color: SUAVE }); y += 36 }
    y += 10
  }
  // Los hitos: los que haya, hasta cuatro.
  const hitos = []
  if (datos.mejorSet) {
    const completa = datos.mejorSet.tengo >= datos.mejorSet.total
    hitos.push({ sello: completa ? '100' : `${Math.round((datos.mejorSet.tengo / (datos.mejorSet.total || 1)) * 100)}`, color: VERDE, tinta: '#0b2a1a', titulo: datos.mejorSet.nombre, sub: `${datos.mejorSet.tengo} de ${datos.mejorSet.total}${completa ? ' · completa' : ' · la más completa'}` })
  }
  if (datos.pokedex?.favorito) hitos.push({ sello: `×${datos.pokedex.favorito.veces}`, color: AMARILLO, tinta: '#1a1300', titulo: datos.pokedex.favorito.nombre, sub: `el más repetido · ${datos.pokedex.favorito.veces} cartas distintas` })
  if (m.expansionesNuevas?.length) hitos.push({ sello: String(m.expansionesNuevas.length), color: '#f3a0d8', tinta: '#33101f', titulo: m.expansionesNuevas.length === 1 ? 'Expansión nueva' : 'Expansiones nuevas', sub: m.expansionesNuevas.join(', ') })
  if (datos.pokedex?.masAntigua) hitos.push({ sello: String(datos.pokedex.masAntigua.anio), color: '#7fb6ff', tinta: '#0a1a33', titulo: 'La más antigua', sub: `${datos.pokedex.masAntigua.nombre} · ${datos.pokedex.masAntigua.expansion}` })
  const wh = (ANCHO - 160 - 20) / 2
  hitos.slice(0, 4).forEach((x, i) => hito(ctx, 80 + (i % 2) * (wh + 20), 800 + Math.floor(i / 2) * 170, wh, x))
  // El total y la barra.
  texto(ctx, `Total: ${datos.copias} cartas · ${datos.distintas} distintas · ${datos.sets} expansiones`, 80, 1186, { font: '500 26px Inter, sans-serif' })
  texto(ctx, datos.valor, ANCHO - 80, 1186, { font: '700 26px Inter, sans-serif', align: 'right' })
  caja(ctx, 80, 1204, ANCHO - 160, 16, { r: 8, color: VERDE })
  pieDeMarca(ctx, datos, { y: ALTO - 56 })
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
  const firma = (datos.valiosas || []).slice(0, 3)
  const fotos = await Promise.all(firma.map((v) => fotoParaElLienzo(v.cadena)))
  const cw = 120
  const ch = Math.round(cw * PROPORCION)
  firma.forEach((v, i) => dibujarCarta(ctx, fotos[i], { x: 80 + i * (cw + 20), y: 1060, w: cw, h: ch, r: 10, nombre: v.nombre }))
  const xTexto = 80 + firma.length * (cw + 20) + 20
  texto(ctx, recortado(ctx, datos.desde || 'Mi colección en PokeDoc', ANCHO - 80 - xTexto, '700 26px Inter, sans-serif'), xTexto, 1130, { font: '700 26px Inter, sans-serif' })
  texto(ctx, `pokedoc.es/mi-coleccion${datos.quien ? ` · @${datos.quien}` : ''}`, xTexto, 1170, { font: '500 24px Inter, sans-serif', color: SUAVE })
}

// ── Las cinco, en el orden del carrusel ──
export const VARIANTES_IMAGEN = [
  { id: 'resumen', nombre: 'Resumen', pintar: pintarResumen },
  { id: 'joya', nombre: 'La joya', pintar: pintarJoya },
  { id: 'vitrina', nombre: 'La vitrina', pintar: pintarVitrina },
  { id: 'mes', nombre: 'Tu mes', pintar: pintarMes },
  { id: 'pokedex', nombre: 'Tu Pokédex', pintar: pintarPokedex },
]

// La de siempre, con su nombre de siempre: quien la importaba sigue
// pintando el resumen.
export async function pintarImagenDeColeccion(lienzo, datos, variante = 'resumen') {
  const v = VARIANTES_IMAGEN.find((x) => x.id === variante) || VARIANTES_IMAGEN[0]
  await v.pintar(lienzo, datos)
}
