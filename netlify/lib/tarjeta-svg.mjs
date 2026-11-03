// LA TARJETA DEL ENLACE, EN EL SERVIDOR (tanda 1201, PINGU: «cuando
// compartas un evento quiero que se cree una tarjeta… y lo quiero para
// cualquier enlace: que se genere una imagen que tenga que ver con lo que
// compartes»).
//
// WhatsApp, X o Instagram leen la imagen del enlace sin ejecutar JavaScript,
// así que no la puede pintar el navegador como la de una noticia (1157): la
// dibuja la función `tarjeta` con este módulo. Es la «apaisada» del marco de
// redes (js/redes-marco.js) pasada a SVG, con las mismas medidas, colores y
// letras: arriba el logo y una chapa, el título en Outfit con lo destacado
// entre `*asteriscos*`, una línea en Inter, la pieza a la derecha (la carta,
// el logo del evento, el avatar…) y la dirección abajo.
//
// Puro: recibe los datos y las imágenes ya en `data:` y devuelve el SVG. El
// texto se parte con la tabla de anchos de las letras (tarjeta-letras.mjs),
// que es lo que hace el lienzo con `measureText`.
import { ANCHOS } from './tarjeta-letras.mjs'

export const W = 1200
export const H = 630
const MX = 56
const MY = 48
const AZUL_MARCA = '#7cbae4'
const FONDO_ARRIBA = '#1e5175'
const FONDO_MEDIO = '#13324a'
const FONDO_ABAJO = '#0b1219'

// Los acentos de cada sección: los de `ACENTOS` del marco (el --acento de la
// web en oscuro).
export const ACENTOS = {
  inicio: '#7cbae4',
  aprender: '#2fb47c',
  coleccion: '#e4b44a',
  comunidad: '#f06c9b',
  jugar: '#9b7bff',
}

export function xml(s) {
  return String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c])
}

// Lo que mide un texto en una letra y un cuerpo. Un carácter que no está en
// la tabla (un emoji, un kanji) cuenta como una «M» y no se pinta: el
// subconjunto de letras es latino.
export function ancho(texto, letra, cuerpo, espaciado = 0) {
  const tabla = ANCHOS[letra] || ANCHOS['Inter-500']
  let w = 0
  for (const c of String(texto ?? '')) w += (tabla[c] ?? tabla.M ?? 0.8) * cuerpo + espaciado
  return w
}

// Quita lo que las letras no saben pintar (emojis, CJK): mejor un hueco
// limpio que una caja vacía en medio del título.
export function soloPintable(texto) {
  const tabla = ANCHOS['Outfit-800']
  return [...String(texto ?? '')].filter((c) => c === '*' || c in tabla || /\s/.test(c)).join('').replace(/\s+/g, ' ').trim()
}

// Las palabras de un texto con `*marcas*`, sabiendo cuáles van destacadas y
// cuáles van pegadas a la anterior (la puntuación de detrás de lo destacado).
export function palabrasDe(texto) {
  const out = []
  String(texto ?? '').split(/(\*[^*]+\*)/).forEach((trozo) => {
    if (!trozo) return
    const destacado = /^\*[^*]+\*$/.test(trozo)
    const limpio = destacado ? trozo.slice(1, -1) : trozo
    const pegada = out.length > 0 && !/^\s/.test(limpio) && !/\s$/.test(out[out.length - 1].finTrozo || ' ')
    limpio.split(/\s+/).filter(Boolean).forEach((p, i) => out.push({ p, destacado, pegada: i === 0 && pegada }))
    if (out.length) out[out.length - 1].finTrozo = limpio
  })
  return out
}

// Las líneas que caben en `anchoMax`; si son más de `maximo`, la última
// acaba en «…».
export function partir(texto, { letra, cuerpo, anchoMax, maximo }) {
  const espacio = ancho(' ', letra, cuerpo)
  const lineas = []
  let linea = []
  let w = 0
  for (const pal of palabrasDe(texto)) {
    const pw = ancho(pal.p, letra, cuerpo)
    const hueco = pal.pegada ? 0 : espacio
    if (linea.length && !pal.pegada && w + hueco + pw > anchoMax) {
      lineas.push(linea)
      linea = []
      w = 0
    }
    w += (linea.length ? hueco : 0) + pw
    linea.push(linea.length ? pal : { ...pal, pegada: false })
  }
  if (linea.length) lineas.push(linea)
  if (lineas.length <= maximo) return lineas
  const cortadas = lineas.slice(0, maximo)
  const ultima = cortadas[maximo - 1]
  // La última, recortada hasta que quepa con sus puntos suspensivos.
  const mide = (l) => l.reduce((s, x, i) => s + ancho(x.p, letra, cuerpo) + (i && !x.pegada ? espacio : 0), 0)
  while (ultima.length > 1 && mide(ultima) + ancho('…', letra, cuerpo) > anchoMax) ultima.pop()
  ultima.push({ p: '…', destacado: false, pegada: true })
  return cortadas
}

// El título: baja de cuerpo hasta caber en `maximo` líneas (como
// `tituloMarco`). Devuelve el SVG y la y de debajo.
export function titulo(texto, { x, y, anchoMax, cuerpo = 64, minimo = 40, maximo = 3, acento }) {
  let c = cuerpo
  while (c - 4 >= minimo && partir(texto, { letra: 'Outfit-800', cuerpo: c, anchoMax, maximo: 99 }).length > maximo) c -= 4
  const lineas = partir(texto, { letra: 'Outfit-800', cuerpo: c, anchoMax, maximo })
  const paso = Math.round(c * 1.04)
  let yy = y + c
  const filas = lineas.map((l) => {
    const trozos = l.map((pal, i) => `<tspan${pal.destacado ? ` fill="${acento}"` : ''}>${i && !pal.pegada ? ' ' : ''}${xml(pal.p)}</tspan>`).join('')
    const fila = `<text x="${x}" y="${yy}" font-family="Outfit" font-weight="800" font-size="${c}" fill="#ffffff" xml:space="preserve">${trozos}</text>`
    yy += paso
    return fila
  })
  return { svg: filas.join(''), abajo: yy - paso + Math.round(c * 0.3) }
}

// Un párrafo en Inter (la entradilla).
export function parrafo(texto, { x, y, anchoMax, cuerpo = 27, maximo = 3, color = '#cfe3f1' }) {
  if (!texto) return { svg: '', abajo: y }
  const lineas = partir(String(texto).replace(/\*/g, ''), { letra: 'Inter-500', cuerpo, anchoMax, maximo })
  const paso = Math.round(cuerpo * 1.38)
  const svg = lineas.map((l, i) => `<text x="${x}" y="${y + cuerpo + i * paso}" font-family="Inter" font-weight="500" font-size="${cuerpo}" fill="${color}" xml:space="preserve">${xml(l.map((p, j) => (j && !p.pegada ? ' ' : '') + p.p).join(''))}</text>`).join('')
  return { svg, abajo: y + cuerpo + (lineas.length - 1) * paso + Math.round(cuerpo * 0.4) }
}

// Una chapa (píldora) alineada a la derecha en `x`.
export function chapa(texto, { x, y, cuerpo, fondo, color = FONDO_ABAJO, mayusculas = true }) {
  const t = mayusculas ? String(texto).toUpperCase() : String(texto)
  const esp = mayusculas ? Math.round(cuerpo * 0.12) : 0
  const pad = Math.round(cuerpo * 0.95)
  const alto = Math.round(cuerpo * 2.05)
  const w = Math.round(ancho(t, 'Outfit-800', cuerpo, esp) + pad * 2)
  const x0 = x - w
  return {
    w,
    svg: `<rect x="${x0}" y="${y}" width="${w}" height="${alto}" rx="${alto / 2}" fill="${fondo}"/><text x="${x0 + pad}" y="${y + alto / 2 + cuerpo * 0.36}" font-family="Outfit" font-weight="800" font-size="${cuerpo}" letter-spacing="${esp}" fill="${color}">${xml(t)}</text>`,
  }
}

function fondo(acento) {
  const brillo = (id, cx, cy, r, a) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${acento}" stop-opacity="${a}"/><stop offset="1" stop-color="${acento}" stop-opacity="0"/></radialGradient>`
  return {
    defs: `<linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FONDO_ARRIBA}"/><stop offset=".46" stop-color="${FONDO_MEDIO}"/><stop offset="1" stop-color="${FONDO_ABAJO}"/></linearGradient>${brillo('b1', W * 0.12, H * 0.22, 504, 0.28)}${brillo('b2', W * 0.96, H * 0.36, 480, 0.18)}`,
    svg: `<rect width="${W}" height="${H}" fill="url(#fondo)"/><rect width="${W}" height="${H}" fill="url(#b1)"/><rect width="${W}" height="${H}" fill="url(#b2)"/>`,
  }
}

// La cabecera: el logo de la app (o la «P» si no llegó), «PokeDoc» y la
// chapa de lo que es.
function cabecera({ logo, textoChapa, acento }) {
  const lado = 60
  const cuerpo = 40
  const yMedio = MY + lado / 2
  const icono = logo
    ? `<clipPath id="logoClip"><rect x="${MX}" y="${MY}" width="${lado}" height="${lado}" rx="16"/></clipPath><image href="${logo}" x="${MX}" y="${MY}" width="${lado}" height="${lado}" clip-path="url(#logoClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${MX}" y="${MY}" width="${lado}" height="${lado}" rx="16" fill="${AZUL_MARCA}"/><text x="${MX + lado / 2}" y="${MY + lado * 0.76}" text-anchor="middle" font-family="Outfit" font-weight="800" font-size="38" fill="${FONDO_ABAJO}">P</text>`
  const xTexto = MX + lado + 16
  const yTexto = yMedio + cuerpo * 0.36
  const poke = ancho('Poke', 'Outfit-800', cuerpo)
  let svg = `${icono}<text x="${xTexto}" y="${yTexto}" font-family="Outfit" font-weight="800" font-size="${cuerpo}" fill="#ffffff">Poke</text><text x="${xTexto + poke}" y="${yTexto}" font-family="Outfit" font-weight="800" font-size="${cuerpo}" fill="${AZUL_MARCA}">Doc</text>`
  if (textoChapa) {
    const c = 26
    svg += chapa(textoChapa, { x: W - MX, y: MY + (lado - Math.round(c * 2.05)) / 2, cuerpo: c, fondo: acento }).svg
  }
  return { svg, abajo: MY + lado }
}

// La pieza de la derecha, dentro de su caja. Las imágenes llegan ya en
// `data:` con sus medidas (las pone la función tras pasarlas por sharp).
export function pieza(p, caja, acento) {
  if (!p) return ''
  const cx = caja.x + caja.w / 2
  const cy = caja.y + caja.h / 2
  if (p.tipo === 'carta' && p.src) {
    // La carta en su tarjeta blanca, un poco girada (la de `tarjetaGirada`).
    const h = Math.min(caja.h, 440)
    const w = Math.round(h * 5 / 7)
    const x = cx - w / 2
    const y = cy - h / 2
    return `<g transform="rotate(-3 ${cx} ${cy})"><rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="26" fill="#000" opacity=".35" transform="translate(0 14)"/><rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="26" fill="#f8fafc"/><clipPath id="cartaClip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18"/></clipPath><image href="${p.src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cartaClip)"/></g>`
  }
  if (p.tipo === 'avatar') {
    const d = Math.min(caja.w, caja.h, 300)
    const r = d / 2
    const relleno = p.src
      ? `<clipPath id="avClip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image href="${p.src}" x="${cx - r}" y="${cy - r}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avClip)"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.color || acento}"/><text x="${cx}" y="${cy + r * 0.36}" text-anchor="middle" font-family="Outfit" font-weight="800" font-size="${Math.round(r)}" fill="#ffffff">${xml(p.inicial || '?')}</text>`
    return `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="${acento}" opacity=".9"/>${relleno}`
  }
  if (p.tipo === 'logo') {
    // El logo de un evento o de una expansión, entero, en un panel suave
    // del color del evento (o del acento).
    const pw = Math.min(caja.w, 420)
    const ph = Math.min(caja.h, p.cuadrado ? 340 : 260)
    const x = cx - pw / 2
    const y = cy - ph / 2
    const color = p.color || acento
    const dentro = p.src
      ? `<image href="${p.src}" x="${x + 28}" y="${y + 28}" width="${pw - 56}" height="${ph - 56}" preserveAspectRatio="xMidYMid meet"/>`
      : `<text x="${cx}" y="${cy + 30}" text-anchor="middle" font-family="Outfit" font-weight="800" font-size="84" fill="#ffffff">${xml(p.iniciales || '')}</text>`
    return `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="32" fill="${color}" opacity=".22"/><rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="32" fill="none" stroke="${color}" stroke-opacity=".55" stroke-width="2"/>${dentro}`
  }
  if (p.tipo === 'mascota' && p.src) {
    // La mascota de PokeDoc sobre un círculo del acento (las páginas fijas).
    const r = Math.min(caja.w, caja.h) / 2 - 8
    const lado = Math.round(r * 1.7)
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${acento}" opacity=".2"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${acento}" stroke-opacity=".5" stroke-width="2"/><image href="${p.src}" x="${cx - lado / 2}" y="${cy - lado / 2}" width="${lado}" height="${lado}" preserveAspectRatio="xMidYMid meet"/>`
  }
  if (p.tipo === 'portada' && p.src) {
    const w = Math.min(caja.w, 440)
    const h = Math.round(w * 0.62)
    const x = cx - w / 2
    const y = cy - h / 2
    return `<g transform="rotate(-2 ${cx} ${cy})"><rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" rx="26" fill="#f8fafc"/><clipPath id="porClip"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18"/></clipPath><image href="${p.src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#porClip)"/></g>`
  }
  if (p.tipo === 'cifras' && p.cifras?.length) {
    // Hasta tres cifras grandes, una debajo de otra (un torneo, un tema).
    const filas = p.cifras.slice(0, 3)
    const alto = 116
    let y = cy - (filas.length * alto) / 2
    return filas.map((f) => {
      const s = `<rect x="${caja.x + 40}" y="${y}" width="${caja.w - 40}" height="${alto - 16}" rx="24" fill="#ffffff" opacity=".07"/><text x="${caja.x + 72}" y="${y + 66}" font-family="Outfit" font-weight="800" font-size="56" fill="${acento}">${xml(soloPintable(f.n))}</text><text x="${caja.x + 72 + ancho(soloPintable(f.n), 'Outfit-800', 56) + 18}" y="${y + 62}" font-family="Inter" font-weight="500" font-size="24" fill="#cfe3f1">${xml(soloPintable(f.t))}</text>`
      y += alto
      return s
    }).join('')
  }
  return ''
}

// La tarjeta entera. `d`: { seccion, chapa, titulo, entradilla, enlace,
// linea, pieza, logo }.
export function svgDeTarjeta(d) {
  const acento = ACENTOS[d.seccion] || ACENTOS.inicio
  const f = fondo(acento)
  const cab = cabecera({ logo: d.logo, textoChapa: d.chapa, acento })
  const conPieza = Boolean(d.pieza && (d.pieza.src || d.pieza.tipo === 'avatar' || (d.pieza.tipo === 'cifras' && d.pieza.cifras?.length) || d.pieza.tipo === 'logo'))
  const anchoTexto = conPieza ? 610 : W - MX * 2
  const t = titulo(soloPintable(d.titulo || 'PokeDoc'), { x: MX, y: cab.abajo + 36, anchoMax: anchoTexto, acento })
  const e = parrafo(soloPintable(d.entradilla), { x: MX, y: t.abajo + 6, anchoMax: anchoTexto, maximo: 2 })
  // El pie: la dirección y su línea, abajo a la izquierda.
  const abajo = H - MY
  const cLinea = 21
  const yEnlace = d.linea ? abajo - cLinea - 8 : abajo
  const pie = `<text x="${MX}" y="${yEnlace}" font-family="Outfit" font-weight="800" font-size="30" fill="#ffffff">${xml(soloPintable(d.enlace || 'pokedoc.es'))}</text>${d.linea ? `<text x="${MX}" y="${abajo}" font-family="Inter" font-weight="500" font-size="${cLinea}" fill="#9fb3bd">${xml(soloPintable(d.linea))}</text>` : ''}`
  const caja = { x: MX + anchoTexto + 40, y: cab.abajo + 28, w: W - MX - (MX + anchoTexto + 40), h: abajo - (cab.abajo + 28) }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${f.defs}</defs>${f.svg}${cab.svg}${t.svg}${e.svg}${conPieza ? pieza(d.pieza, caja, acento) : ''}${pie}</svg>`
}
