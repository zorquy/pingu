// Tanda 349 — el guion de las megas.
//
// PINGU: «Mew ex sí sale en qué mazos se ha jugado, pero Mega Darkrai
// no, y también se ha usado una vez». No era el umbral: TCGdex la llama
// «Mega-Darkrai ex» con guion y TCG Live la escribe con espacio, así que
// la fila existía y la ficha preguntaba por otra clave.
import { readFileSync } from 'node:fs'
import { normalizarNombre, claveDeCarta } from '/home/user/pingu/js/normalizar.js'
import { claveDeJuego, clavesDeJuego, unirJuego, bloqueDeJuego } from '/home/user/pingu/js/carta-nucleo.js'
import { agregarJuego } from '/home/user/pingu/netlify/lib/juego-agregado.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

console.log('\n── 1. El guion y el espacio son el mismo hueco ──')
{
  check('la mega de TCGdex y la de TCG Live dan la MISMA clave',
    claveDeCarta('Mega-Darkrai ex') === claveDeCarta('Mega Darkrai ex'),
    `${claveDeCarta('Mega-Darkrai ex')} / ${claveDeCarta('Mega Darkrai ex')}`)
  check('…y la clave es la limpia', claveDeCarta('Mega-Darkrai ex') === 'mega darkrai ex')
  check('vale para toda la familia', claveDeCarta('Ho-Oh') === claveDeCarta('Ho Oh'))
  // Y lo que NO cambia: la Pokédex y el buscador de especies siguen
  // viendo el guion, que ahí sí puede ser parte de un identificador.
  check('`normalizarNombre` se queda como estaba',
    normalizarNombre('Mega-Darkrai ex') === 'mega-darkrai ex')
  check('la ficha pregunta con la clave nueva', claveDeJuego({ name: 'Mega-Darkrai ex' }) === 'mega darkrai ex')
}

console.log('\n── 2. Las dos mitades usan la MISMA función ──')
{
  // Si la tarea que rellena la tabla y la ficha que pregunta calcularan
  // la clave por su cuenta, se separarían y no daría error: la tabla se
  // llenaría de filas que nadie sabe encontrar. Que es lo que pasó.
  const lista = {
    tournament_id: 't1',
    parsed_cards: { pokemon: [{ name: 'Mega Darkrai ex', quantity: 3, set: 'PBL', number: '048' }], trainer: [], energy: [] },
  }
  const filas = agregarJuego([lista], [])
  check('la tarea guarda la clave sin guion', filas[0]?.name_key === 'mega darkrai ex', filas[0]?.name_key)
  check('…y es la que preguntaría la ficha',
    filas[0]?.name_key === claveDeJuego({ name: 'Mega-Darkrai ex' }))
  check('la importa, no la copia',
    /import \{ claveDeCarta \} from '\.\.\/\.\.\/js\/normalizar\.js'/.test(leer('netlify/lib/juego-agregado.mjs')) &&
    !/function claveDeCarta/.test(leer('netlify/lib/juego-agregado.mjs')))
}

console.log('\n── 3. Y con un solo mazo, se enseña ──')
{
  const html = bloqueDeJuego({ decks: 1, total_copies: 2, tournaments: 1, archetypes: [] })
  check('un mazo ya es dato', html.includes('Mazo que la lleva'))
  check('…y no se inventa una media', !html.includes('Copias de media'))
}

console.log('\n── 4. Las dos lenguas de una decklist ──')
{
  // El export de TCG Live sale en el idioma del jugador: la misma carta
  // puede tener fila en inglés y fila en español, y son mazos DISTINTOS.
  const carta = { name: "Boss's Orders", name_es: 'Órdenes del Jefe' }
  const claves = clavesDeJuego(carta)
  check('se pregunta por las dos',
    claves.length === 2 && claves.includes("boss's orders") && claves.includes('ordenes del jefe'),
    claves.join(' | '))
  check('…y sin repetir cuando son iguales',
    clavesDeJuego({ name: 'Mega-Darkrai ex', name_es: 'Mega-Darkrai ex' }).length === 1)
  const unido = unirJuego([
    { decks: 3, total_copies: 6, tournaments: 2, archetypes: [{ nombre: 'Gardevoir', mazos: 3 }] },
    { decks: 1, total_copies: 2, tournaments: 1, archetypes: [{ nombre: 'Gardevoir', mazos: 1 }] },
  ])
  check('los mazos se suman', unido.decks === 4, String(unido?.decks))
  check('las copias también', unido.total_copies === 8)
  // Un torneo con una lista en cada idioma se contaría dos veces.
  check('los torneos NO se suman', unido.tournaments === 2, String(unido?.tournaments))
  check('y el arquetipo se junta', unido.archetypes.length === 1 && unido.archetypes[0].mazos === 4,
    JSON.stringify(unido.archetypes))
  check('una sola fila se devuelve tal cual', unirJuego([{ decks: 9 }]).decks === 9)
  check('ninguna, null', unirJuego([]) === null)
}

console.log('\n── 5. Y la base cruza con la misma regla ──')
{
  // `tcg_cards.name_key` es generada y el sitemap la usa de prefiltro.
  // Si Postgres no junta los separadores y el JavaScript sí, las cartas
  // con guion dejan de ofrecerse a Google sin que nada lo diga.
  const sql = leer('supabase-migration-clave-de-carta.sql')
  check('la migración redefine name_key', /add column name_key text/.test(sql))
  check('…juntando los separadores', /\[-–—_\[:space:\]\]\+/.test(sql))
  check('…y recorta', /btrim\(/.test(sql))
  check('y el sitemap sigue cruzando en JavaScript',
    /porNombre\.get\(claveDeJuego\(c\)\)/.test(leer('netlify/functions/sitemap.mjs')))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
