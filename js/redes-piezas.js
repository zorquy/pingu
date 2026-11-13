// LAS IMÁGENES DE LAS PIEZAS DE REDES (tanda 1335): dibujan las diapositivas
// que describe `redes-textos.js`, con el marco común (`redes-marco.js`) — el
// mismo de las noticias desde la 1156, para que todo lo de PokeDoc se vea de
// la misma casa. Cada pintor recibe sus datos y, ya cargadas, sus imágenes.
//
// Tres tamaños, como todo el marco: «historia» (1080×1350, la publicación de
// Instagram, que es la que PINGU descarga), «larga» (1080×1920, la historia)
// y «apaisada» (1200×630).
import { cargarImagen, redondeado, dibujarCarta } from './imagen-compartir.js'
import { pintarMarco, tarjetaGirada, prepararMarco, TITULAR, TEXTO } from './redes-marco.js'
import { pintarNoticia } from './noticia-compartir.js'

// «2 / 5» en la chapa de abajo cuando es un carrusel: así se ve que sigue.
const pagina = (n, total) => (total > 1 ? `${n} / ${total}` : '')

// Las imágenes que pide una diapositiva (la portada, el cartel, los sprites).
// Una que no carga (sin permiso de CORS, borrada) se queda en null y la
// diapositiva se dibuja sin ella: mejor sin foto que sin imagen.
const cache = new Map()
// Con tope de espera: un logo de un CDN que no contesta dejaba la imagen
// «dibujándose» para siempre (1336).
const ESPERA = 5000
const cargar = (url) => {
  if (!url) return Promise.resolve(null)
  if (!cache.has(url)) cache.set(url, Promise.race([cargarImagen(url).catch(() => null), new Promise((ok) => setTimeout(() => ok(null), ESPERA))]))
  return cache.get(url)
}

export async function imagenesDe(d) {
  const x = d?.datos || {}
  const [portada, sprites, cartas] = await Promise.all([
    cargar(x.portada || x.imagen || x.cartel || x.logo || null),
    Promise.all((x.sprites || []).slice(0, 3).map(cargar)),
    // Las cartas van en su sitio aunque falte alguna (null): «la 2.ª más cara» no puede pasar a ser la 1.ª.
    Promise.all((Array.isArray(x.cartas) ? x.cartas : []).slice(0, 3).map((c) => cargar(c.imagen))),
  ])
  return { portada, sprites: sprites.filter(Boolean), cartas }
}

// Una imagen entera dentro de la caja, sin recortar (un logo con su
// transparencia: en tarjeta blanca quedaría como una pegatina).
function contener(ctx, img, caja, { escala = 1, sombra = true } = {}) {
  const k = Math.min((caja.w * escala) / img.width, (caja.h * escala) / img.height)
  const w = img.width * k
  const h = img.height * k
  ctx.save()
  if (sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 14
  }
  ctx.drawImage(img, caja.x + (caja.w - w) / 2, caja.y + (caja.h - h) / 2, w, h)
  ctx.restore()
}

// Texto en una línea que se encoge hasta caber (y si no, se corta con «…»).
function lineaQueCabe(ctx, texto, { x, y, ancho, cuerpo, minimo = 20, peso = 700, fuente = TEXTO, color = '#ffffff', alinear = 'left' }) {
  let c = cuerpo
  ctx.font = `${peso} ${c}px ${fuente}`
  while (c > minimo && ctx.measureText(texto).width > ancho) {
    c -= 2
    ctx.font = `${peso} ${c}px ${fuente}`
  }
  let t = String(texto)
  while (t.length > 3 && ctx.measureText(t).width > ancho) t = `${t.slice(0, -2)}…`
  ctx.fillStyle = color
  ctx.textAlign = alinear
  ctx.fillText(t, x, y)
  return c
}

// ── Guías ──
function guiaPortada(lienzo, x, { formato, n, total, portada }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'aprender',
    chapa: 'Guía',
    titulo: x.titulo,
    entradilla: x.descripcion,
    enlace: 'pokedoc.es/aprender',
    linea: apaisada ? '' : total > 1 ? 'Desliza: lo importante, en tres' : formato === 'larga' ? 'Enlace en la bio' : 'La guía entera, en español',
    chapaPie: apaisada ? '' : pagina(n, total) || (x.minutos ? `${x.minutos} min de lectura` : ''),
    maxLineas: portada ? null : apaisada ? 5 : 6,
  })
  if (portada && caja.h > 80) tarjetaGirada(ctx, portada, { ...caja, angulo: apaisada ? 2 : -1.6, borde: apaisada ? 10 : 14 })
}

// Una de lo importante: el número grande en el color de Aprender y el punto
// como título. Sin foto: es texto para leer de un vistazo.
function guiaClave(lienzo, x, { formato, n, total }) {
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'aprender',
    chapa: 'Lo importante',
    titulo: x.punto,
    entradilla: x.detalle || '',
    enlace: 'pokedoc.es/aprender',
    linea: formato === 'apaisada' ? '' : x.titulo,
    chapaPie: formato === 'apaisada' ? '' : pagina(n, total),
    maxLineas: formato === 'apaisada' ? 4 : 5,
  })
  if (caja.h < 60) return
  const cuerpo = Math.min(caja.h * 0.9, formato === 'apaisada' ? 300 : 420)
  ctx.save()
  ctx.font = `800 ${Math.round(cuerpo)}px ${TITULAR}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = formato === 'apaisada' ? 'center' : 'right'
  ctx.globalAlpha = 0.9
  ctx.fillStyle = acento
  const cx = formato === 'apaisada' ? caja.x + caja.w / 2 : caja.x + caja.w
  ctx.fillText(String(x.numero).padStart(2, '0'), cx, caja.y + caja.h - Math.round(cuerpo * 0.06))
  ctx.restore()
}

function guiaCierre(lienzo, x, { formato, n, total, portada }) {
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'aprender',
    chapa: 'Guía',
    titulo: '*Léela entera* en PokeDoc',
    entradilla: x.titulo,
    enlace: 'pokedoc.es/aprender',
    linea: formato === 'apaisada' ? '' : 'Enlace en la bio · gratis y en español',
    chapaPie: formato === 'apaisada' ? '' : pagina(n, total),
  })
  if (portada && caja.h > 80) tarjetaGirada(ctx, portada, { ...caja, angulo: 1.6, borde: 14 })
}

// ── Torneos ──
// Sin cartel, la caja enseña las plazas: es lo que hace que alguien se apunte.
function cajaDePlazas(ctx, caja, acento, x) {
  const w = Math.min(caja.w, 640)
  const h = Math.min(caja.h, 360)
  const x0 = caja.x + (caja.w - w) / 2
  const y0 = caja.y + (caja.h - h) / 2
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  ctx.strokeStyle = acento
  ctx.lineWidth = 4
  redondeado(ctx, x0, y0, w, h, 36)
  ctx.fill()
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#9fb3bd'
  ctx.font = `700 ${Math.round(h * 0.1)}px ${TEXTO}`
  const completo = x.quedan === 0
  const sinTope = x.quedan === null || x.quedan === undefined
  ctx.fillText(sinTope ? 'PLAZAS' : completo ? 'YA ESTÁ' : 'QUEDAN', x0 + w / 2, y0 + h * 0.24)
  ctx.fillStyle = completo ? '#ffffff' : acento
  ctx.font = `800 ${Math.round(h * (sinTope || completo ? 0.3 : 0.46))}px ${TITULAR}`
  ctx.fillText(sinTope ? 'Abiertas' : completo ? 'Completo' : String(x.quedan), x0 + w / 2, y0 + h * (sinTope || completo ? 0.66 : 0.72))
  if (!sinTope && !completo) {
    ctx.fillStyle = '#cfe3f1'
    ctx.font = `600 ${Math.round(h * 0.085)}px ${TEXTO}`
    ctx.fillText(`plazas de ${x.maximo}`, x0 + w / 2, y0 + h * 0.9)
  }
  ctx.restore()
}

function torneoAnuncio(lienzo, x, { formato, portada }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'jugar',
    chapa: x.liga ? 'Liga' : x.oficial ? 'Torneo oficial' : 'Torneo',
    titulo: x.titulo,
    entradilla: [x.cuando, x.formato].filter(Boolean).join(' · '),
    enlace: 'pokedoc.es/torneos',
    linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : 'Te apuntas desde la web',
    chapaPie: apaisada ? '' : x.precio ? `Inscripción: ${x.precio}` : x.quedan ? `Quedan ${x.quedan} plazas` : '',
    maxLineas: apaisada ? 3 : 4,
  })
  if (caja.h < 80) return
  if (portada) tarjetaGirada(ctx, portada, { ...caja, angulo: apaisada ? 2 : -1.6, borde: apaisada ? 10 : 14 })
  else cajaDePlazas(ctx, caja, acento, x)
}

// El podio: el segundo a la izquierda, el campeón en medio y más alto, el
// tercero a la derecha; encima del campeón, los Pokémon de su mazo.
function torneoResultados(lienzo, x, { formato, sprites = [] }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'jugar',
    chapa: 'Resultados',
    titulo: `*${x.campeon}* gana`,
    entradilla: x.titulo,
    enlace: 'pokedoc.es/torneos',
    linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : 'Las partidas, en la web',
    chapaPie: apaisada ? '' : x.jugadores ? `${x.jugadores} jugadores` : '',
    maxLineas: 2,
  })
  if (caja.h < 120) return
  const puestos = x.puestos || []
  const orden = [1, 0, 2].filter((i) => puestos[i])
  const hueco = Math.round(caja.w * 0.03)
  const ancho = Math.round((caja.w - hueco * 2) / 3)
  const altoNombre = Math.round(Math.min(44, caja.h * 0.09))
  const espacioSprites = sprites.length ? Math.round(caja.h * 0.24) : 0
  const maxAlto = caja.h - altoNombre * 1.8 - espacioSprites
  const altos = { 0: maxAlto, 1: maxAlto * 0.72, 2: maxAlto * 0.52 }
  const base = caja.y + caja.h
  ctx.save()
  orden.forEach((i, k) => {
    const x0 = caja.x + k * (ancho + hueco) + (puestos.length < 3 && k === 0 && !puestos[1] ? ancho + hueco : 0)
    const h = Math.round(altos[i])
    const y0 = base - h
    ctx.fillStyle = i === 0 ? acento : 'rgba(255,255,255,0.12)'
    redondeado(ctx, x0, y0, ancho, h, 24)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.fillStyle = i === 0 ? '#0b1219' : '#ffffff'
    ctx.font = `800 ${Math.round(Math.min(ancho * 0.42, h * 0.5))}px ${TITULAR}`
    ctx.textBaseline = 'middle'
    ctx.fillText(String(i + 1), x0 + ancho / 2, y0 + h / 2)
    // El nombre encima de su escalón, recortado al ancho.
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#ffffff'
    let cuerpo = altoNombre
    ctx.font = `700 ${cuerpo}px ${TEXTO}`
    while (cuerpo > 18 && ctx.measureText(puestos[i]).width > ancho) {
      cuerpo -= 2
      ctx.font = `700 ${cuerpo}px ${TEXTO}`
    }
    let nombre = puestos[i]
    while (nombre.length > 3 && ctx.measureText(nombre).width > ancho) nombre = `${nombre.slice(0, -2)}…`
    ctx.fillText(nombre, x0 + ancho / 2, y0 - Math.round(altoNombre * 0.45))
    if (i === 0 && sprites.length) {
      const lado = Math.min(espacioSprites, Math.round(ancho / Math.max(1, sprites.length)) + 20)
      const total = lado * sprites.length - 20 * (sprites.length - 1)
      sprites.forEach((img, j) => {
        ctx.drawImage(img, x0 + ancho / 2 - total / 2 + j * (lado - 20), y0 - altoNombre * 1.4 - lado, lado, lado)
      })
    }
  })
  ctx.restore()
}

// ── Eventos ── (1336)
function evento(lienzo, x, { formato, portada }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'comunidad',
    chapa: x.tipo || 'Evento',
    titulo: x.titulo,
    entradilla: [x.cuando, x.donde].filter(Boolean).join(' · '),
    enlace: 'pokedoc.es/eventos',
    linea: apaisada ? '' : formato === 'larga' ? 'Enlace en la bio' : '¿Vas? Dale a «Voy» en la web',
    chapaPie: apaisada ? '' : x.precio ? `Entrada: ${x.precio.replace(/^Desde /, 'desde ')}` : '',
    maxLineas: apaisada ? 3 : 4,
  })
  if (caja.h < 80) return
  if (portada && x.cartel) return tarjetaGirada(ctx, portada, { ...caja, angulo: apaisada ? 2 : -1.6, borde: apaisada ? 10 : 14 })
  if (portada && x.logoSinFondo) return contener(ctx, portada, caja, { escala: 0.8 })
  // El logo con fondo, o las siglas: un cuadrado en su color, girado como en la ficha.
  const lado = Math.min(caja.w, caja.h) * 0.78
  ctx.save()
  ctx.translate(caja.x + caja.w / 2, caja.y + caja.h / 2)
  ctx.rotate((-4 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 14
  redondeado(ctx, -lado / 2, -lado / 2, lado, lado, lado * 0.14)
  ctx.fillStyle = x.color || '#1e5175'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  if (portada) {
    ctx.clip()
    const k = Math.max(lado / portada.width, lado / portada.height)
    ctx.drawImage(portada, -portada.width * k / 2, -portada.height * k / 2, portada.width * k, portada.height * k)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    lineaQueCabe(ctx, x.siglas || '?', { x: 0, y: 0, ancho: lado * 0.8, cuerpo: Math.round(lado * 0.34), peso: 800, fuente: TITULAR, alinear: 'center' })
  }
  ctx.restore()
}

// «Esta semana»: una fila por evento, con el día en una chapa a la izquierda.
function eventosSemana(lienzo, x, { formato }) {
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'comunidad',
    chapa: 'Esta semana',
    titulo: `*${x.total} eventos* esta semana`,
    entradilla: '¿Te vemos en alguno?',
    enlace: 'pokedoc.es/eventos',
    linea: formato === 'apaisada' ? '' : formato === 'larga' ? 'Enlace en la bio' : 'Toda la agenda, en la web',
    maxLineas: 2,
  })
  const filas = x.filas || []
  if (caja.h < 80 || !filas.length) return
  const alto = Math.min(150, (caja.h - 16 * (filas.length - 1)) / filas.length)
  // La lista, centrada en su hueco: con dos o tres filas, arriba del todo dejaba medio cartel vacío.
  const arriba = caja.y + Math.max(0, (caja.h - (alto * filas.length + 16 * (filas.length - 1))) / 2)
  ctx.save()
  filas.forEach((f, i) => {
    const y = arriba + i * (alto + 16)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    redondeado(ctx, caja.x, y, caja.w, alto, 24)
    ctx.fill()
    const anchoDia = Math.min(220, caja.w * 0.26)
    ctx.fillStyle = acento
    redondeado(ctx, caja.x + 14, y + 14, anchoDia, alto - 28, 18)
    ctx.fill()
    ctx.textBaseline = 'middle'
    lineaQueCabe(ctx, f.dia, { x: caja.x + 14 + anchoDia / 2, y: y + alto / 2, ancho: anchoDia - 20, cuerpo: Math.round(alto * 0.26), peso: 800, fuente: TITULAR, color: '#0b1219', alinear: 'center' })
    const tx = caja.x + anchoDia + 44
    const ancho = caja.w - anchoDia - 64
    lineaQueCabe(ctx, f.nombre, { x: tx, y: y + alto * (f.donde ? 0.38 : 0.5), ancho, cuerpo: Math.round(alto * 0.25), peso: 800, fuente: TITULAR })
    if (f.donde) lineaQueCabe(ctx, f.donde, { x: tx, y: y + alto * 0.7, ancho, cuerpo: Math.round(alto * 0.17), peso: 600, color: '#9fb3bd' })
  })
  ctx.restore()
}

// ── Lanzamientos ── (1336)
function lanzamiento(lienzo, x, { formato, n, total, portada }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'coleccion',
    chapa: x.ya ? 'Ya en tiendas' : 'Lanzamiento',
    titulo: x.ya ? `*${x.titulo}*` : `${x.cuando}: *${x.titulo}*`,
    entradilla: x.ya ? [x.cuando, x.cartas ? `${x.cartas} cartas` : ''].filter(Boolean).join(' · ') : x.cartas ? `${x.cartas} cartas` : '',
    enlace: 'pokedoc.es/lanzamientos',
    linea: apaisada ? '' : total > 1 ? 'Desliza: las más caras' : formato === 'larga' ? 'Enlace en la bio' : 'Todas las cartas, con su precio',
    chapaPie: apaisada ? '' : pagina(n, total),
    maxLineas: 4,
  })
  if (caja.h < 80) return
  if (portada) return contener(ctx, portada, caja, { escala: 0.86 })
  // Sin logo, el día en grande, como en el calendario.
  const [, m, d] = String(x.fecha || '').split('-').map(Number)
  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = acento
  ctx.font = `800 ${Math.round(caja.h * 0.5)}px ${TITULAR}`
  ctx.fillText(String(d || ''), caja.x + caja.w / 2, caja.y + caja.h * 0.62)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${Math.round(caja.h * 0.14)}px ${TITULAR}`
  ctx.fillText(MESES[(m || 1) - 1], caja.x + caja.w / 2, caja.y + caja.h * 0.84)
  ctx.restore()
}

// Las tres más caras, de pie y con su precio debajo; la primera, un poco más alta.
function lanzamientoCaras(lienzo, x, { formato, n, total, cartas = [] }) {
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'coleccion',
    chapa: 'Las más caras',
    titulo: `Lo más caro de *${x.titulo}*`,
    entradilla: 'Precio de tendencia en Cardmarket',
    enlace: 'pokedoc.es/lanzamientos',
    linea: formato === 'apaisada' ? '' : 'Todas las cartas, con su precio',
    chapaPie: formato === 'apaisada' ? '' : pagina(n, total),
    maxLineas: 3,
  })
  const lista = x.cartas || []
  if (caja.h < 120 || !lista.length) return
  const hueco = Math.round(caja.w * 0.04)
  const altoPrecio = Math.round(Math.min(64, caja.h * 0.1))
  const ancho = Math.min((caja.w - hueco * 2) / 3, ((caja.h - altoPrecio * 1.6) / 1.4) * 0.92)
  const alto = ancho * 1.4
  const x0 = caja.x + (caja.w - (ancho * 3 + hueco * 2)) / 2
  const orden = [1, 0, 2]
  ctx.save()
  orden.forEach((i, k) => {
    const c = lista[i]
    if (!c) return
    const sube = i === 0 ? 0 : alto * 0.06
    const cx = x0 + k * (ancho + hueco)
    const cy = caja.y + sube
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 12
    ctx.fillStyle = '#1b2a38'
    redondeado(ctx, cx, cy, ancho, alto, ancho * 0.05)
    ctx.fill()
    ctx.restore()
    dibujarCarta(ctx, cartas[i] || null, { x: cx, y: cy, w: ancho, h: alto, r: ancho * 0.05, nombre: '' })
    if (!cartas[i]) {
      ctx.textBaseline = 'middle'
      lineaQueCabe(ctx, c.nombre, { x: cx + ancho / 2, y: cy + alto / 2, ancho: ancho * 0.86, cuerpo: Math.round(ancho * 0.1), peso: 700, alinear: 'center' })
    }
    ctx.textBaseline = 'alphabetic'
    lineaQueCabe(ctx, c.precioTexto, { x: cx + ancho / 2, y: cy + alto + altoPrecio * 1.05, ancho, cuerpo: altoPrecio, peso: 800, fuente: TITULAR, color: i === 0 ? acento : '#ffffff', alinear: 'center' })
    lineaQueCabe(ctx, c.nombre, { x: cx + ancho / 2, y: cy + alto + altoPrecio * 1.6, ancho, cuerpo: Math.round(altoPrecio * 0.42), peso: 600, color: '#9fb3bd', alinear: 'center' })
  })
  ctx.restore()
}

// ── Lo nuevo del mes ── (1336)
function novedadesPortada(lienzo, x, { formato, n, total }) {
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'inicio',
    chapa: 'Novedades',
    titulo: `Lo nuevo de *${x.mes}* en PokeDoc`,
    entradilla: x.resumen ? `Este mes, ${x.resumen}.` : '',
    enlace: 'pokedoc.es/novedades',
    linea: formato === 'apaisada' ? '' : total > 1 ? 'Desliza: lo que más nos gusta' : 'Todo lo que ha cambiado, en la web',
    chapaPie: formato === 'apaisada' ? '' : pagina(n, total),
    maxLineas: 3,
  })
  const lista = x.titulos || []
  if (caja.h < 80 || !lista.length) return
  const alto = Math.min(140, (caja.h - 16 * (lista.length - 1)) / lista.length)
  const arriba = caja.y + Math.max(0, (caja.h - (alto * lista.length + 16 * (lista.length - 1))) / 2)
  ctx.save()
  lista.forEach((t, i) => {
    const y = arriba + i * (alto + 16)
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    redondeado(ctx, caja.x, y, caja.w, alto, 24)
    ctx.fill()
    ctx.textBaseline = 'middle'
    ctx.fillStyle = acento
    ctx.font = `800 ${Math.round(alto * 0.42)}px ${TITULAR}`
    ctx.textAlign = 'left'
    ctx.fillText(String(i + 1).padStart(2, '0'), caja.x + 28, y + alto / 2)
    lineaQueCabe(ctx, t, { x: caja.x + 28 + alto * 0.75, y: y + alto / 2, ancho: caja.w - alto * 0.75 - 56, cuerpo: Math.round(alto * 0.27), peso: 700, fuente: TITULAR })
  })
  ctx.restore()
}

function novedadesDestacada(lienzo, x, { formato, n, total }) {
  const { ctx, caja, acento } = pintarMarco(lienzo, {
    formato,
    seccion: 'inicio',
    chapa: 'Nuevo en PokeDoc',
    titulo: x.titulo,
    entradilla: x.texto,
    enlace: x.enlace || 'pokedoc.es/novedades',
    linea: formato === 'apaisada' ? '' : 'Pruébalo ya, es gratis',
    chapaPie: formato === 'apaisada' ? '' : pagina(n, total),
    maxLineas: 4,
  })
  if (caja.h < 60) return
  const cuerpo = Math.min(caja.h * 0.9, formato === 'apaisada' ? 300 : 420)
  ctx.save()
  ctx.font = `800 ${Math.round(cuerpo)}px ${TITULAR}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = 0.9
  ctx.fillStyle = acento
  ctx.fillText(String(x.numero).padStart(2, '0'), caja.x + caja.w, caja.y + caja.h - Math.round(cuerpo * 0.06))
  ctx.restore()
}

const PINTORES = {
  'guia-portada': guiaPortada,
  'guia-clave': guiaClave,
  'guia-cierre': guiaCierre,
  'torneo-anuncio': torneoAnuncio,
  'torneo-resultados': torneoResultados,
  evento,
  'eventos-semana': eventosSemana,
  lanzamiento,
  'lanzamiento-caras': lanzamientoCaras,
  'novedades-portada': novedadesPortada,
  'novedades-destacada': novedadesDestacada,
}

// Dibuja la diapositiva `n` (desde 1) de `total` en el tamaño pedido.
export async function pintarDiapositiva(lienzo, d, { formato = 'historia', n = 1, total = 1 } = {}) {
  await prepararMarco()
  const { portada, sprites, cartas } = await imagenesDe(d)
  if (d.pintor === 'noticia') return pintarNoticia(lienzo, { ...d.datos, portada, formato, fecha: d.datos.fecha })
  const pintor = PINTORES[d.pintor]
  if (!pintor) throw new Error(`No hay pintor para «${d.pintor}»`)
  pintor(lienzo, d.datos, { formato, n, total, portada, sprites, cartas })
  return lienzo
}

// Todas las de una pieza, en orden, en un tamaño.
export async function lienzosDePieza(pieza, formato = 'historia', doc = document) {
  const total = pieza.diapositivas.length
  const lienzos = []
  for (let i = 0; i < total; i++) lienzos.push(await pintarDiapositiva(doc.createElement('canvas'), pieza.diapositivas[i], { formato, n: i + 1, total }))
  return lienzos
}
