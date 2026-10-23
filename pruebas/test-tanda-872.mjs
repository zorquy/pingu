// Tanda 872 — las tarjetas sociales de los retos (meta-social, sin red).
//
// Un enlace a /reto, /retos o a uno de los seis juegos tiene que salir en
// WhatsApp o en X con SU tarjeta y el número de hoy, no con la genérica.
// Se llama al edge con un `fetch` que no contesta nada (no hace falta: no
// hay consulta) y se mira el HTML que sale; y se comprueba que las siete
// imágenes fijas existen y miden 1200×630.
import { readFileSync, existsSync } from 'node:fs'
import meta, { metaDeReto, config } from '/home/user/pingu/netlify/edge-functions/meta-social.js'
import { numeroDelDia } from '/home/user/pingu/js/reto-compartir.js'
import { RETOS } from '/home/user/pingu/js/retos-xp.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const HTML = `<!DOCTYPE html><html><head><title>Retos — PokeDoc</title>
<meta name="description" content="generica" />
<!-- meta-social:inicio -->
<meta property="og:title" content="viejo" />
<!-- meta-social:fin -->
</head><body></body></html>`

let llamadas = 0
globalThis.fetch = async () => { llamadas++; return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }) }
async function correr(ruta) {
  const ctx = { next: async () => new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }) }
  return (await meta(new Request(ruta), ctx)).text()
}
const hoy = new Date().toISOString().slice(0, 10)
const n = numeroDelDia(hoy)

console.log('── 1. La función pura ──')
{
  const m = metaDeReto(new URL('https://pokedoc.es/mas-caro'), '2026-10-15')
  check('/mas-caro: título con el nombre y el número de ese día', m.titulo === `¿Más caro o más barato? · PokeDoc #${numeroDelDia('2026-10-15')}`, m.titulo)
  check('  …la descripción es la del menú de retos más la invitación', m.descripcion.startsWith('Dos cartas con precio real de Cardmarket.') && /comparte tu resultado/.test(m.descripcion), m.descripcion)
  check('  …la imagen fija de ese reto, apaisada', m.imagen === 'https://pokedoc.es/assets/social/reto-caro.png' && m.imagenAncha === true)
  check('  …y la canónica sin .html', m.url === 'https://pokedoc.es/mas-caro' && metaDeReto(new URL('https://pokedoc.es/mas-caro.html'), '2026-10-15').url === 'https://pokedoc.es/mas-caro')
  const r = metaDeReto(new URL('https://pokedoc.es/retos'), '2026-10-15')
  check('/retos: la del menú, con el número', r.titulo === `Los retos diarios de PokeDoc · #${numeroDelDia('2026-10-15')}` && r.imagen.endsWith('/reto-retos.png') && /Seis juegos al día/.test(r.descripcion), r.titulo)
  // Desde la 989 /reto lleva al menú (un 301) y el sexto es Parejas.
  check('/parejas tiene la suya', metaDeReto(new URL('https://pokedoc.es/parejas'), '2026-10-15').imagen.endsWith('/reto-parejas.png'))
  check('  …y /reto ya no tiene tarjeta propia (va al menú)', metaDeReto(new URL('https://pokedoc.es/reto'), '2026-10-15') === null)
  for (const x of RETOS) check(`  …${x.juego}: título «${x.titulo} · PokeDoc #N»`, metaDeReto(new URL(`https://pokedoc.es${x.ruta}`), '2026-10-15').titulo === `${x.titulo} · PokeDoc #${numeroDelDia('2026-10-15')}`)
  check('una ruta que no es de retos no es de retos', metaDeReto(new URL('https://pokedoc.es/carta'), '2026-10-15') === null && metaDeReto(new URL('https://pokedoc.es/cartas'), '2026-10-15') === null)
}

console.log('── 2. Por el edge entero ──')
{
  const html = await correr('https://pokedoc.es/parejas')
  check('/parejas: el título de la página lleva el número de hoy', html.includes(`<title>Parejas · PokeDoc #${n}</title>`), html.match(/<title>[^<]*/)?.[0])
  check('  …og:image es la tarjeta del reto, con sus medidas', html.includes('og:image" content="https://pokedoc.es/assets/social/reto-parejas.png"') && html.includes('og:image:width" content="1200"') && html.includes('og:image:height" content="630"'))
  check('  …twitter:card grande', html.includes('twitter:card" content="summary_large_image"'))
  check('  …el bloque viejo se sustituye, no se duplica', !html.includes('content="viejo"') && (html.match(/meta-social:inicio/g) || []).length === 1)
  check('  …y sin preguntar nada a la base', llamadas === 0, String(llamadas))
  const retos = await correr('https://pokedoc.es/retos.html')
  check('/retos.html: la del menú', retos.includes('reto-retos.png') && retos.includes(`PokeDoc · #${n}`))
  const exp = await correr('https://pokedoc.es/que-expansion')
  check('/que-expansion: la suya', exp.includes('reto-expansion.png') && exp.includes(`¿De qué expansión es? · PokeDoc #${n}`))
  // La ficha de carta sigue siendo la ficha: /carta-del-dia no la pisa ni al revés.
  llamadas = 0
  const carta = await correr('https://pokedoc.es/carta?id=sv8-25')
  check('/carta?id=… sigue yendo por la ficha de carta (pregunta a la base)', llamadas > 0 && !carta.includes('reto-carta.png'))
}

console.log('── 3. Las rutas están registradas y las imágenes existen ──')
{
  // Desde la 989 /reto es un 301 al menú (no pasa por aquí) y entra /parejas.
  for (const r of ['/retos', '/retos.html', '/parejas', '/parejas.html', '/carta-del-dia', '/carta-del-dia.html', '/mas-caro', '/mas-caro.html', '/quien-es', '/quien-es.html', '/ordena-precio', '/ordena-precio.html', '/que-expansion', '/que-expansion.html']) {
    check(`  …${r} en config.path`, config.path.includes(r))
  }
  const medida = (f) => {
    const b = readFileSync(f)
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  }
  for (const f of ['reto-retos', ...RETOS.map((r) => `reto-${r.juego}`)]) {
    const ruta = `${RAIZ}/assets/social/${f}.png`
    const m = existsSync(ruta) ? medida(ruta) : null
    check(`  …assets/social/${f}.png existe y mide 1200×630`, m?.w === 1200 && m?.h === 630, JSON.stringify(m))
  }
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
