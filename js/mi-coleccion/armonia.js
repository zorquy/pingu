// LA ARMONÍA DE UNA PÁGINA (tanda 1407, PINGU con el post de EyeRis: «¿se
// podría implementar algo así?»). Cuentas con los colores de cada
// ilustración, sin IA y sin servidor:
//   · la HUELLA de una carta: sus 3 colores (k-medias en OKLab, que es donde
//     la distancia entre dos colores se parece a la que ve un ojo), cuánto
//     de viva es (croma), cuánto de clara, y el color con que la escena SALE
//     por cada borde;
//   · COLOR: sus colores están en la página y es igual de viva/apagada;
//   · ESCENA: el borde que toca a cada vecina sigue el de la vecina (el cielo
//     de una carta continúa en la de al lado);
//   · ORDENAR: la colocación de las cartas de una página en la que más sigue
//     la escena (todas las permutaciones hasta 9; más, por intercambios).
// Hacia dónde MIRA el Pokémon (las flechas a mano de EyeRis) no se calcula:
// sin IA de imágenes saldría al azar, y una sugerencia al azar engaña.
//
// Este fichero no toca el DOM salvo `huellaDeImagen` (un lienzo) y la caché;
// lo demás es puro y lo prueba test-tanda-1407.mjs con huellas de verdad.
import { cadenaDeEscaneo } from '../escaneo-carta.js'
import { oklab, hexDe, colorDePixeles } from './color-de-carta.js'

// ── Color ──
// OKLab y el hexadecimal viven en `color-de-carta.js` (la 1418 los necesita
// también en el servidor); se importan arriba para usarlos aquí y se
// reexportan para quien ya los pedía a este fichero.
export { oklab, hexDe }
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
// Para comparar COLORES el tono pesa más que la luz: un azul claro y uno
// oscuro «van» en una página azul; un azul y un naranja igual de claros, no.
const dt = (a, b) => Math.hypot(0.6 * (a[0] - b[0]), 1.4 * (a[1] - b[1]), 1.4 * (a[2] - b[2]))

// k-medias con pesos; las semillas, por luz (oscuro, medio, claro), para que
// salga lo mismo cada vez.
function kMedias(puntos, k = 3, vueltas = 12, dist = d3) {
  if (!puntos.length) return []
  const ord = [...puntos].sort((a, b) => a.l[0] - b.l[0])
  let c = Array.from({ length: k }, (_, j) => [...ord[Math.floor(((j + 0.5) / k) * (ord.length - 1))].l])
  let g = []
  for (let v = 0; v < vueltas; v++) {
    g = c.map(() => ({ s: [0, 0, 0], w: 0 }))
    for (const p of puntos) {
      let mj = 0, md = Infinity
      c.forEach((q, j) => { const dd = dist(p.l, q); if (dd < md) { md = dd; mj = j } })
      g[mj].w += p.w
      for (let t = 0; t < 3; t++) g[mj].s[t] += p.w * p.l[t]
    }
    c = g.map((x, j) => (x.w ? x.s.map((s) => s / x.w) : c[j]))
  }
  const tot = g.reduce((s, x) => s + x.w, 0) || 1
  return c.map((l, j) => ({ l, w: g[j].w / tot })).sort((a, b) => b.w - a.w)
}

// ── La huella de una ilustración ──
// `datos` son los píxeles RGBA de la carta a 64×90. La ventana es casi toda
// la carta (en una ilustración rara el dibujo la ocupa): fuera el marco y,
// abajo, la franja del texto, desde el 82 %.
export const ANCHO = 64
export const ALTO = 90
export function huellaDePixeles(datos, ancho = ANCHO, alto = ALTO) {
  const x0 = 4, x1 = ancho - 4, y0 = 5, y1 = Math.round(alto * 0.82)
  const px = []
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * ancho + x) * 4
      px.push({ l: oklab(datos[i], datos[i + 1], datos[i + 2]), w: 1, x, y })
    }
  }
  const grupos = kMedias(px, 3)
  const croma = px.reduce((s, p) => s + Math.hypot(p.l[1], p.l[2]), 0) / px.length
  const luz = px.reduce((s, p) => s + p.l[0], 0) / px.length
  const fx = (x1 - x0) * 0.18, fy = (y1 - y0) * 0.18
  const media = (f) => {
    const g = px.filter(f)
    return [0, 1, 2].map((t) => g.reduce((s, p) => s + p.l[t], 0) / g.length)
  }
  return redondear({
    labs: grupos.map((g) => g.l),
    pesos: grupos.map((g) => g.w),
    croma,
    luz,
    bordes: { izq: media((p) => p.x < x0 + fx), der: media((p) => p.x >= x1 - fx), arr: media((p) => p.y < y0 + fy), aba: media((p) => p.y >= y1 - fy) },
    // El color de la carta para Tus colores (1418): el voto por píxel, de
    // la carta entera y no de la ventana de arriba.
    colores: colorDePixeles(datos, ancho, alto),
  })
}
// Tres decimales bastan (una diferencia de 0,001 en OKLab no se ve) y la
// caché del navegador cabe diez veces más.
const r3 = (n) => Math.round(n * 1000) / 1000
function redondear(h) {
  return {
    labs: h.labs.map((l) => l.map(r3)),
    pesos: h.pesos.map(r3),
    croma: r3(h.croma),
    luz: r3(h.luz),
    bordes: Object.fromEntries(Object.entries(h.bordes).map(([k, v]) => [k, v.map(r3)])),
    ...(h.colores ? { colores: h.colores } : {}),
  }
}

// ── Los 3 colores de una PÁGINA ──
export function paletaDePagina(huellas) {
  const pts = huellas.filter(Boolean).flatMap((h) => h.labs.map((l, i) => ({ l, w: h.pesos[i] })))
  const g = kMedias(pts, 3, 15, dt)
  return { labs: g.map((x) => x.l), pesos: g.map((x) => x.w), hex: g.map((x) => hexDe(x.l)) }
}
const chamfer = (A, B) => A.labs.reduce((s, l, i) => s + A.pesos[i] * Math.min(...B.labs.map((m) => dt(l, m))), 0)

// COLOR, de 0 a 100: sus colores en los de la página y los de la página en
// los suyos (los dos sentidos: una carta casi blanca «cabe» en cualquier
// página si solo se mira uno), y la viveza y la luz parecidas.
export function notaDeColor(h, huellasDePagina) {
  const pag = huellasDePagina.filter(Boolean)
  if (!h || !pag.length) return 0
  const P = paletaDePagina(pag)
  const dist = 0.5 * chamfer(h, P) + 0.5 * chamfer(P, h)
  const croma = pag.reduce((s, p) => s + p.croma, 0) / pag.length
  const luz = pag.reduce((s, p) => s + p.luz, 0) / pag.length
  return Math.round(100 * Math.exp(-(dist + 1.5 * Math.abs(h.croma - croma) + 0.4 * Math.abs(h.luz - luz)) / 0.13))
}

// ESCENA, de 0 a 100: el borde que toca a cada vecina contra el de ella.
export const OPUESTO = { izq: 'der', der: 'izq', arr: 'aba', aba: 'arr' }
export function notaDeEscena(h, vecinas) {
  const v = vecinas.filter((x) => x?.huella)
  if (!h || !v.length) return 0
  const ds = v.map(({ lado, huella }) => d3(h.bordes[lado], huella.bordes[OPUESTO[lado]]))
  return Math.round(100 * Math.exp(-(ds.reduce((s, x) => s + x, 0) / ds.length) / 0.16))
}

// Las vecinas de un bolsillo dentro de SU página (por encima de la primera
// fila o al lado de la última columna no hay nada: es otra página).
export function vecinasDe(indice, columnas, porPagina) {
  const base = indice - (indice % porPagina)
  const k = indice - base
  const f = Math.floor(k / columnas), c = k % columnas, filas = porPagina / columnas
  const out = []
  if (c > 0) out.push({ lado: 'izq', indice: indice - 1 })
  if (c < columnas - 1) out.push({ lado: 'der', indice: indice + 1 })
  if (f > 0) out.push({ lado: 'arr', indice: indice - columnas })
  if (f < filas - 1) out.push({ lado: 'aba', indice: indice + columnas })
  return out
}

// ── Cómo se dice ──
// El nombre de un color, para el porqué. Por tono (el ángulo en OKLab) y,
// con poco croma, por luz.
export function nombreDeColor([L, a, b]) {
  const c = Math.hypot(a, b)
  if (c < 0.035) return L > 0.8 ? 'blanco' : L < 0.3 ? 'negro' : 'gris'
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360
  if (L < 0.5 && h >= 40 && h < 100) return 'marrón'
  if (h < 20 || h >= 345) return 'rosa'
  if (h < 45) return 'rojo'
  if (h < 75) return 'naranja'
  if (h < 110) return 'amarillo'
  if (h < 165) return 'verde'
  if (h < 210) return 'turquesa'
  if (h < 270) return L > 0.7 ? 'celeste' : 'azul'
  if (h < 310) return 'morado'
  return 'rosa'
}
const LADO_TEXTO = { izq: 'a la izquierda', der: 'a la derecha', arr: 'hacia arriba', aba: 'hacia abajo' }

// El porqué en una frase: el color suyo que está en la página y hacia qué
// vecina sigue mejor la escena. Sin números (PINGU eligió palabras).
export function porqueDe(h, huellasDePagina, vecinas, { color = true, escena = true } = {}) {
  const partes = []
  const pag = huellasDePagina.filter(Boolean)
  if (color && pag.length) {
    const P = paletaDePagina(pag)
    // Su color que esté en la página; uno con tono antes que un blanco o un
    // gris («su blanco es el de la página» dice poco de una página azul).
    const neutro = (l) => (Math.hypot(l[1], l[2]) < 0.035 ? 0.04 : 0)
    const suyo = h.labs.map((l, i) => ({ l, w: h.pesos[i], d: Math.min(...P.labs.map((m) => dt(l, m))) })).filter((x) => x.w > 0.18).sort((a, b) => a.d + neutro(a.l) - (b.d + neutro(b.l)))[0]
    const croma = pag.reduce((s, p) => s + p.croma, 0) / pag.length
    const viveza = Math.abs(h.croma - croma) < 0.02 ? (croma < 0.055 ? 'tonos suaves, como la página' : 'colores vivos, como la página') : null
    if (suyo && suyo.d < 0.09) {
      partes.push(`su ${nombreDeColor(suyo.l)} es el de la página`)
    }
    if (viveza) partes.push(viveza)
  }
  const v = vecinas.filter((x) => x?.huella)
  if (escena && v.length) {
    const mejor = v.map((x) => ({ ...x, d: d3(h.bordes[x.lado], x.huella.bordes[OPUESTO[x.lado]]) })).sort((a, b) => a.d - b.d)[0]
    if (mejor.d < 0.12) partes.push(mejor.nombre ? `la escena sigue hacia ${mejor.nombre}` : `la escena sigue ${LADO_TEXTO[mejor.lado]}`)
  }
  if (!partes.length) return 'Es la que menos desentona de las tuyas'
  const t = partes.slice(0, 2).join('; ')
  return t[0].toUpperCase() + t.slice(1)
}

// De 1 a 5 puntos: lo que enseña la lista. Los cortes salen de la prueba con
// 61 ilustraciones: lo mejor de una página de agua daba 46-48, y lo que
// desentonaba (un bosque oscuro), 10.
export function puntosDe(nota) {
  return nota >= 44 ? 5 : nota >= 38 ? 4 : nota >= 30 ? 3 : nota >= 20 ? 2 : 1
}

// Las sugerencias para un hueco: `candidatas` [{ id, huella }], ordenadas por
// lo que se pida.
export function sugerir({ candidatas, huellasDePagina, vecinas, modo = 'las-dos' }) {
  return candidatas
    .filter((c) => c.huella)
    .map((c) => {
      const color = notaDeColor(c.huella, huellasDePagina)
      const escena = notaDeEscena(c.huella, vecinas)
      // Sin vecinas, la escena no dice nada: manda el color.
      const nota = modo === 'color' ? color : modo === 'escena' ? (vecinas.some((x) => x?.huella) ? escena : color) : vecinas.some((x) => x?.huella) ? Math.round((color + escena) / 2) : color
      return { ...c, color, escena, nota }
    })
    .sort((a, b) => b.nota - a.nota)
}

// ── Ordenar una página ──
// `huellas` en el orden de los bolsillos de la página (null = hueco, que se
// queda donde está). El coste es lo que NO sigue la escena entre vecinas.
export function costeDePagina(huellas, columnas) {
  let s = 0
  for (let i = 0; i < huellas.length; i++) {
    const a = huellas[i]
    if (!a) continue
    const der = (i % columnas) < columnas - 1 ? huellas[i + 1] : null
    const aba = huellas[i + columnas]
    if (der) s += d3(a.bordes.der, der.bordes.izq)
    if (aba) s += d3(a.bordes.aba, aba.bordes.arr)
  }
  return s
}
function* permutaciones(a, n = a.length) {
  if (n <= 1) { yield a; return }
  for (let i = 0; i < n; i++) {
    yield* permutaciones(a, n - 1)
    const j = n % 2 ? 0 : i
    ;[a[n - 1], a[j]] = [a[j], a[n - 1]]
  }
}
// Devuelve el nuevo orden de los índices DENTRO de la página: `orden[k]` es
// qué bolsillo de antes va al bolsillo k. Con 9 cartas o menos se prueban
// todas (362.880: medio segundo); con más, intercambios mientras mejore,
// desde varias salidas.
export function ordenarPagina(huellas, columnas) {
  const llenos = huellas.map((h, i) => (h ? i : -1)).filter((i) => i >= 0)
  const colocar = (perm) => {
    const r = huellas.map(() => null)
    const orden = huellas.map((_, i) => i)
    llenos.forEach((sitio, k) => { r[sitio] = huellas[perm[k]]; orden[sitio] = perm[k] })
    return { r, orden }
  }
  const coste = (perm) => costeDePagina(colocar(perm).r, columnas)
  let mejor = [...llenos], mc = coste(mejor)
  const antes = mc
  if (llenos.length <= 9) {
    for (const p of permutaciones([...llenos])) {
      const c = coste(p)
      if (c < mc - 1e-9) { mc = c; mejor = [...p] }
    }
  } else {
    let semilla = 7
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647)
    for (let salida = 0; salida < 6; salida++) {
      const p = [...llenos]
      if (salida) for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [p[i], p[j]] = [p[j], p[i]] }
      let c = coste(p), mejora = true
      while (mejora) {
        mejora = false
        for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
          ;[p[i], p[j]] = [p[j], p[i]]
          const cc = coste(p)
          if (cc < c - 1e-9) { c = cc; mejora = true } else [p[i], p[j]] = [p[j], p[i]]
        }
      }
      if (c < mc) { mc = c; mejor = [...p] }
    }
  }
  return { orden: colocar(mejor).orden, antes, despues: mc }
}

// ── La foto y la caché (lo único que toca el navegador) ──
const CLAVE = 'pd-armonia-v1'
let memoria = null
function cache() {
  if (memoria) return memoria
  try { memoria = JSON.parse(localStorage.getItem(CLAVE) || '{}') } catch { memoria = {} }
  return memoria
}
let guardarPronto = 0
function guardarCache() {
  clearTimeout(guardarPronto)
  guardarPronto = setTimeout(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(memoria || {})) } catch { /* sin sitio o sin memoria: se recalcula */ }
  }, 400)
}
export const huellaGuardada = (id) => cache()[id] || null

// Solo se leen los píxeles de una foto que lo PERMITE (TCGdex manda
// `Access-Control-Allow-Origin: *`); las demás ensucian el lienzo y se
// saltan. `null` si no se ha podido.
export function huellaDeImagen(src) {
  return new Promise((ok) => {
    if (!src) return ok(null)
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.decoding = 'async'
    const fin = setTimeout(() => ok(null), 8000)
    im.onload = () => {
      clearTimeout(fin)
      try {
        const lienzo = document.createElement('canvas')
        lienzo.width = ANCHO
        lienzo.height = ALTO
        const c = lienzo.getContext('2d', { willReadFrequently: true })
        c.drawImage(im, 0, 0, ANCHO, ALTO)
        ok(huellaDePixeles(c.getImageData(0, 0, ANCHO, ALTO).data))
      } catch {
        ok(null)
      }
    }
    im.onerror = () => { clearTimeout(fin); ok(null) }
    im.src = src
  })
}

// Las fotos de una carta, en el orden en que se prueban para leer su color
// (tanda 1417, PINGU: «¿por qué solamente reconoce 30 cartas?»). Antes se
// probaba UNA, la de TCGdex: si TCGdex no la tenía (las expansiones recién
// salidas, las cartas que trae TCGGO), la carta SE VEÍA —la <img> recorre
// su cadena— pero su color no se leía y desaparecía de Tus colores, de
// Sugerir y de Ordenar sin decir cuál. Ahora va la que pide quien llama y
// detrás el resto de la cadena, con las que dejan leer sus píxeles delante
// (TCGdex y pokemontcg.io mandan `Access-Control-Allow-Origin: *`); las
// demás se prueban igual, por si un día lo mandan. Pura.
const DEJAN_LEER = /^https:\/\/(assets\.tcgdex\.net|images\.pokemontcg\.io)\//
export function fotosParaLeer(carta, primera = null, cadena = null) {
  const todas = [primera, ...(cadena || (carta ? cadenaDeEscaneo(carta, null, 'low') : []))].filter(Boolean)
  const unicas = [...new Set(todas)]
  return [...unicas.filter((u) => u === primera || DEJAN_LEER.test(u)), ...unicas.filter((u) => u !== primera && !DEJAN_LEER.test(u))].slice(0, 5)
}

// La primera huella que se pueda sacar de una lista de fotos.
async function huellaDeAlguna(fotos) {
  for (const src of fotos) {
    const h = await huellaDeImagen(src)
    if (h) return h
  }
  return null
}

// Las huellas de muchas cartas, de ocho en ocho, con lo guardado primero.
// `fotoDe(carta)` da la dirección; `alAvanzar(hechas, total)` para la barra.
// `conColores` (Tus colores, 1418): una huella guardada antes de la 1418 no
// trae `colores` y se vuelve a leer (una vez; luego queda guardada).
export async function huellasDe(cartas, fotoDe, { alAvanzar = null, aLaVez = 8, conColores = false } = {}) {
  const c = cache()
  const out = new Map()
  const faltan = []
  for (const carta of cartas) {
    if (c[carta.id] && (!conColores || c[carta.id].colores)) out.set(carta.id, c[carta.id])
    else faltan.push(carta)
  }
  let hechas = cartas.length - faltan.length
  alAvanzar?.(hechas, cartas.length)
  let i = 0
  const trabajador = async () => {
    while (i < faltan.length) {
      const carta = faltan[i++]
      const h = await huellaDeAlguna(fotosParaLeer(carta, fotoDe(carta)))
      if (h) { c[carta.id] = h; out.set(carta.id, h) }
      alAvanzar?.(++hechas, cartas.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(aLaVez, faltan.length) }, trabajador))
  if (faltan.length) guardarCache()
  return out
}
