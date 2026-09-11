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

// ── Datos estructurados (schema.org) ──
//
// Lo mismo que el Open Graph pero para BUSCADORES en vez de para redes
// sociales: le dice a Google que esto es un artículo, de qué fecha, de quién
// y dónde está dentro del sitio. Es lo que hace que una guía pueda salir con
// su título, su fecha y sus migas de pan en los resultados, en vez de como
// una URL suelta.
//
// Va aquí, en el servidor, y no en el JavaScript de la página: el robot que
// indexa lee el HTML que sale del servidor.
//
// El `<` se escapa a \u003c en TODO el JSON. Es la única forma de que un
// título que contenga "</script>" no cierre la etiqueta y se convierta en
// HTML dentro de la página.
export function bloqueDatos(datos) {
  if (!datos) return ''
  const json = JSON.stringify(datos).replace(/</g, '\\u003c')
  return `  <script type="application/ld+json">${json}<\/script>`
}

// Las migas de pan: Inicio › Categoría › esto. Google las enseña debajo del
// título del resultado en vez de la dirección en crudo.
export function migas(pasos) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: pasos.map((paso, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: paso.nombre,
      item: paso.url,
    })),
  }
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
    `<meta name="twitter:image" content="${e(meta.imagen)}" />`
  )
  const salida = lineas.map((l) => `  ${l}`).join('\n')
  const datos = bloqueDatos(meta.datos)
  return `${salida}${datos ? `\n${datos}` : ''}\n  <!-- meta-social:fin -->`
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
  if (marcadores.test(salida)) salida = salida.replace(marcadores, bloque)
  // Si algún día una página se queda sin marcadores, se añade igualmente
  // en vez de servirla sin nada.
  else salida = salida.replace(/<\/head>/i, `${bloque}\n</head>`)

  return inyectarCuerpo(salida, meta.cuerpo)
}

// El texto del artículo, dentro del <article> que hoy llega vacío.
//
// Se sustituye SOLO entre marcadores: no se toca ninguna otra parte del
// documento, y una página sin marcadores sale exactamente como venía.
// Nada de esto puede tumbar el sitio — es la regla de este fichero.
export function inyectarCuerpo(html, cuerpo) {
  if (!cuerpo) return html
  const marcadores = /<!-- articulo:inicio -->[\s\S]*?<!-- articulo:fin -->/
  if (!marcadores.test(html)) return html
  return html.replace(marcadores, `<!-- articulo:inicio -->${cuerpo}<!-- articulo:fin -->`)
}

// ════════════════════════════════════════════════════════════════════
// El CUERPO del artículo, servido desde el servidor (tanda 270)
// ════════════════════════════════════════════════════════════════════
//
// EL PROBLEMA. `guia.html` llega vacío: el texto lo pinta js/guia.js en
// el navegador, después de preguntarle a Supabase. Google ejecuta
// JavaScript, sí, pero lo mete en una SEGUNDA COLA que puede tardar de
// horas a días. Para una guía eterna da igual. Para una noticia, donde
// toda la ventaja es llegar el primero en español, es la diferencia
// entre existir y no existir.
//
// Y no solo Google: cualquier robot que no ejecuta JS —muchos
// buscadores pequeños, agregadores, lectores de accesibilidad, la vista
// «sin conexión» de algunos navegadores— veía una página en blanco.
//
// LA SOLUCIÓN. Esta función ya se descarga el artículo para hacer las
// etiquetas sociales. Pintar además el texto dentro del <article> es el
// MISMO viaje: no cuesta ni una consulta más.
//
// Lo que se inyecta lo pisa js/guia.js en cuanto carga, con la versión
// completa (índice, botones, valoraciones). O sea que a una persona esto
// no le cambia nada... salvo que ve el texto ANTES, que también está
// bien.

// Qué se deja pasar. Es la misma lista que usa el saneador del editor al
// GUARDAR (js/richtext-format.js), o sea que esto no recorta nada de lo
// que se puede escribir: es una segunda vuelta sobre algo ya limpio.
const ETIQUETAS_BUENAS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
  'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'blockquote',
  'span', 'div', 'figure', 'figcaption', 'details', 'summary',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'code', 'pre',
])

// Lo que se tira ENTERO, con su contenido dentro. `script` y `style` son
// los obvios; los demás son las formas de meter algo que se ejecuta o que
// carga de fuera.
const ETIQUETAS_MALAS = /<(script|style|iframe|object|embed|svg|math|form|template|noscript|link|meta|base)\b[\s\S]*?(?:<\/\1\s*>|$)/gi

// El repaso del servidor.
//
// Lo que llega ya pasó por DOMPurify al guardarse, con una lista blanca
// que NO incluye script ni los manejadores de eventos: por construcción
// está limpio. Esto es la segunda cerradura, y hace falta porque aquí no
// hay DOMPurify —esto corre en el borde, sin navegador— y porque un
// <img onerror> inyectado se ejecutaría al PARSEAR la página, antes de
// que el JavaScript de la guía tuviera tiempo de sustituirlo.
//
// Es a propósito una lista blanca y no una lista de cosas prohibidas: lo
// que no se reconoce, fuera.
export function limpiarParaElServidor(html) {
  let limpio = String(html ?? '')
    // Los comentarios pueden esconder etiquetas a medio cerrar.
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(ETIQUETAS_MALAS, '')

  limpio = limpio.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g, (entera, etiqueta, atributos) => {
    const nombre = etiqueta.toLowerCase()
    if (!ETIQUETAS_BUENAS.has(nombre)) return ''
    if (entera.startsWith('</')) return `</${nombre}>`

    // Los atributos, uno a uno y con lista blanca. Aquí es donde se caen
    // los `onerror`, `onload` y compañía: no están en la lista.
    const buenos = []
    const re = /([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
    let m
    while ((m = re.exec(atributos)) !== null) {
      const clave = m[1].toLowerCase()
      const valor = m[3] ?? m[4] ?? m[5] ?? ''
      if (!['href', 'src', 'alt', 'title', 'class', 'colspan', 'rowspan', 'data-cols', 'open', 'loading', 'decoding'].includes(clave)) continue
      // Una dirección solo puede apuntar a la web o a este sitio. Se cae
      // `javascript:`, y también `data:`, que sirve para colar un
      // documento entero dentro de un enlace.
      if ((clave === 'href' || clave === 'src') && !/^(https?:\/\/|\/|#|mailto:)/i.test(valor.trim())) continue
      buenos.push(`${clave}="${escaparAtributo(valor)}"`)
    }
    return `<${nombre}${buenos.length ? ' ' + buenos.join(' ') : ''}>`
  })

  return limpio
}

// De los bloques guardados al HTML del artículo.
//
// `richtext` es el formato de ahora: un solo bloque con el artículo
// entero. Los demás son de guías escritas con el editor de bloques viejo
// y se siguen pintando — es la misma traducción que hace
// js/block-editor.js en el navegador, para que el robot y la persona
// lean lo mismo.
export function cuerpoDeBloques(bloques) {
  if (!Array.isArray(bloques)) return ''
  const texto = (t) => escaparAtributo(t ?? '').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  return bloques
    .map((b) => {
      switch (b?.type) {
        case 'richtext':
          return limpiarParaElServidor(b.html || '')
        case 'heading':
          return `<h2>${texto(b.text)}</h2>`
        case 'paragraph':
          return `<p>${texto(b.text)}</p>`
        case 'image':
          return b.url && /^(https?:\/\/|\/)/i.test(b.url)
            ? `<img src="${escaparAtributo(b.url)}" alt="${escaparAtributo(b.caption || '')}">`
            : ''
        case 'list':
          return `<ul>${(b.items || []).map((i) => `<li>${texto(i)}</li>`).join('')}</ul>`
        case 'highlight':
          return `<div class="block-highlight">${texto(b.text)}</div>`
        default:
          return ''
      }
    })
    .join('')
}

// Un tope de tamaño. Un artículo enorme haría crecer la respuesta de cada
// visita, y para que un buscador entienda de qué va una página no hace
// falta el texto entero: con los primeros 60 KB va sobrado, y el
// JavaScript pinta el resto en cuanto carga.
const CUERPO_MAXIMO = 60000

export function cuerpoDeArticulo({ titulo, entradilla, bloques }) {
  const dentro = cuerpoDeBloques(bloques)
  if (!dentro) return ''
  // Se corta por el final de una etiqueta, no por donde caiga: partir un
  // `<p class="` por la mitad deja al navegador adivinando.
  let recortado = dentro
  if (dentro.length > CUERPO_MAXIMO) {
    const trozo = dentro.slice(0, CUERPO_MAXIMO)
    const cierre = trozo.lastIndexOf('>')
    recortado = cierre > 0 ? trozo.slice(0, cierre + 1) : trozo
  }
  return (
    `<h1>${escaparAtributo(titulo)}</h1>` +
    (entradilla ? `<p class="lead">${escaparAtributo(entradilla)}</p>` : '') +
    recortado
  )
}

// ── Consulta a Supabase ──

// Una consulta que pide una columna que quizá TODAVÍA NO EXISTE.
//
// Las migraciones las ejecuta una persona a mano, después de desplegar.
// Pedir aquí una columna que no está devuelve 400, `pedir` devuelve null
// y la página se queda SIN etiquetas sociales — el sitio entero, no solo
// la noticia. Así que se pide con la columna y, si falla, sin ella.
//
// Cuesta una consulta de más solo en ese hueco, y solo cuando la primera
// falla. Cuando la migración lleve tiempo puesta, esto se quita.
async function pedirConVueltaAtras(rutaNueva, rutaVieja) {
  const conColumna = await pedir(rutaNueva)
  if (conColumna) return conColumna
  return pedir(rutaVieja)
}

async function pedir(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  })
  if (!res.ok) return null
  const filas = await res.json()
  return Array.isArray(filas) && filas.length ? filas[0] : null
}

// Contar sin traerse las filas: PostgREST devuelve el total en la
// cabecera content-range cuando se le pide `count=exact`, y con HEAD no
// viaja ni un byte de cuerpo. Se usa para las plazas ocupadas de un
// torneo, que es un número y no una lista.
async function contar(ruta) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: 'HEAD',
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${SUPABASE_KEY}`,
      prefer: 'count=exact',
    },
    signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
  })
  if (!res.ok) return null
  // La cabecera viene como «0-23/24»; lo que interesa es lo de después
  // de la barra. Un «*» significa que no lo sabe.
  const total = (res.headers.get('content-range') || '').split('/')[1]
  return /^\d+$/.test(total) ? Number(total) : null
}

function urlCanonica(url) {
  // Se reconstruye a partir del dominio bueno: si alguien llega por el
  // subdominio de Netlify, la canónica tiene que seguir apuntando a
  // pokedoc.es.
  return `${SITIO}${url.pathname}${url.search}`
}

async function metaDeGuia(url, esCurso, esNoticia = false) {
  // Una noticia llega por /noticias/<slug>, no por ?slug=. Lo reescribe
  // Netlify a guia.html DESPUÉS de esto, así que aquí la dirección todavía
  // es la que ha pedido el robot.
  const enRuta = url.pathname.match(/^\/noticias\/([^/?#]+)/)
  const slug = enRuta ? decodeURIComponent(enRuta[1]) : url.searchParams.get('slug')
  if (!slug) return null
  // Las columnas que se piden están todas comprobadas: si se cuela una que
  // no existe, PostgREST devuelve 400, `pedir` devuelve null y la página se
  // quedaría SIN etiquetas sociales. Antes de añadir una aquí, hay que
  // verla en la base.
  const base = `guides?slug=eq.${encodeURIComponent(slug)}&published_at=not.is.null&select=`
  const columnas = 'title,description,cover_image,search_content,published_at,author_id,reference_blocks,categories(name,slug)'
  const guia = await pedirConVueltaAtras(
    `${base}${columnas},updated_at&limit=1`,
    `${base}${columnas}&limit=1`
  )
  if (!guia?.title) return null

  const descripcion =
    recortar(guia.description) ||
    recortar(guia.search_content) ||
    (esNoticia ? 'Noticia de Pokémon TCG en español.' : 'Guía de la comunidad de PokeDoc sobre Pokémon TCG.')

  const imagen = urlAbsoluta(guia.cover_image) || IMAGEN_POR_DEFECTO
  // A una noticia se puede llegar por dos direcciones (la limpia y la de
  // guía, desde un enlace viejo o desde la búsqueda). La canónica es
  // SIEMPRE la limpia: si no, Google ve dos páginas con el mismo texto y
  // reparte entre las dos lo que debería ir a una.
  const canonica = esNoticia ? `${SITIO}/noticias/${encodeURIComponent(slug)}` : urlCanonica(url)
  const categoria = guia.categories

  const camino = [{ nombre: 'Inicio', url: `${SITIO}/` }]
  if (esNoticia) {
    camino.push({ nombre: 'Noticias', url: `${SITIO}/noticias` })
  } else if (categoria?.name && categoria?.slug) {
    camino.push({ nombre: categoria.name, url: `${SITIO}/categoria.html?slug=${encodeURIComponent(categoria.slug)}` })
  }
  camino.push({ nombre: guia.title, url: canonica })

  return {
    url: canonica,
    tipo: 'article',
    // El texto del artículo, para que esté en el HTML sin tener que
    // ejecutar JavaScript. En un curso no: ahí el artículo de referencia
    // puede estar bajo llave, y lo que se juega es otra cosa.
    cuerpo: esCurso ? '' : cuerpoDeArticulo({ titulo: guia.title, entradilla: guia.description, bloques: guia.reference_blocks }),
    titulo: esCurso ? `Curso: ${guia.title} — PokeDoc` : `${guia.title} — PokeDoc`,
    descripcion: esCurso ? `Curso interactivo paso a paso. ${descripcion}` : descripcion,
    imagen,
    datos: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          // Un curso es otra cosa que un artículo, y una noticia otra: es
          // `NewsArticle` lo que hace que Google la trate como noticia
          // (fecha visible en el resultado, opción de Google News) y no
          // como una página más que se escribió un día.
          '@type': esCurso ? 'Course' : esNoticia ? 'NewsArticle' : 'Article',
          '@id': canonica,
          mainEntityOfPage: canonica,
          headline: guia.title,
          name: guia.title,
          description: descripcion,
          image: imagen,
          inLanguage: 'es-ES',
          ...(guia.published_at ? { datePublished: guia.published_at } : {}),
          // `dateModified` importa sobre todo en una noticia: una
          // revelación de cartas se corrige y se amplía durante el día, y
          // esto es lo que dice que lo de ahora no es lo de esta mañana.
          // Solo si de verdad se tocó DESPUÉS de publicarla — si no, una
          // fecha de modificación igual a la de publicación es ruido.
          ...(guia.updated_at && guia.updated_at > guia.published_at
            ? { dateModified: guia.updated_at }
            : {}),
          // Sin autor concreto, la guía es de la casa. El autor de verdad se
          // añadiría con otra consulta, y no vale la pena hacer esperar al
          // robot por un campo opcional.
          author: { '@type': 'Organization', name: 'PokeDoc', url: SITIO },
          publisher: { '@type': 'Organization', name: 'PokeDoc', url: SITIO },
          ...(esCurso
            ? {
                provider: { '@type': 'Organization', name: 'PokeDoc', url: SITIO },
                // Google pide decir cómo se imparte; si no, se ignora la ficha.
                hasCourseInstance: {
                  '@type': 'CourseInstance',
                  courseMode: 'online',
                  courseWorkload: 'PT10M',
                },
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', category: 'Free' },
              }
            : {}),
        },
        migas(camino),
      ],
    },
  }
}

async function metaDeCategoria(url) {
  const slug = url.searchParams.get('slug')
  if (!slug) return null
  const cat = await pedir(`categories?slug=eq.${encodeURIComponent(slug)}&select=name,description&limit=1`)
  if (!cat?.name) return null
  const canonica = urlCanonica(url)
  const descripcion = recortar(cat.description) || `Guías y cursos de Pokémon TCG sobre ${cat.name}, en PokeDoc.`
  return {
    url: canonica,
    titulo: `${cat.name} — PokeDoc`,
    descripcion,
    imagen: IMAGEN_POR_DEFECTO,
    datos: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': canonica,
          name: `${cat.name} — PokeDoc`,
          description: descripcion,
          inLanguage: 'es-ES',
          isPartOf: { '@type': 'WebSite', name: 'PokeDoc', url: SITIO },
        },
        migas([
          { nombre: 'Inicio', url: `${SITIO}/` },
          { nombre: 'Aprender', url: `${SITIO}/aprender.html` },
          { nombre: cat.name, url: canonica },
        ]),
      ],
    },
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
  const canonica = `${SITIO}/usuario/${encodeURIComponent(perfil.username)}`
  return {
    url: canonica,
    datos: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      '@id': canonica,
      inLanguage: 'es-ES',
      mainEntity: {
        '@type': 'Person',
        name: visible,
        alternateName: perfil.username,
        url: canonica,
        ...(avatar ? { image: avatar } : {}),
        ...(perfil.bio ? { description: recortar(perfil.bio) } : {}),
      },
    },
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
    // Las etiquetas se sustituyen por un espacio (arriba), así que un
    // «<strong>jugar</strong>.» deja «jugar .». Ese espacio delante del
    // signo se quita aquí, que es lo único que hay que deshacer del
    // apaño: sale en la vista previa de cualquier mensaje con negrita
    // antes de un punto.
    .replace(/ +([,.;:!?%)\]}»…])/g, '$1')
    .replace(/([(\[{«¿¡]) +/g, '$1')
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

  const canonica = `${SITIO}/tema/${encodeURIComponent(id)}`
  return {
    url: canonica,
    tipo: 'article',
    titulo: `${tema.prefix ? `[${tema.prefix}] ` : ''}${tema.title} — Foro de PokeDoc`,
    descripcion,
    imagen: IMAGEN_POR_DEFECTO,
    datos: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          // El tipo propio de un hilo de foro. Google lo distingue de un
          // artículo y lo enseña con el número de respuestas.
          '@type': 'DiscussionForumPosting',
          '@id': canonica,
          mainEntityOfPage: canonica,
          headline: tema.title,
          text: descripcion,
          inLanguage: 'es-ES',
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/ReplyAction',
            userInteractionCount: respuestas,
          },
        },
        migas([
          { nombre: 'Inicio', url: `${SITIO}/` },
          { nombre: 'Foro', url: `${SITIO}/foro.html` },
          { nombre: tema.title, url: canonica },
        ]),
      ],
    },
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

  const canonica = `${SITIO}/foro/${encodeURIComponent(slug)}`
  const descripcion = recortar(foro.description) || `${foro.name}, en el foro de PokeDoc sobre Pokémon TCG.`
  return {
    url: canonica,
    titulo: `${foro.name} — Foro de PokeDoc`,
    descripcion,
    imagen: IMAGEN_POR_DEFECTO,
    datos: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': canonica,
          name: `${foro.name} — Foro de PokeDoc`,
          description: descripcion,
          inLanguage: 'es-ES',
          isPartOf: { '@type': 'WebSite', name: 'PokeDoc', url: SITIO },
        },
        migas([
          { nombre: 'Inicio', url: `${SITIO}/` },
          { nombre: 'Foro', url: `${SITIO}/foro.html` },
          { nombre: foro.name, url: canonica },
        ]),
      ],
    },
  }
}

// ── Torneos ──
//
// OJO CON LO QUE ESTO PUEDE Y NO PUEDE ENSEÑAR: aquí se usa la clave
// publicable, así que lo que devuelva Supabase es exactamente lo que ve
// cualquiera sin sesión. Mientras los torneos estén cerrados por la RLS
// de solo-admins, la consulta vuelve VACÍA y la página se sirve sin
// personalizar — que es justo lo que queremos hasta el lanzamiento.
// No hay que acordarse de quitar nada el día que se abra: se enciende
// solo cuando la base lo permita.
//
// Y por eso mismo, de la ficha solo se pide lo que es cartel: nombre,
// cuándo, estructura y cuántas plazas quedan. Ni un nombre de inscrito,
// ni un usuario de TCG Live.

// El estado en cristiano. Un borrador ni se anuncia.
const ESTADO_TORNEO = {
  registration_open: 'Inscripciones abiertas',
  registration_closed: 'Inscripciones cerradas',
  in_progress: 'En juego',
  finished: 'Terminado',
  cancelled: 'Cancelado',
}

// «sáb, 6 sept · 18:00». En hora de Madrid a propósito: el robot corre
// en el borde, que puede estar en cualquier parte del mundo, y la hora
// del torneo es la de aquí.
function fechaTorneo(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    })
  } catch {
    return ''
  }
}

// La misma frase que textoFormato() de js/torneos/comun.js. Está
// duplicada a propósito y no importada: esto corre en el borde, sin el
// grafo de módulos de la web. Si allí cambia el vocabulario, aquí
// también.
function formatoTorneo(t) {
  const corte = t.top_cut_size ? ` + top ${t.top_cut_size} BO${t.top_cut_bo ?? 3}` : ''
  const base =
    t.format === 'league'
      ? `liga de ${t.swiss_rounds} jornadas BO${t.swiss_bo ?? 1}`
      : `${t.swiss_rounds} rondas suizas BO${t.swiss_bo ?? 1}`
  return `${base}${corte}`
}

async function metaDeTorneo(url) {
  const slug = url.searchParams.get('slug')
  if (!slug) return null

  const torneo = await pedir(
    `tournaments?slug=eq.${encodeURIComponent(slug)}&status=neq.draft` +
      `&select=id,name,slug,description,start_at,status,format,max_players,` +
      `swiss_rounds,swiss_bo,top_cut_size,top_cut_bo,round_time_minutes&limit=1`
  )
  if (!torneo?.name) return null

  // Las plazas ocupadas van en una segunda petición porque son un
  // recuento de otra tabla. Si falla, la frase se queda sin ellas: una
  // vista previa a medias es mejor que ninguna.
  const ocupadas = await contar(
    `tournament_registrations?tournament_id=eq.${encodeURIComponent(torneo.id)}&status=eq.active&select=id`
  )

  const cuando = fechaTorneo(torneo.start_at)
  // max_players a null es aforo SIN LÍMITE (tanda 228 de IBAI), no «cero
  // plazas»: entonces lo que dice algo es cuánta gente hay ya apuntada.
  const plazas =
    torneo.max_players == null
      ? ocupadas === null
        ? 'sin límite de plazas'
        : `${ocupadas} inscritos · sin límite`
      : ocupadas === null
        ? `${torneo.max_players} plazas`
        : `${ocupadas}/${torneo.max_players} plazas`
  const trozos = [cuando, formatoTorneo(torneo), plazas].filter(Boolean)

  // La descripción que escribió el organizador manda; si no hay, se
  // fabrica una con los datos, que es lo que de verdad hace clicar.
  const suya = recortar(textoDeHtml(torneo.description))
  const descripcion = suya || `${trozos.join(' · ')}. Torneo de Pokémon TCG en PokeDoc.`

  const estado = ESTADO_TORNEO[torneo.status] || ''
  const canonica = `${SITIO}/torneo?slug=${encodeURIComponent(torneo.slug)}`

  return {
    url: canonica,
    tipo: 'article',
    titulo: `${torneo.name}${estado ? ` — ${estado}` : ''} · Torneos de PokeDoc`,
    descripcion,
    imagen: IMAGEN_POR_DEFECTO,
    datos: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Event',
          '@id': canonica,
          name: torneo.name,
          description: descripcion,
          startDate: torneo.start_at || undefined,
          inLanguage: 'es-ES',
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          eventStatus:
            torneo.status === 'cancelled'
              ? 'https://schema.org/EventCancelled'
              : 'https://schema.org/EventScheduled',
          // El torneo se juega en Pokémon TCG Live; el sitio es solo
          // donde se organiza.
          location: { '@type': 'VirtualLocation', url: canonica },
          organizer: { '@type': 'Organization', name: 'PokeDoc', url: SITIO },
          isAccessibleForFree: true,
          maximumAttendeeCapacity: torneo.max_players || undefined,
        },
        migas([
          { nombre: 'Inicio', url: `${SITIO}/` },
          { nombre: 'Torneos', url: `${SITIO}/torneos` },
          { nombre: torneo.name, url: canonica },
        ]),
      ],
    },
  }
}

async function calcularMeta(url) {
  const ruta = url.pathname
  // Antes que /guia: una noticia se sirve DESDE guia.html, pero se pide
  // por /noticias/<slug> y es lo que hay que mirar.
  if (ruta.startsWith('/noticias/')) return metaDeGuia(url, false, true)
  if (ruta.startsWith('/guia')) return metaDeGuia(url, false)
  if (ruta.startsWith('/curso')) return metaDeGuia(url, true)
  if (ruta.startsWith('/categoria')) return metaDeCategoria(url)
  if (ruta.startsWith('/usuario')) return metaDePerfil(url)
  if (ruta.startsWith('/tema')) return metaDeTema(url)
  if (ruta.startsWith('/foro')) return metaDeForo(url)
  // Con cuidado: '/torneos' (la lista) también empieza por '/torneo'.
  if (/^\/torneo(\.html)?$/.test(ruta)) return metaDeTorneo(url)
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
    '/noticias/*',
    '/guia.html',
    '/curso.html',
    '/categoria.html',
    '/usuario.html',
    '/usuario/*',
    '/tema.html',
    '/tema/*',
    '/foro.html',
    '/foro/*',
    '/torneo.html',
    // Y las direcciones SIN .html, que es como las escribe media web
    // (/guia?slug=... sale de las tarjetas de guía) y como las deja Netlify
    // al servir un fichero por su nombre limpio. Faltaban: quien compartía
    // una guía por su dirección limpia enseñaba la vista previa genérica, y
    // Google veía la página sin datos estructurados.
    '/guia',
    '/curso',
    '/categoria',
    '/usuario',
    '/tema',
    '/foro',
    // La ficha de un torneo: /torneo?slug=… es como la enlazan las
    // tarjetas y como se comparte por WhatsApp.
    '/torneo',
  ],
}
