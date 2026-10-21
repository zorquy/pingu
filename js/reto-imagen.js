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

// ── EL MARCO DE LA 907 ──
//
// PINGU: «la captura para compartir es bastante pocha y no se sabe de qué
// se habla». Quien ve la imagen en una historia no sabe qué es PokeDoc ni
// de qué iba el reto. Así que todas llevan lo mismo, además del resultado:
//   · la MARCA arriba (el logo, el nombre del reto y su número del día);
//   · QUÉ ES, en una línea (`lema`: «5 preguntas de Pokémon TCG, cada día»);
//   · una INVITACIÓN con el enlace (`invitacion`: «¿Lo superas?»), que es
//     lo que hace que alguien entre;
//   · la MEDALLA y la racha, que ya existían y no salían.
// Y, si hay foto, va girada y con una chapa (`chip`) que dice qué es; el
// fondo puede tomar el color del tipo de la carta (`tono`).
//
// `filas` manda sobre `tira`: una tira es una sola fila. `fotoProporcion`
// es ancho/alto de la foto (una carta por defecto; 1 para un dibujo).
// `arriba` es el nombre pequeño de la cabecera: la misma pieza sirve para
// un logro, un nivel o un podio (873), que cambian solo las palabras.
const ORO = '#ffd166'
const NOMBRE_MEDALLA = { oro: 'Medalla de oro', plata: 'Medalla de plata', bronce: 'Medalla de bronce' }

export function lineaDeMedalla(medalla, racha) {
  const partes = []
  if (NOMBRE_MEDALLA[medalla]) partes.push(NOMBRE_MEDALLA[medalla])
  if (racha >= 2) partes.push(`${racha} días seguidos`)
  return partes.join(' · ')
}

// El fondo con el color de la carta: un foco del tono arriba que se funde
// con el azul de siempre abajo. Sin tono, el degradado de siempre.
export function fondoConTono(ctx, w, h, tono) {
  if (!tono) return fondo(ctx, w, h)
  ctx.fillStyle = '#0d1b2a'
  ctx.fillRect(0, 0, w, h)
  const g = ctx.createRadialGradient(w / 2, h * 0.3, 10, w / 2, h * 0.35, Math.max(w, h) * 0.85)
  g.addColorStop(0, tono)
  g.addColorStop(0.45, mezclar(tono, '#0d1b2a', 0.45))
  g.addColorStop(1, '#0d1b2a')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function mezclar(a, b, t) {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [n(a), n(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}

// La cabecera: el logo (la «P» de la web), el nombre y el número del día.
function cabecera(ctx, { x, y, ancho, arriba, numero, cuerpo }) {
  const lado = Math.round(cuerpo * 1.55)
  ctx.save()
  ctx.fillStyle = '#8ec5ea'
  redondeado(ctx, x, y - lado * 0.78, lado, lado, Math.round(lado / 4))
  ctx.fill()
  ctx.fillStyle = '#0d1b2a'
  ctx.textAlign = 'center'
  ctx.font = `700 ${Math.round(lado * 0.62)}px ${TITULAR}`
  ctx.fillText('P', x + lado / 2, y - lado * 0.78 + lado * 0.74)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = `600 ${cuerpo}px ${TITULAR}`
  ctx.fillText(arriba, x + lado + Math.round(cuerpo * 0.45), y)
  if (numero) {
    ctx.textAlign = 'right'
    ctx.fillStyle = ORO
    ctx.fillText(`#${numero}`, x + ancho, y)
  }
  ctx.restore()
}

// La invitación: una píldora con «¿Lo superas?» y el enlace en amarillo.
function invitacionAbajo(ctx, { cx, y, ancho, alto, texto, enlace, cuerpo }) {
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  ctx.strokeStyle = 'rgba(255,255,255,0.24)'
  ctx.lineWidth = 2
  redondeado(ctx, cx - ancho / 2, y, ancho, alto, alto / 2)
  ctx.fill()
  ctx.stroke()
  ctx.font = `600 ${cuerpo}px ${TEXTO}`
  const a = texto ? `${texto} ` : ''
  ctx.font = `700 ${cuerpo}px ${TEXTO}`
  const anchoEnlace = ctx.measureText(enlace).width
  ctx.font = `500 ${cuerpo}px ${TEXTO}`
  const anchoTexto = ctx.measureText(a).width
  let x = cx - (anchoTexto + anchoEnlace) / 2
  const base = y + alto / 2 + cuerpo * 0.36
  ctx.textAlign = 'left'
  ctx.fillStyle = '#fff'
  ctx.fillText(a, x, base)
  x += anchoTexto
  ctx.font = `700 ${cuerpo}px ${TEXTO}`
  ctx.fillStyle = ORO
  ctx.fillText(enlace, x, base)
  ctx.restore()
}

// La foto, girada unos grados, con sombra y, si hay, una chapa blanca que
// la pisa por abajo diciendo qué es («Pregunta 3 · Precios»). `tapada`
// (924): desenfocada y con un «?» encima, que la imagen se comparte y la
// carta del día es la respuesta — PINGU: «pueden ser spoiler». Y aun así
// se adivinaba (939): ahora son unos pocos manchones de color. Con
// `tapada: 'silueta'` (¿Quién es?) va la sombra negra del dibujo sobre
// fondo claro y nada más: PINGU, «debería ser solo la silueta».
function fotoGirada(ctx, foto, { cx, y, w, h, giro = -4, chip = '', nombre = '', cuerpoChip = 30, tapada = false }) {
  ctx.save()
  ctx.translate(cx, y + h / 2)
  ctx.rotate((giro * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  ctx.fillStyle = '#0d1b2a'
  redondeado(ctx, -w / 2, -h / 2, w, h, 20)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  if (tapada === 'silueta') {
    const fondo = ctx.createRadialGradient(0, 0, Math.min(w, h) * 0.1, 0, 0, Math.max(w, h) * 0.7)
    fondo.addColorStop(0, '#f4fbff')
    fondo.addColorStop(1, '#8cc4ec')
    ctx.fillStyle = fondo
    redondeado(ctx, -w / 2, -h / 2, w, h, 20)
    ctx.fill()
    if (foto) ctx.drawImage(silueta(foto, w, h), -w / 2, -h / 2, w, h)
  } else dibujarCarta(ctx, tapada && foto ? borrosa(foto, w, h, 64) : foto, { x: -w / 2, y: -h / 2, w, h, r: 20, nombre })
  if (tapada && tapada !== 'silueta') {
    ctx.fillStyle = 'rgba(13,27,42,0.35)'
    redondeado(ctx, -w / 2, -h / 2, w, h, 20)
    ctx.fill()
    const d = Math.min(w, h) * 0.42
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.beginPath()
    ctx.arc(0, 0, d / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#0d1b2a'
    ctx.textAlign = 'center'
    ctx.font = `800 ${Math.round(d * 0.62)}px ${TITULAR}`
    ctx.fillText('?', 0, d * 0.22)
  }
  ctx.restore()
  if (chip) {
    ctx.save()
    ctx.font = `600 ${cuerpoChip}px ${TEXTO}`
    const ancho = ctx.measureText(chip).width + cuerpoChip * 1.4
    const alto = cuerpoChip * 1.8
    ctx.translate(cx, y + h - alto * 0.2)
    ctx.rotate((2 * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 20
    ctx.fillStyle = '#ffffff'
    redondeado(ctx, -ancho / 2, -alto / 2, ancho, alto, alto / 2)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = '#0d1b2a'
    ctx.textAlign = 'center'
    ctx.fillText(chip, 0, cuerpoChip * 0.36)
    ctx.restore()
  }
}

export function pintarResultadoReto(lienzo, { arriba = 'PokeDoc · reto diario', titulo, cuenta, detalle = '', tira = null, filas = null, racha = 0, enlace, foto = null, fotoNombre = '', fotoProporcion = 245 / 342, formato = 'historia', numero = null, lema = '', invitacion = '¿Lo superas?', medalla = null, tono = null, chip = '', tapada = true }) {
  const { w: W, h: H } = medidasDe(formato)
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  fondoConTono(ctx, W, H, tono)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const lineas = filas || (tira ? [tira] : [])
  const medallaYRacha = lineaDeMedalla(medalla, racha)

  if (formato === 'apaisada') {
    // La foto a la izquierda (si la hay) y todo lo demás centrado en lo
    // que queda; sin foto, centrado en el lienzo.
    let cx = W / 2
    if (foto) {
      const h = 450
      const w = Math.round(h * fotoProporcion)
      fotoGirada(ctx, foto, { cx: 80 + w / 2, y: (H - h) / 2 - 10, w, h, chip, nombre: fotoNombre, cuerpoChip: 22, tapada })
      cx = (80 + w + W) / 2 + 10
    }
    const izq = foto ? cx - (W - cx) + 40 : 70
    cabecera(ctx, { x: izq, y: 70, ancho: W - 60 - izq, arriba, numero, cuerpo: 26 })
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    ctx.font = `700 44px ${TITULAR}`
    ctx.fillText(titulo, cx, 150)
    ajustada(ctx, cuenta, 120, (foto ? W - cx : W) - 120, TITULAR)
    ctx.fillText(cuenta, cx, 280)
    let y = 300
    if (detalle) {
      ctx.font = `500 26px ${TEXTO}`
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText(detalle, cx, y + 16)
      y += 36
    }
    if (medallaYRacha) {
      ctx.font = `700 26px ${TEXTO}`
      ctx.fillStyle = ORO
      ctx.fillText(medallaYRacha, cx, y + 20)
      y += 36
    }
    const lado = lineas.length > 3 ? 26 : 40
    const hueco = lineas.length > 3 ? 8 : 12
    y += 14
    for (const l of lineas.slice(0, 4)) {
      fila(ctx, l, cx, y, lado, hueco)
      y += lado + hueco
    }
    if (lema) {
      ctx.font = `500 22px ${TEXTO}`
      ctx.fillStyle = 'rgba(255,255,255,0.78)'
      ctx.fillText(lema, cx, H - 104)
    }
    invitacionAbajo(ctx, { cx, y: H - 86, ancho: Math.min(W - cx - 40, 520) * 2 - 40, alto: 58, texto: invitacion, enlace, cuerpo: 24 })
    return lienzo
  }

  cabecera(ctx, { x: 70, y: 100, ancho: W - 140, arriba, numero, cuerpo: 38 })
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.font = `700 64px ${TITULAR}`
  ctx.fillText(titulo, W / 2, 210)

  // Lo que ocupan las casillas, para que la foto se encoja lo justo: «¿Qué
  // carta es?» puede llegar con seis filas y no caben debajo de una foto
  // de 450 con la frase y la invitación abajo.
  const n = lineas.length
  const lado = n > 3 ? 36 : n > 1 ? 48 : 72
  const hueco = n > 3 ? 8 : n > 1 ? 12 : 18
  const casillas = n * (lado + hueco)
  let y = 260
  if (foto) {
    const libre = (H - (lema ? 200 : 150)) - y - 60 - 160 - (detalle ? 56 : 0) - (medallaYRacha ? 60 : 0) - 44 - casillas
    const h = Math.max(260, Math.min(450, libre))
    const w = Math.round(h * fotoProporcion)
    fotoGirada(ctx, foto, { cx: W / 2, y, w, h, chip, nombre: fotoNombre, tapada })
    y += h + 60
  } else {
    y += 90
  }

  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ajustada(ctx, cuenta, 160, W - 160, TITULAR)
  ctx.fillText(cuenta, W / 2, y + 120)
  y += 160
  if (detalle) {
    ctx.font = `500 38px ${TEXTO}`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(detalle, W / 2, y + 26)
    y += 56
  }
  if (medallaYRacha) {
    ctx.font = `700 40px ${TEXTO}`
    ctx.fillStyle = ORO
    ctx.fillText(medallaYRacha, W / 2, y + 30)
    y += 60
  }

  y += 24
  for (const l of lineas) {
    fila(ctx, l, W / 2, y, lado, hueco)
    y += lado + hueco
  }

  if (lema) {
    ctx.font = `500 32px ${TEXTO}`
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.textAlign = 'center'
    ctx.fillText(lema, W / 2, H - 150)
  }
  invitacionAbajo(ctx, { cx: W / 2, y: H - 120, ancho: W - 140, alto: 84, texto: invitacion, enlace, cuerpo: 34 })
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

// ── LAS DE LA CUENTA DE POKEDOC (907) ──
//
// Las de arriba son de quien juega: su resultado, para picar a sus amigos.
// La cuenta no sube el resultado de nadie —se leería como algo personal y
// destriparía el reto a quien aún no lo ha jugado—, sino dos al día:
//   · por la mañana, «Ya está el reto de hoy»: la carta del día
//     DESENFOCADA, los temas de las cinco preguntas y «¿Cuántas aciertas?»;
//   · por la noche, «Así fue el reto»: cuántos jugaron, la media, los
//     plenos, el reparto y la pregunta que más se falla.
// Se generan en /admin → Redes.

// Desenfocar sin `ctx.filter` (Safari no lo tiene en un lienzo): se
// dibuja la foto diminuta y se estira, que el suavizado la deja borrosa.
function borrosa(img, w, h, finura = 30) {
  const c = document.createElement('canvas')
  c.width = Math.max(3, Math.round(w / finura))
  c.height = Math.max(3, Math.round(h / finura))
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return c
}

// La sombra del dibujo: lo que no es transparente, en negro. El dibujo va
// entero dentro de su caja (sin recortar), con un margen alrededor.
function silueta(img, w, h) {
  const c = document.createElement('canvas')
  c.width = Math.round(w)
  c.height = Math.round(h)
  const x = c.getContext('2d')
  const iw = img.naturalWidth || img.width || w
  const ih = img.naturalHeight || img.height || h
  const k = Math.min((w * 0.84) / iw, (h * 0.84) / ih)
  x.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k)
  x.globalCompositeOperation = 'source-in'
  x.fillStyle = '#0d1b2a'
  x.fillRect(0, 0, w, h)
  return c
}

function chapas(ctx, textos, { cx, y, cuerpo, maxAncho }) {
  // Las chapas en filas centradas: se van llenando hasta `maxAncho`.
  ctx.font = `600 ${cuerpo}px ${TEXTO}`
  const alto = cuerpo * 1.9
  const pad = cuerpo * 0.8
  const hueco = cuerpo * 0.5
  const filas = [[]]
  let ancho = 0
  for (const t of textos) {
    const w = ctx.measureText(t).width + pad * 2
    if (ancho && ancho + hueco + w > maxAncho) { filas.push([]); ancho = 0 }
    filas[filas.length - 1].push({ t, w })
    ancho += (ancho ? hueco : 0) + w
  }
  for (const f of filas) {
    const total = f.reduce((n, c) => n + c.w, 0) + hueco * (f.length - 1)
    let x = cx - total / 2
    for (const c of f) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.strokeStyle = 'rgba(255,255,255,0.24)'
      ctx.lineWidth = 2
      redondeado(ctx, x, y, c.w, alto, alto / 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.fillText(c.t, x + c.w / 2, y + alto / 2 + cuerpo * 0.36)
      x += c.w + hueco
    }
    y += alto + hueco
  }
  return y
}

export function pintarAnuncioReto(lienzo, { numero, temas = [], foto = null, tono = null, enlace = 'pokedoc.es/reto', formato = 'historia' }) {
  const { w: W, h: H } = medidasDe(formato)
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  fondoConTono(ctx, W, H, tono || '#4a3a8a')
  ctx.textBaseline = 'alphabetic'
  const apaisada = formato === 'apaisada'
  const misterio = (cx, y, w, h) => {
    // La carta borrosa con un «?» encima: se ve que es una carta y su
    // color, no cuál es.
    ctx.save()
    ctx.translate(cx, y + h / 2)
    ctx.rotate((-4 * Math.PI) / 180)
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 16
    ctx.fillStyle = '#0d1b2a'
    redondeado(ctx, -w / 2, -h / 2, w, h, 20)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    redondeado(ctx, -w / 2, -h / 2, w, h, 20)
    ctx.clip()
    if (foto) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(borrosa(foto, w, h), -w / 2, -h / 2, w, h)
      ctx.fillStyle = 'rgba(13,27,42,0.25)'
      ctx.fillRect(-w / 2, -h / 2, w, h)
    } else {
      ctx.fillStyle = '#24405c'
      ctx.fillRect(-w / 2, -h / 2, w, h)
    }
    ctx.fillStyle = ORO
    ctx.textAlign = 'center'
    ctx.font = `700 ${Math.round(h * 0.42)}px ${TITULAR}`
    ctx.fillText('?', 0, h * 0.15)
    ctx.restore()
  }
  if (apaisada) {
    misterio(250, 90, 300, 420)
    const cx = 790
    cabecera(ctx, { x: 470, y: 70, ancho: W - 530, arriba: 'PokeDoc · reto diario', numero, cuerpo: 26 })
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    ctx.font = `700 54px ${TITULAR}`
    ctx.fillText('¡Ya está el reto de hoy!', cx, 165)
    let y = chapas(ctx, temas, { cx, y: 200, cuerpo: 22, maxAncho: 620 })
    ctx.font = `500 24px ${TEXTO}`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText('5 preguntas · un par de minutos · gratis', cx, Math.max(y + 30, 380))
    invitacionAbajo(ctx, { cx, y: H - 100, ancho: 620, alto: 62, texto: '¿Cuántas aciertas?', enlace, cuerpo: 26 })
    return lienzo
  }
  cabecera(ctx, { x: 70, y: 100, ancho: W - 140, arriba: 'PokeDoc · reto diario', numero, cuerpo: 38 })
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff'
  ctx.font = `700 76px ${TITULAR}`
  ctx.fillText('¡Ya está el reto', W / 2, 230)
  ctx.fillText('de hoy!', W / 2, 315)
  misterio(W / 2, 370, 360, 500)
  let y = chapas(ctx, temas, { cx: W / 2, y: 930, cuerpo: 32, maxAncho: W - 160 })
  ctx.font = `500 34px ${TEXTO}`
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.textAlign = 'center'
  ctx.fillText('5 preguntas · un par de minutos · gratis', W / 2, Math.min(y + 50, H - 160))
  invitacionAbajo(ctx, { cx: W / 2, y: H - 120, ancho: W - 140, alto: 84, texto: '¿Cuántas aciertas?', enlace, cuerpo: 34 })
  return lienzo
}

// `resumen` es el de `resumenDeResultados` (reto-portada.js); `dificil`,
// el de `laMasDificil` o null.
export function pintarResumenReto(lienzo, { numero, resumen, dificil = null, enlace = 'pokedoc.es/reto', formato = 'historia' }) {
  const { w: W, h: H } = medidasDe(formato)
  const ctx = lienzo.getContext('2d')
  lienzo.width = W
  lienzo.height = H
  fondo(ctx, W, H)
  ctx.textBaseline = 'alphabetic'
  const apaisada = formato === 'apaisada'
  const k = apaisada ? 0.55 : 1
  const coma = (v) => String(v).replace('.', ',')
  const cifras = [
    [resumen.jugadores.toLocaleString('es-ES'), resumen.jugadores === 1 ? 'ha jugado' : 'han jugado'],
    [resumen.media == null ? '—' : coma(resumen.media), 'aciertos de media'],
    [`${resumen.pctPlenos ?? 0} %`, 'hizo pleno'],
  ]
  const x0 = apaisada ? 60 : 70
  const anchoUtil = apaisada ? 520 : W - 140
  cabecera(ctx, { x: x0, y: apaisada ? 70 : 100, ancho: apaisada ? W - 120 : W - 140, arriba: 'PokeDoc · reto diario', numero, cuerpo: Math.round(38 * (apaisada ? 0.7 : 1)) })
  ctx.textAlign = apaisada ? 'left' : 'center'
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${Math.round(72 * (apaisada ? 0.75 : 1))}px ${TITULAR}`
  ctx.fillText(`Así fue el reto #${numero}`, apaisada ? x0 : W / 2, apaisada ? 150 : 230)
  // Las tres cifras.
  const yc = apaisada ? 250 : 380
  cifras.forEach(([v, t], i) => {
    const cx = x0 + (anchoUtil / 3) * i + anchoUtil / 6
    ctx.textAlign = 'center'
    ctx.fillStyle = ORO
    ctx.font = `700 ${Math.round(96 * k)}px ${TITULAR}`
    ctx.fillText(v, cx, yc)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = `500 ${Math.round(30 * k)}px ${TEXTO}`
    ctx.fillText(t, cx, yc + Math.round(46 * k))
  })
  // El reparto: una barra por nota, de la mejor a la peor.
  const barras = (resumen.reparto || []).filter((r) => r.aciertos > 0 || r.personas > 0)
  const bx = apaisada ? 640 : 160
  const bAncho = apaisada ? 470 : W - 320
  let y = apaisada ? 120 : 520
  const alto = apaisada ? 26 : 56
  const paso = apaisada ? 44 : (dificil ? 76 : 96)
  for (const r of barras) {
    ctx.textAlign = 'right'
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(32 * (apaisada ? 0.75 : 1))}px ${TEXTO}`
    ctx.fillText(`${r.aciertos}/${r.de}`, bx - 20, y + alto * 0.75)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    redondeado(ctx, bx, y, bAncho, alto, 8)
    ctx.fill()
    if (r.pct > 0) {
      ctx.fillStyle = r.aciertos === r.de ? ORO : COLOR.si
      redondeado(ctx, bx, y, Math.max(alto, (bAncho * r.pct) / 100), alto, 8)
      ctx.fill()
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = `600 ${Math.round(28 * (apaisada ? 0.75 : 1))}px ${TEXTO}`
    ctx.fillText(`${r.pct} %`, bx + bAncho + 14, y + alto * 0.75)
    y += paso
  }
  if (dificil) {
    const dy = apaisada ? 360 : Math.min(Math.max(y + 30, 960), H - 300)
    const dx = apaisada ? 60 : 100
    const dw = apaisada ? 520 : W - 200
    const dh = apaisada ? 110 : 150
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    redondeado(ctx, dx, dy, dw, dh, 20)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${Math.round(36 * (apaisada ? 0.75 : 1))}px ${TITULAR}`
    ctx.fillText('La más difícil', dx + 30, dy + dh * 0.42)
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = `500 ${Math.round(30 * (apaisada ? 0.75 : 1))}px ${TEXTO}`
    const tema = dificil.tema ? `${dificil.tema} · ` : ''
    ctx.fillText(`Pregunta ${dificil.indice + 1} · ${tema}solo la acierta el ${dificil.pct} %`, dx + 30, dy + dh * 0.75)
  }
  invitacionAbajo(ctx, apaisada
    ? { cx: W / 2, y: H - 90, ancho: W - 120, alto: 58, texto: 'Mañana, otro.', enlace, cuerpo: 24 }
    : { cx: W / 2, y: H - 120, ancho: W - 140, alto: 84, texto: 'Mañana, otro.', enlace, cuerpo: 34 })
  return lienzo
}
