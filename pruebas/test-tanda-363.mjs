// Tanda 363 — los torneos entran en el RSS.
//
// PINGU quiere una cuenta de X que publique sola cada noticia, guía y
// torneo. El canal ya existía y llevaba solo artículos: sin los torneos
// en él, justo lo que más gente trae a PokeDoc se quedaba fuera de
// cualquier automatización.
import { readFileSync } from 'node:fs'
import handler, { documento } from '/home/user/pingu/netlify/functions/rss.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

console.log('\n── 1. Cada cosa a su dirección ──')
{
  const xml = documento([
    { kind: 'news', slug: 'algo', title: 'Una noticia', description: 'x', published_at: '2026-09-28T10:00:00Z' },
    { kind: 'guide', slug: 'una-guia', title: 'Una guía', description: 'y', published_at: '2026-09-27T10:00:00Z' },
    { kind: 'torneo', slug: 'pachanga', title: 'Torneo: Pachanga', description: 'z', published_at: '2026-09-29T10:00:00Z' },
  ])
  check('la noticia, a /noticias/<slug>', xml.includes('<link>https://pokedoc.es/noticias/algo</link>'))
  check('la guía, a /guia/<slug>', xml.includes('<link>https://pokedoc.es/guia/una-guia</link>'))
  check('y el torneo, a su ficha', xml.includes('<link>https://pokedoc.es/torneo?slug=pachanga</link>'))
  check('cada uno con su categoría', /<category>Torneos<\/category>/.test(xml) && /<category>Noticias<\/category>/.test(xml))
}

console.log('\n── 2. Qué torneos salen y cuáles NO ──')
{
  const original = globalThis.fetch
  const pedidas = []
  globalThis.fetch = async (url) => {
    const u = String(url)
    pedidas.push(u)
    const json = (c) => new Response(JSON.stringify(c), { status: 200, headers: { 'content-type': 'application/json' } })
    if (u.includes('/tournaments')) {
      return json([{
        slug: 'pachanga', name: 'Pachanga de inauguración', description: '<p>Con <b>HTML</b></p>',
        start_at: '2026-10-04T17:00:00Z', created_at: '2026-09-29T09:00:00Z', max_players: 16,
      }])
    }
    return json([{ slug: 'noti', title: 'Una noticia', description: 'x', published_at: '2026-09-20T10:00:00Z', kind: 'news' }])
  }

  const xml = await (await handler()).text()
  const consulta = pedidas.find((u) => u.includes('/tournaments')) || ''

  // Las dos condiciones, y las dos importan.
  check('solo con la inscripción abierta', /status=eq\.registration_open/.test(consulta))
  check('solo los que no han empezado', /start_at=gte\./.test(consulta))
  // Los de CÓDIGO sí entran desde la tanda 367: se ven en la web como
  // cualquier otro, y un canal que esconde lo que la web enseña miente.
  // Lo que decide es la POLÍTICA de la base, no un filtro escrito aquí.
  check('los de código ya no se filtran', !/is_private=is\.false/.test(consulta), consulta)

  check('el torneo sale en el canal', xml.includes('/torneo?slug=pachanga'))
  check('…con su título reconocible', /<title>Torneo: Pachanga de inauguración<\/title>/.test(xml))
  // La descripción la escribe alguien con el editor rico: en un RSS el
  // HTML se enseñaría escapado y en crudo.
  check('…y sin el HTML de su descripción', !/&lt;p&gt;/.test(xml), xml.slice(xml.indexOf('Torneo:'), xml.indexOf('Torneo:') + 200))
  check('…diciendo cuándo se juega y cuántas plazas', /4 de octubre/.test(xml) && /16 plazas/.test(xml))

  // La fecha de la entrada es la de PUBLICACIÓN, no la de juego: si no,
  // un torneo creado hoy para dentro de un mes se pondría por delante de
  // todo y volvería a subir cada día que pasa.
  check('la fecha del canal es cuándo se anunció, no cuándo se juega',
    /order=created_at\.desc/.test(consulta) && xml.includes('29 Sep 2026'), consulta.slice(-60))
  // Y lo más nuevo primero, mezclado con los artículos.
  check('lo más nuevo, primero', xml.indexOf('Torneo: Pachanga') < xml.indexOf('Una noticia'))

  globalThis.fetch = original
}

console.log('\n── 3. Y si algo falla, el canal sigue saliendo ──')
{
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    const u = String(url)
    if (u.includes('/tournaments')) return new Response('nope', { status: 500 })
    return new Response(JSON.stringify([{ slug: 'noti', title: 'Una noticia', description: 'x', published_at: '2026-09-20T10:00:00Z', kind: 'news' }]),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const xml = await (await handler()).text()
  // Un canal vacío o roto hace que algunos lectores se den de baja solos.
  check('sin torneos, el canal sale con los artículos', xml.includes('Una noticia') && !xml.includes('/torneo?slug='))
  globalThis.fetch = original

  // Y el respaldo por si la columna de privados no existe todavía: se
  // pide en el select, así que sin ella la consulta entera fallaría.
  const js = leer('netlify/functions/rss.mjs')
  check('hay vuelta atrás sin la columna de privados',
    /max_players,is_private[\s\S]{0,400}\.catch\(\(\) =>/.test(js))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
