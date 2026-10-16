// Tanda 880 — compartir una noticia en X: lo puro.
//
// PINGU: «me gustaría poder compartir las noticias en twitter de manera
// correcta, es decir, que ponga un poco y la portada». El texto (título +
// entradilla recortada) tiene que caber en 280 con el enlace (23); el
// cuadro de X se abre con el texto y el enlace aparte; y la tarjeta de una
// noticia sin portada lleva la primera foto del cuerpo, no el logo.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}

console.log('── 1. El texto para X cabe ──')
const { textoParaX, direccionDeX, textoConEnlace, recortarPalabras, LARGO_X, LARGO_ENLACE } = await import(`${RAIZ}/js/compartir-x.js`)
{
  const titulo = 'Mega Heatran ex, Lebanne, Gastly y más promos de gimnasio reveladas para noviembre'
  const descripcion = 'The Pokémon Company ha revelado las promos de gimnasio de noviembre en Japón: Mega Heatran ex, Lebanne, Gastly y varias cartas más que llegarán a los torneos de liga de gimnasio. Aquí tienes todas las cartas con su traducción al español y lo que sabemos de su llegada a Occidente.'
  const t = textoParaX({ titulo, descripcion })
  check('título, línea en blanco y la entradilla', t.startsWith(`${titulo}\n\nThe Pokémon Company ha revelado`), t.slice(0, 120))
  check('  …recortada por una palabra entera y con puntos suspensivos', /\S…$/.test(t) && !/ …$/.test(t), t.slice(-40))
  check('  …y cabe con el enlace: texto + 1 + 23 ≤ 280', t.length + 1 + LARGO_ENLACE <= LARGO_X, String(t.length))
  const corta = textoParaX({ titulo: 'Sale Mega Evolution', descripcion: 'La expansión llega el 26.' })
  check('una entradilla corta va entera, sin puntos', corta === 'Sale Mega Evolution\n\nLa expansión llega el 26.', corta)
  check('sin entradilla, el título a secas', textoParaX({ titulo: 'Sale Mega Evolution' }) === 'Sale Mega Evolution')
  const largo = textoParaX({ titulo: 'T'.repeat(300), descripcion: 'algo' })
  check('un título larguísimo se recorta él solo y no lleva entradilla', largo.length + 1 + LARGO_ENLACE <= LARGO_X && largo.endsWith('…') && !largo.includes('\n'), String(largo.length))
  const justo = textoParaX({ titulo: 'T'.repeat(240), descripcion: 'una entradilla que ya no cabe' })
  check('si queda sitio para menos de dos docenas de letras, no se mete media palabra', justo === 'T'.repeat(240), String(justo.length))
  check('recortarPalabras respeta la palabra', recortarPalabras('uno dos tres cuatro', 12) === 'uno dos…' && recortarPalabras('uno dos', 20) === 'uno dos')
  check('  …y quita la coma que queda colgando', recortarPalabras('uno, dos, tres, cuatro', 10) === 'uno, dos…')
}

console.log('\n── 2. La dirección de X y el texto con enlace ──')
{
  const url = 'https://pokedoc.es/noticias/mega-heatran'
  const d = direccionDeX({ texto: 'Hola & adiós\n\nmás', url })
  check('abre el cuadro de X (intent/post) con text y url aparte', d.startsWith('https://x.com/intent/post?text=') && d.endsWith(`&url=${encodeURIComponent(url)}`), d)
  check('  …el texto va con encodeURIComponent (el & y el salto, escapados; sin «+»)', d.includes('Hola%20%26%20adi%C3%B3s%0A%0Am%C3%A1s') && !d.includes('+'), d)
  check('sin url, solo el texto', direccionDeX({ texto: 'a' }) === 'https://x.com/intent/post?text=a')
  const t = textoConEnlace({ titulo: 'Sale Mega Evolution', descripcion: 'La expansión llega el 26.', url })
  check('lo que se pega: el texto y el enlace al final, en su línea', t === `Sale Mega Evolution\n\nLa expansión llega el 26.\n\n${url}`, t)
}

console.log('\n── 3. La tarjeta de una noticia sin portada lleva su primera foto ──')
{
  const { primeraImagenDe, imagenDeArticulo, bloqueMeta } = await import(`${RAIZ}/netlify/edge-functions/meta-social.js`)
  const foto = 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/guias/heatran.png'
  check('un bloque image', primeraImagenDe([{ type: 'paragraph', text: 'hola' }, { type: 'image', url: foto }]) === foto)
  check('la primera <img> de un bloque de texto rico, con el &amp; deshecho', primeraImagenDe([{ type: 'richtext', html: `<p>Hola</p><img alt="x" src="${foto}?a=1&amp;b=2"><img src="https://otra/2.png">` }]) === `${foto}?a=1&b=2`)
  check('una ruta del sitio se completa', primeraImagenDe([{ type: 'image', url: '/assets/images/x.png' }]) === 'https://pokedoc.es/assets/images/x.png')
  check('lo que no es http(s) ni ruta, no (un data: no vale para una tarjeta)', primeraImagenDe([{ type: 'image', url: 'data:image/png;base64,AAA' }, { type: 'richtext', html: '<img src="javascript:1">' }]) === '')
  check('sin bloques, nada', primeraImagenDe(null) === '' && primeraImagenDe([]) === '')
  check('la portada manda', imagenDeArticulo({ cover_image: '/p.png', reference_blocks: [{ type: 'image', url: foto }] }) === 'https://pokedoc.es/p.png')
  check('sin portada, la primera foto', imagenDeArticulo({ cover_image: null, reference_blocks: [{ type: 'image', url: foto }] }) === foto)
  check('sin nada, la del sitio', imagenDeArticulo({ cover_image: '', reference_blocks: [] }) === 'https://pokedoc.es/assets/images/og-default.png')
  const meta = bloqueMeta({ url: 'https://pokedoc.es/noticias/x', titulo: 'X', descripcion: 'Y', imagen: foto })
  check('y en la tarjeta: summary_large_image con esa foto en twitter:image y og:image', /twitter:card" content="summary_large_image"/.test(meta) && meta.includes(`<meta name="twitter:image" content="${foto}" />`) && meta.includes(`<meta property="og:image" content="${foto}" />`), meta.slice(0, 200))
  check('  …sin medidas inventadas (no se conocen)', !/og:image:width/.test(meta))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
