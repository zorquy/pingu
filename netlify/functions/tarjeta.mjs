// La tarjeta del enlace de cualquier página (tanda 1201, PINGU: «cuando
// compartas un evento quiero que se cree una tarjeta, pero es que además lo
// quiero hacer para cualquier enlace… que se genere una imagen que tenga que
// ver con lo que compartes de la web»).
//
// /tarjeta/<la ruta de la página>.png?<sus parámetros>&v=<huella>
//   /tarjeta/eventos/castellon-card-show.png?v=…
//   /tarjeta/torneo.png?slug=liga-fdn&v=…
//
// Qué se dibuja no lo decide esta función: lo calcula `meta-social.js` (el
// mismo que pone las etiquetas de la página) en `meta.tarjeta`, desde la
// misma dirección. Así la tarjeta y el título del enlace no se separan nunca.
// Aquí solo se traen las imágenes (pasadas por sharp, que resvg no lee WebP),
// se pinta el SVG de `tarjeta-svg.mjs` y se convierte en PNG con resvg.
//
// Lo que no tenga tarjeta (una página sin datos, un error, una imagen que no
// llega a tiempo) devuelve la tarjeta de siempre: nunca un enlace sin foto.
import { writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { metaDeRuta } from '../edge-functions/meta-social.js'
import { svgDeTarjeta } from '../lib/tarjeta-svg.mjs'
import * as LETRAS from '../lib/tarjeta-letras.mjs'
import { TARJETAS_FIJAS } from '../lib/tarjetas-fijas.mjs'

const SITIO = 'https://pokedoc.es'
const POR_DEFECTO = `${SITIO}/assets/images/og-default.png`
const LOGO = `${SITIO}/assets/icon-192.png`
const MASCOTA = `${SITIO}/assets/images/mascota.webp`
const ESPERA_IMAGEN_MS = 4000
const TOPE_IMAGEN = 8 * 1024 * 1024

// La ruta de la página a partir de la dirección de la tarjeta. Solo letras,
// números, guiones y barras: no es un proxy de nada.
export function paginaDeTarjeta(urlTarjeta) {
  const u = new URL(urlTarjeta, SITIO)
  let ruta = u.pathname
  const q = new URLSearchParams(u.search)
  if (ruta.startsWith('/.netlify/functions/')) ruta = q.get('p') || ''
  else ruta = ruta.replace(/^\/tarjeta/, '')
  ruta = ruta.replace(/\.png$/, '')
  q.delete('p')
  q.delete('v')
  if (!/^\/[a-z0-9/_-]{1,200}$/i.test(ruta) || ruta.includes('//')) return null
  const resto = q.toString()
  return new URL(`${ruta}${resto ? `?${resto}` : ''}`, SITIO)
}

// Las letras van en ficheros: resvg-js no hace caso de `fontBuffers` en Node
// (se salta TODAS las opciones de letra y pinta con las del sistema, que en
// Netlify son ninguna). Se escriben una vez por contenedor.
let letras = null
function ficherosDeLetras() {
  if (letras) return letras
  letras = ['Outfit_800', 'Outfit_700', 'Inter_500', 'Inter_700'].filter((k) => LETRAS[k]).map((k) => {
    const f = join(tmpdir(), `pokedoc-${k}-${LETRAS[k].length}.ttf`)
    if (!existsSync(f)) writeFileSync(f, Buffer.from(LETRAS[k], 'base64'))
    return f
  })
  return letras
}

// Una imagen de fuera como `data:` PNG, a la medida que se va a pintar. Si
// no llega o no es una imagen, null (y la pieza se pinta sin ella).
export async function imagenComoDato(url, { fetchImpl = fetch, sharp, lado = 640, cuadrada = false } = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(ESPERA_IMAGEN_MS), headers: { 'user-agent': 'PokeDoc-tarjeta' } })
    if (!res.ok) return null
    const tipo = res.headers.get('content-type') || ''
    if (tipo && !/^image\//.test(tipo)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.length || buf.length > TOPE_IMAGEN) return null
    const png = await sharp(buf, { animated: false })
      .resize({ width: lado, height: lado, fit: cuadrada ? 'cover' : 'inside', withoutEnlargement: !cuadrada })
      .png()
      .toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

const LADO_DE = { carta: 640, avatar: 400, logo: 720, portada: 900, mascota: 520 }

// Lo que dibuja una dirección: la de una página fija sale de su tabla; la de
// una página con datos, de `meta.tarjeta`.
async function tarjetaDe(pagina, meta) {
  const fija = pagina.pathname.match(/^\/fija\/([a-z-]+)$/)
  if (fija) return TARJETAS_FIJAS[fija[1]] || null
  return (await meta(pagina))?.tarjeta || null
}

// El trabajo, con todo lo de fuera inyectable para probarlo sin red.
export async function dibujarTarjeta(urlTarjeta, { meta = metaDeRuta, fetchImpl = fetch, sharp, render } = {}) {
  const pagina = paginaDeTarjeta(urlTarjeta)
  if (!pagina) return null
  const t = await tarjetaDe(pagina, meta)
  if (!t) return null
  const p = t.pieza ? { ...t.pieza } : null
  if (p?.tipo === 'mascota') p.src = MASCOTA
  const [src, logo] = await Promise.all([
    p?.src ? imagenComoDato(p.src, { fetchImpl, sharp, lado: LADO_DE[p.tipo] || 640, cuadrada: p.tipo === 'avatar' }) : null,
    imagenComoDato(LOGO, { fetchImpl, sharp, lado: 120, cuadrada: true }),
  ])
  if (p) p.src = src
  const svg = svgDeTarjeta({ ...t, pieza: p, logo })
  return render(svg)
}

export async function pintarPng(svg) {
  const { Resvg } = await import('@resvg/resvg-js')
  return new Resvg(svg, {
    font: { fontFiles: ficherosDeLetras(), loadSystemFonts: false, defaultFontFamily: 'Inter' },
    imageRendering: 0,
  }).render().asPng()
}

export default async function handler(req) {
  let png = null
  try {
    const sharp = (await import('sharp')).default
    png = await dibujarTarjeta(req.url, { sharp, render: pintarPng })
  } catch (e) {
    console.warn('tarjeta:', e?.message || e)
  }
  if (!png) {
    return new Response(null, { status: 302, headers: { location: POR_DEFECTO, 'cache-control': 'public, max-age=300' } })
  }
  return new Response(png, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      // La dirección lleva la huella de lo que se dibuja (`v`): si cambia
      // algo, cambia la dirección. Por eso se puede guardar mucho.
      'cache-control': 'public, max-age=86400',
      'netlify-cdn-cache-control': 'public, s-maxage=2592000, durable',
    },
  })
}
