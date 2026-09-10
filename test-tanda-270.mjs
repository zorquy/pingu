// Tanda 270: el cuerpo del artículo, servido desde el servidor.
//
// Hasta hoy guia.html llegaba VACÍA: el texto lo pintaba js/guia.js en el
// navegador. Google ejecuta JavaScript, pero lo mete en una segunda cola
// que tarda de horas a días — para una noticia, donde toda la ventaja es
// llegar el primero en español, eso es no existir.
//
// Sin red: se sustituye fetch por un doble que responde como PostgREST.
import meta, { limpiarParaElServidor, cuerpoDeBloques, cuerpoDeArticulo, inyectarCuerpo } from '/home/user/pingu/netlify/edge-functions/meta-social.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 120) : ''}`)
}

const HTML = `<!DOCTYPE html><html><head><title>Guía — PokeDoc</title>
<meta name="description" content="generica" />
<!-- meta-social:inicio -->
<meta property="og:title" content="viejo" />
<!-- meta-social:fin -->
</head><body>
<article class="article-main" id="articleMain">
<!-- articulo:inicio --><p class="empty-state">Cargando guía…</p><!-- articulo:fin -->
</article>
</body></html>`

const montarFetch = (fila) => async (url, opciones = {}) => {
  if (opciones.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': '0-0/1' } })
  if (String(url).includes('/guides?')) {
    return new Response(JSON.stringify(fila ? [fila] : []), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
}

const servir = async (ruta, fila) => {
  const original = globalThis.fetch
  globalThis.fetch = montarFetch(fila)
  try {
    const respuesta = await meta(new Request(`https://pokedoc.es${ruta}`), {
      next: async () => new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }),
    })
    return await respuesta.text()
  } finally {
    globalThis.fetch = original
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El repaso del servidor: lo que NO puede pasar ──')
{
  // Lo que llega ya pasó por DOMPurify al guardarse. Esto es la segunda
  // cerradura, y es la que importa: aquí no hay navegador que sanee, y un
  // <img onerror> se ejecutaría al PARSEAR, antes de que el JavaScript de
  // la guía llegara a sustituir nada.
  const veneno = [
    ['un script suelto', '<p>hola</p><script>alert(1)</script>', /script/i],
    ['un manejador de eventos', '<img src="/a.png" onerror="alert(1)">', /onerror/i],
    ['otro, en mayúsculas', '<IMG SRC="/a.png" ONLOAD="alert(1)">', /onload/i],
    ['un enlace con javascript:', '<a href="javascript:alert(1)">pincha</a>', /javascript:/i],
    ['una imagen con data:', '<img src="data:text/html;base64,PHNjcmlwdD4=">', /data:/i],
    ['un iframe', '<iframe src="https://malo.example"></iframe>', /iframe/i],
    ['un svg con dentro', '<svg><script>alert(1)</script></svg>', /svg|script/i],
    ['un style', '<style>body{display:none}</style>', /<style/i],
    ['un comentario que esconde algo', '<!-- <script>alert(1)</script> -->', /script/i],
    ['un formulario', '<form action="https://malo.example"><input name="pass"></form>', /<form/i],
    ['un manejador sin comillas', '<img src=/a.png onerror=alert(1)>', /onerror/i],
  ]
  for (const [que, entrada, prohibido] of veneno) {
    const limpio = limpiarParaElServidor(entrada)
    check(`fuera ${que}`, !prohibido.test(limpio), limpio)
  }
}

console.log('\n── 2. …y lo que SÍ tiene que pasar ──')
{
  const rico = `<h2>Los mazos</h2><p>Esto es <strong>importante</strong> y <em>esto también</em>.</p>
<div class="rt-fila" data-cols="3"><figure class="rt-fig"><img src="/fotos/c1.png" alt="Charizard"><figcaption>Charizard ex</figcaption></figure></div>
<ul><li>Uno</li><li>Dos</li></ul><a href="https://pokedoc.es/guia?slug=x">una guía</a>
<blockquote>una cita</blockquote><details><summary>Spoiler</summary><p>dentro</p></details>`
  const limpio = limpiarParaElServidor(rico)
  for (const [que, patron] of [
    ['los encabezados', /<h2>Los mazos<\/h2>/],
    ['la negrita', /<strong>importante<\/strong>/],
    ['las filas de imágenes con sus columnas', /<div class="rt-fila" data-cols="3">/],
    ['las imágenes con su texto alternativo', /<img src="\/fotos\/c1\.png" alt="Charizard">/],
    ['los pies de foto', /<figcaption>Charizard ex<\/figcaption>/],
    ['las listas', /<li>Uno<\/li>/],
    ['los enlaces de casa', /<a href="https:\/\/pokedoc\.es\/guia\?slug=x">/],
    ['las citas', /<blockquote>una cita<\/blockquote>/],
    ['los spoilers', /<details><summary>Spoiler<\/summary>/],
  ]) {
    check(`se conservan ${que}`, patron.test(limpio), limpio)
  }
}

console.log('\n── 3. De los bloques guardados al artículo ──')
{
  const nuevo = cuerpoDeBloques([{ type: 'richtext', html: '<p>El formato de ahora</p>' }])
  check('el formato de ahora (richtext)', nuevo === '<p>El formato de ahora</p>', nuevo)
  // Las guías viejas siguen teniendo bloques sueltos, y se pintan igual:
  // el robot y la persona tienen que leer lo mismo.
  const viejo = cuerpoDeBloques([
    { type: 'heading', text: 'Un título' },
    { type: 'paragraph', text: 'Un párrafo' },
    { type: 'list', items: ['a', 'b'] },
    { type: 'image', url: '/x.png', caption: 'pie' },
  ])
  check('y el editor de bloques viejo', /<h2>Un título<\/h2><p>Un párrafo<\/p><ul><li>a<\/li><li>b<\/li><\/ul>/.test(viejo), viejo)
  check('con las imágenes de los bloques viejos', /<img src="\/x\.png" alt="pie">/.test(viejo), viejo)
  check('el texto de un bloque viejo se escapa', !cuerpoDeBloques([{ type: 'paragraph', text: '<script>x</script>' }]).includes('<script'))
  check('sin bloques, no se inventa nada', cuerpoDeBloques(null) === '' && cuerpoDeBloques([]) === '')
}

console.log('\n── 4. La página servida ──')
{
  const html = await servir('/noticias/cartas-30-aniversario', {
    title: 'Reveladas las cartas del 30 aniversario',
    description: 'Todas, una por una.',
    published_at: '2026-09-10T09:00:00Z',
    cover_image: 'https://pokedoc.es/x.png',
    reference_blocks: [{ type: 'richtext', html: '<h2>Las cartas</h2><p>Charizard vuelve.</p>' }],
    categories: null,
  })
  check('el titular está en el HTML, sin ejecutar nada', html.includes('<h1>Reveladas las cartas del 30 aniversario</h1>'))
  check('la entradilla también', html.includes('<p class="lead">Todas, una por una.</p>'))
  check('y el texto del artículo', html.includes('<h2>Las cartas</h2><p>Charizard vuelve.</p>'))
  check('ya no queda el «Cargando guía…»', !html.includes('Cargando guía…'))
  check('sigue estando la ficha de noticia', html.includes('"NewsArticle"'))
  check('y la canónica limpia', html.includes('https://pokedoc.es/noticias/cartas-30-aniversario'))
}

console.log('\n── 5. Lo que no puede romperse nunca ──')
{
  // La regla de oro del fichero: peor vista previa, jamás página rota.
  const sinArticulo = await servir('/guia?slug=x', null)
  check('un artículo que no existe deja la página como estaba', sinArticulo.includes('Cargando guía…'))

  const sinBloques = await servir('/guia?slug=x', {
    title: 'Guía sin cuerpo', description: 'x', published_at: '2026-01-01T00:00:00Z',
    reference_blocks: null, categories: null,
  })
  check('un artículo sin texto, igual', sinBloques.includes('Cargando guía…'))
  check('pero con sus etiquetas sociales', sinBloques.includes('Guía sin cuerpo'))

  // Un curso no se sirve: su artículo de referencia puede estar bajo llave.
  const curso = await servir('/curso?slug=x', {
    title: 'Un curso', description: 'x', published_at: '2026-01-01T00:00:00Z',
    reference_blocks: [{ type: 'richtext', html: '<p>teoría de pago</p>' }], categories: null,
  })
  check('un curso NO suelta su teoría', !curso.includes('teoría de pago'))

  // Una página sin marcadores sale exactamente igual.
  check('sin marcadores, no se toca nada',
    inyectarCuerpo('<html><body><p>tal cual</p></body></html>', '<h1>x</h1>') === '<html><body><p>tal cual</p></body></html>')
  check('y sin cuerpo tampoco', inyectarCuerpo(HTML, '') === HTML)
}

console.log('\n── 6. El tope de tamaño ──')
{
  // Un artículo enorme no puede hacer crecer sin límite cada respuesta.
  const largo = cuerpoDeArticulo({
    titulo: 'T', entradilla: '', bloques: [{ type: 'richtext', html: '<p>x</p>'.repeat(20000) }],
  })
  check('un artículo gigante se recorta', largo.length < 70000, `${largo.length} caracteres`)
  check('pero se recorta, no se tira', largo.includes('<h1>T</h1>') && largo.includes('<p>x</p>'))
  // Y se corta por el final de una etiqueta: partir un `<p class="` por la
  // mitad deja al navegador adivinando cómo se cierra.
  check('y corta por el final de una etiqueta', largo.endsWith('>'), largo.slice(-30))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
