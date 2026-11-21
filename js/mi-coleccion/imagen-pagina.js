// «Presume de página» (tanda 1409, PINGU de las siete ideas: «presume tu
// página, sí»): una página de un álbum tuyo en una imagen para redes, con el
// marco común (`redes-marco.js`), sus cartas en su bolsillo —los huecos, como
// huecos— y debajo sus tres colores, los mismos que enseña «Sugerir»
// (`armonia.js`). Entra por `import()` desde el ⋯ del álbum.
import { fotoParaElLienzo, dibujarCarta, redondeado } from '../imagen-compartir.js'
import { pintarMarco, TEXTO } from '../redes-marco.js'
import { cadenaDeEscaneo } from '../escaneo-carta.js'
import { paletaDePagina, huellasDe } from './armonia.js'

const PROP = 342 / 245

// Puro: el título con la palabra clave en el color (la última, `*así*`).
export function tituloDePagina(nombre) {
  const t = String(nombre || '').trim() || 'Mi álbum'
  const i = t.lastIndexOf(' ')
  return i > 0 ? `${t.slice(0, i)} *${t.slice(i + 1)}*` : `*${t}*`
}

// Puro: lo que acompaña a la imagen (con sus emojis, la norma de la 568).
export function textoDePagina({ nombre = '', pagina = 1, nombres = [] }) {
  const lineas = [`📒 Una página de mi álbum «${nombre || 'Mi álbum'}» (pág. ${pagina}) en PokeDoc`]
  for (const n of nombres.filter(Boolean).slice(0, 12)) lineas.push(`· ${n}`)
  lineas.push('pokedoc.es')
  return lineas.join('\n')
}

// Puro: cómo se reparte la caja entre la hoja y la tira de colores.
export function medidasDeHoja(caja, { columnas, filas, conPaleta = true, apaisada = false }) {
  const tira = conPaleta ? (apaisada ? 34 : 56) : 0
  const entre = conPaleta ? (apaisada ? 14 : 24) : 0
  const pad = apaisada ? 12 : 22
  const hueco = apaisada ? 8 : 14
  const altoHoja = caja.h - tira - entre
  const w = Math.floor(Math.min((caja.w - pad * 2 - hueco * (columnas - 1)) / columnas, (altoHoja - pad * 2 - hueco * (filas - 1)) / filas / PROP))
  const h = Math.round(w * PROP)
  const hojaW = w * columnas + hueco * (columnas - 1) + pad * 2
  const hojaH = h * filas + hueco * (filas - 1) + pad * 2
  const bloque = hojaH + entre + tira
  const x = caja.x + (caja.w - hojaW) / 2
  const y = caja.y + Math.max(0, (caja.h - bloque) / 2)
  return { w, h, pad, hueco, hoja: { x, y, w: hojaW, h: hojaH }, tira: { x, y: y + hojaH + entre, w: hojaW, h: tira } }
}

// Los colores: una tira con el peso de cada uno y su código dentro si cabe
// (con nombres salía «azul · blanco · azul»: dos azules distintos se llaman igual).
function pintarTira(ctx, paleta, { x, y, w, h }) {
  if (!paleta || !h) return
  const total = paleta.pesos.reduce((s, p) => s + p, 0) || 1
  const sep = 6
  const util = w - sep * (paleta.hex.length - 1)
  let cx = x
  paleta.hex.forEach((hex, i) => {
    const ancho = Math.max(h, Math.round((util * paleta.pesos[i]) / total))
    const ultimo = i === paleta.hex.length - 1
    const aw = ultimo ? x + w - cx : ancho
    ctx.save()
    redondeado(ctx, cx, y, aw, h, Math.round(h / 3))
    ctx.fillStyle = hex
    ctx.fill()
    const claro = paleta.labs[i][0] > 0.72
    const nombre = hex.toUpperCase()
    ctx.font = `600 ${Math.round(h * 0.4)}px ${TEXTO}`
    if (ctx.measureText(nombre).width < aw - h * 0.6) {
      ctx.fillStyle = claro ? '#0b1219' : '#ffffff'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(nombre, cx + aw / 2, y + h / 2 + 1)
    }
    ctx.restore()
    cx += aw + sep
  })
}

// El dibujo. `fotos`: una por bolsillo de la página (null = hueco), con su
// `img` (o null si no llegó) y su `nombre`.
export function pintarPagina(lienzo, { fotos = [], columnas = 3, filas = 3, nombre = '', pagina = 1, paleta = null, formato = 'historia' }) {
  const apaisada = formato === 'apaisada'
  const { ctx, caja } = pintarMarco(lienzo, {
    formato,
    seccion: 'coleccion',
    chapa: 'Mi álbum',
    titulo: tituloDePagina(nombre),
    entradilla: '',
    enlace: 'pokedoc.es',
    linea: formato === 'larga' ? 'Enlace en la bio' : apaisada ? '' : 'Ordena la tuya en PokeDoc',
    chapaPie: apaisada ? '' : `Página ${pagina}`,
    maxLineas: 2,
  })
  const m = medidasDeHoja(caja, { columnas, filas, conPaleta: Boolean(paleta), apaisada })
  // La hoja: oscura y con sus bolsillos, como la del álbum.
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 18
  redondeado(ctx, m.hoja.x, m.hoja.y, m.hoja.w, m.hoja.h, apaisada ? 14 : 24)
  ctx.fillStyle = '#0e1a25'
  ctx.fill()
  ctx.restore()
  const r = Math.max(4, Math.round(m.w / 18))
  for (let i = 0; i < columnas * filas; i++) {
    const x = m.hoja.x + m.pad + (i % columnas) * (m.w + m.hueco)
    const y = m.hoja.y + m.pad + Math.floor(i / columnas) * (m.h + m.hueco)
    const f = fotos[i]
    if (f) {
      dibujarCarta(ctx, f.img, { x, y, w: m.w, h: m.h, r, nombre: f.img ? '' : f.nombre })
      continue
    }
    ctx.save()
    redondeado(ctx, x + 1, y + 1, m.w - 2, m.h - 2, r)
    ctx.setLineDash([10, 8])
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.stroke()
    ctx.restore()
  }
  pintarTira(ctx, paleta, m.tira)
  return lienzo
}

// Las páginas que se pueden enseñar: las que se ven y tienen alguna carta.
export function paginasParaEnsenar(cartas, porPagina, vistas) {
  return vistas.filter((p) => cartas.slice(p * porPagina, (p + 1) * porPagina).some((c) => c?.id))
}

// La hoja de compartir con la página. `c`: { album, forma, cartaDe, nombreDe,
// fotoDe (la pequeña de la armonía), paginas (índices desde 0) }.
export async function compartirPagina(c) {
  const { porPagina, columnas, filas } = c.forma
  const paginas = paginasParaEnsenar(c.album.cartas, porPagina, c.paginas)
  if (!paginas.length) throw new Error('Esta página está vacía: pon alguna carta y vuelve a probar.')
  const cartasDe = (p) => c.album.cartas.slice(p * porPagina, (p + 1) * porPagina).concat(Array(porPagina).fill(null)).slice(0, porPagina).map((x) => (x?.id ? c.cartaDe(x.id) || { id: x.id } : null))
  const hechas = new Map()
  const dibujoDe = (p) => {
    if (!hechas.has(p)) {
      hechas.set(p, (async () => {
        const lista = cartasDe(p)
        const conCarta = lista.filter(Boolean)
        const [fotos, huellas] = await Promise.all([
          Promise.all(lista.map(async (x) => (x ? { img: await fotoParaElLienzo(cadenaDeEscaneo(x, x?.tcg_sets?.tcg_online_code || null, 'high')), nombre: c.nombreDe(x) } : null))),
          huellasDe(conCarta, c.fotoDe).catch(() => new Map()),
        ])
        const lasHuellas = conCarta.map((x) => huellas.get(x.id)).filter(Boolean)
        return { fotos, paleta: lasHuellas.length ? paletaDePagina(lasHuellas) : null }
      })())
    }
    return hechas.get(p)
  }
  const id = (p) => `p${p + 1}`
  const elegida = (eleccion) => paginas.find((p) => id(p) === eleccion?.diseno) ?? paginas[0]
  const { abrirHojaCompartir } = await import('../compartir-hoja.js')
  return abrirHojaCompartir({
    titulo: 'Compartir la página',
    texto: (eleccion) => textoDePagina({ nombre: c.album.nombre, pagina: elegida(eleccion) + 1, nombres: cartasDe(elegida(eleccion)).filter(Boolean).map(c.nombreDe) }),
    nombre: `pagina-${String(c.album.nombre || 'album').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    historiaPropia: true,
    opciones: paginas.length > 1 ? { disenos: paginas.map((p) => ({ id: id(p), nombre: `Página ${p + 1}` })) } : null,
    imagen: async (formato, eleccion) => {
      const p = elegida(eleccion)
      const { fotos, paleta } = await dibujoDe(p)
      return pintarPagina(document.createElement('canvas'), { fotos, columnas, filas, nombre: c.album.nombre, pagina: p + 1, paleta, formato })
    },
  })
}
