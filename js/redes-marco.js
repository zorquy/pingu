// EL MARCO DE LAS IMÁGENES DE REDES (tanda 1156, R1 de «Todas las imágenes
// de PokeDoc, con el mismo marco»).
//
// PINGU: «quiero que sea todo igual para mantener la concordancia». Cada
// generador de imágenes (noticias, retos, vitrina, partidas) iba a su aire:
// tres letras, el logo a veces sí y a veces no. Desde aquí todas comparten
// el marco del concurso de noviembre, con seis reglas (SCHEMA 1156):
//   1. el degradado marino de la web con un brillo del color de la SECCIÓN;
//   2. arriba, el logo y «PokeDoc» a la izquierda y una chapa con lo que es;
//   3. el título en Outfit, con la palabra clave en el color (`*así*`);
//   4. en el centro, la pieza (la pinta cada generador en `caja`);
//   5. abajo, la dirección en grande con su línea y una chapa;
//   6. tres tamaños: «historia» (1080×1350, la publicación: el nombre viene
//      de la 871 y lo usa la hoja), «larga» (1080×1920, la historia de
//      verdad, con el hueco de la barra de Instagram libre) y «apaisada»
//      (1200×630, la tarjeta de un enlace).
//
// Las letras se piden ANTES de dibujar (`prepararMarco`): un lienzo con una
// fuente que no ha llegado pinta con otra sin avisar, y eso es lo que les
// pasaba a las de Fredoka. Lo llama la hoja de compartir una vez.
import { redondeado } from './imagen-compartir.js'

export const MEDIDAS = {
  historia: { w: 1080, h: 1350 },
  larga: { w: 1080, h: 1920 },
  apaisada: { w: 1200, h: 630 },
}
export const medidasDe = (formato) => MEDIDAS[formato] || MEDIDAS.historia

export const TITULAR = 'Outfit, Inter, sans-serif'
export const TEXTO = 'Inter, sans-serif'

// El color de cada sección, el de la web en oscuro (`--acento`, 1018).
export const ACENTOS = {
  inicio: '#7cbae4',
  noticias: '#7cbae4',
  aprender: '#2fb47c',
  retos: '#2fb47c',
  coleccion: '#e4b44a',
  cartas: '#e4b44a',
  comunidad: '#f06c9b',
  jugar: '#9b7bff',
  concurso: '#facc15',
}
export const acentoDe = (seccion) => ACENTOS[seccion] || ACENTOS.inicio

const AZUL_MARCA = '#7cbae4'
const FONDO_ARRIBA = '#1e5175'
const FONDO_MEDIO = '#13324a'
const FONDO_ABAJO = '#0b1219'

// Los márgenes de cada tamaño: en la larga, 180 arriba y 260 abajo son los
// que tapan la barra y la caja de responder de una historia.
export function margenesDe(formato) {
  if (formato === 'larga') return { x: 72, arriba: 180, abajo: 260 }
  if (formato === 'apaisada') return { x: 56, arriba: 48, abajo: 48 }
  return { x: 72, arriba: 56, abajo: 64 }
}

let logo = null
let preparado = null
// Las dos letras y el logo, una vez. No falla nunca: sin red se pinta con lo
// que haya (el logo, dibujado a mano).
export function prepararMarco(doc = typeof document !== 'undefined' ? document : null) {
  if (preparado) return preparado
  preparado = (async () => {
    try {
      await Promise.all([
        doc?.fonts?.load(`800 80px Outfit`),
        doc?.fonts?.load(`600 30px Inter`),
        doc?.fonts?.load(`500 30px Inter`),
      ])
    } catch {}
    try {
      const img = new Image()
      img.src = '/assets/icon-192.png'
      await img.decode()
      logo = img
    } catch {
      logo = null
    }
  })()
  return preparado
}

function mezclar(a, b, t) {
  const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [n(a), n(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`
}
const conAlfa = (hex, a) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgba(${r},${g},${b},${a})`
}

// 1 · El fondo: el degradado de la web y dos brillos del acento.
export function fondoMarco(ctx, W, H, acento = AZUL_MARCA) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, FONDO_ARRIBA)
  g.addColorStop(0.46, FONDO_MEDIO)
  g.addColorStop(1, FONDO_ABAJO)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const brillo = (cx, cy, r, a) => {
    const b = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    b.addColorStop(0, conAlfa(acento, a))
    b.addColorStop(1, conAlfa(acento, 0))
    ctx.fillStyle = b
    ctx.fillRect(0, 0, W, H)
  }
  brillo(W * 0.12, H * 0.22, Math.max(W, H) * 0.42, 0.28)
  brillo(W * 0.96, H * 0.36, Math.max(W, H) * 0.4, 0.18)
}

// El logo: el icono de la app si llegó; si no, la «P» dibujada.
export function pintarLogo(ctx, x, y, lado) {
  if (logo) {
    ctx.save()
    redondeado(ctx, x, y, lado, lado, Math.round(lado * 0.27))
    ctx.clip()
    ctx.drawImage(logo, x, y, lado, lado)
    ctx.restore()
    return
  }
  ctx.save()
  ctx.fillStyle = AZUL_MARCA
  redondeado(ctx, x, y, lado, lado, Math.round(lado * 0.27))
  ctx.fill()
  ctx.fillStyle = FONDO_ABAJO
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 ${Math.round(lado * 0.64)}px ${TITULAR}`
  ctx.fillText('P', x + lado / 2, y + lado * 0.76)
  ctx.restore()
}

// Una chapa (píldora) con su texto; `derecha` la alinea por su borde
// derecho. Devuelve su ancho.
export function chapa(ctx, texto, { x, y, cuerpo, fondo = AZUL_MARCA, color = FONDO_ABAJO, derecha = false, mayusculas = true, fuente = TITULAR, peso = 800 }) {
  const t = mayusculas ? String(texto).toUpperCase() : String(texto)
  ctx.save()
  ctx.font = `${peso} ${cuerpo}px ${fuente}`
  if (mayusculas && 'letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(cuerpo * 0.12)}px`
  const pad = Math.round(cuerpo * 0.95)
  const alto = Math.round(cuerpo * 2.05)
  const ancho = Math.round(ctx.measureText(t).width + pad * 2)
  const x0 = derecha ? x - ancho : x
  ctx.fillStyle = fondo
  redondeado(ctx, x0, y, ancho, alto, alto / 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(t, x0 + pad, y + alto / 2 + 1)
  ctx.restore()
  return ancho
}

// «Poke» + «Doc» con la línea de base en `y`; devuelve el ancho. El «Doc»
// va en el azul de la marca (en un fondo claro, `doc` más oscuro).
export function palabraMarca(ctx, { x, y, cuerpo, poke = '#ffffff', doc = AZUL_MARCA }) {
  ctx.save()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 ${cuerpo}px ${TITULAR}`
  ctx.fillStyle = poke
  ctx.fillText('Poke', x, y)
  const w1 = ctx.measureText('Poke').width
  ctx.fillStyle = doc
  ctx.fillText('Doc', x + w1, y)
  const w = w1 + ctx.measureText('Doc').width
  ctx.restore()
  return w
}

// 2 · Arriba: logo + «PokeDoc» y la chapa a la derecha. `cuerpo` es el de
// la palabra «PokeDoc»; devuelve dónde acaba la cabecera.
export function cabeceraMarco(ctx, { x, y, ancho, chapa: texto = '', cuerpo = 40, acento = AZUL_MARCA }) {
  const lado = Math.round(cuerpo * 1.5)
  pintarLogo(ctx, x, y, lado)
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = `800 ${cuerpo}px ${TITULAR}`
  const xTexto = x + lado + Math.round(cuerpo * 0.4)
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Poke', xTexto, y + lado / 2)
  ctx.fillStyle = AZUL_MARCA
  ctx.fillText('Doc', xTexto + ctx.measureText('Poke').width, y + lado / 2)
  ctx.restore()
  if (texto) {
    const c = Math.round(cuerpo * 0.65)
    chapa(ctx, texto, { x: x + ancho, y: y + (lado - Math.round(c * 2.05)) / 2, cuerpo: c, fondo: acento, derecha: true })
  }
  return y + lado
}

// Parte un texto con `*marcas*` en palabras que saben si van destacadas.
// `pegada`: va junto a la anterior, sin espacio (la puntuación de detrás de
// lo destacado: «*Ascended Heroes*: todo…» no lleva «Heroes :»).
function palabrasDe(texto) {
  const out = []
  String(texto ?? '').split(/(\*[^*]+\*)/).forEach((trozo) => {
    if (!trozo) return
    const destacado = /^\*[^*]+\*$/.test(trozo)
    const limpio = destacado ? trozo.slice(1, -1) : trozo
    const pegadaAlPrincipio = out.length > 0 && !/^\s/.test(limpio) && !/\s$/.test(out[out.length - 1].finTrozo || ' ')
    limpio.split(/\s+/).filter(Boolean).forEach((p, i) => out.push({ p, destacado, pegada: i === 0 && pegadaAlPrincipio }))
    if (out.length) out[out.length - 1].finTrozo = limpio
  })
  return out
}

// Lo que mide una línea, con el espacio entre palabras que no van pegadas.
function anchoDeLinea(ctx, linea, espacio) {
  return linea.reduce((s, pal, i) => s + ctx.measureText(pal.p).width + (i && !pal.pegada ? espacio : 0), 0)
}

// Las líneas de un título que caben en `ancho`, como mucho `maximo`.
export function lineasDeTitulo(ctx, texto, { ancho, cuerpo, maximo = 4, peso = 800 }) {
  ctx.font = `${peso} ${cuerpo}px ${TITULAR}`
  const espacio = ctx.measureText(' ').width
  const lineas = []
  let linea = []
  let w = 0
  for (const pal of palabrasDe(texto)) {
    const pw = ctx.measureText(pal.p).width
    const hueco = pal.pegada ? 0 : espacio
    // Una palabra pegada no empieza línea: se va con la anterior.
    if (linea.length && !pal.pegada && w + hueco + pw > ancho) {
      lineas.push(linea)
      linea = []
      w = 0
    }
    w += (linea.length ? hueco : 0) + pw
    linea.push(linea.length ? pal : { ...pal, pegada: false })
  }
  if (linea.length) lineas.push(linea)
  if (lineas.length > maximo) {
    const cortadas = lineas.slice(0, maximo)
    cortadas[maximo - 1] = [...cortadas[maximo - 1], { p: '…', destacado: false, pegada: true }]
    return cortadas
  }
  return lineas
}

// 3 · El título: baja de cuerpo hasta que quepa en `maximo` líneas y lo
// pinta con lo destacado en el acento. Devuelve la y de su última línea.
export function tituloMarco(ctx, texto, { x, y, ancho, cuerpo = 88, minimo = 48, maximo = 4, acento = AZUL_MARCA, alinear = 'left' }) {
  let c = cuerpo
  let lineas = lineasDeTitulo(ctx, texto, { ancho, cuerpo: c, maximo: 99 })
  while (c > minimo && lineas.length > maximo) {
    c -= 4
    lineas = lineasDeTitulo(ctx, texto, { ancho, cuerpo: c, maximo: 99 })
  }
  lineas = lineasDeTitulo(ctx, texto, { ancho, cuerpo: c, maximo })
  ctx.save()
  ctx.font = `800 ${c}px ${TITULAR}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  const espacio = ctx.measureText(' ').width
  const paso = Math.round(c * 1.02)
  let yy = y + c
  for (const l of lineas) {
    const anchoLinea = anchoDeLinea(ctx, l, espacio)
    let xx = alinear === 'center' ? x + (ancho - anchoLinea) / 2 : x
    l.forEach((pal, i) => {
      if (i && !pal.pegada) xx += espacio
      ctx.fillStyle = pal.destacado ? acento : '#ffffff'
      ctx.fillText(pal.p, xx, yy)
      xx += ctx.measureText(pal.p).width
    })
    yy += paso
  }
  ctx.restore()
  return yy - paso + Math.round(c * 0.25)
}

// Un párrafo en Inter, `maximo` líneas. Devuelve la y de debajo.
export function parrafoMarco(ctx, texto, { x, y, ancho, cuerpo = 30, maximo = 3, color = '#cfe3f1', alinear = 'left', peso = 500 }) {
  if (!texto) return y
  ctx.save()
  ctx.font = `${peso} ${cuerpo}px ${TEXTO}`
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = alinear
  const palabras = String(texto).replace(/\s+/g, ' ').trim().split(' ')
  const lineas = []
  let linea = ''
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p
    if (linea && ctx.measureText(prueba).width > ancho) {
      lineas.push(linea)
      linea = p
    } else linea = prueba
  }
  if (linea) lineas.push(linea)
  if (lineas.length > maximo) {
    lineas.length = maximo
    let u = lineas[maximo - 1]
    while (u && ctx.measureText(`${u}…`).width > ancho) u = u.replace(/\s*\S+$/, '')
    lineas[maximo - 1] = `${u}…`
  }
  const paso = Math.round(cuerpo * 1.35)
  const cx = alinear === 'center' ? x + ancho / 2 : x
  lineas.forEach((l, i) => ctx.fillText(l, cx, y + cuerpo + i * paso))
  ctx.restore()
  return y + cuerpo + (lineas.length - 1) * paso + Math.round(cuerpo * 0.4)
}

// 5 · Abajo: la dirección en grande, su línea debajo y una chapa a la
// derecha. Devuelve la y donde EMPIEZA el pie (lo de encima es de la pieza).
export function pieMarco(ctx, { x, ancho, abajo, enlace, linea = '', chapa: texto = '', cuerpo = 40 }) {
  const cLinea = Math.round(cuerpo * 0.6)
  const yLinea = abajo
  const yEnlace = linea ? yLinea - cLinea - Math.round(cuerpo * 0.25) : abajo
  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${cuerpo}px ${TITULAR}`
  ctx.fillText(enlace, x, yEnlace)
  if (linea) {
    ctx.fillStyle = '#9fb3bd'
    ctx.font = `600 ${cLinea}px ${TEXTO}`
    ctx.fillText(linea, x, yLinea)
  }
  ctx.restore()
  if (texto) {
    const c = Math.round(cuerpo * 0.6)
    const alto = Math.round(c * 2.05)
    chapa(ctx, texto, { x: x + ancho, y: abajo - alto + Math.round(c * 0.3), cuerpo: c, fondo: 'rgba(255,255,255,0.14)', color: '#ffffff', derecha: true, mayusculas: false, fuente: TEXTO, peso: 600 })
  }
  return yEnlace - cuerpo - Math.round(cuerpo * 0.3)
}

// 4 · Una foto en tarjeta blanca un poco girada (la portada de una noticia,
// un producto): cabe en la caja sin deformarse.
export function tarjetaGirada(ctx, img, { x, y, w, h, angulo = -1.6, borde = 14, radio = 28 }) {
  if (!img) return
  const prop = img.naturalWidth / img.naturalHeight || 16 / 9
  let tw = w
  let th = tw / prop + borde * 2
  if (th > h) {
    th = h
    tw = (th - borde * 2) * prop + borde * 2
  }
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((angulo * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 24
  ctx.fillStyle = '#ffffff'
  redondeado(ctx, -tw / 2, -th / 2, tw, th, radio)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  redondeado(ctx, -tw / 2 + borde, -th / 2 + borde, tw - borde * 2, th - borde * 2, Math.max(4, radio - borde))
  ctx.clip()
  ctx.drawImage(img, -tw / 2 + borde, -th / 2 + borde, tw - borde * 2, th - borde * 2)
  ctx.restore()
}

// El marco entero. Pinta fondo, cabecera, título, entradilla y pie, y
// devuelve la CAJA libre de en medio para la pieza. En la apaisada el texto
// va a la izquierda y la caja a la derecha.
export function pintarMarco(lienzo, { formato = 'historia', seccion = 'inicio', acento = null, chapa: textoChapa = '', titulo = '', entradilla = '', enlace = 'pokedoc.es', linea = '', chapaPie = '', maxLineas = null }) {
  const { w: W, h: H } = medidasDe(formato)
  lienzo.width = W
  lienzo.height = H
  const ctx = lienzo.getContext('2d')
  const ac = acento || acentoDe(seccion)
  const m = margenesDe(formato)
  fondoMarco(ctx, W, H, ac)
  const apaisada = formato === 'apaisada'
  const larga = formato === 'larga'
  const ancho = W - m.x * 2
  const finCab = cabeceraMarco(ctx, { x: m.x, y: m.arriba, ancho, chapa: textoChapa, cuerpo: apaisada ? 30 : 40, acento: ac })
  if (apaisada) {
    const anchoTexto = Math.round(ancho * 0.56)
    const iniPie = pieMarco(ctx, { x: m.x, ancho: anchoTexto, abajo: H - m.abajo, enlace, linea, cuerpo: 28 })
    let y = finCab + 40
    y = tituloMarco(ctx, titulo, { x: m.x, y, ancho: anchoTexto, cuerpo: 56, minimo: 36, maximo: maxLineas || 4, acento: ac })
    parrafoMarco(ctx, entradilla, { x: m.x, y: y + 6, ancho: anchoTexto, cuerpo: 22, maximo: 2 })
    void iniPie
    const cx = m.x + anchoTexto + 40
    return { ctx, W, H, acento: ac, caja: { x: cx, y: finCab + 28, w: W - m.x - cx, h: H - m.abajo - finCab - 28 } }
  }
  let y = finCab + (larga ? 56 : 44)
  y = tituloMarco(ctx, titulo, { x: m.x, y, ancho, cuerpo: larga ? 100 : 88, minimo: 52, maximo: maxLineas || (larga ? 5 : 4), acento: ac })
  y = parrafoMarco(ctx, entradilla, { x: m.x, y: y + (larga ? 14 : 8), ancho, cuerpo: larga ? 32 : 30, maximo: larga ? 4 : 3 })
  const iniPie = pieMarco(ctx, { x: m.x, ancho, abajo: H - m.abajo, enlace, linea, chapa: chapaPie, cuerpo: 40 })
  const arriba = y + (larga ? 48 : 36)
  return { ctx, W, H, acento: ac, caja: { x: m.x, y: arriba, w: ancho, h: Math.max(0, iniPie - arriba - (larga ? 40 : 28)) } }
}
