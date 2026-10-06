// Tanda 684 — los huecos desde Scrydex: la conversión de una carta suya
// (con su ficha REAL pegada byte a byte, sm10-1), el emparejado del set,
// el parche del set, y la pasada entera con Scrydex y base de mentira:
// rellena uno por pasada, desesconde, cuenta créditos, para con 403 y
// salta a la tercera con un 500 suyo; con un fallo nuestro para sin contar.
import { readFileSync } from 'node:fs'
import { filaDeCartaScrydex, precioDeScrydex, faseDe, idNuestro, baseDeFoto, igualarClaves, expansionDelSet, parcheDeSet, pasada, MAXIMO_INTENTOS, CLAVE_ESTADO, VERSION, VERSION_NOMBRES, nombreInglesDe } from '/home/user/pingu/netlify/functions/scrydex-huecos.mjs'

let fails = 0
const check = (n, ok, extra = '') => { console.log(`  ${ok ? 'ok ' : 'FALLA'} ${n}${!ok && extra ? ` — ${extra}` : ''}`); if (!ok) fails++ }
const SM10 = JSON.parse(readFileSync('/tmp/wt-pruebas/pruebas/fixtures/scrydex-cards-sm10-1.json', 'utf8')).data
// El Weedle del Expansion Pack, la ficha JAPONESA real que pegó PINGU
// (685.3): todo en japonés y la traducción inglesa en `translation.en`.
const WEEDLE = JSON.parse(readFileSync('/tmp/wt-pruebas/pruebas/fixtures/scrydex-card-base1_ja-4.json', 'utf8')).data

console.log('── 1. Una carta suya, con nuestras columnas ──')
{
  const f = filaDeCartaScrydex(SM10, { setId: 'sm10', mercado: 'WEST', idioma: 'en', ahora: new Date('2026-10-06T12:00:00Z') })
  check('id con marca de origen, set, número y nombre', f.id === 'scrydex-sm10-1' && f.set_id === 'sm10' && f.local_id === '1' && f.name === 'Pheromosa & Buzzwole-GX' && f.name_en === f.name, JSON.stringify(f).slice(0, 200))
  check('la foto es la BASE sin calidad (lo que espera urlDeFotoScrydex)', f.image_scrydex === 'https://images.scrydex.com/pokemon/sm10-1')
  check('ataques con coste, daño y efecto en nuestra forma', f.attacks.length === 3 && f.attacks[0].name === 'Jet Punch' && f.attacks[0].cost[0] === 'Grass' && f.attacks[0].damage === '30' && /Benched/.test(f.attacks[0].effect))
  check('debilidad, retirada, PS, tipos, fase y Pokédex', f.weaknesses[0].type === 'Fire' && f.retreat === 2 && f.hp === 260 && f.types[0] === 'Grass' && f.stage === 'Basic' && f.dex_ids.join(',') === '794,795', JSON.stringify([f.weaknesses, f.retreat, f.hp, f.types, f.stage, f.dex_ids]))
  check('rareza inglesa, ilustrador, categoría sin tilde, origen y detalle', f.rarity_en === 'Rare Holo GX' && f.illustrator && f.category === 'Pokemon' && f.origen === 'scrydex' && f.detalle_lang === 'en' && !('scrydex_id' in f) && f.scrydex_at)
  const ja = filaDeCartaScrydex({ ...SM10, name: 'フェローチェ＆マッシブーンGX', translation: null }, { setId: 'x', mercado: 'JP', idioma: 'ja' })
  check('en japonés sin traducción el nombre se queda y el inglés sale de la Pokédex (685)', ja.name === 'フェローチェ＆マッシブーンGX' && ja.name_en === 'Buzzwole & Pheromosa-GX' && !('stage' in ja) && !('types' in ja) && !('attacks' in ja), JSON.stringify([ja.name, ja.name_en, ja.stage, ja.types]))
  const w = filaDeCartaScrydex(WEEDLE, { setId: 'base1_ja', mercado: 'JP', idioma: 'ja' })
  check('  …y las impresiones que EXISTEN salen de su `variants` (688): el Weedle solo en normal', JSON.stringify(w.variants) === '{"normal":true}' && !('variants' in filaDeCartaScrydex({ ...WEEDLE, variants: [] }, { setId: 'base1_ja', mercado: 'JP', idioma: 'ja' })), JSON.stringify(w.variants))
  check('la ficha japonesa REAL: nombre japonés, y todo lo canónico de translation.en (685.3)', w.name === 'ビードル' && w.name_en === 'Weedle' && w.category === 'Pokemon' && w.stage === 'Basic' && w.types.join() === 'Grass' && w.rarity_en === 'Common' && w.detalle_lang === 'en', JSON.stringify(w).slice(0, 300))
  check('  …con los ataques y la debilidad en inglés, PS, retirada, Pokédex y foto', w.attacks[0].name === 'Poison Sting' && /Poisoned/.test(w.attacks[0].effect) && w.attacks[0].cost[0] === 'Grass' && w.weaknesses[0].type === 'Fire' && w.hp === 40 && w.retreat === 1 && w.dex_ids[0] === 13 && w.image_scrydex === 'https://images.scrydex.com/pokemon/base1_ja-4' && w.local_id === '13', JSON.stringify(w.attacks))
  check('  …y nada en japonés en las columnas canónicas', !/[\u3040-\u30ff\u4e00-\u9fff]/.test(JSON.stringify([w.category, w.stage, w.types, w.attacks, w.weaknesses, w.rarity_en])))
  const pr = precioDeScrydex('scrydex-base1_ja-4', WEEDLE, new Date('2026-10-06T12:00:00Z'))
  check('el precio de TCGplayer, en dólares, de la impresión normal, NM crudo', pr.card_id === 'scrydex-base1_ja-4' && pr.tp_normal_market === 0.74 && pr.tp_normal_low === 0.65 && pr.origen === 'scrydex', JSON.stringify(pr))
  check('  …sin precio en dólares no hay fila', precioDeScrydex('x', { variants: [{ name: 'normal', prices: [{ type: 'raw', condition: 'NM', currency: 'JPY', market: 500 }] }] }) === null)
  check('nombreInglesDe: fase, ex/EX, mega, V, y sin Pokédex nada', nombreInglesDe({ national_pokedex_numbers: [9], subtypes: ['Stage 2'] }) === 'Blastoise' && nombreInglesDe({ national_pokedex_numbers: [6], subtypes: ['Basic', 'ex'] }) === 'Charizard ex' && nombreInglesDe({ national_pokedex_numbers: [6], subtypes: ['Basic', 'EX'] }) === 'Charizard-EX' && nombreInglesDe({ national_pokedex_numbers: [6], subtypes: ['MEGA', 'EX'] }) === 'M Charizard-EX' && nombreInglesDe({ national_pokedex_numbers: [25], subtypes: ['Basic', 'V'] }) === 'Pikachu V' && nombreInglesDe({ subtypes: ['Item'] }) === null && nombreInglesDe({ national_pokedex_numbers: [1, 2, 3] }) === null)
  check('faseDe: «Stage 1» → Stage1, y GX no es fase', faseDe(['Stage 1', 'GX']) === 'Stage1' && faseDe(['GX']) === null)
  check('idNuestro limpia', idNuestro('SV1a-001') === 'scrydex-sv1a-001')
  check('baseDeFoto sin cara, null', baseDeFoto({ images: [{ type: 'back', large: 'https://images.scrydex.com/pokemon/x/large' }] }) === null)
  const ig = igualarClaves([{ a: 1 }, { b: 2 }])
  check('igualarClaves rellena con null', Object.keys(ig[0]).join() === 'a,b' && ig[0].b === null && ig[1].a === null)
}

console.log('── 2. La expansión de un set ──')
{
  const exps = [
    { id: 'base1', name: 'Expansion Pack', total: 102, printed_total: 102, release_date: '1996/10/20', logo: 'https://images.scrydex.com/pokemon/base1-logo/logo' },
    { id: 'jungle', name: 'Pokémon Jungle', total: 48, printed_total: 48, release_date: '1997/03/05' },
    { id: 'promo', name: 'Promos', total: 0, release_date: '1998/01/01' },
  ]
  check('por scrydex_id', expansionDelSet({ scrydex_id: 'jungle', name: 'Otra' }, exps).por === 'scrydex_id')
  check('por nombre exacto', expansionDelSet({ name: 'Expansion Pack', name_en: 'Expansion Pack' }, exps).expansion?.id === 'base1')
  const h = expansionDelSet({ id: 'JUNGLE_', name: 'ジャングル', release_date: '1997-03-05', card_count_official: 48 }, exps)
  check('por huella (fecha + cuenta) cuando el nombre está en kanji', h.expansion?.id === 'jungle', JSON.stringify(h))
  check('sin nada, sin expansión', expansionDelSet({ name: 'Nada', release_date: '2000-01-01', card_count_official: 1 }, exps).expansion === null)
  const p = parcheDeSet({ id: 'x', release_date: null, card_count_total: null, card_count_official: 0, name_en: null }, exps[0], new Date('2026-10-06T00:00:00Z'))
  check('el parche apunta la expansión, desesconde y rellena solo lo vacío', p.scrydex_id === 'base1' && p.oculto === false && p.release_date === '1996-10-20' && p.card_count_total === 102 && p.card_count_official === 102 && p.name_en === 'Expansion Pack' && p.logo_scrydex, JSON.stringify(p))
  check('  …y no pisa lo que ya hay', !('release_date' in parcheDeSet({ release_date: '1996-10-21', card_count_total: 103, card_count_official: 1, name_en: 'X' }, exps[0])))
  check('  …y no escribe scrydex_at en el set (no existe ahí; 685.2)', !('scrydex_at' in p))
}

console.log('── 3. La pasada, con Scrydex y base de mentira ──')
{
  const montar = ({ scrydexStatus = 200, nuestraFalla = false } = {}) => {
    const escrito = { cartas: [], parches: [], precios: [] }
    const estados = {}
    const aMedias = new Set()
    const sets = { JP: [
      { id: 'BASE1_', name: 'Expansion Pack', name_en: 'Expansion Pack', release_date: '1996-10-20', card_count_official: 102, oculto: true },
      { id: 'LLENO', name: 'Lleno', name_en: 'Lleno', oculto: false },
      { id: 'RARO', name: 'Raro', name_en: 'Raro', oculto: true },
    ], WEST: [] }
    const peticiones = []
    const fetchImpl = async (url) => {
      peticiones.push(url)
      const r = (status, cuerpo) => ({ ok: status < 400, status, text: async () => (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)) })
      if (scrydexStatus !== 200) return r(scrydexStatus, scrydexStatus === 403 ? '{"error":"subscription required"}' : 'boom')
      if (/\/ja\/expansions/.test(url)) return r(200, { data: [{ id: 'base1', name: 'Expansion Pack', total: 2, printed_total: 2, release_date: '1996/10/20', logo: 'https://images.scrydex.com/pokemon/base1-logo/logo' }, { id: 'jungle', name: 'Pokémon Jungle', total: 48, printed_total: 48, release_date: '1997/03/05' }] })
      if (/\/en\/expansions/.test(url)) return r(200, { data: [] })
      if (/\/ja\/cards/.test(url)) return r(200, { data: [{ ...WEEDLE, id: 'base1-4', number: '4', name: 'リザードン', national_pokedex_numbers: [6], translation: { en: { ...WEEDLE.translation.en, name: 'Charizard' } }, images: [{ type: 'front', large: 'https://images.scrydex.com/pokemon/base1-4/large' }] }, { ...WEEDLE, id: 'base1-5', number: '5', name: 'ピッピ', national_pokedex_numbers: [35], translation: null, variants: [] }] })
      return r(500, 'ruta no prevista ' + url)
    }
    const restImpl = async (ruta, opciones) => {
      if (nuestraFalla && ruta.startsWith('tcg_cards?on_conflict')) throw new Error('Supabase 500: boom')
      if (ruta.startsWith('tcg_sets?select')) return sets[/market=eq\.(\w+)/.exec(ruta)[1]]
      if (ruta.startsWith('tcg_cards?select=id')) {
        const id = /set_id=eq\.(\w+)/.exec(ruta)?.[1]
        if (/origen=eq\.scrydex/.test(ruta)) return aMedias.has(id) ? [{ id: 'x' }] : []
        return id === 'LLENO' || aMedias.has(id) ? [{ id: 'x' }] : []
      }
      if (ruta.startsWith('tcg_cards?on_conflict')) { escrito.cartas.push(...JSON.parse(opciones.body)); return null }
      if (ruta.startsWith('tcg_sets?market=')) { escrito.parches.push({ ruta, body: JSON.parse(opciones.body) }); return null }
      if (ruta.startsWith('tcg_card_prices?on_conflict=card_id')) { escrito.precios.push(...JSON.parse(opciones.body)); return null }
      throw new Error('ruta no prevista ' + ruta)
    }
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'k', SCRYDEX_API_KEY: 's', SCRYDEX_TEAM_ID: 't' }
    const correr = (ahora = new Date('2026-10-06T12:00:00Z')) => pasada({ env, fetchImpl, restImpl, estadoImpl: async (k) => estados[k] || {}, guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) }, ahora, pausa: async () => {} })
    return { correr, escrito, estados, peticiones, sets, aMedias }
  }
  {
    const { correr, escrito, estados, peticiones, sets, aMedias } = montar()
    const r1 = await correr()
    check('primera pasada: la lista (1 crédito) y el primer vacío rellenado (1 crédito)', r1.ok && r1.rellenado?.set === 'BASE1_' && r1.rellenado.cartas === 2 && r1.rellenado.por === 'nombre' && r1.creditos === 2, JSON.stringify(r1))
    check('  …las cartas con nuestro id, set, mercado, foto y nombre inglés (de la traducción, o de la Pokédex)', escrito.cartas.length === 2 && escrito.cartas[0].id === 'scrydex-base1-4' && escrito.cartas[0].set_id === 'BASE1_' && escrito.cartas[0].market === 'JP' && escrito.cartas[0].image_scrydex === 'https://images.scrydex.com/pokemon/base1-4' && escrito.cartas[0].name === 'リザードン' && escrito.cartas[0].name_en === 'Charizard' && escrito.cartas[1].name_en === 'Clefairy', JSON.stringify(escrito.cartas.map((c) => [c.name, c.name_en])))
    check('  …y el precio de TCGplayer de la que lo trae', escrito.precios.length === 1 && escrito.precios[0].card_id === 'scrydex-base1-4' && escrito.precios[0].tp_normal_market === 0.74 && r1.rellenado.cartas === 2, JSON.stringify(escrito.precios))
    check('  …con las mismas claves las dos (igualarClaves)', Object.keys(escrito.cartas[0]).join() === Object.keys(escrito.cartas[1]).join())
    check('  …y el set desescondido y apuntado', escrito.parches[0]?.body.oculto === false && escrito.parches[0].body.scrydex_id === 'base1' && /id=eq\.BASE1_/.test(escrito.parches[0].ruta))
    const r2 = await correr()
    check('segunda pasada: el lleno se apunta y el siguiente vacío no casa → sinPar, sin gastar', r2.ok && r2.mirado?.set === 'RARO' && r2.mirado.estado === 'sinPar' && r2.creditos === 2 && estados[CLAVE_ESTADO].vistos['JP|LLENO']?.estado === 'lleno', JSON.stringify(r2))
    const r3 = await correr()
    check('tercera: la lista occidental (vacía, 1 crédito) y nada más que hacer', r3.ok && r3.hecho === true && r3.creditos === 3 && !peticiones.some((u) => /no prevista/.test(u)), JSON.stringify(r3))
    // Un rellenado de ANTES de los nombres (685) se vuelve a pasar, uno por
    // pasada, antes de buscar más vacíos.
    estados[CLAVE_ESTADO].vistos['JP|BASE1_'].nombres = 0
    const rn = await correr()
    check('un rellenado sin nombres ingleses se vuelve a escribir con ellos (1 crédito)', rn.ok && rn.nombres?.set === 'BASE1_' && rn.nombres.conNombreIngles === 2 && rn.creditos === 4 && estados[CLAVE_ESTADO].vistos['JP|BASE1_'].nombres === VERSION_NOMBRES, JSON.stringify(rn))
    // Un set a MEDIAS (685.2): tiene cartas de Scrydex pero el PATCH no llegó
    // (sin `scrydex_por`). Se remata sin pedir nada a Scrydex.
    // Con un `scrydex_por` VIEJO (de la 547), que es como estaban el Expansion
    // Pack y Jungle de verdad (685.4): se remata igual.
    sets.JP.push({ id: 'MEDIAS_', name: 'Pokémon Jungle', name_en: 'Pokémon Jungle', release_date: '1997-03-05', card_count_official: 48, oculto: true, scrydex_por: 'fecha+cuenta' })
    aMedias.add('MEDIAS_')
    estados[CLAVE_ESTADO].llenosOlvidados = 'otra'
    const rm = await correr()
    check('un set a medias se remata: parche y rellenado, sin créditos', rm.ok && rm.rematado?.set === 'MEDIAS_' && rm.creditos === 4 && escrito.parches.at(-1).body.oculto === false && estados[CLAVE_ESTADO].vistos['JP|MEDIAS_'].estado === 'rellenado' && estados[CLAVE_ESTADO].vistos['JP|MEDIAS_'].nombres === 0, JSON.stringify(rm))
    check('  …y los llenos se olvidaron una vez por versión', estados[CLAVE_ESTADO].llenosOlvidados === VERSION)
    const rn2 = await correr()
    check('  …y a la pasada siguiente la fase 0 le pone los nombres (1 crédito)', rn2.nombres?.set === 'MEDIAS_' && rn2.creditos === 5, JSON.stringify(rn2))
    const r4 = await correr(new Date('2026-10-20T12:00:00Z'))
    check('a las dos semanas se vuelve a pedir la lista y a mirar lo sinPar, no lo rellenado', r4.ok && r4.mirado?.set === 'RARO' && r4.creditos === 6 && estados[CLAVE_ESTADO].vistos['JP|BASE1_'].estado === 'rellenado', JSON.stringify(r4))
  }
  {
    const { correr, estados } = montar({ scrydexStatus: 403 })
    const r = await correr()
    check('un 403 de Scrydex para hasta mañana y lo dice', !r.ok && /403/.test(r.error) && estados[CLAVE_ESTADO].parado?.dia === '2026-10-06', JSON.stringify(r))
    const r2 = await correr()
    check('  …y la pasada siguiente del día no pide nada', r2.saltado && /parado hoy/.test(r2.saltado) && r2.creditos === undefined)
  }
  {
    const { correr, estados } = montar({ scrydexStatus: 500 })
    let r
    for (let i = 0; i < MAXIMO_INTENTOS; i++) r = await correr()
    check(`un 500 suyo en la lista cuenta como error y no para el día`, !r.ok && /500/.test(r.error) && !estados[CLAVE_ESTADO].parado, JSON.stringify(r))
  }
  {
    // Un fallo NUESTRO al escribir: para, sin contar intento.
    const { correr, estados } = montar({ nuestraFalla: true })
    const r = await correr()
    check('un fallo nuestro al escribir para y se apunta, sin intento', !r.ok && /nuestra base/.test(r.error) && !estados[CLAVE_ESTADO].intentos['JP|BASE1_'] && estados[CLAVE_ESTADO].vistos['JP|BASE1_'] === undefined, JSON.stringify(r))
    check('  …y queda parado hasta otra versión: la pasada siguiente no gasta ni un crédito', estados[CLAVE_ESTADO].parado?.version === VERSION && /desde la versión/.test((await correr()).saltado || '') && estados[CLAVE_ESTADO].gasto.creditos === 2, JSON.stringify(estados[CLAVE_ESTADO].parado))
  }
  check('sin claves de Scrydex se salta y lo dice', (await pasada({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl: async () => { throw new Error('no') } })).saltado?.includes('SCRYDEX_API_KEY'))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
