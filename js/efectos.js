// Los efectos que se notan (tanda 784, bloque 5 de «PokeDoc al detalle»).
// Todos miran «menos movimiento» AQUÍ y en el CSS, y lo que se quita al
// acabar se quita con un temporizador, no con `animationend` (la 313).
const quieto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// MV3 · la carta vuela a tu colección. Una copia pequeña de la foto sale de
// la casilla, describe un arco y entra en el destino (la pestaña «Cartas» de
// la burbuja), que bota. En Android, una vibración de 12 ms.
export function volarCarta(img, destino, { ms = 600 } = {}) {
  if (!img || !destino || quieto() || !img.animate) return false
  const a = img.getBoundingClientRect(), b = destino.getBoundingClientRect()
  if (!a.width || !b.width) return false
  const copia = img.cloneNode()
  copia.removeAttribute('id')
  copia.className = 'vuelo-carta'
  copia.setAttribute('aria-hidden', 'true')
  Object.assign(copia.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` })
  document.body.appendChild(copia)
  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const alto = Math.min(160, Math.abs(dx) / 2 + 60)
  copia.animate([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx / 2}px, ${dy / 2 - alto}px) scale(0.55) rotate(-8deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.15) rotate(-16deg)`, opacity: 0.4 },
  ], { duration: ms, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' })
  setTimeout(() => {
    copia.remove()
    destino.classList.remove('bota')
    void destino.offsetWidth
    destino.classList.add('bota')
    setTimeout(() => destino.classList.remove('bota'), 450)
  }, ms)
  try { navigator.vibrate?.(12) } catch { /* no todos dejan */ }
  return true
}

// MV9 · «La quiero» late una vez y suelta seis chispas. La misma pieza para
// el marcador de una guía; el color lo pone quien la usa (`--chispa`).
export function latir(boton) {
  if (!boton) return false
  boton.classList.remove('latiendo')
  void boton.offsetWidth
  boton.classList.add('latiendo')
  if (!quieto()) {
    // Fijas en el centro del botón y colgadas del `body`: un botón puede ir
    // `absolute` (el guardar de una tarjeta) o no, y así salen igual.
    const r = boton.getBoundingClientRect()
    const color = getComputedStyle(boton).getPropertyValue('--chispa')
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('i')
      c.className = 'chispa'
      c.setAttribute('aria-hidden', 'true')
      c.style.setProperty('--i', String(i))
      if (color) c.style.setProperty('--chispa', color)
      c.style.left = `${r.left + r.width / 2}px`
      c.style.top = `${r.top + r.height / 2}px`
      document.body.appendChild(c)
      setTimeout(() => c.remove(), 700)
    }
  }
  setTimeout(() => boton.classList.remove('latiendo'), 700)
  return true
}

// MV4 · los colores del logo de un set, para el confeti. Se leen pintando el
// logo pequeño en un lienzo; si el servidor del logo no deja leerlo (CORS),
// el lienzo queda «manchado» y se devuelve null: el confeti de siempre.
export async function coloresDeLogo(url, n = 5) {
  if (!url) return null
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const lado = 32
    const lienzo = document.createElement('canvas')
    lienzo.width = lienzo.height = lado
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, lado, lado)
    const { data } = ctx.getImageData(0, 0, lado, lado)
    return coloresDePixeles(data, n)
  } catch {
    return null
  }
}

// Puro: los N colores más repetidos, con los casi transparentes, los casi
// blancos y los casi negros fuera (el fondo y el contorno de un logo).
export function coloresDePixeles(data, n = 5) {
  const cuenta = new Map()
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
    if (a < 128) continue
    const luz = (r + g + b) / 3
    if (luz > 235 || luz < 25) continue
    const clave = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
    const v = cuenta.get(clave) || { n: 0, r: 0, g: 0, b: 0 }
    v.n++; v.r += r; v.g += g; v.b += b
    cuenta.set(clave, v)
  }
  const top = [...cuenta.values()].sort((x, y) => y.n - x.n).slice(0, n)
  if (!top.length) return null
  return top.map((v) => `rgb(${Math.round(v.r / v.n)}, ${Math.round(v.g / v.n)}, ${Math.round(v.b / v.n)})`)
}
