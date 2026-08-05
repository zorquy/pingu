// Vista previa de los enlaces al compartirlos (Open Graph).
//
// EL PROBLEMA: WhatsApp, Twitter, Discord y Telegram NO ejecutan
// JavaScript. Cuando alguien pega https://pokedoc.es/guia.html?slug=x, su
// robot descarga el HTML tal cual sale del servidor y lee las etiquetas
// del <head>. Como el título y la descripción de una guía los pone
// js/guia.js DESPUÉS, en el navegador, el robot solo veía "Guía —
// PokeDoc" y la descripción genérica: todas las guías del sitio se veían
// exactamente igual al compartirlas.
//
// LA SOLUCIÓN: esta Edge Function se ejecuta en el servidor, antes de
// entregar la página. Pide a Supabase los datos de la guía (o del perfil,
// o de la categoría) y reescribe el bloque de etiquetas sociales del
// <head>. El robot y la persona reciben el mismo documento; la persona
// además ejecuta el JS de siempre, que no cambia.
//
// POR QUÉ AQUÍ Y NO EN UN PASO DE COMPILACIÓN: el sitio es HTML/CSS/JS a
// pelo, sin build. Generar una página por guía obligaría a montar uno y a
// redesplegar cada vez que alguien publica algo. Esto se resuelve en la
// petición y no añade ninguna pieza al proyecto.
//
// REGLA DE ORO: esto NO puede tumbar el sitio. Si Supabase tarda, falla o
// devuelve algo raro, se sirve la página tal cual venía. Peor vista
// previa, nunca página en blanco.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
// La clave publicable, la misma que ya viaja en js/supabase.js y que
// cualquiera puede leer desde el navegador. Aquí solo se leen filas
// públicas, así que no hace falta (ni debe usarse) la clave secreta.
const SUPABASE_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

const SITIO = 'https://pokedoc.es'
const IMAGEN_POR_DEFECTO = `${SITIO}/assets/images/og-default.png`

// Si Supabase no contesta en este tiempo, se sirve la página sin
// personalizar. Un robot de WhatsApp que espera se rinde y no enseña
// nada; una persona que espera se va.
const TIEMPO_MAXIMO_MS = 2500

// ── Utilidades puras (se exportan para poder probarlas sin servidor) ──

export function escaparAtributo(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Las redes cortan las descripciones largas por donde les parece. Mejor
// cortar aquí, y por un espacio, para no dejar una palabra partida.
export function recortar(texto, maximo = 180) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim()
  if (limpio.length <= maximo) return limpio
  const trozo = limpio.slice(0, maximo)
  const espacio = trozo.lastIndexOf(' ')
  return `${(espacio > maximo * 0.6 ? trozo.slice(0, espacio) : trozo).trimEnd()}…`
}

// Una imagen subida a Supabase Storage ya viene con URL absoluta; una
// ruta del propio sitio (/assets/...) hay que completarla, porque las
// redes no resuelven rutas relativas.
export function urlAbsoluta(url) {
  const v = String(url ?? '').trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  return `${SITIO}${v.startsWith('/') ? '' : '/'}${v}`
}

export function bloqueMeta(meta) {
  const e = escaparAtributo
  const cuadrada = meta.imagenCuadrada === true
  const lineas = [
    '<!-- meta-social:inicio -->',
    `<link rel="canonical" href="${e(meta.url)}" />`,
    `<meta property="og:url" content="${e(meta.url)}" />`,
    '<meta property="og:site_name" content="PokeDoc" />',
    `<meta property="og:type" content="${e(meta.tipo || 'website')}" />`,
    '<meta property="og:locale" content="es_ES" />',
    `<meta property="og:title" content="${e(meta.titulo)}" />`,
    `<meta property="og:description" content="${e(meta.descripcion)}" />`,
    `<meta property="og:image" content="${e(meta.imagen)}" />`,
  ]
  // Las medidas solo se declaran cuando se conocen de verdad (la imagen
  // por defecto). Mentir aquí hace que la red reserve un hueco que luego
  // no encaja.
  if (!cuadrada && meta.imagen === IMAGEN_POR_DEFECTO) {
    lineas.push('<meta property="og:image:width" content="1200" />', '<meta property="og:image:height" content="630" />')
  }
  lineas.push(
    `<meta name="twitter:card" content="${cuadrada ? 'summary' : 'summary_large_image'}" />`,
    `<meta name="twitter:title" content="${e(meta.titulo)}" />`,
    `<meta name="twitter:description" content="${e(meta.descripcion)}" />`,
    `<meta name="twitter:image" content="${e(meta.imagen)}" />`,
    '<!-- meta-social:fin -->'
  )
  return lineas.map((l) => `  ${l}`).join('\n')
}

// Sustituye el bloque que ya trae la página. También cambia <title> y la
// meta description "de verdad", que son las que usan Google y la pestaña
// del navegador (js/guia.js sigue poniendo el título después, pero para
// entonces el robot ya se ha ido).
export function inyectarMeta(html, meta) {
  let salida = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escaparAtributo(meta.titulo)}</title>`
  )
  salida = salida.replace(
    /<meta name="description" content="[\s\S]*?"\s*\/?>/i,
    `<meta name="description" content="${escaparAtributo(meta.descripcion)}" />`
  )

  const bloque = bloqueMeta(meta)
  const marcadores = /[ \t]*<!-- meta-social:inicio -->[\s\S]*?<!-- meta-social:fin -->/
  if (marcadores.test(salida)) return salida.replace(marcadores, bloque)
  // Si algún día una página se queda sin marcadores, se añade igualmente
  // en vez de servirla sin nada.
  return salida.replace(/<\/head>/i, `${bloque}\n</head>`)
}

// ── Consulta a Supabase ──

async function pedir(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  })
  if (!res.ok) return null
  const filas = await res.json()
  return Array.isArray(filas) && filas.length ? filas[0] : null
}

function urlCanonica(url) {
  // Se reconstruye a partir del dominio bueno: si alguien llega por el
  // subdominio de Netlify, la canónica tiene que seguir apuntando a
  // pokedoc.es.
  return `${SITIO}${url.pathname}${url.search}`
}

async function metaDeGuia(url, esCurso) {
  const slug = url.searchParams.get('slug')
  if (!slug) return null
  const guia = await pedir(
    `guides?slug=eq.${encodeURIComponent(slug)}&published_at=not.is.null&select=title,description,cover_image,search_content&limit=1`
  )
  if (!guia?.title) return null

  const descripcion =
    recortar(guia.description) ||
    recortar(guia.search_content) ||
    'Guía de la comunidad de PokeDoc sobre Pokémon TCG.'

  return {
    url: urlCanonica(url),
    tipo: 'article',
    titulo: esCurso ? `Curso: ${guia.title} — PokeDoc` : `${guia.title} — PokeDoc`,
    descripcion: esCurso ? `Curso interactivo paso a paso. ${descripcion}` : descripcion,
    imagen: urlAbsoluta(guia.cover_image) || IMAGEN_POR_DEFECTO,
  }
}

async function metaDeCategoria(url) {
  const slug = url.searchParams.get('slug')
  if (!slug) return null
  const cat = await pedir(`categories?slug=eq.${encodeURIComponent(slug)}&select=name,description&limit=1`)
  if (!cat?.name) return null
  return {
    url: urlCanonica(url),
    titulo: `${cat.name} — PokeDoc`,
    descripcion: recortar(cat.description) || `Guías y cursos de Pokémon TCG sobre ${cat.name}, en PokeDoc.`,
    imagen: IMAGEN_POR_DEFECTO,
  }
}

async function metaDePerfil(url) {
  // El nombre puede venir por la URL bonita (/usuario/pepe) o por el
  // parámetro (/usuario.html?u=pepe), según en qué orden aplique Netlify
  // la reescritura. Se aceptan los dos.
  const enRuta = url.pathname.match(/^\/usuario\/([^/?#]+)/)
  const nombre = enRuta ? decodeURIComponent(enRuta[1]) : url.searchParams.get('u')
  if (!nombre) return null
  const perfil = await pedir(
    `user_profiles?username=eq.${encodeURIComponent(nombre)}&select=username,display_name,bio,avatar_url&limit=1`
  )
  if (!perfil?.username) return null

  const visible = perfil.display_name || perfil.username
  const avatar = urlAbsoluta(perfil.avatar_url)
  return {
    url: `${SITIO}/usuario/${encodeURIComponent(perfil.username)}`,
    tipo: 'profile',
    titulo: `${visible} — PokeDoc`,
    descripcion:
      recortar(perfil.bio) || `Perfil de ${visible} en PokeDoc: sus guías, sus logros y su muro.`,
    imagen: avatar || IMAGEN_POR_DEFECTO,
    // Un avatar es cuadrado: pedirle a Twitter una tarjeta panorámica con
    // una foto cuadrada la deja recortada por arriba y por abajo.
    imagenCuadrada: !!avatar,
  }
}

// El cuerpo de un mensaje del foro es HTML. Para una descripción hace
// falta el texto pelado, y con los espacios en su sitio: quitar las
// etiquetas a secas pega la última palabra de un párrafo con la primera
// del siguiente.
export function textoDeHtml(html) {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    // Numéricas (&#233; o &#xE9;): el editor las produce en algunos casos
    // al pegar desde Word. Las nombradas raras se dejan como están; no
    // vale la pena arrastrar una tabla de entidades hasta el borde.
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // El & va el ÚLTIMO: si se resolviera antes, un "&amp;lt;" acabaría
    // convertido en "<" y se colaría una etiqueta que no estaba.
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function metaDeTema(url) {
  const enRuta = url.pathname.match(/^\/tema\/([^/?#]+)/)
  const id = enRuta ? decodeURIComponent(enRuta[1]) : url.searchParams.get('t')
  // Es un uuid: si llega cualquier otra cosa, ni se pregunta.
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null

  // Las dos consultas a la vez: son independientes y así el robot espera
  // una vez y no dos.
  const [tema, primero] = await Promise.all([
    pedir(`forum_threads?id=eq.${encodeURIComponent(id)}&select=title,prefix,post_count&limit=1`),
    pedir(`forum_posts?thread_id=eq.${encodeURIComponent(id)}&order=created_at.asc&select=body_html&limit=1`),
  ])
  if (!tema?.title) return null

  const respuestas = Math.max(0, (tema.post_count || 1) - 1)
  const descripcion =
    recortar(textoDeHtml(primero?.body_html)) ||
    `Un tema del foro de PokeDoc${respuestas ? ` con ${respuestas} ${respuestas === 1 ? 'respuesta' : 'respuestas'}` : ''}.`

  return {
    url: `${SITIO}/tema/${encodeURIComponent(id)}`,
    tipo: 'article',
    titulo: `${tema.prefix ? `[${tema.prefix}] ` : ''}${tema.title} — Foro de PokeDoc`,
    descripcion,
    imagen: IMAGEN_POR_DEFECTO,
  }
}

async function metaDeForo(url) {
  const enRuta = url.pathname.match(/^\/foro\/([^/?#]+)/)
  const slug = enRuta ? decodeURIComponent(enRuta[1]) : url.searchParams.get('f')
  // Sin slug es el índice del foro, que ya trae sus etiquetas escritas a
  // mano en foro.html.
  if (!slug) return null

  const foro = await pedir(
    `forum_boards?slug=eq.${encodeURIComponent(slug)}&is_hidden=is.false&select=name,description&limit=1`
  )
  if (!foro?.name) return null

  return {
    url: `${SITIO}/foro/${encodeURIComponent(slug)}`,
    titulo: `${foro.name} — Foro de PokeDoc`,
    descripcion: recortar(foro.description) || `${foro.name}, en el foro de PokeDoc sobre Pokémon TCG.`,
    imagen: IMAGEN_POR_DEFECTO,
  }
}

async function calcularMeta(url) {
  const ruta = url.pathname
  if (ruta.startsWith('/guia')) return metaDeGuia(url, false)
  if (ruta.startsWith('/curso')) return metaDeGuia(url, true)
  if (ruta.startsWith('/categoria')) return metaDeCategoria(url)
  if (ruta.startsWith('/usuario')) return metaDePerfil(url)
  if (ruta.startsWith('/tema')) return metaDeTema(url)
  if (ruta.startsWith('/foro')) return metaDeForo(url)
  return null
}

export default async (request, context) => {
  const respuesta = await context.next()

  // Solo se toca HTML. Cualquier otra cosa (un 404, una redirección, un
  // recurso) sale intacta.
  const tipo = respuesta.headers.get('content-type') || ''
  if (!respuesta.ok || !tipo.includes('text/html')) return respuesta

  let meta = null
  try {
    meta = await calcularMeta(new URL(request.url))
  } catch (e) {
    // Timeout, red caída, JSON roto... da igual: la página se sirve igual.
    console.warn('meta-social: no se han podido leer los datos', e?.message || e)
  }
  if (!meta) return respuesta

  const html = await respuesta.text()

  // Se copian las cabeceras originales quitando las que hablan del cuerpo
  // que acabamos de cambiar: el HTML ya no mide lo mismo, y anunciar un
  // content-length que no cuadra corta la respuesta a medias.
  const cabeceras = new Headers(respuesta.headers)
  cabeceras.delete('content-length')
  cabeceras.delete('content-encoding')

  return new Response(inyectarMeta(html, meta), { status: respuesta.status, headers: cabeceras })
}

// Se registran tanto las rutas con .html (las que enlaza la web) como la
// URL bonita de los perfiles.
//
// No se declara `cache`, a propósito: por defecto la respuesta no se
// guarda en el borde. Cachearla ahorraría una consulta a Supabase, pero
// dejaría vistas previas viejas rondando después de editar una guía, y
// eso es justo lo que veníamos a arreglar.
export const config = {
  path: [
    '/guia.html',
    '/curso.html',
    '/categoria.html',
    '/usuario.html',
    '/usuario/*',
    '/tema.html',
    '/tema/*',
    '/foro.html',
    '/foro/*',
  ],
}
