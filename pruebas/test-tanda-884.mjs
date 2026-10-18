// Tanda 884 — el Silver Deck Kit a mano: la lista escrita, la ficha copiada
// de EX Team Rocket Returns, y el orden con Scrydex y el calco.
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const mano = await import(`${RAIZ}/netlify/functions/decks-jp-a-mano.mjs`)
const copia = (x) => JSON.parse(JSON.stringify(x))
const SILVER = mano.DECKS.find((d) => d.clave === 'pcg-silver_ja')

console.log('── 1. La lista ──')
{
  check('el Silver Deck Kit: 20 cartas, 2004-10-15, japonés', SILVER && SILVER.cartas.length === 20 && SILVER.set.release_date === '2004-10-15' && SILVER.set.card_count_total === 20 && SILVER.set.name_en === 'Silver Deck Kit')
  check('numeradas 001–020 sin repetir', SILVER.cartas.map((c) => c.n).join() === Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(3, '0')).join())
  check('la 014 es わるいカイリュー, copiada de la Dark Dragonite 15 de Team Rocket Returns, holo', SILVER.cartas[13].ja === 'わるいカイリュー' && SILVER.cartas[13].en === 'Dark Dragonite' && SILVER.cartas[13].de === 'ex7-15' && SILVER.cartas[13].holo === true)
  check('todas con nombre japonés, inglés y una fuente (una carta o un nombre que buscar)', SILVER.cartas.every((c) => c.ja && c.en && (c.de || c.buscar)))
}

console.log('\n── 2. Las filas ──')
{
  const WEST = new Map([
    ['ex7-15', { id: 'ex7-15', name: 'Dark Dragonite', name_en: 'Dark Dragonite', category: 'Pokemon', hp: 120, types: ['Darkness'], stage: 'Stage2', evolve_from: 'Dark Dragonair', retreat: 2, attacks: [{ name: 'Double Wing Attack', damage: '30' }, { name: 'Claw Swipe', damage: '50' }], abilities: [{ type: 'Poke-POWER', name: 'Dark Trance' }], weaknesses: [{ type: 'Colorless', value: '×2' }], resistances: null, illustrator: 'Nakaoka', rarity: 'Rare Holo', rarity_en: 'Rare Holo', dex_ids: [149], detalle_lang: 'es', variants: { holo: true, normal: true } }],
    ['ex7-70', { id: 'ex7-70', name: 'Psyduck', name_en: 'Psyduck', category: 'Pokemon', hp: 50, types: ['Water'], stage: 'Basic', dex_ids: [54], illustrator: 'Miki Tanaka', detalle_lang: 'es' }],
  ])
  const POT = new Map([['Potion', { id: 'ex1-100', name: 'Potion', name_en: 'Potion', category: 'Trainer', trainer_type: 'Item', description: 'Quita 2 contadores de daño.', detalle_lang: 'es' }]])
  const { filas, copiadas, sinFuente } = mano.filasDelDeck(SILVER, { porId: WEST, porNombre: POT, ahora: new Date('2026-10-18T12:00:00Z') })
  const drag = filas.find((f) => f.local_id === '014')
  check('la 014: id del set, mercado JP, nombre japonés, inglés, y la ficha de la 15/109 encima', drag.id === 'pcg-silver_ja-014' && drag.market === 'JP' && drag.set_id === 'pcg-silver_ja' && drag.name === 'わるいカイリュー' && drag.name_en === 'Dark Dragonite' && drag.hp === 120 && drag.abilities?.[0]?.name === 'Dark Trance' && drag.attacks?.[1]?.name === 'Claw Swipe' && drag.illustrator === 'Nakaoka' && JSON.stringify(drag.dex_ids) === '[149]' && drag.origen === 'mano', JSON.stringify(drag))
  check('  …holo, y la 013 (la misma carta) normal', JSON.stringify(drag.variants) === '{"holo":true}' && JSON.stringify(filas.find((f) => f.local_id === '013').variants) === '{"normal":true}')
  check('  …y el idioma de la ficha es el de la copiada (español de TCGdex)', drag.detalle_lang === 'es')
  check('Potion se copia de la occidental encontrada por nombre; su texto a mano manda', filas.find((f) => f.local_id === '016').description === 'Remove 2 damage counters from 1 of your Pokémon.' && filas.find((f) => f.local_id === '016').trainer_type === 'Item')
  const sin = filas.find((f) => f.local_id === '015')
  check('Energy Search sin fuente en la base: queda con lo escrito a mano (Trainer, texto) y sin inventar nada más', sin.category === 'Trainer' && sin.description && sin.hp === null && sin.dex_ids === null)
  check('todas las filas llevan las MISMAS claves (la 391), y las obligatorias', filas.every((f) => Object.keys(f).length === Object.keys(filas[0]).length) && filas.every((f) => f.id && f.name && f.local_id && f.set_id && f.market === 'JP'))
  check('ninguna foto inventada', filas.every((f) => !('image_path' in f) && !('image_scrydex' in f) && !('image_tcggo' in f)))
  check('cuenta: 3 copiadas (014, 013, 001 y Potion = 4), 16 sin fuente aquí', copiadas === 4 && sinFuente.length === 16, `${copiadas} / ${sinFuente.length}`)
  const set = mano.filaDelSet(SILVER, { serie_id: 'pcg', serie_name: 'PCG', serie_name_en: 'PCG' })
  check('el set: a la vista, con su serie, sus cuentas y «mano»', set.id === 'pcg-silver_ja' && set.oculto === false && set.serie_id === 'pcg' && set.card_count_total === 20 && set.origen === 'mano' && set.name_en === 'Silver Deck Kit')
}

console.log('\n── 3. El orden con las otras fuentes ──')
{
  check('ya existe: por id, por nombre o por fecha+cuenta', mano.setQueYaExiste(SILVER.set, [{ id: 'pcg-silver_ja' }])?.id === 'pcg-silver_ja' && mano.setQueYaExiste(SILVER.set, [{ id: 'x', name_en: 'silver deck kit' }])?.id === 'x' && mano.setQueYaExiste(SILVER.set, [{ id: 'y', release_date: '2004-10-15', card_count_total: 20 }])?.id === 'y' && !mano.setQueYaExiste(SILVER.set, [{ id: 'z', name_en: 'Rocket Gang Strikes Back', release_date: '2004-10-15', card_count_total: 84 }]))
  check('lo trae Scrydex: por nombre o por fecha (con barras) y total', mano.loTraeScrydex(SILVER.set, [{ id: 's', translation: null, name_en: 'Silver Deck Kit' }])?.id === 's' && mano.loTraeScrydex(SILVER.set, [{ id: 't', name: 'x', release_date: '2004/10/15', total: 20 }])?.id === 't' && !mano.loTraeScrydex(SILVER.set, [{ id: 'u', name: 'x', release_date: '2004/10/15', total: 84 }]))
}

console.log('\n── 4. La pasada ──')
function montar({ sets = [], deScrydex = {}, estado = {}, west = {} } = {}) {
  const estados = { [mano.CLAVE_ESTADO]: copia(estado), [mano.CLAVE_DECKS_SCRYDEX]: copia(deScrydex) }
  const llamadas = []
  const b = {
    env: { SUPABASE_SERVICE_ROLE_KEY: 's' },
    estadoImpl: async (k) => copia(estados[k] || {}),
    guardarEstadoImpl: async (k, v) => { estados[k] = copia(v) },
    restImpl: async (ruta, o = null) => {
      llamadas.push({ ruta: decodeURIComponent(ruta), metodo: o?.method || 'GET', cuerpo: o?.body ? JSON.parse(o.body) : null })
      if (o) return null
      if (ruta.startsWith('tcg_sets?')) return copia(sets)
      if (ruta.startsWith('tcg_cards?') && /id=in\./.test(ruta)) return Object.values(west)
      if (ruta.startsWith('tcg_cards?') && /name_en=eq\.Potion/.test(ruta)) return [{ id: 'ex1-100', name_en: 'Potion', category: 'Trainer', trainer_type: 'Item' }]
      return []
    },
    ahora: new Date('2026-10-18T12:00:00Z'),
  }
  return { b, estados, llamadas, e: () => estados[mano.CLAVE_ESTADO] }
}
const HERMANO = { id: 'tcggo-500', name_en: 'Rocket Gang Strikes Back', release_date: '2004-10-15', card_count_total: 84, serie_id: 'pcg', serie_name: 'PCG', serie_name_en: 'PCG', oculto: false }
{
  // Scrydex ya tiene su lista y el deck NO está: se crea.
  const m = montar({ sets: [HERMANO], deScrydex: { lista: { expansiones: [{ id: 'pcg3_ja', name_en: 'Rocket Gang Strikes Back', release_date: '2004/10/15', total: 84 }] } }, west: { 'ex7-15': { id: 'ex7-15', name_en: 'Dark Dragonite', hp: 120, dex_ids: [149] } } })
  const r = await mano.pasada(m.b)
  check('crea el set con sus 20 cartas', r.ok && r.creado?.set === 'pcg-silver_ja' && r.creado.cartas === 20, JSON.stringify(r))
  const set = m.llamadas.find((l) => l.metodo === 'POST' && l.ruta === 'tcg_sets')?.cuerpo?.[0]
  check('  …el set con la serie del hermano del mismo día, a la vista', set?.serie_id === 'pcg' && set.oculto === false && set.name_en === 'Silver Deck Kit', JSON.stringify(set))
  const cartas = m.llamadas.find((l) => l.metodo === 'POST' && l.ruta.startsWith('tcg_cards?on_conflict'))?.cuerpo || []
  check('  …las 20 cartas en un upsert por (id, market), con la Dragonite copiada', cartas.length === 20 && cartas.find((c) => c.id === 'pcg-silver_ja-014')?.hp === 120)
  check('  …queda conservado para el calco (883)', m.estados[mano.CLAVE_DECKS_SCRYDEX].conservados?.['pcg-silver_ja']?.por === 'mano')
  check('  …y apuntado como hecho', m.e().hechos['pcg-silver_ja']?.estado === 'creado' && m.e().hechos['pcg-silver_ja'].cartas === 20)
  const r2 = await mano.pasada(m.b)
  check('la segunda pasada no hace nada', r2.hecho === true && m.llamadas.filter((l) => l.metodo === 'POST').length === 2)
}
{
  // Scrydex lo lista: se deja a Scrydex (trae fotos).
  const m = montar({ sets: [HERMANO], deScrydex: { lista: { expansiones: [{ id: 'rocket_silver_ja', name_en: 'Silver Deck Kit', release_date: '2004/10/15', total: 20 }] } } })
  const r = await mano.pasada(m.b)
  check('si Scrydex lo tiene, no se crea aquí: «laTraeScrydex»', r.laTraeScrydex === 'rocket_silver_ja' && !m.llamadas.some((l) => l.metodo === 'POST') && m.e().hechos['pcg-silver_ja']?.estado === 'laTraeScrydex')
}
{
  // Sin lista de Scrydex todavía: espera unas pasadas y luego crea.
  const m = montar({ sets: [HERMANO], deScrydex: {} })
  let r
  for (let i = 0; i < mano.ESPERAS_MAXIMAS; i++) r = await mano.pasada(m.b)
  check(`sin la lista de Scrydex espera ${mano.ESPERAS_MAXIMAS} pasadas`, /esperando/.test(JSON.stringify(r)) && !m.llamadas.some((l) => l.metodo === 'POST'), JSON.stringify(r))
  r = await mano.pasada(m.b)
  check('  …y a la siguiente crea igual', r.creado?.set === 'pcg-silver_ja')
  const p = montar({ sets: [HERMANO], deScrydex: { parado: { motivo: '402' } } })
  check('con Scrydex parada no espera: crea', (await mano.pasada(p.b)).creado?.set === 'pcg-silver_ja')
}
{
  const m = montar({ sets: [HERMANO, { id: 'tcggo-9', name_en: 'Silver Deck Kit', release_date: '2004-10-15', card_count_total: 20 }], deScrydex: {} })
  const r = await mano.pasada(m.b)
  check('si ya existe (lo trajo TCGGO), no se crea', r.yaExiste === 'tcggo-9' && !m.llamadas.some((l) => l.metodo === 'POST'))
}
{
  const m = montar({ sets: [HERMANO], deScrydex: { lista: { expansiones: [] } } })
  const orig = m.b.restImpl
  m.b.restImpl = async (ruta, o) => { if (o && ruta === 'tcg_sets') throw new Error('Supabase 500'); return orig(ruta, o) }
  const r = await mano.pasada(m.b)
  check('un fallo nuestro cuenta intento y se apunta', r.ok === false && m.e().intentos['pcg-silver_ja'] === 1 && /500/.test(m.e().ultimoError.error))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
