// Tanda 286: una imagen AVIF o WebP se convierte AL SUBIRLA.
//
// El fallo, del 2026-09-11: PINGU puso una portada copiada de una web
// moderna. Era un AVIF —se ve igual en pantalla, así que no hay manera de
// saberlo— y al mandarla a Telegram salió «IMAGE_PROCESS_FAILED». AVIF y
// WebP son imágenes válidas dentro del navegador y poco más: Telegram no
// las toma como foto, y varios rastreadores de vista previa tampoco.
//
// Esto tiene que pasar en un navegador DE VERDAD: la conversión usa
// createImageBitmap y un canvas, que es lo único capaz de descodificar un
// AVIF sin meter una librería.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 140) : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()
const page = await browser.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
await page.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)

// Un fichero de imagen de verdad, pintado y codificado por el navegador.
await page.evaluate(() => {
  window.hacerImagen = async (tipo, { alfa = false, ancho = 300, alto = 200 } = {}) => {
    const l = document.createElement('canvas')
    l.width = ancho
    l.height = alto
    const p = l.getContext('2d')
    if (!alfa) {
      p.fillStyle = '#2b6cb0'
      p.fillRect(0, 0, ancho, alto)
    } else {
      // Medio lienzo sin pintar: eso es transparencia de verdad.
      p.fillStyle = '#2b6cb0'
      p.fillRect(0, 0, Math.floor(ancho / 2), alto)
    }
    const blob = await new Promise((r) => l.toBlob(r, tipo, 0.92))
    return new File([blob], `pegada.${tipo.split('/')[1]}`, { type: tipo })
  }
})

console.log('\n── 1. Qué formatos hay que convertir ──')
{
  const r = await page.evaluate(async () => {
    const { hayQueConvertir } = await import('/js/app.js')
    return {
      avif: hayQueConvertir('image/avif'),
      webp: hayQueConvertir('image/webp'),
      heic: hayQueConvertir('image/heic'),
      // En mayúsculas, que es como lo manda algún sistema.
      mayus: hayQueConvertir('IMAGE/AVIF'),
      jpeg: hayQueConvertir('image/jpeg'),
      png: hayQueConvertir('image/png'),
      gif: hayQueConvertir('image/gif'),
      nada: hayQueConvertir(''),
    }
  })
  check('AVIF sí', r.avif)
  check('WebP sí', r.webp)
  check('HEIC (el del iPhone) sí', r.heic)
  check('y da igual cómo venga escrito', r.mayus)
  // Los que Telegram y todo el mundo aceptan NO se tocan: convertirlos
  // solo los empeoraría (un JPEG recodificado pierde calidad).
  check('un JPEG no se toca', !r.jpeg)
  check('un PNG tampoco', !r.png)
  check('ni un GIF', !r.gif)
  check('y sin tipo, no se inventa nada', !r.nada)
}

console.log('\n── 2. Un WebP opaco sale JPEG ──')
{
  const r = await page.evaluate(async () => {
    const { convertirImagenRara } = await import('/js/app.js')
    const original = await window.hacerImagen('image/webp')
    const salida = await convertirImagenRara(original)
    // Que la imagen siga siendo la misma imagen, no un cuadro en blanco.
    const bmp = await createImageBitmap(salida)
    return { antes: original.type, tipo: salida.type, nombre: salida.name, bytes: salida.size, ancho: bmp.width, alto: bmp.height }
  })
  check('la de partida era un WebP', r.antes === 'image/webp', r.antes)
  check('sale como JPEG', r.tipo === 'image/jpeg', r.tipo)
  check('y con nombre de JPEG', /\.jpg$/.test(r.nombre), r.nombre)
  check('conserva el tamaño de la imagen', r.ancho === 300 && r.alto === 200, `${r.ancho}×${r.alto}`)
  check('y pesa algo (no es un fichero vacío)', r.bytes > 200, String(r.bytes))
}

console.log('\n── 3. Con transparencia sale PNG, no JPEG ──')
{
  // Equivocarse aquí le pone fondo negro a un logo, así que ante la duda
  // se tira a PNG.
  const r = await page.evaluate(async () => {
    const { convertirImagenRara } = await import('/js/app.js')
    const salida = await convertirImagenRara(await window.hacerImagen('image/webp', { alfa: true }))
    return { tipo: salida.type, nombre: salida.name }
  })
  check('sale como PNG', r.tipo === 'image/png', r.tipo)
  check('y con nombre de PNG', /\.png$/.test(r.nombre), r.nombre)
}

console.log('\n── 4. Lo que no hay que tocar, no se toca ──')
{
  const r = await page.evaluate(async () => {
    const { convertirImagenRara } = await import('/js/app.js')
    const png = await window.hacerImagen('image/png')
    const salida = await convertirImagenRara(png)
    return { mismo: salida === png, tipo: salida.type }
  })
  check('un PNG vuelve siendo el MISMO fichero', r.mismo && r.tipo === 'image/png')
}

console.log('\n── 5. Una conversión que falla no puede impedir subir ──')
{
  // Lo peor que podría hacer esto es tragarse la imagen de alguien porque
  // el navegador no supo descodificarla. Mejor subirla tal cual.
  const r = await page.evaluate(async () => {
    const { convertirImagenRara } = await import('/js/app.js')
    const roto = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'roto.avif', { type: 'image/avif' })
    const salida = await convertirImagenRara(roto)
    return { mismo: salida === roto, tipo: salida.type }
  })
  check('un AVIF que no se puede leer se sube tal cual', r.mismo && r.tipo === 'image/avif')
}

console.log('\n── 6. La subida usa el fichero convertido ──')
{
  const fs = await import('node:fs')
  const app = fs.readFileSync('/home/user/pingu/js/app.js', 'utf8')
  // El orden importa: si la extensión se sacara ANTES de convertir, la
  // imagen se guardaría como .avif siendo un JPEG — que es el fallo de la
  // tanda 281 otra vez, por la puerta de al lado.
  const i = app.indexOf('file = await convertirImagenRara(file)')
  const j = app.indexOf('const ext = extensionDeImagen(file)')
  check('se convierte antes de sacar la extensión', i > 0 && j > i, `${i}/${j}`)
  const r = await page.evaluate(async () => {
    const { extensionDeImagen, convertirImagenRara } = await import('/js/app.js')
    return extensionDeImagen(await convertirImagenRara(await window.hacerImagen('image/webp')))
  })
  check('y la extensión que sale es jpg', r === 'jpg', r)
}

console.log('\n── 7. Si el navegador no consigue codificar, tampoco se pierde ──')
{
  // `toBlob` puede devolver null (sin memoria, un tamaño imposible). Sin
  // la red de abajo se subiría un fichero con la palabra «null» dentro:
  // una portada rota que además parece que se ha subido bien.
  const r = await page.evaluate(async () => {
    const { convertirImagenRara } = await import('/js/app.js')
    const original = await window.hacerImagen('image/webp')
    const bueno = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (cb) { cb(null) }
    try {
      const salida = await convertirImagenRara(original)
      return { mismo: salida === original, tipo: salida.type, bytes: salida.size }
    } finally {
      HTMLCanvasElement.prototype.toBlob = bueno
    }
  })
  check('vuelve el fichero original, no uno vacío', r.mismo, JSON.stringify(r))
}

check('sin errores de página', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
