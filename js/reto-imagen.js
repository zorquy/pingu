// La imagen que se comparte de un reto (tanda 583) y la de «Mi día» (870).
//
// El texto con emojis (568) es lo que se pega en WhatsApp; la IMAGEN es
// lo que se sube a una historia de Instagram o se manda por donde un
// texto no luce. Es la misma pieza para los seis retos: un título, la
// cuenta grande, la tira de cuadrados (o varias filas, en «¿Qué carta
// es?»), la racha y el enlace. Opcionalmente una foto (la carta del día,
// ya resuelta; el dibujo del Pokémon en «¿Quién es?»).
//
// Dos FORMATOS desde la 871: «historia» (1080×1350, como la de la
// colección de la 571) y «apaisada» (1200×630, la de X y la de una
// tarjeta de enlace, donde la vertical se recorta). Las dos salen del
// mismo dato; cambia solo dónde va cada cosa.
import { redondeado, dibujarCarta } from './imagen-compartir.js'

export const ANCHO = 1080
export const ALTO = 1350
export const MEDIDAS = { historia: { w: 1080, h: 1350 }, apaisada: { w: 1200, h: 630 } }
export const medidasDe = (formato) => MEDIDAS[formato] || MEDIDAS.historia

const TITULAR = 'Fredoka, Inter, sans-serif'
const TEXTO = 'Inter, sans-serif'

export function fondo(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#1e5175')
  g.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

const COLOR = { si: '#2e9e5b', no: '#d64545', vacio: 'rgba(255,255,255,0.18)' }

// Una fila de cuadrados que empieza en `x`; cada valor: true (verde), false
// (rojo) o null (vacío, gris).
function filaDesde(ctx, valores, x, y, lado, hueco) {
  for (const v of valores) {
    ctx.fillStyle = v === true ? COLOR.si : v === false ? COLOR.no : COLOR.vacio
    redondeado(ctx, x, y, lado, lado, Math.round(lado / 5))
    ctx.fill()
    x += lado + hueco
  }
}

const anchoDeFila = (n, lado, hueco) => n * lado + Math.max(0, n - 1) * hueco

// Una fila centrada en `cx`.
function fila(ctx, valores, cx, y, lado = 72, hueco = 18) {
  filaDesde(ctx, valores, cx - anchoDeFila(valores.length, lado, hueco) / 2, y, lado, hueco)
}

// Un texto grande que CABE: baja el cuerpo hasta que entre en `maxAncho`
// (un nivel o un logro son palabras, no un «4/5»).
function ajustada(ctx, texto, cuerpo, maxAncho, fuente) {
  let c = cuerpo
  ctx.font = `700 ${c}px ${fuente}`
  while (c > 24 && ctx.measureText(texto).width > maxAncho) {
    c -= 8
    ctx.font = `700 ${c}px ${fuente}`
  }
  return c
}

// `filas` manda sobre `tira`: una tira es una sola fila. `fotoProporcion`
// es ancho/alto de la foto (una carta por defecto; 1 para un dibujo).
// `arriba` es la línea pequeña de cabecera: la misma pieza sirve para un
// logro, un nivel o un podio (873), que cambian solo las palabras.
export function pintarResultadoReto(lienzo, { arriba = 'PokeDoc · reto diario', titulo, cuenta, detalle = '', tira = null, filas = null, racha = 0, enlace, foto = null, fotoNombre = '', fotoProporcion = 245 / 342, formato = 'historia' }) {
  const { w: W, h: H } = medidasDe(formato)
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  fondo(ctx, W, H)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const lineas = filas || (tira ? [tira] : [])

  if (formato === 'apaisada') {
    // La foto a la izquierda (si la hay) y todo lo demás centrado en lo
    // que queda; sin foto, centrado en el lienzo.
    let cx = W / 2
    if (foto) {
      const h = 470
      const w = Math.round(h * fotoProporcion)
      dibujarCarta(ctx, foto, { x: 80, y: (H - h) / 2, w, h, r: 16, nombre: fotoNombre })
      cx = (80 + w + W) / 2
    }
    ctx.fillStyle = '#fff'
    ctx.font = `700 30px ${TITULAR}`
    ctx.fillText(arriba, cx, 90)
    ctx.font = `700 46px ${TITULAR}`
    ctx.fillText(titulo, cx, 150)
    ajustada(ctx, cuenta, 130, (foto ? W - cx : W) - 120, TITULAR)
    ctx.fillText(cuenta, cx, 300)
    let y = 330
    if (detalle) {
      ctx.font = `500 28px ${TEXTO}`
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText(detalle, cx, y + 10)
      y += 40
    }
    const lado = lineas.length > 3 ? 28 : 44
    const hueco = lineas.length > 3 ? 8 : 12
    y += 16
    for (const l of lineas) {
      fila(ctx, l, cx, y, lado, hueco)
      y += lado + hueco
    }
    if (racha >= 2) {
      ctx.fillStyle = '#ffd166'
      ctx.font = `700 28px ${TEXTO}`
      ctx.fillText(`${racha} días seguidos`, cx, Math.max(y + 36, H - 100))
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `700 28px ${TEXTO}`
    ctx.fillText(enlace, cx, H - 44)
    return lienzo
  }

  ctx.font = `700 44px ${TITULAR}`
  ctx.fillText(arriba, W / 2, 110)
  ctx.font = `700 64px ${TITULAR}`
  ctx.fillText(titulo, W / 2, 200)

  let y = 260
  if (foto) {
    const h = 496
    const w = Math.round(h * fotoProporcion)
    dibujarCarta(ctx, foto, { x: (W - w) / 2, y, w, h, r: 20, nombre: fotoNombre })
    y += h + 70
  } else {
    y += 60
  }

  ctx.fillStyle = '#fff'
  ajustada(ctx, cuenta, 160, W - 160, TITULAR)
  ctx.fillText(cuenta, W / 2, y + 120)
  y += 170
  if (detalle) {
    ctx.font = `500 40px ${TEXTO}`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(detalle, W / 2, y + 30)
    y += 70
  }

  const lado = lineas.length > 3 ? 48 : 72
  const hueco = lineas.length > 3 ? 12 : 18
  y += 30
  for (const l of lineas) {
    fila(ctx, l, W / 2, y, lado, hueco)
    y += lado + hueco
  }

  if (racha >= 2) {
    ctx.fillStyle = '#ffd166'
    ctx.font = `700 44px ${TEXTO}`
    ctx.fillText(`${racha} días seguidos`, W / 2, y + 60)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `700 40px ${TEXTO}`
  ctx.fillText(enlace, W / 2, H - 80)
  return lienzo
}

// «Mi día» (870): los seis retos de hoy en una imagen. `filas` son las de
// `filasDeMiDia` (mi-dia.js) con `vacios` (cuántos cuadrados grises si no
// se ha jugado). Sin emojis: en un lienzo dependen de la fuente del
// aparato; el nombre corto del reto ya dice cuál es.
export function pintarMiDia(lienzo, { numero, filas = [], racha = 0, enlace, formato = 'historia' }) {
  const { w: W, h: H } = medidasDe(formato)
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  fondo(ctx, W, H)
  ctx.textBaseline = 'alphabetic'
  const hechos = filas.filter((f) => f.hecho).length
  const total = filas.length
  const perfecto = total > 0 && hechos === total
  const cuadrados = (f) => (f.tira ? f.tira : Array.from({ length: f.vacios || 3 }, () => null))

  if (formato === 'apaisada') {
    // Izquierda: el número, la cuenta grande, el día perfecto y la racha.
    // Derecha: una fila por reto, los cuadrados alineados a la derecha.
    const cx = 300
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    ctx.font = `700 30px ${TITULAR}`
    ctx.fillText(`PokeDoc #${numero} · mi día`, cx, 100)
    ctx.font = `700 170px ${TITULAR}`
    ctx.fillText(`${hechos}/${total}`, cx, 300)
    ctx.font = `500 30px ${TEXTO}`
    ctx.fillStyle = perfecto ? '#ffd166' : 'rgba(255,255,255,0.85)'
    ctx.fillText(perfecto ? '¡Día perfecto!' : 'retos de hoy', cx, 350)
    if (racha >= 2) {
      ctx.fillStyle = '#ffd166'
      ctx.font = `700 28px ${TEXTO}`
      ctx.fillText(`${racha} días seguidos`, cx, 420)
    }
    const lado = 36
    const hueco = 8
    const derecha = W - 70
    let y = 92
    for (const f of filas) {
      const v = cuadrados(f)
      ctx.textAlign = 'left'
      ctx.fillStyle = f.hecho ? '#fff' : 'rgba(255,255,255,0.55)'
      ctx.font = `600 28px ${TEXTO}`
      ctx.fillText(f.nombre, 600, y + 28)
      filaDesde(ctx, v, derecha - anchoDeFila(v.length, lado, hueco), y, lado, hueco)
      y += 76
    }
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = `700 28px ${TEXTO}`
    ctx.fillText(enlace, cx, H - 44)
    return lienzo
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.font = `700 44px ${TITULAR}`
  ctx.fillText(`PokeDoc #${numero} · mi día`, W / 2, 110)
  ctx.font = `700 190px ${TITULAR}`
  ctx.fillText(`${hechos}/${total}`, W / 2, 330)
  ctx.font = `500 40px ${TEXTO}`
  ctx.fillStyle = perfecto ? '#ffd166' : 'rgba(255,255,255,0.85)'
  ctx.fillText(perfecto ? '¡Día perfecto!' : 'retos de hoy', W / 2, 400)

  const lado = 56
  const hueco = 12
  const izquierda = 100
  const derecha = W - 100
  let y = 500
  for (const f of filas) {
    const v = cuadrados(f)
    ctx.textAlign = 'left'
    ctx.fillStyle = f.hecho ? '#fff' : 'rgba(255,255,255,0.55)'
    ctx.font = `600 40px ${TEXTO}`
    ctx.fillText(f.nombre, izquierda, y + 42)
    filaDesde(ctx, v, derecha - anchoDeFila(v.length, lado, hueco), y, lado, hueco)
    y += 110
  }

  ctx.textAlign = 'center'
  if (racha >= 2) {
    ctx.fillStyle = '#ffd166'
    ctx.font = `700 44px ${TEXTO}`
    ctx.fillText(`${racha} días seguidos`, W / 2, y + 60)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `700 40px ${TEXTO}`
  ctx.fillText(enlace, W / 2, H - 80)
  return lienzo
}

// «Mi mes» (873): los últimos `n` días en cuadrados —gris, amarillo (uno o
// dos retos), verde (tres o más)— y las tres cifras del calendario de
// /retos. `dias` es { día: cuántos }, como lo da `retos_mis_numeros`.
export function tonoDeDia(k) {
  return !k ? null : k >= 3 ? true : 'medio'
}

export function pintarMiMes(lienzo, { dias = {}, hoy, n = 30, cifras = [], enlace, formato = 'historia' }) {
  const { w: W, h: H } = medidasDe(formato)
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  fondo(ctx, W, H)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  const [y0, m0, d0] = String(hoy).split('-').map(Number)
  const celdas = []
  for (let i = n - 1; i >= 0; i--) {
    const dia = new Date(Date.UTC(y0, m0 - 1, d0 - i)).toISOString().slice(0, 10)
    celdas.push(tonoDeDia(Number(dias[dia]) || 0))
  }
  const jugados = celdas.filter(Boolean).length
  const columnas = 10
  const apaisada = formato === 'apaisada'
  const lado = apaisada ? 40 : 76
  const hueco = apaisada ? 10 : 16
  const anchoRejilla = anchoDeFila(columnas, lado, hueco)
  const x0 = (W - anchoRejilla) / 2
  const pintarCelda = (v, x, y) => {
    ctx.fillStyle = v === true ? COLOR.si : v === 'medio' ? '#e3b341' : COLOR.vacio
    redondeado(ctx, x, y, lado, lado, Math.round(lado / 5))
    ctx.fill()
  }
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${apaisada ? 30 : 44}px ${TITULAR}`
  ctx.fillText('PokeDoc · mis retos', W / 2, apaisada ? 70 : 110)
  ctx.font = `700 ${apaisada ? 46 : 64}px ${TITULAR}`
  ctx.fillText(`${jugados} de ${n} días jugados`, W / 2, apaisada ? 130 : 200)
  let y = apaisada ? 170 : 280
  celdas.forEach((v, i) => {
    pintarCelda(v, x0 + (i % columnas) * (lado + hueco), y + Math.floor(i / columnas) * (lado + hueco))
  })
  y += Math.ceil(n / columnas) * (lado + hueco) + (apaisada ? 40 : 90)
  // Las cifras, en fila.
  const anchoCifra = W / Math.max(1, cifras.length)
  cifras.forEach(([v, t], i) => {
    const cx = anchoCifra * i + anchoCifra / 2
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${apaisada ? 54 : 96}px ${TITULAR}`
    ctx.fillText(String(v), cx, y)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = `500 ${apaisada ? 22 : 32}px ${TEXTO}`
    ctx.fillText(t, cx, y + (apaisada ? 32 : 48))
  })
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = `700 ${apaisada ? 28 : 40}px ${TEXTO}`
  ctx.fillText(enlace, W / 2, H - (apaisada ? 44 : 80))
  return lienzo
}
