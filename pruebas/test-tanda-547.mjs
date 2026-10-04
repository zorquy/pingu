// Tanda 547 — el catálogo japonés se CALCA de Scrydex, entero.
//
// PINGU: «no hay nadie con colecciones… podríamos hacer un borrón y cuenta
// nueva y así no pasa nada. Entonces todo el catálogo japonés lo traemos
// directamente de Scrydex. Lo montamos así y ya está. Esto solo para mi
// colección, que no afecte, porque TCGdex está muy bien para los sets
// actuales, para la parte de jugar».
//
// Y se puede porque su respuesta de cartas trae la ficha COMPLETA: eso no
// es una suposición, está pegada byte a byte abajo desde `test-tanda-502`,
// de una petición de verdad. Lleva subtipos, tipos, PS, de quién evoluciona,
// habilidades, ataques con su texto y su daño, debilidades, resistencias,
// coste de retirada, reglas, marca de reglamento y versiones.
//
// LO QUE MÁS VIGILA ESTA PRUEBA son dos cosas que no darían error:
//
//   1. Que el occidental NO se toque. Es el que alimenta «Jugar», y meter
//      ahí miles de cartas suyas es exactamente lo que PINGU pidió que no
//      pasara.
//   2. Que los enums acaben en su forma CANÓNICA. Si «Pokémon» con tilde se
//      escribe tal cual en `category`, la ficha entera deja de saber que es
//      un Pokémon — y la pantalla no se queja, solo enseña menos.
import { readFileSync } from 'node:fs'
import {
  detalleDeCartaSuya, deSubtipos, filaDeCartaSuya,
  FASE_DE_SUBTIPO, ENTRENADOR_DE_SUBTIPO, ENERGIA_DE_SUBTIPO,
} from '/home/user/pingu/netlify/lib/scrydex.mjs'
import { procesar } from '/home/user/pingu/netlify/functions/scrydex-relleno.mjs'
import { MERCADOS_A_IMPORTAR, MERCADOS_DE_SCRYDEX, MERCADOS_VISIBLES, esDeScrydex } from '/home/user/pingu/js/mercados.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ENV = { SCRYDEX_API_KEY: 'k', SCRYDEX_TEAM_ID: 't', SUPABASE_SERVICE_ROLE_KEY: 's' }

// SU RESPUESTA DE VERDAD, pegada tal cual (la norma de la 501: en cuanto
// hay una respuesta real, el fixture ES esa respuesta).
const REAL = JSON.parse(String.raw`{"id":"me55c-58","name":"Pikachu","supertype":"Pokémon","subtypes":["Basic"],"types":["Lightning"],"hp":"40","evolves_from":[],"abilities":[],"attacks":[{"cost":["Colorless"],"converted_energy_cost":1,"name":"Gnaw","text":null,"damage":"10"},{"cost":["Lightning","Colorless"],"converted_energy_cost":2,"name":"Thunder Jolt","text":"Flip a coin. If tails, Pikachu does 10 damage to itself.","damage":"30"}],"weaknesses":[{"type":"Fighting","value":"×2"}],"resistances":[],"retreat_cost":["Colorless"],"converted_retreat_cost":1,"rules":[],"number":"58","printed_number":"58/102","additional_numbers":[],"rarity":"Common","rarity_code":"C","artist":"Mitsuhiro Arita","national_pokedex_numbers":[25],"regulation_mark":null,"legalities":[],"flavor_text":null,"images":[{"type":"front","small":"https://images.scrydex.com/pokemon/me55c-58/small","medium":"https://images.scrydex.com/pokemon/me55c-58/medium","large":"https://images.scrydex.com/pokemon/me55c-58/large"}],"expansion":{"id":"me55c","name":"30th Celebration: Classic Collection","series":"Mega Evolution","code":"30C","total":30,"printed_total":null,"language":"English","language_code":"EN","release_date":"2026/09/16","is_online_only":false,"logo":"https://images.scrydex.com/pokemon/me55c-logo/logo","symbol":"https://images.scrydex.com/pokemon/me55c-symbol/symbol"},"language":"English","language_code":"EN","expansion_sort_order":1,"variants":[{"name":"holofoil","images":[],"marketplaces":[],"prices":[]}]}`)

console.log('── 1. La ficha entera, de su respuesta de verdad ──')
{
  const d = detalleDeCartaSuya(REAL)
  check('la categoría, canónica y sin tilde', d.category === 'Pokemon', d.category)
  check('la fase', d.stage === 'Basic', d.stage)
  check('los tipos', JSON.stringify(d.types) === '["Lightning"]', JSON.stringify(d.types))
  check('los PS, como número', d.hp === 40, JSON.stringify(d.hp))
  check('la retirada, la CONVERTIDA (nuestra columna es un número)', d.retreat === 1, JSON.stringify(d.retreat))
  // Su `text` es nuestro `effect`: el pintor lee `a.effect`, así que
  // guardarlo con su nombre dejaría los ataques SIN TEXTO y sin dar error.
  check('los dos ataques', d.attacks?.length === 2, JSON.stringify(d.attacks?.length))
  check('  …con su nombre, coste y daño', d.attacks[1].name === 'Thunder Jolt' && d.attacks[1].damage === '30' && d.attacks[1].cost.length === 2, JSON.stringify(d.attacks[1]))
  check('  …y su texto en `effect`, que es lo que pinta la ficha', /Flip a coin/.test(d.attacks[1].effect || ''), JSON.stringify(d.attacks[1].effect))
  check('  …y NINGUNO con `text`, que no lo lee nadie', !d.attacks.some((a) => 'text' in a), JSON.stringify(d.attacks[0]))
  check('la debilidad', d.weaknesses?.[0]?.type === 'Fighting', JSON.stringify(d.weaknesses))
  // Lo que viene vacío se guarda como null y NO como lista vacía: hay tres
  // estados, y «no tiene habilidades» es distinto de «no se sabe» (319).
  check('lo vacío se queda a null, no en lista vacía', d.abilities === null && d.resistances === null, JSON.stringify([d.abilities, d.resistances]))
  check('la versión, traducida a nuestras banderas', JSON.stringify(d.variants) === '{"holo":true}', JSON.stringify(d.variants))
  // El IDIOMA de la ficha, que decide si una reimpresión puede comparar los
  // nombres de los ataques (tanda 333).
  check('el idioma de la ficha queda dicho', d.detalle_lang === 'ja', d.detalle_lang)
  check('  …y se puede pedir otro', detalleDeCartaSuya(REAL, { idioma: 'en' }).detalle_lang === 'en')
  check('y queda marcada como engordada', typeof d.detalle_at === 'string' && d.detalle_at.length > 10, d.detalle_at)
}

console.log('── 2. `basic` significa DOS cosas, según el supertipo ──')
{
  // Un Pokémon Básico y una Energía Básica comparten subtipo, y van a
  // columnas distintas: escribir «Basic» en `energy_type` haría que
  // `esEnergiaBasica` dijera que no lo es, y una energía básica siempre
  // está dentro de formato.
  const pkm = deSubtipos({ supertype: 'Pokémon', subtypes: ['Basic'] })
  check('de un Pokémon sale la FASE', pkm.stage === 'Basic' && pkm.energy_type === null, JSON.stringify(pkm))
  const ene = deSubtipos({ supertype: 'Energy', subtypes: ['Basic'] })
  check('de una energía sale el TIPO, y es `Normal`', ene.energy_type === 'Normal' && ene.stage === null, JSON.stringify(ene))
  check('  …y una especial, `Special`', deSubtipos({ supertype: 'Energy', subtypes: ['Special'] }).energy_type === 'Special')
  const tr = deSubtipos({ supertype: 'Trainer', subtypes: ['Pokémon Tool'] })
  check('«Pokémon Tool» es nuestro `Tool`', tr.trainer_type === 'Tool' && tr.stage === null, JSON.stringify(tr))
  check('un partidario', deSubtipos({ supertype: 'Trainer', subtypes: ['Supporter'] }).trainer_type === 'Supporter')
  // Y el caso que importa: lo que NO se reconoce se queda a null y se DICE.
  // Doy por hecho que sus enums japoneses vienen en inglés y no lo he
  // visto: la red de este contenedor no llega a su API (la lección de la
  // 484, que es mía y me costó dos afirmaciones falsas).
  const raro = deSubtipos({ supertype: 'ポケモン', subtypes: ['たね'] })
  check('un supertipo que no se reconoce NO se escribe', raro.category === null, JSON.stringify(raro))
  check('  …y se apunta para que el panel lo diga', raro.supertipoRaro === 'ポケモン' && raro.raros.includes('たね'), JSON.stringify(raro))
  check('y las tres tablas son canónicas', FASE_DE_SUBTIPO['stage 1'] === 'Stage1' && ENTRENADOR_DE_SUBTIPO.stadium === 'Stadium' && ENERGIA_DE_SUBTIPO.basic === 'Normal')
}

console.log('── 3. La fila entera, con las que son `not null` ──')
{
  const f = filaDeCartaSuya(REAL, { setId: 'me55c', market: 'JP' })
  for (const k of ['id', 'set_id', 'local_id', 'name']) {
    check(`\`${k}\` va puesta`, f[k] !== null && f[k] !== undefined && f[k] !== '', JSON.stringify(f[k]))
  }
  check('con su identificador y su número impreso', f.id === 'me55c-58' && f.local_id === '58', JSON.stringify([f.id, f.local_id]))
  check('la rareza va en las DOS columnas', f.rarity === 'Common' && f.rarity_en === 'Common', JSON.stringify([f.rarity, f.rarity_en]))
  check('la imagen, sin la calidad pegada', f.image_scrydex === 'https://images.scrydex.com/pokemon/me55c-58', f.image_scrydex)
  check('y la ficha viene dentro', f.attacks?.length === 2 && f.stage === 'Basic' && f.category === 'Pokemon', JSON.stringify([f.stage, f.category]))
  // Una sola vez cada clave: un literal con `hp` dos veces es legal y hace
  // que quien lo lea no sepa cuál gana.
  const fuente = readFileSync('/home/user/pingu/netlify/lib/scrydex.mjs', 'utf8')
  const cuerpo = fuente.split('export function filaDeCartaSuya')[1].split('\n}')[0]
  const claves = [...cuerpo.matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1])
  check('ninguna clave repetida en la fila', new Set(claves).size === claves.length, claves.filter((k, i) => claves.indexOf(k) !== i).join(','))
}

// ── El doble de una pasada ──
function doble({ mercado = 'JP' } = {}) {
  const escrito = []
  const restImpl = async (ruta) => {
    if (/scrydex_estado/.test(ruta)) return [{ valor: { pagina: 1 } }]
    if (/scrydex_at=is\.null/.test(ruta)) return [{ id: 'x' }]
    if (/tcg_sets/.test(ruta)) return [{ id: 'me55c', scrydex_id: 'me55c' }]
    if (/tcg_cards/.test(ruta)) return []
    return []
  }
  let paginas = 0
  const fetchImpl = async () => {
    paginas++
    return { ok: true, json: async () => ({ data: paginas === 1 ? [REAL] : [], page: paginas, page_size: 250, total_count: 1 }) }
  }
  return { restImpl, fetchImpl, escribirImpl: async (t, filas) => { escrito.push(...filas) }, escrito, mercado }
}
const correr = (d) => procesar({
  env: ENV, paginas: 1, mercado: d.mercado, idioma: d.mercado === 'JP' ? 'ja' : 'en',
  claveEstado: `cartas-${d.mercado.toLowerCase()}`,
  restImpl: d.restImpl, fetchImpl: d.fetchImpl, escribirImpl: d.escribirImpl, guardarEstadoImpl: async () => {},
})

console.log('── 4. LO QUE PROTEGE «JUGAR»: en el occidental no se inserta nada ──')
{
  const jp = doble({ mercado: 'JP' })
  const rj = await correr(jp)
  check('en japonés se calca', rj.cuerpo.calcamosSuCatalogo === true && rj.cuerpo.insertadas === 1, JSON.stringify([rj.cuerpo.calcamosSuCatalogo, rj.cuerpo.insertadas]))
  check('  …y la carta se escribe entera', jp.escrito[0]?.attacks?.length === 2, JSON.stringify(jp.escrito[0]?.id))

  const west = doble({ mercado: 'WEST' })
  const rw = await correr(west)
  check('en occidental NO se calca', rw.cuerpo.calcamosSuCatalogo === false, JSON.stringify(rw.cuerpo.calcamosSuCatalogo))
  check('  …y no se inserta NI UNA carta', rw.cuerpo.insertadas === 0 && west.escrito.length === 0, JSON.stringify(west.escrito.map((f) => f.id)))
  // Pero SÍ se cuenta, que es información: «de esta página, tantas cartas
  // suyas no las tenemos».
  check('  …aunque se dice cuántas no tenemos', rw.cuerpo.sinCartaNuestra === 1, String(rw.cuerpo.sinCartaNuestra))
}

console.log('── 5. Y TCGdex deja en paz lo que calca Scrydex ──')
{
  check('el japonés es de Scrydex', esDeScrydex('JP') && esDeScrydex('jp'), JSON.stringify(MERCADOS_DE_SCRYDEX))
  check('el OCCIDENTAL no lo es, y eso es la mitad del asunto', !esDeScrydex('WEST'))
  // Y la guarda tiene que LLEGAR: si el japonés saliera de
  // `MERCADOS_A_IMPORTAR`, el filtro de los dos importadores no estaría
  // haciendo nada y esta prueba seguiría verde (la lección de la 307).
  check('el japonés sigue en la lista de importados, o el filtro no filtra nada', MERCADOS_A_IMPORTAR.includes('JP'), JSON.stringify(MERCADOS_A_IMPORTAR))
  check('y sigue siendo visible', MERCADOS_VISIBLES.includes('JP'), JSON.stringify(MERCADOS_VISIBLES))
  for (const f of ['catalogo-asia.mjs', 'escaneos-asia.mjs']) {
    const fuente = readFileSync(`/home/user/pingu/netlify/functions/${f}`, 'utf8')
    const linea = fuente.split('\n').find((l) => /^const MERCADOS = MERCADOS_A_IMPORTAR/.test(l)) || ''
    check(`${f} se salta los de Scrydex`, /esDeScrydex/.test(linea), linea.trim().slice(0, 120))
  }
}

console.log('── 6. La migración del borrón ──')
{
  const mig = readFileSync('/home/user/pingu/supabase-migration-japones-de-cero.sql', 'utf8')
  const sinComentarios = mig.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
  const borra = [...sinComentarios.matchAll(/delete from ([a-z_.]+)([^;]*);/gi)].map((m) => [m[1], m[2].replace(/\s+/g, ' ').trim()])
  // LO QUE NO SE PUEDE BORRAR, de ninguna manera: el catálogo occidental.
  check('no borra NADA del occidental', !borra.some(([t, w]) => /tcg_(cards|sets)/.test(t) && /WEST/.test(w)), JSON.stringify(borra))
  for (const t of ['public.tcg_cards', 'public.tcg_sets']) {
    const suyo = borra.find(([x]) => x === t)
    check(`${t} se borra solo del japonés`, suyo && /market = 'JP'/.test(suyo[1]), JSON.stringify(suyo))
  }
  // Y las cuatro tablas de la gente, que es lo que PINGU pidió.
  for (const t of ['public.user_collection', 'public.user_wants', 'public.user_albums', 'public.user_collection_value']) {
    check(`${t} se vacía`, borra.some(([x]) => x === t), JSON.stringify(borra.map(([x]) => x)))
  }
  // EL PASO QUE SE OLVIDA: el progreso guardado del barrido. Sin esto el
  // barrido de cartas se reanuda en la página 57 de ~190 y las 56 primeras
  // no se insertan hasta el barrido siguiente, con el panel diciendo que
  // avanza (la familia del freno que no frena).
  const estado = borra.find(([t]) => /scrydex_estado/.test(t))
  check('el progreso de las pasadas se reinicia', estado && ['cartas-jp', 'sets-jp', 'importar-jp'].every((k) => estado[1].includes(k)), JSON.stringify(estado))
  // Un borrado se enseña ANTES de hacerse.
  check('y enseña el impacto antes de borrar', mig.indexOf('QUÉ SE VA A BORRAR') < mig.indexOf('delete from'), 'el impacto va después del borrado')
  // Las tablas tienen que existir: me inventé `user_cards` en la 543 y era
  // la comprobación de seguridad de un borrado.
  const todas = readFileSync('/home/user/pingu/supabase-migration-mi-coleccion.sql', 'utf8')
    + readFileSync('/home/user/pingu/supabase-migration-intercambios.sql', 'utf8')
    + readFileSync('/home/user/pingu/supabase-migration-albumes.sql', 'utf8')
    + readFileSync('/home/user/pingu/supabase-migration-valor-historico.sql', 'utf8')
  for (const [t] of borra) {
    const nombre = t.replace('public.', '')
    if (/tcg_cards|tcg_sets|scrydex_estado|tcg_card_prices/.test(nombre)) continue
    check(`\`${nombre}\` existe de verdad`, new RegExp(`create table if not exists public\\.${nombre}\\b`).test(todas), nombre)
  }
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
