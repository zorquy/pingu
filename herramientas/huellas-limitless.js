// Genera `assets/constructor/huellas.bin`, la base con la que el
// constructor de mazos reconoce las cartas de una IMAGEN de Limitless
// (ver js/constructor/imagen.js).
//
// CÓMO SE USA (hay que hacerlo cada vez que sale una colección):
//   1. Abre https://limitlesstcg.com/cards en Chrome.
//   2. Abre la consola (F12 → Consola), pega ESTE fichero entero y pulsa
//      Intro. Tarda unos minutos: descarga ~4.500 imágenes pequeñas.
//   3. Se descarga `huellas.bin`. Cópialo a `assets/constructor/huellas.bin`
//      y súbelo con el resto (entrada en BITACORA.md, como siempre).
//
// Por qué en la consola de Limitless y no en PokeDoc: la lista de cartas
// y el generador de imágenes de Limitless solo se pueden pedir desde su
// propio dominio (CORS). Las imágenes de su CDN sí se dejan.
//
// Qué cartas entran: todo lo legal en Estándar según Limitless, más las
// colecciones SV que ya rotaron (mucha gente sigue escribiendo «Caramelo
// Raro SVI 191» y la imagen sale con ESE dibujo). Se cambia en CONSULTAS.
//
// Las funciones de cálculo de más abajo son COPIA LITERAL de
// js/constructor/imagen.js: si allí cambia `huella` o `detectar`, hay que
// copiarlas aquí y regenerar, o las huellas no casarán.
(async () => {
  const CONSULTAS = ['format:standard', 'set:SVI,PAL,OBF,MEW,PAR,PAF,TEF,TWM,SFA,SCR,SSP,PRE,JTG,DRI,SVP']
  // Plantillas de contador: ImgGen solo pinta el hexágono hasta 20
  // copias; con más, la carta sale sin número (y el constructor lo marca
  // como dudoso para que se escriba a mano).
  const NUMEROS = 20
  const FW = 16
  const FH = 22

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

  // ── La huella de una carta ──
  // Se recorta un 5 % de cada lado (el borde varía entre escaneos) y se
  // reduce en dos pasos, que da una miniatura más fiel que uno solo.
  function huella(src, sx, sy, sw, sh, fw = 16, fh = 22) {
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

  function compactar(f, fw = 16, fh = 22) {
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
  function detectar(bmp) {
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
    // Un marco CLARO y LISO es un fondo claro de verdad, no una imagen
    // recortada justa: la que exporta PokeDoc es transparente, y hay
    // aplicaciones que la aplanan sobre blanco (tanda 421). Entonces una
    // carta es lo que se APARTA del fondo, hacia arriba o hacia abajo.
    const claro = fondo > 110 && marco.filter((v) => Math.abs(v - fondo) < 12).length >= marco.length * 0.8
    if (fondo > 110 && !claro) {
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
    const esCarta = claro ? (v) => Math.abs(v - fondo) > 45 : (v) => v > T

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
      for (let X = 0; X < W; X++) if (esCarta(L[o + X])) n++
      filas[y] = n
    }
    const bandas = tramos(filas, W * 0.02, H * 0.04)

    let celdas = []
    for (const [y0, y1] of bandas) {
      const bh = y1 - y0 + 1
      const col = new Array(W).fill(0)
      for (let y = y0; y <= y1; y++) {
        const o = y * W
        for (let X = 0; X < W; X++) if (esCarta(L[o + X])) col[X]++
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
    // El tamaño dominante es el que más SUPERFICIE ocupa, no la mediana
    // de las alturas (tanda 421): la franja de la marca de una imagen de
    // PokeDoc se parte en diecisiete «cartas» bajitas, y por número le
    // ganaban a las siete de verdad. En una de Limitless, todas las cartas
    // miden lo mismo y sale lo mismo que antes.
    if (celdas.length) {
      let mh = celdas[0].h
      let mejor = -1
      for (const c of celdas) {
        const area = celdas.filter((o) => Math.abs(o.h - c.h) / c.h < 0.2).reduce((s, o) => s + o.w * o.h, 0)
        if (area > mejor) {
          mejor = area
          mh = c.h
        }
      }
      celdas = celdas.filter((c) => Math.abs(c.h - mh) / mh < 0.2)
    }
    return { W, H, celdas }
  }

  // ── El número de copias (el hexágono rojo) ──
  // La zona del contador, siempre en la misma proporción de la carta.
  const ZONA_CONTADOR = { nw: 138, nh: 192, rx0: 0.28, rx1: 0.72, ry0: 0.68, ry1: 1.0 }

  function parcheContador(bmp, c) {
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
  function plantillaCruda(bmp, c) {
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

  const log = (...a) => console.log('%c[huellas]', 'color:#c8102e;font-weight:bold', ...a)

  // 1. La lista de cartas, página a página (1.000 por página).
  const cartas = new Map()
  for (const q of CONSULTAS) {
    for (let p = 1; p <= 30; p++) {
      const html = await (await fetch(`/cards?q=${encodeURIComponent(q)}&display=list&show=all&page=${p}`)).text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const filas = [...doc.querySelectorAll('table tr[data-hover]')]
      for (const r of filas) {
        const c = [...r.children].map((td) => td.textContent.replace(/\s+/g, ' ').trim())
        if (c.length < 3) continue
        const img = r.dataset.hover.replace(/_[A-Z]{2}_(XS|SM|LG)\.png$/, '_EN_XS.png')
        cartas.set(`${c[0]} ${c[1]}`, { set: c[0], num: c[1], nombre: c[2], img })
      }
      log(q, 'página', p, '→', cartas.size, 'cartas')
      if (filas.length < 1000) break
    }
  }
  const lista = [...cartas.values()]

  // 2. La huella de cada una.
  const flen = FW * FH + 2 * (FW >> 1) * (FH >> 1)
  const huellas = new Uint8Array(lista.length * flen)
  const ok = new Uint8Array(lista.length)
  let i = 0
  let hechas = 0
  const trabajador = async () => {
    while (i < lista.length) {
      const k = i++
      for (let intento = 0; intento < 3 && !ok[k]; intento++) {
        try {
          const r = await fetch(lista[k].img)
          if (!r.ok) throw new Error(r.status)
          const b = await createImageBitmap(await r.blob())
          huellas.set(compactar(huella(b, 0, 0, b.width, b.height, FW, FH), FW, FH), k * flen)
          b.close()
          ok[k] = 1
        } catch {}
      }
      if (++hechas % 200 === 0) log('huellas', hechas, '/', lista.length)
    }
  }
  await Promise.all(Array.from({ length: 16 }, trabajador))
  const buenas = lista.map((c, k) => (ok[k] ? k : -1)).filter((k) => k >= 0)
  log('huellas hechas:', buenas.length, 'de', lista.length, '(las que fallan se quedan fuera)')

  // 3. Las plantillas del contador, con el propio generador de Limitless:
  // veinte cartas por imagen con 1, 2, 3… copias.
  const crudas = []
  for (let base = 0; base < NUMEROS; base += 20) {
    const fd = new FormData()
    fd.append('data', Array.from({ length: 20 }, (_, k) => `${base + k + 1}:SVE-7~int*en`).join(' '))
    fd.append('game', 'PTCG')
    const r = await fetch('/tools/pnggen', { method: 'POST', body: fd })
    if (!r.ok) throw new Error('pnggen HTTP ' + r.status)
    const bmp = await createImageBitmap(await r.blob())
    const det = detectar(bmp)
    if (det.celdas.length !== 20) throw new Error('Plantillas: se esperaban 20 cartas y salen ' + det.celdas.length)
    det.celdas.forEach((c, k) => crudas.push({ n: base + k + 1, ...plantillaCruda(bmp, c) }))
    bmp.close()
  }
  const { bw, bh } = crudas[0]

  // 4. El fichero.
  const cabecera = new TextEncoder().encode(
    JSON.stringify({
      v: 2,
      fw: FW,
      fh: FH,
      largo: flen,
      creado: new Date().toISOString(),
      consultas: CONSULTAS,
      cartas: buenas.map((k) => [lista[k].set, lista[k].num, lista[k].nombre]),
      contador: { ...ZONA_CONTADOR, bw, bh, numeros: crudas.map((t) => t.n), spans: crudas.map((t) => t.spans) },
    })
  )
  const partes = [new TextEncoder().encode('PDH1'), new Uint8Array(new Uint32Array([cabecera.length]).buffer), cabecera]
  for (const k of buenas) partes.push(huellas.subarray(k * flen, (k + 1) * flen))
  for (const t of crudas) partes.push(t.w)
  const blob = new Blob(partes, { type: 'application/octet-stream' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'huellas.bin'
  a.click()
  log('Listo:', buenas.length, 'cartas,', (blob.size / 1024 / 1024).toFixed(1), 'MB. Cópialo a assets/constructor/huellas.bin')
})()
