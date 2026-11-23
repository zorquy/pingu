// EL COLOR DE UNA ILUSTRACIÓN (tanda 1418, PINGU con su binder «Por colores»
// delante: «los colores no están casando del todo bien… sácale tú el color a
// las cartas»; eligió lo recomendado de la propuesta «Tus colores, bien»).
//
// Hasta la 1417 el color de una carta era la mayor de sus tres manchas
// (k-medias): el fondo claro ganaba (20 de 113 ilustraciones reales salían
// «gris» o «blanco» estando llenas de color) y la media de una mancha mezclaba
// rojos, marrones y morados en un color que no está en la carta (un Darkrai
// «rojo»). Ahora CADA PÍXEL VOTA por su familia (rojo, naranja… gris), con un
// peso de sitio igual para todos y un poco más si es vivo; salen sus tres
// familias con lo que pesa cada una, sin medias que ensucien. Y tres grupos
// que no son un color: Multicolor (ninguno manda), Oscuras (más de la mitad
// es negro o gris oscuro) y Claras (más de la mitad es blanco o gris claro).
//
// Puro y sin DOM: lo usan el navegador (`armonia.js`, de la foto pequeña) y
// el servidor (la 1419, de la foto grande con sharp). Las cifras salen de la
// prueba con 113 ilustraciones de 151, Evoluciones en Paldea, Brecha
// Paradójica y Chispas Fulgurantes (SCHEMA 1418).

import { rarezaCrudaDeCarta, rarezaEs } from '../rarezas-nombres.js'

// ── Qué entra ──
// Una ilustración: rareza de arte grande (IR, SIR, full art, galerías,
// shiny…). Se mira la rareza canónica en inglés.
const DE_ARTE = /illustration|special art|full art|art rare|character|gallery|shiny|hyper|secret|ultra rare|ace spec|radiant|amazing|super rare|trainer gallery|\bSAR\b|\bAR\b|\bSR\b|\bUR\b|\bCHR\b|\bCSR\b/i
// Y por su nombre en ESPAÑOL (tanda 1417b, PINGU con su Lugia-EX de Plasma
// Storm: «esta no sale, ¿por qué?»). El inglés tiene varias formas para lo
// mismo —«Rare Ultra» en las antiguas y no «Ultra Rare», «Rare Rainbow»—, y
// la regla de arriba solo conocía unas: la Lugia, una full art, pasaba por
// carta normal. `rarezaEs` las junta en una; se miran las dos.
const DE_ARTE_ES = /^Rara (Ultra|Ilustración|Híper|Brillante|Asombrosa|Radiante|Arcoíris|Secreta|ACE SPEC)/
export const esDeArte = (carta) => {
  const cruda = rarezaCrudaDeCarta(carta) || ''
  return DE_ARTE.test(cruda) || DE_ARTE_ES.test(rarezaEs(cruda) || '')
}
// Las energías no entran aunque sean doradas o full art (1418, PINGU: «las
// energías yo no las contaría»): son casi de un color plano y rompían las
// hojas. Sin categoría (alguna japonesa), por el nombre.
export const esEnergia = (carta) => carta?.category === 'Energy' || (!carta?.category && /\b(Energy|Energía)\b/i.test(`${carta?.name || ''} ${carta?.name_en || ''}`))
export const entraEnColores = (carta) => esDeArte(carta) && !esEnergia(carta)

// ── OKLab (donde la distancia entre dos colores se parece a la que ve un ojo) ──
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
export function oklab(r, g, b) {
  r = lin(r); g = lin(g); b = lin(b)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
export function hexDe([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  return '#' + rgb.map((c) => {
    c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055
    return Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0')
  }).join('').toUpperCase()
}
export const tonoDe = (l) => ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360

// ── Las familias ──
export const NEUTROS = ['blanco', 'gris', 'negro']
// Los grupos que no son un color: van al final de la pared y no cuentan para
// «tu color».
export const APARTE = ['multicolor', 'claras', 'oscuras']
// Los grupos de Tus colores en el orden de la pared: la rueda y al final los
// que no son un color. Es también la lista del `check` de `tcg_card_colores`
// (supabase-migration-1419; test-tanda-1419 compara las dos).
export const GRUPOS = ['rojo', 'naranja', 'amarillo', 'verde', 'turquesa', 'celeste', 'azul', 'morado', 'rosa', 'marrón', 'multicolor', 'claras', 'oscuras']
// Como `nombreDeColor` de armonia.js, salvo el ROJO OSCURO: los volcanes y
// los atardeceres (Groudon, los Charizard) caían en «rosa»; rosa es solo el
// rosa claro y el magenta.
export function familiaDe([L, a, b]) {
  const c = Math.hypot(a, b)
  if (c < 0.035) return L > 0.8 ? 'blanco' : L < 0.3 ? 'negro' : 'gris'
  const h = tonoDe([L, a, b])
  if (h < 20 || h >= 345) return L < 0.64 ? 'rojo' : 'rosa'
  if (h < 45) return 'rojo'
  if (h < 110 && L < 0.5) return 'marrón'
  if (h < 75) return 'naranja'
  if (h < 110) return 'amarillo'
  if (h < 165) return 'verde'
  if (h < 210) return 'turquesa'
  if (h < 270) return L > 0.7 ? 'celeste' : 'azul'
  if (h < 310) return 'morado'
  return 'rosa'
}

const r3 = (n) => Math.round(n * 1000) / 1000

// `datos` son píxeles RGBA (los de un lienzo o los de sharp). Se mira la carta
// entera menos un margen fino (el borde de la carta): en una ilustración el
// dibujo la ocupa toda, también detrás del texto.
// Devuelve { color, paleta: [{ f, lab, s }] (sus tres familias, la que más
// pesa primero), luz }.
export function colorDePixeles(datos, ancho, alto) {
  const m = Math.max(1, Math.round(ancho * 0.045))
  const fam = {}
  let total = 0, luz = 0, n = 0
  for (let y = m; y < alto - m; y++) {
    for (let x = m; x < ancho - m; x++) {
      const i = (y * ancho + x) * 4
      const l = oklab(datos[i], datos[i + 1], datos[i + 2])
      const f = familiaDe(l)
      // Cada píxel pesa por su SITIO (0,04) y, si tiene color, también por su
      // viveza: un detalle pequeño muy vivo ya no gana a un fondo grande (con
      // la viveza sola, un ojo rojo pintaba de rojo una carta verde).
      const w = NEUTROS.includes(f) ? 0.04 : 0.04 + Math.hypot(l[1], l[2])
      const g = (fam[f] ||= { w: 0, L: 0, a: 0, b: 0 })
      g.w += w; g.L += l[0] * w; g.a += l[1] * w; g.b += l[2] * w
      total += w; luz += l[0]; n++
    }
  }
  if (!n || !total) return null
  const lista = Object.entries(fam)
    .map(([f, g]) => ({ f, s: g.w / total, lab: [g.L / g.w, g.a / g.w, g.b / g.w] }))
    .sort((p, q) => q.s - p.s)
  return grupoDe(lista, luz / n)
}

// El grupo de una carta a partir de sus familias. Aparte para poder
// recalcularlo de lo guardado sin volver a leer la foto.
export function grupoDe(lista, luz) {
  const vivos = lista.filter((p) => !NEUTROS.includes(p.f))
  const neutro = lista.filter((p) => NEUTROS.includes(p.f)).reduce((s, p) => s + p.s, 0)
  // Más de la mitad sin color: Oscura si es oscura de media (Shiinotic a
  // contraluz, Crustle), Clara si no (Snorunt en la nieve). Antes iban a un
  // color por su único detalle vivo.
  const oscura = neutro > 0.5 && luz < 0.5
  const clara = neutro > 0.5 && !oscura
  // Multicolor: el que más tiene no llega al 30 % y el TERCERO pasa del 15 %
  // (Kangaskhan ex, Daisy's Help). Con dos colores fuertes sigue mandando uno.
  const multi = vivos.length >= 3 && vivos[0].s < 0.3 && vivos[2].s > 0.15
  const color = oscura ? 'oscuras' : multi ? 'multicolor' : clara ? 'claras' : (vivos[0] || lista[0])?.f
  return {
    color,
    paleta: lista.slice(0, 3).map((p) => ({ f: p.f, lab: p.lab.map(r3), s: r3(p.s) })),
    luz: r3(luz),
  }
}

// La muestra de un color (la del más vivo de los suyos) y la de un grupo.
export const hexDeColores = (c) => (c?.paleta?.length ? hexDe((c.paleta.find((p) => !NEUTROS.includes(p.f)) || c.paleta[0]).lab) : '#888888')
export function fondoDeGrupo(color, hex) {
  if (color === 'multicolor') return 'conic-gradient(#e0533d,#f2c21b,#3fae5a,#3a7bd5,#a35cc9,#e0533d)'
  if (color === 'oscuras') return '#2a2f35'
  if (color === 'claras') return '#e9edf0'
  return hex
}

// ── Las HOJAS de nueve que casan ──
// Ordenar en fila por color no hace que una hoja case: dentro de un mismo
// «rojo» hay atardeceres, volcanes y fondos negros. Se monta cada hoja: la
// carta de color más marcado que quede y las 8 con la PALETA más parecida a la
// suya (sus tres colores con su peso, en los dos sentidos). Las hojas van del
// rojo al morado, y al final las de casi sin color, de clara a oscura.
const dt = (a, b) => Math.hypot(0.6 * (a[0] - b[0]), 1.4 * (a[1] - b[1]), 1.4 * (a[2] - b[2]))
const lado = (P, Q) => P.reduce((s, p) => s + p.s * Math.min(...Q.map((q) => dt(p.lab, q.lab))), 0) / (P.reduce((s, p) => s + p.s, 0) || 1)
export const distanciaDePaletas = (P, Q) => (lado(P, Q) + lado(Q, P)) / 2

// `fichas` [{ colores: { paleta } , … }]; devuelve hojas (arrays de fichas).
export function hojasDe(fichas, porHoja = 9) {
  const pal = (x) => x.colores.paleta
  const viveza = (x) => { const p = pal(x)[0]; return Math.hypot(p.lab[1], p.lab[2]) * p.s }
  const resto = fichas.filter((x) => x.colores?.paleta?.length)
  const hojas = []
  while (resto.length) {
    // La semilla: la más marcada. A igualdad, la primera (sale igual cada vez).
    let k = 0
    for (let i = 1; i < resto.length; i++) if (viveza(resto[i]) > viveza(resto[k]) + 1e-9) k = i
    const semilla = resto[k]
    const cerca = resto
      .map((x, i) => ({ x, i, d: x === semilla ? -1 : distanciaDePaletas(pal(semilla), pal(x)) }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .slice(0, porHoja)
    const fuera = new Set(cerca.map((c) => c.i))
    for (let i = resto.length - 1; i >= 0; i--) if (fuera.has(i)) resto.splice(i, 1)
    // Dentro de la hoja, de clara a oscura (luego «Ordenar» la deja seguir la
    // escena).
    hojas.push(cerca.map((c) => c.x).sort((a, b) => pal(b)[0].lab[0] - pal(a)[0].lab[0]))
  }
  const clave = (h) => {
    const p = pal(h[0])[0]
    if (Math.hypot(p.lab[1], p.lab[2]) < 0.05) return 400 + (1 - p.lab[0]) * 100
    // La rueda empieza en el rojo (20°): los rosas del final de la rueda
    // van detrás de los morados.
    return (tonoDe(p.lab) + 340) % 360
  }
  // La hoja a medias, al FINAL aunque su color tocara antes: el álbum mete las
  // cartas de nueve en nueve, y una hoja de 5 en medio correría todas las
  // siguientes de página.
  const llenas = (h) => (h.length < porHoja ? 1 : 0)
  return hojas.sort((a, b) => llenas(a) - llenas(b) || clave(a) - clave(b))
}
