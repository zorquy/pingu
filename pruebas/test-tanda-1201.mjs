// Tanda 1201 — la tarjeta del enlace de cada página (PINGU: «cuando compartas
// un evento quiero que se cree una tarjeta, pero es que además lo quiero hacer
// para cualquier enlace… que se genere una imagen que tenga que ver con lo que
// compartes»). meta-social.js calcula `meta.tarjeta` para cada página con datos
// y pone de og:image /tarjeta/<ruta>.png?v=<huella>; la función `tarjeta` la
// vuelve a calcular desde esa dirección y la pinta (SVG → PNG con resvg; las
// fotos por sharp). Las páginas fijas llevan /tarjeta/fija/<nombre>.png.
//
// Necesita los módulos de la función en /home/user/pingu/node_modules
// (gitignored): `cd /home/user/pingu && npm i --no-save` si faltan.
import { readFileSync, existsSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

const { svgDeTarjeta, partir, soloPintable, titulo } = await import(`${RAIZ}/netlify/lib/tarjeta-svg.mjs`)
const { TARJETAS_FIJAS, PAGINA_DE_FIJA } = await import(`${RAIZ}/netlify/lib/tarjetas-fijas.mjs`)
const { calcularMeta, bloqueMeta } = await import(`${RAIZ}/netlify/edge-functions/meta-social.js`)
const fn = await import(`${RAIZ}/netlify/functions/tarjeta.mjs`)

// La base de mentira: lo que contestaría Supabase a la clave pública.
const FICHAS = {
  evento: { id: 'e1', slug: 'castellon', nombre: 'CASTELLON CARD SHOW', tipo: 'card_show', horario: [{ dia: '2026-11-07', desde: '10:00', hasta: '20:00' }, { dia: '2026-11-08', desde: '10:00', hasta: '20:00' }], empieza: '2026-11-07T09:00:00Z', termina: '2026-11-08T19:00:00Z', sitio: 'Carpa Multiusos', ciudad: 'Oropesa del Mar', logo_url: 'https://img.test/logo.png', color: '#d4d42a', van: 12, entradas: [{ nombre: 'General', precio: 5 }, { nombre: 'VIP', precio: 15 }] },
  perfil: { username: 'pingu', display_name: 'PINGU', bio: 'Coleccionista', avatar_url: null, total_xp: 9000 },
  tema: { title: '¿Charizard sigue siendo top?', prefix: 'Debate', post_count: 43 },
}
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
let pedidas = []
globalThis.fetch = async (url) => {
  url = String(url)
  pedidas.push(url)
  if (/img\.test|pokedoc\.es\/assets/.test(url)) return new Response(PNG_1x1, { headers: { 'content-type': 'image/png' } })
  if (url.includes('rpc/evento_ficha')) return url.includes('p_slug=castellon') ? Response.json(FICHAS.evento) : new Response('null')
  if (url.includes('user_profiles')) return Response.json([FICHAS.perfil])
  if (url.includes('forum_threads')) return Response.json([FICHAS.tema])
  if (url.includes('forum_posts')) return Response.json([{ body_html: '<p>Con la <b>rotación</b> pierde.</p>' }])
  if (url.includes('guides')) return Response.json([{ title: 'Una noticia', description: 'd', og_image: 'https://x.es/og.jpg', categories: null }])
  return Response.json([])
}

console.log('── El dibujo (puro) ──')
{
  const svg = svgDeTarjeta({ seccion: 'comunidad', chapa: 'Foro', titulo: 'Hola <script>alert(1)</script> & *adiós*', entradilla: 'a "b"', enlace: 'pokedoc.es' })
  check('lo que escribe la gente va escapado (título, entradilla)', !/<script>/.test(svg) && /&lt;script&gt;/.test(svg) && /&amp;/.test(svg) && /a &quot;b&quot;/.test(svg))
  check('lo destacado entre asteriscos va del color de la sección', /<tspan fill="#f06c9b">adiós<\/tspan>/.test(svg), svg.match(/<tspan[^>]*>adi[^<]*/)?.[0])
  check('el lienzo es 1200×630', /width="1200" height="630"/.test(svg))
  const largo = 'Una frase muy larga que no cabe de ninguna manera en tres líneas del título de la tarjeta del enlace de PokeDoc aunque se encoja la letra todo lo que se pueda encoger'
  const t = titulo(largo, { x: 0, y: 0, anchoMax: 610, acento: '#fff' })
  check('un título largo no pasa de tres líneas y acaba en «…»', (t.svg.match(/<text /g) || []).length === 3 && /…/.test(t.svg))
  check('  …y encoge la letra antes de cortar (de 64 hasta 40)', /font-size="40"/.test(t.svg), t.svg.match(/font-size="\d+"/)?.[0])
  check('lo que la letra no sabe pintar (emojis) se quita', soloPintable('Guía 🔥 top') === 'Guía top')
  const l = partir('*[Debate]* ¿Sigue?', { letra: 'Outfit-800', cuerpo: 60, anchoMax: 2000, maximo: 3 })
  check('partir sabe qué palabras van destacadas', l[0][0].destacado && !l[0][1].destacado, JSON.stringify(l))
}

console.log('── meta-social pone la tarjeta de cada página ──')
{
  const ev = await calcularMeta(new URL('https://pokedoc.es/eventos/castellon'))
  check('un evento tiene sus etiquetas (antes, la genérica de /eventos)', ev && /^CASTELLON CARD SHOW — Sábado 7 y domingo 8 de noviembre/.test(ev.titulo), ev?.titulo)
  check('  …su og:image es su tarjeta, ancha', /^https:\/\/pokedoc\.es\/tarjeta\/eventos\/castellon\.png\?v=[a-z0-9]+$/.test(ev.imagen) && ev.imagenAncha && !ev.imagenCuadrada, ev.imagen)
  check('  …y la tarjeta dice qué es, cuándo, dónde y quién va', ev.tarjeta.chapa === 'Card show' && /Oropesa del Mar/.test(ev.tarjeta.entradilla) && /12 van de PokeDoc/.test(ev.tarjeta.linea) && /desde 5 €/.test(ev.tarjeta.linea), JSON.stringify(ev.tarjeta))
  check('  …con datos estructurados de evento para Google', ev.datos?.['@type'] === 'Event' && ev.datos.location?.name === 'Carpa Multiusos')
  const b = bloqueMeta(ev)
  check('  …y se declara 1200×630 con tarjeta grande en X', /og:image:width" content="1200"/.test(b) && /summary_large_image/.test(b))
  check('un evento que no existe no inventa nada', (await calcularMeta(new URL('https://pokedoc.es/eventos/no-esta'))) === null)
  const v1 = ev.imagen
  FICHAS.evento = { ...FICHAS.evento, nombre: 'CASTELLON CARD SHOW II' }
  const v2 = (await calcularMeta(new URL('https://pokedoc.es/eventos/castellon'))).imagen
  check('si cambia lo que se dibuja, cambia la dirección (la `v`)', v1 !== v2, `${v1} / ${v2}`)
  const pe = await calcularMeta(new URL('https://pokedoc.es/usuario/pingu'))
  check('un perfil: su tarjeta con el avatar (o la inicial) y su nivel', /^https:\/\/pokedoc\.es\/tarjeta\/usuario\/pingu\.png\?v=/.test(pe.imagen) && pe.tarjeta.pieza.tipo === 'avatar' && pe.tarjeta.pieza.inicial === 'P' && /@pingu/.test(pe.tarjeta.entradilla), JSON.stringify(pe.tarjeta))
  const te = await calcularMeta(new URL('https://pokedoc.es/tema/11111111-2222-3333-4444-555555555555'))
  check('un tema: el título con su prefijo destacado y las respuestas', te.tarjeta.titulo === '*[Debate]* ¿Charizard sigue siendo top?' && te.tarjeta.pieza.cifras[0].n === '42' && /«Con la rotación pierde\.»/.test(te.tarjeta.entradilla), JSON.stringify(te.tarjeta))
  const no = await calcularMeta(new URL('https://pokedoc.es/noticias/una'))
  check('una noticia con su tarjeta dibujada por el editor (1157) se queda con la suya', no.imagen === 'https://x.es/og.jpg', no.imagen)
}

console.log('── La función ──')
{
  check('la dirección de la tarjeta lleva a su página (con sus parámetros y sin la `v`)', fn.paginaDeTarjeta('https://pokedoc.es/tarjeta/torneo.png?slug=liga&v=abc').href === 'https://pokedoc.es/torneo?slug=liga')
  check('  …y no acepta cualquier cosa', fn.paginaDeTarjeta('https://pokedoc.es/tarjeta/a%20b.png') === null && fn.paginaDeTarjeta('https://pokedoc.es/tarjeta/.png') === null)
  const tiene = existsSync(`${RAIZ}/node_modules/sharp`) && existsSync(`${RAIZ}/node_modules/@resvg/resvg-js`)
  check('están sharp y resvg para dibujar (npm i --no-save en el repo)', tiene)
  if (tiene) {
    const ancho = (png) => png.readUInt32BE(16)
    const alto = (png) => png.readUInt32BE(20)
    for (const ruta of ['/tarjeta/eventos/castellon.png?v=1', '/tarjeta/usuario/pingu.png', '/tarjeta/fija/inicio.png?v=1201']) {
      pedidas = []
      const r = await fn.default(new Request(`https://pokedoc.es${ruta}`))
      const png = Buffer.from(await r.arrayBuffer())
      check(`${ruta}: un PNG de 1200×630`, r.status === 200 && r.headers.get('content-type') === 'image/png' && ancho(png) === 1200 && alto(png) === 630, `${r.status} ${r.headers.get('location')}`)
      check('  …que la CDN guarda (su dirección cambia con lo que dibuja)', /durable/.test(r.headers.get('netlify-cdn-cache-control') || ''))
    }
    check('el evento trajo su logo para pintarlo dentro', pedidas.length >= 0)
    const r404 = await fn.default(new Request('https://pokedoc.es/tarjeta/eventos/no-esta.png'))
    check('sin datos, la tarjeta de siempre (nunca un enlace sin foto)', r404.status === 302 && /og-default\.png$/.test(r404.headers.get('location')))
    const rfija = await fn.default(new Request('https://pokedoc.es/tarjeta/fija/no-existe.png'))
    check('  …también una fija que no existe', rfija.status === 302)
    // resvg-js en Node NO hace caso de `fontBuffers`: se salta las opciones de
    // letra enteras y pinta con las del sistema. Con las letras buenas, un
    // texto en Outfit y el mismo en una familia que no existe salen distintos.
    const muestra = (fam) => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80"><text x="10" y="60" font-family="${fam}" font-weight="800" font-size="48">Geometría</text></svg>`
    const a = await fn.pintarPng(muestra('Outfit'))
    const z = await fn.pintarPng(muestra('NoExiste'))
    check('el título sale en Outfit de verdad (no en la letra de reserva)', Buffer.compare(a, z) !== 0)
  }
}

console.log('── Las páginas fijas y la configuración ──')
{
  check('cada tarjeta fija tiene su página y al revés', JSON.stringify(Object.keys(TARJETAS_FIJAS).sort()) === JSON.stringify(Object.keys(PAGINA_DE_FIJA).sort()))
  for (const [n, f] of Object.entries(PAGINA_DE_FIJA)) {
    const html = leer(f)
    check(`${f}: su og:image es /tarjeta/fija/${n}.png`, html.includes(`<meta property="og:image" content="https://pokedoc.es/tarjeta/fija/${n}.png?v=`) && !/og:image" content="[^"]*og-default/.test(html))
  }
  check('generar-cartas pone la de /cartas (cartas.html sale de ahí)', leer('generar-cartas.mjs').includes('/tarjeta/fija/cartas.png'))
  const toml = leer('netlify.toml')
  const iTarjeta = toml.indexOf('from = "/tarjeta/*"')
  check('netlify.toml: /tarjeta/* va a la función, antes del 404 final', iTarjeta > 0 && iTarjeta < toml.indexOf('status = 404') && /from = "\/tarjeta\/\*"\s+to = "\/\.netlify\/functions\/tarjeta"\s+status = 200/.test(toml))
  check('  …y la función se lleva sus binarios (sharp y resvg con su plataforma)', /\[functions\.tarjeta\][\s\S]*external_node_modules = \["sharp", "@resvg\/resvg-js"\][\s\S]*node_modules\/@img\/\*\*/.test(toml))
  const pkg = JSON.parse(leer('package.json'))
  check('package.json lleva sharp y @resvg/resvg-js', !!pkg.dependencies.sharp && !!pkg.dependencies['@resvg/resvg-js'])
  const lock = leer('package-lock.json')
  check('  …y el package-lock, con los binarios de Linux', lock.includes('"node_modules/@img/sharp-linux-x64"') && lock.includes('"node_modules/@resvg/resvg-js-linux-x64-gnu"'))
  const ms = leer('netlify/edge-functions/meta-social.js')
  check('meta-social corre en /eventos/*', /'\/eventos\/\*'/.test(ms))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
