// Leer un mazo desde una IMAGEN de lista de Limitless (su generador
// ImgGen: las cartas en rejilla sobre fondo oscuro, con el número de
// copias en un hexágono rojo). Es lo que la gente comparte en Twitter y
// en Discord, y hasta ahora había que copiarlo carta a carta.
//
// No hay texto que leer: se RECONOCE cada carta por cómo se ve.
//   1. Se localiza la rejilla de cartas en la imagen (bandas claras sobre
//      el fondo oscuro).
//   2. Cada carta se reduce a una «huella» de 16×22 píxeles y se
//      compara con las huellas de todas las cartas de Estándar (y de las
//      colecciones SV recién rotadas), sacadas de las MISMAS imágenes que
//      usa Limitless para pintar la lista. Gana la más parecida.
//   3. El número del hexágono se lee comparándolo con plantillas de los
//      números 1…20 hechas con el propio generador de Limitless (ImgGen
//      no pinta el hexágono con más de 20).
//
// Las huellas y las plantillas viven en un fichero precalculado
// (`/assets/constructor/huellas.bin`) que se genera con
// `herramientas/huellas-limitless.js` en la consola de limitlesstcg.com
// — desde aquí no se puede: Limitless no deja pedir sus páginas desde
// otro dominio. Hay que regenerarlo cuando sale una colección; mientras
// no, las cartas nuevas simplemente no se reconocen (salen marcadas como
// dudosas y se pueden corregir a mano).
//
// OJO: `huella()`, `compactar()` y `detectar()` tienen que ser IDÉNTICAS
// a las de la herramienta. Si cambias una, cambia la otra y regenera el
// fichero.
//
// Módulo sin importaciones y sin HTML: solo cuentas sobre píxeles.

export const URL_HUELLAS = '/assets/constructor/huellas.bin'

const lienzo = (w, h) => {
  const W = Math.max(1, Math.round(w))
  const H = Math.max(1, Math.round(h))
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(W, H)
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  return c
}
const ctx2d = (c) => c.getContext('2d', { willReadFrequently: true })
const respirar = () => new Promise((r) => setTimeout(r, 0))

// ── El fichero de huellas ──
//
// 'PDH1' · uint32 largo de la cabecera · cabecera JSON · huellas
// (n × `largo` bytes, ver `compactar`) · blancura de cada plantilla de
// contador (numeros × bw×bh bytes).
let cargando = null
export function cargarHuellas() {
  if (!cargando) {
    cargando = fetch(URL_HUELLAS)
      .then((r) => {
        if (!r.ok) throw new Error(`No se ha podido cargar la base de cartas para reconocer imágenes (HTTP ${r.status}).`)
        return r.arrayBuffer()
      })
      .then(leerFichero)
      .catch((e) => {
        cargando = null // que el siguiente intento vuelva a probar
        throw e
      })
  }
  return cargando
}

export function leerFichero(buf) {
  const bytes = new Uint8Array(buf)
  if (String.fromCharCode(...bytes.slice(0, 4)) !== 'PDH1') throw new Error('El fichero de huellas no tiene el formato esperado.')
  const largo = new DataView(buf).getUint32(4, true)
  const cab = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + largo)))
  if (cab.v !== 2) throw new Error('El fichero de huellas es de otra versión: hay que regenerarlo.')
  const flen = cab.largo
  let p = 8 + largo
  const huellas = bytes.subarray(p, p + cab.cartas.length * flen)
  p += cab.cartas.length * flen
  const { bw, bh } = cab.contador
  const crudas = {}
  cab.contador.numeros.forEach((n, k) => {
    crudas[n] = { bw, bh, w: bytes.subarray(p + k * bw * bh, p + (k + 1) * bw * bh), spans: cab.contador.spans[k] }
  })
  return {
    fw: cab.fw,
    fh: cab.fh,
    flen,
    creado: cab.creado,
    cartas: cab.cartas.map(([set, num, nombre]) => ({ set, num: String(num), nombre })),
    huellas,
    contador: cab.contador,
    plantillas: prepararPlantillas(crudas),
  }
}

// ── La huella de una carta ──
//
// `huella` da los píxeles en RGB; `compactar` los pasa a luminancia a
// resolución completa y color a la mitad (como un JPEG, 4:2:0). El ojo —
// y el reconocimiento — distingue las cartas sobre todo por la luz: se
// probó con la misma imagen y las distancias casi no cambian, pero el
// fichero pasa de 5,7 a 2,9 MB.
// Se recorta un 5 % de cada lado (el borde varía entre escaneos) y se
// reduce en dos pasos, que da una miniatura más fiel que uno solo.
export function huella(src, sx, sy, sw, sh, fw = 16, fh = 22) {
  const ix = sw * 0.05
  const iy = sh * 0.04
  sx += ix
  sy += iy
  sw -= 2 * ix
  sh -= 2 * iy
  const m = lienzo(fw * 3, fh * 3)
  const mx = ctx2d(m)
  mx.imageSmoothingQuality = 'high'
  mx.drawImage(src, sx, sy, sw, sh, 0, 0, fw * 3, fh * 3)
  const o = lienzo(fw, fh)
  const ox = ctx2d(o)
  ox.imageSmoothingQuality = 'high'
  ox.drawImage(m, 0, 0, fw, fh)
  const d = ox.getImageData(0, 0, fw, fh).data
  const f = new Uint8Array(fw * fh * 3)
  for (let i = 0, k = 0; i < d.length; i += 4) {
    f[k++] = d[i]
    f[k++] = d[i + 1]
    f[k++] = d[i + 2]
  }
  return f
}

export function compactar(f, fw = 16, fh = 22) {
  const cw = fw >> 1
  const ch = fh >> 1
  const out = new Uint8Array(fw * fh + 2 * cw * ch)
  for (let p = 0; p < fw * fh; p++) {
    out[p] = Math.round(0.299 * f[p * 3] + 0.587 * f[p * 3 + 1] + 0.114 * f[p * 3 + 2])
  }
  for (let by = 0; by < ch; by++) {
    for (let bx = 0; bx < cw; bx++) {
      let cb = 0
      let cr = 0
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const p = (by * 2 + dy) * fw + bx * 2 + dx
          const r = f[p * 3]
          const g = f[p * 3 + 1]
          const b = f[p * 3 + 2]
          cb += 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
          cr += 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
        }
      }
      out[fw * fh + by * cw + bx] = Math.round(cb / 4)
      out[fw * fh + cw * ch + by * cw + bx] = Math.round(cr / 4)
    }
  }
  return out
}

function distancia(a, todas, desde, flen) {
  let s = 0
  for (let i = 0; i < flen; i++) s += Math.abs(a[i] - todas[desde + i])
  return s / flen
}

// ── Dónde están las cartas ──
// Devuelve { W, H, celdas: [{ x, y, w, h }] } en orden de lectura.
export function detectar(bmp) {
  const W = bmp.width
  const H = bmp.height
  const c = lienzo(W, H)
  const x = ctx2d(c)
  x.drawImage(bmp, 0, 0)
  const d = x.getImageData(0, 0, W, H).data
  const L = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const j = i * 4
    L[i] = (299 * d[j] + 587 * d[j + 1] + 114 * d[j + 2]) / 1000
  }

  // El fondo: la mediana del marco exterior (el de ImgGen es oscuro). Si
  // la imagen está recortada muy justa, el percentil 30 de toda ella.
  const marco = []
  const fx = Math.max(2, W * 0.03)
  const fy = Math.max(2, H * 0.03)
  for (let y = 0; y < H; y += 3) for (let X = 0; X < W; X += 3) if (X < fx || X > W - fx || y < fy || y > H - fy) marco.push(L[y * W + X])
  marco.sort((a, b) => a - b)
  let fondo = marco.length ? marco[Math.floor(marco.length / 2)] : 30
  if (fondo > 110) {
    const hist = new Array(256).fill(0)
    let tot = 0
    for (let i = 0; i < W * H; i += 7) {
      hist[L[i]]++
      tot++
    }
    let acc = 0
    for (let v = 0; v < 256; v++) {
      acc += hist[v]
      if (acc > tot * 0.3) {
        fondo = v
        break
      }
    }
  }
  const T = Math.min(200, fondo + 45)

  const tramos = (a, t, minimo) => {
    const r = []
    let s = -1
    for (let i = 0; i <= a.length; i++) {
      const on = i < a.length && a[i] > t
      if (on && s < 0) s = i
      if (!on && s >= 0) {
        if (i - s >= minimo) r.push([s, i - 1])
        s = -1
      }
    }
    return r
  }

  const filas = new Array(H).fill(0)
  for (let y = 0; y < H; y++) {
    let n = 0
    const o = y * W
    for (let X = 0; X < W; X++) if (L[o + X] > T) n++
    filas[y] = n
  }
  const bandas = tramos(filas, W * 0.02, H * 0.04)

  let celdas = []
  for (const [y0, y1] of bandas) {
    const bh = y1 - y0 + 1
    const col = new Array(W).fill(0)
    for (let y = y0; y <= y1; y++) {
      const o = y * W
      for (let X = 0; X < W; X++) if (L[o + X] > T) col[X]++
    }
    // Cartas pegadas: se parte el tramo según el ancho esperado.
    const anchoCarta = bh * 0.72
    const hueco = bh * 0.036
    for (const [x0, x1] of tramos(col, bh * 0.04, bh * 0.25)) {
      const w = x1 - x0 + 1
      const n = Math.max(1, Math.round((w + hueco) / (anchoCarta + hueco)))
      if (n === 1) celdas.push({ x: x0, y: y0, w, h: bh })
      else {
        const cw = (w - (n - 1) * hueco) / n
        for (let k = 0; k < n; k++) celdas.push({ x: x0 + k * (cw + hueco), y: y0, w: cw, h: bh })
      }
    }
  }
  // Fuera lo que no tiene forma de carta o no es del tamaño dominante.
  celdas = celdas.filter((c) => {
    const ar = c.w / c.h
    return ar > 0.6 && ar < 0.86
  })
  if (celdas.length) {
    const hs = celdas.map((c) => c.h).sort((a, b) => a - b)
    const mh = hs[Math.floor(hs.length / 2)]
    celdas = celdas.filter((c) => Math.abs(c.h - mh) / mh < 0.2)
  }
  return { W, H, celdas }
}

// ── El número de copias (el hexágono rojo) ──
// La zona del contador, siempre en la misma proporción de la carta.
export const ZONA_CONTADOR = { nw: 138, nh: 192, rx0: 0.28, rx1: 0.72, ry0: 0.68, ry1: 1.0 }

export function parcheContador(bmp, c) {
  const { nw, nh, rx0, rx1, ry0, ry1 } = ZONA_CONTADOR
  const k = lienzo(nw, nh)
  const x = ctx2d(k)
  x.imageSmoothingQuality = 'high'
  x.drawImage(bmp, c.x, c.y, c.w, c.h, 0, 0, nw, nh)
  const bx = Math.round(nw * rx0)
  const by = Math.round(nh * ry0)
  const bw = Math.round(nw * (rx1 - rx0))
  const bh = Math.round(nh * (ry1 - ry0))
  return { bw, bh, d: x.getImageData(bx, by, bw, bh).data }
}

// La plantilla «cruda» de un número: la blancura de cada píxel y, por
// filas, dónde empieza y acaba el rojo del hexágono (solo se compara lo
// de dentro, para que el fondo de cada carta no cuente).
export function plantillaCruda(bmp, c) {
  const { bw, bh, d } = parcheContador(bmp, c)
  const w = new Uint8Array(bw * bh)
  const spans = []
  for (let i = 0; i < bw * bh; i++) w[i] = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])
  for (let y = 0; y < bh; y++) {
    let a = -1
    let b = -1
    for (let X = 0; X < bw; X++) {
      const i = (y * bw + X) * 4
      const r = d[i]
      const g = d[i + 1]
      const bl = d[i + 2]
      if (r > 120 && r - g > 70 && r - bl > 50) {
        if (a < 0) a = X
        b = X
      }
    }
    spans.push(b - a >= 4 ? [a, b] : null)
  }
  return { bw, bh, w, spans }
}

function prepararPlantillas(crudas) {
  const fuera = []
  for (const [n, t] of Object.entries(crudas)) {
    const xs = []
    const ys = []
    const vs = []
    t.spans.forEach((sp, y) => {
      if (sp) {
        for (let X = sp[0] + 1; X <= sp[1] - 1; X++) {
          xs.push(X)
          ys.push(y)
          vs.push(t.w[y * t.bw + X])
        }
      }
    })
    if (!vs.length) continue
    const media = vs.reduce((a, b) => a + b, 0) / vs.length
    let v = 0
    const centrado = new Float32Array(vs.length)
    vs.forEach((q, i) => {
      centrado[i] = q - media
      v += (q - media) ** 2
    })
    fuera.push({ n: +n, xs: Int16Array.from(xs), ys: Int16Array.from(ys), v: centrado, norma: Math.sqrt(v) || 1 })
  }
  return fuera
}

// Correlación normalizada contra cada plantilla, dejando que el número
// se desplace ±3 píxeles. Devuelve el mejor, su nota y la del segundo
// (si están muy cerca, el número es dudoso).
function leerContador(bmp, c, plantillas) {
  const { bw, bh, d } = parcheContador(bmp, c)
  // ¿Hay hexágono? ImgGen solo lo pinta hasta 20 copias, y una imagen que
  // no sea de ImgGen no lo trae. Sin él, cualquier plantilla «casa» un
  // poco y saldría un número inventado: mejor decir que no se sabe.
  let rojos = 0
  for (let i = 0; i < bw * bh; i++) {
    const r = d[i * 4]
    if (r > 120 && r - d[i * 4 + 1] > 70 && r - d[i * 4 + 2] > 50) rojos++
  }
  // Un hexágono de verdad pone de rojo casi un tercio del recuadro o más (se
  // midió: 1.100–3.000 de 3.721 píxeles); el rojo suelto de la franja de
  // una carta de entrenador se queda en ~300.
  if (rojos < bw * bh * 0.25) return { n: 0, nota: 0, segunda: 0 }
  const q = new Float32Array(bw * bh)
  for (let i = 0; i < bw * bh; i++) q[i] = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2])
  let mejor = { n: 0, s: -2 }
  let segunda = -2
  const buf = new Float32Array(8192)
  for (const t of plantillas) {
    const n = t.v.length
    let mx = -2
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        let suma = 0
        for (let i = 0; i < n; i++) {
          const qx = t.xs[i] + dx
          const qy = t.ys[i] + dy
          const val = qx >= 0 && qx < bw && qy >= 0 && qy < bh ? q[qy * bw + qx] : 0
          buf[i] = val
          suma += val
        }
        const mq = suma / n
        let num = 0
        let den = 0
        for (let i = 0; i < n; i++) {
          const a = buf[i] - mq
          num += a * t.v[i]
          den += a * a
        }
        const ncc = num / (Math.sqrt(den) * t.norma + 1e-6)
        if (ncc > mx) mx = ncc
      }
    }
    if (mx > mejor.s) {
      segunda = mejor.s
      mejor = { n: t.n, s: mx }
    } else if (mx > segunda) segunda = mx
  }
  return { n: mejor.n, nota: mejor.s, segunda }
}

function mejores(f, db, k = 8) {
  const top = []
  for (let i = 0; i < db.cartas.length; i++) {
    const d = distancia(f, db.huellas, i * db.flen, db.flen)
    if (top.length < k || d < top[top.length - 1].d) {
      top.push({ i, d })
      top.sort((a, b) => a.d - b.d)
      if (top.length > k) top.pop()
    }
  }
  return top
}

// ── Todo junto ──
// `fuente` es un Blob/File (o cualquier cosa que acepte
// createImageBitmap). Devuelve una fila por carta encontrada:
//   { recorte (dataURL pequeño para enseñarla), candidatas: [índices en
//     db.cartas, de más a menos parecida y sin nombres repetidos],
//     copias, dudaCarta, dudaCopias }
export async function leerImagen(fuente, db, alProgresar) {
  const bmp = await createImageBitmap(fuente)
  try {
    const { celdas } = detectar(bmp)
    const filas = []
    for (let k = 0; k < celdas.length; k++) {
      const c = celdas[k]
      const f = compactar(huella(bmp, c.x, c.y, c.w, c.h, db.fw, db.fh), db.fw, db.fh)
      const top = mejores(f, db)
      const cnt = db.plantillas.length ? leerContador(bmp, c, db.plantillas) : { n: 1, nota: 0, segunda: 0 }
      const b = top[0]
      // La segunda más parecida CON OTRO NOMBRE: dos impresiones de la
      // misma carta que se parecen no son una duda (valen lo mismo).
      const otra = top.find((x) => db.cartas[x.i].nombre !== db.cartas[b.i].nombre)
      const vistas = new Set()
      const candidatas = []
      for (const x of top) {
        const clave = `${db.cartas[x.i].set} ${db.cartas[x.i].num}`
        if (!vistas.has(clave)) {
          vistas.add(clave)
          candidatas.push(x.i)
        }
      }
      filas.push({
        recorte: await recorte(bmp, c),
        candidatas,
        // Sin número legible se propone 1 y se marca como dudoso.
        copias: Math.max(1, cnt.n || 1),
        dudaCarta: b.d > 20 || (otra ? otra.d - b.d < 3 : false),
        dudaCopias: cnt.nota < 0.6 || cnt.nota - cnt.segunda < 0.02,
      })
      if (k % 4 === 3) {
        alProgresar?.((k + 1) / celdas.length)
        await respirar()
      }
    }
    alProgresar?.(1)
    return filas
  } finally {
    bmp.close?.()
  }
}

// Una miniatura de la carta tal como sale en la imagen, para que se vea
// qué se ha reconocido al lado de lo que se ha leído.
async function recorte(bmp, c) {
  const w = 92
  const h = Math.round((w * c.h) / c.w)
  const k = lienzo(w, h)
  const x = ctx2d(k)
  x.imageSmoothingQuality = 'high'
  x.drawImage(bmp, c.x, c.y, c.w, c.h, 0, 0, w, h)
  if (k.convertToBlob) {
    const blob = await k.convertToBlob({ type: 'image/jpeg', quality: 0.8 })
    return URL.createObjectURL(blob)
  }
  return k.toDataURL('image/jpeg', 0.8)
}
