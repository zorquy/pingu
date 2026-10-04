// Tanda 537 — el relleno japonés.
//
// PINGU: «vete con lo japonés, rellename todos los logos y las imágenes de
// cartas. No sé por qué esto te está costando tanto, lo tenemos todo en
// Scrydex, simplemente tráelo».
//
// Y lo que faltaba era esto: `scrydex-relleno` llevaba `MERCADO = 'WEST'`
// e `IDIOMA = 'en'` A FUEGO. El comentario que lo justificaba decía «el
// japonés no está emparejado», y eso dejó de ser verdad en cuanto la 530
// trajo sus 231 expansiones. Es la trampa que la 471 dejó escrita: una
// constante justificada con «hoy esto no hace falta» no avisa el día que
// hace falta.
import { readFileSync } from 'node:fs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-relleno.mjs'
import { filaDeCartaConScrydex } from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { nombreDeCarta } from '/home/user/pingu/js/carta-nucleo.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

// Una carta suya japonesa, con la forma que tiene su expansión japonesa de
// verdad —la que contestó la sonda de la 528— aplicada a una carta.
const SUYA_JP = {
  id: 'sv1a-001', name: 'フシギダネ', number: '1',
  rarity: 'Common', artist: 'Mitsuhiro Arita', hp: '70',
  national_pokedex_numbers: [1],
  translation: { en: { name: 'Bulbasaur' } },
  images: [{ type: 'front', small: 'https://images.scrydex.com/pokemon/sv1a-001/small' }],
  expansion: { id: 'sv1a_ja', code: 'SV1a' },
}

console.log('── 1. La pasada japonesa usa SU mercado, SU idioma y SU estado ──')
{
  const pedidas = []
  const consultas = []
  const restImpl = async (ruta) => {
    consultas.push(ruta)
    if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 1 } }]
    if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
    if (/tcg_sets/.test(ruta)) return [{ id: 'SV1a', scrydex_id: 'sv1a_ja' }]
    return [{ id: 'SV1a-001', market: 'JP', set_id: 'SV1a', local_id: '001', name: 'フシギダネ' }]
  }
  const escrito = []
  await procesar({
    env: ENV, restImpl, paginas: 1,
    mercado: 'JP', idioma: 'ja', claveEstado: 'cartas-jp',
    fetchImpl: async (url) => {
      pedidas.push(String(url))
      return { ok: true, json: async () => ({ data: [SUYA_JP], page: 1, page_size: 250, total_count: 1 }) }
    },
    escribirImpl: async (tabla, filas) => { escrito.push({ tabla, filas }) },
    guardarEstadoImpl: async () => {},
  })
  check('le pide a Scrydex el catálogo JAPONÉS', pedidas.some((u) => /\/ja\/cards/.test(u)), pedidas[0])
  check('  …y no el inglés', !pedidas.some((u) => /\/en\/cards/.test(u)), pedidas.join(' | '))
  check('pregunta por los sets del mercado JP', consultas.some((r) => /tcg_sets.*market=eq\.JP/.test(r)), consultas.find((r) => /tcg_sets/.test(r)))
  check('y lee su PROPIO estado', consultas.some((r) => /clave=eq\.cartas-jp/.test(r)), consultas.find((r) => /scrydex_estado/.test(r)))
  check('escribe la carta japonesa', escrito[0]?.filas?.[0]?.id === 'SV1a-001', JSON.stringify(escrito[0]?.filas?.[0]))
}

console.log('── 2. Y la occidental sigue siendo la occidental ──')
{
  // Una copia del fichero habría dejado dos bucles que se separan; esto es
  // la MISMA función, así que conviene comprobar que sin parámetros sigue
  // haciendo lo de siempre.
  const pedidas = []
  const consultas = []
  await procesar({
    env: ENV, paginas: 1,
    restImpl: async (ruta) => {
      consultas.push(ruta)
      if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 1 } }]
      if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
      if (/tcg_sets/.test(ruta)) return [{ id: 'sv10', scrydex_id: 'sv10' }]
      return []
    },
    fetchImpl: async (url) => {
      pedidas.push(String(url))
      return { ok: true, json: async () => ({ data: [], page: 1, page_size: 250, total_count: 0 }) }
    },
    escribirImpl: async () => {}, guardarEstadoImpl: async () => {},
  })
  check('sin parámetros, pide el inglés', pedidas.some((u) => /\/en\/cards/.test(u)), pedidas[0])
  check('  …y el mercado WEST', consultas.some((r) => /market=eq\.WEST/.test(r)))
  check('  …y su estado de siempre', consultas.some((r) => /clave=eq\.cartas-west/.test(r)))
}

console.log('── 3. El nombre occidental de la carta ──')
{
  const f = filaDeCartaConScrydex(
    { id: 'SV1a-001', market: 'JP', set_id: 'SV1a', local_id: '001', name: 'フシギダネ' },
    SUYA_JP,
  )
  check('se guarda', f.name_en === 'Bulbasaur', f.name_en)
  check('  …sin pisar el japonés', f.name === 'フシギダネ', f.name)
  // Y se ENSEÑA: se traduce lo que no se puede leer, igual que con los sets.
  check('la pantalla enseña el occidental', nombreDeCarta({ name: 'フシギダネ', name_en: 'Bulbasaur' }) === 'Bulbasaur')
  check('  …y una carta occidental no cambia', nombreDeCarta({ name: 'Bulbasaur', name_en: 'Bulbasaur' }) === 'Bulbasaur')
  check('  …y el español sigue mandando donde lo hay',
    nombreDeCarta({ name: "Boss's Orders", name_es: 'Órdenes del Jefe', name_en: "Boss's Orders" }) === 'Órdenes del Jefe')
  check('  …y sin traducción, el japonés tal cual', nombreDeCarta({ name: 'フシギダネ' }) === 'フシギダネ')
}

console.log('── 4. ¿Traen sus cartas el nombre occidental? Que lo diga el panel ──')
{
  // En sus EXPANSIONES viene; en sus CARTAS lo escribí dando por hecho que
  // también. Eso es deducir de una muestra de otra cosa, que es lo que me
  // enseñaron a no hacer las tandas 484 y 486. Así que se CUENTA y el panel
  // lo dice: si acaba en 0 con miles escritas, el japonés se queda en
  // japonés por SU catálogo y no por nuestro código.
  const estados = []
  const correr = async (suya) => {
    estados.length = 0
    const r = await procesar({
      env: ENV, paginas: 1, mercado: 'JP', idioma: 'ja', claveEstado: 'cartas-jp',
      restImpl: async (ruta) => {
        if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 1 } }]
        if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
        if (/tcg_sets/.test(ruta)) return [{ id: 'SV1a', scrydex_id: 'sv1a_ja' }]
        return [{ id: 'SV1a-001', market: 'JP', set_id: 'SV1a', local_id: '001', name: 'フシギダネ' }]
      },
      fetchImpl: async () => ({ ok: true, json: async () => ({ data: [suya], page: 1, page_size: 250, total_count: 9999 }) }),
      escribirImpl: async () => {},
      guardarEstadoImpl: async (v) => { estados.push(v) },
    })
    return r
  }
  const conNombre = await correr(SUYA_JP)
  check('cuenta las que lo traen', conNombre.cuerpo.conNombreOccidental === 1, conNombre.cuerpo.conNombreOccidental)
  check('  …y lo deja en el estado, que es lo que se ve en el panel',
    estados.at(-1)?.conNombreOccidental === 1, JSON.stringify(estados.at(-1)))
  const sinNombre = await correr({ ...SUYA_JP, translation: undefined })
  check('si no lo traen, cuenta CERO', sinNombre.cuerpo.conNombreOccidental === 0, sinNombre.cuerpo.conNombreOccidental)
  check('  …y aun así la carta se escribe', sinNombre.cuerpo.escritas === 1, sinNombre.cuerpo.escritas)
}

console.log('── 5. QUIEN LO PINTA, LO PIDE ──')
{
  // La lección de la 523: una columna que la base rellena y ninguna
  // consulta pide llega `undefined`, y la pantalla se queda igual que
  // estaba. `nombreDeCarta` lee `name_en`, así que las consultas que
  // alimentan una pantalla tienen que traerlo.
  const archivos = [
    'js/carta.js', 'js/cartas.js', 'js/coleccion.js', 'js/mi-coleccion.js',
    'js/mi-coleccion/datos.js', 'js/tcgdex.js',
  ]
  const faltan = []
  let vistas = 0
  for (const a of archivos) {
    const txt = readFileSync(`/home/user/pingu/${a}`, 'utf8')
    for (const m of txt.matchAll(/'([a-z_][a-z_0-9(),. *]*)'/gi)) {
      const cols = m[1].split(/[,()]/).map((s) => s.trim())
      // Una consulta de CARTAS se reconoce por `name_es`, que es la
      // columna que solo tienen ellas.
      if (!cols.includes('name_es') || !cols.includes('local_id')) continue
      vistas++
      if (!cols.includes('name_en')) faltan.push(`${a}: ${m[1].slice(0, 70)}`)
    }
  }
  check('se han encontrado consultas de cartas', vistas >= 6, vistas)
  check('todas piden el nombre occidental', faltan.length === 0, faltan.join(' | '))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
