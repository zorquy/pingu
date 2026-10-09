// Un QR sin dependencias (tanda 794, NU5): modo byte, corrección M, versiones
// 1 a 40 y la máscara de menor penalización, como manda la norma (ISO 18004).
// Aquí no hay npm para el cliente, y para un enlace de perfil basta esto.
// Lo comprueba la prueba 794 contra un codificador de referencia, módulo a
// módulo.

const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
const BLOQUES_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
const BITS_FORMATO_M = 0 // M se escribe 00 en los dos bits de nivel

function modulosDeDatos(ver) {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (ver >= 7) r -= 36
  }
  return r
}
const palabrasDeDatos = (ver) => Math.floor(modulosDeDatos(ver) / 8) - ECC_M[ver] * BLOQUES_M[ver]

// Reed-Solomon sobre GF(256) con el polinomio 0x11D.
function mult(x, y) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}
function divisor(grado) {
  const r = new Array(grado).fill(0)
  r[grado - 1] = 1
  let raiz = 1
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = mult(r[j], raiz)
      if (j + 1 < r.length) r[j] ^= r[j + 1]
    }
    raiz = mult(raiz, 0x02)
  }
  return r
}
function resto(datos, div) {
  const r = new Array(div.length).fill(0)
  for (const b of datos) {
    const f = b ^ r.shift()
    r.push(0)
    div.forEach((c, i) => (r[i] ^= mult(c, f)))
  }
  return r
}

function utf8(texto) {
  return [...new TextEncoder().encode(texto)]
}

function versionPara(n) {
  for (let v = 1; v <= 40; v++) {
    const bits = 4 + (v < 10 ? 8 : 16) + n * 8
    if (bits <= palabrasDeDatos(v) * 8) return v
  }
  throw new Error('El texto no cabe en un QR')
}

function palabras(bytes, ver) {
  const bits = []
  const poner = (valor, n) => { for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1) }
  poner(0b0100, 4)
  poner(bytes.length, ver < 10 ? 8 : 16)
  for (const b of bytes) poner(b, 8)
  const capacidad = palabrasDeDatos(ver) * 8
  poner(0, Math.min(4, capacidad - bits.length))
  poner(0, (8 - (bits.length % 8)) % 8)
  for (let relleno = 0xec; bits.length < capacidad; relleno ^= 0xec ^ 0x11) poner(relleno, 8)
  const datos = []
  for (let i = 0; i < bits.length; i += 8) datos.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))
  // Bloques, su corrección y el entrelazado.
  const nBloques = BLOQUES_M[ver], ecc = ECC_M[ver]
  const total = Math.floor(modulosDeDatos(ver) / 8)
  const cortos = nBloques - (total % nBloques)
  const largoCorto = Math.floor(total / nBloques)
  const div = divisor(ecc)
  const bloques = []
  for (let i = 0, k = 0; i < nBloques; i++) {
    const d = datos.slice(k, k + largoCorto - ecc + (i < cortos ? 0 : 1))
    k += d.length
    const e = resto(d, div)
    if (i < cortos) d.push(0)
    bloques.push(d.concat(e))
  }
  const fuera = []
  for (let i = 0; i < bloques[0].length; i++) {
    bloques.forEach((b, j) => { if (i !== largoCorto - ecc || j >= cortos) fuera.push(b[i]) })
  }
  return fuera
}

export function matrizQR(texto, mascara = null) {
  const bytes = utf8(texto)
  const ver = versionPara(bytes.length)
  const n = ver * 4 + 17
  const m = Array.from({ length: n }, () => new Array(n).fill(false))
  const fijo = Array.from({ length: n }, () => new Array(n).fill(false))
  const pon = (x, y, v) => { m[y][x] = v; fijo[y][x] = true }

  for (let i = 0; i < n; i++) { pon(6, i, i % 2 === 0); pon(i, 6, i % 2 === 0) }
  const buscador = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy
      if (x >= 0 && x < n && y >= 0 && y < n) pon(x, y, d !== 2 && d !== 4)
    }
  }
  buscador(3, 3); buscador(n - 4, 3); buscador(3, n - 4)
  const posiciones = (() => {
    if (ver === 1) return []
    const cuantas = Math.floor(ver / 7) + 2
    const paso = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (cuantas * 2 - 2)) * 2
    const r = [6]
    for (let p = n - 7; r.length < cuantas; p -= paso) r.splice(1, 0, p)
    return r
  })()
  posiciones.forEach((a, i) => posiciones.forEach((b, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === posiciones.length - 1) || (i === posiciones.length - 1 && j === 0)) return
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) pon(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }))
  const formato = (mascara) => {
    const datos = (BITS_FORMATO_M << 3) | mascara
    let r = datos
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
    const bits = ((datos << 10) | r) ^ 0x5412
    const b = (i) => ((bits >>> i) & 1) === 1
    for (let i = 0; i <= 5; i++) pon(8, i, b(i))
    pon(8, 7, b(6)); pon(8, 8, b(7)); pon(7, 8, b(8))
    for (let i = 9; i < 15; i++) pon(14 - i, 8, b(i))
    for (let i = 0; i < 8; i++) pon(n - 1 - i, 8, b(i))
    for (let i = 8; i < 15; i++) pon(8, n - 15 + i, b(i))
    pon(8, n - 8, true)
  }
  formato(0)
  if (ver >= 7) {
    let r = ver
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
    const bits = (ver << 12) | r
    for (let i = 0; i < 18; i++) {
      const v = ((bits >>> i) & 1) === 1, a = n - 11 + (i % 3), b = Math.floor(i / 3)
      pon(a, b, v); pon(b, a, v)
    }
  }
  // Los datos, en zigzag de dos columnas de abajo arriba.
  const datos = palabras(bytes, ver)
  let i = 0
  for (let der = n - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5
    for (let v = 0; v < n; v++) for (let j = 0; j < 2; j++) {
      const x = der - j, sube = ((der + 1) & 2) === 0, y = sube ? n - 1 - v : v
      if (!fijo[y][x] && i < datos.length * 8) { m[y][x] = ((datos[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++ }
    }
  }
  const aplicar = (k) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (fijo[y][x]) continue
      const inv = [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
        ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][k]
      if (inv) m[y][x] = !m[y][x]
    }
  }
  let mejor = mascara ?? 0, menor = Infinity
  for (let k = 0; k < 8 && mascara == null; k++) {
    aplicar(k); formato(k)
    const p = penalizacion(m)
    if (p < menor) { menor = p; mejor = k }
    aplicar(k)
  }
  aplicar(mejor); formato(mejor)
  return m
}

function penalizacion(m) {
  const n = m.length
  let p = 0
  const linea = (get) => {
    for (let a = 0; a < n; a++) {
      let color = null, racha = 0
      const hist = []
      for (let b = 0; b < n; b++) {
        const c = get(a, b)
        if (c === color) { racha++; if (racha === 5) p += 3; else if (racha > 5) p++ }
        else { hist.push(racha); color = c; racha = 1 }
      }
      hist.push(racha)
      // Buscadores falsos: 1:1:3:1:1 con cuatro claros a un lado.
      const fila = Array.from({ length: n }, (_, b) => get(a, b))
      for (let b = 0; b + 7 <= n; b++) {
        const pat = [1, 0, 1, 1, 1, 0, 1].every((v, k) => fila[b + k] === Boolean(v))
        if (!pat) continue
        const antes = b >= 4 && [0, 1, 2, 3].every((k) => !fila[b - 1 - k])
        const despues = b + 11 <= n && [0, 1, 2, 3].every((k) => !fila[b + 7 + k])
        const borde = (b < 4 && [...Array(b)].every((_, k) => !fila[k])) || (b + 11 > n && fila.slice(b + 7).every((v) => !v))
        if (antes || despues || borde) p += 40
      }
    }
  }
  linea((a, b) => m[a][b])
  linea((a, b) => m[b][a])
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = m[y][x]
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3
  }
  const oscuros = m.flat().filter(Boolean).length
  p += Math.floor(Math.abs(oscuros * 20 - n * n * 10) / (n * n)) * 10
  return p
}

// El QR en SVG, con su margen de cuatro módulos.
export function svgQR(texto, { tam = 240, color = '#0d1b2a', fondo = '#ffffff' } = {}) {
  const m = matrizQR(texto)
  const n = m.length + 8
  let d = ''
  m.forEach((fila, y) => fila.forEach((v, x) => { if (v) d += `M${x + 4} ${y + 4}h1v1h-1z` }))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${tam}" height="${tam}" shape-rendering="crispEdges" role="img"><rect width="${n}" height="${n}" fill="${fondo}"/><path d="${d}" fill="${color}"/></svg>`
}
