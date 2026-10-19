// EL CARRUSEL DE PRESENTACIÓN PARA LAS REDES (tanda 903): diez diapositivas
// de 1080 × 1350 (Instagram, 4:5) que repasan lo que hace la web, dibujadas
// en un lienzo CON LAS CARTAS Y LOS LOGOS DE VERDAD del catálogo.
//
// PINGU: «quiero la misma estructura, colores y todo para los posts, y que
// se construyan con imágenes de cartas de verdad, con logos, sacado de la
// web». La plantilla se diseñó fuera (las maquetas de la 902) y aquí se
// repite trazo a trazo; lo que cambia es que las fotos y los logos los
// pone el catálogo, así que se generan desde /admin → Redes, donde el
// navegador sí llega a las CDN (desde el contenedor de Claude no).
//
// Lo PURO (los textos de cada diapositiva, qué cartas sirven) se exporta
// aparte para probarlo sin lienzo. Las fotos entran por
// `fotoParaElLienzo` (571): directas con permiso o por `imagen-carta`;
// sin foto, la carta sale como un rectángulo con su nombre, nunca en blanco.
import { fotoParaElLienzo, cargarImagen, redondeado, dibujarCarta } from './imagen-compartir.js'
import { envolver } from './noticia-compartir.js'
import { cadenaDeEscaneo } from './escaneo-carta.js'
import { urlDeLogo } from './carta-ruta.js'
import { logosDePago, nombreDeCarta } from './catalogo-series.js'
import { urlDeSprite } from './torneos/sprites-pokemon.js'
import { euros } from './cardmarket.js'

export const ANCHO = 1080
export const ALTO = 1350

const TITULAR = 'Fredoka, Inter, sans-serif'
const TEXTO = 'Inter, sans-serif'

// Los degradados de la casa (`--arte-*` de style.css, en los dos tonos que
// cada uno pinta de esquina a esquina).
export const FONDOS = {
  azul: ['#2a6b96', '#1e5175', '#163d59'],
  verde: ['#0d9e6e', '#0891b2'],
  ambar: ['#c8720a', '#e0b252'],
  cian: ['#0891b2', '#2a6b96'],
  morado: ['#7c3aed', '#4f46e5'],
  rosa: ['#be185d', '#7c3aed'],
}

// Lo que dice cada diapositiva. Se exporta para que la prueba lo lea y
// para que cambiar una frase sea cambiarla aquí y nada más.
export const DIAPOSITIVAS = [
  { tipo: 'portada', fondo: 'azul', titulo: 'Todo lo que puedes hacer en PokeDoc', sub: 'La comunidad española de Pokémon TCG. Gratis, en español y sin anuncios.' },
  { tipo: 'coleccion', fondo: 'azul', titulo: 'Tu colección, con lo que vale hoy', puntos: ['Añade cartas escaneando con la cámara o buscando por nombre', 'Cada una con su precio en Cardmarket, en tu idioma, al día', 'Lo que vale todo y cuánto ha subido este mes'] },
  { tipo: 'expansiones', fondo: 'cian', titulo: 'Expansiones, álbumes y Pokédex', puntos: ['Cada expansión con lo que tienes y lo que te falta, en occidental y japonés', 'Archivadores como los de verdad, para colocar tus cartas', 'Tu Pokédex: qué especies tienes y cuáles no'] },
  { tipo: 'cambios', fondo: 'rosa', titulo: 'Cambios entre coleccionistas', puntos: ['Apunta las cartas que das y las que buscas', 'PokeDoc te cruza con quien tiene lo que te falta', 'Avisos de precio: te avisa cuando una carta baja de lo que pagarías'] },
  { tipo: 'foro', fondo: 'morado', titulo: 'Un foro de verdad', puntos: ['Hilos, encuestas, menciones y mensajes privados con fotos', 'Escribe [[Arven]] y sale la carta con su foto y su precio', 'Perfiles con vitrina, medallas y lo que cada uno cambia'] },
  { tipo: 'retos', fondo: 'verde', titulo: 'Un reto cada día', puntos: ['Seis retos: ¿qué carta es?, ¿quién es ese Pokémon?, ¿más cara o más barata?, ordena por precio, ¿qué expansión?', 'Liga mensual, rachas y logros', 'Experiencia por jugar y una imagen para presumir'] },
  { tipo: 'torneos', fondo: 'ambar', titulo: 'Torneos en línea', puntos: ['Pareos suizos, top cut y ligas por jornadas', 'Listas de mazo, reportes, clasificación y podio', 'Abiertos a todo el mundo: cualquiera puede crear uno'] },
  { tipo: 'mazos', fondo: 'cian', titulo: 'Mazos, laboratorio y meta', puntos: ['Constructor de mazos con legalidad y lo que te falta por comprar', 'Laboratorio: juega tu mazo contra ti mismo, prueba manos y evoluciones', 'Los mazos del meta, con su porcentaje y sus cartas'] },
  { tipo: 'guias', fondo: 'azul', titulo: 'Guías, cursos y noticias', puntos: ['Aprende a leer una carta, a detectar falsas y a entender rarezas', 'Cursos jugables con puntos y niveles', 'Noticias, calendario de lanzamientos y productos con precio'] },
  { tipo: 'cierre', fondo: 'azul', titulo: 'Y todo gratis, sin anuncios', filas: ['📱 Instálala como app en el móvil', '🌐 Funciona sin conexión', '🇪🇸 En español, hecha desde España', '💙 Gratis y sin anuncios, para siempre'] },
]

// Los mazos del meta de la diapositiva 8 van de ejemplo (con su etiqueta):
// el ranking de verdad cambia cada semana y aquí lo que importa es la forma.
export const MAZOS_EJEMPLO = [
  { nombre: 'Dragapult ex', dex: 887, pct: 18, color: '#1e5175' },
  { nombre: 'Gardevoir ex', dex: 282, pct: 14, color: '#7c3aed' },
  { nombre: 'Raging Bolt ex', dex: 1021, pct: 11, color: '#0d9e6e' },
]
export const PODIO_EJEMPLO = [
  { puesto: 2, nombre: 'Laura', dex: 282, alto: 330 },
  { puesto: 1, nombre: 'Dani', dex: 6, alto: 420 },
  { puesto: 3, nombre: 'Marc', dex: 149, alto: 270 },
]

// ── Lo puro: elegir qué cartas y qué set sirven ──

// Las cartas que se enseñan: con foto, occidentales, las más valiosas
// primero y sin repetir nombre (cuatro Charizard seguidos no cuentan nada).
export function cartasQueSirven(cartas, precios, cuantas = 8) {
  const precioDe = new Map((precios || []).map((p) => [p.card_id, Number(p.cm_trend ?? p.cm_low ?? 0) || 0]))
  const vistos = new Set()
  return (cartas || [])
    .filter((c) => c?.image_path && (c.market || 'WEST') === 'WEST')
    .map((c) => ({ ...c, precio: precioDe.get(c.id) || 0 }))
    .sort((a, b) => b.precio - a.precio)
    .filter((c) => {
      const k = nombreDeCarta(c)
      if (vistos.has(k)) return false
      vistos.add(k)
      return true
    })
    .slice(0, cuantas)
}

// El set de la diapositiva 3: el más reciente que tenga logo.
export function setQueSirve(sets) {
  return (sets || []).find((s) => logosDePago(s).length || s.logo_path) || null
}

export function urlDelLogo(set) {
  if (!set) return null
  const de = logosDePago(set)[0]
  if (de) return urlDeLogo(de, set.market || 'WEST')
  return set.logo_path ? urlDeLogo(set.logo_path, set.market || 'WEST') : null
}

// Las guías de la diapositiva 9: dos guías y una noticia, lo más nuevo.
export function guiasQueSirven(guias) {
  const pub = (guias || []).filter((g) => g?.title && g.published_at)
  const deGuia = pub.filter((g) => g.kind !== 'news').slice(0, 2)
  const noticia = pub.find((g) => g.kind === 'news')
  return [...deGuia, ...(noticia ? [noticia] : [])]
}

// ── Los datos, del catálogo ──
//
// Todo con respaldo: si una consulta falla, la diapositiva sale con lo de
// ejemplo y lo dice en el aviso, en vez de dejar el carrusel a medias.
export async function cargarDatosDelCarrusel(supabase) {
  const avisos = []
  const datos = { cartas: [], set: null, setCartas: [], guias: [] }
  try {
    const { data: precios } = await supabase.from('tcg_card_prices').select('card_id,cm_trend,cm_low').not('cm_trend', 'is', null).order('cm_trend', { ascending: false }).limit(80)
    const ids = (precios || []).map((p) => p.card_id)
    if (ids.length) {
      const { data: cartas } = await supabase.from('tcg_cards').select('id,name,name_es,local_id,image_path,set_id,market,tcg_sets(name,name_en)').in('id', ids).eq('market', 'WEST')
      datos.cartas = cartasQueSirven(cartas, precios, 9)
    }
    if (!datos.cartas.length) avisos.push('no hay cartas con precio y foto: las cartas van de ejemplo')
  } catch (e) {
    avisos.push(`cartas: ${e?.message || e}`)
  }
  try {
    const { data: sets } = await supabase.from('tcg_sets').select('id,name,name_en,market,logo_path,logo_scrydex,logo_tcggo,card_count_official,card_count_total,release_date,oculto').eq('market', 'WEST').not('release_date', 'is', null).order('release_date', { ascending: false }).limit(20)
    datos.set = setQueSirve((sets || []).filter((s) => !s.oculto))
    if (datos.set) {
      const { data: cartas } = await supabase.from('tcg_cards').select('id,name,name_es,local_id,image_path,set_id,market').eq('set_id', datos.set.id).eq('market', 'WEST').not('image_path', 'is', null).order('local_id').limit(8)
      datos.setCartas = cartas || []
    } else avisos.push('ningún set con logo: la expansión va de ejemplo')
  } catch (e) {
    avisos.push(`expansión: ${e?.message || e}`)
  }
  try {
    const { data: guias } = await supabase.from('guides').select('id,title,kind,estimated_mins,published_at').not('published_at', 'is', null).order('published_at', { ascending: false }).limit(20)
    datos.guias = guiasQueSirven(guias)
    if (!datos.guias.length) avisos.push('sin guías publicadas: van de ejemplo')
  } catch (e) {
    avisos.push(`guías: ${e?.message || e}`)
  }
  return { datos, avisos }
}

// ── El dibujo ──

function fondo(ctx, nombre) {
  const colores = FONDOS[nombre] || FONDOS.azul
  const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
  colores.forEach((c, i) => g.addColorStop(i / (colores.length - 1), c))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ANCHO, ALTO)
  // Los puntos de la plantilla: una retícula de 28 px al 10 %.
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  for (let y = 14; y < ALTO; y += 28) for (let x = 14; x < ANCHO; x += 28) ctx.fillRect(x, y, 3, 3)
}

function texto(ctx, t, x, y, { font, color = '#fff', align = 'left', max } = {}) {
  ctx.font = font
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  if (max) ctx.fillText(t, x, y, max)
  else ctx.fillText(t, x, y)
}

// Un párrafo envuelto; devuelve la y de debajo de la última línea.
function parrafo(ctx, t, x, y, { font, color = '#fff', maxAncho, lineaAlto, maximo = 4, align = 'left' }) {
  ctx.font = font
  const lineas = envolver(ctx, t, maxAncho, maximo)
  lineas.forEach((l, i) => texto(ctx, l, x, y + i * lineaAlto, { font, color, align }))
  return y + lineas.length * lineaAlto
}

function panelBlanco(ctx, x, y, w, h, r = 26) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 24
  redondeado(ctx, x, y, w, h, r)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()
}

function cajaTranslucida(ctx, x, y, w, h, r = 26) {
  redondeado(ctx, x, y, w, h, r)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.stroke()
}

function pildora(ctx, t, x, y, { font = `700 28px ${TEXTO}`, fondo = '#ffffff', color = '#1e5175', alto = 56, lado = 26, derecha = false } = {}) {
  ctx.font = font
  const w = ctx.measureText(t).width + lado * 2
  const x0 = derecha ? x - w : x
  redondeado(ctx, x0, y, w, alto, alto / 2)
  ctx.fillStyle = fondo
  ctx.fill()
  texto(ctx, t, x0 + w / 2, y + alto / 2 + 10, { font, color, align: 'center' })
  return w
}

// El icono de la app: la baldosa blanca girada con la «P».
function baldosa(ctx, x, y, lado) {
  ctx.save()
  ctx.translate(x + lado / 2, y + lado / 2)
  ctx.rotate((-6 * Math.PI) / 180)
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 12
  redondeado(ctx, -lado / 2, -lado / 2, lado, lado, lado * 0.25)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  texto(ctx, 'P', 0, lado * 0.27, { font: `600 ${Math.round(lado * 0.73)}px ${TITULAR}`, color: '#1e5175', align: 'center' })
  ctx.restore()
}

function marca(ctx, x, y, tam) {
  ctx.font = `600 ${tam}px ${TITULAR}`
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Poke', x, y)
  const w = ctx.measureText('Poke').width
  ctx.fillStyle = '#7cc6d8'
  ctx.fillText('Doc', x + w, y)
}

function cabeceraDeBloque(ctx, d, i, total) {
  texto(ctx, `${i + 1} / ${total}`, 70, 96, { font: `600 34px ${TITULAR}`, color: 'rgba(255,255,255,0.85)' })
  const yTitulo = parrafo(ctx, d.titulo, 70, 190, { font: `700 70px ${TEXTO}`, maxAncho: 940, lineaAlto: 77, maximo: 2 })
  let y = Math.max(yTitulo + 40, 350)
  for (const p of d.puntos) {
    ctx.beginPath()
    ctx.arc(77, y - 10, 7, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
    y = parrafo(ctx, p, 100, y, { font: `500 30px ${TEXTO}`, maxAncho: 900, lineaAlto: 39, maximo: 3 }) + 14
  }
}

function pieDeBloque(ctx, etiqueta = 'Ejemplo') {
  texto(ctx, etiqueta, 70, ALTO - 56, { font: `600 28px ${TEXTO}`, color: 'rgba(255,255,255,0.85)' })
  pildora(ctx, 'pokedoc.es', ANCHO - 70, ALTO - 96, { derecha: true })
}

function etiquetaPrecio(ctx, t, cx, y) {
  ctx.font = `700 20px ${TEXTO}`
  const w = ctx.measureText(t).width + 20
  redondeado(ctx, cx - w / 2, y, w, 34, 8)
  ctx.fillStyle = '#1e5175'
  ctx.fill()
  texto(ctx, t, cx, y + 24, { font: `700 20px ${TEXTO}`, align: 'center' })
}

// Una rejilla de cartas dentro de un panel: `n` por fila, de ancho `w`.
async function rejillaDeCartas(ctx, cartas, { x, y, ancho, porFila = 4, hueco = 18, precios = false, maxFilas = 2 }) {
  const w = (ancho - hueco * (porFila - 1)) / porFila
  const h = (w * 88) / 63
  const fotos = await Promise.all(cartas.map((c) => fotoParaElLienzo(cadenaDeEscaneo(c, null, 'high'))))
  cartas.slice(0, porFila * maxFilas).forEach((c, i) => {
    const cx = x + (i % porFila) * (w + hueco)
    const cy = y + Math.floor(i / porFila) * (h + hueco + (precios ? 16 : 0))
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.18)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 8
    redondeado(ctx, cx, cy, w, h, 14)
    ctx.fillStyle = '#e1f0f4'
    ctx.fill()
    ctx.restore()
    dibujarCarta(ctx, fotos[i], { x: cx, y: cy, w, h, r: 14, nombre: nombreDeCarta(c) })
    if (precios && c.precio) etiquetaPrecio(ctx, euros(c.precio), cx + w / 2, cy + h - 12)
  })
  return y + Math.min(maxFilas, Math.ceil(cartas.length / porFila)) * (h + hueco)
}

function burbuja(ctx, { quien, t, x, y, maxAncho, mia = false }) {
  ctx.font = `400 27px ${TEXTO}`
  const lineas = envolver(ctx, t, maxAncho - 56, 3)
  const w = Math.min(maxAncho, Math.max(...lineas.map((l) => ctx.measureText(l).width)) + 56)
  const h = 22 + 30 + lineas.length * 35 + 14
  const x0 = mia ? x - w : x
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 14
  redondeado(ctx, x0, y, w, h, 26)
  ctx.fillStyle = mia ? '#1e5175' : '#ffffff'
  ctx.fill()
  ctx.restore()
  texto(ctx, quien, x0 + 28, y + 42, { font: `600 19px ${TEXTO}`, color: mia ? '#c2dde6' : '#52717f' })
  lineas.forEach((l, i) => texto(ctx, l, x0 + 28, y + 78 + i * 35, { font: `400 27px ${TEXTO}`, color: mia ? '#ffffff' : '#0d1b2a' }))
  return y + h
}

async function sprite(dex) {
  const url = urlDeSprite(dex)
  return url ? fotoParaElLienzo([url]) : null
}

// Cada tipo de diapositiva, con su dibujo de abajo.
const DIBUJOS = {
  async portada(ctx, d, datos) {
    baldosa(ctx, 70, 80, 110)
    marca(ctx, 210, 170, 96)
    parrafo(ctx, d.titulo, 70, 385, { font: `700 84px ${TEXTO}`, maxAncho: 720, lineaAlto: 90, maximo: 3 })
    parrafo(ctx, d.sub, 70, 800, { font: `500 36px ${TEXTO}`, color: '#c2dde6', maxAncho: 700, lineaAlto: 48, maximo: 3 })
    if (datos.mascota) {
      const h = 620
      const w = (h * datos.mascota.width) / datos.mascota.height
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.3)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetY = 20
      ctx.drawImage(datos.mascota, ANCHO - w + 60, ALTO - 120 - h, w, h)
      ctx.restore()
    }
    pildora(ctx, 'Pasa para verlo →', 70, ALTO - 150 - 64, { font: `700 32px ${TEXTO}`, alto: 64, lado: 32 })
  },
  async coleccion(ctx, d, datos) {
    const cartas = datos.cartas.slice(0, 4)
    const total = cartas.reduce((s, c) => s + (c.precio || 0), 0)
    panelBlanco(ctx, 70, 640, 940, 560)
    ctx.save()
    redondeado(ctx, 70, 640, 940, 560, 26)
    ctx.clip()
    texto(ctx, 'Lo que vale', 104, 700, { font: `600 24px ${TEXTO}`, color: '#52717f' })
    texto(ctx, total ? euros(total) : '1.248 €', 104, 760, { font: `600 68px ${TITULAR}`, color: '#1e5175' })
    texto(ctx, 'al día, en Cardmarket', 976, 700, { font: `700 26px ${TEXTO}`, color: '#0d9e6e', align: 'right' })
    await rejillaDeCartas(ctx, cartas.length ? cartas : ejemploCartas(4), { x: 104, y: 800, ancho: 872, precios: true, maxFilas: 1 })
    ctx.restore()
  },
  async expansiones(ctx, d, datos) {
    panelBlanco(ctx, 70, 640, 940, 560)
    ctx.save()
    redondeado(ctx, 70, 640, 940, 560, 26)
    ctx.clip()
    const set = datos.set
    const logo = datos.logo
    if (logo) {
      const maxW = 300
      const maxH = 110
      const esc = Math.min(maxW / logo.width, maxH / logo.height)
      ctx.drawImage(logo, 104, 680, logo.width * esc, logo.height * esc)
    } else {
      texto(ctx, set?.name || set?.name_en || 'Paldea Evolved', 104, 740, { font: `600 44px ${TITULAR}`, color: '#1e5175' })
    }
    const total = set?.card_count_total || set?.card_count_official || 193
    const tienes = Math.round(total * 0.72)
    texto(ctx, `${tienes} de ${total} · ${Math.round((tienes / total) * 100)} %`, 976, 740, { font: `600 26px ${TEXTO}`, color: '#52717f', align: 'right' })
    await rejillaDeCartas(ctx, datos.setCartas.length ? datos.setCartas : ejemploCartas(8), { x: 104, y: 820, ancho: 872, maxFilas: 2 })
    ctx.restore()
  },
  async cambios(ctx, d, datos) {
    const c = datos.cartas[0]
    const nombre = c ? nombreDeCarta(c) : 'Terrakion'
    let y = burbuja(ctx, { quien: 'soyfede', t: `¿Alguien tiene el ${nombre} en español? Doy un Charizard ex.`, x: 70, y: 650, maxAncho: 760 })
    y = burbuja(ctx, { quien: 'tú', t: 'Yo tengo dos. Te lo cambio.', x: 1010, y: y + 20, maxAncho: 760, mia: true })
    cajaTranslucida(ctx, 70, y + 40, 940, 130)
    texto(ctx, 'Cruce con soyfede', 100, y + 95, { font: `700 32px ${TEXTO}` })
    texto(ctx, 'Te da 1 carta · Le das 1 carta', 100, y + 138, { font: `400 26px ${TEXTO}`, color: 'rgba(255,255,255,0.9)' })
    texto(ctx, 'Ver →', 980, y + 118, { font: `500 28px ${TEXTO}`, align: 'right' })
  },
  async foro(ctx, d, datos) {
    const c = datos.cartas[1] || datos.cartas[0]
    const chip = c ? `${nombreDeCarta(c)} · ${euros(c.precio)}` : 'Umbreon ex · 312 €'
    let y = burbuja(ctx, { quien: 'pingu · hace 2 h', t: `¿Merece la pena abrir sobres este mes? Yo saqué un ${chip}`, x: 70, y: 650, maxAncho: 860 })
    burbuja(ctx, { quien: 'maria_tcg · hace 1 h', t: 'Yo ya tengo 3 cajas abiertas y ni una buena 😭', x: 70, y: y + 20, maxAncho: 860 })
    // La carta de la que hablan, al lado: es lo que hace [[Arven]].
    if (c && datos.fotoForo) dibujarCarta(ctx, datos.fotoForo, { x: 790, y: 880, w: 220, h: 307, r: 16, nombre: nombreDeCarta(c) })
  },
  async retos(ctx, d, datos) {
    cajaTranslucida(ctx, 70, 640, 940, 560, 32)
    // La silueta de una carta de verdad, como en «¿Qué carta es?».
    const foto = datos.fotoReto
    const w = 240
    const h = (w * 88) / 63
    const x = 150
    const y = 640 + (560 - h) / 2
    redondeado(ctx, x, y, w, h, 16)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fill()
    if (foto) {
      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      const o = off.getContext('2d')
      o.drawImage(foto, 0, 0, w, h)
      o.globalCompositeOperation = 'source-in'
      o.fillStyle = '#063d2c'
      o.fillRect(0, 0, w, h)
      ctx.save()
      redondeado(ctx, x, y, w, h, 16)
      ctx.clip()
      ctx.globalAlpha = 0.9
      ctx.drawImage(off, x, y)
      ctx.restore()
    }
    texto(ctx, '¿Qué carta es?', 450, 830, { font: `700 42px ${TEXTO}` })
    parrafo(ctx, 'Adivina la carta del día por su silueta', 450, 880, { font: `400 27px ${TEXTO}`, color: 'rgba(255,255,255,0.9)', maxAncho: 520, lineaAlto: 34 })
    parrafo(ctx, 'Seis retos, uno por día de la semana', 450, 960, { font: `400 27px ${TEXTO}`, color: 'rgba(255,255,255,0.9)', maxAncho: 520, lineaAlto: 34 })
    pildora(ctx, 'Racha: 12 días', 450, 1020, { font: `700 25px ${TEXTO}`, color: '#0d9e6e', alto: 54, lado: 22 })
  },
  async torneos(ctx, d, datos) {
    const anchoP = 240
    const hueco = 24
    const x0 = (ANCHO - (anchoP * 3 + hueco * 2)) / 2
    const base = 1200
    for (let i = 0; i < PODIO_EJEMPLO.length; i++) {
      const p = PODIO_EJEMPLO[i]
      const x = x0 + i * (anchoP + hueco)
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.15)'
      ctx.shadowBlur = 30
      ctx.shadowOffsetY = -10
      redondeado(ctx, x, base - p.alto, anchoP, p.alto + 40, 22)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.restore()
      const sp = datos.sprites?.[p.dex]
      if (sp) ctx.drawImage(sp, x + anchoP / 2 - 60, base - p.alto - 70, 120, 120)
      texto(ctx, String(p.puesto), x + anchoP / 2, base - p.alto + 90, { font: `600 64px ${TITULAR}`, color: '#1e5175', align: 'center' })
      texto(ctx, p.nombre, x + anchoP / 2, base - p.alto + 140, { font: `700 30px ${TEXTO}`, color: '#1e5175', align: 'center' })
    }
  },
  async mazos(ctx, d, datos) {
    panelBlanco(ctx, 70, 640, 940, 560)
    ctx.save()
    redondeado(ctx, 70, 640, 940, 560, 26)
    ctx.clip()
    let y = 674
    for (const m of MAZOS_EJEMPLO) {
      const w = 300 + (m.pct / 18) * 420
      redondeado(ctx, 104, y, w, 58, 12)
      ctx.fillStyle = m.color
      ctx.fill()
      const sp = datos.sprites?.[m.dex]
      if (sp) ctx.drawImage(sp, 112, y - 4, 66, 66)
      texto(ctx, m.nombre, 190, y + 39, { font: `600 24px ${TEXTO}` })
      texto(ctx, `${m.pct} %`, 104 + w - 18, y + 39, { font: `700 24px ${TEXTO}`, align: 'right' })
      y += 72
    }
    const cartas = datos.cartas.slice(4, 8)
    await rejillaDeCartas(ctx, cartas.length === 4 ? cartas : ejemploCartas(4), { x: 104, y: y + 20, ancho: 872, maxFilas: 1 })
    ctx.restore()
  },
  async guias(ctx, d, datos) {
    const guias = datos.guias.length ? datos.guias : [{ title: 'Cómo detectar una carta falsa', kind: 'guide', estimated_mins: 8 }, { title: 'Las rarezas, explicadas', kind: 'guide', estimated_mins: 6 }, { title: 'Sale hoy: Mega Evolución', kind: 'news' }]
    let y = 650
    for (const g of guias) {
      panelBlanco(ctx, 70, y, 940, 110, 22)
      texto(ctx, g.title, 100, y + 52, { font: `700 32px ${TEXTO}`, color: '#0d1b2a', max: 880 })
      texto(ctx, g.kind === 'news' ? 'Noticia' : `Guía${g.estimated_mins ? ` · ${g.estimated_mins} min` : ''}`, 100, y + 88, { font: `600 22px ${TEXTO}`, color: '#52717f' })
      y += 130
    }
  },
  async cierre(ctx, d) {
    baldosa(ctx, 70, 80, 110)
    marca(ctx, 210, 170, 96)
    parrafo(ctx, d.titulo, 70, 385, { font: `700 84px ${TEXTO}`, maxAncho: 900, lineaAlto: 90, maximo: 2 })
    let y = 560
    for (const f of d.filas) {
      cajaTranslucida(ctx, 70, y, 940, 86, 22)
      texto(ctx, f, 100, y + 55, { font: `600 32px ${TEXTO}` })
      y += 102
    }
    texto(ctx, 'pokedoc.es · @pokedoc_es', 70, ALTO - 150, { font: `600 54px ${TITULAR}` })
  },
}

function ejemploCartas(n) {
  return [...Array(n)].map((_, i) => ({ id: `ej-${i}`, name: `Carta ${i + 1}`, image_path: null, precio: 0 }))
}

// Las fotos que hacen falta, todas de una vez (y cada una con su respaldo).
export async function prepararFotos(datos) {
  const [mascota, logo, fotoReto, fotoForo] = await Promise.all([
    cargarImagen('/assets/images/mascota.webp').catch(() => null),
    datos.set ? fotoParaElLienzo([urlDelLogo(datos.set)].filter(Boolean)) : null,
    datos.cartas[2] ? fotoParaElLienzo(cadenaDeEscaneo(datos.cartas[2], null, 'high')) : null,
    datos.cartas[1] ? fotoParaElLienzo(cadenaDeEscaneo(datos.cartas[1], null, 'high')) : null,
  ])
  const sprites = {}
  await Promise.all([...PODIO_EJEMPLO, ...MAZOS_EJEMPLO].map(async (p) => { sprites[p.dex] = await sprite(p.dex) }))
  return { ...datos, mascota, logo, fotoReto, fotoForo, sprites }
}

export async function dibujarDiapositiva(i, datos, doc = document) {
  const d = DIAPOSITIVAS[i]
  const lienzo = doc.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = ALTO
  const ctx = lienzo.getContext('2d')
  fondo(ctx, d.fondo)
  if (d.puntos) cabeceraDeBloque(ctx, d, i, DIAPOSITIVAS.length)
  await DIBUJOS[d.tipo](ctx, d, datos)
  if (d.puntos) pieDeBloque(ctx, datos.cartas.length ? 'pokedoc.es · cartas del catálogo' : 'Ejemplo')
  return lienzo
}

export async function dibujarCarrusel(datos, doc = document) {
  const listos = await prepararFotos(datos)
  const lienzos = []
  for (let i = 0; i < DIAPOSITIVAS.length; i++) lienzos.push(await dibujarDiapositiva(i, listos, doc))
  return lienzos
}
