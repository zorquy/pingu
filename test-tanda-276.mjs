// Tanda 276: la portada del vídeo de YouTube, servida por nosotros.
//
// PINGU: «prefiero que se vea la portada del vídeo, es más visual».
// Tenía razón — un cuadro azul con un play no dice de qué va el vídeo.
//
// Pero la política de privacidad promete, EN NEGRITA, que mientras no lo
// reproduzcas tu navegador no habla con YouTube. Un <img> apuntando a
// i.ytimg.com convertiría esa frase en mentira: cada visitante le daría
// a Google su IP y la página desde la que mira, sin haber pulsado nada.
//
// Así que la imagen la pide NUESTRO servidor y se sirve desde pokedoc.es.
// Google ve una petición nuestra por vídeo y por caché, no una por
// visitante.
import yt, { traerMiniatura } from '/home/user/pingu/netlify/functions/yt-portada.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 120) : ''}`)
}

const imagenGrande = new Uint8Array(50000).fill(7)
// YouTube devuelve 200 con una imagen gris diminuta cuando no tiene la
// que le pides: se cuela por el `res.ok`, y hay que pillarla por el peso.
const imagenGris = new Uint8Array(1097).fill(0)

const respuesta = (datos, tipo = 'image/jpeg') =>
  new Response(datos, { status: 200, headers: { 'content-type': tipo } })

console.log('\n── 1. Se pide la mejor que haya ──')
{
  const pedidas = []
  const conMaxres = async (url) => {
    pedidas.push(url)
    return respuesta(imagenGrande)
  }
  const r = await traerMiniatura('dQw4w9WgXcQ', { fetchImpl: conMaxres })
  check('primero la de alta resolución', pedidas[0].includes('maxresdefault.jpg'), pedidas[0])
  check('y si está, no se pide más', pedidas.length === 1)
  check('se devuelve la imagen', r?.datos?.byteLength === 50000)
}

console.log('\n── 2. Cuando no hay maxres ──')
{
  // No todos los vídeos la tienen: YouTube devuelve 404. `hqdefault`
  // existe SIEMPRE, así que es la última parada.
  const pedidas = []
  const sinMaxres = async (url) => {
    pedidas.push(url)
    if (url.includes('maxresdefault')) return new Response('', { status: 404 })
    return respuesta(imagenGrande)
  }
  const r = await traerMiniatura('dQw4w9WgXcQ', { fetchImpl: sinMaxres })
  check('se cae a hqdefault', pedidas[1]?.includes('hqdefault.jpg'), pedidas.join(' | '))
  check('y se devuelve', r?.datos?.byteLength === 50000)
}

console.log('\n── 3. La imagen gris de relleno no cuela ──')
{
  const conGris = async (url) => respuesta(url.includes('maxresdefault') ? imagenGris : imagenGrande)
  const r = await traerMiniatura('dQw4w9WgXcQ', { fetchImpl: conGris })
  check('se descarta por el peso y se sigue buscando', r?.datos?.byteLength === 50000)

  const todoGris = async () => respuesta(imagenGris)
  check('si todas son grises, no hay miniatura',
    (await traerMiniatura('dQw4w9WgXcQ', { fetchImpl: todoGris })) === null)
}

console.log('\n── 4. Cuando Google no contesta ──')
{
  const caido = async () => { throw new Error('red caída') }
  check('no lanza, devuelve nada', (await traerMiniatura('dQw4w9WgXcQ', { fetchImpl: caido })) === null)
}

console.log('\n── 5. Servido de verdad ──')
{
  const original = globalThis.fetch
  globalThis.fetch = async () => respuesta(imagenGrande)
  try {
    const r = await yt(new Request('https://pokedoc.es/yt-portada?v=dQw4w9WgXcQ'))
    check('responde la imagen', r.status === 200)
    check('como imagen', (r.headers.get('content-type') || '').startsWith('image/'))
    // Un año: es lo que hace que Google reciba una petición por vídeo en
    // vez de una por visita.
    check('y con caché larga', (r.headers.get('cache-control') || '').includes('max-age=31536000'))
  } finally {
    globalThis.fetch = original
  }

  globalThis.fetch = async () => new Response('', { status: 404 })
  try {
    const r = await yt(new Request('https://pokedoc.es/yt-portada?v=dQw4w9WgXcQ'))
    // 404 y no 500: no es un error nuestro, es que ese vídeo no tiene
    // portada. Y el <img> se esconde solo, dejando la portada de siempre.
    check('sin miniatura, 404 y no 500', r.status === 404)
  } finally {
    globalThis.fetch = original
  }
}

console.log('\n── 6. Esto NO puede ser un proxy abierto ──')
{
  // Lo más importante del fichero. Sin comprobar el identificador,
  // cualquiera podría pedirle a nuestro servidor que se descargue lo que
  // quisiera — de la red interna incluida.
  const original = globalThis.fetch
  const pedidas = []
  globalThis.fetch = async (url) => { pedidas.push(url); return respuesta(imagenGrande) }
  try {
    for (const malo of [
      '../../etc/passwd',
      'http://169.254.169.254/latest/meta-data/',
      'dQw4w9WgXcQ/../../../x',
      'a'.repeat(200),
      'corto',
      '',
      'dQw4w9WgXc?', // once caracteres, pero uno no vale
    ]) {
      const r = await yt(new Request(`https://pokedoc.es/yt-portada?v=${encodeURIComponent(malo)}`))
      check(`se rechaza «${malo.slice(0, 34)}»`, r.status === 400, `status ${r.status}`)
    }
    check('y no se ha pedido NADA a la red', pedidas.length === 0, pedidas.join(' | '))
    const sinV = await yt(new Request('https://pokedoc.es/yt-portada'))
    check('sin identificador, 400', sinV.status === 400)
  } finally {
    globalThis.fetch = original
  }
}

console.log('\n── 7. La política de privacidad dice la verdad ──')
{
  const { readFileSync } = await import('node:fs')
  const politica = readFileSync('/home/user/pingu/privacidad.html', 'utf8')
  const video = readFileSync('/home/user/pingu/js/video-youtube.js', 'utf8')
  // Si algún día alguien mete la miniatura directa de Google, esto salta:
  // la frase de la política dejaría de ser cierta.
  check('la portada NO se pide a i.ytimg.com desde el navegador',
    !/i\.ytimg\.com|img\.youtube\.com/.test(video), 'js/video-youtube.js')
  check('se pide a nuestra propia dirección', video.includes('/yt-portada?v='))
  check('y la política lo cuenta así',
    /tu navegador no habla con YouTube/.test(politica) && /te la servimos nosotros/.test(politica))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
